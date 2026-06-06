const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const { readDatabase, writeDatabase } = require('./dataStore');
const { logToModeration } = require('./logService');

const SUGGESTIONS_CHANNEL = '💡・предложения';

function ensureStore(db) {
  if (!db.suggestions) db.suggestions = {};
  if (!db.suggestionCounter) db.suggestionCounter = 0;
  if (!db.polls) db.polls = {};
  if (!db.pollCounter) db.pollCounter = 0;
  return db;
}

function isModerator(member) {
  return Boolean(
    member?.permissions?.has(PermissionFlagsBits.ManageGuild) ||
    member?.permissions?.has(PermissionFlagsBits.ManageMessages) ||
    member?.permissions?.has(PermissionFlagsBits.Administrator)
  );
}

function findSuggestionTarget(guild, name) {
  return guild?.channels?.cache?.find(channel => channel.name === name && (channel.isTextBased?.() || channel.type === ChannelType.GuildForum));
}

async function publishToTextOrForum(channel, title, payload, tagName = null) {
  if (!channel) return null;
  if (channel.type === ChannelType.GuildForum) {
    const tag = tagName ? channel.availableTags?.find(item => item.name === tagName) : null;
    const thread = await channel.threads.create({
      name: String(title || 'Тема').slice(0, 90),
      message: payload,
      appliedTags: tag ? [tag.id] : [],
    });
    return { channelId: thread.id, messageId: thread.lastMessageId, thread };
  }
  if (channel.send) {
    const message = await channel.send(payload);
    return { channelId: channel.id, messageId: message.id, message };
  }
  return null;
}

function statusLabel(status) {
  const map = {
    open: 'На голосовании',
    accepted: 'Принято',
    denied: 'Отклонено',
    review: 'На рассмотрении',
    closed: 'Закрыто',
  };
  return map[status] || status || 'На голосовании';
}

function statusColor(status) {
  if (status === 'accepted') return 0x57F287;
  if (status === 'denied') return 0xED4245;
  if (status === 'review') return 0xFEE75C;
  if (status === 'closed') return 0x99AAB5;
  return 0x5865F2;
}

function buildSuggestionEmbed(suggestion, guild) {
  const up = Object.keys(suggestion.votes?.up || {}).length;
  const down = Object.keys(suggestion.votes?.down || {}).length;
  const total = up + down;
  const percent = total ? Math.round((up / total) * 100) : 0;

  const embed = new EmbedBuilder()
    .setColor(statusColor(suggestion.status))
    .setTitle(`💡 Предложение #${suggestion.id}`)
    .setDescription(suggestion.idea || 'Без текста')
    .addFields(
      { name: 'Автор', value: suggestion.username || `<@${suggestion.userId}>`, inline: true },
      { name: 'Статус', value: statusLabel(suggestion.status), inline: true },
      { name: 'Голоса', value: `👍 ${up} / 👎 ${down}  •  За: ${percent}%`, inline: true }
    )
    .setFooter({ text: `ID: ${suggestion.id}` })
    .setTimestamp(new Date(suggestion.createdAt || Date.now()));

  if (suggestion.adminComment) {
    embed.addFields({ name: 'Комментарий администрации', value: suggestion.adminComment.slice(0, 1024), inline: false });
  }

  if (guild?.members?.cache?.has(suggestion.userId)) {
    const member = guild.members.cache.get(suggestion.userId);
    if (member?.displayAvatarURL) embed.setThumbnail(member.displayAvatarURL());
  }

  return embed;
}

function buildSuggestionButtons(suggestion) {
  const disabled = suggestion.status !== 'open' && suggestion.status !== 'review';
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`suggestion:vote:${suggestion.id}:up`).setLabel('За').setEmoji('👍').setStyle(ButtonStyle.Success).setDisabled(disabled),
      new ButtonBuilder().setCustomId(`suggestion:vote:${suggestion.id}:down`).setLabel('Против').setEmoji('👎').setStyle(ButtonStyle.Danger).setDisabled(disabled),
      new ButtonBuilder().setCustomId(`suggestion:status:${suggestion.id}:review`).setLabel('На рассмотрение').setEmoji('👀').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`suggestion:status:${suggestion.id}:accepted`).setLabel('Принять').setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`suggestion:status:${suggestion.id}:denied`).setLabel('Отклонить').setEmoji('❌').setStyle(ButtonStyle.Danger)
    )
  ];
}

