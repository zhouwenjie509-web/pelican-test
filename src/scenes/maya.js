// Section 7. Maya codex, c. 1200 CE, in the manner of the Postclassic
// screenfold books: black reed line and flat streaky colour on bark paper
// sized with white lime stucco.
//
// The book lies open flat. Each page is exactly one pedal turn wide, and the
// head of each page carries the running count of pedal revolutions in
// bar-and-dot numerals, painted in as the pelican completes that turn. At
// u = 3.0 the count reaches forty: two dots over the shell that means zero.
//
// Layers: a shader ground (stucco, stains, creases) with all fixed painting
// baked on top from a 2D canvas; per frame the numbers as they stand at f.u
// and the pelican in codex style; last, a baked wear pass (flaking along the
// folds and edges, craquelure, grime) over everything.

import { sectionMeta } from "./sections.js";
import { View, Layer2D } from "../kit/stage.js";
import { VERT, FRAG_HEAD, NOISE } from "../kit/glsl.js";
import { hash, hashString, noise1, rng } from "../kit/rng.js";
import { smoothClosed, smoothOpen } from "../kit/geom.js";
import { solveRig } from "../rig/rig.js";
import { clamp, smoothstep, lerp } from "../beat/ease.js";

const META = sectionMeta(7);

const PAGE = 1000 / 6; // one pedal turn
const BOOK = { x0: -110, y0: 418, x1: 1110, y1: 802 };
const BOOK_PX = 3.3; // cached pixels per world unit at 1080p

const C = {
  ink: "#1c1512",
  red: "#b33a25",
  blue: "#3f9d9b",
  ochre: "#d7a43c",
  brown: "#7a4a2a",
  skin: "#a9573a",
  white: "#f5efe1",
  stucco: "#efe6d2",
  pouch: "#cf5a33",
  legFar: "#8e2d1d",
};

// registers (world y)
const R = {
  textTop: 476,
  ruleA: 558,
  ruleB: 562,
  sky: 575,
  base: 700,
  baseB: 703,
  lowTop: 708,
  lowBot: 784,
};

const TITLE = { x0: 110, x1: 378 }; // the title strip, across the fold at 250

// ===================================================================== shaders
const SHARED = `
uniform vec2 uOrigin;
uniform vec2 uSize;
uniform float uPx;
${NOISE}
const float PAGEW = ${PAGE.toFixed(4)};
float edgeTop(float x) { return 434.0 + (fbm(vec2(x / 21.0, 3.1)) - 0.5) * 6.0; }
float edgeBot(float x) { return 789.0 + (fbm(vec2(x / 25.0, 8.7)) - 0.5) * 6.0; }
// distance to the nearest fold, and which page
float foldDist(float x) {
  float px = mod(x - PAGEW * 0.5, PAGEW);
  return min(px, PAGEW - px);
}
`;

const GROUND_FRAG = `${FRAG_HEAD}
${SHARED}
void main() {
  vec2 w = uOrigin + vTexCoord * uSize;
  float fine = smoothstep(1.2, 2.6, uPx);
  float et = edgeTop(w.x);
  float eb = edgeBot(w.x);
  if (w.y < et || w.y > eb) {
    // the dark cloth the book lies on, with its shadow
    vec3 cloth = vec3(0.13, 0.095, 0.075) * (0.85 + 0.3 * fbm(w / 30.0));
    float sh = w.y < et ? smoothstep(et - 10.0, et, w.y) : smoothstep(eb + 10.0, eb, w.y);
    fragColor = vec4(cloth * (1.0 - 0.5 * sh), 1.0);
    return;
  }
  vec3 stucco = vec3(0.937, 0.902, 0.824);
  vec3 col = stucco;
  // broad tone and old stains
  float tone = fbm(w / 210.0 + 4.0);
  col *= 0.92 + 0.09 * tone;
  col = mix(col, col * vec3(0.97, 0.93, 0.85), smoothstep(0.35, 0.75, fbm(w / 60.0 + 2.0)) * 0.7);
  float st = fbm(w / 95.0 + 13.0);
  float stain = smoothstep(0.60, 0.78, st);
  col = mix(col, col * vec3(0.90, 0.83, 0.70), stain * 0.55);
  float tide = smoothstep(0.012, 0.0, abs(st - 0.60)) * 0.5;
  col = mix(col, col * vec3(0.80, 0.70, 0.55), tide * 0.5);
  float st2 = smoothstep(0.66, 0.84, fbm(w / 40.0 + 71.0));
  col = mix(col, col * vec3(0.93, 0.88, 0.80), st2 * 0.6);
  // grime toward the edges of the book
  float edge = min(w.y - et, eb - w.y);
  col *= 1.0 - 0.18 * smoothstep(26.0, 0.0, edge) * (0.6 + 0.4 * fbm(w / 12.0));
  // the folds: each page bows a little, the crease is a dark line
  float dc = foldDist(w.x);
  float k = floor((w.x - PAGEW * 0.5) / PAGEW);
  float valley = mod(k, 2.0) < 0.5 ? 1.0 : -1.0;
  float px = mod(w.x - PAGEW * 0.5, PAGEW) / PAGEW - 0.5;
  col *= 1.0 + 0.025 * px * valley;
  col *= 1.0 - 0.20 * exp(-dc * dc / 0.9) - 0.05 * exp(-dc * dc / 18.0);
  col *= 1.0 + 0.035 * exp(-pow(dc - 2.4, 2.0) / 1.6);
  // lime grain: fine trowel marks and pits
  col *= 1.0 + (vnoise(w * 1.4) - 0.5) * 0.06 * fine + (vnoise(vec2(w.x * 0.25, w.y * 0.9)) - 0.5) * 0.035;
  vec2 cell = floor(w / 3.0);
  float pit = step(0.93, hash21(cell)) * (1.0 - smoothstep(0.08, 0.22, length(w / 3.0 - cell - 0.5)));
  col = mix(col, col * 0.86, pit * fine);
  fragColor = vec4(col, 1.0);
}`;

const WEAR_FRAG = `${FRAG_HEAD}
${SHARED}
vec4 over(vec4 dst, vec3 c, float a) { return vec4(c * a + dst.rgb * (1.0 - a), a + dst.a * (1.0 - a)); }
void main() {
  vec2 w = uOrigin + vTexCoord * uSize;
  float fine = smoothstep(1.2, 2.6, uPx);
  float et = edgeTop(w.x);
  float eb = edgeBot(w.x);
  if (w.y < et - 0.5 || w.y > eb + 0.5) { fragColor = vec4(0.0); return; }
  // bark: brown fibres running along the strip
  float fib = fbm(vec2(w.x / 30.0, w.y / 1.3));
  vec3 bark = mix(vec3(0.33, 0.24, 0.15), vec3(0.60, 0.47, 0.31), fib);
  bark *= 0.9 + 0.2 * vnoise(vec2(w.x / 5.0, w.y * 2.2));
  vec3 stucco = vec3(0.925, 0.89, 0.81);
  vec3 crackC = vec3(0.33, 0.25, 0.18);

  // where the stucco has gone: along the edges, along the folds, in patches
  float ragT = et + 2.5 + 7.0 * fbm(vec2(w.x / 9.0, 1.7)) * smoothstep(0.35, 0.75, fbm(vec2(w.x / 60.0, 2.0)));
  float ragB = eb - 2.0 - 7.0 * fbm(vec2(w.x / 9.0, 5.3)) * smoothstep(0.35, 0.75, fbm(vec2(w.x / 55.0, 6.0)));
  float edgeLoss = max(1.0 - smoothstep(ragT - 0.4, ragT + 0.4, w.y), smoothstep(ragB - 0.4, ragB + 0.4, w.y));
  float dc = foldDist(w.x);
  float k = floor((w.x - PAGEW * 0.5) / PAGEW + 0.5);
  float nearEdge = max(smoothstep(520.0, 445.0, w.y), smoothstep(715.0, 785.0, w.y));
  float foldW = (0.6 + 3.2 * fbm(vec2(w.y / 11.0, k * 7.1))) * mix(0.35, 1.0, nearEdge);
  foldW *= smoothstep(0.38, 0.55, fbm(vec2(w.y / 34.0, k * 3.3 + 1.0)));
  // the figure register is left whole, so no crease runs through the rider
  foldW *= 1.0 - smoothstep(566.0, 574.0, w.y) * smoothstep(699.0, 693.0, w.y);
  float foldOn = smoothstep(0.15, 0.5, foldW);
  float foldLoss = 1.0 - smoothstep(foldW - 0.4, foldW + 0.4, dc);
  float holes = smoothstep(0.735, 0.75, fbm(w / 24.0 + 50.0)) * smoothstep(0.55, 0.7, fbm(w / 150.0 + 3.0));
  float loss = max(max(edgeLoss, foldLoss), holes);
  // the lip of stucco around each loss, a touch lighter
  float lip = max(max(1.0 - smoothstep(ragT + 0.3, ragT + 1.6, w.y), smoothstep(ragB - 1.6, ragB - 0.3, w.y)),
                  (1.0 - smoothstep(foldW + 0.2, foldW + 1.3, dc)) * foldOn) * (1.0 - loss);

  vec4 o = vec4(0.0);
  // grime over everything
  float g = fbm(w / 70.0 + 31.0);
  o = over(o, vec3(0.45, 0.34, 0.22), 0.07 * smoothstep(0.45, 0.8, g));
  // craquelure: two scales of hairline
  float c1 = 1.0 - smoothstep(0.0, 0.010, abs(fbm(w / 26.0 + 5.0) - 0.5));
  float c2 = 1.0 - smoothstep(0.0, 0.016, abs(fbm(w / 9.0 + 17.0) - 0.5));
  float cm = smoothstep(0.35, 0.65, fbm(w / 120.0 + 8.0));
  o = over(o, crackC, clamp(c1 * 0.55 * cm + c2 * 0.28 * cm * fine, 0.0, 1.0));
  // flecks where paint has lifted from the stucco
  float speck = smoothstep(0.80, 0.90, vnoise(w * 0.62 + 33.0)) * smoothstep(0.42, 0.72, fbm(w / 50.0 + 9.0));
  float speck2 = smoothstep(0.86, 0.95, vnoise(w * 1.7 + 3.0)) * 0.7 * fine;
  o = over(o, stucco, clamp(max(speck, speck2) * 0.85, 0.0, 1.0));
  o = over(o, stucco * 1.02, lip * 0.75);
  o = over(o, bark, loss);
  fragColor = o;
}`;

