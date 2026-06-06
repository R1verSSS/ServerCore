const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
} = require('discord.js');
const { addAudit } = require('./auditService');
const { recordForumThread, rememberUserAction } = require('./uxFlowService');
const { awardAchievement } = require('./achievementService');

const THREAD_FORUMS = {
  member_topic: {
    label: 'Личная тема участника',
    emoji: '🧵',
    channelName: '🧵・темы-участников',
    titlePlaceholder: 'Например: Дневник R1ver или Мой сетап',
    bodyPlaceholder: 'О чем будет твоя тема?',
    tags: ['Личная тема', 'Проект', 'Обсуждение', 'Другое'],
  },
  question: {
    label: 'Вопрос / помощь',
    emoji: '❓',
    channelName: '❓・вопросы-и-помощь',
    titlePlaceholder: 'Кратко опиши вопрос',
    bodyPlaceholder: 'Опиши проблему, что уже пробовал и что нужно получить.',
    tags: ['Вопрос', 'Ошибка', 'Discord', 'Бот', 'Другое'],
  },
  lfg: {
    label: 'Поиск команды',
    emoji: '🎮',
    channelName: '🎮・поиск-команды',
    titlePlaceholder: 'Например: CS2 — ищу 2 игроков',
    bodyPlaceholder: 'Игра, время, сколько игроков нужно, требования.',
    tags: ['CS2', 'Minecraft', 'Valorant', 'GTA', 'Другое'],
  },
  suggestion: {
    label: 'Предложение',
    emoji: '💡',
    channelName: '💡・предложения',
    titlePlaceholder: 'Краткое название идеи',
    bodyPlaceholder: 'Опиши идею и чем она поможет серверу.',
    tags: ['Идея', 'Улучшение', 'Баг', 'Принято', 'Отклонено'],
  },
  project: {
    label: 'Проект участника',
    emoji: '🚀',
    channelName: '🚀・проекты-участников',
    titlePlaceholder: 'Название проекта',
    bodyPlaceholder: 'Расскажи о проекте, ссылках, статусе и что нужно от участников.',
    tags: ['Проект', 'Идея', 'Нужна помощь', 'Релиз', 'Другое'],
  },
  code_help: {
    label: 'Помощь с кодом',
    emoji: '🛠',
    channelName: '🛠・помощь-с-кодом',
    titlePlaceholder: 'Кратко опиши ошибку или задачу',
    bodyPlaceholder: 'Язык, ошибка, фрагмент кода, что ожидаешь получить.',
    tags: ['JavaScript', 'Python', 'ABAP', 'Ошибка', 'Другое'],
  },
};

function getThreadForumConfig(type) {
  return THREAD_FORUMS[type] || THREAD_FORUMS.member_topic;
}

function findForum(guild, type) {
  const cfg = getThreadForumConfig(type);
  return guild?.channels.cache.find(ch => ch.name === cfg.channelName && ch.type === ChannelType.GuildForum) || null;
}

function getForumOptions(guild) {
  return Object.entries(THREAD_FORUMS).map(([id, cfg]) => ({
    id,
    label: cfg.label,
    emoji: cfg.emoji,
    channel: guild?.channels.cache.find(ch => ch.name === cfg.channelName) || null,
  }));
}

function buildThreadPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🧵 Темы и ветки сервера')
    .setDescription('Создавай отдельные темы вместо длинных обсуждений в обычных чатах. Выбери тип темы — бот откроет форму и создаст forum-пост в подходящем канале.')
    .addFields(
      { name: '🧵 Личная тема', value: 'Дневник, сетап, свои обсуждения.', inline: true },
      { name: '❓ Вопрос', value: 'Отдельная ветка для помощи.', inline: true },
      { name: '🎮 Поиск команды', value: 'Сбор людей для игр.', inline: true },
      { name: '💡 Предложение', value: 'Идеи и улучшения сервера.', inline: true },
      { name: '🚀 Проект', value: 'Проекты участников.', inline: true },
      { name: '🛠 Код', value: 'Помощь с ошибками и задачами.', inline: true },
    )
    .setFooter({ text: 'Обычные панельные каналы остаются текстовыми: правила, магазин, команды, логи.' })
    .setTimestamp();

  const menu = new StringSelectMenuBuilder()
    .setCustomId('threadpanel:create_select')
    .setPlaceholder('Выбери тип темы')
    .addOptions(Object.entries(THREAD_FORUMS).map(([value, cfg]) => ({
      label: cfg.label,
      value,
      emoji: cfg.emoji,
      description: cfg.channelName.replace(/[・]/g, ' '),
    })));

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('threadpanel:help').setLabel('Как пользоваться').setEmoji('ℹ️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setStyle(ButtonStyle.Link).setURL('https://support.discord.com/hc/ru/articles/6208479917079').setLabel('Что такое Forum').setEmoji('📘')
  );

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu), buttons] };
}

