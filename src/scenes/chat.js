// Section 17 · 早期聊天窗口 · Early Chat Window
//
// An invented desktop around 2003, seen close: one interface pixel is one
// world unit. Everything is a 32-bit pixel buffer built on the CPU and shown
// through one small compositing shader that samples texel by texel, so every
// edge stays on its own one-unit grid and is drawn without smoothing:
//
//   desktop   fixed in the world (wallpaper, icons, taskbar), baked twice:
//             with the chat's task button pressed, and flashing orange
//   window    the chat window of 大嘴信使 2003, 500 x 316 units (340 in the
//             gallery still), laid out from the pelican's road point and
//             cached per state (typing notice and its dots, the shake line,
//             the typed ？, the caret)
//   GIF       220 x 158, inside the history: sky, hills and road quantised to
//             the 216-colour web palette with a 4 x 4 Bayer dither fixed to the
//             GIF's own pixels, and the pelican in flat colours. One picture
//             per tenth of a second (poseHz 10), cached by pose tick. Its
//             centre is the pelican's road point, so this GIF is the
//             section's pelican.
//
// Type: Chinese from the GB18030 Bitmap system font, which has true bitmaps
// at 12 and 16 px (thresholded, nothing smoothed). That font has no Latin or
// symbol bitmaps, so digits, letters, ╰ ☆ ╮ ？ 。 … and the title's Latin
// are hand-drawn glyphs below.
//
// Bar 2: the typing notice goes out at u = 2.0 and returns at 2.5; at 3.0 it
// goes out again, a grey system line appears under the GIF and the window
// shakes for half a second (offsets from a table, twenty a second) while the
// task button flashes; the notice returns at 3.5; at 4.0 a ？ is typed into
// the input box and stays there with the caret after it.

import { sectionMeta } from "./sections.js";
import { solveRig } from "../rig/rig.js";
import { drawPlain } from "../rig/skins/plain.js";
import { Layer2D } from "../kit/stage.js";
import { VERT, FRAG_HEAD } from "../kit/glsl.js";

const META = sectionMeta(17);
const HZ = 10;

// ---------------------------------------------------------------- times

const T_HUSH = 2.0; // notice out
const T_BACK1 = 2.5; // notice back
const T_SHAKE = 3.0; // notice out, shake line, shake, task button flashes
const T_SHAKE_END = 3.5; // shake over, notice back
const T_TYPE = 4.0; // ？ typed
const T_FLASH_END = 4.0; // the task button stops flashing when we type
const EPS = 1e-6;

const SHAKE_DX = [-6, 6, -5, 5, -4, 4, -3, 2, -2, 1];
const SHAKE_DY = [2, -2, -3, 3, 2, -2, 1, -1, 1, 0];

export function shakeAt(u) {
  if (u < T_SHAKE - EPS || u >= T_SHAKE_END - EPS) return [0, 0];
  const k = Math.min(9, Math.max(0, Math.floor((u - T_SHAKE) * 20 + EPS)));
  return [SHAKE_DX[k], SHAKE_DY[k]];
}

export function noticeOn(u) {
  if (u >= T_HUSH - EPS && u < T_BACK1 - EPS) return false;
  if (u >= T_SHAKE - EPS && u < T_SHAKE_END - EPS) return false;
  return true;
}

// ---------------------------------------------------------------- colour

function rgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function pack(r, g, b) {
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}
function col(hex) {
  const [r, g, b] = rgb(hex);
  return pack(r, g, b);
}

const C = {
  // window furniture: the invented kit's sage grey-green, not any system's
  face: col("#c9d3c5"),
  hilite: col("#f2f6ee"),
  light: col("#dce4d8"),
  shadow: col("#8fa08c"),
  dark: col("#3f4c3d"),
  white: col("#ffffff"),
  black: col("#000000"),
  ink: col("#141414"),
  blue: col("#16308c"),
  grey: col("#7d7a74"),
  sysgrey: col("#6e6c68"),
  notice: col("#2c4a52"),
  track: col("#b4c0b0"),
  orange: col("#f39a2b"),
  orangeLight: col("#ffc46a"),
  orangeDark: col("#a85a0c"),
  // title bar gradient: dark teal to sea green
  titleA: rgb("#0e4a55"),
  titleB: rgb("#47a487"),
  // desktop
  wall: col("#6b86a0"),
  wallFish: col("#7891aa"),
  wallDot: col("#738ea7"),
  labelShadow: col("#22303f"),
};

// ---------------------------------------------------------------- pixel buffer

class Buf {
  constructor(w, h, fill = 0) {
    this.w = w;
    this.h = h;
    this.d = new Uint32Array(w * h);
    if (fill) this.d.fill(fill);
  }
  put(x, y, c) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c;
  }
  get(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : 0;
  }
  rect(x, y, w, h, c) {
    const x0 = Math.max(0, x), y0 = Math.max(0, y);
    const x1 = Math.min(this.w, x + w), y1 = Math.min(this.h, y + h);
    for (let yy = y0; yy < y1; yy += 1) this.d.fill(c, yy * this.w + x0, yy * this.w + x1);
  }
  hl(x0, x1, y, c) {
    this.rect(x0, y, x1 - x0 + 1, 1, c);
  }
  vl(x, y0, y1, c) {
    this.rect(x, y0, 1, y1 - y0 + 1, c);
  }
  box(x, y, w, h, c) {
    this.hl(x, x + w - 1, y, c);
    this.hl(x, x + w - 1, y + h - 1, c);
    this.vl(x, y, y + h - 1, c);
    this.vl(x + w - 1, y, y + h - 1, c);
  }
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      this.put(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  /** Midpoint circle outline. */
  ring(cx, cy, r, c) {
    let x = r, y = 0, e = 1 - r;
    while (x >= y) {
      for (const [a, b] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) this.put(cx + a, cy + b, c);
      y += 1;
      if (e < 0) e += 2 * y + 1;
      else { x -= 1; e += 2 * (y - x) + 1; }
    }
  }
  disc(cx, cy, r, c) {
    for (let y = -r; y <= r; y += 1) for (let x = -r; x <= r; x += 1) if (x * x + y * y <= r * r + r * 0.8) this.put(cx + x, cy + y, c);
  }
  /** Stamp ascii art: map from character to colour, '.' and ' ' skipped. */
  art(x, y, rows, map) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i += 1) {
        const v = map[row[i]];
        if (v !== undefined) this.put(x + i, y + j, v);
      }
    });
  }
  blit(src, x, y) {
    for (let j = 0; j < src.h; j += 1) for (let i = 0; i < src.w; i += 1) {
      const v = src.d[j * src.w + i];
      if (v) this.put(x + i, y + j, v);
    }
  }
}

// The invented kit: every button is an octagon (corners cut on the diagonal)
// with a one-pixel dark outline, a one-pixel light edge on the upper-left half
// and a sage-shadow edge on the lower-right half.
function inOct(i, j, w, h, c, k) {
  return i >= k && j >= k && i < w - k && j < h - k &&
    i + j >= c + k && w - 1 - i + j >= c + k && i + (h - 1 - j) >= c + k && w - 1 - i + (h - 1 - j) >= c + k;
}
function octagon(b, x, y, w, h, o = {}) {
  const c = o.cut !== undefined ? o.cut : h >= 13 ? 3 : 2;
  const face = o.face !== undefined ? o.face : C.face;
  const lite = o.lite !== undefined ? o.lite : C.hilite;
  const shade = o.shade !== undefined ? o.shade : C.shadow;
  const line = o.line !== undefined ? o.line : C.dark;
  for (let j = 0; j < h; j += 1) {
    for (let i = 0; i < w; i += 1) {
      if (!inOct(i, j, w, h, c, 0)) continue;
      let v;
      if (!inOct(i, j, w, h, c, 1)) v = line;
      else if (!inOct(i, j, w, h, c, 2)) v = i + j < w - 1 - i + (h - 1 - j) ? lite : shade;
      else v = face;
      b.put(x + i, y + j, v);
    }
  }
}
function raised(b, x, y, w, h, face = C.face) {
  octagon(b, x, y, w, h, { face });
}
/** Pressed: the same octagon with its edges swapped. */
function pressed(b, x, y, w, h, face = C.light) {
  octagon(b, x, y, w, h, { face, lite: C.shadow, shade: C.hilite });
}
/** Panes and fields: a square well with a dark rim and a shadow inside it. */
function sunken(b, x, y, w, h, fill = C.white) {
  b.rect(x, y, w, h, fill);
  b.box(x, y, w, h, C.dark);
  b.hl(x + 1, x + w - 2, y + 1, C.shadow);
  b.vl(x + 1, y + 1, y + h - 2, C.shadow);
}
/** One-pixel sunken edge, for the status tray and the avatar. */
function thinSunken(b, x, y, w, h) {
  b.hl(x, x + w - 1, y, C.shadow);
  b.vl(x, y, y + h - 1, C.shadow);
  b.hl(x, x + w - 1, y + h - 1, C.hilite);
  b.vl(x + w - 1, y, y + h - 1, C.hilite);
}

