const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getUserStats } = require('../services/xpService');

module.exports = {
  data: new ContextMenuCommandBuilder().setName('Профиль').setType(ApplicationCommandType.User),
  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const target = interaction.targetUser;
    const user = getUserStats(target.id, target.username);
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`👤 Профиль ${target.username}`)
      .addFields(
        { name: 'Уровень', value: String(user.level || 1), inline: true },
        { name: 'XP', value: String(user.xp || 0), inline: true },
        { name: 'Монеты', value: String(user.coins || 0), inline: true },
        { name: 'Репутация', value: String(user.reputation || 0), inline: true },
        { name: 'Сообщений', value: String(user.messages || 0), inline: true }
      )
      .setThumbnail(target.displayAvatarURL({ size: 128 }));
    await safeEdit(interaction, { embeds: [embed], components: [] });
  }
};
