// Section 20 type probe: are the faces installed, and how big is their ink?
// node tools/shot.mjs --page "dev/lab.html?exp=code-type" --out out/shots/code-type.png
const K = 2.88 * 1.1; // px per unit at zoom 1.1, 1080p
const SANS = "'Helvetica Neue', 'PingFang SC', sans-serif";
const HEI = "'PingFang SC', 'Helvetica Neue', sans-serif";
const MONO = "Menlo, Monaco, monospace";

export function draw(stage) {
  const layer = stage.layer("lab/codetype", stage.W, stage.H);
  const ctx = layer.clear();
  ctx.fillStyle = "#0f1218";
  ctx.fillRect(0, 0, stage.W, stage.H);
  const out = {};
  const ink = (label, text, css) => {
    ctx.font = css;
    const m = ctx.measureText(text);
    out[label] = { w: +m.width.toFixed(2), asc: +m.actualBoundingBoxAscent.toFixed(2), desc: +m.actualBoundingBoxDescent.toFixed(2), units: +(m.width / K).toFixed(2) };
  };
  const probe = (family) => {
    ctx.font = `40px '${family}', monospace`;
    const a = ctx.measureText("mmlli鹈鹕WQ@").width;
    ctx.font = "40px monospace";
    return Math.abs(a - ctx.measureText("mmlli鹈鹕WQ@").width) > 0.01;
  };
  out.installed = ["Menlo", "Helvetica Neue", "PingFang SC", "SF Mono", "Avenir Next"].filter(probe);
  ink("zh16", "代码美学", `500 ${16 * K}px ${HEI}`);
  ink("zh17", "代码美学", `500 ${17 * K}px ${HEI}`);
  ink("en13caps", "CA", `400 ${13 * K}px ${SANS}`);
  ink("en13", "Code Aesthetics", `400 ${13 * K}px ${SANS}`);
  ink("date13", "21 世纪 20 年代 · 大模型时代 · 2020s, the LLM era", `400 ${13 * K}px ${SANS}`);
  ink("date13digits", "2120", `400 ${13 * K}px ${SANS}`);
  ink("date13zh", "世纪年代大模型时", `400 ${13 * K}px ${SANS}`);
  ink("mono", "M".repeat(35), `400 ${8.4 * K}px ${MONO}`);
  ink("monoInk", "<!-- a pelican riding a bicycle -->", `400 ${8.4 * K}px ${MONO}`);
  ink("monoGlyph", "Mgjy|", `400 ${8.4 * K}px ${MONO}`);
  ink("check", "✓", `400 ${10 * K}px ${SANS}`);
  ctx.fillStyle = "#c9d1dc";
  ctx.font = `500 ${16 * K}px ${HEI}`;
  ctx.fillText("代码美学", 60, 120);
  ctx.font = `400 ${13 * K}px ${SANS}`;
  ctx.fillText("Code Aesthetics", 300, 120);
  ctx.fillText("21 世纪 20 年代 · 大模型时代 · 2020s, the LLM era ✓", 60, 220);
  ctx.font = `400 ${8.4 * K}px ${MONO}`;
  ctx.fillText('<path d="M90 13l32 10-32-3z"/>', 60, 320);
  layer.touch();
  stage.image(layer, 0, 0);
  return out;
}
