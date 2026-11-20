// Section 3. 汉画像石拓片 · Han stone relief rubbing (c. 100 CE).
//
// Not the stone but an ink rubbing of it: xuan paper laid on an incised Han
// pictorial stone and dabbed with an ink pad. The stone's face prints black in
// speckled, overlapping dabs; every cut line stays the white of the paper.
// A carriage procession (車馬出行) travels with the pelican, which rides in
// its middle in the same white line. Its label is the one patch nobody has
// inked yet; in bar 2 the pad comes down on it four times and 此鵜鶘車 appear.
//
// How it is built
//   static mask   a 2D canvas over the whole stone (borders, feast register,
//                 title panel, animal frieze, cracks, pits, chipped sheet edge),
//                 baked once: R = cut line, G = inked sheet, B = fine lettering
//   moving mask   a screen-sized framebuffer redrawn per frame from cached
//                 sprites (horses per gait step, carriages, wheels, labels)
//                 and the pelican: R = cut line, G = blank paper, B = wet ink
//   rubbing pass  one shader turns both masks into ink coverage (dabs,
//                 speckle, chisel striation, broken edges) and multiplies it
//                 onto the shared xuan ground. Edge grain of moving lines is
//                 anchored to the procession (the pelican's x), the rest to
//                 the world.

import { sectionMeta } from "./sections.js";
import { Layer2D } from "../kit/stage.js";
import { VERT, FRAG_HEAD, NOISE, rgb } from "../kit/glsl.js";
import { INK, GROUNDS, inkGround } from "../kit/ink.js";
import { sprite } from "../kit/text.js";
import { sampler, fbm2 } from "../kit/rng.js";
import { smoothstep } from "../beat/ease.js";
import { solveRig } from "../rig/rig.js";

const META = sectionMeta(3);

const LIBIAN = "'Libian SC', 'Baoli SC', 'STKaiti', serif";
const LATIN = "'Optima', 'Gill Sans', 'Trebuchet MS', sans-serif";

const MASK = { x0: -80, y0: 432, x1: 1080, y1: 792 };
const SHEET = { y0: 452, y1: 772 };
const MASK_PX = 3.3; // static mask pixels per unit at 1080p
const SPR_PX = 3.4; // sprite pixels per unit at 1080p
const GROUND = 701.6; // the incised ground line under hooves and wheels
const STEPS = 6; // gait positions per stride
const STRIDE = 0.5; // one stride per beat

// ------------------------------------------------------------------ geometry helpers
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];

function crSample(pts, closed, seg = 6) {
  const n = pts.length;
  if (n < 3) return pts.slice();
  const out = [];
  const get = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i += 1) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    for (let s = 0; s < seg; s += 1) {
      const t = s / seg;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

/** Resample a polyline into straight cuts of about `step` units. */
function even(pts, step, closed) {
  const src = closed ? pts.concat([pts[0]]) : pts;
  const out = [src[0]];
  let carry = 0;
  for (let i = 1; i < src.length; i += 1) {
    const a = src[i - 1];
    const b = src[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let d = step - carry;
    while (d <= len) {
      const t = d / len;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      d += step;
    }
    carry = len - (d - step);
  }
  const lastPt = src[src.length - 1];
  const tail = out[out.length - 1];
  if (Math.hypot(lastPt[0] - tail[0], lastPt[1] - tail[1]) > step * 0.3) out.push(lastPt);
  if (closed) out.pop();
  return out;
}

/** Curves made of short straight cuts, as a chisel makes them. */
const chisel = (pts, closed = false, step = 4) => even(crSample(pts, closed, 6), step, closed);

/** Map local points (facing right, y up negative) to the world: origin (x, y), scale s, facing ±1. */
const place = (pts, x, y, s = 1, facing = 1) => pts.map((q) => [x + q[0] * s * facing, y + q[1] * s]);

// ------------------------------------------------------------------ cutting on a 2D canvas
// Everything is drawn in "cut" colour on black: cut = paper, black = stone that takes ink.
const Cut = { color: "#fff" };

function trace(ctx, pts, closed) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  if (closed) ctx.closePath();
}

/** An incised line. */
function cut(ctx, pts, w = 1.9, closed = false) {
  if (pts.length < 2) return;
  ctx.strokeStyle = Cut.color;
  ctx.lineWidth = w;
  ctx.lineJoin = "miter";
  ctx.miterLimit = 3;
  ctx.lineCap = "round";
  trace(ctx, pts, closed);
  ctx.stroke();
}

/** Stone left standing (black): hides whatever was cut behind a figure. */
function knock(ctx, pts) {
  ctx.fillStyle = "#000";
  trace(ctx, pts, true);
  ctx.fill();
}

/** A cut-away area (white). */
function hollow(ctx, pts) {
  ctx.fillStyle = Cut.color;
  trace(ctx, pts, true);
  ctx.fill();
}

/** A figure part: knocked out, then outlined. */
function shape(ctx, pts, w = 1.9, step = 4) {
  const q = chisel(pts, true, step);
  knock(ctx, q);
  cut(ctx, q, w, true);
}

const line = (ctx, pts, w = 1.6, step = 4) => cut(ctx, chisel(pts, false, step), w);

function ring(ctx, cx, cy, r, w = 1.6, n = 16) {
  const pts = [];
  for (let i = 0; i < n; i += 1) pts.push([cx + Math.cos((i / n) * 6.2832) * r, cy + Math.sin((i / n) * 6.2832) * r]);
  cut(ctx, pts, w, true);
}

function dot(ctx, cx, cy, r) {
  ctx.fillStyle = Cut.color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 6.2832);
  ctx.fill();
}

/** A limb as a tapered strip around a chain of points: [[x, y], ...], widths per point. */
function limb(chain, widths) {
  const L = [];
  const R = [];
  for (let i = 0; i < chain.length; i += 1) {
    const a = chain[Math.max(0, i - 1)];
    const b = chain[Math.min(chain.length - 1, i + 1)];
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
    const h = widths[i] / 2;
    L.push([chain[i][0] - dy * h, chain[i][1] + dx * h]);
    R.push([chain[i][0] + dy * h, chain[i][1] - dx * h]);
  }
  return L.concat(R.reverse());
}

// ------------------------------------------------------------------ the Han horse
// Local units: facing right, origin on the ground under the girth, y up negative.
const HORSE_BODY = [
  [-34, -50], [-27.5, -55], [-16, -54.5], [-5, -51], [4, -52], [11, -57], [16, -67], [22, -77], [29, -84], [35, -87.5],
  [40, -86.5], [44, -80], [47, -73], [49.5, -67], [47.5, -63.5], [43, -64], [39, -67], [35.5, -70], [33, -67.5],
  [32.5, -60], [35, -52], [38.5, -45], [37.5, -37.5], [32, -31], [24, -26.5], [12, -24.5], [0, -26], [-12, -29.5],
  [-22, -33], [-31, -36], [-38, -41], [-39.5, -47],
];
const FORE_BASE = [24, -36];
const HIND_BASE = [-27, -32];
// knee, hoof relative to the base (ground at +36 / +32); six positions of one trot stride
const FORE = [
  [[5, 15], [9, 36]],
  [[1, 16], [0, 36]],
  [[-4, 15], [-11, 35.5]],
  [[4, 13.5], [-8, 27]],
  [[15, 5], [12, 20]],
  [[13, 9], [21, 28]],
];
const HIND = [
  [[-4, 15], [2, 32]],
  [[-8, 15], [-6, 32]],
  [[-13, 13], [-17, 31.5]],
  [[-14, 10], [-21, 24]],
  [[-9, 9], [-9, 22]],
  [[-5, 12], [2, 27]],
];
const BOB = [0, -0.9, -0.4, 0, -0.9, -0.4];
const RISE = [0, -1.6, -0.7, 0, -1.6, -0.7];

