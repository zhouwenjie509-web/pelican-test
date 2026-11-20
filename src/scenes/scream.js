// Section 13. Edvard Munch, The Scream (1893), rebuilt as a long frieze seen
// along the bridge.
//
// Tempera and crayon on unprimed board: a sky of long wavering bands, a
// blue-black fjord with a looping shore, a railing and raking planks. Two
// figures far behind; in the foreground a passer-by with his back to us.
// The pelican rings its bell behind him on the strong beat; he turns into
// the figure everyone knows, and the landscape jolts with him.
//
// Layers, back to front:
//   1. LAND_FRAG (per frame): sky, hills, fjord, shore and walkway as
//      parallel chalky strokes on bare board. The waviness and the jolt
//      (a front that lifts and heats the bands themselves) come from u.
//   2. railing, ships and the two distant figures (baked brushwork)
//   3. the title, crayon lettering on the planks (crayon shader over a mask)
//   4. the pelican (per frame, a handful of brush passes grouped by colour)
//   5. the passer-by: three baked drawings: calm (back turned), one held
//      jerk (shoulders up, head half round, 3 frames), and the pose.

import { sectionMeta } from "./sections.js";
import { View } from "../kit/stage.js";
import { VERT, FRAG_HEAD, NOISE, rgb } from "../kit/glsl.js";
import { wobble, hash } from "../kit/rng.js";
import { withPen, defineBrush } from "../kit/pen.js";
import { sprite, drawText, font } from "../kit/text.js";
import { solveRig } from "../rig/rig.js";
import { ROAD_Y } from "../main/layout.js";
import { smoothstep, lerp } from "../beat/ease.js";

const META = sectionMeta(13);

// ------------------------------------------------------------------ timing
const T_BELL = 2.95; // the bell on the handlebar
const T_TURN = 3.0; // he starts and turns
const JERK_LEN = 0.045; // the held in-between: shoulders up, head half round (3 frames at 60 fps)

// ------------------------------------------------------------------ places
const WORLD = { x0: -90, y0: 405, x1: 1090, y1: 815 }; // painted by the shader
const RAIL = { x0: -90, y0: 572, x1: 1090, y1: 712 }; // baked railing, ships, figures
const FIG = { x0: 572, y0: 638, x1: 716, y1: 832 }; // the passer-by's bake
const HEAD = [640, 687]; // centre of his head: top at y = 660, a bust cut by the bottom edge
const BAKE_PX = 3.3;

const C = {
  board: "#b39a78",
  coat: "#1a1e2e",
  coatBlue: "#2f4f7f",
  coatDark: "#0d0f17",
  skin: "#cfc394",
  skinShade: "#8e9a74",
  feature: "#161a26",
  mouth: "#2b2027",
  railDark: "#2a1914",
  railBrown: "#6b3a22",
  railOrange: "#c96f34",
  railBlue: "#2f4f7f",
  bird: "#e9e3cf",
  birdBlue: "#8fa3ad",
  birdGreen: "#a3b28c",
  bill: "#e2a43e",
  leg: "#c07a3a",
  contour: "#1d2a44",
  bike: "#1b2236",
  flick: "#f7ebb0",
  title: "#f0dc8a",
  title2: "#e8c060",
};

