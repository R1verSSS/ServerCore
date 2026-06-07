const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { readDatabase, writeDatabase } = require('./dataStore');

const LOG_CHANNEL_NAME = '📋・лог-модерации';

const DURATION_UNITS = {
  s: 1000,
  sec: 1000,
  секунд: 1000,
  m: 60 * 1000,
  min: 60 * 1000,
  минут: 60 * 1000,
  h: 60 * 60 * 1000,
  час: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  дней: 24 * 60 * 60 * 1000,
};

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

function parseDuration(input) {
  if (!input || typeof input !== 'string') return null;
  const value = input.trim().toLowerCase().replace(',', '.');
  const match = value.match(/^(\d+(?:\.\d+)?)(\s*)([a-zа-я]+)$/i);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[3];
  const multiplier = DURATION_UNITS[unit];

  if (!Number.isFinite(amount) || amount <= 0 || !multiplier) return null;

  const ms = Math.round(amount * multiplier);
  if (ms <= 0 || ms > MAX_TIMEOUT_MS) return null;
  return ms;
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return 'не указано';
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (ms % day === 0) return `${ms / day} дн.`;
  if (ms % hour === 0) return `${ms / hour} ч.`;
  if (ms % minute === 0) return `${ms / minute} мин.`;
  return `${Math.round(ms / 1000)} сек.`;
}

function getLogChannel(guild) {
  return guild.channels.cache.find(channel => channel.name === LOG_CHANNEL_NAME && channel.isTextBased());
}

async function sendModerationLog(guild, payload) {
  const channel = getLogChannel(guild);
  if (!channel) return false;

  try {
    await channel.send(payload);
    return true;
  } catch (error) {
    console.warn('Could not send moderation log:', error.message);
    return false;
  }
}

function createLogEmbed({ title, color = 0x5865F2, moderator, target, reason, fields = [] }) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setTimestamp()
    .addFields(
      { name: 'Модератор', value: moderator ? `${moderator.tag} (${moderator.id})` : 'Неизвестно', inline: false },
      { name: 'Участник', value: target ? `${target.tag} (${target.id})` : 'Неизвестно', inline: false },
      { name: 'Причина', value: reason || 'Не указана', inline: false },
      ...fields
    )
    .setFooter({ text: 'ServerCore • Moderation' });

  return embed;
}

function canModerateTarget(moderatorMember, targetMember) {
  if (!moderatorMember || !targetMember) return true;
  if (targetMember.id === moderatorMember.id) return false;
  if (targetMember.id === targetMember.guild.ownerId) return false;
  if (moderatorMember.id === moderatorMember.guild.ownerId) return true;
  return moderatorMember.roles.highest.comparePositionTo(targetMember.roles.highest) > 0;
}

function canBotModerateTarget(botMember, targetMember) {
  if (!botMember || !targetMember) return true;
  if (targetMember.id === targetMember.guild.ownerId) return false;
  return botMember.roles.highest.comparePositionTo(targetMember.roles.highest) > 0;
}

function ensureModerationCollections(db) {
  if (!Array.isArray(db.warnings)) db.warnings = [];
  if (!Array.isArray(db.moderationCases)) db.moderationCases = [];
  if (!Array.isArray(db.moderationNotes)) db.moderationNotes = [];
  if (!Array.isArray(db.moderationAppeals)) db.moderationAppeals = [];
  db.moderationCounter = Number(db.moderationCounter || 0);
  db.moderationCaseCounter = Number(db.moderationCaseCounter || 0);
  db.moderationNoteCounter = Number(db.moderationNoteCounter || 0);
  db.moderationAppealCounter = Number(db.moderationAppealCounter || 0);
}

function createModerationCase({ guildId, userId, username, moderatorId, moderatorName, type, reason, duration, referenceId, metadata = {} }) {
  const db = readDatabase();
  ensureModerationCollections(db);
  db.moderationCaseCounter += 1;

  const item = {
    id: db.moderationCaseCounter,
    guildId,
    userId,
    username: username || 'Unknown',
    moderatorId: moderatorId || null,
    moderatorName: moderatorName || 'System',
    type: type || 'note',
    reason: reason || 'Не указана',
    duration: duration || null,
    referenceId: referenceId || null,
    status: 'active',
    createdAt: new Date().toISOString(),
    closedAt: null,
    metadata,
  };

  db.moderationCases.push(item);
  writeDatabase(db);
  return item;
}

function listCases({ guildId, userId, status, type, limit = 20 } = {}) {
  const db = readDatabase();
  ensureModerationCollections(db);
  return db.moderationCases
    .filter(item => !guildId || item.guildId === guildId)
    .filter(item => !userId || item.userId === userId)
    .filter(item => !status || item.status === status)
    .filter(item => !type || item.type === type)
    .sort((a, b) => Number(b.id) - Number(a.id))
    .slice(0, Math.max(1, Math.min(Number(limit || 20), 50)));
}

function getCase(id, guildId) {
  const db = readDatabase();
  ensureModerationCollections(db);
  return db.moderationCases.find(item => Number(item.id) === Number(id) && (!guildId || item.guildId === guildId)) || null;
}

function closeCase(id, guildId, moderatorId, moderatorName, comment = '') {
  const db = readDatabase();
  ensureModerationCollections(db);
  const item = db.moderationCases.find(c => Number(c.id) === Number(id) && (!guildId || c.guildId === guildId));
  if (!item) return { ok: false, reason: 'not_found' };
  item.status = 'closed';
  item.closedAt = new Date().toISOString();
  item.closedBy = moderatorId || null;
  item.closedByName = moderatorName || 'Unknown';
  item.closeComment = comment || '';
  writeDatabase(db);
  return { ok: true, case: item };
}

