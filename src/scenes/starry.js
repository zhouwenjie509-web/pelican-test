// Section 12. Van Gogh, The Starry Night, 1889.
//
// Oil paint laid on thick in short directional strokes. The night sky is a
// fragment shader: stroke-shaped cells laid along the flow lines of a double
// spiral, eleven star-rings, the moon's halo and a slow drift elsewhere, each
// cell with its own colour, a lit edge, a shadowed edge and a second colour
// dragged through it. The sky is geared to the bicycle: every ring and spiral
// turns by an angle proportional to the wheel angle, so when the pelican
// slows in bar 2 the heavens wind down with it, and when it races they race.
//
// Layers:
//   sky      per frame, SKY_FRAG (world-anchored, phase from f.pelican.wheel)
//   land     baked once: LAND_FRAG (hills, fields, cypress, lane, foreground)
//            plus a 2D canvas pass of dabs (village, church, signature title)
//   pelican  per frame, a 2D patch of dabs in the puppet's own coordinates

import { sectionMeta } from "./sections.js";
import { View, Layer2D } from "../kit/stage.js";
import { VERT, FRAG_HEAD, NOISE } from "../kit/glsl.js";
import { hash } from "../kit/rng.js";
import { solveRig } from "../rig/rig.js";
import { traceShape } from "../rig/skins/plain.js";
import { SPEED, WHEEL_R } from "../main/layout.js";
import { clamp, smoothstep } from "../beat/ease.js";

const META = sectionMeta(12);
const TAU = Math.PI * 2;

// painted area (world units): wider and taller than the section, so no edge shows
const SKY = { x0: -80, y0: 418, x1: 1080, y1: 712 };
const LAND = { x0: -80, y0: 432, x1: 1080, y1: 808 };
const LAND_PX = 3.3; // cached pixels per unit at 1080p
const OVER = { y0: 540, y1: 792 }; // the canvas pass of the bake (village, title)
const CHURCH_X = 722; // a small church on the hillside; its spire tip (y 607) stays below the head
const VERGE = { x0: -110, x1: 1110, y0: 650, y1: 697 }; // the calm pale ground behind the wheels, the whole width
// the top of the field (the foot of the hillside), as the land shader draws it
const hillNJ = (x) => 640 - 42 * smoothstep(-80, 1080, x) + 9 * Math.sin(x / 83 + 0.4) + 5 * Math.sin(x / 31 + 2.1) + 22 + 7 * Math.sin(x / 57 + 1.3) + 3 * Math.sin(x / 23);
const fieldTop = (x) => Math.min(hillNJ(x) + 7, 652 + 1.5 * Math.sin(x / 23));
// where the village stands: on the field's edge, but never so high on the
// eastern rise that a roof comes near the pelican's bill (house tops stay below y 609)
const villageFoot = (x) => Math.max(fieldTop(x), 640);

// ------------------------------------------------------------------ motion (bar 2)
// Pace as a fraction of the standard speed, eased between segments with a
// smoothstep, integrated in closed form. Total over 6 s is exactly 6.
const RACE = 1.46;
const CRAWL = (3.05 - 2 * RACE) / 1.05; // 0.1238, about one eighth
const PACE = [
  [0, 2.2, 1, 1],
  [2.2, 2.9, 1, CRAWL],
  [2.9, 3.3, CRAWL, CRAWL],
  [3.3, 3.9, CRAWL, RACE],
  [3.9, 5.3, RACE, RACE],
  [5.3, 5.9, RACE, 1],
  [5.9, 6.0, 1, 1],
];

function paceAt(u) {
  for (const [a, b, g0, g1] of PACE) {
    if (u <= b) {
      const s = clamp((u - a) / (b - a));
      return g0 + (g1 - g0) * s * s * (3 - 2 * s);
    }
  }
  return 1;
}

function motionX(u) {
  if (u <= 0) return SPEED * u;
  let x = 0;
  for (const [a, b, g0, g1] of PACE) {
    const d = b - a;
    if (u >= b) {
      x += d * (g0 + (g1 - g0) / 2);
      continue;
    }
    const s = (u - a) / d;
    x += d * (g0 * s + (g1 - g0) * (s * s * s - (s * s * s * s) / 2));
    return SPEED * x;
  }
  return SPEED * (x + (u - 6));
}

// ------------------------------------------------------------------ the sky races ahead of its gears
// During the race the spirals and small star-rings run ahead of the true
// gearing, up to 1.7 times: enough that the heavens plainly race, little enough
// that no stroke moves more than 0.4 of its own length in a 60 fps frame, so
// nothing strobes. The great pale star, whose outer strokes travel furthest,
// stays exactly in gear. The extra angle (in wheel
// radians) is the integral of boost(u) x the wheel's angular speed, tabulated
// once and read by linear interpolation: continuous, a pure function of u,
// zero before u = 3.3 and constant (so exactly in gear) from u = 5.9.
const SKY_BOOST = 0.7;
function boostAt(u) {
  return SKY_BOOST * smoothstep(3.3, 3.9, u) * (1 - smoothstep(5.3, 5.9, u));
}
const EXTRA = (() => {
  const u0 = 3.2;
  const u1 = 6.0;
  const n = 1680;
  const du = (u1 - u0) / n;
  const tab = new Float64Array(n + 1);
  const rate = (u) => (boostAt(u) * paceAt(u) * SPEED) / WHEEL_R;
  for (let i = 1; i <= n; i += 1) {
    const a = u0 + (i - 1) * du;
    tab[i] = tab[i - 1] + ((rate(a) + 4 * rate(a + du / 2) + rate(a + du)) * du) / 6;
  }
  return { u0, u1, n, du, tab };
})();
function extraWheel(u) {
  const E = EXTRA;
  if (!(u > E.u0)) return 0;
  if (u >= E.u1) return E.tab[E.n];
  const s = (u - E.u0) / E.du;
  const i = Math.min(E.n - 1, Math.floor(s));
  return E.tab[i] + (E.tab[i + 1] - E.tab[i]) * (s - i);
}

// ------------------------------------------------------------------ palette
const C = {
  prussian: "#16306b",
  ultra: "#2a4f9e",
  cobalt: "#5f8fd0",
  pale: "#a9c6e6",
  teal: "#2f7f86",
  white: "#f3f1e6",
  chrome: "#f4c430",
  orange: "#e98a1f",
  cypress: "#12241c",
  ink: "#0e1d45", // the dark blue contour van Gogh drew his figures with
  roof: "#8a4a2e",
};

// ------------------------------------------------------------------ shared GLSL: one loaded stroke
const STROKE_LIB = `
#define TAU 6.2831853
const vec2 LIGHT = vec2(-0.55, -0.835);
const vec3 P0 = vec3(0.086, 0.188, 0.420);
const vec3 P1 = vec3(0.165, 0.310, 0.620);
const vec3 P2 = vec3(0.373, 0.561, 0.816);
const vec3 P3 = vec3(0.663, 0.776, 0.902);
const vec3 P4 = vec3(0.184, 0.498, 0.525);
const vec3 WH = vec3(0.955, 0.950, 0.900);
const vec3 YE = vec3(0.957, 0.769, 0.188);
const vec3 OR = vec3(0.914, 0.541, 0.122);
const vec3 YG = vec3(0.800, 0.840, 0.470);
const vec3 PY = vec3(0.985, 0.930, 0.640);

// One loaded stroke at (a, b): a along it, b across it, in world units from
// its centre. dS/dT: world directions of a and b. Lh/Wh: half length and width.
// acc is premultiplied colour; the stroke is painted over it.
void paintStroke(inout vec4 acc, float a, float b, vec2 dS, vec2 dT, float Lh, float Wh, vec3 c1, vec3 c2, float h) {
  float ta = a / Lh;
  float taper = mix(1.06, 0.72, smoothstep(-0.4, 1.0, ta));
  float tb = b / (Wh * taper);
  float e = pow(abs(ta), 3.6) + tb * tb;
  if (e >= 1.7) return;
  // a ragged edge and a dry, broken tail where the brush lifted, in the stroke's own frame
  float px = Wh * uPx;
  float rough = vnoise(vec2(ta * 3.0 + h * 31.0, tb * 1.6 + h * 7.0)) - 0.5;
  e += rough * 0.75 * smoothstep(1.5, 4.0, px * 0.5);
  float br = fract(tb * 1.6 + h * 5.0);
  e += smoothstep(0.2, 0.95, ta) * smoothstep(0.55, 0.7, br) * 0.9 * smoothstep(2.0, 4.0, px * 0.4);
  // the ridge casts a little shadow on the paint beneath, away from the light
  float side = dot(dT * sign(tb), LIGHT);
  float shd = (1.0 - smoothstep(1.0, 1.6, e)) * smoothstep(0.15, -0.6, side) * step(1.0, e) * step(abs(ta), 0.98);
  acc.rgb *= 1.0 - 0.22 * shd * acc.a;
  if (e >= 1.0) return;
  float aa = 2.2 / max(Wh * taper * uPx, 0.6);
  float cov = 1.0 - smoothstep(1.0 - aa, 1.0, e);
  float hgt = sqrt(1.0 - e);
  vec2 n = dT * tb + dS * sign(ta) * pow(abs(ta), 3.0) * 0.7;
  float lit = dot(n, LIGHT);
  // a second colour dragged through it, strongest where the brush first touched
  float sw = 0.42 * Wh * uPx;                       // streak width in pixels
  float fine = smoothstep(1.4, 3.0, sw);
  float st = smoothstep(0.52, 0.64, fract(tb * 0.7 + h * 9.13)) * (1.0 - smoothstep(-0.1, 1.0, ta));
  vec3 c = c1 * (0.92 + 0.16 * fract(h * 41.7));
  c = mix(c, c2, st * 0.85 * fine + 0.14 * (1.0 - fine));
  // bristle grooves, faded when finer than two pixels
  float groove = sin((tb * 3.2 + h * 2.0) * 3.14159);
  c *= 1.0 + 0.16 * groove * smoothstep(2.0, 4.0, 0.62 * Wh * uPx);
  // finer bristle marks, scratched along the stroke and wandering a little
  float bristle = sin((tb * 7.3 + 0.35 * sin(ta * 2.3 + h * 6.0) + h * 5.0) * 3.14159);
  c *= 1.0 + 0.09 * bristle * smoothstep(3.0, 5.0, 2.0 * Wh * uPx / 7.3);
  // relief: lit edge, shadowed edge, a gleam on the crest
  c *= 1.0 + 0.22 * lit;
  c += 0.06 * smoothstep(0.45, 0.9, lit) * hgt;
  c *= 1.0 - 0.2 * smoothstep(0.6, 1.0, e) * smoothstep(0.0, -0.5, lit);
  acc.rgb = mix(acc.rgb, clamp(c, 0.0, 1.0), cov);
  acc.a = acc.a + (1.0 - acc.a) * cov;
}

vec3 pick(float x, vec3 a, vec3 b, vec3 c, vec3 d, vec3 w) {
  return x < w.x ? a : x < w.y ? b : x < w.z ? c : d;
}

// Strokes laid along a family of parallel bands: t across (gradient g), s along.
// sAxis is the world direction in which s grows. Returns nothing; paints acc.
// Region tests and colours come from the caller through the macro BAND_BODY.
`;

// The linear band loop, generated as GLSL text so each region can plug in its
// own ownership test and colours (GLSL has no function pointers). Inside BODY:
// j, i, h, hj, h2, pc (stroke centre), a, b, Lh, Wh; it sets c1, c2 and own.
function bandLoop(ACC, P, T, G, S, SAXIS, BW, SL, SEED, BODY) {
  return `{
  vec2 G_ = ${G};
  float glen = max(length(G_), 0.25);
  vec2 dT = G_ / glen;
  vec2 dS = vec2(dT.y, -dT.x);
  if (dot(dS, ${SAXIS}) < 0.0) dS = -dS;
  float cosA = max(abs(dot(dS, ${SAXIS})), 0.35);
  float T_ = ${T};
  float S_ = ${S};
  float jb = floor(T_ / ${BW});
  for (int dj = -1; dj <= 1; dj++) {
    float j = jb + float(dj);
    float hj = hash21(vec2(j, ${SEED}));
    float tc = (j + 0.5) * ${BW} + (hj - 0.5) * ${BW} * 0.4;
    float ph = S_ / ${SL} + hj * 3.7;
    float ib = floor(ph);
    for (int di = -1; di <= 1; di++) {
      float i = ib + float(di);
      float im = mod(i, 4096.0);
      float h = hash21(vec2(j * 7.31 + ${SEED}, im + 0.37));
      float h2 = hash21(vec2(im * 1.71 + 3.0, j + ${SEED} * 0.5));
      float cen = i + 0.5 + (h - 0.5) * 0.35;
      float a = (ph - cen) * ${SL} / cosA;
      float bb = (T_ - tc) / glen;
      vec2 pc = ${P} - dS * a - dT * bb;
      float b = bb + a * (h2 - 0.5) * 0.22 + a * a * (h - 0.5) * 0.03;
      float Lh = ${SL} * (0.62 + 0.3 * h2);
      float Wh = ${BW} * (0.62 + 0.18 * fract(h * 7.3));
      vec3 c1 = P1; vec3 c2 = P2; bool own = true;
      ${BODY}
      if (own) paintStroke(${ACC}, a, b, dS, dT, Lh, Wh, c1, c2, h);
    }
  }
}`;
}

