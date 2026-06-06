const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { buildWebPanelMenuPayload } = require('../services/webPanelMenuService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('webpanel')
    .setDescription('Открыть или опубликовать меню веб-панели')
    .addSubcommand(sub => sub
      .setName('open')
      .setDescription('Показать меню веб-панели для себя'))
    .addSubcommand(sub => sub
      .setName('post')
      .setDescription('Опубликовать меню веб-панели в канал')
      .addChannelOption(opt => opt.setName('channel').setDescription('Канал для публикации').setRequired(false))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand(false) || 'open';

    if (sub === 'post') {
      await safeDefer(interaction, true);
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await safeEdit(interaction, { content: '❌ Для публикации меню веб-панели нужен доступ **Управление сообщениями**.', embeds: [], components: [] });
        return;
      }
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      if (!channel || typeof channel.send !== 'function') {
        await safeEdit(interaction, { content: '❌ В этот канал нельзя отправить меню веб-панели.', embeds: [], components: [] });
        return;
      }
      await channel.send(buildWebPanelMenuPayload());
      await safeEdit(interaction, { content: `✅ Меню веб-панели опубликовано в <#${channel.id}>.`, embeds: [], components: [] });
      return;
    }

    await safeDefer(interaction, true);
    await safeEdit(interaction, buildWebPanelMenuPayload());
  }
};
