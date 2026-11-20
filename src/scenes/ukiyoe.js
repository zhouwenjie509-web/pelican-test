// Section 11. Ukiyo-e, the 1830s: the coast road in the manner of Hiroshige's
// Tōkaidō landscape prints.
//
// A colour woodblock print, newly composed: old pines on a causeway, a
// thatched tea house, a bay with sails, Fuji beyond. The print is built the
// way a print is made. Every colour is its own block, cut as a set of flat
// shapes and wiped gradations, printed onto cream washi with a little wood
// grain, each block a fraction of a unit out of register with the others;
// the black key block goes on top. Objects nearer the viewer knock out the
// blocks behind them, as a carver would leave the wood away.
//
// Bar 2: a sudden shower. A grey gradation wipes down from the top edge and
// the whole sheet is ruled with fine slanting rain, two slants, shifting
// between three offset printings at 12 Hz. The pelican produces an oiled-paper
// umbrella (shut at 2.5, half at 2.65, open on the strong beat at 3.0) and
// folds it again as the shower passes.
//
// The view is flat: one sheet, no parallax. Travellers move in held drawings
// at 6 Hz; the pelican's own motion stays smooth.

import { sectionMeta } from "./sections.js";
import { Layer2D } from "../kit/stage.js";
import { sampler, hash, noise1 } from "../kit/rng.js";
import { smoothClosed, smoothOpen } from "../kit/geom.js";
import { drawText } from "../kit/text.js";
import { solveRig } from "../rig/rig.js";
import { traceShape } from "../rig/skins/plain.js";
import { stepTime } from "../beat/timeline.js";
import { clamp, lerp, smoothstep, TAU } from "../beat/ease.js";

const META = sectionMeta(11);

// ------------------------------------------------------------------ sheet and palette
const SHEET = { x0: -70, y0: 418, x1: 1070, y1: 802 };
const SW = SHEET.x1 - SHEET.x0;
const SH = SHEET.y1 - SHEET.y0;
const PX = 3.3; // baked pixels per unit at 1080p
const BORDER = { x0: 24, y0: 439, x1: 976, y1: 780 };

const HORIZON = 628;
const SEA_NEAR = 657;
const FIELD_TOP = 667;
const ROAD_FAR = 693;
const ROAD_NEAR = 742;

const PAPER = "#efe4c9";
const KEY = "#1c1916";
const PRUSSIAN = "#1f4e8c";
const PALE = "#7ea6c9";
const INDIGO = "#55606e";
const GREEN = "#5d8a5a";
const DKGREEN = "#2f5a44";
const OCHRE = "#d9b25f";
const ROSE = "#c9584a";
const WGREY = "#a39784";

const FONT_KAI = "'Kaiti SC', 'STKaiti', 'Kaiti TC', serif";

// Colour blocks, printed in this order with multiply; each a little out of register.
// (offsets of 1 – 1.8 units, 3 – 6 px at 1080p: just visible as a sliver of paper or overlap at the key line)
const BLOCKS = [
  { id: "pale", color: PALE, reg: [-1.04, 0.72], grain: 0.5, go: [13, 41] },
  { id: "rose", color: ROSE, reg: [1.2, 0.88], grain: 0.44, go: [301, 77] },
  { id: "ochre", color: OCHRE, reg: [-1.36, -0.56], grain: 0.48, go: [97, 203] },
  { id: "grey", color: WGREY, reg: [-0.56, 1.28], grain: 0.44, go: [411, 19] },
  { id: "green", color: GREEN, reg: [-1.28, 0.8], grain: 0.46, go: [57, 151] },
  { id: "dkgreen", color: DKGREEN, reg: [0.8, -1.12], grain: 0.4, go: [233, 311] },
  { id: "indigo", color: INDIGO, reg: [0.72, 1.2], grain: 0.42, go: [377, 263] },
  { id: "prussian", color: PRUSSIAN, reg: [1.12, -0.72], grain: 0.52, go: [151, 97] },
  { id: "key", color: KEY, reg: [0.0, 0.0], grain: 0.14, go: [29, 333] },
];
const REG = Object.fromEntries(BLOCKS.map((b) => [b.id, b.reg]));

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const PAPER_RGB = hexRgb(PAPER);
const rgba = (hex, a) => {
  const c = hexRgb(hex);
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
};
/** A block colour printed on the paper at strength a (multiply), as an opaque colour. */
function ink(hex, a = 1) {
  const c = hexRgb(hex);
  return `rgb(${c.map((v, i) => Math.round(PAPER_RGB[i] * (1 - a + (a * v) / 255))).join(",")})`;
}

// ------------------------------------------------------------------ geometry
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

function trace(ctx, pts, closed = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  if (closed) ctx.closePath();
}

function fillPts(ctx, pts, style) {
  trace(ctx, pts, true);
  ctx.fillStyle = style;
  ctx.fill();
}

function resample(pts, closed, step) {
  const src = closed ? pts.concat([pts[0]]) : pts;
  const out = [];
  for (let i = 0; i < src.length - 1; i += 1) {
    const a = src[i];
    const b = src[i + 1];
    const n = Math.max(1, Math.ceil(dist(a, b) / step));
    for (let j = 0; j < n; j += 1) out.push([a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n]);
  }
  if (!closed) out.push(src[src.length - 1]);
  return out;
}

/**
 * A key-block line: cut, not drawn. The path is broken into short straight
 * runs with tiny angular turns, the width swells and thins a little, and
 * open lines taper to points. Filled with the current fillStyle.
 */
function cut(ctx, pts, w, seed = 1, { closed = false, step = 3, jitter = 0.14, vary = 0.4, tip = 0.12, taper = null } = {}) {
  if (!pts || pts.length < 2) return;
  const r = resample(pts, closed, step);
  const n = r.length;
  if (n < 2) return;
  const cum = [0];
  for (let i = 1; i < n; i += 1) cum.push(cum[i - 1] + dist(r[i - 1], r[i]));
  const L = Math.max(1e-3, cum[n - 1]);
  const tl = taper ?? Math.min(L * 0.42, 2 + w * 5);
  const left = [];
  const right = [];
  for (let i = 0; i < n; i += 1) {
    const a = closed ? r[(i - 1 + n) % n] : r[Math.max(0, i - 1)];
    const b = closed ? r[(i + 1) % n] : r[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    const nx = -ty;
    const ny = tx;
    // the knife's pressure: a slow swell along the line, and a little quicker flutter
    let f = 1 + vary * (noise1(cum[i] * 0.09 + seed * 3.17, seed) * 2 - 1) * 0.8 + vary * 0.35 * (noise1(cum[i] * 0.4 + seed, seed + 7) * 2 - 1);
    if (!closed) f *= tip + (1 - tip) * Math.sqrt(clamp(Math.min(cum[i], L - cum[i]) / tl));
    const inner = closed || (i > 0 && i < n - 1);
    const j = inner ? jitter * (hash(i, seed, 77) * 2 - 1) : 0;
    const cx = r[i][0] + nx * j;
    const cy = r[i][1] + ny * j;
    const hw = (w * f) / 2;
    left.push([cx + nx * hw, cy + ny * hw]);
    right.push([cx - nx * hw, cy - ny * hw]);
  }
  ctx.beginPath();
  if (closed) {
    ctx.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i < n; i += 1) ctx.lineTo(left[i][0], left[i][1]);
    ctx.closePath();
    ctx.moveTo(right[0][0], right[0][1]);
    for (let i = 1; i < n; i += 1) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fill("evenodd");
  } else {
    ctx.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i < n; i += 1) ctx.lineTo(left[i][0], left[i][1]);
    for (let i = n - 1; i >= 0; i -= 1) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fill();
  }
}

/** Outline of a limb or branch: a ribbon through pts with widths ws. */
function ribbon(pts, ws) {
  const left = [];
  const right = [];
  const n = pts.length;
  for (let i = 0; i < n; i += 1) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const l = dist(a, b) || 1;
    const nx = -(b[1] - a[1]) / l;
    const ny = (b[0] - a[0]) / l;
    const hw = (Array.isArray(ws) ? ws[Math.min(i, ws.length - 1)] : ws) / 2;
    left.push([pts[i][0] + nx * hw, pts[i][1] + ny * hw]);
    right.push([pts[i][0] - nx * hw, pts[i][1] - ny * hw]);
  }
  return left.concat(right.reverse());
}

const lerpWs = (w0, w1, n) => Array.from({ length: n }, (_, i) => lerp(w0, w1, n === 1 ? 0 : i / (n - 1)));

function ellipsePts(cx, cy, rx, ry, n = 24, a0 = 0, a1 = TAU) {
  const out = [];
  for (let i = 0; i <= n; i += 1) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

const rect = (x0, y0, x1, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

/** Two-bone IK in y-down space; dir = 1 bends the knee forward (+x). */
function ik(hip, foot, l1, l2, dir = 1) {
  const dx = foot[0] - hip[0];
  const dy = foot[1] - hip[1];
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01);
  const a = Math.atan2(dy, dx);
  const A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const ang = a - dir * A;
  return [hip[0] + Math.cos(ang) * l1, hip[1] + Math.sin(ang) * l1];
}

function withAlpha(ctx, a, fn) {
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * a;
  fn();
  ctx.globalAlpha = prev;
}

function carve(ctx, fn) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";
  fn();
  ctx.restore();
}

function clipTo(ctx, pts, fn) {
  ctx.save();
  trace(ctx, pts, true);
  ctx.clip();
  fn();
  ctx.restore();
}

function vgrad(ctx, y0, y1, stops, C) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [t, a] of stops) g.addColorStop(t, C(a));
  return g;
}

// ------------------------------------------------------------------ the view: objects back to front
// Each object: sil(ctx) fills its silhouette (used to knock out the blocks
// behind it); paint(ctx, block, C) cuts its shapes for one block, where C(a)
// is that block's colour at strength a.

function skyObject() {
  return {
    paint(ctx, b, C) {
      const x0 = SHEET.x0;
      const w = SW;
      if (b === "prussian") {
        // the straight band of deep blue, wiped downward
        ctx.fillStyle = vgrad(ctx, BORDER.y0, 500, [[0, 1], [0.22, 0.96], [0.42, 0.62], [0.62, 0.22], [1, 0]], C);
        ctx.fillRect(x0, BORDER.y0, w, 500 - BORDER.y0);
      } else if (b === "pale") {
        ctx.fillStyle = vgrad(ctx, 462, 600, [[0, 0], [0.25, 0.22], [0.6, 0.16], [1, 0]], C);
        ctx.fillRect(x0, 462, w, 140);
      } else if (b === "rose") {
        ctx.fillStyle = vgrad(ctx, 566, HORIZON, [[0, 0], [0.55, 0.32], [1, 0.62]], C);
        ctx.fillRect(x0, 566, w, HORIZON - 566 + 1);
      }
    },
  };
}

function flockObject() {
  // a skein of geese far off over the bay
  const birds = [];
  const rnd = sampler(1171);
  const base = [[740, 470], [760, 478], [778, 474], [795, 486], [812, 481], [829, 492]];
  for (const [x, y] of base) birds.push([x + rnd.range(-2, 2), y + rnd.range(-1.5, 1.5), rnd.range(2.6, 3.4)]);
  return {
    paint(ctx, b, C) {
      if (b !== "key") return;
      ctx.fillStyle = C(1);
      birds.forEach(([x, y, s], i) => {
        cut(ctx, [[x - s, y - s * 0.3], [x - s * 0.4, y - s * 0.55], [x, y]], 0.55, 900 + i, { step: 1 });
        cut(ctx, [[x, y], [x + s * 0.5, y - s * 0.6], [x + s * 1.1, y - s * 0.45]], 0.55, 950 + i, { step: 1 });
      });
    },
  };
}

function fujiObject() {
  const left = [];
  const right = [];
  for (let i = 0; i <= 16; i += 1) {
    const t = i / 16;
    left.push([lerp(418, 627, t) + Math.sin(t * 9) * 0.6, HORIZON - 125 * Math.pow(t, 1.55)]);
    right.push([lerp(884, 675, t) + Math.sin(t * 7) * 0.6, HORIZON - 123 * Math.pow(t, 1.5)]);
  }
  const summit = [[634, 501.6], [640, 503.5], [646, 501.2], [653, 503], [660, 500.8], [667, 503.2]];
  const outline = left.concat(summit, right.slice().reverse());
  // the snow cap: along the summit and down both flanks, three tongues below
  const capL = left.filter((p) => p[1] <= 548);
  const capR = right.filter((p) => p[1] <= 552).reverse();
  const lowL = capL[0];
  const lowR = capR[capR.length - 1];
  // the cap's lower edge: a ragged saw of snow running down the gullies, as the printer cut it
  const tongues = [[lowR[0], lowR[1]]];
  {
    // tongues of every length, unevenly spaced: long ones down the gullies, stubs between,
    // now and then a forked tip
    const rr = sampler(1127);
    let x = lowR[0] - 4;
    while (x > lowL[0] + 10) {
      const base = 549 + rr.range(-3, 2);
      const kind = rr.next();
      const deep = kind < 0.25 ? rr.range(15, 26) : kind < 0.6 ? rr.range(6, 13) : rr.range(1.5, 5);
      const half = rr.range(1.6, 3.6) * (deep > 14 ? 1.3 : 1);
      tongues.push([x, base]);
      if (deep > 10 && rr.chance(0.35)) {
        tongues.push([x - half * 0.7, base + deep * 0.85]);
        tongues.push([x - half, base + deep * 0.6]);
        tongues.push([x - half * 1.35, base + deep]);
      } else tongues.push([x - half + rr.range(-0.8, 0.8), base + deep]);
      x -= half * 2 + rr.range(0.5, 7);
    }
    tongues.push([lowL[0] + 4, lowL[1] + 1.5]);
  }
  const streaks = [[[724, 570], [731, 586]], [[697, 576], [700, 592]], [[662, 573], [662.5, 585]], [[623, 573], [619, 587]], [[587, 569], [582, 580]]];
  const cap = capL.concat(summit, capR, tongues.slice(1));
  return {
    sil(ctx) {
      trace(ctx, outline);
      ctx.fill();
    },
    paint(ctx, b, C) {
      if (b === "pale") {
        clipTo(ctx, outline, () => {
          ctx.fillStyle = vgrad(ctx, 500, HORIZON, [[0, 0.8], [0.5, 0.68], [1, 0.56]], C);
          ctx.fillRect(400, 495, 500, 140);
        });
        carve(ctx, () => {
          trace(ctx, cap);
          ctx.fill();
          streaks.forEach((l, i) => cut(ctx, l, 0.9, 66 + i));
        });
        // the snow's lower edge, printed in blue
        ctx.fillStyle = C(0.95);
        cut(ctx, tongues.concat([capL[0]]), 0.6, 61, { step: 2.5, tip: 0.4 });
      } else if (b === "indigo") {
        // a soft grey shadow at the foot, and the far flank in shade
        clipTo(ctx, outline, () => {
          ctx.fillStyle = vgrad(ctx, 582, HORIZON, [[0, 0], [1, 0.42]], C);
          ctx.fillRect(400, 580, 500, 50);
          const g = ctx.createLinearGradient(660, 0, 860, 0);
          g.addColorStop(0, C(0));
          g.addColorStop(1, C(0.3));
          ctx.fillStyle = g;
          ctx.fillRect(660, 540, 230, 90);
        });
        carve(ctx, () => {
          trace(ctx, cap);
          ctx.fill();
          streaks.forEach((l, i) => cut(ctx, l, 0.9, 66 + i));
        });
      } else if (b === "key") {
        ctx.fillStyle = C(1);
        cut(ctx, left.concat(summit, right.slice().reverse()), 0.7, 62, { step: 3.5, taper: 30, tip: 0.05 });
        // a few gullies on the shaded flank
        [[690, 560, 712, 600], [705, 575, 735, 612]].forEach(([a, bb, c, d], i) => {
          ctx.fillStyle = C(0.6);
          cut(ctx, [[a, bb], [lerp(a, c, 0.5) + 2, lerp(bb, d, 0.5)], [c, d]], 0.4, 64 + i);
        });
      }
    },
  };
}

/** In the shower Fuji is only a faint grey shape behind the rain, printed without a key line. */
function fujiGhostObject() {
  const pts = [];
  for (let i = 0; i <= 16; i += 1) pts.push([lerp(418, 627, i / 16), HORIZON - 125 * Math.pow(i / 16, 1.55)]);
  for (let i = 16; i >= 0; i -= 1) pts.push([lerp(884, 675, i / 16), HORIZON - 123 * Math.pow(i / 16, 1.5)]);
  return {
    paint(ctx, b, C) {
      if (b !== "indigo") return;
      clipTo(ctx, pts, () => {
        ctx.fillStyle = vgrad(ctx, 500, HORIZON, [[0, 0.06], [0.6, 0.16], [1, 0.24]], C);
        ctx.fillRect(400, 495, 500, 140);
      });
    },
  };
}

/** Bars of mist across the open sky, printed as wiped bands of pale blue with a rose underside. */
function cloudObject() {
  const bars = [
    { x0: -60, x1: 150, y: 512, h: 7, seed: 1 },
    { x0: 250, x1: 560, y: 532, h: 9, seed: 2 },
    { x0: 360, x1: 480, y: 552, h: 5, seed: 3 },
    { x0: 800, x1: 1070, y: 524, h: 8, seed: 4 },
    { x0: 900, x1: 1010, y: 548, h: 5, seed: 5 },
  ].map((b) => {
    const top = [];
    const bot = [];
    for (let x = b.x0; x <= b.x1; x += 3) {
      const t = (x - b.x0) / (b.x1 - b.x0);
      const end = Math.sqrt(Math.max(0, Math.sin(Math.PI * t)));
      top.push([x, b.y - (b.h / 2) * end - 1.4 * Math.abs(Math.sin(t * Math.PI * (4 + b.seed))) * end]);
      bot.push([x, b.y + (b.h / 2) * end * (0.6 + 0.4 * noise1(x * 0.03, b.seed))]);
    }
    return { ...b, pts: top.concat(bot.reverse()) };
  });
  return {
    paint(ctx, b, C) {
      for (const bar of bars) {
        if (b === "pale") {
          clipTo(ctx, bar.pts, () => {
            ctx.fillStyle = vgrad(ctx, bar.y - bar.h, bar.y + bar.h / 2, [[0, 0.55], [0.6, 0.3], [1, 0.08]], C);
            ctx.fillRect(bar.x0, bar.y - bar.h - 2, bar.x1 - bar.x0, bar.h * 2 + 4);
          });
        } else if (b === "rose") {
          clipTo(ctx, bar.pts, () => {
            ctx.fillStyle = vgrad(ctx, bar.y, bar.y + bar.h / 2, [[0, 0], [1, 0.3]], C);
            ctx.fillRect(bar.x0, bar.y, bar.x1 - bar.x0, bar.h);
          });
        }
      }
    },
  };
}

