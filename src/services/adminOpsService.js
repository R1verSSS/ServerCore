const fs = require('node:fs');
const path = require('node:path');
const { readDatabase, writeDatabase, getStorageInfo } = require('./dataStore');
const { listBackups, createBackup } = require('./backupService');

const rootDir = path.join(__dirname, '..', '..');
const dataDir = path.join(rootDir, 'data');
const deployMarkerPath = path.join(dataDir, 'last-deploy.json');
const logsDir = path.join(rootDir, 'logs');
const errorLogPath = path.join(logsDir, 'error.log');

const CHANGELOG = [
  { version: '24.1.14', title: 'Admin Operations Upgrade', items: ['Update-center и /update-check', 'Changelog в веб-панели', 'Ошибки и сценарии администратора', 'Улучшенный backup-центр'] },
  { version: '24.1.13', title: 'Balance History Command Upgrade', items: ['/balance показывает последние операции', '/balance-history вынесен отдельно'] },
  { version: '24.1.12', title: 'Server Management UX Upgrade', items: ['Онбординг', 'Шаблоны тикетов', 'История экономики', 'Скидки магазина', 'Panel Center 2.0'] },
  { version: '24.1.11', title: 'Hosting Stability & Server Control', items: ['MUSIC_ENABLED', 'Модули', 'Правила каналов', 'Production-check', 'Авто-backup'] },
  { version: '24.1.10', title: 'Channel Cleanup & Music', items: ['Защищенные каналы', 'Музыкальная панель', 'Диагностика voice'] },
  { version: '24.1.9', title: 'Access & Server Structure Upgrade', items: ['Матрица доступа', 'Context-menu', 'Справочники команд', 'Магазин'] }
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getPackageInfo() {
  try {
    return JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  } catch {
    return { name: 'servercore-discord-bot', version: 'unknown' };
  }
}

function getDeployMarker() {
  try {
    return JSON.parse(fs.readFileSync(deployMarkerPath, 'utf8'));
  } catch {
    return null;
  }
}

function writeDeployMarker(meta = {}) {
  ensureDir(dataDir);
  const pkg = getPackageInfo();
  const payload = {
    version: pkg.version,
    deployedAt: new Date().toISOString(),
    commandCount: meta.commandCount || 0,
    source: meta.source || 'npm run deploy'
  };
  fs.writeFileSync(deployMarkerPath, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

function buildUpdateReport() {
  const pkg = getPackageInfo();
  const marker = getDeployMarker();
  const backups = listBackups();
  const storage = getStorageInfo();
  const db = readDatabase();
  const latestBackup = backups[0] || null;
  const deployedSameVersion = marker && marker.version === pkg.version;
  const checks = [
    { ok: Boolean(pkg.version && pkg.version !== 'unknown'), label: 'Версия проекта определена', hint: pkg.version || 'unknown' },
    { ok: Boolean(marker), label: 'Slash-команды регистрировались', hint: marker ? `${marker.deployedAt} • ${marker.commandCount || 0} команд` : 'После обновления выполни npm run deploy' },
    { ok: Boolean(deployedSameVersion), label: 'Команды соответствуют версии проекта', hint: deployedSameVersion ? `deploy выполнен для ${pkg.version}` : `текущая версия ${pkg.version}, последний deploy ${marker?.version || 'неизвестен'}` },
    { ok: Boolean(latestBackup), label: 'Есть хотя бы один backup', hint: latestBackup ? `${latestBackup.name} • ${Math.round(latestBackup.size / 1024)} КБ` : 'Создай backup перед следующим обновлением' },
    { ok: Boolean(storage.driver), label: 'Хранилище доступно', hint: storage.driver || 'unknown' },
    { ok: String(process.env.NODE_ENV || '').toLowerCase() === 'production', label: 'Production-режим', hint: `NODE_ENV=${process.env.NODE_ENV || 'не указан'}` },
    { ok: String(process.env.TEST_MODE || 'false') !== 'true' && String(process.env.DEMO_MODE || 'false') !== 'true', label: 'Тестовые режимы выключены', hint: `TEST_MODE=${process.env.TEST_MODE || 'false'}, DEMO_MODE=${process.env.DEMO_MODE || 'false'}` },
  ];
  const okCount = checks.filter(c => c.ok).length;
  return {
    package: pkg,
    marker,
    backups,
    latestBackup,
    storage,
    users: Object.keys(db.users || {}).length,
    checks,
    okCount,
    total: checks.length
  };
}

function getChangelog() {
  return CHANGELOG;
}

function readErrorLog(limit = 50) {
  try {
    const raw = fs.readFileSync(errorLogPath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    return lines.slice(-limit).reverse();
  } catch {
    return [];
  }
}

function clearErrorLog() {
  ensureDir(logsDir);
  fs.writeFileSync(errorLogPath, '', 'utf8');
  return true;
}

function recordWebAdminAction(action, details = {}) {
  const db = readDatabase();
  if (!Array.isArray(db.adminOperations)) db.adminOperations = [];
  db.adminOperations.push({
    id: db.adminOperations.length + 1,
    action,
    details,
    createdAt: new Date().toISOString()
  });
  db.adminOperations = db.adminOperations.slice(-500);
  writeDatabase(db);
}

function getAdminOperations(limit = 25) {
  const db = readDatabase();
  return (db.adminOperations || []).slice(-limit).reverse();
}

function runScenario(type) {
  const result = { ok: true, type, messages: [] };
  if (type === 'predeploy-backup') {
    const backup = createBackup(`predeploy-${Date.now()}`, { source: 'scenario-predeploy' });
    result.messages.push(`Создан backup ${backup.name}`);
  } else if (type === 'stable-backup') {
    const backup = createBackup(`stable-${Date.now()}`, { source: 'scenario-stable' });
    result.messages.push(`Создан backup ${backup.name}`);
  } else if (type === 'mark-panels-check') {
    result.messages.push('Проверь /panel-center и переопубликуй нужные панели вручную.');
  } else if (type === 'post-update-check') {
    const report = buildUpdateReport();
    result.messages.push(`Update-check: ${report.okCount}/${report.total}`);
  } else {
    result.ok = false;
    result.messages.push('Неизвестный сценарий.');
  }
  recordWebAdminAction(`scenario:${type}`, result);
  return result;
}

module.exports = {
  buildUpdateReport,
  getChangelog,
  readErrorLog,
  clearErrorLog,
  writeDeployMarker,
  recordWebAdminAction,
  getAdminOperations,
  runScenario
};
