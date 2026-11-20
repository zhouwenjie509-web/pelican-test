// Section 20 lab: is the code on screen true? Renders exactly the SOURCE text of the code pane,
// as a browser would draw it if it were saved as pelican.svg, on a plain white page.
//
//   node tools/shot.mjs --page "dev/lab.html?exp=code-svg" --out out/shots/code-svg.png
//
// Left: the file as an image at 12x (960 x 720 px), on white, so its own background shows.
// Right: the same at 4x beside the code, for reading the two together.
// window.result reports whether the text parses as XML, its line count and longest line.

import { SOURCE } from "../../src/scenes/code.js";

const text = SOURCE.join("\n");
const doc = new DOMParser().parseFromString(text, "image/svg+xml");
const parseError = doc.getElementsByTagName("parsererror").length > 0;
const img = new Image();
img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
let loaded = true;
try {
  await img.decode();
} catch (e) {
  loaded = false;
}

export function draw(stage) {
  const W = stage.W;
  const H = stage.H;
  const layer = stage.layer("lab/codesvg", W, H);
  const ctx = layer.clear();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  if (loaded) {
    ctx.drawImage(img, 40, 40, 960, 720);
    ctx.drawImage(img, 1080, 40, 320, 240);
  }
  ctx.fillStyle = "#222";
  ctx.font = "13px Menlo, monospace";
  SOURCE.forEach((l, i) => ctx.fillText(`${String(i + 1).padStart(2)} ${l}`, 1440, 52 + i * 16));
  ctx.font = "16px 'Helvetica Neue', sans-serif";
  ctx.fillText(`pelican.svg as an image (12x), on a white page. parses: ${!parseError}, loaded: ${loaded}`, 40, 800);
  layer.touch();
  stage.image(layer, 0, 0, W, H);
  return {
    parses: !parseError,
    loaded,
    lines: SOURCE.length,
    longest: Math.max(...SOURCE.map((l) => l.length)),
    chars: text.length,
  };
}
