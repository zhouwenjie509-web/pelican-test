// A close look at Section 9: the scene rendered through a magnified view.
//   dev/lab.html?exp=bada-zoom&u=3&z=3&cx=500&cy=640&px=500
// u: scene time; z: magnification over the film's 2.88 px/unit; (cx, cy): world centre;
// px: the pelican's road x (default: where the standard pace puts it at u).
import { View } from "../../src/kit/stage.js";
import { bada } from "../../src/scenes/bada.js";
import { WHEEL_R, SPEED } from "../../src/main/layout.js";

let inited = false;
export function draw(stage, params) {
  if (!inited) {
    bada.init(stage);
    inited = true;
  }
  const u = parseFloat(params.get("u") || "3");
  const z = parseFloat(params.get("z") || "3");
  const k = 2.88 * z * stage.s;
  const px = parseFloat(params.get("px") || String(SPEED * u));
  const cx = parseFloat(params.get("cx") || String(px));
  const cy = parseFloat(params.get("cy") || "640");
  const view = new View(k, stage.W / 2 - cx * k, stage.H / 2 - cy * k);
  const turns = u + 1; // pose from time, so px alone only translates the bird
  const pelican = { x: px, y: 700, slope: 0, crank: Math.PI / 2 + turns * Math.PI * 2, wheel: (SPEED * u) / WHEEL_R, time: 53 + u, speed: SPEED, scale: WHEEL_R, visible: true };
  const t0 = performance.now();
  bada.render(stage, { u, t: 53 + u, bar: u / 2, beat: u / 0.5, view, w: stage.W, h: stage.H, s: stage.s, pelican, still: false });
  return { ms: performance.now() - t0 };
}
