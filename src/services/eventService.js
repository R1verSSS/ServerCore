const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const { readDatabase, writeDatabase, getOrCreateUser } = require('./dataStore');
const { awardAchievement } = require('./achievementService');

const LOG_CHANNEL_NAME = '📋・лог-модерации';
const EVENTS_CHANNEL_NAME = '📅・ивенты';

function ensureEvents(db) {
  if (!db.events) db.events = {};
  if (!db.eventCounter) db.eventCounter = 0;
  return db;
}

function parseEventDate(input) {
  if (!input || typeof input !== 'string') return null;
  const value = input.trim();

  // Supported formats:
  // 2026-06-10 20:00
  // 10.06.2026 20:00
  let match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (match) {
    const [, y, mo, d, h, mi] = match;
    const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})[ T](\d{2}):(\d{2})$/);
  if (match) {
    const [, d, mo, y, h, mi] = match;
    const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatEventDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Дата не указана';
  return `<t:${Math.floor(date.getTime() / 1000)}:f>`;
}

function formatEventShortDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Дата не указана';
  return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
}

function getEventById(eventId) {
  const db = ensureEvents(readDatabase());
  return db.events[String(eventId)] || null;
}

function getOpenEvents() {
  const db = ensureEvents(readDatabase());
  return Object.values(db.events || {})
    .filter(event => event.status === 'open')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function buildEventEmbed(event, guild) {
  const participants = event.participants || [];
  const maxMembers = event.maxMembers || 0;
  const maxText = maxMembers > 0 ? `${participants.length}/${maxMembers}` : `${participants.length}/∞`;
  const participantText = participants.length
    ? participants.slice(0, 15).map(id => `<@${id}>`).join('\n') + (participants.length > 15 ? `\n...и еще ${participants.length - 15}` : '')
    : 'Пока никто не записался.';

  return new EmbedBuilder()
    .setColor(event.status === 'open' ? 0x5865F2 : 0x99AAB5)
    .setTitle(`📅 Ивент #${event.id}: ${event.title}`)
    .setDescription(event.description || 'Описание не указано.')
    .addFields(
      { name: 'Дата', value: `${formatEventDate(event.date)} (${formatEventShortDate(event.date)})`, inline: false },
      { name: 'Участники', value: maxText, inline: true },
      { name: 'Статус', value: event.status === 'open' ? 'Открыт' : 'Закрыт', inline: true },
      { name: 'Создал', value: `<@${event.createdBy}>`, inline: true },
      { name: 'Список участников', value: participantText, inline: false }
    )
    .setFooter({ text: guild ? `${guild.name} • Event System` : 'ServerCore • Event System' });
}

function buildEventButtons(event) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`event:join:${event.id}`)
        .setLabel('Записаться')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success)
        .setDisabled(event.status !== 'open'),
      new ButtonBuilder()
        .setCustomId(`event:leave:${event.id}`)
        .setLabel('Выйти')
        .setEmoji('↩️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(event.status !== 'open')
    )
  ];
}

async function findTextChannelByName(guild, name) {
  return guild.channels.cache.find(channel => channel.name === name && channel.type === ChannelType.GuildText) || null;
}

async function logEventAction(guild, embed) {
  try {
    const logChannel = await findTextChannelByName(guild, LOG_CHANNEL_NAME);
    if (logChannel) await logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Could not send event log:', error);
  }
}

