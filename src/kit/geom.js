// Small geometry helpers for building shapes: smooth curves through control
// points, organic blobs, and placing a figure drawn in its own local units.

import { rng } from "./rng.js";

/** Catmull-Rom point between p1 and p2. */
function cr(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return [
    0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
  ];
}

/** A smooth closed outline through the control points (seg points per span). */
export function smoothClosed(pts, seg = 6) {
  const n = pts.length;
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    for (let s = 0; s < seg; s += 1) out.push(cr(p0, p1, p2, p3, s / seg));
  }
  return out;
}

/** A smooth open curve through the control points. */
export function smoothOpen(pts, seg = 6) {
  const n = pts.length;
  if (n < 3) return pts.slice();
  const out = [];
  for (let i = 0; i < n - 1; i += 1) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    for (let s = 0; s < seg; s += 1) out.push(cr(p0, p1, p2, p3, s / seg));
  }
  out.push(pts[n - 1]);
  return out;
}

/** An irregular rounded blob: centre, radii, wobble 0..1, seed. */
export function blob(cx, cy, rx, ry, wobble = 0.2, seed = 1, n = 9) {
  const next = rng(seed);
  const ctrl = [];
  const phase = next() * Math.PI * 2;
  for (let i = 0; i < n; i += 1) {
    const a = phase + (i / n) * Math.PI * 2;
    const r = 1 + (next() - 0.5) * 2 * wobble;
    ctrl.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
  }
  return smoothClosed(ctrl, 5);
}

/**
 * Placement for a figure drawn in local units: returns a function mapping a
 * local point to world. facing = -1 mirrors it; angle rotates about the origin.
 */
export function placer(x, y, scale, facing = 1, angle = 0) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return (pt) => {
    const lx = pt[0] * facing;
    const ly = pt[1];
    const out = [x + (lx * c - ly * s) * scale, y + (lx * s + ly * c) * scale];
    if (pt.length > 2) out.push(pt[2]);
    return out;
  };
}

export const mapPts = (pts, fn) => pts.map(fn);

/** Rotate a local point about a pivot. */
export function rotAbout(pt, pivot, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const dx = pt[0] - pivot[0];
  const dy = pt[1] - pivot[1];
  return [pivot[0] + dx * c - dy * s, pivot[1] + dx * s + dy * c];
}

/** Evenly spaced points along a polyline (for dotted lines and rows of marks). */
export function along(pts, spacing) {
  const out = [];
  let carry = 0;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let t = carry;
    while (t < d) {
      out.push([a[0] + ((b[0] - a[0]) * t) / d, a[1] + ((b[1] - a[1]) * t) / d]);
      t += spacing;
    }
    carry = t - d;
  }
  return out;
}
