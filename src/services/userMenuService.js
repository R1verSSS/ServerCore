const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const MENU_COLOR = 0x5865F2;

function buildMainMenuPayload() {
  const embed = new EmbedBuilder()
    .setColor(MENU_COLOR)
    .setTitle('🧭 Главное меню сервера')
    .setDescription('Здесь собраны все основные возможности сервера. Выбери раздел ниже — бот покажет понятную панель с нужными действиями.')
    .addFields(
      { name: '👤 Профиль', value: 'Профиль, карточка, достижения, косметика.', inline: true },
      { name: '💰 Экономика', value: 'Daily, баланс, магазин, инвентарь, подарки.', inline: true },
      { name: '🎮 Активности', value: 'Мини-игры, квесты, ивенты, LFG, турниры.', inline: true },
      { name: '🔊 Voice', value: 'Личные voice-комнаты и управление ими.', inline: true },
      { name: '🎫 Поддержка', value: 'Тикеты, заявки, предложения, опросы.', inline: true },
      { name: '🏆 Сезон', value: 'Battle Pass, сезонный топ и награды.', inline: true },
      { name: '🛡 Модерация', value: 'Панели и команды для администрации.', inline: true },
      { name: '📚 Помощь', value: 'Интерактивная справка по командам.', inline: true }
    )
    .setFooter({ text: 'ServerCore • Нажимай кнопки, а не запоминай команды' })
    .setTimestamp();

  const select = new StringSelectMenuBuilder()
    .setCustomId('menu:section')
    .setPlaceholder('Выбери раздел меню')
    .addOptions(
      { label: 'Профиль и достижения', value: 'profile', emoji: '👤', description: 'Профиль, XP, карточка, косметика' },
      { label: 'Экономика и магазин', value: 'economy', emoji: '💰', description: 'Daily, баланс, магазин, инвентарь' },
      { label: 'Игры, квесты и события', value: 'activities', emoji: '🎮', description: 'Мини-игры, ивенты, LFG, турниры' },
      { label: 'Голосовые комнаты', value: 'voice', emoji: '🔊', description: 'Создание и управление личной комнатой' },
      { label: 'Поддержка и заявки', value: 'support', emoji: '🎫', description: 'Тикеты, заявки, предложения, опросы' },
      { label: 'Сезон и Battle Pass', value: 'season', emoji: '🏆', description: 'Сезон, награды и топ' },
      { label: 'Модерация', value: 'moderation', emoji: '🛡️', description: 'Панель и команды администрации' },
      { label: 'Справка', value: 'help', emoji: '📚', description: 'Какие команды за что отвечают' }
    );

  const row = new ActionRowBuilder().addComponents(select);
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('menu:quick:profile').setLabel('Мой профиль').setEmoji('👤').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('menu:quick:daily').setLabel('Daily').setEmoji('🎁').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('menu:quick:roles').setLabel('Роли').setEmoji('✅').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('menu:quick:games').setLabel('Мини-игры').setEmoji('🎲').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('menu:quick:ticket').setLabel('Помощь').setEmoji('🎫').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row, buttons] };
}

