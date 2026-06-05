const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { addModeratorNote, getModeratorNotes, sendModerationLog, createLogEmbed } = require('../services/moderationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('Модераторские заметки по участнику')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub => sub.setName('add').setDescription('Добавить заметку').addUserOption(option => option.setName('user').setDescription('Участник').setRequired(true)).addStringOption(option => option.setName('text').setDescription('Текст заметки').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('Показать заметки').addUserOption(option => option.setName('user').setDescription('Участник').setRequired(true))),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('user');
    if (!target || target.bot) return safeEdit(interaction, { content: '❌ Укажите обычного участника.' });

    if (sub === 'add') {
      const text = interaction.options.getString('text');
      const note = addModeratorNote({ guildId: interaction.guild.id, userId: target.id, username: target.username, moderatorId: interaction.user.id, moderatorName: interaction.user.username, text });
      await sendModerationLog(interaction.guild, {
        embeds: [createLogEmbed({ title: `📝 Заметка #${note.id}`, color: 0x5865F2, moderator: interaction.user, target, reason: text })],
      });
      return safeEdit(interaction, { content: `✅ Заметка #${note.id} добавлена для **${target.username}**.` });
    }

    const notes = getModeratorNotes(target.id, interaction.guild.id, 15);
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📝 Заметки: ${target.username}`)
      .setDescription(notes.length ? notes.map(n => `#${n.id} • ${new Date(n.createdAt).toLocaleString('ru-RU')}\n${n.text}\nМодератор: ${n.moderatorName}`).join('\n\n').slice(0, 3900) : 'Заметок нет.')
      .setFooter({ text: 'ServerCore • Moderator Notes' });
    return safeEdit(interaction, { embeds: [embed] });
  }
};
