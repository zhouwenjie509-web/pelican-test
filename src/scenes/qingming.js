// Section 6. Along the River During the Qingming Festival, c. 1100 CE: ink
// and light colour on silk, in homage to Zhang Zeduan's Rainbow Bridge
// passage, rebuilt in side view.
//
// Ruled-line architecture (界画): a timber arch bridge of lashed log bundles
// over the Bian, its deck crowded with townspeople, stalls at both ends, a
// river boat with its mast lowered coming through under the arch, willows on
// the far bank. The pelican rides up over the crown and down again, and in
// bar 2 every head on the bridge turns to follow it; the boat's crew stop and
// look up. A sleeper and a donkey do not.
//
// Everything that holds still (bank, water, bridge, boat, every body) is
// painted once on an ink sheet and multiplied onto the kit's silk. Each frame
// adds the heads (drawn on a small 2D sheet so they can turn), three pointing
// arms, the title slip, and the pelican, which is painted into its own buffer
// with the near railing cut out of it so the railing stays in front.

import { sectionMeta } from "./sections.js";
import { View } from "../kit/stage.js";
import { sampler, noise1, hash } from "../kit/rng.js";
import { withPen } from "../kit/pen.js";
import { INK, inkOn, inkBrush, inkGround, GROUNDS, blankSheet, layInk } from "../kit/ink.js";
import { sprite, drawText, font, FONTS } from "../kit/text.js";
import { solveRig } from "../rig/rig.js";
import { SPEED } from "../main/layout.js";
import { smoothstep, lerp, clamp, window4 } from "../beat/ease.js";

const META = sectionMeta(6);
const TAU = Math.PI * 2;

// ------------------------------------------------------------------ geometry
/** The bridge deck: level at 700, a smooth arch 80 units high between x = 130 and 870. */
export function road(x) {
  const d = x - 500;
  if (Math.abs(d) >= 370) return 700;
  const c = Math.cos((Math.PI * d) / 740);
  return 700 - 80 * c * c;
}

/** Centre line of the timber arch under the deck. */
const archY = (x) => 643 + 112 * ((x - 500) / 360) ** 2;
const ARCH_X0 = 140;
const ARCH_X1 = 860;
const ARCH_HALF = 7;

/** The painted world (with the bar-2 camera it can see y 380 .. 840). */
const R = { x0: -80, y0: 380, x1: 1080, y1: 840 };
const PX = 3.3; // sheet pixels per world unit at 1080p
/** The band the near railing and the near figures occupy (for the mask that keeps them in front of the pelican). */
const MASK = { x0: -80, y0: 560, x1: 1080, y1: 740 };

// thin colours, laid on the white sheet and multiplied onto the silk
const COL = {
  umber: "#9a7650",
  wood: "#a8865c",
  ochre: "#c29b50",
  indigo: "#7c8b97",
  slate: "#8d969c",
  red: "#a8634a",
  green: "#86936c",
  willow: "#9aab68",
  stone: "#97928a",
  mat: "#b49a62",
  skin: "#eadcc0",
  plain: "#ddd6c6",
};
const LINE = INK.zhong; // the ordinary fine line
const LINE_D = INK.nong; // structural lines
const LINE_F = INK.dan; // far things

// ------------------------------------------------------------------ the plate
// Marks are collected in layers (back to front) and painted layer by layer,
// grouped by colour so the brush changes ink as rarely as possible. A layer
// first clears its knockouts (ink cannot cover ink), then washes, then lines.
class Plate {
  constructor() {
    this.layers = [];
    this.layer();
  }

  layer() {
    this.cur = { knock: [], wash: [], strokes: [] };
    this.layers.push(this.cur);
    return this.cur;
  }

  knock(pts) {
    this.cur.knock.push(pts);
  }

  wash(pts, color, alpha = 110, opts = {}) {
    this.cur.wash.push({ pts, color, alpha, opts });
  }

  line(tone, w, x1, y1, x2, y2) {
    this.cur.strokes.push({ kind: "line", tone, w, pts: [[x1, y1], [x2, y2]], c: 0 });
  }

  path(tone, w, pts, c = 0.4, kind = "line") {
    if (pts.length < 2) return;
    this.cur.strokes.push({ kind, tone, w, pts, c });
  }

  /** Closed outline. */
  ring(tone, w, pts, c = 0.15) {
    this.cur.strokes.push({ kind: "line", tone, w, pts: [...pts, pts[0]], c });
  }

  /** Knockout + wash + outline for one shape. */
  shape(pts, color, alpha, tone, w = 0.5, opts = {}) {
    if (opts.knock !== false) this.knock(pts);
    if (color) this.wash(pts, color, alpha, opts);
    if (tone) this.ring(tone, w, pts, opts.c ?? 0.12);
  }

  paint(stage, pen) {
    const ink = inkOn(pen);
    let n = 0;
    for (const L of this.layers) {
      if (!L.knock.length && !L.wash.length && !L.strokes.length) continue;
      if (L.knock.length) {
        pen.noStroke().wash("#ffffff", 255);
        for (const k of L.knock) pen.polygon(k);
        pen.noWash();
      }
      const washes = [...L.wash].sort((a, b) => (a.color < b.color ? -1 : a.color > b.color ? 1 : a.alpha - b.alpha));
      for (const w of washes) {
        stage.reseed(7000 + n);
        n += 1;
        if (w.opts.flat) {
          pen.noStroke().wash(w.color, w.alpha);
          pen.polygon(w.pts);
          pen.noWash();
        } else {
          ink.wash(w.pts, w.color, w.alpha, { bleed: w.opts.bleed ?? 0.025, texture: w.opts.texture ?? 0.3, border: w.opts.border ?? 0.22 });
        }
      }
      if (L.wash.length) pen.flush();
      const order = [...L.strokes].sort((a, b) => (a.tone < b.tone ? 1 : a.tone > b.tone ? -1 : a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.w - b.w));
      for (const s of order) {
        if (n % 48 === 0) stage.reseed(7000 + n);
        n += 1;
        ink.stroke(s.kind, s.tone, s.w, s.pts, s.c);
      }
      pen.flush();
    }
  }
}

// ------------------------------------------------------------------ small helpers
/** A band around a polyline, as a closed polygon: widths per point. */
function capsule(pts, ws) {
  const n = pts.length;
  const L = [];
  const Rr = [];
  for (let i = 0; i < n; i += 1) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / len;
    const ny = (b[0] - a[0]) / len;
    const w = ws[i] / 2;
    L.push([pts[i][0] + nx * w, pts[i][1] + ny * w]);
    Rr.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
  }
  // rounded ends
  const end = (p, q, w) => {
    const len = Math.hypot(p[0] - q[0], p[1] - q[1]) || 1;
    return [p[0] + ((p[0] - q[0]) / len) * w * 0.45, p[1] + ((p[1] - q[1]) / len) * w * 0.45];
  };
  return [end(pts[0], pts[1], ws[0]), ...L, end(pts[n - 1], pts[n - 2], ws[n - 1]), ...Rr.reverse()];
}

function ellipsePts(cx, cy, rx, ry, n = 14, rot = 0) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * TAU;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    out.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return out;
}

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

// ------------------------------------------------------------------ far bank
function paintFarBank(P) {
  const rnd = sampler(6101);
  P.layer();
  // the bank: a low line of land, grass touches
  const bank = [];
  for (let x = R.x0; x <= R.x1; x += 40) bank.push([x, 556 + 4 * noise1(x / 90, 3) - 2]);
  P.path(LINE_F, 0.5, bank, 0.5);
  const land = [...bank, [R.x1, 566], [R.x0, 566]];
  P.wash(land, COL.green, 40, { flat: true });
  for (let i = 0; i < 70; i += 1) {
    const x = rnd.range(R.x0, R.x1);
    const y = 556 + 4 * noise1(x / 90, 3) - 2;
    P.path(LINE_F, 0.4, [[x, y], [x + rnd.range(-1.5, 1.5), y - rnd.range(2.5, 5)]], 0);
  }
  // a few low roofs among the trees
  const roofs = [-30, 300, 640, 905, 1040];
  for (const rx of roofs) {
    const w = rnd.range(46, 70);
    const ridge = 528 + rnd.range(-4, 4);
    const eave = ridge + 12;
    const base = 556;
    P.layer();
    const roof = [[rx - w / 2 + 6, ridge], [rx + w / 2 - 6, ridge], [rx + w / 2 + 4, eave + 1], [rx - w / 2 - 4, eave + 1]];
    P.shape(roof, COL.slate, 70, LINE_F, 0.4, { flat: true });
    for (let x = rx - w / 2 + 2; x < rx + w / 2 - 1; x += 3.2) P.line(LINE_F, 0.3, x + (x - rx) * 0.12, ridge + 1, x + (x - rx) * 0.3, eave);
    P.shape(rect(rx - w / 2 + 2, eave + 1, rx + w / 2 - 2, base), null, 0, LINE_F, 0.4);
    for (let k = 0; k < 3; k += 1) P.line(LINE_F, 0.35, rx - w / 2 + 4 + k * (w / 3), eave + 1, rx - w / 2 + 4 + k * (w / 3), base);
  }
  // willows in early leaf: a short gnarled trunk, branches arching over, long strands hanging
  const willows = [70, 196, 410, 520, 770, 850, 1000];
  for (const wx of willows) {
    P.layer();
    const h = rnd.range(64, 84);
    const lean = rnd.range(-6, 6);
    const fork = [wx + lean, 558 - h * 0.36];
    P.wash(capsule([[wx, 558], [wx + lean * 0.5, 558 - h * 0.18], fork], [5.5, 4.4, 3.6]), COL.umber, 85, { flat: true });
    P.path(LINE_F, 0.45, [[wx - 2.7, 558], [wx + lean * 0.5 - 2.2, 558 - h * 0.18], [fork[0] - 1.8, fork[1]]], 0.5);
    P.path(LINE_F, 0.45, [[wx + 2.7, 558], [wx + lean * 0.5 + 2.2, 558 - h * 0.18], [fork[0] + 1.8, fork[1]]], 0.5);
    const nb = 5;
    for (let bi = 0; bi < nb; bi += 1) {
      const sideF = lerp(-1, 1, bi / (nb - 1)) + rnd.range(-0.12, 0.12);
      const reach = h * rnd.range(0.38, 0.55);
      const rise = h * rnd.range(0.32, 0.48) * (1 - 0.35 * Math.abs(sideF));
      const mid = [fork[0] + sideF * reach * 0.5, fork[1] - rise];
      const tip = [fork[0] + sideF * reach, fork[1] - rise * 0.55];
      const arc = [fork, mid, tip];
      P.path(LINE_F, 0.42, arc, 0.5);
      // pale green, laid as soft streaks hanging under the branch
      for (let k = 0; k < 3; k += 1) {
        const t0 = 0.25 + k * 0.25;
        const a = lerp(t0 < 0.5 ? fork[0] : mid[0], t0 < 0.5 ? mid[0] : tip[0], (t0 % 0.5) * 2);
        const b = lerp(t0 < 0.5 ? fork[1] : mid[1], t0 < 0.5 ? mid[1] : tip[1], (t0 % 0.5) * 2);
        const len = rnd.range(h * 0.35, h * 0.6);
        P.wash([[a - 4, b], [a + 4, b], [a + 3 + sideF * 2, b + len], [a - 2 + sideF * 2, b + len * 0.9]], COL.willow, 40, { bleed: 0.08, texture: 0.6, border: 0.45 });
      }
      for (let k = 0; k < 11; k += 1) {
        const t = rnd.range(0.2, 1);
        const q = t < 0.5 ? [lerp(fork[0], mid[0], t * 2), lerp(fork[1], mid[1], t * 2)] : [lerp(mid[0], tip[0], (t - 0.5) * 2), lerp(mid[1], tip[1], (t - 0.5) * 2)];
        const sl = rnd.range(h * 0.25, h * 0.62);
        const dr = sideF * rnd.range(0.5, 2.5);
        P.path(LINE_F, 0.26, [q, [q[0] + dr * 0.6, q[1] + sl * 0.5], [q[0] + dr, q[1] + sl]], 0.5);
      }
    }
  }
}

