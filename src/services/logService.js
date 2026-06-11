const { ChannelType, EmbedBuilder } = require('discord.js');
const { getSettings } = require('./settingsService');

function findTextChannelByName(guild, name) {
  return guild?.channels.cache.find(channel => channel.type === ChannelType.GuildText && channel.name === name) || null;
}

function normalizeFields(fields = []) {
  return (fields || [])
    .filter(Boolean)
    .slice(0, 12)
    .map(field => ({ name: String(field.name || '-').slice(0, 256), value: String(field.value ?? '-').slice(0, 1024), inline: Boolean(field.inline) }));
}

function buildLogEmbed({ title, description, color = 0x5865F2, actor = null, target = null, fields = [], footer = 'ServerCore • Logs' }) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title || '📌 Лог действия')
    .setDescription(description || '-')
    .setTimestamp()
    .setFooter({ text: footer });

  const extra = [];
  if (actor) extra.push({ name: 'Исполнитель', value: typeof actor === 'string' ? actor : `${actor.tag || actor.username || actor.id} (${actor.id})`, inline: true });
  if (target) extra.push({ name: 'Цель', value: typeof target === 'string' ? target : `${target.tag || target.username || target.id} (${target.id})`, inline: true });
  const allFields = [...extra, ...normalizeFields(fields)];
  if (allFields.length) embed.addFields(allFields);
  return embed;
}

async function sendLog(guild, titleOrOptions, description, color = 0x5865F2) {
  try {
    const settings = getSettings();
    const channel = findTextChannelByName(guild, settings.logChannelName || '🛡・лог-модерации');
    if (!channel) return false;

    const embed = typeof titleOrOptions === 'object'
      ? buildLogEmbed(titleOrOptions)
      : buildLogEmbed({ title: titleOrOptions, description, color });

    await channel.send({ embeds: [embed] });
    return true;
  } catch (error) {
    console.error('sendLog error:', error);
    return false;
  }
}

async function logToModeration(guild, title, description, color = 0x5865F2, fields = []) {
  if (typeof title === 'object') return sendLog(guild, title);
  return sendLog(guild, { title, description, color, fields });
}

module.exports = { sendLog, logToModeration, findTextChannelByName, buildLogEmbed };
