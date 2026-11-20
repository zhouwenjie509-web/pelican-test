// Section 15. Oscilloscope vector graphics, the 1950s.
//
// A black laboratory instrument with one large round cathode-ray tube. On its
// green phosphor the pelican and its bicycle are drawn by a steered beam: thin
// bright lines with a halo, brighter where the beam lingers, trembling, with a
// brief afterglow behind everything that moves. The instrument travels with
// the pelican (it is laid out in world units around f.pelican.x and drawn
// through f.view); beyond it is the darkness of the laboratory.
//
// Bar 2: a hand rises to steady the picture, hovers at FOCUS, and turns the
// switch beside it instead. On the strong beat (u = 3.0) the whole drawing is
// thrown onto a turning Lissajous knot; on the next beat (u = 3.5) it is
// flicked back and the pelican snaps into shape, ringing like a struck spring.
//
// Everything is a function of time. The afterglow is the figure drawn again
// at earlier instants (f.film.pelicanFor), never a feedback buffer.
//
// Layers, back to front:
//   darkness                         per frame, one rectangle
//   the instrument face              baked once (panel, bezel, tube face, graticule, knobs, plate)
//   the trace                        per frame, rig/skins/phosphor.js, clipped to the tube
//   the glass                        baked once, added on top (highlight, window reflection)
//   the switch knob and the hand     per frame, a 2D patch

import { sectionMeta } from "./sections.js";
import { hash, rng, wobble } from "../kit/rng.js";
import { font } from "../kit/text.js";
import { View } from "../kit/stage.js";
import { solveRig } from "../rig/rig.js";
import { drawPhosphor } from "../rig/skins/phosphor.js";
import { clamp, lerp, smoothstep, easeOutCubic, easeInOutCubic, TAU } from "../beat/ease.js";

const META = sectionMeta(15);

// ------------------------------------------------------------------ layout (world units)
// x is given relative to the pelican's road point, y is absolute.
const TUBE = { y: 612, r: 168 };
const FACE_R = 172; // glass opening in the bezel
const BEZEL_R = 192;
const PANEL = { x0: -350, x1: 350, y0: 410, y1: 810 };
const BAKE = { x0: -380, x1: 380, y0: 392, y1: 990 };
const BAKE_PX = 3.3; // layer pixels per world unit at 1080p
const DIV = 26; // graticule division

const KNOB_Y = 702;
const KNOBS = {
  intensity: { x: 190, y: KNOB_Y, r: 12.5 },
  focus: { x: 228, y: KNOB_Y, r: 12.5 },
  sweep: { x: 266, y: KNOB_Y, r: 11.5 },
};
const SWEEP_ANGLE = -0.62; // pointer on SWEEP (radians from straight up, clockwise positive)
const XY_ANGLE = 0.62; // pointer on X-Y

const PLATE = { x0: -297, x1: -187, y0: 667, y1: 773 };

const ZH = "'Heiti SC', 'STHeiti', 'PingFang SC', sans-serif";
const EN = "'DIN Alternate', 'Futura', 'Helvetica Neue', sans-serif";
const EN_SMALL = "'DIN Condensed', 'DIN Alternate', 'Futura', sans-serif";

// ------------------------------------------------------------------ road
export function scopeRoad(x) {
  if (x <= 100) return 590;
  if (x >= 460) return 700;
  return 700 - 110 * (1 - smoothstep(100, 460, x));
}

// ------------------------------------------------------------------ timing
const KNOT_ON = 3.0;
const KNOT_OFF = 3.5;
const ECHOES = 3; // earlier instants drawn for the afterglow
const ECHO_DT = 1 / 30;
/** Brightness of the k-th echo (k >= 1): far below the live beam, and falling fast. */
const echoWeight = (k) => 0.26 * Math.pow(0.5, k - 1);
/** How far (world units) an echo may stand off the live line vertically. */
const ECHO_DY = 1.2;

/** How far the drawing is thrown onto the knot at time u (0 = pelican, 1 = knot; it rings through 0 after). */
function knotMix(u) {
  if (u < KNOT_ON) return 0;
  if (u < KNOT_OFF) return smoothstep(KNOT_ON, KNOT_ON + 1 / 30, u);
  const dt = u - KNOT_OFF;
  if (dt > 0.3) return 0;
  // it snaps straight back (0 at the instant), overshoots and rings out
  return 0.12 * Math.exp(-dt / 0.045) * Math.sin(TAU * 11 * dt);
}

/** Which side of the two switch instants u lies on: the beam is blanked as the switch is thrown, so no afterglow crosses them. */
function switchSide(u) {
  return u < KNOT_ON ? 0 : u < KNOT_OFF ? 1 : 2;
}

/** The knot's phase, drifting so it slowly turns. */
const knotPhase = (u) => 0.9 + 4.6 * (u - KNOT_ON);

/** Hand-over glow from Section 14: 0 outside u = -0.5 .. 0.6. */
function electrified(u) {
  return smoothstep(-0.5, -0.32, u) * (1 - smoothstep(0.1, 0.6, u));
}

/** A flash of brightness when the switch is thrown (and a smaller one when it is thrown back). */
function flash(u) {
  let v = 0;
  if (u >= KNOT_ON) v += 1.3 * Math.exp(-(u - KNOT_ON) / 0.07);
  if (u >= KNOT_OFF) v += 0.7 * Math.exp(-(u - KNOT_OFF) / 0.06);
  return v;
}

// ------------------------------------------------------------------ the figure as beam strokes
const SKIP_TAGS = new Set(["chain", "spoke", "reflector", "lid", "crank", "pedal"]);

function circlePts(cx, cy, r, n) {
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const a = (i / n) * TAU;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

/**
 * Strokes of the puppet for one pose, in world units, in a fixed order.
 * Each: { pts, closed, a, w, ends, tag }.
 */
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
        // six thin spokes, redrawn for the beam
        const c = sh.c;
        for (let i = 0; i < 6; i += 1) {
          const ang = -pose.wheel + (i / 6) * TAU + slope;
          const dx = Math.cos(ang);
          const dy = -Math.sin(ang);
          out.push({ pts: [[c[0] + dx * S * 0.1, c[1] + dy * S * 0.1], [c[0] + dx * S * 0.84, c[1] + dy * S * 0.84]], closed: false, a: 0.62, w: 0.7, ends: 0.6, tag: "spoke" });
        }
      }
    } else if (sh.kind === "line") {
      // legs: one bold stroke each, so the pedalling reads across the frame
      if (sh.tag === "leg") {
        out.push({ pts: sh.pts, closed: false, a: far ? 0.8 : 1.3, w: far ? 1.0 : 1.35, ends: 1.2, tag: sh.tag });
        continue;
      }
      // the frame quieter than the rider, so the legs read across it
      out.push({ pts: sh.pts, closed: false, a: sh.tag === "frame" ? a * 0.62 : a, w: sh.tag === "frame" ? 0.85 : 1, ends: 1, tag: sh.tag });
    } else {
      out.push({ pts: sh.pts.concat([sh.pts[0]]), closed: true, a, w: 1, ends: 0.8, tag: sh.tag });
    }
  }
  // cranks and pedals: one stroke each side, so the pedalling reads
  for (const side of ["far", "near"]) {
    const bb = skel.joints.bb;
    const pd = side === "near" ? skel.joints.pedalNear : skel.joints.pedalFar;
    const a = side === "far" ? 0.62 : 1;
    const ux = Math.cos(slope) * S * 0.2;
    const uy = -Math.sin(slope) * S * 0.2;
    out.push({ pts: [bb, pd], closed: false, a, w: 1, ends: 1, tag: "crank" });
    out.push({ pts: [[pd[0] - ux, pd[1] - uy], [pd[0] + ux, pd[1] + uy]], closed: false, a, w: 1.2, ends: 1, tag: "pedal" });
  }
  return { strokes: out, skel };
}

/** Resample a polyline so no step is longer than `step` units. */
function densify(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i += 1) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 1; k <= n; k += 1) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  return out;
}

/** Throw every stroke onto the Lissajous knot: a point at fraction s of the drawing's length goes to the curve. */
function throwOntoKnot(strokes, m, phase, cx, cy, step = 3.5) {
  if (Math.abs(m) < 1e-4) return strokes;
  const dense = strokes.map((st) => densify(st.pts, step));
  let total = 0;
  const lens = dense.map((pts) => {
    let l = 0;
    for (let i = 1; i < pts.length; i += 1) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    total += l;
    return l;
  });
  let acc = 0;
  const A = 150;
  return strokes.map((st, j) => {
    const pts = dense[j];
    const out = [];
    let l = acc;
    for (let i = 0; i < pts.length; i += 1) {
      if (i > 0) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const s = l / total;
      const kx = cx + A * Math.sin(3 * TAU * s + phase);
      const ky = cy + A * Math.sin(2 * TAU * s);
      out.push([lerp(pts[i][0], kx, m), lerp(pts[i][1], ky, m)]);
    }
    acc += lens[j];
    return { ...st, pts: out, ends: st.ends * (1 - clamp(Math.abs(m))) };
  });
}

