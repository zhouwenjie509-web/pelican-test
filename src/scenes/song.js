// Section 5. Song dynasty landscape, c. 1000 CE: ink on silk, in homage to
// Fan Kuan's "Travelers Among Mountains and Streams".
//
// A mountain fills the picture. At its foot, where the original has a mule
// train, a pelican rides a bicycle along the path: about one sixtieth of the
// height of the painting. In bar 2 the camera pulls all the way back, the
// pelican is lost in the landscape, and the camera has to push in to find it.
//
// The painting is far too large to keep at close-up resolution, so its ink is
// painted on three sheets of increasing detail (the whole picture, the valley,
// the stretch of path) by one painting program that adds finer marks as it
// gets closer. Each frame lays silk, stacks the sheets for the current zoom,
// and draws the pelican on top in fine line and pale colour.

import { sectionMeta } from "./sections.js";
import { View } from "../kit/stage.js";
import { sampler, noise1 } from "../kit/rng.js";
import { smoothOpen, blob } from "../kit/geom.js";
import { VERT, FRAG_HEAD, NOISE } from "../kit/glsl.js";
import { withPen } from "../kit/pen.js";
import { INK, inkTone, inkOn, inkBrush, inkGround, GROUNDS, blankSheet, stackSheet, layInk } from "../kit/ink.js";
import { sprite, drawText, font, FONTS } from "../kit/text.js";
import { solveRig } from "../rig/rig.js";
import { FOCUS_Y, SPEED, VIEW_H, ZOOM_IN } from "../main/layout.js";
import { blendCameras } from "../main/camera.js";
import { BAR } from "../beat/timeline.js";
import { smoothstep, smootherstep, lerp, clamp } from "../beat/ease.js";

const META = sectionMeta(5);

// ------------------------------------------------------------------ the picture and its sheets
/** The whole painting, as framed by the wide shot (16:9). The road is a tenth of the way up. */
const COMP = { x0: -6150, y0: -4880, x1: 4934, y1: 1355 };
// Each finer sheet is big enough that its edges are out of the frame by the
// time the camera is close enough for it to show.
const SHEETS = [
  { id: "far", r: COMP, px: 0.36, minW: 5.5 },
  { id: "valley", r: { x0: -3400, y0: -2600, x1: 3200, y1: 1355 }, px: 0.82, minW: 2.2 },
  { id: "path", r: { x0: -470, y0: 90, x1: 1470, y1: 860 }, px: 3.4, minW: 0 },
];

// ------------------------------------------------------------------ marks
// The painting program does not draw directly. It collects marks in layers
// (far things first); each layer is then drawn tone by tone, so the brush
// changes ink as rarely as a painter would.
class Marks {
  constructor(sheet) {
    this.sheet = sheet;
    this.r = sheet.r;
    this.minW = sheet.minW;
    this.lod = sheet.id === "far" ? 0 : sheet.id === "valley" ? 1 : 2;
    this.k = sheet.px; // reference pixels per world unit on this sheet
    this.layers = [];
    this.cur = null;
  }

  layer() {
    this.cur = { washes: [], strokes: [], erase: [] };
    this.layers.push(this.cur);
  }

  /**
   * Ink cannot cover ink, so a thing that stands in front of others first
   * clears its own silhouette. Call this right after layer(): the shape is
   * wiped from everything painted before, then the new layer paints into it.
   */
  knockout(pts) {
    const below = this.layers[this.layers.length - 2];
    if (below) below.erase.push({ kind: "area", width: 0, pts, strength: 1 });
  }

  /** Is this box (with margin) inside the sheet at all? */
  sees(x0, y0, x1, y1, m = 0) {
    const r = this.r;
    return x1 + m > r.x0 && x0 - m < r.x1 && y1 + m > r.y0 && y0 - m < r.y1;
  }

  /** Is a mark of this width worth drawing on this sheet? */
  fine(width) {
    return width >= this.minW;
  }

  wash(pts, tone, alpha, opts) {
    this.cur.washes.push({ pts, tone, alpha, opts });
  }

  stroke(kind, tone, width, pts, curvature = 0.5) {
    if (width < this.minW) return;
    this.cur.strokes.push({ kind, tone, width, pts, curvature });
  }

  dab(tone, width, x, y, angle, length, kind = "dab") {
    if (width < this.minW) return;
    if (x < this.r.x0 - 60 || x > this.r.x1 + 60 || y < this.r.y0 - 60 || y > this.r.y1 + 60) return;
    // seen large, a soft dotted touch turns to mush: use a firm, solid one instead
    const use = kind === "dab" && width * this.k > 5 ? "leaf" : kind;
    this.cur.strokes.push({ kind: use, tone, width: use === "leaf" ? width * 1.25 : width, pts: [[x, y], [x + Math.cos(angle) * length, y + Math.sin(angle) * length]], curvature: 0 });
  }

