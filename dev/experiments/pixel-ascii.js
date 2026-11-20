// Section 16 lab: print sprite frames as text (one character per art pixel).
//   node tools/shot.mjs --page "dev/lab.html?exp=pixel-ascii&k=ride&n=0" --out out/shots/ascii.png
import { pixelDev } from "../../src/scenes/pixel.js";

const GLYPH = " K.sScdefRGgabwOYNCnF";

export function draw(stage, params) {
  if (params.get("wing")) pixelDev.STYLE.wing = params.get("wing");
  const kind = params.get("k") || "ride";
  const n = Number(params.get("n") || 0);
  const pix = pixelDev.buildSprite(kind, n);
  const rows = [];
  for (let r = pix.r0; r < pix.r0 + pix.h; r += 1) {
    let s = "";
    for (let c = pix.c0; c < pix.c0 + pix.w; c += 1) s += GLYPH[pix.get(c, r)] || "?";
    rows.push(`${String(r).padStart(4)} ${s}`);
  }
  return { rows };
}
