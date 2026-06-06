const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { claimDaily } = require('./economyService');
const { getUserStats, getRequiredXp, syncMemberLevelRoles } = require('./xpService');
const { getOrCreateUser } = require('./dataStore');
const { getEconomyHistory } = require('./managementUxService');
const { formatBoosts } = require('./inventoryService');
const { getUserAchievements } = require('./achievementService');
const { getSeasonProgress } = require('./battlePassService');
const { incrementQuestProgress, buildQuestCompletedText } = require('./questService');
const { buildUnlockedText } = require('./achievementService');
const { buildShopPanel } = require('./shopPanel');
const { buildGamePanel } = require('./gamePanel');
const { createTicket } = require('./ticketService');
const { buildMainMenuPayload, buildSectionPayload } = require('./userMenuService');
const { buildWebPanelMenuPayload } = require('./webPanelMenuService');
const { buildHelpPayload } = require('../commands/help');

function backRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('menu:back').setLabel('Назад в меню').setEmoji('⬅️').setStyle(ButtonStyle.Secondary)
  );
}

function formatHistory(rows = []) {
  if (!rows.length) return 'История операций пока пустая.';
  return rows.map(row => {
    const sign = Number(row.amount || 0) >= 0 ? '+' : '';
    const date = row.createdAt ? `<t:${Math.floor(new Date(row.createdAt).getTime() / 1000)}:R>` : 'недавно';
    const details = row.meta?.itemName ? ` — ${row.meta.itemName}` : '';
    return `${sign}${row.amount} монет • ${row.type}${details} • ${date}`;
  }).join('\n').slice(0, 3800);
}

function typeLabel(type) {
  return {
    cosmetic: '🎨 косметика',
    boost: '⚡ буст',
    ticket: '🎟 билет',
    custom: '📝 заявка',
    role: '🎭 роль',
    consumable: '📦 предмет'
  }[type] || '📦 предмет';
}

function formatInventory(user) {
  const inventory = Array.isArray(user.inventory) ? user.inventory : [];
  if (!inventory.length) return 'Инвентарь пуст. Открой магазин через кнопку ниже и купи предмет.';
  return inventory.map((item, index) => {
    const qty = Number(item.quantity || 1) > 1 ? ` ×${item.quantity}` : '';
    const useHint = ['boost', 'ticket', 'custom', 'consumable'].includes(item.type) ? `\nМожно применить через \`/use item:${item.id}\`.` : '';
    return `**${index + 1}. ${item.name || item.id}${qty}**\nТип: ${typeLabel(item.type)}${useHint}`;
  }).join('\n\n').slice(0, 3800);
}

function buildProfileActionPayload(discordUser, stats, member = null) {
  const requiredXp = getRequiredXp(stats.level || 1);
  const achievements = getUserAchievements(discordUser.id, discordUser.username);
  const season = getSeasonProgress(stats.seasonXp || 0);
  const roles = member
    ? member.roles.cache.filter(role => role.name !== '@everyone').map(role => role.name).slice(0, 8).join(', ') || 'Нет ролей'
    : 'Нет данных';

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`👤 Профиль: ${discordUser.username}`)
    .setThumbnail(discordUser.displayAvatarURL({ size: 128 }))
    .addFields(
      { name: 'Уровень', value: String(stats.level || 1), inline: true },
      { name: 'XP', value: `${stats.xp || 0} / ${requiredXp}`, inline: true },
      { name: 'Сообщений', value: String(stats.messages || 0), inline: true },
      { name: 'Монеты', value: String(stats.coins || 0), inline: true },
      { name: 'Репутация', value: String(stats.reputation || 0), inline: true },
      { name: 'Battle Pass', value: `Ур. ${season.level} • ${stats.seasonXp || 0} XP`, inline: true },
      { name: 'Достижения', value: `${achievements.unlockedCount} / ${achievements.total}`, inline: true },
      { name: 'Бейджи', value: achievements.badges.length ? achievements.badges.join(' ') : 'Нет бейджей', inline: false },
      { name: 'Роли', value: roles, inline: false }
    )
    .setFooter({ text: 'ServerCore • Быстрое действие меню' });

  return { embeds: [embed], components: [backRow()] };
}

function buildBalanceActionPayload(user, stats) {
  const history = getEconomyHistory(user.id, 5);
  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle(`💰 Баланс: ${user.username}`)
    .setThumbnail(user.displayAvatarURL({ size: 128 }))
    .setDescription(`Монеты: **${stats.coins || 0}**`)
    .addFields(
      { name: '📜 Последние 5 операций', value: formatHistory(history), inline: false },
      { name: 'Полная история', value: 'Для расширенной истории используй `/balance-history`.', inline: false }
    )
    .setFooter({ text: 'ServerCore • Balance' });
  return { embeds: [embed], components: [backRow()] };
}

function buildInventoryActionPayload(userProfile) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🎒 Инвентарь')
    .setDescription(formatInventory(userProfile))
    .addFields({ name: '⚡ Активные бусты', value: formatBoosts(userProfile), inline: false })
    .setFooter({ text: 'ServerCore • Inventory' });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('menu:quick:shop').setLabel('Открыть магазин').setEmoji('🛒').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('menu:back').setLabel('Назад').setEmoji('⬅️').setStyle(ButtonStyle.Secondary)
  );
  return { embeds: [embed], components: [row] };
}

