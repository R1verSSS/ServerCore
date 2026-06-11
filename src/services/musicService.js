async function safeYoutubeValidate(url) {
  if (!isYoutubeUrl(url)) return false;

  // Сначала проверяем play-dl, чтобы не сломать playlist-режим.
  // Если play-dl не распознал валидный video URL, используем локальный fallback
  // через @distube/ytdl-core. Это помогает при `Invalid URL` на стороне play-dl.
  try {
    const result = play.yt_validate(url);
    const resolved = result && typeof result.then === 'function' ? await result : result;
    if (resolved) return resolved;
  } catch (_) {
    // ignore and try fallback
  }

  if (isDistubeYtdlAvailable() && distubeYtdl.validateURL(url)) {
    return 'video';
  }

  return false;
}

function normalizeTrackUrl(value, fallback = '') {
  const url = String(value || fallback || '').trim();
  if (!url || url === 'undefined' || url === 'null') return '';
  return url;
}

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
  StreamType,
} = require('@discordjs/voice');
const play = require('play-dl');
let distubeYtdl = null;
try {
  distubeYtdl = require('@distube/ytdl-core');
} catch (error) {
  distubeYtdl = null;
}
const { execFileSync } = require('child_process');
const { addAudit } = require('./auditService');
const { isModuleEnabled } = require('./moduleService');

const queues = new Map();
const MAX_PLAYLIST_ITEMS = Number(process.env.MUSIC_MAX_PLAYLIST_ITEMS || 15);
const USE_DISTUBE_YTDL = String(process.env.MUSIC_USE_DISTUBE_YTDL || 'true').toLowerCase() !== 'false';
const YOUTUBE_COOKIE = String(process.env.MUSIC_YOUTUBE_COOKIE || '').trim();

function shouldLogMusicDebug() {
  return String(process.env.MUSIC_DEBUG || '').toLowerCase() === 'true';
}

function buildYtdlOptions(extra = {}) {
  const headers = {};
  if (YOUTUBE_COOKIE) headers.cookie = YOUTUBE_COOKIE;

  return {
    filter: 'audioonly',
    quality: 'highestaudio',
    highWaterMark: 1 << 25,
    dlChunkSize: 0,
    ...extra,
    requestOptions: {
      ...(extra.requestOptions || {}),
      headers: {
        ...(extra.requestOptions?.headers || {}),
        ...headers,
      },
    },
  };
}

