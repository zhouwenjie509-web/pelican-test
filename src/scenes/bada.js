// Section 9. Bada Shanren expressive ink, c. 1690.
//
// Almost nothing on a sheet of raw xuan: a top-heavy rock hanging in from the
// top edge, one lotus stem with a broken leaf and a bud, one small fish in the
// blank that stands for water, an inscription with two red seals. The pelican
// is about twenty wet and dry strokes and rides beneath the rock, crossing
// nothing. In bar 2 it rolls its great eye up and back, holds it through the
// strong beat, and lets it down; the fish below answers.
//
// Layers (ink is painted on white sheets and multiplied onto the paper):
//   still sheet   baked once: wet strokes, bled; then dry strokes, the
//                 writing (on its own sheet, bled lightly) and the seals
//   pelican sheet per frame, only as large as the pelican, anchored to it:
//                 wet strokes, bled a little; then dry strokes on top
//   comp          per frame, full frame: still sheet, the fish's pupil and
//                 lid, then the pelican sheet

import { sectionMeta } from "./sections.js";
import { View } from "../kit/stage.js";
import { withPen } from "../kit/pen.js";
import { INK, GROUNDS, inkGround, inkBrush, blankSheet, layInk, bleedSheet } from "../kit/ink.js";
import { sprite, drawText, font } from "../kit/text.js";
import { solveRig } from "../rig/rig.js";
import { hash } from "../kit/rng.js";
import { lerp, smoothstep, smootherstep } from "../beat/ease.js";
import { PX_PER_UNIT, ZOOM_IN } from "../main/layout.js";

const META = sectionMeta(9);
const TAU = Math.PI * 2;

// raw xuan, a little whiter and less stained than the older sheets
const PAPER = { ...GROUNDS.xuan, base: "#f0eadb", shade: "#ddd3bc", stain: 0.1, mottle: 0.45, seed: 9 };
const T = { jiao: INK.jiao, nong: INK.nong, zhong: INK.zhong, dan: INK.dan, qing: INK.qing };
const SEAL = "#b12a1d";
const XINGKAI = "'Xingkai SC', 'STXingkai', 'Kaiti SC', 'STKaiti', serif";
const SERIF_IT = "'Hoefler Text', 'Baskerville', 'Palatino', serif";
const FIG_IT = "'Palatino', 'Baskerville', serif"; // lining figures for the year

const SHEET_PX = 3.3; // cached pixels per world unit at 1080p
const STILL = { x0: -70, y0: 412, x1: 1070, y1: 808 };

// ------------------------------------------------------------------ marks
// A painting is a list of marks. Each mark is one gesture of the brush and
// carries its own seed, so its texture is the same in every frame.
//   { t: "s", kind, tone, w, pts, seed }   a stroke (points may carry pressure)
//   { t: "w", tone, alpha, pts, seed }      a watercolour wash inside a polygon
class Marks {
  constructor(base) {
    this.base = base;
    this.ops = [];
  }

  s(kind, tone, w, pts, id, curv = 0.5) {
    this.ops.push({ t: "s", kind, tone, w, pts, curv, seed: this.base + id * 37 });
  }

  /**
   * A dry stroke as the brush makes it: loaded where it lands, running out
   * into flying white. A solid core that fades by two thirds of the way,
   * under the bristle streaks of the whole gesture.
   */
  sd(tone, w, pts, id, curv = 0.5, core = 0.5, load = 0.35, fade = 1 / 3, coreTone = null) {
    const n = pts.length;
    const run = 1 / fade; // the core runs out over `fade` of the stroke after `load`
    const corePts = pts.map((q, i) => {
      const t = i / Math.max(1, n - 1);
      const p0 = q.length > 2 ? q[2] : 1;
      const f = t < load ? 1 : Math.max(0.04, 1 - (t - load) * run);
      return [q[0], q[1], p0 * f];
    });
    const lighter = coreTone ?? { jiao: "nong", nong: "zhong", zhong: "dan", dan: "qing", qing: "qing" }[tone];
    this.ops.push({ t: "s", kind: "bone", tone: lighter, w: w * core, pts: corePts, curv, seed: this.base + id * 37 + 11 });
    this.ops.push({ t: "s", kind: w < 5 ? "drysoft" : "dry", tone, w, pts, curv, seed: this.base + id * 37 });
  }

  wash(tone, alpha, pts, id, opts = {}) {
    this.ops.push({ t: "w", tone, alpha, pts, opts, seed: this.base + id * 37 });
  }
}

const TONE_RANK = { qing: 0, dan: 1, zhong: 2, nong: 3, jiao: 4 };

/**
 * Paint marks: washes first, then strokes from light to dark, so p5.brush
 * composites once per tone and darker ink always lies over paler.
 */
function paintMarks(pen, stage, marks) {
  const washes = marks.ops.filter((o) => o.t === "w");
  const strokes = marks.ops.filter((o) => o.t === "s").sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]);
  pen.reset();
  for (const o of washes) {
    stage.reseed(o.seed);
    pen.noStroke().fill(T[o.tone], o.alpha, { bleed: o.opts.bleed ?? 0.16, texture: o.opts.texture ?? 0.5, border: o.opts.border ?? 0.45 });
    pen.polygon(o.pts);
  }
  pen.noFill();
  for (const o of strokes) {
    stage.reseed(o.seed);
    inkBrush(pen, o.kind, T[o.tone], o.w);
    if (o.pts.length === 2) pen.line(o.pts[0][0], o.pts[0][1], o.pts[1][0], o.pts[1][1]);
    else pen.spline(o.pts, o.curv);
  }
}

// ------------------------------------------------------------------ helpers
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, s) => [a[0] * s, a[1] * s];
const mixP = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / l, a[1] / l];
};
const rotV = (a, t) => [a[0] * Math.cos(t) - a[1] * Math.sin(t), a[0] * Math.sin(t) + a[1] * Math.cos(t)];
const jit = (seed, i, amp) => (hash(seed, i) - 0.5) * 2 * amp;
/** Points with a pressure profile p(t), t = 0..1 along the list. */
const press = (pts, prof) => pts.map((q, i) => [q[0], q[1], prof(i / Math.max(1, pts.length - 1))]);
/** Land heavy, carry, lift off. */
const LAND = (t) => (t < 0.12 ? 0.85 + 3 * t : 1.2 - 0.75 * t ** 1.6);
const shapeById = (skel, id) => skel.shapes.find((s) => s.id === id);

