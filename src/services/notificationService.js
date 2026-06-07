const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { readDatabase, writeDatabase, getOrCreateUser } = require('./dataStore');

const REMINDER_CHECK_INTERVAL_MS = 30 * 1000;
const EVENT_REMINDER_MINUTES = 30;
const TICKET_STALE_HOURS = 12;
let schedulerStarted = false;

function ensureNotifications(db) {
  if (!db.reminders) db.reminders = {};
  if (!db.reminderCounter) db.reminderCounter = 0;
  if (!db.notificationSettings) db.notificationSettings = {
    daily: true,
    events: true,
    tournaments: true,
    season: true,
    tickets: true,
    channelId: null,
    staleTicketHours: TICKET_STALE_HOURS,
    eventReminderMinutes: EVENT_REMINDER_MINUTES,
  };
  if (!db.notificationLog) db.notificationLog = [];
  return db;
}

function getNotificationSettings() {
  const db = ensureNotifications(readDatabase());
  return db.notificationSettings;
}

function updateNotificationSettings(patch = {}) {
  const db = ensureNotifications(readDatabase());
  db.notificationSettings = { ...db.notificationSettings, ...patch };
  writeDatabase(db);
  return db.notificationSettings;
}

function parseDuration(input) {
  const value = String(input || '').trim().toLowerCase();
  const match = value.match(/^(\d+)(m|h|d)$/);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2];
  if (!amount || amount < 1) return null;
  const multiplier = unit === 'm' ? 60 * 1000 : unit === 'h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  return new Date(Date.now() + amount * multiplier);
}

