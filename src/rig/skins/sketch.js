// The sketch skin: the pelican as a pencil drawing, made with p5.brush.
// Used for "图一" on the intro page. Draws through a pen (kit/pen.js), so the
// skeleton stays in world units.

import { hashString } from "../../kit/rng.js";

const GRAPHITE = "#3b352d";

/** Pencil weights by part, as multiples of the base weight. */
const WEIGHT = {
  tire: 1.5,
  rim: 0.6,
  spoke: 0.45,
  frame: 1.25,
  post: 0.9,
  bar: 0.9,
  grip: 1.5,
  chain: 0.6,
  ring: 0.8,
  crank: 1.0,
  leg: 1.2,
  foot: 1.0,
  body: 1.25,
  neck: 1.25,
  head: 1.2,
  bill: 1.1,
  pouch: 0.95,
  wing: 1.0,
  wingfold: 0.7,
  wingtip: 0.9,
  tail: 0.9,
  crest: 0.7,
  saddle: 1.0,
  pedal: 1.0,
  bell: 0.8,
  hub: 0.8,
  eye: 0.9,
};

/** Parts shaded with hatching: [spacing in wheel radii, angle in radians]. */
const HATCH = {
  wingtip: [0.045, -0.7],
  saddle: [0.05, 0.6],
  pedal: [0.04, 0.6],
  grip: [0.04, 0.6],
  bill: [0.085, -0.5],
  foot: [0.08, -0.5],
  wing: [0.13, 0.75],
};

const SKIP = new Set(["reflector", "pupil", "lid"]);

/**
 * options: { seed, boil, color, weight }
 *   boil    integer that changes when the drawing should "redraw itself"
 *           (pass a slowly stepping value while moving, a constant at rest)
 *   weight  base pencil weight at zoom 1
 */
export function drawSketch(pen, skel, options = {}) {
  const stage = pen.stage;
  const color = options.color || GRAPHITE;
  const base = options.weight || 1.0;
  const boil = options.boil || 0;
  const seed0 = (options.seed || 1) * 7919;
  const S = skel.scale;

  pen.reset();
  stage.seed(seed0);
  for (const sh of skel.shapes) {
    if (SKIP.has(sh.tag)) continue;
    const w = (WEIGHT[sh.tag] || 1) * base;
    // one seed per part: its grain stays put until the boil counter moves
    stage.reseed(seed0 + hashString(sh.id) + boil * 104729);
    const far = sh.side === "far";
    pen.set(far ? "HB" : "2B", color, far ? w * 0.8 : w);

    const hatch = HATCH[sh.tag];
    if (hatch && sh.kind === "poly") {
      pen.hatch(hatch[0] * S, hatch[1], { rand: 0.12, continuous: false, gradient: false });
      pen.hatchStyle("HB", color, base * 0.7);
    } else {
      pen.noHatch();
    }

    if (sh.kind === "circle") {
      pen.circle(sh.c[0], sh.c[1], sh.r, 0.25);
    } else if (sh.kind === "line") {
      if (sh.pts.length === 2) pen.line(sh.pts[0][0], sh.pts[0][1], sh.pts[1][0], sh.pts[1][1]);
      else pen.spline(sh.pts, 0.4);
    } else {
      pen.polygon(sh.pts);
    }
  }
  pen.noHatch();

  // the eye: a firm dot
  const pupil = skel.shapes.find((sh) => sh.id === "pupil");
  if (pupil) {
    stage.reseed(seed0 + 17);
    pen.set("2B", color, base * 1.6);
    pen.circle(pupil.c[0], pupil.c[1], pupil.r * 0.55, 0.1);
  }
}
