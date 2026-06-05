const { readDatabase, writeDatabase } = require('./dataStore');

function getMaintenance() {
  const db = readDatabase();
  const state = db.maintenance || {};
  return {
    enabled: Boolean(state.enabled),
    reason: state.reason || 'Проводятся технические работы.',
    updatedAt: state.updatedAt || null,
    updatedBy: state.updatedBy || null,
  };
}

function setMaintenance(enabled, reason = '', actor = {}) {
  const db = readDatabase();
  db.maintenance = {
    enabled: Boolean(enabled),
    reason: reason || (enabled ? 'Проводятся технические работы.' : ''),
    updatedAt: new Date().toISOString(),
    updatedBy: actor.username || actor.tag || actor.id || 'system',
  };
  writeDatabase(db);
  return getMaintenance();
}

function isMaintenanceCommandAllowed(commandName) {
  return ['maintenance', 'dbstatus', 'backup', 'export', 'help'].includes(commandName);
}

module.exports = { getMaintenance, setMaintenance, isMaintenanceCommandAllowed };
