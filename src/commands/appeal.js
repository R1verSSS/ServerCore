const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { createAppeal, listAppeals, updateAppealStatus, sendModerationLog, createLogEmbed } = require('../services/moderationService');

function appealLine(a) {
  return `#${a.id} • ${a.status} • ${a.username}\nДело: ${a.caseId || 'не указано'}\n${a.text}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('appeal')
    .setDescription('Апелляции по наказаниям')
    .addSubcommand(sub => sub.setName('create').setDescription('Подать апелляцию').addStringOption(option => option.setName('text').setDescription('Почему наказание нужно пересмотреть').setRequired(true)).addIntegerOption(option => option.setName('case_id').setDescription('ID дела, если известен').setRequired(false)))
    .addSubcommand(sub => sub.setName('list').setDescription('Список апелляций').addStringOption(option => option.setName('status').setDescription('Статус').setRequired(false).addChoices({ name: 'Открытые', value: 'open' }, { name: 'Принятые', value: 'accepted' }, { name: 'Отклоненные', value: 'denied' })))
    .addSubcommand(sub => sub.setName('accept').setDescription('Принять апелляцию').addIntegerOption(option => option.setName('id').setDescription('ID апелляции').setRequired(true)).addStringOption(option => option.setName('response').setDescription('Ответ пользователю').setRequired(false)))
    .addSubcommand(sub => sub.setName('deny').setDescription('Отклонить апелляцию').addIntegerOption(option => option.setName('id').setDescription('ID апелляции').setRequired(true)).addStringOption(option => option.setName('response').setDescription('Ответ пользователю').setRequired(false))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const isAdminAction = ['list', 'accept', 'deny'].includes(sub);
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });

    if (isAdminAction && !interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
      return safeEdit(interaction, { content: '❌ Нужны права модерации.' });
    }

    if (sub === 'create') {
      const text = interaction.options.getString('text');
      const caseId = interaction.options.getInteger('case_id');
      const appeal = createAppeal({ guildId: interaction.guild.id, userId: interaction.user.id, username: interaction.user.username, caseId, text });
      await sendModerationLog(interaction.guild, {
        embeds: [createLogEmbed({ title: `📨 Апелляция #${appeal.id}`, color: 0xFEE75C, moderator: null, target: interaction.user, reason: text })],
      });
      return safeEdit(interaction, { content: `✅ Апелляция #${appeal.id} отправлена администрации.` });
    }

    if (sub === 'list') {
      const status = interaction.options.getString('status') || 'open';
      const appeals = listAppeals({ guildId: interaction.guild.id, status, limit: 15 });
      const embed = new EmbedBuilder().setColor(0x5865F2).setTitle(`📨 Апелляции: ${status}`).setDescription(appeals.length ? appeals.map(appealLine).join('\n\n').slice(0, 3900) : 'Апелляций нет.');
      return safeEdit(interaction, { embeds: [embed] });
    }

    const id = interaction.options.getInteger('id');
    const response = interaction.options.getString('response') || 'Решение принято администрацией.';
    const status = sub === 'accept' ? 'accepted' : 'denied';
    const result = updateAppealStatus(id, interaction.guild.id, status, interaction.user.id, interaction.user.username, response);
    if (!result.ok) return safeEdit(interaction, { content: '❌ Апелляция не найдена.' });

    const user = await interaction.client.users.fetch(result.appeal.userId).catch(() => null);
    if (user) user.send(`📨 По твоей апелляции #${id} принято решение: **${status}**\n${response}`).catch(() => null);

    await sendModerationLog(interaction.guild, {
      embeds: [createLogEmbed({ title: `📨 Апелляция #${id}: ${status}`, color: status === 'accepted' ? 0x57F287 : 0xED4245, moderator: interaction.user, target: { tag: result.appeal.username, id: result.appeal.userId }, reason: response })],
    });

    return safeEdit(interaction, { content: `✅ Апелляция #${id}: ${status}.` });
  }
};