// ------------------------------------------------------------------ water (fish-scale ripples, on a 2D canvas)
function drawRipples(ctx, k) {
  ctx.setTransform(k, 0, 0, k, -R.x0 * k, -R.y0 * k);
  const rnd = sampler(6202);
  ctx.lineCap = "round";
  let row = 0;
  for (let y = 566; y < R.y1 + 6; row += 1) {
    const t = clamp((y - 560) / 280);
    const sp = lerp(4.2, 8.5, t);
    const aw = sp * 2.1;
    const off = row % 2 ? aw / 2 : 0;
    for (let x = R.x0 - aw + off; x < R.x1 + aw; x += aw) {
      // denser around the boat and the footings, thinner elsewhere
      const nearBoat = Math.exp(-(((x - 515) / 190) ** 2) - (((y - 772) / 40) ** 2));
      const nearFoot = Math.exp(-(((Math.min(Math.abs(x - 140), Math.abs(x - 860))) / 60) ** 2)) * smoothstep(720, 760, y);
      const base = lerp(0.06, 0.3, smoothstep(600, 800, y)) + 0.22 * (noise1(x / 140 + row * 0.37, 11) - 0.35);
      const p = clamp(base + 0.75 * nearBoat + 0.6 * nearFoot);
      if (rnd.next() > p) continue;
      const cx = x + rnd.range(-0.8, 0.8);
      const cy = y + rnd.range(-0.5, 0.5);
      ctx.strokeStyle = `rgba(108,106,102,${(0.26 + 0.3 * t + 0.15 * nearBoat).toFixed(3)})`;
      ctx.lineWidth = lerp(0.32, 0.45, t);
      ctx.beginPath();
      ctx.arc(cx, cy + aw * 0.32, aw * 0.5, -Math.PI * 0.84, -Math.PI * 0.16);
      ctx.stroke();
    }
    y += sp;
  }
}

// ------------------------------------------------------------------ the ends of the bridge: streets, shops, stalls
function roofShape(P, x0, x1, ridge, eave, opts = {}) {
  const w = x1 - x0;
  const pts = [[x0 + w * 0.12, ridge], [x1 - w * 0.12, ridge], [x1 + 6, eave - 2], [x1 + 9, eave - 4], [x1 + 8, eave + 1], [x0 - 8, eave + 1], [x0 - 9, eave - 4], [x0 - 6, eave - 2]];
  P.shape(pts, opts.color || COL.slate, opts.alpha || 95, LINE_D, 0.55, { flat: true });
  // tiles: ruled lines down the slope
  for (let x = x0 + w * 0.12 + 2; x < x1 - w * 0.12; x += 3.4) {
    const f = (x - (x0 + x1) / 2) / (w / 2);
    P.line(LINE, 0.32, x, ridge + 1, x + f * 7, eave - 0.5);
  }
  P.line(LINE_D, 1.4, x0 + w * 0.12 - 3, ridge - 0.5, x1 - w * 0.12 + 3, ridge - 0.5);
}

function matAwning(P, x0, x1, yTop, yLow, poleY) {
  // a sloping woven mat on two poles
  const pts = [[x0, yTop], [x1, yTop], [x1 + 4, yLow], [x0 - 4, yLow]];
  P.shape(pts, COL.mat, 85, LINE, 0.45, { flat: true });
  for (let x = x0 - 2; x < x1 + 2; x += 4.5) P.line(LINE_F, 0.3, x, yTop + 0.5, x + 3, yLow - 0.5);
  for (let x = x0 + 2; x < x1 + 2; x += 4.5) P.line(LINE_F, 0.3, x, yTop + 0.5, x - 3, yLow - 0.5);
  P.line(LINE, 0.7, x0 - 2, yLow, x0 - 2, poleY);
  P.line(LINE, 0.7, x1 + 2, yLow, x1 + 2, poleY);
}

/** A big square umbrella seen from the side: a flat canopy with ribs on a tall pole. */
function umbrella(P, x, top, w, poleBase) {
  P.layer();
  P.shape([[x - w / 2, top + 7], [x - w * 0.18, top], [x + w * 0.18, top], [x + w / 2, top + 7], [x + w / 2 - 2, top + 10], [x - w / 2 + 2, top + 10]], COL.plain, 120, LINE, 0.5, { flat: true });
  for (let i = -3; i <= 3; i += 1) P.line(LINE_F, 0.32, x + i * w * 0.05, top + 0.5, x + i * w * 0.15, top + 9.5);
  P.line(LINE_D, 1.0, x, top + 10, x, poleBase);
}

function table(P, x, w, base, h = 22) {
  P.shape(rect(x - w / 2, base - h, x + w / 2, base - h + 3), COL.wood, 100, LINE, 0.45, { flat: true });
  P.line(LINE, 0.6, x - w / 2 + 3, base - h + 3, x - w / 2 + 3, base);
  P.line(LINE, 0.6, x + w / 2 - 3, base - h + 3, x + w / 2 - 3, base);
}

function paintEnds(P) {
  // the river bank under the streets: timber piling and stone
  for (const side of [-1, 1]) {
    P.layer();
    const xA = side < 0 ? R.x0 : 870;
    const xB = side < 0 ? 130 : R.x1;
    // street surface band (far edge to near edge)
    const street = rect(xA, 676, xB, 716);
    P.shape(street, COL.wood, 40, null, 0, { flat: true });
    P.line(LINE, 0.45, xA, 676, xB, 676);
    P.line(LINE_D, 0.55, xA, 716, xB, 716);
    // revetment below the street, down to the water
    const rev = rect(xA, 716, xB, 778);
    P.shape(rev, COL.stone, 38, null, 0, { flat: true });
    for (let y = 724; y < 778; y += 9) P.line(LINE_F, 0.32, xA, y, xB, y);
    let j = 0;
    for (let y = 716; y < 776; y += 9, j += 1) {
      for (let x = xA + (j % 2) * 13; x < xB; x += 26) P.line(LINE_F, 0.28, x, y, x, Math.min(778, y + 9));
    }
    P.line(LINE, 0.5, xA, 778, xB, 778);
  }

  // left: a shop with a tiled roof and a mat awning, a tea stall under an umbrella
  P.layer();
  P.shape(rect(-80, 612, 36, 676), COL.wood, 55, LINE, 0.5, { flat: true });
  for (const x of [-70, -40, -10, 26]) P.line(LINE_D, 0.8, x, 600, x, 676);
  P.line(LINE, 0.5, -80, 640, 36, 640);
  for (let x = -66; x < 22; x += 6) P.line(LINE_F, 0.32, x, 641, x, 662); // shutters
  P.layer();
  roofShape(P, -84, 40, 566, 600);
  P.layer();
  matAwning(P, -8, 40, 606, 624, 676);
  table(P, 6, 30, 676, 20);
  umbrella(P, 92, 598, 86, 676);
  P.layer();
  table(P, 92, 34, 676, 20);
  P.shape(rect(64, 664, 120, 667), COL.wood, 90, LINE, 0.4, { flat: true }); // bench
  // tea things on the table
  for (const tx of [84, 92, 101]) P.shape(ellipsePts(tx, 652, 2.6, 2.2, 8), COL.slate, 80, LINE, 0.35, { flat: true });

  // right: a two-storey wine shop with a banner pole, a stall with an umbrella
  P.layer();
  P.shape(rect(930, 586, 1084, 676), COL.wood, 55, LINE, 0.5, { flat: true });
  for (const x of [936, 974, 1012, 1050]) P.line(LINE_D, 0.8, x, 560, x, 676);
  P.line(LINE, 0.5, 930, 612, 1084, 612);
  P.line(LINE, 0.5, 930, 632, 1084, 632);
  for (let x = 938; x < 1080; x += 5) P.line(LINE_F, 0.3, x, 613, x, 631); // balcony lattice
  P.layer();
  roofShape(P, 926, 1090, 520, 556);
  P.layer();
  roofShape(P, 930, 1086, 578, 594, { alpha: 70 });
  P.layer();
  // banner pole and a plain banner
  P.line(LINE_D, 0.9, 922, 676, 922, 520);
  P.shape([[922, 528], [946, 528], [946, 574], [934, 570], [922, 574]], COL.indigo, 70, LINE, 0.45, { flat: true });
  P.layer();
  matAwning(P, 880, 930, 612, 628, 676);
  table(P, 905, 34, 676, 20);
  umbrella(P, 1000, 604, 80, 676);
  P.layer();
  table(P, 1000, 30, 676, 20);
  for (const tx of [992, 1004]) P.shape(ellipsePts(tx, 651, 4, 3, 8), COL.ochre, 90, LINE, 0.35, { flat: true }); // baskets of goods

  // tall marker posts at both ends of the bridge, on the far side of the deck
  for (const x of [118, 882]) {
    P.layer();
    P.line(LINE_D, 1.6, x, 676, x, 520);
    P.line(LINE_D, 1.0, x - 10, 534, x + 10, 534);
    P.shape([[x - 3, 520], [x + 3, 520], [x + 2, 512], [x - 2, 512]], COL.wood, 100, LINE, 0.4, { flat: true });
  }
}

// ------------------------------------------------------------------ the bridge
/** Nodes of the polygonal timber arch. */
function archNodes(offset = 0, n = 10) {
  const out = [];
  for (let i = 0; i <= n; i += 1) {
    const x = ARCH_X0 + ((ARCH_X1 - ARCH_X0) * (i + offset)) / n;
    if (x < ARCH_X0 - 0.01 || x > ARCH_X1 + 0.01) continue;
    out.push([x, archY(x)]);
  }
  return out;
}

function paintAbutments(P) {
  for (const side of [-1, 1]) {
    P.layer();
    const xa = side < 0 ? 96 : 904; // outer face (under the street)
    const xb = side < 0 ? 158 : 842; // inner face, where the arch springs
    const pts = [[xa, 716], [xb - side * 4, 716], [xb, 748], [xb + side * 6, 790], [xa, 790]];
    P.shape(pts, COL.stone, 85, LINE_D, 0.55, { flat: true });
    let j = 0;
    for (let y = 724; y < 790; y += 8, j += 1) {
      const t = (y - 716) / 74;
      const xi = lerp(xb - side * 4, xb + side * 6, t);
      P.line(LINE, 0.4, xa, y, xi, y);
      const lo = Math.min(xa, xi);
      const hi = Math.max(xa, xi);
      for (let x = lo + (j % 2) * 7 + 3; x < hi; x += 14) P.line(LINE, 0.35, x, y - 8, x, y);
    }
  }
}

