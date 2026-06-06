const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getUserStats } = require('../services/xpService');
const { getEconomyHistory } = require('../services/managementUxService');

function formatHistory(rows) {
  if (!rows.length) return 'История операций пока пустая.';
  return rows.map(row => {
    const sign = Number(row.amount || 0) >= 0 ? '+' : '';
    const date = row.createdAt ? `<t:${Math.floor(new Date(row.createdAt).getTime() / 1000)}:R>` : 'недавно';
    const details = row.meta?.itemName ? ` — ${row.meta.itemName}` : '';
    return `${sign}${row.amount} монет • ${row.type}${details} • ${date}`;
  }).join('\n').slice(0, 3800);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Показать баланс монет')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Участник, чей баланс нужно посмотреть')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('history')
        .setDescription('Показать последние операции экономики')
        .setRequired(false)
    ),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });

    const selectedUser = interaction.options.getUser('user');
    const showHistory = interaction.options.getBoolean('history') || false;
    const target = selectedUser && !selectedUser.bot ? selectedUser : interaction.user;
    const stats = getUserStats(target.id, target.username);

    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle(`💰 Баланс: ${target.username}`)
      .setThumbnail(target.displayAvatarURL({ size: 128 }))
      .setDescription(`Монеты: **${stats.coins || 0}**`)
      .setFooter({ text: 'ServerCore • Balance' });

    if (showHistory) {
      embed.addFields({ name: '📜 Последние операции', value: formatHistory(getEconomyHistory(target.id, 10)), inline: false });
    } else {
      embed.addFields({ name: 'Подсказка', value: 'Добавь параметр `history: true`, чтобы увидеть историю операций.', inline: false });
    }

    await safeEdit(interaction, { embeds: [embed] });
  }
};
