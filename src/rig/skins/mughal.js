// The Mughal skin: the pelican as a court bird study and the bicycle as
// goldsmith's work, on a 2D canvas in world units. Two drawings of one pose:
//
//   paintBirdSide(ctx, skel, opts)  the side view, from the rig's shapes
//   paintBirdTop(ctx, skel, pel, opts)  the same bird and bicycle seen from
//     directly above, laid out from the rig's joints (x along the road, y
//     across it, near side towards the viewer = +y)
//
// Every texture mark (stipple, feather scallops, chasing on the gold) is placed
// in the bird's own coordinates, so it travels with the bird.

import { rng } from "../../kit/rng.js";
import { smoothClosed } from "../../kit/geom.js";
import { TAU, lerp } from "../../beat/ease.js";

export const MC = {
  ink: "#33200f", // hairline brown
  white: "#f6f1e4",
  shade: "#d9d4cc",
  grey: "#8f8a86",
  rose: "#e9b7ae",
  black: "#1c1714",
  bill: "#e9c24c",
  billDark: "#b5822a",
  billTip: "#c8582f",
  pouch: "#e99a37",
  pouchDark: "#b8661f",
  leg: "#e8a497",
  legDark: "#b8706a",
  gold: "#c9a13b",
  goldLight: "#ecd28a",
  goldDark: "#7d5a1c",
  red: "#c8402a",
  redDark: "#7e2316",
  green: "#2f7d5b",
};

// ------------------------------------------------------------------ helpers
function trace(ctx, pts, closed = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  if (closed) ctx.closePath();
}
function traceShape(ctx, sh) {
  if (sh.kind === "circle") {
    ctx.beginPath();
    ctx.arc(sh.c[0], sh.c[1], sh.r, 0, TAU);
    return;
  }
  trace(ctx, sh.pts, sh.closed);
}
function fillPts(ctx, pts, color) {
  trace(ctx, pts, true);
  ctx.fillStyle = color;
  ctx.fill();
}
function linePts(ctx, pts, color, w, closed = false) {
  trace(ctx, pts, closed);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}
/** A tapered stroke: a filled ribbon whose half-width runs from w0 to w1. */
function taper(ctx, pts, w0, w1, color) {
  const n = pts.length;
  if (n < 2) return;
  const left = [];
  const right = [];
  for (let i = 0; i < n; i += 1) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
    const w = lerp(w0, w1, i / (n - 1)) / 2;
    left.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
    right.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
  }
  fillPts(ctx, left.concat(right.reverse()), color);
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const addv = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mulv = (a, s) => [a[0] * s, a[1] * s];
const norm = (a) => {
  const d = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / d, a[1] / d];
};
function polyLen(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i += 1) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}
function pointAt(pts, t) {
  const L = polyLen(pts) * t;
  let acc = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + d >= L) {
      const f = d ? (L - acc) / d : 0;
      return [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f), sub(pts[i], pts[i - 1])];
    }
    acc += d;
  }
  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];
  return [b[0], b[1], sub(b, a)];
}

/** A gold tube: dark edge, base gold, a light line along its upper side, chased dots. */
function goldTube(ctx, pts, w, S, seed, chase = true) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  linePts(ctx, pts, MC.goldDark, w + 0.07 * S);
  linePts(ctx, pts, MC.gold, w);
  // the light catches the upper side of every tube
  const up = pts.map((p) => [p[0] - 0.012 * S, p[1] - w * 0.22]);
  linePts(ctx, up, MC.goldLight, w * 0.3);
  if (chase) {
    const L = polyLen(pts);
    const n = Math.floor(L / (0.16 * S));
    ctx.fillStyle = MC.goldDark;
    for (let i = 1; i < n; i += 1) {
      const p = pointAt(pts, i / n);
      const d = norm(p[2]);
      const off = (i % 2 ? 1 : -1) * w * 0.12;
      ctx.beginPath();
      ctx.arc(p[0] - d[1] * off, p[1] + d[0] * off, 0.012 * S, 0, TAU);
      ctx.fill();
    }
  }
}

// ------------------------------------------------------------------ the side view
/**
 * opts: { halo: colour of the reserve round the bird, haloW: its width in wheel radii, cool: 0..1 }
 */
