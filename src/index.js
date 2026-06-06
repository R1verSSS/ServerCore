require('dotenv').config();
const { initFileLogging } = require('./services/fileLogService');
initFileLogging();
const fs = require('node:fs');
const path = require('node:path');
const dns = require('node:dns');
const { Client, Collection, GatewayIntentBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { handleRoleButton } = require('./services/rolePanel');
const { addMessageXp } = require('./services/xpService');
const { closeTicket } = require('./services/ticketService');
const { joinEvent, leaveEvent } = require('./services/eventService');
const { safeDefer, safeReply, safeEdit, isDiscordNetworkTimeout, logSoftDiscordNetworkError } = require('./utils/safeInteraction');
const { buildUnlockedText } = require('./services/achievementService');
const { incrementQuestProgress } = require('./services/questService');
const { handleGamePanelButton } = require('./services/gamePanel');
const { startWebPanel } = require('./web/server');
const { handleModerationPanelButton } = require('./services/moderationPanel');
const { handleAutomodMessage } = require('./services/automodService');
const { updateApplicationStatus, createApplication, publishApplication, normalizeFields, notifyApplicant } = require('./services/applicationService');
const { buildApplyModal } = require('./commands/apply');
const { voteSuggestion, setSuggestionStatus, votePoll, closePoll } = require('./services/suggestionService');
const { startNotificationScheduler } = require('./services/notificationService');
const { joinLfg, leaveLfg, closeLfg, buildLfgEmbed, buildLfgButtons } = require('./services/lfgService');
const { handleVoiceStateUpdate, handleVoiceButton, buildVoiceInfoEmbed, buildRenameModal, buildLimitModal, handleRenameModal, handleLimitModal, handleInviteSelect, buildVoiceActionPayload } = require('./services/tempVoiceService');
const { startAutoBackupScheduler } = require('./services/backupService');
const { buildMainMenuPayload, buildSectionPayload, buildQuickPayload } = require('./services/userMenuService');
const { sendWelcome, buildOnboardingStepPayload } = require('./services/onboardingService');
const { buildHelpPayload } = require('./commands/help');
const { error: errorPayload } = require('./services/responseService');
const { getMaintenance, isMaintenanceCommandAllowed } = require('./services/maintenanceService');
const { runStartupSelfCheck } = require('./services/selfCheckService');
const { addAudit } = require('./services/auditService');
const { buildMeHint } = require('./commands/me');
const { buildHostingReadiness } = require('./services/hostingCheckService');
const { checkInteractionAccess, checkComponentAccess, denyInteraction } = require('./services/accessControlService');
const { buildCommandReferencePayload } = require('./services/commandReferenceService');
const { handleShopButton, handleShopSelect } = require('./services/shopPanel');
const { handleProtectedChannelMessage } = require('./services/protectedChannelService');
const { handleMusicButton, handleMusicModal } = require('./services/musicService');

// Для нестабильных сетей Discord/Cloudflare: сначала пробуем IPv4.
// Это часто устраняет UND_ERR_CONNECT_TIMEOUT на Windows.
dns.setDefaultResultOrder('ipv4first');

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT. Shutting down ServerCore gracefully...');
  client?.destroy?.();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Shutting down ServerCore gracefully...');
  client?.destroy?.();
  process.exit(0);
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers],
  rest: { timeout: Number(process.env.DISCORD_REST_TIMEOUT || 60000) }
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

client.once('clientReady', readyClient => {
  console.log(`Bot is online as ${readyClient.user.tag}`);
  startWebPanel(readyClient);
  startNotificationScheduler(readyClient);
  startAutoBackupScheduler();
  runStartupSelfCheck(readyClient).catch(error => console.error('Startup self-check error:', error));
  const hosting = buildHostingReadiness();
  console.log(`Hosting readiness: ${hosting.okCount}/${hosting.total}. Подробно: npm run hosting:check или /hosting-check`);
});

