// The shared ink system for the brush-and-ink sections (3, 4, 5, 6, 9).
//
// What they share lives here:
//
//   ground   xuan paper and silk as world-anchored shaders (fibre, weave, age)
//   tones    the five concentrations of ink, from burnt black to clear water
//   brushes  line, bone, dry, dab, wet: registered at whatever size a stroke
//            needs, so a mark keeps its character from a hairline to a cliff
//   sheets   ink is painted on white "sheets" and multiplied onto the ground,
//            which is how ink behaves: it only ever darkens the paper
//   bleed    a pass that lets wet ink creep along the fibres
//
// What differs stays in each scene: stone rubbing, plain-line drawing,
// landscape texture strokes, ruled architecture and free expressive ink are
// built from these parts with their own rules of brushwork.

import { VERT, FRAG_HEAD, NOISE, rgb } from "./glsl.js";
import { BRUSH_SCALE } from "./pen.js";

// ------------------------------------------------------------------ tones
/**
 * 墨分五色: the five tones of ink, as they dry on white paper.
 * jiao 焦 burnt, nong 浓 thick, zhong 重 heavy, dan 淡 light, qing 清 clear.
 */
export const INK = {
  jiao: "#141312",
  nong: "#282726",
  zhong: "#4a4947",
  dan: "#888682",
  qing: "#bdbbb6",
};
const TONE_ORDER = ["qing", "dan", "zhong", "nong", "jiao"];
const TONE_RGB = TONE_ORDER.map((name) => rgb(INK[name]));

/**
 * Ink colour for a density from 0 (clear water) to 1 (burnt black), as "#rrggbb".
 * Densities are rounded to `steps` levels: p5.brush composites each time the
 * colour changes, so a painting with a handful of tones is drawn in a few
 * passes where one with thousands of slightly different greys takes thousands.
 */
