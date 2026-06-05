const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getUserAchievements } = require('../services/achievementService');

function resolveTargetUser(interaction) {
  const selectedUser = interaction.options.getUser('user');
  if (selectedUser && !selectedUser.bot) return selectedUser;
  return interaction.user;
}

function formatUnlocked(unlocked) {
  if (!unlocked.length) return 'Пока нет открытых достижений.';
  return unlocked
    .slice(0, 12)
    .map(item => `${item.badge} **${item.title}** — ${item.description}`)
    .join('\n');
}

function formatLocked(locked) {
  if (!locked.length) return 'Все достижения открыты.';
  return locked
    .slice(0, 12)
    .map(item => `🔒 **${item.title}** — ${item.description}`)
    .join('\n');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('achievements')
    .setDescription('Показать достижения участника')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Участник, чьи достижения нужно посмотреть')
        .setRequired(false)
    ),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });

    const target = resolveTargetUser(interaction);

    if (target.bot) {
      await safeEdit(interaction, { content: '🤖 У ботов нет достижений.' });
      return;
    }

    const data = getUserAchievements(target.id, target.username);
    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle(`🏅 Достижения: ${target.username}`)
      .setThumbnail(target.displayAvatarURL({ size: 128 }))
      .setDescription(`Открыто: **${data.unlockedCount} / ${data.total}**`)
      .addFields(
        { name: 'Открытые', value: formatUnlocked(data.unlocked), inline: false },
        { name: 'Еще не открыты', value: formatLocked(data.locked), inline: false }
      )
      .setFooter({ text: 'ServerCore • Achievements' });

    await safeEdit(interaction, { embeds: [embed] });
  },
};