// ------------------------------------------------------------------ the sky
const STARS = [
  // x, y, radius, sense, big
  [262, 500, 46, 1, 1], // every star keeps 28+ units clear of the head's path (y 577 - 587)
  [92, 466, 22, -1, 0],
  [362, 466, 21, -1, 0],
  [330, 532, 15, 1, 0],
  [664, 452, 21, 1, 0],
  [712, 528, 19, -1, 0],
  [770, 470, 17, -1, 0],
  [944, 526, 22, 1, 0],
  [962, 452, 18, -1, 0],
  [40, 530, 18, 1, 0],
  [1012, 498, 15, -1, 0],
];
const SPIRAL_A = [458, 516];
const SPIRAL_B = [590, 532];
const MOON = [852, 494]; // the halo (R 38) stays clear of the frame (433) at every zoom

const glv = (v) => `vec2(${v[0].toFixed(1)}, ${v[1].toFixed(1)})`;

const SKY_FRAG = `${FRAG_HEAD}
uniform vec2 uOrigin;
uniform vec2 uSize;
uniform float uPx;
uniform float uSpin;   // spiral angle (radians)
uniform float uStar;   // star-ring angle
uniform float uStarB;  // the great star's angle (always in gear)
uniform float uMoon;   // halo angle
uniform float uDrift;  // drift along the background flow (units)
${NOISE}
${STROKE_LIB}

const vec2 SA = ${glv(SPIRAL_A)};
const vec2 SB = ${glv(SPIRAL_B)};
const vec2 MO = ${glv(MOON)};

vec3 underpaint(vec2 p) {
  float wv = sin(p.x * TAU / 1.4) * sin(p.y * TAU / 1.4) * smoothstep(2.5, 5.0, 1.4 * uPx);
  float bare = smoothstep(0.64, 0.72, fbm(p / 23.0 + 5.0));
  vec3 base = vec3(0.05, 0.085, 0.21) * (1.0 + 0.12 * wv);
  vec3 canvas = vec3(0.85, 0.81, 0.69) * (1.0 + 0.07 * wv);
  return mix(base, canvas, bare * 0.9);
}

// the stream function of the background drift: horizontal, bending round the vortices
float flowT(vec2 p) {
  float t = p.y + 5.0 * sin(p.x * 0.018 + 0.7) + 3.0 * sin(p.x * 0.043 + p.y * 0.02 + 1.9);
  vec2 a = p - SA; vec2 b = p - SB; vec2 s = p - ${glv(STARS[0])}; vec2 m = p - MO;
  t += 11.0 * log(dot(a, a) + 400.0) - 11.0 * log(dot(b, b) + 400.0);
  t += 5.0 * log(dot(s, s) + 200.0) - 4.0 * log(dot(m, m) + 300.0);
  return t;
}

// The great wave's stream function: a level flow with a strong vortex pair
// (opposite senses) laid in it, so the stream lines heave up over one vortex,
// dive between them and roll under the other: an S.
const vec2 WC = vec2(520.0, 522.0);
const vec2 WR = vec2(265.0, 108.0);
float waveT(vec2 p) {
  vec2 a = p - SA; vec2 b = p - SB;
  float t = p.y + 4.0 * sin(p.x * 0.021 + 0.4);
  t += 34.0 * log(dot(a, a) + 1500.0) - 30.0 * log(dot(b, b) + 1300.0);
  return t;
}

// Rings of strokes round a centre: stars and the moon's halo.
// kind 0: star, 1: the great pale star, 2: the moon
void rings(inout vec4 acc, vec2 p, vec2 c, float A, float bw, float sl, float R, float kind, float seed) {
  vec2 q = p - c;
  float r = length(q);
  if (r > R + bw * 1.6) return;
  float th = atan(q.y, q.x) - A;
  vec2 dT = q / max(r, 1e-3);
  vec2 dS = vec2(-dT.y, dT.x);
  float jb = floor(r / bw);
  for (int dj = -1; dj <= 1; dj++) {
    float j = jb + float(dj);
    if (j < 0.0) continue;
    float hj = hash21(vec2(j, seed));
    float rc = (j + 0.5) * bw + (hj - 0.5) * bw * 0.35;
    if (rc > R) continue;
    float N = max(3.0, floor(TAU * rc / sl + 0.5));
    float segL = TAU * rc / N;
    float ph = th / TAU * N + hj * 7.0;
    float ib = floor(ph);
    for (int di = -1; di <= 1; di++) {
      float i = ib + float(di);
      float im = mod(i, N);
      float h = hash21(vec2(j * 31.7 + seed, im + 3.1));
      float edge = smoothstep(R - 2.2 * bw, R, rc);
      if (h < edge * 0.75) continue;                       // ragged outer edge
      float cen = i + 0.5 + (h - 0.5) * 0.3;
      float a = (ph - cen) * segL;
      float b = r - rc + a * (fract(h * 5.3) - 0.5) * 0.15;
      float Lh = segL * (0.62 + 0.28 * fract(h * 13.1));
      float Wh = bw * (0.64 + 0.18 * fract(h * 7.3));
      float f = rc / R;
      float x = fract(h * 3.3 + hj);
      vec3 c1; vec3 c2;
      if (kind < 0.5) {
        if (f < 0.26) { c1 = x < 0.6 ? WH : PY; c2 = YE; }
        else if (f < 0.46) { c1 = x < 0.65 ? YE : PY; c2 = OR; }
        else if (f < 0.7) { c1 = mod(j, 2.0) < 1.0 ? (x < 0.7 ? P3 : WH) : (x < 0.6 ? PY : YE); c2 = P3; }
        else { c1 = x < 0.45 ? P2 : x < 0.8 ? P3 : YG; c2 = P1; }
      } else if (kind < 1.5) {
        if (f < 0.2) { c1 = x < 0.7 ? WH : PY; c2 = P3; }
        else if (f < 0.38) { c1 = x < 0.55 ? PY : x < 0.85 ? WH : YE; c2 = P3; }
        else if (f < 0.75) { c1 = mod(j, 2.0) < 1.0 ? (x < 0.6 ? P3 : WH) : (x < 0.5 ? P2 : P3); c2 = WH; }
        else { c1 = x < 0.5 ? P2 : x < 0.85 ? P3 : P4; c2 = P1; }
      } else {
        // the moon: a thick orange crescent, a C open to the upper right,
        // inside a smaller disc of yellow-green light, in a blaze of yellow
        float thc = (cen - hj * 7.0) / N * TAU + A;
        vec2 pc = c + rc * vec2(cos(thc), sin(thc));
        float dIn = length(pc - (c + vec2(6.6, -5.0)));
        bool cres = rc < 17.5 && dIn > 14.6;
        if (cres) { c1 = x < 0.55 ? vec3(0.93, 0.45, 0.07) : x < 0.85 ? OR : vec3(0.97, 0.62, 0.14); c2 = vec3(0.99, 0.74, 0.22); }
        else if (rc < 21.0) { c1 = x < 0.6 ? vec3(0.78, 0.84, 0.50) : x < 0.9 ? vec3(0.68, 0.76, 0.42) : PY; c2 = vec3(0.86, 0.90, 0.62); }
        else if (f < 0.72) { c1 = x < 0.45 ? PY : x < 0.8 ? vec3(0.97, 0.86, 0.42) : YG; c2 = WH; }
        else if (f < 0.86) { c1 = mod(j, 2.0) < 1.0 ? YG : (x < 0.5 ? P3 : P2); c2 = YE; }
        else { c1 = x < 0.6 ? P2 : x < 0.8 ? YG : P1; c2 = P1; }
      }
      paintStroke(acc, a, b, dS, dT, Lh, Wh, c1, c2, h);
    }
  }
}

// An Archimedean spiral of strokes: M bands per winding of pitch 'pitch'.
// The arc coordinate is unwrapped, so strokes run continuously round and round.
void spiral(inout vec4 acc, vec2 p, vec2 c, float A, float sense, float pitch, float M, float sl, float R, float seed) {
  vec2 q = p - c;
  float r = length(q);
  if (r > R + pitch) return;
  float th = sense * atan(q.y, q.x) - A;
  float bw = pitch / M;
  float k = floor(r / pitch - th / TAU + 0.5);
  float Th = th + TAU * k;
  float tt = r - pitch * Th / TAU;
  vec2 dT = q / max(r, 1e-3);
  vec2 dS = vec2(-dT.y, dT.x) * sense;
  float jb = floor((tt + pitch * 0.5) / bw);
  for (int dj = -1; dj <= 1; dj++) {
    float j = jb + float(dj);
    float ThL = Th;
    if (j < 0.0) { j += M; ThL -= TAU; }
    if (j >= M) { j -= M; ThL += TAU; }
    float hj = hash21(vec2(j, seed));
    float tc = -pitch * 0.5 + (j + 0.5) * bw;
    float rc = tc + pitch * ThL / TAU;
    if (rc < 2.0) continue;
    float sig = tc * ThL + pitch * ThL * ThL / (2.0 * TAU);
    float ph = sig / sl + hj * 5.0;
    float ib = floor(ph);
    for (int di = -1; di <= 1; di++) {
      float i = ib + float(di);
      float h = hash21(vec2(j * 17.3 + seed, i + 0.5));
      float cen = i + 0.5 + (h - 0.5) * 0.3;
      float sc = (cen - hj * 5.0) * sl;
      float rcc = sqrt(max(tc * tc + 2.0 * pitch * sc / TAU, 0.0));
      float edge = smoothstep(R - 2.6 * pitch, R, rcc);
      if (h < edge * 0.92 || rcc > R) continue;
      float a = (ph - cen) * sl;
      float b = r - rc + a * (fract(h * 5.3) - 0.5) * 0.12 + 1.3 * sin(ThL * 1.7 + hj * 6.0);
      float Lh = sl * (0.62 + 0.28 * fract(h * 13.1)) * clamp(rcc / 14.0, 0.45, 1.0);
      float Wh = bw * (0.64 + 0.18 * fract(h * 7.3));
      float x = fract(h * 3.3 + hj);
      float f = rcc / R;
      vec3 c1; vec3 c2;
      if (j < 1.0) { c1 = x < 0.6 ? WH : P3; c2 = PY; }
      else if (j < 2.0) { c1 = x < 0.55 ? P3 : P2; c2 = WH; }
      else if (j < 3.0) { c1 = x < 0.6 ? P2 : P1; c2 = P3; }
      else if (j < 4.0) { c1 = x < 0.45 ? P3 : x < 0.8 ? WH : YG; c2 = P2; }
      else { c1 = x < 0.6 ? P1 : P4; c2 = P2; }
      if (f < 0.18) { c1 = mix(c1, PY, 0.55); c2 = WH; }
      if (f > 0.78) c1 = mix(c1, P1, 0.35);
      paintStroke(acc, a, b, dS, dT, Lh, Wh, c1, c2, h);
    }
  }
}

void main() {
  vec2 p = uOrigin + vTexCoord * uSize;
  vec4 acc = vec4(underpaint(p), 1.0);

  // the background drift: long strokes along the stream lines
  {
    float T = flowT(p);
    float e = 0.6;
    vec2 G = vec2(flowT(p + vec2(e, 0.0)) - flowT(p - vec2(e, 0.0)), flowT(p + vec2(0.0, e)) - flowT(p - vec2(0.0, e))) / (2.0 * e);
    float S = p.x + uDrift;
    float dSw = length(p - 0.5 * (SA + SB));
    ${bandLoop("acc", "p", "T", "G", "S", "vec2(1.0, 0.0)", "3.1", "11.0", "1.0", `      float run = hash21(vec2(j, floor(i / 3.0)) + 11.0);
      float y = pc.y + (run - 0.5) * 34.0;
      float x = fract(run * 3.7 + h * 0.4);
      float near = 1.0 - smoothstep(60.0, 170.0, dSw);
      if (y > 578.0) { c1 = pick(x, P2, P3, P1, YG, vec3(0.35, 0.6, 0.86)); if (x > 0.95) c1 = WH; c2 = x < 0.5 ? P1 : P3; }
      else if (fract(h * 17.3) < near * 0.45) { c1 = x < 0.5 ? P2 : P3; c2 = P1; }
      else if (y < 500.0) { c1 = pick(x, P0, P1, P0, P4, vec3(0.4, 0.72, 0.9)); if (x > 0.97) c1 = P2; c2 = x < 0.5 ? P1 : P0; }
      else { c1 = pick(x, P1, P0, P2, P4, vec3(0.42, 0.66, 0.84)); c2 = x < 0.6 ? P2 : P0; }`)}
  }

  // the great wave: one long rolling band of pale and blue strokes that runs
  // in from the left, coils round A, crosses between them and wraps B, so the
  // two vortices read as one S-shaped breaker and not two separate targets
  {
    vec2 qw = (p - WC) / WR;
    if (dot(qw, qw) < 1.15) {
      float T = waveT(p);
      float e = 0.6;
      vec2 G = vec2(waveT(p + vec2(e, 0.0)) - waveT(p - vec2(e, 0.0)), waveT(p + vec2(0.0, e)) - waveT(p - vec2(0.0, e))) / (2.0 * e);
      float S = p.x + uDrift;
      ${bandLoop("acc", "p", "T", "G", "S", "vec2(1.0, 0.0)", "2.8", "12.0", "61.0", `      vec2 qc = (pc - WC) / WR;
      // fades out low down, so the pelican's white head never sits on pale wave
      float wgt = (1.0 - smoothstep(0.35, 1.0, dot(qc, qc))) * smoothstep(600.0, 556.0, pc.y);
      own = fract(h * 13.7) < wgt * 1.15;
      float g = mod(floor(j / 2.0 + 0.5 * hj), 5.0);
      float x = fract(h * 3.3 + hj);
      if (g < 1.0) { c1 = x < 0.55 ? WH : x < 0.85 ? P3 : PY; c2 = P3; }
      else if (g < 2.0) { c1 = x < 0.6 ? P3 : P2; c2 = WH; }
      else if (g < 3.0) { c1 = x < 0.55 ? P2 : x < 0.85 ? P1 : P4; c2 = P3; }
      else if (g < 4.0) { c1 = x < 0.5 ? P3 : x < 0.8 ? WH : YG; c2 = P2; }
      else { c1 = x < 0.6 ? P1 : P0; c2 = P2; }
      Lh *= 1.25;`)}
    }
  }

  // the double spiral: two meshed vortices turning in opposite senses
  spiral(acc, p, SA, uSpin, 1.0, 16.0, 5.0, 10.5, 78.0, 21.0);
  spiral(acc, p, SB, uSpin, -1.0, 15.0, 5.0, 10.0, 66.0, 37.0);

  // the moon's halo, then the stars
  rings(acc, p, MO, uMoon, 2.2, 6.6, 38.0, 2.0, 5.0);
${STARS.map(
  (s, k) =>
    `  rings(acc, p, ${glv(s)}, ${s[3] > 0 ? "" : "-"}${s[4] ? "uStarB" : "uStar"}, ${s[4] ? "3.0" : "2.5"}, ${s[4] ? "7.5" : "6.5"}, ${s[2].toFixed(1)}, ${s[4] ? "1.0" : "0.0"}, ${(50 + k * 13).toFixed(1)});`,
).join("\n")}

  fragColor = vec4(acc.rgb, 1.0);
}`;