async function updateSuggestionMessage(guild, suggestion) {
  if (!suggestion.channelId || !suggestion.messageId) return;
  const channel = await guild.channels.fetch(suggestion.channelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  const message = await channel.messages.fetch(suggestion.messageId).catch(() => null);
  if (!message) return;
  await message.edit({ embeds: [buildSuggestionEmbed(suggestion, guild)], components: buildSuggestionButtons(suggestion) }).catch(() => null);
}

async function createSuggestion(interaction, idea) {
  const db = ensureStore(readDatabase());
  const id = Number(db.suggestionCounter || 0) + 1;
  db.suggestionCounter = id;

  const suggestion = {
    id,
    userId: interaction.user.id,
    username: interaction.user.username,
    idea: String(idea || '').trim(),
    status: 'open',
    votes: { up: {}, down: {} },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messageId: null,
    channelId: null,
    adminComment: null,
  };

  db.suggestions[id] = suggestion;
  writeDatabase(db);

  const channel = findSuggestionTarget(interaction.guild, SUGGESTIONS_CHANNEL);
  if (channel) {
    const published = await publishToTextOrForum(channel, `Предложение #${id}`, { embeds: [buildSuggestionEmbed(suggestion, interaction.guild)], components: buildSuggestionButtons(suggestion) }, 'Идея');
    suggestion.messageId = published?.messageId || null;
    suggestion.channelId = published?.channelId || null;
    const latest = ensureStore(readDatabase());
    latest.suggestions[id] = suggestion;
    writeDatabase(latest);
  }

  await logToModeration(interaction.guild, '💡 Новое предложение', `${interaction.user} создал предложение #${id}: ${suggestion.idea.slice(0, 150)}`).catch(() => null);
  return { ok: true, suggestion, channel };
}

async function voteSuggestion(interaction, id, vote) {
  const db = ensureStore(readDatabase());
  const suggestion = db.suggestions[String(id)];
  if (!suggestion) return { ok: false, reason: 'not_found' };
  if (suggestion.status !== 'open' && suggestion.status !== 'review') return { ok: false, reason: 'closed' };
  if (suggestion.userId === interaction.user.id) return { ok: false, reason: 'own' };

  if (!suggestion.votes) suggestion.votes = { up: {}, down: {} };
  if (!suggestion.votes.up) suggestion.votes.up = {};
  if (!suggestion.votes.down) suggestion.votes.down = {};

  delete suggestion.votes.up[interaction.user.id];
  delete suggestion.votes.down[interaction.user.id];
  suggestion.votes[vote][interaction.user.id] = { username: interaction.user.username, at: new Date().toISOString() };
  suggestion.updatedAt = new Date().toISOString();

  db.suggestions[String(id)] = suggestion;
  writeDatabase(db);
  await updateSuggestionMessage(interaction.guild, suggestion);
  return { ok: true, suggestion };
}

async function setSuggestionStatus(interaction, id, status, comment = '') {
  if (interaction.member && !isModerator(interaction.member)) return { ok: false, reason: 'no_permission' };
  const db = ensureStore(readDatabase());
  const suggestion = db.suggestions[String(id)];
  if (!suggestion) return { ok: false, reason: 'not_found' };
  suggestion.status = status;
  suggestion.adminComment = comment || suggestion.adminComment || null;
  suggestion.updatedAt = new Date().toISOString();
  suggestion.closedBy = interaction.user?.id || null;
  suggestion.closedByName = interaction.user?.username || null;
  db.suggestions[String(id)] = suggestion;
  writeDatabase(db);
  await updateSuggestionMessage(interaction.guild, suggestion);
  await logToModeration(interaction.guild, '💡 Статус предложения', `${interaction.user} изменил статус предложения #${id}: ${statusLabel(status)}${comment ? `\nКомментарий: ${comment}` : ''}`).catch(() => null);
  return { ok: true, suggestion };
}

function listSuggestions(status = null, limit = 10) {
  const db = ensureStore(readDatabase());
  return Object.values(db.suggestions || {})
    .filter(item => !status || item.status === status)
    .sort((a, b) => Number(b.id) - Number(a.id))
    .slice(0, limit);
}

function getSuggestion(id) {
  const db = ensureStore(readDatabase());
  return db.suggestions[String(id)] || null;
}

function parsePollOptions(raw) {
  return String(raw || '')
    .split('|')
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function buildPollEmbed(poll) {
  const total = Object.keys(poll.votes || {}).length;
  const lines = poll.options.map((option, index) => {
    const count = Object.values(poll.votes || {}).filter(v => Number(v) === index).length;
    const percent = total ? Math.round((count / total) * 100) : 0;
    const bar = '█'.repeat(Math.round(percent / 10)) + '░'.repeat(10 - Math.round(percent / 10));
    return `**${index + 1}. ${option}**\n${bar} ${count} голосов • ${percent}%`;
  });

  return new EmbedBuilder()
    .setColor(poll.status === 'closed' ? 0x99AAB5 : 0xFEE75C)
    .setTitle(`📊 Опрос #${poll.id}`)
    .setDescription(`**${poll.question}**\n\n${lines.join('\n\n')}`)
    .addFields(
      { name: 'Автор', value: poll.username || `<@${poll.userId}>`, inline: true },
      { name: 'Статус', value: poll.status === 'closed' ? 'Закрыт' : 'Активен', inline: true },
      { name: 'Всего голосов', value: String(total), inline: true }
    )
    .setFooter({ text: `ID: ${poll.id}` })
    .setTimestamp(new Date(poll.createdAt || Date.now()));
}

function buildPollButtons(poll) {
  const rows = [];
  const first = new ActionRowBuilder();
  poll.options.forEach((option, index) => {
    first.addComponents(
      new ButtonBuilder()
        .setCustomId(`poll:vote:${poll.id}:${index}`)
        .setLabel(String(index + 1))
        .setStyle(ButtonStyle.Primary)
        .setDisabled(poll.status === 'closed')
    );
  });
  rows.push(first);
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`poll:close:${poll.id}`).setLabel('Закрыть опрос').setEmoji('🔒').setStyle(ButtonStyle.Secondary)
  ));
  return rows;
}

