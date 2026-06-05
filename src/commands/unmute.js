const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { sendModerationLog, createLogEmbed, canModerateTarget, canBotModerateTarget, createModerationCase } = require('../services/moderationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Снять ограничение с участника')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option => option.setName('user').setDescription('Участник').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Причина').setRequired(false)),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });

    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'Не указана';

    if (!target || target.bot) {
      await safeEdit(interaction, { content: '❌ Нельзя применить команду к боту.' });
      return;
    }

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    const moderator = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    const botMember = await interaction.guild.members.fetchMe().catch(() => null);

    if (!member) {
      await safeEdit(interaction, { content: '❌ Участник не найден на сервере.' });
      return;
    }

    if (!canModerateTarget(moderator, member) || !canBotModerateTarget(botMember, member)) {
      await safeEdit(interaction, { content: '❌ Недостаточно прав или роль бота ниже роли участника.' });
      return;
    }

    try {
      await member.timeout(null, reason);
    } catch (error) {
      console.error('Unmute command error:', error);
      await safeEdit(interaction, { content: '❌ Не удалось снять мут. Проверь право бота `Moderate Members`.' });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('🔊 Ограничение снято')
      .setDescription(`С участника **${target.username}** снят тайм-аут.`)
      .addFields({ name: 'Причина', value: reason, inline: false })
      .setFooter({ text: 'ServerCore • Moderation' });

    const modCase = createModerationCase({ guildId: interaction.guild.id, userId: target.id, username: target.username, moderatorId: interaction.user.id, moderatorName: interaction.user.username, type: 'unmute', reason });
    embed.addFields({ name: 'Дело', value: `#${modCase.id}`, inline: true });

    await safeEdit(interaction, { embeds: [embed] });

    await sendModerationLog(interaction.guild, {
      embeds: [createLogEmbed({
        title: '🔊 Снятие мута',
        color: 0x57F287,
        moderator: interaction.user,
        target,
        reason,
      })],
    });
  },
};
