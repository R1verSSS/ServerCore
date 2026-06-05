require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');

const targets = [
  { dir: path.join(process.cwd(), 'data', 'backups'), keep: Number(process.env.AUTO_BACKUP_KEEP || 14), mode: 'count' },
  { dir: path.join(process.cwd(), 'data', 'exports'), keepDays: Number(process.env.EXPORTS_KEEP_DAYS || 14), mode: 'days' },
  { dir: path.join(process.cwd(), 'logs'), keepDays: Number(process.env.LOGS_KEEP_DAYS || 14), mode: 'days' },
];

let removed = 0;
for (const target of targets) {
  if (!fs.existsSync(target.dir)) continue;
  const files = fs.readdirSync(target.dir).map(name => {
    const full = path.join(target.dir, name);
    const stat = fs.statSync(full);
    return { name, full, mtime: stat.mtimeMs };
  }).filter(x => fs.statSync(x.full).isFile()).sort((a, b) => b.mtime - a.mtime);

  if (target.mode === 'count') {
    for (const item of files.slice(target.keep)) { fs.rmSync(item.full, { force: true }); removed++; console.log(`🧹 removed ${item.full}`); }
  } else {
    const edge = Date.now() - target.keepDays * 24 * 60 * 60 * 1000;
    for (const item of files.filter(x => x.mtime < edge)) { fs.rmSync(item.full, { force: true }); removed++; console.log(`🧹 removed ${item.full}`); }
  }
}
console.log(`Cleanup complete. Removed ${removed} file(s).`);
