const { updateUser, getOrCreateUser, readDatabase } = require('./dataStore');
const { addXpToMember } = require('./xpService');
const { awardAchievement } = require('./achievementService');
const { getSettings } = require('./settingsService');
const { addItemToInventory, hasInventoryItem, applyBoostToAmount } = require('./inventoryService');
const { recordEconomy, applyDailyDealPrice } = require('./managementUxService');

const DAILY_COINS = 100;
const DAILY_XP = 25;
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const DEFAULT_SHOP_ITEMS = [
  { id: 'vip', name: '💎 VIP', description: 'Выдает роль 💎 VIP.', price: 1000, type: 'role', roleName: '💎 VIP', category: 'roles' },
  { id: 'active', name: '🔥 Active', description: 'Выдает роль 🔥 Active.', price: 500, type: 'role', roleName: '🔥 Active', category: 'roles' },
  { id: 'creator', name: '🎨 Creator', description: 'Выдает роль 🎨 Creator.', price: 300, type: 'role', roleName: '🎨 Creator', category: 'roles' },
  { id: 'profile_color_gold', name: '🟡 Цвет профиля: Gold', description: 'Открывает золотой цвет для /profilecard.', price: 250, type: 'cosmetic', cosmeticType: 'color', value: 'gold', category: 'cosmetics' },
  { id: 'profile_color_purple', name: '🟣 Цвет профиля: Purple', description: 'Открывает фиолетовый цвет для /profilecard.', price: 250, type: 'cosmetic', cosmeticType: 'color', value: 'purple', category: 'cosmetics' },
  { id: 'profile_bg_neon', name: '🌌 Фон профиля: Neon Grid', description: 'Открывает неоновый фон для /profilecard.', price: 400, type: 'cosmetic', cosmeticType: 'background', value: 'neon', category: 'cosmetics' },
  { id: 'profile_bg_ocean', name: '🌊 Фон профиля: Ocean', description: 'Открывает океанский фон для /profilecard.', price: 400, type: 'cosmetic', cosmeticType: 'background', value: 'ocean', category: 'cosmetics' },
  { id: 'xp_boost_24h', name: '⚡ XP Boost x2 на 24 часа', description: 'После использования удваивает получаемый XP на 24 часа.', price: 700, type: 'boost', boostType: 'xp', multiplier: 2, durationHours: 24, category: 'boosts' },
  { id: 'coin_boost_24h', name: '🪙 Coin Boost x2 на 24 часа', description: 'После использования удваивает daily-монеты на 24 часа.', price: 700, type: 'boost', boostType: 'coins', multiplier: 2, durationHours: 24, category: 'boosts' },
  { id: 'raffle_ticket', name: '🎟 Билет розыгрыша', description: 'Можно использовать для участия в ручном розыгрыше администрации.', price: 300, type: 'ticket', category: 'tickets' },
  { id: 'custom_role_request', name: '📝 Заявка на кастомную роль', description: 'После использования создает право обратиться к администрации за кастомной ролью.', price: 1500, type: 'custom', category: 'special' }
];

