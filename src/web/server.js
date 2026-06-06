const express = require('express');
const { ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { readDatabase, writeDatabase, getStorageInfo } = require('../services/dataStore');
const { sendGamePanelToMiniGames } = require('../services/gamePanel');
const { buildRolePanel } = require('../services/rolePanel');
const { sendModerationPanel } = require('../services/moderationPanel');
const { getSettings, setSetting, updateSettings } = require('../services/settingsService');
const { getSeason, seasonTop } = require('../services/seasonService');
const { getSeasonProgress, setBattlePassPremium } = require('../services/battlePassService');
const { createTournament, closeTournament, listTournaments, buildBracket } = require('../services/tournamentService');
const { createEvent } = require('../services/eventService');
const { updateApplicationStatus, notifyApplicant, buildApplicationPanel } = require('../services/applicationService');
const { buildSuggestionEmbed, buildSuggestionButtons, buildPollEmbed, buildPollButtons, createSuggestionsChannel } = require('../services/suggestionService');
const { updateNotificationSettings, createReminder, cancelReminder, runNotificationChecks, formatDiscordTime } = require('../services/notificationService');
const { removeWarning, updateAppealStatus } = require('../services/moderationService');
const { ensureCreateChannel, getActiveRooms, buildVoicePanel } = require('../services/tempVoiceService');
const { createBackup, listBackups, restoreBackup, deleteBackup, exportData, cleanupOldExports } = require('../services/backupService');
const { buildHealthReport, formatHealthLines } = require('../services/healthCheckService');
const { buildMainMenuPayload } = require('../services/userMenuService');
const { SETTINGS_DESCRIPTIONS } = require('../services/settingsService');
const { listAudit, addAudit } = require('../services/auditService');
const { getMaintenance, setMaintenance } = require('../services/maintenanceService');
const { docsHtml } = require('../services/docsService');
const { buildHostingReadiness } = require('../services/hostingCheckService');
const { buildNetworkReport } = require('../services/networkCheckService');
const { CHANNELS, ROLES, DEFAULTS } = require('../config/serverConfig');
const { getAccessMatrixRows, getMemberLevel, getLevelLabel } = require('../services/accessControlService');
const { buildShopPanel } = require('../services/shopPanel');
const { buildPublicCommandsPanel, buildModerationCommandsPanel, commandsHtml } = require('../services/commandReferenceService');
const { buildModuleStatus, setModuleEnabled } = require('../services/moduleService');
const { listChannelRules, setChannelRule } = require('../services/channelRulesService');
const { buildProductionReport } = require('../services/productionCheckService');
const { getEconomyHistory, getTicketTemplates, getPanelRegistry, registerPanelPublish, getRoleUsage, getDailyDeal } = require('../services/managementUxService');

const started = { value: false };
const loginAttempts = new Map();
const PANEL_LOGIN_LIMIT = Number(process.env.WEB_LOGIN_LIMIT || 5);
const PANEL_LOCK_MINUTES = Number(process.env.WEB_LOGIN_LOCK_MINUTES || 10);

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
function parseCookies(header = '') {
  return header.split(';').reduce((acc, item) => {
    const [key, ...rest] = item.trim().split('=');
    if (key) acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}
function getPanelConfig() {
  return {
    enabled: String(process.env.WEB_PANEL_ENABLED || 'true').toLowerCase() !== 'false',
    port: Number(process.env.PORT || process.env.WEB_PORT || 3000),
    password: process.env.WEB_PASSWORD || 'admin',
    token: process.env.WEB_SESSION_TOKEN || process.env.WEB_PASSWORD || 'admin',
  };
}
function isAuthed(req, config) {
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies.servercore_session === config.token;
}
function requireAuth(config) {
  return (req, res, next) => isAuthed(req, config) ? next() : res.redirect('/login');
}
function getGuild(client) {
  return client.guilds.cache.get(process.env.GUILD_ID) || client.guilds.cache.first();
}
function getTextChannels(guild) {
  return guild?.channels.cache
    .filter(channel => channel.type === ChannelType.GuildText)
    .sort((a, b) => a.position - b.position)
    .map(channel => ({ id: channel.id, name: channel.name })) || [];
}
function getChannelOptions(guild, selected = '') {
  return getTextChannels(guild).map(channel => `<option value="${channel.id}" ${channel.id === selected ? 'selected' : ''}>${escapeHtml(channel.name)}</option>`).join('');
}
function getMemberOptions(guild, selected = '') {
  return guild?.members.cache
    .filter(member => !member.user.bot)
    .sort((a, b) => a.user.username.localeCompare(b.user.username))
    .map(member => `<option value="${member.id}" ${member.id === selected ? 'selected' : ''}>${escapeHtml(member.user.username)}</option>`).join('') || '';
}
function getStats(client) {
  const guild = getGuild(client);
  const db = readDatabase();
  const users = Object.values(db.users || {});
  const openTickets = Object.values(db.tickets || {}).filter(ticket => ticket.status === 'open');
  const openEvents = Object.values(db.events || {}).filter(event => event.status === 'open');
  const activeWarnings = (db.warnings || []).filter(item => item.active !== false);
  const topUsers = users
    .filter(user => user.discordId !== client.user.id)
    .sort((a, b) => (b.level - a.level) || (b.xp - a.xp) || (b.coins - a.coins))
    .slice(0, 10);
  return { guild, db, users, topUsers, openTickets, openEvents, activeWarnings, textChannels: getTextChannels(guild) };
}
function layout(title, body, message = '', warning = '') {
  const navGroups = [
    { title: 'Главное', icon: '🏠', links: [['/', 'Дашборд'], ['/quick-actions', 'Быстрые действия'], ['/modules', 'Модули'], ['/panels', 'Панели Discord'], ['/project', 'Проект'], ['/health', 'Health'], ['/network', 'Сеть'], ['/docs', 'Документация']] },
    { title: 'Пользователи', icon: '👥', links: [['/users', 'Участники'], ['/profiles', 'Профили'], ['/economy', 'Экономика'], ['/economy-history', 'История экономики'], ['/shop-admin', 'Магазин'], ['/shop-deals', 'Скидки']] },
    { title: 'Активности', icon: '🎮', links: [['/onboarding', 'Онбординг'], ['/events', 'Ивенты'], ['/voice', 'Voice'], ['/suggestions-panel', 'Предложения'], ['/notifications', 'Уведомления'], ['/clans', 'Кланы'], ['/applications', 'Заявки'], ['/tournaments', 'Турниры'], ['/season', 'Сезон']] },
    { title: 'Модерация', icon: '🛡️', links: [['/tickets', 'Тикеты'], ['/ticket-templates', 'Шаблоны тикетов'], ['/moderation', 'Модерация'], ['/channel-rules', 'Правила каналов'], ['/access', 'Доступ и роли'], ['/automod', 'AutoMod'], ['/logs', 'Логи'], ['/audit', 'Audit']] },
    { title: 'Система', icon: '⚙️', links: [['/settings', 'Настройки'], ['/panel-center', 'Центр панелей'], ['/roles', 'Роли'], ['/maintenance', 'Обслуживание'], ['/production', 'Production-check'], ['/hosting', 'Хостинг'], ['/backups', 'Бэкапы'], ['/integrations', 'Интеграции'], ['/commands', 'Команды']] },
  ];
  const nav = navGroups.map(group => `<details class="nav-group" open><summary>${group.icon} ${group.title}</summary>${group.links.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}</details>`).join('');
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${escapeHtml(title)}</title>
<style>
:root{color-scheme:dark;--bg:#0f1117;--card:#171a23;--card2:#10131b;--line:#2b3040;--text:#f5f6fa;--muted:#aeb4c2;--accent:#5865f2;--green:#57f287;--red:#ed4245;--yellow:#fee75c;--purple:#b982ff;--sidebar:#0b0e15}*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif;background:linear-gradient(135deg,#0f1117,#111827);color:var(--text)}.app{display:grid;grid-template-columns:280px minmax(0,1fr);min-height:100vh}.sidebar{background:rgba(11,14,21,.98);border-right:1px solid var(--line);padding:18px 14px;position:sticky;top:0;height:100vh;overflow:auto}.brand{display:flex;gap:10px;align-items:center;margin-bottom:18px;padding:6px 8px}.brand-title{font-size:20px;font-weight:800}.brand-version{display:inline-block;margin-top:6px;border:1px solid rgba(88,101,242,.45);color:#cfd4ff;background:rgba(88,101,242,.12);border-radius:999px;padding:3px 8px;font-size:12px}.nav-group{margin:8px 0;border:1px solid var(--line);border-radius:14px;background:#0f131d;overflow:hidden}.nav-group summary{cursor:pointer;padding:10px 12px;font-weight:800;color:#f5f6fa;list-style:none}.nav-group summary::-webkit-details-marker{display:none}.nav-group a{display:block;color:var(--muted);text-decoration:none;padding:8px 14px;border-top:1px solid rgba(43,48,64,.65)}.nav-group a:hover{color:var(--text);background:rgba(88,101,242,.12)}.logout{display:block;margin:14px 4px 0;text-align:center;color:#ffb3b5;text-decoration:none;border:1px solid rgba(237,66,69,.35);border-radius:12px;padding:10px;background:rgba(237,66,69,.08)}.topbar{position:sticky;top:0;z-index:5;background:rgba(17,19,27,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);padding:18px 24px;display:flex;align-items:center;justify-content:space-between;gap:14px}.topbar h1{font-size:24px;margin:0}.top-actions{display:flex;gap:8px;align-items:center}.menu-toggle{display:none;background:#1f2433;border:1px solid var(--line);color:var(--text);border-radius:10px;padding:8px 10px;width:auto}.content{min-width:0}.content main{max-width:1380px;margin:0 auto;padding:24px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}.grid-2{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:16px}.hint{background:#10131b;border-left:3px solid var(--accent);padding:10px 12px;border-radius:10px;color:var(--muted);line-height:1.4;margin:8px 0}.status-ok,.badge-ok{color:#57f287}.status-warn,.badge-warn{color:#fee75c}.status-bad,.badge-bad{color:#ed4245}.status-pill{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:999px;padding:4px 9px;font-size:12px;background:#111827}.card{background:rgba(23,26,35,.94);border:1px solid var(--line);border-radius:16px;padding:18px;box-shadow:0 10px 30px rgba(0,0,0,.22)}.card h2,.card h3{margin-top:0}.stat{font-size:32px;font-weight:800}.muted{color:var(--muted);line-height:1.45}.small{font-size:13px}.ok{background:rgba(87,242,135,.12);border:1px solid rgba(87,242,135,.35);padding:12px;border-radius:12px;margin-bottom:16px}.warn{background:rgba(237,66,69,.12);border:1px solid rgba(237,66,69,.35);padding:12px;border-radius:12px;margin-bottom:16px}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{color:var(--muted);font-weight:600}button,input,select,textarea{border-radius:10px;border:1px solid var(--line);padding:10px 12px;background:#10131b;color:var(--text);width:100%}button{background:var(--accent);border:0;cursor:pointer;font-weight:700}button:hover{filter:brightness(1.08)}button.danger{background:var(--red)}button.green{background:#2da44e}button.gray{background:#313747}textarea{min-height:92px;resize:vertical}form{display:grid;gap:10px}.inline{display:flex;flex-wrap:wrap;gap:10px}.inline>*{flex:1;min-width:180px}.actions{display:flex;flex-wrap:wrap;gap:10px}.actions form{display:block}.actions button{width:auto}.pill{display:inline-block;border:1px solid var(--line);padding:4px 8px;border-radius:999px;color:var(--muted);font-size:12px;margin:2px}.toggle{display:grid;grid-template-columns:26px 1fr;gap:10px;align-items:start;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:12px}.toggle input{width:auto;margin-top:3px}.desc{color:var(--muted);font-size:13px;margin-top:4px;line-height:1.35}.section{margin-top:16px}.code{font-family:Consolas,monospace;background:#0b0d12;border:1px solid var(--line);border-radius:10px;padding:10px;white-space:pre-wrap}.tag{font-size:12px;background:#232839;border:1px solid var(--line);border-radius:999px;padding:4px 8px;color:#c7cce0}.mini-form{display:inline-grid;grid-template-columns:1fr auto;gap:8px;align-items:center}.mini-form input{min-width:80px}.mini-form button{width:auto}.danger-text{color:#ff9b9d}.success-text{color:#8ef0b2}.nowrap{white-space:nowrap}.wide{overflow:auto}.quick-card{transition:transform .15s ease,border-color .15s ease}.quick-card:hover{transform:translateY(-2px);border-color:rgba(88,101,242,.65)}.toolbar{display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:10px;align-items:end;margin:12px 0}.toolbar label{display:grid;gap:6px;color:var(--muted);font-size:13px}.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:14px}.tabs{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.tab{padding:8px 11px;border:1px solid var(--line);border-radius:999px;color:var(--muted);background:#10131b}.metric-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:12px 0}.metric{background:#10131b;border:1px solid var(--line);border-radius:14px;padding:12px}.metric b{font-size:22px}.timeline{display:grid;gap:10px}.timeline-item{border-left:3px solid var(--accent);background:#10131b;border-radius:10px;padding:10px 12px}.confirm-box{border:1px dashed rgba(237,66,69,.55);background:rgba(237,66,69,.08);border-radius:12px;padding:10px;margin-top:10px}.kbd{font-family:Consolas,monospace;background:#0b0d12;border:1px solid var(--line);border-radius:6px;padding:2px 6px}@media(max-width:920px){.app{display:block}.sidebar{position:fixed;left:-290px;top:0;bottom:0;width:280px;z-index:20;transition:left .2s ease}.sidebar.open{left:0}.menu-toggle{display:inline-block}.topbar{padding:14px}.content main{padding:16px}.grid-2{grid-template-columns:1fr}.actions button{width:100%}}@media(max-width:560px){.grid{grid-template-columns:1fr}.inline{display:grid}.topbar h1{font-size:19px}.stat{font-size:26px}}
</style></head><body><div class="app"><aside id="sidebar" class="sidebar"><div class="brand"><div style="font-size:28px">⚙️</div><div><div class="brand-title">ServerCore</div><span class="brand-version">v24.1 Stable</span></div></div>${nav}<a class="logout" href="/logout">Выйти</a></aside><div class="content"><div class="topbar"><button class="menu-toggle" onclick="document.getElementById('sidebar').classList.toggle('open')">☰ Меню</button><h1>${escapeHtml(title)}</h1><div class="top-actions"><span class="status-pill"><span class="badge-ok">●</span> Web Panel</span></div></div><main>${message ? `<div class="ok">${escapeHtml(message)}</div>` : ''}${warning ? `<div class="warn">${escapeHtml(warning)}</div>` : ''}${body}</main></div></div><script>
document.addEventListener('click',function(e){var el=e.target;if(el && el.matches('button.danger')){var text=el.getAttribute('data-confirm')||'Это опасное действие. Продолжить?';if(!confirm(text)){e.preventDefault();return false;}}});
</script></body></html>`;
}
function loginPage(error = '') {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"/><title>ServerCore Login</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1117;color:#f5f6fa;font-family:Arial,sans-serif}.box{width:min(420px,92vw);background:#171a23;border:1px solid #2b3040;border-radius:16px;padding:24px}input,button{width:100%;padding:12px;border-radius:10px;border:1px solid #2b3040;background:#10131b;color:#fff;margin-top:10px}button{background:#5865f2;border:0;font-weight:700}.err{color:#ff8588}</style></head><body><form class="box" method="post" action="/login"><h1>⚙️ ServerCore</h1><p>Введи пароль веб-панели.</p>${error ? `<p class="err">${escapeHtml(error)}</p>` : ''}<input type="password" name="password" placeholder="WEB_PASSWORD" autofocus/><button>Войти</button><p style="color:#aeb4c2;font-size:13px">Пароль задается в .env: WEB_PASSWORD=...<br/>Защита: лимит попыток входа и cookie-сессия на 8 часов.</p></form></body></html>`;
}
function renderUsersTable(users, withActions = false) {
  const rows = users.map((user, index) => `<tr><td>${index + 1}</td><td><b>${escapeHtml(user.username)}</b><div class="small muted">${escapeHtml(user.discordId)}</div></td><td>${user.level || 1}</td><td>${user.xp || 0}</td><td>${user.coins || 0}</td><td>${user.reputation || 0}</td><td>${user.messages || 0}</td>${withActions ? `<td class="nowrap"><a class="pill" href="/user/${encodeURIComponent(user.discordId)}">Открыть</a></td>` : ''}</tr>`).join('');
  return `<table><tr><th>#</th><th>Ник</th><th>Уровень</th><th>XP</th><th>Монеты</th><th>Репутация</th><th>Сообщения</th>${withActions ? '<th>Действие</th>' : ''}</tr>${rows || `<tr><td colspan="${withActions ? 8 : 7}">Данных пока нет.</td></tr>`}</table>`;
}

function renderShopTable(items = []) {
  const rows = (items || []).map(item => {
    const price = Number(item.price ?? item.cost ?? 0);
    const category = item.category || item.type || 'other';
    const enabled = item.enabled === false ? 'Отключен' : 'Включен';
    const role = item.roleName || item.role || item.roleId || '—';
    const description = item.description || item.desc || '';
    return `<tr><td><b>${escapeHtml(item.name || item.id || 'Товар')}</b><div class="small muted">${escapeHtml(item.id || '')}</div></td><td>${escapeHtml(category)}</td><td>${price}</td><td>${escapeHtml(role)}</td><td>${escapeHtml(enabled)}</td><td>${escapeHtml(description)}</td></tr>`;
  }).join('');
  return `<div class="table-wrap"><table><tr><th>Товар</th><th>Категория</th><th>Цена</th><th>Роль/предмет</th><th>Статус</th><th>Описание</th></tr>${rows || '<tr><td colspan="6">Товары магазина пока не найдены.</td></tr>'}</table></div>`;
}

function queryValue(req, key, fallback = '') { return String((req.query && req.query[key]) || fallback); }
function statusBadge(status) {
  const s = String(status || 'unknown').toLowerCase();
  const cls = ['open','active','ok','enabled','accepted','online'].includes(s) ? 'badge-ok' : ['closed','disabled','denied','cancelled','error','bad'].includes(s) ? 'badge-bad' : 'badge-warn';
  return `<span class="status-pill"><span class="${cls}">●</span>${escapeHtml(status || 'unknown')}</span>`;
}
function paginate(items, req, perPage = 20) {
  const page = Math.max(Number(req.query.page || 1), 1);
  const pages = Math.max(Math.ceil(items.length / perPage), 1);
  const start = (page - 1) * perPage;
  return { page, pages, items: items.slice(start, start + perPage), total: items.length };
}
function pager(base, req, page, pages) {
  const params = new URLSearchParams(req.query || {});
  const mk = (p, label) => { params.set('page', String(p)); return `<a class="pill" href="${base}?${params.toString()}">${label}</a>`; };
  return `<div class="actions" style="margin-top:12px">${page > 1 ? mk(page-1, '← Назад') : ''}<span class="pill">Страница ${page} / ${pages}</span>${page < pages ? mk(page+1, 'Вперед →') : ''}</div>`;
}
function tableToolbar(action, req, sortOptions = [], filterOptions = []) {
  const sort = queryValue(req, 'sort', sortOptions[0]?.[0] || '');
  const filter = queryValue(req, 'filter', filterOptions[0]?.[0] || 'all');
  return `<form class="toolbar" method="get" action="${action}"><label>Поиск<input name="q" value="${escapeHtml(queryValue(req,'q'))}" placeholder="Ник, ID, название, причина"/></label><label>Сортировка<select name="sort">${sortOptions.map(([v,l])=>`<option value="${escapeHtml(v)}" ${v===sort?'selected':''}>${escapeHtml(l)}</option>`).join('')}</select></label><label>Фильтр<select name="filter">${filterOptions.map(([v,l])=>`<option value="${escapeHtml(v)}" ${v===filter?'selected':''}>${escapeHtml(l)}</option>`).join('')}</select></label><button>Применить</button></form>`;
}
function containsText(value, q) { return String(value || '').toLowerCase().includes(String(q || '').toLowerCase()); }
function getUserRelatedData(db, userId) {
  return {
    warnings: (db.warnings || []).filter(x => x.userId === userId),
    activeWarnings: (db.warnings || []).filter(x => x.userId === userId && x.active !== false),
    tickets: Object.values(db.tickets || {}).filter(x => x.userId === userId || x.authorId === userId),
    applications: Object.values(db.applications || {}).filter(x => x.userId === userId || x.authorId === userId),
    events: Object.values(db.events || {}).filter(x => Array.isArray(x.participants) && x.participants.includes(userId)),
    cases: (db.moderationCases || db.cases || []).filter(x => x.userId === userId || x.targetId === userId),
    audits: (db.audit || db.auditLog || []).filter(x => String(x.userId || x.targetId || x.actorId || '').includes(userId)).slice(-10).reverse()
  };
}
function dangerConfirmFields(label = 'Подтвердить') {
  return `<div class="confirm-box"><label class="small muted">Подтверждение опасного действия<input name="confirm" placeholder="Введите ${label}"/></label><div class="small muted">Опасные действия выполняются только при явном подтверждении.</div></div>`;
}

function commandsPage() {
  const groups = [
    ['Основные', ['/ping','/help','/roles','/profile','/profilecard','/profilecustomize','/cosmetics','/rank','/top','/dbstatus']],
    ['Экономика', ['/daily','/balance','/balance-history','/shop','/buy','/gift','/inventory']],
    ['Сообщество', ['/rep','/reputation','/achievements','/badges','/clan']],
    ['Поддержка и модерация', ['/ticket','/close','/warn','/warnremove','/warnings','/cases','/case','/note','/appeal','/clear','/mute','/unmute','/kick','/ban','/modpanel']],
    ['Игры и активность', ['/game','/gamepanel','/quest','/event','/tournament','/season','/lfg','/voice']],
    ['Администрирование', ['/settings','/automod','/apply','/applications','/application','/integration','/hosting-check','/maintenance','/backup','/export']]
  ];
  return groups.map(([name, cmds]) => `<div class="card"><h3>${escapeHtml(name)}</h3>${cmds.map(c => `<span class="pill">${c}</span>`).join('')}</div>`).join('');
}
async function safeSend(channel, payload) { try { if (channel) await channel.send(payload); return true; } catch (e) { console.error(e); return false; } }
function findTextChannelByName(guild, name) { return guild?.channels.cache.find(ch => ch.name === name && ch.type === ChannelType.GuildText) || null; }
function parseBoolForm(value) { return value === 'on' || value === 'true' || value === '1'; }
function asInt(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? Math.trunc(n) : fallback; }
function redirect(path, message) { return `${path}?message=${encodeURIComponent(message)}`; }
function getShopItemsFromDb() {
  const db = readDatabase();
  const defaultItems = [
    { id: 'vip', name: '💎 VIP', description: 'Выдает роль 💎 VIP.', price: 1000, type: 'role', category: 'roles', roleName: '💎 VIP', enabled: true },
    { id: 'active', name: '🔥 Active', description: 'Выдает роль 🔥 Active.', price: 500, type: 'role', category: 'roles', roleName: '🔥 Active', enabled: true },
    { id: 'creator', name: '🎨 Creator', description: 'Выдает роль 🎨 Creator.', price: 300, type: 'role', category: 'roles', roleName: '🎨 Creator', enabled: true },
    { id: 'profile_color_gold', name: '🟡 Цвет профиля: Gold', description: 'Открывает золотой цвет для /profilecard.', price: 250, type: 'cosmetic', category: 'cosmetics', roleName: '', cosmeticType: 'color', value: 'gold', enabled: true },
    { id: 'profile_color_purple', name: '🟣 Цвет профиля: Purple', description: 'Открывает фиолетовый цвет для /profilecard.', price: 250, type: 'cosmetic', category: 'cosmetics', roleName: '', cosmeticType: 'color', value: 'purple', enabled: true },
    { id: 'profile_bg_neon', name: '🌌 Фон профиля: Neon Grid', description: 'Открывает неоновый фон для /profilecard.', price: 400, type: 'cosmetic', category: 'cosmetics', roleName: '', cosmeticType: 'background', value: 'neon', enabled: true },
    { id: 'profile_bg_ocean', name: '🌊 Фон профиля: Ocean', description: 'Открывает океанский фон для /profilecard.', price: 400, type: 'cosmetic', category: 'cosmetics', roleName: '', cosmeticType: 'background', value: 'ocean', enabled: true },
    { id: 'xp_boost_24h', name: '⚡ XP Boost x2 на 24 часа', description: 'Удваивает получаемый XP на 24 часа после /use.', price: 700, type: 'boost', category: 'boosts', boostType: 'xp', multiplier: 2, durationHours: 24, enabled: true },
    { id: 'coin_boost_24h', name: '🪙 Coin Boost x2 на 24 часа', description: 'Удваивает daily-монеты на 24 часа после /use.', price: 700, type: 'boost', category: 'boosts', boostType: 'coins', multiplier: 2, durationHours: 24, enabled: true },
    { id: 'raffle_ticket', name: '🎟 Билет розыгрыша', description: 'Предмет для ручных розыгрышей администрации.', price: 300, type: 'ticket', category: 'tickets', enabled: true },
    { id: 'custom_role_request', name: '📝 Заявка на кастомную роль', description: 'После /use создай тикет и укажи желаемую роль.', price: 1500, type: 'custom', category: 'special', enabled: true }
  ];  if (!Array.isArray(db.shopItems) || db.shopItems.length === 0) return defaultItems;
  return db.shopItems;
}
function saveShopItems(items) {
  const db = readDatabase();
  db.shopItems = items;
  writeDatabase(db);
}
function renderAutomodLogs() {
  const logs = (readDatabase().automodLogs || []).slice(-40).reverse();
  const rows = logs.map(log => `<tr><td>#${log.id}</td><td>${escapeHtml(log.username)}</td><td>${escapeHtml(log.channelName)}</td><td>${escapeHtml((log.reasons || []).join(', '))}</td><td>${escapeHtml(log.content || '')}</td><td>${escapeHtml(log.createdAt || '')}</td></tr>`).join('');
  return `<table><tr><th>ID</th><th>Участник</th><th>Канал</th><th>Причина</th><th>Текст</th><th>Дата</th></tr>${rows || '<tr><td colspan="6">Срабатываний пока нет.</td></tr>'}</table>`;
}

function startWebPanel(client) {
  const config = getPanelConfig();
  if (!config.enabled || started.value) return;
  started.value = true;
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  app.get('/login', (req, res) => res.send(loginPage()));
  app.post('/login', (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || 'local';
    const rec = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
    if (rec.lockedUntil && Date.now() < rec.lockedUntil) {
      const left = Math.ceil((rec.lockedUntil - Date.now()) / 60000);
      return res.status(429).send(loginPage(`Слишком много попыток. Повтори через ${left} мин.`));
    }
    if (req.body.password !== config.password) {
      rec.count += 1;
      if (rec.count >= PANEL_LOGIN_LIMIT) { rec.lockedUntil = Date.now() + PANEL_LOCK_MINUTES * 60000; rec.count = 0; }
      loginAttempts.set(ip, rec);
      addAudit('web_login_failed', { name: ip }, { count: rec.count, source: 'web' });
      return res.status(401).send(loginPage('Неверный пароль'));
    }
    loginAttempts.delete(ip);
    addAudit('web_login_success', { name: ip }, { source: 'web' });
    res.setHeader('Set-Cookie', `servercore_session=${encodeURIComponent(config.token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`);
    res.redirect('/');
  });
  app.get('/logout', (req, res) => { res.setHeader('Set-Cookie', 'servercore_session=; Max-Age=0; Path=/'); res.redirect('/login'); });
  app.use(requireAuth(config));

  app.get('/', (req, res) => {
    const stats = getStats(client); const guild = stats.guild; const storage = getStorageInfo();
    const backups = listBackups();
    const modules = buildModuleStatus(client);
    const music = modules.find(m => m.key === 'music');
    const moduleBadges = modules.slice(0, 12).map(m => `<span class="status-pill"><span class="${m.state === 'ok' ? 'badge-ok' : m.state === 'warn' ? 'badge-warn' : 'badge-bad'}">●</span>${escapeHtml(m.label)}</span>`).join(' ');
    const body = `<div class="grid"><div class="card"><div class="muted">Сервер</div><div class="stat">${escapeHtml(guild?.name || 'Не найден')}</div><p class="muted">Бот: ${escapeHtml(client.user?.tag || 'online')}</p></div><div class="card"><div class="muted">Участников в базе</div><div class="stat">${stats.users.length}</div></div><div class="card"><div class="muted">Открытых тикетов</div><div class="stat">${stats.openTickets.length}</div></div><div class="card"><div class="muted">Активных ивентов</div><div class="stat">${stats.openEvents.length}</div></div><div class="card"><div class="muted">Последний backup</div><div class="stat">${backups[0] ? 'OK' : '—'}</div><div class="small muted">${backups[0] ? escapeHtml(backups[0].name) : 'Создай первый backup'}</div></div><div class="card"><div class="muted">База данных</div><div class="stat">${escapeHtml(storage.driver)}</div><div class="small muted">${escapeHtml(storage.sqlitePath || storage.jsonPath)}</div></div></div>
    <div class="grid-2 section"><div class="card"><h2>🧩 Модули</h2><p class="muted">Состояние основных систем ServerCore.</p><div class="tabs">${moduleBadges}</div><p><a class="pill" href="/modules">Управлять модулями</a><a class="pill" href="/production">Production-check</a></p></div><div class="card"><h2>🎵 Музыка</h2><p class="muted">Статус: ${music?.enabled ? 'включена' : 'отключена'}.</p><p class="muted">${escapeHtml(music?.hint || '')}</p><p><a class="pill" href="/modules">Настроить</a><a class="pill" href="/channel-rules">Правила каналов</a></p></div></div>
    <div class="card section"><h2>⚡ Быстрые панели</h2><div class="actions"><form method="post" action="/actions/game-panel"><button>🎲 Панель мини-игр</button></form><form method="post" action="/actions/mod-panel"><button>🧰 Панель модерации</button></form><form method="post" action="/actions/role-panel"><button>✅ Панель ролей</button></form><form method="post" action="/actions/voice-setup"><button>🔊 Канал voice-комнат</button></form><form method="post" action="/actions/backup-create"><input type="hidden" name="name" value="dashboard-manual"/><button>💾 Создать backup</button></form></div></div>
    <div class="card section"><h2>🏆 Топ участников</h2>${renderUsersTable(stats.topUsers, true)}</div>`;
    res.send(layout('ServerCore Dashboard', body, req.query.message));
  });


  app.get('/modules', (req, res) => {
    const modules = buildModuleStatus(client);
    const rows = modules.map(m => `<tr><td>${m.icon} <b>${escapeHtml(m.label)}</b><div class="small muted">${escapeHtml(m.description)}</div></td><td>${m.enabled ? '<span class="status-ok">✅ включен</span>' : '<span class="status-warn">⚠️ выключен</span>'}</td><td>${escapeHtml(m.hint || '')}</td><td><form method="post" action="/actions/module-toggle"><input type="hidden" name="key" value="${escapeHtml(m.key)}"/><input type="hidden" name="enabled" value="${m.enabled ? 'false' : 'true'}"/><button class="${m.enabled ? 'gray' : 'green'}">${m.enabled ? 'Выключить' : 'Включить'}</button></form></td></tr>`).join('');
    const body = `<div class="card"><h2>🧩 Модули ServerCore</h2><p class="muted">Здесь можно безопасно отключать функции, которые не поддерживаются текущим хостингом. Например, если Discord Voice/UDP недоступен, отключи музыку через <code>MUSIC_ENABLED=false</code> или кнопку ниже.</p></div><div class="card section wide"><table><tr><th>Модуль</th><th>Статус</th><th>Подсказка</th><th>Действие</th></tr>${rows}</table></div>`;
    res.send(layout('Модули', body, req.query.message, req.query.warning));
  });

  app.post('/actions/module-toggle', (req, res) => {
    setModuleEnabled(String(req.body.key || ''), String(req.body.enabled) === 'true');
    addAudit('module_toggle_web', { username: 'web-panel', id: 'web' }, { key: req.body.key, enabled: req.body.enabled });
    res.redirect(redirect('/modules', 'Настройка модуля сохранена. Для некоторых модулей нужен redeploy/restart.'));
  });

  app.get('/channel-rules', (req, res) => {
    const rules = listChannelRules();
    const rows = rules.map(rule => `<tr><td><b>${escapeHtml(rule.name)}</b></td><td>${escapeHtml(rule.mode)}</td><td>${rule.deleteMessages ? '✅' : '—'}</td><td>${rule.allowLinks ? '✅' : '❌'}</td><td>${rule.allowAttachments ? '✅' : '❌'}</td><td><form method="post" action="/actions/channel-rule"><input type="hidden" name="name" value="${escapeHtml(rule.name)}"/><select name="mode"><option value="free" ${rule.mode==='free'?'selected':''}>Свободный</option><option value="panel_only" ${rule.mode==='panel_only'?'selected':''}>Только панели/бот</option><option value="commands_only" ${rule.mode==='commands_only'?'selected':''}>Только команды</option><option value="music_only" ${rule.mode==='music_only'?'selected':''}>Только музыка</option></select><label class="toggle"><input type="checkbox" name="deleteMessages" ${rule.deleteMessages?'checked':''}/><span>Удалять сообщения</span></label><label class="toggle"><input type="checkbox" name="allowLinks" ${rule.allowLinks?'checked':''}/><span>Разрешить ссылки</span></label><label class="toggle"><input type="checkbox" name="allowAttachments" ${rule.allowAttachments?'checked':''}/><span>Разрешить вложения</span></label><label class="toggle"><input type="checkbox" name="warnUser" ${rule.warnUser?'checked':''}/><span>Предупреждать пользователя</span></label><button>Сохранить</button></form></td></tr>`).join('');
    const body = `<div class="card"><h2>🧹 Правила каналов</h2><p class="muted">Настрой, где пользователи могут писать свободно, а где канал должен оставаться только для панелей, команд или музыки. Модераторы и админы обходят автоудаление.</p></div><div class="card section wide"><table><tr><th>Канал</th><th>Режим</th><th>Удаление</th><th>Ссылки</th><th>Вложения</th><th>Настройка</th></tr>${rows}</table></div>`;
    res.send(layout('Правила каналов', body, req.query.message));
  });

  app.post('/actions/channel-rule', (req, res) => {
    setChannelRule(String(req.body.name || ''), {
      mode: String(req.body.mode || 'free'),
      deleteMessages: Boolean(req.body.deleteMessages),
      allowLinks: Boolean(req.body.allowLinks),
      allowAttachments: Boolean(req.body.allowAttachments),
      warnUser: Boolean(req.body.warnUser),
    });
    addAudit('channel_rule_update_web', { username: 'web-panel', id: 'web' }, { name: req.body.name, mode: req.body.mode });
    res.redirect(redirect('/channel-rules', 'Правило канала сохранено.'));
  });

  app.get('/production', async (req, res) => {
    const report = await buildProductionReport(client).catch(error => ({ checks: [{ ok: false, label: 'Production-check не выполнен', hint: error.message }], okCount: 0, total: 1, storage: {}, backups: 0 }));
    const rows = report.checks.map(c => `<tr><td>${c.ok ? '<span class="status-ok">✅ OK</span>' : '<span class="status-warn">⚠️ Проверить</span>'}</td><td>${escapeHtml(c.label)}</td><td>${escapeHtml(c.hint || '')}</td></tr>`).join('');
    const body = `<div class="grid"><div class="card"><h2>🚀 Production-check</h2><div class="stat">${report.okCount}/${report.total}</div><p class="muted">Финальная проверка после обновлений и redeploy.</p></div><div class="card"><h2>💾 База</h2><p><b>Драйвер:</b> ${escapeHtml(report.storage?.driver || 'unknown')}</p><p><b>Backup:</b> ${Number(report.backups || 0)}</p></div><div class="card"><h2>Команда Discord</h2><p class="code">/production-check</p></div></div><div class="card section wide"><h2>Проверки</h2><table><tr><th>Статус</th><th>Пункт</th><th>Подсказка</th></tr>${rows}</table></div>`;
    res.send(layout('Production-check', body, req.query.message));
  });

  app.get('/access', (req, res) => {
    const guild = getGuild(client);
    const roles = guild?.roles.cache.sort((a, b) => b.position - a.position).map(role => role).filter(role => role.name !== '@everyone') || [];
    const botMember = guild?.members.me;
    const matrixRows = getAccessMatrixRows().map(row => `<tr><td>${escapeHtml(row[0])}</td><td><span class="status ok">${escapeHtml(row[1])}</span></td></tr>`).join('');
    const roleRows = roles.map(role => {
      const manageable = botMember ? botMember.roles.highest.comparePositionTo(role) > 0 : false;
      return `<tr><td>${escapeHtml(role.name)}</td><td>${role.members.size}</td><td>${role.position}</td><td>${manageable ? '<span class="status ok">можно выдавать</span>' : '<span class="status warn">выше/равна роли бота</span>'}</td></tr>`;
    }).join('');
    const body = `<div class="card"><h2>🛡 Доступ и роли</h2><p class="muted">Матрица доступа показывает, какие уровни могут использовать группы функций. Проверка применяется к slash-командам, context-menu и важным кнопкам.</p></div>
    <div class="grid-2 section"><div class="card"><h2>Матрица доступа</h2><table><tr><th>Функции</th><th>Минимальный доступ</th></tr>${matrixRows}</table></div><div class="card"><h2>Роли доступа</h2><p><b>Owner:</b> 👑 Owner или владелец/Administrator</p><p><b>Admin:</b> 🛡 Admin или Manage Server</p><p><b>Moderator:</b> 👮 Moderator или Moderate Members/Manage Messages</p><p><b>Helper:</b> 🧰 Helper</p><p><b>VIP:</b> 💎 VIP</p></div></div>
    <div class="card section"><h2>Проверка иерархии ролей</h2><p class="muted">Если бот должен выдавать роль, роль бота должна быть выше этой роли.</p><table><tr><th>Роль</th><th>Участников</th><th>Позиция</th><th>Статус для бота</th></tr>${roleRows || '<tr><td colspan="4">Роли не найдены.</td></tr>'}</table></div>`;
    res.send(layout('Доступ и роли', body, req.query.message, req.query.warning));
  });

  app.get('/quick-actions', (req, res) => {
    const guild = getGuild(client);
    const body = `<div class="card"><h2>⚡ Быстрые действия</h2><p class="muted">Здесь собраны частые операции администратора. Опасные действия требуют подтверждения.</p></div>
    <div class="grid section">
      <div class="card quick-card"><h3>✅ Панель ролей</h3><p class="muted">Отправить выбор ролей в канал получения ролей.</p><form method="post" action="/actions/role-panel"><button>Опубликовать</button></form></div>
      <div class="card quick-card"><h3>🎲 Панель мини-игр</h3><p class="muted">Отправить игровую панель в канал мини-игр.</p><form method="post" action="/actions/game-panel"><button>Опубликовать</button></form></div>
      <div class="card quick-card"><h3>🧰 Панель модерации</h3><p class="muted">Отправить модераторскую панель в закрытый канал.</p><form method="post" action="/actions/mod-panel"><button>Опубликовать</button></form></div>
      <div class="card quick-card"><h3>🔊 Voice-комнаты</h3><p class="muted">Создать или проверить канал ➕・создать-комнату.</p><form method="post" action="/actions/voice-setup"><button>Проверить</button></form></div>
      <div class="card quick-card"><h3>💾 Бэкап</h3><p class="muted">Создать ручную резервную копию базы перед изменениями.</p><form method="post" action="/actions/backup-create"><input name="name" value="manual-web"/><button>Создать backup</button></form></div>
      <div class="card quick-card"><h3>🩺 Health</h3><p class="muted">Открыть проверку состояния проекта, каналов, базы и настроек.</p><p><a class="pill" href="/health">Открыть Health</a> <a class="pill" href="/hosting">Хостинг</a> <a class="pill" href="/network">Сеть</a></p></div>
      <div class="card quick-card"><h3>📢 Сообщение в канал</h3><form method="post" action="/actions/send-message"><input type="hidden" name="redirect" value="/quick-actions"/><select name="channelId">${getChannelOptions(guild)}</select><textarea name="message" placeholder="Текст сообщения"></textarea><button>Отправить</button></form></div>
      <div class="card quick-card"><h3>🔧 Обслуживание</h3><p class="muted">Временно отключить обычные команды во время работ.</p><p><a class="pill" href="/maintenance">Открыть обслуживание</a></p></div>
    </div>`;
    res.send(layout('Быстрые действия', body, req.query.message, req.query.warning));
  });


  app.get('/panels', (req, res) => {
    const guild = getGuild(client);
    const body = `<div class="card"><h2>📌 Мастер публикации Discord-панелей</h2><p class="muted">Выбери тип панели, канал и нажми “Опубликовать”. Это удобно после переезда на новый сервер или если сообщение панели удалили.</p></div><div class="grid-2 section"><div class="card"><h2>Опубликовать панель</h2><form method="post" action="/actions/publish-panel"><label>Тип панели<select name="type"><option value="main">🧭 Главное меню</option><option value="roles">✅ Панель ролей</option><option value="games">🎲 Мини-игры</option><option value="moderation">🧰 Модерация</option><option value="applications">📨 Заявки</option><option value="tickets">🎫 Поддержка / тикеты</option><option value="voice">🔊 Voice-комнаты</option><option value="shop">🛒 Магазин</option><option value="commands">📚 Все команды</option><option value="modcommands">📘 Команды модерации</option></select></label><label>Канал<select name="channelId">${getChannelOptions(guild)}</select></label><button>Опубликовать</button></form></div><div class="card"><h2>Подсказка</h2><p class="muted">Рекомендуемые каналы: главное меню → 🧭・навигация, роли → ✅・получить-роли, мини-игры → 🎲・мини-игры, модерация → 🧰・панель-модерации, заявки → 📨・заявки.</p><p><a class="pill" href="/quick-actions">Быстрые действия</a><a class="pill" href="/settings">Настройки каналов</a></p></div></div>`;
    res.send(layout('Панели Discord', body, req.query.message, req.query.warning));
  });

  app.get('/commands', (req, res) => {
    const body = `<div class="card"><h2>📚 Справочник команд</h2><p class="muted">Описание всех команд сгруппировано по разделам. Для обычных пользователей рекомендуйте <code>/menu open</code>, а для модерации — канал <code>📘・команды-модерации</code>.</p></div>${commandsHtml()}`;
    res.send(layout('Команды', body));
  });


  app.get('/economy-history', (req, res) => {
    const rows = getEconomyHistory(null, 200);
    const q = queryValue(req, 'q').toLowerCase();
    let filtered = rows;
    if (q) filtered = filtered.filter(r => containsText(r.username, q) || containsText(r.userId, q) || containsText(r.type, q) || containsText(r.meta?.itemName, q));
    const pg = paginate(filtered, req, 30);
    const toolbar = tableToolbar('/economy-history', req, [['date','Дата']], [['all','Все']]);
    const bodyRows = pg.items.map(r => `<tr><td>${escapeHtml(r.createdAt || '')}</td><td><b>${escapeHtml(r.username || r.userId)}</b><div class="small muted">${escapeHtml(r.userId)}</div></td><td>${escapeHtml(r.type)}</td><td>${Number(r.amount || 0) >= 0 ? '+' : ''}${Number(r.amount || 0)}</td><td>${escapeHtml(r.meta?.itemName || JSON.stringify(r.meta || {}))}</td></tr>`).join('');
    const body = `<div class="card"><h2>📜 История экономики</h2><p class="muted">Журнал daily, покупок и будущих операций экономики. В Discord доступно через <code>/balance-history</code>.</p>${toolbar}<div class="table-wrap"><table><tr><th>Дата</th><th>Участник</th><th>Тип</th><th>Сумма</th><th>Детали</th></tr>${bodyRows || '<tr><td colspan="5">История пока пустая.</td></tr>'}</table></div>${pager('/economy-history', req, pg.page, pg.pages)}</div>`;
    res.send(layout('История экономики', body, req.query.message));
  });

  app.get('/shop-deals', (req, res) => {
    const items = getShopItemsFromDb();
    const deal = getDailyDeal(items);
    const item = deal ? items.find(i => i.id === deal.itemId) : null;
    const body = `<div class="grid"><div class="card"><h2>🔥 Товар дня</h2>${item ? `<p><b>${escapeHtml(item.name)}</b></p><p class="muted">Скидка ${deal.discountPercent}% действует сегодня. Показывается в кнопочной витрине магазина.</p><p class="code">${escapeHtml(item.id)}</p>` : '<p class="muted">Товар дня отключен или товаров нет.</p>'}</div><div class="card"><h2>Настройки</h2><p class="muted">Через переменные окружения:</p><p class="code">SHOP_DAILY_DEAL_ENABLED=true\nSHOP_DAILY_DEAL_DISCOUNT=20</p></div></div><div class="card section"><h2>🛒 Товары</h2>${renderShopTable(items)}</div>`;
    res.send(layout('Скидки магазина', body, req.query.message));
  });

  app.get('/ticket-templates', (req, res) => {
    const templates = getTicketTemplates();
    const rows = templates.map(t => `<tr><td>${escapeHtml(t.emoji || '🎫')} <b>${escapeHtml(t.label)}</b><div class="small muted">${escapeHtml(t.id)}</div></td><td>${escapeHtml(t.description || '')}</td><td>${escapeHtml(t.prompt || '')}</td></tr>`).join('');
    const body = `<div class="card"><h2>🎫 Шаблоны тикетов</h2><p class="muted">Пользователь выбирает шаблон в <code>/ticket</code>, а бот добавляет правильную структуру обращения.</p></div><div class="card section wide"><table><tr><th>Шаблон</th><th>Описание</th><th>Подсказка пользователю</th></tr>${rows}</table></div>`;
    res.send(layout('Шаблоны тикетов', body));
  });

  app.get('/panel-center', (req, res) => {
    const guild = getGuild(client);
    const panels = getPanelRegistry(guild);
    const rows = panels.map(pn => `<tr><td><b>${escapeHtml(pn.label)}</b><div class="small muted">${escapeHtml(pn.id)}</div></td><td>${escapeHtml(pn.channelName || pn.channel)}</td><td>${statusBadge(pn.status)}</td><td>${pn.publishedAt ? escapeHtml(pn.publishedAt) : '—'}</td><td><form method="post" action="/actions/publish-panel"><input type="hidden" name="type" value="${escapeHtml(pn.id)}"/><select name="channelId">${getChannelOptions(guild, pn.channelId)}</select><button>Опубликовать/обновить</button></form></td></tr>`).join('');
    const body = `<div class="card"><h2>📌 Центр управления Discord-панелями 2.0</h2><p class="muted">Показывает статус ключевых панелей: опубликована, найден только канал или отсутствует. Здесь можно быстро обновить любую панель.</p></div><div class="card section wide"><table><tr><th>Панель</th><th>Канал</th><th>Статус</th><th>Последнее обновление</th><th>Действие</th></tr>${rows}</table></div>`;
    res.send(layout('Центр панелей', body, req.query.message, req.query.warning));
  });

  app.get('/roles', (req, res) => {
    const guild = getGuild(client);
    const botMember = guild?.members.me;
    const roles = guild?.roles.cache.sort((a, b) => b.position - a.position).filter(r => r.name !== '@everyone').map(r => r) || [];
    const rows = roles.map(role => {
      const manageable = botMember ? botMember.roles.highest.comparePositionTo(role) > 0 : false;
      return `<tr><td><b>${escapeHtml(role.name)}</b><div class="small muted">${escapeHtml(role.id)}</div></td><td>${role.position}</td><td>${role.members.size}</td><td>${escapeHtml(getRoleUsage(role.name))}</td><td>${manageable ? '<span class="status-ok">✅ бот выше</span>' : '<span class="status-warn">⚠️ роль выше/равна боту</span>'}</td></tr>`;
    }).join('');
    const body = `<div class="card"><h2>🏷 Роли и иерархия</h2><p class="muted">Проверка, какие роли используются доступом, магазином, уровнями и сезоном. Для выдачи роли бот должен быть выше нее.</p></div><div class="card section wide"><table><tr><th>Роль</th><th>Позиция</th><th>Участников</th><th>Использование</th><th>Иерархия</th></tr>${rows || '<tr><td colspan="5">Роли не найдены.</td></tr>'}</table></div>`;
    res.send(layout('Роли', body));
  });

  app.get('/onboarding', (req, res) => {
    const db = readDatabase();
    const rows = Object.values(db.onboardingProgress || {}).slice(-100).reverse().map(p => `<tr><td>${escapeHtml(p.userId)}</td><td>${Object.keys(p.steps || {}).map(k => `<span class="pill">${escapeHtml(k)}</span>`).join(' ') || '—'}</td><td>${escapeHtml(p.updatedAt || p.createdAt || '')}</td></tr>`).join('');
    const body = `<div class="card"><h2>👋 Онбординг новичков</h2><p class="muted">Новые участники получают чек-лист: правила, роли, меню, daily, профиль. Нажатия по кнопкам сохраняются как прогресс.</p><p class="code">Канал: 💬・общий-чат / 🧭・навигация\nКоманда пользователя: /menu open</p></div><div class="card section wide"><h2>Последний прогресс</h2><table><tr><th>User ID</th><th>Шаги</th><th>Обновлено</th></tr>${rows || '<tr><td colspan="3">Данных пока нет.</td></tr>'}</table></div>`;
    res.send(layout('Онбординг', body));
  });

  app.get('/users', (req, res) => {
    let users = getStats(client).users;
    const q = queryValue(req, 'q').toLowerCase();
    const filter = queryValue(req, 'filter', 'all');
    const sort = queryValue(req, 'sort', 'level');
    if (q) users = users.filter(u => containsText(u.username, q) || containsText(u.discordId, q));
    if (filter === 'warnings') {
      const db = readDatabase();
      const ids = new Set((db.warnings || []).filter(w => w.active !== false).map(w => w.userId));
      users = users.filter(u => ids.has(u.discordId));
    } else if (filter === 'rich') users = users.filter(u => Number(u.coins || 0) > 0);
    else if (filter === 'active') users = users.filter(u => Number(u.messages || 0) > 0);
    const sorters = {
      level: (a,b)=>(b.level||0)-(a.level||0)||(b.xp||0)-(a.xp||0),
      coins: (a,b)=>(b.coins||0)-(a.coins||0),
      reputation: (a,b)=>(b.reputation||0)-(a.reputation||0),
      messages: (a,b)=>(b.messages||0)-(a.messages||0),
      name: (a,b)=>String(a.username||'').localeCompare(String(b.username||''))
    };
    users = users.sort(sorters[sort] || sorters.level);
    const pg = paginate(users, req, 25);
    const toolbar = tableToolbar('/users', req, [['level','Уровень'],['coins','Монеты'],['reputation','Репутация'],['messages','Сообщения'],['name','Ник']], [['all','Все'],['active','С сообщениями'],['warnings','С предупреждениями'],['rich','С монетами']]);
    const rows = pg.items.map((user, i) => `<tr><td>${(pg.page-1)*25+i+1}</td><td><b>${escapeHtml(user.username)}</b><div class="small muted">${escapeHtml(user.discordId)}</div></td><td>${user.level||1}</td><td>${user.xp||0}</td><td>${user.coins||0}</td><td>${user.reputation||0}</td><td>${user.messages||0}</td><td><a class="pill" href="/user/${encodeURIComponent(user.discordId)}">Открыть</a></td></tr>`).join('');
    const body = `<div class="card"><h2>👥 Участники</h2><p class="muted">Поиск, сортировка и фильтры помогают быстро найти нужного участника.</p>${toolbar}<div class="table-wrap"><table><tr><th>#</th><th>Участник</th><th>Уровень</th><th>XP</th><th>Монеты</th><th>Репутация</th><th>Сообщения</th><th>Действие</th></tr>${rows || '<tr><td colspan="8">Участники не найдены.</td></tr>'}</table></div>${pager('/users', req, pg.page, pg.pages)}<p class="small muted">Показано ${pg.items.length} из ${pg.total}.</p></div>`;
    res.send(layout('Участники', body, req.query.message));
  });

  app.get('/user/:id', (req, res) => {
    const db = readDatabase(); const user = db.users?.[req.params.id];
    if (!user) return res.send(layout('Участник не найден', '<div class="card"><h2>Участник не найден</h2></div>'));
    const related = getUserRelatedData(db, user.discordId);
    const inv = Array.isArray(user.inventory) ? user.inventory.map(i => typeof i === 'string' ? i : (i.name || i.id || JSON.stringify(i))).join(', ') : '-';
    const achievements = Array.isArray(user.achievements) ? user.achievements.join(', ') : '-';
    const p = user.profileCustomization || {};
    const recentTickets = related.tickets.slice(-5).reverse().map(t => `<tr><td>#${t.id}</td><td>${statusBadge(t.status)}</td><td>${escapeHtml(t.reason || '-')}</td><td>${escapeHtml(t.createdAt || '-')}</td></tr>`).join('');
    const recentApps = related.applications.slice(-5).reverse().map(a => `<tr><td>#${a.id}</td><td>${statusBadge(a.status)}</td><td>${escapeHtml(a.type || '-')}</td><td>${escapeHtml(a.createdAt || '-')}</td></tr>`).join('');
    const recentCases = related.cases.slice(-5).reverse().map(c => `<tr><td>#${c.id}</td><td>${escapeHtml(c.type || c.action || '-')}</td><td>${escapeHtml(c.reason || '-')}</td><td>${statusBadge(c.status || 'open')}</td></tr>`).join('');
    const body = `<div class="card"><h2>👤 ${escapeHtml(user.username)}</h2><p class="muted">ID: ${escapeHtml(user.discordId)}</p><div class="metric-row"><div class="metric"><div class="muted">Уровень</div><b>${user.level || 1}</b></div><div class="metric"><div class="muted">XP</div><b>${user.xp || 0}</b></div><div class="metric"><div class="muted">Монеты</div><b>${user.coins || 0}</b></div><div class="metric"><div class="muted">Репутация</div><b>${user.reputation || 0}</b></div><div class="metric"><div class="muted">Предупреждения</div><b>${related.activeWarnings.length}</b></div><div class="metric"><div class="muted">Battle Pass XP</div><b>${user.seasonXp || 0}</b></div></div><div class="tabs"><a class="tab" href="#manage">Управление</a><a class="tab" href="#profile">Оформление</a><a class="tab" href="#warnings">Предупреждения</a><a class="tab" href="#history">История</a></div></div>
    <div class="grid-2 section"><div id="manage" class="card"><h2>🛠 Управление</h2><form method="post" action="/actions/user-adjust"><input type="hidden" name="userId" value="${escapeHtml(user.discordId)}"/><div class="inline"><select name="field"><option value="xp">XP</option><option value="coins">Монеты</option><option value="reputation">Репутация</option><option value="seasonXp">Сезонный XP</option><option value="messages">Сообщения</option><option value="level">Уровень</option></select><input name="amount" type="number" value="100"/></div><select name="mode"><option value="add">Добавить</option><option value="set">Установить точное значение</option><option value="subtract">Вычесть</option></select><button>Применить</button></form><hr/><form method="post" action="/actions/user-achievement"><input type="hidden" name="userId" value="${escapeHtml(user.discordId)}"/><input name="achievement" placeholder="achievement_id, например custom_helper"/><button>Выдать достижение/бейдж</button></form><hr/><form method="post" action="/actions/user-reset-daily"><input type="hidden" name="userId" value="${escapeHtml(user.discordId)}"/><button class="gray">Сбросить cooldown /daily</button></form></div>
    <div id="profile" class="card"><h2>🎨 Профиль</h2><table><tr><th>Титул</th><td>${escapeHtml(p.title || 'Участник сервера')}</td></tr><tr><th>О себе</th><td>${escapeHtml(p.about || '-')}</td></tr><tr><th>Цвет / фон</th><td>${escapeHtml(p.color || 'blurple')} / ${escapeHtml(p.background || 'dark')}</td></tr><tr><th>Главный бейдж</th><td>${escapeHtml(p.mainBadge || '-')}</td></tr><tr><th>Инвентарь</th><td>${escapeHtml(inv)}</td></tr><tr><th>Достижения</th><td>${escapeHtml(achievements)}</td></tr></table><form method="post" action="/actions/user-profile-save" class="section"><input type="hidden" name="userId" value="${escapeHtml(user.discordId)}"/><input name="title" value="${escapeHtml(p.title || '')}" placeholder="Титул"/><textarea name="about" placeholder="О себе">${escapeHtml(p.about || '')}</textarea><div class="inline"><input name="color" value="${escapeHtml(p.color || 'blurple')}"/><input name="background" value="${escapeHtml(p.background || 'dark')}"/><input name="mainBadge" value="${escapeHtml(p.mainBadge || '')}"/></div><button>Сохранить оформление</button></form></div></div>
    <div id="warnings" class="card section"><h2>⚠️ Предупреждения</h2><div class="table-wrap"><table><tr><th>ID</th><th>Причина</th><th>Модератор</th><th>Дата</th><th>Статус</th><th>Действие</th></tr>${related.warnings.map(w => `<tr><td>#${w.id}</td><td>${escapeHtml(w.reason)}</td><td>${escapeHtml(w.moderatorName || w.moderatorId || '-')}</td><td>${escapeHtml(w.createdAt || '-')}</td><td>${statusBadge(w.active === false ? 'closed' : 'active')}</td><td>${w.active === false ? '-' : `<form method="post" action="/actions/warning-deactivate"><input type="hidden" name="id" value="${w.id}"/><input type="hidden" name="returnTo" value="/user/${escapeHtml(user.discordId)}"/><button class="danger">Снять</button></form>`}</td></tr>`).join('') || '<tr><td colspan="6">Предупреждений нет.</td></tr>'}</table></div></div>
    <div id="history" class="grid-2 section"><div class="card"><h2>🎫 Тикеты</h2><table><tr><th>ID</th><th>Статус</th><th>Причина</th><th>Дата</th></tr>${recentTickets || '<tr><td colspan="4">Нет тикетов.</td></tr>'}</table></div><div class="card"><h2>📨 Заявки</h2><table><tr><th>ID</th><th>Статус</th><th>Тип</th><th>Дата</th></tr>${recentApps || '<tr><td colspan="4">Нет заявок.</td></tr>'}</table></div><div class="card"><h2>🛡 Дела</h2><table><tr><th>ID</th><th>Тип</th><th>Причина</th><th>Статус</th></tr>${recentCases || '<tr><td colspan="4">Нет дел.</td></tr>'}</table></div><div class="card"><h2>📅 Ивенты</h2><table><tr><th>ID</th><th>Название</th><th>Дата</th></tr>${related.events.slice(-5).reverse().map(e => `<tr><td>#${e.id}</td><td>${escapeHtml(e.title)}</td><td>${escapeHtml(e.date || '-')}</td></tr>`).join('') || '<tr><td colspan="3">Нет участий.</td></tr>'}</table></div></div>`;
    res.send(layout(`Участник ${user.username}`, body, req.query.message));
  });


  app.get('/profiles', (req, res) => {
    const users = getStats(client).users.sort((a, b) => String(a.username).localeCompare(String(b.username)));
    const rows = users.map(user => {
      const p = user.profileCustomization || {};
      const cosmetics = (user.inventory || []).filter(i => i && i.type === 'cosmetic').length;
      return `<tr><td><b>${escapeHtml(user.username)}</b><div class="small muted">${escapeHtml(user.discordId)}</div></td><td>${escapeHtml(p.title || 'Участник сервера')}</td><td>${escapeHtml(p.color || 'blurple')}</td><td>${escapeHtml(p.background || 'dark')}</td><td>${cosmetics}</td><td><a class="pill" href="/user/${encodeURIComponent(user.discordId)}">Открыть</a></td></tr>`;
    }).join('');
    res.send(layout('Профили', `<div class="card"><h2>🎨 Профили участников</h2><p class="muted">Здесь видно оформление профилей. Менять данные участника можно в его карточке.</p><table><tr><th>Участник</th><th>Титул</th><th>Цвет</th><th>Фон</th><th>Косметика</th><th>Действие</th></tr>${rows || '<tr><td colspan="6">Пока нет пользователей.</td></tr>'}</table></div>`, req.query.message));
  });

  app.get('/economy', (req, res) => {
    const users = getStats(client).users.sort((a, b) => (b.coins || 0) - (a.coins || 0));
    const guild = getGuild(client);
    const body = `<div class="grid-2"><div class="card"><h2>💰 Экономика</h2><p class="muted">Можно выдавать или списывать монеты, XP и сезонный XP. Для точного управления пользователем открой его карточку.</p><form method="post" action="/actions/user-adjust"><select name="userId">${Object.values(readDatabase().users || {}).map(u => `<option value="${escapeHtml(u.discordId)}">${escapeHtml(u.username)}</option>`).join('')}</select><div class="inline"><select name="field"><option value="coins">Монеты</option><option value="xp">XP</option><option value="seasonXp">Сезонный XP</option></select><input name="amount" type="number" value="100"/></div><select name="mode"><option value="add">Добавить</option><option value="subtract">Вычесть</option><option value="set">Установить</option></select><button>Применить</button></form></div><div class="card"><h2>📢 Сообщение в канал</h2><form method="post" action="/actions/send-message"><input type="hidden" name="redirect" value="/economy"/><select name="channelId">${getChannelOptions(guild)}</select><textarea name="message" placeholder="Например: сегодня x2 награда за квесты"></textarea><button>Отправить</button></form></div></div><div class="card section"><h2>🏦 Балансы участников</h2>${renderUsersTable(users, true)}</div>`;
    res.send(layout('Экономика', body, req.query.message));
  });

  app.get('/shop-admin', (req, res) => {
    const items = getShopItemsFromDb();
    const rows = items.map(item => `<tr><td>${escapeHtml(item.id)}</td><td>${escapeHtml(item.name)}</td><td>${item.price}</td><td>${escapeHtml(item.type || 'role')}</td><td>${escapeHtml(item.roleName || '-')}</td><td>${escapeHtml(item.cosmeticType || '-')} ${escapeHtml(item.value || '')}</td><td>${item.enabled === false ? 'выкл' : 'вкл'}</td><td><form method="post" action="/actions/shop-delete"><input type="hidden" name="id" value="${escapeHtml(item.id)}"/><button class="danger">Удалить</button></form></td></tr>`).join('');
    const body = `<div class="grid-2"><div class="card"><h2>🛒 Магазин</h2><p class="muted">Здесь можно добавлять роли, косметику, бусты, билеты и особые товары. Для роли укажи точное название роли Discord, например 💎 VIP.</p><form method="post" action="/actions/shop-save"><input name="id" placeholder="id, например xp_boost_24h" required/><input name="name" placeholder="Название товара" required/><input name="price" type="number" min="0" value="500"/><select name="category"><option value="roles">Роли</option><option value="cosmetics">Косметика</option><option value="boosts">Бусты</option><option value="tickets">Билеты</option><option value="special">Особые товары</option></select><select name="type"><option value="role">Роль</option><option value="cosmetic">Косметика профиля</option><option value="boost">Буст</option><option value="ticket">Билет</option><option value="custom">Особый товар</option></select><input name="roleName" placeholder="Название роли, если тип role"/><select name="cosmeticType"><option value="">Без косметики</option><option value="color">Цвет профиля</option><option value="background">Фон профиля</option></select><input name="value" placeholder="Значение косметики: gold, purple, neon, ocean"/><select name="boostType"><option value="">Без буста</option><option value="xp">XP</option><option value="coins">Монеты</option></select><div class="inline"><input name="multiplier" type="number" step="0.1" min="1" value="2" placeholder="Множитель"/><input name="durationHours" type="number" min="1" value="24" placeholder="Длительность, часов"/></div><textarea name="description" placeholder="Описание товара"></textarea><label class="toggle"><input type="checkbox" name="enabled" checked/><span><b>Товар включен</b><div class="desc">Если выключить, товар останется в базе, но не будет отображаться в магазине.</div></span></label><button>Добавить/обновить товар</button></form></div><div class="card"><h2>ℹ️ Типы товаров</h2><p class="muted"><b>role</b> — сразу выдает роль. <b>cosmetic</b> — добавляет цвет/фон в инвентарь. <b>boost</b> — покупается в инвентарь и активируется через /use. <b>ticket/custom</b> — предметы для ручных розыгрышей и заявок.</p><p class="muted">Чтобы бот мог выдавать роли, роль бота должна быть выше продаваемых ролей.</p></div></div><div class="card section"><h2>📦 Товары</h2><table><tr><th>ID</th><th>Название</th><th>Цена</th><th>Тип</th><th>Роль</th><th>Косметика</th><th>Статус</th><th>Действие</th></tr>${rows || '<tr><td colspan="8">Товаров пока нет.</td></tr>'}</table></div>`;
    res.send(layout('Магазин', body, req.query.message));
  });

  app.get('/events', (req, res) => {
    const stats = getStats(client); const guild = stats.guild;
    const events = Object.values(readDatabase().events || {}).sort((a, b) => Number(b.id) - Number(a.id));
    const rows = events.map(event => `<tr><td>#${event.id}</td><td>${escapeHtml(event.title)}</td><td>${escapeHtml(event.status)}</td><td>${escapeHtml(event.date)}</td><td>${(event.participants || []).length}/${event.maxMembers || '∞'}</td><td><div class="actions"><form method="post" action="/actions/event-cancel"><input type="hidden" name="id" value="${event.id}"/><button class="danger">Закрыть</button></form><form method="post" action="/actions/event-open"><input type="hidden" name="id" value="${event.id}"/><button class="green">Открыть</button></form></div></td></tr>`).join('');
    const body = `<div class="grid-2"><div class="card"><h2>📅 Создать ивент</h2><form method="post" action="/actions/event-create"><input name="title" placeholder="Название" required/><input name="date" placeholder="10.06.2026 20:00" required/><input name="max" type="number" min="0" max="999" value="10"/><textarea name="description" placeholder="Описание"></textarea><button>Создать и опубликовать в 📅・ивенты</button></form><p class="desc">Дата поддерживает форматы 10.06.2026 20:00 или 2026-06-10 20:00.</p></div><div class="card"><h2>📢 Быстрое сообщение в канал ивентов</h2><form method="post" action="/actions/send-message"><input type="hidden" name="redirect" value="/events"/><select name="channelId">${getChannelOptions(guild)}</select><textarea name="message" placeholder="Анонс ивента"></textarea><button>Отправить</button></form></div></div><div class="card section wide"><h2>📅 Ивенты</h2><table><tr><th>ID</th><th>Название</th><th>Статус</th><th>Дата</th><th>Участники</th><th>Действие</th></tr>${rows || '<tr><td colspan="6">Ивентов пока нет.</td></tr>'}</table></div>`;
    res.send(layout('Ивенты', body, req.query.message));
  });



  app.get('/voice', (req, res) => {
    const guild = getGuild(client);
    const rooms = getActiveRooms();
    const rows = rooms.map(room => {
      const channel = guild?.channels.cache.get(room.channelId);
      return `<tr><td>${escapeHtml(room.name)}</td><td><@${escapeHtml(room.ownerId)}><div class="small muted">${escapeHtml(room.ownerName || '')}</div></td><td>${channel ? channel.members.size : 0}</td><td>${room.locked ? '🔒 закрыта' : '🔓 открыта'}</td><td>${room.limit || 'нет'}</td><td>${escapeHtml(room.createdAt || '')}</td></tr>`;
    }).join('');
    const body = `<div class="grid-2"><div class="card"><h2>🔊 Временные voice-комнаты</h2><p class="muted">Пользователь заходит в канал <b>➕・создать-комнату</b>, после чего бот автоматически создает ему личную комнату и переносит туда.</p><form method="post" action="/actions/voice-setup"><button>Создать/проверить канал ➕・создать-комнату</button></form></div><div class="card"><h2>🎛 Панель управления</h2><p class="muted">Можно отправить Discord-панель с кнопками управления комнатой: закрыть, открыть, забрать, удалить и посмотреть информацию.</p><form method="post" action="/actions/voice-panel"><select name="channelId">${getChannelOptions(guild)}</select><button>Отправить voice-панель</button></form></div></div><div class="card section"><h2>📋 Активные комнаты</h2><table><tr><th>Комната</th><th>Владелец</th><th>Участники</th><th>Доступ</th><th>Лимит</th><th>Создана</th></tr>${rows || '<tr><td colspan="6">Активных временных комнат нет.</td></tr>'}</table></div><div class="card section"><h2>Команды</h2><p><span class="pill">/voice setup</span><span class="pill">/voice panel</span><span class="pill">/voice lock</span><span class="pill">/voice unlock</span><span class="pill">/voice limit</span><span class="pill">/voice rename</span><span class="pill">/voice invite</span><span class="pill">/voice claim</span><span class="pill">/voice delete</span></p></div>`;
    res.send(layout('Voice-комнаты', body, req.query.message));
  });

  app.get('/suggestions-panel', (req, res) => {
    const db = readDatabase();
    const guild = getGuild(client);
    const suggestions = Object.values(db.suggestions || {}).sort((a, b) => Number(b.id) - Number(a.id));
    const polls = Object.values(db.polls || {}).sort((a, b) => Number(b.id) - Number(a.id));
    const suggestionRows = suggestions.map(s => {
      const up = Object.keys(s.votes?.up || {}).length;
      const down = Object.keys(s.votes?.down || {}).length;
      return `<tr><td>#${s.id}</td><td>${escapeHtml(s.status || 'open')}</td><td>${escapeHtml(s.username || s.userId)}</td><td>${escapeHtml(s.idea || '')}</td><td>👍 ${up} / 👎 ${down}</td><td><form method="post" action="/actions/suggestion-status"><input type="hidden" name="id" value="${s.id}"/><select name="status"><option value="review">На рассмотрении</option><option value="accepted">Принять</option><option value="denied">Отклонить</option><option value="closed">Закрыть</option><option value="open">Открыть</option></select><input name="comment" placeholder="Комментарий"/><button>Сохранить</button></form></td></tr>`;
    }).join('');
    const pollRows = polls.map(p => `<tr><td>#${p.id}</td><td>${escapeHtml(p.status || 'open')}</td><td>${escapeHtml(p.username || p.userId)}</td><td>${escapeHtml(p.question || '')}</td><td>${Object.keys(p.votes || {}).length}</td><td><form method="post" action="/actions/poll-status"><input type="hidden" name="id" value="${p.id}"/><select name="status"><option value="closed">Закрыть</option><option value="open">Открыть</option></select><button>Сохранить</button></form></td></tr>`).join('');
    const body = `<div class="grid-2"><div class="card"><h2>💡 Создать предложение</h2><p class="muted">Можно создать предложение от имени веб-панели и сразу опубликовать его в канал.</p><form method="post" action="/actions/suggestion-create"><select name="channelId">${getChannelOptions(guild)}</select><textarea name="idea" placeholder="Текст предложения" required></textarea><button>Создать предложение</button></form></div><div class="card"><h2>📊 Создать опрос</h2><p class="muted">Варианты указываются через |. Например: Да | Нет | Не знаю.</p><form method="post" action="/actions/poll-create"><select name="channelId">${getChannelOptions(guild)}</select><input name="question" placeholder="Вопрос" required/><textarea name="options" placeholder="Да | Нет | Не знаю" required></textarea><button>Создать опрос</button></form></div></div><div class="card section wide"><h2>💡 Предложения</h2><table><tr><th>ID</th><th>Статус</th><th>Автор</th><th>Текст</th><th>Голоса</th><th>Действие</th></tr>${suggestionRows || '<tr><td colspan="6">Предложений пока нет.</td></tr>'}</table></div><div class="card section wide"><h2>📊 Опросы</h2><table><tr><th>ID</th><th>Статус</th><th>Автор</th><th>Вопрос</th><th>Голоса</th><th>Действие</th></tr>${pollRows || '<tr><td colspan="6">Опросов пока нет.</td></tr>'}</table></div>`;
    res.send(layout('Предложения', body, req.query.message));
  });


  app.get('/notifications', (req, res) => {
    const db = readDatabase();
    const guild = getGuild(client);
    const settings = db.notificationSettings || {};
    const reminders = Object.values(db.reminders || {}).sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 50);
    const logs = (db.notificationLog || []).slice(0, 30);
    const checkbox = (name, checked, title, desc) => `<label class="toggle"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}/><span><b>${title}</b><div class="desc">${desc}</div></span></label>`;
    const reminderRows = reminders.map(r => `<tr><td>#${r.id}</td><td>${escapeHtml(r.status)}</td><td>${escapeHtml(r.username || r.userId)}</td><td>${escapeHtml(r.message)}</td><td>${formatDiscordTime(r.dueAt, 'f')}<div class="small muted">${formatDiscordTime(r.dueAt, 'R')}</div></td><td><form method="post" action="/actions/reminder-cancel"><input type="hidden" name="id" value="${r.id}"/><button class="danger">Отменить</button></form></td></tr>`).join('');
    const logRows = logs.map(l => `<tr><td>${escapeHtml(l.createdAt || '')}</td><td>${escapeHtml(l.title || '')}</td><td>${escapeHtml(l.description || '')}</td></tr>`).join('');
    const body = `<div class="grid-2"><div class="card"><h2>🔔 Настройки уведомлений</h2><p class="muted">Здесь настраиваются автоматические напоминания: перед ивентами, о турнирах, старых тикетах, сезоне и daily. Канал уведомлений можно указать отдельно.</p><form method="post" action="/actions/notifications-save"><select name="channelId"><option value="">Автоматически: 📢・объявления или 🛡・лог-модерации</option>${getChannelOptions(guild, settings.channelId || '')}</select>${checkbox('daily', settings.daily !== false, 'Daily', 'Напоминания и системные сообщения, связанные с ежедневными наградами.')}${checkbox('events', settings.events !== false, 'Ивенты', 'Бот уведомит участников примерно за 30 минут до начала ивента.')}${checkbox('tournaments', settings.tournaments !== false, 'Турниры', 'Бот отправляет уведомление о новом открытом турнире.')}${checkbox('season', settings.season !== false, 'Сезон', 'Системные уведомления о сезоне и Battle Pass.')}${checkbox('tickets', settings.tickets !== false, 'Тикеты', 'Бот напомнит администрации, если тикет долго открыт без закрытия.')}
<div class="inline"><label>За сколько минут напоминать об ивентах<input name="eventReminderMinutes" type="number" min="1" max="1440" value="${Number(settings.eventReminderMinutes || 30)}"/></label><label>Через сколько часов тикет считается старым<input name="staleTicketHours" type="number" min="1" max="168" value="${Number(settings.staleTicketHours || 12)}"/></label></div><button>Сохранить настройки</button></form><form class="section" method="post" action="/actions/notifications-check"><button class="gray">Запустить проверку уведомлений сейчас</button></form></div><div class="card"><h2>⏰ Создать напоминание</h2><p class="muted">Напоминание можно отправить пользователю в канал или личные сообщения. Формат времени: 10m, 2h, 1d, 10.06.2026 20:00.</p><form method="post" action="/actions/reminder-create"><select name="userId">${getMemberOptions(guild)}</select><select name="channelId">${getChannelOptions(guild)}</select><input name="time" placeholder="10m или 10.06.2026 20:00" required/><textarea name="message" placeholder="Текст напоминания" required></textarea><select name="mode"><option value="channel">В канал</option><option value="dm">В ЛС</option></select><button>Создать напоминание</button></form></div></div><div class="card section wide"><h2>⏰ Последние напоминания</h2><table><tr><th>ID</th><th>Статус</th><th>Пользователь</th><th>Текст</th><th>Когда</th><th>Действие</th></tr>${reminderRows || '<tr><td colspan="6">Напоминаний пока нет.</td></tr>'}</table></div><div class="card section wide"><h2>📜 Лог уведомлений</h2><table><tr><th>Дата</th><th>Заголовок</th><th>Описание</th></tr>${logRows || '<tr><td colspan="3">Лог пуст.</td></tr>'}</table></div>`;
    res.send(layout('Уведомления', body, req.query.message));
  });

  app.get('/tickets', (req, res) => {
    const tickets = Object.values(readDatabase().tickets || {}).sort((a, b) => Number(b.id) - Number(a.id));
    const rows = tickets.map(ticket => `<tr><td>#${ticket.id}</td><td>${escapeHtml(ticket.status)}</td><td>${escapeHtml(ticket.username || ticket.userId)}</td><td>${escapeHtml(ticket.reason || '-')}</td><td>${escapeHtml(ticket.createdAt || '-')}</td><td><div class="actions"><form method="post" action="/actions/ticket-close"><input type="hidden" name="id" value="${ticket.id}"/><button class="danger">Закрыть</button></form><form method="post" action="/actions/ticket-open"><input type="hidden" name="id" value="${ticket.id}"/><button class="green">Открыть</button></form></div></td></tr>`).join('');
    res.send(layout('Тикеты', `<div class="card wide"><h2>🎫 Тикеты</h2><p class="muted">Закрытие через веб-панель меняет статус в базе. Если канал тикета еще существует, бот попробует удалить его.</p><table><tr><th>ID</th><th>Статус</th><th>Пользователь</th><th>Причина</th><th>Создан</th><th>Действие</th></tr>${rows || '<tr><td colspan="6">Тикетов пока нет.</td></tr>'}</table></div>`, req.query.message));
  });

  app.get('/moderation', (req, res) => {
    const db = readDatabase();
    const warnings = (db.warnings || []).filter(item => item.active !== false).sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    const cases = (db.moderationCases || []).sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    const notes = (db.moderationNotes || []).sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    const appeals = (db.moderationAppeals || []).sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    const openTickets = Object.values(db.tickets || {}).filter(ticket => ticket.status === 'open').sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    const warningRows = warnings.slice(0, 80).map(item => `<tr><td>#${item.id}</td><td>${escapeHtml(item.username || item.userId)}</td><td>${escapeHtml(item.moderatorName || item.moderatorId || '-')}</td><td>${escapeHtml(item.reason || '-')}</td><td>${escapeHtml(item.createdAt || '-')}</td><td><form method="post" action="/actions/warning-deactivate"><input type="hidden" name="id" value="${item.id}"/><input type="hidden" name="returnTo" value="/moderation"/><input name="reason" placeholder="Причина снятия"/><button class="danger">Снять</button></form></td></tr>`).join('');
    const caseRows = cases.slice(0, 80).map(item => `<tr><td>#${item.id}</td><td>${escapeHtml(item.type || '-')}</td><td>${escapeHtml(item.status || 'active')}</td><td>${escapeHtml(item.username || item.userId)}</td><td>${escapeHtml(item.moderatorName || '-')}</td><td>${escapeHtml(item.reason || '-')}</td><td>${escapeHtml(item.createdAt || '-')}</td></tr>`).join('');
    const noteRows = notes.slice(0, 50).map(item => `<tr><td>#${item.id}</td><td>${escapeHtml(item.username || item.userId)}</td><td>${escapeHtml(item.moderatorName || '-')}</td><td>${escapeHtml(item.text || '-')}</td><td>${escapeHtml(item.createdAt || '-')}</td></tr>`).join('');
    const appealRows = appeals.slice(0, 60).map(item => `<tr><td>#${item.id}</td><td>${escapeHtml(item.status || 'open')}</td><td>${escapeHtml(item.username || item.userId)}</td><td>${escapeHtml(item.caseId || '-')}</td><td>${escapeHtml(item.text || '-')}</td><td><form method="post" action="/actions/appeal-status"><input type="hidden" name="id" value="${item.id}"/><select name="status"><option value="accepted">Принять</option><option value="denied">Отклонить</option><option value="open">Открыть</option></select><input name="response" placeholder="Комментарий"/><button>Сохранить</button></form></td></tr>`).join('');
    const ticketRows = openTickets.slice(0, 40).map(item => `<tr><td>#${item.id}</td><td>${escapeHtml(item.username || item.userId)}</td><td>${escapeHtml(item.reason || '-')}</td><td>${escapeHtml(item.createdAt || '-')}</td></tr>`).join('');
    const body = `<div class="grid"><div class="card"><div class="muted">Активных предупреждений</div><div class="stat">${warnings.length}</div></div><div class="card"><div class="muted">Дел модерации</div><div class="stat">${cases.length}</div></div><div class="card"><div class="muted">Открытых апелляций</div><div class="stat">${appeals.filter(a => a.status === 'open').length}</div></div><div class="card"><h2>🧰 Discord-панель</h2><p class="muted">Отправляет панель в канал 🧰・панель-модерации.</p><form method="post" action="/actions/mod-panel"><button>Отправить панель модерации</button></form></div></div><div class="card section wide"><h2>📁 Дела модерации</h2><p class="muted">Здесь отображается история наказаний: warn, mute, unmute, kick, ban. Подробности доступны через /case info.</p><table><tr><th>ID</th><th>Тип</th><th>Статус</th><th>Участник</th><th>Модератор</th><th>Причина</th><th>Дата</th></tr>${caseRows || '<tr><td colspan="7">Дел пока нет.</td></tr>'}</table></div><div class="card section wide"><h2>⚠️ Активные предупреждения</h2><table><tr><th>ID</th><th>Участник</th><th>Модератор</th><th>Причина</th><th>Дата</th><th>Действие</th></tr>${warningRows || '<tr><td colspan="6">Предупреждений пока нет.</td></tr>'}</table></div><div class="card section wide"><h2>📝 Модераторские заметки</h2><table><tr><th>ID</th><th>Участник</th><th>Модератор</th><th>Текст</th><th>Дата</th></tr>${noteRows || '<tr><td colspan="5">Заметок пока нет.</td></tr>'}</table></div><div class="card section wide"><h2>📨 Апелляции</h2><table><tr><th>ID</th><th>Статус</th><th>Участник</th><th>Дело</th><th>Текст</th><th>Решение</th></tr>${appealRows || '<tr><td colspan="6">Апелляций пока нет.</td></tr>'}</table></div><div class="card section"><h2>🎫 Открытые тикеты</h2><table><tr><th>ID</th><th>Участник</th><th>Причина</th><th>Создан</th></tr>${ticketRows || '<tr><td colspan="4">Открытых тикетов нет.</td></tr>'}</table></div>`;
    res.send(layout('Модерация', body, req.query.message));
  });

  app.get('/automod', (req, res) => {
    const s = getSettings();
    const body = `<div class="card"><h2>🛡 AutoMod</h2><p class="muted">Здесь можно включать и отключать автоматическую модерацию без редактирования кода. Для работы нужен Message Content Intent в Discord Developer Portal.</p><form method="post" action="/actions/automod-save">
      <label class="toggle"><input type="checkbox" name="automodEnabled" ${s.automodEnabled ? 'checked' : ''}/><span><b>Включить AutoMod</b><div class="desc">Главный переключатель. Если выключен, все проверки ниже не выполняются.</div></span></label>
      <label class="toggle"><input type="checkbox" name="automodAntiSpam" ${s.automodAntiSpam ? 'checked' : ''}/><span><b>Антиспам</b><div class="desc">Удаляет повторяющиеся или слишком частые сообщения одного пользователя.</div></span></label>
      <label class="toggle"><input type="checkbox" name="automodAntiCaps" ${s.automodAntiCaps ? 'checked' : ''}/><span><b>Антикапс</b><div class="desc">Удаляет сообщения, где слишком много заглавных букв. Модераторы игнорируются.</div></span></label>
      <label class="toggle"><input type="checkbox" name="automodBlockLinks" ${s.automodBlockLinks ? 'checked' : ''}/><span><b>Блокировка ссылок</b><div class="desc">Удаляет сообщения с http/https, www и discord.gg. Включай осторожно, если участникам нужны ссылки.</div></span></label>
      <div class="grid"><div><b>Максимум упоминаний</b><input type="number" name="automodMaxMentions" min="1" max="50" value="${Number(s.automodMaxMentions || 6)}"/><div class="desc">Если пользователь упомянет слишком много людей, сообщение будет удалено.</div></div><div><b>Длительность авто-мута, минут</b><input type="number" name="automodMutedMinutes" min="1" max="10080" value="${Number(s.automodMutedMinutes || 10)}"/><div class="desc">Резервная настройка для автоматического мута после нарушений.</div></div></div>
      <div><b>Запрещенные слова</b><textarea name="automodForbiddenWords" placeholder="слово1, слово2, слово3">${escapeHtml((s.automodForbiddenWords || []).join(', '))}</textarea><div class="desc">Слова через запятую. Если слово найдено в сообщении, оно удаляется и логируется.</div></div>
      <button class="green">Сохранить AutoMod</button></form></div>
      <div class="card section"><h2>📜 Последние срабатывания AutoMod</h2>${renderAutomodLogs()}</div>`;
    res.send(layout('AutoMod', body, req.query.message));
  });

  app.get('/settings', (req, res) => {
    const stats = getStats(client); const guild = stats.guild; const s = getSettings();
    const settingRows = Object.entries(s).map(([k, v]) => `<tr><td><code>${escapeHtml(k)}</code><div class="desc">${escapeHtml(SETTINGS_DESCRIPTIONS[k] || 'Пользовательская настройка проекта.')}</div></td><td>${escapeHtml(Array.isArray(v) ? v.join(', ') : String(v))}</td></tr>`).join('');
    const body = `<div class="grid-2"><div class="card"><h2>📈 Настройки XP и daily</h2><form method="post" action="/actions/core-settings"><div class="inline"><input name="xpPerMessage" type="number" min="0" value="${Number(s.xpPerMessage || 5)}" placeholder="XP за сообщение"/><input name="xpCooldownSeconds" type="number" min="0" value="${Number(s.xpCooldownSeconds || 60)}" placeholder="Cooldown XP"/></div><div class="inline"><input name="dailyCoins" type="number" min="0" value="${Number(s.dailyCoins || 100)}" placeholder="daily coins"/><input name="dailyXp" type="number" min="0" value="${Number(s.dailyXp || 25)}" placeholder="daily XP"/><input name="dailyCooldownHours" type="number" min="1" value="${Number(s.dailyCooldownHours || 24)}" placeholder="daily cooldown"/></div><button>Сохранить XP и daily</button></form></div><div class="card"><h2>📌 Названия каналов</h2><form method="post" action="/actions/channel-settings"><input name="logChannelName" value="${escapeHtml(s.logChannelName || '🛡・лог-модерации')}"/><input name="eventsChannelName" value="${escapeHtml(s.eventsChannelName || '📅・ивенты')}"/><input name="miniGamesChannelName" value="${escapeHtml(s.miniGamesChannelName || '🎲・мини-игры')}"/><input name="moderationPanelChannelName" value="${escapeHtml(s.moderationPanelChannelName || '🧰・панель-модерации')}"/><button>Сохранить каналы</button></form></div></div>
    <div class="grid section"><div class="card"><h2>🎲 Панель мини-игр</h2><p class="muted">Отправляет интерактивное меню в 🎲・мини-игры.</p><form method="post" action="/actions/game-panel"><button>Отправить</button></form></div><div class="card"><h2>✅ Панель ролей</h2><p class="muted">Отправляет выбор ролей в ✅・получить-роли.</p><form method="post" action="/actions/role-panel"><button>Отправить</button></form></div><div class="card"><h2>🧰 Панель модерации</h2><p class="muted">Отправляет меню модерации.</p><form method="post" action="/actions/mod-panel"><button>Отправить</button></form></div></div>
    <div class="card section"><h2>📢 Сообщение в канал</h2><form method="post" action="/actions/send-message"><input type="hidden" name="redirect" value="/settings"/><select name="channelId">${getChannelOptions(guild)}</select><textarea name="message" placeholder="Текст сообщения"></textarea><button>Отправить</button></form></div>
    <div class="card section"><h2>⚙️ Изменить настройку вручную</h2><form method="post" action="/actions/set-setting"><div class="inline"><input name="key" placeholder="xpPerMessage"/><input name="value" placeholder="10 или true/false"/></div><button>Сохранить</button></form><p class="muted">Основные настройки лучше менять через формы выше. Тут можно менять отдельные ключи.</p></div>
    <div class="card section wide"><h2>📋 Текущие настройки</h2><p class="hint">Подсказки под каждым ключом объясняют, за что отвечает параметр. Опасные изменения лучше сначала проверить на тестовом сервере.</p><table><tr><th>Ключ</th><th>Значение</th></tr>${settingRows}</table></div><div class="card section"><h2>⚙️ .env</h2><p><span class="pill">WEB_PORT=${config.port}</span><span class="pill">WEB_PANEL_ENABLED=${config.enabled}</span></p><p class="muted">Пароль меняется в .env через WEB_PASSWORD.</p></div>`;
    res.send(layout('Настройки', body, req.query.message));
  });

  app.get('/clans', (req, res) => {
    const rows = Object.values(readDatabase().clans || {}).map(c => `<tr><td>#${c.id}</td><td>${escapeHtml(c.name)}</td><td>${(c.members||[]).length}</td><td>${c.bank||0}</td><td>${c.xp||0}</td><td><form method="post" action="/actions/clan-bank"><input type="hidden" name="id" value="${c.id}"/><div class="mini-form"><input name="amount" type="number" value="100"/><button>+ банк</button></div></form></td></tr>`).join('');
    res.send(layout('Кланы', `<div class="card wide"><h2>🏰 Кланы</h2><table><tr><th>ID</th><th>Название</th><th>Участники</th><th>Банк</th><th>XP</th><th>Действие</th></tr>${rows || '<tr><td colspan="6">Кланов пока нет.</td></tr>'}</table></div>`, req.query.message));
  });
  app.get('/applications', (req, res) => {
    const guild = getGuild(client);
    const rows = Object.values(readDatabase().applications || {}).sort((a,b)=>Number(b.id)-Number(a.id)).map(a => `<tr><td>#${a.id}</td><td>${escapeHtml(a.typeLabel || a.type)}</td><td>${escapeHtml(a.username)}</td><td>${escapeHtml(a.status)}</td><td><div class="code">${escapeHtml(a.text||'')}</div>${a.moderatorComment ? `<p class="muted">Комментарий: ${escapeHtml(a.moderatorComment)}</p>` : ''}</td><td><form method="post" action="/actions/application-status"><input type="hidden" name="id" value="${a.id}"/><select name="status"><option value="accepted">Принять</option><option value="denied">Отклонить</option></select><textarea name="comment" placeholder="Комментарий пользователю"></textarea><button>Сохранить решение</button></form></td></tr>`).join('');
    const body = `<div class="grid-2"><div class="card"><h2>📨 Панель заявок</h2><p class="muted">Отправляет в выбранный канал сообщение с кнопками. Пользователь нажимает кнопку, заполняет Discord-форму, а заявка попадает сюда и в канал администрации.</p><form method="post" action="/actions/apply-panel"><select name="channelId">${getChannelOptions(guild)}</select><button>Отправить панель заявок</button></form></div><div class="card"><h2>ℹ️ Типы заявок</h2><p><span class="pill">Модератор</span><span class="pill">Партнерство</span><span class="pill">Кастомная роль</span><span class="pill">Турнир</span><span class="pill">Жалоба</span><span class="pill">Идея</span></p><p class="muted">Решение можно отправить с комментарием. Бот попробует уведомить пользователя в личные сообщения.</p></div></div><div class="card wide section"><h2>📨 Заявки</h2><table><tr><th>ID</th><th>Тип</th><th>Пользователь</th><th>Статус</th><th>Ответы</th><th>Действие</th></tr>${rows || '<tr><td colspan="6">Заявок пока нет.</td></tr>'}</table></div>`;
    res.send(layout('Заявки', body, req.query.message));
  });
  app.get('/tournaments', (req, res) => {
    const tournaments = Object.values(readDatabase().tournaments || {}).sort((a,b)=>Number(b.id)-Number(a.id));
    const rows = tournaments.map(t => `<tr><td>#${t.id}</td><td>${escapeHtml(t.title)}</td><td>${escapeHtml(t.status)}</td><td>${(t.participants||[]).length}/${t.maxMembers}</td><td><div class="code">${escapeHtml(buildBracket(t))}</div></td><td><form method="post" action="/actions/tournament-cancel"><input type="hidden" name="id" value="${t.id}"/><button class="danger">Закрыть</button></form></td></tr>`).join('');
    const body = `<div class="grid-2"><div class="card"><h2>🏆 Создать турнир</h2><form method="post" action="/actions/tournament-create"><input name="title" placeholder="Название турнира" required/><input name="max" type="number" min="2" max="64" value="16"/><textarea name="description" placeholder="Описание"></textarea><button>Создать турнир</button></form></div><div class="card"><h2>📋 Команды турниров</h2><p><span class="pill">/tournament create</span><span class="pill">/tournament join</span><span class="pill">/tournament bracket</span></p><p class="muted">Из веб-панели можно создать и закрыть турнир. Запись участников делается через Discord-команду.</p></div></div><div class="card section wide"><h2>🏆 Турниры</h2><table><tr><th>ID</th><th>Название</th><th>Статус</th><th>Участники</th><th>Сетка</th><th>Действие</th></tr>${rows || '<tr><td colspan="6">Турниров пока нет.</td></tr>'}</table></div>`;
    res.send(layout('Турниры', body, req.query.message));
  });
  app.get('/season', (req, res) => {
    const season = getSeason();
    const rows = seasonTop(20).map((u,i)=>{ const p = getSeasonProgress(u.seasonXp || 0); return `<tr><td>${i+1}</td><td>${escapeHtml(u.username)}</td><td>${u.seasonXp||0}</td><td>${p.level}</td><td>${u.battlePassPremium ? 'Premium' : 'Free'}</td><td><form method="post" action="/actions/battlepass-premium"><input type="hidden" name="userId" value="${escapeHtml(u.discordId)}"/><input type="hidden" name="enabled" value="${u.battlePassPremium ? 'false' : 'true'}"/><button>${u.battlePassPremium ? 'Снять Premium' : 'Выдать Premium'}</button></form></td></tr>`; }).join('');
    res.send(layout('Сезон и Battle Pass', `<div class="grid-2"><div class="card"><h2>🌟 ${escapeHtml(season.name)}</h2><p>Статус: <b>${season.active ? 'активен' : 'выключен'}</b></p><p>Окончание: ${escapeHtml(season.endsAt || '-')}</p><form method="post" action="/actions/season-save"><div class="inline"><input name="seasonName" value="${escapeHtml(season.name)}"/><input name="seasonEndsAt" placeholder="2026-07-01" value="${escapeHtml(season.endsAt || '')}"/></div><label class="toggle"><input type="checkbox" name="seasonActive" ${season.active ? 'checked' : ''}/><span><b>Сезон активен</b><div class="desc">Если включено, пользователи получают сезонный XP и открывают уровни Battle Pass.</div></span></label><button>Сохранить сезон</button></form></div><div class="card"><h2>🎟 Battle Pass</h2><p class="muted"><b>Free</b> — бесплатная ветка наград. <b>Premium</b> — дополнительная ветка, которую можно включать пользователям вручную.</p><p class="muted">1 уровень Battle Pass = 250 сезонного XP. Сезонный XP начисляется вместе с обычным XP.</p><div class="code">/battlepass info
/battlepass claim track:free level:1</div></div></div><div class="card section wide"><h2>🏆 Сезонный топ и Premium</h2><table><tr><th>#</th><th>Участник</th><th>Season XP</th><th>BP уровень</th><th>Ветка</th><th>Действие</th></tr>${rows || '<tr><td colspan="6">Данных пока нет.</td></tr>'}</table></div>`, req.query.message));
  });
  app.get('/integrations', (req, res) => {
    const rows = (readDatabase().integrations || []).map(i => `<tr><td>#${i.id}</td><td>${escapeHtml(i.type)}</td><td>${escapeHtml(i.name)}</td><td>${i.enabled?'on':'off'}</td><td>${escapeHtml(i.target)}</td><td><form method="post" action="/actions/integration-toggle"><input type="hidden" name="id" value="${i.id}"/><button>${i.enabled ? 'Выключить' : 'Включить'}</button></form></td></tr>`).join('');
    res.send(layout('Интеграции', `<div class="grid-2"><div class="card"><h2>🔗 Добавить интеграцию</h2><form method="post" action="/actions/integration-save"><select name="type"><option value="youtube">YouTube</option><option value="twitch">Twitch</option><option value="github">GitHub</option><option value="rss">RSS</option></select><input name="name" placeholder="Название"/><input name="target" placeholder="URL/канал/репозиторий"/><button>Добавить</button></form></div><div class="card"><h2>ℹ️ Статус</h2><p class="muted">Интеграции пока являются заготовками: веб-панель хранит настройки, а реальные проверки API можно подключить отдельным модулем.</p></div></div><div class="card section wide"><h2>🔗 Интеграции</h2><table><tr><th>ID</th><th>Тип</th><th>Название</th><th>Статус</th><th>Target</th><th>Действие</th></tr>${rows || '<tr><td colspan="6">Интеграций пока нет.</td></tr>'}</table></div>`, req.query.message));
  });
  app.get('/logs', (req, res) => {
    const db = readDatabase(); const storage = getStorageInfo();
    const warns = (db.warnings || []).slice(-30).reverse().map(w => `<tr><td>warn #${w.id}</td><td>${escapeHtml(w.username || w.userId)}</td><td>${escapeHtml(w.reason || '-')}</td><td>${escapeHtml(w.createdAt || '-')}</td></tr>`).join('');
    const automod = (db.automodLogs || []).slice(-30).reverse().map(l => `<tr><td>automod #${l.id}</td><td>${escapeHtml(l.username)}</td><td>${escapeHtml((l.reasons||[]).join(', '))}</td><td>${escapeHtml(l.createdAt || '-')}</td></tr>`).join('');
    res.send(layout('Логи', `<div class="grid"><div class="card"><h2>🗄 База</h2><p><span class="pill">driver: ${escapeHtml(storage.driver)}</span></p><p class="small muted">SQLite: ${escapeHtml(storage.sqlitePath)}</p><p class="small muted">JSON: ${escapeHtml(storage.jsonPath)}</p></div><div class="card"><h2>💾 Резервная копия</h2><p class="muted">Для создания копии из консоли используй npm run db:backup.</p><div class="code">npm run db:backup</div></div></div><div class="card section wide"><h2>📜 Последние логи</h2><table><tr><th>Тип</th><th>Участник</th><th>Детали</th><th>Дата</th></tr>${warns}${automod || ''}${(!warns && !automod) ? '<tr><td colspan="4">Логов пока нет.</td></tr>' : ''}</table></div>`, req.query.message));
  });

  app.post('/actions/automod-save', (req, res) => {
    updateSettings({ automodEnabled: parseBoolForm(req.body.automodEnabled), automodAntiSpam: parseBoolForm(req.body.automodAntiSpam), automodAntiCaps: parseBoolForm(req.body.automodAntiCaps), automodBlockLinks: parseBoolForm(req.body.automodBlockLinks), automodMaxMentions: Number(req.body.automodMaxMentions) || 6, automodMutedMinutes: Number(req.body.automodMutedMinutes) || 10, automodForbiddenWords: String(req.body.automodForbiddenWords || '').split(',').map(x => x.trim()).filter(Boolean) });
    res.redirect(redirect('/automod', 'Настройки AutoMod сохранены.'));
  });
  app.post('/actions/core-settings', (req, res) => { const before = getSettings(); updateSettings({ xpPerMessage: asInt(req.body.xpPerMessage, 5), xpCooldownSeconds: asInt(req.body.xpCooldownSeconds, 60), dailyCoins: asInt(req.body.dailyCoins, 100), dailyXp: asInt(req.body.dailyXp, 25), dailyCooldownHours: asInt(req.body.dailyCooldownHours, 24) }); addAudit('settings_core_update', { name: 'Web Panel' }, { source: 'web', before, after: getSettings() }); res.redirect(redirect('/settings', 'Настройки XP и daily сохранены.')); });
  app.post('/actions/channel-settings', (req, res) => { updateSettings({ logChannelName: String(req.body.logChannelName || ''), eventsChannelName: String(req.body.eventsChannelName || ''), miniGamesChannelName: String(req.body.miniGamesChannelName || ''), moderationPanelChannelName: String(req.body.moderationPanelChannelName || '') }); res.redirect(redirect('/settings', 'Названия каналов сохранены.')); });
  app.post('/actions/set-setting', (req, res) => { const result = setSetting(req.body.key, req.body.value); res.redirect(redirect('/settings', result.ok ? 'Настройка сохранена.' : 'Не удалось сохранить настройку.')); });
  app.post('/actions/game-panel', async (req, res) => { const guild = getGuild(client); const result = guild ? await sendGamePanelToMiniGames(guild) : { ok: false }; res.redirect(redirect(req.headers.referer?.includes('/settings') ? '/settings' : '/', result.ok ? 'Панель мини-игр отправлена.' : 'Не удалось отправить панель мини-игр. Проверь канал 🎲・мини-игры.')); });
  app.post('/actions/mod-panel', async (req, res) => { const guild = getGuild(client); const result = guild ? await sendModerationPanel(guild).catch(() => ({ok:false})) : { ok: false }; res.redirect(redirect('/moderation', result.ok ? 'Панель модерации отправлена.' : 'Не удалось отправить панель модерации.')); });
  app.post('/actions/voice-setup', async (req, res) => {
    const guild = getGuild(client);
    if (!guild) return res.redirect(redirect('/voice', 'Сервер не найден.'));
    const channel = await ensureCreateChannel(guild).catch(error => { console.error(error); return null; });
    res.redirect(redirect('/voice', channel ? `Канал ${channel.name} готов.` : 'Не удалось создать voice-канал.'));
  });
  app.post('/actions/voice-panel', async (req, res) => {
    const guild = getGuild(client);
    const channel = guild?.channels.cache.get(req.body.channelId);
    const ok = channel && channel.send ? await safeSend(channel, buildVoicePanel()) : false;
    res.redirect(redirect('/voice', ok ? 'Voice-панель отправлена.' : 'Не удалось отправить voice-панель.'));
  });

  app.post('/actions/publish-panel', async (req, res) => {
    const guild = getGuild(client); const channel = guild?.channels.cache.get(req.body.channelId);
    if (!channel || !channel.send) return res.redirect(redirect('/panels', 'Канал не найден.'));
    const type = String(req.body.type || 'main');
    let ok = false;
    if (type === 'main') ok = await safeSend(channel, buildMainMenuPayload());
    else if (type === 'roles') ok = await safeSend(channel, buildRolePanel());
    else if (type === 'games') ok = await safeSend(channel, require('../services/gamePanel').buildGamePanel ? require('../services/gamePanel').buildGamePanel() : { content: '🎲 Используйте /game или /gamepanel.' });
    else if (type === 'moderation') { const result = await sendModerationPanel(guild).catch(() => ({ok:false})); ok = result.ok; }
    else if (type === 'applications') ok = await safeSend(channel, buildApplicationPanel());
    else if (type === 'tickets') ok = await safeSend(channel, { embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('🎫 Поддержка').setDescription('Нужна помощь? Создай тикет командой `/ticket` или опиши проблему администрации.').setTimestamp()], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket:create').setLabel('Создать тикет').setEmoji('🎫').setStyle(ButtonStyle.Primary))] });
    else if (type === 'voice') ok = await safeSend(channel, { embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('🔊 Голосовые комнаты').setDescription('Зайди в канал `➕・создать-комнату`, чтобы бот создал личную voice-комнату.').setTimestamp()] });
    else if (type === 'shop') ok = await safeSend(channel, buildShopPanel());
    else if (type === 'commands') ok = await safeSend(channel, buildPublicCommandsPanel());
    else if (type === 'modcommands') ok = await safeSend(channel, buildModerationCommandsPanel());
    if (ok) registerPanelPublish(type, channel.id, channel.name, 'web-panel');
    addAudit('panel_publish', { name: 'Web Panel' }, { source: 'web', type, channelId: req.body.channelId, ok });
    res.redirect(redirect('/panels', ok ? 'Панель опубликована.' : 'Не удалось опубликовать панель. Проверь права бота и канал.'));
  });

  app.post('/actions/role-panel', async (req, res) => { const guild = getGuild(client); const channel = findTextChannelByName(guild, '✅・получить-роли'); const ok = await safeSend(channel, buildRolePanel()); res.redirect(redirect('/settings', ok ? 'Панель ролей отправлена.' : 'Канал ✅・получить-роли не найден.')); });
  app.post('/actions/send-message', async (req, res) => { const guild = getGuild(client); const channel = guild?.channels.cache.get(req.body.channelId); const message = String(req.body.message || '').trim(); const ok = channel && message ? await safeSend(channel, message.slice(0, 1900)) : false; res.redirect(redirect(req.body.redirect || '/settings', ok ? 'Сообщение отправлено.' : 'Не удалось отправить сообщение.')); });
  app.post('/actions/user-adjust', (req, res) => { const db = readDatabase(); const user = db.users?.[req.body.userId]; if (!user) return res.redirect(redirect('/users', 'Участник не найден.')); const field = String(req.body.field || 'coins'); const allowed = ['xp','coins','reputation','seasonXp','messages','level']; if (!allowed.includes(field)) return res.redirect(redirect('/users', 'Недопустимое поле.')); const amount = asInt(req.body.amount, 0); const current = asInt(user[field], 0); if (req.body.mode === 'set') user[field] = Math.max(amount, 0); else if (req.body.mode === 'subtract') user[field] = Math.max(current - amount, 0); else user[field] = Math.max(current + amount, 0); user.updatedAt = new Date().toISOString(); db.users[user.discordId] = user; writeDatabase(db); addAudit('user_adjust', { name: 'Web Panel' }, { source: 'web', targetId: user.discordId, field, mode: req.body.mode, amount, before: current, after: user[field] }); res.redirect(redirect(`/user/${encodeURIComponent(user.discordId)}`, `Поле ${field} обновлено.`)); });
  app.post('/actions/user-achievement', (req, res) => { const db = readDatabase(); const user = db.users?.[req.body.userId]; if (!user) return res.redirect(redirect('/users', 'Участник не найден.')); const a = String(req.body.achievement || '').trim(); if (!a) return res.redirect(redirect(`/user/${user.discordId}`, 'Укажи achievement_id.')); if (!Array.isArray(user.achievements)) user.achievements = []; if (!Array.isArray(user.badges)) user.badges = []; if (!user.achievements.includes(a)) user.achievements.push(a); if (!user.badges.includes('🏅')) user.badges.push('🏅'); user.updatedAt = new Date().toISOString(); db.users[user.discordId] = user; writeDatabase(db); res.redirect(redirect(`/user/${user.discordId}`, 'Достижение выдано.')); });

  app.post('/actions/user-profile-save', (req, res) => {
    const db = readDatabase();
    const user = db.users?.[req.body.userId];
    if (!user) return res.redirect(redirect('/users', 'Участник не найден.'));
    user.profileCustomization = {
      ...(user.profileCustomization || {}),
      title: String(req.body.title || 'Участник сервера').slice(0, 48),
      about: String(req.body.about || 'Описание профиля пока не заполнено.').slice(0, 180),
      color: String(req.body.color || 'blurple'),
      background: String(req.body.background || 'dark'),
      mainBadge: String(req.body.mainBadge || '').trim() || null,
      showBadges: true,
      showStats: true
    };
    user.updatedAt = new Date().toISOString();
    db.users[user.discordId] = user;
    writeDatabase(db);
    res.redirect(redirect(`/user/${encodeURIComponent(user.discordId)}`, 'Оформление профиля сохранено.'));
  });

  app.post('/actions/user-reset-daily', (req, res) => { const db = readDatabase(); const user = db.users?.[req.body.userId]; if (user) { delete user.lastDailyAt; user.updatedAt = new Date().toISOString(); db.users[user.discordId] = user; writeDatabase(db); } res.redirect(redirect(`/user/${encodeURIComponent(req.body.userId)}`, user ? 'Cooldown daily сброшен.' : 'Участник не найден.')); });
  app.post('/actions/warning-deactivate', (req, res) => { const id = Number(req.body.id); const result = removeWarning(id, process.env.GUILD_ID, 'web-panel', 'Web Panel', String(req.body.reason || 'Снято через веб-панель.')); res.redirect(redirect(req.body.returnTo || '/moderation', result.ok ? `Предупреждение #${id} снято.` : 'Предупреждение не найдено или уже снято.')); });
  app.post('/actions/appeal-status', (req, res) => { const result = updateAppealStatus(Number(req.body.id), process.env.GUILD_ID, String(req.body.status || 'open'), 'web-panel', 'Web Panel', String(req.body.response || 'Решение принято через веб-панель.')); res.redirect(redirect('/moderation', result.ok ? `Апелляция #${req.body.id} обновлена.` : 'Апелляция не найдена.')); });
  app.post('/actions/shop-save', (req, res) => { const items = getShopItemsFromDb().filter(i => i.id !== String(req.body.id)); items.push({ id: String(req.body.id).trim(), name: String(req.body.name || '').trim(), description: String(req.body.description || '').trim(), price: asInt(req.body.price, 0), type: String(req.body.type || 'role'), category: String(req.body.category || '').trim(), roleName: String(req.body.roleName || '').trim(), cosmeticType: String(req.body.cosmeticType || '').trim(), value: String(req.body.value || '').trim(), boostType: String(req.body.boostType || '').trim(), multiplier: Number(req.body.multiplier || 1), durationHours: asInt(req.body.durationHours, 0), enabled: parseBoolForm(req.body.enabled) }); saveShopItems(items.filter(i => i.id && i.name)); res.redirect(redirect('/shop-admin', 'Товар сохранен.')); });
  app.post('/actions/shop-delete', (req, res) => { saveShopItems(getShopItemsFromDb().filter(i => i.id !== String(req.body.id))); res.redirect(redirect('/shop-admin', 'Товар удален.')); });
  app.post('/actions/event-create', async (req, res) => { const guild = getGuild(client); if (!guild) return res.redirect(redirect('/events', 'Сервер не найден.')); const fake = { guild, user: { id: client.user.id, username: client.user.username } }; const result = await createEvent(fake, { title: String(req.body.title || '').slice(0, 80), description: String(req.body.description || '').slice(0, 1000), dateInput: String(req.body.date || ''), maxMembers: Number(req.body.max) || 0 }).catch(e => { console.error(e); return { ok: false, reason: 'error' }; }); res.redirect(redirect('/events', result.ok ? `Ивент #${result.event.id} создан.` : 'Не удалось создать ивент. Проверь дату.')); });
  app.post('/actions/event-cancel', (req, res) => { const db = readDatabase(); const ev = db.events?.[String(req.body.id)]; if (ev) { ev.status = 'closed'; ev.updatedAt = new Date().toISOString(); db.events[String(req.body.id)] = ev; writeDatabase(db); } res.redirect(redirect('/events', ev ? `Ивент #${ev.id} закрыт.` : 'Ивент не найден.')); });
  app.post('/actions/event-open', (req, res) => { const db = readDatabase(); const ev = db.events?.[String(req.body.id)]; if (ev) { ev.status = 'open'; ev.updatedAt = new Date().toISOString(); db.events[String(req.body.id)] = ev; writeDatabase(db); } res.redirect(redirect('/events', ev ? `Ивент #${ev.id} открыт.` : 'Ивент не найден.')); });
  app.post('/actions/ticket-close', async (req, res) => { const db = readDatabase(); const t = db.tickets?.[String(req.body.id)]; if (t) { t.status = 'closed'; t.closedAt = new Date().toISOString(); db.tickets[String(req.body.id)] = t; writeDatabase(db); const guild = getGuild(client); const channel = guild?.channels.cache.get(t.channelId); if (channel) await channel.delete('Ticket closed from web panel').catch(() => null); } res.redirect(redirect('/tickets', t ? `Тикет #${t.id} закрыт.` : 'Тикет не найден.')); });
  app.post('/actions/ticket-open', (req, res) => { const db = readDatabase(); const t = db.tickets?.[String(req.body.id)]; if (t) { t.status = 'open'; t.closedAt = null; db.tickets[String(req.body.id)] = t; writeDatabase(db); } res.redirect(redirect('/tickets', t ? `Тикет #${t.id} открыт в базе.` : 'Тикет не найден.')); });
  app.post('/actions/tournament-create', (req, res) => { const t = createTournament(client.user.id, client.user.username, req.body.title, Number(req.body.max) || 16, req.body.description || ''); res.redirect(redirect('/tournaments', `Турнир #${t.id} создан.`)); });
  app.post('/actions/tournament-cancel', (req, res) => { const r = closeTournament(Number(req.body.id), 'cancelled'); res.redirect(redirect('/tournaments', r.ok ? `Турнир #${r.tournament.id} закрыт.` : 'Турнир не найден.')); });
  app.post('/actions/season-save', (req, res) => { updateSettings({ seasonName: String(req.body.seasonName || 'Сезон 1'), seasonActive: parseBoolForm(req.body.seasonActive), seasonEndsAt: String(req.body.seasonEndsAt || '') || null }); res.redirect(redirect('/season', 'Настройки сезона сохранены.')); });
  app.post('/actions/battlepass-premium', (req, res) => { const db = readDatabase(); const user = db.users?.[req.body.userId]; if (user) setBattlePassPremium(user.discordId, user.username, String(req.body.enabled) === 'true'); res.redirect(redirect('/season', user ? 'Статус Premium Battle Pass обновлен.' : 'Участник не найден.')); });
  app.post('/actions/clan-bank', (req, res) => { const db = readDatabase(); const c = db.clans?.[String(req.body.id)]; if (c) { c.bank = Math.max((Number(c.bank) || 0) + asInt(req.body.amount, 0), 0); db.clans[String(c.id)] = c; writeDatabase(db); } res.redirect(redirect('/clans', c ? `Банк клана #${c.id} обновлен.` : 'Клан не найден.')); });
  app.post('/actions/application-status', async (req, res) => { const result = updateApplicationStatus(Number(req.body.id), String(req.body.status || 'pending'), client.user.id, 'Web Panel', String(req.body.comment || '')); if (result.ok) await notifyApplicant(client, result.application, result.application.status, result.application.moderatorComment || '').catch(() => null); res.redirect(redirect('/applications', result.ok ? `Заявка #${result.application.id} обновлена.` : 'Заявка не найдена.')); });
  app.post('/actions/apply-panel', async (req, res) => { const guild = getGuild(client); const channel = guild?.channels.cache.get(req.body.channelId); if (!channel || !channel.send) return res.redirect(redirect('/applications', 'Канал не найден.')); await channel.send(buildApplicationPanel()).catch(console.error); res.redirect(redirect('/applications', 'Панель заявок отправлена.')); });

  app.post('/actions/suggestion-create', async (req, res) => {
    const db = readDatabase();
    if (!db.suggestions) db.suggestions = {};
    db.suggestionCounter = Number(db.suggestionCounter || 0) + 1;
    const id = db.suggestionCounter;
    const suggestion = { id, userId: client.user.id, username: 'Web Panel', idea: String(req.body.idea || '').slice(0, 900), status: 'open', votes: { up: {}, down: {} }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), channelId: null, messageId: null, adminComment: null };
    db.suggestions[String(id)] = suggestion;
    writeDatabase(db);
    const guild = getGuild(client);
    let channel = guild?.channels.cache.get(req.body.channelId) || await createSuggestionsChannel(guild).catch(() => null);
    if (channel?.send) {
      const msg = await channel.send({ embeds: [buildSuggestionEmbed(suggestion, guild)], components: buildSuggestionButtons(suggestion) }).catch(() => null);
      if (msg) { const latest = readDatabase(); latest.suggestions[String(id)].channelId = channel.id; latest.suggestions[String(id)].messageId = msg.id; writeDatabase(latest); }
    }
    res.redirect(redirect('/suggestions-panel', `Предложение #${id} создано.`));
  });

  app.post('/actions/suggestion-status', async (req, res) => {
    const db = readDatabase();
    const s = db.suggestions?.[String(req.body.id)];
    if (s) {
      s.status = String(req.body.status || 'open');
      s.adminComment = String(req.body.comment || '').trim() || s.adminComment || null;
      s.updatedAt = new Date().toISOString();
      db.suggestions[String(s.id)] = s;
      writeDatabase(db);
      const guild = getGuild(client);
      if (guild && s.channelId && s.messageId) {
        const channel = await guild.channels.fetch(s.channelId).catch(() => null);
        const msg = await channel?.messages?.fetch(s.messageId).catch(() => null);
        await msg?.edit({ embeds: [buildSuggestionEmbed(s, guild)], components: buildSuggestionButtons(s) }).catch(() => null);
      }
    }
    res.redirect(redirect('/suggestions-panel', s ? `Статус предложения #${s.id} обновлен.` : 'Предложение не найдено.'));
  });

  app.post('/actions/poll-create', async (req, res) => {
    const options = String(req.body.options || '').split('|').map(x => x.trim()).filter(Boolean).slice(0, 5);
    if (options.length < 2) return res.redirect(redirect('/suggestions-panel', 'Нужно минимум 2 варианта ответа.'));
    const db = readDatabase();
    if (!db.polls) db.polls = {};
    db.pollCounter = Number(db.pollCounter || 0) + 1;
    const id = db.pollCounter;
    const poll = { id, userId: client.user.id, username: 'Web Panel', question: String(req.body.question || '').slice(0, 250), options, votes: {}, status: 'open', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), channelId: null, messageId: null };
    db.polls[String(id)] = poll;
    writeDatabase(db);
    const guild = getGuild(client);
    let channel = guild?.channels.cache.get(req.body.channelId) || await createSuggestionsChannel(guild).catch(() => null);
    if (channel?.send) {
      const msg = await channel.send({ embeds: [buildPollEmbed(poll)], components: buildPollButtons(poll) }).catch(() => null);
      if (msg) { const latest = readDatabase(); latest.polls[String(id)].channelId = channel.id; latest.polls[String(id)].messageId = msg.id; writeDatabase(latest); }
    }
    res.redirect(redirect('/suggestions-panel', `Опрос #${id} создан.`));
  });

  app.post('/actions/poll-status', async (req, res) => {
    const db = readDatabase();
    const p = db.polls?.[String(req.body.id)];
    if (p) {
      p.status = String(req.body.status || 'open');
      p.updatedAt = new Date().toISOString();
      db.polls[String(p.id)] = p;
      writeDatabase(db);
      const guild = getGuild(client);
      if (guild && p.channelId && p.messageId) {
        const channel = await guild.channels.fetch(p.channelId).catch(() => null);
        const msg = await channel?.messages?.fetch(p.messageId).catch(() => null);
        await msg?.edit({ embeds: [buildPollEmbed(p)], components: buildPollButtons(p) }).catch(() => null);
      }
    }
    res.redirect(redirect('/suggestions-panel', p ? `Статус опроса #${p.id} обновлен.` : 'Опрос не найден.'));
  });

  app.post('/actions/integration-save', (req, res) => { const db = readDatabase(); if (!Array.isArray(db.integrations)) db.integrations = []; const nextId = db.integrations.reduce((m, i) => Math.max(m, Number(i.id)||0), 0) + 1; db.integrations.push({ id: nextId, type: String(req.body.type || 'rss'), name: String(req.body.name || 'Integration'), target: String(req.body.target || ''), enabled: true, createdAt: new Date().toISOString() }); writeDatabase(db); res.redirect(redirect('/integrations', 'Интеграция добавлена.')); });
  app.post('/actions/integration-toggle', (req, res) => { const db = readDatabase(); const i = (db.integrations || []).find(x => Number(x.id) === Number(req.body.id)); if (i) { i.enabled = !i.enabled; writeDatabase(db); } res.redirect(redirect('/integrations', i ? 'Статус интеграции изменен.' : 'Интеграция не найдена.')); });


  app.post('/actions/notifications-save', (req, res) => {
    updateNotificationSettings({
      channelId: String(req.body.channelId || '').trim() || null,
      daily: parseBoolForm(req.body.daily),
      events: parseBoolForm(req.body.events),
      tournaments: parseBoolForm(req.body.tournaments),
      season: parseBoolForm(req.body.season),
      tickets: parseBoolForm(req.body.tickets),
      eventReminderMinutes: asInt(req.body.eventReminderMinutes, 30),
      staleTicketHours: asInt(req.body.staleTicketHours, 12),
    });
    res.redirect(redirect('/notifications', 'Настройки уведомлений сохранены.'));
  });

  app.post('/actions/notifications-check', async (req, res) => {
    await runNotificationChecks(client).catch(console.error);
    res.redirect(redirect('/notifications', 'Проверка уведомлений выполнена.'));
  });

  app.post('/actions/reminder-create', (req, res) => {
    const guild = getGuild(client);
    const member = guild?.members.cache.get(req.body.userId);
    const result = createReminder(String(req.body.userId || ''), member?.user?.username || 'Web User', guild?.id || process.env.GUILD_ID, String(req.body.channelId || ''), String(req.body.message || ''), String(req.body.time || ''), String(req.body.mode || 'channel'));
    res.redirect(redirect('/notifications', result.ok ? `Напоминание #${result.reminder.id} создано.` : 'Не удалось создать напоминание. Проверь дату/время.'));
  });

  app.post('/actions/reminder-cancel', (req, res) => {
    const result = cancelReminder(client.user.id, Number(req.body.id), { permissions: { has: () => true } });
    res.redirect(redirect('/notifications', result.ok ? `Напоминание #${req.body.id} отменено.` : 'Напоминание не найдено.'));
  });




  app.get('/project', (req, res) => {
    const pkg = require('../../package.json');
    const body = `<div class="grid"><div class="card"><h2>📦 Версия проекта</h2><div class="stat">${escapeHtml(pkg.version)}</div><p class="muted">${escapeHtml(pkg.description || '')}</p></div><div class="card"><h2>📁 Структура</h2><p class="muted"><b>src</b> — код, <b>data</b> — база и бэкапы, <b>logs</b> — журналы, <b>docs</b> — документация.</p></div><div class="card"><h2>🛠 Полезные команды</h2><p class="code">npm run check
npm run env:check
npm run safe:update
npm run hosting:check
npm run net:check
npm run doctor
npm run cleanup</p></div></div><div class="card section"><h2>⚙️ Централизованная конфигурация</h2><p class="muted">Основные имена каналов и ролей вынесены в <code>src/config/serverConfig.js</code>. Секреты остаются в <code>.env</code>.</p><table><tr><th>Каналы</th><td>${escapeHtml(Object.values(CHANNELS).join(', '))}</td></tr><tr><th>Роли</th><td>${escapeHtml(Object.values(ROLES).join(', '))}</td></tr><tr><th>Defaults</th><td>${escapeHtml(JSON.stringify(DEFAULTS))}</td></tr></table></div>`;
    res.send(layout('Проект', body, req.query.message));
  });



  app.get('/network', async (req, res) => {
    const report = await buildNetworkReport({ timeoutMs: 8000 }).catch(error => ({
      checks: [{ ok: false, label: 'Network-check не смог выполниться', hint: error.message }],
      okCount: 0,
      total: 1,
      advice: ['Проверь системный VPN, Firewall и доступ Node.js к Discord API.'],
      timeoutMs: 8000,
    }));
    const rows = report.checks.map(item => `<tr><td class="nowrap">${item.ok ? '<span class="status-ok">✅ OK</span>' : '<span class="status-warn">⚠️ Проверить</span>'}</td><td>${escapeHtml(item.label)}</td><td>${escapeHtml(item.hint || (item.ok ? 'Настроено корректно' : 'Требуется проверка'))}</td></tr>`).join('');
    const advice = (report.advice || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
    const body = `<div class="grid"><div class="card"><h2>🌐 Диагностика сети</h2><div class="stat">${report.okCount}/${report.total}</div><p class="muted">Проверка доступа Node.js к Discord API. Это помогает отличить ошибку кода от проблемы локальной сети.</p></div><div class="card"><h2>Команды</h2><p class="code">npm run net:check
npm run doctor
/network-check</p><p class="muted">Если Discord работает в браузере, но здесь timeout, скорее всего браузер использует другой маршрут/VPN.</p></div><div class="card"><h2>Timeout</h2><p><b>Текущее значение:</b> ${Number(report.timeoutMs || 0)} ms</p><p class="muted">Для REST-запросов бота используется <code>DISCORD_REST_TIMEOUT</code> в .env.</p></div></div><div class="card section wide"><h2>📋 Проверки</h2><table><tr><th>Статус</th><th>Проверка</th><th>Подсказка</th></tr>${rows}</table></div><div class="card section"><h2>Что делать при timeout</h2><ol>${advice}</ol></div>`;
    res.send(layout('Диагностика сети', body, req.query.message, req.query.warning));
  });

  app.get('/hosting', (req, res) => {
    const report = buildHostingReadiness();
    const rows = report.checks.map(item => `<tr><td>${item.ok ? '<span class="status-ok">✅ OK</span>' : '<span class="status-warn">⚠️ Проверить</span>'}</td><td>${escapeHtml(item.label)}</td><td>${escapeHtml(item.hint || 'Готово')}</td></tr>`).join('');
    const body = `<div class="grid"><div class="card"><h2>🚀 Готовность к хостингу</h2><div class="stat">${report.okCount}/${report.total}</div><p class="muted">Перед переносом на VPS/Railway/Render проверь все предупреждения.</p></div><div class="card"><h2>Команды</h2><p class="code">npm run hosting:check
/hosting-check
npm run safe:update</p></div><div class="card"><h2>Важно для SQLite</h2><p class="muted">На хостинге нужен постоянный диск для <code>data/database.sqlite</code> и <code>data/backups</code>.</p></div></div><div class="card section"><h2>Проверки</h2><table><tr><th>Статус</th><th>Пункт</th><th>Подсказка</th></tr>${rows}</table></div>`;
    res.send(layout('Хостинг', body, req.query.message));
  });

  app.get('/docs', (req, res) => {
    res.send(layout('Документация', `<div class="card"><h2>📚 Документация ServerCore</h2><p class="muted">Краткая документация встроена в веб-панель, чтобы не искать README в папке проекта.</p></div>${docsHtml(escapeHtml)}`));
  });

  app.get('/audit', (req, res) => {
    let items = listAudit(300);
    const q = queryValue(req, 'q').toLowerCase();
    const filter = queryValue(req, 'filter', 'all');
    if (q) items = items.filter(a => containsText(a.action, q) || containsText(a.actorName, q) || containsText(JSON.stringify(a.details || {}), q));
    if (filter !== 'all') items = items.filter(a => String(a.action || '').includes(filter) || String(a.source || a.details?.source || '') === filter);
    const pg = paginate(items, req, 30);
    const toolbar = tableToolbar('/audit', req, [['new','Новые сверху']], [['all','Все'],['web','Web Panel'],['login','Входы'],['setting','Настройки'],['backup','Бэкапы'],['user','Участники']]);
    const rows = pg.items.map(a => `<tr><td>#${a.id}</td><td>${escapeHtml(a.action)}</td><td>${escapeHtml(a.actorName || a.actorId || '-')}</td><td>${escapeHtml(a.source || a.details?.source || '-')}</td><td><div class="code small">${escapeHtml(JSON.stringify(a.details || {}, null, 2)).slice(0, 1200)}</div></td><td>${escapeHtml(a.createdAt || '')}</td></tr>`).join('');
    const body = `<div class="card"><h2>📜 Audit</h2><p class="muted">Журнал действий администраторов и веб-панели. Для важных операций отображаются источник и детали изменения.</p>${toolbar}<div class="table-wrap"><table><tr><th>ID</th><th>Действие</th><th>Кто</th><th>Источник</th><th>Детали</th><th>Дата</th></tr>${rows || '<tr><td colspan="6">Записей нет.</td></tr>'}</table></div>${pager('/audit', req, pg.page, pg.pages)}</div>`;
    res.send(layout('Audit', body, req.query.message));
  });



  app.get('/maintenance', (req, res) => {
    const state = getMaintenance();
    const body = `<div class="grid-2"><div class="card"><h2>🛠 Режим обслуживания</h2><p class="muted">Когда режим включен, обычные пользовательские команды временно блокируются. Админские команды остаются доступны.</p><p><b>Статус:</b> ${state.enabled ? '<span class="status-warn">включен</span>' : '<span class="status-ok">выключен</span>'}</p><p><b>Причина:</b> ${escapeHtml(state.reason || '—')}</p><p><b>Последнее изменение:</b> ${escapeHtml(state.updatedAt || '—')}</p></div><div class="card"><h2>Управление</h2><form method="post" action="/actions/maintenance"><select name="enabled"><option value="true">Включить</option><option value="false">Выключить</option></select><textarea name="reason" placeholder="Причина обслуживания">${escapeHtml(state.reason || 'Проводятся технические работы.')}</textarea><button>Сохранить</button></form></div></div>`;
    res.send(layout('Обслуживание', body, req.query.message));
  });

  app.post('/actions/maintenance', (req, res) => {
    const enabled = String(req.body.enabled) === 'true';
    const state = setMaintenance(enabled, String(req.body.reason || ''), { username: 'web-panel', id: 'web' });
    addAudit(enabled ? 'maintenance_on_web' : 'maintenance_off_web', { username: 'web-panel', id: 'web' }, { reason: state.reason });
    res.redirect(redirect('/maintenance', enabled ? 'Режим обслуживания включен.' : 'Режим обслуживания выключен.'));
  });

  app.get('/health', async (req, res) => {
    const guild = getGuild(client);
    const report = await buildHealthReport(client, guild).catch(error => ({
      checks: [{ ok: false, label: 'Health-check не смог выполниться', hint: error.message }],
      okCount: 0,
      total: 1,
      driver: 'unknown',
      sqlitePath: '',
      users: 0,
    }));
    const rows = report.checks.map(item => `<tr><td class="nowrap">${item.ok ? '<span class="status-ok">✅ OK</span>' : '<span class="status-warn">⚠️ Проверить</span>'}</td><td>${escapeHtml(item.label)}</td><td>${escapeHtml(item.hint || (item.ok ? 'Настроено корректно' : 'Требуется проверка'))}</td></tr>`).join('');
    const percent = report.total ? Math.round((report.okCount / report.total) * 100) : 0;
    const body = `<div class="grid"><div class="card"><h2>🩺 Health-check проекта</h2><div class="stat">${report.okCount}/${report.total}</div><p class="muted">Проверок успешно пройдено.</p></div><div class="card"><h2>💾 Хранилище</h2><p><b>Драйвер:</b> ${escapeHtml(report.driver || 'unknown')}</p><p><b>SQLite:</b> ${escapeHtml(report.sqlitePath || 'не указан')}</p><p><b>Пользователей в базе:</b> ${Number(report.users || 0)}</p></div><div class="card"><h2>📊 Готовность</h2><div class="stat">${percent}%</div><p class="muted">Если есть предупреждения, проверь права бота, каналы и переменные .env.</p></div></div><div class="card section wide"><h2>📋 Проверки</h2><table><tr><th>Статус</th><th>Проверка</th><th>Подсказка</th></tr>${rows}</table></div><div class="card section"><h2>Подсказки</h2><p class="muted">Если канал не найден, запусти <code>npm run setup</code> или создай канал вручную. Для AutoMod нужен Message Content Intent, а для приветствия новых пользователей — Server Members Intent в Discord Developer Portal.</p></div>`;
    res.send(layout('Health-check', body, req.query.message, req.query.warning));
  });

  app.get('/backups', (req, res) => {
    cleanupOldExports();
    const backups = listBackups();
    const rows = backups.map(b => `<tr><td><code>${escapeHtml(b.name)}</code></td><td>${Math.round(b.size / 1024)} КБ</td><td>${escapeHtml(b.modifiedAt)}</td><td><div class="actions"><a class="pill" href="/download/backup/${encodeURIComponent(b.name)}">Скачать</a><form method="post" action="/actions/backup-restore" onsubmit="return confirm('Восстановить базу из этого бэкапа? Текущие данные будут заменены.')"><input type="hidden" name="name" value="${escapeHtml(b.name)}"/><button class="green">Восстановить</button></form><form method="post" action="/actions/backup-delete" onsubmit="return confirm('Удалить этот бэкап?')"><input type="hidden" name="name" value="${escapeHtml(b.name)}"/><button class="danger">Удалить</button></form></div></td></tr>`).join('');
    const body = `<div class="grid-2"><div class="card"><h2>💾 Резервные копии</h2><p class="muted">Бэкап сохраняет текущее состояние базы в JSON. Перед восстановлением автоматически создается страховая копия.</p><form method="post" action="/actions/backup-create"><input name="name" placeholder="Название, например before-update"/><button>Создать бэкап</button></form></div><div class="card"><h2>📤 Экспорт данных</h2><p class="muted">Экспорт можно скачать как JSON или CSV. CSV доступен для пользователей, экономики и предупреждений.</p><form method="post" action="/actions/export-data"><select name="type"><option value="users">Пользователи</option><option value="economy">Экономика</option><option value="warnings">Предупреждения</option><option value="all">Все данные</option></select><select name="format"><option value="json">JSON</option><option value="csv">CSV</option></select><button>Скачать экспорт</button></form></div></div><div class="card section wide"><h2>📦 Список бэкапов</h2><table><tr><th>Файл</th><th>Размер</th><th>Изменен</th><th>Действия</th></tr>${rows || '<tr><td colspan="4">Бэкапов пока нет.</td></tr>'}</table></div>`;
    res.send(layout('Бэкапы', body, req.query.message, req.query.warning));
  });

  app.post('/actions/backup-create', (req, res) => {
    const b = createBackup(req.body.name || '', { source: 'web-panel' });
    addAudit('backup_create_web', { username: 'web-panel', id: 'web' }, { name: b.name });
    res.redirect(redirect('/backups', `Бэкап ${b.name} создан.`));
  });

  app.post('/actions/backup-restore', (req, res) => {
    createBackup(`auto-before-web-restore-${Date.now()}`, { source: 'auto-before-web-restore' });
    const result = restoreBackup(req.body.name);
    res.redirect(result.ok ? redirect('/backups', `База восстановлена из ${result.name}.`) : redirect('/backups', '', 'Бэкап не найден.'));
  });

  app.post('/actions/backup-delete', (req, res) => {
    const result = deleteBackup(req.body.name);
    res.redirect(result.ok ? redirect('/backups', `Бэкап ${result.name} удален.`) : redirect('/backups', '', 'Бэкап не найден.'));
  });

  app.post('/actions/export-data', (req, res) => {
    const result = exportData(String(req.body.type || 'all'), String(req.body.format || 'json'));
    res.download(result.path, result.name);
  });

  app.get('/download/backup/:name', (req, res) => {
    const b = listBackups().find(item => item.name === req.params.name);
    if (!b) return res.status(404).send('Backup not found');
    return res.download(b.path, b.name);
  });

  app.listen(config.port, () => {
    console.log(`Web panel is available at http://localhost:${config.port}`);
    if (!process.env.WEB_PASSWORD) console.warn('WEB_PASSWORD is not set. Default web panel password is: admin');
  });
}
module.exports = { startWebPanel };
