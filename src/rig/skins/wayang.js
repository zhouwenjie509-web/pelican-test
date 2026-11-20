// Section 10 skin: the pelican and bicycle as a Javanese shadow puppet.
//
// The puppet is built like a real one, from rigid pieces of pierced hide
// pinned together: body-neck-head-upper-bill in one piece, a hinged lower
// bill and pouch, two-piece legs, wheels as separate discs, a flat pierced
// frame, chainring and cranks. Each piece is cut once into a cached sprite
// (solid black, holes transparent) and only transformed per frame.
//
// The piercing toolkit (Solid, edge rows, lattices, hole shapes) is shared
// with the scene, which uses it for the standing puppets and the title.

import { solveRig } from "../rig.js";
import { sprite } from "../../kit/text.js";
import { smoothOpen } from "../../kit/geom.js";
import { WHEEL_R } from "../../main/layout.js";

export const TAU = Math.PI * 2;

// ------------------------------------------------------------------ vectors
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const mul = (a, s) => [a[0] * s, a[1] * s];
export const len = (a) => Math.hypot(a[0], a[1]);
export const norm = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};
export const rot = (a, t) => {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [a[0] * c - a[1] * s, a[0] * s + a[1] * c];
};
export const dirOf = (t) => [Math.cos(t), Math.sin(t)];
export const mix2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const angOf = (v) => Math.atan2(v[1], v[0]);

export function bbox(pts, pad = 0) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    if (p[0] < x0) x0 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[0] > x1) x1 = p[0];
    if (p[1] > y1) y1 = p[1];
  }
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}

export function inPoly(p, poly) {
  let inside = false;
  const x = p[0];
  const y = p[1];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segDist(p, a, b) {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / (ab[0] * ab[0] + ab[1] * ab[1] || 1)));
  return Math.hypot(p[0] - a[0] - ab[0] * t, p[1] - a[1] - ab[1] * t);
}

/** True when p lies inside poly and at least r from its edge (sampled). */
export function deepIn(p, poly, r, n = 10) {
  if (!inPoly(p, poly)) return false;
  for (let k = 0; k < n; k += 1) {
    const a = (k / n) * TAU;
    if (!inPoly([p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r], poly)) return false;
  }
  return true;
}

/**
 * The solid hide of one piece: a union of polygons, capsules and discs, minus
 * voids. Used to keep every hole inside the hide and at a set depth.
 */
export class Solid {
  constructor() {
    this.items = [];
    this.voids = [];
  }

  poly(pts) {
    this.items.push({ t: 0, pts, bb: bbox(pts) });
    return this;
  }

  cap(a, b, r) {
    this.items.push({ t: 1, a, b, r, bb: [Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r] });
    return this;
  }

  circ(c, r) {
    this.items.push({ t: 2, c, r, bb: [c[0] - r, c[1] - r, c[0] + r, c[1] + r] });
    return this;
  }

  hole(pts) {
    this.voids.push({ pts, bb: bbox(pts) });
    return this;
  }

  has(p) {
    const x = p[0];
    const y = p[1];
    for (const v of this.voids) {
      if (x >= v.bb[0] && x <= v.bb[2] && y >= v.bb[1] && y <= v.bb[3] && inPoly(p, v.pts)) return false;
    }
    for (const it of this.items) {
      if (x < it.bb[0] || x > it.bb[2] || y < it.bb[1] || y > it.bb[3]) continue;
      if (it.t === 0 ? inPoly(p, it.pts) : it.t === 1 ? segDist(p, it.a, it.b) <= it.r : Math.hypot(x - it.c[0], y - it.c[1]) <= it.r) return true;
    }
    return false;
  }

  /** Inside, and every sampled point at distance r is inside too. */
  deep(p, r, n = 10) {
    if (!this.has(p)) return false;
    for (let k = 0; k < n; k += 1) {
      const a = (k / n) * TAU + 0.13;
      if (!this.has([p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r])) return false;
    }
    return true;
  }

  bounds(pad = 0) {
    let b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const it of this.items) b = [Math.min(b[0], it.bb[0]), Math.min(b[1], it.bb[1]), Math.max(b[2], it.bb[2]), Math.max(b[3], it.bb[3])];
    return [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad];
  }
}

/** Keeps holes apart: free(p, d) is true when nothing taken lies within d. */
export class Spacer {
  constructor(cell = 2) {
    this.cell = cell;
    this.map = new Map();
  }

  free(p, d) {
    const c = this.cell;
    const gx = Math.floor(p[0] / c);
    const gy = Math.floor(p[1] / c);
    const reach = Math.ceil(d / c);
    for (let j = -reach; j <= reach; j += 1) {
      for (let i = -reach; i <= reach; i += 1) {
        const list = this.map.get(`${gx + i},${gy + j}`);
        if (!list) continue;
        for (const q of list) if (Math.hypot(q[0] - p[0], q[1] - p[1]) < Math.max(d, q[2])) return false;
      }
    }
    return true;
  }

  add(p, keep = 0) {
    const key = `${Math.floor(p[0] / this.cell)},${Math.floor(p[1] / this.cell)}`;
    let list = this.map.get(key);
    if (!list) this.map.set(key, (list = []));
    list.push([p[0], p[1], keep]);
  }
}