function addWarning({ guildId, userId, username, moderatorId, moderatorName, reason }) {
  const db = readDatabase();
  ensureModerationCollections(db);
  db.moderationCounter += 1;

  const warning = {
    id: db.moderationCounter,
    guildId,
    userId,
    username,
    moderatorId,
    moderatorName,
    reason: reason || 'Не указана',
    createdAt: new Date().toISOString(),
    active: true,
  };

  db.warnings.push(warning);
  writeDatabase(db);

  const caseItem = createModerationCase({
    guildId,
    userId,
    username,
    moderatorId,
    moderatorName,
    type: 'warn',
    reason,
    referenceId: `warning:${warning.id}`,
  });

  return { ...warning, caseId: caseItem.id };
}

function removeWarning(id, guildId, moderatorId, moderatorName, reason = '') {
  const db = readDatabase();
  ensureModerationCollections(db);
  const warning = db.warnings.find(item => Number(item.id) === Number(id) && (!guildId || item.guildId === guildId));
  if (!warning) return { ok: false, reason: 'not_found' };
  if (warning.active === false) return { ok: false, reason: 'already_removed', warning };

  warning.active = false;
  warning.removedAt = new Date().toISOString();
  warning.removedBy = moderatorId || null;
  warning.removedByName = moderatorName || 'Unknown';
  warning.removeReason = reason || 'Не указана';

  for (const item of db.moderationCases || []) {
    if (item.referenceId === `warning:${warning.id}`) {
      item.status = 'closed';
      item.closedAt = warning.removedAt;
      item.closedBy = moderatorId || null;
      item.closedByName = moderatorName || 'Unknown';
      item.closeComment = `Предупреждение снято: ${warning.removeReason}`;
    }
  }

  writeDatabase(db);
  return { ok: true, warning };
}

function getWarnings(userId, guildId, includeInactive = false) {
  const db = readDatabase();
  ensureModerationCollections(db);
  return (db.warnings || [])
    .filter(item => item.userId === userId && item.guildId === guildId)
    .filter(item => includeInactive || item.active !== false)
    .sort((a, b) => a.id - b.id);
}

function addModeratorNote({ guildId, userId, username, moderatorId, moderatorName, text }) {
  const db = readDatabase();
  ensureModerationCollections(db);
  db.moderationNoteCounter += 1;
  const note = {
    id: db.moderationNoteCounter,
    guildId,
    userId,
    username: username || 'Unknown',
    moderatorId,
    moderatorName,
    text: text || 'Без текста',
    createdAt: new Date().toISOString(),
    active: true,
  };
  db.moderationNotes.push(note);
  writeDatabase(db);
  return note;
}

function getModeratorNotes(userId, guildId, limit = 20) {
  const db = readDatabase();
  ensureModerationCollections(db);
  return db.moderationNotes
    .filter(item => item.userId === userId && item.guildId === guildId && item.active !== false)
    .sort((a, b) => Number(b.id) - Number(a.id))
    .slice(0, Math.max(1, Math.min(Number(limit || 20), 50)));
}

function createAppeal({ guildId, userId, username, caseId, text }) {
  const db = readDatabase();
  ensureModerationCollections(db);
  db.moderationAppealCounter += 1;
  const appeal = {
    id: db.moderationAppealCounter,
    guildId,
    userId,
    username: username || 'Unknown',
    caseId: caseId || null,
    text: text || 'Без текста',
    status: 'open',
    response: '',
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    reviewedByName: null,
  };
  db.moderationAppeals.push(appeal);
  writeDatabase(db);
  return appeal;
}

function listAppeals({ guildId, status, userId, limit = 20 } = {}) {
  const db = readDatabase();
  ensureModerationCollections(db);
  return db.moderationAppeals
    .filter(item => !guildId || item.guildId === guildId)
    .filter(item => !status || item.status === status)
    .filter(item => !userId || item.userId === userId)
    .sort((a, b) => Number(b.id) - Number(a.id))
    .slice(0, Math.max(1, Math.min(Number(limit || 20), 50)));
}

function updateAppealStatus(id, guildId, status, moderatorId, moderatorName, response = '') {
  const db = readDatabase();
  ensureModerationCollections(db);
  const appeal = db.moderationAppeals.find(item => Number(item.id) === Number(id) && (!guildId || item.guildId === guildId));
  if (!appeal) return { ok: false, reason: 'not_found' };
  appeal.status = status;
  appeal.response = response || appeal.response || '';
  appeal.reviewedAt = new Date().toISOString();
  appeal.reviewedBy = moderatorId || null;
  appeal.reviewedByName = moderatorName || 'Unknown';
  writeDatabase(db);
  return { ok: true, appeal };
}

function hasPermission(member, permission) {
  return Boolean(member?.permissions?.has(permission));
}

module.exports = {
  LOG_CHANNEL_NAME,
  parseDuration,
  formatDuration,
  sendModerationLog,
  createLogEmbed,
  canModerateTarget,
  canBotModerateTarget,
  addWarning,
  removeWarning,
  getWarnings,
  createModerationCase,
  listCases,
  getCase,
  closeCase,
  addModeratorNote,
  getModeratorNotes,
  createAppeal,
  listAppeals,
  updateAppealStatus,
  hasPermission,
  PermissionFlagsBits,
};
