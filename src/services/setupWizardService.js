const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { buildHealthReport } = require('./healthCheckService');

function findChannel(guild, name, type = ChannelType.GuildText) {
  return guild?.channels.cache.find(ch => ch.name === name && ch.type === type) || null;
}

async function buildSetupWizardPayload(client, guild) {
  const report = await buildHealthReport(client, guild);
  const botMember = guild ? await guild.members.fetchMe().catch(() => null) : null;
  const rows = [
    ['Канал логов', findChannel(guild, '📋・лог-модерации'), 'Нужен для логов модерации и системных событий.'],
    ['Канал ивентов', findChannel(guild, '📅・ивенты'), 'Нужен для публикации карточек ивентов.'],
    ['Канал мини-игр', findChannel(guild, '🎲・мини-игры'), 'Нужен для панели мини-игр.'],
    ['Канал заявок', findChannel(guild, '📥・заявки'), 'Нужен для заявок и форм.'],
    ['Voice-триггер', findChannel(guild, '➕・создать-комнату', ChannelType.GuildVoice), 'Создается через /voice setup.'],
    ['Manage Channels', botMember?.permissions.has(PermissionFlagsBits.ManageChannels), 'Нужно для тикетов, LFG и voice-комнат.'],
    ['Manage Messages', botMember?.permissions.has(PermissionFlagsBits.ManageMessages), 'Нужно для /clear и AutoMod.'],
    ['Moderate Members', botMember?.permissions.has(PermissionFlagsBits.ModerateMembers), 'Нужно для /mute.'],
  ];
  const checklist = rows.map(([name, ok, hint]) => `${ok ? '✅' : '⚠️'} **${name}** — ${ok ? 'готово' : hint}`).join('\n');
  const embed = new EmbedBuilder()
    .setColor(report.okCount === report.total ? 0x57F287 : 0xFEE75C)
    .setTitle('🧭 Мастер настройки ServerCore')
    .setDescription(`${checklist}\n\n**Health:** ${report.okCount}/${report.total}. Если есть предупреждения, открой веб-панель \`/health\`.`)
    .addFields(
      { name: 'Что делать дальше', value: '1. Исправь предупреждения\n2. Запусти `npm run setup` при необходимости\n3. Проверь `/dbstatus` и веб-страницу `/health`' },
      { name: 'Intents', value: 'Для AutoMod нужен **Message Content Intent**, для приветствия — **Server Members Intent** в Developer Portal.' }
    )
    .setFooter({ text: 'ServerCore • Setup Wizard' })
    .setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('menu:quick:health').setLabel('Health').setEmoji('🩺').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('menu:quick:docs').setLabel('Документация').setEmoji('📚').setStyle(ButtonStyle.Secondary)
  );
  return { embeds: [embed], components: [row] };
}

module.exports = { buildSetupWizardPayload };
