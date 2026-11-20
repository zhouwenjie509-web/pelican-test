// Section 4. Tang baimiao line drawing, c. 750 CE, in the plain-line manner
// of the High Tang associated with Wu Daozi (吴带当风, "Wu's sashes face the wind").
//
// Ink line on old paper and nothing else: no wash, no tone. Tall court
// attendants stand along a terrace under scroll clouds. Their sashes hang
// slack until the pelican rides past; then, figure by figure, they lift and
// stream after it. The celebrated wind is a slipstream.
//
// Layers (all ink is painted on white sheets and multiplied onto the paper):
//   back sheet   baked: terrace, railing, clouds, title, the back row of figures
//   back sashes  per frame: knockout + line for the back row's sashes
//   front sheet  baked on a clear sheet: the front row of figures, with knockouts
//   front sashes per frame, then the pelican (scarves, bird and bicycle, wing)

import { sectionMeta } from "./sections.js";
import { View } from "../kit/stage.js";
import { withPen, BRUSH_SCALE } from "../kit/pen.js";
import { INK, GROUNDS, inkGround, blankSheet, layInk } from "../kit/ink.js";
import { sprite, drawText, font, FONTS } from "../kit/text.js";
import { solveRig } from "../rig/rig.js";
import { SPEED } from "../main/layout.js";
import { clamp, smoothstep, lerp } from "../beat/ease.js";

const META = sectionMeta(4);
const TAU = Math.PI * 2;

// an old sheet of paper, a little warmer and more stained than fresh xuan
const PAPER = { ...GROUNDS.xuan, base: "#ece1c6", shade: "#d8c7a2", stainColor: "#c5ab7e", mottle: 0.55, stain: 0.3, seed: 4 };
const NONG = INK.nong;
const DAN = INK.dan;
const WHITE = "#ffffff";
const SEAL = "#a8281c";

const SHEET_PX = 3.3; // cached pixels per world unit at 1080p
const BACK = { x0: -70, y0: 412, x1: 1070, y1: 808 };
const FRONT = { x0: 180, y0: 436, x1: 965, y1: 704 };

// ------------------------------------------------------------------ line
// 白描 plain line: the kit's upright "line" tip, loaded fuller and steadier.
// The kit line leaves a grey, broken trace when pressed lightly; a figure
// drawn in a few long lines needs every line to stay black from set-down to
// release, and to taper only at its tip. Registered by size class exactly as
// kit/ink.js inkBrush does, so a stroke keeps its look at any scale.
const PLAIN = { px: 2.3, params: { type: "marker", weight: 0.6, scatter: 0.03, opacity: 55, spacing: 0.03, pressure: [1, 1], markerTip: false, noise: 0.08 } };
const plainSizes = new Set();
function plainLine(pen, color, width) {
  const px = Math.max(0.3, width * pen.k);
  const step = Math.round(Math.log2(px / PLAIN.px) * 3);
  const scale = 2 ** (step / 3);
  const name = `tang-plain@${step}`;
  if (!plainSizes.has(name)) {
    plainSizes.add(name);
    const q = { ...PLAIN.params };
    q.weight *= scale * BRUSH_SCALE;
    q.scatter *= scale * BRUSH_SCALE;
    q.spacing *= scale * BRUSH_SCALE;
    pen.b.add(name, q);
  }
  pen.setPx(name, color, px / (PLAIN.px * scale));
}

/** Pressure along a stroke, t = 0..1 of its length. */
// orchid-leaf: set down, swell through the middle of the curve, release to a point
const ORCHID = (t) => (0.52 + 0.68 * Math.sin(Math.PI * t)) * (t > 0.78 ? 1 - 0.78 * ((t - 0.78) / 0.22) ** 1.4 : 1) * (t < 0.05 ? 0.75 + 5 * t : 1);
// iron-wire: even, with only the faintest entry and release
const WIRE = (t) => (0.86 + 0.14 * Math.sin(Math.PI * t)) * (t > 0.93 ? 1 - 0.5 * (t - 0.93) / 0.07 : 1);

function withPressure(pts, prof) {
  const acc = [0];
  for (let i = 1; i < pts.length; i += 1) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = acc[acc.length - 1] || 1;
  return pts.map((q, i) => [q[0], q[1], prof(acc[i] / L)]);
}

/** A batch of marks, painted grouped so the brush composites as rarely as possible. */
class Marks {
  constructor() {
    this.ops = [];
  }
  knock(pts) {
    this.ops.push({ t: "k", pts });
  }
  disk(c, r) {
    this.ops.push({ t: "d", c, r });
  }
  /** kind: "orchid" | "wire"; tone: NONG | DAN */
  line(pts, w, kind = "orchid", tone = NONG) {
    this.ops.push({ t: "s", pts, w, kind, tone });
  }
  ring(c, r, w, tone = NONG) {
    this.ops.push({ t: "c", c, r, w, tone });
  }
}

/** Paint ops in order; consecutive ops of the same kind share a brush pass. */
function paintOps(pen, stage, ops, seed) {
  let mode = null;
  let n = 0;
  for (const op of ops) {
    n += 1;
    stage.reseed(seed + n * 31);
    if (op.t === "k" || op.t === "d") {
      if (mode !== "k") {
        pen.reset().wash(WHITE, 255);
        mode = "k";
      }
      if (op.t === "k") pen.polygon(op.pts);
      else pen.circle(op.c[0], op.c[1], op.r, 0);
    } else {
      if (mode === "k") pen.noWash();
      mode = "s";
      plainLine(pen, op.tone, op.w);
      if (op.t === "c") pen.circle(op.c[0], op.c[1], op.r, 0);
      else if (op.pts.length === 2) pen.line(op.pts[0][0], op.pts[0][1], op.pts[1][0], op.pts[1][1]);
      else pen.spline(withPressure(op.pts, op.kind === "wire" ? WIRE : ORCHID), 0.5);
    }
  }
  pen.noWash();
}

