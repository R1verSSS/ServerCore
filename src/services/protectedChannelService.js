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

function getEffectiveRule(channelName) {
  try {
    // lazy require avoids circular init with channelRulesService default list
    const { getRuleForChannel } = require('./channelRulesService');
    return getRuleForChannel(channelName);
  } catch (_) {
    return { mode: getProtectedNames().has(channelName) ? 'panel_only' : 'free', deleteMessages: getProtectedNames().has(channelName), allowLinks: true, allowAttachments: true, warnUser: true };
  }
}

function isProtectedChannel(channel) {
  if (!channel?.name || !channel?.isTextBased?.()) return false;
  const rule = getEffectiveRule(channel.name);
  return rule.deleteMessages === true || getProtectedNames().has(channel.name);
}

async function handleProtectedChannelMessage(message) {
  if (!message.guild || message.author.bot) return false;
  const rule = getEffectiveRule(message.channel.name);
  if (!isProtectedChannel(message.channel)) return false;
  if (canBypass(message)) return false;
  if (rule.mode === 'music_only') {
    const { isMusicAllowedMessage } = require('./channelRulesService');
    if (isMusicAllowedMessage(message.content || '')) return false;
  }
  if (rule.allowLinks === false && /https?:\/\//i.test(message.content || '')) {
    // delete by same handler below
  }

  try {
    const channelName = message.channel.name;
    await addAudit('protected_message_deleted', message.author, {
      guildId: message.guildId,
      channelId: message.channelId,
      channelName,
      contentPreview: (message.content || '').slice(0, 160),
      ruleMode: rule.mode,
    });

    await message.delete().catch(() => null);

    const warning = rule.warnUser ? await message.channel.send({
      content: `🧹 <@${message.author.id}>, этот канал работает в режиме **${rule.mode}**. Обычные сообщения здесь удаляются автоматически. Для общения используй общий чат или подходящий тематический канал.`
    }).catch(() => null) : null;

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
  getEffectiveRule,
  isProtectedChannel,
  handleProtectedChannelMessage,
};
