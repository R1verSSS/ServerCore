const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { getShopItems, getShopItem, buyItem } = require('./economyService');
const { getUserStats } = require('./xpService');
const { applyDailyDealPrice, getDailyDeal } = require('./managementUxService');

const CATEGORY_LABELS = {
  all: 'Все товары',
  roles: 'Роли',
  cosmetics: 'Косметика',
  boosts: 'Бусты',
  tickets: 'Билеты',
  special: 'Особое',
};

function buildShopPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle('🛒 Магазин сервера')
    .setDescription('Выбери категорию ниже или открой баланс/инвентарь. Покупка через кнопки доступна прямо из карточки товара.')
    .addFields(
      { name: '🎭 Роли', value: 'VIP, Active и другие роли.', inline: true },
      { name: '🎨 Косметика', value: 'Цвета, фоны и оформление профиля.', inline: true },
      { name: '⚡ Бусты', value: 'XP и Coin Boost.', inline: true },
      { name: '🎟 Билеты', value: 'Билеты и особые предметы.', inline: true }
    )
    .setFooter({ text: 'ServerCore • Shop Panel' });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('shop:category:roles').setLabel('Роли').setEmoji('🎭').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('shop:category:cosmetics').setLabel('Косметика').setEmoji('🎨').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('shop:category:boosts').setLabel('Бусты').setEmoji('⚡').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('shop:category:tickets').setLabel('Билеты').setEmoji('🎟').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('shop:category:special').setLabel('Особое').setEmoji('✨').setStyle(ButtonStyle.Secondary)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('shop:balance').setLabel('Баланс').setEmoji('💰').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('shop:inventory').setLabel('Инвентарь').setEmoji('🎒').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('shop:help').setLabel('Как пользоваться').setEmoji('❓').setStyle(ButtonStyle.Secondary)
  );
  return { embeds: [embed], components: [row, row2] };
}

function itemLine(item, allItems = []) {
  const pricing = applyDailyDealPrice(item, allItems);
  const priceText = pricing.isDailyDeal ? `~~${pricing.originalPrice}~~ **${pricing.price}** монет • скидка ${pricing.discountPercent}%` : `${item.price} монет`;
  const dealText = pricing.isDailyDeal ? ' 🔥 **Товар дня**' : '';
  return `**${item.name}**${dealText} — ${priceText}\nID: \`${item.id}\`\n${item.description || 'Без описания'}`;
}

function buildShopCategoryPayload(category = 'all') {
  let items = getShopItems().filter(item => item.enabled !== false);
  if (category !== 'all') items = items.filter(item => item.category === category);
  const shown = items.slice(0, 10);
  const embed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle(`🛍 ${CATEGORY_LABELS[category] || 'Категория'}`)
    .setDescription(shown.length ? shown.map(item => itemLine(item, getShopItems())).join('\n\n').slice(0, 3800) : 'В этой категории пока нет товаров.')
    .setFooter({ text: 'Выбери товар в меню ниже, чтобы открыть карточку покупки.' });
  const components = [];
  if (shown.length) {
    components.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('shop:item_select')
        .setPlaceholder('Выбери товар')
        .addOptions(shown.map(item => ({ label: item.name.slice(0, 100), value: item.id, description: `${item.price} монет`.slice(0, 100) })))
    ));
  }
  components.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('shop:back').setLabel('Назад в магазин').setEmoji('⬅️').setStyle(ButtonStyle.Secondary)
  ));
  return { embeds: [embed], components };
}

function buildShopItemPayload(itemId, userId = null, username = null) {
  const item = getShopItem(itemId);
  if (!item) return { content: '❌ Товар не найден.', embeds: [], components: [] };
  const stats = userId ? getUserStats(userId, username || 'user') : null;
  const pricing = applyDailyDealPrice(item, getShopItems());
  const fields = [
    { name: 'Цена', value: pricing.isDailyDeal ? `~~${pricing.originalPrice}~~ **${pricing.price}** монет (-${pricing.discountPercent}%)` : `${item.price} монет`, inline: true },
    { name: 'Тип', value: item.type || 'item', inline: true },
  ];
  if (stats) fields.push({ name: 'Твой баланс', value: `${stats.coins || 0} монет`, inline: true });
  const embed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle(`🛒 ${item.name}`)
    .setDescription(item.description || 'Без описания')
    .addFields(fields)
    .setFooter({ text: `ID товара: ${item.id}` });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`shop:buy:${item.id}`).setLabel('Купить').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`shop:category:${item.category || 'all'}`).setLabel('К категории').setEmoji('⬅️').setStyle(ButtonStyle.Secondary)
  );
  return { embeds: [embed], components: [row] };
}

async function handleShopButton(interaction) {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  if (action === 'back') return buildShopPanel();
  if (action === 'category') return buildShopCategoryPayload(parts[2] || 'all');
  if (action === 'balance') {
    const stats = getUserStats(interaction.user.id, interaction.user.username);
    return { content: `💰 Твой баланс: **${stats.coins || 0} монет**.`, embeds: [], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('shop:back').setLabel('Назад').setStyle(ButtonStyle.Secondary))] };
  }
  if (action === 'inventory') return { content: '🎒 Инвентарь доступен через `/inventory`. Купленные бусты и предметы применяются через `/use`.', embeds: [], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('shop:back').setLabel('Назад').setStyle(ButtonStyle.Secondary))] };
  if (action === 'help') return { content: 'ℹ️ Открой категорию, выбери товар и нажми **Купить**. Для бустов и предметов после покупки используй `/inventory` и `/use`.', embeds: [], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('shop:back').setLabel('Назад').setStyle(ButtonStyle.Secondary))] };
  if (action === 'buy') {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const result = await buyItem(member, parts.slice(2).join(':'));
    if (!result.ok) {
      if (result.reason === 'not_enough_coins') return { content: `❌ Недостаточно монет. Цена: **${result.item.price}**, баланс: **${result.balance}**, не хватает: **${result.missing}**.`, embeds: [], components: [] };
      if (result.reason === 'not_found') return { content: '❌ Товар не найден.', embeds: [], components: [] };
      if (result.reason === 'role_add_failed') return { content: '❌ Не смог выдать роль. Проверь иерархию ролей бота.', embeds: [], components: [] };
      return { content: `❌ Покупка не выполнена: ${result.reason || 'ошибка'}.`, embeds: [], components: [] };
    }
    return { content: `✅ Покупка выполнена: **${result.item.name}**. Остаток: **${result.balance} монет**.`, embeds: [], components: [] };
  }
  return { content: '❌ Неизвестное действие магазина.', embeds: [], components: [] };
}

function handleShopSelect(interaction) {
  const itemId = interaction.values?.[0];
  return buildShopItemPayload(itemId, interaction.user.id, interaction.user.username);
}

module.exports = { buildShopPanel, buildShopCategoryPayload, buildShopItemPayload, handleShopButton, handleShopSelect };
