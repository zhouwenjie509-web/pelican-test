// Section 16 · 8 位像素游戏 · 8-Bit Pixel Game
//
// An invented side-scrolling game, 码头快骑 · PIER PEDALER: a seaside pier on a
// fixed 3-unit pixel grid (the row boundary sits on the road, y = 700), drawn
// from a 20-colour palette. Everything is an indexed image at art resolution:
//
//   sky + clouds    depth 0.06   baked
//   sea + far land  depth 0.5    baked twice (two wave frames, lamp)
//   lighthouse      depth 0.5    rock and tower as two overlapping sprites
//   boat            depth 0.5    its own small layer, sailing so that it keeps
//                                behind and left of the rider (BOAT_REL)
//   pier + props    depth 1      baked (deck tiles, piles, bollards, crate, sign on chains)
//   pelican sprite  travels with the pelican's road point; built from the rig
//                   at art resolution, one frame per 1/8 pedal turn, cached
//   HUD             travels with the pelican, cached per state
//   actors          per frame on the world grid: fish token, sparks, +100, 1UP,
//                   gulls, landing dust, the life-ring under the deck
//
// One fragment shader composites all nine layers at once. It samples the
// palette images texel by texel and gives every texel edge exactly one screen
// pixel of coverage blend, so the big pixels stay square and sharp while the
// camera slides by fractions of a pixel (no blur, no shimmer), at any zoom and
// render size.
//
// Bar 2: the sprite jumps the gap in the deck (take-off u = 2.5, apex u = 3.0
// with its head on the token, landing u = 3.5). At u = 3.0 the token bursts,
// +100 and a blinking 1UP pop out, tokens roll ×99 → ×00 and lives ×02 → ×03.

import { sectionMeta } from "./sections.js";
import { solveRig } from "../rig/rig.js";
import { WHEEL_R } from "../main/layout.js";
import { stepTime } from "../beat/timeline.js";
import { Layer2D } from "../kit/stage.js";
import { VERT, FRAG_HEAD } from "../kit/glsl.js";

const META = sectionMeta(16);

// ---------------------------------------------------------------- grid, time

const U = 3; // world units per art pixel
const ROAD = 700; // a row boundary
const HZ = 8; // internal animation clock

const T_JUMP = 2.5;
const T_APEX = 3.0;
const T_LAND = 3.5;
const JUMP_H = 84; // world units at the apex

// ---------------------------------------------------------------- palette (20 colours + transparent)

const HEX = [
  null, //  0 transparent
  "#12101c", //  1 K  outline / ink
  "#fcfcfc", //  2 W  white
  "#4a7cf0", //  3 upper sky
  "#94c6fa", //  4 lower sky, wave crests
  "#cfe6fb", //  5 cloud shade
  "#1b3f9e", //  6 deep sea
  "#2d6fd6", //  7 sea
  "#2f6b78", //  8 far land
  "#d8301c", //  9 red
  "#b4bccb", // 10 light grey
  "#5d6474", // 11 dark grey
  "#e8a85a", // 12 light wood
  "#b0642a", // 13 wood
  "#5f3012", // 14 dark wood
  "#fb8a1a", // 15 orange
  "#fcd83a", // 16 yellow
  "#4cd468", // 17 green
  "#fbeec4", // 18 cream
  "#3c9a4a", // 19 grass
  "#6aa3a8", // 20 far land, lit
];
const K = 1, W = 2, SKY1 = 3, SKY2 = 4, CLOUD = 5, SEA1 = 6, SEA2 = 7, FAR = 8, RED = 9, G1 = 10, G2 = 11;
const WD1 = 12, WD2 = 13, WD3 = 14, OR = 15, YE = 16, GR = 17, CR = 18, GRASS = 19, FAR2 = 20;

const RGBA = new Uint32Array(HEX.length);
HEX.forEach((h, i) => {
  if (!h) return;
  const v = parseInt(h.slice(1), 16);
  RGBA[i] = (255 << 24) | ((v & 255) << 16) | (((v >> 8) & 255) << 8) | ((v >> 16) & 255);
  RGBA[i] >>>= 0;
});

// letters used in art strings
const CH = {
  ".": 0, K, W, s: SKY1, S: SKY2, c: CLOUD, d: SEA1, e: SEA2, f: FAR, F: FAR2, R: RED, G: G1, g: G2,
  a: WD1, b: WD2, w: WD3, O: OR, Y: YE, N: GR, C: CR, n: GRASS,
};

// ---------------------------------------------------------------- indexed image

/** A palette-index image whose texel (0, 0) is world art pixel (c0, r0). */
class Pix {
  constructor(c0, r0, w, h) {
    this.c0 = c0;
    this.r0 = r0;
    this.w = w;
    this.h = h;
    this.d = new Uint8Array(w * h);
  }
  get(c, r) {
    const x = c - this.c0;
    const y = r - this.r0;
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : 0;
  }
  /** Write a colour (0 erases). */
  put(c, r, v) {
    const x = c - this.c0;
    const y = r - this.r0;
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = v;
  }
  set(c, r, v) {
    if (v) this.put(c, r, v);
  }
  rect(c, r, w, h, v) {
    for (let y = r; y < r + h; y += 1) for (let x = c; x < c + w; x += 1) this.put(x, y, v);
  }
  /** Stamp an art block: rows of characters from CH, '.' is skipped. */
  art(c, r, rows, map = CH, flip = false) {
    for (let y = 0; y < rows.length; y += 1) {
      const row = rows[y];
      const n = row.length;
      for (let x = 0; x < n; x += 1) {
        const v = map[row[flip ? n - 1 - x : x]];
        if (v) this.put(c + x, r + y, v);
      }
    }
  }
  clear() {
    this.d.fill(0);
  }
}

/** Upload an indexed image into a Layer2D (palette -> RGBA). */
function upload(layer, pix) {
  const n = pix.w * pix.h;
  if (!layer._img || layer._img.width !== pix.w || layer._img.height !== pix.h) {
    layer._img = layer.ctx.createImageData(pix.w, pix.h);
    layer._u32 = new Uint32Array(layer._img.data.buffer);
  }
  const out = layer._u32;
  const src = pix.d;
  for (let i = 0; i < n; i += 1) out[i] = RGBA[src[i]];
  layer.ctx.putImageData(layer._img, 0, 0);
  layer.touch();
  return layer;
}

// ---------------------------------------------------------------- bitmap fonts

