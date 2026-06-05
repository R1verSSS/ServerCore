const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getWarnings } = require('../services/moderationService');

function formatWarning(item) {
  const date = item.createdAt ? new Date(item.createdAt).toLocaleString('ru-RU') : 'неизвестно';
  return `#${item.id} • ${date}\nМодератор: ${item.moderatorName || item.moderatorId}\nПричина: ${item.reason || 'Не указана'}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Показать предупреждения участника')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option => option.setName('user').setDescription('Участник').setRequired(true)),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });

    const target = interaction.options.getUser('user');
    if (!target || target.bot) {
      await safeEdit(interaction, { content: '❌ У ботов нет предупреждений.' });
      return;
    }

    const warnings = getWarnings(target.id, interaction.guild.id);
    const description = warnings.length
      ? warnings.slice(-10).map(formatWarning).join('\n\n')
      : 'Активных предупреждений нет.';

    const embed = new EmbedBuilder()
      .setColor(warnings.length ? 0xFEE75C : 0x57F287)
      .setTitle(`⚠️ Предупреждения: ${target.username}`)
      .setThumbnail(target.displayAvatarURL({ size: 128 }))
      .setDescription(description)
      .addFields({ name: 'Всего активных', value: `${warnings.length}`, inline: true })
      .setFooter({ text: 'ServerCore • Moderation' });

    await safeEdit(interaction, { embeds: [embed] });
  },
};
