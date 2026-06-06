const { spawnSync } = require('node:child_process');
const dgram = require('node:dgram');
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
const { isModuleEnabled } = require('./moduleService');

const queues = new Map();
const MAX_PLAYLIST_ITEMS = Number(process.env.MUSIC_MAX_PLAYLIST_ITEMS || 15);

const MUSIC_DEBUG = String(process.env.MUSIC_DEBUG || 'false').toLowerCase() === 'true';
const MUSIC_FORCE_IPV4 = String(process.env.MUSIC_FORCE_IPV4 || 'true').toLowerCase() !== 'false';

function musicLog(message, data = null) {
  if (!MUSIC_DEBUG) return;
  if (data) console.log(`[Music] ${message}`, data);
  else console.log(`[Music] ${message}`);
}

function getPackageStatus(name) {
  try {
    const pkg = require(`${name}/package.json`);
    return { ok: true, version: pkg.version || 'installed' };
  } catch (error) {
    return { ok: false, version: null, error: error?.message || String(error) };
  }
}

function commandStatus(command, args = ['--version']) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 5000 });
  return {
    ok: result.status === 0,
    status: result.status,
    output: String(result.stdout || result.stderr || '').split('\n')[0].slice(0, 160),
    error: result.error?.message || null,
  };
}

function udpDnsProbe(timeoutMs = Number(process.env.MUSIC_UDP_TEST_TIMEOUT || 3000)) {
  return new Promise(resolve => {
    const socket = dgram.createSocket('udp4');
    const startedAt = Date.now();
    const query = Buffer.from('12340100000100000000000006676f6f676c6503636f6d0000010001', 'hex');
    const timer = setTimeout(() => {
      try { socket.close(); } catch (_) {}
      resolve({ ok: false, reason: 'timeout', ms: Date.now() - startedAt });
    }, timeoutMs);

    socket.once('error', error => {
      clearTimeout(timer);
      try { socket.close(); } catch (_) {}
      resolve({ ok: false, reason: error?.message || String(error), ms: Date.now() - startedAt });
    });

    socket.once('message', () => {
      clearTimeout(timer);
      try { socket.close(); } catch (_) {}
      resolve({ ok: true, reason: 'udp_dns_response', ms: Date.now() - startedAt });
    });

    socket.send(query, 53, '8.8.8.8', error => {
      if (error) {
        clearTimeout(timer);
        try { socket.close(); } catch (_) {}
        resolve({ ok: false, reason: error?.message || String(error), ms: Date.now() - startedAt });
      }
    });
  });
}

function collectVoiceDependencyReport() {
  const packages = ['@discordjs/voice', '@discordjs/opus', 'opusscript', 'libsodium-wrappers', 'sodium-native', 'tweetnacl', 'play-dl'];
  const deps = Object.fromEntries(packages.map(name => [name, getPackageStatus(name)]));
  return {
    node: process.version,
    platform: `${process.platform}/${process.arch}`,
    musicEnabled: String(process.env.MUSIC_ENABLED || 'true'),
    connectTimeout: Number(process.env.MUSIC_CONNECT_TIMEOUT || 45000),
    forceIPv4: MUSIC_FORCE_IPV4,
    ffmpeg: commandStatus('ffmpeg'),
    deps,
  };
}

