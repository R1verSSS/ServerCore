const { readDatabase, writeDatabase } = require('./dataStore');


const SETTINGS_DESCRIPTIONS = {
  xpPerMessage: 'Сколько XP получает участник за сообщение.',
  xpCooldownSeconds: 'Минимальная пауза между начислением XP за сообщения. Рекомендовано: 60 секунд.',
  dailyCoins: 'Сколько монет выдает /daily.',
  dailyXp: 'Сколько XP выдает /daily.',
  dailyCooldownHours: 'Через сколько часов снова доступна /daily.',
  automodEnabled: 'Главный переключатель автоматической модерации.',
  automodAntiSpam: 'Удаляет повторяющиеся/частые сообщения и помогает бороться со спамом.',
  automodAntiCaps: 'Реагирует на сообщения с чрезмерным количеством заглавных букв.',
  automodBlockLinks: 'Блокирует ссылки от обычных участников, если включено.',
  automodMaxMentions: 'Максимальное число упоминаний в одном сообщении.',
  automodMutedMinutes: 'На сколько минут ограничивать пользователя при серьезном нарушении.',
  automodForbiddenWords: 'Список запрещенных слов через запятую.',
  logChannelName: 'Канал для логов модерации и системных действий.',
  eventsChannelName: 'Канал, куда публикуются карточки ивентов.',
  miniGamesChannelName: 'Канал для панели мини-игр.',
  moderationPanelChannelName: 'Канал для модераторской панели.',
  applicationsChannelName: 'Канал для заявок пользователей.',
  applicationsChannelId: 'ID канала заявок. Поддерживаются текстовые и Forum-каналы.',
  ticketActiveCategoryName: 'Категория для активных приватных тикетов поддержки.',
  ticketActiveCategoryId: 'ID категории для активных тикетов. Если пусто, используется имя категории.',
  ticketArchiveChannelName: 'Канал или Forum для архива закрытых тикетов.',
  ticketArchiveChannelId: 'ID канала или Forum для архива закрытых тикетов.',
  tournamentsChannelName: 'Канал для турниров.',
  seasonName: 'Название текущего сезона.',
  seasonActive: 'Включен ли сезонный прогресс.',
  seasonEndsAt: 'Дата завершения сезона.',
};

const DEFAULT_SETTINGS = {
  xpPerMessage: 5,
  xpCooldownSeconds: 60,
  dailyCoins: 100,
  dailyXp: 25,
  dailyCooldownHours: 24,
  automodEnabled: false,
  automodAntiSpam: true,
  automodAntiCaps: true,
  automodBlockLinks: false,
  automodMaxMentions: 6,
  automodMutedMinutes: 10,
  automodForbiddenWords: [],
  logChannelName: '🛡・лог-модерации',
  eventsChannelName: '📅・ивенты',
  miniGamesChannelName: '🎲・мини-игры',
  moderationPanelChannelName: '🧰・панель-модерации',
  applicationsChannelName: '📨・заявки',
  applicationsChannelId: process.env.APPLICATIONS_CHANNEL_ID || '1512791242000564229',
  ticketActiveCategoryName: process.env.TICKET_ACTIVE_CATEGORY_NAME || '🎫 ПОДДЕРЖКА',
  ticketActiveCategoryId: process.env.TICKET_ACTIVE_CATEGORY_ID || '',
  ticketArchiveChannelName: process.env.TICKET_ARCHIVE_CHANNEL_NAME || '📁・тикеты',
  ticketArchiveChannelId: process.env.TICKET_ARCHIVE_CHANNEL_ID || '',
  tournamentsChannelName: '🏆・турниры',
  seasonName: 'Сезон 1',
  seasonActive: false,
  seasonEndsAt: null,
};

function ensureSettings(db) {
  if (!db.settings) db.settings = { ...DEFAULT_SETTINGS };
  db.settings = { ...DEFAULT_SETTINGS, ...db.settings };
  return db.settings;
}

function getSettings() {
  const db = readDatabase();
  const settings = ensureSettings(db);
  writeDatabase(db);
  return settings;
}

function updateSettings(patch) {
  const db = readDatabase();
  const settings = ensureSettings(db);
  db.settings = { ...settings, ...patch };
  writeDatabase(db);
  return db.settings;
}

function setSetting(key, rawValue) {
  const current = getSettings();
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
    return { ok: false, reason: 'unknown_key' };
  }

  const defaultValue = DEFAULT_SETTINGS[key];
  let value = rawValue;
  if (typeof defaultValue === 'number') {
    value = Number(rawValue);
    if (!Number.isFinite(value)) return { ok: false, reason: 'invalid_number' };
  }
  if (typeof defaultValue === 'boolean') {
    value = ['true', '1', 'yes', 'on', 'вкл', 'да'].includes(String(rawValue).toLowerCase());
  }
  if (Array.isArray(defaultValue)) {
    value = String(rawValue || '').split(',').map(item => item.trim()).filter(Boolean);
  }

  return { ok: true, settings: updateSettings({ [key]: value }), key, value };
}

function formatSettings(settings = getSettings()) {
  return Object.entries(settings)
    .map(([key, value]) => {
      const desc = SETTINGS_DESCRIPTIONS[key] ? ` — ${SETTINGS_DESCRIPTIONS[key]}` : '';
      return `**${key}**: ${Array.isArray(value) ? value.join(', ') || '-' : String(value)}${desc}`;
    })
    .join('\n');
}

module.exports = {
  DEFAULT_SETTINGS,
  SETTINGS_DESCRIPTIONS,
  getSettings,
  updateSettings,
  setSetting,
  formatSettings,
};
