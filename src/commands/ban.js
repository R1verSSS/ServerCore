const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { sendModerationLog, createLogEmbed, canModerateTarget, canBotModerateTarget, createModerationCase } = require('../services/moderationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Забанить участника')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(option => option.setName('user').setDescription('Участник').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Причина').setRequired(false))
    .addIntegerOption(option => option.setName('delete_days').setDescription('Удалить сообщения за N дней: 0-7').setRequired(false).setMinValue(0).setMaxValue(7)),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });

    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'Не указана';
    const deleteDays = interaction.options.getInteger('delete_days') ?? 0;

    if (!target) {
      await safeEdit(interaction, { content: '❌ Участник не указан.' });
      return;
    }

    if (target.id === interaction.user.id) {
      await safeEdit(interaction, { content: '❌ Нельзя забанить самого себя.' });
      return;
    }

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    const moderator = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    const botMember = await interaction.guild.members.fetchMe().catch(() => null);

    if (member && (!canModerateTarget(moderator, member) || !canBotModerateTarget(botMember, member))) {
      await safeEdit(interaction, { content: '❌ Нельзя забанить участника с равной/более высокой ролью или роль бота ниже роли участника.' });
      return;
    }

    try {
      await interaction.guild.members.ban(target.id, {
        reason,
        deleteMessageSeconds: deleteDays * 24 * 60 * 60,
      });
    } catch (error) {
      console.error('Ban command error:', error);
      await safeEdit(interaction, { content: '❌ Не удалось забанить участника. Проверь право бота `Ban Members`.' });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🔨 Участник забанен')
      .setDescription(`**${target.username}** был забанен.`)
      .addFields(
        { name: 'Причина', value: reason, inline: false },
        { name: 'Удаление сообщений', value: `${deleteDays} дн.`, inline: true }
      )
      .setFooter({ text: 'ServerCore • Moderation' });

    const modCase = createModerationCase({ guildId: interaction.guild.id, userId: target.id, username: target.username, moderatorId: interaction.user.id, moderatorName: interaction.user.username, type: 'ban', reason, metadata: { deleteDays } });
    embed.addFields({ name: 'Дело', value: `#${modCase.id}`, inline: true });

    await safeEdit(interaction, { embeds: [embed] });

    await sendModerationLog(interaction.guild, {
      embeds: [createLogEmbed({
        title: '🔨 Ban участника',
        color: 0xED4245,
        moderator: interaction.user,
        target,
        reason,
        fields: [{ name: 'Удаление сообщений', value: `${deleteDays} дн.`, inline: true }],
      })],
    });
  },
};
