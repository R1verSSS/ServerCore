const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { sendGamePanelToMiniGames, MINI_GAMES_CHANNEL_NAME } = require('../services/gamePanel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gamepanel')
    .setDescription('Отправить панель мини-игр в канал мини-игр')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const deferred = await safeDefer(interaction, true);
    if (!deferred) return;

    const result = await sendGamePanelToMiniGames(interaction.guild);
    if (!result.ok) {
      await safeEdit(interaction, {
        content: `❌ Канал **${MINI_GAMES_CHANNEL_NAME}** не найден. Создай его или запусти \`npm run setup\`.`,
        embeds: [],
        components: [],
      });
      return;
    }

    await safeEdit(interaction, {
      content: `✅ Панель мини-игр отправлена в ${result.channel}.`,
      embeds: [],
      components: [],
    });
  },
};
