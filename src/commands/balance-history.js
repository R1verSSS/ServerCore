const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getEconomyHistory } = require('../services/managementUxService');
const { getUserStats } = require('../services/xpService');

function formatHistory(rows) {
  if (!rows.length) return 'История операций пока пустая.';
  return rows.map((row, index) => {
    const sign = Number(row.amount || 0) >= 0 ? '+' : '';
    const date = row.createdAt ? `<t:${Math.floor(new Date(row.createdAt).getTime() / 1000)}:g>` : 'недавно';
    const details = row.meta?.itemName ? ` — ${row.meta.itemName}` : '';
    return `**${index + 1}.** ${sign}${row.amount} монет • ${row.type}${details} • ${date}`;
  }).join('\n').slice(0, 3900);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance-history')
    .setDescription('Показать расширенную историю экономики')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Участник, чью историю нужно посмотреть')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName('limit')
        .setDescription('Сколько операций показать')
        .setRequired(false)
        .addChoices(
          { name: '10 операций', value: 10 },
          { name: '25 операций', value: 25 },
          { name: '50 операций', value: 50 }
        )
    ),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });

    const selectedUser = interaction.options.getUser('user');
    const target = selectedUser && !selectedUser.bot ? selectedUser : interaction.user;
    const limit = interaction.options.getInteger('limit') || 25;
    const stats = getUserStats(target.id, target.username);
    const rows = getEconomyHistory(target.id, limit);

    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle(`📜 История экономики: ${target.username}`)
      .setThumbnail(target.displayAvatarURL({ size: 128 }))
      .setDescription(formatHistory(rows))
      .addFields({ name: 'Текущий баланс', value: `**${stats.coins || 0}** монет`, inline: true })
      .setFooter({ text: `ServerCore • Economy History • ${rows.length}/${limit}` });

    await safeEdit(interaction, { embeds: [embed] });
  }
};