client.on('guildMemberAdd', async member => {
  try {
    if (!member.user.bot) await sendWelcome(member);
  } catch (error) {
    console.error('Onboarding welcome error:', error);
  }
});


client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    await handleVoiceStateUpdate(oldState, newState);
  } catch (error) {
    console.error('Temp voice system error:', error);
  }
});

client.on('messageCreate', async message => {
  try {
    const protectedDeleted = await handleProtectedChannelMessage(message);
    if (protectedDeleted) return;
    const automod = await handleAutomodMessage(message);
    if (automod && automod.ok === false) return;
    await addMessageXp(message);
    if (message.guild && !message.author.bot) {
      incrementQuestProgress(message.author.id, message.author.username, 'message', 1);
    }
  } catch (error) {
    console.error('XP system error:', error);
  }
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command || typeof command.autocomplete !== 'function') return;
      await command.autocomplete(interaction);
      return;
    }

    if ((interaction.isButton?.() || interaction.isAnySelectMenu?.() || interaction.isModalSubmit?.()) && interaction.customId) {
      const access = checkComponentAccess(interaction);
      if (!access.ok) {
        await denyInteraction(interaction, access, { type: 'component' });
        return;
      }
    }

    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;
      const access = checkInteractionAccess(interaction);
      if (!access.ok) {
        await denyInteraction(interaction, access, { type: 'slash' });
        return;
      }
      const maintenance = getMaintenance();
      const isAdmin = interaction.memberPermissions?.has('Administrator') || interaction.memberPermissions?.has('ManageGuild');
      if (maintenance.enabled && !isAdmin && !isMaintenanceCommandAllowed(interaction.commandName)) {
        await safeDefer(interaction, true);
        await safeEdit(interaction, errorPayload('Режим обслуживания', `${maintenance.reason}\n\nКоманда временно недоступна.`));
        return;
      }
      addAudit('command_execute', interaction.user, { command: interaction.commandName, guildId: interaction.guildId, channelId: interaction.channelId });
      await command.execute(interaction);
      return;
    }

    if (interaction.isContextMenuCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;
      const access = checkInteractionAccess(interaction);
      if (!access.ok) {
        await denyInteraction(interaction, access, { type: 'context' });
        return;
      }
      addAudit('context_execute', interaction.user, { command: interaction.commandName, guildId: interaction.guildId, channelId: interaction.channelId });
      await command.execute(interaction);
      return;
    }


    if (interaction.isModalSubmit() && interaction.customId === 'voice:modal:rename') {
      await safeDefer(interaction, true);
      const result = await handleRenameModal(interaction);
      let text = result?.ok ? `✏️ Комната переименована: **${result.room.name}**.` : '❌ Не удалось переименовать комнату.';
      if (!result?.ok && result?.reason === 'not_in_room') text = '❌ Ты должен находиться во временной voice-комнате.';
      if (!result?.ok && result?.reason === 'no_permission') text = '❌ Управлять комнатой может владелец или модератор.';
      await safeEdit(interaction, { content: text, embeds: [], components: [] });
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'voice:modal:limit') {
      await safeDefer(interaction, true);
      const result = await handleLimitModal(interaction);
      let text = result?.ok ? `👥 Лимит комнаты установлен: **${result.room.limit || 'без лимита'}**.` : '❌ Не удалось изменить лимит.';
      if (!result?.ok && result?.reason === 'bad_limit') text = '❌ Укажи число от 0 до 99.';
      if (!result?.ok && result?.reason === 'not_in_room') text = '❌ Ты должен находиться во временной voice-комнате.';
      if (!result?.ok && result?.reason === 'no_permission') text = '❌ Управлять комнатой может владелец или модератор.';
      await safeEdit(interaction, { content: text, embeds: [], components: [] });
      return;
    }


    if (interaction.isModalSubmit() && interaction.customId === 'music:modal:play') {
      await safeDefer(interaction, true);
      const payload = await handleMusicModal(interaction);
      await safeEdit(interaction, payload);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('application:modal:')) {
      await safeDefer(interaction, true);
      const [, , type] = interaction.customId.split(':');
      const values = {};
      for (const [key, component] of interaction.fields.fields) {
        values[key] = component.value;
      }
      const fields = normalizeFields(type, values);
      const app = createApplication(interaction.user.id, interaction.user.username, type, fields);
      await publishApplication(interaction.guild, app).catch(console.error);
      await safeEdit(interaction, { content: `✅ Заявка **#${app.id}** отправлена администрации.`, embeds: [], components: [] });
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('applypanel:')) {
      const [, type] = interaction.customId.split(':');
      await interaction.showModal(buildApplyModal(type));
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'menu:section') {
      const section = interaction.values?.[0] || 'profile';
      await safeReply(interaction, buildSectionPayload(section));
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'help:section') {
      const section = interaction.values?.[0] || 'start';
      await safeReply(interaction, buildHelpPayload(section));
      return;
    }

    // Быстрые справочные кнопки/меню отвечают одним reply без defer.
    // Это уменьшает риск ошибки "Project думает..." при нестабильном локальном REST-доступе к Discord.
    if (interaction.isStringSelectMenu() && interaction.customId === 'commands:section') {
      const section = interaction.values?.[0] || 'profile';
      await safeReply(interaction, buildCommandReferencePayload(section));
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('commands:open:')) {
      const section = interaction.customId.split(':')[2] || 'profile';
      await safeReply(interaction, buildCommandReferencePayload(section));
      return;
    }


    if (interaction.isButton() && interaction.customId.startsWith('music:')) {
      const payload = await handleMusicButton(interaction);
      if (payload) {
        await safeDefer(interaction, true);
        await safeEdit(interaction, payload);
      }
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'shop:item_select') {
      await safeDefer(interaction, true);
      await safeEdit(interaction, handleShopSelect(interaction));
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('shop:')) {
      await safeDefer(interaction, true);
      const payload = await handleShopButton(interaction);
      await safeEdit(interaction, payload);
      return;
    }

    if (interaction.isUserSelectMenu() && interaction.customId === 'voice:invite_select') {
      await safeDefer(interaction, true);
      const result = await handleInviteSelect(interaction);
      let text = result?.ok ? `✅ <@${result.user.id}> получил доступ к комнате.` : '❌ Не удалось пригласить участника.';
      if (!result?.ok && result?.reason === 'not_in_room') text = '❌ Ты должен находиться во временной voice-комнате.';
      if (!result?.ok && result?.reason === 'no_permission') text = '❌ Управлять комнатой может владелец или модератор.';
      await safeEdit(interaction, { content: text, embeds: [], components: [] });
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('role:toggle:')) {
      await handleRoleButton(interaction);
      return;
    }








    if (interaction.isButton() && interaction.customId.startsWith('onboarding:')) {
      await safeDefer(interaction, true);
      const step = interaction.customId.split(':')[1] || 'menu';
      await safeEdit(interaction, buildOnboardingStepPayload(interaction, step));
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('me:')) {
      await safeDefer(interaction, true);
      const [, kind] = interaction.customId.split(':');
      await safeEdit(interaction, buildMeHint(kind));
      return;
    }

    if (interaction.isButton() && interaction.customId === 'menu:back') {
      await safeDefer(interaction, true);
      await safeEdit(interaction, buildMainMenuPayload());
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('menu:quick:')) {
      await safeDefer(interaction, true);
      const [, , kind] = interaction.customId.split(':');
      if (kind === 'health') {
        await safeEdit(interaction, { content: '🩺 Диагностика доступна через `/dbstatus` и веб-панель `/health`.', embeds: [], components: [] });
        return;
      }
      if (kind === 'docs') {
        await safeEdit(interaction, { content: '📚 Документация доступна в веб-панели: `/docs`. Также смотри README-файлы проекта.', embeds: [], components: [] });
        return;
      }
      await safeEdit(interaction, buildQuickPayload(kind));
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('clear:')) {
      await safeDefer(interaction, true);
      const [, action, channelId, amountRaw] = interaction.customId.split(':');
      if (action === 'cancel') {
        await safeEdit(interaction, { content: '✅ Очистка отменена.', embeds: [], components: [] });
        return;
      }
      if (!interaction.memberPermissions?.has('ManageMessages') && !interaction.memberPermissions?.has('Administrator')) {
        await safeEdit(interaction, errorPayload('Нет доступа', 'Для очистки сообщений нужно право `Manage Messages`.'));
        return;
      }
      if (channelId !== interaction.channelId) {
        await safeEdit(interaction, errorPayload('Не тот канал', 'Подтверждение работает только в канале, где была вызвана команда.'));
        return;
      }
      const clearCommand = interaction.client.commands.get('clear');
      await clearCommand.performClear(interaction, Number(amountRaw || 1));
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('application:')) {
      await safeDefer(interaction, true);
      const [, action, id] = interaction.customId.split(':');
      const status = action === 'accept' ? 'accepted' : 'denied';
      const result = updateApplicationStatus(Number(id), status, interaction.user.id, interaction.user.username);
      if (result.ok) await notifyApplicant(interaction.client, result.application, status, 'Решение принято через панель администрации.');
      await safeEdit(interaction, { content: result.ok ? `✅ Заявка #${id}: ${status}` : '❌ Заявка не найдена.', embeds: [], components: [] });
      return;
    }



    if (interaction.isButton() && interaction.customId.startsWith('suggestion:vote:')) {
      await safeDefer(interaction, true);
      const [, , id, vote] = interaction.customId.split(':');
      const result = await voteSuggestion(interaction, Number(id), vote);
      let text = '✅ Голос учтен.';
      if (!result.ok && result.reason === 'not_found') text = '❌ Предложение не найдено.';
      if (!result.ok && result.reason === 'closed') text = '⚠️ Голосование по этому предложению уже закрыто.';
      if (!result.ok && result.reason === 'own') text = '⚠️ Нельзя голосовать за свое предложение.';
      await safeEdit(interaction, { content: text, embeds: [], components: [] });
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('suggestion:status:')) {
      await safeDefer(interaction, true);
      const [, , id, status] = interaction.customId.split(':');
      const result = await setSuggestionStatus(interaction, Number(id), status, 'Решение принято через панель предложения.');
      let text = result.ok ? `✅ Статус предложения #${id} обновлен.` : '❌ Не удалось изменить статус предложения.';
      if (!result.ok && result.reason === 'no_permission') text = '❌ Нет прав для изменения статуса предложения.';
      if (!result.ok && result.reason === 'not_found') text = '❌ Предложение не найдено.';
      await safeEdit(interaction, { content: text, embeds: [], components: [] });
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('poll:vote:')) {
      await safeDefer(interaction, true);
      const [, , id, optionIndex] = interaction.customId.split(':');
      const result = await votePoll(interaction, Number(id), Number(optionIndex));
      let text = result.ok ? `✅ Твой голос учтен: **${result.poll.options[Number(optionIndex)]}**.` : '❌ Не удалось проголосовать.';
      if (!result.ok && result.reason === 'closed') text = '⚠️ Этот опрос уже закрыт.';
      if (!result.ok && result.reason === 'not_found') text = '❌ Опрос не найден.';
      await safeEdit(interaction, { content: text, embeds: [], components: [] });
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('poll:close:')) {
      await safeDefer(interaction, true);
      const [, , id] = interaction.customId.split(':');
      const result = await closePoll(interaction, Number(id));
      let text = result.ok ? `🔒 Опрос #${id} закрыт.` : '❌ Не удалось закрыть опрос.';
      if (!result.ok && result.reason === 'no_permission') text = '❌ Нет прав для закрытия опроса.';
      if (!result.ok && result.reason === 'not_found') text = '❌ Опрос не найден.';
      await safeEdit(interaction, { content: text, embeds: [], components: [] });
      return;
    }



    if (interaction.isButton() && interaction.customId.startsWith('lfg:')) {
      await safeDefer(interaction, true);
      const [, action, id] = interaction.customId.split(':');
      let result;
      if (action === 'join') result = await joinLfg(interaction, Number(id));
      if (action === 'leave') result = await leaveLfg(interaction, Number(id));
      if (action === 'close') result = await closeLfg(interaction, Number(id), 'Закрыто через кнопку');

      let text = '❌ Не удалось выполнить действие.';
      if (result?.ok && action === 'join') text = `✅ Ты присоединился к LFG #${id}.`;
      if (result?.ok && action === 'leave') text = `✅ Ты вышел из LFG #${id}.`;
      if (result?.ok && action === 'close') text = `🔒 LFG #${id} закрыт.`;
      if (!result?.ok && result?.reason === 'not_found') text = '❌ LFG не найден.';
      if (!result?.ok && result?.reason === 'closed') text = '⚠️ Этот LFG уже закрыт.';
      if (!result?.ok && result?.reason === 'already_joined') text = '⚠️ Ты уже участвуешь.';
      if (!result?.ok && result?.reason === 'not_joined') text = '⚠️ Ты не участвуешь в этом LFG.';
      if (!result?.ok && result?.reason === 'full') text = '⚠️ Мест больше нет.';
      if (!result?.ok && result?.reason === 'owner') text = '⚠️ Создатель не может выйти. Закрой LFG кнопкой или командой.';
      if (!result?.ok && result?.reason === 'no_permission') text = '❌ Закрыть LFG может его создатель или модератор.';

      await safeEdit(interaction, {
        content: text,
        embeds: result?.lfg ? [buildLfgEmbed(result.lfg)] : [],
        components: result?.lfg ? buildLfgButtons(result.lfg) : []
      });
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('voice:')) {
      const [, action] = interaction.customId.split(':');
      if (action === 'rename_modal') {
        await interaction.showModal(buildRenameModal());
        return;
      }
      if (action === 'limit_modal') {
        await interaction.showModal(buildLimitModal());
        return;
      }

      await safeDefer(interaction, true);
      if (action === 'delete') {
        await safeEdit(interaction, {
          content: '⚠️ Ты действительно хочешь удалить текущую временную voice-комнату?',
          embeds: [],
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('voice:delete_confirm').setLabel('Удалить').setEmoji('🗑').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('voice:info').setLabel('Отмена').setEmoji('↩️').setStyle(ButtonStyle.Secondary)
          )]
        });
        return;
      }
      const result = await handleVoiceButton(interaction);
      const messages = {
        lock: 'Комната закрыта для новых участников.',
        unlock: 'Комната снова открыта.',
        claim: 'Теперь ты владелец этой комнаты.',
        delete: 'Комната удалена.',
        info: 'Информация по комнате обновлена.',
      };
      await safeEdit(interaction, buildVoiceActionPayload(result, messages[action] || 'Действие выполнено.'));
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('modpanel:')) {
      await safeDefer(interaction, true);
      const result = await handleModerationPanelButton(interaction);
      await safeEdit(interaction, { content: result.content, embeds: [], components: [] });
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('gamepanel:')) {
      await safeDefer(interaction, true);
      const result = await handleGamePanelButton(interaction);
      if (!result.ok) {
        await safeEdit(interaction, { content: '❌ Не удалось запустить мини-игру.', embeds: [], components: [] });
        return;
      }
      await safeEdit(interaction, { embeds: [result.embed], components: [] });
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('event:')) {
      await safeDefer(interaction, true);
      const [scope, action, id] = interaction.customId.split(':');
      const result = action === 'join'
        ? await joinEvent(interaction, Number(id))
        : await leaveEvent(interaction, Number(id));

      let text = '❌ Не удалось выполнить действие.';
      if (result.ok && action === 'join') {
        text = `✅ Ты записался на ивент **#${result.event.id} — ${result.event.title}**.`;
        if (result.unlockedAchievements?.length) {
          text += `\n\n🏅 **Новые достижения:**\n${buildUnlockedText(result.unlockedAchievements)}`;
        }
      }
      if (result.ok && action === 'leave') text = `✅ Ты вышел из ивента **#${result.event.id} — ${result.event.title}**.`;
      if (!result.ok && result.reason === 'not_found') text = '❌ Ивент не найден или уже закрыт.';
      if (!result.ok && result.reason === 'already_joined') text = '⚠️ Ты уже записан на этот ивент.';
      if (!result.ok && result.reason === 'not_joined') text = '⚠️ Ты не записан на этот ивент.';
      if (!result.ok && result.reason === 'full') text = '⚠️ На этом ивенте уже нет свободных мест.';

      await safeEdit(interaction, { content: text, embeds: [], components: [] });
      return;
    }

    if (interaction.isButton() && interaction.customId === 'ticket:close') {
      await safeDefer(interaction, true);
      const result = await closeTicket(interaction);

      if (!result.ok) {
        const text = result.reason === 'no_permission'
          ? 'Закрыть тикет может его автор, администратор или модератор.'
          : 'Этот канал не является открытым тикетом.';
        await safeEdit(interaction, { content: `❌ ${text}`, embeds: [], components: [] });
        return;
      }

      await safeEdit(interaction, { content: '🔒 Тикет закрыт. Канал будет удален через 5 секунд.', embeds: [], components: [] });

      setTimeout(async () => {
        try {
          await interaction.channel.delete(`Ticket closed by ${interaction.user.tag}`);
        } catch (error) {
          console.error('Could not delete ticket channel:', error);
        }
      }, 5000);
    }
  } catch (error) {
    if (isDiscordNetworkTimeout(error)) {
      logSoftDiscordNetworkError('interaction handler', error);
      return;
    }

    console.error(error);

    if (error.code === 10062 || error.code === 40060) {
      console.warn('Interaction expired or was already acknowledged. No error response was sent.');
      return;
    }

    const payload = errorPayload('Ошибка выполнения', 'Произошла ошибка при выполнении действия. Попробуй еще раз или сообщи администрации.');

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(payload);
      } else {
        await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
      }
    } catch (replyError) {
      if (isDiscordNetworkTimeout(replyError)) {
        logSoftDiscordNetworkError('error response', replyError);
        return;
      }
      if (replyError.code === 10062 || replyError.code === 40060) {
        console.warn('Could not send error response because interaction expired.');
        return;
      }
      console.error(replyError);
    }
  }
});


