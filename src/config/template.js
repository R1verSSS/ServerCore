const { ChannelType, PermissionsBitField } = require('discord.js');

const roles = [
  { name: '👑 Owner', color: '#FFD700', permissions: [] },
  { name: '🛡 Admin', color: '#E74C3C', permissions: [PermissionsBitField.Flags.Administrator] },
  { name: '👮 Moderator', color: '#3498DB', permissions: [PermissionsBitField.Flags.ManageMessages, PermissionsBitField.Flags.KickMembers, PermissionsBitField.Flags.ModerateMembers] },
  { name: '🧰 Helper', color: '#45B7D1', permissions: [PermissionsBitField.Flags.ViewAuditLog] },
  { name: '🤖 Bot', color: '#9B59B6', permissions: [] },
  { name: '💎 VIP', color: '#1ABC9C', permissions: [] },
  { name: '🔥 Active', color: '#E67E22', permissions: [] },
  { name: '🎮 Gamer', color: '#2ECC71', permissions: [] },
  { name: '💻 Developer', color: '#5865F2', permissions: [] },
  { name: '🎨 Creator', color: '#F1C40F', permissions: [] },
  { name: '🎵 Music', color: '#95A5A6', permissions: [] },
  { name: '🆕 Newbie', color: '#B2BABB', permissions: [] },
  { name: 'Уровень 5 — Активный', color: '#57F287', permissions: [] },
  { name: 'Уровень 10 — Свой', color: '#FEE75C', permissions: [] },
  { name: 'Уровень 20 — Легенда', color: '#EB459E', permissions: [] }
];

const selfAssignableRoles = [
  { roleName: '🎮 Gamer', label: 'Gamer', emoji: '🎮', description: 'Игры и поиск команды' },
  { roleName: '💻 Developer', label: 'Developer', emoji: '💻', description: 'Код, проекты и IT' },
  { roleName: '🎨 Creator', label: 'Creator', emoji: '🎨', description: 'Творчество и контент' },
  { roleName: '🎵 Music', label: 'Music', emoji: '🎵', description: 'Музыка и обсуждения' }
];

const categories = [
  {
    name: '📌 ВАЖНОЕ',
    channels: [
      { name: '📜・правила', type: ChannelType.GuildText, topic: 'Правила поведения на сервере.' },
      { name: '📢・объявления', type: ChannelType.GuildText, topic: 'Важные объявления администрации.' },
      { name: '🧭・навигация', type: ChannelType.GuildText, topic: 'Карта каналов и возможностей сервера.' },
      { name: '✅・получить-роли', type: ChannelType.GuildText, topic: 'Выбор ролей по интересам.' },
      { name: '📚・команды', type: ChannelType.GuildText, topic: 'Справочник пользовательских команд и панелей.' },
      { name: '🆕・новости-сервера', type: ChannelType.GuildText, topic: 'Обновления сервера и бота.' }
    ]
  },
  {
    name: '💬 ОБЩЕНИЕ',
    channels: [
      { name: '💬・общий-чат', type: ChannelType.GuildText, topic: 'Основной чат сервера.' },
      { name: '😂・мемы', type: ChannelType.GuildText, topic: 'Мемы и смешной контент.' },
      { name: '📷・скрины-и-фото', type: ChannelType.GuildText, topic: 'Скриншоты, фото и изображения.' },
      { name: '🎵・музыка', type: ChannelType.GuildText, topic: 'Музыкальные обсуждения.' },
      { name: '🤖・команды-бота', type: ChannelType.GuildText, topic: 'Канал для команд бота.' },
      { name: '💡・предложения', type: ChannelType.GuildText, topic: 'Предложения пользователей и голосования.' }
    ]
  },
  {
    name: '🛒 МАГАЗИН',
    channels: [
      { name: '🛍・витрина', type: ChannelType.GuildText, topic: 'Кнопочная витрина магазина сервера.' },
      { name: '🎒・инвентарь', type: ChannelType.GuildText, topic: 'Информация об инвентаре и использовании предметов.' },
      { name: '🎁・подарки', type: ChannelType.GuildText, topic: 'Подарки, передача монет и предметов.' },
      { name: '💎・premium', type: ChannelType.GuildText, topic: 'VIP, Premium Battle Pass, бусты и косметика.' }
    ]
  },
  {
    name: '🎮 ИГРЫ И АКТИВНОСТИ',
    channels: [
      { name: '🎮・поиск-команды', type: ChannelType.GuildText, topic: 'Поиск людей для совместных игр.' },
      { name: '🏆・турниры', type: ChannelType.GuildText, topic: 'Турниры и соревнования.' },
      { name: '🏰・кланы', type: ChannelType.GuildText, topic: 'Кланы, команды и рейтинги.' },
      { name: '📅・ивенты', type: ChannelType.GuildText, topic: 'Анонсы ивентов.' },
      { name: '🎲・мини-игры', type: ChannelType.GuildText, topic: 'Мини-игры и активности.' }
    ]
  },
  {
    name: '💻 ПРОЕКТЫ И IT',
    channels: [
      { name: '💻・программирование', type: ChannelType.GuildText, topic: 'Обсуждение программирования.' },
      { name: '🛠・помощь-с-кодом', type: ChannelType.GuildText, topic: 'Помощь с ошибками и кодом.' },
      { name: '📚・полезные-материалы', type: ChannelType.GuildText, topic: 'Полезные ссылки и материалы.' },
      { name: '🚀・проекты-участников', type: ChannelType.GuildText, topic: 'Демонстрация проектов участников.' }
    ]
  },
  {
    name: '🔊 ГОЛОСОВЫЕ',
    channels: [
      { name: '➕・создать-комнату', type: ChannelType.GuildVoice },
      { name: '🔊・общий войс', type: ChannelType.GuildVoice },
      { name: '🎮・игровая комната 1', type: ChannelType.GuildVoice },
      { name: '🎮・игровая комната 2', type: ChannelType.GuildVoice },
      { name: '🎧・чилл', type: ChannelType.GuildVoice },
      { name: '🎵・музыка', type: ChannelType.GuildVoice }
    ]
  },
  {
    name: '🛡 МОДЕРАЦИЯ',
    private: true,
    channels: [
      { name: '🛡・лог-модерации', type: ChannelType.GuildText, topic: 'Логи действий модерации.' },
      { name: '🧰・панель-модерации', type: ChannelType.GuildText, topic: 'Панель управления модерацией.' },
      { name: '📘・команды-модерации', type: ChannelType.GuildText, topic: 'Закрытый справочник команд модерации.' },
      { name: '📨・заявки', type: ChannelType.GuildText, topic: 'Заявки пользователей.' },
      { name: '🚨・жалобы', type: ChannelType.GuildText, topic: 'Жалобы и обращения.' },
      { name: '📂・тикеты', type: ChannelType.GuildText, topic: 'История и управление тикетами.' },
      { name: '👮・чат-модеров', type: ChannelType.GuildText, topic: 'Закрытый чат модераторов.' }
    ]
  }
];

module.exports = { roles, selfAssignableRoles, categories };