function paintArch(P) {
  // spandrel: posts and braces between the arch and the deck
  P.layer();
  const nodes = archNodes();
  for (const [x, y] of nodes) {
    const top = road(x) + 14;
    const yTop = y - ARCH_HALF;
    if (yTop - top > 3) {
      P.knock(rect(x - 2.2, top, x + 2.2, yTop));
      P.wash(rect(x - 2.2, top, x + 2.2, yTop), COL.wood, 110, { flat: true });
      P.line(LINE, 0.5, x - 2.2, top, x - 2.2, yTop);
      P.line(LINE, 0.5, x + 2.2, top, x + 2.2, yTop);
    }
  }
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const [xa, ya] = nodes[i];
    const [xb, yb] = nodes[i + 1];
    const ta = road(xa) + 14;
    const tb = road(xb) + 14;
    if (ya - ARCH_HALF - ta > 8 || yb - ARCH_HALF - tb > 8) {
      // a diagonal brace in each bay that is tall enough
      const up = ya > yb ? [xa, ya - ARCH_HALF] : [xb, yb - ARCH_HALF];
      const dn = ya > yb ? [xb, tb] : [xa, ta];
      P.line(LINE, 0.55, up[0], up[1], dn[0], dn[1]);
    }
  }

  // the arch: two interleaved systems of straight logs, lashed at the nodes
  for (const [offset, half, alpha] of [[0.5, ARCH_HALF * 0.8, 70], [0, ARCH_HALF, 110]]) {
    P.layer();
    const nd = archNodes(offset);
    if (offset > 0) nd.unshift([ARCH_X0 + 10, archY(ARCH_X0 + 10)]), nd.push([ARCH_X1 - 10, archY(ARCH_X1 - 10)]);
    const lift = offset > 0 ? -5 : 0;
    for (let i = 0; i < nd.length - 1; i += 1) {
      const [xa, ya0] = nd[i];
      const [xb, yb0] = nd[i + 1];
      const ya = ya0 + lift;
      const yb = yb0 + lift;
      const len = Math.hypot(xb - xa, yb - ya);
      const ux = (xb - xa) / len;
      const uy = (yb - ya) / len;
      const nx = -uy;
      const ny = ux;
      const ext = 4; // logs run past the lashing
      const a = [xa - ux * ext, ya - uy * ext];
      const b = [xb + ux * ext, yb + uy * ext];
      const band = [[a[0] + nx * half, a[1] + ny * half], [b[0] + nx * half, b[1] + ny * half], [b[0] - nx * half, b[1] - ny * half], [a[0] - nx * half, a[1] - ny * half]];
      P.knock(band);
      P.wash(band, COL.wood, alpha, { flat: true });
      // three logs in the bundle
      for (const f of [-1, -0.33, 0.33, 1]) {
        const tone = Math.abs(f) === 1 ? LINE_D : LINE;
        P.line(tone, Math.abs(f) === 1 ? 0.55 : 0.38, a[0] + nx * half * f, a[1] + ny * half * f, b[0] + nx * half * f, b[1] + ny * half * f);
      }
    }
    // lashings and the ends of the cross beams at every node
    for (const [x, y0] of nd) {
      const y = y0 + lift;
      P.ring(LINE_D, 0.45, ellipsePts(x, y - half * 0.45, 2.1, 2.1, 8));
      P.ring(LINE_D, 0.45, ellipsePts(x, y + half * 0.45, 2.1, 2.1, 8));
      P.line(LINE_D, 0.5, x - 2.6, y - half - 1, x - 2.6, y + half + 1);
      P.line(LINE_D, 0.5, x + 2.6, y - half - 1, x + 2.6, y + half + 1);
    }
  }
}

/** The far edge of the deck, the far railing, the deck surface. */
function paintDeck(P) {
  P.layer();
  const xs = [];
  for (let x = 124; x <= 876; x += 6) xs.push(x);
  const far = xs.map((x) => [x, road(x) - 24]);
  const near = xs.map((x) => [x, road(x) + 4]);
  const deck = [...far, ...[...near].reverse()];
  P.knock(deck);
  P.wash(deck, COL.wood, 72, { flat: true });
  P.wash(xs.map((x) => [x, road(x) - 24]).concat([...xs].reverse().map((x) => [x, road(x) - 17])), COL.umber, 50, { flat: true });
  P.path(LINE_D, 0.55, far, 0.3);
  // boards running along the deck
  for (const dy of [-17, -10, -3]) P.path(LINE_F, 0.3, xs.map((x) => [x, road(x) + dy]), 0.3);
  for (let x = 140; x < 866; x += 23) P.line(LINE_F, 0.28, x, road(x) - 23, x - 1, road(x) + 3);
  // the near fascia beam, with the ends of the deck joists
  const fasc = [...xs.map((x) => [x, road(x) + 4]), ...[...xs].reverse().map((x) => [x, road(x) + 14])];
  P.knock(fasc);
  P.wash(fasc, COL.umber, 95, { flat: true });
  P.path(LINE_D, 0.55, xs.map((x) => [x, road(x) + 4]), 0.3);
  P.path(LINE_D, 0.55, xs.map((x) => [x, road(x) + 14]), 0.3);
  for (let x = 134; x < 870; x += 9) {
    const y = road(x) + 9;
    P.ring(LINE, 0.35, ellipsePts(x, y, 1.8, 2.6, 7));
  }
  // far railing: posts, top rail, a middle rail, short balusters
  P.layer();
  const rail = (dy) => xs.map((x) => [x, road(x) - 24 - dy]);
  const topBand = [...rail(18), ...[...rail(15)].reverse()];
  P.wash(topBand, COL.umber, 110, { flat: true });
  P.path(LINE_D, 0.45, rail(18), 0.3);
  P.path(LINE, 0.4, rail(15), 0.3);
  P.path(LINE, 0.4, rail(8), 0.3);
  P.path(LINE, 0.35, rail(2), 0.3);
  for (let x = 130; x <= 870; x += 37) {
    const y = road(x) - 24;
    P.wash(rect(x - 1.3, y - 20, x + 1.3, y), COL.umber, 120, { flat: true });
    P.line(LINE_D, 0.4, x - 1.3, y, x - 1.3, y - 20);
    P.line(LINE_D, 0.4, x + 1.3, y, x + 1.3, y - 20);
    P.ring(LINE_D, 0.35, ellipsePts(x, y - 21.5, 1.7, 1.7, 7));
  }
  for (let x = 133; x < 870; x += 3.7) {
    const y = road(x) - 24;
    if ((x - 130) % 37 < 2.5 || (x - 130) % 37 > 34.5) continue;
    P.line(LINE_F, 0.3, x, y - 2, x, y - 8);
  }
}

/** The near railing (in front of the pelican). Returned as segments, so the mask can reuse it. */
function nearRailSegs() {
  const segs = [];
  const xs = [];
  for (let x = 130; x <= 870; x += 6) xs.push(x);
  xs.push(870);
  const top = xs.map((x) => [x, road(x) - 10]);
  const mid = xs.map((x) => [x, road(x) - 2]);
  segs.push({ pts: top, w: 0.6, rail: true, mw: 2.6 });
  segs.push({ pts: mid, w: 0.45, rail: true, mw: 2.0 });
  for (let x = 130; x <= 870; x += 37) segs.push({ pts: [[x, road(x) + 4], [x, road(x) - 13]], w: 0.8, post: true, mw: 3.4 });
  for (let x = 133; x < 870; x += 6) {
    if ((x - 130) % 37 < 4 || (x - 130) % 37 > 33) continue;
    segs.push({ pts: [[x, road(x) + 4], [x, road(x) - 2]], w: 0.35, mw: 1.2 });
  }
  return segs;
}

function paintNearRail(P) {
  P.layer();
  for (const s of nearRailSegs()) {
    if (s.post) {
      const [[x, y1], [, y0]] = s.pts;
      const r = rect(x - 1.5, y0, x + 1.5, y1);
      P.knock(r);
      P.wash(r, COL.umber, 110, { flat: true });
      P.ring(LINE_D, 0.4, r, 0);
      P.ring(LINE_D, 0.35, ellipsePts(x, y0 - 1.2, 1.6, 1.4, 6));
    } else if (s.rail) {
      P.path(LINE_D, s.w, s.pts, 0.3);
    } else {
      P.line(LINE, s.w, s.pts[0][0], s.pts[0][1], s.pts[1][0], s.pts[1][1]);
    }
  }
}

// ------------------------------------------------------------------ the boat
const BOAT = { x0: 366, x1: 668, deck: 720, water: 770 };

function paintBoat(P) {
  const { x0, x1, deck, water } = BOAT;
  // steering oar, behind the hull
  P.layer();
  P.path(LINE_D, 1.0, [[648, 700], [700, 760], [722, 788]], 0.2);
  P.shape([[714, 776], [726, 782], [728, 798], [716, 794]], COL.wood, 100, LINE, 0.4, { flat: true });
  // hull
  P.layer();
  const hull = [[x0, 700], [x0 + 22, deck - 2], [x1 - 30, deck - 2], [x1, 694], [x1 + 2, 700], [x1 - 18, 744], [x1 - 50, 772], [x0 + 60, 774], [x0 + 22, 748]];
  P.shape(hull, COL.umber, 105, LINE_D, 0.6, { flat: true, c: 0.08 });
  // planking: ruled lines along the side
  for (const t of [0.22, 0.42, 0.62, 0.8]) {
    const yL = lerp(deck + 2, 760, t);
    P.path(LINE, 0.38, [[x0 + 10 + t * 30, lerp(704, 748, t)], [x0 + 70, yL + 2], [x1 - 60, yL + 2], [x1 - 6 - t * 26, lerp(698, 744, t)]], 0.3);
  }
  for (let x = x0 + 40; x < x1 - 30; x += 22) P.line(LINE_F, 0.35, x, deck, x - 1, lerp(764, 772, 0.5));
  P.line(LINE_D, 1.0, x0 + 18, deck - 3, x1 - 28, deck - 3); // gunwale
  // cabin with a woven mat roof
  P.layer();
  const cab = rect(444, 694, 578, deck - 3);
  P.shape(cab, COL.wood, 70, LINE_D, 0.5, { flat: true });
  for (let x = 452; x < 574; x += 14) {
    P.line(LINE, 0.4, x, 698, x, deck - 5);
    P.line(LINE_F, 0.3, x + 3, 700, x + 3, deck - 7);
    P.line(LINE_F, 0.3, x + 7, 700, x + 7, deck - 7);
    P.line(LINE_F, 0.3, x + 11, 700, x + 11, deck - 7);
  }
  const roof = [[438, 696], [446, 688], [470, 684], [552, 684], [576, 688], [584, 696]];
  const roofPoly = [...roof, [584, 698], [438, 698]];
  P.shape(roofPoly, COL.mat, 100, LINE_D, 0.5, { flat: true, c: 0.3 });
  for (let x = 444; x < 580; x += 4) P.line(LINE_F, 0.3, x, 686, x + 2, 697);
}

