// Comparing line brushes for the Tang baimiao scene: the kit's "line" and darker variants.
import { drawText, font, FONTS } from "../../src/kit/text.js";

const VARIANTS = [
  ["kit-line", { type: "marker", weight: 0.6, scatter: 0.12, opacity: 22, spacing: 0.03, pressure: [0.75, 1.1, 0.55], noise: 0.35 }],
  ["m40-n15", { type: "marker", weight: 0.6, scatter: 0.04, opacity: 40, spacing: 0.03, pressure: [1, 1], noise: 0.15 }],
  ["m60-n05", { type: "marker", weight: 0.6, scatter: 0.03, opacity: 60, spacing: 0.03, pressure: [1, 1], noise: 0.05 }],
  ["d-200", { type: "default", weight: 0.6, scatter: 0.05, sharpness: 0.9, grain: 0.6, opacity: 200, spacing: 0.03, pressure: [1, 1], noise: 0.1 }],
  ["m90-n0", { type: "marker", weight: 0.6, scatter: 0.02, opacity: 90, spacing: 0.02, pressure: [1, 1], noise: 0.0 }],
];

export function setup(stage) {
  const b = stage.brush;
  const S = 2.6;
  for (const [name, q] of VARIANTS) b.add(`tl-${name}`, { ...q, weight: q.weight * S, scatter: q.scatter * S, spacing: q.spacing * S });
}

export function draw(stage) {
  const { p } = stage;
  p.background(255);
  stage.origin();
  stage.seed(4);
  stage.refSpace(() => {
    const b = stage.brush;
    VARIANTS.forEach(([name], i) => {
      const y = 120 + i * 190;
      [1.5, 3, 5, 7].forEach((w, j) => {
        b.set(`tl-${name}`, "#282726", w);
        const x0 = 260 + j * 410;
        const pr = (t) => Math.max(0.1, (0.42 + 0.9 * Math.sin(Math.PI * Math.min(1, t * 1.04)) ** 0.6) * (1 - 0.72 * t ** 3));
        const pts = [[x0, y - 60], [x0 + 60, y - 30], [x0 + 120, y + 30], [x0 + 200, y + 60], [x0 + 330, y + 20]].map((q, k) => [q[0], q[1], pr(k / 4)]);
        b.spline(pts, 0.5);
      });
    });
  });
  stage.flush();
  const layer = stage.layer("lab/tl", stage.W, stage.H);
  const ctx = layer.clear();
  ctx.scale(stage.s, stage.s);
  VARIANTS.forEach(([n], i) => drawText(ctx, n, 16, 126 + i * 190, { font: font(FONTS.mono, 20), fill: "#201810" }));
  layer.touch();
  stage.image(layer, 0, 0);
}