// ------------------------------------------------------------------ the still painting
function rockMarks(m) {
  // A top-heavy rock hanging in from the top edge at the upper left, so the
  // pelican rides in beneath it. Its contour is broken and angular: a few
  // loaded strokes that turn hard at the corners, overshoot or stop short and
  // run dry. Pale washes that do not quite meet them, axe-cut texture strokes
  // and rubs with the side of a half-dry brush, one burnt undercut, moss dots.
  // (x 18 - 246, y 418 - 553: nothing of it between y 560 and 705)
  m.wash("qing", 120, [[30, 422], [120, 420], [222, 424], [238, 448], [236, 494], [212, 518], [186, 536], [150, 532], [126, 544], [92, 524], [56, 490], [30, 464]], 1, { bleed: 0.3, texture: 0.75, border: 0.6 });
  // the shadow under the overhang, darker, in two facets
  m.wash("dan", 130, [[62, 494], [100, 506], [126, 520], [148, 516], [170, 522], [204, 508], [214, 520], [188, 540], [152, 535], [128, 549], [94, 528]], 2, { bleed: 0.35, texture: 0.7, border: 0.8 });
  m.wash("dan", 100, [[196, 428], [226, 426], [240, 452], [238, 488], [222, 476], [212, 452]], 3, { bleed: 0.3, texture: 0.7, border: 0.6 });
  const C = 0.15; // contour strokes turn hard at their corners
  // left flank: down from beyond the edge, a corner, then in under the rock
  m.sd("nong", 7.5, press([[20, 416], [24, 440], [27, 464], [44, 478], [56, 490]], (t) => (t < 0.12 ? 1.4 : 1.15 - 0.5 * t)), 6, C, 0.5, 0.5, 0.45);
  // the underside: burnt black where it lands, a nose, a notch, a second lobe
  m.s("bone", "jiao", 6.2, press([[60, 495], [88, 529], [112, 544], [128, 553]], (t) => (t < 0.15 ? 1.45 : 1.3 - 0.55 * t)), 10, C);
  m.s("bone", "jiao", 4.4, press([[134, 549], [148, 538], [162, 540]], (t) => (t < 0.2 ? 1.3 : 1.2 - 0.7 * t)), 7, C);
  m.s("bone", "nong", 5.4, press([[168, 541], [188, 543], [204, 530], [216, 520]], (t) => (t < 0.15 ? 1.35 : 1.15 - 0.75 * t)), 11, C);
  // right flank: up and out to the shoulder, a corner, back in to the edge
  m.sd("nong", 7, press([[224, 514], [238, 498], [244, 470], [234, 450]], (t) => (t < 0.12 ? 1.3 : 1.1 - 0.5 * t)), 8, C, 0.45, 0.45, 0.5);
  m.sd("zhong", 6, press([[238, 444], [228, 434], [232, 416]], (t) => 1.1 - 0.5 * t), 9, C, 0.45, 0.35, 0.6);
  // axe-cut texture strokes: short, straight, pressed and dragged off
  [
    [[30, 470], [62, 474], [96, 486], [118, 500]],
    [[150, 446], [158, 470], [154, 496]],
    [[238, 470], [214, 466], [196, 478]],
  ].forEach((pts, i) => m.sd(i === 1 ? "nong" : "zhong", 5, press(pts, (t) => (t < 0.15 ? 1.3 : 1.15 - 0.85 * t)), 12 + i, 0.1, 0.45, 0.25, 0.45));
  // rubbed texture: the side of a nearly dry brush dragged across the face
  m.s("scumble", "dan", 9, press([[44, 432], [80, 440], [116, 436]], (t) => 1.05 - 0.6 * t), 16);
  m.s("scumble", "zhong", 7, press([[116, 506], [138, 512], [158, 506]], (t) => 1.1 - 0.7 * t), 17);
  m.s("dry", "dan", 7, press([[126, 428], [158, 438], [180, 432]], (t) => 1.05 - 0.75 * t), 18);
  m.s("scumble", "dan", 6, press([[196, 494], [210, 504], [214, 516]], (t) => 1 - 0.6 * t), 19);
  // moss dots, in clusters on the shoulder and the left flank, one at the nose
  [[236, 460, 5], [241, 472, 3.4], [229, 452, 3], [26, 452, 4.6], [32, 462, 3.2], [122, 550, 4.4]].forEach(([x, y, w], i) => {
    const a = -0.5 + jit(31, i, 0.7);
    m.s("dab", "jiao", w, [[x, y], [x + Math.cos(a) * w * 0.35, y + Math.sin(a) * w * 0.35]], 20 + i);
  });
}

