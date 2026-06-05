const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { logToModeration } = require('../services/logService');

module.exports = {
  data: new ContextMenuCommandBuilder().setName('Пожаловаться').setType(ApplicationCommandType.Message),
  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const msg = interaction.targetMessage;
    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('🚨 Жалоба на сообщение')
      .addFields(
        { name: 'Отправитель', value: msg.author ? `${msg.author.tag} (${msg.author.id})` : 'Неизвестно', inline: false },
        { name: 'Канал', value: `<#${msg.channelId}>`, inline: true },
        { name: 'Сообщение', value: `[Открыть](${msg.url})`, inline: true },
        { name: 'Текст', value: (msg.content || 'Без текста').slice(0, 1000), inline: false },
        { name: 'Пожаловался', value: `${interaction.user.tag} (${interaction.user.id})`, inline: false }
      )
      .setTimestamp();
    await logToModeration(interaction.guild, '🚨 Жалоба на сообщение', { embeds: [embed] }).catch(() => null);
    await safeEdit(interaction, { content: '✅ Жалоба отправлена модерации.', embeds: [], components: [] });
  }
};
