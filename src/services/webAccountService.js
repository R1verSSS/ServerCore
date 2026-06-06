const crypto = require('node:crypto');
const { readDatabase, writeDatabase } = require('./dataStore');

const SESSION_TTL_MS = Number(process.env.USER_WEB_SESSION_HOURS || 24) * 60 * 60 * 1000;
const CODE_TTL_MS = Number(process.env.USER_WEB_CODE_MINUTES || 10) * 60 * 1000;

function ensureDb(db) {
  if (!db.webAccounts || typeof db.webAccounts !== 'object') db.webAccounts = {};
  if (!Array.isArray(db.webUserLoginLog)) db.webUserLoginLog = [];
  return db;
}

function normalizeUserId(value) {
  return String(value || '').replace(/[^0-9]/g, '').trim();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password || ''), salt, 120000, 32, 'sha256').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, account) {
  if (!account?.passwordHash || !account?.salt) return false;
  const { hash } = hashPassword(password, account.salt);
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(account.passwordHash, 'hex'));
  } catch {
    return false;
  }
}

function setUserPassword(userId, username, password) {
  const id = normalizeUserId(userId);
  if (!id) return { ok: false, reason: 'bad_user' };
  if (String(password || '').length < 6) return { ok: false, reason: 'short_password' };
  const db = ensureDb(readDatabase());
  const { salt, hash } = hashPassword(password);
  const current = db.webAccounts[id] || { userId: id, createdAt: new Date().toISOString() };
  db.webAccounts[id] = {
    ...current,
    userId: id,
    username: String(username || current.username || id),
    salt,
    passwordHash: hash,
    enabled: true,
    updatedAt: new Date().toISOString(),
    passwordUpdatedAt: new Date().toISOString(),
  };
  writeDatabase(db);
  return { ok: true, account: sanitizeAccount(db.webAccounts[id]) };
}

function generateLoginCode(userId, username) {
  const id = normalizeUserId(userId);
  if (!id) return { ok: false, reason: 'bad_user' };
  const db = ensureDb(readDatabase());
  const code = String(crypto.randomInt(100000, 999999));
  const current = db.webAccounts[id] || { userId: id, createdAt: new Date().toISOString(), enabled: true };
  db.webAccounts[id] = {
    ...current,
    userId: id,
    username: String(username || current.username || id),
    enabled: current.enabled !== false,
    loginCodeHash: hashPassword(code, 'servercore-login-code').hash,
    loginCodeExpiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    updatedAt: new Date().toISOString(),
  };
  writeDatabase(db);
  return { ok: true, code, expiresAt: db.webAccounts[id].loginCodeExpiresAt, minutes: Math.round(CODE_TTL_MS / 60000) };
}

function verifyLoginCode(code, account) {
  if (!account?.loginCodeHash || !account?.loginCodeExpiresAt) return false;
  if (Date.now() > new Date(account.loginCodeExpiresAt).getTime()) return false;
  const hash = hashPassword(String(code || ''), 'servercore-login-code').hash;
  return hash === account.loginCodeHash;
}

function createSession(userId, meta = {}) {
  const id = normalizeUserId(userId);
  const token = crypto.randomBytes(32).toString('hex');
  const db = ensureDb(readDatabase());
  const account = db.webAccounts[id];
  if (!account) return null;
  account.sessionToken = token;
  account.sessionExpiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  account.lastLoginAt = new Date().toISOString();
  account.lastLoginIp = meta.ip || 'unknown';
  account.loginCodeHash = null;
  account.loginCodeExpiresAt = null;
  db.webAccounts[id] = account;
  db.webUserLoginLog.push({ id: db.webUserLoginLog.length + 1, userId: id, username: account.username, ok: true, reason: 'success', ip: meta.ip || '', userAgent: meta.userAgent || '', createdAt: new Date().toISOString() });
  db.webUserLoginLog = db.webUserLoginLog.slice(-500);
  writeDatabase(db);
  return `${id}:${token}`;
}

function validateSession(cookieValue) {
  const [userIdRaw, token] = String(cookieValue || '').split(':');
  const userId = normalizeUserId(userIdRaw);
  if (!userId || !token) return null;
  const db = ensureDb(readDatabase());
  const account = db.webAccounts[userId];
  if (!account || account.enabled === false) return null;
  if (account.sessionToken !== token) return null;
  if (!account.sessionExpiresAt || Date.now() > new Date(account.sessionExpiresAt).getTime()) return null;
  return { userId, username: account.username || userId, account: sanitizeAccount(account) };
}

function loginUser(userId, secret, meta = {}) {
  const id = normalizeUserId(userId);
  const db = ensureDb(readDatabase());
  const account = db.webAccounts[id];
  let ok = false;
  let reason = 'not_found';
  if (account && account.enabled !== false) {
    if (verifyPassword(secret, account)) { ok = true; reason = 'password'; }
    else if (verifyLoginCode(secret, account)) { ok = true; reason = 'code'; }
    else reason = 'bad_secret';
  } else if (account?.enabled === false) {
    reason = 'disabled';
  }
  db.webUserLoginLog.push({ id: db.webUserLoginLog.length + 1, userId: id, username: account?.username || id, ok, reason, ip: meta.ip || '', userAgent: meta.userAgent || '', createdAt: new Date().toISOString() });
  db.webUserLoginLog = db.webUserLoginLog.slice(-500);
  writeDatabase(db);
  if (!ok) return { ok: false, reason };
  return { ok: true, session: createSession(id, meta), account: sanitizeAccount(account) };
}

function getAccount(userId) {
  const db = ensureDb(readDatabase());
  return sanitizeAccount(db.webAccounts[normalizeUserId(userId)] || null);
}

function disableAccount(userId) {
  const id = normalizeUserId(userId);
  const db = ensureDb(readDatabase());
  if (!db.webAccounts[id]) return { ok: false };
  db.webAccounts[id].enabled = false;
  db.webAccounts[id].sessionToken = null;
  db.webAccounts[id].updatedAt = new Date().toISOString();
  writeDatabase(db);
  return { ok: true };
}

function listUserWebLog(userId = null, limit = 50) {
  const db = ensureDb(readDatabase());
  let rows = db.webUserLoginLog || [];
  if (userId) rows = rows.filter(r => r.userId === normalizeUserId(userId));
  return rows.slice(-limit).reverse();
}

function sanitizeAccount(account) {
  if (!account) return null;
  return {
    userId: account.userId,
    username: account.username,
    enabled: account.enabled !== false,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    passwordUpdatedAt: account.passwordUpdatedAt,
    lastLoginAt: account.lastLoginAt,
    lastLoginIp: account.lastLoginIp,
    hasPassword: Boolean(account.passwordHash),
    hasActiveCode: Boolean(account.loginCodeHash && account.loginCodeExpiresAt && Date.now() < new Date(account.loginCodeExpiresAt).getTime()),
    loginCodeExpiresAt: account.loginCodeExpiresAt,
  };
}

module.exports = {
  normalizeUserId,
  setUserPassword,
  generateLoginCode,
  loginUser,
  validateSession,
  getAccount,
  disableAccount,
  listUserWebLog,
};
