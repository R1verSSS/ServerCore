const { EmbedBuilder } = require('discord.js');
const { getOrCreateUser, updateUser, getUsers } = require('./dataStore');
const { getSeason } = require('./seasonService');
const { addItemToInventory } = require('./inventoryService');

const XP_PER_SEASON_LEVEL = 250;

const FREE_REWARDS = [
  { level: 1, title: '100 монет', type: 'coins', amount: 100 },
  { level: 3, title: '🎟 Билет розыгрыша', type: 'item', item: { id: 'raffle_ticket', name: '🎟 Билет розыгрыша', type: 'ticket', description: 'Билет для ручного розыгрыша.', category: 'tickets' } },
  { level: 5, title: '300 монет', type: 'coins', amount: 300 },
  { level: 7, title: '⚡ XP Boost x2 на 24 часа', type: 'item', item: { id: 'xp_boost_24h', name: '⚡ XP Boost x2 на 24 часа', type: 'boost', boostType: 'xp', multiplier: 2, durationHours: 24, description: 'Удваивает XP на 24 часа.', category: 'boosts' } },
  { level: 10, title: '🏅 Бейдж сезона', type: 'badge', badge: '🏅' },
  { level: 15, title: '750 монет', type: 'coins', amount: 750 },
  { level: 20, title: '👑 Титул “Герой сезона”', type: 'title', titleValue: 'Герой сезона' },
  { level: 30, title: '💎 VIP на 7 дней', type: 'role', roleName: '💎 VIP' }
];

const PREMIUM_REWARDS = [
  { level: 1, title: '250 монет', type: 'coins', amount: 250 },
  { level: 3, title: '⚡ Coin Boost x2 на 24 часа', type: 'item', item: { id: 'coin_boost_24h', name: '⚡ Coin Boost x2 на 24 часа', type: 'boost', boostType: 'coins', multiplier: 2, durationHours: 24, description: 'Удваивает монеты на 24 часа.', category: 'boosts' } },
  { level: 5, title: '🌌 Фон профиля Neon Grid', type: 'item', item: { id: 'profile_bg_neon', name: '🌌 Фон профиля: Neon Grid', type: 'cosmetic', cosmeticType: 'background', value: 'neon', description: 'Косметический фон для /profilecard.', category: 'cosmetics' } },
  { level: 10, title: '🟡 Цвет профиля Gold', type: 'item', item: { id: 'profile_color_gold', name: '🟡 Цвет профиля: Gold', type: 'cosmetic', cosmeticType: 'color', value: 'gold', description: 'Косметический цвет профиля.', category: 'cosmetics' } },
  { level: 15, title: '1500 монет', type: 'coins', amount: 1500 },
  { level: 20, title: '📝 Заявка на кастомную роль', type: 'item', item: { id: 'custom_role_request', name: '📝 Заявка на кастомную роль', type: 'custom', description: 'Используй предмет и создай тикет для заявки.', category: 'special' } },
  { level: 30, title: '👑 Премиум-бейдж сезона', type: 'badge', badge: '👑' }
];

function getSeasonKey() {
  const season = getSeason();
  return `${season.name || 'season'}:${season.endsAt || 'no_end'}`;
}

function getSeasonLevel(seasonXp = 0) {
  return Math.max(Math.floor(Number(seasonXp || 0) / XP_PER_SEASON_LEVEL) + 1, 1);
}

function getSeasonProgress(seasonXp = 0) {
  const xp = Number(seasonXp || 0);
  const level = getSeasonLevel(xp);
  const currentLevelStart = (level - 1) * XP_PER_SEASON_LEVEL;
  const current = xp - currentLevelStart;
  return { level, current, required: XP_PER_SEASON_LEVEL, totalXp: xp, nextLevelXp: level * XP_PER_SEASON_LEVEL };
}

function normalizeClaims(user) {
  if (!user.seasonRewardClaims || typeof user.seasonRewardClaims !== 'object') user.seasonRewardClaims = {};
  const key = getSeasonKey();
  if (!user.seasonRewardClaims[key]) user.seasonRewardClaims[key] = { free: [], premium: [] };
  if (!Array.isArray(user.seasonRewardClaims[key].free)) user.seasonRewardClaims[key].free = [];
  if (!Array.isArray(user.seasonRewardClaims[key].premium)) user.seasonRewardClaims[key].premium = [];
  return user.seasonRewardClaims[key];
}

function getRewardList(track = 'free') {
  return track === 'premium' ? PREMIUM_REWARDS : FREE_REWARDS;
}

function getBattlePassStatus(discordId, username) {
  const user = getOrCreateUser(discordId, username);
  const season = getSeason();
  const progress = getSeasonProgress(user.seasonXp || 0);
  const claims = normalizeClaims(user);
  return {
    user,
    season,
    progress,
    premium: Boolean(user.battlePassPremium),
    claims,
    freeRewards: FREE_REWARDS,
    premiumRewards: PREMIUM_REWARDS
  };
}

function formatRewards(rewards, progress, claimedLevels = []) {
  return rewards.map(reward => {
    const unlocked = progress.level >= reward.level;
    const claimed = claimedLevels.includes(reward.level);
    const status = claimed ? '✅ получено' : unlocked ? '🟢 доступно' : '🔒 закрыто';
    return `**${reward.level} ур.** — ${reward.title} — ${status}`;
  }).join('\n');
}