// ------------------------------------------------------------------ the land, in strokes
const LAND_FRAG = `${FRAG_HEAD}
uniform vec2 uOrigin;
uniform vec2 uSize;
uniform float uPx;      // target pixels per world unit
uniform float uT;       // u
uniform float uWave;    // seconds since the turn (negative before)
uniform vec2 uHead;     // where the wave starts
uniform vec2 uShake;    // the walkway's shudder, world units
${NOISE}

const vec3 BOARD = vec3(0.702, 0.604, 0.471);

// six broad bands, top to bottom
const vec3 SKY[6] = vec3[6](
  vec3(0.745, 0.212, 0.157),  // deep red
  vec3(0.890, 0.430, 0.190),  // orange
  vec3(0.910, 0.690, 0.290),  // yellow
  vec3(0.835, 0.275, 0.165),  // blood orange
  vec3(0.561, 0.639, 0.678),  // the pale blue-grey streak
  vec3(0.900, 0.600, 0.250)   // orange-yellow at the horizon
);
const vec3 WATER[4] = vec3[4](
  vec3(0.090, 0.120, 0.215),  // blue-black
  vec3(0.114, 0.165, 0.267),
  vec3(0.165, 0.270, 0.440),  // blue
  vec3(0.130, 0.200, 0.340)
);
const vec3 HILL[5] = vec3[5](
  vec3(0.400, 0.470, 0.290),  // the lit crest
  vec3(0.310, 0.416, 0.290),
  vec3(0.235, 0.329, 0.251),
  vec3(0.170, 0.260, 0.330),
  vec3(0.114, 0.165, 0.267)
);
const vec3 SHORE[3] = vec3[3](
  vec3(0.850, 0.700, 0.400),  // pale ochre
  vec3(0.790, 0.630, 0.360),
  vec3(0.900, 0.760, 0.450)
);
const vec3 BANK[4] = vec3[4](
  vec3(0.310, 0.416, 0.290),
  vec3(0.255, 0.345, 0.270),
  vec3(0.200, 0.300, 0.400),
  vec3(0.380, 0.400, 0.240)
);
const vec3 PLANK[6] = vec3[6](
  vec3(0.541, 0.290, 0.180),  // red-brown
  vec3(0.788, 0.435, 0.204),  // orange
  vec3(0.431, 0.227, 0.141),  // dark brown
  vec3(0.659, 0.353, 0.188),
  vec3(0.227, 0.310, 0.478),  // blue shadow
  vec3(0.847, 0.541, 0.271)
);

// One layer of parallel strokes. v runs across the strokes, a along them,
// both in world units. Returns (coverage, hash, hash2, row).
vec4 strokes(float v, float a, float sp, float L, float seed) {
  float r = floor(v / sp);
  float fr = v / sp - r;
  float hr = hash21(vec2(r, seed));
  float len = L * (0.55 + 0.9 * hr);
  float aa = a + hr * 977.0;
  float s = floor(aa / len);
  float t = aa / len - s;
  float h = hash21(vec2(r * 1.37 + seed, s + 0.5));
  float h2 = hash21(vec2(s * 3.1 - seed, r + 0.3));
  float t0 = 0.02 + 0.06 * h2;
  float t1 = 0.90 + 0.08 * h;
  float body = smoothstep(t0, t0 + 0.05, t) * (1.0 - smoothstep(t1 - 0.05, t1, t));
  float c = 0.5 + (h - 0.5) * 0.3 + (vnoise(vec2(aa * 0.02, r * 3.7)) - 0.5) * 0.35;
  float hw = (0.27 + 0.2 * h2) * (0.35 + 0.65 * body);
  float d = abs(fr - c);
  float e = 0.75 / max(sp * uPx, 0.5);
  float cov = (1.0 - smoothstep(hw - e, hw + e, d)) * step(0.02, body);
  // dry chalk: the stroke breaks up along its length, more at its edges
  float g = vnoise(vec2(aa * 0.22, v * 2.6 / sp * 0.9)) * 0.6 + vnoise(vec2(aa * 0.9, v * 1.3)) * 0.4;
  float dry = smoothstep(0.24, 0.5, g + 0.32 * (1.0 - d / max(hw, 0.01)) - 0.12 * (1.0 - body));
  cov *= mix(1.0, dry, smoothstep(2.0, 5.0, sp * uPx));
  return vec4(cov, h, h2, r);
}

float hills(float x) {
  return 54.0 * exp(-pow((x - 905.0) / 115.0, 2.0))
       + 36.0 * exp(-pow((x - 1065.0) / 75.0, 2.0))
       + 22.0 * exp(-pow((x - 770.0) / 55.0, 2.0))
       + 18.0 * exp(-pow((x + 40.0) / 70.0, 2.0))
       + 9.0 * exp(-pow((x - 260.0) / 80.0, 2.0));
}

void main() {
  vec2 w = uOrigin + vTexCoord * uSize;
  float px = uPx;

  // ---- the jolt: a front leaves his head at 400 units a second. It does not
  // draw anything of its own: it lifts the bands of the land as it passes
  // (a crest, then a smaller trough) and heats their colour.
  float dist = length((w - uHead) * vec2(1.0, 1.25));
  float tf = uWave - dist / 400.0;                 // seconds since the front passed here
  float on = step(0.0, uWave);
  float post = step(0.0, tf) * on;
  float rise = smoothstep(-0.04, 0.3, tf) * on;
  float gain = 1.0 + rise * (0.55 + 1.6 * exp(-max(tf, 0.0) / 0.6));
  float fade = on * smoothstep(10.0, 60.0, dist) * exp(-max(uWave - 0.4, 0.0) / 1.2);
  float crest = exp(-pow(tf / 0.09, 2.0)) - 0.55 * exp(-pow((tf - 0.2) / 0.08, 2.0)) + 0.3 * exp(-pow((tf - 0.42) / 0.08, 2.0));
  float heat = fade * exp(-pow((tf - 0.02) / 0.13, 2.0));
  float red = post * smoothstep(0.0, 0.5, tf) * 0.3;
  // the bands are pushed away from his head (upwards above him)
  float ry = (w.y - uHead.y) / max(dist, 1.0);
  float jolt = -fade * crest * 16.0 * (0.55 + 0.45 * abs(ry)) * sign(ry + 1e-4);
  vec3 hotT = vec3(1.0);

  vec3 col = BOARD * (0.93 + 0.10 * vnoise(vec2(w.x * 0.3, w.y * 2.4)) + 0.06 * (vnoise(w * 0.07) - 0.5));
  vec3 paint;
  vec4 A;
  vec4 B;
  float sp;
  vec3 colA;
  vec3 colB;
  vec3 mean;

  float horizon = 556.0 + 3.0 * sin(w.x / 140.0);
  float H = hills(w.x);
  float hillTop = horizon - H;
  // one strong S-curving shoreline
  float shoreY = 619.0 + (19.0 + 4.0 * (gain - 1.0)) * sin(w.x / 120.0 - 2.0 + uT * 0.06) + 5.0 * sin(w.x / 310.0 + 1.0) + jolt * 0.7;
  float shoreW = 11.0 + 3.0 * sin(w.x / 90.0 + 1.3);

  if (w.y >= 700.0) {
    // ---- the walkway: straight raking strokes, plank seams every few rows
    // the planks fan: shallow at the back edge, steeper towards us
    vec2 q = w - uShake;
    float ty = q.y - 700.0;
    const float a0 = 0.31;
    const float a1 = 0.0016;
    float ang = a0 + a1 * ty;
    float F = (log(sin(ang)) - log(sin(a0))) / a1;   // x drift of one plank line down to this row
    float v = -(q.x - F) * 0.36;                     // a fixed scale, so the lines stay straight-ish
    float a = q.x * cos(ang) + ty * sin(ang);
    sp = 3.1;
    A = strokes(v, a, sp, 170.0, 11.0);
    B = strokes(v + sp * 0.5, a, sp, 140.0, 23.0);
    float plank = floor(v / (sp * 4.0));
    float ph = hash21(vec2(plank, 5.0));
    int iA = int(mod(floor(ph * 3.0 + A.y * 2.2), 6.0));
    int iB = int(mod(floor(ph * 3.0 + B.y * 2.6 + 1.0), 6.0));
    colA = PLANK[iA];
    colB = PLANK[iB];
    if (A.y > 0.86) colA = PLANK[4];
    if (mod(A.w, 4.0) < 0.5) colA = PLANK[2] * 0.5;    // the seam between planks
    if (mod(B.w, 4.0) < 0.5) colB = PLANK[2] * 0.7;
    mean = mix(PLANK[0], PLANK[1], 0.4);
    // the corner where the title is lettered: darker, browner planks
    float sig = smoothstep(18.0, 0.0, max(max(40.0 - w.x, w.x - 330.0), max(726.0 - w.y, 0.0)));
    colA = mix(colA, colA * vec3(0.62, 0.5, 0.5), sig * 0.85);
    colB = mix(colB, colB * vec3(0.62, 0.5, 0.5), sig * 0.85);
  } else if (w.y < min(hillTop, horizon)) {
    // ---- sky: six broad wavering bands of long strokes
    float und = 6.5 * gain * (0.6 * sin(w.x / 150.0 + 0.45 * uT + w.y / 70.0)
                            + 0.22 * sin(w.x / 61.0 - 0.25 * uT + w.y / 31.0)
                            + 1.0 * (fbm(vec2(w.x / 260.0 + uT * 0.03, w.y / 90.0)) - 0.5));
    // the long sweep of the bands: they rise and fall across the picture
    float sweep = 11.0 * sin(w.x / 270.0 + 0.8 + 0.07 * uT) + 5.0 * sin(w.x / 125.0 + 2.1 - 0.1 * uT);
    sweep *= smoothstep(min(hillTop, horizon), min(hillTop, horizon) - 30.0, w.y) * 0.6 + 0.4;
    float v = w.y + und + sweep + jolt;
    float a = w.x;
    sp = 3.6;
    A = strokes(v, a, sp, 400.0, 3.0);
    B = strokes(v + sp * 0.5, a, sp, 330.0, 7.0);
    float bandPos = (w.y - 433.0 + und * 1.8 + sweep + 6.0 * sin(w.x / 240.0 + 0.7 + uT * 0.1) + jolt) / 21.0;
    int bA = int(clamp(floor(bandPos + (A.y - 0.5) * 0.4), 0.0, 5.0));
    int bB = int(clamp(floor(bandPos + (B.y - 0.5) * 0.5), 0.0, 5.0));
    colA = SKY[bA] * (0.95 + 0.1 * A.z);
    colB = SKY[bB] * (0.93 + 0.1 * B.z);
    mean = SKY[int(clamp(floor(bandPos), 0.0, 5.0))];
    colA = mix(colA, vec3(colA.r * 1.05, colA.g * 0.62, colA.b * 0.62), red);
    colB = mix(colB, vec3(colB.r * 1.05, colB.g * 0.62, colB.b * 0.62), red);
    hotT = vec3(1.18, 1.12, 0.62);
  } else if (H > 1.0 && w.y < horizon + 14.0 * smoothstep(1.0, 12.0, H)) {
    // ---- the hills on the far shore: long strokes follow their outline
    float v = w.y - hillTop + 2.0 * sin(w.x / 60.0) + jolt * 0.6;
    float a = w.x;
    sp = 2.8;
    A = strokes(v, a, sp, 180.0, 13.0);
    B = strokes(v + sp * 0.5, a, sp, 150.0, 17.0);
    float depth = clamp((w.y - hillTop) / max(H + 12.0, 1.0), 0.0, 1.0);
    int hA = int(clamp(floor(depth * 4.6 + (A.y - 0.5) * 0.7), 0.0, 4.0));
    int hB = int(clamp(floor(depth * 4.6 + (B.y - 0.5) * 0.8), 0.0, 4.0));
    colA = HILL[hA];
    colB = HILL[hB];
    mean = HILL[2];
    hotT = vec3(1.25, 1.45, 1.0);
  } else if (w.y < shoreY) {
    // ---- the fjord: a dark mass of thinner swirling strokes
    float gw = 1.0 + (gain - 1.0) * 0.45;
    float und = gw * (5.0 * sin(w.x / 90.0 + w.y / 24.0 + uT * 0.35)
                      + 7.0 * (fbm(vec2(w.x / 200.0, w.y / 55.0 + uT * 0.02)) - 0.5)
                      + 4.0 * sin(w.x / 170.0 - uT * 0.2));
    // near the shore the strokes swing round with it
    float follow = smoothstep(horizon + 10.0, shoreY - 2.0, w.y);
    float v = mix(w.y + und, w.y - shoreY + 619.0 + und * 0.4, follow) + jolt;
    float a = w.x;
    sp = 2.2;
    A = strokes(v, a, sp, 240.0, 29.0);
    B = strokes(v + sp * 0.5, a, sp, 200.0, 31.0);
    float wb = v / 11.0 + 0.6 * sin(w.x / 140.0);
    colA = WATER[int(mod(floor(wb + (A.y - 0.5) * 0.5), 4.0))];
    colB = WATER[int(mod(floor(wb + (B.y - 0.5) * 0.5 + 2.0), 4.0))];
    // the water keeps its own colours right up to the far shore
    hotT = vec3(1.25, 1.5, 1.85);
    colA = mix(colA, colA * vec3(1.25, 0.85, 1.05), red);
    mean = WATER[1];
  } else if (w.y < shoreY + shoreW) {
    // ---- the pale ochre shoreline, one long loop
    float v = w.y - shoreY;
    float a = w.x;
    sp = 2.4;
    A = strokes(v, a, sp, 260.0, 37.0);
    B = strokes(v + sp * 0.5, a, sp, 220.0, 41.0);
    colA = SHORE[int(mod(floor(A.y * 3.0), 3.0))];
    colB = SHORE[int(mod(floor(B.y * 3.0 + 1.0), 3.0))];
    mean = SHORE[0];
    hotT = vec3(1.15, 1.1, 0.8);
  } else {
    // ---- the near bank under the walkway
    float k = (w.y - shoreY) / max(700.0 - shoreY, 1.0);
    float v = w.y - (shoreY - 619.0) * (1.0 - k) + 2.0 * sin(w.x / 80.0 + w.y / 30.0);
    float a = w.x;
    sp = 2.7;
    A = strokes(v, a, sp, 300.0, 43.0);
    B = strokes(v + sp * 0.5, a, sp, 250.0, 47.0);
    float bb = (v - 619.0) / 14.0 + 0.5 * sin(w.x / 200.0);
    colA = BANK[int(mod(floor(bb + (A.y - 0.5) * 0.6), 4.0))];
    colB = BANK[int(mod(floor(bb + (B.y - 0.5) * 0.6 + 1.0), 4.0))];
    mean = BANK[0];
    hotT = vec3(1.2, 1.4, 1.2);
  }

  // as the front passes, the strokes it lifts flare up in colour
  colA = mix(colA, min(colA * hotT, vec3(1.0)), heat);
  colB = mix(colB, min(colB * hotT, vec3(1.0)), heat);
  paint = mix(col, colB, B.x * 0.9);
  paint = mix(paint, colA, A.x * 0.95);
  // detail too fine for the target: settle to the mean colour
  float lod = smoothstep(2.2, 4.0, sp * px);
  paint = mix(mix(col, mean, 0.8), paint, lod);
  fragColor = vec4(paint, 1.0);
}`;

function drawLand(stage, view, u, shake) {
  const sh = stage.shader("scream/land", VERT, LAND_FRAG);
  const r = WORLD;
  stage.withView(view, () => {
    stage.shaderRect(
      sh,
      {
        uOrigin: [r.x0, r.y0],
        uSize: [r.x1 - r.x0, r.y1 - r.y0],
        uPx: view.k,
        uT: u,
        uWave: u - T_TURN,
        uHead: [HEAD[0], HEAD[1] - 4],
        uShake: shake,
      },
      r.x0,
      r.y0,
      r.x1 - r.x0,
      r.y1 - r.y0,
    );
  });
}

