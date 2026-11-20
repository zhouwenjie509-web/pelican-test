// Section 20 · 代码美学 · Code Aesthetics
//
// The film's last answer: a calm, dark code editor that travels with the
// pelican. On the left a canvas (world-fixed dot grid, ruler, ground line)
// holds the drawing; on the right a language model writes the SVG for it in
// small bursts. Each time a line of code is finished it is marked once with
// the accent and the part of the puppet it describes is drawn.
//
// Layout: world units relative to the anchor a (see anchorAt), drawn through
// f.view, never from f.w / f.h. All chrome is drawn in target pixels with
// edges snapped to whole pixels, so hairlines are one pixel at 1080p and text
// sprites land 1:1 at the hold zoom. Text is cached in sprites per "level"
// (pixels per unit), keyed with stage.s.
//
//   y 410-474  top bar: the window title (代码美学 · Code Aesthetics) from a+96, its ink
//              centred in the part of the bar in view (y 439-474)
//   y 474-748  canvas  a-440 … a+84  (ruler 474-486, dot grid, ground y 700)
//              divider a+84
//              code pane a+84 … a+360 (tab row 474-493, gutter to a+104, code from a+110,
//              so a 35-character line ends by a+287)
//   y 748-810  status bar (left: SVG · UTF-8, then ✓ 20 / 20; right: the date line, right-
//              aligned at a+288, its ink centred in the part in view, y 748-780)
//
// The drawing itself lives in rig/skins/code.js behind drawCodeFigure().
// TIMING (exported) is the one table of when each line completes and what it owns.

import { sectionMeta } from "./sections.js";
import { solveRig } from "../rig/rig.js";
import { drawCodeFigure } from "../rig/skins/code.js";
import { sprite } from "../kit/text.js";
import { rng } from "../kit/rng.js";
import { clamp, lerp, smoothstep, smootherstep } from "../beat/ease.js";
import { PX_PER_UNIT, ZOOM_IN, ROAD_Y } from "../main/layout.js";

const META = sectionMeta(20);

// ---------------------------------------------------------------- the source

/** The SVG the model writes. Real, well-formed, every line ≤ 35 characters. */
export const SOURCE = [
  "<!-- a pelican riding a bicycle -->",
  '<svg viewBox="0 0 80 60"',
  'fill="none"',
  'style="background:#0f1218"',
  'xmlns="http://www.w3.org/2000/svg">',
  '<g stroke="#2b2f3a">',
  '  <circle cx="25" cy="44" r="7.5"/>',
  '  <circle cx="49" cy="44" r="7.5"/>',
  "</g>",
  '<g stroke="#3fd0c0">',
  '  <path d="M31 32l4 14-10-2 7-9"/>',
  '  <path d="M35 46l11-10-1-3-13 2"/>',
  '  <path d="M45 33 49 44"/>',
  '  <path d="M28 32h5m9-3h4l-1 4"/>',
  '  <circle cx="35" cy="46" r="2"/>',
  "</g>",
  '<g fill="#f4f1ea">',
  '  <path d="M20 31l4-2q0-12 15-11',
  '    q5 0 5 6q-4 10-20 7z"/>',
  '  <path d="M37 20q-4-8 4-12l1 2',
  '    q-5 4-1 8z"/>',
  '  <circle cx="43" cy="7" r="3"/>',
  '  <circle cx="44" cy="6.6" r=".8"',
  '    fill="#222"/>',
  '  <path fill="#f2a23a"',
  '    d="M45 6l16 5v1l-16-4z"/>',
  '  <path fill="#f7c66b"',
  '    d="M45 8l15 4q-10 4-15-4z"/>',
  '  <path fill="#d2d5da"',
  '    d="M36 20q6 3 6 9l-17 2z"/>',
  "</g>",
  '<path stroke="#e2783a" d="M32 33',
  '  l-2 7 8 5m-6-12-7 4 6 8"/>',
  '<ellipse cx="37" cy="52" rx="18"',
  '  ry="2" fill="#000" opacity=".2"/>',
  "<!-- 20 / 20 -->",
  "</svg>",
];

/**
 * What each line owns. Entries are rig shape ids ("tireRear"), id prefixes
 * ("spokeRear*") or the pseudo-part "shadow". A part belongs to the LAST line
 * of its element, so it is drawn only once the element is complete. Lines
 * with no entry draw nothing.
 */
const OWNS = {
  4: ["@grid"], // the <svg> tag closes on its xmlns line
  6: ["tireRear", "rimRear", "spokeRear*", "valveRear", "hubRear"],
  7: ["tireFront", "rimFront", "spokeFront*", "valveFront", "hubFront"],
  10: ["chainStay", "seatStay", "seatTube"],
  11: ["downTube", "topTube"],
  12: ["headTube", "fork"],
  13: ["seatPost", "saddle", "stem", "bar", "grip", "bell"],
  14: ["ring", "cog", "chainTop", "chainBottom", "crankNear", "crankFar", "pedalNear", "pedalFar"],
  18: ["body", "tail*"], // the body's path carries the tail
  20: ["neck"],
  21: ["head", "crest*"],
  23: ["eye", "pupil", "lid"],
  25: ["billUpper", "billLower"],
  27: ["pouch"],
  29: ["wing", "wingTip*", "wingHand*", "wingFold"],
  32: ["leg*", "foot*"],
  34: ["shadow"],
};

