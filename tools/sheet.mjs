#!/usr/bin/env node
// Contact sheets: render chosen moments at full size, then lay them out as a
// labelled grid of thumbnails for frame-by-frame inspection.
//
//   node tools/sheet.mjs --name film                 three frames per section, plus intro and outro
//   node tools/sheet.mjs --name s05 --section 5      one section beat by beat, with both crossings
//   node tools/sheet.mjs --name x --times 4.6,5,5.4  explicit times
//   node tools/sheet.mjs --name pan --range 10:12:0.1
//
// Options: --cols (default 4), --thumb (thumbnail width, default 480), --width (render width, default 1920), --query

import fs from "node:fs";
import path from "node:path";
import { startServer, PROJECT_ROOT } from "./lib/server.mjs";
import { launchBrowser, openPage } from "./lib/browser.mjs";
import { parseArgs, openFilm, grabFrame } from "./lib/film.mjs";

const args = parseArgs(process.argv.slice(2));
const name = String(args.name || "sheet");
const cols = Number(args.cols || 4);
const thumb = Number(args.thumb || 480);
const width = Number(args.width || 1920);
const height = Math.round((width * 9) / 16);

// timeline constants, kept in step with src/beat/timeline.js
const T_INTRO = 5;
const T_SECTION = 6;
const N = 20;
const T_OUTRO_START = T_INTRO + N * T_SECTION;
const sectionStart = (n) => T_INTRO + (n - 1) * T_SECTION;

function label(t) {
  if (t < T_INTRO) return `intro  ${t.toFixed(2)}s`;
  if (t >= T_OUTRO_START) return `outro +${(t - T_OUTRO_START).toFixed(2)}  ${t.toFixed(2)}s`;
  const n = Math.min(N, 1 + Math.floor((t - T_INTRO) / T_SECTION));
  const u = t - sectionStart(n);
  return `S${String(n).padStart(2, "0")}  bar ${Math.floor(u / 2) + 1} beat ${Math.floor((u % 2) / 0.5) + 1}  ${t.toFixed(2)}s`;
}

let times = [];
if (args.times) {
  times = String(args.times).split(",").map(Number);
} else if (args.range) {
  const [a, b, step] = String(args.range).split(":").map(Number);
  for (let t = a; t <= b + 1e-9; t += step) times.push(Number(t.toFixed(4)));
} else if (args.section) {
  const n = Number(args.section);
  const t0 = sectionStart(n);
  times.push(t0 - 0.5, t0 - 0.1);
  for (let u = 0; u < T_SECTION; u += 0.5) times.push(t0 + u);
  times.push(t0 + T_SECTION - 0.1, t0 + T_SECTION + 0.1);
} else {
  times.push(0.2, 1.5, 3.05, 4.3, 5.0);
  for (let n = 1; n <= N; n += 1) times.push(sectionStart(n) + 1, sectionStart(n) + 3, sectionStart(n) + 5);
  times.push(T_OUTRO_START, T_OUTRO_START + 0.6, T_OUTRO_START + 1.4, T_OUTRO_START + 3, T_OUTRO_START + 6.02, T_OUTRO_START + 8.6, T_OUTRO_START + 10.4, T_OUTRO_START + 11.6);
}

const dir = path.resolve(PROJECT_ROOT, "out/sheets", name);
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

const srv = await startServer();
const browser = await launchBrowser({ width, height });
try {
  const page = await openFilm(browser, srv.url, { width, query: args.query });
  const cells = [];
  for (let i = 0; i < times.length; i += 1) {
    const file = `frame_${String(i).padStart(3, "0")}.jpg`;
    await grabFrame(page, times[i], path.join(dir, file), { type: "jpg", quality: 0.92 });
    cells.push(`<figure><img src="${file}" width="${thumb}" height="${Math.round((thumb * 9) / 16)}"><figcaption>${label(times[i])}</figcaption></figure>`);
  }
  await page.close();

  const html = `<!doctype html><meta charset="utf-8"><title>${name}</title>
<style>
  body { margin: 0; padding: 14px; background: #1b1a18; font: 13px/1.2 Menlo, monospace; color: #d9d2c4; width: ${cols * (thumb + 10) + 28}px; }
  h1 { font-size: 15px; font-weight: 400; margin: 0 0 12px; color: #9a9186; }
  .grid { display: grid; grid-template-columns: repeat(${cols}, ${thumb}px); gap: 10px; }
  figure { margin: 0; }
  img { display: block; background: #000; }
  figcaption { padding: 4px 2px 6px; }
</style>
<h1>The Pelican Test · contact sheet "${name}" · ${times.length} frames rendered at ${width}x${height}</h1>
<div class="grid">${cells.join("")}</div>
<script>Promise.all([...document.images].map((im) => im.decode().catch(() => {}))).then(() => { window.ready = true; });</script>`;
  fs.writeFileSync(path.join(dir, "index.html"), html);

  const sheetW = cols * (thumb + 10) + 28;
  const sheetPage = await openPage(browser, `${srv.url}/out/sheets/${encodeURIComponent(name)}/index.html`, { width: sheetW, height: 800 });
  await sheetPage.waitForFunction(() => window.ready === true, { timeout: 60000 });
  const out = path.resolve(PROJECT_ROOT, "out/sheets", `${name}.png`);
  await sheetPage.screenshot({ path: out, fullPage: true });
  console.log(out);
} finally {
  await browser.close();
  await srv.close();
}
