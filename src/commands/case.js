const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getCase, closeCase, sendModerationLog, createLogEmbed } = require('../services/moderationService');

function caseEmbed(item) {
  const embed = new EmbedBuilder()
    .setColor(item.status === 'closed' ? 0x57F287 : 0xFEE75C)
    .setTitle(`📁 Дело модерации #${item.id}`)
    .addFields(
      { name: 'Тип', value: item.type || 'unknown', inline: true },
      { name: 'Статус', value: item.status || 'active', inline: true },
      { name: 'Участник', value: `${item.username || 'Unknown'} (${item.userId})`, inline: false },
      { name: 'Модератор', value: `${item.moderatorName || 'System'}${item.moderatorId ? ` (${item.moderatorId})` : ''}`, inline: false },
      { name: 'Причина', value: item.reason || 'Не указана', inline: false },
      { name: 'Дата', value: item.createdAt ? new Date(item.createdAt).toLocaleString('ru-RU') : 'неизвестно', inline: true }
    )
    .setFooter({ text: 'ServerCore • Moderation Case' });
  if (item.duration) embed.addFields({ name: 'Длительность', value: item.duration, inline: true });
  if (item.referenceId) embed.addFields({ name: 'Связь', value: item.referenceId, inline: true });
  if (item.status === 'closed') embed.addFields({ name: 'Закрыто', value: `${item.closedByName || 'Unknown'} • ${item.closeComment || 'Без комментария'}`, inline: false });
  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('case')
    .setDescription('Просмотр или закрытие дела модерации')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub => sub.setName('info').setDescription('Показать дело').addIntegerOption(option => option.setName('id').setDescription('ID дела').setRequired(true)))
    .addSubcommand(sub => sub.setName('close').setDescription('Закрыть дело').addIntegerOption(option => option.setName('id').setDescription('ID дела').setRequired(true)).addStringOption(option => option.setName('comment').setDescription('Комментарий').setRequired(false))),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();
    const id = interaction.options.getInteger('id');

    if (sub === 'info') {
      const item = getCase(id, interaction.guild.id);
      if (!item) return safeEdit(interaction, { content: '❌ Дело не найдено.' });
      return safeEdit(interaction, { embeds: [caseEmbed(item)] });
    }

    const comment = interaction.options.getString('comment') || 'Закрыто модератором.';
    const result = closeCase(id, interaction.guild.id, interaction.user.id, interaction.user.username, comment);
    if (!result.ok) return safeEdit(interaction, { content: '❌ Дело не найдено.' });

    await sendModerationLog(interaction.guild, {
      embeds: [createLogEmbed({
        title: `📁 Дело #${id} закрыто`,
        color: 0x57F287,
        moderator: interaction.user,
        target: { tag: result.case.username, id: result.case.userId },
        reason: comment,
      })],
    });

    return safeEdit(interaction, { content: `✅ Дело #${id} закрыто.`, embeds: [caseEmbed(result.case)] });
  }
};
