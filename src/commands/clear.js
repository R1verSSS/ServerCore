const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { safeDefer, safeEdit, isDiscordNetworkTimeout, logSoftDiscordNetworkError } = require('../utils/safeInteraction');
const { sendModerationLog, createLogEmbed } = require('../services/moderationService');
const { confirmationEmbed, success, error } = require('../services/responseService');

async function performClear(interaction, amount) {
  if (!interaction.channel || !interaction.channel.bulkDelete) {
    await safeEdit(interaction, error('Нельзя очистить канал', 'В этом канале нельзя массово удалять сообщения.'));
    return;
  }

  try {
    const deleted = await interaction.channel.bulkDelete(amount, true);
    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('🧹 Сообщения удалены')
      .setDescription(`Удалено сообщений: **${deleted.size}**.`)
      .addFields({ name: 'Канал', value: `<#${interaction.channel.id}>`, inline: true })
      .setFooter({ text: 'ServerCore • Moderation' });

    await safeEdit(interaction, { embeds: [embed], components: [] });

    await sendModerationLog(interaction.guild, {
      embeds: [createLogEmbed({
        title: '🧹 Очистка сообщений',
        color: 0x57F287,
        moderator: interaction.user,
        target: interaction.user,
        reason: `Канал: ${interaction.channel.name}`,
        fields: [{ name: 'Удалено сообщений', value: `${deleted.size}`, inline: true }],
      })],
    }).catch(error => {
      if (isDiscordNetworkTimeout(error)) {
        logSoftDiscordNetworkError('clear moderation log', error);
        return;
      }
      console.error('Could not send clear moderation log:', error);
    });
  } catch (err) {
    if (isDiscordNetworkTimeout(err)) {
      logSoftDiscordNetworkError('clear bulkDelete', err);
      await safeEdit(interaction, error(
        'Discord не ответил вовремя',
        'Запрос на очистку был отправлен, но Discord API не вернул ответ за отведенное время. Проверь канал: иногда сообщения удаляются через несколько секунд. Если нет — повтори команду позже или включи системный VPN для Node.js.'
      ));
      return;
    }
    console.error('Clear command error:', err);
    await safeEdit(interaction, error('Не удалось удалить сообщения', 'Проверь права бота `Manage Messages`. Также Discord не удаляет через bulk delete сообщения старше 14 дней.'));
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Удалить несколько сообщений в текущем канале')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(option => option.setName('amount').setDescription('Количество сообщений от 1 до 100').setRequired(true).setMinValue(1).setMaxValue(100))
    .addBooleanOption(option => option.setName('confirm').setDescription('Подтвердить сразу, если сообщений больше 20').setRequired(false)),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const amount = interaction.options.getInteger('amount');
    const confirm = interaction.options.getBoolean('confirm') || false;

    if (amount > 20 && !confirm) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`clear:confirm:${interaction.channel.id}:${amount}`).setLabel(`Удалить ${amount}`).setEmoji('🧹').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('clear:cancel').setLabel('Отмена').setEmoji('✖️').setStyle(ButtonStyle.Secondary)
      );
      await safeEdit(interaction, { embeds: [confirmationEmbed('Подтверждение очистки', `Ты собираешься удалить до **${amount}** сообщений в канале <#${interaction.channel.id}>. Это действие нельзя отменить.`, true)], components: [row] });
      return;
    }

    await performClear(interaction, amount);
  },

  performClear,
};
