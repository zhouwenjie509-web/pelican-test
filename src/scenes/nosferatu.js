// Section 14. Nosferatu: a silent film, 1922.
//
// A plastered wall in a tall, dim house, lit from somewhere low and out of
// sight: a hall with a cinema poster, then a staircase with a turned
// balustrade rising to a landing with an arched door. The pelican itself is
// never seen, only its shadow on the wall: near-black, soft-edged. It glides
// along the hall and climbs the stairs, growing and leaning; on the strong
// beat its four flight feathers spring out into long fingers; on the next
// downbeat the door at the head of the stairs swings open by itself and cold
// light falls out. From u = 5.5 the outline catches green fire from the bill
// backwards and runs on, through the picture frame, into Section 15's
// oscilloscope trace.
//
// The whole picture is a print of a film: grey values mapped to a cold
// duotone, with grain, flicker, gate weave, dust, hairs, scratches and a
// vignette, all functions of an 18 Hz film clock. The scene sets poseHz: 18,
// so the shadow moves at silent-film cadence; the camera stays smooth.
//
// Layers, back to front (all in grey, inside one scene buffer):
//   wall, stair, landing, door surround, poster     baked once (shader + 2D canvas)
//   the door: dark doorway, its light, the leaf     per frame, from small bakes
//   the shadow                                      per frame: a 2D mask, blurred on the GPU
//   balustrade, handrail, newel posts               baked once, drawn over the shadow
//   dust and hairs                                  per film frame
// then one full-frame film pass onto the target (weave, flicker, grain,
// scratches, vignette, duotone, the green light on the wall), and last, from
// u = 5.42, the fire: Section 15's beam strokes drawn with drawPhosphor into a
// buffer of their own, laid on the film over a dark scorch and multiplied by
// (1 - the mask of the shadow's fat parts), so no light falls inside the black.
// Just ahead of the fire front the thin members (wheels, frame, legs) lose
// their shadow, so that behind it they are only light.

import { sectionMeta } from "./sections.js";
import { Layer2D, View } from "../kit/stage.js";
import { VERT, FRAG_HEAD, NOISE, rgb } from "../kit/glsl.js";
import { hash, rng, noise1 } from "../kit/rng.js";
import { solveRig } from "../rig/rig.js";
import { drawPhosphor } from "../rig/skins/phosphor.js";
import { clamp, lerp, smoothstep, easeOutBack, TAU } from "../beat/ease.js";
import { stepTime } from "../beat/timeline.js";

const META = sectionMeta(14);

// ------------------------------------------------------------------ the road (kept exactly as given)
const road = (x) => 700 - 110 * smoothstep(340, 760, x);

// ------------------------------------------------------------------ film
const HZ = 18; // the film clock
const DEEP = "#06100f";
const MID = "#2f5a57";
const LIGHT = "#cfe6dc";
const MID_AT = 0.42; // grey value that maps to MID
const BEAM = "#59ff8a"; // Section 15's beam
const BEAM_DEEP = "#1fae4d";

// ------------------------------------------------------------------ the set (world units)
const SET = { x0: -60, x1: 1060, y0: 420, y1: 800 };
const FRONT = { x0: 300, x1: 800, y0: 480, y1: 712 };
const BAKE_PX = 3.3; // layer pixels per world unit at 1080p
const LAMP = [560, 960]; // the lamp below the stairwell, out of sight
const RAIL_H = 70; // handrail centre above the nosings
const TOP_ROOM = 454; // nothing of the shadow above this (the camera sees down from y = 439)
const RAIL_T = 9; // its thickness

/** x where the road reaches height y, on the stair. */
function invRoad(y) {
  let a = 340;
  let b = 760;
  for (let i = 0; i < 40; i += 1) {
    const m = (a + b) / 2;
    if (road(m) > y) a = m;
    else b = m;
  }
  return (a + b) / 2;
}

// the bottom (curtail) step is met by the front wheel at u = 2.0; the others
// have their nosings on the road curve, ten rises to the landing
const CURTAIL = [381, 693];
const NOSINGS = (() => {
  const out = [CURTAIL];
  const n = 9;
  for (let k = 1; k <= n; k += 1) {
    const y = CURTAIL[1] - ((CURTAIL[1] - 590) * k) / n;
    out.push([k === n ? 760 : invRoad(y), y]);
  }
  return out;
})();

/** Height of the step surface under x. */
function treadY(x) {
  if (x < CURTAIL[0]) return 700;
  let y = 700;
  for (const [nx, ny] of NOSINGS) if (x >= nx - 1e-6) y = ny;
  return y;
}

const railY = (x) => road(x) - RAIL_H;

const NEWEL_LOW = { x: 403, w: 8.4 }; // on the bottom step, clear of the front wheel at u = 2.0
const NEWEL_TOP = { x: 766, w: 8.4 };
const BALUSTERS = (() => {
  const out = [];
  const x0 = 427;
  const x1 = 748;
  const n = 12;
  for (let i = 0; i < n; i += 1) {
    let x = lerp(x0, x1, i / (n - 1));
    // keep clear of the risers
    for (const [nx] of NOSINGS) if (Math.abs(x - nx) < 4) x = nx + 4.5;
    out.push(x);
  }
  return out;
})();

const DOOR = { x0: 800, x1: 880, y0: 445, y1: 590, spring: 485 }; // arch springs at y = 485
const POSTER = { x0: 70, x1: 310, y0: 444, y1: 554 };

const ZH_FONT = "'Weibei SC', 'Baoli SC', 'STHeiti', serif";

const grey = (v, a = 1) => {
  const c = Math.round(clamp(v) * 255);
  return a >= 1 ? `rgb(${c},${c},${c})` : `rgba(${c},${c},${c},${a})`;
};

// ------------------------------------------------------------------ timing (u, seconds)
/** How far the shadow is stretched up the wall: 0 on the level, 1 at mid-flight (u = 3.0). */
const climbAt = (u) => smoothstep(1.85, 3.0, u) * (1 - smoothstep(3.6, 4.7, u));
/** The wing lifting from the handlebar. */
const wingAt = (u) => smoothstep(2.4, 2.9, u) * (1 - smoothstep(4.6, 5.2, u));
/**
 * The feather fingers: folded until the strong beat, then sprung out within 0.12 s; lowered from 4.6.
 * The pose steps at 18 Hz, so the spring is timed as if it began at u = 2.94: the film frame
 * that begins on the beat (u = 3.0) already shows them about half out, the one before is folded.
 */
const SPRING = 2.94;
function handOpenAt(u) {
  if (u < 3.0 - 1e-4) return 0;
  return easeOutBack(clamp((u - SPRING) / 0.12), 2.0) * (1 - smoothstep(4.6, 5.05, u));
}
/** Their length: they keep creeping longer while the hand is up. */
const handLenAt = (u) => {
  const open = clamp(handOpenAt(u));
  return lerp(0.42, 1, open) * (1 + 0.18 * smoothstep(SPRING + 0.12, 4.5, u) * open) * (u >= 3.0 - 1e-4 && u < SPRING + 0.12 ? 1 + 0.08 * Math.sin(Math.PI * (u - SPRING) / 0.12) : 1);
};
/** The door: 0 shut .. 1 open (about 78 degrees). */
const doorAt = (u) => {
  const v = clamp((u - 4.0) / 0.6);
  return v < 1 ? 1 - (1 - v) ** 2.4 : 1;
};
/** The light behind it. */
const doorLightAt = (u) => smoothstep(4.0, 4.28, u);
/** How much of the gate weave the shadow shares (none near the crossings). */
const weaveShare = (u) => smoothstep(0.6, 0.9, u) * (1 - smoothstep(5.1, 5.4, u));
/** How far the shadow departs from the puppet (longer bill and neck): 0 near both crossings. */
const uncannyAt = (u) => smoothstep(0.6, 1.3, u) * (1 - smoothstep(4.7, 5.4, u));
/** The fire: how far it has run back along the outline, 0 .. 1. */
const burnAt = (u) => clamp((u - 5.5) / 0.45);
/** From here the shadow takes Section 15's unstepped pose and the bill tip starts to glow (alight by 5.5). */
const HANDOVER = 5.42;
/** The pedalling legs drawn a little heavier in the shadow, away from the crossings. */
const legsAt = (u) => smoothstep(0.6, 1.2, u) * (1 - smoothstep(4.9, 5.4, u));
const LEG_TAGS = new Set(["leg", "foot", "crank", "pedal"]);

// ------------------------------------------------------------------ Section 15's beam strokes
// The hand-over must meet Section 15's trace exactly, so the outline is built
// the way scope.js builds it (figureStrokes, sparks, instability, echoes):
// these functions repeat that file's logic. (Kit request: export them.)
const S15 = { tubeY: 612, tubeR: 168, echoes: 3, echoDt: 1 / 30, echoDy: 1.2 };
const SKIP_TAGS = new Set(["chain", "spoke", "reflector", "lid", "crank", "pedal"]);
const MOVING_TAGS = new Set(["spoke", "leg", "foot", "crank", "pedal", "spark"]);
const echoWeight = (k) => 0.26 * Math.pow(0.5, k - 1);
const electrified = (u15) => smoothstep(-0.5, -0.32, u15) * (1 - smoothstep(0.1, 0.6, u15));

function circlePts(cx, cy, r, n) {
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const a = (i / n) * TAU;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

function figureStrokes(pose) {
  const skel = solveRig({ ...pose, act: { wind: 0.8 } });
  const S = skel.scale;
  const out = [];
  const slope = pose.slope || 0;
  for (const sh of skel.shapes) {
    if (SKIP_TAGS.has(sh.tag) || sh.id === "cog") continue;
    const far = sh.side === "far";
    const a = far ? 0.62 : 1;
    if (sh.kind === "circle") {
      const n = Math.max(10, Math.min(40, Math.round(sh.r * 1.1)));
      if (sh.tag === "pupil") {
        out.push({ pts: circlePts(sh.c[0], sh.c[1], sh.r * 0.7, 8), closed: true, a: 1.3, w: 1.1, ends: 0, tag: sh.tag });
        continue;
      }
      out.push({ pts: circlePts(sh.c[0], sh.c[1], sh.r, n), closed: true, a: sh.tag === "rim" ? 0.7 : a, w: sh.tag === "rim" ? 0.75 : 1, ends: 0, tag: sh.tag });
      if (sh.tag === "rim") {
        const c = sh.c;
        for (let i = 0; i < 6; i += 1) {
          const ang = -pose.wheel + (i / 6) * TAU + slope;
          const dx = Math.cos(ang);
          const dy = -Math.sin(ang);
          out.push({ pts: [[c[0] + dx * S * 0.1, c[1] + dy * S * 0.1], [c[0] + dx * S * 0.84, c[1] + dy * S * 0.84]], closed: false, a: 0.62, w: 0.7, ends: 0.6, tag: "spoke" });
        }
      }
    } else if (sh.kind === "line") {
      if (sh.tag === "leg") {
        out.push({ pts: sh.pts, closed: false, a: far ? 0.8 : 1.3, w: far ? 1.0 : 1.35, ends: 1.2, tag: sh.tag });
        continue;
      }
      out.push({ pts: sh.pts, closed: false, a: sh.tag === "frame" ? a * 0.62 : a, w: sh.tag === "frame" ? 0.85 : 1, ends: 1, tag: sh.tag });
    } else {
      out.push({ pts: sh.pts.concat([sh.pts[0]]), closed: true, a, w: 1, ends: 0.8, tag: sh.tag });
    }
  }
  for (const side of ["far", "near"]) {
    const bb = skel.joints.bb;
    const pd = side === "near" ? skel.joints.pedalNear : skel.joints.pedalFar;
    const a = side === "far" ? 0.62 : 1;
    const ux = Math.cos(slope) * S * 0.2;
    const uy = -Math.sin(slope) * S * 0.2;
    out.push({ pts: [bb, pd], closed: false, a, w: 1, ends: 1, tag: "crank" });
    out.push({ pts: [[pd[0] - ux, pd[1] - uy], [pd[0] + ux, pd[1] + uy]], closed: false, a, w: 1.2, ends: 1, tag: "pedal" });
  }
  return out;
}

function sparks(strokes, t, amount) {
  if (amount <= 0.02) return [];
  const q = Math.floor(t * 30 + 1e-6);
  const R = rng(Math.floor(hash(q, 1515) * 4294967296));
  const out = [];
  const n = Math.round(9 * amount + 1);
  for (let i = 0; i < n; i += 1) {
    const st = strokes[Math.floor(R() * strokes.length)];
    const j = Math.floor(R() * st.pts.length);
    const p0 = st.pts[j];
    const p1 = st.pts[Math.min(st.pts.length - 1, j + 1)];
    const p_ = st.pts[Math.max(0, j - 1)];
    let ang = Math.atan2(p1[1] - p_[1], p1[0] - p_[0]) + ((R() < 0.5 ? 1 : -1) * Math.PI) / 2 + (R() - 0.5) * 0.8;
    let x = p0[0];
    let y = p0[1];
    const pts = [[x, y]];
    const segs = 3 + Math.floor(R() * 4);
    const reach = 3.5 + R() * 5;
    for (let k = 0; k < segs; k += 1) {
      ang += (R() - 0.5) * 1.9;
      const len = reach * (0.6 + 0.6 * R());
      x += Math.cos(ang) * len;
      y += Math.sin(ang) * len;
      pts.push([x, y]);
      if (k === 1 && R() < 0.5) {
        const fa = ang + (R() < 0.5 ? 0.9 : -0.9);
        out.push({ pts: [[x, y], [x + Math.cos(fa) * reach * 0.8, y + Math.sin(fa) * reach * 0.8]], closed: false, a: 1.2, w: 0.7, ends: 1.2, tag: "spark" });
      }
    }
    out.push({ pts, closed: false, a: 1.5 + 0.9 * R(), w: 0.8, ends: 1.6, tag: "spark" });
  }
  return out;
}

function instability(lines, t, cx, cy) {
  const frame = Math.floor(t * 60 + 1e-6);
  const jx = (hash(frame, 1501) - 0.5) * 0.55;
  const jy = (hash(frame, 1502) - 0.5) * 0.12;
  const breathe = 1 + 0.0028 * Math.sin(TAU * 0.83 * t);
  const yb = cy + S15.tubeR - ((t * 0.41) % 1) * (2 * S15.tubeR + 60) + 30;
  for (const ln of lines) {
    ln.pts = ln.pts.map(([x, y]) => {
      const band = Math.exp(-(((y - yb) / 16) ** 2));
      return [cx + (x - cx) * breathe + jx + 0.5 * band, cy + (y - cy) * breathe + jy];
    });
  }
  return lines;
}

/**
 * The beam strokes exactly as Section 15 draws its pelican at film time t
 * (live figure, sparks and afterglow echoes), in Section 15's coordinates.
 */
function scopeTrace(film, t) {
  const now = film.pelicanFor(15, t);
  const px = now.x;
  const u15 = t - 89;
  const lines = [];
  for (let k = S15.echoes; k >= 0; k -= 1) {
    const tk = t - k * S15.echoDt;
    const pose = film.pelicanFor(15, tk);
    const shift = px - pose.x;
    const figure = figureStrokes({ ...pose, x: pose.x + shift });
    const e = electrified(tk - 89);
    if (k === 0) {
      const ln = figure.concat(sparks(figure, tk, e));
      instability(ln, tk, px, S15.tubeY);
      lines.push(...ln);
      continue;
    }
    const dy0 = now.y - pose.y;
    const dy = dy0 - clamp(dy0, -S15.echoDy, S15.echoDy);
    const ln = figure.filter((st) => MOVING_TAGS.has(st.tag)).concat(sparks(figure, tk, e));
    if (dy !== 0) for (const l of ln) l.pts = l.pts.map(([x, y]) => [x, y + dy]);
    instability(ln, tk, px, S15.tubeY);
    const a = echoWeight(k);
    for (const l of ln) lines.push({ ...l, a: l.a * a * (l.tag === "spoke" ? 0.8 : 1), ends: 0, coarse: true });
  }
  return { lines, pose: now, e: electrified(u15) };
}

/** The parts of a polyline with x >= xf. */
function clipFromX(pts, xf) {
  const out = [];
  let cur = null;
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i];
    const inside = p[0] >= xf;
    if (i > 0) {
      const q = pts[i - 1];
      const qin = q[0] >= xf;
      if (inside !== qin) {
        const s = (xf - q[0]) / (p[0] - q[0]);
        const m = [q[0] + (p[0] - q[0]) * s, q[1] + (p[1] - q[1]) * s];
        if (inside) cur = [m];
        else if (cur) {
          cur.push(m);
          if (cur.length > 1) out.push(cur);
          cur = null;
        }
      }
    } else if (inside) cur = [];
    if (inside) {
      if (!cur) cur = [];
      cur.push(p);
    }
  }
  if (cur && cur.length > 1) out.push(cur);
  return out;
}

