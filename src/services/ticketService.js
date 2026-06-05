const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { readDatabase, writeDatabase } = require('./dataStore');
const { awardAchievement } = require('./achievementService');

const ADMIN_ROLE_NAMES = ['👑 Owner', '🛡 Admin', '👮 Moderator'];
const LOG_CHANNEL_NAME = '🛡・лог-модерации';
const MOD_CATEGORY_NAME = '🛡 МОДЕРАЦИЯ';

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

function createTicketRecord({ userId, username, channelId, reason }) {
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
    status: 'open',
    createdAt: now,
    closedAt: null,
    closedBy: null,
  };

  db.tickets[id] = ticket;
  writeDatabase(db);
  return ticket;
}

function closeTicketRecord(channelId, closedBy) {
  const db = readDatabase();
  ensureTicketStore(db);

  const ticket = Object.values(db.tickets).find(item =>
    item.channelId === channelId && item.status === 'open'
  );

  if (!ticket) return null;

  ticket.status = 'closed';
  ticket.closedAt = new Date().toISOString();
  ticket.closedBy = closedBy;
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

async function createTicket(interaction, reason) {
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
  const category = findModerationCategory(guild);
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
    topic: `Тикет пользователя ${interaction.user.tag}. Причина: ${reason || 'Не указана'}`,
    permissionOverwrites,
  });

  const ticket = createTicketRecord({
    userId: interaction.user.id,
    username: interaction.user.tag,
    channelId: channel.id,
    reason,
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
      { name: 'Причина', value: ticket.reason, inline: false }
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

async function closeTicket(interaction) {
  const ticket = getOpenTicketByChannel(interaction.channelId);

  if (!ticket) {
    return { ok: false, reason: 'not_ticket_channel' };
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);

  if (!memberCanCloseTicket(member, ticket)) {
    return { ok: false, reason: 'no_permission', ticket };
  }

  const closedTicket = closeTicketRecord(interaction.channelId, interaction.user.tag);

  const logEmbed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('🔒 Тикет закрыт')
    .addFields(
      { name: 'Тикет', value: `#${closedTicket.id}`, inline: true },
      { name: 'Открыл', value: closedTicket.username, inline: true },
      { name: 'Закрыл', value: interaction.user.tag, inline: true },
      { name: 'Причина открытия', value: closedTicket.reason || 'Не указана', inline: false }
    )
    .setTimestamp();

  await sendTicketLog(interaction.guild, logEmbed);

  return { ok: true, ticket: closedTicket };
}

module.exports = {
  createTicket,
  closeTicket,
  getOpenTicketByChannel,
};