/** The lowered mast, lying over the cabin roof in front of the men up there. */
function paintMast(P) {
  const { deck } = BOAT;
  // the lowered mast resting on a crutch, its rigging slack
  P.layer();
  P.line(LINE_D, 0.8, 452, 684, 456, 668); // crutch
  P.line(LINE_D, 0.8, 462, 684, 456, 668);
  const mast = [[626, 700], [400, 664]];
  const ml = Math.hypot(mast[1][0] - mast[0][0], mast[1][1] - mast[0][1]);
  const mux = (mast[1][0] - mast[0][0]) / ml;
  const muy = (mast[1][1] - mast[0][1]) / ml;
  const mband = capsule(mast, [3.6, 2.4]);
  P.shape(mband, COL.wood, 120, LINE_D, 0.45, { flat: true });
  P.line(LINE, 0.4, 626, 706, 626, 692); // the hinge post
  // rope from the masthead back to the haulers
  P.path(LINE, 0.4, [[404 + mux, 665 + muy], [500, 678], [592, 686], [612, 688]], 0.4);
  P.path(LINE_F, 0.35, [[408, 666], [395, 700], [384, 712]], 0.4);
  // bow cleats, a coil of rope, a water jar
  P.ring(LINE, 0.4, ellipsePts(430, deck - 6, 5, 2.5, 10));
  P.shape(ellipsePts(598, deck - 8, 4, 5, 10), COL.slate, 90, LINE, 0.4, { flat: true });
}

// ------------------------------------------------------------------ people
// A figure is a small puppet: joints in local units (90 = a standing adult,
// y up negative, facing right), dressed in jacket, robe or skirt, drawn in
// fine line with a little wash. Heads are left blank on the sheet and drawn
// each frame.
const POSES = {
  stand: { head: [0.5, -83], neck: [0, -75], hip: [0, -45], kN: [2, -23], aN: [3, -3], kF: [-2, -23], aF: [-3, -3], eN: [3, -59], hN: [4, -46], eF: [-3, -59], hF: [-3, -47] },
  walk: { head: [1.5, -83], neck: [1, -75], hip: [0, -45], kN: [7, -24], aN: [12, -3], kF: [-3, -23], aF: [-11, -5], eN: [-2, -59], hN: [-5, -47], eF: [5, -59], hF: [9, -49] },
  talk: { head: [1, -83], neck: [0.5, -75], hip: [0, -45], kN: [2, -23], aN: [4, -3], kF: [-2, -23], aF: [-4, -3], eN: [7, -60], hN: [13, -63], eF: [-2, -59], hF: [-2, -47] },
  hands: { head: [0.5, -83], neck: [0, -75], hip: [0, -45], kN: [2, -23], aN: [3, -3], kF: [-2, -23], aF: [-3, -3], eN: [5, -60], hN: [8, -55], eF: [2, -60], hF: [7, -56] },
  porter: { head: [5, -81], neck: [3, -73], hip: [0, -44], kN: [7, -24], aN: [12, -3], kF: [-3, -23], aF: [-11, -5], eN: [9, -63], hN: [8, -74], eF: [-6, -63], hF: [-11, -73] },
  stoop: { head: [9, -76], neck: [6, -69], hip: [0, -43], kN: [6, -24], aN: [10, -3], kF: [-3, -23], aF: [-9, -4], eN: [10, -56], hN: [14, -50], eF: [3, -56], hF: [5, -47] },
  sitRail: { head: [0, -64], neck: [-1, -56], hip: [0, -26], kN: [12, -25], aN: [13, -3], kF: [10, -24], aF: [9, -3], eN: [3, -44], hN: [10, -29], eF: [1, -44], hF: [8, -30] },
  crouch: { head: [8, -53], neck: [5, -46], hip: [-3, -20], kN: [8, -25], aN: [5, -2], kF: [6, -23], aF: [-1, -2], eN: [9, -35], hN: [15, -31], eF: [7, -36], hF: [13, -33] },
  haul: { head: [-8, -79], neck: [-7, -71], hip: [0, -43], kN: [9, -22], aN: [15, -3], kF: [-4, -22], aF: [-6, -3], eN: [3, -64], hN: [13, -70], eF: [1, -62], hF: [11, -67] },
  pole: { head: [12, -77], neck: [9, -70], hip: [0, -43], kN: [6, -23], aN: [10, -3], kF: [-4, -22], aF: [-9, -4], eN: [12, -58], hN: [17, -53], eF: [7, -61], hF: [13, -64] },
  poleUp: { head: [4, -55], neck: [2, -48], hip: [-2, -22], kN: [8, -26], aN: [6, -2], kF: [4, -24], aF: [-2, -2], eN: [9, -55], hN: [11, -66], eF: [6, -52], hF: [9, -60] },
  steer: { head: [0.5, -83], neck: [0, -75], hip: [0, -45], kN: [3, -23], aN: [5, -3], kF: [-3, -23], aF: [-6, -3], eN: [-5, -60], hN: [-11, -57], eF: [-4, -61], hF: [-9, -59] },
};

/** Map a local point of figure F to the world. */
const toW = (F, p) => [F.x + p[0] * F.s * F.dir, F.foot + p[1] * F.s];

/** Build a figure's parts, back to front: [{ pts, color, alpha, tone, w }]. */
function figureParts(F) {
  const P = POSES[F.pose];
  const s = F.s;
  const W = (p) => toW(F, p);
  const parts = [];
  const add = (pts, color, alpha = 105, tone = LINE, w = 0.5) => parts.push({ pts, color, alpha, tone, w });
  const shoulder = (side) => [P.neck[0] + side * 1.5, P.neck[1] + 3];
  const arm = (e, h, side) => {
    const pts = [W(shoulder(side)), W(e), W(h)];
    add(capsule(pts, [7 * s, 7 * s, 8 * s]), F.col, 100);
    add(ellipsePts(...W([h[0] + 1.2 * Math.sign(h[0] - e[0] || 1), h[1] + 1]), 1.7 * s, 1.7 * s, 7), COL.skin, 50, LINE, 0.4);
  };
  const leg = (k, a, near) => {
    const hp = [P.hip[0] + (near ? 1.5 : -1.5), P.hip[1]];
    add(capsule([W(hp), W(k), W(a)], [8.4 * s, 7.4 * s, 6.2 * s]), F.legCol || null, 70, LINE, 0.45);
  };
  const shoe = (a) => add([W([a[0] - 2.5, a[1] - 1.5]), W([a[0] + 4.5, a[1] - 1]), W([a[0] + 5, a[1] + 2.6]), W([a[0] - 3, a[1] + 2.6])], INK.zhong, 150, LINE, 0.35);
  // torso axis
  const ax = P.neck[0] - P.hip[0];
  const ay = P.neck[1] - P.hip[1];
  const al = Math.hypot(ax, ay);
  const ux = ax / al;
  const uy = ay / al;
  const nx = -uy;
  const ny = ux;
  const at = (t, off) => [P.hip[0] + ax * t + nx * off, P.hip[1] + ay * t + ny * off];
  const hemY = F.clothes === "jacket" || F.clothes === "tunic" ? 0.24 : 0;
  const torso = () => {
    const sh = 8.4;
    const pts = [at(1.02, -sh * 0.55), at(0.98, -sh), at(0.55, -sh * 1.0), at(0.02, -sh * 1.08), at(-hemY, -sh * 1.35), at(-hemY, sh * 1.35), at(0.02, sh * 1.08), at(0.55, sh), at(0.98, sh), at(1.02, sh * 0.55)];
    add(pts.map(W), F.col, 105, LINE, 0.5);
  };
  const robe = (color) => {
    const sh = 8.4;
    const hemC = [(P.aN[0] + P.aF[0]) / 2 + 1, -2.5];
    const spread = Math.max(11, Math.abs(P.aN[0] - P.aF[0]) * 0.75 + 6);
    const pts = [at(1.02, -sh * 0.55), at(0.98, -sh), at(0.55, -sh), at(0.05, -sh * 1.1), [hemC[0] - spread, hemC[1]], [hemC[0] + spread, hemC[1]], at(0.05, sh * 1.12), at(0.55, sh), at(0.98, sh), at(1.02, sh * 0.55)];
    add(pts.map(W), color, 100, LINE, 0.5);
  };
  if (F.prop === "bundleBack") {
    add(ellipsePts(...W(at(0.62, -11)), 9 * s, 12 * s, 12, -0.15 * F.dir), COL.plain, 110, LINE, 0.5);
  }
  if (!F.noFarArm) arm(P.eF, P.hF, -1);
  const seated = F.pose === "sitRail" || F.pose === "crouch" || F.pose === "poleUp";
  if (F.clothes === "robe" || F.clothes === "skirt") {
    leg(P.kF, P.aF, false);
    leg(P.kN, P.aN, true);
    if (seated) {
      shoe(P.aF);
      shoe(P.aN);
      torso();
    } else {
      robe(F.clothes === "skirt" ? F.col2 : F.col);
      shoe(P.aF);
      shoe(P.aN);
      if (F.clothes === "skirt") {
        const sh = 7;
        add([at(1.02, -sh * 0.55), at(0.98, -sh), at(0.5, -sh), at(0.12, -sh * 1.25), at(0.12, sh * 1.25), at(0.5, sh), at(0.98, sh), at(1.02, sh * 0.55)].map(W), F.col, 100, LINE, 0.5);
      }
    }
  } else {
    leg(P.kF, P.aF, false);
    shoe(P.aF);
    leg(P.kN, P.aN, true);
    shoe(P.aN);
    torso();
  }
  // collar, folds and belt
  parts.push({ line: [W(at(1.0, -4)), W(at(0.7, 3.5))], tone: LINE, w: 0.4 });
  if ((F.clothes === "robe" || F.clothes === "skirt") && !seated) {
    const hemC = [(P.aN[0] + P.aF[0]) / 2 + 1, -3];
    for (const f of [-0.45, 0.1, 0.55]) {
      const top = at(-0.05, f * 7);
      parts.push({ path: [W(top), W([lerp(top[0], hemC[0] + f * 10, 0.5) + 1, lerp(top[1], hemC[1], 0.5)]), W([hemC[0] + f * 12, hemC[1] - 1.5])], tone: LINE_F, w: 0.32 });
    }
  } else if (!seated) {
    parts.push({ path: [W(at(0.5, -5)), W(at(0.25, -2)), W(at(-0.15, -4))], tone: LINE_F, w: 0.32 });
  }
  if (F.clothes !== "robe" || F.pose === "sitRail") parts.push({ line: [W(at(0.06, -7.5)), W(at(0.06, 7.5))], tone: LINE, w: 0.45 });
  else parts.push({ line: [W(at(0.1, -7.5)), W(at(0.1, 7.5))], tone: LINE, w: 0.4 });
  if (!F.point) arm(P.eN, P.hN, 1);
  // props
  if (F.prop === "pole") {
    const a = W([-36, -76]);
    const b = W([38, -76]);
    const m = W([1, -78]);
    parts.push({ path: [a, m, b], tone: LINE_D, w: 0.9 });
    for (const end of [[-33, -76], [35, -76]]) {
      const top = W(end);
      const bx = W([end[0], -26]);
      parts.push({ line: [top, [top[0] - 4 * s, bx[1]]], tone: LINE, w: 0.35 });
      parts.push({ line: [top, [top[0] + 4 * s, bx[1]]], tone: LINE, w: 0.35 });
      add([[bx[0] - 7 * s, bx[1]], [bx[0] + 7 * s, bx[1]], [bx[0] + 5.5 * s, bx[1] + 12 * s], [bx[0] - 5.5 * s, bx[1] + 12 * s]], COL.mat, 110, LINE, 0.45);
      add(ellipsePts(bx[0], bx[1] - 1.5 * s, 5.5 * s, 3 * s, 9), F.goods || COL.green, 90, LINE, 0.35);
    }
  } else if (F.prop === "staff") {
    parts.push({ line: [W([P.hN[0] + 1, -95]), W([P.hN[0] + 3, 0])], tone: LINE_D, w: 0.6 });
  } else if (F.prop === "boatpole") {
    const h = W(P.hF);
    parts.push({ line: [[h[0] - F.dir * 14 * s, h[1] - 14 * s], [h[0] + F.dir * 60, h[1] + 96]], tone: LINE_D, w: 0.75 });
  } else if (F.prop === "uppole") {
    const h = W(P.hN);
    parts.push({ line: [[h[0] - F.dir * 8, h[1] + 24], [h[0] + F.dir * 12, h[1] - 50]], tone: LINE_D, w: 0.75 });
  } else if (F.prop === "fan") {
    const h = W(P.hN);
    add([h, [h[0] + F.dir * 6, h[1] - 7], [h[0] + F.dir * 10, h[1] - 3]], COL.plain, 90, LINE, 0.35);
  }
  return parts;
}

