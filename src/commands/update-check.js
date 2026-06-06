const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeReply } = require('../utils/safeInteraction');
const { buildUpdateReport } = require('../services/adminOpsService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('update-check')
    .setDescription('Проверить состояние обновления, backup и регистрацию команд'),
  async execute(interaction) {
    const report = buildUpdateReport();
    const color = report.okCount === report.total ? 0x57F287 : 0xFEE75C;
    const lines = report.checks.map(item => `${item.ok ? '✅' : '⚠️'} **${item.label}**\n${item.hint || 'OK'}`);
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('🔄 Update-check ServerCore')
      .setDescription(lines.join('\n\n').slice(0, 3800))
      .addFields(
        { name: 'Версия', value: String(report.package.version || 'unknown'), inline: true },
        { name: 'Итог', value: `${report.okCount}/${report.total}`, inline: true },
        { name: 'Последний backup', value: report.latestBackup?.name || 'нет', inline: false }
      )
      .setFooter({ text: 'После изменения slash-команд выполни npm run deploy' });
    await safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