// ------------------------------------------------------------------ hole shapes
// Each appends one closed subpath; holes are filled one by one.
export const HOLE = {
  dot(ctx, x, y, r) {
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, TAU);
  },
  lens(ctx, x, y, ang, L, W, n = 10) {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      const u = (t - 0.5) * L;
      const w = 0.5 * W * Math.sin(Math.PI * t);
      const px = x + u * c - w * s;
      const py = y + u * s + w * c;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    for (let i = n - 1; i >= 1; i -= 1) {
      const t = i / n;
      const u = (t - 0.5) * L;
      const w = -0.5 * W * Math.sin(Math.PI * t);
      ctx.lineTo(x + u * c - w * s, y + u * s + w * c);
    }
    ctx.closePath();
  },
  /** A scale: a thin crescent whose open side faces ang. */
  scale(ctx, x, y, r, ang, th = 0.4) {
    const n = 10;
    const a0 = ang + Math.PI - 1.25;
    const a1 = ang + Math.PI + 1.25;
    const cx = x + Math.cos(ang) * r * th;
    const cy = y + Math.sin(ang) * r * th;
    for (let i = 0; i <= n; i += 1) {
      const a = a0 + ((a1 - a0) * i) / n;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    for (let i = n; i >= 0; i -= 1) {
      const a = a0 + ((a1 - a0) * i) / n;
      ctx.lineTo(cx + Math.cos(a) * r * 0.98, cy + Math.sin(a) * r * 0.98);
    }
    ctx.closePath();
  },
  diamond(ctx, x, y, rx, ry, ang = 0) {
    const pts = [
      [rx, 0],
      [0, ry],
      [-rx, 0],
      [0, -ry],
    ].map((p) => add([x, y], rot(p, ang)));
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < 4; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  },
  /** A comma: round head with a tapering tail curling away along ang. */
  comma(ctx, x, y, r, ang, curl = 0.9) {
    const n = 12;
    const left = [];
    const right = [];
    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      const a = ang + curl * t * t;
      const d = r * 3.4 * t;
      const c = [x + Math.cos(ang) * d * 0.15 + Math.cos(a) * d, y + Math.sin(ang) * d * 0.15 + Math.sin(a) * d];
      const w = r * (1 - t) ** 0.8;
      const nrm = [-Math.sin(a), Math.cos(a)];
      left.push(add(c, mul(nrm, w)));
      right.push(sub(c, mul(nrm, w)));
    }
    // round back of the head
    ctx.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i <= n; i += 1) ctx.lineTo(left[i][0], left[i][1]);
    for (let i = n; i >= 0; i -= 1) ctx.lineTo(right[i][0], right[i][1]);
    const back = ang + Math.PI;
    for (let i = 1; i < 8; i += 1) {
      const a = back - Math.PI / 2 + (Math.PI * i) / 8;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  },
};

/** Fill a list of hole closures through the hide (destination-out). */
export function cutHoles(ctx, holes) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "#000";
  for (const h of holes) {
    ctx.beginPath();
    h(ctx);
    ctx.fill();
  }
  ctx.restore();
}

export function fillPoly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
}

export function fillCap(ctx, a, b, r) {
  const d = norm(sub(b, a));
  const ang = angOf(d);
  ctx.beginPath();
  ctx.arc(a[0], a[1], r, ang + Math.PI / 2, ang + (3 * Math.PI) / 2);
  ctx.arc(b[0], b[1], r, ang - Math.PI / 2, ang + Math.PI / 2);
  ctx.closePath();
  ctx.fill();
}

/** Evenly spaced points (with tangents) around a closed outline. */
export function resample(pts, spacing, closed = true) {
  const segs = [];
  let total = 0;
  const n = pts.length;
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push({ a, b, l, s: total });
    total += l;
  }
  const out = [];
  const count = Math.max(1, Math.round(total / spacing));
  const step = total / count;
  let si = 0;
  for (let k = 0; k < (closed ? count : count + 1); k += 1) {
    const d = Math.min(total, k * step);
    while (si < segs.length - 1 && segs[si].s + segs[si].l < d) si += 1;
    const sg = segs[si];
    const t = sg.l ? (d - sg.s) / sg.l : 0;
    out.push({ p: mix2(sg.a, sg.b, t), t: norm(sub(sg.b, sg.a)) });
  }
  return out;
}

/**
 * A row of round holes following the outer edge of a solid, inset by `inset`.
 * `outlines` are the polygons whose edges may carry the row; points that end
 * up deep inside the union (internal seams) are skipped.
 */
export function edgeRow(solid, outlines, holes, spacer, { inset = 1.5, spacing = 2, r = 0.48, far = 2.2, shape } = {}) {
  for (const ol of outlines) {
    for (const { p, t } of resample(ol, spacing)) {
      const n = [-t[1], t[0]];
      for (const sgn of [1, -1]) {
        const q = add(p, mul(n, inset * sgn));
        if (!solid.has(q)) continue;
        if (solid.deep(q, Math.max(r + 0.45, inset * 0.8)) && !solid.deep(q, inset * far) && spacer.free(q, spacing * 0.82)) {
          spacer.add(q, spacing * 0.5);
          if (shape) holes.push((ctx) => shape(ctx, q, t));
          else holes.push((ctx) => HOLE.dot(ctx, q[0], q[1], r));
        }
        break;
      }
    }
  }
}

/** Visit a staggered lattice covering box, rotated by ang about origin. */
export function lattice(box, { ang = 0, dx = 3, dy = 3, stagger = 0.5, origin = [0, 0] }, visit) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const corners = [
    [box[0], box[1]],
    [box[2], box[1]],
    [box[0], box[3]],
    [box[2], box[3]],
  ].map((p) => {
    const d = sub(p, origin);
    return [d[0] * c + d[1] * s, -d[0] * s + d[1] * c];
  });
  const lb = bbox(corners);
  const j0 = Math.floor(lb[1] / dy) - 1;
  const j1 = Math.ceil(lb[3] / dy) + 1;
  for (let j = j0; j <= j1; j += 1) {
    const off = (((j % 2) + 2) % 2) * stagger * dx;
    const i0 = Math.floor((lb[0] - off) / dx) - 1;
    const i1 = Math.ceil((lb[2] - off) / dx) + 1;
    for (let i = i0; i <= i1; i += 1) {
      const lx = i * dx + off;
      const ly = j * dy;
      const q = [origin[0] + lx * c - ly * s, origin[1] + lx * s + ly * c];
      if (q[0] < box[0] || q[0] > box[2] || q[1] < box[1] || q[1] > box[3]) continue;
      visit(q, i, j);
    }
  }
}