function shaderPass(stage, view, frag, key) {
  const sh = stage.shader(key, VERT, frag);
  const r = BOOK;
  stage.withView(view, () => {
    stage.shaderRect(sh, { uOrigin: [r.x0, r.y0], uSize: [r.x1 - r.x0, r.y1 - r.y0], uPx: view.k }, r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
  });
}

// ===================================================================== the reed
// Lines are ribbons: a polygon of slowly varying width whose centre wanders a
// little, keyed to arc length so the hand stays the same as a shape moves.

function resample(pts, closed, step) {
  const src = closed ? [...pts, pts[0]] : pts;
  const out = [[src[0][0], src[0][1], 0]];
  let s = 0;
  let carry = 0;
  for (let i = 1; i < src.length; i += 1) {
    const ax = src[i - 1][0];
    const ay = src[i - 1][1];
    const dx = src[i][0] - ax;
    const dy = src[i][1] - ay;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) continue;
    let t = step - carry;
    while (t <= d) {
      out.push([ax + (dx * t) / d, ay + (dy * t) / d, s + t]);
      t += step;
    }
    carry = d - (t - step);
    s += d;
  }
  if (closed) {
    const last = out[out.length - 1];
    if (Math.hypot(last[0] - out[0][0], last[1] - out[0][1]) < step * 0.4) out.pop();
  } else if (carry > step * 0.25) {
    const e = src[src.length - 1];
    out.push([e[0], e[1], s]);
  }
  return { P: out, L: s };
}