function formatDuration(ms) {
  const totalSeconds = Math.max(Math.ceil(ms / 1000), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours} ч. ${minutes} мин.`;
  if (minutes > 0) return `${minutes} мин. ${seconds} сек.`;
  return `${seconds} сек.`;
}

function normalizeShopItem(item) {
  return {
    id: String(item.id || '').trim(),
    name: String(item.name || item.id || 'Товар'),
    description: String(item.description || ''),
    price: Math.max(Number(item.price || 0), 0),
    type: item.type || 'role',
    category: item.category || getCategoryByType(item.type || 'role'),
    roleName: item.roleName || '',
    enabled: item.enabled !== false,
    cosmeticType: item.cosmeticType || '',
    value: item.value || '',
    boostType: item.boostType || '',
    multiplier: Number(item.multiplier || 1),
    durationHours: Number(item.durationHours || 0)
  };
}

function getCategoryByType(type) {
  if (type === 'role') return 'roles';
  if (type === 'cosmetic') return 'cosmetics';
  if (type === 'boost') return 'boosts';
  if (type === 'ticket') return 'tickets';
  return 'special';
}

function getShopItems() {
  const db = readDatabase();
  const customItems = Array.isArray(db.shopItems)
    ? db.shopItems.map(normalizeShopItem).filter(item => item.id && item.enabled !== false)
    : [];
  return customItems.length ? customItems : DEFAULT_SHOP_ITEMS.map(item => ({ ...normalizeShopItem(item), enabled: true }));
}
function getShopItem(itemId) { return getShopItems().find(item => item.id === itemId); }
function getBalance(discordId, username) { return getOrCreateUser(discordId, username).coins || 0; }

async function claimDaily(member) {
  const discordId = member.user.id;
  const username = member.user.username;
  const user = getOrCreateUser(discordId, username);
  const now = Date.now();
  const lastDaily = user.lastDailyAt ? new Date(user.lastDailyAt).getTime() : 0;
  const settings = getSettings();
  const testMode = String(process.env.TEST_MODE || 'false').toLowerCase() === 'true';
  const cooldownMs = testMode ? 60 * 1000 : Math.max(Number(settings.dailyCooldownHours || 24), 1) * 60 * 60 * 1000;
  const baseCoins = Math.max(Number(settings.dailyCoins || DAILY_COINS), 0);
  const dailyCoins = applyBoostToAmount(user, baseCoins, 'coins');
  const dailyXp = Math.max(Number(settings.dailyXp || DAILY_XP), 0);

  if (now - lastDaily < cooldownMs) {
    return { ok: false, reason: 'cooldown', remainingMs: cooldownMs - (now - lastDaily), remainingText: formatDuration(cooldownMs - (now - lastDaily)) };
  }

  const updatedUser = updateUser(discordId, existing => {
    existing.username = username;
    existing.coins = (existing.coins || 0) + dailyCoins;
    existing.lastDailyAt = new Date(now).toISOString();
    return existing;
  });

  recordEconomy(discordId, username, 'daily', dailyCoins, { baseCoins, dailyXp });

  const xpResult = await addXpToMember(member, dailyXp);
  const dailyAchievement = awardAchievement(discordId, username, 'first_daily');
  const unlockedAchievements = [
    ...(xpResult.unlockedAchievements || []),
    ...(dailyAchievement.awarded ? [dailyAchievement.achievement] : [])
  ];

  return { ok: true, coins: dailyCoins, baseCoins, xp: dailyXp, user: xpResult.user || updatedUser, leveledUp: xpResult.leveledUp, newLevel: xpResult.newLevel, unlockedAchievements };
}

async function buyItem(member, itemId) {
  const item = getShopItem(itemId);
  if (!item) return { ok: false, reason: 'not_found' };
  const pricing = applyDailyDealPrice(item, getShopItems());
  const effectivePrice = pricing.price;

  const discordId = member.user.id;
  const username = member.user.username;
  const user = getOrCreateUser(discordId, username);
  const coins = user.coins || 0;

  if (coins < effectivePrice) return { ok: false, reason: 'not_enough_coins', item: { ...item, price: effectivePrice, originalPrice: item.price, isDailyDeal: pricing.isDailyDeal }, balance: coins, missing: effectivePrice - coins };

  if (item.type === 'cosmetic' && hasInventoryItem(user, item.id)) return { ok: false, reason: 'already_owned_cosmetic', item, balance: coins };

  if (item.type === 'role') {
    const role = member.guild.roles.cache.find(guildRole => guildRole.name === item.roleName);
    if (!role) return { ok: false, reason: 'role_not_found', item };
    if (member.roles.cache.has(role.id)) return { ok: false, reason: 'already_owned', item, balance: coins };
    try { await member.roles.add(role); } catch (error) { return { ok: false, reason: 'role_add_failed', item, error }; }
  }

  const updatedUser = updateUser(discordId, existing => {
    existing.username = username;
    existing.coins = Math.max((existing.coins || 0) - effectivePrice, 0);
    return existing;
  });

  if (['cosmetic', 'boost', 'ticket', 'custom', 'consumable'].includes(item.type)) {
    addItemToInventory(discordId, username, item);
  }

  const purchaseAchievement = awardAchievement(discordId, username, 'first_purchase');

  recordEconomy(discordId, username, 'purchase', -effectivePrice, { itemId: item.id, itemName: item.name, originalPrice: item.price, dailyDeal: pricing.isDailyDeal });

  return { ok: true, item: { ...item, price: effectivePrice, originalPrice: item.price, isDailyDeal: pricing.isDailyDeal, discountPercent: pricing.discountPercent }, balance: updatedUser.coins || 0, user: updatedUser, unlockedAchievements: purchaseAchievement.awarded ? [purchaseAchievement.achievement] : [] };
}

module.exports = { DAILY_COINS, DAILY_XP, DEFAULT_SHOP_ITEMS, getShopItems, getShopItem, getBalance, claimDaily, buyItem, normalizeShopItem };
