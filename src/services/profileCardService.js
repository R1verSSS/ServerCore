const { PNG } = require('pngjs');
const { getRequiredXp } = require('./xpService');
const { normalizeProfile, getColor, getBackground } = require('./profileCustomizationService');

const FONT = {
  'A':['01110','10001','10001','11111','10001','10001','10001'], 'B':['11110','10001','10001','11110','10001','10001','11110'],
  'C':['01111','10000','10000','10000','10000','10000','01111'], 'D':['11110','10001','10001','10001','10001','10001','11110'],
  'E':['11111','10000','10000','11110','10000','10000','11111'], 'F':['11111','10000','10000','11110','10000','10000','10000'],
  'G':['01111','10000','10000','10011','10001','10001','01111'], 'H':['10001','10001','10001','11111','10001','10001','10001'],
  'I':['11111','00100','00100','00100','00100','00100','11111'], 'J':['00111','00010','00010','00010','10010','10010','01100'],
  'K':['10001','10010','10100','11000','10100','10010','10001'], 'L':['10000','10000','10000','10000','10000','10000','11111'],
  'M':['10001','11011','10101','10101','10001','10001','10001'], 'N':['10001','11001','10101','10011','10001','10001','10001'],
  'O':['01110','10001','10001','10001','10001','10001','01110'], 'P':['11110','10001','10001','11110','10000','10000','10000'],
  'Q':['01110','10001','10001','10001','10101','10010','01101'], 'R':['11110','10001','10001','11110','10100','10010','10001'],
  'S':['01111','10000','10000','01110','00001','00001','11110'], 'T':['11111','00100','00100','00100','00100','00100','00100'],
  'U':['10001','10001','10001','10001','10001','10001','01110'], 'V':['10001','10001','10001','10001','10001','01010','00100'],
  'W':['10001','10001','10001','10101','10101','10101','01010'], 'X':['10001','10001','01010','00100','01010','10001','10001'],
  'Y':['10001','10001','01010','00100','00100','00100','00100'], 'Z':['11111','00001','00010','00100','01000','10000','11111'],
  '0':['01110','10001','10011','10101','11001','10001','01110'], '1':['00100','01100','00100','00100','00100','00100','01110'],
  '2':['01110','10001','00001','00010','00100','01000','11111'], '3':['11110','00001','00001','01110','00001','00001','11110'],
  '4':['00010','00110','01010','10010','11111','00010','00010'], '5':['11111','10000','10000','11110','00001','00001','11110'],
  '6':['01110','10000','10000','11110','10001','10001','01110'], '7':['11111','00001','00010','00100','01000','01000','01000'],
  '8':['01110','10001','10001','01110','10001','10001','01110'], '9':['01110','10001','10001','01111','00001','00001','01110'],
  ' ':['00000','00000','00000','00000','00000','00000','00000'], '.':['00000','00000','00000','00000','00000','01100','01100'],
  ':':['00000','01100','01100','00000','01100','01100','00000'], '/':['00001','00010','00010','00100','01000','01000','10000'],
  '-':['00000','00000','00000','11111','00000','00000','00000'], '_':['00000','00000','00000','00000','00000','00000','11111'],
  '$':['00100','01111','10100','01110','00101','11110','00100'], '#':['01010','11111','01010','01010','11111','01010','01010'],
  '@':['01110','10001','10111','10101','10111','10000','01110'], '!':['00100','00100','00100','00100','00100','00000','00100'],
  '?':['01110','10001','00001','00010','00100','00000','00100'], '+':['00000','00100','00100','11111','00100','00100','00000'],
};

