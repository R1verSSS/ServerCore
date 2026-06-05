const { ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildMainMenuPayload } = require('./userMenuService');

function findChannel(guild, name) {
  return guild?.channels.cache.find(ch => ch.type === ChannelType.GuildText && ch.name === name) || null;
}

function buildWelcomePayload(member) {
  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('👋 Добро пожаловать!')
    .setDescription(`Привет, ${member}! Чтобы быстро освоиться на сервере, начни с короткого чек-листа ниже.`)
    .addFields(
      { name: '1. Правила', value: 'Прочитай правила и используй каналы по назначению.', inline: false },
      { name: '2. Роли', value: 'Выбери роли по интересам, чтобы видеть нужные разделы.', inline: false },
      { name: '3. Меню', value: 'Открой меню сервера: там собраны профиль, экономика, ивенты, voice-комнаты и поддержка.', inline: false },
      { name: '4. Первый шаг', value: 'Попробуй `/daily`, `/profile` или зайди в `➕・создать-комнату`.', inline: false }
    )
    .setFooter({ text: 'ServerCore • Onboarding' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('menu:quick:roles').setLabel('Выбрать роли').setEmoji('✅').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('menu:back').setLabel('Открыть меню').setEmoji('🧭').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('menu:quick:ticket').setLabel('Нужна помощь').setEmoji('🎫').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

async function sendWelcome(member) {
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

module.exports = { buildWelcomePayload, sendWelcome, postNavigationMenu };
