// Section 8. Mughal miniature painting, c. 1600, in the manner of the album
// pages of the imperial workshops: opaque watercolour and gold on burnished
// paper, a garden gathering, and the court's natural-history bird studies.
//
// The page: a border of gold flowering scroll on lapis; inside it a garden
// shown the Mughal way, every thing from the side that explains it best: the
// carpet and the water channel in plan, the pavilion in elevation, the people
// in three-quarter view. The pelican rides along the garden walk, painted as
// a court bird study on a goldsmith's bicycle.
//
// The joke (bar 2): the painting applies its own rule to the pelican. In the
// channel along the foot of the picture the same bird is seen from directly
// above, pedalling in step. At u = 3.0 every guest is found with one finger
// laid on the lips, the miniature's sign of astonishment. They do not move to
// it; the picture simply shows the second state from that beat.
//
// Built entirely on 2D canvas. The page is baked twice (guests at ease, guests
// astonished); each frame draws one of those, the top-view pelican in the
// channel with the ripples laid over it, and the side-view pelican.

import { sectionMeta } from "./sections.js";
import { View, Layer2D } from "../kit/stage.js";
import { rng, hash, noise1, noise2 } from "../kit/rng.js";
import { smoothClosed, smoothOpen } from "../kit/geom.js";
import { solveRig } from "../rig/rig.js";
import { paintBirdSide, paintBirdTop, MC } from "../rig/skins/mughal.js";
import { lerp, clamp, TAU } from "../beat/ease.js";

const META = sectionMeta(8);

const PAGE = { x0: -70, y0: 418, x1: 1070, y1: 802 };
const PAGE_PX = 3.3;
const PIC = { x0: 52, x1: 948, y0: 470, y1: 748 };
const CHANNEL = { y0: 714, y1: 748 };
const EVENT_U = 3.0;

const C = {
  lapis: "#1f3f8a",
  lapisDark: "#16306c",
  lapisDeep: "#112656",
  malachite: "#2f7d5b",
  malDark: "#1f5a40",
  malDeep: "#173f2e",
  malLight: "#5fa37a",
  vermilion: "#c8402a",
  verDark: "#8e2717",
  orpiment: "#e3b23c",
  white: "#f4efe2",
  rose: "#d98a8a",
  mauve: "#8a5a8c",
  mauveLight: "#b48ab0",
  sand: "#a8523c",
  sandDark: "#7c3726",
  sandLight: "#c27156",
  gold: "#c9a13b",
  goldLight: "#ecd28a",
  goldDark: "#7d5a1c",
  bole: "#8a3b24",
  ink: "#33200f",
  black: "#17110d",
  paper: "#efe4c8",
  water: "#8aa3b0",
  waterDark: "#6d8796",
  skinLine: "#7a3f22",
  indigo: "#2b3570",
  ochre: "#c98a2e",
  teal: "#3a8c88",
  pink: "#e7a9a0",
};

const FONT_ZH = "'Xingkai SC', 'STXingkai', 'Kaiti SC', 'STKaiti', serif";
const FONT_EN = "'Apple Chancery', 'Hoefler Text', 'Palatino', serif";
// the English year's figures: the chancery face's figures sit low, so they are set in a lining italic
const FONT_FIG = "'Palatino', 'Book Antiqua', serif";

// ------------------------------------------------------------------ drawing helpers
function trace(ctx, pts, closed = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  if (closed) ctx.closePath();
}
function fill(ctx, pts, color) {
  trace(ctx, pts, true);
  ctx.fillStyle = color;
  ctx.fill();
}
function line(ctx, pts, color, w, closed = false) {
  trace(ctx, pts, closed);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}
/** Fill and hairline: the basic unit of the miniature. */
function shape(ctx, pts, color, ink = C.ink, w = 0.28) {
  fill(ctx, pts, color);
  if (ink) line(ctx, pts, ink, w, true);
}
function circle(ctx, x, y, r, color, ink = null, w = 0.25) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  if (color) {
    ctx.fillStyle = color;
    ctx.fill();
  }
  if (ink) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = w;
    ctx.stroke();
  }
}
function ellipse(ctx, x, y, rx, ry, rot, color, ink = null, w = 0.25) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, TAU);
  if (color) {
    ctx.fillStyle = color;
    ctx.fill();
  }
  if (ink) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = w;
    ctx.stroke();
  }
}
/** A tapered line: a filled ribbon whose width runs from w0 to w1. */
function taper(ctx, pts, w0, w1, color) {
  const n = pts.length;
  if (n < 2) return;
  const L = [];
  const R = [];
  for (let i = 0; i < n; i += 1) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
    const t = i / (n - 1);
    const w = (w0 + (w1 - w0) * t) / 2;
    L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
    R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
  }
  fill(ctx, L.concat(R.reverse()), color);
}
/** A swelling stroke: thin at both ends, full in the middle. */
function swell(ctx, pts, w, color) {
  const n = pts.length;
  const L = [];
  const R = [];
  for (let i = 0; i < n; i += 1) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
    const t = i / (n - 1);
    const hw = (w / 2) * Math.sin(Math.PI * clamp(t, 0.04, 0.96)) ** 0.7;
    L.push([pts[i][0] - dy * hw, pts[i][1] + dx * hw]);
    R.push([pts[i][0] + dy * hw, pts[i][1] - dx * hw]);
  }
  fill(ctx, L.concat(R.reverse()), color);
}
function clipTo(ctx, pts, fn) {
  ctx.save();
  trace(ctx, pts, true);
  ctx.clip();
  fn();
  ctx.restore();
}
function bbox(pts) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p[0]);
    y0 = Math.min(y0, p[1]);
    x1 = Math.max(x1, p[0]);
    y1 = Math.max(y1, p[1]);
  }
  return { x0, y0, x1, y1 };
}
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const ell = (cx, cy, rx, ry, n = 24, a0 = 0, a1 = TAU) => {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const a = a0 + ((a1 - a0) * i) / (a1 - a0 >= TAU - 1e-6 ? n : n - 1);
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
};

/**
 * Gold: base tone, a light touch along the upper-left side of the form, fine
 * darker lines, a hairline edge, and a little rubbing that shows the red bole.
 */
function gilt(ctx, pts, opts = {}) {
  const b = bbox(pts);
  fill(ctx, pts, opts.base || C.gold);
  clipTo(ctx, pts, () => {
    const g = ctx.createLinearGradient(b.x0, b.y0, b.x0 + (b.x1 - b.x0) * 0.75, b.y0 + (b.y1 - b.y0) * 0.75);
    g.addColorStop(0, "rgba(246,226,160,0.85)");
    g.addColorStop(0.45, "rgba(236,210,138,0.15)");
    g.addColorStop(1, "rgba(110,78,20,0.25)");
    ctx.fillStyle = g;
    ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    if (opts.hatch) {
      ctx.strokeStyle = "rgba(125,90,28,0.55)";
      ctx.lineWidth = 0.12;
      for (let x = b.x0 - (b.y1 - b.y0); x < b.x1; x += opts.hatch) {
        ctx.beginPath();
        ctx.moveTo(x, b.y1);
        ctx.lineTo(x + (b.y1 - b.y0), b.y0);
        ctx.stroke();
      }
    }
    if (opts.rub) {
      const next = rng(opts.rub);
      ctx.fillStyle = "rgba(138,59,36,0.45)";
      const n = Math.ceil(((b.x1 - b.x0) * (b.y1 - b.y0)) / 60);
      for (let i = 0; i < n; i += 1) {
        if (next() > 0.35) continue;
        circle(ctx, lerp(b.x0, b.x1, next()), lerp(b.y0, b.y1, next()), 0.15 + next() * 0.3, "rgba(138,59,36,0.4)");
      }
    }
    // burnished relief: a bright rim along the upper-left edges, a brown one
    // along the lower-right, so every gold form reads as metal, not yellow
    const d = clamp(Math.min(b.x1 - b.x0, b.y1 - b.y0) * 0.09, 0.12, 0.45);
    ctx.save();
    ctx.translate(d, d);
    line(ctx, pts, "rgba(255,244,200,0.9)", d * 1.3, true);
    ctx.restore();
    ctx.save();
    ctx.translate(-d, -d);
    line(ctx, pts, "rgba(96,64,16,0.55)", d * 1.3, true);
    ctx.restore();
  });
  if (opts.line !== false) line(ctx, pts, opts.ink || C.goldDark, opts.w || 0.22, true);
}

/** A gold stroke: a dark under-line, the gold, and a light line along it. */
function goldLine(ctx, pts, w) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  line(ctx, pts, C.goldDark, w + 0.3);
  line(ctx, pts, C.gold, w);
  line(ctx, pts.map((p) => [p[0] - w * 0.12, p[1] - w * 0.18]), C.goldLight, w * 0.35);
}

// ------------------------------------------------------------------ border: gold scroll on lapis
function flower5(ctx, x, y, r, rot, seed, kind = 0) {
  if (kind === 0) {
    // a rosette of five petals
    for (let i = 0; i < 5; i += 1) {
      const a = rot + (i / 5) * TAU;
      const pts = [];
      for (let k = 0; k <= 8; k += 1) {
        const t = k / 8;
        const aa = a + (t - 0.5) * 1.0;
        const rr = r * (0.25 + 0.75 * Math.sin(Math.PI * t) ** 0.6);
        pts.push([x + Math.cos(aa) * rr, y + Math.sin(aa) * rr]);
      }
      pts.push([x, y]);
      gilt(ctx, pts, { w: 0.16, rub: hash(seed, i) < 0.3 ? seed + i : 0 });
    }
    circle(ctx, x, y, r * 0.28, C.vermilion, C.goldDark, 0.15);
  } else if (kind === 1) {
    // a palmette: three lobes and a cup
    const d = [Math.cos(rot), Math.sin(rot)];
    const n = [-d[1], d[0]];
    const P = (u, v) => [x + d[0] * u * r + n[0] * v * r, y + d[1] * u * r + n[1] * v * r];
    const lobe = [P(-0.3, 0), P(0.1, 0.6), P(0.6, 0.95), P(0.75, 0.5), P(1.2, 0.3), P(1.45, 0), P(1.2, -0.3), P(0.75, -0.5), P(0.6, -0.95), P(0.1, -0.6)];
    gilt(ctx, smoothClosed(lobe, 4), { w: 0.16, hatch: 0.6 });
    line(ctx, [P(0, 0), P(1.2, 0)], C.goldDark, 0.14);
    shape(ctx, [P(-0.35, -0.3), P(0.15, 0), P(-0.35, 0.3)], C.vermilion, C.goldDark, 0.12);
  } else {
    // a bud
    const d = [Math.cos(rot), Math.sin(rot)];
    const n = [-d[1], d[0]];
    const P = (u, v) => [x + d[0] * u * r + n[0] * v * r, y + d[1] * u * r + n[1] * v * r];
    gilt(ctx, smoothClosed([P(-0.2, 0), P(0.3, 0.45), P(0.95, 0.15), P(1.2, 0), P(0.95, -0.15), P(0.3, -0.45)], 4), { w: 0.16 });
    line(ctx, [P(0.1, 0), P(0.95, 0)], C.goldDark, 0.12);
  }
}
function leaf(ctx, x, y, len, rot, wid = 0.35, color = null) {
  const d = [Math.cos(rot), Math.sin(rot)];
  const n = [-d[1], d[0]];
  const P = (u, v) => [x + d[0] * u * len + n[0] * v * len, y + d[1] * u * len + n[1] * v * len];
  const pts = smoothClosed([P(0, 0), P(0.35, wid * 0.9), P(0.75, wid * 0.55), P(1, 0), P(0.75, -wid * 0.55), P(0.35, -wid * 0.9)], 3);
  if (color) {
    fill(ctx, pts, color);
  } else gilt(ctx, pts, { w: 0.14 });
  line(ctx, [P(0.05, 0), P(0.85, 0)], color ? "rgba(0,0,0,0.25)" : C.goldDark, 0.1);
}
function bird(ctx, x, y, s, dir, seed) {
  // a small gold bird perched in the scroll, with a red breast
  const P = (u, v) => [x + u * s * dir, y + v * s];
  const body = smoothClosed([P(-3.2, -0.2), P(-1, -1.6), P(1.4, -1.8), P(2.4, -2.8), P(3.4, -2.4), P(3.0, -1.2), P(1.8, 0.6), P(-0.5, 1.2), P(-2.8, 0.6)], 4);
  gilt(ctx, body, { w: 0.15 });
  shape(ctx, [P(1.2, -0.6), P(2.6, -1.4), P(2.0, 0.2), P(0.6, 0.8)], C.vermilion, C.goldDark, 0.12);
  shape(ctx, [P(-2.5, -0.2), P(-5.6, -1.6), P(-5.4, 0.2), P(-2.2, 0.8)], C.gold, C.goldDark, 0.14);
  shape(ctx, [P(3.4, -2.5), P(4.4, -2.2), P(3.3, -2.0)], C.goldLight, C.goldDark, 0.1);
  circle(ctx, ...P(2.6, -2.35), 0.22 * s, C.black);
  line(ctx, [P(-0.6, -0.9), P(0.6, -0.2), P(-1.6, 0.3)], C.goldDark, 0.12);
}

/** One border band in its own frame: x along the band (0..len), y across (0..w). */
function scrollBand(ctx, len, w, seed) {
  const next = rng(seed);
  fill(ctx, rect(-2, 0, len + 2, w), C.lapis);
  // the lapis is ground mineral: a mottle of darker and lighter grains
  for (let i = 0; i < len * w * 0.22; i += 1) {
    const x = next() * len;
    const y = next() * w;
    circle(ctx, x, y, 0.15 + next() * 0.35, next() < 0.5 ? "rgba(17,38,86,0.5)" : "rgba(70,105,180,0.25)");
  }
  const mid = w / 2;
  const P = 52;
  const A = w * 0.22;
  const stemY = (x) => mid + A * Math.sin((TAU * x) / P);
  const stem = [];
  for (let x = -4; x <= len + 4; x += 1.2) stem.push([x, stemY(x)]);
  fineScroll(ctx, len, w, P, rng(seed + 5));
  // in every hollow of the wave a tendril curls in to a large flower
  let birdNext = 90 + next() * 60;
  for (let j = -1; j * (P / 2) < len + P; j += 1) {
    const xc = j * (P / 2) + P / 4; // crest or trough
    const side = Math.sin((TAU * xc) / P) > 0 ? -1 : 1; // the hollow lies on this side of the stem
    const fy = mid + side * A * 0.95;
    const s0 = xc - P * 0.2;
    const start = [s0, stemY(s0)];
    const fc = [xc + 1.5, fy];
    const curl = [];
    for (let k = 0; k <= 16; k += 1) {
      const t = k / 16;
      // a quadratic sweep into the hollow, ending in a small hook round the flower
      const ctrl = [xc - P * 0.12, fy + side * 3.5];
      const q = [(1 - t) * (1 - t) * start[0] + 2 * (1 - t) * t * ctrl[0] + t * t * fc[0], (1 - t) * (1 - t) * start[1] + 2 * (1 - t) * t * ctrl[1] + t * t * fc[1]];
      curl.push(q);
    }
    goldLine(ctx, curl, 0.5);
    // a leaf or two on the tendril, and a bud branching off it
    leaf(ctx, curl[5][0], curl[5][1], 4.4, side > 0 ? 0.9 : -0.9, 0.32);
    leaf(ctx, curl[9][0], curl[9][1], 3.6, side > 0 ? -2.2 : 2.2, 0.32);
    const budBase = curl[11];
    goldLine(ctx, [budBase, [budBase[0] + 4, budBase[1] + side * 3.5]], 0.32);
    flower5(ctx, budBase[0] + 4, budBase[1] + side * 3.8, 2.2, side > 0 ? 1.2 : -1.2, seed + j * 5, 2);
    if (xc > birdNext && xc < len - 30) {
      bird(ctx, fc[0], fy + side * 1.5, 1.3, side, seed + j);
      birdNext = xc + 150 + next() * 90;
    } else {
      const kind = ((j % 2) + 2) % 2 === 0 ? 0 : 1;
      if (kind === 0) {
        flower5(ctx, fc[0], fc[1], 6.0, next() * TAU, seed * 7 + j, 0);
        // an inner ring of small petals
        flower5(ctx, fc[0], fc[1], 2.6, next() * TAU, seed * 9 + j, 0);
      } else {
        flower5(ctx, fc[0] - 3.5, fc[1], 5.0, 0, seed * 7 + j, 1);
      }
    }
    // a small flower on the outer side of the crest, against the rule
    flower5(ctx, xc - 1, stemY(xc) - side * 5.2, 2.0, next() * TAU, seed + j * 3, 0);
  }
  goldLine(ctx, stem, 1.0);
  // leaves on the main stem, in pairs
  for (let x = 4; x < len; x += 8.66) {
    const slope = Math.cos((TAU * x) / P) * ((TAU * A) / P);
    const a = Math.atan(slope);
    leaf(ctx, x, stemY(x), 3.4, a - 0.9, 0.3);
    leaf(ctx, x + 2, stemY(x + 2), 3.2, a + Math.PI + 0.9 - Math.PI, 0.3);
  }
  // fine gold rules along both edges
  line(ctx, [[-2, 1.0], [len + 2, 1.0]], C.gold, 0.55);
  line(ctx, [[-2, w - 1.0], [len + 2, w - 1.0]], C.gold, 0.55);
}

/** The finer under-scroll of a border band: hairline spirals, leaves, florets. */
function fineScroll(ctx, len, w, P, next) {
  const mid = w / 2;
  for (let x = 6; x < len; x += P / 2) {
    for (const side of [-1, 1]) {
      const cx = x + (side > 0 ? 6 : -4) + (next() - 0.5) * 3;
      const cy = mid + side * (w * 0.36);
      const sp = [];
      const r0 = 3.2 + next() * 0.8;
      const a0 = next() * TAU;
      for (let k = 0; k <= 18; k += 1) {
        const t = k / 18;
        const a = a0 + t * 4.4 * side;
        sp.push([cx + Math.cos(a) * r0 * (1 - t * 0.7), cy + Math.sin(a) * r0 * 0.7 * (1 - t * 0.7)]);
      }
      line(ctx, sp, C.goldDark, 0.32);
      line(ctx, sp, C.gold, 0.2);
      leaf(ctx, sp[4][0], sp[4][1], 1.8, a0 + side * 0.8, 0.34);
      for (let k = 0; k < 3; k += 1) {
        const a = a0 + Math.PI + k * 0.7;
        circle(ctx, sp[0][0] + Math.cos(a) * 1.1, sp[0][1] + Math.sin(a) * 1.1, 0.42, C.gold, C.goldDark, 0.07);
      }
    }
  }
  // gold dots to fill the ground, some in threes
  for (let i = 0; i < len * 0.9; i += 1) {
    const x = next() * len;
    const y = 2.2 + next() * (w - 4.4);
    circle(ctx, x, y, 0.28 + next() * 0.12, C.gold, C.goldDark, 0.07);
    if (next() < 0.25) circle(ctx, x - 0.18, y - 0.18, 0.12, C.goldLight);
  }
}

function paintRules(ctx, x0, y0, x1, y1) {
  // gold, black, red, gold: the rules that frame the picture
  const r = (o, color, w) => line(ctx, [[x0 - o, y0 - o], [x1 + o, y0 - o], [x1 + o, y1 + o], [x0 - o, y1 + o]], color, w, true);
  r(3.2, C.gold, 1.4);
  r(1.9, C.black, 0.9);
  r(0.9, C.vermilion, 1.0);
  r(0.2, C.goldLight, 0.4);
}

function paintBorder(ctx) {
  // vertical bands at both ends first, then the horizontal ones over them
  const bandW = 34;
  ctx.save();
  ctx.translate(52, 400);
  ctx.rotate(Math.PI / 2);
  scrollBand(ctx, 420, bandW, 811);
  ctx.restore();
  ctx.save();
  ctx.translate(982, 400);
  ctx.rotate(Math.PI / 2);
  scrollBand(ctx, 420, bandW, 823);
  ctx.restore();
  // beyond the frame: plain lapis with a scroll (only glimpsed)
  ctx.save();
  ctx.translate(PAGE.x0, 433);
  scrollBand(ctx, PAGE.x1 - PAGE.x0, 33, 801);
  ctx.restore();
  ctx.save();
  ctx.translate(PAGE.x0, 753);
  scrollBand(ctx, PAGE.x1 - PAGE.x0, 37, 807);
  ctx.restore();
  // outside the side bands: lapis margin
  fill(ctx, rect(PAGE.x0, 470, 18, 752), C.lapisDeep);
  fill(ctx, rect(982, 470, PAGE.x1, 752), C.lapisDeep);
  // above and below the bands: the page margin, cream with a gold ruling
  fill(ctx, rect(PAGE.x0, PAGE.y0, PAGE.x1, 433), C.paper);
  line(ctx, [[PAGE.x0, 432.4], [PAGE.x1, 432.4]], C.gold, 1.0);
  fill(ctx, rect(PAGE.x0, 790, PAGE.x1, PAGE.y1), C.paper);
  line(ctx, [[PAGE.x0, 790.6], [PAGE.x1, 790.6]], C.gold, 1.0);
  // corner pieces where the bands meet
  for (const [cx, cy] of [[35, 451], [965, 451], [35, 771], [965, 771]]) {
    fill(ctx, rect(cx - 17, cy - 17.5, cx + 17, cy + 17.5), C.lapisDark);
    // a ring of small buds and dots round the corner rosette
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * TAU + 0.26;
      if (i % 3 === 1) continue;
      flower5(ctx, cx + Math.cos(a) * 12.5, cy + Math.sin(a) * 12.5, 1.8, a, cx + i, 2);
    }
    for (let i = 0; i < 24; i += 1) {
      const a = (i / 24) * TAU;
      circle(ctx, cx + Math.cos(a) * 15.2, cy + Math.sin(a) * 15.2, 0.32, C.gold, C.goldDark, 0.07);
    }
    flower5(ctx, cx, cy, 8.5, 0.3, cx + cy, 0);
    for (let i = 0; i < 4; i += 1) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      leaf(ctx, cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, 6, a, 0.35);
    }
    line(ctx, rect(cx - 16.5, cy - 16.5, cx + 16.5, cy + 16.5), C.gold, 0.6, true);
  }
  paintRules(ctx, PIC.x0, PIC.y0, PIC.x1, PIC.y1);
}