/**
 * Lines that must complete on a given moment (0-based index -> u). Between
 * two anchors every chunk takes the same time, so the model writes at an even
 * rate and only pauses (BREATH) where an element or tag ends.
 *
 *   0.15  the request (line 1), begun at u = -0.1 so it is being written as the pelican enters
 *   1.8   the chainring: its strokes have run round and its pedals fill as the bicycle's group closes
 *   2.0   </g>: the bicycle is complete on the strong beat
 *   3.0   the bill (its fill="#f2a23a" is the line just before)
 *   3.7   the legs: drawn over REVEAL, so the pelican is whole on the downbeat (4.0)
 *   4.6   </svg>: the file closes
 * After the legs the model pauses (EXTRA_BREATH) before the shadow, so the
 * close is written at the same pace as the rest.
 */
const ANCHORS = [
  [0, 0.15],
  [14, 1.8],
  [15, 2.0],
  [25, 3.0],
  [32, 3.7],
  [36, 4.6],
];
const STREAM_START = -0.1; // the pane is empty, its caret blinking, until the first chunk
const BREATH = 0.012; // pause where an element or tag ends
const SOFT_BREATH = 0.004; // a continuation line: the model barely stops
const EXTRA_BREATH = { 33: 0.3 };
export const REVEAL = 0.3; // seconds a part takes to draw
const ACCENT_FADE = 0.42;
const CHECK_DRAW = 0.28;
const CHUNK_LEAD = 0.04; // a new chunk of text eases in (from 30 %) over this long, ending whole at its time

/** The pause before line i: short inside an element that runs on, longer where one ended. */
function breathBefore(lines, i) {
  if (i === 0) return 0;
  const prev = lines[i - 1].text;
  return (/>$/.test(prev) ? BREATH : SOFT_BREATH) + (EXTRA_BREATH[i] || 0);
}

function buildTiming() {
  const lines = SOURCE.map((text, i) => {
    if (text.length > 35) throw new Error(`code.js: line ${i + 1} is ${text.length} characters`);
    const indent = text.match(/^ */)[0].length;
    const body = text.length - indent;
    // chunks of 2..6 characters (mostly 5..6, as a model's tokens arrive), deterministic per line;
    // never a 1-character chunk
    const r = rng(2000 + i * 31);
    // as few chunks as fit (at most 6 characters each), then an uneven split: move a character
    // between neighbours so the bursts are irregular, never below 2 or above 6
    const n = Math.max(1, Math.ceil(body / 6));
    const sizes = [];
    for (let j = 0; j < n; j += 1) sizes.push(Math.floor(body / n) + (j < body % n ? 1 : 0));
    for (let j = 0; j + 1 < n; j += 1) {
      const m = Math.floor(r() * 3) - 1; // -1, 0 or +1 from chunk j to chunk j+1
      if (sizes[j] - m >= 2 && sizes[j] - m <= 6 && sizes[j + 1] + m >= 2 && sizes[j + 1] + m <= 6) {
        sizes[j] -= m;
        sizes[j + 1] += m;
      }
    }
    return { i, text, indent, sizes };
  });
  // solve: inside each anchored segment every chunk takes the same time
  let t0 = STREAM_START;
  let first = 0;
  const segments = [];
  for (const [last, tEnd] of ANCHORS) {
    let chunks = 0;
    let pauses = 0;
    for (let i = first; i <= last; i += 1) {
      chunks += lines[i].sizes.length;
      pauses += breathBefore(lines, i);
    }
    const dt = (tEnd - t0 - pauses) / chunks;
    if (!(dt > 0)) throw new Error("code.js: timing does not fit");
    segments.push({ first, last, dt, rate: 1 / dt });
    let t = t0;
    for (let i = first; i <= last; i += 1) {
      const L = lines[i];
      t += breathBefore(lines, i);
      L.start = t;
      L.times = L.sizes.map((_, j) => t + (j + 1) * dt);
      t = L.times[L.times.length - 1];
      L.done = t;
    }
    // the anchored line lands exactly on its moment (no floating-point drift)
    lines[last].times[lines[last].times.length - 1] = tEnd;
    lines[last].done = tEnd;
    t0 = tEnd;
    first = last + 1;
  }
  // cumulative character counts per chunk, for the written prefix
  for (const L of lines) {
    let c = L.indent;
    L.cum = L.sizes.map((n) => (c += n));
    L.owns = OWNS[L.i] || [];
    // the accent marks a line that makes something happen: a part, a closed group, the closed file
    L.marked = L.owns.length > 0 || /^\s*<\/(g|svg)>$/.test(L.text);
  }
  return { lines, segments };
}

const BUILT = buildTiming();

/**
 * The timing table. TIMING.lines[i] = { i, text, indent, sizes, times, start,
 * done, owns }: `times` are the u of each chunk, `done` the u at which the
 * line is complete (= its last chunk), `owns` the rig parts it draws.
 */
export const TIMING = {
  lines: BUILT.lines,
  segments: BUILT.segments,
  start: STREAM_START,
  closed: BUILT.lines[BUILT.lines.length - 1].done,
  reveal: REVEAL,
  // the strong moments, for the soundtrack and the illustrator
  beats: { bicycle: BUILT.lines[14].done, bill: BUILT.lines[22].done, legs: BUILT.lines[31].done, pelican: BUILT.lines[32].done, closed: BUILT.lines[36].done },
};

