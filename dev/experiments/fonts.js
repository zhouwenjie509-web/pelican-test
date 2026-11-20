// Which of the fonts we would like to use are actually installed?
const CANDIDATES = [
  "Songti SC", "STSong", "Kaiti SC", "STKaiti", "STFangsong", "Weibei SC", "Libian SC", "Baoli SC", "Xingkai SC", "Yuanti SC",
  "Hanzipen SC", "Hannotate SC", "Wawati SC", "Lantinghei SC", "PingFang SC", "Heiti SC", "STHeiti", "Hiragino Sans GB", "Hiragino Mincho ProN",
  "Baskerville", "Didot", "Bodoni 72", "Hoefler Text", "Optima", "Futura", "Avenir Next", "Gill Sans", "Cochin", "Palatino", "Big Caslon", "Copperplate",
  "Menlo", "Monaco", "Courier New", "SF Mono", "Andale Mono", "Helvetica Neue", "Arial", "Impact", "Rockwell", "American Typewriter",
  "Papyrus", "Herculanum", "Trattatello", "Luminari", "Chalkduster", "Marker Felt", "Noteworthy", "Bradley Hand", "Zapfino", "Apple Chancery", "Skia",
  "Noto Sans Egyptian Hieroglyphs", "Noto Sans Javanese", "Noto Sans Mayan Numerals", "Kefa", "Devanagari MT", "Apple Symbols", "Apple Color Emoji",
];
export function draw(stage) {
  const layer = stage.layer("lab/fonts", stage.W, stage.H);
  const ctx = layer.clear();
  ctx.fillStyle = "#efe7d6";
  ctx.fillRect(0, 0, stage.W, stage.H);
  const sample = "鹈鹕骑行 Pelican 1300";
  const installed = [];
  const probe = (family) => {
    const widths = ["monospace", "serif", "sans-serif"].map((base) => {
      ctx.font = `40px '${family}', ${base}`;
      const a = ctx.measureText("mmmmmmmmlli鹈鹕骑行WQ@").width;
      ctx.font = `40px ${base}`;
      const b = ctx.measureText("mmmmmmmmlli鹈鹕骑行WQ@").width;
      return Math.abs(a - b) > 0.01;
    });
    return widths.some(Boolean);
  };
  let i = 0;
  for (const family of CANDIDATES) {
    const ok = probe(family);
    if (ok) installed.push(family);
    const col = Math.floor(i / 20);
    const row = i % 20;
    ctx.fillStyle = ok ? "#1d1916" : "#b0a595";
    ctx.font = `30px '${family}', serif`;
    ctx.fillText(sample, 30 + col * 640, 58 + row * 52);
    ctx.font = "15px Menlo, monospace";
    ctx.fillStyle = ok ? "#7a2e1c" : "#b0a595";
    ctx.fillText(`${ok ? "✓" : "✗"} ${family}`, 30 + col * 640 + 390, 58 + row * 52);
    i += 1;
  }
  layer.touch();
  stage.image(layer, 0, 0);
  return { installed };
}
