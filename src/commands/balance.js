const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getUserStats } = require('../services/xpService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Показать баланс монет')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Участник, чей баланс нужно посмотреть')
        .setRequired(false)
    ),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });

    const selectedUser = interaction.options.getUser('user');
    const target = selectedUser && !selectedUser.bot ? selectedUser : interaction.user;
    const stats = getUserStats(target.id, target.username);

    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle(`💰 Баланс: ${target.username}`)
      .setThumbnail(target.displayAvatarURL({ size: 128 }))
      .setDescription(`Монеты: **${stats.coins || 0}**`)
      .setFooter({ text: 'ServerCore • Balance' });

    await safeEdit(interaction, { embeds: [embed] });
  }
};