/** A tapered ribbon polygon along a centre line. */
export function ribbon(center, w0, w1, round = true) {
  const left = [];
  const right = [];
  const n = center.length;
  for (let i = 0; i < n; i += 1) {
    const a = center[Math.max(0, i - 1)];
    const b = center[Math.min(n - 1, i + 1)];
    const t = norm(sub(b, a));
    const nr = [-t[1], t[0]];
    const w = 0.5 * (w0 + (w1 - w0) * (i / (n - 1)));
    left.push(add(center[i], mul(nr, w)));
    right.push(sub(center[i], mul(nr, w)));
  }
  if (round) {
    // round the far tip
    const last = center[n - 1];
    const t = norm(sub(center[n - 1], center[n - 2]));
    left.push(add(last, mul(t, w1 * 0.5)));
  }
  return left.concat(right.reverse());
}

// ------------------------------------------------------------------ piece sprites
/**
 * A rigid piece cut once: draw(ctx) paints in local units (black hide, holes
 * cut out). Returns the sprite and its local rectangle.
 */
export function pieceSprite(stage, key, k, box, draw) {
  const w = Math.ceil((box[2] - box[0]) * k) + 4;
  const h = Math.ceil((box[3] - box[1]) * k) + 4;
  const layer = sprite(stage, `${key}/${k.toFixed(3)}`, w, h, (ctx) => {
    ctx.setTransform(k, 0, 0, k, 2 - box[0] * k, 2 - box[1] * k);
    ctx.fillStyle = "#000";
    ctx.strokeStyle = "#000";
    draw(ctx);
  });
  return { layer, x0: box[0] - 2 / k, y0: box[1] - 2 / k, w: w / k, h: h / k };
}

/** Draw a piece with its local origin at (x, y), turned by ang. */
export function placePiece(ctx, piece, x = 0, y = 0, ang = 0) {
  ctx.save();
  ctx.translate(x, y);
  if (ang) ctx.rotate(ang);
  ctx.drawImage(piece.layer.canvas, piece.x0, piece.y0, piece.w, piece.h);
  ctx.restore();
}

// ------------------------------------------------------------------ the pelican model
const S = WHEEL_R;
const ACT0 = { bob: 0, wind: 0, pouch: 1.4 };

function refRig(crank = 0) {
  return solveRig({ x: 0, y: 0, scale: S, slope: 0, crank, wheel: 0, time: 0, act: ACT0 });
}

let MODEL = null;

/** Geometry of the puppet in local units (road point at the origin), built once. */
export function pelicanModel() {
  if (MODEL) return MODEL;
  const ref = refRig(0);
  const shp = (id) => ref.shapes.find((s) => s.id === id);
  const J = ref.joints;
  const feather = (id) => {
    const pts = shp(id).pts;
    const tipI = Math.floor(pts.length / 2);
    return { pts, root: pts[0], tip: pts[tipI] };
  };

  // the crest: a plume swept back along the head, curling up at its end
  const head = J.head;
  const curlLine = [add(head, [-0.5, -7.4]), add(head, [-5.5, -8.8]), add(head, [-10.5, -8.4]), add(head, [-14.6, -6.2])];
  const c2 = add(head, [-16.4, -9.6]);
  for (let i = 1; i <= 16; i += 1) {
    const s = i / 16;
    const a = 1.15 + s * 4.3;
    const r = 3.9 * (1 - 0.55 * s);
    curlLine.push(add(c2, [Math.cos(a) * r, Math.sin(a) * r]));
  }
  const curl = ribbon(smoothOpen(curlLine, 3), 4.4, 1.1);
  // and a slim pointed feather rising behind it
  const plume = ribbon(smoothOpen([add(head, [-2.5, -6.8]), add(head, [-6.5, -12.5]), add(head, [-11, -15.2]), add(head, [-15.5, -15.8])], 4), 2.8, 0.2, false);

  const body = shp("body").pts;
  // a fuller neck and head than the plain rig: a pelican, not a heron
  const neck = ribbon(ref.neckLine, 15.5, 8.8, false);
  const headPts = shp("head").pts.map((p) => add(head, mul(sub(p, head), 1.14)));
  // a deeper upper bill: widened about its ridge line, the nail kept
  const bb0 = J.billBase;
  const bdir = norm(sub(J.billTip, bb0));
  const billUpper = shp("billUpper").pts.map((p) => {
    const d = sub(p, bb0);
    const along = d[0] * bdir[0] + d[1] * bdir[1];
    const across = -d[0] * bdir[1] + d[1] * bdir[0];
    const k = along > len(sub(J.billTip, bb0)) * 0.9 ? 1.15 : 1.6;
    return add(bb0, add(mul(bdir, along), mul([-bdir[1], bdir[0]], across * k - 0.4)));
  });
  const wing = shp("wing").pts;
  const tails = [0, 1, 2].map((i) => feather(`tail${i}`));
  const crests = [0, 1, 2].map((i) => feather(`crest${i}`));
  const wingTips = [0, 1, 2, 3].map((i) => feather(`wingTip${i}`));
  const wingHands = [0, 1].map((i) => feather(`wingHand${i}`));

  // the lower piece: lower bill and pouch, hinged at the bill base
  const billLower = shp("billLower").pts;
  const pouch = shp("pouch").pts;

  // bicycle frame members (line shapes) and their widths in the puppet
  const frameW = { chainStay: 2.3, seatStay: 2.0, seatTube: 2.8, downTube: 3.0, topTube: 2.7, headTube: 4.0, fork: 2.5, seatPost: 2.0, stem: 2.0, bar: 2.0, grip: 3.0 };
  const members = Object.keys(frameW).map((id) => ({ id, pts: shp(id).pts, w: frameW[id] }));
  const saddle = shp("saddle").pts;
  const chain = [shp("chainTop").pts, shp("chainBottom").pts];

  // the shank's foot, averaged over a pedal turn into the shank's own frame
  const nS = 16;
  let footAvg = null;
  for (let i = 0; i < nS; i += 1) {
    const r = refRig((i / nS) * TAU);
    const kn = r.joints.kneeNear;
    const an = r.joints.ankleNear;
    const a = angOf(sub(an, kn));
    const web = r.shapes.find((s) => s.id === "footNear").pts.map((p) => rot(sub(p, kn), -a));
    if (!footAvg) footAvg = web.map(() => [0, 0]);
    web.forEach((p, k) => {
      footAvg[k][0] += p[0] / nS;
      footAvg[k][1] += p[1] / nS;
    });
  }

  MODEL = {
    J,
    head,
    body,
    neck,
    headPts,
    billUpper,
    wing,
    tails,
    crests,
    wingTips,
    wingHands,
    curl,
    curlLine,
    plume,
    billLower,
    pouch,
    members,
    saddle,
    chain,
    neckLine: ref.neckLine,
    thigh: 1.28 * S,
    shin: 1.22 * S,
    crankL: 0.5 * S,
    // a broad webbed foot, a little larger than the plain rig's, so it reads on the pedal
    foot: footAvg.map((p) => add([1.22 * S, 0], mul(sub(p, [1.22 * S, 0]), 1.22))),
    tilt: ref.bodyTilt,
  };
  return MODEL;
}