// 7-row font of our own: capitals 5 wide, digits 4 wide.
const FONT7 = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
  I: ["###", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
  L: ["#...", "#...", "#...", "#...", "#...", "#...", "####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".###.", "#...#", "#....", ".###.", "....#", "#...#", ".###."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  s: ["....", "....", ".###", "#...", ".##.", "...#", "###."],
  0: [".##.", "#..#", "#..#", "#..#", "#..#", "#..#", ".##."],
  1: [".#.", "##.", ".#.", ".#.", ".#.", ".#.", "###"],
  2: [".##.", "#..#", "...#", "..#.", ".#..", "#...", "####"],
  3: ["###.", "...#", "...#", ".##.", "...#", "...#", "###."],
  4: ["..#.", ".##.", "#.#.", "#.#.", "####", "..#.", "..#."],
  5: ["####", "#...", "###.", "...#", "...#", "#..#", ".##."],
  6: [".##.", "#...", "#...", "###.", "#..#", "#..#", ".##."],
  7: ["####", "...#", "..#.", "..#.", ".#..", ".#..", ".#.."],
  8: [".##.", "#..#", "#..#", ".##.", "#..#", "#..#", ".##."],
  9: [".##.", "#..#", "#..#", ".###", "...#", "...#", ".##."],
  "-": ["...", "...", "...", "###", "...", "...", "..."],
  "+": ["...", "...", ".#.", "###", ".#.", "...", "..."],
  "×": [".....", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "....."],
  "·": ["...", "...", "...", ".#.", "...", "...", "..."],
  " ": ["..", "..", "..", "..", "..", "..", ".."],
};

// 12 x 12 bitmap Chinese for the title, taken from the 12-px strike of the
// system's GB18030 Bitmap face (see dev/experiments/pixel-glyphs.js) and
// checked by eye at full size. 11 columns wide.
const CJK12 = {
  "位": ["...#..#....", "...#...#...", "..#........", "..#.#######", ".##.#....#.", "#.#.#....#.", "..#..#..#..", "..#..#.##..", "..#..#.#...", "..#....#...", "..#########", "..#........"],
  "像": ["...#.#.....", "...######..", "..#.######.", "..#.#..#.#.", ".##.######.", "#.#..#.#..#", "..#.#..#.#.", "..#.#####..", "..#....#.#.", "..#..###..#", "..#.#.##..#", "..#....#..."],
  "素": [".....#.....", ".#########.", "..#######..", ".....#.....", ".##########", "....#..#...", "..######...", "....##..#..", "..########.", ".....#...#.", ".##.##.##..", "....#......"],
  "游": ["....#..#...", ".##..#.####", "..#.####...", "#...#..#...", ".##.#######", "..#.#.#..#.", "..#.#.#..#.", "##..#.#####", ".#..#.#..#.", ".#..#.#..#.", ".#.#####.#.", "..#.....#.."],
  "戏": [".......#.#.", ".####..#..#", "....#..#...", ".#..#######", ".##.#..#..#", "..#.#..#..#", "...#...#.#.", "..#.#..###.", ".#..#..#...", ".#.....#...", "#....##.###", "....#.....#"],
};
// a 12-row "8" drawn to sit with the Chinese
const EIGHT12 = ["......", ".####.", "#....#", "#....#", "#....#", ".####.", "#....#", "#....#", "#....#", "#....#", ".####.", "......"];

// 9 x 9 bitmap Chinese for the date line (9-px strike of the same face)
const CJK9 = {
  "世": [".#..#.#..", ".#..#.#..", ".#..#.#..", "#########", ".#..#.#..", ".#..###..", ".#..#.#..", ".#.......", ".########"],
  "纪": [".#.......", ".#.#####.", "#..#...#.", "###....#.", "##..####.", "#####....", "....#....", "#####...#", "#...#####"],
  "年": [".#.......", ".#######.", ".#..#....", "########.", ".#..#....", "#########", "....#....", "....#....", "....#...."],
  "代": ["..#.##...", ".##.#.#..", ".#..#....", "#########", "##...#...", ".#...#...", ".#...#..#", ".#....###", ".#.....##"],
};

// 5-row sign font of our own, for the Latin on the title board: it sits
// between the rows of the 9-row Chinese, so the board keeps a margin all round.
const FONT5 = {
  A: [".##.", "#..#", "####", "#..#", "#..#"],
  B: ["###.", "#..#", "###.", "#..#", "###."],
  E: ["###", "#..", "##.", "#..", "###"],
  G: [".###", "#...", "#.##", "#..#", ".###"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#...#", "##.##", "#.#.#", "#...#", "#...#"],
  P: ["###.", "#..#", "###.", "#...", "#..."],
  T: ["#####", "..#..", "..#..", "..#..", "..#.."],
  X: ["#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
  s: ["...", ".##", "#..", "..#", "##."], // a small s, a row short of the capitals
  0: ["###", "#.#", "#.#", "#.#", "###"],
  1: [".#.", "##.", ".#.", ".#.", "###"],
  2: ["###", "..#", "###", "#..", "###"],
  8: ["###", "#.#", "###", "#.#", "###"], // a full waist bar: never an S (B is wider and notched)
  9: ["###", "#.#", "###", "..#", "###"],
  "-": ["...", "...", "###", "...", "..."],
  "·": [".", ".", "#", ".", "."],
  " ": ["...", "...", "...", "...", "..."],
};

/** Sign lettering: FONT5 and CJK9 mixed; (c, r) is the top of a 9-row line. */
function signWidth(str) {
  let w = 0;
  let n = 0;
  for (const ch of str) {
    const g = CJK9[ch] || FONT5[ch];
    if (!g) continue;
    w += g[0].length;
    n += 1;
  }
  return w + Math.max(0, n - 1);
}
function drawSign(pix, str, c, r, color, tall = 9) {
  let x = c;
  for (const ch of str) {
    const cjk = CJK9[ch];
    const rows = cjk || FONT5[ch];
    if (!rows) continue;
    stamp(pix, rows, x, cjk ? r : r + Math.floor((tall - 5) / 2), color);
    x += rows[0].length + 1;
  }
  return x;
}

/** Width of a string in the 7-row font, 1 px between glyphs. */
function textWidth(str) {
  let w = 0;
  let n = 0;
  for (const ch of str) {
    const g = FONT7[ch] || CJK9[ch];
    if (!g) continue;
    w += g[0].length;
    n += 1;
  }
  return w + Math.max(0, n - 1);
}

/**
 * Draw a string; (c, r) is the top-left of the 7-row line. CJK9 glyphs are
 * two rows taller and hang two rows above it. Returns the column after the
 * text. With `outline`, every letter gets a one-pixel ring of that colour
 * (laid first, so it never cuts into a neighbouring letter).
 */
function drawText(pix, str, c, r, color, outline = 0, counter = 0) {
  const cells = [];
  const boxes = [];
  let x = c;
  for (const ch of str) {
    const g = FONT7[ch];
    const big = !g && CJK9[ch];
    const rows = g || big;
    if (!rows) continue;
    const top = big ? r - 2 : r;
    for (let y = 0; y < rows.length; y += 1) {
      for (let i = 0; i < rows[y].length; i += 1) if (rows[y][i] === "#") cells.push(x + i, top + y);
    }
    if (ch !== " ") boxes.push([x, top, rows[0].length, rows.length]);
    x += rows[0].length + 1;
  }
  if (outline && counter) {
    // each letter's own cell is laid in the counter colour (the sky behind the
    // HUD row), so the letter keeps its plain shape and nothing passing behind
    // shows inside it; the dark ring goes only round the outside of the cell,
    // next to the strokes that touch it
    const inBox = (i, j) => boxes.some(([bx, by, bw, bh]) => i >= bx && i < bx + bw && j >= by && j < by + bh);
    for (const [bx, by, bw, bh] of boxes) for (let j = by; j < by + bh; j += 1) for (let i = bx; i < bx + bw; i += 1) pix.put(i, j, counter);
    for (let k = 0; k < cells.length; k += 2) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const i = cells[k] + dx;
        const j = cells[k + 1] + dy;
        if (!inBox(i, j)) pix.put(i, j, outline);
      }
    }
  } else if (outline) {
    for (let k = 0; k < cells.length; k += 2) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pix.put(cells[k] + dx, cells[k + 1] + dy, outline);
    }
  }
  for (let k = 0; k < cells.length; k += 2) pix.put(cells[k], cells[k + 1], color);
  return x;
}

function stamp(pix, rows, c, r, color) {
  for (let y = 0; y < rows.length; y += 1) for (let i = 0; i < rows[y].length; i += 1) if (rows[y][i] === "#") pix.put(c + i, r + y, color);
}

// ---------------------------------------------------------------- the level, in world art pixels