// ------------------------------------------------------------------ the attendants
// Drawn in local units, facing right: x forward, y up negative, feet at 0,
// chignon top near -176. A figure is scaled by h / 176. Each is a few long
// lines: the hair and chignon, the face, the neckline, two great bell
// sleeves, the fall of the skirt and its pooling hem.
// arm: [shoulder, elbow, wrist, how far the bell hangs below the forearm]
const POSES = {
  clasp: { front: [[16, -121], [25, -100], [9, -97], 54], back: [[-15, -121], [-23, -101], [2, -98], 50] },
  tray: { front: [[16, -121], [24, -105], [31, -114], 46], back: [[-15, -121], [-14, -105], [23, -115], 44] },
  flute: { front: [[16, -121], [28, -114], [23, -131], 46], back: [[-15, -121], [-12, -109], [13, -131], 42] },
  fan: { front: [[16, -121], [25, -104], [26, -118], 48], back: [[-15, -121], [-23, -101], [3, -98], 50] },
  standard: { front: [[16, -121], [25, -105], [27, -121], 48], back: [[-15, -121], [-23, -101], [3, -98], 50] },
};
const FIG_H = 176;

const FIGURES = [
  { id: "tray", x: 250, y: 690, h: 160, facing: 1, pose: "tray", bun: 0, row: 1 },
  { id: "fan", x: 418, y: 691, h: 164, facing: -1, pose: "fan", bun: 1, row: 1 },
  { id: "g2", x: 465, y: 684, h: 155, facing: 1, pose: "clasp", bun: 0, row: 0 },
  { id: "flute", x: 520, y: 691, h: 161, facing: 1, pose: "flute", bun: 1, row: 1 },
  { id: "g4", x: 580, y: 684, h: 156, facing: -1, pose: "clasp", bun: 0, row: 0 },
  { id: "g5", x: 634, y: 690, h: 160, facing: 1, pose: "clasp", bun: 1, row: 1 },
  { id: "standard", x: 820, y: 691, h: 164, facing: 1, pose: "standard", bun: 0, row: 1 },
  { id: "s2", x: 893, y: 685, h: 154, facing: -1, pose: "clasp", bun: 1, row: 0 },
];
FIGURES.forEach((fg, i) => {
  fg.sc = fg.h / FIG_H;
  fg.seed = 7100 + i * 97;
});

/** Map local points of a figure to the world. */
function placeFig(fg) {
  return (q) => [fg.x + fg.facing * q[0] * fg.sc, fg.y + q[1] * fg.sc];
}

const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mixP = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

/** A great bell sleeve hanging from the forearm: one long line from the shoulder round the bell to the cuff. */
function sleeve(m, P, arm) {
  const [S, E, W, D] = arm;
  const o = Math.sign(E[0] - W[0]) || 1;
  const maxY = Math.max(E[1], W[1]);
  const span = Math.abs(E[0] - W[0]);
  const X = (t) => lerp(E[0], W[0], t);
  const upper = [S, add(mixP(S, E, 0.5), [o * 2.4, 0]), E];
  const outer = [[E[0] + o * 4.5, E[1] + 0.26 * D], [E[0] + o * 6.5, E[1] + 0.62 * D], [X(0.12) + o * 5.5, maxY + 0.92 * D], [X(0.42), maxY + D]];
  const inner = [[X(0.78), maxY + 0.86 * D], [W[0] - o * 0.6, W[1] + 0.48 * D], [W[0] + o * 0.6, W[1] + 4.2]];
  const topIn = add(E, [-o * 1.5, -4]);
  const top = [topIn, add(mixP(topIn, W, 0.5), [0, -1.4]), add(W, [0, -3.6])];
  m.knock([add(S, [0, -1]), ...upper.slice(1), ...outer, ...inner, add(W, [-o * 1.8, 0]), ...top.slice().reverse(), add(mixP(S, E, 0.5), [-o * 6, -2])].map(P));
  m.line([...upper, ...outer.slice(0, 3)].map(P), 1.75);
  m.line([...outer.slice(2), ...inner].map(P), 1.5);
  m.line(top.map(P), 1.3);
  m.line([add(W, [0, -3.6]), add(W, [-o * 2.6, 0.4]), add(W, [o * 0.4, 4.4])].map(P), 0.75, "wire");
  // folds falling into the bell, following its drape
  m.line([add(E, [-o * 2, 3]), [E[0] + o * 1.5, E[1] + 0.45 * D], [X(0.18) + o * 1.6, maxY + 0.84 * D]].map(P), 1.35);
  if (span > 6) m.line([add(mixP(E, W, 0.5), [0, 2.5]), [X(0.48) + o * 0.5, maxY + 0.4 * D], [X(0.46), maxY + 0.78 * D]].map(P), 1.2);
}

function head(m, P, bun) {
  // hair: one line from the nape round the full mass of hair, up over the chignon, down to the forehead
  const back = [[-2, -131.2], [-9, -133.4], [-13.6, -139.4], [-14.2, -147.4], [-10.6, -154.2], [-4, -157.8], [2, -158.4]];
  const knot = [[1.6, -162.6], [4, -168.8], [10, -171.4], [15.2, -168.2], [15.6, -162.2], [12.2, -158.2], [11, -155], [10.4, -151.8], [7, -150.2]];
  const loops = [[-0.5, -163], [1.4, -170.6], [7.4, -171.6], [8.6, -165.4], [12, -171.8], [17.6, -169.4], [16.8, -161.6], [12.4, -158], [11, -155], [10.4, -151.8], [7, -150.2]];
  const crown = bun ? loops : knot;
  m.knock([...back, ...crown, [10.4, -147], [11.6, -143], [12.6, -139], [11.2, -134], [8.6, -130.8], [8.6, -126], [-5, -125.5], [-3.6, -130]].map(P));
  m.line([...back, crown[0], crown[1]].map(P), 1.5);
  m.line([back[back.length - 1], ...crown].map(P), 1.35);
  // combed hair: fine pale strands swept back from the hairline and up into the knot
  const front = [[6.4, -150.6], [3.4, -150], [0.6, -148.2], [-1, -145], [-1.6, -141.4], [-1.4, -138]];
  const crownPts = [[2.6, -157.4], [-1.4, -157.2], [-5.6, -156], [-9, -153.4], [-11.6, -149.6], [-12.8, -145]];
  front.forEach((a, i) => {
    const b = crownPts[i];
    const mid = add(mixP(a, b, 0.5), [-1.2 - i * 0.3, -1.6 + i * 0.5]);
    m.line([a, mid, b].map(P), 0.42, "orchid", DAN);
  });
  m.line([[-4.6, -133.2], [-10.6, -137.4], [-12.6, -143.4]].map(P), 0.42, "orchid", DAN);
  if (bun) {
    m.line([[1.6, -160], [3.4, -166.6], [6.2, -169.4]].map(P), 0.55, "orchid", DAN);
    m.line([[10, -160.4], [13, -166], [16, -168.4]].map(P), 0.55, "orchid", DAN);
  } else {
    m.line([[3.6, -159.6], [6.4, -166], [11.4, -169]].map(P), 0.55, "orchid", DAN);
    m.line([[8.2, -159.2], [11.8, -163.6], [14.6, -165]].map(P), 0.5, "orchid", DAN);
  }
  // comb and hairpin
  m.line([[3.6, -157.6], [8.4, -159.8], [12.8, -158.4]].map(P), 0.6, "wire");
  m.line([[1, -163.4], [8, -164.8], [17.6, -167.2]].map(P), 0.5, "wire");
  // the face: forehead, brow, nose, lips and chin in one fine line
  m.line([[7, -150.2], [9.6, -147.4], [10.9, -143.6], [11.7, -141], [12.5, -139], [10.9, -137.8], [11.2, -135.8], [10.3, -133.8], [8.7, -131.8], [5.2, -130.4], [0.6, -131.6], [-2.4, -134.6]].map(P), 0.62, "wire");
  // a lock of hair over the ear, then brow, eye, mouth
  m.line([[7, -150.2], [2.2, -149.2], [-0.8, -145.4], [-1.6, -139.6], [-0.6, -135.6]].map(P), 0.6, "orchid", DAN);
  m.line([[3.4, -145.6], [6.6, -146.6], [9.8, -145.8]].map(P), 0.5, "wire");
  m.line([[4.8, -142.4], [7, -143.2], [9.1, -142.6]].map(P), 0.55, "wire");
  m.line([[8.6, -135.6], [9.7, -135.2], [10.6, -135.5]].map(P), 0.5, "wire");
  // neck
  m.line([[7.8, -131.2], [7.8, -128.5], [8.6, -126.2]].map(P), 0.55, "wire");
  m.line([[-2.6, -131.4], [-3.6, -128.6], [-5, -125.8]].map(P), 0.55, "wire");
}

