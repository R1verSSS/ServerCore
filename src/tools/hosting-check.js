require('dotenv').config();
const { buildHostingReadiness } = require('../services/hostingCheckService');
const report = buildHostingReadiness();
for (const item of report.checks) console.log(`${item.ok ? '✅' : '⚠️'} ${item.label}${item.hint ? ` — ${item.hint}` : ''}`);
console.log(`\nHosting readiness: ${report.okCount}/${report.total}`);
process.exit(report.okCount === report.total ? 0 : 0);
