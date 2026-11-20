// The pelican and its bicycle as a parameterised skeletal puppet.
//
// solveRig(pose) turns one set of pose parameters into joints and outline
// shapes. Every art style draws from the same result with its own "skin",
// so the motion stays continuous while the look changes from frame to frame.
//
// Rig space: lengths are in wheel radii, x points forward (the way the pelican
// rides, towards screen right), y points up, and the origin is the point on
// the road midway between the two wheels. The result is converted to the
// caller's units (y down) on the way out.

import { TAU, clamp, deg, lerp } from "../beat/ease.js";
import { wobble } from "../kit/rng.js";

/** Wheel turns per pedal turn. With one pedal turn per second this sets the wheel size. */
export const GEAR = 1.25;

/** Crank angle at a beat: the right pedal is forward, at three o'clock. */
export const CRANK_ON_BEAT = Math.PI / 2;

// Proportions in wheel radii, measured from the rear wheel's contact point.
const G = {
  wheelbase: 3.0,
  bb: [1.22, 0.78], // bottom bracket (pedal axle)
  crank: 0.5,
  seatAngle: deg(73),
  seatTube: 1.42,
  seatPost: 0.3,
  crown: [2.63, 2.02], // top of the fork
  headAngle: deg(72),
  headTube: 0.42,
  stem: 0.18,
  barEnd: [2.66, 2.8],
  grip: [2.1, 2.88],
  ring: 0.27,
  cog: 0.216, // ring / cog = GEAR
  // pelican
  body: [1.0, 3.26],
  bodyA: 1.3,
  bodyB: 0.86,
  bodyTilt: deg(26),
  hip: [1.02, 2.72],
  thigh: 1.28,
  shin: 1.22,
  neckBase: [0.8, 0.62], // on the body ellipse, as fractions of its semi-axes
  head: [2.14, 5.6],
  headR: 0.37,
  billLen: 2.1,
  billAngle: deg(-13),
  shoulder: [0.55, 0.36], // wing pivot, in body-local coordinates
};

/** Distance between the wheel axles, in wheel radii. */
export const WHEELBASE = G.wheelbase;

const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, s) => [a[0] * s, a[1] * s];
const len = (a) => Math.hypot(a[0], a[1]);
const rot = (a, t) => {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [a[0] * c - a[1] * s, a[0] * s + a[1] * c];
};
const dirOf = (t) => [Math.cos(t), Math.sin(t)];
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

function cubic(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}

function quad(p0, p1, p2, t) {
  const u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
}

function circlePts(c, r, n = 32) {
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * TAU;
    pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
  }
  return pts;
}

/** Turn a centre line and a half-width profile into a closed ribbon polygon. */
function ribbon(center, halfWidth) {
  const left = [];
  const right = [];
  const n = center.length;
  for (let i = 0; i < n; i += 1) {
    const a = center[Math.max(0, i - 1)];
    const b = center[Math.min(n - 1, i + 1)];
    const t = sub(b, a);
    const l = len(t) || 1;
    const nx = -t[1] / l;
    const ny = t[0] / l;
    const w = halfWidth(i / (n - 1));
    left.push([center[i][0] + nx * w, center[i][1] + ny * w]);
    right.push([center[i][0] - nx * w, center[i][1] - ny * w]);
  }
  return left.concat(right.reverse());
}

/** Two-bone IK. Returns the middle joint; bend = +1 puts it to the left of root->target. */
function ik2(root, target, a, b, bend) {
  const d = sub(target, root);
  const dist = clamp(len(d), Math.abs(a - b) + 1e-4, a + b - 1e-4);
  const u = mul(d, 1 / (len(d) || 1));
  const along = (a * a - b * b + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, a * a - along * along));
  return [root[0] + u[0] * along - u[1] * h * bend, root[1] + u[1] * along + u[0] * h * bend];
}

/** A slim leaf-shaped feather from root, pointing along angle. */
function feather(root, angle, length, width, n = 7) {
  const pts = [];
  const d = dirOf(angle);
  const nrm = [-d[1], d[0]];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const w = width * Math.sin(Math.PI * t ** 0.75) * 0.5;
    pts.push([root[0] + d[0] * length * t + nrm[0] * w, root[1] + d[1] * length * t + nrm[1] * w]);
  }
  for (let i = n - 1; i >= 1; i -= 1) {
    const t = i / n;
    const w = width * Math.sin(Math.PI * t ** 0.75) * 0.5;
    pts.push([root[0] + d[0] * length * t - nrm[0] * w, root[1] + d[1] * length * t - nrm[1] * w]);
  }
  return pts;
}

