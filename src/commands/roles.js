const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildRolePanel } = require('../services/rolePanel');
const { safeDefer } = require('../utils/safeInteraction');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roles')
    .setDescription('Отправить панель выбора ролей в текущий канал')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  async execute(interaction) {
    const deferred = await safeDefer(interaction, true);
    if (!deferred) return;

    await interaction.channel.send(buildRolePanel());
    await interaction.editReply({ content: '✅ Панель выбора ролей отправлена.' });
  }
};
