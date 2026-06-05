const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { claimDaily } = require('../services/economyService');
const { getRequiredXp } = require('../services/xpService');
const { buildUnlockedText } = require('../services/achievementService');
const { incrementQuestProgress, buildQuestCompletedText } = require('../services/questService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Получить ежедневную награду'),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const result = await claimDaily(member);

    if (!result.ok && result.reason === 'cooldown') {
      const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('⏳ Ежедневная награда уже получена')
        .setDescription(`Следующую награду можно получить через **${result.remainingText}**.`)
        .setFooter({ text: 'ServerCore • Daily Reward' });

      await safeEdit(interaction, { embeds: [embed] });
      return;
    }

    const questResult = incrementQuestProgress(interaction.user.id, interaction.user.username, 'daily', 1);
    const user = result.user;
    const requiredXp = getRequiredXp(user.level || 1);
    const description = [
      `Ты получил **${result.coins} монет** и **${result.xp} XP**.`,
      `Баланс: **${user.coins || 0} монет**`,
      `Уровень: **${user.level || 1}**`,
      `XP: **${user.xp || 0} / ${requiredXp}**`
    ];

    if (result.leveledUp) {
      description.push('', `🎉 Новый уровень: **${result.newLevel}**!`);
    }

    if (questResult.completedNow) {
      description.push(buildQuestCompletedText(questResult));
    }

    if (result.unlockedAchievements?.length) {
      description.push('', '🏅 **Новые достижения:**', buildUnlockedText(result.unlockedAchievements));
    }

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('🎁 Ежедневная награда')
      .setDescription(description.join('\n'))
      .setFooter({ text: 'ServerCore • Economy' });

    await safeEdit(interaction, { embeds: [embed] });
  }
};
