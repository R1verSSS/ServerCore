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
  { roleName: '🎮 Gamer', label: 'Gamer', emoji: '🎮', description: 'Игры и поиск напарников' },
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
      { name: '🆕・новости-сервера', type: ChannelType.GuildText, topic: 'Обновления сервера и бота.' }
    ]
  },
  {
    name: '💬 ОБЩЕНИЕ',
    channels: [
      { name: '💬・общий-чат', type: ChannelType.GuildText, topic: 'Основной чат сервера.' },
      { name: '🧵・темы-участников', type: ChannelType.GuildForum, topic: 'Личные темы, дневники и обсуждения участников.', tags: ['Личная тема', 'Проект', 'Обсуждение', 'Другое'], defaultReactionEmoji: { name: '🧵' } },
      { name: '📷・скрины-и-фото', type: ChannelType.GuildForum, topic: 'Скриншоты, фотографии и изображения отдельными темами.', tags: ['Скриншот', 'Фото', 'Мем', 'Другое'], defaultReactionEmoji: { name: '📷' } },
      { name: '💡・предложения', type: ChannelType.GuildForum, topic: 'Предложения пользователей отдельными темами.', tags: ['Идея', 'Улучшение', 'Баг', 'Принято', 'Отклонено'], defaultReactionEmoji: { name: '💡' } },
      { name: '😂・мемы', type: ChannelType.GuildText, topic: 'Мемы и смешной контент.' }
    ]
  },
  {
    name: '🤖 БОТ И АКТИВНОСТИ',
    aliases: ['🎮 ИГРЫ И АКТИВНОСТИ'],
    channels: [
      { name: '🤖・команды-бота', type: ChannelType.GuildText, topic: 'Главный центр команд, панелей и быстрых действий бота.' },
      { name: '🎵・музыка-бот', aliases: ['🎵・музыка'], type: ChannelType.GuildText, topic: 'Управление музыкальным ботом и музыкальная панель.' },
      { name: '🎲・мини-игры', type: ChannelType.GuildText, topic: 'Мини-игры и активности.' },
      { name: '🏆・турниры', type: ChannelType.GuildText, topic: 'Турниры и соревнования.' },
      { name: '📅・ивенты', type: ChannelType.GuildText, topic: 'Анонсы ивентов и событий.' }
    ]
  },
  {
    name: '🎮 ИГРЫ',
    channels: [
      { name: '🎮・поиск-напарников', aliases: ['🎮・поиск-команды'], type: ChannelType.GuildForum, topic: 'Поиск напарников и игровых групп отдельными темами.', tags: ['CS2', 'Minecraft', 'Valorant', 'GTA', 'Другое'], defaultReactionEmoji: { name: '🎮' } },
      { name: '🏰・кланы', type: ChannelType.GuildText, topic: 'Кланы, игровые сообщества и рейтинги.' }
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
    name: '💻 ПРОЕКТЫ И IT',
    channels: [
      { name: '💻・программирование', type: ChannelType.GuildText, topic: 'Обсуждение программирования.' },
      { name: '🛠・помощь-с-кодом', type: ChannelType.GuildForum, topic: 'Помощь с ошибками и кодом отдельными темами.', tags: ['JavaScript', 'Python', 'ABAP', 'Ошибка', 'Другое'], defaultReactionEmoji: { name: '🛠' } },
      { name: '📚・полезные-материалы', type: ChannelType.GuildText, topic: 'Полезные ссылки и материалы.' },
      { name: '🚀・проекты-участников', type: ChannelType.GuildForum, topic: 'Проекты участников отдельными темами.', tags: ['Проект', 'Идея', 'Нужна помощь', 'Релиз', 'Другое'], defaultReactionEmoji: { name: '🚀' } }
    ]
  },
  {
    name: '🎫 ПОДДЕРЖКА',
    channels: [
      { name: '❓・вопросы-и-помощь', type: ChannelType.GuildForum, topic: 'Вопросы и взаимопомощь отдельными темами.', tags: ['Вопрос', 'Ошибка', 'Discord', 'Бот', 'Другое'], defaultReactionEmoji: { name: '❓' } },
      { name: '🎫・создать-тикет', type: ChannelType.GuildText, topic: 'Создание приватного обращения в поддержку.' },
      { name: '📚・частые-вопросы', aliases: ['📚・команды'], type: ChannelType.GuildText, topic: 'Частые вопросы, полезные подсказки и справочник команд.' }
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
      { name: '🎵・музыкальная-комната', aliases: ['🎵・музыка'], type: ChannelType.GuildVoice }
    ]
  },
  {
    name: '🛡 МОДЕРАЦИЯ',
    private: true,
    channels: [
      { name: '📥・заявки', aliases: ['📨・заявки'], type: ChannelType.GuildForum, topic: 'Заявки пользователей отдельными темами.', tags: ['Модератор', 'Партнерство', 'Кастомная роль', 'Турнир', 'Другое'], defaultReactionEmoji: { name: '📥' } },
      { name: '🚨・жалобы', type: ChannelType.GuildForum, topic: 'Жалобы и обращения отдельными темами.', tags: ['Жалоба', 'Конфликт', 'Нарушение', 'Доказательства', 'Другое'], defaultReactionEmoji: { name: '🚨' } },
      { name: '📁・разборы-и-кейсы', type: ChannelType.GuildForum, topic: 'Сложные разборы и модераторские кейсы отдельными темами.', tags: ['Разбор', 'Апелляция', 'Конфликт', 'Закрыто', 'Другое'], defaultReactionEmoji: { name: '📁' } },
      { name: '🧰・панель-модерации', type: ChannelType.GuildText, topic: 'Панель управления модерацией.' },
      { name: '📋・лог-модерации', aliases: ['🛡・лог-модерации'], type: ChannelType.GuildText, topic: 'Логи действий модерации.' },
      { name: '📁・тикеты', aliases: ['📂・тикеты'], type: ChannelType.GuildText, topic: 'Архив и управление тикетами.' },
      { name: '👮・чат-модеров', type: ChannelType.GuildText, topic: 'Закрытый чат модераторов.' },
      { name: '🤖・команды-модерации', aliases: ['📘・команды-модерации'], type: ChannelType.GuildText, topic: 'Закрытый справочник команд модерации.' }
    ]
  }
];

module.exports = { roles, selfAssignableRoles, categories };
