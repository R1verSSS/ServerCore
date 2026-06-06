const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getUserStats, getRequiredXp, syncMemberLevelRoles } = require('../services/xpService');
const { getUserAchievements } = require('../services/achievementService');
const { getProfile, getColor, getBackground } = require('../services/profileCustomizationService');
const { getSeasonProgress } = require('../services/battlePassService');

function resolveTargetUser(interaction) {
  const selectedUser = interaction.options.getUser('user');

  // Боты не участвуют в XP-системе. Если случайно выбран бот, показываем профиль автора команды.
  if (selectedUser && !selectedUser.bot) return selectedUser;
  return interaction.user;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Показать профиль участника')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Участник, чей профиль нужно посмотреть')
        .setRequired(false)
    ),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });

    const target = resolveTargetUser(interaction);

    if (target.bot) {
      await safeEdit(interaction, { content: '🤖 Боты не участвуют в системе профилей и XP.' });
      return;
    }

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    const stats = getUserStats(target.id, target.username);
    if (member) await syncMemberLevelRoles(member, stats.level || 1).catch(() => null);
    const requiredXp = getRequiredXp(stats.level || 1);
    const achievementData = getUserAchievements(target.id, target.username);
    const customProfile = getProfile(target.id, target.username);
    const customColor = getColor(customProfile.color);
    const customBackground = getBackground(customProfile.background);
    const badges = achievementData.badges.length ? achievementData.badges.join(' ') : 'Нет бейджей';
    const seasonProgress = getSeasonProgress(stats.seasonXp || 0);

    const roles = member
      ? member.roles.cache
          .filter(role => role.name !== '@everyone')
          .map(role => role.name)
          .slice(0, 6)
          .join(', ') || 'Нет ролей'
      : 'Нет данных';

    const embed = new EmbedBuilder()
      .setColor(customColor.hex)
      .setTitle(`${customProfile.mainBadge || '👤'} Профиль: ${target.username}`)
      .setDescription(`**${customProfile.title}**\n${customProfile.about}`)
      .setThumbnail(target.displayAvatarURL({ size: 128 }))
      .addFields(
        { name: 'Уровень', value: String(stats.level || 1), inline: true },
        { name: 'XP', value: `${stats.xp || 0} / ${requiredXp}`, inline: true },
        { name: 'Сообщений', value: String(stats.messages || 0), inline: true },
        { name: 'Монеты', value: String(stats.coins || 0), inline: true },
        { name: 'Репутация', value: String(stats.reputation || 0), inline: true },
        { name: 'Достижения', value: `${achievementData.unlockedCount} / ${achievementData.total}`, inline: true },
        { name: 'Battle Pass', value: `Ур. ${seasonProgress.level} • ${stats.seasonXp || 0} XP`, inline: true },
        ...(customProfile.showStats ? [
          { name: 'Мини-игры', value: `${stats.gameStats?.played || 0} игр / ${stats.gameStats?.wins || 0} побед`, inline: true },
          { name: 'Квесты', value: `${stats.questStats?.completed || 0} выполнено`, inline: true }
        ] : []),
        { name: 'Оформление', value: `${customColor.emoji} ${customColor.name} • ${customBackground.emoji} ${customBackground.name}`, inline: false },
        ...(customProfile.showBadges ? [{ name: 'Бейджи', value: badges, inline: false }] : []),
        { name: 'Роли', value: roles, inline: false }
      )
      .setFooter({ text: 'ServerCore • Profile System' });

    await safeEdit(interaction, { embeds: [embed] });
  }
};
