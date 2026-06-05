require('dotenv').config();
const path = require('node:path');
const { readDatabase, writeDatabase, getStorageInfo } = require('../services/dataStore');

const db = readDatabase();
writeDatabase(db);
const info = getStorageInfo();

console.log('Migration finished.');
console.log(`Storage driver: ${info.driver}`);
console.log(`SQLite path: ${info.sqlitePath}`);
console.log(`Users: ${Object.keys(db.users || {}).length}`);
console.log(`Events: ${Object.keys(db.events || {}).length}`);
console.log(`Tickets: ${Object.keys(db.tickets || {}).length}`);