function headOf(F) {
  const P = POSES[F.pose];
  const [x, y] = toW(F, P.head);
  return { x, y, r: (F.headR || 7.0) * F.s };
}

// The cast. x, d = feet above the road line (depth on the deck), dir = facing,
// clothes, colours, head kind, pose; yaw0 = where the head looks when nothing
// is happening (-1 left profile .. 1 right profile).
const CAST = [
  // left street
  { x: -46, d: 16, pose: "walk", dir: 1, clothes: "jacket", col: COL.umber, head: "cap", delay: 0.1 },
  { x: 8, d: 4, pose: "porter", dir: 1, clothes: "tunic", col: COL.slate, head: "bun", prop: "pole", goods: COL.green, delay: 0.25 },
  { x: 70, d: 14, pose: "sitRail", dir: 1, clothes: "robe", col: COL.green, head: "cap", delay: 0.15, yaw0: 0.7 },
  { x: 112, d: 6, pose: "walk", dir: -1, clothes: "skirt", col: COL.red, col2: COL.plain, head: "woman", delay: 0.05 },
  { x: 101, d: 3, pose: "walk", dir: -1, clothes: "jacket", col: COL.ochre, head: "child", s: 0.55, delay: 0.0 },
  // up the left side
  { x: 162, d: 10, pose: "stoop", dir: 1, clothes: "tunic", col: COL.indigo, head: "bun", prop: "bundleBack", delay: 0.3 },
  { x: 196, d: 20, pose: "hands", dir: -1, clothes: "robe", col: COL.slate, head: "cap", delay: 0.1, yaw0: -0.6 },
  { x: 236, d: 12, pose: "walk", dir: 1, clothes: "jacket", col: COL.ochre, head: "hat", delay: 0.2 },
  { x: 268, d: 21, pose: "sitRail", dir: -1, clothes: "jacket", col: COL.umber, head: "bun", delay: 0.05, yaw0: -0.3 },
  { x: 300, d: 8, pose: "talk", dir: 1, clothes: "robe", col: COL.indigo, head: "cap", delay: 0.12 },
  { x: 318, d: 18, pose: "talk", dir: -1, clothes: "jacket", col: COL.red, head: "scarf", delay: 0.22 },
  { x: 352, d: 11, pose: "walk", dir: 1, clothes: "skirt", col: COL.green, col2: COL.plain, head: "woman", delay: 0.08 },
  { x: 341, d: 6, pose: "walk", dir: 1, clothes: "jacket", col: COL.red, head: "child", s: 0.58, delay: 0.0 },
  { x: 384, d: 21, pose: "stand", dir: 1, clothes: "jacket", col: COL.slate, head: "cap", point: true, delay: 0.0 },
  { x: 414, d: 9, pose: "hands", dir: -1, clothes: "robe", col: COL.ochre, head: "bald", prop: "staff", delay: 0.35 },
  { x: 446, d: 17, pose: "porter", dir: -1, clothes: "tunic", col: COL.umber, head: "hat", prop: "pole", goods: COL.ochre, delay: 0.15 },
  { x: 478, d: 22, pose: "sitRail", dir: 1, clothes: "jacket", col: COL.indigo, head: "bun", delay: 0.1, yaw0: 0.2 },
  { x: 528, d: 13, pose: "talk", dir: -1, clothes: "robe", col: COL.plain, head: "cap", prop: "fan", delay: 0.05 },
  { x: 548, d: 21, pose: "stand", dir: -1, clothes: "jacket", col: COL.green, head: "child", s: 0.62, delay: 0.0 },
  // the sedan chair and its bearers, going up towards the crown
  { x: 574, d: 12, pose: "porter", dir: -1, clothes: "tunic", col: COL.red, head: "bun", delay: 0.18, chair: true },
  { x: 652, d: 12, pose: "porter", dir: -1, clothes: "tunic", col: COL.red, head: "bun", delay: 0.28, chair: true },
  { x: 684, d: 20, pose: "stand", dir: -1, clothes: "jacket", col: COL.umber, head: "cap", point: true, delay: 0.05 },
  { x: 1012, d: 3, pose: "walk", dir: -1, clothes: "skirt", col: COL.indigo, col2: COL.plain, head: "woman", delay: 0.2 },
  { x: 790, d: 19, pose: "talk", dir: 1, clothes: "jacket", col: COL.ochre, head: "scarf", point: true, delay: 0.1 },
  // the donkey's man
  { x: 812, d: 7, pose: "walk", dir: -1, clothes: "tunic", col: COL.slate, head: "hat", delay: 0.25, noFarArm: false },
  // right street
  { x: 886, d: 18, pose: "hands", dir: -1, clothes: "robe", col: COL.green, head: "cap", delay: 0.12 },
  { x: 940, d: 6, pose: "porter", dir: -1, clothes: "tunic", col: COL.umber, head: "bun", prop: "pole", goods: COL.red, delay: 0.3 },
  { x: 968, d: 14, pose: "sitRail", dir: -1, clothes: "jacket", col: COL.indigo, head: "cap", delay: 0.2, yaw0: -0.7 },
  { x: 1062, d: 12, pose: "walk", dir: 1, clothes: "jacket", col: COL.red, head: "scarf", delay: 0.1 },
];

// The boat's crew: smaller, standing on the boat (y given directly).
const CREW = [
  { x: 382, foot: 712, pose: "pole", dir: -1, col: COL.slate, head: "bun", prop: "boatpole" },
  { x: 408, foot: 716, pose: "pole", dir: -1, col: COL.umber, head: "scarf", prop: "boatpole" },
  { x: 430, foot: 716, pose: "crouch", dir: 1, col: COL.ochre, head: "bun" },
  { x: 486, foot: 684, pose: "poleUp", dir: -1, col: COL.indigo, head: "bun", prop: "uppole" },
  { x: 540, foot: 684, pose: "poleUp", dir: 1, col: COL.umber, head: "hat", prop: "uppole" },
  { x: 596, foot: 716, pose: "haul", dir: 1, col: COL.slate, head: "scarf" },
  { x: 616, foot: 716, pose: "haul", dir: 1, col: COL.red, head: "bun" },
  { x: 648, foot: 698, pose: "steer", dir: 1, col: COL.ochre, head: "cap" },
];

// Near-railing sitters: on the near rail, facing us, legs over the edge.
const NEAR = [
  { x: 214, col: COL.indigo, col2: COL.plain, head: "cap", delay: 0.05, yaw0: -0.35, pitch0: -0.25 },
  { x: 346, col: COL.ochre, col2: COL.slate, head: "child", s: 0.66, delay: 0.0, yaw0: 0.3, pitch0: -0.3 },
  { x: 786, col: COL.red, col2: COL.plain, head: "bun", delay: 0.15, yaw0: 0.4, pitch0: -0.2 },
];

function castFigures() {
  return CAST.map((c, i) => ({ s: 0.95 + 0.1 * hash(i, 17), ...c, i, foot: road(c.x) - c.d, watch: true }));
}
function crewFigures() {
  return CREW.map((c, i) => ({ s: c.pose === "poleUp" ? 0.6 : 0.66, d: 0, clothes: "tunic", ...c, i, watch: true, crew: true, headR: 6.6 }));
}

/** A front-facing sitter on the near rail. Returns parts and head. */
function nearSitter(N) {
  const s = N.s || 1;
  const seat = road(N.x) - 10;
  const x = N.x;
  const parts = [];
  const add = (pts, color, alpha = 105, tone = LINE, w = 0.5) => parts.push({ pts, color, alpha, tone, w });
  // lower legs hanging over the fascia
  for (const side of [-1, 1]) {
    add(capsule([[x + side * 5.5 * s, seat + 5 * s], [x + side * 5.2 * s, seat + 15 * s], [x + side * 4.6 * s, seat + 24 * s]], [6 * s, 5.4 * s, 4.6 * s]), N.col2, 80, LINE, 0.45);
    add([[x + side * 4.2 * s - 2.6 * s, seat + 23 * s], [x + side * 4.2 * s + 2.6 * s, seat + 23 * s], [x + side * 4.2 * s + 2.4 * s, seat + 28 * s], [x + side * 4.2 * s - 2.4 * s, seat + 28 * s]], INK.zhong, 150, LINE, 0.35);
  }
  // the lap: thighs coming towards us, knees
  add([[x - 11 * s, seat - 3 * s], [x + 11 * s, seat - 3 * s], [x + 10.5 * s, seat + 5 * s], [x + 6 * s, seat + 7 * s], [x, seat + 5.5 * s], [x - 6 * s, seat + 7 * s], [x - 10.5 * s, seat + 5 * s]], N.col2, 80, LINE, 0.45);
  // body
  const t = [[x - 7 * s, seat - 34 * s], [x + 7 * s, seat - 34 * s], [x + 9 * s, seat - 18 * s], [x + 11 * s, seat + 3 * s], [x - 11 * s, seat + 3 * s], [x - 9 * s, seat - 18 * s]];
  add(t, N.col, 105, LINE, 0.5);
  parts.push({ line: [[x - 3 * s, seat - 35 * s], [x + 2 * s, seat - 24 * s]], tone: LINE, w: 0.4 });
  // arms down to the rail
  for (const side of [-1, 1]) {
    add(capsule([[x + side * 7.5 * s, seat - 32 * s], [x + side * 11 * s, seat - 17 * s], [x + side * 12 * s, seat - 3 * s]], [5.6 * s, 5.2 * s, 5 * s]), N.col, 100, LINE, 0.45);
    add(ellipsePts(x + side * 12 * s, seat - 1, 1.7 * s, 1.7 * s, 7), COL.skin, 50, LINE, 0.4);
  }
  return { parts, head: { x, y: seat - 42 * s, r: 7 * s } };
}

