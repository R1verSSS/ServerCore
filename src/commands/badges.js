const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getUserAchievements } = require('../services/achievementService');

function resolveTargetUser(interaction) {
  const selectedUser = interaction.options.getUser('user');
  if (selectedUser && !selectedUser.bot) return selectedUser;
  return interaction.user;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('badges')
    .setDescription('Показать бейджи участника')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Участник, чьи бейджи нужно посмотреть')
        .setRequired(false)
    ),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });

    const target = resolveTargetUser(interaction);

    if (target.bot) {
      await safeEdit(interaction, { content: '🤖 У ботов нет бейджей.' });
      return;
    }

    const data = getUserAchievements(target.id, target.username);
    const badges = data.badges.length ? data.badges.join(' ') : 'Пока нет бейджей.';

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle(`🎖 Бейджи: ${target.username}`)
      .setThumbnail(target.displayAvatarURL({ size: 128 }))
      .setDescription(badges)
      .addFields({ name: 'Достижения', value: `${data.unlockedCount} / ${data.total}`, inline: true })
      .setFooter({ text: 'ServerCore • Badges' });

    await safeEdit(interaction, { embeds: [embed] });
  },
};
