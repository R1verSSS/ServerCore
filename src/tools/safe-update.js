const { spawnSync } = require('node:child_process');
function run(name, args) {
  console.log(`\n=== ${name} ===`);
  const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
}
run('Backup database', ['run', 'db:backup']);
run('Check environment', ['run', 'env:check']);
run('Check JavaScript syntax', ['run', 'check']);
run('Run database migration', ['run', 'db:migrate']);
console.log('\n✅ Safe update checks completed. Now run: npm start');
