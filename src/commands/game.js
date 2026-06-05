const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { playCoinflip, playDice, playRps, playGuess } = require('../services/gameService');
const { buildUnlockedText } = require('../services/achievementService');
const { buildQuestCompletedText } = require('../services/questService');

function buildGameEmbed(result) {
  const description = [
    result.summary,
    '',
    `**${result.outcome}**`,
    `🎁 Награда: **${result.coins} монет** и **${result.xp} XP**`,
    result.user?.gameStats ? `📊 Сегодня/всего игр: **${result.user.gameStats.played || 0}** · побед: **${result.user.gameStats.wins || 0}**` : '',
  ].filter(Boolean);

  if (result.leveledUp) description.push('', `🎉 Новый уровень: **${result.newLevel}**!`);
  if (result.questResult?.completedNow) description.push(buildQuestCompletedText(result.questResult));
  if (result.unlockedAchievements?.length) {
    description.push('', '🏅 **Новые достижения:**', buildUnlockedText(result.unlockedAchievements));
  }

  return new EmbedBuilder()
    .setColor(result.win ? 0x57F287 : 0x5865F2)
    .setTitle(result.title)
    .setDescription(description.join('\n'))
    .setFooter({ text: 'ServerCore • Mini Games • Играй, выполняй квесты и получай награды' });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('game')
    .setDescription('Мини-игры сервера')
    .addSubcommand(subcommand =>
      subcommand
        .setName('coinflip')
        .setDescription('Орел или решка')
        .addStringOption(option =>
          option
            .setName('choice')
            .setDescription('Твой выбор')
            .setRequired(true)
            .addChoices(
              { name: 'Орел', value: 'heads' },
              { name: 'Решка', value: 'tails' },
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('dice')
        .setDescription('Бросить кубик')
        .addIntegerOption(option =>
          option
            .setName('sides')
            .setDescription('Количество граней от 4 до 20')
            .setRequired(false)
            .setMinValue(4)
            .setMaxValue(20)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('rps')
        .setDescription('Камень, ножницы, бумага')
        .addStringOption(option =>
          option
            .setName('choice')
            .setDescription('Твой выбор')
            .setRequired(true)
            .addChoices(
              { name: 'Камень', value: 'rock' },
              { name: 'Бумага', value: 'paper' },
              { name: 'Ножницы', value: 'scissors' },
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('guess')
        .setDescription('Угадай число от 1 до 5')
        .addIntegerOption(option =>
          option
            .setName('number')
            .setDescription('Число от 1 до 5')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(5)
        )
    ),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const subcommand = interaction.options.getSubcommand();

    let result;
    if (subcommand === 'coinflip') {
      result = await playCoinflip(member, interaction.options.getString('choice'));
    }
    if (subcommand === 'dice') {
      result = await playDice(member, interaction.options.getInteger('sides') || 6);
    }
    if (subcommand === 'rps') {
      result = await playRps(member, interaction.options.getString('choice'));
    }
    if (subcommand === 'guess') {
      result = await playGuess(member, interaction.options.getInteger('number'));
    }

    await safeEdit(interaction, { embeds: [buildGameEmbed(result)] });
  },
};
