// Section 20 skin: the pelican and its bicycle as the drawing that the SVG in
// the code pane describes, a flat modern vector illustration. Every part is a
// dashed construction outline (the way a vector editor shows a selected path,
// with a few square handles) until the line of code that owns it is complete;
// then its outline runs round, its fill fades up and the construction line
// fades out.
//
// INTERFACE (the scene calls exactly this)
//
//   drawCodeFigure(stage, f, skel, parts)
//
//   stage   the Stage. Draw on a 2D patch from stage.patch(key, f.view, ...)
//           and composite it with stage.imagePatch(patch); the patch's ctx is
//           already in world units. Every canvas must come from the stage.
//   f       the frame: f.u (seconds since entry), f.view, f.s, f.still,
//           f.pelican (the true pose, already solved into skel).
//   skel    solveRig({ ...f.pelican }) with default acting. Draw it as it is:
//           the pose must stay exact (the scene never re-poses the puppet).
//   parts   {
//             timeOf(shape)  -> u at which the line owning this rig shape
//                               completes (Infinity if no line owns it).
//                               Resolved by shape id, then by tag.
//             byId, byTag    the same table as plain objects
//             shadow         u at which the shadow's line completes
//             reveal         seconds a part takes to draw (0.3)
//             ground         world y of the ground line (700)
//           }
//
//   What it draws, for every shape at time u = f.u (k = (u - t) / reveal):
//     k <= 0        construction outline only (dashed slate line, 0.85 units,
//                   62 % opaque, square handles at a few anchor points; brighter,
//                   heavier and 95 % opaque for the entrance, easing to that over
//                   u 0.8 .. 1.5, see guideLook), in
//                   the true pose, pedalling like the rest; near side only for
//                   legs, feet and cranks, no guides on wing tips, pedals, grips;
//     0 < k < 1     the outline runs round from start to end by path length
//                   (k 0 .. 0.55, smootherstep), the fill wipes across the part at full
//                   strength with a 3-unit soft front (k 0.26 .. 0.72, smootherstep; see
//                   wipeAxis for the direction of each part) and the construction line
//                   fades out (k 0.24 .. 0.78); front-loaded so a part reads on its own
//                   beat. Each leg is one smooth tapered limb that grows from the hip.
//     k >= 1        the finished part.
//   Nothing appears before its t (the scene marks the code line at t).
//   The soft ground shadow follows the same rule with parts.shadow.
//   Everything is a pure function of f; no state between frames.
//
//   How it is drawn:
//   - Shapes are taken in the rig's back-to-front order (the crest moved to
//     just behind the head) and grouped into runs that share one time. A
//     group whose fill is arriving is painted whole on a scratch patch, masked
//     by the wipe and composited once, so overlapping shapes of one part
//     (tail feathers, wing and its tips, crest and head) never double up and
//     a white fill never sits grey over the dark canvas.
//   - Circles are traced as two half turns (see trace()): a single arc of
//     exactly 2pi from a large start angle could vanish for single frames.
//   - Strokes (tyres, rims, spokes, frame, posts, cranks, chain, legs) are
//     the outline that runs round; fills (feathers, bill, pouch, feet,
//     saddle, pedals, hubs) get a fine line in their own colour that runs
//     round and then gives way to the fill.
//   - Gradients are laid out from the skeleton's joints in world units, so
//     they travel with the figure.
//
//   Context the scene guarantees and expects:
//   - It is called once per frame while f.pelican.visible, after the canvas
//     (grid, ruler, ground hairline at y 700) and before the editor's rules and
//     code pane; afterwards the scene calls stage.origin() itself.
//   - Stay inside the canvas: x < f.pelican.x + 88 (the divider; the bill
//     reaches +65) and nothing but the figure and its shadow on y 560-705.
//   - For u < 0.6 and u > 5.4 draw the pose exactly as solved (guide rule 4.2).
//   - The times come from the one table in scenes/code.js (TIMING, PART_TIMES).
//     Read them from `parts`, never hard-code them.
//   - The gallery still is drawn with f.still true and f.u = 4.833: every part
//     must be finished then (the last, the shadow, is done at about 4.65).

const BG = "#0f1218";
const GUIDE = [131, 145, 166]; // construction slate
const GUIDE_ALPHA = 0.62;
const GUIDE_W = 0.85;
const DASH = [2.4, 1.8];
const HANDLE = 2.1; // square handle side, world units
// the entrance: for u below about 1 the construction line is brighter and a little heavier, so the
// figure reads on the dark canvas as it comes in; it eases to the plain guide by u = 1.5
const GUIDE_ENTRY = [180, 196, 218];
const GUIDE_ENTRY_ALPHA = 0.95;
const GUIDE_ENTRY_W = 1.1;
/** The construction line's colour, opacity and width at time u (exactly the plain guide from u 1.5). */
function guideLook(u) {
  const e = 1 - smooth(0.8, 1.5, u);
  if (e <= 0) return { c: GUIDE, a: GUIDE_ALPHA, w: GUIDE_W, e: 0 };
  return {
    c: GUIDE.map((v, i) => Math.round(v + (GUIDE_ENTRY[i] - v) * e)),
    a: GUIDE_ALPHA + (GUIDE_ENTRY_ALPHA - GUIDE_ALPHA) * e,
    w: GUIDE_W + (GUIDE_ENTRY_W - GUIDE_W) * e,
    e,
  };
}

