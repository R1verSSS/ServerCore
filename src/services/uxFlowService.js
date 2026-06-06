const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { readDatabase, writeDatabase, getOrCreateUser, updateUser } = require('./dataStore');
const { getEconomyHistory, recordEconomy, getDailyDeal } = require('./managementUxService');
const { getUserAchievements, awardAchievement, buildUnlockedText } = require('./achievementService');
const { getShopItemsFromDb } = (() => {
  // server.js has a local helper, therefore keep a tiny safe copy for user-facing widgets.
  function fallbackShopItems() {
    const db = readDatabase();
    return Array.isArray(db.shopItems) ? db.shopItems.filter(i => i.enabled !== false) : [];
  }
  return { getShopItemsFromDb: fallbackShopItems };
})();

const DAILY_COOLDOWN_HOURS = Number(process.env.DAILY_COOLDOWN_HOURS || 24);
const DAILY_REWARD_COINS = Number(process.env.DAILY_COINS || process.env.ONBOARDING_REWARD_COINS || 100);
const DAILY_REWARD_XP = Number(process.env.DAILY_XP || 25);

function ensureUxDb(db) {
  if (!db.forumThreads || typeof db.forumThreads !== 'object') db.forumThreads = {};
  if (!db.userActionLog || typeof db.userActionLog !== 'object') db.userActionLog = {};
  if (!db.webUserActions || !Array.isArray(db.webUserActions)) db.webUserActions = [];
  return db;
}

function rememberUserAction(userId, action, meta = {}) {
  if (!userId || !action) return null;
  const db = ensureUxDb(readDatabase());
  const list = Array.isArray(db.userActionLog[userId]) ? db.userActionLog[userId] : [];
  const entry = { action, meta, createdAt: new Date().toISOString() };
  list.push(entry);
  db.userActionLog[userId] = list.slice(-100);
  writeDatabase(db);
  return entry;
}

