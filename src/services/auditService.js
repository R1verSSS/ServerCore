const { readDatabase, writeDatabase } = require('./dataStore');
const { logAuditLine } = require('./fileLogService');

function ensureAudit(db) {
  if (!Array.isArray(db.adminAudit)) db.adminAudit = [];
  return db.adminAudit;
}

function addAudit(action, actor = {}, details = {}) {
  const db = readDatabase();
  const audit = ensureAudit(db);
  const item = {
    id: Number(db.adminAuditCounter || 0) + 1,
    action: String(action || 'unknown'),
    actorId: actor.id || actor.userId || 'system',
    actorName: actor.tag || actor.username || actor.name || 'system',
    details,
    createdAt: new Date().toISOString(),
  };
  db.adminAuditCounter = item.id;
  audit.push(item);
  if (audit.length > 1000) db.adminAudit = audit.slice(-1000);
  writeDatabase(db);
  logAuditLine(item.action, item.actorName, item.details);
  return item;
}

function listAudit(limit = 100) {
  const db = readDatabase();
  const audit = ensureAudit(db);
  return audit.slice(-limit).reverse();
}

module.exports = { addAudit, listAudit };