  /**
   * A trunk or bough. From far away it is one loaded stroke; nearer, two
   * contour lines with a wash and dry bark strokes between them; close to, the
   * contours wander independently and the bark is drawn plate by plate.
   * pts = [[x, y, radius], ...] along its centre. front: it stands in front of
   * what was painted before (call layer() first).
   */
  limb(pts, tone, front = false) {
    const dark = (d) => inkTone(clamp(d * tone, 0, 1));
    const r0 = pts[0][2];
    const wide = r0 * 2 * this.k; // width on this sheet, in pixels
    if (wide < 11) {
      this.stroke("bone", dark(0.9), r0 * 2, pts.map((q) => [q[0], q[1], q[2] / r0]), 0.6);
      return;
    }
    const close = wide > 60;
    const path = close ? resampleLimb(pts, 4) : pts;
    const n = path.length;
    const sd = Math.round(pts[0][0] * 13 + pts[0][1] * 7);
    const left = [];
    const right = [];
    for (let i = 0; i < n; i += 1) {
      const a = path[Math.max(0, i - 1)];
      const b = path[Math.min(n - 1, i + 1)];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = -(b[1] - a[1]) / len;
      const ny = (b[0] - a[0]) / len;
      const r = path[i][2];
      const even = 1 + 0.12 * Math.sin(i * 2.3 + pts[0][0]);
      const wl = close ? 1 + 0.34 * (noise1(i * 0.5, sd) - 0.5) + 0.16 * (noise1(i * 1.7, sd + 3) - 0.5) : even;
      const wr = close ? 1 + 0.34 * (noise1(i * 0.5, sd + 9) - 0.5) + 0.16 * (noise1(i * 1.7, sd + 12) - 0.5) : even;
      left.push([path[i][0] + nx * r * wl, path[i][1] + ny * r * wl]);
      right.push([path[i][0] - nx * r * wr, path[i][1] - ny * r * wr]);
    }
    /** A point across the limb at sample i: f = -1 on one contour, 0 on the centre, 1 on the other. */
    const at = (i, f) => {
      const q = path[i];
      const e = f >= 0 ? left[i] : right[i];
      const g = Math.abs(f);
      return [q[0] + (e[0] - q[0]) * g, q[1] + (e[1] - q[1]) * g];
    };
    const shape = left.concat([...right].reverse());
    if (front) this.knockout(shape);
    this.wash(shape, dark(0.3), 150, { bleed: 0.02, texture: 0.6, border: 0.25 });
    const lw = Math.max(1.6, r0 * 0.13);

    if (!close) {
      // bark: dry strokes running with the grain, heavier down the shaded side
      for (let j = 0; j < 4; j += 1) {
        const f = -0.55 + j * 0.38;
        this.stroke("drysoft", dark(0.5 + 0.12 * j), r0 * 0.6, path.map((q, i) => [...at(i, f), 0.9]), 0.6);
      }
      this.stroke("bone", dark(0.95), lw * 1.25, right.map((q, i) => [q[0], q[1], 1.2 - 0.5 * (i / n)]), 0.6);
      this.stroke("bone", dark(0.9), lw, left.map((q, i) => [q[0], q[1], 1.1 - 0.5 * (i / n)]), 0.6);
      // knots and cross-cracks
      for (let i = 1; i < n - 1; i += 2) {
        const q = path[i];
        this.stroke("line", dark(0.8), Math.max(0.8, lw * 0.5), [[q[0] - q[2] * 0.5, q[1] + q[2] * 0.2], [q[0], q[1] - q[2] * 0.15, 1.2], [q[0] + q[2] * 0.4, q[1] + q[2] * 0.25]], 0.7);
      }
      return;
    }

    const rnd = sampler(sd + 4321);
    // the round of the trunk: tone built up in dry layers down the shaded side
    for (const [f, d] of [[0.42, 0.4], [0.72, 0.55]]) this.stroke("drysoft", dark(d), r0 * 0.62, path.map((q, i) => [...at(i, f), 0.9]), 0.6);
    // bark: short strokes with the grain, broken and overlapping
    for (let i = 0; i < n - 2; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        const f = rnd.range(-0.86, 0.86);
        const end = Math.min(n - 1, i + 2 + Math.floor(rnd.next() * 3));
        const drift = rnd.range(-0.035, 0.035);
        const seg = [];
        for (let k = i; k <= end; k += 1) seg.push([...at(k, clamp(f + (k - i) * drift, -0.92, 0.92)), 1.15 - 0.6 * ((k - i) / (end - i))]);
        this.stroke("line", dark(rnd.range(0.42, 0.78) + (f > 0.3 ? 0.14 : 0)), Math.max(0.8, r0 * rnd.range(0.035, 0.075)), seg, 0.5);
      }
    }
    // plates: the bark splits into scales, each a shallow arc across the grain
    for (let i = 1; i < n - 2; i += 2) {
      for (let j = 0; j < 2; j += 1) {
        const f0 = rnd.range(-0.82, 0.3);
        const f1 = f0 + rnd.range(0.3, 0.52);
        const a = at(i, f0);
        const b = at(i, f1);
        const c = at(i + 1, (f0 + f1) / 2);
        const mid = [lerp((a[0] + b[0]) / 2, c[0], 0.55), lerp((a[1] + b[1]) / 2, c[1], 0.55)];
        this.stroke("line", dark(rnd.range(0.6, 0.9)), Math.max(0.9, r0 * 0.05), [[a[0], a[1], 0.6], [mid[0], mid[1], 1.25], [b[0], b[1], 0.5]], 0.8);
      }
    }
    // knots: a ring and a dark eye
    const knots = Math.max(1, Math.round(n / 8));
    for (let kn = 0; kn < knots; kn += 1) {
      const i = 2 + Math.floor(rnd.next() * Math.max(1, n - 5));
      const c = at(i, rnd.range(-0.45, 0.45));
      const rr = path[i][2] * rnd.range(0.17, 0.27);
      const ring = [];
      for (let a = 0; a <= 8; a += 1) {
        const th = (a / 8) * Math.PI * 2;
        ring.push([c[0] + Math.cos(th) * rr * 0.75, c[1] + Math.sin(th) * rr * 1.25, 0.8 + 0.4 * Math.sin(th)]);
      }
      this.stroke("line", dark(0.85), Math.max(1, r0 * 0.055), ring, 0.8);
      this.dab(dark(0.95), Math.max(1.2, rr * 0.55), c[0], c[1] - rr * 0.25, Math.PI / 2, rr * 0.55, "leaf");
    }
    // contours: the line lifts now and then and starts again, never one unbroken edge
    const contour = (side, weight, d) => {
      let from = 0;
      while (from < n - 2) {
        const to = Math.min(n - 1, from + 4 + Math.floor(rnd.next() * 6));
        const seg = side.slice(from, to + 1).map((q, k, arr) => [q[0], q[1], 1.25 - 0.7 * Math.abs(k / (arr.length - 1) - 0.3)]);
        this.stroke("bone", dark(d), weight, seg, seg.length > 2 ? 0.6 : 0);
        from = to + (rnd.next() < 0.3 ? 1 : 0);
      }
    };
    contour(right, lw * 1.2, 0.95);
    contour(left, lw * 1.35, 0.97);
  }

  /** Blank silk: mist, water, a waterfall. Drawn as white over the ink of this layer. */
  mist(kind, width, pts, strength = 1) {
    this.cur.erase.push({ kind, width, pts, strength });
  }

  paint(stage, pen) {
    const ink = inkOn(pen);
    let n = 0;
    for (const layer of this.layers) {
      for (const w of layer.washes) {
        stage.reseed(9000 + n);
        n += 1;
        ink.wash(w.pts, w.tone, w.alpha, w.opts || {});
      }
      pen.flush();
      // lightest ink first, so darker touches sit on top
      const order = [...layer.strokes].sort((a, b) => (a.tone < b.tone ? 1 : a.tone > b.tone ? -1 : a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.width - b.width));
      for (const s of order) {
        if (n % 64 === 0) stage.reseed(9000 + n);
        n += 1;
        ink.stroke(s.kind, s.tone, s.width, s.pts, s.curvature);
      }
      pen.flush();
      for (const e of layer.erase) {
        n += 1;
        if (e.kind === "area") {
          pen.noStroke().wash("#ffffff", Math.round(255 * e.strength));
          pen.polygon(e.pts);
          pen.noWash();
        } else if (e.kind === "veil") {
          // a bank of mist with no edge at all: laid by shader, between brush passes
          pen.flush();
          const [x0, y0, x1, y1] = e.pts;
          const sh = stage.shader("song/veil", VERT, VEIL_FRAG);
          stage.shaderRect(sh, { uOrigin: [x0, y0], uSize: [x1 - x0, y1 - y0], uStrength: e.strength, uSeed: e.width }, pen.x(x0), pen.y(y0), (x1 - x0) * pen.k, (y1 - y0) * pen.k);
        } else if (e.kind === "cloud") {
          // a breath of mist: bare silk with a soft, uneven edge
          stage.reseed(9500 + n);
          pen.noStroke().fill("#ffffff", Math.round(255 * e.strength), { bleed: 0.32, texture: 0.25, border: 0.0 });
          pen.polygon(e.pts);
          pen.noFill();
        } else {
          inkBrush(pen, e.kind, "#ffffff", e.width);
          if (e.pts.length === 2) pen.line(e.pts[0][0], e.pts[0][1], e.pts[1][0], e.pts[1][1]);
          else pen.spline(e.pts, 0.6);
        }
      }
      pen.flush();
    }
    return n;
  }
}

/** Resample a limb's centre line smoothly, carrying its radius along. */
function resampleLimb(pts, seg) {
  if (pts.length < 3) return pts;
  const xy = smoothOpen(pts.map((q) => [q[0], q[1]]), seg);
  return xy.map((q, i) => {
    const f = Math.min(pts.length - 1, i / seg);
    const a = Math.min(pts.length - 2, Math.floor(f));
    return [q[0], q[1], lerp(pts[a][2], pts[a + 1][2], f - a)];
  });
}

const VEIL_FRAG = `${FRAG_HEAD}
uniform vec2 uOrigin;
uniform vec2 uSize;
uniform float uStrength;
uniform float uSeed;
${NOISE}
void main() {
  vec2 w = uOrigin + vTexCoord * uSize;
  float v = vTexCoord.y;
  float n = fbm(vec2(w.x / 1500.0, w.y / 520.0) + uSeed);
  float fine = fbm(vec2(w.x / 380.0, w.y / 150.0) + uSeed * 3.1);
  // wisps high up, a solid bank low down, gone again at the very bottom
  float bank = smoothstep(0.08, 0.62, v + (n - 0.5) * 0.55);
  float a = uStrength * bank * (0.82 + 0.36 * (fine - 0.5));
  a *= 1.0 - smoothstep(0.86, 1.0, v);
  a = clamp(a, 0.0, 1.0);
  fragColor = vec4(a, a, a, a);
}`;

