// Intro (0:00 - 0:05): a book page. Two lines of serif text make an absurd
// claim with a straight face; in the lower right, "图一" shows a pencil sketch
// of a pelican on a bicycle. On the downbeat at 3 s the second line lands and
// the sketch rides off along the printer's rule towards the first frame.
//
// The page is the gallery wall itself: the same paper, drawn here as well so
// the pencil has a real ground to sit on.

import { smoothstep } from "../beat/ease.js";
import { textSprite, placeText, FONTS } from "../kit/text.js";
import { fillPaper } from "../kit/paper.js";
import { withPen } from "../kit/pen.js";
import { solveRig } from "../rig/rig.js";
import { drawSketch } from "../rig/skins/sketch.js";
import { PX_PER_UNIT, ZOOM_IN, ROAD_Y, FOCUS_Y, BAND_HALF, FRAME, ANCHOR_X, ANCHOR_Y } from "../main/layout.js";
import { CAM_REST, X_REST, T_DEPART } from "../main/camera.js";

const INK = "#2b2622";
const LINE_1 = "人类自古以来就痴迷于画鹈鹕骑自行车。";
const LINE_2 = "——早在自行车被发明之前。";
const CITATION = "——《鹈鹕骑行艺术通史》，卷一（虚构书名）";
const CAPTION = "图一　鹈鹕骑行图（摹本）";

// Page layout is designed in 1080p screen pixels for the resting camera,
// then pinned to the wall so it scrolls away when the camera leaves.
const wx = (sx) => CAM_REST + (sx - ANCHOR_X) / PX_PER_UNIT;
const wy = (sy) => FOCUS_Y + (sy - ANCHOR_Y) / PX_PER_UNIT;

const TEXT_CX = wx(760);
const LINE_1_Y = wy(214);
const LINE_2_Y = wy(318);
const CITE_RIGHT = wx(1172);
const CITE_Y = wy(378);
const BOX = { x0: X_REST - 76, x1: X_REST + 76, y0: wy(404), y1: ROAD_Y + 9 };
const CAPTION_Y = BOX.y1 + 15.5;

export const intro = {
  id: "intro",
  n: 0,
  zh: "片头",
  en: "Intro",

  render(stage, f) {
    const { p } = stage;
    const t = f.t;
    const os = PX_PER_UNIT * ZOOM_IN * f.s; // sprite pixels per world unit
    const upp = 1 / os;
    const size = (px1080) => (px1080 / PX_PER_UNIT) * os;
    const view = f.view;

    stage.origin();
    fillPaper(stage, view);

    // the rule the pelican rides on: it runs to the first frame
    stage.withView(view, () => {
      p.noStroke();
      p.fill(43, 38, 34, 215);
      p.rect(-1400, ROAD_Y, 1400 + BAND_HALF - FRAME.w, 0.9);
    });

    // lettering
    const line1 = textSprite(stage, `intro/l1/${os.toFixed(3)}`, LINE_1, { family: FONTS.song, size: size(64), weight: 700, fill: INK, spacing: size(2) });
    const line2 = textSprite(stage, `intro/l2/${os.toFixed(3)}`, LINE_2, { family: FONTS.song, size: size(64), weight: 700, fill: INK, spacing: size(2) });
    const cite = textSprite(stage, `intro/cite/${os.toFixed(3)}`, CITATION, { family: FONTS.song, size: size(30), weight: 400, fill: "#5a5148" });
    const caption = textSprite(stage, `intro/cap/${os.toFixed(3)}`, CAPTION, { family: FONTS.song, size: size(30), weight: 400, fill: INK });
    stage.withView(view, () => {
      placeText(stage, line1, TEXT_CX, LINE_1_Y, { align: "center", unitsPerPixel: upp, alpha: smoothstep(0.3, 0.85, t) });
      // the second line lands exactly on the downbeat
      placeText(stage, line2, TEXT_CX, LINE_2_Y, { align: "center", unitsPerPixel: upp, alpha: smoothstep(T_DEPART - 0.1, T_DEPART, t) });
      placeText(stage, cite, CITE_RIGHT, CITE_Y, { align: "right", unitsPerPixel: upp, alpha: smoothstep(1.3, 1.9, t) });
      placeText(stage, caption, (BOX.x0 + BOX.x1) / 2, CAPTION_Y, { align: "center", unitsPerPixel: upp });
    });

    // figure box and sketch: pencil, with fixed seeds so the drawing holds still
    withPen(stage, view, (pen) => {
      pen.reset();
      stage.seed(4101);
      pen.set("2B", "#3a342c", 1.0);
      pen.rect(BOX.x0, BOX.y0, BOX.x1 - BOX.x0, BOX.y1 - BOX.y0);
      stage.reseed(4102);
      pen.set("HB", "#4a433a", 0.8);
      pen.rect(BOX.x0 + 2.2, BOX.y0 + 2.2, BOX.x1 - BOX.x0 - 4.4, BOX.y1 - BOX.y0 - 4.4);

      if (f.pelican.visible) {
        const pel = f.pelican;
        const moving = t > T_DEPART;
        const skel = solveRig({ ...pel, act: { wind: Math.min(1, pel.speed), bob: Math.min(1, pel.speed * 1.5) } });
        // a still drawing while it waits; once it rides, the line is redrawn eight times a second
        drawSketch(pen, skel, { seed: 3, boil: moving ? Math.floor(t * 8) : 0, weight: 1.45 });
      }
    });
  },
};
