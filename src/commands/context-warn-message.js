const { ContextMenuCommandBuilder, ApplicationCommandType, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { addWarning, sendModerationLog, createLogEmbed } = require('../services/moderationService');

module.exports = {
  data: new ContextMenuCommandBuilder().setName('Warn за сообщение').setType(ApplicationCommandType.Message),
  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const msg = interaction.targetMessage;
    if (!msg.author || msg.author.bot) {
      await safeEdit(interaction, { content: '❌ Нельзя выдать предупреждение боту или неизвестному автору.' });
      return;
    }
    const reason = `Предупреждение за сообщение: ${(msg.content || 'без текста').slice(0, 180)}`;
    const warning = addWarning({ guildId: interaction.guild.id, userId: msg.author.id, username: msg.author.username, moderatorId: interaction.user.id, moderatorName: interaction.user.username, reason });
    await sendModerationLog(interaction.guild, { embeds: [createLogEmbed({ title: `⚠️ Предупреждение #${warning.id}`, color: 0xFEE75C, moderator: interaction.user, target: msg.author, reason })] }).catch(() => null);
    await safeEdit(interaction, { content: `✅ Предупреждение #${warning.id} выдано пользователю **${msg.author.username}**.` });
  }
};
