// Section 17 lab: ink boxes and advance widths of GB18030 Bitmap glyphs.
//   node tools/shot.mjs --page "dev/lab.html?exp=chat-metrics&px=12&text=╰☆╮" --out out/shots/chat-metrics.png
export function draw(stage, params) {
  const px = Number(params.get("px") || 12);
  const fam = params.get("font") || "GB18030 Bitmap";
  const text = params.get("text") || "╰☆骑╮？…。E0";
  const L = stage.layer("lab/cm", 64, 64);
  const ctx = L.clear();
  const out = [];
  for (const ch of text) {
    ctx.clearRect(0, 0, 64, 64);
    ctx.font = `${px}px '${fam}', monospace`;
    ctx.textBaseline = "top";
    ctx.fillStyle = "#000";
    ctx.fillText(ch, 8, 8);
    const w = ctx.measureText(ch).width;
    const d = ctx.getImageData(0, 0, 64, 64).data;
    let x0 = 99, y0 = 99, x1 = -1, y1 = -1, partial = 0;
    for (let y = 0; y < 64; y += 1) for (let x = 0; x < 64; x += 1) {
      const a = d[(y * 64 + x) * 4 + 3];
      if (a > 0 && a < 255) partial += 1;
      if (a > 127) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    }
    out.push(`${ch} adv=${w} ink x${x0 - 8}..${x1 - 8} y${y0 - 8}..${y1 - 8} partial=${partial}`);
  }
  return { fam, px, out };
}