// ------------------------------------------------------------------ the land (baked)
const LAND_FRAG = `${FRAG_HEAD}
uniform vec2 uOrigin;
uniform vec2 uSize;
uniform float uPx;
${NOISE}
${STROKE_LIB}

const vec3 DK = vec3(0.055, 0.09, 0.21);

float hillF(float x) { return 640.0 - 42.0 * smoothstep(-80.0, 1080.0, x) + 9.0 * sin(x / 83.0 + 0.4) + 5.0 * sin(x / 31.0 + 2.1); }
float hillN(float x) { return hillF(x) + 22.0 + 7.0 * sin(x / 57.0 + 1.3) + 3.0 * sin(x / 23.0); }
// the pale verge behind the wheels in bar 2: the field comes up to the hillside there
float vergeZ(float x) { return smoothstep(${VERGE.x0 - 50}.0, ${VERGE.x0}.0, x) * smoothstep(${VERGE.x1 + 50}.0, ${VERGE.x1}.0, x); }
float fieldY(float x) { return mix(max(hillN(x) + 9.0, 662.0 + 4.0 * sin(x / 47.0)), min(hillN(x) + 7.0, 652.0 + 1.5 * sin(x / 23.0)), vergeZ(x)); }
// the lane's lower edge: ragged, and pulled up clear of the signature
float laneB(float x) {
  float sig = smoothstep(30.0, 60.0, x) * smoothstep(370.0, 340.0, x);
  return 742.0 + (3.0 * sin(x / 37.0 + 1.0) + 1.8 * sin(x / 13.0)) * (1.0 - 0.6 * sig) - 9.0 * sig;
}
float cypX(float y) { return 170.0 + 5.0 * sin(y / 37.0) + 2.5 * sin(y / 13.0 + 1.0); }
float cypW(float y) {
  float f = clamp((714.0 - y) / 268.0, 0.0, 1.0);
  float w = 26.0 * pow(1.0 - f, 0.55) * (0.8 + 0.25 * sin(f * 3.1416));
  return w * (1.0 + 0.2 * sin(y / 8.5 + 2.0 * sin(y / 23.0)));
}

void main() {
  vec2 p = uOrigin + vTexCoord * uSize;
  vec4 acc = vec4(0.0);
  float hf = hillF(p.x);

  // far hills: long waves along the ridge, with a dark contour on top
  if (p.y > hf - 6.0) {
    float d = 0.5;
    float T = p.y - hf;
    vec2 G = vec2(-(hillF(p.x + d) - hillF(p.x - d)) / (2.0 * d), 1.0);
    ${bandLoop("acc", "p", "T", "G", "p.x", "vec2(1.0, 0.0)", "2.6", "9.5", "101.0", `      float tcen = pc.y - hillF(pc.x);
      own = tcen > -0.6;
      float x = fract(h * 3.1 + hj);
      if (tcen < 2.6) { c1 = x < 0.7 ? vec3(0.06, 0.10, 0.25) : P0; c2 = P0; }
      else { c1 = pick(x, P2, P1, P4, P3, vec3(0.4, 0.72, 0.88)); c2 = x < 0.5 ? P3 : P1; }`)}
  }
  // near hills, darker, with their own contour
  float hn = hillN(p.x);
  if (p.y > hn - 6.0) {
    float d = 0.5;
    float T = p.y - hn;
    vec2 G = vec2(-(hillN(p.x + d) - hillN(p.x - d)) / (2.0 * d), 1.0);
    ${bandLoop("acc", "p", "T", "G", "p.x", "vec2(1.0, 0.0)", "2.6", "9.0", "131.0", `      float tcen = pc.y - hillN(pc.x);
      own = tcen > -0.6;
      float x = fract(h * 3.1 + hj);
      if (tcen < 2.4) { c1 = vec3(0.05, 0.09, 0.22); c2 = P0; }
      else { c1 = pick(x, P1, P0, P4, vec3(0.17, 0.37, 0.48), vec3(0.4, 0.62, 0.86)); c2 = x < 0.5 ? P2 : P4; }`)}
  }
  // fields round the village
  float fy = fieldY(p.x);
  if (p.y > fy - 5.0) {
    float T = p.y - 0.35 * fy;
    float d = 0.5;
    vec2 G = vec2(-0.35 * (fieldY(p.x + d) - fieldY(p.x - d)) / (2.0 * d), 1.0);
    ${bandLoop("acc", "p", "T", "G", "p.x", "vec2(1.0, 0.0)", "2.5", "8.0", "151.0", `      own = pc.y > fieldY(pc.x) - 0.5;
      float run = hash21(vec2(j, floor(i / 4.0)) + 3.0);
      float x = fract(run * 2.3 + h * 0.3);
      c1 = pick(x, vec3(0.18, 0.35, 0.29), vec3(0.24, 0.42, 0.29), vec3(0.34, 0.44, 0.23), vec3(0.12, 0.23, 0.33), vec3(0.3, 0.55, 0.78));
      if (x > 0.93) c1 = vec3(0.48, 0.52, 0.27);
      c2 = x < 0.5 ? P4 : vec3(0.42, 0.5, 0.26);
      // the verge: calm, pale green and ochre, low in contrast
      float vz = vergeZ(pc.x) * smoothstep(${VERGE.y0 - 4}.0, ${VERGE.y0 + 4}.0, pc.y);
      if (fract(h * 5.7) < vz) {
        c1 = pick(x, vec3(0.50, 0.58, 0.40), vec3(0.58, 0.62, 0.42), vec3(0.45, 0.55, 0.42), vec3(0.64, 0.64, 0.45), vec3(0.3, 0.6, 0.85));
        if (x > 0.85) c1 = vec3(0.54, 0.62, 0.50);
        c2 = x < 0.5 ? vec3(0.66, 0.66, 0.48) : vec3(0.46, 0.56, 0.40);
      }`)}
  }
  // the cypress: a dark flame licking up into the sky
  if (abs(p.x - 170.0) < 60.0 && p.y > 436.0 && p.y < 722.0) {
    float T = p.x - cypX(p.y) + 3.0 * sin(p.y / 17.0) * smoothstep(700.0, 460.0, p.y);
    float d = 0.5;
    float Tx = 1.0;
    float Ty = (-(cypX(p.y + d) - cypX(p.y - d)) + 3.0 * (sin((p.y + d) / 17.0) - sin((p.y - d) / 17.0))) / (2.0 * d);
    ${bandLoop("acc", "p", "T", "vec2(Tx, Ty)", "-p.y", "vec2(0.0, -1.0)", "2.3", "9.0", "171.0", `      float w = cypW(pc.y);
      float off = pc.x - cypX(pc.y);
      // licking flame tongues: each side has its own lobes, curling upward
      float wl = w * (1.0 + 0.34 * sin(pc.y / 10.5 + 0.8 + 1.4 * sin(pc.y / 41.0)));
      float wr = w * (1.0 + 0.30 * sin(pc.y / 12.5 + 2.9 + 1.2 * sin(pc.y / 33.0)));
      own = off > -wl && off < wr && pc.y > 444.0;
      float x = fract(h * 2.9 + hj);
      float rim = smoothstep(0.55, 0.95, abs(off) / max(w, 1.0));
      c1 = pick(x, vec3(0.07, 0.14, 0.11), vec3(0.11, 0.2, 0.15), vec3(0.15, 0.27, 0.19), vec3(0.05, 0.1, 0.16), vec3(0.35, 0.68, 0.88));
      float litSide = smoothstep(0.3, -0.9, off / max(w, 1.0));
      float y2 = fract(h * 23.1);
      if (y2 < litSide * 0.45) c1 = y2 < litSide * 0.2 ? vec3(0.36, 0.48, 0.26) : vec3(0.22, 0.38, 0.34);
      if (off > 0.0 && rim > 0.4 && x > 0.45) c1 = vec3(0.04, 0.07, 0.13);
      c2 = x < 0.5 ? vec3(0.2, 0.33, 0.2) : vec3(0.04, 0.08, 0.1);
      Lh *= 1.15;`)}
  }
  // the lane: pale ochre and green laid level
  if (p.y > 690.0 && p.y < 754.0) {
    float T = p.y + 0.7 * sin(p.x / 41.0);
    vec2 G = vec2(0.7 / 41.0 * cos(p.x / 41.0), 1.0);
    ${bandLoop("acc", "p", "T", "G", "p.x", "vec2(1.0, 0.0)", "2.6", "9.5", "191.0", `      float lb = laneB(pc.x);
      own = pc.y > 695.5 + 1.6 * sin(pc.x / 19.0 + 2.0) && pc.y < lb;
      float run = hash21(vec2(j, floor(i / 3.0)) + 7.0);
      float x = fract(run * 2.1 + h * 0.35);
      float edgeL = smoothstep(704.0, 698.0, pc.y) + smoothstep(lb - 9.0, lb - 1.0, pc.y);
      c1 = pick(x, vec3(0.66, 0.57, 0.33), vec3(0.54, 0.50, 0.29), vec3(0.74, 0.66, 0.43), vec3(0.40, 0.48, 0.30), vec3(0.3, 0.55, 0.78));
      if (x > 0.95) c1 = vec3(0.86, 0.79, 0.56);
      if (edgeL > 0.5 && x < 0.7) c1 = x < 0.35 ? vec3(0.22, 0.33, 0.20) : vec3(0.32, 0.42, 0.25);
      // patches where the grass comes through, and two cart ruts worn darker
      float pn = vnoise(pc / vec2(64.0, 13.0) + 3.0);
      if (pn > 0.6 && x < 0.55) c1 = x < 0.3 ? vec3(0.45, 0.52, 0.30) : vec3(0.36, 0.46, 0.30);
      float rut = min(abs(pc.y - 715.0 - 1.4 * sin(pc.x / 53.0)), abs(pc.y - 729.0 - 1.8 * sin(pc.x / 61.0 + 1.0)));
      if (rut < 2.0 && x < 0.8) c1 = x < 0.4 ? vec3(0.47, 0.39, 0.22) : vec3(0.38, 0.36, 0.22);
      c2 = x < 0.5 ? vec3(0.86, 0.79, 0.56) : vec3(0.42, 0.47, 0.27);`)}
  }
  // the foreground field: dark blue-green, in short waves
  if (p.y > 728.0) {
    float T = p.y + 4.0 * sin(p.x / 29.0 + p.y / 17.0);
    vec2 G = vec2(4.0 / 29.0 * cos(p.x / 29.0 + p.y / 17.0), 1.0 + 4.0 / 17.0 * cos(p.x / 29.0 + p.y / 17.0));
    ${bandLoop("acc", "p", "T", "G", "p.x", "vec2(1.0, 0.0)", "3.0", "7.5", "211.0", `      own = pc.y > laneB(pc.x) - 1.5;
      float x = fract(h * 3.7 + hj);
      c1 = pick(x, vec3(0.09, 0.23, 0.23), vec3(0.12, 0.29, 0.26), P0, vec3(0.07, 0.19, 0.18), vec3(0.32, 0.6, 0.82));
      if (x > 0.94) c1 = P4;
      c2 = x < 0.5 ? vec3(0.17, 0.35, 0.29) : P1;`)}
  }
  fragColor = acc;
}`;

