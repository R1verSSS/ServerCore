require('dotenv').config();
const { spawnSync } = require('node:child_process');
const { buildHostingReadiness } = require('../services/hostingCheckService');
const { buildNetworkReport, formatNetworkReport } = require('../services/networkCheckService');

function run(title, command, args) {
  console.log(`\n=== ${title} ===`);
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false });
  if (result.status !== 0) console.log(`⚠️ ${title}: есть предупреждения или ошибки.`);
  return result.status || 0;
}

(async () => {
  console.log('ServerCore Doctor — комплексная локальная проверка проекта');
  run('Проверка синтаксиса', process.execPath, ['src/tools/check-syntax.js']);
  run('Проверка .env', process.execPath, ['src/tools/env-check.js']);

  console.log('\n=== Готовность к хостингу ===');
  const hosting = buildHostingReadiness();
  for (const item of hosting.checks) console.log(`${item.ok ? '✅' : '⚠️'} ${item.label}${item.hint ? ` — ${item.hint}` : ''}`);
  console.log(`Hosting readiness: ${hosting.okCount}/${hosting.total}`);

  console.log('\n=== Сеть Node.js → Discord ===');
  const network = await buildNetworkReport();
  console.log(formatNetworkReport(network));
  if (network.okCount !== network.total) {
    console.log('\nРекомендации по сети:');
    for (const advice of network.advice) console.log(`- ${advice}`);
  }

  console.log('\nDoctor finished. Если синтаксис и .env OK, а сеть Discord падает локально, проблему можно отложить до хостинга/VPS.');
})().catch(error => {
  console.error('Doctor failed:', error);
  process.exit(1);
});
