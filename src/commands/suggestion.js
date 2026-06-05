const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getSuggestion, buildSuggestionEmbed, buildSuggestionButtons, setSuggestionStatus } = require('../services/suggestionService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('suggestion')
    .setDescription('Управление конкретным предложением')
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('Показать предложение')
        .addIntegerOption(option => option.setName('id').setDescription('ID предложения').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Изменить статус предложения')
        .addIntegerOption(option => option.setName('id').setDescription('ID предложения').setRequired(true).setMinValue(1))
        .addStringOption(option => option.setName('status').setDescription('Новый статус').setRequired(true).addChoices(
          { name: 'На рассмотрении', value: 'review' },
          { name: 'Принято', value: 'accepted' },
          { name: 'Отклонено', value: 'denied' },
          { name: 'Закрыто', value: 'closed' },
          { name: 'Снова открыть', value: 'open' }
        ))
        .addStringOption(option => option.setName('comment').setDescription('Комментарий администрации').setRequired(false).setMaxLength(500))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    await safeDefer(interaction, sub === 'info' ? false : { flags: MessageFlags.Ephemeral });

    if (sub === 'info') {
      const suggestion = getSuggestion(interaction.options.getInteger('id'));
      if (!suggestion) {
        await safeEdit(interaction, { content: '❌ Предложение не найдено.', embeds: [], components: [] });
        return;
      }
      await safeEdit(interaction, { embeds: [buildSuggestionEmbed(suggestion, interaction.guild)], components: buildSuggestionButtons(suggestion) });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await safeEdit(interaction, { content: '❌ Нет прав. Нужно право `Manage Messages` или `Administrator`.', embeds: [], components: [] });
      return;
    }

    const result = await setSuggestionStatus(
      interaction,
      interaction.options.getInteger('id'),
      interaction.options.getString('status'),
      interaction.options.getString('comment') || ''
    );

    if (!result.ok) {
      await safeEdit(interaction, { content: result.reason === 'not_found' ? '❌ Предложение не найдено.' : '❌ Не удалось изменить статус.', embeds: [], components: [] });
      return;
    }

    await safeEdit(interaction, { content: `✅ Статус предложения #${result.suggestion.id} обновлен.`, embeds: [], components: [] });
  },
};
