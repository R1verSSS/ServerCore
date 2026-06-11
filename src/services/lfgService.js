const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const { readDatabase, writeDatabase } = require('./dataStore');
const { logToModeration } = require('./logService');

function ensureLfgDb(db) {
  if (!db.lfgPosts) db.lfgPosts = {};
  if (typeof db.lfgCounter !== 'number') db.lfgCounter = Number(db.lfgCounter || 0);
}

function normalizeGame(value) {
  return String(value || 'Другая игра').trim().slice(0, 60) || 'Другая игра';
}

function normalizeTitle(value, game) {
  const text = String(value || '').trim();
  return (text || `Поиск команды: ${game}`).slice(0, 80);
}

function getOpenLfgList(limit = 10) {
  const db = readDatabase();
  ensureLfgDb(db);
  return Object.values(db.lfgPosts)
    .filter(item => item.status === 'open')
    .sort((a, b) => Number(b.id) - Number(a.id))
    .slice(0, limit);
}

function getLfg(id) {
  const db = readDatabase();
  ensureLfgDb(db);
  return db.lfgPosts[String(id)] || null;
}

function buildLfgEmbed(lfg) {
  const members = lfg.members || [];
  const left = Math.max(0, Number(lfg.maxMembers || 0) - members.length);
  const memberText = members.length
    ? members.map((id, index) => `${index + 1}. <@${id}>`).join('\n')
    : 'Пока никто не записался.';

  return new EmbedBuilder()
    .setColor(lfg.status === 'open' ? 0x57F287 : 0xED4245)
    .setTitle(`🎮 LFG #${lfg.id}: ${lfg.title}`)
    .setDescription(lfg.description || 'Описание не указано.')
    .addFields(
      { name: 'Игра', value: lfg.game, inline: true },
      { name: 'Статус', value: lfg.status === 'open' ? 'Открыт' : 'Закрыт', inline: true },
      { name: 'Места', value: `${members.length}/${lfg.maxMembers} · свободно ${left}`, inline: true },
      { name: 'Создатель', value: `<@${lfg.ownerId}>`, inline: true },
      { name: 'Голосовой канал', value: lfg.voiceChannelId ? `<#${lfg.voiceChannelId}>` : 'Не создан', inline: true },
      { name: 'Участники', value: memberText.slice(0, 1024) }
    )
    .setFooter({ text: `Создано: ${new Date(lfg.createdAt).toLocaleString('ru-RU')}` });
}

function buildLfgButtons(lfg) {
  const disabled = lfg.status !== 'open';
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`lfg:join:${lfg.id}`).setLabel('Присоединиться').setEmoji('✅').setStyle(ButtonStyle.Success).setDisabled(disabled),
      new ButtonBuilder().setCustomId(`lfg:leave:${lfg.id}`).setLabel('Выйти').setEmoji('🚪').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
      new ButtonBuilder().setCustomId(`lfg:close:${lfg.id}`).setLabel('Закрыть').setEmoji('🔒').setStyle(ButtonStyle.Danger).setDisabled(lfg.status !== 'open')
    )
  ];
}

async function findLfgChannel(guild) {
  const cached = guild.channels.cache.find(ch => ch.name === '🎮・поиск-команды' && ch.type === ChannelType.GuildText);
  if (cached) return cached;
  const channels = await guild.channels.fetch().catch(() => null);
  return channels?.find(ch => ch?.name === '🎮・поиск-команды' && ch.type === ChannelType.GuildText) || null;
}

async function createVoiceRoom(guild, lfg) {
  const category = guild.channels.cache.find(ch => ch.name === '🔊 ГОЛОСОВЫЕ' && ch.type === ChannelType.GuildCategory)
    || guild.channels.cache.find(ch => ch.type === ChannelType.GuildCategory && ch.name.includes('ГОЛОС'));

  const channel = await guild.channels.create({
    name: `🎮 LFG-${lfg.id}-${lfg.game}`.slice(0, 90),
    type: ChannelType.GuildVoice,
    parent: category?.id,
    userLimit: Math.min(Math.max(Number(lfg.maxMembers || 2), 2), 99),
    reason: `LFG voice room #${lfg.id}`,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
      { id: lfg.ownerId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.MoveMembers] }
    ]
  });
  return channel;
}

