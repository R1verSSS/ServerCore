const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { listSuggestions, statusLabel } = require('../services/suggestionService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('suggestions')
    .setDescription('Показать список предложений')
    .addStringOption(option =>
      option
        .setName('status')
        .setDescription('Фильтр по статусу')
        .setRequired(false)
        .addChoices(
          { name: 'На голосовании', value: 'open' },
          { name: 'На рассмотрении', value: 'review' },
          { name: 'Принятые', value: 'accepted' },
          { name: 'Отклоненные', value: 'denied' },
          { name: 'Закрытые', value: 'closed' }
        )
    ),

  async execute(interaction) {
    await safeDefer(interaction, false);
    const status = interaction.options.getString('status');
    const suggestions = listSuggestions(status, 10);
    const lines = suggestions.map(item => {
      const up = Object.keys(item.votes?.up || {}).length;
      const down = Object.keys(item.votes?.down || {}).length;
      return `**#${item.id}** • ${statusLabel(item.status)} • 👍 ${up} / 👎 ${down}\n${item.idea.slice(0, 120)}${item.idea.length > 120 ? '...' : ''}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('💡 Предложения сервера')
      .setDescription(lines.join('\n\n') || 'Предложений пока нет.')
      .setFooter({ text: 'Подробности: /suggestion info id:<ID>' });

    await safeEdit(interaction, { embeds: [embed], components: [] });
  },
};
