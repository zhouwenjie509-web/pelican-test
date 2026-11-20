// Phosphor: line drawings as an electron beam draws them on a cathode-ray tube.
//
//   drawPhosphor(stage, view, polylines, { intensity, width, halo, color })
//
// polylines is a list of [[x, y], ...] in world units, or of objects
//   { pts, a, w, ends, closed }
// where `a` scales the brightness of that stroke (an afterglow echo is a
// dimmer copy), `w` scales its width and `ends` brightens its end points and
// sharp corners (where a real beam lingers).
//
// Light adds: crossing strokes, echoes and halos sum, and the brightest cores
// burn towards white. The trace is drawn additively onto whatever the target
// already holds, so draw the tube face (or wall) first.
//
// How it works. The strokes are rasterised as intensity (not colour) on a
// per-frame 2D canvas with "lighter" compositing over black, with headroom
// above 1. That canvas is halved twice for a quarter-resolution copy, which is
// blurred twice (a tight glow and a wide halo). One shader then maps intensity
// to phosphor colour, adds the glows, applies an optional soft circular clip
// (a tube's face) and adds the result to the target. Every step is a function
// of its inputs: nothing is carried between frames.
//
// Further options (all optional):
//   deep      colour of the halo and of faint light            (default "#1fae4d")
//   ends      brightness added at line ends and sharp corners  (default 0.55)
//   glow      strength of the tight glow                       (default 1)
//   clip      { cx, cy, r, soft } world-unit circle the light is confined to
//   fills     [{ pts, a, stroke }] areas that glow faintly (a burnt-in image),
//             never as hard as the beam; closed polygons, or thick lines of
//             width `stroke` (world units) when it is given
//   bounds    { x0, y0, x1, y1 } world rectangle to work in (default: the
//             polylines' extent, cut to the clip circle)
//   coarseBelow  strokes fainter than this (or marked { coarse: true }) are
//             drawn at half resolution: right for afterglow, and cheap
//   res       resolution of the working canvases relative to the target
//             (default 1; 0.6 is a third of the cost and still sharp)
//   speed     0 .. 1, how far brightness follows the beam's speed (default 1):
//             a segment longer than `speedLen` world units (default 5) is
//             dimmed by sqrt(speedLen / length), down to `speedMin` (0.5)

import { VERT, FRAG_HEAD, rgb } from "../../kit/glsl.js";

const ENC = 4; // a canvas value of 255 means intensity 4

const FRAG = `${FRAG_HEAD}
uniform sampler2D uCore;
uniform sampler2D uGlow;
uniform sampler2D uHalo;
uniform sampler2D uCoarse;
uniform vec3 uColor;
uniform vec3 uDeep;
uniform float uIntensity;
uniform float uGlowAmt;
uniform float uHaloAmt;
uniform vec2 uSize;
uniform vec4 uClip;   // cx, cy, r, soft in patch pixels; r < 0: no clip
uniform vec2 uTexel;  // 1 / core texture size
void main() {
  vec2 uv = vTexCoord;
  // a touch of softness on the core: the spot of a real beam is not a hard edge
  vec2 d = uTexel * 0.75;
  vec4 c0 = texture(uCore, uv);
  vec4 c1 = texture(uCore, uv + vec2(d.x, d.y));
  vec4 c2 = texture(uCore, uv + vec2(-d.x, d.y));
  vec4 c3 = texture(uCore, uv + vec2(d.x, -d.y));
  vec4 c4 = texture(uCore, uv + vec2(-d.x, -d.y));
  vec4 c = c0 * 0.4 + (c1 + c2 + c3 + c4) * 0.15;
  float beam = (c.r + texture(uCoarse, uv).r) * ${ENC.toFixed(1)} * uIntensity;
  float soft = c.g * ${ENC.toFixed(1)} * uIntensity;
  vec4 g = texture(uGlow, uv) * ${ENC.toFixed(1)} * uIntensity;
  vec4 h = texture(uHalo, uv) * ${ENC.toFixed(1)} * uIntensity;

  // core: saturating phosphor green, burning towards a pale green-white
  float k = 1.0 - exp(-1.7 * beam);
  vec3 col = uColor * k * 1.08;
  col += vec3(0.62, 1.0, 0.72) * max(beam - 0.9, 0.0) * 0.42;
  // tight glow and wide halo, in the deeper green
  float gl = g.r + g.g * 0.8;
  float hl = h.r + h.g * 0.9;
  col += mix(uDeep, uColor, 0.35) * (1.0 - exp(-gl * 1.6)) * 0.62 * uGlowAmt;
  col += uDeep * (1.0 - exp(-hl * 2.2)) * 0.42 * uHaloAmt;
  col += mix(uDeep, uColor, 0.25) * (1.0 - exp(-soft * 1.4)) * 0.42;

  float m = 1.0;
  if (uClip.z > 0.0) {
    float r = length(uv * uSize - uClip.xy);
    m = 1.0 - smoothstep(uClip.z - uClip.w, uClip.z, r);
  }
  col *= m;
  fragColor = vec4(col, 1.0);
}`;