/** Part times: shape id -> u, resolved against the puppet's real ids once. */
function buildPartTimes() {
  const probe = solveRig({ x: 0, y: ROAD_Y, scale: 21.2, crank: 0, wheel: 0, time: 0, act: { lid: 1 } });
  const byId = {};
  const byTag = {};
  let shadow = Infinity;
  let grid = Infinity;
  for (const L of TIMING.lines) {
    for (const entry of L.owns) {
      if (entry === "shadow") shadow = L.done;
      else if (entry === "@grid") grid = L.done;
      else if (entry.endsWith("*")) {
        const pre = entry.slice(0, -1);
        for (const sh of probe.shapes) if (sh.id.startsWith(pre)) byId[sh.id] = L.done;
      } else byId[entry] = L.done;
    }
  }
  for (const sh of probe.shapes) {
    if (byId[sh.id] === undefined) throw new Error(`code.js: no line owns ${sh.id}`);
    byTag[sh.tag] = Math.max(byTag[sh.tag] ?? -Infinity, byId[sh.id]);
  }
  return { byId, byTag, shadow, grid };
}

const PARTS = buildPartTimes();
export const PART_TIMES = {
  byId: PARTS.byId,
  byTag: PARTS.byTag,
  shadow: PARTS.shadow,
  reveal: REVEAL,
  ground: ROAD_Y,
  timeOf: (sh) => PARTS.byId[sh.id] ?? PARTS.byTag[sh.tag] ?? Infinity,
};

// ---------------------------------------------------------------- syntax colour

const C = {
  bg: "#0f1218",
  panel: "#141922",
  tabStrip: "#10141b",
  ruler: "#121720",
  rule: "#222a36",
  text: "#c9d1dc",
  punct: "#7d8899",
  tag: "#ff8f7a",
  attr: "#e6c07b",
  str: "#9ccf8a",
  num: "#f2a65a",
  comment: "#5f6b7c",
  accent: "#3fd0c0",
  gutter: "#3e4757",
  gutterOn: "#9aa5b5",
  lineOn: "#18202b",
  dot: "#343e4d",
  dotMajor: "#434e60",
  tick: "#2c3544",
  tickLabel: "#4b5666",
  ground: "#3a4454",
  chromeText: "#8f9aab",
  title: "#e3e8ef",
  titleEn: "#9aa5b5",
  date: "#a3aebd",
};

/**
 * Colour every character of the whole file with one pass of a small XML
 * lexer, so a half-written line already has its final colours.
 */
function highlight(lines) {
  const out = lines.map((l) => new Array(l.length).fill("text"));
  let state = "text"; // text | comment | tag | attrs | value
  let quote = "";
  let valueKind = "str";
  for (let li = 0; li < lines.length; li += 1) {
    const s = lines[li];
    const col = out[li];
    for (let i = 0; i < s.length; i += 1) {
      const ch = s[i];
      if (state === "comment") {
        col[i] = "comment";
        if (s.startsWith("-->", i)) {
          col[i + 1] = col[i + 2] = "comment";
          i += 2;
          state = "text";
        }
        continue;
      }
      if (state === "text") {
        if (s.startsWith("<!--", i)) {
          state = "comment";
          for (let j = 0; j < 4; j += 1) col[i + j] = "comment";
          i += 3;
        } else if (ch === "<") {
          col[i] = "punct";
          if (s[i + 1] === "/") {
            col[i + 1] = "punct";
            i += 1;
          }
          state = "tag";
        } else col[i] = "text";
        continue;
      }
      if (state === "tag") {
        if (/[A-Za-z]/.test(ch)) {
          col[i] = "tag";
          continue;
        }
        state = "attrs";
      }
      if (state === "attrs") {
        if (ch === ">" || (ch === "/" && s[i + 1] === ">")) {
          col[i] = "punct";
          if (ch === "/") {
            col[i + 1] = "punct";
            i += 1;
          }
          state = "text";
        } else if (ch === "=") col[i] = "punct";
        else if (ch === '"' || ch === "'") {
          col[i] = "str";
          quote = ch;
          valueKind = s[i + 1] === "#" ? "colour" : "mixed";
          state = "value";
        } else if (/[A-Za-z:-]/.test(ch)) col[i] = "attr";
        else col[i] = "text";
        continue;
      }
      if (state === "value") {
        if (ch === quote) {
          col[i] = "str";
          state = "attrs";
        } else if (valueKind === "colour") col[i] = "str";
        else col[i] = /[0-9.]/.test(ch) || (ch === "-" && /[0-9.]/.test(s[i + 1] || "")) ? "num" : "str";
      }
    }
  }
  return out;
}

const COLOURS = highlight(SOURCE);

// ---------------------------------------------------------------- layout (world units, x relative to a)

