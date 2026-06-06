const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require('discord.js');

const COLOR = 0x57F287;

function buildBotQuickMenuPanel() {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle('🤖 Быстрое меню бота')
    .setDescription([
      'Здесь собраны основные действия бота. Нажимай кнопки — они выполняют действие сразу, без подсказок с командами.',
      '',
      'Обычные сообщения в этом канале могут удаляться автоматически, чтобы канал оставался чистым.'
    ].join('\n'))
    .addFields(
      { name: '👤 Личное', value: 'Профиль, ранг, достижения, Battle Pass.', inline: true },
      { name: '💰 Экономика', value: 'Daily, баланс, инвентарь, магазин.', inline: true },
      { name: '🎮 Активности', value: 'Мини-игры, квесты, ивенты, LFG.', inline: true },
      { name: '🎫 Поддержка', value: 'Тикеты, заявки, предложения.', inline: true },
      { name: '🌐 Веб-панель', value: 'Личный кабинет и вход на сайт.', inline: true },
      { name: '📚 Помощь', value: 'Справочник команд и разделов.', inline: true }
    )
    .setFooter({ text: 'ServerCore • Быстрое меню действий' })
    .setTimestamp();

  const select = new StringSelectMenuBuilder()
    .setCustomId('botquick:section')
    .setPlaceholder('Выбери раздел быстрых действий')
    .addOptions(
      { label: 'Личное', value: 'personal', emoji: '👤', description: 'Профиль, ранг, достижения' },
      { label: 'Экономика', value: 'economy', emoji: '💰', description: 'Daily, баланс, инвентарь, магазин' },
      { label: 'Активности', value: 'activities', emoji: '🎮', description: 'Мини-игры, квесты, ивенты, LFG' },
      { label: 'Поддержка', value: 'support', emoji: '🎫', description: 'Тикеты, заявки, предложения' },
      { label: 'Веб-панель', value: 'web', emoji: '🌐', description: 'Сайт, аккаунт и личная панель' },
      { label: 'Справка', value: 'help', emoji: '📚', description: 'Команды и помощь' }
    );

  const row1 = new ActionRowBuilder().addComponents(select);
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('menu:quick:profile').setLabel('Профиль').setEmoji('👤').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('menu:quick:daily').setLabel('Daily').setEmoji('🎁').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('menu:quick:balance').setLabel('Баланс').setEmoji('💰').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('menu:quick:shop').setLabel('Магазин').setEmoji('🛒').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setLabel('Веб-панель').setEmoji('🌐').setStyle(ButtonStyle.Link).setURL(process.env.WEB_PANEL_URL || 'https://bot-1780694887-7211-r1vers.bothost.tech/login')
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('menu:quick:inventory').setLabel('Инвентарь').setEmoji('🎒').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('menu:quick:games').setLabel('Мини-игры').setEmoji('🎲').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('menu:quick:quest').setLabel('Квест').setEmoji('📜').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('menu:quick:ticket').setLabel('Тикет').setEmoji('🎫').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('menu:quick:help').setLabel('Справка').setEmoji('📚').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1, row2, row3] };
}

