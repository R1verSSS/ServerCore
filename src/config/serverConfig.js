// Central configuration for names and default values used across ServerCore.
// Keep IDs/secrets in .env. Keep readable defaults here.

const CHANNELS = {
  rules: '📜・правила',
  announcements: '📢・объявления',
  navigation: '🧭・навигация',
  roles: '✅・получить-роли',
  botCommands: '🤖・команды-бота',
  miniGames: '🎲・мини-игры',
  events: '📅・ивенты',
  lfg: '🎮・поиск-команды',
  tickets: '📂・тикеты',
  logs: '🛡・лог-модерации',
  applications: '📨・заявки',
  suggestions: '💡・предложения',
  moderationPanel: '🧰・панель-модерации',
  tempVoiceCreate: '➕・создать-комнату',
};

const CATEGORIES = {
  important: '📌 ВАЖНОЕ',
  chat: '💬 ОБЩЕНИЕ',
  activities: '🎮 ИГРЫ И АКТИВНОСТИ',
  projects: '💻 ПРОЕКТЫ И IT',
  voice: '🔊 ГОЛОСОВЫЕ',
  moderation: '🛡 МОДЕРАЦИЯ',
};

const ROLES = {
  admin: '🛡 Admin',
  moderator: '👮 Moderator',
  vip: '💎 VIP',
  active: '🔥 Active',
  gamer: '🎮 Gamer',
  developer: '💻 Developer',
  creator: '🎨 Creator',
  music: '🎵 Music',
  newbie: '🆕 Newbie',
};

const DEFAULTS = {
  xpPerMessage: 5,
  xpCooldownSeconds: 60,
  dailyCoins: 100,
  dailyXp: 25,
  dailyCooldownHours: 24,
  backupKeep: 14,
  exportsKeepDays: 14,
  logsKeepDays: 14,
};

const DANGEROUS_COMMANDS = ['ban', 'kick', 'clear', 'backup', 'maintenance'];

module.exports = { CHANNELS, CATEGORIES, ROLES, DEFAULTS, DANGEROUS_COMMANDS };
