const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getOrCreateUser, updateUser, getUsers } = require('./dataStore');
const { awardAchievement, checkLevelAchievements, buildAchievementUnlockedEmbed } = require('./achievementService');
const { getSettings } = require('./settingsService');
const { applyBoostToAmount } = require('./inventoryService');
const { addAudit } = require('./auditService');

const DEFAULT_LEVEL_ROLE_REWARDS = [
  { level: 5, roleName: 'Уровень 5 — Активный', color: 0x57F287 },
  { level: 10, roleName: 'Уровень 10 — Свой', color: 0xFEE75C },
  { level: 20, roleName: 'Уровень 20 — Легенда', color: 0xEB459E }
];

function parseLevelRoleRewards() {
  const raw = process.env.LEVEL_ROLE_REWARDS;
  if (!raw) return DEFAULT_LEVEL_ROLE_REWARDS;

  const parsed = raw
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const [levelRaw, ...roleParts] = item.split(':');
      const level = Number(levelRaw);
      const roleName = roleParts.join(':').trim();
      if (!Number.isFinite(level) || level <= 0 || !roleName) return null;
      const fallback = DEFAULT_LEVEL_ROLE_REWARDS.find(reward => reward.level === level);
      return { level, roleName, color: fallback?.color || 0x5865F2 };
    })
    .filter(Boolean)
    .sort((a, b) => a.level - b.level);

  return parsed.length ? parsed : DEFAULT_LEVEL_ROLE_REWARDS;
}

const LEVEL_ROLE_REWARDS = parseLevelRoleRewards();

function getRequiredXp(level) {
  return level * 100;
}

function normalizeLevelProgress(user) {
  user.level = Math.max(Number(user.level || 1), 1);
  user.xp = Math.max(Number(user.xp || 0), 0);

  let changed = false;
  while (user.xp >= getRequiredXp(user.level)) {
    user.xp -= getRequiredXp(user.level);
    user.level += 1;
    changed = true;
  }

  return changed;
}

function normalizePersistedUser(discordId, username) {
  const before = getOrCreateUser(discordId, username);
  const needsNormalize = Number(before.xp || 0) >= getRequiredXp(before.level || 1) || !before.level;
  if (!needsNormalize) return before;

  return updateUser(discordId, user => {
    user.username = username || user.username;
    normalizeLevelProgress(user);
    return user;
  });
}

function getUserStats(discordId, username) {
  return normalizePersistedUser(discordId, username);
}

function getTopUsers(limit = 10) {
  return getUsers()
    .map(user => {
      if (Number(user.xp || 0) >= getRequiredXp(user.level || 1)) {
        return normalizePersistedUser(user.discordId, user.username);
      }
      return user;
    })
    .sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      if (b.xp !== a.xp) return b.xp - a.xp;
      return b.messages - a.messages;
    })
    .slice(0, limit);
}

async function ensureLevelRole(guild, reward) {
  let role = guild.roles.cache.find(item => item.name === reward.roleName);
  if (role) return role;

  const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
  if (!me?.permissions?.has(PermissionFlagsBits.ManageRoles) && !me?.permissions?.has(PermissionFlagsBits.Administrator)) {
    return null;
  }

  try {
    role = await guild.roles.create({
      name: reward.roleName,
      color: reward.color || 0x5865F2,
      permissions: [],
      reason: `ServerCore level role reward for level ${reward.level}`,
    });
    console.log(`[XP] Created missing level role: ${reward.roleName}`);
    return role;
  } catch (error) {
    console.warn(`[XP] Could not create level role ${reward.roleName}:`, error.message);
    return null;
  }
}

async function syncMemberLevelRoles(member, level, options = {}) {
  const summary = { ok: true, added: [], missing: [], failed: [] };
  if (!member?.guild || !member?.roles?.cache) return { ...summary, ok: false, reason: 'bad_member' };

  await member.guild.roles.fetch().catch(() => null);

  for (const reward of LEVEL_ROLE_REWARDS) {
    if (level < reward.level) continue;

    const role = await ensureLevelRole(member.guild, reward);
    if (!role) {
      summary.missing.push(reward.roleName);
      continue;
    }

    if (member.roles.cache.has(role.id)) continue;

    try {
      await member.roles.add(role, `ServerCore level reward: level ${level}`);
      summary.added.push(role.name);
    } catch (error) {
      summary.failed.push({ roleName: role.name, error: error.message });
      console.warn(`[XP] Could not add level role ${role.name} to ${member.user.tag}:`, error.message);
    }
  }

  if (summary.added.length && options.audit !== false) {
    try {
      addAudit('level_roles_sync', member.user, {
        level,
        added: summary.added,
        guildId: member.guild.id,
      });
    } catch (_) {}
  }

  return summary;
}

