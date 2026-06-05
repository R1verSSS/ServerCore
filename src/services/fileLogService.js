const fs = require('node:fs');
const path = require('node:path');
const util = require('node:util');

const LOG_DIR = path.join(process.cwd(), 'logs');
const files = {
  info: path.join(LOG_DIR, 'bot.log'),
  warn: path.join(LOG_DIR, 'bot.log'),
  error: path.join(LOG_DIR, 'error.log'),
  audit: path.join(LOG_DIR, 'audit.log'),
};

function ensureLogDir() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function serialize(args) {
  return args.map(arg => {
    if (arg instanceof Error) return `${arg.stack || arg.message}`;
    if (typeof arg === 'string') return arg;
    return util.inspect(arg, { depth: 5, colors: false, breakLength: 140 });
  }).join(' ');
}

function append(level, ...args) {
  try {
    ensureLogDir();
    const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${serialize(args)}\n`;
    fs.appendFileSync(files[level] || files.info, line, 'utf8');
  } catch (_) {
    // logging must never break the bot
  }
}

function initFileLogging() {
  ensureLogDir();
  if (console.__serverCoreFileLogging) return;
  const original = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };
  console.log = (...args) => { append('info', ...args); original.log(...args); };
  console.warn = (...args) => { append('warn', ...args); original.warn(...args); };
  console.error = (...args) => { append('error', ...args); original.error(...args); };
  console.__serverCoreFileLogging = true;
}

function logAuditLine(action, actor = 'system', details = {}) {
  append('audit', action, actor, details);
}

module.exports = { initFileLogging, append, logAuditLine, LOG_DIR };