function legChain(base, kneeRel, hoofRel, isFore) {
  const top = add(base, [isFore ? -1 : 2, -10]);
  const knee = add(base, kneeRel);
  const hoof = add(base, hoofRel);
  // fetlock a little above the hoof, set back so the pastern slopes
  const fet = [hoof[0] + (knee[0] - hoof[0]) * 0.22 - 1.2, hoof[1] + (knee[1] - hoof[1]) * 0.22];
  return [top, knee, fet, hoof];
}

function drawLeg(ctx, chain, near) {
  const strip = limb(chain, [11, 4.6, 3.4, 4.4]);
  knock(ctx, strip);
  cut(ctx, strip, near ? 1.7 : 1.5, true);
}

/** One Han horse at gait step `st`. kind: "ride" | "cart". */
function drawHorse(ctx, st, kind) {
  const by = BOB[st];
  const B = (pts) => pts.map((q) => [q[0], q[1] + by]);
  const fNear = FORE[st];
  const hNear = HIND[st];
  const fFar = FORE[(st + 3) % STEPS];
  const hFar = HIND[(st + 3) % STEPS];
  // far legs, a little forward and higher, behind everything
  const farShift = (c) => c.map((q, i) => (i === 0 ? [q[0] + 3, q[1] + by] : [q[0] + 3, q[1] - 1.2]));
  drawLeg(ctx, farShift(legChain(HIND_BASE, hFar[0], hFar[1], false)), false);
  drawLeg(ctx, farShift(legChain(FORE_BASE, fFar[0], fFar[1], true)), false);
  // tail, tied in a knot, then flaring
  const tail = B([[-36, -53], [-41, -58], [-45.5, -59], [-48, -55], [-51, -48], [-56, -40], [-53, -40.5], [-50, -44.5], [-47, -48.5], [-43, -51.5], [-37.5, -49]]);
  shape(ctx, tail, 1.6, 2.6);
  line(ctx, B([[-48.5, -52], [-52.5, -44.5], [-54, -41]]), 1.0, 3);
  line(ctx, B([[-41.5, -56.5], [-45, -52.5]]), 1.2, 2);
  line(ctx, B([[-43.5, -57.5], [-47, -53.5]]), 1.2, 2);
  // near legs
  drawLeg(ctx, legChain(HIND_BASE, hNear[0], hNear[1], false).map((q, i) => (i === 0 ? [q[0], q[1] + by] : q)), true);
  drawLeg(ctx, legChain(FORE_BASE, fNear[0], fNear[1], true).map((q, i) => (i === 0 ? [q[0], q[1] + by] : q)), true);
  // body, neck and head in one contour
  shape(ctx, B(HORSE_BODY), 2.0, 3.6);
  // ears and the tied forelock
  shape(ctx, B([[33.5, -86.5], [32.5, -94.5], [37.5, -87.5]]), 1.4, 2);
  line(ctx, B([[36, -88], [37.5, -93], [41.5, -94.5]]), 1.3, 2);
  // inner lines: mane, cheek, eye, nostril, bridle
  line(ctx, B([[13, -58], [18, -67], [24, -76], [30, -82], [34, -84.5]]), 1.2, 3.5);
  for (let i = 0; i < 5; i += 1) {
    const t = 0.15 + i * 0.17;
    const a = [13 + (34 - 13) * t, -58 + (-84.5 + 58) * t];
    line(ctx, B([a, [a[0] - 2.6, a[1] - 3.2]]), 1.0, 2);
  }
  line(ctx, B([[35.5, -78], [40.5, -75], [42.5, -69.5], [40.5, -66.5]]), 1.2, 2.5);
  dot(ctx, 40.2, -80.6 + by, 1.05);
  line(ctx, B([[45, -71], [48.5, -70]]), 1.1, 2);
  line(ctx, B([[37.5, -85.5], [42, -72], [46.5, -65.5]]), 1.0, 3);
  if (kind === "ride") {
    // breast strap, saddle cloth and girth
    line(ctx, B([[35.5, -50], [28, -45], [17, -46]]), 1.3, 3);
    shape(ctx, B([[-15, -54], [-17, -39], [-1, -37.5], [7, -40], [6, -53], [-4, -52]]), 1.5, 3);
    line(ctx, B([[-13, -42], [5, -41]]), 1.0, 3);
    line(ctx, B([[-29, -52], [-35, -44], [-34, -39]]), 1.2, 3);
  } else {
    // yoke saddle on the withers, breast band and belly band
    shape(ctx, B([[7, -55], [9.5, -63], [12.5, -63.5], [15, -56]]), 1.4, 2);
    line(ctx, B([[13, -57], [25, -48], [36.5, -47]]), 1.4, 3);
    line(ctx, B([[6, -52], [5, -26]]), 1.2, 3);
  }
}

// ------------------------------------------------------------------ riders and passengers
function drawRider(ctx, st, kind) {
  const ry = BOB[st] + RISE[st] - 3.5;
  const R = (pts) => pts.map((q) => [q[0], q[1] + ry]);
  // the near leg hanging over the flank
  shape(ctx, R([[-4, -49], [6, -47], [9, -41], [7.5, -33], [11, -31.5], [10.5, -29.5], [4.5, -30], [3.5, -40], [-4, -42]]), 1.6, 3);
  // robe and torso, the skirt flaring over the horse's back
  shape(ctx, R([[-15, -48], [-12, -56], [-9, -66], [-6, -73], [-1, -76], [4, -75], [6, -70], [6, -61], [9, -52], [12, -47], [3, -45], [-6, -46]]), 1.9, 3);
  line(ctx, R([[-1.5, -75.5], [1.5, -69], [4.5, -75]]), 1.1, 2);
  line(ctx, R([[-9.5, -60], [6.5, -59]]), 1.1, 3);
  // head and cap
  shape(ctx, R([[-3.5, -77], [-4, -82], [-1.5, -85.5], [3, -85.5], [5, -81.5], [4, -77.5], [0.5, -76]]), 1.6, 2);
  shape(ctx, R([[-4.5, -84], [-3.5, -89], [1, -92], [5.5, -90.5], [5, -86], [-0.5, -85]]), 1.5, 2);
  dot(ctx, 3.2, -81.8 + ry, 0.8);
  if (kind === "lance") {
    // arm forward on the lance, which rises ahead with a pennon streaming back
    const tip = [47, -126 + ry];
    const butt = [-14, -15 + ry];
    cut(ctx, [butt, tip], 1.7);
    shape(ctx, [[tip[0], tip[1] - 6], [tip[0] + 2.4, tip[1] + 1], [tip[0] - 1.6, tip[1] + 3]], 1.3, 2);
    const p1 = [tip[0] - 4.2, tip[1] + 7.5];
    const p2 = [tip[0] - 7.6, tip[1] + 13.5];
    shape(ctx, [p1, [p1[0] - 12, p1[1] - 1], [p2[0] - 13, p2[1] + 1], p2], 1.4, 3);
    line(ctx, [[p2[0] - 13, p2[1] + 1], [p2[0] - 20, p2[1] - 1.5], [p2[0] - 27, p2[1] + 1.5], [p2[0] - 33, p2[1] - 0.5]], 1.2, 3);
    line(ctx, [[p1[0] - 12, p1[1] - 1], [p1[0] - 19, p1[1] - 4], [p1[0] - 26, p1[1] - 1.5]], 1.1, 3);
    shape(ctx, R([[1, -72], [8, -67.5], [13.5, -66.5], [13, -61.5], [7, -62], [0, -64]]), 1.5, 2.5);
  } else {
    // reins in the hands; a sword at the hip
    shape(ctx, R([[1, -72], [7, -66], [13, -62], [12.5, -58.5], [5.5, -60.5], [0, -64]]), 1.5, 2.5);
    cut(ctx, [[13, -60 + ry], [32, -61 + BOB[st]], [47, -65 + BOB[st]]], 1.0);
    line(ctx, R([[-16, -43], [-4, -53]]), 1.6, 3);
  }
}

