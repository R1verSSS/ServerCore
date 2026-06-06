const fs = require('node:fs');
const path = require('node:path');
const { buildHostingReadiness } = require('./hostingCheckService');
const { buildNetworkReport } = require('./networkCheckService');
const { getStorageInfo, readDatabase } = require('./dataStore');
const { listBackups } = require('./backupService');
const { buildModuleStatus } = require('./moduleService');

function check(ok, label, hint = '') { return { ok: Boolean(ok), label, hint }; }

async function buildProductionReport(client, options = {}) {
  const checks = [];
  const hosting = buildHostingReadiness();
  const storage = getStorageInfo();
  const db = readDatabase();
  const backups = listBackups();
  const modules = buildModuleStatus(client);
  const network = options.skipNetwork ? null : await buildNetworkReport({ timeoutMs: Number(process.env.NETWORK_CHECK_TIMEOUT || 8000) }).catch(error => ({ checks: [check(false, 'Network-check не выполнен', error.message)], okCount: 0, total: 1 }));

  checks.push(check(Boolean(process.env.DISCORD_TOKEN), 'DISCORD_TOKEN задан', 'Токен должен храниться только в переменных хостинга.'));
  checks.push(check(Boolean(client?.user?.id), 'Бот авторизован в Discord', client?.user?.tag || ''));
  checks.push(check(hosting.okCount >= Math.max(1, hosting.total - 1), `Готовность к хостингу ${hosting.okCount}/${hosting.total}`, 'Проверь /hosting при предупреждениях.'));
  checks.push(check(storage.driver === 'json' || storage.driver === 'sqlite', `База активна: ${storage.driver}`, storage.driver === 'json' ? 'Для Bothost это ожидаемый режим.' : storage.sqlitePath));
  checks.push(check(fs.existsSync(path.join(process.cwd(), 'data')), 'Папка data доступна'));
  checks.push(check(fs.existsSync(path.join(process.cwd(), 'data', 'backups')), 'Папка data/backups доступна'));
  checks.push(check(backups.length > 0, 'Есть хотя бы один backup', 'Создай /backup create name:hosting-stable'));
  checks.push(check(String(process.env.WEB_PANEL_ENABLED || 'true').toLowerCase() !== 'false', 'Веб-панель включена'));
  checks.push(check(process.env.WEB_PASSWORD && process.env.WEB_PASSWORD !== 'admin', 'Пароль веб-панели изменен'));
  checks.push(check(String(process.env.TEST_MODE || 'false').toLowerCase() !== 'true', 'TEST_MODE выключен'));
  checks.push(check(String(process.env.DEMO_MODE || 'false').toLowerCase() !== 'true', 'DEMO_MODE выключен'));
  checks.push(check(Object.keys(db.users || {}).length >= 0, 'База читается'));

  const disabledRequired = modules.filter(m => ['profiles','economy','shop','tickets','moderation'].includes(m.key) && !m.enabled);
  checks.push(check(disabledRequired.length === 0, 'Ключевые модули включены', disabledRequired.map(m => m.label).join(', ')));
  const music = modules.find(m => m.key === 'music');
  checks.push(check(!music?.enabled || process.env.MUSIC_HOSTING_WARNING === 'false', 'Музыка настроена безопасно', music?.enabled ? 'На Bothost музыка может требовать UDP/VPS. Можно поставить MUSIC_ENABLED=false.' : 'Музыка отключена, пользователи не увидят нерабочий модуль.'));

  if (network) {
    checks.push(check(network.okCount >= Math.max(1, network.total - 1), `Сеть Discord ${network.okCount}/${network.total}`, 'REST 403/timeout не критичен, если команды отвечают.'));
  }

  const okCount = checks.filter(c => c.ok).length;
  return { checks, okCount, total: checks.length, modules, hosting, network, storage, backups: backups.length, generatedAt: new Date().toISOString() };
}

function formatProductionReport(report) {
  return [`Production readiness: ${report.okCount}/${report.total}`, ...report.checks.map(c => `${c.ok ? '✅' : '⚠️'} ${c.label}${c.hint ? ` — ${c.hint}` : ''}`)].join('\n');
}

module.exports = { buildProductionReport, formatProductionReport };
