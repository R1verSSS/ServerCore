const { getOrCreateUser, updateUser } = require('./dataStore');

function nowMs() { return Date.now(); }
function hoursToMs(hours) { return Math.max(Number(hours || 0), 0) * 60 * 60 * 1000; }
function makeEntry(item) {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    description: item.description || '',
    cosmeticType: item.cosmeticType || '',
    value: item.value || '',
    boostType: item.boostType || '',
    multiplier: Number(item.multiplier || 1),
    durationHours: Number(item.durationHours || 0),
    purchasedAt: new Date().toISOString(),
    quantity: 1
  };
}
function isStackableType(type) {
  return ['boost', 'ticket', 'custom', 'consumable'].includes(type);
}
function getInventory(discordId, username) {
  const user = getOrCreateUser(discordId, username);
  return Array.isArray(user.inventory) ? user.inventory : [];
}
function addItemToInventory(discordId, username, item) {
  const updated = updateUser(discordId, user => {
    user.username = username || user.username;
    if (!Array.isArray(user.inventory)) user.inventory = [];
    const entry = makeEntry(item);
    if (isStackableType(entry.type)) {
      const existing = user.inventory.find(x => x && x.id === entry.id && x.type === entry.type);
      if (existing) {
        existing.quantity = Number(existing.quantity || 1) + 1;
        existing.lastPurchasedAt = new Date().toISOString();
      } else {
        user.inventory.push(entry);
      }
    } else {
      user.inventory.push(entry);
    }
    return user;
  });
  return updated.inventory || [];
}
function hasInventoryItem(user, itemId) {
  const inventory = Array.isArray(user.inventory) ? user.inventory : [];
  return inventory.some(entry => entry && entry.id === itemId && Number(entry.quantity || 1) > 0);
}
function removeOneInventoryItem(discordId, itemId) {
  return updateUser(discordId, user => {
    if (!Array.isArray(user.inventory)) user.inventory = [];
    const index = user.inventory.findIndex(entry => entry && entry.id === itemId && Number(entry.quantity || 1) > 0);
    if (index >= 0) {
      const current = user.inventory[index];
      const quantity = Number(current.quantity || 1);
      if (quantity > 1) current.quantity = quantity - 1;
      else user.inventory.splice(index, 1);
    }
    return user;
  });
}
function getActiveBoost(user, boostType) {
  const boosts = user?.activeBoosts || {};
  const boost = boosts[boostType];
  if (!boost || !boost.expiresAt) return null;
  if (new Date(boost.expiresAt).getTime() <= nowMs()) return null;
  return boost;
}
function applyBoostToAmount(user, amount, boostType) {
  const boost = getActiveBoost(user, boostType);
  if (!boost) return Math.floor(amount);
  return Math.floor(Number(amount || 0) * Number(boost.multiplier || 1));
}
function activateBoost(discordId, username, item) {
  const durationMs = hoursToMs(item.durationHours || 24);
  const boostType = item.boostType || 'xp';
  const multiplier = Number(item.multiplier || 2);
  const updated = updateUser(discordId, user => {
    user.username = username || user.username;
    if (!user.activeBoosts) user.activeBoosts = {};
    const current = user.activeBoosts[boostType];
    const baseTime = current && new Date(current.expiresAt).getTime() > nowMs()
      ? new Date(current.expiresAt).getTime()
      : nowMs();
    user.activeBoosts[boostType] = {
      itemId: item.id,
      name: item.name,
      boostType,
      multiplier,
      startedAt: new Date().toISOString(),
      expiresAt: new Date(baseTime + durationMs).toISOString()
    };
    return user;
  });
  return updated.activeBoosts?.[boostType];
}
function useInventoryItem(discordId, username, itemId) {
  const user = getOrCreateUser(discordId, username);
  const inventory = Array.isArray(user.inventory) ? user.inventory : [];
  const item = inventory.find(entry => entry && entry.id === itemId && Number(entry.quantity || 1) > 0);
  if (!item) return { ok: false, reason: 'not_found' };

  if (item.type === 'boost') {
    removeOneInventoryItem(discordId, itemId);
    const boost = activateBoost(discordId, username, item);
    return { ok: true, action: 'boost_activated', item, boost };
  }
  if (item.type === 'ticket') {
    removeOneInventoryItem(discordId, itemId);
    return { ok: true, action: 'ticket_used', item };
  }
  if (item.type === 'custom') {
    removeOneInventoryItem(discordId, itemId);
    return { ok: true, action: 'custom_request_used', item };
  }
  return { ok: false, reason: 'not_usable', item };
}
function transferInventoryItem(fromId, fromUsername, toId, toUsername, itemId) {
  const fromUser = getOrCreateUser(fromId, fromUsername);
  const inventory = Array.isArray(fromUser.inventory) ? fromUser.inventory : [];
  const item = inventory.find(entry => entry && entry.id === itemId && Number(entry.quantity || 1) > 0);
  if (!item) return { ok: false, reason: 'not_found' };
  if (item.type === 'cosmetic') return { ok: false, reason: 'cosmetic_not_transferable', item };
  removeOneInventoryItem(fromId, itemId);
  addItemToInventory(toId, toUsername, item);
  return { ok: true, item };
}
function formatBoosts(user) {
  const boosts = user?.activeBoosts || {};
  const active = Object.values(boosts).filter(boost => boost && new Date(boost.expiresAt).getTime() > nowMs());
  if (!active.length) return 'Активных бустов нет.';
  return active.map(boost => {
    const until = new Date(boost.expiresAt).toLocaleString('ru-RU');
    const title = boost.boostType === 'coins' ? 'монеты' : 'XP';
    return `**x${boost.multiplier} ${title}** до ${until}`;
  }).join('\n');
}

module.exports = {
  getInventory,
  addItemToInventory,
  hasInventoryItem,
  useInventoryItem,
  transferInventoryItem,
  getActiveBoost,
  applyBoostToAmount,
  formatBoosts
};
