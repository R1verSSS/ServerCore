const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { closeTicket } = require('../services/ticketService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('close')
    .setDescription('Закрыть текущий тикет'),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });

    const result = await closeTicket(interaction);

    if (!result.ok) {
      let description = 'Этот канал не является открытым тикетом.';

      if (result.reason === 'no_permission') {
        description = 'Закрыть тикет может его автор, администратор или модератор.';
      }

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('❌ Не удалось закрыть тикет')
        .setDescription(description)
        .setFooter({ text: 'ServerCore • Ticket System' });

      await safeEdit(interaction, { embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('🔒 Тикет закрыт')
      .setDescription('Канал будет удален через 5 секунд.')
      .setFooter({ text: 'ServerCore • Ticket System' });

    await safeEdit(interaction, { embeds: [embed] });

    setTimeout(async () => {
      try {
        await interaction.channel.delete(`Ticket closed by ${interaction.user.tag}`);
      } catch (error) {
        console.error('Could not delete ticket channel:', error);
      }
    }, 5000);
  },
};
