require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { roles, categories } = require('./config/template');
const { buildRolePanel } = require('./services/rolePanel');
const { buildMainMenuPayload } = require('./services/userMenuService');
const { buildGamePanel } = require('./services/gamePanel');
const { buildVoicePanel } = require('./services/tempVoiceService');
const { buildModerationPanel } = require('./services/moderationPanel');
const { buildShopPanel } = require('./services/shopPanel');
const { buildMusicPanel, isMusicEnabled } = require('./services/musicService');
const { buildPublicCommandsPanel, buildModerationCommandsPanel } = require('./services/commandReferenceService');
const { buildWebPanelMenuPayload } = require('./services/webPanelMenuService');
const { buildThreadPanel } = require('./services/threadForumService');
const { buildBotQuickMenuPanel } = require('./services/botQuickMenuService');
const { buildTicketTypeSelectPayload } = require('./services/ticketService');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  rest: { timeout: 30000 }
});

async function createRoleIfMissing(guild, roleConfig) {
  const existing = guild.roles.cache.find(role => role.name === roleConfig.name);
  if (existing) return existing;

  return guild.roles.create({
    name: roleConfig.name,
    colors: { primaryColor: roleConfig.color },
    permissions: roleConfig.permissions,
    reason: 'Server template setup'
  });
}

async function createCategoryIfMissing(guild, categoryConfig, moderatorRole, adminRole, helperRole) {
  const acceptedNames = [categoryConfig.name, ...(categoryConfig.aliases || [])];
  let category = guild.channels.cache.find(
    channel => acceptedNames.includes(channel.name) && channel.type === ChannelType.GuildCategory
  );

  if (category && category.name !== categoryConfig.name) {
    await category.setName(categoryConfig.name, 'ServerCore v24.2 category migration').catch(() => null);
  }

  if (!category) {
    const options = {
      name: categoryConfig.name,
      type: 4,
      reason: 'Server template setup'
    };

    if (categoryConfig.private && moderatorRole) {
      options.permissionOverwrites = [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: moderatorRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
      ];

      if (helperRole) {
        options.permissionOverwrites.push({
          id: helperRole.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        });
      }

      if (adminRole) {
        options.permissionOverwrites.push({
          id: adminRole.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        });
      }
    }

    category = await guild.channels.create(options);
  }

  return category;
}

async function createChannelIfMissing(guild, channelConfig, parent) {
  const acceptedNames = [channelConfig.name, ...(channelConfig.aliases || [])];
  let existing = guild.channels.cache.find(channel =>
    acceptedNames.includes(channel.name) && channel.type === channelConfig.type
  );

  // Text -> Forum cannot be converted directly. Archive the old channel and create the forum.
  if (!existing) {
    const wrongType = guild.channels.cache.find(channel => acceptedNames.includes(channel.name));
    if (wrongType) {
      const archiveName = `${wrongType.name}-архив`.slice(0, 95);
      await wrongType.setName(archiveName, 'ServerCore: replacing channel with another type').catch(() => null);
    }
  }

  if (existing) {
    if (existing.name !== channelConfig.name) {
      await existing.setName(channelConfig.name, 'ServerCore v24.2 channel rename').catch(() => null);
    }
    if (existing.parentId !== parent.id) {
      await existing.setParent(parent.id, { lockPermissions: false, reason: 'ServerCore v24.2 navigation cleanup' }).catch(() => null);
    }
    if (channelConfig.topic && 'setTopic' in existing && existing.topic !== channelConfig.topic) {
      await existing.setTopic(channelConfig.topic, 'ServerCore v24.2 topic refresh').catch(() => null);
    }
    return existing;
  }

  const options = {
    name: channelConfig.name,
    type: channelConfig.type,
    parent: parent.id,
    topic: channelConfig.topic,
    reason: 'Server template setup'
  };

  if (channelConfig.type === ChannelType.GuildForum) {
    options.availableTags = (channelConfig.tags || []).slice(0, 20).map(name => ({ name, moderated: false }));
    if (channelConfig.defaultReactionEmoji) options.defaultReactionEmoji = channelConfig.defaultReactionEmoji;
  }

  return guild.channels.create(options);
}

async function sendOnce(channel, payload, markerTitle, options = {}) {
  if (!channel || !channel.isTextBased()) return;
  const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
  const existing = messages?.find(message => message.author.id === client.user.id && message.embeds.some(embed => embed.title === markerTitle));
  if (existing) {
    if (options.pin && !existing.pinned) await existing.pin().catch(() => null);
    return;
  }
  const sent = await channel.send(payload);
  if (options.pin) await sent.pin().catch(() => null);
}