/** A few things on the road: a cast-off straw sandal, a horse's straw boot, scattered needles. */
function roadThingsObject() {
  const sandal = (x, y, a, s) => {
    const r = (pts) => pts.map(([px, py]) => [x + (px * Math.cos(a) - py * Math.sin(a)) * s, y + (px * Math.sin(a) + py * Math.cos(a)) * s]);
    return { sole: r(ellipsePts(0, 0, 6, 2.2, 16)), weave: [-3, -1, 1, 3].map((px) => r([[px, -1.8], [px, 1.8]])), cord: r([[-4, -1], [-1, -4.2], [2.6, -3.2], [4.5, 0.4]]) };
  };
  const things = [sandal(318, 731, 0.25, 1), sandal(326, 734, -0.4, 0.95), sandal(642, 724, 0.1, 1.1)];
  const rnd = sampler(1193);
  const needles = [];
  for (const px of [86, 422, 548, 968]) {
    for (let i = 0; i < 9; i += 1) {
      const x = px + rnd.range(-26, 26);
      const y = rnd.range(ROAD_FAR + 3, ROAD_FAR + 14);
      const a = rnd.range(0, Math.PI);
      needles.push([[x, y], [x + Math.cos(a) * 2.2, y + Math.sin(a) * 0.9], [x + Math.cos(a + 0.5) * 2.2, y + Math.sin(a + 0.5) * 0.9]]);
    }
  }
  return {
    paint(ctx, b, C) {
      if (b === "ochre") things.forEach((t) => fillPts(ctx, t.sole, C(0.9)));
      else if (b === "grey") things.forEach((t) => fillPts(ctx, t.sole, C(0.3)));
      else if (b === "key") {
        ctx.fillStyle = C(1);
        things.forEach((t, i) => {
          cut(ctx, t.sole, 0.4, 2300 + i, { closed: true, step: 1.2 });
          t.weave.forEach((l, j) => cut(ctx, l, 0.25, 2310 + i * 5 + j, { tip: 0.6 }));
          cut(ctx, t.cord, 0.35, 2330 + i, { step: 1 });
        });
        ctx.fillStyle = C(0.8);
        needles.forEach((n, i) => {
          cut(ctx, [n[0], n[1]], 0.25, 2400 + i, { tip: 0.4 });
          cut(ctx, [n[0], n[2]], 0.25, 2500 + i, { tip: 0.4 });
        });
      }
    },
  };
}

/** Wild flowers in the grass of the bank: small rose and white heads on short stems. */
function flowersObject() {
  const rnd = sampler(1197);
  const heads = [];
  for (let x = SHEET.x0 + 20; x < SHEET.x1; x += rnd.range(40, 110)) {
    const n = rnd.int(3, 6);
    const white = rnd.chance(0.4);
    for (let k = 0; k < n; k += 1) heads.push({ x: x + rnd.range(-7, 7), y: rnd.range(762, 784), r: rnd.range(1.1, 1.7), white });
  }
  return {
    paint(ctx, b, C) {
      for (const h of heads) {
        const pts = ellipsePts(h.x, h.y, h.r, h.r * 0.8, 8);
        if (b === "dkgreen") {
          carve(ctx, () => {
            trace(ctx, pts);
            ctx.fill();
          });
        } else if (b === "green") {
          carve(ctx, () => {
            trace(ctx, pts);
            ctx.fill();
          });
        } else if (b === "rose" && !h.white) fillPts(ctx, pts, C(0.85));
        else if (b === "key") {
          ctx.fillStyle = C(0.9);
          cut(ctx, [[h.x, h.y + h.r], [h.x + 0.6, h.y + h.r + 4]], 0.3, 2600 + Math.round(h.x), { tip: 0.4 });
          ctx.fillStyle = C(1);
          cut(ctx, pts, 0.3, 2700 + Math.round(h.x * 3), { closed: true, step: 0.8 });
        }
      }
    },
  };
}

function headlandObject() {
  const ridge = smoothOpen([[-80, 600], [-40, 594], [0, 590], [40, 598], [76, 595], [120, 593], [160, 603], [196, 615], [228, HORIZON]], 6);
  const poly = ridge.concat([[228, HORIZON + 0.5], [-80, HORIZON + 0.5]]);
  const rnd = sampler(1131);
  const trees = [];
  for (let x = -60; x < 190; x += rnd.range(5, 9)) {
    let y = 0;
    for (let i = 1; i < ridge.length; i += 1) if (ridge[i][0] >= x) {
      y = lerp(ridge[i - 1][1], ridge[i][1], (x - ridge[i - 1][0]) / (ridge[i][0] - ridge[i - 1][0] || 1));
      break;
    }
    trees.push([x, y + 0.6, rnd.range(2, 3.6)]);
  }
  return {
    sil(ctx) {
      trace(ctx, poly);
      ctx.fill();
      for (const [x, y, s] of trees) {
        trace(ctx, ellipsePts(x, y - s * 0.4, s, s * 0.8, 10));
        ctx.fill();
      }
    },
    paint(ctx, b, C) {
      if (b === "dkgreen") {
        fillPts(ctx, poly, C(0.75));
        for (const [x, y, s] of trees) fillPts(ctx, ellipsePts(x, y - s * 0.4, s, s * 0.8, 10), C(0.95));
      } else if (b === "green") {
        clipTo(ctx, poly, () => {
          ctx.fillStyle = vgrad(ctx, 590, HORIZON, [[0, 0.9], [1, 0.25]], C);
          ctx.fillRect(-80, 585, 320, 45);
        });
      } else if (b === "indigo") {
        clipTo(ctx, poly, () => {
          ctx.fillStyle = vgrad(ctx, 610, HORIZON, [[0, 0], [1, 0.4]], C);
          ctx.fillRect(-80, 605, 320, 25);
        });
      } else if (b === "key") {
        ctx.fillStyle = C(1);
        cut(ctx, ridge, 0.65, 71, { step: 3, tip: 0.3 });
        trees.forEach(([x, y, s], i) => {
          if (i % 2) return;
          cut(ctx, ellipsePts(x, y - s * 0.4, s, s * 0.8, 8, Math.PI, TAU), 0.4, 72 + i, { step: 1.2 });
        });
      }
    },
  };
}

function farShoreObject() {
  const ridge = smoothOpen([[862, HORIZON], [900, 619], [944, 614], [990, 618], [1030, 611], [1080, 616]], 6);
  const poly = ridge.concat([[1080, HORIZON + 0.5], [862, HORIZON + 0.5]]);
  return {
    sil(ctx) {
      trace(ctx, poly);
      ctx.fill();
    },
    paint(ctx, b, C) {
      if (b === "indigo") fillPts(ctx, poly, C(0.42));
      else if (b === "pale") fillPts(ctx, poly, C(0.5));
      else if (b === "key") {
        ctx.fillStyle = C(0.85);
        cut(ctx, ridge, 0.5, 81, { step: 3 });
      }
    },
  };
}

function seaObject() {
  const poly = rect(SHEET.x0, HORIZON, SHEET.x1, SEA_NEAR + 2);
  const rnd = sampler(1141);
  const ripples = [];
  for (let i = 0; i < 70; i += 1) {
    const y = rnd.range(HORIZON + 4, SEA_NEAR - 2);
    const x = rnd.range(SHEET.x0, SHEET.x1);
    ripples.push([x, y, rnd.range(5, 14) * (0.5 + (y - HORIZON) / 40)]);
  }
  return {
    sil(ctx) {
      trace(ctx, poly);
      ctx.fill();
    },
    paint(ctx, b, C) {
      if (b === "pale") fillPts(ctx, poly, C(0.88));
      else if (b === "prussian") {
        ctx.fillStyle = vgrad(ctx, HORIZON, SEA_NEAR + 2, [[0, 0.7], [0.14, 0.12], [0.45, 0.05], [1, 0.75]], C);
        ctx.fillRect(SHEET.x0, HORIZON, SW, SEA_NEAR + 2 - HORIZON);
        ctx.fillStyle = C(0.55);
        ripples.forEach(([x, y, l], i) => cut(ctx, [[x, y], [x + l * 0.5, y - 0.6], [x + l, y]], 0.35, 400 + i, { step: 2 }));
      }
    },
  };
}

function boatObject(x, y, s, seed, flip = 1) {
  // a coasting boat with one tall square sail, the sail left as bare paper
  const hull = [[x - 9 * s, y - 2.4 * s], [x + 9 * s * flip, y - 3.2 * s], [x + 7 * s, y + 0.6 * s], [x - 7 * s, y + 0.8 * s]];
  const sx0 = x - 4.5 * s;
  const sx1 = x + 4.8 * s;
  const top = y - 22 * s;
  const sail = [[sx0, top + 1 * s], [sx1, top], [sx1 + 0.8 * s, y - 4 * s], [sx0 + 0.4 * s, y - 3.6 * s]];
  return {
    sil(ctx) {
      trace(ctx, sail);
      ctx.fill();
      trace(ctx, hull);
      ctx.fill();
    },
    paint(ctx, b, C) {
      if (b === "grey") {
        clipTo(ctx, sail, () => {
          const g = ctx.createLinearGradient(sx0, 0, sx1, 0);
          g.addColorStop(0, C(0));
          g.addColorStop(1, C(0.4));
          ctx.fillStyle = g;
          ctx.fillRect(sx0 - 1, top - 1, sx1 - sx0 + 3, y - top + 2);
        });
      } else if (b === "key") {
        ctx.fillStyle = C(1);
        fillPts(ctx, hull, C(0.95));
        cut(ctx, sail, 0.5, seed, { closed: true, step: 2 });
        for (let i = 1; i < 4; i += 1) {
          const t = i / 4;
          cut(ctx, [[lerp(sx0, sx1, t), lerp(top + s, top, t) + 0.6], [lerp(sx0 + 0.4 * s, sx1 + 0.8 * s, t), y - 4 * s]], 0.3, seed + i, { tip: 0.5 });
        }
        cut(ctx, [[x, top - 2.5 * s], [x, top + 1]], 0.4, seed + 9);
      }
    },
  };
}

function fieldsObject() {
  const shore = [];
  for (let x = SHEET.x0; x <= SHEET.x1; x += 6) shore.push([x, SEA_NEAR + 1.2 * Math.sin(x * 0.05) + 1.4 * (noise1(x * 0.02, 3) - 0.5)]);
  const poly = shore.concat([[SHEET.x1, ROAD_FAR + 2], [SHEET.x0, ROAD_FAR + 2]]);
  const rnd = sampler(1151);
  const dykes = [];
  for (let x = -60; x < 1080; x += rnd.range(55, 95)) dykes.push([[x, FIELD_TOP + 1], [x - 16, ROAD_FAR - 1]]);
  const rows = [];
  for (let y = FIELD_TOP + 5; y < ROAD_FAR - 2; y += 4.2) {
    for (let x = SHEET.x0 + rnd.range(0, 6); x < SHEET.x1; x += rnd.range(5, 8)) rows.push([x, y + rnd.range(-0.4, 0.4)]);
  }
  const foam = [];
  for (let x = 236; x < 1060; x += rnd.range(14, 30)) foam.push([x, SEA_NEAR - 0.5 + 1.2 * Math.sin(x * 0.05)]);
  return {
    sil(ctx) {
      trace(ctx, poly);
      ctx.fill();
    },
    paint(ctx, b, C) {
      if (b === "ochre") {
        fillPts(ctx, shore.concat([[SHEET.x1, FIELD_TOP], [SHEET.x0, FIELD_TOP]]), C(0.48));
        for (let i = 1; i < dykes.length - 1; i += 2) {
          const [a0, a1] = dykes[i];
          const [b0, b1] = dykes[i + 1];
          fillPts(ctx, [a0, b0, b1, a1], C(0.4));
        }
      } else if (b === "green") {
        fillPts(ctx, rect(SHEET.x0, FIELD_TOP, SHEET.x1, ROAD_FAR + 2), C(0.55));
        // paddies between the dykes, each printed a little differently
        for (let i = 0; i < dykes.length - 1; i += 1) {
          const [a0, a1] = dykes[i];
          const [b0, b1] = dykes[i + 1];
          fillPts(ctx, [a0, b0, b1, a1], C([0.35, 0.12, 0.28, 0.05][i % 4]));
        }
      } else if (b === "dkgreen") {
        ctx.fillStyle = vgrad(ctx, FIELD_TOP + 8, ROAD_FAR + 2, [[0, 0], [1, 0.65]], C);
        ctx.fillRect(SHEET.x0, FIELD_TOP + 8, SW, ROAD_FAR - FIELD_TOP - 6);
        ctx.fillStyle = C(0.75);
        rows.forEach(([x, y], i) => cut(ctx, [[x, y + 1.1], [x + 0.4, y - 1.1]], 0.45, 500 + (i % 97), { step: 1, tip: 0.3 }));
      } else if (b === "key") {
        ctx.fillStyle = C(1);
        cut(ctx, shore, 0.5, 91, { step: 3, tip: 0.2 });
        cut(ctx, [[SHEET.x0, FIELD_TOP], [SHEET.x1, FIELD_TOP]], 0.45, 92, { step: 6 });
        dykes.forEach((d, i) => cut(ctx, d, 0.45, 93 + i, { tip: 0.4 }));
        foam.forEach(([x, y], i) => cut(ctx, [[x, y], [x + 2.5, y - 1.6], [x + 5, y - 0.4], [x + 6.5, y - 1.2]], 0.35, 300 + i, { step: 1 }));
      }
    },
  };
}

function villageObject() {
  // a fishing hamlet on the shore below Fuji: low roofs among trees
  const rnd = sampler(1171);
  const huts = [
    [452, 0.9],
    [474, 1.1],
    [492, 0.8],
    [608, 1.0],
    [629, 1.2],
    [652, 0.9],
    [700, 1.05],
    [721, 0.85],
  ].map(([x, s]) => {
    const y = FIELD_TOP + 2;
    const w = 13 * s;
    const h = 5 * s;
    const roof = [[x - w / 2 - 1.5, y - h], [x - w / 2 + 3 * s, y - h - 5 * s], [x + w / 2 - 3 * s, y - h - 5 * s], [x + w / 2 + 1.5, y - h]];
    return { x, y, w, h, s, roof, wall: rect(x - w / 2, y - h, x + w / 2, y) };
  });
  const trees = [];
  for (const x of [440, 462, 486, 503, 596, 618, 641, 664, 690, 711, 733]) trees.push([x + rnd.range(-3, 3), FIELD_TOP + 1, rnd.range(4.5, 7.5)]);
  const clump = (x, y, r) => ellipsePts(x, y - r * 0.9, r, r * 0.95, 14);
  return {
    sil(ctx) {
      for (const [x, y, r] of trees) {
        trace(ctx, clump(x, y, r));
        ctx.fill();
      }
      for (const h of huts) {
        trace(ctx, h.roof);
        ctx.fill();
        trace(ctx, h.wall);
        ctx.fill();
      }
    },
    paint(ctx, b, C) {
      if (b === "dkgreen") for (const [x, y, r] of trees) fillPts(ctx, clump(x, y, r), C(0.9));
      else if (b === "green") for (const [x, y, r] of trees) fillPts(ctx, clump(x, y, r), C(0.5));
      // huts are in front of the trees
      for (const h of huts) {
        carve(ctx, () => {
          trace(ctx, h.roof);
          ctx.fill();
          trace(ctx, h.wall);
          ctx.fill();
        });
        if (b === "grey") {
          fillPts(ctx, h.roof, C(0.85));
          fillPts(ctx, h.wall, C(0.35));
        } else if (b === "ochre") fillPts(ctx, h.wall, C(0.55));
        else if (b === "indigo") fillPts(ctx, rect(h.x - 1.5 * h.s, h.y - h.h + 1, h.x + 1.5 * h.s, h.y), C(0.8));
        else if (b === "key") {
          ctx.fillStyle = C(1);
          cut(ctx, h.roof, 0.4, Math.round(h.x), { closed: true, step: 1.5, tip: 0.5 });
          cut(ctx, [[h.wall[3][0], h.wall[3][1]], [h.wall[2][0], h.wall[2][1]]], 0.35, Math.round(h.x) + 1);
        }
      }
      if (b === "key") {
        ctx.fillStyle = C(0.9);
        trees.forEach(([x, y, r], i) => cut(ctx, ellipsePts(x, y - r * 0.9, r, r * 0.95, 10, Math.PI * 0.95, TAU + 0.05), 0.35, 1180 + i, { step: 1.2 }));
      }
    },
  };
}

