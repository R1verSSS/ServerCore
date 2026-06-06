const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
} = require('discord.js');
const { readDatabase, writeDatabase } = require('./dataStore');
const { getSettings } = require('./settingsService');
const { findTextChannelByName } = require('./logService');

function findApplicationChannel(guild, name) {
  const allowedTypes = new Set([ChannelType.GuildText, ChannelType.GuildForum, ChannelType.GuildAnnouncement]);
  const configuredId = process.env.APPLICATIONS_CHANNEL_ID;
  if (configuredId) {
    const byId = guild?.channels?.cache?.get(String(configuredId));
    if (byId && allowedTypes.has(byId.type)) return byId;
  }
  return guild?.channels?.cache?.find(ch => allowedTypes.has(ch.type) && ch.name === name) || findTextChannelByName(guild, name);
}

const APPLICATION_TYPES = {
  moderator: {
    label: 'Заявка в модераторы',
    emoji: '🛡️',
    color: 0x3498db,
    fields: [
      { id: 'experience', label: 'Опыт модерации', required: true },
      { id: 'why', label: 'Почему хочешь стать модератором?', required: true },
      { id: 'time', label: 'Сколько времени готов уделять?', required: true },
    ],
  },
  partner: {
    label: 'Заявка на партнерство',
    emoji: '🤝',
    color: 0x5865f2,
    fields: [
      { id: 'project', label: 'Название/ссылка на проект или сервер', required: true },
      { id: 'audience', label: 'Аудитория и тематика', required: true },
      { id: 'offer', label: 'Что предлагаешь взамен?', required: true },
    ],
  },
  custom_role: {
    label: 'Заявка на кастомную роль',
    emoji: '🎨',
    color: 0xeb459e,
    fields: [
      { id: 'role_name', label: 'Название роли', required: true },
      { id: 'role_color', label: 'Цвет роли', required: false },
      { id: 'reason', label: 'Почему нужна эта роль?', required: true },
    ],
  },
  tournament: {
    label: 'Заявка на турнир',
    emoji: '🏆',
    color: 0xfee75c,
    fields: [
      { id: 'game', label: 'Игра и формат турнира', required: true },
      { id: 'date', label: 'Желаемая дата/время', required: true },
      { id: 'details', label: 'Правила, призы или описание', required: true },
    ],
  },
  complaint: {
    label: 'Жалоба на пользователя',
    emoji: '🚨',
    color: 0xed4245,
    fields: [
      { id: 'target', label: 'На кого жалоба?', required: true },
      { id: 'what_happened', label: 'Что произошло?', required: true },
      { id: 'proof', label: 'Доказательства/ссылка/время', required: false },
    ],
  },
  idea: {
    label: 'Предложение идеи',
    emoji: '💡',
    color: 0x57f287,
    fields: [
      { id: 'title', label: 'Краткое название идеи', required: true },
      { id: 'description', label: 'Описание идеи', required: true },
      { id: 'benefit', label: 'Чем это поможет серверу?', required: false },
    ],
  },
};

function getApplicationType(type) {
  return APPLICATION_TYPES[type] || APPLICATION_TYPES.idea;
}

function normalizeFields(type, values = {}) {
  const cfg = getApplicationType(type);
  return cfg.fields.map(field => ({
    id: field.id,
    label: field.label,
    value: String(values[field.id] || '').trim().slice(0, 1000),
  })).filter(field => field.value || cfg.fields.find(item => item.id === field.id)?.required);
}

function fieldsToText(fields = []) {
  return fields.map(field => `**${field.label}:**\n${field.value || '-'}`).join('\n\n');
}

function createApplication(userId, username, type, textOrFields) {
  const db = readDatabase();
  db.applicationCounter = (db.applicationCounter || 0) + 1;

  const isFields = Array.isArray(textOrFields);
  const fields = isFields ? textOrFields : [{ id: 'text', label: 'Текст заявки', value: String(textOrFields || '').slice(0, 1500) }];
  const text = isFields ? fieldsToText(fields) : String(textOrFields || '').slice(0, 1500);

  const app = {
    id: db.applicationCounter,
    userId,
    username,
    type,
    typeLabel: getApplicationType(type).label,
    text,
    fields,
    status: 'open',
    createdAt: new Date().toISOString(),
  };

  db.applications[String(app.id)] = app;
  writeDatabase(db);
  return app;
}

function updateApplicationStatus(id, status, moderatorId, moderatorName, comment = '') {
  const db = readDatabase();
  const app = db.applications?.[String(id)];
  if (!app) return { ok: false };
  app.status = status;
  app.moderatorId = moderatorId;
  app.moderatorName = moderatorName;
  app.moderatorComment = String(comment || '').slice(0, 1000);
  app.updatedAt = new Date().toISOString();
  db.applications[String(id)] = app;
  writeDatabase(db);
  return { ok: true, application: app };
}

function getApplications(status = 'open') {
  const db = readDatabase();
  return Object.values(db.applications || {})
    .filter(app => !status || app.status === status)
    .sort((a, b) => Number(b.id) - Number(a.id));
}

function getApplication(id) {
  const db = readDatabase();
  return db.applications?.[String(id)] || null;
}

function buildApplicationEmbed(app) {
  const cfg = getApplicationType(app.type);
  const embed = new EmbedBuilder()
    .setColor(cfg.color || 0x5865f2)
    .setTitle(`${cfg.emoji || '📨'} Заявка #${app.id}: ${app.typeLabel || cfg.label}`)
    .setDescription(app.text || '-')
    .addFields(
      { name: 'Тип', value: app.typeLabel || app.type, inline: true },
      { name: 'Пользователь', value: `${app.username} (${app.userId})`, inline: true },
      { name: 'Статус', value: app.status || 'open', inline: true },
    )
    .setTimestamp(new Date(app.createdAt || Date.now()));
  if (app.moderatorName) {
    embed.addFields({ name: 'Решение', value: `${app.status} — ${app.moderatorName}${app.moderatorComment ? `\n${app.moderatorComment}` : ''}` });
  }
  return embed;
}

