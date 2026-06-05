const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getInventory, useInventoryItem } = require('../services/inventoryService');

function formatChoice(item) {
  const qty = Number(item.quantity || 1) > 1 ? ` x${item.quantity}` : '';
  const label = `${item.name || item.id}${qty}`;
  return label.length > 100 ? label.slice(0, 97) + '...' : label;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('use')
    .setDescription('Использовать предмет из инвентаря')
    .addStringOption(option => option.setName('item').setDescription('ID предмета').setRequired(true).setAutocomplete(true)),

  async autocomplete(interaction) {
    const focused = (interaction.options.getFocused() || '').toLowerCase();
    const items = getInventory(interaction.user.id, interaction.user.username)
      .filter(item => ['boost', 'ticket', 'custom', 'consumable'].includes(item.type))
      .filter(item => !focused || `${item.id} ${item.name}`.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(item => ({ name: formatChoice(item), value: item.id }));
    await interaction.respond(items);
  },

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const itemId = interaction.options.getString('item');
    const result = useInventoryItem(interaction.user.id, interaction.user.username, itemId);

    if (!result.ok) {
      const text = result.reason === 'not_found'
        ? `Предмет с ID \`${itemId}\` не найден в инвентаре.`
        : `Предмет **${result.item?.name || itemId}** нельзя использовать напрямую.`;
      return safeEdit(interaction, { content: `❌ ${text}` });
    }

    let description = `Ты использовал **${result.item.name || result.item.id}**.`;
    if (result.action === 'boost_activated') {
      const until = new Date(result.boost.expiresAt).toLocaleString('ru-RU');
      const target = result.boost.boostType === 'coins' ? 'монеты' : 'XP';
      description += `\n\n⚡ Активирован буст: **x${result.boost.multiplier} ${target}** до **${until}**.`;
    }
    if (result.action === 'ticket_used') {
      description += '\n\n🎟 Билет помечен как использованный. Администрация может учитывать его при ручном розыгрыше.';
    }
    if (result.action === 'custom_request_used') {
      description += '\n\n📝 Теперь создай тикет через `/ticket` и укажи, какую кастомную роль хочешь получить.';
    }

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Предмет использован')
      .setDescription(description)
      .setFooter({ text: 'ServerCore • Inventory' });
    return safeEdit(interaction, { embeds: [embed] });
  }
};