const ED = { x0: -440, x1: 360, y0: 410, y1: 810 };
const TOPBAR = { y0: 410, y1: 474 };
const CANVAS = { x0: -440, x1: 84, y0: 474, y1: 748 };
const RULER = { y0: 474, y1: 486 };
const DIVIDER = 84;
const PANE = { x0: 84, x1: 360 };
const TABROW = { y0: 474, y1: 493 };
const TAB = { x0: 84, x1: 168 };
const STATUS = { y0: 748, y1: 810 };
// the visible parts of the bars at zoom 1.1 (the view shows y 439 … 780); text is centred in them
const TOP_SEEN = { y0: 439, y1: 474 };
const STATUS_SEEN = { y0: 748, y1: 780 };
const GUTTER_R = 104; // line numbers end here (by a + 106, leaving air before the code)
const CODE_X = 110; // a 35-character line ends by a + 287
const CODE_PX = 8.4; // Menlo size in units
const PITCH = 46 / (PX_PER_UNIT * ZOOM_IN); // 14.52 units: exactly 46 px at the hold zoom
const CODE_TOP = 496.5; // top of the first line box
const BASE_IN_LINE = 10.3; // baseline below the line top
const MAX_ROW = 16; // the line being written never goes below this row (row 16 ends at y 743.3)
const TITLE_X = 96; // the title starts here (a+96), so 代码美学 stays whole in the gallery still
const TITLE_ZH = 16;
const TITLE_EN = 13;
const DATE_PX = 13;
const DATE_RIGHT = 288;
const STATUS_PX = 10.5;
const LEFT_ITEM_X = -288; // "SVG · UTF-8"
const CHECK_X = -166; // ✓ 20 / 20, inside the gallery still (a ± 176.5)
export const A_REST = 805.5;

const MONO = "Menlo, Monaco, monospace";
const SANS = "'Helvetica Neue', 'PingFang SC', sans-serif";
const HEI = "'PingFang SC', 'Helvetica Neue', sans-serif";

const GRID_X0 = -80; // world extent of the baked grid and ruler
const GRID_X1 = 1120;

/** The editor's anchor. */
export function anchorAt(u, pelicanX) {
  if (u <= 6) return pelicanX;
  return lerp(1000, A_REST, smootherstep(6.0, 6.6, u));
}

// ---------------------------------------------------------------- streaming state (pure functions of u)

/** Characters of line i written by time u. */
function written(L, u) {
  if (u < L.times[0]) return 0;
  // binary search would be overkill: lines have at most ~9 chunks
  let n = 0;
  for (let j = 0; j < L.times.length; j += 1) if (u >= L.times[j]) n = L.cum[j];
  return n;
}

/** Where the caret is: line index and column. */
function caretAt(u) {
  const lines = TIMING.lines;
  let line = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (u >= lines[i].done && i < lines.length - 1) line = i + 1; // the newline comes with the last chunk
  }
  if (u >= lines[lines.length - 1].done) return { line: lines.length - 1, col: SOURCE[lines.length - 1].length };
  // on a new line the caret waits at its indent, as an editor auto-indents
  return { line, col: Math.max(lines[line].indent, written(lines[line], u)) };
}

/** Rows scrolled (smooth, one line at a time). */
function scrollAt(u) {
  let s = 0;
  const last = TIMING.lines.length - 1;
  for (let i = MAX_ROW + 1; i < TIMING.lines.length; i += 1) {
    let t = TIMING.lines[i - 1].done; // the newline that moves the caret onto row i
    // the last row (</svg>) scrolls in early, so it is in place, whole, when the file closes
    if (i === last) t = Math.min(t, TIMING.closed - 0.17);
    s += smootherstep(t, t + 0.17, u);
  }
  return s;
}

function caretAlpha(u) {
  if (u >= TIMING.closed) return 1; // steady once the file is closed
  if (u >= STREAM_START - 0.05) return 1; // solid while text is arriving
  const ph = ((u % 1) + 1) % 1; // blinks at 1 Hz, on with the beat
  return 1 - smoothstep(0.46, 0.54, ph) + smoothstep(0.96, 1.0, ph);
}

// the mark is already there on the frame its line completes (85 %), firms up, then fades over
// ACCENT_FADE, quickly at first, so the newest mark always reads stronger than the one before it
const accentEnv = (dt) => {
  if (dt < 0 || dt > ACCENT_FADE) return 0;
  const tail = 1 - smoothstep(0.04, ACCENT_FADE, dt);
  return (0.85 + 0.15 * smoothstep(0, 0.04, dt)) * tail * tail;
};

// ---------------------------------------------------------------- pixels

function hexRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
const RGB = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, hexRgb(v)]));

/** Pixels per unit at which text sprites are drawn for this view. */
function levelFor(k, s) {
  const hold = PX_PER_UNIT * ZOOM_IN * s;
  const rest = PX_PER_UNIT * s;
  if (Math.abs(k - hold) < 1e-6 * hold) return hold;
  if (Math.abs(k - rest) < 1e-6 * rest) return rest;
  if (k > rest && k < hold) return hold; // zooming: scale the hold-zoom sprites down a little
  if (k < rest) {
    // the pull-back to the gallery wall changes k every frame: use a short ladder of
    // levels (each 1/√2 of the last) and scale down by at most √2, so sprites and the
    // grid are rasterised a handful of times, not once per frame
    let lv = rest;
    while (lv * Math.SQRT1_2 >= k) lv *= Math.SQRT1_2;
    return lv;
  }
  return Math.round(k * 1000) / 1000;
}

/** A text sprite: { layer, w, h, ox, oy } with (ox, oy) the text origin in sprite pixels. */
function textSprite(stage, key, L, wUnits, padUnits, draw) {
  const pad = Math.ceil(padUnits * L);
  const w = Math.ceil(wUnits * L) + 2 * pad;
  const h = Math.ceil(30 * L);
  const oy = Math.round(20 * L);
  const layer = sprite(stage, key, w, h, (ctx) => draw(ctx, pad, oy));
  return { layer, w, h, ox: pad, oy };
}

