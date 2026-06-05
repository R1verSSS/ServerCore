const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { ensureQuest, getQuestState, claimQuest, buildQuestEmbed } = require('../services/questService');
const { buildUnlockedText } = require('../services/achievementService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quest')
    .setDescription('Ежедневные квесты')
    .addSubcommand(subcommand =>
      subcommand
        .setName('daily')
        .setDescription('Получить или посмотреть ежедневный квест')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('progress')
        .setDescription('Показать прогресс ежедневного квеста')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('claim')
        .setDescription('Забрать награду за выполненный квест')
    ),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });

    const subcommand = interaction.options.getSubcommand();
    const member = await interaction.guild.members.fetch(interaction.user.id);

    if (subcommand === 'daily' || subcommand === 'progress') {
      const quest = subcommand === 'daily'
        ? ensureQuest(interaction.user.id, interaction.user.username)
        : getQuestState(interaction.user.id, interaction.user.username);

      await safeEdit(interaction, { embeds: [buildQuestEmbed(interaction.user, quest)] });
      return;
    }

    if (subcommand === 'claim') {
      const result = await claimQuest(member);

      if (!result.ok) {
        const quest = result.quest || getQuestState(interaction.user.id, interaction.user.username);
        const embed = buildQuestEmbed(interaction.user, quest);
        if (result.reason === 'not_completed') {
          embed.setColor(0xFEE75C).setTitle('⏳ Квест еще не выполнен');
        }
        if (result.reason === 'already_claimed') {
          embed.setColor(0xED4245).setTitle('⚠️ Награда уже получена');
        }
        await safeEdit(interaction, { embeds: [embed] });
        return;
      }

      const lines = [
        `Ты получил **${result.rewardCoins} монет** и **${result.rewardXp} XP**.`,
        `Квест: **${result.quest.title}**`,
      ];

      if (result.leveledUp) lines.push('', `🎉 Новый уровень: **${result.newLevel}**!`);
      if (result.unlockedAchievements?.length) {
        lines.push('', '🏅 **Новые достижения:**', buildUnlockedText(result.unlockedAchievements));
      }

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🎁 Награда за квест получена')
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'ServerCore • Quests' });

      await safeEdit(interaction, { embeds: [embed] });
    }
  },
};