async function createEvent(interaction, payload) {
  const date = parseEventDate(payload.dateInput);
  if (!date) {
    return { ok: false, reason: 'invalid_date' };
  }

  const db = ensureEvents(readDatabase());
  const id = ++db.eventCounter;

  const event = {
    id,
    title: payload.title,
    description: payload.description || 'Описание не указано.',
    date: date.toISOString(),
    maxMembers: payload.maxMembers || 0,
    createdBy: interaction.user.id,
    participants: [],
    messageId: null,
    channelId: null,
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.events[String(id)] = event;
  writeDatabase(db);

  const eventsChannel = await findTextChannelByName(interaction.guild, EVENTS_CHANNEL_NAME);
  let message = null;

  if (eventsChannel) {
    message = await eventsChannel.send({
      embeds: [buildEventEmbed(event, interaction.guild)],
      components: buildEventButtons(event),
    });

    event.messageId = message.id;
    event.channelId = eventsChannel.id;

    const dbAfterMessage = ensureEvents(readDatabase());
    dbAfterMessage.events[String(id)] = event;
    writeDatabase(dbAfterMessage);
  }

  const logEmbed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('📅 Создан ивент')
    .addFields(
      { name: 'Ивент', value: `#${event.id} — ${event.title}`, inline: false },
      { name: 'Дата', value: formatEventDate(event.date), inline: true },
      { name: 'Создал', value: `<@${interaction.user.id}>`, inline: true }
    )
    .setTimestamp();

  await logEventAction(interaction.guild, logEmbed);

  return { ok: true, event, eventsChannel, message };
}

async function updateEventMessage(guild, event) {
  if (!event.channelId || !event.messageId) return;

  try {
    const channel = await guild.channels.fetch(event.channelId);
    if (!channel) return;
    const message = await channel.messages.fetch(event.messageId);
    if (!message) return;

    await message.edit({
      embeds: [buildEventEmbed(event, guild)],
      components: buildEventButtons(event),
    });
  } catch (error) {
    console.error('Could not update event message:', error);
  }
}

async function joinEvent(interaction, eventId) {
  const db = ensureEvents(readDatabase());
  const event = db.events[String(eventId)];

  if (!event || event.status !== 'open') return { ok: false, reason: 'not_found' };
  if ((event.participants || []).includes(interaction.user.id)) return { ok: false, reason: 'already_joined', event };
  if (event.maxMembers > 0 && event.participants.length >= event.maxMembers) return { ok: false, reason: 'full', event };

  getOrCreateUser(interaction.user.id, interaction.user.username);

  event.participants.push(interaction.user.id);
  event.updatedAt = new Date().toISOString();
  db.events[String(eventId)] = event;
  writeDatabase(db);

  await updateEventMessage(interaction.guild, event);

  const achievement = awardAchievement(interaction.user.id, interaction.user.username, 'first_event_join');
  return {
    ok: true,
    event,
    unlockedAchievements: achievement.awarded ? [achievement.achievement] : []
  };
}

async function leaveEvent(interaction, eventId) {
  const db = ensureEvents(readDatabase());
  const event = db.events[String(eventId)];

  if (!event || event.status !== 'open') return { ok: false, reason: 'not_found' };
  if (!(event.participants || []).includes(interaction.user.id)) return { ok: false, reason: 'not_joined', event };

  event.participants = event.participants.filter(id => id !== interaction.user.id);
  event.updatedAt = new Date().toISOString();
  db.events[String(eventId)] = event;
  writeDatabase(db);

  await updateEventMessage(interaction.guild, event);
  return { ok: true, event };
}

async function cancelEvent(interaction, eventId) {
  const db = ensureEvents(readDatabase());
  const event = db.events[String(eventId)];

  if (!event || event.status !== 'open') return { ok: false, reason: 'not_found' };

  const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
  const isModerator = interaction.member.roles.cache.some(role => role.name === '👮 Moderator' || role.name === '🛡 Admin');
  const isCreator = event.createdBy === interaction.user.id;

  if (!isAdmin && !isModerator && !isCreator) return { ok: false, reason: 'no_permission', event };

  event.status = 'closed';
  event.updatedAt = new Date().toISOString();
  db.events[String(eventId)] = event;
  writeDatabase(db);

  await updateEventMessage(interaction.guild, event);

  const logEmbed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('📅 Ивент закрыт')
    .addFields(
      { name: 'Ивент', value: `#${event.id} — ${event.title}`, inline: false },
      { name: 'Закрыл', value: `<@${interaction.user.id}>`, inline: true }
    )
    .setTimestamp();

  await logEventAction(interaction.guild, logEmbed);

  return { ok: true, event };
}

function getEventListEmbed(events, guild) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📅 Активные ивенты')
    .setFooter({ text: guild ? `${guild.name} • Event System` : 'ServerCore • Event System' });

  if (!events.length) {
    embed.setDescription('Сейчас нет активных ивентов. Создай новый через `/event create`.');
    return embed;
  }

  embed.setDescription(events.slice(0, 10).map(event => {
    const members = event.maxMembers > 0 ? `${event.participants.length}/${event.maxMembers}` : `${event.participants.length}/∞`;
    return `**#${event.id} — ${event.title}**\nДата: ${formatEventDate(event.date)}\nУчастники: ${members}`;
  }).join('\n\n'));

  return embed;
}

module.exports = {
  createEvent,
  joinEvent,
  leaveEvent,
  cancelEvent,
  getEventById,
  getOpenEvents,
  buildEventEmbed,
  buildEventButtons,
  getEventListEmbed,
  formatEventDate,
};
