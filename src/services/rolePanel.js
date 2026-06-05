const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { selfAssignableRoles } = require('../config/template');
const { safeDefer } = require('../utils/safeInteraction');

function buildRolePanel() {
  const description = selfAssignableRoles
    .map(role => `${role.emoji} **${role.label}** — ${role.description}`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('✅ Выбор ролей')
    .setDescription(`${description}\n\nНажми на кнопку, чтобы получить или снять роль.`)
    .setFooter({ text: 'ServerCore • Role Panel' });

  const row = new ActionRowBuilder();
  for (const role of selfAssignableRoles) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`role:toggle:${role.roleName}`)
        .setLabel(role.label)
        .setEmoji(role.emoji)
        .setStyle(ButtonStyle.Secondary)
    );
  }

  return { embeds: [embed], components: [row] };
}

async function handleRoleButton(interaction) {
  const deferred = await safeDefer(interaction, true);
  if (!deferred) return;

  const roleName = interaction.customId.replace('role:toggle:', '');
  const role = interaction.guild.roles.cache.find(item => item.name === roleName);

  if (!role) {
    await interaction.editReply({ content: `Роль **${roleName}** не найдена на сервере.` });
    return;
  }

  const member = interaction.member;
  const hasRole = member.roles.cache.has(role.id);

  if (hasRole) {
    await member.roles.remove(role);
    await interaction.editReply({ content: `✅ Роль ${role} снята.` });
  } else {
    await member.roles.add(role);
    await interaction.editReply({ content: `✅ Роль ${role} выдана.` });
  }
}

module.exports = { buildRolePanel, handleRoleButton };
