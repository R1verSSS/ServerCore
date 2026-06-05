const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder, MessageFlags } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const { readDatabase } = require('../services/dataStore');

module.exports = {
  data: new ContextMenuCommandBuilder().setName('История модерации').setType(ApplicationCommandType.User),
  async execute(interaction) {
    await safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    const target = interaction.targetUser;
    const db = readDatabase();
    const warnings = (db.warnings || []).filter(w => String(w.userId) === target.id && w.active !== false).slice(-5);
    const cases = (db.moderationCases || []).filter(c => String(c.userId || c.targetId) === target.id).slice(-5);
    const text = [
      warnings.length ? `**Активные предупреждения:**\n${warnings.map(w => `#${w.id} — ${w.reason || 'Без причины'}`).join('\n')}` : '**Активные предупреждения:** нет',
      cases.length ? `**Последние дела:**\n${cases.map(c => `#${c.id} — ${c.type || c.action || 'case'} — ${c.reason || 'Без причины'}`).join('\n')}` : '**Последние дела:** нет'
    ].join('\n\n');
    const embed = new EmbedBuilder().setColor(0xED4245).setTitle(`🛡 История модерации ${target.username}`).setDescription(text.slice(0, 4000));
    await safeEdit(interaction, { embeds: [embed], components: [] });
  }
};
