// Times each part of the Qingming painting program on a full-size sheet.
import { __lab } from "../../src/scenes/qingming.js";

export function draw(stage, params) {
  const { Plate, R, PX, View, blankSheet, withPen, parts } = __lab;
  const k = PX * stage.s * Number(params.get("scale") || 1);
  const w = Math.round((R.x1 - R.x0) * k);
  const h = Math.round((R.y1 - R.y0) * k);
  const fb = stage.fb("lab/qm", w, h);
  const out = {};
  const names = (params.get("parts") || Object.keys(parts).join(",")).split(",");
  for (const name of names) {
    const P = new Plate();
    parts[name](P);
    const nStrokes = P.layers.reduce((a, L) => a + L.strokes.length, 0);
    const nWash = P.layers.reduce((a, L) => a + L.wash.length + L.knock.length, 0);
    const t0 = performance.now();
    stage.into(fb, () => {
      const view = new View(k, -R.x0 * k, -R.y0 * k);
      blankSheet(stage);
      stage.seed(1);
      withPen(stage, view, (pen) => P.paint(stage, pen));
    });
    stage.p.drawingContext.finish();
    out[name] = { ms: Math.round(performance.now() - t0), layers: P.layers.length, strokes: nStrokes, fills: nWash };
  }
  stage.origin();
  stage.image(fb, 0, 0, stage.cur.w, stage.cur.h);
  return out;
}