const GAP0 = 152; // first open column of the gap (x 456): the front tyre leaves the lip at take-off
const GAP1 = 176; // first deck column after it (x 528): the rear tyre lands well onto the deck
const COIN_C = 162; // token: columns 162..171, rows -78..-69 (centre (501, 481))
const COIN_R = -78;
const UP_LEFT = 10; // art columns by which "1UP" stands left of the token's centre, clear of the head
const SIGN = { c0: 27, c1: 109, r0: -78, r1: -47 }; // x 81..330 (250 wide), y 466..562; hangs on chains
const RING_C = 247; // the life-ring hangs on the face of a pile, below the deck

// ---------------------------------------------------------------- sky layer

const SKY_P = 0.06;
function buildSky() {
  const pix = new Pix(-140, -96, 300, 78); // cols -140..159, rows -96..-19
  for (let r = pix.r0; r < pix.r0 + pix.h; r += 1) {
    for (let c = pix.c0; c < pix.c0 + pix.w; c += 1) {
      let v = SKY1;
      if (r >= -44) v = SKY2;
      else if (r >= -48) v = (c + r) & 1 ? SKY2 : SKY1; // a two-tone dither band
      pix.put(c, r, v);
    }
  }
  // clouds: long flat bars only, two rows each (white over a shaded underside,
  // ends clipped), each standing alone: no stacked or stepped mounds. A sky
  // column c shows at world x 3c + 0.94 pel.x; while the token is in view
  // (pel.x 240..500) every bar stays at least 60 units clear of it on either
  // side, so all bars end at column -27 or earlier (100 units clear at the grab).
  const bar = (c, r, len) => {
    for (let x = 0; x < len; x += 1) {
      const end = x === 0 || x === len - 1;
      if (!end) pix.put(c + x, r, W);
      pix.put(c + x, r + 1, CLOUD);
    }
  };
  for (const [c, r, len] of [
    [-48, -60, 22],
    [-72, -65, 18],
    [-86, -55, 32],
    [-124, -61, 28],
    [-139, -52, 16],
  ]) bar(c, r, len);
  return pix;
}

// ---------------------------------------------------------------- sea layer (two frames)

const SEA_P = 0.5;
const WAVE = [
  // 16 x 16 wave tile, frame A. e = sea, S = crest, d = trough
  [
    "................",
    "...SSS..........",
    "..S...S.........",
    "................",
    "..........ddd...",
    "................",
    "................",
    "................",
    "..........SSS...",
    ".........S...S..",
    "................",
    "..ddd...........",
    "................",
    "................",
    "................",
    "................",
  ],
];
WAVE.push(WAVE[0].map((row) => row.slice(2) + row.slice(0, 2))); // frame B: the crests roll on

function buildSea(frame) {
  const pix = new Pix(-196, -56, 560, 91); // cols -196..363, rows -56..34
  const tile = WAVE[frame];
  for (let r = -20; r < pix.r0 + pix.h; r += 1) {
    for (let c = pix.c0; c < pix.c0 + pix.w; c += 1) {
      const deep = r >= 8;
      let v = deep ? SEA1 : SEA2;
      if (r === -20) v = SEA1;
      else if (r <= -16) {
        // thin far swell: short dashes
        if ((r === -18 && ((c + frame * 3) % 11 === 0 || (c + frame * 3) % 11 === 1)) || (r === -16 && (c + 5 - frame * 2) % 9 < 2)) v = SKY2;
      } else {
        const t = tile[(((r + 16) % 16) + 16) % 16][(((c % 16) + 16) % 16)];
        if (t === "S") v = deep ? SEA2 : SKY2;
        else if (t === "d" && !deep) v = SEA1;
      }
      pix.put(c, r, v);
    }
  }
  // far land, left: a low headland
  for (let c = -196; c <= -70; c += 1) {
    const t = (c + 196) / 126;
    const h = Math.round(9 * Math.sin(Math.PI * Math.min(1, t * 1.25)) ** 0.7 + 3 * Math.sin(c * 0.21) * Math.sin(Math.PI * t));
    for (let r = -20 - h; r < -20; r += 1) pix.put(c, r, r === -20 - h ? FAR2 : r === -19 - h && (c & 1) ? FAR2 : FAR);
  }
  // far land, right: an island with two trees
  for (let c = 262; c <= 340; c += 1) {
    const t = (c - 262) / 78;
    const h = Math.round(7 * Math.sin(Math.PI * t) ** 0.8);
    for (let r = -20 - h; r < -20; r += 1) pix.put(c, r, r === -20 - h ? FAR2 : FAR);
  }
  for (const tc of [292, 300]) {
    pix.art(tc - 3, -36, ["..nn..", ".nnnn.", "nnnnnn", ".nnnn.", "..f...", "..f...", "..f..."]);
  }
  // surf round the lighthouse rock, in the sea's own colours
  const L = LIGHT_C;
  pix.art(L - 16, -19, [frame ? ".S.SS................SS.S.." : "S.SS..................SS.S"]);
  return pix;
}

/**
 * The lighthouse and the boat ride on the sea's plane but are drawn as
 * overlapping hardware sprites, so that no 8 x 8 tile holds more than three
 * colours: "rock" (K, greys) and "top" (tower, lamp and boat: K, white, red,
 * yellow lamp in tiles of their own).
 */
const LIGHT_C = 193;
const BOAT = [
  "....K.......",
  "....KRR.....",
  "....KR......",
  "...WK.......",
  "..WWK.KKK...",
  ".WWWK.KWK...",
  "KKKKKKKKKKKK",
  "KRRRRRRRRRRK",
  ".KRRRRRRRRK.",
  "..KKKKKKKK..",
];
/**
 * The boat sails along the horizon, keeping behind and to the left of the
 * rider (world units from the pelican's road x), so it never passes behind the
 * sprite. It moves smoothly; only its bob steps with the waves.
 */
const BOAT_REL = (u) => -150 - 14 * u;
function buildMid(frame, part) {
  const pix = new Pix(-196, -60, 560, 48); // rows -60..-13
  const L = LIGHT_C;
  if (part === "boat") {
    // a small fishing boat, bobbing one pixel between the frames; it has a
    // layer of its own so that it can sail (see BOAT_REL)
    const b = new Pix(-6, -26, 12, 11);
    b.art(-6, frame ? -24 : -25, BOAT);
    return b;
  }
  if (part === "rock") {
    pix.art(L - 15, -23, [
      ".........gggggggg.........",
      "......ggGGGGGGGGGgg.......",
      "....ggGGGGGGgGGGGGGgg.....",
      "..ggGGGGgGGGGGGGGgGGGgg...",
      ".gGGGGGGGGGGgggGGGGGGGGgg.",
      "gggggggggggggggggggggggggg",
    ]);
    return pix;
  }
  // tower: white with two red bands, dark outline, tapering
  for (let r = -45; r <= -24; r += 1) {
    const half = r < -38 ? 3 : r < -30 ? 4 : 5;
    for (let c = L - half; c < L + half; c += 1) {
      const edge = c === L - half || c === L + half - 1;
      const band = (r >= -42 && r <= -39) || (r >= -33 && r <= -30);
      pix.put(c, r, edge ? K : band ? RED : W);
    }
  }
  pix.art(L - 1, -37, ["K", "K"]); // window
  pix.rect(L - 2, -28, 2, 4, K); // door
  // gallery, lamp room and roof; the lamp flashes on the wave clock
  pix.art(L - 6, -55, [
    ".....RR.....",
    "....RRRR....",
    "..RRRRRRRR..",
    "...KKKKKK...",
    frame ? "...KYYYYK..." : "...KYKKYK...",
    frame ? "...KYYYYK..." : "...KYKKYK...",
    "...KKKKKK...",
    "KKKKKKKKKKKK",
    ".K.K.K.K.K.K",
  ]);
  if (frame) {
    pix.art(L - 13, -51, ["YYY..............YYY", "...................."]);
  }
  return pix;
}

