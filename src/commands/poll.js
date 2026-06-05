const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { createPoll, listPolls, getPoll, buildPollEmbed, buildPollButtons, closePoll } = require('../services/suggestionService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Опросы сервера')
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Создать опрос')
        .addStringOption(option => option.setName('question').setDescription('Вопрос').setRequired(true).setMinLength(5).setMaxLength(250))
        .addStringOption(option => option.setName('options').setDescription('Варианты через | например: Да | Нет | Не знаю').setRequired(true).setMinLength(3).setMaxLength(500))
    )
    .addSubcommand(sub => sub.setName('list').setDescription('Показать последние опросы'))
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('Показать опрос')
        .addIntegerOption(option => option.setName('id').setDescription('ID опроса').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName('close')
        .setDescription('Закрыть опрос')
        .addIntegerOption(option => option.setName('id').setDescription('ID опроса').setRequired(true).setMinValue(1))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    await safeDefer(interaction, sub === 'create' || sub === 'close' ? { flags: MessageFlags.Ephemeral } : false);

    if (sub === 'create') {
      const result = await createPoll(interaction, interaction.options.getString('question'), interaction.options.getString('options'));
      if (!result.ok) {
        await safeEdit(interaction, { content: '❌ Укажи минимум 2 варианта через символ `|`. Например: `Да | Нет | Не знаю`.', embeds: [], components: [] });
        return;
      }
      await safeEdit(interaction, { content: `✅ Опрос **#${result.poll.id}** создан${result.channel ? ` и опубликован в ${result.channel}.` : '.'}`, embeds: [], components: [] });
      return;
    }

    if (sub === 'list') {
      const polls = listPolls(null, 10);
      const lines = polls.map(poll => `**#${poll.id}** • ${poll.status === 'closed' ? 'Закрыт' : 'Активен'} • ${Object.keys(poll.votes || {}).length} голосов\n${poll.question}`);
      await safeEdit(interaction, { content: lines.join('\n\n') || 'Опросов пока нет.', embeds: [], components: [] });
      return;
    }

    if (sub === 'info') {
      const poll = getPoll(interaction.options.getInteger('id'));
      if (!poll) {
        await safeEdit(interaction, { content: '❌ Опрос не найден.', embeds: [], components: [] });
        return;
      }
      await safeEdit(interaction, { embeds: [buildPollEmbed(poll)], components: buildPollButtons(poll) });
      return;
    }

    if (sub === 'close') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await safeEdit(interaction, { content: '❌ Нет прав. Нужно право `Manage Messages` или `Administrator`.', embeds: [], components: [] });
        return;
      }
      const result = await closePoll(interaction, interaction.options.getInteger('id'));
      await safeEdit(interaction, { content: result.ok ? `🔒 Опрос #${result.poll.id} закрыт.` : '❌ Опрос не найден или нет прав.', embeds: [], components: [] });
    }
  },
};