// ------------------------------------------------------------------ crayon lettering
const CRAYON_FRAG = `${FRAG_HEAD}
uniform sampler2D uTex;
uniform vec2 uOrigin;
uniform vec2 uSize;
uniform vec3 uColor;
uniform vec3 uColor2;
${NOISE}
void main() {
  vec2 w = uOrigin + vTexCoord * uSize;
  float m = texture(uTex, vTexCoord).a;
  // crayon drags over the tooth of the board: streaks on a slant, gaps
  vec2 r = rot2(0.5) * w;
  float streak = vnoise(vec2(r.x * 0.3, r.y * 3.2));
  float tooth = vnoise(w * 1.4 + 7.0);
  float a = m * smoothstep(0.2, 0.5, streak * 0.55 + tooth * 0.45 + (m - 0.5) * 0.3);
  vec3 col = mix(uColor, uColor2, smoothstep(0.35, 0.8, vnoise(w * 0.25 + 3.0)));
  fragColor = vec4(col * a, a);
}`;

const TITLE = { x: 44, y: 722, w: 272, h: 54 };
const ZH_FONT = "'HanziPen SC', 'Hannotate SC', 'Kaiti SC', serif";
const EN_FONT = "'Bradley Hand', 'Noteworthy', 'Marker Felt', cursive";

function titleSprite(stage) {
  const os = 3.6 * stage.s;
  const b = TITLE;
  return sprite(stage, `scream/title/${os.toFixed(3)}`, b.w * os, b.h * os, (ctx) => {
    ctx.scale(os, os);
    ctx.filter = "blur(0.3px)";
    // a little hand-lettered unevenness: each glyph sits slightly differently
    const zh = `${META.zh}`;
    let x = 6;
    for (let i = 0; i < zh.length; i += 1) {
      const ch = zh[i];
      ctx.save();
      ctx.translate(x, 30 + (hash(i, 3) - 0.5) * 1.6);
      ctx.rotate((hash(i, 5) - 0.5) * 0.08);
      x += drawText(ctx, ch, 0, 0, { font: font(ZH_FONT, 21, 700), fill: "#000" }) + 0.4;
      ctx.restore();
    }
    drawText(ctx, META.date, x + 7, 30, { font: font(ZH_FONT, 15, 700), fill: "#000" });
    drawText(ctx, `${META.en} · ${META.dateEn}`, 8, 48, { font: font(EN_FONT, 19, 700), fill: "#000", spacing: 0.5 });
  });
}

function drawTitle(stage, view, shake) {
  const b = TITLE;
  const layer = titleSprite(stage);
  const sh = stage.shader("scream/crayon", VERT, CRAYON_FRAG);
  stage.withView(view, () => {
    stage.shaderRect(sh, { uTex: layer.img, uOrigin: [b.x, b.y], uSize: [b.w, b.h], uColor: rgb(C.title), uColor2: rgb(C.title2) }, b.x + shake[0], b.y + shake[1], b.w, b.h);
  });
  layer.touch();
}

// ------------------------------------------------------------------ small helpers
/** A wavering line from (x0, y) to (x1, y) as [x, y, pressure] points. */
function railLine(x0, x1, y, amp, seed, step = 28) {
  const pts = [];
  for (let x = x0; x <= x1 + 0.1; x += step) {
    // a slow waver shared by every rail at this height, plus the hand's own
    const sag = 2.6 * wobble(x * 0.0045 + y * 0.01, 77) + 0.9 * wobble(x * 0.011, 78);
    pts.push([x, y + sag + amp * wobble(x * 0.013, seed) + 0.4 * amp * wobble(x * 0.05, seed + 3), 0.8 + 0.4 * hash(Math.round(x), seed)]);
  }
  return pts;
}

/** A ribbon polygon of half-width hw around an open polyline. */
function ribbon(pts, hw0, hw1 = hw0) {
  const left = [];
  const right = [];
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1;
    const hw = lerp(hw0, hw1, i / Math.max(1, pts.length - 1));
    left.push([pts[i][0] - (dy / d) * hw, pts[i][1] + (dx / d) * hw]);
    right.push([pts[i][0] + (dy / d) * hw, pts[i][1] - (dx / d) * hw]);
  }
  return left.concat(right.reverse());
}

/** Catmull-Rom through points, n samples per span (open). */
function smooth(pts, n = 5) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let j = 0; j < n; j += 1) {
      const t = j / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1].slice(0, 2));
  return out;
}

function ellipsePts(cx, cy, rx, ry, n = 14, rot = 0) {
  const pts = [];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    pts.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return pts;
}

// ------------------------------------------------------------------ railing, ships, the two far figures
const FAR_BASE = 668; // the far figures stand beyond the railing, off the pelican's line

function farFigure(kind, x, s, seed, lean = 0.06, sway = 1.6) {
  // feet at y = FAR_BASE; local units, up is negative. Each leans a little and
  // bends in a slight S (one full wave from hem to head), narrow at the
  // shoulders and wide at the hem, like everything else in the picture.
  const P = (dx, dy) => [x + dx * s - lean * dy * s + sway * s * Math.sin((-dy / 66) * Math.PI * 2), FAR_BASE + dy * s];
  if (kind === "tall") {
    // tall and narrow, a long coat to the shins, a top hat
    return {
      coat: [P(-2.5, -60), P(-5.5, -57), P(-6.5, -46), P(-8, -30), P(-11.5, -14), P(-4, -12), P(5, -12.5), P(10.5, -15), P(7.5, -30), P(6, -46), P(5.5, -57), P(2.5, -60)],
      arms: [
        [P(-5.5, -55), P(-7.8, -42), P(-8.2, -30)],
        [P(5.5, -55), P(7.4, -43), P(7.6, -31)],
      ],
      legs: [
        [P(-2.5, -13), P(-3, -6), P(-3.5, 0)],
        [P(2.5, -13), P(3.5, -6), P(4.5, 0)],
      ],
      head: P(0.5, -64.5),
      hat: [P(-4.5, -67), P(-4, -80), P(4.8, -80), P(5, -67)],
      brim: [P(-7.5, -67.5), P(8, -67)],
      s,
      seed,
    };
  }
  // shorter and broader, a coat that flares, a round hat, head turned to the water
  return {
    coat: [P(-2, -54), P(-5.5, -51), P(-7.5, -38), P(-13, -21), P(-6, -18.5), P(6, -19), P(12.5, -22), P(7.5, -38), P(6, -51), P(3, -54)],
    arms: [
      [P(-5.5, -50), P(-8.5, -38), P(-7.5, -29)],
      [P(6, -50), P(9, -39), P(9, -30)],
    ],
    legs: [
      [P(-3, -20), P(-4, -10), P(-5, 0)],
      [P(3, -20), P(2.5, -10), P(3, 0)],
    ],
    head: P(1.8, -58),
    hat: [P(-3.6, -60.5), P(-3.2, -66), P(1.2, -68.5), P(5.6, -66), P(6.2, -60.5)],
    brim: [P(-6.5, -61), P(9, -60.5)],
    s,
    seed,
  };
}

/** The coat's outline made smooth, so its sides curve instead of running straight. */
function coatOutline(c) {
  const n = c.length;
  const h = n / 2;
  const left = smooth(c.slice(0, h), 4);
  const right = smooth(c.slice(h), 4);
  return left.concat(right);
}

/**
 * The two figures far behind, beyond the railing: a step cooler and paler
 * than the passer-by (blue-grey), built of vertical crayon strokes, with no
 * face, only a dark head and a small pale touch of cheek.
 */
