// Outro (2:05 - 2:17): the press conference.
//
// The pelican leaves painting 20 on the downbeat and does not come out the
// other side. The camera pulls back to the whole gallery wall, 7 x 3 frames,
// then pushes slowly towards the 21st: an empty press-conference table.
// On the final beat the pelican rides past behind it without looking back.
//
// This file holds the 21st picture ("press"), the outro camera and the
// gallery renderer.

import { T_OUTRO_START, BAR, N_SECTIONS } from "../beat/timeline.js";
import { smoothstep, smootherstep, hermite5, decay, lerp } from "../beat/ease.js";
import { View } from "../kit/stage.js";
import { fillPaper } from "../kit/paper.js";
import { drawMoulding, drawWallShadow, drawInnerShadow } from "../kit/frame.js";
import { sprite, textSprite, placeText, drawText, font, FONTS } from "../kit/text.js";
import { CRANK_ON_BEAT } from "../rig/rig.js";
import { drawPlainPelican } from "./placeholder.js";
import {
  REF_W,
  REF_H,
  PX_PER_UNIT,
  ZOOM_IN,
  ANCHOR_Y,
  FOCUS_Y,
  ROAD_Y,
  SPEED,
  WHEEL_R,
  FRAME,
  GALLERY,
  boundaryX,
  galleryRect,
  galleryBounds,
  viewFor,
} from "../main/layout.js";
import { blendCameras } from "../main/camera.js";

const INK = "#2b2622";
const SUB_1 = "截至目前，人类共提交了 20 份答卷。";
const SUB_2 = "鹈鹕本人对此尚未发表评论。";
const NAMEPLATE = "鹈鹕（本人）";

// ------------------------------------------------------------------ timing
// Outro bars: 1 pull back, 2 wide shot, 3-4 push in, 5 hold, 6 final beat.
const bar = (n) => T_OUTRO_START + (n - 1) * BAR;
export const OUTRO = {
  pullStart: bar(1) + 0.3,
  pullEnd: bar(2),
  pushStart: bar(3),
  pushEnd: bar(5),
  /** Camera flashes on strong beats during the push. */
  flashes: [bar(3), bar(3) + 1, bar(4), bar(4) + 1, bar(4) + 1.5],
  /** The final beat: the pelican crosses the 21st picture. */
  pass: bar(6),
  passDuration: 1.15,
  /**
   * How long painting 20 stays live after the pelican leaves it, and when it settles into its still.
   * The still has the pelican in it and the live painting no longer does, so the dissolve is kept for
   * the end of the pull-back, when the painting is small (about a fifth of the screen's width and
   * shrinking) and the subtitle is coming in: earlier, the pelican that had just ridden out of the
   * picture was seen to fade back into it.
   */
  exitLive: 1.8,
  exitBlend: [1.3, 1.75],
  /**
   * Where each flash comes from, left (-1) to right (+1): the same figures as the pan of each flash's
   * sound in audio/parts/21-outro.js, so a flash heard on the left throws its shadows to the right.
   */
  flashFrom: [-0.4, 0.3, -0.15, 0.45, -0.3],
};

// ------------------------------------------------------------------ camera
const X20 = boundaryX(N_SECTIONS);
const BOUNDS = galleryBounds();
const R21 = galleryRect(21);
const GRID_SCREEN_Y = 478; // screen row of the grid's centre, leaving room for subtitles below

const WIDE = (() => {
  const zoom = (0.9 * REF_W) / (BOUNDS.x1 - BOUNDS.x0) / PX_PER_UNIT;
  const k = PX_PER_UNIT * zoom;
  return { x: (BOUNDS.x0 + BOUNDS.x1) / 2, y: (BOUNDS.y0 + BOUNDS.y1) / 2 + (ANCHOR_Y - GRID_SCREEN_Y) / k, zoom };
})();