function lotusMarks(m) {
  // the stem, down from beyond the top edge and curving left into the leaf
  const ATT = [784, 508]; // where the stem meets the leaf: every vein starts here
  m.sd("nong", 4.2, press([[874, 396], [868, 440], [853, 474], [826, 496], [800, 505], ATT], (t) => 1.05 - 0.2 * t), 40, 0.4, 0.55);
  // thorn dots on the stem
  [[871, 430], [863, 455], [849, 478], [830, 492], [811, 502]].forEach(([x, y], i) => {
    const a = (i % 2 ? 0.3 : 3.4) + jit(41, i, 0.3);
    m.s("dab", "jiao", 1.9, [[x, y], [x + Math.cos(a) * 1.4, y + Math.sin(a) * 1.4]], 41 + i);
  });
  // the broken leaf, one torn form: a pale wash over the whole of it, then
  // wet ink laid from the stem leftwards with the side of the brush, darkest
  // at the far side and running paler towards the stem, so the dark half
  // flows into the pale one; veins drawn into it while still wet
  m.wash("dan", 135, [[704, 512], [714, 494], [731, 488], [746, 480], [762, 486], [779, 482], [796, 487], [808, 480], [822, 486], [818, 497], [833, 503], [826, 512], [836, 524], [823, 531], [828, 546], [812, 545], [806, 557], [792, 551], [778, 556], [760, 552], [744, 559], [726, 551], [712, 544], [703, 529]], 50, { bleed: 0.4, texture: 0.6, border: 0.75 });
  m.wash("zhong", 150, [[708, 516], [718, 498], [736, 492], [756, 490], [772, 495], [784, 506], [776, 520], [770, 538], [752, 546], [736, 552], [720, 545], [709, 531]], 60, { bleed: 0.45, texture: 0.5, border: 0.6 });
  m.wash("nong", 175, [[710, 518], [720, 502], [736, 496], [752, 497], [760, 508], [756, 524], [748, 538], [734, 546], [719, 541], [711, 530]], 61, { bleed: 0.5, texture: 0.45, border: 0.7 });
  // three broad wet strokes fanning from the stem to the far side, heavier as they go
  m.s("wet", "zhong", 17, press([[780, 506], [756, 497], [726, 500]], (t) => 0.6 + 0.6 * t), 51);
  m.s("wet", "nong", 19, press([[778, 510], [752, 518], [722, 524]], (t) => 0.55 + 0.7 * t), 58);
  m.s("wet", "nong", 15, press([[778, 514], [760, 532], [738, 543]], (t) => 0.5 + 0.7 * t), 59);
  // a pale wet stroke the other way, into the light half
  m.s("wet", "dan", 14, press([[790, 510], [808, 504], [824, 500]], (t) => 1.0 - 0.5 * t), 52);
  m.s("wet", "dan", 12, press([[790, 514], [806, 528], [816, 542]], (t) => 1.0 - 0.5 * t), 53);
  // the rolled rim at the far edge, burnt black
  m.s("bone", "jiao", 5.5, press([[716, 550], [740, 557], [766, 551]], (t) => 1.15 - 0.6 * t), 54);
  m.s("bone", "jiao", 3.2, press([[706, 526], [708, 512], [718, 499]], (t) => 1.1 - 0.7 * t), 55);
  // veins, quick and dry, every one from the stem, lifting off before the edge
  [
    [[ATT[0] - 20, 501], [ATT[0] - 44, 498], "nong", 1.6],
    [[ATT[0] - 24, 515], [ATT[0] - 52, 522], "nong", 1.7],
    [[ATT[0] - 12, 528], [ATT[0] - 26, 542], "nong", 1.4],
    [[ATT[0] + 13, 499], [ATT[0] + 28, 492], "zhong", 1.2],
    [[ATT[0] + 12, 520], [ATT[0] + 26, 532], "zhong", 1.2],
  ].forEach(([mid, end, tone, w], i) => {
    const st = add(ATT, mul(norm(sub(mid, ATT)), 2.5));
    m.s("bone", tone, w, press([st, mid, end], (t) => 1.0 - 0.9 * t ** 0.8), 62 + i);
  });
  // the bud on its shorter stem: a pointed ovoid in two strokes, a pale wash between
  m.sd("zhong", 3.2, press([[918, 398], [914, 430], [906, 460], [899, 481]], (t) => 1 - 0.2 * t), 66);
  m.wash("qing", 150, [[899, 483], [905, 494], [903, 507], [893, 520], [884, 509], [889, 494]], 67, { bleed: 0.3, texture: 0.4, border: 0.5 });
  m.s("leaf", "nong", 2.6, press([[897, 483], [889, 494], [887, 508], [892, 521]], (t) => 1.0 + 0.3 * Math.sin(Math.PI * t) - 0.5 * t), 68, 0.5);
  m.s("leaf", "nong", 2.4, press([[901, 484], [906, 497], [902, 511], [892, 521]], (t) => 1.0 + 0.3 * Math.sin(Math.PI * t) - 0.5 * t), 69, 0.5);
}

// The fish, facing left and a little up, in the blank that stands for water.
// The eye is large for the fish, as Bada paints them, so its answering roll
// reads at film size: a ring about 9.6 units across, a pupil about 3.2.
const FISH = { eye: [565.5, 746], r: 4.8 };
function fishMarks(m) {
  m.s("bone", "nong", 6.2, press([[573, 738.5], [583, 735.5], [596, 739], [606, 746]], (t) => 0.75 + 0.75 * Math.sin(Math.PI * (0.15 + 0.7 * t)) - 0.4 * t), 70);
  m.s("dab", "nong", 3.6, [[606, 746], [615, 739]], 72);
  m.s("dab", "nong", 3.4, [[606, 747], [616, 753.5]], 73);
  m.s("dab", "zhong", 2.4, [[585, 755], [589, 760]], 74);
  // the snout: one short touch that lands and lifts
  m.s("bone", "nong", 1.8, press([[555.5, 746.5], [556.5, 742.5], [560, 740]], LAND), 75);
  // the eye: one dry ring, heavy along the top, that stops short at the lower back
  const e = FISH.eye;
  const r = FISH.r;
  m.s("bone", "jiao", 1.9, press([[e[0] + r * 0.95, e[1] + r * 0.15], [e[0] + r * 0.85, e[1] - r * 0.9], [e[0] - r * 0.1, e[1] - r * 1.02], [e[0] - r * 0.95, e[1] - r * 0.8], [e[0] - r * 1.05, e[1] + r * 0.4], [e[0] - r * 0.55, e[1] + r * 1.0], [e[0] + r * 0.35, e[1] + r * 1.02]], (t) => (t < 0.45 ? 1.3 - 0.3 * t : 1.15 - 0.4 * t)), 76, 0.3);
  // the gill, one quick curve behind the eye, and the belly: a pale dry
  // stroke that runs out, so the belly itself stays paper
  m.s("bone", "zhong", 1.4, press([[577.5, 740.5], [579.5, 747], [577, 753.5]], (t) => 1.05 - 0.6 * t), 77, 0.5);
  m.sd("dan", 3, press([[561, 752.5], [574, 757.5], [590, 758], [603, 751.5]], (t) => (t < 0.1 ? 1.1 : 1.0 - 0.55 * t)), 71, 0.4, 0.3, 0.3, 0.6, "dan");
}

function groundMarks(m) {
  // three quick passes of a nearly dry brush, each landing and running out
  m.s("dry", "dan", 7, press([[392, 707.5], [424, 705.6], [452, 706.2]], (t) => (t < 0.12 ? 1.15 : 1.05 - 0.8 * t)), 80);
  m.s("dry", "qing", 8, press([[508, 711], [532, 709.8], [550, 710.6]], (t) => 1.05 - 0.8 * t), 81);
  m.s("dry", "dan", 5, press([[592, 705.8], [606, 705.1], [617, 706.2]], (t) => 1.1 - 0.85 * t), 82);
}

// ------------------------------------------------------------------ inscription
// Running script, read down, columns from the right: the title, the date with
// a brushed ring for the zero, the oval seal at the foot of the signature
// column, then the name and date across in Latin letters beneath, closed by
// the square seal. The writing goes through the ink sheet and bleeds a
// little; the seal paste does not. Kept above the pelican's head.
const INSCR = { x: 316, y: 436, w: 164, h: 124 };
const PAPER_HEX = "#f2ece0";

/**
 * One character written with the brush: a tone of its own, and where the
 * brush ran dry, streaks of paper through it along the direction of writing.
 */
