const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const { readDatabase, writeDatabase } = require('./dataStore');
const { awardAchievement } = require('./achievementService');
const { getSettings } = require('./settingsService');

const ADMIN_ROLE_NAMES = ['👑 Owner', '🛡 Admin', '👮 Moderator'];
const LOG_CHANNEL_NAME = '📋・лог-модерации';
const MOD_CATEGORY_NAME = '🛡 МОДЕРАЦИЯ';
const DEFAULT_ACTIVE_TICKET_CATEGORY_NAME = '🎫 АКТИВНЫЕ ТИКЕТЫ';
const DEFAULT_TICKET_ARCHIVE_CHANNEL_NAME = '📁・тикеты';

const TICKET_TEMPLATES = {
  support: { label: 'Поддержка', emoji: '🆘', hint: 'Опиши вопрос или проблему, с которой нужна помощь.' },
  bug: { label: 'Баг / ошибка', emoji: '🐞', hint: 'Что сломалось, где это видно, как повторить?' },
  report: { label: 'Жалоба', emoji: '⚠️', hint: 'На кого жалоба, что произошло, есть ли доказательства?' },
  shop: { label: 'Магазин / покупка', emoji: '🛒', hint: 'Что покупал, когда, что не выдалось?' },
  other: { label: 'Другое', emoji: '📌', hint: 'Кратко опиши обращение.' },
};

function getTicketTemplate(templateId = 'other') {
  return TICKET_TEMPLATES[templateId] || TICKET_TEMPLATES.other;
}

function buildTicketCreateModal(templateId = 'other') {
  const tpl = getTicketTemplate(templateId);
  return new ModalBuilder()
    .setCustomId(`ticket:modal:create:${templateId}`)
    .setTitle(`${tpl.emoji} Новый тикет`.slice(0, 45))
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('summary')
          .setLabel('Краткая тема обращения')
          .setPlaceholder('Например: не выдалась роль после покупки')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('details')
          .setLabel('Описание проблемы')
          .setPlaceholder(tpl.hint)
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1600)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('priority')
          .setLabel('Приоритет: low / normal / high / urgent')
          .setPlaceholder('normal')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(20)
      )
    );
}

function buildTicketTypeSelectPayload() {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🎫 Создание тикета')
    .setDescription('Выбери тип обращения. После выбора откроется форма, где можно указать тему, описание и приоритет.');
  const menu = new StringSelectMenuBuilder()
    .setCustomId('ticket:create_select')
    .setPlaceholder('Выбери тип тикета')
    .addOptions(Object.entries(TICKET_TEMPLATES).map(([value, cfg]) => ({
      label: cfg.label,
      value,
      emoji: cfg.emoji,
      description: cfg.hint.slice(0, 95),
    })));
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
}

function buildTicketReasonFromFields(templateId, summary, details) {
  const tpl = getTicketTemplate(templateId);
  return [`${tpl.emoji} ${tpl.label}: ${summary}`.slice(0, 180), '', String(details || '').trim()].filter(Boolean).join('\n').slice(0, 1800);
}

function ensureTicketStore(db) {
  if (!db.tickets) db.tickets = {};
  if (!db.ticketCounter) db.ticketCounter = 0;
}

function normalizeChannelName(text) {
  return String(text || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё_-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'user';
}

function findSupportRoles(guild) {
  return guild.roles.cache.filter(role => ADMIN_ROLE_NAMES.includes(role.name));
}

function findModerationCategory(guild) {
  return guild.channels.cache.find(channel =>
    channel.type === ChannelType.GuildCategory && channel.name === MOD_CATEGORY_NAME
  );
}

function getTicketChannelSettings() {
  const settings = getSettings();
  return {
    activeCategoryId: settings.ticketActiveCategoryId || process.env.TICKET_ACTIVE_CATEGORY_ID || '',
    activeCategoryName: settings.ticketActiveCategoryName || process.env.TICKET_ACTIVE_CATEGORY_NAME || DEFAULT_ACTIVE_TICKET_CATEGORY_NAME,
    archiveChannelId: settings.ticketArchiveChannelId || process.env.TICKET_ARCHIVE_CHANNEL_ID || '',
    archiveChannelName: settings.ticketArchiveChannelName || process.env.TICKET_ARCHIVE_CHANNEL_NAME || DEFAULT_TICKET_ARCHIVE_CHANNEL_NAME,
  };
}

function findCategoryByIdOrName(guild, id, name) {
  if (id) {
    const channel = guild.channels.cache.get(String(id));
    if (channel?.type === ChannelType.GuildCategory) return channel;
  }

  return guild.channels.cache.find(channel =>
    channel.type === ChannelType.GuildCategory && channel.name === name
  );
}

async function findOrCreateActiveTicketCategory(guild) {
  const { activeCategoryId, activeCategoryName } = getTicketChannelSettings();
  const existing = findCategoryByIdOrName(guild, activeCategoryId, activeCategoryName);
  if (existing) return existing;

  try {
    return await guild.channels.create({
      name: activeCategoryName,
      type: ChannelType.GuildCategory,
      reason: 'ServerCore active ticket category',
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: guild.client.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        },
      ],
    });
  } catch (error) {
    console.warn('Could not create active ticket category, using moderation category fallback:', error?.message || error);
    return findModerationCategory(guild);
  }
}

