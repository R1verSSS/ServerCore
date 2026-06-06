const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { buildUnlockedText } = require('../services/achievementService');
const { createTicket } = require('../services/ticketService');
const { getTicketTemplate } = require('../services/managementUxService');

const PRIORITY_CHOICES = [
  { name: 'Низкий', value: 'low' },
  { name: 'Обычный', value: 'normal' },
  { name: 'Высокий', value: 'high' },
  { name: 'Срочный', value: 'urgent' }
];

const TEMPLATE_CHOICES = [
  { name: '🛠️ Тех. проблема', value: 'tech' },
  { name: '🚨 Жалоба', value: 'complaint' },
  { name: '❓ Вопрос', value: 'question' },
  { name: '📨 Заявка', value: 'application' },
  { name: '🤝 Партнерство', value: 'partner' },
  { name: '📌 Другое', value: 'other' }
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Создать приватное обращение к администрации')
    .addStringOption(option =>
      option
        .setName('шаблон')
        .setDescription('Тип обращения')
        .setRequired(false)
        .addChoices(...TEMPLATE_CHOICES)
    )
    .addStringOption(option =>
      option
        .setName('приоритет')
        .setDescription('Насколько срочное обращение')
        .setRequired(false)
        .addChoices(...PRIORITY_CHOICES)
    )
    .addStringOption(option =>
      option
        .setName('причина')
        .setDescription('Кратко опиши причину обращения')
        .setRequired(false)
        .setMaxLength(200)
    ),

  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });

    const templateId = interaction.options.getString('шаблон') || 'other';
    const template = getTicketTemplate(templateId);
    const priority = interaction.options.getString('приоритет') || 'normal';
    const reasonText = interaction.options.getString('причина') || template?.prompt || 'Не указана';
    const reason = `${template?.emoji || '🎫'} ${template?.label || 'Другое'}: ${reasonText}`.slice(0, 240);
    const result = await createTicket(interaction, reason, { templateId, priority });

    if (!result.ok && result.reason === 'already_open') {
      const channelText = result.channel ? `${result.channel}` : 'старый канал не найден';
      const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('⚠️ У тебя уже есть открытый тикет')
        .setDescription(`Сначала закрой существующее обращение: ${channelText}`)
        .setFooter({ text: 'ServerCore • Ticket System' });

      await safeEdit(interaction, { embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Тикет создан')
      .setDescription([
        `Твой приватный канал обращения: ${result.channel}`,
        template?.prompt ? `\n**Шаблон:** ${template.emoji} ${template.label}\n${template.prompt}` : null,
        result.unlockedAchievements?.length ? `\n🏅 **Новые достижения:**\n${buildUnlockedText(result.unlockedAchievements)}` : null
      ].filter(Boolean).join('\n'))
      .addFields({ name: 'Причина', value: result.ticket.reason, inline: false })
      .setFooter({ text: 'ServerCore • Ticket System' });

    embed.addFields({ name: 'Приоритет', value: result.ticket.priority || 'normal', inline: true });
    await safeEdit(interaction, { embeds: [embed] });
  },
};