const CLOSE = (() => {
  const k = (0.76 * REF_H) / (GALLERY.side + 2 * FRAME.w);
  return { x: (R21.x0 + R21.x1) / 2, y: (R21.y0 + R21.y1) / 2 + (ANCHOR_Y - GRID_SCREEN_Y) / k, zoom: k / PX_PER_UNIT };
})();

export function outroCamera(t) {
  const tau = t - T_OUTRO_START;
  if (t < OUTRO.pullEnd) {
    // carry the tracking shot's momentum to a stop, then pull back
    const start = {
      x: X20 + hermite5(tau, 0, 0.7, 0, SPEED, 42, 0),
      y: FOCUS_Y,
      zoom: 1 + (ZOOM_IN - 1) * smoothstep(-0.25, 0.4, tau),
    };
    return blendCameras(start, WIDE, smootherstep(OUTRO.pullStart, OUTRO.pullEnd, t));
  }
  return blendCameras(WIDE, CLOSE, smootherstep(OUTRO.pushStart, OUTRO.pushEnd, t));
}

// ------------------------------------------------------------------ the 21st picture
// Local coordinates: corridor units measured from boundary 20. The picture
// area is the square x 18..371, y 433..786; the floor the pelican rides on
// is the road line y = 700.
const P21 = { x0: R21.x0 - X20, y0: R21.y0, x1: R21.x1 - X20, y1: R21.y1 };
const P21_CX = (P21.x0 + P21.x1) / 2;
const TABLE = { x0: P21.x0 + 34, x1: P21.x1 - 34, top: 646, bottom: 772 };
const MICS = [-88, -45, 0, 45, 88];
const MIC_FOAM = ["#b9483c", "#3f5f8f", "#4d4d4d", "#c9a23a", "#4f7d5a"];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function paintBack(ctx) {
  // curtain
  const g = ctx.createLinearGradient(0, P21.y0, 0, 690);
  g.addColorStop(0, "#2b3443");
  g.addColorStop(1, "#465368");
  ctx.fillStyle = g;
  ctx.fillRect(P21.x0, P21.y0, P21.x1 - P21.x0, 690 - P21.y0);
  for (let x = P21.x0; x < P21.x1; x += 15.5) {
    const fold = ctx.createLinearGradient(x, 0, x + 15.5, 0);
    fold.addColorStop(0, "rgba(0,0,0,0.20)");
    fold.addColorStop(0.35, "rgba(255,255,255,0.07)");
    fold.addColorStop(1, "rgba(0,0,0,0.14)");
    ctx.fillStyle = fold;
    ctx.fillRect(x, P21.y0, 15.5, 690 - P21.y0);
  }
  // curtain rail
  ctx.fillStyle = "#1c222c";
  ctx.fillRect(P21.x0, P21.y0, P21.x1 - P21.x0, 7);
  // floor
  const fl = ctx.createLinearGradient(0, 688, 0, P21.y1);
  fl.addColorStop(0, "#8f806c");
  fl.addColorStop(1, "#b3a48f");
  ctx.fillStyle = fl;
  ctx.fillRect(P21.x0, 688, P21.x1 - P21.x0, P21.y1 - 688);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(P21.x0, 688, P21.x1 - P21.x0, 2.2);
}