function findRoutedApplicationChannel(guild, app, settings = getSettings()) {
  const isComplaint = app?.type === 'complaint';
  const channelId = isComplaint
    ? (settings.complaintsChannelId || process.env.COMPLAINTS_CHANNEL_ID)
    : (settings.applicationsChannelId || process.env.APPLICATIONS_CHANNEL_ID);
  const channelName = isComplaint
    ? (settings.complaintsChannelName || process.env.COMPLAINTS_CHANNEL_NAME || '🚨・жалобы')
    : (settings.applicationsChannelName || '📨・заявки');

  const byId = channelId ? guild?.channels?.cache?.get(String(channelId)) : null;
  if (byId && [ChannelType.GuildText, ChannelType.GuildForum].includes(byId.type)) return byId;

  const byName = guild?.channels?.cache?.find(ch => [ChannelType.GuildText, ChannelType.GuildForum].includes(ch.type) && ch.name === channelName);
  return byName || findTextChannelByName(guild, channelName);
}

function getApplicationChannelName(app, settings = getSettings()) {
  return app?.type === 'complaint'
    ? (settings.complaintsChannelName || process.env.COMPLAINTS_CHANNEL_NAME || '🚨・жалобы')
    : (settings.applicationsChannelName || '📨・заявки');
}

function getForumTagsForApplicationChannel(app) {
  if (app?.type === 'complaint') {
    return ['Жалоба', 'На проверке', 'Решено', 'Отклонено'].map(name => ({ name, moderated: false }));
  }
  return ['Модератор', 'Партнерство', 'Кастомная роль', 'Турнир', 'Идея', 'Другое'].map(name => ({ name, moderated: false }));
}

async function publishApplication(guild, app) {
  const settings = getSettings();

  let channel = findRoutedApplicationChannel(guild, app, settings);

  if (!channel) {
    const category = guild.channels.cache.find(item => item.type === ChannelType.GuildCategory && item.name.includes('МОДЕРАЦ'));
    channel = await guild.channels.create({
      name: getApplicationChannelName(app, settings),
      type: ChannelType.GuildForum,
      parent: category?.id || null,
      availableTags: getForumTagsForApplicationChannel(app),
    });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`application:accept:${app.id}`).setLabel('Принять').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`application:deny:${app.id}`).setLabel('Отклонить').setStyle(ButtonStyle.Danger),
  );
  if (channel.type === ChannelType.GuildForum) {
    const cfg = getApplicationType(app.type);
    const tagName = app.type === 'complaint' ? 'Жалоба' : (cfg.label?.replace('Заявка на ', '').replace('Заявка в ', '') || 'Другое');
    const tag = channel.availableTags?.find(item => item.name === tagName) || null;
    await channel.threads.create({
      name: `Заявка #${app.id} — ${app.typeLabel || app.type}`.slice(0, 90),
      message: { embeds: [buildApplicationEmbed(app)], components: [row] },
      appliedTags: tag ? [tag.id] : [],
    });
  } else {
    await channel.send({ embeds: [buildApplicationEmbed(app)], components: [row] });
  }
  return true;
}

function buildApplicationPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('📨 Панель заявок')
    .setDescription('Выбери тип заявки. После нажатия откроется форма с вопросами. Ответы будут отправлены администрации.')
    .addFields(
      { name: '🛡️ Модератор', value: 'Заявка в команду модерации.', inline: true },
      { name: '🤝 Партнерство', value: 'Предложение сотрудничества.', inline: true },
      { name: '🎨 Кастомная роль', value: 'Запрос личной роли.', inline: true },
      { name: '🏆 Турнир', value: 'Заявка на проведение турнира.', inline: true },
      { name: '🚨 Жалоба', value: 'Жалоба на участника.', inline: true },
      { name: '💡 Идея', value: 'Предложение для сервера.', inline: true },
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('applypanel:moderator').setLabel('Модератор').setEmoji('🛡️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('applypanel:partner').setLabel('Партнерство').setEmoji('🤝').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('applypanel:custom_role').setLabel('Кастомная роль').setEmoji('🎨').setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('applypanel:tournament').setLabel('Турнир').setEmoji('🏆').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('applypanel:complaint').setLabel('Жалоба').setEmoji('🚨').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('applypanel:idea').setLabel('Идея').setEmoji('💡').setStyle(ButtonStyle.Success),
  );
  return { embeds: [embed], components: [row1, row2] };
}

async function notifyApplicant(client, app, status, comment = '') {
  try {
    const user = await client.users.fetch(app.userId);
    const title = status === 'accepted' ? '✅ Заявка принята' : '❌ Заявка отклонена';
    const embed = new EmbedBuilder()
      .setColor(status === 'accepted' ? 0x57f287 : 0xed4245)
      .setTitle(title)
      .setDescription(`Заявка **#${app.id} — ${app.typeLabel || app.type}** получила статус: **${status}**.${comment ? `\n\nКомментарий администрации:\n${comment}` : ''}`)
      .setTimestamp();
    await user.send({ embeds: [embed] });
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = {
  APPLICATION_TYPES,
  getApplicationType,
  normalizeFields,
  fieldsToText,
  createApplication,
  updateApplicationStatus,
  getApplications,
  getApplication,
  buildApplicationEmbed,
  buildApplicationPanel,
  findApplicationsChannel,
  publishApplication,
  notifyApplicant,
};