/** Sparks off the outline while the trace is electrified; they change every 1/30 s. */
function sparks(strokes, t, amount) {
  if (amount <= 0.02) return [];
  const q = Math.floor(t * 30 + 1e-6);
  const R = rng(Math.floor(hash(q, 1515) * 4294967296));
  const out = [];
  // a few long, jagged arcs leaping outward from the outline, rather than fuzz
  const n = Math.round(9 * amount + 1);
  for (let i = 0; i < n; i += 1) {
    const st = strokes[Math.floor(R() * strokes.length)];
    const j = Math.floor(R() * st.pts.length);
    const p0 = st.pts[j];
    const p1 = st.pts[Math.min(st.pts.length - 1, j + 1)];
    const p_ = st.pts[Math.max(0, j - 1)];
    // leave roughly along the outline's normal
    let ang = Math.atan2(p1[1] - p_[1], p1[0] - p_[0]) + (R() < 0.5 ? 1 : -1) * Math.PI / 2 + (R() - 0.5) * 0.8;
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
        // a fork
        const fa = ang + (R() < 0.5 ? 0.9 : -0.9);
        out.push({ pts: [[x, y], [x + Math.cos(fa) * reach * 0.8, y + Math.sin(fa) * reach * 0.8]], closed: false, a: 1.2, w: 0.7, ends: 1.2, tag: "spark" });
      }
    }
    out.push({ pts, closed: false, a: 1.5 + 0.9 * R(), w: 0.8, ends: 1.6, tag: "spark" });
  }
  return out;
}

/** The base-line trace: the road, as a step response, with pips every quarter pedal turn. */
function baseLine(px, shift, t) {
  const pts = [];
  const x0 = px - TUBE.r - 6;
  const x1 = px + TUBE.r + 6;
  for (let x = x0; x <= x1 + 0.01; x += 3) {
    const wx = x - shift;
    pts.push([x, scopeRoad(wx) + 1.4]);
  }
  const lines = [{ pts, closed: false, a: 0.85, w: 1, ends: 0, tag: "base" }];
  const PIP = 1000 / 24; // 41.67 units: a quarter of a pedal turn
  const k0 = Math.ceil((x0 - shift) / PIP);
  const k1 = Math.floor((x1 - shift) / PIP);
  for (let k = k0; k <= k1; k += 1) {
    const wx = k * PIP;
    const x = wx + shift;
    const y = scopeRoad(wx) + 1.4;
    const big = k % 4 === 0;
    lines.push({ pts: [[x, y], [x, y + (big ? 6.5 : 4)]], closed: false, a: big ? 1 : 0.8, w: 0.9, ends: 1, tag: "pip" });
  }
  return lines;
}

/** Fine 60 Hz jitter, the hum bar and the breathing, applied to one instant's strokes. */
function instability(lines, t, cx, cy) {
  const frame = Math.floor(t * 60 + 1e-6);
  const jx = (hash(frame, 1501) - 0.5) * 0.55;
  const jy = (hash(frame, 1502) - 0.5) * 0.12;
  const breathe = 1 + 0.0028 * Math.sin(TAU * 0.83 * t);
  const yb = cy + TUBE.r - ((t * 0.41) % 1) * (2 * TUBE.r + 60) + 30; // hum bar rolls slowly upward
  for (const ln of lines) {
    ln.pts = ln.pts.map(([x, y]) => {
      const band = Math.exp(-(((y - yb) / 16) ** 2));
      return [cx + (x - cx) * breathe + jx + 0.5 * band, cy + (y - cy) * breathe + jy];
    });
  }
  return lines;
}

/** Areas of the figure that glow as a burnt-in shadow during the hand-over. */
function burnFills(strokes, a) {
  const out = [];
  for (const st of strokes) {
    if (st.tag === "spoke" || st.tag === "pip" || st.tag === "base" || st.tag === "spark") continue;
    if (st.closed && st.tag !== "tire" && st.tag !== "rim" && st.tag !== "hub" && st.tag !== "ring") out.push({ pts: st.pts, a });
    else if (!st.closed) out.push({ pts: st.pts, a, stroke: st.tag === "leg" ? 3 : 2.4 });
    else if (st.tag === "tire") out.push({ pts: st.pts, a: a * 0.8, stroke: 3.2 });
  }
  return out;
}

/** Everything the beam draws at film time t, as seen in the tube now centred at px. */
// Parts that move within the tube even when the figure as a whole holds still.
const MOVING_TAGS = new Set(["spoke", "leg", "foot", "crank", "pedal", "spark"]);

/**
 * Everything the beam draws at film time t, as seen in the tube now centred
 * at px. With `nowY` (an echo), parts that have not moved since are left out:
 * they lie under today's lines anyway, and leaving them out keeps echoes cheap.
 */
function traceAt(f, t, px, nowY = null) {
  const u = t - (f.t - f.u);
  const m = knotMix(u);
  const e = electrified(u);
  const echo = nowY !== null;
  // fully on the knot: the drawing lies exactly on the analytic curve, so draw that
  // (the whole drawing's length maps onto s = 0 .. 1 of it)
  if (m >= 0.999) {
    const lines = knotLines(u, px);
    if (!echo) lines.push(...baseLine(px, px - f.pelican.x, t));
    instability(lines, t, px, TUBE.y);
    return { lines, figure: [], e, m };
  }
  const pose = f.film.pelicanFor(f.n, t);
  const shift = px - pose.x; // the tube keeps the pelican still: earlier poses are moved to it
  const { strokes } = figureStrokes({ ...pose, x: pose.x + shift });
  let figure = strokes;
  if (m !== 0) figure = throwOntoKnot(figure, m, knotPhase(u), px, TUBE.y, 3.5);
  let lines;
  if (echo) {
    // an echo: only the parts that move within the figure (wheels, legs,
    // cranks, sparks), held to within ECHO_DY of the live figure's height so
    // the picture stays crisp while it rolls down the step
    const dy0 = nowY - pose.y;
    const dy = dy0 - clamp(dy0, -ECHO_DY, ECHO_DY);
    lines = figure.filter((st) => MOVING_TAGS.has(st.tag)).concat(sparks(figure, t, e));
    if (dy !== 0) for (const ln of lines) ln.pts = ln.pts.map(([x, y]) => [x, y + dy]);
  } else {
    lines = figure.concat(sparks(figure, t, e), baseLine(px, shift, t));
  }
  instability(lines, t, px, TUBE.y);
  return { lines, figure, e, m };
}

/** The Lissajous knot itself, at time u: x = 150 sin(3·2πs + φ), y = 150 sin(2·2πs). */
function knotLines(u, px) {
  const ph = knotPhase(u);
  const N = 420; // equal steps in time: the beam is bright where it turns, faint where it races
  const A = 150;
  const pts = new Array(N + 1);
  for (let i = 0; i <= N; i += 1) {
    const s = i / N;
    pts[i] = [px + A * Math.sin(3 * TAU * s + ph), TUBE.y + A * Math.sin(2 * TAU * s)];
  }
  return [{ pts, closed: true, a: 1, w: 1, ends: 0, tag: "knot" }];
}

// ------------------------------------------------------------------ the instrument (baked)
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A tile of black wrinkle finish (crackle lacquer), lit from above. */
function wrinkleTile(stage, size) {
  const layer = stage.layer(`scope/wrinkle/${size}`, size, size);
  if (layer.drawn) return layer.canvas;
  layer.drawn = true;
  const ctx = layer.clear();
  {
    const img = ctx.createImageData(size, size);
    const d = img.data;
    const h = new Float32Array(size * size);
    const cells = 34;
    // a ridged noise, tileable by wrapping the lattice
    const lattice = (ix, iy, s) => hash(((ix % s) + s) % s, ((iy % s) + s) % s, 1517);
    const vn = (x, y, s) => {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const fx = x - ix;
      const fy = y - iy;
      const ux = fx * fx * (3 - 2 * fx);
      const uy = fy * fy * (3 - 2 * fy);
      const a = lattice(ix, iy, s);
      const b = lattice(ix + 1, iy, s);
      const c = lattice(ix, iy + 1, s);
      const e = lattice(ix + 1, iy + 1, s);
      return a + (b - a) * ux + (c - a) * uy + (a - b - c + e) * ux * uy;
    };
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const u = (x / size) * cells;
        const v = (y / size) * cells;
        const r1 = 1 - Math.abs(vn(u, v, cells) * 2 - 1);
        const r2 = 1 - Math.abs(vn(u * 2, v * 2, cells * 2) * 2 - 1);
        h[y * size + x] = r1 * r1 * 0.65 + r2 * r2 * 0.35;
      }
    }
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const i = y * size + x;
        const up = h[((y - 1 + size) % size) * size + x];
        const lf = h[y * size + ((x - 1 + size) % size)];
        const lit = (h[i] - up) * 0.9 + (h[i] - lf) * 0.35; // light from above
        const g = hash(x, y, 1519) - 0.5;
        const base = 15 + h[i] * 9 + lit * 70 + g * 3;
        d[i * 4] = base;
        d[i * 4 + 1] = base + 1;
        d[i * 4 + 2] = base;
        d[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  return layer.canvas;
}