// ------------------------------------------------------------------ sky, trees, wall
function paintSky(ctx) {
  const g = ctx.createLinearGradient(0, 470, 0, 560);
  g.addColorStop(0, "#d9b553");
  g.addColorStop(1, "#c9a13b");
  ctx.fillStyle = g;
  ctx.fillRect(PIC.x0, 470, PIC.x1 - PIC.x0, 90);
  // burnished gold: faint horizontal strokes of the agate
  const next = rng(402);
  // broad burnished patches where the agate caught the light
  for (let i = 0; i < 14; i += 1) {
    const x = PIC.x0 + next() * (PIC.x1 - PIC.x0);
    const y = 488 + next() * 50;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, 40);
    gr.addColorStop(0, "rgba(250,232,160,0.32)");
    gr.addColorStop(1, "rgba(250,232,160,0)");
    ctx.fillStyle = gr;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(2.2, 0.5);
    ctx.translate(-x, -y);
    ctx.fillRect(x - 40, y - 40, 80, 80);
    ctx.restore();
  }
  for (let i = 0; i < 700; i += 1) {
    const x = PIC.x0 + next() * (PIC.x1 - PIC.x0);
    const y = 471 + next() * 80;
    const l = 6 + next() * 22;
    line(ctx, [[x, y], [x + l, y + (next() - 0.5) * 0.6]], next() < 0.55 ? "rgba(125,90,28,0.22)" : "rgba(252,236,175,0.45)", 0.22);
  }
  // a band of lapis at the very top, streaked into the gold
  const top = ctx.createLinearGradient(0, 470, 0, 486);
  top.addColorStop(0, "rgba(31,63,138,0.9)");
  top.addColorStop(1, "rgba(31,63,138,0)");
  ctx.fillStyle = top;
  ctx.fillRect(PIC.x0, 470, PIC.x1 - PIC.x0, 16);
  // curling clouds, white and blue, outlined
  const clouds = [[95, 482, 1.0, 1], [470, 478, 1.15, -1], [925, 484, 0.8, 1], [140, 503, 0.7, -1], [512, 500, 0.65, 1]];
  for (const [x, y, s, d] of clouds) cloud(ctx, x, y, s, d);
  // a few birds in flight, hairline
  for (const [x, y, s] of [[120, 492, 1], [133, 488, 0.8], [455, 494, 0.9], [918, 498, 0.9]]) {
    line(ctx, smoothOpen([[x - 3 * s, y - 0.5 * s], [x - 1.4 * s, y - 1.6 * s], [x, y], [x + 1.4 * s, y - 1.7 * s], [x + 3.2 * s, y - 0.8 * s]], 3), C.ink, 0.3);
  }
}
function cloud(ctx, x, y, s, d) {
  // a scalloped cloud-band ending in curls, in the Persian manner
  const P = (u, v) => [x + u * s * d, y + v * s];
  const lobes = [[-18, 0.5, 3.2], [-12, -1.5, 4.2], [-5, -2.8, 4.8], [2.5, -2, 4.4], [9, -0.8, 3.6], [15, 0.4, 2.8]];
  const body = smoothClosed([P(-22, 2.5), P(-14, 3.2), P(-4, 2.6), P(6, 2.9), P(16, 2.4), P(20, 1.4), P(17, -1), P(8, -3.8), P(-4, -5.6), P(-14, -4.4), P(-21, -1)], 5);
  for (const [u, v, r] of lobes) circle(ctx, ...P(u, v), r * s, "rgba(246,243,234,0.97)");
  fill(ctx, body, "rgba(246,243,234,0.97)");
  // the scallops of the upper edge and inner lines, in blue
  ctx.strokeStyle = "#3e5f9e";
  ctx.lineWidth = 0.35;
  for (const [u, v, r] of lobes) {
    const c = P(u, v);
    ctx.beginPath();
    if (d > 0) ctx.arc(c[0], c[1], r * s, Math.PI * 1.02, Math.PI * 1.98);
    else ctx.arc(c[0], c[1], r * s, Math.PI * 1.02, Math.PI * 1.98);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c[0], c[1] + r * s * 0.35, r * s * 0.55, Math.PI * 1.1, Math.PI * 1.9);
    ctx.strokeStyle = "rgba(62,95,158,0.5)";
    ctx.stroke();
    ctx.strokeStyle = "#3e5f9e";
  }
  line(ctx, smoothOpen([P(-21, 2.4), P(-10, 3.3), P(4, 2.8), P(17, 2.3)], 4), "#3e5f9e", 0.35);
  for (const [cx, cy, r, sgn] of [[-22, 0.5, 3.0, -1], [19.5, 0.2, 2.6, 1]]) {
    const curl = [];
    for (let k = 0; k <= 22; k += 1) {
      const t = k / 22;
      const a = Math.PI / 2 + t * 5.2 * sgn;
      curl.push(P(cx + Math.cos(a) * r * (1 - t * 0.75) * sgn, cy - Math.sin(a) * r * (1 - t * 0.75)));
    }
    line(ctx, curl, "#3e5f9e", 0.4);
  }
  // a trailing wisp
  line(ctx, smoothOpen([P(17, 2.3), P(24, 3.4), P(30, 2.6)], 4), "rgba(62,95,158,0.7)", 0.3);
}

function treeCrown(ctx, cx, cy, rx, ry, kind, seed) {
  const next = rng(seed);
  const outline = smoothClosed(Array.from({ length: 11 }, (_, i) => {
    const a = (i / 11) * TAU;
    const r = 0.85 + next() * 0.3;
    return [cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r];
  }), 5);
  const base = kind === "chinar" ? "#2a5e34" : kind === "mango" ? "#1f4a30" : "#2e6a3c";
  shape(ctx, outline, base, "#163322", 0.3);
  clipTo(ctx, outline, () => {
    // individually painted leaves, darker inside, lighter at the sunlit top-left
    const n = Math.round(rx * ry * 0.9);
    for (let i = 0; i < n; i += 1) {
      const x = cx + (next() * 2 - 1) * rx;
      const y = cy + (next() * 2 - 1) * ry;
      const lit = clamp(0.5 - ((x - cx) / rx) * 0.3 - ((y - cy) / ry) * 0.45 + (next() - 0.5) * 0.5);
      const col = lit > 0.7 ? "#8dbf6a" : lit > 0.5 ? "#5c9a52" : lit > 0.3 ? "#3d7a44" : "#173a26";
      const a = next() * TAU;
      if (kind === "chinar") {
        // five-pointed plane leaves, some already turning
        const c2 = next() < 0.12 ? "#c8742e" : col;
        const pts = [];
        for (let k = 0; k < 10; k += 1) {
          const aa = a + (k / 10) * TAU;
          const r = k % 2 ? 0.6 : 1.5;
          pts.push([x + Math.cos(aa) * r, y + Math.sin(aa) * r]);
        }
        fill(ctx, pts, c2);
      } else {
        leaf(ctx, x, y, kind === "mango" ? 3.0 : 2.2, a, 0.32, col);
      }
    }
  });
  return outline;
}

function blossomTree(ctx, x, base, h, w, seed) {
  // a tree in blossom: a dark trunk branching, white and pink flowers along the twigs
  const next = rng(seed);
  const branches = [];
  const grow = (p, a, len, depth) => {
    const q = [p[0] + Math.cos(a) * len, p[1] + Math.sin(a) * len];
    const mid = [(p[0] + q[0]) / 2 + (next() - 0.5) * len * 0.25, (p[1] + q[1]) / 2 + (next() - 0.5) * len * 0.2];
    branches.push({ pts: smoothOpen([p, mid, q], 4), w: Math.max(0.35, depth * 0.8) });
    if (depth > 0) {
      grow(q, a - 0.4 - next() * 0.4, len * 0.72, depth - 1);
      grow(q, a + 0.35 + next() * 0.4, len * 0.7, depth - 1);
    }
  };
  grow([x, base], -Math.PI / 2 + (next() - 0.5) * 0.2, h * 0.38, 3);
  for (const b of branches) taper(ctx, b.pts, b.w * 1.3, b.w * 0.6, "#3a2618");
  for (const b of branches) {
    for (let k = 0; k < 4; k += 1) {
      const p = b.pts[Math.floor(next() * b.pts.length)];
      const fx = p[0] + (next() - 0.5) * 5;
      const fy = p[1] + (next() - 0.5) * 4;
      blossom(ctx, fx, fy, 1.1 + next() * 0.5, next() < 0.55 ? "#fbf3ee" : "#f0b8bd");
    }
  }
}
function blossom(ctx, x, y, r, color) {
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * TAU + x;
    circle(ctx, x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.55, color);
  }
  circle(ctx, x, y, r * 0.3, C.orpiment);
  ctx.beginPath();
  ctx.arc(x, y, r * 1.05, 0, TAU);
  ctx.strokeStyle = "rgba(122,63,34,0.35)";
  ctx.lineWidth = 0.12;
  ctx.stroke();
}

function paintTreesBehind(ctx) {
  treeCrown(ctx, 70, 512, 24, 26, "chinar", 61);
  treeCrown(ctx, 118, 520, 20, 18, "mango", 62);
  blossomTree(ctx, 440, 545, 70, 30, 63);
  treeCrown(ctx, 540, 512, 26, 30, "chinar", 64);
  treeCrown(ctx, 932, 508, 26, 30, "mango", 65);
  // between title and pavilion the trees show over the wall
  treeCrown(ctx, 395, 528, 16, 12, "mango", 66);
}

function paintWall(ctx, x0, x1) {
  const top = 524;
  const bot = 552;
  // the garden wall: red sandstone with a white marble coping and arched niches
  fill(ctx, rect(x0, top, x1, bot), C.sand);
  // ashlar joints
  ctx.strokeStyle = "rgba(90,35,20,0.35)";
  ctx.lineWidth = 0.18;
  for (let y = top + 4; y < bot; y += 4) {
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    for (let x = x0 + ((y / 4) % 2) * 5; x < x1; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }
  for (let x = x0 + 14; x < x1 - 8; x += 26) {
    // a cusped niche with a vase
    const n = [[x - 5, bot - 6], [x - 5, top + 13], [x - 4, top + 10], [x - 2.4, top + 9.2], [x - 1.2, top + 7.6], [x, top + 6.4], [x + 1.2, top + 7.6], [x + 2.4, top + 9.2], [x + 4, top + 10], [x + 5, top + 13], [x + 5, bot - 6]];
    shape(ctx, n, "#5e2a1c", C.white, 0.6);
    const vx = x;
    const vy = bot - 6;
    shape(ctx, smoothClosed([[vx - 1.4, vy], [vx - 2.4, vy - 2.6], [vx - 1, vy - 4.4], [vx - 0.6, vy - 6], [vx + 0.6, vy - 6], [vx + 1, vy - 4.4], [vx + 2.4, vy - 2.6], [vx + 1.4, vy]], 3), hash(x, 3) < 0.5 ? C.lapis : C.gold, C.ink, 0.15);
  }
  // coping: white marble with a running inlay
  fill(ctx, rect(x0, top - 3, x1, top + 1), C.white);
  line(ctx, [[x0, top - 3], [x1, top - 3]], C.ink, 0.25);
  line(ctx, [[x0, top + 1], [x1, top + 1]], C.ink, 0.25);
  for (let x = x0; x < x1; x += 3) fill(ctx, [[x, top - 1], [x + 1.5, top - 2.3], [x + 3, top - 1], [x + 1.5, top + 0.3]], hash(x, 9) < 0.5 ? C.sand : "#5a7f6a");
  // merlons
  for (let x = x0 + 2; x < x1 - 2; x += 7) shape(ctx, [[x, top - 3], [x, top - 5.5], [x + 1.2, top - 6.8], [x + 2.4, top - 5.5], [x + 2.4, top - 3]], C.white, C.ink, 0.18);
  line(ctx, [[x0, bot], [x1, bot]], C.ink, 0.35);
}

// ------------------------------------------------------------------ lawn, carpet, canopy
function sprig(ctx, x, y, s, kind) {
  // a tiny flowering plant seen from the side
  line(ctx, [[x, y], [x + 0.3 * s, y - 3 * s]], "#1b4a30", 0.22 * s);
  leaf(ctx, x, y - 0.6 * s, 1.8 * s, -2.4, 0.3, "#5fa37a");
  leaf(ctx, x, y - 0.9 * s, 1.6 * s, -0.7, 0.3, "#4a9068");
  const cols = [C.white, C.vermilion, C.orpiment, "#d9a3c4", "#9ab8e0"];
  const c = cols[kind % cols.length];
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * TAU;
    circle(ctx, x + 0.3 * s + Math.cos(a) * 0.55 * s, y - 3.2 * s + Math.sin(a) * 0.55 * s, 0.42 * s, c);
  }
  circle(ctx, x + 0.3 * s, y - 3.2 * s, 0.3 * s, kind % 5 === 2 ? C.vermilion : C.orpiment);
}

function paintLawn(ctx) {
  const top = 552;
  const bot = 662;
  const g = ctx.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, "#2a7454");
  g.addColorStop(1, "#2f7d5b");
  ctx.fillStyle = g;
  ctx.fillRect(PIC.x0, top, PIC.x1 - PIC.x0, bot - top);
  const next = rng(510);
  // grass: fine strokes in two greens
  for (let i = 0; i < 5200; i += 1) {
    const x = PIC.x0 + next() * (PIC.x1 - PIC.x0);
    const y = top + next() * (bot - top);
    const l = 1.2 + next() * 1.2;
    line(ctx, [[x, y], [x + (next() - 0.5) * 0.8, y - l]], next() < 0.5 ? "rgba(23,63,46,0.6)" : "rgba(110,175,120,0.55)", 0.2);
  }
  // the millefleur of the garden floor: tufts of grass, leafy rosettes and
  // flowering plants, each drawn whole, set close in staggered rows
  let row = 0;
  for (let gy = top + 5; gy < bot - 1; gy += 5.2) {
    row += 1;
    for (let gx = PIC.x0 + (row % 2) * 3.4; gx < PIC.x1 + 4; gx += 6.8) {
      const x = gx + (next() - 0.5) * 3;
      const y = gy + (next() - 0.5) * 2;
      const r = next();
      if (r < 0.42) tuft(ctx, x, y, 0.9 + next() * 0.5, next);
      else if (r < 0.6) rosette(ctx, x, y, 0.9 + next() * 0.4, next);
      else if (r < 0.8) sprig(ctx, x, y, 1.05 + next() * 0.4, Math.floor(next() * 5));
      else spray(ctx, x, y, 1.0 + next() * 0.4, next);
    }
  }
}
function tuft(ctx, x, y, s, next) {
  // a fan of grass blades, dark at the root
  for (let i = 0; i < 6; i += 1) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.28 + (next() - 0.5) * 0.15;
    const l = (2.2 + next() * 1.6) * s;
    swell(ctx, smoothOpen([[x, y], [x + Math.cos(a) * l * 0.5 + 0.2, y + Math.sin(a) * l * 0.55], [x + Math.cos(a) * l, y + Math.sin(a) * l]], 3), 0.45 * s, i % 2 ? "#1d5238" : "#4f9a68");
  }
}
function rosette(ctx, x, y, s, next) {
  // a low leafy plant: broad leaves splayed from the ground, veined
  for (let i = 0; i < 5; i += 1) {
    const a = -Math.PI / 2 + (i - 2) * 0.55;
    leaf(ctx, x, y, (2.4 + next() * 0.6) * s, a, 0.38, i % 2 ? "#2c6f48" : "#3f8a5a");
  }
  line(ctx, [[x - 1.2 * s, y], [x + 1.2 * s, y]], "rgba(23,63,46,0.6)", 0.2);
}
function spray(ctx, x, y, s, next) {
  // three slender stems with small buds: a wild flower
  const col = [C.white, "#d9a3c4", C.orpiment, "#9ab8e0"][Math.floor(next() * 4)];
  for (let i = 0; i < 3; i += 1) {
    const a = -Math.PI / 2 + (i - 1) * 0.35;
    const tip = [x + Math.cos(a) * 3.6 * s, y + Math.sin(a) * 3.6 * s];
    line(ctx, [[x, y], tip], "#1b4a30", 0.18 * s);
    ellipse(ctx, tip[0], tip[1], 0.55 * s, 0.75 * s, a + Math.PI / 2, col, "rgba(51,32,15,0.5)", 0.08);
  }
  leaf(ctx, x, y - 0.4 * s, 1.6 * s, -2.6, 0.3, "#4a9068");
  leaf(ctx, x, y - 0.4 * s, 1.6 * s, -0.5, 0.3, "#3a7d58");
}

function carpetMotif(ctx, x, y, s, c1, c2) {
  // a small floral cross: four petals and leaves, the carpet's repeating unit
  for (let i = 0; i < 4; i += 1) {
    const a = (i * Math.PI) / 2;
    ellipse(ctx, x + Math.cos(a) * 1.4 * s, y + Math.sin(a) * 1.4 * s, 1.2 * s, 0.6 * s, a, c1);
    ellipse(ctx, x + Math.cos(a + Math.PI / 4) * 1.5 * s, y + Math.sin(a + Math.PI / 4) * 1.5 * s, 0.8 * s, 0.35 * s, a + Math.PI / 4, c2);
  }
  circle(ctx, x, y, 0.6 * s, C.white);
  circle(ctx, x, y, 0.3 * s, C.vermilion);
}

const CARPET = { x0: 118, x1: 384, y0: 552, y1: 652 };
function paintCarpet(ctx) {
  const { x0, x1, y0, y1 } = CARPET;
  // fringes at both short ends
  for (let y = y0 + 1; y < y1; y += 1.2) {
    line(ctx, [[x0, y], [x0 - 3.2, y + 0.3]], C.white, 0.4);
    line(ctx, [[x1, y], [x1 + 3.2, y + 0.3]], C.white, 0.4);
  }
  fill(ctx, rect(x0, y0, x1, y1), "#1c2f63");
  // outer guard: red with a reciprocal zigzag
  const band = (i0, i1, color) => {
    fill(ctx, [[x0 + i0, y0 + i0], [x1 - i0, y0 + i0], [x1 - i0, y1 - i0], [x0 + i0, y1 - i0], [x0 + i0, y0 + i0], [x0 + i1, y0 + i1], [x0 + i1, y1 - i1], [x1 - i1, y1 - i1], [x1 - i1, y0 + i1], [x0 + i1, y0 + i1]], color);
  };
  band(0, 3, C.vermilion);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.rect(x0 + 3, y0 + 3, x1 - x0 - 6, y1 - y0 - 6);
  ctx.clip("evenodd");
  for (let x = x0; x < x1; x += 2) {
    fill(ctx, [[x, y0], [x + 1, y0 + 3], [x + 2, y0]], C.orpiment);
    fill(ctx, [[x, y1], [x + 1, y1 - 3], [x + 2, y1]], C.orpiment);
  }
  for (let y = y0; y < y1; y += 2) {
    fill(ctx, [[x0, y], [x0 + 3, y + 1], [x0, y + 2]], C.orpiment);
    fill(ctx, [[x1, y], [x1 - 3, y + 1], [x1, y + 2]], C.orpiment);
  }
  ctx.restore();
  // main border: dark blue with a meander of flowers
  band(3, 13, "#1c2f63");
  for (let x = x0 + 8; x < x1 - 4; x += 8) {
    carpetMotif(ctx, x, y0 + 8, 1.1, "#e3b23c", "#5fa37a");
    carpetMotif(ctx, x, y1 - 8, 1.1, "#e3b23c", "#5fa37a");
  }
  for (let y = y0 + 16; y < y1 - 12; y += 8) {
    carpetMotif(ctx, x0 + 8, y, 1.1, "#e3b23c", "#5fa37a");
    carpetMotif(ctx, x1 - 8, y, 1.1, "#e3b23c", "#5fa37a");
  }
  band(13, 15, C.orpiment);
  // field: vermilion with a lattice of vines and flowers
  const fx0 = x0 + 15;
  const fx1 = x1 - 15;
  const fy0 = y0 + 15;
  const fy1 = y1 - 15;
  fill(ctx, rect(fx0, fy0, fx1, fy1), "#b73a28");
  ctx.save();
  ctx.beginPath();
  ctx.rect(fx0, fy0, fx1 - fx0, fy1 - fy0);
  ctx.clip();
  ctx.strokeStyle = "#e9c46a";
  ctx.lineWidth = 0.35;
  for (let k = -20; k < 40; k += 1) {
    ctx.beginPath();
    ctx.moveTo(fx0 + k * 10, fy0);
    ctx.lineTo(fx0 + k * 10 + (fy1 - fy0), fy1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(fx0 + k * 10, fy0);
    ctx.lineTo(fx0 + k * 10 - (fy1 - fy0), fy1);
    ctx.stroke();
  }
  for (let yy = fy0; yy <= fy1 + 5; yy += 5) {
    for (let xx = fx0 + ((Math.round((yy - fy0) / 5) % 2) * 5); xx <= fx1 + 5; xx += 10) {
      carpetMotif(ctx, xx, yy, 0.8, C.white, "#3d8a62");
    }
  }
  ctx.restore();
  // central medallion: a lobed lozenge in dark blue and gold, with pendants
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const med = [];
  for (let i = 0; i < 48; i += 1) {
    const a = (i / 48) * TAU;
    const r = 1 + 0.08 * Math.cos(a * 8);
    const sx = Math.abs(Math.cos(a)) ** 0.8 * Math.sign(Math.cos(a));
    const sy = Math.abs(Math.sin(a)) ** 0.8 * Math.sign(Math.sin(a));
    med.push([mx + sx * 38 * r, my + sy * 22 * r]);
  }
  shape(ctx, med, "#1c2f63", C.orpiment, 0.8);
  clipTo(ctx, med, () => {
    for (let yy = my - 24; yy < my + 24; yy += 5) for (let xx = mx - 40; xx < mx + 40; xx += 6) carpetMotif(ctx, xx + ((yy / 5) % 2) * 3, yy, 0.75, C.orpiment, C.rose);
  });
  const inner = med.map((p) => [mx + (p[0] - mx) * 0.42, my + (p[1] - my) * 0.42]);
  shape(ctx, inner, "#b73a28", C.orpiment, 0.6);
  clipTo(ctx, inner, () => {
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * TAU;
      leaf(ctx, mx, my, 9, a, 0.3, i % 2 ? C.orpiment : "#f2e2b0");
    }
  });
  carpetMotif(ctx, mx, my, 1.6, C.white, C.malachite);
  for (const s of [-1, 1]) {
    shape(ctx, [[mx + s * 38, my - 3], [mx + s * 46, my], [mx + s * 38, my + 3]], C.orpiment, C.ink, 0.2);
  }
  // quarter medallions in the corners of the field
  for (const [cx, cy] of [[fx0, fy0], [fx1, fy0], [fx0, fy1], [fx1, fy1]]) {
    const q = ell(cx, cy, 16, 11, 24);
    clipTo(ctx, rect(fx0, fy0, fx1, fy1), () => {
      shape(ctx, q, "#1c2f63", C.orpiment, 0.6);
      clipTo(ctx, q, () => carpetMotif(ctx, cx, cy, 1.5, C.orpiment, C.rose));
    });
  }
  line(ctx, rect(x0, y0, x1, y1), C.ink, 0.35, true);
}