export const code = {
  ...META,
  still: { u: 4.833 },

  render(stage, f) {
    const { p } = stage;
    const view = f.view;
    const k = view.k;
    const s = f.s;
    const u = f.u;
    // the editor's own clock: the gallery still shows the editor at rest
    const ue = f.still ? 7.0 : u;
    const a = f.still ? A_REST : anchorAt(u, f.pelican.x);
    const L = levelFor(k, s);
    const r = k / L;
    const crisp = Math.abs(r - 1) < 1e-6;
    const lkey = `${Math.round(L * 1000)}`;

    const X = (dx) => view.x(a + dx);
    const Y = (wy) => view.y(wy);
    const RX = (dx) => Math.round(X(dx));
    const RY = (wy) => Math.round(Y(wy));
    const hair = Math.max(1, Math.round(s)); // a hairline: one pixel at 1080p
    const hairA = Math.min(1, s / hair + 0.0001);

    const fillRect = (x0, y0, x1, y1, rgb, alpha = 1) => {
      if (x1 <= x0 || y1 <= y0 || alpha <= 0.002) return;
      p.noStroke();
      p.fill(rgb[0], rgb[1], rgb[2], 255 * alpha);
      p.rect(x0, y0, x1 - x0, y1 - y0);
    };
    const box = (dx0, y0, dx1, y1, rgb, alpha = 1) => fillRect(RX(dx0), RY(y0), RX(dx1), RY(y1), rgb, alpha);
    const hline = (wy, dx0, dx1, rgb, alpha = 1) => {
      const y = Math.floor(Y(wy));
      fillRect(RX(dx0), y, RX(dx1), y + hair, rgb, alpha * hairA);
    };
    const vline = (dx, y0, y1, rgb, alpha = 1) => {
      const x = Math.floor(X(dx));
      fillRect(x, RY(y0), x + hair, RY(y1), rgb, alpha * hairA);
    };
    /** Draw a sprite with its text origin at pixel (px, py), cropped to clip, tinted. */
    const blit = (spr, px, py, { clip = null, alpha = 1, tint = null } = {}) => {
      if (alpha <= 0.002) return;
      let dx = px - spr.ox * r;
      let dy = py - spr.oy * r;
      if (crisp) {
        dx = Math.round(dx);
        dy = Math.round(dy);
      }
      let x0 = dx;
      let y0 = dy;
      let x1 = dx + spr.w * r;
      let y1 = dy + spr.h * r;
      if (clip) {
        x0 = Math.max(x0, clip.x0);
        y0 = Math.max(y0, clip.y0);
        x1 = Math.min(x1, clip.x1);
        y1 = Math.min(y1, clip.y1);
      }
      if (x1 <= x0 || y1 <= y0) return;
      const sx = (x0 - dx) / r;
      const sy = (y0 - dy) / r;
      const t = tint || [255, 255, 255];
      p.tint(t[0], t[1], t[2], 255 * alpha);
      p.image(spr.layer.img, x0, y0, x1 - x0, y1 - y0, sx, sy, (x1 - x0) / r, (y1 - y0) / r);
      p.noTint();
    };

    stage.origin();
    p.noStroke();
    // the whole target first, so nothing is ever transparent
    fillRect(0, 0, f.w, f.h, RGB.bg);

    // ------------------------------------------------ panels
    box(ED.x0, TOPBAR.y0, ED.x1, TOPBAR.y1, RGB.panel);
    box(PANE.x0, TABROW.y1, PANE.x1, STATUS.y0, RGB.panel);
    box(PANE.x0, TABROW.y0, PANE.x1, TABROW.y1, RGB.tabStrip);
    box(TAB.x0, TABROW.y0, TAB.x1, TABROW.y1, RGB.panel);
    box(ED.x0, STATUS.y0, ED.x1, ED.y1, RGB.panel);
    box(CANVAS.x0, RULER.y0, DIVIDER, RULER.y1, RGB.ruler);

    // ------------------------------------------------ canvas: grid and ruler fixed in the world
    const gridKey = `code/grid/${lkey}`;
    const gw = Math.ceil((GRID_X1 - GRID_X0) * L);
    const gh = Math.ceil((CANVAS.y1 - RULER.y0) * L);
    const grid = stage.bake2d(gridKey, gw, gh, (ctx) => paintGrid(ctx, L, s));
    let gox = view.x(GRID_X0);
    let goy = view.y(RULER.y0);
    if (crisp) {
      gox = Math.round(gox);
      goy = Math.round(goy);
    }
    const cx0 = Math.max(RX(CANVAS.x0), Math.ceil(gox));
    const cx1 = Math.min(Math.floor(X(DIVIDER)), Math.floor(gox + gw * r));
    const gridPart = (y0px, y1px, alpha) => {
      if (cx1 <= cx0 || y1px <= y0px) return;
      p.tint(255, 255 * alpha);
      p.image(grid, cx0, y0px, cx1 - cx0, y1px - y0px, (cx0 - gox) / r, (y0px - goy) / r, (cx1 - cx0) / r, (y1px - y0px) / r);
      p.noTint();
    };
    const rulerBottom = Math.floor(Y(RULER.y1));
    gridPart(RY(RULER.y0), rulerBottom, 1);
    // when the <svg> tag closes the dots brighten by about 12 % of full scale, eased over 0.3 s
    const gridLift = smootherstep(PARTS.grid, PARTS.grid + 0.3, ue);
    gridPart(rulerBottom + hair, RY(CANVAS.y1), lerp(0.4, 1, gridLift));
    hline(RULER.y1, CANVAS.x0, DIVIDER, RGB.rule);
    // ground line
    hline(ROAD_Y, CANVAS.x0, DIVIDER, RGB.ground, lerp(0.8, 1, gridLift));

    // ------------------------------------------------ the drawing
    if (f.pelican.visible) {
      const skel = solveRig({ ...f.pelican });
      drawCodeFigure(stage, f, skel, PART_TIMES);
      stage.origin();
    }

    // ------------------------------------------------ rules
    hline(TOPBAR.y1, ED.x0, ED.x1, RGB.rule);
    vline(DIVIDER, TOPBAR.y1, STATUS.y0, RGB.rule);
    hline(STATUS.y0, ED.x0, ED.x1, RGB.rule);
    hline(TABROW.y1 - 1 / k, TAB.x1, PANE.x1, RGB.rule); // under the strip, not under the open tab
    vline(TAB.x1, TABROW.y0, TABROW.y1, RGB.rule);
    // the open tab's accent: a 2 px teal line along its top
    {
      const y = Math.floor(Y(TABROW.y0)) + hair;
      fillRect(Math.floor(X(TAB.x0)) + hair, y, Math.floor(X(TAB.x1)), y + 2 * hair, RGB.accent, 0.9 * hairA);
    }

    // ------------------------------------------------ code pane
    // a chunk eases in over CHUNK_LEAD before its time, so at its time it is whole
    const uw = ue + CHUNK_LEAD;
    const caret = caretAt(uw);
    const scroll = scrollAt(ue);
    // rows scroll out under a fixed top margin, so no sliver of a row above the first is ever left showing
    const clip = { x0: Math.floor(X(DIVIDER)) + hair, y0: RY(CODE_TOP), x1: RX(PANE.x1), y1: Math.floor(Y(STATUS.y0)) };
    const rowTop = (i) => Math.round(Y(CODE_TOP + (i - scroll) * PITCH));
    const pitchPx = (i) => rowTop(i + 1) - rowTop(i);
    const adv = monoAdvance(stage, L); // sprite pixels per character
    // current line highlight
    {
      const y0 = Math.max(clip.y0, rowTop(caret.line));
      const y1 = Math.min(clip.y1, rowTop(caret.line + 1));
      fillRect(clip.x0, y0, clip.x1, y1, RGB.lineOn);
    }
    // accent bands on lines just completed
    for (const Ln of TIMING.lines) {
      const e = Ln.marked ? accentEnv(ue - Ln.done) : 0;
      if (e <= 0) continue;
      const y0 = Math.max(clip.y0, rowTop(Ln.i));
      const y1 = Math.min(clip.y1, rowTop(Ln.i + 1));
      fillRect(clip.x0, y0, clip.x1, y1, RGB.accent, 0.17 * e);
      // a firmer mark in the gutter edge
      fillRect(clip.x0, y0, clip.x0 + 2 * hair, y1, RGB.accent, 0.85 * e);
    }
    // line numbers and code
    for (const Ln of TIMING.lines) {
      const top = rowTop(Ln.i);
      if (top > clip.y1 || top + pitchPx(Ln.i) < clip.y0) continue;
      const started = uw >= Ln.times[0] || caret.line >= Ln.i;
      if (!started && Ln.i !== 0) continue;
      const base = top + Math.round(BASE_IN_LINE * k);
      // number
      const num = numberSprite(stage, Ln.i + 1, L, lkey, s);
      const on = Ln.i === caret.line;
      const e = Ln.marked ? accentEnv(ue - Ln.done) : 0;
      let col = on ? RGB.gutterOn : RGB.gutter;
      if (e > 0) col = col.map((c, j) => Math.round(lerp(c, RGB.accent[j], e)));
      blit(num, X(GUTTER_R), base, { clip, tint: col });
      // code: the whole line's sprite, cropped to what has been written
      // (colours were decided from the whole file, so a token never changes colour as it completes);
      // each new chunk eases in over CHUNK_LEAD instead of popping
      const n = written(Ln, uw);
      if (n <= 0) continue;
      const spr = lineSprite(stage, Ln.i, L, lkey, s, adv);
      const left = X(CODE_X);
      const left0 = crisp ? Math.round(left) : left;
      const colX = (c) => left0 + c * adv * r;
      let solid = 0;
      for (let j = 0; j < Ln.times.length; j += 1) if (ue >= Ln.times[j]) solid = Ln.cum[j];
      if (solid > 0) blit(spr, left, base, { clip: { ...clip, x1: Math.min(clip.x1, colX(solid)) } });
      for (let j = 0; j < Ln.times.length; j += 1) {
        const dt = ue - (Ln.times[j] - CHUNK_LEAD);
        if (dt < 0 || dt >= CHUNK_LEAD) continue;
        const c0 = j === 0 ? 0 : Ln.cum[j - 1];
        const x0 = Math.max(clip.x0, colX(c0));
        const x1 = Math.min(clip.x1, colX(Ln.cum[j]));
        blit(spr, left, base, { clip: { ...clip, x0, x1 }, alpha: lerp(0.3, 1, smoothstep(0, CHUNK_LEAD, dt)) });
      }
    }
    // caret
    {
      const ca = caretAlpha(ue);
      const top = rowTop(caret.line);
      const cxp = Math.round(X(CODE_X) + caret.col * adv * r);
      const cw = Math.max(1, Math.round(0.62 * k));
      const y0 = Math.max(clip.y0, top + Math.round(2.0 * k));
      const y1 = Math.min(clip.y1, top + pitchPx(caret.line) - Math.round(2.0 * k));
      fillRect(cxp, y0, cxp + cw, y1, RGB.accent, ca);
    }

    // ------------------------------------------------ tab
    const tab = chromeSprite(stage, "tab", L, lkey, s);
    blit(tab, X(TAB.x0 + 12), Y(TABROW.y0 + 12.3));
    {
      // the modified dot while the file is being written
      const m = (ue < TIMING.start ? 0 : 1) * (1 - smoothstep(TIMING.closed, TIMING.closed + 0.3, ue));
      if (m > 0.002) {
        const dot = chromeSprite(stage, "dot", L, lkey, s);
        blit(dot, X(TAB.x1 - 11), Y(TABROW.y0 + 9.5), { alpha: m });
      }
    }

    // ------------------------------------------------ title and status bar
    // baselines that centre the ink in the visible part of each bar (measured once, in units)
    const { titleBase, statusBase } = chromeBaselines(stage);
    const title = chromeSprite(stage, "title", L, lkey, s);
    blit(title, X(TITLE_X), Y(titleBase));
    const date = chromeSprite(stage, "date", L, lkey, s);
    const dateX = X(DATE_RIGHT) - date.textW * r;
    if (ue <= 6) blit(date, dateX, Y(statusBase));
    else {
      // at rest (and in the gallery still) the square ends inside the line: as the editor glides
      // back the English half fades out, leaving the Chinese date whole, where it stood
      // (the same sprite, cut where the Chinese ends, so the Chinese pixels stay exactly as they were)
      const probe = stage.layer("code/probe", 8, 8).ctx;
      probe.font = `400 ${DATE_PX * L}px ${SANS}`;
      const cut = Math.round(dateX + probe.measureText(META.date).width * r); // whole pixels: a 1:1 copy
      blit(date, dateX, Y(statusBase), { clip: { x0: 0, y0: 0, x1: cut, y1: f.h } });
      const tail = 1 - smoothstep(6.0, 6.6, ue);
      if (tail > 0.002) blit(date, dateX, Y(statusBase), { clip: { x0: cut, y0: 0, x1: f.w, y1: f.h }, alpha: tail });
    }
    const leftItem = chromeSprite(stage, "left", L, lkey, s);
    blit(leftItem, X(LEFT_ITEM_X), Y(statusBase));
    // ✓ 20 / 20 when the file closes: the tick draws itself, the count fades up
    const dtc = ue - TIMING.closed;
    if (dtc > 0) {
      const done = chromeSprite(stage, "done", L, lkey, s);
      blit(done, X(CHECK_X + 11), Y(statusBase), { alpha: smoothstep(0.08, CHECK_DRAW + 0.08, dtc) });
      drawCheck(stage, view, a + CHECK_X, statusBase, smootherstep(0, CHECK_DRAW, dtc), crisp);
      stage.origin();
    }
  },
};