async function buildMusicDiagnosticPayload() {
  const report = collectVoiceDependencyReport();
  const udp = await udpDnsProbe();
  const depLines = Object.entries(report.deps).map(([name, item]) => `${item.ok ? '✅' : '❌'} ${name}${item.version ? ` ${item.version}` : ''}`);
  const embed = new EmbedBuilder()
    .setColor(udp.ok && report.ffmpeg.ok ? 0x57F287 : 0xFEE75C)
    .setTitle('🧪 Диагностика Discord Voice / Music')
    .setDescription('Проверка окружения для YouTube-аудио в voice-каналах. Если подключение зависает на `signalling`, отправь этот блок поддержке хостинга вместе с логами.')
    .addFields(
      { name: 'Runtime', value: [`Node: ${report.node}`, `Platform: ${report.platform}`, `MUSIC_ENABLED: ${report.musicEnabled}`, `Timeout: ${report.connectTimeout} ms`].join('\n'), inline: false },
      { name: 'Зависимости', value: depLines.join('\n').slice(0, 1024), inline: false },
      { name: 'ffmpeg', value: report.ffmpeg.ok ? `✅ ${report.ffmpeg.output || 'available'}` : `❌ ${report.ffmpeg.error || report.ffmpeg.output || 'not found'}`, inline: false },
      { name: 'UDP probe', value: udp.ok ? `✅ UDP DNS ответ за ${udp.ms} ms` : `⚠️ UDP DNS не ответил: ${udp.reason} (${udp.ms} ms)`, inline: false },
      { name: 'Важно', value: 'Успешный UDP DNS-тест не гарантирует Discord Voice, но провал указывает на проблему UDP/NAT. Discord Voice также требует корректный UDP IP discovery внутри Docker bridge.' }
    )
    .setFooter({ text: 'ServerCore • Voice Diagnostic' })
    .setTimestamp();
  return { embeds: [embed], components: [] };
}


function isMusicEnabled() {
  return String(process.env.MUSIC_ENABLED || 'true').toLowerCase() !== 'false' && isModuleEnabled('music');
}

function musicDisabledPayload() {
  return {
    embeds: [new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('🎵 Музыка отключена')
      .setDescription('Музыкальный модуль сейчас отключен на этом хостинге. Для работы YouTube-аудио Discord обычно нужен VPS/UDP или Lavalink. Остальные функции ServerCore работают без музыки.')
      .addFields(
        { name: 'Как включить', value: 'Поставь `MUSIC_ENABLED=true` и убедись, что хостинг поддерживает Discord Voice/UDP.' },
        { name: 'Рекомендуемый режим для Bothost', value: '`MUSIC_ENABLED=false`, если voice-подключение зависает на `signalling`.' }
      )
      .setFooter({ text: 'ServerCore • Music Status' })],
    components: []
  };
}


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
      forceIPv4: MUSIC_FORCE_IPV4,
    });
    connection.on('stateChange', (oldState, newState) => {
      musicLog('Voice connection state', {
        guildId: interaction.guildId,
        channelId: voiceChannel.id,
        oldStatus: oldState?.status,
        newStatus: newState?.status,
        networking: newState?.networking?.state?.code || newState?.networking?.state?.ws?.readyState || null,
      });
    });
  }

  state.connection = connection;
  connection.subscribe(state.player);

  try {
    musicLog('Waiting for VoiceConnectionStatus.Ready', { guildId: interaction.guildId, channelId: voiceChannel.id, timeout: Number(process.env.MUSIC_CONNECT_TIMEOUT || 45000) });
    await entersState(connection, VoiceConnectionStatus.Ready, Number(process.env.MUSIC_CONNECT_TIMEOUT || 45000));
  } catch (error) {
    const message = error?.message || String(error);
    console.error('[Music] Ошибка подключения к voice-каналу:', {
      guildId: interaction.guildId,
      channelId: voiceChannel.id,
      channelName: voiceChannel.name,
      status: connection.state?.status,
      networkingStatus: connection.state?.networking?.state?.code || null,
      forceIPv4: MUSIC_FORCE_IPV4,
      timeout: Number(process.env.MUSIC_CONNECT_TIMEOUT || 45000),
      error: message,
    });
    try { connection.destroy(); } catch (_) {}
    state.connection = null;
    return { ok: false, reason: 'connection_failed', error, voiceChannel };
  }

  return { ok: true, state, voiceChannel };
}

