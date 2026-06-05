const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeReply } = require('../utils/safeInteraction');
const { readDatabase, getStorageInfo } = require('../services/dataStore');
const { buildHealthReport, formatHealthLines } = require('../services/healthCheckService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dbstatus')
    .setDescription('Показать состояние базы данных и health-check бота'),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has('Administrator')) {
      return safeReply(interaction, { content: '❌ Команда доступна только администраторам.', flags: MessageFlags.Ephemeral });
    }

    const db = readDatabase();
    const info = getStorageInfo();
    const report = await buildHealthReport(interaction.client, interaction.guild);
    const embed = new EmbedBuilder()
      .setColor(report.okCount === report.total ? 0x57F287 : 0xFEE75C)
      .setTitle('🩺 Health-check ServerCore')
      .setDescription(`Проверено: **${report.okCount}/${report.total}** пунктов.\n\n${formatHealthLines(report)}`)
      .addFields(
        { name: 'Драйвер базы', value: info.driver === 'sqlite' ? 'SQLite' : 'JSON fallback', inline: true },
        { name: 'Пользователей', value: String(Object.keys(db.users || {}).length), inline: true },
        { name: 'Тикетов', value: String(Object.keys(db.tickets || {}).length), inline: true },
        { name: 'Ивентов', value: String(Object.keys(db.events || {}).length), inline: true },
        { name: 'Турниров', value: String(Object.keys(db.tournaments || {}).length), inline: true },
        { name: 'Кланов', value: String(Object.keys(db.clans || {}).length), inline: true },
        { name: 'SQLite файл', value: `\`${info.sqlitePath}\`` }
      )
      .setFooter({ text: 'ServerCore • Database & Health Status' })
      .setTimestamp();

    if (info.driver !== 'sqlite' && info.sqliteUnavailableReason) {
      embed.addFields({ name: 'Причина fallback', value: `\`${info.sqliteUnavailableReason}\`` });
    }

    const response = await safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
    if (!response) {
      console.warn('[dbstatus] Discord не принял ответ вовремя. Открой веб-панель /health или проверь logs/error.log.');
    }
  }
};
