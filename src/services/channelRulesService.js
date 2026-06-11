const { readDatabase, writeDatabase } = require('./dataStore');
const { DEFAULT_PROTECTED_CHANNELS } = require('./protectedChannelService');

const DEFAULT_RULES = [
  ...DEFAULT_PROTECTED_CHANNELS.map(name => ({ name, mode: 'panel_only', deleteMessages: true, allowLinks: true, allowAttachments: true, warnUser: true })),
  { name: '🎵・музыка', mode: 'music_only', deleteMessages: false, allowLinks: true, allowAttachments: false, warnUser: false },
  { name: '💬・общий-чат', mode: 'free', deleteMessages: false, allowLinks: true, allowAttachments: true, warnUser: false },
];

function normalizeRule(name, rule = {}) {
  return {
    name,
    mode: rule.mode || 'free',
    deleteMessages: rule.deleteMessages === true,
    allowLinks: rule.allowLinks !== false,
    allowAttachments: rule.allowAttachments !== false,
    warnUser: rule.warnUser !== false,
    updatedAt: rule.updatedAt || null,
  };
}

function getChannelRules() {
  const db = readDatabase();
  const stored = db.channelRules || {};
  const result = {};
  for (const rule of DEFAULT_RULES) result[rule.name] = normalizeRule(rule.name, rule);
  for (const [name, rule] of Object.entries(stored)) result[name] = normalizeRule(name, rule);
  return result;
}

function getRuleForChannel(name) {
  return getChannelRules()[name] || normalizeRule(name, {});
}

function setChannelRule(name, patch) {
  const db = readDatabase();
  db.channelRules = db.channelRules || {};
  db.channelRules[name] = normalizeRule(name, { ...(db.channelRules[name] || {}), ...patch, updatedAt: new Date().toISOString() });
  writeDatabase(db);
  return db.channelRules[name];
}

function listChannelRules() {
  return Object.values(getChannelRules()).sort((a, b) => a.name.localeCompare(b.name));
}

function isMusicAllowedMessage(content = '') {
  return /https?:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//i.test(content) || /^\s*\/music\b/i.test(content);
}

module.exports = { DEFAULT_RULES, getChannelRules, getRuleForChannel, setChannelRule, listChannelRules, isMusicAllowedMessage };
