const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getUserStats, getRequiredXp, syncMemberLevelRoles } = require('../services/xpService');

function createProgressBar(current, total, size = 12) {
  const safeTotal = Math.max(total, 1);
  const filled = Math.round((current / safeTotal) * size);
  return '█'.repeat(Math.min(filled, size)) + '░'.repeat(Math.max(size - filled, 0));
}

function resolveTargetUser(interaction) {
  const selectedUser = interaction.options.getUser('user');

  // Боты не участвуют в XP-системе. Если случайно выбран бот, показываем ранг автора команды.
  if (selectedUser && !selectedUser.bot) return selectedUser;
  return interaction.user;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Показать уровень и прогресс XP')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Участник, чей ранг нужно посмотреть')
        .setRequired(false)
    ),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });

    const target = resolveTargetUser(interaction);

    if (target.bot) {
      await safeEdit(interaction, { content: '🤖 Боты не участвуют в системе рангов и XP.' });
      return;
    }

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    const stats = getUserStats(target.id, target.username);
    if (member) await syncMemberLevelRoles(member, stats.level || 1).catch(() => null);
    const requiredXp = getRequiredXp(stats.level || 1);
    const remainingXp = Math.max(requiredXp - (stats.xp || 0), 0);
    const progressBar = createProgressBar(stats.xp || 0, requiredXp);

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle(`🏆 Ранг: ${target.username}`)
      .setThumbnail(target.displayAvatarURL({ size: 128 }))
      .setDescription([
        `**Уровень:** ${stats.level || 1}`,
        `**XP:** ${stats.xp || 0} / ${requiredXp}`,
        `**До следующего уровня:** ${remainingXp} XP`,
        '',
        progressBar
      ].join('\n'))
      .setFooter({ text: 'ServerCore • Rank System' });

    await safeEdit(interaction, { embeds: [embed] });
  }
};