function bolster(ctx, x, y, w, h) {
  // a round cushion seen from the side: gold brocade with red stripes
  const pts = smoothClosed([[x - w / 2, y], [x - w / 2 - 1, y - h / 2], [x - w / 2, y - h], [x + w / 2, y - h], [x + w / 2 + 1, y - h / 2], [x + w / 2, y]], 4);
  gilt(ctx, pts, { w: 0.3 });
  clipTo(ctx, pts, () => {
    for (let i = 0; i < 7; i += 1) {
      const xx = x - w / 2 + (i + 0.5) * (w / 7);
      fill(ctx, rect(xx - 1, y - h - 1, xx + 1, y + 1), C.vermilion);
      for (let yy = y - h + 2; yy < y; yy += 3) circle(ctx, xx + 2.5, yy, 0.6, C.goldDark);
    }
    const g = ctx.createLinearGradient(0, y - h, 0, y);
    g.addColorStop(0, "rgba(255,240,190,0.35)");
    g.addColorStop(0.5, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(80,40,10,0.35)");
    ctx.fillStyle = g;
    ctx.fillRect(x - w, y - h - 2, w * 2, h + 4);
  });
  line(ctx, pts, C.ink, 0.3, true);
  // tasselled ends
  for (const s of [-1, 1]) {
    ellipse(ctx, x + s * (w / 2 + 0.6), y - h / 2, 1.6, h / 2 - 0.3, 0, C.vermilion, C.ink, 0.2);
    line(ctx, [[x + s * (w / 2 + 1.4), y - h / 2], [x + s * (w / 2 + 3.4), y - h / 2 + 2.5]], C.gold, 0.5);
  }
}

function tray(ctx, x, y, r, fruit, seed) {
  // a gold tray in plan, the fruit on it seen from the side
  const next = rng(seed);
  ellipse(ctx, x, y, r, r * 0.42, 0, C.gold, C.goldDark, 0.3);
  ellipse(ctx, x, y, r * 0.8, r * 0.32, 0, C.goldLight, null);
  ellipse(ctx, x, y, r * 0.8, r * 0.32, 0, null, C.goldDark, 0.18);
  const cols = fruit === "pomegranate" ? ["#c8402a", "#b33424", "#d8603a"] : fruit === "grapes" ? ["#5a3a6a", "#7a4c86"] : ["#e3b23c", "#d9962c", "#9bbf5a"];
  for (let i = 0; i < 9; i += 1) {
    const fx = x + (next() - 0.5) * r * 1.2;
    const fy = y - 0.8 - next() * r * 0.35;
    const fr = fruit === "grapes" ? 0.9 : 1.6 + next() * 0.4;
    circle(ctx, fx, fy, fr, cols[i % cols.length], C.ink, 0.15);
    circle(ctx, fx - fr * 0.3, fy - fr * 0.35, fr * 0.3, "rgba(255,255,255,0.45)");
  }
}

function flask(ctx, x, y, h, body, seed) {
  // a long-necked flask (surahi) in elevation: glass or gold
  const pts = smoothClosed([[x - 1.6, y], [x - h * 0.28, y - h * 0.22], [x - h * 0.22, y - h * 0.45], [x - 0.8, y - h * 0.58], [x - 0.6, y - h * 0.93], [x - 1.2, y - h], [x + 1.2, y - h], [x + 0.6, y - h * 0.93], [x + 0.8, y - h * 0.58], [x + h * 0.22, y - h * 0.45], [x + h * 0.28, y - h * 0.22], [x + 1.6, y]], 3);
  if (body === "gold") gilt(ctx, pts, { w: 0.22 });
  else {
    shape(ctx, pts, body, C.ink, 0.22);
    clipTo(ctx, pts, () => {
      for (let i = 0; i < 4; i += 1) line(ctx, [[x - h * 0.3, y - h * (0.18 + i * 0.07)], [x + h * 0.3, y - h * (0.18 + i * 0.07)]], C.gold, 0.3);
    });
  }
  line(ctx, [[x - h * 0.12, y - h * 0.4], [x - h * 0.16, y - h * 0.25]], "rgba(255,255,255,0.7)", 0.35);
}

const CANOPY = { x0: 108, x1: 394, y0: 520, y1: 534 };
function canopyBack(ctx) {
  // the two back poles, behind the party
  for (const x of [CANOPY.x0 + 10, CANOPY.x1 - 10]) {
    const pts = rect(x - 0.9, CANOPY.y1 - 2, x + 0.9, CARPET.y0 + 2);
    gilt(ctx, pts, { w: 0.2 });
  }
}
function canopyFront(ctx) {
  const { x0, x1, y0, y1 } = CANOPY;
  // guy ropes from the canopy corners to pegs in the lawn
  for (const [ax, bx, by] of [[x0, x0 - 12, 640], [x1, x1 + 12, 640]]) {
    line(ctx, [[ax, y0 + 1], [bx, by]], "#e8dcc0", 0.35);
    shape(ctx, rect(bx - 0.6, by - 1, bx + 0.6, by + 2), C.goldDark, null);
  }
  // front poles
  for (const x of [x0 + 2, x1 - 2]) {
    const pts = rect(x - 1.1, y1 - 2, x + 1.1, CARPET.y1 + 1);
    gilt(ctx, pts, { w: 0.22 });
    for (let y = y1 + 6; y < CARPET.y1; y += 9) line(ctx, [[x - 1.1, y], [x + 1.1, y + 1]], C.goldDark, 0.25);
    gilt(ctx, ell(x, y1 - 3, 1.8, 1.8, 12), { w: 0.2 });
  }
  // the canopy cloth: vermilion with a gold lattice, a scalloped valance with a gold border
  const top = [[x0 - 4, y0], [x1 + 4, y0], [x1 + 2, y0 + 5], [x0 - 2, y0 + 5]];
  shape(ctx, top, C.vermilion, C.ink, 0.3);
  clipTo(ctx, top, () => {
    for (let x = x0 - 6; x < x1 + 6; x += 4) {
      fill(ctx, [[x, y0 + 2.5], [x + 2, y0 + 0.7], [x + 4, y0 + 2.5], [x + 2, y0 + 4.3]], C.gold);
      circle(ctx, x + 2, y0 + 2.5, 0.5, C.verDark);
    }
  });
  const val = [[x0 - 2, y0 + 5], [x1 + 2, y0 + 5]];
  const sc = [];
  const n = 26;
  for (let i = 0; i <= n; i += 1) {
    const x = lerp(x1 + 2, x0 - 2, i / n);
    sc.push([x, y1 + 2]);
    if (i < n) {
      const xm = lerp(x1 + 2, x0 - 2, (i + 0.5) / n);
      sc.push([xm, y1 + 5.5]);
    }
  }
  const valance = val.concat(sc);
  shape(ctx, valance, C.verDark, C.ink, 0.3);
  clipTo(ctx, valance, () => {
    fill(ctx, rect(x0 - 3, y0 + 5, x1 + 3, y0 + 7.2), C.gold);
    for (let x = x0; x < x1; x += 5.5) flower5(ctx, x, y1 - 0.5, 1.6, x * 0.1, x, 0);
  });
  line(ctx, smoothOpen(sc, 2), C.gold, 0.5);
  // finials on the corners
  for (const x of [x0 - 4, x1 + 4]) {
    gilt(ctx, smoothClosed([[x - 1.4, y0], [x - 1.6, y0 - 2], [x, y0 - 5], [x + 1.6, y0 - 2], [x + 1.4, y0]], 3), { w: 0.2 });
  }
}

// ------------------------------------------------------------------ the guests
//
// A guest is drawn from a description: where and how they sit or stand, the
// way the body faces, the way the head faces in each state, the dress, the
// headgear, the face, and what the hands hold in each state. The hand that
// goes to the lips in the astonished state is the near hand unless given.

const SKIN = ["#e3b48b", "#d6a277", "#c88f63", "#ebc39d", "#b97e57", "#dcae86"];

/** Map a figure-local point (x toward the facing side) to world. */
function mapper(x, y, s, dir) {
  return (p) => [x + p[0] * s * dir, y + p[1] * s];
}

function pattern(ctx, pts, kind, colors, step, seed) {
  // stamp a small textile motif over a shape, clipped to it
  const b = bbox(pts);
  clipTo(ctx, pts, () => {
    const next = rng(seed);
    for (let y = b.y0 - step; y < b.y1 + step; y += step) {
      const row = Math.round((y - b.y0) / step);
      for (let x = b.x0 - step + (row % 2) * step * 0.5; x < b.x1 + step; x += step) {
        if (kind === "sprig") {
          circle(ctx, x, y, step * 0.16, colors[0]);
          circle(ctx, x + step * 0.18, y - step * 0.12, step * 0.09, colors[1]);
          line(ctx, [[x - step * 0.1, y + step * 0.1], [x - step * 0.25, y + step * 0.28]], colors[1], step * 0.06);
        } else if (kind === "dots") {
          circle(ctx, x, y, step * 0.13, colors[0]);
        } else if (kind === "lozenge") {
          fill(ctx, [[x, y - step * 0.3], [x + step * 0.2, y], [x, y + step * 0.3], [x - step * 0.2, y]], colors[0]);
          circle(ctx, x, y, step * 0.07, colors[1]);
        } else if (kind === "stripe") {
          line(ctx, [[x - step, y], [x + step, y + step * 0.3]], colors[row % colors.length], step * 0.22);
        } else if (kind === "boteh") {
          const pts2 = smoothClosed([[x, y + step * 0.25], [x - step * 0.2, y], [x - step * 0.05, y - step * 0.2], [x + step * 0.15, y - step * 0.3], [x + step * 0.08, y - step * 0.12], [x + step * 0.2, y + step * 0.08]], 3);
          fill(ctx, pts2, colors[0]);
          circle(ctx, x, y + step * 0.02, step * 0.06, colors[1]);
        }
        next();
      }
    }
  });
}

/** A gold border woven into a garment: a gold strip with a dark running scroll, clipped to the garment. */
function hemBand(ctx, garment, band, s) {
  clipTo(ctx, garment, () => {
    fill(ctx, band, C.gold);
    const b = bbox(band);
    const cy = (b.y0 + b.y1) / 2;
    line(ctx, [[b.x0, b.y0 + 0.35], [b.x1, b.y0 + 0.35]], C.goldLight, 0.3 * s);
    for (let x = b.x0; x < b.x1; x += 1.6 * s) {
      line(ctx, smoothOpen([[x, cy + 0.6 * s], [x + 0.4 * s, cy - 0.6 * s], [x + 0.8 * s, cy + 0.6 * s]], 2), "rgba(110,60,20,0.8)", 0.14 * s);
      circle(ctx, x + 1.2 * s, cy, 0.22 * s, C.vermilion);
    }
    line(ctx, [[b.x0, b.y0], [b.x1, b.y0]], C.goldDark, 0.2 * s);
  });
}

function folds(ctx, lines, color = "rgba(51,32,15,0.45)", w = 0.45) {
  for (const l of lines) swell(ctx, smoothOpen(l, 4), w, color);
}

/**
 * The head, three-quarter, facing `dir` (+1 right). Origin at the front of
 * the neck under the chin; s = 1 is a face about 10.5 units tall. pitch tips
 * the head forward (looking down). Returns where the lips are.
 */
function head(ctx, ox, oy, s, dir, g, pitch = 0) {
  // the mirror by dir below already turns the head round, so the pitch is the
  // same rotation for both facings (positive tips the face down)
  const ca = Math.cos(pitch);
  const sa = Math.sin(pitch);
  const P = (u, v) => {
    // rotate about the neck pivot, a little behind the chin
    const px = u + 0.5;
    const py = v + 1;
    const rx = px * ca - py * sa - 0.5;
    const ry = px * sa + py * ca - 1;
    return [ox + rx * s * dir, oy + ry * s];
  };
  const PP = (pts) => pts.map((p) => P(p[0], p[1]));
  const skin = g.skin;
  // neck
  shape(ctx, PP([[-1.9, -1.5], [1.6, -0.6], [1.9, 3.5], [-2.3, 3.5]]), skin, C.skinLine, 0.22 * s);
  // hair behind (women: a long plait down the back)
  if (g.hair === "long") {
    const plait = [];
    for (let k = 0; k <= 10; k += 1) plait.push([-3.2 - Math.sin(k * 0.4) * 0.4 - k * 0.12, -6 + k * 2.4]);
    taper(ctx, PP(plait), 2.2 * s, 1.0 * s, C.black);
  }
  const face = [[0.6, -10.6], [2.6, -9.6], [3.1, -8.3], [3.3, -7.4], [4.35, -5.3], [4.2, -4.9], [3.4, -4.7], [3.55, -4.1], [3.25, -3.6], [3.5, -3.0], [3.15, -1.8], [2.2, -0.5], [0.6, -0.3], [-1.2, -1.2], [-2.6, -3.4], [-3.3, -6.2], [-3.1, -9.2], [-1.4, -10.9]];
  const fp = PP(smoothClosed(face, 3));
  fill(ctx, fp, skin);
  // modelling: a faint shadow on the far cheek and under the jaw
  clipTo(ctx, fp, () => {
    const c = P(3.4, -5.5);
    const gr = ctx.createRadialGradient(c[0], c[1], 0.2 * s, c[0], c[1], 3.6 * s);
    gr.addColorStop(0, "rgba(140,70,40,0.28)");
    gr.addColorStop(1, "rgba(140,70,40,0)");
    ctx.fillStyle = gr;
    ctx.fillRect(c[0] - 5 * s, c[1] - 5 * s, 10 * s, 10 * s);
    const ch = P(1.2, -4.2);
    const gr2 = ctx.createRadialGradient(ch[0], ch[1], 0.1 * s, ch[0], ch[1], 1.8 * s);
    gr2.addColorStop(0, "rgba(220,120,100,0.28)");
    gr2.addColorStop(1, "rgba(220,120,100,0)");
    ctx.fillStyle = gr2;
    ctx.fillRect(ch[0] - 3 * s, ch[1] - 3 * s, 6 * s, 6 * s);
  });
  line(ctx, fp, C.skinLine, 0.2 * s, true);
  // ear
  shape(ctx, PP(smoothClosed([[-1.0, -6.6], [-0.4, -6.3], [-0.5, -4.8], [-1.0, -4.4], [-1.5, -5.5]], 3)), skin, C.skinLine, 0.16 * s);
  if (g.earring) circle(ctx, ...P(-0.9, -3.9), 0.45 * s, g.earring === "pearl" ? "#f6f2ea" : C.gold, C.ink, 0.1 * s);
  // eyes: the near eye a long almond, the far one a sliver past the nose bridge
  const eye = PP(smoothClosed([[0.35, -6.55], [1.4, -7.15], [2.55, -6.75], [1.5, -6.2]], 4));
  fill(ctx, eye, "#fbf6ec");
  const look = g.look ?? 0.3;
  const low = g.lowered ? 1 : 0;
  clipTo(ctx, eye, () => circle(ctx, ...P(1.55 + look * 0.6, -6.7 + (pitch > 0.15 ? 0.15 : 0) + low * 0.3), 0.55 * s, C.black));
  if (low) {
    // eyes lowered: a heavy lid over the upper half, the lash line drawn low
    clipTo(ctx, eye, () => fill(ctx, PP([[0, -7.6], [3, -7.6], [3, -6.55], [0, -6.45]]), skin));
    line(ctx, PP(smoothOpen([[0.3, -6.5], [1.4, -6.5], [2.6, -6.6]], 2)), C.black, 0.28 * s);
  }
  line(ctx, PP([[0.3, -6.55], [1.4, -7.2], [2.6, -6.75]]), low ? C.skinLine : C.black, (low ? 0.14 : 0.24) * s);
  line(ctx, PP([[0.6, -6.4], [1.5, -6.2], [2.4, -6.6]]), C.skinLine, 0.12 * s);
  const far = PP([[2.95, -6.85], [3.3, -6.95], [3.45, -6.7], [3.2, -6.55]]);
  fill(ctx, far, "#fbf6ec");
  circle(ctx, ...P(3.25, -6.75 + low * 0.12), 0.22 * s, C.black);
  if (low) fill(ctx, PP([[2.9, -7.0], [3.5, -7.05], [3.5, -6.72], [2.9, -6.75]]), skin);
  // brows: tapered black arcs
  taper(ctx, PP(smoothOpen([[0.0, -7.6], [1.3, -8.25], [2.8, -7.95]], 3)), 0.25 * s, 0.4 * s, C.black);
  taper(ctx, PP([[3.05, -8.0], [3.55, -7.9]]), 0.3 * s, 0.15 * s, C.black);
  // nose line, nostril, lips
  line(ctx, PP([[3.1, -7.2], [3.9, -5.6], [3.6, -5.0]]), C.skinLine, 0.15 * s);
  line(ctx, PP([[3.0, -5.1], [3.35, -4.85]]), C.skinLine, 0.14 * s);
  const lips = PP(smoothClosed([[2.5, -3.75], [3.0, -3.95], [3.45, -3.9], [3.3, -3.45], [2.8, -3.35]], 3));
  fill(ctx, lips, g.lip || "#c25a4e");
  line(ctx, PP([[2.5, -3.7], [3.4, -3.68]]), "#6a2a1e", 0.12 * s);
  // beard and moustache
  if (g.beard === "full" || g.beard === "grey" || g.beard === "short") {
    const col = g.beard === "grey" ? "#d8d4cc" : C.black;
    const depth = g.beard === "short" ? 0.6 : g.beard === "grey" ? 2.6 : 1.6;
    const b = PP(smoothClosed([[-2.2, -5.2], [-1.2, -3.0], [0.4, -2.6], [2.0, -2.9], [2.6, -3.2], [3.4, -2.6], [3.2, -1.3 + depth * 0.2], [2.0, 0.2 + depth], [0.2, 0.3 + depth * 0.8], [-1.6, -0.6 + depth * 0.4], [-2.9, -3.3]], 4));
    fill(ctx, b, col);
    clipTo(ctx, b, () => {
      for (let i = 0; i < 9; i += 1) line(ctx, PP([[-2 + i * 0.6, -3], [-1.8 + i * 0.6, 0 + depth * 0.6]]), g.beard === "grey" ? "rgba(120,110,100,0.6)" : "rgba(90,70,60,0.6)", 0.1 * s);
    });
    line(ctx, b, g.beard === "grey" ? "#8a847a" : C.black, 0.12 * s, true);
  }
  if (g.beard && g.beard !== "none") {
    const col = g.beard === "grey" ? "#d8d4cc" : C.black;
    taper(ctx, PP(smoothOpen([[1.6, -4.0], [2.6, -4.35], [3.5, -4.3], [3.8, -3.85]], 3)), 0.6 * s, 0.25 * s, col);
  }
  // headgear
  const hg = g.headgear;
  if (hg === "veil" || hg === "cap") {
    // hair parted under a small cap, then (women) a transparent veil over all
    shape(ctx, PP(smoothClosed([[2.7, -9.4], [1.6, -10.8], [-1.0, -11.4], [-3.2, -10.2], [-3.6, -7.6], [-2.8, -5.4], [-2.2, -6.8], [-1.6, -8.9], [0.6, -9.9]], 3)), C.black, null);
    shape(ctx, PP(smoothClosed([[1.6, -10.6], [0.4, -12.2], [-2.0, -12.0], [-3.2, -10.6], [-0.6, -10.9]], 3)), g.cap || C.vermilion, C.ink, 0.15 * s);
    if (hg === "veil") {
      const v = PP(smoothClosed([[2.3, -10.4], [0.6, -12.6], [-2.6, -12.4], [-4.6, -9.8], [-5.6, -4.0], [-6.4, 2.0], [-5.2, 6.5], [-2.0, 5.5], [-2.4, 0.5], [-3.2, -5.0], [-2.4, -9.3], [0.4, -10.6]], 4));
      fill(ctx, v, g.veilColor || "rgba(250,246,236,0.62)");
      line(ctx, v, C.gold, 0.3 * s, true);
      for (const q of v.filter((_, i) => i % 5 === 0)) circle(ctx, q[0], q[1], 0.18 * s, C.goldLight);
    }
  } else if (hg === "skullcap") {
    shape(ctx, PP(smoothClosed([[2.8, -9.2], [1.8, -11.4], [-1.0, -12.2], [-3.3, -10.8], [-3.6, -8.8], [-0.6, -9.4]], 3)), g.turban || C.white, C.ink, 0.16 * s);
    pattern(ctx, PP([[2.8, -9.2], [1.8, -11.4], [-1.0, -12.2], [-3.3, -10.8], [-3.6, -8.8]]), "dots", [C.vermilion], 0.9 * s, 3);
    shape(ctx, PP([[-2.8, -7.2], [-3.4, -8.6], [-2.6, -8.9], [-2.2, -7.4]]), C.black, null);
  } else {
    // the turban: a flat-topped, forward-slanting wrap with bands of gold
    const t = PP(smoothClosed([[3.2, -8.4], [3.9, -10.2], [3.6, -12.4], [2.4, -14.2], [-0.6, -14.8], [-3.4, -14.0], [-4.4, -12.0], [-4.2, -9.0], [-3.4, -6.6], [-2.4, -7.4], [-1.4, -8.8], [0.9, -9.4]], 3));
    fill(ctx, t, g.turban || C.white);
    clipTo(ctx, t, () => {
      for (let i = -4; i < 8; i += 1) {
        const y0 = -8 - i * 1.1;
        swell(ctx, PP([[-4.6, y0 + 2.4], [-1, y0 + 0.4], [4.2, y0 - 1.2]]), 0.55 * s, i % 3 === 0 ? (g.turbanBand || C.gold) : "rgba(51,32,15,0.28)");
      }
    });
    line(ctx, t, C.ink, 0.18 * s, true);
    // a sidelock curling before the ear
    taper(ctx, PP(smoothOpen([[-1.8, -8.6], [-2.0, -7.2], [-1.6, -6.4], [-1.0, -6.6]], 3)), 0.6 * s, 0.2 * s, C.black);
    if (g.plume) {
      // a jewelled aigrette and a black heron plume
      gilt(ctx, PP(smoothClosed([[1.6, -13.4], [2.2, -14.6], [2.9, -13.6], [2.3, -12.8]], 2)), { w: 0.12 * s });
      circle(ctx, ...P(2.2, -13.6), 0.4 * s, C.vermilion);
      taper(ctx, PP(smoothOpen([[1.9, -14.4], [1.2, -16.4], [-0.6, -17.6], [-2.4, -17.6]], 4)), 0.6 * s, 0.1 * s, C.black);
      for (let i = 0; i < 4; i += 1) circle(ctx, ...P(2.6 - i * 0.2, -14.6 + i * 0.8), 0.3 * s, "#f6f2ea");
    }
  }
  return P(3.35, -3.65);
}

/** A hand at p, back toward `dir`: a little mitten with a thumb. */
function hand(ctx, p, s, dir, skin, rot = 0) {
  const c = Math.cos(rot);
  const sn = Math.sin(rot);
  const Q = (u, v) => [p[0] + (u * c - v * sn) * s * dir, p[1] + (u * sn * dir + v * c) * s];
  const h = smoothClosed([Q(-0.9, -0.8), Q(0.9, -1.0), Q(1.9, -0.4), Q(2.0, 0.4), Q(0.9, 0.9), Q(-0.9, 0.8)], 3);
  shape(ctx, h, skin, C.skinLine, 0.14 * s);
  line(ctx, [Q(1.0, -0.1), Q(1.9, 0.0)], C.skinLine, 0.1 * s);
  shape(ctx, smoothClosed([Q(0.2, -0.8), Q(1.0, -1.6), Q(1.4, -1.3), Q(0.8, -0.6)], 2), skin, C.skinLine, 0.12 * s);
}

/** The astonished hand: a loose fist below the mouth, the index finger up across the lips. */
function lipsHand(ctx, mouth, s0, dir, skin, sleeve, elbow, sleeveCol, cuff) {
  const s = s0 * 1.8;
  const fist = [mouth[0] - 0.3 * s * dir, mouth[1] + 1.75 * s];
  // forearm in its sleeve, from the elbow up to the wrist under the fist
  const wrist = [fist[0] - 0.3 * s * dir, fist[1] + 1.4 * s];
  const fa = [elbow, [lerp(elbow[0], wrist[0], 0.5), lerp(elbow[1], wrist[1], 0.5)], wrist];
  // the sleeve falls back from the raised arm: a bare forearm in skin, so the
  // gesture reads against any robe, with the gold cuff gathered at the elbow
  taper(ctx, fa, 2.3 * s + 0.7, 1.7 * s + 0.7, "#3a1a0a");
  taper(ctx, fa, 2.3 * s, 1.7 * s, skin);
  line(ctx, [[lerp(elbow[0], wrist[0], 0.15), lerp(elbow[1], wrist[1], 0.15)], [lerp(elbow[0], wrist[0], 0.85), lerp(elbow[1], wrist[1], 0.85)]], "rgba(122,63,34,0.35)", 0.12 * s);
  {
    const d = [wrist[0] - elbow[0], wrist[1] - elbow[1]];
    const L = Math.hypot(d[0], d[1]) || 1;
    const n = [(-d[1] / L) * 1.6 * s, (d[0] / L) * 1.6 * s];
    const e = [elbow[0] + (d[0] / L) * 0.8 * s, elbow[1] + (d[1] / L) * 0.8 * s];
    line(ctx, [[e[0] - n[0], e[1] - n[1]], [e[0] + n[0], e[1] + n[1]]], C.goldDark, 0.95 * s);
    line(ctx, [[e[0] - n[0], e[1] - n[1]], [e[0] + n[0], e[1] + n[1]]], cuff || C.gold, 0.65 * s);
  }
  const F = (u, v) => [fist[0] + u * s * dir, fist[1] + v * s];
  shape(ctx, smoothClosed([F(-1.0, -0.4), F(0.2, -1.0), F(1.1, -0.7), F(1.2, 0.6), F(0.2, 1.4), F(-1.0, 0.9)], 3), skin, "#4a220e", 0.16 * s);
  // curled fingers
  for (let i = 0; i < 2; i += 1) line(ctx, [F(0.3, -0.3 + i * 0.6), F(1.1, -0.2 + i * 0.6)], C.skinLine, 0.1 * s);
  // the index finger, laid upright across the lips, its nail touched with henna
  const finger = smoothClosed([F(0.1, -0.8), F(0.2, -3.3), F(0.6, -3.9), F(1.05, -3.4), F(1.1, -0.8)], 3);
  shape(ctx, finger, skin, "#3a1a0a", 0.16 * s);
  ellipse(ctx, ...F(0.62, -3.45), 0.26 * s, 0.34 * s, 0, "#b8553a");
  line(ctx, [F(0.55, -1.2), F(0.6, -2.9)], "rgba(122,63,34,0.35)", 0.08 * s);
  line(ctx, [F(0.45, -3.25), F(0.8, -3.3)], "rgba(255,240,220,0.8)", 0.12 * s);
}

/** A sleeve from shoulder through elbow to wrist, with the hand. */
function arm(ctx, pts, s, col, skin, dir, handRot = 0, cuff = C.gold, noHand = false) {
  const sm = smoothOpen(pts, 4);
  taper(ctx, sm, 4.4 * s + 0.6, 2.4 * s + 0.6, C.ink);
  taper(ctx, sm, 4.4 * s, 2.4 * s, col);
  line(ctx, sm.slice(3, -3), "rgba(51,32,15,0.3)", 0.16 * s);
  const w = pts[pts.length - 1];
  if (cuff) {
    const a = pts[pts.length - 2];
    const d = [w[0] - a[0], w[1] - a[1]];
    const L = Math.hypot(d[0], d[1]) || 1;
    const n = [-d[1] / L, d[0] / L];
    line(ctx, [[w[0] - n[0] * 1.2 * s - (d[0] / L) * 0.6 * s, w[1] - n[1] * 1.2 * s - (d[1] / L) * 0.6 * s], [w[0] + n[0] * 1.2 * s - (d[0] / L) * 0.6 * s, w[1] + n[1] * 1.2 * s - (d[1] / L) * 0.6 * s]], cuff, 0.55 * s);
  }
  if (!noHand) hand(ctx, w, s * 1.3, dir, skin, handRot);
}

// ---- bodies
/**
 * Seated cross-legged (three-quarter, facing dir). Base on the carpet at
 * (x, y); about 64 tall at s = 1. Returns anchor points.
 */
function seatedBody(ctx, g) {
  const { x, y, s, dir } = g;
  const M = mapper(x, y, s, dir);
  const MM = (pts) => pts.map(M);
  const stout = g.stout || 0;
  // the lap and crossed legs under the skirt of the jama
  const lap = MM(smoothClosed([[-17 - stout, 0], [-18 - stout, -5], [-12, -10], [-4, -14], [6, -14], [15 + stout, -10], [20 + stout, -4], [18 + stout, 0.5], [2, 1.5]], 4));
  shape(ctx, lap, g.robe, C.ink, 0.3);
  if (g.robePat) pattern(ctx, lap, g.robePat, g.patCol, 2.6, 7);
  hemBand(ctx, lap, MM([[-30, -2.4], [30, -2.4], [30, 3], [-30, 3]]), s);
  // the trouser cuff and a foot peeping out
  shape(ctx, MM(smoothClosed([[10, -1.5], [16, -2.5], [19, -0.5], [15, 0.8], [10, 0.6]], 3)), g.skin, C.skinLine, 0.2);
  shape(ctx, MM([[7, -2.2], [11, -3], [11, 0.8], [7, 0.8]]), g.trousers || C.vermilion, C.ink, 0.2);
  pattern(ctx, MM([[7, -2.2], [11, -3], [11, 0.8], [7, 0.8]]), "stripe", [C.gold, C.verDark], 1.0, 4);
  folds(ctx, [
    [M([-12, -3]), M([-4, -8]), M([4, -9])],
    [M([-8, -1]), M([2, -4]), M([12, -5])],
    [M([0, -12]), M([6, -8]), M([10, -3])],
  ]);
  // torso
  const torso = MM(smoothClosed([[-7 - stout, -12], [-8 - stout, -26], [-8.5, -38], [-6, -43], [0, -44.5], [5.5, -42.5], [7.5 + stout * 0.6, -34], [8 + stout, -24], [7 + stout, -12]], 4));
  shape(ctx, torso, g.robe, C.ink, 0.3);
  if (g.robePat) pattern(ctx, torso, g.robePat, g.patCol, 2.6, 8);
  // the crossover of the jama at the chest, tied under the arm
  line(ctx, smoothOpen(MM([[1, -43], [3.5, -36], [7, -30]]), 3), C.ink, 0.3);
  line(ctx, smoothOpen(MM([[1.2, -43], [-0.5, -36], [-1, -30]]), 3), "rgba(51,32,15,0.4)", 0.2);
  // sash with its patterned end falling over the lap
  const sash = MM([[-7.5 - stout, -18], [7.5 + stout, -18], [7.5 + stout, -14.5], [-7.5 - stout, -14.5]]);
  shape(ctx, sash, g.sash, C.ink, 0.22);
  pattern(ctx, sash, "lozenge", [C.gold, C.vermilion], 1.6, 9);
  const end = MM([[1, -15], [5, -15], [5.6, -5], [1.8, -5.2]]);
  shape(ctx, end, g.sash, C.ink, 0.2);
  pattern(ctx, end, "stripe", [C.gold, C.vermilion, C.malachite], 0.9, 10);
  folds(ctx, [[M([-6, -26]), M([-4, -20]), M([-6, -15])], [M([5, -40]), M([6, -32]), M([5.5, -24])]]);
  if (g.pearls) {
    for (let i = 0; i < 9; i += 1) circle(ctx, ...M([-2.5 + i * 0.75, -42 + Math.sin((i / 8) * Math.PI) * 4]), 0.45 * s, "#f6f2ea", C.ink, 0.06);
  }
  return {
    neck: M([1.6, -44]),
    shoulderNear: M([-3.5, -41]),
    shoulderFar: M([5.5, -41]),
    lap: M([6, -16]),
    knee: M([15, -8]),
  };
}

/** Standing (three-quarter, facing dir). About 110 tall at s = 1. */
function standingBody(ctx, g) {
  const { x, y, s, dir } = g;
  const M = mapper(x, y, s, dir);
  const MM = (pts) => pts.map(M);
  const hem = g.hem ?? -16;
  // trousers and slippers
  for (const [lx, w] of [[-3.2, 3.2], [1.2, 3.0]]) {
    const leg = MM([[lx, hem - 2], [lx + w, hem - 2], [lx + w - 0.4, -2], [lx + 0.4, -2]]);
    shape(ctx, leg, g.trousers || C.vermilion, C.ink, 0.25);
    pattern(ctx, leg, "stripe", [C.gold, "rgba(0,0,0,0.25)"], 1.1, 11);
    shape(ctx, MM(smoothClosed([[lx - 0.4, 0], [lx, -2.6], [lx + w + 1, -2.4], [lx + w + 3.6, -0.8], [lx + w + 4.6, -1.8], [lx + w + 3.8, 0.2]], 3)), g.shoe || C.vermilion, C.ink, 0.22);
  }
  // the skirt of the jama: flared, with the points of its hem at the sides
  const flare = g.flare ?? 15;
  const skirt = MM(smoothClosed([[-6.5, -62], [6.5, -62], [10, -40], [flare, hem + 2], [flare + 2, hem - 2], [flare - 1, hem - 1.2], [4, hem + 0.6], [-4, hem + 0.6], [-flare + 1, hem - 1.2], [-flare - 1.6, hem - 3], [-flare + 0.4, hem + 2], [-10, -40]], 4));
  if (g.muslin) {
    fill(ctx, skirt, "rgba(248,244,234,0.72)");
    line(ctx, skirt, C.ink, 0.3, true);
  } else {
    shape(ctx, skirt, g.robe, C.ink, 0.3);
    if (g.robePat) pattern(ctx, skirt, g.robePat, g.patCol, 3.0, 12);
  }
  // a gold-woven border round the hem of the jama
  hemBand(ctx, skirt, MM([[-40, hem - 3.2], [40, hem - 3.2], [40, hem + 4], [-40, hem + 4]]), s);
  folds(ctx, [
    [M([-3, -58]), M([-6, -40]), M([-9, hem + 3])],
    [M([0, -58]), M([0.5, -40]), M([1.5, hem + 2])],
    [M([3, -58]), M([6, -40]), M([10, hem + 2])],
    [M([-1.5, -50]), M([-3, -30]), M([-4.5, hem + 2])],
  ], g.muslin ? "rgba(51,32,15,0.3)" : "rgba(51,32,15,0.45)");
  // bodice
  const bodice = MM(smoothClosed([[-6.8, -62], [-8.2, -78], [-7.2, -87], [-2, -90], [3, -89.5], [6.6, -87], [8, -77], [6.8, -62]], 4));
  if (g.muslin) {
    shape(ctx, bodice, "rgba(248,244,234,0.85)", C.ink, 0.3);
  } else {
    shape(ctx, bodice, g.robe, C.ink, 0.3);
    if (g.robePat) pattern(ctx, bodice, g.robePat, g.patCol, 3.0, 13);
  }
  line(ctx, smoothOpen(MM([[0.5, -89.5], [3.5, -80], [7.5, -72]]), 3), C.ink, 0.28);
  // sash and its hanging end with a gold-patterned panel
  const sash = MM([[-7, -66], [7, -66], [7, -61.5], [-7, -61.5]]);
  shape(ctx, sash, g.sash, C.ink, 0.22);
  pattern(ctx, sash, "lozenge", [C.gold, C.vermilion], 1.8, 14);
  const end = MM([[0.5, -62], [5.2, -62], [5.8, -30], [1.0, -30.5]]);
  shape(ctx, end, g.sash, C.ink, 0.22);
  const panel = MM([[0.9, -38], [5.6, -38], [5.8, -30], [1.0, -30.5]]);
  pattern(ctx, panel, "stripe", [C.gold, C.vermilion, C.malachite], 1.0, 15);
  for (let i = 0; i < 6; i += 1) line(ctx, [M([1.2 + i * 0.85, -30.4]), M([1.1 + i * 0.85, -28.6])], C.gold, 0.3);
  if (g.dagger) {
    gilt(ctx, MM([[-3.5, -66.5], [-1.8, -66.5], [-2.0, -59], [-3.2, -59]]), { w: 0.15 });
  }
  if (g.coat) {
    // an open over-coat, sleeveless, with a gold border
    const coat = MM(smoothClosed([[-7.6, -88], [-1.5, -89.5], [-2.5, -70], [-4, -40], [-6, hem + 6], [-13, hem + 4], [-11, -45], [-9, -70]], 3));
    shape(ctx, coat, g.coat, C.ink, 0.28);
    pattern(ctx, coat, "boteh", [C.gold, C.vermilion], 3.2, 16);
    line(ctx, smoothOpen(MM([[-1.5, -89.5], [-2.5, -70], [-4, -40], [-6, hem + 6]]), 3), C.gold, 0.7);
  }
  if (g.pearls) {
    for (let i = 0; i < 11; i += 1) circle(ctx, ...M([-3 + i * 0.75, -88 + Math.sin((i / 10) * Math.PI) * 5]), 0.45, "#f6f2ea", C.ink, 0.06);
  }
  return {
    neck: M([1.4, -89.8]),
    shoulderNear: M([-4.6, -86]),
    shoulderFar: M([5, -86]),
    waist: M([6, -64]),
    elbowNear: M([-6, -70]),
  };
}

/** A woman standing: a long skirt and a short bodice, a veil. About 104 tall at s = 1. */
function womanBody(ctx, g) {
  const { x, y, s, dir } = g;
  const M = mapper(x, y, s, dir);
  const MM = (pts) => pts.map(M);
  shape(ctx, MM(smoothClosed([[2, 0], [3, -2.2], [7.5, -1.6], [8.5, 0]], 3)), C.vermilion, C.ink, 0.2);
  const skirt = MM(smoothClosed([[-6.5, -60], [6.5, -60], [11, -30], [15, -4], [16.5, 0], [-15.5, 0], [-14.5, -4], [-11, -30]], 4));
  shape(ctx, skirt, g.robe, C.ink, 0.3);
  pattern(ctx, skirt, g.robePat || "sprig", g.patCol || [C.gold, C.malachite], 3.0, 21);
  // a gold border at the hem
  clipTo(ctx, skirt, () => fill(ctx, MM([[-18, -3.2], [18, -3.2], [18, 1], [-18, 1]]), C.gold));
  folds(ctx, [[M([-3, -56]), M([-7, -30]), M([-11, -2])], [M([1, -56]), M([2, -30]), M([3, -2])], [M([4, -56]), M([8, -30]), M([12, -2])]]);
  const bodice = MM(smoothClosed([[-6.5, -60], [-7.6, -76], [-6.6, -84.5], [-1.8, -87], [3, -86.5], [6.2, -84], [7.8, -74], [6.5, -60]], 4));
  shape(ctx, bodice, g.bodice || C.orpiment, C.ink, 0.3);
  pattern(ctx, bodice, "dots", [C.vermilion], 1.6, 22);
  // a transparent wrap over the shoulder
  const wrap = MM(smoothClosed([[-6.5, -84], [3, -86], [8, -70], [10, -50], [6, -46], [3, -66], [-5, -74]], 3));
  fill(ctx, wrap, "rgba(250,246,236,0.5)");
  line(ctx, wrap, C.gold, 0.35, true);
  for (let i = 0; i < 9; i += 1) circle(ctx, ...M([-2.6 + i * 0.65, -85 + Math.sin((i / 8) * Math.PI) * 4]), 0.42, "#f6f2ea", C.ink, 0.06);
  return {
    neck: M([1.2, -86.8]),
    shoulderNear: M([-4.4, -83]),
    shoulderFar: M([5, -83]),
    waist: M([6, -62]),
  };
}

/** A gardener in a short tunic, legs bare from the knee. About 106 tall at s = 1. */
function gardenerBody(ctx, g) {
  const { x, y, s, dir } = g;
  const M = mapper(x, y, s, dir);
  const MM = (pts) => pts.map(M);
  for (const [lx, w] of [[-3.5, 3.3], [1.3, 3.1]]) {
    shape(ctx, MM([[lx, -30], [lx + w, -30], [lx + w - 0.6, -2], [lx + 0.6, -2]]), g.skin, C.skinLine, 0.25);
    shape(ctx, MM(smoothClosed([[lx - 0.2, 0], [lx + 0.2, -2.2], [lx + w + 1, -2.0], [lx + w + 3.2, -0.6], [lx + w + 2.6, 0.3]], 3)), "#6a4a2a", C.ink, 0.2);
  }
  // short drawers
  shape(ctx, MM([[-4, -40], [5, -40], [5, -30], [-4, -30]]), C.white, C.ink, 0.25);
  const tunic = MM(smoothClosed([[-6.8, -84], [-1.6, -86.5], [3.4, -86], [7.2, -82], [8.2, -62], [11, -36], [-10, -36], [-8, -62]], 4));
  shape(ctx, tunic, g.robe, C.ink, 0.3);
  pattern(ctx, tunic, "dots", ["rgba(255,255,255,0.5)"], 2.4, 31);
  folds(ctx, [[M([-2, -80]), M([-4, -55]), M([-7, -37])], [M([3, -80]), M([5, -55]), M([7, -37])]]);
  const sash = MM([[-8.2, -62], [8.4, -62], [8.6, -58], [-8.4, -58]]);
  shape(ctx, sash, g.sash, C.ink, 0.22);
  return {
    neck: M([1.2, -86.4]),
    shoulderNear: M([-4.2, -82]),
    shoulderFar: M([5, -82]),
    waist: M([6, -60]),
  };
}

/** A bust leaning over a balcony rail: shoulders, arms on the rail. */
function bustBody(ctx, g) {
  const { x, y, s, dir } = g;
  const M = mapper(x, y, s, dir);
  const MM = (pts) => pts.map(M);
  const torso = MM(smoothClosed([[-8.5, 2], [-8.6, -12], [-7, -21], [-1.6, -24], [3.4, -23.4], [7.4, -19], [9, -8], [9, 2]], 4));
  shape(ctx, torso, g.robe, C.ink, 0.3);
  if (g.robePat) pattern(ctx, torso, g.robePat, g.patCol, 2.6, 41);
  line(ctx, smoothOpen(MM([[1, -23.5], [3.5, -15], [7.5, -8]]), 3), C.ink, 0.28);
  if (g.pearls) for (let i = 0; i < 9; i += 1) circle(ctx, ...M([-2.4 + i * 0.7, -22 + Math.sin((i / 8) * Math.PI) * 4]), 0.42, "#f6f2ea", C.ink, 0.06);
  return {
    neck: M([1.2, -23.8]),
    shoulderNear: M([-5, -20]),
    shoulderFar: M([5.5, -20]),
  };
}

// ---- instruments and props
function lute(ctx, x, y, s, dir, ang) {
  // a long-necked lute: a gourd body, a slender neck with frets and pegs
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  const Q = (u, v) => [x + (u * c - v * sn) * s * dir, y + (u * sn + v * c) * s];
  const body = smoothClosed([Q(-1, 0), Q(1, -5), Q(5, -6.4), Q(9, -5), Q(10.5, 0), Q(9, 5), Q(5, 6.4), Q(1, 5)], 4);
  shape(ctx, body, "#8a4a22", C.ink, 0.25 * s);
  clipTo(ctx, body, () => {
    for (let i = -3; i <= 3; i += 1) line(ctx, [Q(0, i * 1.8), Q(11, i * 1.8)], "rgba(240,200,120,0.45)", 0.3 * s);
  });
  ellipse(ctx, ...Q(5.5, 0), 1.4 * s, 1.4 * s, 0, "#3a2010", C.gold, 0.2 * s);
  const neck = [Q(10, -1.0), Q(40, -0.8), Q(40, 0.8), Q(10, 1.0)];
  shape(ctx, neck, "#6a3818", C.ink, 0.2 * s);
  for (let i = 0; i < 12; i += 1) line(ctx, [Q(13 + i * 2.2, -0.9), Q(13 + i * 2.2, 0.9)], C.goldLight, 0.18 * s);
  for (let i = 0; i < 4; i += 1) {
    line(ctx, [Q(34 + i * 1.6, -0.9), Q(34 + i * 1.6, -2.6)], C.ink, 0.35 * s);
    circle(ctx, ...Q(34 + i * 1.6, -2.8), 0.5 * s, C.white, C.ink, 0.1 * s);
  }
  gilt(ctx, [Q(40, -1.2), Q(43, -1.6), Q(43, 1.6), Q(40, 1.2)], { w: 0.15 * s });
  line(ctx, [Q(2, -0.3), Q(41, -0.2)], "rgba(255,250,230,0.85)", 0.08 * s);
  line(ctx, [Q(2, 0.3), Q(41, 0.2)], "rgba(255,250,230,0.85)", 0.08 * s);
  return { fret: Q(28, 0), body: Q(4, 2) };
}
function drums(ctx, x, y, s, dir) {
  // a pair of small drums: a wooden treble, a copper bass, laced with thongs
  const drum = (cx, w, h, col, head) => {
    const pts = smoothClosed([[cx - w * 0.4, y], [cx - w * 0.52, y - h * 0.5], [cx - w * 0.5, y - h], [cx + w * 0.5, y - h], [cx + w * 0.52, y - h * 0.5], [cx + w * 0.4, y]], 3);
    shape(ctx, pts, col, C.ink, 0.25);
    clipTo(ctx, pts, () => {
      for (let i = -4; i <= 4; i += 1) line(ctx, [[cx + i * w * 0.12, y - h], [cx + i * w * 0.1, y]], "rgba(240,225,190,0.7)", 0.25);
    });
    ellipse(ctx, cx, y - h, w * 0.5, w * 0.16, 0, head, C.ink, 0.22);
    ellipse(ctx, cx, y - h, w * 0.18, w * 0.06, 0, C.black);
  };
  drum(x, 7 * s, 8 * s, "#7a3c1c", "#efe2c4");
  drum(x + 8.5 * s * dir, 8.5 * s, 7 * s, "#b0682e", "#efe2c4");
  return { a: [x, y - 8 * s], b: [x + 8.5 * s * dir, y - 7 * s] };
}
function book(ctx, p, s, dir) {
  const Q = (u, v) => [p[0] + u * s * dir, p[1] + v * s];
  shape(ctx, [Q(-3, -1.5), Q(3, -2.4), Q(3.4, 1.6), Q(-2.6, 2.4)], C.vermilion, C.ink, 0.2);
  shape(ctx, [Q(-2.4, -1.3), Q(2.7, -2.0), Q(3.0, 1.2), Q(-2.1, 1.9)], C.white, C.ink, 0.12);
  for (let i = 0; i < 4; i += 1) line(ctx, [Q(-1.8, -0.6 + i * 0.6), Q(2.4, -1.2 + i * 0.6)], "rgba(30,20,10,0.6)", 0.12);
  line(ctx, [Q(0.2, -1.6), Q(0.4, 2.1)], C.gold, 0.25);
}
function cup(ctx, p, s) {
  const pts = [[p[0] - 1.6 * s, p[1] - 1.6 * s], [p[0] + 1.6 * s, p[1] - 1.6 * s], [p[0] + 1.0 * s, p[1] + 0.4 * s], [p[0] - 1.0 * s, p[1] + 0.4 * s]];
  gilt(ctx, pts, { w: 0.15 });
  ellipse(ctx, p[0], p[1] - 1.6 * s, 1.6 * s, 0.4 * s, 0, "#7a1f2a", C.goldDark, 0.1);
}
function whisk(ctx, p, s, dir) {
  // a fly-whisk: gold handle and a plume of white yak hair
  line(ctx, [p, [p[0] + 2 * s * dir, p[1] - 9 * s]], C.goldDark, 0.9 * s);
  line(ctx, [p, [p[0] + 2 * s * dir, p[1] - 9 * s]], C.gold, 0.6 * s);
  const top = [p[0] + 2 * s * dir, p[1] - 9 * s];
  for (let i = 0; i < 9; i += 1) {
    const a = -Math.PI / 2 - 0.6 * dir + (i - 4) * 0.09;
    const q = [top[0] + Math.cos(a) * 14 * s, top[1] + Math.sin(a) * 14 * s];
    swell(ctx, smoothOpen([top, [lerp(top[0], q[0], 0.5) + 1.5 * dir, lerp(top[1], q[1], 0.5)], q], 3), 0.9 * s, "#f6f2ea");
  }
  line(ctx, [top, [top[0] - 10 * s * dir, top[1] - 8 * s]], "rgba(51,32,15,0.3)", 0.12);
}
function spade(ctx, base, top, s) {
  line(ctx, [base, top], "#5a3a1a", 1.0 * s);
  const d = [top[0] - base[0], top[1] - base[1]];
  const L = Math.hypot(d[0], d[1]);
  const u = [d[0] / L, d[1] / L];
  const n = [-u[1], u[0]];
  const b = base;
  shape(ctx, [[b[0] + n[0] * 2.4 * s, b[1] + n[1] * 2.4 * s], [b[0] - n[0] * 2.4 * s, b[1] - n[1] * 2.4 * s], [b[0] - u[0] * 6 * s, b[1] - u[1] * 6 * s]], "#8d8f93", C.ink, 0.2);
}

/** Paint one guest in one state (0 at ease, 1 astonished). */
function paintGuest(ctx, g, state) {
  const st = state ? g.b : g.a;
  const hdir = st.head ?? g.dir;
  const s = g.s;
  const sleeve = g.muslin ? "#efe9dc" : g.sleeve || g.robe;
  const skin = g.skin;
  const bodyFn = { seated: seatedBody, standing: standingBody, woman: womanBody, gardener: gardenerBody, bust: bustBody }[g.kind];
  // props behind the body
  if (g.prop === "lute" && st.lute) {
    // the lute lies across the lap, its neck rising toward the facing side
  }
  // the body (a state may lean the figure: dx toward its facing side, dy down)
  const G = st.dx || st.dy ? { ...g, x: g.x + (st.dx || 0) * g.dir, y: g.y + (st.dy || 0) } : g;
  const A = bodyFn(ctx, G);
  // the far arm (behind the near one, in front of the torso: we see the figure from the near side)
  const farPts = st.far ? st.far(A) : null;
  if (farPts) arm(ctx, farPts, s, sleeve, skin, g.dir, st.farRot || 0, g.cuff ?? C.gold, st.farNoHand);
  if (st.prop) st.prop(ctx, A, s, g);
  // the head
  const headS = s * (g.headS || 1);
  const mouth = head(ctx, A.neck[0], A.neck[1], headS, hdir, { ...g, look: st.look, lowered: st.lowered }, st.pitch || 0);
  // the near arm
  if (state && !g.noLips) {
    const sh = st.lipsFrom === "far" ? A.shoulderFar : A.shoulderNear;
    // the elbow lifted out in front of the chest, so the raised arm changes the
    // figure's silhouette and the gesture reads even at contact-sheet scale
    const elbow = st.elbow ? st.elbow(A, mouth) : [mouth[0] + 7 * s * hdir, mouth[1] + 11 * s];
    // upper arm from the shoulder to the elbow
    const ua = smoothOpen([sh, [lerp(sh[0], elbow[0], 0.5) - 0.8 * s * g.dir, lerp(sh[1], elbow[1], 0.5)], elbow], 3);
    taper(ctx, ua, 4.6 * s + 0.6, 3.8 * s + 0.6, C.ink);
    taper(ctx, ua, 4.6 * s, 3.8 * s, sleeve);
    line(ctx, smoothOpen([sh, elbow], 2), "rgba(51,32,15,0.35)", 0.16 * s);
    lipsHand(ctx, mouth, headS, hdir, skin, sleeve, elbow, sleeve, g.cuff ?? C.gold);
  } else if (st.near) {
    arm(ctx, st.near(A, mouth), s, sleeve, skin, g.dir, st.nearRot || 0, g.cuff ?? C.gold, st.nearNoHand);
  }
  if (st.front) st.front(ctx, A, s, g, mouth);
}

// The cast. Positions and dress are each their own; nobody here is a portrait.
const GUESTS = [
  // --- the party on the carpet
  {
    id: "companion-a", kind: "seated", x: 146, y: 614, s: 0.98, dir: 1,
    skin: SKIN[3], robe: C.mauve, robePat: "dots", patCol: [C.goldLight], sash: C.orpiment, trousers: C.malachite,
    turban: C.orpiment, turbanBand: C.vermilion, beard: "mous", earring: "pearl",
    a: { // talking, an open hand toward the host
      near: (A) => [A.shoulderNear, [A.shoulderNear[0] + 3, A.shoulderNear[1] + 13], [A.shoulderNear[0] + 12, A.shoulderNear[1] + 9]], nearRot: -0.5,
      far: (A) => [A.shoulderFar, [A.shoulderFar[0] + 4, A.shoulderFar[1] + 14], [A.lap[0] + 1, A.lap[1] - 1]],
    },
    b: {
      far: (A) => [A.shoulderFar, [A.shoulderFar[0] + 4, A.shoulderFar[1] + 14], [A.lap[0] + 1, A.lap[1] - 1]],
      pitch: -0.1, look: 0.7,
    },
  },
  {
    id: "noble", kind: "seated", x: 206, y: 600, s: 1.06, dir: 1, stout: 2,
    skin: SKIN[1], robe: "#f6f1e4", robePat: "sprig", patCol: [C.gold, "#5fa37a"], sash: C.vermilion, trousers: C.vermilion,
    turban: "#f2e6c8", turbanBand: C.gold, plume: true, beard: "full", pearls: true, earring: "pearl",
    a: { // a wine cup held up, the other hand on the knee
      near: (A) => [A.shoulderNear, [A.shoulderNear[0] + 1, A.shoulderNear[1] + 14], [A.shoulderNear[0] + 11, A.shoulderNear[1] + 8]], nearRot: -0.9,
      prop: () => {},
      front: (ctx, A, s) => cup(ctx, [A.shoulderNear[0] + 12.2 * s, A.shoulderNear[1] + 6.4 * s], s),
      far: (A) => [A.shoulderFar, [A.shoulderFar[0] + 5, A.shoulderFar[1] + 13], [A.knee[0] - 2, A.knee[1] - 4]],
      head: -1, look: 0.2, // turned to his companion on the left
    },
    b: {
      far: (A) => [A.shoulderFar, [A.shoulderFar[0] + 6, A.shoulderFar[1] + 10], [A.shoulderFar[0] + 13, A.shoulderFar[1] + 6]], farRot: -0.9,
      prop: (ctx, A, s) => cup(ctx, [A.shoulderFar[0] + 14.2 * s, A.shoulderFar[1] + 4.4 * s], s),
      look: 0.6, pitch: -0.08,
    },
  },
  {
    id: "companion-b", kind: "seated", x: 272, y: 596, s: 0.96, dir: -1,
    skin: SKIN[4], robe: C.malachite, robePat: "boteh", patCol: [C.gold, C.vermilion], sash: C.white, trousers: C.orpiment,
    turban: C.vermilion, turbanBand: C.white, beard: "grey",
    a: { // reading from a small book held in both hands
      near: (A) => [A.shoulderNear, [A.shoulderNear[0] - 1, A.shoulderNear[1] + 14], [A.lap[0] + 2 * -1, A.lap[1] - 9]], nearRot: -0.3,
      far: (A) => [A.shoulderFar, [A.shoulderFar[0] - 2, A.shoulderFar[1] + 14], [A.lap[0] - 3, A.lap[1] - 10]],
      front: (ctx, A, s) => book(ctx, [A.lap[0] - 1, A.lap[1] - 12], s, -1),
      pitch: 0.2, look: 0.1,
    },
    b: { // head turned the other way, toward the walk; the book lowered
      head: 1,
      far: (A) => [A.shoulderFar, [A.shoulderFar[0] - 2, A.shoulderFar[1] + 14], [A.lap[0] - 3, A.lap[1] - 4]],
      front: (ctx, A, s) => book(ctx, [A.lap[0] - 3, A.lap[1] - 4], s, -1),
      look: 0.7,
    },
  },
  {
    id: "lute", kind: "seated", x: 258, y: 650, s: 1.0, dir: 1,
    skin: SKIN[2], robe: C.vermilion, robePat: "lozenge", patCol: [C.gold, C.white], sash: C.lapis, trousers: C.white,
    turban: C.white, turbanBand: C.lapis, beard: "short",
    a: { // playing: the lute across the body, left hand at the frets, right hand plucking
      far: (A) => [A.shoulderFar, [A.shoulderFar[0] + 6, A.shoulderFar[1] + 8], [A.shoulderFar[0] + 14, A.shoulderFar[1] - 2]], farRot: -1.2,
      prop: (ctx, A, s) => lute(ctx, A.lap[0] - 6, A.lap[1] - 2, s * 0.95, 1, -0.6),
      near: (A) => [A.shoulderNear, [A.shoulderNear[0] - 1, A.shoulderNear[1] + 12], [A.lap[0] - 4, A.lap[1] - 4]], nearRot: 0.3,
      pitch: 0.25, look: 0.1,
    },
    b: { // the music stops: the lute let down flat on the carpet before him
      far: (A) => [A.shoulderFar, [A.shoulderFar[0] + 4, A.shoulderFar[1] + 12], [A.lap[0] + 2, A.lap[1] + 1]],
      front: (ctx, A, s) => lute(ctx, A.lap[0] - 12, A.lap[1] + 15.5, s * 0.95, 1, 0.03),
      look: 0.7, pitch: -0.1,
    },
  },
  {
    id: "drummer", kind: "seated", x: 178, y: 652, s: 0.94, dir: -1,
    skin: SKIN[5], robe: C.orpiment, robePat: "sprig", patCol: [C.vermilion, C.malachite], sash: C.vermilion, trousers: C.lapis,
    turban: C.malachite, turbanBand: C.gold, beard: "mous",
    a: { // both hands on the drums
      prop: (ctx, A, s) => drums(ctx, A.knee[0] - 2 * -1, A.knee[1] + 8 * s, s, -1),
      far: (A) => [A.shoulderFar, [A.shoulderFar[0] - 3, A.shoulderFar[1] + 14], [A.knee[0] - 9 * -1 * -1, A.knee[1] - 6]], farRot: 0.6,
      near: (A) => [A.shoulderNear, [A.shoulderNear[0] - 4, A.shoulderNear[1] + 13], [A.knee[0] + 2, A.knee[1] - 7]], nearRot: 0.6,
      pitch: 0.2, look: 0.1,
    },
    b: { // turned toward the walk, one palm raised away from the drums
      head: 1,
      prop: (ctx, A, s) => drums(ctx, A.knee[0] - 2 * -1, A.knee[1] + 8 * s, s, -1),
      far: (A) => [A.shoulderFar, [A.shoulderFar[0] - 5, A.shoulderFar[1] + 10], [A.shoulderFar[0] - 10, A.shoulderFar[1] + 4]], farRot: -1.4,
      look: 0.7,
    },
  },
  {
    id: "cupbearer", kind: "standing", x: 352, y: 628, s: 0.9, dir: -1,
    skin: SKIN[0], robe: C.lapis, robePat: "dots", patCol: [C.goldLight], sash: C.vermilion, trousers: C.vermilion, flare: 13,
    turban: C.orpiment, turbanBand: C.vermilion, beard: "none",
    a: { // pouring from a flask into a cup
      far: (A) => [A.shoulderFar, [A.shoulderFar[0] - 6, A.shoulderFar[1] + 16], [A.shoulderFar[0] - 16, A.shoulderFar[1] + 22]], farRot: 0.2,
      near: (A) => [A.shoulderNear, [A.shoulderNear[0] - 3, A.shoulderNear[1] + 16], [A.shoulderNear[0] - 12, A.shoulderNear[1] + 12]], nearRot: -0.8,
      front: (ctx, A, s) => {
        flask(ctx, A.shoulderNear[0] - 13 * s, A.shoulderNear[1] + 13 * s, 12 * s, "gold");
        cup(ctx, [A.shoulderFar[0] - 17 * s, A.shoulderFar[1] + 21 * s], s);
      },
      pitch: 0.3,
    },
    b: { // head turned to the walk, the flask held still at his side
      head: 1,
      far: (A) => [A.shoulderFar, [A.shoulderFar[0] - 3, A.shoulderFar[1] + 18], [A.shoulderFar[0] - 5, A.shoulderFar[1] + 34]], farRot: 1.4,
      prop: (ctx, A, s) => flask(ctx, A.shoulderFar[0] - 5 * s, A.shoulderFar[1] + 46 * s, 12 * s, "gold"),
      look: 0.8, pitch: 0.12,
    },
  },
  // --- the gardener behind the cypress
  {
    id: "gardener", kind: "gardener", x: 485, y: 660, s: 0.88, dir: 1,
    skin: SKIN[4], robe: "#6a8a5a", sash: C.white, headgear: "skullcap", turban: C.white, beard: "short",
    a: { // leaning on the spade, looking down at the beds
      near: (A) => [A.shoulderNear, [A.shoulderNear[0] + 3, A.shoulderNear[1] + 16], [A.shoulderNear[0] + 10, A.shoulderNear[1] + 20]],
      front: (ctx, A, s) => spade(ctx, [A.shoulderNear[0] + 16 * s, A.shoulderNear[1] + 76 * s], [A.shoulderNear[0] + 9 * s, A.shoulderNear[1] + 14 * s], s),
      pitch: 0.35,
    },
    b: { // straightened up, the spade let go to lean on his shoulder
      prop: (ctx, A, s) => spade(ctx, [A.shoulderFar[0] + 14 * s, A.shoulderFar[1] + 78 * s], [A.shoulderFar[0] + 3 * s, A.shoulderFar[1] - 4 * s], s),
      far: (A) => [A.shoulderFar, [A.shoulderFar[0] + 3, A.shoulderFar[1] + 15], [A.shoulderFar[0] + 6, A.shoulderFar[1] + 26]],
      pitch: -0.05, look: 0.7,
    },
  },
  // --- standing in the arches of the pavilion
  {
    id: "lady", kind: "woman", x: 606, y: 646, s: 0.74, dir: -1,
    skin: SKIN[3], robe: C.rose, robePat: "sprig", patCol: [C.gold, C.malachite], bodice: C.orpiment, headgear: "veil", hair: "long", cap: C.vermilion, lip: "#b8423a", earring: "gold",
    a: { // a flower held at her breast, looking down at the water
      near: (A, m) => [A.shoulderNear, [A.shoulderNear[0] + 1, A.shoulderNear[1] + 16], [A.shoulderNear[0] - 7, A.shoulderNear[1] + 12]], nearRot: -0.6,
      front: (ctx, A, s) => {
        const h = [A.shoulderNear[0] - 7.5, A.shoulderNear[1] + 11];
        line(ctx, [h, [h[0] - 1.5, h[1] - 5]], "#2f6a3a", 0.25);
        leaf(ctx, h[0] - 0.8, h[1] - 2.6, 2.2, -2.6, 0.35, C.malachite);
        blossom(ctx, h[0] - 1.6, h[1] - 5.4, 1.1, C.vermilion);
      },
      far: (A) => [A.shoulderFar, [A.shoulderFar[0] - 1, A.shoulderFar[1] + 16], [A.shoulderFar[0] - 2, A.shoulderFar[1] + 30]],
      pitch: 0.15,
    },
    b: {
      far: (A) => [A.shoulderFar, [A.shoulderFar[0] - 1, A.shoulderFar[1] + 16], [A.shoulderFar[0] - 2, A.shoulderFar[1] + 30]],
      front: (ctx, A, s) => {
        line(ctx, [[A.shoulderFar[0] - 2, A.shoulderFar[1] + 30], [A.shoulderFar[0] - 1, A.shoulderFar[1] + 35]], "#2f6a3a", 0.25);
        blossom(ctx, A.shoulderFar[0] - 1, A.shoulderFar[1] + 35.5, 1.0, C.vermilion);
      },
      pitch: -0.05, look: 0.7,
    },
  },
  {
    id: "scholar", kind: "standing", x: 724, y: 646, s: 0.76, dir: 1, coat: C.malDark,
    skin: SKIN[1], robe: "#f6f1e4", muslin: true, sleeve: "#ece6d8", sash: C.orpiment, trousers: C.vermilion, flare: 12,
    turban: C.white, turbanBand: C.malachite, beard: "grey",
    a: { // reading a book held open
      near: (A) => [A.shoulderNear, [A.shoulderNear[0] + 1, A.shoulderNear[1] + 15], [A.shoulderNear[0] + 10, A.shoulderNear[1] + 14]], nearRot: -0.4,
      far: (A) => [A.shoulderFar, [A.shoulderFar[0] + 2, A.shoulderFar[1] + 14], [A.shoulderFar[0] + 6, A.shoulderFar[1] + 14]], farRot: -0.4,
      front: (ctx, A, s) => book(ctx, [A.shoulderNear[0] + 11 * s, A.shoulderNear[1] + 10.5 * s], s, 1),
      pitch: 0.3,
    },
    b: { // turned back to the walk, the book lowered
      head: -1,
      far: (A) => [A.shoulderFar, [A.shoulderFar[0] + 1, A.shoulderFar[1] + 17], [A.shoulderFar[0] + 4, A.shoulderFar[1] + 26]],
      front: (ctx, A, s) => book(ctx, [A.shoulderFar[0] + 5 * s, A.shoulderFar[1] + 27 * s], s, 1),
      pitch: 0.2, look: 0.7,
    },
  },
  {
    id: "attendant", kind: "standing", x: 842, y: 646, s: 0.74, dir: -1,
    skin: SKIN[2], robe: C.orpiment, robePat: "lozenge", patCol: [C.vermilion, C.malachite], sash: C.malachite, trousers: C.lapis, flare: 14, dagger: true,
    turban: C.vermilion, turbanBand: C.gold, beard: "full",
    a: { // a fly-whisk held up
      near: (A) => [A.shoulderNear, [A.shoulderNear[0] - 2, A.shoulderNear[1] + 15], [A.shoulderNear[0] - 7, A.shoulderNear[1] + 9]], nearRot: -1.2,
      front: (ctx, A, s) => whisk(ctx, [A.shoulderNear[0] - 7 * s, A.shoulderNear[1] + 11 * s], s, -1),
      far: (A) => [A.shoulderFar, [A.shoulderFar[0] - 1, A.shoulderFar[1] + 16], [A.waist[0] + 1, A.waist[1] + 2]],
      head: 1, look: 0.2, // looking back at the scholar
    },
    b: {
      prop: (ctx, A, s) => whisk(ctx, [A.shoulderFar[0] - 3 * s, A.shoulderFar[1] + 30 * s], s * 0.9, -1),
      far: (A) => [A.shoulderFar, [A.shoulderFar[0] - 2, A.shoulderFar[1] + 16], [A.shoulderFar[0] - 3, A.shoulderFar[1] + 29]],
      pitch: 0, look: 0.7,
    },
  },
  // --- leaning over the balcony rail
  {
    id: "balcony-1", kind: "bust", x: 662, y: 541, s: 1.05, dir: 1,
    skin: SKIN[5], robe: C.lapis, robePat: "dots", patCol: [C.gold], turban: C.white, turbanBand: C.vermilion, beard: "full", pearls: true,
    a: { // talking to his neighbour
      near: (A) => [A.shoulderNear, [A.shoulderNear[0] + 2, A.shoulderNear[1] + 10], [A.shoulderNear[0] + 12, A.shoulderNear[1] + 8]],
      look: 0.4, pitch: -0.04,
    },
    // astonished: chin over the rail, eyes lowered to the channel below
    b: { head: 1, pitch: 0.62, look: 0.5, lowered: true, dx: 2.5, dy: 5 },
  },
  {
    id: "balcony-2", kind: "bust", x: 724, y: 540, s: 1.0, dir: -1,
    skin: SKIN[3], robe: C.rose, robePat: "sprig", patCol: [C.gold, C.malachite], headgear: "veil", hair: "long", cap: C.lapis, earring: "pearl", lip: "#b8423a",
    a: { // feeding a parakeet on her wrist
      near: (A) => [A.shoulderNear, [A.shoulderNear[0] - 2, A.shoulderNear[1] + 10], [A.shoulderNear[0] - 10, A.shoulderNear[1] + 4]], nearRot: -0.8,
      front: (ctx, A, s) => parakeet(ctx, A.shoulderNear[0] - 11 * s, A.shoulderNear[1] + 1.5 * s, s),
      pitch: 0.2, look: 0.2,
    },
    b: {
      head: 1, pitch: 0.62, look: 0.5, lowered: true, dx: -2.5, dy: 5,
      front: (ctx, A, s) => parakeet(ctx, A.shoulderFar[0] + 2 * s, A.shoulderFar[1] + 7 * s, s),
    },
  },
  {
    id: "balcony-3", kind: "bust", x: 788, y: 541, s: 1.05, dir: -1,
    skin: SKIN[0], robe: C.vermilion, robePat: "lozenge", patCol: [C.gold, C.white], turban: C.orpiment, turbanBand: C.malachite, beard: "mous",
    a: { // pointing out the view to the others
      near: (A) => [A.shoulderNear, [A.shoulderNear[0] - 5, A.shoulderNear[1] + 6], [A.shoulderNear[0] - 15, A.shoulderNear[1] + 1]], nearRot: -0.2,
      look: 0.3, pitch: -0.04,
    },
    b: { head: -1, pitch: 0.62, look: 0.5, lowered: true, dx: 2.5, dy: 5 },
  },
];

function parakeet(ctx, x, y, s) {
  const P = (u, v) => [x + u * s, y + v * s];
  shape(ctx, smoothClosed([P(-1.5, 0), P(-0.8, -2.6), P(0.6, -3.4), P(1.4, -2.4), P(1.0, 0.6), P(-0.6, 2.0)], 3), "#4caa5a", C.ink, 0.15);
  taper(ctx, [P(-0.4, 1.4), P(-2.0, 6.0)], 1.0 * s, 0.2 * s, "#3a8a4a");
  shape(ctx, [P(1.2, -2.8), P(2.2, -2.2), P(1.2, -1.8)], C.vermilion, C.ink, 0.1);
  circle(ctx, ...P(0.7, -2.6), 0.25 * s, C.black);
}

function peacock(ctx, x, y, s) {
  // a peacock in profile, facing right, its train lying along the lawn behind it
  const P = (u, v) => [x + u * s, y + v * s];
  // the train: long coverts fanning back, each with an eye
  const train = smoothClosed([P(-4, -8), P(-14, -9), P(-30, -6), P(-42, -2), P(-44, 1), P(-30, 1.5), P(-14, 0.5), P(-3, -2)], 4);
  shape(ctx, train, "#2f6a3c", C.ink, 0.22);
  clipTo(ctx, train, () => {
    for (let i = 0; i < 14; i += 1) {
      const t = i / 13;
      const ex = lerp(-10, -42, t);
      const ey = lerp(-6.5, -0.5, t) + (i % 2 ? 1.6 : -0.6);
      line(ctx, [P(-4, -4), [x + ex * s, y + ey * s]], "rgba(190,200,120,0.45)", 0.15);
      ellipse(ctx, x + ex * s, y + ey * s, 1.5 * s, 1.1 * s, 0, "#d9b24a");
      ellipse(ctx, x + ex * s, y + ey * s, 1.0 * s, 0.75 * s, 0, "#2f8a78");
      ellipse(ctx, x + ex * s, y + ey * s, 0.5 * s, 0.4 * s, 0, "#1b2f6a");
    }
  });
  // legs
  for (const dx of [-1, 1.4]) line(ctx, [P(dx, -6), P(dx + 0.4, 0), P(dx + 1.6, 0.3)], "#8a7a6a", 0.35);
  // body: brown wing, blue breast
  shape(ctx, smoothClosed([P(-7, -8), P(-2, -13), P(4, -12.5), P(6, -9), P(3, -5.5), P(-4, -5.6)], 4), "#7a5a34", C.ink, 0.22);
  pattern(ctx, smoothClosed([P(-7, -8), P(-2, -13), P(4, -12.5), P(6, -9), P(3, -5.5), P(-4, -5.6)], 4), "dots", ["#c8a868"], 1.1, 5);
  // neck and head in lapis and malachite
  const neck = smoothClosed([P(2.8, -12.4), P(4.4, -18), P(4.6, -23), P(6.4, -24.4), P(7.4, -23), P(6.4, -18), P(6.6, -10), P(4.4, -8.6)], 4);
  shape(ctx, neck, "#1f4fa0", C.ink, 0.22);
  clipTo(ctx, neck, () => {
    for (let k = 0; k < 8; k += 1) line(ctx, [P(3, -10 - k * 1.8), P(8, -11 - k * 1.8)], "rgba(80,180,170,0.5)", 0.25);
  });
  shape(ctx, [P(7.2, -23.6), P(9.0, -23.1), P(7.3, -22.4)], "#a89878", C.ink, 0.12);
  circle(ctx, ...P(6.4, -23.4), 0.32 * s, "#fbf6ec");
  circle(ctx, ...P(6.5, -23.4), 0.18 * s, C.black);
  // crest: a fan of little plumes
  for (let i = 0; i < 5; i += 1) {
    const a = -Math.PI / 2 - 0.5 + i * 0.22;
    const q = P(5.8 + Math.cos(a) * 3.2, -24.4 + Math.sin(a) * 3.2);
    line(ctx, [P(5.8, -24.4), q], "#1f4fa0", 0.15);
    circle(ctx, q[0], q[1], 0.35 * s, "#2f8a78");
  }
}

function partridge(ctx, x, y, s, dir, seed) {
  const P = (u, v) => [x + u * s * dir, y + v * s];
  for (const dx of [-0.6, 0.8]) line(ctx, [P(dx, -2), P(dx + 0.3, 0)], C.vermilion, 0.3);
  const body = smoothClosed([P(-4.4, -3.6), P(-2, -6.2), P(2, -6.4), P(3.6, -8.4), P(5, -8.2), P(5.4, -6.6), P(4, -4.2), P(1, -1.8), P(-3, -2)], 4);
  shape(ctx, body, "#b9a58a", C.ink, 0.2);
  clipTo(ctx, body, () => {
    for (let i = 0; i < 6; i += 1) line(ctx, [P(-3 + i * 1.1, -6), P(-2 + i * 1.1, -2)], i % 2 ? "#6a4a30" : C.white, 0.35);
  });
  shape(ctx, [P(5.2, -7.8), P(6.4, -7.4), P(5.2, -7.0)], C.vermilion, C.ink, 0.1);
  line(ctx, [P(3.4, -7.0), P(5.2, -6.6)], C.black, 0.25);
  circle(ctx, ...P(4.4, -7.6), 0.2 * s, C.black);
}

// ------------------------------------------------------------------ cypress, pavilion, beds, walk, channel
function cypress(ctx, x, base, top, w, seed) {
  const next = rng(seed);
  const pts = [];
  const n = 18;
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const y = lerp(base, top, t);
    const hw = w * Math.sin(Math.PI * (0.08 + 0.92 * (1 - t))) ** 0.5 * (t > 0.9 ? (1 - t) * 10 * 0.6 + 0.0 : 1) * (1 - 0.5 * t);
    pts.push([x + hw * (1 + (next() - 0.5) * 0.12), y]);
  }
  for (let i = n; i >= 0; i -= 1) {
    const t = i / n;
    const y = lerp(base, top, t);
    const hw = w * Math.sin(Math.PI * (0.08 + 0.92 * (1 - t))) ** 0.5 * (t > 0.9 ? (1 - t) * 10 * 0.6 : 1) * (1 - 0.5 * t);
    pts.push([x - hw * (1 + (next() - 0.5) * 0.12), y]);
  }
  pts[n] = [x + 1.5, top - 2]; // the tip bends a little
  const outline = smoothClosed(pts, 2);
  shape(ctx, outline, "#183d2c", "#0f2219", 0.3);
  clipTo(ctx, outline, () => {
    // flame-like sprays of foliage, each a small upturned tuft, lit from the left
    for (let y = top - 2; y < base + 2; y += 2.6) {
      for (let xx = x - w - 2; xx < x + w + 2; xx += 2.2) {
        const lx = xx + (next() - 0.5) * 1.6;
        const ly = y + (next() - 0.5) * 1.6;
        const lit = (x - lx) / w + (next() - 0.5) * 0.5;
        const col = lit > 0.45 ? "#6aa36a" : lit > 0.1 ? "#3f7d52" : lit > -0.35 ? "#2a5e41" : "#143524";
        const lean = (lx - x) / w * 0.5;
        const tuft = [[lx - 0.9, ly + 1.1], [lx + lean * 1.5 - 0.2, ly - 1.8], [lx + 0.9, ly + 1.1], [lx, ly + 0.5]];
        fill(ctx, tuft, col);
      }
    }
  });
  return outline;
}

