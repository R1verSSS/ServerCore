const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder } = require('discord.js');
const { readDatabase, writeDatabase } = require('./dataStore');
const { logToModeration } = require('./logService');
const { success, error, warning, info } = require('./responseService');

const CREATE_CHANNEL_NAME = '➕・создать-комнату';
const DEFAULT_NAME_TEMPLATE = '🔊・комната {username}';
const MAX_NAME_LENGTH = 90;

function ensureTempVoiceDb(db) {
  if (!db.tempVoiceRooms || typeof db.tempVoiceRooms !== 'object') db.tempVoiceRooms = {};
  if (!db.tempVoiceSettings || typeof db.tempVoiceSettings !== 'object') {
    db.tempVoiceSettings = {
      createChannelName: CREATE_CHANNEL_NAME,
      roomNameTemplate: DEFAULT_NAME_TEMPLATE,
      defaultLimit: 0,
      deleteWhenEmpty: true
    };
  }
}

function getTempVoiceSettings() {
  const db = readDatabase();
  ensureTempVoiceDb(db);
  writeDatabase(db);
  return db.tempVoiceSettings;
}

function saveTempVoiceSettings(patch = {}) {
  const db = readDatabase();
  ensureTempVoiceDb(db);
  db.tempVoiceSettings = { ...db.tempVoiceSettings, ...patch };
  writeDatabase(db);
  return db.tempVoiceSettings;
}

function isManagedRoom(channelId) {
  const db = readDatabase();
  ensureTempVoiceDb(db);
  return Boolean(db.tempVoiceRooms?.[String(channelId)]);
}

function getRoom(channelId) {
  const db = readDatabase();
  ensureTempVoiceDb(db);
  return db.tempVoiceRooms?.[String(channelId)] || null;
}

function getUserRoom(userId) {
  const db = readDatabase();
  ensureTempVoiceDb(db);
  return Object.values(db.tempVoiceRooms || {}).find(room => room.ownerId === userId && room.status !== 'deleted') || null;
}

function getActiveRooms() {
  const db = readDatabase();
  ensureTempVoiceDb(db);
  return Object.values(db.tempVoiceRooms || {}).filter(room => room.status !== 'deleted');
}

function sanitizeRoomName(name) {
  return String(name || '')
    .replace(/[\n\r\t]/g, ' ')
    .replace(/@everyone/g, 'everyone')
    .replace(/@here/g, 'here')
    .trim()
    .slice(0, MAX_NAME_LENGTH) || '🔊・личная-комната';
}

function buildRoomName(member, template = DEFAULT_NAME_TEMPLATE) {
  const username = member?.displayName || member?.user?.username || 'участник';
  return sanitizeRoomName(String(template || DEFAULT_NAME_TEMPLATE).replaceAll('{username}', username));
}

function findCreateChannel(guild) {
  const settings = getTempVoiceSettings();
  return guild.channels.cache.find(channel =>
    channel.type === ChannelType.GuildVoice && channel.name === (settings.createChannelName || CREATE_CHANNEL_NAME)
  ) || null;
}

async function ensureCreateChannel(guild) {
  const settings = getTempVoiceSettings();
  const existing = findCreateChannel(guild);
  if (existing) return existing;

  const category = guild.channels.cache.find(channel => channel.type === ChannelType.GuildCategory && channel.name === '🔊 ГОЛОСОВЫЕ') || null;
  return guild.channels.create({
    name: settings.createChannelName || CREATE_CHANNEL_NAME,
    type: ChannelType.GuildVoice,
    parent: category?.id || null,
    reason: 'ServerCore temp voice trigger channel'
  });
}

