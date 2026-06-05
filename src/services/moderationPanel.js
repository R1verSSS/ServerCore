const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { readDatabase } = require('./dataStore');

const MOD_PANEL_CHANNEL_NAME = '🧰・панель-модерации';
const MOD_CATEGORY_NAME = '🛡 МОДЕРАЦИЯ';

function buildModerationPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle('🧰 Панель модерации')
    .setDescription([
      'Быстрая панель для модераторов и администраторов.',
      '',
      '**Основные команды:**',
      '`/warn` — выдать предупреждение',
      '`/warnings` — посмотреть предупреждения',
      '`/clear` — удалить сообщения',
      '`/mute` — временно ограничить участника',
      '`/unmute` — снять ограничение',
      '`/kick` — исключить участника',
      '`/ban` — забанить участника',
      '',
      'Кнопки ниже показывают подсказки и быстрые сводки по модерации.'
    ].join('\n'))
    .setFooter({ text: 'ServerCore • Moderation Panel' });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('modpanel:commands').setLabel('Команды').setEmoji('📋').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('modpanel:warnings').setLabel('Предупреждения').setEmoji('⚠️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('modpanel:tickets').setLabel('Тикеты').setEmoji('🎫').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('modpanel:events').setLabel('Ивенты').setEmoji('📅').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('modpanel:help_clear').setLabel('Очистка чата').setEmoji('🧹').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('modpanel:help_mute').setLabel('Мут').setEmoji('🔇').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('modpanel:help_ban').setLabel('Кик/бан').setEmoji('🔨').setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row1, row2] };
}

function getPrivateOverwrites(guild) {
  const moderatorRole = guild.roles.cache.find(role => role.name === '👮 Moderator');
  const adminRole = guild.roles.cache.find(role => role.name === '🛡 Admin');
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
  ];

  if (moderatorRole) {
    overwrites.push({
      id: moderatorRole.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    });
  }

  if (adminRole) {
    overwrites.push({
      id: adminRole.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    });
  }

  return overwrites;
}

async function getOrCreateModerationPanelChannel(guild) {
  await guild.channels.fetch().catch(() => null);
  await guild.roles.fetch().catch(() => null);

  let channel = guild.channels.cache.find(item => item.name === MOD_PANEL_CHANNEL_NAME && item.type === ChannelType.GuildText);
  if (channel) return channel;

  let category = guild.channels.cache.find(item => item.name === MOD_CATEGORY_NAME && item.type === ChannelType.GuildCategory);
  if (!category) {
    category = await guild.channels.create({
      name: MOD_CATEGORY_NAME,
      type: ChannelType.GuildCategory,
      permissionOverwrites: getPrivateOverwrites(guild),
      reason: 'ServerCore moderation panel setup'
    });
  }

  channel = await guild.channels.create({
    name: MOD_PANEL_CHANNEL_NAME,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: 'Панель управления модерацией.',
    permissionOverwrites: getPrivateOverwrites(guild),
    reason: 'ServerCore moderation panel setup'
  });

  return channel;
}

async function sendModerationPanel(guild) {
  const channel = await getOrCreateModerationPanelChannel(guild);
  await channel.send(buildModerationPanel());
  return { ok: true, channel };
}

function latestWarnings(limit = 5) {
  const db = readDatabase();
  return (db.warnings || [])
    .filter(warning => warning.active !== false)
    .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
    .slice(0, limit);
}

function openTickets(limit = 10) {
  const db = readDatabase();
  return Object.values(db.tickets || {})
    .filter(ticket => ticket.status === 'open')
    .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
    .slice(0, limit);
}

function openEvents(limit = 10) {
  const db = readDatabase();
  return Object.values(db.events || {})
    .filter(event => event.status === 'open')
    .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
    .slice(0, limit);
}

function buildModerationResponse(action) {
  if (action === 'commands') {
    return [
      '📋 **Команды модерации**',
      '`/warn user reason` — выдать предупреждение',
      '`/warnings user` — посмотреть предупреждения',
      '`/clear amount` — удалить сообщения в текущем канале',
      '`/mute user duration reason` — временный мут, например `10m`, `2h`, `1d`',
      '`/unmute user reason` — снять мут',
      '`/kick user reason` — исключить участника',
      '`/ban user reason` — забанить участника'
    ].join('\n');
  }

  if (action === 'warnings') {
    const items = latestWarnings();
    if (!items.length) return '⚠️ Активных предупреждений пока нет.';
    return `⚠️ **Последние предупреждения:**\n${items.map(item => `#${item.id} — ${item.username || item.userId}: ${item.reason || 'Без причины'}`).join('\n')}`;
  }

  if (action === 'tickets') {
    const items = openTickets();
    if (!items.length) return '🎫 Открытых тикетов сейчас нет.';
    return `🎫 **Открытые тикеты:**\n${items.map(item => `#${item.id} — ${item.username || item.userId}: ${item.reason || 'Без причины'}`).join('\n')}`;
  }

  if (action === 'events') {
    const items = openEvents();
    if (!items.length) return '📅 Активных ивентов сейчас нет.';
    return `📅 **Активные ивенты:**\n${items.map(item => `#${item.id} — ${item.title}: ${item.date || 'Дата не указана'}`).join('\n')}`;
  }

  if (action === 'help_clear') {
    return '🧹 **Очистка чата**\nИспользуй `/clear amount:10` в нужном канале. Discord не позволяет bulk delete для сообщений старше 14 дней.';
  }

  if (action === 'help_mute') {
    return '🔇 **Мут участника**\nИспользуй `/mute user:@участник duration:10m reason:Причина`. Доступные форматы: `10m`, `2h`, `1d`, `28d`.';
  }

  if (action === 'help_ban') {
    return '🔨 **Кик/бан**\nИспользуй `/kick user:@участник reason:Причина` или `/ban user:@участник reason:Причина`. Роль бота должна быть выше роли участника.';
  }

  return 'Панель модерации активна.';
}

async function handleModerationPanelButton(interaction) {
  const action = interaction.customId.split(':')[1];
  const content = buildModerationResponse(action);
  return { ok: true, content };
}

module.exports = {
  MOD_PANEL_CHANNEL_NAME,
  buildModerationPanel,
  getOrCreateModerationPanelChannel,
  sendModerationPanel,
  handleModerationPanelButton,
};