function torso(m, P) {
  m.knock(
    [[-6, -126], [-12, -124.5], [-16, -121], [-18.5, -113], [-17, -100], [-16, -70], [-18, -40], [-21, -15], [-25, -5], [-35, -0.5], [-20, 2.4], [0, 2.2], [20, 2], [31, -0.5], [25, -6], [21.5, -20], [19.5, -45], [18, -80], [18.5, -105], [19.5, -113], [17, -120], [13.6, -124], [9, -126]].map(P),
  );
  m.line([[-5.6, -125.6], [-2, -120], [3.5, -117.2], [8, -120.2], [9.6, -125.8]].map(P), 0.75, "wire");
  m.line([[-5.6, -125.6], [-10.5, -124.8], [-15, -122.2], [-17.5, -118]].map(P), 1.3);
  m.line([[9.6, -125.8], [13.5, -124.8], [16.8, -122.2], [18.4, -118]].map(P), 1.3);
  // the skirt tied high, above the breast, with a bow
  m.line([[-15.6, -113.8], [-4, -111.6], [7, -112.2], [17, -114.8]].map(P), 1.5);
  m.line([[-15.2, -109.6], [-4, -107.6], [7, -108.2], [16.6, -110.8]].map(P), 1.0);
  m.line([[5, -109.6], [0.2, -113.8], [-1.8, -109.6], [4.4, -109]].map(P), 0.75, "wire");
  m.line([[5.4, -109.6], [10.2, -114], [11.8, -109.8], [5.8, -109]].map(P), 0.75, "wire");
  // the long fall of the skirt, pooling at the hem
  m.line([[-16.4, -106], [-15.8, -78], [-17.2, -48], [-19.8, -22], [-23.4, -7.4], [-28, -2.2], [-35, -0.4]].map(P), 1.8);
  m.line([[17.4, -106], [18, -78], [19, -48], [20.6, -22], [23, -7.4], [26.4, -2.2], [31, -0.4]].map(P), 1.8);
  m.line([[-35, -0.4], [-25, 1.6], [-13, 2], [-3, 0.8], [5, 1.6], [11.4, 0.7]].map(P), 1.5);
  m.line([[17.6, 1], [24, 1.7], [31, -0.4]].map(P), 1.3);
  m.line([[-7.4, -60], [-8.8, -38], [-11, -16], [-13.6, -1.6]].map(P), 1.5);
  m.line([[1.2, -54], [1, -30], [0.4, -10], [-0.6, 0.6]].map(P), 1.35);
  m.line([[10, -58], [11.6, -36], [13.4, -14], [15.2, -0.4]].map(P), 1.5);
  m.line([[-19.6, -18], [-22.2, -8], [-27.4, -1.6]].map(P), 1.1);
  m.line([[4.6, -16], [6.4, -7], [8.6, 0.8]].map(P), 1.0);
  // a cloud-toed shoe peeping from the hem
  m.line([[10.8, 0.8], [13.8, -2.8], [17.6, -4.6], [20.2, -2.6], [17.6, 1]].map(P), 0.75, "wire");
}