async function createTempRoom(member, triggerChannel) {
  const db = readDatabase();
  ensureTempVoiceDb(db);
  const settings = db.tempVoiceSettings;

  const existing = Object.values(db.tempVoiceRooms || {}).find(room => room.ownerId === member.id && room.status !== 'deleted');
  if (existing) {
    const channel = await member.guild.channels.fetch(existing.channelId).catch(() => null);
    if (channel) {
      await member.voice.setChannel(channel).catch(() => null);
      return { ok: true, room: existing, channel, reused: true };
    }
    delete db.tempVoiceRooms[existing.channelId];
  }

  const name = buildRoomName(member, settings.roomNameTemplate);
  const channel = await member.guild.channels.create({
    name,
    type: ChannelType.GuildVoice,
    parent: triggerChannel.parentId || null,
    userLimit: Number(settings.defaultLimit || 0),
    permissionOverwrites: [
      {
        id: member.guild.roles.everyone.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]
      },
      {
        id: member.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream]
      }
    ],
    reason: `Temporary voice room for ${member.user.tag}`
  });

  const room = {
    channelId: channel.id,
    guildId: member.guild.id,
    ownerId: member.id,
    ownerName: member.user.username,
    name,
    parentId: triggerChannel.parentId || null,
    locked: false,
    limit: Number(settings.defaultLimit || 0),
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.tempVoiceRooms[channel.id] = room;
  writeDatabase(db);

  await member.voice.setChannel(channel).catch(() => null);
  await logToModeration(member.guild, '🔊 Создана временная voice-комната', `Комната **${name}** создана для <@${member.id}>.`).catch(() => null);
  await sendRoomControlPanel(channel, room);
  return { ok: true, room, channel, reused: false };
}

async function handleVoiceStateUpdate(oldState, newState) {
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  const joinedChannel = newState.channel;
  if (joinedChannel && joinedChannel.type === ChannelType.GuildVoice) {
    const createChannel = findCreateChannel(newState.guild);
    if (createChannel && joinedChannel.id === createChannel.id) {
      await createTempRoom(member, createChannel).catch(error => console.error('Temp voice create error:', error));
      return;
    }
  }

  const oldChannel = oldState.channel;
  if (oldChannel && isManagedRoom(oldChannel.id)) {
    const fresh = await oldState.guild.channels.fetch(oldChannel.id).catch(() => null);
    if (fresh && fresh.members.size === 0) {
      await deleteTempRoom(oldState.guild, oldChannel.id, 'Комната пуста').catch(error => console.error('Temp voice delete error:', error));
    }
  }
}

function canManageRoom(interaction, room) {
  if (!interaction.member) return false;
  if (room?.ownerId === interaction.user.id) return true;
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

function getCurrentManagedRoom(interaction) {
  const channelId = interaction.member?.voice?.channelId;
  if (!channelId) return null;
  return getRoom(channelId);
}

async function renameRoom(interaction, name) {
  const room = getCurrentManagedRoom(interaction);
  if (!room) return { ok: false, reason: 'not_in_room' };
  if (!canManageRoom(interaction, room)) return { ok: false, reason: 'no_permission', room };

  const channel = await interaction.guild.channels.fetch(room.channelId).catch(() => null);
  if (!channel) return { ok: false, reason: 'not_found' };

  const clean = sanitizeRoomName(name);
  await channel.setName(clean, `Temp voice rename by ${interaction.user.tag}`);

  const db = readDatabase();
  ensureTempVoiceDb(db);
  db.tempVoiceRooms[room.channelId] = { ...room, name: clean, updatedAt: new Date().toISOString() };
  writeDatabase(db);
  return { ok: true, room: db.tempVoiceRooms[room.channelId] };
}

async function setRoomLimit(interaction, limit) {
  const room = getCurrentManagedRoom(interaction);
  if (!room) return { ok: false, reason: 'not_in_room' };
  if (!canManageRoom(interaction, room)) return { ok: false, reason: 'no_permission', room };

  const channel = await interaction.guild.channels.fetch(room.channelId).catch(() => null);
  if (!channel) return { ok: false, reason: 'not_found' };

  const normalizedLimit = Math.max(0, Math.min(Number(limit || 0), 99));
  await channel.setUserLimit(normalizedLimit, `Temp voice limit by ${interaction.user.tag}`);

  const db = readDatabase();
  ensureTempVoiceDb(db);
  db.tempVoiceRooms[room.channelId] = { ...room, limit: normalizedLimit, updatedAt: new Date().toISOString() };
  writeDatabase(db);
  return { ok: true, room: db.tempVoiceRooms[room.channelId] };
}

async function setRoomLocked(interaction, locked) {
  const room = getCurrentManagedRoom(interaction);
  if (!room) return { ok: false, reason: 'not_in_room' };
  if (!canManageRoom(interaction, room)) return { ok: false, reason: 'no_permission', room };

  const channel = await interaction.guild.channels.fetch(room.channelId).catch(() => null);
  if (!channel) return { ok: false, reason: 'not_found' };

  await channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, {
    Connect: locked ? false : null,
    ViewChannel: null
  }, { reason: `Temp voice ${locked ? 'lock' : 'unlock'} by ${interaction.user.tag}` });

  const db = readDatabase();
  ensureTempVoiceDb(db);
  db.tempVoiceRooms[room.channelId] = { ...room, locked: Boolean(locked), updatedAt: new Date().toISOString() };
  writeDatabase(db);
  return { ok: true, room: db.tempVoiceRooms[room.channelId] };
}

