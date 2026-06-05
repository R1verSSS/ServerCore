const {
  SlashCommandBuilder,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { createApplication, publishApplication, getApplicationType } = require('../services/applicationService');

const choices = [
  { name: 'Модератор', value: 'moderator' },
  { name: 'Партнерство', value: 'partner' },
  { name: 'Кастомная роль', value: 'custom_role' },
  { name: 'Турнир', value: 'tournament' },
  { name: 'Жалоба', value: 'complaint' },
  { name: 'Идея', value: 'idea' },
];

function buildApplyModal(type) {
  const cfg = getApplicationType(type);
  const modal = new ModalBuilder()
    .setCustomId(`application:modal:${type}`)
    .setTitle(cfg.label.slice(0, 45));

  for (const field of cfg.fields.slice(0, 5)) {
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(field.id)
        .setLabel(field.label.slice(0, 45))
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(Boolean(field.required))
        .setMaxLength(1000)
    ));
  }
  return modal;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('apply')
    .setDescription('Подать заявку через форму или быстрый текст')
    .addSubcommand(s => s
      .setName('form')
      .setDescription('Открыть форму заявки')
      .addStringOption(o => o.setName('type').setDescription('Тип заявки').setRequired(true).addChoices(...choices)))
    .addSubcommand(s => s
      .setName('quick')
      .setDescription('Быстро отправить заявку одним текстом')
      .addStringOption(o => o.setName('type').setDescription('Тип заявки').setRequired(true).addChoices(...choices))
      .addStringOption(o => o.setName('text').setDescription('Текст заявки').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const type = interaction.options.getString('type');

    if (sub === 'form') {
      return interaction.showModal(buildApplyModal(type));
    }

    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const app = createApplication(interaction.user.id, interaction.user.username, type, interaction.options.getString('text'));
    await publishApplication(interaction.guild, app).catch(console.error);
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('📨 Заявка отправлена')
      .setDescription(`Заявка **#${app.id}** создана и отправлена администрации.`);
    return safeEdit(interaction, { embeds: [embed] });
  },
};

module.exports.buildApplyModal = buildApplyModal;
