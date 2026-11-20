// Trying tip types for wide ink strokes: marker at several opacities, and
// custom bristle tips (dots spread across the stroke) for dry-brush work.
import { drawText, font, FONTS } from "../../src/kit/text.js";

export function setup(stage) {
  const b = stage.brush;
  const S = 2.6;
  [3, 8, 16, 30].forEach((op) => b.add(`t-marker-${op}`, { type: "marker", weight: 1.7 * S, scatter: 0.25 * S, opacity: op, spacing: 0.03 * S, pressure: [1.25, 1.0, 0.5], noise: 0.5 }));
  const bristles = (m, n, r, jitter) => {
    m.noStroke();
    m.fill(0);
    for (let i = 0; i < n; i += 1) {
      const y = -42 + (84 * i) / (n - 1) + Math.sin(i * 12.9898) * jitter;
      const x = Math.sin(i * 78.233) * 9;
      m.circle(x, y, r * (0.6 + 0.8 * Math.abs(Math.sin(i * 3.7))));
    }
  };
  b.add("t-dry-a", { type: "custom", weight: 6 * S, scatter: 0.06 * S, opacity: 120, spacing: 0.25 * S, pressure: [1.1, 1.0, 0.7], tip: (m) => bristles(m, 11, 7, 3), rotate: "natural", markerTip: false, noise: 0.5 });
  b.add("t-dry-b", { type: "custom", weight: 6 * S, scatter: 0.1 * S, opacity: 70, spacing: 0.12 * S, pressure: [1.1, 1.0, 0.7], tip: (m) => bristles(m, 17, 5, 2), rotate: "natural", markerTip: false, noise: 0.6 });
  b.add("t-dry-c", { type: "custom", weight: 6 * S, scatter: 0.3 * S, opacity: 200, spacing: 0.5 * S, pressure: [1.2, 0.9, 0.5], tip: (m) => bristles(m, 7, 9, 5), rotate: "natural", markerTip: false, noise: 0.7 });
}

export function draw(stage) {
  const { p } = stage;
  p.background(244, 238, 226);
  stage.origin();
  const names = ["t-marker-3", "t-marker-8", "t-marker-16", "t-marker-30", "t-dry-a", "t-dry-b", "t-dry-c"];
  stage.seed(4);
  stage.refSpace(() => {
    const b = stage.brush;
    names.forEach((name, i) => {
      const y = 90 + i * 140;
      [0.4, 1, 2.2, 4].forEach((w, j) => {
        b.set(name, "#1b1714", w);
        b.spline([[230 + j * 420, y], [330 + j * 420, y - 24, 1.3], [450 + j * 420, y + 24, 1.0], [580 + j * 420, y - 6, 0.5]], 0.6);
      });
    });
  });
  stage.flush();
  const layer = stage.layer("lab/tips", stage.W, stage.H);
  const ctx = layer.clear();
  ctx.scale(stage.s, stage.s);
  names.forEach((n, i) => drawText(ctx, n, 16, 96 + i * 140, { font: font(FONTS.mono, 20), fill: "#201810" }));
  ["weight 0.4", "1", "2.2", "4"].forEach((t, j) => drawText(ctx, t, 230 + j * 420, 30, { font: font(FONTS.mono, 20), fill: "#201810" }));
  layer.touch();
  stage.image(layer, 0, 0);
}
