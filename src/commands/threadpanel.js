const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { buildThreadPanel } = require('../services/threadForumService');
const { safeDefer, safeReply, safeEdit } = require('../utils/safeInteraction');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('threadpanel')
    .setDescription('Панель создания тем и веток')
    .addSubcommand(sub => sub
      .setName('open')
      .setDescription('Открыть панель создания темы для себя'))
    .addSubcommand(sub => sub
      .setName('post')
      .setDescription('Опубликовать панель создания тем в канал')
      .addChannelOption(option => option
        .setName('channel')
        .setDescription('Канал для публикации панели')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false))),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const payload = buildThreadPanel();

    if (sub === 'open') {
      await safeReply(interaction, { ...payload, ephemeral: true });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await safeReply(interaction, { content: '❌ Публиковать панель может только администратор.', ephemeral: true });
      return;
    }

    const deferred = await safeDefer(interaction, true);
    if (!deferred) return;
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    if (!channel?.send) {
      await safeEdit(interaction, { content: '❌ Канал не найден или не поддерживает отправку сообщений.', embeds: [], components: [] });
      return;
    }
    await channel.send(payload);
    await safeEdit(interaction, { content: `✅ Панель тем опубликована в ${channel}.`, embeds: [], components: [] });
  }
};
