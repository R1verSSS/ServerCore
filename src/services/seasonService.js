const { readDatabase, writeDatabase, getUsers } = require('./dataStore');
const { getSettings, updateSettings } = require('./settingsService');

function getSeason() {
  const settings = getSettings();
  return {
    name: settings.seasonName || 'Сезон 1',
    active: Boolean(settings.seasonActive),
    endsAt: settings.seasonEndsAt || null,
  };
}

function startSeason(name, days = 30) {
  const endsAt = new Date(Date.now() + Math.max(Number(days) || 30, 1) * 24 * 60 * 60 * 1000).toISOString();
  updateSettings({ seasonName: name || 'Новый сезон', seasonActive: true, seasonEndsAt: endsAt });
  const db = readDatabase();
  for (const user of Object.values(db.users || {})) {
    user.seasonXp = 0;
    if (!user.seasonRewardClaims || typeof user.seasonRewardClaims !== 'object') user.seasonRewardClaims = {};
  }
  writeDatabase(db);
  return getSeason();
}

function stopSeason() { updateSettings({ seasonActive: false }); return getSeason(); }
function seasonTop(limit = 10) { return getUsers().sort((a,b)=>(b.seasonXp||0)-(a.seasonXp||0)).slice(0, limit); }

function getRemainingText(endsAt) {
  if (!endsAt) return 'не указано';
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'сезон завершился';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  return `${days} дн. ${hours} ч.`;
}

module.exports = { getSeason, startSeason, stopSeason, seasonTop, getRemainingText };
