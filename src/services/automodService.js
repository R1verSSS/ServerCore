const { PermissionFlagsBits } = require('discord.js');
const { readDatabase, writeDatabase } = require('./dataStore');
const { getSettings } = require('./settingsService');
const { sendLog } = require('./logService');

const spamCache = new Map();

function containsLink(text) {
  return /(https?:\/\/|discord\.gg\/|www\.)/i.test(text || '');
}

function capsRatio(text) {
  const letters = (text || '').replace(/[^a-zа-яё]/gi, '');
  if (letters.length < 12) return 0;
  const caps = letters.replace(/[^A-ZА-ЯЁ]/g, '').length;
  return caps / letters.length;
}

function hasForbiddenWord(text, words) {
  const lower = String(text || '').toLowerCase();
  return (words || []).find(word => word && lower.includes(String(word).toLowerCase())) || null;
}

async function handleAutomodMessage(message) {
  if (!message.guild || message.author.bot) return { ok: true };
  const settings = getSettings();
  if (!settings.automodEnabled) return { ok: true };
  if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return { ok: true };

  const reasons = [];
  if (settings.automodBlockLinks && containsLink(message.content)) reasons.push('запрещенная ссылка');
  if (settings.automodAntiCaps && capsRatio(message.content) > 0.75) reasons.push('слишком много CAPS');
  if ((message.mentions.users.size || 0) >= Number(settings.automodMaxMentions || 6)) reasons.push('массовые упоминания');
  const forbiddenWord = hasForbiddenWord(message.content, settings.automodForbiddenWords || []);
  if (forbiddenWord) reasons.push(`запрещенное слово: ${forbiddenWord}`);

  if (settings.automodAntiSpam) {
    const key = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const recent = (spamCache.get(key) || []).filter(item => now - item.at < 10000);
    recent.push({ at: now, text: message.content });
    spamCache.set(key, recent);
    const sameCount = recent.filter(item => item.text === message.content).length;
    if (recent.length >= 7 || sameCount >= 4) reasons.push('спам сообщениями');
  }

  if (!reasons.length) return { ok: true };

  try { await message.delete(); } catch (_) {}

  const db = readDatabase();
  if (!db.automodLogs) db.automodLogs = [];
  db.automodLogs.push({
    id: db.automodLogs.length + 1,
    userId: message.author.id,
    username: message.author.username,
    channelId: message.channel.id,
    channelName: message.channel.name,
    reasons,
    content: message.content.slice(0, 500),
    createdAt: new Date().toISOString(),
  });
  writeDatabase(db);

  await sendLog(message.guild, '🛡 AutoMod', `${message.author} — ${reasons.join(', ')}\nКанал: ${message.channel}`, 0xED4245);

  try {
    const sent = await message.channel.send(`${message.author}, сообщение удалено: ${reasons.join(', ')}.`);
    setTimeout(() => sent.delete().catch(() => {}), 8000);
  } catch (_) {}

  return { ok: false, reasons };
}

module.exports = { handleAutomodMessage };