// ---------------------------------------------------------------- sprites

const advCache = new Map();
function monoAdvance(stage, L) {
  const key = Math.round(L * 1000);
  if (!advCache.has(key)) {
    const probe = stage.layer("code/probe", 8, 8).ctx;
    probe.font = `400 ${CODE_PX * L}px ${MONO}`;
    advCache.set(key, probe.measureText("M".repeat(40)).width / 40);
  }
  return advCache.get(key);
}

function lineSprite(stage, i, L, lkey, s, adv) {
  const text = SOURCE[i];
  const cols = COLOURS[i];
  return textSprite(stage, `code/line/${i}/${lkey}/${s}`, L, 36 * CODE_PX * 0.61, 1, (ctx, ox, oy) => {
    ctx.font = `400 ${CODE_PX * L}px ${MONO}`;
    ctx.textBaseline = "alphabetic";
    for (let j = 0; j < text.length; j += 1) {
      if (text[j] === " ") continue;
      ctx.fillStyle = C[cols[j]];
      ctx.fillText(text[j], ox + j * adv, oy);
    }
  });
}

function numberSprite(stage, n, L, lkey, s) {
  const spr = textSprite(stage, `code/num/${n}/${lkey}/${s}`, L, 14, 1, (ctx, ox, oy) => {
    ctx.font = `400 ${CODE_PX * L}px ${MONO}`;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "right";
    ctx.fillText(String(n), ox + Math.ceil(14 * L), oy);
  });
  // origin at the right edge of the number
  return { ...spr, ox: spr.ox + Math.ceil(14 * L) };
}

