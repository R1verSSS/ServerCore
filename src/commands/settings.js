const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getSettings, setSetting, formatSettings } = require('../services/settingsService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Настройки ServerCore')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('view').setDescription('Показать настройки'))
    .addSubcommand(s => s.setName('set').setDescription('Изменить настройку')
      .addStringOption(o => o.setName('key').setDescription('Ключ настройки').setRequired(true))
      .addStringOption(o => o.setName('value').setDescription('Новое значение').setRequired(true))),
  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();
    if (sub === 'set') {
      const result = setSetting(interaction.options.getString('key'), interaction.options.getString('value'));
      if (!result.ok) return safeEdit(interaction, { content: `❌ Не удалось изменить настройку: ${result.reason}` });
      return safeEdit(interaction, { content: `✅ Настройка **${result.key}** обновлена: **${Array.isArray(result.value) ? result.value.join(', ') : result.value}**` });
    }
    const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('⚙️ Настройки ServerCore').setDescription(formatSettings(getSettings()).slice(0, 3900));
    return safeEdit(interaction, { embeds: [embed] });
  }
};
