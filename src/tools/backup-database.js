require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { exportDatabaseToJson, getStorageInfo } = require('../services/dataStore');

const backupsDir = path.join(__dirname, '..', '..', 'data', 'backups');
if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = path.join(backupsDir, `database-backup-${stamp}.json`);
exportDatabaseToJson(target);
const info = getStorageInfo();

console.log('Backup created:');
console.log(target);
console.log(`Storage driver: ${info.driver}`);