/** A figure seated in a carriage: robe mound, head, cap. tall = an official's cap. */
function seated(ctx, x, y, s, tall, armForward) {
  const P = (pts) => place(pts, x, y, s);
  shape(ctx, P([[-9, 0], [-9, -9], [-6, -17], [-2, -21], [3, -20.5], [6, -15], [9, -7], [10, 0]]), 1.7, 3);
  line(ctx, P([[-1.5, -20.5], [1.5, -15], [4.5, -20]]), 1.0, 2);
  shape(ctx, P([[-2.5, -21.5], [-3, -26.5], [0, -29.5], [4, -28.5], [5, -24.5], [3, -21.5]]), 1.5, 2);
  if (tall) shape(ctx, P([[-3, -28.5], [-1, -36], [3.5, -36.5], [2.5, -32], [5, -29]]), 1.4, 2);
  else shape(ctx, P([[-3.5, -27.5], [-2, -32], [3.5, -31.5], [4.5, -28]]), 1.4, 2);
  if (armForward) shape(ctx, P([[2, -17], [9, -14], [15, -13], [14.5, -10], [8, -10.5], [2, -12]]), 1.4, 2.5);
  dot(ctx, x + 3 * s, y - 25.5 * s, 0.7);
}

// ------------------------------------------------------------------ carriages
// Local units: origin on the ground under the wheel's hub, horse centre at +HORSE_AHEAD.
const WHEEL_R = 30;
const HORSE_AHEAD = 90;

function drawCart(ctx, st, kind) {
  const hb = BOB[st];
  const ry = (RISE[st] + BOB[st]) * 0.45;
  const hx = HORSE_AHEAD;
  // the single curved shaft from the box up to the yoke on the withers
  const yoke = [hx + 11, -63 + hb];
  line(ctx, [[20, -45], [40, -52], [58, -62], [78, -68], yoke], 2.1, 4);
  line(ctx, [[22, -42], [41, -48.5], [59, -58.5], [79, -64.5], [hx + 8, -59 + hb]], 1.2, 4);
  if (kind === 1) {
    // 轺车: open box, driver kneeling, official seated, parasol
    line(ctx, [[-2, -64 + ry], [-2, -126 + ry]], 1.8, 6);
    seated(ctx, -6, -50 + ry, 1.05, true, false);
    seated(ctx, 13, -50 + ry, 0.92, false, true);
    // reins to the horse's mouth
    cut(ctx, [[27, -61 + ry], [62, -58 + hb], [hx + 47, -65 + hb]], 1.0);
    shape(ctx, [[-22, -43], [-22, -61 + ry], [-17, -61 + ry], [-17, -52], [21, -52], [24, -43]], 1.8, 3);
    for (const x of [-13, -6, 1, 8, 15]) line(ctx, [[x, -52], [x, -44]], 1.0, 2);
    // parasol: canopy of short cuts, ribs, tassels
    const top = -128 + ry;
    const canopy = [[-33, top + 12], [-22, top + 3], [-2, top - 2], [18, top + 3], [29, top + 12], [24, top + 11.5], [-2, top + 6], [-28, top + 11.5]];
    shape(ctx, canopy, 1.8, 3.5);
    for (const rx of [-22, -12, 8, 18]) line(ctx, [[-2, top + 5], [rx, top + 10]], 0.9, 3);
    line(ctx, [[-33, top + 12], [-34, top + 21]], 1.2, 3);
    line(ctx, [[29, top + 12], [30, top + 21]], 1.2, 3);
  } else {
    // 辎车: a covered box with a tall arched canopy, the driver outside in front
    const r = ry;
    shape(ctx, [[-26, -37], [-26, -92 + r], [-21, -101 + r], [-2, -106 + r], [18, -101 + r], [24, -93 + r], [22, -90 + r], [21, -37]], 1.9, 3.5);
    line(ctx, [[-28, -92 + r], [-21, -97 + r], [-2, -101 + r], [17, -97 + r], [24, -92 + r]], 1.2, 3.5);
    for (const x of [-17, -8, 1, 10]) line(ctx, [[x, -90 + r], [x - 0.5, -56]], 1.0, 4);
    line(ctx, [[-26, -56], [21, -56]], 1.2, 4);
    shape(ctx, [[3, -66 + r], [3, -84 + r], [15, -84 + r], [15, -66 + r]], 1.3, 3);
    seated(ctx, 9.5, -66 + r, 0.62, true, false);
    seated(ctx, 30, -39 + r, 0.9, false, true);
    cut(ctx, [[43, -50 + r], [66, -56 + hb], [hx + 47, -65 + hb]], 1.0);
  }
  ctx.save();
  ctx.translate(hx, 0);
  drawHorse(ctx, st, "cart");
  ctx.restore();
}

function drawWheel(ctx) {
  const pts = [];
  const n = 26;
  for (let i = 0; i < n; i += 1) pts.push([Math.cos((i / n) * 6.2832) * (WHEEL_R + 1), Math.sin((i / n) * 6.2832) * (WHEEL_R + 1)]);
  knock(ctx, pts);
  ring(ctx, 0, 0, WHEEL_R, 2.1, 26);
  ring(ctx, 0, 0, WHEEL_R - 3.4, 1.3, 24);
  ring(ctx, 0, 0, 6.5, 1.5, 10);
  dot(ctx, 0, 0, 3.0);
  for (let i = 0; i < 18; i += 1) {
    const a = (i / 18) * 6.2832;
    cut(ctx, [[Math.cos(a) * 7.5, Math.sin(a) * 7.5], [Math.cos(a) * (WHEEL_R - 3.8), Math.sin(a) * (WHEEL_R - 3.8)]], 1.15);
  }
}

// ------------------------------------------------------------------ labels (榜题)
const LABEL_W = 30;
const CELL = 17;
const labelH = (n) => n * CELL + 6;