async function loginWithRetry(attempt = 1) {
  const maxAttempts = Number(process.env.DISCORD_LOGIN_MAX_RETRIES || 5);
  const delayMs = Math.min(10000 * attempt, 60000);

  if (!process.env.DISCORD_TOKEN) {
    console.error('DISCORD_TOKEN не найден. Проверь файл .env.');
    process.exitCode = 1;
    return;
  }

  try {
    console.log(`Discord login attempt ${attempt}/${maxAttempts}...`);
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    const isTimeout = error?.code === 'UND_ERR_CONNECT_TIMEOUT' || String(error?.message || '').includes('Connect Timeout');
    const isTokenError = error?.code === 'TokenInvalid' || String(error?.message || '').includes('invalid token');

    console.error('Discord login error:', error);

    if (isTokenError) {
      console.error('Токен Discord недействителен. Проверь DISCORD_TOKEN в .env.');
      process.exitCode = 1;
      return;
    }

    if (attempt >= maxAttempts) {
      console.error('Не удалось подключиться к Discord после нескольких попыток.');
      console.error('Проверь VPN/Firewall/доступ Node.js к https://discord.com/api/v10/gateway.');
      process.exitCode = 1;
      return;
    }

    if (isTimeout) {
      console.warn(`Discord API не ответил вовремя. Повтор через ${Math.round(delayMs / 1000)} сек...`);
    } else {
      console.warn(`Повтор подключения через ${Math.round(delayMs / 1000)} сек...`);
    }

    setTimeout(() => loginWithRetry(attempt + 1), delayMs);
  }
}

loginWithRetry();
