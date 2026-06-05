const { getOrCreateUser, updateUser, readDatabase, writeDatabase } = require('./dataStore');
const { awardAchievement } = require('./achievementService');

const REP_COOLDOWN_MS = 12 * 60 * 60 * 1000;

function ensureReputationCollections(db) {
  if (!db.reputations) db.reputations = [];
  return db;
}

function getReputationForUser(discordId, username) {
  const user = getOrCreateUser(discordId, username);
  const db = ensureReputationCollections(readDatabase());
  const received = db.reputations
    .filter(item => item.toUserId === discordId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    total: user.reputation || 0,
    received,
    last: received[0] || null
  };
}

function canGiveReputation(fromUserId, toUserId) {
  const db = ensureReputationCollections(readDatabase());
  const now = Date.now();

  const lastRep = db.reputations
    .filter(item => item.fromUserId === fromUserId && item.toUserId === toUserId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  if (!lastRep) {
    return { ok: true, waitMs: 0 };
  }

  const lastTime = new Date(lastRep.createdAt).getTime();
  const diff = now - lastTime;

  if (diff >= REP_COOLDOWN_MS) {
    return { ok: true, waitMs: 0 };
  }

  return { ok: false, waitMs: REP_COOLDOWN_MS - diff };
}

function formatWaitTime(ms) {
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes} мин.`;
  if (minutes <= 0) return `${hours} ч.`;
  return `${hours} ч. ${minutes} мин.`;
}

function giveReputation({ fromUser, toUser, reason }) {
  const fromUserId = fromUser.id;
  const toUserId = toUser.id;

  const cooldown = canGiveReputation(fromUserId, toUserId);
  if (!cooldown.ok) {
    return { ok: false, reason: 'cooldown', waitMs: cooldown.waitMs };
  }

  const db = ensureReputationCollections(readDatabase());
  const entry = {
    id: `${Date.now()}-${fromUserId}-${toUserId}`,
    fromUserId,
    fromUsername: fromUser.username,
    toUserId,
    toUsername: toUser.username,
    reason: reason || 'Причина не указана',
    createdAt: new Date().toISOString()
  };

  db.reputations.push(entry);
  writeDatabase(db);

  const updatedUser = updateUser(toUserId, user => {
    user.username = toUser.username;
    user.reputation = (user.reputation || 0) + 1;
    return user;
  });

  getOrCreateUser(fromUserId, fromUser.username);

  const giverAchievement = awardAchievement(fromUserId, fromUser.username, 'first_rep_given');
  const receiverAchievement = awardAchievement(toUserId, toUser.username, 'first_rep_received');

  return {
    ok: true,
    entry,
    total: updatedUser.reputation || 0,
    unlockedAchievements: [
      ...(giverAchievement.awarded ? [giverAchievement.achievement] : []),
    ],
    receiverUnlockedAchievements: receiverAchievement.awarded ? [receiverAchievement.achievement] : []
  };
}

module.exports = {
  REP_COOLDOWN_MS,
  giveReputation,
  getReputationForUser,
  formatWaitTime
};
