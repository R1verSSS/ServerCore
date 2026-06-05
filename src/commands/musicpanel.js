const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { buildMusicPanel } = require('../services/musicService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('musicpanel')
    .setDescription('Опубликовать панель управления музыкой')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    if (!interaction.channel?.send) {
      await safeEdit(interaction, { content: '❌ В этом канале нельзя отправить музыкальную панель.', embeds: [], components: [] });
      return;
    }
    await interaction.channel.send(buildMusicPanel());
    await safeEdit(interaction, { content: '✅ Музыкальная панель опубликована.', embeds: [], components: [] });
  }
};
