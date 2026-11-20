#!/usr/bin/env node
// Frame-by-frame export. Every frame is a pure function of time, so the range
// is split into chunks and rendered by several Chrome instances in parallel.
//
//   node tools/render.mjs --out frames/film                       whole film, 1920x1080
//   node tools/render.mjs --from 8 --to 20 --fps 60 --out frames/pan60
//   node tools/render.mjs --from 0 --to 137 --width 960 --jpg --out frames/draft
//
// Options: --from, --to (seconds), --fps, --width, --workers, --out, --jpg [--quality 0.92], --query
// Frame files are named f_000000.png by absolute frame number (round(t * fps)).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startServer, PROJECT_ROOT } from "./lib/server.mjs";
import { launchBrowser } from "./lib/browser.mjs";
import { parseArgs, openFilm, grabFrame } from "./lib/film.mjs";

const args = parseArgs(process.argv.slice(2));
const fps = Number(args.fps || 30);
const from = Number(args.from || 0);
const width = Number(args.width || 1920);
const height = Math.round((width * 9) / 16);
const jpg = Boolean(args.jpg);
const quality = args.quality ? Number(args.quality) : 0.92;
const outDir = path.resolve(PROJECT_ROOT, args.out || "frames/film");
const workers = Math.max(1, Number(args.workers || Math.min(6, Math.max(1, os.cpus().length - 2))));
const CHUNK = 45;

const srv = await startServer();
fs.mkdirSync(outDir, { recursive: true });

// one browser to learn the film's length, then it becomes worker 0
const first = await launchBrowser({ width, height });
const firstPage = await openFilm(first, srv.url, { width, query: args.query });
const duration = await firstPage.evaluate(() => window.__film.duration);
const to = Math.min(Number(args.to ?? duration), duration);

const firstFrame = Math.round(from * fps);
const lastFrame = Math.ceil(to * fps - 1e-6) - 1;
const total = lastFrame - firstFrame + 1;
if (total <= 0) {
  console.error("Nothing to render: check --from and --to.");
  process.exit(1);
}

const chunks = [];
for (let a = firstFrame; a <= lastFrame; a += CHUNK) chunks.push([a, Math.min(lastFrame, a + CHUNK - 1)]);
let nextChunk = 0;
let done = 0;
let pageMs = 0;
const started = Date.now();
const ext = jpg ? "jpg" : "png";

console.log(`Rendering ${total} frames (${from.toFixed(2)}s to ${to.toFixed(2)}s at ${fps} fps, ${width}x${height}) with ${workers} workers -> ${path.relative(PROJECT_ROOT, outDir)}/`);

const report = setInterval(() => {
  const elapsed = (Date.now() - started) / 1000;
  const rate = done / Math.max(elapsed, 0.001);
  const eta = rate > 0 ? (total - done) / rate : 0;
  process.stdout.write(`  ${done}/${total} frames  ${rate.toFixed(1)} fps  eta ${eta.toFixed(0)}s\n`);
}, 5000);

async function work(browser, page) {
  try {
    for (;;) {
      const mine = nextChunk;
      nextChunk += 1;
      if (mine >= chunks.length) break;
      const [a, b] = chunks[mine];
      for (let i = a; i <= b; i += 1) {
        const file = path.join(outDir, `f_${String(i).padStart(6, "0")}.${ext}`);
        const { ms } = await grabFrame(page, i / fps, file, { type: jpg ? "jpg" : "png", quality });
        pageMs += ms;
        done += 1;
      }
    }
  } finally {
    await browser.close();
  }
}

const jobs = [work(first, firstPage)];
for (let w = 1; w < Math.min(workers, chunks.length); w += 1) {
  jobs.push(
    (async () => {
      const browser = await launchBrowser({ width, height });
      const page = await openFilm(browser, srv.url, { width, query: args.query });
      await work(browser, page);
    })(),
  );
}

try {
  await Promise.all(jobs);
} finally {
  clearInterval(report);
  await srv.close();
}
const secs = (Date.now() - started) / 1000;
console.log(`Done: ${done} frames in ${secs.toFixed(1)}s (${(done / secs).toFixed(1)} fps overall, ${(pageMs / done).toFixed(1)} ms average draw time).`);
console.log(JSON.stringify({ outDir, firstFrame, lastFrame, fps, width, height, ext }));
