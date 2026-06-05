const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { buildShopPanel } = require('../services/shopPanel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shoppanel')
    .setDescription('Опубликовать кнопочную панель магазина')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const channel = interaction.channel;
    if (!channel?.send) return safeEdit(interaction, { content: '❌ В этом канале нельзя отправить панель.' });
    await channel.send(buildShopPanel());
    await safeEdit(interaction, { content: '✅ Панель магазина опубликована.' });
  }
};
