const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getApplications } = require('../services/applicationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('applications')
    .setDescription('Список заявок')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('status').setDescription('Статус').addChoices(
      { name: 'open', value: 'open' },
      { name: 'accepted', value: 'accepted' },
      { name: 'denied', value: 'denied' },
      { name: 'all', value: 'all' },
    )),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const statusValue = interaction.options.getString('status') || 'open';
    const apps = getApplications(statusValue === 'all' ? '' : statusValue);
    const text = apps.slice(0, 20).map(a => `#${a.id} — ${a.typeLabel || a.type} — ${a.username} — ${a.status}`).join('\n') || 'Заявок нет.';
    return safeEdit(interaction, { embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle(`📨 Заявки: ${statusValue}`).setDescription(text)] });
  },
};