// ------------------------------------------------------------------ shaders
const WALL_FRAG = `${FRAG_HEAD}
uniform vec2 uOrigin;
uniform vec2 uSize;
uniform vec2 uLamp;
${NOISE}
float road(float x) {
  float t = clamp((x - 340.0) / 420.0, 0.0, 1.0);
  return 700.0 - 110.0 * t * t * (3.0 - 2.0 * t);
}
void main() {
  vec2 w = uOrigin + vTexCoord * uSize;
  float h = road(w.x) - w.y;                       // height above the shadow's road
  // the lit band along the road: the light comes from low down, so the wall is
  // brightest just above the floor line and falls into darkness higher up
  float edge = 236.0 + 46.0 * (fbm(w / 70.0) - 0.5) + 0.12 * (w.x - 400.0) * step(w.x, 400.0) * 0.0;
  float band = 1.0 - smoothstep(edge - 34.0, edge + 40.0, h);
  float near = 1.0 - 0.22 * smoothstep(10.0, 230.0, h);
  float lampX = exp(-pow((w.x - uLamp.x) / 760.0, 2.0));
  float g = mix(0.075, 0.86, band) * near * mix(0.9, 1.0, lampX);
  // expressionist light: faint painted rays fanning up from the lamp
  vec2 d = w - uLamp;
  float ang = atan(d.x, -d.y);
  float rays = smoothstep(0.25, 0.75, sin(ang * 23.0 + 2.2 * fbm(w / 160.0)));
  g *= 1.0 - 0.07 * rays * band;
  // a hard diagonal fall-off into the upper corners
  float corner = smoothstep(0.0, 70.0, (w.y - 430.0) + 0.0 * w.x);
  // plaster: mottled, with damp stains and worn patches
  g *= 0.93 + 0.1 * fbm(w / 6.5) + 0.07 * (fbm(w / 40.0 + 3.0) - 0.5);
  float st = smoothstep(0.6, 0.78, fbm(w / 55.0 + 21.0));
  g *= 1.0 - 0.09 * st;
  fragColor = vec4(vec3(g), 1.0);
}`;

// soft shadow: the silhouette mask blurred with a jittered disc of taps. The mask
// holds the body in red and the legs, feet, cranks and pedals in green; the legs
// keep a tight edge (uRadiusL) while the body's softens as the shadow stretches.
const SHADOW_FRAG = `${FRAG_HEAD}
uniform sampler2D uMask;
uniform vec2 uTexel;
uniform vec2 uUV0;      // the used part of the mask layer
uniform vec2 uUVs;
uniform float uRadius;  // pixels
uniform float uRadiusL; // pixels, for the legs
uniform float uRadiusH; // pixels, for the arm and hand (blue)
uniform float uAlpha;
uniform float uTone;
uniform vec2 uOrigin;   // target pixels of the rect's top-left
uniform vec2 uSize;     // its size in target pixels
uniform vec2 uFade;     // the hand-over: thin members (green) fade out from x to x + w (target pixels)
${NOISE}
void main() {
  vec2 uv = uUV0 + vTexCoord * uUVs;
  float px = uOrigin.x + vTexCoord.x * uSize.x;
  float rot = hash21(gl_FragCoord.xy) * 6.2831853;
  vec3 c0 = texture(uMask, uv).rgb * 0.5;
  float sb = c0.r;
  float sl = c0.g;
  float sh = c0.b;
  float wsum = 0.5;
  for (int i = 0; i < 24; i++) {
    float fi = float(i);
    float q = sqrt((fi + 0.5) / 24.0);
    float a = fi * 2.3999632 + rot;
    vec2 d = vec2(cos(a), sin(a)) * q * uTexel;
    sb += texture(uMask, uv + d * uRadius).r;
    sl += texture(uMask, uv + d * uRadiusL).g;
    sh += texture(uMask, uv + d * uRadiusH).b;
    wsum += 1.0;
  }
  // behind the fire front the thin members keep no shadow: they have turned into light
  sl *= 1.0 - smoothstep(uFade.x, uFade.x + uFade.y, px);
  float s = max(max(sb, sl), sh) / wsum;
  s = smoothstep(0.0, 1.0, s);
  float a = s * uAlpha;
  fragColor = vec4(vec3(uTone) * a, a);
}`;

// the hand-over: the trace is drawn into a buffer of its own and added to the
// picture here, multiplied by (1 - m), where m is the mask of the shadow's fat parts
// (body, head, bill, pouch, wing, tail; the red channel of its mask), soft over about
// 1.5 units from the edge inwards: no light can fall inside the black. uMode 0 lays
// the scorch first (multiplied): darkest within 3 units of a stroke, gone by 11,
// so the wall goes dark round the burning lines as the tube beyond the frame is dark.
// Nothing of either pass falls below the floor line.
const TRACE_FRAG = `${FRAG_HEAD}
uniform sampler2D uTrace;
uniform sampler2D uScorch;
uniform sampler2D uMask;
uniform vec2 uRes;      // target pixels
uniform vec2 uOrigin;   // target pixels of this rect's top-left
uniform vec2 uSize;
uniform vec2 uScO;      // the scorch layer's rect in target pixels
uniform vec2 uScS;
uniform vec2 uScUV;     // the used part of the scorch layer
uniform vec2 uMO;       // the shadow mask's rect in target pixels
uniform vec2 uMS;
uniform vec2 uMUV;      // the used part of the mask layer
uniform float uSoft;    // pixels: the width of m's ramp
uniform float uMode;
uniform float uDark;    // how far the scorch darkens (0.75: to a quarter)
uniform float uCore;    // and how much further right under the core
uniform float uFloor;   // target pixel row of the floor line: no scorch and no light below it
float fat(vec2 px) {
  vec2 q = (px - uMO) / uMS;
  if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) return 0.0;
  return texture(uMask, q * uMUV).r;
}
void main() {
  vec2 px = uOrigin + vTexCoord * uSize;
  float a = fat(px) * 2.0;
  for (int i = 0; i < 12; i++) {
    float an = float(i) * 0.5235988;
    a += fat(px + vec2(cos(an), sin(an)) * uSoft);
  }
  a /= 14.0;
  float m = smoothstep(0.5, 0.97, a);
  float fl = 1.0 - smoothstep(uFloor, uFloor + uSoft, px.y);
  if (uMode < 0.5) {
    vec2 qs = (px - uScO) / uScS;
    vec2 near = vec2(0.0);
    if (qs.x >= 0.0 && qs.y >= 0.0 && qs.x <= 1.0 && qs.y <= 1.0) near = texture(uScorch, qs * uScUV).rg;
    float k = (1.0 - uDark * near.x) * (1.0 - uCore * near.y);
    fragColor = vec4(vec3(mix(1.0, k, (1.0 - m) * fl)), 1.0);
  } else {
    vec3 c = texture(uTrace, px / uRes).rgb;
    fragColor = vec4(c * (1.0 - m) * fl, 1.0);
  }
}`;

const FILM_FRAG = `${FRAG_HEAD}
uniform sampler2D uScene;
uniform vec2 uRes;       // target pixels
uniform float uS;        // pixels per 1080p pixel
uniform vec2 uWeave;     // pixels
uniform float uFlick;
uniform float uTilt;
uniform float uFrame;
uniform vec3 uScrX;      // scratch positions (0..1 across)
uniform vec3 uScrA;      // scratch strengths: + light, - dark
uniform vec3 uScrW;      // scratch widths (1080p pixels)
uniform float uVig;
uniform vec4 uKeep;      // the poster, in target pixels: kept out of the vignette so its lettering holds
uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uLight;
uniform float uMidAt;
uniform vec3 uGlow;      // centre x, y (pixels), radius (pixels)
uniform float uGlowAmt;
uniform vec3 uGlowCol;
${NOISE}
void main() {
  vec2 px = vTexCoord * uRes;
  vec2 uv = (px - uWeave) / uRes;
  vec2 tx = 1.0 / uRes;
  uv = clamp(uv, tx, 1.0 - tx);
  // a soft print: a little of the neighbours
  vec2 o = tx * 0.9 * uS;
  float g = texture(uScene, uv).r * 0.52
    + (texture(uScene, uv + vec2(o.x, 0.0)).r + texture(uScene, uv - vec2(o.x, 0.0)).r
     + texture(uScene, uv + vec2(0.0, o.y)).r + texture(uScene, uv - vec2(0.0, o.y)).r) * 0.12;
  // halation: the brightest light (the open doorway) blooms into the emulsion around it
  float hal = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398 + 0.39;
    vec2 ho = vec2(cos(a), sin(a)) * 16.0 * uS * tx;
    hal += max(texture(uScene, uv + ho).r - 0.78, 0.0);
  }
  g += hal * 0.11;
  // flicker: the whole frame, a little unevenly
  g *= uFlick * (1.0 + uTilt * (vTexCoord.x - 0.5));
  // uneven density of an old print: large soft blotches, new on every film frame
  g *= 1.0 + 0.05 * (vnoise(px / (210.0 * uS) + vec2(uFrame * 1.71, uFrame * 0.93)) - 0.5);
  // scratches on the print
  for (int i = 0; i < 3; i++) {
    float sx = (i == 0 ? uScrX.x : i == 1 ? uScrX.y : uScrX.z) * uRes.x;
    float sa = i == 0 ? uScrA.x : i == 1 ? uScrA.y : uScrA.z;
    float sw = (i == 0 ? uScrW.x : i == 1 ? uScrW.y : uScrW.z) * uS;
    float wob = (vnoise(vec2(px.y / (60.0 * uS), uFrame * 0.37 + float(i) * 9.0)) - 0.5) * 2.0 * uS;
    float dd = abs(px.x - sx - wob);
    float l = exp(-dd * dd / max(sw * sw, 0.01));
    float broken = smoothstep(0.25, 0.45, vnoise(vec2(px.y / (90.0 * uS) + float(i) * 13.0, uFrame * 0.21)));
    l *= broken;
    g = sa > 0.0 ? mix(g, 0.97, l * sa) : mix(g, 0.02, l * -sa);
  }
  // grain: new on every film frame, strongest in the mid tones
  vec2 gp = px / uS;
  float n = hash21(floor(gp / 1.6) + vec2(uFrame * 17.13, uFrame * 7.31))
          + hash21(floor(gp / 3.1) + vec2(uFrame * 3.71, uFrame * 11.9) + 50.0) * 0.8
          + vnoise(gp / 5.0 + uFrame * 31.7) * 0.6;
  g += (n / 2.4 - 0.5) * (0.06 + 0.16 * g * (1.0 - g));
  // vignette: the projector's hot centre and dim corners
  vec2 c = vTexCoord - 0.5;
  c.x *= uRes.x / uRes.y;
  float r2 = dot(c, c);
  float soft = 14.0 * uS;
  float keep = smoothstep(uKeep.x - soft, uKeep.x + soft, px.x) * (1.0 - smoothstep(uKeep.z - soft, uKeep.z + soft, px.x))
             * smoothstep(uKeep.y - soft, uKeep.y + soft, px.y) * (1.0 - smoothstep(uKeep.w - soft, uKeep.w + soft, px.y));
  g *= 1.0 - uVig * smoothstep(0.12, 0.75, r2) * (1.0 - 0.85 * keep);
  g = clamp(g, 0.0, 1.0);
  // contrast: deep blacks, soft highlights
  g = smoothstep(0.03, 0.97, g);
  vec3 col = g < uMidAt ? mix(uDeep, uMid, pow(g / uMidAt, 1.15)) : mix(uMid, uLight, pow((g - uMidAt) / (1.0 - uMidAt), 0.9));
  // the green light from the burning outline, falling on the lit wall only
  if (uGlowAmt > 0.0) {
    float gd = length(px - uGlow.xy) / uGlow.z;
    col += uGlowCol * uGlowAmt * exp(-gd * gd * 2.2) * (0.25 + g);
  }
  fragColor = vec4(col, 1.0);
}`;