function paintFarFigures(pen, stage) {
  const figs = [farFigure("tall", 114, 0.85, 1, 0.1, 2.6), farFigure("round", 143, 0.85, 2, -0.07, -2.4)];
  const FAR = { ground: "#68778f", light: "#8d9ab0", mid: "#57667f", dark: "#3f4b63", head: "#323c52", cheek: "#c2b493" };
  // a thin ground so the board does not show through the coat
  stage.reseed(13130);
  pen.reset().noStroke().wash(FAR.ground, 190);
  for (const g of figs) pen.polygon(coatOutline(g.coat));
  pen.noWash();
  pen.flush();
  stage.reseed(13136);
  pen.reset().noStroke().wash(FAR.head, 225);
  for (const g of figs) {
    pen.polygon(g.hat);
    pen.polygon(ellipsePts(g.head[0], g.head[1] + 0.3 * g.s, 3.0 * g.s, 3.7 * g.s, 10)); // a dark head, not a face
  }
  pen.noWash();
  pen.flush();
  // vertical strokes down the coats, in three tones, a darker one at the shaded side
  const tones = [
    [FAR.mid, 13131, 0.55],
    [FAR.light, 13132, 0.45],
    [FAR.dark, 13133, 0.5],
  ];
  for (const [col, seed, w] of tones) {
    stage.reseed(seed);
    pen.reset();
    for (const g of figs) {
      const c = g.coat;
      const n = c.length;
      const m = 6;
      for (let i = 0; i < m; i += 1) {
        let k = (i + 0.5 + 0.4 * (hash(i, seed, g.seed) - 0.5)) / m;
        if (col === FAR.dark) k = 0.62 + 0.38 * k; // the shaded side
        if (col === FAR.light) k = 0.05 + 0.45 * k; // the lit side
        const top = lerpPt(c[1], c[n - 2], k);
        const mid = lerpPt(c[3], c[n - 4], k);
        const bot = lerpPt(c[4], c[n - 5], k);
        pen.set("scream-chalk", col, w * g.s * (0.8 + 0.4 * hash(i, 7, seed)));
        pen.spline([[...top, 0.7], [...mid, 1.0], [...bot, 0.6]], 0.5);
      }
      // the sleeves
      pen.set("scream-chalk", col, w * g.s * 0.8);
      for (const arm of g.arms) pen.spline(arm.map((p) => [p[0] + (col === FAR.light ? -0.5 : 0.5), p[1]]), 0.5);
    }
    pen.flush();
  }
  // the hats, heads and legs: dark, and the legs tapering into the ground
  stage.reseed(13134);
  pen.reset();
  for (const g of figs) {
    pen.set("scream-chalk", FAR.head, 1.7 * g.s);
    for (const leg of g.legs) pen.spline([[...leg[0], 1.1], [...leg[1], 0.85], [...leg[2], 0.35]], 0.4);
    pen.set("scream-crayon", FAR.head, 1.0 * g.s);
    pen.line(g.brim[0][0], g.brim[0][1], g.brim[1][0], g.brim[1][1]);
    const h = g.hat;
    for (let i = 0; i < 4; i += 1) {
      const k = (i + 0.5) / 4;
      pen.spline([lerpPt(h[0], h[h.length - 1], k), lerpPt(h[1], h[h.length - 2], k)], 0.4);
    }
    // the head: a few short vertical strokes, no disc
    const [hx, hy] = g.head;
    for (let i = 0; i < 4; i += 1) {
      const dx = (i - 1.5) * 1.3 * g.s;
      pen.set("scream-chalk", FAR.head, 0.8 * g.s);
      pen.spline([[hx + dx, hy - 3 * g.s, 0.6], [hx + dx * 1.1, hy, 1.0], [hx + dx * 0.8, hy + 3.2 * g.s, 0.6]], 0.5);
    }
  }
  pen.flush();
  stage.reseed(13135);
  pen.reset();
  for (const g of figs) {
    // a small pale touch of cheek on the side turned to the light
    const [hx, hy] = g.head;
    pen.set("scream-chalk", FAR.cheek, 0.7 * g.s);
    pen.spline([[hx + 1.6 * g.s, hy - 1.2 * g.s, 0.6], [hx + 2.2 * g.s, hy + 0.6 * g.s, 0.9], [hx + 1.7 * g.s, hy + 2.2 * g.s, 0.5]], 0.5);
    // the coat's edges, only lightly
    const c = g.coat;
    const n = c.length;
    pen.set("scream-crayon", FAR.dark, 0.45 * g.s);
    pen.spline(c.slice(1, Math.floor(n / 2) - 1), 0.5);
    pen.spline(c.slice(Math.floor(n / 2) + 1, n - 1), 0.5);
  }
  pen.flush();
}

function bakeRail(stage) {
  const k = BAKE_PX * stage.s;
  const r = RAIL;
  return stage.bake(`scream/rail/${k.toFixed(3)}`, (r.x1 - r.x0) * k, (r.y1 - r.y0) * k, () => {
    const view = new View(k, -r.x0 * k, -r.y0 * k);
    stage.seed(13100);
    withPen(stage, view, (pen) => {
      const x0 = r.x0 + 4;
      const x1 = r.x1 - 4;
      const posts = [];
      for (let x = -60; x <= 1080; x += 80) posts.push(x + 6 * wobble(x * 0.1, 4));

      // the two ships on the fjord
      stage.reseed(13110);
      pen.reset().set("scream-crayon", C.coatDark, 1.0);
      for (const [sx, sy, sz] of [
        [398, 597, 1.0],
        [452, 604, 0.8],
      ]) {
        pen.spline([[sx - 8 * sz, sy], [sx, sy + 2.2 * sz], [sx + 9 * sz, sy - 0.5]], 0.5);
        pen.line(sx - 6 * sz, sy + 0.6, sx + 7 * sz, sy + 0.4);
        pen.line(sx + 0.5, sy, sx + 0.8, sy - 13 * sz);
      }
      pen.flush();
      stage.reseed(13111);
      pen.reset().noStroke().wash("#d9c8a0", 235);
      for (const [sx, sy, sz] of [
        [398, 597, 1.0],
        [452, 604, 0.8],
      ]) {
        pen.polygon([[sx + 1.3, sy - 12 * sz], [sx + 7 * sz, sy - 2 * sz], [sx + 1.3, sy - 1.5 * sz]]);
      }
      pen.noWash();
      pen.flush();

      // the two far figures, beyond the railing, so its rails pass in front of them
      paintFarFigures(pen, stage);

      // the dark parts of the railing: shadow under each rail, the posts, the walkway edge
      stage.reseed(13120);
      pen.reset();
      pen.set("scream-chalk", C.railDark, 1.6);
      pen.spline(railLine(x0, x1, 655.5, 0.6, 1), 0.5);
      pen.spline(railLine(x0, x1, 673, 0.5, 2), 0.5);
      pen.spline(railLine(x0, x1, 690.5, 0.5, 3), 0.5);
      pen.set("scream-chalk", C.railDark, 2.0);
      pen.spline(railLine(x0, x1, 701.5, 0.4, 5, 40), 0.5);
      for (const px of posts) {
        pen.set("scream-chalk", C.railDark, 1.5);
        pen.spline([[px + 1.4, 649, 1.1], [px + 1.6, 675, 1], [px + 1.3, 701, 0.9]], 0.4);
      }
      pen.flush();
      stage.reseed(13121);
      pen.reset();
      pen.set("scream-chalk", C.railBrown, 1.7);
      pen.spline(railLine(x0, x1, 652.5, 0.6, 6), 0.5);
      pen.spline(railLine(x0, x1, 670.5, 0.5, 7), 0.5);
      pen.spline(railLine(x0, x1, 688.5, 0.5, 8), 0.5);
      for (const px of posts) {
        pen.set("scream-chalk", C.railBrown, 1.3);
        pen.spline([[px - 0.6, 648, 1.1], [px - 0.3, 675, 1], [px - 0.5, 700, 0.9]], 0.4);
      }
      pen.flush();
      stage.reseed(13122);
      pen.reset();
      pen.set("scream-chalk", C.railOrange, 1.3);
      pen.spline(railLine(x0, x1, 650.2, 0.7, 9), 0.5);
      pen.set("scream-chalk", C.railOrange, 0.9);
      pen.spline(railLine(x0, x1, 668.8, 0.5, 10), 0.5);
      pen.spline(railLine(x0, x1, 686.8, 0.5, 11), 0.5);
      for (const px of posts) pen.spline([[px - 1.6, 649, 0.8], [px - 1.5, 674, 0.7], [px - 1.7, 699, 0.6]], 0.4);
      pen.flush();
      stage.reseed(13123);
      pen.reset();
      pen.set("scream-chalk", C.railBlue, 0.8);
      pen.spline(railLine(x0, x1, 654, 0.8, 12, 34), 0.5);
      pen.spline(railLine(x0, x1, 703.5, 0.6, 13, 40), 0.5);
      pen.flush();

    });
  });
}

const lerpPt = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

// ------------------------------------------------------------------ the passer-by
// Two drawings from the same points, in units relative to the centre of his
// head. Each entry is [before, after]; the figure at any moment is the mix.

function headOutline(cx, cy, rxTop, rxBot, ryTop, ryBot, pinch, tilt, n = 20) {
  const pts = [];
  const c = Math.cos(tilt);
  const s = Math.sin(tilt);
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2; // 0 = top, clockwise
    const sy = -Math.cos(a);
    const ry = sy < 0 ? ryTop : ryBot;
    const y = sy * ry;
    let rx = sy < 0 ? rxTop : rxBot;
    if (sy > 0) rx *= 1 - pinch * Math.pow(sy, 1.6);
    const x = Math.sin(a) * rx;
    pts.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return pts;
}

const POSE = {
  head: [headOutline(2.5, 0, 20.5, 20, 27, 27, 0.18, 0.1), headOutline(0, -2, 23, 22.5, 29, 33, 0.52, -0.1)],
  // a hint of nose past the cheek, then the nose seen from the front
  nose: [
    [
      [19.5, -2],
      [24.5, 4],
      [20.5, 7.5],
    ],
    [
      [-0.5, 0],
      [0.8, 5.5],
      [-1.2, 6.5],
    ],
  ],
  ear: [
    [16.5, 1.5, 4.8],
    [-19, 0, 0],
  ],
  // the dark cropped hair on the back of his head (before only); local to the
  // head centre. Seen from three-quarters behind it covers nearly all of the
  // head; the hairline curves down behind the ear, leaving a narrow sliver of
  // cheek on the turned side.
  hair: [
    [
      [3.5, -27.5],
      [11.5, -23.5],
      [15.5, -15],
      [15.5, -5],
      [14.5, 5],
      [12, 14],
      [5, 22.5],
      [-4, 25],
      [-12, 21],
      [-18, 10],
      [-20.5, -3],
      [-17, -17],
      [-8, -26.5],
    ],
    [
      [8, -30],
      [12, -28],
      [10, -27],
      [8, -27],
      [5, -28],
      [2, -29],
      [-1, -29],
      [-4, -29],
      [-6, -29],
      [-8, -29],
      [-6, -30],
      [-2, -31],
      [3, -31],
    ],
  ],
  eyeL: [
    [16, -5, 0],
    [-8.5, -7.5, 4.3],
  ],
  eyeR: [
    [19, -5, 0],
    [8.5, -7.5, 4.3],
  ],
  mouth: [
    [17, 15, 0, 0],
    [0, 17, 4.4, 8.6],
  ],
  neck: [
    [
      [-7.5, 21],
      [8, 22],
      [9, 38],
      [-9.5, 38],
    ],
    [
      [-6.5, 27],
      [6.5, 27],
      [7.5, 41],
      [-7.5, 41],
    ],
  ],
  coatL: [
    [
      [-11, 33],
      [-29, 49],
      [-35, 78],
      [-32, 110],
      [-37, 140],
      [-35, 178],
    ],
    [
      [-8, 36],
      [-27, 47],
      [-31, 80],
      [-23, 112],
      [-27, 145],
      [-45, 178],
    ],
  ],
  coatR: [
    [
      [11, 33],
      [27, 48],
      [34, 80],
      [38, 112],
      [35, 142],
      [39, 178],
    ],
    [
      [8, 36],
      [27, 47],
      [33, 80],
      [38, 111],
      [37, 143],
      [25, 178],
    ],
  ],
  armL: [
    [
      [-25, 51],
      [-35, 90],
      [-33, 124],
    ],
    [
      [-24, 49],
      [-45, 76],
      [-19.5, 22],
    ],
  ],
  armR: [
    [
      [24, 51],
      [34, 90],
      [36, 122],
    ],
    [
      [24, 49],
      [45, 78],
      [19.5, 22],
    ],
  ],
  // hand: wrist, direction, length, width, spread of the fingers, side (+1: thumb towards +normal)
  handL: [
    [-33, 124, -0.15, 1, 13, 8, 0.05, 1],
    [-20.5, 23, 0.06, -1, 31, 11, 1, 1],
  ],
  handR: [
    [36, 122, 0.1, 1, 12, 8, 0.05, -1],
    [20.5, 23, -0.06, -1, 31, 11, 1, -1],
  ],
};