/** Label frame and characters, white on stone. Top-left at (x, y). */
function drawLabel(ctx, x, y, chars) {
  const h = labelH(chars.length);
  knock(ctx, [[x, y], [x + LABEL_W, y], [x + LABEL_W, y + h], [x, y + h]]);
  cut(ctx, [[x + 1, y + 1], [x + LABEL_W - 1, y + 1], [x + LABEL_W - 1, y + h - 1], [x + 1, y + h - 1]], 1.7, true);
  ctx.fillStyle = Cut.color;
  ctx.font = `400 17px ${LIBIAN}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  chars.forEach((c, i) => ctx.fillText(c, x + LABEL_W / 2, y + 3 + CELL * (i + 0.5) + 0.6));
}

// ------------------------------------------------------------------ the procession
// Offsets from the pelican's x; listed back to front.
const MEMBERS = [
  { kind: "ride", rider: "lance", dx: 414, dy: -2.5, phase: 0 },
  { kind: "ride", rider: "attend", dx: -333, dy: -2.5, phase: 1 },
  { kind: "cart", cart: 1, dx: 165, dy: 0, phase: 2, label: ["功", "曹", "车"], lx: 57 },
  { kind: "cart", cart: 2, dx: -238, dy: 0, phase: 4, label: ["主", "簿", "车"], lx: 54 },
  { kind: "ride", rider: "lance", dx: 377, dy: 0, phase: 3 },
  { kind: "ride", rider: "attend", dx: -371, dy: 0, phase: 4 },
];
const LABEL_Y = 574;
const PEL_LABEL = { dx: 78, y: 560, chars: ["此", "鹈", "鹕", "车"] };
const TAPS = [2.0, 2.5, 3.0, 3.5];

const RIDE_BOX = { x0: -64, y0: -140, x1: 62, y1: 4 };
const CART_BOX = { x0: -40, y0: -132, x1: HORSE_AHEAD + 62, y1: 4 };

function spriteFor(stage, key, box, draw) {
  const k = SPR_PX * stage.s;
  const w = (box.x1 - box.x0) * k;
  const h = (box.y1 - box.y0) * k;
  return sprite(stage, `han/spr/${key}/${k.toFixed(3)}`, w, h, (ctx) => {
    ctx.setTransform(k, 0, 0, k, -box.x0 * k, -box.y0 * k);
    const prev = Cut.color;
    Cut.color = "#f00";
    draw(ctx);
    Cut.color = prev;
  });
}

const gaitStep = (u, phase) => (((Math.floor(u * (STEPS / STRIDE) + 1e-6) + phase) % STEPS) + STEPS) % STEPS;

// ------------------------------------------------------------------ the static stone
function drawFeastFigure(ctx, x, y, facing, pose, sc = 1) {
  const P = (pts) => place(pts, x, y, sc, facing);
  shape(ctx, P([[-13, 0], [-14, -6], [-12, -16], [-9, -26], [-6, -32], [-2, -35.5], [4, -35.5], [8, -31.5], [10, -24], [12, -14], [15, -6], [16, 0]]), 1.9, 3.5);
  line(ctx, P([[-1, -35], [2, -29], [5, -35]]), 1.1, 2);
  line(ctx, P([[-12.5, -3.5], [15, -3.5]]), 1.1, 4);
  line(ctx, P([[-9.5, -21.5], [10.5, -21.5]]), 1.0, 4);
  shape(ctx, P([[-3.5, -36], [-4, -41], [-1.5, -45.5], [3, -46], [5.5, -42], [5, -37.5], [1, -35.5]]), 1.6, 2);
  if (pose === 0) shape(ctx, P([[-4, -43.5], [-3, -50], [3, -53], [7, -50.5], [5.5, -45]]), 1.4, 2);
  else shape(ctx, P([[-4.5, -44], [-2, -49], [4.5, -48.5], [6, -44.5]]), 1.4, 2);
  dot(ctx, x + 3.2 * facing * sc, y - 41.5 * sc, 0.8);
  if (pose === 2) {
    // the sleeve raised in a gesture
    shape(ctx, P([[4, -32], [9, -38], [13, -46], [16.5, -45.5], [13.5, -36], [9, -27]]), 1.5, 2.5);
  } else {
    // a sleeve forward, an ear-cup in the hand
    shape(ctx, P([[4, -31], [12, -28], [18.5, -27], [19.5, -23], [12.5, -21], [6, -22]]), 1.5, 2.5);
    shape(ctx, P([[18.5, -29.5], [25, -29.5], [23.5, -27], [19.5, -27]]), 1.2, 2);
  }
}

function drawServant(ctx, x, y, facing) {
  const P = (pts) => place(pts, x, y, 1, facing);
  shape(ctx, P([[-8, 0], [-7.5, -16], [-6, -30], [-3, -37], [3, -37.5], [5.5, -32], [6.5, -18], [9, 0]]), 1.8, 3.5);
  line(ctx, P([[-1, -37], [1.5, -31], [4, -37]]), 1.0, 2);
  line(ctx, P([[-7, -3], [8.5, -3]]), 1.0, 4);
  shape(ctx, P([[-2.5, -38], [-3, -43], [-0.5, -46.5], [3.5, -46.5], [5, -42.5], [4, -38.5]]), 1.5, 2);
  shape(ctx, P([[-3, -45.5], [-1.5, -50], [4, -49], [5, -45]]), 1.3, 2);
  shape(ctx, P([[3, -33], [9, -30.5], [13, -30], [12.5, -27], [8, -26.5], [3, -28]]), 1.4, 2.5);
  shape(ctx, P([[9, -32], [19, -32], [18, -30], [10, -30]]), 1.2, 2);
  dot(ctx, x + 2.6 * facing, y - 42.6, 0.75);
}

function drawTable(ctx, x, y) {
  shape(ctx, [[x - 10, y - 14], [x + 10, y - 14], [x + 10, y - 11.5], [x - 10, y - 11.5]], 1.4, 3);
  line(ctx, [[x - 7.5, y - 11.5], [x - 8, y]], 1.4, 3);
  line(ctx, [[x + 7.5, y - 11.5], [x + 8, y]], 1.4, 3);
  shape(ctx, [[x - 6, y - 14], [x - 7, y - 17], [x - 1, y - 17], [x - 2, y - 14]], 1.1, 2);
  shape(ctx, [[x + 2, y - 14], [x + 1.5, y - 16.5], [x + 7, y - 16.5], [x + 6.5, y - 14]], 1.1, 2);
}

function drawVessel(ctx, x, y) {
  shape(ctx, [[x - 6, y], [x - 8, y - 6], [x - 7, y - 13], [x + 7, y - 13], [x + 8, y - 6], [x + 6, y]], 1.5, 2.5);
  line(ctx, [[x - 7.5, y - 9], [x + 7.5, y - 9]], 1.0, 3);
  line(ctx, [[x + 2, y - 13], [x + 5, y - 22], [x + 9, y - 23]], 1.2, 3);
}

function drawTiger(ctx, x, y, s) {
  const P = (pts) => place(pts, x, y, s);
  line(ctx, P([[-30, -18], [-38, -24], [-44, -32], [-42, -40], [-36, -40], [-37, -35]]), 2.0, 3);
  shape(ctx, P([[-30, -18], [-20, -22.5], [-6, -21], [8, -20.5], [17, -23.5], [23, -29], [30, -30.5], [35.5, -27], [37.5, -22.5], [33, -21.5], [36, -18], [31, -16.5], [24, -16], [18, -12], [30, -6.5], [37, -4.5], [35, -2], [22, -5.5], [10, -10.5], [-4, -11.5], [-16, -10], [-30, -4], [-41, -1.5], [-41.5, -4], [-31, -9.5], [-26, -13.5]]), 1.9, 3.5);
  for (let i = 0; i < 6; i += 1) line(ctx, P([[-20 + i * 6.5, -21], [-22 + i * 6.5, -15.5]]), 1.1, 2);
  shape(ctx, P([[25, -29], [25, -34], [28.5, -30.5]]), 1.1, 2);
  dot(ctx, x + 30 * s, y - 26.5 * s, 0.85);
}

function drawDeer(ctx, x, y, s) {
  const P = (pts) => place(pts, x, y, s);
  shape(ctx, P([[-22, -20], [-8, -21.5], [8, -21], [15, -26], [19.5, -34], [24, -36.5], [28.5, -34], [27.5, -31.5], [22.5, -29], [18, -20.5], [28, -12], [38, -8.5], [37, -6], [24, -10], [10, -14], [-6, -14], [-18, -12], [-32, -6], [-40, -4], [-40, -6.5], [-28, -12], [-24, -16]]), 1.9, 3.5);
  line(ctx, P([[22, -36], [19, -43], [14, -48], [9, -50]]), 1.4, 2.5);
  line(ctx, P([[19, -43], [22, -49]]), 1.2, 2);
  line(ctx, P([[15.5, -47], [16, -53]]), 1.2, 2);
  shape(ctx, P([[-22, -20], [-26, -24], [-24, -19]]), 1.1, 2);
  for (const q of [[-10, -17], [-2, -17.5], [6, -17]]) dot(ctx, x + q[0] * s, y + q[1] * s, 0.9);
  dot(ctx, x + 24 * s, y - 33.5 * s, 0.8);
}

function drawHare(ctx, x, y, s) {
  const P = (pts) => place(pts, x, y, s);
  shape(ctx, P([[-14, -10], [-4, -14], [6, -14.5], [12, -17], [16.5, -14.5], [15.5, -11], [10, -10], [18, -5], [24, -3], [22.5, -1.5], [12, -4.5], [0, -7], [-10, -6], [-22, -2], [-24, -3.5], [-16, -8]]), 1.8, 3);
  shape(ctx, P([[11, -16.5], [4, -27], [6, -27.5], [13.5, -17.5]]), 1.3, 2);
  dot(ctx, x + 13.5 * s, y - 14.5 * s, 0.7);
}

function drawBird(ctx, x, y, s) {
  const P = (pts) => place(pts, x, y, s);
  line(ctx, P([[-8, -19], [-22, -16], [-34, -20], [-42, -28], [-40, -35], [-34, -34], [-35, -30]]), 1.8, 3);
  line(ctx, P([[-8, -18], [-20, -11], [-32, -11], [-40, -16]]), 1.3, 3);
  shape(ctx, P([[-8, -20], [2, -25], [10, -30], [14, -35], [19, -35.5], [21.5, -32.5], [16.5, -31], [13, -26], [8, -19], [-2, -16]]), 1.8, 3);
  shape(ctx, P([[0, -24], [-4, -34], [-12, -42], [-9, -33], [-16, -38], [-8, -26]]), 1.5, 2.5);
  line(ctx, P([[2, -17], [4, -9], [9, -6]]), 1.2, 2);
  line(ctx, P([[-2, -17], [-7, -10], [-12, -9]]), 1.2, 2);
  line(ctx, P([[16, -35.5], [17, -40], [21, -41]]), 1.0, 2);
  dot(ctx, x + 17.5 * s, y - 33.2 * s, 0.7);
}

function drawCloud(ctx, x, y, s, flip) {
  const f = flip ? -1 : 1;
  const P = (pts) => place(pts, x, y, s, f);
  line(ctx, P([[-14, -6], [-6, -10], [2, -8], [6, -3], [3, 1], [-1, -1], [1, -4]]), 1.5, 2.5);
  line(ctx, P([[-6, -10], [-2, -18], [6, -21], [12, -18], [11, -14], [7, -15]]), 1.4, 2.5);
}

function lozengeBorder(ctx) {
  const a = 455.5;
  const b = 467.5;
  cut(ctx, [[MASK.x0, a], [MASK.x1, a]], 1.8);
  cut(ctx, [[MASK.x0, b], [MASK.x1, b]], 1.8);
  for (let x = MASK.x0; x < MASK.x1; x += 15) {
    cut(ctx, [[x, a], [x + 7.5, b], [x + 15, a]], 1.4);
    cut(ctx, [[x, b], [x + 7.5, a], [x + 15, b]], 1.4);
    dot(ctx, x + 7.5, (a + b) / 2, 0.9);
  }
}

function drawTitlePanel(ctx, fine) {
  const x0 = 200;
  const x1 = 450;
  const y0 = 474;
  const y1 = 546;
  knock(ctx, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  cut(ctx, [[x0 + 1, y0 + 1], [x1 - 1, y0 + 1], [x1 - 1, y1 - 1], [x0 + 1, y1 - 1]], 1.9, true);
  cut(ctx, [[x0 + 4.5, y0 + 4.5], [x1 - 4.5, y0 + 4.5], [x1 - 4.5, y1 - 4.5], [x0 + 4.5, y1 - 4.5]], 1.1, true);
  const cx = (x0 + x1) / 2;
  ctx.fillStyle = Cut.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `400 26px ${LIBIAN}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = "4px";
  ctx.fillText(META.zh, cx + 2, 505);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0.9px";
  ctx.font = `600 12.5px ${LATIN}`;
  ctx.fillText(META.en.toUpperCase(), cx, 521.5);
  // the date: upright, the Chinese in the clerical hand, the figures and Latin in the roman capitals
  if ("letterSpacing" in ctx) ctx.letterSpacing = "1px";
  const runs = `${META.date} · ${META.dateEn}`.split(/([\u3400-\u9fff]+)/).filter((t) => t.length).map((t) => ({
    t,
    zh: /[\u3400-\u9fff]/.test(t),
    font: /[\u3400-\u9fff]/.test(t) ? `400 13px ${LIBIAN}` : `600 12.5px ${LATIN}`,
  }));
  for (const r of runs) {
    ctx.font = r.font;
    r.w = ctx.measureText(r.t).width;
  }
  const dateY = 537.5;
  // guard: stroke every run that wide (the fine flag); otherwise only the Chinese, a little, to make the thin hand heavier
  const drawDate = (c, guard) => {
    c.save();
    c.textAlign = "left";
    c.textBaseline = "alphabetic";
    c.lineJoin = "round";
    if ("letterSpacing" in c) c.letterSpacing = "1px";
    let x = cx - runs.reduce((a, r) => a + r.w, 0) / 2;
    for (const r of runs) {
      c.font = r.font;
      if (guard || r.zh) {
        c.lineWidth = guard ? 2.6 : 0.8;
        c.strokeText(r.t, x, dateY);
      }
      c.fillText(r.t, x, dateY);
      x += r.w;
    }
    c.restore();
  };
  ctx.strokeStyle = Cut.color;
  drawDate(ctx, false);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  // fine lettering: 0.6 marks the panel (less warp and edge noise), 1.0 the guard round the date (no speckle)
  fine.fillStyle = "#999";
  fine.fillRect(x0 + 6, y0 + 6, x1 - x0 - 12, y1 - y0 - 12);
  fine.fillStyle = "#fff";
  fine.strokeStyle = "#fff";
  drawDate(fine, true);
}