// ------------------------------------------------------------------ canvas dabs
const LX = -0.55;
const LY = -0.835;
const shadeCache = new Map();

function hexRgb(hex) {
  if (hex.startsWith("rgb")) return hex.slice(hex.indexOf("(") + 1, hex.indexOf(")")).split(",").map(Number);
  const v = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
}

/** "#rrggbb" darkened (f < 1) or lightened (f > 1) as an rgb() string. */
function shade(hex, f) {
  const key = `${hex}/${f}`;
  let s = shadeCache.get(key);
  if (!s) {
    const c = hexRgb(hex).map((v) => Math.round(clamp(f >= 1 ? v + (255 - v) * (f - 1) : v * f, 0, 255)));
    s = `rgb(${c[0]},${c[1]},${c[2]})`;
    shadeCache.set(key, s);
  }
  return s;
}

/** A loaded stroke: blunt where the brush landed, tapering where it lifted. Local frame. */
function strokePath(ctx, hl, hw, ox, oy) {
  ctx.moveTo(-hl + ox, oy);
  ctx.bezierCurveTo(-hl + ox, -hw * 1.05 + oy, -hl * 0.3 + ox, -hw + oy, hl * 0.25 + ox, -hw * 0.72 + oy);
  ctx.quadraticCurveTo(hl * 0.92 + ox, -hw * 0.32 + oy, hl + ox, oy);
  ctx.quadraticCurveTo(hl * 0.92 + ox, hw * 0.32 + oy, hl * 0.25 + ox, hw * 0.72 + oy);
  ctx.bezierCurveTo(-hl * 0.3 + ox, hw + oy, -hl + ox, hw * 1.05 + oy, -hl + ox, oy);
}

/**
 * One dab of thick paint at (x, y), along angle ang: a shadowed edge, the body,
 * a lit ridge. col is "#rrggbb". With lite = true, only body and ridge.
 */
function dab(ctx, x, y, ang, len, wid, col, lite = false) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  // light direction in the stroke's own frame
  let ly = -LX * s + LY * c;
  const lx = LX * c + LY * s;
  const hl = len / 2;
  const hw = wid / 2;
  ctx.setTransform(BASE.a * c, BASE.a * s, -BASE.a * s, BASE.a * c, BASE.e + BASE.a * x, BASE.f + BASE.a * y);
  if (!lite) {
    ctx.fillStyle = shade(col, 0.6);
    ctx.beginPath();
    strokePath(ctx, hl * 1.02, hw * 1.04, -lx * hw * 0.32, -ly * hw * 0.32);
    ctx.fill();
  }
  ctx.fillStyle = col;
  ctx.beginPath();
  strokePath(ctx, hl, hw * 0.86, 0, 0);
  ctx.fill();
  ctx.fillStyle = shade(col, 1.32);
  ctx.beginPath();
  ly = ly >= 0 ? 1 : -1;
  strokePath(ctx, hl * 0.7, hw * 0.3, -hl * 0.12, ly * hw * 0.42);
  ctx.fill();
}

/** The current world transform of a context, kept so dab() can compose with it. */
const BASE = { a: 1, e: 0, f: 0 };
function setBase(ctx, k, tx, ty) {
  BASE.a = k;
  BASE.e = tx;
  BASE.f = ty;
  ctx.setTransform(k, 0, 0, k, tx, ty);
}
function resetBase(ctx) {
  ctx.setTransform(BASE.a, 0, 0, BASE.a, BASE.e, BASE.f);
}

/** A broken contour of short dark strokes along a polyline. */
function contour(ctx, pts, closed, col, w, seed, step = 4.5) {
  const n = pts.length;
  const segs = closed ? n : n - 1;
  let acc = 0;
  for (let i = 0; i < segs; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy);
    if (L < 1e-3) continue;
    const m = Math.max(1, Math.round(L / step));
    for (let k = 0; k < m; k += 1) {
      const t = (k + 0.5) / m;
      const h = hash(seed, i, k);
      dab(ctx, a[0] + dx * t, a[1] + dy * t, Math.atan2(dy, dx) + (h - 0.5) * 0.2, (L / m) * 1.5, w * (0.8 + 0.4 * h), col, true);
      acc += 1;
    }
  }
  return acc;
}

// ------------------------------------------------------------------ the village (in the bake)
// Three rows of small houses, back to front, each drawn with its gable end and
// a darker side wall, so the village has depth; dark bushes between them.
const HOUSES = (() => {
  const list = [];
  let id = 0;
  const rows = [
    { base: 668, x0: 372, x1: 892, w: [7, 12], h: [6, 8], gap: [1, 8], row: 0 },
    { base: 682, x0: 336, x1: 900, w: [9, 15], h: [7, 10], gap: [2, 12], row: 1 },
    { base: 696, x0: 318, x1: 868, w: [11, 19], h: [9, 12], gap: [8, 26], row: 2 },
  ];
  for (const r of rows) {
    let x = r.x0 + hash(r.row, 3) * 8;
    while (x < r.x1) {
      const h0 = hash(id, 41);
      let w = r.w[0] + (r.w[1] - r.w[0]) * h0;
      // The whole village stands up on the hillside, small and behind a pale
      // verge, so nothing dark ever sits behind the wheels (y 655 - 700); the
      // front row is left out.
      const up = true;
      if (up && r.row === 2) {
        x += w + 10;
        id += 1;
        continue;
      }
      // the village gathers in clusters round the church, thinning between them
      const dens = 0.5 + 0.5 * Math.cos((x - CHURCH_X) / 62) * (0.6 + 0.4 * Math.cos((x - CHURCH_X) / 150));
      if (r.row < 2 && Math.abs(x - CHURCH_X) > 60 && hash(id, 39, r.row) > (up ? 0.6 : 0.25 + 0.75 * dens)) {
        x += w + 6;
        id += 1;
        continue;
      }
      const sc = up ? 0.78 : 1;
      w *= sc;
      const kind = hash(id, 47);
      list.push({
        id,
        row: r.row,
        x,
        w: kind > 0.86 ? w * 1.6 : w,
        h: (r.h[0] + (r.h[1] - r.h[0]) * hash(id, 43)) * sc,
        base: (up ? villageFoot(x + w / 2) - 10 + 6 * r.row : r.base) + (hash(id, 44) - 0.5) * 3,
        side: (0.25 + 0.45 * hash(id, 48)) * w,
        pitch: kind > 0.86 ? 0.28 : 0.45 + 0.45 * hash(id, 49),
        roof: hash(id, 45),
        chimney: hash(id, 46) < 0.35,
      });
      x += w * (kind > 0.86 ? 1.6 : 1) + w * 0.45 + r.gap[0] + (r.gap[1] - r.gap[0]) * hash(id, 50);
      id += 1;
    }
  }
  // a few farms out on the hillside, small, behind the verge
  for (const [x, , w0, k] of [
    [872, 690, 18, 0],
    [930, 678, 14, 1],
    [978, 694, 20, 2],
    [-34, 690, 19, 3],
    [40, 682, 13, 4],
    [262, 692, 16, 5],
  ]) {
    const w = w0 * 0.72;
    const base = villageFoot(x + w / 2) - 4 + (hash(k, 55) - 0.5) * 2;
    list.push({ id: 200 + k, row: 1, x, w, h: (10 + 3 * hash(k, 52)) * 0.75, base, side: 0.5 * w, pitch: 0.6, roof: hash(k, 54), chimney: k % 2 === 0 });
  }
  return list.sort((a, b) => a.base - b.base);
})();
// lit windows: six of them, spread through the village, plus one farm
const LIT = (() => {
  const set = new Set([202]);
  for (const tx of [352, 470, 606, 690, 760, 812]) {
    let best = null;
    for (const hs of HOUSES) if (hs.row >= 1 && hs.id < 200 && !set.has(hs.id) && (!best || Math.abs(hs.x - tx) < Math.abs(best.x - tx))) best = hs;
    if (best) set.add(best.id);
  }
  return set;
})();

const WALLS = ["#5f7194", "#7486a2", "#55688c", "#a39a6c", "#6a7c9a", "#93977f", "#b3a774", "#6f8f86"];
const ROOFS = ["#2c4378", "#36507c", "#2f6a72", "#3d4f6e", C.roof, "#24345e", "#1f5560", C.roof];