function mixDeep(a, b, t) {
  if (typeof a === "number") return lerp(a, b, t);
  return a.map((v, i) => mixDeep(v, b[i], t));
}

/**
 * A hand: a palm from the wrist to the knuckles, then four fingers, fanned by
 * `spread` and each a slightly different length (the middle one longest).
 * Returns { palm, fingers: [{ pts, poly }], outline }.
 */
function handShape(h) {
  const [wx, wy, dx0, dy0, len, wd, spread, side] = h;
  const d = Math.hypot(dx0, dy0) || 1;
  const dx = dx0 / d;
  const dy = dy0 / d;
  const nx = -dy;
  const ny = dx;
  const P = (a, b) => [wx + dx * a + nx * b, wy + dy * a + ny * b];
  const palmLen = len * 0.5;
  const palm = [P(0, -wd * 0.4), P(palmLen * 0.55, -wd * 0.52), P(palmLen, -wd * 0.5), P(palmLen * 1.05, 0), P(palmLen, wd * 0.5), P(palmLen * 0.55, wd * 0.54), P(0, wd * 0.4)];
  const fingers = [];
  const LEN = [0.78, 1.0, 0.95, 0.72];
  for (let i = 0; i < 4; i += 1) {
    const off = (i - 1.5) / 1.5; // -1 … 1 across the knuckles
    const b = off * wd * 0.38 * side;
    const base = P(palmLen * (1 - 0.06 * Math.abs(off)), b);
    const ang = off * 0.3 * spread * side;
    const fl = len * 0.5 * LEN[i] * (0.82 + 0.18 * spread);
    const fx = dx * Math.cos(ang) - dy * Math.sin(ang);
    const fy = dx * Math.sin(ang) + dy * Math.cos(ang);
    const mid = [base[0] + fx * fl * 0.55 + nx * 0.4 * spread * off, base[1] + fy * fl * 0.55 + ny * 0.4 * spread * off];
    const tip = [base[0] + fx * fl, base[1] + fy * fl];
    const pts = [base, mid, tip];
    fingers.push({ pts, poly: ribbon(pts, wd * 0.13, wd * 0.1) });
  }
  return { palm, fingers };
}

/**
 * The held in-between: he has jerked, shoulders up round his ears, head half
 * round towards us, arms still down. Built from the halfway mix, with the
 * parts that would mix badly (hair, ear, features, shoulders) set by hand.
 */
function jerkPose() {
  const P = {};
  for (const key of Object.keys(POSE)) P[key] = mixDeep(POSE[key][0], POSE[key][1], 0.5);
  const up = (pts, dy, upto = 2) => pts.map((p, i) => (i < upto ? [p[0] * 0.92, p[1] - dy] : p));
  P.head = headOutline(1.5, -3, 21.5, 21, 28, 30, 0.35, 0.04);
  // what is left of the hair: a crescent at the back of the skull, on our left
  P.hair = [
    [-3, -28.5],
    [-10, -26.5],
    [-16, -20.5],
    [-20, -10],
    [-21, 0],
    [-19.5, 9],
    [-16.5, 15],
    [-16, 7],
    [-16, -3],
    [-14, -13],
    [-9.5, -21],
    [-4, -25],
    [1, -27],
  ];
  P.ear = [-14, 1, 4.6];
  P.eyeL = [1.5, -7, 3.5];
  P.eyeR = [13.5, -7, 3.9];
  P.mouth = [7.5, 16, 2.8, 5.6];
  P.nose = [
    [10, -1.5],
    [12.5, 4.5],
    [9, 6.5],
  ];
  P.neck = [
    [-6.5, 23],
    [7, 23],
    [7.5, 31],
    [-7.5, 31],
  ];
  P.coatL = up(POSE.coatL[0], 9);
  P.coatR = up(POSE.coatR[0], 9);
  P.armL = [
    [-23.5, 42],
    [-37, 82],
    [-34, 116],
  ];
  P.armR = [
    [22.5, 42],
    [36, 82],
    [37, 114],
  ];
  P.handL = [-34, 116, -0.15, 1, 13, 8, 0.05, 1];
  P.handR = [37, 114, 0.1, 1, 12, 8, 0.05, -1];
  return P;
}

/** The figure at mix t (0 = calm, back turned; 1 = the pose), in world units. */
function figureAt(t, given = null) {
  let P = given;
  if (!P) {
    P = {};
    for (const key of Object.keys(POSE)) P[key] = mixDeep(POSE[key][0], POSE[key][1], t);
  }
  const W = (pt) => [HEAD[0] + pt[0], HEAD[1] + pt[1]];
  const Wa = (pts) => pts.map(W);
  const coatL = smooth(Wa(P.coatL), 5);
  const coatR = smooth(Wa(P.coatR), 5);
  const armL = smooth(Wa(P.armL), 5);
  const armR = smooth(Wa(P.armR), 5);
  const head = Wa(P.head);
  return {
    t,
    hairOn: t < 0.75,
    eyesOn: t > 0.25,
    head,
    nose: Wa(P.nose),
    ear: [...W(P.ear), P.ear[2]],
    eyeL: [...W(P.eyeL), P.eyeL[2]],
    eyeR: [...W(P.eyeR), P.eyeR[2]],
    mouth: [...W(P.mouth), P.mouth[2], P.mouth[3]],
    neck: Wa(P.neck),
    coatL,
    coatR,
    coat: coatL.concat([...coatR].reverse()),
    armL,
    armR,
    sleeveL: ribbon(armL, 7.5, 6),
    sleeveR: ribbon(armR, 7.5, 6),
    handL: handShape([...W(P.handL), ...P.handL.slice(2)]),
    handR: handShape([...W(P.handR), ...P.handR.slice(2)]),
    hair: Wa(P.hair.map((p) => [p[0] + 2.5 * (1 - t), p[1]])),
    centre: W([lerp(2.5, 0, t), lerp(0, -2, t)]),
  };
}

/** Arcs inside the head outline, pulled towards its centre: the shading strokes. */
const HEAD_INK = ["#e8ddae", "#6f7d58", "#c9a860", "#5f7488"];

/**
 * The head is built of strokes that follow the skull, concentric, each a
 * different colour from its neighbours. Same indices before and after, so
 * the strokes turn with the head. Returns [{ pts, ink }].
 */
function headStrokes(F) {
  const c = F.centre;
  const n = F.head.length;
  const out = [];
  const rings = [0.9, 0.79, 0.68, 0.57, 0.46, 0.35, 0.24];
  rings.forEach((k, r) => {
    for (let part = 0; part < 2; part += 1) {
      const start = Math.floor(hash(r, part, 41) * n);
      const cnt = 6 + Math.floor(hash(r, part, 43) * 5);
      const pts = [];
      for (let j = 0; j < cnt; j += 1) {
        const p = F.head[(start + j) % n];
        const kk = k * (1 + 0.04 * Math.sin(j * 1.7 + r));
        pts.push([c[0] + (p[0] - c[0]) * kk, c[1] + (p[1] - c[1]) * kk, 0.7 + 0.5 * hash(r, j, part)]);
      }
      // the outer rings in green and blue shadow (temples, the hollow cheeks), the inner ones pale
      const pick = hash(r, part, 47) < 0.5 ? 0 : 1;
      const ink = r <= 1 ? [1, 3][pick] : r >= 4 ? [0, 2][pick] : (r + part) % HEAD_INK.length;
      out.push({ pts, ink });
    }
  });
  return out;
}

