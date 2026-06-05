const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { sendModerationPanel } = require('../services/moderationPanel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modpanel')
    .setDescription('Отправить панель модерации в канал 🧰・панель-модерации')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const result = await sendModerationPanel(interaction.guild);
    await safeEdit(interaction, {
      content: result.ok
        ? `✅ Панель модерации отправлена в канал ${result.channel}.`
        : '❌ Не удалось отправить панель модерации.'
    });
  },
};