function setPixel(img, x, y, color) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const idx = (img.width * y + x) << 2;
  img.data[idx] = color[0]; img.data[idx+1] = color[1]; img.data[idx+2] = color[2]; img.data[idx+3] = color[3] ?? 255;
}
function rect(img, x, y, w, h, color) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setPixel(img, xx, yy, color);
}
function circle(img, cx, cy, r, color) {
  const rr = r*r;
  for (let y = cy-r; y <= cy+r; y++) for (let x = cx-r; x <= cx+r; x++) if ((x-cx)**2 + (y-cy)**2 <= rr) setPixel(img, x, y, color);
}
function progress(img, x, y, w, h, pct) {
  rect(img, x, y, w, h, [43,48,64,255]);
  const fill = Math.max(0, Math.min(w, Math.round(w * pct)));
  for (let xx = 0; xx < fill; xx++) {
    const t = xx / Math.max(1, w - 1);
    const col = [Math.round(88 + (87-88)*t), Math.round(101 + (242-101)*t), Math.round(242 + (135-242)*t), 255];
    rect(img, x + xx, y, 1, h, col);
  }
}
function text(img, x, y, value, scale = 3, color = [245,246,250,255]) {
  const str = String(value ?? '').toUpperCase().replace(/[^A-Z0-9 .:\/_\-\$#@!\?+]/g, '?');
  let cursor = x;
  for (const ch of str) {
    const glyph = FONT[ch] || FONT['?'];
    for (let gy = 0; gy < glyph.length; gy++) {
      for (let gx = 0; gx < glyph[gy].length; gx++) {
        if (glyph[gy][gx] === '1') rect(img, cursor + gx * scale, y + gy * scale, scale, scale, color);
      }
    }
    cursor += 6 * scale;
  }
}

function transliterate(value) {
  const map = { 'А':'A','Б':'B','В':'V','Г':'G','Д':'D','Е':'E','Ё':'E','Ж':'ZH','З':'Z','И':'I','Й':'Y','К':'K','Л':'L','М':'M','Н':'N','О':'O','П':'P','Р':'R','С':'S','Т':'T','У':'U','Ф':'F','Х':'H','Ц':'C','Ч':'CH','Ш':'SH','Щ':'SCH','Ъ':'','Ы':'Y','Ь':'','Э':'E','Ю':'YU','Я':'YA','а':'A','б':'B','в':'V','г':'G','д':'D','е':'E','ё':'E','ж':'ZH','з':'Z','и':'I','й':'Y','к':'K','л':'L','м':'M','н':'N','о':'O','п':'P','р':'R','с':'S','т':'T','у':'U','ф':'F','х':'H','ц':'C','ч':'CH','ш':'SH','щ':'SCH','ъ':'','ы':'Y','ь':'','э':'E','ю':'YU','я':'YA' };
  return String(value || '').split('').map(ch => map[ch] ?? ch).join('');
}
function safeName(name) {
  return transliterate(String(name || 'USER')).slice(0, 22);
}
function safeText(value, limit = 30) {
  return transliterate(String(value || '')).slice(0, limit);
}
function createProfileCardPng(user) {
  const width = 980, height = 430;
  const img = new PNG({ width, height });
  const profile = normalizeProfile(user.profileCustomization || {});
  const accent = getColor(profile.color);
  const bg = getBackground(profile.background);
  const bg0 = bg.colors[0];
  const bg1 = bg.colors[1];

  // layered background
  rect(img, 0, 0, width, height, [...bg0,255]);
  rect(img, 18, 18, width-36, height-36, [...bg1,255]);
  rect(img, 34, 34, width-68, height-68, [20,23,32,220]);
  rect(img, 34, 34, width-68, 8, [...accent.rgb,255]);
  rect(img, 34, height-42, width-68, 8, [87,242,135,255]);

  // avatar placeholder with ring
  circle(img, 132, 136, 78, [...accent.rgb,255]);
  circle(img, 132, 136, 58, [47,49,54,255]);
  circle(img, 110, 118, 11, [245,246,250,255]);
  circle(img, 154, 118, 11, [245,246,250,255]);
  rect(img, 102, 161, 62, 9, [245,246,250,255]);

  const req = getRequiredXp(user.level || 1);
  const xp = Number(user.xp || 0);
  const pct = Math.min(1, Math.max(0, xp / Math.max(1, req)));
  const achievements = Array.isArray(user.achievements) ? user.achievements.length : 0;
  const bpLevel = Math.floor(Number(user.seasonXp || 0) / 250) + 1;

  text(img, 240, 58, safeName(user.username), 5, [255,255,255,255]);
  text(img, 240, 110, safeText(profile.title || 'SERVER MEMBER', 30), 3, [174,180,194,255]);
  text(img, 240, 144, safeText(profile.about || 'ACTIVE COMMUNITY MEMBER', 46), 2, [174,180,194,255]);

  text(img, 240, 190, `LEVEL ${user.level || 1}`, 3, [255,255,255,255]);
  text(img, 430, 190, `XP ${xp}/${req}`, 3, [174,180,194,255]);
  progress(img, 240, 226, 620, 30, pct);

  // stat cards
  rect(img, 240, 282, 160, 54, [31,35,48,255]);
  rect(img, 420, 282, 160, 54, [31,35,48,255]);
  rect(img, 600, 282, 160, 54, [31,35,48,255]);
  rect(img, 780, 282, 120, 54, [31,35,48,255]);
  text(img, 255, 294, `COINS`, 2, [174,180,194,255]);
  text(img, 255, 316, String(user.coins || 0), 3, [255,255,255,255]);
  text(img, 435, 294, `REP`, 2, [174,180,194,255]);
  text(img, 435, 316, String(user.reputation || 0), 3, [255,255,255,255]);
  text(img, 615, 294, `BADGES`, 2, [174,180,194,255]);
  text(img, 615, 316, String(achievements), 3, [255,255,255,255]);
  text(img, 795, 294, `BP`, 2, [174,180,194,255]);
  text(img, 795, 316, String(bpLevel), 3, [255,255,255,255]);

  if (profile.showStats) text(img, 64, 252, `MESSAGES ${user.messages || 0}`, 2, [174,180,194,255]);
  if (profile.showBadges) text(img, 64, 280, `MAIN BADGE ${safeText(profile.mainBadge || 'NONE', 12)}`, 2, [174,180,194,255]);
  text(img, 64, 350, 'SERVERCORE PROFILE CARD', 2, [174,180,194,255]);
  text(img, 64, 376, 'XP  ECONOMY  REPUTATION  BATTLEPASS', 2, [174,180,194,255]);
  return PNG.sync.write(img);
}

module.exports = { createProfileCardPng };