/**
 * Baselines (world y) that centre the title's ink in the visible top bar and the
 * date line's ink in the visible status bar. Measured once at 100 px and scaled,
 * so they do not depend on the level the sprites are drawn at.
 */
let BASELINES = null;
function chromeBaselines(stage) {
  if (BASELINES) return BASELINES;
  const probe = stage.layer("code/probe", 8, 8).ctx;
  const ink = (css, text) => {
    probe.font = css;
    const m = probe.measureText(text);
    return [m.actualBoundingBoxAscent / 100, m.actualBoundingBoxDescent / 100];
  };
  const [za, zd] = ink(`500 100px ${HEI}`, META.zh);
  const [ea, ed] = ink(`400 100px ${SANS}`, META.en);
  const tA = Math.max(za * TITLE_ZH, ea * TITLE_EN);
  const tD = Math.max(zd * TITLE_ZH, ed * TITLE_EN);
  const [da, dd] = ink(`400 100px ${SANS}`, `${META.date} · ${META.dateEn}`);
  const midT = (TOP_SEEN.y0 + TOP_SEEN.y1) / 2;
  const midS = (STATUS_SEEN.y0 + STATUS_SEEN.y1) / 2;
  BASELINES = {
    titleBase: midT + (tA - tD) / 2,
    statusBase: midS + (da * DATE_PX - dd * DATE_PX) / 2,
  };
  return BASELINES;
}

