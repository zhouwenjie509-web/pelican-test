// Section 16 lab: count colours per tile. Scenery: 16 x 16 tiles on the world
// grid (transparent counts as one). Sprite: 8 x 8 tiles in each hardware layer.
//   node tools/shot.mjs --page "dev/lab.html?exp=pixel-tiles&w=320" --out out/shots/tiles.png
import { pixelDev } from "../../src/scenes/pixel.js";

function tilesAt(pix, size, row0) {
  const shifted = { c0: pix.c0, r0: pix.r0 - row0, w: pix.w, h: pix.h, get: (c, r) => pix.get(c, r + row0) };
  return tiles(shifted, size);
}

function tiles(pix, size) {
  const over = [];
  let worst = 0;
  const c0 = Math.floor(pix.c0 / size) * size;
  const r0 = Math.floor(pix.r0 / size) * size;
  for (let tr = r0; tr < pix.r0 + pix.h; tr += size) {
    for (let tc = c0; tc < pix.c0 + pix.w; tc += size) {
      const set = new Set();
      for (let r = tr; r < tr + size; r += 1) for (let c = tc; c < tc + size; c += 1) set.add(pix.get(c, r));
      worst = Math.max(worst, set.size);
      if (set.size > 4) over.push(`${tc},${tr}:${[...set].join("/")}`);
    }
  }
  return { worst, over: over.length, examples: over.slice(0, 12) };
}

export function draw() {
  const out = {};
  out.sky = tiles(pixelDev.buildSky(), 16);
  out.sea = tiles(pixelDev.buildSea(0), 16);
  out.pier = tiles(pixelDev.buildPier(), 16);
  // the sea plane's nametable is scrolled so that a tile row starts on the horizon (row -20)
  out.seaAligned = tilesAt(pixelDev.buildSea(0), 16, -20);
  out.midRock = tiles(pixelDev.buildMid(0, "rock"), 8);
  out.midTop0 = tiles(pixelDev.buildMid(0, "top"), 8);
  out.midTop1 = tiles(pixelDev.buildMid(1, "top"), 8);
  const used = new Set();
  for (const p of [pixelDev.buildSky(), pixelDev.buildSea(0), pixelDev.buildSea(1), pixelDev.buildPier(), pixelDev.buildMid(0, "top"), pixelDev.buildMid(1, "top"), pixelDev.buildMid(0, "rock")]) for (const v of p.d) used.add(v);
  for (let n = 0; n < 8; n += 1) {
    const { layers } = pixelDev.rasterPelican((n * Math.PI) / 4, { spoke: (n * Math.PI) / 8 });
    for (const [k, L] of Object.entries(layers)) {
      const t = tiles(L, 8);
      out[`spr${n}.${k}`] = t.worst;
      for (const v of L.d) used.add(v);
    }
  }
  out.paletteUsed = [...used].filter((v) => v).length;
  return out;
}