// ---------------------------------------------------------------- pier layer

const PLANK = [
  // 16 x 8 deck tile
  "aaaaaaaaaaaaaaaa",
  "wbbbbbbbbbbbbbbb",
  "wbwbbbbbbbbbbwbb",
  "wbbbbbbwwwwbbbbb",
  "wbbbbbbbbbbbbbbb",
  "wbwbbbbbbbbbbwbb",
  "wwwwwwwwwwwwwwww",
  "wwwwwwwwwwwwwwww",
];

function buildPier() {
  const pix = new Pix(-260, -90, 852, 125); // cols -260..591, rows -90..34 (the sign's chains reach the top of the picture)
  const open = (c) => c >= GAP0 && c < GAP1;
  // deck and stringer
  for (let c = pix.c0; c < pix.c0 + pix.w; c += 1) {
    if (open(c)) continue;
    const tc = ((c % 16) + 16) % 16;
    for (let r = 0; r < 8; r += 1) pix.put(c, r, CH[PLANK[r][tc]]);
    pix.put(c, 8, WD3);
    pix.put(c, 9, (c & 1) ? WD3 : 0);
  }
  // deck ends at the gap: end grain
  for (let r = 0; r < 9; r += 1) {
    pix.put(GAP0 - 1, r, r === 0 ? WD1 : WD3);
    pix.put(GAP1, r, r === 0 ? WD1 : WD3);
  }
  // piles every 16 columns, plus one at each lip of the gap
  const piles = [];
  for (let c = Math.floor(pix.c0 / 16) * 16 + 6; c < pix.c0 + pix.w; c += 16) if (!open(c) && !open(c + 2)) piles.push(c);
  piles.push(GAP0 - 3, GAP1);
  for (const c of piles) {
    for (let r = 8; r <= 34; r += 1) {
      // one 16 x 16 tile row holds the dry pile, the next the wet one with its foam
      const wet = r >= 20;
      pix.put(c, r, wet ? WD3 : r < 16 ? WD1 : WD2);
      pix.put(c + 1, r, wet ? WD3 : WD2);
      pix.put(c + 2, r, WD3);
    }
    // foam where the pile meets the water
    pix.put(c - 1, 19, W);
    pix.put(c + 3, 19, W);
    pix.put(c - 2, 20, W);
    pix.put(c + 4, 20, W);
  }
  // cross braces between neighbouring piles
  piles.sort((a, b) => a - b);
  for (let i = 0; i + 1 < piles.length; i += 1) {
    const a = piles[i] + 3;
    const b = piles[i + 1] - 1;
    if (b - a > 16 || b <= a) continue;
    if (open(a + 1) || open(b - 1)) continue;
    const down = ((piles[i] - 6) / 16) & 1;
    for (let x = a; x <= b; x += 1) {
      const t = (x - a) / (b - a);
      const r = Math.round(10 + (down ? t : 1 - t) * 7);
      pix.put(x, r, WD3);
      pix.put(x, r + 1, WD3);
    }
  }
  // the deck is bare: nothing stands in the rider's plane (y 560..705)
  // (a life-ring hangs on the face of a pile below the deck, its top against
  // the stringer: a sprite of its own, drawn with the actors, so the pile's
  // tiles keep to four colours; see drawRing)
  // the sign
  buildSign(pix);
  return pix;
}

function buildSign(pix) {
  const { c0, c1, r0, r1 } = SIGN;
  // two chains from the top of the picture: rings seen face-on (an oval with a
  // hole) joined by links seen edge-on, period 4, in the board's own outline
  // colour so each 16 x 16 tile keeps to four colours; they pass behind the HUD
  const LINK = [".K.", "K.K", ".K.", ".K."];
  for (const cc of [c0 + 8, c1 - 8]) {
    for (let r = -90; r < r0; r += 1) {
      const row = LINK[(((r - r0) % 4) + 4) % 4];
      for (let i = 0; i < 3; i += 1) if (row[i] !== ".") pix.put(cc - 1 + i, r, CH[row[i]]);
    }
  }
  // board: dark wood, one pixel of highlight along the top, dark outline
  for (let r = r0; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) {
      const edge = c === c0 || c === c1 || r === r1;
      pix.put(c, r, edge ? K : r === r0 ? CR : WD3);
    }
  }
  pix.put(c0, r0, 0);
  pix.put(c1, r0, 0);
  pix.put(c0 + 1, r0, K);
  pix.put(c1 - 1, r0, K);
  const inner0 = c0 + 1;
  const innerW = c1 - c0 - 1;
  // line 1: 8 位像素游戏, 12-px bitmap
  const zh = ["8", "位", "像", "素", "游", "戏"];
  const w1 = 6 + 3 + 5 * 11 + 4 * 1;
  let x = inner0 + Math.floor((innerW - w1) / 2);
  const rz = r0 + 2;
  for (const ch of zh) {
    if (ch === "8") {
      stamp(pix, EIGHT12, x, rz, CR);
      x += 6 + 3;
    } else {
      stamp(pix, CJK12[ch], x, rz, CR);
      x += 12;
    }
  }
  // line 2: 8-BIT PIXEL GAME, in the 5-row sign font
  const en = "8-BIT PIXEL GAME";
  drawSign(pix, en, inner0 + Math.floor((innerW - signWidth(en)) / 2), r0 + 15, CR, 5);
  // line 3: 1980s · 20世纪80年代 (9-row Chinese, the digits centred on it)
  const date = "1980s·20世纪80年代";
  drawSign(pix, date, inner0 + Math.floor((innerW - signWidth(date)) / 2), r0 + 21, CR);
}

// ---------------------------------------------------------------- the pelican sprite

const SPR = { c0: -28, r0: -47, w: 56, h: 47 };

// 15 x 15 wheel: tyre ring (K), rim ring (G), the rest is spokes
const TYRE = [
  ".....KKKKK.....",
  "...KK.....KK...",
  "..K.........K..",
  ".K...........K.",
  ".K...........K.",
  "K.............K",
  "K.............K",
  "K.............K",
  "K.............K",
  "K.............K",
  ".K...........K.",
  ".K...........K.",
  "..K.........K..",
  "...KK.....KK...",
  ".....KKKKK.....",
];
const RIM = [
  ".....GGGGG.....",
  "...GG.....GG...",
  "..G.........G..",
  "..G.........G..",
  ".G...........G.",
  ".G...........G.",
  ".G...........G.",
  ".G...........G.",
  ".G...........G.",
  "..G.........G..",
  "..G.........G..",
  "...GG.....GG...",
  ".....GGGGG.....",
].map((row) => row.slice(1, 14));

function insidePoly(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segDist(px, py, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2));
  return Math.hypot(px - a[0] - dx * t, py - a[1] - dy * t);
}

/**
 * Rasterise the puppet at art resolution. Coordinates: art pixels relative
 * to the road point, y down; pixel (i, j) covers [i, i+1) x [j, j+1).
 *
 * The sprite is built the way an 8-bit console builds a big character: as
 * overlapping hardware sprites, each with its own three-colour palette.
 *   bike   K, red, grey      wheels, frame, cranks, saddle, bars
 *   bird   K, white, grey    body, neck, head, tail, wing
 *   limbs  K, orange, yellow legs, feet, bill, pouch
 * Every 8 x 8 tile of every layer therefore holds at most three colours.
 */
