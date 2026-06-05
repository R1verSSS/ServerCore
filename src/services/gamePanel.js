const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType } = require('discord.js');
const { playCoinflip, playDice, playRps, playGuess } = require('./gameService');
const { buildUnlockedText } = require('./achievementService');
const { buildQuestCompletedText } = require('./questService');

const MINI_GAMES_CHANNEL_NAME = '🎲・мини-игры';

function buildGamePanel() {
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('🎲 Панель мини-игр')
    .setDescription([
      'Выбери игру кнопкой ниже. За игры можно получить **монеты**, **XP**, прогресс квестов и достижения.',
      '',
      '🪙 **Орел и решка** — выбери сторону монеты.',
      '🎲 **Кубик** — бросок D6.',
      '✂️ **Камень, ножницы, бумага** — игра против бота.',
      '🔢 **Угадай число** — выбери число от 1 до 5.',
    ].join('\n'))
    .setFooter({ text: 'ServerCore • Mini Games Panel • Играй, выполняй квесты и получай награды' });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gamepanel:coinflip:heads').setEmoji('🪙').setLabel('Орел').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('gamepanel:coinflip:tails').setEmoji('🪙').setLabel('Решка').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('gamepanel:dice:6').setEmoji('🎲').setLabel('Кубик D6').setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gamepanel:rps:rock').setEmoji('🪨').setLabel('Камень').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('gamepanel:rps:paper').setEmoji('📄').setLabel('Бумага').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('gamepanel:rps:scissors').setEmoji('✂️').setLabel('Ножницы').setStyle(ButtonStyle.Secondary),
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gamepanel:guess:1').setEmoji('1️⃣').setLabel('1').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('gamepanel:guess:2').setEmoji('2️⃣').setLabel('2').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('gamepanel:guess:3').setEmoji('3️⃣').setLabel('3').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('gamepanel:guess:4').setEmoji('4️⃣').setLabel('4').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('gamepanel:guess:5').setEmoji('5️⃣').setLabel('5').setStyle(ButtonStyle.Success),
  );

  return { embeds: [embed], components: [row1, row2, row3] };
}

function buildPanelGameEmbed(result) {
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
    .setFooter({ text: 'ServerCore • Mini Games Panel • Играй, выполняй квесты и получай награды' });
}

async function findMiniGamesChannel(guild) {
  return guild.channels.cache.find(channel => channel.name === MINI_GAMES_CHANNEL_NAME && channel.type === ChannelType.GuildText) || null;
}

async function sendGamePanelToMiniGames(guild) {
  const channel = await findMiniGamesChannel(guild);
  if (!channel) return { ok: false, reason: 'channel_not_found' };
  const message = await channel.send(buildGamePanel());
  return { ok: true, channel, message };
}

async function handleGamePanelButton(interaction) {
  const [, game, value] = interaction.customId.split(':');
  const member = await interaction.guild.members.fetch(interaction.user.id);

  let result;
  if (game === 'coinflip') result = await playCoinflip(member, value);
  if (game === 'dice') result = await playDice(member, Number(value) || 6);
  if (game === 'rps') result = await playRps(member, value);
  if (game === 'guess') result = await playGuess(member, Number(value));

  if (!result) return { ok: false };
  return { ok: true, embed: buildPanelGameEmbed(result) };
}

module.exports = {
  MINI_GAMES_CHANNEL_NAME,
  buildGamePanel,
  sendGamePanelToMiniGames,
  handleGamePanelButton,
};
