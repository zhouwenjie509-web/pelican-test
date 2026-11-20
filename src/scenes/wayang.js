// Section 10. Javanese wayang kulit, c. 1800.
//
// We sit on the shadow side of a cotton screen lit from behind by an oil
// lamp: warm white at the hot spot, amber, then brown towards the ends. Ranks
// of pierced-hide puppets stand planted at both ends, overlapping like dark
// lace; among those on the right stands a great leaf-shaped tree of life.
// Across the open middle comes a puppet nobody has seen before: a pelican on
// a bicycle cut from hide, pierced with hundreds of holes and worked from
// below on three rods. Its wheels turn in stop-and-start steps.
//
// Bar 2: on the downbeat the puppet is drawn back towards the lamp and its
// shadow swells, softens and thins; on the strong beat it is slapped back
// onto the cloth, small and sharp, and a ripple runs out through the screen.
// Then the bill opens and shuts twice.
//
// Layers: the screen with its standing puppets and the title plaque is cut
// once into one baked layer. Per frame: the puppet is assembled from cached
// pierced pieces on a 2D canvas, multiplied onto the screen through a shader
// that gives it its warm penumbra (and its swell), then the lamp's flicker
// and the ripple are multiplied over everything.
//
// The standing puppets and the tree of life are newly designed in the manner
// of the tradition; no traditional character is reproduced.

import { sectionMeta } from "./sections.js";
import { Layer2D } from "../kit/stage.js";
import { sampler, hash, fbm2, noise1, wobble } from "../kit/rng.js";
import { VERT, FRAG_HEAD, rgb } from "../kit/glsl.js";
import { smoothOpen, smoothClosed } from "../kit/geom.js";
import { pelicanAt } from "../main/camera.js";
import { ROAD_Y, PX_PER_UNIT, ZOOM_IN, SPEED } from "../main/layout.js";
import { sectionStart } from "../beat/timeline.js";
import { clamp, lerp, smoothstep, easeInOutCubic, easeInQuad, easeOutQuad, window4 } from "../beat/ease.js";
import {
  TAU,
  add,
  sub,
  mul,
  len,
  norm,
  rot,
  dirOf,
  mix2,
  angOf,
  bbox,
  inPoly,
  deepIn,
  Solid,
  Spacer,
  HOLE,
  cutHoles,
  fillPoly,
  resample,
  edgeRow,
  lattice,
  ribbon,
  pelicanPieces,
  drawPuppet,
} from "../rig/skins/wayang.js";

const META = sectionMeta(10);

// ------------------------------------------------------------------ palette
const C = {
  hot: [255, 243, 202],
  warm: [255, 230, 165],
  amber: [240, 182, 90],
  deep: [206, 128, 50],
  brown: [122, 74, 30],
  dark: [64, 36, 15],
  shadow: "#1d120a",
};
// multiply factors (0..255) for a shadow and for its warm penumbra
const SHADOW_MUL = [27, 17, 10];
const WARM_MUL = [236, 150, 92];
// the swollen shadow, drawn back towards the lamp: a warm brown, not grey
const LOOM_MUL = [70, 36, 12];
// The standing puppets are planted in the trunk a finger's width off the
// cloth: their shadows are softer and about half as dense as the puppet being
// played, which is pressed flat against the screen. They are cut together into
// one mask first, so where they overlap the shade deepens only a little
// (RANK_ALPHA per figure) and never goes darker than RANK_MUL: the pelican
// is always the darkest, sharpest shape on the cloth.
const RANK_MUL = [142, 98, 66];
const RANK_WARM = [250, 224, 194];
const RANK_ALPHA = 0.66;
const RANK_SOFT = 0.42;

// the painted world
const SX0 = -70;
const SX1 = 1070;
const SY0 = 418;
const SY1 = 806;
const FEET_Y = ROAD_Y; // the standing puppets' feet rest on the road
const HEM = [ROAD_Y, ROAD_Y + 12]; // the ground strip: its top is the road
const TRUNK_Y = 762;

// ------------------------------------------------------------------ the cloth
const STOPS = [
  [0.0, C.hot],
  [0.2, C.warm],
  [0.44, C.amber],
  [0.7, C.deep],
  [0.96, C.brown],
  [1.3, C.dark],
];