function vine(ctx, x, base, top, w, seed) {
  // a flowering climber twisting up round the cypress
  const next = rng(seed);
  const pts = [];
  for (let i = 0; i <= 60; i += 1) {
    const t = i / 60;
    const y = lerp(base, top + 20, t);
    pts.push([x + Math.sin(t * 9.5 + 0.5) * w * (1 - t * 0.55), y]);
  }
  taper(ctx, pts, 1.4, 0.5, "#4a2c18");
  for (let i = 2; i < 60; i += 2) {
    const p = pts[i];
    const front = Math.cos((i / 60) * 9.5 + 0.5) > 0;
    if (!front && next() < 0.6) continue;
    leaf(ctx, p[0], p[1], 2.4, next() * TAU, 0.35, "#5c9a52");
    if (next() < 0.7) blossom(ctx, p[0] + (next() - 0.5) * 3, p[1] + (next() - 0.5) * 2, 1.0 + next() * 0.4, next() < 0.5 ? "#f6dfe4" : "#e99aa8");
  }
}

const PAV = { x0: 542, x1: 902 };
function pavilionBack(ctx) {
  const { x0, x1 } = PAV;
  // roof kiosks (chhatris), white marble domes with gold finials; the border cuts their tops
  for (const [cx, w] of [[586, 30], [722, 44], [858, 30]]) {
    const base = 492;
    // columns
    shape(ctx, rect(cx - w / 2, base - 10, cx + w / 2, base), "#3b2318", C.ink, 0.25);
    for (let i = 0; i <= 3; i += 1) {
      const px = cx - w / 2 + 1.2 + (i * (w - 2.4)) / 3;
      shape(ctx, rect(px - 1.1, base - 10, px + 1.1, base), C.white, C.ink, 0.2);
    }
    shape(ctx, rect(cx - w / 2 - 2, base - 12, cx + w / 2 + 2, base - 10), C.white, C.ink, 0.22);
    // the dome
    const dome = smoothClosed([[cx - w / 2 + 1, base - 12], [cx - w / 2 - 1, base - 18], [cx - w / 3, base - 26], [cx, base - 30 - w * 0.12], [cx + w / 3, base - 26], [cx + w / 2 + 1, base - 18], [cx + w / 2 - 1, base - 12]], 4);
    shape(ctx, dome, C.white, C.ink, 0.25);
    clipTo(ctx, dome, () => {
      const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(1, "rgba(120,110,100,0.3)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - w, base - 40, w * 2, 30);
      for (let i = -3; i <= 3; i += 1) line(ctx, smoothOpen([[cx + i * w * 0.14, base - 12], [cx + i * w * 0.1, base - 24], [cx, base - 32]], 3), "rgba(51,32,15,0.35)", 0.2);
    });
    gilt(ctx, rect(cx - 0.8, base - 40 - w * 0.12, cx + 0.8, base - 29 - w * 0.12), { w: 0.15 });
  }
  // upper storey wall: sandstone with small arched windows and inlay panels
  const uy0 = 492;
  const uy1 = 541;
  fill(ctx, rect(x0, uy0, x1, uy1), C.sand);
  fill(ctx, rect(x0 - 2, uy0 - 3, x1 + 2, uy0 + 1), C.white);
  line(ctx, rect(x0 - 2, uy0 - 3, x1 + 2, uy0 + 1), C.ink, 0.25, true);
  for (let x = x0; x < x1; x += 4) fill(ctx, [[x, uy0 - 1], [x + 2, uy0 - 2.6], [x + 4, uy0 - 1], [x + 2, uy0 + 0.6]], C.sand);
  // parapet merlons
  for (let x = x0; x < x1; x += 6) shape(ctx, [[x, uy0 - 3], [x, uy0 - 5.5], [x + 1.6, uy0 - 7], [x + 3.2, uy0 - 5.5], [x + 3.2, uy0 - 3]], C.white, C.ink, 0.18);
  for (const cx of [560, 588, 856, 884]) {
    const win = [[cx - 6, uy1 - 6], [cx - 6, uy0 + 16], [cx - 4, uy0 + 12], [cx - 2, uy0 + 10.5], [cx, uy0 + 9], [cx + 2, uy0 + 10.5], [cx + 4, uy0 + 12], [cx + 6, uy0 + 16], [cx + 6, uy1 - 6]];
    shape(ctx, win, "#2a1a14", C.white, 0.7);
    // a lattice screen in the window
    clipTo(ctx, win, () => {
      for (let k = -10; k < 10; k += 1) {
        line(ctx, [[cx + k * 2, uy0], [cx + k * 2 + 40, uy1 + 40]], "rgba(244,239,226,0.6)", 0.25);
        line(ctx, [[cx + k * 2, uy0], [cx + k * 2 - 40, uy1 + 40]], "rgba(244,239,226,0.6)", 0.25);
      }
    });
    inlayPanel(ctx, cx - 7, uy1 - 5, cx + 7, uy1 - 1);
  }
  // the jharokha: a deep balcony opening behind the rail, dark, with cusped arches
  fill(ctx, rect(612, uy0 + 4, 832, uy1), "#2c1b14");
  for (let i = 0; i < 5; i += 1) {
    const cx = 634 + i * 44;
    const arch = cuspedArch(cx, uy0 + 8, 18, uy1);
    fill(ctx, arch, "#1d120d");
    // a painted hanging at the back, dim in the shade of the balcony
    clipTo(ctx, arch, () => pattern(ctx, rect(cx - 18, uy0 + 8, cx + 18, uy1), "lozenge", ["rgba(160,70,40,0.45)", "rgba(201,161,59,0.5)"], 3.2, 60 + i));
    line(ctx, arch, "rgba(244,239,226,0.7)", 0.4, true);
  }
  // white marble inlay on the sandstone: frames round the windows and a
  // running star band under the parapet
  for (const [a, b] of [[x0 + 3, 609], [835, x1 - 3]]) {
    line(ctx, rect(a, uy0 + 4, b, uy1 - 1), C.white, 0.7, true);
    line(ctx, rect(a + 1.6, uy0 + 5.6, b - 1.6, uy1 - 2.6), "rgba(244,239,226,0.8)", 0.3, true);
    for (const [px, py] of [[a, uy0 + 4], [b, uy0 + 4], [a, uy1 - 1], [b, uy1 - 1]]) circle(ctx, px, py, 1.1, C.white, C.ink, 0.12);
    // between the two windows: a tall inlaid panel of six-pointed stars
    const mx = (a + b) / 2;
    const pan = rect(mx - 3.2, uy0 + 10, mx + 3.2, uy1 - 8);
    shape(ctx, pan, "#efe7d6", C.ink, 0.15);
    for (let y = uy0 + 12.5; y < uy1 - 9; y += 4.2) {
      const st = [];
      for (let k = 0; k < 12; k += 1) {
        const an = (k / 12) * TAU;
        const r = k % 2 ? 0.9 : 1.8;
        st.push([mx + Math.cos(an) * r, y + Math.sin(an) * r]);
      }
      fill(ctx, st, C.sand);
      circle(ctx, mx, y, 0.45, C.lapis);
    }
  }
  // columns between
  for (let i = 0; i <= 5; i += 1) {
    const cx = 612 + i * 44;
    shape(ctx, rect(cx - 2.2, uy0 + 4, cx + 2.2, uy1), C.white, C.ink, 0.22);
    for (let y = uy0 + 7; y < uy1; y += 5) line(ctx, [[cx - 2.2, y], [cx + 2.2, y]], "rgba(51,32,15,0.35)", 0.18);
  }
  line(ctx, rect(612, uy0 + 4, 832, uy1), C.ink, 0.3, true);
}

function cuspedArch(cx, top, hw, bot) {
  // a multifoil arch: five lobes across the head of the opening
  const spring = top + hw * 0.9;
  const pts = [[cx - hw, bot], [cx - hw, spring]];
  const lobes = 5;
  for (let i = 0; i <= lobes * 6; i += 1) {
    const t = i / (lobes * 6);
    const a = Math.PI + t * Math.PI;
    const r = hw;
    const bx = cx + Math.cos(a) * r;
    const by = spring + Math.sin(a) * r * 0.95 - (t > 0.45 && t < 0.55 ? hw * 0.12 : 0);
    // cusps: dip inward between lobes
    const cusp = Math.abs(Math.sin(t * Math.PI * lobes)) ** 0.5;
    const k = 0.86 + 0.14 * cusp;
    pts.push([cx + (bx - cx) * k, spring + (by - spring) * k]);
  }
  pts.push([cx + hw, spring], [cx + hw, bot]);
  return pts;
}

function inlayPanel(ctx, x0, y0, x1, y1) {
  shape(ctx, rect(x0, y0, x1, y1), C.white, C.ink, 0.2);
  const cy = (y0 + y1) / 2;
  for (let x = x0 + 1.5; x < x1 - 1; x += 3) {
    fill(ctx, [[x, cy - 1.2], [x + 1.2, cy], [x, cy + 1.2], [x - 1.2, cy]], C.sand);
    circle(ctx, x, cy, 0.4, C.malachite);
  }
}

function spandrel(ctx, pts) {
  // white marble inlay of flowering arabesque on sandstone
  clipTo(ctx, pts, () => {
    const b = bbox(pts);
    for (let y = b.y0 + 2; y < b.y1; y += 5) {
      for (let x = b.x0 + 2 + ((y / 5) % 2) * 2.5; x < b.x1; x += 5) {
        line(ctx, smoothOpen([[x - 2, y + 1], [x, y - 1], [x + 2, y + 1]], 3), "#efe7d6", 0.35);
        circle(ctx, x, y - 1.2, 0.5, "#efe7d6");
      }
    }
  });
}

function pavilionFront(ctx, state) {
  const { x0, x1 } = PAV;
  const gy0 = 549; // ground storey top
  const gy1 = 646;
  // chhajja: the sloping stone eave over the ground storey, on brackets
  // ground storey: sandstone face with three cusped arches in rectangular frames
  const face = rect(x0, gy0, x1, gy1);
  fill(ctx, face, C.sand);
  // ashlar texture
  ctx.strokeStyle = "rgba(90,35,20,0.28)";
  ctx.lineWidth = 0.18;
  for (let y = gy0 + 5; y < gy1; y += 5) {
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
  }
  // in the narrow strips between frames and piers: a chain of inlaid lozenges
  for (const [a, b] of [[552, 561], [643, 657], [667, 681], [763, 777], [787, 801], [883, 892]]) {
    const mx = (a + b) / 2;
    const hw = (b - a) / 2 - 1.2;
    for (let y = gy0 + 8; y < gy1 - 4; y += 7) {
      const lz = [[mx, y - 3.2], [mx + hw, y], [mx, y + 3.2], [mx - hw, y]];
      line(ctx, lz, "#efe7d6", 0.45, true);
      circle(ctx, mx, y, 0.9, C.malachite, "#efe7d6", 0.25);
      circle(ctx, mx, y + 3.5, 0.45, "#efe7d6");
    }
  }
  const bays = [602, 722, 842];
  for (const cx of bays) {
    const hw = 34;
    const frame = rect(cx - hw - 7, gy0 + 4, cx + hw + 7, gy1);
    line(ctx, frame, C.white, 1.4, true);
    line(ctx, frame, C.ink, 0.2, true);
    const arch = cuspedArch(cx, gy0 + 10, hw, gy1);
    // spandrels between frame and arch
    const spL = [[cx - hw - 6, gy0 + 5], [cx, gy0 + 5], [cx, gy0 + 10], ...arch.slice(1, Math.floor(arch.length / 2)).reverse(), [cx - hw - 6, gy0 + 10 + hw * 0.9]];
    spandrel(ctx, rect(cx - hw - 6, gy0 + 5, cx + hw + 6, gy0 + 12 + hw * 0.9));
    // the opening: a dim interior with a carpet hanging and a lamp
    shape(ctx, arch, "#2a2420", C.white, 0.9);
    clipTo(ctx, arch, () => {
      const g = ctx.createLinearGradient(0, gy0, 0, gy1);
      g.addColorStop(0, "#3a2c24");
      g.addColorStop(1, "#5a4434");
      ctx.fillStyle = g;
      ctx.fillRect(cx - hw, gy0, hw * 2, gy1 - gy0);
      // a back wall with a niche and a floor of inlaid marble
      const niche = cuspedArch(cx, gy0 + 26, 12, gy1 - 18);
      fill(ctx, niche, "#2a1d18");
      line(ctx, niche, "rgba(244,239,226,0.5)", 0.4, true);
      fill(ctx, rect(cx - hw, gy1 - 18, cx + hw, gy1), "#d9cfbd");
      for (let x = cx - hw; x < cx + hw; x += 6) {
        for (let y = gy1 - 18; y < gy1; y += 6) fill(ctx, [[x + 3, y], [x + 6, y + 3], [x + 3, y + 6], [x, y + 3]], (x + y) % 12 === 0 ? "#b8a68c" : "#c9b89e");
      }
      line(ctx, [[cx - hw, gy1 - 18], [cx + hw, gy1 - 18]], "rgba(51,32,15,0.5)", 0.3);
      // a hanging lamp
      line(ctx, [[cx + 14, gy0 + 10], [cx + 14, gy0 + 22]], C.gold, 0.3);
      gilt(ctx, smoothClosed([[cx + 11.6, gy0 + 22], [cx + 14, gy0 + 20], [cx + 16.4, gy0 + 22], [cx + 14, gy0 + 27]], 3), { w: 0.18 });
      // vases in the niche
      flask(ctx, cx - 4, gy1 - 30, 7, C.lapis, 1);
      flask(ctx, cx + 4, gy1 - 30, 6, "#3a8c88", 2);
    });
    line(ctx, arch, C.ink, 0.3, true);
  }
  // piers with inlaid panels
  for (const px of [x0 + 5, 662, 782, x1 - 5]) {
    const pier = rect(px - 5, gy0, px + 5, gy1);
    shape(ctx, pier, C.sandLight, C.ink, 0.25);
    for (let y = gy0 + 6; y < gy1 - 6; y += 18) {
      shape(ctx, rect(px - 3, y, px + 3, y + 14), C.white, C.ink, 0.18);
      // a flowering plant inlaid in each panel
      line(ctx, [[px, y + 13], [px, y + 4]], C.malDark, 0.3);
      leaf(ctx, px, y + 10, 2.4, -2.4, 0.35, C.malachite);
      leaf(ctx, px, y + 9, 2.4, -0.7, 0.35, C.malachite);
      circle(ctx, px, y + 3.4, 1.2, C.vermilion, C.ink, 0.12);
    }
  }
  // the eave
  const eave = [[x0 - 6, gy0 - 3], [x1 + 6, gy0 - 3], [x1 + 10, gy0 + 3], [x0 - 10, gy0 + 3]];
  shape(ctx, eave, C.white, C.ink, 0.3);
  clipTo(ctx, eave, () => {
    for (let x = x0 - 10; x < x1 + 10; x += 2.4) line(ctx, [[x, gy0 - 3], [x - 1, gy0 + 3]], "rgba(51,32,15,0.3)", 0.18);
  });
  for (let x = x0; x <= x1; x += 20) shape(ctx, [[x - 1.5, gy0 + 3], [x + 1.5, gy0 + 3], [x + 0.8, gy0 + 7], [x - 0.8, gy0 + 7]], C.sandLight, C.ink, 0.18);
  // plinth with a band of inlay, and steps in the middle bay
  const plinth = rect(x0 - 4, gy1, x1 + 4, 662);
  shape(ctx, plinth, C.sandDark, C.ink, 0.3);
  for (let x = x0; x < x1; x += 8) {
    fill(ctx, [[x + 4, gy1 + 3], [x + 8, gy1 + 8], [x + 4, gy1 + 13], [x, gy1 + 8]], "#e7dccb");
    circle(ctx, x + 4, gy1 + 8, 1.0, C.vermilion);
  }
  line(ctx, [[x0 - 4, gy1 + 1.5], [x1 + 4, gy1 + 1.5]], C.white, 0.6);
}

function balconyRail(ctx) {
  // the projecting balcony's carved white rail, in front of the people leaning on it
  const y0 = 528;
  const y1 = 545;
  const x0 = 606;
  const x1 = 838;
  shape(ctx, rect(x0, y0, x1, y1), C.white, C.ink, 0.3);
  clipTo(ctx, rect(x0 + 1.5, y0 + 2.5, x1 - 1.5, y1 - 2), () => {
    fill(ctx, rect(x0, y0, x1, y1), "#e9e1d0");
    // a pierced lattice of stars
    for (let x = x0; x < x1 + 4; x += 4) {
      for (let y = y0 + 2; y < y1 + 4; y += 4) {
        fill(ctx, [[x, y - 1.5], [x + 0.6, y - 0.6], [x + 1.5, y], [x + 0.6, y + 0.6], [x, y + 1.5], [x - 0.6, y + 0.6], [x - 1.5, y], [x - 0.6, y - 0.6]], "#3a2820");
      }
    }
  });
  fill(ctx, rect(x0 - 3, y0 - 2, x1 + 3, y0 + 1), C.white);
  line(ctx, rect(x0 - 3, y0 - 2, x1 + 3, y0 + 1), C.ink, 0.25, true);
  // brackets under the projecting balcony
  for (let x = x0 + 8; x < x1; x += 28) {
    shape(ctx, smoothClosed([[x - 3, y1], [x + 3, y1], [x + 2, y1 + 3], [x, y1 + 6], [x - 2, y1 + 3]], 2), C.white, C.ink, 0.2);
  }
}

// flower bed: a row of plants, each a small botanical portrait
function poppy(ctx, x, y, h, seed) {
  const next = rng(seed);
  // grey-green toothed leaves at the foot, a hairy stem, a scarlet cup
  for (const s of [-1, 1]) {
    const lf = smoothClosed([[x, y], [x + s * 3, y - 3], [x + s * 5, y - 2], [x + s * 4, y - 5], [x + s * 6.5, y - 6], [x + s * 2.5, y - 7.5], [x + s * 0.4, y - 4]], 2);
    shape(ctx, lf, "#7f9e84", "#3a5a40", 0.15);
  }
  const top = [x + (next() - 0.5) * 2, y - h];
  line(ctx, smoothOpen([[x, y], [x + 0.5, y - h * 0.5], top], 3), "#5a7a5a", 0.35);
  const cupPts = smoothClosed([[top[0] - 3.2, top[1] - 1], [top[0] - 2.6, top[1] - 4.2], [top[0] - 0.6, top[1] - 5], [top[0] + 1.2, top[1] - 4.6], [top[0] + 3.2, top[1] - 4], [top[0] + 3.0, top[1] - 0.8], [top[0], top[1] + 0.8]], 3);
  shape(ctx, cupPts, "#d63a22", "#6a1a10", 0.18);
  line(ctx, [[top[0] - 1, top[1] - 4.6], [top[0] - 0.4, top[1]]], "#8e2010", 0.15);
  line(ctx, [[top[0] + 1.2, top[1] - 4.4], [top[0] + 0.6, top[1]]], "#8e2010", 0.15);
  ellipse(ctx, top[0] + 0.2, top[1] - 1.2, 1.4, 0.7, 0, C.black);
  // a nodding bud
  const bud = [x + 3.5, y - h * 0.65];
  line(ctx, smoothOpen([[x + 0.4, y - h * 0.3], [x + 3.4, y - h * 0.62], [bud[0] + 0.6, bud[1] + 1.2]], 3), "#5a7a5a", 0.25);
  ellipse(ctx, bud[0] + 0.6, bud[1] + 1.8, 0.9, 1.4, 0.3, "#7f9e84", "#3a5a40", 0.12);
}
function iris(ctx, x, y, h, seed) {
  for (const [dx, a, l] of [[-1, -1.85, 0.8], [0, -1.62, 0.95], [1, -1.4, 0.75], [-1.5, -2.1, 0.6]]) {
    const tip = [x + dx + Math.cos(a) * h * l, y + Math.sin(a) * h * l];
    swell(ctx, smoothOpen([[x + dx * 0.5, y], [lerp(x, tip[0], 0.5), lerp(y, tip[1], 0.5)], tip], 3), 1.6, "#4d8a62");
    line(ctx, smoothOpen([[x + dx * 0.5, y], tip], 2), "rgba(30,60,40,0.6)", 0.12);
  }
  const top = [x + 0.6, y - h * 1.05];
  line(ctx, [[x, y], top], "#4d8a62", 0.4);
  // three falls and three standards, violet and blue with a yellow beard
  for (const s of [-1, 1]) {
    shape(ctx, smoothClosed([[top[0], top[1] + 0.5], [top[0] + s * 3.6, top[1] + 0.2], [top[0] + s * 4.6, top[1] + 2.4], [top[0] + s * 2.4, top[1] + 3]], 3), "#5a4aa0", C.ink, 0.15);
    line(ctx, [[top[0] + s * 0.8, top[1] + 0.8], [top[0] + s * 3, top[1] + 1.6]], C.orpiment, 0.35);
    shape(ctx, smoothClosed([[top[0], top[1]], [top[0] + s * 1.6, top[1] - 3.8], [top[0] + s * 0.4, top[1] - 4.6], [top[0] - s * 0.4, top[1] - 2]], 3), "#8a7ad0", C.ink, 0.15);
  }
  shape(ctx, smoothClosed([[top[0] - 0.8, top[1]], [top[0], top[1] - 4.4], [top[0] + 0.8, top[1]]], 2), "#7a6ac0", C.ink, 0.12);
}
function lily(ctx, x, y, h, seed) {
  line(ctx, [[x, y], [x + 0.4, y - h]], "#4d8a62", 0.4);
  for (let i = 0; i < 6; i += 1) {
    const yy = y - 2 - i * (h / 7);
    leaf(ctx, x + 0.2, yy, 3.4, i % 2 ? -0.5 : -2.6, 0.22, "#5c9a52");
  }
  // two white trumpets
  for (const [s, dy] of [[1, 0], [-1, 3]]) {
    const b = [x + 0.4, y - h + dy];
    const tr = smoothClosed([[b[0], b[1]], [b[0] + s * 3, b[1] - 2.2], [b[0] + s * 5.2, b[1] - 3.8], [b[0] + s * 5.6, b[1] - 1.6], [b[0] + s * 5.0, b[1] + 0.8], [b[0] + s * 3, b[1] + 1.0]], 3);
    shape(ctx, tr, "#f8f4ea", "#6a6050", 0.15);
    line(ctx, [[b[0] + s * 1, b[1]], [b[0] + s * 5, b[1] - 1.4]], "rgba(120,140,100,0.6)", 0.15);
    for (let k = 0; k < 3; k += 1) circle(ctx, b[0] + s * (5.6 + k * 0.3), b[1] - 1.8 + k * 0.9, 0.3, C.ochre);
  }
}
function narcissus(ctx, x, y, h, seed) {
  for (const [dx, a] of [[-0.6, -1.75], [0.6, -1.45], [0, -1.6]]) {
    const tip = [x + dx + Math.cos(a) * h * 0.8, y + Math.sin(a) * h * 0.8];
    swell(ctx, smoothOpen([[x, y], [lerp(x, tip[0], 0.5) + dx, lerp(y, tip[1], 0.5)], tip], 3), 1.1, "#5c9a62");
  }
  line(ctx, smoothOpen([[x, y], [x + 0.4, y - h * 0.7], [x + 1.5, y - h]], 3), "#4d8a62", 0.35);
  for (const [fx, fy] of [[x + 1.5, y - h], [x - 2.4, y - h * 0.85]]) {
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * TAU + 0.3;
      ellipse(ctx, fx + Math.cos(a) * 1.4, fy + Math.sin(a) * 1.4, 1.3, 0.7, a, "#fbf8f0", "#7a7060", 0.1);
    }
    circle(ctx, fx, fy, 0.9, C.orpiment, "#a06a1a", 0.12);
    circle(ctx, fx, fy, 0.4, C.vermilion);
  }
  line(ctx, [[x + 0.4, y - h * 0.7], [x - 2.4, y - h * 0.85]], "#4d8a62", 0.3);
}
function tulip(ctx, x, y, h, seed) {
  for (const s of [-1, 1]) {
    swell(ctx, smoothOpen([[x, y], [x + s * 2.6, y - h * 0.4], [x + s * 2.2, y - h * 0.7]], 3), 2.0, "#6a9a72");
  }
  line(ctx, [[x, y], [x, y - h]], "#4d8a62", 0.35);
  const t = [x, y - h];
  shape(ctx, smoothClosed([[t[0] - 2.2, t[1]], [t[0] - 2.6, t[1] - 3], [t[0] - 1.6, t[1] - 5], [t[0] - 0.4, t[1] - 3.6], [t[0], t[1] - 5.6], [t[0] + 0.6, t[1] - 3.6], [t[0] + 1.8, t[1] - 5], [t[0] + 2.6, t[1] - 3], [t[0] + 2.2, t[1]]], 3), C.orpiment, "#8a4a10", 0.15);
  clipTo(ctx, smoothClosed([[t[0] - 2.2, t[1]], [t[0] - 2.6, t[1] - 3], [t[0] - 1.6, t[1] - 5], [t[0] - 0.4, t[1] - 3.6], [t[0], t[1] - 5.6], [t[0] + 0.6, t[1] - 3.6], [t[0] + 1.8, t[1] - 5], [t[0] + 2.6, t[1] - 3], [t[0] + 2.2, t[1]]], 3), () => {
    for (let i = -3; i <= 3; i += 1) line(ctx, [[t[0] + i * 0.7, t[1]], [t[0] + i * 0.9, t[1] - 6]], "rgba(200,64,42,0.7)", 0.3);
  });
}

