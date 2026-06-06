const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

const SECTIONS = {
  profile: {
    label: 'Профиль', emoji: '👤', title: '👤 Профиль и прогресс',
    lines: ['`/profile` — профиль участника', '`/profilecard` — PNG-карточка профиля', '`/rank` — уровень и XP', '`/top` — топ участников', '`/achievements` — достижения', '`/badges` — бейджи', '`/profilecustomize` — оформление профиля', '`/me` — личный центр пользователя']
  },

  webpanel: {
    label: 'Веб-панель', emoji: '🌐', title: '🌐 Веб-панель',
    lines: ['`/webpanel open` — открыть меню веб-панели', '`/webpanel post` — опубликовать меню веб-панели, доступно администрации', '`/webaccount status` — статус пользовательского веб-аккаунта', '`/webaccount password` — задать пароль пользователя', '`/webaccount login-code` — одноразовый код входа', '`/webaccount disable` — отключить веб-аккаунт']
  },
  economy: {
    label: 'Экономика', emoji: '💰', title: '💰 Экономика',
    lines: ['`/daily` — ежедневная награда', '`/balance` — баланс и последние операции и последние операции', '`/gift coins` — подарить монеты', '`/inventory` — инвентарь', '`/use` — использовать предмет']
  },
  shop: {
    label: 'Магазин', emoji: '🛒', title: '🛒 Магазин',
    lines: ['`/shop` — витрина магазина', '`/buy` — купить товар', '`/inventory` — купленные предметы', '`/use` — активировать предмет', '`/gift item` — подарить предмет', '`/shoppanel` — опубликовать панель магазина, доступно администрации']
  },
  activities: {
    label: 'Активности', emoji: '🎮', title: '🎮 Активности',
    lines: ['`/music play` — музыка по YouTube-ссылке в voice-комнате', '`/music queue/pause/resume/skip/stop/leave` — управление музыкой', '`/musicpanel` — опубликовать музыкальную панель, доступно администрации', '`/event list/join/leave` — ивенты', '`/lfg create/list/join` — поиск команды', '`/game` — мини-игры', '`/quest daily/progress/claim` — квесты', '`/battlepass info/rewards/claim` — Battle Pass', '`/tournament list` — турниры', '`/suggest` — предложить идею', '`/poll` — опросы']
  },
  voice: {
    label: 'Voice', emoji: '🔊', title: '🔊 Голосовые комнаты',
    lines: ['Зайди в `➕・создать-комнату`, чтобы получить личную комнату', 'Музыка: зайди в voice-канал и используй `/music play` или панель в `🎵・музыка`', '`/voice info` — информация', '`/voice lock/unlock` — закрыть или открыть комнату', '`/voice rename` — переименовать', '`/voice limit` — лимит участников', '`/voice invite` — пригласить пользователя', '`/voice delete` — удалить комнату']
  },
  support: {
    label: 'Поддержка', emoji: '🎫', title: '🎫 Поддержка и заявки',
    lines: ['`/threadpanel open` — создать тему/ветку через панель', '`/ticket` — создать тикет', '`/close` — закрыть тикет', '`/apply form` — заявка через форму', '`/suggest` — предложить идею', '`/appeal create` — апелляция по наказанию']
  },
  moderation: {
    label: 'Модерация', emoji: '🛡️', title: '🛡️ Модерация',
    lines: ['`/warn` — предупреждение', '`/warnings` — предупреждения участника', '`/warnremove` — снять предупреждение', '`/mute` / `/unmute` — мут', '`/clear` — очистить сообщения', '`/cases` / `/case info` — дела модерации', '`/note add/list` — заметки', '`/appeal list/accept/deny` — апелляции', '`/modpanel` — панель модерации']
  },
  admin: {
    label: 'Админ', emoji: '⚙️', title: '⚙️ Администрирование',
    lines: ['`/settings` — настройки', '`/automod` — AutoMod', '`/backup` — бэкапы', '`/export` — экспорт', '`/dbstatus` — диагностика', '`/hosting-check` — готовность к хостингу', '`/network-check` — сеть', '`/maintenance` — обслуживание', '`/setup-wizard` — мастер настройки']
  }
};