async function inviteUser(interaction, user) {
  const room = getCurrentManagedRoom(interaction);
  if (!room) return { ok: false, reason: 'not_in_room' };
  if (!canManageRoom(interaction, room)) return { ok: false, reason: 'no_permission', room };

  const channel = await interaction.guild.channels.fetch(room.channelId).catch(() => null);
  if (!channel) return { ok: false, reason: 'not_found' };

  await channel.permissionOverwrites.edit(user.id, {
    ViewChannel: true,
    Connect: true,
    Speak: true,
    Stream: true
  }, { reason: `Temp voice invite by ${interaction.user.tag}` });
  return { ok: true, room, user };
}

async function claimRoom(interaction) {
  const room = getCurrentManagedRoom(interaction);
  if (!room) return { ok: false, reason: 'not_in_room' };

  const channel = await interaction.guild.channels.fetch(room.channelId).catch(() => null);
  if (!channel) return { ok: false, reason: 'not_found' };

  const ownerStillInside = channel.members.has(room.ownerId);
  if (ownerStillInside && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return { ok: false, reason: 'owner_inside', room };
  }

  const db = readDatabase();
  ensureTempVoiceDb(db);
  db.tempVoiceRooms[room.channelId] = {
    ...room,
    ownerId: interaction.user.id,
    ownerName: interaction.user.username,
    updatedAt: new Date().toISOString()
  };
  writeDatabase(db);
  await channel.permissionOverwrites.edit(interaction.user.id, { ViewChannel: true, Connect: true, Speak: true, Stream: true }).catch(() => null);
  return { ok: true, room: db.tempVoiceRooms[room.channelId] };
}

async function deleteTempRoom(guild, channelId, reason = 'Удаление временной voice-комнаты') {
  const db = readDatabase();
  ensureTempVoiceDb(db);
  const room = db.tempVoiceRooms[String(channelId)];
  if (!room) return { ok: false, reason: 'not_found' };

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (channel) await channel.delete(reason).catch(() => null);

  room.status = 'deleted';
  room.deletedAt = new Date().toISOString();
  room.updatedAt = new Date().toISOString();
  db.tempVoiceRooms[String(channelId)] = room;
  writeDatabase(db);
  await logToModeration(guild, '🧹 Удалена временная voice-комната', `Комната **${room.name}** удалена. Причина: ${reason}`).catch(() => null);
  return { ok: true, room };
}

async function deleteCurrentRoom(interaction) {
  const room = getCurrentManagedRoom(interaction);
  if (!room) return { ok: false, reason: 'not_in_room' };
  if (!canManageRoom(interaction, room)) return { ok: false, reason: 'no_permission', room };
  return deleteTempRoom(interaction.guild, room.channelId, `Deleted by ${interaction.user.tag}`);
}

