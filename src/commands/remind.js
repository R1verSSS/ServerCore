const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { createReminder, listUserReminders, cancelReminder, formatDiscordTime } = require('../services/notificationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Личные напоминания')
    .addSubcommand(subcommand => subcommand
      .setName('create')
      .setDescription('Создать напоминание')
      .addStringOption(option => option.setName('time').setDescription('Когда: 10m, 2h, 1d, 10.06.2026 20:00').setRequired(true).setMaxLength(40))
      .addStringOption(option => option.setName('text').setDescription('Текст напоминания').setRequired(true).setMaxLength(1000))
      .addStringOption(option => option.setName('mode').setDescription('Куда отправить').setRequired(false).addChoices(
        { name: 'В этот канал', value: 'channel' },
        { name: 'В личные сообщения', value: 'dm' }
      )))
    .addSubcommand(subcommand => subcommand
      .setName('list')
      .setDescription('Показать мои активные напоминания'))
    .addSubcommand(subcommand => subcommand
      .setName('cancel')
      .setDescription('Отменить напоминание')
      .addIntegerOption(option => option.setName('id').setDescription('ID напоминания').setRequired(true).setMinValue(1))),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      const time = interaction.options.getString('time', true);
      const text = interaction.options.getString('text', true);
      const mode = interaction.options.getString('mode') || 'channel';
      const result = createReminder(interaction.user.id, interaction.user.username, interaction.guildId, interaction.channelId, text, time, mode);
      if (!result.ok) {
        await safeEdit(interaction, { content: '❌ Не удалось создать напоминание. Используй формат: `10m`, `2h`, `1d`, `10.06.2026 20:00` или `2026-06-10 20:00`.' });
        return;
      }
      await safeEdit(interaction, { content: `✅ Напоминание **#${result.reminder.id}** создано на ${formatDiscordTime(result.reminder.dueAt, 'f')} (${formatDiscordTime(result.reminder.dueAt, 'R')}).` });
      return;
    }

    if (sub === 'list') {
      const reminders = listUserReminders(interaction.user.id);
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('⏰ Мои напоминания')
        .setDescription(reminders.length ? reminders.map(r => `**#${r.id}** — ${formatDiscordTime(r.dueAt, 'f')} (${formatDiscordTime(r.dueAt, 'R')})\n${r.message}`).join('\n\n') : 'Активных напоминаний нет.');
      await safeEdit(interaction, { embeds: [embed] });
      return;
    }

    if (sub === 'cancel') {
      const id = interaction.options.getInteger('id', true);
      const result = cancelReminder(interaction.user.id, id, interaction.member);
      if (!result.ok) {
        await safeEdit(interaction, { content: result.reason === 'no_permission' ? '❌ Нельзя отменить чужое напоминание.' : '❌ Напоминание не найдено.' });
        return;
      }
      await safeEdit(interaction, { content: `✅ Напоминание **#${id}** отменено.` });
    }
  }
};
