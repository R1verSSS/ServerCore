const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');

const HELP_SECTIONS = {
  start: {
    title: '📚 Помощь по серверу',
    description: 'Выбери категорию в меню ниже. Так справка не перегружает чат и показывает только нужные команды.',
    fields: [
      { name: 'Новичку', value: '`/menu open` → `/me` → `/roles` → `/daily` → `/profile`', inline: false },
      { name: 'Главные панели', value: '`/menu open`, `/me`, `/roles`, `/gamepanel`, `/voice panel`, `/modpanel`', inline: false }
    ]
  },
  profile: {
    title: '👤 Профиль, XP и косметика',
    fields: [
      { name: 'Команды', value: '`/me`, `/profile`, `/rank`, `/top`, `/profilecard`, `/achievements`, `/badges`, `/profilecustomize`, `/cosmetics`' },
      { name: 'Что это дает', value: 'Показывает прогресс, уровень, бейджи, карточку профиля и оформление.' }
    ]
  },
  economy: {
    title: '💰 Экономика и магазин',
    fields: [
      { name: 'Команды', value: '`/daily`, `/balance`, `/shop`, `/buy`, `/inventory`, `/use`, `/gift`' },
      { name: 'Что это дает', value: 'Монеты, покупки, бусты, косметика, подарки и предметы.' }
    ]
  },
  activities: {
    title: '🎮 Активности',
    fields: [
      { name: 'Команды', value: '`/game`, `/gamepanel`, `/quest`, `/event`, `/lfg`, `/tournament`, `/season`, `/battlepass`' },
      { name: 'Что это дает', value: 'Игры, квесты, ивенты, поиск команды, турниры и сезонные награды.' }
    ]
  },
  support: {
    title: '🎫 Поддержка и идеи',
    fields: [
      { name: 'Команды', value: '`/ticket`, `/close`, `/apply`, `/applypanel`, `/suggest`, `/suggestions`, `/suggestion`, `/poll`' },
      { name: 'Что это дает', value: 'Обращения к администрации, заявки, предложения и голосования.' }
    ]
  },
  voice: {
    title: '🔊 Voice-комнаты',
    fields: [
      { name: 'Команды', value: '`/voice setup`, `/voice panel`, `/voice info`, `/voice lock`, `/voice unlock`, `/voice limit`, `/voice rename`, `/voice invite`, `/voice claim`, `/voice delete`, `/voice list`' },
      { name: 'Как создать', value: 'Зайди в канал `➕・создать-комнату`, бот создаст личную комнату и отправит панель управления в чат комнаты.' }
    ]
  },
  moderation: {
    title: '🛡 Модерация',
    fields: [
      { name: 'Команды', value: '`/warn`, `/warnings`, `/warnremove`, `/clear`, `/mute`, `/unmute`, `/kick`, `/ban`, `/cases`, `/case`, `/note`, `/appeal`, `/automod`, `/modpanel`' },
      { name: 'Важно', value: 'Команды доступны только участникам с нужными правами.' }
    ]
  },
  admin: {
    title: '⚙️ Администрирование',
    fields: [
      { name: 'Команды', value: '`/setup-wizard`, `/hosting-check`, `/network-check`, `/maintenance`, `/settings`, `/dbstatus`, `/backup`, `/export`, `/notify`, `/integration`, `/application`' },
      { name: 'Веб-панель', value: 'Обычно доступна по адресу `http://localhost:3000` или по адресу хостинга.' }
    ]
  }
};

function buildHelpSelect() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('help:section')
      .setPlaceholder('Выбери категорию справки')
      .addOptions(
        { label: 'Главное', value: 'start', emoji: '📚' },
        { label: 'Профиль', value: 'profile', emoji: '👤' },
        { label: 'Экономика', value: 'economy', emoji: '💰' },
        { label: 'Активности', value: 'activities', emoji: '🎮' },
        { label: 'Поддержка', value: 'support', emoji: '🎫' },
        { label: 'Voice', value: 'voice', emoji: '🔊' },
        { label: 'Модерация', value: 'moderation', emoji: '🛡️' },
        { label: 'Администрирование', value: 'admin', emoji: '⚙️' }
      )
  );
}

function buildHelpPayload(section = 'start') {
  const item = HELP_SECTIONS[section] || HELP_SECTIONS.start;
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(item.title)
    .setDescription(item.description || 'Список команд и краткое описание раздела.')
    .addFields(item.fields || [])
    .setFooter({ text: 'ServerCore • Интерактивная справка' })
    .setTimestamp();
  return { embeds: [embed], components: [buildHelpSelect()] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Интерактивная справка по командам бота'),

  buildHelpPayload,

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    await safeEdit(interaction, buildHelpPayload('start'));
  }
};
