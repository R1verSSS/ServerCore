const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeReply } = require('../utils/safeInteraction');
const { getStorageInfo } = require('../services/dataStore');
const { listBackups } = require('../services/backupService');

function buildVpsChecks() {
  const storage = getStorageInfo();
  const backups = listBackups();
  const musicEnabled = String(process.env.MUSIC_ENABLED || 'true').toLowerCase() !== 'false';
  return [
    { ok: process.version.startsWith('v22') || process.version.startsWith('v20'), label: 'Node.js доступен', hint: process.version },
    { ok: storage.driver === 'sqlite' || storage.driver === 'json', label: 'База выбрана', hint: `driver=${storage.driver}` },
    { ok: backups.length > 0, label: 'Есть backup перед переносом', hint: backups[0]?.name || 'Создай /backup create name:before-vps' },
    { ok: Boolean(process.env.DISCORD_TOKEN), label: 'DISCORD_TOKEN задан', hint: process.env.DISCORD_TOKEN ? 'OK' : 'Нужно добавить .env' },
    { ok: Boolean(process.env.WEB_PASSWORD) && process.env.WEB_PASSWORD !== 'admin', label: 'Пароль веб-панели безопаснее admin', hint: process.env.WEB_PASSWORD ? 'задан' : 'не задан' },
    { ok: !musicEnabled || process.env.MUSIC_ENABLED === 'true', label: 'Музыка готова к VPS', hint: musicEnabled ? 'На VPS можно проверить voice/UDP' : 'Сейчас отключена, на VPS можно включить MUSIC_ENABLED=true' }
  ];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vps-check')
    .setDescription('Проверить готовность проекта к переносу на VPS'),

  async execute(interaction) {
    const checks = buildVpsChecks();
    const okCount = checks.filter(x => x.ok).length;
    const embed = new EmbedBuilder()
      .setColor(okCount === checks.length ? 0x57F287 : 0xFEE75C)
      .setTitle('🖥 VPS-check')
      .setDescription(`Готовность к переносу: **${okCount}/${checks.length}**`)
      .addFields(checks.map(c => ({ name: `${c.ok ? '✅' : '⚠️'} ${c.label}`, value: c.hint || '—', inline: false })))
      .setFooter({ text: 'ServerCore • VPS Migration' })
      .setTimestamp();
    await safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
