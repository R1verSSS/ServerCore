const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { createBackup, listBackups, restoreBackup, deleteBackup, testBackup } = require('../services/backupService');
const { logToModeration } = require('../services/logService');

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Резервные копии базы данных')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub => sub
      .setName('create')
      .setDescription('Создать резервную копию')
      .addStringOption(opt => opt.setName('name').setDescription('Название бэкапа').setRequired(false))
      .addBooleanOption(opt => opt.setName('attach').setDescription('Прикрепить файл к ответу').setRequired(false)))
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('Показать список резервных копий'))
    .addSubcommand(sub => sub
      .setName('restore')
      .setDescription('Восстановить базу из резервной копии')
      .addStringOption(opt => opt.setName('name').setDescription('Имя файла из /backup list').setRequired(true))
      .addBooleanOption(opt => opt.setName('confirm').setDescription('Подтверждение восстановления').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('delete')
      .setDescription('Удалить резервную копию')
      .addStringOption(opt => opt.setName('name').setDescription('Имя файла из /backup list').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('test')
      .setDescription('Проверить, что бэкап читается и похож на базу ServerCore')
      .addStringOption(opt => opt.setName('name').setDescription('Имя файла из /backup list').setRequired(true))),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      const name = interaction.options.getString('name') || '';
      const attach = interaction.options.getBoolean('attach') || false;
      const backup = createBackup(name, { createdBy: interaction.user.id, createdByName: interaction.user.username, source: 'discord-command' });
      await logToModeration(interaction.guild, '💾 Создан бэкап', `Модератор: ${interaction.user.tag}\nФайл: ${backup.name}`).catch(() => null);
      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('💾 Бэкап создан')
        .addFields(
          { name: 'Файл', value: `\`${backup.name}\`` },
          { name: 'Размер', value: formatBytes(backup.size), inline: true },
          { name: 'Дата', value: `<t:${Math.floor(new Date(backup.createdAt).getTime() / 1000)}:F>`, inline: true }
        );
      const payload = { embeds: [embed] };
      if (attach) payload.files = [new AttachmentBuilder(backup.path, { name: backup.name })];
      await safeEdit(interaction, payload);
      return;
    }

    if (sub === 'list') {
      const backups = listBackups().slice(0, 15);
      const text = backups.length
        ? backups.map((b, i) => `**${i + 1}.** \`${b.name}\` — ${formatBytes(b.size)} — <t:${Math.floor(new Date(b.modifiedAt).getTime() / 1000)}:R>`).join('\n')
        : 'Бэкапов пока нет.';
      await safeEdit(interaction, { embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('💾 Резервные копии').setDescription(text)] });
      return;
    }

    if (sub === 'restore') {
      const confirm = interaction.options.getBoolean('confirm');
      const name = interaction.options.getString('name');
      if (!confirm) {
        await safeEdit(interaction, { content: '⚠️ Восстановление отменено. Для восстановления укажи `confirm:true`.' });
        return;
      }
      const before = createBackup(`auto-before-restore-${Date.now()}`, { createdBy: interaction.user.id, source: 'auto-before-restore' });
      const result = restoreBackup(name);
      if (!result.ok) {
        await safeEdit(interaction, { content: '❌ Бэкап не найден. Проверь имя из `/backup list`.' });
        return;
      }
      await logToModeration(interaction.guild, '♻️ База восстановлена из бэкапа', `Модератор: ${interaction.user.tag}\nФайл: ${result.name}\nАвто-бэкап до восстановления: ${before.name}`).catch(() => null);
      await safeEdit(interaction, { content: `✅ База восстановлена из \`${result.name}\`. Перед восстановлением создан страховой бэкап: \`${before.name}\`. Перезапусти бота, если часть данных в памяти отображается старой.` });
      return;
    }

    if (sub === 'test') {
      const name = interaction.options.getString('name');
      const result = testBackup(name);
      await safeEdit(interaction, { content: result.ok ? `✅ Бэкап \`${result.name}\` читается корректно. Размер: ${formatBytes(result.size)}.` : `❌ Бэкап не прошел проверку: ${result.reason || 'неизвестная причина'}` });
      return;
    }

    if (sub === 'delete') {
      const name = interaction.options.getString('name');
      const result = deleteBackup(name);
      await safeEdit(interaction, { content: result.ok ? `🗑 Бэкап \`${result.name}\` удален.` : '❌ Бэкап не найден.' });
    }
  }
};