// ------------------------------------------------------------------ rock
/** Break a control polygon into a rugged outline: subdivide, then push points in and out with noise. */
function rugged(ctrl, rough, seed, step = 120) {
  const out = [];
  const n = ctrl.length;
  for (let i = 0; i < n; i += 1) {
    const a = ctrl[i];
    const b = ctrl[(i + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const k = Math.max(1, Math.round(len / step));
    const nx = -(b[1] - a[1]) / (len || 1);
    const ny = (b[0] - a[0]) / (len || 1);
    for (let j = 0; j < k; j += 1) {
      const t = j / k;
      const d = (noise1((i + t) * 2.3, seed) - 0.5) * 2 * rough + (noise1((i + t) * 9.1, seed + 5) - 0.5) * rough * 0.7;
      // keep the foot of the rock where it was drawn
      const hold = a[2] === 0 || (j > 0 && false) ? 0 : 1;
      out.push([a[0] + (b[0] - a[0]) * t + nx * d * hold, a[1] + (b[1] - a[1]) * t + ny * d * hold]);
    }
  }
  return out;
}

function inside(pts, x, y) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const xi = pts[i][0];
    const yi = pts[i][1];
    const xj = pts[j][0];
    const yj = pts[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function boundsOf(pts) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const q of pts) {
    if (q[0] < x0) x0 = q[0];
    if (q[0] > x1) x1 = q[0];
    if (q[1] < y0) y0 = q[1];
    if (q[1] > y1) y1 = q[1];
  }
  return { x0, y0, x1, y1 };
}

/** Distance from (x, y) to the nearest point of a polyline, sampled coarsely. */
function nearLine(line, x, y) {
  let best = Infinity;
  for (let i = 0; i < line.length; i += 1) {
    const d = Math.abs(line[i][0] - x) + Math.abs(line[i][1] - y) * 0.25;
    if (d < best) best = d;
  }
  return best;
}

/**
 * Paint a mass of rock the way Fan Kuan built his cliffs: washes for the
 * body, "raindrop" strokes laid by the thousand (thickest in the clefts,
 * along the edges and under the crest), a heavy broken contour, and a dark
 * cap of scrub.
 *
 *   outline  closed polygon, clockwise from the lower left, crest on top
 *   scale    size of one texture stroke in world units
 *   tone     overall ink strength, 0..1 (distance makes rock paler)
 *   clefts   polylines of deep vertical cracks
 *   crest    [from, to] indices of the outline that carry scrub, or null
 *   foot     y below which the rock dissolves into mist or ground
 *   scrub    how thickly the crest is overgrown (1 = solid)
 *   tuft     size of the scrub's touches relative to the texture strokes
 */
function paintMass(m, outline, { scale, tone = 1, density = 1, clefts = [], crest = null, foot = null, seed = 1, contour = 2.6, scrub = 1, tuft = 1 }) {
  const bb = boundsOf(outline);
  if (!m.sees(bb.x0, bb.y0 - scale * 5, bb.x1, bb.y1)) return;
  const rnd = sampler(seed * 7919 + 17);
  const dark = (d) => inkTone(clamp(d * tone, 0, 1));
  const height = bb.y1 - bb.y0;
  const fade = foot === null ? bb.y1 : foot;

  m.layer();
  m.knockout(outline);
  m.wash(outline, dark(0.22), 120, { bleed: 0.03, texture: 0.55, border: 0.3 });
  // a second, darker wash under the crest and down the shaded right side
  const upper = outline.filter((q) => q[1] < bb.y0 + height * 0.5);
  if (upper.length > 6) m.wash(upper, dark(0.34), 85, { bleed: 0.2, texture: 0.5, border: 0.05 });

  // raindrop strokes
  const count = Math.round((((bb.x1 - bb.x0) * height) / (scale * scale * 3.4)) * density);
  for (let i = 0; i < count; i += 1) {
    const x = rnd.range(bb.x0, bb.x1);
    const y = rnd.range(bb.y0, bb.y1);
    if (!inside(outline, x, y)) continue;
    const v = (y - bb.y0) / height; // 0 at the top
    let near = 1;
    for (const c of clefts) near = Math.min(near, nearLine(c, x, y) / (scale * 16));
    const edge = Math.min(1, Math.min(x - bb.x0, bb.x1 - x) / (scale * 22));
    const keep = (0.3 + 0.7 * (1 - Math.min(near, edge))) * (0.55 + 0.45 * (1 - v)) * (1 - smoothstep(fade - height * 0.22, fade, y));
    if (rnd.next() > keep) continue;
    const depth = 0.4 + 0.42 * (1 - Math.min(near, edge)) + 0.12 * rnd.next();
    m.dab(dark(depth), scale * rnd.range(0.55, 0.95), x, y, Math.PI / 2 + rnd.range(-0.22, 0.22), scale * rnd.range(1.8, 3.6));
  }

  // clefts: a dry stroke for the shadow, a loaded one for the crack itself
  clefts.forEach((c, i) => {
    const pts = c.map((q, k) => [q[0], q[1], 1.25 - 0.7 * (k / (c.length - 1))]);
    m.stroke("drysoft", dark(0.6), scale * 3.6, pts, 0.6);
    m.stroke("bone", dark(0.9), scale * (0.8 + 0.3 * (i % 2)), pts, 0.6);
  });

  // contour: several loaded strokes with gaps between, never one unbroken
  // line, and nothing along the foot, which is lost in mist or ground
  const footY = bb.y1 - height * 0.04;
  const runs = [];
  let cur = [];
  for (const q of outline) {
    if (q[1] < Math.min(footY, fade - height * 0.06)) cur.push(q);
    else if (cur.length) {
      runs.push(cur);
      cur = [];
    }
  }
  if (cur.length) runs.push(cur);
  for (const whole of runs) {
    const run = Math.max(5, Math.round(whole.length / 7));
    for (let from = 0; from < whole.length - 2; from += run) {
      const seg = whole.slice(from, Math.min(whole.length, from + run + 2));
      if (seg.length < 3) continue;
      const pts = seg.map((q, k) => [q[0], q[1], 1.3 - 0.75 * Math.abs(k / (seg.length - 1) - 0.35)]);
      m.stroke("drysoft", dark(0.55), scale * contour * 2.4, pts.map((q) => [q[0] + scale * 1.2, q[1] + scale * 1.5, q[2]]), 0.5);
      m.stroke("bone", dark(0.96), scale * contour * rnd.range(0.5, 0.85), pts, 0.5);
    }
  }

  // scrub along the crest: dense dark touches, three deep
  if (crest) {
    const [c0, c1] = crest;
    for (let i = c0; i < c1; i += 1) {
      const a = outline[i];
      const b = outline[i + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const tufts = Math.max(1, Math.round((len / (scale * 1.5)) * scrub));
      for (let k = 0; k < tufts; k += 1) {
        const t = (k + rnd.next()) / tufts;
        const x = a[0] + (b[0] - a[0]) * t;
        const y = a[1] + (b[1] - a[1]) * t;
        for (let j = 0; j < 4; j += 1) {
          const ts = scale * tuft;
          m.dab(dark(rnd.range(0.84, 1)), ts * rnd.range(1.0, 1.7), x + rnd.range(-1, 1) * ts * 2.4, y + rnd.range(-3.4, 2.2) * ts, -Math.PI / 2 + rnd.range(-0.55, 0.55), ts * rnd.range(1.8, 3.6));
        }
      }
    }
  }
}

/** A rounded hill or bluff as a control polygon: flat foot, broken top. */
function bluff(x, w, top, base, seed, rough) {
  const rnd = sampler(seed * 31337 + 1);
  const ctrl = [[x - w, base, 0]];
  const steps = 7;
  for (let i = 0; i <= steps; i += 1) {
    const t = -1 + (2 * i) / steps;
    const lift = 1 - Math.abs(t) ** 2.6;
    ctrl.push([x + t * w * (0.96 + 0.06 * rnd.next()), base - (base - top) * (0.28 + 0.72 * lift) * rnd.range(0.86, 1.06)]);
  }
  ctrl.push([x + w, base, 0]);
  return rugged(ctrl, rough, seed, Math.max(40, w / 9));
}

/**
 * A block of rock as a control polygon: a flat-topped main mass with a lower
 * shoulder to one side, the way boulders are built in Northern Song pictures.
 * (cx, base) is the middle of its foot; rx its half-width; ry its height.
 */
function crag(cx, base, rx, ry, seed, rough) {
  const rnd = sampler(seed * 48611 + 7);
  const side = rnd.next() < 0.5 ? 1 : -1;
  const a = -side * rnd.range(0.12, 0.3); // centre of the main block, in half-widths
  const wa = rnd.range(0.52, 0.66); // its half-width
  const b = side * rnd.range(0.5, 0.68); // centre of the shoulder
  const hb = rnd.range(0.42, 0.66); // height of the shoulder
  const tilt = rnd.range(-0.16, 0.16); // the top is never level
  const ctrl = [[cx - rx, base, 0]];
  const steps = 12;
  for (let i = 0; i <= steps; i += 1) {
    const t = -1 + (2 * i) / steps;
    const main = clamp((1 - Math.abs(t - a) / wa) * 3.2, 0, 1) * (1 + tilt * (t - a));
    const shoulder = hb * clamp((1 - Math.abs(t - b) / 0.42) * 2.6, 0, 1);
    const apron = 0.1 + 0.16 * (1 - Math.abs(t));
    ctrl.push([cx + t * rx * 0.97, base - ry * Math.max(main, shoulder, apron) * rnd.range(0.93, 1.05)]);
  }
  ctrl.push([cx + rx, base, 0]);
  return rugged(ctrl, rough, seed, Math.max(6, rx / 11));
}

/** Height of an outline's upper edge at x (smallest y of any edge crossing x). */
function topAt(outline, x) {
  let top = Infinity;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i, i += 1) {
    const a = outline[j];
    const b = outline[i];
    if ((a[0] <= x && b[0] >= x) || (b[0] <= x && a[0] >= x)) {
      const t = b[0] === a[0] ? 0 : (x - a[0]) / (b[0] - a[0]);
      top = Math.min(top, a[1] + (b[1] - a[1]) * t);
    }
  }
  return top;
}

/** [first, last] outline indices of the stretch that lies in the top `frac` of its height. */
function topRun(outline, frac) {
  const bb = boundsOf(outline);
  const band = bb.y0 + (bb.y1 - bb.y0) * frac;
  const first = outline.findIndex((q) => q[1] < band);
  let last = first;
  for (let i = first; i < outline.length; i += 1) if (outline[i][1] < band) last = i;
  return [first, last];
}

// ------------------------------------------------------------------ trees
/** Leaves in the "个" touch: three or four strokes fanning down from one point. */
function leafSpray(m, x, y, size, tone, rnd) {
  const n = 3 + (rnd.next() < 0.4 ? 1 : 0);
  for (let i = 0; i < n; i += 1) {
    const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.5 + rnd.range(-0.12, 0.12);
    m.dab(tone, size * rnd.range(0.3, 0.4), x, y, a, size * rnd.range(0.8, 1.15), "leaf");
  }
}

/**
 * A bough that reaches out low and sags, the "crab claw" of an old tree, with
 * sprays of leaves on its twigs. (x, y) is where it leaves the trunk, dir is
 * -1 or 1, r its radius at the trunk.
 */
function paintBough(m, x, y, dir, len, r, seed, tone = 1) {
  if (!m.sees(Math.min(x, x + dir * len) - 60, y - len * 0.4, Math.max(x, x + dir * len) + 60, y + len * 0.6)) return;
  const rnd = sampler(seed * 7411 + 19);
  const dark = (d) => inkTone(clamp(d * tone, 0, 1));
  const n = 6;
  const pts = [];
  for (let k = 0; k <= n; k += 1) {
    const t = k / n;
    pts.push([x + dir * len * t, y - len * 0.16 * Math.sin(t * Math.PI * 0.9) + len * 0.3 * t * t + (noise1(k * 1.3, seed) - 0.5) * len * 0.05, r * (1 - 0.86 * t)]);
  }
  m.limb(pts, tone);
  const size = clamp(len * 0.055, 6.5, 10);
  for (let k = 2; k <= n; k += 1) {
    const q = pts[k];
    const twigs = k === n ? 3 : 2;
    for (let j = 0; j < twigs; j += 1) {
      const up = (k + j) % 2 === 0 ? -1 : 1;
      const tl = len * rnd.range(0.1, 0.2);
      const ang = (dir > 0 ? 0 : Math.PI) + dir * up * rnd.range(0.5, 1.1);
      const ex = q[0] + Math.cos(ang) * tl;
      const ey = q[1] + Math.sin(ang) * tl * 0.8 + tl * 0.25;
      m.stroke("line", dark(0.85), Math.max(m.minW, r * 0.22), [[q[0], q[1], 1.2], [(q[0] + ex) / 2, (q[1] + ey) / 2 - up * tl * 0.08, 0.9], [ex, ey, 0.4]], 0.6);
      const sprays = 4 + Math.floor(rnd.next() * 3);
      for (let i = 0; i < sprays; i += 1) leafSpray(m, ex + rnd.range(-1, 1) * tl * 0.55, ey + rnd.range(-0.7, 0.5) * tl * 0.5, size * rnd.range(0.85, 1.2), dark(rnd.range(0.7, 1)), rnd);
    }
  }
}

/**
 * A tree: trunk, a few boughs, foliage in clumps of small touches.
 * (x, y) is the foot, h the height. Distant trees collapse to a clump and a stem.
 */
function paintTree(m, x, y, h, seed, tone = 1, { low = [], style = "dot" } = {}) {
  if (!m.sees(x - h * 0.6, y - h * 1.15, x + h * 0.6, y)) return;
  const rnd = sampler(seed * 104729 + 5);
  const dark = (d) => inkTone(clamp(d * tone, 0, 1));
  const lean = rnd.range(-0.22, 0.22);
  const trunkW = h * 0.055;
  // trunk line
  const trunk = [];
  for (let k = 0; k <= 6; k += 1) {
    const t = k / 6;
    trunk.push([x + lean * h * t + Math.sin(t * 5 + seed) * h * 0.03, y - h * 0.62 * t, (trunkW / 2) * (1.25 - 0.8 * t)]);
  }
  // boughs first, so the trunk is painted over where they leave it
  const top = trunk[trunk.length - 1];
  const boughs = [];
  const nb = 3 + Math.floor(rnd.next() * 3);
  for (let bi = 0; bi < nb; bi += 1) {
    const t = rnd.range(0.45, 1);
    const from = trunk[Math.round(t * 6)];
    const ang = -Math.PI / 2 + rnd.range(-1.25, 1.25);
    const len = h * rnd.range(0.2, 0.38);
    const end = [from[0] + Math.cos(ang) * len, from[1] + Math.sin(ang) * len * 0.8];
    const r = from[2] * 0.5;
    const pts = [];
    for (let k = 0; k <= 4; k += 1) {
      const u = k / 4;
      pts.push([lerp(from[0], end[0], u) + Math.sin(u * Math.PI) * rnd.range(-1, 1) * h * 0.025, lerp(from[1], end[1], u) - Math.sin(u * Math.PI) * h * 0.03, r * (1 - 0.88 * u)]);
    }
    m.limb(pts, tone);
    boughs.push(end);
  }
  boughs.push([top[0], top[1] - h * 0.1]);
  // low boughs: { t: how far up the trunk (0..1), dir, len }
  low.forEach((lb, i) => {
    const f = clamp(lb.t, 0, 1) * 6;
    const a = Math.min(5, Math.floor(f));
    const at = [lerp(trunk[a][0], trunk[a + 1][0], f - a), lerp(trunk[a][1], trunk[a + 1][1], f - a), lerp(trunk[a][2], trunk[a + 1][2], f - a)];
    paintBough(m, at[0] + lb.dir * at[2] * 0.5, at[1], lb.dir, lb.len, at[2] * 0.42, seed * 3 + i, tone);
  });
  m.layer();
  m.limb(trunk, tone, true);
  // roots gripping the ground
  const rootW = Math.max(trunkW * 0.11, m.minW);
  const near = m.lod === 2 && trunkW * m.k > 60;
  for (const dir of [-1, 1]) {
    m.stroke("bone", dark(0.9), rootW, [[x + dir * trunkW * 0.35, y - h * 0.03, 1.2], [x + dir * trunkW * 0.9, y - h * 0.004, 0.9], [x + dir * trunkW * 1.5, y + h * 0.004, 0.3]], 0.6);
    if (near) {
      m.stroke("bone", dark(0.85), rootW * 0.8, [[x + dir * trunkW * 0.12, y - h * 0.02, 1.1], [x + dir * trunkW * 0.5, y + h * 0.001, 0.9], [x + dir * trunkW * 1.0, y + h * 0.012, 0.3]], 0.6);
      m.stroke("drysoft", dark(0.5), trunkW * 0.34, [[x + dir * trunkW * 0.3, y - h * 0.012], [x + dir * trunkW * 1.15, y + h * 0.006]], 0);
    }
  }
  // foliage
  const leaf = Math.max(h * (m.lod === 0 ? 0.034 : m.lod === 1 ? 0.02 : 0.013), m.minW * 1.02);
  const perClump = m.lod === 0 ? 14 : m.lod === 1 ? 30 : 60;
  for (const c of boughs) {
    const rx = h * rnd.range(0.15, 0.23);
    const ry = rx * rnd.range(0.6, 0.85);
    for (let i = 0; i < perClump; i += 1) {
      const a = rnd.range(0, Math.PI * 2);
      const r = Math.sqrt(rnd.next());
      const lx = c[0] + Math.cos(a) * rx * r;
      const ly = c[1] + Math.sin(a) * ry * r - ry * 0.3;
      if (style === "spray" && m.lod > 0) {
        if (i % 4 === 0) leafSpray(m, lx, ly, leaf * 3.3, dark(rnd.range(0.7, 1)), rnd);
      } else m.dab(dark(rnd.range(0.7, 1)), leaf * rnd.range(0.85, 1.25), lx, ly, Math.PI / 2 + rnd.range(-0.9, 0.9), leaf * rnd.range(1.4, 2.6));
    }
  }
}

/**
 * A boulder: a block with a shoulder, folds that divide it into faces, scrub
 * on top. Seen from close by it gets finer texture strokes, a shaded side to
 * every fold, and a foot that fades into the ground.
 */
function paintBoulder(m, cx, cy, rx, ry, seed, tone = 1) {
  if (!m.sees(cx - rx * 1.2, cy - ry * 1.3, cx + rx * 1.2, cy + ry * 0.4)) return;
  const base = cy + ry * 0.14;
  const outline = crag(cx, base, rx, ry * 1.14, seed, rx * 0.035);
  const rnd = sampler(seed * 15485863 + 3);
  const close = m.lod === 2;
  const dark = (d) => inkTone(clamp(d * tone, 0, 1));
  const folds = [];
  for (let c = 0; c < 3; c += 1) {
    const x0 = cx + rnd.range(-0.62, 0.62) * rx;
    const top = topAt(outline, x0);
    const lean = rnd.range(-0.22, 0.22) * rx;
    folds.push([[x0, top + ry * 0.03], [x0 + lean * 0.4, lerp(top, base, 0.45)], [x0 + lean, base - ry * 0.05]]);
  }
  const clefts = close ? folds : folds.slice(0, 2);
  const scale = close ? clamp(rx / 55, 1.15, 2.1) : Math.max(rx / 30, m.minW * 0.95);
  paintMass(m, outline, { scale, tone, density: close ? 1.2 : 0.9, clefts, crest: topRun(outline, 0.22), seed, contour: close ? 1.9 : 1.5, scrub: close ? 0.55 : 0.8, tuft: clamp(19 / scale, 0.45, 1) });
  if (rx * m.k < 40) return;
  // a shaded face to the right of each fold
  for (const f of clefts) {
    const w = rx * rnd.range(0.14, 0.24);
    const face = [f[0], f[1], f[2], [f[2][0] + w, f[2][1]], [f[1][0] + w * 0.8, f[1][1]], [f[0][0] + w * 0.25, f[0][1] + ry * 0.1]];
    m.wash(face, dark(0.34), 105, { bleed: 0.12, texture: 0.5, border: 0.04 });
  }
  // the foot is lost in the ground
  m.mist("cloud", 0, blob(cx, base, rx * 1.12, ry * 0.2, 0.25, seed + 300, 9), 1);
}

// ------------------------------------------------------------------ the painting program
// The great peak: one colossal block, stepped at the left shoulder, with a
// deep cleft right of centre where the waterfall hangs.
const PEAK_FOOT = -560;
const PEAK = [
  [-2920, PEAK_FOOT, 0],
  [-2980, -1500],
  [-2840, -2320],
  [-2600, -2740],
  [-2520, -3170],
  [-2260, -3540],
  [-2060, -3960],
  [-1700, -4270],
  [-1250, -4430],
  [-800, -4490],
  [-350, -4410],
  [60, -4210],
  [330, -3900],
  [490, -3440],
  [570, -2900],
  [710, -2480],
  [830, -1900],
  [870, -1200],
  [800, PEAK_FOOT, 0],
];
const WATERFALL = { x: -330, top: -3420, bottom: -1250 };

function cleft(x, y0, y1, seed, sway = 90) {
  const pts = [];
  for (let k = 0; k <= 6; k += 1) pts.push([x + (noise1(k * 1.1, seed) - 0.5) * sway * 2, lerp(y0, y1, k / 6)]);
  return pts;
}

function paintFarPeaks(m) {
  // pale ranges behind, to either side: one or two tones, little detail
  const far = [
    [-5300, 760, -2950, 21],
    [-4250, 620, -3480, 22],
    [-3500, 480, -2700, 23],
    [1780, 560, -2700, 24],
    [2700, 640, -2150, 25],
    [3750, 760, -1950, 26],
    [4650, 520, -1700, 27],
  ];
  for (const [x, w, top, seed] of far) {
    const outline = bluff(x, w, top, -640, seed, w * 0.1);
    const n = outline.length;
    paintMass(m, outline, { scale: 20, tone: 0.4, density: 0.42, clefts: [cleft(x - w * 0.2, top + 420, top + 1500, seed + 60), cleft(x + w * 0.35, top + 600, top + 1700, seed + 61)], crest: [Math.round(n * 0.3), Math.round(n * 0.7)], foot: -900, seed, contour: 1.5 });
  }
}

function paintPeak(m) {
  // buttresses that stand in front of the main block, left and right
  const left = rugged(
    [
      [-3950, PEAK_FOOT, 0],
      [-3900, -1500],
      [-3700, -2200],
      [-3350, -2600],
      [-2950, -2500],
      [-2700, -1900],
      [-2640, PEAK_FOOT, 0],
    ],
    70,
    41,
  );
  const right = rugged(
    [
      [560, PEAK_FOOT, 0],
      [620, -1700],
      [820, -2500],
      [1150, -2850],
      [1480, -2650],
      [1680, -1900],
      [1740, PEAK_FOOT, 0],
    ],
    70,
    42,
  );
  const main = rugged(PEAK, 85, 43, 150);
  const crestOf = (pts) => topRun(pts, 0.3);

  paintMass(m, main, {
    scale: 21,
    tone: 0.9,
    density: 1,
    clefts: [cleft(-2250, -3350, -1700, 71), cleft(-1650, -4050, -1900, 72), cleft(-1060, -4250, -2300, 73), cleft(WATERFALL.x, -4200, -1500, 74, 40), cleft(250, -3800, -1800, 75)],
    crest: crestOf(main),
    foot: PEAK_FOOT - 250,
    seed: 43,
    contour: 2.9,
  });
  paintMass(m, left, { scale: 19, tone: 0.82, density: 0.9, clefts: [cleft(-3450, -2350, -1500, 76), cleft(-3050, -2300, -1400, 77)], crest: crestOf(left), foot: PEAK_FOOT - 250, seed: 41, contour: 2.6 });
  paintMass(m, right, { scale: 19, tone: 0.82, density: 0.9, clefts: [cleft(980, -2600, -1500, 78), cleft(1350, -2500, -1400, 79)], crest: crestOf(right), foot: PEAK_FOOT - 250, seed: 42, contour: 2.6 });

  // the waterfall: a thread of bare silk down the darkest recess of the cliff
  m.layer();
  const wf = WATERFALL;
  const N = 10;
  const fall = [];
  for (let k = 0; k <= N; k += 1) fall.push([wf.x + Math.sin(k * 1.7) * 10, lerp(wf.top, wf.bottom, k / N)]);
  const band = (inner, outer) => {
    const l = fall.map((q, k) => [q[0] - lerp(inner, outer, k / N), q[1]]);
    const r = fall.map((q, k) => [q[0] + lerp(inner, outer, k / N), q[1]]);
    return l.concat(r.reverse());
  };
  m.wash(band(120, 230), inkTone(0.5), 125, { bleed: 0.2, texture: 0.5, border: 0.05 });
  for (const off of [-100, -52, 50, 96]) m.stroke("drysoft", inkTone(0.62), 90, fall.map((q, k) => [q[0] + off, q[1], 1.2 - 0.5 * (k / N)]), 0.6);
  const rnd = sampler(4711);
  for (let i = 0; i < 520; i += 1) {
    const side = rnd.next() < 0.5 ? -1 : 1;
    const x = wf.x + side * rnd.range(34, 215);
    const y = lerp(wf.top - 120, wf.bottom, rnd.next());
    m.dab(inkTone(rnd.range(0.7, 1)), 21 * rnd.range(0.55, 0.95), x, y, Math.PI / 2 + rnd.range(-0.2, 0.2), 21 * rnd.range(1.8, 3.6));
  }
  // the water: narrow where it leaps the lip, a little wider as it drops
  m.mist("area", 0, band(9, 26), 1);
}

function paintMist(m) {
  // the mountain's foot dissolves: long, low clouds of bare silk laid over one another
  m.layer();
  const rnd = sampler(909);
  for (let i = 0; i < 26; i += 1) {
    const y = lerp(-1650, -420, rnd.next() ** 0.7);
    const depth = (y + 1650) / 1230; // 0 high up .. 1 at the foot
    const cx = rnd.range(-5600, 4300);
    const rx = rnd.range(900, 2300) * (0.6 + 0.6 * depth);
    const ry = rnd.range(90, 190) * (0.6 + 1.0 * depth);
    if (!m.sees(cx - rx, y - ry, cx + rx, y + ry, 200)) continue;
    m.mist("cloud", 0, blob(cx, y, rx, ry, 0.22, 400 + i, 11), 0.5 + 0.3 * depth);
  }
  // and a bank of mist over all of it, so no wash keeps an edge down there
  m.mist("veil", 3, [COMP.x0 - 400, -1850, COMP.x1 + 400, -260], 0.94);
}

function paintMiddle(m) {
  // two wooded bluffs with the stream valley between them
  const bluffs = [
    [-5100, 1050, -520, 31],
    [-3700, 1200, -860, 32],
    [-2250, 900, -600, 33],
    [-1480, 380, -260, 34],
    [820, 560, -300, 35],
    [1750, 980, -660, 36],
    [3150, 1250, -900, 37],
    [4500, 900, -560, 38],
  ];
  const tops = [];
  for (const [x, w, top, seed] of bluffs) {
    const outline = bluff(x, w, top, 330, seed, w * 0.085);
    const n = outline.length;
    paintMass(m, outline, { scale: 15, tone: 1, density: 0.85, clefts: [cleft(x - w * 0.35, top + 260, 220, seed + 80, 60), cleft(x + w * 0.3, top + 320, 240, seed + 81, 60)], crest: [Math.round(n * 0.32), Math.round(n * 0.68)], foot: 400, seed, contour: 2.3 });
    tops.push({ x, w, top, outline });
  }

  // trees along their crests
  m.layer();
  const rnd = sampler(4242);
  for (const b of tops) {
    const n = Math.round(b.w / 120);
    for (let i = 0; i < n; i += 1) {
      const t = rnd.range(-0.8, 0.8);
      const tx = b.x + t * b.w;
      const ty = 330 - (330 - b.top) * (0.28 + 0.72 * (1 - Math.abs(t) ** 2.6)) + 40;
      paintTree(m, tx, ty, rnd.range(330, 520), Math.round(tx) + 9000, 1);
    }
  }

  // temple roofs among the trees on the right-hand bluff
  const tx = 2900;
  const ty = -900;
  const roof = (x, y, w, h) => {
    m.stroke("bone", INK.jiao, 13, [[x - w, y, 0.6], [x - w * 0.5, y - h * 0.55, 1], [x, y - h, 1.1], [x + w * 0.5, y - h * 0.55, 1], [x + w, y, 0.6]], 0.35);
    m.stroke("bone", INK.nong, 9, [[x - w * 1.12, y + 4], [x + w * 1.12, y + 4]], 0);
    m.stroke("line", INK.nong, 6, [[x - w * 0.7, y + 8], [x - w * 0.7, y + h * 0.9]], 0);
    m.stroke("line", INK.nong, 6, [[x + w * 0.7, y + 8], [x + w * 0.7, y + h * 0.9]], 0);
  };
  m.layer();
  roof(tx, ty, 170, 110);
  roof(tx + 280, ty + 70, 120, 84);
  roof(tx - 50, ty - 170, 90, 72);

  // the valley between the two bluffs is lost in mist
  m.layer();
  for (let i = 0; i < 5; i += 1) m.mist("cloud", 0, blob(-460 + (i % 2) * 120, -200 + i * 120, 620, 120, 0.25, 600 + i, 10), 0.6);
  // and so are the feet of the bluffs themselves, down to the trees by the path
  m.mist("veil", 5, [COMP.x0 - 400, -60, COMP.x1 + 400, 480], 0.96);
}

/** The big trees left and right of the path, rooted behind it. */
function paintGrove(m) {
  m.layer();
  const trees = [
    [-2850, 560, 1250, 61],
    [-2300, 620, 1050, 62],
    [-1640, 660, 900, 63],
    [1960, 650, 920, 64],
    [2560, 600, 1200, 65],
    [3300, 570, 1340, 66],
    [3980, 630, 1020, 67],
  ];
  for (const t of trees) paintTree(m, ...t);
}

/** The great boulders at the foot of the picture: nearest of all, so painted last. */
function paintNearRocks(m) {
  const rocks = [
    [-5000, 1130, 980, 520, 51],
    [-3500, 1060, 860, 600, 52],
    [-2250, 1245, 700, 440, 53],
    [-1350, 1230, 460, 330, 54],
    [2500, 1260, 560, 300, 55],
    [3650, 1180, 820, 420, 56],
    [4650, 1100, 620, 500, 57],
  ];
  for (const r of rocks) paintBoulder(m, ...r);
}

/** Ground the path crosses, and everything along it that only shows from close by. */
function paintPath(m) {
  const rnd = sampler(777);
  // the bank behind the path: rocks, then the trees that stand over it
  const stones = [
    [-330, 640, 120, 96, 71],
    [-120, 668, 62, 44, 72],
    [150, 652, 96, 70, 73],
    [455, 672, 54, 36, 74],
    [620, 640, 132, 104, 75],
    [905, 662, 78, 52, 76],
    [1130, 646, 110, 86, 77],
    [1370, 668, 70, 48, 78],
  ];
  for (const s of stones) paintBoulder(m, ...s);
  m.layer();
  // old trees, some with a bough hanging low over the path
  const trees = [
    [-405, 688, 640, 81, {}],
    [35, 684, 560, 82, {}],
    [372, 690, 700, 83, { low: [{ t: 0.4, dir: 1, len: 165 }] }],
    [790, 686, 600, 84, { low: [{ t: 0.48, dir: -1, len: 170 }] }],
    [1010, 690, 520, 85, { low: [{ t: 0.55, dir: 1, len: 135 }] }],
    [1290, 688, 680, 86, { low: [{ t: 0.42, dir: -1, len: 160 }] }],
  ];
  for (const [x, y, h, seed, opts] of trees) paintTree(m, x, y, h, seed, 1, opts);
  // young trees between them, at the traveller's own scale
  const saplings = [
    [-250, 687, 170, 87, "spray"],
    [-60, 689, 120, 88, "dot"],
    [470, 688, 160, 89, "spray"],
    [548, 690, 110, 90, "dot"],
    [700, 688, 185, 91, "dot"],
    [960, 689, 130, 92, "spray"],
    [1195, 688, 175, 93, "dot"],
    [1440, 689, 140, 94, "spray"],
  ];
  for (const [x, y, h, seed, style] of saplings) paintTree(m, x, y, h, seed, 1, { style });

  // the path itself: bare silk between two worn edges
  m.layer();
  const edge = (y, amp, sd) => {
    const pts = [];
    for (let x = -3200; x <= 3400; x += 90) pts.push([x, y + (noise1(x * 0.011, sd) - 0.5) * amp, 0.7 + 0.6 * noise1(x * 0.02, sd + 1)]);
    return pts;
  };
  m.mist("wet", 44, edge(708, 5, 5), 1);
  m.stroke("dry", INK.zhong, 9, edge(693, 4, 1), 0.5);
  m.stroke("line", INK.nong, 2.4, edge(696, 4, 2), 0.5);
  m.stroke("dry", INK.zhong, 8, edge(722, 5, 3), 0.5);
  m.stroke("line", INK.nong, 2.2, edge(719, 5, 4), 0.5);

  if (m.lod === 2) {
    // ruts, pebbles, grass: only the closest sheet carries these
    m.stroke("line", INK.dan, 1.1, edge(703, 3, 11), 0.5);
    m.stroke("line", INK.dan, 1.0, edge(711, 3, 12), 0.5);
    for (let i = 0; i < 300; i += 1) {
      const x = rnd.range(-470, 1470);
      if (noise1(x * 0.012, 91) < 0.42) continue; // grass grows in drifts, with bare ground between
      const far = rnd.next() < 0.6;
      const y = far ? rnd.range(676, 693) : rnd.range(722, 752);
      const k = 3 + Math.floor(rnd.next() * 4);
      for (let j = 0; j < k; j += 1) {
        m.dab(inkTone(rnd.range(0.55, 0.95)), rnd.range(1.0, 1.7), x + (j - k / 2) * 2.2, y, -Math.PI / 2 + (j - k / 2) * 0.22 + rnd.range(-0.15, 0.15), rnd.range(5, 11), "line");
      }
    }
    for (let i = 0; i < 150; i += 1) {
      const x = rnd.range(-470, 1470);
      const y = rnd.range(697, 717);
      m.dab(INK.dan, rnd.range(1.6, 3), x, y, 0, rnd.range(1.5, 4));
    }
  }

  // water below the bank: long, level, slightly broken lines
  for (let i = 0; i < 30; i += 1) {
    const y = 778 + i * 16 + rnd.range(-3, 3);
    const x0 = rnd.range(-900, 1500);
    const len = rnd.range(220, 700);
    const pts = [];
    for (let k = 0; k <= 5; k += 1) pts.push([x0 + (len * k) / 5, y + Math.sin(k * 1.9 + i) * 2.6, 0.5 + 0.7 * Math.sin((k / 5) * Math.PI)]);
    m.stroke("line", INK.dan, 1.6 + (i > 12 ? 2.6 : 0), pts, 0.7);
  }
}

function program(m) {
  paintFarPeaks(m);
  paintPeak(m);
  paintMist(m);
  paintMiddle(m);
  paintGrove(m);
  paintPath(m);
  paintNearRocks(m);
}

// ------------------------------------------------------------------ inscription
// The title is written on the silk as a colophon: two columns of regular
// script read from the right, a seal, and (the film's one licence) a line of
// Latin letters beneath.
const COLOPHON = { w: 172, h: 126 };

function colophonSprite(stage, scale) {
  const os = scale;
  return sprite(stage, `song/colophon/${os.toFixed(3)}`, COLOPHON.w * os, COLOPHON.h * os, (ctx) => {
    ctx.scale(os, os);
    const vertical = (text, x, y, size, weight, gap) => {
      [...text].forEach((ch, i) => drawText(ctx, ch, x, y + i * (size + gap), { font: font(FONTS.kai, size, weight), align: "center", baseline: "top", fill: "#17130f" }));
    };
    vertical(META.zh, 155, 2, 24.5, 700, 1.2);
    vertical("约公元一〇〇〇年", 125, 4, 11.6, 400, 0.5);
    // seal: red ground, the characters left as paper
    ctx.fillStyle = "#a8281c";
    ctx.fillRect(116, 104, 18, 18);
    drawText(ctx, "鹈", 125, 105.2, { font: font(FONTS.kai, 8, 700), align: "center", baseline: "top", fill: "#f4ead8" });
    drawText(ctx, "鹕", 125, 113, { font: font(FONTS.kai, 8, 700), align: "center", baseline: "top", fill: "#f4ead8" });
    // the Latin lines at 12.5: capitals and digits 27 to 28 px at zoom 1.1 (the 1080p rule is 26),
    // and the English line still starts inside the sprite's left edge
    drawText(ctx, META.en, 108, 105.5, { font: font(FONTS.serif, 12.5, 400, "italic"), align: "right", baseline: "alphabetic", fill: "#17130f" });
    drawText(ctx, META.dateEn, 108, 121.5, { font: font(FONTS.serif, 12.5, 400), align: "right", baseline: "alphabetic", fill: "#17130f" });
  });
}

/** Where the colophons sit: one beside the path for the close view, one in the sky for the whole picture. */
const COLOPHONS = [
  { x: 128, y: 441, scale: 1, sheets: ["path"] },
  { x: 2250, y: -4640, scale: 15, sheets: ["far"] },
];

// ------------------------------------------------------------------ sheets
function sheetSize(stage, sh) {
  const k = sh.px * stage.s;
  return { k, w: Math.round((sh.r.x1 - sh.r.x0) * k), h: Math.round((sh.r.y1 - sh.r.y0) * k) };
}

function bakeSheet(stage, sh) {
  const { k, w, h } = sheetSize(stage, sh);
  return stage.bake(`song/${sh.id}/${k.toFixed(4)}`, w, h, () => {
    const view = new View(k, -sh.r.x0 * k, -sh.r.y0 * k);
    blankSheet(stage);
    const m = new Marks(sh);
    program(m);
    stage.seed(5000 + sh.px * 100);
    withPen(stage, view, (pen) => m.paint(stage, pen));
    // the colophon is written last, over whatever mist it falls on
    for (const c of COLOPHONS) {
      if (!c.sheets.includes(sh.id)) continue;
      const layer = colophonSprite(stage, k * c.scale);
      stage.withView(view, () => stage.image(layer, c.x, c.y, COLOPHON.w * c.scale, COLOPHON.h * c.scale));
    }
  });
}

// ------------------------------------------------------------------ the pelican, in fine line and pale colour
const PELICAN = { white: "#f3ecdc", ochre: "#c59643", pouch: "#d8b872", leg: "#96482a" };

// Below this zoom the pelican is the speck; above it the painted figure. The
// wide hold is at 0.060 to 0.062, so the hand-over comes in the first frames of
// the push-in (and the last of the pull-out), while the speck is still about
// ten pixels across.
const SPECK_ZOOM = 0.07;

function paintPelican(pen, stage, skel) {
  const S = skel.scale;
  const u = S / 21.2;
  pen.reset();
  const draw = (sh) => {
    if (sh.kind === "circle") pen.circle(sh.c[0], sh.c[1], sh.r, 0.12);
    else if (sh.pts.length === 2) pen.line(sh.pts[0][0], sh.pts[0][1], sh.pts[1][0], sh.pts[1][1]);
    else if (sh.closed) pen.polygon(sh.pts);
    else pen.spline(sh.pts, 0.4);
  };
  const line = (color, width) => {
    pen.noWash();
    inkBrush(pen, "line", color, width * u);
  };
  const flat = (color, alpha) => pen.noStroke().wash(color, alpha);

  if (pen.zoom < SPECK_ZOOM) {
    // from far off it is three or four touches of the brush, like the travellers in the original
    const px = 1 / pen.k; // one reference pixel, in world units
    const j = skel.joints;
    flat(PELICAN.white, 250);
    pen.circle(j.body[0], j.body[1], Math.max(S * 1.15, 2.3 * px), 0.3);
    // the head, a touch only a few pixels across: a many-sided polygon stays round where a brush circle squares off
    const hr = Math.max(S * 0.5, 1.5 * px);
    pen.polygon(Array.from({ length: 16 }, (_, i) => [j.head[0] + hr * Math.cos((i / 16) * Math.PI * 2), j.head[1] + hr * Math.sin((i / 16) * Math.PI * 2)]));
    pen.noWash();
    inkBrush(pen, "line", INK.jiao, Math.max(1.6 * u, 1.1 * px));
    pen.circle(j.rear[0], j.rear[1], S, 0.2);
    pen.circle(j.front[0], j.front[1], S, 0.2);
    pen.line(j.neckBase[0], j.neckBase[1], j.head[0], j.head[1]);
    inkBrush(pen, "line", PELICAN.leg, Math.max(1.8 * u, 1.2 * px));
    pen.line(j.billBase[0], j.billBase[1], j.billTip[0], j.billTip[1]);
    return;
  }

  let n = 0;
  for (const sh of skel.shapes) {
    n += 1;
    stage.reseed(6100 + n * 37);
    const far = sh.side === "far";
    switch (sh.tag) {
      case "tire":
        line(INK.jiao, 3.2);
        draw(sh);
        break;
      case "rim":
        line(INK.nong, 0.9);
        draw(sh);
        break;
      case "spoke":
        line(INK.nong, 0.8);
        draw(sh);
        break;
      case "hub":
        flat(INK.jiao, 255);
        draw(sh);
        break;
      case "frame":
        line(INK.jiao, 3.6);
        draw(sh);
        break;
      case "post":
      case "bar":
      case "crank":
        line(INK.jiao, 2.4);
        draw(sh);
        break;
      case "grip":
        line(INK.jiao, 2.6);
        draw(sh);
        break;
      case "chain":
        line(INK.nong, 0.6);
        draw(sh);
        break;
      case "ring":
        line(INK.nong, 0.9);
        draw(sh);
        break;
      case "saddle":
      case "pedal":
        flat(INK.nong, 255);
        draw(sh);
        break;
      case "leg":
        line(far ? "#6f3a26" : PELICAN.leg, 2.4);
        draw(sh);
        break;
      case "foot":
        flat(far ? "#6f3a26" : PELICAN.leg, 240);
        draw(sh);
        break;
      case "tail":
      case "wingtip":
        flat(INK.nong, 235);
        draw(sh);
        break;
      case "body":
      case "neck":
      case "head":
      case "crest":
        flat(PELICAN.white, 246);
        draw(sh);
        break;
      case "wing":
        flat("#ddd3bd", 235);
        draw(sh);
        break;
      case "pouch":
        flat(PELICAN.pouch, 235);
        draw(sh);
        break;
      case "bill":
        flat(PELICAN.ochre, 240);
        draw(sh);
        break;
      case "pupil":
        flat(INK.jiao, 255);
        pen.circle(sh.c[0], sh.c[1], sh.r * 1.1, 0.1);
        break;
      default:
        break;
    }
  }
  // the outline, in one even line: this is a drawing first and a painting second
  stage.reseed(6400);
  line(INK.jiao, 1.15);
  for (const sh of skel.shapes) {
    if (["body", "neck", "head", "bill", "pouch", "wing", "tail", "wingtip", "foot"].includes(sh.tag)) pen.polygon(sh.pts);
    else if (sh.tag === "wingfold") pen.spline(sh.pts, 0.4);
    else if (sh.tag === "eye") pen.circle(sh.c[0], sh.c[1], sh.r, 0.1);
  }
}

// ------------------------------------------------------------------ camera
const CLOSE_H = VIEW_H / ZOOM_IN; // world height seen by the tracking shot
const WIDE = { x: (COMP.x0 + COMP.x1) / 2, y: (COMP.y0 + COMP.y1) / 2, zoom: (VIEW_H / (COMP.y1 - COMP.y0)) };

/** Bar 2: out to the whole painting, a held breath, then in to find the pelican. */
function sceneCamera(u) {
  const px = SPEED * u; // the pelican keeps its pace
  const close = { x: px, y: FOCUS_Y, zoom: ZOOM_IN };
  const out = smootherstep(BAR, BAR + 0.55, u);
  const back = smootherstep(BAR + 1.2, 2 * BAR, u);
  // a slow creep while wide, so the picture never quite stands still
  const wide = { x: WIDE.x, y: WIDE.y, zoom: WIDE.zoom * (1 + 0.03 * smoothstep(BAR + 0.4, BAR + 1.3, u)) };
  const cam = blendCameras(close, wide, out * (1 - back));
  return { dx: cam.x - close.x, dy: cam.y - close.y, zoom: cam.zoom / close.zoom };
}

export const song = {
  ...META,
  camera: sceneCamera,
  // the wall shows a detail at the scale of the tracking shot, where the brushwork is finest
  still: { u: 4.6 },

  init(stage) {
    for (const sh of SHEETS) bakeSheet(stage, sh);
  },

  render(stage, f) {
    const view = f.view;
    const kRef = view.k / f.s; // reference pixels per world unit: how close we are

    // silk
    stage.origin();
    inkGround(stage, view, GROUNDS.silk);

    // ink: stack the sheets that matter at this distance on a blank sheet, then lay it on the silk
    const comp = stage.fb(`song/comp/${f.w}x${f.h}`, f.w, f.h);
    const alphas = [1, smoothstep(0.3, 0.62, kRef), smoothstep(1.0, 2.2, kRef)];
    stage.into(comp, () => {
      blankSheet(stage);
      stage.withView(view, () => {
        SHEETS.forEach((sh, i) => {
          if (alphas[i] <= 0.003) return;
          if (i < 2 && alphas[i + 1] >= 0.999 && i + 1 < SHEETS.length && covers(SHEETS[i + 1].r, view, f.w, f.h)) return;
          const tex = bakeSheet(stage, sh);
          stackSheet(stage, tex, sh.r.x0, sh.r.y0, sh.r.x1 - sh.r.x0, sh.r.y1 - sh.r.y0, alphas[i], i === 0 ? 0 : 0.08);
        });
      });
    });
    stage.origin();
    layInk(stage, comp, 0, 0, f.w, f.h);

    // the traveller
    if (f.pelican.visible) {
      const skel = solveRig({ ...f.pelican, act: { wind: 0.8 } });
      stage.seed(6000);
      withPen(stage, view, (pen) => paintPelican(pen, stage, skel));
    }
  },
};

/** Does world rectangle r cover the whole view? */
function covers(r, view, w, h) {
  const b = view.bounds(w, h);
  return r.x0 <= b.x0 && r.y0 <= b.y0 && r.x1 >= b.x1 && r.y1 >= b.y1;
}