async function sendStarterMessages(guild) {
  const rules = guild.channels.cache.find(ch => ch.name === '📜・правила');
  const navigation = guild.channels.cache.find(ch => ch.name === '🧭・навигация');
  const rolesChannel = guild.channels.cache.find(ch => ch.name === '✅・получить-роли');
  const commandsChannel = guild.channels.cache.find(ch => ch.name === '📚・частые-вопросы');
  const threadHub = guild.channels.cache.find(ch => ch.name === '🧭・навигация') || guild.channels.cache.find(ch => ch.name === '🤖・команды-бота');
  const shopChannel = guild.channels.cache.find(ch => ch.name === '🛍・витрина');
  const botChannel = guild.channels.cache.find(ch => ch.name === '🤖・команды-бота');
  const miniGames = guild.channels.cache.find(ch => ch.name === '🎲・мини-игры');
  const musicText = guild.channels.cache.find(ch => ch.name === '🎵・музыка-бот' && ch.type === ChannelType.GuildText);
  const ticketCreate = guild.channels.cache.find(ch => ch.name === '🎫・создать-тикет');
  const voiceHelp = guild.channels.cache.find(ch => ch.name === '🔊・общий войс') || guild.channels.cache.find(ch => ch.name === '🎧・чилл');
  const modPanel = guild.channels.cache.find(ch => ch.name === '🧰・панель-модерации');
  const modCommands = guild.channels.cache.find(ch => ch.name === '🤖・команды-модерации');

  const rulesEmbed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('📜 Правила сервера')
    .setDescription('1. Уважай других участников.\n2. Не спамь и не флуди.\n3. Не оскорбляй участников.\n4. Используй каналы по назначению.\n5. Запрещен опасный, незаконный и NSFW-контент.\n\n**Нарушения:** предупреждение → мут → бан.');

  const navigationEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🧭 Навигация')
    .setDescription('📌 **ВАЖНОЕ** — правила, объявления, роли и новости.\n💬 **ОБЩЕНИЕ** — общий чат, темы, фото, мемы и предложения.\n🤖 **БОТ И АКТИВНОСТИ** — команды, музыка, мини-игры, турниры и ивенты.\n🎮 **ИГРЫ** — поиск напарников и кланы.\n💻 **ПРОЕКТЫ И IT** — программирование, помощь с кодом и проекты.\n🎫 **ПОДДЕРЖКА** — вопросы, тикеты и частые вопросы.\n🔊 **ГОЛОСОВЫЕ** — комнаты для общения и игр.\n\n**Быстрый старт:** `/menu open` → `/roles` → `/daily` → `/profile`.');

  const botEmbed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('🤖 Команды бота')
    .setDescription('Основные команды:\n`/menu open` — удобное меню пользователя\n`/help` — полный список команд\n`/roles` — панель выбора ролей\n`/gamepanel` — панель мини-игр\n`/voice panel` — панель voice-комнат\n`/ticket` — обращение в поддержку.');

  await sendOnce(rules, { embeds: [rulesEmbed] }, '📜 Правила сервера');
  await sendOnce(navigation, { embeds: [navigationEmbed] }, '🧭 Навигация');
  await sendOnce(navigation, buildMainMenuPayload(), '🧭 Меню сервера');
  await sendOnce(navigation, buildWebPanelMenuPayload(), '🌐 Веб-панель ServerCore', { pin: true });
  await sendOnce(rolesChannel, buildRolePanel(), '✅ Выбор ролей');
  await sendOnce(commandsChannel, buildPublicCommandsPanel(), '📚 Команды сервера');
  await sendOnce(ticketCreate, buildTicketTypeSelectPayload(), '🎫 Создание тикета', { pin: true });
  await sendOnce(threadHub, buildThreadPanel(), '🧵 Темы и ветки сервера', { pin: true });
  await sendOnce(shopChannel, buildShopPanel(), '🛒 Магазин сервера');
  await sendOnce(botChannel, buildBotQuickMenuPanel(), '🤖 Быстрое меню бота', { pin: true });
  await sendOnce(botChannel, buildWebPanelMenuPayload(), '🌐 Веб-панель ServerCore');
  await sendOnce(miniGames, buildGamePanel(), '🎲 Панель мини-игр');
  if (isMusicEnabled()) {
    await sendOnce(musicText, buildMusicPanel(), '🎵 Музыкальная панель');
  }
  await sendOnce(voiceHelp, buildVoicePanel(), '🔊 Управление личной voice-комнатой');
  await sendOnce(modPanel, buildModerationPanel(), '🧰 Панель модерации');
  await sendOnce(modCommands, buildModerationCommandsPanel(), '📘 Команды модерации');
}

client.once('clientReady', async () => {
  try {
    const guildId = process.env.GUILD_ID;
    if (!guildId) throw new Error('GUILD_ID is missing in .env');

    const guild = await client.guilds.fetch(guildId);
    await guild.roles.fetch();
    await guild.channels.fetch();

    console.log(`Setup started for: ${guild.name}`);

    const createdRoles = new Map();
    for (const roleConfig of roles) {
      const role = await createRoleIfMissing(guild, roleConfig);
      createdRoles.set(roleConfig.name, role);
      console.log(`Role ready: ${role.name}`);
    }

    const moderatorRole = createdRoles.get('👮 Moderator');
    const adminRole = createdRoles.get('🛡 Admin');
    const helperRole = createdRoles.get('🧰 Helper');

    for (const [categoryIndex, categoryConfig] of categories.entries()) {
      const category = await createCategoryIfMissing(guild, categoryConfig, moderatorRole, adminRole, helperRole);
      await category.setPosition(categoryIndex, { reason: 'ServerCore v24.2 category ordering' }).catch(() => null);
      console.log(`Category ready: ${category.name}`);

      for (const [channelIndex, channelConfig] of categoryConfig.channels.entries()) {
        const channel = await createChannelIfMissing(guild, channelConfig, category);
        await channel.setPosition(channelIndex, { reason: 'ServerCore v24.2 channel ordering' }).catch(() => null);
        console.log(`Channel ready: ${channel.name}`);
      }
    }

    await guild.roles.fetch();
    await guild.channels.fetch();
    await sendStarterMessages(guild);
    console.log('Server template setup completed.');
  } catch (error) {
    console.error('Setup failed:', error);
  } finally {
    client.destroy();
  }
});

client.login(process.env.DISCORD_TOKEN);