function hexRgb(hex) {
  return rgb(hex);
}

/** The intensity encoding for the canvas: "rgb(v,0,0)" style for channel 0 (beam) or 1 (soft). */
function encode(a, channel) {
  const v = Math.max(0, Math.min(255, Math.round((255 * a) / ENC)));
  return channel === 0 ? `rgb(${v},0,0)` : `rgb(0,${v},0)`;
}

function normalise(polylines) {
  const out = [];
  for (const pl of polylines) {
    if (!pl) continue;
    if (Array.isArray(pl)) {
      if (pl.length >= 2) out.push({ pts: pl, a: 1, w: 1, ends: 1 });
    } else if (pl.pts && pl.pts.length >= 2) {
      out.push({ pts: pl.pts, a: pl.a === undefined ? 1 : pl.a, w: pl.w === undefined ? 1 : pl.w, ends: pl.ends === undefined ? 1 : pl.ends, closed: pl.closed });
    }
  }
  return out;
}

/** Points where the beam lingers: both ends of an open stroke and every sharp corner. */
function lingerPoints(pts, closed, sharp = 0.62) {
  const out = [];
  const n = pts.length;
  const isClosed = closed || (n > 2 && Math.abs(pts[0][0] - pts[n - 1][0]) < 1e-6 && Math.abs(pts[0][1] - pts[n - 1][1]) < 1e-6);
  if (!isClosed) {
    out.push([pts[0][0], pts[0][1], 1]);
    out.push([pts[n - 1][0], pts[n - 1][1], 1]);
  }
  const last = isClosed ? n - 1 : n - 1;
  for (let i = 1; i < last; i += 1) {
    const ax = pts[i][0] - pts[i - 1][0];
    const ay = pts[i][1] - pts[i - 1][1];
    const bx = pts[i + 1][0] - pts[i][0];
    const by = pts[i + 1][1] - pts[i][1];
    const la = Math.hypot(ax, ay);
    const lb = Math.hypot(bx, by);
    if (la < 1e-6 || lb < 1e-6) continue;
    const cos = (ax * bx + ay * by) / (la * lb);
    if (cos < sharp) out.push([pts[i][0], pts[i][1], Math.min(1, (sharp - cos) / (sharp + 0.6))]);
  }
  return out;
}

/**
 * Draw glowing phosphor lines additively onto the current target.
 * Returns the world rectangle it worked in, or null if there was nothing to draw.
 */
