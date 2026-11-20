#!/usr/bin/env node
// How fast does the preview page really play? Runs the film in real time in
// headless Chrome (the preview page, not export mode) and reports the frame
// rate and the time spent drawing.
//
//   node tools/perf.mjs --section 12            one section: its entry, its middle bar, its exit
//   node tools/perf.mjs --spans 0:6,28:34       explicit stretches, in seconds
//   node tools/perf.mjs --section 12 --width 1280
//   node tools/perf.mjs --spans 0:5 --query sound=0   with a query option of the preview page (here: no soundtrack)
//
// "fps" is what the page achieved (60 is the ceiling); "draw" is the time
// spent in renderAt() per frame, which must stay well under 16.7 ms.

import { startServer } from "./lib/server.mjs";
import { launchBrowser, openPage } from "./lib/browser.mjs";
import { parseArgs } from "./lib/film.mjs";

const args = parseArgs(process.argv.slice(2));
const width = Number(args.width || 1920);
const T_INTRO = 5;
const T_SECTION = 6;

let spans = [];
let warm = "";
if (args.section) {
  const n = Number(args.section);
  const t0 = T_INTRO + (n - 1) * T_SECTION;
  spans = [
    ["entry", t0 - 0.6, t0 + 1.9],
    ["middle", t0 + 1.9, t0 + 4.1],
    ["exit", t0 + 4.1, t0 + 6.6],
  ];
  warm = `&warm=${[n - 1, n, n + 1].filter((k) => k >= 1 && k <= 20).join(",")}`;
} else {
  spans = String(args.spans || "0:6,9:13,28:34,123:137").split(",").map((s) => {
    const [a, b] = s.split(":").map(Number);
    return [`${a}-${b}s`, a, b];
  });
}

const srv = await startServer();
const browser = await launchBrowser({ width: 1920, height: 1200 });
try {
  const started = Date.now();
  const page = await openPage(browser, `${srv.url}/index.html?w=${width}${warm}${args.query ? `&${args.query}` : ""}`, { width: 1920, height: 1200 });
  await page.waitForFunction(() => !document.getElementById("controls").hidden, { timeout: 180000 });
  console.log(`page ready after ${((Date.now() - started) / 1000).toFixed(1)} s (render width ${width})`);
  for (const [name, a, b] of spans) {
    const res = await page.evaluate(
      async (from, to) => {
        window.clock.pause();
        window.clock.seek(from);
        window.clock.play();
        const gaps = [];
        const draws = [];
        let last = performance.now();
        await new Promise((resolve) => {
          function step() {
            const now = performance.now();
            gaps.push(now - last);
            last = now;
            draws.push(window.film().lastFrame.ms);
            if (window.clock.time >= to || !window.clock.playing) resolve();
            else requestAnimationFrame(step);
          }
          requestAnimationFrame(step);
        });
        window.clock.pause();
        gaps.shift();
        const sorted = (list) => [...list].sort((x, y) => x - y);
        const mean = (list) => list.reduce((s, v) => s + v, 0) / list.length;
        const g = sorted(gaps);
        const d = sorted(draws);
        return {
          frames: gaps.length,
          fps: 1000 / mean(gaps),
          slowestGap: g[g.length - 1],
          drawMean: mean(draws),
          drawP99: d[Math.floor(d.length * 0.99)],
          drawWorst: d[d.length - 1],
        };
      },
      a,
      b,
    );
    console.log(
      `${String(name).padEnd(8)} ${a.toFixed(1)}-${b.toFixed(1)} s  ${res.fps.toFixed(1)} fps  draw mean ${res.drawMean.toFixed(1)} ms, p99 ${res.drawP99.toFixed(1)} ms, worst ${res.drawWorst.toFixed(1)} ms  (slowest frame gap ${res.slowestGap.toFixed(0)} ms, ${res.frames} frames)`,
    );
  }
} finally {
  await browser.close();
  await srv.close();
}