function writeGlyph(ctx, ch, x, y, size, g) {
  drawText(ctx, ch, x, y, { font: font(XINGKAI, size, 700), align: "center", baseline: "top", fill: g.fill });
  if (!g.dry) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - size * 0.6, y + size * g.dry[0], size * 1.2, size * (g.dry[1] - g.dry[0]));
  ctx.clip();
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineCap = "round";
  // flying white: fine hair-gaps in short bundles, each bundle running one way
  // (down a vertical stroke or along a horizontal one), not a regular hatch
  const bundles = 5;
  for (let b = 0; b < bundles; b += 1) {
    const vert = hash(g.seed + 9, b) < 0.45;
    const bx = x + size * (hash(g.seed + 5, b) - 0.5) * 0.8;
    const by = y + size * lerp(g.dry[0], g.dry[1], hash(g.seed + 6, b));
    const len = size * (0.18 + 0.3 * hash(g.seed + 7, b));
    const ang = (vert ? Math.PI / 2 : 0) + (hash(g.seed + 8, b) - 0.5) * 0.5;
    const d = [Math.cos(ang), Math.sin(ang)];
    const nrm = [-d[1], d[0]];
    for (let i = 0; i < 5; i += 1) {
      const off = (i - 2) * size * 0.022 + (hash(g.seed + 10 + b, i) - 0.5) * size * 0.015;
      const s0 = hash(g.seed + 20 + b, i) * len * 0.35;
      const s1 = len * (0.55 + 0.45 * hash(g.seed + 30 + b, i));
      ctx.globalAlpha = 0.45 + 0.5 * hash(g.seed + 40 + b, i);
      ctx.lineWidth = size * (0.008 + 0.014 * hash(g.seed + 50 + b, i));
      ctx.beginPath();
      ctx.moveTo(bx + d[0] * s0 + nrm[0] * off, by + d[1] * s0 + nrm[1] * off);
      ctx.lineTo(bx + d[0] * s1 + nrm[0] * off, by + d[1] * s1 + nrm[1] * off);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** The zero as the brush writes it: one ring, heavy where it lands, left open. */
function brushRing(ctx, cx, cy, r, fill) {
  ctx.save();
  ctx.strokeStyle = fill;
  ctx.lineCap = "round";
  const a0 = -2.1;
  const sweep = TAU * 0.86;
  const n = 26;
  for (let i = 0; i < n; i += 1) {
    const t0 = i / n;
    const t1 = (i + 1.4) / n;
    const w = r * (t0 < 0.12 ? 0.42 + 0.8 * t0 : 0.52 - 0.45 * t0);
    const rr = (t) => r * (1 + 0.06 * Math.sin(t * 9 + 1) - 0.08 * t);
    ctx.lineWidth = Math.max(0.25, w);
    ctx.globalAlpha = t0 > 0.7 ? 1 - (t0 - 0.7) * 1.6 : 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rr(t0) * 0.92, rr(t0), 0, a0 + sweep * t0, a0 + sweep * Math.min(1, t1));
    ctx.stroke();
  }
  ctx.restore();
}

/** The ink of the inscription: characters, the ring and the Latin lines. */
function inscriptionInk(stage, k) {
  return sprite(stage, `bada/inscr-ink/${k.toFixed(3)}`, Math.ceil(INSCR.w * k), Math.ceil(INSCR.h * k), (ctx) => {
    ctx.scale(k, k);
    ctx.translate(-INSCR.x, -INSCR.y);
    // tones from burnt black to a greyer ink as the brush empties, then reloaded
    const JIAO = "#121110";
    const NONG = "#1d1b19";
    const GREY = "#3a3733";
    // 八大山人 : the signature column, at the right
    const sig = [
      ["八", JIAO, null],
      ["大", NONG, null],
      ["山", NONG, [0.45, 1.0]],
      ["人", GREY, [0.2, 1.0]],
    ];
    let yy = 446;
    sig.forEach(([ch, fill, dry], i) => {
      writeGlyph(ctx, ch, 456 + [0, 1, -1, 1][i], yy, 24, { fill, dry, seed: 400 + i * 7 });
      yy += 24 * 0.9;
    });
    // 写意 : reloaded, dark, running dry in the last stroke
    writeGlyph(ctx, "写", 429, 450, 24, { fill: JIAO, dry: null, seed: 440 });
    writeGlyph(ctx, "意", 427, 450 + 24 * 0.95, 24, { fill: NONG, dry: [0.55, 1.0], seed: 447 });
    // 约一六九〇年 : smaller, quicker, greyer
    const date = [...META.date.replace(/\s/g, "").replace("1690", "一六九〇")];
    let dy = 452;
    date.forEach((ch, i) => {
      const x = 402 + [0, 0.5, -0.4, 0, 0.6, 0][i % 6];
      const fill = i % 3 === 2 ? GREY : NONG;
      if (ch === "〇") brushRing(ctx, x, dy + 6, 4.3, fill);
      else writeGlyph(ctx, ch, x, dy, 12, { fill, dry: i === 3 ? [0.4, 1] : null, seed: 460 + i * 5 });
      dy += 12;
    });
    // the name and the date across, beneath the columns
    // (the year's figures in a face whose figures line: the italic's own sit low;
    // the name a shade smaller so it stays inside the writing's sheet, x >= 316)
    const it = font(SERIF_IT, 12.2, 400, "italic");
    const fig = font(FIG_IT, 12.2, 400, "italic");
    drawText(ctx, META.en, 446, 539, { font: font(SERIF_IT, 11.8, 400, "italic"), align: "right", fill: NONG, spacing: -0.14 });
    let xr = 430;
    for (const part of META.dateEn.split(/(\d+)/).filter((s) => s.length).reverse()) {
      xr -= drawText(ctx, part, xr, 552, { font: /^\d+$/.test(part) ? fig : it, align: "right", fill: NONG });
    }
  });
}

/** The seals, red paste pressed on top: the oval at the foot of the signature, the square closing the Latin lines. */
function inscriptionSeals(stage, k) {
  return sprite(stage, `bada/inscr-seal/${k.toFixed(3)}`, Math.ceil(INSCR.w * k), Math.ceil(INSCR.h * k), (ctx) => {
    ctx.scale(k, k);
    ctx.translate(-INSCR.x, -INSCR.y);
    const KAI = "'Kaiti SC', 'STKaiti', serif";
    // oval seal, red characters on paper (朱文): a hand-cut rim that wanders
    const OV = [457, 545.5];
    ctx.save();
    ctx.translate(OV[0], OV[1]);
    const oval = (rx, ry, seed, amp) => {
      ctx.beginPath();
      for (let i = 0; i < 36; i += 1) {
        const a = (i / 36) * TAU;
        const r = 1 + (hash(seed, i) - 0.5) * amp;
        ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * rx * r, Math.sin(a) * ry * r);
      }
      ctx.closePath();
      ctx.fill();
    };
    ctx.fillStyle = SEAL;
    oval(5.4, 8.2, 87, 0.05);
    ctx.fillStyle = PAPER_HEX;
    oval(4.4, 7.2, 88, 0.07);
    drawText(ctx, "八", 0, -6.6, { font: font(KAI, 6.2, 700), align: "center", baseline: "top", fill: SEAL });
    drawText(ctx, "大", 0, -0.2, { font: font(KAI, 6.2, 700), align: "center", baseline: "top", fill: SEAL });
    ctx.restore();
    // square name seal, characters left as paper (白文)
    const SQ = [433, 542, 12];
    ctx.fillStyle = SEAL;
    ctx.fillRect(SQ[0], SQ[1], SQ[2], SQ[2]);
    drawText(ctx, "鹈", SQ[0] + 6, SQ[1] + 0.6, { font: font(KAI, 5.6, 700), align: "center", baseline: "top", fill: PAPER_HEX });
    drawText(ctx, "鹕", SQ[0] + 6, SQ[1] + 6, { font: font(KAI, 5.6, 700), align: "center", baseline: "top", fill: PAPER_HEX });
    // seal paste does not take evenly: worn specks
    ctx.fillStyle = PAPER_HEX;
    for (let i = 0; i < 46; i += 1) {
      const sx = i < 24 ? SQ[0] + hash(91, i) * SQ[2] : OV[0] + (hash(92, i) - 0.5) * 10;
      const sy = i < 24 ? SQ[1] + hash(93, i) * SQ[2] : OV[1] + (hash(94, i) - 0.5) * 15;
      ctx.globalAlpha = 0.35 + 0.5 * hash(95, i);
      ctx.fillRect(sx, sy, 0.35 + 0.5 * hash(96, i), 0.35 + 0.4 * hash(97, i));
    }
    ctx.globalAlpha = 1;
  });
}