/** Chrome lettering: title, tab label, status items. textW is the text's width in sprite pixels. */
function chromeSprite(stage, which, L, lkey, s) {
  const key = `code/chrome/${which}/${lkey}/${s}`;
  const probe = stage.layer("code/probe", 8, 8).ctx;
  const specs = {
    title: () => {
      const zh = `500 ${TITLE_ZH * L}px ${HEI}`;
      const en = `400 ${TITLE_EN * L}px ${SANS}`;
      probe.font = zh;
      const wz = probe.measureText(META.zh).width;
      probe.font = en;
      const we = probe.measureText(META.en).width;
      const gap = 19 * L; // wide enough that the English begins past the gallery still's edge (a + 176.5)
      return {
        w: (wz + gap + we) / L,
        textW: wz + gap + we,
        draw: (ctx, ox, oy) => {
          ctx.font = zh;
          ctx.fillStyle = C.title;
          ctx.fillText(META.zh, ox, oy);
          ctx.font = en;
          ctx.fillStyle = C.titleEn;
          ctx.fillText(META.en, ox + wz + gap, oy);
        },
      };
    },
    date: () => simple(`${META.date} · ${META.dateEn}`, `400 ${DATE_PX * L}px ${SANS}`, C.date),
    left: () => simple("SVG · UTF-8", `400 ${STATUS_PX * L}px ${SANS}`, C.chromeText),
    done: () => simple("20 / 20", `500 ${STATUS_PX * L}px ${SANS}`, C.text),
    tab: () => simple("pelican.svg", `400 ${7.6 * L}px ${SANS}`, C.text),
    dot: () => ({
      w: 4,
      textW: 2.6 * L,
      draw: (ctx, ox, oy) => {
        ctx.fillStyle = C.chromeText;
        ctx.beginPath();
        ctx.arc(ox + 1.3 * L, oy - 1.3 * L, 1.3 * L, 0, Math.PI * 2);
        ctx.fill();
      },
    }),
  };
  function simple(text, css, fill) {
    probe.font = css;
    const w = probe.measureText(text).width;
    return {
      w: w / L,
      textW: w,
      draw: (ctx, ox, oy) => {
        ctx.font = css;
        ctx.fillStyle = fill;
        ctx.fillText(text, ox, oy);
      },
    };
  }
  const spec = specs[which]();
  const spr = textSprite(stage, key, L, spec.w + 2, 1, spec.draw);
  return { ...spr, textW: spec.textW };
}

/** The canvas's world-fixed furniture: ruler ticks and labels, then the dot grid. */
function paintGrid(ctx, L, s) {
  const px = (wx) => (wx - GRID_X0) * L;
  const py = (wy) => (wy - RULER.y0) * L;
  const one = Math.max(1, Math.round(s));
  // ruler
  ctx.font = `400 ${5.4 * L}px ${MONO}`;
  ctx.textBaseline = "alphabetic";
  for (let x = Math.ceil(GRID_X0 / 10) * 10; x <= GRID_X1; x += 10) {
    const major = x % 100 === 0;
    const mid = x % 50 === 0;
    const h = major ? 12 : mid ? 4.5 : 2.6;
    const X0 = Math.round(px(x));
    const Y1 = Math.round(py(RULER.y1));
    ctx.fillStyle = major ? "#3a4555" : C.tick;
    ctx.fillRect(X0, Math.round(py(RULER.y1 - h)), one, Y1 - Math.round(py(RULER.y1 - h)));
    if (major) {
      ctx.fillStyle = C.tickLabel;
      ctx.fillText(String(x), X0 + Math.round(1.8 * L), Math.round(py(RULER.y0 + 7.6)));
    }
  }
  // dots every 20 units; every 100 a little brighter
  const d = Math.max(1, Math.round(0.72 * L));
  for (let x = Math.ceil(GRID_X0 / 20) * 20; x <= GRID_X1; x += 20) {
    for (let y = 500; y < CANVAS.y1; y += 20) {
      if (y === ROAD_Y) continue;
      const major = x % 100 === 0 && y % 100 === 0;
      ctx.fillStyle = major ? C.dotMajor : C.dot;
      ctx.fillRect(Math.round(px(x) - d / 2), Math.round(py(y) - d / 2), d, d);
    }
  }
}

/** The check mark, drawn as a stroke that runs from its short arm to its long one. */
function drawCheck(stage, view, x, base, prog, crisp) {
  if (prog <= 0) return;
  const pts = [
    [x + 0.6, base - 3.9],
    [x + 3.4, base - 0.9],
    [x + 8.6, base - 7.7],
  ];
  const patch = stage.patch("code/check", view, x - 2, base - 11, x + 11, base + 2);
  const ctx = patch.ctx;
  const l1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
  const l2 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
  ctx.beginPath();
  ctx.moveTo(...pts[0]);
  ctx.lineTo(...pts[1]);
  ctx.lineTo(...pts[2]);
  ctx.setLineDash([(l1 + l2) * prog, l1 + l2 + 1]);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = C.accent;
  ctx.stroke();
  stage.imagePatch(patch);
}