// ------------------------------------------------------------------ the cut pieces
function bodyPiece(ctx, M) {
  const sol = new Solid();
  const polys = [M.body, M.neck, M.headPts, M.billUpper, M.wing, M.curl, M.plume, ...M.tails.map((f) => f.pts), ...M.crests.map((f) => f.pts), ...M.wingTips.map((f) => f.pts), ...M.wingHands.map((f) => f.pts)];
  polys.forEach((p) => sol.poly(p));

  // the eye: a narrow almond cut-out, its pupil held by a bridge
  const J = M.J;
  const billDir = norm(sub(J.billTip, J.billBase));
  const billAng = angOf(billDir);
  const eye = add(J.eye, [0.4, 0.2]);
  const almond = [];
  for (let i = 0; i <= 16; i += 1) {
    const t = i / 16;
    const u = (t - 0.5) * 6.2;
    almond.push(add(eye, rot([u, -1.25 * Math.sin(Math.PI * t) ** 0.8], billAng - 0.12)));
  }
  for (let i = 15; i >= 1; i -= 1) {
    const t = i / 16;
    const u = (t - 0.5) * 6.2;
    almond.push(add(eye, rot([u, 0.9 * Math.sin(Math.PI * t) ** 0.9], billAng - 0.12)));
  }
  sol.hole(almond);

  ctx.fillStyle = "#000";
  polys.forEach((p) => fillPoly(ctx, p));
  // a serrated feather edge along the back and the back of the neck
  for (const [poly, test] of [
    [M.body, (n) => n[1] < -0.35 && n[0] < 0.55],
    [M.neck, (n) => n[0] < -0.4],
  ]) {
    resample(poly, 2.3).forEach(({ p, t }) => {
      let n = [-t[1], t[0]];
      if (sol.has(add(p, mul(n, 0.9)))) n = mul(n, -1);
      if (!test(n) || sol.has(add(p, mul(n, 1.0)))) return;
      const back = mul(t, Math.sign(-t[0] || 1));
      fillPoly(ctx, [add(p, mul(t, -1.05)), add(add(p, mul(n, 1.75)), mul(back, 0.6)), add(p, mul(t, 1.05))]);
    });
  }

  const holes = [];
  const sp = new Spacer(2);
  // protect the eye surround from other holes
  sp.add(eye, 4.2);
  // a rosette at the wing's shoulder
  const sh = add(J.shoulder, [0.5, 0.5]);
  if (sol.deep(sh, 3.4)) {
    sp.add(sh, 3.6);
    holes.push((c) => HOLE.dot(c, sh[0], sh[1], 0.65));
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * TAU + 0.2;
      const q = add(sh, mul(dirOf(a), 1.9));
      holes.push((c) => HOLE.lens(c, q[0], q[1], a, 1.7, 0.75));
    }
  }

  // 1. a row of dots along every outer edge, and a finer second row
  edgeRow(sol, polys, holes, sp, { inset: 1.75, spacing: 2.3, r: 0.6 });
  edgeRow(sol, [M.body, M.wing, M.neck], holes, sp, { inset: 3.7, spacing: 2.6, r: 0.42, far: 1.6 });

  // 2. the wing: a border of dots along its contour on the body
  edgeRow(sol, [M.wing], holes, sp, { inset: 1.3, spacing: 1.7, r: 0.38, far: 99 });
  // 3. ...and a spray of long slits sweeping back from the wrist
  const wrist = M.J.wingTip;
  const tailEnd = M.wing.reduce((m, p) => (p[0] < m[0] ? p : m), M.wing[0]);
  const wingAng = angOf(sub(tailEnd, wrist));
  const wingLen = len(sub(tailEnd, wrist));
  lattice(bbox(M.wing), { ang: wingAng, dx: 6.6, dy: 2.6, stagger: 0.5, origin: wrist }, (q) => {
    const along = (q[0] - wrist[0]) * Math.cos(wingAng) + (q[1] - wrist[1]) * Math.sin(wingAng);
    const t = Math.max(0, Math.min(1, along / wingLen));
    const L = 2.6 + 3.4 * t;
    const a = wingAng + 0.08 * (1 - t);
    const tipA = add(q, mul(dirOf(a), L / 2 + 0.6));
    const tipB = sub(q, mul(dirOf(a), L / 2 + 0.6));
    if (!deepIn(q, M.wing, 2.2) || !deepIn(tipA, M.wing, 1.0) || !deepIn(tipB, M.wing, 1.0) || !sol.deep(q, 2.0)) return;
    if (!sp.free(q, 1.7)) return;
    sp.add(q, 1.2);
    holes.push((c) => HOLE.lens(c, q[0], q[1], a, L, 1.2));
  });

  // 4. scales over the breast and back, outside the wing
  const tilt = -M.tilt;
  lattice(bbox(M.body), { ang: tilt, dx: 3.5, dy: 2.95, stagger: 0.5, origin: M.J.body }, (q) => {
    if (inPoly(q, M.wing)) return;
    if (!sol.deep(q, 3.2)) return;
    if (!sp.free(q, 2.3)) return;
    sp.add(q, 1.5);
    holes.push((c) => HOLE.scale(c, q[0], q[1], 1.55, tilt + Math.PI * 0.92, 0.45));
  });

  // 5. the neck: a column of commas, a jewelled collar at its base
  const nl = M.neckLine;
  const neckPts = resample(nl, 3.0, false);
  neckPts.forEach(({ p, t }, i) => {
    if (i < 3 || i > neckPts.length - 2) return;
    if (!sol.deep(p, 1.6) || !sp.free(p, 1.9)) return;
    sp.add(p, 1.4);
    const a = angOf(t);
    holes.push((c) => HOLE.comma(c, p[0], p[1], 0.62, a + Math.PI, i % 2 ? 0.9 : -0.9));
  });
  for (const k of [1, 2]) {
    const p = neckPts[k].p;
    const t = neckPts[k].t;
    const nrm = [-t[1], t[0]];
    for (let j = -3; j <= 3; j += 1) {
      const q = add(p, mul(nrm, j * 1.55));
      if (!sol.deep(q, 1.0) || !sp.free(q, 1.25)) continue;
      sp.add(q, 0.9);
      holes.push((c) => HOLE.dot(c, q[0], q[1], k === 1 ? 0.5 : 0.38));
    }
  }

  // 6. the bill: a long slit along the ridge, a hooked nail picked out
  const L = len(sub(J.billTip, J.billBase));
  const up = [billDir[1], -billDir[0]];
  const slitC = add(add(J.billBase, mul(billDir, L * 0.46)), mul(up, 0.75));
  holes.push((c) => HOLE.lens(c, slitC[0], slitC[1], billAng + 0.02, L * 0.62, 1.05));
  for (let i = 0; i < 6; i += 1) {
    const q = add(add(J.billBase, mul(billDir, L * (0.16 + i * 0.12))), mul(up, -0.55));
    if (sol.deep(q, 0.8) && sp.free(q, 1.2)) {
      sp.add(q, 0.8);
      holes.push((c) => HOLE.dot(c, q[0], q[1], 0.32));
    }
  }

  // 7. feathers: a slit down each tail, crest and flight feather
  for (const f of [...M.tails, ...M.wingTips]) {
    const d = sub(f.tip, f.root);
    const a = angOf(d);
    const l = len(d);
    const c0 = add(f.root, mul(d, 0.55));
    holes.push((c) => HOLE.lens(c, c0[0], c0[1], a, l * 0.62, 1.0));
  }

  // 8. the headdress: dots along the curl
  resample(M.curlLine, 1.9, false).forEach(({ p }, i) => {
    if (i < 2 || !sol.deep(p, 0.75) || !sp.free(p, 1.4)) return;
    sp.add(p, 1);
    holes.push((c) => HOLE.dot(c, p[0], p[1], 0.36));
  });

  // 9. around the eye: a brow slit and a little rosette on the cheek
  const brow = add(eye, rot([-0.4, -2.75], billAng));
  holes.push((c) => HOLE.lens(c, brow[0], brow[1], billAng - 0.28, 6.4, 0.75));
  const cheek = add(eye, rot([-1.6, 3.4], billAng));
  if (sol.deep(cheek, 1.5)) {
    holes.push((c) => HOLE.dot(c, cheek[0], cheek[1], 0.42));
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * TAU;
      const q = add(cheek, mul(dirOf(a), 1.15));
      holes.push((c) => HOLE.lens(c, q[0], q[1], a, 1.0, 0.45));
    }
  }

  cutHoles(ctx, holes);
  // the eye itself, with the pupil left standing on its bridge
  cutHoles(ctx, [(c) => {
    c.moveTo(almond[0][0], almond[0][1]);
    almond.forEach((p) => c.lineTo(p[0], p[1]));
    c.closePath();
  }]);
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(eye[0] + 0.3, eye[1] - 0.05, 0.92, 0, TAU);
  ctx.fill();
  const bridgeTop = add(eye, rot([0.3, -1.6], billAng - 0.12));
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  ctx.moveTo(eye[0] + 0.3, eye[1]);
  ctx.lineTo(bridgeTop[0], bridgeTop[1]);
  ctx.stroke();
}

