const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { buyItem, getShopItems } = require('../services/economyService');
const { buildUnlockedText } = require('../services/achievementService');

function formatItemChoice(item) {
  const label = `${item.name} — ${item.price} монет`;
  return label.length > 100 ? label.slice(0, 97) + '...' : label;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Купить товар в магазине по ID')
    .addStringOption(option =>
      option
        .setName('item')
        .setDescription('ID товара из /shop, например profile_color_gold')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focused = (interaction.options.getFocused() || '').toLowerCase();
    const items = getShopItems()
      .filter(item => {
        const haystack = `${item.id} ${item.name} ${item.description}`.toLowerCase();
        return !focused || haystack.includes(focused);
      })
      .slice(0, 25)
      .map(item => ({ name: formatItemChoice(item), value: item.id }));

    await interaction.respond(items);
  },

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });

    const itemId = interaction.options.getString('item');
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const result = await buyItem(member, itemId);

    if (!result.ok) {
      let title = '❌ Покупка не выполнена';
      let description = 'Не удалось выполнить покупку.';

      if (result.reason === 'not_enough_coins') {
        description = `Недостаточно монет для покупки **${result.item.name}**.\nЦена: **${result.item.price}**\nТвой баланс: **${result.balance}**\nНе хватает: **${result.missing}**`;
      } else if (result.reason === 'already_owned') {
        description = `У тебя уже есть роль **${result.item.name}**. Монеты не списаны.`;
      } else if (result.reason === 'already_owned_cosmetic') {
        description = `Косметика **${result.item.name}** уже есть в твоем инвентаре. Монеты не списаны.`;
      } else if (result.reason === 'role_not_found') {
        description = `Роль для товара **${result.item.name}** не найдена на сервере. Запусти \`npm run setup\` или создай роль вручную.`;
      } else if (result.reason === 'role_add_failed') {
        description = `Бот не смог выдать роль **${result.item.name}**. Проверь, что роль бота находится выше покупаемой роли в настройках ролей Discord.`;
      } else if (result.reason === 'not_found') {
        description = `Товар с ID \`${itemId}\` не найден. Проверь ID через команду \`/shop\`.`;
      }

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: 'ServerCore • Shop' });

      await safeEdit(interaction, { embeds: [embed] });
      return;
    }

    let afterBuyHint = '';
    if (result.item.type === 'cosmetic') {
      afterBuyHint = '\n\n🎨 Косметика добавлена в инвентарь. Используй `/cosmetics`, а затем `/profilecustomize color` или `/profilecustomize background`.';
    }
    if (['boost', 'ticket', 'custom', 'consumable'].includes(result.item.type)) {
      afterBuyHint = '\n\n🎒 Предмет добавлен в инвентарь. Используй `/inventory` и `/use item`, чтобы применить его.';
    }

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Покупка выполнена')
      .setDescription([
        `Ты купил **${result.item.name}**.`,
        `Остаток: **${result.balance} монет**.`,
        afterBuyHint,
        result.unlockedAchievements?.length ? `\n🏅 **Новые достижения:**\n${buildUnlockedText(result.unlockedAchievements)}` : null
      ].filter(Boolean).join('\n'))
      .setFooter({ text: 'ServerCore • Shop' });

    await safeEdit(interaction, { embeds: [embed] });
  }
};
