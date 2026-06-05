require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');

const checks = [];
function add(ok, label, hint = '') { checks.push({ ok, label, hint }); }

add(Boolean(process.env.DISCORD_TOKEN), 'DISCORD_TOKEN задан', 'Скопируй Bot Token из Discord Developer Portal → Bot.');
add(Boolean(process.env.CLIENT_ID), 'CLIENT_ID задан', 'Это Application/Client ID из OAuth2.');
add(Boolean(process.env.GUILD_ID), 'GUILD_ID задан', 'Включи режим разработчика Discord и скопируй ID сервера.');
add((process.env.WEB_PASSWORD || '') !== 'admin', 'WEB_PASSWORD не admin', 'Задай надежный пароль перед хостингом.');
add((process.env.WEB_SESSION_TOKEN || '').length >= 24, 'WEB_SESSION_TOKEN длинный', 'Минимум 24 символа.');
add(fs.existsSync(path.join(process.cwd(), 'data')), 'Папка data существует', 'Создай папку data.');
add(fs.existsSync(path.join(process.cwd(), 'data', 'backups')), 'Папка data/backups существует', 'Создай папку backups.');
add(String(process.env.TEST_MODE || 'false').toLowerCase() !== 'true', 'TEST_MODE выключен для production', 'Оставляй true только для тестов.');

for (const c of checks) console.log(`${c.ok ? '✅' : '⚠️'} ${c.label}${c.ok ? '' : ` — ${c.hint}`}`);
const errors = checks.filter(c => !c.ok && ['DISCORD_TOKEN задан','CLIENT_ID задан','GUILD_ID задан'].includes(c.label));
if (errors.length) process.exit(1);
