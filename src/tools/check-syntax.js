const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const ignored = new Set(['node_modules', '.git', 'data', 'logs']);
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
  }
}

walk(path.join(root, 'src'));
let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  const rel = path.relative(root, file);
  if (result.status === 0) console.log(`✅ ${rel}`);
  else {
    failed++;
    console.error(`❌ ${rel}`);
    console.error(result.stderr || result.stdout);
  }
}
console.log(`\nChecked ${files.length} JS file(s).`);
if (failed) process.exit(1);
