const fs = require('node:fs');
const path = require('node:path');
const { getStorageInfo } = require('./dataStore');

function ok(label, hint = '') { return { ok: true, label, hint }; }
function warn(label, hint = '') { return { ok: false, label, hint }; }

function mask(value) {
  if (!value) return 'не задано';
  const s = String(value);
  return s.length <= 8 ? 'задано' : `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function buildHostingReadiness() {
  const checks = [];
  const info = getStorageInfo();
  const env = process.env;

  checks.push(env.DISCORD_TOKEN ? ok('DISCORD_TOKEN задан', `значение: ${mask(env.DISCORD_TOKEN)}`) : warn('DISCORD_TOKEN не задан', 'Добавь токен бота в переменные окружения хостинга.'));
  checks.push(env.CLIENT_ID ? ok('CLIENT_ID задан') : warn('CLIENT_ID не задан', 'Нужен для deploy slash-команд.'));
  checks.push(env.GUILD_ID ? ok('GUILD_ID задан') : warn('GUILD_ID не задан', 'Нужен для guild deploy и setup.'));
  checks.push(info.driver === 'sqlite' ? ok('SQLite активен', info.sqlitePath) : warn('SQLite не активен', info.sqliteUnavailableReason || 'Проверь DB_DRIVER и SQLITE_PATH.'));
  checks.push(fs.existsSync(path.join(process.cwd(), 'data')) ? ok('Папка data существует') : warn('Папка data отсутствует', 'Создай data/ или запусти миграцию.'));
  checks.push(fs.existsSync(path.join(process.cwd(), 'data', 'backups')) ? ok('Папка backups существует') : warn('Папка backups отсутствует', 'Создай первый бэкап или папку data/backups.'));
  checks.push(String(env.WEB_PANEL_ENABLED || 'true').toLowerCase() !== 'false' ? ok('Веб-панель включена') : warn('Веб-панель выключена', 'WEB_PANEL_ENABLED=false.'));
  checks.push(env.WEB_PASSWORD && env.WEB_PASSWORD !== 'admin' ? ok('WEB_PASSWORD изменен') : warn('WEB_PASSWORD слабый или admin', 'На хостинге обязательно задай сложный пароль.'));
  checks.push(env.WEB_SESSION_TOKEN && String(env.WEB_SESSION_TOKEN).length >= 24 ? ok('WEB_SESSION_TOKEN достаточно длинный') : warn('WEB_SESSION_TOKEN короткий', 'Используй длинную случайную строку минимум 24 символа.'));
  checks.push(String(env.TEST_MODE || 'false').toLowerCase() !== 'true' ? ok('TEST_MODE выключен') : warn('TEST_MODE включен', 'Для production лучше выключить.'));
  checks.push(Number(env.DISCORD_REST_TIMEOUT || 60000) >= 30000 ? ok('Discord REST timeout настроен') : warn('Discord REST timeout слишком мал', 'Рекомендуется 60000–90000 для нестабильных сетей.'));

  const okCount = checks.filter(c => c.ok).length;
  return { checks, okCount, total: checks.length };
}

module.exports = { buildHostingReadiness };