/** The drawing's palette: the editor's theme, warmed only by the bill and the legs. */
export const CODE_PALETTE = {
  featherTop: "#fbfaf6",
  feather: "#f4f1ea",
  featherLow: "#ece9e2",
  cool: [168, 181, 201], // the soft cool shade on the body
  tailTip: "#d9dde4",
  wingFront: "#e2e0da",
  wingBack: "#b4bdcb",
  wingFold: "#aeb7c4",
  wingEdge: "#8f9bb0", // the darker trailing edge
  gape: "#4e2c20", // the fine dark line of the mouth
  ink: "#2b2f3a", // wing tips, tyres, grips, saddle
  inkLight: "#3c4352",
  billBase: "#f5ab42",
  billTip: "#ef9a2f",
  billLower: "#e48e2c",
  billRidge: "#ffd291",
  billNail: "#d27a26",
  pouchTop: "#f9cd77",
  pouchLow: "#f1b458",
  skin: "#f3cba6", // bare skin round the eye
  iris: "#1f232c",
  leg: "#e2783a",
  legFar: "#a3532a",
  footTop: "#ec8642",
  footLow: "#d96b2f",
  footFar: "#94492a",
  tire: "#2c313c",
  rim: "#9aa4b2",
  spoke: "#6a7483",
  hub: "#c3cad4",
  hubCore: "#5d6675",
  frame: "#3fd0c0",
  frameRear: "#38c2b3",
  metal: "#38c2b3", // seat post, stem and bar: the teal group, a shade deeper than the tubes
  metalFar: "#2a8f86", // the far crank
  crank: "#3fd0c0",
  ringTeeth: "#2fa89b",
  ringCore: "#2a8f86",
  chain: "#4f7577",
  bell: "#e6c07b",
  pedal: "#3a4150",
  pedalFar: "#262a33",
};
const P = CODE_PALETTE;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const smoother = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/** Strokes: the part is its line. Everything else is a fill. */
const STROKED = new Set(["tire", "rim", "spoke", "frame", "post", "bar", "grip", "chain", "ring", "crank", "leg", "wingfold"]);
/** Shapes too fine to have a construction line of their own. */
const NO_GUIDE = new Set(["rim", "spoke", "reflector", "hub", "pupil", "lid", "wingfold", "chain", "bell", "wingtip", "pedal", "grip"]);
// one tail feather and one crest feather stand for their fans; the far-side leg, foot and crank
// are left to the near side, so the bottom bracket reads as one leg on one crank, not a knot
const NO_GUIDE_ID = new Set(["cog", "billLower", "tail0", "tail2", "crest0", "crest2", "legFarThigh", "legFarShin", "footFar", "crankFar"]);
/** Construction paths shorter than this are drawn solid: dashes on a tiny shape read as noise. */
const DASH_MIN = 30;
/** Closed shapes drawn as smooth curves through their points. */
const SMOOTH = new Set(["wing", "wingtip", "tail", "crest", "foot", "saddle", "neck"]);

function pathLength(pts, closed) {
  let L = 0;
  for (let i = 1; i < pts.length; i += 1) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  if (closed && pts.length > 1) L += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
  return L;
}

/** Trace a shape and return its length; circles start at angle a0 so dashes and reveals turn with the wheel. */
function trace(ctx, sh, a0 = -Math.PI / 2) {
  ctx.beginPath();
  if (sh.kind === "circle") {
    // two half turns, never one arc of exactly 2pi: for some start angles a0 + 2pi - a0 rounds
    // to a hair under 2pi and the canvas draws nothing (the wheels flickered out once a
    // revolution). Each half has an unambiguous sweep of pi; the path stays one continuous
    // line, so dashes and the run-round reveal are unchanged.
    ctx.arc(sh.c[0], sh.c[1], sh.r, a0, a0 + Math.PI);
    ctx.arc(sh.c[0], sh.c[1], sh.r, a0 + Math.PI, a0 + Math.PI * 2);
    return 2 * Math.PI * sh.r;
  }
  const p = sh.pts;
  if (sh.closed && SMOOTH.has(sh.tag)) {
    // organic shapes: a quadratic curve through the midpoints, so feathers end in round tips
    const n = p.length;
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const m0 = mid(p[n - 1], p[0]);
    ctx.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i += 1) {
      // the wing's trailing edge (the rig's points 4-11) is three clean feather arcs, not a wave
      if (sh.tag === "wing" && i >= 4 && i <= 11) {
        if (i === 4) wingEdge(ctx, p, false);
        continue;
      }
      const m = mid(p[i], p[(i + 1) % n]);
      ctx.quadraticCurveTo(p[i][0], p[i][1], m[0], m[1]);
    }
    ctx.closePath();
    return pathLength(p, true) * 0.96;
  }
  ctx.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length; i += 1) ctx.lineTo(p[i][0], p[i][1]);
  if (sh.closed) ctx.closePath();
  return pathLength(p, sh.closed);
}

/**
 * The wing's trailing edge: three even arcs, one per secondary feather, from midway along the
 * rig's points 3-4 to midway along 11-12, each bowing out below the chord and meeting the next
 * at a shallow notch. Continues the current path (or starts one when move is true).
 */
const WING_ARCS = 3;
const WING_NOTCH = 1.0; // the notches sit this far inside the chord (world units)
const WING_BOW = 1.3; // each arc bows this far outside the chord
function wingEdgePoints(p) {
  const a = [(p[3][0] + p[4][0]) / 2, (p[3][1] + p[4][1]) / 2];
  const b = [(p[11][0] + p[12][0]) / 2, (p[11][1] + p[12][1]) / 2];
  const d = [b[0] - a[0], b[1] - a[1]];
  const L = Math.hypot(d[0], d[1]) || 1;
  const out = [d[1] / L, -d[0] / L]; // away from the wing (down, for a chord running back)
  const knots = [];
  for (let j = 0; j <= WING_ARCS; j += 1) {
    const t = j / WING_ARCS;
    const inset = j === 0 || j === WING_ARCS ? 0 : WING_NOTCH;
    knots.push([a[0] + d[0] * t - out[0] * inset, a[1] + d[1] * t - out[1] * inset]);
  }
  const ctrls = [];
  for (let j = 0; j < WING_ARCS; j += 1) {
    const m = [(knots[j][0] + knots[j + 1][0]) / 2, (knots[j][1] + knots[j + 1][1]) / 2];
    // a quadratic reaches half its control's offset from the mid-chord, which sits `inset` inside
    // the main chord: so every arc bows exactly WING_BOW outside the main chord
    const inset = WING_NOTCH * ((j > 0 ? 0.5 : 0) + (j < WING_ARCS - 1 ? 0.5 : 0));
    const off = 2 * (WING_BOW + inset);
    ctrls.push([m[0] + out[0] * off, m[1] + out[1] * off]);
  }
  return { knots, ctrls };
}
function wingEdge(ctx, p, move) {
  const { knots, ctrls } = wingEdgePoints(p);
  if (move) ctx.moveTo(knots[0][0], knots[0][1]);
  for (let j = 0; j < WING_ARCS; j += 1) ctx.quadraticCurveTo(ctrls[j][0], ctrls[j][1], knots[j + 1][0], knots[j + 1][1]);
}

/** Path of a capsule from a (radius r0) to b (radius r1): one closed outline, so it fills at one alpha. */
function taper(ctx, a, b, r0, r1) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const h = Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(a[0] + r0 * Math.cos(ang + h), a[1] + r0 * Math.sin(ang + h));
  ctx.lineTo(b[0] + r1 * Math.cos(ang + h), b[1] + r1 * Math.sin(ang + h));
  ctx.arc(b[0], b[1], r1, ang + h, ang - h, true);
  ctx.lineTo(a[0] + r0 * Math.cos(ang - h), a[1] + r0 * Math.sin(ang - h));
  ctx.arc(a[0], a[1], r0, ang - h, ang + h - 2 * Math.PI, true);
  ctx.closePath();
}

const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];

/**
 * A leaf-shaped feather from root to tip, half-width about w / 2, the leading vane fuller than
 * the trailing one. One closed outline, so it fills at one alpha.
 */
