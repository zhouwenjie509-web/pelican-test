// Section 20 lab: a frame-by-frame sweep that measures the tyres in every frame.
//
//   node dev/experiments/code-sweep.js [--from 119] [--to 125] [--fps 60] [--width 1920] [--dbg '{"noScratch":1}']
//
// For each frame it renders the whole film at time t (export mode, as the tools do), reads the
// canvas back and counts the pixels within a small colour distance of the tyre charcoal
// (#2c313c) in a box round each wheel. The camera keeps the pelican's road point on the centre
// column with the road at 74 % of the height, so the boxes follow the wheels without help.
// A frame is "bad" when either wheel's count falls below 45 % of the median of the frames
// around it (both tyres are present from u = 1.0; before that they are construction lines).
// --dbg sets globalThis.__codeDbg in the page (a debugging switch read by nothing in the film).

import { startServer } from "../../tools/lib/server.mjs";
import { launchBrowser } from "../../tools/lib/browser.mjs";
import { parseArgs, openFilm } from "../../tools/lib/film.mjs";

const args = parseArgs(process.argv.slice(2));
const from = Number(args.from ?? 119);
const to = Number(args.to ?? 125);
const fps = Number(args.fps ?? 60);
const width = Number(args.width ?? 1920);
const height = Math.round((width * 9) / 16);

const srv = await startServer();
const browser = await launchBrowser({ width, height });
const rows = [];
try {
  const page = await openFilm(browser, srv.url, { width });
  if (args.dbg) await page.evaluate((d) => (globalThis.__codeDbg = JSON.parse(d)), String(args.dbg));
  const n = Math.round((to - from) * fps);
  for (let i = 0; i < n; i += 1) {
    const t = +(from + i / fps).toFixed(5);
    const r = await page.evaluate(
      async (time, W, H) => {
        await window.__film.renderAt(time);
        const url = window.__film.capture("image/png");
        const img = new Image();
        img.src = url;
        await img.decode();
        const c = new OffscreenCanvas(W, H);
        const g = c.getContext("2d", { willReadFrequently: true });
        g.drawImage(img, 0, 0);
        const s = W / 1920;
        const count = (x0, x1) => {
          const y0 = Math.round(660 * s);
          const y1 = Math.round(800 * s);
          const d = g.getImageData(Math.round(x0 * s), y0, Math.round((x1 - x0) * s), y1 - y0).data;
          let k = 0;
          for (let j = 0; j < d.length; j += 4) {
            const dr = d[j] - 0x2c;
            const dg = d[j + 1] - 0x31;
            const db = d[j + 2] - 0x3c;
            if (dr * dr + dg * dg + db * db < 14 * 14) k += 1;
          }
          return k;
        };
        // rear wheel left of the road point, front wheel right of it
        return { rear: count(770, 950), front: count(975, 1150) };
      },
      t,
      width,
      height,
    );
    rows.push({ t, u: +(t - 119).toFixed(4), ...r });
  }
} finally {
  await browser.close();
  await srv.close();
}

// flag drops against the median of the 9 frames around each one
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
let bad = 0;
const lines = [];
for (let i = 0; i < rows.length; i += 1) {
  const r = rows[i];
  const near = rows.slice(Math.max(0, i - 4), i + 5);
  const mr = med(near.map((q) => q.rear));
  const mf = med(near.map((q) => q.front));
  const watch = r.u >= 1.0 && r.u <= 5.6;
  const isBad = watch && (r.rear < 0.45 * mr || r.front < 0.45 * mf || r.rear < 150 || r.front < 150);
  if (isBad) bad += 1;
  if (isBad || args.all) lines.push(`${r.t.toFixed(4)} u ${r.u.toFixed(4)} rear ${r.rear} (med ${mr}) front ${r.front} (med ${mf})${isBad ? "  BAD" : ""}`);
}
const watched = rows.filter((r) => r.u >= 1.0 && r.u <= 5.6);
console.log(lines.join("\n"));
console.log(`frames ${rows.length} (${from}-${to} at ${fps} fps), watched u 1.0-5.6: ${watched.length}, bad: ${bad}`);
console.log(`tyre pixels in watched frames: rear min ${Math.min(...watched.map((r) => r.rear))} max ${Math.max(...watched.map((r) => r.rear))}, front min ${Math.min(...watched.map((r) => r.front))} max ${Math.max(...watched.map((r) => r.front))}`);
