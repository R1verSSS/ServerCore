const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getTopUsers } = require('../services/xpService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('Показать топ участников по уровню и XP'),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });

    const clientUserId = interaction.client.user?.id;
    const users = getTopUsers(20)
      .filter(user => user.discordId !== clientUserId)
      .slice(0, 10);

    const description = users.length
      ? users.map((user, index) => {
          const place = index + 1;
          const medal = place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : `${place}.`;
          return `${medal} **${user.username}** — уровень ${user.level || 1}, XP ${user.xp || 0}, сообщений ${user.messages || 0}`;
        }).join('\n')
      : 'Пока нет данных. Напиши несколько сообщений, чтобы попасть в рейтинг.';

    const embed = new EmbedBuilder()
      .setColor(0xEB459E)
      .setTitle('🏆 Топ участников сервера')
      .setDescription(description)
      .setFooter({ text: 'ServerCore • Leaderboard' });

    await safeEdit(interaction, { embeds: [embed] });
  }
};
