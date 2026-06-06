const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const PANEL_COLOR = 0x5865F2;
const DEFAULT_LOGIN_URL = 'https://bot-1780694887-7211-r1vers.bothost.tech/login';

function getWebPanelUrl(path = '/login') {
  const raw = process.env.WEB_PANEL_URL || process.env.PUBLIC_WEB_PANEL_URL || DEFAULT_LOGIN_URL;
  const base = String(raw).trim().replace(/\/$/, '');
  if (!path) return base;
  if (base.endsWith('/login') || base.endsWith('/user-panel') || base.endsWith('/dashboard')) {
    return base;
  }
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function buildWebPanelMenuPayload() {
  const loginUrl = getWebPanelUrl('/login');
  const embed = new EmbedBuilder()
    .setColor(PANEL_COLOR)
    .setTitle('🌐 Веб-панель ServerCore')
    .setDescription([
      'Веб-панель позволяет пользоваться функциями сервера через браузер.',
      '',
      '**Администратор:** входит через логин `Admin` и пароль из настроек хостинга `WEB_PASSWORD`.',
      '**Пользователь:** входит через свой Discord ID и пароль/одноразовый код, созданный командой `/webaccount`.',
      '',
      `🔗 **Ссылка для входа:** ${loginUrl}`
    ].join('\n'))
    .addFields(
      {
        name: '👤 Пользовательская панель',
        value: [
          'Профиль, баланс, последние операции, инвентарь, тикеты, ивенты, покупки и веб-аккаунт.',
          '`/webaccount status` — проверить аккаунт',
          '`/webaccount password` — задать пароль',
          '`/webaccount login-code` — получить одноразовый код'
        ].join('\n'),
        inline: false
      },
      {
        name: '🛡 Админ-панель',
        value: 'Управление сервером, пользователями, тикетами, магазином, backup, модулями и диагностикой.',
        inline: false
      },
      {
        name: '🔐 Безопасность',
        value: 'Не отправляй свой пароль в общий чат. Для разового входа лучше использовать `/webaccount login-code`.',
        inline: false
      }
    )
    .setFooter({ text: 'ServerCore • Web Panel' })
    .setTimestamp();

  const links = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Открыть веб-панель').setEmoji('🌐').setStyle(ButtonStyle.Link).setURL(loginUrl),
    new ButtonBuilder().setLabel('Моя панель').setEmoji('👤').setStyle(ButtonStyle.Link).setURL(getWebPanelUrl('/user-panel')),
    new ButtonBuilder().setLabel('Помощь по входу').setEmoji('❔').setStyle(ButtonStyle.Secondary).setCustomId('webpanel:help')
  );

  const actions = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('webpanel:account').setLabel('Как создать аккаунт').setEmoji('🔐').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('webpanel:code').setLabel('Одноразовый код').setEmoji('🔑').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('webpanel:admin').setLabel('Вход администратора').setEmoji('🛡️').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [links, actions] };
}

function buildWebPanelHelpPayload(kind = 'help') {
  const loginUrl = getWebPanelUrl('/login');
  const data = {
    help: {
      title: '❔ Как пользоваться веб-панелью',
      description: [
        `1. Открой ссылку: ${loginUrl}`,
        '2. Выбери режим входа: **Администратор** или **Пользователь**.',
        '3. Для пользовательского входа заранее создай пароль или одноразовый код через `/webaccount`.',
        '4. После входа пользователь видит только свои данные, а админ — административную панель.'
      ].join('\n')
    },
    account: {
      title: '🔐 Как создать пользовательский веб-аккаунт',
      description: [
        'Используй в Discord одну из команд:',
        '`/webaccount password value:твой_пароль` — создать постоянный пароль.',
        '`/webaccount login-code` — получить одноразовый код на 10 минут.',
        '`/webaccount status` — проверить состояние аккаунта.',
        '',
        'Логин для сайта — твой Discord ID.'
      ].join('\n')
    },
    code: {
      title: '🔑 Одноразовый код входа',
      description: [
        'Команда `/webaccount login-code` создаёт временный код на 10 минут.',
        'Это удобно, если не хочешь хранить постоянный пароль.',
        '',
        `После получения кода открой: ${loginUrl}`
      ].join('\n')
    },
    admin: {
      title: '🛡 Вход администратора',
      description: [
        'Режим администратора предназначен только для владельца/админов сервера.',
        'Логин: `Admin`',
        'Пароль: значение переменной `WEB_PASSWORD` на хостинге.',
        '',
        'Не передавай этот пароль обычным пользователям.'
      ].join('\n')
    }
  };
  const item = data[kind] || data.help;
  const embed = new EmbedBuilder()
    .setColor(PANEL_COLOR)
    .setTitle(item.title)
    .setDescription(item.description)
    .setFooter({ text: 'ServerCore • Web Panel Help' })
    .setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Открыть веб-панель').setEmoji('🌐').setStyle(ButtonStyle.Link).setURL(loginUrl)
  );
  return { embeds: [embed], components: [row] };
}

module.exports = { getWebPanelUrl, buildWebPanelMenuPayload, buildWebPanelHelpPayload };