function paintFlowerBed(ctx) {
  const y0 = 662;
  const y1 = 690;
  fill(ctx, rect(PIC.x0, y0, PIC.x1, y1), "#24603f");
  const next = rng(77);
  // tiny ground plants between the portraits
  for (let i = 0; i < 700; i += 1) {
    const x = PIC.x0 + next() * (PIC.x1 - PIC.x0);
    const y = y0 + 2 + next() * (y1 - y0 - 3);
    line(ctx, [[x, y], [x + (next() - 0.5), y - 1.6]], next() < 0.5 ? "rgba(20,50,30,0.7)" : "rgba(110,170,110,0.6)", 0.2);
  }
  // a back row of small flowering plants, and leafy ground cover along the kerb
  for (let x = PIC.x0 + 2; x < PIC.x1; x += 4.6) {
    const r = next();
    if (r < 0.5) spray(ctx, x + (next() - 0.5) * 2, y0 + 9 + next() * 3, 1.15, next);
    else sprig(ctx, x + (next() - 0.5) * 2, y0 + 10 + next() * 3, 1.1, Math.floor(next() * 5));
  }
  for (let x = PIC.x0 + 1; x < PIC.x1; x += 3.6) {
    if (next() < 0.55) tuft(ctx, x, y1 - 1.2, 1.1 + next() * 0.4, next);
    else rosette(ctx, x, y1 - 1.2, 1.0 + next() * 0.3, next);
  }
  const kinds = [poppy, iris, lily, narcissus, tulip, iris, poppy, narcissus];
  let k = 0;
  for (let x = PIC.x0 + 7; x < PIC.x1 - 4; x += 13 + next() * 4) {
    const fn = kinds[k % kinds.length];
    fn(ctx, x, y1 - 1.5, 17 + next() * 6, 900 + k);
    k += 1;
  }
  // the bed's edging: a white stone kerb
  fill(ctx, rect(PIC.x0, y1 - 0.8, PIC.x1, y1 + 0.6), C.white);
  line(ctx, [[PIC.x0, y1 - 0.8], [PIC.x1, y1 - 0.8]], C.ink, 0.2);
}

