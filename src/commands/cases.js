const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { listCases, getModeratorNotes } = require('../services/moderationService');

function fmt(item) {
  const date = item.createdAt ? new Date(item.createdAt).toLocaleString('ru-RU') : 'неизвестно';
  const status = item.status === 'closed' ? 'закрыто' : 'активно';
  return `#${item.id} • ${item.type} • ${status} • ${date}\nУчастник: ${item.username || item.userId}\nПричина: ${item.reason || 'Не указана'}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cases')
    .setDescription('История наказаний участника или последние дела сервера')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option => option.setName('user').setDescription('Участник').setRequired(false))
    .addStringOption(option => option.setName('status').setDescription('Статус').setRequired(false).addChoices(
      { name: 'Активные', value: 'active' },
      { name: 'Закрытые', value: 'closed' }
    ))
    .addIntegerOption(option => option.setName('limit').setDescription('Количество записей, максимум 20').setRequired(false).setMinValue(1).setMaxValue(20)),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const target = interaction.options.getUser('user');
    const status = interaction.options.getString('status');
    const limit = interaction.options.getInteger('limit') || 10;
    const cases = listCases({ guildId: interaction.guild.id, userId: target?.id, status, limit });
    const notes = target ? getModeratorNotes(target.id, interaction.guild.id, 5) : [];

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(target ? `📁 История модерации: ${target.username}` : '📁 Последние дела модерации')
      .setDescription(cases.length ? cases.map(fmt).join('\n\n').slice(0, 3900) : 'Дел пока нет.')
      .addFields(
        { name: 'Найдено', value: `${cases.length}`, inline: true },
        { name: 'Фильтр', value: status || 'все', inline: true }
      )
      .setFooter({ text: 'ServerCore • Moderation Cases' });

    if (target && notes.length) {
      embed.addFields({ name: '📝 Последние заметки', value: notes.map(n => `#${n.id}: ${n.text}`).join('\n').slice(0, 900), inline: false });
    }

    await safeEdit(interaction, { embeds: [embed] });
  }
};