async function enqueue(interaction, url) {
  if (!isMusicEnabled()) return { ok: false, reason: 'music_disabled' };
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
  const enabled = isMusicEnabled();
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('🎵 Музыкальная панель')
    .setDescription(enabled
      ? `Включай музыку по ссылке YouTube прямо в своей voice-комнате. Сначала зайди в голосовой канал, затем нажми **Включить YouTube** или используй \`/music play\`.

Используй только контент, который разрешено проигрывать на твоем сервере.`
      : '⚠️ Музыкальный модуль отключен на текущем хостинге. Для Discord Voice/YouTube-аудио нужен VPS/UDP или отдельный Lavalink-сервер. Панель оставлена как справка.')
    .addFields(
      { name: '▶️ Быстрый старт', value: '1. Зайди в voice-комнату\n2. Нажми **Включить YouTube**\n3. Вставь ссылку\n4. Управляй воспроизведением кнопками' },
      { name: '🔗 Поддержка', value: 'YouTube video и playlist. Для playlist добавляется ограниченное число треков.' }
    )
    .setFooter({ text: 'ServerCore • Music Panel' });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music:play_modal').setLabel('Включить YouTube').setEmoji('▶️').setStyle(ButtonStyle.Success).setDisabled(!enabled),
    new ButtonBuilder().setCustomId('music:pause').setLabel('Пауза').setEmoji('⏸️').setStyle(ButtonStyle.Secondary).setDisabled(!enabled),
    new ButtonBuilder().setCustomId('music:resume').setLabel('Продолжить').setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(!enabled),
    new ButtonBuilder().setCustomId('music:skip').setLabel('Пропустить').setEmoji('⏭️').setStyle(ButtonStyle.Primary).setDisabled(!enabled)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music:queue').setLabel('Очередь').setEmoji('📃').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music:stop').setLabel('Стоп').setEmoji('⏹️').setStyle(ButtonStyle.Danger).setDisabled(!enabled),
    new ButtonBuilder().setCustomId('music:leave').setLabel('Выйти').setEmoji('👋').setStyle(ButtonStyle.Danger).setDisabled(!enabled)
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


function buildMusicStatusPayload(guildId) {
  const enabled = isMusicEnabled();
  const state = queues.get(guildId);
  const embed = new EmbedBuilder()
    .setColor(enabled ? 0x57F287 : 0xFEE75C)
    .setTitle('🎵 Статус музыкального модуля')
    .addFields(
      { name: 'Состояние', value: enabled ? '✅ Включен' : '⚠️ Отключен', inline: true },
      { name: 'MUSIC_ENABLED', value: String(process.env.MUSIC_ENABLED || 'true'), inline: true },
      { name: 'Voice', value: state?.connection ? `Подключение: ${state.connection.state?.status || 'unknown'}` : 'Нет активного подключения', inline: false },
      { name: 'Очередь', value: state ? `Сейчас: ${state.current?.title || 'ничего'}\nВ очереди: ${state.queue.length}` : 'Очередь пуста', inline: false },
      { name: 'Окружение', value: `ffmpeg: ${commandStatus('ffmpeg').ok ? '✅' : '❌'}\n@discordjs/opus: ${getPackageStatus('@discordjs/opus').ok ? '✅' : '❌'}\nsodium-native: ${getPackageStatus('sodium-native').ok ? '✅' : '❌'}\nforceIPv4: ${MUSIC_FORCE_IPV4}`, inline: false },
      { name: 'Подсказка', value: enabled ? 'Если подключение зависает на `signalling`, выполни `/music diagnose` и отправь результат поддержке хостинга.' : 'Для включения поставь `MUSIC_ENABLED=true`, затем redeploy.' }
    )
    .setFooter({ text: 'ServerCore • Music Status' });
  return { embeds: [embed], components: [] };
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
  if (!isMusicEnabled() && action !== 'queue') return musicDisabledPayload();

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
  if (!isMusicEnabled()) return musicDisabledPayload();
  const url = interaction.fields.getTextInputValue('url');
  const result = await enqueue(interaction, url);
  if (!result.ok) {
    if (result.reason === 'not_in_voice') return { content: '❌ Сначала зайди в голосовой канал.', embeds: [], components: [] };
    if (result.reason === 'only_youtube') return { content: '❌ Сейчас поддерживаются только ссылки YouTube.', embeds: [], components: [] };
    if (result.reason === 'invalid_url') return { content: '❌ Не удалось распознать YouTube-ссылку.', embeds: [], components: [] };
    if (result.reason === 'music_disabled') return musicDisabledPayload();
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
  isMusicEnabled,
  musicDisabledPayload,
  buildMusicStatusPayload,
  buildMusicDiagnosticPayload,
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
