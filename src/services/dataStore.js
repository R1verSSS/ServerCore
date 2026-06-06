const fs = require('node:fs');
const path = require('node:path');

const dataDir = path.join(__dirname, '..', '..', 'data');
const jsonPath = path.join(dataDir, 'database.json');
const sqlitePath = process.env.SQLITE_PATH
  ? path.resolve(process.cwd(), process.env.SQLITE_PATH)
  : path.join(dataDir, 'database.sqlite');

const EMPTY_DB = {
  users: {},
  tickets: {},
  ticketCounter: 0,
  reputations: [],
  events: {},
  eventCounter: 0,
  warnings: [],
  moderationCounter: 0,
  moderationCases: [],
  moderationCaseCounter: 0,
  moderationNotes: [],
  moderationNoteCounter: 0,
  moderationAppeals: [],
  moderationAppealCounter: 0,
  quests: {},
  settings: {},
  clans: {},
  clanCounter: 0,
  applications: {},
  applicationCounter: 0,
  tournaments: {},
  tournamentCounter: 0,
  seasons: {},
  integrations: [],
  inventories: {},
  automodLogs: [],
  profilePresets: {},
  shopItems: [],
  suggestions: {},
  suggestionCounter: 0,
  polls: {},
  pollCounter: 0,
  reminders: {},
  reminderCounter: 0,
  notificationSettings: {},
  notificationLog: [],
  lfgPosts: {},
  lfgCounter: 0,
  tempVoiceRooms: {},
  adminAudit: [],
  adminAuditCounter: 0,
  maintenance: { enabled: false, reason: '', updatedAt: null, updatedBy: null },
  moduleSettings: {
    music: { enabled: String(process.env.MUSIC_ENABLED || 'true').toLowerCase() !== 'false', status: 'auto' },
    profiles: { enabled: true },
    economy: { enabled: true },
    shop: { enabled: true },
    tickets: { enabled: true },
    moderation: { enabled: true },
    automod: { enabled: true },
    tempVoice: { enabled: true },
    events: { enabled: true },
    tournaments: { enabled: true },
    clans: { enabled: true },
    backups: { enabled: true }
  },
  channelRules: {},
  economyHistory: [],
  ticketTemplates: {},
  panelRegistry: {},
  onboardingProgress: {},
  shopDeals: {},
  purchaseHistory: [],
  webLoginLog: [],
  automodRules: {},
  productionChecks: [],
  tempVoiceSettings: {
    createChannelName: '➕・создать-комнату',
    roomNameTemplate: '🔊・комната {username}',
    defaultLimit: 0,
    deleteWhenEmpty: true
  }
};

