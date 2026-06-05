const fs = require('node:fs');
const path = require('node:path');
const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { safeReply } = require('../utils/safeInteraction');
const { buildHostingReadiness } = require('../services/hostingCheckService');

function saveReport(report) {
  const dir = path.join(process.cwd(), 'logs');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'hosting-check-latest.md');
  const lines = report.checks.map(item => `${item.ok ? '✅' : '⚠️'} ${item.label}${item.hint ? `\n   ${item.hint}` : ''}`).join('\n\n');
  fs.writeFileSync(file, `# Hosting readiness check\n\nГотовность: ${report.okCount}/${report.total}\n\n${lines}\n`, 'utf8');
  return file;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hosting-check')
    .setDescription('Проверить готовность проекта к запуску на хостинге')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const report = buildHostingReadiness();
    const file = saveReport(report);
    const lines = report.checks
      .map(item => `${item.ok ? '✅' : '⚠️'} **${item.label}**${item.hint ? `\n${item.hint}` : ''}`)
      .join('\n\n')
      .slice(0, 3900);

    const embed = new EmbedBuilder()
      .setColor(report.okCount === report.total ? 0x57F287 : 0xFEE75C)
      .setTitle('🚀 Hosting readiness check')
      .setDescription(`Готовность: **${report.okCount}/${report.total}**\n\n${lines}`)
      .setFooter({ text: 'ServerCore • Перед переносом на Railway/VPS/Render' })
      .setTimestamp();

    const response = await safeReply(interaction, {
      embeds: [embed],
      components: [],
      flags: MessageFlags.Ephemeral,
    });

    if (!response) {
      console.warn(`[hosting-check] Discord не принял ответ вовремя. Отчет сохранен: ${file}`);
      console.log(`\n[hosting-check report]\nГотовность: ${report.okCount}/${report.total}\n${report.checks.map(item => `${item.ok ? 'OK' : 'WARN'} - ${item.label}${item.hint ? ` | ${item.hint}` : ''}`).join('\n')}\n`);
    }
  }
};
