const { readDatabase, writeDatabase } = require('./dataStore');

function addIntegration(type, name, target) {
  const db = readDatabase();
  if (!db.integrations) db.integrations = [];
  const item = { id: db.integrations.length + 1, type, name, target, enabled: true, createdAt: new Date().toISOString() };
  db.integrations.push(item);
  writeDatabase(db);
  return item;
}

function listIntegrations() { return readDatabase().integrations || []; }
function toggleIntegration(id, enabled) {
  const db = readDatabase();
  const item = (db.integrations || []).find(x => Number(x.id) === Number(id));
  if (!item) return { ok: false };
  item.enabled = enabled;
  writeDatabase(db);
  return { ok: true, integration: item };
}

module.exports = { addIntegration, listIntegrations, toggleIntegration };