function rasterPelican(crank, opts = {}) {
  const act = { bob: 1, wind: 0.5, lid: 0, ...(opts.act || {}) };
  const skel = solveRig({ x: 0, y: 0, scale: WHEEL_R / U, slope: 0, crank, wheel: 0, time: opts.time || 0.4, act });
  const S = {};
  for (const sh of skel.shapes) S[sh.id] = sh;
  const J = { ...skel.joints };
  if (opts.squash) {
    // landing squash: the bird (not the bicycle or the legs) is pressed down
    // towards the hip by `squash` art pixels at the top of the head and
    // widened in proportion
    const base = J.hip[1];
    const top = J.head[1] - 4.5;
    const sy = (base - top - opts.squash) / (base - top);
    const sx = 1 + (1 - sy) * 1.1;
    const cx = J.hip[0];
    const m = ([x, y]) => [cx + (x - cx) * sx, base + (y - base) * sy];
    const BIRD = /^(wingTip|tail|body|neck|crest|head|wing|pouch|bill)/;
    for (const id of Object.keys(S)) if (BIRD.test(id)) S[id] = { ...S[id], pts: S[id].pts.map(m) };
    for (const id of ["head", "eye", "billBase", "billTip"]) J[id] = m(J[id]);
  }
  const mk = () => new Pix(SPR.c0, SPR.r0, SPR.w, SPR.h);
  const L = { far: mk(), bike: mk(), near: mk(), bird: mk(), beak: mk() };

  const poly = (pix, pts, v, grow = 0) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    for (let j = Math.floor(y0) - 1; j <= Math.ceil(y1); j += 1) {
      for (let i = Math.floor(x0) - 1; i <= Math.ceil(x1); i += 1) {
        if (insidePoly(pts, i + 0.5, j + 0.5)) pix.put(i, j, v);
        else if (grow > 0) {
          for (let k = 0; k < pts.length; k += 1) {
            if (segDist(i + 0.5, j + 0.5, pts[k], pts[(k + 1) % pts.length]) < grow) {
              pix.put(i, j, v);
              break;
            }
          }
        }
      }
    }
  };
  const seg = (pix, a, b, r, v) => {
    for (let j = Math.floor(Math.min(a[1], b[1]) - r) - 1; j <= Math.ceil(Math.max(a[1], b[1]) + r); j += 1) {
      for (let i = Math.floor(Math.min(a[0], b[0]) - r) - 1; i <= Math.ceil(Math.max(a[0], b[0]) + r); i += 1) {
        if (segDist(i + 0.5, j + 0.5, a, b) <= r) pix.put(i, j, v);
      }
    }
  };
  // Bresenham between the pixels containing a and b
  const line = (pix, a, b, v) => {
    let x0 = Math.floor(a[0]);
    let y0 = Math.floor(a[1]);
    const x1 = Math.floor(b[0]);
    const y1 = Math.floor(b[1]);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      pix.put(x0, y0, v);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  const outline = (pix) => {
    const add = [];
    for (let j = SPR.r0; j < SPR.r0 + SPR.h; j += 1) {
      for (let i = SPR.c0; i < SPR.c0 + SPR.w; i += 1) {
        if (pix.get(i, j)) continue;
        const f = (x, y) => {
          const v = pix.get(x, y);
          return v && v !== K;
        };
        if (f(i - 1, j) || f(i + 1, j) || f(i, j - 1) || f(i, j + 1)) add.push(i, j);
      }
    }
    for (let k = 0; k < add.length; k += 2) pix.put(add[k], add[k + 1], K);
  };
  const scaleAbout = (pts, c, k) => pts.map(([x, y]) => [c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * k]);
  const legW = opts.legW || 0.62;

  // limbs, far side: a single darker stub (the far shin, no foot, no pedal),
  // unoutlined, so the crank area holds one clear leg and one pedal
  {
    const k = J.kneeFar;
    const a = J.ankleFar;
    seg(L.far, k, [k[0] + (a[0] - k[0]) * 0.8, k[1] + (a[1] - k[1]) * 0.8], 0.75, WD2);
  }

  // bike: true pixel rings, four spokes that step round, a one-pixel red frame
  const B = L.bike;
  const spokeA = opts.spoke || 0;
  for (const wc of [J.rear, J.front]) {
    const ci = Math.round(wc[0] - 0.5);
    const cj = -8;
    for (let k = 0; k < 4; k += 1) {
      const a = spokeA + (k * Math.PI) / 2;
      line(B, [ci + 0.5, cj + 0.5], [ci + 0.5 + Math.cos(a) * 5.4, cj + 0.5 + Math.sin(a) * 5.4], G1);
    }
    B.art(ci - 6, cj - 6, RIM);
    B.art(ci - 7, cj - 7, TYRE);
    B.put(ci, cj, K);
  }
  const P = (id, k) => S[id].pts[k];
  line(B, J.bb, J.rear, RED); // chain stay
  line(B, P("seatStay", 0), J.rear, RED);
  line(B, J.bb, P("seatTube", 1), RED);
  line(B, J.bb, P("headTube", 0), RED); // down tube
  line(B, P("topTube", 0), P("topTube", 1), RED);
  line(B, P("headTube", 0), P("headTube", 1), RED);
  line(B, P("headTube", 0), J.front, RED); // fork
  line(B, P("seatPost", 0), P("seatPost", 1), K);
  line(B, P("stem", 0), P("stem", 2), K);
  line(B, P("bar", 0), P("bar", 2), K);
  poly(B, S.saddle.pts, K, 0.45);
  // bottom bracket and the one crank arm we show
  B.rect(Math.floor(J.bb[0] - 0.5), Math.floor(J.bb[1] - 0.5), 2, 2, K);
  line(B, J.bb, J.pedalNear, K);

  // limbs, near side: a clear two-pixel thigh and shin, a foot, and one pedal
  // (a 5 x 3 block under the foot: dark, with a light top edge)
  seg(L.near, J.hip, J.kneeNear, 1.0, OR);
  seg(L.near, J.kneeNear, J.ankleNear, 0.85, OR);
  poly(L.near, S.footNear.pts, OR, 0.3);
  // the pedal, right under the sole: a dark block five pixels wide and three
  // tall, its top edge lit (three light-grey pixels between dark ends)
  const pc = Math.floor(J.pedalNear[0]);
  let pr = Math.floor(J.pedalNear[1]);
  for (let j = pr - 3; j <= pr + 2; j += 1) for (let i = pc - 1; i <= pc + 1; i += 1) if (L.near.get(i, j)) pr = Math.max(pr, j + 1);
  const pedal = [[pc - 2, pr, K], [pc - 1, pr, G1], [pc, pr, G1], [pc + 1, pr, G1], [pc + 2, pr, K]];
  for (let i = pc - 2; i <= pc + 2; i += 1) pedal.push([i, pr + 1, K], [i, pr + 2, K]);

  // the bird
  const D = L.bird;
  for (let k = 0; k < 4; k += 1) poly(D, S[`wingTip${k}`].pts, G1, 0.15);
  for (let k = 0; k < 3; k += 1) poly(D, S[`tail${k}`].pts, W, 0.2);
  poly(D, S.body.pts, W);
  poly(D, S.neck.pts, W, 0.25);
  for (let k = 0; k < 3; k += 1) poly(D, S[`crest${k}`].pts, W, 0.15);
  poly(D, scaleAbout(S.head.pts, J.head, 1.4), W);
  const wingPts = S.wing.pts;
  const fillWing = STYLE.wing === "fill";
  poly(D, wingPts, fillWing ? G1 : W);
  const inWing = (i, j) => insidePoly(wingPts, i + 0.5, j + 0.5);
  const edges = [];
  for (let j = SPR.r0; j < SPR.r0 + SPR.h; j += 1) {
    for (let i = SPR.c0; i < SPR.c0 + SPR.w; i += 1) {
      if (!inWing(i, j)) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !inWing(i + dx, j + dy) && D.get(i + dx, j + dy) === W)) edges.push(i, j);
    }
  }
  for (let k = 0; k < edges.length; k += 2) D.put(edges[k], edges[k + 1], fillWing ? K : G1);
  outline(D);

  // bill and pouch
  const E = L.beak;
  poly(E, S.pouch.pts, YE, 0.2);
  poly(E, S.billLower.pts, OR, 0.2);
  seg(E, J.billBase, J.billTip, 0.95, OR);
  poly(E, S.billUpper.pts, OR, 0.3);
  outline(E);
  // the outline never covers the bird's eye
  const eye = [Math.floor(J.eye[0]), Math.floor(J.eye[1])];
  if (E.get(eye[0], eye[1]) === K) E.put(eye[0], eye[1], 0);

  const pix = mk();
  // the far stub lies over the frame (under the near leg), so it reads as one piece
  for (const layer of [L.bike, L.far]) {
    for (let k = 0; k < pix.d.length; k += 1) if (layer.d[k]) pix.d[k] = layer.d[k];
  }
  // the near leg is outlined all round, over the frame too, so thigh and shin
  // stand clear of the red tubes; then the pedal under the foot
  const nearEdge = [];
  for (let j = SPR.r0; j < SPR.r0 + SPR.h; j += 1) {
    for (let i = SPR.c0; i < SPR.c0 + SPR.w; i += 1) {
      if (L.near.get(i, j)) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => L.near.get(i + dx, j + dy))) nearEdge.push(i, j);
    }
  }
  for (let k = 0; k < pix.d.length; k += 1) if (L.near.d[k]) pix.d[k] = L.near.d[k];
  for (let k = 0; k < nearEdge.length; k += 2) pix.put(nearEdge[k], nearEdge[k + 1], K);
  // the pedal lies over everything but the foot itself
  for (const [i, j, v] of pedal) if (pix.get(i, j) !== OR) pix.put(i, j, v);
  for (let k = 0; k < pix.d.length; k += 1) if (L.bird.d[k]) pix.d[k] = L.bird.d[k];
  // the bill sits straight against the white head: no outline across the face
  const hr = 0.37 * (WHEEL_R / U) * 1.4 + 0.6;
  for (let k = 0; k < pix.d.length; k += 1) {
    const v = E.d[k];
    if (!v) continue;
    if (v === K && (pix.d[k] === W || pix.d[k] === G1)) {
      const i = SPR.c0 + (k % SPR.w);
      const j = SPR.r0 + Math.floor(k / SPR.w);
      if (Math.hypot(i + 0.5 - J.head[0], j + 0.5 - J.head[1]) < hr) continue;
    }
    pix.d[k] = v;
  }
  // the eye: one dark pixel in the white of the head, white on all four sides,
  // set back from the bill so it reads as an eye and not as part of the bill
  const want = [J.head[0] + 0.3, J.head[1] - 0.5];
  let best = null;
  let bd = Infinity;
  for (let j = Math.floor(J.head[1]) - 5; j <= Math.floor(J.head[1]) + 5; j += 1) {
    for (let i = Math.floor(J.head[0]) - 5; i <= Math.floor(J.head[0]) + 5; i += 1) {
      if (pix.get(i, j) !== W) continue;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => pix.get(i + dx, j + dy) === W)) continue;
      const d = Math.hypot(i + 0.5 - want[0], j + 0.5 - want[1]);
      if (d < bd) {
        bd = d;
        best = [i, j];
      }
    }
  }
  if (best) pix.put(best[0], best[1], K);
  return { pix, skel, layers: L };
}

