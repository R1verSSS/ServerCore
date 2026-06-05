const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getSettings, updateSettings } = require('../services/settingsService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Автомодерация')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(s => s.setName('status').setDescription('Статус AutoMod'))
    .addSubcommand(s => s.setName('toggle').setDescription('Включить или выключить AutoMod').addBooleanOption(o => o.setName('enabled').setDescription('Включить?').setRequired(true)))
    .addSubcommand(s => s.setName('words').setDescription('Заменить список запрещенных слов через запятую').addStringOption(o => o.setName('list').setDescription('слово1, слово2').setRequired(true)))
    .addSubcommand(s => s.setName('links').setDescription('Блокировка ссылок').addBooleanOption(o => o.setName('enabled').setDescription('Блокировать ссылки?').setRequired(true))),
  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();
    if (sub === 'toggle') updateSettings({ automodEnabled: interaction.options.getBoolean('enabled') });
    if (sub === 'words') updateSettings({ automodForbiddenWords: interaction.options.getString('list').split(',').map(x=>x.trim()).filter(Boolean) });
    if (sub === 'links') updateSettings({ automodBlockLinks: interaction.options.getBoolean('enabled') });
    const s = getSettings();
    const embed = new EmbedBuilder().setColor(s.automodEnabled ? 0x57F287 : 0xFEE75C).setTitle('🛡 AutoMod')
      .setDescription(`Статус: **${s.automodEnabled ? 'включен' : 'выключен'}**\nСсылки: **${s.automodBlockLinks ? 'блокируются' : 'разрешены'}**\nАнтиспам: **${s.automodAntiSpam ? 'вкл' : 'выкл'}**\nАнтикапс: **${s.automodAntiCaps ? 'вкл' : 'выкл'}**\nЗапрещенные слова: ${s.automodForbiddenWords?.join(', ') || '-'}`);
    return safeEdit(interaction, { embeds: [embed] });
  }
};
