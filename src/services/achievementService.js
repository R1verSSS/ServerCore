const { EmbedBuilder } = require('discord.js');
const { getOrCreateUser, updateUser, getUsers } = require('./dataStore');

const ACHIEVEMENTS = [
  {
    id: 'first_message',
    title: 'Первое сообщение',
    description: 'Написать первое сообщение на сервере.',
    badge: '💬',
  },
  {
    id: 'first_level',
    title: 'Старт прокачки',
    description: 'Получить первый XP и открыть систему уровней.',
    badge: '🌱',
  },
  {
    id: 'level_5',
    title: 'Активный участник',
    description: 'Достичь 5 уровня.',
    badge: '🔥',
  },
  {
    id: 'level_10',
    title: 'Свой на сервере',
    description: 'Достичь 10 уровня.',
    badge: '⭐',
  },
  {
    id: 'level_20',
    title: 'Легенда сервера',
    description: 'Достичь 20 уровня.',
    badge: '👑',
  },
  {
    id: 'first_daily',
    title: 'Ежедневный бонус',
    description: 'Получить первую ежедневную награду.',
    badge: '🎁',
  },
  {
    id: 'first_ticket',
    title: 'Первое обращение',
    description: 'Создать первый тикет.',
    badge: '🎫',
  },
  {
    id: 'first_rep_given',
    title: 'Благодарный участник',
    description: 'Первый раз выдать репутацию другому участнику.',
    badge: '🤝',
  },
  {
    id: 'first_rep_received',
    title: 'Полезный участник',
    description: 'Первый раз получить репутацию.',
    badge: '💛',
  },
  {
    id: 'first_event_join',
    title: 'Участник ивента',
    description: 'Впервые записаться на ивент.',
    badge: '🎮',
  },
  {
    id: 'first_purchase',
    title: 'Покупатель',
    description: 'Купить первый товар в магазине.',
    badge: '🛒',
  },
  {
    id: 'first_game',
    title: 'Игрок',
    description: 'Сыграть первую мини-игру.',
    badge: '🎲',
  },
  {
    id: 'first_game_win',
    title: 'Первая победа',
    description: 'Победить в мини-игре.',
    badge: '🏆',
  },
  {
    id: 'first_quest',
    title: 'Квест выполнен',
    description: 'Выполнить первый ежедневный квест.',
    badge: '📜',
  },
];

const ACHIEVEMENT_MAP = new Map(ACHIEVEMENTS.map(item => [item.id, item]));

function normalizeUserCollections(user) {
  if (!Array.isArray(user.achievements)) user.achievements = [];
  if (!Array.isArray(user.badges)) user.badges = [];
  return user;
}

function getAchievementById(id) {
  return ACHIEVEMENT_MAP.get(id) || null;
}

function getAllAchievements() {
  return ACHIEVEMENTS;
}

function getUserAchievements(discordId, username) {
  const user = normalizeUserCollections(getOrCreateUser(discordId, username));
  const unlockedIds = new Set(user.achievements.map(item => item.id));
  const unlocked = user.achievements
    .map(item => ({ ...getAchievementById(item.id), ...item }))
    .filter(item => item && item.id);
  const locked = ACHIEVEMENTS.filter(item => !unlockedIds.has(item.id));

  return {
    user,
    unlocked,
    locked,
    total: ACHIEVEMENTS.length,
    unlockedCount: unlocked.length,
    badges: user.badges || [],
  };
}

function awardAchievement(discordId, username, achievementId) {
  const achievement = getAchievementById(achievementId);
  if (!achievement || !discordId) return { awarded: false, achievement: null };

  let awarded = false;
  let updatedUser = null;
  const now = new Date().toISOString();

  updatedUser = updateUser(discordId, user => {
    user.username = username || user.username || 'Unknown';
    normalizeUserCollections(user);

    if (user.achievements.some(item => item.id === achievementId)) {
      return user;
    }

    user.achievements.push({
      id: achievementId,
      unlockedAt: now,
    });

    if (!user.badges.includes(achievement.badge)) {
      user.badges.push(achievement.badge);
    }

    awarded = true;
    return user;
  });

  return { awarded, achievement, user: updatedUser };
}

function awardMany(discordId, username, achievementIds) {
  const unlocked = [];
  for (const id of achievementIds) {
    const result = awardAchievement(discordId, username, id);
    if (result.awarded && result.achievement) unlocked.push(result.achievement);
  }
  return unlocked;
}

function checkLevelAchievements(discordId, username, level) {
  const ids = ['first_level'];
  if (level >= 5) ids.push('level_5');
  if (level >= 10) ids.push('level_10');
  if (level >= 20) ids.push('level_20');
  return awardMany(discordId, username, ids);
}

function getTopAchievementUsers(limit = 10) {
  return getUsers()
    .filter(user => !user.bot)
    .map(user => normalizeUserCollections(user))
    .sort((a, b) => {
      if ((b.achievements?.length || 0) !== (a.achievements?.length || 0)) {
        return (b.achievements?.length || 0) - (a.achievements?.length || 0);
      }
      return (b.level || 1) - (a.level || 1);
    })
    .slice(0, limit);
}

function buildUnlockedText(unlocked) {
  if (!unlocked || !unlocked.length) return '';
  return unlocked.map(item => `${item.badge} **${item.title}**`).join('\n');
}

function buildAchievementUnlockedEmbed(user, unlocked) {
  return new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle('🏅 Новое достижение!')
    .setDescription(`${user} открыл достижение:\n${buildUnlockedText(unlocked)}`)
    .setFooter({ text: 'ServerCore • Achievements' })
    .setTimestamp();
}

module.exports = {
  ACHIEVEMENTS,
  getAllAchievements,
  getAchievementById,
  getUserAchievements,
  awardAchievement,
  awardMany,
  checkLevelAchievements,
  getTopAchievementUsers,
  buildUnlockedText,
  buildAchievementUnlockedEmbed,
};
