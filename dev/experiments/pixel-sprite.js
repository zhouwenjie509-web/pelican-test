// Section 16 lab: the pelican sprite's frames, enlarged, rendered through the
// scene itself (so it is exactly what the film shows).
//   node tools/shot.mjs --page "dev/lab.html?exp=pixel-sprite" --out out/shots/pixel-sprite.png
import { pixel, jumpRows, pixelDev } from "../../src/scenes/pixel.js";
import { View } from "../../src/kit/stage.js";

export function draw(stage, params) {
  if (params.get("wing")) pixelDev.STYLE.wing = params.get("wing");
  if (!pixel._init) {
    pixel.init(stage);
    pixel._init = true;
  }
  const cols = 5;
  const tw = Math.floor(stage.W / cols);
  const th = Math.floor(stage.H / 2);
  // u values: frames of the pedal cycle (u = n / 8 gives crank n * 45 deg), the jump, the landing
  const shots = String(params.get("u") || "0.5,0.625,0.75,0.875,1.0,1.125,1.25,1.375,3.0,3.5").split(",").map(Number);
  const span = Number(params.get("span") || 60);
  shots.forEach((u, i) => {
    const fb = stage.fb(`lab/spr${i}`, tw, th);
    const x = (1000 / 6) * u;
    const crank = Math.PI / 2 + 2 * Math.PI * (Math.floor(u * 8 + 1e-9) / 8);
    const view = View.fit(x - span / 2, 700 - jumpRows(u) * 3 - span * (th / tw) * 0.92, span, tw);
    stage.into(fb, () => {
      pixel.render(stage, {
        u, t: 95 + u, bar: u / 2, beat: u / 0.5, view, w: tw, h: th, s: stage.s, still: false,
        pelican: { x, y: 700, slope: 0, crank, wheel: crank * 1.25, time: u, speed: 166.67, scale: 21.22, visible: true },
      });
    });
    stage.origin();
    stage.image(fb, (i % cols) * tw, Math.floor(i / cols) * th, tw, th);
  });
  return { shots };
}
