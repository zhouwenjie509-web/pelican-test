// Ink brush sheet: every brush at four widths in three tones, dabs, washes,
// laid over silk (left) and xuan paper (right). The right-hand strip of each
// half is passed through the bleed filter.
import { View } from "../../src/kit/stage.js";
import { withPen } from "../../src/kit/pen.js";
import { INK, inkOn, inkGround, GROUNDS, blankSheet, layInk, bleedSheet } from "../../src/kit/ink.js";
import { drawText, font, FONTS } from "../../src/kit/text.js";

export function draw(stage) {
  const W = stage.W;
  const H = stage.H;
  const view = new View(stage.s, 0, 0); // world units = reference pixels here
  const sheet = stage.fb("lab/ink-sheet", W, H);
  stage.into(sheet, () => {
    blankSheet(stage);
    stage.seed(11);
    withPen(stage, view, (pen) => {
      const ink = inkOn(pen);
      const kinds = ["line", "bone", "dry", "dab", "wet"];
      const widths = [2, 6, 18, 50];
      const tones = [INK.jiao, INK.zhong, INK.dan];
      for (let half = 0; half < 2; half += 1) {
        const ox = half * 960;
        kinds.forEach((kind, i) => {
          widths.forEach((wd, j) => {
            const y = 70 + i * 120 + j * 26 + (j > 2 ? 14 : 0);
            const tone = tones[j % 3];
            ink.stroke(kind, tone, wd, [[ox + 130, y], [ox + 230, y - 10, 1.3], [ox + 330, y + 10], [ox + 430, y, 0.6]], 0.6);
          });
        });
        // a field of raindrop dabs, denser to the left
        for (let n = 0; n < 420; n += 1) {
          const u = Math.random;
          const x = ox + 470 + (n % 21) * 11 + ((n * 37) % 7);
          const y = 60 + Math.floor(n / 21) * 12 + ((n * 53) % 9);
          const dens = 1 - (n % 21) / 21;
          if (((n * 97) % 100) / 100 > dens + 0.15) continue;
          ink.dab("dab", n % 3 === 0 ? INK.nong : INK.zhong, 5 + (n % 4), x, y, 1.45 + ((n % 5) - 2) * 0.08, 9 + (n % 6));
        }
        // washes
        const blobPts = (cx, cy, r) => Array.from({ length: 22 }, (_, k) => { const a = (k / 22) * Math.PI * 2; const rr = r * (1 + 0.2 * Math.sin(a * 3)); return [cx + Math.cos(a) * rr * 1.4, cy + Math.sin(a) * rr]; });
        ink.wash(blobPts(ox + 560, 420, 60), INK.dan, 120);
        ink.wash(blobPts(ox + 560, 560, 60), INK.zhong, 150, { bleed: 0.3, texture: 0.6 });
        ink.wash(blobPts(ox + 560, 700, 60), INK.nong, 190, { bleed: 0.05, border: 0.5 });
        // a tree-ish test: trunk in bone, twigs in line, leaves in dabs
        ink.stroke("bone", INK.nong, 16, [[ox + 800, 900], [ox + 790, 760, 1.2], [ox + 815, 640, 0.9], [ox + 800, 540, 0.5]], 0.5);
        ink.stroke("bone", INK.nong, 8, [[ox + 808, 700], [ox + 860, 640, 1], [ox + 900, 610, 0.5]], 0.5);
        ink.stroke("line", INK.nong, 3, [[ox + 800, 640], [ox + 750, 590, 1], [ox + 720, 580, 0.5]], 0.5);
        for (let n = 0; n < 160; n += 1) {
          const a = (n * 2.39996) % 6.2832;
          const r = 14 + ((n * 13) % 70);
          ink.dab("dab", n % 4 ? INK.nong : INK.jiao, 6, ox + 800 + Math.cos(a) * r * 1.3, 520 + Math.sin(a) * r * 0.7, 1.1 + (n % 3) * 0.3, 8);
        }
      }
    });
  });
  // bled copy
  const bled = stage.fb("lab/ink-bled", W, H);
  stage.into(bled, () => bleedSheet(stage, sheet, { x0: 0, y0: 0, x1: 1920, y1: 1080 }, { reach: 7 * stage.s, amount: 0.9 }));

  stage.origin();
  const silkView = view;
  inkGround(stage, silkView, GROUNDS.silk);
  // right half: xuan
  const half = stage.fb("lab/ink-xuan", W, H);
  stage.into(half, () => inkGround(stage, view, GROUNDS.xuan));
  stage.origin();
  stage.imagePart(half, W / 2, 0, W / 2, H, W / 2, 0, W / 2, H);
  // ink: left 3/4 of each half plain, right quarter bled
  for (let h = 0; h < 2; h += 1) {
    const x0 = (h * W) / 2;
    stage.blend(stage.p.MULTIPLY, () => {
      stage.imagePart(sheet, x0, 0, W * 0.36, H, x0, 0, W * 0.36, H);
      stage.imagePart(bled, x0 + W * 0.36, 0, W * 0.14, H, x0 + W * 0.36, 0, W * 0.14, H);
    });
  }
  const layer = stage.layer("lab/ink-labels", W, H);
  const ctx = layer.clear();
  ctx.scale(stage.s, stage.s);
  ["line", "bone", "dry", "dab", "wet"].forEach((k, i) => drawText(ctx, k, 20, 110 + i * 120, { font: font(FONTS.mono, 22), fill: "#201810" }));
  drawText(ctx, "silk", 20, 1040, { font: font(FONTS.mono, 22), fill: "#201810" });
  drawText(ctx, "xuan", 980, 1040, { font: font(FONTS.mono, 22), fill: "#201810" });
  drawText(ctx, "bled →", 690, 1040, { font: font(FONTS.mono, 22), fill: "#201810" });
  layer.touch();
  stage.image(layer, 0, 0);
}
