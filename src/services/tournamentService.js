const { readDatabase, writeDatabase } = require('./dataStore');

function createTournament(userId, username, title, maxMembers = 16, description = '') {
  const db = readDatabase();
  db.tournamentCounter = (db.tournamentCounter || 0) + 1;
  const tournament = {
    id: db.tournamentCounter,
    title: String(title).slice(0, 80),
    description: String(description || '').slice(0, 1000),
    maxMembers: Number(maxMembers) || 16,
    createdBy: userId,
    creatorName: username,
    participants: [],
    results: [],
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  db.tournaments[String(tournament.id)] = tournament;
  writeDatabase(db);
  return tournament;
}

function joinTournament(userId, username, id) {
  const db = readDatabase();
  const tournament = db.tournaments?.[String(id)];
  if (!tournament || tournament.status !== 'open') return { ok: false, reason: 'not_found' };
  if ((tournament.participants || []).some(p => p.userId === userId)) return { ok: false, reason: 'already_joined' };
  if ((tournament.participants || []).length >= tournament.maxMembers) return { ok: false, reason: 'full' };
  tournament.participants.push({ userId, username, joinedAt: new Date().toISOString() });
  db.tournaments[String(id)] = tournament;
  writeDatabase(db);
  return { ok: true, tournament };
}

function leaveTournament(userId, id) {
  const db = readDatabase();
  const tournament = db.tournaments?.[String(id)];
  if (!tournament || tournament.status !== 'open') return { ok: false, reason: 'not_found' };
  const before = (tournament.participants || []).length;
  tournament.participants = (tournament.participants || []).filter(p => p.userId !== userId);
  if (tournament.participants.length === before) return { ok: false, reason: 'not_joined' };
  db.tournaments[String(id)] = tournament;
  writeDatabase(db);
  return { ok: true, tournament };
}

function closeTournament(id, status = 'closed') {
  const db = readDatabase();
  const tournament = db.tournaments?.[String(id)];
  if (!tournament) return { ok: false };
  tournament.status = status;
  tournament.closedAt = new Date().toISOString();
  db.tournaments[String(id)] = tournament;
  writeDatabase(db);
  return { ok: true, tournament };
}

function getTournament(id) { return readDatabase().tournaments?.[String(id)] || null; }
function listTournaments(status = 'open') { return Object.values(readDatabase().tournaments || {}).filter(t => !status || t.status === status).sort((a,b)=>Number(b.id)-Number(a.id)); }
function buildBracket(tournament) {
  const participants = tournament.participants || [];
  if (!participants.length) return 'Участников пока нет.';
  const pairs = [];
  for (let i=0;i<participants.length;i+=2) pairs.push(`${participants[i].username} vs ${participants[i+1]?.username || 'ожидает соперника'}`);
  return pairs.map((p,i)=>`**Матч ${i+1}:** ${p}`).join('\n');
}

module.exports = { createTournament, joinTournament, leaveTournament, closeTournament, getTournament, listTournaments, buildBracket };