function lowerPiece(ctx, M) {
  const sol = new Solid().poly(M.billLower).poly(M.pouch);
  fillPoly(ctx, M.pouch);
  fillPoly(ctx, M.billLower);
  const holes = [];
  const sp = new Spacer(2);
  edgeRow(sol, [M.pouch, M.billLower], holes, sp, { inset: 1.35, spacing: 1.9, r: 0.45 });
  const J = M.J;
  const billAng = angOf(sub(J.billTip, J.billBase));
  // the pouch: a net of small diamonds
  lattice(bbox(M.pouch), { ang: billAng, dx: 2.5, dy: 2.1, stagger: 0.5, origin: J.billBase }, (q) => {
    if (!sol.deep(q, 2.6) || !sp.free(q, 1.6)) return;
    sp.add(q, 1);
    holes.push((c) => HOLE.diamond(c, q[0], q[1], 0.95, 0.62, billAng));
  });
  cutHoles(ctx, holes);
}

function framePiece(ctx, M) {
  const sol = new Solid();
  const caps = [];
  for (const m of M.members) {
    for (let i = 0; i < m.pts.length - 1; i += 1) {
      caps.push([m.pts[i], m.pts[i + 1], m.w / 2]);
      sol.cap(m.pts[i], m.pts[i + 1], m.w / 2);
    }
  }
  const J = M.J;
  const seatCluster = M.members.find((m) => m.id === "seatTube").pts[1];
  const headTube = M.members.find((m) => m.id === "headTube").pts;
  const knots = [
    [seatCluster, 3.5],
    [headTube[0], 3.0],
    [headTube[1], 3.0],
    [J.rear, 3.2],
    [J.front, 3.0],
  ];
  knots.forEach(([c, r]) => sol.circ(c, r));
  // the saddle as a pointed leaf
  const sad = M.saddle;
  const sc = sad.reduce((a, p) => add(a, mul(p, 1 / sad.length)), [0, 0]);
  const saddle = [];
  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * TAU;
    const x = Math.cos(a) * 9.2;
    const y = Math.sin(a) * (a > Math.PI ? 2.6 : 1.7) * (1 - 0.35 * Math.cos(a));
    saddle.push(add(sc, [x + (Math.cos(a) > 0 ? 1.2 * Math.cos(a) ** 3 : 0), y - 0.6]));
  }
  sol.poly(saddle);

  ctx.fillStyle = "#000";
  caps.forEach(([a, b, r]) => fillCap(ctx, a, b, r));
  knots.forEach(([c, r]) => {
    ctx.beginPath();
    ctx.arc(c[0], c[1], r, 0, TAU);
    ctx.fill();
  });
  fillPoly(ctx, saddle);
  // the chain: a slim pierced strap
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  for (const ch of M.chain) {
    ctx.beginPath();
    ctx.moveTo(ch[0][0], ch[0][1]);
    ctx.lineTo(ch[1][0], ch[1][1]);
    ctx.stroke();
  }

  const holes = [];
  const sp = new Spacer(2);
  knots.forEach(([c, r]) => {
    sp.add(c, r + 0.3);
    holes.push((x) => HOLE.dot(x, c[0], c[1], r * 0.22));
    const n = r > 3.2 ? 8 : 6;
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * TAU + 0.3;
      const q = add(c, mul(dirOf(a), r * 0.62));
      holes.push((x) => HOLE.dot(x, q[0], q[1], 0.42));
    }
  });
  for (const m of M.members) {
    const rr = m.w >= 3 ? 0.5 : 0.36;
    const spacing = m.w >= 3 ? 2.3 : 1.9;
    resample(m.pts, spacing, false).forEach(({ p }) => {
      if (!sol.deep(p, rr + 0.55) || !sp.free(p, spacing * 0.8)) return;
      sp.add(p, spacing * 0.4);
      holes.push((x) => HOLE.dot(x, p[0], p[1], rr));
    });
  }
  resample(saddle, 1.7).forEach(({ p, t }) => {
    const q = add(p, mul([t[1], -t[0]], -0.95));
    if (sol.deep(q, 0.7) && sp.free(q, 1.3)) {
      sp.add(q, 0.8);
      holes.push((x) => HOLE.dot(x, q[0], q[1], 0.3));
    }
  });
  for (const ch of M.chain) {
    resample(ch, 1.25, false).forEach(({ p }, i) => {
      if (i === 0) return;
      holes.push((x) => HOLE.diamond(x, p[0], p[1], 0.36, 0.3));
    });
  }
  cutHoles(ctx, holes);
}

