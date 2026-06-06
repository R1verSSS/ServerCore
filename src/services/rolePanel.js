const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const { selfAssignableRoles } = require('../config/template');
const { safeDefer } = require('../utils/safeInteraction');
const { rememberUserAction } = require('./uxFlowService');
const { awardAchievement } = require('./achievementService');

function buildRolePanel() {
  const description = selfAssignableRoles
    .map(role => `${role.emoji} **${role.label}** — ${role.description}`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('✅ Выбор ролей')
    .setDescription(`${description}\n\nВыбери одну или несколько ролей в меню. Повторный выбор снимает уже выданную роль.`)
    .addFields({ name: 'Подсказка', value: 'Select-menu удобнее кнопок: можно выбрать несколько интересов за одно действие.', inline: false })
    .setFooter({ text: 'ServerCore • Role Select Menu' });

  const select = new StringSelectMenuBuilder()
    .setCustomId('role:select')
    .setPlaceholder('Выбери роли по интересам')
    .setMinValues(1)
    .setMaxValues(Math.min(selfAssignableRoles.length, 25))
    .addOptions(selfAssignableRoles.slice(0, 25).map(role => ({
      label: role.label,
      value: role.roleName,
      emoji: role.emoji,
      description: role.description?.slice(0, 90) || role.roleName,
    })));

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ux:center').setLabel('Мой центр').setEmoji('🧭').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select), buttons] };
}

async function toggleRole(interaction, roleName) {
  const role = interaction.guild.roles.cache.find(item => item.name === roleName);
  if (!role) return { ok: false, text: `❌ Роль **${roleName}** не найдена.` };
  const member = interaction.member;
  const hasRole = member.roles.cache.has(role.id);
  if (hasRole) {
    await member.roles.remove(role);
    return { ok: true, text: `➖ Роль ${role} снята.` };
  }
  await member.roles.add(role);
  return { ok: true, text: `➕ Роль ${role} выдана.` };
}

async function handleRoleButton(interaction) {
  const deferred = await safeDefer(interaction, true);
  if (!deferred) return;
  const roleName = interaction.customId.replace('role:toggle:', '');
  const result = await toggleRole(interaction, roleName);
  rememberUserAction(interaction.user.id, 'role_toggle', { roleName, ok: result.ok });
  await interaction.editReply({ content: result.text });
}

async function handleRoleSelect(interaction) {
  const deferred = await safeDefer(interaction, true);
  if (!deferred) return;
  const results = [];
  for (const roleName of interaction.values || []) {
    const result = await toggleRole(interaction, roleName);
    results.push(result.text);
  }
  rememberUserAction(interaction.user.id, 'role_select', { roles: interaction.values || [] });
  awardAchievement(interaction.user.id, interaction.user.username, 'first_role_select');
  await interaction.editReply({ content: `${results.join('\n')}\n\n🧭 Что дальше: открой **Мой центр**, чтобы увидеть свой прогресс и подсказки.` });
}

module.exports = { buildRolePanel, handleRoleButton, handleRoleSelect };
