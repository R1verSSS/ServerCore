const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { buildMainMenuPayload } = require('../services/userMenuService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('menu')
    .setDescription('Открыть удобное меню сервера')
    .addSubcommand(sub => sub
      .setName('open')
      .setDescription('Открыть меню сервера')
      .addBooleanOption(opt => opt.setName('public').setDescription('Показать меню всем в канале').setRequired(false)))
    .addSubcommand(sub => sub
      .setName('post')
      .setDescription('Опубликовать меню в текущем канале')
      .addChannelOption(opt => opt.setName('channel').setDescription('Канал для публикации меню').setRequired(false))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand(false) || 'open';

    if (sub === 'post') {
      await safeDefer(interaction, true);
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await safeEdit(interaction, { content: '❌ Для публикации меню нужен доступ Управление сообщениями.', embeds: [], components: [] });
        return;
      }
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      if (!channel || typeof channel.send !== 'function') {
        await safeEdit(interaction, { content: '❌ В этот канал нельзя отправить меню.', embeds: [], components: [] });
        return;
      }
      await channel.send(buildMainMenuPayload());
      await safeEdit(interaction, { content: `✅ Меню опубликовано в <#${channel.id}>.`, embeds: [], components: [] });
      return;
    }

    const isPublic = interaction.options.getBoolean('public') || false;
    await safeDefer(interaction, !isPublic);
    await safeEdit(interaction, buildMainMenuPayload());
  }
};
