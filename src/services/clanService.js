const { readDatabase, writeDatabase, updateUser, getOrCreateUser } = require('./dataStore');

function getClanByName(db, name) {
  return Object.values(db.clans || {}).find(clan => clan.name.toLowerCase() === String(name).toLowerCase());
}

function createClan(ownerId, ownerName, name) {
  const db = readDatabase();
  const owner = getOrCreateUser(ownerId, ownerName);
  if (owner.clanId) return { ok: false, reason: 'already_in_clan' };
  if (getClanByName(db, name)) return { ok: false, reason: 'name_taken' };
  db.clanCounter = (db.clanCounter || 0) + 1;
  const clan = { id: db.clanCounter, name: String(name).slice(0, 40), ownerId, members: [ownerId], xp: 0, bank: 0, createdAt: new Date().toISOString() };
  db.clans[clan.id] = clan;
  writeDatabase(db);
  updateUser(ownerId, user => { user.username = ownerName; user.clanId = clan.id; return user; });
  return { ok: true, clan };
}

function joinClan(userId, username, clanId) {
  const db = readDatabase();
  const user = getOrCreateUser(userId, username);
  if (user.clanId) return { ok: false, reason: 'already_in_clan' };
  const clan = db.clans[String(clanId)];
  if (!clan) return { ok: false, reason: 'not_found' };
  clan.members = Array.from(new Set([...(clan.members || []), userId]));
  db.clans[String(clanId)] = clan;
  writeDatabase(db);
  updateUser(userId, existing => { existing.username = username; existing.clanId = clan.id; return existing; });
  return { ok: true, clan };
}

function leaveClan(userId, username) {
  const db = readDatabase();
  const user = getOrCreateUser(userId, username);
  if (!user.clanId) return { ok: false, reason: 'not_in_clan' };
  const clan = db.clans[String(user.clanId)];
  if (!clan) { updateUser(userId, u => { u.clanId = null; return u; }); return { ok: true }; }
  clan.members = (clan.members || []).filter(id => id !== userId);
  if (clan.ownerId === userId && clan.members.length) clan.ownerId = clan.members[0];
  if (!clan.members.length) delete db.clans[String(clan.id)]; else db.clans[String(clan.id)] = clan;
  writeDatabase(db);
  updateUser(userId, existing => { existing.username = username; existing.clanId = null; return existing; });
  return { ok: true, clan };
}

function depositClan(userId, username, amount) {
  const db = readDatabase();
  const user = getOrCreateUser(userId, username);
  if (!user.clanId) return { ok: false, reason: 'not_in_clan' };
  const value = Math.max(Number(amount) || 0, 1);
  if ((user.coins || 0) < value) return { ok: false, reason: 'not_enough_coins' };
  const clan = db.clans[String(user.clanId)];
  if (!clan) return { ok: false, reason: 'not_found' };
  clan.bank = (clan.bank || 0) + value;
  db.clans[String(clan.id)] = clan;
  writeDatabase(db);
  updateUser(userId, existing => { existing.coins = Math.max((existing.coins || 0) - value, 0); return existing; });
  return { ok: true, clan, amount: value };
}

function getClan(id) {
  return readDatabase().clans?.[String(id)] || null;
}

function getClanTop(limit = 10) {
  const db = readDatabase();
  return Object.values(db.clans || {}).sort((a, b) => ((b.xp || 0) + (b.bank || 0)) - ((a.xp || 0) + (a.bank || 0))).slice(0, limit);
}

module.exports = { createClan, joinClan, leaveClan, depositClan, getClan, getClanTop };
