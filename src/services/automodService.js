const { PermissionFlagsBits } = require('discord.js');
const { readDatabase, writeDatabase } = require('./dataStore');
const { getSettings } = require('./settingsService');
const { sendLog } = require('./logService');
const { getAutomodRules } = require('./managementUxService');

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

  const rules = getAutomodRules();
  const reasons = [];
  const logOnly = [];
  if (settings.automodBlockLinks && rules.links?.enabled !== false && containsLink(message.content)) (rules.links?.action === 'log' ? logOnly : reasons).push('запрещенная ссылка');
  if (settings.automodAntiCaps && rules.caps?.enabled !== false && capsRatio(message.content) > 0.75) (rules.caps?.action === 'log' ? logOnly : reasons).push('слишком много CAPS');
  if (rules.mentions?.enabled !== false && (message.mentions.users.size || 0) >= Number(settings.automodMaxMentions || 6)) (rules.mentions?.action === 'log' ? logOnly : reasons).push('массовые упоминания');
  const forbiddenWord = hasForbiddenWord(message.content, settings.automodForbiddenWords || []);
  if (rules.words?.enabled !== false && forbiddenWord) (rules.words?.action === 'log' ? logOnly : reasons).push(`запрещенное слово: ${forbiddenWord}`);

  if (settings.automodAntiSpam) {
    const key = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const recent = (spamCache.get(key) || []).filter(item => now - item.at < 10000);
    recent.push({ at: now, text: message.content });
    spamCache.set(key, recent);
    const sameCount = recent.filter(item => item.text === message.content).length;
    if (rules.spam?.enabled !== false && (recent.length >= 7 || sameCount >= 4)) (rules.spam?.action === 'log' ? logOnly : reasons).push('спам сообщениями');
  }

  if (!reasons.length && !logOnly.length) return { ok: true };

  if (reasons.length) { try { await message.delete(); } catch (_) {} }

  const db = readDatabase();
  if (!db.automodLogs) db.automodLogs = [];
  db.automodLogs.push({
    id: db.automodLogs.length + 1,
    userId: message.author.id,
    username: message.author.username,
    channelId: message.channel.id,
    channelName: message.channel.name,
    reasons: reasons.length ? reasons : logOnly.map(x => `log: ${x}`),
    content: message.content.slice(0, 500),
    createdAt: new Date().toISOString(),
  });
  writeDatabase(db);

  const effectiveReasons = reasons.length ? reasons : logOnly;
  await sendLog(message.guild, '🛡 AutoMod', `${message.author} — ${effectiveReasons.join(', ')}\nКанал: ${message.channel}`, reasons.length ? 0xED4245 : 0xFEE75C);

  if (reasons.length) {
    try {
      const sent = await message.channel.send(`${message.author}, сообщение удалено: ${reasons.join(', ')}.`);
      setTimeout(() => sent.delete().catch(() => {}), 8000);
    } catch (_) {}
    return { ok: false, reasons };
  }

  return { ok: true, reasons: logOnly, loggedOnly: true };

}

module.exports = { handleAutomodMessage };