/** A reed line. o: { closed, seed, wob, vary, color, alpha } */
function ribbon(ctx, pts, w, o = {}) {
  if (!pts || pts.length < 2) return;
  const closed = !!o.closed;
  const seed = o.seed ?? 1;
  const wob = o.wob ?? 0.1 + 0.08 * w;
  const vary = o.vary ?? 0.32;
  const step = Math.max(0.45, Math.min(1.6, w * 0.7));
  const { P, L } = resample(pts, closed, step);
  const n = P.length;
  if (n < 2) return;
  const Lp = [];
  const Rp = [];
  for (let i = 0; i < n; i += 1) {
    const a = closed ? P[(i - 1 + n) % n] : P[Math.max(0, i - 1)];
    const b = closed ? P[(i + 1) % n] : P[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const s = P[i][2];
    const off = (noise1(s * 0.11, seed) - 0.5) * 2 * wob;
    let half = (w / 2) * (1 - vary / 2 + vary * noise1(s * 0.15 + 7.3, seed + 31));
    if (!closed) half *= 0.62 + 0.38 * smoothstep(0, Math.min(L * 0.5, w * 2.2), Math.min(s, L - s));
    const nx = -ty;
    const ny = tx;
    Lp.push([P[i][0] + nx * (off + half), P[i][1] + ny * (off + half)]);
    Rp.push([P[i][0] + nx * (off - half), P[i][1] + ny * (off - half)]);
  }
  ctx.beginPath();
  if (closed) {
    ctx.moveTo(Lp[0][0], Lp[0][1]);
    for (let i = 1; i < n; i += 1) ctx.lineTo(Lp[i][0], Lp[i][1]);
    ctx.closePath();
    ctx.moveTo(Rp[n - 1][0], Rp[n - 1][1]);
    for (let i = n - 2; i >= 0; i -= 1) ctx.lineTo(Rp[i][0], Rp[i][1]);
    ctx.closePath();
  } else {
    ctx.moveTo(Lp[0][0], Lp[0][1]);
    for (let i = 1; i < n; i += 1) ctx.lineTo(Lp[i][0], Lp[i][1]);
    const fe = [P[n - 1][0] - P[n - 2][0], P[n - 1][1] - P[n - 2][1]];
    const fs = [P[0][0] - P[1][0], P[0][1] - P[1][1]];
    capTo(ctx, P[n - 1], Lp[n - 1], Rp[n - 1], fe);
    for (let i = n - 2; i >= 0; i -= 1) ctx.lineTo(Rp[i][0], Rp[i][1]);
    capTo(ctx, P[0], Rp[0], Lp[0], fs);
    ctx.closePath();
  }
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.fillStyle = o.color || C.ink;
  ctx.fill("nonzero");
  ctx.globalAlpha = 1;
}

// a round cap from a to b around centre c, bulging toward direction f
function capTo(ctx, c, a, b, f) {
  const a0 = Math.atan2(a[1] - c[1], a[0] - c[0]);
  const r = Math.hypot(a[0] - c[0], a[1] - c[1]);
  const af = Math.atan2(f[1], f[0]);
  let d = af - a0;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const sg = d >= 0 ? 1 : -1;
  for (let i = 1; i < 6; i += 1) {
    const t = a0 + (sg * Math.PI * i) / 6;
    ctx.lineTo(c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r);
  }
  ctx.lineTo(b[0], b[1]);
}

// ---------------------------------------------------------------- streaky fills
let TILE = null; // the streak tile (a Layer2D)
const TILE_K = 5; // tile pixels per world unit
const TILE_U = 48; // tile size in world units
const patterns = new WeakMap();

function makeTile(stage) {
  if (TILE) return TILE;
  const px = TILE_U * TILE_K;
  TILE = new Layer2D(stage.p, px, px);
  const ctx = TILE.ctx;
  const r = rng(7007);
  ctx.clearRect(0, 0, px, px);
  for (let i = 0; i < 170; i += 1) {
    const x = r() * px;
    const y = r() * px;
    const len = (3 + r() * 16) * TILE_K;
    const th = (0.25 + r() * 0.9) * TILE_K;
    const light = r() < 0.45;
    ctx.fillStyle = light ? `rgba(255,250,236,${0.05 + r() * 0.1})` : `rgba(50,24,10,${0.04 + r() * 0.09})`;
    for (const ox of [-px, 0, px]) {
      for (const oy of [-px, 0, px]) {
        ctx.beginPath();
        ctx.ellipse(x + ox, y + oy, len / 2, th / 2, (r() - 0.5) * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  return TILE;
}

function patFor(ctx) {
  let p = patterns.get(ctx);
  if (!p && TILE) {
    p = ctx.createPattern(TILE.canvas, "repeat");
    patterns.set(ctx, p);
  }
  return p;
}

function pathOf(pts) {
  const path = new Path2D();
  path.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) path.lineTo(pts[i][0], pts[i][1]);
  path.closePath();
  return path;
}

/** Flat colour laid with a brush: o { alpha, angle (deg), ax, ay (anchor), streak } */
function wash(ctx, pts, color, o = {}) {
  const path = pts instanceof Path2D ? pts : pathOf(pts);
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 0.95;
  ctx.fillStyle = color;
  ctx.fill(path);
  const pat = (o.streak ?? 1) > 0 ? patFor(ctx) : null;
  if (pat) {
    pat.setTransform(new DOMMatrix().translate(o.ax ?? 0, o.ay ?? 0).rotate(o.angle ?? -6).scale(1 / TILE_K));
    ctx.globalAlpha = (o.streak ?? 1) * 0.95;
    ctx.fillStyle = pat;
    ctx.fill(path);
  }
  ctx.restore();
}

function blobPts(cx, cy, rx, ry, seed, n = 10, wob = 0.12) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (hash(seed, i, 3) - 0.5) * 2 * wob;
    out.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return smoothClosed(out, 4);
}

function ellPts(cx, cy, rx, ry, rot = 0, n = 28) {
  const out = [];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    out.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return out;
}

function rrectPts(x, y, w, h, r) {
  const out = [];
  const corner = (cx, cy, a0) => {
    for (let i = 0; i <= 4; i += 1) {
      const a = a0 + (i / 4) * (Math.PI / 2);
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  corner(x + w - r, y + r, -Math.PI / 2);
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, Math.PI / 2);
  corner(x + r, y + r, Math.PI);
  return out;
}

function spiralPts(cx, cy, r0, turns, a0, dir = 1, n = 22) {
  const out = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const a = a0 + dir * t * turns * Math.PI * 2;
    const r = r0 * (1 - 0.82 * t);
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

// ===================================================================== a local quill
// Q maps local coordinates (u, v) in a box to world units; widths stay in world units.
class Q {
  constructor(ctx, x, y, sx, sy, seed, wk = 1) {
    this.wk = wk;
    this.ctx = ctx;
    this.x = x;
    this.y = y;
    this.sx = sx;
    this.sy = sy ?? sx;
    this.seed = seed;
    this.n = 0;
  }
  P(u, v) {
    if (this.tr) return [this.x + v * this.sx, this.y + u * this.sy];
    return [this.x + u * this.sx, this.y + v * this.sy];
  }
  map(list) {
    return list.map(([u, v]) => this.P(u, v));
  }
  next() {
    this.n += 1;
    return (this.seed * 131 + this.n * 17) % 100003;
  }
  line(list, w = 0.9, o = {}) {
    w *= this.wk;
    const pts = this.map(list);
    ribbon(this.ctx, o.sharp || pts.length < 3 ? pts : smoothOpen(pts, 5), w, { seed: this.next(), ...o });
  }
  loop(list, w = 0.9, o = {}) {
    w *= this.wk;
    const pts = this.map(list);
    ribbon(this.ctx, o.sharp ? pts : smoothClosed(pts, 5), w, { closed: true, seed: this.next(), ...o });
  }
  fill(list, color, o = {}) {
    const pts = this.map(list);
    wash(this.ctx, o.sharp ? pts : smoothClosed(pts, 5), color, { ax: this.x, ay: this.y, ...o });
  }
  shape(list, color, w = 0.9, o = {}) {
    if (color) this.fill(list, color, o);
    this.loop(list, w, o);
  }
  ell(cu, cv, ru, rv, color, w = 0.9, o = {}) {
    const [ex, ey] = this.tr ? [rv * this.sx, ru * this.sy] : [ru * this.sx, rv * this.sy];
    const pts = ellPts(...this.P(cu, cv), ex, ey, o.rot || 0, o.n || 24);
    if (color) wash(this.ctx, pts, color, { ax: this.x, ay: this.y, ...o });
    if (w > 0) ribbon(this.ctx, pts, w * this.wk, { closed: true, seed: this.next(), ...o });
  }
  dot(u, v, r, color = C.ink) {
    const [x, y] = this.P(u, v);
    const pts = blobPts(x, y, r, r * 0.92, this.next(), 8, 0.1);
    wash(this.ctx, pts, color, { streak: 0, alpha: 0.96 });
  }
  // cross-hatching inside a closed outline: the codex way of writing "black"
  hatch(list, gap = 1.6, w = 0.45) {
    const pts = smoothClosed(this.map(list), 5);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const y0 = Math.min(...ys);
    const y1 = Math.max(...ys);
    const ctx = this.ctx;
    ctx.save();
    ctx.clip(pathOf(pts));
    const span = x1 - x0 + y1 - y0;
    // one direction close, the other wider and a little off the diagonal: done by hand
    for (let d = -span; d < span; d += gap) {
      ribbon(ctx, [[x0 + d, y0], [x0 + d + (y1 - y0) * 0.9, y1]], w, { seed: this.next(), wob: 0.12, vary: 0.5 });
    }
    for (let d = -span; d < span; d += gap * 1.45) {
      ribbon(ctx, [[x1 - d, y0], [x1 - d - (y1 - y0) * 1.15, y1]], w * 0.85, { seed: this.next(), wob: 0.12, vary: 0.5 });
    }
    ctx.restore();
  }
  rrect(u, v, w, h, r, color, lw = 0.9, o = {}) {
    const [px, py] = this.P(u, v);
    const [pw, ph] = this.tr ? [h * this.sx, w * this.sy] : [w * this.sx, h * this.sy];
    const pts = rrectPts(px, py, pw, ph, r * Math.min(this.sx, this.sy));
    if (color) wash(this.ctx, pts, color, { ax: this.x, ay: this.y, ...o });
    if (lw > 0) ribbon(this.ctx, pts, lw, { closed: true, seed: this.next(), ...o });
  }
}

// ===================================================================== glyph signs
// Invented sign parts in the codex manner, drawn in a unit box. A block
// combines a main sign with one or two affixes by a seeded shuffle.
const LW = 1.15;
const LW2 = 0.78;

function pickFill(r, p = 0.4) {
  const v = r();
  if (v > p) return null;
  const c = r();
  return c < 0.45 ? C.red : c < 0.8 ? C.blue : C.ochre;
}

const MAIN = [
  // profile head facing left
  (q, r) => {
    const f = pickFill(r, 0.35) || null;
    q.shape(
      [
        [0.55, 0.06], [0.85, 0.15], [0.96, 0.45], [0.88, 0.8], [0.6, 0.95], [0.32, 0.93], [0.2, 0.84], [0.17, 0.75],
        [0.2, 0.7], [0.12, 0.65], [0.16, 0.58], [0.04, 0.5], [0.13, 0.42], [0.3, 0.2],
      ],
      f,
      LW,
    );
    q.ell(0.36, 0.42, 0.1, 0.065, C.white, LW2);
    q.dot(0.33, 0.42, 0.035 * q.sx);
    q.ell(0.7, 0.56, 0.12, 0.12, r() < 0.5 ? C.blue : null, LW2);
    q.dot(0.7, 0.56, 0.035 * q.sx);
    q.line([[0.14, 0.7], [0.28, 0.72]], LW2);
    q.line([[0.3, 0.62], [0.36, 0.68], [0.32, 0.76]], LW2 * 0.8);
    q.shape([[0.2, 0.3], [0.5, 0.16], [0.9, 0.24], [0.88, 0.34], [0.5, 0.27], [0.24, 0.38]], r() < 0.5 ? C.ochre : C.white, LW2);
    if (r() < 0.6) for (let i = 0; i < 3; i += 1) q.dot(0.36 + i * 0.18, 0.13 - (i === 1 ? 0.02 : 0), 0.03 * q.sx);
    if (r() < 0.5) q.line([[0.5, 0.7], [0.56, 0.62], [0.62, 0.7]], LW2);
  },
  // cartouche with an inner sign, on a small pedestal
  (q, r) => {
    const f = pickFill(r, 0.3);
    q.rrect(0.08, 0.06, 0.84, 0.74, 0.22, f ? f : null, LW);
    // pedestal: three lobes
    q.shape([[0.2, 0.8], [0.8, 0.8], [0.78, 0.94], [0.62, 0.9], [0.5, 0.96], [0.38, 0.9], [0.22, 0.94]], r() < 0.6 ? C.red : null, LW2);
    INNER[Math.floor(r() * INNER.length)](q, r);
  },
  // a dark-faced head: hatched face, white eye and mouth
  (q, r) => {
    const face = [[0.5, 0.08], [0.84, 0.18], [0.95, 0.48], [0.86, 0.82], [0.56, 0.95], [0.3, 0.9], [0.14, 0.72], [0.06, 0.5], [0.16, 0.26]];
    q.hatch(face, 0.13 * q.sx, 0.38);
    q.ell(0.38, 0.42, 0.13, 0.1, C.white, LW2);
    q.dot(0.35, 0.42, 0.04 * q.sx);
    q.shape([[0.2, 0.66], [0.42, 0.62], [0.46, 0.72], [0.24, 0.76]], C.white, LW2);
    q.loop(face, LW);
    q.ell(0.74, 0.5, 0.1, 0.12, r() < 0.5 ? C.red : C.white, LW2);
  },
  // a great volute
  (q, r) => {
    const s = spiralPts(0.5, 0.52, 0.42, 1.25, Math.PI * 0.9, 1);
    q.line(s, LW * 1.15);
    q.line([[0.12, 0.88], [0.5, 0.94], [0.9, 0.86]], LW2);
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i += 1) q.dot(0.22 + i * 0.16, 0.18 + 0.04 * (i % 2), 0.035 * q.sx);
    if (r() < 0.5) q.ell(0.82, 0.24, 0.08, 0.08, C.red, LW2);
  },
  // bird head with a hooked beak
  (q, r) => {
    q.shape([[0.94, 0.4], [0.82, 0.14], [0.56, 0.08], [0.36, 0.2], [0.24, 0.3], [0.06, 0.42], [0.1, 0.5], [0.3, 0.5], [0.36, 0.62], [0.5, 0.86], [0.82, 0.88]], pickFill(r, 0.3), LW);
    q.line([[0.06, 0.42], [0.1, 0.56], [0.18, 0.56]], LW2);
    q.ell(0.5, 0.32, 0.09, 0.09, C.white, LW2);
    q.dot(0.48, 0.32, 0.04 * q.sx);
    q.line([[0.6, 0.12], [0.66, 0.0], [0.78, 0.04]], LW2);
    q.line([[0.62, 0.55], [0.86, 0.6]], LW2);
    q.line([[0.6, 0.7], [0.84, 0.74]], LW2);
  },
  // a round face with a large socket and teeth
  (q, r) => {
    q.shape([[0.5, 0.06], [0.84, 0.18], [0.94, 0.48], [0.84, 0.74], [0.7, 0.92], [0.34, 0.92], [0.16, 0.74], [0.06, 0.48], [0.16, 0.18]], pickFill(r, 0.2), LW);
    q.ell(0.38, 0.4, 0.15, 0.14, C.white, LW2);
    q.dot(0.38, 0.42, 0.06 * q.sx);
    q.line([[0.28, 0.72], [0.72, 0.72]], LW2);
    for (let i = 0; i < 4; i += 1) q.line([[0.32 + i * 0.11, 0.72], [0.32 + i * 0.11, 0.84]], LW2);
    q.dot(0.72, 0.36, 0.03 * q.sx);
    q.dot(0.66, 0.5, 0.03 * q.sx);
  },
  // spotted cartouche
  (q, r) => {
    q.ell(0.5, 0.48, 0.42, 0.4, r() < 0.5 ? C.ochre : null, LW);
    for (let i = 0; i < 5; i += 1) {
      const a = i * 1.3 + r();
      q.ell(0.5 + Math.cos(a) * 0.22, 0.48 + Math.sin(a) * 0.2, 0.07, 0.06, null, LW2);
      q.dot(0.5 + Math.cos(a) * 0.22, 0.48 + Math.sin(a) * 0.2, 0.025 * q.sx);
    }
    q.line([[0.2, 0.94], [0.8, 0.94]], LW2);
  },
  // a cartouche half filled with hatching, with paired curls
  (q, r) => {
    q.rrect(0.1, 0.08, 0.8, 0.78, 0.24, null, 0);
    q.hatch([[0.14, 0.12], [0.86, 0.12], [0.86, 0.46], [0.14, 0.46]], 0.12 * q.sx, 0.36);
    q.line([[0.12, 0.47], [0.88, 0.47]], LW2);
    q.line(spiralPts(0.34, 0.66, 0.13, 0.8, Math.PI, 1, 12), LW2);
    q.line(spiralPts(0.66, 0.66, 0.13, 0.8, 0, -1, 12), LW2);
    q.rrect(0.1, 0.08, 0.8, 0.78, 0.24, null, LW);
    for (let i = 0; i < 3; i += 1) q.dot(0.3 + i * 0.2, 0.94, 0.03 * q.sx, i === 1 && r() < 0.5 ? C.red : C.ink);
  },
];

const INNER = [
  // quatrefoil
  (q) => {
    for (let i = 0; i < 4; i += 1) {
      const a = (i * Math.PI) / 2;
      q.ell(0.5 + Math.cos(a) * 0.14, 0.43 + Math.sin(a) * 0.13, 0.11, 0.08, null, LW2, { rot: a });
    }
    q.dot(0.5, 0.43, 0.035 * q.sx);
  },
  // T opening
  (q) => {
    q.loop([[0.3, 0.26], [0.7, 0.26], [0.7, 0.38], [0.57, 0.38], [0.57, 0.62], [0.43, 0.62], [0.43, 0.38], [0.3, 0.38]], LW2, { sharp: true });
  },
  // three dots over a bar
  (q) => {
    for (let i = 0; i < 3; i += 1) q.dot(0.32 + i * 0.18, 0.32, 0.045 * q.sx);
    q.line([[0.26, 0.54], [0.74, 0.54]], LW);
  },
  // spiral
  (q) => {
    q.line(spiralPts(0.5, 0.44, 0.24, 1.1, 0, -1), LW2);
  },
  // crossed bands
  (q) => {
    q.line([[0.3, 0.22], [0.7, 0.64]], LW);
    q.line([[0.7, 0.22], [0.3, 0.64]], LW);
    q.dot(0.5, 0.18, 0.025 * q.sx);
    q.dot(0.5, 0.68, 0.025 * q.sx);
  },
  // comb
  (q) => {
    q.line([[0.26, 0.6], [0.36, 0.3], [0.64, 0.3], [0.74, 0.6]], LW2);
    for (let i = 0; i < 4; i += 1) q.line([[0.36 + i * 0.09, 0.36], [0.36 + i * 0.09, 0.6]], LW2);
  },
  // closed eye with lashes
  (q) => {
    q.line([[0.26, 0.42], [0.5, 0.56], [0.74, 0.42]], LW);
    q.line([[0.3, 0.36], [0.5, 0.28], [0.7, 0.36]], LW2);
    for (let i = 0; i < 3; i += 1) q.dot(0.38 + i * 0.12, 0.66, 0.025 * q.sx);
  },
  // four circles
  (q) => {
    for (let i = 0; i < 4; i += 1) q.ell(0.38 + (i % 2) * 0.24, 0.32 + Math.floor(i / 2) * 0.22, 0.08, 0.08, i === 1 ? C.red : null, LW2);
  },
  // water lines
  (q) => {
    for (let i = 0; i < 3; i += 1) q.line([[0.3 + i * 0.14, 0.22], [0.36 + i * 0.14, 0.38], [0.3 + i * 0.14, 0.52], [0.36 + i * 0.14, 0.64]], LW2);
  },
];

// affixes in a local box: drawn horizontally in (0..1, 0..1); `vert` turns them for a prefix
const AFFIX = [
  // oval with three dots
  (q, r) => {
    q.ell(0.5, 0.5, 0.46, 0.38, pickFill(r, 0.35), LW2);
    for (let i = 0; i < 3; i += 1) q.dot(0.28 + i * 0.22, 0.5, 0.06 * Math.min(q.sx, q.sy));
  },
  // bracket with circles
  (q) => {
    q.line([[0.06, 0.2], [0.06, 0.8], [0.94, 0.8], [0.94, 0.2]], LW2, { sharp: true });
    for (let i = 0; i < 3; i += 1) q.ell(0.24 + i * 0.26, 0.48, 0.09, 0.22, null, LW2);
  },
  // scroll
  (q) => {
    q.line([[0.04, 0.8], [0.4, 0.8], [0.7, 0.66], [0.8, 0.36], [0.62, 0.2], [0.48, 0.34], [0.58, 0.5]], LW);
  },
  // comb
  (q) => {
    q.shape([[0.06, 0.86], [0.1, 0.2], [0.9, 0.2], [0.94, 0.86]], pickFill(r0, 0.3), LW2, { sharp: true });
    for (let i = 1; i < 5; i += 1) q.line([[0.06 + i * 0.176, 0.2], [0.06 + i * 0.176, 0.86]], LW2 * 0.8);
  },
  // a knot: loop with two tails
  (q, r) => {
    q.ell(0.5, 0.42, 0.2, 0.3, r() < 0.6 ? C.red : null, LW2);
    q.line([[0.38, 0.62], [0.2, 0.9], [0.08, 0.84]], LW2);
    q.line([[0.62, 0.62], [0.8, 0.9], [0.92, 0.84]], LW2);
  },
  // little cartouche
  (q, r) => {
    q.rrect(0.14, 0.08, 0.72, 0.84, 0.3, r() < 0.5 ? C.red : C.blue, LW2);
    q.dot(0.5, 0.5, 0.08 * Math.min(q.sx, q.sy), C.ink);
  },
  // feather
  (q, r) => {
    q.shape([[0.04, 0.5], [0.4, 0.14], [0.96, 0.3], [0.96, 0.7], [0.4, 0.86]], r() < 0.5 ? C.blue : null, LW2);
    q.line([[0.1, 0.5], [0.9, 0.5]], LW2 * 0.8);
  },
  // a hatched half-moon with a rim of dots
  (q) => {
    const m = [[0.06, 0.8], [0.2, 0.3], [0.5, 0.14], [0.8, 0.3], [0.94, 0.8]];
    q.hatch(m, 0.12 * Math.max(q.sx, q.sy), 0.32);
    q.loop(m, LW2);
    for (let i = 0; i < 4; i += 1) q.dot(0.2 + i * 0.2, 0.92, 0.05 * Math.min(q.sx, q.sy));
  },
];
let r0 = rng(1); // used by affixes that pick a fill

// an affix box: affixes are drawn lying down, so a tall box turns them upright
function affixQ(ctx, x, y, w, h, seed) {
  if (h > w * 1.4) {
    const q = new Q(ctx, x, y, w, h, seed);
    q.tr = true;
    return q;
  }
  return new Q(ctx, x, y, w, h, seed);
}

function glyphBlock(ctx, x, y, s, seed) {
  const r = rng(seed * 7919 + 13);
  r0 = r;
  const layout = r();
  const main = MAIN[Math.floor(r() * MAIN.length)];
  const affA = AFFIX[Math.floor(r() * AFFIX.length)];
  const affB = AFFIX[Math.floor(r() * AFFIX.length)];
  const g = 0.04 * s;
  if (layout < 0.18) {
    main(new Q(ctx, x, y, s, s, seed), r);
  } else if (layout < 0.5) {
    // prefix on the left (drawn upright in a narrow box)
    affA(affixQ(ctx, x, y + s * 0.08, s * 0.26, s * 0.84, seed + 1), r);
    main(new Q(ctx, x + s * 0.28 + g, y, s * 0.72 - g, s, seed + 2), r);
  } else if (layout < 0.8) {
    affA(new Q(ctx, x + s * 0.08, y, s * 0.84, s * 0.26, seed + 1), r);
    main(new Q(ctx, x, y + s * 0.28 + g, s, s * 0.72 - g, seed + 2), r);
  } else {
    affA(affixQ(ctx, x, y + s * 0.3, s * 0.26, s * 0.66, seed + 1), r);
    affB(new Q(ctx, x + s * 0.3, y, s * 0.66, s * 0.26, seed + 3), r);
    main(new Q(ctx, x + s * 0.28 + g, y + s * 0.28 + g, s * 0.72 - g, s * 0.72 - g, seed + 2), r);
  }
}

// ===================================================================== the page
function redLine(ctx, x0, y0, x1, y1, w, seed, alpha = 0.92) {
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 6));
  const pts = [];
  for (let i = 0; i <= n; i += 1) pts.push([lerp(x0, x1, i / n), lerp(y0, y1, i / n)]);
  ribbon(ctx, pts, w, { seed, color: C.red, alpha, wob: 0.18, vary: 0.4 });
}

function pageCentres() {
  const out = [];
  for (let k = -1; k <= 7; k += 1) out.push({ k, c: k * PAGE });
  return out;
}

function paintRules(ctx) {
  for (const { k, c } of pageCentres()) {
    const a = c - 80;
    const b = c + 80;
    const s = 900 + k * 37;
    redLine(ctx, a, R.textTop, b, R.textTop, 0.9, s + 1);
    // the heavy rule under the text, the figure's base line, the lower register
    wash(ctx, wobRect(a, R.ruleA, b - a, R.ruleB - R.ruleA, s + 2), C.red, { alpha: 0.93, angle: 0 });
    wash(ctx, wobRect(a, R.base, b - a, R.baseB - R.base, s + 3), C.red, { alpha: 0.93, angle: 0 });
    redLine(ctx, a, R.sky, b, R.sky, 0.8, s + 4);
    redLine(ctx, a, R.lowTop, b, R.lowTop, 0.9, s + 5);
    redLine(ctx, a, R.lowBot, b, R.lowBot, 0.9, s + 6);
    // the page border
    redLine(ctx, a, R.textTop - 1, a, R.lowBot + 1, 0.9, s + 7);
    redLine(ctx, b, R.textTop - 1, b, R.lowBot + 1, 0.9, s + 8);
    redLine(ctx, a, 441, b, 441, 0.8, s + 9, 0.75);
  }
}

function wobRect(x, y, w, h, seed) {
  const pts = [];
  const n = Math.max(2, Math.round(w / 8));
  for (let i = 0; i <= n; i += 1) pts.push([x + (w * i) / n, y + (hash(seed, i) - 0.5) * 0.5]);
  for (let i = n; i >= 0; i -= 1) pts.push([x + (w * i) / n, y + h + (hash(seed, i, 2) - 0.5) * 0.6]);
  return pts;
}

function paintWashes(ctx) {
  for (const { k, c } of pageCentres()) {
    const m = ((k % 4) + 4) % 4;
    if (m === 1 || m === 3) {
      const col = m === 1 ? C.red : C.blue;
      const pts = wobRect(c - 79.5, R.ruleB, 159, R.base - R.ruleB, 300 + k);
      wash(ctx, pts, col, { alpha: m === 1 ? 0.72 : 0.66, angle: -3 + k, streak: 1.8 });
      // the colour has rubbed thin in places: knock it back with soft blotches
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      const rr = rng(4400 + k);
      for (let i = 0; i < 260; i += 1) {
        const bx = c - 78 + rr() * 156;
        const by = R.ruleB + 1 + rr() * (R.base - R.ruleB - 2);
        ctx.globalAlpha = 0.05 + rr() * 0.16;
        ctx.fill(pathOf(ellPts(bx, by, 1.5 + rr() * 7, 0.4 + rr() * 1.6, (rr() - 0.5) * 0.12, 10)));
      }
      ctx.restore();
    }
  }
}

// the sky band: crossed signs and stars in compartments
function paintSky(ctx) {
  for (const { k, c } of pageCentres()) {
    const a = c - 80;
    const n = 8;
    const w = 160 / n;
    for (let i = 0; i < n; i += 1) {
      const x = a + i * w;
      if (i > 0) redLine(ctx, x, R.ruleB, x, R.sky, 0.7, 4000 + k * 10 + i);
      const q = new Q(ctx, x, R.ruleB, w, R.sky - R.ruleB, 5000 + k * 10 + i);
      const kind = Math.floor(hash(k + 20, i, 5) * 5);
      if (kind === 0) {
        q.line([[0.25, 0.15], [0.75, 0.85]], 0.7);
        q.line([[0.75, 0.15], [0.25, 0.85]], 0.7);
      } else if (kind === 1) {
        q.ell(0.5, 0.5, 0.14, 0.3, C.ochre, 0.6);
        q.dot(0.2, 0.5, 0.5);
        q.dot(0.8, 0.5, 0.5);
      } else if (kind === 2) {
        q.fill([[0.08, 0.15], [0.92, 0.15], [0.92, 0.85], [0.08, 0.85]], C.blue, { sharp: true, alpha: 0.75 });
        q.line([[0.2, 0.5], [0.8, 0.5]], 0.6);
      } else if (kind === 3) {
        q.line([[0.15, 0.75], [0.35, 0.25], [0.5, 0.7], [0.65, 0.25], [0.85, 0.75]], 0.6);
      } else {
        q.ell(0.5, 0.5, 0.2, 0.32, C.red, 0.6);
        q.dot(0.5, 0.5, 0.45);
      }
    }
  }
}

// the faint red ruled boxes where the numbers go
function paintNumberBoxes(ctx) {
  for (const { k, c } of pageCentres()) {
    const s = 6000 + k * 5;
    redLine(ctx, c - 23, 480, c + 23, 480, 0.55, s, 0.55);
    redLine(ctx, c - 23, 553, c + 23, 553, 0.55, s + 1, 0.55);
    redLine(ctx, c - 23, 480, c - 23, 553, 0.55, s + 2, 0.55);
    redLine(ctx, c + 23, 480, c + 23, 553, 0.55, s + 3, 0.55);
    redLine(ctx, c - 23, 507.5, c + 23, 507.5, 0.45, s + 4, 0.4);
  }
}

function paintGlyphs(ctx) {
  for (const { k, c } of pageCentres()) {
    // the text register: two columns each side of the number, three rows
    const cols = [c - 78, c - 51, c + 27, c + 54];
    for (let ci = 0; ci < 4; ci += 1) {
      for (let ri = 0; ri < 3; ri += 1) {
        glyphBlock(ctx, cols[ci], 479.5 + ri * 25.5, 23.5, 100 + (k + 2) * 40 + ci * 5 + ri);
      }
    }
    // the top row, except where the title runs
    for (let i = 0; i < 6; i += 1) {
      const x = c - 77 + i * 26;
      if (x + 22 > TITLE.x0 - 4 && x < TITLE.x1 + 4) continue;
      glyphBlock(ctx, x, 446, 22, 3000 + (k + 2) * 20 + i);
    }
  }
}

// ---------------------------------------------------------------- the title strip
const ZH_FONT = "'Weibei SC', 'Heiti SC', 'STHeiti', 'PingFang SC', sans-serif";
const EN_FONT = "'Optima', 'Gill Sans', sans-serif";
const DATE_FONT = "'Yuanti SC', 'Heiti SC', 'PingFang SC', sans-serif";

function paintTitle(ctx) {
  const s = 25;
  const gap = 2;
  const x0 = TITLE.x0;
  const y0 = 445;
  for (let i = 0; i < 5; i += 1) {
    const x = x0 + i * (s + gap);
    const q = new Q(ctx, x, y0, s, s, 700 + i);
    q.rrect(0, 0, 1, 1, 0.24, C.white, 1.3);
    q.rrect(0.08, 0.08, 0.84, 0.84, 0.2, null, 0.45, { color: C.red, alpha: 0.8 });
    ctx.save();
    ctx.font = `700 19px ${ZH_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = C.ink;
    ctx.fillText(META.zh[i], x + s / 2 + 0.2, y0 + s / 2 + 1.0);
    ctx.globalAlpha = 0.5;
    ctx.fillText(META.zh[i], x + s / 2 - 0.15, y0 + s / 2 + 0.8);
    ctx.restore();
  }
  // the two lines on the next page
  const tx = 257;
  const maxW = TITLE.x1 - tx;
  const line = (text, y, family, size, color, weight) => {
    ctx.save();
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = color;
    const w = ctx.measureText(text).width;
    const sx = w > maxW ? maxW / w : 1;
    ctx.translate(tx, y);
    ctx.scale(sx, 1);
    ctx.fillText(text, 0, 0);
    ctx.globalAlpha = 0.45;
    ctx.fillText(text, 0.18, -0.12);
    ctx.restore();
  };
  line(META.en.toUpperCase(), 457.5, EN_FONT, 13.5, C.ink, 400);
  line(`${META.date} · ${META.dateEn}`, 471.5, DATE_FONT, 12, C.red, 700);
}

// ---------------------------------------------------------------- the vignettes
// Each is drawn in a 120 x 66 box whose top-left is (c - 60, 712).
const VIGNETTES = {
  offering(q) {
    // folded legs, loincloth, torso, head in profile facing right
    q.shape([[16, 64], [14, 56], [22, 49], [44, 48], [58, 52], [61, 59], [52, 64]], C.skin, 1.1);
    q.shape([[30, 47], [45, 46], [47, 56], [39, 59], [32, 54]], C.white, 1.0);
    q.shape([[25, 48], [23, 37], [27, 27], [40, 25], [46, 31], [44, 41], [44, 48]], C.skin, 1.1);
    q.shape([[29, 25], [27, 15], [33, 8], [44, 7], [50, 11], [52, 15], [57, 18], [53, 20], [54, 23], [51, 24], [49, 27], [43, 29], [35, 29]], C.skin, 1.1);
    q.ell(46, 14.5, 3.0, 1.9, C.white, 0.7);
    q.dot(47, 14.5, 0.9);
    q.ell(37, 18, 3.1, 3.1, C.blue, 0.8);
    q.dot(37, 18, 1.0);
    q.line([[49, 25], [52, 24.5]], 0.6);
    // headdress band and plumes sweeping back
    q.shape([[28, 9], [50, 7], [50, 11], [28, 13]], C.red, 0.8);
    for (let i = 0; i < 4; i += 1) q.dot(32 + i * 5, 10, 0.7, C.white);
    q.shape([[30, 8], [20, 2], [8, 3], [3, 9], [9, 8], [18, 9], [26, 12]], C.blue, 0.9);
    q.shape([[29, 11], [18, 11], [7, 17], [5, 23], [12, 18], [22, 15], [28, 14]], C.ochre, 0.9);
    q.line(spiralPts(6.5, 11.5, 3.2, 0.9, Math.PI, 1), 0.7);
    // necklace
    for (let i = 0; i < 5; i += 1) q.ell(30 + i * 3.6, 29 + Math.sin((i / 4) * Math.PI) * 1.8, 1.5, 1.5, i % 2 ? C.red : C.blue, 0.5);
    // the arm held out with the fish
    q.shape([[40, 31], [53, 32], [64, 30], [67, 33], [64, 36], [53, 37], [42, 38]], C.skin, 1.0);
    q.shape([[64, 30], [72, 24], [86, 23], [96, 28], [104, 21], [107, 23], [103, 30], [107, 37], [104, 39], [96, 33], [86, 37], [72, 36]], C.blue, 1.1);
    q.ell(71, 28.5, 1.6, 1.6, C.white, 0.6);
    q.dot(71, 28.5, 0.6);
    q.line([[76, 25], [78, 30], [76, 35]], 0.8, { color: C.red });
    for (let i = 0; i < 3; i += 1) q.line([[81 + i * 4.5, 28], [83 + i * 4.5, 30], [81 + i * 4.5, 32]], 0.55);
    q.line([[86, 23], [90, 18], [94, 25]], 0.7);
    q.line([[64, 33], [68, 34]], 0.6);
    // offering bowl beneath
    q.shape([[70, 56], [94, 56], [90, 64], [74, 64]], C.red, 1.0, { sharp: true });
    for (let i = 0; i < 4; i += 1) q.dot(76 + i * 4, 60, 0.6, C.white);
    q.ell(82, 53, 8, 2.6, C.ochre, 0.8);
  },
  rabbit(q) {
    // ears swept back, the long crouched body, the head
    q.shape([[50, 23], [40, 13], [30, 7], [27, 10], [37, 18], [47, 27]], C.white, 0.9);
    q.line([[45, 22], [33, 11]], 0.6, { color: C.red });
    q.shape([[16, 63], [12, 54], [16, 44], [28, 37], [44, 35], [54, 40], [58, 50], [56, 60], [50, 63]], C.white, 1.1);
    q.shape([[53, 22], [46, 10], [40, 3], [37, 6], [43, 15], [50, 25]], C.white, 0.9);
    q.line([[50, 20], [42, 8]], 0.6, { color: C.red });
    q.line([[22, 62], [27, 49], [39, 46], [46, 54], [45, 63]], 0.8);
    q.shape([[46, 37], [44, 28], [50, 21], [60, 21], [67, 25], [70, 30], [65, 34], [54, 38]], C.white, 1.1);
    q.ell(57, 27, 2.7, 2.7, C.red, 0.6);
    q.ell(57, 27, 1.7, 1.7, C.white, 0);
    q.dot(57.6, 27, 0.9);
    q.line(spiralPts(56, 32.5, 2.0, 0.8, -Math.PI / 2, -1, 10), 0.5);
    q.dot(69.5, 28.5, 0.8);
    q.line([[64, 33], [69, 33.5]], 0.5);
    for (let i = 0; i < 4; i += 1) q.ell(46 + i * 2.6, 37.5 + i * 0.9, 1.3, 1.3, i % 2 ? C.red : C.blue, 0.45);
    for (const [x, y] of [[22, 48], [30, 42], [38, 40], [28, 55], [50, 47]]) {
      q.ell(x, y, 1.7, 1.5, C.ochre, 0.5);
      q.dot(x, y, 0.5);
    }
    q.shape([[14, 50], [7, 47], [5, 53], [12, 57]], C.white, 0.8);
    // forepaw with the brush
    q.shape([[51, 45], [62, 43], [67, 46], [62, 50], [52, 51]], C.white, 0.9);
    q.line([[63, 46], [75, 29]], 1.1);
    q.ell(76.2, 27.4, 1.5, 2.6, C.red, 0.6, { rot: 0.62 });
    // the jar of brushes
    q.shape([[80, 64], [78, 53], [82, 46], [80, 41], [100, 41], [98, 46], [102, 53], [100, 64]], C.red, 1.1);
    q.fill([[79, 49], [101, 49], [101, 55], [79, 55]], C.white, { sharp: true, alpha: 0.9 });
    q.line([[79, 49], [101, 49]], 0.6);
    q.line([[79, 55], [101, 55]], 0.6);
    for (let i = 0; i < 5; i += 1) q.dot(82.5 + i * 3.8, 52, 0.75);
    q.line([[84, 41], [80, 27]], 0.8);
    q.line([[90, 41], [91, 25]], 0.8);
    q.line([[95, 41], [100, 29]], 0.8);
    q.ell(79.6, 26, 1.0, 1.8, C.ink, 0, { rot: 0.3 });
    q.ell(91, 24, 1.0, 1.8, C.ink, 0);
    q.ell(100.4, 28, 1.0, 1.8, C.ink, 0, { rot: -0.4 });
  },
  turtle(q) {
    q.shape([[24, 52], [28, 37], [44, 27], [64, 25], [82, 30], [92, 43], [94, 52]], C.blue, 1.2);
    q.line([[32, 51], [36, 40], [50, 33], [66, 32], [80, 37], [86, 51]], 0.7);
    for (let i = 0; i < 4; i += 1) q.line([[42 + i * 12, 34 - (i === 1 || i === 2 ? 2 : 0)], [40 + i * 12.5, 51]], 0.7);
    for (let i = 0; i < 5; i += 1) q.dot(36 + i * 11.5, 45, 1.1);
    for (let i = 0; i < 4; i += 1) q.ell(46 + i * 12, 29.5 + (i === 0 || i === 3 ? 1.5 : 0), 1.4, 1.4, C.ochre, 0.5);
    q.shape([[21, 52], [97, 52], [97, 57], [21, 57]], C.red, 1.0, { sharp: true });
    for (let i = 0; i < 8; i += 1) q.dot(27 + i * 9.5, 54.5, 0.75, C.white);
    q.shape([[92, 47], [99, 41], [109, 40], [115, 44], [112, 49], [101, 52]], C.ochre, 1.1);
    q.ell(107, 43.5, 1.6, 1.6, C.white, 0.6);
    q.dot(107.4, 43.5, 0.7);
    q.line([[110, 47.5], [114, 46.5]], 0.6);
    q.shape([[84, 57], [89, 64], [96, 64], [92, 57]], C.ochre, 0.9);
    q.shape([[30, 57], [24, 64], [32, 64], [37, 57]], C.ochre, 0.9);
    q.shape([[22, 53], [12, 57], [21, 56]], C.ochre, 0.8);
  },
  water(q) {
    // a band of water with wave lines and shells
    const top = [];
    for (let i = 0; i <= 12; i += 1) top.push([6 + i * 9, 42 + Math.sin(i * 1.3) * 1.2]);
    q.fill([...top, [114, 64], [6, 64]], C.blue, { sharp: true, alpha: 0.85 });
    q.line(top, 0.9);
    for (let j = 0; j < 2; j += 1) {
      const pts = [];
      for (let i = 0; i <= 24; i += 1) pts.push([6 + i * 4.5, 50 + j * 7 + Math.sin(i * 1.1 + j) * 1.3]);
      q.line(pts, 0.6);
    }
    for (let i = 0; i < 6; i += 1) q.ell(14 + i * 18, 60.5, 2.0, 1.5, C.white, 0.5);
    // the lily: stem, pad and flower
    q.line([[40, 44], [36, 32], [42, 20], [46, 16]], 1.0);
    q.shape([[52, 42], [64, 37], [76, 39], [80, 42]], C.ochre, 0.9);
    q.shape([[46, 17], [38, 10], [40, 3], [46, 9], [50, 2], [54, 9], [60, 3], [62, 10], [54, 17]], C.white, 1.0);
    q.shape([[44, 15], [56, 15], [55, 19], [45, 19]], C.red, 0.8);
    q.line([[46, 9], [48, 15]], 0.5);
    q.line([[54, 9], [52, 15]], 0.5);
    // a fish leaping toward the flower
    q.shape([[70, 30], [78, 23], [90, 22], [98, 27], [106, 22], [108, 25], [103, 30], [107, 36], [104, 37], [97, 33], [88, 36], [77, 35]], C.white, 1.0);
    q.ell(76, 27.5, 1.4, 1.4, C.white, 0.5);
    q.dot(76, 27.5, 0.6);
    q.line([[81, 24], [83, 29], [81, 34]], 0.7, { color: C.red });
    for (let i = 0; i < 3; i += 1) q.line([[86 + i * 4, 27], [88 + i * 4, 29], [86 + i * 4, 31]], 0.5);
    for (let i = 0; i < 3; i += 1) q.dot(66 - i * 4, 34 + i * 3, 0.6);
  },
  dog(q) {
    // far legs, body, near legs, head with an open jaw
    q.shape([[36, 42], [33, 52], [30, 62], [35, 63], [38, 52], [41, 42]], "#e9dfcb", 0.9);
    q.shape([[74, 41], [77, 52], [76, 62], [81, 63], [81, 51], [80, 40]], "#e9dfcb", 0.9);
    q.shape([[26, 32], [40, 29], [60, 31], [78, 28], [86, 32], [84, 40], [72, 43], [56, 41], [40, 44], [28, 42], [22, 37]], C.white, 1.1);
    q.shape([[28, 41], [25, 52], [22, 62], [28, 63], [31, 52], [35, 43]], C.white, 0.9);
    q.shape([[69, 42], [68, 52], [66, 62], [72, 63], [73, 51], [76, 41]], C.white, 0.9);
    for (const [x, y] of [[22, 63], [28, 63], [66, 63], [72, 63]]) q.line([[x, y], [x + 1.5, y - 2]], 0.5);
    q.line([[44, 32], [46, 40]], 0.55);
    q.line([[49, 32], [51, 40]], 0.55);
    q.line([[54, 33], [56, 40]], 0.55);
    q.shape([[80, 31], [84, 21], [92, 16], [100, 18], [113, 22], [114, 26], [102, 27], [110, 30], [108, 33], [98, 31], [90, 35]], C.white, 1.1);
    q.shape([[89, 19], [85, 6], [96, 16]], C.ink, 0.8);
    for (let i = 0; i < 3; i += 1) q.line([[104 + i * 3, 27], [105 + i * 3, 29.3]], 0.45);
    q.ell(96, 21.5, 2.3, 2.3, C.red, 0.55);
    q.ell(96, 21.5, 1.45, 1.45, C.white, 0);
    q.dot(96.5, 21.5, 0.8);
    q.dot(113, 23.5, 0.8);
    // spots
    const spots = [[38, 34, 4, 3], [55, 37, 3.5, 2.8], [65, 32, 3, 2.5], [29, 37, 2.2, 2], [76, 35, 2, 1.8]];
    for (const [x, y, rx, ry] of spots) q.fill(blobPts(x, y, rx, ry, x * 3 + y, 9, 0.18), C.ink, { streak: 0 });
    // collar with dots and the curled tail
    q.shape([[82, 26], [86, 24], [92, 34], [88, 36]], C.red, 0.7);
    for (let i = 0; i < 3; i += 1) q.dot(84.5 + i * 2.2, 27 + i * 3.2, 0.55, C.white);
    q.line([[24, 33], [17, 25], [16, 16], [21, 12], [25, 16], [21, 19]], 1.4);
  },
};

const VIG_ORDER = ["water", "dog", "offering", "rabbit", "turtle", "water", "dog", "offering", "turtle"]; // k = -1 .. 7

function paintVignettes(ctx) {
  for (const { k, c } of pageCentres()) {
    const name = VIG_ORDER[k + 1];
    const q = new Q(ctx, c - 60, 712, 1, 1, 8000 + (k + 2) * 50, 1.3);
    VIGNETTES[name](q);
    // a small caption of two glyph blocks
    const capX = name === "turtle" || name === "dog" ? c - 76 : c + 47;
    glyphBlock(ctx, capX, 714, 14.5, 9000 + (k + 2) * 7);
    glyphBlock(ctx, capX + 15.5, 714, 14.5, 9001 + (k + 2) * 7);
  }
}

// ---------------------------------------------------------------- the page bake
function bakePage(stage) {
  const k = BOOK_PX * stage.s;
  const W = (BOOK.x1 - BOOK.x0) * k;
  const H = (BOOK.y1 - BOOK.y0) * k;
  return stage.bake(`maya/page/${k.toFixed(3)}`, W, H, () => {
    const view = new View(k, -BOOK.x0 * k, -BOOK.y0 * k);
    shaderPass(stage, view, GROUND_FRAG, "maya/ground");
    makeTile(stage);
    const layer = new Layer2D(stage.p, W, H);
    const ctx = layer.ctx;
    ctx.setTransform(k, 0, 0, k, -BOOK.x0 * k, -BOOK.y0 * k);
    paintWashes(ctx);
    paintSky(ctx);
    paintRules(ctx);
    paintNumberBoxes(ctx);
    paintGlyphs(ctx);
    paintTitle(ctx);
    paintVignettes(ctx);
    layer.touch();
    stage.origin();
    stage.image(layer, 0, 0, layer.w, layer.h);
    const textures = stage.p._renderer && stage.p._renderer.textures;
    if (textures && typeof textures.get === "function") {
      const tex = textures.get(layer.img);
      if (tex && typeof tex.remove === "function") tex.remove();
      textures.delete(layer.img);
    }
  });
}

function bakeWear(stage) {
  const k = BOOK_PX * stage.s;
  return stage.bake(`maya/wear/${k.toFixed(3)}`, (BOOK.x1 - BOOK.x0) * k, (BOOK.y1 - BOOK.y0) * k, () => {
    shaderPass(stage, new View(k, -BOOK.x0 * k, -BOOK.y0 * k), WEAR_FRAG, "maya/wear");
  });
}

// ===================================================================== the numbers
// The count on page k is 37 + k: twenties above, units below. Each element
// has a start time after the page's beat (u = k) and is painted in quickly.
const TALLY_Y = { tw: 494.5, dots0: 530, barBase: 545 };

function countPlan(k) {
  const n = 37 + k;
  const tw = Math.floor(n / 20);
  const un = n % 20;
  const c = k * PAGE;
  const els = [];
  let t = 0;
  if (un === 0) {
    els.push({ kind: "shell", t0: 0, dur: 0.15, x: c, y: 530 });
    t = 0.13;
  } else {
    const bars = Math.floor(un / 5);
    const dots = un % 5;
    for (let i = 0; i < bars; i += 1) {
      els.push({ kind: "bar", t0: t, dur: 0.08, x: c, y: TALLY_Y.barBase - i * 9 });
      t += 0.08;
    }
    const dy = bars ? TALLY_Y.barBase - bars * 9 + 0.5 : TALLY_Y.dots0;
    for (let j = 0; j < dots; j += 1) {
      els.push({ kind: "dot", t0: t + j * 0.06, dur: 0.04, x: c + (j - (dots - 1) / 2) * 9, y: dy });
    }
    t += dots * 0.06;
  }
  t += 0.04;
  for (let j = 0; j < tw; j += 1) {
    // the twenties place follows at once
    els.push({ kind: "dot", t0: t + j * 0.06, dur: 0.04, x: c + (j - (tw - 1) / 2) * 9.5, y: TALLY_Y.tw });
  }
  els.forEach((e, i) => {
    e.jx = (hash(k + 50, i, 1) - 0.5) * 1.0;
    e.jy = (hash(k + 50, i, 2) - 0.5) * 0.9;
    e.seed = 7000 + k * 31 + i;
  });
  return els;
}
const PLANS = new Map();
const planFor = (k) => {
  if (!PLANS.has(k)) PLANS.set(k, countPlan(k));
  return PLANS.get(k);
};

function mixHex(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(",")})`;
}

function drawShell(ctx, e, p, fresh) {
  const cx = e.x + e.jx;
  const cy = e.y + e.jy;
  const rx = 19;
  const ry = 11.5;
  const outline = [];
  // from the hinge on the left, over the top to the pointed far end and back underneath
  for (let i = 0; i <= 44; i += 1) {
    const a = Math.PI + (i / 44) * Math.PI * 2;
    const ca = Math.cos(a);
    const yr = ry * (1 - 0.32 * Math.max(0, ca) ** 2) * (ca < 0 ? 0.94 : 1);
    outline.push([cx + ca * rx, cy + Math.sin(a) * yr]);
  }
  const red = mixHex("#7a1c0e", C.red, 1 - fresh);
  const pOut = clamp(0.35 + p / 0.45);
  const pFill = clamp((p - 0.3) / 0.3);
  const pRibs = clamp((p - 0.45) / 0.55);
  if (pFill > 0) wash(ctx, outline, C.white, { alpha: 0.98 * pFill, angle: -4, streak: 0.8 });
  const n = Math.max(2, Math.round(outline.length * pOut));
  ribbon(ctx, outline.slice(0, n), 2.6, { seed: e.seed, color: red, vary: 0.3 });
  // the hinge: a knob with a notch
  if (pOut > 0.9) {
    const hp = ellPts(cx - rx - 1.6, cy, 2.6, 3.6, 0, 18);
    wash(ctx, hp, C.white, { streak: 0 });
    ribbon(ctx, hp, 1.6, { closed: true, seed: e.seed + 1, color: red });
    wash(ctx, ellPts(cx - rx - 1.6, cy, 0.9, 0.9, 0, 8), red, { streak: 0 });
  }
  // three ribs fanning from the hinge, bowing outward
  [-0.75, 0, 0.75].forEach((a, i) => {
    if (pRibs <= i / 3) return;
    const pts = [];
    const ex = cx + Math.cos(a) * rx * 0.78;
    const ey = cy + Math.sin(a) * ry * 0.8;
    const x0 = cx - rx * 0.72;
    for (let j = 0; j <= 10; j += 1) {
      const t = j / 10;
      pts.push([lerp(x0, ex, t), lerp(cy, ey, t) + Math.sin(t * Math.PI) * 3.0 * Math.sign(a)]);
    }
    ribbon(ctx, pts, 1.7, { seed: e.seed + 2 + i, color: red });
  });
  if (fresh > 0.01) {
    ctx.save();
    ctx.globalAlpha = 0.55 * fresh;
    ribbon(ctx, outline.slice(5, 15).map(([x, y]) => [x, y + 1.8]), 0.7, { seed: e.seed + 9, color: "#fffaf0" });
    ctx.restore();
  }
}

function drawCountAt(ctx, k, t) {
  for (const e of planFor(k)) {
    const dt = t - e.t0;
    if (dt < 0) continue;
    const p = clamp(dt / e.dur);
    const fresh = 1 - smoothstep(0, 0.5, dt - e.dur);
    if (e.kind === "shell") {
      drawShell(ctx, e, dt / e.dur, fresh);
      continue;
    }
    const col = mixHex("#0a0605", "#271d17", 1 - fresh);
    const x = e.x + e.jx;
    const y = e.y + e.jy;
    if (e.kind === "bar") {
      const len = 34 * (0.3 + 0.7 * p);
      const x0 = x - 17;
      const tilt = (hash(e.seed, 4) - 0.5) * 1.0;
      const bp = rrectPts(x0, y - 3, len, 6, 2.6).map(([a, b], i) => [a + (hash(e.seed, i, 6) - 0.5) * 0.35, b + tilt * ((a - x0) / 34 - 0.5) + (hash(e.seed, i, 7) - 0.5) * 0.35]);
      wash(ctx, bp, col, { streak: 0.7, alpha: 0.98, angle: 2 });
      ribbon(ctx, bp, 0.5, { closed: true, seed: e.seed, color: col });
      const pts = [];
      for (let i = 0; i <= 8; i += 1) pts.push([x0 + 3 + ((len - 6) * i) / 8, y + tilt * ((3 + ((len - 6) * i) / 8) / 34 - 0.5)]);
      if (fresh > 0.01) {
        const hl = pts.slice(1, Math.max(2, Math.round(pts.length * 0.6))).map(([a, b]) => [a, b - 1.7]);
        ctx.save();
        ctx.globalAlpha = 0.45 * fresh;
        ribbon(ctx, hl, 0.8, { seed: e.seed + 3, color: "#f6efe0" });
        ctx.restore();
      }
    } else {
      const s = 0.75 + 0.25 * p;
      wash(ctx, blobPts(x, y, 3.7 * s, 3.5 * s, e.seed, 10, 0.08), col, { streak: 0.6, alpha: 0.98, angle: 20 });
      if (fresh > 0.01) {
        ctx.save();
        ctx.globalAlpha = 0.5 * fresh;
        ribbon(ctx, [[x - 2.2, y - 0.6], [x - 1.4, y - 1.9], [x - 0.2, y - 2.3]], 0.75, { seed: e.seed + 3, color: "#f6efe0" });
        ctx.restore();
      }
    }
  }
}

// ===================================================================== the pelican
const FRAME_TAGS = new Set(["frame", "post", "bar", "grip"]);
const OUT = 1.35; // main contour
const DET = 0.8; // detail

function shapePts(sh) {
  if (sh.kind === "circle") return ellPts(sh.c[0], sh.c[1], sh.r, sh.r, 0, 24);
  return sh.pts;
}

function limb(ctx, pts, w, color, seed) {
  ribbon(ctx, pts, w + OUT * 1.5, { seed, wob: 0.06, vary: 0.15 });
  ribbon(ctx, pts, w, { seed: seed + 1, color, wob: 0.05, vary: 0.15 });
}

function cartoucheWheel(ctx, c, r, angle, seed, ax, ay) {
  const ro = r + 0.9;
  const ri = r - 3.6;
  // band
  const ring = new Path2D();
  ring.arc(c[0], c[1], ro, 0, Math.PI * 2);
  ring.arc(c[0], c[1], ri, 0, Math.PI * 2, true);
  wash(ctx, ring, C.red, { ax, ay, angle: (angle * 180) / Math.PI });
  wash(ctx, ellPts(c[0], c[1], ri, ri, 0, 28), C.white, { ax, ay, streak: 0.6 });
  // white dots riding round the band
  for (let i = 0; i < 10; i += 1) {
    const a = angle + (i / 10) * Math.PI * 2;
    const rr = (ro + ri) / 2;
    const d = i === 0 ? 1.15 : 0.75;
    wash(ctx, blobPts(c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr, d, d, seed + i, 7, 0.08), i === 0 ? C.ochre : C.white, { streak: 0 });
  }
  // a rotating seed for the line wobble, so the ring's irregularities travel with the wheel
  // the rings start at the wheel angle, so their irregularities travel with it
  ribbon(ctx, ellPts(c[0], c[1], ro, ro, angle, 40), OUT * 1.1, { closed: true, seed });
  ribbon(ctx, ellPts(c[0], c[1], ri, ri, angle, 32), OUT * 0.85, { closed: true, seed: seed + 1 });
  // the day sign inside: four petals and four dots
  for (let i = 0; i < 4; i += 1) {
    const a = angle + (i * Math.PI) / 2;
    const pc = [c[0] + Math.cos(a) * 6.4, c[1] + Math.sin(a) * 6.4];
    const pts = ellPts(pc[0], pc[1], 5.0, 3.1, a, 20);
    wash(ctx, pts, i === 0 ? C.red : C.blue, { ax, ay, streak: 0.5 });
    ribbon(ctx, pts, DET, { closed: true, seed: seed + 10 + i });
    const b = a + Math.PI / 4;
    wash(ctx, blobPts(c[0] + Math.cos(b) * 10.6, c[1] + Math.sin(b) * 10.6, 1.25, 1.25, seed + 20 + i, 7, 0.06), C.ink, { streak: 0 });
  }
  wash(ctx, ellPts(c[0], c[1], 2.4, 2.4, 0, 14), C.ochre, { streak: 0 });
  ribbon(ctx, ellPts(c[0], c[1], 2.4, 2.4, 0, 14), DET, { closed: true, seed: seed + 30 });
}

function drawFrame(ctx, skel, ax, ay) {
  const lines = skel.shapes.filter((sh) => FRAME_TAGS.has(sh.tag) && sh.kind === "line");
  for (const sh of lines) {
    const extra = sh.tag === "grip" ? 1.2 : 0;
    ribbon(ctx, sh.pts, sh.w + OUT * 1.6 + extra, { seed: hashString(sh.id) % 997, wob: 0.06, vary: 0.12 });
  }
  for (const sh of lines) {
    if (sh.tag === "grip") continue;
    ribbon(ctx, sh.pts, sh.w * 0.95, { seed: (hashString(sh.id) % 997) + 1, color: sh.tag === "frame" ? C.ochre : C.brown, wob: 0.05, vary: 0.15 });
  }
  // red lashings near every joint and a knot on each
  const hubs = [skel.joints.rear, skel.joints.front];
  const ends = [];
  for (const sh of lines) {
    if (sh.tag !== "frame") continue;
    for (const [i, j] of [[0, 1], [sh.pts.length - 1, sh.pts.length - 2]]) {
      const p = sh.pts[i];
      const q = sh.pts[j];
      if (hubs.some((h) => Math.hypot(h[0] - p[0], h[1] - p[1]) < 5)) continue;
      ends.push({ p, q, w: sh.w });
    }
  }
  for (const e of ends) {
    const dx = e.q[0] - e.p[0];
    const dy = e.q[1] - e.p[1];
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    for (const off of [3.2, 4.8]) {
      const m = [e.p[0] + ux * off, e.p[1] + uy * off];
      const h = e.w * 0.5 + 1.0;
      ribbon(ctx, [[m[0] - uy * h, m[1] + ux * h], [m[0] + uy * h, m[1] - ux * h]], 0.85, { color: C.red, seed: Math.round(off * 10), wob: 0.02 });
    }
  }
  const knots = [];
  for (const e of ends) if (!knots.some((k) => Math.hypot(k[0] - e.p[0], k[1] - e.p[1]) < 4)) knots.push(e.p);
  knots.forEach((k, i) => {
    const pts = blobPts(k[0], k[1], 2.0, 1.8, 40 + i, 8, 0.1);
    wash(ctx, pts, C.red, { streak: 0 });
    ribbon(ctx, pts, 0.6, { closed: true, seed: 50 + i });
    ribbon(ctx, [[k[0] + 0.8, k[1] + 1.4], [k[0] + 1.6, k[1] + 3.8], [k[0] + 0.6, k[1] + 5.0]], 0.7, { color: C.red, seed: 60 + i });
  });
  void ax;
  void ay;
}

function frameOf(skel) {
  const J = skel.joints;
  const ax = J.shoulder[0] - J.tailRoot[0];
  const ay = J.shoulder[1] - J.tailRoot[1];
  const L = Math.hypot(ax, ay) || 1;
  return { o: J.body, a: [ax / L, ay / L], n: [-ay / L, ax / L], L };
}

function paintPelican(ctx, skel, pel) {
  const ax = pel.x;
  const ay = pel.y;
  const J = skel.joints;
  let frameDone = false;
  const W = (pts, color, o = {}) => wash(ctx, pts, color, { ax, ay, ...o });
  const O = (pts, w, seed, closed = true) => ribbon(ctx, pts, w, { closed, seed });
  for (const sh of skel.shapes) {
    const seed = hashString(sh.id) % 9973;
    const pts = sh.kind === "circle" ? null : sh.pts;
    switch (sh.tag) {
      case "leg":
        limb(ctx, pts, sh.w * 0.8, sh.side === "far" ? C.legFar : C.red, seed);
        break;
      case "foot":
        W(pts, sh.side === "far" ? C.legFar : C.red);
        O(pts, DET, seed);
        break;
      case "crank":
        ribbon(ctx, pts, sh.w * 0.9, { seed });
        break;
      case "pedal":
        W(pts, C.ink, { streak: 0 });
        break;
      case "tire": {
        const spoke = skel.shapes.find((s) => s.id === `spoke${sh.id.slice(4)}0`);
        const ang = spoke ? Math.atan2(spoke.pts[1][1] - spoke.pts[0][1], spoke.pts[1][0] - spoke.pts[0][0]) : pel.wheel;
        cartoucheWheel(ctx, sh.c, sh.r, ang, seed, ax, ay);
        break;
      }
      case "frame":
      case "post":
      case "bar":
      case "grip":
        if (!frameDone) {
          drawFrame(ctx, skel, ax, ay);
          frameDone = true;
        }
        break;
      case "bell":
        W(shapePts(sh), C.ochre, { streak: 0 });
        O(shapePts(sh), DET * 0.8, seed);
        break;
      case "saddle": {
        W(pts, C.ochre);
        const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        for (const [dx, dy] of [[-4.5, -0.6], [-1.2, 0.4], [2.2, -0.5], [5.2, 0.3]]) {
          ribbon(ctx, ellPts(cx + dx, cy + dy, 0.95, 0.8, 0, 10), 0.5, { closed: true, seed: seed + dx * 10 });
          wash(ctx, ellPts(cx + dx + 0.1, cy + dy, 0.35, 0.35, 0, 8), C.ink, { streak: 0 });
        }
        O(pts, DET, seed);
        break;
      }
      case "chain":
        ribbon(ctx, pts, 0.7, { seed, wob: 0.03 });
        break;
      case "ring":
        if (sh.id === "ring") {
          const p = ellPts(sh.c[0], sh.c[1], sh.r + 0.6, sh.r + 0.6, 0, 18);
          W(p, C.red, { streak: 0 });
          O(p, DET, seed);
          wash(ctx, ellPts(sh.c[0], sh.c[1], 1.1, 1.1, 0, 8), C.ink, { streak: 0 });
        } else {
          O(ellPts(sh.c[0], sh.c[1], sh.r, sh.r, 0, 16), 0.7, seed);
        }
        break;
      case "tail":
        W(pts, C.white);
        O(pts, DET, seed);
        break;
      case "body": {
        W(pts, C.white);
        // U-shaped feather marks in rows, anchored to the body
        const F = frameOf(skel);
        ctx.save();
        ctx.clip(pathOf(pts));
        for (let row = 0; row < 4; row += 1) {
          for (let i = -4; i <= 4; i += 1) {
            const s = (i + (row % 2) * 0.5) * 0.2 * F.L;
            const t = (-0.25 + row * 0.22) * F.L;
            const cx = F.o[0] + F.a[0] * s + F.n[0] * t;
            const cy = F.o[1] + F.a[1] * s + F.n[1] * t;
            const u = [];
            for (let j = 0; j <= 6; j += 1) {
              const a = Math.PI * (j / 6);
              const lx = Math.cos(a) * 1.6;
              const ly = Math.sin(a) * 1.5;
              u.push([cx + F.a[0] * lx + F.n[0] * ly, cy + F.a[1] * lx + F.n[1] * ly]);
            }
            ribbon(ctx, u, 0.65, { seed: seed + row * 20 + i, wob: 0.03 });
          }
        }
        ctx.restore();
        O(pts, OUT, seed);
        break;
      }
      case "neck": {
        W(pts, C.white);
        O(pts, OUT, seed);
        // a collar of green beads at the base of the neck
        const d = [J.head[0] - J.neckBase[0], J.head[1] - J.neckBase[1]];
        const dl = Math.hypot(d[0], d[1]) || 1;
        const dn = [d[0] / dl, d[1] / dl];
        const pn = [-dn[1], dn[0]];
        const base = [J.neckBase[0] + dn[0] * dl * 0.14, J.neckBase[1] + dn[1] * dl * 0.14];
        for (let i = -2; i <= 2; i += 1) {
          const t = i * 2.3;
          const bc = [base[0] + pn[0] * t - dn[0] * 0.09 * t * t, base[1] + pn[1] * t - dn[1] * 0.09 * t * t];
          const bp = ellPts(bc[0], bc[1], 1.25, 1.25, 0, 10);
          wash(ctx, bp, C.blue, { streak: 0 });
          ribbon(ctx, bp, 0.5, { closed: true, seed: seed + i + 5 });
        }
        break;
      }
      case "crest": {
        if (sh.id !== "crest0") break;
        // three curled plumes rising from the back of the head
        const headSh = skel.shapes.find((x) => x.tag === "head");
        let top = J.head;
        if (headSh) for (const p of headSh.pts) if (p[1] < top[1]) top = p;
        const back = Math.sign(J.head[0] - J.billBase[0]) || -1;
        const hx = top[0] + back * 2.2;
        const hy = top[1] + 1.6;
        for (let i = 0; i < 3; i += 1) {
          const len = 6.2 + i * 1.7;
          const ang = -Math.PI / 2 + back * (0.2 + i * 0.5);
          const ex = hx + Math.cos(ang) * len;
          const ey = hy + Math.sin(ang) * len;
          const plume = [[hx + back * i * 0.8, hy], [lerp(hx, ex, 0.55) + back * 0.6, lerp(hy, ey, 0.55) - 0.8], [ex, ey]];
          const curl = spiralPts(ex + Math.cos(ang + back * Math.PI / 2) * 1.6, ey + Math.sin(ang + back * Math.PI / 2) * 1.6, 1.6, 0.75, ang - back * Math.PI / 2, back, 10);
          const path = smoothOpen([...plume, ...curl.slice(1, 6)], 4);
          ribbon(ctx, path, 2.5 + OUT * 1.1, { seed: seed + i, wob: 0.04, vary: 0.1 });
          ribbon(ctx, path, 2.0, { seed: seed + i + 9, color: i === 1 ? C.red : C.blue, wob: 0.03, vary: 0.1 });
        }
        break;
      }
      case "pouch": {
        W(pts, C.pouch);
        const b = J.billBase;
        const tip = J.billTip;
        const dx = tip[0] - b[0];
        const dy = tip[1] - b[1];
        const dl = Math.hypot(dx, dy) || 1;
        const nx = -dy / dl;
        const ny = dx / dl;
        ctx.save();
        ctx.clip(pathOf(pts));
        for (let i = 0; i < 6; i += 1) {
          const t = 0.2 + i * 0.11;
          wash(ctx, ellPts(b[0] + dx * t + nx * 3.4, b[1] + dy * t + ny * 3.4, 0.62, 0.62, 0, 8), C.ink, { streak: 0 });
        }
        ctx.restore();
        O(pts, DET * 1.15, seed);
        break;
      }
      case "bill": {
        W(pts, C.ochre);
        if (sh.id === "billUpper") {
          const b = J.billBase;
          const tip = J.billTip;
          ctx.save();
          ctx.clip(pathOf(pts));
          ribbon(ctx, [[lerp(b[0], tip[0], 0.06), lerp(b[1], tip[1], 0.06) - 0.4], [lerp(b[0], tip[0], 0.85), lerp(b[1], tip[1], 0.85) - 0.2]], 0.75, { color: C.red, seed: seed + 1 });
          ctx.restore();
        }
        O(pts, DET * 1.15, seed);
        break;
      }
      case "head":
        W(pts, C.white);
        O(pts, OUT, seed);
        break;
      case "eye": {
        const [ex, ey] = sh.c;
        const R0 = sh.r * 1.55;
        wash(ctx, ellPts(ex, ey, R0, R0, 0, 18), C.red, { streak: 0 });
        wash(ctx, ellPts(ex, ey, R0 * 0.66, R0 * 0.66, 0, 16), C.white, { streak: 0 });
        ribbon(ctx, ellPts(ex, ey, R0, R0, 0, 18), 0.6, { closed: true, seed });
        const pupil = skel.shapes.find((s) => s.tag === "pupil");
        const pc = pupil ? pupil.c : sh.c;
        wash(ctx, ellPts(pc[0], pc[1], R0 * 0.36, R0 * 0.36, 0, 10), C.ink, { streak: 0 });
        // the curl beneath the eye
        ribbon(ctx, spiralPts(ex - R0 * 0.4, ey + R0 * 1.9, R0 * 0.75, 0.8, -Math.PI / 2, -1, 12), 0.6, { seed: seed + 2 });
        break;
      }
      case "pupil":
        break;
      case "wingtip":
        W(pts, C.red);
        O(pts, DET, seed);
        break;
      case "wing": {
        W(pts, "#2f8784", { angle: -20 });
        // scalloped coverts along the top of the wing
        ctx.save();
        ctx.clip(pathOf(pts));
        const F = frameOf(skel);
        for (let i = -3; i <= 3; i += 1) {
          const cx = J.wingTip[0] * 0.3 + J.shoulder[0] * 0.7 - F.a[0] * i * 2.6 + F.n[0] * 2.2;
          const cy = J.wingTip[1] * 0.3 + J.shoulder[1] * 0.7 - F.a[1] * i * 2.6 + F.n[1] * 2.2;
          const u = [];
          for (let j = 0; j <= 6; j += 1) {
            const a = Math.PI * (j / 6);
            u.push([cx + F.a[0] * Math.cos(a) * 1.3 + F.n[0] * Math.sin(a) * 1.4, cy + F.a[1] * Math.cos(a) * 1.3 + F.n[1] * Math.sin(a) * 1.4]);
          }
          ribbon(ctx, u, 0.5, { seed: seed + i });
        }
        ctx.restore();
        O(pts, OUT, seed);
        break;
      }
      case "wingfold":
        ribbon(ctx, pts, 0.6, { seed });
        break;
      default:
        break; // rim, spokes, valve, hub: the cartouche replaces them
    }
  }
}

// ===================================================================== the scene
export const maya = {
  ...META,
  still: { u: 3.25 },

  init(stage) {
    makeTile(stage);
    bakePage(stage);
    bakeWear(stage);
  },

  render(stage, f) {
    const view = f.view;
    makeTile(stage);
    const page = bakePage(stage);
    stage.origin();
    stage.rect(0, 0, f.w, f.h, [33, 24, 19]);
    stage.withView(view, () => {
      stage.image(page, BOOK.x0, BOOK.y0, BOOK.x1 - BOOK.x0, BOOK.y1 - BOOK.y0);
    });

    // the count, as it stands at f.u
    const xl = view.wx(0) - 30;
    const xr = view.wx(f.w) + 30;
    for (let k = 0; k <= 6; k += 1) {
      const c = k * PAGE;
      if (c + 30 < xl || c - 30 > xr) continue;
      const t = k === 0 ? 10 : f.u - k;
      if (t < 0) continue;
      const patch = stage.patch(`maya/num${k}`, view, c - 26, 476, c + 26, 556);
      drawCountAt(patch.ctx, k, t);
      stage.imagePatch(patch);
    }

    // the pelican, as the codex draws its creatures
    const pel = f.pelican;
    if (pel.visible) {
      const skel = solveRig({ ...pel });
      const b = skel.bounds;
      const patch = stage.patch("maya/pelican", view, b.x0 - 5, b.y0 - 5, b.x1 + 5, b.y1 + 5);
      patch.ctx.lineJoin = "round";
      paintPelican(patch.ctx, skel, pel);
      stage.imagePatch(patch);
    }

    // wear over everything
    const wear = bakeWear(stage);
    stage.withView(view, () => {
      stage.image(wear, BOOK.x0, BOOK.y0, BOOK.x1 - BOOK.x0, BOOK.y1 - BOOK.y0);
    });
  },
};