// ------------------------------------------------------------------ bakes
function stillDims(stage) {
  const k = SHEET_PX * stage.s;
  return { k, w: Math.round((STILL.x1 - STILL.x0) * k), h: Math.round((STILL.y1 - STILL.y0) * k) };
}

function bakeStill(stage) {
  const { k, w, h } = stillDims(stage);
  const key = `bada/still/${k.toFixed(4)}`;
  if (stage.isBaked(key)) return stage.bake(key, w, h, () => {});
  const view = new View(k, -STILL.x0 * k, -STILL.y0 * k);
  const split = (m) => {
    const wet = new Marks(0);
    const dry = new Marks(0);
    for (const o of m.ops) (o.t === "w" || o.kind === "wet" || o.kind === "bone" || o.kind === "dab" ? wet : dry).ops.push(o);
    return [wet, dry];
  };
  const all = new Marks(9100);
  rockMarks(all);
  lotusMarks(all);
  fishMarks(all);
  groundMarks(all);
  const [wet, dry] = split(all);
  // 1. wet ink on a blank sheet
  const rawKey = `bada/still-raw/${k.toFixed(4)}`;
  const raw = stage.bake(rawKey, w, h, () => {
    blankSheet(stage);
    stage.seed(9000);
    withPen(stage, view, (pen) => paintMarks(pen, stage, wet));
  });
  // 2. the writing on a sheet of its own, so it bleeds only a little
  const iw = Math.ceil(INSCR.w * k);
  const ih = Math.ceil(INSCR.h * k);
  const insKey = `bada/inscr-raw/${k.toFixed(4)}`;
  const insRaw = stage.bake(insKey, iw, ih, () => {
    blankSheet(stage);
    stage.withView(new View(k, -INSCR.x * k, -INSCR.y * k), () => stage.image(inscriptionInk(stage, k), INSCR.x, INSCR.y, INSCR.w, INSCR.h));
  });
  const insBledKey = `bada/inscr-bled/${k.toFixed(4)}`;
  const insBled = stage.bake(insBledKey, iw, ih, () => {
    bleedSheet(stage, insRaw, { x0: INSCR.x, y0: INSCR.y, x1: INSCR.x + INSCR.w, y1: INSCR.y + INSCR.h }, { reach: 2.4 * stage.s * (SHEET_PX / 3.3), amount: 0.55 });
  });
  // 3. let the painting bleed into the fibres, then the dry brush, the writing and the seals on top
  const out = stage.bake(key, w, h, () => {
    bleedSheet(stage, raw, STILL, { reach: 7 * stage.s * (SHEET_PX / 3.3), amount: 0.85 });
    stage.seed(9050);
    withPen(stage, view, (pen) => paintMarks(pen, stage, dry));
    stage.blend(stage.p.MULTIPLY, () => stage.withView(view, () => stage.image(insBled, INSCR.x, INSCR.y, INSCR.w, INSCR.h)));
    stage.withView(view, () => stage.image(inscriptionSeals(stage, k), INSCR.x, INSCR.y, INSCR.w, INSCR.h));
  });
  stage.drop(rawKey);
  stage.drop(insKey);
  stage.drop(insBledKey);
  return out;
}

/** The fish's pupil: one black touch, painted once and stamped where the eye looks. */
const PUPIL_R = 4;
function bakePupil(stage, k) {
  const R = PUPIL_R;
  const n = Math.max(8, Math.round(R * 2 * k));
  return stage.bake(`bada/fishpupil2/${n}`, n, n, () => {
    blankSheet(stage);
    stage.seed(9300);
    const view = new View(n / (2 * R), R * (n / (2 * R)), R * (n / (2 * R)));
    withPen(stage, view, (pen) => {
      inkBrush(pen, "dab", T.jiao, 6.6);
      pen.line(-0.35, -0.2, 0.35, 0.2);
    });
  });
}

/** The fish's lid: one short heavy touch that comes down over the top of the eye. */
const FISH_LID = { w: 12, h: 5 };
function bakeFishLid(stage, k) {
  const n = Math.max(8, Math.round(FISH_LID.w * k));
  const m = Math.max(4, Math.round(FISH_LID.h * k));
  return stage.bake(`bada/fishlid/${n}x${m}`, n, m, () => {
    blankSheet(stage);
    stage.seed(9310);
    const kk = n / FISH_LID.w;
    const view = new View(kk, (FISH_LID.w / 2) * kk, (FISH_LID.h / 2) * kk);
    withPen(stage, view, (pen) => {
      inkBrush(pen, "bone", T.jiao, 1.9);
      pen.spline([[-4.6, 0.6, 1.1], [-1.5, -0.5, 1.35], [2.0, -0.4, 1.0], [4.3, 0.5, 0.45]], 0.5);
    });
  });
}

// ------------------------------------------------------------------ timing
/** The eye roll: 0 at rest, 1 rolled up and back. */
function rollAt(u) {
  return smootherstep(2.0, 2.6, u) * (1 - smootherstep(3.6, 4.0, u));
}
/** Separate easings so the pupil goes up first, then back. */
function rollXY(u) {
  const up = smoothstep(2.0, 2.4, u) * (1 - smoothstep(3.7, 4.0, u));
  const back = smoothstep(2.12, 2.6, u) * (1 - smoothstep(3.6, 3.92, u));
  return { up, back };
}
function fishRoll(u) {
  return smootherstep(3.2, 3.8, u) * (1 - smootherstep(4.7, 5.1, u));
}

