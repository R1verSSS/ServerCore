const { readDatabase, writeDatabase } = require('./dataStore');

const DEFAULT_TICKET_TEMPLATES = [
  { id: 'tech', label: 'Тех. проблема', emoji: '🛠️', description: 'Ошибка, баг, проблема с ботом или сервером', prompt: 'Опиши проблему, что ожидалось и что произошло.' },
  { id: 'complaint', label: 'Жалоба', emoji: '🚨', description: 'Жалоба на пользователя или нарушение', prompt: 'Укажи пользователя, канал, время и приложи доказательства.' },
  { id: 'question', label: 'Вопрос', emoji: '❓', description: 'Общий вопрос к администрации', prompt: 'Задай вопрос максимально подробно.' },
  { id: 'application', label: 'Заявка', emoji: '📨', description: 'Заявка на роль, участие или доступ', prompt: 'Укажи, на что подается заявка и почему.' },
  { id: 'partner', label: 'Партнерство', emoji: '🤝', description: 'Предложение партнерства или сотрудничества', prompt: 'Опиши проект, аудиторию и формат сотрудничества.' },
  { id: 'other', label: 'Другое', emoji: '📌', description: 'Любая другая тема', prompt: 'Опиши обращение.' }
];

const PANEL_DEFINITIONS = [
  { id: 'main', label: '🧭 Главное меню', channel: '🧭・навигация' },
  { id: 'roles', label: '✅ Панель ролей', channel: '✅・получить-роли' },
  { id: 'shop', label: '🛒 Магазин', channel: '🛍・витрина' },
  { id: 'games', label: '🎲 Мини-игры', channel: '🎲・мини-игры' },
  { id: 'tickets', label: '🎫 Тикеты', channel: '🎫・создать-тикет' },
  { id: 'moderation', label: '🧰 Модерация', channel: '🧰・панель-модерации' },
  { id: 'commands', label: '📚 Все команды', channel: '📚・команды' },
  { id: 'modcommands', label: '📘 Команды модерации', channel: '📘・команды-модерации' },
  { id: 'voice', label: '🔊 Voice-комнаты', channel: '➕・создать-комнату' },
  { id: 'music', label: '🎵 Музыка', channel: '🎵・музыка' }
];

function ensureManagementDb(db) {
  if (!Array.isArray(db.economyHistory)) db.economyHistory = [];
  if (!db.ticketTemplates || typeof db.ticketTemplates !== 'object') db.ticketTemplates = {};
  if (!db.panelRegistry || typeof db.panelRegistry !== 'object') db.panelRegistry = {};
  if (!db.onboardingProgress || typeof db.onboardingProgress !== 'object') db.onboardingProgress = {};
  if (!db.shopDeals || typeof db.shopDeals !== 'object') db.shopDeals = {};
  return db;
}

function getTicketTemplates() {
  const db = ensureManagementDb(readDatabase());
  const custom = Object.values(db.ticketTemplates || {});
  const merged = new Map(DEFAULT_TICKET_TEMPLATES.map(t => [t.id, t]));
  for (const item of custom) if (item && item.id) merged.set(item.id, { ...merged.get(item.id), ...item });
  return Array.from(merged.values()).filter(t => t.enabled !== false);
}

function getTicketTemplate(id) {
  return getTicketTemplates().find(t => t.id === id) || getTicketTemplates().find(t => t.id === 'other');
}

function recordEconomy(userId, username, type, amount, meta = {}) {
  const db = ensureManagementDb(readDatabase());
  db.economyHistory.push({
    id: db.economyHistory.length + 1,
    userId,
    username,
    type,
    amount: Number(amount || 0),
    meta,
    createdAt: new Date().toISOString()
  });
  db.economyHistory = db.economyHistory.slice(-1000);
  writeDatabase(db);
}

function getEconomyHistory(userId = null, limit = 25) {
  const db = ensureManagementDb(readDatabase());
  let rows = db.economyHistory || [];
  if (userId) rows = rows.filter(row => row.userId === userId);
  return rows.slice(-limit).reverse();
}

function registerPanelPublish(type, channelId, channelName, actor = 'web/setup') {
  const db = ensureManagementDb(readDatabase());
  db.panelRegistry[type] = {
    type,
    channelId,
    channelName,
    actor,
    updatedAt: new Date().toISOString(),
    status: 'published'
  };
  writeDatabase(db);
  return db.panelRegistry[type];
}

function getPanelRegistry(guild = null) {
  const db = ensureManagementDb(readDatabase());
  return PANEL_DEFINITIONS.map(panel => {
    const saved = db.panelRegistry?.[panel.id] || null;
    const channel = guild?.channels?.cache?.find(ch => ch.name === panel.channel) || (saved?.channelId ? guild?.channels?.cache?.get(saved.channelId) : null);
    return {
      ...panel,
      channelId: saved?.channelId || channel?.id || '',
      channelName: saved?.channelName || channel?.name || panel.channel,
      publishedAt: saved?.updatedAt || null,
      status: saved ? 'published' : channel ? 'channel_found' : 'missing'
    };
  });
}

function getRoleUsage(roleName) {
  const name = String(roleName || '');
  const usage = [];
  if (['👑 Owner','🛡 Admin','👮 Moderator','🧰 Helper','💎 VIP'].includes(name)) usage.push('доступ');
  if (['💎 VIP','🔥 Active','🎨 Creator','🎮 Gamer','💻 Developer','🎵 Music'].includes(name)) usage.push('магазин/роли');
  if (/level|уровень|active|legend|trusted/i.test(name)) usage.push('уровни');
  if (/season|battle pass|premium/i.test(name)) usage.push('сезон');
  return usage.length ? usage.join(', ') : '—';
}

function markOnboarding(userId, step) {
  const db = ensureManagementDb(readDatabase());
  const current = db.onboardingProgress[userId] || { userId, steps: {}, createdAt: new Date().toISOString() };
  current.steps[step] = new Date().toISOString();
  current.updatedAt = new Date().toISOString();
  db.onboardingProgress[userId] = current;
  writeDatabase(db);
  return current;
}

function getOnboardingProgress(userId) {
  const db = ensureManagementDb(readDatabase());
  return db.onboardingProgress?.[userId] || { userId, steps: {} };
}

function getDailyDeal(items = []) {
  const enabled = String(process.env.SHOP_DAILY_DEAL_ENABLED || 'true').toLowerCase() !== 'false';
  if (!enabled || !items.length) return null;
  const dateKey = new Date().toISOString().slice(0, 10);
  const sum = dateKey.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const item = items[sum % items.length];
  const discountPercent = Math.max(0, Math.min(Number(process.env.SHOP_DAILY_DEAL_DISCOUNT || 20), 80));
  return { itemId: item.id, discountPercent, dateKey };
}

function applyDailyDealPrice(item, items = []) {
  const deal = getDailyDeal(items);
  if (!deal || deal.itemId !== item.id) return { price: item.price, originalPrice: item.price, isDailyDeal: false, discountPercent: 0 };
  const price = Math.max(Math.floor(Number(item.price || 0) * (100 - deal.discountPercent) / 100), 1);
  return { price, originalPrice: item.price, isDailyDeal: true, discountPercent: deal.discountPercent };
}

module.exports = {
  DEFAULT_TICKET_TEMPLATES,
  PANEL_DEFINITIONS,
  ensureManagementDb,
  getTicketTemplates,
  getTicketTemplate,
  recordEconomy,
  getEconomyHistory,
  registerPanelPublish,
  getPanelRegistry,
  getRoleUsage,
  markOnboarding,
  getOnboardingProgress,
  getDailyDeal,
  applyDailyDealPrice
};
