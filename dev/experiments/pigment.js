// Brush swatches on a rock-coloured ground: built-in brushes at three weights,
// flat washes, watercolour fills, and two custom tips. Reports timings.
import { drawText, font, FONTS } from "../../src/kit/text.js";

export function setup(stage) {
  const { brush } = stage;
  // a dry bristle brush: a row of uneven dots dragged along the stroke
  brush.add("lab-dry", {
    type: "custom",
    weight: 9,
    scatter: 0.3,
    opacity: 120,
    spacing: 0.35,
    pressure: [0.9, 1.15, 0.7],
    tip: (m) => {
      m.noStroke();
      m.fill(0);
      const dots = [-38, -27, -19, -8, 2, 13, 21, 31, 40];
      dots.forEach((x, i) => m.circle(x, (i % 3) * 4 - 4, 6 + (i % 4) * 2));
    },
    rotate: "natural",
    markerTip: false,
  });
  // a soft daub: big, low opacity, fuzzy
  brush.add("lab-daub", { type: "default", weight: 5, scatter: 1.4, sharpness: 0.25, grain: 5, opacity: 90, spacing: 0.25, pressure: [0.8, 1.2, 0.8], rotate: "natural" });
}

export function draw(stage) {
  const { p } = stage;
  const brush = stage.brush;
  const W = stage.W;
  p.background(196, 158, 118);
  stage.origin();
  const names = ["pen", "rotring", "2B", "HB", "2H", "cpencil", "pastel", "crayon", "charcoal", "spray", "marker", "lab-dry", "lab-daub"];
  const ochre = "#7a2a17";
  const t0 = performance.now();
  stage.seed(5);
  names.forEach((name, i) => {
    const y = 60 + i * 44;
    [1, 3, 7].forEach((w, j) => {
      brush.set(name, ochre, w);
      brush.spline([[260 + j * 300, y + 8], [330 + j * 300, y - 12, 1.3], [430 + j * 300, y + 12], [520 + j * 300, y - 4, 0.6]], 0.6);
    });
  });
  stage.flush();
  const strokesMs = performance.now() - t0;

  // flat washes vs watercolour fills of the same blob
  const blob = (cx, cy, r, n = 26) => Array.from({ length: n }, (_, k) => { const a = (k / n) * Math.PI * 2; const rr = r * (1 + 0.18 * Math.sin(a * 3) + 0.1 * Math.cos(a * 5)); return [cx + Math.cos(a) * rr * 1.5, cy + Math.sin(a) * rr]; });
  const t1 = performance.now();
  brush.noStroke();
  for (let i = 0; i < 12; i += 1) {
    brush.wash(["#7a2a17", "#b06a2c", "#e9dcc8", "#3a2218"][i % 4], 235);
    brush.polygon(blob(1240 + (i % 4) * 160, 90 + Math.floor(i / 4) * 110, 36));
  }
  brush.noWash();
  stage.flush();
  const washMs = performance.now() - t1;
  const t2 = performance.now();
  for (let i = 0; i < 12; i += 1) {
    brush.fill(["#7a2a17", "#b06a2c", "#e9dcc8", "#3a2218"][i % 4], 200);
    brush.fillBleed(0.12, "out");
    brush.fillTexture(0.55, 0.35);
    brush.polygon(blob(1240 + (i % 4) * 160, 430 + Math.floor(i / 4) * 110, 36));
  }
  brush.noFill();
  stage.flush();
  const fillMs = performance.now() - t2;

  // stroked + filled figure test: a cow-ish shape with a dry outline
  const t3 = performance.now();
  brush.fill("#8a3319", 215);
  brush.fillBleed(0.08, "out");
  brush.fillTexture(0.7, 0.2);
  brush.set("lab-dry", "#5a1f10", 0.8);
  brush.polygon(blob(400, 850, 70));
  brush.noFill();
  brush.set("lab-daub", "#e9dcc8", 3);
  brush.line(300, 760, 520, 770);
  brush.set("crayon", "#5a1f10", 4);
  brush.line(330, 930, 340, 1010);
  brush.line(470, 930, 462, 1010);
  stage.flush();
  const figMs = performance.now() - t3;

  const layer = stage.layer("lab/labels", W, stage.H);
  const ctx = layer.clear();
  names.forEach((name, i) => drawText(ctx, name, 30, 60 + i * 44 + 6, { font: font(FONTS.mono, 20), fill: "#2b1a10" }));
  drawText(ctx, "weight 1", 260, 30, { font: font(FONTS.mono, 18), fill: "#2b1a10" });
  drawText(ctx, "weight 3", 560, 30, { font: font(FONTS.mono, 18), fill: "#2b1a10" });
  drawText(ctx, "weight 7", 860, 30, { font: font(FONTS.mono, 18), fill: "#2b1a10" });
  drawText(ctx, `12 washes: ${washMs.toFixed(1)} ms`, 1180, 30, { font: font(FONTS.mono, 18), fill: "#2b1a10" });
  drawText(ctx, `12 watercolour fills: ${fillMs.toFixed(1)} ms`, 1180, 370, { font: font(FONTS.mono, 18), fill: "#2b1a10" });
  drawText(ctx, `39 strokes: ${strokesMs.toFixed(1)} ms   figure: ${figMs.toFixed(1)} ms`, 30, 700, { font: font(FONTS.mono, 18), fill: "#2b1a10" });
  layer.touch();
  stage.image(layer, 0, 0);
  return { strokesMs, washMs, fillMs, figMs };
}
