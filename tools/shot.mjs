#!/usr/bin/env node
// Screenshot one frame of the film, or any page of the project.
//
//   node tools/shot.mjs --t 12.5 [--out out/shots/t12.5.png] [--width 1920] [--query "solo=5"]
//   node tools/shot.mjs --page dev/rig.html --out out/shots/rig.png
//   node tools/shot.mjs --still 5 [--out out/shots/still-05.png]     a section's gallery still
//   node tools/shot.mjs --still 20 --u 7.0                           the same square at another moment, drawn live
//
// Several times at once: --t 5,8,11

import fs from "node:fs";
import path from "node:path";
import { startServer, PROJECT_ROOT } from "./lib/server.mjs";
import { launchBrowser, openPage } from "./lib/browser.mjs";
import { parseArgs, openFilm, grabFrame, grabStill } from "./lib/film.mjs";

const args = parseArgs(process.argv.slice(2));
const width = Number(args.width || 1920);
const height = Math.round((width * 9) / 16);
const srv = await startServer();
const browser = await launchBrowser({ width, height });
try {
  if (args.page) {
    const out = path.resolve(PROJECT_ROOT, args.out || `out/shots/${path.basename(args.page.split("?")[0], ".html")}.png`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const page = await openPage(browser, `${srv.url}/${args.page}`, { width, height });
    await page.waitForFunction(() => window.ready === true, { timeout: 120000 });
    await page.screenshot({ path: out });
    const result = await page.evaluate(() => window.result || null);
    if (result) console.log(JSON.stringify(result));
    console.log(out);
  } else if (args.still) {
    const page = await openFilm(browser, srv.url, { width, query: args.query });
    // --u: the still's square at another moment of the section, drawn live (not the cached still)
    const at = args.u === undefined ? null : Number(args.u);
    for (const n of String(args.still).split(",").map(Number)) {
      const name = `still-${String(n).padStart(2, "0")}${at === null ? "" : `-u${at.toFixed(3)}`}.png`;
      const out = path.resolve(PROJECT_ROOT, args.out && !String(args.still).includes(",") ? args.out : `out/shots/${name}`);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      await grabStill(page, n, out, { u: at });
      console.log(out);
    }
  } else {
    const times = String(args.t ?? "0").split(",").map(Number);
    const page = await openFilm(browser, srv.url, { width, query: args.query });
    for (const t of times) {
      const out = path.resolve(PROJECT_ROOT, times.length === 1 && args.out ? args.out : `out/shots/t${t.toFixed(3)}.png`);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      const { ms } = await grabFrame(page, t, out);
      console.log(`${out}  (${ms.toFixed(1)} ms)`);
    }
  }
} finally {
  await browser.close();
  await srv.close();
}