/** The sedan chair: a box hung between two poles, a little roof, a passenger at the window. */
function paintChair(P) {
  P.layer();
  const pole = (x) => road(x) - 12 - 72;
  P.path(LINE_D, 1.1, [[552, pole(552)], [613, pole(613)], [676, pole(676)]], 0.2);
  const pY = pole(613);
  const box = [[590, pY - 24], [637, pY - 24], [637, pY + 34], [590, pY + 34]];
  P.shape(box, COL.red, 80, LINE_D, 0.55, { flat: true });
  P.shape([[583, pY - 24], [594, pY - 40], [633, pY - 40], [644, pY - 24]], COL.slate, 105, LINE_D, 0.55, { flat: true });
  for (let x = 597; x < 632; x += 3.2) P.line(LINE, 0.3, x, pY - 39, x + (x - 613) * 0.3, pY - 25);
  P.shape(rect(598, pY - 16, 629, pY + 8), COL.plain, 100, LINE, 0.45, { flat: true });
  P.line(LINE, 0.4, 590, pY + 20, 637, pY + 20);
  // the window's curtain, let down
  P.shape([[599, pY - 15], [628, pY - 15], [628, pY - 2], [622, pY + 1], [613, pY - 1], [605, pY + 1], [599, pY - 2]], COL.green, 85, LINE, 0.4, { flat: true });
  for (let x = 602; x < 628; x += 3.5) P.line(LINE_F, 0.3, x, pY - 14, x + 0.5, pY - 1);
}

/** The stall on the bridge with the sleeper against its post (never moves). */
function paintSleeperStall(P) {
  const x = 736;
  const base = road(x) - 22;
  umbrella(P, x + 14, base - 106, 74, base);
  P.layer();
  table(P, x + 30, 30, road(x + 30) - 22, 18);
  for (const tx of [x + 24, x + 34]) P.shape(ellipsePts(tx, road(x + 30) - 22 - 21, 4, 2.6, 8), COL.ochre, 90, LINE, 0.35, { flat: true });
  // the sleeper: sitting on the deck, back to the pole, legs out, chin on chest
  P.layer();
  const fy = road(x - 4) - 18;
  const sx = x + 10;
  const legs = capsule([[sx - 3, fy - 4], [sx - 18, fy - 4], [sx - 30, fy - 2]], [8, 6.5, 5]);
  P.shape(legs, COL.plain, 80, LINE, 0.45, { flat: true });
  P.shape([[sx - 34, fy - 5], [sx - 28, fy - 5], [sx - 28, fy + 1], [sx - 35, fy + 1]], INK.zhong, 150, LINE, 0.35, { flat: true });
  const body = [[sx - 9, fy - 46], [sx + 1, fy - 46], [sx + 3, fy - 24], [sx + 4, fy - 2], [sx - 12, fy - 2], [sx - 12, fy - 24]];
  P.shape(body, COL.umber, 100, LINE, 0.5, { flat: true });
  P.shape(capsule([[sx - 9, fy - 42], [sx - 13, fy - 26], [sx - 20, fy - 14]], [5.6, 5.2, 4.8]), COL.umber, 100, LINE, 0.45, { flat: true });
  // the drooping head: closed eye, cap
  const hx = sx - 10;
  const hy = fy - 50;
  P.shape(ellipsePts(hx, hy, 5, 6.1, 14, 0.5), COL.skin, 40, LINE, 0.45, { flat: true });
  P.shape([[hx - 6, hy - 2], [hx - 3, hy - 7], [hx + 3, hy - 7.5], [hx + 6, hy - 3], [hx + 3, hy - 1]], INK.zhong, 200, LINE, 0.4, { flat: true });
  P.line(LINE_D, 0.5, hx - 4.5, hy + 1.5, hx - 2, hy + 2.6);
  P.line(LINE, 0.4, hx - 4.6, hy + 4.5, hx - 3, hy + 4.8);
}

/** The donkey: loaded, head down, not interested. Never moves. */
function paintDonkey(P) {
  P.layer();
  const x = 846; // middle of the barrel
  const foot = road(x) - 9;
  const back = foot - 38;
  const body = ellipsePts(x, back + 10, 21, 10, 16);
  const legs = [[-14, 1], [-9, -1], [11, 1], [16, -1]];
  for (const [lx, sw] of legs) {
    P.shape(capsule([[x + lx, back + 14], [x + lx + sw, foot - 9], [x + lx + sw * 0.5, foot]], [4.4, 3, 2.6]), COL.stone, 90, LINE, 0.45, { flat: true });
    P.shape(rect(x + lx + sw * 0.5 - 1.8, foot - 1.6, x + lx + sw * 0.5 + 1.8, foot + 0.6), INK.zhong, 160, LINE, 0.3, { flat: true });
  }
  P.shape(body, COL.stone, 100, LINE, 0.5, { flat: true });
  // neck and head down towards the deck, facing left
  const neck = [[x - 16, back + 2], [x - 26, back + 6], [x - 33, back + 18], [x - 26, back + 22], [x - 16, back + 16]];
  P.shape(neck, COL.stone, 100, LINE, 0.5, { flat: true });
  const head = [[x - 31, back + 13], [x - 41, back + 24], [x - 41, back + 29], [x - 35, back + 29], [x - 26, back + 22]];
  P.shape(head, COL.stone, 100, LINE, 0.5, { flat: true });
  P.shape([[x - 28, back + 8], [x - 30, back - 4], [x - 27, back + 7]], COL.stone, 100, LINE, 0.4, { flat: true }); // ears
  P.shape([[x - 25, back + 8], [x - 23, back - 3], [x - 23, back + 8]], COL.stone, 100, LINE, 0.4, { flat: true });
  P.ring(INK.nong, 0.5, ellipsePts(x - 33, back + 18, 0.8, 0.6, 6));
  P.path(LINE, 0.45, [[x + 20, back + 6], [x + 25, back + 14], [x + 24, back + 24]], 0.4); // tail
  // panniers and a load tied across the back
  P.shape(rect(x - 9, back - 6, x + 11, back + 4), COL.plain, 110, LINE, 0.45, { flat: true });
  P.shape([[x - 12, back + 2], [x + 2, back + 2], [x + 1, back + 20], [x - 10, back + 20]], COL.mat, 110, LINE, 0.45, { flat: true });
  for (let yy = back + 5; yy < back + 20; yy += 3) P.line(LINE_F, 0.3, x - 11, yy, x + 1, yy);
  P.line(LINE, 0.45, x - 26, back + 22, x - 38, road(x - 40) - 50); // the lead rope up to the man's hand
}

/** Paint figures in depth order: far first; each in its own layers, part by part. */
function paintFigures(P, figs) {
  const sorted = [...figs].sort((a, b) => b.d - a.d || a.x - b.x);
  // group figures that do not overlap, so a layer can hold one part of each
  const groups = [];
  for (const F of sorted) {
    let g = groups.find((G) => G.every((o) => Math.abs(o.x - F.x) > 44 * Math.max(o.s, F.s)) && G.depth - F.d < 6);
    if (!g) {
      g = [];
      g.depth = F.d;
      groups.push(g);
    }
    g.push(F);
  }
  for (const G of groups) {
    const lists = G.map((F) => figureParts(F));
    const n = Math.max(...lists.map((l) => l.length));
    for (let i = 0; i < n; i += 1) {
      P.layer();
      for (const l of lists) {
        const part = l[i];
        if (!part) continue;
        if (part.line) P.line(part.tone, part.w, ...part.line[0], ...part.line[1]);
        else if (part.path) P.path(part.tone, part.w, part.path, 0.4);
        else P.shape(part.pts, part.color, part.alpha, part.tone, part.w, { flat: true });
      }
    }
    // clear the heads, which are drawn each frame
    P.layer();
    for (const F of G) {
      const h = headOf(F);
      P.knock(ellipsePts(h.x, h.y, h.r * 0.78, h.r * 0.97, 14));
    }
  }
}

function paintNearSitters(P) {
  for (const N of NEAR) {
    const { parts, head } = nearSitter(N);
    for (const part of parts) {
      P.layer();
      if (part.line) P.line(part.tone, part.w, ...part.line[0], ...part.line[1]);
      else P.shape(part.pts, part.color, part.alpha, part.tone, part.w, { flat: true });
    }
    P.layer();
    P.knock(ellipsePts(head.x, head.y, head.r * 0.78, head.r * 0.97, 14));
  }
}

// ------------------------------------------------------------------ the painting program
function program(P) {
  paintFarBank(P);
  paintEnds(P);
  paintBoat(P);
  paintFigures(P, crewFigures());
  paintMast(P);
  paintAbutments(P);
  paintArch(P);
  paintDeck(P);
  paintSleeperStall(P);
  paintChair(P);
  paintFigures(P, castFigures().filter((F) => F.x > 140 && F.x < 860));
  paintDonkey(P);
  paintFigures(P, castFigures().filter((F) => F.x <= 140 || F.x >= 860));
  paintNearRail(P);
  paintNearSitters(P);
}

function sheetKey(stage) {
  return (PX * stage.s).toFixed(4);
}

function bakeWorld(stage) {
  const k = PX * stage.s;
  const w = Math.round((R.x1 - R.x0) * k);
  const h = Math.round((R.y1 - R.y0) * k);
  const key = `qingming/world/${sheetKey(stage)}`;
  if (stage.isBaked(key)) return stage.fb(key, w, h);
  const rip = stage.bake2d(`qingming/ripples/${sheetKey(stage)}`, w, h, (ctx) => drawRipples(ctx, k));
  const tex = stage.bake(key, w, h, () => {
    const view = new View(k, -R.x0 * k, -R.y0 * k);
    blankSheet(stage);
    stage.withView(view, () => stage.image(rip, R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0));
    const P = new Plate();
    program(P);
    stage.seed(6600);
    withPen(stage, view, (pen) => P.paint(stage, pen));
  });
  stage.drop(`qingming/ripples/`);
  return tex;
}

/** Silhouettes of everything that stands in front of the pelican, opaque on clear. */
function bakeMask(stage) {
  const k = PX * stage.s;
  const w = Math.round((MASK.x1 - MASK.x0) * k);
  const h = Math.round((MASK.y1 - MASK.y0) * k);
  return stage.bake(`qingming/mask/${sheetKey(stage)}`, w, h, () => {
    const { p } = stage;
    const view = new View(k, -MASK.x0 * k, -MASK.y0 * k);
    // opaque everywhere except where something stands in front of the pelican
    stage.origin();
    p.noStroke();
    p.fill(255);
    p.rect(0, 0, w, h);
    p.blendMode(p.REMOVE);
    stage.withView(view, () => {
      p.noFill();
      p.stroke(255);
      p.strokeCap(p.ROUND);
      for (const s of nearRailSegs()) {
        p.strokeWeight(s.mw);
        for (let i = 0; i < s.pts.length - 1; i += 1) p.line(s.pts[i][0], s.pts[i][1], s.pts[i + 1][0], s.pts[i + 1][1]);
      }
      p.noStroke();
      p.fill(255);
      for (const N of NEAR) {
        const { parts, head } = nearSitter(N);
        for (const part of parts) {
          if (!part.pts) continue;
          p.beginShape();
          for (const q of part.pts) p.vertex(q[0], q[1]);
          p.endShape(p.CLOSE);
        }
        p.ellipse(head.x, head.y - head.r * 0.1, head.r * 2.5, head.r * 2.6);
      }
    });
    p.blendMode(p.BLEND);
  });
}