function findTicketArchiveChannel(guild) {
  const { archiveChannelId, archiveChannelName } = getTicketChannelSettings();
  if (archiveChannelId) {
    const byId = guild.channels.cache.get(String(archiveChannelId));
    if (byId && [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(byId.type)) return byId;
  }

  return guild.channels.cache.find(channel =>
    [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(channel.type) && channel.name === archiveChannelName
  );
}

async function sendTicketArchive(guild, ticket, closedByTag) {
  const archiveChannel = findTicketArchiveChannel(guild);
  if (!archiveChannel || !ticket) return null;

  const embed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle(`📁 Закрытый тикет #${ticket.id}`)
    .setDescription('Тикет закрыт и сохранён в архиве поддержки.')
    .addFields(
      { name: 'Пользователь', value: ticket.username || ticket.userId || 'неизвестно', inline: true },
      { name: 'Закрыл', value: closedByTag || ticket.closedBy || 'неизвестно', inline: true },
      { name: 'Статус', value: ticket.status || 'closed', inline: true },
      { name: 'Приоритет', value: priorityLabel(ticket.priority), inline: true },
      { name: 'Создан', value: ticket.createdAt ? `<t:${Math.floor(new Date(ticket.createdAt).getTime() / 1000)}:f>` : 'неизвестно', inline: true },
      { name: 'Закрыт', value: ticket.closedAt ? `<t:${Math.floor(new Date(ticket.closedAt).getTime() / 1000)}:f>` : 'только что', inline: true },
      { name: 'Причина обращения', value: String(ticket.reason || 'Не указана').slice(0, 1000), inline: false }
    )
    .setFooter({ text: 'ServerCore • Ticket Archive' })
    .setTimestamp();

  try {
    if (archiveChannel.type === ChannelType.GuildForum) {
      return await archiveChannel.threads.create({
        name: `ticket-${ticket.id}-${normalizeChannelName(ticket.username || ticket.userId)}`.slice(0, 90),
        message: { embeds: [embed] },
        reason: `Ticket #${ticket.id} archived`,
      });
    }

    return await archiveChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Could not send ticket archive:', error);
    return null;
  }
}

function findLogChannel(guild) {
  return guild.channels.cache.find(channel =>
    channel.type === ChannelType.GuildText && channel.name === LOG_CHANNEL_NAME
  );
}

function getOpenTicketByUser(userId) {
  const db = readDatabase();
  ensureTicketStore(db);

  return Object.values(db.tickets).find(ticket =>
    ticket.userId === userId && ticket.status === 'open'
  );
}

function getOpenTicketByChannel(channelId) {
  const db = readDatabase();
  ensureTicketStore(db);

  return Object.values(db.tickets).find(ticket =>
    ticket.channelId === channelId && ticket.status === 'open'
  );
}

function saveTicket(ticket) {
  const db = readDatabase();
  ensureTicketStore(db);

  db.tickets[ticket.id] = ticket;
  writeDatabase(db);
  return ticket;
}

function normalizePriority(priority) {
  const value = String(priority || 'normal').toLowerCase();
  return ['low', 'normal', 'high', 'urgent'].includes(value) ? value : 'normal';
}

function priorityLabel(priority) {
  return { low: 'Низкий', normal: 'Обычный', high: 'Высокий', urgent: 'Срочный' }[normalizePriority(priority)] || 'Обычный';
}

function createTicketRecord({ userId, username, channelId, reason, templateId = 'other', priority = 'normal' }) {
  const db = readDatabase();
  ensureTicketStore(db);

  db.ticketCounter += 1;
  const id = String(db.ticketCounter).padStart(4, '0');
  const now = new Date().toISOString();

  const ticket = {
    id,
    userId,
    username,
    channelId,
    reason: reason || 'Не указана',
    templateId,
    priority: normalizePriority(priority),
    assignedTo: null,
    assignedName: null,
    status: 'open',
    createdAt: now,
    closedAt: null,
    closedBy: null,
  };

  db.tickets[id] = ticket;
  writeDatabase(db);
  return ticket;
}

function updateTicketRecord(id, patch = {}) {
  const db = readDatabase();
  ensureTicketStore(db);
  const ticket = db.tickets[String(id)];
  if (!ticket) return null;
  Object.assign(ticket, patch, { updatedAt: new Date().toISOString() });
  if (patch.priority) ticket.priority = normalizePriority(patch.priority);
  db.tickets[String(id)] = ticket;
  writeDatabase(db);
  return ticket;
}

function closeTicketRecord(channelId, closedBy, closeReason = '') {
  const db = readDatabase();
  ensureTicketStore(db);

  const ticket = Object.values(db.tickets).find(item =>
    item.channelId === channelId && item.status === 'open'
  );

  if (!ticket) return null;

  ticket.status = 'closed';
  ticket.closedAt = new Date().toISOString();
  ticket.closedBy = closedBy;
  ticket.closeReason = closeReason || ticket.closeReason || '';
  db.tickets[ticket.id] = ticket;
  writeDatabase(db);
  return ticket;
}

async function sendTicketLog(guild, embed) {
  const logChannel = findLogChannel(guild);

  if (!logChannel) {
    console.warn(`Log channel not found: ${LOG_CHANNEL_NAME}`);
    return;
  }

  try {
    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Could not send ticket log:', error);
  }
}

function buildTicketControlRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:close')
      .setLabel('Закрыть тикет')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger)
  );
}