// The set's colours, as it stands and as a camera flash lights it.
const SET = {
  plain: {
    chairOuter: "#2a2420",
    chairInner: "#3d342d",
    chairSeam: "rgba(255,255,255,0.10)",
    tableEdge: "#f6f2ea",
    cloth: ["#e9e4d9", "#cfc8ba"],
    pleat: "rgba(60,50,40,0.13)",
    underEdge: "rgba(0,0,0,0.16)",
    micBase: "#26282b",
    micNeck: "#2f3236",
    foam: MIC_FOAM,
    foamShine: "rgba(255,255,255,0.16)",
    flag: "#e8e4dc",
    flagEdge: "rgba(0,0,0,0.3)",
    plateShadow: "rgba(0,0,0,0.18)",
    plate: "#fbfaf6",
  },
  lit: {
    chairOuter: "#4b3e34",
    chairInner: "#86705c",
    chairSeam: "rgba(40,28,20,0.30)",
    tableEdge: "#ffffff",
    cloth: ["#fffefa", "#f4efe4"],
    pleat: "rgba(60,50,40,0.09)",
    underEdge: "rgba(0,0,0,0.10)",
    micBase: "#4d5056",
    micNeck: "#5f646b",
    foam: ["#d98a80", "#8199c0", "#8e8e8e", "#e6c97c", "#92b59b"],
    foamShine: "rgba(255,255,255,0.50)",
    flag: "#ffffff",
    flagEdge: "rgba(0,0,0,0.3)",
    plateShadow: "rgba(0,0,0,0.26)",
    plate: "#ffffff",
  },
};
// how far a flash from the far side (1) throws the chair's and the microphones' shadows on the curtain, in units
const SHADOW = { dx: 30, dy: 3, color: "#27303f" };

const micHead = (dx) => ({ bx: P21_CX + dx, hx: P21_CX + dx * 0.62, hy: 612 - Math.abs(dx) * 0.05 });

/** The chair, the table, the microphones and the nameplate. `side` (lit only): +1 for a flash from the left, -1 from the right. */
function paintFront(ctx, c = SET.plain, side = 0) {
  // the empty chair, behind the table
  ctx.fillStyle = c.chairOuter;
  roundRect(ctx, P21_CX - 30, 566, 60, 92, 9);
  ctx.fill();
  ctx.fillStyle = c.chairInner;
  roundRect(ctx, P21_CX - 25, 571, 50, 80, 7);
  ctx.fill();
  ctx.strokeStyle = c.chairSeam;
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(P21_CX - 20, 590 + i * 18);
    ctx.lineTo(P21_CX + 20, 590 + i * 18);
    ctx.stroke();
  }
  if (side) {
    // flash light on leather: a sheen down the side the light comes from
    ctx.save();
    roundRect(ctx, P21_CX - 25, 571, 50, 80, 7);
    ctx.clip();
    const sheen = ctx.createLinearGradient(P21_CX - 25, 0, P21_CX + 25, 0);
    const at = side > 0 ? 0.3 : 0.7;
    sheen.addColorStop(Math.max(0, at - 0.3), "rgba(255,244,228,0)");
    sheen.addColorStop(at, "rgba(255,244,228,0.34)");
    sheen.addColorStop(Math.min(1, at + 0.3), "rgba(255,244,228,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(P21_CX - 25, 571, 50, 80);
    ctx.restore();
  }

  // table: top edge and cloth
  ctx.fillStyle = c.tableEdge;
  ctx.fillRect(TABLE.x0 - 3, TABLE.top - 5, TABLE.x1 - TABLE.x0 + 6, 6);
  const cloth = ctx.createLinearGradient(0, TABLE.top, 0, TABLE.bottom);
  cloth.addColorStop(0, c.cloth[0]);
  cloth.addColorStop(1, c.cloth[1]);
  ctx.fillStyle = cloth;
  ctx.fillRect(TABLE.x0, TABLE.top, TABLE.x1 - TABLE.x0, TABLE.bottom - TABLE.top);
  ctx.strokeStyle = c.pleat;
  ctx.lineWidth = 0.7;
  for (let x = TABLE.x0 + 17; x < TABLE.x1; x += 23) {
    ctx.beginPath();
    ctx.moveTo(x, TABLE.top + 4);
    ctx.lineTo(x + 2.5, TABLE.bottom);
    ctx.stroke();
  }
  ctx.fillStyle = c.underEdge;
  ctx.fillRect(TABLE.x0, TABLE.top, TABLE.x1 - TABLE.x0, 2);

  // microphones: plain windscreens and blank flags, no markings
  MICS.forEach((dx, i) => {
    const { bx, hx, hy } = micHead(dx);
    ctx.fillStyle = c.micBase;
    roundRect(ctx, bx - 8, TABLE.top - 8, 16, 4, 1.5);
    ctx.fill();
    ctx.strokeStyle = c.micNeck;
    ctx.lineWidth = 1.9;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bx, TABLE.top - 7);
    ctx.quadraticCurveTo(bx, hy + 14, hx, hy);
    ctx.stroke();
    const ang = Math.atan2(hy - (TABLE.top - 7), hx - bx) + Math.PI * 0.04;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(ang);
    ctx.fillStyle = c.foam[i];
    roundRect(ctx, -2, -5.2, 15, 10.4, 5);
    ctx.fill();
    ctx.fillStyle = c.foamShine;
    roundRect(ctx, 0, -4, 11, 3, 1.5);
    ctx.fill();
    ctx.fillStyle = c.flag;
    ctx.fillRect(-8.5, -4.6, 6.5, 9.2); // blank flag
    ctx.strokeStyle = c.flagEdge;
    ctx.lineWidth = 0.4;
    ctx.strokeRect(-8.5, -4.6, 6.5, 9.2);
    ctx.restore();
  });

  // nameplate: the plate is wide enough for the name with air on both sides, and the ink (not the
  // advance width: the brackets and the letter-spacing leave more blank on the right) is centred on it
  const pw = 146;
  const ph = 36;
  const px = P21_CX - pw / 2;
  const py = TABLE.top + 12;
  ctx.fillStyle = c.plateShadow;
  ctx.fillRect(px + 2, py + ph - 1, pw, 4);
  ctx.fillStyle = c.plate;
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = "#2b2622";
  ctx.lineWidth = 1.1;
  ctx.strokeRect(px, py, pw, ph);
  ctx.strokeRect(px + 2.6, py + 2.6, pw - 5.2, ph - 5.2);
  const nameFont = font(FONTS.song, 19, 700);
  ctx.save();
  ctx.font = nameFont;
  ctx.textAlign = "left";
  if ("letterSpacing" in ctx) ctx.letterSpacing = "1.5px";
  const ink = ctx.measureText(NAMEPLATE);
  ctx.restore();
  const inkCentre = (ink.actualBoundingBoxRight - ink.actualBoundingBoxLeft) / 2;
  // (the ink of these characters sits low in the line: 1.1 units up puts as much plate above it as below)
  drawText(ctx, NAMEPLATE, P21_CX - inkCentre, py + ph / 2 - 1.1, { font: nameFont, align: "left", baseline: "middle", fill: "#1d1916", spacing: 1.5 });
}