/** Wheel disc: tyre, a ring of dots, seven windows, one of them blocked by the odd mark. */
function wheelPiece(ctx) {
  const R = S;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
  const holes = [];
  // tread: small notches on the outer edge
  for (let i = 0; i < 42; i += 1) {
    const a = ((i + 0.5) / 42) * TAU;
    const q = mul(dirOf(a), R + 0.15);
    holes.push((c) => HOLE.dot(c, q[0], q[1], 0.42));
  }
  // a ring of dots inside the tyre
  for (let i = 0; i < 42; i += 1) {
    const a = (i / 42) * TAU;
    const q = mul(dirOf(a), R - 1.55);
    holes.push((c) => HOLE.dot(c, q[0], q[1], 0.48));
  }
  // the rim: a dashed ring of fourteen slits
  for (let i = 0; i < 14; i += 1) {
    const a0 = (i / 14) * TAU + 0.05;
    const a1 = a0 + (TAU / 14) * 0.72;
    const r = R - 3.45;
    holes.push((c) => {
      c.moveTo(Math.cos(a0) * (r + 0.36), Math.sin(a0) * (r + 0.36));
      c.arc(0, 0, r + 0.36, a0, a1);
      c.arc(0, 0, r - 0.36, a1, a0, true);
      c.closePath();
    });
  }
  // seven windows between spokes of hide
  // open windows, so the legs read where they cross the wheels
  const ri = 5.6;
  const ro = R - 4.75;
  const half = 1.35; // half the width of a spoke
  for (let k = 0; k < 7; k += 1) {
    const phi = (k / 7) * TAU;
    if (k === 0) {
      // the odd mark: this window is left solid, pierced by one big round hole
      const c0 = mul(dirOf(phi), (ri + ro) / 2 + 0.3);
      holes.push((c) => HOLE.dot(c, c0[0], c0[1], 3.6));
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * TAU;
        const q = add(c0, mul(dirOf(a), 5.0));
        if (len(q) < ro + 0.6 && len(q) > ri - 0.2) holes.push((c) => HOLE.dot(c, q[0], q[1], 0.42));
      }
      continue;
    }
    holes.push((c) => {
      const pts = [];
      const n = 14;
      for (let i = 0; i <= n; i += 1) {
        const r = ri + ((ro - ri) * i) / n;
        pts.push(mul(dirOf(phi - Math.PI / 7 + half / r), r));
      }
      for (let i = 0; i <= n; i += 1) {
        const a = phi - Math.PI / 7 + half / ro + ((2 * (Math.PI / 7 - half / ro)) * i) / n;
        pts.push(mul(dirOf(a), ro + 0.5 * Math.sin((Math.PI * i) / n)));
      }
      for (let i = n; i >= 0; i -= 1) {
        const r = ri + ((ro - ri) * i) / n;
        pts.push(mul(dirOf(phi + Math.PI / 7 - half / r), r));
      }
      c.moveTo(pts[0][0], pts[0][1]);
      pts.forEach((p) => c.lineTo(p[0], p[1]));
      c.closePath();
    });
  }
  // dots along every spoke
  for (let k = 0; k < 7; k += 1) {
    const a = (k / 7) * TAU + Math.PI / 7;
    for (const r of [8.6, 11.2, 13.8]) {
      const q = mul(dirOf(a), r);
      holes.push((c) => HOLE.dot(c, q[0], q[1], 0.42));
    }
  }
  // hub: seven dots round a pin
  for (let i = 0; i < 7; i += 1) {
    const q = mul(dirOf((i / 7) * TAU + 0.2), 4.1);
    holes.push((c) => HOLE.dot(c, q[0], q[1], 0.48));
  }
  holes.push((c) => {
    c.moveTo(1.75, 0);
    c.arc(0, 0, 1.75, 0, TAU);
    c.moveTo(1.05, 0);
    c.arc(0, 0, 1.05, 0, TAU, true);
  });
  cutHoles(ctx, holes);
}

