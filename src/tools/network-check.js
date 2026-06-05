require('dotenv').config();
const { buildNetworkReport, formatNetworkReport } = require('../services/networkCheckService');

(async () => {
  const report = await buildNetworkReport();
  console.log(formatNetworkReport(report));
  console.log('\nРекомендации:');
  for (const advice of report.advice) console.log(`- ${advice}`);
  process.exit(report.okCount === report.total ? 0 : 0);
})().catch(error => {
  console.error('Network check failed:', error);
  process.exit(1);
});
