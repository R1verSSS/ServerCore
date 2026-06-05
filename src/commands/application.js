const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { updateApplicationStatus, notifyApplicant } = require('../services/applicationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('application')
    .setDescription('Управление заявкой')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('accept').setDescription('Принять заявку')
      .addIntegerOption(o => o.setName('id').setDescription('ID заявки').setRequired(true))
      .addStringOption(o => o.setName('comment').setDescription('Комментарий для пользователя')))
    .addSubcommand(s => s.setName('deny').setDescription('Отклонить заявку')
      .addIntegerOption(o => o.setName('id').setDescription('ID заявки').setRequired(true))
      .addStringOption(o => o.setName('comment').setDescription('Комментарий для пользователя'))),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const status = interaction.options.getSubcommand() === 'accept' ? 'accepted' : 'denied';
    const comment = interaction.options.getString('comment') || '';
    const result = updateApplicationStatus(interaction.options.getInteger('id'), status, interaction.user.id, interaction.user.username, comment);
    if (!result.ok) return safeEdit(interaction, { content: '❌ Заявка не найдена.' });
    const dm = await notifyApplicant(interaction.client, result.application, status, comment);
    return safeEdit(interaction, { content: `✅ Заявка #${result.application.id}: ${status}.${dm ? '\nПользователю отправлено уведомление в ЛС.' : '\nНе удалось отправить ЛС пользователю.'}` });
  },
};
