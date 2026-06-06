require('dotenv').config();
const { buildUpdateReport } = require('../services/adminOpsService');
const report = buildUpdateReport();
console.log(`ServerCore update-check: ${report.okCount}/${report.total}`);
for (const check of report.checks) {
  console.log(`${check.ok ? '[OK]' : '[WARN]'} ${check.label}: ${check.hint || ''}`);
}
process.exit(report.okCount === report.total ? 0 : 1);