// ------------------------------------------------------------------ bakes
function setView(stage, box = SET) {
  const k = BAKE_PX * stage.s;
  return { k, w: (box.x1 - box.x0) * k, h: (box.y1 - box.y0) * k, apply: (ctx) => ctx.setTransform(k, 0, 0, k, -box.x0 * k, -box.y0 * k) };
}

function pathPoly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function line(ctx, pts, w, color) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.stroke();
}

/** The step profile from the hall floor up to the landing, as a polyline. */
function stepProfile() {
  const pts = [[CURTAIL[0] - 6, 700]];
  // the curtail step has a rounded nose
  pts.push([CURTAIL[0] - 6, 697], [CURTAIL[0] - 4, 694], [CURTAIL[0], 693]);
  for (let k = 1; k < NOSINGS.length; k += 1) {
    const [x, y] = NOSINGS[k];
    const py = NOSINGS[k - 1][1];
    pts.push([x, py], [x, y]);
  }
  pts.push([SET.x1 + 10, 590]);
  return pts;
}

function paintCracks(ctx, R) {
  // a few hairline cracks in the plaster, well off the shadow's path
  const seeds = [[-30, 446], [120, 438], [430, 470], [610, 446], [960, 442], [250, 590]];
  for (const [sx, sy] of seeds) {
    let x = sx;
    let y = sy;
    let ang = 0.9 + R() * 1.4;
    const pts = [[x, y]];
    const n = 7 + Math.floor(R() * 6);
    for (let i = 0; i < n; i += 1) {
      ang += (R() - 0.5) * 0.9;
      const l = 3 + R() * 5;
      x += Math.cos(ang) * l;
      y += Math.sin(ang) * l * 0.7;
      pts.push([x, y]);
    }
    line(ctx, pts, 0.32, "rgba(0,0,0,0.22)");
  }
}

// NOSFERATU in heavy, angular, hand-cut capitals: each letter a few polygons on a
// unit cap height (y 0 at the top, 1 at the baseline), `w` wide; `holes` are counters
// cut back to the ground. t is the stem weight.
const CUT_T = 0.25;
const GLYPHS = (() => {
  const t = CUT_T;
  return {
    N: { w: 0.74, solids: [
      [[0, 0.05], [t, 0], [t + 0.02, 1], [0, 1]],
      [[0.74 - t, 0], [0.74, 0], [0.74, 0.95], [0.74 - t - 0.02, 1]],
      [[0, 0], [t + 0.06, 0], [0.74, 1], [0.74 - t - 0.07, 1]],
    ] },
    O: { w: 0.76, solids: [
      [[0.17, 0], [0.62, 0.02], [0.76, 0.2], [0.75, 0.8], [0.6, 1], [0.15, 0.98], [0, 0.8], [0.02, 0.17]],
    ], holes: [[[0.37, t * 0.85], [0.76 - t * 0.9, 0.48], [0.39, 1 - t * 0.85], [t * 0.95, 0.52]]] },
    S: { w: 0.66, solids: [
      [[0.1, 0], [0.66, 0.02], [0.6, t], [t + 0.02, t], [0.66, 0.6], [0.65, 0.86], [0.54, 1], [0, 0.98], [0.06, 1 - t], [0.66 - t - 0.02, 1 - t], [0, 0.4], [0.01, 0.13]],
    ] },
    F: { w: 0.6, solids: [
      [[0, 0], [t, 0], [t + 0.03, 1], [-0.01, 1]],
      [[0, 0], [0.6, 0], [0.54, t * 0.95], [0, t * 0.95]],
      [[0, 0.44], [0.5, 0.42], [0.45, 0.42 + t * 0.8], [0, 0.44 + t * 0.8]],
    ] },
    E: { w: 0.6, solids: [
      [[0, 0], [t, 0], [t, 1], [0, 1]],
      [[0, 0], [0.6, 0.01], [0.55, t * 0.92], [0, t * 0.92]],
      [[0, 0.43], [0.49, 0.41], [0.46, 0.41 + t * 0.8], [0, 0.43 + t * 0.8]],
      [[0, 1 - t * 0.92], [0.56, 1 - t * 0.9], [0.62, 1], [0, 1]],
    ] },
    R: { w: 0.7, solids: [
      [[0, 0], [t, 0], [t + 0.02, 1], [0, 1]],
      [[0, 0], [0.5, 0], [0.68, 0.14], [0.66, 0.4], [0.5, 0.56], [0, 0.56]],
      [[0.3, 0.5], [0.3 + t * 1.15, 0.5], [0.72, 1], [0.72 - t * 1.2, 1]],
    ], holes: [[[t, t * 0.8], [0.43, t * 0.8], [0.66 - t * 0.95, 0.24], [0.44, 0.56 - t * 0.85], [t, 0.56 - t * 0.85]]] },
    A: { w: 0.76, solids: [
      [[0, 1], [0.27, 0], [0.52, 0], [0.78, 1], [0.78 - t * 1.4, 1], [0.78 - t * 1.4 - 0.04, 0.78], [t * 1.2 + 0.05, 0.78], [t * 1.2, 1]],
    ], holes: [[[0.4, t * 0.95], [0.49, 0.56], [0.29, 0.56]]] },
    T: { w: 0.68, solids: [
      [[0, 0.03], [0.68, 0], [0.64, t * 0.95], [0.03, t * 0.95]],
      [[0.34 - t / 2, 0.1], [0.34 + t / 2, 0.1], [0.34 + t / 2 + 0.04, 1], [0.34 - t / 2 - 0.05, 1]],
    ] },
    U: { w: 0.72, solids: [
      [[0, 0], [t, 0], [t, 0.7], [0.36, 1 - t * 0.9], [0.72 - t, 0.7], [0.72 - t, 0], [0.72, 0], [0.72, 0.8], [0.54, 1], [0.18, 1], [0, 0.82]],
    ] },
  };
})();

/** Pairs set closer than the plain gap (in cap heights): the T's bar tucks in over the A's slope. */
const KERN = { AT: -0.2 };

/** Set `text` in the cut letters, centred on cx, cap height H from yTop; returns nothing. */
function cutLetters(ctx, text, cx, yTop, H, gap, ink, ground) {
  const R = rng(2214);
  const chars = [...text];
  const letters = chars.map((ch) => GLYPHS[ch]);
  const kern = (i) => (i + 1 < chars.length ? KERN[chars[i] + chars[i + 1]] || 0 : 0);
  const total = letters.reduce((s, g, i) => s + g.w * H + (i + 1 < letters.length ? (gap + kern(i)) * H : 0), 0);
  let x = cx - total / 2;
  for (let i = 0; i < letters.length; i += 1) {
    const g = letters[i];
    // each letter cut by hand: its own slant, a slight tilt and a wandering baseline
    const shear = (R() - 0.5) * 0.26;
    const rot = (R() - 0.5) * 0.05;
    const dy = (R() - 0.5) * 0.9;
    const sc = 1 + (R() - 0.5) * 0.06;
    ctx.save();
    ctx.translate(x + (g.w * H) / 2, yTop + H + dy);
    ctx.rotate(rot);
    ctx.transform(1, 0, -shear, 1, 0, 0);
    ctx.scale(H * sc, H * sc);
    ctx.translate(-g.w / 2, -1);
    ctx.fillStyle = ink;
    for (const poly of g.solids) {
      pathPoly(ctx, poly);
      ctx.fill();
    }
    ctx.fillStyle = ground;
    for (const poly of g.holes || []) {
      pathPoly(ctx, poly);
      ctx.fill();
    }
    ctx.restore();
    x += g.w * H + (gap + kern(i)) * H;
  }
}

/** A wavy, slightly nicked edge from a to b (world units). */
function raggedEdge(R, a, b, n, amp) {
  const out = [];
  const ph = R() * 6;
  for (let i = 0; i < n; i += 1) {
    const s = i / n;
    const nx = -(b[1] - a[1]);
    const ny = b[0] - a[0];
    const l = Math.hypot(nx, ny) || 1;
    const off = amp * (0.6 * Math.sin(s * 9 + ph) + 0.5 * (R() - 0.5)) + (R() < 0.06 ? -amp * 1.6 : 0);
    out.push([a[0] + (b[0] - a[0]) * s + (nx / l) * off, a[1] + (b[1] - a[1]) * s + (ny / l) * off]);
  }
  return out;
}

/** A jagged tear from a to b. */
function tearEdge(R, a, b, n, amp) {
  const out = [];
  for (let i = 0; i <= n; i += 1) {
    const s = i / n;
    const j = i === 0 || i === n ? 0 : (R() - 0.5) * 2 * amp;
    const nx = -(b[1] - a[1]);
    const ny = b[0] - a[0];
    const l = Math.hypot(nx, ny) || 1;
    out.push([a[0] + (b[0] - a[0]) * s + (nx / l) * j, a[1] + (b[1] - a[1]) * s + (ny / l) * j]);
  }
  return out;
}

/**
 * The title: a printed sheet pasted on the plaster. A dark ink field printed on pale
 * paper, the lettering reversed out of it (paper showing through); a torn top-left
 * corner, a bottom-right corner come unstuck and lifting, paste wrinkles, printed grain.
 */