/** Engraved, paint-filled lettering: a dark cut edge above, off-white fill. */
function engrave(ctx, text, x, y, fontCss, opts = {}) {
  const w = engraveText(ctx, text, x, y, fontCss, opts);
  // worn fill: the paint has chipped out of the cuts here and there (specks of
  // the panel's own black laid over the letters; on the panel they vanish)
  const wear = opts.wear === undefined ? 1 : opts.wear;
  if (wear > 0) {
    ctx.save();
    ctx.font = fontCss;
    const m = ctx.measureText(text);
    const asc = m.actualBoundingBoxAscent || 4;
    const align = opts.align || "left";
    const xl = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    let sd = 1557;
    for (let i = 0; i < text.length; i += 1) sd = (sd * 31 + text.charCodeAt(i)) % 1000003;
    const W = rng(Math.floor(hash(sd, Math.round(x * 10), Math.round(y * 10)) * 4294967296));
    const n = Math.round(w * asc * 0.05 * wear);
    for (let i = 0; i < n; i += 1) {
      const sx = xl + W() * w;
      const sy = y - W() * asc;
      const r = 0.1 + W() * W() * 0.45;
      ctx.fillStyle = W() < 0.75 ? "rgba(18,19,18,0.75)" : "rgba(120,100,60,0.35)";
      ctx.beginPath();
      ctx.ellipse(sx, sy, r * (1 + W()), r, W() * 3, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  return w;
}

function engraveText(ctx, text, x, y, fontCss, { align = "left", fill = "#e4ddc6", spacing, maxW } = {}) {
  ctx.save();
  ctx.font = fontCss;
  if (spacing !== undefined && "letterSpacing" in ctx) ctx.letterSpacing = `${spacing}px`;
  const w = ctx.measureText(text).width;
  let sx = 1;
  if (maxW && w > maxW) sx = maxW / w;
  ctx.translate(x, y);
  ctx.scale(sx, 1);
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  ctx.fillText(text, -0.18, -0.22);
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fillText(text, 0.12, 0.2);
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, 0);
  ctx.restore();
  return w * sx;
}

function screw(ctx, x, y, r, ang) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, "#8a8c88");
  g.addColorStop(0.5, "#4a4c49");
  g.addColorStop(1, "#1a1b1a");
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.beginPath();
  ctx.arc(x + r * 0.2, y + r * 0.25, r * 1.08, 0, TAU);
  ctx.fill();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#0b0b0b";
  ctx.lineWidth = r * 0.28;
  ctx.beginPath();
  ctx.moveTo(x - Math.cos(ang) * r * 0.85, y - Math.sin(ang) * r * 0.85);
  ctx.lineTo(x + Math.cos(ang) * r * 0.85, y + Math.sin(ang) * r * 0.85);
  ctx.stroke();
}

/**
 * A bakelite knob: fluted skirt, domed cap, white pointer line.
 * angle: radians from straight up, clockwise.
 */
function knob(ctx, x, y, r, angle, { skirt = true, cap = "#151413", seed = null } = {}) {
  const W = rng(Math.floor(hash(Math.round(seed === null ? x * 7 + y * 13 : seed), 1550) * 4294967296));
  // shadow on the panel (light from above left)
  const sg = ctx.createRadialGradient(x + r * 0.25, y + r * 0.35, r * 0.6, x + r * 0.25, y + r * 0.35, r * 1.55);
  sg.addColorStop(0, "rgba(0,0,0,0.75)");
  sg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(x + r * 0.25, y + r * 0.35, r * 1.55, 0, TAU);
  ctx.fill();
  if (skirt) {
    // a wider skirt with fine flutes
    const R = r * 1.18;
    const g = ctx.createLinearGradient(x - R, y - R, x + R, y + R);
    g.addColorStop(0, "#2e2c2a");
    g.addColorStop(0.5, "#141312");
    g.addColorStop(1, "#060606");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.fill();
    ctx.lineWidth = Math.max(0.25, r * 0.05);
    const nf = 28;
    for (let i = 0; i < nf; i += 1) {
      const a = angle + (i / nf) * TAU;
      const c = Math.cos(a - Math.PI / 2);
      const s = Math.sin(a - Math.PI / 2);
      const lit = 0.5 + 0.5 * Math.cos(a + Math.PI / 2 + 0.8);
      ctx.strokeStyle = `rgba(${120 + lit * 60},${118 + lit * 60},${112 + lit * 60},${0.08 + lit * 0.22})`;
      ctx.beginPath();
      ctx.moveTo(x + c * r * 1.0, y + s * r * 1.0);
      ctx.lineTo(x + c * R * 0.98, y + s * R * 0.98);
      ctx.stroke();
    }
    // wear: a stretch of the skirt rubbed shiny by fingers, and fine scuffs
    const a0 = angle + W() * TAU;
    ctx.strokeStyle = "rgba(170,165,150,0.16)";
    ctx.lineWidth = r * 0.12;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.09, a0, a0 + 0.9 + W() * 0.6);
    ctx.stroke();
    ctx.lineWidth = Math.max(0.18, r * 0.025);
    for (let i = 0; i < 6; i += 1) {
      const a = angle + W() * TAU;
      ctx.strokeStyle = `rgba(215,210,195,${0.12 + W() * 0.2})`;
      ctx.beginPath();
      ctx.arc(x, y, r * (1.02 + W() * 0.14), a, a + 0.12 + W() * 0.35);
      ctx.stroke();
    }
  }
  // the cap
  const g2 = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.05, x, y, r);
  g2.addColorStop(0, "#4a4744");
  g2.addColorStop(0.35, "#1f1d1b");
  g2.addColorStop(1, cap);
  ctx.fillStyle = g2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = r * 0.06;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.97, Math.PI * 1.05, Math.PI * 1.6);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.beginPath();
  ctx.arc(x, y, r * 0.78, 0, TAU);
  ctx.stroke();
  // pointer line
  const px = Math.sin(angle);
  const py = -Math.cos(angle);
  ctx.strokeStyle = "#ecebe4";
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(0.7, r * 0.12);
  ctx.beginPath();
  ctx.moveTo(x + px * r * 0.25, y + py * r * 0.25);
  ctx.lineTo(x + px * r * 1.12, y + py * r * 1.12);
  ctx.stroke();
  // the cap's polish dulled where it is turned, and the pointer's paint chipped
  const rub = ctx.createRadialGradient(x + r * 0.25, y + r * 0.3, 0, x + r * 0.25, y + r * 0.3, r * 0.7);
  rub.addColorStop(0, "rgba(130,125,115,0.09)");
  rub.addColorStop(1, "rgba(130,125,115,0)");
  ctx.fillStyle = rub;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(20,19,18,0.6)";
  for (let i = 0; i < 2; i += 1) {
    const d = 0.4 + W() * 0.65;
    ctx.beginPath();
    ctx.arc(x + px * r * d + (W() - 0.5) * r * 0.06, y + py * r * d, r * (0.02 + W() * 0.025), 0, TAU);
    ctx.fill();
  }
}

/** Engraved scale ticks around a knob, from angle a0 to a1 (radians from up, clockwise). */
function dialScale(ctx, x, y, r, a0, a1, n, { major = 1, labels = null, size = 4.2 } = {}) {
  ctx.strokeStyle = "#dcd9cd";
  ctx.lineCap = "butt";
  for (let i = 0; i <= n; i += 1) {
    const a = lerp(a0, a1, i / n);
    const big = i % major === 0;
    const s = Math.sin(a);
    const c = -Math.cos(a);
    ctx.lineWidth = big ? 0.75 : 0.5;
    ctx.beginPath();
    ctx.moveTo(x + s * r, y + c * r);
    ctx.lineTo(x + s * (r + (big ? 3.6 : 2.2)), y + c * (r + (big ? 3.6 : 2.2)));
    ctx.stroke();
    if (labels && big && labels[i / major] !== undefined) {
      engrave(ctx, String(labels[i / major]), x + s * (r + 7.8), y + c * (r + 7.8) + size * 0.36, font(EN_SMALL, size, 400), { align: "center" });
    }
  }
}

