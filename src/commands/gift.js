const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getOrCreateUser, updateUser } = require('../services/dataStore');
const { getInventory, transferInventoryItem } = require('../services/inventoryService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gift')
    .setDescription('Подарить монеты или предмет')
    .addSubcommand(sub => sub.setName('coins').setDescription('Подарить монеты').addUserOption(o => o.setName('user').setDescription('Кому').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Сумма').setRequired(true).setMinValue(1)))
    .addSubcommand(sub => sub.setName('item').setDescription('Подарить предмет из инвентаря').addUserOption(o => o.setName('user').setDescription('Кому').setRequired(true)).addStringOption(o => o.setName('item').setDescription('ID предмета').setRequired(true).setAutocomplete(true))),

  async autocomplete(interaction) {
    const focused = (interaction.options.getFocused() || '').toLowerCase();
    const items = getInventory(interaction.user.id, interaction.user.username)
      .filter(item => item.type !== 'cosmetic')
      .filter(item => !focused || `${item.id} ${item.name}`.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(item => ({ name: `${item.name || item.id}${Number(item.quantity || 1) > 1 ? ` x${item.quantity}` : ''}`.slice(0, 100), value: item.id }));
    await interaction.respond(items);
  },

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('user');
    if (target.bot || target.id === interaction.user.id) return safeEdit(interaction, { content: '❌ Нельзя отправить подарок этому пользователю.' });

    if (sub === 'coins') {
      const amount = interaction.options.getInteger('amount');
      const sender = getOrCreateUser(interaction.user.id, interaction.user.username);
      if ((sender.coins || 0) < amount) return safeEdit(interaction, { content: `❌ Недостаточно монет. Баланс: ${sender.coins || 0}` });
      updateUser(interaction.user.id, u => { u.coins = (u.coins || 0) - amount; return u; });
      updateUser(target.id, u => { u.username = target.username; u.coins = (u.coins || 0) + amount; return u; });
      const embed = new EmbedBuilder().setColor(0x57F287).setTitle('🎁 Подарок отправлен').setDescription(`${interaction.user} подарил ${target} **${amount} монет**.`);
      return safeEdit(interaction, { embeds: [embed] });
    }

    const itemId = interaction.options.getString('item');
    const result = transferInventoryItem(interaction.user.id, interaction.user.username, target.id, target.username, itemId);
    if (!result.ok) {
      const reason = result.reason === 'cosmetic_not_transferable' ? 'Косметику профиля нельзя передавать.' : 'Предмет не найден в инвентаре.';
      return safeEdit(interaction, { content: `❌ ${reason}` });
    }
    const embed = new EmbedBuilder().setColor(0x57F287).setTitle('🎁 Предмет подарен').setDescription(`${interaction.user} подарил ${target} предмет **${result.item.name || result.item.id}**.`);
    return safeEdit(interaction, { embeds: [embed] });
  }
};