function drawCrack(ctx, r, x, y0, y1) {
  let px = x;
  let y = y0 - 2;
  let ang = Math.PI / 2 + r.range(-0.3, 0.3);
  const pts = [[px, y]];
  while (y < y1 + 2) {
    ang += r.range(-0.45, 0.45);
    ang = Math.PI / 2 + Math.max(-0.7, Math.min(0.7, ang - Math.PI / 2));
    const step = r.range(3, 8);
    px += Math.cos(ang) * step;
    y += Math.sin(ang) * step;
    pts.push([px, y]);
  }
  for (let i = 1; i < pts.length; i += 1) {
    cut(ctx, [pts[i - 1], pts[i]], 0.9 + 1.4 * Math.abs(Math.sin(i * 0.37 + x)) * r.range(0.6, 1.2));
    if (r.chance(0.04)) {
      // a short branch
      let bx = pts[i][0];
      let by = pts[i][1];
      let ba = (r.chance(0.5) ? 0 : Math.PI) + r.range(-0.6, 0.6);
      const n = r.int(3, 7);
      for (let j = 0; j < n; j += 1) {
        const nx = bx + Math.cos(ba) * r.range(3, 6);
        const ny = by + Math.sin(ba) * r.range(3, 6);
        cut(ctx, [[bx, by], [nx, ny]], 1.1 * (1 - j / n) + 0.3);
        bx = nx;
        by = ny;
        ba += r.range(-0.5, 0.5);
      }
    }
  }
}

function blobPts(r, cx, cy, rx, ry, n = 9) {
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * 6.2832;
    const k = r.range(0.55, 1.15);
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return pts;
}

