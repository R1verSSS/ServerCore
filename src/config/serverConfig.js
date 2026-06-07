// Central configuration for names and default values used across ServerCore.
// Keep IDs/secrets in .env. Keep readable defaults here.

const CHANNELS = {
  rules: '📜・правила',
  announcements: '📢・объявления',
  navigation: '🧭・навигация',
  roles: '✅・получить-роли',
  botCommands: '🤖・команды-бота',
  musicText: '🎵・музыка-бот',
  commands: '📚・частые-вопросы',
  shopFront: '🛍・витрина',
  inventory: '🎒・инвентарь',
  gifts: '🎁・подарки',
  premium: '💎・premium',
  moderationCommands: '🤖・команды-модерации',
  miniGames: '🎲・мини-игры',
  events: '📅・ивенты',
  lfg: '🎮・поиск-напарников',
  ticketCreate: '🎫・создать-тикет',
  tickets: '📁・тикеты',
  logs: '📋・лог-модерации',
  applications: '📥・заявки',
  suggestions: '💡・предложения',
  moderationPanel: '🧰・панель-модерации',
  tempVoiceCreate: '➕・создать-комнату',
};

const CATEGORIES = {
  important: '📌 ВАЖНОЕ',
  chat: '💬 ОБЩЕНИЕ',
  bot: '🤖 БОТ И АКТИВНОСТИ',
  games: '🎮 ИГРЫ',
  shop: '🛒 МАГАЗИН',
  projects: '💻 ПРОЕКТЫ И IT',
  support: '🎫 ПОДДЕРЖКА',
  voice: '🔊 ГОЛОСОВЫЕ',
  moderation: '🛡 МОДЕРАЦИЯ',
};

const ROLES = {
  admin: '🛡 Admin', moderator: '👮 Moderator', vip: '💎 VIP', active: '🔥 Active', gamer: '🎮 Gamer',
  developer: '💻 Developer', creator: '🎨 Creator', music: '🎵 Music', newbie: '🆕 Newbie',
};

const DEFAULTS = { xpPerMessage: 5, xpCooldownSeconds: 60, dailyCoins: 100, dailyXp: 25, dailyCooldownHours: 24, backupKeep: 14, exportsKeepDays: 14, logsKeepDays: 14 };
const DANGEROUS_COMMANDS = ['ban', 'kick', 'clear', 'backup', 'maintenance'];
module.exports = { CHANNELS, CATEGORIES, ROLES, DEFAULTS, DANGEROUS_COMMANDS };