function recordForumThread({ userId, username, threadId, forumId, forumName, type, title }) {
  const db = ensureUxDb(readDatabase());
  db.forumThreads[threadId] = {
    id: threadId,
    threadId,
    userId,
    username,
    forumId,
    forumName,
    type,
    title,
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  writeDatabase(db);
  rememberUserAction(userId, 'forum_thread_create', { threadId, forumName, title });
  return db.forumThreads[threadId];
}

function getUserFlowData(userId) {
  const db = ensureUxDb(readDatabase());
  const user = db.users?.[userId] || getOrCreateUser(userId, 'Unknown');
  const tickets = Object.values(db.tickets || {}).filter(t => t.userId === userId || t.authorId === userId).sort((a, b) => String(b.id).localeCompare(String(a.id)));
  const applications = Object.values(db.applications || {}).filter(a => a.userId === userId || a.authorId === userId).sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
  const topics = Object.values(db.forumThreads || {}).filter(t => t.userId === userId).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const purchases = (db.purchaseHistory || []).filter(p => p.userId === userId).slice(-10).reverse();
  const economy = getEconomyHistory(userId, 5);
  const achievements = getUserAchievements(userId, user.username);
  const actions = Array.isArray(db.userActionLog?.[userId]) ? db.userActionLog[userId].slice(-10).reverse() : [];
  return { db, user, tickets, applications, topics, purchases, economy, achievements, actions };
}

function lastDailyInfo(user) {
  const last = user?.lastDailyAt ? new Date(user.lastDailyAt).getTime() : 0;
  const cooldownMs = DAILY_COOLDOWN_HOURS * 60 * 60 * 1000;
  const nextAt = last ? last + cooldownMs : 0;
  const ready = !last || Date.now() >= nextAt;
  return { ready, nextAt, last };
}

function nextStepForUser(data) {
  const user = data.user || {};
  const daily = lastDailyInfo(user);
  if (daily.ready) return { emoji: '🎁', title: 'Забери Daily', text: 'Ежедневная награда доступна прямо сейчас.', action: 'daily' };
  if (!data.tickets.some(t => t.status === 'open')) return { emoji: '🎫', title: 'Нужна помощь?', text: 'Создай тикет, если есть вопрос к администрации.', action: 'ticket' };
  if (!data.topics.length) return { emoji: '🧵', title: 'Создай первую тему', text: 'Forum-темы помогают не терять обсуждения.', action: 'topics' };
  if (!data.purchases.length) return { emoji: '🛒', title: 'Загляни в магазин', text: 'Проверь роли, косметику и бусты.', action: 'shop' };
  return { emoji: '🏆', title: 'Прокачивай достижения', text: 'Пиши сообщения, участвуй в активностях и забирай награды.', action: 'achievements' };
}

function buildNextStepRows(next) {
  const row = new ActionRowBuilder();
  if (next.action === 'daily') row.addComponents(new ButtonBuilder().setCustomId('menu:quick:daily').setLabel('Получить Daily').setEmoji('🎁').setStyle(ButtonStyle.Success));
  if (next.action === 'ticket') row.addComponents(new ButtonBuilder().setCustomId('menu:quick:ticket').setLabel('Создать тикет').setEmoji('🎫').setStyle(ButtonStyle.Primary));
  if (next.action === 'shop') row.addComponents(new ButtonBuilder().setCustomId('menu:quick:shop').setLabel('Открыть магазин').setEmoji('🛒').setStyle(ButtonStyle.Primary));
  if (next.action === 'achievements') row.addComponents(new ButtonBuilder().setCustomId('menu:quick:achievements').setLabel('Достижения').setEmoji('🏆').setStyle(ButtonStyle.Secondary));
  row.addComponents(new ButtonBuilder().setCustomId('ux:my-items').setLabel('Мои списки').setEmoji('📌').setStyle(ButtonStyle.Secondary));
  return row;
}

function buildSmartCenterPayload(discordUser) {
  const data = getUserFlowData(discordUser.id);
  const user = data.user;
  const openTickets = data.tickets.filter(t => t.status === 'open').length;
  const next = nextStepForUser(data);
  const daily = lastDailyInfo(user);
  const dailyText = daily.ready ? 'доступен сейчас' : `после <t:${Math.floor(daily.nextAt / 1000)}:R>`;
  const latestTopic = data.topics[0] ? `<#${data.topics[0].threadId}>` : 'нет тем';
  const latestTicket = data.tickets[0] ? `#${data.tickets[0].id} • ${data.tickets[0].status || 'open'}` : 'нет тикетов';

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`🧭 Мой центр: ${discordUser.username}`)
    .setDescription(`${next.emoji} **Что дальше:** ${next.title}\n${next.text}`)
    .setThumbnail(discordUser.displayAvatarURL?.({ size: 128 }) || null)
    .addFields(
      { name: 'Уровень / XP', value: `**${user.level || 1}** ур. • ${user.xp || 0} XP`, inline: true },
      { name: 'Монеты', value: String(user.coins || 0), inline: true },
      { name: 'Daily', value: dailyText, inline: true },
      { name: 'Тикеты', value: `${data.tickets.length} всего • ${openTickets} открыт.`, inline: true },
      { name: 'Темы', value: `${data.topics.length} • ${latestTopic}`, inline: true },
      { name: 'Заявки', value: `${data.applications.length}`, inline: true },
      { name: 'Последний тикет', value: latestTicket, inline: false },
      { name: 'Бейджи', value: data.achievements.badges.length ? data.achievements.badges.join(' ') : 'Пока нет бейджей', inline: false }
    )
    .setFooter({ text: 'ServerCore • Smart User Center' })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('menu:quick:daily').setLabel(daily.ready ? 'Daily доступен' : 'Daily позже').setEmoji('🎁').setStyle(daily.ready ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(!daily.ready),
    new ButtonBuilder().setCustomId('menu:quick:ticket').setLabel(openTickets ? 'Мой тикет открыт' : 'Создать тикет').setEmoji('🎫').setStyle(openTickets ? ButtonStyle.Secondary : ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('menu:quick:shop').setLabel('Магазин').setEmoji('🛒').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ux:my-items').setLabel('Мои списки').setEmoji('📌').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('menu:quick:profile').setLabel('Профиль').setEmoji('👤').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('menu:quick:achievements').setLabel('Достижения').setEmoji('🏆').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('menu:quick:webpanel').setLabel('Веб-панель').setEmoji('🌐').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('menu:back').setLabel('Главное меню').setEmoji('🧭').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1, row2] };
}

function listLines(items, formatter, empty) {
  if (!items.length) return empty;
  return items.slice(0, 8).map(formatter).join('\n');
}

function buildMyItemsPayload(user) {
  const data = getUserFlowData(user.id);
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📌 Мои темы / тикеты / заявки')
    .addFields(
      { name: '🧵 Мои темы', value: listLines(data.topics, t => `• <#${t.threadId}> — ${t.title || t.type || 'тема'}`, 'Тем пока нет. Создай тему через панель 🧵.'), inline: false },
      { name: '🎫 Мои тикеты', value: listLines(data.tickets, t => `• #${t.id} — ${t.status || 'open'} — ${t.reason || 'без причины'}`.slice(0, 250), 'Тикетов пока нет.'), inline: false },
      { name: '📨 Мои заявки', value: listLines(data.applications, a => `• #${a.id} — ${a.status || 'new'} — ${a.type || 'заявка'}`, 'Заявок пока нет.'), inline: false }
    )
    .setFooter({ text: 'ServerCore • User Flow' });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('menu:quick:ticket').setLabel('Новый тикет').setEmoji('🎫').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('menu:back').setLabel('Назад').setEmoji('⬅️').setStyle(ButtonStyle.Secondary)
  );
  return { embeds: [embed], components: [row] };
}

function buildAfterActionPayload(user, action, extraText = '') {
  const data = getUserFlowData(user.id);
  const next = nextStepForUser(data);
  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('✅ Действие выполнено')
    .setDescription([extraText, `${next.emoji} **Что дальше:** ${next.title}`, next.text].filter(Boolean).join('\n'))
    .setFooter({ text: 'ServerCore • Next Step' });
  return { embeds: [embed], components: [buildNextStepRows(next)] };
}

function claimWebDaily(userId, username = 'Web User') {
  const user = getOrCreateUser(userId, username);
  const daily = lastDailyInfo(user);
  if (!daily.ready) return { ok: false, reason: 'cooldown', nextAt: daily.nextAt };
  const updated = updateUser(userId, current => {
    current.username = username || current.username;
    current.coins = Number(current.coins || 0) + DAILY_REWARD_COINS;
    current.xp = Number(current.xp || 0) + DAILY_REWARD_XP;
    current.lastDailyAt = new Date().toISOString();
    return current;
  });
  recordEconomy(userId, username, 'daily_web', DAILY_REWARD_COINS, { xp: DAILY_REWARD_XP, source: 'web-panel' });
  const achievement = awardAchievement(userId, username, 'first_daily');
  rememberUserAction(userId, 'daily_web', { coins: DAILY_REWARD_COINS, xp: DAILY_REWARD_XP });
  return { ok: true, user: updated, coins: DAILY_REWARD_COINS, xp: DAILY_REWARD_XP, unlockedAchievements: achievement.awarded ? [achievement.achievement] : [] };
}

function logWebUserAction(userId, action, meta = {}) {
  const db = ensureUxDb(readDatabase());
  db.webUserActions.push({ id: db.webUserActions.length + 1, userId, action, meta, createdAt: new Date().toISOString() });
  db.webUserActions = db.webUserActions.slice(-500);
  writeDatabase(db);
  rememberUserAction(userId, action, meta);
}

function buildWebUserNextHtml(userId) {
  const data = getUserFlowData(userId);
  const next = nextStepForUser(data);
  const daily = lastDailyInfo(data.user);
  const items = getShopItemsFromDb();
  const deal = getDailyDeal(items);
  return `<div class="card"><h2>${next.emoji} Что дальше?</h2><p class="muted"><b>${next.title}</b><br/>${next.text}</p><div class="actions"><form method="post" action="/user-actions/daily"><button ${daily.ready ? '' : 'disabled'}>🎁 ${daily.ready ? 'Получить Daily' : 'Daily позже'}</button></form><form method="post" action="/user-actions/ticket"><button>🎫 Запросить тикет</button></form><a class="pill" href="/my-tickets">Мои тикеты</a><a class="pill" href="/my-topics">Мои темы</a></div>${deal ? `<p class="hint">🛒 Товар дня: <b>${deal.itemId}</b>, скидка ${deal.discountPercent}%.</p>` : ''}</div>`;
}

module.exports = {
  ensureUxDb,
  rememberUserAction,
  recordForumThread,
  getUserFlowData,
  buildSmartCenterPayload,
  buildMyItemsPayload,
  buildAfterActionPayload,
  claimWebDaily,
  logWebUserAction,
  buildWebUserNextHtml,
  lastDailyInfo,
};