async function giveRoleReward(member, roleName) {
  if (!member?.guild || !roleName) return { ok: false, reason: 'no_member' };
  const role = member.guild.roles.cache.find(item => item.name === roleName);
  if (!role) return { ok: false, reason: 'role_not_found' };
  if (member.roles.cache.has(role.id)) return { ok: true, alreadyHad: true };
  await member.roles.add(role);
  return { ok: true };
}

async function applyReward(member, reward) {
  const userId = member.user.id;
  const username = member.user.username;

  if (reward.type === 'coins') {
    const updated = updateUser(userId, user => {
      user.username = username;
      user.coins = Number(user.coins || 0) + Number(reward.amount || 0);
      return user;
    });
    return { text: `+${reward.amount} монет`, user: updated };
  }

  if (reward.type === 'item') {
    addItemToInventory(userId, username, reward.item);
    return { text: `предмет “${reward.item.name}” добавлен в инвентарь` };
  }

  if (reward.type === 'badge') {
    const updated = updateUser(userId, user => {
      user.username = username;
      if (!Array.isArray(user.badges)) user.badges = [];
      if (!user.badges.includes(reward.badge)) user.badges.push(reward.badge);
      return user;
    });
    return { text: `бейдж ${reward.badge} добавлен`, user: updated };
  }

  if (reward.type === 'title') {
    const updated = updateUser(userId, user => {
      user.username = username;
      if (!user.profileCustomization) user.profileCustomization = {};
      user.profileCustomization.title = reward.titleValue;
      return user;
    });
    return { text: `титул “${reward.titleValue}” установлен`, user: updated };
  }

  if (reward.type === 'role') {
    const roleResult = await giveRoleReward(member, reward.roleName);
    if (!roleResult.ok) return { text: `роль “${reward.roleName}” не найдена или не выдана` };
    return { text: `роль “${reward.roleName}” выдана` };
  }

  return { text: 'награда обработана' };
}

async function claimBattlePassReward(member, track, level) {
  const normalizedTrack = track === 'premium' ? 'premium' : 'free';
  const reward = getRewardList(normalizedTrack).find(item => item.level === Number(level));
  if (!reward) return { ok: false, reason: 'not_found' };

  const status = getBattlePassStatus(member.user.id, member.user.username);
  if (!status.season.active) return { ok: false, reason: 'season_inactive' };
  if (normalizedTrack === 'premium' && !status.premium) return { ok: false, reason: 'premium_required' };
  if (status.progress.level < reward.level) return { ok: false, reason: 'level_required', reward, progress: status.progress };
  if (status.claims[normalizedTrack].includes(reward.level)) return { ok: false, reason: 'already_claimed', reward };

  const applied = await applyReward(member, reward);
  const updated = updateUser(member.user.id, user => {
    normalizeClaims(user);
    user.seasonRewardClaims[getSeasonKey()][normalizedTrack].push(reward.level);
    return user;
  });

  return { ok: true, reward, applied, user: updated };
}

function setBattlePassPremium(discordId, username, enabled) {
  return updateUser(discordId, user => {
    user.username = username || user.username;
    user.battlePassPremium = Boolean(enabled);
    return user;
  });
}

function getSeasonLeaderboard(limit = 10) {
  return getUsers().sort((a, b) => Number(b.seasonXp || 0) - Number(a.seasonXp || 0)).slice(0, limit);
}

function buildBattlePassEmbed(discordUser) {
  const status = getBattlePassStatus(discordUser.id, discordUser.username);
  const { season, progress, claims } = status;
  const barSize = 12;
  const filled = Math.min(Math.round((progress.current / progress.required) * barSize), barSize);
  const bar = '█'.repeat(filled) + '░'.repeat(barSize - filled);
  return new EmbedBuilder()
    .setColor(status.premium ? 0xF1C40F : 0x5865F2)
    .setTitle(`🎟 Battle Pass — ${season.name}`)
    .setDescription(`Статус сезона: **${season.active ? 'активен' : 'выключен'}**\nПремиум: **${status.premium ? 'активен' : 'не активен'}**\nСезонный уровень: **${progress.level}**\nПрогресс: **${progress.current}/${progress.required} XP**\n${bar}`)
    .addFields(
      { name: 'Бесплатная ветка', value: formatRewards(FREE_REWARDS, progress, claims.free).slice(0, 1024), inline: false },
      { name: 'Премиум-ветка', value: formatRewards(PREMIUM_REWARDS, progress, claims.premium).slice(0, 1024), inline: false }
    )
    .setFooter({ text: 'Используй /battlepass claim для получения доступных наград' });
}

module.exports = {
  XP_PER_SEASON_LEVEL,
  FREE_REWARDS,
  PREMIUM_REWARDS,
  getSeasonKey,
  getSeasonLevel,
  getSeasonProgress,
  getBattlePassStatus,
  formatRewards,
  claimBattlePassReward,
  setBattlePassPremium,
  getSeasonLeaderboard,
  buildBattlePassEmbed
};
