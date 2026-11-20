// Section 2. Egyptian wall painting, c. 1300 BCE, in the manner of the New
// Kingdom tomb chapels at Thebes (18th-19th Dynasty).
//
// A plastered wall that was never finished. On the left the painting is done:
// a white wash over the grid, offering bearers in flat colour with firm
// outlines, columns of signs, a frieze, a pool and a dado. In the middle the
// colours are laid in without their final outlines. On the right there is
// only the red underdrawing on the painter's snapped-string grid, with a few
// corrections in black, and then bare gridded plaster.
//
// The pelican rides along the ground line as one more figure of the register.
// On the downbeat of bar 2 it stops dead and takes the canonical pose: head in
// profile with a frontal eye, chest square to us with a wing on either side,
// bill level. It holds two beats, blinks once, and rides on to make up time.
//
// The wall is baked once (plaster shader + one 2D canvas of paint); each frame
// adds the pelican on a 2D patch and the wear layer over everything.

import { sectionMeta } from "./sections.js";
import { View, Layer2D } from "../kit/stage.js";
import { VERT, FRAG_HEAD, NOISE } from "../kit/glsl.js";
import { hash, noise1, wobble } from "../kit/rng.js";
import { smoothClosed } from "../kit/geom.js";
import { solveRig } from "../rig/rig.js";
import { ROAD_Y, SPEED } from "../main/layout.js";
import { clamp, lerp, smoothstep, easeOutCubic, deg, TAU } from "../beat/ease.js";

const META = sectionMeta(2);

const WALL = { x0: -70, y0: 418, x1: 1070, y1: 802 };
const WALL_PX = 3.3;
const G = 7; // the painter's grid square
const GRID_X0 = 301.5; // a vertical grid line through the rear hub of the frozen pelican
const STOP_X = 1000 / 3; // two pedal turns: a pedal is forward

const C = {
  plaster: "#e9dcc0",
  mud: "#9a7a55",
  red: "#a2452a",
  yellow: "#d9a441",
  blue: "#2f6f9f",
  blue2: "#5b93b5",
  green: "#5e8f5a",
  black: "#231d18",
  white: "#f6f0e2",
  draft: "#b5533a",
};

const FONT_ZH = "'Libian SC', 'Baoli SC', 'STKaiti', 'Kaiti SC', serif";
const FONT_EN = "'Optima', 'Gill Sans', 'Avenir Next', sans-serif";

// Stages of finish along the wall (world x).
const ZONE = { colour: 410, draft: 560, bare: 900 };

// ------------------------------------------------------------------ motion
// The integral of smoothstep from 0 to s.
const ssInt = (s) => s * s * s - (s * s * s * s) / 2;
const BRAKE0 = 1.9;
const BRAKE1 = 2.1;
const GO0 = 3.0;
const CRUISE0 = 3.6;
const CRUISE1 = 5.3;
const GO1 = 5.9;
// cruise speed that puts the pelican on x = 1000 at u = 6 at the standard speed
const VC = (1000 - STOP_X - SPEED * (0.3 + 0.1)) / 2.3;

function motionX(u) {
  if (u <= BRAKE0) return SPEED * u;
  if (u < BRAKE1) {
    const d = BRAKE1 - BRAKE0;
    const s = (u - BRAKE0) / d;
    return SPEED * BRAKE0 + SPEED * d * (s - ssInt(s));
  }
  if (u <= GO0) return STOP_X;
  const ru = CRUISE0 - GO0;
  if (u < CRUISE0) return STOP_X + VC * ru * ssInt((u - GO0) / ru);
  const x1 = STOP_X + VC * ru * 0.5;
  if (u < CRUISE1) return x1 + VC * (u - CRUISE0);
  const x2 = x1 + VC * (CRUISE1 - CRUISE0);
  const rd = GO1 - CRUISE1;
  if (u < GO1) {
    const s = (u - CRUISE1) / rd;
    return x2 + rd * (VC * s + (SPEED - VC) * ssInt(s));
  }
  const x3 = x2 + rd * (VC + (SPEED - VC) * 0.5);
  return x3 + SPEED * (u - GO1);
}

/** How far into the canonical pose the pelican is, 0..1. */
function poseAmount(u) {
  if (u < 2.5) return easeOutCubic(clamp((u - BRAKE0) / 0.15));
  return 1 - smoothstep(GO0, GO0 + 0.25, u);
}

/** The one blink of the hold: lid down and up within 0.15 s around u = 2.5. */
function holdBlink(u) {
  const d = Math.abs(u - 2.5) / 0.075;
  return d >= 1 ? 0 : smoothstep(0, 1, 1 - d) ** 0.6;
}

// ------------------------------------------------------------------ geometry helpers
function resample(pts, closed, step) {
  const src = closed ? pts.concat([pts[0]]) : pts;
  const out = [];
  for (let i = 0; i < src.length - 1; i += 1) {
    const a = src[i];
    const b = src[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let j = 0; j < n; j += 1) out.push([a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n]);
  }
  if (!closed) out.push(src[src.length - 1]);
  return out;
}

/** A hand-drawn version of a path: resampled, then pushed along its normals by smooth noise. */
function hand(pts, closed, amp, seed, freq = 0.16, step = 1.3) {
  const r = resample(pts, closed, step);
  const n = r.length;
  const out = new Array(n);
  let s = 0;
  for (let i = 0; i < n; i += 1) {
    const a = r[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const b = r[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    if (i > 0) s += Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]);
    const o = amp * (noise1(s * freq, seed) * 2 - 1);
    out[i] = [r[i][0] - (ty / l) * o, r[i][1] + (tx / l) * o];
  }
  return out;
}

function trace(ctx, pts, closed) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  if (closed) ctx.closePath();
}