function teaHouseObject() {
  const roof = [[764, 640], [801, 600], [883, 600], [920, 640], [920, 647], [764, 647]];
  const body = rect(774, 640, 908, 695);
  const posts = [786, 824, 862, 899];
  const eaveTop = 638;
  const eaveBot = 647;
  const rnd = sampler(1161);
  const thatch = [];
  for (let row = 0; row < 6; row += 1) {
    const y = 604 + row * 6.2;
    const t = (y - 600) / 40;
    const xa = lerp(801, 764, t) + 3;
    const xb = lerp(883, 920, t) - 3;
    for (let x = xa + rnd.range(0, 4); x < xb; x += rnd.range(3.5, 6)) {
      const slope = (x - 842) / 40; // fall lines spread out to the hips
      thatch.push([[x, y], [x + slope * 1.2, y + rnd.range(3, 5)]]);
    }
  }
  const comb = [];
  for (let x = 766; x < 919; x += rnd.range(1.6, 2.6)) comb.push(x);
  return {
    sil(ctx) {
      trace(ctx, roof);
      ctx.fill();
      trace(ctx, body);
      ctx.fill();
    },
    paint(ctx, b, C) {
      const W = 3.2;
      if (b === "ochre") {
        fillPts(ctx, roof, C(0.72));
        posts.forEach((x) => fillPts(ctx, rect(x - W / 2, eaveBot, x + W / 2, 694), C(0.5)));
        fillPts(ctx, rect(790, 675, 858, 681), C(0.65)); // tatami edge inside
        fillPts(ctx, rect(838.5, 649, 847.5, 651), C(0.95)); // lantern caps
        fillPts(ctx, rect(838.5, 662, 847.5, 664), C(0.95));
      } else if (b === "grey") {
        clipTo(ctx, roof, () => {
          ctx.fillStyle = vgrad(ctx, 600, 647, [[0, 0.55], [0.6, 0.15], [0.86, 0.1], [1, 0.6]], C);
          ctx.fillRect(760, 598, 165, 50);
        });
        posts.forEach((x) => fillPts(ctx, rect(x - W / 2, eaveBot, x + W / 2, 694), C(0.6)));
        fillPts(ctx, rect(899, 647, 908, 694), C(0.55)); // plank side wall
        fillPts(ctx, rect(774, 690, 908, 695), C(0.6));
      } else if (b === "indigo") {
        fillPts(ctx, rect(774, eaveBot, 899, 690), C(0.82));
        carve(ctx, () => {
          posts.forEach((x) => trace(ctx, rect(x - W / 2, eaveBot, x + W / 2, 694)) || ctx.fill());
          ctx.fillRect(828, 652, 28, 20); // shoji at the back, bare paper
          ctx.fillRect(790, 675, 68, 6);
          trace(ctx, rect(838, 649, 848, 664));
          ctx.fill();
        });
      } else if (b === "prussian") {
        // the short curtain over the door, with a white crest
        const noren = rect(864, eaveBot, 897, 667);
        fillPts(ctx, noren, C(0.88));
        carve(ctx, () => {
          ctx.beginPath();
          ctx.arc(880.5, 656, 4.2, 0, TAU);
          ctx.fill();
          ctx.fillRect(872.5, 660, 0.9, 7.5);
          ctx.fillRect(888.5, 660, 0.9, 7.5);
        });
      } else if (b === "rose") {
        // a red cloth on the bench, and the lantern's glow
        fillPts(ctx, [[776, 676], [834, 676], [835, 682], [833, 686], [777, 686], [775, 681]], C(0.95));
        fillPts(ctx, rect(839, 651, 847, 662), C(0.18));
      } else if (b === "dkgreen") {
        fillPts(ctx, [[805, 595], [879, 595], [883, 601], [801, 601]], C(0.92));
      } else if (b === "green") {
        for (let x = 808; x < 878; x += 5.5) fillPts(ctx, [[x, 595.5], [x + 1.3, 590.5 + Math.sin(x) * 1.2], [x + 2.6, 595.5]], C(0.9));
      } else if (b === "key") {
        ctx.fillStyle = C(1);
        cut(ctx, [[764, 640], [801, 600], [883, 600], [920, 640]], 0.9, 101, { step: 3, tip: 0.6 });
        cut(ctx, [[764, eaveTop + 2], [920, eaveTop + 2]], 0.7, 102, { step: 4 });
        cut(ctx, [[764, eaveBot], [920, eaveBot]], 0.8, 103, { step: 4 });
        cut(ctx, [[805, 595], [879, 595]], 0.6, 104);
        comb.forEach((x, i) => cut(ctx, [[x, eaveTop + 2.6], [x + 0.2, eaveBot - 0.6]], 0.3, 600 + (i % 50), { tip: 0.6 }));
        ctx.fillStyle = C(0.85);
        thatch.forEach((l, i) => cut(ctx, l, 0.35, 700 + (i % 80), { tip: 0.2 }));
        ctx.fillStyle = C(1);
        posts.forEach((x, i) => {
          cut(ctx, [[x - W / 2, eaveBot], [x - W / 2, 694]], 0.55, 110 + i, { tip: 0.7 });
          cut(ctx, [[x + W / 2, eaveBot], [x + W / 2, 694]], 0.55, 115 + i, { tip: 0.7 });
        });
        // shoji lattice
        for (let x = 828; x <= 856; x += 7) cut(ctx, [[x, 652], [x, 672]], 0.3, 120 + x, { tip: 0.8 });
        for (let y = 652; y <= 672; y += 5) cut(ctx, [[828, y], [856, y]], 0.3, 130 + y, { tip: 0.8 });
        // bench
        cut(ctx, [[775, 676], [835, 676]], 0.55, 141);
        cut(ctx, [[777, 686], [833, 686]], 0.45, 142);
        [779, 830].forEach((x, i) => cut(ctx, [[x, 686], [x, 694]], 0.6, 143 + i));
        // lantern
        cut(ctx, rect(838.5, 649, 847.5, 664), 0.45, 145, { closed: true, step: 1.5 });
        for (let y = 653; y < 662; y += 2.6) cut(ctx, [[838.6, y], [847.4, y]], 0.25, 146 + y, { tip: 0.8 });
        cut(ctx, [[843, 647], [843, 649]], 0.4, 147);
        drawText(ctx, "茶", 843, 657, { font: `600 6px ${FONT_KAI}`, align: "center", baseline: "middle", fill: C(1) });
        // noren
        cut(ctx, rect(864, eaveBot, 897, 667), 0.5, 148, { closed: true, step: 2 });
        cut(ctx, [[872.9, 660], [872.9, 667]], 0.35, 149);
        cut(ctx, [[888.9, 660], [888.9, 667]], 0.35, 150);
        ctx.beginPath();
        cut(ctx, ellipsePts(880.5, 656, 4.2, 4.2, 18), 0.35, 151, { closed: true, step: 1.2 });
        // planks
        for (let x = 901; x < 908; x += 3) cut(ctx, [[x, eaveBot], [x, 694]], 0.3, 152 + x);
        cut(ctx, [[774, 695], [908, 695]], 0.6, 160, { step: 4 });
      }
    },
  };
}

// ------------------------------------------------------------------ pines
// Each pine its own tree: height, lean, twist, where its limbs come out, and how broad its pads are.
const PINES = [
  { x: -46, h: 212, lean: 0.12, twist: 0.7, w: 9, seed: 31, bias: 1, ts: [0.5, 0.66, 0.8], padK: 1.1, tuft: 1.0 },
  { x: 86, h: 250, lean: 0.3, twist: -1.2, w: 11, seed: 32, bias: 1, ts: [0.36, 0.48, 0.6, 0.71, 0.82, 0.9], padK: 0.8, tuft: 0.85 },
  { x: 422, h: 262, lean: -0.3, twist: 0.6, w: 12, seed: 33, bias: -1, ts: [0.47, 0.62, 0.76], padK: 1.3, tuft: 1.2 },
  { x: 548, h: 168, lean: 0.05, twist: -0.4, w: 8, seed: 34, bias: -1, ts: [0.62, 0.8], padK: 0.95, tuft: 0.95, left: true },
  { x: 968, h: 236, lean: -0.16, twist: 1.5, w: 11, seed: 35, bias: -1, ts: [0.42, 0.53, 0.64, 0.75, 0.85], padK: 0.9, tuft: 0.9 },
  { x: 1058, h: 200, lean: 0.1, twist: -0.5, w: 9, seed: 36, bias: 1, ts: [0.5, 0.7, 0.86], padK: 1.05, tuft: 1.05 },
];

function padShape(cx, cy, W, h, seed, tuftK = 1) {
  // a flat layered pad of needles: tufts along a domed top, a flat underside
  const rnd = sampler(seed);
  const nt = Math.max(4, Math.round(W / (5.2 * tuftK)));
  const tufts = [];
  for (let i = 0; i < nt; i += 1) {
    const s = (i + 0.5) / nt + rnd.range(-0.15, 0.15) / nt;
    const dome = Math.pow(Math.sin(Math.PI * s), 0.6);
    const r = rnd.range(2.6, 4.2) * tuftK * (0.75 + 0.25 * dome);
    tufts.push({ x: cx - W / 2 + s * W, y: cy - h * 0.55 * dome + 1.6, r });
  }
  const top = [[cx - W / 2 - 1, cy + 0.6]];
  for (const t of tufts) {
    for (let q = 0; q <= 8; q += 1) {
      const a = Math.PI + 0.15 + (q / 8) * (Math.PI - 0.3);
      const rr = t.r * (q % 2 ? 0.8 : 1.04);
      top.push([t.x + Math.cos(a) * rr, t.y + Math.sin(a) * rr]);
    }
  }
  top.push([cx + W / 2 + 1, cy + 0.6]);
  const bottom = [];
  const N = Math.max(12, Math.round(W / 2));
  const ph = rnd.range(0, 6);
  for (let i = N; i >= 0; i -= 1) {
    const s = i / N;
    bottom.push([cx - W / 2 - 1 + s * (W + 2), cy + 0.6 + h * 0.3 * Math.pow(Math.sin(Math.PI * s), 0.8) + 0.7 * Math.sin(s * 11 + ph)]);
  }
  return { top, bottom, tufts, poly: top.concat(bottom), cx, cy, W, h };
}

/** A fan of needles springing from one point. */
function fan(x, y, r, a0 = Math.PI + 0.25, a1 = TAU - 0.25, n = 6) {
  const out = [];
  for (let i = 0; i <= n; i += 1) {
    const a = lerp(a0, a1, i / n);
    out.push([[x + Math.cos(a) * r * 0.18, y + Math.sin(a) * r * 0.18], [x + Math.cos(a) * r, y + Math.sin(a) * r]]);
  }
  return out;
}

function makePine(cfg) {
  const rnd = sampler(cfg.seed);
  const by = 697;
  const TH = cfg.h * 0.84;
  const center = (t) => [cfg.x + cfg.lean * TH * Math.pow(t, 1.25) + cfg.twist * 8 * Math.sin(Math.PI * t * 1.7), by - TH * t];
  const wAt = (t) => lerp(cfg.w, 2.6, Math.pow(t, 0.75)) * (1 + Math.max(0, 0.07 - t) * 9);
  const N = 30;
  const cl = [];
  const ws = [];
  for (let i = 0; i <= N; i += 1) {
    cl.push(center(i / N));
    ws.push(wAt(i / N));
  }
  const trunk = ribbon(cl, ws);
  const left = trunk.slice(0, N + 1);
  const right = trunk.slice(N + 1).reverse();
  // bark: short cut strokes across the trunk, and scale marks
  const bark = [];
  for (let t = 0.04; t < 0.95; t += rnd.range(0.025, 0.045)) {
    const c = center(t);
    const w = wAt(t);
    const side = rnd.chance(0.5) ? 1 : -1;
    const o = rnd.range(-0.25, 0.2) * w;
    bark.push([[c[0] + o - side * w * 0.3, c[1] + 0.8], [c[0] + o, c[1] - 0.6], [c[0] + o + side * w * 0.28, c[1] + 0.4]]);
  }
  // branches and the pads they carry
  const branches = [];
  const pads = [];
  const ts = cfg.ts;
  ts.forEach((t, i) => {
    if (rnd.chance(0.12) && i > 0 && ts.length > 3) return;
    // a pine marked "left" sends all its limbs one way (away from the road's traffic)
    const side = cfg.left ? cfg.bias : i % 2 === 0 ? cfg.bias : -cfg.bias * (rnd.chance(0.65) ? 1 : -1);
    const c = center(t);
    const L = cfg.h * rnd.range(0.14, 0.27) * (1.15 - t * 0.5) * (side === cfg.bias ? 1.15 : 0.85);
    const lift = rnd.range(-0.05, 0.25) * L;
    // a pine limb is angular: out and down from the trunk, a kink, then up to its pad
    const knots = [c, [c[0] + side * L * 0.34, c[1] + L * 0.13], [c[0] + side * L * 0.62, c[1] + L * 0.06 - lift * 0.25], [c[0] + side * L * 0.82, c[1] - lift * 0.55 + 1], [c[0] + side * L, c[1] - lift - 3]];
    const pts = resample(knots, false, 3);
    branches.push({ pts, poly: ribbon(pts, lerpWs(wAt(t) * 0.62, 1.6, pts.length)) });
    const end = pts[pts.length - 1];
    const W = (26 + L * 1.05) * cfg.padK;
    pads.push(padShape(end[0] - side * W * 0.12, end[1] - 3, W, 9 + W * 0.13, cfg.seed * 10 + i, cfg.tuft));
    if (rnd.chance(0.55)) pads.push(padShape(end[0] - side * W * 0.45, end[1] - 11 - rnd.range(0, 4), W * 0.62, 8 + W * 0.08, cfg.seed * 10 + i + 50, cfg.tuft));
  });
  const topC = center(1);
  pads.push(padShape(topC[0] + cfg.lean * 10, topC[1] - 7, (34 + cfg.h * 0.1) * cfg.padK, 13, cfg.seed * 10 + 9, cfg.tuft));
  if (cfg.h > 200) pads.push(padShape(topC[0] - cfg.bias * 8, topC[1] + 9, (30 + cfg.h * 0.08) * cfg.padK, 11, cfg.seed * 10 + 8, cfg.tuft));
  // pads lower on the page are nearer; draw higher ones first
  pads.sort((a, b) => a.cy - b.cy);
  const needles = pads.map((p) => p.tufts.flatMap((t) => fan(t.x, t.y, t.r * 0.95)));
  const inner = pads.map((p, j) => {
    const out = [];
    const rr = sampler(cfg.seed * 100 + j);
    for (let k = 0; k < p.W / 4.5; k += 1) {
      const x = p.cx + rr.range(-0.4, 0.4) * p.W;
      const y = p.cy + rr.range(-0.05, 0.3) * p.h;
      out.push(...fan(x, y, rr.range(2, 2.8), Math.PI + 0.35, TAU - 0.35, 4));
    }
    return out;
  });
  return { trunk, left, right, bark, branches, pads, needles, inner, cfg };
}

function pineObject(cfg) {
  const P = makePine(cfg);
  const roots = [[[cfg.x - cfg.w * 0.9, 698], [cfg.x - cfg.w * 1.6, 699.4]], [[cfg.x + cfg.w * 0.8, 698], [cfg.x + cfg.w * 1.7, 699.2]]];
  return {
    sil(ctx) {
      for (const br of P.branches) {
        trace(ctx, br.poly);
        ctx.fill();
      }
      trace(ctx, P.trunk);
      ctx.fill();
      for (const p of P.pads) {
        trace(ctx, p.poly);
        ctx.fill();
      }
    },
    paint(ctx, b, C) {
      const wood = (fn) => {
        for (const br of P.branches) fn(br.poly, "branch", br);
        carve(ctx, () => {
          trace(ctx, P.trunk);
          ctx.fill();
        });
        fn(P.trunk, "trunk");
      };
      if (b === "grey") wood((poly) => fillPts(ctx, poly, C(0.8)));
      else if (b === "ochre") wood((poly) => fillPts(ctx, poly, C(0.45)));
      else if (b === "indigo") {
        wood((poly, kind) => {
          if (kind !== "trunk") {
            fillPts(ctx, poly, C(0.45)); // limbs in shadow under the crowns
            return;
          }
          // shade down the trunk's far side
          const shade = ribbon(P.right.map((p, i) => [lerp(p[0], P.left[i][0], 0.18), p[1]]), 2.6);
          clipTo(ctx, poly, () => fillPts(ctx, shade, C(0.5)));
        });
      } else if (b === "key") {
        ctx.fillStyle = C(1);
        wood((poly, kind, br) => {
          if (kind === "trunk") {
            cut(ctx, P.left, 0.95, cfg.seed * 7 + 1, { step: 3.2, tip: 0.35 });
            cut(ctx, P.right, 0.95, cfg.seed * 7 + 2, { step: 3.2, tip: 0.35 });
            P.bark.forEach((m, i) => cut(ctx, m, 0.5, cfg.seed * 50 + i, { step: 1.2, tip: 0.1 }));
            roots.forEach((r, i) => cut(ctx, r, 0.7, cfg.seed * 5 + i));
          } else {
            const n = br.pts.length;
            const half = br.poly.length / 2;
            cut(ctx, br.poly.slice(1, half), 0.6, cfg.seed * 9 + n, { step: 2.4, tip: 0.3 });
            cut(ctx, br.poly.slice(half, br.poly.length - 1), 0.6, cfg.seed * 9 + n + 1, { step: 2.4, tip: 0.3 });
          }
        });
      }
      // the crowns, back to front
      P.pads.forEach((p, j) => {
        carve(ctx, () => {
          trace(ctx, p.poly);
          ctx.fill();
        });
        if (b === "green") fillPts(ctx, p.poly, C(0.95));
        else if (b === "dkgreen") {
          clipTo(ctx, p.poly, () => {
            ctx.fillStyle = vgrad(ctx, p.cy - p.h * 0.2, p.cy + p.h * 0.4, [[0, 0], [0.55, 0.7], [1, 0.95]], C);
            ctx.fillRect(p.cx - p.W, p.cy - p.h, p.W * 2, p.h * 2);
            ctx.fillStyle = C(0.85);
            ctx.lineWidth = 0.3;
            ctx.strokeStyle = C(0.9);
            ctx.lineCap = "round";
            ctx.beginPath();
            for (const [a, c] of P.inner[j]) {
              ctx.moveTo(a[0], a[1]);
              ctx.lineTo(c[0], c[1]);
            }
            ctx.stroke();
          });
        } else if (b === "key") {
          ctx.fillStyle = C(1);
          cut(ctx, p.bottom, 0.75, cfg.seed * 13 + j, { step: 2.4, tip: 0.2 });
          ctx.lineWidth = 0.3;
          ctx.strokeStyle = C(0.95);
          ctx.lineCap = "round";
          ctx.beginPath();
          for (const [a, c] of P.needles[j]) {
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(c[0], c[1]);
          }
          ctx.stroke();
        }
      });
    },
  };
}