// ------------------------------------------------------------------ the pelican
const EYE_R = 10; // half-width of the great eye, world units

function pelicanMarks(skel, pel, u) {
  const j = skel.joints;
  const S = skel.scale;
  const wet = new Marks(9500);
  const dry = new Marks(9700);
  const roll = rollAt(u);
  const { up, back } = rollXY(u);

  // ---- body: the back in one wet stroke, landed heavy at the tail and
  // carried forward until it lifts off before the breast; the breast and belly
  // are paper, closed by one pale broken line
  const tilt = skel.bodyTilt;
  const bl = (a, b) => add(j.body, rotV([a * S, -b * S], -tilt)); // body-local (y up) to screen
  const axis = [[-1.3, 0.16], [-0.62, 0.22], [0.12, 0.16], [0.7, 0.1], [1.08, 0.04]].map(([a, b]) => bl(a, b));
  wet.s("wet", "nong", 1.2 * S, press(axis, (t) => 1.2 - 0.95 * t ** 1.2), 1);
  // the wet pool of that stroke: a pale wash over the back two thirds, its
  // edge darkened where the ink gathered
  const pool = [];
  for (let i = 0; i <= 12; i += 1) {
    const a = lerp(0.55, 5.3, i / 12);
    const rr = 0.86 + jit(310, i, 0.07);
    pool.push(bl(-0.18 + Math.cos(a) * 1.08 * rr, 0.06 + Math.sin(a) * 0.72 * rr));
  }
  wet.wash("zhong", 215, pool, 22, { bleed: 0.42, texture: 0.3, border: 0.55 });
  const backPts = [[-1.25, 0.3], [-0.8, 0.6], [-0.2, 0.74], [0.35, 0.7]].map(([a, b]) => bl(a, b));
  wet.s("bone", "dan", 0.3 * S, press(backPts, (t) => 1.2 - 1.05 * t ** 1.2), 21);
  const bellyPts = [[1.28, 0.22], [1.12, -0.42], [0.62, -0.84], [-0.1, -0.92], [-0.72, -0.72]].map(([a, b]) => bl(a, b));
  wet.s("bone", "zhong", 2.2, press(bellyPts, (t) => (t < 0.1 ? 1.2 : 1.1 - 0.9 * t)), 2);

  // ---- wing: darker, one loaded stroke from the shoulder back past the tail,
  // and a thinner one down to the hand on the grip
  const tip0 = shapeById(skel, "wingTip0");
  const fold = shapeById(skel, "wingFold");
  const tipEnd = tip0 ? tip0.pts.reduce((best, q) => (Math.hypot(q[0] - j.shoulder[0], q[1] - j.shoulder[1]) > Math.hypot(best[0] - j.shoulder[0], best[1] - j.shoulder[1]) ? q : best), tip0.pts[0]) : j.tailRoot;
  const wingPts = fold ? [...fold.pts, tipEnd] : [j.shoulder, tipEnd];
  wet.s("bone", "jiao", 0.42 * S, press(wingPts, (t) => (t < 0.12 ? 1.05 + 1.5 * t : 1.25 - 1.0 * t ** 1.2)), 3);
  wet.s("bone", "zhong", 2, press([bl(0.86, 0.02), mixP(bl(0.86, 0.02), j.wingTip, 0.5), j.wingTip], (t) => 1.05 - 0.75 * t), 4);

  // ---- tail: three flicks
  skel.shapes
    .filter((s) => s.tag === "tail")
    .forEach((s, i) => {
      const root = j.tailRoot;
      const tip = s.pts.reduce((best, q) => (Math.hypot(q[0] - root[0], q[1] - root[1]) > Math.hypot(best[0] - root[0], best[1] - root[1]) ? q : best), s.pts[0]);
      const tt = mixP(root, tip, 1.25);
      const mid = add(mixP(root, tt, 0.5), [0, -0.6 + i * 0.4]);
      // one flick each: pressed at the root, lifted off into a hair at the tip
      dry.s("bone", i === 1 ? "jiao" : "nong", 2.6 - Math.abs(i - 1) * 0.5, press([add(root, [1.5, 0]), mid, tt], (t) => (t < 0.15 ? 1.3 : 1.2 - 1.0 * t)), 5 + i);
    });

  // ---- neck: one loaded curve from the shoulder, lifting off over the crown
  const nl = skel.neckLine;
  const neckBack = nl.map((q, i) => {
    const a = nl[Math.max(0, i - 1)];
    const b = nl[Math.min(nl.length - 1, i + 1)];
    const t = norm(sub(b, a));
    const nrm = [t[1], -t[0]]; // left of travel = back of the neck
    const off = lerp(0.2, 0.12, i / (nl.length - 1)) * S;
    return add(q, mul(nrm, off));
  });
  const hc = j.head;
  // the stroke runs on over the back of the head and lifts off over the crown,
  // so head, neck and body are one gesture
  const hp = -0.12 * rollAt(u);
  // (kept clear of the eye, so the pupil never sinks into it)
  const crown = [add(hc, rotV([-0.86 * S, 0.24 * S], hp)), add(hc, rotV([-0.96 * S, -0.3 * S], hp)), add(hc, rotV([-0.7 * S, -0.82 * S], hp))];
  const neckPts = [mixP(neckBack[0], j.body, 0.25), neckBack[4], neckBack[8], neckBack[12], ...crown];
  wet.s("bone", "nong", 3.6, press(neckPts, (t) => (t < 0.08 ? 1.4 : t < 0.62 ? 1.25 - 0.5 * t : 0.94 - 2.0 * (t - 0.62))), 8);
  // the front of the neck, a pale dry touch where it meets the pouch
  const nf = nl.map((q, i) => {
    const a = nl[Math.max(0, i - 1)];
    const b = nl[Math.min(nl.length - 1, i + 1)];
    const t = norm(sub(b, a));
    return add(q, mul([-t[1], t[0]], lerp(0.24, 0.14, i / (nl.length - 1)) * S));
  });
  wet.s("bone", "dan", 1.5, press([nf[4], nf[9], nf[14]], (t) => 0.9 - 0.7 * t), 9);
  // crest: one quick flick back off the crown
  dry.s("bone", "zhong", 1.5, press([add(hc, rotV([-0.72 * S, -0.8 * S], hp)), add(hc, rotV([-0.98 * S, -0.9 * S], hp)), add(hc, rotV([-1.2 * S, -0.86 * S], hp))], (t) => 1.05 - 0.95 * t), 10);

  // ---- bill: two dry strokes that press at the base and break into flying
  // white towards the tip; the pouch a single pale wet touch between, no outline
  const up_ = shapeById(skel, "billUpper").pts;
  const lo = shapeById(skel, "billLower").pts;
  const pouch = shapeById(skel, "pouch").pts;
  wet.wash("zhong", 215, pouch, 23, { bleed: 0.4, texture: 0.3, border: 0.6 });
  const BILL = (t) => (t < 0.08 ? 1.45 : 1.4 - 0.95 * t ** 0.8);
  dry.sd("jiao", 5.2, press([up_[0], up_[1], up_[2], up_[3], up_[4], up_[5], up_[6]], BILL), 12, 0.35, 0.55, 0.12, 0.42, "jiao");
  // the lower stroke runs out before the tip
  const loEnd = mixP(lo[1], lo[2], 0.7);
  dry.sd("nong", 3.2, press([lo[0], mixP(lo[0], lo[1], 0.5), lo[1], loEnd], (t) => (t < 0.1 ? 1.3 : 1.25 - 1.0 * t)), 13, 0.4, 0.5, 0.08, 0.45, "nong");

  // ---- the eye: one dry stroke, landed hard on the lid, thinning round the
  // front and the bottom and stopping short, so the ring stays open at the
  // lower back; a heavy round pupil. The lid comes down as it rolls.
  const pitch = -0.12 * roll; // screen rotation: looking up is counter-clockwise
  const ec = add(hc, rotV([-0.27 * S, -0.22 * S], pitch)); // behind the bill base
  const E = (x, y) => add(ec, rotV([x, y], pitch));
  const R = EYE_R;
  // the lid lowers only a little as the eye rolls: a heavy lid turns the eye into a dark bar
  const lid = 2 * R * 0.1 * roll;
  const top = -R * 0.84 + lid;
  // a squarish ring (a superellipse), from just below the back corner up
  // over the lid, round the front and the bottom, stopping short of the start
  const sq = (c) => Math.sign(c) * Math.abs(c) ** 0.7;
  const ringLocal = [];
  for (let i = 0; i <= 12; i += 1) {
    const th = lerp(Math.PI - 0.22, 2.5 * Math.PI + 0.5, i / 12);
    const x = R * sq(Math.cos(th)) * (1 + jit(150, i, 0.04));
    const y = R * 0.96 * sq(Math.sin(th)) * (1 + jit(151, i, 0.04));
    ringLocal.push([x, Math.max(y, top + Math.abs(x) * 0.08)]);
  }
  const ringPts = ringLocal.map(([x, y]) => E(x, y));
  // landed hard on the lid, thinning round the front and the bottom
  dry.s("bone", "jiao", 3.1, press(ringPts, (t) => (t < 0.06 ? 1.15 + 5 * t : t < 0.4 ? 1.45 - 0.25 * t : 1.35 - 1.0 * t)), 15, 0.5);
  // where the ink runs out the hairs part: flying white over the last of it
  dry.s("dry", "nong", 4, press(ringPts.slice(6), (t) => 1.0 - 0.6 * t), 151, 0.5);
  // pupil: high and forward at rest, jammed into the upper back corner when rolled
  const pr = lerp(4.3, 3.4, up); // a smaller dot when rolled, so more white shows beneath it
  const restP = [R * 0.3, -R * 0.18];
  const rollP = [-R * 0.42, top + pr * 0.82];
  const pp = [lerp(restP[0], rollP[0], back), lerp(restP[1], rollP[1], up)];
  const pc = E(pp[0], pp[1]);
  dry.s("dab", "jiao", pr * 2.05, [add(pc, [-0.45, -0.25]), add(pc, [0.45, 0.25])], 16);

  // ---- legs and feet: thin strokes and a touch each
  dry.s("bone", "zhong", 1.6, press([j.hip, j.kneeFar, j.ankleFar], (t) => 0.9 - 0.4 * t), 17);
  wet.s("bone", "nong", 2.3, press([j.hip, j.kneeNear, j.ankleNear], (t) => 1 - 0.35 * t), 18);
  const footDir = (side) => {
    const f = shapeById(skel, side === "near" ? "footNear" : "footFar").pts;
    return norm(sub(f[2], f[0]));
  };
  const fN = footDir("near");
  const fF = footDir("far");
  dry.s("dab", "zhong", 3, [j.ankleFar, add(j.ankleFar, mul(fF, 0.55 * S))], 19);
  dry.s("dab", "nong", 3.6, [j.ankleNear, add(j.ankleNear, mul(fN, 0.62 * S))], 20);

  // ---- bicycle: each wheel one swift ring that lands heavy, thins, breaks
  // into flying white and stops well short of closing; three tapered spokes
  // that turn; the frame in four dry strokes of uneven pressure; hub dots
  [
    [j.rear, 0],
    [j.front, 1],
  ].forEach(([c, wi]) => {
    const a0 = pel.wheel + 0.6 + wi * 2.1;
    const SWEEP = 0.8; // of a full turn: the last fifth is left open
    const arc = (t0, t1, dr, n = 12) => {
      const out = [];
      for (let i = 0; i <= n; i += 1) {
        const t = lerp(t0, t1, i / n);
        const a = a0 + t * TAU * SWEEP;
        const r = S * (0.96 - 0.06 * t) + dr + jit(200 + wi, Math.round(t * 11), 0.45);
        out.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
      }
      return out;
    };
    const tone = wi ? "nong" : "jiao";
    // the loaded body: lands heavy, carries, and runs thin by three quarters
    dry.s("bone", tone, 3.0, press(arc(0, 0.78, 0), (t) => (t < 0.06 ? 1.2 + 3 * t : t < 0.35 ? 1.38 - 0.4 * t : 1.38 - 1.5 * (t - 0.12))), 30 + wi);
    // where the ink gives out the hairs part: flying white to the end of the gesture
    dry.s("dry", tone, 4.2, press(arc(0.5, 1, 0.2, 8), (t) => 1.0 - 0.75 * t), 33 + wi);
    for (let k = 0; k < 3; k += 1) {
      const a = pel.wheel + (k / 3) * TAU + wi * 0.5;
      const d = [Math.cos(a), Math.sin(a)];
      const n = [-d[1], d[0]];
      const bow = 0.7 * (k % 2 ? 1 : -1);
      // hair-thin, tapering out, lifting off short of the rim
      dry.s("bone", "dan", 0.75, press([add(c, mul(d, 0.14 * S)), add(add(c, mul(d, 0.48 * S)), mul(n, bow)), add(c, mul(d, 0.8 * S))], (t) => 0.85 - 0.6 * t), 40 + wi * 10 + k);
    }
    dry.s("dab", "jiao", 3.4, [add(c, [-0.5, -0.3]), add(c, [0.5, 0.3])], 60 + wi);
  });
  const id = (name) => shapeById(skel, name).pts;
  const top_ = id("topTube");
  const fork = id("fork");
  const down = id("downTube");
  const seat = id("seatTube");
  const chain = id("chainStay");
  const stay = id("seatStay");
  // a frame stroke: a loaded core whose pressure the hand varies, under the
  // dry hairs; it overshoots or stops short at the joints
  const over = (a, b, s0, s1) => [add(a, mul(sub(a, b), s0)), add(b, mul(sub(b, a), s1))];
  const fs = (tone, w, pts, prof, id_) => {
    dry.s("bone", tone, w * 0.55, press(pts, prof), id_ + 100, 0.5);
    dry.s("dry", tone, w, press(pts, (t) => prof(t) * 0.9), id_, 0.5);
  };
  // 1. top tube on into the fork, one bent gesture, pressed at the turn
  const [tt0, tt1] = over(top_[0], top_[1], 0.06, -0.04);
  fs("nong", 5.2, [tt0, mixP(tt0, tt1, 0.5), tt1, fork[0], fork[1], add(fork[2], mul(sub(fork[2], fork[1]), 0.08))], (t) => (t < 0.08 ? 1.25 : t < 0.5 ? 0.85 + 0.6 * (t - 0.08) : 1.1 - 1.0 * (t - 0.5)), 70);
  // 2. the down tube, one heavy downward drag that runs dry
  const [dt0, dt1] = over(down[0], down[1], -0.05, 0.08);
  fs("jiao", 5.8, [dt0, mixP(dt0, dt1, 0.45), dt1], (t) => (t < 0.1 ? 1.4 : 1.35 - 0.9 * t), 71);
  // 3. saddle down the seat tube and back along the chain stay, turned hard at the crank
  fs("nong", 4.8, [j.saddle, seat[1], seat[0], mixP(chain[0], chain[1], 0.5), mixP(chain[0], chain[1], 0.92)], (t) => (t < 0.1 ? 1.2 : t < 0.55 ? 0.95 : 1.2 - 1.0 * (t - 0.55)), 72);
  // 4. the seat stay, a thin quick flick that stops short
  dry.s("bone", "zhong", 1.6, press([stay[0], mixP(stay[0], stay[1], 0.5), mixP(stay[0], stay[1], 0.86)], (t) => 1.15 - 0.9 * t), 73);
  const stem = id("stem");
  const bar = id("bar");
  dry.s("bone", "nong", 2.2, press([stem[0], stem[2], bar[1], bar[2]], (t) => (t < 0.1 ? 1.3 : 1.15 - 0.75 * t)), 74);
  const sad = id("saddle");
  dry.s("dab", "jiao", 3.4, [sad[0], sad[3]], 75);
  dry.s("bone", "nong", 1.5, [j.bb, j.pedalNear], 76);
  dry.s("dab", "jiao", 2.2, [add(j.bb, [-0.5, 0]), add(j.bb, [0.5, 0])], 77);
  return { wet, dry };
}

