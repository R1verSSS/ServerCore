const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getReputationForUser } = require('../services/reputationService');

function resolveTargetUser(interaction) {
  const selectedUser = interaction.options.getUser('user');
  if (selectedUser && !selectedUser.bot) return selectedUser;
  return interaction.user;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reputation')
    .setDescription('Посмотреть репутацию участника')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Участник, чью репутацию нужно посмотреть')
        .setRequired(false)
    ),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });

    const target = resolveTargetUser(interaction);

    if (target.bot) {
      await safeEdit(interaction, { content: '🤖 Боты не участвуют в системе репутации.' });
      return;
    }

    const data = getReputationForUser(target.id, target.username);
    const lastText = data.last
      ? `От **${data.last.fromUsername}**: ${data.last.reason}`
      : 'Пока нет записей.';

    const recent = data.received.slice(0, 5);
    const recentText = recent.length
      ? recent.map((item, index) => `${index + 1}. **${item.fromUsername}** — ${item.reason}`).join('\n')
      : 'Пока никто не выдавал репутацию.';

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle(`⭐ Репутация: ${target.username}`)
      .setThumbnail(target.displayAvatarURL({ size: 128 }))
      .addFields(
        { name: 'Всего репутации', value: String(data.total), inline: true },
        { name: 'Последняя запись', value: lastText, inline: false },
        { name: 'Последние причины', value: recentText, inline: false }
      )
      .setFooter({ text: 'ServerCore • Reputation System' });

    await safeEdit(interaction, { embeds: [embed] });
  }
};