function memberCanCloseTicket(member, ticket) {
  if (!member || !ticket) return false;
  if (member.id === ticket.userId) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return member.roles.cache.some(role => ADMIN_ROLE_NAMES.includes(role.name));
}

async function createTicket(interaction, reason, options = {}) {
  const existingTicket = getOpenTicketByUser(interaction.user.id);

  if (existingTicket) {
    const channel = interaction.guild.channels.cache.get(existingTicket.channelId);
    return {
      ok: false,
      reason: 'already_open',
      channel,
      ticket: existingTicket,
    };
  }

  const guild = interaction.guild;
  const supportRoles = findSupportRoles(guild);
  const category = await findOrCreateActiveTicketCategory(guild);
  const safeUsername = normalizeChannelName(interaction.user.username);
  const channelName = `ticket-${safeUsername}`;

  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    {
      id: guild.client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
      ],
    },
  ];

  for (const role of supportRoles.values()) {
    permissionOverwrites.push({
      id: role.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
      ],
    });
  }

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category?.id,
    topic: `Тикет пользователя ${interaction.user.tag}. Приоритет: ${priorityLabel(options.priority)}. Причина: ${reason || 'Не указана'}`,
    permissionOverwrites,
  });

  const ticket = createTicketRecord({
    userId: interaction.user.id,
    username: interaction.user.tag,
    channelId: channel.id,
    reason,
    templateId: options.templateId || 'other',
    priority: options.priority || 'normal',
  });

  const ticketEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`🎫 Тикет #${ticket.id}`)
    .setDescription(
      `Привет, ${interaction.user}. Опиши проблему подробнее, администрация ответит здесь.\n\n` +
      `**Причина:** ${ticket.reason}`
    )
    .addFields(
      { name: 'Статус', value: 'Открыт', inline: true },
      { name: 'Приоритет', value: priorityLabel(ticket.priority), inline: true },
      { name: 'Создал', value: `${interaction.user}`, inline: true }
    )
    .setFooter({ text: 'ServerCore • Ticket System' })
    .setTimestamp();

  await channel.send({
    content: `${interaction.user} ${supportRoles.map(role => role.toString()).join(' ')}`,
    embeds: [ticketEmbed],
    components: [buildTicketControlRow()],
  });

  const logEmbed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('🎫 Создан тикет')
    .addFields(
      { name: 'Тикет', value: `#${ticket.id}`, inline: true },
      { name: 'Пользователь', value: `${interaction.user.tag}`, inline: true },
      { name: 'Канал', value: `${channel}`, inline: true },
      { name: 'Причина', value: ticket.reason, inline: false },
      { name: 'Приоритет', value: priorityLabel(ticket.priority), inline: true }
    )
    .setTimestamp();

  await sendTicketLog(guild, logEmbed);

  const achievement = awardAchievement(interaction.user.id, interaction.user.username, 'first_ticket');

  return {
    ok: true,
    channel,
    ticket,
    unlockedAchievements: achievement.awarded ? [achievement.achievement] : []
  };
}

async function closeTicket(interaction, closeReason = '') {
  const ticket = getOpenTicketByChannel(interaction.channelId);

  if (!ticket) {
    return { ok: false, reason: 'not_ticket_channel' };
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);

  if (!memberCanCloseTicket(member, ticket)) {
    return { ok: false, reason: 'no_permission', ticket };
  }

  const closedTicket = closeTicketRecord(interaction.channelId, interaction.user.tag, closeReason);
  const archiveResult = await sendTicketArchive(interaction.guild, closedTicket, interaction.user.tag);

  const logEmbed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('🔒 Тикет закрыт')
    .addFields(
      { name: 'Тикет', value: `#${closedTicket.id}`, inline: true },
      { name: 'Открыл', value: closedTicket.username, inline: true },
      { name: 'Закрыл', value: interaction.user.tag, inline: true },
      { name: 'Причина открытия', value: closedTicket.reason || 'Не указана', inline: false },
      { name: 'Архив', value: archiveResult?.url ? `[открыть запись](${archiveResult.url})` : (archiveResult ? 'запись создана' : 'архив не найден'), inline: false }
    )
    .setTimestamp();

  await sendTicketLog(interaction.guild, logEmbed);

  return { ok: true, ticket: closedTicket, archived: Boolean(archiveResult) };
}

module.exports = {
  updateTicketRecord,
  normalizePriority,
  priorityLabel,
  TICKET_TEMPLATES,
  buildTicketCreateModal,
  buildTicketTypeSelectPayload,
  buildTicketReasonFromFields,
  createTicket,
  closeTicket,
  getOpenTicketByChannel,
};