function paintHouse(ctx, hs) {
  const j = (v, k) => v + (hash(hs.id, k, 91) - 0.5) * 1.1; // a hand-drawn wobble
  const { x, w, h, base } = hs;
  const top = base - h;
  const peak = top - w * hs.pitch;
  const d = hs.side;
  const back = hs.row === 0;
  const wall = WALLS[Math.floor(hash(hs.id, 92) * WALLS.length)];
  const wallC = back ? shade(wall, 0.78) : wall;
  const sideC = shade(wall, back ? 0.55 : 0.68);
  const roofCol = ROOFS[Math.floor(hs.roof * ROOFS.length)];
  // the side wall, in shadow
  const side = [[x + w, j(base, 1)], [x + w, j(top, 2)], [j(x + w + d, 3), j(top - 1.2, 4)], [j(x + w + d, 5), j(base - 0.6, 6)]];
  const front = [[j(x, 7), j(base, 8)], [j(x, 9), j(top, 10)], [x + w / 2, j(peak, 11)], [x + w, j(top, 2)], [x + w, j(base, 1)]];
  const roof = [[x + w / 2, j(peak, 11)], [j(x + w / 2 + d, 12), j(peak - 1.2, 13)], [j(x + w + d + 1.4, 14), j(top - 0.4, 15)], [x + w + 1.2, top + 0.6]];
  const fill = (pts, col) => {
    resetBase(ctx);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    for (const p of pts.slice(1)) ctx.lineTo(...p);
    ctx.closePath();
    ctx.fill();
  };
  fill(side, shade(sideC, 0.9));
  fill(front, shade(wallC, 0.82));
  fill(roof, shade(roofCol, 0.85));
  // paint: vertical dabs on the walls, dabs down the roof slope
  ctx.save();
  resetBase(ctx);
  ctx.beginPath();
  for (const poly of [side, front, roof]) {
    ctx.moveTo(...poly[0]);
    for (const p of poly.slice(1)) ctx.lineTo(...p);
    ctx.closePath();
  }
  ctx.clip();
  // the gable end in short strokes going every which way, as he painted walls
  const nx = Math.max(2, Math.round(w / 4.5));
  const ny = Math.max(2, Math.round(h / 3.2));
  for (let r = -1; r < ny; r += 1) {
    for (let k = 0; k < nx; k += 1) {
      const hh = hash(hs.id, k, r + 7);
      const ang = (r + k) % 2 ? Math.PI / 2 + (hh - 0.5) * 0.5 : (hh - 0.5) * 0.7;
      const col = hh < 0.55 ? wallC : hh < 0.8 ? shade(wallC, 1.15) : hh < 0.92 ? shade(wallC, 0.88) : "#b9a46a";
      dab(ctx, x + (k + 0.5 + (r & 1) * 0.3) * (w / nx), top + (r + 0.5) * (h / ny), ang, 4.2, 2.4, col, hh > 0.4);
    }
  }
  const ns = Math.max(1, Math.round(d / 3));
  for (let k = 0; k < ns; k += 1) dab(ctx, x + w + (k + 0.5) * (d / ns), top + h * 0.5, Math.PI / 2, h * 1.05, (d / ns) * 1.1, hash(hs.id, k, 8) < 0.7 ? sideC : shade(sideC, 1.2), true);
  const slope = Math.atan2(top - peak, w / 2);
  for (let k = 0; k < 4; k += 1) {
    const t = (k + 0.5) / 4;
    const hh = hash(hs.id, k, 17);
    dab(ctx, x + w / 2 + d * t + w * 0.25, (peak + top) / 2 - 1.0 * t, slope, Math.hypot(w / 2, top - peak) * 1.15, d / 3.2 + 1.2, hh < 0.75 ? roofCol : shade(roofCol, 1.3), true);
  }
  ctx.restore();
  // chimney
  if (hs.chimney) {
    const cx = x + w / 2 + d * 0.6;
    resetBase(ctx);
    ctx.fillStyle = "#2a2f45";
    ctx.fillRect(cx, peak + (top - peak) * 0.35 - 4.5, 2.4, 4.5);
  }
  // windows: a lit one, or a dark one
  if (LIT.has(hs.id)) {
    const wx = x + w * (0.3 + 0.35 * hash(hs.id, 61));
    dab(ctx, wx, top + h * 0.48, Math.PI / 2, 4.8, 3.6, "#f08a1c", true);
    dab(ctx, wx, top + h * 0.45, Math.PI / 2, 3.0, 1.9, "#ffe08a", true);
  } else if (!back && hash(hs.id, 62) < 0.6) {
    dab(ctx, x + w * (0.25 + 0.5 * hash(hs.id, 63)), top + h * 0.5, Math.PI / 2, 3.0, 2.0, "#1e2c55", true);
  }
  // the dark contour
  const lw = back ? 0.8 : 1.05;
  contour(ctx, front, true, C.ink, lw, hs.id * 7 + 3, 3.5);
  contour(ctx, [side[2], side[3], side[0]], false, C.ink, lw, hs.id * 7 + 4, 3.5);
  contour(ctx, [roof[0], roof[1], roof[2], roof[3]], false, C.ink, lw, hs.id * 7 + 5, 3.5);
}

/** The pale verge laid over the feet of the hillside houses behind the bar-2 stretch. */
function paintVerge(ctx) {
  const cols = ["#8a9a66", "#97a06b", "#7f9468", "#a3a372", "#8d9f80", "#738a62"];
  let n = 0;
  for (let dy = -4.5; dy < 4; dy += 1.6) {
    for (let x = VERGE.x0 - 40 + (n % 2) * 2.2; x < VERGE.x1 + 40; x += 4.4) {
      const y = villageFoot(x) + dy;
      if (Math.abs(x - 170) < 40) continue; // the cypress stands in front of the verge
      const h = hash(Math.round(x * 10), Math.round(y * 10), 613);
      const z = Math.min(clamp((x - (VERGE.x0 - 40)) / 40), clamp((VERGE.x1 + 40 - x) / 40));
      if (h > z * 1.05) continue;
      // only over the houses' feet: start just above their bases
      dab(ctx, x, y + (h - 0.5) * 1.2, (h - 0.5) * 0.3, 6 + 3 * h, 2.3, cols[Math.floor(hash(n, Math.round(x)) * cols.length)], h > 0.45);
    }
    n += 1;
  }
}

function paintChurch(ctx) {
  // small, pale blue-grey, up on the hillside with the other houses: the tip
  // of the spire stays at y 607, below the pelican's neck and head
  const cx = CHURCH_X;
  const base = villageFoot(cx) - 3.5;
  const tip = 607;
  // nave
  paintHouse(ctx, { id: 903, row: 1, x: cx - 13, w: 12, h: 8, base, side: 14, pitch: 0.5, roof: 0.3, chimney: false });
  // tower and spire
  const tw = 5;
  const tTop = 623;
  const tBot = base - 8;
  resetBase(ctx);
  ctx.fillStyle = "#8597b0";
  ctx.fillRect(cx - tw / 2, tTop, tw, tBot - tTop + 1);
  for (let k = 0; k < 4; k += 1) {
    dab(ctx, cx + (k % 2 ? 0.9 : -0.9), tTop + 2.5 + k * 3.6, Math.PI / 2, 4.2, 2.6, k % 3 ? "#9aabc2" : "#b4c1d0", true);
  }
  dab(ctx, cx, tTop + 4, Math.PI / 2, 2.4, 1.1, "#f4a321", true);
  const spire = [
    [cx - tw / 2 - 0.6, tTop],
    [cx, tip],
    [cx + tw / 2 + 0.6, tTop],
  ];
  resetBase(ctx);
  ctx.fillStyle = "#7f93ab";
  ctx.beginPath();
  ctx.moveTo(...spire[0]);
  ctx.lineTo(...spire[1]);
  ctx.lineTo(...spire[2]);
  ctx.closePath();
  ctx.fill();
  for (let k = 0; k < 3; k += 1) {
    const y = tTop - 3 - k * 4.5;
    const half = ((y - tip) / (tTop - tip)) * (tw / 2 + 0.3);
    dab(ctx, cx - half * 0.3, y, Math.PI / 2, 5, Math.max(1.0, half * 1.1), k % 2 ? "#a7b6c8" : "#90a3b9", true);
  }
  contour(ctx, spire, false, "#3d4f6e", 0.8, 909, 4);
  contour(ctx, [[cx - tw / 2, tTop], [cx - tw / 2, tBot]], false, "#3d4f6e", 0.8, 910, 4);
  contour(ctx, [[cx + tw / 2, tTop], [cx + tw / 2, tBot]], false, "#3d4f6e", 0.8, 911, 4);
}

// ------------------------------------------------------------------ the title, signed in paint
// The glyphs are only a mask. They are rasterised once at a fixed resolution
// (so the layout is the same at every output size), then every sample inside
// them looks for the direction in which the letter runs longest: that is the
// stroke direction there. Short loaded dabs are laid along it, as wide as the
// stroke, in yellows and orange, with a lit ridge; their ends overhang the
// glyph a little, so the edge is ragged like paint, not type. No drop shadow.
const ZH_FONT = "'Xingkai SC', 'STXingkai', 'Kaiti SC', 'STKaiti', serif";
const EN_FONT = "'Noteworthy', 'Marker Felt', 'Bradley Hand', cursive";
const YR_FONT = "'Kaiti SC', 'STKaiti', serif";
const TITLE = { x: 56, y: 728, w: 284, h: 52 };
const EN_CAP = 10.5; // capitals and digits, units: about 33 px at zoom 1.1, 30 px at zoom 1
const ZH_SIZE = 19.5;
const MK = 6; // mask pixels per unit

let TITLE_DABS = null;
let TITLE_LAYOUT = null;

/** Draw the title's glyphs in white into ctx (already in world units), fattened by grow units. */
function titleGlyphs(t, grow) {
  const L = TITLE_LAYOUT;
  t.fillStyle = "#fff";
  t.strokeStyle = "#fff";
  t.lineJoin = "round";
  t.textBaseline = "alphabetic";
  if ("letterSpacing" in t) t.letterSpacing = "0px";
  t.save();
  t.translate(TITLE.x + 3, L.enBase);
  t.scale(L.sx, 1);
  t.font = L.enFont;
  if ("letterSpacing" in t) t.letterSpacing = `${L.enSpace}px`;
  t.lineWidth = 0.45 + 2 * grow;
  t.fillText(L.en, 0, 0);
  t.strokeText(L.en, 0, 0);
  t.restore();
  if ("letterSpacing" in t) t.letterSpacing = "0px";
  t.font = L.zhFont;
  t.lineWidth = 0.7 + 2 * grow;
  t.fillText(META.zh, TITLE.x + 2, L.zhBase);
  t.strokeText(META.zh, TITLE.x + 2, L.zhBase);
  t.font = L.yrFont;
  t.lineWidth = 0.5 + 2 * grow;
  t.fillText(L.yr, L.yrX, L.zhBase);
  t.strokeText(L.yr, L.yrX, L.zhBase);
}

function titleLayout(t) {
  if (TITLE_LAYOUT) return TITLE_LAYOUT;
  // the English line: sized by its capitals, held inside 270 units, lowest descender at y 774.5
  const en = `${META.en} · ${META.dateEn}`;
  const enSpace = 0.6;
  t.save();
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.font = `700 100px ${EN_FONT}`;
  const capM = t.measureText("TSN1889");
  const em = (100 * EN_CAP) / capM.actualBoundingBoxAscent;
  const enFont = `700 ${em.toFixed(3)}px ${EN_FONT}`;
  t.font = enFont;
  const mEn = t.measureText(en);
  const wEn = mEn.width + enSpace * (en.length - 1);
  const sx = Math.min(1, 266 / wEn);
  const enBase = 774.5 - 1.0 - mEn.actualBoundingBoxDescent;
  const zhFont = `400 ${ZH_SIZE}px ${ZH_FONT}`;
  t.font = zhFont;
  const mZh = t.measureText(META.zh);
  const zhBase = enBase - EN_CAP - 3.4 - mZh.actualBoundingBoxDescent;
  const yrFont = `700 ${(ZH_SIZE * 0.66).toFixed(2)}px ${YR_FONT}`;
  t.restore();
  TITLE_LAYOUT = { en, enSpace, enFont, sx, enBase, zhFont, zhBase, yrFont, yr: META.date, yrX: TITLE.x + 2 + mZh.width + 6 };
  return TITLE_LAYOUT;
}

function titleDabs(stage) {
  if (TITLE_DABS) return TITLE_DABS;
  const W = Math.round(TITLE.w * MK);
  const H = Math.round(TITLE.h * MK);
  const Lr = new Layer2D(stage.p, W, H);
  const t = Lr.ctx;
  titleLayout(t);
  t.setTransform(MK, 0, 0, MK, -TITLE.x * MK, -TITLE.y * MK);
  titleGlyphs(t, 0);
  const data = t.getImageData(0, 0, W, H).data;
  const inside = (x, y) => {
    const px = Math.round((x - TITLE.x) * MK);
    const py = Math.round((y - TITLE.y) * MK);
    if (px < 0 || py < 0 || px >= W || py >= H) return false;
    return data[(py * W + px) * 4 + 3] > 110;
  };
  const NDIR = 16;
  const dirs = [];
  for (let d = 0; d < NDIR; d += 1) dirs.push([Math.cos((d / NDIR) * Math.PI), Math.sin((d / NDIR) * Math.PI)]);
  const run = (x, y, dx, dy, max) => {
    let a = 0;
    while (a < max && inside(x + dx * (a + 0.17), y + dy * (a + 0.17))) a += 0.17;
    return a;
  };
  const list = [];
  const step = 0.62;
  for (let y = TITLE.y + 0.3; y < TITLE.y + TITLE.h; y += step) {
    for (let x = TITLE.x + 0.3; x < TITLE.x + TITLE.w; x += step) {
      const h = hash(Math.round(x * 20), Math.round(y * 20), 4417);
      const jx = x + (h - 0.5) * step * 0.7;
      const jy = y + (hash(Math.round(y * 20), Math.round(x * 20), 4418) - 0.5) * step * 0.7;
      if (!inside(jx, jy)) continue;
      let best = 0;
      let bestL = -1;
      let thin = 99;
      for (let d = 0; d < NDIR; d += 1) {
        const [dx, dy] = dirs[d];
        const l = run(jx, jy, dx, dy, 6) + run(jx, jy, -dx, -dy, 6);
        if (l > bestL) {
          bestL = l;
          best = d;
        }
        thin = Math.min(thin, l);
      }
      if (h > 0.55 + 0.6 / Math.max(1, thin)) continue; // fewer dabs where a stroke is broad
      const ang = (best / NDIR) * Math.PI + (hash(Math.round(x * 20), Math.round(y * 20), 4419) - 0.5) * 0.16;
      list.push({ x: jx, y: jy, ang, len: clamp(bestL * 0.5, 1.3, 3.6) * (0.85 + 0.3 * h), wid: clamp(thin * 0.62, 0.6, 1.45), h, order: hash(Math.round(jx * 50), Math.round(jy * 50), 4420) });
    }
  }
  list.sort((a, b) => a.order - b.order);
  TITLE_DABS = list;
  return list;
}