function paintWalk(ctx) {
  const y0 = 690.6;
  const y1 = 712.5;
  fill(ctx, rect(PAGE.x0, y0, PAGE.x1, y1), "#e6dcc6");
  // star-and-cross tiles in plan: eight-pointed stars in sandstone, crosses in white
  const step = 7.2;
  const cy = (y0 + y1) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(PAGE.x0, y0 + 1.2, PAGE.x1 - PAGE.x0, y1 - y0 - 2.4);
  ctx.clip();
  for (let row = -2; row <= 2; row += 1) {
    const y = cy + row * step;
    for (let x = PAGE.x0 + ((row + 10) % 2) * step; x < PAGE.x1 + step; x += step * 2) {
      const star = [];
      for (let i = 0; i < 16; i += 1) {
        const a = (i / 16) * TAU + Math.PI / 8;
        const r = i % 2 ? step * 0.36 : step * 0.58;
        star.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
      }
      shape(ctx, star, C.sand, C.ink, 0.15);
      circle(ctx, x, y, step * 0.15, C.malachite);
      fill(ctx, [[x + step, y - step * 0.3], [x + step * 1.3, y], [x + step, y + step * 0.3], [x + step * 0.7, y]], C.lapis);
    }
  }
  ctx.restore();
  // edging bands
  for (const yy of [y0, y1 - 1.6]) {
    fill(ctx, rect(PAGE.x0, yy, PAGE.x1, yy + 1.6), C.sandDark);
    for (let x = PAGE.x0; x < PAGE.x1; x += 3) circle(ctx, x, yy + 0.8, 0.35, C.white);
  }
  line(ctx, [[PAGE.x0, y1], [PAGE.x1, y1]], C.ink, 0.25);
}

