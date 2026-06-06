const { readDatabase, writeDatabase, getStorageInfo } = require('./dataStore');
const { listBackups } = require('./backupService');

const MODULES = [
  { key: 'profiles', icon: '👤', label: 'Профили', env: null, description: 'Профили, ранги, карточки и достижения.' },
  { key: 'economy', icon: '💰', label: 'Экономика', env: null, description: 'Баланс, daily, награды и история экономики.' },
  { key: 'shop', icon: '🛒', label: 'Магазин', env: null, description: 'Витрина, покупки, инвентарь и premium-раздел.' },
  { key: 'tickets', icon: '🎫', label: 'Тикеты', env: null, description: 'Поддержка, обращения и закрытие тикетов.' },
  { key: 'moderation', icon: '🛡️', label: 'Модерация', env: null, description: 'Warn/mute/ban/cases/notes/appeals.' },
  { key: 'automod', icon: '🤖', label: 'AutoMod', env: null, description: 'Автоматическая защита от спама и нарушений.' },
  { key: 'tempVoice', icon: '🔊', label: 'Voice-комнаты', env: null, description: 'Временные голосовые комнаты и панели управления.' },
  { key: 'music', icon: '🎵', label: 'Музыка', env: 'MUSIC_ENABLED', description: 'YouTube-аудио в voice-каналах. Для работы нужен хостинг/VPS с Discord Voice/UDP.' },
  { key: 'events', icon: '📅', label: 'Ивенты', env: null, description: 'События, участники и уведомления.' },
  { key: 'tournaments', icon: '🏆', label: 'Турниры', env: null, description: 'Турнирные сетки и управление турнирами.' },
  { key: 'clans', icon: '🏰', label: 'Кланы', env: null, description: 'Кланы, заявки и участники.' },
  { key: 'backups', icon: '💾', label: 'Бэкапы', env: null, description: 'Резервные копии, экспорт и восстановление.' },
];

function envBool(name, fallback = true) {
  if (!name) return fallback;
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  return String(raw).toLowerCase() === 'true';
}

function getModuleSettings() {
  const db = readDatabase();
  const settings = db.moduleSettings || {};
  return Object.fromEntries(MODULES.map(module => {
    const stored = settings[module.key] || {};
    const envEnabled = module.env ? envBool(module.env, stored.enabled !== false) : stored.enabled !== false;
    return [module.key, { enabled: envEnabled, ...stored, enabled: envEnabled }];
  }));
}

function isModuleEnabled(key) {
  return getModuleSettings()[key]?.enabled !== false;
}

function setModuleEnabled(key, enabled) {
  const db = readDatabase();
  db.moduleSettings = db.moduleSettings || {};
  db.moduleSettings[key] = { ...(db.moduleSettings[key] || {}), enabled: Boolean(enabled), updatedAt: new Date().toISOString() };
  writeDatabase(db);
  return db.moduleSettings[key];
}

function buildModuleStatus(client) {
  const settings = getModuleSettings();
  const storage = getStorageInfo();
  const backups = listBackups();
  return MODULES.map(module => {
    const enabled = settings[module.key]?.enabled !== false;
    let state = enabled ? 'ok' : 'disabled';
    let hint = enabled ? 'Включен' : 'Отключен';

    if (module.key === 'music') {
      if (!enabled) {
        state = 'disabled';
        hint = 'Отключен через MUSIC_ENABLED=false или веб-панель. Для Bothost это безопасный режим.';
      } else if (process.env.MUSIC_HOSTING_WARNING !== 'false') {
        state = 'warn';
        hint = 'Может требовать VPS/UDP. Если voice зависает на signalling — хостинг не поддерживает Discord Voice.';
      }
    }
    if (module.key === 'backups' && backups.length === 0) {
      state = 'warn';
      hint = 'Создай первый backup после настройки хостинга.';
    }
    if (module.key === 'automod' && String(process.env.MESSAGE_CONTENT_INTENT_WARNING || 'true') !== 'false') {
      hint = 'Проверь Message Content Intent в Discord Developer Portal.';
    }
    return { ...module, enabled, state, hint, storageDriver: storage.driver };
  });
}

module.exports = { MODULES, getModuleSettings, isModuleEnabled, setModuleEnabled, buildModuleStatus };