/** The pelican's own sheet: a small rectangle fixed to its road point, so its texture rides with it. */
const PEL_BOX = { x0: -84, y0: -150, x1: 80, y1: 8 };

function paintPelicanSheet(stage, f, skel) {
  const pel = f.pelican;
  const k = Math.max(PX_PER_UNIT * ZOOM_IN * f.s, f.view.k);
  const w = Math.ceil((PEL_BOX.x1 - PEL_BOX.x0) * k);
  const h = Math.ceil((PEL_BOX.y1 - PEL_BOX.y0) * k);
  const x0 = pel.x + PEL_BOX.x0;
  const y0 = pel.y + PEL_BOX.y0;
  const view = new View(k, -x0 * k, -y0 * k);
  const { wet, dry } = pelicanMarks(skel, pel, f.u);
  const raw = stage.fb(`bada/pel-raw/${w}x${h}`, w, h);
  const bled = stage.fb(`bada/pel/${w}x${h}`, w, h);
  stage.into(raw, () => {
    blankSheet(stage);
    stage.seed(9400);
    withPen(stage, view, (pen) => paintMarks(pen, stage, wet));
  });
  stage.into(bled, () => {
    // bleed fingers anchored to the bird, not to the world
    bleedSheet(stage, raw, { x0: PEL_BOX.x0, y0: PEL_BOX.y0, x1: PEL_BOX.x1, y1: PEL_BOX.y1 }, { reach: 2.6 * (k / (SHEET_PX * f.s)) * f.s, amount: 0.6 });
    stage.seed(9600);
    withPen(stage, view, (pen) => paintMarks(pen, stage, dry));
  });
  return { tex: bled, x0, y0, w: PEL_BOX.x1 - PEL_BOX.x0, h: PEL_BOX.y1 - PEL_BOX.y0 };
}