function ramp(d) {
  if (d <= 0) return STOPS[0][1];
  for (let i = 1; i < STOPS.length; i += 1) {
    if (d <= STOPS[i][0]) {
      const a = STOPS[i - 1];
      const b = STOPS[i];
      const t = smoothstep(0, 1, (d - a[0]) / (b[0] - a[0]));
      return [lerp(a[1][0], b[1][0], t), lerp(a[1][1], b[1][1], t), lerp(a[1][2], b[1][2], t)];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

/** The lamp-lit cloth at a world point, before weave and stains. */
function clothAt(x, y) {
  const dx = (x - 500) / 545;
  const dy = (y - 512) / 320;
  let d = Math.sqrt(dx * dx + dy * dy);
  d += (fbm2(x / 70, y / 70, 3, 7) - 0.5) * 0.045 + (fbm2(x / 260, y / 160, 2, 9) - 0.5) * 0.1;
  let c = ramp(d);
  // soft vertical folds where the cloth hangs between its ties
  const fold = 0.975 + 0.025 * Math.sin(x / 31 + 2.6 * fbm2(x / 120, y / 300, 2, 3));
  let k = fold;
  // old water stains: soft patches with a faint darker tide line, and a
  // general mottling of the cotton
  const m = fbm2(x / 52 + 3.1, y / 40, 4, 21);
  const blot = smoothstep(0.67, 0.72, m);
  const tide = Math.exp(-(((m - 0.67) / 0.008) ** 2));
  k *= 1 - 0.04 * blot - 0.045 * tide;
  k *= 0.97 + 0.06 * fbm2(x / 9, y / 7, 3, 33);
  // smoke from the lamp has browned the cloth above the hot spot
  k *= 1 - 0.07 * Math.exp(-(((x - 505) / 70) ** 2) - (((y - 452) / 22) ** 2));
  // dimmer under the valance
  k *= 0.86 + 0.14 * smoothstep(444, 482, y);
  // below the hem the cloth goes on, dimmer and redder
  if (y > HEM[1]) {
    k *= 0.6;
    c = [c[0], c[1] * 0.9, c[2] * 0.82];
  }
  c = [c[0] * k, c[1] * k, c[2] * k];
  // the banana trunk's soft shadow rising from the bottom edge
  const top = TRUNK_Y + 4 * (noise1(x / 37, 4) - 0.5) + 3 * Math.sin(x / 61);
  const t = smoothstep(top - 6, top + 26, y);
  const trunk = [29, 18, 10];
  return [lerp(c[0], trunk[0], t), lerp(c[1], trunk[1], t), lerp(c[2], trunk[2], t)];
}

function paintCloth(ctx, kb, W, H) {
  // the low-frequency light, on a small canvas, enlarged smoothly
  const step = 4;
  const lw = Math.ceil(W / step) + 2;
  const lh = Math.ceil(H / step) + 2;
  const low = new Layer2D(stageRef.p, lw, lh);
  const img = low.ctx.createImageData(lw, lh);
  for (let j = 0; j < lh; j += 1) {
    for (let i = 0; i < lw; i += 1) {
      const x = SX0 + ((i - 0.5) * step) / kb;
      const y = SY0 + ((j - 0.5) * step) / kb;
      const c = clothAt(x, y);
      const o = (j * lw + i) * 4;
      img.data[o] = c[0];
      img.data[o + 1] = c[1];
      img.data[o + 2] = c[2];
      img.data[o + 3] = 255;
    }
  }
  low.ctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(low.canvas, 0, 0, lw, lh, -step * 0.5 + step * 0.5 - step, -step, lw * step, lh * step);
  ctx.restore();

  // the weave: warp and weft threads with slubs, faded where they would alias
  const sp = 1.2; // units per thread
  const lod = clamp((sp * kb - 2) / 2.4);
  const warp = new Float32Array(W);
  const weft = new Float32Array(H);
  const thread = (v, seed) => {
    const idx = Math.floor(v / sp);
    const f = v / sp - idx;
    const prof = Math.pow(Math.sin(Math.PI * f), 0.7);
    const slub = 0.75 + 0.5 * hash(idx, seed) + 0.35 * (noise1(idx * 0.21, seed + 5) - 0.5);
    return 1 - 0.15 * lod * (1 - prof) * slub;
  };
  // an occasional thick or thin weft thread runs right across the cloth
  const bar = (v) => {
    const idx = Math.floor(v / sp);
    const h = hash(idx, 41);
    if (h > 0.982) return 1 - lod * (0.022 + 0.018 * hash(idx, 42));
    if (h < 0.012) return 1 + 0.015 * lod;
    return 1;
  };
  for (let i = 0; i < W; i += 1) warp[i] = thread(SX0 + (i + 0.5) / kb, 11);
  for (let j = 0; j < H; j += 1) weft[j] = thread(SY0 + (j + 0.5) / kb, 12) * bar(SY0 + (j + 0.5) / kb);
  const data = ctx.getImageData(0, 0, W, H);
  const px = data.data;
  for (let j = 0; j < H; j += 1) {
    const wf = weft[j];
    const row = Math.floor((SY0 + (j + 0.5) / kb) / sp);
    for (let i = 0; i < W; i += 1) {
      const col = Math.floor((SX0 + (i + 0.5) / kb) / sp);
      const over = ((row + col) & 1) === 0 ? 1.012 : 0.988;
      const speck = hash(i, j, 77) > 0.9993 ? 0.82 : 1;
      const k = warp[i] * wf * (lod > 0 ? 1 + (over - 1) * lod : 1) * speck;
      const o = (j * W + i) * 4;
      px[o] *= k;
      px[o + 1] *= k;
      px[o + 2] *= k;
    }
  }
  ctx.putImageData(data, 0, 0);
}

/** The hem: a dark red band at the foot of the screen, the ground strip. */
function paintHem(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = "rgb(118,44,22)";
  ctx.fillRect(SX0, HEM[0], SX1 - SX0, HEM[1] - HEM[0]);
  ctx.fillStyle = "rgb(120,70,50)";
  ctx.fillRect(SX0, HEM[0], SX1 - SX0, 1.1);
  ctx.fillRect(SX0, HEM[1] - 1.1, SX1 - SX0, 1.1);
  // a woven border of lozenges, darker where the dye is thicker
  ctx.fillStyle = "rgb(150,100,80)";
  for (let x = SX0; x < SX1; x += 8) {
    ctx.beginPath();
    const m = (HEM[0] + HEM[1]) / 2;
    ctx.moveTo(x, m);
    ctx.lineTo(x + 4, m - 2.8);
    ctx.lineTo(x + 8, m);
    ctx.lineTo(x + 4, m + 2.8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** The valance across the top, with its line of gold. */
function paintValance(ctx) {
  ctx.save();
  const g = ctx.createLinearGradient(0, SY0, 0, 446);
  g.addColorStop(0, "#140b06");
  g.addColorStop(1, "#24150c");
  ctx.fillStyle = g;
  ctx.fillRect(SX0, SY0, SX1 - SX0, 441.6 - SY0);
  // soft pleats
  for (let x = SX0; x < SX1; x += 14) {
    const h = hash(Math.round(x), 3);
    ctx.fillStyle = `rgba(60,36,20,${0.12 + 0.18 * h})`;
    ctx.fillRect(x + 3, SY0, 4 + 3 * h, 441.6 - SY0);
  }
  const gold = ctx.createLinearGradient(0, 441.4, 0, 445.2);
  gold.addColorStop(0, "#6b4a17");
  gold.addColorStop(0.35, "#e6c167");
  gold.addColorStop(0.6, "#b98c33");
  gold.addColorStop(1, "#5a3c12");
  ctx.fillStyle = gold;
  ctx.fillRect(SX0, 441.4, SX1 - SX0, 3.8);
  ctx.fillStyle = "rgba(255,236,170,0.75)";
  for (let x = SX0 + 1; x < SX1; x += 3.2) {
    ctx.beginPath();
    ctx.arc(x, 443.1, 0.45, 0, TAU);
    ctx.fill();
  }
  // a fringe of small tassels hanging onto the cloth
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = "rgb(70,40,22)";
  for (let x = SX0; x < SX1; x += 4.6) {
    ctx.beginPath();
    ctx.moveTo(x - 1.1, 445.2);
    ctx.lineTo(x + 1.1, 445.2);
    ctx.lineTo(x + 0.25, 448.6 + hash(Math.round(x * 10), 8));
    ctx.lineTo(x - 0.25, 448.6 + hash(Math.round(x * 10), 8));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ standing puppets
// Templates in hundredths of the figure's height, feet at the origin, facing +x.
const T = {
  alus: {
    legs: [
      [[1.5, -30], [5.4, -30], [6.0, -19], [6.6, -8], [7.4, -3.8], [11, -2.4], [16, -1.2], [19.5, -0.1], [19, 0.4], [3.6, 0.4], [3.2, -3], [2.9, -9], [2.4, -19]],
      [[-6.6, -30], [-2.4, -30], [-2.8, -19], [-3.4, -9], [-3.2, -3.4], [0.2, -1.6], [2.6, 0.4], [-12, 0.4], [-11.6, -0.6], [-8, -3.2], [-7.6, -9], [-7.2, -19]],
    ],
    skirt: [[-5.0, -51], [5.0, -51], [6.0, -44], [7.2, -36], [8.4, -30], [2.0, -28.6], [-4, -29], [-9, -30.4], [-15.5, -27], [-12.6, -33], [-9, -40], [-6.4, -46]],
    drape: [[1.2, -50], [4.4, -49.4], [5.4, -40], [6.2, -30], [7.0, -20], [8.6, -12], [12.4, -7.4], [13.4, -9.6], [10.8, -10.2], [8.6, -8], [5.2, -11], [3.4, -20], [2.4, -32], [1.6, -42]],
    torso: [[-4.8, -50], [4.8, -50], [5.4, -55], [6.4, -60], [8.8, -63.6], [10.4, -66.2], [8.4, -68.8], [3.2, -69.8], [-3.0, -69.8], [-8.2, -69.0], [-10.2, -66.4], [-9.0, -63.4], [-6.6, -59.6], [-5.4, -55]],
    neck: [[-1.6, -69.2], [2.4, -69.2], [2.9, -74], [-0.8, -75]],
    head: [[-3.2, -80], [-2.4, -75], [0.2, -73.4], [3.0, -73.4], [4.2, -74.0], [5.2, -73.8], [13.6, -75.6], [13.0, -76.4], [6.2, -80.4], [4.8, -82.8], [0.4, -83.8], [-2.8, -82.4]],
    crown: [[-3.4, -81.4], [5.0, -83.2], [4.6, -86.6], [2.8, -89.6], [0.4, -91.8], [-2.6, -93.6], [-5.4, -94.6], [-8.2, -94.0], [-9.8, -91.8], [-9.4, -89.0], [-7.6, -87.6], [-7.0, -85.4]],
    curl: { c: [-7.4, -91.2], r: 2.6, w: 1.6 },
    plume: [[-2.6, -82], [-8, -84.4], [-13.4, -83.6], [-10.6, -81], [-14, -78.6], [-9.8, -77.8], [-12, -74.6], [-6.4, -76.2], [-2.6, -77.4]],
    eye: [6.0, -78.4, 3.4, 0.8, -0.12],
    nearArm: [[8.8, -66], [12.6, -59], [15.0, -51.5], [18.6, -44.5], [21.6, -37.5]],
    farArm: [[-8.6, -66], [-11.6, -58.5], [-13.0, -51], [-12.6, -43.5], [-10.8, -36.5]],
    armW: [2.6, 2.0, 1.4],
  },
  gagah: {
    legs: [
      [[3, -35], [8.2, -35], [11.6, -25], [15.2, -13.6], [17.6, -5], [21.4, -2.6], [27.4, -1.2], [29.6, 0.4], [13.8, 0.4], [13.6, -3.6], [11.8, -13], [8.6, -23.5], [4.2, -30.5]],
      [[-8.4, -35], [-3.2, -35], [-4.8, -26], [-8.0, -14.6], [-10.0, -4.2], [-7.4, -2], [-5.4, 0.4], [-20.6, 0.4], [-20, -0.8], [-15, -3.6], [-13.4, -13.2], [-11, -25]],
    ],
    skirt: [[-7, -52], [7, -52], [9, -45], [11.4, -37.6], [4, -34.4], [-4, -34.2], [-10.8, -35], [-17, -31.6], [-14, -38.4], [-9.6, -46]],
    drape: [[2, -50], [6, -49.5], [8, -40], [9.4, -31], [13.4, -25.6], [10.2, -24.4], [6, -30.4], [3, -41]],
    sash: [[-6, -48.6], [-9, -48], [-15.4, -37], [-19.8, -25], [-21.6, -15], [-18.8, -16.4], [-15, -24.6], [-10.6, -35], [-6.4, -42.6]],
    torso: [[-7, -50.5], [7, -50.5], [7.6, -56], [9.6, -61], [13.4, -64.6], [14.6, -67.6], [11.4, -70.6], [4.2, -71.6], [-4.2, -71.6], [-11.4, -70.8], [-14.4, -67.8], [-13.2, -64.4], [-9.8, -60.4], [-7.6, -55.6]],
    neck: [[-2.6, -70.6], [2.8, -70.6], [3.6, -75], [-1.6, -76]],
    head: [[-4, -81], [-3.2, -75.6], [-0.6, -73.4], [3.4, -73.0], [6.2, -74.0], [7.8, -74.8], [10.4, -75.6], [11.6, -77.6], [10.6, -79.2], [8.4, -79.4], [6.8, -81.6], [5.6, -84.4], [0.6, -85.4], [-3.2, -83.6]],
    crown: [[-4.4, -82.2], [6.0, -84.6], [6.4, -87.6], [5.4, -89], [6.2, -91.4], [4.8, -95.4], [2.4, -98.4], [-0.6, -99.8], [-3.6, -99.2], [-6.0, -96.4], [-7.0, -92.4], [-6.8, -88.4], [-5.8, -84.8]],
    curl: { c: [-9.4, -90.4], r: 3.8, w: 2.4 },
    plume: [[-3.6, -82.6], [-9.6, -85.4], [-15.6, -84.6], [-12.4, -81.8], [-16.4, -79.4], [-11.6, -78.4], [-14.0, -75.0], [-7.6, -76.6], [-3.4, -78.0]],
    eye: [6.2, -79.4, 2.4, 1.6, 0],
    nearArm: [[13.0, -66.8], [17.0, -59], [19.4, -51.5], [21.0, -44], [19.8, -36.5]],
    farArm: [[-12.8, -66.6], [-16.6, -59], [-18.6, -51.5], [-18.0, -44], [-15.6, -37]],
    armW: [3.4, 2.6, 1.9],
  },
  putri: {
    legs: [],
    skirt: [[-4.4, -49], [4.4, -49], [5.6, -40], [6.6, -28], [7.4, -14], [8.2, -4], [9.6, -1.4], [13, -0.2], [12.8, 0.4], [-10.4, 0.4], [-7.6, -2.6], [-6.6, -12], [-6.0, -26], [-5.6, -38]],
    drape: [[1, -48], [3.6, -47.6], [4.4, -38], [5.2, -26], [7.2, -18], [4.2, -17.6], [2.8, -26], [1.6, -38]],
    sash: [[-4, -46], [-6, -45], [-10, -36], [-12.6, -26], [-13.4, -19], [-11.4, -20.4], [-9.4, -27], [-6.6, -36], [-4.2, -41]],
    torso: [[-4.4, -48], [4.2, -48], [4.4, -53], [5.6, -58], [7.8, -62], [8.4, -64.6], [6.2, -66.8], [2.4, -67.4], [-2.4, -67.4], [-6.4, -66.8], [-8.4, -64.6], [-7.8, -62], [-5.6, -58], [-4.6, -53]],
    neck: [[-1.4, -66.6], [2.0, -66.6], [2.8, -71], [-0.6, -71.8]],
    head: [[-3, -76.6], [-2.2, -71.8], [0.2, -70.4], [3.2, -70.6], [4.2, -71.6], [5.0, -71.4], [10.4, -73.6], [9.8, -74.4], [5.2, -77.6], [3.8, -80.0], [0, -80.8], [-2.6, -79.4]],
    crown: [[-2.8, -79.2], [4.0, -80.0], [3.4, -82.6], [1.2, -84.6], [-1.6, -84.2], [-3.6, -81.8]],
    bun: { c: [-5.8, -77.4], r: 3.6 },
    hair: [[-4.6, -75.6], [-7.0, -71], [-8.6, -66], [-9.4, -60]],
    eye: [4.6, -75.6, 2.8, 0.75, -0.2],
    nearArm: [[6.8, -64.2], [10.0, -57], [11.8, -50], [14.6, -44], [16.6, -38]],
    farArm: [[-6.6, -64], [-9.2, -57], [-10.2, -50], [-9.4, -43], [-7.6, -37]],
    armW: [2.2, 1.7, 1.2],
  },
};

const SKIRT_PATTERNS = ["parang", "kawung", "chevrons", "scales", "lattice", "teardrops", "dots"];

function spiralRibbon(c, r, w, turns = 1.45, start = -0.6) {
  const line = [];
  for (let i = 0; i <= 22; i += 1) {
    const s = i / 22;
    const a = start - s * turns * TAU * 0.55;
    const rr = r * (1 - 0.7 * s);
    line.push(add(c, [Math.cos(a) * rr, Math.sin(a) * rr]));
  }
  return { line, poly: ribbon(line, w, w * 0.3) };
}

/** A hand with long pointed fingers at the end of a forearm. */
function handPoly(wrist, dir, size) {
  const a = angOf(dir) - 0.35;
  const P = (x, y) => add(wrist, rot([x * size, y * size], a));
  return [P(-0.3, -0.5), P(1.2, -0.7), P(2.8, -0.35), P(3.6, -0.05), P(2.6, 0.15), P(3.0, 0.55), P(1.9, 0.5), P(1.0, 0.75), P(0.0, 0.55)];
}

/** Build a standing figure in world units (local: feet at 0, facing +x). */
function buildFigure(type, H, seed) {
  const t = T[type];
  const r = sampler(seed);
  const sc = H / 100;
  // some puppets are cut broader, some slighter
  const sxk = sc * r.range(0.9, 1.12);
  const S = (pts) => pts.map((p) => [p[0] * sxk, p[1] * sc]);
  const parts = {};
  // stance: some stand with their feet planted wide, some close
  const spread = r.range(0.8, 1.3);
  parts.legs = t.legs.map((l) => smoothClosed(S(l.map((q) => [q[0] * lerp(spread, 1, clamp((-q[1] - 20) / 15)), q[1]])), 3));
  parts.skirt = smoothClosed(S(t.skirt), 3);
  parts.drape = smoothClosed(S(t.drape), 3);
  if (t.sash) parts.sash = smoothClosed(S(t.sash), 3);
  parts.torso = smoothClosed(S(t.torso), 3);
  parts.neck = S(t.neck);
  parts.head = smoothClosed(S(t.head), 3);
  // headdress height varies a little from puppet to puppet
  const lift = 1 + r.range(-0.12, 0.3);
  if (t.plume) {
    // the plume at the back of the headdress: long and swept, or short
    const pk = r.range(0.75, 1.45);
    const root = t.plume[0];
    parts.plume = smoothClosed(S(t.plume.map((q) => [root[0] + (q[0] - root[0]) * pk, root[1] + (q[1] - root[1]) * (0.8 + 0.2 * pk)])), 3);
  }
  if (t.hair) parts.hair = ribbon(smoothOpen(S(t.hair), 4), 2.6 * sc, 0.5 * sc, false);
  const crownBase = t.crown[0][1];
  parts.crown = smoothClosed(S(t.crown.map((p) => [p[0], crownBase + (p[1] - crownBase) * lift])), 3);
  if (t.curl) {
    const cc = [t.curl.c[0], crownBase + (t.curl.c[1] - crownBase) * lift];
    parts.curl = spiralRibbon(mul(cc, sc), t.curl.r * sc, t.curl.w * sc);
  }
  // a crown is cut, not moulded: a comb of small flames along its upper edge
  parts.teeth = [];
  resample(parts.crown, 2.1 * Math.max(1, sc * 0.55)).forEach(({ p, t: tg }, i) => {
    let n = [-tg[1], tg[0]];
    if (inPoly(add(p, mul(n, 0.8)), parts.crown)) n = mul(n, -1);
    if (n[1] > -0.45) return;
    const h = (1.5 + 0.7 * (i % 2)) * Math.max(1, sc * 0.5);
    const lean = mul(tg, Math.sign(-tg[0] || 1) * 0.5);
    parts.teeth.push([add(p, mul(tg, -0.95)), add(add(p, mul(n, h)), lean), add(p, mul(tg, 0.95))]);
  });
  if (t.bun) parts.bun =Array.from({ length: 24 }, (_, i) => add(mul(t.bun.c, sc), mul(dirOf((i / 24) * TAU), t.bun.r * sc)));
  // ear pendant
  const ear = mul([-1.2, t.head[0][1] + 1.2], sc);
  parts.ear = ribbon([ear, add(ear, [-0.8 * sc, 3 * sc]), add(ear, [-1.6 * sc, 6.5 * sc])], 1.7 * sc, 0.3 * sc, false);
  // arms: upper arm and forearm pinned at the elbow, a hand at the end
  const arm = (pts, w) => {
    // each puppet's arms hang a little differently
    const swing = r.range(-0.12, 0.12);
    const bend = r.range(-0.1, 0.14);
    const P0 = S(pts);
    const P = P0.map((p, i) => {
      let q = i ? add(P0[0], rot(sub(p, P0[0]), swing)) : p;
      if (i > 2) {
        const el = add(P0[0], rot(sub(P0[2], P0[0]), swing));
        q = add(el, rot(sub(q, el), bend));
      }
      return q;
    });
    const upper = ribbon(smoothOpen(P.slice(0, 3), 4), w[0] * sc, w[1] * sc, false);
    const fore = ribbon(smoothOpen(P.slice(2), 4), w[1] * sc, w[2] * sc, false);
    const hand = handPoly(P[4], sub(P[4], P[3]), 1.25 * sc);
    return { upper, fore, hand, elbow: P[2], wrist: P[4], shoulder: P[0], line: P };
  };
  // the near arm: hanging, held forward as if speaking, or a fist on the hip
  const gesture = ["hang", "forward", "hang", "hip"][seed % 4];
  let near = t.nearArm;
  if (gesture !== "hang") {
    const sh = near[0];
    const ua = Math.hypot(near[2][0] - sh[0], near[2][1] - sh[1]);
    const fa = Math.hypot(near[4][0] - near[2][0], near[4][1] - near[2][1]);
    const elA = gesture === "forward" ? 1.25 : 0.95;
    const wrA = gesture === "forward" ? -0.12 : 2.6;
    const el = [sh[0] + Math.cos(elA) * ua, sh[1] + Math.sin(elA) * ua];
    const wr = [el[0] + Math.cos(wrA) * fa * (gesture === "hip" ? 0.7 : 1), el[1] + Math.sin(wrA) * fa * (gesture === "hip" ? 0.7 : 1)];
    near = [sh, mix2(sh, el, 0.5), el, mix2(el, wr, 0.5), wr];
  }
  parts.gesture = gesture;
  parts.nearArm = arm(near, t.armW);
  parts.farArm = arm(t.farArm, t.armW);
  const polys = [
    ...parts.legs,
    parts.skirt,
    parts.drape,
    ...(parts.sash ? [parts.sash] : []),
    parts.torso,
    parts.neck,
    parts.head,
    parts.crown,
    ...parts.teeth,
    parts.ear,
    ...(parts.curl ? [parts.curl.poly] : []),
    ...(parts.bun ? [parts.bun] : []),
    ...(parts.plume ? [parts.plume] : []),
    ...(parts.hair ? [parts.hair] : []),
    parts.nearArm.upper,
    parts.nearArm.fore,
    parts.nearArm.hand,
    parts.farArm.upper,
    parts.farArm.fore,
    parts.farArm.hand,
  ];
  return { type, t, sc, H, parts, polys, seed, pattern: SKIRT_PATTERNS[seed % SKIRT_PATTERNS.length], r };
}

function fieldHoles(sol, region, margin, holes, sp, pattern, origin) {
  const box = bbox(region);
  const P = {
    parang: { ang: -0.78, dx: 3.1, dy: 2.0, draw: (c, q) => HOLE.lens(c, q[0], q[1], -0.78 + 1.57, 2.6, 0.62), gap: 1.6 },
    kawung: {
      ang: 0,
      dx: 4.4,
      dy: 4.4,
      draw: (c, q) => {
        HOLE.dot(c, q[0], q[1], 0.36);
        for (let i = 0; i < 4; i += 1) {
          const a = Math.PI / 4 + (i * Math.PI) / 2;
          const p = add(q, mul(dirOf(a), 1.15));
          c.moveTo(p[0], p[1]);
          HOLE.lens(c, p[0], p[1], a, 1.7, 0.95);
        }
      },
      gap: 3.4,
    },
    dots: { ang: 0, dx: 2.2, dy: 1.95, draw: (c, q) => HOLE.dot(c, q[0], q[1], 0.42), gap: 1.6 },
    scales: { ang: 0, dx: 2.7, dy: 2.0, draw: (c, q) => HOLE.scale(c, q[0], q[1], 1.15, -Math.PI / 2, 0.42), gap: 1.9 },
    lattice: { ang: 0.0, dx: 2.4, dy: 2.4, draw: (c, q) => HOLE.diamond(c, q[0], q[1], 0.95, 0.62, 0), gap: 1.7 },
    pleats: { ang: 0, dx: 1.85, dy: 4.4, draw: (c, q) => HOLE.lens(c, q[0], q[1], Math.PI / 2 - 0.1, 2.4 + 2.4 * hash(Math.round(q[0] * 7), Math.round(q[1] * 3), 5), 0.6), gap: 1.4 },
    slits: { ang: 0, dx: 2.0, dy: 6.2, draw: (c, q) => HOLE.lens(c, q[0], q[1], Math.PI / 2, 3.0 + 2.6 * hash(Math.round(q[0] * 5), Math.round(q[1]), 9), 0.66), gap: 1.5 },
    chevrons: {
      ang: 0,
      dx: 3.4,
      dy: 2.3,
      draw: (c, q) => {
        c.moveTo(q[0] - 1.25, q[1] + 0.2);
        c.lineTo(q[0], q[1] - 0.95);
        c.lineTo(q[0] + 1.25, q[1] + 0.2);
        c.lineTo(q[0] + 1.25, q[1] + 0.85);
        c.lineTo(q[0], q[1] - 0.3);
        c.lineTo(q[0] - 1.25, q[1] + 0.85);
        c.closePath();
      },
      gap: 2.2,
    },
    teardrops: { ang: 0, dx: 3.0, dy: 2.6, draw: (c, q) => HOLE.comma(c, q[0], q[1], 0.55, -Math.PI / 2, 0.25), gap: 2.1 },
    fine: { ang: 0, dx: 1.6, dy: 1.45, draw: (c, q) => HOLE.dot(c, q[0], q[1], 0.3), gap: 1.2 },
    rosettes: {
      ang: 0,
      dx: 5.2,
      dy: 4.6,
      draw: (c, q) => {
        HOLE.dot(c, q[0], q[1], 0.4);
        for (let i = 0; i < 6; i += 1) {
          const a = (i / 6) * TAU;
          const p = add(q, mul(dirOf(a), 1.3));
          c.moveTo(p[0], p[1]);
          HOLE.lens(c, p[0], p[1], a, 1.3, 0.55);
        }
      },
      gap: 4,
    },
  }[pattern];
  lattice(box, { ang: P.ang, dx: P.dx, dy: P.dy, stagger: 0.5, origin: origin || [box[0], box[1]] }, (q) => {
    if (!deepIn(q, region, margin * 0.7, 8) || !sol.deep(q, margin)) return;
    if (!sp.free(q, P.gap)) return;
    sp.add(q, P.gap * 0.5);
    holes.push((c) => P.draw(c, q));
  });
}

/** Cut a standing figure into ctx (local units), with its rods. */
function cutFigure(ctx, fig) {
  const { parts, sc, t } = fig;
  const sol = new Solid();
  fig.polys.forEach((p) => sol.poly(p));
  // eye: an almond cut-out
  const [ex, ey, el, ew, ea] = t.eye;
  const eye = [ex * sc, ey * sc];
  const almond = [];
  for (let i = 0; i <= 12; i += 1) {
    const s = i / 12;
    almond.push(add(eye, rot([(s - 0.5) * el * sc, -0.5 * ew * sc * Math.sin(Math.PI * s) ** 0.8], ea)));
  }
  for (let i = 11; i >= 1; i -= 1) {
    const s = i / 12;
    almond.push(add(eye, rot([(s - 0.5) * el * sc, 0.32 * ew * sc * Math.sin(Math.PI * s)], ea)));
  }
  sol.hole(almond);

  ctx.fillStyle = "#000";
  fig.polys.forEach((p) => fillPoly(ctx, p));

  const holes = [];
  const sp = new Spacer(2);
  sp.add(eye, el * sc * 0.6 + 0.8);
  // the outer row: each carver's dots a little different in size and pitch
  const er = fig.r.range(0.36, 0.54);
  edgeRow(sol, fig.polys, holes, sp, { inset: 1.15 + er, spacing: 1.5 + er * 1.4, r: er });

  // the cloth: a batik field on the skirt, pleats on the front fold
  fieldHoles(sol, parts.skirt, 2.3, holes, sp, fig.pattern, [0, -40 * sc]);
  fieldHoles(sol, parts.drape, 1.6, holes, sp, fig.seed % 2 ? "pleats" : "slits", [3 * sc, -30 * sc]);
  if (parts.sash) fieldHoles(sol, parts.sash, 1.5, holes, sp, "dots", [-10 * sc, -30 * sc]);
  // the chest: a necklace, a jewel, scales below
  const nk = [];
  const shoulderL = parts.farArm.shoulder;
  const shoulderR = parts.nearArm.shoulder;
  for (let i = 0; i <= 14; i += 1) {
    const s = i / 14;
    const p = mix2(add(shoulderL, [2.2 * sc, -1.2 * sc]), add(shoulderR, [-2.2 * sc, -1.2 * sc]), s);
    nk.push(add(p, [0, Math.sin(Math.PI * s) * 4.2 * sc]));
  }
  resample(nk, 1.7, false).forEach(({ p }) => {
    if (!sol.deep(p, 0.95) || !sp.free(p, 1.3)) return;
    sp.add(p, 0.8);
    holes.push((c) => HOLE.dot(c, p[0], p[1], 0.48));
  });
  const jewel = add(nk[7], [0, 2.6 * sc]);
  if (sol.deep(jewel, 2.4)) {
    sp.add(jewel, 2.6);
    holes.push((c) => HOLE.dot(c, jewel[0], jewel[1], 0.55));
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * TAU;
      const q = add(jewel, mul(dirOf(a), 1.5));
      holes.push((c) => HOLE.lens(c, q[0], q[1], a, 1.2, 0.5));
    }
  }
  // an inner contour of dots round the chest, a belt, and a few rosettes
  edgeRow(sol, [parts.torso], holes, sp, { inset: 3.1, spacing: 1.75, r: 0.36, far: 99 });
  fieldHoles(sol, parts.torso, 4.6, holes, sp, ["rosettes", "teardrops", "fine"][fig.seed % 3], [0, -58 * sc]);
  {
    const y = -50.6 * sc;
    for (let x = -5 * sc; x <= 5 * sc; x += 1.6) {
      const q = [x, y];
      if (sol.deep(q, 0.9) && sp.free(q, 1.2)) {
        sp.add(q, 0.7);
        holes.push((c) => HOLE.diamond(c, q[0], q[1], 0.6, 0.45));
      }
    }
  }
  // the headdress: rows of scales, a jewel at the brow
  edgeRow(sol, [parts.crown], holes, sp, { inset: 2.6, spacing: 1.6, r: 0.34, far: 99 });
  // crowns: lattice on some, scales on others
  fieldHoles(sol, parts.crown, 3.0, holes, sp, fig.seed % 3 === 1 ? "scales" : "lattice", [0, -90 * sc]);
  if (parts.curl) {
    resample(parts.curl.line, 1.6, false).forEach(({ p }, i) => {
      if (i < 1 || !sol.deep(p, 0.75) || !sp.free(p, 1.2)) return;
      sp.add(p, 0.8);
      holes.push((c) => HOLE.dot(c, p[0], p[1], 0.36));
    });
  }
  if (parts.bun) fieldHoles(sol, parts.bun, 1.2, holes, sp, "dots", mul(t.bun.c, sc));
  // arms: dots down their length, bands at the upper arm and wrist
  for (const a of [parts.nearArm, parts.farArm]) {
    for (const seg of [a.line.slice(0, 3), a.line.slice(2)]) {
      resample(smoothOpen(seg, 4), 1.9, false).forEach(({ p }) => {
        if (!sol.deep(p, 0.82) || !sp.free(p, 1.4)) return;
        sp.add(p, 0.7);
        holes.push((c) => HOLE.dot(c, p[0], p[1], 0.34));
      });
    }
  }
  // legs: a line of dots down each
  for (const l of parts.legs) {
    const top = mix2(l[0], l[1], 0.5);
    const ank = mix2(l[Math.floor(l.length * 0.25)], l[Math.floor(l.length * 0.8)], 0.5);
    resample([top, ank], 2.0, false).forEach(({ p }) => {
      if (!sol.deep(p, 0.85) || !sp.free(p, 1.5)) return;
      sp.add(p, 0.8);
      holes.push((c) => HOLE.dot(c, p[0], p[1], 0.36));
    });
  }
  // the face: brow and mouth slits
  const brow = add(eye, rot([-0.2 * sc, -1.5 * sc], ea));
  holes.push((c) => HOLE.lens(c, brow[0], brow[1], ea - 0.3, el * sc * 1.1, 0.5));
  cutHoles(ctx, holes);
  cutHoles(ctx, [(c) => {
    c.moveTo(almond[0][0], almond[0][1]);
    almond.forEach((p) => c.lineTo(p[0], p[1]));
    c.closePath();
  }]);
  // a pin at each elbow
  for (const a of [parts.nearArm, parts.farArm]) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(a.elbow[0], a.elbow[1], 0.95, 0, TAU);
    ctx.arc(a.elbow[0], a.elbow[1], 0.5, 0, TAU, true);
    ctx.fill();
    ctx.restore();
  }

  // rods: the split-horn centre rod down through the figure into the trunk,
  // and a thin rod from each hand
  const top = parts.crown.reduce((m, p) => (p[1] < m[1] ? p : m), parts.crown[0]);
  const bottom = 806 - FEET_Y;
  ctx.fillStyle = "#000";
  // horn and bamboo rods: tapering, and never quite straight
  const rodLine = (a, b, w0, w1) => {
    const d = norm(sub(b, a));
    const n = [-d[1], d[0]];
    const bow = fig.r.range(-1, 1) * 0.012 * len(sub(b, a));
    const L = [];
    const R = [];
    for (let i = 0; i <= 12; i += 1) {
      const t = i / 12;
      const c = add(mix2(a, b, t), mul(n, bow * Math.sin(Math.PI * t)));
      const w = lerp(w0, w1, t) * (1 + 0.12 * Math.sin(t * 9 + fig.seed)) * 0.5;
      L.push(add(c, mul(n, w)));
      R.push(sub(c, mul(n, w)));
    }
    fillPoly(ctx, L.concat(R.reverse()));
  };
  rodLine([top[0] * 0.3, top[1] + 3], [0.4, bottom], 1.5, 2.6);
  const rr = fig.r;
  for (const a of [parts.nearArm, parts.farArm]) {
    const h = add(a.wrist, mul(norm(sub(a.wrist, a.line[3])), 2.2 * sc));
    rodLine(h, [h[0] + rr.range(4, 16) * (a === parts.nearArm ? 1 : -0.4), bottom], 0.8, 1.2);
  }
}

// ------------------------------------------------------------------ the tree of life
function buildTree(H, W) {
  // the leaf outline, right side from the base to the tip, leaning a little
  const right = [
    [26, -44],
    [42, -58],
    [54, -80],
    [60, -108],
    [59, -138],
    [53, -166],
    [44, -192],
    [32, -214],
    [20, -232],
    [9, -243],
    [2, -H],
  ];
  const sx = W / 120;
  const lean = (p) => [p[0] * sx + 0.0002 * p[1] * p[1] * 0.4, p[1]];
  const rs = smoothOpen(right.map(lean), 5);
  const ls = smoothOpen(right.map((p) => lean([-p[0], p[1]])), 5);
  const leaf = rs.concat(ls.slice(0, -1).reverse());
  // the gate pavilion at the base
  const gate = [
    [-30, 0],
    [30, 0],
    [30, -26],
    [36, -30],
    [36, -34],
    [26, -38],
    [26, -44],
    [-26, -44],
    [-26, -38],
    [-36, -34],
    [-36, -30],
    [-30, -26],
  ];
  return { leaf, gate, rs, ls };
}

function cutTree(ctx, H, W) {
  const tr = buildTree(H, W);
  const sol = new Solid().poly(tr.leaf).poly(tr.gate);
  ctx.fillStyle = "#000";
  fillPoly(ctx, tr.leaf);
  fillPoly(ctx, tr.gate);
  // flame tongues all along the leaf's edge
  const flames = [];
  const edge = resample(tr.rs.concat(tr.ls.slice().reverse()), 6.4, false);
  edge.forEach(({ p, t }, i) => {
    if (p[1] > -52) return;
    let n = [t[1], -t[0]];
    if (n[0] * p[0] < 0 && Math.abs(p[0]) > 4) n = mul(n, -1);
    const up = norm(add(n, [0, -0.7]));
    const tip = add(p, mul(up, 4.6 + 1.2 * (i % 2)));
    const b0 = add(p, mul(t, -2.7));
    const b1 = add(p, mul(t, 2.7));
    const mid = add(mix2(p, tip, 0.55), mul(t, 1.2));
    const fl = smoothOpen([b0, mid, tip], 4).concat([b1]);
    flames.push(fl);
  });
  flames.forEach((f) => {
    fillPoly(ctx, f);
    sol.poly(f);
  });
  // open the field inside a border band
  const inner = [];
  const ring = resample(tr.leaf, 2.5);
  for (const { p, t } of ring) {
    let n = [-t[1], t[0]];
    const q = add(p, mul(n, 7.5));
    const q2 = add(p, mul(n, -7.5));
    const pick = inPoly(q, tr.leaf) ? q : q2;
    if (pick[1] < -50) inner.push(pick);
  }
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  fillPoly(ctx, inner);
  ctx.restore();
  // the tree inside it, standing in the openwork
  const motif = new Solid();
  const solidPoly = (pts) => {
    fillPoly(ctx, pts);
    motif.poly(pts);
  };
  const trunkLine = smoothOpen([[0, -46], [1.5, -90], [-1.2, -140], [1.0, -185], [0, -H + 34]], 6);
  solidPoly(ribbon(trunkLine, 8.5, 2.6));
  const leaves = [];
  for (let i = 0; i < 6; i += 1) {
    const y = -78 - i * 25.5;
    const reach = (i < 2 ? 46 : 52 - (i - 2) * 9.5) * (W / 120);
    for (const sgn of [1, -1]) {
      const base = [sgn * 1.5, y];
      const b1 = [sgn * reach * 0.45, y - 14];
      const b2 = [sgn * reach * 0.85, y - 6];
      const tip = [sgn * reach * 0.78, y + 6];
      const line = smoothOpen([base, b1, b2, tip], 6);
      const c = add(tip, [-sgn * 3.2, -2.4]);
      const curl = [];
      for (let k = 0; k <= 14; k += 1) {
        const s = k / 14;
        const a = (sgn > 0 ? Math.PI * 0.1 : Math.PI * 0.9) + sgn * s * 4.4;
        curl.push(add(c, mul(dirOf(a), 3.6 * (1 - 0.6 * s))));
      }
      solidPoly(ribbon(line.concat(curl.slice(1)), 3.4 - i * 0.2, 1.0));
      // leaves along the branch
      for (const s of [0.35, 0.62]) {
        const k = Math.floor(s * (line.length - 1));
        const p = line[k];
        const d = norm(sub(line[k + 1], line[k]));
        const a = angOf(d) - sgn * 0.9;
        const lp = add(p, mul(dirOf(a), 4.2));
        leaves.push([lp, a]);
      }
    }
  }
  leaves.forEach(([p, a]) => {
    const pts = [];
    for (let k = 0; k <= 10; k += 1) {
      const s = k / 10;
      pts.push(add(p, rot([(s - 0.5) * 8.4, -1.9 * Math.sin(Math.PI * s)], a)));
    }
    for (let k = 9; k >= 1; k -= 1) {
      const s = k / 10;
      pts.push(add(p, rot([(s - 0.5) * 8.4, 1.9 * Math.sin(Math.PI * s)], a)));
    }
    solidPoly(pts);
  });
  // two small birds on the second branches, beak to beak
  for (const sgn of [1, -1]) {
    const b = [sgn * 21, -136];
    const P = (x, y) => [b[0] + sgn * x, b[1] + y];
    solidPoly(smoothClosed([P(6, -4), P(2, -6.5), P(-3, -5), P(-9, -9), P(-7, -3), P(-3, 0), P(3, 0.5), P(7.5, -2)], 3));
    solidPoly([P(6.5, -4.6), P(13.5, -4.2), P(6.8, -2.6)]);
  }
  // waves at the foot of the tree, above the gate
  for (let k = -4; k <= 4; k += 1) {
    const c = [k * 6.8, -52];
    if (!inPoly(c, tr.leaf)) continue;
    const pts = [];
    for (let i = 0; i <= 12; i += 1) {
      const a = Math.PI + (i / 12) * 4.4;
      pts.push(add(c, mul(dirOf(a), 3.2 * (1 - 0.45 * (i / 12)))));
    }
    solidPoly(ribbon(pts, 2.2, 0.8));
  }
  ctx.fillRect(-46, -50, 92, 3.2);
  motif.poly([[-46, -50], [46, -50], [46, -46.8], [-46, -46.8]]);

  // piercing: dots in the border band and on every flame; the gate's doors
  const holes = [];
  const sp = new Spacer(2);
  edgeRow(sol, [tr.leaf], holes, sp, { inset: 2.6, spacing: 2.2, r: 0.55, far: 2.0 });
  edgeRow(sol, [tr.leaf], holes, sp, { inset: 5.0, spacing: 2.4, r: 0.4, far: 1.4 });
  flames.forEach((f) => {
    const c = mix2(f[0], f[f.length - 1], 0.5);
    const tip = f[Math.floor(f.length * 0.7)];
    const q = mix2(c, tip, 0.35);
    holes.push((x) => HOLE.dot(x, q[0], q[1], 0.5));
  });
  resample(trunkLine, 2.6, false).forEach(({ p }, i) => {
    if (i < 1 || !motif.deep(p, 1.2)) return;
    holes.push((x) => HOLE.dot(x, p[0], p[1], 0.45));
  });
  // gate: two doors of lattice, tiers of dots on the roof
  for (const sgn of [1, -1]) {
    const door = [[sgn * 3, -3], [sgn * 18, -3], [sgn * 18, -23], [sgn * 3, -23]];
    lattice(bbox(door), { dx: 2.6, dy: 2.6, stagger: 0.5, origin: [0, -3] }, (q) => {
      if (!deepIn(q, door, 1.1, 6)) return;
      holes.push((x) => HOLE.diamond(x, q[0], q[1], 0.9, 0.9));
    });
    for (let k = 0; k < 6; k += 1) {
      const q = [sgn * (24 + (k % 2) * 2.5), -4 - k * 3.6];
      holes.push((x) => HOLE.dot(x, q[0], q[1], 0.5));
    }
  }
  for (let k = -11; k <= 11; k += 1) {
    holes.push((x) => HOLE.dot(x, k * 2.9, -31.5, 0.5));
    if (Math.abs(k) < 9) holes.push((x) => HOLE.dot(x, k * 2.6 + 1.3, -40.5, 0.42));
  }
  edgeRow(sol, [tr.gate], holes, sp, { inset: 1.4, spacing: 1.9, r: 0.42, far: 3 });
  cutHoles(ctx, holes);
  // its rod, down the middle and into the trunk
  ctx.fillStyle = "#000";
  ctx.fillRect(-1.2, -H + 20, 2.4, H - 20 + (806 - FEET_Y));
  ctx.beginPath();
  ctx.moveTo(-1.3, 0);
  ctx.lineTo(1.3, 0);
  ctx.lineTo(1.6, 806 - FEET_Y);
  ctx.lineTo(-1.6, 806 - FEET_Y);
  ctx.fill();
}

// ------------------------------------------------------------------ the title plaque
// A panel of pierced hide hung from the valance on two cords: a scalloped,
// slightly irregular outline rising to a small leaf-arch in the middle, a
// border band of graded dots and teardrops, and the words cut right through
// so that they are made of lamp light.
const PLAQUE = { x0: 120, x1: 370, y0: 463, y1: 547 };
const ZH_FONT = "'Weibei SC', 'Heiti SC', 'STHeiti', sans-serif";
// a heavy slab face, as if the letters were chiselled out of the hide
const EN_FONT = "'Rockwell', 'Copperplate', 'American Typewriter', serif";
const DATE_FONT = "'Rockwell', 'Heiti SC', 'STHeiti', serif";
const ZH_SIZE = 25;
const EN_SIZE = 13.2;
const DATE_SIZE = 12.8;

/** The plaque's outline (before its scallops): a slab with a low arch on top. */
function plaqueOutline() {
  const { x0, x1, y0, y1 } = PLAQUE;
  const cx = (x0 + x1) / 2;
  const pts = [];
  const N = 120;
  for (let i = 0; i <= N; i += 1) {
    const x = lerp(x0, x1, i / N);
    const d = Math.abs(x - cx) / 46;
    // the leaf-arch: rises 9 units at the centre, flaring out at its foot
    const arch = d < 1 ? 9 * Math.pow(Math.cos((d * Math.PI) / 2), 1.6) : 0;
    pts.push([x, y0 - arch]);
  }
  pts.push([x1, y1]);
  for (let i = N; i >= 0; i -= 1) pts.push([lerp(x0, x1, i / N), y1]);
  return pts;
}

function cutPlaque(ctx) {
  const { x0, x1, y0, y1 } = PLAQUE;
  const cx = (x0 + x1) / 2;
  const outline = plaqueOutline();
  ctx.fillStyle = "#000";
  // the body, its edge chewed a little as hide is when it is cut by hand
  const rough = resample(outline, 1.2).map(({ p: q }) => {
    const j = 0.45 * (noise1(q[0] * 0.21 + q[1] * 0.13, 61) - 0.5);
    return [q[0] + j, q[1] + j];
  });
  fillPoly(ctx, rough);
  // scallops all round the edge
  for (const { p: q } of resample(outline, 5.6)) {
    ctx.beginPath();
    ctx.arc(q[0], q[1], 2.9, 0, TAU);
    ctx.fill();
  }
  // corner curls where the cords tie on, and a pendant leaf
  const corner = (x, y, sgn) => {
    const c = [x, y];
    const sp = spiralRibbon(c, 6.0, 2.4, 1.3, sgn > 0 ? -2.4 : -0.7);
    fillPoly(ctx, sp.poly.map((q) => [c[0] + (q[0] - c[0]) * sgn, q[1]]));
  };
  corner(x0 - 1, y0 - 1, 1);
  corner(x1 + 1, y0 - 1, -1);
  const pend = [];
  for (let i = 0; i <= 12; i += 1) {
    const t = i / 12;
    pend.push([cx + 8 * Math.sin(Math.PI * t) * (1 - t * 0.45), y1 + 1 + t * 12]);
  }
  for (let i = 11; i >= 1; i -= 1) {
    const t = i / 12;
    pend.push([cx - 8 * Math.sin(Math.PI * t) * (1 - t * 0.45), y1 + 1 + t * 12]);
  }
  fillPoly(ctx, pend);

  const holes = [];
  // the border band: an outer row of dots, a row of teardrops pointing in,
  // an inner row of fine dots
  const band = (inset, spacing, fn) => {
    const xa = x0 + inset;
    const xb = x1 - inset;
    const ya = y0 + inset;
    const yb = y1 - inset;
    const nx = Math.max(1, Math.round((xb - xa) / spacing));
    const ny = Math.max(1, Math.round((yb - ya) / spacing));
    for (let i = 0; i <= nx; i += 1) {
      const x = lerp(xa, xb, i / nx);
      fn(x, ya, Math.PI / 2, i);
      fn(x, yb, -Math.PI / 2, i);
    }
    for (let j = 1; j < ny; j += 1) {
      const y = lerp(ya, yb, j / ny);
      fn(xa, y, 0, j);
      fn(xb, y, Math.PI, j);
    }
  };
  band(3.4, 2.5, (x, y) => holes.push((c) => HOLE.dot(c, x, y, 0.62)));
  band(7.0, 3.6, (x, y, a, i) => {
    if (i % 2) holes.push((c) => HOLE.comma(c, x - Math.cos(a) * 0.9, y - Math.sin(a) * 0.9, 0.62, a, 0));
    else holes.push((c) => HOLE.dot(c, x, y, 0.38));
  });
  band(9.9, 2.0, (x, y) => holes.push((c) => HOLE.dot(c, x, y, 0.3)));
  // the leaf-arch: a rosette under its peak and graded dots along its curve
  {
    const c0 = [cx, y0 - 1.5];
    holes.push((c) => HOLE.dot(c, c0[0], c0[1], 0.85));
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * TAU;
      const q = add(c0, mul(dirOf(a), 2.5));
      holes.push((c) => HOLE.lens(c, q[0], q[1], a, 2.2, 0.95));
    }
  }
  // rosettes flanking the Chinese name
  for (const x of [x0 + 24, x1 - 24]) {
    const c0 = [x, y0 + 23];
    holes.push((c) => HOLE.dot(c, c0[0], c0[1], 0.9));
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * TAU + Math.PI / 8;
      const q = add(c0, mul(dirOf(a), 2.9));
      holes.push((c) => HOLE.lens(c, q[0], q[1], a, 2.8, 1.2));
    }
    for (let i = 0; i < 14; i += 1) {
      const q = add(c0, mul(dirOf((i / 14) * TAU), 6.0));
      holes.push((c) => HOLE.dot(c, q[0], q[1], 0.45));
    }
  }
  // a divider of graded dots under the name, swelling to a diamond at its middle
  {
    const y = y0 + 36.6;
    for (let k = -14; k <= 14; k += 1) {
      if (k === 0) continue;
      const x = cx + k * 4.2;
      const r = 0.32 + 0.5 * (1 - Math.abs(k) / 14);
      holes.push((c) => HOLE.dot(c, x, y, r));
    }
    holes.push((c) => HOLE.diamond(c, cx, y, 1.9, 1.1));
  }
  // small chevrons flanking the date
  for (const sgn of [-1, 1]) {
    for (let k = 0; k < 3; k += 1) {
      const x = cx + sgn * (82 + k * 4);
      const y = y0 + 67.5;
      holes.push((c) => {
        c.moveTo(x - sgn * 1.2, y - 1.6);
        c.lineTo(x + sgn * 0.8, y);
        c.lineTo(x - sgn * 1.2, y + 1.6);
        c.lineTo(x - sgn * 0.4, y);
        c.closePath();
      });
    }
  }
  holes.push((c) => HOLE.dot(c, cx, y1 + 6.5, 1.1));
  cutHoles(ctx, holes);

  // the words, cut through so they are made of light
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const fit = (text, font, spacing, maxW, x, y) => {
    ctx.font = font;
    if ("letterSpacing" in ctx) ctx.letterSpacing = spacing;
    const w = ctx.measureText(text).width;
    const k = w > maxW ? maxW / w : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, 1);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };
  fit(META.zh, `400 ${ZH_SIZE}px ${ZH_FONT}`, "4px", 150, cx + 2, y0 + 31.5);
  fit(META.en.toUpperCase(), `700 ${EN_SIZE}px ${EN_FONT}`, "0.9px", x1 - x0 - 26, cx + 0.45, y0 + 54.5);
  fit(`${META.date} · ${META.dateEn}`, `700 ${DATE_SIZE}px ${DATE_FONT}`, "0.6px", 150, cx + 0.3, y0 + 72);
  ctx.restore();
}

/** The two cords from the valance to the plaque's corner curls. */
function cutCords(ctx) {
  const { x0, x1, y0 } = PLAQUE;
  ctx.fillStyle = "#000";
  for (const [x, sgn] of [[x0 - 1, 1], [x1 + 1, -1]]) {
    const top = [x + sgn * 7, 444.5];
    const bot = [x + sgn * 0.6, y0 - 6.6];
    const line = smoothOpen([top, mix2(top, bot, 0.5), bot], 4);
    fillPoly(ctx, ribbon(line, 1.9, 1.6, false));
    // a knot where it is tied at the valance and a bead above the curl
    ctx.beginPath();
    ctx.arc(top[0], top[1] + 1.4, 1.5, 0, TAU);
    ctx.arc(bot[0], bot[1] - 1.6, 1.25, 0, TAU);
    ctx.fill();
    // the twist of the cord: fine diagonal nicks of light
    const nicks = [];
    resample(line, 1.5, false).forEach(({ p: q }, i) => {
      if (i < 2) return;
      nicks.push((c) => HOLE.lens(c, q[0], q[1], -0.9, 1.4, 0.32));
    });
    cutHoles(ctx, nicks);
  }
}

// ------------------------------------------------------------------ the bake
const LEFT = [
  [24, "gagah", 236, 3],
  [47, "alus", 226, 11],
  [71, "putri", 204, 2],
  [93, "gagah", 194, 7],
  [116, "alus", 176, 9],
  [142, "putri", 162, 14],
  [168, "alus", 150, 21],
];
const RIGHT = [
  [978, "gagah", 238, 5],
  [951, "alus", 226, 12],
  [923, "putri", 206, 8],
  [895, "alus", 190, 1],
  [870, "gagah", 176, 23],
  [814, "putri", 156, 6],
];
const TREE = { x: 850, H: 250, W: 122 };

let stageRef = null;

/** Multiply one cut-out (black on transparent) onto the screen with a warm penumbra. */
function layShadow(ctx, tmp, dx, dy, dw, dh, kb, soft = 1.3, tone = RANK_MUL, off = RANK_SOFT, warm = RANK_WARM) {
  const tc = tmp.ctx;
  tc.save();
  tc.setTransform(1, 0, 0, 1, 0, 0);
  tc.globalCompositeOperation = "source-in";
  tc.fillStyle = `rgb(${warm.join(",")})`;
  tc.fillRect(0, 0, tmp.w, tmp.h);
  tc.restore();
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.filter = `blur(${(soft * kb).toFixed(2)}px)`;
  ctx.drawImage(tmp.canvas, 0, 0, tmp.w, tmp.h, dx, dy, dw, dh);
  ctx.filter = "none";
  ctx.restore();
  tc.save();
  tc.setTransform(1, 0, 0, 1, 0, 0);
  tc.globalCompositeOperation = "source-in";
  tc.fillStyle = `rgb(${tone.join(",")})`;
  tc.fillRect(0, 0, tmp.w, tmp.h);
  tc.restore();
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  if (off > 0) ctx.filter = `blur(${(off * kb).toFixed(2)}px)`;
  ctx.drawImage(tmp.canvas, 0, 0, tmp.w, tmp.h, dx, dy, dw, dh);
  ctx.filter = "none";
  ctx.restore();
}

function bakeScreen(stage) {
  const kb = 3.3 * stage.s;
  const W = Math.ceil((SX1 - SX0) * kb);
  const H = Math.ceil((SY1 - SY0) * kb);
  return stage.bake2d(`wayang/screen/${kb.toFixed(3)}`, W, H, (ctx) => {
    stageRef = stage;
    paintCloth(ctx, kb, W, H);
    ctx.setTransform(kb, 0, 0, kb, -SX0 * kb, -SY0 * kb);
    paintHem(ctx);

    // one scratch canvas, reused for every cut-out
    const tmp = new Layer2D(stage.p, Math.ceil(300 * kb), Math.ceil(400 * kb));
    const cutInto = (box, draw) => {
      const tc = tmp.clear();
      tc.setTransform(kb, 0, 0, kb, -box[0] * kb, -box[1] * kb);
      draw(tc);
      const pw = Math.ceil((box[2] - box[0]) * kb);
      const ph = Math.ceil((box[3] - box[1]) * kb);
      return { canvas: tmp.canvas, w: pw, h: ph, ctx: tmp.ctx };
    };
    const cut = (box, draw, soft, tone, off, warm) => {
      const src = cutInto(box, draw);
      layShadow(ctx, src, box[0], box[1], src.w / kb, src.h / kb, kb, soft, tone, off, warm);
    };
    // the standing ranks: every figure laid into one mask, then shaded once
    const mask = new Layer2D(stage.p, W, H);
    const mc = mask.clear();
    const lay = (box, draw) => {
      const src = cutInto(box, draw);
      mc.save();
      mc.setTransform(kb, 0, 0, kb, -SX0 * kb, -SY0 * kb);
      mc.globalAlpha = RANK_ALPHA;
      mc.drawImage(src.canvas, 0, 0, src.w, src.h, box[0], box[1], src.w / kb, src.h / kb);
      mc.restore();
    };
    const figure = ([x, type, Hh, seed], facing) => {
      const fig = buildFigure(type, Hh, seed);
      const wl = 0.34 * Hh + 26;
      const box = [x - wl, FEET_Y - Hh * 1.08, x + wl, 806];
      lay(box, (tc) => {
        tc.translate(x, FEET_Y);
        tc.scale(facing, 1);
        cutFigure(tc, fig);
      });
    };
    LEFT.forEach((f) => figure(f, 1));
    RIGHT.slice(0, 5).forEach((f) => figure(f, -1));
    lay([TREE.x - 72, FEET_Y - TREE.H - 8, TREE.x + 72, 806], (tc) => {
      tc.translate(TREE.x, FEET_Y);
      cutTree(tc, TREE.H, TREE.W);
    });
    RIGHT.slice(5).forEach((f) => figure(f, -1));
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    layShadow(ctx, { canvas: mask.canvas, w: W, h: H, ctx: mc }, 0, 0, W, H, 1, 0.9 * kb, RANK_MUL, RANK_SOFT * kb, RANK_WARM);
    ctx.restore();
    // the title plaque on its two cords
    cut([PLAQUE.x0 - 14, 440, PLAQUE.x1 + 14, PLAQUE.y1 + 24], (tc) => {
      cutCords(tc);
      cutPlaque(tc);
    }, 1.0, SHADOW_MUL, 0, WARM_MUL);
    paintValance(ctx);
  });
}

// ------------------------------------------------------------------ shaders
const SHADOW_FRAG = `${FRAG_HEAD}
uniform sampler2D uP;
uniform sampler2D uQ;
uniform float uAsp;
uniform float uPen;
uniform float uSoft;
uniform float uMixSoft;
uniform float uDark;
uniform vec3 uShadow;
uniform vec3 uWarm;
uniform vec3 uLoom;
void main() {
  vec2 uv = vTexCoord;
  float sharp = texture(uP, uv).a;
  float pen = 0.0;
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float a = fi * 2.39996 + 0.7;
    float r = uPen * sqrt((fi + 0.5) / 12.0);
    pen += texture(uP, uv + vec2(cos(a), sin(a) * uAsp) * r).a;
  }
  pen /= 12.0;
  float soft = sharp;
  if (uMixSoft > 0.001) {
    // a wide soft halo over a tighter core, so head, bill and pouch still read
    float halo = 0.0;
    float core = 0.0;
    for (int i = 0; i < 32; i++) {
      float fi = float(i);
      float a = fi * 2.39996 + 0.3;
      float r = sqrt((fi + 0.5) / 32.0);
      vec2 d = vec2(cos(a), sin(a) * uAsp) * r;
      halo += texture(uQ, uv + d * uSoft).a;
      core += texture(uQ, uv + d * uSoft * 0.32).a;
    }
    soft = 0.45 * halo / 32.0 + 0.55 * core / 32.0;
  }
  float dens = mix(sharp, soft, uMixSoft) * uDark;
  float fringe = clamp(pen - sharp, 0.0, 1.0) * (1.0 - uMixSoft);
  // drawn back to the lamp the shadow stays warm brown, never grey
  vec3 sc = mix(uShadow, uLoom, uMixSoft);
  vec3 f = mix(vec3(1.0), sc, dens);
  f *= mix(vec3(1.0), uWarm, fringe * 0.85);
  fragColor = vec4(f, 1.0);
}`;

const LAMP_FRAG = `${FRAG_HEAD}
uniform vec3 uView;
uniform vec2 uSize;
uniform vec2 uHot;
uniform float uBright;
uniform vec3 uRip;
void main() {
  vec2 px = vTexCoord * uSize;
  vec2 w = (px - uView.yz) / uView.x;
  vec2 d0 = (w - vec2(500.0, 510.0)) / vec2(330.0, 230.0);
  vec2 d1 = (w - uHot) / vec2(330.0, 230.0);
  float g0 = exp(-dot(d0, d0));
  float g1 = exp(-dot(d1, d1));
  float f = uBright * (0.955 + 0.045 * clamp(1.0 + (g1 - g0) * 2.5, 0.0, 1.0));
  if (uRip.z >= 0.0) {
    // the trough just inside the travelling crest of the slap's ripple
    vec2 q = (w - uRip.xy) * vec2(1.0, 1.25);
    float dist = length(q);
    float r = RIP_SPEED * uRip.z;
    float env = exp(-uRip.z / 0.2);
    float trough = exp(-pow((dist - r + 15.0) / 8.0, 2.0)) + 0.45 * exp(-pow((dist - r + 52.0) / 9.0, 2.0));
    f *= 1.0 - 0.2 * env * trough * smoothstep(0.0, 8.0, dist);
  }
  fragColor = vec4(vec3(f), 1.0);
}`.replace(/RIP_SPEED/g, "430.0");

// Light added through the cloth before the puppet's shadow falls on it: the
// lamp's flare on the beat, and the bright crest of the ripple.
const LIGHT_FRAG = `${FRAG_HEAD}
uniform vec3 uView;
uniform vec2 uSize;
uniform vec3 uRip;
uniform float uFlare;
void main() {
  vec2 px = vTexCoord * uSize;
  vec2 w = (px - uView.yz) / uView.x;
  float inside = step(${SX0.toFixed(1)}, w.x) * step(w.x, ${SX1.toFixed(1)}) * step(${SY0.toFixed(1)}, w.y) * (1.0 - 0.75 * smoothstep(${(HEM[1] - 4).toFixed(1)}, ${(HEM[1] + 10).toFixed(1)}, w.y));
  vec2 d0 = (w - vec2(500.0, 520.0)) / vec2(420.0, 260.0);
  float glow = uFlare * (0.35 + 0.65 * exp(-dot(d0, d0)));
  float crest = 0.0;
  if (uRip.z >= 0.0) {
    vec2 q = (w - uRip.xy) * vec2(1.0, 1.25);
    float dist = length(q);
    float r = 430.0 * uRip.z;
    float env = exp(-uRip.z / 0.2);
    crest = env * (exp(-pow((dist - r) / 7.0, 2.0)) + 0.5 * exp(-pow((dist - r + 36.0) / 7.0, 2.0)));
    crest *= 0.32 * smoothstep(0.0, 10.0, dist);
  }
  vec3 add = vec3(1.0, 0.82, 0.52) * glow + vec3(1.0, 0.9, 0.66) * crest;
  fragColor = vec4(add * inside, 0.0);
}`;

// ------------------------------------------------------------------ timing
const WHEEL_STEP = 0.25; // a quick turn every quarter second, then a hold
const WHEEL_TURN = 0.06;
const SLAP = 3.0;

/** Wheel angle: holds, then snaps forward to where the true wheel will be a step later. */
function steppedWheel(f) {
  if (!f.film || typeof f.t !== "number") return f.pelican.wheel;
  const scenes = f.film.scenes;
  const k = Math.floor(f.t / WHEEL_STEP + 1e-9);
  const t0 = k * WHEEL_STEP;
  const a0 = pelicanAt(t0, scenes).wheel;
  const a1 = pelicanAt(t0 + WHEEL_STEP, scenes).wheel;
  return lerp(a0, a1, easeOutQuad(clamp((f.t - t0) / WHEEL_TURN)));
}

/** The shadow drawn back towards the lamp: scale, blur and darkness. */
function swellAt(u) {
  let S = 1;
  let soft = 0;
  let dark = 1;
  if (u >= 2 && u < SLAP) {
    if (u < 2.5) {
      const e = easeInOutCubic((u - 2) / 0.5);
      S = 1 + 0.7 * e;
      soft = e;
      dark = 1 - 0.26 * e;
    } else {
      const v = u - 2.5;
      S = 1.7 + 0.028 * Math.sin(v * TAU * 2.1) + 0.018 * wobble(u * 3.1, 5);
      soft = 1 + 0.08 * Math.sin(v * TAU * 1.5);
      dark = 0.74 + 0.03 * wobble(u * 4.3, 9);
    }
    if (u > SLAP - 0.07) {
      const e = easeInQuad((u - (SLAP - 0.07)) / 0.07);
      S = lerp(S, 1, e);
      soft = lerp(soft, 0, e);
      dark = lerp(dark, 1, e);
    }
  }
  return { S, soft, dark };
}

/** Bill: opens and shuts twice after the slap. */
function billOpen(u) {
  return 0.42 * (window4(u, 3.5, 3.53, 3.63, 3.68) + window4(u, 3.75, 3.78, 3.88, 3.93));
}

/** The hand's small stepped rock about the rod, kept away from the crossings. */
function rockAt(u, t) {
  const k = Math.floor(t * 5 + 1e-9);
  const w = window4(u, 0.6, 1.0, 5.0, 5.4);
  let a = 0.011 * (hash(k, 71) * 2 - 1) * w;
  if (u > 2.4 && u < SLAP) a += 0.035 * Math.sin((u - 2.4) * TAU * 1.3) * smoothstep(2.4, 2.6, u) * (1 - smoothstep(2.9, 2.97, u));
  return a;
}

// local rectangle of the puppet canvas, relative to the road point
const PB = { x0: -86, y0: -150, x1: 130, y1: 106 };
const HANDS = { body: [13, 106], bill: [122, 106], foot: [44, 106] };

function drawPelican(stage, f) {
  const { p } = stage;
  const kp = PX_PER_UNIT * ZOOM_IN * f.s;
  const pieces = pelicanPieces(stage, kp);
  const pw = Math.ceil((PB.x1 - PB.x0) * kp);
  const ph = Math.ceil((PB.y1 - PB.y0) * kp);
  const P = stage.layer("wayang/P", pw, ph);
  const ctx = P.clear();
  ctx.setTransform(kp, 0, 0, kp, -PB.x0 * kp, -PB.y0 * kp);
  drawPuppet(ctx, pieces, {
    crank: f.pelican.crank,
    wheel: steppedWheel(f),
    open: billOpen(f.u),
    rock: rockAt(f.u, f.t || 0),
    hands: HANDS,
  });
  P.touch();
  const sw = swellAt(f.u);
  const Q = stage.layer("wayang/Q", Math.ceil(pw / 4), Math.ceil(ph / 4));
  if (sw.soft > 0.001) {
    const qc = Q.clear();
    qc.imageSmoothingEnabled = true;
    qc.imageSmoothingQuality = "high";
    qc.drawImage(P.canvas, 0, 0, pw, ph, 0, 0, Q.w, Q.h);
    Q.touch();
  }
  const PW = PB.x1 - PB.x0;
  const PH = PB.y1 - PB.y0;
  const gx = f.pelican.x;
  const gy = f.pelican.y;
  const sh = stage.shader("wayang/shadow", VERT, SHADOW_FRAG);
  stage.withView(f.view, () => {
    stage.blend(p.MULTIPLY, () => {
      stage.shaderRect(
        sh,
        {
          uP: P.img,
          uQ: Q.img,
          uAsp: pw / ph,
          uPen: 1.15 / PW,
          uSoft: (6.5 * sw.soft) / (PW * sw.S),
          uMixSoft: clamp(sw.soft * 1.6),
          uDark: sw.dark,
          uShadow: SHADOW_MUL.map((v) => v / 255),
          uWarm: WARM_MUL.map((v) => v / 255),
          uLoom: LOOM_MUL.map((v) => v / 255),
        },
        gx + PB.x0 * sw.S,
        gy + PB.y0 * sw.S,
        PW * sw.S,
        PH * sw.S,
      );
    });
  });
}

/** The ripple's centre and age: [x, y, seconds since the slap], or age -1. */
function rippleAt(u) {
  return u >= SLAP && u < SLAP + 1.0 ? [SPEED * SLAP, 640, u - SLAP] : [0, 0, -1];
}

/** The lamp flares on the slap, as the master's mallet knocks. */
function flareAt(u) {
  return u >= SLAP && u < SLAP + 0.7 ? 0.2 * Math.exp(-(u - SLAP) / 0.1) : 0;
}

function drawLight(stage, f) {
  const fl = flareAt(f.u);
  const rip = rippleAt(f.u);
  if (fl <= 0 && rip[2] < 0) return;
  const { p } = stage;
  const v = f.view;
  const sh = stage.shader("wayang/light", VERT, LIGHT_FRAG);
  stage.origin();
  stage.blend(p.ADD, () => {
    stage.shaderRect(sh, { uView: [v.k, v.tx, v.ty], uSize: [f.w, f.h], uRip: rip, uFlare: fl }, 0, 0, f.w, f.h);
  });
}

function drawLamp(stage, f) {
  const { p } = stage;
  const t = f.t || sectionStart(10) + f.u;
  const k = Math.floor(t * 12 + 1e-9);
  const bright = 1 - 0.035 * hash(k, 3) - 0.015 * hash(Math.floor(t * 3), 4);
  const hot = [500 + 10 * (hash(k, 5) * 2 - 1), 510 + 6 * (hash(k, 6) * 2 - 1)];
  const v = f.view;
  const rip = rippleAt(f.u);
  const sh = stage.shader("wayang/lamp", VERT, LAMP_FRAG);
  stage.origin();
  stage.blend(p.MULTIPLY, () => {
    stage.shaderRect(sh, { uView: [v.k, v.tx, v.ty], uSize: [f.w, f.h], uHot: hot, uBright: bright, uRip: rip }, 0, 0, f.w, f.h);
  });
}

export const wayang = {
  ...META,
  poseHz: 10,
  still: { u: 3.6, cx: 670 },

  init(stage) {
    bakeScreen(stage);
    pelicanPieces(stage, PX_PER_UNIT * ZOOM_IN * stage.s);
  },

  render(stage, f) {
    const screen = bakeScreen(stage);
    stage.origin();
    stage.rect(0, 0, f.w, f.h, C.shadow);
    stage.withView(f.view, () => {
      stage.image(screen, SX0, SY0, SX1 - SX0, SY1 - SY0);
    });
    drawLight(stage, f);
    if (f.pelican.visible) drawPelican(stage, f);
    drawLamp(stage, f);
    stage.p.noStroke();
  },
};
