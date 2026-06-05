const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { buildUnlockedText } = require('../services/achievementService');
const { giveReputation, formatWaitTime } = require('../services/reputationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rep')
    .setDescription('Выдать +1 репутацию участнику')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Участник, которому нужно выдать репутацию')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Причина выдачи репутации')
        .setRequired(false)
        .setMaxLength(200)
    ),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });

    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'Причина не указана';

    if (target.id === interaction.user.id) {
      await safeEdit(interaction, { content: '❌ Нельзя выдавать репутацию самому себе.' });
      return;
    }

    if (target.bot) {
      await safeEdit(interaction, { content: '❌ Ботам нельзя выдавать репутацию.' });
      return;
    }

    const result = giveReputation({
      fromUser: interaction.user,
      toUser: target,
      reason
    });

    if (!result.ok && result.reason === 'cooldown') {
      await safeEdit(interaction, {
        content: `⏳ Ты уже выдавал репутацию этому участнику недавно. Попробуй снова через **${formatWaitTime(result.waitMs)}**.`
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('⭐ Репутация выдана')
      .setDescription([
        `${target} получил **+1 репутацию**.`,
        result.unlockedAchievements?.length ? `\n🏅 **Твои новые достижения:**\n${buildUnlockedText(result.unlockedAchievements)}` : null,
        result.receiverUnlockedAchievements?.length ? `\n🏅 **Новые достижения у ${target.username}:**\n${buildUnlockedText(result.receiverUnlockedAchievements)}` : null
      ].filter(Boolean).join('\n'))
      .addFields(
        { name: 'Причина', value: reason, inline: false },
        { name: 'Всего репутации', value: String(result.total), inline: true }
      )
      .setFooter({ text: 'ServerCore • Reputation System' });

    await safeEdit(interaction, { embeds: [embed] });
  }
};
