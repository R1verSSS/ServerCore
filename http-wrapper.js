// Hosting entry point for ServerCore.
// Some bot hostings with web-domain support try to start /app/http-wrapper.js.
// This wrapper ensures the web panel uses the hosting-provided PORT and then starts the bot.
require('dotenv').config();
const fs = require('node:fs');

for (const dir of ['data', 'data/backups', 'data/exports', 'logs']) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

process.env.WEB_PANEL_ENABLED = process.env.WEB_PANEL_ENABLED || 'true';
process.env.WEB_PORT = process.env.PORT || process.env.WEB_PORT || '3000';

require('./src/index.js');
