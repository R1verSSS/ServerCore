const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const { addAudit } = require('./auditService');
const { error } = require('./responseService');

const ACCESS_LEVELS = {
  MEMBER: 0,
  VIP: 10,
  HELPER: 20,
  MODERATOR: 30,
  ADMIN: 40,
  OWNER: 50,
};

const ROLE_NAMES = {
  OWNER: ['👑 Owner', 'Owner'],
  ADMIN: ['🛡 Admin', 'Admin', 'Administrator'],
  MODERATOR: ['👮 Moderator', 'Moderator', 'Модератор'],
  HELPER: ['🧰 Helper', 'Helper', 'Помощник'],
  VIP: ['💎 VIP', 'VIP'],
};

const COMMAND_RULES = {
  // Owner/System
  backup: { level: 'ADMIN', subcommands: { restore: 'OWNER', delete: 'OWNER' } },
  export: { level: 'ADMIN' },
  settings: { level: 'ADMIN' },
  automod: { level: 'MODERATOR', subcommands: { words: 'ADMIN', reset: 'OWNER' } },
  integration: { level: 'ADMIN' },
  maintenance: { level: 'OWNER' },
  'setup-wizard': { level: 'ADMIN' },
  'hosting-check': { level: 'ADMIN' },
  'network-check': { level: 'ADMIN' },
  'production-check': { level: 'ADMIN' },
  'update-check': { level: 'ADMIN' },
  'vps-check': { level: 'ADMIN' },
  dbstatus: { level: 'ADMIN' },
  modpanel: { level: 'MODERATOR' },
  gamepanel: { level: 'ADMIN' },
  applypanel: { level: 'ADMIN' },
  shoppanel: { level: 'ADMIN' },
  musicpanel: { level: 'ADMIN' },
  music: { level: 'MEMBER' },

  // Moderation
  warn: { level: 'MODERATOR' },
  warnings: { level: 'HELPER' },
  warnremove: { level: 'MODERATOR' },
  mute: { level: 'MODERATOR' },
  unmute: { level: 'MODERATOR' },
  clear: { level: 'MODERATOR' },
  kick: { level: 'ADMIN' },
  ban: { level: 'ADMIN' },
  cases: { level: 'HELPER' },
  case: { level: 'HELPER', subcommands: { close: 'MODERATOR' } },
  note: { level: 'HELPER', subcommands: { add: 'MODERATOR' } },
  appeal: { level: 'HELPER', subcommands: { accept: 'MODERATOR', deny: 'MODERATOR' } },
  applications: { level: 'HELPER' },
  application: { level: 'MODERATOR' },

  // Content management
  event: { level: 'MEMBER', subcommands: { create: 'MODERATOR', cancel: 'MODERATOR' } },
  tournament: { level: 'MEMBER', subcommands: { create: 'MODERATOR', cancel: 'MODERATOR', result: 'MODERATOR' } },
  season: { level: 'MEMBER', subcommands: { start: 'ADMIN', stop: 'ADMIN', reset: 'OWNER' } },
  battlepass: { level: 'MEMBER', subcommands: { premium: 'ADMIN' } },
  suggestion: { level: 'MEMBER', subcommands: { status: 'MODERATOR' } },
  poll: { level: 'MEMBER', subcommands: { create: 'MODERATOR', close: 'MODERATOR' } },
  menu: { level: 'MEMBER', subcommands: { post: 'ADMIN' } },
  voice: { level: 'MEMBER', subcommands: { setup: 'ADMIN', list: 'MODERATOR' } },
};

const CONTEXT_RULES = {
  'Профиль': 'MEMBER',
  'Репутация': 'MEMBER',
  'История модерации': 'HELPER',
  'Пожаловаться': 'MEMBER',
  'Удалить сообщение': 'MODERATOR',
  'Warn за сообщение': 'MODERATOR',
};

const BUTTON_RULES = [
  { prefix: 'modpanel:', level: 'MODERATOR' },
  { prefix: 'menu:quick:modpanel', level: 'MODERATOR' },
  { prefix: 'menu:quick:health', level: 'ADMIN' },
  { prefix: 'application:accept:', level: 'MODERATOR' },
  { prefix: 'application:deny:', level: 'MODERATOR' },
  { prefix: 'suggestion:status:', level: 'MODERATOR' },
  { prefix: 'poll:close:', level: 'MODERATOR' },
  { prefix: 'clear:', level: 'MODERATOR' },
  { prefix: 'voice:delete_confirm', level: 'MEMBER' },
  { prefix: 'shop:admin:', level: 'ADMIN' },
];

function normalizeLevel(level = 'MEMBER') {
  return ACCESS_LEVELS[String(level).toUpperCase()] ?? ACCESS_LEVELS.MEMBER;
}

function memberHasAnyRole(member, names = []) {
  if (!member?.roles?.cache) return false;
  return member.roles.cache.some(role => names.includes(role.name));
}

function getMemberLevel(member) {
  if (!member) return ACCESS_LEVELS.MEMBER;
  if (member.id && member.guild?.ownerId === member.id) return ACCESS_LEVELS.OWNER;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return ACCESS_LEVELS.OWNER;
  if (member.permissions?.has(PermissionFlagsBits.ManageGuild)) return ACCESS_LEVELS.ADMIN;
  if (member.permissions?.has(PermissionFlagsBits.ModerateMembers) || member.permissions?.has(PermissionFlagsBits.ManageMessages)) return ACCESS_LEVELS.MODERATOR;
  if (memberHasAnyRole(member, ROLE_NAMES.OWNER)) return ACCESS_LEVELS.OWNER;
  if (memberHasAnyRole(member, ROLE_NAMES.ADMIN)) return ACCESS_LEVELS.ADMIN;
  if (memberHasAnyRole(member, ROLE_NAMES.MODERATOR)) return ACCESS_LEVELS.MODERATOR;
  if (memberHasAnyRole(member, ROLE_NAMES.HELPER)) return ACCESS_LEVELS.HELPER;
  if (memberHasAnyRole(member, ROLE_NAMES.VIP)) return ACCESS_LEVELS.VIP;
  return ACCESS_LEVELS.MEMBER;
}

