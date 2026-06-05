const { SlashCommandBuilder } = require('discord.js');
const { safeDefer, safeReply } = require('../utils/safeInteraction');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Проверить, работает ли бот'),
  async execute(interaction) {
    const deferred = await safeDefer(interaction, true);
    if (!deferred) return;

    await safeReply(interaction, {
      content: `🏓 Pong! Задержка WebSocket: ${interaction.client.ws.ping} ms`,
    });
  }
};
