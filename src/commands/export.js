const { SlashCommandBuilder, AttachmentBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { exportData, cleanupOldExports } = require('../services/backupService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('export')
    .setDescription('Экспорт данных сервера')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(opt => opt
      .setName('type')
      .setDescription('Что экспортировать')
      .setRequired(true)
      .addChoices(
        { name: 'Пользователи', value: 'users' },
        { name: 'Экономика', value: 'economy' },
        { name: 'Предупреждения', value: 'warnings' },
        { name: 'Все данные', value: 'all' }
      ))
    .addStringOption(opt => opt
      .setName('format')
      .setDescription('Формат файла')
      .setRequired(false)
      .addChoices(
        { name: 'JSON', value: 'json' },
        { name: 'CSV', value: 'csv' }
      )),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    cleanupOldExports();
    const type = interaction.options.getString('type');
    const format = interaction.options.getString('format') || 'json';
    const result = exportData(type, format);
    await safeEdit(interaction, {
      content: `✅ Экспорт готов: \`${result.name}\``,
      files: [new AttachmentBuilder(result.path, { name: result.name })]
    });
  }
};