function prop(m, P, pose, sc) {
  if (pose === "tray") {
    const ell = [];
    for (let i = 0; i <= 22; i += 1) {
      const a = (i / 22) * TAU + 0.3;
      ell.push([37 + Math.cos(a) * 16.5, -117.5 + Math.sin(a) * 3.4]);
    }
    const fruit = (cx, cy, r) => {
      const pts = [];
      for (let i = 0; i <= 10; i += 1) {
        const a = Math.PI * (0.96 + (i / 10) * 1.08);
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 1.05]);
      }
      return pts;
    };
    m.knock([[20, -117.5], [22, -127], [30, -137.5], [39, -137.5], [47, -127], [54, -117.5], [45, -111.5], [28, -111.5]].map(P));
    m.line(ell.map(P), 1.0, "wire");
    m.line([[26, -114.6], [37, -111], [48, -114.6]].map(P), 0.8, "wire");
    m.line(fruit(30.5, -122.6, 5).map(P), 0.85, "wire");
    m.line(fruit(42.5, -122.6, 5.2).map(P), 0.85, "wire");
    m.line(fruit(36.5, -129, 5.4).map(P), 0.85, "wire");
    m.line([[36.5, -134.4], [38.6, -137], [41.4, -137.2]].map(P), 0.6, "wire");
  } else if (pose === "flute") {
    m.knock([[9, -133.4], [40, -136.1], [40, -140.1], [9, -137.4]].map(P));
    m.line([[9, -134.4], [40, -137.1]].map(P), 0.7, "wire");
    m.line([[9, -136.6], [40, -139.3]].map(P), 0.7, "wire");
    m.line([[40, -137.1], [40.5, -138.2], [40, -139.3]].map(P), 0.5, "wire");
    for (let i = 0; i < 4; i += 1) m.line([[24 + i * 3.6, -136.7 + i * 0.3], [25 + i * 3.6, -136.6 + i * 0.3]].map(P), 0.8, "wire");
  } else if (pose === "fan") {
    m.knock([[25.6, -40], [28.4, -40], [28.4, -200], [25.6, -200]].map(P));
    const c = P([27, -216]);
    m.disk(c, 16.5 * sc);
    m.line([[26, -40], [26, -199.4]].map(P), 0.65, "wire");
    m.line([[28, -40], [28, -199]].map(P), 0.65, "wire");
    m.ring(c, 16 * sc, 1.1);
    m.ring(c, 13.6 * sc, 0.55);
    // where the handle meets the fan: a small knot and a tassel
    m.line([[24.2, -199.4], [27, -197.6], [29.8, -199.4]].map(P), 0.6, "wire");
    m.line([[27, -197.6], [26.2, -190], [27.4, -183]].map(P), 0.55);
  } else if (pose === "standard") {
    m.knock([[25.6, -4], [28.4, -4], [28.4, -246], [25.6, -246]].map(P));
    m.line([[26, -5], [26, -244]].map(P), 0.65, "wire");
    m.line([[28, -5], [28, -244]].map(P), 0.65, "wire");
    m.line([[24.2, -244], [26, -251], [27, -258], [28, -251], [29.8, -244], [24.2, -244]].map(P), 0.65, "wire");
    m.line([[28, -240], [45, -240]].map(P), 0.8, "wire");
  }
}

function figureMarks(m, fg) {
  const P = placeFig(fg);
  const pose = POSES[fg.pose];
  sleeve(m, P, pose.back);
  torso(m, P);
  head(m, P, fg.bun);
  sleeve(m, P, pose.front);
  prop(m, P, fg.pose, fg.sc);
}

// ------------------------------------------------------------------ the terrace, railing, clouds
function terraceMarks(m) {
  for (let x0 = -70; x0 < 1070; x0 += 285) {
    m.line([[x0, 702.1], [x0 + 150, 701.8], [x0 + 300, 702.2]], 1.0, "wire");
    m.line([[x0 + 20, 709.1], [x0 + 170, 708.8], [x0 + 315, 709.2]], 0.8, "wire");
  }
  for (let x = -35; x < 1070; x += 70) m.line([[x, 702.6], [x + 0.4, 708.6]], 0.55, "wire");
}

function railingMarks(m) {
  const posts = [];
  for (let x = -40; x <= 1080; x += 90) posts.push(x);
  posts.forEach((x, i) => {
    if (i < posts.length - 1) {
      const a = x + 2.8;
      const b = posts[i + 1] - 2.8;
      m.line([[a, 642], [b, 642]], 0.6, "wire", DAN);
      m.line([[a, 646], [b, 646]], 0.5, "wire", DAN);
      m.line([[a, 667.5], [b, 667.5]], 0.55, "wire", DAN);
      m.line([[a, 671], [b, 671]], 0.45, "wire", DAN);
      m.line([[a, 697], [b, 697]], 0.5, "wire", DAN);
      const c = (x + posts[i + 1]) / 2;
      m.line([[c - 1.6, 646], [c - 2.2, 656], [c - 1.4, 667.5]], 0.45, "wire", DAN);
      m.line([[c + 1.6, 646], [c + 2.2, 656], [c + 1.4, 667.5]], 0.45, "wire", DAN);
    }
    m.line([[x - 2.6, 634], [x - 2.6, 699]], 0.55, "wire", DAN);
    m.line([[x + 2.6, 634], [x + 2.6, 699]], 0.55, "wire", DAN);
    m.line([[x - 4, 634], [x + 4, 634]], 0.5, "wire", DAN);
    // lotus-bud finial
    m.line([[x - 3, 631], [x - 3.8, 625.4], [x - 1.8, 620], [x, 616.6], [x + 1.8, 620], [x + 3.8, 625.4], [x + 3, 631]], 0.55, "wire", DAN);
    m.line([[x - 3.6, 630.6], [x, 627], [x + 3.6, 630.6]], 0.45, "wire", DAN);
    m.line([[x - 3.9, 633.6], [x, 631.8], [x + 3.9, 633.6]], 0.45, "wire", DAN);
  });
}

