// Section 16 lab: rasterise Chinese characters small with system fonts and
// threshold them, so the bitmap glyphs in src/scenes/pixel.js can be chosen
// and tidied by hand. Usage:
//   node tools/shot.mjs --page "dev/lab.html?exp=pixel-glyphs&text=位像素游戏&px=12&font=PingFang SC&thr=0.45" --out out/shots/glyphs.png
export function draw(stage, params) {
  const text = params.get("text") || "位像素游戏";
  const px = Number(params.get("px") || 12);
  const family = params.get("font") || "PingFang SC";
  const weight = params.get("weight") || "400";
  const thr = Number(params.get("thr") || 0.45);
  const cell = Number(params.get("cell") || px);
  const layer = stage.layer("lab/glyphs", 64, 64);
  const ctx = layer.clear();
  const out = {};
  for (const ch of text) {
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = "#000";
    ctx.font = `${weight} ${px}px '${family}', sans-serif`;
    ctx.textBaseline = "alphabetic";
    const m = ctx.measureText(ch);
    const asc = m.actualBoundingBoxAscent;
    const desc = m.actualBoundingBoxDescent;
    const top = Math.round((cell - (asc + desc)) / 2 + asc);
    const left = Math.round((cell - m.width) / 2);
    ctx.fillText(ch, 4 + left, 4 + top);
    const img = ctx.getImageData(4, 4, cell, cell).data;
    const rows = [];
    for (let y = 0; y < cell; y += 1) {
      let r = "";
      for (let x = 0; x < cell; x += 1) r += img[(y * cell + x) * 4 + 3] / 255 > thr ? "#" : ".";
      rows.push(r);
    }
    out[ch] = rows;
  }
  return { family, px, out };
}
