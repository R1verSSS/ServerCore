const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags, ChannelType } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getNotificationSettings, updateNotificationSettings, runNotificationChecks } = require('../services/notificationService');

function yesNo(value) { return value ? '✅ включено' : '❌ выключено'; }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('notify')
    .setDescription('Настройки уведомлений сервера')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand => subcommand
      .setName('status')
      .setDescription('Показать настройки уведомлений'))
    .addSubcommand(subcommand => subcommand
      .setName('set')
      .setDescription('Включить или выключить тип уведомлений')
      .addStringOption(option => option.setName('type').setDescription('Тип уведомлений').setRequired(true).addChoices(
        { name: 'daily — напоминания о daily', value: 'daily' },
        { name: 'events — напоминания об ивентах', value: 'events' },
        { name: 'tournaments — уведомления о турнирах', value: 'tournaments' },
        { name: 'season — уведомления о сезоне', value: 'season' },
        { name: 'tickets — уведомления о тикетах без ответа', value: 'tickets' }
      ))
      .addBooleanOption(option => option.setName('enabled').setDescription('Включить?').setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('channel')
      .setDescription('Указать канал для системных уведомлений')
      .addChannelOption(option => option.setName('channel').setDescription('Текстовый канал').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('test')
      .setDescription('Запустить проверку уведомлений вручную')),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();

    if (sub === 'status') {
      const settings = getNotificationSettings();
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🔔 Настройки уведомлений')
        .addFields(
          { name: 'Канал уведомлений', value: settings.channelId ? `<#${settings.channelId}>` : 'не указан, используется 📢・объявления или 🛡・лог-модерации', inline: false },
          { name: 'Daily', value: yesNo(settings.daily), inline: true },
          { name: 'Ивенты', value: yesNo(settings.events), inline: true },
          { name: 'Турниры', value: yesNo(settings.tournaments), inline: true },
          { name: 'Сезон', value: yesNo(settings.season), inline: true },
          { name: 'Тикеты', value: yesNo(settings.tickets), inline: true }
        );
      await safeEdit(interaction, { embeds: [embed] });
      return;
    }

    if (sub === 'set') {
      const type = interaction.options.getString('type', true);
      const enabled = interaction.options.getBoolean('enabled', true);
      const settings = updateNotificationSettings({ [type]: enabled });
      await safeEdit(interaction, { content: `✅ Уведомления **${type}**: ${yesNo(settings[type])}.` });
      return;
    }

    if (sub === 'channel') {
      const channel = interaction.options.getChannel('channel', true);
      updateNotificationSettings({ channelId: channel.id });
      await safeEdit(interaction, { content: `✅ Канал уведомлений установлен: ${channel}.` });
      return;
    }

    if (sub === 'test') {
      await runNotificationChecks(interaction.client);
      await safeEdit(interaction, { content: '✅ Проверка уведомлений выполнена.' });
    }
  }
};