function parseDateTime(input) {
  const value = String(input || '').trim();
  if (!value) return null;

  const durationDate = parseDuration(value);
  if (durationDate) return durationDate;

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

function formatDiscordTime(iso, style = 'f') {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'дата не указана';
  return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}

function createReminder(userId, username, guildId, channelId, message, dueInput, mode = 'channel') {
  const dueDate = parseDateTime(dueInput);
  if (!dueDate || dueDate.getTime() <= Date.now()) return { ok: false, reason: 'invalid_date' };

  const db = ensureNotifications(readDatabase());
  const id = ++db.reminderCounter;
  const reminder = {
    id,
    userId,
    username,
    guildId,
    channelId,
    message: String(message || '').slice(0, 1000),
    dueAt: dueDate.toISOString(),
    mode,
    status: 'open',
    createdAt: new Date().toISOString(),
    sentAt: null,
  };
  db.reminders[String(id)] = reminder;
  getOrCreateUser(userId, username);
  writeDatabase(db);
  return { ok: true, reminder };
}

function listUserReminders(userId) {
  const db = ensureNotifications(readDatabase());
  return Object.values(db.reminders || {})
    .filter(r => r.userId === userId && r.status === 'open')
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
}

function cancelReminder(userId, id, member = null) {
  const db = ensureNotifications(readDatabase());
  const reminder = db.reminders?.[String(id)];
  if (!reminder || reminder.status !== 'open') return { ok: false, reason: 'not_found' };
  const canManage = member?.permissions?.has(PermissionFlagsBits.ManageGuild) || member?.permissions?.has(PermissionFlagsBits.Administrator);
  if (reminder.userId !== userId && !canManage) return { ok: false, reason: 'no_permission' };
  reminder.status = 'cancelled';
  reminder.cancelledAt = new Date().toISOString();
  db.reminders[String(id)] = reminder;
  writeDatabase(db);
  return { ok: true, reminder };
}

async function sendReminder(client, reminder) {
  const embed = new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle('⏰ Напоминание')
    .setDescription(reminder.message || 'Напоминание без текста.')
    .addFields(
      { name: 'Для', value: `<@${reminder.userId}>`, inline: true },
      { name: 'Создано', value: formatDiscordTime(reminder.createdAt, 'R'), inline: true }
    )
    .setTimestamp();

  if (reminder.mode === 'dm') {
    const user = await client.users.fetch(reminder.userId).catch(() => null);
    if (user) {
      await user.send({ embeds: [embed] });
      return true;
    }
  }

  const channel = await client.channels.fetch(reminder.channelId).catch(() => null);
  if (channel?.isTextBased()) {
    await channel.send({ content: `<@${reminder.userId}>`, embeds: [embed] });
    return true;
  }

  const user = await client.users.fetch(reminder.userId).catch(() => null);
  if (user) {
    await user.send({ embeds: [embed] });
    return true;
  }

  return false;
}

async function sendChannelNotification(client, title, description, color = 0x5865F2, fields = []) {
  const db = ensureNotifications(readDatabase());
  const settings = db.notificationSettings;
  const guild = client.guilds.cache.get(process.env.GUILD_ID) || client.guilds.cache.first();
  let channel = null;

  if (settings.channelId) channel = await client.channels.fetch(settings.channelId).catch(() => null);
  if (!channel && guild) channel = guild.channels.cache.find(c => c.name === '📢・объявления' && c.isTextBased());
  if (!channel && guild) channel = guild.channels.cache.find(c => c.name === '📋・лог-модерации' && c.isTextBased());
  if (!channel?.isTextBased()) return false;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .addFields(fields)
    .setTimestamp();
  await channel.send({ embeds: [embed] });
  db.notificationLog.unshift({ title, description, createdAt: new Date().toISOString() });
  db.notificationLog = db.notificationLog.slice(0, 100);
  writeDatabase(db);
  return true;
}

async function checkDueReminders(client) {
  const db = ensureNotifications(readDatabase());
  const now = Date.now();
  let changed = false;

  for (const reminder of Object.values(db.reminders || {})) {
    if (reminder.status !== 'open') continue;
    if (new Date(reminder.dueAt).getTime() > now) continue;

    try {
      await sendReminder(client, reminder);
      reminder.status = 'sent';
      reminder.sentAt = new Date().toISOString();
    } catch (error) {
      console.error('Reminder send error:', error);
      reminder.status = 'failed';
      reminder.error = error.message;
    }
    db.reminders[String(reminder.id)] = reminder;
    changed = true;
  }

  if (changed) writeDatabase(db);
}

async function checkEventNotifications(client) {
  const db = ensureNotifications(readDatabase());
  const settings = db.notificationSettings;
  if (!settings.events) return;
  const now = Date.now();
  const thresholdMs = Number(settings.eventReminderMinutes || EVENT_REMINDER_MINUTES) * 60 * 1000;
  let changed = false;

  for (const event of Object.values(db.events || {})) {
    if (event.status !== 'open' || event.notification30Sent) continue;
    const eventTime = new Date(event.date).getTime();
    if (!eventTime || Number.isNaN(eventTime)) continue;
    const delta = eventTime - now;
    if (delta > 0 && delta <= thresholdMs) {
      const participants = (event.participants || []).map(id => `<@${id}>`).join(' ');
      await sendChannelNotification(
        client,
        '📅 Скоро начнется ивент',
        `**#${event.id} — ${event.title}** начнется ${formatDiscordTime(event.date, 'R')}.`,
        0x57F287,
        [
          { name: 'Дата', value: formatDiscordTime(event.date, 'f'), inline: true },
          { name: 'Участники', value: participants || 'Участников пока нет.', inline: false }
        ]
      ).catch(console.error);
      event.notification30Sent = true;
      db.events[String(event.id)] = event;
      changed = true;
    }
  }

  if (changed) writeDatabase(db);
}

async function checkTournamentNotifications(client) {
  const db = ensureNotifications(readDatabase());
  const settings = db.notificationSettings;
  if (!settings.tournaments) return;
  let changed = false;

  for (const tournament of Object.values(db.tournaments || {})) {
    if (tournament.status !== 'open' || tournament.notificationCreatedSent) continue;
    await sendChannelNotification(
      client,
      '🏆 Открыт набор на турнир',
      `**#${tournament.id} — ${tournament.title}** открыт для записи.`,
      0xFEE75C,
      [
        { name: 'Участники', value: `${(tournament.participants || []).length}/${tournament.maxMembers || '∞'}`, inline: true },
        { name: 'Команда', value: `Используй \`/tournament join id:${tournament.id}\``, inline: false }
      ]
    ).catch(console.error);
    tournament.notificationCreatedSent = true;
    db.tournaments[String(tournament.id)] = tournament;
    changed = true;
  }

  if (changed) writeDatabase(db);
}

async function checkTicketNotifications(client) {
  const db = ensureNotifications(readDatabase());
  const settings = db.notificationSettings;
  if (!settings.tickets) return;
  const now = Date.now();
  const staleMs = Number(settings.staleTicketHours || TICKET_STALE_HOURS) * 60 * 60 * 1000;
  let changed = false;

  for (const ticket of Object.values(db.tickets || {})) {
    if (ticket.status !== 'open' || ticket.staleNotificationSent) continue;
    const createdAt = new Date(ticket.createdAt).getTime();
    if (!createdAt || Number.isNaN(createdAt)) continue;
    if (now - createdAt >= staleMs) {
      await sendChannelNotification(
        client,
        '🎫 Тикет ожидает ответа',
        `Тикет **#${ticket.id}** открыт уже больше ${settings.staleTicketHours || TICKET_STALE_HOURS} ч.`,
        0xED4245,
        [
          { name: 'Пользователь', value: ticket.username || ticket.userId || 'неизвестно', inline: true },
          { name: 'Причина', value: ticket.reason || 'не указана', inline: false }
        ]
      ).catch(console.error);
      ticket.staleNotificationSent = true;
      db.tickets[String(ticket.id)] = ticket;
      changed = true;
    }
  }

  if (changed) writeDatabase(db);
}

async function runNotificationChecks(client) {
  await checkDueReminders(client);
  await checkEventNotifications(client);
  await checkTournamentNotifications(client);
  await checkTicketNotifications(client);
}

function startNotificationScheduler(client) {
  if (schedulerStarted) return;
  schedulerStarted = true;
  setTimeout(() => runNotificationChecks(client).catch(console.error), 5000);
  setInterval(() => runNotificationChecks(client).catch(console.error), REMINDER_CHECK_INTERVAL_MS);
  console.log('Notification scheduler started');
}

module.exports = {
  ensureNotifications,
  getNotificationSettings,
  updateNotificationSettings,
  createReminder,
  listUserReminders,
  cancelReminder,
  parseDateTime,
  formatDiscordTime,
  sendChannelNotification,
  startNotificationScheduler,
  runNotificationChecks,
};
