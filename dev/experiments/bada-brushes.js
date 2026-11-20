// Calibrating the ink brushes for Section 9: each kind at several widths,
// on a white sheet that is bled and multiplied onto xuan.
import { View } from "../../src/kit/stage.js";
import { withPen } from "../../src/kit/pen.js";
import { INK, GROUNDS, inkGround, inkBrush, blankSheet, layInk, bleedSheet } from "../../src/kit/ink.js";
import { drawText, font, FONTS } from "../../src/kit/text.js";

const KINDS = [
  ["wet", INK.nong],
  ["wet", INK.zhong],
  ["bone", INK.nong],
  ["dry", INK.nong],
  ["drysoft", INK.nong],
  ["dab", INK.jiao],
  ["leaf", INK.nong],
];
const WIDTHS = [1.2, 3, 6, 12, 20];

export function draw(stage) {
  const k = 3.17;
  const W = stage.W;
  const H = stage.H;
  const view = new View(k, 0, 0);
  inkGround(stage, view, GROUNDS.xuan);
  const raw = stage.fb("lab/raw", W, H);
  const bled = stage.fb("lab/bled", W, H);
  stage.into(raw, () => {
    blankSheet(stage);
    stage.seed(3);
    withPen(stage, view, (pen) => {
      KINDS.forEach(([kind, col], r) => {
        WIDTHS.forEach((w, c) => {
          stage.reseed(r * 10 + c);
          inkBrush(pen, kind, col, w);
          const x = 40 + c * 115;
          const y = 30 + r * 46;
          pen.spline([[x, y, 1.3], [x + 30, y - 10, 1.0], [x + 60, y + 8, 0.9], [x + 90, y, 0.4]], 0.5);
        });
      });
      // washes at several bleed / texture / border settings, one and two layers
      const blobAt = (cx, cy, r, seed) => {
        const pts = [];
        for (let i = 0; i < 14; i += 1) {
          const a = (i / 14) * Math.PI * 2;
          const rr = r * (0.8 + 0.4 * Math.abs(Math.sin(i * 2.3 + seed)));
          pts.push([cx + Math.cos(a) * rr * 1.3, cy + Math.sin(a) * rr * 0.8]);
        }
        return pts;
      };
      [[0.1, 0.4, 0.4], [0.3, 0.6, 0.6], [0.5, 0.8, 0.8], [0.35, 0.9, 0.3]].forEach(([bl, tx, bo], c) => {
        stage.reseed(200 + c);
        pen.noStroke().fill(INK.zhong, 170, { bleed: bl, texture: tx, border: bo });
        pen.polygon(blobAt(70 + c * 115, 345, 22, c));
        pen.fill(INK.nong, 150, { bleed: bl, texture: tx, border: bo });
        pen.polygon(blobAt(60 + c * 115, 340, 12, c + 3));
      });
      pen.noFill();
    });
  });
  stage.into(bled, () => {
    bleedSheet(stage, raw, { x0: 0, y0: 0, x1: W / k, y1: H / k }, { reach: 7, amount: 0.85 });
  });
  stage.origin();
  layInk(stage, bled, 0, 0, W, H);
  const layer = stage.layer("lab/labels", W, H);
  const ctx = layer.clear();
  KINDS.forEach(([kind, col], r) => drawText(ctx, `${kind} ${col}`, 4, (30 + r * 46) * k - 40, { font: font(FONTS.mono, 18), fill: "#a02020" }));
  WIDTHS.forEach((w, c) => drawText(ctx, `w ${w}`, (40 + c * 115) * k, 20, { font: font(FONTS.mono, 18), fill: "#a02020" }));
  layer.touch();
  stage.image(layer, 0, 0);
}
