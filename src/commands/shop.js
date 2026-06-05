const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getShopItems, getShopItem } = require('../services/economyService');
const { getUserStats } = require('../services/xpService');

const CATEGORIES = {
  all: 'Все товары',
  roles: 'Роли',
  cosmetics: 'Косметика профиля',
  boosts: 'Бусты',
  tickets: 'Билеты',
  special: 'Особые товары'
};
function typeLabel(item) {
  return {
    role: '🎭 Роль',
    cosmetic: '🎨 Косметика',
    boost: '⚡ Буст',
    ticket: '🎟 Билет',
    custom: '📝 Особый товар'
  }[item.type] || '📦 Товар';
}
function formatItem(item) {
  const extra = [];
  if (item.type === 'role') extra.push(`Роль: **${item.roleName || 'не указана'}**`);
  if (item.type === 'cosmetic') extra.push(`Косметика: **${item.cosmeticType || '-'} / ${item.value || '-'}**`);
  if (item.type === 'boost') extra.push(`Эффект: **x${item.multiplier || 2} ${item.boostType === 'coins' ? 'монеты' : 'XP'} на ${item.durationHours || 24} ч.**`);
  return [`**${item.name}**`, `ID: \`${item.id}\``, `Тип: ${typeLabel(item)}`, `Цена: **${item.price} монет**`, item.description, ...extra].filter(Boolean).join('\n');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Показать магазин сервера')
    .addStringOption(option => option.setName('category').setDescription('Категория магазина').setRequired(false).addChoices(
      { name: 'Все товары', value: 'all' },
      { name: 'Роли', value: 'roles' },
      { name: 'Косметика', value: 'cosmetics' },
      { name: 'Бусты', value: 'boosts' },
      { name: 'Билеты', value: 'tickets' },
      { name: 'Особые товары', value: 'special' }
    ))
    .addStringOption(option => option.setName('item').setDescription('Показать конкретный товар по ID').setRequired(false).setAutocomplete(true)),

  async autocomplete(interaction) {
    const focused = (interaction.options.getFocused() || '').toLowerCase();
    const items = getShopItems().filter(item => !focused || `${item.id} ${item.name}`.toLowerCase().includes(focused)).slice(0, 25).map(item => ({ name: `${item.name} — ${item.price} монет`.slice(0, 100), value: item.id }));
    await interaction.respond(items);
  },

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const itemId = interaction.options.getString('item');
    const category = interaction.options.getString('category') || 'all';
    const stats = getUserStats(interaction.user.id, interaction.user.username);

    if (itemId) {
      const item = getShopItem(itemId);
      if (!item) return safeEdit(interaction, { content: `❌ Товар с ID \`${itemId}\` не найден.` });
      const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle(`🛒 ${item.name}`)
        .setDescription(formatItem(item))
        .addFields({ name: 'Твой баланс', value: `${stats.coins || 0} монет`, inline: false })
        .setFooter({ text: 'Используй /buy item для покупки' });
      return safeEdit(interaction, { embeds: [embed] });
    }

    let items = getShopItems();
    if (category !== 'all') items = items.filter(item => item.category === category);
    const description = items.map(formatItem).join('\n\n') || 'В этой категории пока нет товаров.';
    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle(`🛒 Магазин сервера — ${CATEGORIES[category] || 'Все товары'}`)
      .setDescription(description.slice(0, 4000))
      .addFields({ name: 'Твой баланс', value: `${stats.coins || 0} монет`, inline: false })
      .setFooter({ text: 'Используй /shop item или /buy item' });
    await safeEdit(interaction, { embeds: [embed] });
  }
};
