const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { parseDuration, formatDuration, sendModerationLog, createLogEmbed, canModerateTarget, canBotModerateTarget, createModerationCase } = require('../services/moderationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Временно ограничить участника')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option => option.setName('user').setDescription('Участник').setRequired(true))
    .addStringOption(option => option.setName('duration').setDescription('Длительность: 10m, 2h, 1d. Максимум 28d').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Причина').setRequired(false)),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });

    const target = interaction.options.getUser('user');
    const durationInput = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'Не указана';
    const durationMs = parseDuration(durationInput);

    if (!durationMs) {
      await safeEdit(interaction, { content: '❌ Неверная длительность. Примеры: `10m`, `2h`, `1d`. Максимум — `28d`.' });
      return;
    }

    if (!target || target.bot) {
      await safeEdit(interaction, { content: '❌ Нельзя замьютить бота.' });
      return;
    }

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    const moderator = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    const botMember = await interaction.guild.members.fetchMe().catch(() => null);

    if (!member) {
      await safeEdit(interaction, { content: '❌ Участник не найден на сервере.' });
      return;
    }

    if (!canModerateTarget(moderator, member)) {
      await safeEdit(interaction, { content: '❌ Нельзя модерировать участника с равной или более высокой ролью.' });
      return;
    }

    if (!canBotModerateTarget(botMember, member)) {
      await safeEdit(interaction, { content: '❌ Роль бота должна быть выше роли участника.' });
      return;
    }

    try {
      await member.timeout(durationMs, reason);
    } catch (error) {
      console.error('Mute command error:', error);
      await safeEdit(interaction, { content: '❌ Не удалось выдать мут. Проверь право бота `Moderate Members`.' });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🔇 Участник ограничен')
      .setDescription(`**${target.username}** получил тайм-аут на **${formatDuration(durationMs)}**.`)
      .addFields({ name: 'Причина', value: reason, inline: false })
      .setFooter({ text: 'ServerCore • Moderation' });

    const modCase = createModerationCase({ guildId: interaction.guild.id, userId: target.id, username: target.username, moderatorId: interaction.user.id, moderatorName: interaction.user.username, type: 'mute', reason, duration: formatDuration(durationMs) });
    embed.addFields({ name: 'Дело', value: `#${modCase.id}`, inline: true });

    await safeEdit(interaction, { embeds: [embed] });

    await sendModerationLog(interaction.guild, {
      embeds: [createLogEmbed({
        title: '🔇 Мут участника',
        color: 0xED4245,
        moderator: interaction.user,
        target,
        reason,
        fields: [{ name: 'Длительность', value: formatDuration(durationMs), inline: true }],
      })],
    });
  },
};
