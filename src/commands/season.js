const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getSeason, startSeason, stopSeason, seasonTop, getRemainingText } = require('../services/seasonService');
const { getSeasonProgress } = require('../services/battlePassService');
const { getUserStats } = require('../services/xpService');

module.exports = {
  data: new SlashCommandBuilder().setName('season').setDescription('Сезоны активности')
    .addSubcommand(s => s.setName('info').setDescription('Информация о сезоне'))
    .addSubcommand(s => s.setName('top').setDescription('Сезонный топ'))
    .addSubcommand(s => s.setName('start').setDescription('Начать сезон').addStringOption(o => o.setName('name').setDescription('Название').setRequired(true)).addIntegerOption(o => o.setName('days').setDescription('Дней').setMinValue(1).setMaxValue(365)))
    .addSubcommand(s => s.setName('stop').setDescription('Остановить сезон')),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) return safeEdit(interaction, { content: '❌ Только администратор.' });
      const s = startSeason(interaction.options.getString('name'), interaction.options.getInteger('days') || 30);
      return safeEdit(interaction, { content: `✅ Сезон **${s.name}** запущен до **${new Date(s.endsAt).toLocaleString('ru-RU')}**. Сезонный XP и новая ветка Battle Pass готовы.` });
    }

    if (sub === 'stop') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) return safeEdit(interaction, { content: '❌ Только администратор.' });
      const s = stopSeason();
      return safeEdit(interaction, { content: `✅ Сезон **${s.name}** остановлен.` });
    }

    if (sub === 'top') {
      const text = seasonTop(10).map((u, i) => {
        const progress = getSeasonProgress(u.seasonXp || 0);
        return `**${i + 1}.** ${u.username} — ${u.seasonXp || 0} XP, уровень BP ${progress.level}`;
      }).join('\n') || 'Данных нет.';
      return safeEdit(interaction, { embeds: [new EmbedBuilder().setColor(0xFEE75C).setTitle('🏆 Сезонный топ').setDescription(text)] });
    }

    const s = getSeason();
    const user = getUserStats(interaction.user.id, interaction.user.username);
    const progress = getSeasonProgress(user.seasonXp || 0);
    const embed = new EmbedBuilder()
      .setColor(s.active ? 0x57F287 : 0xFEE75C)
      .setTitle(`🌟 ${s.name}`)
      .setDescription(`Статус: **${s.active ? 'активен' : 'выключен'}**\nОкончание: **${s.endsAt ? new Date(s.endsAt).toLocaleString('ru-RU') : '-'}**\nОсталось: **${getRemainingText(s.endsAt)}**`)
      .addFields(
        { name: 'Твой сезонный XP', value: String(user.seasonXp || 0), inline: true },
        { name: 'Уровень Battle Pass', value: String(progress.level), inline: true },
        { name: 'До следующего уровня', value: `${Math.max(progress.required - progress.current, 0)} XP`, inline: true }
      )
      .setFooter({ text: 'Используй /battlepass для наград сезона' });
    return safeEdit(interaction, { embeds: [embed] });
  }
};