/** The ripples of the channel: rows of white scale-arcs, in world units. */
function ripples(ctx, x0, x1, alpha = 1) {
  ctx.strokeStyle = `rgba(250,250,245,${0.75 * alpha})`;
  ctx.lineWidth = 0.32;
  for (let i = 0; i < 9; i += 1) {
    const y = CHANNEL.y0 + 3 + i * 3.8;
    const off = (i % 2) * 3.2;
    const start = Math.floor((x0 - off) / 6.4) * 6.4 + off;
    ctx.beginPath();
    for (let x = start; x < x1 + 6.4; x += 6.4) {
      ctx.moveTo(x - 3.2, y);
      ctx.arc(x, y, 3.2, Math.PI, TAU);
    }
    ctx.stroke();
  }
}

function fish(ctx, x, y, s, a, col) {
  const c = Math.cos(a);
  const sn = Math.sin(a);
  const Q = (u, v) => [x + (u * c - v * sn) * s, y + (u * sn + v * c) * s];
  const body = smoothClosed([Q(3.2, 0), Q(1.8, -1.0), Q(-0.8, -0.9), Q(-2.6, -0.3), Q(-2.6, 0.3), Q(-0.8, 0.9), Q(1.8, 1.0)], 3);
  shape(ctx, body, col, C.ink, 0.15);
  shape(ctx, [Q(-2.4, 0), Q(-4.0, -1.3), Q(-3.6, 0), Q(-4.0, 1.3)], col, C.ink, 0.12);
  shape(ctx, [Q(0.8, -0.8), Q(0.0, -1.9), Q(-0.4, -0.8)], col, C.ink, 0.1);
  shape(ctx, [Q(0.8, 0.8), Q(0.0, 1.9), Q(-0.4, 0.8)], col, C.ink, 0.1);
  circle(ctx, ...Q(2.3, -0.5), 0.2 * s, C.black);
  circle(ctx, ...Q(2.3, 0.5), 0.2 * s, C.black);
  line(ctx, [Q(1.4, 0), Q(-1.8, 0)], "rgba(51,32,15,0.35)", 0.12);
}

function jet(ctx, x) {
  // a fountain jet drawn from the side, rising out of the plan of the channel
  const base = 731;
  const top = 697;
  const col = "rgba(248,250,252,0.95)";
  const edge = "#5d7f9c";
  const stem = [[x, base], [x - 0.3, lerp(base, top, 0.5)], [x, top]];
  swell(ctx, stem, 3.2, edge);
  swell(ctx, stem, 2.4, col);
  line(ctx, [[x + 0.3, base - 2], [x + 0.2, top + 3]], "rgba(93,127,156,0.6)", 0.25);
  // the crown: two arching sprays falling back to the water, beaded with drops
  for (const s of [-1, 1]) {
    const arc = [];
    for (let i = 0; i <= 12; i += 1) {
      const t = i / 12;
      arc.push([x + s * t * 10, top + 0.5 - Math.sin(t * Math.PI * 0.7) * 3.2 + t * t * 17]);
    }
    swell(ctx, arc, 1.9, edge);
    swell(ctx, arc, 1.3, col);
    for (let k = 0; k < 5; k += 1) circle(ctx, x + s * (10.4 + k * 0.5), top + 17.5 + k * 2.4, 0.42, col, edge, 0.12);
  }
  for (let k = 0; k < 6; k += 1) {
    const a = -Math.PI / 2 + (k - 2.5) * 0.45;
    circle(ctx, x + Math.cos(a) * 3.2, top - 1 + Math.sin(a) * 2.4, 0.4, col, edge, 0.12);
  }
  ellipse(ctx, x, base, 5, 1.6, 0, null, "rgba(250,250,245,0.95)", 0.4);
  ellipse(ctx, x, base, 8.5, 2.6, 0, null, "rgba(250,250,245,0.65)", 0.3);
  ellipse(ctx, x, base, 12, 3.6, 0, null, "rgba(250,250,245,0.35)", 0.3);
}
const JETS = [262, 604, 878];

