const { updateUser, getOrCreateUser } = require('./dataStore');
const { addXpToMember } = require('./xpService');
const { awardAchievement } = require('./achievementService');
const { incrementQuestProgress } = require('./questService');

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizeRps(choice) {
  const map = {
    rock: 'камень',
    paper: 'бумага',
    scissors: 'ножницы',
  };
  return map[choice] || choice;
}

function getRpsResult(player, bot) {
  if (player === bot) return 'draw';
  if (
    (player === 'rock' && bot === 'scissors') ||
    (player === 'paper' && bot === 'rock') ||
    (player === 'scissors' && bot === 'paper')
  ) return 'win';
  return 'lose';
}

async function applyGameReward(member, gameResult) {
  const discordId = member.user.id;
  const username = member.user.username;
  getOrCreateUser(discordId, username);

  const updatedUser = updateUser(discordId, user => {
    user.username = username;
    user.coins = (user.coins || 0) + gameResult.coins;
    if (!user.gameStats) user.gameStats = { played: 0, wins: 0 };
    user.gameStats.played = (user.gameStats.played || 0) + 1;
    if (gameResult.win) user.gameStats.wins = (user.gameStats.wins || 0) + 1;
    return user;
  });

  const xpResult = await addXpToMember(member, gameResult.xp);
  const firstGame = awardAchievement(discordId, username, 'first_game');
  const firstWin = gameResult.win ? awardAchievement(discordId, username, 'first_game_win') : { awarded: false };
  const questResult = incrementQuestProgress(discordId, username, 'game', 1);

  const unlockedAchievements = [
    ...(xpResult.unlockedAchievements || []),
    ...(firstGame.awarded ? [firstGame.achievement] : []),
    ...(firstWin.awarded ? [firstWin.achievement] : []),
  ];

  return {
    ...gameResult,
    user: xpResult.user || updatedUser,
    leveledUp: xpResult.leveledUp,
    newLevel: xpResult.newLevel,
    unlockedAchievements,
    questResult,
  };
}

async function playCoinflip(member, choice) {
  const normalizedChoice = choice === 'tails' ? 'tails' : 'heads';
  const result = Math.random() < 0.5 ? 'heads' : 'tails';
  const win = normalizedChoice === result;

  return applyGameReward(member, {
    title: '🪙 Орел и решка',
    summary: `Твой выбор: **${normalizedChoice === 'heads' ? 'орел' : 'решка'}**\nВыпало: **${result === 'heads' ? 'орел' : 'решка'}**`,
    outcome: win ? 'Победа!' : 'Не повезло.',
    win,
    coins: win ? 35 : 5,
    xp: win ? 10 : 3,
  });
}

async function playDice(member, sides = 6) {
  const safeSides = Math.min(Math.max(Number(sides) || 6, 4), 20);
  const roll = randomInt(1, safeSides);
  const win = roll >= Math.ceil(safeSides * 0.75);

  return applyGameReward(member, {
    title: '🎲 Кубик',
    summary: `Бросок D${safeSides}: **${roll}**`,
    outcome: win ? 'Отличный бросок!' : 'Обычный бросок.',
    win,
    coins: win ? roll * 3 : roll,
    xp: win ? 10 : 5,
  });
}

async function playRps(member, choice) {
  const options = ['rock', 'paper', 'scissors'];
  const player = options.includes(choice) ? choice : 'rock';
  const bot = options[randomInt(0, options.length - 1)];
  const result = getRpsResult(player, bot);

  const win = result === 'win';
  const draw = result === 'draw';

  return applyGameReward(member, {
    title: '✂️ Камень, ножницы, бумага',
    summary: `Ты выбрал: **${normalizeRps(player)}**\nБот выбрал: **${normalizeRps(bot)}**`,
    outcome: draw ? 'Ничья.' : win ? 'Победа!' : 'Поражение.',
    win,
    coins: win ? 40 : draw ? 12 : 4,
    xp: win ? 12 : draw ? 6 : 3,
  });
}

async function playGuess(member, number) {
  const guess = Math.min(Math.max(Number(number) || 1, 1), 5);
  const secret = randomInt(1, 5);
  const win = guess === secret;

  return applyGameReward(member, {
    title: '🔢 Угадай число',
    summary: `Твой вариант: **${guess}**\nЗагаданное число: **${secret}**`,
    outcome: win ? 'Ты угадал!' : 'Не угадал.',
    win,
    coins: win ? 60 : 5,
    xp: win ? 15 : 3,
  });
}

module.exports = {
  playCoinflip,
  playDice,
  playRps,
  playGuess,
};