function buildThreadHelpPayload() {
  return {
    embeds: [new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('ℹ️ Как пользоваться темами')
      .setDescription('1. Выбери тип темы в меню.\n2. Заполни название и описание.\n3. Бот создаст отдельную ветку/forum-пост.\n4. Дальше обсуждение ведется внутри этой темы, а общий канал не засоряется.')
      .addFields(
        { name: 'Что лучше создавать темой?', value: 'Вопросы, предложения, поиск команды, проекты, длинные обсуждения.', inline: false },
        { name: 'Что не нужно переводить в темы?', value: 'Правила, магазин, команды бота, логи и панельные каналы.', inline: false }
      )],
    components: [],
    ephemeral: true,
  };
}

function buildThreadCreateModal(type) {
  const cfg = getThreadForumConfig(type);
  return new ModalBuilder()
    .setCustomId(`threadpanel:modal:${type}`)
    .setTitle(`${cfg.emoji} ${cfg.label}`.slice(0, 45))
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('title')
          .setLabel('Название темы')
          .setPlaceholder(cfg.titlePlaceholder)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(90)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('body')
          .setLabel('Описание')
          .setPlaceholder(cfg.bodyPlaceholder)
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1800)
      )
    );
}

async function createForumThread(guild, user, type, title, body) {
  const cfg = getThreadForumConfig(type);
  const forum = findForum(guild, type);
  if (!forum) {
    return { ok: false, reason: 'forum_not_found', message: `❌ Forum-канал **${cfg.channelName}** не найден. Администратору нужно выполнить \`npm run setup\`.` };
  }

  const safeTitle = String(title || '').trim().slice(0, 90);
  const safeBody = String(body || '').trim().slice(0, 1800);
  if (!safeTitle || !safeBody) return { ok: false, reason: 'bad_input', message: '❌ Укажи название и описание темы.' };

  const tagName = cfg.tags?.[0];
  const tag = forum.availableTags?.find(item => item.name === tagName);
  const appliedTags = tag ? [tag.id] : [];

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`${cfg.emoji} ${safeTitle}`.slice(0, 256))
    .setDescription(safeBody)
    .addFields({ name: 'Автор', value: `<@${user.id}>`, inline: true }, { name: 'Тип', value: cfg.label, inline: true })
    .setTimestamp();

  const thread = await forum.threads.create({
    name: safeTitle,
    message: { content: `<@${user.id}> создал тему.`, embeds: [embed] },
    appliedTags,
    reason: `Forum topic created by ${user.tag || user.username || user.id}`,
  });

  addAudit('forum_thread_create', user, { type, forumId: forum.id, forumName: forum.name, threadId: thread.id, title: safeTitle });
  recordForumThread({ userId: user.id, username: user.username || user.tag || user.id, threadId: thread.id, forumId: forum.id, forumName: forum.name, type, title: safeTitle });
  rememberUserAction(user.id, 'topic_created', { type, threadId: thread.id, title: safeTitle });
  awardAchievement(user.id, user.username || user.tag || user.id, 'first_forum_topic');
  return { ok: true, thread, message: `✅ Тема создана: <#${thread.id}>\n\n🧭 Что дальше: открой \`/me\`, чтобы увидеть тему в разделе **Мои темы**.` };
}

async function createForumThreadFromModal(interaction, type) {
  const title = interaction.fields.getTextInputValue('title');
  const body = interaction.fields.getTextInputValue('body');
  return createForumThread(interaction.guild, interaction.user, type, title, body);
}

async function ensureForumChannel(guild, category, cfg) {
  let existing = guild.channels.cache.find(ch => ch.name === cfg.name && ch.parentId === category.id);
  if (existing && existing.type === ChannelType.GuildForum) return existing;
  if (existing && existing.type !== ChannelType.GuildForum) {
    const archivedName = `${cfg.name}-архив`.slice(0, 95);
    await existing.setName(archivedName, 'Replacing text channel with forum channel').catch(() => null);
  }
  return guild.channels.create({
    name: cfg.name,
    type: ChannelType.GuildForum,
    parent: category.id,
    topic: cfg.topic,
    availableTags: (cfg.tags || []).slice(0, 20).map(name => ({ name, moderated: false })),
    reason: 'Server template forum setup',
  });
}

module.exports = {
  THREAD_FORUMS,
  getThreadForumConfig,
  getForumOptions,
  buildThreadPanel,
  buildThreadHelpPayload,
  buildThreadCreateModal,
  createForumThreadFromModal,
  createForumThread,
  ensureForumChannel,
};