/** Paint the fixed stone: lines into `ctx`, the inked sheet into `stone`, fine lettering into `fine`. */
function paintStone(ctx, stone, fine) {
  const r = sampler(3303);
  // --- the sheet: ragged top and bottom edges, chips
  stone.fillStyle = "#fff";
  stone.beginPath();
  const xs = [];
  for (let x = MASK.x0; x <= MASK.x1; x += 1.5) xs.push(x);
  xs.forEach((x, i) => {
    const y = SHEET.y0 + (fbm2(x / 16, 1.3, 3, 11) - 0.5) * 5 + (fbm2(x / 3, 4.1, 2, 12) - 0.5) * 1.6;
    if (i === 0) stone.moveTo(x, y);
    else stone.lineTo(x, y);
  });
  for (let i = xs.length - 1; i >= 0; i -= 1) {
    const x = xs[i];
    stone.lineTo(x, SHEET.y1 + (fbm2(x / 16, 7.7, 3, 13) - 0.5) * 5 + (fbm2(x / 3, 2.2, 2, 14) - 0.5) * 1.6);
  }
  stone.closePath();
  stone.fill();
  stone.fillStyle = "#000";
  for (let i = 0; i < 34; i += 1) {
    const top = r.chance(0.5);
    const x = r.range(MASK.x0, MASK.x1);
    const big = r.chance(0.25);
    const rx = big ? r.range(7, 16) : r.range(2, 6);
    const y = (top ? SHEET.y0 : SHEET.y1) + (top ? -1 : 1) * r.range(-rx * 0.1, rx * 0.4);
    stone.beginPath();
    blobPts(r, x, y, rx, rx * r.range(0.45, 0.8), 11).forEach((q, j) => (j ? stone.lineTo(q[0], q[1]) : stone.moveTo(q[0], q[1])));
    stone.fill();
  }

  // --- borders and rules
  lozengeBorder(ctx);
  for (const y of [472, 548.5, 554.5, 706.5, 711]) cut(ctx, [[MASK.x0, y], [MASK.x1, y]], y === 472 ? 1.6 : 1.9);
  cut(ctx, [[MASK.x0, GROUND], [MASK.x1, GROUND]], 1.5);
  cut(ctx, [[MASK.x0, 768.5], [MASK.x1, 768.5]], 1.8);

  // --- upper register: a feast, guests facing in pairs over low tables
  const floor = 545.5;
  const pairs = [-40, 96, 520, 610, 718, 806, 916, 1012];
  pairs.forEach((x, i) => {
    const gap = 23 + (i % 3) * 1.5;
    drawFeastFigure(ctx, x - gap, floor, 1, i % 3, i % 4 === 2 ? 1.08 : 1);
    drawTable(ctx, x, floor);
    drawFeastFigure(ctx, x + gap, floor, -1, (i * 2 + 1) % 3, i % 4 === 0 ? 0.94 : 1);
    if (i < pairs.length - 1 && pairs[i + 1] - x > 90) {
      if (i % 2) drawServant(ctx, x + 49, floor, i % 4 === 1 ? 1 : -1);
      else drawVessel(ctx, x + 49, floor);
    }
  });
  drawTitlePanel(ctx, fine);

  // --- lower frieze: beasts in the flying gallop among cloud scrolls
  const base = 766;
  const beasts = [drawTiger, drawDeer, drawBird, drawHare, drawTiger, drawBird, drawDeer, drawHare, drawTiger];
  beasts.forEach((fn, i) => {
    const x = -30 + i * 134 + (i % 2) * 8;
    fn(ctx, x, base - (fn === drawBird ? 1 : 0), fn === drawHare ? 1.6 : fn === drawBird ? 1.25 : 1.32);
    drawCloud(ctx, x + 70, base - (i % 2 ? 30 : 12), 1.05, i % 2 === 1);
  });

  // --- cracks across the whole height, chips along the rules, pits
  const cr = sampler(4417);
  drawCrack(ctx, cr, 62, SHEET.y0, SHEET.y1);
  drawCrack(ctx, cr, 548, SHEET.y0, SHEET.y1);
  drawCrack(ctx, cr, 968, SHEET.y0, SHEET.y1);
  ctx.fillStyle = Cut.color;
  for (let i = 0; i < 26; i += 1) {
    const y = r.pick([472, 548.5, 554.5, 706.5, 711, 714, 768.5, 455.5, 467.5]);
    const x = r.range(MASK.x0, MASK.x1);
    trace(ctx, blobPts(r, x, y + r.range(-1, 1), r.range(1.5, 4.5), r.range(1, 2.4), 7), true);
    ctx.fill();
  }
  // a few larger flakes where the stone's face has spalled away
  for (const [x, y, rx, ry] of [[-22, 462, 14, 7], [310, 760, 18, 8], [742, 463, 10, 6], [655, 552, 9, 4], [1046, 742, 16, 12], [128, 709, 8, 3.5]]) {
    trace(ctx, blobPts(r, x, y, rx, ry, 13), true);
    ctx.fill();
  }
  for (let i = 0; i < 260; i += 1) {
    const x = r.range(MASK.x0, MASK.x1);
    const y = r.range(SHEET.y0, SHEET.y1);
    const rr = r.chance(0.12) ? r.range(1.2, 2.4) : r.range(0.35, 0.9);
    trace(ctx, blobPts(r, x, y, rr, rr * r.range(0.6, 1), 6), true);
    ctx.fill();
  }
}

function bakeStatic(stage) {
  const k = MASK_PX * stage.s;
  const w = (MASK.x1 - MASK.x0) * k;
  const h = (MASK.y1 - MASK.y0) * k;
  return stage.bake2d(`han/static/${k.toFixed(3)}`, w, h, (ctx) => {
    const layers = [0, 1, 2].map(() => new Layer2D(stage.p, w, h));
    for (const L of layers) {
      L.ctx.fillStyle = "#000";
      L.ctx.fillRect(0, 0, L.w, L.h);
      L.ctx.setTransform(k, 0, 0, k, -MASK.x0 * k, -MASK.y0 * k);
    }
    Cut.color = "#fff";
    paintStone(layers[0].ctx, layers[1].ctx, layers[2].ctx);
    // pack: R = cut, G = sheet, B = fine lettering
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    const tint = ["#f00", "#0f0", "#00f"];
    layers.forEach((L, i) => {
      L.ctx.setTransform(1, 0, 0, 1, 0, 0);
      L.ctx.globalCompositeOperation = "multiply";
      L.ctx.fillStyle = tint[i];
      L.ctx.fillRect(0, 0, L.w, L.h);
      ctx.drawImage(L.canvas, 0, 0);
    });
    ctx.globalCompositeOperation = "source-over";
  });
}

// ------------------------------------------------------------------ the pelican, cut in white line
const HEAVY = new Set(["body", "neck", "head", "bill", "pouch", "tire", "wing", "tail", "frame", "foot", "saddle"]);

function cutPelican(ctx, skel) {
  const S = skel.scale / 21.2;
  const W1 = 2.0 * S;
  const W2 = 1.25 * S;
  ctx.lineJoin = "miter";
  for (const sh of skel.shapes) {
    const t = sh.tag;
    if (t === "reflector" || t === "lid") continue;
    if (sh.kind === "circle") {
      if (t === "pupil") {
        dot(ctx, sh.c[0], sh.c[1], sh.r * 0.9);
      } else if (t === "hub") {
        dot(ctx, sh.c[0], sh.c[1], sh.r * 1.1);
      } else if (t === "eye") {
        const pts = [];
        for (let i = 0; i < 9; i += 1) pts.push([sh.c[0] + Math.cos(i * 0.698) * sh.r * 1.15, sh.c[1] + Math.sin(i * 0.698) * sh.r * 1.15]);
        knock(ctx, pts);
        cut(ctx, pts, W2, true);
      } else {
        const n = t === "tire" ? 22 : 12;
        const pts = [];
        for (let i = 0; i < n; i += 1) pts.push([sh.c[0] + Math.cos((i / n) * 6.2832) * sh.r, sh.c[1] + Math.sin((i / n) * 6.2832) * sh.r]);
        if (t === "tire") {
          cut(ctx, pts, W1, true);
          const inner = pts.map((q) => [sh.c[0] + (q[0] - sh.c[0]) * 0.86, sh.c[1] + (q[1] - sh.c[1]) * 0.86]);
          cut(ctx, inner, W2 * 0.85, true);
        } else if (t !== "rim") {
          cut(ctx, pts, W2, true);
        }
      }
      continue;
    }
    if (sh.kind === "line") {
      const w = t === "spoke" ? W2 * 0.8 : t === "chain" ? W2 * 0.8 : t === "leg" ? W1 * 1.05 : t === "frame" ? W1 : W2 * 1.2;
      const pts = sh.pts.length > 3 ? even(sh.pts, 4 * S, false) : sh.pts;
      cut(ctx, pts, w, false);
      continue;
    }
    // polygons: stone left standing inside, a squared outline
    const pts = sh.pts.length > 6 ? even(sh.pts, 3.6 * S, true) : sh.pts;
    knock(ctx, pts);
    cut(ctx, pts, HEAVY.has(t) ? W1 : W2, true);
    if (t === "wing") featherCuts(ctx, skel, pts, S);
    if (t === "body") bodyCuts(ctx, skel, pts, S);
  }
}