function chainringPiece(ctx) {
  const R = 6.9;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
  const holes = [];
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * TAU + Math.PI / 4;
    const q = mul(dirOf(a), 3.9);
    holes.push((c) => HOLE.lens(c, q[0], q[1], a + Math.PI / 2, 4.0, 2.0));
  }
  for (let i = 0; i < 12; i += 1) {
    const q = mul(dirOf((i / 12) * TAU), R - 1.05);
    holes.push((c) => HOLE.dot(c, q[0], q[1], 0.4));
  }
  for (let i = 0; i < 24; i += 1) {
    const q = mul(dirOf(((i + 0.5) / 24) * TAU), R + 0.1);
    holes.push((c) => HOLE.dot(c, q[0], q[1], 0.38));
  }
  cutHoles(ctx, holes);
}

function crankPiece(ctx, M) {
  const L = M.crankL;
  fillCap(ctx, [0, 0], [L, 0], 1.45);
  cutHoles(ctx, [(c) => HOLE.dot(c, L * 0.38, 0, 0.42), (c) => HOLE.dot(c, L * 0.62, 0, 0.42)]);
}

function thighPiece(ctx, M) {
  const L = M.thigh;
  const outline = [];
  for (let i = 0; i <= 12; i += 1) {
    const t = i / 12;
    outline.push([L * t, -(3.5 - 1.4 * t) * (1 + 0.16 * Math.sin(Math.PI * t))]);
  }
  for (let i = 12; i >= 0; i -= 1) {
    const t = i / 12;
    outline.push([L * t, (3.3 - 1.3 * t) * (1 + 0.2 * Math.sin(Math.PI * t))]);
  }
  fillPoly(ctx, outline);
  ctx.beginPath();
  ctx.arc(0, 0, 3.4, 0, TAU);
  ctx.arc(L, 0, 2.2, 0, TAU);
  ctx.fill();
  const holes = [];
  for (let i = 1; i <= 8; i += 1) {
    const x = L * (0.1 + i * 0.097);
    const w = 3.2 - 1.3 * (x / L);
    holes.push((c) => HOLE.dot(c, x, 0, 0.42));
    if (i < 8) {
      holes.push((c) => HOLE.lens(c, x + 1.1, -w * 0.52, 0.45, 1.9, 0.5));
      holes.push((c) => HOLE.lens(c, x + 1.1, w * 0.52, -0.45, 1.9, 0.5));
    }
  }
  cutHoles(ctx, holes);
}

function shankPiece(ctx, M) {
  const L = M.shin;
  fillCap(ctx, [0, 0], [L, 0], 1.6);
  // a calf swelling just below the knee
  fillPoly(ctx, [[0, -2.0], [L * 0.35, -2.2], [L * 0.7, -1.5], [L * 0.7, 1.5], [L * 0.35, 2.1], [0, 1.9]]);
  ctx.beginPath();
  ctx.arc(0, 0, 2.2, 0, TAU);
  ctx.fill();
  // the webbed foot, carried rigidly on the shank
  const foot = M.foot.map((p) => add(p, [0, 0]));
  ctx.lineJoin = "round";
  fillPoly(ctx, foot);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(foot[0][0], foot[0][1]);
  foot.forEach((p) => ctx.lineTo(p[0], p[1]));
  ctx.closePath();
  ctx.stroke();
  const holes = [];
  for (let i = 1; i <= 6; i += 1) {
    const x = L * (0.1 + i * 0.12);
    holes.push((c) => HOLE.dot(c, x, 0, 0.36));
  }
  // toe lines between the webs
  const ankle = [L, 0];
  const toe = foot[2];
  const heel = foot[foot.length - 1];
  for (const t of [0.42, 0.68]) {
    const tip = mix2(heel, toe, 0.25 + t * 0.75);
    const a = angOf(sub(tip, ankle));
    const c0 = mix2(ankle, tip, 0.55);
    holes.push((c) => HOLE.lens(c, c0[0], c0[1], a, len(sub(tip, ankle)) * 0.52, 0.55));
  }
  cutHoles(ctx, holes);
}

/** Cut (once) and return every piece of the puppet at k pixels per unit. */
export function pelicanPieces(stage, k) {
  const M = pelicanModel();
  const pc = (name, box, fn) => pieceSprite(stage, `wayang/pc/${name}`, k, box, (ctx) => fn(ctx, M));
  const bodyBox = new Solid();
  [M.body, M.neck, M.headPts, M.billUpper, M.wing, M.curl, M.plume, ...M.tails.map((f) => f.pts), ...M.crests.map((f) => f.pts), ...M.wingTips.map((f) => f.pts), ...M.wingHands.map((f) => f.pts)].forEach((p) => bodyBox.poly(p));
  const lowerBox = bbox(M.pouch.concat(M.billLower), 1.5);
  const frameBox = bbox(M.members.flatMap((m) => m.pts).concat(M.saddle), 6);
  return {
    M,
    body: pc("body", bodyBox.bounds(1.5), bodyPiece),
    lower: pc("lower", lowerBox, lowerPiece),
    frame: pc("frame", frameBox, framePiece),
    wheel: pc("wheel", [-S - 1, -S - 1, S + 1, S + 1], wheelPiece),
    ring: pc("ring", [-7.6, -7.6, 7.6, 7.6], chainringPiece),
    crank: pc("crank", [-2, -2, M.crankL + 2, 2], crankPiece),
    thigh: pc("thigh", [-3.8, -4.6, M.thigh + 2.8, 4.6], thighPiece),
    shank: pc("shank", bbox(M.foot.concat([[-2.6, -2.6], [M.shin + 2, 2.6]]), 1.2), shankPiece),
  };
}

function rivet(ctx, p, r = 1.45) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(p[0], p[1], r, 0, TAU);
  ctx.arc(p[0], p[1], r * 0.55, 0, TAU, true);
  ctx.fill();
  ctx.restore();
}

