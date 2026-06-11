#!/usr/bin/env node
require('dotenv').config();

function ok(label, value = '') { console.log(`[OK]   ${label}${value ? `: ${value}` : ''}`); }
function warn(label, value = '') { console.log(`[WARN] ${label}${value ? `: ${value}` : ''}`); }
function fail(label, value = '') { console.log(`[FAIL] ${label}${value ? `: ${value}` : ''}`); }

function loadModule(name) {
  try {
    const mod = require(name);
    ok(`Node module ${name}`, require.resolve(name));
    return mod;
  } catch (error) {
    fail(`Node module ${name}`, error.message);
    return null;
  }
}

function getArgUrl() {
  const arg = process.argv.slice(2).find(Boolean);
  return String(arg || process.env.MUSIC_TEST_YOUTUBE_URL || 'https://www.youtube.com/watch?v=Jqn1XNc_094').trim();
}

function buildYtdlOptions() {
  const cookie = String(process.env.MUSIC_YOUTUBE_COOKIE || '').trim();
  return cookie ? { requestOptions: { headers: { cookie } } } : {};
}

function summarize(error) {
  if (!error) return 'unknown error';
  const parts = [];
  if (error.name) parts.push(error.name);
  if (error.code) parts.push(`code=${error.code}`);
  if (error.message) parts.push(error.message);
  return parts.length ? parts.join(': ') : String(error);
}

async function testPlayDl(play, url) {
  if (!play) return false;
  console.log('\n---- play-dl ----');
  try {
    const validation = await Promise.resolve(play.yt_validate(url));
    ok('play-dl validate', String(validation));

    const info = await play.video_info(url);
    ok('play-dl title', info.video_details?.title || 'title not found');

    const stream = typeof play.stream_from_info === 'function'
      ? await play.stream_from_info(info)
      : await play.stream(url, { discordPlayerCompatibility: true });

    ok('play-dl stream', `type=${stream?.type || 'unknown'}, readable=${Boolean(stream?.stream)}`);
    if (stream?.stream?.destroy) stream.stream.destroy();
    return true;
  } catch (error) {
    fail('play-dl YouTube test', summarize(error));
    if (process.env.MUSIC_DEBUG === 'true') console.error(error.stack || error);
    return false;
  }
}

async function testDistubeYtdl(ytdl, url) {
  if (!ytdl) return false;
  console.log('\n---- @distube/ytdl-core ----');
  try {
    if (typeof ytdl.validateURL !== 'function') throw new Error('validateURL is not available');
    ok('@distube/ytdl-core validate', String(ytdl.validateURL(url)));

    const info = typeof ytdl.getBasicInfo === 'function'
      ? await ytdl.getBasicInfo(url, buildYtdlOptions())
      : await ytdl.getInfo(url, buildYtdlOptions());

    ok('@distube/ytdl-core title', info.videoDetails?.title || 'title not found');

    const stream = ytdl(url, {
      filter: 'audioonly',
      quality: 'highestaudio',
      highWaterMark: 1 << 25,
      dlChunkSize: 0,
      ...buildYtdlOptions(),
    });

    ok('@distube/ytdl-core stream', `readable=${Boolean(stream)}`);
    if (stream?.destroy) stream.destroy();
    return true;
  } catch (error) {
    fail('@distube/ytdl-core YouTube test', summarize(error));
    if (process.env.MUSIC_DEBUG === 'true') console.error(error.stack || error);
    return false;
  }
}

(async () => {
  const url = getArgUrl();
  console.log('==== ServerCore YouTube Music Diagnose ====');
  console.log(`Node.js: ${process.version}`);
  console.log(`URL: ${url}`);
  console.log(`MUSIC_ENABLED: ${process.env.MUSIC_ENABLED || 'not set'}`);
  console.log(`MUSIC_USE_DISTUBE_YTDL: ${process.env.MUSIC_USE_DISTUBE_YTDL || 'true'}`);
  console.log(`MUSIC_YOUTUBE_COOKIE: ${process.env.MUSIC_YOUTUBE_COOKIE ? 'set' : 'not set'}`);

  const play = loadModule('play-dl');
  const ytdl = loadModule('@distube/ytdl-core');

  const distubeOk = await testDistubeYtdl(ytdl, url);
  const playDlOk = await testPlayDl(play, url);

  console.log('\nSummary:');
  if (distubeOk || playDlOk) {
    ok('YouTube audio provider', distubeOk ? '@distube/ytdl-core works' : 'play-dl works');
  } else {
    fail('YouTube audio provider', 'all providers failed');
    console.log('- If errors mention bot verification, forbidden, sign in, or no playable formats, the hosting IP/node may be restricted by YouTube.');
    console.log('- Ask hosting support to move the container to another node/IP or use VPS/Lavalink.');
    process.exitCode = 1;
  }
  console.log('===========================================');
})().catch((error) => {
  fail('diagnose crashed', error.stack || error.message);
  process.exitCode = 1;
});