/** Look switches, for the lab. */
const STYLE = { wing: "line" };

const FRAMES = 8;
/** Pedal frame (0..7) for a crank angle; frame 0 = right pedal at the top. */
const frameOf = (crank) => ((Math.round(crank / (Math.PI / 4)) % FRAMES) + FRAMES) % FRAMES;

function buildSprite(kind, n) {
  if (kind === "ride" || kind === "squash") {
    const crank = (n * Math.PI) / 4;
    // the squash frame: the bird pressed down three art pixels and widened
    const { pix } = rasterPelican(crank, { spoke: (n * Math.PI) / 8, squash: kind === "squash" ? 3 : 0 });
    return pix;
  }
  // in the air: pedals level, legs tucked, neck stretched up to the coin
  const { pix } = rasterPelican(Math.PI / 2, { spoke: Math.PI / 8, act: { bob: 0, neckStretch: 0.9, headPitch: 0.22, beakOpen: 0.12, wing: 0.25, tail: 0.15 } });
  return pix;
}

// ---------------------------------------------------------------- HUD

// HUD icons, in the HUD's own three colours (K, white, yellow)
// the token: round, gold, stamped with a dark fish (tail left, head right)
const ICON_COIN = [".KKKKKKKK.", "KYYYYYYYYK", "KYKYKKKYYK", "KYYKKKWKYK", "KYKYKKKYYK", "KYYYYYYYYK", ".KKKKKKKK."];
const ICON_HEAD = ["..KKK.....", ".KWWWK....", "KWWKWKKKK.", "KWWWYYYYYK", ".KWWYYYYK.", ".KWWKYYK..", "..KK.KK..."];

function buildHud(after, blink, compact) {
  const pix = new Pix(-101, -87, 203, 10);
  const r = -86;
  const lit = after && blink ? YE : W;
  const score = after ? "016100" : "016000";
  const coins = after ? "×00" : "×99";
  const lives = after ? "×03" : "×02";
  if (!compact) {
    // white letters, each with a one-pixel dark ring, so whatever passes behind
  // the HUD (the sign's chains, gulls, sparks) never runs through a glyph
    let x = drawText(pix, "SCORE", -96, r, W, K, SKY1);
    drawText(pix, score, x + 3, r, after && blink ? YE : W, K, SKY1);
    x = 3;
    pix.art(x, r, ICON_COIN);
    x = drawText(pix, coins, x + ICON_COIN[0].length + 2, r, lit, K, SKY1);
    // the right-hand group ends 2 art pixels (6 units) inside the view's
    // right edge at zoom 1.1 (column 101): its last ring is column 98
    x = drawText(pix, "PIER 16", x + 4, r, W, K, SKY1);
    pix.art(x + 2, r, ICON_HEAD);
    drawText(pix, lives, x + 13, r, lit, K, SKY1);
  } else {
    // the gallery still is a square crop: keep the three counters that change, centred
    const parts = [textWidth(score), 6, ICON_COIN[0].length, 1, textWidth(coins), 6, ICON_HEAD[0].length, 1, textWidth(lives)];
    let x = -Math.floor(parts.reduce((a, b) => a + b, 0) / 2);
    drawText(pix, score, x, r, W, K, SKY1);
    x += parts[0] + parts[1];
    pix.art(x, r, ICON_COIN);
    x += parts[2] + parts[3];
    drawText(pix, coins, x, r, W, K, SKY1);
    x += parts[4] + parts[5];
    pix.art(x, r, ICON_HEAD);
    x += parts[6] + parts[7];
    drawText(pix, lives, x, r, W, K, SKY1);
  }
  return pix;
}

// ---------------------------------------------------------------- actors (per frame)

