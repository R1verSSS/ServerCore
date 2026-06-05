const { PermissionFlagsBits } = require('discord.js');
const { addAudit } = require('./auditService');
const { CHANNELS } = require('../config/serverConfig');

const DEFAULT_PROTECTED_CHANNELS = [
  CHANNELS.rules,
  CHANNELS.announcements,
  CHANNELS.navigation,
  CHANNELS.roles,
  CHANNELS.commands,
  CHANNELS.botCommands,
  CHANNELS.shopFront,
  CHANNELS.inventory,
  CHANNELS.gifts,
  CHANNELS.premium,
  CHANNELS.moderationCommands,
  CHANNELS.moderationPanel,
  CHANNELS.miniGames,
].filter(Boolean);

function getProtectedNames() {
  const fromEnv = String(process.env.PROTECTED_TEXT_CHANNELS || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_PROTECTED_CHANNELS, ...fromEnv]);
}

function canBypass(message) {
  if (!message.member) return false;
  return message.member.permissions?.has(PermissionFlagsBits.ManageMessages)
    || message.member.permissions?.has(PermissionFlagsBits.ManageGuild)
    || message.member.permissions?.has(PermissionFlagsBits.Administrator);
}

function isProtectedChannel(channel) {
  if (!channel?.name || !channel?.isTextBased?.()) return false;
  return getProtectedNames().has(channel.name);
}

async function handleProtectedChannelMessage(message) {
  if (!message.guild || message.author.bot) return false;
  if (!isProtectedChannel(message.channel)) return false;
  if (canBypass(message)) return false;

  try {
    const channelName = message.channel.name;
    await addAudit('protected_message_deleted', message.author, {
      guildId: message.guildId,
      channelId: message.channelId,
      channelName,
      contentPreview: (message.content || '').slice(0, 160),
    });

    await message.delete().catch(() => null);

    const warning = await message.channel.send({
      content: `🧹 <@${message.author.id}>, этот канал предназначен для панели/информации. Обычные сообщения здесь удаляются автоматически. Для общения используй общий чат или подходящий тематический канал.`
    }).catch(() => null);

    if (warning) {
      setTimeout(() => warning.delete().catch(() => null), 9000);
    }
  } catch (error) {
    console.error('Protected channel cleanup error:', error);
  }

  return true;
}

module.exports = {
  DEFAULT_PROTECTED_CHANNELS,
  getProtectedNames,
  isProtectedChannel,
  handleProtectedChannelMessage,
};
