#!/usr/bin/env node
const { execFileSync, spawnSync } = require('child_process');
const dgram = require('dgram');

function ok(label, value = '') { console.log(`[OK]   ${label}${value ? `: ${value}` : ''}`); }
function warn(label, value = '') { console.log(`[WARN] ${label}${value ? `: ${value}` : ''}`); }
function fail(label, value = '') { console.log(`[FAIL] ${label}${value ? `: ${value}` : ''}`); }
function hasModule(name) {
  try { ok(`Node module ${name}`, require.resolve(name)); return true; }
  catch (error) { fail(`Node module ${name}`, error.message); return false; }
}
function commandVersion(cmd, args = ['--version']) {
  try {
    const out = execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000 });
    ok(`Command ${cmd}`, String(out || '').split('\n').find(Boolean)?.slice(0, 160) || 'installed');
    return true;
  } catch (error) { fail(`Command ${cmd}`, error.message); return false; }
}
function nodeEnv(name) { const value = process.env[name]; value ? ok(`ENV ${name}`, value) : warn(`ENV ${name}`, 'not set'); }
async function udpProbe() {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const timer = setTimeout(() => { socket.close(); warn('UDP probe', 'no response from 1.1.1.1:53 within 3000ms'); resolve(false); }, 3000);
    socket.once('error', (error) => { clearTimeout(timer); socket.close(); fail('UDP probe', error.message); resolve(false); });
    socket.once('message', () => { clearTimeout(timer); socket.close(); ok('UDP probe', 'received DNS response from 1.1.1.1:53'); resolve(true); });
    const query = Buffer.from([0x12,0x34,0x01,0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x07,0x64,0x69,0x73,0x63,0x6f,0x72,0x64,0x03,0x63,0x6f,0x6d,0x00,0x00,0x01,0x00,0x01]);
    socket.send(query, 53, '1.1.1.1');
  });
}
(async () => {
  console.log('==== ServerCore Discord Voice Diagnose ====');
  console.log(`Node.js: ${process.version}`);
  console.log(`Platform: ${process.platform} ${process.arch}`);
  console.log(`PWD: ${process.cwd()}`);
  console.log('');
  ['MUSIC_ENABLED','MUSIC_DEBUG','MUSIC_FORCE_IPV4','MUSIC_CONNECT_TIMEOUT','MUSIC_USE_DISTUBE_YTDL','MUSIC_YOUTUBE_COOKIE','NODE_ENV'].forEach(nodeEnv);
  console.log('');
  ['@discordjs/voice','@discordjs/opus','opusscript','sodium-native','libsodium-wrappers','tweetnacl','play-dl','@distube/ytdl-core'].forEach(hasModule);
  console.log('');
  commandVersion('ffmpeg', ['-version']);
  commandVersion('ffprobe', ['-version']);
  console.log('');
  const nc = spawnSync('sh', ['-lc', 'command -v nc || command -v netcat || true'], { encoding: 'utf8' });
  if (String(nc.stdout || '').trim()) ok('UDP utility', String(nc.stdout).trim()); else warn('UDP utility', 'nc/netcat not found');
  await udpProbe();
  console.log('');
  console.log('Summary:');
  console.log('- If all modules and ffmpeg are OK, but Discord voice hangs on signalling, likely cause is Docker/NAT UDP/IP discovery on the hosting node.');
  console.log('- If Discord voice is OK but YouTube streams fail, run: npm run music:youtube:diagnose -- <youtube-url>');
  console.log('- Send this output plus voice/music logs to the hosting support if /music play still fails.');
  console.log('===========================================');
})().catch((error) => { fail('diagnose crashed', error.stack || error.message); process.exitCode = 1; });