/** The title on the bake's canvas pass (ctx in world units through BASE, k px per unit). */
function paintTitle(stage, ctx, k, ox, oy) {
  const dabs = titleDabs(stage);
  const W = Math.round(TITLE.w * k);
  const H = Math.round(TITLE.h * k);
  // the underpaint: the letters in a deeper ochre, a hair fatter
  const U = new Layer2D(stage.p, W, H);
  U.ctx.setTransform(k, 0, 0, k, -TITLE.x * k, -TITLE.y * k);
  titleGlyphs(U.ctx, 0.12);
  U.ctx.globalCompositeOperation = "source-in";
  U.ctx.setTransform(1, 0, 0, 1, 0, 0);
  U.ctx.fillStyle = "#b8791a";
  U.ctx.fillRect(0, 0, W, H);
  // the loaded dabs, then trimmed to the letters grown by a ragged margin
  const D = new Layer2D(stage.p, W, H);
  const saved = { ...BASE };
  setBase(D.ctx, k, -TITLE.x * k, -TITLE.y * k);
  const cols = [C.chrome, C.chrome, "#f7d64a", "#f7d64a", "#fbe9a0", "#e9b02a", C.orange];
  for (const d of dabs) {
    const col = cols[Math.floor(hash(Math.round(d.x * 7), Math.round(d.y * 7), 4421) * cols.length)];
    dab(D.ctx, d.x, d.y, d.ang, d.len, d.wid, col, d.h > 0.6);
  }
  Object.assign(BASE, saved);
  const M = new Layer2D(stage.p, W, H);
  M.ctx.setTransform(k, 0, 0, k, -TITLE.x * k, -TITLE.y * k);
  titleGlyphs(M.ctx, 0.6);
  D.ctx.setTransform(1, 0, 0, 1, 0, 0);
  D.ctx.globalCompositeOperation = "destination-in";
  D.ctx.drawImage(M.canvas, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const px = Math.round((TITLE.x - ox) * k);
  const py = Math.round((TITLE.y - oy) * k);
  ctx.drawImage(U.canvas, px, py);
  ctx.drawImage(D.canvas, px, py);
  ctx.restore();
  resetBase(ctx);
}

// ------------------------------------------------------------------ bake
function bakeLand(stage) {
  const k = LAND_PX * stage.s;
  const W = (LAND.x1 - LAND.x0) * k;
  const H = (LAND.y1 - LAND.y0) * k;
  return stage.bake(`starry/land/${k.toFixed(3)}`, W, H, () => {
    const view = new View(k, -LAND.x0 * k, -LAND.y0 * k);
    const sh = stage.shader("starry/land", VERT, LAND_FRAG);
    stage.withView(view, () => {
      stage.shaderRect(sh, { uOrigin: [LAND.x0, LAND.y0], uSize: [LAND.x1 - LAND.x0, LAND.y1 - LAND.y0], uPx: k }, LAND.x0, LAND.y0, LAND.x1 - LAND.x0, LAND.y1 - LAND.y0);
    });
    // the village, the church and the signature, painted in dabs on a canvas
    const layer = new Layer2D(stage.p, W, (OVER.y1 - OVER.y0) * k);
    const ctx = layer.ctx;
    setBase(ctx, k, -LAND.x0 * k, -OVER.y0 * k);
    for (const hs of HOUSES) if (hs.row < 2) paintHouse(ctx, hs);
    for (const hs of HOUSES) if (hs.row === 2) paintHouse(ctx, hs);
    paintChurch(ctx);
    paintVerge(ctx);
    paintTitle(stage, ctx, k, LAND.x0, OVER.y0);
    layer.touch();
    stage.origin();
    stage.image(layer, 0, (OVER.y0 - LAND.y0) * k, layer.w, layer.h);
    const textures = stage.p._renderer && stage.p._renderer.textures;
    if (textures && typeof textures.get === "function") {
      const tex = textures.get(layer.img);
      if (tex && typeof tex.remove === "function") tex.remove();
      textures.delete(layer.img);
    }
  });
}

// ------------------------------------------------------------------ the pelican, in the same strokes
/** Centroid and principal axis of a polygon, the axis signed towards ref. */
function frameOf(pts, ref) {
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p[0];
    cy += p[1];
  }
  cx /= pts.length;
  cy /= pts.length;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of pts) {
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let ax = Math.cos(ang);
  let ay = Math.sin(ang);
  if (ax * ref[0] + ay * ref[1] < 0) {
    ax = -ax;
    ay = -ay;
  }
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  for (const p of pts) {
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    const u = dx * ax + dy * ay;
    const v = -dx * ay + dy * ax;
    u0 = Math.min(u0, u);
    u1 = Math.max(u1, u);
    v0 = Math.min(v0, v);
    v1 = Math.max(v1, v);
  }
  return { cx, cy, ax, ay, u0, u1, v0, v1 };
}

/**
 * Paint a part's dabs once, in its own frame (u along the axis, v across),
 * onto a sprite. mode "contour": dabs curve round the shape; "axis": along it.
 */
function partSprite(stage, key, fr, opt) {
  const k = 3.4 * stage.s;
  const m = 3;
  const W = fr.u1 - fr.u0 + 2 * m;
  const H = fr.v1 - fr.v0 + 2 * m;
  const layer = stage.layer(`starry/part/${key}/${k.toFixed(3)}`, W * k, H * k);
  if (!layer.drawn) {
    const saved = { ...BASE };
    const ctx = layer.clear();
    setBase(ctx, k, -(fr.u0 - m) * k, -(fr.v0 - m) * k);
    ctx.fillStyle = opt.ground;
    ctx.fillRect(fr.u0 - m, fr.v0 - m, W, H);
    const du = opt.len * 0.62;
    const dv = opt.wid * 0.92;
    const A = Math.max(1, (fr.u1 - fr.u0) / 2);
    const B = Math.max(1, (fr.v1 - fr.v0) / 2);
    const uc = (fr.u0 + fr.u1) / 2;
    const vc = (fr.v0 + fr.v1) / 2;
    const j0 = Math.floor((fr.v0 - m) / dv) - 1;
    const j1 = Math.ceil((fr.v1 + m) / dv) + 1;
    for (let j = j0; j <= j1; j += 1) {
      const stag = (j & 1) * 0.5 * du;
      const i0 = Math.floor((fr.u0 - m - stag) / du) - 1;
      const i1 = Math.ceil((fr.u1 + m - stag) / du) + 1;
      for (let i = i0; i <= i1; i += 1) {
        const h = hash(opt.seed, i, j);
        const u = i * du + stag + (h - 0.5) * du * 0.35;
        const v = j * dv + (hash(opt.seed, j, i) - 0.5) * dv * 0.3;
        let dir = 0;
        if (opt.mode === "contour") {
          const lu = (u - uc) / A;
          const lv = (v - vc) / B;
          dir = Math.atan2(lu / A, -lv / B);
        }
        const below = clamp(((v - vc) / B) * opt.down * 0.5 + 0.5);
        dab(ctx, u, v, dir + (h - 0.5) * 0.35, opt.len * (0.85 + 0.3 * h), opt.wid * (0.85 + 0.3 * hash(opt.seed, j, i, 3)), opt.pick(h, below), opt.lite || h > (opt.shadow || 0.35));
      }
    }
    Object.assign(BASE, saved);
    layer.drawn = true;
    layer.touch();
  }
  return { layer, m };
}

/** Lay a part's sprite onto the part as it is this frame, clipped to its outline. */
function drawPart(ctx, sh, fr, fr0, sp) {
  ctx.save();
  resetBase(ctx);
  traceShape(ctx, sh);
  ctx.clip();
  ctx.translate(fr.cx, fr.cy);
  ctx.rotate(Math.atan2(fr.ay, fr.ax));
  ctx.translate(fr.u0, fr.v0);
  ctx.scale((fr.u1 - fr.u0) / (fr0.u1 - fr0.u0), (fr.v1 - fr.v0) / (fr0.v1 - fr0.v0));
  ctx.translate(-fr0.u0, -fr0.v0);
  const m = sp.m;
  ctx.drawImage(sp.layer.canvas, fr0.u0 - m, fr0.v0 - m, fr0.u1 - fr0.u0 + 2 * m, fr0.v1 - fr0.v0 + 2 * m);
  ctx.restore();
  resetBase(ctx);
}

/** A brushed outline: a dark stroke and a broken lighter one riding on it. */
function outline(ctx, pts, closed, w, col = C.ink) {
  resetBase(ctx);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  if (closed) ctx.closePath();
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.setLineDash([3.2, 2.6, 1.4, 3.6]);
  ctx.strokeStyle = shade(col === C.ink ? C.ultra : col, 1.15);
  ctx.lineWidth = w * 0.35;
  ctx.translate(LX * w * 0.2, LY * w * 0.2);
  ctx.stroke();
  ctx.setLineDash([]);
  resetBase(ctx);
}

/**
 * The dark contour of a closed shape in loaded strokes, laid UNDER its fill so
 * only the outer half shows and parts that overlap leave no seam. The stroke
 * swells on the side away from the light, thins and breaks on the lit side.
 */
function inkContour(ctx, pts, w, seed, step = 3.6) {
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p[0];
    cy += p[1];
  }
  cx /= pts.length;
  cy /= pts.length;
  const n = pts.length;
  for (let i = 0; i < n; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy);
    if (L < 1e-3) continue;
    const m = Math.max(1, Math.round(L / step));
    for (let k = 0; k < m; k += 1) {
      const t = (k + 0.5) / m;
      const x = a[0] + dx * t;
      const y = a[1] + dy * t;
      const rl = Math.hypot(x - cx, y - cy) || 1;
      const shadow = clamp(((x - cx) * -LX + (y - cy) * -LY) / rl);
      const h = hash(seed, i, k);
      if (shadow < 0.15 && h < 0.18) continue; // the lit side breaks up
      const wid = w * (0.7 + 0.75 * shadow) * (0.85 + 0.3 * h);
      dab(ctx, x, y, Math.atan2(dy, dx) + (h - 0.5) * 0.18, (L / m) * 1.55, wid, h < 0.7 ? C.ink : "#1f3a7a", true);
    }
  }
}

/** A broken brushed contour on top of a part: short dark dabs along the edge, some skipped. */
function brushEdge(ctx, pts, closed, w, col, seed, skip = 0.22, step = 2.6) {
  const n = pts.length;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy);
    if (L < 1e-3) continue;
    const m = Math.max(1, Math.round(L / step));
    for (let k = 0; k < m; k += 1) {
      const h = hash(seed, i, k);
      if (h < skip) continue;
      const t = (k + 0.5) / m;
      dab(ctx, a[0] + dx * t, a[1] + dy * t, Math.atan2(dy, dx) + (h - 0.5) * 0.25, (L / m) * (1.2 + 0.5 * h), w * (0.7 + 0.6 * hash(seed, k, i)), h < 0.75 ? col : shade(col, 1.6), true);
    }
  }
  resetBase(ctx);
}

/** A leg in loaded dabs laid along it, over a darker stroke that keeps its shape. */
function paintLimb(ctx, pts, w, col, seed) {
  paintLine(ctx, pts, w * 0.95, shade(col, 0.62), 0);
  const cols = [col, col, shade(col, 1.25), C.chrome, shade(col, 0.85)];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy);
    const m = Math.max(2, Math.round(L / 3.4));
    for (let k = 0; k < m; k += 1) {
      const h = hash(seed, i, k);
      const t = (k + 0.5) / m + (h - 0.5) * 0.12;
      const off = (hash(seed, k, i) - 0.5) * w * 0.3;
      dab(ctx, a[0] + dx * t - (dy / L) * off, a[1] + dy * t + (dx / L) * off, Math.atan2(dy, dx) + (h - 0.5) * 0.2, (L / m) * 1.5, w * (0.8 + 0.3 * h), cols[Math.floor(h * cols.length)], h > 0.5);
    }
  }
  resetBase(ctx);
}

