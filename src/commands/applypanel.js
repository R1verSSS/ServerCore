const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { buildApplicationPanel } = require('../services/applicationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('applypanel')
    .setDescription('Отправить панель заявок с кнопками')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    await interaction.channel.send(buildApplicationPanel());
    return safeEdit(interaction, { content: '✅ Панель заявок отправлена в текущий канал.' });
  },
};