function leaf(ctx, root, tip, w, lead = 1, trail = 0.55) {
  const d = sub(tip, root);
  const L = Math.hypot(d[0], d[1]) || 1;
  const n = [-d[1] / L, d[0] / L];
  const c1 = add(add(root, d, 0.42), n, w * lead);
  const c2 = add(add(root, d, 0.5), n, -w * trail);
  ctx.beginPath();
  ctx.moveTo(root[0], root[1]);
  ctx.quadraticCurveTo(c1[0], c1[1], tip[0], tip[1]);
  ctx.quadraticCurveTo(c2[0], c2[1], root[0], root[1]);
  ctx.closePath();
}

/**
 * A pelican's leg as one smooth tapered limb: hip a, knee b, ankle c. The two bones stay nearly
 * straight and the knee is rounded (the tangent there runs from hip to ankle). r0 at the hip,
 * rk at the knee, r1 at the ankle. run (0..1) grows it from the hip.
 */
function limb(ctx, a, b, c, r0, rk, r1, run = 1) {
  const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const l2 = Math.hypot(c[0] - b[0], c[1] - b[1]) || 1;
  // the tangent at the knee halves the angle between the bones, and the handles are short,
  // so each bone stays straight and only the joint itself is rounded
  const m = [(b[0] - a[0]) / l1 + (c[0] - b[0]) / l2, (b[1] - a[1]) / l1 + (c[1] - b[1]) / l2];
  const mL = Math.hypot(m[0], m[1]) || 1;
  const mu = [m[0] / mL, m[1] / mL];
  const seg = [
    [a, lerp2(a, b, 0.33), add(b, mu, -0.18 * l1), b],
    [b, add(b, mu, 0.18 * l2), lerp2(b, c, 0.67), c],
  ];
  const bez = (q, t) => {
    const v = 1 - t;
    return [
      v * v * v * q[0][0] + 3 * v * v * t * q[1][0] + 3 * v * t * t * q[2][0] + t * t * t * q[3][0],
      v * v * v * q[0][1] + 3 * v * v * t * q[1][1] + 3 * v * t * t * q[2][1] + t * t * t * q[3][1],
    ];
  };
  const N = 14;
  const P = [];
  const R = [];
  for (let i = 0; i <= 2 * N; i += 1) {
    const s = (i / (2 * N)) * run;
    const q = s < 0.5 ? seg[0] : seg[1];
    const t = s < 0.5 ? s * 2 : (s - 0.5) * 2;
    P.push(bez(q, t));
    // a thigh that narrows to the knee, a shin that narrows to the ankle
    R.push(s < 0.5 ? r0 + (rk - r0) * smooth(0, 1, s * 2) : rk + (r1 - rk) * ((s - 0.5) * 2));
  }
  const left = [];
  const right = [];
  for (let i = 0; i < P.length; i += 1) {
    const p0 = P[Math.max(0, i - 1)];
    const p1 = P[Math.min(P.length - 1, i + 1)];
    let dx = p1[0] - p0[0];
    let dy = p1[1] - p0[1];
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl;
    dy /= dl;
    left.push([P[i][0] - dy * R[i], P[i][1] + dx * R[i]]);
    right.push([P[i][0] + dy * R[i], P[i][1] - dx * R[i]]);
  }
  const e = P[P.length - 1];
  const re = R[R.length - 1];
  const angE = Math.atan2(left[left.length - 1][1] - e[1], left[left.length - 1][0] - e[0]);
  const angS = Math.atan2(right[0][1] - a[1], right[0][0] - a[0]);
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (const q of left) ctx.lineTo(q[0], q[1]);
  ctx.arc(e[0], e[1], re, angE, angE - Math.PI, true);
  for (let i = right.length - 1; i >= 0; i -= 1) ctx.lineTo(right[i][0], right[i][1]);
  ctx.arc(a[0], a[1], R[0], angS, angS - Math.PI, true);
  ctx.closePath();
}

/** Shapes the drawing leaves out: one wing tip under the tail and the second "hand" feather. */
const HIDDEN_ID = new Set(["wingTip3", "wingHand1"]);

function startAngle(sh, wheel, crank = 0) {
  // tyres and rims turn with the wheel, so their dashes and their reveal roll. The wheel angle
  // grows without bound (about 920 rad by bar 2), so it is wrapped into [0, 2pi) to keep the
  // arc arithmetic small (see trace() for the flicker this used to cause).
  if (sh.tag === "tire" || sh.tag === "rim") {
    const T = 2 * Math.PI;
    return (((wheel % T) + T) % T) - Math.PI / 2;
  }
  if (sh.tag === "ring") {
    const T = 2 * Math.PI;
    return ((crank % T) + T) % T;
  }
  return -Math.PI / 2;
}