export function paintBirdSide(ctx, skel, opts = {}) {
  const S = skel.scale;
  const J = skel.joints;
  const HAIR = 0.016 * S; // about 0.34 units
  const tilt = skel.bodyTilt;
  const shapes = skel.shapes;
  const byId = {};
  for (const sh of shapes) byId[sh.id] = sh;
  // bird-local frame: origin at the body centre, x along the body axis
  const bc = J.body;
  const ax = [Math.cos(-tilt), Math.sin(-tilt)];
  const ay = [-ax[1], ax[0]];
  const local = (u, v) => [bc[0] + (ax[0] * u + ay[0] * v) * S, bc[1] + (ax[1] * u + ay[1] * v) * S];

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // the reserve: a thin pale ground left round the whole figure so it stands
  // clear of the garden, as a pasted-in study does
  if (opts.halo) {
    ctx.strokeStyle = opts.halo;
    ctx.fillStyle = opts.halo;
    for (const sh of shapes) {
      if (sh.tag === "spoke" || sh.tag === "chain" || sh.tag === "wingfold" || sh.tag === "lid") continue;
      traceShape(ctx, sh);
      ctx.lineWidth = (sh.kind === "line" ? sh.w : sh.w || 0) + (opts.haloW ?? 0.09) * S;
      ctx.stroke();
      if (sh.kind !== "line" && sh.tag !== "tire" && sh.tag !== "rim" && sh.tag !== "ring") ctx.fill();
    }
  }

  const feathered = new Set(["tail", "body", "neck", "head", "crest"]);
  let featherOutline = false;

  for (const sh of shapes) {
    const far = sh.side === "far";
    switch (sh.tag) {
      case "leg": {
        const [a, b] = sh.pts;
        const w = sh.w * 0.9;
        linePts(ctx, sh.pts, MC.ink, w + HAIR * 2);
        linePts(ctx, sh.pts, far ? MC.legDark : MC.leg, w);
        // scaled skin: fine cross marks down the shin
        if (sh.id.includes("Shin")) {
          const d = norm(sub(b, a));
          const n = [-d[1], d[0]];
          ctx.strokeStyle = far ? "#8d524c" : MC.legDark;
          ctx.lineWidth = HAIR * 0.6;
          for (let i = 1; i < 7; i += 1) {
            const p = addv(a, mulv(sub(b, a), i / 7));
            ctx.beginPath();
            ctx.moveTo(p[0] - n[0] * w * 0.4, p[1] - n[1] * w * 0.4);
            ctx.lineTo(p[0] + n[0] * w * 0.4 + d[0] * 0.04 * S, p[1] + n[1] * w * 0.4 + d[1] * 0.04 * S);
            ctx.stroke();
          }
        }
        break;
      }
      case "foot":
        fillPts(ctx, sh.pts, far ? MC.legDark : MC.leg);
        linePts(ctx, sh.pts, MC.ink, HAIR, true);
        // webbing lines
        ctx.strokeStyle = MC.legDark;
        ctx.lineWidth = HAIR * 0.6;
        trace(ctx, [sh.pts[0], sh.pts[2]], false);
        ctx.stroke();
        break;
      case "crank":
        goldTube(ctx, sh.pts, sh.w * 0.8, S, 3, false);
        if (far) linePts(ctx, sh.pts, "rgba(40,20,10,0.35)", sh.w * 0.8);
        break;
      case "pedal":
        fillPts(ctx, sh.pts, far ? MC.goldDark : MC.gold);
        linePts(ctx, sh.pts, MC.goldDark, HAIR * 0.8, true);
        break;
      case "tire": {
        // a slender dark tyre of lacquered leather, with a gold rim inside
        ctx.beginPath();
        ctx.arc(sh.c[0], sh.c[1], sh.r, 0, TAU);
        ctx.strokeStyle = MC.ink;
        ctx.lineWidth = sh.w * 0.85;
        ctx.stroke();
        ctx.strokeStyle = "#4a3426";
        ctx.lineWidth = sh.w * 0.45;
        ctx.stroke();
        // tread: tiny gold studs
        ctx.fillStyle = MC.goldDark;
        for (let i = 0; i < 48; i += 1) {
          const a = (i / 48) * TAU + (byId.spokeRear0 ? 0 : 0);
          ctx.beginPath();
          ctx.arc(sh.c[0] + Math.cos(a) * sh.r, sh.c[1] + Math.sin(a) * sh.r, 0.012 * S, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case "rim": {
        ctx.beginPath();
        ctx.arc(sh.c[0], sh.c[1], sh.r, 0, TAU);
        ctx.strokeStyle = MC.goldDark;
        ctx.lineWidth = sh.w + 0.06 * S;
        ctx.stroke();
        ctx.strokeStyle = MC.gold;
        ctx.lineWidth = sh.w;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sh.c[0], sh.c[1], sh.r, Math.PI * 1.05, Math.PI * 1.75);
        ctx.strokeStyle = MC.goldLight;
        ctx.lineWidth = sh.w * 0.45;
        ctx.stroke();
        break;
      }
      case "spoke":
        linePts(ctx, sh.pts, "rgba(125,90,28,0.95)", Math.max(0.12, sh.w * 0.45));
        break;
      case "reflector":
        // the valve becomes a small ruby set in gold
        ctx.beginPath();
        ctx.arc(sh.c[0], sh.c[1], sh.r * 0.9, 0, TAU);
        ctx.fillStyle = MC.red;
        ctx.fill();
        ctx.strokeStyle = MC.goldDark;
        ctx.lineWidth = HAIR * 0.6;
        ctx.stroke();
        break;
      case "hub": {
        ctx.beginPath();
        ctx.arc(sh.c[0], sh.c[1], sh.r * 1.25, 0, TAU);
        ctx.fillStyle = MC.gold;
        ctx.fill();
        ctx.strokeStyle = MC.goldDark;
        ctx.lineWidth = HAIR * 0.7;
        ctx.stroke();
        // a little rosette
        ctx.fillStyle = MC.goldLight;
        ctx.beginPath();
        ctx.arc(sh.c[0] - sh.r * 0.25, sh.c[1] - sh.r * 0.25, sh.r * 0.42, 0, TAU);
        ctx.fill();
        ctx.fillStyle = MC.red;
        ctx.beginPath();
        ctx.arc(sh.c[0], sh.c[1], sh.r * 0.3, 0, TAU);
        ctx.fill();
        break;
      }
      case "frame":
        goldTube(ctx, sh.pts, sh.w * 0.82, S, 7);
        break;
      case "post":
      case "bar":
        goldTube(ctx, sh.pts, sh.w * 0.9, S, 9, false);
        break;
      case "grip":
        linePts(ctx, sh.pts, MC.ink, sh.w + HAIR);
        linePts(ctx, sh.pts, MC.red, sh.w * 0.8);
        break;
      case "bell":
        ctx.beginPath();
        ctx.arc(sh.c[0], sh.c[1], sh.r, 0, TAU);
        ctx.fillStyle = MC.gold;
        ctx.fill();
        ctx.strokeStyle = MC.goldDark;
        ctx.lineWidth = HAIR * 0.7;
        ctx.stroke();
        ctx.fillStyle = MC.goldLight;
        ctx.beginPath();
        ctx.arc(sh.c[0] - sh.r * 0.3, sh.c[1] - sh.r * 0.3, sh.r * 0.35, 0, TAU);
        ctx.fill();
        break;
      case "saddle": {
        paintSaddleCloth(ctx, sh, S, HAIR);
        break;
      }
      case "chain": {
        ctx.setLineDash([0.05 * S, 0.04 * S]);
        linePts(ctx, sh.pts, MC.goldDark, Math.max(sh.w, 0.2));
        ctx.setLineDash([]);
        break;
      }
      case "ring": {
        ctx.beginPath();
        ctx.arc(sh.c[0], sh.c[1], sh.r, 0, TAU);
        ctx.fillStyle = sh.id === "ring" ? MC.gold : "rgba(0,0,0,0)";
        if (sh.id === "ring") ctx.fill();
        ctx.strokeStyle = MC.goldDark;
        ctx.lineWidth = sh.w;
        ctx.stroke();
        if (sh.id === "ring") {
          // a pierced chainring: six petals
          ctx.fillStyle = MC.goldDark;
          for (let i = 0; i < 6; i += 1) {
            const a = (i / 6) * TAU;
            ctx.beginPath();
            ctx.arc(sh.c[0] + Math.cos(a) * sh.r * 0.55, sh.c[1] + Math.sin(a) * sh.r * 0.55, sh.r * 0.18, 0, TAU);
            ctx.fill();
          }
        }
        break;
      }
      case "tail":
      case "body":
      case "neck":
      case "head":
      case "crest": {
        if (!featherOutline) {
          for (const o of shapes) if (feathered.has(o.tag)) {
            traceShape(ctx, o);
            ctx.strokeStyle = MC.ink;
            ctx.lineWidth = HAIR * 2;
            ctx.stroke();
          }
          featherOutline = true;
        }
        traceShape(ctx, sh);
        ctx.fillStyle = sh.tag === "crest" ? "#f3e8c6" : MC.white;
        ctx.fill();
        if (sh.tag === "body") paintBodyModelling(ctx, sh, local, S, HAIR);
        if (sh.tag === "neck") paintNeckModelling(ctx, sh, skel, S, HAIR);
        if (sh.tag === "tail") {
          // a quill line down each tail feather
          const p = sh.pts;
          const tip = p[Math.floor(p.length / 2)];
          ctx.strokeStyle = "rgba(90,80,70,0.55)";
          ctx.lineWidth = HAIR * 0.5;
          trace(ctx, [p[0], tip], false);
          ctx.stroke();
        }
        break;
      }
      case "pouch": {
        traceShape(ctx, sh);
        const pts = sh.pts;
        let y0 = Infinity;
        let y1 = -Infinity;
        for (const p of pts) {
          y0 = Math.min(y0, p[1]);
          y1 = Math.max(y1, p[1]);
        }
        const g = ctx.createLinearGradient(0, y0, 0, y1);
        g.addColorStop(0, "#f2b44a");
        g.addColorStop(1, MC.pouch);
        ctx.fillStyle = g;
        ctx.fill();
        // fine skin wrinkles
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = "rgba(160,85,25,0.55)";
        ctx.lineWidth = HAIR * 0.5;
        const half = Math.floor(pts.length / 2);
        for (let i = 2; i < half - 1; i += 2) {
          const a = pts[i];
          const b = pts[pts.length - 1 - i];
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.quadraticCurveTo((a[0] + b[0]) / 2 - 0.06 * S, (a[1] + b[1]) / 2, b[0], b[1]);
          ctx.stroke();
        }
        ctx.restore();
        linePts(ctx, pts, MC.ink, HAIR, true);
        break;
      }
      case "bill": {
        traceShape(ctx, sh);
        ctx.fillStyle = sh.id === "billUpper" ? MC.bill : "#e0b445";
        ctx.fill();
        if (sh.id === "billUpper") {
          // culmen ridge and the red hooked nail
          const p = sh.pts;
          ctx.strokeStyle = MC.billDark;
          ctx.lineWidth = HAIR * 0.6;
          trace(ctx, [p[0], p[1], p[2], p[3]].map((q, i) => [q[0], q[1] + 0.03 * S * (1 - i / 3)]), false);
          ctx.stroke();
          fillPts(ctx, [p[4], p[5], p[6], p[7]], MC.billTip);
        }
        linePts(ctx, sh.pts, MC.ink, HAIR, true);
        break;
      }
      case "eye": {
        // bare yellow-pink skin round the eye
        ctx.beginPath();
        ctx.ellipse(sh.c[0] - sh.r * 0.2, sh.c[1], sh.r * 1.9, sh.r * 1.5, 0, 0, TAU);
        ctx.fillStyle = "#f1d6a3";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sh.c[0], sh.c[1], sh.r, 0, TAU);
        ctx.fillStyle = "#e7c45a";
        ctx.fill();
        ctx.strokeStyle = MC.ink;
        ctx.lineWidth = HAIR * 0.8;
        ctx.stroke();
        break;
      }
      case "pupil":
        ctx.beginPath();
        ctx.arc(sh.c[0], sh.c[1], sh.r * 1.1, 0, TAU);
        ctx.fillStyle = MC.black;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sh.c[0] - sh.r * 0.35, sh.c[1] - sh.r * 0.4, sh.r * 0.35, 0, TAU);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        break;
      case "lid": {
        ctx.save();
        ctx.beginPath();
        ctx.arc(sh.c[0], sh.c[1], sh.r * 1.05, 0, TAU);
        ctx.clip();
        ctx.fillStyle = "#f1d6a3";
        ctx.fillRect(sh.c[0] - sh.r * 1.2, sh.c[1] - sh.r * 1.2, sh.r * 2.4, sh.r * 2.4 * sh.amount);
        ctx.restore();
        break;
      }
      case "wingtip": {
        traceShape(ctx, sh);
        ctx.fillStyle = MC.black;
        ctx.fill();
        // a grey shaft and a pale edge on each flight feather
        const p = sh.pts;
        const tip = p[Math.floor(p.length / 2)];
        ctx.strokeStyle = "rgba(170,165,160,0.8)";
        ctx.lineWidth = HAIR * 0.5;
        trace(ctx, [p[0], tip], false);
        ctx.stroke();
        linePts(ctx, p, "rgba(120,110,100,0.9)", HAIR * 0.5, true);
        break;
      }
      case "wing": {
        traceShape(ctx, sh);
        ctx.fillStyle = "#efeae0";
        ctx.fill();
        paintWingCoverts(ctx, sh, local, S, HAIR);
        linePts(ctx, sh.pts, MC.ink, HAIR, true);
        break;
      }
      case "wingfold":
        linePts(ctx, sh.pts, "rgba(51,32,15,0.75)", HAIR * 0.7);
        break;
      default:
        break;
    }
  }
  ctx.restore();
}

