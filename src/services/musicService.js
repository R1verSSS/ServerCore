const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
  NoSubscriberBehavior,
} = require('@discordjs/voice');
const play = require('play-dl');
const { addAudit } = require('./auditService');

const queues = new Map();
const MAX_PLAYLIST_ITEMS = Number(process.env.MUSIC_MAX_PLAYLIST_ITEMS || 15);

function getState(guildId) {
  if (!queues.has(guildId)) {
    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
    const state = {
      guildId,
      player,
      connection: null,
      queue: [],
      current: null,
      textChannelId: null,
      voiceChannelId: null,
      playing: false,
    };
    player.on(AudioPlayerStatus.Idle, () => playNext(state).catch(error => console.error('Music next error:', error)));
    player.on('error', error => {
      console.error('Music player error:', error);
      playNext(state).catch(console.error);
    });
    queues.set(guildId, state);
  }
  return queues.get(guildId);
}

async function getRequesterVoiceChannel(interaction) {
  // В modal/button interaction.member иногда приходит без актуального voice-состояния.
  // Поэтому дополнительно получаем GuildMember из кэша/Discord API.
  const cachedChannel = interaction.member?.voice?.channel || null;
  if (cachedChannel) return cachedChannel;

  try {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    return member?.voice?.channel || null;
  } catch (error) {
    console.warn('[Music] Не удалось получить voice-состояние пользователя:', error?.message || error);
    return null;
  }
}

function isYoutubeUrl(url = '') {
  try {
    const parsed = new URL(url);
    return ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'music.youtube.com'].includes(parsed.hostname);
  } catch (_) {
    return false;
  }
}

async function resolveUrl(url, requestedBy) {
  if (!isYoutubeUrl(url)) {
    return { ok: false, reason: 'only_youtube' };
  }

  const validation = await play.yt_validate(url).catch(() => false);
  if (!validation) return { ok: false, reason: 'invalid_url' };

  if (validation === 'playlist') {
    const playlist = await play.playlist_info(url, { incomplete: true });
    const videos = await playlist.all_videos();
    const items = videos.slice(0, MAX_PLAYLIST_ITEMS).map(video => ({
      title: video.title || 'YouTube audio',
      url: video.url,
      duration: video.durationRaw || '—',
      requestedBy,
    }));
    return { ok: true, items, playlistTitle: playlist.title || 'YouTube playlist' };
  }

  const info = await play.video_info(url);
  const details = info.video_details;
  return {
    ok: true,
    items: [{
      title: details.title || 'YouTube audio',
      url: details.url || url,
      duration: details.durationRaw || '—',
      requestedBy,
    }]
  };
}

async function ensureConnection(interaction) {
  const voiceChannel = await getRequesterVoiceChannel(interaction);
  if (!voiceChannel) return { ok: false, reason: 'not_in_voice' };

  const me = interaction.guild?.members?.me || await interaction.guild.members.fetchMe().catch(() => null);
  const permissions = me ? voiceChannel.permissionsFor(me) : null;
  const missing = [];
  if (permissions && !permissions.has('ViewChannel')) missing.push('ViewChannel');
  if (permissions && !permissions.has('Connect')) missing.push('Connect');
  if (permissions && !permissions.has('Speak')) missing.push('Speak');

  // joinable/speakable учитывают overwrite конкретного канала. Это полезнее, чем проверять только роль сервера.
  if (missing.length || voiceChannel.joinable === false || voiceChannel.speakable === false) {
    console.warn('[Music] Нет доступа к voice-каналу:', {
      guildId: interaction.guildId,
      channelId: voiceChannel.id,
      channelName: voiceChannel.name,
      joinable: voiceChannel.joinable,
      speakable: voiceChannel.speakable,
      missing,
    });
    return { ok: false, reason: 'missing_voice_permissions', missing, voiceChannel };
  }

  const state = getState(interaction.guildId);
  state.textChannelId = interaction.channelId;
  state.voiceChannelId = voiceChannel.id;

  let connection = getVoiceConnection(interaction.guildId);
  if (!connection || connection.joinConfig.channelId !== voiceChannel.id) {
    connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: interaction.guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false,
    });
  }

  state.connection = connection;
  connection.subscribe(state.player);

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, Number(process.env.MUSIC_CONNECT_TIMEOUT || 30000));
  } catch (error) {
    const message = error?.message || String(error);
    console.error('[Music] Ошибка подключения к voice-каналу:', {
      guildId: interaction.guildId,
      channelId: voiceChannel.id,
      channelName: voiceChannel.name,
      status: connection.state?.status,
      error: message,
    });
    try { connection.destroy(); } catch (_) {}
    state.connection = null;
    return { ok: false, reason: 'connection_failed', error, voiceChannel };
  }

  return { ok: true, state, voiceChannel };
}

