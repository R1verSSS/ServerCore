const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { safeDefer, safeEdit } = require('../utils/safeInteraction');
const {
  ensureCreateChannel,
  renameRoom,
  setRoomLimit,
  setRoomLocked,
  inviteUser,
  claimRoom,
  deleteCurrentRoom,
  getActiveRooms,
  getRoom,
  buildVoiceInfoEmbed,
  buildVoicePanel
} = require('../services/tempVoiceService');

function resultText(result, successText) {
  if (result?.ok) return successText;
  if (result?.reason === 'not_in_room') return '❌ Ты должен находиться в своей временной voice-комнате.';
  if (result?.reason === 'no_permission') return '❌ Управлять комнатой может владелец или модератор.';
  if (result?.reason === 'owner_inside') return '⚠️ Владелец комнаты еще находится внутри. Забрать комнату можно, когда владелец вышел.';
  if (result?.reason === 'not_found') return '❌ Комната не найдена.';
  return '❌ Не удалось выполнить действие.';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('voice')
    .setDescription('Временные голосовые комнаты')
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('Создать канал ➕・создать-комнату'))
    .addSubcommand(sub => sub
      .setName('panel')
      .setDescription('Отправить панель управления voice-комнатами'))
    .addSubcommand(sub => sub
      .setName('info')
      .setDescription('Информация о текущей временной комнате'))
    .addSubcommand(sub => sub
      .setName('lock')
      .setDescription('Закрыть свою временную комнату'))
    .addSubcommand(sub => sub
      .setName('unlock')
      .setDescription('Открыть свою временную комнату'))
    .addSubcommand(sub => sub
      .setName('limit')
      .setDescription('Установить лимит участников')
      .addIntegerOption(opt => opt.setName('count').setDescription('0 — без лимита, максимум 99').setRequired(true).setMinValue(0).setMaxValue(99)))
    .addSubcommand(sub => sub
      .setName('rename')
      .setDescription('Переименовать свою временную комнату')
      .addStringOption(opt => opt.setName('name').setDescription('Новое название комнаты').setRequired(true).setMaxLength(90)))
    .addSubcommand(sub => sub
      .setName('invite')
      .setDescription('Разрешить участнику вход в закрытую комнату')
      .addUserOption(opt => opt.setName('user').setDescription('Кого пригласить').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('claim')
      .setDescription('Забрать комнату, если владелец вышел'))
    .addSubcommand(sub => sub
      .setName('delete')
      .setDescription('Удалить свою временную комнату'))
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('Список активных временных комнат')),

  async execute(interaction) {
    await safeDefer(interaction, true);
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await safeEdit(interaction, { content: '❌ Для настройки нужен доступ Управление каналами.', embeds: [], components: [] });
        return;
      }
      const channel = await ensureCreateChannel(interaction.guild);
      await safeEdit(interaction, { content: `✅ Канал создания временных комнат готов: <#${channel.id}>`, embeds: [], components: [] });
      return;
    }

    if (sub === 'panel') {
      await safeEdit(interaction, buildVoicePanel());
      return;
    }

    if (sub === 'info') {
      const room = getRoom(interaction.member?.voice?.channelId);
      const channel = room ? await interaction.guild.channels.fetch(room.channelId).catch(() => null) : null;
      await safeEdit(interaction, { embeds: [buildVoiceInfoEmbed(room, channel)], components: [] });
      return;
    }

    if (sub === 'lock') {
      const result = await setRoomLocked(interaction, true);
      await safeEdit(interaction, { content: resultText(result, '🔒 Комната закрыта.'), embeds: [], components: [] });
      return;
    }

    if (sub === 'unlock') {
      const result = await setRoomLocked(interaction, false);
      await safeEdit(interaction, { content: resultText(result, '🔓 Комната открыта.'), embeds: [], components: [] });
      return;
    }

    if (sub === 'limit') {
      const count = interaction.options.getInteger('count');
      const result = await setRoomLimit(interaction, count);
      await safeEdit(interaction, { content: resultText(result, `👥 Лимит комнаты установлен: **${count || 'без лимита'}**.`), embeds: [], components: [] });
      return;
    }

    if (sub === 'rename') {
      const result = await renameRoom(interaction, interaction.options.getString('name'));
      await safeEdit(interaction, { content: resultText(result, `✏️ Комната переименована: **${result?.room?.name || ''}**.`), embeds: [], components: [] });
      return;
    }

    if (sub === 'invite') {
      const user = interaction.options.getUser('user');
      const result = await inviteUser(interaction, user);
      await safeEdit(interaction, { content: resultText(result, `✅ <@${user.id}> получил доступ к комнате.`), embeds: [], components: [] });
      return;
    }

    if (sub === 'claim') {
      const result = await claimRoom(interaction);
      await safeEdit(interaction, { content: resultText(result, '👑 Теперь ты владелец этой комнаты.'), embeds: [], components: [] });
      return;
    }

    if (sub === 'delete') {
      const result = await deleteCurrentRoom(interaction);
      await safeEdit(interaction, { content: resultText(result, '🗑 Комната удалена.'), embeds: [], components: [] });
      return;
    }

    if (sub === 'list') {
      const rooms = getActiveRooms();
      const text = rooms.length
        ? rooms.map(room => `**${room.name}** · владелец <@${room.ownerId}> · ${room.locked ? '🔒' : '🔓'} · лимит ${room.limit || 'нет'}`).join('\n')
        : 'Активных временных комнат нет.';
      await safeEdit(interaction, { content: text, embeds: [], components: [] });
    }
  }
};