function paintSaddleCloth(ctx, sh, S, HAIR) {
  const p = sh.pts;
  let x0 = Infinity;
  let x1 = -Infinity;
  let yb = -Infinity;
  for (const q of p) {
    x0 = Math.min(x0, q[0]);
    x1 = Math.max(x1, q[0]);
    yb = Math.max(yb, q[1]);
  }
  // a small red cloth hanging from under the saddle, gold-bordered, tasselled
  const top = yb - 0.02 * S;
  const drop = 0.42 * S;
  const cx0 = x0 - 0.06 * S;
  const cx1 = x1 + 0.02 * S;
  const cloth = [
    [cx0, top],
    [cx1, top],
    [cx1 - 0.02 * S, top + drop * 0.8],
    [lerp(cx0, cx1, 0.75), top + drop],
    [lerp(cx0, cx1, 0.5), top + drop * 0.86],
    [lerp(cx0, cx1, 0.25), top + drop],
    [cx0 + 0.02 * S, top + drop * 0.8],
  ];
  fillPts(ctx, cloth, MC.red);
  // gold border and a row of dots
  ctx.save();
  trace(ctx, cloth, true);
  ctx.clip();
  linePts(ctx, cloth, MC.gold, 0.09 * S, true);
  ctx.fillStyle = MC.goldLight;
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.arc(lerp(cx0, cx1, (i + 0.5) / 5), top + drop * 0.45, 0.03 * S, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  linePts(ctx, cloth, MC.ink, HAIR * 0.8, true);
  // tassels at the two lower corners
  for (const q of [cloth[6], cloth[2]]) {
    linePts(ctx, [q, [q[0], q[1] + 0.12 * S]], MC.goldDark, HAIR);
    ctx.beginPath();
    ctx.ellipse(q[0], q[1] + 0.17 * S, 0.035 * S, 0.07 * S, 0, 0, TAU);
    ctx.fillStyle = MC.gold;
    ctx.fill();
    ctx.strokeStyle = MC.goldDark;
    ctx.lineWidth = HAIR * 0.6;
    ctx.stroke();
  }
  // the saddle itself: dark green leather with a gold edge
  fillPts(ctx, p, "#24563f");
  linePts(ctx, p, MC.gold, HAIR * 1.2, true);
  linePts(ctx, p, MC.ink, HAIR * 0.6, true);
}

function paintBodyModelling(ctx, sh, local, S, HAIR) {
  ctx.save();
  traceShape(ctx, sh);
  ctx.clip();
  // the faintest grey under the belly and toward the tail, a hint of rose at the breast
  const belly = local(-0.2, 0.75);
  const g = ctx.createRadialGradient(belly[0], belly[1], 0.1 * S, belly[0], belly[1], 1.25 * S);
  g.addColorStop(0, "rgba(150,145,140,0.38)");
  g.addColorStop(1, "rgba(150,145,140,0)");
  ctx.fillStyle = g;
  ctx.fillRect(belly[0] - 2 * S, belly[1] - 2 * S, 4 * S, 4 * S);
  const breast = local(0.9, 0.2);
  const r = ctx.createRadialGradient(breast[0], breast[1], 0.05 * S, breast[0], breast[1], 0.8 * S);
  r.addColorStop(0, "rgba(233,170,160,0.42)");
  r.addColorStop(1, "rgba(233,170,160,0)");
  ctx.fillStyle = r;
  ctx.fillRect(breast[0] - S, breast[1] - S, 2 * S, 2 * S);
  // stipple: dots denser toward the shaded underside
  const next = rng(811);
  ctx.fillStyle = "rgba(95,90,88,0.5)";
  for (let i = 0; i < 260; i += 1) {
    const u = next() * 2.8 - 1.4;
    const v = next() * 1.9 - 0.95;
    const dens = Math.max(0, (v + 0.2) / 1.1) * (0.6 + 0.4 * Math.max(0, -u));
    if (next() > dens) continue;
    const q = local(u, v);
    ctx.beginPath();
    ctx.arc(q[0], q[1], 0.011 * S, 0, TAU);
    ctx.fill();
  }
  // contour feathers: small scallops in rows
  ctx.strokeStyle = "rgba(120,112,105,0.45)";
  ctx.lineWidth = HAIR * 0.5;
  for (let row = 0; row < 4; row += 1) {
    for (let c = 0; c < 6; c += 1) {
      const u = 0.8 - c * 0.32 - (row % 2) * 0.16;
      const v = 0.05 + row * 0.18;
      const q = local(u, v);
      ctx.beginPath();
      ctx.arc(q[0], q[1], 0.09 * S, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function paintNeckModelling(ctx, sh, skel, S, HAIR) {
  ctx.save();
  traceShape(ctx, sh);
  ctx.clip();
  const line = skel.neckLine;
  ctx.strokeStyle = "rgba(140,132,125,0.22)";
  ctx.lineWidth = HAIR * 0.4;
  for (let i = 3; i < line.length - 3; i += 3) {
    const a = line[i];
    const b = line[i + 1];
    const d = norm(sub(b, a));
    const n = [-d[1], d[0]];
    ctx.beginPath();
    ctx.moveTo(a[0] - n[0] * 0.18 * S, a[1] - n[1] * 0.18 * S);
    ctx.quadraticCurveTo(a[0] + d[0] * 0.08 * S, a[1] + d[1] * 0.08 * S, a[0] + n[0] * 0.18 * S, a[1] + n[1] * 0.18 * S);
    ctx.stroke();
  }
  // a pale yellow wash at the base of the neck, as on breeding birds
  const nb = skel.joints.neckBase;
  const g = ctx.createRadialGradient(nb[0], nb[1], 0, nb[0], nb[1], 0.45 * S);
  g.addColorStop(0, "rgba(236,214,140,0.45)");
  g.addColorStop(1, "rgba(236,214,140,0)");
  ctx.fillStyle = g;
  ctx.fillRect(nb[0] - S, nb[1] - S, 2 * S, 2 * S);
  ctx.restore();
}

function paintWingCoverts(ctx, sh, local, S, HAIR) {
  ctx.save();
  traceShape(ctx, sh);
  ctx.clip();
  // grey shading along the lower edge
  const lo = local(-0.3, 0.5);
  const g = ctx.createRadialGradient(lo[0], lo[1], 0.1 * S, lo[0], lo[1], 1.0 * S);
  g.addColorStop(0, "rgba(140,135,130,0.3)");
  g.addColorStop(1, "rgba(140,135,130,0)");
  ctx.fillStyle = g;
  ctx.fillRect(lo[0] - 2 * S, lo[1] - 2 * S, 4 * S, 4 * S);
  // rows of covert feathers, each a small scallop drawn in hairline
  ctx.strokeStyle = "rgba(95,85,78,0.6)";
  ctx.lineWidth = HAIR * 0.55;
  for (let row = 0; row < 5; row += 1) {
    for (let c = 0; c < 9; c += 1) {
      const u = 0.75 - c * 0.22 - (row % 2) * 0.11;
      const v = -0.45 + row * 0.15;
      const q = local(u, v);
      const r = (0.07 + row * 0.012) * S;
      ctx.beginPath();
      ctx.arc(q[0], q[1], r, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    }
  }
  // long secondaries: grey-edged lines toward the tail
  ctx.strokeStyle = "rgba(80,74,70,0.55)";
  for (let i = 0; i < 5; i += 1) {
    const a = local(-0.1 - i * 0.12, 0.05 + i * 0.05);
    const b = local(-1.0 - i * 0.05, -0.15 + i * 0.05);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ the top view
/**
 * The same pelican and bicycle from directly above, drawn so it reads at once
 * as a rider: the bicycle's whole line (rear tyre, frame, handlebar across,
 * front tyre), the body sitting over the saddle with the tyres showing ahead
 * of and behind it, the wings reaching forward to the grips, a short neck and
 * the head with the bill out over the front wheel, and a foot on each pedal.
 * x comes from the rig's joints, so wheels, cranks, pedals and feet sit over
 * their own places and alternate in step with the side view; y is across the
 * road, centred on cy, the near side (+y) toward the viewer. Lateral sizes are
 * in wheel radii. opts.palette gives the (cooler) colours.
 */
export function paintBirdTop(ctx, skel, pel, cy, opts = {}) {
  const S = skel.scale;
  const J = skel.joints;
  const HAIR = 0.02 * S;
  const Y = (v) => cy + v * S;
  const X = (p) => p[0];
  const C = opts.palette || MC;

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const rx = X(J.rear);
  const fx = X(J.front);
  const R = S * 0.94;
  const bb = X(J.bb);
  const gx = X(J.grip);
  const tail = X(J.tailRoot);
  const tip = X(J.billTip);

  // a soft shadow under the rider, cast down-stream
  ctx.fillStyle = "rgba(25,45,70,0.22)";
  ctx.beginPath();
  ctx.ellipse((rx + fx) / 2 + 0.3 * S, cy + 0.38 * S, 3.0 * S, 0.55 * S, 0, 0, TAU);
  ctx.fill();

  // ---- tyres: from above a wheel is a long dark band; the painter opens it a
  // little so the gold rim shows along both sides
  for (const c of [rx, fx]) {
    const band = (hw, ext) => {
      const pts = [];
      for (let i = 0; i <= 28; i += 1) {
        const a = (i / 28) * TAU;
        pts.push([c + Math.cos(a) * (R + ext), cy + Math.sin(a) * hw * Math.abs(Math.sin(a)) ** 0.25]);
      }
      return pts;
    };
    const rim = band(0.21 * S, 0.06 * S);
    fillPts(ctx, rim, C.gold);
    linePts(ctx, rim, C.goldDark, HAIR * 1.4, true);
    const tyre = band(0.13 * S, 0.03 * S);
    fillPts(ctx, tyre, "#2a221d");
    linePts(ctx, [[c - R * 0.92, Y(-0.17)], [c + R * 0.92, Y(-0.17)]], C.goldLight, 0.025 * S);
    // tread studs come round with the wheel
    ctx.fillStyle = "#6b5f55";
    for (let i = 0; i < 22; i += 1) {
      const a = pel.wheel + (i / 22) * TAU;
      if (Math.sin(a) < 0.15) continue;
      ctx.beginPath();
      ctx.arc(c + Math.cos(a) * R, cy, 0.035 * S, 0, TAU);
      ctx.fill();
    }
    // hub with its axle across
    linePts(ctx, [[c, Y(-0.24)], [c, Y(0.24)]], C.goldDark, 0.08 * S);
    ctx.beginPath();
    ctx.ellipse(c, cy, 0.09 * S, 0.15 * S, 0, 0, TAU);
    ctx.fillStyle = C.gold;
    ctx.fill();
  }

  // ---- frame: one gold line from the rear hub to the head tube, the fork on to the front hub
  goldTube(ctx, [[rx, cy], [bb, cy], [gx - 0.2 * S, cy]], 0.13 * S, S, 5);
  goldTube(ctx, [[gx - 0.25 * S, cy], [fx, cy]], 0.1 * S, S, 6, false);

  // ---- handlebar right across the front, swept back, with dark grips
  const bar = [[gx - 0.12 * S, Y(-0.74)], [gx + 0.1 * S, Y(-0.52)], [gx + 0.16 * S, Y(0)], [gx + 0.1 * S, Y(0.52)], [gx - 0.12 * S, Y(0.74)]];
  linePts(ctx, bar, C.ink, 0.17 * S);
  linePts(ctx, bar, C.gold, 0.12 * S);
  linePts(ctx, bar.map((p) => [p[0] + 0.03 * S, p[1]]), C.goldLight, 0.03 * S);
  for (const s of [-1, 1]) {
    const g = [[gx - 0.14 * S, Y(s * 0.78)], [gx - 0.02 * S, Y(s * 0.6)]];
    linePts(ctx, g, C.ink, 0.19 * S);
    linePts(ctx, g, C.red, 0.14 * S);
  }

  // ---- cranks, pedals and feet: the pedals alternate forward and back with the
  // crank; the foot on the higher pedal is nearer the eye and drawn a shade larger
  const mid = J.bb[1];
  const pedals = [
    { x: X(J.pedalFar), ankle: X(J.ankleFar), h: (mid - J.pedalFar[1]) / (0.5 * S), side: -1 },
    { x: X(J.pedalNear), ankle: X(J.ankleNear), h: (mid - J.pedalNear[1]) / (0.5 * S), side: 1 },
  ];
  const lat = 0.55;
  for (const pd of pedals) {
    const py = Y(pd.side * lat);
    goldTube(ctx, [[bb, Y(pd.side * 0.16)], [pd.x, Y(pd.side * (lat - 0.12))]], 0.09 * S, S, 1, false);
    const k = 1 + 0.12 * pd.h;
    const pw = 0.24 * S * k;
    const ph = 0.13 * S * k;
    const plate = [[pd.x - pw, py - ph], [pd.x + pw, py - ph], [pd.x + pw, py + ph], [pd.x - pw, py + ph]];
    fillPts(ctx, plate, C.gold);
    linePts(ctx, plate, C.goldDark, HAIR, true);
  }
  const paintFeet = () => {
    for (const pd of pedals) {
      const py = Y(pd.side * lat);
      const k = 1 + 0.12 * pd.h;
      // the shank: a short pink stub from under the wing out to the foot
      const ax = lerp(pd.ankle, pd.x, 0.5);
      taper(ctx, [[ax - 0.16 * S, Y(pd.side * 0.36)], [ax - 0.04 * S, py]], 0.15 * S + HAIR * 2, 0.11 * S + HAIR * 2, C.ink);
      taper(ctx, [[ax - 0.16 * S, Y(pd.side * 0.36)], [ax - 0.04 * S, py]], 0.15 * S, 0.11 * S, C.leg);
      // a webbed foot, three toes forward over the pedal
      const fx0 = ax - 0.1 * S;
      const F = (u, v) => [fx0 + u * S * k, py + v * S * k];
      const foot = [F(0, -0.08), F(0.3, -0.2), F(0.5, -0.17), F(0.56, -0.06), F(0.58, 0.06), F(0.5, 0.17), F(0.3, 0.2), F(0, 0.08)];
      fillPts(ctx, foot, C.leg);
      linePts(ctx, foot, C.ink, HAIR, true);
      ctx.strokeStyle = C.legDark;
      ctx.lineWidth = HAIR * 0.8;
      for (const q of [F(0.5, -0.15), F(0.57, 0), F(0.5, 0.15)]) {
        ctx.beginPath();
        ctx.moveTo(...F(0.05, 0));
        ctx.lineTo(q[0], q[1]);
        ctx.stroke();
      }
    }
  };

  // ---- the bird: body over the saddle, tail fan behind, wings to the grips
  const b0 = tail + 0.2 * S;
  const b1 = bb + 0.4 * S;
  const bc = (b0 + b1) / 2;
  const half = (b1 - b0) / 2;
  const bw = 0.43 * S;
  // the red saddle cloth peeps out either side of the body
  const sx = X(J.saddle);
  const cloth = [[sx - 0.36 * S, Y(-0.5)], [sx + 0.2 * S, Y(-0.5)], [sx + 0.22 * S, Y(0.5)], [sx - 0.38 * S, Y(0.5)]];
  fillPts(ctx, cloth, C.red);
  linePts(ctx, cloth, C.gold, 0.06 * S, true);
  // tail fan
  const fan = [];
  for (let i = 0; i <= 6; i += 1) {
    const a = Math.PI + (i / 6 - 0.5) * 1.1;
    fan.push([b0 + 0.1 * S + Math.cos(a) * 0.48 * S, cy + Math.sin(a) * 0.36 * S]);
  }
  const fanPts = [[b0 + 0.2 * S, cy]].concat(fan);
  fillPts(ctx, fanPts, C.white);
  linePts(ctx, fanPts, C.ink, HAIR, true);
  ctx.strokeStyle = "rgba(110,100,95,0.6)";
  ctx.lineWidth = HAIR * 0.5;
  for (let i = 1; i < 6; i += 1) {
    ctx.beginPath();
    ctx.moveTo(b0 + 0.15 * S, cy);
    ctx.lineTo(fan[i][0], fan[i][1]);
    ctx.stroke();
  }
  // wings reaching forward from the shoulders to the grips (where the side view rests its wing tips)
  for (const s of [-1, 1]) {
    const arm = [[b1 - 0.5 * S, Y(s * 0.3)], [b1 - 0.05 * S, Y(s * 0.5)], [gx - 0.3 * S, Y(s * 0.66)], [gx - 0.1 * S, Y(s * 0.7)]];
    taper(ctx, arm, 0.22 * S + HAIR * 2, 0.08 * S + HAIR * 2, C.ink);
    taper(ctx, arm, 0.22 * S, 0.08 * S, "#e9e5dc");
  }
  // the feet over everything at the sides, so their alternation reads at a glance
  paintFeet();
  // body: an egg, broadest at the shoulders
  const back = [];
  for (let i = 0; i < 40; i += 1) {
    const a = (i / 40) * TAU;
    const k = 1 + 0.18 * Math.cos(a);
    back.push([bc + Math.cos(a) * half, cy + Math.sin(a) * bw * k]);
  }
  fillPts(ctx, back, C.white);
  ctx.save();
  trace(ctx, back, true);
  ctx.clip();
  const g = ctx.createLinearGradient(0, cy - bw, 0, cy + bw);
  g.addColorStop(0, "rgba(130,135,140,0.35)");
  g.addColorStop(0.35, "rgba(130,135,140,0)");
  g.addColorStop(0.65, "rgba(130,135,140,0)");
  g.addColorStop(1, "rgba(130,135,140,0.35)");
  ctx.fillStyle = g;
  ctx.fillRect(bc - 2 * S, cy - S, 4 * S, 2 * S);
  ctx.restore();
  linePts(ctx, back, C.ink, HAIR, true);
  // folded wing coverts along the back, their black primaries crossing over the tail
  for (const s of [-1, 1]) {
    const wing = smoothClosed([
      [b1 - 0.2 * S, cy + s * bw * 0.3],
      [b1 - 0.45 * S, cy + s * bw * 0.98],
      [bc - 0.3 * S, cy + s * bw * 0.92],
      [b0 + 0.2 * S, cy + s * bw * 0.4],
      [bc - 0.1 * S, cy + s * bw * 0.12],
    ], 5);
    fillPts(ctx, wing, "#e9e5dc");
    ctx.save();
    trace(ctx, wing, true);
    ctx.clip();
    ctx.strokeStyle = "rgba(95,85,78,0.6)";
    ctx.lineWidth = HAIR * 0.5;
    for (let row = 0; row < 3; row += 1) {
      for (let c = 0; c < 6; c += 1) {
        const x = b1 - 0.35 * S - c * 0.2 * S - (row % 2) * 0.1 * S;
        const y = cy + s * bw * (0.35 + row * 0.22);
        ctx.beginPath();
        ctx.arc(x, y, 0.07 * S, -0.45 * Math.PI, 0.45 * Math.PI);
        ctx.stroke();
      }
    }
    ctx.restore();
    linePts(ctx, wing, C.ink, HAIR, true);
    for (let i = 0; i < 3; i += 1) {
      const root = [bc - 0.25 * S - i * 0.1 * S, cy + s * bw * (0.62 - i * 0.12)];
      const end = [b0 - 0.5 * S + i * 0.1 * S, cy - s * bw * (0.05 + i * 0.1)];
      const d = norm(sub(end, root));
      const n = [-d[1], d[0]];
      const fw = 0.09 * S;
      const fth = [root, [lerp(root[0], end[0], 0.45) + n[0] * fw, lerp(root[1], end[1], 0.45) + n[1] * fw], end, [lerp(root[0], end[0], 0.45) - n[0] * fw, lerp(root[1], end[1], 0.45) - n[1] * fw]];
      fillPts(ctx, fth, C.black);
    }
  }

  // ---- neck and head: the neck runs forward from the breast over the bars to
  // the head; the head is turned a few degrees toward us, uncovering the front tyre
  const hc = Math.max(X(J.head), gx + 0.3 * S);
  const neck = [[b1 - 0.2 * S, cy], [lerp(b1, hc, 0.5), cy], [hc - 0.1 * S, cy]];
  taper(ctx, neck, 0.34 * S + HAIR * 2, 0.24 * S + HAIR * 2, C.ink);
  taper(ctx, neck, 0.34 * S, 0.24 * S, C.white);
  ctx.strokeStyle = "rgba(130,122,115,0.5)";
  ctx.lineWidth = HAIR * 0.5;
  for (let x = b1; x < hc - 0.2 * S; x += 0.13 * S) {
    ctx.beginPath();
    ctx.arc(x, cy, 0.1 * S, -0.4 * Math.PI, 0.4 * Math.PI);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(hc, cy);
  ctx.rotate(opts.headAngle ?? 0.1);
  ctx.translate(-hc, -cy);
  const base = hc + 0.22 * S;
  const bt = Math.max(tip, fx + R * 0.9);
  // the pouch shows as an orange edge either side of the upper bill
  const pouch = [[base, cy - 0.13 * S], [lerp(base, bt, 0.5), cy - 0.15 * S], [bt - 0.15 * S, cy - 0.06 * S], [bt - 0.15 * S, cy + 0.06 * S], [lerp(base, bt, 0.5), cy + 0.15 * S], [base, cy + 0.13 * S]];
  fillPts(ctx, pouch, C.pouch);
  linePts(ctx, pouch, C.ink, HAIR, true);
  const bill = [[base - 0.05 * S, cy - 0.09 * S], [lerp(base, bt, 0.6), cy - 0.08 * S], [bt, cy - 0.03 * S], [bt + 0.05 * S, cy], [bt, cy + 0.03 * S], [lerp(base, bt, 0.6), cy + 0.08 * S], [base - 0.05 * S, cy + 0.09 * S]];
  fillPts(ctx, bill, C.bill);
  linePts(ctx, [[base, cy], [bt - 0.1 * S, cy]], C.billDark, HAIR * 0.7);
  fillPts(ctx, [[bt - 0.12 * S, cy - 0.035 * S], [bt + 0.05 * S, cy], [bt - 0.12 * S, cy + 0.035 * S]], C.billTip);
  linePts(ctx, bill, C.ink, HAIR, true);
  // the head: an oval, a pale crest behind, an eye just showing at each side
  fillPts(ctx, [[hc - 0.15 * S, cy - 0.08 * S], [hc - 0.48 * S, cy - 0.14 * S], [hc - 0.38 * S, cy], [hc - 0.48 * S, cy + 0.14 * S], [hc - 0.15 * S, cy + 0.08 * S]], "#f3e8c6");
  ctx.beginPath();
  ctx.ellipse(hc + 0.02 * S, cy, 0.3 * S, 0.22 * S, 0, 0, TAU);
  ctx.fillStyle = C.white;
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = HAIR;
  ctx.stroke();
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(hc + 0.1 * S, cy + s * 0.2 * S, 0.08 * S, 0.045 * S, 0, 0, TAU);
    ctx.fillStyle = "#e7c45a";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hc + 0.1 * S, cy + s * 0.21 * S, 0.035 * S, 0, TAU);
    ctx.fillStyle = C.black;
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}