function spiral(cx, cy, R, turns, dir, a0) {
  const pts = [];
  const n = Math.round(10 * turns) + 4;
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const a = a0 + dir * t * turns * TAU;
    const r = R * (1 - 0.82 * t);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

/** A ruyi-headed scroll cloud: a curling head and a long tapering tail. dir = 1: tail to the left. */
function cloudMarks(m, cx, cy, k, dir) {
  const X = (x) => cx - dir * x * k;
  const Y = (y) => cy + y * k;
  const Q = (pts) => pts.map(([x, y]) => [X(x), Y(y)]);
  // head: the outer contour, three lobes
  m.line(Q([[2, 9], [-8, 10], [-17, 5], [-19, -3], [-14, -10], [-6, -11], [-1, -6]]), 0.9, "orchid", DAN);
  m.line(Q([[-1, -6], [3, -14], [12, -16], [20, -11], [21, -2], [16, 5], [8, 8]]), 0.9, "orchid", DAN);
  m.line(Q([[16, 5], [24, 2], [29, 6], [27, 12], [19, 13], [8, 11], [-4, 12], [-16, 9]]), 0.8, "orchid", DAN);
  // the curls inside
  m.line(spiral(X(10), Y(-4), 7.5 * k, 1.15, dir, Math.PI * 0.9).map((q) => q), 0.75, "orchid", DAN);
  m.line(spiral(X(-11), Y(-1), 5.2 * k, 1.0, -dir, 0).map((q) => q), 0.7, "orchid", DAN);
  m.line(spiral(X(24), Y(7), 3.4 * k, 0.9, dir, Math.PI), 0.6, "orchid", DAN);
  // the tail, streaming away
  m.line(Q([[-17, 5], [-42, 2], [-68, 9], [-96, 6], [-122, 10]]), 0.85, "orchid", DAN);
  m.line(Q([[-6, 11.5], [-36, 13], [-62, 15], [-92, 11], [-122, 10.4]]), 0.7, "orchid", DAN);
  m.line(Q([[-30, 7.5], [-52, 8.6], [-74, 11.6]]), 0.5, "orchid", DAN);
}

const CLOUDS = [
  [338, 498, 1.0, 1],
  [612, 466, 0.82, -1],
  [455, 452, 0.55, 1],
  [768, 520, 0.7, 1],
  [-10, 470, 0.8, -1],
];

// ------------------------------------------------------------------ title
const TITLE = { x: 56, y: 442, w: 140, h: 122 };

function titleSprite(stage, k) {
  return sprite(stage, `tang/title/${k.toFixed(3)}`, TITLE.w * k, TITLE.h * k, (ctx) => {
    ctx.scale(k, k);
    const ink = "#1d1c1b";
    const vertical = (text, x, y, size, weight, gap) => {
      [...text].forEach((ch, i) => drawText(ctx, ch, x, y + i * (size + gap), { font: font(FONTS.kai, size, weight), align: "center", baseline: "top", fill: ink }));
    };
    vertical(META.zh, 121, 6, 26, 700, 1.4);
    vertical("吴带当风", 94, 9, 15, 400, 1.2);
    vertical("约公元七五〇年", 74, 10, 11.8, 400, 0.8);
    ctx.fillStyle = SEAL;
    ctx.fillRect(86.5, 81, 15, 15);
    drawText(ctx, "鹈", 94, 82.2, { font: font(FONTS.kai, 6.6, 700), align: "center", baseline: "top", fill: "#ffffff" });
    drawText(ctx, "鹕", 94, 88.6, { font: font(FONTS.kai, 6.6, 700), align: "center", baseline: "top", fill: "#ffffff" });
    const it = font(FONTS.serif, 13, 400, "italic");
    drawText(ctx, "Tang Baimiao", 64, 88, { font: it, align: "right", fill: ink });
    drawText(ctx, "Line Drawing", 64, 104.2, { font: it, align: "right", fill: ink });
    drawText(ctx, META.dateEn, 64, 120.4, { font: font(FONTS.serif, 13, 400), align: "right", fill: ink });
  });
}

// ------------------------------------------------------------------ sheets
function sheetDims(stage, r) {
  const k = SHEET_PX * stage.s;
  return { k, w: Math.round((r.x1 - r.x0) * k), h: Math.round((r.y1 - r.y0) * k) };
}

function bakeBack(stage) {
  const { k, w, h } = sheetDims(stage, BACK);
  return stage.bake(`tang/back/${k.toFixed(4)}`, w, h, () => {
    const view = new View(k, -BACK.x0 * k, -BACK.y0 * k);
    blankSheet(stage);
    stage.seed(4400);
    withPen(stage, view, (pen) => {
      const m = new Marks();
      for (const c of CLOUDS) cloudMarks(m, ...c);
      railingMarks(m);
      terraceMarks(m);
      paintOps(pen, stage, m.ops, 4410);
      FIGURES.filter((fg) => fg.row === 0).forEach((fg) => {
        const f = new Marks();
        figureMarks(f, fg);
        paintOps(pen, stage, f.ops, fg.seed);
      });
    });
    const t = titleSprite(stage, k);
    stage.withView(view, () => stage.image(t, TITLE.x, TITLE.y, TITLE.w, TITLE.h));
  });
}

function bakeFront(stage) {
  const { k, w, h } = sheetDims(stage, FRONT);
  return stage.bake(`tang/front/${k.toFixed(4)}`, w, h, () => {
    const view = new View(k, -FRONT.x0 * k, -FRONT.y0 * k);
    stage.seed(4500);
    withPen(stage, view, (pen) => {
      FIGURES.filter((fg) => fg.row === 1).forEach((fg) => {
        const f = new Marks();
        figureMarks(f, fg);
        paintOps(pen, stage, f.ops, fg.seed);
      });
    });
  });
}

// ------------------------------------------------------------------ wind
// The wind at a figure is a function of how far the pelican's breast has gone
// past it (d, world units). Nothing until it draws level, full within about
// 0.3 s, held while it is within 350 units, then dying away over two seconds.
const BREAST = 45;
const windAt = (d) => smoothstep(0, 55, d) * (1 - smoothstep(350, 690, d));
// the integral of the wind over d, so the wave's phase slows as the wind dies
const WI = { d0: -400, d1: 2600, step: 2, t: null };
{
  const n = Math.round((WI.d1 - WI.d0) / WI.step) + 1;
  WI.t = new Float64Array(n);
  for (let i = 1; i < n; i += 1) {
    const da = WI.d0 + (i - 1) * WI.step;
    WI.t[i] = WI.t[i - 1] + 0.5 * (windAt(da) + windAt(da + WI.step)) * WI.step;
  }
}
function windInt(d) {
  const x = (clamp(d, WI.d0, WI.d1 - WI.step) - WI.d0) / WI.step;
  const i = Math.floor(x);
  return lerp(WI.t[i], WI.t[i + 1], x - i);
}

/**
 * A ribbon as a chain of points, built by integrating its direction along
 * its length so it never stretches. At rest it hangs in a slow S; in the
 * wind it streams to the right with a travelling wave that grows to the tip.
 *   wind   0..1, the tip answers a little after the root (lag)
 *   phase  radians of the travelling wave
 */
function ribbonPath(root, L, n, { wind, phase, seed, lag = 0.3, restSide = 1, base = -0.12, lambda = 60, amp = 1, restAngle = Math.PI / 2, curl = 0, restSpread = 0 }) {
  const ds = L / n;
  const pts = [root];
  const ang = [];
  let c = root;
  for (let i = 0; i < n; i += 1) {
    const s = (i + 0.5) * ds;
    const q = s / L;
    const wl = smoothstep(0, 1, clamp(wind * (1 + lag) - q * lag));
    const rest = restAngle + restSide * 0.22 * Math.sin(TAU * q * 0.9 + seed) * (0.4 + q);
    const A = amp * (0.15 + 0.42 * q ** 1.5);
    const wave = A * Math.sin((TAU * s) / lambda - phase + seed) + amp * 0.55 * q ** 5 * Math.sin((2 * TAU * s) / lambda - 1.6 * phase + seed * 2);
    const th = lerp(rest + restSpread * q, base - curl * q * q + wave, wl);
    ang.push(th);
    c = [c[0] + Math.cos(th) * ds, c[1] + Math.sin(th) * ds];
    pts.push(c);
  }
  return { pts, ang, ds };
}

/** Edges of a ribbon of width w along a path; it twists in the wind and tapers to a point. */
function ribbonEdges(path, w, { wind, phase, seed, taper = 0.85, lambda = 60, fork = 0 }) {
  const { pts } = path;
  const n = pts.length - 1;
  const left = [];
  const right = [];
  for (let i = 0; i <= n; i += 1) {
    const q = i / n;
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const s = q * n * path.ds;
    const tau = wind * 0.95 * Math.sin((TAU * s) / (1.7 * lambda) - 0.75 * phase + seed * 1.7) + (1 - wind) * 0.45 * Math.sin(TAU * q * 1.1 + seed);
    let wd = w * (1 - 0.2 * q) * (1 - taper * q ** 4) * (0.42 + 0.58 * Math.abs(Math.cos(tau)));
    let off = 0;
    if (fork && q > 1 - fork) {
      const fq = (q - (1 - fork)) / fork;
      off = w * 0.9 * fq;
      wd = Math.max(wd, w * 0.25);
    }
    const hw = wd / 2 + off;
    left.push([pts[i][0] + nx * hw, pts[i][1] + ny * hw]);
    right.push([pts[i][0] - nx * hw, pts[i][1] - ny * hw]);
  }
  return { left, right };
}

function ribbonMarks(knock, lines, path, edges, w1, w2, forkFrom = 1) {
  const n = edges.left.length - 1;
  const cut = Math.round(n * forkFrom);
  knock.knock([...edges.left.slice(0, cut + 1), ...edges.right.slice(0, cut + 1).reverse()]);
  lines.line(edges.left, w1);
  lines.line(edges.right, w2);
}

/** Every per-frame sash of one figure. */
function sashMarks(knock, lines, fg, pelX, u) {
  const P = placeFig(fg);
  const pose = POSES[fg.pose];
  const sc = fg.sc;
  const out = [];
  const oF = Math.sign(pose.front[1][0] - pose.front[2][0]) || 1;
  const oB = Math.sign(pose.back[1][0] - pose.back[2][0]) || 1;
  const roots = [
    { at: add(pose.front[1], [oF * 6.5, 6]), L: 98, w: 5.6, s: 0.7, side: oF, base: -0.3, curl: 0.32, k: 1 },
    { at: add(pose.back[1], [oB * 6.5, 6]), L: 94, w: 5.4, s: 2.3, side: oB, base: 0.04, curl: 0.25, k: 1 },
    { at: [5.2, -107.6], L: 64, w: 3.6, s: 4.1, side: 1, base: 0.3, curl: 0.25, k: 0.75 },
  ];
  for (const r of roots) {
    const root = P(r.at);
    const d = pelX + BREAST - root[0];
    const wind = windAt(d) * r.k;
    const phase = TAU * 1.55 * (windInt(d) / SPEED) + 0.25 * u;
    const seed = fg.seed * 0.013 + r.s;
    const opts = { wind, phase, seed, restSide: fg.facing * r.side, lambda: 72, base: r.base + 0.09 * Math.sin(fg.seed * 0.37 + r.s), curl: r.curl };
    const path = ribbonPath(root, r.L * sc, 15, opts);
    const edges = ribbonEdges(path, r.w * sc, opts);
    ribbonMarks(knock, lines, path, edges, r.w > 4 ? 1.6 : 1.2, r.w > 4 ? 1.15 : 0.9);
    out.push(wind);
  }
  if (fg.pose === "standard") {
    // the banner: hangs from the crossbar, then snaps out when the pelican passes the pole
    const root = P([38, -240]);
    const d = pelX + BREAST - P([27, 0])[0];
    const snap = smoothstep(22, 55, d) * (1 - smoothstep(420, 760, d));
    const over = 0.45 * Math.exp(-Math.max(0, d - 55) / 40) * smoothstep(40, 55, d);
    const phase = TAU * 1.8 * (windInt(d - 20) / SPEED) + 0.2 * u;
    const opts = { wind: snap, phase, seed: 1.3, lag: 0.15, restSide: 0.3, base: -0.08 - over, lambda: 70, amp: 0.55 };
    const path = ribbonPath(root, 46 * sc, 8, opts);
    const edges = ribbonEdges(path, 12 * sc, { ...opts, wind: snap * 0.35, taper: 0 });
    ribbonMarks(knock, lines, path, edges, 0.85, 0.85);
    lines.line([edges.left[edges.left.length - 1], edges.right[edges.right.length - 1]], 0.6, "wire");
    const end = path.ang[path.ang.length - 1];
    [-1, 0, 1].forEach((j) => {
      const e0 = mixP(edges.left[edges.left.length - 1], edges.right[edges.right.length - 1], 0.5 + j * 0.36);
      const p2 = ribbonPath(e0, (64 - Math.abs(j) * 10 + j * 4) * sc, 12, { ...opts, amp: 1, seed: 2 + j, restAngle: end + j * 0.07, restSide: 0.6 + j * 0.3, restSpread: j * 0.12, phase: phase + j * 0.7, base: -0.06 - over * 0.6 + j * 0.05 });
      const e2 = ribbonEdges(p2, 2.6 * sc, { ...opts, seed: 2 + j });
      ribbonMarks(knock, lines, p2, e2, 0.7, 0.55);
    });
  }
  return out;
}

// ------------------------------------------------------------------ the pelican, in line
function closedStrokes(m, pts, w, kind = "orchid", split = 0.5) {
  const n = pts.length;
  const k = Math.max(1, Math.round(n * split));
  m.line(pts.slice(0, k + 1), w, kind);
  m.line([...pts.slice(k), pts[0]], w * 0.85, kind);
}

function inside(q, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const a = poly[i];
    const b = poly[j];
    if (a[1] > q[1] !== b[1] > q[1] && q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

/** Draw a closed contour as long strokes, leaving out what lies under the shapes in front of it. */
function contourRuns(m, pts, covers, w, kind = "orchid", maxRun = 0.5) {
  const n = pts.length;
  const hidden = pts.map((q) => covers.some((poly) => poly && inside(q, poly)));
  let start = hidden.findIndex((h) => h);
  const runs = [];
  if (start < 0) {
    closedStrokes(m, pts, w, kind, maxRun);
    return;
  }
  let run = [];
  for (let k = 1; k <= n; k += 1) {
    const i = (start + k) % n;
    if (hidden[i]) {
      if (run.length > 1) runs.push(run);
      run = [];
    } else run.push(pts[i]);
  }
  if (run.length > 1) runs.push(run);
  const cap = Math.max(4, Math.round(n * maxRun));
  for (const r of runs) {
    for (let a = 0; a < r.length - 1; a += cap) m.line(r.slice(a, Math.min(r.length, a + cap + 1)), w, kind);
  }
}

function circlePts(c, r, n = 24) {
  const out = [];
  for (let i = 0; i < n; i += 1) out.push([c[0] + Math.cos((i / n) * TAU) * r, c[1] + Math.sin((i / n) * TAU) * r]);
  return out;
}

function farthest(pts, from) {
  let best = pts[0];
  let bd = -1;
  for (const q of pts) {
    const d = Math.hypot(q[0] - from[0], q[1] - from[1]);
    if (d > bd) {
      bd = d;
      best = q;
    }
  }
  return best;
}

function pelicanMarks(skel, t) {
  const S = skel.scale;
  const uu = S / 21.2;
  const J = skel.joints;
  const scarvesK = new Marks();
  const scarvesL = new Marks();
  const bodyK = new Marks();
  const bodyL = new Marks();
  const wingK = new Marks();
  const wingL = new Marks();
  const by = (tag) => skel.shapes.filter((sh) => sh.tag === tag);
  const one = (id) => skel.shapes.find((sh) => sh.id === id);

  // two long scarves tied at the base of the neck, streaming back
  const root = J.neckBase;
  [
    { L: 182, w: 7.5, seed: 0.4, base: Math.PI + 0.1, ph: 0 },
    { L: 158, w: 6.4, seed: 2.2, base: Math.PI - 0.16, ph: 1.9 },
  ].forEach((sc) => {
    const phase = TAU * 2.2 * t + sc.ph;
    const opts = { wind: 1, phase, seed: sc.seed, lag: 0, base: sc.base, lambda: 62, amp: 0.85 };
    const path = ribbonPath(root, sc.L * uu, 22, opts);
    const edges = ribbonEdges(path, sc.w * uu, { ...opts, fork: 0.16, taper: 0.5, lambda: 62 });
    ribbonMarks(scarvesK, scarvesL, path, edges, 1.0, 0.75, 0.84);
  });
  // the knot
  scarvesK.disk(root, 3 * uu);
  scarvesL.line([add(root, [-3, -2]), add(root, [-4.5, 2.5]), add(root, [0, 3.4]), add(root, [3, 0]), add(root, [-1, -3])], 0.8);

  // knockout under the whole figure
  for (const sh of by("tire")) bodyK.disk(sh.c, sh.r + sh.w / 2);
  for (const tag of ["tail", "body", "neck", "head", "pouch", "bill", "crest", "saddle", "foot"]) for (const sh of by(tag)) bodyK.knock(sh.pts);

  // bicycle in iron-wire line: true circles, fine spokes
  for (const sh of by("tire")) {
    bodyL.ring(sh.c, sh.r + sh.w * 0.42, 1.25);
    bodyL.ring(sh.c, sh.r - sh.w * 0.42, 0.7);
  }
  for (const sh of by("spoke")) bodyL.line(sh.pts, 0.38 * uu, "wire");
  for (const sh of by("hub")) bodyL.ring(sh.c, sh.r, 0.6);
  for (const sh of by("ring")) bodyL.ring(sh.c, sh.r, 0.5);
  for (const sh of [...by("chain")]) bodyL.line(sh.pts, 0.4, "wire");
  for (const tag of ["frame", "post", "bar"]) for (const sh of by(tag)) bodyL.line(sh.pts, 1.15 * uu, "wire");
  for (const sh of by("grip")) bodyL.line(sh.pts, 1.6 * uu, "wire");
  for (const sh of by("crank")) bodyL.line(sh.pts, 1.0 * uu, "wire");
  for (const sh of by("pedal")) closedStrokes(bodyL, sh.pts, 0.6, "wire");
  for (const sh of by("saddle")) closedStrokes(bodyL, sh.pts, 0.8, "wire");
  for (const sh of by("bell")) bodyL.ring(sh.c, sh.r, 0.5);
  // legs and webbed feet
  for (const sh of by("leg")) bodyL.line(sh.pts, (sh.side === "far" ? 1.0 : 1.35) * uu, "wire");
  for (const sh of by("foot")) closedStrokes(bodyL, sh.pts, 0.65, "wire");

  // tail: separate long feathers that flutter
  const tailMid = one("tail1") || by("tail")[0];
  if (tailMid) {
    const tip = farthest(tailMid.pts, J.tailRoot);
    const ax = Math.atan2(tip[1] - J.tailRoot[1], tip[0] - J.tailRoot[0]);
    for (let i = 0; i < 5; i += 1) {
      const a = ax + (i - 2) * 0.13 + 0.07 * Math.sin(t * 13 + i * 1.7);
      const len = (0.66 - Math.abs(i - 2) * 0.07) * S;
      const r0 = add(J.tailRoot, [Math.cos(a + 1.57) * (i - 2) * 0.05 * S, Math.sin(a + 1.57) * (i - 2) * 0.05 * S]);
      const bend = 0.06 * S * Math.sin(t * 11 + i);
      const mid = add(r0, [Math.cos(a) * len * 0.55 + Math.cos(a + 1.57) * bend, Math.sin(a) * len * 0.55 + Math.sin(a + 1.57) * bend]);
      const end = add(r0, [Math.cos(a) * len, Math.sin(a) * len]);
      bodyL.line([r0, mid, end], 1.15);
    }
  }
  // body, neck, head, pouch, bill: orchid-leaf contours
  const body = one("body");
  const neck = one("neck");
  const hd = one("head");
  const pts = (sh) => sh && sh.pts;
  if (body) contourRuns(bodyL, body.pts, [pts(neck)], 1.7);
  if (neck) contourRuns(bodyL, neck.pts, [pts(hd)], 1.45);
  if (hd) contourRuns(bodyL, hd.pts, [pts(one("billUpper"))], 1.2);
  for (const sh of by("crest")) {
    const tip = farthest(sh.pts, sh.pts[0]);
    bodyL.line([sh.pts[0], mixP(sh.pts[0], tip, 0.5), tip], 0.9);
  }
  const pouch = one("pouch");
  if (pouch) {
    const h = Math.floor(pouch.pts.length / 2);
    bodyL.line([...pouch.pts.slice(h), pouch.pts[0]], 1.5);
  }
  for (const sh of by("bill")) closedStrokes(bodyL, sh.pts, 0.95, "wire", 0.5);
  const eye = one("eye");
  if (eye) {
    if (skel.lid > 0.5) bodyL.line([add(eye.c, [-eye.r, 0]), add(eye.c, [0, eye.r * 0.3]), add(eye.c, [eye.r, 0])], 0.6, "wire");
    else {
      bodyL.ring(eye.c, eye.r, 0.5);
      const pu = one("pupil");
      if (pu) bodyL.ring(pu.c, pu.r * 0.5, pu.r * 1.1);
    }
  }

  // the wing: contour, rows of coverts, long flight feathers that lift and flutter
  const wing = one("wing");
  if (wing) {
    const W = wing.pts;
    const back = W[12];
    const ax = Math.atan2(back[1] - W[3][1], back[0] - W[3][0]);
    const prim = [];
    for (let i = 0; i < 6; i += 1) {
      // long flight feathers, each one stroke, lifting and fluttering in the airflow
      const q = i / 5;
      const r0 = mixP(mixP(W[8], W[12], 0.15 + 0.85 * q), W[14], 0.2 - 0.15 * q);
      const a = ax + 0.3 - 0.06 * i + 0.08 * Math.sin(t * 13 + i * 1.3);
      const len = (0.62 + 0.07 * i) * S;
      const bend = 0.06 * S * Math.sin(t * 11 + i * 0.9);
      const mid = add(r0, [Math.cos(a) * len * 0.5 - Math.sin(a) * bend, Math.sin(a) * len * 0.5 + Math.cos(a) * bend]);
      const end = add(r0, [Math.cos(a) * len, Math.sin(a) * len]);
      prim.push([r0, mid, end]);
    }
    wingK.knock(W);
    wingK.knock([prim[0][0], ...prim.map((p) => p[2]), prim[5][0]]);
    prim.forEach((p) => wingL.line(p, 1.25));
    wingL.line([W[13], W[14], W[15], W[0], W[1], W[2], W[3]], 1.5);
    wingL.line(W.slice(3, 13), 1.3);
    // coverts: two rows of short curved strokes
    const topAt = (q) => {
      const idx = [0, 15, 14, 13, 12];
      const x = q * (idx.length - 1);
      const i = Math.min(idx.length - 2, Math.floor(x));
      return mixP(W[idx[i]], W[idx[i + 1]], x - i);
    };
    const botAt = (q) => {
      const idx = [3, 5, 6, 7, 8, 9, 10, 11, 12];
      const x = q * (idx.length - 1);
      const i = Math.min(idx.length - 2, Math.floor(x));
      return mixP(W[idx[i]], W[idx[i + 1]], x - i);
    };
    const ca = Math.cos(ax);
    const sa = Math.sin(ax);
    [
      [0.38, 0.12, 0.62, 5],
      [0.66, 0.22, 0.74, 5],
    ].forEach(([v, q0, q1, n]) => {
      for (let i = 0; i < n; i += 1) {
        const q = lerp(q0, q1, i / (n - 1));
        const p = mixP(topAt(q), botAt(q), v);
        const sz = 0.13 * S;
        const arc = [];
        for (let k = 0; k <= 4; k += 1) {
          const th = -Math.PI / 2 + (k / 4) * Math.PI;
          arc.push(add(p, [-sa * sz * Math.sin(th) + ca * sz * 0.75 * Math.cos(th), ca * sz * Math.sin(th) + sa * sz * 0.75 * Math.cos(th)]));
        }
        wingL.line(arc, 0.9);
      }
    });
    wingL.line(one("wingFold") ? one("wingFold").pts : [], 0.7);
    for (const sh of skel.shapes.filter((x) => x.id.startsWith("wingHand"))) {
      const tip = farthest(sh.pts, sh.pts[0]);
      wingL.line([sh.pts[0], mixP(sh.pts[0], tip, 0.5), tip], 0.7);
    }
  }
  wingL.ops = wingL.ops.filter((op) => op.t !== "s" || op.pts.length >= 2);
  return [scarvesK, scarvesL, bodyK, bodyL, wingK, wingL];
}

// ------------------------------------------------------------------ the scene
export const tang = {
  ...META,
  still: { u: 1.95, cx: 336 },

  init(stage) {
    bakeBack(stage);
    bakeFront(stage);
  },

  render(stage, f) {
    const view = f.view;
    const pel = f.pelican;
    const back = bakeBack(stage);
    const front = bakeFront(stage);
    const vb = view.bounds(f.w, f.h);
    const inView = (fg) => fg.x + 150 > vb.x0 && fg.x - 70 < vb.x1;

    stage.origin();
    inkGround(stage, view, PAPER);

    const comp = stage.fb(`tang/comp/${f.w}x${f.h}`, f.w, f.h);
    stage.into(comp, () => {
      blankSheet(stage);
      stage.withView(view, () => stage.image(back, BACK.x0, BACK.y0, BACK.x1 - BACK.x0, BACK.y1 - BACK.y0));
      stage.seed(4600);
      // the back row's sashes
      const rows = [0, 1].map((row) => {
        const k = new Marks();
        const l = new Marks();
        FIGURES.filter((fg) => fg.row === row && inView(fg)).forEach((fg) => sashMarks(k, l, fg, pel.x, f.u));
        return [k, l];
      });
      if (rows[0][0].ops.length) {
        withPen(stage, view, (pen) => {
          paintOps(pen, stage, rows[0][0].ops, 4610);
          paintOps(pen, stage, rows[0][1].ops, 4620);
        });
      }
      stage.withView(view, () => stage.image(front, FRONT.x0, FRONT.y0, FRONT.x1 - FRONT.x0, FRONT.y1 - FRONT.y0));
      withPen(stage, view, (pen) => {
        paintOps(pen, stage, rows[1][0].ops, 4630);
        paintOps(pen, stage, rows[1][1].ops, 4640);
        if (pel.visible) {
          const skel = solveRig({ ...pel, act: { wind: 1 } });
          const groups = pelicanMarks(skel, pel.time);
          groups.forEach((g, i) => paintOps(pen, stage, g.ops, 4700 + i * 100));
        }
      });
    });
    stage.origin();
    layInk(stage, comp, 0, 0, f.w, f.h);
  },
};