function roadObject() {
  const far = [];
  const near = [];
  for (let x = SHEET.x0; x <= SHEET.x1; x += 5) {
    far.push([x, ROAD_FAR + 0.8 * Math.sin(x * 0.031) + 0.5 * (noise1(x * 0.05, 7) - 0.5)]);
    near.push([x, ROAD_NEAR + 1.4 * Math.sin(x * 0.017 + 1) + 0.8 * (noise1(x * 0.04, 8) - 0.5)]);
  }
  const poly = far.concat(near.slice().reverse());
  const rnd = sampler(1181);
  const pebbles = [];
  for (let i = 0; i < 90; i += 1) pebbles.push([rnd.range(SHEET.x0, SHEET.x1), rnd.range(ROAD_FAR + 4, ROAD_NEAR - 3), rnd.range(0.5, 1.1)]);
  const ruts = [];
  for (let i = 0; i < 26; i += 1) {
    const x = rnd.range(SHEET.x0, SHEET.x1);
    const y = rnd.range(ROAD_FAR + 8, ROAD_NEAR - 6);
    ruts.push([[x, y], [x + rnd.range(18, 46), y + rnd.range(-0.6, 0.6)]]);
  }
  // long cart ruts, cut in the key block, broken here and there
  const tracks = [];
  for (const y0 of [712, 718.5, 729, 735]) {
    for (let x = SHEET.x0 + rnd.range(0, 30); x < SHEET.x1; x += rnd.range(60, 130)) {
      const L = rnd.range(30, 90);
      tracks.push([[x, y0 + rnd.range(-0.8, 0.8)], [x + L * 0.5, y0 + rnd.range(-0.6, 0.6)], [x + L, y0 + rnd.range(-0.8, 0.8)]]);
    }
  }
  const tufts = [];
  for (let x = SHEET.x0; x < SHEET.x1; x += rnd.range(8, 22)) tufts.push([x, ROAD_FAR + 0.5]);
  return {
    sil(ctx) {
      trace(ctx, poly);
      ctx.fill();
    },
    paint(ctx, b, C) {
      if (b === "ochre") {
        // the road's ochre is wiped darker toward the near edge
        clipTo(ctx, poly, () => {
          ctx.fillStyle = vgrad(ctx, ROAD_FAR, ROAD_NEAR + 2, [[0, 0.7], [0.5, 0.78], [1, 0.95]], C);
          ctx.fillRect(SHEET.x0, ROAD_FAR - 2, SW, ROAD_NEAR - ROAD_FAR + 6);
        });
      } else if (b === "grey") {
        clipTo(ctx, poly, () => {
          ctx.fillStyle = vgrad(ctx, ROAD_FAR, ROAD_NEAR + 2, [[0, 0.4], [0.2, 0], [0.62, 0.04], [1, 0.55]], C);
          ctx.fillRect(SHEET.x0, ROAD_FAR - 2, SW, ROAD_NEAR - ROAD_FAR + 6);
          ctx.fillStyle = C(0.45);
          ruts.forEach((r, i) => cut(ctx, r, 0.6, 1200 + i, { step: 4 }));
        });
      } else if (b === "rose") {
        clipTo(ctx, poly, () => {
          ctx.fillStyle = vgrad(ctx, ROAD_FAR, ROAD_NEAR, [[0, 0], [1, 0.12]], C);
          ctx.fillRect(SHEET.x0, ROAD_FAR, SW, ROAD_NEAR - ROAD_FAR);
        });
      } else if (b === "key") {
        ctx.fillStyle = C(1);
        cut(ctx, far, 0.85, 171, { step: 4, tip: 0.5 });
        cut(ctx, near, 1.0, 172, { step: 4, tip: 0.5 });
        ctx.fillStyle = C(0.85);
        pebbles.forEach(([x, y, r], i) => cut(ctx, [[x - r, y], [x, y - r * 0.5], [x + r, y]], 0.35, 1300 + i, { step: 0.6, tip: 0.3 }));
        ctx.fillStyle = C(0.5);
        tracks.forEach((l, i) => cut(ctx, l, 0.4, 1350 + i, { step: 5, tip: 0.15 }));
        tufts.forEach(([x, y], i) => {
          cut(ctx, [[x, y], [x - 1.6, y - 3.4]], 0.35, 1400 + i);
          cut(ctx, [[x + 0.8, y], [x + 1.4, y - 4]], 0.35, 1450 + i);
        });
      } else if (b === "dkgreen") {
        ctx.fillStyle = C(0.8);
        tufts.forEach(([x, y]) => fillPts(ctx, [[x - 2.4, y + 0.4], [x - 1.5, y - 3], [x, y - 1.2], [x + 1.4, y - 3.8], [x + 2.6, y + 0.4]], C(0.8)));
      }
    },
  };
}

function puddleObject() {
  // the shower's puddles on the road, the sky's grey in them, rings where the drops strike
  const rnd = sampler(1185);
  const pools = [];
  for (let x = SHEET.x0 + 20; x < SHEET.x1 - 20; x += rnd.range(70, 150)) {
    const y = rnd.range(ROAD_FAR + 12, ROAD_NEAR - 8);
    pools.push({ x, y, rx: rnd.range(12, 30), ry: rnd.range(1.6, 3) });
  }
  const shape = (p) => ellipsePts(p.x, p.y, p.rx, p.ry, 22).map(([x, y], i) => [x + (hash(i, p.x, 3) - 0.5) * 1.6, y]);
  return {
    sil(ctx) {
      for (const p of pools) {
        trace(ctx, shape(p));
        ctx.fill();
      }
    },
    paint(ctx, b, C) {
      for (const p of pools) {
        const pts = shape(p);
        if (b === "pale") fillPts(ctx, pts, C(0.7));
        else if (b === "indigo") {
          clipTo(ctx, pts, () => {
            ctx.fillStyle = vgrad(ctx, p.y - p.ry, p.y + p.ry, [[0, 0.55], [1, 0.1]], C);
            ctx.fillRect(p.x - p.rx, p.y - p.ry, p.rx * 2, p.ry * 2);
          });
        } else if (b === "key") {
          ctx.fillStyle = C(0.9);
          cut(ctx, pts.slice(0, 12), 0.4, 1290 + Math.round(p.x), { step: 2, tip: 0.3 });
          for (let k = 0; k < 3; k += 1) {
            const cx = p.x + (hash(k, p.x, 5) - 0.5) * p.rx * 1.2;
            const r = 1.6 + hash(k, p.x, 6) * 2;
            cut(ctx, ellipsePts(cx, p.y, r, r * 0.3, 10, Math.PI * 1.05, TAU - 0.15), 0.25, 1296 + k + Math.round(p.x), { step: 0.6 });
          }
        }
      }
    },
  };
}

function bankObject() {
  const top = [];
  for (let x = SHEET.x0; x <= SHEET.x1; x += 5) top.push([x, ROAD_NEAR + 1.4 * Math.sin(x * 0.017 + 1) + 0.8 * (noise1(x * 0.04, 8) - 0.5)]);
  const poly = top.concat([[SHEET.x1, SHEET.y1], [SHEET.x0, SHEET.y1]]);
  const rnd = sampler(1191);
  const hatch = [];
  for (let i = 0; i < 260; i += 1) {
    const x = rnd.range(SHEET.x0, SHEET.x1);
    const y = rnd.range(ROAD_NEAR + 16, 792);
    const n = rnd.int(2, 4);
    for (let k = 0; k < n; k += 1) hatch.push([[x + k * 1.6, y], [x + k * 1.6 + 1.2, y - rnd.range(3, 5.5)]]);
  }
  const clumps = [];
  for (let x = SHEET.x0 + 10; x < SHEET.x1; x += rnd.range(28, 70)) {
    const y = rnd.range(ROAD_NEAR + 20, 778);
    const n = rnd.int(5, 9);
    const blades = [];
    for (let k = 0; k < n; k += 1) {
      const a = -Math.PI / 2 + (k / (n - 1) - 0.5) * rnd.range(1.4, 2.0);
      const L = rnd.range(6, 12) * (1 - Math.abs(k / (n - 1) - 0.5));
      blades.push([[x + (k - n / 2) * 0.5, y], [x + Math.cos(a) * L * 0.5 + (k - n / 2) * 0.5, y + Math.sin(a) * L * 0.55], [x + Math.cos(a) * L + (k - n / 2) * 0.3, y + Math.sin(a) * L]]);
    }
    clumps.push(blades);
  }
  const lines = [];
  for (let y = ROAD_NEAR + 9; y < 790; y += rnd.range(9, 14)) {
    const x = rnd.range(SHEET.x0, SHEET.x1);
    lines.push([[x, y], [x + rnd.range(40, 120), y + rnd.range(-1, 1)]]);
  }
  return {
    sil(ctx) {
      trace(ctx, poly);
      ctx.fill();
    },
    paint(ctx, b, C) {
      if (b === "green") fillPts(ctx, poly, C(0.88));
      else if (b === "dkgreen") {
        ctx.fillStyle = vgrad(ctx, ROAD_NEAR, BORDER.y1, [[0, 0.12], [0.35, 0], [1, 0.8]], C);
        ctx.fillRect(SHEET.x0, ROAD_NEAR - 2, SW, SHEET.y1 - ROAD_NEAR);
        ctx.fillStyle = C(0.6);
        lines.forEach((l, i) => cut(ctx, l, 0.5, 1500 + i, { step: 5 }));
        ctx.fillStyle = C(0.95);
        clumps.forEach((c, i) => c.forEach((bl, j) => cut(ctx, bl, 1.3, 1700 + i * 10 + j, { step: 1.5, tip: 0.1 })));
      } else if (b === "ochre") {
        ctx.fillStyle = vgrad(ctx, ROAD_NEAR, ROAD_NEAR + 14, [[0, 0.4], [1, 0]], C);
        ctx.fillRect(SHEET.x0, ROAD_NEAR - 2, SW, 16);
      } else if (b === "key") {
        ctx.fillStyle = C(0.9);
        hatch.forEach((h, i) => cut(ctx, h, 0.4, 1600 + (i % 300), { tip: 0.2 }));
        clumps.forEach((c, i) => c.forEach((bl, j) => cut(ctx, bl, 0.35, 1800 + i * 10 + j, { step: 1.5, tip: 0.1 })));
      }
    },
  };
}

function stonesObject() {
  // the causeway's stone facing, just below the road's near edge
  const rnd = sampler(1211);
  const stones = [];
  const nearY = (x) => ROAD_NEAR + 1.4 * Math.sin(x * 0.017 + 1) + 0.8 * (noise1(x * 0.04, 8) - 0.5);
  for (let row = 0; row < 2; row += 1) {
    let x = SHEET.x0 + (row ? -9 : 0);
    while (x < SHEET.x1) {
      const w = rnd.range(14, 26);
      const y0 = nearY(x + w / 2) + 0.6 + row * 5.6;
      const h = 5.4;
      const j = () => rnd.range(-0.6, 0.6);
      stones.push([[x + 0.8 + j(), y0 + j() * 0.4], [x + w - 0.8 + j(), y0 + j() * 0.4], [x + w - 0.4, y0 + h + j() * 0.5], [x + 0.4, y0 + h + j() * 0.5]]);
      x += w;
    }
  }
  const poly = [];
  for (let x = SHEET.x0; x <= SHEET.x1; x += 10) poly.push([x, nearY(x) - 0.4]);
  for (let x = SHEET.x1; x >= SHEET.x0; x -= 10) poly.push([x, nearY(x) + 12.4]);
  return {
    sil(ctx) {
      trace(ctx, poly);
      ctx.fill();
    },
    paint(ctx, b, C) {
      if (b === "grey") {
        fillPts(ctx, poly, C(0.45));
        stones.forEach((st, i) => fillPts(ctx, st, C([0.25, 0.4, 0.15, 0.32, 0.2][i % 5])));
      } else if (b === "indigo") {
        ctx.fillStyle = vgrad(ctx, ROAD_NEAR, ROAD_NEAR + 12, [[0, 0.3], [0.4, 0], [1, 0.25]], C);
        ctx.fillRect(SHEET.x0, ROAD_NEAR - 2, SW, 16);
      } else if (b === "key") {
        ctx.fillStyle = C(0.95);
        stones.forEach((st, i) => cut(ctx, st, 0.42, 2100 + i, { closed: true, step: 2.5, jitter: 0.2 }));
      } else if (b === "dkgreen") {
        // grass creeping between the stones
        ctx.fillStyle = C(0.8);
        stones.forEach((st, i) => {
          if (i % 3) return;
          const [x, y] = st[3];
          fillPts(ctx, [[x - 2, y + 0.5], [x - 1, y - 3], [x, y - 0.6], [x + 1.4, y - 3.6], [x + 2.4, y + 0.5]], C(0.85));
        });
      }
    },
  };
}

function mileMarkerObject() {
  const x = 156;
  const poly = [[x - 4.6, 698], [x - 4.6, 664], [x, 659], [x + 4.6, 664], [x + 4.6, 698]];
  return {
    sil(ctx) {
      trace(ctx, poly);
      ctx.fill();
    },
    paint(ctx, b, C) {
      if (b === "grey") {
        fillPts(ctx, poly, C(0.55));
        fillPts(ctx, [[x + 1.8, 698], [x + 1.8, 662.5], [x + 4.6, 664], [x + 4.6, 698]], C(0.5));
      } else if (b === "key") {
        ctx.fillStyle = C(1);
        cut(ctx, poly, 0.6, 191, { closed: true, step: 2 });
        cut(ctx, [[x + 1.8, 662.4], [x + 1.8, 698]], 0.35, 192);
        ["東", "海", "道"].forEach((ch, i) => drawText(ctx, ch, x - 1.4, 669 + i * 5.4, { font: `500 4.6px ${FONT_KAI}`, align: "center", baseline: "middle", fill: C(1) }));
      }
    },
  };
}

// The title: three cartouches at the upper left, as on a print in a series.
// The whole title spans x 158 … 332 (174 units): in full view at zoom 1.1 from u ≈ 0.17 to 2.8.
const LABEL = { x0: 220, y0: 444, x1: 296, y1: 520 };
const SLIP = { x0: 301, y0: 444, x1: 332, y1: 520 };
const STRIP = { x0: 158, y0: 524, x1: 332, y1: 566 };
const TITLE_BOXES = [LABEL, SLIP, STRIP];
const TITLE_R = { x0: 150, y0: 438, x1: 340, y1: 572 };

function titleObject() {
  const boxes = TITLE_BOXES.map((r) => rect(r.x0, r.y0, r.x1, r.y1));
  const column = (ctx, chars, cx, y0, size, step, fill) => chars.forEach((ch, i) => drawText(ctx, ch, cx, y0 + i * step, { font: `600 ${size}px ${FONT_KAI}`, align: "center", baseline: "middle", fill }));
  return {
    sil(ctx) {
      boxes.forEach((bx) => {
        trace(ctx, bx);
        ctx.fill();
      });
    },
    paint(ctx, b, C) {
      if (b === "ochre") {
        fillPts(ctx, boxes[0], C(0.8));
        fillPts(ctx, rect(SLIP.x0 + 3, SLIP.y0 + 3, SLIP.x1 - 3, SLIP.y1 - 3), C(0.22));
      } else if (b === "rose") {
        // the slip's red border
        const o = rect(SLIP.x0, SLIP.y0, SLIP.x1, SLIP.y1);
        fillPts(ctx, o, C(0.95));
        carve(ctx, () => ctx.fillRect(SLIP.x0 + 2.6, SLIP.y0 + 2.6, SLIP.x1 - SLIP.x0 - 5.2, SLIP.y1 - SLIP.y0 - 5.2));
      } else if (b === "pale") {
        fillPts(ctx, boxes[2], C(0.42));
      } else if (b === "key") {
        ctx.fillStyle = C(1);
        boxes.forEach((bx, i) => cut(ctx, bx, 0.8, 201 + i, { closed: true, step: 3, vary: 0.15 }));
        cut(ctx, rect(LABEL.x0 + 2.2, LABEL.y0 + 2.2, LABEL.x1 - 2.2, LABEL.y1 - 2.2), 0.35, 205, { closed: true, step: 4 });
        const lc = (LABEL.x0 + LABEL.x1) / 2;
        column(ctx, ["东", "海", "道"], lc + 17, 457, 15.5, 16.6, C(1));
        column(ctx, ["五", "十", "三", "次", "之", "外"], lc - 15, 451.4, 12.2, 11.9, C(1));
        column(ctx, ["浮", "世", "绘"], (SLIP.x0 + SLIP.x1) / 2, 458.5, 21.5, 24, C(1));
        // Kaiti's Latin letters and figures are small for their size: set large enough that
        // capitals and digits stand about 9 units (28 px at zoom 1.1) tall
        const sx = (STRIP.x0 + STRIP.x1) / 2;
        drawText(ctx, META.en, sx, 535, { font: `600 16px ${FONT_KAI}`, align: "center", baseline: "middle", fill: C(1), spacing: 0.6 });
        drawText(ctx, `${META.date} · ${META.dateEn}`, sx, 555.5, { font: `600 15.5px ${FONT_KAI}`, align: "center", baseline: "middle", fill: C(1) });
      }
    },
  };
}

function sealObject() {
  // a small red gourd-shaped seal in the place of the artist's signature
  const x = 48;
  const gourd = smoothClosed([[x, 744], [x + 5.4, 748.5], [x + 3.4, 754.5], [x + 7.6, 760], [x + 6.6, 768], [x, 771], [x - 6.6, 768], [x - 7.6, 760], [x - 3.4, 754.5], [x - 5.4, 748.5]], 5);
  return {
    sil(ctx) {
      trace(ctx, gourd);
      ctx.fill();
    },
    paint(ctx, b, C) {
      if (b !== "rose") return;
      fillPts(ctx, gourd, C(1));
      carve(ctx, () => {
        drawText(ctx, "鹈", x, 750.2, { font: `700 7px ${FONT_KAI}`, align: "center", baseline: "middle", fill: "#000" });
        drawText(ctx, "斋", x, 762.5, { font: `700 9.5px ${FONT_KAI}`, align: "center", baseline: "middle", fill: "#000" });
        ctx.lineWidth = 0.6;
        trace(ctx, gourd.map(([px, py]) => [x + (px - x) * 0.86, 757.5 + (py - 757.5) * 0.9]));
        ctx.stroke();
      });
    },
  };
}

function borderObject() {
  return {
    paint(ctx, b, C) {
      if (b !== "key") return;
      ctx.fillStyle = C(1);
      cut(ctx, rect(BORDER.x0 + 0.6, BORDER.y0 + 0.6, BORDER.x1 - 0.6, BORDER.y1 - 0.6), 1.1, 211, { closed: true, step: 6, vary: 0.12, jitter: 0.08 });
    },
  };
}

const WORLD = {};
/** The view, back to front. The storm variant is the same print with Fuji and the far shore lost in the rain. */
function world(storm = false) {
  const key = storm ? "storm" : "fair";
  if (WORLD[key]) return WORLD[key];
  WORLD[key] = [
    skyObject(),
    ...(storm ? [] : [cloudObject()]),
    ...(storm ? [fujiGhostObject()] : [flockObject(), fujiObject(), farShoreObject()]),
    headlandObject(),
    seaObject(),
    boatObject(106, 641, 0.95, 221),
    boatObject(262, 648, 1.15, 222, -1),
    boatObject(352, 637, 0.75, 223),
    boatObject(912, 643, 1.05, 224, -1),
    fieldsObject(),
    villageObject(),
    teaHouseObject(),
    roadObject(),
    roadThingsObject(),
    ...(storm ? [puddleObject()] : []),
    mileMarkerObject(),
    ...PINES.map(pineObject),
    bankObject(),
    flowersObject(),
    stonesObject(),
    titleObject(),
    sealObject(),
    borderObject(),
  ];
  return WORLD[key];
}