// ------------------------------------------------------------------ the scene
export const bada = {
  ...META,
  still: { u: 3.0, cx: 488 }, // left edge 311.5: the whole Latin inscription (from x 318.6) is in the square, with a little air

  init(stage) {
    bakeStill(stage);
  },

  render(stage, f) {
    const view = f.view;
    const pel = f.pelican;
    const still = bakeStill(stage);

    stage.origin();
    inkGround(stage, view, PAPER);

    // the pelican first, on its own small sheet
    let skel = null;
    let sheet = null;
    if (pel.visible) {
      const roll = rollAt(f.u);
      skel = solveRig({ ...pel, act: { headPitch: 0.12 * roll } });
      sheet = paintPelicanSheet(stage, f, skel);
    }

    const comp = stage.fb(`bada/comp/${f.w}x${f.h}`, f.w, f.h);
    stage.into(comp, () => {
      blankSheet(stage);
      stage.withView(view, () => stage.image(still, STILL.x0, STILL.y0, STILL.x1 - STILL.x0, STILL.y1 - STILL.y0));
      // the fish's pupil: forward at rest; rolled hard into the upper back
      // corner (the fish faces left), with only white beneath
      const fr = fishRoll(f.u);
      const e = FISH.eye;
      const px = e[0] + lerp(-1.3, 2.0, smoothstep(0.1, 1, fr));
      const py = e[1] + lerp(0.7, -2.3, smoothstep(0, 0.8, fr));
      const pupil = bakePupil(stage, view.k);
      // no lid over the fish's eye: the pupil must stay a clear dot with white beneath it
      stage.blend(stage.p.MULTIPLY, () =>
        stage.withView(view, () => {
          stage.image(pupil, px - PUPIL_R, py - PUPIL_R, 2 * PUPIL_R, 2 * PUPIL_R);
        }),
      );
      if (sheet) stage.blend(stage.p.MULTIPLY, () => stage.withView(view, () => stage.image(sheet.tex, sheet.x0, sheet.y0, sheet.w, sheet.h)));
    });
    stage.origin();
    layInk(stage, comp, 0, 0, f.w, f.h);
  },
};
