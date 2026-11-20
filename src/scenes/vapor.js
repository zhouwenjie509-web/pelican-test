// Section 18 · 蒸汽波 · Vaporwave
//
// A vaporwave evening on worn video tape. Layers, back to front:
//
//   sky            depth 0      baked gradient violet -> magenta -> peach, a few stars
//   sun            depth 0.03   baked; kept to the right of the pelican, five dark bars
//   clouds         depth 0.05   baked thin streaks
//   mountains      depth 0.08 / 0.16   baked low-poly ranges, facets shaded by direction, cyan wire
//   grid floor     per frame    one fragment shader in true perspective from the camera;
//                               horizon 640, road lane at 700 (parallax 1), fades lines finer than 2 px
//   palms          depth 0.667  (bases on the grid line y = 680), baked low-poly sprites
//   columns, busts depth 0.833  (bases on y = 690); each bust is a low-poly solid (lathe rings
//                               plus beard / bun parts), rotated and projected, every facet shaded
//                               by its direction, baked in five views
//   pelican        depth 1      flat canvas skin in pastel and chrome, deep violet outline,
//                               a soft pink reflection on the grid
//   title window   depth 1      fixed in the world at x 160-410, y 448-546
//   tape furniture travels with the pelican: PLAY and a counter in a 5x7 dot font
//   tape pass      one full-frame shader: scan lines, fringes, softness, wobble, bottom noise,
//                               the tracking bar of the skip
//
// Everything is drawn into a scratch framebuffer at "tape time" T = tape(u) and the tape
// pass lays it onto the target. During the skip (3 <= u < 4) T repeats 3.00-3.25 four
// times: the world is shifted by the distance the camera has moved between T and u, so the
// pelican stays centred while the world, its pose, the busts and the counter snap back.
// Busts pick their view only on beats of T, from the pelican's position at that beat.

import { sectionMeta } from "./sections.js";
import { View } from "../kit/stage.js";
import { VERT, FRAG_HEAD, NOISE, rgb } from "../kit/glsl.js";
import { solveRig } from "../rig/rig.js";
import { drawPlain } from "../rig/skins/plain.js";
import { rng, noise1, wobble, hash } from "../kit/rng.js";
import { clamp, lerp, smoothstep } from "../beat/ease.js";
import { drawText, font } from "../kit/text.js";
import { sectionStart } from "../beat/timeline.js";

const META = sectionMeta(18);
const T0 = sectionStart(18); // 107

// ------------------------------------------------------------------ palette
const C = {
  violet: "#2b1055",
  purple: "#7b2cbf",
  magenta: "#ff4fd8",
  pink: "#ff9ad5",
  peach: "#ffd6a5",
  cyan: "#3df2ff",
  teal: "#19b5c8",
  marble: "#f3eef7",
};
const hex3 = (h) => {
  const v = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
};
const RGB = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, hex3(v)]));
const css = (c, a = 1) => `rgba(${Math.round(clamp(c[0], 0, 255))},${Math.round(clamp(c[1], 0, 255))},${Math.round(clamp(c[2], 0, 255))},${a})`;
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// ------------------------------------------------------------------ world layout
const HORIZON = 640;
const ROAD = 700;
const SUN = { r: 90, y: 572, x: 190 }; // x: layer coordinate at depth SUN_P
const SUN_P = 0.03;
const CLOUD_P = 0.05;
const MTN = [
  { id: "far", p: 0.08, seed: 1811, hmin: 10, hmax: 30, step: 34, haze: 0.55 },
  { id: "near", p: 0.16, seed: 1822, hmin: 5, hmax: 22, step: 28, haze: 0 },
];
const MTN_X0 = -480;
const MTN_X1 = 640;
const PALM_P = (680 - HORIZON) / (ROAD - HORIZON); // 0.667: bases on y = 680
const PALM_BASE = 680;
const PALMS = [
  { x: -170, h: 205, lean: -16, seed: 3 },
  // behind the frame until u 0.96, then well behind the pelican: never behind its head or bill at
  // the entry; leaning away from bust 1, its trunk at least 66 units from the bust's axis (about
  // 40 from the edge of its chest) for as long as both are on screen
  { x: -80, h: 226, lean: -10, seed: 7 },
  // clear of bust 2 through the skip and of bust 3 while the pelican passes it (>= 60 units)
  { x: 1020, h: 214, lean: 14, seed: 11 },
  { x: 1210, h: 196, lean: -16, seed: 17 },
  { x: 1420, h: 222, lean: -10, seed: 23 },
];
const BUST_P = (690 - HORIZON) / (ROAD - HORIZON); // 0.833: column bases on y = 690
const BUST_BASE = 690;
// colTop: the top of each column stump. All three busts stand tall (tops of the heads near
// y 538), so that when the pelican passes, the face is seen above its head, looking over it.
// Bust 1 stands at x 120, left of the title window (x 160), and the pelican passes it at u 0.7
const BUSTS = [
  { id: "man", x: 120, colTop: 624.2 },
  { id: "youth", x: 700, colTop: 621.5 },
  { id: "woman", x: 880, colTop: 620 },
];
const WIN = { x: 160, y: 448, w: 250, h: 98 };

// grid floor: lines every G units laterally (at the road) and in depth; the road is D units away
const GRID_G = 40;
const GRID_D = 300;

// ------------------------------------------------------------------ tape time
export function tape(u) {
  if (u >= 3 && u < 4) return 3 + ((u - 3) % 0.25);
  return u;
}
const snap = (v, q) => Math.round(v * q) / q;

// ------------------------------------------------------------------ sky, sun, clouds, mountains

function bakeSky(stage) {
  const k = 1.6 * stage.s;
  const X0 = -400;
  const X1 = 400;
  const Y0 = 418;
  const Y1 = 650;
  const fb = stage.bake2d(`vapor/sky/${k.toFixed(3)}`, (X1 - X0) * k, (Y1 - Y0) * k, (ctx) => {
    ctx.scale(k, k);
    ctx.translate(-X0, -Y0);
    const g = ctx.createLinearGradient(0, 433, 0, HORIZON);
    g.addColorStop(0, "#2b1055");
    g.addColorStop(0.3, "#56198a");
    g.addColorStop(0.58, "#a62a9e");
    g.addColorStop(0.8, "#ff5fb4");
    g.addColorStop(0.93, "#ffa3b5");
    g.addColorStop(1, "#ffd6a5");
    ctx.fillStyle = g;
    ctx.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    // stars in the violet
    const r = rng(1801);
    for (let i = 0; i < 46; i += 1) {
      const x = X0 + r() * (X1 - X0);
      const y = 436 + r() ** 1.6 * 80;
      const s = 0.35 + r() * 0.5;
      ctx.fillStyle = `rgba(255,236,250,${0.45 + 0.5 * r()})`;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
      if (r() < 0.12) {
        ctx.fillStyle = "rgba(255,230,250,0.55)";
        ctx.fillRect(x - 2.6, y - 0.12, 5.2, 0.24);
        ctx.fillRect(x - 0.12, y - 2.6, 0.24, 5.2);
      }
    }
  });
  return { fb, x: X0, y: Y0, w: X1 - X0, h: Y1 - Y0 };
}