// ------------------------------------------------------------------ wood grain and paper
/** A periodic value noise, so the grain tile repeats without a seam. */
function pnoise(x, y, px, py, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const f = (t) => t * t * (3 - 2 * t);
  const fx = f(x - ix);
  const fy = f(y - iy);
  const h = (a, b) => hash(((a % px) + px) % px, ((b % py) + py) % py, seed);
  const a = h(ix, iy);
  const b = h(ix + 1, iy);
  const c = h(ix, iy + 1);
  const d = h(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

const GRAIN_W = 768;
const GRAIN_H = 384;
let GRAIN = null;
/** Wood grain and ink starvation as an alpha tile (at 1080p scale); removed from each block. */
function grainTile(stage) {
  if (GRAIN) return GRAIN;
  const layer = new Layer2D(stage.p, GRAIN_W, GRAIN_H);
  const img = layer.ctx.createImageData(GRAIN_W, GRAIN_H);
  const d = img.data;
  for (let y = 0; y < GRAIN_H; y += 1) {
    for (let x = 0; x < GRAIN_W; x += 1) {
      const warp = pnoise(x / 192, y / 96, 4, 4, 5) * 2.2 + pnoise(x / 384, y / 192, 2, 2, 6) * 2.8;
      const ring = y / 6 + warp;
      const v = Math.abs(ring - Math.floor(ring) - 0.5) * 2;
      const line = smoothstep(0.8, 1, v) * (0.35 + 0.65 * pnoise(x / 48, y / 12, 16, 32, 7));
      const blot = smoothstep(0.6, 0.85, pnoise(x / 32, y / 20, 24, 19.2, 8)) * 0.6;
      const speck = hash(x, y, 9) > 0.993 ? 0.7 : 0;
      const a = clamp(line * 0.75 + blot * 0.5 + speck);
      const i = (y * GRAIN_W + x) * 4;
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = Math.round(a * 255);
    }
  }
  layer.ctx.putImageData(img, 0, 0);
  GRAIN = layer;
  return GRAIN;
}

let GRAIN_PAPER = null;
/** The same grain in the colour of the paper: laid over a figure, the colour looks starved where the wood shows. */
function grainPaperTile(stage) {
  if (GRAIN_PAPER) return GRAIN_PAPER;
  const g = grainTile(stage);
  const layer = new Layer2D(stage.p, GRAIN_W, GRAIN_H);
  layer.ctx.drawImage(g.canvas, 0, 0);
  layer.ctx.globalCompositeOperation = "source-in";
  layer.ctx.fillStyle = PAPER;
  layer.ctx.fillRect(0, 0, GRAIN_W, GRAIN_H);
  layer.ctx.globalCompositeOperation = "source-over";
  GRAIN_PAPER = layer;
  return GRAIN_PAPER;
}

/** Lay the wood grain over everything already painted on ctx (world units), anchored at (ax, ay) so it travels with the figure. */
function grainOver(ctx, stage, ax, ay, alpha, box) {
  const tile = grainPaperTile(stage);
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.globalAlpha = alpha;
  const pat = ctx.createPattern(tile.canvas, "repeat");
  pat.setTransform(new DOMMatrix([1 / PX, 0, 0, 1 / PX, ax, ay]));
  ctx.fillStyle = pat;
  ctx.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
  ctx.restore();
}

/** Print objs block by block onto paper over the world rectangle R (at k px/unit), into ctx. */
function printBlocks(stage, ctx, objs, R, k) {
  const w = Math.round((R.x1 - R.x0) * k);
  const h = Math.round((R.y1 - R.y0) * k);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  const scratch = new Layer2D(stage.p, w, h);
  const grain = grainTile(stage);
  for (const blk of BLOCKS) {
    const sc = scratch.clear();
    sc.setTransform(k, 0, 0, k, -R.x0 * k, -R.y0 * k);
    sc.save();
    sc.beginPath();
    sc.rect(BORDER.x0, BORDER.y0, BORDER.x1 - BORDER.x0, BORDER.y1 - BORDER.y0);
    sc.clip();
    const C = (a = 1) => rgba(blk.color, a);
    for (const o of objs) {
      if (o.sil) carve(sc, () => o.sil(sc));
      if (o.paint) {
        sc.save();
        o.paint(sc, blk.id, C);
        sc.restore();
      }
    }
    sc.restore();
    // the wood shows: grain and starved patches lift a little of the colour (anchored to the sheet)
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.globalCompositeOperation = "destination-out";
    sc.globalAlpha = blk.grain;
    const pat = sc.createPattern(grain.canvas, "repeat");
    pat.setTransform(new DOMMatrix([stage.s, 0, 0, stage.s, (blk.go[0] - (R.x0 - SHEET.x0)) * k, (blk.go[1] - (R.y0 - SHEET.y0)) * k]));
    sc.fillStyle = pat;
    sc.fillRect(0, 0, w, h);
    sc.globalAlpha = 1;
    sc.globalCompositeOperation = "source-over";
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(scratch.canvas, blk.reg[0] * k, blk.reg[1] * k);
    ctx.globalCompositeOperation = "source-over";
  }
}

function bakePrint(stage, storm = false) {
  const k = PX * stage.s;
  return stage.bake2d(`ukiyoe/print${storm ? "-storm" : ""}/${k.toFixed(3)}`, Math.round(SW * k), Math.round(SH * k), (ctx) => printBlocks(stage, ctx, world(storm), SHEET, k));
}

/**
 * The cartouches printed again on their own, cut to their outlines. They are laid over the
 * storm grey and the rain, as a print's cartouches sit on top of the picture, so the title
 * keeps its contrast through the shower.
 */
function bakeTitle(stage) {
  const k = PX * stage.s;
  const R = TITLE_R;
  const w = Math.round((R.x1 - R.x0) * k);
  const h = Math.round((R.y1 - R.y0) * k);
  return stage.bake2d(`ukiyoe/title/${k.toFixed(3)}`, w, h, (ctx) => {
    const t = titleObject();
    printBlocks(stage, ctx, [t], R, k);
    ctx.setTransform(k, 0, 0, k, -R.x0 * k, -R.y0 * k);
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = "#000";
    // one path for all three boxes: destination-in must be applied once
    ctx.beginPath();
    for (const r of TITLE_BOXES) ctx.rect(r.x0 - 1.6, r.y0 - 1.6, r.x1 - r.x0 + 3.2, r.y1 - r.y0 + 3.2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  });
}

/** Washi on top of everything: fibres, a soft mottle, and age at the margins. */
function bakePaper(stage) {
  const k = PX * stage.s;
  const w = Math.round(SW * k);
  const h = Math.round(SH * k);
  return stage.bake2d(`ukiyoe/paper/${k.toFixed(3)}`, w, h, (ctx) => {
    // mottle, computed small and enlarged
    const mw = Math.ceil(SW / 2);
    const mh = Math.ceil(SH / 2);
    const m = new Layer2D(stage.p, mw, mh);
    const img = m.ctx.createImageData(mw, mh);
    for (let y = 0; y < mh; y += 1) {
      for (let x = 0; x < mw; x += 1) {
        const n = pnoise(x / 22, y / 22, 1e6, 1e6, 21) * 0.6 + pnoise(x / 7, y / 7, 1e6, 1e6, 22) * 0.4;
        const i = (y * mw + x) * 4;
        const dark = n > 0.5;
        img.data[i] = dark ? 120 : 255;
        img.data[i + 1] = dark ? 96 : 251;
        img.data[i + 2] = dark ? 60 : 238;
        img.data[i + 3] = Math.round(Math.abs(n - 0.5) * 2 * (dark ? 34 : 40));
      }
    }
    m.ctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(m.canvas, 0, 0, w, h);
    ctx.setTransform(k, 0, 0, k, -SHEET.x0 * k, -SHEET.y0 * k);
    // fibres
    const rnd = sampler(1201);
    ctx.lineCap = "round";
    for (let i = 0; i < 2600; i += 1) {
      const x = rnd.range(SHEET.x0, SHEET.x1);
      const y = rnd.range(SHEET.y0, SHEET.y1);
      const len = rnd.range(1.5, 7);
      const a = rnd.range(0, TAU);
      const bend = rnd.range(-0.6, 0.6);
      const light = rnd.chance(0.72);
      ctx.strokeStyle = light ? `rgba(255,252,240,${rnd.range(0.1, 0.28)})` : `rgba(110,88,56,${rnd.range(0.05, 0.11)})`;
      ctx.lineWidth = rnd.range(0.1, 0.24);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(a + bend) * len * 0.5, y + Math.sin(a + bend) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
    // age: the sheet is a little browned at its margins and has a few foxing spots
    const edge = (x0, y0, x1, y1) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, "rgba(150,112,60,0.16)");
      g.addColorStop(1, "rgba(150,112,60,0)");
      return g;
    };
    ctx.fillStyle = edge(0, BORDER.y0 - 6, 0, BORDER.y0 + 18);
    ctx.fillRect(SHEET.x0, SHEET.y0, SW, BORDER.y0 + 18 - SHEET.y0);
    ctx.fillStyle = edge(0, BORDER.y1 + 6, 0, BORDER.y1 - 18);
    ctx.fillRect(SHEET.x0, BORDER.y1 - 18, SW, SHEET.y1 - BORDER.y1 + 18);
    for (let i = 0; i < 14; i += 1) {
      const x = rnd.range(SHEET.x0, SHEET.x1);
      const y = rnd.range(SHEET.y0, SHEET.y1);
      const r = rnd.range(0.6, 2.2);
      ctx.fillStyle = `rgba(150,105,55,${rnd.range(0.08, 0.18)})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
  });
}

// ------------------------------------------------------------------ the shower
const RAIN_P = 420; // the rain block repeats every 420 units across
const RAIN_TOP = SHEET.y0 - 40;
const RAIN_H = SH + 80;
// Two line blocks: fine, even, ruled lines. The 72° set is the main printing; the 76° set is
// printed lighter and bluer, so the two slants stay distinct.
const RAIN_SETS = [
  { deg: 72, n: 440, seed: 1301, rgb: "40,42,52", alpha: [0.5, 0.6], w: [0.34, 0.4], len: [125, 150] },
  { deg: 76, n: 340, seed: 1302, rgb: "58,66,84", alpha: [0.36, 0.44], w: [0.3, 0.35], len: [110, 135] },
];

function bakeRain(stage, set) {
  const k = PX * stage.s;
  const S = RAIN_SETS[set];
  return stage.bake2d(`ukiyoe/rain${set}/${k.toFixed(3)}`, Math.round(RAIN_P * k), Math.round(RAIN_H * k), (ctx) => {
    ctx.scale(k, k);
    const rnd = sampler(S.seed);
    const a = (S.deg * Math.PI) / 180;
    const dx = -Math.cos(a);
    const dy = Math.sin(a);
    // lines evenly spaced across the block (a little jitter), in staggered rows down it
    const rows = 4;
    const per = Math.ceil(S.n / rows);
    for (let i = 0; i < S.n; i += 1) {
      const col = i % per;
      const row = Math.floor(i / per);
      const x = ((col + rnd.range(0.3, 0.7)) / per) * RAIN_P;
      const y = -60 + ((row + rnd.range(0.05, 0.6) + (col % 2) * 0.35) / rows) * (RAIN_H + 60);
      const len = rnd.range(S.len[0], S.len[1]);
      const w = rnd.range(S.w[0], S.w[1]);
      ctx.fillStyle = `rgba(${S.rgb},${rnd.range(S.alpha[0], S.alpha[1])})`;
      for (const ox of [-RAIN_P, 0, RAIN_P]) {
        cut(ctx, [[x + ox, y], [x + ox + dx * len, y + dy * len]], w, S.seed + i, { step: 20, jitter: 0.02, vary: 0.08, tip: 0.35, taper: 10 });
      }
    }
  });
}

/** The storm's grey gradation, one continuous wiped gradient down the whole sheet. */
function stormGradient(ctx, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  const at = (y) => (y - SHEET.y0) / SH;
  g.addColorStop(0, "rgba(30,34,44,0.78)");
  g.addColorStop(at(470), "rgba(40,46,58,0.66)");
  g.addColorStop(at(540), "rgba(70,76,88,0.42)");
  g.addColorStop(at(600), "rgba(120,124,128,0.36)");
  g.addColorStop(at(632), "rgba(128,130,132,0.34)");
  g.addColorStop(at(690), "rgba(60,64,72,0.14)");
  g.addColorStop(1, "rgba(50,54,62,0.12)");
  return g;
}

const rainAmount = (u) => smoothstep(2.0, 2.18, u) * (0.82 + 0.18 * smoothstep(2.2, 3.0, u)) * (1 - smoothstep(4.6, 5.2, u));
const rainAmountB = (u) => smoothstep(2.06, 2.3, u) * (1 - smoothstep(4.55, 4.95, u));
const stormWipe = (u) => {
  const t = clamp((u - 2.0) / 0.4);
  return 1 - (1 - t) * (1 - t);
};
// the storm print replaces the fair one completely, so Fuji's key line goes with its colour
const fujiVeil = (u) => smoothstep(2.05, 2.6, u) * (1 - smoothstep(4.7, 5.2, u));
const stormAlpha = (u) => (u < 2 ? 0 : 1 - smoothstep(4.6, 5.2, u));

function drawStorm(stage, view, u) {
  const a = stormAlpha(u);
  if (a <= 0.001) return;
  // A thin column, repainted each frame: the grey gradation, then a soft mask whose edge moves
  // continuously with the wipe (no steps), drawn stretched across the whole sheet.
  const h = Math.round(SH * PX * stage.s);
  const layer = stage.layer("ukiyoe/stormwipe", 4, h);
  const ctx = layer.clear();
  const soft = 70;
  const front = SHEET.y0 - soft + (SH + soft + 10) * stormWipe(u);
  ctx.globalAlpha = a;
  ctx.fillStyle = stormGradient(ctx, h);
  ctx.fillRect(0, 0, 4, h);
  if (front < SHEET.y1) {
    const toPx = (y) => ((y - SHEET.y0) / SH) * h;
    const m = ctx.createLinearGradient(0, toPx(front), 0, toPx(front + soft));
    m.addColorStop(0, "rgba(0,0,0,1)");
    m.addColorStop(0.5, "rgba(0,0,0,0.42)");
    m.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = m;
    ctx.fillRect(0, 0, 4, h);
  }
  layer.touch();
  stage.withView(view, () => stage.image(layer, SHEET.x0, SHEET.y0, SW, SH));
}

function drawRain(stage, view, u) {
  const amounts = [rainAmount(u), rainAmountB(u)];
  if (amounts[0] <= 0.001 && amounts[1] <= 0.001) return;
  // three printings of the line block, a little offset, changed at 12 Hz
  const j = Math.floor(stepTime(u, 12) * 12 + 1e-6) % 3;
  const texs = [bakeRain(stage, 0), bakeRain(stage, 1)];
  stage.withView(view, () => {
    for (let s = 0; s < 2; s += 1) {
      if (amounts[s] <= 0.001) continue;
      const tex = texs[s];
      const a = (RAIN_SETS[s].deg * Math.PI) / 180;
      const off = [0, 11, 23][(j + s) % 3];
      const ox = -off * (Math.cos(a) / Math.sin(a)) + (s ? 137 : 0);
      for (let i = -1; i < 3; i += 1) stage.image(tex, SHEET.x0 + ox + i * RAIN_P, RAIN_TOP + off - 20, RAIN_P, RAIN_H, amounts[s]);
    }
  });
}

// ------------------------------------------------------------------ figures in the print
const FC = {
  paper: PAPER,
  skin: ink("#f4dcc4", 1),
  shade: ink(PALE, 0.3),
  indigo: ink(INDIGO, 0.95),
  blue: ink(PRUSSIAN, 0.88),
  pale: ink(PALE, 0.75),
  ochre: ink(OCHRE, 0.88),
  straw: ink("#c8a25a", 0.92),
  strawDk: ink("#8a7449", 0.92),
  rose: ink(ROSE, 0.92),
  green: ink(GREEN, 0.85),
  mino: ink("#7d7a4a", 0.92),
  grey: ink(WGREY, 0.85),
  wood: ink("#94704a", 0.92),
  hair: ink("#2a2622", 1),
};
const FREG = { skin: [0.8, 0.6], indigo: [1.0, -0.6], blue: [-0.8, 0.8], ochre: [-1.0, -0.5], straw: [-1.0, -0.5], rose: [1.0, 0.8], shade: [-0.6, 1.0], grey: [-0.5, 1.0], mino: [0.7, 0.8] };

function figurePainter(ctx) {
  const fill = (pts, col, reg) => {
    ctx.save();
    if (reg) ctx.translate(reg[0], reg[1]);
    fillPts(ctx, pts, col);
    ctx.restore();
  };
  let seed = 1;
  const key = (pts, w = 0.7, opts = {}) => {
    ctx.fillStyle = KEY;
    seed += 1;
    cut(ctx, pts, w, seed, { step: 1.6, jitter: 0.08, ...opts });
  };
  const shape = (pts, col, reg, w = 0.7) => {
    fill(pts, col, reg);
    key(pts, w, { closed: true });
  };
  return { fill, key, shape, ctx };
}

function head(F, c, { face = 1, hair = "bun", tilt = 0 } = {}) {
  // a profile head facing +x: a few cut lines for the face
  const [x, y] = c;
  const r = (pts) => pts.map(([px, py]) => [x + px * Math.cos(tilt) - py * Math.sin(tilt), y + px * Math.sin(tilt) + py * Math.cos(tilt)]);
  const outline = r([[-4.6, -2.8], [-2, -5.6], [2.6, -5.4], [4.6, -2.6], [5.6, 0.4], [6.6, 1.4], [5.4, 2.2], [5.6, 3.4], [4.2, 4.4], [1.6, 5], [-1.6, 4.4], [-4.4, 2]]);
  F.fill(outline, FC.skin, FREG.skin);
  F.key(outline, 0.55, { closed: true });
  if (hair === "bun") {
    const h = r([[-4.8, -2.6], [-2.2, -5.9], [2.6, -5.7], [3.4, -3.6], [0, -3.2], [-1.6, -1], [-3.6, 1.6], [-5, 0.4]]);
    F.fill(h, FC.hair);
    F.fill(r([[-1.6, -6.2], [1.4, -8.4], [3.4, -7.2], [1.6, -5.4]]), FC.hair);
  } else if (hair === "band") {
    const h = r([[-4.8, -2.6], [-2.2, -5.9], [2.6, -5.7], [3.4, -3.6], [0, -3.2], [-3.6, 1.6], [-5, 0.4]]);
    F.fill(h, FC.hair);
    const band = r([[-5, -2.2], [3.8, -4.4], [4.2, -2.8], [-4.8, -0.6]]);
    F.fill(band, FC.paper);
    F.key(band, 0.4, { closed: true });
    F.key(r([[-4.8, -1.4], [-8.4, -2.6], [-9.6, -0.6]]), 0.5);
    F.key(r([[-4.8, -1.2], [-8, 0.6], [-9.2, 2.6]]), 0.5);
  }
  F.key(r([[2.2, -1.2], [3.6, -1.5]]), 0.5 * face);
  F.key(r([[3.5, -2.6], [2.3, -2.9]]), 0.35);
  F.key(r([[-0.8, 0.2], [-0.2, 1.4], [-0.9, 2.2]]), 0.35);
  F.key(r([[4.6, 3.2], [3.6, 3.1]]), 0.35);
}

function leg(F, hip, foot, l1, l2, { col = FC.skin, reg = FREG.skin, w0 = 5.6, w1 = 3.4, legging = null, dir = 1, sandal = true }) {
  const knee = ik(hip, foot, l1, l2, dir);
  const pts = [hip, knee, foot];
  const poly = ribbon(pts, [w0, w0 * 0.72, w1]);
  F.fill(poly, col, reg);
  if (legging) {
    const sh = [[lerp(knee[0], foot[0], 0.12), lerp(knee[1], foot[1], 0.12)], [lerp(knee[0], foot[0], 0.88), lerp(knee[1], foot[1], 0.88)]];
    F.shape(ribbon(sh, [w0 * 0.8, w1 * 1.05]), legging, FREG.indigo, 0.45);
  }
  const half = poly.length / 2;
  F.key(poly.slice(0, half), 0.55, { tip: 0.4 });
  F.key(poly.slice(half), 0.55, { tip: 0.4 });
  // the calf
  F.key([[lerp(knee[0], foot[0], 0.2) - 1.6, lerp(knee[1], foot[1], 0.2)], [lerp(knee[0], foot[0], 0.45) - 2.2, lerp(knee[1], foot[1], 0.45)]], 0.35);
  if (sandal) {
    const [fx, fy] = foot;
    const s = [[fx - 2.6, fy + 0.4], [fx + 5.4, fy + 0.4], [fx + 5.6, fy + 1.6], [fx - 2.8, fy + 1.6]];
    F.shape(s, FC.straw, FREG.straw, 0.4);
    F.fill([[fx - 2, fy - 1.2], [fx + 4.8, fy - 0.6], [fx + 5, fy + 0.6], [fx - 2, fy + 0.6]], FC.skin, FREG.skin);
    F.key([[fx - 2, fy - 1.2], [fx + 4.8, fy - 0.6], [fx + 5, fy + 0.6]], 0.45);
    F.key([[fx + 2.2, fy - 0.8], [fx + 3.4, fy + 0.5]], 0.35);
  }
  return knee;
}

function staff(F, a, b) {
  const poly = ribbon([a, b], [1.5, 1.7]);
  F.fill(poly, FC.wood, FREG.ochre);
  const half = poly.length / 2;
  F.key(poly.slice(0, half), 0.4, { tip: 0.6 });
  F.key(poly.slice(half), 0.4, { tip: 0.6 });
}

function sedgeHat(F, c, w, tilt, under = true) {
  const r = (pts) => pts.map(([px, py]) => [c[0] + px * Math.cos(tilt) - py * Math.sin(tilt), c[1] + px * Math.sin(tilt) + py * Math.cos(tilt)]);
  const apex = [0, -w * 0.32];
  const brim = smoothOpen([[-w / 2, 0], [-w * 0.25, -w * 0.13], [0, -w * 0.32], [w * 0.25, -w * 0.13], [w / 2, 0]], 4);
  const lower = ellipsePts(0, 0, w / 2, w * 0.055, 16, 0, Math.PI).reverse();
  if (under) F.fill(r(ellipsePts(0, 0, w / 2, w * 0.07, 20, 0, Math.PI)), FC.strawDk, FREG.straw);
  F.fill(r(brim.concat(lower)), FC.straw, FREG.straw);
  F.key(r(brim.concat(lower)), 0.6, { closed: true });
  for (let i = 1; i < 8; i += 1) {
    const t = i / 8;
    F.key(r([apex, [lerp(-w / 2, w / 2, t), w * 0.04 * Math.sin(Math.PI * t)]]), 0.28, { tip: 0.3 });
  }
}

// --- the pilgrim: wide sedge hat, white robe, staff; heading right
function paintPilgrim(ctx, mode, f) {
  const F = figurePainter(ctx);
  const run = mode === "run";
  const hip = [0, run ? -41 : -43];
  const WALK = [
    { n: [11, 0], fa: [-10, -1.6] },
    { n: [3, -0.5], fa: [-1, -5] },
    { n: [-9, -1.5], fa: [10, 0] },
  ];
  const RUN = [
    { n: [17, -1], fa: [-14, -13] },
    { n: [-5, -11], fa: [9, 0] },
  ];
  const ft = run ? RUN[f % 2] : WALK[f % 3];
  const lean = run ? 0.3 : 0.04;
  // far leg, near leg
  leg(F, [hip[0] - 2, hip[1]], ft.fa, 22, 22, { legging: FC.indigo, col: ink("#e9cdb1", 1) });
  leg(F, [hip[0] + 1.5, hip[1]], ft.n, 22, 22, { legging: FC.indigo });
  ctx.save();
  ctx.translate(hip[0], hip[1]);
  ctx.rotate(lean);
  ctx.translate(-hip[0], -hip[1]);
  // a staff behind, when running
  if (run) staff(F, [-22, -24], [12, -86]);
  // bundle on the back
  const bundle = [[-15, -71], [-5, -72], [-4, -55], [-15, -53]];
  F.shape(bundle, FC.ochre, FREG.ochre, 0.55);
  ctx.save();
  clipTo(ctx, bundle, () => {
    for (let x = -15; x < -4; x += 3.2) for (let y = -72; y < -53; y += 3.2) F.fill(rect(x + 0.6, y + 0.6, x + 1.8, y + 1.8), FC.rose, FREG.rose);
  });
  ctx.restore();
  // robe, tucked up at the knees
  const hemBack = run ? [-16, -31] : [-11, -28];
  const robe = [[-7.5, -71], [10, -71], [12.5, -60], [10.5, -47], [13.5, -29], [3, -27], hemBack, [-10.5, -46], [-10, -62]];
  F.fill(robe, FC.paper);
  clipTo(ctx, robe, () => F.fill([[-14, -75], [0, -75], [-2, -24], [-18, -24]], FC.shade, FREG.shade));
  F.key(robe, 0.7, { closed: true });
  if (run) {
    // the robe's skirt flies out behind him
    const fl = f % 2;
    const flap = [[-9, -44], [-21 - fl * 3, -38 + fl * 2], [-24 - fl * 2, -31 + fl], [-15, -30], [-10, -33]];
    F.shape(flap, FC.paper, null, 0.6);
    F.key([[-11, -40], [-19 - fl * 2, -34]], 0.35, { tip: 0.3 });
  }
  F.key([[2, -45], [3.5, -36], [4, -28]], 0.4, { tip: 0.3 });
  F.key([[-4, -44], [-6, -30]], 0.4, { tip: 0.3 });
  F.key([[8, -70], [3, -58], [-1, -48]], 0.5);
  F.key([[10, -70], [5, -60]], 0.35);
  // sash
  const obi = [[-10.5, -49], [10.8, -49.5], [11, -44.5], [-10.4, -44]];
  F.shape(obi, FC.indigo, FREG.indigo, 0.5);
  // cord of the bundle across the chest
  F.key([[-6, -71], [8, -60]], 0.7);
  if (run) {
    // the near arm up, holding the hat down against the rain
    const sleeve = [[3, -69], [12, -73], [19, -84], [14, -86], [6, -78], [-2, -60], [-6, -58]];
    F.shape(sleeve, FC.paper, null, 0.6);
    head(F, [7, -79], { tilt: 0.25 });
    sedgeHat(F, [9, -85], 37, 0.38);
    // the hand over the brim, holding the hat down: knuckles and a thumb
    const fist = [[15.6, -90.6], [20.4, -91.6], [22.6, -88.4], [21.8, -85.6], [17.4, -85.4], [15.2, -87.4]];
    F.fill(fist, FC.skin, FREG.skin);
    F.key(fist, 0.45, { closed: true });
    F.key([[18.2, -91], [18.6, -86.6]], 0.3, { tip: 0.5 });
    F.key([[20.4, -91.2], [20.6, -86.4]], 0.3, { tip: 0.5 });
  } else {
    // the near arm forward on the staff
    const sw = f % 3 === 1 ? 1 : 0;
    staff(F, [22 - sw, -98], [15 + sw * 2, 0.8]);
    const sleeve = [[4, -70], [12, -67], [19, -56], [16, -50], [7, -51], [3, -60]];
    F.shape(sleeve, FC.paper, null, 0.6);
    clipTo(ctx, sleeve, () => F.fill(rect(2, -56, 20, -48), FC.shade, FREG.shade));
    const hand = [[16.5, -57], [20.5, -57], [21, -52], [17, -51.5]];
    F.fill(hand, FC.skin, FREG.skin);
    F.key(hand, 0.4, { closed: true });
    head(F, [6, -78]);
    sedgeHat(F, [6, -84.5], 37, 0.06);
  }
  ctx.restore();
}

// --- the farmer in a straw rain cape, by the tea house; faces left
function paintFarmer(ctx, mode, f) {
  const F = figurePainter(ctx);
  const hunch = mode !== "stand" ? 1 : 0;
  const walkFeet = [[[-6, 0], [7, -1]], [[0, -2.5], [1, 0]], [[7, -1], [-6, 0]]];
  const feet = mode === "walk" ? walkFeet[f % 3] : [[-5, 0], [6.5, 0]];
  const hipY = -36 + hunch * 5;
  // legs, bare, short trousers rolled
  leg(F, [-3, hipY], feet[0], 19, 19, { col: ink("#e6c7a8", 1), dir: 1 });
  leg(F, [3, hipY], feet[1], 19, 19, { dir: 1 });
  F.shape([[-7, hipY - 4], [8, hipY - 4], [9, hipY + 7], [-8, hipY + 7]], FC.blue, FREG.blue, 0.5);
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(hunch * 0.16);
  ctx.translate(0, -hipY);
  const top = -74 + hunch * 7;
  const bot = -31 + hunch * 4;
  // hoe over the shoulder, blade behind
  if (!hunch) {
    staff(F, [14, -60], [-22, -96]);
    F.shape([[-24.5, -98], [-19, -96], [-21, -85], [-26, -86]], FC.grey, FREG.grey, 0.5);
  }
  // the cape: a shaggy bell of straw, strands hanging in rows
  const rnd = sampler(1401 + f * 7 + hunch * 31);
  const rag = [];
  for (let x = 18; x >= -18; x -= 3) rag.push([x, bot + rnd.range(-1.5, 2.5) + (Math.abs(x) > 14 ? -2 : 0)]);
  const cape = [[-8, top], [9, top], [14, top + 12], [19, bot - 3], ...rag, [-19, bot - 2], [-14, top + 12]];
  F.fill(cape, FC.mino, FREG.mino);
  clipTo(ctx, cape, () => F.fill([[-20, top], [-4, top], [-8, bot + 4], [-22, bot + 4]], ink(INDIGO, 0.35), FREG.indigo));
  F.key(cape, 0.65, { closed: true });
  for (let row = 0; row < 3; row += 1) {
    const y = top + 9 + row * ((bot - top - 9) / 3);
    const span = 10 + row * 4;
    F.key([[-span, y], [-span * 0.4, y + 1.6], [span * 0.4, y + 1.6], [span, y]], 0.4, { tip: 0.3 });
    for (let x = -span; x < span; x += rnd.range(1.6, 2.6)) F.key([[x, y + 1], [x + rnd.range(-0.6, 0.6), y + rnd.range(5, 9)]], 0.28, { tip: 0.2 });
  }
  for (let x = -17; x < 18; x += rnd.range(1.4, 2.2)) F.key([[x, bot - 6], [x + rnd.range(-0.5, 0.5), bot - rnd.range(-1, 2)]], 0.28, { tip: 0.2 });
  // a hand out of the cape
  if (!hunch) {
    const hand = [[11, -63], [15, -62], [15.5, -58], [11.5, -58]];
    F.fill(hand, FC.skin, FREG.skin);
    F.key(hand, 0.4, { closed: true });
  }
  // head and the pointed hat
  const hy = top - 4;
  head(F, [5, hy], { tilt: hunch ? 0.35 : f % 2 ? 0.08 : -0.04 });
  const hatTilt = hunch ? 0.3 : 0.08;
  const hc = [4, hy - 6 + hunch * 2];
  const r = (pts) => pts.map(([px, py]) => [hc[0] + px * Math.cos(hatTilt) - py * Math.sin(hatTilt), hc[1] + px * Math.sin(hatTilt) + py * Math.cos(hatTilt)]);
  const hat = r([[-17, 2], [0, -13], [17, 2], [8, 3.2], [0, 3.6], [-8, 3.2]]);
  F.fill(r(ellipsePts(0, 2, 17, 2.8, 16, 0, Math.PI)), FC.strawDk, FREG.straw);
  F.shape(hat, FC.straw, FREG.straw, 0.6);
  for (let i = 1; i < 6; i += 1) F.key(r([[0, -12], [lerp(-15, 15, i / 6), 2.2]]), 0.28, { tip: 0.3 });
  ctx.restore();
}

// --- the palanquin and its two bearers; faces left
function bearer(F, ctx, cx, f, lean, front, jacket, rain = false) {
  // a walk, or in the rain a long trotting stride
  const st = rain ? 1.35 : 1;
  const WALK = [
    { n: [cx + 13 * st, 0], fa: [cx - 11 * st, -2] },
    { n: [cx + 3, -1 - (rain ? 2 : 0)], fa: [cx, -6 - (rain ? 2 : 0)] },
    { n: [cx - 11 * st, -2], fa: [cx + 13 * st, 0] },
  ];
  const ft = WALK[(f + (front ? 0 : 1)) % 3];
  const hip = [cx, -41];
  leg(F, [cx - 2, hip[1]], ft.fa, 21, 21, { col: ink("#e2bf9c", 1), w0: 6.2 });
  leg(F, [cx + 2, hip[1]], ft.n, 21, 21, { w0: 6.2 });
  ctx.save();
  ctx.translate(hip[0], hip[1]);
  ctx.rotate(lean);
  ctx.translate(-hip[0], -hip[1]);
  // loincloth and short open jacket
  F.shape([[cx - 7, -44], [cx + 8, -44], [cx + 9, -37], [cx + 2, -33], [cx - 7, -37]], FC.paper, null, 0.5);
  const jk = [[cx - 7, -66], [cx + 7, -66], [cx + 10, -52], [cx + 8, -43], [cx - 8, -43], [cx - 9, -56]];
  // the jacket's tail and the loincloth's end flap out behind, differently in each drawing
  const fl = (f + (front ? 1 : 0)) % 3;
  const flap = [[cx - 8, -52], [cx - 15 - fl * 2 - (rain ? 3 : 0), -49 + fl * 1.5], [cx - 13 - fl, -45], [cx - 8, -43]];
  F.shape(flap, jacket, jacket === FC.blue ? FREG.blue : FREG.indigo, 0.5);
  const tail = [[cx - 6, -40], [cx - 12 - fl * 1.5 - (rain ? 2 : 0), -36 + fl], [cx - 7, -35]];
  F.shape(tail, FC.paper, null, 0.45);
  F.shape(jk, jacket, jacket === FC.blue ? FREG.blue : FREG.indigo, 0.6);
  clipTo(ctx, jk, () => {
    // a white pattern on the jacket: open lozenges
    for (let y = -63; y < -44; y += 6) for (let x = cx - 7; x < cx + 9; x += 6) F.key([[x, y], [x + 1.6, y + 1.6], [x, y + 3.2], [x - 1.6, y + 1.6], [x, y]], 0.3, { tip: 1 });
  });
  F.fill([[cx + 5, -66], [cx + 9, -64], [cx + 10, -52], [cx + 7, -50], [cx + 4, -58]], FC.skin, FREG.skin); // bare chest at the opening
  F.key([[cx + 5, -66], [cx + 4, -58], [cx + 7, -50]], 0.45);
  F.shape([[cx - 8, -46], [cx + 9, -46.5], [cx + 9, -43], [cx - 8, -42.5]], FC.rose, FREG.rose, 0.45);
  // two different men: the front one with a shaven pate and topknot, the rear one in a headband;
  // heads down against the weight, lower still in the rain
  head(F, [cx + 6, -73], { hair: front ? "bun" : "band", tilt: (front ? 0.12 : 0.2) + (rain ? 0.22 : 0) });
  if (front) F.key([[cx + 3.5, -79.5], [cx + 7, -79.2]], 0.35); // the shaven pate's edge
  // the near arm: bent at the elbow, the hand up on the pole (front) or the staff (rear)
  const sh = [cx + 3, -63];
  const hand = front ? [cx + 15, -64.5] : [cx + 12, -57];
  const elbow = front ? [cx + 11, -52] : [cx + 6, -50];
  const arm = ribbon([sh, elbow, hand], [4.6, 3.8, 3]);
  F.fill(arm, FC.skin, FREG.skin);
  const ah = arm.length / 2;
  F.key(arm.slice(0, ah), 0.5, { tip: 0.5 });
  F.key(arm.slice(ah), 0.5, { tip: 0.5 });
  const fist = ellipsePts(hand[0], hand[1], 2.2, 1.9, 10);
  F.fill(fist, FC.skin, FREG.skin);
  F.key(fist, 0.45, { closed: true });
  ctx.restore();
}

function paintPalanquin(ctx, mode, f) {
  const F = figurePainter(ctx);
  const rain = mode === "rain";
  const lean = rain ? 0.3 : 0.17;
  const bob = f % 3 === 1 ? -1 : 0;
  // the rear bearer, then the basket, then the pole, then the front bearer
  bearer(F, ctx, -44, f, lean, false, FC.indigo, rain);
  // the rear man's staff
  staff(F, [-31, -78 + bob], [-36, 0.5]);
  const py = -64.5 + bob; // the pole rides on the shoulders, below the chin
  // ropes and the hanging basket
  F.key([[-12, py], [-16, py + 12]], 0.4);
  F.key([[12, py], [16, py + 12]], 0.4);
  const roof = [[-21, py + 13], [-15, py + 6], [15, py + 6], [21, py + 13]];
  const box = [[-19, py + 13], [19, py + 13], [17, py + 44], [-17, py + 44]];
  F.fill(box, FC.straw, FREG.straw);
  // the open side, dark inside, with the passenger
  const open = [[-14, py + 15], [14, py + 15], [13, py + 32], [-13, py + 32]];
  F.fill(open, FC.indigo, FREG.indigo);
  F.shape([[-5, py + 32], [-6, py + 24], [-3, py + 20], [6, py + 20], [9, py + 26], [11, py + 32]], FC.grey, FREG.grey, 0.45);
  head(F, [3, py + 17], { tilt: 0.05 });
  F.key(open, 0.5, { closed: true });
  // weave on the lower panel
  clipTo(ctx, rect(-19, py + 32, 19, py + 44), () => {
    for (let x = -24; x < 24; x += 3) {
      F.key([[x, py + 32], [x + 8, py + 44]], 0.25, { tip: 1 });
      F.key([[x + 8, py + 32], [x, py + 44]], 0.25, { tip: 1 });
    }
  });
  F.key(box, 0.6, { closed: true });
  F.fill([[-15, py + 13], [15, py + 13], [15, py + 16], [-15, py + 16]], FC.blue, FREG.blue); // the rolled blind
  F.key([[-15, py + 16], [15, py + 16]], 0.4);
  F.shape(roof, FC.wood, FREG.ochre, 0.6);
  // the pole
  const pole = ribbon([[-64, py], [64, py - 0.6]], [2.8, 2.6]);
  F.shape(pole, FC.wood, FREG.ochre, 0.5);
  bearer(F, ctx, 42, f, lean + 0.04, true, FC.blue, rain);
}

const FIGS = {
  pilgrim: { box: [-36, -106, 36, 6], paint: paintPilgrim, facing: 1 },
  farmer: { box: [-34, -106, 34, 6], paint: paintFarmer, facing: -1 },
  palanquin: { box: [-82, -104, 82, 6], paint: paintPalanquin, facing: -1 },
};

function figureSprite(stage, name, mode, f) {
  const def = FIGS[name];
  const [x0, y0, x1, y1] = def.box;
  const k = PX * 1.1 * stage.s;
  return stage.bake2d(`ukiyoe/fig/${name}/${mode}/${f}/${k.toFixed(3)}`, Math.round((x1 - x0) * k), Math.round((y1 - y0) * k), (ctx) => {
    ctx.setTransform(k * def.facing, 0, 0, k, (def.facing > 0 ? -x0 : x1) * k, -y0 * k);
    ctx.lineJoin = "round";
    def.paint(ctx, mode, f);
  });
}

// Each traveller: where he is and which drawing is showing, from the held 6 Hz clock.
const HOLD = 6;
function travellers(u) {
  const s = stepTime(u, HOLD);
  const n = Math.floor(s * HOLD + 1e-6);
  const out = [];
  // the palanquin, heading left at a brisk walk: it meets the pelican at u ≈ 0.8 (x ≈ 133) and is
  // clear of it from u ≈ 1.35; once it rains the bearers trot out of the picture
  const px = s < 2 ? 181 - 60 * s : 61 - 85 * (s - 2);
  const prain = s >= 2;
  out.push({ name: "palanquin", mode: prain ? "rain" : "walk", f: ((n % 3) + 3) % 3, x: px, y: 703 });
  // the pilgrim, heading right; he runs for the tea house and waits at the end of its eave
  let gx;
  let gmode = "walk";
  if (s < 2) gx = 560 + 16 * s;
  else if (s < 3.6) {
    gx = 592 + ((750 - 592) / 1.6) * (s - 2);
    gmode = "run";
  } else if (s < 5.4) {
    gx = 750;
    gmode = "stand";
  } else gx = 750 + 14 * (s - 5.4);
  const gf = gmode === "run" ? ((n % 2) + 2) % 2 : gmode === "stand" ? 1 : ((n % 3) + 3) % 3;
  out.push({ name: "pilgrim", mode: gmode === "run" ? "run" : "walk", f: gf, x: gx, y: 704 });
  // the farmer, in his straw rain cape, watching the road at the left of the tea house; he
  // simply hunches into the cape while it rains, so the road in front of the tea house stays open
  const fx = 704;
  let fmode = "stand";
  let ff = Math.floor(s / 1.5) % 2;
  if (s >= 2 && s < 5.3) {
    fmode = "hunch";
    ff = Math.floor(s * 2) % 2;
  }
  out.push({ name: "farmer", mode: fmode, f: ff, x: fx, y: 697 });
  return out;
}

function drawTravellers(stage, view, u) {
  // bake first: a bake resets the drawing transform
  const list = travellers(u).map((t) => ({ ...t, tex: figureSprite(stage, t.name, t.mode, t.f) }));
  stage.withView(view, () => {
    for (const t of list) {
      const [x0, y0, x1, y1] = FIGS[t.name].box;
      stage.image(t.tex, t.x + x0, t.y + y0, x1 - x0, y1 - y0);
    }
  });
}

// ------------------------------------------------------------------ the pelican, printed
const PC = {
  indigo: ink(INDIGO, 1),
  indigoLt: ink(PALE, 0.9),
  rose: ink(ROSE, 0.95),
  roseDk: ink("#9e4036", 0.95),
  ochre: ink(OCHRE, 0.95),
  pouch: ink("#d6a650", 0.95),
  billBase: ink("#e8bb4c", 0.95),
  billMid: ink("#e2a14a", 0.95),
  billTip: ink(ROSE, 0.95),
  wood: ink("#7a5a3c", 0.95),
  belly: ink(INDIGO, 0.3),
  wingShade: ink(PALE, 0.45),
  canopy: ink("#d9a84e", 0.95),
  canopyDk: ink("#b07f3a", 0.95),
  canopyIn: ink("#e9c886", 0.9),
  ring: ink("#24324a", 1),
  bamboo: ink("#b89150", 0.95),
};
const PREG = { indigo: [0.8, 1.0], rose: [1.0, 0.8], ochre: [-1.1, -0.5], grey: [-0.5, 1.1], pale: [-0.85, 0.65] };
const FEATHERED = new Set(["tail", "body", "neck", "head", "crest"]);

/** Bar 2: the neck tucks in against the rain. (The wing is the scene's own drawing, see liftFor.) */
function actFor(u) {
  const hunch = smoothstep(2.05, 2.45, u) * (1 - smoothstep(4.95, 5.35, u));
  return { neckStretch: -0.4 * hunch, headPitch: -0.06 * hunch };
}
/** How far the near wing is raised to hold the umbrella: 0 on the grip, 1 up. */
// Up: it accelerates and arrives on 2.5 exactly (well short of up at 2.45); down: 5.14 – 5.4.
const liftFor = (u) => {
  const t = clamp((u - 2.22) / 0.28);
  return t * t * (1 - smoothstep(5.14, 5.4, u));
};

/** A feather as the rig cuts it: a lens from root along angle (y down). */
function featherPts(root, angle, length, width, n) {
  const d = [Math.cos(angle), Math.sin(angle)];
  const nrm = [-d[1], d[0]];
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const w = width * Math.sin(Math.PI * t ** 0.75) * 0.5;
    pts.push([root[0] + d[0] * length * t + nrm[0] * w, root[1] + d[1] * length * t + nrm[1] * w]);
  }
  for (let i = n - 1; i >= 1; i -= 1) {
    const t = i / n;
    const w = width * Math.sin(Math.PI * t ** 0.75) * 0.5;
    pts.push([root[0] + d[0] * length * t - nrm[0] * w, root[1] + d[1] * length * t - nrm[1] * w]);
  }
  return pts;
}

/** Blend two point lists by turning about a pivot (angle and radius), so a limb swings rather than shears. */
function swingPts(a, b, pivot, t) {
  return a.map((p, i) => {
    const q = b[i];
    const a0 = Math.atan2(p[1] - pivot[1], p[0] - pivot[0]);
    let a1 = Math.atan2(q[1] - pivot[1], q[0] - pivot[0]);
    while (a1 - a0 > Math.PI) a1 -= TAU;
    while (a1 - a0 < -Math.PI) a1 += TAU;
    const r = lerp(Math.hypot(p[0] - pivot[0], p[1] - pivot[1]), Math.hypot(q[0] - pivot[0], q[1] - pivot[1]), t);
    const an = lerp(a0, a1, t);
    return [pivot[0] + Math.cos(an) * r, pivot[1] + Math.sin(an) * r];
  });
}

/**
 * The near wing. At rest it is exactly the rig's folded wing; raised, it is
 * drawn up beside the neck like an arm, the wrist at head height behind the
 * head, two hand feathers closed round the umbrella's grip and the black
 * primaries fanned back above it. Between the two it swings about the shoulder.
 */
function nearWing(skel, lift) {
  const S = skel.scale;
  const get = (id) => skel.shapes.find((s) => s.id === id);
  const rest = {
    outline: get("wing").pts,
    fold: get("wingFold").pts,
    tips: [0, 1, 2, 3].map((i) => get(`wingTip${i}`).pts),
    hands: [0, 1].map((i) => get(`wingHand${i}`).pts),
    wrist: skel.joints.wingTip,
  };
  if (lift <= 0.001) return { ...rest, hands: [rest.hands[0], rest.hands[1], rest.hands[1]], lift: 0 };
  const sh = skel.joints.shoulder;
  // offsets measured on the reference puppet (S = 21.2) from the shoulder
  const q = S / 21.2;
  const P = (dx, dy) => [sh[0] + dx * q, sh[1] + dy * q];
  // Raised, the wing stays folded along the body (the primaries still lie back over the tail,
  // a wingtip where a wingtip should be) and only the wrist comes up, to the front of the
  // breast, where the hand feathers close round the umbrella's shaft.
  const H = P(4.6, -4.2); // the grip, in front of the breast and below the chin
  const outline = [
    P(-0.8, -5.7), P(2.7, -7.7), P(7.2, -7.2), P(8.7, -2.7), P(6.7, 1.3), P(2.2, 5.8), P(-1.3, 11.8), P(-4.8, 17.8),
    P(-9.3, 21.8), P(-13.3, 25.3), P(-18.8, 25.3), P(-22.8, 27.8), P(-30.3, 26.8), P(-27, 20.3), P(-19.8, 9.8), P(-10.8, -0.2),
  ];
  const fold = [P(1.5, -3.8), P(-3.5, 5), P(-12.5, 13.5), P(-23.5, 19.5)];
  // three hand feathers from the wrist, across the front of the shaft, their tips past it
  const hands = [0, 1, 2].map((i) => featherPts(P(2.2 + i * 0.4, -6.4 + i * 2.3), 0.22 + i * 0.2, (8.6 - i * 0.6) * q, (2.9 - i * 0.3) * q, 4));
  const restHands = [rest.hands[0], rest.hands[1], rest.hands[1]];
  const pivot = sh;
  const t = lift;
  return {
    outline: swingPts(rest.outline, outline, pivot, t),
    fold: swingPts(rest.fold, fold, pivot, t),
    tips: rest.tips,
    hands: restHands.map((p, i) => swingPts(p, hands[i], pivot, t)),
    wrist: swingPts([rest.wrist], [H], pivot, t)[0],
    lift,
  };
}

function umbrellaState(u) {
  if (u < 2.22 || u >= 5.3) return null;
  if (u < 2.65) return "shut";
  if (u < 3.0) return "half";
  if (u < 5.0) return "open";
  if (u < 5.15) return "half";
  return "shut";
}

const SHAFT = 96; // apex to the end of the grip binding; the hand holds it 100 from the apex
const SPINDLE = 62; // the furled paper, from the apex down
function umbrellaFrame(W, u) {
  const state = umbrellaState(u);
  if (!state) return null;
  const hand = W.wrist;
  const lift = W.lift;
  // produced lying back along the bird's back, it swings up with the wrist. Shut, it leans
  // back so the shaft is clear of the head; as it opens it comes almost upright, so the
  // canopy is over the head and not behind it
  const opened = smoothstep(2.65, 3.0, u) * (1 - smoothstep(5.0, 5.15, u));
  const tilt = lerp(-1.25, lerp(-0.3, -0.05, opened), lift) + 0.012 * Math.sin(u * Math.PI * 2);
  const grip = SHAFT + 4;
  const apex = [hand[0] + Math.sin(tilt) * grip, hand[1] - Math.cos(tilt) * grip];
  // folded, it is lowered and tucked away behind the bird before it is gone
  // produced, it comes out of the hand over 0.08 s, grip first, the tip last (reveal 0 -> 1);
  // put away, it fades behind the bird over the last tenth of a second (fade 1 -> 0)
  const reveal = smoothstep(2.22, 2.3, u);
  const fade = 1 - clamp((u - 5.2) / 0.1);
  return { state, hand, tilt, apex, behind: state === "shut" && u >= 5.2, reveal, fade };
}

/** While it is being produced, only the part of the umbrella out of the hand shows (local coordinates). */
function revealClip(ctx, U) {
  if (U.reveal >= 1) return;
  const yTop = lerp(SHAFT + 16, -8, U.reveal);
  ctx.beginPath();
  ctx.rect(-40, yTop, 80, SHAFT + 30 - yTop);
  ctx.clip();
}

function umbrellaShaft(ctx, U) {
  ctx.save();
  ctx.translate(U.apex[0], U.apex[1]);
  ctx.rotate(U.tilt);
  revealClip(ctx, U);
  const y0 = 6;
  const y1 = SHAFT + 9;
  fillPts(ctx, rect(-0.85, y0, 0.85, y1), PC.bamboo);
  ctx.fillStyle = KEY;
  cut(ctx, [[-0.9, y0], [-0.9, y1]], 0.4, 811, { step: 6, tip: 0.8 });
  cut(ctx, [[0.9, y0], [0.9, y1]], 0.4, 812, { step: 6, tip: 0.8 });
  for (let y = 30; y < SHAFT - 8; y += 21) cut(ctx, [[-1.15, y], [1.15, y]], 0.45, 813 + y, { tip: 0.8 });
  // the grip, bound with red cord
  fillPts(ctx, rect(-1.25, SHAFT - 8, 1.25, y1), PC.rose);
  for (let y = SHAFT - 7; y < y1; y += 1.7) cut(ctx, [[-1.25, y], [1.25, y + 0.6]], 0.25, 820 + y, { tip: 0.8 });
  ctx.restore();
}

/** The profile of the dome: a rounded cap, flat at the crown and falling steeply to the rim. */
const domeY = (r, D) => (D * (1 - Math.sqrt(1 - 0.9 * r * r))) / (1 - Math.sqrt(0.1));

function umbrellaCanopy(ctx, U) {
  ctx.save();
  ctx.translate(U.apex[0], U.apex[1]);
  ctx.rotate(U.tilt);
  revealClip(ctx, U);
  ctx.fillStyle = KEY;
  if (U.state === "shut") {
    // furled: a slim spindle of folded paper, tied round the middle
    const sideR = [];
    const sideL = [];
    for (let i = 0; i <= 16; i += 1) {
      const y = -2 + (i / 16) * SPINDLE;
      const hw = 4.6 * Math.pow(Math.sin(Math.PI * clamp((y + 2) / (SPINDLE + 2)) * 0.98 + 0.02), 0.7) * (1 - 0.4 * (i / 16));
      sideR.push([hw, y]);
      sideL.push([-hw, y]);
    }
    const spindle = sideR.concat(sideL.reverse());
    ctx.save();
    ctx.translate(PREG.ochre[0], PREG.ochre[1]);
    fillPts(ctx, spindle, PC.canopy);
    ctx.restore();
    clipTo(ctx, spindle, () => {
      fillPts(ctx, rect(-6, SPINDLE * 0.78, 6, SPINDLE * 0.78 + 4), PC.ring);
      fillPts(ctx, rect(1.4, -4, 6, SPINDLE + 2), ink(WGREY, 0.45));
    });
    ctx.fillStyle = KEY;
    cut(ctx, spindle, 0.55, 831, { closed: true, step: 1.6 });
    for (const fx of [-0.45, 0, 0.45]) cut(ctx, sideR.map(([x, y]) => [x * fx, y]), 0.3, 832 + fx * 10, { tip: 0.3 });
    fillPts(ctx, rect(-4.4, SPINDLE * 0.45, 4.4, SPINDLE * 0.45 + 2.4), PC.rose);
    cut(ctx, [[-4.4, SPINDLE * 0.45], [4.4, SPINDLE * 0.45]], 0.3, 836);
    cut(ctx, [[-4.4, SPINDLE * 0.45 + 2.4], [4.4, SPINDLE * 0.45 + 2.4]], 0.3, 837);
    ctx.beginPath();
    ctx.ellipse(0, -3, 1.4, 2, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    return;
  }
  const open = U.state === "open";
  // a rounded dome of oiled paper seen a little from below
  const R = open ? 47 : 27;
  const D = open ? 29 : 36;
  const E = open ? 6 : 3;
  const NP = open ? 12 : 8; // panels across the near half
  const runner = open ? D + 15 : D + 9;
  const surf = (r, phi) => [r * R * Math.cos(phi), -2 + domeY(r, D) + E * r * Math.sin(phi)];
  const top = [];
  for (let i = 0; i <= 40; i += 1) {
    const s = -1 + (2 * i) / 40;
    top.push([s * R, -2 + domeY(Math.abs(s), D)]);
  }
  // the rim: the paper sags a little between the ribs, so the rib ends point
  const rim = [];
  const N = NP * 6;
  for (let i = 0; i <= N; i += 1) {
    const phi = (Math.PI * i) / N;
    const p = surf(1, phi);
    p[1] -= (open ? 1.1 : 1.6) * Math.sin(Math.PI * ((i % 6) / 6));
    rim.push(p);
  }
  const canopy = top.concat(rim);
  // underneath: the light paper lit through, and the fan of ribs to the runner
  fillPts(ctx, rim.concat([[0, runner]]), PC.canopyIn);
  ctx.fillStyle = KEY;
  for (let i = 0; i <= NP * 2; i += 1) {
    const p = surf(1, (Math.PI * i) / (NP * 2));
    cut(ctx, [p, [0, runner]], 0.28, 840 + i, { step: 4, tip: 0.6, vary: 0.1 });
  }
  fillPts(ctx, rect(-1.6, runner - 2.5, 1.6, runner + 2), PC.ring);
  // the dome
  ctx.save();
  ctx.translate(PREG.ochre[0], PREG.ochre[1]);
  fillPts(ctx, canopy, PC.canopy);
  ctx.restore();
  const panel = (i) => {
    const a0 = (Math.PI * i) / NP;
    const a1 = (Math.PI * (i + 1)) / NP;
    const pts = [];
    for (let q = 0; q <= 8; q += 1) pts.push(surf(q / 8, a0));
    for (let q = 0; q <= 4; q += 1) pts.push(surf(1.02, lerp(a0, a1, q / 4)));
    for (let q = 8; q >= 0; q -= 1) pts.push(surf(q / 8, a1));
    return pts;
  };
  clipTo(ctx, canopy, () => {
    // every other panel is printed a shade darker, so the panels read
    for (let i = 1; i < NP; i += 2) fillPts(ctx, panel(i), "rgba(130,84,38,0.2)");
    // light on the crown, shade on the far side
    const g = ctx.createLinearGradient(-R, 0, R, 0);
    g.addColorStop(0, "rgba(120,80,40,0.3)");
    g.addColorStop(0.5, "rgba(120,80,40,0)");
    g.addColorStop(1, "rgba(120,80,40,0.14)");
    ctx.fillStyle = g;
    ctx.fillRect(-R - 2, -6, 2 * R + 4, D + E + 8);
    // a narrow dark ring near the edge
    const r1 = [];
    const r2 = [];
    for (let i = 0; i <= 30; i += 1) {
      const phi = (Math.PI * i) / 30;
      r1.push(surf(0.9, phi));
      r2.push(surf(0.93, phi));
    }
    ctx.save();
    ctx.translate(PREG.indigo[0] * 0.6, PREG.indigo[1] * 0.6);
    fillPts(ctx, r1.concat(r2.slice().reverse()), PC.ring);
    ctx.restore();
  });
  ctx.fillStyle = KEY;
  // panel seams from the crown to the rim, and the rib ends just proud of the rim
  for (let i = 1; i < NP; i += 1) {
    const phi = (Math.PI * i) / NP;
    const pts = [];
    for (let q = 1; q <= 10; q += 1) pts.push(surf(q / 10, phi));
    cut(ctx, pts, 0.32, 860 + i, { step: 2, tip: 0.4 });
  }
  for (let i = 0; i <= NP; i += 1) {
    const phi = (Math.PI * i) / NP;
    const a = surf(0.97, phi);
    const b = surf(1.06, phi);
    cut(ctx, [a, [b[0], b[1] + 1.2]], 0.7, 880 + i, { tip: 0.5, vary: 0.05 });
  }
  cut(ctx, canopy, 0.75, 870, { closed: true, step: 2.2 });
  // a knob at the crown
  ctx.beginPath();
  ctx.ellipse(0, -3.4, 2, 1.6, 0, 0, TAU);
  ctx.fill();
  if (open) {
    // the inn's name, written down one panel as on a lent umbrella
    const phi = (Math.PI * 5.5) / NP;
    [["鹈", 0.5], ["鹕", 0.76]].forEach(([ch, r]) => {
      const p = surf(r, phi);
      const d0 = surf(r - 0.05, phi);
      const d1 = surf(r + 0.05, phi);
      ctx.save();
      ctx.translate(p[0], p[1]);
      ctx.rotate(Math.atan2(-(d1[0] - d0[0]), d1[1] - d0[1]));
      drawText(ctx, ch, 0, 0, { font: `700 11px ${FONT_KAI}`, align: "center", baseline: "middle", fill: KEY });
      ctx.restore();
    });
  }
  ctx.restore();
}

/** A row of feather ends: small cut scallops along pts, bulging away from c. */
function scallops(ctx, pts, c, size, w, seed) {
  const r = resample(pts, false, size);
  for (let i = 0; i < r.length - 1; i += 1) {
    const a = r[i];
    const b = r[i + 1];
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const l = dist(a, b) || 1;
    let nx = -(b[1] - a[1]) / l;
    let ny = (b[0] - a[0]) / l;
    if (nx * (m[0] - c[0]) + ny * (m[1] - c[1]) < 0) {
      nx = -nx;
      ny = -ny;
    }
    // a rounded feather end: a quadratic arc, leaning a little back along the row
    const k = l * 0.55;
    const q = [m[0] + nx * k - (b[0] - a[0]) * 0.1, m[1] + ny * k - (b[1] - a[1]) * 0.1];
    const arc = [];
    for (let j = 0; j <= 6; j += 1) {
      const s = j / 6;
      arc.push([(1 - s) * (1 - s) * a[0] + 2 * s * (1 - s) * q[0] + s * s * b[0], (1 - s) * (1 - s) * a[1] + 2 * s * (1 - s) * q[1] + s * s * b[1]]);
    }
    cut(ctx, arc, w, seed + i, { step: Math.max(0.4, l / 8), tip: 0.3, jitter: 0.02, vary: 0.15 });
  }
}

/** The near wing in the print's manner: black primaries, a bokashi of pale blue to the trailing edge, rows of scalloped feathers. */
function drawWing(ctx, W, S, lw, hands = true) {
  const o = W.outline;
  // black primaries, each with a paper quill cut down its middle
  for (const pts of W.tips) {
    fillPts(ctx, pts, KEY);
    const n = pts.length / 2;
    const root = pts[0];
    const tip = pts[n];
    ctx.fillStyle = PAPER;
    cut(ctx, [[lerp(root[0], tip[0], 0.12), lerp(root[1], tip[1], 0.12)], [lerp(root[0], tip[0], 0.8), lerp(root[1], tip[1], 0.8)]], lw * 0.32, 3990, { step: 2, tip: 0.2 });
  }
  // the wing itself: paper, wiped with pale blue toward the trailing edge
  const c = [(o[0][0] + o[15][0] + o[14][0]) / 3, (o[0][1] + o[15][1] + o[14][1]) / 3];
  ctx.save();
  ctx.translate(PREG.pale[0], PREG.pale[1]);
  fillPts(ctx, o, PAPER);
  ctx.restore();
  clipTo(ctx, o, () => {
    let far = 0;
    for (const p of o) far = Math.max(far, dist(p, c));
    const g = ctx.createRadialGradient(c[0], c[1], far * 0.25, c[0], c[1], far);
    g.addColorStop(0, "rgba(126,166,201,0)");
    g.addColorStop(0.55, "rgba(126,166,201,0.32)");
    g.addColorStop(1, "rgba(126,166,201,0.7)");
    ctx.translate(PREG.pale[0], PREG.pale[1]);
    ctx.fillStyle = g;
    ctx.fillRect(c[0] - far, c[1] - far, far * 2, far * 2);
  });
  ctx.fillStyle = KEY;
  // rows of feathers, parallel to the trailing edge, smaller toward the shoulder
  const trail = o.slice(5, 13);
  clipTo(ctx, o, () => {
    [[0.3, 0.2, 0.42], [0.56, 0.15, 0.36]].forEach(([f, size, w], r) => {
      const row = trail.map((p) => [lerp(p[0], c[0], f), lerp(p[1], c[1], f)]);
      scallops(ctx, row, c, size * S, lw * w, 3960 + r * 20);
    });
    // short coverts along the leading edge
    const lead = [o[15], o[0], o[1], o[2]].map((p) => [lerp(p[0], c[0], 0.18), lerp(p[1], c[1], 0.18)]);
    scallops(ctx, lead, c, 0.13 * S, lw * 0.32, 3940);
  });
  // the trailing edge itself is scalloped; the leading edge is one clean cut
  scallops(ctx, trail, c, 0.24 * S, lw * 0.85, 3920);
  cut(ctx, [o[12], o[13], o[14], o[15], o[0], o[1], o[2], o[3], o[4], o[5]], lw * 1.1, 3901, { step: 2, jitter: 0.05, vary: 0.25, tip: 0.3 });
  cut(ctx, W.fold, lw * 0.5, 3902, { step: 2, tip: 0.2 });
  if (hands) drawHands(ctx, W, lw);
}

/** The hand feathers: black, each with a paper quill; raised, they lie across the front of the shaft. */
function drawHands(ctx, W, lw) {
  W.hands.forEach((pts, i) => {
    fillPts(ctx, pts, KEY);
    if (W.lift > 0.3) {
      const n = pts.length / 2;
      const root = pts[0];
      const tip = pts[n];
      ctx.fillStyle = PAPER;
      cut(ctx, [[lerp(root[0], tip[0], 0.15), lerp(root[1], tip[1], 0.15)], [lerp(root[0], tip[0], 0.72), lerp(root[1], tip[1], 0.72)]], lw * 0.28, 3995 + i, { step: 1, tip: 0.2 });
    }
  });
}

function paintPelican(ctx, skel, U, W) {
  const S = skel.scale;
  const lw = 0.045 * S;
  const J = skel.joints;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const fillSh = (sh, col, reg) => {
    ctx.save();
    if (reg) ctx.translate(reg[0], reg[1]);
    traceShape(ctx, sh);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.restore();
  };
  const strokeSh = (sh, col, w, reg) => {
    ctx.save();
    if (reg) ctx.translate(reg[0], reg[1]);
    traceShape(ctx, sh);
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.stroke();
    ctx.restore();
  };
  let seed = 3000;
  const keyLine = (sh, w) => {
    ctx.fillStyle = KEY;
    seed += 1;
    if (sh.kind === "circle") {
      ctx.beginPath();
      ctx.arc(sh.c[0], sh.c[1], sh.r, 0, TAU);
      ctx.lineWidth = w;
      ctx.strokeStyle = KEY;
      ctx.stroke();
      return;
    }
    cut(ctx, sh.pts, w, seed, { closed: sh.closed, step: 2, jitter: 0.06, vary: 0.22 });
  };
  let featherDone = false;
  if (U && U.behind) {
    umbrellaShaft(ctx, U);
    umbrellaCanopy(ctx, U);
    if (U.fade < 1) {
      // nothing else is in the patch yet: thin the umbrella as one piece before the body goes over it
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = 1 - U.fade;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    }
  }
  for (const sh of skel.shapes) {
    const far = sh.side === "far";
    switch (sh.tag) {
      case "tire":
        strokeSh(sh, KEY, sh.w);
        break;
      case "rim":
        strokeSh(sh, PC.indigo, sh.w * 1.4, PREG.indigo);
        break;
      case "spoke":
        strokeSh(sh, KEY, Math.max(sh.w, 0.3));
        break;
      case "reflector":
        fillSh(sh, PC.ochre, PREG.ochre);
        break;
      case "hub":
        fillSh(sh, KEY);
        break;
      case "frame":
        strokeSh(sh, KEY, sh.w + lw * 1.5);
        strokeSh(sh, PC.indigo, sh.w * 0.72, PREG.indigo);
        break;
      case "post":
      case "bar":
        strokeSh(sh, KEY, sh.w + lw * 0.9);
        strokeSh(sh, PC.indigoLt, sh.w * 0.45, PREG.pale);
        break;
      case "grip":
      case "chain":
      case "ring":
      case "crank":
        strokeSh(sh, KEY, Math.max(sh.w || 0, 0.35));
        break;
      case "pedal":
        fillSh(sh, KEY);
        break;
      case "bell":
        fillSh(sh, PC.ochre, PREG.ochre);
        keyLine(sh, lw * 0.7);
        break;
      case "saddle":
        fillSh(sh, PC.wood, PREG.grey);
        keyLine(sh, lw * 0.8);
        break;
      case "leg":
        strokeSh(sh, KEY, sh.w + lw * 1.7);
        strokeSh(sh, far ? PC.roseDk : PC.rose, sh.w * 0.9, PREG.rose);
        break;
      case "foot":
        fillSh(sh, far ? PC.roseDk : PC.rose, PREG.rose);
        keyLine(sh, lw * 0.8);
        break;
      case "tail":
      case "body":
      case "neck":
      case "head":
      case "crest":
        if (!featherDone) {
          for (const other of skel.shapes) if (FEATHERED.has(other.tag)) keyLine(other, lw * 2.2);
          featherDone = true;
        }
        fillSh(sh, PAPER);
        if (sh.tag === "neck") {
          // a few cut strokes for the feathers down the front of the neck
          const nl = skel.neckLine;
          ctx.fillStyle = KEY;
          [0.3, 0.48, 0.66].forEach((t, i) => {
            const k = Math.min(nl.length - 2, Math.floor(t * (nl.length - 1)));
            const a = nl[k];
            const c = nl[k + 1];
            const l = dist(a, c) || 1;
            const nx = -(c[1] - a[1]) / l;
            const ny = (c[0] - a[0]) / l;
            const side = nx > 0 ? 1 : -1;
            const o = S * 0.13 * side;
            cut(ctx, [[a[0] + nx * o, a[1] + ny * o], [a[0] + nx * o * 1.6 + (c[0] - a[0]) * 0.4, a[1] + ny * o * 1.6 + (c[1] - a[1]) * 0.4]], lw * 0.5, 3800 + i, { step: 0.8 });
          });
        }
        if (sh.tag === "body") {
          ctx.save();
          traceShape(ctx, sh);
          ctx.clip();
          const g = ctx.createLinearGradient(J.body[0], J.body[1] - S * 0.1, J.body[0] - S * 0.2, J.body[1] + S * 0.95);
          g.addColorStop(0, "rgba(85,96,110,0)");
          g.addColorStop(1, "rgba(85,96,110,0.42)");
          ctx.translate(PREG.grey[0], PREG.grey[1]);
          ctx.fillStyle = g;
          ctx.fillRect(J.body[0] - S * 2, J.body[1] - S * 2, S * 4, S * 4);
          ctx.restore();
        }
        break;
      case "bill": {
        ctx.save();
        ctx.translate(PREG.ochre[0], PREG.ochre[1]);
        const g = ctx.createLinearGradient(J.billBase[0], J.billBase[1], J.billTip[0], J.billTip[1]);
        g.addColorStop(0, PC.billBase);
        g.addColorStop(0.62, PC.billMid);
        g.addColorStop(1, PC.billTip);
        traceShape(ctx, sh);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
        keyLine(sh, lw * 0.9);
        break;
      }
      case "pouch":
        fillSh(sh, PC.pouch, PREG.ochre);
        ctx.save();
        traceShape(ctx, sh);
        ctx.clip();
        ctx.translate(PREG.rose[0], PREG.rose[1]);
        ctx.fillStyle = "rgba(201,88,74,0.25)";
        ctx.fillRect(J.billBase[0] - S, J.billBase[1] + S * 0.35, S * 4, S * 2);
        ctx.restore();
        keyLine(sh, lw * 0.85);
        break;
      case "eye":
        fillSh(sh, PAPER);
        keyLine(sh, lw * 0.6);
        break;
      case "pupil":
        fillSh(sh, KEY);
        break;
      case "lid":
        fillSh(sh, PAPER);
        ctx.fillStyle = KEY;
        cut(ctx, [[sh.c[0] - sh.r, sh.c[1]], [sh.c[0] + sh.r, sh.c[1]]], lw * 0.7, 3901);
        break;
      case "wing":
        if (W.lift <= 0.001) drawWing(ctx, W, S, lw);
        break;
      case "wingtip":
      case "wingfold":
        break;
      default:
        break;
    }
    if (sh.id === "crest2") {
      // raised: the folded wing over the body, then the shaft in front of the breast and neck
      // (clear of the head, which is drawn after), then the hand feathers closed round it
      if (W && W.lift > 0.001) drawWing(ctx, W, S, lw, false);
      if (U && !U.behind) umbrellaShaft(ctx, U);
      if (W && W.lift > 0.001) drawHands(ctx, W, lw);
    }
  }
  if (U && !U.behind) umbrellaCanopy(ctx, U);
}

function drawPelican(stage, f) {
  const u = f.u;
  const acting = u > 0.6 && u < 5.4;
  const skel = solveRig({ ...f.pelican, act: acting ? actFor(u) : undefined });
  const W = nearWing(skel, acting ? liftFor(u) : 0);
  const U = acting ? umbrellaFrame(W, u) : null;
  const b = skel.bounds;
  let x0 = b.x0 - 4;
  let y0 = b.y0 - 4;
  let x1 = b.x1 + 4;
  for (const p of [...W.outline, ...W.tips.flat(), ...W.hands.flat()]) {
    x0 = Math.min(x0, p[0] - 3);
    x1 = Math.max(x1, p[0] + 3);
    y0 = Math.min(y0, p[1] - 3);
  }
  if (U) {
    x0 = Math.min(x0, U.apex[0] - 64, U.hand[0] - 10);
    x1 = Math.max(x1, U.apex[0] + 64);
    y0 = Math.min(y0, U.apex[1] - 70);
  }
  const patch = stage.patch("ukiyoe/pelican", f.view, x0, y0, x1, b.y1 + 3);
  paintPelican(patch.ctx, skel, U, W);
  // the pelican is printed too: its colours show the grain of their blocks
  grainOver(patch.ctx, stage, f.pelican.x - 117, f.pelican.y - 211, 0.5, [x0, y0, x1, b.y1 + 3]);
  stage.imagePatch(patch);
}

// ------------------------------------------------------------------ scene
export const ukiyoe = {
  ...META,
  // the umbrella open in the rain, the pelican clear of every pine, the travellers ahead
  still: { u: 3.8 },

  init(stage) {
    bakePrint(stage);
    bakePrint(stage, true);
    bakePaper(stage);
    bakeTitle(stage);
    bakeRain(stage, 0);
    bakeRain(stage, 1);
  },

  render(stage, f) {
    const view = f.view;
    const u = f.u;
    stage.origin();
    stage.rect(0, 0, f.w, f.h, PAPER);
    const print = bakePrint(stage);
    const veil = fujiVeil(u);
    const stormPrint = veil > 0.001 ? bakePrint(stage, true) : null;
    stage.withView(view, () => {
      stage.image(print, SHEET.x0, SHEET.y0, SW, SH);
      // Fuji goes grey and is lost in the shower, then comes clear again
      if (stormPrint) stage.image(stormPrint, SHEET.x0, SHEET.y0, SW, SH, veil);
    });
    drawTravellers(stage, view, u);
    // the pelican is printed on the same sheet: the storm's grey goes over it as over everyone
    if (f.pelican.visible) drawPelican(stage, f);
    drawStorm(stage, view, u);
    drawRain(stage, view, u);
    // the cartouches sit on top of the picture, above the storm grey and the rain
    // (always drawn, so nothing can change at the moment the shower starts)
    const title = bakeTitle(stage);
    stage.withView(view, () => stage.image(title, TITLE_R.x0, TITLE_R.y0, TITLE_R.x1 - TITLE_R.x0, TITLE_R.y1 - TITLE_R.y0));
    const paper = bakePaper(stage);
    stage.withView(view, () => stage.image(paper, SHEET.x0, SHEET.y0, SW, SH));
  },
};
