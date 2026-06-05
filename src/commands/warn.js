const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { addWarning, sendModerationLog, createLogEmbed } = require('../services/moderationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Выдать предупреждение участнику')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option => option.setName('user').setDescription('Участник').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Причина предупреждения').setRequired(false)),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });

    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'Не указана';

    if (!target || target.bot) {
      await safeEdit(interaction, { content: '❌ Нельзя выдать предупреждение боту.' });
      return;
    }

    if (target.id === interaction.user.id) {
      await safeEdit(interaction, { content: '❌ Нельзя выдать предупреждение самому себе.' });
      return;
    }

    const warning = addWarning({
      guildId: interaction.guild.id,
      userId: target.id,
      username: target.username,
      moderatorId: interaction.user.id,
      moderatorName: interaction.user.username,
      reason,
    });

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('⚠️ Предупреждение выдано')
      .setDescription(`Участник **${target.username}** получил предупреждение.`)
      .addFields(
        { name: 'ID предупреждения', value: `#${warning.id}`, inline: true },
        { name: 'Причина', value: reason, inline: false }
      )
      .setFooter({ text: 'ServerCore • Moderation' });

    await safeEdit(interaction, { embeds: [embed] });

    await sendModerationLog(interaction.guild, {
      embeds: [createLogEmbed({
        title: `⚠️ Предупреждение #${warning.id}`,
        color: 0xFEE75C,
        moderator: interaction.user,
        target,
        reason,
      })],
    });
  },
};