function sectionOptions() {
  return Object.entries(SECTIONS).map(([value, section]) => ({ label: section.label, value, emoji: section.emoji }));
}

function buildCommandReferencePayload(sectionKey = 'profile') {
  const section = SECTIONS[sectionKey] || SECTIONS.profile;
  const embed = new EmbedBuilder()
    .setColor(sectionKey === 'moderation' || sectionKey === 'admin' ? 0xED4245 : 0x5865F2)
    .setTitle(section.title)
    .setDescription(section.lines.join('\n'))
    .setFooter({ text: 'ServerCore • Справочник команд' })
    .setTimestamp();

  const menu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('commands:section')
      .setPlaceholder('Выбери раздел команд')
      .addOptions(sectionOptions())
  );
  return { embeds: [embed], components: [menu] };
}

function buildPublicCommandsPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📚 Команды сервера')
    .setDescription('Выбери раздел ниже, чтобы посмотреть команды. Большинство повседневных функций также доступно через `/menu open`.')
    .addFields(
      { name: '👤 Пользователям', value: 'Профиль, экономика, магазин, ивенты, voice и поддержка.', inline: false },
      { name: '🛡 Модерации', value: 'Модераторские команды вынесены в закрытый канал `📘・команды-модерации`.', inline: false }
    )
    .setFooter({ text: 'ServerCore • Command Reference' });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('commands:open:profile').setLabel('Профиль').setEmoji('👤').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('commands:open:webpanel').setLabel('Веб-панель').setEmoji('🌐').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('commands:open:economy').setLabel('Экономика').setEmoji('💰').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('commands:open:shop').setLabel('Магазин').setEmoji('🛒').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('commands:open:activities').setLabel('Активности').setEmoji('🎮').setStyle(ButtonStyle.Secondary)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('commands:open:support').setLabel('Поддержка').setEmoji('🎫').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('commands:open:voice').setLabel('Voice').setEmoji('🔊').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('commands:open:support').setLabel('Темы').setEmoji('🧵').setStyle(ButtonStyle.Primary)
  );
  return { embeds: [embed], components: [row, row2] };
}

function buildModerationCommandsPanel() {
  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('📘 Команды модерации')
    .setDescription('Закрытый справочник для Helper/Moderator/Admin. Команды проверяются не только при вызове, но и при нажатии кнопок панелей.')
    .addFields(
      { name: '🧰 Быстрые действия', value: '`/modpanel`, `/cases`, `/warnings`, `/appeal list`', inline: false },
      { name: '⚠️ Наказания', value: '`/warn`, `/mute`, `/clear`, `/kick`, `/ban`', inline: false },
      { name: '🔐 Доступ', value: 'Helper — просмотр; Moderator — базовая модерация; Admin — управление; Owner — критичные системные действия.', inline: false }
    )
    .setFooter({ text: 'ServerCore • Moderation Reference' });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('commands:open:moderation').setLabel('Модерация').setEmoji('🛡️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('commands:open:admin').setLabel('Админ').setEmoji('⚙️').setStyle(ButtonStyle.Secondary)
  );
  return { embeds: [embed], components: [row] };
}

function commandsHtml() {
  return Object.entries(SECTIONS).map(([key, section]) => `
    <div class="card section"><h2>${section.title}</h2><table><tr><th>Команда</th><th>Описание</th></tr>${section.lines.map(line => {
      const m = line.match(/`([^`]+)`\s*—\s*(.*)/);
      return `<tr><td><code>${m ? m[1] : line.replaceAll('`','')}</code></td><td>${m ? m[2] : ''}</td></tr>`;
    }).join('')}</table></div>
  `).join('');
}

module.exports = {
  SECTIONS,
  buildCommandReferencePayload,
  buildPublicCommandsPanel,
  buildModerationCommandsPanel,
  commandsHtml,
};