// the collectable: a round gold token (10 art pixels) stamped with a brown fish,
// turning in four frames: face, narrow, edge, plain back
const COIN = [
  ["...KKKK...", ".KKYYYYKK.", ".KYYYYYYK.", "KYbYbbbYYK", "KYYbbbYbYK", "KYbYbbbYYK", "KYYYYYYYYK", ".KYYYYYYK.", ".KKYYYYKK.", "...KKKK..."],
  ["....KK....", "...KYYK...", "..KYYYYK..", "..KbYbbK..", "..KYbbbK..", "..KbYbbK..", "..KYYYYK..", "..KYYYYK..", "...KYYK...", "....KK...."],
  ["....KK....", "....KK....", "....YK....", "....YK....", "....YK....", "....YK....", "....YK....", "....YK....", "....KK....", "....KK...."],
  ["....KK....", "...KYYK...", "..KYYYYK..", "..KYYYYK..", "..KYYYYK..", "..KYYYYK..", "..KYYYYK..", "..KYYYYK..", "...KYYK...", "....KK...."],
];
const SPARK = [
  ["....Y....", "....W....", "..W.W.W..", "...WWW...", "YWWWYWWWY", "...WWW...", "..W.W.W..", "....W....", "....Y...."],
  [".W.....W.", "WYW...WYW", ".W.....W.", ".........", "....Y....", ".........", ".W.....W.", "WYW...WYW", ".W.....W."],
  ["W.......W", ".........", ".........", ".........", "....W....", ".........", ".........", ".........", "W.......W"],
  [".........", ".........", ".........", ".........", ".........", ".........", ".........", ".........", "........."],
];
const SPARK_MAP = { ".": 0, W, Y: YE };
const GULL = [
  ["KK.....KK", "..K...K..", "...KWK...", "....K...."],
  [".........", "KKK...KKK", "...KWK...", "....K...."],
];

/** The life-ring under the deck: K, red and white, a sprite of its own. */
function drawRing(pix) {
  const rc = RING_C;
  const rr = 15;
  for (let y = -5; y <= 5; y += 1) {
    for (let x = -5; x <= 5; x += 1) {
      const d = Math.hypot(x, y);
      if (d > 5.3) continue;
      const band = Math.abs(Math.sin(2 * Math.atan2(y, x))) > 0.9;
      if (d > 4.4) pix.put(rc + x, rr + y, K);
      else if (d > 2.3) pix.put(rc + x, rr + y, band ? W : RED);
      else if (d > 1.4) pix.put(rc + x, rr + y, K);
    }
  }
}

function drawActors(pix, u, still, pop) {
  drawRing(pix);
  const tick = Math.floor(stepTime(u, HZ) * HZ + 1e-6);
  // gulls, far above the road, drifting left in 8 Hz steps
  const ut = stepTime(u, HZ);
  for (const [x0, r, v, ph] of [[640, -62, 14, 0], [780, -67, 11, 1], [1180, -63, 16, 0], [-40, -66, 12, 1]]) {
    const c = Math.round((x0 - v * ut) / U);
    pix.art(c - 4, r, GULL[(tick + ph) >> 1 & 1]);
  }
  // the coin, until the pelican's head reaches it
  if (u < T_APEX - 1e-6) {
    pix.art(COIN_C, COIN_R, COIN[tick & 3]);
  }
  if (u >= T_APEX - 1e-6) {
    // +100 below and to the left, clear of the bird; one row above where it
    // was, so no cloud bar (rows -65/-64, -60/-59) lies level with or next to
    // the arms of the "+": they pass one row clear of its tips, above or below
    if (u < T_APEX + 0.75) {
      const pc = COIN_C - 40;
      const pr = COIN_R + 13;
      drawText(pix, "+100", pc, pr, W, K);
      // the sky's cloud bars drift behind this spot (the sky hardly moves, the number is fixed in the world),
      // and a bar that ends against the "+" reads as a minus sign or a streak: so the number carries two
      // pixels of plain sky round its ring, and a cloud passes behind it without touching it
      const pw = textWidth("+100");
      const ink = [];
      for (let j = pr - 1; j <= pr + 7; j += 1) for (let i = pc - 1; i <= pc + pw; i += 1) if (pix.get(i, j)) ink.push(i, j);
      for (let n = 0; n < ink.length; n += 2) {
        for (let dj = -2; dj <= 2; dj += 1) for (let di = -2; di <= 2; di += 1) if (!pix.get(ink[n] + di, ink[n + 1] + dj)) pix.put(ink[n] + di, ink[n + 1] + dj, SKY1);
      }
    }
    // 1UP appears at the token's spot, just left of it (token columns COIN_C..COIN_C+9,
    // rows COIN_R..COIN_R+9: at the apex the pelican's head is on that spot, and the word
    // must be whole on the beat and in the gallery still, so it stands beside the head and
    // not behind it), and rises straight up from there, blinking; it stops two rows
    // higher, just under the HUD's ring
    if (u < T_APEX + 1.0) {
      const k8 = Math.max(0, Math.floor((u - T_APEX) * HZ + 1e-6));
      const w = textWidth("1UP");
      const c = COIN_C + 5 - Math.floor(w / 2) - UP_LEFT;
      const r = COIN_R + 2 - Math.min(2, k8);
      // the token bursts in a ring of sparks round the spot, then nothing
      const k = Math.floor((u - T_APEX) * HZ + 1e-6);
      if (k < 2) pix.art(COIN_C, COIN_R, SPARK[k + 1], SPARK_MAP);
      // 1UP goes on its own layer under the sprite, so the pelican is drawn over
      // it and the head stays whole; the sparks stay over the pelican but never
      // over a 1UP cell (as before, when 1UP was drawn over them)
      drawText(pop, "1UP", c, r, tick & 1 ? GR : W, K);
      for (let j = r - 1; j <= r + 7; j += 1) for (let i = c - 1; i <= c + w; i += 1) if (pop.get(i, j)) pix.put(i, j, 0);
    }
  }
  // landing: two dust pixels kicked out from the wheels
  if (u >= T_LAND - 1e-6 && u < T_LAND + 0.25) {
    const k = Math.floor((u - T_LAND) * HZ + 1e-6);
    const x = landX();
    const rear = Math.floor((x - 31.8) / U) - 8 - k;
    const front = Math.floor((x + 31.8) / U) + 8 + k;
    // one dust pixel kicked out behind each wheel, a lighter one trailing it
    pix.put(rear, -1 - k, W);
    pix.put(front, -1 - k, W);
    if (k === 0) {
      pix.put(rear + 1, -1, G1);
      pix.put(front - 1, -1, G1);
    }
  }
}
const landX = () => (1000 / 6) * T_LAND;

// ---------------------------------------------------------------- compositing shader

const NL = 10;
const FRAG = `${FRAG_HEAD}
uniform vec2 uRes;
uniform vec3 uView;   // k, tx, ty: world -> target pixels
uniform float uPel;   // pelican road x (the camera's centre column)
uniform vec3 uBase;
${Array.from({ length: NL }, (_, i) => `uniform sampler2D uT${i};\nuniform vec4 uL${i};`).join("\n")}

vec4 fetchT(sampler2D t, ivec2 c, ivec2 sz) {
  if (c.x < 0 || c.y < 0 || c.x >= sz.x || c.y >= sz.y) return vec4(0.0);
  vec4 v = texelFetch(t, c, 0);
  return vec4(v.rgb * v.a, v.a);
}

// Sample a palette image texel by texel. Away from a texel edge the colour is
// exact; across an edge it blends over exactly one target pixel.
vec4 layer(sampler2D t, vec4 L, vec2 w, float d) {
  if (L.w < 0.5) return vec4(0.0);
  vec2 a = vec2((w.x - L.z * uPel) / ${U}.0 - L.x, (w.y - ${ROAD}.0) / ${U}.0 - L.y);
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
  float d = 1.0 / (${U}.0 * uView.x);
  vec4 col = vec4(uBase, 1.0);
  vec4 c;
${Array.from({ length: NL }, (_, i) => `  c = layer(uT${i}, uL${i}, w, d); col = c + col * (1.0 - c.a);`).join("\n")}
  fragColor = vec4(col.rgb, 1.0);
}`;

