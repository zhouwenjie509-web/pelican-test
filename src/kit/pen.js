// A pen: p5.brush addressed in world coordinates.
//
// p5.brush spaces its stamps in canvas units, so a stroke drawn under a
// scaled transform is simply a magnified stroke (bigger grain, wider gaps).
// To keep brush marks looking the same at every zoom level and render size,
// all brush work is drawn in "reference pixels" (the 1920 x 1080 frame) and
// the pen converts world coordinates and sizes on the way in:
//
//   withPen(stage, f.view, (pen) => {
//     pen.set("2B", "#333", 1.2);          // weight 1.2 at zoom 1, thicker when zoomed in
//     pen.spline([[x0, y0], [x1, y1, 1.4], [x2, y2]], 0.5);
//   });
//
// Positions and lengths are world units; weights are p5.brush weight
// multipliers at zoom 1 (2.88 reference pixels per world unit).

const BASE_K = 2.88;

/**
 * p5.brush's built-in brushes are sized for small canvases. Scaling them by
 * this factor makes a weight-1 pencil about 2.6 reference pixels wide.
 */
export const BRUSH_SCALE = 2.6;

const defined = new Set();

/**
 * Register a custom brush once. Write weight, scatter and spacing on the same
 * scale as the built-in brushes (see node_modules/p5.brush/src/stroke/stroke.js);
 * they are scaled to match. Prefix names with the scene id: "rock-finger".
 */
export function defineBrush(stage, name, params) {
  if (defined.has(name)) return;
  defined.add(name);
  const scaled = { ...params };
  for (const key of ["weight", "scatter", "spacing"]) {
    if (typeof scaled[key] === "number") scaled[key] *= BRUSH_SCALE;
  }
  stage.brush.add(name, scaled);
}

export class Pen {
  constructor(stage, view, { baseK = BASE_K } = {}) {
    this.stage = stage;
    this.b = stage.brush;
    const s = stage.s;
    this.k = view.k / s; // reference pixels per world unit
    this.tx = view.tx / s;
    this.ty = view.ty / s;
    /** Magnification relative to the film's normal view. */
    this.zoom = this.k / baseK;
  }

  x(wx) {
    return wx * this.k + this.tx;
  }

  y(wy) {
    return wy * this.k + this.ty;
  }

  /** Map [[x, y], ...] or [[x, y, pressure], ...] to reference pixels. */
  pts(points) {
    const out = new Array(points.length);
    for (let i = 0; i < points.length; i += 1) {
      const q = points[i];
      out[i] = q.length > 2 ? [q[0] * this.k + this.tx, q[1] * this.k + this.ty, q[2]] : [q[0] * this.k + this.tx, q[1] * this.k + this.ty];
    }
    return out;
  }

  // ---- stroke state
  set(name, color, weight = 1) {
    this.b.set(name, color, weight * this.zoom);
    return this;
  }

  /** Like set(), but the weight is in reference pixels regardless of zoom. */
  setPx(name, color, weight = 1) {
    this.b.set(name, color, weight);
    return this;
  }

  noStroke() {
    this.b.noStroke();
    return this;
  }

  // ---- fills
  wash(color, alpha = 255) {
    this.b.wash(color, alpha);
    return this;
  }

  noWash() {
    this.b.noWash();
    return this;
  }

  /** Watercolour fill. opts: { bleed, direction, texture, border } */
  fill(color, alpha = 150, opts = {}) {
    this.b.fill(color, alpha);
    this.b.fillBleed(opts.bleed ?? 0.1, opts.direction || "out");
    this.b.fillTexture(opts.texture ?? 0.5, opts.border ?? 0.3, opts.scatter ?? true);
    return this;
  }

  noFill() {
    this.b.noFill();
    return this;
  }

  hatch(dist, angle, opts) {
    this.b.hatch(dist * this.k, angle, opts);
    return this;
  }

  hatchStyle(name, color, weight = 1) {
    this.b.hatchStyle(name, color, weight * this.zoom);
    return this;
  }

  noHatch() {
    this.b.noHatch();
    return this;
  }

  /** Everything off: no stroke, fill, wash or hatch. */
  reset() {
    this.b.noStroke();
    this.b.noFill();
    this.b.noWash();
    this.b.noHatch();
    return this;
  }

  // ---- geometry
  line(x1, y1, x2, y2) {
    this.b.line(this.x(x1), this.y(y1), this.x(x2), this.y(y2));
  }

  /** Smooth stroke through points; each point may carry a pressure as third value. */
  spline(points, curvature = 0.5) {
    return this.b.spline(this.pts(points), curvature);
  }

  polygon(points) {
    return this.b.polygon(this.pts(points));
  }

  circle(cx, cy, r, irregular) {
    return this.b.circle(this.x(cx), this.y(cy), r * this.k, irregular);
  }

  rect(x, y, w, h) {
    return this.b.rect(this.x(x), this.y(y), w * this.k, h * this.k);
  }

  /** Composite what has been drawn so far (use between layers that must stack in order). */
  flush() {
    this.stage.flush();
    this.b = this.stage.brush;
  }
}

/**
 * Run fn(pen) with p5.brush set up for world-coordinate drawing through `view`
 * on the current target. Pending strokes are composited when fn returns.
 */
export function withPen(stage, view, fn) {
  stage.origin();
  stage.refSpace(() => {
    fn(new Pen(stage, view));
  });
  stage.flush();
  stage.origin();
}