function paintFigure(pen, stage, F) {
  const handPolys = (H) => [H.palm, ...H.fingers.map((g) => g.poly)];
  const hands = [F.handL, F.handR];
  // 1. the coat and sleeves, a blue-black ground
  stage.reseed(13300);
  pen.reset().noStroke().wash("#1c2234", 250);
  pen.polygon(F.coat);
  pen.polygon(F.sleeveL);
  pen.polygon(F.sleeveR);
  pen.noWash();
  pen.flush();
  // 2. long sinuous strokes down the coat in four colours, of uneven length and weight
  for (const [col, seed, n, w] of [
    ["#0a0c13", 13321, 7, 1.9],
    [C.coatBlue, 13301, 9, 1.2],
    ["#3c3a5c", 13331, 5, 1.0],
    ["#4c6a9a", 13311, 5, 0.75],
  ]) {
    stage.reseed(seed);
    pen.reset();
    const nL = F.coatL.length;
    for (let i = 0; i < n; i += 1) {
      const k = 0.06 + (i + 0.6 * hash(seed, i)) * (0.88 / n);
      const j0 = 1 + Math.floor(hash(seed, i, 2) * 9);
      const j1 = nL - 1 - Math.floor(hash(seed, i, 3) * 7);
      const pts = [];
      for (let j = j0; j <= j1; j += 2) {
        const q = lerpPt(F.coatL[j], F.coatR[j], k + 0.05 * Math.sin(j * 0.45 + i * 1.3));
        pts.push([q[0], q[1], 0.5 + 0.7 * hash(i, j, seed)]);
      }
      if (pts.length < 2) continue;
      pen.set("scream-chalk", col, w * (0.8 + 0.5 * hash(i, 9, seed)));
      pen.spline(pts, 0.6);
    }
    for (const [ai, arm] of [F.armL, F.armR].entries()) {
      pen.set("scream-chalk", col, w * 0.8);
      const o = (hash(seed, ai) - 0.5) * 5;
      pen.spline(arm.map((p, j) => [p[0] + o, p[1] + o * 0.3, 0.6 + 0.05 * j]), 0.6);
    }
    pen.flush();
  }
  // 3. the dark contour: coat edges and sleeves, pressing harder in places
  stage.reseed(13302);
  pen.reset();
  pen.set("scream-crayon", C.coatDark, 1.9);
  pen.spline(F.coatL.map((p, j) => [p[0], p[1], 0.6 + 0.8 * hash(j, 1, 51)]), 0.5);
  pen.spline(F.coatR.map((p, j) => [p[0], p[1], 0.6 + 0.8 * hash(j, 2, 51)]), 0.5);
  pen.set("scream-crayon", C.coatDark, 1.3);
  for (const sl of [F.sleeveL, F.sleeveR]) {
    const h = sl.length / 2;
    pen.spline(sl.slice(0, h).map((p, j) => [p[0], p[1], 0.6 + 0.6 * hash(j, 3, 51)]), 0.5);
    pen.spline(sl.slice(h).map((p, j) => [p[0], p[1], 0.6 + 0.6 * hash(j, 4, 51)]), 0.5);
  }
  pen.flush();
  // 4. pale skin: head and hands; the neck in shadow
  stage.reseed(13303);
  pen.reset().noStroke().wash(C.skin, 252);
  pen.polygon(F.head);
  for (const H of hands) for (const poly of handPolys(H)) pen.polygon(poly);
  pen.noWash();
  pen.flush();
  stage.reseed(13307);
  pen.reset().noStroke().wash("#8f8a62", 250);
  pen.polygon(F.neck);
  pen.noWash();
  pen.flush();
  // 5. strokes that follow the skull, in four colours, then the neck and hands
  const hs = headStrokes(F);
  HEAD_INK.forEach((col, ci) => {
    stage.reseed(13304 + ci * 10);
    pen.reset();
    pen.set("scream-chalk", col, 1.15);
    for (const st of hs) if (st.ink === ci) pen.spline(st.pts, 0.6);
    if (ci === 1 || ci === 3) {
      pen.set("scream-chalk", col, 0.9);
      const s0 = ci === 1 ? 0.25 : 0.7;
      pen.spline([lerpPt(F.neck[0], F.neck[1], s0), lerpPt(F.neck[3], F.neck[2], s0)], 0.5);
      pen.spline([lerpPt(F.neck[0], F.neck[1], s0 * 0.6 + 0.2), lerpPt(F.neck[3], F.neck[2], s0 * 0.5 + 0.3)], 0.5);
      pen.spline([F.neck[0], lerpPt(F.neck[0], F.neck[3], 0.5), F.neck[3]], 0.5);
      for (const H of hands) {
        pen.set("scream-chalk", col, 0.65);
        pen.spline([H.palm[0], H.palm[1], H.palm[2]], 0.5);
      }
    }
    if (ci === 0) {
      pen.set("scream-chalk", col, 0.8);
      for (const H of hands) for (const g of H.fingers.slice(1, 3)) pen.spline(g.pts, 0.5);
    }
    pen.flush();
  });
  // 6. before: dark cropped hair over the back of his head; after: the sockets of the eyes
  if (F.hairOn) {
    const calm = F.t < 0.25;
    if (calm) {
      // a soft margin: a thinner, warmer hair tone a little past the hairline
      // on the turned side, so hair and cheek meet without a hard edge
      const c = F.centre;
      const halo = F.hair.map((p, i) => (i >= 2 && i <= 5 ? [p[0] + 2.4, p[1] + (p[1] - c[1]) * 0.04] : p));
      stage.reseed(13312);
      pen.reset().noStroke().wash("#6e5a42", 175);
      pen.polygon(halo);
      pen.noWash();
      pen.flush();
    }
    stage.reseed(13308);
    pen.reset().noStroke().wash("#2b211f", 240);
    pen.polygon(F.hair);
    pen.noWash();
    pen.flush();
    if (calm) {
      // short strokes of hair feathering over the hairline into the cheek
      stage.reseed(13313);
      pen.reset();
      const hp = F.hair;
      for (let i = 0; i < 9; i += 1) {
        const k = (i + 0.5) / 9;
        const seg = k * 5; // along the hairline from hp[1] to hp[6]
        const j = Math.min(4, Math.floor(seg));
        const e = lerpPt(hp[1 + j], hp[2 + j], seg - j);
        const len = 2.2 + 1.6 * hash(i, 71);
        pen.set("scream-chalk", i % 3 === 0 ? "#5a3a28" : i % 3 === 1 ? "#3a2a24" : "#34405a", 0.7 + 0.3 * hash(i, 72));
        pen.spline([[e[0] - 3.5, e[1] - 2, 0.9], [e[0] + 0.4, e[1] + 0.6, 0.7], [e[0] + len, e[1] + 1.4, 0.25]], 0.6);
      }
      pen.flush();
    }
    // hair combed down the back of the skull: strokes from the crown to the nape
    stage.reseed(13309);
    pen.reset();
    const hp = F.hair;
    if (F.t > 0.25) {
      // the crescent left at the back of the half-turned head: strokes along it
      const outer = hp.slice(0, 7);
      const inner = outer.map((_, i) => hp[Math.min(12, 13 - i)]);
      [0.2, 0.45, 0.7].forEach((k, i) => {
        pen.set("scream-chalk", ["#5a3a28", "#141216", "#34405a"][i], 0.9);
        pen.spline(outer.map((p, j) => [...lerpPt(p, inner[j], k), 0.5 + 0.5 * Math.sin((j / 6) * Math.PI)]), 0.6);
      });
    }
    const crown = lerpPt(hp[0], hp[12], 0.5);
    const nape = hp[6];
    for (let i = 0; i < (F.t > 0.25 ? 0 : 11); i += 1) {
      const k = (i + 0.5) / 11; // across the head, right to left
      const top = lerpPt(lerpPt(hp[1], hp[11], k), crown, 0.25);
      const edge = k < 0.5 ? lerpPt(hp[2], hp[4], k * 2) : lerpPt(hp[8], hp[10], (1 - k) * 2);
      const mid = lerpPt(lerpPt(hp[3], hp[9], k), edge, 0.3);
      const bot = lerpPt(lerpPt(hp[4], hp[8], k), nape, 0.45);
      pen.set("scream-chalk", i % 3 === 0 ? "#5a3a28" : i % 3 === 1 ? "#141216" : "#34405a", 0.8 + 0.4 * hash(i, 61));
      pen.spline([[...top, 0.6], [...mid, 1.1], [...bot, 0.5]], 0.6);
    }
    pen.flush();
  }
  if (F.eyesOn) {
    stage.reseed(13318);
    pen.reset().noStroke().wash("#6a7458", 225);
    for (const eye of [F.eyeL, F.eyeR]) pen.polygon(ellipsePts(eye[0], eye[1] + 0.8, eye[2] * 1.5, eye[2] * 1.65, 12));
    pen.polygon(ellipsePts(F.centre[0], F.centre[1] + 31, 6, 2.2, 10)); // under the chin
    pen.noWash();
    pen.flush();
    stage.reseed(13310);
    pen.reset().noStroke().wash("#e9dfb2", 245);
    for (const eye of [F.eyeL, F.eyeR]) pen.polygon(ellipsePts(eye[0], eye[1], eye[2] * 0.85, eye[2] * 0.85, 10));
    pen.noWash();
    pen.flush();
  }
  // 7. the mouth, dark
  if (F.mouth[3] > 0.6) {
    stage.reseed(13305);
    pen.reset().noStroke().wash(C.mouth, 245);
    pen.polygon(ellipsePts(F.mouth[0], F.mouth[1], F.mouth[2] * 0.82, F.mouth[3] * 0.86, 14));
    pen.noWash();
    pen.flush();
  }
  // 8. features and the head's contour
  stage.reseed(13306);
  pen.reset();
  pen.set("scream-crayon", C.feature, 1.35);
  pen.polygon(F.head);
  for (const H of hands) {
    pen.set("scream-crayon", C.feature, 0.75);
    pen.spline([H.palm[0], H.palm[1], H.palm[2]], 0.5);
    pen.spline([H.palm[4], H.palm[5], H.palm[6]], 0.5);
    for (const g of H.fingers) {
      const p = g.poly;
      pen.set("scream-crayon", C.feature, 0.7);
      pen.spline(p, 0.5);
    }
  }
  if (F.t >= 0.25) {
    pen.set("scream-crayon", C.feature, 0.9);
    pen.spline(F.nose, 0.5);
  }
  if (F.t < 0.25) {
    // one ear seen from behind, on the hairline: a lobe of skin and its outer rim
    const [ex, ey, er] = F.ear;
    pen.flush();
    stage.reseed(13314);
    pen.reset().noStroke().wash(C.skin, 245);
    pen.polygon(ellipsePts(ex + 0.6, ey, er * 0.5, er, 12, -0.15));
    pen.noWash();
    pen.flush();
    stage.reseed(13315);
    pen.reset();
    pen.set("scream-crayon", C.feature, 0.95);
    pen.spline([[ex - 0.6, ey - er * 0.95, 0.4], [ex + er * 0.45, ey - er * 0.75, 0.9], [ex + er * 0.62, ey, 1.0], [ex + er * 0.4, ey + er * 0.75, 0.8], [ex - 0.4, ey + er, 0.4]], 0.5);
    pen.set("scream-chalk", "#a08a5a", 0.6);
    pen.spline([[ex + 0.2, ey - er * 0.5], [ex + er * 0.3, ey], [ex + 0.1, ey + er * 0.45]], 0.5);
  } else if (F.ear[2] > 0.8) {
    pen.set("scream-crayon", C.feature, 1.05);
    pen.spline(ellipsePts(F.ear[0], F.ear[1], F.ear[2] * 0.62, F.ear[2], 10).slice(7, 10).concat(ellipsePts(F.ear[0], F.ear[1], F.ear[2] * 0.62, F.ear[2], 10).slice(0, 6)), 0.5);
    pen.set("scream-crayon", "#7a5a44", 0.7);
    pen.spline([[F.ear[0] + 0.6, F.ear[1] - F.ear[2] * 0.45], [F.ear[0] + 1.4, F.ear[1]], [F.ear[0] + 0.4, F.ear[1] + F.ear[2] * 0.5]], 0.5);
  }
  for (const eye of [F.eyeL, F.eyeR]) {
    if (eye[2] < 0.8) continue;
    pen.set("scream-crayon", C.feature, 1.2);
    pen.circle(eye[0], eye[1], eye[2] * 0.85, 0.15);
    pen.set("scream-crayon", C.feature, 1.6);
    pen.circle(eye[0], eye[1], 0.7, 0.1);
  }
  if (F.eyesOn) {
    // two nostrils
    pen.set("scream-crayon", C.feature, 1.1);
    pen.circle(F.nose[2][0] - 1.6, F.nose[2][1] + 0.6, 0.5, 0.1);
    pen.circle(F.nose[2][0] + 2.4, F.nose[2][1] + 0.6, 0.5, 0.1);
  }
  if (F.mouth[3] > 0.6) {
    pen.set("scream-crayon", C.feature, 1.1);
    pen.polygon(ellipsePts(F.mouth[0], F.mouth[1], F.mouth[2], F.mouth[3], 14));
  }
  // the collar
  if (F.t < 0.25) {
    // the line of the jaw, from under the ear forward to the hidden chin
    const J = (x, y, p) => [HEAD[0] + x, HEAD[1] + y, p];
    // a cool shadow down the far edge of the cheek
    pen.set("scream-chalk", "#6f7d58", 0.8);
    pen.spline([J(20.5, -12, 0.4), J(21, -6, 0.7), J(19.5, 6, 0.5), J(16.5, 12, 0.3)], 0.5);
    pen.set("scream-chalk", "#d6ccb0", 1.5);
    pen.spline([lerpPt(F.neck[3], F.neck[0], 0.2), lerpPt(F.neck[3], F.neck[2], 0.5).map((v, i) => v + (i ? 1.5 : 0)), lerpPt(F.neck[2], F.neck[1], 0.2)], 0.5);
  }
  pen.set("scream-crayon", C.coatDark, 1.4);
  pen.spline([F.coatL[0], lerpPt(F.coatL[0], F.coatR[0], 0.5).map((v, i) => v + (i ? 3 : 0)), F.coatR[0]], 0.5);
  pen.flush();
}