// ---------------------------------------------------------------- caches (per stage)

const CACHE = new WeakMap();
function cacheFor(stage) {
  let c = CACHE.get(stage);
  if (!c) {
    c = { layers: new Map() };
    CACHE.set(stage, c);
  }
  return c;
}

/** A Layer2D holding an indexed image, built once. */
function baked(stage, key, build) {
  const cache = cacheFor(stage);
  let entry = cache.layers.get(key);
  if (!entry) {
    const pix = build();
    const layer = new Layer2D(stage.p, pix.w, pix.h);
    upload(layer, pix);
    entry = { layer, c0: pix.c0, r0: pix.r0 };
    cache.layers.set(key, entry);
  }
  return entry;
}

function hexRgb(h) {
  const v = parseInt(h.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

// ---------------------------------------------------------------- the scene

/** Height of the jump in whole art pixels. */
export function jumpRows(u) {
  if (u <= T_JUMP || u >= T_LAND) return 0;
  const s = u - T_JUMP;
  return Math.round((JUMP_H * 4 * s * (1 - s)) / U);
}

const STILL_Y0 = 436; // world rows shown in the gallery still
const STILL_Y1 = 736;

export const pixel = {
  ...META,
  poseHz: HZ,
  still: { u: 3.05 },

  init(stage) {
    stage.shader("pixel/composite", VERT, FRAG);
    baked(stage, "sky", buildSky);
    baked(stage, "sea0", () => buildSea(0));
    baked(stage, "sea1", () => buildSea(1));
    baked(stage, "pier", buildPier);
    for (const fr of [0, 1]) for (const part of ["rock", "top", "boat"]) baked(stage, `mid${part}${fr}`, () => buildMid(fr, part));
    // every sprite frame up front, so no frame of the film pays for a first build
    for (let n = 0; n < FRAMES; n += 1) for (const kind of ["ride", "squash"]) baked(stage, `spr/${kind}/${n}`, () => buildSprite(kind, n));
    baked(stage, "spr/air/0", () => buildSprite("air", 0));
  },

  render(stage, f) {
    const u = f.u;
    const pel = f.pelican;
    const tick = Math.floor(stepTime(u, HZ) * HZ + 1e-6);
    const cache = cacheFor(stage);

    const sky = baked(stage, "sky", buildSky);
    const wave = Math.floor(stepTime(u, HZ) * 4 + 1e-6) & 1;
    const sea = baked(stage, `sea${wave}`, () => buildSea(wave));
    const pier = baked(stage, "pier", buildPier);
    const rock = baked(stage, `midrock${wave}`, () => buildMid(wave, "rock"));
    const top = baked(stage, `midtop${wave}`, () => buildMid(wave, "top"));
    const boat = baked(stage, `midboat${wave}`, () => buildMid(wave, "boat"));
    // the sea plane maps texel column a to world x = 3 (a + L.x) + 0.5 pel.x
    const boatL = (BOAT_REL(u) + SEA_P * pel.x) / U;

    // the sprite: which frame
    let kind = "ride";
    let n = frameOf(pel.crank);
    const airborne = u > T_JUMP + 1e-6 && u < T_LAND - 1e-6;
    if (airborne) {
      kind = "air";
      n = 0;
    } else if (u >= T_LAND - 1e-6 && u < T_LAND + 1 / HZ - 1e-6) {
      kind = "squash";
    }
    const spr = baked(stage, `spr/${kind}/${n}`, () => buildSprite(kind, n));
    const lift = jumpRows(u);

    // HUD
    const after = u >= T_APEX - 1e-6;
    const blink = after && u < T_APEX + 0.75 && (tick & 1) === 1;
    const hud = baked(stage, `hud/${after ? 1 : 0}${blink ? 1 : 0}${f.still ? "c" : ""}`, () => buildHud(after, blink, !!f.still));

    // actors on the world grid, covering what this view can see
    const b = f.view.bounds(f.w, f.h);
    const ac0 = Math.floor(b.x0 / U) - 4;
    let act = cache.act;
    const aw = Math.min(400, Math.max(64, Math.ceil(b.x1 / U) + 4 - ac0));
    if (!act || act.pix.w < aw) {
      const pix = new Pix(0, -96, Math.max(aw, 260), 132);
      act = { pix, layer: new Layer2D(stage.p, pix.w, pix.h) };
      cache.act = act;
    }
    act.pix.c0 = ac0;
    act.pix.clear();
    // the 1UP's own layer, under the sprite: same grid and size as the actors
    let pop = cache.pop;
    if (!pop || pop.pix.w !== act.pix.w) {
      const pix = new Pix(0, act.pix.r0, act.pix.w, act.pix.h);
      pop = { pix, layer: new Layer2D(stage.p, pix.w, pix.h) };
      cache.pop = pop;
    }
    pop.pix.c0 = ac0;
    pop.pix.clear();
    drawActors(act.pix, u, f.still, pop.pix);
    upload(act.layer, act.pix);
    upload(pop.layer, pop.pix);

    const blank = cache.blank || (cache.blank = baked(stage, "blank", () => new Pix(0, 0, 1, 1)));
    const show = pel.visible !== false;
    const layers = [
      { e: sky, p: SKY_P },
      { e: sea, p: SEA_P },
      { e: rock, p: SEA_P },
      { e: top, p: SEA_P },
      { e: boat, p: SEA_P, dc: boatL },
      { e: pier, p: 1 },
      { e: { layer: pop.layer, c0: pop.pix.c0, r0: pop.pix.r0 }, p: 1 },
      { e: show ? spr : blank, p: 0, dr: -lift, on: show },
      { e: { layer: act.layer, c0: act.pix.c0, r0: act.pix.r0 }, p: 1 },
      { e: hud, p: 0, on: true },
    ];

    // The gallery still frames the jump: from just above the HUD row to just
    // under the deck, centred on the rider, so the take-off, the arc, the gap
    // and the landing fill the square and the sign is wholly out of it.
    let view = [f.view.k, f.view.tx, f.view.ty];
    if (f.still) {
      const k = f.h / (STILL_Y1 - STILL_Y0);
      view = [k, f.w / 2 - pel.x * k, -STILL_Y0 * k];
    }
    const sh = stage.shader("pixel/composite", VERT, FRAG);
    const uni = {
      uRes: [f.w, f.h],
      uView: view,
      uPel: pel.x,
      uBase: hexRgb(HEX[SKY2]),
    };
    layers.forEach((L, i) => {
      uni[`uT${i}`] = L.e.layer.img;
      // the sprite and HUD ride with the pelican: their column origin follows its road x
      const c0 = L.p === 0 ? L.e.c0 + 0 : L.e.c0;
      uni[`uL${i}`] = [c0 + (L.dc || 0), L.e.r0 + (L.dr || 0), 1 - L.p, L.on === false ? 0 : 1];
    });
    stage.origin();
    stage.shaderRect(sh, uni, 0, 0, f.w, f.h);
  },
};

/** For the lab (dev/experiments/pixel-*.js) only. */
export const pixelDev = { STYLE, buildSky, buildSea, buildMid, buildPier, rasterPelican, buildSprite, buildHud, HEX };
