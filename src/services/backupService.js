const fs = require('node:fs');
const path = require('node:path');
const { readDatabase, writeDatabase, getStorageInfo } = require('./dataStore');

const dataDir = path.join(__dirname, '..', '..', 'data');
const backupsDir = path.join(dataDir, 'backups');
const exportsDir = path.join(dataDir, 'exports');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sanitizeName(value) {
  const raw = String(value || '').trim();
  const safe = raw
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁ_.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80);
  return safe || `backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function getBackupPath(name) {
  ensureDir(backupsDir);
  const safe = sanitizeName(name).replace(/\.json$/i, '');
  return path.join(backupsDir, `${safe}.json`);
}

function createBackup(name = '', meta = {}) {
  ensureDir(backupsDir);
  const db = readDatabase();
  const backupName = sanitizeName(name || `backup-${nowStamp()}`);
  const filePath = getBackupPath(backupName);
  const payload = {
    version: 24,
    createdAt: new Date().toISOString(),
    meta: {
      ...meta,
      storage: getStorageInfo(),
    },
    database: db,
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return { name: path.basename(filePath), path: filePath, size: fs.statSync(filePath).size, createdAt: payload.createdAt };
}

function listBackups() {
  ensureDir(backupsDir);
  return fs.readdirSync(backupsDir)
    .filter(file => file.endsWith('.json'))
    .map(file => {
      const filePath = path.join(backupsDir, file);
      const stat = fs.statSync(filePath);
      return { name: file, path: filePath, size: stat.size, createdAt: stat.birthtime.toISOString(), modifiedAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
}

function resolveBackup(name) {
  const exact = path.join(backupsDir, String(name || ''));
  if (exact.startsWith(backupsDir) && fs.existsSync(exact)) return exact;
  const safe = getBackupPath(name);
  if (fs.existsSync(safe)) return safe;
  const withJson = getBackupPath(String(name || '').replace(/\.json$/i, ''));
  if (fs.existsSync(withJson)) return withJson;
  return null;
}

function restoreBackup(name) {
  const filePath = resolveBackup(name);
  if (!filePath) return { ok: false, reason: 'not_found' };
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  const db = parsed.database || parsed;
  writeDatabase(db);
  return { ok: true, name: path.basename(filePath), path: filePath };
}

function deleteBackup(name) {
  const filePath = resolveBackup(name);
  if (!filePath) return { ok: false, reason: 'not_found' };
  fs.unlinkSync(filePath);
  return { ok: true, name: path.basename(filePath) };
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/["\n,;]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function toCsv(rows, columns) {
  const header = columns.map(col => csvEscape(col.label)).join(',');
  const body = rows.map(row => columns.map(col => csvEscape(typeof col.value === 'function' ? col.value(row) : row[col.value])).join(',')).join('\n');
  return `${header}\n${body}`;
}

function makeExportData(type) {
  const db = readDatabase();
  const users = Object.values(db.users || {});
  if (type === 'users') {
    return users.map(u => ({
      discordId: u.discordId,
      username: u.username,
      level: u.level || 1,
      xp: u.xp || 0,
      messages: u.messages || 0,
      coins: u.coins || 0,
      reputation: u.reputation || 0,
      seasonXp: u.seasonXp || 0,
      clanId: u.clanId || '',
      createdAt: u.createdAt || '',
      updatedAt: u.updatedAt || '',
    }));
  }
  if (type === 'economy') {
    return users.map(u => ({
      discordId: u.discordId,
      username: u.username,
      coins: u.coins || 0,
      inventoryCount: Array.isArray(u.inventory) ? u.inventory.length : 0,
      activeBoosts: JSON.stringify(u.activeBoosts || {}),
    }));
  }
  if (type === 'warnings') return db.warnings || [];
  if (type === 'all') return db;
  return [];
}

function exportData(type = 'all', format = 'json') {
  ensureDir(exportsDir);
  const safeType = ['users', 'economy', 'warnings', 'all'].includes(type) ? type : 'all';
  const safeFormat = String(format).toLowerCase() === 'csv' && safeType !== 'all' ? 'csv' : 'json';
  const data = makeExportData(safeType);
  const fileName = `export-${safeType}-${nowStamp()}.${safeFormat}`;
  const filePath = path.join(exportsDir, fileName);

  if (safeFormat === 'json') {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } else {
    const columnsMap = {
      users: [
        ['Discord ID', 'discordId'], ['Username', 'username'], ['Level', 'level'], ['XP', 'xp'], ['Messages', 'messages'], ['Coins', 'coins'], ['Reputation', 'reputation'], ['Season XP', 'seasonXp'], ['Clan ID', 'clanId'], ['Created At', 'createdAt'], ['Updated At', 'updatedAt']
      ],
      economy: [
        ['Discord ID', 'discordId'], ['Username', 'username'], ['Coins', 'coins'], ['Inventory Count', 'inventoryCount'], ['Active Boosts', 'activeBoosts']
      ],
      warnings: [
        ['ID', 'id'], ['User ID', 'userId'], ['Username', 'username'], ['Moderator ID', 'moderatorId'], ['Moderator', 'moderatorName'], ['Reason', 'reason'], ['Active', 'active'], ['Created At', 'createdAt']
      ],
    };
    const columns = (columnsMap[safeType] || []).map(([label, value]) => ({ label, value }));
    fs.writeFileSync(filePath, toCsv(data, columns), 'utf8');
  }

  return { type: safeType, format: safeFormat, path: filePath, name: fileName, size: fs.statSync(filePath).size };
}


function testBackup(name) {
  const filePath = resolveBackup(name);
  if (!filePath) return { ok: false, reason: 'not_found' };
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const db = parsed.database || parsed;
    const hasCore = db && typeof db === 'object' && db.users && db.settings;
    return { ok: Boolean(hasCore), name: path.basename(filePath), size: fs.statSync(filePath).size, reason: hasCore ? null : 'invalid_structure' };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}

function cleanupOldExports(maxAgeMs = 24 * 60 * 60 * 1000) {
  ensureDir(exportsDir);
  const now = Date.now();
  for (const file of fs.readdirSync(exportsDir)) {
    const filePath = path.join(exportsDir, file);
    const stat = fs.statSync(filePath);
    if (now - stat.mtimeMs > maxAgeMs) fs.unlinkSync(filePath);
  }
}


let autoBackupStarted = false;
function startAutoBackupScheduler() {
  if (autoBackupStarted) return;
  autoBackupStarted = true;
  const enabled = String(process.env.AUTO_BACKUP_ENABLED || 'true').toLowerCase() !== 'false';
  if (!enabled) return;
  const intervalHours = Math.max(1, Number(process.env.AUTO_BACKUP_INTERVAL_HOURS || 24));
  const run = () => {
    try {
      createBackup(`auto-${nowStamp()}`, { source: 'auto-scheduler' });
      const keep = Math.max(1, Number(process.env.AUTO_BACKUP_KEEP || 14));
      const backups = listBackups();
      for (const old of backups.slice(keep)) {
        try { fs.unlinkSync(old.path); } catch {}
      }
    } catch (error) {
      console.error('Auto backup error:', error);
    }
  };
  setTimeout(run, 60 * 1000);
  setInterval(run, intervalHours * 60 * 60 * 1000);
}

module.exports = {
  backupsDir,
  exportsDir,
  createBackup,
  listBackups,
  restoreBackup,
  deleteBackup,
  testBackup,
  exportData,
  cleanupOldExports,
  startAutoBackupScheduler,
};