/** A thick painted line along a polyline: shadow, body, and a light on top. */
function paintLine(ctx, pts, w, col, light, lightCol) {
  resetBase(ctx);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const path = (ox, oy) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0] + ox, pts[0][1] + oy);
    for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0] + ox, pts[i][1] + oy);
  };
  ctx.strokeStyle = shade(col, 0.55);
  ctx.lineWidth = w * 1.15;
  path(-LX * w * 0.18, -LY * w * 0.18);
  ctx.stroke();
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  path(0, 0);
  ctx.stroke();
  if (light) {
    ctx.strokeStyle = lightCol || shade(col, 1.45);
    ctx.lineWidth = w * light;
    path(LX * w * 0.26, LY * w * 0.26);
    ctx.stroke();
  }
}

const BODY_PAL = (h, below) => {
  const x = h * 0.75 + below * 0.5;
  if (h > 0.93) return "#f2d675"; // a touch of the stars' yellow
  return x < 0.32 ? C.white : x < 0.55 ? "#efe6cc" : x < 0.72 ? "#cfe0f0" : x < 0.95 ? C.pale : "#7ea3d6";
};
const BILL_PAL = (h) => (h < 0.55 ? C.chrome : h < 0.85 ? "#f7d64a" : C.orange);
const POUCH_PAL = (h, below) => (h * 0.6 + below * 0.6 < 0.55 ? C.chrome : h < 0.8 ? C.orange : "#f7d64a");
const DARK_PAL = (h) => (h < 0.55 ? "#1f3a7a" : C.ink);

/** How each feathered part is painted: ref signs its axis, down says which side of v is the shadow. */
function partSpec(sh) {
  const t = sh.tag;
  if (t === "body") return { mode: "contour", ref: [1, 0], len: 8.2, wid: 2.9, ground: "#b9c7d6", pick: BODY_PAL, down: 1, shadow: 0.75 };
  if (t === "tail") return { mode: "axis", ref: [-1, 0], len: 5.0, wid: 2.0, ground: "#b9c7d6", pick: BODY_PAL, down: -1, shadow: 0.7 };
  if (t === "neck") return { mode: "axis", ref: [0, -1], len: 6.0, wid: 2.3, ground: "#c3cfdb", pick: BODY_PAL, down: -1, shadow: 0.7 };
  if (t === "head") return { mode: "contour", ref: "bill", len: 4.4, wid: 1.8, ground: "#d6dbe0", pick: (h) => (h < 0.5 ? C.white : h < 0.78 ? "#efe6cc" : h < 0.95 ? C.pale : "#f2d675"), down: 1, shadow: 0.6 };
  if (t === "crest") return { mode: "axis", ref: [-1, 0], len: 3, wid: 1.2, ground: "#e6e2d0", pick: (h) => (h < 0.5 ? C.white : "#f7d64a"), down: 1 };
  if (t === "pouch") return { mode: "axis", ref: "bill", len: 4.8, wid: 1.9, ground: C.orange, pick: POUCH_PAL, down: 1 };
  if (t === "bill") return { mode: "axis", ref: "bill", len: 5.2, wid: 1.5, ground: C.chrome, pick: BILL_PAL, down: 1, lite: true };
  if (t === "wing") return { mode: "axis", ref: [-1, 0], len: 6.0, wid: 2.2, ground: "#cfd8dc", pick: (h, below) => (h * 0.7 + below * 0.4 < 0.5 ? C.white : h < 0.75 ? C.pale : "#efe6cc"), down: -1 };
  if (t === "wingtip") return { mode: "axis", ref: [-1, 0], len: 4.4, wid: 1.7, ground: C.ink, pick: DARK_PAL, down: 1, lite: true };
  return null;
}

/** The puppet at rest: the sprites are painted to its proportions. */
let CANON = null;
function canonFrames() {
  if (!CANON) {
    const sk = solveRig({ x: 0, y: 0, scale: WHEEL_R, slope: 0, crank: Math.PI / 2, wheel: 0, time: 0 });
    const bill = [sk.joints.billTip[0] - sk.joints.billBase[0], sk.joints.billTip[1] - sk.joints.billBase[1]];
    CANON = new Map();
    for (const sh of sk.shapes) {
      const spec = partSpec(sh);
      if (!spec || sh.kind !== "poly") continue;
      const ref = spec.ref === "bill" ? bill : spec.ref;
      CANON.set(sh.id, { spec, ref, fr: frameOf(sh.pts, ref) });
    }
  }
  return CANON;
}

function spriteOf(stage, id) {
  const c = canonFrames().get(id);
  return partSprite(stage, id, c.fr, { ...c.spec, seed: 1400 + hash(id.length, id.charCodeAt(id.length - 1)) * 1000 });
}

function partOf(stage, ctx, sh, bill) {
  const c = canonFrames().get(sh.id);
  if (!c) return;
  const ref = c.spec.ref === "bill" ? bill : c.spec.ref;
  const fr = frameOf(sh.pts, ref);
  drawPart(ctx, sh, fr, c.fr, spriteOf(stage, sh.id));
}

/** Paint every pelican sprite up front, so the first frames that need them do not hitch. */
function warmPelican(stage) {
  for (const id of canonFrames().keys()) spriteOf(stage, id);
  const sk = solveRig({ x: 0, y: 0, scale: WHEEL_R, slope: 0, crank: Math.PI / 2, wheel: 0, time: 0 });
  for (const n of ["Rear", "Front"]) tyreSprite(stage, sk.shapes.find((sh) => sh.id === `tire${n}`).r, n);
  poolSprite(stage);
}

/** The tyre: a ring of short strokes, painted once, turned with the wheel. */
function tyreSprite(stage, r, name) {
  const k = 3.4 * stage.s;
  const R = r + 3;
  const layer = stage.layer(`starry/tyre/${name}/${k.toFixed(3)}`, 2 * R * k, 2 * R * k);
  if (!layer.drawn) {
    const saved = { ...BASE };
    const ctx = layer.clear();
    setBase(ctx, k, R * k, R * k);
    // strokes of uneven length and spacing, mostly dark blues, a few lit ones
    const cols = [C.ink, C.ink, "#1f3a7a", C.ultra, "#1f3a7a", C.ink, C.cobalt, C.chrome];
    let a = hash(1300 + name.length, 99) * TAU;
    let i = 0;
    while (a < TAU * 1.0 + 0.0001 + hash(1300 + name.length, 99) * TAU) {
      const h = hash(1300 + name.length, i);
      const len = 3.0 + 4.6 * h;
      const col = cols[Math.floor(hash(1310 + name.length, i) * cols.length)];
      const am = a + len / (2 * r);
      dab(ctx, Math.cos(am) * r, Math.sin(am) * r + (hash(1320, i) - 0.5) * 0.5, am + Math.PI / 2 + (h - 0.5) * 0.12, len, 2.4 + 1.1 * hash(1330 + name.length, i), col, h > 0.7);
      a += (len * (0.72 + 0.35 * hash(1340 + name.length, i))) / r;
      i += 1;
    }
    Object.assign(BASE, saved);
    layer.drawn = true;
    layer.touch();
  }
  return { layer, R };
}

/** A small pool of yellow light on the lane, painted once, carried with the bicycle. */
function poolSprite(stage) {
  const k = 3.4 * stage.s;
  const layer = stage.layer(`starry/pool/${k.toFixed(3)}`, 160 * k, 20 * k);
  if (!layer.drawn) {
    const saved = { ...BASE };
    const ctx = layer.clear();
    setBase(ctx, k, 80 * k, 10 * k);
    for (let i = 0; i < 64; i += 1) {
      const h = hash(1201, i);
      const ang = h * TAU;
      const rr = Math.sqrt(hash(1202, i));
      ctx.globalAlpha = 1 - 0.55 * rr * rr;
      dab(ctx, Math.cos(ang) * rr * 68, Math.sin(ang) * rr * 5.8, (hash(1203, i) - 0.5) * 0.25, 8 + 4 * h, 2.6, rr < 0.45 ? "#fbe9a0" : rr < 0.75 ? C.chrome : "#d9b24a", true);
    }
    ctx.globalAlpha = 1;
    Object.assign(BASE, saved);
    layer.drawn = true;
    layer.touch();
  }
  return layer;
}

