const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getOrCreateUser } = require('../services/dataStore');

function buildMePayload(discordUser, profile) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`👤 Центр участника: ${discordUser.username}`)
    .setDescription('Здесь собраны основные действия пользователя. Нажми кнопку, чтобы получить краткую подсказку по нужному разделу.')
    .setThumbnail(discordUser.displayAvatarURL?.() || null)
    .addFields(
      { name: 'Уровень', value: String(profile.level || 1), inline: true },
      { name: 'XP', value: String(profile.xp || 0), inline: true },
      { name: 'Монеты', value: String(profile.coins || 0), inline: true },
      { name: 'Репутация', value: String(profile.reputation || 0), inline: true },
      { name: 'Battle Pass XP', value: String(profile.seasonXp || 0), inline: true },
      { name: 'Инвентарь', value: `${Array.isArray(profile.inventory) ? profile.inventory.length : 0} предметов`, inline: true },
    )
    .setFooter({ text: 'ServerCore • Личный центр' })
    .setTimestamp();
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('me:profile').setLabel('Профиль').setEmoji('👤').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('me:economy').setLabel('Экономика').setEmoji('💰').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('me:inventory').setLabel('Инвентарь').setEmoji('🎒').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('me:battlepass').setLabel('Battle Pass').setEmoji('🎟').setStyle(ButtonStyle.Secondary)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('me:achievements').setLabel('Достижения').setEmoji('🏆').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('me:voice').setLabel('Voice').setEmoji('🔊').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('me:support').setLabel('Поддержка').setEmoji('🎫').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('me:help').setLabel('Помощь').setEmoji('📚').setStyle(ButtonStyle.Secondary)
  );
  return { embeds: [embed], components: [row1, row2] };
}

function buildMeHint(kind) {
  const map = {
    profile: ['👤 Профиль', '`/profile`, `/rank`, `/profilecard`, `/profilecustomize view`'],
    economy: ['💰 Экономика', '`/daily`, `/balance`, `/shop`, `/buy`, `/gift coins`'],
    inventory: ['🎒 Инвентарь', '`/inventory`, `/use`, `/cosmetics`'],
    battlepass: ['🎟 Battle Pass', '`/season info`, `/battlepass info`, `/battlepass rewards`, `/battlepass claim`'],
    achievements: ['🏆 Достижения', '`/achievements`, `/badges`, `/top`'],
    voice: ['🔊 Voice', 'Зайди в `➕・создать-комнату` или используй `/voice panel`.'],
    support: ['🎫 Поддержка', '`/ticket`, `/apply form`, `/suggest`, `/poll create`'],
    help: ['📚 Помощь', '`/help` откроет интерактивную справку по разделам.'],
  };
  const [title, text] = map[kind] || map.help;
  const embed = new EmbedBuilder().setColor(0x5865F2).setTitle(title).setDescription(text).setFooter({ text: 'ServerCore • /me' });
  return { embeds: [embed], components: [] };
}

module.exports = {
  data: new SlashCommandBuilder().setName('me').setDescription('Открыть личный центр участника'),
  buildMePayload,
  buildMeHint,
  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const profile = getOrCreateUser(interaction.user.id, interaction.user.username);
    await safeEdit(interaction, buildMePayload(interaction.user, profile));
  }
};
