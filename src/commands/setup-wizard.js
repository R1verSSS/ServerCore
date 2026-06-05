const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { buildSetupWizardPayload } = require('../services/setupWizardService');
const { addAudit } = require('../services/auditService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-wizard')
    .setDescription('Пошаговая диагностика настройки сервера')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const payload = await buildSetupWizardPayload(interaction.client, interaction.guild);
    addAudit('setup_wizard_opened', interaction.user, { guildId: interaction.guildId });
    await safeEdit(interaction, payload);
  }
};