export function inkTone(density, steps = 10) {
  const q = Math.round(Math.max(0, Math.min(1, density)) * steps) / steps;
  const d = q * (TONE_RGB.length - 1);
  const i = Math.min(TONE_RGB.length - 2, Math.floor(d));
  const f = d - i;
  const c = [0, 1, 2].map((ch) => Math.round((TONE_RGB[i][ch] + (TONE_RGB[i + 1][ch] - TONE_RGB[i][ch]) * f) * 255));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// ------------------------------------------------------------------ brushes
/** A brush tip made of separate hairs: dots spread across the stroke, so dragging it leaves streaks. */
function bristles(count, size, jitter) {
  return (m) => {
    m.noStroke();
    m.fill(0);
    for (let i = 0; i < count; i += 1) {
      const y = -42 + (84 * i) / (count - 1) + Math.sin(i * 12.9898) * jitter;
      const x = Math.sin(i * 78.233) * 9;
      m.circle(x, y, size * (0.6 + 0.8 * Math.abs(Math.sin(i * 3.7))));
    }
  };
}

/**
 * The brushes, in the units of p5.brush's built-in set.
 *   px      width in reference pixels of a weight-1 stroke (measured)
 */
const BRUSHES = {
  // 中锋 the upright tip: an even, breathing line for outlines and plain-line drawing
  line: { px: 2.3, params: { type: "marker", weight: 0.6, scatter: 0.12, opacity: 22, spacing: 0.03, pressure: [0.75, 1.1, 0.55], noise: 0.35 } },
  // 骨法 a loaded brush pressed down for the contour of rock: heavy head, quick release
  bone: { px: 6.6, params: { type: "marker", weight: 1.7, scatter: 0.25, opacity: 16, spacing: 0.03, pressure: [1.25, 1.0, 0.5], noise: 0.5 } },
  // 湿笔 a wet, soft stroke that leaves tone rather than line
  wet: { px: 6.6, params: { type: "marker", weight: 1.7, scatter: 0.25, opacity: 2.6, spacing: 0.03, pressure: [0.9, 1.1, 0.8], markerTip: false, noise: 0.5 } },
  // 渴笔 a thirsty brush: the hairs part and the ground shows through (flying white)
  dry: { px: 21, params: { type: "custom", weight: 6, scatter: 0.06, opacity: 120, spacing: 0.25, pressure: [1.1, 1.0, 0.7], tip: bristles(11, 7, 3), rotate: "natural", markerTip: false, noise: 0.5 } },
  // the same, softer and greyer, for building tone in layers
  drysoft: { px: 21, params: { type: "custom", weight: 6, scatter: 0.1, opacity: 70, spacing: 0.12, pressure: [1.1, 1.0, 0.7], tip: bristles(17, 5, 2), rotate: "natural", markerTip: false, noise: 0.6 } },
  // 擦 scumbling with the side of a nearly dry brush: a sandy, broken tone
  scumble: { px: 21, params: { type: "custom", weight: 6, scatter: 0.3, opacity: 200, spacing: 0.5, pressure: [1.2, 0.9, 0.5], tip: bristles(7, 9, 5), rotate: "natural", markerTip: false, noise: 0.7 } },
  // 点叶 a leaf or a firm touch: pressed down and flicked off, solid at any size
  leaf: { px: 6.6, params: { type: "marker", weight: 1.7, scatter: 0.2, opacity: 14, spacing: 0.03, pressure: [1.35, 0.95, 0.25], noise: 0.5 } },
  // 点 / 皴 one touch of the tip: raindrop texture strokes, moss dots, leaves
  dab: { px: 2.9, params: { type: "default", weight: 0.58, scatter: 0.3, sharpness: 0.72, grain: 1.3, opacity: 175, spacing: 0.04, pressure: [1.25, 0.95, 0.4], rotate: "natural", noise: 0.5 } },
};

const registered = new Set();

/**
 * Select an ink brush for the pen at a width given in world units, so a mark
 * keeps its proportions at any zoom and in any cached layer.
 */
export function inkBrush(pen, kind, color, width) {
  const base = BRUSHES[kind];
  if (!base) throw new Error(`Unknown ink brush "${kind}"`);
  const px = Math.max(0.3, width * pen.k);
  // Register the size class nearest to what is needed (a third of an octave
  // apart): tip, scatter and stamp spacing grow together, so a broad stroke is
  // a magnified fine one and costs no more to draw.
  const step = Math.round(Math.log2(px / base.px) * 3);
  const scale = 2 ** (step / 3);
  const name = `ink-${kind}@${step}`;
  if (!registered.has(name)) {
    registered.add(name);
    const q = { ...base.params };
    q.weight *= scale * BRUSH_SCALE;
    q.scatter *= scale * BRUSH_SCALE;
    q.spacing *= scale * BRUSH_SCALE;
    pen.b.add(name, q);
  }
  pen.setPx(name, color, px / (base.px * scale));
}

/**
 * Convenience wrapper bound to one pen:
 *   const ink = inkOn(pen);
 *   ink.stroke("bone", INK.nong, 18, points);     // width in world units
 *   ink.dab("dab", INK.zhong, 9, x, y, angle, length);
 *   ink.wash(points, INK.dan, 110);
 */
export function inkOn(pen) {
  return {
    pen,
    brush(kind, color, width) {
      inkBrush(pen, kind, color, width);
    },
    stroke(kind, color, width, points, curvature = 0.5) {
      inkBrush(pen, kind, color, width);
      if (points.length === 2) pen.line(points[0][0], points[0][1], points[1][0], points[1][1]);
      else pen.spline(points, curvature);
    },
    line(kind, color, width, x1, y1, x2, y2) {
      inkBrush(pen, kind, color, width);
      pen.line(x1, y1, x2, y2);
    },
    /** One touch of the brush: from (x, y) along `angle` for `length` world units. */
    dab(kind, color, width, x, y, angle, length) {
      inkBrush(pen, kind, color, width);
      pen.line(x, y, x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    },
    /** A graded wash (watercolour fill) inside a polygon. */
    wash(points, color, alpha = 120, opts = {}) {
      pen.noStroke().fill(color, alpha, { bleed: opts.bleed ?? 0.12, texture: opts.texture ?? 0.35, border: opts.border ?? 0.2, scatter: opts.scatter ?? true });
      pen.polygon(points);
      pen.noFill();
    },
    /** Flat tone inside a polygon (no watercolour behaviour). */
    flat(points, color, alpha = 255) {
      pen.noStroke().wash(color, alpha);
      pen.polygon(points);
      pen.noWash();
    },
  };
}

// ------------------------------------------------------------------ grounds
const GROUND_FRAG = `${FRAG_HEAD}
uniform vec2 uOrigin;
uniform vec2 uSize;
uniform float uPxPerUnit;
uniform vec3 uBase;
uniform vec3 uShade;
uniform vec3 uStainColor;
uniform float uMottle;
uniform float uGrain;
uniform float uFiber;
uniform float uWeave;       // strength of the woven thread pattern (silk)
uniform float uThread;      // thread spacing in world units
uniform float uStain;       // large tide marks and darkening with age
uniform float uSeed;
${NOISE}
float lod(float cycle) { return smoothstep(1.2, 3.0, cycle * uPxPerUnit); }
void main() {
  vec2 w = uOrigin + vTexCoord * uSize + uSeed * 57.3;
  float mottle = fbm(w / 230.0) * 0.6 + fbm(w / 52.0 + 5.7) * 0.4;
  vec3 col = mix(uBase, uShade, (mottle - 0.25) * uMottle);

  // tide marks: broad stains with a slightly darker rim
  float s = fbm(w / 900.0 + 31.0);
  float stain = smoothstep(0.52, 0.72, s);
  float rim = smoothstep(0.50, 0.56, s) * (1.0 - smoothstep(0.56, 0.66, s));
  col = mix(col, uStainColor, (stain * 0.55 + rim * 0.35) * uStain);
  // slow darkening in long vertical streaks, as on a hanging scroll
  col *= 1.0 - uStain * 0.10 * smoothstep(0.55, 0.85, fbm(vec2(w.x / 420.0, w.y / 2600.0) + 9.0));

  // weave: warp and weft threads, a little uneven
  float wob = (vnoise(w / 37.0) - 0.5) * 0.35;
  float tx = sin((w.x / uThread + wob) * 6.2831853);
  float ty = sin((w.y / uThread - wob) * 6.2831853);
  float weave = (tx * 0.5 + ty * 0.5) * (0.6 + 0.4 * vnoise(w / 9.0));
  col *= 1.0 + weave * uWeave * lod(uThread);

  // fibres
  float f = 0.0;
  vec2 q1 = rot2(0.35) * w * vec2(0.11, 1.5);
  vec2 q2 = rot2(-0.7) * w * vec2(0.1, 1.3);
  f += smoothstep(0.80, 0.92, vnoise(q1 + uSeed));
  f += smoothstep(0.82, 0.94, vnoise(q2 + uSeed * 3.0));
  col = mix(col, uShade * 0.9, clamp(f, 0.0, 1.0) * uFiber * lod(0.7));

  float grain = (vnoise(w * 0.62) - 0.5) * lod(1.6) + (vnoise(w * 1.9 + 3.1) - 0.5) * 0.6 * lod(0.53);
  col *= 1.0 + grain * uGrain;
  fragColor = vec4(col, 1.0);
}`;

export const GROUNDS = {
  /** Raw xuan paper: warm white, long fibres, takes ink greedily. */
  xuan: { base: "#efe8d8", shade: "#ddd2ba", stainColor: "#cdbd9b", mottle: 0.5, grain: 0.05, fiber: 0.2, weave: 0, thread: 1.2, stain: 0.15, seed: 2 },
  /** Old silk: tea-brown, a fine weave, darkened and tide-marked by a thousand years. */
  silk: { base: "#c4a878", shade: "#a98c5c", stainColor: "#8c6f44", mottle: 0.55, grain: 0.035, fiber: 0.04, weave: 0.06, thread: 1.15, stain: 0.34, seed: 5 },
};

/** Fill the current target with an ink ground as seen through `view`. */
export function inkGround(stage, view, preset = GROUNDS.xuan) {
  const sh = stage.shader("kit/ink-ground", VERT, GROUND_FRAG);
  const b = view.bounds(stage.cur.w, stage.cur.h);
  stage.withView(view, () => {
    stage.shaderRect(
      sh,
      {
        uOrigin: [b.x0, b.y0],
        uSize: [b.x1 - b.x0, b.y1 - b.y0],
        uPxPerUnit: view.k,
        uBase: rgb(preset.base),
        uShade: rgb(preset.shade),
        uStainColor: rgb(preset.stainColor),
        uMottle: preset.mottle,
        uGrain: preset.grain,
        uFiber: preset.fiber,
        uWeave: preset.weave,
        uThread: preset.thread,
        uStain: preset.stain,
        uSeed: preset.seed,
      },
      b.x0,
      b.y0,
      b.x1 - b.x0,
      b.y1 - b.y0,
    );
  });
}

// ------------------------------------------------------------------ sheets
const SHEET_FRAG = `${FRAG_HEAD}
uniform sampler2D uTex;
uniform float uAlpha;
uniform float uFeather;   // fraction of the sheet's size over which its edge fades out
void main() {
  vec4 t = texture(uTex, vTexCoord);
  vec2 d = min(vTexCoord, 1.0 - vTexCoord);
  float edge = uFeather > 0.0 ? smoothstep(0.0, uFeather, min(d.x, d.y)) : 1.0;
  float a = uAlpha * edge;
  fragColor = vec4(t.rgb * a, a);
}`;

/**
 * Start an ink sheet: clear the current target to blank (white) paper.
 * Paint ink onto it, then lay it over a ground with layInk().
 */
export function blankSheet(stage) {
  stage.p.background(255);
}

/**
 * Draw an ink sheet into the current space with ordinary blending, its edge
 * feathered. Use it to stack sheets of different detail on a blank sheet.
 */
export function stackSheet(stage, sheet, x, y, w, h, alpha = 1, feather = 0.04) {
  if (alpha <= 0.003) return;
  const sh = stage.shader("kit/ink-sheet", VERT, SHEET_FRAG);
  stage.shaderRect(sh, { uTex: sheet, uAlpha: alpha, uFeather: feather }, x, y, w, h);
}

/** Multiply an ink sheet onto whatever is already drawn: ink darkens, blank paper leaves it untouched. */
export function layInk(stage, sheet, x, y, w, h, alpha = 1) {
  const { p } = stage;
  stage.blend(p.MULTIPLY, () => {
    stage.image(sheet, x, y, w, h, alpha);
  });
}

// ------------------------------------------------------------------ bleed
const BLEED_FRAG = `${FRAG_HEAD}
uniform sampler2D uTex;
uniform vec2 uTexel;       // one pixel of the sheet, in texture coordinates
uniform vec2 uOrigin;
uniform vec2 uSize;
uniform float uReach;      // how far ink creeps, in pixels
uniform float uAmount;     // 0..1
${NOISE}
void main() {
  vec2 w = uOrigin + vTexCoord * uSize;
  vec3 here = texture(uTex, vTexCoord).rgb;
  // ink creeps unevenly: further along fibres, and in fingers
  float finger = 0.35 + 1.3 * fbm(w / 6.0 + 3.0);
  float ang = fbm(w / 40.0 + 11.0) * 6.2831853;
  vec2 along = vec2(cos(ang), sin(ang));
  vec3 darkest = here;
  vec3 sum = here;
  float n = 1.0;
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 0.5236;
    vec2 dir = vec2(cos(a), sin(a));
    float stretch = 1.0 + 0.9 * abs(dot(dir, along));
    for (int j = 1; j <= 3; j++) {
      vec2 off = dir * uReach * finger * stretch * (float(j) / 3.0) * uTexel;
      vec3 s = texture(uTex, vTexCoord + off).rgb;
      float wgt = 1.0 - float(j) / 4.0;
      sum += s * wgt;
      n += wgt;
      darkest = min(darkest, mix(vec3(1.0), s, wgt * 0.8));
    }
  }
  vec3 soft = sum / n;
  // spread, but never lighten what was painted
  vec3 bled = min(here, mix(soft, darkest, 0.45));
  fragColor = vec4(mix(here, bled, uAmount), 1.0);
}`;

/**
 * Let the ink on a sheet bleed. Draws `src` (a framebuffer holding an ink
 * sheet) into the current target, which must be a different buffer of the
 * same size. world = { x0, y0, x1, y1 } is the region the sheet covers.
 */
export function bleedSheet(stage, src, world, { reach = 6, amount = 0.8 } = {}) {
  const sh = stage.shader("kit/ink-bleed", VERT, BLEED_FRAG);
  stage.origin();
  stage.shaderRect(
    sh,
    { uTex: src, uTexel: [1 / src.width, 1 / src.height], uOrigin: [world.x0, world.y0], uSize: [world.x1 - world.x0, world.y1 - world.y0], uReach: reach, uAmount: amount },
    0,
    0,
    stage.cur.w,
    stage.cur.h,
  );
}