function formatDurationFromSeconds(seconds) {
  const total = Number(seconds || 0);
  if (!Number.isFinite(total) || total <= 0) return '—';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function isDistubeYtdlAvailable() {
  return Boolean(USE_DISTUBE_YTDL && distubeYtdl && typeof distubeYtdl.validateURL === 'function');
}

function summarizeMusicError(error) {
  if (!error) return 'unknown error';
  const parts = [];
  if (error.name) parts.push(error.name);
  if (error.code) parts.push(`code=${error.code}`);
  if (error.message) parts.push(error.message);
  return parts.length ? parts.join(': ') : String(error);
}

function makeProviderError(provider, error) {
  const wrapped = new Error(`${provider}: ${summarizeMusicError(error)}`);
  wrapped.provider = provider;
  wrapped.cause = error;
  return wrapped;
}

function logMusicDebug(label, payload = {}) {
  if (!shouldLogMusicDebug()) return;
  console.log(`[Music] ${label}:`, payload);
}

function checkModuleAvailable(name) {
  try {
    require.resolve(name);
    return '✅';
  } catch (_) {
    return '❌';
  }
}

function checkCommandAvailable(command, args = ['--version']) {
  try {
    execFileSync(command, args, { stdio: 'ignore', timeout: 4000 });
    return '✅';
  } catch (_) {
    return '❌';
  }
}

function buildVoiceDiagnosePayload() {
  const stateSummary = [];
  stateSummary.push(`MUSIC_ENABLED: ${process.env.MUSIC_ENABLED || 'не задано'}`);
  stateSummary.push(`MUSIC_DEBUG: ${process.env.MUSIC_DEBUG || 'не задано'}`);
  stateSummary.push(`MUSIC_FORCE_IPV4: ${process.env.MUSIC_FORCE_IPV4 || 'не задано'}`);
  stateSummary.push(`MUSIC_CONNECT_TIMEOUT: ${process.env.MUSIC_CONNECT_TIMEOUT || 'не задано'}`);
  stateSummary.push(`MUSIC_USE_DISTUBE_YTDL: ${process.env.MUSIC_USE_DISTUBE_YTDL || 'true'}`);
  stateSummary.push(`MUSIC_YOUTUBE_COOKIE: ${YOUTUBE_COOKIE ? 'задан' : 'не задан'}`);

  const modules = [
    '@discordjs/voice',
    '@discordjs/opus',
    'opusscript',
    'sodium-native',
    'libsodium-wrappers',
    'tweetnacl',
    'play-dl',
    '@distube/ytdl-core',
  ];

  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('🎵 Диагностика Discord Voice')
    .setDescription('Краткая проверка окружения для музыки. Полный тест UDP доступен в терминале: `npm run voice:diagnose`.')
    .addFields(
      { name: '⚙️ Переменные', value: stateSummary.join('\n').slice(0, 1024), inline: false },
      { name: '📦 Node-модули', value: modules.map(name => `${checkModuleAvailable(name)} ${name}`).join('\n'), inline: false },
      { name: '🎚️ Системные команды', value: [`${checkCommandAvailable('ffmpeg', ['-version'])} ffmpeg`, `${checkCommandAvailable('ffprobe', ['-version'])} ffprobe`].join('\n'), inline: false },
      { name: '🧪 Следующий шаг', value: 'Если всё отмечено ✅, зайди в voice-канал и проверь `/music play`. Если снова зависает на `signalling`, отправь поддержке Bothost вывод `npm run voice:diagnose` и логи music-подключения.' }
    )
    .setFooter({ text: 'ServerCore • Voice Diagnose' })
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

async function resolveYoutubeVideoWithPlayDl(inputUrl, requestedBy) {
  const info = await play.video_info(inputUrl);
  const details = info.video_details || {};
  const videoUrl = normalizeTrackUrl(details.url, inputUrl);

  return {
    title: details.title || 'YouTube audio',
    url: videoUrl || inputUrl,
    duration: details.durationRaw || '—',
    requestedBy,
    provider: 'play-dl',
  };
}

async function resolveYoutubeVideoWithDistube(inputUrl, requestedBy) {
  if (!isDistubeYtdlAvailable() || !distubeYtdl.validateURL(inputUrl)) {
    throw new Error('@distube/ytdl-core is not available or URL is not supported');
  }

  const info = typeof distubeYtdl.getBasicInfo === 'function'
    ? await distubeYtdl.getBasicInfo(inputUrl, buildYtdlOptions())
    : await distubeYtdl.getInfo(inputUrl, buildYtdlOptions());

  const details = info.videoDetails || {};
  const videoUrl = normalizeTrackUrl(details.video_url || details.videoUrl || inputUrl, inputUrl);

  return {
    title: details.title || 'YouTube audio',
    url: videoUrl || inputUrl,
    duration: details.lengthSeconds ? formatDurationFromSeconds(details.lengthSeconds) : '—',
    requestedBy,
    provider: '@distube/ytdl-core',
  };
}

async function resolveUrl(url, requestedBy) {
  const inputUrl = normalizeTrackUrl(url);
  if (!inputUrl || !isYoutubeUrl(inputUrl)) {
    return { ok: false, reason: 'only_youtube' };
  }

  const validation = await safeYoutubeValidate(inputUrl);
  if (!validation) return { ok: false, reason: 'invalid_url' };

  if (validation === 'playlist') {
    try {
      const playlist = await play.playlist_info(inputUrl, { incomplete: true });
      const videos = await playlist.all_videos();
      const items = videos
        .slice(0, MAX_PLAYLIST_ITEMS)
        .map(video => {
          const itemUrl = normalizeTrackUrl(video.url, inputUrl);
          return {
            title: video.title || 'YouTube audio',
            url: itemUrl,
            duration: video.durationRaw || '—',
            requestedBy,
            provider: 'play-dl-playlist',
          };
        })
        .filter(item => item.url && isYoutubeUrl(item.url));

      if (!items.length) return { ok: false, reason: 'no_valid_tracks' };
      return { ok: true, items, playlistTitle: playlist.title || 'YouTube playlist' };
    } catch (error) {
      console.error('[Music] Не удалось получить YouTube playlist:', {
        url: inputUrl,
        error: summarizeMusicError(error),
        stack: shouldLogMusicDebug() ? error?.stack : undefined,
      });
      return { ok: false, reason: 'youtube_info_failed', error };
    }
  }

  const errors = [];

  // Сначала пробуем @distube/ytdl-core: он не native-зависимость и часто лучше переживает
  // изменения YouTube, чем архивированный play-dl. Если пакет не установился на хостинге,
  // бот не падает и просто перейдет к play-dl.
  if (isDistubeYtdlAvailable()) {
    try {
      const item = await resolveYoutubeVideoWithDistube(inputUrl, requestedBy);
      return { ok: true, items: [item] };
    } catch (error) {
      errors.push(makeProviderError('@distube/ytdl-core info', error));
    }
  }

  try {
    const item = await resolveYoutubeVideoWithPlayDl(inputUrl, requestedBy);
    return { ok: true, items: [item] };
  } catch (error) {
    errors.push(makeProviderError('play-dl info', error));
  }

  console.error('[Music] Все провайдеры не смогли получить данные YouTube:', {
    url: inputUrl,
    errors: errors.map(error => error.message),
    stack: shouldLogMusicDebug() ? errors.map(error => error.cause?.stack || error.stack).join('\n---\n') : undefined,
  });

  return { ok: false, reason: 'youtube_info_failed', errors };
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
  if (!isMusicEnabled()) return { ok: false, reason: 'music_disabled' };
  const connect = await ensureConnection(interaction);
  if (!connect.ok) return connect;

  const resolved = await resolveUrl(url, interaction.user.username || interaction.user.tag);
  if (!resolved.ok) return resolved;

  const validItems = (resolved.items || []).filter(item => item?.url && isYoutubeUrl(item.url));
  if (!validItems.length) return { ok: false, reason: 'no_valid_tracks' };

  connect.state.queue.push(...validItems);
  addAudit('music_enqueue', interaction.user, {
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    voiceChannelId: connect.voiceChannel.id,
    count: validItems.length,
    firstTitle: validItems[0]?.title,
  });

  if (!connect.state.current && connect.state.player.state.status !== AudioPlayerStatus.Playing) {
    await playNext(connect.state);
  }

  return { ok: true, state: connect.state, added: validItems, playlistTitle: resolved.playlistTitle || null };
}


async function openYoutubeStreamWithDistube(url) {
  if (!isDistubeYtdlAvailable() || !distubeYtdl.validateURL(url)) {
    throw new Error('@distube/ytdl-core is not available or URL is not supported');
  }

  const stream = distubeYtdl(url, buildYtdlOptions());
  return {
    stream,
    type: StreamType.Arbitrary,
    provider: '@distube/ytdl-core',
  };
}

async function openYoutubeStreamWithPlayDl(url) {
  try {
    const stream = await play.stream(url, { discordPlayerCompatibility: true });
    return {
      ...stream,
      provider: 'play-dl stream',
    };
  } catch (error) {
    throw makeProviderError('play-dl stream', error);
  }
}

async function openYoutubeStreamWithPlayDlInfo(url) {
  try {
    const info = await play.video_info(url);
    if (typeof play.stream_from_info === 'function') {
      const stream = await play.stream_from_info(info);
      return {
        ...stream,
        provider: 'play-dl stream_from_info',
      };
    }

    return await openYoutubeStreamWithPlayDl(url);
  } catch (error) {
    throw makeProviderError('play-dl stream_from_info', error);
  }
}

async function openYoutubeStream(track) {
  const url = normalizeTrackUrl(track?.url);
  if (!url || !isYoutubeUrl(url)) {
    throw new Error(`Invalid track URL: ${url || 'empty'}`);
  }

  const errors = [];
  logMusicDebug('Пробую открыть YouTube audio stream', { title: track?.title, url, providerHint: track?.provider });

  // 1. Основной вариант — @distube/ytdl-core. Он optional: если зависимость не установилась
  // на хостинге, бот не упадет при запуске, а продолжит работать через play-dl.
  if (isDistubeYtdlAvailable()) {
    try {
      return await openYoutubeStreamWithDistube(url);
    } catch (error) {
      errors.push(makeProviderError('@distube/ytdl-core stream', error));
    }
  }

  // 2. Быстрый вариант play-dl.
  try {
    return await openYoutubeStreamWithPlayDl(url);
  } catch (error) {
    errors.push(error);
  }

  // 3. Старый безопасный вариант play-dl: сначала video_info, затем stream_from_info.
  try {
    return await openYoutubeStreamWithPlayDlInfo(url);
  } catch (error) {
    errors.push(error);
  }

  const message = `All YouTube stream providers failed: ${errors.map(error => error.message || String(error)).join(' | ')}`;
  const finalError = new Error(message);
  finalError.errors = errors;
  throw finalError;
}

async function playNext(state) {
  const next = state.queue.shift();
  if (!next) {
    state.current = null;
    state.playing = false;
    return;
  }

  if (!next.url || !isYoutubeUrl(next.url)) {
    console.warn('[Music] Пропущен трек без корректного URL:', {
      title: next.title,
      url: next.url,
    });
    return playNext(state);
  }

  state.current = next;
  state.playing = true;

  try {
    const stream = await openYoutubeStream(next);
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type,
      metadata: next,
    });
    state.player.play(resource);
  } catch (error) {
    console.error('[Music] Не удалось открыть аудиопоток:', {
      title: next.title,
      url: next.url,
      error: summarizeMusicError(error),
      providerErrors: Array.isArray(error?.errors) ? error.errors.map(item => item.message || String(item)) : undefined,
      stack: shouldLogMusicDebug() ? error?.stack : undefined,
    });
    state.current = null;
    state.playing = false;
    return playNext(state);
  }
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
      { name: 'Подсказка', value: enabled ? 'Если подключение зависает на `signalling`, хостинг, вероятно, не поддерживает Discord Voice/UDP.' : 'Для включения поставь `MUSIC_ENABLED=true`, затем redeploy.' }
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
    if (result.reason === 'youtube_info_failed') return { content: '❌ YouTube не отдал данные по ссылке. Частая причина — ограничение IP-ноды хостинга или проверка `Sign in to confirm you’re not a bot`. Подробности записаны в логи.', embeds: [], components: [] };
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
  buildVoiceDiagnosePayload,
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