function buildBotQuickSectionPayload(section = 'personal') {
  const map = {
    personal: {
      title: '👤 Личное меню',
      description: 'Быстрые действия для профиля и прогресса.',
      buttons: [
        ['menu:quick:profile', 'Профиль', '👤', ButtonStyle.Primary],
        ['menu:quick:rank', 'Ранг', '🏆', ButtonStyle.Secondary],
        ['menu:quick:achievements', 'Достижения', '🏅', ButtonStyle.Secondary],
        ['menu:quick:battlepass', 'Battle Pass', '🎟️', ButtonStyle.Secondary],
        ['menu:quick:profilecard', 'Карточка', '🖼️', ButtonStyle.Secondary]
      ]
    },
    economy: {
      title: '💰 Экономика',
      description: 'Монеты, награды, магазин и инвентарь.',
      buttons: [
        ['menu:quick:daily', 'Daily', '🎁', ButtonStyle.Success],
        ['menu:quick:balance', 'Баланс', '💰', ButtonStyle.Primary],
        ['menu:quick:inventory', 'Инвентарь', '🎒', ButtonStyle.Secondary],
        ['menu:quick:shop', 'Магазин', '🛒', ButtonStyle.Secondary],
        ['menu:quick:balancehistory', 'История', '📜', ButtonStyle.Secondary]
      ]
    },
    activities: {
      title: '🎮 Активности',
      description: 'Игры, квесты и серверные события.',
      buttons: [
        ['menu:quick:games', 'Мини-игры', '🎲', ButtonStyle.Primary],
        ['menu:quick:quest', 'Квест', '📜', ButtonStyle.Secondary],
        ['menu:quick:event', 'Ивенты', '📅', ButtonStyle.Secondary],
        ['menu:quick:lfg', 'LFG', '🎮', ButtonStyle.Secondary],
        ['menu:quick:tournament', 'Турниры', '🏆', ButtonStyle.Secondary]
      ]
    },
    support: {
      title: '🎫 Поддержка',
      description: 'Тикеты, заявки и предложения.',
      buttons: [
        ['menu:quick:ticket', 'Создать тикет', '🎫', ButtonStyle.Primary],
        ['menu:quick:apply', 'Заявка', '📨', ButtonStyle.Secondary],
        ['menu:quick:suggest', 'Идея', '💡', ButtonStyle.Secondary],
        ['menu:quick:help', 'Справка', '📚', ButtonStyle.Secondary]
      ]
    },
    web: {
      title: '🌐 Веб-панель',
      description: 'Личный кабинет и вход на сайт.',
      buttons: [
        ['menu:quick:webpanel', 'Открыть веб-панель', '🌐', ButtonStyle.Primary],
        ['webpanel:account', 'Аккаунт', '🔐', ButtonStyle.Secondary],
        ['webpanel:code', 'Код входа', '🔑', ButtonStyle.Secondary]
      ]
    },
    help: {
      title: '📚 Справка',
      description: 'Подсказки по возможностям сервера.',
      buttons: [
        ['menu:quick:help', 'Открыть справку', '📚', ButtonStyle.Primary],
        ['commands:open:profile', 'Профиль', '👤', ButtonStyle.Secondary],
        ['commands:open:economy', 'Экономика', '💰', ButtonStyle.Secondary],
        ['commands:open:moderation', 'Модерация', '🛡️', ButtonStyle.Secondary]
      ]
    }
  };
  const item = map[section] || map.personal;
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(item.title)
    .setDescription(item.description)
    .setFooter({ text: 'ServerCore • Быстрое меню бота' })
    .setTimestamp();

  const buttons = item.buttons.map(([id, label, emoji, style]) => {
    if (id === 'menu:quick:webpanel') {
      return new ButtonBuilder()
        .setLabel(label)
        .setEmoji(emoji)
        .setStyle(ButtonStyle.Link)
        .setURL(process.env.WEB_PANEL_URL || 'https://bot-1780694887-7211-r1vers.bothost.tech/login');
    }
    return new ButtonBuilder().setCustomId(id).setLabel(label).setEmoji(emoji).setStyle(style);
  });
  buttons.push(new ButtonBuilder().setCustomId('botquick:back').setLabel('Назад').setEmoji('⬅️').setStyle(ButtonStyle.Secondary));
  const row = new ActionRowBuilder().addComponents(...buttons.slice(0, 5));
  const extra = buttons.length > 5 ? [new ActionRowBuilder().addComponents(...buttons.slice(5, 10))] : [];
  return { embeds: [embed], components: [row, ...extra] };
}

module.exports = { buildBotQuickMenuPanel, buildBotQuickSectionPayload };
