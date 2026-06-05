const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { getMaintenance, setMaintenance } = require('../services/maintenanceService');
const { addAudit } = require('../services/auditService');

function payload(state) {
  const embed = new EmbedBuilder()
    .setColor(state.enabled ? 0xFEE75C : 0x57F287)
    .setTitle(state.enabled ? '🛠 Режим обслуживания включен' : '✅ Режим обслуживания выключен')
    .setDescription(state.enabled ? state.reason : 'Пользовательские команды снова доступны.')
    .addFields(
      { name: 'Последнее изменение', value: state.updatedAt ? `<t:${Math.floor(new Date(state.updatedAt).getTime() / 1000)}:F>` : '—', inline: true },
      { name: 'Кем', value: state.updatedBy || '—', inline: true }
    );
  return { embeds: [embed], components: [] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('maintenance')
    .setDescription('Включить или выключить режим обслуживания')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub.setName('status').setDescription('Показать статус обслуживания'))
    .addSubcommand(sub => sub.setName('on').setDescription('Включить обслуживание').addStringOption(opt => opt.setName('reason').setDescription('Причина').setRequired(false)))
    .addSubcommand(sub => sub.setName('off').setDescription('Выключить обслуживание')),
  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();
    let state = getMaintenance();
    if (sub === 'on') {
      state = setMaintenance(true, interaction.options.getString('reason') || 'Проводятся технические работы.', interaction.user);
      addAudit('maintenance_on', interaction.user, { reason: state.reason });
    } else if (sub === 'off') {
      state = setMaintenance(false, '', interaction.user);
      addAudit('maintenance_off', interaction.user, {});
    }
    await safeEdit(interaction, payload(state));
  }
};