function paintPoster(ctx, R) {
  const { x0, x1, y0, y1 } = POSTER;
  const w = x1 - x0;
  const cx = (x0 + x1) / 2;
  const PAPER = grey(0.84);
  const INK = grey(0.05);
  // the sheet's outline: four ragged edges, the top-left corner torn away,
  // the bottom-right corner folded back (the flap is drawn after)
  const tl = [[x0, y0 + 13], [x0 + 17, y0]];
  const lift = [[x1, y1 - 17], [x1 - 21, y1]];
  const edge = [
    ...tearEdge(R, tl[0], tl[1], 9, 1.3),
    ...raggedEdge(R, [x0 + 17, y0], [x1, y0], 46, 0.35),
    ...raggedEdge(R, [x1, y0], lift[0], 18, 0.3),
    ...raggedEdge(R, lift[0], lift[1], 8, 0.15),
    ...raggedEdge(R, lift[1], [x0, y1], 44, 0.35),
    ...raggedEdge(R, [x0, y1], tl[0], 16, 0.3),
  ];
  // the thickness of the paper, and no more
  ctx.save();
  ctx.translate(0.3, 0.4);
  pathPoly(ctx, edge);
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.fill();
  ctx.restore();
  pathPoly(ctx, edge);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // the printed field, its edge a little uneven where the ink took
  const m = 3.6;
  const field = [
    ...raggedEdge(R, [x0 + m, y0 + m], [x1 - m, y0 + m], 30, 0.18),
    ...raggedEdge(R, [x1 - m, y0 + m], [x1 - m, y1 - m], 12, 0.18),
    ...raggedEdge(R, [x1 - m, y1 - m], [x0 + m, y1 - m], 30, 0.18),
    ...raggedEdge(R, [x0 + m, y1 - m], [x0 + m, y0 + m], 12, 0.18),
  ];
  pathPoly(ctx, field);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.save();
  pathPoly(ctx, field);
  ctx.clip();
  // a second, dark-grey ink: a fan of jagged rays thrown up from below the lettering
  const fx = cx;
  const fy = y1 + 26;
  for (let i = 0; i < 17; i += 1) {
    if (i % 2) continue;
    const a0 = -Math.PI + 0.08 + (i / 17) * (Math.PI - 0.16);
    const a1 = -Math.PI + 0.08 + ((i + 1) / 17) * (Math.PI - 0.16);
    const kink = (R() - 0.5) * 0.05;
    const L = 260;
    pathPoly(ctx, [
      [fx, fy],
      [fx + Math.cos(a0) * L * 0.45, fy + Math.sin(a0) * L * 0.45],
      [fx + Math.cos(a0 + kink) * L, fy + Math.sin(a0 + kink) * L],
      [fx + Math.cos(a1 + kink) * L, fy + Math.sin(a1 + kink) * L],
      [fx + Math.cos(a1) * L * 0.45, fy + Math.sin(a1) * L * 0.45],
    ]);
    ctx.fillStyle = grey(0.25 + 0.04 * R());
    ctx.fill();
  }
  // solid black under each line, cut with angled ends, so the rays only show at the sides
  const band = (yA, yB, inset, slant) => {
    pathPoly(ctx, [[x0 + inset + slant, yA], [x1 - inset, yA], [x1 - inset - slant, yB], [x0 + inset, yB]]);
    ctx.fillStyle = INK;
    ctx.fill();
  };
  band(y0 + 10, y0 + 47, 16, 9);
  band(y0 + 47, y0 + 76, 30, 7);
  band(y0 + 76, y0 + 102, 50, 6);
  // the ink lies unevenly: a few soft patches where it is thin
  for (let i = 0; i < 26; i += 1) {
    ctx.fillStyle = `rgba(255,255,255,${0.012 + R() * 0.025})`;
    ctx.beginPath();
    ctx.ellipse(x0 + R() * w, y0 + R() * (y1 - y0), 4 + R() * 14, 2 + R() * 6, R() * 3, 0, TAU);
    ctx.fill();
  }
  // a plain printed rule round the field, reversed out in paper
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 0.9;
  ctx.lineJoin = "miter";
  ctx.strokeRect(x0 + 7.5, y0 + 7.5, w - 15, y1 - y0 - 15);
  // lettering, reversed out of the ink: the paper shows through
  const LET = grey(0.9);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = LET;
  ctx.strokeStyle = LET;
  ctx.lineJoin = "round";
  ctx.font = `700 29px ${ZH_FONT}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = "1px";
  ctx.lineWidth = 0.95; // a heavier Weibei: the strokes spread as on a coarse print
  ctx.strokeText(META.zh, cx, y0 + 40);
  ctx.fillText(META.zh, cx, y0 + 40);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  cutLetters(ctx, META.en.toUpperCase(), cx + 1, y0 + 50.5, 17.5, 0.13, LET, INK);
  // a ruled line with sharp ends
  ctx.fillStyle = LET;
  pathPoly(ctx, [[cx - 80, y0 + 74], [cx, y0 + 72.6], [cx + 80, y0 + 74], [cx, y0 + 75.2]]);
  ctx.fill();
  ctx.font = `700 17px ${ZH_FONT}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = "1.5px";
  ctx.lineWidth = 0.55;
  ctx.strokeText(`${META.date} · ${META.dateEn}`, cx + 1, y0 + 96);
  ctx.fillText(`${META.date} · ${META.dateEn}`, cx + 1, y0 + 96);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  ctx.restore();
  // printed grain: ink specks on the paper and the letters, pin-holes in the ink
  for (let i = 0; i < 2600; i += 1) {
    const dark = R() < 0.5;
    ctx.fillStyle = dark ? `rgba(0,0,0,${0.18 + R() * 0.3})` : `rgba(255,255,255,${0.06 + R() * 0.12})`;
    const r = 0.12 + R() * R() * 0.45;
    ctx.fillRect(x0 + R() * w, y0 + R() * (y1 - y0), r, r * (0.6 + R() * 0.8));
  }
  // wear: the ink rubbed off along the edges and at the corners
  for (let i = 0; i < 90; i += 1) {
    const side = Math.floor(R() * 4);
    const s = R();
    const px = side === 0 || side === 2 ? x0 + s * w : side === 1 ? x1 - R() * 7 : x0 + R() * 7;
    const py = side === 1 || side === 3 ? y0 + s * (y1 - y0) : side === 0 ? y0 + R() * 6 : y1 - R() * 6;
    ctx.fillStyle = `rgba(214,214,214,${0.15 + R() * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(px, py, 0.3 + R() * 1.6, 0.2 + R() * 0.7, R() * 3, 0, TAU);
    ctx.fill();
  }
  // paste wrinkles: soft ridges, a lit flank and a shaded one, running in from the edges
  const wrinkles = [
    [[x0 + 30, y1 - 2], [x0 + 52, y0 + 70], [x0 + 61, y0 + 44]],
    [[x1 - 4, y0 + 30], [x1 - 40, y0 + 46], [x1 - 70, y0 + 52]],
    [[cx + 18, y0 + 2], [cx + 10, y0 + 30], [cx + 14, y0 + 58]],
    [[x0 + 3, y0 + 62], [x0 + 26, y0 + 66], [x0 + 46, y0 + 64]],
    [[x1 - 60, y1 - 1], [x1 - 74, y1 - 24], [x1 - 80, y1 - 36]],
  ];
  for (const [a, b, c] of wrinkles) {
    const path = (dx, dy) => {
      ctx.beginPath();
      ctx.moveTo(a[0] + dx, a[1] + dy);
      ctx.quadraticCurveTo(b[0] + dx, b[1] + dy, c[0] + dx, c[1] + dy);
    };
    ctx.lineCap = "round";
    path(-0.45, -0.3);
    ctx.strokeStyle = "rgba(255,255,255,0.13)";
    ctx.lineWidth = 0.9;
    ctx.stroke();
    path(0.5, 0.35);
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  // an old fold across the middle
  line(ctx, [[x0 + w * 0.5 + 0.6, y0], [x0 + w * 0.5 - 0.4, y1]], 0.45, "rgba(255,255,255,0.09)");
  line(ctx, [[x0 + w * 0.5 + 1.1, y0], [x0 + w * 0.5 + 0.1, y1]], 0.4, "rgba(0,0,0,0.2)");
  ctx.restore();
  // the torn corner: a pale fringe of paper fibre along the tear
  line(ctx, tearEdge(rng(1460), [tl[0][0] + 0.4, tl[0][1] + 0.2], [tl[1][0] + 0.2, tl[1][1] + 0.4], 9, 0.5), 0.5, grey(0.93));
  // the lifted corner: the flap folded forward, showing the back of the sheet, paper-thin
  const flap = [lift[0], [x1 - 9.5, y1 - 7.5], lift[1]];
  ctx.save();
  ctx.translate(0.25, 0.35);
  pathPoly(ctx, flap);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fill();
  ctx.restore();
  pathPoly(ctx, flap);
  const fg = ctx.createLinearGradient(x1 - 15, y1 - 15, x1 - 6, y1 - 4);
  fg.addColorStop(0, grey(0.74));
  fg.addColorStop(1, grey(0.6));
  ctx.fillStyle = fg;
  ctx.fill();
  line(ctx, [lift[0], lift[1]], 0.35, grey(0.92));
}

/**
 * A raised-and-fielded oak panel in a quad [tl, tr, br, bl] (the top may slope),
 * lit from low down: the lower bevel catches the light, the upper falls dark.
 */
function panel(ctx, R, q, lit) {
  const ins = (i) => [
    [q[0][0] + i, q[0][1] + i], [q[1][0] - i, q[1][1] + i],
    [q[2][0] - i, q[2][1] - i], [q[3][0] + i, q[3][1] - i],
  ];
  const a = ins(0);
  const b = ins(6);
  const c = ins(10);
  // the groove around the panel
  pathPoly(ctx, a);
  ctx.strokeStyle = grey(0.02);
  ctx.lineWidth = 1.3;
  ctx.stroke();
  line(ctx, [[a[3][0], a[3][1] + 0.9], [a[2][0], a[2][1] + 0.9]], 0.9, grey(lit * 1.8 + 0.04));
  // bevels: top, right, bottom, left
  const bev = [
    [[b[0], b[1], c[1], c[0]], lit * 0.45],
    [[b[1], b[2], c[2], c[1]], lit * 1.25],
    [[b[2], b[3], c[3], c[2]], lit * 2.1 + 0.03],
    [[b[3], b[0], c[0], c[3]], lit * 0.75],
  ];
  for (const [pts, v] of bev) {
    pathPoly(ctx, pts);
    ctx.fillStyle = grey(v);
    ctx.fill();
  }
  // the field: lighter towards the floor, where the lamp is
  const top = Math.min(c[0][1], c[1][1]);
  const g = ctx.createLinearGradient(0, top, 0, c[2][1]);
  g.addColorStop(0, grey(lit * 0.75));
  g.addColorStop(1, grey(lit * 1.3));
  pathPoly(ctx, c);
  ctx.fillStyle = g;
  ctx.fill();
  // grain
  const w = c[1][0] - c[0][0];
  for (let i = 0; i < 5; i += 1) {
    const gx = c[0][0] + 2 + R() * (w - 4);
    const ty = c[0][1] + ((c[1][1] - c[0][1]) * (gx - c[0][0])) / w;
    line(ctx, [[gx, ty + 1], [gx + (R() - 0.5) * 2, c[2][1] - 1]], 0.3, `rgba(0,0,0,${0.18 + R() * 0.15})`);
  }
}

/** Everything behind the shadow except the wall itself and the door's moving parts. */
function paintBack(ctx, R) {
  // --- faint cracks
  paintCracks(ctx, R);

  // --- the balustrade's faint shadow ladder, thrown up the wall by the lamp
  const proj = ([x, y], m) => [LAMP[0] + (x - LAMP[0]) * m, LAMP[1] + (y - LAMP[1]) * m];
  // (soft, and well under a quarter as dark as the pelican's shadow)
  const kpx = ctx.getTransform().a;
  ctx.save();
  ctx.filter = `blur(${(2.2 * kpx).toFixed(2)}px)`;
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  const M = 1.16;
  ctx.beginPath();
  const sub = (pts) => {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  };
  for (const bx of BALUSTERS) {
    sub([proj([bx - 1.6, treadY(bx)], M), proj([bx + 1.6, treadY(bx)], M), proj([bx + 1.6, railY(bx)], M), proj([bx - 1.6, railY(bx)], M)]);
  }
  const railShadow = [];
  for (let x = NEWEL_LOW.x; x <= NEWEL_TOP.x; x += 8) railShadow.push(proj([x, railY(x) - RAIL_T / 2], M));
  for (let x = NEWEL_TOP.x; x >= NEWEL_LOW.x; x -= 8) railShadow.push(proj([x, railY(x) + RAIL_T / 2], M));
  sub(railShadow);
  ctx.fill("nonzero");
  ctx.restore();

  // --- the hall's dark dado below the floor line
  ctx.fillStyle = grey(0.1);
  ctx.fillRect(SET.x0, 700, CURTAIL[0] - SET.x0, SET.y1 - 700);
  ctx.fillStyle = grey(0.2);
  ctx.fillRect(SET.x0, 700, CURTAIL[0] - SET.x0, 9);
  line(ctx, [[SET.x0, 700.4], [CURTAIL[0], 700.4]], 0.9, grey(0.5));
  line(ctx, [[SET.x0, 709.2], [CURTAIL[0], 709.2]], 0.6, grey(0.05));
  // panels: raised fields of dark oak, their lower bevels catching the low light
  for (let x = -40; x < CURTAIL[0] - 30; x += 74) {
    const pw = Math.min(62, CURTAIL[0] - 14 - x);
    panel(ctx, R, [[x, 722], [x + pw, 722], [x + pw, 792], [x, 792]], 0.13);
  }

  // --- under the stairs and the landing: panelling in deep shade
  const prof = stepProfile();
  const underTop = [];
  for (let x = CURTAIL[0] - 6; x <= SET.x1 + 10; x += 4) underTop.push([x, Math.max(road(x), 590) + 24]);
  ctx.fillStyle = grey(0.08);
  pathPoly(ctx, [...underTop, [SET.x1 + 10, SET.y1 + 5], [CURTAIL[0] - 6, SET.y1 + 5]]);
  ctx.fill();
  // panels following the slope: a raised field in each, lit by the lamp below
  for (let x = 400; x < 1050; x += 66) {
    const xa = x + 6;
    const xb = x + 58;
    const ya = Math.max(road(xa), 590) + 36;
    const yb = Math.max(road(xb), 590) + 36;
    if (xb > SET.x1 + 10) break;
    const lit = 0.09 + 0.1 * Math.exp(-(((x + 52 - LAMP[0]) / 240) ** 2));
    panel(ctx, R, [[xa, ya], [xb, yb], [xb, 790], [xa, 790]], lit);
  }
  // the lamp is down here somewhere: a glow rises from the bottom of the
  // stairwell and rakes up the panelling, dying out under the flight
  ctx.save();
  pathPoly(ctx, [...underTop, [SET.x1 + 10, SET.y1 + 5], [CURTAIL[0] - 6, SET.y1 + 5]]);
  ctx.clip();
  const lg = ctx.createRadialGradient(LAMP[0] - 20, 870, 10, LAMP[0] - 20, 870, 340);
  lg.addColorStop(0, "rgba(255,255,255,0.36)");
  lg.addColorStop(0.4, "rgba(255,255,255,0.16)");
  lg.addColorStop(0.75, "rgba(255,255,255,0.04)");
  lg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = lg;
  ctx.fillRect(CURTAIL[0], 590, 720, 230);
  ctx.restore();

  // --- the stair: step ends and the string board
  const body = prof.concat([[SET.x1 + 10, 590 + 24]]);
  for (let x = SET.x1 + 10; x >= CURTAIL[0] - 6; x -= 4) body.push([x, Math.max(road(x), 590) + 24]);
  body.push([CURTAIL[0] - 6, 700]);
  ctx.fillStyle = grey(0.18);
  pathPoly(ctx, body);
  ctx.fill();
  // the string board: a darker band with a lit lower edge (the light comes from below)
  const str0 = [];
  const str1 = [];
  for (let x = CURTAIL[0] + 6; x <= 760; x += 4) {
    str0.push([x, road(x) + 8]);
    str1.push([x, road(x) + 24]);
  }
  ctx.fillStyle = grey(0.12);
  pathPoly(ctx, str0.concat(str1.slice().reverse()));
  ctx.fill();
  line(ctx, str0, 0.8, grey(0.3));
  line(ctx, str1.map(([x, y]) => [x, y - 0.6]), 1.1, grey(0.42));
  // landing fascia
  ctx.fillStyle = grey(0.13);
  ctx.fillRect(760, 598, SET.x1 + 10 - 760, 16);
  line(ctx, [[760, 613.4], [SET.x1 + 10, 613.4]], 1.1, grey(0.4));
  line(ctx, [[760, 598], [SET.x1 + 10, 598]], 0.8, grey(0.28));
  // treads: each nosing catches the light, each riser is a dark seam
  for (let k = 0; k < NOSINGS.length; k += 1) {
    const [x, y] = NOSINGS[k];
    const xn = k + 1 < NOSINGS.length ? NOSINGS[k + 1][0] : SET.x1 + 10;
    line(ctx, [[x - (k === 0 ? 5 : 1.5), y + 0.6], [xn, y + 0.6]], 1.2, grey(0.46));
    line(ctx, [[x - 1.5, y + 3.6], [x + 10, y + 3.6]], 0.5, grey(0.08));
    if (k > 0) line(ctx, [[x + 0.3, y + 1.4], [x + 0.3, NOSINGS[k - 1][1]]], 0.7, grey(0.08));
  }
  // the bottom step's rounded end
  ctx.fillStyle = grey(0.24);
  ctx.beginPath();
  ctx.ellipse(CURTAIL[0] - 2, 696.5, 4.6, 3.6, 0, 0, TAU);
  ctx.fill();

  // --- the door surround on the landing
  const { x0, x1, y1, spring } = DOOR;
  const cx = (x0 + x1) / 2;
  const r = (x1 - x0) / 2;
  const arch = (inset) => {
    const pts = [[x0 + inset, y1]];
    pts.push([x0 + inset, spring]);
    for (let i = 0; i <= 24; i += 1) {
      const a = Math.PI + (i / 24) * Math.PI;
      pts.push([cx + Math.cos(a) * (r - inset), spring + Math.sin(a) * (r - inset)]);
    }
    pts.push([x1 - inset, y1]);
    return pts;
  };
  // the doorway itself, dark until the door opens
  ctx.fillStyle = grey(0.04);
  pathPoly(ctx, arch(0));
  ctx.fill();
  // architrave: pale stone, a dark joint on each side
  const outer = arch(-8);
  ctx.strokeStyle = grey(0.66);
  ctx.lineWidth = 7;
  ctx.lineJoin = "miter";
  ctx.beginPath();
  outer.slice(0).forEach(([x, y], i) => (i ? ctx.lineTo(x, y + 0) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.beginPath();
  arch(-3.6).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = grey(0.32);
  ctx.stroke();
  ctx.beginPath();
  arch(-11.6).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = grey(0.3);
  ctx.stroke();
  // keystone
  pathPoly(ctx, [[cx - 6, DOOR.y0 - 14], [cx + 6, DOOR.y0 - 14], [cx + 4.2, DOOR.y0 + 1], [cx - 4.2, DOOR.y0 + 1]]);
  ctx.fillStyle = grey(0.7);
  ctx.fill();
  ctx.strokeStyle = grey(0.3);
  ctx.lineWidth = 0.6;
  ctx.stroke();
  // threshold
  ctx.fillStyle = grey(0.5);
  ctx.fillRect(x0 - 12, 588, x1 - x0 + 24, 2.6);

  // --- the poster in the hall
  paintPoster(ctx, R);
}

function bakeBack(stage) {
  const sv = setView(stage);
  return stage.bake(`nosferatu/back/${sv.w.toFixed(0)}`, sv.w, sv.h, () => {
    const sh = stage.shader("nosferatu/wall", VERT, WALL_FRAG);
    stage.origin();
    stage.shaderRect(sh, { uOrigin: [SET.x0, SET.y0], uSize: [SET.x1 - SET.x0, SET.y1 - SET.y0], uLamp: LAMP }, 0, 0, sv.w, sv.h);
    const layer = new Layer2D(stage.p, sv.w, sv.h);
    const ctx = layer.ctx;
    sv.apply(ctx);
    paintBack(ctx, rng(1422));
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

/** A turned baluster from (x, yb) up to the rail's underside at yt. */
function baluster(ctx, x, yb, yt) {
  const H = yb - yt;
  const prof = (t) => {
    // half-widths along the height, bottom (0) to top (1)
    if (t < 0.11) return 2.5;
    if (t < 0.14) return 2.9;
    if (t < 0.17) return 1.7;
    if (t < 0.52) return 1.35 + 1.15 * Math.sin(Math.PI * ((t - 0.17) / 0.35)) ** 1.4;
    if (t < 0.78) return lerp(1.05, 1.3, (t - 0.52) / 0.26);
    if (t < 0.82) return 2.1;
    if (t < 0.85) return 1.3;
    return 2.0;
  };
  const left = [];
  const right = [];
  const n = 40;
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const y = yb - H * t;
    const r = prof(t);
    left.push([x - r, y]);
    right.push([x + r, y]);
  }
  const outline = left.concat(right.reverse());
  pathPoly(ctx, outline);
  // turned wood lit from low on the left: a pale flank, a dark flank
  const g = ctx.createLinearGradient(x - 3, 0, x + 3, 0);
  g.addColorStop(0, grey(0.74));
  g.addColorStop(0.3, grey(0.55));
  g.addColorStop(0.7, grey(0.3));
  g.addColorStop(1, grey(0.14));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 0.35;
  ctx.strokeStyle = grey(0.1);
  ctx.stroke();
  // rings catch the light
  for (const t of [0.125, 0.8]) line(ctx, [[x - prof(t), yb - H * t], [x + prof(t), yb - H * t]], 0.45, grey(0.82));
}

function newel(ctx, x, w, yb, yt) {
  // a slim square post with a small moulded cap and a small ball: no wider overall than
  // about 12 units, so it hides no more of the passing shadow than it must
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, grey(0.6));
  g.addColorStop(0.35, grey(0.42));
  g.addColorStop(1, grey(0.12));
  ctx.fillStyle = g;
  ctx.fillRect(x - w / 2, yt, w, yb - yt);
  ctx.strokeStyle = grey(0.08);
  ctx.lineWidth = 0.45;
  ctx.strokeRect(x - w / 2, yt, w, yb - yt);
  // a sunk panel
  ctx.strokeStyle = grey(0.18);
  ctx.lineWidth = 0.4;
  ctx.strokeRect(x - w / 2 + 1.7, yt + 8, w - 3.4, yb - yt - 18);
  line(ctx, [[x - w / 2 + 1.7, yb - 9.6], [x + w / 2 - 1.7, yb - 9.6]], 0.5, grey(0.7));
  // cap
  ctx.fillStyle = g;
  ctx.fillRect(x - w / 2 - 1.6, yt - 3.6, w + 3.2, 3.6);
  line(ctx, [[x - w / 2 - 1.6, yt - 0.3], [x + w / 2 + 1.6, yt - 0.3]], 0.7, grey(0.78));
  ctx.fillRect(x - w / 2 - 0.5, yt - 5.6, w + 1, 2);
  // ball finial
  const bg = ctx.createRadialGradient(x - 1.6, yt - 8, 0.4, x, yt - 9, 4.2);
  bg.addColorStop(0, grey(0.7));
  bg.addColorStop(1, grey(0.12));
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(x, yt - 9.2, 3.7, 0, TAU);
  ctx.fill();
}

function paintFront(ctx) {
  // the handrail: a heavy dark rail whose underside catches the low light
  const top = [];
  const bot = [];
  for (let x = NEWEL_LOW.x; x <= NEWEL_TOP.x + 0.1; x += 3) {
    top.push([x, railY(x) - RAIL_T / 2]);
    bot.push([x, railY(x) + RAIL_T / 2]);
  }
  for (const bx of BALUSTERS) baluster(ctx, bx, treadY(bx), railY(bx) + RAIL_T / 2 - 0.5);
  ctx.fillStyle = grey(0.2);
  pathPoly(ctx, top.concat(bot.slice().reverse()));
  ctx.fill();
  line(ctx, top, 0.6, grey(0.06));
  line(ctx, top.map(([x, y]) => [x, y + 1.6]), 0.7, grey(0.36));
  line(ctx, bot.map(([x, y]) => [x, y - 1.3]), 1.6, grey(0.66));
  line(ctx, bot.map(([x, y]) => [x, y - 0.1]), 0.5, grey(0.1));
  // newel posts at the foot and at the landing
  newel(ctx, NEWEL_LOW.x, NEWEL_LOW.w, CURTAIL[1], railY(NEWEL_LOW.x) - RAIL_T / 2 - 2);
  newel(ctx, NEWEL_TOP.x, NEWEL_TOP.w, 590, railY(NEWEL_TOP.x) - RAIL_T / 2 - 2);
}

function bakeFront(stage) {
  const sv = setView(stage, FRONT);
  return stage.bake2d(`nosferatu/front/${sv.w.toFixed(0)}`, sv.w, sv.h, (ctx) => {
    sv.apply(ctx);
    paintFront(ctx);
  });
}

// the door's moving parts
const LEAF = { x0: DOOR.x0, x1: DOOR.x1, y0: DOOR.y0, y1: DOOR.y1 };

function archPath(ctx, x0, x1, y0, y1, spring) {
  const cx = (x0 + x1) / 2;
  const r = (x1 - x0) / 2;
  ctx.beginPath();
  ctx.moveTo(x0, y1);
  ctx.lineTo(x0, spring);
  ctx.arc(cx, spring, r, Math.PI, TAU);
  ctx.lineTo(x1, y1);
  ctx.closePath();
}

/**
 * The door leaf. `lit`: as it stands open, its face turned to the light from the
 * doorway, about the tone of the lit wall, with pale ironwork: nothing dark in the opening.
 */
function bakeLeaf(stage, lit = false) {
  const k = BAKE_PX * stage.s;
  const w = (LEAF.x1 - LEAF.x0) * k;
  const h = (LEAF.y1 - LEAF.y0) * k;
  const T = lit ? (v) => 0.62 + 0.36 * v : (v) => v;
  return stage.bake2d(`nosferatu/leaf${lit ? "-lit" : ""}/${w.toFixed(0)}`, w, h, (ctx) => {
    ctx.setTransform(k, 0, 0, k, -LEAF.x0 * k, -LEAF.y0 * k);
    const R = rng(1414);
    archPath(ctx, LEAF.x0, LEAF.x1, LEAF.y0, LEAF.y1, DOOR.spring);
    ctx.save();
    ctx.clip();
    // planks, mid-toned old oak lit from low on the left
    const n = 6;
    const pw = (LEAF.x1 - LEAF.x0) / n;
    for (let i = 0; i < n; i += 1) {
      const v = 0.52 + (R() - 0.5) * 0.06 - i * 0.01;
      ctx.fillStyle = grey(T(v));
      ctx.fillRect(LEAF.x0 + i * pw, LEAF.y0, pw, LEAF.y1 - LEAF.y0);
      // grain
      for (let j = 0; j < 7; j += 1) {
        const gx = LEAF.x0 + i * pw + 1 + R() * (pw - 2);
        line(ctx, [[gx, LEAF.y0], [gx + (R() - 0.5) * 2, LEAF.y1]], 0.25, `rgba(0,0,0,${(0.06 + R() * 0.06) * (lit ? 0.6 : 1)})`);
      }
      line(ctx, [[LEAF.x0 + i * pw + 0.3, LEAF.y0], [LEAF.x0 + i * pw + 0.3, LEAF.y1]], 0.6, grey(T(0.24)));
      line(ctx, [[LEAF.x0 + i * pw + 1.1, LEAF.y0], [LEAF.x0 + i * pw + 1.1, LEAF.y1]], 0.35, grey(T(0.58)));
    }
    // light falls on the lower part of the door, from below
    const lg = ctx.createLinearGradient(0, LEAF.y0, 0, LEAF.y1);
    lg.addColorStop(0, lit ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)");
    lg.addColorStop(0.6, "rgba(0,0,0,0)");
    lg.addColorStop(1, "rgba(255,255,255,0.06)");
    ctx.fillStyle = lg;
    ctx.fillRect(LEAF.x0, LEAF.y0, LEAF.x1 - LEAF.x0, LEAF.y1 - LEAF.y0);
    // iron strap hinges from the hinge side (right), short so they stay out of the shadow's way
    for (const hy of [500, 566]) {
      pathPoly(ctx, [[LEAF.x1, hy - 2.4], [LEAF.x1 - 26, hy - 1.4], [LEAF.x1 - 31, hy], [LEAF.x1 - 26, hy + 1.4], [LEAF.x1, hy + 2.4]]);
      ctx.fillStyle = grey(T(0.24));
      ctx.fill();
      for (const nx of [LEAF.x1 - 6, LEAF.x1 - 16, LEAF.x1 - 25]) {
        ctx.fillStyle = grey(T(0.62));
        ctx.beginPath();
        ctx.arc(nx, hy - 0.5, 0.6, 0, TAU);
        ctx.fill();
      }
    }
    // ring pull
    ctx.strokeStyle = grey(T(0.26));
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(LEAF.x0 + 11, 534, 4, 0, TAU);
    ctx.stroke();
    ctx.restore();
    archPath(ctx, LEAF.x0, LEAF.x1, LEAF.y0, LEAF.y1, DOOR.spring);
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = grey(T(0.16));
    ctx.stroke();
  });
}

function bakeDoorLight(stage) {
  const k = BAKE_PX * stage.s;
  const w = (DOOR.x1 - DOOR.x0) * k;
  const h = (DOOR.y1 - DOOR.y0) * k;
  return stage.bake2d(`nosferatu/doorlight/${w.toFixed(0)}`, w, h, (ctx) => {
    ctx.setTransform(k, 0, 0, k, -DOOR.x0 * k, -DOOR.y0 * k);
    archPath(ctx, DOOR.x0, DOOR.x1, DOOR.y0, DOOR.y1, DOOR.spring);
    ctx.save();
    ctx.clip();
    // the coldest, palest light in the picture: brightest high up, falling off to the floor
    const g = ctx.createLinearGradient(0, DOOR.y0, 0, DOOR.y1);
    g.addColorStop(0, grey(1));
    g.addColorStop(0.45, grey(0.97));
    g.addColorStop(1, grey(0.76));
    ctx.fillStyle = g;
    ctx.fillRect(DOOR.x0, DOOR.y0, DOOR.x1 - DOOR.x0, DOOR.y1 - DOOR.y0);
    // the reveal of the wall's thickness on the left, a little darker
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(DOOR.x0, DOOR.y0, 5, DOOR.y1 - DOOR.y0);
    ctx.restore();
  });
}

/** The wedge of light the open door throws on the wall and the landing. */
function bakeWedge(stage) {
  const box = { x0: 700, x1: 1000, y0: 440, y1: 800 };
  const k = BAKE_PX * stage.s * 0.5;
  const w = (box.x1 - box.x0) * k;
  const h = (box.y1 - box.y0) * k;
  const tex = stage.bake2d(`nosferatu/wedge/${w.toFixed(0)}`, w, h, (ctx) => {
    ctx.setTransform(k, 0, 0, k, -box.x0 * k, -box.y0 * k);
    ctx.filter = `blur(${(5 * k).toFixed(2)}px)`;
    // a fan from the doorway, out over the wall to the left and onto the landing
    pathPoly(ctx, [[800, 470], [800, 590], [716, 590], [745, 520]]);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fill();
    pathPoly(ctx, [[880, 470], [880, 590], [940, 590], [915, 520]]);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fill();
    // on the landing fascia and the floor edge
    pathPoly(ctx, [[790, 591], [890, 591], [930, 614], [748, 614]]);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fill();
    // a little of it spills over the front edge of the landing and down the panelling
    const spill = ctx.createLinearGradient(0, 612, 0, 760);
    spill.addColorStop(0, "rgba(255,255,255,0.32)");
    spill.addColorStop(0.35, "rgba(255,255,255,0.1)");
    spill.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = spill;
    pathPoly(ctx, [[770, 612], [915, 612], [975, 780], [720, 780]]);
    ctx.fill();
    ctx.filter = "none";
    // and catches the bevels of the panels beneath it: the upper bevels face the light
    const near = (x, y) => Math.exp(-(((x - 842) / 85) ** 2)) * Math.exp(-Math.max(0, y - 626) / 75);
    for (let x = 400; x < 1050; x += 66) {
      const xa = x + 6;
      const xb = x + 58;
      if (xb < 720 || xb > SET.x1 + 10) continue;
      const ya = Math.max(road(xa), 590) + 36;
      const yb = Math.max(road(xb), 590) + 36;
      const q = [[xa, ya], [xb, yb], [xb, 790], [xa, 790]];
      const ins = (i) => [[q[0][0] + i, q[0][1] + i], [q[1][0] - i, q[1][1] + i], [q[2][0] - i, q[2][1] - i], [q[3][0] + i, q[3][1] - i]];
      const o = ins(0);
      const bb = ins(6);
      const cc = ins(10);
      const v = near((xa + xb) / 2, ya);
      if (v < 0.03) continue;
      // the top of the groove and the upper bevel
      line(ctx, [o[0], o[1]], 0.9, `rgba(255,255,255,${(0.75 * v).toFixed(3)})`);
      pathPoly(ctx, [bb[0], bb[1], cc[1], cc[0]]);
      ctx.fillStyle = `rgba(255,255,255,${(0.55 * v).toFixed(3)})`;
      ctx.fill();
      // the side bevels, lit down their length a little, fading
      for (const side of [[bb[3], bb[0], cc[0], cc[3]], [bb[1], bb[2], cc[2], cc[1]]]) {
        const g = ctx.createLinearGradient(0, ya, 0, ya + 120);
        g.addColorStop(0, `rgba(255,255,255,${(0.3 * v).toFixed(3)})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        pathPoly(ctx, side);
        ctx.fillStyle = g;
        ctx.fill();
      }
      // the field takes a faint wash at its head
      const fg = ctx.createLinearGradient(0, cc[0][1], 0, cc[0][1] + 60);
      fg.addColorStop(0, `rgba(255,255,255,${(0.12 * v).toFixed(3)})`);
      fg.addColorStop(1, "rgba(255,255,255,0)");
      pathPoly(ctx, cc);
      ctx.fillStyle = fg;
      ctx.fill();
    }
  });
  return { tex, box };
}