// ------------------------------------------------------------------ heads, every frame
const HEAD = {
  line: "rgba(66,60,54,0.92)",
  hair: "rgba(46,43,40,0.9)",
  face: "rgba(246,238,222,1)",
  hat: "rgba(204,178,124,1)",
  scarf: "rgba(170,180,186,1)",
};

/**
 * One head. yaw -1 (left profile) .. 0 (front) .. 1 (right profile);
 * pitch > 0 looks up. Drawn in a few marks of fine line.
 */
function drawHead(ctx, h, yaw, pitch) {
  const r = h.r;
  const side = yaw >= 0 ? 1 : -1;
  const ay = Math.min(1, Math.abs(yaw));
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.scale(side, 1);
  ctx.rotate(-pitch * (0.25 + 0.75 * ay));
  const up = pitch * r * 0.38 * (1 - 0.5 * ay);
  const rx = r * 0.8;
  const ry = r;
  const lw = Math.max(0.42, r * 0.085);
  ctx.lineWidth = lw;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = HEAD.line;

  // face and skull
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  ctx.fillStyle = HEAD.face;
  ctx.fill();
  // nose in profile
  if (ay > 0.25) {
    const k = smoothstep(0.25, 0.8, ay);
    ctx.beginPath();
    ctx.moveTo(rx * 0.95, -r * 0.18 - up);
    ctx.lineTo(rx * (0.98 + 0.26 * k), r * 0.16 - up);
    ctx.lineTo(rx * 0.86, r * 0.3 - up);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, -Math.PI * 0.08, Math.PI * 1.92);
  ctx.stroke();

  // hair or head cloth: over the top and round the back
  const kind = h.kind;
  if (kind !== "bald") {
    const a1 = lerp(-0.12, -0.42, ay) * Math.PI;
    const a2 = lerp(-0.88, -1.32, ay) * Math.PI;
    const inner = [lerp(0, -r * 0.22, ay), lerp(-r * 0.3, r * 0.05, ay)];
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.02, rx * 1.07, ry * 1.06, 0, a1, a2, true);
    ctx.lineTo(inner[0], inner[1]);
    ctx.closePath();
    ctx.fillStyle = kind === "scarf" ? HEAD.scarf : HEAD.hair;
    ctx.fill();
    if (kind === "scarf") ctx.stroke();
    ctx.fillStyle = HEAD.hair;
    if (kind === "cap") {
      // the Song head cloth: a rounded crown at the back of the head, two short ties
      ctx.beginPath();
      ctx.ellipse(-r * 0.22 * ay, -r * 0.92, r * 0.42, r * 0.36, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-rx * 0.8 * ay - r * 0.1, -r * 0.2);
      ctx.lineTo(-rx * 1.0 * ay - r * 0.35, r * 0.55);
      ctx.stroke();
    } else if (kind === "bun") {
      ctx.beginPath();
      ctx.arc(-r * 0.32 * ay, -r * 1.02, r * 0.3, 0, TAU);
      ctx.fill();
    } else if (kind === "woman") {
      ctx.beginPath();
      ctx.ellipse(-r * 0.25 * ay, -r * 1.12, r * 0.48, r * 0.34, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-r * 0.25 * ay - r * 0.7, -r * 1.2);
      ctx.lineTo(-r * 0.25 * ay + r * 0.7, -r * 1.0);
      ctx.stroke();
    } else if (kind === "child") {
      for (const sx of [-0.5, 0.45]) {
        ctx.beginPath();
        ctx.arc(r * sx * (1 - ay * 0.6) - r * 0.2 * ay, -r * 0.9, r * 0.26, 0, TAU);
        ctx.fill();
      }
    }
  }
  // ear
  if (ay > 0.3 && kind !== "scarf") {
    ctx.beginPath();
    ctx.ellipse(-r * 0.18 * ay, r * 0.06, r * 0.13, r * 0.22, 0, 0, TAU);
    ctx.stroke();
  }
  // eyes: two in front view, one in profile
  ctx.lineWidth = lw * 1.5;
  ctx.strokeStyle = HEAD.hair;
  const ey = -r * 0.04 - up;
  if (ay < 0.6) {
    const c = ay * r * 0.42;
    const e = r * 0.3 * (1 - ay * 0.55);
    for (const ex of [c - e, c + e]) {
      ctx.beginPath();
      ctx.moveTo(ex - r * 0.12, ey);
      ctx.lineTo(ex + r * 0.12, ey);
      ctx.stroke();
    }
    ctx.lineWidth = lw;
    ctx.strokeStyle = HEAD.line;
    ctx.beginPath();
    ctx.moveTo(c + r * 0.02, ey + r * 0.14);
    ctx.lineTo(c + r * 0.06, ey + r * 0.32);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(c - r * 0.07, r * 0.5 - up * 0.6);
    ctx.lineTo(c + r * 0.08, r * 0.5 - up * 0.6);
    ctx.stroke();
  } else {
    const ex = rx * 0.55;
    ctx.beginPath();
    ctx.moveTo(ex - r * 0.12, ey);
    ctx.lineTo(ex + r * 0.14, ey - r * 0.02);
    ctx.stroke();
    ctx.lineWidth = lw;
    ctx.strokeStyle = HEAD.line;
    ctx.beginPath();
    ctx.moveTo(rx * 0.7, r * 0.5);
    ctx.lineTo(rx * 0.86, r * 0.49);
    ctx.stroke();
  }
  if (pitch > 0.3) {
    // looking up: the underside of the jaw shows
    ctx.beginPath();
    ctx.moveTo(-rx * 0.1, r * 0.98);
    ctx.quadraticCurveTo(rx * 0.5, r * 1.12, rx * 0.95, r * 0.6);
    ctx.stroke();
  }
  // a beard on some of the men
  if (h.beard) {
    ctx.beginPath();
    ctx.moveTo(rx * lerp(-0.1, 0.5, ay), r * 0.72);
    ctx.lineTo(rx * lerp(0, 0.25, ay), r * 1.25);
    ctx.stroke();
  }
  ctx.restore();
  // a straw hat does not turn with the face very much
  if (kind === "hat") {
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(-pitch * 0.5 * side);
    ctx.lineWidth = lw;
    ctx.strokeStyle = HEAD.line;
    ctx.fillStyle = HEAD.hat;
    ctx.beginPath();
    ctx.moveTo(-r * 1.55, -r * 0.48);
    ctx.lineTo(-r * 0.25, -r * 1.42);
    ctx.lineTo(r * 0.25, -r * 1.42);
    ctx.lineTo(r * 1.55, -r * 0.48);
    ctx.quadraticCurveTo(0, -r * 0.7, -r * 1.55, -r * 0.48);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

/** Where the pelican's head is (roughly) when the pelican's road point is at x. */
const pelHead = (x) => [x + 28, road(x) - 119];

/** All the heads that turn, with their per-frame data. */
function buildHeads() {
  const out = [];
  for (const F of castFigures()) {
    const h = headOf(F);
    out.push({ ...h, kind: F.head, beard: hash(F.i, 3) > 0.6 && F.head === "cap", yaw0: F.yaw0 ?? 0.75 * F.dir, pitch0: 0, delay: F.delay || 0, point: F.point ? F : null });
  }
  for (const F of crewFigures()) {
    const h = headOf(F);
    out.push({ ...h, kind: F.head, yaw0: F.yaw0 ?? 0.8 * F.dir, pitch0: F.pose === "pole" || F.pose === "crouch" ? -0.25 : 0, delay: 0.1 * (F.i % 4), crew: true, roof: F.pose === "poleUp" });
  }
  for (const N of NEAR) {
    const { head } = nearSitter(N);
    out.push({ ...head, kind: N.head, yaw0: N.yaw0, pitch0: N.pitch0, delay: N.delay, near: true });
  }
  return out;
}
const HEADS = buildHeads();

/** Where a head looks at time u. */
function gaze(H, u) {
  const px = SPEED * (u - H.delay);
  const [tx, ty] = pelHead(px);
  const dx = tx - H.x;
  const dy = ty - H.y;
  if (H.crew) {
    const w = window4(u, 2.0 + H.delay * 0.5, 2.35 + H.delay * 0.5, 3.75 + H.delay * 0.3, 4.15 + H.delay * 0.3);
    // the two on the cabin roof keep their profile and tip their heads back (a front view shows no tilt)
    const look = H.roof ? H.yaw0 : clamp(dx / 70, -1, 1) * 0.8;
    return { yaw: lerp(H.yaw0, look, w), pitch: lerp(H.pitch0, 0.95, w), e: w };
  }
  const e = smoothstep(330, 250, Math.abs(dx));
  const look = clamp(dx / 95, -1, 1) * 0.96;
  const pitch = clamp(-dy / 140, -0.15, 0.45);
  return { yaw: lerp(H.yaw0, look, e), pitch: lerp(H.pitch0, pitch, e), e, tx, ty };
}

/** A pointing arm, raised once the pelican is near. */
function drawArm(ctx, F, g, u) {
  const raise = smoothstep(0.55, 0.95, g.e) * smoothstep(0, 0.3, u + 2);
  if (raise <= 0) return drawHangingArm(ctx, F);
  const P = POSES[F.pose];
  const sh = toW(F, [P.neck[0] + 1.5, P.neck[1] + 3]);
  const down = Math.atan2(1, 0.12 * F.dir);
  const aim = Math.atan2(g.ty - sh[1], g.tx - sh[0]);
  let da = aim - down;
  while (da > Math.PI) da -= TAU;
  while (da < -Math.PI) da += TAU;
  const a = down + da * raise;
  const L = 29 * F.s;
  const el = [sh[0] + Math.cos(a - 0.12 * F.dir) * L * 0.5, sh[1] + Math.sin(a - 0.12 * F.dir) * L * 0.5];
  const hand = [sh[0] + Math.cos(a) * L, sh[1] + Math.sin(a) * L];
  strokeSleeve(ctx, F, [sh, el, hand]);
  // the pointing finger
  ctx.beginPath();
  ctx.moveTo(hand[0], hand[1]);
  ctx.lineTo(hand[0] + Math.cos(a) * 4, hand[1] + Math.sin(a) * 4);
  ctx.strokeStyle = HEAD.line;
  ctx.lineWidth = 0.6;
  ctx.stroke();
}

function drawHangingArm(ctx, F) {
  const P = POSES[F.pose];
  strokeSleeve(ctx, F, [toW(F, [P.neck[0] + 1.5, P.neck[1] + 3]), toW(F, P.eN), toW(F, P.hN)]);
}

const ARM_FILL = {};
function strokeSleeve(ctx, F, pts) {
  const poly = capsule(pts, [7 * F.s, 7 * F.s, 8 * F.s]);
  ctx.beginPath();
  poly.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
  ctx.closePath();
  if (!ARM_FILL[F.col]) {
    const c = [1, 3, 5].map((i) => parseInt(F.col.slice(i, i + 2), 16));
    // the sleeve's wash as it reads on the sheet (about 40 % colour on white)
    ARM_FILL[F.col] = `rgb(${c.map((v) => Math.round(255 + (v - 255) * 0.41)).join(",")})`;
  }
  ctx.fillStyle = ARM_FILL[F.col];
  ctx.fill();
  ctx.strokeStyle = HEAD.line;
  ctx.lineWidth = 0.5;
  ctx.lineJoin = "round";
  ctx.stroke();
  const hand = pts[pts.length - 1];
  ctx.beginPath();
  ctx.arc(hand[0], hand[1], 1.7 * F.s, 0, TAU);
  ctx.fillStyle = HEAD.face;
  ctx.fill();
  ctx.lineWidth = 0.4;
  ctx.stroke();
}

/** near: null = every head, false = all but the near sitters, true = only those. */
function drawHeads(stage, f, near = null) {
  const view = f.view;
  const b = view.bounds(f.w, f.h);
  // the patch spans the whole width of the view, so its canvas keeps one size
  // (a canvas that changes size each frame costs a new texture each frame)
  const x0 = b.x0;
  const x1 = b.x1;
  const y0 = Math.max(near ? 600 : 470, b.y0);
  const y1 = Math.min(near ? 700 : 720, b.y1);
  if (x1 <= x0 || y1 <= y0) return;
  if (near && !HEADS.some((H) => H.near && H.x > x0 - 20 && H.x < x1 + 20)) return;
  const patch = stage.patch(near ? "qingming/nearheads" : "qingming/heads", view, x0, y0, x1, y1);
  const ctx = patch.ctx;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x0 - 10, y0 - 10, x1 - x0 + 20, y1 - y0 + 20);
  let any = false;
  for (const H of HEADS) {
    if (near !== null && !!H.near !== near) continue;
    if (H.x < x0 - 20 || H.x > x1 + 20) continue;
    any = true;
    const g = gaze(H, f.u);
    if (H.point) drawArm(ctx, H.point, g, f.u);
    drawHead(ctx, H, g.yaw, g.pitch);
  }
  if (any) stage.blend(stage.p.MULTIPLY, () => stage.imagePatch(patch));
}