function getLevelLabel(levelValue) {
  if (levelValue >= ACCESS_LEVELS.OWNER) return 'Owner';
  if (levelValue >= ACCESS_LEVELS.ADMIN) return 'Admin';
  if (levelValue >= ACCESS_LEVELS.MODERATOR) return 'Moderator';
  if (levelValue >= ACCESS_LEVELS.HELPER) return 'Helper';
  if (levelValue >= ACCESS_LEVELS.VIP) return 'VIP';
  return 'Member';
}

function getRequiredLevelForCommand(interactionOrName) {
  const commandName = typeof interactionOrName === 'string' ? interactionOrName : interactionOrName.commandName;
  const rule = COMMAND_RULES[commandName];
  if (!rule) return ACCESS_LEVELS.MEMBER;
  let levelName = rule.level || 'MEMBER';
  if (typeof interactionOrName !== 'string' && interactionOrName.options?.getSubcommand) {
    const sub = interactionOrName.options.getSubcommand(false);
    if (sub && rule.subcommands?.[sub]) levelName = rule.subcommands[sub];
  }
  return normalizeLevel(levelName);
}

function getRequiredLevelForContext(commandName) {
  return normalizeLevel(CONTEXT_RULES[commandName] || 'MEMBER');
}

function getRequiredLevelForComponent(customId = '') {
  const match = BUTTON_RULES.find(rule => customId.startsWith(rule.prefix));
  return match ? normalizeLevel(match.level) : ACCESS_LEVELS.MEMBER;
}

function permissionBitsForCommand(commandName) {
  const required = getRequiredLevelForCommand(commandName);
  if (required >= ACCESS_LEVELS.ADMIN) return PermissionFlagsBits.ManageGuild;
  if (required >= ACCESS_LEVELS.MODERATOR) return PermissionFlagsBits.ModerateMembers;
  if (required >= ACCESS_LEVELS.HELPER) return PermissionFlagsBits.ManageMessages;
  return null;
}

function permissionBitsForContext(commandName) {
  const required = getRequiredLevelForContext(commandName);
  if (required >= ACCESS_LEVELS.ADMIN) return PermissionFlagsBits.ManageGuild;
  if (required >= ACCESS_LEVELS.MODERATOR) return PermissionFlagsBits.ModerateMembers;
  if (required >= ACCESS_LEVELS.HELPER) return PermissionFlagsBits.ManageMessages;
  return null;
}

function hasLevel(member, requiredLevel) {
  return getMemberLevel(member) >= requiredLevel;
}

function buildDeniedPayload(requiredLevel, memberLevel) {
  return {
    ...error('Недостаточно прав', `Для этого действия нужен уровень доступа **${getLevelLabel(requiredLevel)}**.\nТвой текущий уровень: **${getLevelLabel(memberLevel)}**.\n\nЕсли считаешь, что доступ должен быть — обратись к администратору.`),
    flags: MessageFlags.Ephemeral,
  };
}

function checkInteractionAccess(interaction) {
  const required = interaction.isContextMenuCommand?.() ? getRequiredLevelForContext(interaction.commandName) : getRequiredLevelForCommand(interaction);
  const actual = getMemberLevel(interaction.member);
  return { ok: actual >= required, required, actual, requiredLabel: getLevelLabel(required), actualLabel: getLevelLabel(actual) };
}

function checkComponentAccess(interaction) {
  const required = getRequiredLevelForComponent(interaction.customId || '');
  const actual = getMemberLevel(interaction.member);
  return { ok: actual >= required, required, actual, requiredLabel: getLevelLabel(required), actualLabel: getLevelLabel(actual) };
}

async function denyInteraction(interaction, check, extra = {}) {
  try {
    addAudit('access_denied', interaction.user, {
      command: interaction.commandName || null,
      customId: interaction.customId || null,
      required: check.requiredLabel,
      actual: check.actualLabel,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      ...extra,
    });
  } catch (_) {}
  const payload = buildDeniedPayload(check.required, check.actual);
  if (interaction.replied || interaction.deferred) return interaction.editReply(payload).catch(() => null);
  return interaction.reply(payload).catch(() => null);
}

function getAccessMatrixRows() {
  return [
    ['Профиль, меню, daily, магазин, тикеты, ивенты, LFG', 'Member'],
    ['Расширенные пользовательские возможности, VIP-предметы', 'VIP'],
    ['Просмотр тикетов, заявок, предупреждений и истории', 'Helper'],
    ['Warn, mute, clear, закрытие тикетов, статусы предложений', 'Moderator'],
    ['Настройки, панели, ивенты/турниры, AutoMod, backup/export', 'Admin'],
    ['Restore backup, maintenance, критичные системные действия', 'Owner'],
  ];
}

module.exports = {
  ACCESS_LEVELS,
  ROLE_NAMES,
  COMMAND_RULES,
  CONTEXT_RULES,
  getMemberLevel,
  getLevelLabel,
  hasLevel,
  getRequiredLevelForCommand,
  getRequiredLevelForContext,
  getRequiredLevelForComponent,
  permissionBitsForCommand,
  permissionBitsForContext,
  checkInteractionAccess,
  checkComponentAccess,
  denyInteraction,
  getAccessMatrixRows,
};