async function enqueue(interaction, url) {
  const connect = await ensureConnection(interaction);
  if (!connect.ok) return connect;

  const resolved = await resolveUrl(url, interaction.user.username || interaction.user.tag);
  if (!resolved.ok) return resolved;

  connect.state.queue.push(...resolved.items);
  addAudit('music_enqueue', interaction.user, {
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    voiceChannelId: connect.voiceChannel.id,
    count: resolved.items.length,
    firstTitle: resolved.items[0]?.title,
  });

  if (!connect.state.current && connect.state.player.state.status !== AudioPlayerStatus.Playing) {
    await playNext(connect.state);
  }

  return { ok: true, state: connect.state, added: resolved.items, playlistTitle: resolved.playlistTitle || null };
}

async function playNext(state) {
  const next = state.queue.shift();
  if (!next) {
    state.current = null;
    state.playing = false;
    return;
  }

  state.current = next;
  state.playing = true;

  const stream = await play.stream(next.url);
  const resource = createAudioResource(stream.stream, {
    inputType: stream.type,
    metadata: next,
  });
  state.player.play(resource);
}

function getQueue(guildId) {
  return getState(guildId);
}

function pause(guildId) {
  const state = getState(guildId);
  return state.player.pause();
}

function resume(guildId) {
  const state = getState(guildId);
  return state.player.unpause();
}

function skip(guildId) {
  const state = getState(guildId);
  state.player.stop(true);
  return true;
}

function stop(guildId) {
  const state = getState(guildId);
  state.queue = [];
  state.current = null;
  state.playing = false;
  state.player.stop(true);
  return true;
}

function leave(guildId) {
  stop(guildId);
  const connection = getVoiceConnection(guildId);
  if (connection) connection.destroy();
  const state = getState(guildId);
  state.connection = null;
  state.voiceChannelId = null;
  return true;
}

function buildMusicPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('🎵 Музыкальная панель')
    .setDescription(`Включай музыку по ссылке YouTube прямо в своей voice-комнате. Сначала зайди в голосовой канал, затем нажми **Включить YouTube** или используй \`/music play\`.

Используй только контент, который разрешено проигрывать на твоем сервере.`)
    .addFields(
      { name: '▶️ Быстрый старт', value: '1. Зайди в voice-комнату\n2. Нажми **Включить YouTube**\n3. Вставь ссылку\n4. Управляй воспроизведением кнопками' },
      { name: '🔗 Поддержка', value: 'YouTube video и playlist. Для playlist добавляется ограниченное число треков.' }
    )
    .setFooter({ text: 'ServerCore • Music Panel' });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music:play_modal').setLabel('Включить YouTube').setEmoji('▶️').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('music:pause').setLabel('Пауза').setEmoji('⏸️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music:resume').setLabel('Продолжить').setEmoji('▶️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music:skip').setLabel('Пропустить').setEmoji('⏭️').setStyle(ButtonStyle.Primary)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music:queue').setLabel('Очередь').setEmoji('📃').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music:stop').setLabel('Стоп').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('music:leave').setLabel('Выйти').setEmoji('👋').setStyle(ButtonStyle.Danger)
  );
  return { embeds: [embed], components: [row1, row2] };
}

