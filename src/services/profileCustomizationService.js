const { getOrCreateUser, updateUser } = require('./dataStore');

const PROFILE_COLORS = {
  blurple: { name: 'Discord Blurple', hex: 0x5865F2, rgb: [88, 101, 242], emoji: '🔵' },
  green: { name: 'Green', hex: 0x57F287, rgb: [87, 242, 135], emoji: '🟢' },
  gold: { name: 'Gold', hex: 0xFEE75C, rgb: [254, 231, 92], emoji: '🟡' },
  red: { name: 'Red', hex: 0xED4245, rgb: [237, 66, 69], emoji: '🔴' },
  purple: { name: 'Purple', hex: 0x9B59B6, rgb: [155, 89, 182], emoji: '🟣' },
  cyan: { name: 'Cyan', hex: 0x00D4FF, rgb: [0, 212, 255], emoji: '💠' },
};

const PROFILE_BACKGROUNDS = {
  dark: { name: 'Dark Core', colors: [[15,17,23], [23,26,35]], emoji: '🌑' },
  neon: { name: 'Neon Grid', colors: [[15,17,23], [35,22,55]], emoji: '🌌' },
  forest: { name: 'Forest', colors: [[10,31,22], [21,64,45]], emoji: '🌲' },
  sunset: { name: 'Sunset', colors: [[48,24,44], [90,42,42]], emoji: '🌅' },
  ocean: { name: 'Ocean', colors: [[10,28,54], [13,67,91]], emoji: '🌊' },
};

const DEFAULT_PROFILE = {
  title: 'Участник сервера',
  about: 'Описание профиля пока не заполнено.',
  color: 'blurple',
  background: 'dark',
  mainBadge: null,
  showBadges: true,
  showStats: true
};

function normalizeProfile(profile = {}) {
  const normalized = { ...DEFAULT_PROFILE, ...profile };
  if (!PROFILE_COLORS[normalized.color]) normalized.color = DEFAULT_PROFILE.color;
  if (!PROFILE_BACKGROUNDS[normalized.background]) normalized.background = DEFAULT_PROFILE.background;
  normalized.title = String(normalized.title || DEFAULT_PROFILE.title).slice(0, 48);
  normalized.about = String(normalized.about || DEFAULT_PROFILE.about).slice(0, 180);
  return normalized;
}

function ensureProfile(discordId, username) {
  const user = getOrCreateUser(discordId, username);
  if (!user.profileCustomization) {
    return updateUser(discordId, existing => {
      existing.profileCustomization = normalizeProfile();
      return existing;
    }).profileCustomization;
  }
  const normalized = normalizeProfile(user.profileCustomization);
  if (JSON.stringify(normalized) !== JSON.stringify(user.profileCustomization)) {
    return updateUser(discordId, existing => {
      existing.profileCustomization = normalized;
      return existing;
    }).profileCustomization;
  }
  return normalized;
}

function getProfile(discordId, username) {
  return ensureProfile(discordId, username);
}

function updateProfile(discordId, username, patch) {
  return updateUser(discordId, existing => {
    existing.username = username || existing.username;
    existing.profileCustomization = normalizeProfile({ ...(existing.profileCustomization || {}), ...(patch || {}) });
    return existing;
  }).profileCustomization;
}

function resetProfile(discordId, username) {
  return updateUser(discordId, existing => {
    existing.username = username || existing.username;
    existing.profileCustomization = normalizeProfile();
    return existing;
  }).profileCustomization;
}

function hasCosmeticAccess(user, type, value) {
  if (!value) return true;
  if (type === 'color' && value === DEFAULT_PROFILE.color) return true;
  if (type === 'background' && value === DEFAULT_PROFILE.background) return true;
  const inventory = Array.isArray(user.inventory) ? user.inventory : [];
  return inventory.some(item => item && item.type === 'cosmetic' && item.cosmeticType === type && item.value === value);
}

function listCosmeticInventory(user) {
  return (Array.isArray(user.inventory) ? user.inventory : []).filter(item => item && item.type === 'cosmetic');
}

function getColor(key) { return PROFILE_COLORS[key] || PROFILE_COLORS[DEFAULT_PROFILE.color]; }
function getBackground(key) { return PROFILE_BACKGROUNDS[key] || PROFILE_BACKGROUNDS[DEFAULT_PROFILE.background]; }

module.exports = {
  PROFILE_COLORS,
  PROFILE_BACKGROUNDS,
  DEFAULT_PROFILE,
  normalizeProfile,
  getProfile,
  updateProfile,
  resetProfile,
  hasCosmeticAccess,
  listCosmeticInventory,
  getColor,
  getBackground
};