async function createLfg(interaction, { game, title, description, maxMembers, createVoice }) {
  const db = readDatabase();
  ensureLfgDb(db);
  db.lfgCounter += 1;
  const id = db.lfgCounter;
  const normalizedGame = normalizeGame(game);

  const lfg = {
    id,
    game: normalizedGame,
    title: normalizeTitle(title, normalizedGame),
    description: String(description || '').trim().slice(0, 1000),
    maxMembers: Math.min(Math.max(Number(maxMembers || 5), 2), 99),
    ownerId: interaction.user.id,
    ownerName: interaction.user.username,
    members: [interaction.user.id],
    status: 'open',
    createdAt: new Date().toISOString(),
    closedAt: null,
    messageId: null,
    channelId: null,
    voiceChannelId: null
  };

  db.lfgPosts[String(id)] = lfg;
  writeDatabase(db);

  if (createVoice) {
    try {
      const voice = await createVoiceRoom(interaction.guild, lfg);
      lfg.voiceChannelId = voice.id;
    } catch (error) {
      console.error('LFG voice room error:', error);
    }
  }

  const targetChannel = await findLfgChannel(interaction.guild);
  if (targetChannel) {
    const message = await targetChannel.send({ embeds: [buildLfgEmbed(lfg)], components: buildLfgButtons(lfg) });
    lfg.messageId = message.id;
    lfg.channelId = targetChannel.id;
  }

  const latest = readDatabase();
  ensureLfgDb(latest);
  latest.lfgPosts[String(id)] = lfg;
  writeDatabase(latest);

  await logToModeration(interaction.guild, `🎮 Создан LFG #${id}: **${lfg.title}** · ${lfg.game} · автор <@${lfg.ownerId}>`).catch(() => null);
  return lfg;
}

async function updateLfgMessage(guild, lfg) {
  if (!lfg.channelId || !lfg.messageId) return;
  try {
    const channel = await guild.channels.fetch(lfg.channelId);
    const message = await channel.messages.fetch(lfg.messageId);
    await message.edit({ embeds: [buildLfgEmbed(lfg)], components: buildLfgButtons(lfg) });
  } catch (error) {
    console.warn('Could not update LFG message:', error.message);
  }
}

async function joinLfg(interaction, id) {
  const db = readDatabase();
  ensureLfgDb(db);
  const lfg = db.lfgPosts[String(id)];
  if (!lfg) return { ok: false, reason: 'not_found' };
  if (lfg.status !== 'open') return { ok: false, reason: 'closed', lfg };
  if ((lfg.members || []).includes(interaction.user.id)) return { ok: false, reason: 'already_joined', lfg };
  if ((lfg.members || []).length >= Number(lfg.maxMembers || 0)) return { ok: false, reason: 'full', lfg };

  lfg.members = [...(lfg.members || []), interaction.user.id];
  writeDatabase(db);
  await updateLfgMessage(interaction.guild, lfg);
  return { ok: true, lfg };
}

async function leaveLfg(interaction, id) {
  const db = readDatabase();
  ensureLfgDb(db);
  const lfg = db.lfgPosts[String(id)];
  if (!lfg) return { ok: false, reason: 'not_found' };
  if (!(lfg.members || []).includes(interaction.user.id)) return { ok: false, reason: 'not_joined', lfg };
  if (lfg.ownerId === interaction.user.id) return { ok: false, reason: 'owner', lfg };

  lfg.members = (lfg.members || []).filter(userId => userId !== interaction.user.id);
  writeDatabase(db);
  await updateLfgMessage(interaction.guild, lfg);
  return { ok: true, lfg };
}

async function closeLfg(interaction, id, reason = 'Закрыто') {
  const db = readDatabase();
  ensureLfgDb(db);
  const lfg = db.lfgPosts[String(id)];
  if (!lfg) return { ok: false, reason: 'not_found' };

  const isOwner = lfg.ownerId === interaction.user.id;
  const canManage = interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
  if (!isOwner && !canManage) return { ok: false, reason: 'no_permission', lfg };

  lfg.status = 'closed';
  lfg.closedAt = new Date().toISOString();
  lfg.closeReason = reason;
  writeDatabase(db);
  await updateLfgMessage(interaction.guild, lfg);

  if (lfg.voiceChannelId) {
    const voice = await interaction.guild.channels.fetch(lfg.voiceChannelId).catch(() => null);
    if (voice) await voice.delete(`LFG #${lfg.id} closed`).catch(() => null);
  }

  await logToModeration(interaction.guild, `🔒 Закрыт LFG #${id}: **${lfg.title}** · модератор/автор <@${interaction.user.id}>`).catch(() => null);
  return { ok: true, lfg };
}

module.exports = {
  getOpenLfgList,
  getLfg,
  createLfg,
  joinLfg,
  leaveLfg,
  closeLfg,
  buildLfgEmbed,
  buildLfgButtons,
  findLfgChannel
};