// ------------------------------------------------------------------ the title slip
const SLIP = { x: 60, y: 446, w: 36, h: 124 };
const TITLE = { x: 56, y: 440, w: 226, h: 136 };

function titleSprite(stage, os) {
  return sprite(stage, `qingming/title/${os.toFixed(3)}`, TITLE.w * os, TITLE.h * os, (ctx) => {
    ctx.scale(os, os);
    ctx.translate(-TITLE.x, -TITLE.y);
    // the slip: a strip of paler silk with a fine border
    ctx.fillStyle = "rgba(232,219,186,0.93)";
    ctx.fillRect(SLIP.x, SLIP.y, SLIP.w, SLIP.h);
    ctx.strokeStyle = "rgba(70,60,48,0.8)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(SLIP.x + 0.5, SLIP.y + 0.5, SLIP.w - 1, SLIP.h - 1);
    ctx.lineWidth = 0.3;
    ctx.strokeRect(SLIP.x + 2.4, SLIP.y + 2.4, SLIP.w - 4.8, SLIP.h - 4.8);
    const ink = "#1f1a15";
    [...META.zh].forEach((ch, i) => drawText(ctx, ch, SLIP.x + SLIP.w / 2, SLIP.y + 7 + i * 22.6, { font: font(FONTS.kai, 22, 700), align: "center", baseline: "top", fill: ink }));
    // the date, a small column beside the slip
    [..."约公元一一〇〇年"].forEach((ch, i) => drawText(ctx, ch, 106, 448 + i * 11.9, { font: font(FONTS.kai, 11, 400), align: "center", baseline: "top", fill: ink }));
    // the English, in two lines of serif italic
    drawText(ctx, "Along the River During", 116, 463.5, { font: font(FONTS.serif, 13, 400, "italic"), align: "left", fill: ink });
    drawText(ctx, `the Qingming Festival · ${META.dateEn}`, 116, 479.5, { font: font(FONTS.serif, 13, 400, "italic"), align: "left", fill: ink });
    // a red seal, the characters left as silk
    ctx.fillStyle = "rgba(160,40,28,0.88)";
    ctx.fillRect(117, 486, 14, 14);
    drawText(ctx, "鹈", 124, 486.6, { font: font(FONTS.kai, 6.6, 700), align: "center", baseline: "top", fill: "#efe2c8" });
    drawText(ctx, "鹕", 124, 492.8, { font: font(FONTS.kai, 6.6, 700), align: "center", baseline: "top", fill: "#efe2c8" });
  });
}

// ------------------------------------------------------------------ the pelican, in fine line and pale colour
const PELICAN = { white: "#f3ecdc", ochre: "#c8a04c", pouch: "#dcbf7c", leg: "#9a4e30", legFar: "#7a4430" };

function paintPelican(pen, stage, skel) {
  const S = skel.scale;
  const u = S / 21.2;
  pen.reset();
  const draw = (sh) => {
    if (sh.kind === "circle") pen.circle(sh.c[0], sh.c[1], sh.r, 0.1);
    else if (sh.pts.length === 2) pen.line(sh.pts[0][0], sh.pts[0][1], sh.pts[1][0], sh.pts[1][1]);
    else if (sh.closed) pen.polygon(sh.pts);
    else pen.spline(sh.pts, 0.4);
  };
  const line = (color, width) => {
    pen.noWash();
    inkBrush(pen, "line", color, width * u);
  };
  const flat = (color, alpha) => pen.noStroke().wash(color, alpha);
  // grouped by colour: fills first, then the ink of the machine, then the outline
  const groups = [
    [["body", "neck", "head", "crest"], () => flat(PELICAN.white, 248)],
    [["wing"], () => flat("#e2d8c2", 240)],
    [["tail", "wingtip"], () => flat("#5a5650", 220)],
    [["pouch"], () => flat(PELICAN.pouch, 236)],
    [["bill"], () => flat(PELICAN.ochre, 240)],
    [["saddle", "pedal", "hub"], () => flat(INK.nong, 240)],
  ];
  let n = 0;
  for (const sh of skel.shapes) {
    n += 1;
    stage.reseed(6100 + n * 37);
    const far = sh.side === "far";
    switch (sh.tag) {
      case "tire":
        line(INK.nong, 2.6);
        draw(sh);
        break;
      case "rim":
      case "ring":
        line(INK.zhong, 0.8);
        draw(sh);
        break;
      case "spoke":
      case "chain":
        line(INK.zhong, 0.6);
        draw(sh);
        break;
      case "frame":
        line(INK.nong, 3.0);
        draw(sh);
        break;
      case "post":
      case "bar":
      case "crank":
      case "grip":
        line(INK.nong, 2.1);
        draw(sh);
        break;
      case "leg":
        line(far ? PELICAN.legFar : PELICAN.leg, 2.3);
        draw(sh);
        break;
      case "foot":
        flat(far ? PELICAN.legFar : PELICAN.leg, 236);
        draw(sh);
        break;
      case "pupil":
        flat(INK.nong, 255);
        pen.circle(sh.c[0], sh.c[1], sh.r * 1.05, 0.1);
        break;
      default: {
        const g = groups.find(([tags]) => tags.includes(sh.tag));
        if (g) {
          g[1]();
          draw(sh);
        }
      }
    }
  }
  stage.reseed(6400);
  line(INK.nong, 1.0);
  for (const sh of skel.shapes) {
    if (["body", "neck", "head", "bill", "pouch", "wing", "tail", "wingtip", "foot"].includes(sh.tag)) pen.polygon(sh.pts);
    else if (sh.tag === "wingfold") pen.spline(sh.pts, 0.4);
    else if (sh.tag === "eye") pen.circle(sh.c[0], sh.c[1], sh.r, 0.1);
  }
}

/**
 * The pelican goes over the painting; then what stands in front of it (the
 * near railing, the people sitting on it) is put back from the frame as it was
 * before the pelican was drawn: base `A`, cut to those silhouettes.
 */
function drawPelican(stage, f, A) {
  const { p } = stage;
  const skel = solveRig({ ...f.pelican, act: { wind: 0.6 } });
  const b = skel.bounds;
  stage.seed(6000);
  withPen(stage, f.view, (pen) => paintPelican(pen, stage, skel));
  if (!A || b.x1 < 120 || b.x0 > 880 || b.y1 < MASK.y0) return;
  const inv = bakeMask(stage);
  const B = stage.fb(`qingming/b/${f.w}x${f.h}`, f.w, f.h);
  stage.into(B, () => {
    stage.image(A, 0, 0, f.w, f.h);
    stage.withView(f.view, () => {
      stage.blend(p.REMOVE, () => {
        stage.image(inv, MASK.x0, MASK.y0, MASK.x1 - MASK.x0, MASK.y1 - MASK.y0);
        p.noStroke();
        p.fill(255);
        // everything outside the mask's band goes too
        p.rect(-5000, -5000, 11000, 5000 + MASK.y0);
        p.rect(-5000, MASK.y1, 11000, 5000);
        p.rect(-5000, MASK.y0 - 1, 5000 + MASK.x0, MASK.y1 - MASK.y0 + 2);
        p.rect(MASK.x1, MASK.y0 - 1, 5000, MASK.y1 - MASK.y0 + 2);
      });
    });
  });
  stage.origin();
  stage.image(B, 0, 0, f.w, f.h);
}

// ------------------------------------------------------------------ camera: lift and ease back a little over the crown
function sceneCamera(u) {
  const w = smoothstep(2.0, 2.85, u) * (1 - smoothstep(3.25, 4.0, u));
  return { dx: 0, dy: -10 * w, zoom: 1 - 0.1 * w };
}

export const qingming = {
  ...META,
  road,
  camera: sceneCamera,
  still: { u: 3.0 },

  init(stage) {
    bakeWorld(stage);
    bakeMask(stage);
  },

  render(stage, f) {
    const view = f.view;
    const base = () => {
      stage.origin();
      inkGround(stage, view, GROUNDS.silk);
      const world = bakeWorld(stage);
      stage.withView(view, () => layInk(stage, world, R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0));
      // the title slip, written on the silk at the upper left
      const title = titleSprite(stage, Math.min(6, Math.round(view.k * 4) / 4));
      stage.withView(view, () => stage.image(title, TITLE.x, TITLE.y, TITLE.w, TITLE.h));
    };
    if (!f.pelican.visible) {
      base();
      drawHeads(stage, f, null);
      return;
    }
    // the near railing only has to be put back where the pelican overlaps it
    const px = f.pelican.x;
    if (px < 120 - 70 || px > 880 + 70) {
      base();
      drawHeads(stage, f, false);
      drawPelican(stage, f, null);
      drawHeads(stage, f, true);
      return;
    }
    const A = stage.fb(`qingming/a/${f.w}x${f.h}`, f.w, f.h);
    stage.into(A, base);
    stage.origin();
    stage.image(A, 0, 0, f.w, f.h);
    drawHeads(stage, f, false);
    drawPelican(stage, f, A);
    drawHeads(stage, f, true);
  },
};

// for dev/experiments/qingming-time.js: the painting program's parts, to time them
export const __lab = {
  Plate, R, PX, View, blankSheet, withPen,
  parts: {
    bank: (P) => paintFarBank(P),
    ends: (P) => paintEnds(P),
    boat: (P) => paintBoat(P),
    crew: (P) => paintFigures(P, crewFigures()),
    abut: (P) => paintAbutments(P),
    arch: (P) => paintArch(P),
    deck: (P) => paintDeck(P),
    stall: (P) => { paintSleeperStall(P); paintChair(P); paintDonkey(P); },
    cast: (P) => paintFigures(P, castFigures()),
    near: (P) => { paintNearRail(P); paintNearSitters(P); },
  },
};
