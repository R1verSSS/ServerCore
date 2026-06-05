const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getOrCreateUser } = require('../services/dataStore');
const { getProfile, updateProfile, resetProfile, PROFILE_COLORS, PROFILE_BACKGROUNDS, hasCosmeticAccess } = require('../services/profileCustomizationService');

function profileEmbed(user, profile) {
  const color = PROFILE_COLORS[profile.color] || PROFILE_COLORS.blurple;
  const bg = PROFILE_BACKGROUNDS[profile.background] || PROFILE_BACKGROUNDS.dark;
  return new EmbedBuilder()
    .setColor(color.hex)
    .setTitle(`🎨 Настройка профиля: ${user.username}`)
    .setDescription(profile.about)
    .addFields(
      { name: 'Титул', value: profile.title, inline: true },
      { name: 'Цвет', value: `${color.emoji} ${color.name}`, inline: true },
      { name: 'Фон карточки', value: `${bg.emoji} ${bg.name}`, inline: true },
      { name: 'Главный бейдж', value: profile.mainBadge || 'Не выбран', inline: true },
      { name: 'Бейджи в профиле', value: profile.showBadges ? 'Показывать' : 'Скрывать', inline: true },
      { name: 'Статистика', value: profile.showStats ? 'Показывать' : 'Скрывать', inline: true }
    )
    .setFooter({ text: 'ServerCore • Profile Customization' });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profilecustomize')
    .setDescription('Настроить внешний вид профиля и карточки')
    .addSubcommand(sub => sub.setName('view').setDescription('Показать текущие настройки профиля'))
    .addSubcommand(sub => sub.setName('title').setDescription('Изменить титул профиля').addStringOption(opt => opt.setName('text').setDescription('Титул до 48 символов').setRequired(true).setMaxLength(48)))
    .addSubcommand(sub => sub.setName('about').setDescription('Изменить описание профиля').addStringOption(opt => opt.setName('text').setDescription('Описание до 180 символов').setRequired(true).setMaxLength(180)))
    .addSubcommand(sub => sub.setName('color').setDescription('Выбрать цвет профиля').addStringOption(opt => opt.setName('value').setDescription('Цвет').setRequired(true).addChoices(
      { name: '🔵 Discord Blurple', value: 'blurple' },
      { name: '🟢 Green', value: 'green' },
      { name: '🟡 Gold', value: 'gold' },
      { name: '🔴 Red', value: 'red' },
      { name: '🟣 Purple', value: 'purple' },
      { name: '💠 Cyan', value: 'cyan' }
    )))
    .addSubcommand(sub => sub.setName('background').setDescription('Выбрать фон PNG-карточки').addStringOption(opt => opt.setName('value').setDescription('Фон').setRequired(true).addChoices(
      { name: '🌑 Dark Core', value: 'dark' },
      { name: '🌌 Neon Grid', value: 'neon' },
      { name: '🌲 Forest', value: 'forest' },
      { name: '🌅 Sunset', value: 'sunset' },
      { name: '🌊 Ocean', value: 'ocean' }
    )))
    .addSubcommand(sub => sub.setName('badge').setDescription('Выбрать главный бейдж').addStringOption(opt => opt.setName('emoji').setDescription('Эмодзи бейджа, например 🎮').setRequired(true).setMaxLength(8)))
    .addSubcommand(sub => sub.setName('visibility').setDescription('Настроить отображение блоков').addBooleanOption(opt => opt.setName('badges').setDescription('Показывать бейджи')).addBooleanOption(opt => opt.setName('stats').setDescription('Показывать статистику')))
    .addSubcommand(sub => sub.setName('reset').setDescription('Сбросить оформление профиля')),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();
    const user = getOrCreateUser(interaction.user.id, interaction.user.username);

    if (sub === 'view') {
      const profile = getProfile(interaction.user.id, interaction.user.username);
      return safeEdit(interaction, { embeds: [profileEmbed(user, profile)] });
    }

    if (sub === 'reset') {
      const profile = resetProfile(interaction.user.id, interaction.user.username);
      return safeEdit(interaction, { content: '✅ Оформление профиля сброшено.', embeds: [profileEmbed(user, profile)] });
    }

    let patch = {};
    if (sub === 'title') patch.title = interaction.options.getString('text');
    if (sub === 'about') patch.about = interaction.options.getString('text');
    if (sub === 'color') {
      const value = interaction.options.getString('value');
      if (!hasCosmeticAccess(user, 'color', value)) return safeEdit(interaction, { content: '🔒 Этот цвет нужно купить в /shop или добавить через веб-панель.' });
      patch.color = value;
    }
    if (sub === 'background') {
      const value = interaction.options.getString('value');
      if (!hasCosmeticAccess(user, 'background', value)) return safeEdit(interaction, { content: '🔒 Этот фон нужно купить в /shop или добавить через веб-панель.' });
      patch.background = value;
    }
    if (sub === 'badge') {
      const badge = interaction.options.getString('emoji');
      const badges = Array.isArray(user.badges) ? user.badges : [];
      if (!badges.includes(badge)) return safeEdit(interaction, { content: '🔒 У тебя нет такого бейджа. Посмотри доступные бейджи через /badges.' });
      patch.mainBadge = badge;
    }
    if (sub === 'visibility') {
      const badges = interaction.options.getBoolean('badges');
      const stats = interaction.options.getBoolean('stats');
      if (badges !== null) patch.showBadges = badges;
      if (stats !== null) patch.showStats = stats;
    }

    const profile = updateProfile(interaction.user.id, interaction.user.username, patch);
    return safeEdit(interaction, { content: '✅ Профиль обновлен.', embeds: [profileEmbed(user, profile)] });
  }
};
