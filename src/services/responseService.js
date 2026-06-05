const { EmbedBuilder } = require('discord.js');

const COLORS = {
  success: 0x57F287,
  error: 0xED4245,
  warning: 0xFEE75C,
  info: 0x5865F2,
  neutral: 0x2B2D31,
};

function baseEmbed(type, title, description, fields = []) {
  const embed = new EmbedBuilder()
    .setColor(COLORS[type] || COLORS.info)
    .setTitle(title)
    .setDescription(description || '')
    .setTimestamp()
    .setFooter({ text: 'ServerCore' });
  if (fields.length) embed.addFields(fields);
  return embed;
}

function success(title, description, fields = []) { return { embeds: [baseEmbed('success', `✅ ${title}`, description, fields)], components: [] }; }
function error(title, description, fields = []) { return { embeds: [baseEmbed('error', `❌ ${title}`, description, fields)], components: [] }; }
function warning(title, description, fields = []) { return { embeds: [baseEmbed('warning', `⚠️ ${title}`, description, fields)], components: [] }; }
function info(title, description, fields = []) { return { embeds: [baseEmbed('info', `ℹ️ ${title}`, description, fields)], components: [] }; }

function permissionError(details = 'У тебя нет прав для выполнения этого действия.') {
  return error('Нет доступа', `${details}\n\nЕсли ты считаешь, что это ошибка, обратись к администрации сервера.`);
}

function botRoleError(roleName = 'нужная роль') {
  return error('Не хватает прав бота', `Я не могу управлять ролью **${roleName}**.\n\nПроверь: роль бота должна находиться **выше** управляемой роли в настройках Discord-сервера.`);
}

function missingChannelError(channelName) {
  return warning('Канал не найден', `Не найден канал **${channelName}**. Его можно создать через \`npm run setup\` или указать другое название в настройках.`);
}

function confirmationEmbed(title, description, danger = false) {
  return baseEmbed(danger ? 'warning' : 'info', `⚠️ ${title}`, `${description}\n\nПодтверди действие, только если уверен.`);
}

module.exports = {
  COLORS,
  baseEmbed,
  success,
  error,
  warning,
  info,
  permissionError,
  botRoleError,
  missingChannelError,
  confirmationEmbed,
};
