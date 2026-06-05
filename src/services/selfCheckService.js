const { buildHealthReport } = require('./healthCheckService');

async function runStartupSelfCheck(client) {
  const guild = client.guilds.cache.get(process.env.GUILD_ID) || client.guilds.cache.first();
  const report = await buildHealthReport(client, guild).catch(error => ({ checks: [{ ok: false, label: 'Self-check failed', hint: error.message }], okCount: 0, total: 1 }));
  console.log('');
  console.log('==== ServerCore self-check ====');
  for (const item of report.checks) {
    console.log(`${item.ok ? '[OK]  ' : '[WARN]'} ${item.label}${item.hint && !item.ok ? ` — ${item.hint}` : ''}`);
  }
  console.log(`Result: ${report.okCount}/${report.total}`);
  console.log('===============================');
  console.log('');
}
module.exports = { runStartupSelfCheck };
