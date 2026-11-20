// Stand-in scene used until a section is painted: a labelled colour block with
// the road, beat marks along it, and the plain pelican.
//
// It is also the smallest complete example of the scene interface:
//
//   scene.render(stage, f) draws one whole frame into the current target.
//     f.view     maps the scene's 1000-unit square to target pixels
//     f.u        seconds since this section's entry crossing (may be < 0 or > 6
//                while a neighbouring section still owns the pelican)
//     f.pelican  { x, y, slope, crank, wheel, time, speed, scale, visible }
//     f.w, f.h   target size in pixels; f.s = pixels per 1080p pixel
//
// Everything is anchored to the scene's world, never to the screen, so the
// same code serves the film, the transitions and the gallery still.

import { sprite, drawText, font, FONTS, luminance } from "../kit/text.js";
import { solveRig } from "../rig/rig.js";
import { drawPlain } from "../rig/skins/plain.js";
import { ROAD_Y, SECTION_LEN, PX_PER_UNIT, ZOOM_IN, SPEED } from "../main/layout.js";
import { SECTION_BARS, BEATS_PER_BAR, T_SECTION } from "../beat/timeline.js";
import { hermite5 } from "../beat/ease.js";

/**
 * An example motion(u) override: brake, hold a pose, then make up the distance
 * before the next frame. It keeps the contract: x = 0 at u = 0, x = 1000 at
 * u = 6, standard speed at both ends, never backwards.
 */
export function holdAPose(u) {
  if (u < 1.3) return { x: SPEED * u };
  if (u < 2.3) return { x: hermite5(u, 1.3, 2.3, SPEED * 1.3, SPEED, SPEED * 1.3 + SPEED / 2, 0) };
  const stop = SPEED * 1.3 + SPEED / 2;
  if (u < 3.0) return { x: stop };
  return { x: hermite5(u, 3.0, T_SECTION, stop, 0, SECTION_LEN, SPEED) };
}

const TITLE_W = 470; // world units
const TITLE_H = 200;

function hexToRgb(hex) {
  const v = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
}

function shadeHex(hex, f) {
  return hexToRgb(hex).map((c) => Math.max(0, Math.min(255, Math.round(f >= 1 ? c + (255 - c) * (f - 1) : c * f))));
}

/**
 * Draw the plain pelican for this frame and composite it.
 * options: { act, pose (overrides for f.pelican), shadow, shadowColor, clip: { x0, y0, x1, y1 } }
 */
export function drawPlainPelican(stage, f, options = {}) {
  const pose = { ...f.pelican, ...(options.pose || {}) };
  if (!pose.visible && !options.pose) return null;
  const skel = solveRig({ ...pose, act: options.act });
  const b = skel.bounds;
  const patch = stage.patch("plain", f.view, b.x0, b.y0, b.x1, b.y1 + skel.scale * 0.4);
  const ctx = patch.ctx;
  if (options.clip) {
    const c = options.clip;
    ctx.beginPath();
    ctx.rect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);
    ctx.clip();
  }
  if (options.shadow !== false) {
    // soft contact shadow on the road
    ctx.fillStyle = options.shadowColor || "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(pose.x, pose.y + skel.scale * 0.1, skel.scale * 2.5, skel.scale * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  drawPlain(ctx, skel, options);
  stage.imagePatch(patch);
  return skel;
}

export function makePlaceholder(meta, extras = {}) {
  const dark = luminance(meta.color) < 0.3;
  const ink = dark ? "#f4efe4" : "#231f1a";
  const inkRgb = hexToRgb(ink);
  const ground = shadeHex(meta.color, dark ? 1.18 : 0.86);
  const stripe = shadeHex(meta.color, dark ? 1.06 : 0.96);
  const number = String(meta.n).padStart(2, "0");

  return {
    ...meta,
    placeholder: true,
    ...extras,

    render(stage, f) {
      const { p } = stage;
      const os = PX_PER_UNIT * ZOOM_IN * f.s; // layer pixels per world unit, at the closest zoom

      stage.origin();
      stage.rect(0, 0, f.w, f.h, meta.color);

      stage.withView(f.view, () => {
        p.noStroke();
        // faint columns every 100 units, so the scroll is easy to read
        p.fill(...stripe);
        for (let x = -400; x < SECTION_LEN + 400; x += 200) p.rect(x, 0, 100, 1000);
        // ground and road
        p.fill(...ground);
        p.rect(-400, ROAD_Y, SECTION_LEN + 800, 400);
        p.fill(...inkRgb, 170);
        p.rect(-400, ROAD_Y, SECTION_LEN + 800, 1.6);
        // one tick per beat at the standard pace; taller ticks on bar lines
        const beats = SECTION_BARS * BEATS_PER_BAR;
        for (let i = -4; i <= beats + 4; i += 1) {
          const x = (i * SECTION_LEN) / beats;
          const isBar = ((i % BEATS_PER_BAR) + BEATS_PER_BAR) % BEATS_PER_BAR === 0;
          p.fill(...inkRgb, isBar ? 220 : 120);
          p.rect(x - (isBar ? 1.1 : 0.6), ROAD_Y + 1.6, isBar ? 2.2 : 1.2, isBar ? 20 : 9);
        }
      });

      // title block, anchored to the middle of the section
      const title = sprite(stage, `ph/${meta.id}/title/${Math.round(os * 100)}`, TITLE_W * os, TITLE_H * os, (ctx) => {
        ctx.scale(os / (PX_PER_UNIT * ZOOM_IN), os / (PX_PER_UNIT * ZOOM_IN)); // author in 1080p pixels
        const w = TITLE_W * PX_PER_UNIT * ZOOM_IN;
        ctx.globalAlpha = 0.16;
        drawText(ctx, number, w / 2, 372, { font: font(FONTS.serif, 470, 700), align: "center", fill: ink });
        ctx.globalAlpha = 1;
        drawText(ctx, meta.zh, w / 2, 168, { font: font(FONTS.song, 96, 700), align: "center", fill: ink });
        drawText(ctx, meta.en, w / 2, 234, { font: font(FONTS.serif, 46, 400, "italic"), align: "center", fill: ink });
        drawText(ctx, `${meta.date}  ·  ${meta.dateEn}`, w / 2, 294, { font: font(FONTS.song, 40, 400), align: "center", fill: ink });
        if (extras.note) {
          ctx.globalAlpha = 0.75;
          drawText(ctx, extras.note, w / 2, 344, { font: font(FONTS.mono, 26, 400), align: "center", fill: ink });
        }
      });
      stage.withView(f.view, () => {
        stage.image(title, SECTION_LEN / 2 - TITLE_W / 2, 446, TITLE_W, TITLE_H);
      });

      // bar labels on the road
      const bars = sprite(stage, `ph/${meta.id}/bars/${Math.round(os * 100)}`, 60 * os, 14 * os * SECTION_BARS, (ctx) => {
        for (let b = 0; b < SECTION_BARS; b += 1) {
          drawText(ctx, `bar ${b + 1}`, 0, (b * 14 + 10) * os, { font: font(FONTS.mono, 8.4 * os, 400), fill: ink });
        }
      });
      stage.withView(f.view, () => {
        for (let b = 0; b < SECTION_BARS; b += 1) {
          const x = (b * SECTION_LEN) / SECTION_BARS;
          stage.imagePart(bars, x + 4, ROAD_Y + 10, 60, 14, 0, b * 14 * os, 60 * os, 14 * os);
        }
      });

      drawPlainPelican(stage, f, { shadowColor: dark ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.2)" });
    },
  };
}
