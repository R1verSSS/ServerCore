const fs = require('node:fs');
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { readDatabase, getStorageInfo } = require('./dataStore');
const { getSettings } = require('./settingsService');
const { buildHostingReadiness } = require('./hostingCheckService');

function findTextChannel(guild, name) {
  return guild?.channels.cache.find(ch => ch.type === ChannelType.GuildText && ch.name === name) || null;
}
function findTextOrForumChannel(guild, name, id) {
  const allowedTypes = new Set([ChannelType.GuildText, ChannelType.GuildForum, ChannelType.GuildAnnouncement]);
  if (id) {
    const byId = guild?.channels.cache.get(String(id));
    if (byId && allowedTypes.has(byId.type)) return byId;
  }
  return guild?.channels.cache.find(ch => allowedTypes.has(ch.type) && ch.name === name) || null;
}
function findVoiceChannel(guild, name) {
  return guild?.channels.cache.find(ch => ch.type === ChannelType.GuildVoice && ch.name === name) || null;
}
function check(ok, label, hint = '') { return { ok: Boolean(ok), label, hint }; }

async function buildHealthReport(client, guild) {
  const db = readDatabase();
  const info = getStorageInfo();
  const settings = getSettings();
  // Важно: health-check не должен делать REST-запросы к Discord.
  // На некоторых сетях Node.js может ловить ConnectTimeoutError при fetchMe(),
  // из-за чего /dbstatus падал даже когда бот уже онлайн.
  // Используем только кэш Discord.js. Если данных нет — показываем понятную подсказку.
  const botMember = guild
    ? (guild.members.me || guild.members.cache.get(client?.user?.id) || null)
    : null;
  const checks = [];

  checks.push(check(info.driver === 'sqlite', `База данных SQLite активна${info.sqliteEngine ? ` (${info.sqliteEngine})` : ''}`, info.driver === 'sqlite' ? info.sqlitePath : `Используется fallback: ${info.sqliteUnavailableReason || 'JSON'}`));
  checks.push(check(Object.keys(db.users || {}).length >= 0, 'База пользователей читается'));
  checks.push(check(findTextChannel(guild, settings.logChannelName || '🛡・лог-модерации'), `Канал логов: ${settings.logChannelName || '🛡・лог-модерации'}`));
  checks.push(check(findTextChannel(guild, settings.eventsChannelName || '📅・ивенты'), `Канал ивентов: ${settings.eventsChannelName || '📅・ивенты'}`));
  checks.push(check(findTextChannel(guild, settings.miniGamesChannelName || '🎲・мини-игры'), `Канал мини-игр: ${settings.miniGamesChannelName || '🎲・мини-игры'}`));
  checks.push(check(findTextOrForumChannel(guild, settings.applicationsChannelName || '📨・заявки', process.env.APPLICATIONS_CHANNEL_ID), `Канал заявок: ${settings.applicationsChannelName || '📨・заявки'}`, process.env.APPLICATIONS_CHANNEL_ID ? `ID: ${process.env.APPLICATIONS_CHANNEL_ID}` : 'Можно указать APPLICATIONS_CHANNEL_ID'));
  checks.push(check(findVoiceChannel(guild, '➕・создать-комнату'), 'Voice-триггер: ➕・создать-комнату', 'Создай через /voice setup'));
  checks.push(check(Boolean(botMember), 'Данные роли бота доступны в кэше', 'Перезапусти бота или проверь, что он находится на сервере'));
  checks.push(check(botMember?.permissions.has(PermissionFlagsBits.ManageChannels), 'У бота есть Manage Channels', 'Нужно для voice-комнат, тикетов и LFG'));
  checks.push(check(botMember?.permissions.has(PermissionFlagsBits.ManageMessages), 'У бота есть Manage Messages', 'Нужно для /clear и AutoMod'));
  checks.push(check(botMember?.permissions.has(PermissionFlagsBits.ModerateMembers), 'У бота есть Moderate Members', 'Нужно для /mute'));
  checks.push(check(String(process.env.WEB_PANEL_ENABLED || 'true').toLowerCase() !== 'false', 'Веб-панель включена', 'WEB_PANEL_ENABLED=false отключит панель'));
  checks.push(check((process.env.WEB_PASSWORD || '') !== 'admin', 'WEB_PASSWORD не admin', 'На хостинге задай надежный пароль'));
  checks.push(check((process.env.WEB_SESSION_TOKEN || '').length >= 24, 'WEB_SESSION_TOKEN достаточно длинный', 'Минимум 24 символа'));
  checks.push(check(String(process.env.TEST_MODE || 'false').toLowerCase() !== 'true', 'TEST_MODE выключен', 'В production лучше выключить'));

  const backupsPath = require('node:path').join(process.cwd(), 'data', 'backups');
  checks.push(check(fs.existsSync(backupsPath), 'Папка бэкапов доступна', 'Создай первый бэкап через /backup create'));
  const hosting = buildHostingReadiness();
  checks.push(check(hosting.okCount >= Math.max(1, hosting.total - 2), `Готовность к хостингу: ${hosting.okCount}/${hosting.total}`, 'Подробно: /hosting-check или npm run hosting:check'));

  const okCount = checks.filter(item => item.ok).length;
  return { checks, okCount, total: checks.length, driver: info.driver, sqlitePath: info.sqlitePath, users: Object.keys(db.users || {}).length };
}

function formatHealthLines(report) {
  return report.checks.map(item => `${item.ok ? '✅' : '⚠️'} ${item.label}${item.hint && !item.ok ? ` — ${item.hint}` : ''}`).join('\n');
}

module.exports = { buildHealthReport, formatHealthLines };
