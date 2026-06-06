const { ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildMainMenuPayload } = require('./userMenuService');
const { getOnboardingProgress, markOnboarding, recordEconomy } = require('./managementUxService');
const { updateUser } = require('./dataStore');
const { awardAchievement, buildUnlockedText } = require('./achievementService');
const { rememberUserAction } = require('./uxFlowService');

function findChannel(guild, name) {
  return guild?.channels.cache.find(ch => ch.type === ChannelType.GuildText && ch.name === name) || null;
}

function stepLine(progress, key, label) {
  return `${progress.steps?.[key] ? '✅' : '⬜'} ${label}`;
}

function buildWelcomePayload(member) {
  const progress = getOnboardingProgress(member.id);
  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('👋 Добро пожаловать!')
    .setDescription(`Привет, ${member}! Пройди короткий стартовый маршрут и освойся на сервере.`)
    .addFields(
      { name: '📋 Твой стартовый прогресс', value: [
        stepLine(progress, 'rules', 'Прочитать правила'),
        stepLine(progress, 'roles', 'Получить роли'),
        stepLine(progress, 'menu', 'Открыть главное меню'),
        stepLine(progress, 'daily', 'Получить daily'),
        stepLine(progress, 'profile', 'Посмотреть профиль')
      ].join('\n'), inline: false },
      { name: 'Подсказка', value: 'Нажимай кнопки ниже. Прогресс сохраняется в базе и помогает новичкам не потеряться.', inline: false }
    )
    .setFooter({ text: 'ServerCore • Onboarding' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('onboarding:rules').setLabel('Правила').setEmoji('📜').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('onboarding:roles').setLabel('Роли').setEmoji('✅').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('onboarding:menu').setLabel('Меню').setEmoji('🧭').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('onboarding:daily').setLabel('Daily').setEmoji('🎁').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('onboarding:profile').setLabel('Профиль').setEmoji('👤').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

function buildOnboardingStepPayload(interaction, step) {
  const progress = markOnboarding(interaction.user.id, step);
  const messages = {
    rules: '📜 Правила обычно находятся в канале `📜・правила`. Прочитай их перед активностью.',
    roles: '✅ Роли можно выбрать через канал `✅・получить-роли` или команду `/roles`.',
    menu: '🧭 Главное меню доступно через `/menu open`.',
    daily: '🎁 Получи ежедневную награду командой `/daily`.',
    profile: '👤 Профиль доступен через `/profile`, `/rank` и `/profilecard`.'
  };
  const required = ['rules','roles','menu','daily','profile'];
  const done = required.every(key => progress.steps?.[key]);
  let rewardText = '';
  if (done && !progress.rewardedAt) {
    const rewardCoins = Number(process.env.ONBOARDING_REWARD_COINS || 100);
    updateUser(interaction.user.id, user => {
      user.username = interaction.user.username;
      user.coins = (user.coins || 0) + rewardCoins;
      return user;
    });
    recordEconomy(interaction.user.id, interaction.user.username, 'onboarding_reward', rewardCoins, { steps: required });
    const refreshed = markOnboarding(interaction.user.id, 'rewarded');
    refreshed.rewardedAt = new Date().toISOString();
    const { readDatabase, writeDatabase } = require('./dataStore');
    const db = readDatabase();
    db.onboardingProgress[interaction.user.id] = refreshed;
    writeDatabase(db);
    rewardText = `\n\n🎁 Чек-лист завершен! Начислена награда: **${rewardCoins} монет**.`;
  }
  return { content: (messages[step] || '✅ Шаг отмечен.') + rewardText, embeds: [], components: [] };
}

async function sendWelcome(member) {
  markOnboarding(member.id, 'joined');
  const channel = findChannel(member.guild, '💬・общий-чат') || findChannel(member.guild, '🧭・навигация') || findChannel(member.guild, '🤖・команды-бота');
  if (!channel || typeof channel.send !== 'function') return false;
  await channel.send(buildWelcomePayload(member));
  return true;
}

async function postNavigationMenu(guild) {
  const channel = findChannel(guild, '🧭・навигация');
  if (!channel || typeof channel.send !== 'function') return false;
  await channel.send(buildMainMenuPayload());
  return true;
}

module.exports = { buildWelcomePayload, buildOnboardingStepPayload, sendWelcome, postNavigationMenu };