/** The curtain and floor in a flash: flat frontal light, brightest behind the table. */
function paintBackLit(ctx) {
  const g = ctx.createRadialGradient(P21_CX, 600, 30, P21_CX, 600, 310);
  g.addColorStop(0, "#c4d0e1");
  g.addColorStop(0.55, "#97a7bf");
  g.addColorStop(1, "#66758d");
  ctx.fillStyle = g;
  ctx.fillRect(P21.x0, P21.y0, P21.x1 - P21.x0, 690 - P21.y0);
  for (let x = P21.x0; x < P21.x1; x += 15.5) {
    const fold = ctx.createLinearGradient(x, 0, x + 15.5, 0);
    fold.addColorStop(0, "rgba(22,30,46,0.30)");
    fold.addColorStop(0.35, "rgba(255,255,255,0.24)");
    fold.addColorStop(1, "rgba(22,30,46,0.20)");
    ctx.fillStyle = fold;
    ctx.fillRect(x, P21.y0, 15.5, 690 - P21.y0);
  }
  ctx.fillStyle = "#3b4454";
  ctx.fillRect(P21.x0, P21.y0, P21.x1 - P21.x0, 7);
  const fl = ctx.createLinearGradient(0, 688, 0, P21.y1);
  fl.addColorStop(0, "#cdc1ab");
  fl.addColorStop(1, "#f0e8d9");
  ctx.fillStyle = fl;
  ctx.fillRect(P21.x0, 688, P21.x1 - P21.x0, P21.y1 - 688);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(P21.x0, 688, P21.x1 - P21.x0, 2.2);
}

