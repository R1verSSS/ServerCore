const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const {
  createEvent,
  joinEvent,
  leaveEvent,
  cancelEvent,
  getOpenEvents,
  getEventListEmbed,
  buildEventEmbed,
  buildEventButtons,
} = require('../services/eventService');
const { buildUnlockedText } = require('../services/achievementService');

function eventResultText(result, action) {
  if (result.ok) {
    if (action === 'join') {
      let text = `✅ Ты записался на ивент **#${result.event.id} — ${result.event.title}**.`;
      if (result.unlockedAchievements?.length) {
        text += `\n\n🏅 **Новые достижения:**\n${buildUnlockedText(result.unlockedAchievements)}`;
      }
      return text;
    }

    return `✅ Ты вышел из ивента **#${result.event.id} — ${result.event.title}**.`;
  }

  if (result.reason === 'not_found') return '❌ Ивент не найден или уже закрыт.';
  if (result.reason === 'already_joined') return '⚠️ Ты уже записан на этот ивент.';
  if (result.reason === 'not_joined') return '⚠️ Ты не записан на этот ивент.';
  if (result.reason === 'full') return '⚠️ На этом ивенте уже нет свободных мест.';
  if (result.reason === 'no_permission') return '❌ Закрыть ивент может создатель, администратор или модератор.';

  return '❌ Не удалось выполнить действие.';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Управление ивентами сервера')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Создать новый ивент')
        .addStringOption(option =>
          option
            .setName('title')
            .setDescription('Название ивента')
            .setRequired(true)
            .setMaxLength(80)
        )
        .addStringOption(option =>
          option
            .setName('date')
            .setDescription('Дата: 10.06.2026 20:00 или 2026-06-10 20:00')
            .setRequired(true)
            .setMaxLength(40)
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('Описание ивента')
            .setRequired(false)
            .setMaxLength(500)
        )
        .addIntegerOption(option =>
          option
            .setName('max')
            .setDescription('Максимум участников, 0 — без лимита')
            .setRequired(false)
            .setMinValue(0)
            .setMaxValue(100)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Показать активные ивенты')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('Показать подробности ивента')
        .addIntegerOption(option =>
          option
            .setName('id')
            .setDescription('ID ивента')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('join')
        .setDescription('Записаться на ивент')
        .addIntegerOption(option =>
          option
            .setName('id')
            .setDescription('ID ивента')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('leave')
        .setDescription('Выйти из ивента')
        .addIntegerOption(option =>
          option
            .setName('id')
            .setDescription('ID ивента')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('cancel')
        .setDescription('Закрыть ивент')
        .addIntegerOption(option =>
          option
            .setName('id')
            .setDescription('ID ивента')
            .setRequired(true)
            .setMinValue(1)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const ephemeral = subcommand !== 'list';
    await safeDefer(interaction, ephemeral ? { flags: MessageFlags.Ephemeral } : false);

    if (subcommand === 'create') {
      const result = await createEvent(interaction, {
        title: interaction.options.getString('title'),
        dateInput: interaction.options.getString('date'),
        description: interaction.options.getString('description'),
        maxMembers: interaction.options.getInteger('max') || 0,
      });

      if (!result.ok && result.reason === 'invalid_date') {
        await safeEdit(interaction, {
          content: '❌ Не удалось распознать дату. Используй формат `10.06.2026 20:00` или `2026-06-10 20:00`.',
          embeds: [],
          components: [],
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Ивент создан')
        .setDescription(`Ивент **#${result.event.id} — ${result.event.title}** создан.`)
        .addFields(
          { name: 'Канал', value: result.eventsChannel ? `${result.eventsChannel}` : 'Канал `📅・ивенты` не найден, сообщение не опубликовано.', inline: false },
          { name: 'Команды', value: `\`/event join id:${result.event.id}\`\n\`/event info id:${result.event.id}\``, inline: false }
        );

      await safeEdit(interaction, { embeds: [embed], components: [] });
      return;
    }

    if (subcommand === 'list') {
      const events = getOpenEvents();
      await safeEdit(interaction, { embeds: [getEventListEmbed(events, interaction.guild)], components: [] });
      return;
    }

    if (subcommand === 'info') {
      const id = interaction.options.getInteger('id');
      const event = getOpenEvents().find(item => item.id === id);
      if (!event) {
        await safeEdit(interaction, { content: '❌ Ивент не найден или уже закрыт.', embeds: [], components: [] });
        return;
      }
      await safeEdit(interaction, { embeds: [buildEventEmbed(event, interaction.guild)], components: buildEventButtons(event) });
      return;
    }

    if (subcommand === 'join') {
      const result = await joinEvent(interaction, interaction.options.getInteger('id'));
      await safeEdit(interaction, { content: eventResultText(result, 'join'), embeds: [], components: [] });
      return;
    }

    if (subcommand === 'leave') {
      const result = await leaveEvent(interaction, interaction.options.getInteger('id'));
      await safeEdit(interaction, { content: eventResultText(result, 'leave'), embeds: [], components: [] });
      return;
    }

    if (subcommand === 'cancel') {
      const result = await cancelEvent(interaction, interaction.options.getInteger('id'));
      if (result.ok) {
        await safeEdit(interaction, { content: `🔒 Ивент **#${result.event.id} — ${result.event.title}** закрыт.`, embeds: [], components: [] });
      } else {
        await safeEdit(interaction, { content: eventResultText(result, 'cancel'), embeds: [], components: [] });
      }
    }
  },
};