async function addXpToMember(member, amount) {
  if (!member || !member.user || member.user.bot || !amount || amount <= 0) {
    return { user: null, leveledUp: false, newLevel: null };
  }

  const discordId = member.user.id;
  const username = member.user.username;
  let leveledUp = false;
  let newLevel = 1;
  const beforeUser = getOrCreateUser(discordId, username);
  const finalAmount = applyBoostToAmount(beforeUser, amount, 'xp');

  const updatedUser = updateUser(discordId, user => {
    user.username = username;
    user.xp = (user.xp || 0) + finalAmount;
    user.seasonXp = (user.seasonXp || 0) + finalAmount;
    const beforeLevel = Number(user.level || 1);
    normalizeLevelProgress(user);
    leveledUp = Number(user.level || 1) > beforeLevel;
    newLevel = user.level;
    return user;
  });

  const roleSync = await syncMemberLevelRoles(member, newLevel);
  const unlockedAchievements = checkLevelAchievements(discordId, username, newLevel);

  return { user: updatedUser, leveledUp, newLevel, roleSync, unlockedAchievements, addedXp: finalAmount, baseXp: amount };
}

async function addMessageXp(message) {
  if (!message.guild || message.author.bot) return null;

  const now = Date.now();
  const username = message.author.username;
  const discordId = message.author.id;
  const currentUser = getOrCreateUser(discordId, username);
  const lastXpAt = currentUser.lastXpAt ? new Date(currentUser.lastXpAt).getTime() : 0;
  const settings = getSettings();
  const cooldownMs = Math.max(Number(settings.xpCooldownSeconds || 60), 0) * 1000;
  const xpPerMessage = Math.max(Number(settings.xpPerMessage || 5), 0);

  if (now - lastXpAt < cooldownMs) {
    const updatedNoXpUser = updateUser(discordId, user => {
      user.username = username;
      user.messages = (user.messages || 0) + 1;
      normalizeLevelProgress(user);
      return user;
    });

    if ((updatedNoXpUser.messages || 0) === 1) {
      awardAchievement(discordId, username, 'first_message');
    }
    return null;
  }

  let result = { user: currentUser, leveledUp: false, newLevel: currentUser.level || 1 };

  const updatedMessageUser = updateUser(discordId, user => {
    user.username = username;
    user.messages = (user.messages || 0) + 1;
    user.lastXpAt = new Date(now).toISOString();
    normalizeLevelProgress(user);
    return user;
  });

  const messageAchievements = [];
  if ((updatedMessageUser.messages || 0) === 1) {
    const firstMessage = awardAchievement(discordId, username, 'first_message');
    if (firstMessage.awarded) messageAchievements.push(firstMessage.achievement);
  }

  result = await addXpToMember(message.member, xpPerMessage);

  const unlockedAchievements = [
    ...messageAchievements,
    ...(result.unlockedAchievements || [])
  ];

  if (result.leveledUp && message.member) {
    const roleText = result.roleSync?.added?.length ? `\n🎭 Выданы роли: **${result.roleSync.added.join(', ')}**` : '';
    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('🎉 Новый уровень!')
      .setDescription(`${message.author} достиг уровня **${result.newLevel}**.${roleText}`)
      .setFooter({ text: 'ServerCore • XP System' });

    try {
      await message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.warn('Could not send level up message:', error.message);
    }
  }

  if (unlockedAchievements.length && message.member) {
    const embed = buildAchievementUnlockedEmbed(message.author, unlockedAchievements);

    try {
      await message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.warn('Could not send achievement message:', error.message);
    }
  }

  return result.user;
}

module.exports = {
  LEVEL_ROLE_REWARDS,
  addMessageXp,
  addXpToMember,
  getUserStats,
  getTopUsers,
  getRequiredXp,
  normalizeLevelProgress,
  syncMemberLevelRoles,
};
