const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { buildNetworkReport } = require('../services/networkCheckService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('network-check')
    .setDescription('Проверить доступ Node.js к Discord API')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const report = await buildNetworkReport({ timeoutMs: 8000 });
    const lines = report.checks.map(item => `${item.ok ? '✅' : '⚠️'} **${item.label}**${item.hint ? `\n${item.hint}` : ''}`).join('\n\n').slice(0, 3900);
    const embed = new EmbedBuilder()
      .setColor(report.okCount === report.total ? 0x57F287 : 0xFEE75C)
      .setTitle('🌐 Network-check Node.js → Discord')
      .setDescription(`Проверок пройдено: **${report.okCount}/${report.total}**\n\n${lines}`)
      .addFields({ name: 'Если есть timeout', value: 'Проверь системный VPN, Firewall для node.exe или перенеси бота на VPS/хостинг. Веб-страница: `http://localhost:3000/network`.' })
      .setFooter({ text: 'ServerCore • Диагностика сети' })
      .setTimestamp();
    await safeEdit(interaction, { embeds: [embed], components: [] });
  }
};