// ------------------------------------------------------------------ the shadow
const HEAD_TAGS = new Set(["head", "bill", "pouch", "crest", "eye", "pupil", "lid"]);
/** The fat parts of the shadow: in the hand-over they stay one black; everything else turns into light. */
const FAT_TAGS = new Set(["body", "neck", "head", "bill", "pouch", "crest", "eye", "pupil", "lid", "wing", "wingtip", "wingfold", "tail"]);
const dirv = (a) => [Math.cos(a), Math.sin(a)];
const addv = (p, d, l) => [p[0] + d[0] * l, p[1] + d[1] * l];

/** A tapered ribbon along a centre line, widths per point, ending in a point at `tip`. */
function ribbon(center, widths, tip = null) {
  const left = [];
  const right = [];
  for (let j = 0; j < center.length; j += 1) {
    const q = center[Math.min(center.length - 1, j + 1)];
    const o = center[Math.max(0, j - 1)];
    const dx = q[0] - o[0];
    const dy = q[1] - o[1];
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    const w = widths[j] / 2;
    left.push([center[j][0] + nx * w, center[j][1] + ny * w]);
    right.push([center[j][0] - nx * w, center[j][1] - ny * w]);
  }
  return left.concat(tip ? [tip] : [], right.reverse());
}

/**
 * The wing as the shadow shows it in bar 2: an arm raised from the handlebar
 * and a hand of four long, jointed fingers with hooked nails. World units,
 * screen angles (y down). raise 0..1 lifts the arm; open 0..1 springs the
 * fingers out (folded, they lie together as a closed wing tip); len scales them.
 */
