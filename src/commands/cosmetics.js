const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getOrCreateUser } = require('../services/dataStore');
const { listCosmeticInventory, PROFILE_COLORS, PROFILE_BACKGROUNDS } = require('../services/profileCustomizationService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cosmetics')
    .setDescription('Посмотреть купленную косметику профиля'),
  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const user = getOrCreateUser(interaction.user.id, interaction.user.username);
    const cosmetics = listCosmeticInventory(user);
    const lines = cosmetics.map((item, i) => {
      let details = item.value;
      if (item.cosmeticType === 'color') details = PROFILE_COLORS[item.value]?.name || item.value;
      if (item.cosmeticType === 'background') details = PROFILE_BACKGROUNDS[item.value]?.name || item.value;
      return `${i + 1}. **${item.name || item.id}** — ${item.cosmeticType}: ${details}`;
    });
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎨 Косметика профиля')
      .setDescription(lines.length ? lines.join('\n') : 'Косметики пока нет. Загляни в `/shop` или попроси администратора выдать через веб-панель.')
      .setFooter({ text: 'Используй /profilecustomize color/background для выбора' });
    return safeEdit(interaction, { embeds: [embed] });
  }
};