function buildVoiceInfoEmbed(room, channel = null) {
  const members = channel ? Array.from(channel.members.values()).filter(m => !m.user.bot) : [];
  const participants = members.length
    ? members.slice(0, 10).map(member => `• ${member.displayName}`).join('\n') + (members.length > 10 ? `\n…и еще ${members.length - 10}` : '')
    : 'Пока никого нет.';

  return new EmbedBuilder()
    .setColor(room?.locked ? 0xFEE75C : 0x57F287)
    .setTitle('🔊 Личная voice-комната')
    .setDescription(room ? `**${room.name}**` : 'Ты не находишься во временной voice-комнате.')
    .addFields(
      { name: 'Владелец', value: room ? `<@${room.ownerId}>` : '-', inline: true },
      { name: 'Лимит', value: room ? String(room.limit || 'без лимита') : '-', inline: true },
      { name: 'Доступ', value: room ? (room.locked ? '🔒 закрыта' : '🔓 открыта') : '-', inline: true },
      { name: 'Участников', value: channel ? String(members.length) : '-', inline: true },
      { name: 'Список', value: participants, inline: false }
    )
    .setFooter({ text: 'Панелью может пользоваться владелец комнаты или модератор' })
    .setTimestamp();
}


function buildRoomControlPanel(room = null, channel = null) {
  const count = channel?.members?.size ?? '-';
  const status = room?.locked ? '🔒 закрыта' : '🔓 открыта';
  const embed = new EmbedBuilder()
    .setColor(room?.locked ? 0xFEE75C : 0x5865F2)
    .setTitle('🎛 Панель управления voice-комнатой')
    .setDescription('Панель создана автоматически для этой комнаты. Все действия ниже доступны владельцу комнаты и модераторам.')
    .addFields(
      { name: 'Владелец', value: room ? `<@${room.ownerId}>` : 'Не определен', inline: true },
      { name: 'Статус', value: status, inline: true },
      { name: 'Лимит', value: room ? String(room.limit || 'без лимита') : '-', inline: true },
      { name: 'Участников', value: String(count), inline: true },
      { name: 'Быстрые действия', value: 'Закрыть/открыть комнату, изменить название, поставить лимит, пригласить участника, забрать владельца или удалить комнату.', inline: false }
    )
    .setFooter({ text: 'Если кнопка не сработала, проверь, что ты находишься именно в этой voice-комнате.' })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('voice:lock').setLabel('Закрыть').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('voice:unlock').setLabel('Открыть').setEmoji('🔓').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('voice:rename_modal').setLabel('Название').setEmoji('✏️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('voice:limit_modal').setLabel('Лимит').setEmoji('👥').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('voice:info').setLabel('Инфо').setEmoji('ℹ️').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId('voice:invite_select')
      .setPlaceholder('Пригласить участника в закрытую комнату')
      .setMinValues(1)
      .setMaxValues(1)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('voice:claim').setLabel('Забрать').setEmoji('👑').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('voice:delete').setLabel('Удалить комнату').setEmoji('🗑').setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row1, row2, row3] };
}


