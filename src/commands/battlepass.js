const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const {
  buildBattlePassEmbed,
  claimBattlePassReward,
  getBattlePassStatus,
  getSeasonLeaderboard,
  setBattlePassPremium,
  FREE_REWARDS,
  PREMIUM_REWARDS,
  formatRewards
} = require('../services/battlePassService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('battlepass')
    .setDescription('Сезонный Battle Pass')
    .addSubcommand(sub => sub.setName('info').setDescription('Показать Battle Pass'))
    .addSubcommand(sub => sub.setName('rewards').setDescription('Показать список наград'))
    .addSubcommand(sub => sub.setName('claim').setDescription('Получить награду Battle Pass')
      .addStringOption(option => option.setName('track').setDescription('Ветка наград').setRequired(true).addChoices(
        { name: 'Бесплатная', value: 'free' },
        { name: 'Премиум', value: 'premium' }
      ))
      .addIntegerOption(option => option.setName('level').setDescription('Уровень награды').setRequired(true).setMinValue(1).setMaxValue(100)))
    .addSubcommand(sub => sub.setName('top').setDescription('Топ сезонного Battle Pass'))
    .addSubcommand(sub => sub.setName('premium').setDescription('Выдать или снять премиум Battle Pass')
      .addUserOption(option => option.setName('user').setDescription('Участник').setRequired(true))
      .addBooleanOption(option => option.setName('enabled').setDescription('true — выдать, false — снять').setRequired(true))),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();

    if (sub === 'info') {
      return safeEdit(interaction, { embeds: [buildBattlePassEmbed(interaction.user)] });
    }

    if (sub === 'rewards') {
      const status = getBattlePassStatus(interaction.user.id, interaction.user.username);
      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('🎁 Награды Battle Pass')
        .setDescription(`Твой сезонный уровень: **${status.progress.level}**`)
        .addFields(
          { name: 'Бесплатная ветка', value: formatRewards(FREE_REWARDS, status.progress, status.claims.free).slice(0, 1024), inline: false },
          { name: 'Премиум-ветка', value: formatRewards(PREMIUM_REWARDS, status.progress, status.claims.premium).slice(0, 1024), inline: false }
        );
      return safeEdit(interaction, { embeds: [embed] });
    }

    if (sub === 'claim') {
      const track = interaction.options.getString('track');
      const level = interaction.options.getInteger('level');
      const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => interaction.member);
      const result = await claimBattlePassReward(member, track, level);

      if (!result.ok) {
        const messages = {
          not_found: 'Награда для этого уровня не найдена.',
          season_inactive: 'Сейчас нет активного сезона.',
          premium_required: 'Для этой награды нужен премиум Battle Pass.',
          already_claimed: 'Эта награда уже получена.',
          level_required: `Нужно достичь сезонного уровня **${result.reward?.level || level}**. Сейчас у тебя уровень **${result.progress?.level || 1}**.`
        };
        return safeEdit(interaction, { content: `❌ ${messages[result.reason] || 'Не удалось получить награду.'}` });
      }

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Награда Battle Pass получена')
        .setDescription(`Ты получил награду: **${result.reward.title}**\nРезультат: ${result.applied.text}`);
      return safeEdit(interaction, { embeds: [embed] });
    }

    if (sub === 'top') {
      const rows = getSeasonLeaderboard(10).map((user, index) => `**${index + 1}.** ${user.username} — ${user.seasonXp || 0} XP`).join('\n') || 'Данных пока нет.';
      const embed = new EmbedBuilder().setColor(0xFEE75C).setTitle('🏆 Топ Battle Pass').setDescription(rows);
      return safeEdit(interaction, { embeds: [embed] });
    }

    if (sub === 'premium') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
        return safeEdit(interaction, { content: '❌ Управлять премиум Battle Pass может только администратор.' });
      }
      const target = interaction.options.getUser('user');
      const enabled = interaction.options.getBoolean('enabled');
      if (!target || target.bot) return safeEdit(interaction, { content: '❌ Выбери обычного участника, не бота.' });
      setBattlePassPremium(target.id, target.username, enabled);
      return safeEdit(interaction, { content: `✅ Премиум Battle Pass для **${target.username}**: **${enabled ? 'включен' : 'выключен'}**.` });
    }
  }
};