// ---------------------------------------------------------------- bitmap type

// Body Latin: 12-px line, half-width cells of 6, capitals and digits 8 rows
// from row 2 of the line, x-height 6, descenders 2.
const G12 = {
  0: [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", "#...#", ".###."],
  1: ["..#..", ".##..", "#.#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  2: [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  3: [".###.", "#...#", "....#", "..##.", "....#", "....#", "#...#", ".###."],
  4: ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#.", "...#."],
  5: ["#####", "#....", "####.", "....#", "....#", "....#", "#...#", ".###."],
  6: ["..##.", ".#...", "#....", "####.", "#...#", "#...#", "#...#", ".###."],
  7: ["#####", "....#", "...#.", "...#.", "..#..", "..#..", "..#..", "..#.."],
  8: [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", "#...#", ".###."],
  9: [".###.", "#...#", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  ":": [".....", ".....", "..#..", ".....", ".....", "..#..", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".....", "..#..", "..#.."],
  S: [".###.", "#...#", "#....", ".###.", "....#", "....#", "#...#", ".###."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#....", "#...#", ".###."],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#....", "#...."],
  // Q: a bowl one row short of the capitals and a two-pixel tail on the
  // baseline, out to the right, with a clear row above the underline
  Q: [".###..", "#...#.", "#...#.", "#...#.", "#...#.", "#...#.", ".####.", "....##"],
  t: [".....", ".#...", ".#...", "####.", ".#...", ".#...", ".#...", "..##."],
  x: [".....", ".....", "#...#", ".#.#.", "..#..", "..#..", ".#.#.", "#...#"],
  b: ["#....", "#....", "####.", "#...#", "#...#", "#...#", "#...#", "####."],
  m: [".....", ".....", "####.", "#.#.#", "#.#.#", "#.#.#", "#.#.#", "#.#.#"],
  p: [".....", ".....", "####.", "#...#", "#...#", "#...#", "#...#", "####.", "#....", "#...."],
  "-": [".....", ".....", ".....", ".....", "####.", ".....", ".....", "....."],
  "(": ["...#.", "..#..", ".#...", ".#...", ".#...", ".#...", ".#...", ".#...", "..#..", "...#."],
  ")": [".#...", "..#..", "...#.", "...#.", "...#.", "...#.", "...#.", "...#.", "..#..", ".#..."],
};
const G12_TOP = { "(": 1, ")": 1 };
// Full-width symbols, 12 x 12 on the line box.
const W12 = {
  // full width: the mark centred in its 12-unit cell, as wide as a character
  "？": ["............", "...######...", "..##....##..", "..##....##..", "........##..", "......###...", ".....##.....", ".....##.....", "............", ".....##.....", ".....##.....", "............"],
  // the star is traced from its ten corners (see starRows)
  "☆": null,
  "╰": [".....#......", ".....#......", ".....#......", ".....#......", ".....#......", ".....#......", "......#.....", ".......#####", "............", "............", "............", "............"],
  "╮": ["............", "............", "............", "............", "............", "............", "............", "#####.......", ".....#......", "......#.....", "......#.....", "......#....."],
  "。": ["............", "............", "............", "............", "............", "............", "............", "............", ".##.........", "#..#........", "#..#........", ".##........."],
  "…": ["............", "............", "............", "............", "............", "............", "............", "............", "............", ".#...#...#..", "............", "............"],
};

/** An outline star on the 12-px grid, from its ten corners, one-pixel lines. */
function starRows() {
  const g = Array.from({ length: 12 }, () => Array(12).fill("."));
  const P = [[5, 0], [6, 4], [10, 4], [7, 7], [9, 11], [5, 9], [1, 11], [3, 7], [0, 4], [4, 4]];
  for (let i = 0; i < P.length; i += 1) {
    let [x0, y0] = P[i];
    const [x1, y1] = P[(i + 1) % P.length];
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      g[y0][x0] = "#";
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  return g.map((r) => r.join(""));
}
W12["☆"] = starRows();

// Title Latin: 15-px line (the 16-px Chinese bitmaps are 15 rows), capitals and
// digits 10 rows from row 4, x-height 7, descenders 3. Proportional.
const G16 = {
  E: ["#####", "#....", "#....", "#....", "####.", "#....", "#....", "#....", "#....", "#####"],
  a: [".###.", "....#", "....#", ".####", "#...#", "#..##", ".##.#"],
  r: ["#.##", "##..", "#...", "#...", "#...", "#...", "#..."],
  l: ["#", "#", "#", "#", "#", "#", "#", "#", "#", "#"],
  y: ["#...#", "#...#", "#...#", "#...#", "#...#", "#..##", ".##.#", "....#", "#...#", ".###."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#....", "#....", "#....", "#...#", ".###."],
  h: ["#....", "#....", "#....", "#.##.", "##..#", "#...#", "#...#", "#...#", "#...#", "#...#"],
  t: ["....", ".#..", ".#..", "####", ".#..", ".#..", ".#..", ".#..", ".#..", "..##"],
  W: ["#.....#", "#.....#", "#.....#", "#.....#", "#..#..#", "#..#..#", "#..#..#", "#..#..#", "#.#.#.#", ".#...#."],
  i: ["#", ".", ".", "#", "#", "#", "#", "#", "#", "#"],
  n: ["#.##.", "##..#", "#...#", "#...#", "#...#", "#...#", "#...#"],
  d: ["....#", "....#", "....#", ".##.#", "#..##", "#...#", "#...#", "#...#", "#..##", ".##.#"],
  o: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  w: ["#.....#", "#.....#", "#..#..#", "#..#..#", "#..#..#", "#.#.#.#", ".#...#."],
  s: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  0: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  1: [".#.", "##.", ".#.", ".#.", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
  2: [".###.", "#...#", "....#", "....#", "...#.", "..#..", ".#...", "#....", "#....", "#####"],
  "-": ["####"],
  "·": ["##", "##"],
  "(": ["..#", ".#.", ".#.", "#..", "#..", "#..", "#..", "#..", "#..", "#..", ".#.", ".#.", "..#"],
  ")": ["#..", ".#.", ".#.", "..#", "..#", "..#", "..#", "..#", "..#", "..#", ".#.", ".#.", "#.."],
};
const G16_TOP = { a: 7, r: 7, y: 7, n: 7, o: 7, w: 7, s: 7, "-": 9, "·": 8, "(": 3, ")": 3 };
const CAP16 = 4;

// Chinese bitmaps from the system font, thresholded once per glyph.
const HZ_FONT = "GB18030 Bitmap";
const HZ_MASKS = new Map();
let HZ_SCRATCH = null;

function hzMask(p, ch, size) {
  const key = `${size}:${ch}`;
  let m = HZ_MASKS.get(key);
  if (m) return m;
  if (!HZ_SCRATCH) HZ_SCRATCH = new Layer2D(p, 48, 48);
  const ctx = HZ_SCRATCH.clear();
  ctx.font = `${size}px '${HZ_FONT}', monospace`;
  ctx.textBaseline = "top";
  ctx.fillStyle = "#000";
  // the bitmaps start three rows above the 'top' baseline
  ctx.fillText(ch, 4, 4 + 3);
  const rows = size === 16 ? 16 : 12;
  const img = ctx.getImageData(4, 4, size, rows).data;
  const bits = new Uint8Array(size * rows);
  for (let i = 0; i < size * rows; i += 1) bits[i] = img[i * 4 + 3] > 127 ? 1 : 0;
  m = { w: size, h: rows, bits };
  HZ_MASKS.set(key, m);
  return m;
}

function stampRows(b, rows, x, y, c) {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i += 1) if (row[i] === "#") b.put(x + i, y + j, c);
  });
}

const isHan = (ch) => /[㐀-鿿]/.test(ch);

/** 12-px line of text with its top at y. Returns the x after it. */
function text12(p, b, str, x, y, c) {
  for (const ch of str) {
    if (ch === " ") { x += 6; continue; }
    if (W12[ch]) { stampRows(b, W12[ch], x, y, c); x += 12; continue; }
    if (G12[ch]) { stampRows(b, G12[ch], x, y + 2 - (G12_TOP[ch] ? 1 : 0), c); x += 6; continue; }
    if (isHan(ch)) {
      const m = hzMask(p, ch, 12);
      for (let j = 0; j < m.h; j += 1) for (let i = 0; i < m.w; i += 1) if (m.bits[j * m.w + i]) b.put(x + i, y + j, c);
      x += 12;
      continue;
    }
    x += 6;
  }
  return x;
}
function width12(str) {
  let w = 0;
  for (const ch of str) w += W12[ch] || isHan(ch) ? 12 : 6;
  return w;
}

/** Title line: 16-px Chinese bitmaps (15 rows) and the hand-drawn Latin. */
function text16(p, b, str, x, y, c) {
  for (const ch of str) {
    if (ch === " ") { x += 4; continue; }
    if (G16[ch]) {
      const g = G16[ch];
      const top = G16_TOP[ch] !== undefined ? G16_TOP[ch] : CAP16;
      stampRows(b, g, x, y + top, c);
      x += g[0].length + 1;
      continue;
    }
    if (isHan(ch)) {
      const m = hzMask(p, ch, 16);
      for (let j = 0; j < m.h; j += 1) for (let i = 0; i < m.w; i += 1) if (m.bits[j * m.w + i]) b.put(x + i, y + j, c);
      x += 16;
      continue;
    }
    x += 5;
  }
  return x;
}
function width16(str) {
  let w = 0;
  for (const ch of str) {
    if (ch === " ") w += 4;
    else if (G16[ch]) w += G16[ch][0].length + 1;
    else if (isHan(ch)) w += 16;
    else w += 5;
  }
  return w;
}

// ---------------------------------------------------------------- small pictures

/** The program's icon: a pale sea-green speech bubble with two lines of
 *  "text" in it, whose mouth is a pelican's bill and pouch. No eye: it is a
 *  bubble that talks, not a creature. 16 x 16. */
const ICON16 = [
  "................",
  "................",
  ".KKKKKKKKK......",
  "KAAAAAAAAAK.....",
  "KATTTTTTAAK.....",
  "KAAAAAAAAAKKKKK.",
  "KATTTTTAAAKOOOOK",
  "KAAAAAAAAAKYYYKK",
  "KSAAAAAAASKYYK..",
  ".KSSSSSSSKKKK...",
  "..KSKKKKKK......",
  "..KSK...........",
  ".KSK............",
  ".KK.............",
  "................",
  "................",
];
const ICON_MAP = { K: col("#12393c"), A: col("#e4f6ef"), T: col("#4a9b8c"), S: col("#9fd3c2"), O: col("#f2861d"), Y: col("#ffc04d") };

/** A small fish, used on the menu button and in the tray. 11 x 7. */
const FISH11 = [
  "...KKKK...K",
  "..KBBBBK.KK",
  ".KBWBBBBKBK",
  "KBBBBBBBBBK",
  ".KBBBBBBKBK",
  "..KBBBBK.KK",
  "...KKKK...K",
];
const FISH_MAP = { K: col("#1d3a4a"), B: col("#3f8fb0"), W: col("#ffffff") };

/** Wallpaper fish, 10 x 5, one tone lighter than the wall. */
const WALL_FISH = [
  "..####...#",
  ".######.##",
  "#.#######.",
  ".######.##",
  "..####...#",
];

function drawAvatar(b, x, y) {
  // 16 x 16 with a one-pixel sunken edge: a small bicycle under a sun, on pink
  thinSunken(b, x, y, 16, 16);
  const ix = x + 1, iy = y + 1;
  const pinkA = col("#f7d3dc"), pinkB = col("#f0b3c4"), sun = col("#ffd34d"), grass = col("#86c06c"), k = col("#3b2433");
  b.rect(ix, iy, 14, 14, pinkB);
  b.rect(ix, iy, 14, 4, pinkA);
  b.disc(ix + 11, iy + 3, 2, sun);
  b.rect(ix, iy + 12, 14, 2, grass);
  // wheels
  b.ring(ix + 3, iy + 9, 2, k);
  b.ring(ix + 10, iy + 9, 2, k);
  // frame, saddle, bars
  b.line(ix + 3, iy + 9, ix + 6, iy + 9, k);
  b.line(ix + 6, iy + 9, ix + 5, iy + 6, k);
  b.line(ix + 5, iy + 6, ix + 9, iy + 6, k);
  b.line(ix + 9, iy + 6, ix + 10, iy + 9, k);
  b.line(ix + 3, iy + 9, ix + 5, iy + 6, k);
  b.hl(ix + 4, ix + 6, iy + 5, k);
  b.line(ix + 9, iy + 6, ix + 9, iy + 4, k);
  b.put(ix + 10, iy + 4, k);
}

// Flat 16 x 16 toolbar glyphs for the status strip, the kit's own drawings:
// a quill, a fish, a small picture, a paper boat.
const TOOL_QUILL = [
  ".............KK.",
  "...........KKWK.",
  "..........KWWWK.",
  ".........KWWWGK.",
  "........KWWWGWK.",
  ".......KWWWGWK..",
  "......KWWWGWWK..",
  ".....KWWWGWWK...",
  ".....KWWGWWK....",
  "....KWWGWKK.....",
  "....KWGKK.......",
  "...KGKK.........",
  "...KK...........",
  "..K.............",
  ".KB.............",
  ".BBB............",
];
const QUILL_MAP = { K: col("#2c3a3a"), W: col("#f6f3e6"), G: col("#9aa89a"), B: col("#1c3c8c") };
const TOOL_FISH = [
  "................",
  "................",
  "................",
  "......KKKK......",
  "....KKOOOOKK..KK",
  "...KOOOOOOOOKKOK",
  "..KOWKOOOOOOOOOK",
  ".KOOKKOOOOOOOOK.",
  "KOOOOOOOOOOOOOK.",
  ".KOOOOOOYYOOOOOK",
  "..KYYOOYYYYKKYYK",
  "...KYYYYYYK..KYK",
  "....KKKKKK....KK",
  "................",
  "................",
  "................",
];
const FISHT_MAP = { K: col("#5a2a0a"), O: col("#f08a24"), Y: col("#ffc860"), W: C.white };
const TOOL_BOAT = [
  "................",
  "................",
  "................",
  "................",
  "......K.........",
  ".....KWK........",
  "....KWWSK.......",
  "...KWWWSSK......",
  "..KWWWWSSSK.....",
  "KKKKKKKKKKKKKKKK",
  ".KWWWWWWWWWWWWK.",
  "..KSWWWWWWWWSK..",
  "...KKKKKKKKKK...",
  "................",
  ".BB...BB...BB...",
  "B..BBB..BBB..BB.",
];
const BOAT_MAP = { K: col("#2c3a4a"), W: C.white, S: col("#c4d2e0"), B: col("#3a7ab8") };
function toolQuill(b, x, y) { b.art(x, y, TOOL_QUILL, QUILL_MAP); }
function toolFish(b, x, y) { b.art(x, y, TOOL_FISH, FISHT_MAP); }
function toolPicture(b, x, y) {
  const k = col("#30353b");
  b.rect(x + 1, y + 2, 14, 12, col("#9cc4ec"));
  b.box(x + 1, y + 2, 14, 12, k);
  b.disc(x + 10, y + 5, 1, col("#ffe066"));
  for (let i = 0; i < 6; i += 1) b.hl(x + 2 + 3 - Math.min(3, i), x + 7 + Math.min(3, i), y + 7 + i, col("#4f9a4a"));
  b.hl(x + 2, x + 13, y + 12, col("#4f9a4a"));
}
function toolBoat(b, x, y) { b.art(x, y, TOOL_BOAT, BOAT_MAP); }
/** The pencil that writes beside the typing notice. 11 x 11. */
const PENCIL = [
  ".........KK",
  "........KPK",
  ".......KOK.",
  "......KOK..",
  ".....KOK...",
  "....KOK....",
  "...KOK.....",
  "..KOK......",
  ".KWK.......",
  ".KK........",
  "K..........",
];
const PENCIL_MAP = { K: col("#2c2924"), O: col("#e8a62a"), P: col("#e07890"), W: col("#efd9b0") };

/** Pencil offsets per quarter second while the other person types. */
const PEN_JIG = [[0, 0], [-2, 1], [1, -1], [-1, 1]];

/** The shake button's glyph: a little window between rattle marks. */
function drawShakeGlyph(b, x, y) {
  const k = C.dark, t = col("#1d6c6a");
  b.box(x + 5, y, 11, 9, k);
  b.rect(x + 6, y + 1, 9, 2, t);
  b.rect(x + 6, y + 3, 9, 5, C.white);
  // rattle marks either side
  b.put(x + 2, y + 1, k); b.put(x + 1, y + 2, k); b.put(x + 2, y + 3, k); b.put(x + 1, y + 4, k); b.put(x + 2, y + 5, k); b.put(x + 1, y + 6, k); b.put(x + 2, y + 7, k);
  b.put(x + 18, y + 1, k); b.put(x + 19, y + 2, k); b.put(x + 18, y + 3, k); b.put(x + 19, y + 4, k); b.put(x + 18, y + 5, k); b.put(x + 19, y + 6, k); b.put(x + 18, y + 7, k);
}

// ---------------------------------------------------------------- the window

/** The pointer, dragging. 11 x 15. */
const CURSOR = [
  "K..........",
  "KK.........",
  "KWK........",
  "KWWK.......",
  "KWWWK......",
  "KWWWWK.....",
  "KWWWWWK....",
  "KWWWWWWK...",
  "KWWWWWWWK..",
  "KWWWWKKKKK.",
  "KWWKWK.....",
  "KWK.KWK....",
  "KK..KWK....",
  "K....KWK...",
  ".....KK....",
];

const WIN_H = 316;
const WIN_Y = 444;
const GIF_W = 220;
const GIF_H = 158;
const GIF_Y = 550;

function layoutFor(still) {
  const W = still ? 340 : 500;
  return {
    W,
    still,
    left: -W / 2, // window x relative to the pelican
    gifX: -110 - -W / 2, // GIF left, window-local
    noticeX: -110 - -W / 2,
    cursorX: still ? 252 : 404, // on the title bar, between the title and the buttons
  };
}

/** The window's fixed furniture, at one pixel per unit. */
function buildWindowBase(p, L) {
  const { W } = L;
  const b = new Buf(W, WIN_H);
  // outer frame: the kit's octagon, its corners cut away to the desktop
  octagon(b, 0, 0, W, WIN_H, { cut: 4 });

  // title bar: rows 3..21, a horizontal gradient stepped every 4 columns,
  // its top corners cut on the same diagonal as the frame
  const tx0 = 3, tx1 = W - 4;
  for (let x = tx0; x <= tx1; x += 1) {
    const s = Math.floor((x - tx0) / 4) * 4 / (tx1 - tx0);
    const c = pack(...C.titleA.map((a, i) => Math.round(a + (C.titleB[i] - a) * s)));
    const cut = Math.max(0, 2 - Math.min(x - tx0, tx1 - x));
    b.vl(x, 3 + cut, 21, c);
  }
  b.art(5, 4, ICON16, ICON_MAP);
  // the three caption buttons, octagons, with the kit's own glyphs:
  // a low tray (put away), a small diamond (fill the screen), a fish (close)
  const by = 5, bw = 16, bh = 14;
  const close = W - 6 - bw, max = close - 2 - bw, min = max - bw;
  for (const x of [min, max, close]) raised(b, x, by, bw, bh);
  const gk = { "#": C.ink };
  b.art(min + 4, by + 7, ["#......#", "#......#", "########", ".######."], gk);
  b.art(max + 5, by + 3, ["...#...", "..###..", ".#####.", "#######", ".#####.", "..###..", "...#..."], gk);
  // a small fish seen from the side, facing left: body, eye, forked tail
  b.art(close + 5, by + 3, ["......#", "..##.##", ".#.##.#", "######.", ".####.#", "..##.##", "......#"], gk);

  // title text
  const title = `${META.zh} - ${META.en}`;
  const date = `(${META.date} · ${META.dateEn})`;
  const titleY = 5;
  if (!L.still) {
    text16(p, b, `${title} ${date}`, 24, titleY, C.white);
  } else {
    text16(p, b, title, 24, titleY, C.white);
  }

  // status strip, rows 22..40: avatar, nickname, (in the still) the date
  drawAvatar(b, 6, 23);
  if (!L.still) {
    text12(p, b, "╰☆骑着单车去…", 26, 25, C.ink);
    // a flat toolbar at the right of the strip: type, faces, picture, file
    const tb = W - 6 - 4 * 19;
    toolQuill(b, tb, 23);
    toolFish(b, tb + 19, 23);
    toolPicture(b, tb + 38, 23);
    toolBoat(b, tb + 57, 23);
    b.vl(tb - 5, 24, 38, C.shadow);
    b.vl(tb - 4, 24, 38, C.hilite);
  } else {
    text16(p, b, date, W - 6 - width16(date), 24, C.ink);
  }

  // history, rows 42..280
  const hx = 4, hy = 42, hw = W - 8, hh = 239;
  sunken(b, hx, hy, hw, hh, C.white);
  // a scrollbar that never moves: at the end of the conversation
  const sx = hx + hw - 2 - 16, sy0 = hy + 2, sy1 = hy + hh - 3;
  // a plain track: one flat tone a step below the face, shadowed along its
  // left edge and its top edge (just under the up button)
  b.rect(sx, sy0, 16, sy1 - sy0 + 1, C.track);
  b.vl(sx, sy0, sy1, C.shadow);
  b.hl(sx, sx + 15, sy0 + 16, C.shadow);
  raised(b, sx, sy0, 16, 16);
  raised(b, sx, sy1 - 15, 16, 16);
  raised(b, sx, sy1 - 15 - 40, 16, 40);
  // open chevrons, not filled arrows
  const up = ["...##...", "..####..", ".##..##.", "##....##"];
  b.art(sx + 4, sy0 + 6, up, gk);
  b.art(sx + 4, sy1 - 15 + 6, up.slice().reverse(), gk);
  // three dots on the thumb
  for (let i = 0; i < 3; i += 1) b.rect(sx + 7, sy1 - 15 - 20 - 6 + i * 5, 2, 2, C.dark);

  // the four lines above the GIF
  const tx = hx + 6;
  const nick = "╰☆骑着单车去流浪☆╮";
  text12(p, b, `${nick} 21:07:02`, tx, 46, C.blue);
  text12(p, b, "在吗", tx + 12, 60, C.ink);
  text12(p, b, `${nick} 21:07:15`, tx, 76, C.blue);
  text12(p, b, "给你看个东西", tx + 12, 90, C.ink);

  // input band, rows 284..312
  const btnY = 287, btnH = 23;
  let inputW, shakeX, closeX, sendX, closeW, sendW;
  if (!L.still) {
    inputW = 316; shakeX = 324; closeX = 352; closeW = 66; sendX = 422; sendW = W - 5 - 422;
  } else {
    inputW = 168; shakeX = 176; closeX = 204; closeW = 60; sendX = 268; sendW = W - 5 - 268;
  }
  sunken(b, 4, 284, inputW, 29, C.white);
  raised(b, shakeX, btnY, 24, btnH);
  drawShakeGlyph(b, shakeX + 2, btnY + 7);
  for (const [x, w, label, acc] of [[closeX, closeW, "收起(Q)", "Q"], [sendX, sendW, "发出(F)", "F"]]) {
    // the default button wears a second outline
    if (label.startsWith("发出")) octagon(b, x - 1, btnY - 1, w + 2, btnH + 2, { cut: 4, face: C.dark, lite: C.dark, shade: C.dark });
    raised(b, x, btnY, w, btnH);
    const lw = width12(label);
    const lx = x + Math.floor((w - lw) / 2);
    const end = text12(p, b, label, lx, btnY + 5, C.ink);
    // accelerator underline under the letter
    b.hl(end - 12 + 1, end - 12 + 4, btnY + 5 + 11, C.ink);
    void acc;
  }
  return { buf: b, inputX: 4, inputW };
}

/** The window in one state, from the cached base. */
function buildWindowState(p, base, L, st) {
  const b = new Buf(base.buf.w, base.buf.h);
  b.d.set(base.buf.d);
  if (st.notice) {
    const x = L.noticeX;
    // the pencil scribbles: a two- or three-pixel jig, four times a second
    const [jx, jy] = PEN_JIG[st.pen];
    b.art(x - 15 + jx, 25 + jy, PENCIL, PENCIL_MAP);
    const end = text12(p, b, "对方正在输入", x, 25, C.ink);
    for (let i = 0; i < st.dots; i += 1) b.rect(end + 2 + i * 4, 25 + 9, 2, 2, C.ink);
  }
  if (st.line) text12(p, b, "对方晃了晃您的窗口。", L.gifX, 266, C.sysgrey);
  // input text and caret
  let cx = base.inputX + 5;
  if (st.q) cx = text12(p, b, "？", cx, 291, C.ink); // the caret after the full-width cell
  if (st.caret) b.vl(cx, 290, 303, C.ink);
  return b;
}

// ---------------------------------------------------------------- the desktop

const DESK_X0 = -64;
const DESK_Y0 = 416;
const DESK_W = 1128;
const DESK_H = 384;
const TASK_Y = 762; // taskbar top, world
const CHAT_BTN = [430, 590];

function iconPage(b, x, y) {
  const k = col("#30353b"), paper = C.white, rule = col("#a9c2d6"), fold = col("#d9d6cf"), fish = col("#2f7fb0");
  // page with a folded corner
  b.rect(x + 6, y + 1, 20, 30, paper);
  b.box(x + 6, y + 1, 20, 30, k);
  // the folded corner: cut away above the diagonal, the fold below it
  for (let i = 0; i < 7; i += 1) b.hl(x + 20 + i, x + 25, y + 1 + i, 0);
  for (let i = 1; i < 6; i += 1) b.hl(x + 21, x + 20 + i, y + 1 + i, fold);
  b.line(x + 20, y + 1, x + 25, y + 6, k);
  b.vl(x + 20, y + 1, y + 7, k);
  b.hl(x + 20, x + 25, y + 7, k);
  // ruled lines
  for (let r = 0; r < 4; r += 1) b.hl(x + 9, x + 18, y + 6 + r * 4, rule);
  for (let r = 0; r < 2; r += 1) b.hl(x + 9, x + 23, y + 22 + r * 4, rule);
  // a fish drawn in the text
  b.art(x + 10, y + 17, ["..###...#", ".#####.##", "#.#####.#", ".#####.##", "..###...#"].map((s) => s), { "#": fish });
  // shadow
  b.vl(x + 26, y + 3, y + 31, col("#4b6278"));
  b.hl(x + 8, x + 26, y + 31, col("#4b6278"));
}

function iconFolder(b, x, y) {
  const k = col("#5b3d0f"), back = col("#d39b34"), front = col("#f1c45c"), lite = col("#fbe39a"), paper = C.white;
  // back panel with tab
  b.rect(x + 2, y + 6, 12, 4, back);
  b.box(x + 2, y + 5, 12, 5, k);
  b.rect(x + 2, y + 9, 28, 19, back);
  b.box(x + 2, y + 9, 28, 19, k);
  // a sheet of paper inside
  b.rect(x + 6, y + 7, 20, 8, paper);
  b.box(x + 6, y + 7, 20, 8, col("#8a8a8a"));
  // front flap, slanted
  for (let r = 0; r < 15; r += 1) {
    const yy = y + 13 + r;
    const x0 = x + 1 + Math.max(0, 3 - Math.floor(r / 2));
    b.hl(x0, x + 29 - Math.max(0, 1 - r), yy, front);
    b.put(x0, yy, k);
    b.put(x + 30, yy, k);
  }
  b.hl(x + 4, x + 30, y + 12, k);
  b.hl(x + 1, x + 30, y + 28, k);
  b.hl(x + 5, x + 28, y + 13, lite);
  // shadow
  b.hl(x + 3, x + 31, y + 29, col("#4b6278"));
  b.vl(x + 31, y + 13, y + 29, col("#4b6278"));
}

function iconPicture(b, x, y) {
  const k = col("#262a30"), frame = col("#8f6a3a"), frameL = col("#c79b5d");
  b.rect(x + 1, y + 4, 30, 24, frame);
  b.box(x + 1, y + 4, 30, 24, k);
  b.hl(x + 2, x + 29, y + 5, frameL);
  b.vl(x + 2, y + 5, y + 26, frameL);
  // picture: sky bands, ground, a bicycle
  const sky = [col("#5b8fd8"), col("#7fa9e3"), col("#a5c4ec"), col("#c8dcf3")];
  for (let r = 0; r < 12; r += 1) b.hl(x + 4, x + 27, y + 7 + r, sky[Math.min(3, Math.floor(r / 3))]);
  for (let r = 0; r < 12; r += 1) for (let c = 0; c < 24; c += 1) if (r % 3 === 2 && (c + r) % 2 === 0 && r < 11) b.put(x + 4 + c, y + 7 + r, sky[Math.min(3, Math.floor(r / 3) + 1)]);
  b.rect(x + 4, y + 19, 24, 6, col("#6ab04c"));
  b.hl(x + 4, x + 27, y + 19, col("#8cc96a"));
  const bk = col("#1a1a1a");
  b.ring(x + 10, y + 19, 3, bk);
  b.ring(x + 21, y + 19, 3, bk);
  b.line(x + 10, y + 19, x + 15, y + 19, bk);
  b.line(x + 15, y + 19, x + 13, y + 14, bk);
  b.line(x + 13, y + 14, x + 19, y + 14, bk);
  b.line(x + 19, y + 14, x + 21, y + 19, bk);
  b.line(x + 10, y + 19, x + 13, y + 14, bk);
  b.hl(x + 12, x + 14, y + 13, bk);
  b.line(x + 19, y + 14, x + 19, y + 12, bk);
  b.hl(x + 18, x + 20, y + 11, bk);
  b.vl(x + 31, y + 6, y + 28, col("#4b6278"));
  b.hl(x + 3, x + 31, y + 28, col("#4b6278"));
}

function iconBasket(b, x, y) {
  const k = col("#4a2f12"), weave = col("#c99556"), weaveD = col("#9c6b33"), rim = col("#7b5225"), paper = col("#f4f2ec"), crease = col("#a8a59c");
  // crumpled paper above the rim
  b.disc(x + 13, y + 9, 5, paper);
  b.disc(x + 20, y + 10, 4, paper);
  b.ring(x + 13, y + 9, 5, crease);
  b.ring(x + 20, y + 10, 4, crease);
  b.line(x + 11, y + 7, x + 14, y + 10, crease);
  b.line(x + 19, y + 9, x + 21, y + 12, crease);
  // basket: a trapezoid of woven strips
  for (let r = 0; r < 17; r += 1) {
    const yy = y + 13 + r;
    const inset = Math.floor(r / 4);
    const x0 = x + 4 + inset, x1 = x + 27 - inset;
    for (let xx = x0; xx <= x1; xx += 1) {
      const band = Math.floor(r / 3) % 2;
      const cell = Math.floor((xx - x) / 3) % 2;
      b.put(xx, yy, band === cell ? weave : weaveD);
    }
    b.put(x0, yy, k);
    b.put(x1, yy, k);
  }
  b.rect(x + 3, y + 12, 26, 3, rim);
  b.box(x + 3, y + 12, 26, 3, k);
  b.hl(x + 8, x + 23, y + 29, k);
  b.hl(x + 9, x + 25, y + 30, col("#4b6278"));
}

function iconMessenger(b, x, y) {
  // the program's icon at twice the size: drawn again, not scaled
  const m = ICON_MAP;
  const k = m.K, a = m.A, s = m.S, t = m.T, o = m.O, yl = m.Y, pd = col("#e8a030");
  // a rounded speech bubble, x 2..21, y 4..22, corner radius 5
  const inside = (xx, yy) => {
    if (xx < 2 || xx > 21 || yy < 4 || yy > 22) return false;
    const cx = Math.min(Math.max(xx, 7), 16), cy = Math.min(Math.max(yy, 9), 17);
    return (xx - cx) ** 2 + (yy - cy) ** 2 <= 25.5;
  };
  for (let yy = 0; yy < 34; yy += 1) for (let xx = 0; xx < 34; xx += 1) {
    if (inside(xx, yy)) b.put(x + xx, y + yy, yy >= 20 || (xx >= 20 && yy >= 9) ? s : a);
    else if (inside(xx - 1, yy) || inside(xx + 1, yy) || inside(xx, yy - 1) || inside(xx, yy + 1)) b.put(x + xx, y + yy, k);
  }
  // three lines of "words"
  for (const [y0, segs] of [[9, [[6, 9], [11, 17]]], [13, [[6, 12], [14, 16]]], [17, [[6, 8], [10, 13]]]]) {
    for (const [a0, a1] of segs) b.rect(x + a0, y + y0, a1 - a0 + 1, 2, t);
  }
  // tail, down to the left
  for (const [tx, ty, row] of [[4, 23, "KSSSK"], [3, 24, "KSSK"], [3, 25, "KSK"], [2, 26, "KSK"], [2, 27, "KK"], [1, 28, "K"]]) {
    b.art(x + tx, y + ty, [row], { K: k, S: s });
  }
  // the bill: upper mandible, then the pouch hanging under it
  b.hl(x + 23, x + 30, y + 10, k);
  b.hl(x + 23, x + 30, y + 11, o); b.put(x + 31, y + 11, k);
  b.hl(x + 23, x + 31, y + 12, o); b.put(x + 32, y + 12, k);
  b.hl(x + 23, x + 31, y + 13, k); b.put(x + 32, y + 13, k);
  const pouch = [8, 8, 7, 6, 4, 2];
  pouch.forEach((len, r) => {
    b.hl(x + 23, x + 22 + len, y + 14 + r, r >= 4 ? pd : yl);
    b.put(x + 23 + len, y + 14 + r, k);
    if (r > 0) b.hl(x + 23 + len, x + 22 + pouch[r - 1], y + 14 + r, k);
  });
  b.hl(x + 23, x + 25, y + 20, k);
}

function label(p, b, str, cx, y) {
  str.split("\n").forEach((line, i) => {
    const w = width12(line);
    const x = Math.round(cx - w / 2);
    text12(p, b, line, x + 1, y + 1 + i * 13, C.labelShadow);
    text12(p, b, line, x, y + i * 13, C.white);
  });
}

function buildDesk(p, flash) {
  const b = new Buf(DESK_W, DESK_H, C.wall);
  const X = (wx) => wx - DESK_X0;
  const Y = (wy) => wy - DESK_Y0;
  // wallpaper: small fish in a staggered tile, one tone apart
  const TW = 40, TH = 28;
  for (let ty = -1; ty * TH < DESK_H; ty += 1) {
    for (let tx = -1; tx * TW < DESK_W + TW; tx += 1) {
      const ox = tx * TW + (ty % 2 === 0 ? 0 : 20) + 64 % TW;
      const oy = ty * TH + 6;
      stampRows(b, WALL_FISH, ox + 6, oy + 4, C.wallFish);
      // a few bubbles
      b.put(ox + 2, oy + 2, C.wallDot);
      b.put(ox + 3, oy, C.wallDot);
      // a wave mark
      for (const [dx, dy] of [[24, 18], [25, 17], [26, 17], [27, 18], [28, 18], [29, 17]]) b.put(ox + dx, oy + dy, C.wallDot);
    }
  }
  // icons: a column near each end of the painting
  const icons = [
    [iconPage, "鱼.txt", 58, 462],
    [iconFolder, "杂物 (3)", 58, 526],
    [iconMessenger, "大嘴信使", 58, 602],
    [iconPicture, "自行车.bmp", 940, 470],
    [iconBasket, "垃圾桶", 940, 548],
  ];
  for (const [fn, name, cx, top] of icons) {
    const ib = new Buf(34, 34);
    fn(ib, 0, 0);
    b.blit(ib, X(cx - 16), Y(top));
    label(p, b, name, X(cx), Y(top + 35));
  }

  // taskbar from y 762
  const ty0 = Y(TASK_Y);
  b.rect(0, ty0, DESK_W, DESK_H - ty0, C.face);
  b.hl(0, DESK_W - 1, ty0, C.light);
  b.hl(0, DESK_W - 1, ty0 + 1, C.hilite);
  const by = Y(764), bh = 15;
  // menu button with a fish
  const mx = X(22);
  raised(b, mx, by, 62, bh);
  b.art(mx + 4, by + 4, FISH11, FISH_MAP);
  text12(p, b, "菜单", mx + 20, by + 2, C.ink);
  // separator grooves
  for (const sx of [X(90), X(96)]) {
    b.vl(sx, by, by + bh - 1, C.shadow);
    b.vl(sx + 1, by, by + bh - 1, C.hilite);
  }
  // quick launch: the messenger's bubble, small
  b.art(X(100), by, ICON16.slice(1, 16), ICON_MAP);
  // another task: a text file open in an invented editor
  raised(b, X(262), by, 160, bh);
  iconMini(b, X(266), by + 2);
  text12(p, b, "鱼.txt - 小本子", X(282), by + 2, C.ink);
  // the chat's task button: pressed while it has focus, orange when it flashes
  const cx0 = X(CHAT_BTN[0]), cw = CHAT_BTN[1] - CHAT_BTN[0];
  if (flash) {
    octagon(b, cx0, by, cw, bh, { face: C.orange, lite: C.orangeLight, shade: C.orangeDark, line: col("#5a2e06") });
  } else {
    pressed(b, cx0, by, cw, bh, C.light);
    for (let y = by + 2; y < by + bh - 2; y += 1) for (let x = cx0 + 3; x < cx0 + cw - 3; x += 1) if ((x + y) % 2 === 0) b.put(x, y, C.hilite);
  }
  b.art(cx0 + 4, by, ICON16.slice(1, 16), ICON_MAP);
  text12(p, b, "大嘴信使 2003", cx0 + 23, by + 2, C.ink);
  // tray and clock
  const tx = X(906), tw = 74;
  b.rect(tx, by, tw, bh, C.face);
  thinSunken(b, tx, by, tw, bh);
  b.art(tx + 4, by + 4, FISH11, FISH_MAP);
  b.art(tx + 18, by, ICON16.slice(1, 15), ICON_MAP);
  text12(p, b, "21:07", tx + tw - 4 - 30, by + 2, C.ink);
  return b;
}

/** A 12 x 12 page for the editor's task button. */
function iconMini(b, x, y) {
  const k = col("#30353b");
  b.rect(x + 1, y, 9, 11, C.white);
  b.box(x + 1, y, 9, 11, k);
  for (let r = 0; r < 3; r += 1) b.hl(x + 3, x + 7, y + 3 + r * 2, col("#7aa0c0"));
}

// ---------------------------------------------------------------- the GIF

// 216-colour web palette with a 4 x 4 Bayer dither fixed to the GIF's pixels.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);
const q6 = (v, t) => Math.max(0, Math.min(5, Math.round(v / 51 + t))) * 51;
const snap6 = (v) => Math.max(0, Math.min(5, Math.round(v / 51))) * 51;

const LOOP = 10; // the background loops every ten GIF frames
const ROAD_STEP = 17; // road scroll per frame (170 units a second)
const HILL_P = 85; // near hills repeat every 85 units, scroll 8.5 a frame

const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function gifBackground(loop) {
  const W = GIF_W, H = GIF_H;
  const out = new Uint32Array(W * H);
  const hs = Math.round(loop * (HILL_P / LOOP));
  const rs = loop * ROAD_STEP;
  const skyTop = [24, 86, 196], skyLow = [176, 216, 248];
  const farA = [126, 176, 178], farB = [96, 150, 150];
  const hillA = [128, 206, 72], hillB = [44, 128, 44];
  const roadA = [232, 214, 170];
  const sunC = [255, 252, 210];
  const TAU = Math.PI * 2;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const t = BAYER[(y & 3) * 4 + (x & 3)];
      let c;
      const far = 104 + 7 * Math.sin(x / 21 + 0.7) + 4 * Math.sin(x / 8.3 + 2.0);
      const xs = x + hs;
      const near = 121 + 5 * Math.sin((TAU * xs) / HILL_P) + 3 * Math.sin((TAU * 2 * xs) / HILL_P + 1.2);
      if (y >= 150) {
        // road: a darker edge where the wheels touch, then the pale surface with dashes
        if (y === 150) c = [170, 146, 104];
        else {
          c = mixc(roadA, [206, 186, 140], (y - 151) / 6);
          if (y === 153 && (((x + rs) % 34) + 34) % 34 < 9) c = [255, 255, 240];
        }
        // the bicycle's shadow
        const sx = (x - 110) / 46, sy = (y - 151.5) / 3;
        if (sx * sx + sy * sy < 1 && y > 150) c = c.map((v) => v * 0.72);
      } else if (y >= near) {
        c = mixc(hillA, hillB, Math.min(1, (y - near) / (150 - near)));
        if (y < near + 1) c = [92, 170, 52];
      } else if (y >= far) {
        c = mixc(farA, farB, Math.min(1, (y - far) / 30));
      } else {
        c = mixc(skyTop, skyLow, Math.min(1, y / 112));
        // the sun, top left, with a halo that dithers into the sky
        const d = Math.hypot(x - 26, y - 24);
        if (d < 8.5) c = sunC;
        else if (d < 22) c = mixc(c, [255, 240, 190], ((22 - d) / 13.5) ** 1.6 * 0.85);
      }
      out[y * W + x] = pack(q6(c[0], t), q6(c[1], t), q6(c[2], t));
    }
  }
  // one-pixel grey border
  const g = pack(153, 153, 153);
  for (let x = 0; x < W; x += 1) { out[x] = g; out[(H - 1) * W + x] = g; }
  for (let y = 0; y < H; y += 1) { out[y * W] = g; out[y * W + W - 1] = g; }
  return out;
}

// The pelican in flat web-palette colours.
const GIF_SKIN = {
  ink: "#333333",
  feather: "#ffffff",
  featherShade: "#cccccc",
  wingtip: "#333333",
  bill: "#ff9900",
  pouch: "#ffcc66",
  leg: "#ff9933",
  legFar: "#cc6600",
  foot: "#ff9933",
  footFar: "#cc6633",
  frame: "#cc0000",
  metal: "#999999",
  metalDark: "#666666",
  tire: "#333333",
  spoke: "rgba(0,0,0,0)",
  saddle: "#663300",
  bell: "#ffcc00",
  reflector: "#ff6600",
};
// flat colour -> [its shadow tone, depth of the shaded side in pixels]. The
// shadow is laid with the same 4 x 4 ordered dither as the sky, fixed to the
// GIF's pixels: densest at the lower edge, thinning out upward, so bird and
// background share one texture.
const SHADE = new Map([
  [pack(255, 255, 255), [pack(204, 204, 255), 10]], // belly, neck, head
  [pack(204, 204, 204), [pack(153, 153, 204), 7]], // underside of the wing
  [pack(255, 204, 102), [pack(255, 153, 51), 5]], // underside of the pouch
  [pack(255, 153, 0), [pack(204, 102, 0), 2]], // bill
  [pack(204, 0, 0), [pack(153, 0, 0), 2]], // frame
  [pack(255, 153, 51), [pack(204, 102, 51), 3]], // near leg and foot
]);
// the far leg and foot sit wholly in shadow: an even dither of a darker tone
const SHADE_ALL = new Map([
  [pack(204, 102, 0), [pack(153, 51, 0), 0.5]],
  [pack(204, 102, 51), [pack(153, 51, 51), 0.5]],
]);
const SS = 4; // the puppet is drawn at four times and point-sampled at pixel centres

function gifFrame(p, cache, tick, pel) {
  const loop = ((tick % LOOP) + LOOP) % LOOP;
  let bg = cache.gifBg[loop];
  if (!bg) bg = cache.gifBg[loop] = gifBackground(loop);
  const b = new Buf(GIF_W, GIF_H);
  b.d.set(bg);
  if (pel.visible !== false) {
    // GIF-local pose: the road point is the GIF's centre column, on the road line
    const skel = solveRig({ ...pel, x: GIF_W / 2, y: 150, act: {} });
    // spokes: one-pixel lines, behind everything else
    const spoke = pack(204, 204, 204);
    for (const sh of skel.shapes) {
      if (sh.tag !== "spoke") continue;
      for (let i = 1; i < sh.pts.length; i += 1) b.line(Math.floor(sh.pts[i - 1][0]), Math.floor(sh.pts[i - 1][1]), Math.floor(sh.pts[i][0]), Math.floor(sh.pts[i][1]), spoke);
    }
    if (!cache.gifPen) cache.gifPen = new Layer2D(p, GIF_W * SS, GIF_H * SS);
    const ctx = cache.gifPen.clear();
    ctx.setTransform(SS, 0, 0, SS, 0.5, 0.5);
    drawPlain(ctx, skel, { palette: GIF_SKIN, outline: 0.07 });
    const img = ctx.getImageData(0, 0, GIF_W * SS, GIF_H * SS).data;
    const RW = GIF_W * SS;
    const mask = new Uint8Array(GIF_W * GIF_H);
    for (let y = 1; y < GIF_H - 1; y += 1) {
      for (let x = 1; x < GIF_W - 1; x += 1) {
        const i = ((y * SS + 2) * RW + (x * SS + 2)) * 4;
        if (img[i + 3] < 128) continue;
        const v = pack(snap6(img[i]), snap6(img[i + 1]), snap6(img[i + 2]));
        b.d[y * GIF_W + x] = v;
        mask[y * GIF_W + x] = 1;
      }
    }
    // the shaded side, dithered: for each flat colour, the distance down to
    // the edge of its patch sets the shadow's density
    const out = b.d.slice();
    for (let y = 1; y < GIF_H - 1; y += 1) {
      for (let x = 1; x < GIF_W - 1; x += 1) {
        const k = y * GIF_W + x;
        if (!mask[k]) continue;
        const v = b.d[k];
        const t = BAYER[(y & 3) * 4 + (x & 3)] + 0.5;
        const all = SHADE_ALL.get(v);
        if (all) {
          if (t < all[1]) out[k] = all[0];
          continue;
        }
        const sh = SHADE.get(v);
        if (!sh) continue;
        const D = sh[1];
        let d = 0;
        for (let dy = 1; dy <= D; dy += 1) {
          if (b.d[(y + dy) * GIF_W + x] !== v) { d = dy; break; }
        }
        if (!d) continue;
        const dens = (D + 1 - d) / (D + 1);
        if (t < dens) out[k] = sh[0];
      }
    }
    b.d.set(out);
    // hand-pixelled covert rows on the wing, as clip art had them: scalloped
    // lines that follow the wing's lower edge, anchored to the shoulder so
    // they travel with the bird
    const WING = pack(204, 204, 204), WSH = pack(153, 153, 204), WHI = pack(255, 255, 255);
    const ax = Math.round(skel.joints.shoulder[0]);
    const SC = [0, 2, 3, 3, 3, 2, 0, 0];
    const feather = new Uint8Array(GIF_W * GIF_H);
    for (let x = 1; x < GIF_W - 1; x += 1) {
      let depth = 0;
      const s = SC[(((x - ax) % 8) + 8) % 8];
      for (let y = GIF_H - 2; y >= 1; y -= 1) {
        const k = y * GIF_W + x;
        const v = b.d[k];
        if (v === WING || v === WSH) {
          depth += 1;
          if (depth === 8 - s || depth === 15 - s) feather[k] = 1;
        } else depth = 0;
      }
    }
    for (let k = 0; k < feather.length; k += 1) {
      if (!feather[k]) continue;
      b.d[k] = WSH;
      // a one-pixel highlight on the feather above the line
      const up = k - GIF_W;
      if (b.d[up] === WING && !feather[up]) b.d[up] = WHI;
    }
  }
  return b;
}

// ---------------------------------------------------------------- compositing shader

const FRAG = `${FRAG_HEAD}
uniform vec2 uRes;
uniform vec3 uView;   // k, tx, ty: world -> target pixels
uniform sampler2D uT0;
uniform sampler2D uT1;
uniform sampler2D uT2;
uniform vec3 uL0;     // world x, y of texel (0, 0); on
uniform vec3 uL1;
uniform vec3 uL2;
uniform sampler2D uT3;
uniform vec3 uL3;
uniform vec3 uBase;

vec4 fetchT(sampler2D t, ivec2 c, ivec2 sz) {
  if (c.x < 0 || c.y < 0 || c.x >= sz.x || c.y >= sz.y) return vec4(0.0);
  vec4 v = texelFetch(t, c, 0);
  return vec4(v.rgb * v.a, v.a);
}

// One texel per world unit. Away from a texel edge the colour is exact;
// across an edge it blends over exactly one target pixel.
vec4 layer(sampler2D t, vec3 L, vec2 w, float d) {
  if (L.z < 0.5) return vec4(0.0);
  vec2 a = w - L.xy;
  ivec2 sz = textureSize(t, 0);
  vec2 s = floor(a + 0.5);
  vec2 f = clamp((a - s) / d + 0.5, 0.0, 1.0);
  ivec2 i1 = ivec2(s);
  ivec2 i0 = i1 - 1;
  vec4 c00 = fetchT(t, ivec2(i0.x, i0.y), sz);
  vec4 c10 = fetchT(t, ivec2(i1.x, i0.y), sz);
  vec4 c01 = fetchT(t, ivec2(i0.x, i1.y), sz);
  vec4 c11 = fetchT(t, ivec2(i1.x, i1.y), sz);
  return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
}

void main() {
  vec2 px = vTexCoord * uRes;
  vec2 w = (px - uView.yz) / uView.x;
  float d = 1.0 / uView.x;
  vec4 col = vec4(uBase, 1.0);
  vec4 c;
  c = layer(uT0, uL0, w, d); col = c + col * (1.0 - c.a);
  c = layer(uT1, uL1, w, d); col = c + col * (1.0 - c.a);
  c = layer(uT2, uL2, w, d); col = c + col * (1.0 - c.a);
  c = layer(uT3, uL3, w, d); col = c + col * (1.0 - c.a);
  fragColor = vec4(col.rgb, 1.0);
}`;

// ---------------------------------------------------------------- caches

const CACHE = new WeakMap();
function cacheFor(stage) {
  let c = CACHE.get(stage);
  if (!c) {
    c = { layers: new Map(), gifBg: [], winBase: new Map() };
    CACHE.set(stage, c);
  }
  return c;
}

function uploadBuf(p, buf) {
  const layer = new Layer2D(p, buf.w, buf.h);
  const img = layer.ctx.createImageData(buf.w, buf.h);
  new Uint32Array(img.data.buffer).set(buf.d);
  layer.ctx.putImageData(img, 0, 0);
  layer.touch();
  return layer;
}

function cached(stage, key, build) {
  const cache = cacheFor(stage);
  let layer = cache.layers.get(key);
  if (!layer) {
    layer = uploadBuf(stage.p, build());
    cache.layers.set(key, layer);
  }
  return layer;
}

function windowBase(stage, L) {
  const cache = cacheFor(stage);
  const key = L.still ? "s" : "f";
  let base = cache.winBase.get(key);
  if (!base) {
    base = buildWindowBase(stage.p, L);
    cache.winBase.set(key, base);
  }
  return base;
}

// ---------------------------------------------------------------- the scene

export function windowState(u) {
  const notice = noticeOn(u);
  const ph = ((Math.floor(u * 8 + EPS) % 4) + 4) % 4;
  return {
    notice,
    dots: notice ? [1, 2, 3, 3][ph] : 0,
    pen: notice ? ((Math.floor(u * 4 + EPS) % 4) + 4) % 4 : 0,
    line: u >= T_SHAKE - EPS,
    q: u >= T_TYPE - EPS,
    caret: ((Math.floor(u * 2 + EPS) % 2) + 2) % 2 === 0,
  };
}

export const chat = {
  ...META,
  poseHz: HZ,
  still: { u: 3.6 },

  init(stage) {
    stage.shader("chat/composite", VERT, FRAG);
    cached(stage, "desk0", () => buildDesk(stage.p, false));
    cached(stage, "desk1", () => buildDesk(stage.p, true));
    windowBase(stage, layoutFor(false));
  },

  render(stage, f) {
    const p = stage.p;
    const u = f.u;
    const pel = f.pelican;
    const cache = cacheFor(stage);
    const L = layoutFor(!!f.still);

    const flash = u >= T_SHAKE - EPS && u < T_FLASH_END - EPS && Math.floor((u - T_SHAKE) * 8 + EPS) % 2 === 0;
    const desk = cached(stage, flash ? "desk1" : "desk0", () => buildDesk(p, flash));

    const st = windowState(u);
    const wkey = `win/${L.still ? "s" : "f"}/${st.notice ? `${st.dots}p${st.pen}` : "-"}${st.line ? "L" : ""}${st.q ? "Q" : ""}${st.caret ? "|" : ""}`;
    const base = windowBase(stage, L);
    const win = cached(stage, wkey, () => buildWindowState(p, base, L, st));

    const tick = Math.round(pel.time * HZ);
    const gkey = `gif/${tick}/${pel.visible === false ? 0 : 1}`;
    const gif = cached(stage, gkey, () => gifFrame(p, cache, tick, pel));

    const cursor = cached(stage, "cursor", () => {
      const cb = new Buf(11, 15);
      cb.art(0, 0, CURSOR, { K: C.black, W: C.white });
      return cb;
    });

    const [dx, dy] = shakeAt(u);
    const wx = pel.x + L.left + dx;
    const wy = WIN_Y + dy;
    const gx = pel.x - GIF_W / 2 + dx;
    const gy = GIF_Y + dy;

    const sh = stage.shader("chat/composite", VERT, FRAG);
    stage.origin();
    stage.shaderRect(sh, {
      uRes: [f.w, f.h],
      uView: [f.view.k, f.view.tx, f.view.ty],
      uBase: [0.42, 0.525, 0.63],
      uT0: desk.img,
      uL0: [DESK_X0, DESK_Y0, 1],
      uT1: win.img,
      uL1: [wx, wy, 1],
      uT2: gif.img,
      uL2: [gx, gy, 1],
      // the pointer that drags the window by its title bar: it does not shake
      uT3: cursor.img,
      uL3: [pel.x + L.left + L.cursorX, WIN_Y + 7, 1],
    }, 0, 0, f.w, f.h);
  },
};

/** For the lab (dev/experiments/chat-*.js) only. */
export const chatDev = { buildDesk, buildWindowBase, buildWindowState, layoutFor, gifFrame, gifBackground, text12, text16, width16, Buf };