function paintChannel(ctx) {
  const { y0, y1 } = CHANNEL;
  // marble kerb, then water: grey-blue, darker at the edges
  fill(ctx, rect(PAGE.x0, y0 - 1.5, PAGE.x1, y0), C.white);
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, C.waterDark);
  g.addColorStop(0.25, C.water);
  g.addColorStop(0.75, C.water);
  g.addColorStop(1, C.waterDark);
  ctx.fillStyle = g;
  ctx.fillRect(PIC.x0, y0, PIC.x1 - PIC.x0, y1 - y0);
  ripples(ctx, PIC.x0, PIC.x1);
  const next = rng(91);
  for (let i = 0; i < 26; i += 1) {
    const x = PIC.x0 + 12 + next() * (PIC.x1 - PIC.x0 - 24);
    const y = y0 + 6 + next() * (y1 - y0 - 12);
    fish(ctx, x, y, 0.95 + next() * 0.4, (next() - 0.5) * 0.8 + (next() < 0.5 ? Math.PI : 0), next() < 0.6 ? "#e08a3a" : "#d8d4cc");
  }
  line(ctx, [[PAGE.x0, y0 - 1.5], [PAGE.x1, y0 - 1.5]], C.ink, 0.25);
  line(ctx, [[PAGE.x0, y0], [PAGE.x1, y0]], C.ink, 0.25);
}

// ------------------------------------------------------------------ title panel
// An illuminated cartouche: a gold ground inside a fine gold scroll border,
// the words in cream cloud-band reserves cut to the shape of each line, and
// small flowers in the gold between them. Two columns: the Chinese name over
// the Chinese date, and the English name in two lines over the English date.
// 248 units wide, so it is in full view for (606 - 248) / 166.67 = 2.15 s.
const TITLE = { x0: 176, x1: 424, y0: 468, y1: 520 };
const T_ZH = 19;    // the Chinese name: glyphs about 16.5 units (52 px) tall
const T_LINE = 14; // every other line: capitals and digits about 9 units (28-30 px)
const T_ZHDATE = 14.5; // the Chinese date (its digits run small in the brush hand)

/** A cloud-band reserve around one line: scalloped top and bottom, pointed lobes at the ends. */
function cloudCapsule(cx, cy, hw, hh) {
  const pts = [];
  const n = Math.max(2, Math.round((2 * hw) / 7));
  for (let i = 0; i <= 48; i += 1) {
    const t = i / 48;
    pts.push([lerp(cx - hw, cx + hw, t), cy - hh - 0.9 * Math.abs(Math.sin(Math.PI * n * t)) ** 0.7]);
  }
  for (let i = 1; i < 20; i += 1) {
    const a = -Math.PI / 2 + (i / 20) * Math.PI;
    const c = Math.cos(a);
    pts.push([cx + hw + c * hh * 0.75 + 3.2 * c ** 8, cy + Math.sin(a) * hh]);
  }
  for (let i = 0; i <= 48; i += 1) {
    const t = i / 48;
    pts.push([lerp(cx + hw, cx - hw, t), cy + hh + 0.9 * Math.abs(Math.sin(Math.PI * n * t)) ** 0.7]);
  }
  for (let i = 1; i < 20; i += 1) {
    const a = Math.PI / 2 + (i / 20) * Math.PI;
    const c = Math.cos(a);
    pts.push([cx - hw + c * hh * 0.75 - 3.2 * c ** 8, cy + Math.sin(a) * hh]);
  }
  return pts;
}

function titleLines(ctx) {
  // measure every line in its own face, so the reserves follow the words
  const L = [
    { col: 0, text: META.zh, font: `400 ${T_ZH}px ${FONT_ZH}`, size: T_ZH, color: "#1a120c" },
    { col: 0, text: META.date, font: `400 ${T_ZHDATE}px ${FONT_ZH}`, size: T_ZHDATE, color: C.verDark },
  ];
  const words = META.en.split(" ");
  const cut = Math.ceil(words.length / 2);
  const en = words.length > 2 ? [words.slice(0, cut).join(" "), words.slice(cut).join(" ")] : [META.en];
  for (const t of en) L.push({ col: 1, text: t, font: `italic 400 ${T_LINE}px ${FONT_EN}`, size: T_LINE, color: "#1a120c" });
  // the English date in runs: letters in the chancery face, figures in a lining italic
  const fig = `italic 400 ${T_LINE}px ${FONT_FIG}`;
  const runs = META.dateEn.split(/(\d+)/).filter((s) => s.length).map((s) => ({ text: s, font: /^\d+$/.test(s) ? fig : `italic 400 ${T_LINE}px ${FONT_EN}` }));
  L.push({ col: 1, text: META.dateEn, font: `italic 400 ${T_LINE}px ${FONT_EN}`, size: T_LINE, color: C.verDark, runs });
  for (const l of L) {
    if (l.runs) {
      l.w = 0;
      for (const r of l.runs) {
        ctx.font = r.font;
        r.w = ctx.measureText(r.text).width;
        l.w += r.w;
      }
      continue;
    }
    ctx.font = l.font;
    l.w = ctx.measureText(l.text).width;
  }
  return L;
}

function paintTitle(ctx) {
  const { x0, x1, y0, y1 } = TITLE;
  ctx.save();
  // the outer border: gold rules either side of a lapis band with a fine gold scroll
  fill(ctx, rect(x0, y0, x1, y1), C.lapisDark);
  const scroll = (ax, ay, bx, by) => {
    const len = Math.hypot(bx - ax, by - ay);
    const d = [(bx - ax) / len, (by - ay) / len];
    const nrm = [-d[1], d[0]];
    const P = (u, v) => [ax + d[0] * u + nrm[0] * v, ay + d[1] * u + nrm[1] * v];
    const pts = [];
    for (let u = 0; u <= len; u += 0.5) pts.push(P(u, Math.sin((u / 5) * Math.PI) * 0.7));
    line(ctx, pts, C.gold, 0.28);
    for (let u = 2.5, k = 0; u < len - 1; u += 5, k += 1) {
      const sgn = k % 2 ? 1 : -1;
      const curl = [];
      for (let j = 0; j <= 8; j += 1) {
        const a = (j / 8) * 4.2;
        curl.push(P(u + Math.sin(a) * 0.9 * (1 - j / 14), sgn * (0.6 + (1 - Math.cos(a)) * 0.5 * (1 - j / 14))));
      }
      line(ctx, curl, C.goldLight, 0.18);
      circle(ctx, ...P(u + 1.6, -sgn * 0.6), 0.22, k % 3 === 0 ? C.vermilion : C.goldLight);
    }
  };
  const m = 1.9; // the scroll band's centre line, from the outer edge
  scroll(x0 + m, y0 + m, x1 - m, y0 + m);
  scroll(x0 + m, y1 - m, x1 - m, y1 - m);
  scroll(x0 + m, y0 + m, x0 + m, y1 - m);
  scroll(x1 - m, y0 + m, x1 - m, y1 - m);
  // the gold ground
  const ix0 = x0 + 4;
  const ix1 = x1 - 4;
  const iy0 = y0 + 4;
  const iy1 = y1 - 4;
  gilt(ctx, rect(ix0, iy0, ix1, iy1), { hatch: 0.9, rub: 77, w: 0.3 });
  // the rules
  line(ctx, rect(x0, y0, x1, y1), C.goldDark, 0.9, true);
  line(ctx, rect(x0 + 0.25, y0 + 0.25, x1 - 0.25, y1 - 0.25), C.gold, 0.45, true);
  line(ctx, rect(ix0, iy0, ix1, iy1), C.goldDark, 0.45, true);
  line(ctx, rect(ix0 - 0.5, iy0 - 0.5, ix1 + 0.5, iy1 + 0.5), C.vermilion, 0.3, true);

  // the lines and their reserves
  const L = titleLines(ctx);
  const PAD = 3.5; // from the word to the scalloped edge
  const TIP = 4.5; // the pointed lobe at each end
  const colW = [0, 1].map((c) => Math.max(...L.filter((l) => l.col === c).map((l) => l.w)) + 2 * (PAD + TIP));
  const room = ix1 - ix0 - 6;
  const squeeze = Math.min(1, room / (colW[0] + colW[1]));
  const slack = (ix1 - ix0 - (colW[0] + colW[1]) * squeeze) / 3;
  const cx = [ix0 + slack + (colW[0] * squeeze) / 2, ix1 - slack - (colW[1] * squeeze) / 2];
  // baselines: the Chinese name and its date; the English name in two lines and its date
  const left = L.filter((l) => l.col === 0);
  const right = L.filter((l) => l.col === 1);
  left[0].base = 493.4;
  left[0].cy = 486.4;
  left[0].hh = 10.2;
  left[1].base = 509.8;
  left[1].cy = 505;
  left[1].hh = 7.6;
  const step = 12.8;
  const b0 = (iy0 + iy1) / 2 - ((right.length - 1) * step) / 2 + 3.3;
  right.forEach((l, i) => {
    l.base = b0 + i * step;
    l.cy = l.base - 3.4;
    l.hh = 6.6;
  });
  // the reserves as first cut (before the year was reset), kept only so the
  // flowers in the gold draw their colours in the same order as before
  for (const l of L) {
    l.cy0 = l.cy;
    ctx.font = l.font;
    l.w0 = l.runs ? ctx.measureText(l.text).width : l.w;
  }
  if (right.length === 3) {
    // open the space between the name's descenders and the date: the name's two
    // lines close up a little, the date (no descenders) drops and its reserve rides higher
    right[0].base -= 0.8;
    right[1].base -= 2.3;
    right[2].base += 2.4;
    right.forEach((l, i) => { l.cy = l.base - (i === 2 ? 4.4 : 3.4); });
  }
  const caps = L.map((l) => cloudCapsule(cx[l.col], l.cy, (l.w * squeeze) / 2 + PAD, l.hh));
  // the reserves as one shape per column: outline every capsule, then fill them all
  for (const c of caps) line(ctx, c, C.goldDark, 1.5, true);
  for (const c of caps) line(ctx, c, C.goldLight, 0.9, true);
  for (const c of caps) fill(ctx, c, "#f6eed8");
  // a breath of colour inside the reserves, as on burnished paper
  for (const c of caps) {
    clipTo(ctx, c, () => {
      const b = bbox(c);
      const g = ctx.createLinearGradient(0, b.y0, 0, b.y1);
      g.addColorStop(0, "rgba(255,252,240,0.6)");
      g.addColorStop(1, "rgba(210,190,150,0.18)");
      ctx.fillStyle = g;
      ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    });
  }
  // small flowers in the gold, wherever no reserve lies
  const toPath = (c) => {
    const p = new Path2D();
    p.moveTo(c[0][0], c[0][1]);
    for (let i = 1; i < c.length; i += 1) p.lineTo(c[i][0], c[i][1]);
    p.closePath();
    return p;
  };
  const paths = caps.map(toPath);
  const paths0 = L.map((l) => toPath(cloudCapsule(cx[l.col], l.cy0, (l.w0 * squeeze) / 2 + PAD, l.hh)));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // isPointInPath tests in path units with an identity transform
  const free = (x, y, r, ps = paths) => {
    if (x - r < ix0 + 0.6 || x + r > ix1 - 0.6 || y - r < iy0 + 0.6 || y + r > iy1 - 0.6) return false;
    for (const p of ps) {
      for (const [dx, dy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r * 0.7, r * 0.7], [-r * 0.7, r * 0.7], [r * 0.7, -r * 0.7], [-r * 0.7, -r * 0.7]]) {
        if (ctx.isPointInPath(p, x + dx, y + dy)) return false;
      }
    }
    return true;
  };
  const spots = [];
  const nx = rng(4711);
  for (let y = iy0 + 1.6; y < iy1; y += 3.1) {
    for (let x = ix0 + 1.6 + ((Math.round((y - iy0) / 3.1) % 2) * 1.55); x < ix1; x += 3.1) {
      const jx = x + (nx() - 0.5) * 0.8;
      const jy = y + (nx() - 0.5) * 0.8;
      // the colour is drawn from the sequence where the first cut left gold, so
      // every flower the re-cut does not touch keeps its colour; gold the re-cut
      // opened gets a colour of its own
      const r = free(jx, jy, 1.9, paths0) ? nx() : null;
      if (free(jx, jy, 1.9)) spots.push([jx, jy, r === null ? hash(4712, Math.round(jx * 10) * 7919 + Math.round(jy * 10)) : r]);
    }
  }
  ctx.restore();
  for (const [x, y, r] of spots) {
    // a sprig: two leaves and a five-dot floret in lapis, vermilion or white
    leaf(ctx, x, y, 1.5, r * TAU, 0.38, C.malDark);
    leaf(ctx, x, y, 1.3, r * TAU + 2.6, 0.38, C.malachite);
    const col = r < 0.4 ? C.lapis : r < 0.75 ? C.vermilion : "#f6f2ea";
    for (let k = 0; k < 5; k += 1) {
      const a = r * 7 + (k / 5) * TAU;
      circle(ctx, x + Math.cos(a) * 0.55, y + Math.sin(a) * 0.55, 0.42, col);
    }
    circle(ctx, x, y, 0.3, C.orpiment);
  }
  // lettering
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
  for (const l of L) {
    ctx.save();
    ctx.translate(cx[l.col], l.base);
    ctx.scale(squeeze, 1);
    ctx.font = l.font;
    ctx.fillStyle = l.color;
    if (l.runs) {
      ctx.textAlign = "left";
      let x = -l.w / 2;
      for (const r of l.runs) {
        ctx.font = r.font;
        ctx.fillText(r.text, x, 0);
        x += r.w;
      }
      ctx.textAlign = "center";
    } else {
      ctx.fillText(l.text, 0, 0);
    }
    ctx.restore();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ age: craquelure and rubbing
function paintAge(ctx) {
  const next = rng(1234);
  ctx.lineCap = "round";
  // craquelure: fine branching cracks across the picture, darker over light paint
  for (let i = 0; i < 520; i += 1) {
    let x = PAGE.x0 + next() * (PAGE.x1 - PAGE.x0);
    let y = 433 + next() * 357;
    let a = next() * TAU;
    const pts = [[x, y]];
    const n = 4 + Math.floor(next() * 8);
    for (let k = 0; k < n; k += 1) {
      a += (next() - 0.5) * 1.6;
      const l = 1.5 + next() * 3.5;
      x += Math.cos(a) * l;
      y += Math.sin(a) * l;
      pts.push([x, y]);
    }
    // a dark hairline with a pale lip beside it, as the paint film lifts
    line(ctx, pts.map((p) => [p[0] + 0.12, p[1] + 0.12]), "rgba(255,248,230,0.14)", 0.14);
    line(ctx, pts, "rgba(40,25,12,0.24)", 0.17);
  }
  // a little rubbing: pale specks where the paint has worn
  for (let i = 0; i < 1400; i += 1) {
    const x = PAGE.x0 + next() * (PAGE.x1 - PAGE.x0);
    const y = 433 + next() * 357;
    if (noise2(x * 0.02, y * 0.02, 5) < 0.55) continue;
    circle(ctx, x, y, 0.15 + next() * 0.35, "rgba(236,226,200,0.35)");
  }
  // a soft darkening toward the page edges, as of handling
  const g = ctx.createLinearGradient(0, 433, 0, 790);
  g.addColorStop(0, "rgba(60,40,20,0.06)");
  g.addColorStop(0.2, "rgba(60,40,20,0)");
  g.addColorStop(0.85, "rgba(60,40,20,0)");
  g.addColorStop(1, "rgba(60,40,20,0.08)");
  ctx.fillStyle = g;
  ctx.fillRect(PAGE.x0, 433, PAGE.x1 - PAGE.x0, 357);
}

// ------------------------------------------------------------------ the page
function paintPage(ctx, state) {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  paintBorder(ctx);
  ctx.save();
  ctx.beginPath();
  ctx.rect(PIC.x0, PIC.y0, PIC.x1 - PIC.x0, PIC.y1 - PIC.y0);
  ctx.clip();
  paintSky(ctx);
  paintTreesBehind(ctx);
  paintWall(ctx, PIC.x0, PAV.x0 + 4);
  paintWall(ctx, PAV.x1 - 4, PIC.x1);
  paintLawn(ctx);
  pavilionBack(ctx);
  // balcony people behind their rail
  for (const g of GUESTS.filter((q) => q.kind === "bust")) paintGuest(ctx, g, state);
  balconyRail(ctx);
  pavilionFront(ctx, state);
  for (const g of GUESTS.filter((q) => ["lady", "scholar", "attendant"].includes(q.id))) paintGuest(ctx, g, state);
  // the party
  paintCarpet(ctx);
  canopyBack(ctx);
  tray(ctx, 236, 628, 7, "pomegranate", 1);
  tray(ctx, 318, 600, 6, "grapes", 2);
  bolster(ctx, 184, 594, 30, 17);
  for (const id of ["companion-a", "noble", "companion-b", "cupbearer"]) paintGuest(ctx, GUESTS.find((q) => q.id === id), state);
  flask(ctx, 312, 628, 12, C.lapis, 3);
  tray(ctx, 150, 642, 5, "mango", 4);
  for (const id of ["lute", "drummer"]) paintGuest(ctx, GUESTS.find((q) => q.id === id), state);
  canopyFront(ctx);
  peacock(ctx, 84, 654, 1.45);
  partridge(ctx, 410, 655, 1.5, 1, 1);
  partridge(ctx, 432, 658, 1.35, -1, 2);
  // the gardener, then the cypress and its vine in front of him
  paintGuest(ctx, GUESTS.find((q) => q.id === "gardener"), state);
  cypress(ctx, 470, 664, 482, 15, 5);
  vine(ctx, 470, 664, 482, 13, 6);
  paintFlowerBed(ctx);
  paintChannel(ctx);
  paintTitle(ctx);
  paintWalk(ctx);
  for (const x of JETS) jet(ctx, x);
  ctx.restore();
  paintAge(ctx);
}

function bakePage(stage, state) {
  const k = PAGE_PX * stage.s;
  const w = Math.round((PAGE.x1 - PAGE.x0) * k);
  const h = Math.round((PAGE.y1 - PAGE.y0) * k);
  return stage.bake2d(`mughal/page${state}/${k.toFixed(3)}`, w, h, (ctx) => {
    ctx.setTransform(k, 0, 0, k, -PAGE.x0 * k, -PAGE.y0 * k);
    paintPage(ctx, state);
  });
}

// ------------------------------------------------------------------ per frame
function paintTopView(stage, f, skel) {
  const pel = f.pelican;
  const x0 = Math.max(PIC.x0, pel.x - 80);
  const x1 = Math.min(PIC.x1, pel.x + 80);
  if (x1 <= x0) return;
  const patch = stage.patch("mughal/top", f.view, x0, CHANNEL.y0, x1, CHANNEL.y1);
  const ctx = patch.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, CHANNEL.y0, x1 - x0, CHANNEL.y1 - CHANNEL.y0);
  ctx.clip();
  const cool = {
    ...MC,
    white: "#eceff0",
    shade: "#cfd6da",
    bill: "#dcc154",
    pouch: "#dc9c48",
    leg: "#dca4a2",
    legDark: "#a87478",
    gold: "#c2a24a",
    goldLight: "#e2d4a0",
    goldDark: "#6e5a2a",
    red: "#b8473a",
  };
  paintBirdTop(ctx, skel, pel, (CHANNEL.y0 + CHANNEL.y1) / 2, { palette: cool });
  // the water lies over it lightly: a cool tint, and the ripple pattern crossing it
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = "rgba(120,150,175,0.1)";
  ctx.fillRect(x0, CHANNEL.y0, x1 - x0, CHANNEL.y1 - CHANNEL.y0);
  ripples(ctx, x0, x1, 0.26);
  ctx.restore();
  stage.imagePatch(patch);
}

function paintSideView(stage, f, skel) {
  const b = skel.bounds;
  const patch = stage.patch("mughal/pelican", f.view, b.x0 - 4, b.y0 - 4, b.x1 + 4, b.y1 + 4);
  const ctx = patch.ctx;
  // a faint cast shadow on the tiles
  ctx.fillStyle = "rgba(60,40,20,0.18)";
  ctx.beginPath();
  ctx.ellipse(f.pelican.x, f.pelican.y + 1.2, skel.scale * 2.4, skel.scale * 0.14, 0, 0, TAU);
  ctx.fill();
  paintBirdSide(ctx, skel, { halo: "rgba(250,244,228,0.55)", haloW: 0.035 }); // a hairline reserve
  stage.imagePatch(patch);
}

export const mughal = {
  ...META,
  // u, cx: the bill ends in the pier before the lady's arch, so no face is
  // crossed; the cupbearer, gardener and lady show their raised fingers; the
  // square's left edge falls in the gold between the two title reserves
  still: { u: 3.15, cx: 484 },

  init(stage) {
    bakePage(stage, 0);
    bakePage(stage, 1);
  },

  render(stage, f) {
    const state = f.u >= EVENT_U - 1e-6 ? 1 : 0;
    const page = bakePage(stage, state);
    stage.origin();
    stage.rect(0, 0, f.w, f.h, C.lapisDeep);
    stage.withView(f.view, () => {
      stage.image(page, PAGE.x0, PAGE.y0, PAGE.x1 - PAGE.x0, PAGE.y1 - PAGE.y0);
    });
    if (!f.pelican.visible) return;
    const skel = solveRig({ ...f.pelican });
    paintTopView(stage, f, skel);
    paintSideView(stage, f, skel);
  },
};