/**
 * Default acting values. Scenes override any of them through pose.act.
 */
export const ACT = {
  bob: 1, // strength of the pedalling bob and sway
  lean: 0, // extra forward lean of the body, radians
  neckStretch: 0, // -1 tucked .. +1 craned
  headPitch: 0, // radians, positive looks up
  headTurn: 0, // -1 looks back over the shoulder .. 0 forward
  beakOpen: 0, // radians the lower bill drops
  pouch: 1, // pouch size multiplier
  eyeX: 0, // pupil offset, -1..1
  eyeY: 0,
  lid: 0, // 0 open .. 1 closed (added to the automatic blink)
  wing: 0, // 0 = on the handlebar, 1 = raised
  tail: 0, // extra tail lift, radians
  wind: 1, // how much feathers and pouch trail in the airflow
};

/**
 * Solve the puppet.
 *
 * pose = {
 *   x, y       road point under the middle of the bicycle, in caller units (y down)
 *   scale      caller units per wheel radius
 *   slope      radians, positive = climbing
 *   crank      pedal angle in radians; 0 = right pedal at the top, rising values pedal forward
 *   wheel      wheel rolling angle in radians
 *   time       seconds, drives the small secondary motions
 *   act        optional acting overrides, see ACT
 * }
 */
export function solveRig(pose) {
  const act = { ...ACT, ...(pose.act || {}) };
  const S = pose.scale;
  const slope = pose.slope || 0;
  const th = pose.crank;
  const time = pose.time || 0;
  const half = G.wheelbase / 2;
  const cs = Math.cos(slope);
  const sn = Math.sin(slope);

  // rig (rear-contact origin) -> caller units
  const out = (pt) => {
    const lx = pt[0] - half;
    const ly = pt[1];
    return [pose.x + S * (lx * cs - ly * sn), pose.y - S * (lx * sn + ly * cs)];
  };
  const outAll = (pts) => pts.map(out);

  // ------------------------------------------------------------ bicycle
  const rear = [0, 1];
  const front = [G.wheelbase, 1];
  const bb = G.bb;
  const seatDir = [-Math.cos(G.seatAngle), Math.sin(G.seatAngle)];
  const seatCluster = add(bb, mul(seatDir, G.seatTube));
  const saddle = add(bb, mul(seatDir, G.seatTube + G.seatPost));
  const headDir = [-Math.cos(G.headAngle), Math.sin(G.headAngle)];
  const crown = G.crown;
  const headTop = add(crown, mul(headDir, G.headTube));
  const stemTop = add(headTop, mul(headDir, G.stem));
  const grip = G.grip;

  const pedalAt = (angle) => add(bb, mul([Math.sin(angle), Math.cos(angle)], G.crank));
  const pedalNear = pedalAt(th);
  const pedalFar = pedalAt(th + Math.PI);

  // ------------------------------------------------------------ body motion
  const stroke = 2 * th; // both legs: two power strokes per turn
  const bob = act.bob;
  const bodyDy = -0.03 * Math.cos(stroke - Math.PI) * bob; // sinks slightly on each push
  const bodyDx = 0.018 * Math.sin(stroke - 0.4) * bob;
  const tilt = G.bodyTilt - act.lean + deg(1.1) * Math.sin(stroke + 0.6) * bob;
  const body = add(G.body, [bodyDx, bodyDy]);
  const bodyLocal = (pt) => add(body, rot(pt, tilt));

  const bodyOutline = [];
  const nBody = 44;
  for (let i = 0; i < nBody; i += 1) {
    const a = (i / nBody) * TAU;
    // an egg: fuller at the breast, tapering to the tail
    const k = 1 + 0.1 * Math.cos(a);
    bodyOutline.push(bodyLocal([Math.cos(a) * G.bodyA * k, Math.sin(a) * G.bodyB * (1 + 0.06 * Math.cos(a))]));
  }

  // ------------------------------------------------------------ legs
  const hip = add(G.hip, [bodyDx, bodyDy * 0.6]);
  const leg = (pedal, phase) => {
    const footTilt = 0.3 * Math.sin(phase + 0.5); // ankling: toes dip on the way down
    const ankle = add(pedal, rot([-0.06, 0.13], footTilt));
    const knee = ik2(hip, ankle, G.thigh, G.shin, -1);
    const heel = add(ankle, rot([-0.16, -0.1], footTilt));
    const toe = add(ankle, rot([0.62, -0.13], footTilt));
    const toeTop = add(ankle, rot([0.5, 0.05], footTilt));
    const web = [ankle, toeTop, toe, add(ankle, rot([0.38, -0.2], footTilt)), add(ankle, rot([0.12, -0.17], footTilt)), heel];
    const plate = [
      add(pedal, rot([-0.2, 0.035], footTilt)),
      add(pedal, rot([0.2, 0.035], footTilt)),
      add(pedal, rot([0.2, -0.035], footTilt)),
      add(pedal, rot([-0.2, -0.035], footTilt)),
    ];
    return { hip, knee, ankle, web, plate, pedal, footTilt };
  };
  const legNear = leg(pedalNear, th);
  const legFar = leg(pedalFar, th + Math.PI);

  // ------------------------------------------------------------ neck, head, bill
  const neckBase = bodyLocal([G.bodyA * G.neckBase[0], G.bodyB * G.neckBase[1]]);
  const drift = wobble(time * 0.31, 11);
  const turn = act.headTurn; // 0 forward .. -1 looking back
  const headRest = add(G.head, [
    0.035 * Math.sin(stroke - 2.0) * bob + 0.05 * drift + 0.18 * act.neckStretch - 0.55 * Math.abs(turn),
    0.02 * Math.cos(stroke - 1.2) * bob + bodyDy * 0.3 + 0.32 * act.neckStretch,
  ]);
  const facing = turn < -0.5 ? -1 : 1; // which way the bill points
  const headPitch = act.headPitch + deg(2.2) * wobble(time * 0.23, 23) + deg(0.9) * Math.sin(stroke - 2.4) * bob;
  const neckP1 = add(neckBase, [-0.5 + 0.05 * Math.sin(stroke - 0.8) * bob, 0.7 + 0.1 * act.neckStretch]);
  const neckP2 = add(headRest, [(-0.62 + 0.07 * Math.sin(stroke - 1.4) * bob) * facing, -0.6]);
  const neckP3 = add(headRest, [-0.12 * facing, -0.22]);
  const neckCenter = [];
  const nNeck = 16;
  for (let i = 0; i <= nNeck; i += 1) neckCenter.push(cubic(neckBase, neckP1, neckP2, neckP3, i / nNeck));
  const neck = ribbon(neckCenter, (t) => lerp(0.27, 0.15, t ** 0.7));

  const headC = headRest;
  const headOutline = circlePts(headC, G.headR, 22).map((pt) => {
    // slightly long skull, stretched along the bill
    const d = sub(pt, headC);
    return add(headC, [d[0] * 1.08, d[1] * 0.95]);
  });

  const billAngle = facing > 0 ? G.billAngle + headPitch : Math.PI - (G.billAngle + headPitch);
  const billBase = add(headC, rot([0.27, -0.04], facing > 0 ? headPitch : -headPitch));
  const billBaseF = facing > 0 ? billBase : add(headC, [-(billBase[0] - headC[0]), billBase[1] - headC[1]]);
  const L = G.billLen;
  // bill-local: x along the bill, y perpendicular (up when facing forward)
  const flipY = facing > 0 ? 1 : -1;
  const billPt = (bx, by) => add(billBaseF, rot([bx, by * flipY], billAngle));
  const upper = [
    billPt(-0.04, 0.16),
    billPt(L * 0.25, 0.14),
    billPt(L * 0.6, 0.1),
    billPt(L * 0.9, 0.065),
    billPt(L, 0.03),
    billPt(L + 0.02, -0.06),
    billPt(L - 0.06, -0.12), // the hooked nail
    billPt(L - 0.1, -0.03),
    billPt(L * 0.6, -0.02),
    billPt(0, -0.03),
  ];
  const open = act.beakOpen;
  const lowerPt = (bx, by) => {
    const p = rot([bx, by], -open);
    return billPt(p[0], p[1] - 0.03);
  };
  const lowerBill = [lowerPt(0, 0), lowerPt(L * 0.5, -0.005), lowerPt(L * 0.93, -0.02), lowerPt(L * 0.93, -0.07), lowerPt(L * 0.5, -0.075), lowerPt(0, -0.09)];

  const wind = act.wind;
  const sag = (0.42 + 0.05 * Math.sin(stroke - 2.2) * bob) * act.pouch;
  const sway = -0.1 * wind + 0.05 * Math.sin(stroke - 2.6) * bob;
  const pouch = [];
  const nPouch = 14;
  const p0 = 0.04 * L;
  const p1 = 0.9 * L;
  for (let i = 0; i <= nPouch; i += 1) pouch.push(lowerPt(lerp(p0, p1, i / nPouch), -0.06));
  for (let i = nPouch; i >= 0; i -= 1) {
    const t = i / nPouch;
    const belly = Math.sin(Math.PI * t ** 0.8) ** 0.9;
    pouch.push(lowerPt(lerp(p0, p1, t) + sway * belly * 2.2, -0.06 - sag * belly));
  }

  const eyeC = add(headC, rot([0.11 * facing, 0.09], facing > 0 ? headPitch : -headPitch));
  const eyeR = 0.1;
  const pupilC = add(eyeC, [act.eyeX * 0.035, act.eyeY * 0.035]);
  const blinkPhase = (time / 3.1 + 0.37) % 1;
  const lid = clamp(act.lid + (blinkPhase < 0.035 ? 1 : 0));

  const crestRoot = add(headC, [-0.27 * facing, 0.12]);
  const flutter = Math.sin(time * 9.0) * 0.1 * wind;
  const crest = [0, 1, 2].map((i) => {
    const base = facing > 0 ? Math.PI - 0.25 - i * 0.3 + flutter : 0.25 + i * 0.3 - flutter;
    return feather(add(crestRoot, [0, -0.05 * i]), base, 0.34 - i * 0.04, 0.09, 4);
  });

  // ------------------------------------------------------------ tail
  const tailRoot = bodyLocal([-G.bodyA * 0.98, -0.02]);
  const tailWag = deg(5) * Math.sin(stroke - 1.0) * bob + act.tail;
  const tailAngle = Math.PI + tilt * 0.55 + tailWag;
  const tail = [-1, 0, 1].map((i) => feather(tailRoot, tailAngle + i * 0.2 + (i === 0 ? 0 : flutter * 0.25), 0.5 - Math.abs(i) * 0.05, 0.3, 5));

  // ------------------------------------------------------------ wing
  // A folded wing: the wrist sits forward, resting on the handlebar grip, and
  // the flight feathers sweep back along the body past the tail.
  const raise = act.wing;
  const pivot = G.shoulder;
  const gripLocal = rot(sub(grip, body), -tilt);
  const wrist = mix([0.78, -0.6], gripLocal, 0.92);
  const wingLocal = (pt) => {
    // raising the wing swings it up about the shoulder and opens it out
    const rel = sub(pt, pivot);
    const swung = rot(mul(rel, 1 + 0.3 * raise), raise * deg(72));
    return bodyLocal(add(pivot, swung));
  };
  const wingOutline = [
    [0.66, 0.5],
    [0.9, 0.1],
    [wrist[0] + 0.1, wrist[1] + 0.22],
    [wrist[0] + 0.06, wrist[1]],
    [wrist[0] - 0.14, wrist[1] - 0.04],
    [0.42, -0.6],
    [0.18, -0.5],
    [-0.02, -0.58],
    [-0.28, -0.44],
    [-0.5, -0.5],
    [-0.76, -0.33],
    [-0.98, -0.36],
    [-1.3, -0.14],
    [-1.02, 0.06],
    [-0.5, 0.3],
    [0.1, 0.52],
  ].map(wingLocal);
  const wingFold = [
    [0.6, 0.18],
    [0.2, -0.12],
    [-0.35, -0.16],
    [-0.9, -0.08],
  ].map(wingLocal);
  // dark flight feathers trailing off the back of the wing
  const wingTips = [0, 1, 2, 3].map((i) => {
    const root = wingLocal([-0.62 - i * 0.2, -0.3 + i * 0.07]);
    const ang = Math.PI + tilt + raise * deg(72) + deg(14) - i * deg(7) + flutter * (0.12 + 0.08 * i) * (1 + raise);
    return feather(root, ang, 0.78 - i * 0.06, 0.2, 5);
  });
  const wingHand = [0, 1].map((i) => {
    const root = wingLocal([wrist[0] - 0.02 - i * 0.07, wrist[1] + 0.04]);
    return feather(root, tilt + raise * deg(72) - deg(62) - i * deg(26), 0.26, 0.11, 4);
  });
  const shoulder = bodyLocal(pivot);
  const wingTarget = wingLocal(wrist);
  const wingCenter = [wingLocal([0.66, 0.4]), wingLocal([0.8, -0.1]), wingTarget];

  // ------------------------------------------------------------ wheels
  const spokes = (c, angle) => {
    const lines = [];
    const n = 10;
    for (let i = 0; i < n; i += 1) {
      const a = -angle + (i / n) * TAU; // rig space has y up, so rolling forward is clockwise
      lines.push([add(c, mul(dirOf(a), 0.08)), add(c, mul(dirOf(a), 0.86))]);
    }
    return lines;
  };
  const valve = (c, angle) => add(c, mul(dirOf(-angle + 0.3), 0.7));

  // chain: tangent runs between chainring and rear cog
  const chainTop = [add(rear, [0, G.cog]), add(bb, [0, G.ring])];
  const chainBottom = [add(rear, [0, -G.cog]), add(bb, [0, -G.ring])];

  // ------------------------------------------------------------ shapes, back to front
  const shapes = [];
  const push = (shape) => shapes.push(shape);
  const poly = (id, tag, pts, extra = {}) => push({ id, tag, kind: "poly", pts: outAll(pts), closed: true, ...extra });
  const line = (id, tag, pts, w, extra = {}) => push({ id, tag, kind: "line", pts: outAll(pts), w: w * S, closed: false, ...extra });
  const circle = (id, tag, c, r, extra = {}) => push({ id, tag, kind: "circle", c: out(c), r: r * S, ...extra });

  // far side
  line("legFarThigh", "leg", [legFar.hip, legFar.knee], 0.12, { side: "far" });
  line("legFarShin", "leg", [legFar.knee, legFar.ankle], 0.1, { side: "far" });
  poly("footFar", "foot", legFar.web, { side: "far" });
  line("crankFar", "crank", [bb, pedalFar], 0.09, { side: "far" });
  poly("pedalFar", "pedal", legFar.plate, { side: "far" });

  // wheels
  for (const [name, c] of [
    ["Rear", rear],
    ["Front", front],
  ]) {
    circle(`tire${name}`, "tire", c, 0.94, { w: 0.12 * S });
    circle(`rim${name}`, "rim", c, 0.85, { w: 0.035 * S });
    spokes(c, pose.wheel).forEach((seg, i) => line(`spoke${name}${i}`, "spoke", seg, 0.018));
    circle(`valve${name}`, "reflector", valve(c, pose.wheel), 0.055);
    circle(`hub${name}`, "hub", c, 0.09);
  }

  // frame
  const tube = 0.1;
  line("chainStay", "frame", [bb, rear], tube * 0.8);
  line("seatStay", "frame", [seatCluster, rear], tube * 0.7);
  line("seatTube", "frame", [bb, seatCluster], tube);
  line("downTube", "frame", [bb, add(crown, [-0.02, 0.07])], tube);
  line("topTube", "frame", [seatCluster, add(headTop, [0.02, -0.07])], tube);
  line("headTube", "frame", [crown, headTop], tube * 1.25);
  line("fork", "frame", [crown, add(mix(crown, front, 0.6), [0.05, 0]), front], tube * 0.8);
  line("seatPost", "post", [seatCluster, saddle], tube * 0.6);
  line("stem", "post", [headTop, stemTop, G.barEnd], tube * 0.6);
  line("bar", "bar", [G.barEnd, add(grip, [0.2, 0.0]), grip], tube * 0.6);
  line("grip", "grip", [add(grip, [0.2, 0.0]), add(grip, [-0.08, 0.0])], tube * 1.1);
  circle("bell", "bell", add(grip, [0.36, 0.1]), 0.1);
  poly("saddle", "saddle", [add(saddle, [-0.34, 0.04]), add(saddle, [-0.3, 0.12]), add(saddle, [0.2, 0.1]), add(saddle, [0.36, 0.03]), add(saddle, [0.1, -0.02]), add(saddle, [-0.3, -0.04])]);

  // drivetrain
  line("chainTop", "chain", chainTop, 0.03);
  line("chainBottom", "chain", chainBottom, 0.03);
  circle("cog", "ring", rear, G.cog, { w: 0.03 * S });
  circle("ring", "ring", bb, G.ring, { w: 0.045 * S });
  line("crankNear", "crank", [bb, pedalNear], 0.09, { side: "near" });
  poly("pedalNear", "pedal", legNear.plate, { side: "near" });

  // pelican
  tail.forEach((pts, i) => poly(`tail${i}`, "tail", pts));
  line("legNearThigh", "leg", [legNear.hip, legNear.knee], 0.12, { side: "near" });
  line("legNearShin", "leg", [legNear.knee, legNear.ankle], 0.1, { side: "near" });
  poly("footNear", "foot", legNear.web, { side: "near" });
  poly("body", "body", bodyOutline);
  poly("neck", "neck", neck);
  crest.forEach((pts, i) => poly(`crest${i}`, "crest", pts));
  poly("pouch", "pouch", pouch);
  poly("billLower", "bill", lowerBill);
  poly("head", "head", headOutline);
  poly("billUpper", "bill", upper);
  circle("eye", "eye", eyeC, eyeR);
  circle("pupil", "pupil", pupilC, eyeR * 0.5);
  if (lid > 0.02) push({ id: "lid", tag: "lid", kind: "circle", c: out(eyeC), r: eyeR * S, amount: lid });
  wingTips.forEach((pts, i) => poly(`wingTip${i}`, "wingtip", pts));
  poly("wing", "wing", wingOutline);
  line("wingFold", "wingfold", wingFold, 0.02);
  wingHand.forEach((pts, i) => poly(`wingHand${i}`, "wingtip", pts));

  // ------------------------------------------------------------ joints (caller units)
  const joints = {
    rear: out(rear),
    front: out(front),
    bb: out(bb),
    saddle: out(saddle),
    grip: out(grip),
    pedalNear: out(pedalNear),
    pedalFar: out(pedalFar),
    hip: out(hip),
    kneeNear: out(legNear.knee),
    kneeFar: out(legFar.knee),
    ankleNear: out(legNear.ankle),
    ankleFar: out(legFar.ankle),
    body: out(body),
    shoulder: out(shoulder),
    neckBase: out(neckBase),
    head: out(headC),
    eye: out(eyeC),
    billBase: out(billBaseF),
    billTip: out(billPt(L, 0)),
    tailRoot: out(tailRoot),
    wingTip: out(wingTarget),
    top: out([headC[0], headC[1] + G.headR + 0.2]),
  };

  return {
    shapes,
    joints,
    neckLine: outAll(neckCenter),
    wingLine: outAll(wingCenter),
    scale: S,
    wheelR: S,
    facing,
    lid,
    bodyTilt: tilt + slope,
    /** Bounding box in caller units. */
    bounds: {
      x0: pose.x - (half + 1.75) * S,
      x1: pose.x + (half + 1.55) * S,
      y0: pose.y - 6.3 * S,
      y1: pose.y + 0.05 * S,
    },
  };
}

/** Collect every outline of the puppet as plain polylines (for line-only styles). */
export function outlines(skel, { circleSegments = 28 } = {}) {
  const linesOut = [];
  for (const sh of skel.shapes) {
    if (sh.kind === "circle") {
      const pts = [];
      for (let i = 0; i <= circleSegments; i += 1) {
        const a = (i / circleSegments) * TAU;
        pts.push([sh.c[0] + Math.cos(a) * sh.r, sh.c[1] + Math.sin(a) * sh.r]);
      }
      linesOut.push({ id: sh.id, tag: sh.tag, pts, closed: true });
    } else {
      linesOut.push({ id: sh.id, tag: sh.tag, pts: sh.closed ? sh.pts.concat([sh.pts[0]]) : sh.pts, closed: sh.closed });
    }
  }
  return linesOut;
}