/** Rows of short cuts across the wing, clipped to it. */
function featherCuts(ctx, skel, wing, S) {
  const spine = skel.wingLine;
  if (!spine || spine.length < 2) return;
  ctx.save();
  trace(ctx, wing, true);
  ctx.clip();
  const pts = even(spine, 5 * S, false);
  for (let row = 0; row < 3; row += 1) {
    for (let i = 1; i < pts.length - 1; i += 1) {
      if ((i + row) % 2) continue;
      const a = pts[i - 1];
      const b = pts[i + 1];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const d = Math.hypot(dx, dy) || 1;
      const nx = -dy / d;
      const ny = dx / d;
      const off = (row - 1) * 4.2 * S;
      const c = [pts[i][0] + nx * off, pts[i][1] + ny * off];
      cut(ctx, [[c[0] - (dx / d) * 3.4 * S + nx * 2.2 * S, c[1] - (dy / d) * 3.4 * S + ny * 2.2 * S], c, [c[0] - (dx / d) * 3.4 * S - nx * 2.2 * S, c[1] - (dy / d) * 3.4 * S - ny * 2.2 * S]], 1.2 * S);
    }
  }
  ctx.restore();
}

/** A few short cuts on the breast. */
function bodyCuts(ctx, skel, body, S) {
  const c = skel.joints.body;
  const nb = skel.joints.neckBase;
  ctx.save();
  trace(ctx, body, true);
  ctx.clip();
  for (let i = 0; i < 4; i += 1) {
    const t = 0.25 + i * 0.17;
    const x = nb[0] + (c[0] - nb[0]) * t + 4 * S;
    const y = nb[1] + (c[1] - nb[1]) * t + 5 * S;
    cut(ctx, [[x - 2.4 * S, y - 1.6 * S], [x, y], [x + 2.4 * S, y - 1.6 * S]], 1.0 * S);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ the moving mask
function drawProcession(stage, f) {
  const { p } = stage;
  const view = f.view;
  const px = f.pelican.x;
  const u = f.u;
  stage.withView(view, () => {
    for (const m of MEMBERS) {
      const st = gaitStep(u, m.phase);
      const x = px + m.dx;
      const y = GROUND - 1.6 + m.dy;
      if (m.kind === "ride") {
        const spr = spriteFor(stage, `ride-${m.rider}-${st}`, RIDE_BOX, (ctx) => {
          drawHorse(ctx, st, "ride");
          drawRider(ctx, st, m.rider);
        });
        stage.image(spr, x + RIDE_BOX.x0, y + RIDE_BOX.y0, RIDE_BOX.x1 - RIDE_BOX.x0, RIDE_BOX.y1 - RIDE_BOX.y0);
      } else {
        const wx = x; // carts are placed by the wheel's hub
        const spr = spriteFor(stage, `cart${m.cart}-${st}`, CART_BOX, (ctx) => drawCart(ctx, st, m.cart));
        stage.image(spr, wx + CART_BOX.x0, y + CART_BOX.y0, CART_BOX.x1 - CART_BOX.x0, CART_BOX.y1 - CART_BOX.y0);
        const wheel = spriteFor(stage, "wheel", { x0: -33, y0: -33, x1: 33, y1: 33 }, drawWheel);
        p.push();
        p.translate(wx, y - WHEEL_R);
        p.rotate((wx / WHEEL_R) % (Math.PI * 2));
        stage.image(wheel, -33, -33, 66, 66);
        p.pop();
        const lab = spriteFor(stage, `label-${m.cart}`, { x0: -1, y0: -1, x1: LABEL_W + 1, y1: labelH(3) + 1 }, (ctx) => drawLabel(ctx, 0, 0, m.label));
        stage.image(lab, wx + m.lx - 1, LABEL_Y - 1, LABEL_W + 2, labelH(3) + 2);
      }
    }
  });
}

function drawPelicanLabel(stage, f) {
  const { p } = stage;
  const x = f.pelican.x + PEL_LABEL.dx;
  const y = PEL_LABEL.y;
  const h = labelH(4);
  const inked = TAPS.filter((t) => f.u >= t).length;
  stage.withView(f.view, () => {
    const lab = spriteFor(stage, "label-pel", { x0: -1, y0: -1, x1: LABEL_W + 1, y1: h + 1 }, (ctx) => drawLabel(ctx, 0, 0, PEL_LABEL.chars));
    stage.image(lab, x - 1, y - 1, LABEL_W + 2, h + 2);
    // the patch nobody has inked yet
    if (inked < 4) {
      const top = inked === 0 ? y - 0.6 : y + 3 + CELL * inked;
      p.noStroke();
      p.fill(0, 255, 0);
      p.rect(x - 0.6, top, LABEL_W + 1.2, y + h + 0.6 - top);
    }
    // fresh ink, wetter and darker for half a second
    p.blendMode(p.ADD);
    TAPS.forEach((t, i) => {
      const dt = f.u - t;
      if (dt < 0 || dt > 0.6) return;
      const wet = 1 - smoothstep(0.1, 0.6, dt);
      p.fill(0, 0, Math.round(255 * wet * 0.85));
      p.rect(x + 1, y + 2 + CELL * i, LABEL_W - 2, CELL + 2);
    });
    p.blendMode(p.BLEND);
    // the pad
    TAPS.forEach((t, i) => {
      const dt = f.u - t;
      if (dt < -0.034 || dt > 0.15) return;
      const a = smoothstep(-0.034, -0.005, dt) * (1 - smoothstep(0.08, 0.15, dt));
      const sc = 1 + 0.28 * (1 - smoothstep(-0.02, 0.05, dt));
      const pad = spriteFor(stage, "pad", { x0: -15, y0: -15, x1: 15, y1: 15 }, (ctx) => {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 15);
        g.addColorStop(0, "rgba(0,0,255,1)");
        g.addColorStop(0.72, "rgba(0,0,255,1)");
        g.addColorStop(0.87, "rgba(0,0,255,0.55)");
        g.addColorStop(1, "rgba(0,0,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(-15, -15, 30, 30);
      });
      const cx = x + LABEL_W / 2;
      const cy = y + 3 + CELL * (i + 0.5);
      const R = 15 * sc;
      stage.image(pad, cx - R, cy - R, 2 * R, 2 * R, a);
    });
  });
}

function drawMoving(stage, f) {
  const fb = stage.fb(`han/move/${f.w}x${f.h}`, f.w, f.h);
  stage.into(fb, () => {
    stage.p.background(0);
    drawProcession(stage, f);
    if (f.pelican.visible) {
      const skel = solveRig({ ...f.pelican });
      const b = skel.bounds;
      const patch = stage.patch("han/pel", f.view, b.x0, b.y0, b.x1, b.y1 + 2);
      Cut.color = "#f00";
      cutPelican(patch.ctx, skel);
      Cut.color = "#fff";
      stage.imagePatch(patch);
    }
    drawPelicanLabel(stage, f);
  });
  return fb;
}

// ------------------------------------------------------------------ the rubbing pass
const RUB_FRAG = `${FRAG_HEAD}
uniform sampler2D uStatic;
uniform vec4 uSR;          // static mask: world x0, y0, w, h
uniform sampler2D uMove;
uniform vec3 uView;        // k, tx, ty: world -> target pixels
uniform vec2 uSize;        // target pixels
uniform float uPelX;
uniform vec3 uInk;
uniform vec3 uInk2;
uniform vec2 uSheet;       // sheet top and bottom
${NOISE}
float lodK(float cycle) { return smoothstep(0.8, 2.2, cycle * uView.x); }

vec2 warp(vec2 q) {
  return (vec2(vnoise(q * 0.6), vnoise(q * 0.6 + 19.7)) - 0.5) * 0.4
       + (vec2(vnoise(q * 3.2 + 5.0), vnoise(q * 3.2 + 9.0)) - 0.5) * 0.5 * lodK(0.31);
}

// pores of the stone: small round spots on a jittered grid; p = share of cells with one
float pores(vec2 w, float cell, float p) {
  vec2 g = rot2(0.5) * w / cell;
  vec2 c = floor(g);
  float m = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 id = c + vec2(float(i), float(j));
      if (hash21(id + 11.0) > p) continue;
      vec2 ctr = id + 0.2 + 0.6 * hash22(id);
      float r = 0.18 + 0.22 * hash21(id + 5.0);
      m = max(m, 1.0 - smoothstep(r * 0.6, r, length(g - ctr)));
    }
  }
  return m;
}

// round dabs of the pad, about 30 units across, overlapping
float dabField(vec2 w) {
  vec2 g = w / 19.0;
  vec2 c = floor(g);
  float acc = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cell = c + vec2(float(i), float(j));
      vec2 h = hash22(cell);
      vec2 ctr = (cell + 0.1 + 0.8 * h) * 19.0;
      float r = 12.0 + 6.0 * hash21(cell + 7.1);
      float d = length(w - ctr) / r;
      float v = 0.5 + 0.5 * hash21(cell + 3.3);
      acc += (1.0 - smoothstep(0.62, 1.0, d)) * v + smoothstep(0.78, 0.94, d) * (1.0 - smoothstep(0.94, 1.0, d)) * 0.35 * v;
    }
  }
  return acc;
}

void main() {
  vec2 px = vTexCoord * uSize;
  vec2 w = (px - uView.yz) / uView.x;
  vec2 q = w - vec2(uPelX, 0.0);   // procession space

  // fixed stone
  vec2 suv0 = (w - uSR.xy) / uSR.zw;
  float fineRaw = texture(uStatic, suv0).b;
  float fine = clamp(fineRaw / 0.6, 0.0, 1.0);
  float guard = smoothstep(0.7, 0.95, fineRaw);
  vec2 ws = w + warp(w) * (1.0 - 0.65 * fine);
  vec4 S = texture(uStatic, (ws - uSR.xy) / uSR.zw);
  float cutS = smoothstep(0.32, 0.68, S.r + ((vnoise(w * 2.2 + 1.0) - 0.5) * 0.5 * lodK(0.45) + (vnoise(w * 0.7 + 4.0) - 0.5) * 0.3) * (1.0 - 0.6 * fine));
  float brS = smoothstep(0.80, 0.94, vnoise(w * 0.42 + 71.0)) * (1.0 - fine);
  cutS *= 1.0 - 0.8 * brS;
  vec2 wg = w + (vec2(vnoise(w * 0.3 + 3.0), vnoise(w * 0.3 + 8.0)) - 0.5) * 3.0;
  float stone = texture(uStatic, (wg - uSR.xy) / uSR.zw).g;

  // moving figures: the grain travels with them
  vec2 wm = w + warp(q + 300.0);
  vec4 M = texture(uMove, (wm * uView.x + uView.yz) / uSize);
  float cutM = smoothstep(0.32, 0.68, M.r + (vnoise(q * 2.2 + 40.0) - 0.5) * 0.5 * lodK(0.45) + (vnoise(q * 0.7 + 44.0) - 0.5) * 0.3);
  cutM *= 1.0 - 0.8 * smoothstep(0.80, 0.94, vnoise(q * 0.42 + 171.0));
  vec2 wb = w + (vec2(vnoise(q * 0.55 + 3.0), vnoise(q * 0.55 + 8.0)) - 0.5) * 2.2;
  float blank = smoothstep(0.35, 0.65, texture(uMove, (wb * uView.x + uView.yz) / uSize).g);
  float wet = M.b;

  float cutv = max(cutS, cutM);

  // the ink: dabbed, densest where dabs overlap, thinner towards the sheet's edge
  float d = dabField(w);
  float tone = 0.89 + 0.11 * smoothstep(0.35, 1.7, d);
  tone *= 0.93 + 0.07 * smoothstep(0.3, 0.7, fbm(w / 140.0 + 4.0));
  float edge = min(w.y - uSheet.x, uSheet.y - w.y) + (fbm(w / 11.0) - 0.5) * 12.0;
  tone *= mix(0.55, 1.0, smoothstep(0.0, 22.0, edge));
  // the chisel's striations in the cut-back ground
  float stri = sin((w.x * 0.82 + w.y * 0.5) * 1.9 + vnoise(w * 0.12) * 5.0);
  tone *= 1.0 - 0.045 * smoothstep(0.55, 1.0, stri) * vnoise(w * 0.05 + 2.0) * lodK(1.6);
  tone = mix(tone, 1.0, wet);

  // speckle: pores of the stone the pad never reached
  float sp = pores(w, 1.35, 0.42 - 0.3 * smoothstep(0.82, 1.0, tone)) * lodK(0.7);
  sp += smoothstep(0.88, 0.93, vnoise(w * 0.45 + 41.0)) * 0.6;
  sp += smoothstep(0.6, 0.75, vnoise(w * 0.9 + 77.0)) * (1.0 - smoothstep(0.0, 14.0, edge)) * 0.8;
  sp = clamp(sp, 0.0, 1.0) * (1.0 - wet) * (1.0 - 0.9 * guard);

  float cov = stone * (1.0 - cutv) * (1.0 - blank * (1.0 - wet)) * tone * (1.0 - sp * 0.85);
  // a whisper of grey in the cut lines, where the paper sagged into them
  cov = max(cov, stone * cutv * (1.0 - blank) * 0.06 * vnoise(w * 0.7 + 5.0));
  vec3 inkc = mix(uInk2, uInk, smoothstep(0.7, 1.0, tone));
  fragColor = vec4(mix(vec3(1.0), inkc, clamp(cov, 0.0, 1.0)), 1.0);
}`;

function drawSeal(stage, view) {
  const box = { x: 467, y: 440.2, s: 12.5 }; // clear of the top of the view at zoom 1.1 (y = 439.3)
  const k = 6 * stage.s;
  const layer = sprite(stage, `han/seal/${k.toFixed(3)}`, box.s * k, box.s * k, (ctx) => {
    ctx.scale(k, k);
    const r = sampler(91);
    ctx.fillStyle = "#b8322a";
    ctx.beginPath();
    ctx.moveTo(0.4, 0.5);
    ctx.lineTo(box.s - 0.3, 0.3);
    ctx.lineTo(box.s - 0.5, box.s - 0.4);
    ctx.lineTo(0.3, box.s - 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `400 5.6px ${LIBIAN}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("鹈", box.s * 0.73, box.s * 0.5);
    ctx.fillText("鹕", box.s * 0.29, box.s * 0.5);
    for (let i = 0; i < 40; i += 1) {
      ctx.globalAlpha = r.range(0.3, 0.9);
      ctx.beginPath();
      ctx.arc(r.range(0, box.s), r.range(0, box.s), r.range(0.08, 0.35), 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
  stage.withView(view, () => {
    stage.blend(stage.p.MULTIPLY, () => stage.image(layer, box.x, box.y, box.s, box.s, 0.92));
  });
}

export const han = {
  ...META,
  still: { u: 3.7 },

  init(stage) {
    bakeStatic(stage);
    // cut every gait sprite now, so the first strides never hitch
    for (let st = 0; st < STEPS; st += 1) {
      for (const m of MEMBERS) {
        if (m.kind === "ride") spriteFor(stage, `ride-${m.rider}-${st}`, RIDE_BOX, (ctx) => { drawHorse(ctx, st, "ride"); drawRider(ctx, st, m.rider); });
        else spriteFor(stage, `cart${m.cart}-${st}`, CART_BOX, (ctx) => drawCart(ctx, st, m.cart));
      }
    }
  },

  render(stage, f) {
    const { p } = stage;
    const view = f.view;
    const stat = bakeStatic(stage);
    const move = drawMoving(stage, f);

    stage.origin();
    inkGround(stage, view, GROUNDS.xuan);
    const sh = stage.shader("han/rub", VERT, RUB_FRAG);
    stage.origin();
    stage.blend(p.MULTIPLY, () => {
      stage.shaderRect(
        sh,
        {
          uStatic: stat,
          uSR: [MASK.x0, MASK.y0, MASK.x1 - MASK.x0, MASK.y1 - MASK.y0],
          uMove: move,
          uView: [view.k, view.tx, view.ty],
          uSize: [f.w, f.h],
          uPelX: f.pelican.x,
          uInk: rgb(INK.jiao),
          uInk2: rgb(INK.nong),
          uSheet: [SHEET.y0, SHEET.y1],
        },
        0,
        0,
        f.w,
        f.h,
      );
    });
    drawSeal(stage, view);
    p.noStroke();
  },
};
