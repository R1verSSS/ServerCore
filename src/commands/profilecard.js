const { SlashCommandBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getOrCreateUser } = require('../services/dataStore');
const { createProfileCardPng } = require('../services/profileCardService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profilecard')
    .setDescription('Профиль в виде PNG-карточки'),
  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const user = getOrCreateUser(interaction.user.id, interaction.user.username);
    const buffer = createProfileCardPng(user);
    const file = new AttachmentBuilder(buffer, { name: 'profile-card.png' });
    return safeEdit(interaction, { content: '🖼 Карточка профиля:', files: [file] });
  }
};
