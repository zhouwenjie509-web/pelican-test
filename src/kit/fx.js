// Compositing helpers and finishing passes shared by the scenes.

import { VERT, FRAG_HEAD, NOISE, rgb } from "./glsl.js";

const MASK_FRAG = `${FRAG_HEAD}
uniform sampler2D uTex;
uniform vec3 uColor;
uniform float uAlpha;
uniform float uUseLuma;   // 1: coverage = brightness of the texture, 0: its alpha
uniform float uInvert;
void main() {
  vec4 t = texture(uTex, vTexCoord);
  float m = mix(t.a, dot(t.rgb, vec3(0.299, 0.587, 0.114)), uUseLuma);
  m = mix(m, 1.0 - m, uInvert) * uAlpha;
  fragColor = vec4(uColor * m, m);
}`;

/**
 * Draw a texture as a stencil: its coverage (alpha, or brightness with
 * { luma: true }) is filled with one colour. Useful for light pigment on a
 * dark ground, where multiplying cannot work.
 */
export function drawMask(stage, tex, x, y, w, h, color, { alpha = 1, luma = false, invert = false } = {}) {
  const sh = stage.shader("kit/mask", VERT, MASK_FRAG);
  stage.shaderRect(
    sh,
    { uTex: tex.img || tex, uColor: typeof color === "string" ? rgb(color) : color, uAlpha: alpha, uUseLuma: luma ? 1 : 0, uInvert: invert ? 1 : 0 },
    x,
    y,
    w,
    h,
  );
}

const FINISH_FRAG = `${FRAG_HEAD}
uniform vec2 uRes;
uniform float uVignette;
uniform vec3 uVignetteColor;
uniform float uGrain;
uniform float uSeed;
${NOISE}
void main() {
  vec2 uv = vTexCoord;
  vec2 c = uv - 0.5;
  c.x *= uRes.x / uRes.y;
  float d = dot(c, c);
  float v = smoothstep(0.18, 0.95, d) * uVignette;
  float g = (hash21(floor(uv * uRes) + uSeed * 17.0) - 0.5) * uGrain;
  // premultiplied: darken towards the vignette colour, then add signed grain
  fragColor = vec4(uVignetteColor * v, v);
  fragColor.rgb += vec3(g) * 0.0;
}`;

/**
 * Darken the corners of the current target. strength 0..1.
 * (Drawn as a translucent overlay, so it works on any content.)
 */
export function vignette(stage, strength = 0.3, color = "#1a120a") {
  const sh = stage.shader("kit/finish", VERT, FINISH_FRAG);
  stage.origin();
  stage.shaderRect(sh, { uRes: [stage.cur.w, stage.cur.h], uVignette: strength, uVignetteColor: rgb(color), uGrain: 0, uSeed: 0 }, 0, 0, stage.cur.w, stage.cur.h);
}

const ROUGH_FRAG = `${FRAG_HEAD}
uniform sampler2D uTex;      // soft-edged coverage mask (alpha)
uniform vec2 uOrigin;        // world position of the rectangle
uniform vec2 uSize;
uniform vec3 uColor;
uniform vec3 uColor2;        // second tone the pigment drifts towards
uniform float uAlpha;
uniform float uRough;        // how far the edge wanders, 0..1
uniform float uScale;        // world units per noise cell
uniform float uMottle;       // unevenness of the paint film, 0..1
${NOISE}
void main() {
  vec2 w = uOrigin + vTexCoord * uSize;
  float m = texture(uTex, vTexCoord).a;
  float n = fbm(w / uScale);
  float n2 = fbm(w / (uScale * 4.0) + 17.0);
  // the edge wanders in and out with the noise: a brushed, slightly broken outline
  float a = smoothstep(0.42, 0.58, m + (n - 0.5) * uRough);
  // thin and thick passages of paint
  float film = 1.0 - uMottle * smoothstep(0.35, 0.75, n2) * 0.6 - uMottle * (1.0 - n) * 0.25;
  a *= clamp(film, 0.0, 1.0) * uAlpha;
  vec3 col = mix(uColor, uColor2, smoothstep(0.3, 0.8, n2));
  fragColor = vec4(col * a, a);
}`;

/**
 * Paint a coverage mask (for example lettering drawn on a 2D layer with a
 * slight blur) as hand-applied pigment: wandering edges, uneven film, two
 * tones. Call inside stage.withView; (x, y, w, h) are world units.
 */
export function drawPigmentMask(stage, tex, x, y, w, h, { color, color2, alpha = 1, rough = 0.5, scale = 3, mottle = 0.6 } = {}) {
  const sh = stage.shader("kit/rough-mask", VERT, ROUGH_FRAG);
  stage.shaderRect(
    sh,
    { uTex: tex.img || tex, uOrigin: [x, y], uSize: [w, h], uColor: rgb(color), uColor2: rgb(color2 || color), uAlpha: alpha, uRough: rough, uScale: scale, uMottle: mottle },
    x,
    y,
    w,
    h,
  );
}
