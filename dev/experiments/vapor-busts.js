// Section 18 lab: every baked view of every bust, enlarged, on the evening sky.
//   node tools/shot.mjs --page "dev/lab.html?exp=vapor-busts" --out out/shots/vapor-busts.png
//   &scale=1   draws them at film scale (zoom 1.1) instead
//   &big=man   draws the five views of one bust as large as they fit
import { vaporDev } from "../../src/scenes/vapor.js";
import { View } from "../../src/kit/stage.js";

export function draw(stage, params) {
  const { BUSTS, BUST_BOX: bb, bakeBust, bakeColumn } = vaporDev;
  const { p } = stage;
  p.background(170, 50, 150);
  const big = params.get("big");
  if (big) {
    const k = (stage.W / 5 / (bb.x1 - bb.x0)) * 1.0;
    for (let v = 0; v < 5; v += 1) {
      const img = bakeBust(stage, big, v);
      const cx = (v + 0.5) * (stage.W / 5);
      const view = new View(k, cx, stage.H * 0.5 + 40 * k);
      stage.withView(view, () => stage.image(img, bb.x0, bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0));
    }
    return {};
  }
  const film = params.get("scale") === "1";
  const k = film ? 3.17 * stage.s : (stage.H / 3 / 100) * 0.98;
  const col = bakeColumn(stage);
  BUSTS.forEach((b, row) => {
    for (let v = 0; v < 5; v += 1) {
      const img = bakeBust(stage, b.id, v);
      const cx = (v + 0.5) * (stage.W / 5);
      const base = film ? stage.H * 0.62 + (row - 1) * 10 : (row + 1) * (stage.H / 3) - 6;
      const x = film ? ((row * 5 + v + 0.5) / 15) * stage.W : cx;
      const view = new View(k, x, base - (film ? 60 : 4) * k);
      stage.withView(view, () => {
        if (film) stage.image(col.fb, col.x0, 51 + col.y0, col.w, col.h);
        stage.image(img, bb.x0, bb.y0, bb.x1 - bb.x0, bb.y1 - bb.y0);
      });
    }
  });
  return {};
}
