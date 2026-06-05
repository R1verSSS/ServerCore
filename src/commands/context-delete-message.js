const { ContextMenuCommandBuilder, ApplicationCommandType, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { logToModeration } = require('../services/logService');

module.exports = {
  data: new ContextMenuCommandBuilder().setName('Удалить сообщение').setType(ApplicationCommandType.Message),
  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const msg = interaction.targetMessage;
    await msg.delete().catch(async () => {
      await safeEdit(interaction, { content: '❌ Не удалось удалить сообщение. Проверь права бота.' });
    });
    await logToModeration(interaction.guild, '🧹 Удалено сообщение', `Модератор: ${interaction.user.tag}\nКанал: <#${msg.channelId}>\nАвтор: ${msg.author?.tag || 'неизвестно'}\nТекст: ${(msg.content || 'Без текста').slice(0, 500)}`).catch(() => null);
    await safeEdit(interaction, { content: '✅ Сообщение удалено.' });
  }
};