function bakeFigure(stage, which) {
  const k = BAKE_PX * stage.s;
  const r = FIG;
  return stage.bake(`scream/fig/${which}/${k.toFixed(3)}`, (r.x1 - r.x0) * k, (r.y1 - r.y0) * k, () => {
    const view = new View(k, -r.x0 * k, -r.y0 * k);
    stage.seed(13200);
    const F = which === "after" ? figureAt(1) : which === "jerk" ? figureAt(0.5, jerkPose()) : figureAt(0);
    withPen(stage, view, (pen) => paintFigure(pen, stage, F));
  });
}

// ------------------------------------------------------------------ the pelican, in Munch's manner
function shapeLine(pen, sh) {
  if (sh.kind === "circle") pen.circle(sh.c[0], sh.c[1], sh.r, 0.2);
  else if (sh.pts.length === 2) pen.line(sh.pts[0][0], sh.pts[0][1], sh.pts[1][0], sh.pts[1][1]);
  else if (sh.closed) pen.polygon(sh.pts);
  else pen.spline(sh.pts, 0.4);
}

function arcsInside(pts, specs) {
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p[0];
    cy += p[1];
  }
  cx /= pts.length;
  cy /= pts.length;
  const n = pts.length;
  const out = [];
  for (const [f0, f1, k] of specs) {
    const a = Math.floor(f0 * n);
    const b = Math.floor(f1 * n);
    const arc = [];
    for (let i = a; i <= b; i += 1) {
      const p = pts[((i % n) + n) % n];
      arc.push([cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]);
    }
    if (arc.length > 1) out.push(arc);
  }
  return out;
}