function linear(ctx, a, b, stops) {
  const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

/** Per-frame drawing context: gradients laid out from the skeleton. */
function makeLook(ctx, skel) {
  const S = skel.scale;
  const J = skel.joints;
  const byId = {};
  for (const sh of skel.shapes) byId[sh.id] = sh;
  const top = [J.head[0], J.top[1]];
  const low = [J.body[0], J.body[1] + 0.95 * S];
  const feather = linear(ctx, top, low, [
    [0, P.featherTop],
    [0.55, P.feather],
    [1, P.featherLow],
  ]);
  // the cool shade: light falls from above and ahead, the belly and back turn away
  const lightC = [J.body[0] + 0.45 * S, J.body[1] - 0.55 * S];
  const shade = ctx.createRadialGradient(lightC[0], lightC[1], 0.2 * S, lightC[0], lightC[1], 1.75 * S);
  shade.addColorStop(0, rgba(P.cool, 0));
  shade.addColorStop(0.5, rgba(P.cool, 0));
  shade.addColorStop(0.82, rgba(P.cool, 0.32));
  shade.addColorStop(1, rgba(P.cool, 0.58));
  const tail = linear(ctx, J.tailRoot, [J.tailRoot[0] - 0.55 * S, J.tailRoot[1]], [
    [0, P.featherLow],
    [1, P.tailTip],
  ]);
  const w = byId.wing.pts;
  const wing = linear(ctx, w[3], w[12], [
    [0, P.wingFront],
    [0.5, "#d2d5da"],
    [1, P.wingBack],
  ]);
  const bill = linear(ctx, J.billBase, J.billTip, [
    [0, P.billBase],
    [1, P.billTip],
  ]);
  const pp = byId.pouch.pts;
  let py0 = Infinity;
  let py1 = -Infinity;
  for (const q of pp) {
    py0 = Math.min(py0, q[1]);
    py1 = Math.max(py1, q[1]);
  }
  const pouch = linear(ctx, [0, py0], [0, py1], [
    [0, P.pouchTop],
    [1, P.pouchLow],
  ]);
  const footNear = byId.footNear;
  const foot = linear(ctx, [0, footNear.pts[1][1] - 0.15 * S], [0, footNear.pts[1][1] + 0.15 * S], [
    [0, P.footTop],
    [1, P.footLow],
  ]);
  return { S, J, byId, feather, shade, tail, wing, bill, pouch, foot };
}

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/**
 * A webbed foot with three toes, the ball of the foot on the pedal. The foot is laid out in the
 * rig's own foot frame (ankle at the origin, y up, toes along +x; the pedal's centre sits at
 * (0.06, -0.13) and its top at y -0.095), recovered from the rig's web points, so it turns with
 * the ankling exactly as the rig's foot does. Three toes fan forward; the web between them dips
 * back in two clear notches; the sole rests on the pedal with a pad under the ball.
 */
const FOOT = {
  heel: [-0.13, -0.065],
  ball: [0.07, -0.098], // just on the pedal's top
  ankleBack: [-0.05, 0.03],
  ankleTop: [0.03, 0.035],
  toes: [
    [0.56, 0.0], // upper toe
    [0.67, -0.07], // middle toe, the longest
    [0.6, -0.142], // lower toe
  ],
  notches: [
    [0.53, -0.04],
    [0.565, -0.108],
  ],
};

function footFrame(sh) {
  // the rig builds the web from these local points, rotated by the ankling and scaled into the world
  const p = sh.pts;
  const A = p[0];
  const w1 = sub(p[1], A);
  const w2 = sub(p[2], A);
  const v1 = [0.5, 0.05];
  const v2 = [0.62, -0.13];
  const det = v1[0] * v2[1] - v2[0] * v1[1];
  // M = [w1 w2] * inverse([v1 v2])
  const i00 = v2[1] / det;
  const i01 = -v2[0] / det;
  const i10 = -v1[1] / det;
  const i11 = v1[0] / det;
  const m00 = w1[0] * i00 + w2[0] * i10;
  const m01 = w1[0] * i01 + w2[0] * i11;
  const m10 = w1[1] * i00 + w2[1] * i10;
  const m11 = w1[1] * i01 + w2[1] * i11;
  return (q) => [A[0] + m00 * q[0] + m01 * q[1], A[1] + m10 * q[0] + m11 * q[1]];
}

function drawFoot(ctx, sh, look, far) {
  const S = look.S;
  const W = footFrame(sh);
  const [t0, t1, t2] = FOOT.toes;
  const [n0, n1] = FOOT.notches;
  const pt = (q) => W(q);
  const quad = (c, e) => {
    const C = pt(c);
    const E = pt(e);
    ctx.quadraticCurveTo(C[0], C[1], E[0], E[1]);
  };
  ctx.beginPath();
  let q = pt(FOOT.ankleBack);
  ctx.moveTo(q[0], q[1]);
  // over the top of the foot to the upper toe
  quad(FOOT.ankleTop, [0.3, 0.03]);
  quad([0.45, 0.03], [t0[0] - 0.02, t0[1] + 0.012]);
  quad([t0[0] + 0.015, t0[1] + 0.004], [t0[0] - 0.005, t0[1] - 0.018]);
  // the web dips back to the first notch, then out to the middle toe
  quad([0.54, -0.022], n0);
  quad([0.6, -0.045], [t1[0] - 0.02, t1[1] + 0.014]);
  quad([t1[0] + 0.018, t1[1] + 0.002], [t1[0] - 0.01, t1[1] - 0.017]);
  // the second notch, then the lower toe
  quad([0.6, -0.09], n1);
  quad([0.575, -0.128], [t2[0] - 0.02, t2[1] + 0.012]);
  quad([t2[0] + 0.016, t2[1] - 0.004], [t2[0] - 0.03, t2[1] - 0.012]);
  // back along the sole, over the pad of the ball resting on the pedal, to the heel
  quad([0.32, -0.112], FOOT.ball);
  quad([-0.03, -0.1], FOOT.heel);
  quad([-0.15, -0.02], FOOT.ankleBack);
  ctx.closePath();
  ctx.fillStyle = far ? P.footFar : look.foot;
  ctx.fill();
  // the toes: darker rays from the root of the toes, each ending in a small claw
  ctx.strokeStyle = far ? rgba([122, 59, 34], 0.7) : rgba([196, 90, 38], 0.6);
  ctx.lineWidth = 0.024 * S;
  for (const t of FOOT.toes) {
    const a = pt([0.3, (t[1] + 0.07) * 0.5 - 0.07]);
    const b = pt([t[0] - 0.04, t[1]]);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    const c = pt(t);
    ctx.beginPath();
    ctx.arc(c[0], c[1], 0.018 * S, 0, Math.PI * 2);
    ctx.fillStyle = far ? "#5a2e1f" : "#a24d24";
    ctx.fill();
  }
  // the ankle joint, so the leg runs into the foot
  const A = sh.pts[0];
  ctx.beginPath();
  ctx.arc(A[0], A[1], look.byId[far ? "legFarShin" : "legNearShin"].w * 0.36, 0, Math.PI * 2);
  ctx.fillStyle = far ? P.legFar : P.leg;
  ctx.fill();
}

/** Draw one finished shape at full strength (the caller sets the alpha). */
function drawFinished(ctx, sh, look, a0, run = 1) {
  if (HIDDEN_ID.has(sh.id)) return;
  const far = sh.side === "far";
  const S = look.S;
  const J = look.J;
  const strokeIt = (color, w) => {
    const L = trace(ctx, sh, a0);
    if (run < 1) {
      if (run <= 0) return;
      ctx.setLineDash([L * run, L + 1]);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke();
    if (run < 1) ctx.setLineDash([]);
  };
  const fillIt = (style) => {
    trace(ctx, sh, a0);
    ctx.fillStyle = style;
    ctx.fill();
  };
  switch (sh.tag) {
    case "tire": {
      strokeIt(P.tire, sh.w);
      // a fine sheen on the inner face of the tyre
      if (run >= 1) {
        ctx.beginPath();
        ctx.arc(sh.c[0], sh.c[1], sh.r - sh.w * 0.32, 0, Math.PI * 2);
        ctx.strokeStyle = "#3b4250";
        ctx.lineWidth = sh.w * 0.16;
        ctx.stroke();
      }
      break;
    }
    case "rim":
      strokeIt(P.rim, sh.w * 0.9);
      break;
    case "spoke":
      strokeIt(P.spoke, 0.3);
      break;
    case "reflector":
      // the valve: a small quiet dot on the rim
      ctx.beginPath();
      ctx.arc(sh.c[0], sh.c[1], sh.r * 0.75, 0, Math.PI * 2);
      ctx.fillStyle = P.rim;
      ctx.fill();
      break;
    case "hub":
      ctx.beginPath();
      ctx.arc(sh.c[0], sh.c[1], sh.r * 1.15, 0, Math.PI * 2);
      ctx.fillStyle = P.hub;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sh.c[0], sh.c[1], sh.r * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = P.hubCore;
      ctx.fill();
      break;
    case "frame":
      strokeIt(sh.id === "chainStay" || sh.id === "seatStay" ? P.frameRear : P.frame, sh.w);
      break;
    case "post":
    case "bar":
      strokeIt(P.metal, sh.w);
      break;
    case "grip":
      strokeIt(P.ink, sh.w);
      break;
    case "bell":
      ctx.beginPath();
      ctx.arc(sh.c[0], sh.c[1], sh.r * 0.78, 0, Math.PI * 2);
      ctx.fillStyle = P.bell;
      ctx.fill();
      break;
    case "saddle": {
      fillIt(P.ink);
      // a soft highlight along the top
      const p = sh.pts;
      ctx.beginPath();
      ctx.moveTo(p[1][0], p[1][1] + 0.35);
      ctx.lineTo(p[2][0], p[2][1] + 0.35);
      ctx.strokeStyle = "#4a5263";
      ctx.lineWidth = 0.55;
      ctx.stroke();
      break;
    }
    case "chain":
      strokeIt(P.chain, 0.55);
      break;
    case "ring": {
      if (sh.id === "cog" || run < 1) {
        strokeIt(sh.id === "cog" ? P.ringCore : P.crank, sh.id === "cog" ? 0.7 : 0.8);
        break;
      }
      // the chainring: teeth round a teal ring, a five-armed spider and a bolt, turning with the crank
      const [cx, cy] = sh.c;
      const r = sh.r;
      const nT = 26;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 0.42, a0, a0 + Math.PI);
      ctx.arc(cx, cy, r + 0.42, a0 + Math.PI, a0 + 2 * Math.PI);
      const per = (2 * Math.PI * (r + 0.42)) / nT;
      ctx.setLineDash([per * 0.5, per * 0.5]);
      ctx.strokeStyle = P.ringTeeth;
      ctx.lineWidth = 0.75;
      ctx.lineCap = "butt";
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI);
      ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
      ctx.strokeStyle = P.crank;
      ctx.lineWidth = 0.85;
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 5; i += 1) {
        const ang = a0 + (i * 2 * Math.PI) / 5 + 0.3;
        ctx.moveTo(cx + Math.cos(ang) * 0.9, cy + Math.sin(ang) * 0.9);
        ctx.lineTo(cx + Math.cos(ang) * (r - 0.35), cy + Math.sin(ang) * (r - 0.35));
      }
      ctx.strokeStyle = P.ringCore;
      ctx.lineWidth = 0.55;
      ctx.stroke();
      break;
    }
    case "crank": {
      // a crank arm: tapered from the axle to the pedal, round at both ends, with the spindle
      if (run <= 0) break;
      const [p0, p1] = [sh.pts[0], sh.pts[sh.pts.length - 1]];
      const e = run < 1 ? lerp2(p0, p1, run) : p1;
      taper(ctx, p0, e, sh.w * 0.62, sh.w * 0.42);
      ctx.fillStyle = far ? P.metalFar : P.crank;
      ctx.fill();
      if (run >= 1) {
        ctx.beginPath();
        ctx.arc(p0[0], p0[1], sh.w * 0.42, 0, Math.PI * 2);
        ctx.fillStyle = far ? "#1f6e67" : P.ringCore;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p1[0], p1[1], sh.w * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = "#cfe9e5";
        ctx.fill();
      }
      break;
    }
    case "pedal":
      fillIt(far ? P.pedalFar : P.pedal);
      break;
    case "leg": {
      // the whole leg is drawn on the thigh's turn: one smooth tapered limb from the hip
      // through a rounded knee to the ankle, growing from the hip as it is drawn
      if (run <= 0 || !sh.id.endsWith("Thigh")) break;
      const side = far ? "Far" : "Near";
      const thigh = look.byId[`leg${side}Thigh`];
      const shin = look.byId[`leg${side}Shin`];
      limb(ctx, J.hip, J[`knee${side}`], J[`ankle${side}`], thigh.w * 0.66, thigh.w * 0.4, shin.w * 0.34, run);
      ctx.fillStyle = far ? P.legFar : P.leg;
      ctx.fill();
      break;
    }
    case "foot":
      drawFoot(ctx, sh, look, far);
      break;
    case "tail": {
      // three clean feathers fanned from the rump, each with a quiet edge so they read apart
      const p = sh.pts;
      const root = p[0];
      const tip = add(root, sub(p[Math.floor(p.length / 2)], root), 1.18);
      const len = Math.hypot(tip[0] - root[0], tip[1] - root[1]);
      leaf(ctx, root, tip, len * 0.34, 1, 0.75);
      ctx.fillStyle = look.tail;
      ctx.fill();
      ctx.strokeStyle = rgba(P.cool, 0.55);
      ctx.lineWidth = 0.28;
      ctx.stroke();
      break;
    }
    case "body":
      fillIt(look.feather);
      ctx.save();
      trace(ctx, sh, a0);
      ctx.clip();
      ctx.fillStyle = look.shade;
      ctx.fillRect(look.J.body[0] - 2 * S, look.J.body[1] - 1.5 * S, 4 * S, 3 * S);
      ctx.restore();
      break;
    case "neck": {
      fillIt(look.feather);
      // one continuous outline where the neck meets the body: a fillet carries the front of the
      // neck smoothly into the body's top edge, in the same gradient, so there is no notch
      const np = sh.pts;
      const n = np.length;
      const F = np[n - 1];
      const bp = look.byId.body.pts;
      let j = 0;
      for (let i = 1; i < bp.length; i += 1) {
        if (Math.hypot(bp[i][0] - F[0], bp[i][1] - F[1]) < Math.hypot(bp[j][0] - F[0], bp[j][1] - F[1])) j = i;
      }
      const B = bp[Math.max(0, j - 3)];
      const A = np[n - 4];
      ctx.beginPath();
      ctx.moveTo(A[0], A[1]);
      ctx.quadraticCurveTo(F[0], F[1] + 0.02 * S, B[0], B[1]);
      ctx.lineTo(J.body[0], J.body[1]);
      ctx.lineTo(np[0][0], np[0][1]);
      ctx.closePath();
      ctx.fillStyle = look.feather;
      ctx.fill();
      break;
    }
    case "head":
    case "crest":
      fillIt(look.feather);
      break;
    case "wing": {
      fillIt(look.wing);
      // a darker trailing edge along the lower, back edge of the wing (clipped inside it)
      const p = sh.pts;
      ctx.save();
      trace(ctx, sh, a0);
      ctx.clip();
      ctx.beginPath();
      wingEdge(ctx, p, true);
      ctx.strokeStyle = rgba(hexToRgb(P.wingEdge), 0.6);
      ctx.lineWidth = 0.16 * S;
      ctx.stroke();
      ctx.restore();
      break;
    }
    case "wingtip": {
      const p = sh.pts;
      const root = p[0];
      const tip = p[Math.floor(p.length / 2)];
      const len = Math.hypot(tip[0] - root[0], tip[1] - root[1]);
      if (sh.id.startsWith("wingHand")) {
        // a single tidy feather tip resting on the grip: wing-coloured, darkening at its end
        leaf(ctx, root, tip, len * 0.46, 0.9, 0.6);
        ctx.fillStyle = linear(ctx, root, tip, [
          [0, P.wingFront],
          [0.6, "#c4cad4"],
          [1, "#7d879a"],
        ]);
        ctx.fill();
        break;
      }
      // a clean flight feather along the wing's lower edge, shaded root to tip, with its shaft
      leaf(ctx, root, tip, len * 0.26, 1, 0.5);
      ctx.fillStyle = linear(ctx, root, tip, [
        [0, "#566074"],
        [0.5, "#3a4150"],
        [1, P.ink],
      ]);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(root[0], root[1]);
      const sh2 = lerp2(root, tip, 0.82);
      ctx.lineTo(sh2[0], sh2[1]);
      ctx.strokeStyle = "rgba(150,160,180,0.35)";
      ctx.lineWidth = 0.14;
      ctx.stroke();
      break;
    }
    case "wingfold": {
      // the fold: one soft curve through the rig's points
      const p = sh.pts;
      ctx.beginPath();
      ctx.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length - 1; i += 1) {
        const m = [(p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2];
        ctx.quadraticCurveTo(p[i][0], p[i][1], i === p.length - 2 ? p[i + 1][0] : m[0], i === p.length - 2 ? p[i + 1][1] : m[1]);
      }
      const L = pathLength(p, false);
      ctx.strokeStyle = P.wingFold;
      ctx.lineWidth = 0.5;
      ctx.setLineDash([L * 0.92, L]);
      ctx.stroke();
      ctx.setLineDash([]);
      // the secondary fold: a shorter, fainter curve below the first, towards the trailing edge
      const off = [0, 0.13 * S];
      const q = p.slice(1).map((pt, i) => add(pt, off, 0.6 + 0.4 * (i / Math.max(1, p.length - 2))));
      ctx.beginPath();
      ctx.moveTo(q[0][0], q[0][1]);
      for (let i = 1; i < q.length - 1; i += 1) {
        const m = lerp2(q[i], q[i + 1], 0.5);
        ctx.quadraticCurveTo(q[i][0], q[i][1], m[0], m[1]);
      }
      ctx.lineTo(q[q.length - 1][0], q[q.length - 1][1]);
      ctx.strokeStyle = rgba(hexToRgb(P.wingFold), 0.7);
      ctx.lineWidth = 0.4;
      ctx.stroke();
      break;
    }
    case "bill":
      if (sh.id === "billUpper") {
        fillIt(look.bill);
        const p = sh.pts;
        // the ridge along the top of the bill
        ctx.beginPath();
        ctx.moveTo(p[0][0], p[0][1]);
        for (let i = 1; i <= 4; i += 1) ctx.lineTo(p[i][0], p[i][1]);
        ctx.strokeStyle = P.billRidge;
        ctx.lineWidth = 0.55;
        ctx.globalAlpha *= 0.8;
        ctx.stroke();
        ctx.globalAlpha /= 0.8;
        // the hooked nail at the tip
        ctx.beginPath();
        ctx.moveTo(p[3][0] * 0.35 + p[4][0] * 0.65, p[3][1] * 0.35 + p[4][1] * 0.65);
        for (let i = 4; i <= 7; i += 1) ctx.lineTo(p[i][0], p[i][1]);
        ctx.closePath();
        ctx.fillStyle = P.billNail;
        ctx.fill();
        // a soft base: bare skin blends into the bill instead of a hard cut across the face
        const base = J.billBase;
        const along = lerp2(base, J.billTip, 0.16);
        ctx.save();
        trace(ctx, sh, a0);
        ctx.clip();
        ctx.fillStyle = linear(ctx, base, along, [
          [0, "rgba(243,203,166,0.9)"],
          [1, "rgba(243,203,166,0)"],
        ]);
        ctx.fillRect(base[0] - S, base[1] - S, 2 * S, 2 * S);
        ctx.restore();
        // the gape: a fine dark line, the mouth's corner, from the base of the bill back under
        // the eye, sagging a touch and thinning out at its end
        const g0 = add(p[p.length - 1], sub(J.billTip, J.billBase), 0.06);
        const g1 = [J.eye[0] - 0.1 * S, J.eye[1] + 0.2 * S];
        const gc = [(g0[0] + g1[0]) / 2, Math.max(g0[1], g1[1]) + 0.035 * S];
        ctx.beginPath();
        ctx.moveTo(g0[0], g0[1]);
        ctx.quadraticCurveTo(gc[0], gc[1], g1[0], g1[1]);
        ctx.strokeStyle = linear(ctx, g0, g1, [
          [0, rgba(hexToRgb(P.gape), 0.95)],
          [0.75, rgba(hexToRgb(P.gape), 0.85)],
          [1, rgba(hexToRgb(P.gape), 0.3)],
        ]);
        ctx.lineWidth = 0.036 * S;
        ctx.stroke();
      } else {
        fillIt(P.billLower);
      }
      break;
    case "pouch":
      fillIt(look.pouch);
      break;
    case "eye":
      // bare skin round a dark eye, drawn out a little towards the base of the bill
      {
        const to = sub(J.billBase, sh.c);
        const ang = Math.atan2(to[1], to[0]);
        const c = add(sh.c, to, 0.16);
        ctx.beginPath();
        ctx.ellipse(c[0], c[1], sh.r * 1.75, sh.r * 1.45, ang, 0, Math.PI * 2);
        ctx.fillStyle = P.skin;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(sh.c[0], sh.c[1], sh.r * 0.82, 0, Math.PI * 2);
      ctx.fillStyle = P.iris;
      ctx.fill();
      break;
    case "pupil":
      // the catch-light
      ctx.beginPath();
      ctx.arc(sh.c[0] + sh.r * 0.55, sh.c[1] - sh.r * 0.55, sh.r * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      break;
    case "lid": {
      const r = sh.r * 1.5;
      ctx.save();
      ctx.beginPath();
      ctx.arc(sh.c[0], sh.c[1], r, 0, Math.PI * 2);
      ctx.clip();
      const h = 2 * r * sh.amount;
      ctx.fillStyle = P.skin;
      ctx.fillRect(sh.c[0] - r, sh.c[1] - r, 2 * r, h);
      ctx.restore();
      break;
    }
    default:
      break;
  }
}

/** The colour of the fine line that runs round a filled shape before its fill arrives. */
function runColor(sh) {
  switch (sh.tag) {
    case "bill":
      return P.billBase;
    case "pouch":
      return P.pouchTop;
    case "foot":
      return sh.side === "far" ? P.legFar : P.leg;
    case "wingtip":
    case "saddle":
    case "pedal":
      return "#596274";
    case "hub":
    case "reflector":
      return P.rim;
    case "bell":
      return P.bell;
    case "wing":
      return P.wingFront;
    case "eye":
    case "pupil":
    case "lid":
      return P.skin;
    default:
      return P.feather;
  }
}

/** Anchor points a vector editor would show for this shape while it is a construction outline. */
function handlesFor(sh, skel) {
  const J = skel.joints;
  switch (sh.id) {
    case "tireRear":
      return [J.rear];
    case "tireFront":
      return [J.front];
    // the frame shows handles only at its three main joints: bottom bracket, seat cluster, head
    case "seatTube":
      return [sh.pts[0], sh.pts[sh.pts.length - 1]];
    case "headTube": {
      const [p0, p1] = [sh.pts[0], sh.pts[sh.pts.length - 1]];
      return [p0[1] < p1[1] ? p0 : p1];
    }
    case "bar":
      return [sh.pts[sh.pts.length - 1]];
    case "body":
      return [sh.pts[0], sh.pts[22]];
    case "head":
      return [J.head];
    case "billUpper":
      return [J.billTip];
    case "pouch": {
      let best = sh.pts[0];
      for (const q of sh.pts) if (q[1] > best[1]) best = q;
      return [best];
    }
    case "wing":
      return [J.wingTip, sh.pts[12]];
    case "tail1":
      return [sh.pts[5]];
    default:
      return [];
  }
}

const WIPE_SOFT = 3; // world units: the soft front of a fill's wipe

/**
 * The direction a group's fill sweeps in, following the way the part grows: the body from the
 * tail forward, the neck up from its base, the head upward, the bill and pouch from base to
 * tip, the wing from the shoulder back, legs and feet downward, small parts left to right.
 * Returns [origin, unit direction].
 */
function wipeAxis(shapes, skel) {
  const J = skel.joints;
  const S = skel.scale;
  const has = (t) => shapes.some((sh) => sh.tag === t);
  let a = null;
  let b = null;
  if (has("body") || has("tail")) [a, b] = [J.tailRoot, J.shoulder];
  else if (has("neck")) [a, b] = [J.neckBase, J.head];
  else if (has("head")) [a, b] = [[J.head[0], J.head[1] + 0.5 * S], J.top];
  else if (has("bill") || has("pouch")) [a, b] = [J.billBase, J.billTip];
  else if (has("wing")) [a, b] = [J.shoulder, J.tailRoot];
  else if (has("foot") || has("leg")) [a, b] = [J.hip, [J.hip[0], J.hip[1] + S]];
  else [a, b] = [[J.rear[0], J.rear[1]], [J.rear[0] + S, J.rear[1]]];
  const d = [b[0] - a[0], b[1] - a[1]];
  const L = Math.hypot(d[0], d[1]) || 1;
  return [a, [d[0] / L, d[1] / L]];
}

/**
 * Shapes in drawing order: the rig's back-to-front, with two changes. The crest moves just behind
 * the head. The far side (crank, pedal, then leg and foot on it) moves from behind the wheels to
 * just behind the frame, so the far leg is seen through the frame on its pedal, in its darker
 * tone, instead of being cut up by the rear tyre.
 */
const FAR_ORDER = ["crankFar", "pedalFar", "legFarThigh", "legFarShin", "footFar"];
function ordered(shapes) {
  const crest = shapes.filter((s) => s.tag === "crest");
  const far = FAR_ORDER.map((id) => shapes.find((s) => s.id === id)).filter(Boolean);
  const out = [];
  for (const sh of shapes) {
    if (sh.tag === "crest" || FAR_ORDER.includes(sh.id)) continue;
    if (sh.id === "chainStay") out.push(...far);
    if (sh.id === "head") out.push(...crest);
    out.push(sh);
  }
  return out;
}

/**
 * Draw the figure for this frame. See the interface at the top of the file.
 */
export function drawCodeFigure(stage, f, skel, parts) {
  const u = f.u;
  const reveal = parts.reveal || 0.3;
  const S = skel.scale;
  const b = skel.bounds;
  const ground = parts.ground ?? 700;
  const rect = [b.x0 - 6, b.y0 - 4, b.x1 + 6, Math.max(b.y1, ground) + S * 0.5];
  const patch = stage.patch("code/figure", f.view, ...rect);
  const ctx = patch.ctx;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const wheel = f.pelican.wheel || 0;
  const crank = f.pelican.crank || 0;
  const look = makeLook(ctx, skel);
  const gl = guideLook(u);

  // ------------------------------------------------ the soft shadow on the ground
  drawShadow(ctx, f.pelican.x, ground, S, skel, (u - parts.shadow) / reveal, gl);

  // ------------------------------------------------ groups of shapes that share a time
  const list = ordered(skel.shapes);
  const groups = [];
  for (const sh of list) {
    const t = parts.timeOf(sh);
    const g = groups[groups.length - 1];
    if (g && g.t === t) g.shapes.push(sh);
    else groups.push({ t, shapes: [sh] });
  }

  const handles = [];
  for (const g of groups) {
    const k = (u - g.t) / reveal; // < 0 not yet, 0..1 drawing, >= 1 done
    // front-loaded, so the part reads on its beat: the outline is round by k 0.55, the fill
    // is up by k 0.72 (a short fade, so white never lingers as grey over the dark canvas)
    const run = smoother(0, 0.55, k);
    const fa = smoother(0.26, 0.72, k);
    const guide = k <= 0 ? 1 : 1 - smooth(0.24, 0.78, k);

    if (k >= 1) {
      for (const sh of g.shapes) drawFinished(ctx, sh, look, startAngle(sh, wheel, crank));
    } else if (k > 0) {
      // the fills, painted whole and laid down at one alpha
      const fills = g.shapes.filter((sh) => !STROKED.has(sh.tag));
      if (fa > 0 && fills.length) {
        const scratch = stage.patch("code/figure-part", f.view, ...rect);
        scratch.ctx.lineCap = "round";
        scratch.ctx.lineJoin = "round";
        const sLook = makeLook(scratch.ctx, skel);
        for (const sh of g.shapes) if (!STROKED.has(sh.tag) || sh.tag === "wingfold") drawFinished(scratch.ctx, sh, sLook, startAngle(sh, wheel, crank));
        // a soft wipe, not a fade: the fill sweeps across the part at full strength, so a white
        // fill never sits grey over the dark canvas; only its few-unit soft front is partial
        const [o, dir] = wipeAxis(g.shapes, skel);
        let lo = Infinity;
        let hi = -Infinity;
        for (const sh of fills) {
          const pts = sh.kind === "circle" ? [[sh.c[0] - sh.r, sh.c[1] - sh.r], [sh.c[0] + sh.r, sh.c[1] + sh.r], [sh.c[0] - sh.r, sh.c[1] + sh.r], [sh.c[0] + sh.r, sh.c[1] - sh.r]] : sh.pts;
          for (const q of pts) {
            const v = (q[0] - o[0]) * dir[0] + (q[1] - o[1]) * dir[1];
            lo = Math.min(lo, v);
            hi = Math.max(hi, v);
          }
        }
        // a margin for strokes and for what a shape draws beyond its points (feathers, toes)
        lo -= 0.25 * S;
        hi += 0.25 * S;
        const front = lo + (hi - lo + WIPE_SOFT) * fa;
        const sc = scratch.ctx;
        sc.save();
        sc.globalCompositeOperation = "destination-in";
        const g0 = [o[0] + dir[0] * (front - WIPE_SOFT), o[1] + dir[1] * (front - WIPE_SOFT)];
        const g1 = [o[0] + dir[0] * front, o[1] + dir[1] * front];
        sc.fillStyle = linear(sc, g0, g1, [
          [0, "rgba(0,0,0,1)"],
          [1, "rgba(0,0,0,0)"],
        ]);
        sc.fillRect(rect[0] - 10, rect[1] - 10, rect[2] - rect[0] + 20, rect[3] - rect[1] + 20);
        sc.restore();
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(scratch.layer.canvas, 0, 0);
        ctx.restore();
      }
      // the strokes run round at full strength; a fade-in over the first few frames keeps the round cap from popping
      const capIn = smooth(0, 0.08, run);
      for (const sh of g.shapes) {
        if (!STROKED.has(sh.tag) || sh.tag === "wingfold") continue;
        // spokes grow from the hub a moment after the tyre has begun
        const r = sh.tag === "spoke" || sh.tag === "rim" ? smoother(0.1, 0.62, k) : run;
        ctx.globalAlpha = capIn;
        drawFinished(ctx, sh, look, startAngle(sh, wheel, crank), r);
      }
      ctx.globalAlpha = 1;
      // the fine line round each fill, which gives way as the fill arrives
      const lineA = 1 - smooth(0.45, 0.85, k);
      if (lineA > 0.001) {
        for (const sh of fills) {
          if (sh.tag === "pupil" || sh.tag === "lid" || sh.tag === "reflector" || HIDDEN_ID.has(sh.id)) continue;
          const L = trace(ctx, sh, startAngle(sh, wheel, crank));
          ctx.setLineDash([L * run, L + 1]);
          ctx.strokeStyle = runColor(sh);
          ctx.lineWidth = 0.8;
          ctx.globalAlpha = lineA * capIn;
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.globalAlpha = 1;
      }
    }

    // the construction line
    if (guide > 0.001) {
      for (const sh of g.shapes) {
        if (NO_GUIDE.has(sh.tag) || NO_GUIDE_ID.has(sh.id) || HIDDEN_ID.has(sh.id)) continue;
        const L = trace(ctx, sh, startAngle(sh, wheel, crank));
        const small = sh.kind !== "line" && L < DASH_MIN;
        // dashes fitted to the path, so a closed path ends on a whole gap and an open one on a whole dash
        if (small) ctx.setLineDash([]);
        else {
          const closed = sh.kind === "circle" || sh.closed;
          const n = Math.max(3, Math.round((L + (closed ? 0 : DASH[1])) / (DASH[0] + DASH[1])));
          const unit = (L + (closed ? 0 : DASH[1])) / n;
          ctx.setLineDash([unit * 0.57, unit * 0.43]);
        }
        ctx.lineDashOffset = 0;
        ctx.lineWidth = small ? gl.w * 0.8 : gl.w;
        let a = gl.a * guide * (small ? 0.85 : 1);
        if (sh.tag === "wingtip" || sh.tag === "crest") a *= 0.7;
        ctx.strokeStyle = rgba(gl.c, a);
        ctx.stroke();
        ctx.setLineDash([]);
        for (const pt of handlesFor(sh, skel)) handles.push([pt[0], pt[1], guide]);
      }
    }
  }

  // ------------------------------------------------ square handles on top, merged where two shapes share a point
  const placed = [];
  ctx.lineWidth = 0.5;
  for (const [x, y, g] of handles) {
    if (placed.some((q) => Math.abs(q[0] - x) < 3.2 && Math.abs(q[1] - y) < 3.2)) continue;
    placed.push([x, y]);
    ctx.globalAlpha = g;
    ctx.fillStyle = BG;
    ctx.fillRect(x - HANDLE / 2, y - HANDLE / 2, HANDLE, HANDLE);
    ctx.strokeStyle = rgba(gl.c, 0.95);
    ctx.strokeRect(x - HANDLE / 2, y - HANDLE / 2, HANDLE, HANDLE);
  }
  ctx.globalAlpha = 1;
  stage.imagePatch(patch);
}

/** The soft shadow: a wide pool under the bicycle and a darker contact under each tyre. */
function drawShadow(ctx, cx, ground, S, skel, k, gl) {
  const J = skel.joints;
  const y = ground + 0.03 * S;
  const pool = (x, rx, ry, a) => {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, `rgba(3,5,8,${a})`);
    g.addColorStop(0.55, `rgba(3,5,8,${a * 0.55})`);
    g.addColorStop(1, "rgba(3,5,8,0)");
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx, ry);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  if (k > 0) {
    const fa = smoother(0.26, 0.8, k);
    ctx.globalAlpha = fa;
    pool(cx - 0.05 * S, 2.75 * S, 0.24 * S, 0.85);
    pool(J.rear[0], 0.95 * S, 0.11 * S, 0.9);
    pool(J.front[0], 0.95 * S, 0.11 * S, 0.9);
    ctx.globalAlpha = 1;
  }
  const guide = k <= 0 ? 1 : 1 - smooth(0.24, 0.78, k);
  if (guide > 0.001) {
    const rx = 2.45 * S;
    const ry = 0.2 * S;
    // the construction ellipse, running from its right end
    ctx.setLineDash(DASH);
    ctx.lineWidth = gl.w * 0.9;
    ctx.strokeStyle = rgba(gl.c, gl.a * 0.75 * guide);
    ctx.beginPath();
    ctx.ellipse(cx, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (k > 0 && k < 1) {
    // the ellipse's outline runs round once, then gives way to the soft pool
    const run = smoother(0, 0.55, k);
    const lineA = 1 - smooth(0.45, 0.85, k);
    if (run > 0 && lineA > 0.001) {
      ctx.beginPath();
      ctx.ellipse(cx, y, 2.45 * S, 0.2 * S, 0, 0, Math.PI * 2 * run);
      ctx.strokeStyle = rgba(GUIDE, 0.6 * lineA * smooth(0, 0.08, run));
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }
}