function buildRenameModal(room = null) {
  const modal = new ModalBuilder()
    .setCustomId('voice:modal:rename')
    .setTitle('Переименовать voice-комнату');

  const input = new TextInputBuilder()
    .setCustomId('name')
    .setLabel('Новое название комнаты')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(MAX_NAME_LENGTH)
    .setPlaceholder('Например: CS2 стак')
    .setValue(String(room?.name || '').slice(0, MAX_NAME_LENGTH));

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

function buildLimitModal(room = null) {
  const modal = new ModalBuilder()
    .setCustomId('voice:modal:limit')
    .setTitle('Изменить лимит участников');

  const input = new TextInputBuilder()
    .setCustomId('limit')
    .setLabel('Лимит от 0 до 99')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('0 — без лимита')
    .setValue(String(room?.limit || 0));

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

async function sendRoomControlPanel(channel, room) {
  if (!channel || typeof channel.send !== 'function') return null;
  return channel.send(buildRoomControlPanel(room, channel)).catch(error => {
    console.warn('Could not send temp voice control panel:', error?.message || error);
    return null;
  });
}

async function handleRenameModal(interaction) {
  const name = interaction.fields.getTextInputValue('name');
  return renameRoom(interaction, name);
}

async function handleLimitModal(interaction) {
  const raw = interaction.fields.getTextInputValue('limit');
  const limit = Number.parseInt(raw, 10);
  if (Number.isNaN(limit) || limit < 0 || limit > 99) return { ok: false, reason: 'bad_limit' };
  return setRoomLimit(interaction, limit);
}

async function handleInviteSelect(interaction) {
  const userId = interaction.values?.[0];
  const user = userId ? await interaction.client.users.fetch(userId).catch(() => null) : null;
  if (!user) return { ok: false, reason: 'user_not_found' };
  return inviteUser(interaction, user);
}

function buildVoicePanel() {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🔊 Управление личной voice-комнатой')
    .setDescription('Зайди в канал **➕・создать-комнату**, чтобы бот автоматически создал тебе личную комнату. После создания бот отправит **панель управления прямо в чат твоей комнаты**.')
    .addFields(
      { name: '🔒 Закрыть', value: 'Запретить вход новым участникам.', inline: true },
      { name: '🔓 Открыть', value: 'Снова разрешить вход.', inline: true },
      { name: '👑 Забрать', value: 'Забрать комнату, если владелец вышел.', inline: true },
      { name: '🗑 Удалить', value: 'Удалить свою временную комнату.', inline: true }
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('voice:lock').setLabel('Закрыть').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('voice:unlock').setLabel('Открыть').setEmoji('🔓').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('voice:claim').setLabel('Забрать').setEmoji('👑').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('voice:info').setLabel('Инфо').setEmoji('ℹ️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('voice:delete').setLabel('Удалить').setEmoji('🗑').setStyle(ButtonStyle.Danger)
  );
  return { embeds: [embed], components: [row] };
}

async function handleVoiceButton(interaction) {
  const [, action] = interaction.customId.split(':');
  if (action === 'lock') return setRoomLocked(interaction, true);
  if (action === 'unlock') return setRoomLocked(interaction, false);
  if (action === 'claim') return claimRoom(interaction);
  if (action === 'delete' || action === 'delete_confirm') return deleteCurrentRoom(interaction);
  if (action === 'info') {
    const room = getCurrentManagedRoom(interaction);
    const channel = room ? await interaction.guild.channels.fetch(room.channelId).catch(() => null) : null;
    return { ok: Boolean(room), room, channel, reason: room ? null : 'not_in_room' };
  }
  return { ok: false, reason: 'unknown_action' };
}


function buildVoiceActionPayload(result, successText) {
  if (result?.ok) {
    if (result.channel && result.room && result.reason !== 'deleted') {
      return { embeds: [buildVoiceInfoEmbed(result.room, result.channel)], components: [] };
    }
    return success('Готово', successText || 'Действие выполнено.');
  }
  if (result?.reason === 'not_in_room') return error('Ты не в комнате', 'Зайди в свою временную voice-комнату и повтори действие.');
  if (result?.reason === 'no_permission') return error('Нет доступа', `Управлять этой комнатой может только владелец${result.room?.ownerId ? ` <@${result.room.ownerId}>` : ''} или модератор.`);
  if (result?.reason === 'owner_inside') return warning('Владелец еще внутри', 'Забрать комнату можно только после того, как текущий владелец вышел.');
  if (result?.reason === 'not_found') return error('Комната не найдена', 'Похоже, канал уже удален или запись в базе устарела.');
  return error('Не удалось выполнить действие', 'Попробуй еще раз или обратись к администрации.');
}

module.exports = {
  CREATE_CHANNEL_NAME,
  ensureTempVoiceDb,
  getTempVoiceSettings,
  saveTempVoiceSettings,
  getRoom,
  getUserRoom,
  getActiveRooms,
  findCreateChannel,
  ensureCreateChannel,
  createTempRoom,
  handleVoiceStateUpdate,
  renameRoom,
  setRoomLimit,
  setRoomLocked,
  inviteUser,
  claimRoom,
  deleteCurrentRoom,
  deleteTempRoom,
  buildVoiceInfoEmbed,
  buildVoicePanel,
  buildRoomControlPanel,
  buildRenameModal,
  buildLimitModal,
  handleRenameModal,
  handleLimitModal,
  handleInviteSelect,
  handleVoiceButton,
  buildVoiceActionPayload
};