/** The whole instrument face, in local units: x relative to the tube's centre, y absolute. */
function paintInstrument(ctx, stage) {
  // laboratory darkness, and the bench the instrument stands on (seen only in the gallery still)
  ctx.fillStyle = "#030403";
  ctx.fillRect(BAKE.x0, BAKE.y0, BAKE.x1 - BAKE.x0, BAKE.y1 - BAKE.y0);
  let bg = ctx.createLinearGradient(0, 826, 0, BAKE.y1);
  bg.addColorStop(0, "#14110e");
  bg.addColorStop(0.55, "#070605");
  bg.addColorStop(1, "#030403");
  ctx.fillStyle = bg;
  ctx.fillRect(BAKE.x0, 826, BAKE.x1 - BAKE.x0, BAKE.y1 - 826);
  bg = ctx.createRadialGradient(0, 826, 10, 0, 826, 150);
  bg.addColorStop(0, "rgba(70,200,110,0.07)");
  bg.addColorStop(1, "rgba(70,200,110,0)");
  ctx.fillStyle = bg;
  ctx.fillRect(BAKE.x0, 826, BAKE.x1 - BAKE.x0, BAKE.y1 - 826);
  // the cabinet round the panel: grey enamel, lit along its top
  rr(ctx, PANEL.x0 - 13, PANEL.y0 - 13, PANEL.x1 - PANEL.x0 + 26, PANEL.y1 - PANEL.y0 + 26, 14);
  bg = ctx.createLinearGradient(0, PANEL.y0 - 13, 0, PANEL.y1 + 13);
  bg.addColorStop(0, "#3a3b38");
  bg.addColorStop(0.04, "#262724");
  bg.addColorStop(1, "#121311");
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(PANEL.x0 - 4, PANEL.y1 + 13, PANEL.x1 - PANEL.x0 + 8, 3);
  for (const fx of [PANEL.x0 + 20, PANEL.x1 - 20]) {
    ctx.fillStyle = "#0a0a09";
    ctx.fillRect(fx - 14, PANEL.y1 + 13, 28, 5);
  }

  // the panel: wrinkle finish, a faint top light, a bevelled edge
  const P = PANEL;
  ctx.save();
  rr(ctx, P.x0, P.y0, P.x1 - P.x0, P.y1 - P.y0, 9);
  ctx.clip();
  const tileWorld = 60; // world units per wrinkle tile
  const tilePx = 256;
  const pat = ctx.createPattern(wrinkleTile(stage, tilePx), "repeat");
  const m = new DOMMatrix();
  pat.setTransform(m.scale(tileWorld / tilePx));
  ctx.fillStyle = pat;
  ctx.fillRect(P.x0, P.y0, P.x1 - P.x0, P.y1 - P.y0);
  // light falls from above and the tube spills a little green on the metal
  let g = ctx.createLinearGradient(0, P.y0, 0, P.y1);
  g.addColorStop(0, "rgba(255,255,255,0.035)");
  g.addColorStop(0.5, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = g;
  ctx.fillRect(P.x0, P.y0, P.x1 - P.x0, P.y1 - P.y0);
  g = ctx.createRadialGradient(0, TUBE.y, BEZEL_R * 0.9, 0, TUBE.y, BEZEL_R * 2.1);
  g.addColorStop(0, "rgba(60,200,110,0.06)");
  g.addColorStop(1, "rgba(60,200,110,0)");
  ctx.fillStyle = g;
  ctx.fillRect(P.x0, P.y0, P.x1 - P.x0, P.y1 - P.y0);
  // years of use: the lacquer unevenly dulled, rubbed pale round the controls
  // a hand reaches for, and fine scratches
  const Wr = rng(1555);
  for (let i = 0; i < 9; i += 1) {
    const bx = lerp(P.x0, P.x1, Wr());
    const by = lerp(P.y0, P.y1, Wr());
    const br = 40 + Wr() * 90;
    g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    g.addColorStop(0, Wr() < 0.5 ? "rgba(255,255,240,0.025)" : "rgba(0,0,0,0.16)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(bx - br, by - br, 2 * br, 2 * br);
  }
  for (const [bx, by, br] of [[228, 728, 60], [-236, 560, 40], [246, 545, 46]]) {
    g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    g.addColorStop(0, "rgba(190,185,165,0.05)");
    g.addColorStop(1, "rgba(190,185,165,0)");
    ctx.fillStyle = g;
    ctx.fillRect(bx - br, by - br, 2 * br, 2 * br);
  }
  ctx.lineCap = "round";
  for (let i = 0; i < 70; i += 1) {
    // most scratches gather where hands work: the right column and the lower edge
    const near = Wr() < 0.6;
    const sx = near ? lerp(160, 320, Wr()) : lerp(P.x0 + 10, P.x1 - 10, Wr());
    const sy = near ? lerp(470, 800, Wr()) : lerp(P.y0 + 10, P.y1 - 10, Wr());
    if (Math.hypot(sx, sy - TUBE.y) < BEZEL_R + 4) continue;
    const a = Wr() * Math.PI;
    const len = 2 + Wr() * Wr() * 22;
    ctx.strokeStyle = `rgba(170,168,155,${0.05 + Wr() * 0.14})`;
    ctx.lineWidth = 0.12 + Wr() * 0.22;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + Math.cos(a) * len * 0.5 + (Wr() - 0.5) * 2, sy + Math.sin(a) * len * 0.5 + (Wr() - 0.5) * 2, sx + Math.cos(a) * len, sy + Math.sin(a) * len);
    ctx.stroke();
  }
  // paint worn through to grey metal along the bottom edge
  for (let i = 0; i < 40; i += 1) {
    const sx = lerp(P.x0 + 6, P.x1 - 6, Wr());
    const sy = P.y1 - 1 - Wr() * Wr() * 6;
    ctx.fillStyle = `rgba(120,120,112,${0.08 + Wr() * 0.18})`;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 0.4 + Wr() * 2.2, 0.25 + Wr() * 0.6, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(160,160,150,0.18)";
  ctx.lineWidth = 1.2;
  rr(ctx, P.x0 + 0.6, P.y0 + 0.6, P.x1 - P.x0 - 1.2, P.y1 - P.y0 - 1.2, 9);
  ctx.stroke();
  for (const [sx, sy] of [
    [P.x0 + 12, P.y0 + 12],
    [P.x1 - 12, P.y0 + 12],
    [P.x0 + 12, P.y1 - 12],
    [P.x1 - 12, P.y1 - 12],
  ]) {
    screw(ctx, sx, sy, 3.6, hash(sx | 0, sy | 0, 3) * 3);
  }

  paintTube(ctx);
  paintControls(ctx);
  paintPlate(ctx);
}

function paintTube(ctx) {
  const cy = TUBE.y;
  // recess shadow round the bezel
  let g = ctx.createRadialGradient(0, cy + 4, BEZEL_R - 2, 0, cy + 4, BEZEL_R + 14);
  g.addColorStop(0, "rgba(0,0,0,0.8)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, cy + 4, BEZEL_R + 14, 0, TAU);
  ctx.fill();

  // the turned bezel ring
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, cy, BEZEL_R, 0, TAU);
  ctx.arc(0, cy, FACE_R, 0, TAU, true);
  ctx.clip("evenodd");
  g = ctx.createLinearGradient(-BEZEL_R, cy - BEZEL_R, BEZEL_R, cy + BEZEL_R);
  g.addColorStop(0, "#5d5f5c");
  g.addColorStop(0.35, "#2b2c2b");
  g.addColorStop(0.65, "#161716");
  g.addColorStop(1, "#090a09");
  ctx.fillStyle = g;
  ctx.fillRect(-BEZEL_R, cy - BEZEL_R, 2 * BEZEL_R, 2 * BEZEL_R);
  // lathe rings
  const R = rng(1520);
  for (let r = FACE_R; r < BEZEL_R; r += 0.35) {
    ctx.strokeStyle = R() < 0.5 ? `rgba(255,255,255,${0.02 + R() * 0.05})` : `rgba(0,0,0,${0.05 + R() * 0.12})`;
    ctx.lineWidth = 0.25;
    ctx.beginPath();
    ctx.arc(0, cy, r, 0, TAU);
    ctx.stroke();
  }
  // the turned profile: a rounded ridge in the middle of the ring, lit at the upper left
  for (const [r0, w, a] of [
    [181, 3.2, 0.16],
    [175, 1.4, 0.22],
    [190.5, 1.2, 0.14],
  ]) {
    ctx.strokeStyle = `rgba(230,232,225,${a})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(0, cy, r0, Math.PI * 0.95, Math.PI * 1.62);
    ctx.stroke();
    ctx.strokeStyle = `rgba(0,0,0,${a * 2})`;
    ctx.beginPath();
    ctx.arc(0, cy, r0 - w * 0.6, Math.PI * 1.95, Math.PI * 2.62);
    ctx.stroke();
  }
  // green light from the face catching the inner lip
  g = ctx.createRadialGradient(0, cy, FACE_R, 0, cy, FACE_R + 6);
  g.addColorStop(0, "rgba(90,255,140,0.22)");
  g.addColorStop(1, "rgba(90,255,140,0)");
  ctx.fillStyle = g;
  ctx.fillRect(-BEZEL_R, cy - BEZEL_R, 2 * BEZEL_R, 2 * BEZEL_R);
  ctx.restore();
  for (let i = 0; i < 4; i += 1) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    screw(ctx, Math.cos(a) * 183.5, cy + Math.sin(a) * 183.5, 3.4, a + 0.7 * i);
  }

  // the face: never quite black, a faint green cast, a slow fall-off to the rim
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, cy, FACE_R, 0, TAU);
  ctx.clip();
  g = ctx.createRadialGradient(-10, cy - 14, 0, 0, cy, FACE_R);
  g.addColorStop(0, "#0b1c11");
  g.addColorStop(0.55, "#07130b");
  g.addColorStop(0.88, "#040a06");
  g.addColorStop(1, "#010201");
  ctx.fillStyle = g;
  ctx.fillRect(-FACE_R, cy - FACE_R, 2 * FACE_R, 2 * FACE_R);
  // phosphor grain
  const G = rng(1521);
  for (let i = 0; i < 9000; i += 1) {
    const a = G() * TAU;
    const r = Math.sqrt(G()) * FACE_R;
    ctx.fillStyle = G() < 0.5 ? "rgba(120,255,160,0.05)" : "rgba(0,0,0,0.25)";
    ctx.fillRect(Math.cos(a) * r, cy + Math.sin(a) * r, 0.45, 0.45);
  }
  // the etched graticule, lit dull green from the edge
  const gx = 5 * DIV;
  const gy = 4 * DIV;
  const lit = ctx.createRadialGradient(0, cy, 20, 0, cy, FACE_R);
  lit.addColorStop(0, "rgba(70,170,100,0.16)");
  lit.addColorStop(0.7, "rgba(80,190,110,0.3)");
  lit.addColorStop(1, "rgba(100,220,130,0.55)");
  ctx.strokeStyle = lit;
  ctx.lineWidth = 0.42;
  ctx.beginPath();
  for (let i = -5; i <= 5; i += 1) {
    ctx.moveTo(i * DIV, cy - gy);
    ctx.lineTo(i * DIV, cy + gy);
  }
  for (let j = -4; j <= 4; j += 1) {
    ctx.moveTo(-gx, cy + j * DIV);
    ctx.lineTo(gx, cy + j * DIV);
  }
  ctx.stroke();
  // finer ticks on the centre lines
  ctx.lineWidth = 0.38;
  ctx.beginPath();
  for (let i = -25; i <= 25; i += 1) {
    if (i % 5 === 0) continue;
    const x = (i * DIV) / 5;
    ctx.moveTo(x, cy - 1.8);
    ctx.lineTo(x, cy + 1.8);
  }
  for (let j = -20; j <= 20; j += 1) {
    if (j % 5 === 0) continue;
    const y = cy + (j * DIV) / 5;
    ctx.moveTo(-1.8, y);
    ctx.lineTo(1.8, y);
  }
  ctx.stroke();
  // the rim of the face sinks into shadow under the bezel lip
  g = ctx.createRadialGradient(0, cy, FACE_R - 14, 0, cy, FACE_R);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.fillStyle = g;
  ctx.fillRect(-FACE_R, cy - FACE_R, 2 * FACE_R, 2 * FACE_R);
  ctx.restore();
}

function label(ctx, en, zh, x, y, size = 5.6) {
  const w1 = engrave(ctx, en, x, y, font(EN, size, 700), { align: "center", spacing: size * 0.08 });
  if (zh) engrave(ctx, zh, x, y + size * 1.25, font(ZH, size * 0.95, 500), { align: "center" });
  return w1;
}

function paintControls(ctx) {
  // ---- right column: gain dial and time base above, the row of three below
  const yg = { x: 246, y: 494, r: 19 };
  dialScale(ctx, yg.x, yg.y, yg.r + 4, -2.2, 2.2, 10, { major: 2, labels: ["·02", "·05", "·1", "·5", "1", "5"] });
  knob(ctx, yg.x, yg.y, yg.r, -0.9);
  label(ctx, "VOLTS / DIV", "垂直灵敏度", yg.x, yg.y - yg.r - 26);

  const tb = { x: 246, y: 596, r: 15 };
  dialScale(ctx, tb.x, tb.y, tb.r + 4, -2.1, 2.1, 12, { major: 3, labels: ["1s", "10m", "1m", "10μ", "1μ"] });
  knob(ctx, tb.x, tb.y, tb.r, 0.55);
  label(ctx, "SWEEP TIME", "扫描时间", tb.x, tb.y - tb.r - 26);

  const ki = KNOBS.intensity;
  dialScale(ctx, ki.x, ki.y, ki.r + 3.5, -2.3, 2.3, 8, { major: 8 });
  knob(ctx, ki.x, ki.y, ki.r, 0.35);
  label(ctx, "INTENSITY", "辉度", ki.x, ki.y - ki.r - 19, 5.0);

  const kf = KNOBS.focus;
  dialScale(ctx, kf.x, kf.y, kf.r + 3.5, -2.3, 2.3, 8, { major: 8 });
  knob(ctx, kf.x, kf.y, kf.r, -0.25);
  label(ctx, "FOCUS", "聚焦", kf.x, kf.y - kf.r - 19, 5.0);

  // the switch's engraved positions (the knob itself is drawn per frame)
  const ks = KNOBS.sweep;
  ctx.strokeStyle = "#dcd9cd";
  ctx.lineWidth = 0.7;
  for (const a of [SWEEP_ANGLE, XY_ANGLE]) {
    const s = Math.sin(a);
    const c = -Math.cos(a);
    ctx.beginPath();
    ctx.moveTo(ks.x + s * (ks.r + 3), ks.y + c * (ks.r + 3));
    ctx.lineTo(ks.x + s * (ks.r + 6.5), ks.y + c * (ks.r + 6.5));
    ctx.stroke();
  }
  engrave(ctx, "SWEEP", ks.x - 11.5, ks.y - ks.r - 8.5, font(EN, 4.2, 700), { align: "center" });
  engrave(ctx, "X–Y", ks.x + 11.5, ks.y - ks.r - 8.5, font(EN, 4.2, 700), { align: "center" });
  engrave(ctx, "工作方式", ks.x, ks.y + ks.r + 9, font(ZH, 4.6, 500), { align: "center" });

  // a ruled line grouping the row, as engraved on the panel
  ctx.strokeStyle = "rgba(220,217,205,0.55)";
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(172, 734);
  ctx.lineTo(290, 734);
  ctx.stroke();

  // ---- left column: power and pilot lamp, positions, inputs
  // pilot lamp: an orange jewel in a chrome bezel, glowing
  const lamp = { x: -262, y: 474 };
  let g = ctx.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 26);
  g.addColorStop(0, "rgba(255,140,40,0.32)");
  g.addColorStop(1, "rgba(255,140,40,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(lamp.x, lamp.y, 26, 0, TAU);
  ctx.fill();
  g = ctx.createRadialGradient(lamp.x - 1.5, lamp.y - 2, 0.5, lamp.x, lamp.y, 7.6);
  g.addColorStop(0, "#d8d8d2");
  g.addColorStop(0.6, "#6a6b67");
  g.addColorStop(1, "#1a1a19");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(lamp.x, lamp.y, 7.6, 0, TAU);
  ctx.fill();
  g = ctx.createRadialGradient(lamp.x - 1, lamp.y - 1.4, 0.3, lamp.x, lamp.y, 5.6);
  g.addColorStop(0, "#fff3c8");
  g.addColorStop(0.3, "#ffb347");
  g.addColorStop(0.75, "#e0641c");
  g.addColorStop(1, "#7a2208");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(lamp.x, lamp.y, 5.6, 0, TAU);
  ctx.fill();
  // facets
  ctx.strokeStyle = "rgba(255,230,180,0.35)";
  ctx.lineWidth = 0.3;
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * TAU;
    ctx.beginPath();
    ctx.moveTo(lamp.x, lamp.y);
    ctx.lineTo(lamp.x + Math.cos(a) * 5.4, lamp.y + Math.sin(a) * 5.4);
    ctx.stroke();
  }
  label(ctx, "PILOT", null, lamp.x, lamp.y + 16, 4.4);

  // power toggle: a chrome bat on a hex nut
  const tg = { x: -222, y: 474 };
  ctx.fillStyle = "#2a2b29";
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * TAU + 0.5;
    ctx[i ? "lineTo" : "moveTo"](tg.x + Math.cos(a) * 6.5, tg.y + Math.sin(a) * 6.5);
  }
  ctx.closePath();
  ctx.fill();
  g = ctx.createRadialGradient(tg.x - 1, tg.y - 1, 0.3, tg.x, tg.y, 4.4);
  g.addColorStop(0, "#d9dad6");
  g.addColorStop(1, "#3b3c3a");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(tg.x, tg.y, 4.4, 0, TAU);
  ctx.fill();
  g = ctx.createLinearGradient(tg.x - 2, 0, tg.x + 2, 0);
  g.addColorStop(0, "#5c5d5a");
  g.addColorStop(0.4, "#f0f0ea");
  g.addColorStop(1, "#4a4b48");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(tg.x - 1.4, tg.y);
  ctx.lineTo(tg.x - 2.2, tg.y - 15);
  ctx.arc(tg.x, tg.y - 15, 2.2, Math.PI, 0);
  ctx.lineTo(tg.x + 1.4, tg.y);
  ctx.closePath();
  ctx.fill();
  engrave(ctx, "ON", tg.x, tg.y - 22, font(EN, 4.2, 700), { align: "center" });
  label(ctx, "POWER", "电源", tg.x, tg.y + 16, 4.4);

  // position knobs
  for (const [x, en, zh, a] of [
    [-262, "Y POS", "垂直位移", -0.3],
    [-214, "X POS", "水平位移", 0.4],
  ]) {
    dialScale(ctx, x, 548, 12.5, -2.4, 2.4, 10, { major: 5 });
    knob(ctx, x, 548, 9.5, a, { skirt: false });
    label(ctx, en, zh, x, 520, 4.6);
  }
  // astigmatism, a small screwdriver adjustment
  ctx.fillStyle = "#0a0a0a";
  ctx.beginPath();
  ctx.arc(-238, 584, 3.6, 0, TAU);
  ctx.fill();
  screw(ctx, -238, 584, 2.8, 0.9);
  engrave(ctx, "ASTIG.", -238, 596, font(EN, 3.8, 700), { align: "center" });

  // input connectors
  for (const [x, en] of [
    [-262, "Y INPUT"],
    [-214, "X INPUT"],
  ]) {
    const y = 630;
    let gg = ctx.createRadialGradient(x - 2, y - 2, 0.5, x, y, 7.5);
    gg.addColorStop(0, "#e6e6e0");
    gg.addColorStop(0.5, "#8b8c88");
    gg.addColorStop(1, "#2b2c2a");
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(x, y, 7.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#0c0c0c";
    ctx.beginPath();
    ctx.arc(x, y, 4.6, 0, TAU);
    ctx.fill();
    gg = ctx.createRadialGradient(x - 0.6, y - 0.6, 0.1, x, y, 1.6);
    gg.addColorStop(0, "#f2e7c2");
    gg.addColorStop(1, "#7d6a32");
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, TAU);
    ctx.fill();
    // bayonet pins
    ctx.fillStyle = "#b9bab5";
    ctx.fillRect(x - 8.8, y - 0.7, 1.6, 1.4);
    ctx.fillRect(x + 7.2, y - 0.7, 1.6, 1.4);
    engrave(ctx, en, x, y + 15, font(EN, 4.2, 700), { align: "center" });
  }
}

/** The maker's plate, which carries the title. */
function paintPlate(ctx) {
  const P = PLATE;
  const w = P.x1 - P.x0;
  const h = P.y1 - P.y0;
  // an engraved border on the panel, two lines, and four small screws
  ctx.strokeStyle = "#dcd9cd";
  ctx.lineWidth = 0.6;
  rr(ctx, P.x0, P.y0, w, h, 2.5);
  ctx.stroke();
  ctx.lineWidth = 0.3;
  rr(ctx, P.x0 + 2.2, P.y0 + 2.2, w - 4.4, h - 4.4, 1.6);
  ctx.stroke();
  const cx = (P.x0 + P.x1) / 2;
  const inner = w - 9;
  // the title lines are kept clean of wear (a maker keeps the plate polished); the small print is worn
  const T = { wear: 0.2 };
  engrave(ctx, META.zh, cx, P.y0 + 20.5, font(ZH, 16.5, 500), { ...T, align: "center", maxW: inner, spacing: 0.6 });
  engrave(ctx, "OSCILLOSCOPE", cx, P.y0 + 38.5, font(EN, 13.6, 700), { ...T, align: "center", maxW: inner, spacing: 0.2 });
  engrave(ctx, "VECTOR GRAPHICS", cx, P.y0 + 55.5, font(EN, 13.6, 700), { ...T, align: "center", maxW: inner });
  // a ruled line, the date, a ruled line, the maker
  ctx.strokeStyle = "rgba(220,217,205,0.7)";
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(P.x0 + 8, P.y0 + 61);
  ctx.lineTo(P.x1 - 8, P.y0 + 61);
  ctx.stroke();
  engrave(ctx, `${META.date} · ${META.dateEn}`, cx, P.y0 + 77.5, font(EN, 13.6, 700), { ...T, align: "center", maxW: inner });
  ctx.beginPath();
  ctx.moveTo(P.x0 + 8, P.y0 + 82.5);
  ctx.lineTo(P.x1 - 8, P.y0 + 82.5);
  ctx.stroke();
  engrave(ctx, "鹈鹕仪器厂 · MODEL P-15", cx, P.y0 + 92.5, font(EN, 6.6, 700), { align: "center", maxW: inner, spacing: 0.3 });
  engrave(ctx, "SER. Nº 0417", cx, P.y0 + 101, font(EN_SMALL, 5.4, 400), { align: "center", spacing: 0.4 });
}

function bakeInstrument(stage) {
  const k = BAKE_PX * stage.s;
  const w = (BAKE.x1 - BAKE.x0) * k;
  const h = (BAKE.y1 - BAKE.y0) * k;
  return stage.bake2d(`scope/instrument/${Math.round(k * 1000)}`, w, h, (ctx) => {
    ctx.setTransform(k, 0, 0, k, -BAKE.x0 * k, -BAKE.y0 * k);
    paintInstrument(ctx, stage);
  });
}

function bakeGlass(stage) {
  const k = BAKE_PX * stage.s;
  const R = FACE_R + 2;
  const size = 2 * R * k;
  return stage.bake2d(`scope/glass/${Math.round(k * 1000)}`, size, size, (ctx) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, size, size);
    ctx.setTransform(k, 0, 0, k, R * k, R * k);
    ctx.beginPath();
    ctx.arc(0, 0, FACE_R, 0, TAU);
    ctx.clip();
    // the curved highlight high on the tube
    ctx.save();
    ctx.filter = `blur(${(3 * k).toFixed(1)}px)`;
    ctx.strokeStyle = "rgba(200,230,215,0.10)";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(0, 26, 150, Math.PI * 1.18, Math.PI * 1.52);
    ctx.stroke();
    ctx.strokeStyle = "rgba(230,245,240,0.10)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 20, 156, Math.PI * 1.22, Math.PI * 1.44);
    ctx.stroke();
    ctx.restore();
    // a soft reflection of an unseen window, upper right
    ctx.save();
    ctx.filter = `blur(${(4 * k).toFixed(1)}px)`;
    ctx.translate(70, -88);
    ctx.rotate(0.12);
    ctx.fillStyle = "rgba(170,200,210,0.05)";
    for (const [x, y] of [
      [0, 0],
      [27, 0],
      [0, 36],
      [27, 36],
    ]) {
      ctx.fillRect(x, y, 24, 33);
    }
    ctx.restore();
    // a fingerprint and a wiped smear on the glass, seen only where they
    // catch the window's light (upper right)
    ctx.save();
    ctx.filter = `blur(${(0.35 * k).toFixed(2)}px)`;
    ctx.translate(98, -52);
    ctx.rotate(-0.5);
    ctx.lineWidth = 0.55;
    for (let i = 1; i <= 13; i += 1) {
      const r = i * 0.85;
      ctx.strokeStyle = `rgba(190,215,210,${0.09 * (1 - i / 15)})`;
      ctx.beginPath();
      ctx.ellipse(0.25 * i, 0, r * 1.35, r, 0, 0.2 + i * 0.3, 0.2 + i * 0.3 + TAU * 0.86);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.filter = `blur(${(5 * k).toFixed(1)}px)`;
    ctx.strokeStyle = "rgba(180,205,205,0.05)";
    ctx.lineWidth = 16;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(30, -128);
    ctx.quadraticCurveTo(80, -100, 125, -40);
    ctx.stroke();
    ctx.restore();
    // the glass deepens towards its rim
    const g = ctx.createRadialGradient(-30, -40, 10, 0, 0, FACE_R);
    g.addColorStop(0, "rgba(120,170,150,0.02)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-R, -R, 2 * R, 2 * R);
  });
}

// ------------------------------------------------------------------ the hand
// A right hand seen from the back, built upright with the pinch point at the
// origin and the wrist below it (units of HAND_S world units); then turned and
// placed. Each finger is knuckle, middle joint, last joint, tip.
// Open: relaxed and half curled, reaching. Pinch: thumb and index take the
// switch's fluted skirt from below at either side, the other fingers fold
// beside it, so the knob's cap and white pointer stay in view while it turns.
// The fingers curl in towards the panel, so from behind their middle and last
// joints are seen end-on: short, bunched, of uneven length and lean.
const HAND_OPEN = {
  thumb: [[-13, 41], [-19.5, 31], [-22, 23.5], [-21, 18.5]],
  index: [[-7, 21], [-9, 11], [-9, 5.5], [-7.8, 2.6]],
  middle: [[0.5, 19.5], [0.2, 8.5], [0.9, 3], [1.8, 0.3]],
  ring: [[8, 21.5], [8.6, 12], [9.6, 7.4], [10.2, 5]],
  pinky: [[14, 25.5], [15.2, 18.6], [16.2, 15], [16.4, 13]],
};
// (in the pinch the thumb and forefinger curl round the skirt, radius about
// 7.8 hand units: the thumb up its lower left flank, the forefinger round its
// lower right, each last joint bent in towards the knob)
const HAND_PINCH = {
  thumb: [[-13, 41], [-18.5, 24.5], [-16, 9.5], [-8.5, 2.5]],
  index: [[-7, 21], [2, 13.5], [9.6, 8.6], [8.9, 1.2]],
  middle: [[0.5, 19.5], [8, 17], [12.5, 14], [13, 10.5]],
  ring: [[8, 21.5], [13.5, 19.5], [16, 16.8], [15.4, 14.6]],
  pinky: [[14, 25.5], [18, 24], [19.6, 21.8], [18.8, 20]],
};
// how far the rim light reaches in on each part (hand units): uneven, as on real skin
const RIM_W = { back: 1.15, thenar: 0.8, thumb: 1.45, index: 1.6, middle: 1.05, ring: 0.85, pinky: 0.7, sleeve: 1.3 };
const FINGER_W = { index: 6.3, middle: 6.7, ring: 6.2, pinky: 5.2, thumb: 7.4 };
// the back of the hand, knuckle bumps along the top, the wrist below
const BACK_OF_HAND = [[-14.5, 62], [-15.5, 50], [-17, 40], [-13.5, 28], [-10.5, 22], [-7, 18.5], [-3, 19], [0.5, 16.5], [4.5, 18.5], [8, 18.5], [11.5, 21], [14.5, 22.5], [18, 26.5], [20.5, 33], [20, 46], [18, 62]];
// the ball of the thumb
const THENAR = [[-15, 57], [-19, 50.5], [-20.5, 42], [-19, 33.5], [-12, 31], [-8, 45]];
// a white lab-coat cuff, mostly below the picture
const SLEEVE = [[-21, 64], [23, 60], [33, 150], [-29, 150]];

function handPose(grip) {
  const out = {};
  for (const k of Object.keys(HAND_OPEN)) {
    out[k] = HAND_OPEN[k].map((p, i) => [lerp(p[0], HAND_PINCH[k][i][0], grip), lerp(p[1], HAND_PINCH[k][i][1], grip)]);
  }
  return out;
}

/** Where the hand is at u: { x, y (pinch point, local), angle, grip, show }. */
function handAt(u) {
  const off = { x: KNOBS.sweep.x - 12, y: 905 };
  const focus = { x: KNOBS.focus.x + 2, y: KNOBS.focus.y + 9 };
  const sw = { x: KNOBS.sweep.x, y: KNOBS.sweep.y };
  let x = off.x;
  let y = off.y;
  let grip = 0.15;
  let twist = 0;
  if (u < 1.6 || u > 4.45) return null;
  if (u < 2.2) {
    // the rise starts with the fingertips at the bottom edge of the picture
    // (y 780 at zoom 1.1), so they break into view at u = 1.6
    const k = easeOutCubic(clamp((u - 1.6) / 0.6));
    x = lerp(off.x + 4, focus.x, k);
    y = lerp(HAND_ENTRY_Y, focus.y, k);
    grip = lerp(0.1, 0.35, k);
  } else if (u < 2.5) {
    x = focus.x + wobble(u * 3, 1530) * 1.2;
    y = focus.y + wobble(u * 3, 1531) * 1.2;
    grip = 0.35;
  } else if (u < 2.82) {
    const k = easeInOutCubic(clamp((u - 2.5) / 0.32));
    x = lerp(focus.x, sw.x, k);
    y = lerp(focus.y, sw.y, k) - 4 * Math.sin(Math.PI * k);
    grip = lerp(0.35, 1, k);
  } else if (u < 3.6) {
    x = sw.x;
    y = sw.y;
    grip = 1;
  } else {
    const k = easeInOutCubic(clamp((u - 3.6) / 0.8));
    const g = clamp((u - 3.6) / 0.18);
    x = lerp(sw.x, off.x, k);
    y = lerp(sw.y + 4 * g, off.y, k);
    grip = lerp(1, 0.3, g);
  }
  twist = switchAngle(u) - SWEEP_ANGLE;
  return { x, y, grip, angle: lerp(0.08, 0.16, clamp((x - KNOBS.focus.x) / (KNOBS.sweep.x - KNOBS.focus.x))) + twist * 0.22 };
}

/** The switch's pointer angle at u. */
function switchAngle(u) {
  if (u < KNOT_ON) return SWEEP_ANGLE;
  if (u < KNOT_OFF) return lerp(SWEEP_ANGLE, XY_ANGLE, easeOutCubic(clamp((u - KNOT_ON) / 0.045)));
  return lerp(XY_ANGLE, SWEEP_ANGLE, easeOutCubic(clamp((u - KNOT_OFF) / 0.035)));
}

const HAND_S = 1.75; // world units per hand unit
const HAND_DARK = "#0b1611"; // the hand in the dark: near-black with a green cast
const HAND_ENTRY_Y = 781; // pinch point at u = 1.6: the curled fingertips just at the frame's bottom edge

/** The hand's extent in local world units (x relative to the pelican), with a margin for the rim. */
function handBounds(hand) {
  const pose = handPose(hand.grip);
  const pts = BACK_OF_HAND.concat(SLEEVE, THENAR, ...Object.values(pose));
  const c = Math.cos(hand.angle);
  const s = Math.sin(hand.angle);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [hx, hy] of pts) {
    const x = hand.x + HAND_S * (hx * c - hy * s);
    const y = hand.y + HAND_S * (hx * s + hy * c);
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const m = 9 * HAND_S;
  return { x0: x0 - m, y0: y0 - m, x1: x1 + m, y1: y1 + m };
}

const FINGER_ORDER = ["thumb", "pinky", "ring", "middle", "index"]; // back to front

function polyPath(ctx, pts) {
  ctx.beginPath();
  pts.forEach((p, i) => ctx[i ? "lineTo" : "moveTo"](p[0], p[1]));
  ctx.closePath();
}

/** A closed outline rounded through the midpoints of its sides (skin has no corners). */
function roundPath(ctx, pts) {
  const n = pts.length;
  const mid = (i) => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2];
  ctx.beginPath();
  const m0 = mid(n - 1);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i += 1) {
    const m = mid(i);
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  ctx.closePath();
}

/** One finger as three tapering phalanges with round ends. */
function strokeFingerTapered(ctx, pts, w) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const ws = [w, w * 0.9, w * 0.8];
  for (let i = 0; i < 3; i += 1) {
    ctx.lineWidth = ws[i];
    ctx.beginPath();
    ctx.moveTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
    ctx.stroke();
  }
  // the joints swell a little, so a bent finger reads as rounded flesh
  const fs = ctx.fillStyle;
  ctx.fillStyle = ctx.strokeStyle;
  for (let i = 1; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.arc(pts[i][0], pts[i][1], ws[i - 1] * 0.54, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = fs;
}

/**
 * Paint the hand's silhouette (cuff, back of the hand, thumb, fingers) in one
 * colour. With `seams`, a hairline of darkness parts each finger from the one
 * behind it.
 */
function handSilhouette(ctx, pose, color, { seams = false, sleeve = true, shift = null } = {}) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  const part = (name, fn) => {
    if (!shift) return fn();
    const [dx, dy] = shift(name);
    ctx.translate(dx, dy);
    fn();
    ctx.translate(-dx, -dy);
  };
  if (sleeve) {
    part("sleeve", () => {
      polyPath(ctx, SLEEVE);
      ctx.fill();
    });
  }
  part("back", () => {
    roundPath(ctx, BACK_OF_HAND);
    ctx.fill();
  });
  part("thenar", () => {
    roundPath(ctx, THENAR);
    ctx.fill();
  });
  for (const name of FINGER_ORDER) {
    const w = FINGER_W[name];
    part(name, () => {
      if (seams && name !== "thumb") {
        ctx.strokeStyle = "#020101";
        strokeFingerTapered(ctx, pose[name], w + 0.9);
        ctx.strokeStyle = color;
      }
      strokeFingerTapered(ctx, pose[name], w);
    });
  }
}

/**
 * Draw the hand at pinch point (hand.x, hand.y), turned by hand.angle, on a
 * 2D patch: a dark hand in a dark room, lit only along the edges that face
 * the tube by its green light, with a soft shadow on the panel behind it.
 * glow: brightness of the tube's light (1 normal, more on a flash).
 */
function drawHand(stage, view, patch, px, hand, glow) {
  const pose = handPose(hand.grip);
  const ctx = patch.ctx;
  const g = clamp(glow, 0, 2.2);
  // direction from the hand to the middle of the tube, in the hand's own frame
  const lx0 = -hand.x;
  const ly0 = TUBE.y - hand.y;
  const ll = Math.hypot(lx0, ly0) || 1;
  const ca = Math.cos(-hand.angle);
  const sa = Math.sin(-hand.angle);
  const lx = (lx0 * ca - ly0 * sa) / ll;
  const ly = (lx0 * sa + ly0 * ca) / ll;
  const toLocal = () => {
    ctx.setTransform(view.k, 0, 0, view.k, view.tx - patch.x, view.ty - patch.y);
    ctx.translate(px + hand.x, hand.y);
    ctx.rotate(hand.angle);
    ctx.scale(HAND_S, HAND_S);
  };

  ctx.save();
  toLocal();
  // 1. the silhouette in the colour of the rim light (paler on the white cuff)
  const rk = clamp(0.74 * g);
  const rim = `rgb(${Math.round(lerp(10, 92, rk))},${Math.round(lerp(9, 222, rk))},${Math.round(lerp(8, 140, rk))})`;
  handSilhouette(ctx, pose, rim);
  // 2. the same shape moved away from the light, dark and softened, only over
  //    the first: what stays lit is a thin graded band on the edges facing the tube
  ctx.globalCompositeOperation = "source-atop";
  //    (graded by laying the dark copy at three offsets; a canvas blur
  //    is far too slow per frame)
  //    the rim's width differs from part to part, and its inner edge is
  //    graded by three dark copies, so it reads as light on a rounded form
  for (const [k, al] of [[1, 1], [0.66, 0.5], [0.36, 0.3]]) {
    ctx.save();
    ctx.globalAlpha = al;
    handSilhouette(ctx, pose, HAND_DARK, { seams: k === 1, shift: (name) => [-lx * RIM_W[name] * k, -ly * RIM_W[name] * k] });
    ctx.restore();
  }
  //    and it is broken along its length: skin is not a clean edge, so soft
  //    shadows fall across the rim here and there (fixed to the hand)
  const rimPts = BACK_OF_HAND.concat(THENAR, ...Object.values(pose));
  for (let i = 0; i < rimPts.length; i += 1) {
    const s = hash(i, 1561);
    if (s < 0.35) continue;
    const [bx, by] = rimPts[i];
    const r = 1.6 + 2.2 * hash(i, 1562);
    const sg = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    sg.addColorStop(0, `rgba(11,22,17,${0.75 * (s - 0.35)})`);
    sg.addColorStop(1, "rgba(11,22,17,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(bx - r, by - r, 2 * r, 2 * r);
  }
  // 3. modelling: the green light falls off across the hand, from the
  //    knuckle nearest the tube to the far side; the skin is warm in the dark
  //    (never a flat green: the body of the hand stays near-black, #0b1611,
  //    and a flash brightens only the rim, not the modelling)
  const gh = Math.min(g, 1.15);
  const wash = ctx.createLinearGradient(lx * 22, ly * 22, -lx * 22, -ly * 22);
  wash.addColorStop(0, `rgba(60,170,110,${0.07 * gh})`);
  wash.addColorStop(0.3, `rgba(40,110,75,${0.025 * gh})`);
  wash.addColorStop(0.55, "rgba(0,0,0,0)");
  wash.addColorStop(1, "rgba(0,0,0,0.38)");
  ctx.fillStyle = wash;
  ctx.fillRect(-45, -30, 90, 190);
  // the knuckles and the curled middle joints stand out towards the viewer:
  // each catches green on its side facing the tube, less the further it is
  const names = ["index", "middle", "ring", "pinky"];
  for (let i = 0; i < names.length; i += 1) {
    const f = pose[names[i]];
    const fall = Math.pow(0.62, i); // index nearest the tube
    for (const [j, r, s] of [[0, 3.6, 0.2], [1, 2.6, 0.15]]) {
      const hx = f[j][0] + lx * 1.4;
      const hy = f[j][1] + ly * 1.4;
      const kg = ctx.createRadialGradient(hx, hy, 0, hx, hy, r);
      kg.addColorStop(0, `rgba(120,215,160,${0.6 * s * fall * gh})`);
      kg.addColorStop(1, "rgba(120,215,160,0)");
      ctx.fillStyle = kg;
      ctx.fillRect(hx - r, hy - r, 2 * r, 2 * r);
    }
    // the curled-under fingertip falls into shadow below the middle joint
    const [tx, ty] = f[3];
    const sg = ctx.createRadialGradient(tx, ty + 0.6, 0, tx, ty + 0.6, FINGER_W[names[i]] * 0.7);
    sg.addColorStop(0, "rgba(0,0,0,0.45)");
    sg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(tx - 5, ty - 4.5, 10, 10);
  }
  // tendons fanning from the wrist to the knuckles, faintly lit
  ctx.lineCap = "round";
  for (let i = 0; i < names.length; i += 1) {
    const [kx, ky] = pose[names[i]][0];
    ctx.strokeStyle = `rgba(110,200,150,${0.045 * Math.pow(0.6, i) * gh})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(lerp(-2, 6, i / 3), 50);
    ctx.quadraticCurveTo(lerp(kx, -2 + i * 2.5, 0.35), lerp(ky, 50, 0.45), kx, ky + 2);
    ctx.stroke();
  }
  // joint creases and nails
  for (const name of ["index", "middle", "ring", "pinky", "thumb"]) {
    const f = pose[name];
    const w = FINGER_W[name];
    for (let j = 1; j <= 2; j += 1) {
      const [x0, y0] = f[j - 1];
      const [x1, y1] = f[j + 1];
      const dx = x1 - x0;
      const dy = y1 - y0;
      const d = Math.hypot(dx, dy) || 1;
      const nx = -dy / d;
      const ny = dx / d;
      const [cx, cy] = f[j];
      const hw = w * (j === 1 ? 0.3 : 0.26);
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 0.45;
      ctx.beginPath();
      ctx.moveTo(cx - nx * hw, cy - ny * hw);
      ctx.quadraticCurveTo(cx + (dx / d) * 0.6, cy + (dy / d) * 0.6, cx + nx * hw, cy + ny * hw);
      ctx.stroke();
    }
    // the nail on the last joint, catching the light
    const [ax, ay] = f[2];
    const [bx, by] = f[3];
    const ang = Math.atan2(by - ay, bx - ax);
    const lit = 0.5 + 0.5 * (lx * Math.cos(ang) + ly * Math.sin(ang));
    ctx.save();
    ctx.translate(lerp(ax, bx, 0.62), lerp(ay, by, 0.62));
    ctx.rotate(ang);
    ctx.fillStyle = `rgba(${Math.round(70 + 50 * lit)},${Math.round(110 + 90 * lit)},${Math.round(90 + 50 * lit)},${(0.03 + 0.07 * lit) * Math.min(1, g)})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.hypot(bx - ax, by - ay) * 0.38, w * 0.27, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  // the cuff: white cotton seen in green light, a hem and two folds
  ctx.save();
  polyPath(ctx, SLEEVE);
  ctx.clip();
  ctx.fillStyle = `rgba(150,195,170,${0.2 * gh})`;
  ctx.fillRect(-40, 55, 90, 100);
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-22, 73);
  ctx.lineTo(25, 68);
  ctx.moveTo(-8, 77);
  ctx.quadraticCurveTo(-4, 105, -12, 140);
  ctx.moveTo(10, 75);
  ctx.quadraticCurveTo(16, 100, 12, 140);
  ctx.stroke();
  ctx.restore();

  // 4. the hand's soft shadow on the panel, thrown away from the tube
  ctx.globalCompositeOperation = "destination-over";
  for (const [k, al] of [[2, 0.28], [4, 0.24]]) {
    ctx.save();
    ctx.translate(-lx * k, -ly * k + k * 0.3);
    handSilhouette(ctx, pose, `rgba(0,0,0,${al})`, { sleeve: false });
    ctx.restore();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

/** The switch knob, drawn on a small layer of its own so it can go in behind the hand. */
function switchKnobLayer(stage, view, u) {
  const ks = KNOBS.sweep;
  const R = ks.r * 2;
  const size = Math.ceil(2 * R * view.k);
  const layer = stage.layer(`scope/knob/${size}`, size, size);
  const ctx = layer.clear();
  const k = size / (2 * R);
  ctx.setTransform(k, 0, 0, k, R * k, R * k);
  knob(ctx, 0, 0, ks.r, switchAngle(u), { skirt: true, seed: 266 });
  return { layer, R };
}

// ------------------------------------------------------------------ the scene
export const scope = {
  ...META,
  road: scopeRoad,
  // on the wall: the tube fills the square, so the trace can be seen from across the room
  still: { u: 4.6 },

  init(stage) {
    bakeInstrument(stage);
    bakeGlass(stage);
    // first-use costs out of the way before playback: compile the phosphor
    // shader, create its working canvases at the film's size, and run the
    // canvas blur filters once (an invisible trace into a scratch buffer)
    const k = 3.2 * stage.s;
    const view = new View(k, 960 * stage.s, 540 * stage.s - TUBE.y * k);
    const fb = stage.fb("scope/warm", 32, 32);
    stage.into(fb, () => {
      drawPhosphor(stage, view, [{ pts: [[-50, TUBE.y], [50, TUBE.y + 20]], a: 0.5, coarse: false }, { pts: [[-40, TUBE.y], [40, TUBE.y]], a: 0.1, coarse: true }], {
        intensity: 0,
        width: 1,
        halo: 3.6,
        clip: { cx: 0, cy: TUBE.y, r: FACE_R - 1, soft: 3 },
        res: 0.5,
        bounds: { x0: -FACE_R, y0: TUBE.y - FACE_R, x1: FACE_R, y1: TUBE.y + FACE_R },
      });
    });
    switchKnobLayer(stage, view, 0);
  },

  render(stage, f) {
    const { p } = stage;
    const view = f.view;
    const px = f.pelican.x;
    const u = f.u;

    stage.origin();
    stage.rect(0, 0, f.w, f.h, "#030403");

    // the instrument, travelling with the pelican
    const inst = bakeInstrument(stage);
    stage.withView(view, () => {
      stage.image(inst, px + BAKE.x0, BAKE.y0, BAKE.x1 - BAKE.x0, BAKE.y1 - BAKE.y0);
    });

    // the trace: the figure now and at earlier instants, all in the tube's frame
    if (f.pelican.visible) {
      const lines = [];
      let fills = null;
      let now = null;
      const side = switchSide(u);
      for (let k = ECHOES; k >= 0; k -= 1) {
        const t = f.t - k * ECHO_DT;
        if (k > 0) {
          // the switch blanks the beam: nothing from the other side of 3.0 or 3.5 glows on,
          // nor the brief half-thrown or ringing figures round them
          const ue = u - k * ECHO_DT;
          const me = knotMix(ue);
          if (switchSide(ue) !== side || (me !== 0 && me < 0.999)) continue;
        }
        const tr = traceAt(f, t, px, k === 0 ? null : f.pelican.y);
        if (k === 0) {
          for (const ln of tr.lines) lines.push(ln);
          now = tr;
          continue;
        }
        const a = echoWeight(k) * (tr.m !== 0 ? 0.8 : 1);
        for (const ln of tr.lines) {
          lines.push({ ...ln, a: ln.a * a * (ln.tag === "spoke" ? 0.8 : 1), w: ln.w, ends: 0, coarse: true });
        }
      }
      const e = now.e;
      if (e > 0.01) fills = burnFills(now.figure, 0.9 * e * (1 - smoothstep(-0.1, 0.6, u) * 0.5));
      const frame60 = Math.floor(f.t * 60 + 1e-6);
      const dropout = hash(frame60, 1540) < 0.012 && !f.still ? 0.6 : 1;
      const fl = flash(u);
      drawPhosphor(stage, view, lines, {
        intensity: (1 + 0.85 * e + fl) * dropout,
        width: 1.0,
        halo: 3.6 + 5 * e + 3 * Math.min(1, fl),
        ends: 0.95,
        color: "#59ff8a",
        deep: "#1fae4d",
        clip: { cx: px, cy: TUBE.y, r: FACE_R - 1, soft: 3 },
        fills,
        res: f.still ? 1 : 0.5,
        bounds: { x0: px - FACE_R, y0: TUBE.y - FACE_R, x1: px + FACE_R, y1: TUBE.y + FACE_R },
      });
    }

    // the glass in front of it
    const glass = bakeGlass(stage);
    stage.withView(view, () => {
      stage.blend(p.ADD, () => {
        const R = FACE_R + 2;
        stage.image(glass, px - R, TUBE.y - R, 2 * R, 2 * R);
      });
    });

    // the switch and the hand
    const hand = handAt(u);
    const ks = KNOBS.sweep;
    let bx0 = ks.x - ks.r * 1.8;
    let by0 = ks.y - ks.r * 1.8;
    let bx1 = ks.x + ks.r * 1.8;
    let by1 = ks.y + ks.r * 1.8;
    if (hand && hand.y - 60 < 800) {
      const b = handBounds(hand);
      bx0 = Math.min(bx0, b.x0);
      by0 = Math.min(by0, b.y0);
      bx1 = Math.min(345, Math.max(bx1, b.x1));
      by1 = 800;
    }
    const patch = stage.patch("scope/hand", view, px + bx0, by0, px + bx1, by1);
    const ctx = patch.ctx;
    ctx.translate(px, 0);
    if (hand && hand.y - 60 < 800) drawHand(stage, view, patch, px, hand, 1 + 0.8 * flash(u));
    const kl = switchKnobLayer(stage, view, u);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "destination-over";
    const kx = view.x(px + ks.x - kl.R) - patch.x;
    const ky = view.y(ks.y - kl.R) - patch.y;
    ctx.drawImage(kl.layer.canvas, kx, ky, 2 * kl.R * view.k, 2 * kl.R * view.k);
    ctx.globalCompositeOperation = "source-over";
    stage.imagePatch(patch);
  },
};