export function drawPhosphor(stage, view, polylines, opts = {}) {
  const o = {
    intensity: 1,
    width: 1.4,
    halo: 6,
    color: "#59ff8a",
    deep: "#1fae4d",
    ends: 0.55,
    glow: 1,
    clip: null,
    fills: null,
    bounds: null,
    res: 1,
    coarseBelow: 0,
    speed: 1,
    speedLen: 5,
    speedMin: 0.5,
    ...opts,
  };
  const lines = normalise(polylines);
  const fills = (o.fills || []).filter((fl) => fl && fl.pts && fl.pts.length > 2);
  if (!lines.length && !fills.length) return null;

  // ------------------------------------------------------------ extent
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  if (o.bounds) {
    ({ x0, y0, x1, y1 } = o.bounds);
  } else {
    for (const pl of lines) {
      for (const pt of pl.pts) {
        if (pt[0] < x0) x0 = pt[0];
        if (pt[0] > x1) x1 = pt[0];
        if (pt[1] < y0) y0 = pt[1];
        if (pt[1] > y1) y1 = pt[1];
      }
    }
    for (const fl of fills) {
      for (const pt of fl.pts) {
        if (pt[0] < x0) x0 = pt[0];
        if (pt[0] > x1) x1 = pt[0];
        if (pt[1] < y0) y0 = pt[1];
        if (pt[1] > y1) y1 = pt[1];
      }
    }
    const pad = o.halo * 2.6 + o.width * 2;
    x0 -= pad;
    y0 -= pad;
    x1 += pad;
    y1 += pad;
  }
  if (o.clip) {
    const c = o.clip;
    x0 = Math.max(x0, c.cx - c.r - 1);
    x1 = Math.min(x1, c.cx + c.r + 1);
    y0 = Math.max(y0, c.cy - c.r - 1);
    y1 = Math.min(y1, c.cy + c.r + 1);
  }
  if (!(x1 > x0 && y1 > y0)) return null;

  // ------------------------------------------------------------ the beam, as intensity
  // the working canvases may be coarser than the target (res < 1): the beam is soft anyway
  const res = Math.max(0.25, Math.min(1, o.res));
  const pv = res === 1 ? view : view.scaled(res);
  const patch = stage.patch("phosphor/core", pv, x0, y0, x1, y1, 2);
  const ctx = patch.ctx;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, patch.w, patch.h);
  ctx.restore();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // soft areas first (the green channel)
  if (fills.length) {
    const groups = new Map();
    for (const fl of fills) {
      const ka = Math.round((fl.a === undefined ? 1 : fl.a) * 64);
      if (ka <= 0) continue;
      const kw = fl.stroke ? Math.max(1, Math.round(fl.stroke * 4)) : 0;
      const key = ka * 1000 + kw;
      if (!groups.has(key)) groups.set(key, { a: ka / 64, stroke: kw / 4, list: [] });
      groups.get(key).list.push(fl.pts);
    }
    for (const g of groups.values()) {
      ctx.beginPath();
      for (const pts of g.list) {
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
        if (!g.stroke) ctx.closePath();
      }
      if (g.stroke) {
        ctx.strokeStyle = encode(g.a, 1);
        ctx.lineWidth = g.stroke;
        ctx.stroke();
      } else {
        ctx.fillStyle = encode(g.a, 1);
        ctx.fill("nonzero");
      }
    }
  }

  // strokes, batched by brightness and width so a frame makes few calls;
  // faint ones (afterglow) go to a half-resolution canvas, where they cost a quarter
  const fine = [];
  const coarse = [];
  for (const pl of lines) (pl.coarse || pl.a < o.coarseBelow ? coarse : fine).push(pl);
  // The beam's brightness follows its speed: every vector takes about the same
  // time, so a long straight run is written fast and faint, short steps (curves,
  // corners) slowly and bright. Each stroke is cut into runs of equal level.
  const groups = new Map();
  const addRun = (pts, a, w) => {
    const ka = Math.round(a * 48);
    if (ka <= 0 || pts.length < 2) return;
    const kw = Math.round(w * 8);
    const key = ka * 1000 + kw;
    if (!groups.has(key)) groups.set(key, { a: ka / 48, w: kw / 8, list: [] });
    groups.get(key).list.push({ pts });
  };
  const sp = o.speed;
  const L0 = o.speedLen;
  for (const pl of fine) {
    const pts = pl.pts;
    if (!(sp > 0) || pts.length < 2) {
      addRun(pts, pl.a, pl.w);
      continue;
    }
    let run = [pts[0]];
    let lv = -1;
    for (let i = 1; i < pts.length; i += 1) {
      const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const b = len <= L0 ? 1 : Math.pow(L0 / len, 0.5);
      const q = Math.round((1 - sp + sp * Math.max(o.speedMin, b)) * 10);
      if (lv >= 0 && q !== lv) {
        addRun(run, (pl.a * lv) / 10, pl.w);
        run = [pts[i - 1]];
      }
      run.push(pts[i]);
      lv = q;
    }
    addRun(run, (pl.a * lv) / 10, pl.w);
  }
  const keys = [...groups.keys()].sort((a, b) => a - b);
  for (const key of keys) {
    const g = groups.get(key);
    ctx.strokeStyle = encode(g.a, 0);
    ctx.lineWidth = o.width * g.w;
    ctx.beginPath();
    for (const pl of g.list) {
      const pts = pl.pts;
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
    }
    ctx.stroke();
  }

  // where the beam lingers: brighter beads at ends and corners
  if (o.ends > 0) {
    const beads = new Map();
    for (const pl of fine) {
      const s = o.ends * pl.ends * pl.a;
      if (s < 0.04) continue;
      for (const [x, y, k] of lingerPoints(pl.pts, pl.closed)) {
        const ka = Math.round(s * k * 16);
        if (ka <= 0) continue;
        const r = o.width * pl.w * (0.55 + 0.25 * k);
        if (!beads.has(ka)) beads.set(ka, []);
        beads.get(ka).push([x, y, r]);
      }
    }
    for (const [ka, list] of beads) {
      ctx.fillStyle = encode(ka / 16, 0);
      ctx.beginPath();
      for (const [x, y, r] of list) {
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }
  patch.layer.touch();

  // ------------------------------------------------------------ glow and halo
  const w2 = patch.w / 2;
  const h2 = patch.h / 2;
  const half = stage.layer(`phosphor/half/${w2}x${h2}`, w2, h2);
  const hctx = half.clear();
  hctx.imageSmoothingEnabled = true;
  hctx.drawImage(patch.layer.canvas, 0, 0, w2, h2);

  const coarseLayer = stage.layer(`phosphor/coarse/${w2}x${h2}`, w2, h2);
  const cctx = coarseLayer.clear();
  cctx.fillStyle = "#000";
  cctx.fillRect(0, 0, w2, h2);
  if (coarse.length) {
    cctx.setTransform(pv.k / 2, 0, 0, pv.k / 2, (pv.tx - patch.x) / 2, (pv.ty - patch.y) / 2);
    cctx.globalCompositeOperation = "lighter";
    cctx.lineCap = "butt";
    cctx.lineJoin = "bevel";
    const cg = new Map();
    for (const pl of coarse) {
      const ka = Math.round(pl.a * 64);
      if (ka <= 0) continue;
      const kw = Math.round(pl.w * 4);
      const key = ka * 1000 + kw;
      if (!cg.has(key)) cg.set(key, { a: ka / 64, w: kw / 4, list: [] });
      cg.get(key).list.push(pl.pts);
    }
    for (const g of cg.values()) {
      cctx.strokeStyle = encode(g.a, 0);
      cctx.lineWidth = o.width * g.w * 1.25;
      cctx.beginPath();
      for (const pts of g.list) {
        cctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i += 1) cctx.lineTo(pts[i][0], pts[i][1]);
      }
      cctx.stroke();
    }
    cctx.setTransform(1, 0, 0, 1, 0, 0);
    hctx.globalCompositeOperation = "lighter";
    hctx.drawImage(coarseLayer.canvas, 0, 0);
    hctx.globalCompositeOperation = "source-over";
  }
  coarseLayer.touch();

  const w4 = w2 / 2;
  const h4 = h2 / 2;
  const quarter = stage.layer(`phosphor/quarter/${w4}x${h4}`, w4, h4);
  const qctx = quarter.clear();
  qctx.imageSmoothingEnabled = true;
  qctx.drawImage(half.canvas, 0, 0, w4, h4);

  const glowPx = Math.max(0.6, (o.halo * 0.28 * pv.k) / 4);
  const glow = stage.layer(`phosphor/glow/${w4}x${h4}`, w4, h4);
  const gctx = glow.clear();
  gctx.fillStyle = "#000";
  gctx.fillRect(0, 0, w4, h4);
  gctx.filter = `blur(${glowPx.toFixed(2)}px)`;
  gctx.drawImage(quarter.canvas, 0, 0);
  gctx.filter = "none";
  glow.touch();

  const w8 = w4 / 2;
  const h8 = h4 / 2;
  const haloPx = Math.max(0.8, (o.halo * pv.k) / 8);
  const halo = stage.layer(`phosphor/halo/${w8}x${h8}`, w8, h8);
  const lctx = halo.clear();
  lctx.fillStyle = "#000";
  lctx.fillRect(0, 0, w8, h8);
  lctx.imageSmoothingEnabled = true;
  lctx.filter = `blur(${haloPx.toFixed(2)}px)`;
  lctx.drawImage(quarter.canvas, 0, 0, w8, h8);
  lctx.filter = "none";
  halo.touch();

  // ------------------------------------------------------------ add it to the target
  const sh = stage.shader("phosphor/composite", VERT, FRAG);
  let clip = [0, 0, -1, 1];
  if (o.clip) {
    const c = o.clip;
    const soft = (c.soft === undefined ? 1.5 : c.soft) * pv.k;
    clip = [pv.x(c.cx) - patch.x, pv.y(c.cy) - patch.y, c.r * pv.k, Math.max(0.5, soft)];
  }
  const { p } = stage;
  stage.origin();
  stage.blend(p.ADD, () => {
    stage.shaderRect(
      sh,
      {
        uCore: patch.layer.img,
        uGlow: glow.img,
        uHalo: halo.img,
        uCoarse: coarseLayer.img,
        uColor: hexRgb(o.color),
        uDeep: hexRgb(o.deep),
        uIntensity: o.intensity,
        uGlowAmt: o.glow,
        uHaloAmt: o.halo > 0 ? 1 : 0,
        uSize: [patch.w, patch.h],
        uClip: clip,
        uTexel: [1 / patch.w, 1 / patch.h],
      },
      patch.x / res,
      patch.y / res,
      patch.w / res,
      patch.h / res,
    );
  });
  return { x0, y0, x1, y1 };
}