let sqlite = null;
let sqliteUnavailableReason = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeDefaults(db) {
  const normalized = { ...clone(EMPTY_DB), ...(db || {}) };
  if (!normalized.users) normalized.users = {};
  if (!normalized.tickets) normalized.tickets = {};
  if (!normalized.reputations) normalized.reputations = [];
  if (!normalized.events) normalized.events = {};
  if (!normalized.warnings) normalized.warnings = [];
  if (!Array.isArray(normalized.moderationCases)) normalized.moderationCases = [];
  if (!Array.isArray(normalized.moderationNotes)) normalized.moderationNotes = [];
  if (!Array.isArray(normalized.moderationAppeals)) normalized.moderationAppeals = [];
  if (typeof normalized.moderationCaseCounter !== 'number') normalized.moderationCaseCounter = Number(normalized.moderationCaseCounter || 0);
  if (typeof normalized.moderationNoteCounter !== 'number') normalized.moderationNoteCounter = Number(normalized.moderationNoteCounter || 0);
  if (typeof normalized.moderationAppealCounter !== 'number') normalized.moderationAppealCounter = Number(normalized.moderationAppealCounter || 0);
  if (!normalized.quests) normalized.quests = {};
  if (!normalized.settings) normalized.settings = {};
  if (!normalized.clans) normalized.clans = {};
  if (!normalized.applications) normalized.applications = {};
  if (!normalized.tournaments) normalized.tournaments = {};
  if (!normalized.seasons) normalized.seasons = {};
  if (!normalized.integrations) normalized.integrations = [];
  if (!normalized.inventories) normalized.inventories = {};
  if (!normalized.automodLogs) normalized.automodLogs = [];
  if (!normalized.profilePresets) normalized.profilePresets = {};
  if (!Array.isArray(normalized.shopItems)) normalized.shopItems = [];
  if (!normalized.suggestions) normalized.suggestions = {};
  if (!normalized.polls) normalized.polls = {};
  if (!normalized.reminders) normalized.reminders = {};
  if (!normalized.notificationSettings) normalized.notificationSettings = {};
  if (!Array.isArray(normalized.notificationLog)) normalized.notificationLog = [];
  if (!normalized.lfgPosts) normalized.lfgPosts = {};
  if (typeof normalized.lfgCounter !== 'number') normalized.lfgCounter = Number(normalized.lfgCounter || 0);
  if (!Array.isArray(normalized.adminAudit)) normalized.adminAudit = [];
  if (typeof normalized.adminAuditCounter !== 'number') normalized.adminAuditCounter = Number(normalized.adminAuditCounter || 0);
  if (!normalized.maintenance || typeof normalized.maintenance !== 'object') normalized.maintenance = { enabled: false, reason: '', updatedAt: null, updatedBy: null };
  if (!normalized.moduleSettings || typeof normalized.moduleSettings !== 'object') normalized.moduleSettings = clone(EMPTY_DB.moduleSettings);
  normalized.moduleSettings = { ...clone(EMPTY_DB.moduleSettings), ...(normalized.moduleSettings || {}) };
  if (!normalized.channelRules || typeof normalized.channelRules !== 'object') normalized.channelRules = {};
  if (!Array.isArray(normalized.economyHistory)) normalized.economyHistory = [];
  if (!normalized.ticketTemplates || typeof normalized.ticketTemplates !== 'object') normalized.ticketTemplates = {};
  if (!normalized.panelRegistry || typeof normalized.panelRegistry !== 'object') normalized.panelRegistry = {};
  if (!normalized.onboardingProgress || typeof normalized.onboardingProgress !== 'object') normalized.onboardingProgress = {};
  if (!normalized.shopDeals || typeof normalized.shopDeals !== 'object') normalized.shopDeals = {};
  if (!Array.isArray(normalized.purchaseHistory)) normalized.purchaseHistory = [];
  if (!Array.isArray(normalized.webLoginLog)) normalized.webLoginLog = [];
  if (!normalized.automodRules || typeof normalized.automodRules !== 'object') normalized.automodRules = {};
  if (!Array.isArray(normalized.productionChecks)) normalized.productionChecks = [];
  if (!normalized.tempVoiceRooms || typeof normalized.tempVoiceRooms !== 'object') normalized.tempVoiceRooms = {};
  if (!normalized.tempVoiceSettings || typeof normalized.tempVoiceSettings !== 'object') {
    normalized.tempVoiceSettings = {
      createChannelName: '➕・создать-комнату',
      roomNameTemplate: '🔊・комната {username}',
      defaultLimit: 0,
      deleteWhenEmpty: true
    };
  }
  if (typeof normalized.reminderCounter !== 'number') normalized.reminderCounter = Number(normalized.reminderCounter || 0);
  if (typeof normalized.suggestionCounter !== 'number') normalized.suggestionCounter = Number(normalized.suggestionCounter || 0);
  if (typeof normalized.pollCounter !== 'number') normalized.pollCounter = Number(normalized.pollCounter || 0);
  return normalized;
}

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function getSqlite() {
  if (process.env.DB_DRIVER === 'json') return null;
  if (sqlite) return sqlite;
  if (sqliteUnavailableReason) return null;

  ensureDataDir();

  try {
    const { DatabaseSync } = require('node:sqlite');
    sqlite = new DatabaseSync(sqlitePath);
    sqlite.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS users (
        discord_id TEXT PRIMARY KEY,
        username TEXT,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        messages INTEGER DEFAULT 0,
        coins INTEGER DEFAULT 0,
        reputation INTEGER DEFAULT 0,
        season_xp INTEGER DEFAULT 0,
        clan_id TEXT,
        last_xp_at TEXT,
        created_at TEXT,
        updated_at TEXT,
        data_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL
      );
    `);
    return sqlite;
  } catch (error) {
    sqliteUnavailableReason = error.message;
    console.warn('[DataStore] SQLite unavailable, fallback to JSON:', sqliteUnavailableReason);
    return null;
  }
}

function readJsonDatabase() {
  ensureDataDir();
  if (!fs.existsSync(jsonPath)) return clone(EMPTY_DB);
  try {
    const raw = fs.readFileSync(jsonPath, 'utf8');
    return mergeDefaults(JSON.parse(raw || '{}'));
  } catch (error) {
    console.error('JSON database read error:', error);
    return clone(EMPTY_DB);
  }
}

function writeJsonDatabase(db) {
  ensureDataDir();
  fs.writeFileSync(jsonPath, JSON.stringify(mergeDefaults(db), null, 2), 'utf8');
}

function syncUsersTable(db) {
  const database = getSqlite();
  if (!database) return;

  const stmt = database.prepare(`
    INSERT INTO users (
      discord_id, username, xp, level, messages, coins, reputation,
      season_xp, clan_id, last_xp_at, created_at, updated_at, data_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(discord_id) DO UPDATE SET
      username = excluded.username,
      xp = excluded.xp,
      level = excluded.level,
      messages = excluded.messages,
      coins = excluded.coins,
      reputation = excluded.reputation,
      season_xp = excluded.season_xp,
      clan_id = excluded.clan_id,
      last_xp_at = excluded.last_xp_at,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      data_json = excluded.data_json
  `);

  const users = Object.values(db.users || {});
  database.exec('BEGIN');
  try {
    for (const user of users) {
      stmt.run(
        user.discordId,
        user.username || 'Unknown',
        Number(user.xp || 0),
        Number(user.level || 1),
        Number(user.messages || 0),
        Number(user.coins || 0),
        Number(user.reputation || 0),
        Number(user.seasonXp || 0),
        user.clanId == null ? null : String(user.clanId),
        user.lastXpAt || null,
        user.createdAt || null,
        user.updatedAt || null,
        JSON.stringify(user)
      );
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function readSqliteDatabase() {
  const database = getSqlite();
  if (!database) return null;

  const row = database.prepare('SELECT value FROM app_state WHERE key = ?').get('main');

  if (row?.value) {
    try {
      return mergeDefaults(JSON.parse(row.value));
    } catch (error) {
      console.error('SQLite app_state parse error:', error);
    }
  }

  const migrated = readJsonDatabase();
  writeSqliteDatabase(migrated, 'auto_migrate_from_json');
  return migrated;
}

function writeSqliteDatabase(db, action = 'writeDatabase') {
  const database = getSqlite();
  if (!database) {
    writeJsonDatabase(db);
    return;
  }

  const normalized = mergeDefaults(db);
  const now = new Date().toISOString();
  const stmt = database.prepare(`
    INSERT INTO app_state (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);

  database.exec('BEGIN');
  try {
    stmt.run('main', JSON.stringify(normalized), now);
    database.prepare('INSERT INTO audit_log (action, details, created_at) VALUES (?, ?, ?)')
      .run(action, null, now);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  syncUsersTable(normalized);
}

function ensureDatabase() {
  ensureDataDir();
  const database = getSqlite();
  if (database) {
    const row = database.prepare('SELECT value FROM app_state WHERE key = ?').get('main');
    if (!row) writeSqliteDatabase(readJsonDatabase(), 'ensureDatabase');
    return;
  }
  if (!fs.existsSync(jsonPath)) writeJsonDatabase(clone(EMPTY_DB));
}

function readDatabase() {
  ensureDatabase();
  const sqliteDb = readSqliteDatabase();
  if (sqliteDb) return sqliteDb;
  return readJsonDatabase();
}

function writeDatabase(db) {
  ensureDatabase();
  const database = getSqlite();
  if (database) {
    writeSqliteDatabase(db);
    return;
  }
  writeJsonDatabase(db);
}

function exportDatabaseToJson(targetPath = jsonPath) {
  const db = readDatabase();
  fs.writeFileSync(targetPath, JSON.stringify(db, null, 2), 'utf8');
  return targetPath;
}

function getStorageInfo() {
  const database = getSqlite();
  return {
    driver: database ? 'sqlite' : 'json',
    sqlitePath,
    jsonPath,
    sqliteAvailable: Boolean(database),
    sqliteUnavailableReason
  };
}

function getDefaultUser(discordId, username) {
  const now = new Date().toISOString();

  return {
    discordId,
    username,
    xp: 0,
    level: 1,
    messages: 0,
    coins: 0,
    reputation: 0,
    achievements: [],
    badges: [],
    gameStats: { played: 0, wins: 0 },
    questStats: { completed: 0 },
    inventory: [],
    clanId: null,
    seasonXp: 0,
    profileCustomization: {
      title: 'Участник сервера',
      about: 'Описание профиля пока не заполнено.',
      color: 'blurple',
      background: 'dark',
      mainBadge: null,
      showBadges: true,
      showStats: true
    },
    activeBoosts: {},
    battlePassPremium: false,
    seasonRewardClaims: {},
    lastXpAt: null,
    createdAt: now,
    updatedAt: now
  };
}

function normalizeUser(user) {
  const normalized = { ...getDefaultUser(user.discordId, user.username), ...user };
  if (!Array.isArray(normalized.achievements)) normalized.achievements = [];
  if (!Array.isArray(normalized.badges)) normalized.badges = [];
  if (!normalized.gameStats) normalized.gameStats = { played: 0, wins: 0 };
  if (!normalized.questStats) normalized.questStats = { completed: 0 };
  if (!Array.isArray(normalized.inventory)) normalized.inventory = [];
  if (typeof normalized.seasonXp !== 'number') normalized.seasonXp = 0;
  if (!normalized.profileCustomization) normalized.profileCustomization = { title: 'Участник сервера', about: 'Описание профиля пока не заполнено.', color: 'blurple', background: 'dark', mainBadge: null, showBadges: true, showStats: true };
  if (!normalized.activeBoosts || typeof normalized.activeBoosts !== 'object') normalized.activeBoosts = {};
  if (typeof normalized.battlePassPremium !== 'boolean') normalized.battlePassPremium = false;
  if (!normalized.seasonRewardClaims || typeof normalized.seasonRewardClaims !== 'object') normalized.seasonRewardClaims = {};
  return normalized;
}

function getOrCreateUser(discordId, username) {
  const db = readDatabase();

  if (!db.users[discordId]) {
    db.users[discordId] = getDefaultUser(discordId, username);
    writeDatabase(db);
  } else {
    const before = JSON.stringify(db.users[discordId]);
    db.users[discordId] = normalizeUser(db.users[discordId]);
    if (username && db.users[discordId].username !== username) {
      db.users[discordId].username = username;
    }
    if (JSON.stringify(db.users[discordId]) !== before) {
      db.users[discordId].updatedAt = new Date().toISOString();
      writeDatabase(db);
    }
  }

  return db.users[discordId];
}

function updateUser(discordId, updater) {
  const db = readDatabase();
  const existingUser = normalizeUser(db.users[discordId] || getDefaultUser(discordId, 'Unknown'));
  const updatedUser = normalizeUser(updater(existingUser));

  updatedUser.updatedAt = new Date().toISOString();
  db.users[discordId] = updatedUser;
  writeDatabase(db);

  return updatedUser;
}

function getUsers() {
  const db = readDatabase();
  return Object.values(db.users || {}).map(normalizeUser);
}

module.exports = {
  readDatabase,
  writeDatabase,
  getOrCreateUser,
  updateUser,
  getUsers,
  exportDatabaseToJson,
  getStorageInfo
};
