const { EmbedBuilder } = require('discord.js');
const { readDatabase, writeDatabase, getOrCreateUser, updateUser } = require('./dataStore');
const { addXpToMember } = require('./xpService');
const { awardAchievement, buildUnlockedText } = require('./achievementService');

const QUEST_POOL = [
  {
    id: 'messages_5',
    title: 'Активный чат',
    description: 'Напиши 5 сообщений на сервере.',
    type: 'message',
    target: 5,
    rewardCoins: 80,
    rewardXp: 20,
  },
  {
    id: 'games_3',
    title: 'Игровой вечер',
    description: 'Сыграй 3 мини-игры через /game.',
    type: 'game',
    target: 3,
    rewardCoins: 100,
    rewardXp: 25,
  },
  {
    id: 'daily_1',
    title: 'Забрать бонус',
    description: 'Получи ежедневную награду через /daily.',
    type: 'daily',
    target: 1,
    rewardCoins: 60,
    rewardXp: 15,
  },
];

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function pickDailyQuest(discordId, dateKey = getTodayKey()) {
  const seed = `${discordId}:${dateKey}`;
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return QUEST_POOL[hash % QUEST_POOL.length];
}

function ensureQuest(discordId, username) {
  getOrCreateUser(discordId, username);
  const db = readDatabase();
  const dateKey = getTodayKey();
  if (!db.quests) db.quests = {};

  const current = db.quests[discordId];
  if (!current || current.dateKey !== dateKey) {
    const template = pickDailyQuest(discordId, dateKey);
    db.quests[discordId] = {
      dateKey,
      questId: template.id,
      progress: 0,
      claimed: false,
      completedNotified: false,
      createdAt: new Date().toISOString(),
    };
    writeDatabase(db);
  }

  return getQuestState(discordId, username);
}

function getQuestTemplate(questId) {
  return QUEST_POOL.find(item => item.id === questId) || QUEST_POOL[0];
}

function getQuestState(discordId, username) {
  getOrCreateUser(discordId, username);
  const db = readDatabase();
  if (!db.quests || !db.quests[discordId] || db.quests[discordId].dateKey !== getTodayKey()) {
    return ensureQuest(discordId, username);
  }

  const state = db.quests[discordId];
  const quest = getQuestTemplate(state.questId);
  const progress = Math.min(state.progress || 0, quest.target);
  const completed = progress >= quest.target;

  return {
    ...state,
    ...quest,
    progress,
    completed,
    progressText: `${progress} / ${quest.target}`,
  };
}

function incrementQuestProgress(discordId, username, type, amount = 1) {
  if (!discordId || !type || amount <= 0) return { changed: false };
  ensureQuest(discordId, username);

  const db = readDatabase();
  const state = db.quests?.[discordId];
  if (!state || state.dateKey !== getTodayKey()) return { changed: false };

  const quest = getQuestTemplate(state.questId);
  if (quest.type !== type || state.claimed) {
    return { changed: false, quest: getQuestState(discordId, username) };
  }

  const before = Math.min(state.progress || 0, quest.target);
  const after = Math.min(before + amount, quest.target);
  const completedNow = before < quest.target && after >= quest.target;

  state.progress = after;
  db.quests[discordId] = state;
  writeDatabase(db);

  return {
    changed: after !== before,
    completedNow,
    quest: getQuestState(discordId, username),
  };
}

async function claimQuest(member) {
  if (!member || member.user.bot) return { ok: false, reason: 'bot' };

  const discordId = member.user.id;
  const username = member.user.username;
  const questState = ensureQuest(discordId, username);

  if (!questState.completed) return { ok: false, reason: 'not_completed', quest: questState };
  if (questState.claimed) return { ok: false, reason: 'already_claimed', quest: questState };

  const db = readDatabase();
  db.quests[discordId].claimed = true;
  db.quests[discordId].claimedAt = new Date().toISOString();
  writeDatabase(db);

  const updatedUser = updateUser(discordId, user => {
    user.username = username;
    user.coins = (user.coins || 0) + questState.rewardCoins;
    if (!user.questStats) user.questStats = { completed: 0 };
    user.questStats.completed = (user.questStats.completed || 0) + 1;
    return user;
  });

  const xpResult = await addXpToMember(member, questState.rewardXp);
  const questAchievement = awardAchievement(discordId, username, 'first_quest');
  const unlockedAchievements = [
    ...(xpResult.unlockedAchievements || []),
    ...(questAchievement.awarded ? [questAchievement.achievement] : []),
  ];

  return {
    ok: true,
    quest: questState,
    rewardCoins: questState.rewardCoins,
    rewardXp: questState.rewardXp,
    user: xpResult.user || updatedUser,
    leveledUp: xpResult.leveledUp,
    newLevel: xpResult.newLevel,
    unlockedAchievements,
  };
}

function buildQuestEmbed(user, questState) {
  const status = questState.claimed
    ? '✅ Награда получена'
    : questState.completed
      ? '🎁 Можно забрать награду через `/quest claim`'
      : '⏳ В процессе';

  return new EmbedBuilder()
    .setColor(questState.completed ? 0x57F287 : 0x5865F2)
    .setTitle(`📜 Ежедневный квест: ${questState.title}`)
    .setDescription(questState.description)
    .addFields(
      { name: 'Прогресс', value: questState.progressText, inline: true },
      { name: 'Награда', value: `🪙 ${questState.rewardCoins} монет\n✨ ${questState.rewardXp} XP`, inline: true },
      { name: 'Статус', value: status, inline: false }
    )
    .setFooter({ text: `ServerCore • Quests • ${user.username}` });
}

function buildQuestCompletedText(result) {
  if (!result?.quest?.completedNow) return '';
  return `\n\n📜 Ежедневный квест **${result.quest.title}** выполнен! Забери награду командой \`/quest claim\`.`;
}

module.exports = {
  QUEST_POOL,
  ensureQuest,
  getQuestState,
  incrementQuestProgress,
  claimQuest,
  buildQuestEmbed,
  buildQuestCompletedText,
};
