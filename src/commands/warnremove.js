const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { removeWarning, sendModerationLog, createLogEmbed } = require('../services/moderationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnremove')
    .setDescription('Снять предупреждение по ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addIntegerOption(option => option.setName('id').setDescription('ID предупреждения').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Причина снятия').setRequired(false)),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const id = interaction.options.getInteger('id');
    const reason = interaction.options.getString('reason') || 'Снято модератором.';
    const result = removeWarning(id, interaction.guild.id, interaction.user.id, interaction.user.username, reason);
    if (!result.ok) {
      const text = result.reason === 'already_removed' ? '⚠️ Это предупреждение уже снято.' : '❌ Предупреждение не найдено.';
      return safeEdit(interaction, { content: text });
    }
    const embed = new EmbedBuilder().setColor(0x57F287).setTitle('✅ Предупреждение снято').setDescription(`Предупреждение #${id} снято.`).addFields({ name: 'Причина', value: reason });
    await sendModerationLog(interaction.guild, {
      embeds: [createLogEmbed({ title: `✅ Предупреждение #${id} снято`, color: 0x57F287, moderator: interaction.user, target: { tag: result.warning.username, id: result.warning.userId }, reason })],
    });
    return safeEdit(interaction, { embeds: [embed] });
  }
};