function paintPelican(stage, f, act) {
  const view = f.view;
  const pel = f.pelican;
  const skel = solveRig({ ...pel, act });
  restage(skel, pel, f.u);
  const b = skel.bounds;
  const shapes = skel.shapes;
  const byId = new Map(shapes.map((s) => [s.id, s]));
  const tagged = (tag, side) => shapes.filter((s) => s.tag === tag && (!side || s.side === side));
  // sprites first: they use the shared brush transform
  const pool = poolSprite(stage);
  const tyres = ["Rear", "Front"].map((n) => tyreSprite(stage, byId.get(`tire${n}`).r, n));
  canonFrames();

  const patch = stage.patch("starry/pelican", view, Math.min(b.x0, pel.x - 82) - 4, b.y0 - 12, Math.max(b.x1, pel.x + 104) + 4, pel.y + 18);
  const ctx = patch.ctx;
  const tf = ctx.getTransform();
  setBase(ctx, tf.a, tf.e, tf.f);
  const bb = skel.joints.billBase;
  const bt = skel.joints.billTip;
  const bill = [bt[0] - bb[0], bt[1] - bb[1]];

  ctx.drawImage(pool.canvas, pel.x - 80, pel.y + 7.5 - 10, 160, 20);

  // far leg, far crank and pedal, foot
  for (const sh of tagged("leg", "far")) paintLimb(ctx, sh.pts, sh.w * 1.15, "#b9651a", sh.id.length * 13 + 5);
  for (const sh of tagged("crank", "far")) paintLine(ctx, sh.pts, sh.w, C.ink, 0);
  for (const sh of [...tagged("foot", "far"), ...tagged("pedal", "far")]) {
    resetBase(ctx);
    ctx.fillStyle = sh.tag === "foot" ? "#b9651a" : C.ink;
    traceShape(ctx, sh);
    ctx.fill();
  }

  // wheels: spokes, rim, and the tyre of strokes, turned with the wheel
  ["Rear", "Front"].forEach((name, n) => {
    const tire = byId.get(`tire${name}`);
    const [cx, cy] = tire.c;
    resetBase(ctx);
    ctx.strokeStyle = "rgba(169,198,230,0.85)";
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    for (const sh of shapes) {
      if (sh.tag !== "spoke" || !sh.id.startsWith(`spoke${name}`)) continue;
      ctx.moveTo(...sh.pts[0]);
      ctx.lineTo(...sh.pts[1]);
    }
    ctx.stroke();
    ctx.strokeStyle = C.cobalt;
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.arc(cx, cy, byId.get(`rim${name}`).r, 0, TAU);
    ctx.stroke();
    const ty = tyres[n];
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(pel.wheel);
    ctx.drawImage(ty.layer.canvas, -ty.R, -ty.R, 2 * ty.R, 2 * ty.R);
    ctx.restore();
    dab(ctx, cx, cy, pel.wheel, 4.2, 3.4, C.chrome, true);
  });

  // the frame in dark blue contour strokes, a yellow light along the top tube
  for (const sh of shapes) {
    if (!["frame", "post", "bar", "chain"].includes(sh.tag)) continue;
    const top = sh.id === "topTube";
    paintLine(ctx, sh.pts, sh.w * 1.15, C.ink, top ? 0.42 : sh.tag === "chain" ? 0 : 0.28, top ? C.chrome : C.cobalt);
  }
  resetBase(ctx);
  for (const sh of tagged("ring")) {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = sh.w * 1.3;
    ctx.beginPath();
    ctx.arc(sh.c[0], sh.c[1], sh.r, 0, TAU);
    ctx.stroke();
  }
  ctx.fillStyle = "#3a2a1e";
  traceShape(ctx, byId.get("saddle"));
  ctx.fill();
  paintLine(ctx, byId.get("grip").pts, byId.get("grip").w, "#3a2a1e", 0.3);
  const bell = byId.get("bell");
  dab(ctx, bell.c[0], bell.c[1], 0, bell.r * 2.4, bell.r * 2, C.chrome);

  // the dark blue contour round the bird, as van Gogh outlined his figures:
  // laid first, under every feathered fill, so only the silhouette shows
  const body = byId.get("body");
  const neck = byId.get("neck");
  const head = byId.get("head");
  for (const sh of tagged("tail")) inkContour(ctx, sh.pts, 2.0, 31, 2.6);
  inkContour(ctx, body.pts, 3.1, 32);
  inkContour(ctx, neck.pts, 2.7, 33, 3.0);
  inkContour(ctx, head.pts, 2.6, 34, 2.6);

  // tail and body
  for (const sh of tagged("tail")) partOf(stage, ctx, sh, bill);
  partOf(stage, ctx, body, bill);

  // near leg, crank, pedal and foot
  for (const sh of tagged("crank", "near")) paintLine(ctx, sh.pts, sh.w, C.ink, 0.3, C.cobalt);
  resetBase(ctx);
  ctx.fillStyle = C.ink;
  for (const sh of tagged("pedal", "near")) {
    traceShape(ctx, sh);
    ctx.fill();
  }
  for (const sh of tagged("leg", "near")) paintLimb(ctx, sh.pts, sh.w * 1.2, C.orange, sh.id.length * 17 + 9);
  for (const sh of tagged("foot", "near")) {
    resetBase(ctx);
    ctx.fillStyle = C.orange;
    traceShape(ctx, sh);
    ctx.fill();
    brushEdge(ctx, sh.pts, true, 0.7, "#8a3f10", 71, 0.3, 2.0);
  }

  // neck, head, crest, pouch, bill
  const pouch = byId.get("pouch");
  partOf(stage, ctx, neck, bill);
  partOf(stage, ctx, head, bill);
  for (const sh of tagged("crest")) partOf(stage, ctx, sh, bill);
  partOf(stage, ctx, pouch, bill);
  partOf(stage, ctx, byId.get("billLower"), bill);
  partOf(stage, ctx, byId.get("billUpper"), bill);

  // the wing: pale strokes, dark flight feathers
  for (const sh of shapes) if (sh.tag === "wingtip" && sh.id.startsWith("wingTip")) partOf(stage, ctx, sh, bill);
  const wing = byId.get("wing");
  partOf(stage, ctx, wing, bill);
  for (const sh of shapes) if (sh.tag === "wingtip" && sh.id.startsWith("wingHand")) partOf(stage, ctx, sh, bill);

  // the wing sits on the body, so its edge is drawn on top, thinner
  brushEdge(ctx, wing.pts.slice(5).concat([wing.pts[0]]), false, 1.1, C.ink, 61, 0.28);
  brushEdge(ctx, byId.get("wingFold").pts, false, 0.8, C.ultra, 62, 0.35);
  brushEdge(ctx, pouch.pts, true, 0.9, "#9a4a12", 63, 0.2, 2.2);
  brushEdge(ctx, byId.get("billUpper").pts, true, 0.75, "#9a4a12", 64, 0.18, 2.2);
  brushEdge(ctx, byId.get("billLower").pts, true, 0.6, "#9a4a12", 65, 0.3, 2.2);

  // the eye: a yellow ring round a dark pupil
  const eye = byId.get("eye");
  const pupil = byId.get("pupil");
  resetBase(ctx);
  ctx.fillStyle = C.chrome;
  ctx.beginPath();
  ctx.arc(eye.c[0], eye.c[1], eye.r * 1.05, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.arc(pupil.c[0], pupil.c[1], pupil.r * 1.15, 0, TAU);
  ctx.fill();
  const lid = byId.get("lid");
  if (lid) {
    ctx.fillStyle = "#e6e2d0";
    ctx.beginPath();
    ctx.arc(eye.c[0], eye.c[1], eye.r * 1.15, Math.PI, Math.PI + Math.PI * lid.amount);
    ctx.fill();
  }
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.arc(eye.c[0], eye.c[1], eye.r * 1.1, 0, TAU);
  ctx.stroke();

  stage.imagePatch(patch);
}

/** Standing on the pedals: in from u 3.25, full by 3.65, back in the saddle by 5.35. */
function standAt(u) {
  return smoothstep(3.25, 3.65, u) * (1 - smoothstep(4.95, 5.35, u));
}
/** Balancing the nearly stopped bicycle through the crawl. */
function swayAt(u) {
  return smoothstep(2.78, 3.0, u) * (1 - smoothstep(3.22, 3.45, u));
}

/** Acting: a glance up at the stalling sky, then standing on the pedals. */
function actingAt(u) {
  const look = smoothstep(2.55, 2.95, u) * (1 - smoothstep(3.25, 3.6, u));
  const race = standAt(u);
  return {
    wind: 0.6 + 0.6 * clamp(paceAt(u)),
    headPitch: 0.62 * look - 0.12 * race,
    eyeY: -1.0 * look,
    neckStretch: 0.5 * look,
    lean: 0.42 * race,
    bob: 1 + 0.8 * race,
  };
}

/**
 * Re-pose the solved puppet in place: out of the saddle and over the bars for
 * the race (hips up and forward, a deep sink on every downstroke, the neck
 * stretched ahead), and a slow balancing sway of body and handlebar in the
 * crawl. The wrist stays on the grip; the legs are re-solved to the pedals.
 */
function restage(skel, pel, u) {
  const st = standAt(u);
  const sw = swayAt(u);
  if (st < 1e-5 && sw < 1e-5) return;
  const S = skel.scale;
  const J = skel.joints;
  const stroke = 2 * pel.crank;
  const D = [
    S * st * (0.42 + 0.04 * Math.sin(stroke - 0.4)),
    S * st * (-0.26 + 0.12 * Math.cos(stroke - Math.PI)), // y down: sinks on each downstroke
  ];
  const Eh = [S * st * 0.85, S * st * 0.36]; // the head pushed out ahead
  const ph = (TAU * (u - 2.9)) / 0.85;
  const th = sw * 0.085 * Math.sin(ph); // the body rocks fore and aft about the hip
  const phi = sw * 0.11 * Math.sin(ph + 1.3); // the bars wobble
  const hip = J.hip;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const body = (p) => {
    const dx = p[0] - hip[0];
    const dy = p[1] - hip[1];
    return [hip[0] + dx * c - dy * s + D[0], hip[1] + dx * s + dy * c + D[1]];
  };
  const headT = (p) => {
    const q = body(p);
    return [q[0] + Eh[0], q[1] + Eh[1]];
  };
  const byId = new Map(skel.shapes.map((sh) => [sh.id, sh]));
  // the handlebar turns about the head tube
  const piv = byId.get("stem").pts[0];
  const cb = Math.cos(phi);
  const sb = Math.sin(phi);
  const bar = (p) => {
    const dx = p[0] - piv[0];
    const dy = p[1] - piv[1];
    return [piv[0] + dx * cb - dy * sb, piv[1] + dx * sb + dy * cb];
  };
  const grip = J.grip;
  const grip2 = bar(grip);
  const gd = [grip2[0] - grip[0], grip2[1] - grip[1]];
  const wingT = (p) => {
    const q = body(p);
    const w = 1 - smoothstep(0.35 * S, 1.9 * S, Math.hypot(p[0] - grip[0], p[1] - grip[1]));
    return [q[0] + (p[0] + gd[0] - q[0]) * w, q[1] + (p[1] + gd[1] - q[1]) * w];
  };
  const nb = J.neckBase;
  const hd = J.head;
  const nl = Math.hypot(hd[0] - nb[0], hd[1] - nb[1]) || 1;
  const neckT = (p) => {
    const t = clamp(((p[0] - nb[0]) * (hd[0] - nb[0]) + (p[1] - nb[1]) * (hd[1] - nb[1])) / (nl * nl));
    const q = body(p);
    const e = t * t * (3 - 2 * t);
    return [q[0] + Eh[0] * e, q[1] + Eh[1] * e];
  };
  const HEAD = new Set(["crest", "pouch", "bill", "head", "eye", "pupil", "lid"]);
  const BODY = new Set(["body", "tail"]);
  const WING = new Set(["wing", "wingtip", "wingfold"]);
  const BAR = new Set(["bar", "grip", "bell"]);
  for (const sh of skel.shapes) {
    let T = null;
    if (HEAD.has(sh.tag)) T = headT;
    else if (BODY.has(sh.tag)) T = body;
    else if (WING.has(sh.tag)) T = wingT;
    else if (sh.tag === "neck") T = neckT;
    else if (BAR.has(sh.tag) || sh.id === "stem") T = bar;
    if (!T) continue;
    if (sh.pts) sh.pts = sh.pts.map(T);
    if (sh.c) sh.c = T(sh.c);
  }
  for (const k of ["head", "eye", "billBase", "billTip", "top"]) J[k] = headT(J[k]);
  for (const k of ["body", "shoulder", "neckBase", "tailRoot"]) J[k] = body(J[k]);
  J.grip = grip2;
  // the legs, re-solved from the lifted hip to the same ankles
  const hip2 = [hip[0] + D[0], hip[1] + D[1]];
  for (const side of ["Near", "Far"]) {
    const thigh = byId.get(`leg${side}Thigh`);
    const shin = byId.get(`leg${side}Shin`);
    const knee = thigh.pts[1];
    const ankle = shin.pts[1];
    const a = Math.hypot(knee[0] - hip[0], knee[1] - hip[1]);
    const b = Math.hypot(ankle[0] - knee[0], ankle[1] - knee[1]);
    const bend = Math.sign((ankle[0] - hip[0]) * (knee[1] - hip[1]) - (ankle[1] - hip[1]) * (knee[0] - hip[0])) || 1;
    const dx = ankle[0] - hip2[0];
    const dy = ankle[1] - hip2[1];
    const L = Math.hypot(dx, dy) || 1;
    const d = clamp(L, Math.abs(a - b) + 1e-3, a + b - 1e-3);
    const ux = dx / L;
    const uy = dy / L;
    const along = (a * a - b * b + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, a * a - along * along));
    // the knee on the same side of hip-ankle as before
    const k2 = [hip2[0] + ux * along - uy * h * bend, hip2[1] + uy * along + ux * h * bend];
    const cr = Math.sign(dx * (k2[1] - hip2[1]) - dy * (k2[0] - hip2[0])) || 1;
    const k3 = cr === bend ? k2 : [hip2[0] + ux * along + uy * h * bend, hip2[1] + uy * along - ux * h * bend];
    thigh.pts = [hip2, k3];
    shin.pts = [k3, ankle];
  }
  J.hip = hip2;
}

export const starry = {
  ...META,
  still: { u: 3.1 },

  motion(u) {
    return { x: motionX(u) };
  },

  init(stage) {
    stage.shader("starry/sky", VERT, SKY_FRAG);
    bakeLand(stage);
    warmPelican(stage);
  },

  render(stage, f) {
    const view = f.view;
    stage.origin();
    stage.rect(0, 0, f.w, f.h, C.prussian);

    // the sky, geared to the wheel
    const w0 = f.pelican.wheel;
    const w = w0 + extraWheel(f.u); // the spirals, stars and drift race ahead in bar 2
    const sh = stage.shader("starry/sky", VERT, SKY_FRAG);
    const uni = {
      uOrigin: [SKY.x0, SKY.y0],
      uSize: [SKY.x1 - SKY.x0, SKY.y1 - SKY.y0],
      uPx: view.k,
      uSpin: (w / 5) % TAU,
      uStar: (w / 2.5) % TAU,
      uStarB: (w0 / 2.5) % TAU,
      uMoon: (w0 / 12) % TAU,
      uDrift: (w * 2.6) % (4096 * 11.0), // the drift pattern repeats every 4096 strokes
    };
    stage.withView(view, () => {
      stage.shaderRect(sh, uni, SKY.x0, SKY.y0, SKY.x1 - SKY.x0, SKY.y1 - SKY.y0);
    });

    // hills, village, cypress, lane, field, signature
    const land = bakeLand(stage);
    stage.withView(view, () => {
      stage.image(land, LAND.x0, LAND.y0, LAND.x1 - LAND.x0, LAND.y1 - LAND.y0);
    });

    if (f.pelican.visible) {
      // untouched near both crossings
      const u = f.u;
      const k = smoothstep(0.6, 1.0, u) * (1 - smoothstep(5.0, 5.4, u));
      const a = actingAt(u);
      const act = { wind: 1 + (a.wind - 1) * k, headPitch: a.headPitch * k, eyeY: a.eyeY * k, neckStretch: a.neckStretch * k, lean: a.lean * k, bob: 1 + (a.bob - 1) * k };
      paintPelican(stage, f, act);
    }
  },
};
