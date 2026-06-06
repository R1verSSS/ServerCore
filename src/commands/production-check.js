const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { buildProductionReport } = require('../services/productionCheckService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('production-check')
    .setDescription('Финальная проверка готовности бота к production/хостингу'),
  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const report = await buildProductionReport(interaction.client, { skipNetwork: false });
    const color = report.okCount === report.total ? 0x57F287 : 0xFEE75C;
    const lines = report.checks.slice(0, 18).map(item => `${item.ok ? '✅' : '⚠️'} **${item.label}**${item.hint ? `\n${item.hint}` : ''}`);
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('🚀 Production-check ServerCore')
      .setDescription(lines.join('\n\n').slice(0, 4000))
      .addFields(
        { name: 'Итог', value: `${report.okCount}/${report.total}`, inline: true },
        { name: 'База', value: report.storage.driver || 'unknown', inline: true },
        { name: 'Backup', value: String(report.backups), inline: true }
      )
      .setFooter({ text: 'ServerCore • Production Check' });
    await safeEdit(interaction, { embeds: [embed], components: [] });
  }
};
