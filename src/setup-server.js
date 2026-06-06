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
  let category = guild.channels.cache.find(
    channel => channel.name === categoryConfig.name && channel.type === 4
  );

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
  const existing = guild.channels.cache.find(
    channel => channel.name === channelConfig.name && channel.parentId === parent.id
  );
  if (existing) return existing;

  return guild.channels.create({
    name: channelConfig.name,
    type: channelConfig.type,
    parent: parent.id,
    topic: channelConfig.topic,
    reason: 'Server template setup'
  });
}

async function sendOnce(channel, payload, markerTitle) {
  if (!channel || !channel.isTextBased()) return;
  const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
  if (messages && messages.some(message => message.author.id === client.user.id && message.embeds.some(embed => embed.title === markerTitle))) {
    return;
  }
  await channel.send(payload);
}

async function sendStarterMessages(guild) {
  const rules = guild.channels.cache.find(ch => ch.name === '📜・правила');
  const navigation = guild.channels.cache.find(ch => ch.name === '🧭・навигация');
  const rolesChannel = guild.channels.cache.find(ch => ch.name === '✅・получить-роли');
  const commandsChannel = guild.channels.cache.find(ch => ch.name === '📚・команды');
  const shopChannel = guild.channels.cache.find(ch => ch.name === '🛍・витрина');
  const botChannel = guild.channels.cache.find(ch => ch.name === '🤖・команды-бота');
  const miniGames = guild.channels.cache.find(ch => ch.name === '🎲・мини-игры');
  const musicText = guild.channels.cache.find(ch => ch.name === '🎵・музыка' && ch.type === ChannelType.GuildText);
  const voiceHelp = guild.channels.cache.find(ch => ch.name === '🔊・общий войс') || guild.channels.cache.find(ch => ch.name === '🎧・чилл');
  const modPanel = guild.channels.cache.find(ch => ch.name === '🧰・панель-модерации');
  const modCommands = guild.channels.cache.find(ch => ch.name === '📘・команды-модерации');

  const rulesEmbed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('📜 Правила сервера')
    .setDescription('1. Уважай других участников.\n2. Не спамь и не флуди.\n3. Не оскорбляй участников.\n4. Используй каналы по назначению.\n5. Запрещен опасный, незаконный и NSFW-контент.\n\n**Нарушения:** предупреждение → мут → бан.');

  const navigationEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🧭 Навигация')
    .setDescription('📌 **ВАЖНОЕ** — правила, объявления и получение ролей.\n💬 **ОБЩЕНИЕ** — общий чат, мемы, фото и музыка.\n🎮 **ИГРЫ И АКТИВНОСТИ** — поиск команды, турниры и ивенты.\n💻 **ПРОЕКТЫ И IT** — программирование, помощь с кодом и проекты.\n🔊 **ГОЛОСОВЫЕ** — комнаты для общения и игр.\n\n**Быстрый старт:** `/menu open` → `/roles` → `/daily` → `/profile`.');

  const botEmbed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('🤖 Команды бота')
    .setDescription('Основные команды:\n`/menu open` — удобное меню пользователя\n`/help` — полный список команд\n`/roles` — панель выбора ролей\n`/gamepanel` — панель мини-игр\n`/voice panel` — панель voice-комнат\n`/ticket` — обращение в поддержку.');

  await sendOnce(rules, { embeds: [rulesEmbed] }, '📜 Правила сервера');
  await sendOnce(navigation, { embeds: [navigationEmbed] }, '🧭 Навигация');
  await sendOnce(navigation, buildMainMenuPayload(), '🧭 Меню сервера');
  await sendOnce(rolesChannel, buildRolePanel(), '✅ Выбор ролей');
  await sendOnce(commandsChannel, buildPublicCommandsPanel(), '📚 Команды сервера');
  await sendOnce(shopChannel, buildShopPanel(), '🛒 Магазин сервера');
  await sendOnce(botChannel, { embeds: [botEmbed] }, '🤖 Команды бота');
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

    for (const categoryConfig of categories) {
      const category = await createCategoryIfMissing(guild, categoryConfig, moderatorRole, adminRole, helperRole);
      console.log(`Category ready: ${category.name}`);

      for (const channelConfig of categoryConfig.channels) {
        const channel = await createChannelIfMissing(guild, channelConfig, category);
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