async function updatePollMessage(guild, poll) {
  if (!poll.channelId || !poll.messageId) return;
  const channel = await guild.channels.fetch(poll.channelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  const message = await channel.messages.fetch(poll.messageId).catch(() => null);
  if (!message) return;
  await message.edit({ embeds: [buildPollEmbed(poll)], components: buildPollButtons(poll) }).catch(() => null);
}

async function createPoll(interaction, question, optionsRaw) {
  const options = parsePollOptions(optionsRaw);
  if (options.length < 2) return { ok: false, reason: 'options' };
  const db = ensureStore(readDatabase());
  const id = Number(db.pollCounter || 0) + 1;
  db.pollCounter = id;
  const poll = {
    id,
    userId: interaction.user.id,
    username: interaction.user.username,
    question: String(question || '').trim(),
    options,
    votes: {},
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    channelId: null,
    messageId: null,
  };
  db.polls[id] = poll;
  writeDatabase(db);

  const channel = findSuggestionTarget(interaction.guild, SUGGESTIONS_CHANNEL) || interaction.channel;
  if (channel) {
    const published = await publishToTextOrForum(channel, `Опрос #${id}`, { embeds: [buildPollEmbed(poll)], components: buildPollButtons(poll) }, 'Идея');
    poll.channelId = published?.channelId || null;
    poll.messageId = published?.messageId || null;
    const latest = ensureStore(readDatabase());
    latest.polls[id] = poll;
    writeDatabase(latest);
  }

  await logToModeration(interaction.guild, '📊 Новый опрос', `${interaction.user} создал опрос #${id}: ${poll.question}`).catch(() => null);
  return { ok: true, poll, channel };
}

async function votePoll(interaction, id, optionIndex) {
  const db = ensureStore(readDatabase());
  const poll = db.polls[String(id)];
  if (!poll) return { ok: false, reason: 'not_found' };
  if (poll.status === 'closed') return { ok: false, reason: 'closed' };
  if (optionIndex < 0 || optionIndex >= poll.options.length) return { ok: false, reason: 'option' };
  poll.votes[interaction.user.id] = Number(optionIndex);
  poll.updatedAt = new Date().toISOString();
  db.polls[String(id)] = poll;
  writeDatabase(db);
  await updatePollMessage(interaction.guild, poll);
  return { ok: true, poll };
}

async function closePoll(interaction, id) {
  if (interaction.member && !isModerator(interaction.member)) return { ok: false, reason: 'no_permission' };
  const db = ensureStore(readDatabase());
  const poll = db.polls[String(id)];
  if (!poll) return { ok: false, reason: 'not_found' };
  poll.status = 'closed';
  poll.updatedAt = new Date().toISOString();
  db.polls[String(id)] = poll;
  writeDatabase(db);
  await updatePollMessage(interaction.guild, poll);
  await logToModeration(interaction.guild, '📊 Опрос закрыт', `${interaction.user} закрыл опрос #${id}: ${poll.question}`).catch(() => null);
  return { ok: true, poll };
}

function listPolls(status = null, limit = 10) {
  const db = ensureStore(readDatabase());
  return Object.values(db.polls || {})
    .filter(item => !status || item.status === status)
    .sort((a, b) => Number(b.id) - Number(a.id))
    .slice(0, limit);
}

function getPoll(id) {
  const db = ensureStore(readDatabase());
  return db.polls?.[String(id)] || null;
}

async function createSuggestionsChannel(guild) {
  if (!guild) return null;
  let channel = findSuggestionTarget(guild, SUGGESTIONS_CHANNEL);
  if (channel) return channel;
  const category = guild.channels.cache.find(ch => ch.name === '💬 ОБЩЕНИЕ' && ch.type === 4) || null;
  channel = await guild.channels.create({
    name: SUGGESTIONS_CHANNEL,
    type: ChannelType.GuildForum,
    parent: category?.id,
    topic: 'Предложения пользователей и голосования отдельными темами.',
    availableTags: ['Идея', 'Улучшение', 'Баг', 'Принято', 'Отклонено'].map(name => ({ name, moderated: false })),
    reason: 'Create suggestions channel'
  });
  return channel;
}

module.exports = {
  SUGGESTIONS_CHANNEL,
  createSuggestion,
  voteSuggestion,
  setSuggestionStatus,
  listSuggestions,
  getSuggestion,
  buildSuggestionEmbed,
  buildSuggestionButtons,
  createPoll,
  votePoll,
  closePoll,
  listPolls,
  getPoll,
  buildPollEmbed,
  buildPollButtons,
  createSuggestionsChannel,
  statusLabel,
};