function handShapes(shoulder, S, raise, open, len, t, lift = -0.36) {
  const shapes = [];
  if (raise <= 0.01) return shapes;
  // a long, thin, angular arm: the upper arm drops forward to a sharp, bony elbow,
  // the forearm rises from it to the wrist
  const aArm = lerp(0.85, lift, raise);
  const aUp = aArm + 0.66;
  const aFore = aArm - 0.44;
  const shoulderIn = addv(shoulder, dirv(aUp + Math.PI), S * 0.2); // it grows out of the body, not off its edge
  const elbow = addv(shoulder, dirv(aUp), S * 1.5);
  const wrist = addv(elbow, dirv(aFore), S * 1.72);
  const upper = [shoulderIn, shoulder, addv(shoulder, dirv(aUp), S * 0.55), addv(shoulder, dirv(aUp), S * 1.1), elbow];
  shapes.push(ribbon(upper, [S * 0.42, S * 0.36, S * 0.21, S * 0.18, S * 0.2]));
  const fore = [elbow, addv(elbow, dirv(aFore), S * 0.3), addv(elbow, dirv(aFore), S * 0.95), addv(elbow, dirv(aFore), S * 1.45), wrist];
  shapes.push(ribbon(fore, [S * 0.2, S * 0.16, S * 0.13, S * 0.15, S * 0.19]));
  // the point of the elbow: a hard little knuckle of bone past the joint
  const bis = [Math.cos(aUp) - Math.cos(aFore), Math.sin(aUp) - Math.sin(aFore)];
  const bl = Math.hypot(bis[0], bis[1]) || 1;
  const pt = addv(elbow, [bis[0] / bl, bis[1] / bl], S * 0.3);
  shapes.push([addv(elbow, dirv(aUp + Math.PI / 2), S * 0.12), pt, addv(elbow, dirv(aFore - Math.PI / 2), S * 0.12), addv(elbow, dirv(aUp + Math.PI), S * 0.14)]);
  const aHand = aArm - 0.05;
  const spread = lerp(0.1, 1, clamp(open));
  const fan = [-0.5, -0.17, 0.15, 0.45];
  const lens = [2.25, 2.8, 2.65, 2.05];
  const curlK = lerp(0.35, 1, clamp(open));
  for (let i = 0; i < 4; i += 1) {
    const L = lens[i] * S * len;
    const wig = 0.04 * Math.sin(t * 2.7 + i * 1.9) * open;
    let a = aHand + fan[i] * spread + wig;
    let p = addv(wrist, dirv(a), S * 0.16);
    const center = [wrist, p];
    const widths = [S * 0.3, S * 0.27];
    const segs = [0.45, 0.32, 0.23];
    const curls = [0.14 * curlK, 0.26 * curlK, 0.42 * curlK];
    const wAt = [0.26, 0.21, 0.16, 0.06];
    for (let s = 0; s < 3; s += 1) {
      const sl = L * segs[s];
      const n = 4;
      for (let j = 1; j <= n; j += 1) {
        p = addv(p, dirv(a), sl / n);
        center.push(p);
        let wv = lerp(wAt[s], wAt[s + 1], j / n);
        if (j === n && s < 2) wv *= 1.35; // a knuckle
        widths.push(wv * S);
      }
      a += curls[s];
    }
    // a long hooked nail
    const tip = addv(p, dirv(a + 0.35 * curlK), S * 0.32);
    shapes.push(ribbon(center, widths, tip));
  }
  // the back of the hand
  const palm = [];
  for (let i = 0; i <= 12; i += 1) {
    const a = aHand - 0.9 * spread - 0.5 + (i / 12) * (1.8 * spread + 1.0);
    palm.push(addv(wrist, dirv(a), S * (0.36 + 0.1 * spread)));
  }
  palm.push(addv(wrist, dirv(aHand + Math.PI), S * 0.14));
  shapes.push(palm);
  return shapes;
}

/** The affine stretch about the base line: [a, b, c, d, e, f] for ctx.transform. */
function stretchMatrix(pose, sy, lean) {
  const x0 = pose.x;
  const y0 = pose.y;
  const m = -Math.tan(pose.slope || 0);
  const k0 = y0 - m * x0;
  return [1 + lean * m, (1 - sy) * m, -lean, sy, lean * k0, (1 - sy) * k0];
}
const applyM = (M, [x, y]) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];

function shadowPose(f, u, ua) {
  if (u >= HANDOVER) {
    // the hand-over: the pose exactly as Section 15 draws it
    const p15 = f.film.pelicanFor(15, f.t);
    return { ...p15, x: p15.x + 1000, act: { wind: 0.8 } };
  }
  const w = wingAt(ua);
  const e = uncannyAt(ua);
  return {
    ...f.pelican,
    // the shadow is a little too long in the neck; on the climb the neck cranes and the bill dips
    act: { wind: 0.8, wing: 0.22 * w, neckStretch: 0.3 * e + 0.6 * w, headPitch: w * (0.12 - 0.3 * climbAt(ua)), lean: 0.1 * w },
  };
}

/** A fixed-size mask layer for the shadow, so playback never allocates a new canvas or texture. */
function shadowLayer(stage, k, needW = 0, needH = 0) {
  // 300 units square covers the stretched shadow with its raised hand at any zoom of the film
  const side = Math.ceil((300 * Math.max(k, 3.2 * stage.s)) / 128) * 128;
  return stage.layer("nosferatu/shadowmask", Math.max(side, Math.ceil(needW / 128) * 128), Math.max(side, Math.ceil(needH / 128) * 128));
}

