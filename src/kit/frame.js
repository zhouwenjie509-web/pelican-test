// Picture frames: a gilded moulding around a rectangular picture area, with a
// soft shadow on the wall and a thin shadow line on the picture itself.
// All coordinates are world units; call inside stage.withView(view, ...).

/** Profile of the moulding from its outer edge (0) to the picture (1). */
const GILT = [
  [0.0, 0.1, [74, 52, 24]], // dark outer edge
  [0.1, 0.26, [226, 188, 104]], // outer bead, catching light
  [0.26, 0.6, [188, 146, 62]], // broad face
  [0.6, 0.68, [104, 74, 30]], // groove
  [0.68, 0.86, [214, 174, 88]], // inner cove
  [0.86, 1.0, [128, 94, 40]], // lip next to the picture
];

/** Light comes from the upper left: top and left members are brighter. */
const SIDE_LIGHT = { top: 1.08, left: 1.0, right: 0.86, bottom: 0.78 };

function shade(rgb, f) {
  return [Math.min(255, rgb[0] * f), Math.min(255, rgb[1] * f), Math.min(255, rgb[2] * f)];
}

/**
 * Draw the moulding around picture rectangle r = { x0, y0, x1, y1 }.
 * w is the moulding width. profile defaults to gilt.
 */
export function drawMoulding(stage, r, w, { profile = GILT, light = SIDE_LIGHT } = {}) {
  const { p } = stage;
  p.noStroke();
  for (const [a, b, rgb] of profile) {
    const o = w * (1 - a); // outer offset of this band
    const i = w * (1 - b); // inner offset
    // top
    p.fill(...shade(rgb, light.top));
    p.quad(r.x0 - o, r.y0 - o, r.x1 + o, r.y0 - o, r.x1 + i, r.y0 - i, r.x0 - i, r.y0 - i);
    // bottom
    p.fill(...shade(rgb, light.bottom));
    p.quad(r.x0 - i, r.y1 + i, r.x1 + i, r.y1 + i, r.x1 + o, r.y1 + o, r.x0 - o, r.y1 + o);
    // left
    p.fill(...shade(rgb, light.left));
    p.quad(r.x0 - o, r.y0 - o, r.x0 - i, r.y0 - i, r.x0 - i, r.y1 + i, r.x0 - o, r.y1 + o);
    // right
    p.fill(...shade(rgb, light.right));
    p.quad(r.x1 + i, r.y0 - i, r.x1 + o, r.y0 - o, r.x1 + o, r.y1 + o, r.x1 + i, r.y1 + i);
  }
}

/**
 * Soft shadow the frame casts on the wall. Light comes from the upper left, so
 * the shadow lies along the right and bottom of the frame. It is drawn only
 * outside the moulding, which lets it go on top of whatever is already there.
 */
export function drawWallShadow(stage, r, w, { reach = 8, strength = 0.26 } = {}) {
  const { p } = stage;
  p.noStroke();
  const steps = 6;
  const x0 = r.x0 - w;
  const y0 = r.y0 - w;
  const x1 = r.x1 + w;
  const y1 = r.y1 + w;
  for (let s = 1; s <= steps; s += 1) {
    const d = (reach * s) / steps;
    p.fill(38, 26, 10, (255 * strength) / steps);
    p.rect(x1, y0 + d * 0.7, d, y1 - y0); // right of the frame
    p.rect(x0 + d * 0.7, y1, x1 - x0 - d * 0.7, d); // below it
    p.rect(x0 - d * 0.18, y0, d * 0.18, y1 - y0); // a breath of occlusion on the lit side
  }
}

/** Shadow line the moulding casts onto the picture, along its top and left edges. */
export function drawInnerShadow(stage, r, { depth = 4, strength = 0.28 } = {}) {
  const { p } = stage;
  p.noStroke();
  const steps = 4;
  for (let s = 1; s <= steps; s += 1) {
    const d = (depth * s) / steps;
    p.fill(20, 14, 6, (255 * strength) / steps);
    p.rect(r.x0, r.y0, r.x1 - r.x0, d);
    p.rect(r.x0, r.y0, d * 0.8, r.y1 - r.y0);
  }
}

/** A complete frame: wall shadow, moulding, inner shadow. */
export function drawFrame(stage, r, w, opts = {}) {
  if (opts.wallShadow !== false) drawWallShadow(stage, r, w);
  drawMoulding(stage, r, w, opts);
  if (opts.innerShadow !== false) drawInnerShadow(stage, r, opts);
}