function fillHand(ctx, pts, color, seed, amp = 0.3, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  trace(ctx, amp > 0 ? hand(pts, true, amp, seed, 0.13) : pts, true);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** A brush line of nearly even width: drawn in short overlapping runs whose width drifts a little. */
function lineHand(ctx, pts, color, w, seed, { closed = false, amp = 0.22, alpha = 1, broken = 0, vary = 0.25 } = {}) {
  const r = hand(pts, closed, amp, seed + 7);
  if (closed) r.push(r[0]);
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const run = 6;
  for (let i = 0; i < r.length - 1; i += run - 1) {
    const q = noise1(i * 0.11, seed + 3);
    if (broken > 0 && noise1(i * 0.09, seed + 11) < broken) continue;
    ctx.globalAlpha = alpha * (0.88 + 0.12 * q);
    ctx.lineWidth = w * (1 - vary / 2 + vary * q);
    ctx.beginPath();
    ctx.moveTo(r[i][0], r[i][1]);
    for (let j = i + 1; j < Math.min(r.length, i + run); j += 1) ctx.lineTo(r[j][0], r[j][1]);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function ell(cx, cy, rx, ry, n = 20, a0 = 0, a1 = TAU) {
  const pts = [];
  const full = Math.abs(a1 - a0) >= TAU - 1e-6;
  const m = full ? n : n + 1;
  for (let i = 0; i < m; i += 1) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

/** Closed polygon around a centre line with a half-width per point. */
function ribbon(center, hw) {
  const L = [];
  const R = [];
  const n = center.length;
  for (let i = 0; i < n; i += 1) {
    const a = center[Math.max(0, i - 1)];
    const b = center[Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    const w = typeof hw === "function" ? hw(i / (n - 1)) : hw;
    L.push([center[i][0] - (ty / l) * w, center[i][1] + (tx / l) * w]);
    R.push([center[i][0] + (ty / l) * w, center[i][1] - (tx / l) * w]);
  }
  return L.concat(R.reverse());
}

function bez(p0, p1, p2, p3, n) {
  const out = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

/** Grid units (x forward, y up from the ground line) to world, for a figure at fx. */
const onGrid = (fx, facing = 1, base = ROAD_Y) => (p) => [fx + p[0] * G * facing, base - p[1] * G];

// ------------------------------------------------------------------ plaster
const PLASTER_FRAG = `${FRAG_HEAD}
uniform vec2 uOrigin;
uniform vec2 uSize;
uniform float uPxPerUnit;
uniform float uWear;
${NOISE}

float lossAt(vec2 w) {
  // a few places where the gypsum has fallen away and the mud shows
  float m = 0.0;
  m = max(m, 1.0 - smoothstep(4.0, 26.0, length((w - vec2(112.0, 780.0)) * vec2(0.6, 1.0))));
  m = max(m, 1.0 - smoothstep(4.0, 22.0, length((w - vec2(-40.0, 590.0)) * vec2(1.0, 0.7))));
  m = max(m, 1.0 - smoothstep(4.0, 24.0, length((w - vec2(846.0, 446.0)) * vec2(0.7, 1.0))));
  m = max(m, 1.0 - smoothstep(4.0, 26.0, length((w - vec2(1046.0, 712.0)) * vec2(1.0, 0.8))));
  float edge = fbm(w / 9.0 + 31.0) * 0.6 + fbm(w / 2.6 + 4.0) * 0.3;
  return smoothstep(0.62, 0.66, m * 0.9 + edge * 0.75 - 0.22);
}

float titleMask(vec2 w) {
  vec2 d = max(vec2(404.0, 456.0) - w, w - vec2(594.0, 554.0));
  return 1.0 - smoothstep(-2.0, 4.0, max(d.x, d.y));
}

void main() {
  vec2 w = uOrigin + vTexCoord * uSize;
  float fine = smoothstep(1.2, 2.6, uPxPerUnit);

  // gypsum plaster, floated on with a trowel: broad sweeps of tone
  vec2 tw = vec2(w.x * 0.8 + w.y * 0.45, w.y - w.x * 0.2);
  float sweep = fbm(vec2(tw.x / 90.0, tw.y / 22.0) + 3.0);
  float tone = fbm(w / 160.0 + 12.0);
  vec3 cream = vec3(0.914, 0.863, 0.753);
  vec3 col = cream * (0.955 + 0.07 * sweep) * (0.97 + 0.06 * tone);
  col = mix(col, col * vec3(1.0, 0.97, 0.92), smoothstep(0.55, 0.8, fbm(w / 60.0 + 70.0)) * 0.5);
  col *= 1.0 + (vnoise(w * 1.4) - 0.5) * 0.06 * fine + (vnoise(w * 0.4) - 0.5) * 0.05;

  // hairline cracks
  float c1 = fbm(w / 120.0 + 11.0);
  float c2 = fbm(w / 55.0 + 41.0);
  float wob = (vnoise(w * 0.35) - 0.5) * 0.004;
  float crack = (1.0 - smoothstep(0.0, 0.0042, abs(c1 - 0.5 + wob))) * smoothstep(0.45, 0.62, fbm(w / 300.0 + 3.0));
  crack = max(crack, (1.0 - smoothstep(0.0, 0.0034, abs(c2 - 0.5 + wob))) * smoothstep(0.66, 0.76, fbm(w / 200.0 + 8.0)) * 0.8);
  float tm = titleMask(w);
  crack *= 1.0 - 0.9 * tm;

  if (uWear < 0.5) {
    col = mix(col, col * 0.62, crack * 0.8);
    fragColor = vec4(col, 1.0);
    return;
  }

  // ---- the wear that lies over the paint
  // a chalky veil: paint is matt and a little thin everywhere
  float veil = 0.05 + 0.13 * smoothstep(0.35, 0.8, fbm(w / 26.0 + 17.0)) + 0.06 * vnoise(w * 0.7 + 5.0) * fine;
  // abrasion: small flakes, heavier near the cracks and towards the floor
  float nearCrack = (1.0 - smoothstep(0.0, 0.03, abs(c1 - 0.5))) * smoothstep(0.45, 0.62, fbm(w / 300.0 + 3.0));
  float rub = smoothstep(0.66, 0.78, fbm(w / 9.0 + 60.0) + 0.18 * nearCrack + 0.05 * smoothstep(700.0, 790.0, w.y)) * smoothstep(0.35, 0.65, fbm(w / 70.0 + 5.0));
  float speck = smoothstep(0.86, 0.97, vnoise(w * 1.25 + 33.0)) * 0.7 * fine * smoothstep(0.3, 0.6, fbm(w / 40.0 + 90.0));
  float a = clamp(max(veil, max(rub * 0.92, speck) * (1.0 - 0.75 * tm)), 0.0, 1.0);
  vec3 wc = col;
  // cracks cut through the paint film
  wc = mix(wc, col * vec3(0.66, 0.6, 0.55), crack);
  a = max(a, crack * 0.7);

  // losses: brown mud plaster with a broken white lip
  float loss = lossAt(w);
  float lip = lossAt(w + vec2(1.2, 1.0)) - loss;
  vec3 mud = vec3(0.604, 0.478, 0.333) * (0.9 + 0.2 * fbm(w / 5.0 + 2.0));
  mud *= 1.0 - 0.18 * smoothstep(0.7, 0.95, vnoise(w * 0.8 + 9.0)) * fine;
  mud = mix(mud, mud * 1.12, smoothstep(0.5, 0.7, fbm(w / 14.0 + 50.0)) * 0.6); // chopped straw, lighter clods
  wc = mix(wc, mud, loss);
  wc = mix(wc, cream * 1.03, clamp(lip, 0.0, 1.0) * 0.8);
  a = max(a, max(loss, clamp(lip, 0.0, 1.0) * 0.8));
  fragColor = vec4(wc * a, a);
}`;

function drawPlaster(stage, view, r, wear) {
  const sh = stage.shader("egypt/plaster", VERT, PLASTER_FRAG);
  stage.withView(view, () => {
    stage.shaderRect(sh, { uOrigin: [r.x0, r.y0], uSize: [r.x1 - r.x0, r.y1 - r.y0], uPxPerUnit: view.k, uWear: wear }, r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
  });
}

// ------------------------------------------------------------------ the grid
function paintGrid(ctx) {
  const y0 = 456;
  const y1 = ROAD_Y;
  ctx.lineCap = "round";
  const line = (ax, ay, bx, by, seed) => {
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.ceil(len / 14);
    const sag = (hash(seed, 1) - 0.5) * 0.5;
    for (let i = 0; i < n; i += 1) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const q = noise1(i * 0.37, seed);
      if (q < 0.12) continue; // the string ran dry here
      ctx.globalAlpha = 0.35 + 0.4 * q;
      ctx.lineWidth = 0.26 + 0.14 * noise1(i * 0.5, seed + 9);
      const off = (t) => sag * Math.sin(Math.PI * t);
      const nx = -(by - ay) / len;
      const ny = (bx - ax) / len;
      ctx.beginPath();
      ctx.moveTo(lerp(ax, bx, t0) + nx * off(t0), lerp(ay, by, t0) + ny * off(t0));
      ctx.lineTo(lerp(ax, bx, t1) + nx * off(t1), lerp(ay, by, t1) + ny * off(t1));
      ctx.stroke();
      // beads where the pigment gathered on the string
      if (hash(seed, i, 4) > 0.72) {
        const t = lerp(t0, t1, hash(seed, i, 5));
        ctx.beginPath();
        ctx.arc(lerp(ax, bx, t) + nx * off(t), lerp(ay, by, t) + ny * off(t), 0.3 + 0.25 * hash(seed, i, 6), 0, TAU);
        ctx.fillStyle = C.draft;
        ctx.fill();
      }
    }
  };
  ctx.strokeStyle = C.draft;
  for (let j = 0; ROAD_Y - j * G >= y0 - 0.1; j += 1) line(WALL.x0, ROAD_Y - j * G, WALL.x1, ROAD_Y - j * G, 100 + j);
  const i0 = Math.ceil((WALL.x0 - GRID_X0) / G);
  const i1 = Math.floor((WALL.x1 - GRID_X0) / G);
  for (let i = i0; i <= i1; i += 1) line(GRID_X0 + i * G, y0, GRID_X0 + i * G, y1, 400 + i);
  ctx.globalAlpha = 1;
}

/** The ragged right edge of a stage of finish at height y. */
const edge = (x, y, seed, amp = 8) => x + amp * (noise1(y * 0.06, seed) * 2 - 1) + amp * 0.5 * (noise1(y * 0.31, seed + 5) * 2 - 1);

function clipLeftOf(ctx, x, y0, y1, seed, amp) {
  ctx.beginPath();
  ctx.moveTo(WALL.x0 - 10, y0);
  for (let y = y0; y <= y1; y += 2) ctx.lineTo(edge(x, y, seed, amp), y);
  ctx.lineTo(WALL.x0 - 10, y1);
  ctx.closePath();
  ctx.clip();
}

// ------------------------------------------------------------------ signs
// Each sign: { w, h, ops } in a unit box (y down, facing right). ops: { f: fill, p } or { l: line colour, p, w, closed }.
const Z = (n, amp, x0, x1, y) => {
  const pts = [];
  for (let i = 0; i <= n; i += 1) pts.push([lerp(x0, x1, i / n), y + (i % 2 ? -amp : amp)]);
  return pts;
};
const SIGNS = [
  { w: 0.42, h: 1, ops: [{ f: C.green, p: [[0.2, 1], [0.23, 0.55], [0.29, 0.25], [0.38, 0.02], [0.33, 0.3], [0.3, 0.6], [0.28, 1]] }, { f: C.green, p: [[0.25, 0.62], [0.05, 0.34], [0.09, 0.08], [0.28, 0.4]] }] },
  { w: 1, h: 0.3, ops: [{ l: C.blue, w: 0.1, p: Z(12, 0.08, 0, 1, 0.15) }] },
  { w: 0.8, h: 0.42, ops: [{ f: C.yellow, p: ell(0.4, 0.42, 0.4, 0.4, 14, Math.PI, TAU) }] },
  { w: 0.9, h: 0.45, ops: [{ f: C.green, p: [[0, 0.02], ...ell(0.45, 0.02, 0.45, 0.42, 14, 0, Math.PI).reverse().reverse()] }] },
  {
    w: 0.7,
    h: 1,
    ops: [
      { f: C.yellow, p: [[0.27, 0.3], [0.17, 0.6], [0.2, 0.84], [0.08, 0.98], [0.5, 0.98], [0.56, 0.8], [0.62, 0.55], [0.6, 0.3]] },
      { f: C.yellow, p: ell(0.43, 0.2, 0.18, 0.16, 14) },
      { f: C.black, p: ell(0.36, 0.19, 0.04, 0.04, 8) },
      { f: C.black, p: ell(0.5, 0.19, 0.04, 0.04, 8) },
      { l: C.black, w: 0.05, p: [[0.3, 0.45], [0.45, 0.7], [0.5, 0.92]] },
    ],
  },
  { w: 1, h: 0.32, ops: [{ f: C.red, p: [[0, 0.12], [0.6, 0.1], [0.72, 0.04], [0.95, 0.08], [1, 0.16], [0.78, 0.22], [0.6, 0.25], [0, 0.27]] }, { f: C.red, p: [[0.6, 0.1], [0.67, 0], [0.74, 0.02], [0.7, 0.11]] }] },
  { w: 0.9, h: 0.4, ops: [{ f: C.white, p: ell(0.45, 0.2, 0.4, 0.13, 18) }, { f: C.black, p: ell(0.47, 0.17, 0.1, 0.1, 10) }, { l: C.black, w: 0.06, p: [[0.08, 0.26], [0.0, 0.38]] }] },
  {
    w: 1,
    h: 0.36,
    ops: [
      { f: C.yellow, p: ribbon([[0, 0.3], [0.2, 0.21], [0.42, 0.28], [0.62, 0.17], [0.82, 0.15], [0.98, 0.19]], (t) => 0.035 + 0.035 * Math.sin(Math.PI * t)) },
      { l: C.black, w: 0.05, p: [[0.84, 0.12], [0.82, 0.02]] },
      { l: C.black, w: 0.05, p: [[0.9, 0.12], [0.91, 0.02]] },
    ],
  },
  { w: 0.9, h: 0.3, ops: [{ f: C.red, p: [[0, 0.15], [0.45, 0.03], [0.9, 0.15], [0.45, 0.27]] }] },
  { w: 0.5, h: 0.62, ops: [{ f: C.red, p: [[0.17, 0], [0.33, 0], [0.31, 0.12], [0.45, 0.25], [0.45, 0.45], [0.25, 0.62], [0.05, 0.45], [0.05, 0.25], [0.19, 0.12]] }] },
  { w: 0.5, h: 0.5, ops: [{ f: C.red, p: ell(0.25, 0.25, 0.23, 0.23, 16) }, { f: C.black, p: ell(0.25, 0.25, 0.055, 0.055, 8) }] },
  { w: 0.8, h: 0.45, ops: [{ l: C.black, w: 0.08, p: [[0.32, 0.45], [0, 0.45], [0, 0], [0.8, 0], [0.8, 0.45], [0.48, 0.45]] }] },
  { w: 0.5, h: 1, ops: [{ l: C.blue, w: 0.09, closed: true, p: ell(0.25, 0.19, 0.15, 0.18, 14) }, { f: C.blue, p: [[0.02, 0.37], [0.48, 0.37], [0.48, 0.45], [0.02, 0.45]] }, { f: C.blue, p: [[0.21, 0.45], [0.29, 0.45], [0.31, 1], [0.19, 1]] }] },
  { w: 0.5, h: 0.5, ops: [{ l: C.red, w: 0.08, closed: true, p: ell(0.25, 0.21, 0.17, 0.17, 14) }, { f: C.red, p: [[0.03, 0.41], [0.47, 0.41], [0.47, 0.5], [0.03, 0.5]] }] },
  { w: 0.4, h: 1, ops: [{ f: C.yellow, p: [[0.12, 1], [0.14, 0.35], [0.2, 0.12], [0.32, 0], [0.38, 0.08], [0.27, 0.22], [0.3, 0.5], [0.28, 1]] }] },
  {
    w: 0.75,
    h: 0.75,
    ops: [
      { l: C.red, w: 0.05, p: [[0.33, 0.6], [0.31, 0.75]] },
      { l: C.red, w: 0.05, p: [[0.45, 0.6], [0.48, 0.75]] },
      { f: C.yellow, p: [[0.05, 0.38], [0.2, 0.25], [0.45, 0.22], [0.55, 0.12], [0.68, 0.08], [0.74, 0.16], [0.66, 0.22], [0.64, 0.42], [0.52, 0.6], [0.25, 0.62], [0.12, 0.52]] },
      { l: C.black, w: 0.05, p: [[0.2, 0.36], [0.4, 0.45], [0.52, 0.42]] },
    ],
  },
  {
    w: 0.8,
    h: 1,
    ops: [
      { l: C.red, w: 0.05, p: [[0.42, 0.85], [0.42, 1]] },
      { f: C.blue2, p: [[0.08, 0.98], [0.2, 0.62], [0.35, 0.36], [0.55, 0.31], [0.66, 0.42], [0.63, 0.64], [0.5, 0.82], [0.35, 0.98]] },
      { f: C.red, p: [[0.55, 0.32], [0.58, 0.12], [0.7, 0.07], [0.8, 0.14], [0.72, 0.18], [0.66, 0.32]] },
      { l: C.green, w: 0.08, p: [[0.25, 0.62], [0.45, 0.5], [0.56, 0.6]] },
    ],
  },
  { w: 0.55, h: 1, ops: [{ f: C.red, p: [[0.12, 0], [0.3, 0], [0.3, 0.75], [0.32, 0.88], [0.55, 0.94], [0.55, 1], [0.1, 1], [0.12, 0.85]] }] },
  {
    w: 0.5,
    h: 1,
    ops: [{ f: C.green, p: [[0.05, 1], [0.48, 1], [0.44, 0.9], [0.2, 0.86], [0.17, 0.78], [0.26, 0.66], [0.24, 0.4], [0.28, 0.14], [0.4, 0.04], [0.48, 0.12], [0.41, 0.2], [0.37, 0.42], [0.36, 0.7], [0.27, 0.82]] }, { l: C.yellow, w: 0.04, p: [[0.3, 0.2], [0.3, 0.45], [0.31, 0.7]] }],
  },
  { w: 0.55, h: 0.5, ops: [{ f: C.blue, p: [[0, 0.5], [0.55, 0.5], [0.55, 0.37], [0.15, 0.37], [0.15, 0], [0, 0]] }] },
  { w: 1, h: 0.26, ops: [{ f: C.green, p: [[0.05, 0.06], [0.95, 0.06], [0.95, 0.2], [0.05, 0.2]] }, { f: C.green, p: [[0, 0], [0.08, 0], [0.08, 0.26], [0, 0.26]] }, { f: C.green, p: [[0.5, 0.2], [0.58, 0.2], [0.58, 0.26], [0.5, 0.26]] }] },
  { w: 1, h: 0.3, ops: [{ f: C.blue, p: [[0, 0], [1, 0], [1, 0.12], [0.93, 0.3], [0.86, 0.12], [0.14, 0.12], [0.07, 0.3], [0, 0.12]] }] },
  { w: 0.8, h: 0.6, ops: [0, 1, 2].map((i) => ({ l: C.blue, w: 0.07, p: Z(8, 0.06, 0, 0.8, 0.1 + i * 0.2) })) },
  { w: 1, h: 0.5, ops: [{ f: C.red, p: [[0, 0.36], [1, 0.36], [1, 0.5], [0, 0.5]] }, { f: C.yellow, p: [[0.4, 0.36], [0.42, 0.06], [0.58, 0.06], [0.6, 0.36]] }] },
  { w: 0.5, h: 1, ops: [{ f: C.yellow, p: [[0.15, 0.3], [0.35, 0.3], [0.37, 1], [0.13, 1]] }, ...[0, 1, 2, 3].map((i) => ({ f: C.blue, p: [[0.04, 0.04 + i * 0.07], [0.46, 0.04 + i * 0.07], [0.46, 0.09 + i * 0.07], [0.04, 0.09 + i * 0.07]] }))] },
];

/** Draw one sign with its top-left at (x, y), sized s. mode: "final" | "draft". */
function paintSign(ctx, sign, x, y, s, mode, seed) {
  const T = (p) => [x + p[0] * s, y + p[1] * s];
  sign.ops.forEach((op, i) => {
    const pts = op.p.map(T);
    if (mode === "draft") {
      lineHand(ctx, pts, C.draft, 0.45, seed + i, { closed: !!op.f || op.closed, amp: 0.25, alpha: 0.85, broken: 0.1 });
      return;
    }
    if (op.f) {
      fillHand(ctx, pts, op.f, seed + i, 0.12);
      lineHand(ctx, pts, C.black, 0.45, seed + i, { closed: true, amp: 0.12 });
    } else {
      lineHand(ctx, pts, op.l, op.w * s, seed + i, { closed: !!op.closed, amp: 0.12, vary: 0.15 });
    }
  });
}

/** Columns of signs between thin rules, from x0 to x1 (both on rules). */
function paintSignColumns(ctx, x0, x1, mode, seed) {
  const top = 460;
  const bot = 550;
  const colW = 26;
  const ruleColor = mode === "draft" ? C.draft : C.blue;
  const n = Math.round((x1 - x0) / colW);
  // seeded shuffle of the sign list, repeated as needed
  let deck = [];
  let draw = 0;
  const next = () => {
    if (draw >= deck.length) {
      deck = SIGNS.map((sg, i) => ({ sg, k: hash(seed, draw, i) })).sort((a, b) => a.k - b.k).map((d) => d.sg);
      draw = 0;
      seed += 1;
    }
    return deck[draw++];
  };
  for (let c = 0; c <= n; c += 1) {
    const x = x0 + c * colW;
    lineHand(ctx, [[x, top - 3], [x, bot + 3]], ruleColor, 0.55, seed * 31 + c, { amp: 0.15, alpha: mode === "draft" ? 0.8 : 1, broken: mode === "draft" ? 0.15 : 0 });
  }
  lineHand(ctx, [[x0, top - 3], [x1, top - 3]], ruleColor, 0.55, seed * 37, { amp: 0.15 });
  for (let c = 0; c < n; c += 1) {
    const cx = x0 + c * colW + colW / 2;
    const s = 17;
    const list = [];
    let h = 0;
    for (let tries = 0; tries < 8; tries += 1) {
      const sg = next();
      const need = sg.h * s + (list.length ? 3.2 : 0);
      if (h + need > bot - top - 2) break;
      list.push(sg);
      h += need;
    }
    const gap = list.length > 1 ? (bot - top - 2 - h) / (list.length + 1) + 3.2 : 0;
    let y = top + 1 + (list.length > 1 ? gap - 3.2 : (bot - top - h) / 2);
    list.forEach((sg, i) => {
      paintSign(ctx, sg, cx - (sg.w * s) / 2, y, s, mode, seed * 1000 + c * 10 + i);
      y += sg.h * s + gap;
    });
  }
}

// ------------------------------------------------------------------ figures
// A standing man in grid squares: x forward, y up, ground line at 0, hairline at 18.
const MAN = {
  legBack: [[0.0, 6.4], [-0.55, 3.8], [-1.25, 1.25], [-1.0, 0.7], [0.45, 0.14], [0.45, 0], [-2.55, 0], [-2.5, 0.55], [-2.05, 1.15], [-1.85, 3.2], [-1.55, 4.7], [-1.25, 6.4]],
  legFront: [[1.05, 6.4], [1.5, 4.4], [1.95, 1.25], [2.3, 0.7], [4.25, 0.14], [4.25, 0], [1.25, 0], [1.3, 0.6], [1.45, 1.15], [1.05, 3.4], [0.55, 4.9], [-0.15, 6.4]],
  torso: [[-1.25, 11.2], [1.15, 11.2], [1.35, 12.6], [1.9, 13.9], [1.75, 14.5], [2.85, 15.2], [2.75, 16.05], [0.65, 16.25], [-0.45, 16.3], [-2.7, 16.0], [-2.95, 15.25], [-1.9, 14.4], [-1.55, 12.8]],
  neck: [[-0.35, 15.9], [0.7, 15.9], [0.75, 17.0], [-0.3, 17.1]],
  face: [[-0.1, 16.6], [0.95, 16.55], [1.2, 16.75], [1.3, 17.0], [1.25, 17.1], [1.45, 17.25], [1.82, 17.5], [1.75, 17.62], [1.45, 17.85], [1.36, 18.2], [1.3, 18.7], [0.0, 18.9]],
  wig: [[1.27, 18.5], [1.22, 19.15], [0.6, 19.68], [-0.4, 19.78], [-1.3, 19.32], [-1.68, 18.2], [-1.78, 16.9], [-1.62, 16.05], [-0.3, 16.1], [0.12, 16.7], [0.42, 17.4], [0.5, 18.0], [0.9, 18.36]],
  kilt: [[-1.4, 11.35], [1.3, 11.35], [1.55, 10.0], [2.25, 7.6], [2.6, 6.3], [0.2, 6.45], [-1.6, 6.1], [-1.78, 8.5], [-1.62, 10.4]],
};

function limb(pts, w0, w1) {
  const c = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    for (let j = 0; j < 5; j += 1) c.push([lerp(pts[i][0], pts[i + 1][0], j / 5), lerp(pts[i][1], pts[i + 1][1], j / 5)]);
  }
  c.push(pts[pts.length - 1]);
  return ribbon(c, (t) => lerp(w0, w1, t));
}

function fishShape(cx, cy, len, facing = 1) {
  const L = len / 2;
  const body = ell(0, 0, L * 0.78, L * 0.36, 18);
  const tail = [[-L * 0.7, 0], [-L * 1.05, -L * 0.3], [-L * 0.98, 0], [-L * 1.05, L * 0.3]];
  const fin = [[-L * 0.35, -L * 0.3], [-L * 0.05, -L * 0.5], [L * 0.3, -L * 0.32]];
  const T = (p) => [cx + p[0] * facing, cy + p[1]];
  return { body: body.map(T), tail: tail.map(T), fin: fin.map(T), eye: T([L * 0.5, -L * 0.06]), gill: [[L * 0.32, -L * 0.24], [L * 0.24, 0], [L * 0.32, L * 0.24]].map(T) };
}

/** A lotus flower opening upwards from (x, y) in world units, height h. */
function lotusFlower(x, y, h, tilt = 0) {
  const R = (p) => {
    const c = Math.cos(tilt);
    const s = Math.sin(tilt);
    return [x + p[0] * c - p[1] * s, y + p[0] * s + p[1] * c];
  };
  const petals = [[0, 0], [-0.42 * h, -0.95 * h], [-0.18 * h, -0.8 * h], [0, -1.05 * h], [0.18 * h, -0.8 * h], [0.42 * h, -0.95 * h]].map(R);
  const sepals = [[0, 0.05 * h], [-0.3 * h, -0.62 * h], [-0.1 * h, -0.45 * h], [0, -0.7 * h], [0.1 * h, -0.45 * h], [0.3 * h, -0.62 * h]].map(R);
  return { petals, sepals };
}

function lotusBud(x, y, h, tilt = 0) {
  const R = (p) => [x + p[0] * Math.cos(tilt) - p[1] * Math.sin(tilt), y + p[0] * Math.sin(tilt) + p[1] * Math.cos(tilt)];
  return {
    bud: [[0, -0.1 * h], [-0.2 * h, -0.35 * h], [-0.17 * h, -0.66 * h], [0, -h], [0.17 * h, -0.66 * h], [0.2 * h, -0.35 * h]].map(R),
    sepals: [[0, 0.05 * h], [-0.24 * h, -0.3 * h], [-0.1 * h, -0.64 * h], [0, -0.4 * h], [0.1 * h, -0.64 * h], [0.24 * h, -0.3 * h]].map(R),
  };
}

function jarShape(cx, top, h, w) {
  return [[-0.2, 0], [0.2, 0], [0.18, 0.1], [0.5, 0.3], [0.48, 0.65], [0.15, 0.95], [0, 1], [-0.15, 0.95], [-0.48, 0.65], [-0.5, 0.3], [-0.18, 0.1]].map((p) => [cx + p[0] * w, top + p[1] * h]);
}

/**
 * The parts of a standing bearer, back to front, in world units.
 * Each part: { pts, fill, line, lw, closed } (line only when fill is null).
 */
function bearerParts(fx, kind) {
  const T = onGrid(fx);
  const parts = [];
  const skin = { fill: C.red, line: C.black, lw: 0.5 };
  const add = (pts, style, extra = {}) => parts.push({ pts, ...style, closed: true, ...extra });
  const armShoulderF = [2.2, 15.3];
  const armShoulderB = [-2.25, 15.3];

  // the back arm, behind the body when raised
  if (kind === "yoke") add(limb([armShoulderB, [-3.3, 14.0], [-3.3, 16.25]], 0.42, 0.3).map(T), skin);
  add(MAN.legBack.map(T), skin);
  add(MAN.legFront.map(T), skin);
  add(smoothClosed(MAN.torso, 4).map(T), skin);
  add(MAN.kilt.map(T), { fill: C.white, line: C.red, lw: 0.45 });
  // kilt apron and pleats
  parts.push({ pts: [[0.85, 11.3], [1.7, 8.5], [2.45, 6.45]].map(T), line: C.red, lw: 0.35 });
  for (let i = 0; i < 4; i += 1) parts.push({ pts: [[-1.2 + i * 0.5, 11.1], [-1.3 + i * 0.55, 6.5]].map(T), line: C.red, lw: 0.22, alpha: 0.7 });
  parts.push({ pts: [[-1.4, 10.95], [1.32, 10.95]].map(T), line: C.red, lw: 0.4 });
  add(MAN.neck.map(T), skin);
  // broad collar
  const collar = [];
  for (let b = 0; b < 3; b += 1) {
    const r = 0.75 + b * 0.32;
    collar.push({ pts: ell(0.2, 16.2, r, r * 0.8, 14, Math.PI * 1.08, Math.PI * 1.92).map(T), line: [C.blue, C.green, C.blue][b], lw: 0.3 * G * 0.75, closed: false });
  }
  parts.push(...collar);
  add(MAN.face.map(T), skin);
  add(smoothClosed(MAN.wig, 4).map(T), { fill: C.black, line: C.black, lw: 0.3 });
  // eye: frontal, in a profile face
  add(ell(0.98, 17.86, 0.3, 0.12, 14).map(T), { fill: C.white, line: C.black, lw: 0.45 });
  add(ell(1.02, 17.88, 0.1, 0.1, 8).map(T), { fill: C.black, line: null });
  parts.push({ pts: [[0.7, 17.84], [0.42, 17.78]].map(T), line: C.black, lw: 0.4 });
  parts.push({ pts: [[0.62, 18.2], [1.0, 18.27], [1.3, 18.2]].map(T), line: C.black, lw: 0.4 });
  // the front arm and what is carried
  if (kind === "tray") {
    add(limb([[-2.3, 15.3], [-2.7, 12.6], [-2.4, 10.1]], 0.42, 0.3).map(T), skin);
    add(ell(-2.35, 9.7, 0.34, 0.45, 10).map(T), skin);
    add(limb([armShoulderF, [3.6, 13.6], [3.45, 17.7]], 0.42, 0.3).map(T), skin);
    add(ell(3.45, 18.1, 0.42, 0.3, 10).map(T), skin);
    add([[1.6, 18.45], [5.4, 18.45], [5.2, 18.75], [1.8, 18.75]].map(T), { fill: C.yellow, line: C.black, lw: 0.4 });
    for (let i = 0; i < 3; i += 1) {
      const fs = fishShape(fx + (3.5 + (i % 2 ? -0.25 : 0.2)) * G, ROAD_Y - (19.15 + i * 0.62) * G, 3.0 * G, i % 2 ? -1 : 1);
      add(fs.tail, { fill: C.blue2, line: C.black, lw: 0.35 });
      add(fs.fin, { fill: C.red, line: C.black, lw: 0.3 });
      add(fs.body, { fill: C.blue2, line: C.black, lw: 0.4 });
      parts.push({ pts: fs.gill, line: C.black, lw: 0.3 });
      add(ell(fs.eye[0], fs.eye[1], 0.55, 0.55, 8), { fill: C.black, line: null });
    }
  } else if (kind === "lotus") {
    add(limb([[-2.3, 15.3], [-2.7, 12.6], [-2.4, 10.1]], 0.42, 0.3).map(T), skin);
    add(ell(-2.35, 9.7, 0.34, 0.45, 10).map(T), skin);
    const handP = [4.7, 12.8];
    const stems = [
      [[5.0, 12.2], [5.6, 14.0], [5.4, 16.3]],
      [[4.9, 12.2], [6.2, 13.4], [6.7, 15.2]],
      [[4.8, 12.3], [4.5, 14.0], [4.1, 15.4]],
      [[5.1, 12.4], [5.9, 11.0], [6.3, 9.6]],
    ];
    stems.forEach((st) => parts.push({ pts: bez(st[0], st[1], st[1], st[2], 8).map(T), line: C.green, lw: 0.75, closed: false }));
    const fl = (p, h, tilt) => {
      const f = lotusFlower(...T(p), h * G, tilt);
      add(f.petals, { fill: C.white, line: C.black, lw: 0.35 });
      add(f.sepals, { fill: C.green, line: C.black, lw: 0.35 });
      parts.push({ pts: [f.petals[2], f.petals[0]], line: C.blue, lw: 0.4 });
    };
    fl([5.4, 16.2], 1.7, 0.05);
    fl([6.7, 15.1], 1.5, 0.35);
    const b = lotusBud(...T([4.1, 15.3]), 1.3 * G, -0.3);
    add(b.bud, { fill: C.blue2, line: C.black, lw: 0.35 });
    add(b.sepals, { fill: C.green, line: C.black, lw: 0.35 });
    const b2 = lotusBud(...T([6.3, 9.7]), 1.2 * G, Math.PI * 0.85);
    add(b2.bud, { fill: C.blue2, line: C.black, lw: 0.35 });
    add(b2.sepals, { fill: C.green, line: C.black, lw: 0.35 });
    add(limb([armShoulderF, [3.0, 13.0], [4.55, 12.75]], 0.42, 0.3).map(T), skin);
    add(ell(...handP, 0.45, 0.36, 10).map(T), skin);
  } else if (kind === "yoke") {
    // the pole is red-brown wood, not yellow: on the beat at u = 1.0 the pelican's yellow bill lies along it
    add([[-4.9, 16.35], [4.9, 16.35], [4.9, 16.72], [-4.9, 16.72]].map(T), { fill: C.red, line: C.black, lw: 0.4 });
    for (const end of [-1, 1]) {
      const ex = end * 4.4;
      parts.push({ pts: [[ex - 0.5, 16.4], [ex - 0.35, 12.8]].map(T), line: C.black, lw: 0.3 });
      parts.push({ pts: [[ex + 0.5, 16.4], [ex + 0.35, 12.8]].map(T), line: C.black, lw: 0.3 });
      const jar = jarShape(fx + ex * G, ROAD_Y - 12.9 * G, 3.8 * G, 1.9 * G);
      add(jar, { fill: end > 0 ? C.red : C.yellow, line: C.black, lw: 0.45 });
      parts.push({ pts: [[ex - 0.75, 11.5], [ex + 0.75, 11.5]].map(T), line: C.blue, lw: 1.1 });
      parts.push({ pts: [[ex - 0.95, 10.7], [ex + 0.95, 10.7]].map(T), line: C.black, lw: 0.3 });
    }
    add(limb([armShoulderF, [3.3, 14.0], [3.25, 16.25]], 0.42, 0.3).map(T), skin);
    add(ell(3.25, 16.55, 0.36, 0.38, 10).map(T), skin);
  } else if (kind === "jar") {
    add(limb([[-2.3, 15.3], [-2.7, 12.6], [-2.4, 10.1]], 0.42, 0.3).map(T), skin);
    add(ell(-2.35, 9.7, 0.34, 0.45, 10).map(T), skin);
    const jar = jarShape(fx + 2.6 * G, ROAD_Y - 19.9 * G, 3.4 * G, 1.8 * G);
    add(jar, { fill: C.blue2, line: C.black, lw: 0.45 });
    add(limb([armShoulderF, [3.5, 13.2], [3.2, 16.4]], 0.42, 0.3).map(T), skin);
    add(ell(3.1, 16.6, 0.4, 0.36, 10).map(T), skin);
  } else if (kind === "basket") {
    add(limb([armShoulderF, [3.0, 13.2], [3.6, 11.0]], 0.42, 0.3).map(T), skin);
    add(ell(3.7, 10.7, 0.36, 0.42, 10).map(T), skin);
    add([[2.4, 10.4], [5.0, 10.4], ...ell(3.7, 10.4, 1.3, 1.6, 10, 0, Math.PI)].map((p) => (p.length ? p : p)).map((p, i) => (i < 2 ? T(p) : T(p))), { fill: C.green, line: C.black, lw: 0.4 });
    add(limb([[-2.3, 15.3], [-2.7, 12.6], [-2.4, 10.1]], 0.42, 0.3).map(T), skin);
    add(ell(-2.35, 9.7, 0.34, 0.45, 10).map(T), skin);
  }
  return parts;
}

function paintParts(ctx, parts, mode, seed) {
  if (mode === "final") {
    parts.forEach((pt, i) => {
      if (pt.fill) fillHand(ctx, pt.pts, pt.fill, seed + i * 13, 0.22);
      if (pt.line) lineHand(ctx, pt.pts, pt.line, pt.lw, seed + i * 13 + 5, { closed: pt.closed !== false && !!pt.fill, amp: 0.16, alpha: pt.alpha || 1 });
    });
  } else if (mode === "colour") {
    // the red underdrawing still shows where the colour does not quite cover it
    parts.forEach((pt, i) => {
      if (pt.fill && pt.fill !== C.black) lineHand(ctx, pt.pts, C.draft, 0.45, seed + i * 13 + 3, { closed: true, amp: 0.45, alpha: 0.85, broken: 0.25 });
    });
    parts.forEach((pt, i) => {
      if (pt.fill) fillHand(ctx, pt.pts, pt.fill, seed + i * 13, 0.75, 0.94);
      else if (pt.line && pt.lw > 0.6) lineHand(ctx, pt.pts, pt.line, pt.lw, seed + i * 13 + 5, { amp: 0.4 });
    });
  } else {
    parts.forEach((pt, i) => {
      lineHand(ctx, pt.pts, C.draft, 0.55, seed + i * 13 + 3, { closed: pt.closed !== false && !!pt.fill, amp: 0.32, alpha: 1, broken: 0.06 });
    });
  }
}

// --- the seated couple and their offering table, in underdrawing only
const SEATED = {
  torso: MAN.torso.map((p) => [p[0], p[1] - 4]),
  neck: MAN.neck.map((p) => [p[0], p[1] - 4]),
  face: MAN.face.map((p) => [p[0], p[1] - 4]),
  wig: MAN.wig.map((p) => [p[0], p[1] - 4]),
  lap: [[-1.4, 7.4], [1.0, 7.25], [3.7, 6.95], [4.0, 6.3], [3.75, 5.6], [-1.4, 5.4]],
  shin: [[3.95, 5.9], [4.05, 3.0], [3.95, 1.1], [4.3, 0.6], [5.95, 0.14], [5.95, 0], [2.95, 0], [3.0, 0.6], [3.15, 1.1], [3.1, 3.3], [2.9, 5.7]],
  chairSeat: [[-2.4, 5.4], [2.4, 5.4], [2.4, 4.9], [-2.4, 4.9]],
  chairBack: [[-2.4, 5.4], [-2.6, 7.5], [-2.9, 9.4]],
  legA: [[-1.9, 4.9], [-1.9, 0.9], [-1.4, 0.5], [-1.4, 0]],
  legB: [[1.9, 4.9], [1.9, 0.9], [2.4, 0.5], [2.4, 0]],
};

function seatedParts(fx, facing, woman) {
  const T = onGrid(fx, facing);
  const parts = [];
  const add = (pts, closed = true) => parts.push({ pts: pts.map(T), fill: closed ? C.white : null, line: C.draft, lw: 0.42, closed });
  add(SEATED.chairSeat);
  add(SEATED.chairBack, false);
  add(SEATED.legA, false);
  add(SEATED.legB, false);
  add(SEATED.shin);
  add(SEATED.lap);
  add(SEATED.torso);
  add(SEATED.neck);
  add(SEATED.face);
  if (woman) {
    add([[1.27, 14.5], [1.22, 15.15], [0.6, 15.7], [-0.4, 15.8], [-1.3, 15.3], [-1.8, 14.0], [-2.0, 11.0], [-1.7, 9.6], [-0.6, 9.8], [0.1, 12.4], [0.45, 13.4], [0.5, 14.0], [0.9, 14.36]]);
    add([[-1.5, 12.0], [1.6, 11.6], [1.3, 7.2], [3.8, 6.6], [3.7, 1.0], [2.9, 0.3]], false); // the sheath dress
    add([[2.6, 11.4], [4.6, 11.6], [5.8, 12.3]], false); // arm round her husband's shoulder
  } else {
    add(SEATED.wig);
    add([[2.2, 11.6], [3.1, 9.5], [4.8, 10.3], [5.6, 10.6]], false); // arm reaching to the table
    add([[2.6, 11.4], [3.6, 9.3], [5.0, 10.0]], false);
    add([[-2.1, 11.5], [-2.2, 8.7], [1.5, 7.6]], false); // arm on the lap
    add([[-1.7, 11.5], [-1.7, 8.9], [1.5, 8.0]], false);
  }
  add(ell(0.98, 13.86, 0.3, 0.12, 12), true);
  return parts;
}

function tableParts(fx) {
  const T = onGrid(fx);
  const parts = [];
  const add = (pts, closed = true) => parts.push({ pts: pts.map(T), fill: closed ? C.white : null, line: C.draft, lw: 0.42, closed });
  add([[-0.35, 0], [0.35, 0], [0.3, 4.4], [-0.3, 4.4]]); // stand
  add([[-0.9, 0], [0.9, 0], [0.5, 0.4], [-0.5, 0.4]]);
  add([[-3.0, 4.4], [3.0, 4.4], [3.0, 4.8], [-3.0, 4.8]]); // tray
  // the heap: loaves, a haunch, a duck, gourds, lettuce, a lotus over all
  add(ell(-1.8, 5.5, 1.0, 0.7, 14));
  add(ell(0.2, 5.6, 1.2, 0.8, 14));
  add(ell(2.0, 5.5, 0.9, 0.7, 14));
  add([[-2.4, 6.2], [-0.8, 6.0], [1.0, 6.4], [2.5, 6.3], [2.3, 7.2], [0.2, 7.6], [-2.2, 7.1]]); // haunch
  add([[-1.6, 7.4], [0.6, 7.6], [1.6, 8.3], [1.0, 9.0], [-1.0, 8.9], [-1.9, 8.3]]); // duck
  add([[0.6, 8.4], [1.4, 9.6], [1.9, 9.2]], false);
  add(ell(-0.6, 9.6, 0.8, 0.55, 12));
  add(ell(0.9, 9.8, 0.55, 0.65, 12));
  add([[-2.2, 9.0], [-1.6, 11.0], [-1.2, 9.2]]);
  add([[1.6, 9.4], [2.2, 11.2], [2.4, 9.3]]);
  add([[-0.2, 10.2], [0.2, 11.6], [0.6, 10.3]]);
  // jars beside the stand
  add([[-2.6, 0], [-1.6, 0], [-1.4, 1.6], [-1.8, 2.6], [-2.4, 2.6], [-2.8, 1.6]]);
  add([[1.6, 0], [2.6, 0], [2.8, 1.6], [2.4, 2.6], [1.8, 2.6], [1.4, 1.6]]);
  return parts;
}

// ------------------------------------------------------------------ bands
function paintFrieze(ctx) {
  const top = PAINT_TOP_Y;
  const bot = 455;
  const xEnd = (y) => edge(ZONE.draft, y, 61, 6);
  ctx.save();
  clipLeftOf(ctx, ZONE.draft, top - 5, bot + 3, 61, 6);
  fillHand(ctx, [[WALL.x0, top - 6], [ZONE.draft + 20, top - 6], [ZONE.draft + 20, bot], [WALL.x0, bot]], C.yellow, 70, 0.3);
  const cols = [C.blue, C.green, C.red];
  let i = 0;
  for (let x = WALL.x0 + 1; x < ZONE.draft + 10; x += 9.4, i += 1) {
    const final = x < ZONE.colour;
    const kh = [[x + 1, bot], [x + 1, 445], [x + 0.4, 442], [x + 1.6, 437.5], [x + 4, 435.4], [x + 6.4, 437.5], [x + 7.6, 442], [x + 7, 445], [x + 7, bot]];
    fillHand(ctx, kh, cols[i % 3], 900 + i, final ? 0.12 : 0.5);
    fillHand(ctx, ell(x + 4, 438.6, 1.3, 1.3, 8), C.yellow, 950 + i, 0.1);
    if (final) {
      lineHand(ctx, kh, C.black, 0.4, 980 + i, { closed: true, amp: 0.1 });
      lineHand(ctx, [[x + 1, 446.2], [x + 7, 446.2]], C.black, 0.5, 990 + i, { amp: 0.08 });
      lineHand(ctx, [[x + 1, 448.4], [x + 7, 448.4]], C.black, 0.5, 995 + i, { amp: 0.08 });
    }
  }
  ctx.restore();
  // the black line under the frieze
  ctx.save();
  clipLeftOf(ctx, ZONE.colour + 30, bot - 2, bot + 4, 63, 5);
  lineHand(ctx, [[WALL.x0, bot + 0.8], [ZONE.draft, bot + 0.8]], C.black, 1.7, 64, { amp: 0.15 });
  ctx.restore();
  // beyond: the ornament is only drawn in
  for (let x = ZONE.draft - 2; x < ZONE.bare - 20; x += 9.4) {
    lineHand(ctx, [[x + 1, bot], [x + 1, 445], [x + 0.4, 442], [x + 1.6, 437.5], [x + 4, 435.4], [x + 6.4, 437.5], [x + 7.6, 442], [x + 7, 445], [x + 7, bot]], C.draft, 0.4, 1100 + Math.round(x), { amp: 0.3, alpha: 0.85, broken: 0.12 });
  }
  void xEnd;
}
const PAINT_TOP_Y = 433;

function paintGroundAndWater(ctx) {
  // ground line: black band and a thin red line beneath, finished up to the colour zone's end
  ctx.save();
  clipLeftOf(ctx, ZONE.draft + 10, 690, 760, 81, 6);
  fillHand(ctx, [[WALL.x0, 700], [ZONE.draft + 30, 700], [ZONE.draft + 30, 704], [WALL.x0, 704]], C.black, 82, 0.25);
  lineHand(ctx, [[WALL.x0, 705.6], [ZONE.draft + 30, 705.6]], C.red, 1.1, 83, { amp: 0.12 });
  ctx.restore();
  lineHand(ctx, [[ZONE.draft - 10, 700.6], [WALL.x1, 700.6]], C.draft, 0.55, 84, { amp: 0.1, alpha: 0.9, broken: 0.05 });

  // the pool
  ctx.save();
  clipLeftOf(ctx, ZONE.draft, 706, 754, 85, 7);
  fillHand(ctx, [[WALL.x0, 708], [ZONE.draft + 20, 708], [ZONE.draft + 20, 752], [WALL.x0, 752]], C.blue, 86, 0.3);
  ctx.restore();
  ctx.save();
  clipLeftOf(ctx, ZONE.colour + 4, 706, 754, 87, 6);
  for (let r = 0; r < 4; r += 1) {
    const y = 714 + r * 10.5;
    const pts = [];
    for (let x = WALL.x0 + (r % 2) * 3.5; x < ZONE.colour + 20; x += 3.5) pts.push([x, y + ((Math.round((x - WALL.x0) / 3.5) + r) % 2 ? -1.6 : 1.6)]);
    lineHand(ctx, pts, C.black, 0.42, 88 + r, { amp: 0.1 });
  }
  ctx.restore();
  // lotus, buds and fish, finished / colour only / drawn
  let n = 0;
  for (let x = WALL.x0 + 18; x < ZONE.bare - 20; x += 46 + 18 * hash(n, 3), n += 1) {
    const mode = x < ZONE.colour ? "final" : x < ZONE.draft - 10 ? "colour" : "draft";
    const kind = n % 3;
    const parts = [];
    if (kind === 0) {
      const f = lotusFlower(x, 750, 30, 0);
      parts.push({ pts: [[x, 752], [x + 0.3, 735]], line: C.green, lw: 0.9, closed: false });
      parts.push({ pts: f.petals.map((p) => [p[0], p[1] + (750 - 750)]).map((p) => [p[0], 752 + (p[1] - 750) * 1.25]), fill: C.white, line: C.black, lw: 0.35 });
      parts.push({ pts: f.sepals.map((p) => [p[0], 752 + (p[1] - 750) * 1.25]), fill: C.green, line: C.black, lw: 0.35 });
    } else if (kind === 1) {
      const b = lotusBud(x, 752, 26, 0);
      parts.push({ pts: b.bud, fill: C.blue2, line: C.black, lw: 0.35 });
      parts.push({ pts: b.sepals, fill: C.green, line: C.black, lw: 0.35 });
    } else {
      const fs = fishShape(x, 729 + (hash(n, 5) - 0.5) * 6, 22, hash(n, 6) > 0.5 ? 1 : -1);
      parts.push({ pts: fs.tail, fill: C.blue2, line: C.black, lw: 0.35 });
      parts.push({ pts: fs.fin, fill: C.red, line: C.black, lw: 0.3 });
      parts.push({ pts: fs.body, fill: C.white, line: C.black, lw: 0.4 });
      parts.push({ pts: fs.gill, line: C.black, lw: 0.3, closed: false });
      parts.push({ pts: ell(fs.eye[0], fs.eye[1], 0.6, 0.6, 8), fill: C.black });
    }
    paintParts(ctx, parts, mode, 1300 + n * 50);
  }
  // drawn guide lines for the bands still to be painted
  for (const y of [708, 752, 756, 790]) lineHand(ctx, [[ZONE.draft - 20, y], [ZONE.bare + 30, y]], C.draft, 0.4, 1500 + y, { amp: 0.12, alpha: 0.8, broken: 0.12 });
  for (let r = 0; r < 3; r += 1) {
    const pts = [];
    for (let x = ZONE.draft; x < ZONE.bare - 30; x += 3.5) pts.push([x, 718 + r * 12 + (Math.round(x / 3.5) % 2 ? -1.5 : 1.5)]);
    lineHand(ctx, pts, C.draft, 0.35, 1520 + r, { amp: 0.15, alpha: 0.75, broken: 0.3 });
  }

  // dado: stripes over a speckled red "granite"
  ctx.save();
  clipLeftOf(ctx, ZONE.draft - 4, 754, 802, 91, 6);
  const X1 = ZONE.draft + 20;
  const band = (y0, y1, col, seed) => fillHand(ctx, [[WALL.x0, y0], [X1, y0], [X1, y1], [WALL.x0, y1]], col, seed, 0.2);
  band(755.5, 758, C.black, 92);
  band(758, 766, C.yellow, 93);
  band(766, 770, C.red, 94);
  band(770, 772, C.black, 95);
  band(772, 802, C.red, 96);
  for (let i = 0; i < 900; i += 1) {
    const x = lerp(WALL.x0, X1, hash(i, 7));
    const y = lerp(774, 801, hash(i, 8));
    ctx.fillStyle = hash(i, 9) > 0.45 ? C.black : C.yellow;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.ellipse(x, y, 0.5 + 0.7 * hash(i, 10), 0.4 + 0.5 * hash(i, 11), hash(i, 12) * 3, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ------------------------------------------------------------------ title and cartouche
const TITLE = { x0: 404, x1: 594, y0: 458, y1: 552 };

function fitText(ctx, text, fontCss, maxW, spacing) {
  ctx.font = fontCss;
  ctx.letterSpacing = `${spacing}px`;
  const w = ctx.measureText(text).width;
  return { w, sx: Math.min(1, maxW / w) };
}

function textAt(ctx, text, cx, y, fontCss, color, maxW, spacing = 0, stroke = null) {
  ctx.save();
  const { sx } = fitText(ctx, text, fontCss, maxW, spacing);
  ctx.translate(cx, y);
  ctx.scale(sx, 1);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  if (stroke) {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.w;
    ctx.lineJoin = "round";
    ctx.strokeText(text, 0, 0);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** A tiny pelican on a bicycle, the cartouche's determinative. Box w 17 x h 15, top-left (x, y). */
function paintDeterminative(ctx, x, y) {
  const P = (px, py) => [x + px, y + py];
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // wheels
  for (const cx of [3.6, 13.0]) {
    ctx.beginPath();
    ctx.arc(...P(cx, 11.6), 3.0, 0, TAU);
    ctx.strokeStyle = C.black;
    ctx.lineWidth = 0.75;
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI + Math.PI / 2;
      ctx.moveTo(...P(cx + Math.cos(a) * 2.8, 11.6 + Math.sin(a) * 2.8));
      ctx.lineTo(...P(cx - Math.cos(a) * 2.8, 11.6 - Math.sin(a) * 2.8));
    }
    ctx.lineWidth = 0.35;
    ctx.stroke();
  }
  // frame
  ctx.beginPath();
  ctx.moveTo(...P(3.6, 11.6));
  ctx.lineTo(...P(7.6, 11.4));
  ctx.lineTo(...P(12.0, 7.4));
  ctx.lineTo(...P(13.0, 11.6));
  ctx.moveTo(...P(7.6, 11.4));
  ctx.lineTo(...P(6.4, 7.2));
  ctx.lineTo(...P(3.6, 11.6));
  ctx.moveTo(...P(12.0, 7.4));
  ctx.lineTo(...P(11.4, 6.2));
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = C.black;
  ctx.stroke();
  // bird
  ctx.beginPath();
  ctx.ellipse(...P(6.3, 5.4), 3.6, 2.3, -0.35, 0, TAU);
  ctx.fillStyle = C.white;
  ctx.fill();
  ctx.lineWidth = 0.45;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(...P(8.6, 4.0));
  ctx.quadraticCurveTo(...P(10.4, 2.6), ...P(9.6, 1.0));
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = C.white;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(...P(9.9, 1.2), 1.1, 0, TAU);
  ctx.fillStyle = C.white;
  ctx.fill();
  ctx.strokeStyle = C.black;
  ctx.lineWidth = 0.4;
  ctx.stroke();
  ctx.beginPath(); // bill and pouch
  ctx.moveTo(...P(10.8, 0.9));
  ctx.lineTo(...P(17.0, 1.5));
  ctx.lineTo(...P(11.8, 3.6));
  ctx.closePath();
  ctx.fillStyle = C.yellow;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath(); // wing
  ctx.moveTo(...P(4.0, 4.6));
  ctx.lineTo(...P(8.8, 5.6));
  ctx.lineTo(...P(3.2, 6.6));
  ctx.closePath();
  ctx.fillStyle = C.blue;
  ctx.fill();
  ctx.beginPath(); // leg
  ctx.moveTo(...P(6.6, 7.0));
  ctx.lineTo(...P(8.4, 9.6));
  ctx.lineTo(...P(7.6, 11.8));
  ctx.strokeStyle = C.red;
  ctx.lineWidth = 0.6;
  ctx.stroke();
}

function paintTitle(ctx) {
  const cx = (TITLE.x0 + TITLE.x1) / 2;
  // the block is washed white and ruled in blue like the sign columns around it
  fillHand(ctx, [[TITLE.x0, TITLE.y0 - 1], [TITLE.x1, TITLE.y0 - 1], [TITLE.x1, TITLE.y1 + 1], [TITLE.x0, TITLE.y1 + 1]], C.white, 2001, 0.25, 0.9);
  lineHand(ctx, [[TITLE.x0, 457], [TITLE.x0, 553]], C.blue, 0.55, 2002, { amp: 0.12 });
  lineHand(ctx, [[TITLE.x1, 457], [TITLE.x1, 553]], C.blue, 0.55, 2003, { amp: 0.12 });

  // 1. the Chinese name in five square cells
  const cell = 27;
  const cx0 = cx - (cell * 5) / 2;
  const cy0 = 459;
  lineHand(ctx, [[cx0, cy0], [cx0 + cell * 5, cy0]], C.blue, 0.5, 2010, { amp: 0.1 });
  lineHand(ctx, [[cx0, cy0 + cell], [cx0 + cell * 5, cy0 + cell]], C.blue, 0.5, 2011, { amp: 0.1 });
  for (let i = 0; i <= 5; i += 1) lineHand(ctx, [[cx0 + i * cell, cy0], [cx0 + i * cell, cy0 + cell]], C.blue, 0.5, 2012 + i, { amp: 0.1 });
  [...META.zh].forEach((ch, i) => {
    textAt(ctx, ch, cx0 + (i + 0.5) * cell, cy0 + cell * 0.84, `400 25px ${FONT_ZH}`, C.blue, cell, 0, { color: C.black, w: 1.1 });
  });

  // 2. English name, 3. the date
  textAt(ctx, META.en.toUpperCase(), cx, 499.5, `600 12px ${FONT_EN}`, C.black, TITLE.x1 - TITLE.x0 - 6, 0.9);
  textAt(ctx, `${META.date} · ${META.dateEn}`, cx, 513.5, `600 12.5px ${FONT_EN}`, C.red, TITLE.x1 - TITLE.x0 - 10, 0.2);

  // 4. the cartouche, lying on its side, tied at the right
  const ox0 = TITLE.x0 + 4;
  const ox1 = TITLE.x1 - 9;
  const oy0 = 519;
  const oy1 = 550.5;
  const r = (oy1 - oy0) / 2;
  const oval = (inset) => {
    const pts = [];
    for (let i = 0; i <= 12; i += 1) pts.push([ox1 - r + Math.cos(-Math.PI / 2 + (i / 12) * Math.PI) * (r - inset), oy0 + r + Math.sin(-Math.PI / 2 + (i / 12) * Math.PI) * (r - inset)]);
    for (let i = 0; i <= 12; i += 1) pts.push([ox0 + r + Math.cos(Math.PI / 2 + (i / 12) * Math.PI) * (r - inset), oy0 + r + Math.sin(Math.PI / 2 + (i / 12) * Math.PI) * (r - inset)]);
    return pts;
  };
  fillHand(ctx, oval(0), C.yellow, 2020, 0.12);
  fillHand(ctx, oval(2.4), C.white, 2021, 0.1);
  lineHand(ctx, oval(0), C.black, 0.6, 2022, { closed: true, amp: 0.1 });
  lineHand(ctx, oval(2.4), C.black, 0.5, 2023, { closed: true, amp: 0.1 });
  // rope twists
  const outer = resample(oval(1.2), true, 2.2);
  ctx.strokeStyle = C.red;
  ctx.lineWidth = 0.35;
  for (let i = 0; i < outer.length; i += 1) {
    const p = outer[i];
    ctx.beginPath();
    ctx.moveTo(p[0] - 0.7, p[1] - 0.7);
    ctx.lineTo(p[0] + 0.7, p[1] + 0.7);
    ctx.stroke();
  }
  // the tie
  const tie = [[ox1 - 0.5, oy0 - 1.5], [ox1 + 4.6, oy0 - 1.5], [ox1 + 4.6, oy1 + 1.5], [ox1 - 0.5, oy1 + 1.5]];
  fillHand(ctx, tie, C.yellow, 2024, 0.1);
  lineHand(ctx, tie, C.black, 0.6, 2025, { closed: true, amp: 0.1 });
  lineHand(ctx, [[ox1 + 2, oy0], [ox1 + 2, oy1]], C.red, 0.4, 2026, { amp: 0.08 });

  // inside: a reed over a loaf, the name, the determinative
  paintSign(ctx, SIGNS[0], ox0 + 8, oy0 + 7.5, 16, "final", 2030);
  paintSign(ctx, SIGNS[8], ox0 + 15.5, oy0 + 9.5, 9, "final", 2031);
  paintSign(ctx, SIGNS[2], ox0 + 15.8, oy0 + 16.5, 8.5, "final", 2032);
  textAt(ctx, "THE PELICAN TEST", ox0 + 27 + (ox1 - ox0 - 54) / 2, oy0 + r + 4.9, `700 14px ${FONT_EN}`, C.black, ox1 - ox0 - 56, 0.35);
  paintDeterminative(ctx, ox1 - 25.5, oy0 + 8.2);
}

// ------------------------------------------------------------------ the wall
function paintWall(ctx) {
  paintGrid(ctx);

  // the white ground wash over the grid where the wall is finished
  ctx.save();
  clipLeftOf(ctx, ZONE.colour + 6, 440, 702, 51, 10);
  fillHand(ctx, [[WALL.x0, 456.5], [ZONE.colour + 40, 456.5], [ZONE.colour + 40, 700], [WALL.x0, 700]], C.white, 52, 0.3, 0.78);
  ctx.restore();

  paintFrieze(ctx);
  // sign columns: finished on the left, drawn on the right; the title in between
  paintSignColumns(ctx, TITLE.x0 - 26 * 18, TITLE.x0, "final", 300);
  paintSignColumns(ctx, TITLE.x1, TITLE.x1 + 26 * 11, "draft", 500);
  paintTitle(ctx);

  // finished bearers
  const bearers = [
    { x: 62, kind: "tray" },
    { x: 140, kind: "lotus" },
    { x: 220, kind: "yoke" },
  ];
  bearers.forEach((b, i) => paintParts(ctx, bearerParts(b.x, b.kind), "final", 3000 + i * 400));
  // colour laid in, no outlines yet
  paintParts(ctx, bearerParts(452, "jar"), "colour", 4200);
  paintParts(ctx, bearerParts(522, "basket"), "colour", 4600);
  // underdrawing: the offering table and the seated couple, facing the bearers
  const table = tableParts(640);
  paintParts(ctx, table, "draft", 5000);
  const wife = seatedParts(770, -1, true);
  const man = seatedParts(744, -1, false);
  paintParts(ctx, wife, "draft", 5400);
  paintParts(ctx, man, "draft", 5800);
  // a few corrections in black: the master's hand over the apprentice's
  const T = onGrid(744, -1);
  const fixes = [
    SEATED.face.map((p) => [p[0] + 0.12, p[1] - 4 + 0.05]),
    [[2.2, 11.5], [3.25, 9.7], [4.9, 10.45], [5.7, 10.7]],
    [[-2.4, 5.4], [-2.5, 7.4], [-2.7, 9.2]],
  ];
  fixes.forEach((pts, i) => lineHand(ctx, pts.map(T), C.black, 0.42, 6100 + i, { amp: 0.25, alpha: 0.9 }));
  lineHand(ctx, ell(0.2, 5.6, 1.25, 0.85, 14).map(onGrid(640)), C.black, 0.4, 6110, { closed: true, amp: 0.25 });

  paintGroundAndWater(ctx);
}

function bakeWall(stage) {
  const k = WALL_PX * stage.s;
  const w = Math.round((WALL.x1 - WALL.x0) * k);
  const h = Math.round((WALL.y1 - WALL.y0) * k);
  return stage.bake(`egypt/wall/${k.toFixed(3)}`, w, h, () => {
    const view = new View(k, -WALL.x0 * k, -WALL.y0 * k);
    drawPlaster(stage, view, WALL, 0);
    const layer = new Layer2D(stage.p, w, h);
    const ctx = layer.ctx;
    ctx.save();
    ctx.setTransform(k, 0, 0, k, -WALL.x0 * k, -WALL.y0 * k);
    paintWall(ctx);
    ctx.restore();
    layer.touch();
    stage.origin();
    stage.image(layer, 0, 0, w, h);
    const textures = stage.p._renderer && stage.p._renderer.textures;
    if (textures && typeof textures.get === "function") {
      const tex = textures.get(layer.img);
      if (tex && typeof tex.remove === "function") tex.remove();
      textures.delete(layer.img);
    }
  });
}

function bakeWear(stage) {
  const k = WALL_PX * stage.s;
  return stage.bake(`egypt/wear/${k.toFixed(3)}`, Math.round((WALL.x1 - WALL.x0) * k), Math.round((WALL.y1 - WALL.y0) * k), () => {
    drawPlaster(stage, new View(k, -WALL.x0 * k, -WALL.y0 * k), WALL, 1);
  });
}

// ------------------------------------------------------------------ the pelican, painted
const shapeMap = (skel) => {
  const m = {};
  for (const sh of skel.shapes) m[sh.id] = sh;
  return m;
};
const lerpPts = (a, b, t) => a.map((p, i) => [lerp(p[0], b[i][0], t), lerp(p[1], b[i][1], t)]);
const shift = (pts, d) => pts.map((p) => [p[0] + d[0], p[1] + d[1]]);

// The canonical pose, in wheel radii from the road point (x forward, y up).
const POSE = {
  bodyC: [-0.58, 3.25],
  shoulderW: 0.6, // half-widths of the frontal chest
  waistW: 0.3,
  bodyTop: 4.12,
  bodyBot: 2.38,
  neckBase: [-0.52, 4.1],
  head: [0.18, 5.6],
  // near wing: out forward from the front shoulder, the hand bent down onto the grip
  nearWing: [[-0.25, 3.92], [-0.15, 4.14], [0.3, 4.2], [0.75, 4.18], [1.1, 4.08], [1.24, 3.88], [1.18, 3.56], [0.98, 3.22], [0.76, 2.96], [0.62, 2.84], [0.5, 2.95], [0.56, 3.2], [0.62, 3.3], [0.35, 3.36], [0.05, 3.4], [-0.2, 3.55]],
  nearRoot: [-0.15, 4.1],
  nearTip: [1.2, 4.02],
  // far wing: mirrored out behind, bent down at the hand, holding an ankh
  farWing: [[-1.0, 4.14], [-1.5, 4.2], [-2.0, 4.18], [-2.45, 4.08], [-2.7, 3.86], [-2.78, 3.48], [-2.74, 3.08], [-2.66, 2.9], [-2.5, 2.94], [-2.42, 3.22], [-2.38, 3.3], [-2.1, 3.36], [-1.6, 3.38], [-1.2, 3.42], [-0.95, 3.65]],
  farRoot: [-1.0, 4.1],
  farTip: [-2.7, 4.02],
  ankh: [-2.6, 2.56],
};

function wingBands(ctx, pts, root, tip, seed, raise) {
  // Bands of feathers along the wing, scale-like coverts along the leading edge.
  const dx = tip[0] - root[0];
  const dy = tip[1] - root[1];
  const L = Math.hypot(dx, dy) || 1;
  const ax = [dx / L, dy / L];
  let nx = [-ax[1], ax[0]];
  if (nx[1] < 0) nx = [-nx[0], -nx[1]]; // towards the trailing edge, downwards
  let vmin = Infinity;
  let vmax = -Infinity;
  let umin = Infinity;
  let umax = -Infinity;
  for (const p of pts) {
    const v = (p[0] - root[0]) * nx[0] + (p[1] - root[1]) * nx[1];
    const u = (p[0] - root[0]) * ax[0] + (p[1] - root[1]) * ax[1];
    vmin = Math.min(vmin, v);
    vmax = Math.max(vmax, v);
    umin = Math.min(umin, u);
    umax = Math.max(umax, u);
  }
  ctx.save();
  trace(ctx, pts, true);
  ctx.clip();
  ctx.transform(ax[0], ax[1], nx[0], nx[1], root[0], root[1]);
  const span = vmax - vmin;
  const cov = Math.min(span * 0.42, 6.5);
  // coverts: red with rows of little scales
  ctx.fillStyle = C.red;
  ctx.fillRect(umin - 2, vmin - 2, umax - umin + 4, cov + 2);
  ctx.strokeStyle = C.black;
  ctx.lineWidth = 0.35;
  const sc = 2.6;
  for (let row = 0; row * sc * 0.8 < cov; row += 1) {
    const v = vmin + row * sc * 0.8 + sc * 0.6;
    for (let u = umin - 2 + (row % 2) * sc * 0.5; u < umax + 2; u += sc) {
      ctx.beginPath();
      ctx.arc(u, v - sc * 0.35, sc * 0.5, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  }
  // long feathers: bands of blue and green with red, divided by black lines
  const bands = [C.blue, C.green, C.blue2, C.green, C.blue, C.red];
  const bw = 2.3;
  let i = 0;
  for (let v = vmin + cov; v < vmax + 2; v += bw, i += 1) {
    ctx.fillStyle = bands[i % bands.length];
    ctx.fillRect(umin - 2, v, umax - umin + 4, bw + 0.05);
    ctx.beginPath();
    ctx.moveTo(umin - 2, v);
    for (let u = umin - 2; u <= umax + 2; u += 3) ctx.lineTo(u, v + 0.12 * Math.sin(u * 0.7 + seed + i));
    ctx.lineWidth = 0.32;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(umin - 2, vmin + cov);
  ctx.lineTo(umax + 2, vmin + cov);
  ctx.stroke();
  void raise;
  ctx.restore();
}

function eyeFrontal(ctx, e, S, lid) {
  // the Egyptian eye: an almond seen from the front, a kohl line and its cosmetic tail
  const ew = 0.17 * S;
  const eh = 0.07 * S;
  const top = [];
  const bot = [];
  for (let i = 0; i <= 12; i += 1) {
    const t = i / 12;
    const x = e[0] - ew + 2 * ew * t; // back .. front
    const shape = Math.sin(Math.PI * t) ** 0.9;
    top.push([x, e[1] - eh * shape * (1.1 - 0.25 * t) + 0.012 * S * t]);
    bot.push([x, e[1] + eh * 0.85 * shape + 0.012 * S * t]);
  }
  const almond = top.concat(bot.slice(1, -1).reverse());
  ctx.fillStyle = C.white;
  trace(ctx, almond, true);
  ctx.fill();
  ctx.save();
  trace(ctx, almond, true);
  ctx.clip();
  ctx.fillStyle = C.black;
  ctx.beginPath();
  ctx.arc(e[0] + 0.012 * S, e[1] - eh * 0.25, eh * 1.05, 0, TAU);
  ctx.fill();
  if (lid > 0.001) {
    // the lid comes down, the colour of the head
    ctx.fillStyle = C.white;
    ctx.fillRect(e[0] - ew - 1, e[1] - eh * 1.3, 2 * ew + 2, eh * 2.2 * lid);
  }
  ctx.restore();
  ctx.strokeStyle = C.black;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 0.055 * S;
  trace(ctx, top, false);
  ctx.stroke();
  ctx.lineWidth = 0.03 * S;
  trace(ctx, bot, false);
  ctx.stroke();
  if (lid > 0.001) {
    const ly = e[1] - eh * 1.3 + eh * 2.2 * lid;
    ctx.lineWidth = 0.045 * S;
    ctx.beginPath();
    ctx.moveTo(e[0] - ew * 0.95, Math.min(ly, e[1] + eh * 0.5));
    ctx.lineTo(e[0] + ew * 0.95, Math.min(ly, e[1] + eh * 0.5) + 0.01 * S);
    ctx.stroke();
  }
  // cosmetic tail and brow, sweeping back
  ctx.lineWidth = 0.04 * S;
  ctx.beginPath();
  ctx.moveTo(e[0] - ew * 0.9, e[1] + 0.005 * S);
  ctx.lineTo(e[0] - ew * 2.0, e[1] + 0.02 * S);
  ctx.stroke();
  ctx.lineWidth = 0.035 * S;
  ctx.beginPath();
  ctx.moveTo(e[0] + ew * 0.9, e[1] - eh * 2.0);
  ctx.quadraticCurveTo(e[0], e[1] - eh * 2.9, e[0] - ew * 1.8, e[1] - eh * 1.9);
  ctx.stroke();
}

function paintAnkh(ctx, c, S, k) {
  const s = 0.95 * S * k;
  const loop = ell(c[0], c[1] - 0.2 * s, 0.13 * s, 0.17 * s, 14);
  const bar = [[c[0] - 0.24 * s, c[1] - 0.03 * s], [c[0] + 0.24 * s, c[1] - 0.03 * s], [c[0] + 0.24 * s, c[1] + 0.04 * s], [c[0] - 0.24 * s, c[1] + 0.04 * s]];
  const stem = [[c[0] - 0.045 * s, c[1] + 0.04 * s], [c[0] + 0.045 * s, c[1] + 0.04 * s], [c[0] + 0.07 * s, c[1] + 0.62 * s], [c[0] - 0.07 * s, c[1] + 0.62 * s]];
  ctx.lineJoin = "round";
  ctx.strokeStyle = C.black;
  ctx.lineWidth = 0.1 * s + 0.6;
  trace(ctx, loop, true);
  ctx.stroke();
  ctx.strokeStyle = C.blue;
  ctx.lineWidth = 0.1 * s - 0.5;
  ctx.stroke();
  for (const p of [bar, stem]) fillHand(ctx, p, C.blue, 71, 0.08);
  for (const p of [bar, stem]) lineHand(ctx, p, C.black, 0.5, 72, { closed: true, amp: 0.08 });
}

/** Everything about the pelican for this frame. */
function pelicanFrame(f) {
  const u = f.u;
  const pel = f.pelican;
  const k = poseAmount(u);
  const T0 = pel.time - (u - 2);
  const time = lerp(pel.time, T0, k);
  const act = {
    bob: 1 - k,
    wind: 1 - k,
    headPitch: k * (deg(13) - deg(2.2) * wobble(T0 * 0.23, 23)),
  };
  // wheels snap to a symmetrical place for the pose
  let wheel = pel.wheel;
  if (k > 0) {
    let stopWheel = pel.wheel;
    if (f.film && typeof f.film.pelicanFor === "function") stopWheel = f.film.pelicanFor(f.n, f.t - u + 2.5).wheel;
    const snapped = Math.PI / 6 + (Math.PI / 3) * Math.round((stopWheel - Math.PI / 6) / (Math.PI / 3));
    wheel = lerp(pel.wheel, pel.wheel + (snapped - stopWheel), k);
  }
  const skel = solveRig({ ...pel, time, act });
  return { k, skel, wheel, lid: Math.max(skel.lid * (1 - k), holdBlink(u)) };
}

function paintPelican(ctx, f, P) {
  const { k, skel, wheel } = P;
  const pel = f.pelican;
  const S = skel.scale;
  const W = (p) => [pel.x + p[0] * S, pel.y - p[1] * S];
  const sh = shapeMap(skel);
  const J = skel.joints;
  const seedOf = (id) => {
    let h = 17;
    for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 100003;
    return h;
  };
  const OUT = C.red; // the bird's outline: red-brown
  const lw = 0.045 * S;
  const fillLine = (pts, fill, line, w, id, amp = 0.25) => {
    fillHand(ctx, pts, fill, seedOf(id) + 1, amp + 0.1);
    lineHand(ctx, pts, line, w, seedOf(id), { closed: true, amp, vary: 0.2 });
  };
  const limbPoly = (shape, w) => ribbon(resample(shape.pts, false, 2), w / 2);

  // ---- pose geometry
  const headTarget = W(POSE.head);
  const delta = [(headTarget[0] - J.head[0]) * k, (headTarget[1] - J.head[1]) * k];
  const bodyPose = [];
  const nB = sh.body.pts.length;
  const bc = W(POSE.bodyC);
  const midY = (POSE.bodyTop + POSE.bodyBot) / 2;
  const halfH = (POSE.bodyTop - POSE.bodyBot) / 2;
  for (let i = 0; i < nB; i += 1) {
    const a = (i / nB) * TAU;
    const cs = Math.cos(a);
    const sn = Math.sin(a);
    // a frontal chest in the Egyptian manner: square shoulders, a narrow waist
    const t = (sn + 1) / 2;
    const hw = lerp(POSE.waistW, POSE.shoulderW, t ** 1.4) * S;
    const x = bc[0] + Math.sign(cs) * Math.abs(cs) ** 0.6 * hw;
    const y = W([0, midY + Math.sign(sn) * Math.abs(sn) ** (sn > 0 ? 0.45 : 0.9) * halfH])[1];
    bodyPose.push([x, y]);
  }
  const body = lerpPts(sh.body.pts, bodyPose, k);

  // ---- far wing and ankh (only in the pose)
  if (k > 0.001) {
    const sroot = W(POSE.farRoot);
    const grow = (p) => [sroot[0] + (p[0] - sroot[0]) * k, sroot[1] + (p[1] - sroot[1]) * k];
    const fw = POSE.farWing.map(W).map(grow);
    wingBands(ctx, fw, sroot, grow(W(POSE.farTip)), 3, k);
    lineHand(ctx, fw, C.black, lw, 801, { closed: true, amp: 0.2 });
  }

  // ---- far leg and pedal
  const leg = (side) => {
    const thigh = sh[`leg${side}Thigh`];
    const shin = sh[`leg${side}Shin`];
    fillLine(limbPoly({ pts: thigh.pts.concat(shin.pts.slice(1)) }, 0.15 * S), C.red, C.black, 0.6, `leg${side}`, 0.15);
    fillLine(sh[`foot${side}`].pts, C.red, C.black, 0.55, `foot${side}`, 0.15);
  };
  const crank = (side) => {
    const c = sh[`crank${side}`];
    lineHand(ctx, c.pts, C.black, 0.09 * S, seedOf(`crank${side}`), { amp: 0.05, vary: 0.05 });
    fillLine(sh[`pedal${side}`].pts, C.yellow, C.black, 0.5, `pedal${side}`, 0.08);
  };
  leg("Far");
  crank("Far");

  // ---- chariot wheels: black tyre, yellow rim, six spokes
  for (const name of ["Rear", "Front"]) {
    const c = sh[`tire${name}`].c;
    ctx.lineCap = "round";
    const ring = (r, w, color, seed) => lineHand(ctx, ell(c[0], c[1], r, r, 40), color, w, seed, { closed: true, amp: 0.18, vary: 0.12 });
    ring(0.9 * S, 0.11 * S, C.black, seedOf(name) + 1);
    ring(0.81 * S, 0.075 * S, C.yellow, seedOf(name) + 2);
    ring(0.765 * S, 0.022 * S, C.black, seedOf(name) + 3);
    for (let i = 0; i < 6; i += 1) {
      const a = -wheel + (i * Math.PI) / 3;
      const d = [Math.cos(a), -Math.sin(a)];
      const sp = [
        [c[0] + d[0] * 0.1 * S - d[1] * 0.035 * S, c[1] + d[1] * 0.1 * S + d[0] * 0.035 * S],
        [c[0] + d[0] * 0.76 * S - d[1] * 0.022 * S, c[1] + d[1] * 0.76 * S + d[0] * 0.022 * S],
        [c[0] + d[0] * 0.76 * S + d[1] * 0.022 * S, c[1] + d[1] * 0.76 * S - d[0] * 0.022 * S],
        [c[0] + d[0] * 0.1 * S + d[1] * 0.035 * S, c[1] + d[1] * 0.1 * S - d[0] * 0.035 * S],
      ];
      ctx.fillStyle = C.black;
      trace(ctx, sp, true);
      ctx.fill();
    }
    fillLine(ell(c[0], c[1], 0.15 * S, 0.15 * S, 14), C.yellow, C.black, 0.55, `hub${name}`, 0.08);
  }

  // ---- the machine, in black with yellow joints
  const tubes = ["chainStay", "seatStay", "seatTube", "downTube", "topTube", "fork", "seatPost", "stem", "bar"];
  for (const id of tubes) lineHand(ctx, sh[id].pts, C.black, (id === "seatPost" || id === "stem" || id === "bar" ? 0.07 : 0.085) * S, seedOf(id), { amp: 0.12, vary: 0.12 });
  lineHand(ctx, sh.headTube.pts, C.black, 0.12 * S, seedOf("headTube"), { amp: 0.08 });
  for (const id of ["chainTop", "chainBottom"]) lineHand(ctx, sh[id].pts, C.black, 0.03 * S, seedOf(id), { amp: 0.05 });
  lineHand(ctx, ell(sh.ring.c[0], sh.ring.c[1], sh.ring.r, sh.ring.r, 16), C.black, 0.09 * S, 41, { closed: true, amp: 0.06 });
  lineHand(ctx, ell(sh.ring.c[0], sh.ring.c[1], sh.ring.r, sh.ring.r, 16), C.yellow, 0.045 * S, 42, { closed: true, amp: 0.06 });
  fillLine(sh.saddle.pts, C.black, C.black, 0.4, "saddle", 0.1);
  lineHand(ctx, sh.grip.pts, C.black, 0.13 * S, 43, { amp: 0.05 });
  const joint = (p, r, id) => fillLine(ell(p[0], p[1], r, r, 12), C.yellow, C.black, 0.5, id, 0.06);
  joint(J.bb, 0.12 * S, "jbb");
  joint(sh.seatTube.pts[1], 0.085 * S, "jseat");
  joint(sh.headTube.pts[0], 0.08 * S, "jcrown");
  joint(sh.headTube.pts[1], 0.08 * S, "jhead");
  crank("Near");

  // ---- the bird: tail, near leg, body, collar, neck, head
  const tailTo = W([-0.82, 2.62]);
  for (let i = 0; i < 3; i += 1) {
    // in the pose the tail tucks in under the narrow chest
    const t = sh[`tail${i}`].pts.map((p) => [
      lerp(p[0], tailTo[0] + (p[0] - J.tailRoot[0]) * 0.6, k),
      lerp(p[1], tailTo[1] + (p[1] - J.tailRoot[1]) * 0.6, k),
    ]);
    fillHand(ctx, t, C.white, seedOf(`tail${i}`), 0.12);
    fillHand(ctx, t.slice(Math.floor(t.length * 0.3), Math.ceil(t.length * 0.7) + 1), C.black, seedOf(`tail${i}`) + 1, 0.08);
    lineHand(ctx, t, C.black, 0.45, seedOf(`tail${i}`) + 2, { closed: true, amp: 0.1 });
  }
  leg("Near");
  fillLine(body, C.white, OUT, lw, "body", 0.25);
  // breast feathers as rows of small scales, and a broad collar at the neck
  const nb0 = sh.neck.pts[0];
  const nb1 = sh.neck.pts[sh.neck.pts.length - 1];
  const neckBaseRig = [(nb0[0] + nb1[0]) / 2, (nb0[1] + nb1[1]) / 2];
  const neckBasePose = W(POSE.neckBase);
  const nbase = [lerp(neckBaseRig[0], neckBasePose[0], k), lerp(neckBaseRig[1], neckBasePose[1] + 0.05 * S, k)];
  const bodyCRig = J.body;
  const bcen = [lerp(bodyCRig[0], bc[0], k), lerp(bodyCRig[1], bc[1], k)];
  ctx.save();
  trace(ctx, body, true);
  ctx.clip();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 0.3;
  ctx.globalAlpha = 0.5;
  const sc = 0.2 * S;
  for (let row = -4; row <= 5; row += 1) {
    for (let col = -6; col <= 6; col += 1) {
      const x = bcen[0] + (col + (row % 2) * 0.5) * sc;
      const y = bcen[1] + row * sc * 0.75;
      ctx.beginPath();
      ctx.arc(x, y, sc * 0.42, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  const collarCols = [C.blue, C.red, C.green, C.blue2];
  for (let b = 3; b >= 0; b -= 1) {
    ctx.beginPath();
    ctx.arc(nbase[0], nbase[1], (0.24 + b * 0.11) * S, 0, TAU);
    ctx.fillStyle = collarCols[b];
    ctx.fill();
    ctx.lineWidth = 0.35;
    ctx.strokeStyle = C.black;
    ctx.stroke();
  }
  // drop pendants on the outer row
  for (let i = 0; i < 14; i += 1) {
    const a = (i / 14) * TAU;
    const r0 = 0.57 * S;
    ctx.beginPath();
    ctx.ellipse(nbase[0] + Math.cos(a) * r0, nbase[1] + Math.sin(a) * r0, 0.045 * S, 0.07 * S, a + Math.PI / 2, 0, TAU);
    ctx.fillStyle = C.red;
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  lineHand(ctx, body, OUT, lw, seedOf("body2"), { closed: true, amp: 0.25 });

  // neck: the rig's, eased into a tall S
  const n0 = neckBasePose;
  const n3 = headTarget;
  const sCenter = bez(n0, [n0[0] + 0.75 * S, n0[1] - 0.25 * S], [n3[0] - 0.85 * S, n3[1] + 0.55 * S], [n3[0] - 0.1 * S, n3[1] + 0.2 * S], 16);
  const sNeck = ribbon(sCenter, (t) => lerp(0.27, 0.15, t ** 0.7) * S);
  const neck = lerpPts(sh.neck.pts, sNeck, k);
  fillLine(neck, C.white, OUT, lw, "neck", 0.22);

  // head group, moved with the head
  for (let i = 0; i < 3; i += 1) fillLine(shift(sh[`crest${i}`].pts, delta), C.white, OUT, 0.5, `crest${i}`, 0.08);
  const pouch = shift(sh.pouch.pts, delta);
  fillLine(pouch, C.yellow, OUT, 0.6, "pouch", 0.18);
  ctx.save();
  trace(ctx, pouch, true);
  ctx.clip();
  ctx.strokeStyle = C.red;
  ctx.lineWidth = 0.35;
  ctx.globalAlpha = 0.7;
  for (let i = 1; i < 6; i += 1) {
    const a = pouch[Math.round((i / 6) * 14)];
    const b = pouch[pouch.length - 1 - Math.round((i / 6) * 14)];
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  fillLine(shift(sh.billLower.pts, delta), C.yellow, OUT, 0.6, "billLower", 0.1);
  fillLine(shift(sh.head.pts, delta), C.white, OUT, lw, "head", 0.18);
  const upper = shift(sh.billUpper.pts, delta);
  fillLine(upper, C.yellow, OUT, 0.65, "billUpper", 0.1);
  // the ridge of the bill and its nail, in red
  lineHand(ctx, [upper[0], upper[1], upper[2], upper[3]].map((p, i) => [p[0], p[1] + 0.035 * S * (1 - i / 4)]), C.red, 0.4, 61, { amp: 0.06 });
  fillHand(ctx, [upper[4], upper[5], upper[6], upper[7]], C.red, 62, 0.05);
  const eye = [J.eye[0] + delta[0], J.eye[1] + delta[1]];
  eyeFrontal(ctx, eye, S, P.lid);

  // ---- near wing: the rig's folded wing, eased into the pose
  const nw = lerpPts(sh.wing.pts, POSE.nearWing.map(W), k);
  const wrist = J.wingTip;
  let far = sh.wing.pts[0];
  let best = 0;
  for (const p of sh.wing.pts) {
    const d = Math.hypot(p[0] - wrist[0], p[1] - wrist[1]);
    if (d > best) {
      best = d;
      far = p;
    }
  }
  const nr = W(POSE.nearRoot);
  const nt = W(POSE.nearTip);
  const root = [lerp(wrist[0], nr[0], k), lerp(wrist[1], nr[1], k)];
  const tip = [lerp(far[0], nt[0], k), lerp(far[1], nt[1], k)];
  // the dark primaries behind the folded wing, shrinking away in the pose
  for (let i = 0; i < 4; i += 1) {
    const t = sh[`wingTip${i}`].pts;
    const r0 = t[0];
    const tt = t.map((p) => [r0[0] + (p[0] - r0[0]) * (1 - k), r0[1] + (p[1] - r0[1]) * (1 - k)]);
    if (k < 0.98) {
      fillHand(ctx, tt, i % 2 ? C.blue : C.green, seedOf(`wt${i}`), 0.1);
      lineHand(ctx, tt, C.black, 0.45, seedOf(`wt${i}`) + 1, { closed: true, amp: 0.08 });
    }
  }
  wingBands(ctx, nw, root, tip, 1, k);
  lineHand(ctx, nw, C.black, lw, seedOf("wing"), { closed: true, amp: 0.2 });
  if (k > 0.001) {
    const sroot = W(POSE.farRoot);
    const ac = W(POSE.ankh);
    paintAnkh(ctx, [sroot[0] + (ac[0] - sroot[0]) * k, sroot[1] + (ac[1] - sroot[1]) * k], S, k);
  }
  for (let i = 0; i < 2; i += 1) {
    const t = sh[`wingHand${i}`].pts;
    const r0 = t[0];
    const tt = t.map((p) => [r0[0] + (p[0] - r0[0]) * (1 - k), r0[1] + (p[1] - r0[1]) * (1 - k)]);
    if (k < 0.98) {
      fillHand(ctx, tt, C.blue, seedOf(`wh${i}`), 0.06);
      lineHand(ctx, tt, C.black, 0.4, seedOf(`wh${i}`) + 1, { closed: true, amp: 0.06 });
    }
  }
}

// ------------------------------------------------------------------ the scene
export const egypt = {
  ...META,
  still: { u: 2.4, cx: 418 }, // held, eyes open (u = 2.5 is the blink itself)

  motion(u) {
    return { x: motionX(u) };
  },

  init(stage) {
    bakeWall(stage);
    bakeWear(stage);
  },

  render(stage, f) {
    const view = f.view;
    const wall = bakeWall(stage);
    stage.origin();
    stage.rect(0, 0, f.w, f.h, C.plaster);
    stage.withView(view, () => {
      stage.image(wall, WALL.x0, WALL.y0, WALL.x1 - WALL.x0, WALL.y1 - WALL.y0);
    });

    if (f.pelican.visible) {
      const P = pelicanFrame(f);
      const b = P.skel.bounds;
      const patch = stage.patch("egypt/pelican", view, b.x0 - 6, b.y0 - 4, b.x1 + 6, b.y1 + 3);
      paintPelican(patch.ctx, f, P);
      stage.imagePatch(patch);
    }

    const wear = bakeWear(stage);
    stage.withView(view, () => {
      stage.image(wear, WALL.x0, WALL.y0, WALL.x1 - WALL.x0, WALL.y1 - WALL.y0);
    });
  },
};
