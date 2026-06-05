const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { createSuggestion, SUGGESTIONS_CHANNEL } = require('../services/suggestionService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Отправить предложение для сервера')
    .addStringOption(option =>
      option
        .setName('idea')
        .setDescription('Текст предложения')
        .setRequired(true)
        .setMinLength(5)
        .setMaxLength(900)
    ),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const result = await createSuggestion(interaction, interaction.options.getString('idea'));

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Предложение отправлено')
      .setDescription(`Предложение **#${result.suggestion.id}** создано.${result.channel ? `\nОно опубликовано в канале ${result.channel}.` : `\nКанал \`${SUGGESTIONS_CHANNEL}\` не найден, но предложение сохранено в базе.`}`)
      .addFields({ name: 'Что дальше?', value: 'Участники смогут голосовать кнопками 👍 / 👎, а администрация сможет принять или отклонить идею.', inline: false });

    await safeEdit(interaction, { embeds: [embed], components: [] });
  },
};
