// Procedural paper. The texture is anchored to world coordinates, so it scrolls
// and zooms with the camera instead of sitting on the lens.
//
// The same shader covers the intro page, the gallery wall and (with other
// colours and strengths) any scene that needs a paper-like ground.

import { VERT, FRAG_HEAD, NOISE, rgb } from "./glsl.js";

const FRAG = `${FRAG_HEAD}
uniform vec2 uOrigin;      // world position of the rectangle's top-left corner
uniform vec2 uSize;        // world size of the rectangle
uniform float uPxPerUnit;  // target pixels per world unit, for level of detail
uniform vec3 uBase;
uniform vec3 uShade;
uniform float uMottle;
uniform float uGrain;
uniform float uFiber;
uniform float uSeed;
${NOISE}

// Amplitude of a pattern whose finest cycle is 'cycle' world units wide:
// fades out before it gets smaller than about two pixels, so nothing shimmers.
float lod(float cycle) {
  return smoothstep(1.2, 3.0, cycle * uPxPerUnit);
}

float fibers(vec2 w, float angle, vec2 stretch, float cut) {
  vec2 q = rot2(angle) * w * stretch;
  float n = vnoise(q + uSeed * 7.31);
  return smoothstep(cut, cut + 0.12, n);
}

void main() {
  vec2 w = uOrigin + vTexCoord * uSize + uSeed * 91.7;

  // slow tonal drift across the sheet
  float mottle = fbm(w / 210.0) * 0.65 + fbm(w / 47.0 + 5.7) * 0.35;
  // tooth of the paper
  float grain = (vnoise(w * 0.62) - 0.5) * lod(1.6) + (vnoise(w * 1.9 + 3.1) - 0.5) * 0.6 * lod(0.53);
  // sparse long fibres at three slants
  float f = 0.0;
  f += fibers(w, 0.35, vec2(0.11, 1.5), 0.80);
  f += fibers(w, -0.6, vec2(0.1, 1.3), 0.82);
  f += fibers(w, 1.3, vec2(0.13, 1.7), 0.84) * 0.7;
  f *= lod(0.7);

  vec3 col = mix(uBase, uShade, (mottle - 0.5) * uMottle + 0.5 * uMottle);
  col *= 1.0 + grain * uGrain;
  col = mix(col, uShade * 0.92, clamp(f, 0.0, 1.0) * uFiber);
  fragColor = vec4(col, 1.0);
}`;

export const PAPERS = {
  /** Warm ivory book page and gallery wall. */
  wall: { base: "#ede5d3", shade: "#d8ccb3", mottle: 0.5, grain: 0.05, fiber: 0.09, seed: 1 },
};

/**
 * Fill the world rectangle (x, y, w, h) with paper. Must be called while the
 * given view is active on the stage (inside stage.withView), or pass pixel
 * coordinates with View identity.
 */
export function drawPaper(stage, view, x, y, w, h, preset = PAPERS.wall) {
  const sh = stage.shader("kit/paper", VERT, FRAG);
  stage.shaderRect(
    sh,
    {
      uOrigin: [x, y],
      uSize: [w, h],
      uPxPerUnit: view.k,
      uBase: rgb(preset.base),
      uShade: rgb(preset.shade),
      uMottle: preset.mottle,
      uGrain: preset.grain,
      uFiber: preset.fiber,
      uSeed: preset.seed,
    },
    x,
    y,
    w,
    h,
  );
}

/** Paper covering the whole current target for a given view. */
export function fillPaper(stage, view, preset = PAPERS.wall) {
  const b = view.bounds(stage.cur.w, stage.cur.h);
  stage.withView(view, () => {
    drawPaper(stage, view, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, preset);
  });
}