/** What stands between the flash and the curtain, as one flat shape: the chair and the microphones. */
function paintShadow(ctx) {
  ctx.fillStyle = SHADOW.color;
  ctx.strokeStyle = SHADOW.color;
  roundRect(ctx, P21_CX - 30, 566, 60, 92, 9);
  ctx.fill();
  for (const dx of MICS) {
    const { bx, hx, hy } = micHead(dx);
    roundRect(ctx, bx - 8, TABLE.top - 8, 16, 4, 1.5);
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bx, TABLE.top - 7);
    ctx.quadraticCurveTo(bx, hy + 14, hx, hy);
    ctx.stroke();
    const ang = Math.atan2(hy - (TABLE.top - 7), hx - bx) + Math.PI * 0.04;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(ang);
    roundRect(ctx, -8.5, -5.4, 21.5, 10.8, 5);
    ctx.fill();
    ctx.restore();
  }
}

export const press = {
  id: "press",
  n: 21,
  zh: "新闻发布会",
  en: "The Press Conference",

  render(stage, f) {
    const { p } = stage;
    const os = PX_PER_UNIT * ZOOM_IN * f.s;
    const w = P21.x1 - P21.x0;
    const h = P21.y1 - P21.y0;
    const paint = (key, fn) =>
      sprite(stage, `press/${key}/${os.toFixed(3)}`, w * os, h * os, (ctx) => {
        ctx.scale(os, os);
        ctx.translate(-P21.x0, -P21.y0);
        fn(ctx);
      });
    const back = paint("back", paintBack);
    const front = paint("front", (ctx) => paintFront(ctx));

    // camera flashes: for an instant the set is seen in flash light, from the side that flash came from
    let flash = 0;
    let from = 0;
    OUTRO.flashes.forEach((tf, i) => {
      const dt = f.t - tf;
      if (dt >= 0 && dt < 0.5 && decay(dt, 0.055) > flash) {
        flash = decay(dt, 0.055);
        from = OUTRO.flashFrom[i];
      }
    });
    const lit = flash > 0.01;
    const side = from < 0 ? 1 : -1; // +1: the light comes from the left

    stage.withView(f.view, () => {
      stage.image(back, P21.x0, P21.y0, w, h);
      if (lit) {
        stage.image(paint("back-lit", paintBackLit), P21.x0, P21.y0, w, h, flash);
        // the hard shadow of the chair and the microphones on the curtain, away from the flash
        stage.image(paint("shadow", paintShadow), P21.x0 - from * SHADOW.dx, P21.y0 + SHADOW.dy, w, h, 0.8 * flash);
      }
    });

    // the final beat: straight across, behind the table, eyes front
    const dt = f.t - OUTRO.pass;
    if (dt > 0 && dt < OUTRO.passDuration) {
      const x = lerp(P21.x0 - 75, P21.x1 + 75, dt / OUTRO.passDuration);
      drawPlainPelican(stage, f, {
        pose: { x, y: ROAD_Y, slope: 0, scale: WHEEL_R, crank: CRANK_ON_BEAT + (2 * Math.PI * x) / SPEED, wheel: x / WHEEL_R, time: f.t },
        act: { wind: 1.7, lean: 0.1, headPitch: -0.04 },
        clip: P21,
        shadow: false,
      });
    }

    stage.withView(f.view, () => {
      stage.image(front, P21.x0, P21.y0, w, h);
      if (lit) {
        stage.image(paint(side > 0 ? "front-lit-l" : "front-lit-r", (ctx) => paintFront(ctx, SET.lit, side)), P21.x0, P21.y0, w, h, flash);
        // and the lens is dazzled a little
        p.noStroke();
        p.fill(255, 252, 240, 255 * 0.16 * flash * flash);
        p.rect(P21.x0, P21.y0, w, h);
      }
    });
  },
};