/**
 * The shadow. `fire` (from u = 5.42) is the hand-over's fire front: the thin members
 * (everything but FAT_TAGS) go to the mask's green channel, which the shader fades out
 * behind the front, so that they keep no black once they burn.
 */
function drawShadow(stage, f, u, ua, offset, fire = null) {
  const view = f.view;
  const pose = shadowPose(f, u, ua);
  const skel = solveRig(pose);
  const S = skel.scale;
  const late = u >= HANDOVER;
  const c = late ? 0 : climbAt(ua);
  const pop = late ? 0 : 0.05 * Math.exp(-Math.max(0, ua - SPRING) / 0.25) * (ua >= 3.0 - 1e-4 ? 1 : 0);
  // the picture's top edge is near: the shadow never grows past it (head top about 132 units above the road)
  const room = (pose.y - TOP_ROOM) / 132;
  const sy = Math.max(1, Math.min(1 + 0.38 * c + pop, room));
  const lean = 0.17 * c;
  const M = stretchMatrix(pose, sy, lean);
  const raise = late ? 0 : wingAt(ua);
  const open = late ? 0 : handOpenAt(ua);
  const legK = 1 + 0.4 * (late ? 0 : legsAt(ua));

  // extent
  const b = skel.bounds;
  const corners = [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]].map((p) => applyM(M, p));
  let x0 = Math.min(...corners.map((p) => p[0]));
  let x1 = Math.max(...corners.map((p) => p[0])) + 14; // room for the lengthened bill
  let y0 = Math.min(...corners.map((p) => p[1]));
  let y1 = Math.max(...corners.map((p) => p[1]));
  const shoulder = applyM(M, skel.joints.shoulder);
  // the hand reaches forward and up, but lowers its reach rather than leave the picture
  let fingers = [];
  for (let lift = -0.36; lift <= 0.4; lift += 0.08) {
    fingers = handShapes(shoulder, S, raise, open, handLenAt(ua), ua, lift);
    let top = Infinity;
    for (const sh of fingers) for (const pt of sh) top = Math.min(top, pt[1]);
    if (top >= TOP_ROOM - 6) break;
  }
  for (const sh of fingers) {
    for (const [x, y] of sh) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  const blurU = 1.0 + 2.0 * c; // world units: an edge about 2 units wide, 6 when stretched
  const rpx = blurU * view.k;
  const rpxL = 1.0 * view.k; // the legs keep an edge about 2 units wide
  const rpxH = Math.min(rpx, 1.7 * view.k); // the arm and hand: thin, so a little firmer than the body
  const pad = Math.ceil(Math.max(rpx, 6 * view.k) + 6);
  const px0 = Math.floor(view.x(x0 + offset[0])) - pad;
  const py0 = Math.floor(view.y(y0 + offset[1])) - pad;
  const wu = Math.ceil(view.x(x1 + offset[0]) + pad - px0);
  const hu = Math.ceil(view.y(y1 + offset[1]) + pad - py0);
  const layer = shadowLayer(stage, view.k, wu, hu);
  const ctx = layer.clear();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, wu, hu);
  ctx.setTransform(view.k, 0, 0, view.k, view.tx - px0, view.ty - py0);
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(offset[0], offset[1]);
  const BODY = "#f00";
  const LEGS = "#0f0";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.save();
  ctx.transform(M[0], M[1], M[2], M[3], M[4], M[5]);
  // the head keeps its shape while the body stretches (a stretched head reads as
  // a hat), and the bill grows a little too long, as shadows do
  const e = late ? 0 : uncannyAt(ua);
  const hj = skel.joints.head;
  const bb0 = skel.joints.billBase;
  const bt0 = skel.joints.billTip;
  const bLen = Math.hypot(bt0[0] - bb0[0], bt0[1] - bb0[1]) || 1;
  const bd = [(bt0[0] - bb0[0]) / bLen, (bt0[1] - bb0[1]) / bLen];
  const grow = 0.22 * e;
  const ky = (1 + 0.2 * (sy - 1)) / sy;
  const headPt = ([x, y]) => {
    const along = (x - bb0[0]) * bd[0] + (y - bb0[1]) * bd[1];
    if (along > 0) {
      x += bd[0] * along * grow;
      y += bd[1] * along * grow;
    }
    return [x, hj[1] + (y - hj[1]) * ky];
  };
  const fixHead = grow > 1e-4 || sy > 1 + 1e-4;
  // body first (red), all of it in one path per kind; then the legs (green)
  for (const pass of [0, 1]) {
    const col = pass ? LEGS : BODY;
    ctx.fillStyle = col;
    ctx.strokeStyle = col;
    for (const sh of skel.shapes) {
      const isLeg = LEG_TAGS.has(sh.tag);
      const thin = late ? !FAT_TAGS.has(sh.tag) : isLeg;
      if (thin !== (pass === 1)) continue;
      if (raise > 0.45 && (sh.id.startsWith("wingTip") || sh.id.startsWith("wingHand"))) continue;
      const isHead = fixHead && HEAD_TAGS.has(sh.tag);
      const pts = sh.pts && isHead ? sh.pts.map(headPt) : sh.pts;
      const cc = sh.c && isHead ? headPt(sh.c) : sh.c;
      if (sh.kind === "poly") {
        pathPoly(ctx, pts);
        ctx.fill();
        if (isLeg && legK > 1.001) {
          ctx.lineWidth = (legK - 1) * 2.4;
          ctx.stroke();
        } else if (late && !thin) {
          // in the hand-over the fat parts close up: no hairline of wall between bill, pouch and head
          const lw = 0.6 * smoothstep(HANDOVER, 5.5, u);
          if (lw > 0.02) {
            ctx.lineWidth = lw;
            ctx.stroke();
          }
        }
      } else if (sh.kind === "line") {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.lineWidth = Math.max(sh.w, 0.6) * (isLeg ? legK : 1);
        ctx.stroke();
      } else if (sh.w) {
        ctx.beginPath();
        ctx.arc(cc[0], cc[1], sh.r, 0, TAU);
        ctx.lineWidth = Math.max(sh.w, 0.6);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(cc[0], cc[1], sh.r, 0, TAU);
        ctx.fill();
      }
    }
    if (pass === 0 && raise > 0.45) {
      // with the folded primaries gone, the tail still grows out of the body
      const tr = skel.joints.tailRoot;
      const bc = skel.joints.body;
      const ang = Math.atan2(bc[1] - tr[1], bc[0] - tr[0]);
      ctx.beginPath();
      ctx.ellipse(tr[0] + Math.cos(ang) * 5, tr[1] + Math.sin(ang) * 5 + 1.5, 9, 5, ang, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
  // arm and fingers in their own channel, with a firmer edge than the stretched body
  ctx.fillStyle = "#00f";
  ctx.globalCompositeOperation = "lighten";
  for (const sh of fingers) {
    pathPoly(ctx, sh);
    ctx.fill();
  }
  layer.touch();
  const mask = { layer, x: px0, y: py0, w: wu, h: hu, uv0: [0, 0], uvs: [wu / layer.w, hu / layer.h], texel: [1 / layer.w, 1 / layer.h] };
  const sh = stage.shader("nosferatu/shadow", VERT, SHADOW_FRAG);
  // the thin members fade out over 12 units ahead of the fire front and are gone 2 units before it,
  // so no black ever lies on or beside a green stroke
  let fade = [1e6, 1];
  if (fire) fade = fire.b >= 1 ? [-1e6, 1] : [view.x(fire.xf + offset[0]) - 14 * view.k, 12 * view.k];
  stage.origin();
  stage.shaderRect(sh, { uMask: layer.img, uTexel: mask.texel, uUV0: mask.uv0, uUVs: mask.uvs, uRadius: rpx, uRadiusL: rpxL, uRadiusH: rpxH, uAlpha: 0.97, uTone: 0.015, uOrigin: [px0, py0], uSize: [wu, hu], uFade: fade }, px0, py0, wu, hu);
  return { pose, skel, mask };
}


// ------------------------------------------------------------------ the film
function weaveAt(N) {
  // the picture shifting in the gate: a slow drift and a jolt now and then (world units)
  const dx = 0.38 * (noise1(N * 0.21, 1401) * 2 - 1) + 0.14 * (hash(N, 1402) - 0.5);
  const dy = 0.42 * (noise1(N * 0.17, 1403) * 2 - 1) + 0.16 * (hash(N, 1404) - 0.5) + (hash(N, 1405) < 0.04 ? 0.25 : 0);
  return [clamp(dx, -0.6, 0.6), clamp(dy, -0.6, 0.6)];
}

function scratchesAt(N) {
  const xs = [];
  const as = [];
  const ws = [];
  for (let i = 0; i < 3; i += 1) {
    const life = noise1(N * 0.045 + i * 7.3, 1410 + i);
    const on = life > 0.38 && hash(N, 1420 + i) > 0.12;
    const x = [0.27, 0.58, 0.81][i] + 0.07 * (noise1(N * 0.03 + i * 3.1, 1430 + i) * 2 - 1) + 0.0015 * (hash(N, 1440 + i) - 0.5);
    xs.push(x);
    as.push(on ? (i === 1 ? -0.55 : 0.5) * (0.6 + 0.4 * hash(N, 1450 + i)) : 0);
    ws.push(i === 1 ? 1.3 : 0.9 + 0.5 * hash(N, 1460 + i));
  }
  return { xs, as, ws };
}

function drawDust(stage, f, N) {
  const { p } = stage;
  const s = f.s;
  const R = rng(Math.floor(hash(N, 1470) * 4294967296));
  stage.origin();
  p.push();
  p.noStroke();
  const n = 5 + Math.floor(R() * 7);
  for (let i = 0; i < n; i += 1) {
    const light = R() < 0.35;
    const v = light ? 235 : 6;
    p.fill(v, v, v, 230);
    const x = R() * f.w;
    const y = R() * f.h;
    const d = (1.2 + R() * R() * 6) * s;
    p.ellipse(x, y, d, d * (0.6 + R() * 0.6));
  }
  // a hair now and then
  if (R() < 0.3) {
    const light = R() < 0.3;
    const v = light ? 225 : 10;
    p.noFill();
    p.stroke(v, v, v, 220);
    p.strokeWeight(1.3 * s);
    let x = R() * f.w;
    let y = R() * f.h;
    let ang = R() * TAU;
    const len = (30 + R() * 70) * s;
    p.beginShape();
    for (let i = 0; i <= 14; i += 1) {
      p.vertex(x, y);
      ang += (R() - 0.5) * 0.7;
      x += (Math.cos(ang) * len) / 14;
      y += (Math.sin(ang) * len) / 14;
    }
    p.endShape();
  }
  p.pop();
}

function filmPass(stage, scene, f, N, weavePx, glow, keep = [0, 0, 0, 0]) {
  const sh = stage.shader("nosferatu/film", VERT, FILM_FRAG);
  const flick = 1 + 0.032 * (hash(N, 1480) * 2 - 1) + 0.018 * Math.sin(N * 0.9) + (hash(N, 1481) < 0.03 ? 0.05 : 0);
  const tilt = 0.05 * (hash(N, 1482) - 0.5);
  const scr = scratchesAt(N);
  stage.origin();
  stage.shaderRect(
    sh,
    {
      uScene: scene,
      uRes: [f.w, f.h],
      uS: f.s,
      uWeave: weavePx,
      uFlick: flick,
      uTilt: tilt,
      uFrame: N % 4096,
      uScrX: scr.xs,
      uScrA: scr.as,
      uScrW: scr.ws,
      uVig: 0.62,
      uKeep: keep,
      uDeep: rgb(DEEP),
      uMid: rgb(MID),
      uLight: rgb(LIGHT),
      uMidAt: MID_AT,
      uGlow: glow.c,
      uGlowAmt: glow.amt,
      uGlowCol: rgb(BEAM_DEEP),
    },
    0,
    0,
    f.w,
    f.h,
  );
}

// ------------------------------------------------------------------ the fire
/** The trace's world rectangle (as Section 15 frames its figure). */
const traceBounds = (pose) => ({ x0: pose.x + 1000 - 120, y0: pose.y - 175, x1: pose.x + 1000 + 120, y1: pose.y + 30 });
/** Width of a band of scorch on each side of a stroke: full to 3 units, gone by 11, in steps too fine to see. */
const SCORCH_HW = Array.from({ length: 20 }, (_, i) => 3 + (i * 8) / 19);
/** A narrower band under the core itself, where the wall goes darker still. */
const SCORCH_CORE = [1.2, 1.8, 2.4];

/**
 * The hand-over's fire, worked out before anything is drawn (the shadow needs its
 * front): Section 15's strokes in this section's world, the part of them burning
 * (x >= xf), and the fuse's sparks.
 */
function fireAt(f, u) {
  const tr = scopeTrace(f.film, f.t);
  const lines = tr.lines.map((l) => ({ ...l, pts: l.pts.map(([x, y]) => [x + 1000, y]) }));
  // how far back the fire has run: from the bill tip to the tail
  let xmin = Infinity;
  let xmax = -Infinity;
  for (const l of lines) {
    if (l.tag === "spark") continue;
    for (const p of l.pts) {
      xmin = Math.min(xmin, p[0]);
      xmax = Math.max(xmax, p[0]);
    }
  }
  // 5.42 - 5.5: the very tip of the bill kindles; from 5.5 the fire runs back to the tail by 5.95
  const kindle = smoothstep(HANDOVER, 5.5, u);
  const b = burnAt(u);
  const xf = b >= 1 ? -Infinity : u < 5.5 ? xmax - 9 : xmax - 9 - b * (xmax - xmin - 6) - 0.5;
  const out = [];
  for (const l of lines) {
    if (b >= 1) {
      out.push(l);
      continue;
    }
    if (l.tag === "spark") {
      if (u >= 5.5 && l.pts[0][0] >= xf) out.push(l);
      continue;
    }
    for (const part of clipFromX(l.pts, xf)) out.push({ ...l, pts: part, closed: false });
  }
  // the fuse: sparks where the fire is running, new every 1/30 s
  if (b < 1 && u >= 5.5) {
    const q = Math.floor(f.t * 30 + 1e-6);
    const R = rng(Math.floor(hash(q, 1490) * 4294967296));
    const near = [];
    for (const l of lines) {
      if (l.tag === "spark" || l.coarse) continue;
      for (const p of l.pts) if (Math.abs(p[0] - xf) < 5) near.push(p);
    }
    const n = Math.min(near.length, 6);
    for (let i = 0; i < n; i += 1) {
      const p0 = near[Math.floor(R() * near.length)];
      let x = p0[0];
      let y = p0[1];
      let ang = Math.PI + (R() - 0.5) * 2.4;
      const pts = [[x, y]];
      for (let k = 0; k < 3; k += 1) {
        ang += (R() - 0.5) * 1.6;
        const l = 2.5 + R() * 4;
        x += Math.cos(ang) * l;
        y += Math.sin(ang) * l;
        pts.push([x, y]);
      }
      out.push({ pts, a: 1.4 + R(), w: 0.8, ends: 1.6, tag: "spark" });
    }
  }
  return { tr, out, xf, b, kindle, bounds: traceBounds(tr.pose) };
}

/** The scorch: every burning stroke and spark widened into a soft band, full to 3 units, gone by 11. */
function scorchPatch(stage, view, fire) {
  const res = 0.25; // the scorch is soft: a quarter of the resolution is plenty, and cheap
  const pv = view.scaled(res);
  const bd = fire.bounds;
  const patch = stage.patch("nosferatu/scorch", pv, bd.x0, bd.y0, bd.x1, bd.y1, 2);
  const ctx = patch.ctx;
  const path = new Path2D();
  for (const l of fire.out) {
    if (l.coarse) continue;
    path.moveTo(l.pts[0][0], l.pts[0][1]);
    for (let i = 1; i < l.pts.length; i += 1) path.lineTo(l.pts[i][0], l.pts[i][1]);
  }
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const v = Math.round(255 / SCORCH_HW.length);
  ctx.strokeStyle = `rgb(${v},0,0)`;
  for (const hw of SCORCH_HW) {
    ctx.lineWidth = 2 * hw;
    ctx.stroke(path);
  }
  // and right under the core, darker still (green channel), so the core keeps Section 15's colour
  const v2 = Math.round(255 / SCORCH_CORE.length);
  ctx.strokeStyle = `rgb(0,${v2},0)`;
  for (const hw of SCORCH_CORE) {
    ctx.lineWidth = 2 * hw;
    ctx.stroke(path);
  }
  patch.layer.touch();
  return { layer: patch.layer, x: patch.x / res, y: patch.y / res, w: patch.w / res, h: patch.h / res };
}

/** One pass of the trace compositor over the trace's rectangle (target pixels). */
function tracePass(stage, f, mode, args) {
  const view = f.view;
  const bd = args.fire.bounds;
  const pad = 8 * view.k;
  const x = Math.floor(view.x(bd.x0) - pad);
  const y = Math.floor(view.y(bd.y0) - pad);
  const w = Math.ceil(view.x(bd.x1) + pad) - x;
  const h = Math.ceil(view.y(bd.y1) + pad) - y;
  const { mask, sc, weavePx } = args;
  const sh = stage.shader("nosferatu/trace", VERT, TRACE_FRAG);
  stage.origin();
  stage.shaderRect(
    sh,
    {
      uTrace: args.trace,
      uScorch: sc.layer.img,
      uMask: mask ? mask.layer.img : sc.layer.img,
      uRes: [f.w, f.h],
      uOrigin: [x, y],
      uSize: [w, h],
      uScO: [sc.x, sc.y],
      uScS: [sc.w, sc.h],
      uScUV: [1, 1],
      uMO: mask ? [mask.x + weavePx[0], mask.y + weavePx[1]] : [-1e6, -1e6],
      uMS: mask ? [mask.w, mask.h] : [1, 1],
      uMUV: mask ? mask.uvs : [1, 1],
      uSoft: 1.5 * view.k,
      uMode: mode,
      uDark: 0.86 * args.fire.kindle,
      uCore: 0.88 * args.fire.kindle,
      uFloor: view.y((f.pelican ? f.pelican.y : 700) + 1.2),
    },
    x,
    y,
    w,
    h,
  );
}

function drawFire(stage, f, fire, mask, weavePx) {
  const { p } = stage;
  const view = f.view;
  if (!fire.out.length) return;
  const e = fire.tr.e;
  const frame60 = Math.floor(f.t * 60 + 1e-6);
  const dropout = hash(frame60, 1540) < 0.012 && !f.still ? 0.6 : 1;
  // the beam as Section 15 draws it at its entrance (the same core width and brightness, a
  // narrow halo), into a buffer of its own
  const trace = stage.fb(`nosferatu/trace/${f.w}x${f.h}`, f.w, f.h);
  stage.into(trace, () => {
    drawPhosphor(stage, view, fire.out, {
      intensity: (1 + 0.85 * e) * dropout * fire.kindle,
      width: 1.0,
      halo: 2.2,
      glow: 0.7,
      ends: 0.95,
      color: BEAM,
      deep: BEAM_DEEP,
      res: f.still ? 1 : 0.5,
      bounds: fire.bounds,
    });
  });
  const sc = scorchPatch(stage, view, fire);
  const args = { fire, trace, sc, mask, weavePx };
  // the scorch first, so the green keeps its colour on the pale wall; then the light, never inside the black
  stage.blend(p.MULTIPLY, () => tracePass(stage, f, 0, args));
  stage.blend(p.ADD, () => tracePass(stage, f, 1, args));
}

// ------------------------------------------------------------------ the scene
export const nosferatu = {
  ...META,
  road,
  poseHz: HZ,
  still: { u: 3.4 },

  init(stage) {
    bakeBack(stage);
    bakeFront(stage);
    bakeLeaf(stage);
    bakeLeaf(stage, true);
    bakeDoorLight(stage);
    bakeWedge(stage);
    // Everything a first frame would otherwise do for the first time happens here:
    // the scene buffer, the shadow's mask layer and its texture, the phosphor's working
    // canvases, and a real draw with every shader (p5 compiles and links on first use).
    const scene = stage.fb(`nosferatu/scene/${stage.W}x${stage.H}`, stage.W, stage.H);
    const fb = stage.fb("nosferatu/warm", 32, 32);
    const view = new View(3.17 * stage.s, 0, 0);
    const mask = shadowLayer(stage, view.k);
    mask.clear();
    mask.touch();
    const tx = [1 / mask.w, 1 / mask.h];
    stage.into(fb, () => {
      drawPhosphor(stage, view, [{ pts: [[0, 0], [10, 10]], a: 0.5 }, { pts: [[0, 5], [10, 5]], a: 0.1, coarse: true }], {
        intensity: 0,
        width: 1,
        halo: 2.2,
        glow: 0.7,
        res: 0.5,
        bounds: { x0: -120, y0: -175, x1: 120, y1: 30 },
      });
      const shadowSh = stage.shader("nosferatu/shadow", VERT, SHADOW_FRAG);
      stage.shaderRect(shadowSh, { uMask: mask.img, uTexel: tx, uUV0: [0, 0], uUVs: [0.01, 0.01], uRadius: 1, uRadiusL: 1, uRadiusH: 1, uAlpha: 0, uTone: 0, uOrigin: [0, 0], uSize: [4, 4], uFade: [1e6, 1] }, 0, 0, 4, 4);
    });
    // the hand-over's own trace buffer, its scorch layer and the compositor
    const trace = stage.fb(`nosferatu/trace/${stage.W}x${stage.H}`, stage.W, stage.H);
    stage.into(trace, () => stage.rect(0, 0, 4, 4, "#000"));
    const fire = { out: [{ pts: [[-10, -10], [10, 10]], tag: "frame" }], bounds: traceBounds({ x: -1000, y: 0 }), kindle: 0 };
    const sc = scorchPatch(stage, view, fire);
    const warmF = { view, w: 32, h: 32 };
    stage.into(fb, () => {
      const m = { layer: mask, x: 0, y: 0, w: 4, h: 4, uvs: [0.01, 0.01] };
      for (const mode of [0, 1]) tracePass(stage, warmF, mode, { fire, trace, sc, mask: m, weavePx: [0, 0] });
    });
    stage.into(scene, () => {
      stage.rect(0, 0, 8, 8, "#121212");
    });
    stage.into(fb, () => filmPass(stage, scene, { w: 32, h: 32, s: stage.s }, 0, [0, 0], { c: [0, 0, 1], amt: 0 }));
  },

  render(stage, f) {
    const { p } = stage;
    const view = f.view;
    const u = f.u;
    const N = Math.floor(f.t * HZ + 1e-9); // film frame number
    const ua = stepTime(f.t, HZ) - (f.t - u); // the film clock in u
    const weave = weaveAt(N);
    const weavePx = [weave[0] * view.k, weave[1] * view.k];

    const back = bakeBack(stage);
    const front = bakeFront(stage);
    const scene = stage.fb(`nosferatu/scene/${f.w}x${f.h}`, f.w, f.h);

    let shadow = null;
    // the hand-over's fire, worked out first: the shadow's thin members fade behind its front
    const fire = u >= HANDOVER && f.pelican.visible ? fireAt(f, u) : null;
    stage.into(scene, () => {
      stage.rect(0, 0, f.w, f.h, "#121212");
      stage.withView(view, () => stage.image(back, SET.x0, SET.y0, SET.x1 - SET.x0, SET.y1 - SET.y0));

      // the door
      const open = doorAt(u);
      const light = doorLightAt(u);
      if (open > 0) {
        const dl = bakeDoorLight(stage);
        const wedge = bakeWedge(stage);
        stage.withView(view, () => {
          stage.image(dl, DOOR.x0, DOOR.y0, DOOR.x1 - DOOR.x0, DOOR.y1 - DOOR.y0, light);
          stage.blend(p.ADD, () => {
            const bx = wedge.box;
            stage.image(wedge.tex, bx.x0, bx.y0, bx.x1 - bx.x0, bx.y1 - bx.y0, 0.75 * light);
          });
        });
      }
      const leaf = bakeLeaf(stage);
      const ang = open * 1.42; // radians: open, it is a narrow strip at the far (hinge) jamb
      const lw = (LEAF.x1 - LEAF.x0) * Math.cos(ang);
      if (lw > 0.3) {
        // seen in elevation the leaf narrows towards its hinge, and its free edge recedes a little;
        // as it swings its face turns into the light from the doorway
        const shrink = 2.5 * Math.sin(ang);
        const lx = LEAF.x1 - lw;
        const ly = LEAF.y0 + shrink;
        const lh = LEAF.y1 - LEAF.y0 - shrink * 1.2;
        const turned = light * smoothstep(0.15, 0.75, open);
        stage.withView(view, () => {
          if (turned < 0.999) stage.image(leaf, lx, ly, lw, lh);
          if (turned > 0.001) stage.image(bakeLeaf(stage, true), lx, ly, lw, lh, turned);
        });
      }

      // the shadow, sharing the weave only away from the crossings
      if (f.pelican.visible) {
        const share = weaveShare(u);
        shadow = drawShadow(stage, f, u, ua, [-weave[0] * (1 - share), -weave[1] * (1 - share)], fire);
      }

      // the balustrade in front of it
      stage.withView(view, () => stage.image(front, FRONT.x0, FRONT.y0, FRONT.x1 - FRONT.x0, FRONT.y1 - FRONT.y0));

      drawDust(stage, f, N);
    });

    // the green light on the wall during the hand-over
    let glow = { c: [0, 0, 1], amt: 0 };
    if (u > 5.45 && f.pelican.visible) {
      const amt = 0.12 * smoothstep(5.45, 5.85, u) * (1 - smoothstep(6.3, 6.9, u));
      glow = { c: [view.x(f.pelican.x + 15), view.y(f.pelican.y - 70), 150 * view.k], amt };
    }
    const keep = [view.x(POSTER.x0) + weavePx[0], view.y(POSTER.y0) + weavePx[1], view.x(POSTER.x1) + weavePx[0], view.y(POSTER.y1) + weavePx[1]];
    filmPass(stage, scene, f, N, weavePx, glow, keep);

    if (fire) drawFire(stage, f, fire, shadow && shadow.mask, weavePx);
  },
};