function paintPelican(pen, stage, skel, u) {
  const s = skel.scale / 21.2;
  const shapes = skel.shapes;
  const each = (test, fn) => {
    for (const sh of shapes) if (test(sh)) fn(sh);
  };
  const is = (...tags) => (sh) => tags.includes(sh.tag);
  const find = (id) => shapes.find((sh) => sh.id === id);

  // 1. the bicycle and its shadow in dark wavering line
  stage.reseed(13401);
  pen.reset();
  const rear = skel.joints.rear;
  const front = skel.joints.front;
  pen.set("scream-chalk", C.railBlue, 1.4 * s);
  for (let i = 0; i < 3; i += 1) pen.line(rear[0] - 18 * s + i * 9, ROAD_Y + 2.5 + i * 1.6, front[0] + 14 * s + i * 7, ROAD_Y + 3 + i * 1.6);
  each(is("tire"), (sh) => {
    pen.set("scream-crayon", C.bike, 1.5 * s);
    pen.circle(sh.c[0], sh.c[1], sh.r, 0.12);
    pen.set("scream-crayon", C.bike, 0.6 * s);
    pen.circle(sh.c[0], sh.c[1], sh.r * 0.86, 0.12);
  });
  let spoke = 0;
  each(is("spoke"), (sh) => {
    spoke += 1;
    if (spoke % 3 === 0) {
      pen.set("scream-crayon", C.bike, 0.35 * s);
      shapeLine(pen, sh);
    }
  });
  each((sh) => ["frame", "post", "bar", "grip", "chain", "ring", "crank", "saddle", "pedal", "hub"].includes(sh.tag), (sh) => {
    pen.set("scream-crayon", C.bike, (sh.tag === "frame" ? 1.25 : 0.85) * s);
    shapeLine(pen, sh);
  });
  pen.flush();
  // 2. legs and feet, dull orange
  stage.reseed(13402);
  pen.reset();
  each((sh) => sh.tag === "leg" || sh.tag === "foot", (sh) => {
    pen.set("scream-chalk", sh.side === "far" ? "#9a5a2c" : C.leg, (sh.tag === "leg" ? 1.6 : 1.0) * s);
    shapeLine(pen, sh);
  });
  pen.flush();
  // 3. the pale bird: a thin ghostly ground, then long strokes over it
  stage.reseed(13403);
  pen.reset().noStroke().wash("#d9d5c3", 215);
  each(is("body", "neck", "head", "crest", "wing", "wingtip"), (sh) => pen.polygon(sh.pts));
  pen.noWash();
  pen.flush();
  // 4. strokes that follow the forms: white, grey-blue, a little green
  const body = find("body");
  const wing = find("wing");
  const head = find("head");
  // the tail: each feather is one short stroke from the root, tapering to its tip
  const tails = shapes.filter((sh) => sh.tag === "tail");
  const tailStroke = (sh, side, k) => {
    const root = sh.pts[0];
    const tip = sh.pts[5];
    const nx = -(tip[1] - root[1]);
    const ny = tip[0] - root[0];
    const nd = Math.hypot(nx, ny) || 1;
    const o = side * 0.9 * s;
    return [
      [root[0] + (nx / nd) * o, root[1] + (ny / nd) * o, 1.2],
      [lerp(root[0], tip[0], 0.5) + (nx / nd) * o * 0.8, lerp(root[1], tip[1], 0.5) + (ny / nd) * o * 0.8, 0.9],
      [lerp(root[0], tip[0], k) + (nx / nd) * o * 0.4, lerp(root[1], tip[1], k) + (ny / nd) * o * 0.4, 0.25],
    ];
  };
  const nl = skel.neckLine;
  const neckStrokes = (offs) => (nl && nl.length > 2 ? offs.map((o) => nl.map((p, i) => [p[0] + o * s * (1 - 0.35 * (i / nl.length)), p[1] + 0.3 * o, 0.7 + 0.4 * Math.sin(i + o)])) : []);
  const passes = [
    {
      col: "#f6f2e2",
      seed: 13404,
      w: 1.2,
      body: [
        [0.5, 0.95, 0.88],
        [0.55, 0.93, 0.74],
        [0.58, 0.92, 0.6],
        [0.62, 0.88, 0.46],
        [0.66, 0.86, 0.32],
        [0.02, 0.22, 0.8],
        [0.0, 0.18, 0.55],
      ],
      wing: [
        [0.05, 0.5, 0.8],
        [0.6, 0.95, 0.5],
      ],
      head: [
        [0.6, 1.0, 0.7],
        [0.55, 0.95, 0.45],
      ],
      tailSide: 0,
      tailK: 1.0,
      neck: [-1.2, 0.6, 1.8],
    },
    {
      col: C.birdBlue,
      seed: 13414,
      w: 1.0,
      body: [
        [0.0, 0.42, 0.9],
        [0.04, 0.4, 0.74],
        [0.08, 0.38, 0.58],
        [0.55, 0.9, 0.8],
        [0.6, 0.85, 0.5],
      ],
      wing: [
        [0.0, 0.45, 0.85],
        [0.0, 0.45, 0.66],
        [0.1, 0.4, 0.46],
        [0.15, 0.35, 0.28],
      ],
      head: [[0.1, 0.45, 0.72]],
      tailSide: 1,
      tailK: 0.8,
      neck: [-2.6, 0.4],
    },
    {
      col: C.birdGreen,
      seed: 13424,
      w: 0.9,
      body: [
        [0.15, 0.4, 0.66],
        [0.7, 0.9, 0.62],
      ],
      wing: [[0.0, 0.4, 0.55]],
      head: [],
      neck: [3.0],
    },
  ];
  for (const ps of passes) {
    stage.reseed(ps.seed);
    pen.reset();
    pen.set("scream-chalk", ps.col, ps.w * s);
    if (body) for (const arc of arcsInside(body.pts, ps.body)) pen.spline(arc, 0.6);
    if (wing) for (const arc of arcsInside(wing.pts, ps.wing)) pen.spline(arc, 0.6);
    if (head) for (const arc of arcsInside(head.pts, ps.head)) pen.spline(arc, 0.6);
    if (ps.tailSide !== undefined) {
      pen.set("scream-chalk", ps.col, ps.w * (ps.tailSide === 0 ? 2.6 : 1.4) * s);
      for (const sh of tails) pen.spline(tailStroke(sh, ps.tailSide, ps.tailK), 0.5);
    }
    pen.set("scream-chalk", ps.col, ps.w * 0.85 * s);
    for (const line of neckStrokes(ps.neck)) pen.spline(line, 0.5);
    pen.flush();
  }
  // 5. bill and pouch, orange-yellow
  stage.reseed(13405);
  pen.reset().noStroke().wash(C.bill, 240);
  each(is("pouch", "bill"), (sh) => pen.polygon(sh.pts));
  pen.noWash();
  pen.flush();
  const pouch = find("pouch");
  if (pouch) {
    stage.reseed(13408);
    pen.reset();
    pen.set("scream-chalk", "#c4582a", 0.8 * s);
    for (const arc of arcsInside(pouch.pts, [[0.1, 0.55, 0.75], [0.55, 0.95, 0.55]])) pen.spline(arc, 0.5);
    pen.flush();
  }
  // 6. one wavering blue-black contour, and the eye
  stage.reseed(13406);
  pen.reset();
  each(is("body", "neck", "head", "pouch", "bill", "wing"), (sh) => {
    pen.set("scream-crayon", C.contour, (sh.tag === "bill" || sh.tag === "pouch" ? 0.8 : 1.0) * s);
    pen.polygon(sh.pts);
  });
  each(is("wingtip"), (sh) => {
    pen.set("scream-crayon", C.contour, 0.7 * s);
    pen.polygon(sh.pts);
  });
  // under the tail feathers, one thin dark tapering line each
  for (const sh of tails) {
    pen.set("scream-crayon", C.contour, 0.55 * s);
    pen.spline(tailStroke(sh, -1.6, 0.92), 0.5);
  }
  each(is("pupil"), (sh) => {
    pen.set("scream-crayon", C.contour, 1.3 * s);
    pen.circle(sh.c[0], sh.c[1], sh.r * 0.9, 0.2);
  });
  pen.flush();
  // 7. the bell: short bright strokes flick out from the handlebar
  const db = u - T_BELL;
  if (db >= 0 && db < 0.3) {
    const bell = find("bell");
    if (bell) {
      stage.reseed(13407);
      pen.reset();
      const out = 3 + 13 * smoothstep(0, 0.25, db); // the strokes fly outwards
      const len = 13 * (1 - smoothstep(0.12, 0.3, db)) + 3;
      for (let i = 0; i < 6; i += 1) {
        const a = -Math.PI * 1.02 + i * ((Math.PI * 0.95) / 5) + (hash(i, 13) - 0.5) * 0.22;
        const r0 = bell.r + out * (0.85 + 0.3 * hash(i, 17));
        const r1 = r0 + len * (0.8 + 0.4 * hash(i, 19));
        pen.set("scream-crayon", C.flick, 2.2 * s);
        pen.line(bell.c[0] + Math.cos(a) * r0, bell.c[1] + Math.sin(a) * r0, bell.c[0] + Math.cos(a) * r1, bell.c[1] + Math.sin(a) * r1);
      }
      pen.flush();
    }
  }
}

// ------------------------------------------------------------------ the scene
function shudder(u) {
  const d = u - T_TURN;
  if (d < 0 || d > 0.25) return [0, 0];
  const env = 1 - d / 0.25;
  return [1.8 * Math.sin(d * 95) * env, 0.9 * Math.sin(d * 140 + 1) * env];
}

/**
 * Where the bicycle's wheels cross the railing, the rails are a step lighter,
 * so the dark rims read against them. Drawn each frame over the baked rails,
 * on the same wavering lines, fading out at both ends of each crossing.
 */
const RAIL_LIGHT = [
  // centre line, hand seed, width, colour
  [653.0, 6, 3.6, "#b98a62"],
  [650.4, 9, 1.1, "#e6b47e"],
  [671.0, 7, 3.6, "#b98a62"],
  [668.8, 10, 0.9, "#e6b47e"],
  [689.0, 8, 3.6, "#b98a62"],
  [686.8, 11, 0.9, "#e6b47e"],
];

function paintRailBehindWheels(pen, stage, skel, shake) {
  stage.reseed(13409);
  pen.reset();
  for (const sh of skel.shapes) {
    if (sh.tag !== "tire") continue;
    const [cx, cy] = sh.c;
    const R = sh.r + 1.5;
    for (const [y, seed, w, col] of RAIL_LIGHT) {
      const dy = y + shake[1] - cy;
      if (Math.abs(dy) >= R - 1) continue;
      const half = Math.sqrt(R * R - dy * dy);
      const xa = cx - half - shake[0];
      const xb = cx + half - shake[0];
      const n = Math.max(4, Math.ceil((xb - xa) / 4));
      const line = railLine(xa, xb, y, 0.5, seed, (xb - xa) / n);
      const pts = line.map((p, i) => [p[0] + shake[0], p[1] + shake[1], 0.25 + 0.75 * Math.sin((i / (line.length - 1)) * Math.PI)]);
      pen.set("scream-chalk", col, w);
      pen.spline(pts, 0.5);
    }
  }
  pen.flush();
}

export const scream = {
  ...META,
  still: { u: 4.4 },

  init(stage) {
    // chalk or crayon dragged over board: dry, grainy, a little uneven
    defineBrush(stage, "scream-chalk", { type: "default", weight: 0.55, scatter: 0.55, sharpness: 0.55, grain: 2.6, opacity: 200, spacing: 0.05, pressure: [0.85, 1.1, 0.75], rotate: "natural", noise: 0.6 });
    // a harder crayon for contours: denser, wavering
    defineBrush(stage, "scream-crayon", { type: "default", weight: 0.42, scatter: 0.7, sharpness: 0.75, grain: 2.0, opacity: 225, spacing: 0.04, pressure: [1.0, 1.1, 0.7], rotate: "natural", noise: 0.45 });
    // everything the first frames need, made now so the entry does not stall
    stage.shader("scream/land", VERT, LAND_FRAG);
    stage.shader("scream/crayon", VERT, CRAYON_FRAG);
    titleSprite(stage);
    bakeRail(stage);
    bakeFigure(stage, "before");
    bakeFigure(stage, "jerk");
    bakeFigure(stage, "after");
  },

  render(stage, f) {
    const view = f.view;
    const u = f.u;
    const shake = shudder(u);

    stage.origin();
    stage.rect(0, 0, f.w, f.h, C.board);
    drawLand(stage, view, u, shake);

    const rail = bakeRail(stage);
    stage.withView(view, () => {
      stage.image(rail, RAIL.x0 + shake[0], RAIL.y0 + shake[1], RAIL.x1 - RAIL.x0, RAIL.y1 - RAIL.y0);
    });
    drawTitle(stage, view, shake);

    const pel = f.pelican;
    stage.seed(13400);
    if (pel.visible) {
      const skel = solveRig({ ...pel, act: { wind: 0.8 } });
      withPen(stage, view, (pen) => {
        paintRailBehindWheels(pen, stage, skel, shake);
        paintPelican(pen, stage, skel, u);
      });
    }

    // the passer-by: calm; then one held jerk (shoulders up, head half round); then the pose
    const d = u - T_TURN;
    const fig = bakeFigure(stage, d < 0 ? "before" : d < JERK_LEN ? "jerk" : "after");
    stage.withView(view, () => {
      stage.image(fig, FIG.x0, FIG.y0, FIG.x1 - FIG.x0, FIG.y1 - FIG.y0);
    });
  },
};
