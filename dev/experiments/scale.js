// Does a brush look the same drawn in pixel space with weight W as it does
// under a scale-k transform with weight W / k?  (left: pixels, right: scaled)
import { drawText, font, FONTS } from "../../src/kit/text.js";
export function draw(stage) {
  const { p } = stage;
  const brush = stage.brush;
  p.background(236, 228, 210);
  stage.origin();
  const names = ["2B", "HB", "pen", "crayon", "charcoal", "pastel", "marker"];
  const K = [1, 2.88, 3.17, 0.5];
  stage.seed(3);
  names.forEach((name, i) => {
    const y = 80 + i * 130;
    K.forEach((k, j) => {
      [1.45, 3].forEach((w, m) => {
        const x0 = 200 + j * 430;
        const yy = y + m * 50;
        p.push();
        p.scale(k);
        brush.set(name, "#3b352d", w / k);
        brush.line(x0 / k, yy / k, (x0 + 360) / k, (yy + 10) / k);
        p.pop();
      });
    });
  });
  stage.flush();
  const layer = stage.layer("lab/scale", stage.W, stage.H);
  const ctx = layer.clear();
  names.forEach((name, i) => drawText(ctx, name, 30, 100 + i * 130, { font: font(FONTS.mono, 20), fill: "#222" }));
  K.forEach((k, j) => drawText(ctx, `scale ${k}`, 200 + j * 430, 40, { font: font(FONTS.mono, 20), fill: "#222" }));
  layer.touch();
  stage.image(layer, 0, 0);
}