async function buildDailyActionPayload(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const result = await claimDaily(member);

  if (!result.ok && result.reason === 'cooldown') {
    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('⏳ Ежедневная награда уже получена')
      .setDescription(`Следующую награду можно получить через **${result.remainingText}**.`)
      .setFooter({ text: 'ServerCore • Daily Reward' });
    return { embeds: [embed], components: [backRow()] };
  }

  const questResult = incrementQuestProgress(interaction.user.id, interaction.user.username, 'daily', 1);
  const user = result.user;
  const requiredXp = getRequiredXp(user.level || 1);
  const description = [
    `Ты получил **${result.coins} монет** и **${result.xp} XP**.`,
    `Баланс: **${user.coins || 0} монет**`,
    `Уровень: **${user.level || 1}**`,
    `XP: **${user.xp || 0} / ${requiredXp}**`
  ];
  if (result.leveledUp) description.push('', `🎉 Новый уровень: **${result.newLevel}**!`);
  if (result.roleSync?.added?.length) description.push(`🎭 Выданы роли: **${result.roleSync.added.join(', ')}**`);
  if (questResult.completedNow) description.push(buildQuestCompletedText(questResult));
  if (result.unlockedAchievements?.length) description.push('', '🏅 **Новые достижения:**', buildUnlockedText(result.unlockedAchievements));

  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('🎁 Ежедневная награда')
    .setDescription(description.join('\n'))
    .setFooter({ text: 'ServerCore • Economy' });
  return { embeds: [embed], components: [backRow()] };
}

async function buildTicketActionPayload(interaction) {
  const result = await createTicket(interaction, '📌 Другое: создано через главное меню', { templateId: 'other', priority: 'normal' });
  if (!result.ok && result.reason === 'already_open') {
    const channelText = result.channel ? `${result.channel}` : 'старый канал не найден';
    return { content: `⚠️ У тебя уже есть открытый тикет: ${channelText}`, embeds: [], components: [backRow()] };
  }
  return { content: `✅ Тикет создан: ${result.channel}`, embeds: [], components: [backRow()] };
}

function buildAchievementsActionPayload(user) {
  const data = getUserAchievements(user.id, user.username);
  const embed = new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle('🏆 Достижения и бейджи')
    .setDescription(`Открыто достижений: **${data.unlockedCount} / ${data.total}**`)
    .addFields(
      { name: 'Бейджи', value: data.badges.length ? data.badges.join(' ') : 'Нет бейджей', inline: false },
      { name: 'Последние достижения', value: data.unlocked.slice(-8).map(a => `${a.emoji || '🏅'} ${a.name}`).join('\n') || 'Пока нет достижений.', inline: false }
    )
    .setFooter({ text: 'ServerCore • Achievements' });
  return { embeds: [embed], components: [backRow()] };
}

function buildBattlePassActionPayload(user, stats) {
  const progress = getSeasonProgress(stats.seasonXp || 0);
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('🏆 Battle Pass')
    .setDescription([
      `Уровень Battle Pass: **${progress.level}**`,
      `Сезонный XP: **${progress.totalXp}**`,
      `Прогресс уровня: **${progress.current} / ${progress.required}**`,
      '',
      'Награды можно забрать через `/battlepass claim`.'
    ].join('\n'))
    .setFooter({ text: 'ServerCore • Battle Pass' });
  return { embeds: [embed], components: [backRow()] };
}

async function buildUserActionPayload(interaction, kind) {
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  const stats = getUserStats(interaction.user.id, interaction.user.username);
  if (member) await syncMemberLevelRoles(member, stats.level || 1).catch(() => null);

  if (kind === 'profile' || kind === 'profilecard') return buildProfileActionPayload(interaction.user, stats, member);
  if (kind === 'daily') return buildDailyActionPayload(interaction);
  if (kind === 'balance' || kind === 'economy') return buildBalanceActionPayload(interaction.user, stats);
  if (kind === 'inventory') return buildInventoryActionPayload(getOrCreateUser(interaction.user.id, interaction.user.username));
  if (kind === 'shop') return buildShopPanel();
  if (kind === 'games') return buildGamePanel();
  if (kind === 'ticket') return buildTicketActionPayload(interaction);
  if (kind === 'achievements') return buildAchievementsActionPayload(interaction.user);
  if (kind === 'battlepass') return buildBattlePassActionPayload(interaction.user, stats);
  if (kind === 'webpanel') return buildWebPanelMenuPayload();
  if (kind === 'help') return buildHelpPayload('start');
  if (kind === 'voice') return buildSectionPayload('voice');
  if (kind === 'event' || kind === 'lfg') return buildSectionPayload('activities');
  if (kind === 'suggest' || kind === 'apply') return buildSectionPayload('support');
  if (kind === 'modpanel') return buildSectionPayload('moderation');
  return buildMainMenuPayload();
}

module.exports = {
  buildUserActionPayload,
  buildProfileActionPayload,
  buildBalanceActionPayload,
  buildInventoryActionPayload,
};
