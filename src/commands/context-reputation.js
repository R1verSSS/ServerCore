const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getUserStats } = require('../services/xpService');

module.exports = {
  data: new ContextMenuCommandBuilder().setName('Репутация').setType(ApplicationCommandType.User),
  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const target = interaction.targetUser;
    const user = getUserStats(target.id, target.username);
    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle(`⭐ Репутация ${target.username}`)
      .setDescription(`Всего репутации: **${user.reputation || 0}**\n\nЧтобы выдать репутацию, используй команду \`/rep user:${target.username}\`.`);
    await safeEdit(interaction, { embeds: [embed], components: [] });
  }
};