function actionButtons(section) {
  const back = new ButtonBuilder().setCustomId('menu:back').setLabel('Назад').setEmoji('⬅️').setStyle(ButtonStyle.Secondary);
  const map = {
    profile: [
      new ButtonBuilder().setCustomId('menu:quick:profile').setLabel('Профиль').setEmoji('👤').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('menu:quick:profilecard').setLabel('Карточка').setEmoji('🖼️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('menu:quick:achievements').setLabel('Достижения').setEmoji('🏅').setStyle(ButtonStyle.Secondary),
      back
    ],
    economy: [
      new ButtonBuilder().setCustomId('menu:quick:daily').setLabel('Daily').setEmoji('🎁').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('menu:quick:shop').setLabel('Магазин').setEmoji('🛒').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('menu:quick:inventory').setLabel('Инвентарь').setEmoji('🎒').setStyle(ButtonStyle.Secondary),
      back
    ],
    activities: [
      new ButtonBuilder().setCustomId('menu:quick:games').setLabel('Мини-игры').setEmoji('🎲').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('menu:quick:event').setLabel('Ивенты').setEmoji('📅').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('menu:quick:lfg').setLabel('LFG').setEmoji('🎮').setStyle(ButtonStyle.Secondary),
      back
    ],
    voice: [
      new ButtonBuilder().setCustomId('menu:quick:voice').setLabel('Как создать').setEmoji('🔊').setStyle(ButtonStyle.Primary),
      back
    ],
    support: [
      new ButtonBuilder().setCustomId('menu:quick:ticket').setLabel('Тикет').setEmoji('🎫').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('menu:quick:suggest').setLabel('Идея').setEmoji('💡').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('menu:quick:apply').setLabel('Заявка').setEmoji('📨').setStyle(ButtonStyle.Secondary),
      back
    ],
    season: [
      new ButtonBuilder().setCustomId('menu:quick:battlepass').setLabel('Battle Pass').setEmoji('🏆').setStyle(ButtonStyle.Primary),
      back
    ],
    moderation: [
      new ButtonBuilder().setCustomId('menu:quick:modpanel').setLabel('Панель').setEmoji('🧰').setStyle(ButtonStyle.Primary),
      back
    ],
    help: [
      new ButtonBuilder().setCustomId('menu:quick:help').setLabel('Открыть /help').setEmoji('📚').setStyle(ButtonStyle.Primary),
      back
    ],
  };
  return new ActionRowBuilder().addComponents(...(map[section] || [back]).slice(0, 5));
}

function buildSectionPayload(section) {
  const map = {
    profile: {
      title: '👤 Профиль и достижения',
      description: 'Команды для прокачки, оформления и просмотра своего прогресса.',
      fields: [
        { name: 'Основное', value: '`/profile` — профиль\n`/rank` — уровень и XP\n`/top` — топ участников\n`/profilecard` — PNG-карточка', inline: false },
        { name: 'Оформление', value: '`/profilecustomize view` — настройки\n`/cosmetics` — купленная косметика\n`/achievements` и `/badges` — достижения и бейджи', inline: false },
        { name: 'Совет', value: 'После покупки косметики в `/shop` применяй ее через `/profilecustomize`.', inline: false }
      ]
    },
    economy: {
      title: '💰 Экономика и магазин',
      description: 'Монеты, покупки, инвентарь, подарки и бусты.',
      fields: [
        { name: 'Монеты', value: '`/daily` — ежедневная награда\n`/balance` — баланс и последние операции\n`/gift coins` — подарить монеты', inline: false },
        { name: 'Магазин', value: '`/shop` — категории\n`/shop item` — карточка товара\n`/buy` — покупка\n`/inventory` и `/use` — предметы', inline: false },
        { name: 'Как получить монеты', value: 'Daily, мини-игры, квесты, ивенты и сезонные награды.', inline: false }
      ]
    },
    activities: {
      title: '🎮 Игры, квесты и события',
      description: 'Активности сервера: мини-игры, квесты, события, поиск команды и турниры.',
      fields: [
        { name: 'Быстрые активности', value: '`/gamepanel` — кнопки мини-игр\n`/game` — мини-игры командами\n`/quest daily` — ежедневный квест', inline: false },
        { name: 'События', value: '`/event list` — ивенты\n`/lfg list` — поиск команды\n`/tournament list` — турниры', inline: false },
        { name: 'Совет', value: 'Панели лучше закрепить в каналах `🎲・мини-игры`, `📅・ивенты`, `🎮・поиск-команды`.', inline: false }
      ]
    },
    voice: {
      title: '🔊 Голосовые комнаты',
      description: 'Зайди в канал **➕・создать-комнату**, и бот создаст личную voice-комнату.',
      fields: [
        { name: 'Панель в комнате', value: 'После создания комнаты бот отправляет панель управления прямо в чат этой комнаты.', inline: false },
        { name: 'Управление', value: '`/voice lock` — закрыть\n`/voice unlock` — открыть\n`/voice rename` — переименовать\n`/voice limit` — лимит\n`/voice invite` — пригласить\n`/voice delete` — удалить', inline: false }
      ]
    },
    support: {
      title: '🎫 Поддержка, заявки и идеи',
      description: 'Помощь администрации, формы заявок, предложения и опросы.',
      fields: [
        { name: 'Поддержка', value: '`/ticket` — создать тикет\n`/apply form` — заявка через форму\n`/applypanel` — панель заявок', inline: false },
        { name: 'Идеи', value: '`/suggest` — предложить идею\n`/suggestions` — список\n`/poll create` — опрос', inline: false }
      ]
    },
    season: {
      title: '🏆 Сезон и Battle Pass',
      description: 'Сезонный прогресс, топ и награды.',
      fields: [
        { name: 'Команды', value: '`/season info` — сезон\n`/battlepass info` — прогресс\n`/battlepass rewards` — награды\n`/battlepass claim` — забрать награду\n`/battlepass top` — топ сезона', inline: false },
        { name: 'Совет', value: 'Сезонный XP обычно начисляется за активность: сообщения, игры, квесты, ивенты.', inline: false }
      ]
    },
    moderation: {
      title: '🛡 Модерация',
      description: 'Раздел для администрации и модераторов.',
      fields: [
        { name: 'Панели', value: '`/modpanel` — панель модерации\n`/automod status` — состояние AutoMod\n`/settings view` — настройки', inline: false },
        { name: 'Действия', value: '`/warn`, `/mute`, `/clear`, `/cases`, `/note`, `/appeal`', inline: false }
      ]
    },
    help: {
      title: '📚 Справка',
      description: 'Используй `/help`, чтобы открыть интерактивную справку с категориями команд.',
      fields: [
        { name: 'Как пользоваться', value: 'Открой `/help` и выбери нужный раздел через выпадающее меню.', inline: false },
        { name: 'Для новичков', value: 'Начни с `/menu open`, `/roles`, `/daily`, `/profile`.', inline: false }
      ]
    }
  };

  const item = map[section] || map.profile;
  const embed = new EmbedBuilder()
    .setColor(MENU_COLOR)
    .setTitle(item.title)
    .setDescription(item.description)
    .addFields(item.fields)
    .setFooter({ text: 'ServerCore • Меню пользователя' })
    .setTimestamp();

  return { embeds: [embed], components: [actionButtons(section)] };
}

function buildQuickPayload(kind) {
  const quick = {
    roles: buildSectionPayload('profile'),
    games: buildSectionPayload('activities'),
    voice: buildSectionPayload('voice'),
    ticket: buildSectionPayload('support'),
    profile: buildSectionPayload('profile'),
    daily: buildSectionPayload('economy'),
    shop: buildSectionPayload('economy'),
    inventory: buildSectionPayload('economy'),
    profilecard: buildSectionPayload('profile'),
    achievements: buildSectionPayload('profile'),
    event: buildSectionPayload('activities'),
    lfg: buildSectionPayload('activities'),
    suggest: buildSectionPayload('support'),
    apply: buildSectionPayload('support'),
    battlepass: buildSectionPayload('season'),
    modpanel: buildSectionPayload('moderation'),
    help: buildSectionPayload('help'),
  };
  return quick[kind] || buildMainMenuPayload();
}

module.exports = { buildMainMenuPayload, buildSectionPayload, buildQuickPayload };