function buildPlayModal() {
  return new ModalBuilder()
    .setCustomId('music:modal:play')
    .setTitle('Включить музыку')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('url')
          .setLabel('YouTube-ссылка')
          .setPlaceholder('https://www.youtube.com/watch?v=...')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
}

function buildNowPlayingEmbed(state) {
  const current = state.current;
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(current ? '🎶 Сейчас играет' : '🎵 Музыка')
    .setDescription(current ? `**${current.title}**\nДлительность: ${current.duration}\nДобавил: ${current.requestedBy}` : 'Сейчас ничего не играет.')
    .setFooter({ text: `В очереди: ${state.queue.length}` });
  return embed;
}

function buildQueuePayload(guildId) {
  const state = getState(guildId);
  const lines = state.queue.slice(0, 10).map((item, idx) => `${idx + 1}. **${item.title}** — ${item.duration}`);
  const embed = buildNowPlayingEmbed(state);
  embed.addFields({ name: '📃 Очередь', value: lines.length ? lines.join('\n').slice(0, 1024) : 'Очередь пуста.' });
  return { embeds: [embed], components: [] };
}

async function handleMusicButton(interaction) {
  const action = interaction.customId.split(':')[1];

  if (action === 'play_modal') {
    await interaction.showModal(buildPlayModal());
    return null;
  }

  if (action === 'queue') return buildQueuePayload(interaction.guildId);

  if (action === 'pause') {
    pause(interaction.guildId);
    return { content: '⏸️ Пауза.', embeds: [], components: [] };
  }
  if (action === 'resume') {
    resume(interaction.guildId);
    return { content: '▶️ Воспроизведение продолжено.', embeds: [], components: [] };
  }
  if (action === 'skip') {
    skip(interaction.guildId);
    return { content: '⏭️ Трек пропущен.', embeds: [], components: [] };
  }
  if (action === 'stop') {
    stop(interaction.guildId);
    return { content: '⏹️ Музыка остановлена, очередь очищена.', embeds: [], components: [] };
  }
  if (action === 'leave') {
    leave(interaction.guildId);
    return { content: '👋 Я вышел из voice-канала.', embeds: [], components: [] };
  }

  return { content: '❌ Неизвестное действие музыкальной панели.', embeds: [], components: [] };
}

async function handleMusicModal(interaction) {
  const url = interaction.fields.getTextInputValue('url');
  const result = await enqueue(interaction, url);
  if (!result.ok) {
    if (result.reason === 'not_in_voice') return { content: '❌ Сначала зайди в голосовой канал.', embeds: [], components: [] };
    if (result.reason === 'only_youtube') return { content: '❌ Сейчас поддерживаются только ссылки YouTube.', embeds: [], components: [] };
    if (result.reason === 'invalid_url') return { content: '❌ Не удалось распознать YouTube-ссылку.', embeds: [], components: [] };
    if (result.reason === 'missing_voice_permissions') return { content: `❌ У меня нет доступа к voice-каналу **${result.voiceChannel?.name || 'канал'}**. Проверь права View Channel / Connect / Speak именно в этом канале или категории.`, embeds: [], components: [] };
    if (result.reason === 'connection_failed') return { content: `❌ Не удалось подключиться к voice-каналу **${result.voiceChannel?.name || 'канал'}**. Я записал подробную ошибку в логи хостинга.`, embeds: [], components: [] };
    return { content: `❌ Не удалось добавить трек: ${result.reason || 'ошибка'}.`, embeds: [], components: [] };
  }

  const state = result.state;
  const addedText = result.added.length === 1
    ? `Добавлен трек: **${result.added[0].title}**`
    : `Добавлено треков: **${result.added.length}**${result.playlistTitle ? ` из плейлиста **${result.playlistTitle}**` : ''}`;
  return { content: `✅ ${addedText}`, embeds: [buildNowPlayingEmbed(state)], components: [] };
}

module.exports = {
  buildMusicPanel,
  buildPlayModal,
  buildNowPlayingEmbed,
  buildQueuePayload,
  enqueue,
  pause,
  resume,
  skip,
  stop,
  leave,
  getQueue,
  handleMusicButton,
  handleMusicModal,
};