// ------------------------------------------------------------------ gallery wall
const LIVE_PX = (stage) => Math.round(GALLERY.side * PX_PER_UNIT * ZOOM_IN * stage.s);

/** Render the whole frame for t >= T_OUTRO_START. */
export function renderGallery(film, t) {
  const st = film.stage;
  const { W, H } = st;
  const cam = outroCamera(t);
  const view = viewFor(cam, { w: W, h: H });
  const vb = view.bounds(W, H);
  const side = GALLERY.side;
  const livePx = LIVE_PX(st);
  const tau = t - T_OUTRO_START;

  const visible = (r) => r.x1 + FRAME.w + 12 > vb.x0 && r.x0 - FRAME.w - 12 < vb.x1 && r.y1 + FRAME.w + 12 > vb.y0 && r.y0 - FRAME.w - 12 < vb.y1;
  const rects = [];
  for (let i = 1; i <= GALLERY.cols * GALLERY.rows; i += 1) rects.push({ i, r: galleryRect(i) });
  const shown = rects.filter(({ r }) => visible(r));

  // picture contents first (they switch render targets)
  const textures = new Map();
  for (const { i, r } of shown) {
    if (i === 21) {
      const fb = st.fb("gallery/press", livePx, livePx);
      film.renderSceneView(21, fb, t, View.fit(r.x0 - X20, r.y0, side, livePx));
      textures.set(i, fb);
    } else {
      textures.set(i, film.still(i));
    }
  }
  // painting 20 stays alive for a moment while the pelican's tail leaves it
  let live20 = null;
  if (tau < OUTRO.exitLive && textures.has(20)) {
    const r = galleryRect(20);
    live20 = st.fb("gallery/live20", livePx, livePx);
    film.renderSceneView(20, live20, t, View.fit(r.x0 - boundaryX(N_SECTIONS - 1), r.y0, side, livePx));
  }

  st.origin();
  fillPaper(st, view);
  st.withView(view, () => {
    for (const { i, r } of shown) {
      if (i === 20 && live20) {
        st.image(live20, r.x0, r.y0, side, side);
        st.image(textures.get(i), r.x0, r.y0, side, side, smoothstep(OUTRO.exitBlend[0], OUTRO.exitBlend[1], tau));
      } else {
        st.image(textures.get(i), r.x0, r.y0, side, side);
      }
    }
    for (const { r } of shown) drawWallShadow(st, r, FRAME.w);
    for (const { r } of shown) {
      drawMoulding(st, r, FRAME.w);
      drawInnerShadow(st, r);
    }
  });

  // subtitles, centred below the pictures
  st.origin();
  const s = st.s;
  const sub1 = textSprite(st, `outro/sub1/${s}`, SUB_1, { family: FONTS.song, size: 58 * s, weight: 700, fill: INK, spacing: 2 * s });
  const sub2 = textSprite(st, `outro/sub2/${s}`, SUB_2, { family: FONTS.song, size: 58 * s, weight: 700, fill: INK, spacing: 2 * s });
  const a1 = Math.min(smoothstep(OUTRO.pullEnd - 0.7, OUTRO.pullEnd - 0.1, t), 1 - smoothstep(OUTRO.pushStart + 0.2, OUTRO.pushStart + 0.8, t));
  const a2 = smoothstep(OUTRO.pushEnd, OUTRO.pushEnd + 0.45, t);
  placeText(st, sub1, (REF_W / 2) * s, 972 * s, { align: "center", alpha: a1 });
  placeText(st, sub2, (REF_W / 2) * s, 984 * s, { align: "center", alpha: a2 });
}