/** A rod: tapered, its far end soft and thinned (it leans away from the cloth). */
function rodPath(ctx, a, b, w0, w1, alpha1 = 0.82, bend = 0.008) {
  const d = norm(sub(b, a));
  const n = [-d[1], d[0]];
  const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(0.55, "rgba(0,0,0,0.95)");
  g.addColorStop(1, `rgba(0,0,0,${alpha1})`);
  ctx.fillStyle = g;
  // a rod of horn is never quite straight: a slight bow, and a taper
  const bow = bend * len(sub(b, a));
  const L = [];
  const R = [];
  for (let i = 0; i <= 10; i += 1) {
    const t = i / 10;
    const c = add(mix2(a, b, t), mul(n, bow * Math.sin(Math.PI * t)));
    const w = (w0 + (w1 - w0) * t) / 2;
    L.push(add(c, mul(n, w)));
    R.push(sub(c, mul(n, w)));
  }
  fillPoly(ctx, L.concat(R.reverse()));
  ctx.beginPath();
  ctx.arc(a[0], a[1], w0 * 0.75, 0, TAU);
  ctx.fillStyle = "#000";
  ctx.fill();
}

/**
 * Assemble the puppet for one pose, in local units (road point at 0, 0).
 * pose: { crank, wheel, open, rock, hands: { body, bill, foot } }
 */
export function drawPuppet(ctx, pieces, pose) {
  const { M } = pieces;
  const rig = solveRig({ x: 0, y: 0, scale: S, slope: 0, crank: pose.crank, wheel: 0, time: 0, act: ACT0 });
  const J = rig.joints;
  const pivot = [-4, -62];
  const rk = pose.rock || 0;
  const xf = (p) => (rk ? add(pivot, rot(sub(p, pivot), rk)) : p);

  ctx.save();
  if (rk) {
    ctx.translate(pivot[0], pivot[1]);
    ctx.rotate(rk);
    ctx.translate(-pivot[0], -pivot[1]);
  }
  ctx.fillStyle = "#000";
  const legs = (knee, ankle) => {
    placePiece(ctx, pieces.thigh, J.hip[0], J.hip[1], angOf(sub(knee, J.hip)));
    placePiece(ctx, pieces.shank, knee[0], knee[1], angOf(sub(ankle, knee)));
  };
  const pedalPlate = (id) => {
    const sh = rig.shapes.find((s) => s.id === id);
    fillPoly(ctx, sh.pts);
  };
  // far side
  legs(J.kneeFar, J.ankleFar);
  placePiece(ctx, pieces.crank, J.bb[0], J.bb[1], angOf(sub(J.pedalFar, J.bb)));
  pedalPlate("pedalFar");
  // wheels, frame, drivetrain
  placePiece(ctx, pieces.wheel, J.rear[0], J.rear[1], pose.wheel);
  placePiece(ctx, pieces.wheel, J.front[0], J.front[1], pose.wheel);
  placePiece(ctx, pieces.frame);
  const crankAng = angOf(sub(J.pedalNear, J.bb));
  placePiece(ctx, pieces.ring, J.bb[0], J.bb[1], crankAng);
  placePiece(ctx, pieces.crank, J.bb[0], J.bb[1], crankAng);
  pedalPlate("pedalNear");
  // near leg, body, lower bill
  legs(J.kneeNear, J.ankleNear);
  placePiece(ctx, pieces.body);
  const hinge = M.J.billBase;
  ctx.save();
  ctx.translate(hinge[0], hinge[1]);
  ctx.rotate(pose.open || 0);
  ctx.translate(-hinge[0], -hinge[1]);
  placePiece(ctx, pieces.lower);
  ctx.restore();
  // pins at every joint
  rivet(ctx, J.hip, 1.7);
  rivet(ctx, J.kneeNear, 1.3);
  rivet(ctx, J.kneeFar, 1.1);
  rivet(ctx, J.bb, 1.35);
  rivet(ctx, J.pedalNear, 0.95);
  rivet(ctx, hinge, 1.2);
  ctx.restore();

  // the three rods
  const h = pose.hands;
  const billAng = angOf(sub(M.J.billTip, hinge)) + (pose.open || 0);
  const lowerTip = add(hinge, mul(dirOf(billAng), len(sub(M.J.billTip, hinge)) * 0.82));
  const billGrip = xf(add(lowerTip, rot([0, 1.2], billAng)));
  const footGrip = xf(add(J.ankleNear, [1.2, 0.6]));
  // the centre rod is bound to the breast, so it runs down clear of the legs and chainring
  const bodyGrip = xf([2, -60]);
  rodPath(ctx, bodyGrip, h.body, 2.0, 2.9, 0.86);
  rodPath(ctx, billGrip, h.bill, 1.15, 1.9, 0.8, -0.01);
  rodPath(ctx, footGrip, h.foot, 1.15, 1.9, 0.8);
  // the centre rod's binding: a spiral wrapping just below the top tube
  const wrapA = xf([3.0, -42]);
  const wrapB = xf([3.6, -33]);
  const wd = norm(sub(h.body, bodyGrip));
  const wn = [-wd[1], wd[0]];
  ctx.fillStyle = "#000";
  ctx.beginPath();
  const cw = 1.9;
  ctx.moveTo(wrapA[0] + wn[0] * cw, wrapA[1] + wn[1] * cw);
  ctx.lineTo(wrapB[0] + wn[0] * cw, wrapB[1] + wn[1] * cw);
  ctx.lineTo(wrapB[0] - wn[0] * cw, wrapB[1] - wn[1] * cw);
  ctx.lineTo(wrapA[0] - wn[0] * cw, wrapA[1] - wn[1] * cw);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineWidth = 0.42;
  for (let i = 0; i < 7; i += 1) {
    const c = mix2(wrapA, wrapB, (i + 0.5) / 7);
    ctx.beginPath();
    ctx.moveTo(c[0] - wn[0] * 1.5 - wd[0] * 0.7, c[1] - wn[1] * 1.5 - wd[1] * 0.7);
    ctx.lineTo(c[0] + wn[0] * 1.5 + wd[0] * 0.7, c[1] + wn[1] * 1.5 + wd[1] * 0.7);
    ctx.stroke();
  }
  ctx.restore();
  return { J, billGrip, footGrip, bodyGrip };
}
