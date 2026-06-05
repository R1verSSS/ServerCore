const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getOrCreateUser } = require('../services/dataStore');
const { formatBoosts } = require('../services/inventoryService');

function typeLabel(type) {
  return {
    cosmetic: '🎨 косметика',
    boost: '⚡ буст',
    ticket: '🎟 билет',
    custom: '📝 заявка',
    role: '🎭 роль',
    consumable: '📦 предмет'
  }[type] || '📦 предмет';
}
function formatInventory(user) {
  const inventory = Array.isArray(user.inventory) ? user.inventory : [];
  if (!inventory.length) return 'Инвентарь пуст. Купи предметы через `/shop` и `/buy`.';
  return inventory.map((item, index) => {
    const qty = Number(item.quantity || 1) > 1 ? ` ×${item.quantity}` : '';
    const useHint = ['boost', 'ticket', 'custom', 'consumable'].includes(item.type) ? `\nID для /use: \`${item.id}\`` : '';
    return `**${index + 1}. ${item.name || item.id}${qty}**\nТип: ${typeLabel(item.type)}${useHint}`;
  }).join('\n\n');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Показать инвентарь и активные бусты'),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const user = getOrCreateUser(interaction.user.id, interaction.user.username);
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎒 Инвентарь')
      .setDescription(formatInventory(user))
      .addFields({ name: '⚡ Активные бусты', value: formatBoosts(user), inline: false })
      .setFooter({ text: 'Используй /use item для применения бустов и билетов' });
    return safeEdit(interaction, { embeds: [embed] });
  }
};