function bakeSun(stage) {
  const k = 2.6 * stage.s;
  const R = SUN.r;
  const pad = 80;
  const w = 2 * (R + pad);
  const h = R + pad + (HORIZON + 4 - SUN.y);
  const fb = stage.bake2d(`vapor/sun/${k.toFixed(3)}`, w * k, h * k, (ctx) => {
    ctx.scale(k, k);
    ctx.translate(R + pad, R + pad); // sun centre
    const glow = ctx.createRadialGradient(0, 0, R * 0.8, 0, 0, R + pad);
    glow.addColorStop(0, "rgba(255,120,200,0.42)");
    glow.addColorStop(0.35, "rgba(255,90,190,0.16)");
    glow.addColorStop(1, "rgba(255,80,190,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(-R - pad, -R - pad, w, h);
    const yh = HORIZON + 4 - SUN.y;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.clip();
    const g = ctx.createLinearGradient(0, -R, 0, yh);
    g.addColorStop(0, "#fff27a");
    g.addColorStop(0.35, "#ffc46b");
    g.addColorStop(0.62, "#ff7f9e");
    g.addColorStop(1, "#ff3fc8");
    ctx.fillStyle = g;
    ctx.fillRect(-R, -R, 2 * R, R + yh);
    // five dark bars, thickening downward
    // (y below the centre, thickness): all five above the lowered mountain range
    const bars = [
      [2, 1.8],
      [10, 2.6],
      [18.5, 3.4],
      [27.5, 4.3],
      [37, 5.2],
    ];
    for (const [y, t] of bars) {
      const bg = ctx.createLinearGradient(0, y, 0, y + t);
      bg.addColorStop(0, "#3b1270");
      bg.addColorStop(1, "#511a86");
      ctx.fillStyle = bg;
      ctx.fillRect(-R, y, 2 * R, t);
    }
    ctx.restore();
  });
  return { fb, w, h, ox: R + pad, oy: R + pad };
}

const CLOUDS = [
  { x: -330, y: 474, len: 250, th: 2.0, c: "#c99cff" },
  { x: -90, y: 497, len: 330, th: 2.8, c: "#ff9ad5" },
  { x: 150, y: 531, len: 300, th: 2.4, c: "#ffb3dd" },
  { x: 245, y: 556, len: 210, th: 1.7, c: "#ffc0d8" },
  { x: -250, y: 545, len: 230, th: 2.0, c: "#ff8fd0" },
  { x: 300, y: 468, len: 170, th: 1.5, c: "#c99cff" },
  { x: -10, y: 571, len: 160, th: 1.4, c: "#ffd0c4" },
];

function bakeClouds(stage) {
  const k = 2.4 * stage.s;
  const X0 = -440;
  const X1 = 520;
  const Y0 = 455;
  const Y1 = 585;
  const fb = stage.bake2d(`vapor/clouds/${k.toFixed(3)}`, (X1 - X0) * k, (Y1 - Y0) * k, (ctx) => {
    ctx.scale(k, k);
    ctx.translate(-X0, -Y0);
    for (const c of CLOUDS) {
      const [r, g, b] = hex3(c.c);
      const grad = ctx.createLinearGradient(c.x, 0, c.x + c.len, 0);
      grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
      grad.addColorStop(0.2, `rgba(${r},${g},${b},0.75)`);
      grad.addColorStop(0.75, `rgba(${r},${g},${b},0.8)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      // a long lens, flat underneath
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.quadraticCurveTo(c.x + c.len * 0.45, c.y - c.th * 2, c.x + c.len, c.y);
      ctx.lineTo(c.x, c.y);
      ctx.fill();
      ctx.fillRect(c.x + c.len * 0.1, c.y, c.len * 0.8, c.th * 0.35);
    }
  });
  return { fb, x: X0, y: Y0, w: X1 - X0, h: Y1 - Y0 };
}

// lights, in view space (x right, y up, z towards the viewer)
const norm3 = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const L_PINK = norm3([-0.8, 0.35, 0.5]);
const L_CYAN = norm3([0.85, 0.12, 0.45]);
const L_TOP = norm3([0, 1, 0.25]);

function mountainMesh(spec) {
  const r = rng(spec.seed);
  const R = [];
  for (let x = MTN_X0, i = 0; x <= MTN_X1 + spec.step; x += spec.step, i += 1) {
    const n = noise1(x / 150, spec.seed) ** 1.4;
    const h = spec.hmin + (spec.hmax - spec.hmin) * n + (r() - 0.5) * 10;
    R.push([x + (r() - 0.5) * spec.step * 0.4, Math.max(3, h), -30]);
  }
  const M = [];
  const B = [];
  for (let i = 0; i < R.length; i += 1) {
    const nx = i + 1 < R.length ? R[i + 1][0] : R[i][0] + spec.step;
    const hm = Math.min(R[i][1], i + 1 < R.length ? R[i + 1][1] : R[i][1]);
    M.push([(R[i][0] + nx) / 2 + (r() - 0.5) * 6, hm * (0.35 + r() * 0.25), -15]);
    B.push([R[i][0], -3, 0]);
  }
  const tris = [];
  for (let i = 0; i + 1 < R.length; i += 1) {
    tris.push([R[i], R[i + 1], M[i]]);
    if (i > 0) {
      tris.push([M[i - 1], R[i], M[i]]);
      tris.push([M[i - 1], M[i], B[i]]);
    }
    tris.push([M[i], B[i], B[i + 1]]);
  }
  return { R, tris };
}

function bakeMountains(stage, spec) {
  const k = 3.0 * stage.s;
  const Y0 = HORIZON - spec.hmax - 12;
  const Y1 = HORIZON + 6;
  const fb = stage.bake2d(`vapor/mtn/${spec.id}/${k.toFixed(3)}`, (MTN_X1 - MTN_X0) * k, (Y1 - Y0) * k, (ctx) => {
    ctx.scale(k, k);
    ctx.translate(-MTN_X0, -Y0);
    const { R, tris } = mountainMesh(spec);
    const P = (v) => [v[0], HORIZON + 2 - v[1]];
    const far = spec.haze > 0;
    for (const t of tris) {
      // the facet as a 3D triangle: x, height, depth
      let n = norm3(cross3(sub3(t[1], t[0]), sub3(t[2], t[0])));
      if (n[2] < 0) n = n.map((v) => -v);
      const lp = Math.max(0, dot3(n, L_PINK));
      const lc = Math.max(0, dot3(n, L_CYAN));
      const lt = Math.max(0, dot3(n, L_TOP));
      let col = [43 + 40 * lt, 16 + 10 * lt, 85 + 40 * lt];
      col = [col[0] + 255 * 0.5 * lp + 61 * 0.35 * lc, col[1] + 154 * 0.35 * lp + 242 * 0.38 * lc, col[2] + 213 * 0.45 * lp + 255 * 0.4 * lc];
      if (far) col = mix3(col, [196, 84, 176], spec.haze);
      const a = P(t[0]);
      const b = P(t[1]);
      const c = P(t[2]);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.closePath();
      ctx.fillStyle = css(col);
      ctx.strokeStyle = css(col);
      ctx.lineWidth = 0.35;
      ctx.fill();
      ctx.stroke();
    }
    // wire
    ctx.lineJoin = "round";
    ctx.lineWidth = far ? 0.3 : 0.4;
    ctx.strokeStyle = far ? "rgba(255,170,230,0.35)" : "rgba(61,242,255,0.55)";
    for (const t of tris) {
      const a = P(t[0]);
      const b = P(t[1]);
      const c = P(t[2]);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.lineWidth = far ? 0.5 : 0.75;
    ctx.strokeStyle = far ? "rgba(255,190,235,0.6)" : "rgba(140,250,255,0.95)";
    ctx.beginPath();
    R.forEach((v, i) => {
      const p = P(v);
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    });
    ctx.stroke();
  });
  return { fb, x: MTN_X0, y: Y0, w: MTN_X1 - MTN_X0, h: Y1 - Y0 };
}

// ------------------------------------------------------------------ grid floor (shader)

const GRID_FRAG = `${FRAG_HEAD}
uniform vec2 uOrigin;
uniform vec2 uSize;
uniform float uCamX;
uniform float uSunX;
uniform float uPx;
const float H = ${HORIZON.toFixed(1)};
const float G = ${GRID_G.toFixed(1)};
const float D = ${GRID_D.toFixed(1)};
float lineMask(float c, float halfPx, out float avg) {
  float fw = max(fwidth(c), 1e-5);
  float d = abs(fract(c - 0.5) - 0.5) / fw;         // pixels to the nearest line
  float core = 1.0 - smoothstep(halfPx - 0.5, halfPx + 0.5, d);
  float glow = exp(-d / (1.6 * uPx)) * 0.45;
  float spacing = 1.0 / fw;                          // pixels between lines
  float fade = smoothstep(2.0, 7.0, spacing);
  avg = clamp((2.0 * halfPx + 1.6 * uPx * 0.9) / spacing, 0.0, 1.0) * 0.6;
  return mix(avg, core + glow, fade);
}
void main() {
  vec2 w = uOrigin + vTexCoord * uSize;
  float s = max((w.y - H) / (${ROAD}.0 - H), 1e-3);  // parallax scale, 1 on the road
  float gx = (uCamX + (w.x - uCamX) / s) / G;          // lateral grid coordinate on the ground
  float z = D / s;                                     // ground distance
  float gz = (z - D) / G + 0.5;                        // lines on both sides of the road
  float a1;
  float a2;
  float halfPx = max(0.28 * uPx, 0.6);
  float lx = lineMask(gx, halfPx, a1);
  float lz = lineMask(gz, halfPx, a2);
  float near = smoothstep(0.0, 1.0, (w.y - H) / 150.0);
  vec3 base = mix(vec3(0.27, 0.06, 0.42), vec3(0.07, 0.02, 0.17), sqrt(near));
  // haze at the horizon
  float haze = exp(-(w.y - H) / 9.0);
  base = mix(base, vec3(1.0, 0.36, 0.78), haze * 0.75);
  // the road lane
  float lane = step(0.0, gz) * step(gz, 1.0);
  base += lane * vec3(0.10, 0.04, 0.16);
  // the sun's reflection: a soft column of pink
  float sx = (w.x - uSunX) / (26.0 + 30.0 * near);
  base += vec3(0.55, 0.18, 0.35) * exp(-sx * sx) * (0.55 - 0.4 * near) * (0.7 + 0.3 * step(0.5, fract(gz * 2.0)));
  vec3 lineCol = mix(vec3(0.24, 0.95, 1.0), vec3(1.0, 0.55, 0.9), haze);
  float lines = max(lx, lz * (1.0 + 0.6 * lane));
  vec3 col = base + lineCol * lines * (0.85 + 0.25 * lane);
  // the horizon line itself
  float hl = exp(-abs(w.y - H - 0.4) * uPx / 1.6);
  col = mix(col, vec3(1.0, 0.86, 0.78), hl * 0.9);
  fragColor = vec4(min(col, vec3(1.0)), 1.0);
}`;

// ------------------------------------------------------------------ palms

function palmGeometry(spec) {
  const r = rng(spec.seed * 977 + 5);
  const segs = 9;
  const trunk = [];
  for (let i = 0; i <= segs; i += 1) {
    const t = i / segs;
    trunk.push({ x: spec.lean * t ** 1.6 + Math.sin(t * 3 + spec.seed) * 1.5, y: -spec.h * t, w: lerp(6.6, 3.6, t) });
  }
  const top = trunk[segs];
  // seven long fronds: each rises a little from the crown, arches over and droops, a spine of
  // three straight runs so every leaf is six large flat facets
  const fronds = [];
  const n = 7;
  for (let i = 0; i < n; i += 1) {
    const a = lerp(-112, 112, i / (n - 1)) + (r() - 0.5) * 12 + (i === 3 ? 9 : 0); // degrees from up, + = right
    const L = 82 + r() * 18 - Math.abs(a) * 0.06;
    const rad = (a * Math.PI) / 180;
    const droop = 26 + Math.abs(a) * 0.3;
    const pts = [];
    for (let j = 0; j <= 3; j += 1) {
      const s = j / 3;
      pts.push([top.x + Math.sin(rad) * L * s, top.y - Math.cos(rad) * L * s * 0.62 + droop * s * s - 1]);
    }
    fronds.push({ a, pts, wmax: 9.5 + r() * 3 });
  }
  // back fronds first: the ones pointing most sideways lie behind
  fronds.sort((p, q) => Math.abs(q.a) - Math.abs(p.a));
  return { trunk, top, fronds };
}

function paintPalm(ctx, spec) {
  const g = palmGeometry(spec);
  const outline = C.violet;
  // shadow on the grid
  ctx.fillStyle = "rgba(20,4,40,0.45)";
  ctx.beginPath();
  ctx.ellipse(0, 1.2, 15, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  const trunkPoly = (i) => {
    const a = g.trunk[i];
    const b = g.trunk[i + 1];
    const wb = a.w * 1.18;
    const wt = b.w * 0.86;
    return [
      [a.x - wb, a.y],
      [a.x + wb, a.y],
      [b.x + wt, b.y],
      [b.x - wt, b.y],
    ];
  };
  // a leaf: widest a third of the way out, a clean point at the tip; the half above the spine
  // and the half below it are separate facets on each of the three runs
  const frondPolys = (fr) => {
    const out = [];
    const W = [0.35, 1.0, 0.62, 0];
    const edge = (j, side) => {
      const p = fr.pts[j];
      const q = fr.pts[Math.min(j + 1, 3)];
      const o = fr.pts[Math.max(j - 1, 0)];
      const dx = q[0] - o[0];
      const dy = q[1] - o[1];
      const l = Math.hypot(dx, dy) || 1;
      const w = fr.wmax * W[j] * side;
      return [p[0] + (dy / l) * w, p[1] - (dx / l) * w];
    };
    for (let j = 0; j < 3; j += 1) {
      const p0 = fr.pts[j];
      const p1 = fr.pts[j + 1];
      for (const side of [1, -1]) {
        const e0 = edge(j, side);
        const e1 = edge(j + 1, side);
        const pts = j === 2 ? [p0, e0, p1] : [p0, e0, e1, p1];
        // which half faces the sky: its edge lies above the spine
        const up = (e0[1] + e1[1]) / 2 < (p0[1] + p1[1]) / 2;
        out.push({ pts, top: up, dir: fr.a, j });
      }
    }
    return out;
  };
  const polys = [];
  for (let i = 0; i < g.trunk.length - 1; i += 1) polys.push({ kind: "trunk", pts: trunkPoly(i), i });
  for (const fr of g.fronds) for (const fp of frondPolys(fr)) polys.push({ kind: "frond", ...fp });
  const path = (pts) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  };
  // the whole silhouette in violet first, as an outline
  ctx.lineJoin = "round";
  ctx.strokeStyle = outline;
  ctx.fillStyle = outline;
  ctx.lineWidth = 2.0;
  for (const pl of polys) {
    path(pl.pts);
    ctx.stroke();
    ctx.fill();
  }
  // trunk: stacked segments, lit pink on the left, violet on the right
  for (let i = 0; i < g.trunk.length - 1; i += 1) {
    const [p0, p1, p2, p3] = trunkPoly(i);
    const mb = [(p0[0] + p1[0]) / 2 - 0.6, p0[1]];
    const mt = [(p2[0] + p3[0]) / 2 - 0.4, p2[1]];
    const lit = i % 2 ? [255, 150, 200] : [246, 134, 196];
    const shade = i % 2 ? [92, 38, 140] : [104, 44, 150];
    path([p0, mb, mt, p3]);
    ctx.fillStyle = css(lit);
    ctx.fill();
    path([mb, p1, p2, mt]);
    ctx.fillStyle = css(shade);
    ctx.fill();
    // the ring at the top of each segment
    ctx.strokeStyle = "rgba(43,16,85,0.8)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(p3[0], p3[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.stroke();
  }
  // coconuts
  const top = g.top;
  for (const [dx, dy, c] of [
    [-3.5, 3, [70, 26, 110]],
    [2.5, 4, [90, 34, 130]],
    [0, 1.5, [110, 44, 150]],
  ]) {
    ctx.fillStyle = css(c);
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      ctx.lineTo(top.x + dx + Math.cos(a) * 3, top.y + dy + Math.sin(a) * 3);
    }
    ctx.closePath();
    ctx.fill();
  }
  // fronds: each facet one flat colour from its direction; the upper halves lit (pink on the
  // left, cyan on the right), the lower halves in shadow, the outer run a step darker
  for (const pl of polys) {
    if (pl.kind !== "frond") continue;
    const right = clamp(pl.dir / 110, -1, 1); // -1 points left (pink light), +1 right (cyan light)
    let col;
    if (pl.top) {
      col = mix3([60, 220, 235], [255, 150, 215], clamp(-right * 0.8 + 0.5, 0, 1));
      col = mix3(col, [40, 150, 190], pl.j * 0.14);
    } else {
      col = mix3([16, 120, 150], [74, 30, 120], clamp(-right * 0.6 + 0.4, 0, 1));
      col = mix3(col, [40, 14, 80], pl.j * 0.12);
    }
    path(pl.pts);
    ctx.fillStyle = css(col);
    ctx.strokeStyle = css(col);
    ctx.lineWidth = 0.3;
    ctx.fill();
    ctx.stroke();
  }
  // the midrib of each leaf
  ctx.strokeStyle = "rgba(43,16,85,0.7)";
  ctx.lineWidth = 0.5;
  for (const fr of g.fronds) {
    ctx.beginPath();
    fr.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
  }
}

function bakePalm(stage, spec) {
  const k = 3.2 * stage.s;
  const x0 = -128;
  const x1 = 128;
  const y0 = -spec.h - 72;
  const y1 = 6;
  const fb = stage.bake2d(`vapor/palm/${spec.seed}/${k.toFixed(3)}`, (x1 - x0) * k, (y1 - y0) * k, (ctx) => {
    ctx.scale(k, k);
    ctx.translate(-x0, -y0);
    paintPalm(ctx, spec);
  });
  return { fb, x0, y0, w: x1 - x0, h: y1 - y0 };
}

// ------------------------------------------------------------------ busts: low-poly solids
//
// Each bust is a stack of rings (16 vertices round) for socle, chest, neck and head, with the
// face carved into the head rings (brow, sockets, nose, lips, chin, ears), plus loose solids:
// faceted shells for the man's hair and beard, combed locks (youth), broad waves and a bun (woman). Model units, y up, the face looking down +z.

const NSEG = 16;
const STEP = (2 * Math.PI) / NSEG;
const gauss = (d, s) => Math.exp(-(d / s) * (d / s));
const wrapA = (a) => {
  let v = a % (2 * Math.PI);
  if (v > Math.PI) v -= 2 * Math.PI;
  if (v < -Math.PI) v += 2 * Math.PI;
  return v;
};
const circ = (r) => ({ F: r, W: r, B: r, n: 2, nb: 2 });

/** Radius of a ring at angle phi from the front: a superellipse through F (front), W (side) and
 *  B (back), plus features d: [[column, amount]] mirrored, ds: the same on one side only. */
function ringR(rg, phi) {
  const a = Math.abs(wrapA(phi));
  const front = a <= Math.PI / 2;
  const A = front ? rg.F : rg.B;
  const n = front ? rg.n || 2.3 : rg.nb || 2.2;
  const c = Math.abs(Math.cos(a)) / A;
  const s = Math.sin(a) / rg.W;
  let r = 1 / Math.pow(Math.pow(c, n) + Math.pow(s, n), 1 / n);
  // cut: a flat vertical plane at |x| = cut on each side (where the arms are sawn off)
  if (rg.cut) r = Math.min(r, rg.cut / Math.max(1e-6, Math.abs(Math.sin(a))));
  if (rg.d) for (const [col, amt] of rg.d) r += amt * gauss(a - col * STEP, STEP * 0.55);
  if (rg.ds) for (const [col, amt] of rg.ds) r += amt * gauss(wrapA(phi - col * STEP), STEP * 0.55);
  return r;
}

function ringPts(rg) {
  const pts = [];
  for (let j = 0; j < NSEG; j += 1) {
    const phi = j * STEP;
    const r = ringR(rg, phi);
    pts.push([r * Math.sin(phi), rg.y, (rg.cz || 0) + r * Math.cos(phi)]);
  }
  return pts;
}

/** A point on a ring stack at height y and angle phi, pushed out by `out`. */
function surfaceAt(rows, y, phi, out = 0) {
  let i = 0;
  while (i < rows.length - 2 && rows[i + 1].y < y) i += 1;
  const a = rows[i];
  const b = rows[i + 1];
  const t = clamp((y - a.y) / (b.y - a.y), 0, 1);
  const r = lerp(ringR(a, phi), ringR(b, phi), t) + out;
  const cz = lerp(a.cz || 0, b.cz || 0, t);
  return [r * Math.sin(phi), y, cz + r * Math.cos(phi)];
}

const ICO = (() => {
  const t = (1 + Math.sqrt(5)) / 2;
  const v = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t],
    [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map(norm3);
  const f = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  return { v, f };
})();

/** A curl: a jittered icosahedron, flattened along the surface normal. */
function curlMesh(c, nrm, r, rnd, flat = 0.5) {
  const yaw = rnd() * Math.PI * 2;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const verts = ICO.v.map((p) => {
    const q = [p[0] * cy + p[2] * sy, p[1], -p[0] * sy + p[2] * cy];
    const j = r * (0.86 + 0.28 * rnd());
    // squash along the normal so the curl sits on the surface like a snail-shell lock
    const dn = dot3(q, nrm);
    const sq = [q[0] - nrm[0] * dn * (1 - flat), q[1] - nrm[1] * dn * (1 - flat), q[2] - nrm[2] * dn * (1 - flat)];
    return [c[0] + sq[0] * j, c[1] + sq[1] * j, c[2] + sq[2] * j];
  });
  return { mesh: { verts, tris: ICO.f, centre: c } };
}

/** A big curl in a few clear facets: a low pentagonal pyramid on the surface, its peak pushed
 *  off-centre (towards `lean`, a surface direction) so each facet takes its own light. */
function clumpMesh(c, nrm, r, rnd, { h = 0.6, lean = null, sides = 5 } = {}) {
  const up = Math.abs(nrm[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const t1 = norm3(cross3(up, nrm));
  const t2 = cross3(nrm, t1);
  const rot = rnd() * Math.PI * 2;
  const at = (a, rr, out) => [0, 1, 2].map((q) => c[q] + (t1[q] * Math.cos(a) + t2[q] * Math.sin(a)) * rr + nrm[q] * out);
  const verts = [];
  for (let i = 0; i < sides; i += 1) verts.push(at(rot + (i / sides) * Math.PI * 2 + (rnd() - 0.5) * 0.5, r * (0.85 + 0.3 * rnd()), -r * 0.3));
  const off = lean ? lean.map((q) => q * r * 0.35) : [0, 0, 0];
  // a nearly flat top, smaller and turned against the base, tipped towards `lean`: the curl's
  // crown is one broad plane and the bevels round it take the light one by one
  for (let i = 0; i < sides; i += 1) {
    const v = at(rot + ((i + 0.5) / sides) * Math.PI * 2, r * 0.52, r * h * 0.82);
    verts.push([0, 1, 2].map((q) => v[q] + off[q]));
  }
  verts.push([0, 1, 2].map((q) => c[q] + nrm[q] * r * h + off[q])); // the crown's centre
  verts.push([0, 1, 2].map((q) => c[q] - nrm[q] * r * 0.8)); // inside, closing it
  const P = 2 * sides;
  const Q = 2 * sides + 1;
  const tris = [];
  for (let i = 0; i < sides; i += 1) {
    const j = (i + 1) % sides;
    tris.push([i, j, sides + i]);
    tris.push([j, sides + j, sides + i]);
    tris.push([sides + i, sides + j, P]);
    tris.push([i, j, Q]);
  }
  return { mesh: { verts, tris, centre: c } };
}

/** A mass of hair (or beard) as a coarse faceted shell over a ring stack: `cols` columns from
 *  phi0 to phi1 (or all round when wrap), rows from yLo(phi) to yHi(phi), each vertex pushed out
 *  by out(i/rowsN) with a little jitter, so every quad is a plane of its own. An optional `apex`
 *  closes the top (the crown) or `tip` the bottom (the point of a beard). */
function shellMesh(rows, { cols, rowsN, phi0 = -Math.PI, phi1 = Math.PI, wrap = false, yLo, yHi, out, jit = 0.5, ridge = 0, seed, apex = null, tip = null, centre }) {
  const rnd = rng(seed);
  const verts = [];
  const nc = wrap ? cols : cols + 1;
  for (let i = 0; i <= rowsN; i += 1) {
    const s = i / rowsN;
    for (let j = 0; j < nc; j += 1) {
      const stag = wrap ? (i % 2) * 0.5 : 0;
      const phi = lerp(phi0, phi1, (j + stag) / cols) + (i > 0 && i < rowsN ? (rnd() - 0.5) * 0.12 : 0);
      const y = lerp(yLo(phi), yHi(phi), s) + (i > 0 && i < rowsN ? (rnd() - 0.5) * 0.6 : 0);
      // ridge: every other vertex stands proud, so the planes fold like big locks
      const rd = i > 0 ? ridge * ((i + j) % 2 ? 1 : -0.6) : 0;
      verts.push(surfaceAt(rows, y, phi, out(s) + rd + (rnd() - 0.5) * jit));
    }
  }
  const tris = [];
  const id = (i, j) => i * nc + (wrap ? ((j % nc) + nc) % nc : j);
  const jn = wrap ? cols : cols;
  for (let i = 0; i < rowsN; i += 1) {
    for (let j = 0; j < jn; j += 1) {
      if (wrap && i % 2 === 1) {
        tris.push([id(i, j), id(i, j + 1), id(i + 1, j + 1)]);
        tris.push([id(i, j), id(i + 1, j + 1), id(i + 1, j)]);
      } else {
        tris.push([id(i, j), id(i, j + 1), id(i + 1, j)]);
        tris.push([id(i, j + 1), id(i + 1, j + 1), id(i + 1, j)]);
      }
    }
  }
  if (apex) {
    const a = verts.length;
    verts.push(apex);
    for (let j = 0; j < jn; j += 1) tris.push([id(rowsN, j), id(rowsN, j + 1), a]);
  }
  if (tip) {
    const a = verts.length;
    verts.push(tip);
    for (let j = 0; j < jn; j += 1) tris.push([id(0, j), id(0, j + 1), a]);
  }
  return { mesh: { verts, tris, centre } };
}

/** Big curls over the part of a ring stack where `where(y, phi)` holds, a few facets each. */
function clumpField(rows, { y0, y1, where, spacing, r, seed, out = 0.2, h = 0.6, down = 0.5 }) {
  const rnd = rng(seed);
  const parts = [];
  let row = 0;
  for (let y = y0; y <= y1 + 1e-6; y += spacing * 0.8, row += 1) {
    const rr = ringR(rows.reduce((best, q) => (Math.abs(q.y - y) < Math.abs(best.y - y) ? q : best)), Math.PI / 2);
    const n = Math.max(1, Math.round((2 * Math.PI * rr) / spacing));
    for (let i = 0; i < n; i += 1) {
      const phi = wrapA(((i + (row % 2) * 0.5) / n) * 2 * Math.PI + (rnd() - 0.5) * 0.12);
      const yy = y + (rnd() - 0.5) * spacing * 0.2;
      if (!where(yy, phi)) continue;
      const p0 = surfaceAt(rows, yy, phi);
      const p1 = surfaceAt(rows, yy, phi, 1);
      const nrm = norm3(sub3(p1, p0));
      const pd = surfaceAt(rows, yy - 1, phi);
      const dn = norm3(sub3(pd, p0)); // down the surface
      const c = [0, 1, 2].map((q) => p0[q] + nrm[q] * r * out);
      parts.push(clumpMesh(c, nrm, r * (0.9 + 0.2 * rnd()), rnd, { h, lean: dn.map((q) => q * down) }));
    }
  }
  return parts;
}

/** An icosahedron on three axes (each a scaled 3-vector), lightly jittered. */
function blobMesh(c, u, v, w, rnd, jit = 0.18) {
  const verts = ICO.v.map((p) => {
    const j = 1 + (rnd() - 0.5) * jit;
    return [0, 1, 2].map((q) => c[q] + (p[0] * u[q] + p[1] * v[q] + p[2] * w[q]) * j);
  });
  return { mesh: { verts, tris: ICO.f, centre: c } };
}

/** Wavy locks: long flat blobs lying along the surface, combed towards `back` (an angle). */
function lockField(rows, { y0, y1, where, spacing, r, seed, len = 2.4, sweep = 0.9, dir = 1, wide = 0.62 }) {
  const rnd = rng(seed);
  const parts = [];
  let row = 0;
  for (let y = y0; y <= y1 + 1e-6; y += spacing * 0.62, row += 1) {
    const rr = ringR(rows.reduce((best, q) => (Math.abs(q.y - y) < Math.abs(best.y - y) ? q : best)), Math.PI / 2);
    const n = Math.max(1, Math.round((2 * Math.PI * rr) / (spacing * len * 0.75)));
    for (let i = 0; i < n; i += 1) {
      const phi = wrapA(((i + (row % 2) * 0.5) / n) * 2 * Math.PI + (rnd() - 0.5) * 0.1);
      const yy = y + (rnd() - 0.5) * spacing * 0.2;
      if (!where(yy, phi)) continue;
      const p0 = surfaceAt(rows, yy, phi);
      const p1 = surfaceAt(rows, yy, phi, 1);
      const nrm = norm3(sub3(p1, p0));
      // the tangent running round the head away from the face, tipped down a little
      const s = (phi >= 0 ? 1 : -1) * dir;
      const pa = surfaceAt(rows, yy - sweep * 0.25, phi + s * 0.2);
      const t = norm3(sub3(pa, p0));
      const b = norm3(cross3(nrm, t));
      const c = [p0[0] + nrm[0] * r * 0.25, p0[1] + nrm[1] * r * 0.25, p0[2] + nrm[2] * r * 0.25];
      const k = r * (0.9 + 0.2 * rnd());
      parts.push(blobMesh(c, t.map((q) => q * k * len), b.map((q) => q * k * wide), nrm.map((q) => q * k * 0.5), rnd));
    }
  }
  return parts;
}

/** Curls scattered over the part of a ring stack where `where(y, phi)` holds. */
function curlField(rows, { y0, y1, where, spacing, r, seed, out = 0.35 }) {
  const rnd = rng(seed);
  const parts = [];
  let row = 0;
  for (let y = y0; y <= y1 + 1e-6; y += spacing * 0.8, row += 1) {
    const rr = ringR(rows.reduce((best, q) => (Math.abs(q.y - y) < Math.abs(best.y - y) ? q : best)), Math.PI / 2);
    const n = Math.max(1, Math.round((2 * Math.PI * rr) / spacing));
    for (let i = 0; i < n; i += 1) {
      const phi = wrapA(((i + (row % 2) * 0.5) / n) * 2 * Math.PI + (rnd() - 0.5) * 0.12);
      const yy = y + (rnd() - 0.5) * spacing * 0.3;
      if (!where(yy, phi)) continue;
      const p0 = surfaceAt(rows, yy, phi);
      const p1 = surfaceAt(rows, yy, phi, 1);
      const nrm = norm3(sub3(p1, p0));
      const c = [p0[0] + nrm[0] * r * out, p0[1] + nrm[1] * r * out, p0[2] + nrm[2] * r * out];
      parts.push(curlMesh(c, nrm, r * (0.9 + 0.2 * rnd()), rnd));
    }
  }
  return parts;
}

/** Build one solid from parts. Returns { verts, tris: [[a, b, c]] } wound outward. */
function buildSolid(parts) {
  const verts = [];
  const tris = [];
  const add = (a, b, c, inside, tone = 0, zb = 0, grp = -1) => {
    const A = verts[a];
    const B = verts[b];
    const Cc = verts[c];
    const n = cross3(sub3(B, A), sub3(Cc, A));
    if (Math.hypot(n[0], n[1], n[2]) < 1e-6) return;
    const g = [(A[0] + B[0] + Cc[0]) / 3, (A[1] + B[1] + Cc[1]) / 3, (A[2] + B[2] + Cc[2]) / 3];
    if (dot3(n, sub3(g, inside)) < 0) tris.push([a, c, b, tone, zb, grp]);
    else tris.push([a, b, c, tone, zb, grp]);
  };
  let groups = 0;
  for (const part of parts) {
    const base = verts.length;
    if (part.mesh) {
      verts.push(...part.mesh.verts);
      // zb: a layer lying on the surface (hair) is painted after the facets it lies on
      // a fourth index groups triangles into one plane of light (the two halves of a quad)
      for (const [a, b, c, q] of part.mesh.tris) add(base + a, base + b, base + c, part.mesh.centre, part.tone || 0, part.zb || 0, q === undefined ? -1 : groups + q);
      groups += 10000;
      if (part.xf) for (let i = base; i < verts.length; i += 1) verts[i] = part.xf(verts[i]);
      continue;
    }
    const rings = part.rings.map(ringPts);
    rings.forEach((r) => verts.push(...r));
    const id = (i, j) => base + i * NSEG + (((j % NSEG) + NSEG) % NSEG);
    const centre = (i) => [0, part.rings[i].y, part.rings[i].cz || 0];
    const toneOf = (a, b, c) => {
      if (!part.toneFn) return 0;
      const A = verts[a];
      const B = verts[b];
      const Cc = verts[c];
      return part.toneFn([(A[0] + B[0] + Cc[0]) / 3, (A[1] + B[1] + Cc[1]) / 3, (A[2] + B[2] + Cc[2]) / 3]);
    };
    for (let i = 0; i + 1 < rings.length; i += 1) {
      const inside = centre(i).map((v, q) => (v + centre(i + 1)[q]) / 2);
      for (let j = 0; j < NSEG; j += 1) {
        add(id(i, j), id(i, j + 1), id(i + 1, j + 1), inside, toneOf(id(i, j), id(i, j + 1), id(i + 1, j + 1)));
        add(id(i, j), id(i + 1, j + 1), id(i + 1, j), inside, toneOf(id(i, j), id(i + 1, j + 1), id(i + 1, j)));
      }
    }
    if (part.top !== undefined) {
      const last = rings.length - 1;
      const apex = verts.length;
      verts.push([0, part.top, part.topZ ?? part.rings[last].cz ?? 0]);
      const inside = [0, part.rings[last].y - 1, part.rings[last].cz || 0];
      for (let j = 0; j < NSEG; j += 1) add(id(last, j), id(last, j + 1), apex, inside);
    }
    if (part.bottom !== undefined) {
      const bot = verts.length;
      verts.push([0, part.bottom, part.bottomZ ?? part.rings[0].cz ?? 0]);
      const inside = [0, part.rings[0].y + 1, part.rings[0].cz || 0];
      for (let j = 0; j < NSEG; j += 1) add(id(0, j), id(0, j + 1), bot, inside);
    }
    if (part.xf) for (let i = base; i < verts.length; i += 1) verts[i] = part.xf(verts[i]);
  }
  return { verts, tris };
}

/** Socle and chest: the round foot, then the chest cut in a U, square shoulders, the neck base. */
function torso({ Wc, F, B, sex, neck, slope = false }) {
  const male = sex !== "f";
  const pecs = male ? [[0, -0.5], [1.4, 0.8], [2.3, 0.3]] : [];
  // the round foot and its stem, a solid of its own with a flat top
  const socle = [
    { y: 0, ...circ(9.6) },
    { y: 2.0, ...circ(9.6) },
    { y: 2.7, ...circ(8.2) },
    { y: 3.6, ...circ(6.0) },
    { y: 5.4, ...circ(4.8) },
    { y: 6.1, ...circ(6.4) },
    { y: 7.2, ...circ(6.4) },
  ];
  // the chest: a block with depth, cut flat underneath, the arms cut off in flat vertical
  // planes at the sides (high superellipse exponent), the shoulders sloping down from the neck
  // and the collarbones sloping back to it, so the profile is a chest and not a bowl
  // slope: the arm cuts end lower and the shoulders run in one long slope from the arm cut up to
  // the neck, front to back as well as side to side (bust 1)
  const rows = slope ? [
    // the chest is round at the front and back (a low exponent) and sawn flat at the sides
    { y: 7.2, F: F * 0.95, W: Wc * 1.16, B: B * 0.95, cz: 1.8, n: 2.4, nb: 2.4, cut: Wc * 0.95 },
    { y: 9.0, F: F * 1.0, W: Wc * 1.22, B: B * 1.0, cz: 1.9, n: 2.4, nb: 2.4, cut: Wc, d: pecs },
    { y: 15.0, F, W: Wc * 1.24, B, cz: 1.9, n: 2.4, nb: 2.4, cut: Wc, d: pecs },
    { y: 17.6, F: F * 0.97, W: Wc * 1.2, B: B * 0.97, cz: 1.7, n: 2.4, nb: 2.4, cut: Wc },
    { y: 18.8, F: F * 0.9, W: Wc * 0.96, B: B * 0.9, cz: 1.5, n: 2.6, nb: 2.6, cut: Wc * 0.94 },
    { y: 20.4, F: F * 0.76, W: Wc * 0.78, B: B * 0.8, cz: 1.1, n: 2.6, nb: 2.6 },
    { y: 22.2, F: F * 0.62, W: Wc * 0.6, B: B * 0.68, cz: 0.6, n: 2.5, nb: 2.5 },
    { y: 24.0, F: F * 0.5, W: Wc * 0.45, B: B * 0.56, cz: 0.1, n: 2.4, nb: 2.4 },
    { y: 25.6, F: F * 0.43, W: Wc * 0.36, B: B * 0.49, cz: -0.3, n: 2.3 },
    { y: 27.2, F: neck * 1.3, W: neck * 1.45, B: neck * 1.3, cz: -0.8 },
  ] : [
    { y: 7.2, F: F * 0.82, W: Wc * 0.8, B: B * 0.84, cz: 1.6, n: 3.4, nb: 3.4 },
    { y: 8.6, F: F * 0.95, W: Wc * 0.93, B: B * 0.94, cz: 1.8, n: 6, nb: 6 },
    { y: 11.4, F: F * 1.0, W: Wc * 0.98, B: B * 0.98, cz: 1.9, n: 8, nb: 8, d: pecs },
    { y: 15.4, F, W: Wc, B, cz: 1.9, n: 8, nb: 8, d: pecs },
    { y: 19.0, F: F * 0.96, W: Wc, B: B * 0.98, cz: 1.6, n: 8, nb: 8 },
    { y: 21.0, F: F * 0.88, W: Wc * 0.99, B: B * 0.94, cz: 1.2, n: 7, nb: 7, d: [[1.6, 0.4], [2.6, 0.3]] },
    // the top of the chest: nearly flat from front to back, so the neck rises out of a ledge
    { y: 22.0, F: F * 0.66, W: Wc * 0.92, B: B * 0.78, cz: 0.8, n: 4.5, nb: 4.5, d: [[1.6, 0.4], [2.6, 0.2]] },
    { y: 23.2, F: F * 0.5, W: Wc * 0.74, B: B * 0.62, cz: 0.4, n: 3.2, nb: 3.2 },
    { y: 24.6, F: F * 0.44, W: Wc * 0.54, B: B * 0.54, cz: 0.0, n: 2.6, nb: 2.6 },
    { y: 25.8, F: F * 0.42, W: Wc * 0.44, B: B * 0.5, cz: -0.3, n: 2.4 },
    { y: 27.2, F: neck * 1.3, W: neck * 1.45, B: neck * 1.3, cz: -0.8 },
  ];
  if (sex === "f") {
    // a chiton: soft vertical folds and a rolled neckline
    for (const r of rows) {
      if (r.y > 7.6 && r.y < 22) r.d = [[0.5, 0.45], [1.5, -0.35], [2.5, 0.5], [3.6, -0.3], [4.6, 0.4]];
    }
    rows.push({ y: 22.2, F: F * 0.84, W: Wc * 0.97, B: B * 0.88, cz: 0.3, n: 3.4, d: [[0, 0.8], [1, 0.7], [2, 0.5]] });
    rows.sort((p, q) => p.y - q.y);
  }
  if (sex === "m") {
    // a cloak over the left shoulder, its folds running down across the chest
    for (const r of rows) {
      if (r.y < 8 || r.y > 25) continue;
      const t = (r.y - 8) / 17;
      const c = lerp(3.2, -2.6, t);
      r.ds = [[c, 0.9], [c - 1, -0.3], [c + 1.1, 0.5], [-4.2, 1.0], [-5, 0.8]];
    }
  }
  // the flat planes where the arms are cut off: smooth sawn stone, a shade of their own
  const cutTop = slope ? 17.8 : 21.2;
  const armCut = (g) => (Math.abs(g[0]) > Wc * 0.86 && g[1] > 8.0 && g[1] < cutTop ? -1 : 0);
  return { rows, parts: [{ rings: socle, bottom: 0, top: 7.2, body: true }, { rings: rows, bottom: 7.2, bottomZ: 1.6, top: 28.0, body: true, toneFn: armCut }] };
}

/** The neck from inside the chest to inside the head. */
function neckPart(r, yb, yt) {
  // leaning forward, a little deeper than wide, the sterno-mastoid cords at the front
  return {
    rings: [
      { y: yb, F: r * 1.05, W: r * 1.05, B: r * 1.05, cz: -1.4, n: 2, nb: 2 },
      { y: lerp(yb, yt, 0.5), F: r * 0.95, W: r * 0.92, B: r * 0.92, cz: -0.6, n: 2, nb: 2, d: [[1.8, 0.4]] },
      { y: yt, F: r * 0.92, W: r * 0.9, B: r * 0.92, cz: 0.4, n: 2, nb: 2 },
    ],
  };
}

/** Head rings, chin at local y = 0, crown about 23; shifted up by hy. f carries each head's differences. */
function headRows(hy, f) {
  const R = [
    // y      cz    F     W     B     features
    { y: -0.8, cz: 4.6, F: 2.4, W: 3.0, B: 2.2 },
    { y: 0.6, cz: 4.0, F: 4.6 * f.chin, W: 4.0, B: 3.6 },
    { y: 2.0, cz: 3.0, F: 5.4, W: 5.0 * f.jaw, B: 4.8, d: [[0, -0.3]] },
    { y: 3.3, cz: 2.2, F: 6.6, W: 5.7 * f.jaw, B: 5.8, d: [[0, 0.25 * f.lips]] },
    { y: 4.3, cz: 1.8, F: 7.0, W: 6.2 * f.jaw, B: 6.4, d: [[0, -0.35], [1, -0.1]], n: 2.6 },
    { y: 5.3, cz: 1.5, F: 7.6, W: 6.6 * f.jaw, B: 7.0, d: [[0, 0.45 * f.lips]], n: 2.6 },
    { y: 6.5, cz: 1.0, F: 8.0, W: 7.0, B: 7.8, d: [[0, 0.5], [4.1, 1.2 * f.ears], [4.9, 0.7 * f.ears]], n: 2.7 },
    { y: 7.7, cz: 0.8, F: 8.2, W: 7.2, B: 8.4, d: [[0, 1.0], [2, 0.3], [4.1, 1.6 * f.ears], [4.9, 1.0 * f.ears]], n: 2.7 },
    { y: 9.2, cz: 0.6, F: 8.3, W: 7.4, B: 9.0, d: [[0, 0.8], [2, 0.35], [4.1, 1.7 * f.ears], [4.9, 1.0 * f.ears]], n: 2.8 },
    { y: 10.8, cz: 0.4, F: 8.4, W: 7.6, B: 9.4, d: [[0, 0.7], [1, -1.3], [4.1, 1.4 * f.ears], [4.9, 0.8 * f.ears]], n: 2.8 },
    { y: 12.4, cz: 0.2, F: 9.0, W: 7.8, B: 9.7, d: [[0, 0.1], [1, 0.6], [2, 0.2], [4.1, 0.6 * f.ears]], n: 2.7 },
    { y: 14.2, cz: 0.0, F: 9.1, W: 7.9, B: 9.8, n: 2.5 },
    { y: 16.2, cz: -0.3, F: 8.8, W: 7.8, B: 9.6 },
    { y: 18.2, cz: -0.5, F: 8.0, W: 7.3, B: 9.0 },
    { y: 20.0, cz: -0.7, F: 6.6, W: 6.2, B: 7.8 },
    { y: 21.4, cz: -0.9, F: 4.6, W: 4.6, B: 5.8 },
    { y: 22.3, cz: -1.0, F: 2.6, W: 2.6, B: 3.4 },
  ];
  if (f.edit) f.edit(R);
  return R.map((r) => ({ ...r, y: r.y + hy }));
}

const MODEL_S = 1.3;
const HEAD_S = 1.33; // heads larger than life against the chest, as busts are cut

function modelMan() {
  const HY = 33.6;
  const t = torso({ Wc: 19.5, F: 15.0, B: 12.0, sex: "m", neck: 5.6, slope: true });
  const rows = headRows(HY, {
    chin: 1.05, jaw: 1.1, lips: 0.6, nose: 1.0, ears: 0.6,
    edit(R) {
      // a full beard: the lower rings grow forward and wide, and hang below the chin
      const beard = {
        "-0.8": { cz: 5.2, F: 5.2, W: 6.2, B: 4.6 },
        "0.6": { cz: 4.2, F: 6.8, W: 7.6, B: 5.6 },
        "2": { cz: 3.2, F: 7.6, W: 8.2, B: 6.2 },
        "3.3": { cz: 2.4, F: 8.0, W: 8.4, B: 6.6, d: [] },
        "4.3": { cz: 1.9, F: 7.9, W: 8.3, B: 6.9, d: [] },
        "5.3": { cz: 1.5, F: 7.9, W: 8.0, B: 7.2, d: [[0, 0.5], [1, 0.7], [2, 0.3]] },
      };
      for (const r of R) if (beard[String(r.y)]) Object.assign(r, beard[String(r.y)]);
      R.unshift({ y: -2.6, cz: 5.8, F: 5.0, W: 5.4, B: 4.0 }, { y: -4.4, cz: 6.4, F: 3.4, W: 3.6, B: 2.6 });
      R.sort((a, b) => a.y - b.y);
      // a heavier brow and a lined forehead
      R.find((r) => r.y === 12.4).d = [[0, 0.3], [1, 0.85], [2, 0.35], [4.1, 0.6 * 0.6]];
      R.find((r) => r.y === 14.2).d = [[1, -0.25]];
      // thick hair: the upper rings swell
      for (const r of R) {
        if (r.y >= 16) {
          r.F += 0.6;
          r.W += 0.9;
          r.B += 0.9;
        }
      }
    },
  });
  const hairLine = (phi) => {
    const a = Math.abs(phi) / Math.PI; // 0 front, 1 back
    return HY + (a < 0.12 ? 17.4 : a < 0.3 ? lerp(17.4, 13.6, (a - 0.12) / 0.18) : a < 0.42 ? lerp(13.6, 10.5, (a - 0.3) / 0.12) : lerp(10.5, 4.5, (a - 0.42) / 0.58));
  };
  const beardTop = (phi) => {
    const a = Math.abs(phi) / Math.PI;
    if (a < 0.08) return HY + 3.0; // under the lower lip
    if (a < 0.2) return HY + 4.4; // the jaw, leaving the cheek bare
    if (a < 0.32) return HY + lerp(5.4, 10.5, (a - 0.2) / 0.12); // up to the sideburn
    return HY + 11;
  };
  // hair and beard in big curls of a few clear facets each, not a speckle of small ones
  // hair and beard as two masses of a dozen or so big clear planes each, not a speckle of curls
  const hair = shellMesh(rows, {
    cols: 10, rowsN: 3, wrap: true, seed: 18101, jit: 0.8, ridge: 0.8,
    yLo: (phi) => hairLine(phi) + 0.4,
    yHi: () => HY + 21.4,
    out: (s) => lerp(0.9, 2.6, Math.min(1, s * 1.6)),
    apex: [0, HY + 24.0, -0.8],
    centre: [0, HY + 12, -0.5],
  });
  const beardHi = (phi) => {
    const a = Math.abs(phi) / Math.PI;
    if (a < 0.08) return HY + 3.0;
    if (a < 0.2) return HY + lerp(3.0, 4.6, (a - 0.08) / 0.12);
    if (a < 0.3) return HY + lerp(4.6, 9.6, (a - 0.2) / 0.1);
    return HY + lerp(9.6, 3.0, clamp((a - 0.3) / 0.1, 0, 1));
  };
  const beard = shellMesh(rows, {
    cols: 6, rowsN: 2, phi0: -Math.PI * 0.4, phi1: Math.PI * 0.4, seed: 18102, jit: 0.8, ridge: 0.5,
    yLo: (phi) => HY - 4.0 + Math.abs(phi) * 1.2,
    yHi: beardHi,
    out: (s) => lerp(1.8, 0.5, s),
    tip: [0, HY - 7.4, 7.6],
    centre: [0, HY + 3, -1],
  });
  // the moustache: two locks sweeping down from under the nose
  const mrnd = rng(18103);
  const moustache = [-1, 1].map((s) => {
    const p = surfaceAt(rows, HY + 5.4, s * 0.32, 0.6);
    return curlMesh(p, norm3([s * 0.4, -0.1, 0.9]), 1.6, mrnd, 0.5);
  });
  return bigHead([...t.parts, neckPart(5.2, 25, HY + 9), { rings: rows, top: HY + 23.4, bottom: HY - 5.2, bottomZ: 6.6, toneFn: faceTone(HY, { mouth: false }) }, noseMesh(rows, HY, { len: 1.05, tip: 2.7 }), ...eyes(rows, HY, 18104), beard, ...moustache, hair], HY);
}

function modelYouth() {
  const HY = 30.8;
  const t = torso({ Wc: 18.5, F: 14.4, B: 11.6, sex: "y", neck: 5.2 });
  const rows = headRows(HY, {
    chin: 1.0, jaw: 0.95, lips: 1.0, nose: 0.95, ears: 1.0,
    edit(R) {
      for (const r of R) {
        if (r.y >= 17) {
          r.F += 0.3;
          r.W += 0.4;
          r.B += 0.4;
        }
      }
    },
  });
  const hairLine = (phi) => {
    const a = Math.abs(phi) / Math.PI;
    return HY + (a < 0.14 ? 17.6 : a < 0.26 ? lerp(17.6, 15.4, (a - 0.14) / 0.12) : a < 0.36 ? lerp(15.4, 12.6, (a - 0.26) / 0.1) : a < 0.5 ? 12.8 : lerp(10.8, 5.6, (a - 0.5) / 0.5));
  };
  const hair = lockField(rows, { y0: HY + 5.6, y1: HY + 22.2, spacing: 3.8, r: 2.2, seed: 18111, len: 1.7, sweep: 2.6, dir: -1, wide: 0.75, where: (y, phi) => y >= hairLine(phi) });
  return bigHead([...t.parts, neckPart(4.8, 25, HY + 9), { rings: rows, top: HY + 22.8, bottom: HY - 1.4, bottomZ: 4.6, toneFn: faceTone(HY) }, noseMesh(rows, HY, { len: 1.0, tip: 2.4 }), ...eyes(rows, HY, 18112), ...hair], HY);
}

function modelWoman() {
  const HY = 31.8;
  const t = torso({ Wc: 16.5, F: 13.6, B: 11.0, sex: "f", neck: 4.7 });
  const rows = headRows(HY, {
    chin: 0.9, jaw: 0.88, lips: 1.2, nose: 0.9, ears: 0,
    edit(R) {
      // hair parted in the middle, waved back over the ears, a band across the crown
      for (const r of R) {
        if (r.y >= 6.5) {
          const d = (r.d || []).filter(([c]) => c < 3.5);
          // the hair swells over the ears and round the back; the locks lie on it
          const k = clamp((r.y - 6.5) / 4, 0, 1);
          if (r.y >= 15.5) d.push([0, -0.3], [1, 0.3], [2, 0.5], [3, 0.6]);
          else d.push([3, 0.4 * k]);
          for (let c = 4; c <= 8; c += 1) d.push([c, 0.8 * Math.max(k, 0.6)]);
          r.d = d;
        }
      }
      R.push({ y: 18.9, cz: -0.6, F: 8.6, W: 7.9, B: 9.5, d: [[0, -0.2]] }, { y: 19.6, cz: -0.65, F: 8.0, W: 7.4, B: 9.0, d: [[0, -0.2]] });
      R.sort((a, b) => a.y - b.y);
    },
  });
  // the knot of hair at the back, bound with a band
  const bun = {
    rings: [
      { y: HY + 14.0, ...circ(2.6), cz: -8.6 },
      { y: HY + 15.2, ...circ(4.2), cz: -10.0, d: [[2, 0.4], [6, 0.4]] },
      { y: HY + 17.0, ...circ(4.8), cz: -10.6, d: [[1, 0.35], [3, 0.35], [5, 0.35], [7, 0.35]] },
      { y: HY + 19.0, ...circ(4.4), cz: -10.4, d: [[0, 0.3], [2, 0.3], [4, 0.3], [6, 0.3]] },
      { y: HY + 20.6, ...circ(2.8), cz: -9.8 },
    ],
    top: HY + 21.4,
    bottom: HY + 13.4,
    bottomZ: -8.0,
  };
  const hairLine = (phi) => {
    const a = Math.abs(phi) / Math.PI;
    return HY + (a < 0.1 ? 17.0 : a < 0.3 ? lerp(17.0, 13.2, (a - 0.1) / 0.2) : a < 0.42 ? lerp(13.2, 8.2, (a - 0.3) / 0.12) : lerp(8.2, 6.4, (a - 0.42) / 0.58));
  };
  // the hair in a few broad waves on each side, drawn from the parting back over the ears to the
  // knot: each wave a long ribbon with a lit crest and a shadowed underside
  const waves = [];
  for (const sg of [-1, 1]) {
    for (let v = 0; v < 4; v += 1) {
      const q = v / 3;
      const phiS = lerp(0.75, 0.12, q);
      const phiE = 2.72 - 0.08 * q;
      const yS = lerp(14.2, 21.0, q);
      const yE = lerp(15.0, 19.4, q);
      const dip = lerp(5.6, 2.2, q);
      const K = 7;
      const verts = [];
      for (let i = 0; i <= K; i += 1) {
        const t = i / K;
        const phi = sg * lerp(phiS, phiE, t);
        const y = HY + lerp(yS, yE, t) - dip * Math.sin(Math.PI * t);
        const w = lerp(1.1, 1.5, Math.sin(Math.PI * Math.min(1, t * 1.4))); // the waves meet in a groove
        const H = lerp(0.4, 1.6, Math.min(1, t * 3));
        verts.push(surfaceAt(rows, y + w, phi, 0.1)); // upper edge
        verts.push(surfaceAt(rows, y + w * 0.3, phi, H)); // the crest
        verts.push(surfaceAt(rows, y - w, phi, 0.3)); // lower edge, tucked under the next wave
      }
      const tris = [];
      for (let i = 0; i < K; i += 1) {
        const a0 = i * 3;
        const b0 = a0 + 3;
        tris.push([a0, b0, b0 + 1, 2 * i], [a0, b0 + 1, a0 + 1, 2 * i], [a0 + 1, b0 + 1, b0 + 2, 2 * i + 1], [a0 + 1, b0 + 2, a0 + 2, 2 * i + 1]);
      }
      waves.push({ mesh: { verts, tris, centre: [0, HY + 12, -0.5] }, zb: 1.2 });
    }
  }
  // a crescent diadem over the parting
  const drnd = rng(18123);
  const dc = surfaceAt(rows, HY + 19.2, 0, 0.9);
  const diadem = blobMesh(dc, [5.0, 0, -1.2], [0, 1.8, -0.7], [0, 0.4, 1.4], drnd, 0.04);
  return bigHead([...t.parts, neckPart(4.3, 25, HY + 9), { rings: rows, top: HY + 22.8, bottom: HY - 1.4, bottomZ: 4.6, toneFn: faceTone(HY) }, noseMesh(rows, HY, { len: 0.95, tip: 2.3 }), ...eyes(rows, HY, 18121), ...waves, bun, diadem], HY);
}

/** Blank classical eyes, set into the sockets under the brow. */
function eyes(rows, hy, seed) {
  const rnd = rng(seed);
  return [-1, 1].map((sg) => {
    const p0 = surfaceAt(rows, hy + 10.6, sg * 0.4, -0.1);
    const p1 = surfaceAt(rows, hy + 10.6, sg * 0.4, 1);
    const n = norm3(sub3(p1, p0));
    const t = norm3(cross3([0, 1, 0], n));
    const b = cross3(n, t);
    return blobMesh(p0, t.map((q) => q * 1.75), b.map((q) => q * 0.95), n.map((q) => q * 0.7), rnd, 0.05);
  });
}

/** The nose as a wedge of its own: a ridge from the brow to the tip, two flat sides, the wings
 *  and the underside, so it catches the pink light on one side and the cyan on the other. */
function noseMesh(rows, hy, { len = 1, tip = 2.5 } = {}) {
  const S = (y, phi, out) => surfaceAt(rows, hy + y, phi, out);
  const yTip = 11.4 - 4.3 * len;
  const verts = [
    S(11.6, 0, 0.15), // root
    S(10.9, -0.13, -0.1),
    S(10.9, 0.13, -0.1),
    S(yTip, 0, tip), // tip
    S(yTip - 0.3, -0.25, 0.45), // wings
    S(yTip - 0.3, 0.25, 0.45),
    S(yTip - 0.7, 0, 0.5), // under the tip
  ];
  const tris = [
    [0, 2, 3],
    [0, 3, 1],
    [1, 3, 4],
    [2, 5, 3],
    [4, 3, 6],
    [3, 5, 6],
  ];
  return { mesh: { verts, tris, centre: S(9.2, 0, -2.5) } };
}

/** Shadow in the carved hollows of a face: the eye sockets under the brow, the mouth. */
function faceTone(hy, { mouth = true } = {}) {
  return (g) => {
    const y = g[1] - hy;
    const phi = Math.abs(Math.atan2(g[0], g[2]));
    let t = 0;
    if (phi < 0.8 && phi > 0.12) t = Math.max(t, 0.5 * gauss(y - 10.6, 1.25) * gauss(phi - 0.42, 0.3));
    if (mouth && phi < 0.36) t = Math.max(t, 0.42 * gauss(y - 4.3, 0.55) * (1 - phi / 0.4));
    return t < 0.06 ? 0 : t;
  };
}

/** Scale the head and everything on it about the chin. */
function bigHead(parts, hy) {
  const xf = (v) => [v[0] * HEAD_S, hy + (v[1] - hy) * HEAD_S, v[2] * HEAD_S];
  return parts.map((p) => (p.body ? p : { ...p, xf }));
}

const MODELS = { man: modelMan, youth: modelYouth, woman: modelWoman };

const SOLIDS = {};
function solidFor(id) {
  if (!SOLIDS[id]) {
    const s = buildSolid(MODELS[id]());
    s.verts = s.verts.map((v) => v.map((c) => c * MODEL_S));
    SOLIDS[id] = s;
  }
  return SOLIDS[id];
}

// five views: profile left, three-quarter left, front, three-quarter right, profile right
const VIEW_YAW = [-90, -45, 0, 45, 90].map((d) => (d * Math.PI) / 180);
const PITCH = 0.1;

// marble lit pink from the upper left, cyan from the right; violet where neither reaches
const B_PINK = norm3([-0.75, 0.45, 0.48]);
const B_CYAN = norm3([0.9, 0.12, 0.2]);
const B_FLOOR = norm3([0.1, -1, 0.35]);
const ss = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// Coloured stone in mid tones, clearly darker than the pelican: violet and orchid planes, the
// pink key light only on the planes turned squarely to it, a cyan rim on the far side, deep
// violet in the hollows. No facet is paler than about #d79be8.
const BUST_LMAX = 0.299 * 215 + 0.587 * 155 + 0.114 * 232;
function facetColour(n, tone = 0) {
  const lp = dot3(n, B_PINK);
  const lc = dot3(n, B_CYAN);
  let col = [52, 18, 100]; // deep violet: turned away from both lights
  col = mix3(col, [104, 42, 164], ss(-0.45, 0.1, lp)); // purple
  col = mix3(col, [158, 72, 196], ss(0.1, 0.5, lp)); // orchid
  col = mix3(col, [212, 104, 214], ss(0.55, 0.78, lp)); // pink-orchid
  col = mix3(col, [236, 136, 214], ss(0.8, 0.95, lp)); // the pink key, on narrow planes only
  col = mix3(col, [58, 200, 236], ss(0.3, 0.75, lc) * (1 - 0.8 * ss(0.15, 0.55, lp))); // cyan rim
  // the glowing floor throws a little magenta up under the brows, nose and chin
  col = mix3(col, [128, 34, 140], ss(0.4, 0.95, dot3(n, B_FLOOR)) * 0.4);
  // carved hollows (eye sockets, the mouth) hold a deep violet whatever their direction
  if (tone > 0) col = mix3(col, [46, 14, 92], Math.min(1, tone * 1.3));
  // the sawn planes where the arms are cut: smoother and a little paler than the carved stone
  if (tone < 0) col = mix3(col, [196, 128, 224], 0.7);
  const l = 0.299 * col[0] + 0.587 * col[1] + 0.114 * col[2];
  if (l > BUST_LMAX) col = col.map((c) => (c * BUST_LMAX) / l);
  return col;
}

function projectSolid(solid, yaw) {
  const ca = Math.cos(yaw);
  const sa = Math.sin(yaw);
  const cp = Math.cos(PITCH);
  const sp = Math.sin(PITCH);
  const P = solid.verts.map((v) => {
    const x1 = v[0] * ca + v[2] * sa;
    const z1 = -v[0] * sa + v[2] * ca;
    return [x1, v[1] * cp - z1 * sp, z1 * cp + v[1] * sp];
  });
  const faces = [];
  // triangles grouped into one plane share the summed normal, so a bent quad reads as one facet
  const gsum = new Map();
  for (const [a, b, c, , , grp = -1] of solid.tris) {
    if (grp < 0) continue;
    const n = cross3(sub3(P[b], P[a]), sub3(P[c], P[a]));
    const s = gsum.get(grp) || [0, 0, 0];
    gsum.set(grp, [s[0] + n[0], s[1] + n[1], s[2] + n[2]]);
  }
  for (const [a, b, c, tone, zb = 0, grp = -1] of solid.tris) {
    const A = P[a];
    const B = P[b];
    const Cc = P[c];
    const n = norm3(cross3(sub3(B, A), sub3(Cc, A)));
    if (n[2] <= 0.0) continue;
    faces.push({ pts: [A, B, Cc], n: grp >= 0 ? norm3(gsum.get(grp)) : n, tone, z: (A[2] + B[2] + Cc[2]) / 3 + zb });
  }
  faces.sort((p, q) => p.z - q.z);
  return faces;
}

function paintBust(ctx, id, view) {
  const faces = projectSolid(solidFor(id), VIEW_YAW[view]);
  const path = (f) => {
    ctx.beginPath();
    ctx.moveTo(f.pts[0][0], -f.pts[0][1]);
    ctx.lineTo(f.pts[1][0], -f.pts[1][1]);
    ctx.lineTo(f.pts[2][0], -f.pts[2][1]);
    ctx.closePath();
  };
  ctx.lineJoin = "round";
  // the outline: every visible facet stroked wide in deep violet
  ctx.strokeStyle = C.violet;
  ctx.fillStyle = C.violet;
  ctx.lineWidth = 2.4;
  for (const f of faces) {
    path(f);
    ctx.stroke();
    ctx.fill();
  }
  ctx.lineWidth = 0.22;
  for (const f of faces) {
    const col = css(facetColour(f.n, f.tone));
    path(f);
    ctx.fillStyle = col;
    ctx.strokeStyle = col;
    ctx.fill();
    ctx.stroke();
  }
}

const BUST_BOX = { x0: -46, x1: 46, y0: -104, y1: 4 };

function bakeBust(stage, id, view) {
  const k = 4 * stage.s;
  const b = BUST_BOX;
  return stage.bake2d(`vapor/bust/${id}/${view}/${k.toFixed(3)}`, (b.x1 - b.x0) * k, (b.y1 - b.y0) * k, (ctx) => {
    ctx.scale(k, k);
    ctx.translate(-b.x0, -b.y0);
    paintBust(ctx, id, view);
  });
}

// the fluted half-column, faceted like everything else
const COL = { r: 16, rt: 15, plinth: 21, cap: 20 };

function paintColumn(ctx, H) {
  const sp = Math.sin(PITCH);
  ctx.fillStyle = "rgba(20,4,40,0.5)";
  ctx.beginPath();
  ctx.ellipse(0, 0.8, 30, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  const shade = (theta) => facetColour(norm3([Math.sin(theta), 0, Math.cos(theta)]));
  // a block (plinth or cap): faceted drum of 16 sides
  const drum = (yb, yt, r, sides = 16) => {
    const pts = [];
    for (let i = 0; i < sides; i += 1) {
      const a0 = -Math.PI / 2 + (i / sides) * Math.PI;
      const a1 = -Math.PI / 2 + ((i + 1) / sides) * Math.PI;
      const am = (a0 + a1) / 2;
      const x0 = r * Math.sin(a0);
      const x1 = r * Math.sin(a1);
      const d0 = r * Math.cos(a0) * sp;
      const d1 = r * Math.cos(a1) * sp;
      pts.push({ x0, x1, d0, d1, col: shade(am) });
    }
    ctx.lineWidth = 2.0;
    ctx.strokeStyle = C.violet;
    ctx.fillStyle = C.violet;
    ctx.beginPath();
    ctx.moveTo(-r, yb);
    ctx.lineTo(-r, yt);
    ctx.lineTo(r, yt);
    ctx.lineTo(r, yb);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    for (const p of pts) {
      ctx.beginPath();
      ctx.moveTo(p.x0, yb + p.d0);
      ctx.lineTo(p.x1, yb + p.d1);
      ctx.lineTo(p.x1, yt + p.d1);
      ctx.lineTo(p.x0, yt + p.d0);
      ctx.closePath();
      ctx.fillStyle = css(p.col);
      ctx.strokeStyle = css(p.col);
      ctx.lineWidth = 0.25;
      ctx.fill();
      ctx.stroke();
    }
    // top face
    ctx.beginPath();
    ctx.ellipse(0, yt, r, r * sp + 0.01, 0, 0, Math.PI * 2);
    ctx.fillStyle = css(facetColour(norm3([0, 1, 0.1])));
    ctx.fill();
    ctx.strokeStyle = "rgba(43,16,85,0.7)";
    ctx.lineWidth = 0.5;
    ctx.stroke();
  };
  drum(0, -6, COL.plinth);
  // the shaft: 12 flutes across the visible half, each a concave pair of facets
  const yb = -6;
  const yt = -H + 6;
  ctx.lineWidth = 2.0;
  ctx.strokeStyle = C.violet;
  ctx.fillStyle = C.violet;
  ctx.beginPath();
  ctx.moveTo(-COL.r, yb);
  ctx.lineTo(-COL.rt, yt);
  ctx.lineTo(COL.rt, yt);
  ctx.lineTo(COL.r, yb);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  const flutes = 10;
  for (let i = 0; i < flutes; i += 1) {
    const a0 = -Math.PI / 2 + (i / flutes) * Math.PI;
    const a1 = -Math.PI / 2 + ((i + 1) / flutes) * Math.PI;
    const am = (a0 + a1) / 2;
    const xs = (a, r) => r * Math.sin(a);
    // concave: the left half of the flute faces right, the right half faces left
    const halves = [
      [a0, am, am + 0.55],
      [am, a1, am - 0.55],
    ];
    for (const [p, q, nAng] of halves) {
      ctx.beginPath();
      ctx.moveTo(xs(p, COL.r), yb);
      ctx.lineTo(xs(q, COL.r), yb);
      ctx.lineTo(xs(q, COL.rt), yt);
      ctx.lineTo(xs(p, COL.rt), yt);
      ctx.closePath();
      const col = css(shade(nAng));
      ctx.fillStyle = col;
      ctx.strokeStyle = col;
      ctx.lineWidth = 0.25;
      ctx.fill();
      ctx.stroke();
    }
    // the arris between flutes catches the light
    if (i > 0) {
      ctx.strokeStyle = "rgba(255,236,250,0.55)";
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      ctx.moveTo(xs(a0, COL.r), yb);
      ctx.lineTo(xs(a0, COL.rt), yt);
      ctx.stroke();
    }
  }
  drum(-H + 6, -H, COL.cap);
}

function bakeColumn(stage, H = 51) {
  const k = 4 * stage.s;
  const x0 = -34;
  const x1 = 34;
  const y0 = -H - 6;
  const y1 = 6;
  const fb = stage.bake2d(`vapor/column/${H.toFixed(1)}/${k.toFixed(3)}`, (x1 - x0) * k, (y1 - y0) * k, (ctx) => {
    ctx.scale(k, k);
    ctx.translate(-x0, -y0);
    paintColumn(ctx, H);
  });
  return { fb, x0, y0, w: x1 - x0, h: y1 - y0 };
}

/** Which view a bust shows: decided on the last beat of tape time, from where the pelican was then. */
export function bustView(bustX, pelXAtBeat) {
  const dx = pelXAtBeat - bustX;
  return clamp(Math.round(dx / 83.333 + 2), 0, 4);
}

// ------------------------------------------------------------------ the title window

const SONG = "'Songti SC', 'STSong', 'Noto Serif CJK SC', serif";
const UI = "'Geneva', 'Lucida Grande', 'Helvetica Neue', sans-serif";

function paintWindow(ctx) {
  const { w, h } = WIN;
  // drop shadow on the sky
  ctx.fillStyle = "rgba(30,6,60,0.45)";
  ctx.fillRect(5, 5, w, h);
  // the bevelled frame
  ctx.fillStyle = "#d8cff0";
  ctx.fillRect(0, 0, w, h);
  const bevel = (x, y, ww, hh, light, dark, t) => {
    ctx.fillStyle = light;
    ctx.fillRect(x, y, ww, t);
    ctx.fillRect(x, y, t, hh);
    ctx.fillStyle = dark;
    ctx.fillRect(x, y + hh - t, ww, t);
    ctx.fillRect(x + ww - t, y, t, hh);
  };
  bevel(0, 0, w, h, "#ffffff", "#2b1055", 1.1);
  bevel(1.1, 1.1, w - 2.2, h - 2.2, "#f4efff", "#8a7ab0", 0.9);
  // title bar
  const tb = { x: 3.4, y: 3.4, w: w - 6.8, h: 12.4 };
  const g = ctx.createLinearGradient(tb.x, 0, tb.x + tb.w, 0);
  g.addColorStop(0, "#5b1fa6");
  g.addColorStop(0.55, "#b33ad0");
  g.addColorStop(1, "#ff79d6");
  ctx.fillStyle = g;
  ctx.fillRect(tb.x, tb.y, tb.w, tb.h);
  // the caption bar carries no text, only the close box, so PLAY and the counter never cross lettering
  // close box
  const cb = { x: tb.x + tb.w - 12.2, y: tb.y + 1.6, s: 9.2 };
  ctx.fillStyle = "#d8cff0";
  ctx.fillRect(cb.x, cb.y, cb.s, cb.s);
  bevel(cb.x, cb.y, cb.s, cb.s, "#ffffff", "#2b1055", 0.8);
  ctx.strokeStyle = "#2b1055";
  ctx.lineWidth = 1.3;
  ctx.lineCap = "square";
  ctx.beginPath();
  ctx.moveTo(cb.x + 2.7, cb.y + 2.7);
  ctx.lineTo(cb.x + cb.s - 2.7, cb.y + cb.s - 2.7);
  ctx.moveTo(cb.x + cb.s - 2.7, cb.y + 2.7);
  ctx.lineTo(cb.x + 2.7, cb.y + cb.s - 2.7);
  ctx.stroke();
  // client area, sunken
  const ca = { x: 4.4, y: 18.6, w: w - 8.8, h: h - 21.2 };
  ctx.fillStyle = "#fbf7ff";
  ctx.fillRect(ca.x, ca.y, ca.w, ca.h);
  bevel(ca.x, ca.y, ca.w, ca.h, "#8a7ab0", "#ffffff", 0.9);
  // three lines, all below y = 466 (window y 18), with a clear band between the second and
  // third (y 508 - 528) where the tracking bar of the skip runs, so it never crosses lettering
  const cx = w / 2;
  drawText(ctx, META.zh.split("").join(" "), cx + 1.1, 45.1, { font: font(SONG, 24, 900), align: "center", fill: "#ff9ad5", spacing: 9 });
  drawText(ctx, META.zh.split("").join(" "), cx, 44, { font: font(SONG, 24, 900), align: "center", fill: "#6a1fb0", spacing: 9 });
  drawText(ctx, "ＶＡＰＯＲＷＡＶＥ", cx, 59.6, { font: font(SONG, 13.6, 700), align: "center", fill: "#2b1055", spacing: 1.4 });
  // an etched separator across the middle of the client area
  for (const [dy, c] of [
    [0, "#8a7ab0"],
    [0.7, "#ffffff"],
  ]) {
    ctx.fillStyle = c;
    ctx.fillRect(ca.x + 22, 69.6 + dy, ca.w - 44, 0.7);
  }
  ctx.save();
  ctx.translate(cx, 70.3);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = "#fbf7ff";
  ctx.fillRect(-3.4, -3.4, 6.8, 6.8);
  ctx.strokeStyle = "#7b2cbf";
  ctx.lineWidth = 0.8;
  ctx.strokeRect(-2.4, -2.4, 4.8, 4.8);
  ctx.fillStyle = "#ff4fd8";
  ctx.fillRect(-1.1, -1.1, 2.2, 2.2);
  ctx.restore();
  drawText(ctx, `２０１０ｓ · ${META.date}`, cx, 91.2, { font: font(SONG, 13.6, 700), align: "center", fill: "#2b1055" });
}

function bakeWindow(stage) {
  const k = 3.6 * stage.s;
  const pad = 2;
  return stage.bake2d(`vapor/window/${k.toFixed(3)}`, (WIN.w + 2 * pad + 6) * k, (WIN.h + 2 * pad + 6) * k, (ctx) => {
    ctx.scale(k, k);
    ctx.translate(pad, pad);
    paintWindow(ctx);
  });
}

// ------------------------------------------------------------------ tape furniture: a 5x7 dot font

const GLYPHS = {
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  ":": ["..", "##", "##", "..", "##", "##", ".."],
  ">": ["#....", "##...", "###..", "####.", "###..", "##...", "#...."],
  " ": ["..", "..", "..", "..", "..", "..", ".."],
};
const CELL = 16 / 7; // glyphs 16 units tall

function glyphWidth(text) {
  let w = 0;
  for (const ch of text) w += (GLYPHS[ch][0].length + 1) * CELL;
  return w - CELL;
}

function dotText(ctx, text, x, y, fill, edge) {
  const e = 0.95; // a heavy dark edge, so PLAY stays legible where it crosses the window's title bar
  // dark edge and a drop to the lower right
  for (const [ox, oy, grow] of [
    [0.9, 0.9, e],
    [0, 0, e],
  ]) {
    ctx.fillStyle = edge;
    let cx = x;
    for (const ch of text) {
      const g = GLYPHS[ch];
      for (let r = 0; r < 7; r += 1) {
        for (let c = 0; c < g[r].length; c += 1) {
          if (g[r][c] === "#") ctx.fillRect(cx + c * CELL - grow + ox, y + r * CELL - grow + oy, CELL + 2 * grow, CELL + 2 * grow);
        }
      }
      cx += (g[0].length + 1) * CELL;
    }
  }
  ctx.fillStyle = fill;
  let cx = x;
  for (const ch of text) {
    const g = GLYPHS[ch];
    for (let r = 0; r < 7; r += 1) {
      for (let c = 0; c < g[r].length; c += 1) {
        if (g[r][c] === "#") ctx.fillRect(cx + c * CELL - 0.05, y + r * CELL - 0.05, CELL + 0.1, CELL + 0.1);
      }
    }
    cx += (g[0].length + 1) * CELL;
  }
}

export function counterText(tFilm) {
  const fr = Math.floor(tFilm * 30 + 1e-6);
  const ff = fr % 30;
  const sec = Math.floor(fr / 30);
  const ss = sec % 60;
  const mm = Math.floor(sec / 60) % 60;
  const hh = Math.floor(sec / 3600);
  const two = (v) => String(v).padStart(2, "0");
  return `${hh}:${two(mm)}:${two(ss)}:${two(ff)}`;
}

// ------------------------------------------------------------------ the tape pass

const TAPE_FRAG = `${FRAG_HEAD}
uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uK;       // pixels per world unit
uniform float uTy;      // view ty
uniform float uFrame;   // tape frame number
uniform float uSkip;    // 1 while the tape skips
uniform float uFringe;  // colour fringe offset, units
uniform float uWob;     // vertical wobble, units
uniform float uFlip;
${NOISE}
vec3 samp(vec2 p) {
  vec2 uv = clamp(p / uRes, 0.5 / uRes, 1.0 - 0.5 / uRes);
  if (uFlip > 0.5) uv.y = 1.0 - uv.y;
  return texture(uTex, uv).rgb;
}
void main() {
  vec2 px = vTexCoord * uRes;
  float wy = (px.y - uTy) / uK;
  float ux = (px.x - 0.5 * uRes.x) / uK;
  vec2 p = px;
  p.y -= uWob * uK;
  // faint per-line jitter
  float row = floor(wy * 1.3);
  p.x += (hash21(vec2(row, uFrame)) - 0.5) * 0.14 * uK;
  // head-switching noise along the very bottom
  float band = smoothstep(772.5, 776.5, wy);
  float br = floor(wy * 2.2);
  p.x += band * (hash21(vec2(br, uFrame * 1.7)) * 1.3 - 0.25) * 4.0 * uK;
  // the tracking bar of the skip
  float bar = 0.0;
  float barEdge = 0.0;
  if (uSkip > 0.5) {
    float e1 = (vnoise(vec2(ux * 0.11, uFrame * 0.7)) - 0.5) * 3.4 + (hash21(vec2(floor(ux * 0.6), uFrame)) - 0.5) * 1.5;
    float e2 = (vnoise(vec2(ux * 0.09 + 31.0, uFrame * 0.8)) - 0.5) * 3.4 + (hash21(vec2(floor(ux * 0.5) + 7.0, uFrame)) - 0.5) * 1.5;
    float top = 510.8 + e1;
    float bot = 524.8 + e2;
    bar = smoothstep(top - 0.4, top + 0.4, wy) * (1.0 - smoothstep(bot - 0.4, bot + 0.4, wy));
    barEdge = exp(-abs(wy - bot) * 0.5) * 0.6 + exp(-abs(wy - top) * 0.5) * 0.4;
    p.x += bar * (vnoise(vec2(wy * 0.7, uFrame * 2.3)) - 0.5) * 22.0 * uK;
    p.x += (1.0 - bar) * barEdge * (hash21(vec2(floor(wy * 2.0), uFrame)) - 0.5) * 3.0 * uK;
  }
  float f = uFringe * uK;
  float s = 0.32 * uK;
  vec3 c0 = samp(p);
  vec3 cl = samp(p - vec2(s, 0.0));
  vec3 cr = samp(p + vec2(s, 0.0));
  vec3 col = c0 * 0.5 + (cl + cr) * 0.25;
  // red one way, cyan the other
  float rr = samp(p - vec2(f, 0.0)).r;
  vec2 gb = samp(p + vec2(f * 0.8, 0.0)).gb;
  col.r = mix(col.r, rr, 0.8);
  col.gb = mix(col.gb, gb, 0.55);
  // colour bleeds a little to the right
  vec3 smear = samp(p - vec2(2.2 * uK, 0.0));
  col = mix(col, vec3(dot(col, vec3(0.3, 0.59, 0.11))) + (smear - vec3(dot(smear, vec3(0.3, 0.59, 0.11)))), 0.12);
  // the bar itself: bright, torn, streaked
  if (uSkip > 0.5) {
    float streak = hash21(vec2(floor(ux * 0.35), floor(wy * 1.4) + uFrame * 3.0));
    vec3 bright = mix(vec3(0.92, 0.86, 1.0), vec3(1.0, 0.75, 0.95), streak);
    col = mix(col, bright * (0.82 + 0.3 * streak), bar * 0.8);
    col += barEdge * 0.12;
  }
  // bottom band speckle
  float sn = hash21(floor(vec2(ux * 1.6, wy * 2.2)) + uFrame * 5.13);
  col = mix(col, vec3(0.92, 0.9, 1.0) * step(0.55, sn), band * 0.55 * step(0.35, sn));
  // scan lines, faded where they would be finer than the pixels
  float period = 1.15;
  float amp = 0.1 * smoothstep(2.0, 3.6, period * uK);
  col *= 1.0 - amp * (0.5 + 0.5 * cos(6.2831853 * wy / period));
  // grain
  float gr = hash21(floor(vec2(ux, wy) / 0.45) + vec2(uFrame * 7.31, uFrame * 3.17)) - 0.5;
  col += gr * 0.035;
  // a worn tape lifts the blacks
  col = col * 0.95 + vec3(0.025, 0.012, 0.035);
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

// ------------------------------------------------------------------ the pelican

function pelicanPalette(ctx, py) {
  const chrome = (y0, y1) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, "#b8f6ff");
    g.addColorStop(0.4, "#ffffff");
    g.addColorStop(0.49, "#ffffff");
    g.addColorStop(0.5, "#3a1a6a");
    g.addColorStop(0.56, "#ff79c8");
    g.addColorStop(1, "#ffd6a5");
    return g;
  };
  const legGrad = ctx.createLinearGradient(0, py - 62, 0, py - 8);
  legGrad.addColorStop(0, "#ffd0a0");
  legGrad.addColorStop(1, "#ffa066");
  const feather = ctx.createLinearGradient(0, py - 132, 0, py - 52);
  feather.addColorStop(0, "#ffffff");
  feather.addColorStop(0.5, "#fff2fb");
  feather.addColorStop(1, "#ffc4e8");
  return {
    ink: C.violet,
    feather,
    featherShade: "#f7b6e2",
    wingtip: "#7b2cbf",
    bill: "#ffd6a5",
    pouch: "#ff4fd8",
    leg: legGrad, // warm peach to orange, so the legs read against the cyan tubes and the grid
    legFar: "#d9774c",
    foot: "#ff9a5c",
    footFar: "#c9683e",
    frame: chrome(py - 64, py - 14),
    metal: chrome(py - 44, py),
    metalDark: "#8a6cc8",
    tire: C.violet,
    spoke: "#e6fbff",
    saddle: "#7b2cbf",
    bell: "#ffd6a5",
    reflector: "#ff4fd8",
  };
}

const REFLECT = {
  ink: "#e05cb8",
  feather: "#ff9ad5",
  featherShade: "#ff86cc",
  wingtip: "#c04aa8",
  bill: "#ffb3c8",
  pouch: "#ff6fd0",
  leg: "#ff9ad5",
  legFar: "#e080c0",
  foot: "#ff9ad5",
  footFar: "#e080c0",
  frame: "#ffb0dc",
  metal: "#ffb0dc",
  metalDark: "#d070b8",
  tire: "#d050b0",
  spoke: "#ffc0e0",
  saddle: "#c04aa8",
  bell: "#ffb3c8",
  reflector: "#ff6fd0",
};

function drawPelican(stage, view, pose, act) {
  const skel = solveRig({ ...pose, act });
  const b = skel.bounds;
  const patch = stage.patch("vapor/pelican", view, b.x0 - 4, b.y0 - 4, b.x1 + 4, Math.min(792, 2 * ROAD - b.y0));
  const ctx = patch.ctx;
  // the reflection on the grid: mirrored about the road, pink, soft, fading. Drawn sharp at half
  // resolution on its own canvas, then laid on the patch in one blurred pass (a canvas filter
  // on every shape would cost a blur per shape)
  const refl = stage.layer("vapor/pelican-refl", patch.w / 2, patch.h / 2);
  const rc = refl.clear();
  const m = ctx.getTransform();
  rc.setTransform(m.a / 2, 0, 0, m.d / 2, m.e / 2, m.f / 2);
  rc.transform(1, 0, 0, -1, 0, 2 * pose.y);
  drawPlain(rc, skel, { palette: REFLECT, outline: 0.04 });
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 0.42;
  ctx.imageSmoothingEnabled = true;
  ctx.filter = `blur(${(0.6 * view.k).toFixed(2)}px)`;
  ctx.drawImage(refl.canvas, 0, 0, refl.w * 2, refl.h * 2);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  const fade = ctx.createLinearGradient(0, pose.y, 0, pose.y + 58);
  fade.addColorStop(0, "rgba(0,0,0,0.15)");
  fade.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = fade;
  ctx.fillRect(b.x0 - 10, pose.y, b.x1 - b.x0 + 20, 120);
  ctx.restore();
  // the pelican itself
  drawPlain(ctx, skel, { palette: pelicanPalette(ctx, pose.y), outline: 0.05, halo: { color: C.violet, width: 1.3 / skel.scale } });
  stage.imagePatch(patch);
  return skel;
}

// ------------------------------------------------------------------ the scene

function layerView(k, cpx, camX, p, ty) {
  return new View(k, cpx - camX * p * k, ty);
}

export const vapor = {
  ...META,
  still: { u: 3.2, cx: 615 },

  init(stage) {
    bakeSky(stage);
    bakeSun(stage);
    bakeClouds(stage);
    for (const m of MTN) bakeMountains(stage, m);
    for (const pl of PALMS) bakePalm(stage, pl);
    for (const b of BUSTS) bakeColumn(stage, BUST_BASE - b.colTop);
    for (const b of BUSTS) for (let v = 0; v < 5; v += 1) bakeBust(stage, b.id, v);
    bakeWindow(stage);
  },

  render(stage, f) {
    const { p } = stage;
    const u = f.u;
    const skipping = u >= 3 && u < 4;
    const T = skipping ? snap(tape(u), 1e5) : u;
    const pelT = skipping ? f.film.pelicanFor(f.n, T0 + T) : f.pelican;
    const k = f.view.k;
    const ty = f.view.ty;
    const cpx = f.w / 2;
    const camX = f.view.wx(cpx);
    const camXT = snap(camX - (f.pelican.x - pelT.x), 4096);
    const tv = layerView(k, cpx, camXT, 1, ty); // the world at tape time
    const halfW = f.w / 2 / k;

    const pre = stage.fb(`vapor/pre/${f.w}x${f.h}`, f.w, f.h);
    stage.into(pre, () => {
      p.background(...RGB.violet);

      // sky
      const sky = bakeSky(stage);
      stage.withView(layerView(k, cpx, camXT, 0, ty), () => stage.image(sky.fb, sky.x, sky.y, sky.w, sky.h));

      // sun: nearly fixed, kept to the right of the pelican
      const sun = bakeSun(stage);
      const sunDX = f.still ? halfW * 0.6 : SUN.x - SUN_P * camXT; // offset from the camera centre
      stage.withView(layerView(k, cpx, camXT, 0, ty), () => stage.image(sun.fb, sunDX - sun.ox, SUN.y - sun.oy, sun.w, sun.h));

      const cl = bakeClouds(stage);
      stage.withView(layerView(k, cpx, camXT, CLOUD_P, ty), () => stage.image(cl.fb, cl.x, cl.y, cl.w, cl.h));

      for (const m of MTN) {
        const mt = bakeMountains(stage, m);
        stage.withView(layerView(k, cpx, camXT, m.p, ty), () => stage.image(mt.fb, mt.x, mt.y, mt.w, mt.h));
      }

      // grid floor
      const vb = tv.bounds(f.w, f.h);
      const gx0 = vb.x0 - 2;
      const gx1 = vb.x1 + 2;
      const gy0 = HORIZON;
      const gy1 = Math.max(802, vb.y1 + 2);
      const sh = stage.shader("vapor/grid", VERT, GRID_FRAG);
      stage.withView(tv, () =>
        stage.shaderRect(
          sh,
          { uOrigin: [gx0, gy0], uSize: [gx1 - gx0, gy1 - gy0], uCamX: camXT, uSunX: camXT + sunDX, uPx: k },
          gx0,
          gy0,
          gx1 - gx0,
          gy1 - gy0,
        ),
      );

      // palms
      const pv = layerView(k, cpx, camXT, PALM_P, ty);
      for (const pl of PALMS) {
        const X = pl.x * PALM_P;
        const sx = pv.x(X);
        if (sx < -300 * k || sx > f.w + 300 * k) continue;
        const sp = bakePalm(stage, pl);
        stage.withView(pv, () => stage.image(sp.fb, X + sp.x0, PALM_BASE + sp.y0, sp.w, sp.h));
      }

      // columns and busts
      const bv = layerView(k, cpx, camXT, BUST_P, ty);
      const beatT = Math.floor(T / 0.5 + 1e-6) * 0.5;
      const pelBeatX = f.film ? f.film.pelicanFor(f.n, T0 + beatT).x : pelT.x;
      for (const b of BUSTS) {
        const X = b.x * BUST_P;
        const sx = bv.x(X);
        if (sx < -100 * k || sx > f.w + 100 * k) continue;
        const view = bustView(b.x, pelBeatX);
        const img = bakeBust(stage, b.id, view);
        const bb = BUST_BOX;
        const col = bakeColumn(stage, BUST_BASE - b.colTop);
        stage.withView(bv, () => {
          stage.image(col.fb, X + col.x0, BUST_BASE + col.y0, col.w, col.h);
          stage.image(img, X + bb.x0, b.colTop + bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0);
        });
      }

      // title window, fixed in the world
      const win = bakeWindow(stage);
      stage.withView(tv, () => stage.image(win, WIN.x - 2, WIN.y - 2, WIN.w + 10, WIN.h + 10));

      // the pelican and its reflection
      if (pelT.visible) {
        const look = smoothstep(1.6, 2.4, T) * (1 - smoothstep(4.3, 5.0, T));
        drawPelican(stage, tv, pelT, { wind: 0.9, eyeX: 0.65 * look });
      }

      // tape furniture, travelling with the pelican
      const anchor = f.still ? camXT : pelT.x;
      const span = f.still ? Math.min(282, halfW - 12) : 282;
      const counter = counterText(T0 + T);
      const fp = stage.patch("vapor/osd", tv, anchor - span - 4, 442, anchor + span + 4, 466);
      const flick = skipping && !f.still ? (Math.floor(T * 24) % 3 === 1 ? 0 : 1) : 1;
      if (flick) dotText(fp.ctx, "> PLAY", anchor - span, 446, "#ffffff", "rgba(26,8,52,0.92)");
      dotText(fp.ctx, counter, anchor + span - glyphWidth(counter), 446, "#ffffff", "rgba(26,8,52,0.92)");
      stage.imagePatch(fp);
    });

    // the tape pass
    stage.origin();
    const edge = smoothstep(0.3, 1.0, T) * (1 - smoothstep(5.0, 5.7, T));
    const tsh = stage.shader("vapor/tape", VERT, TAPE_FRAG);
    stage.shaderRect(
      tsh,
      {
        uTex: pre,
        uRes: [f.w, f.h],
        uK: k,
        uTy: ty,
        uFrame: Math.floor(T * 30 + 1e-6),
        uSkip: skipping ? 1 : 0,
        uFringe: skipping ? 1.25 : 0.55,
        uWob: 0.5 * wobble(T * 0.7, 1818) * edge,
        uFlip: 0,
      },
      0,
      0,
      f.w,
      f.h,
    );
  },
};

export const vaporDev = { MODELS, VIEW_YAW, paintBust, solidFor, projectSolid, facetColour, BUST_BOX, bakeBust, bakeColumn, BUSTS };
