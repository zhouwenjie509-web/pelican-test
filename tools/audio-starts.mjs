#!/usr/bin/env node
// Can playback begin anywhere in the film?
//
// The preview may be started, or sought to, at any moment; a ranged render (tools/audio.mjs
// --from) begins in the middle of things too. Sounds that are picked up part-way (the ones a
// part marks seekable: drones, beds, the vaporwave tape) then compute where they would be,
// and a time that comes out a hair below zero, or a position past the end of a buffer, makes
// Web Audio refuse the sound. This tool begins playback at several hundred film times in turn
// (offline, in headless Chrome) and reports every sound that could not be started and every
// sample that is not a number or is over full scale.
//
//   node tools/audio-starts.mjs              every 0.61 s, and three places inside every seekable sound
//   node tools/audio-starts.mjs --step 0.2   a finer grid

import { startServer } from "./lib/server.mjs";
import { launchBrowser, openPage } from "./lib/browser.mjs";
import { parseArgs } from "./lib/film.mjs";

const args = parseArgs(process.argv.slice(2));
const step = Number(args.step || 0.61);
if (!(step > 0.01)) {
  console.error("--step must be a number of seconds above 0.01");
  process.exit(1);
}
const srv = await startServer();
const browser = await launchBrowser({ width: 640, height: 360 });
let res;
try {
  const page = await openPage(browser, `${srv.url}/audio/render.html`, { width: 640, height: 360 });
  await page.waitForFunction(() => window.__audio && window.__audio.ready === true, { timeout: 60000 });
  res = await page.evaluate((o) => window.__audio.starts(o), { step });
} finally {
  await browser.close();
  await srv.close();
}
for (const e of res.loadErrors || []) console.log(`could not load: ${e.part || ""} ${e.message || e}`);
console.log(`Playback begun at ${res.count} film times (every ${step} s, and three places inside each of ${res.seekable} seekable sounds), each in two ways: as the preview does after a seek, and as a ranged render does.`);
for (const b of res.bad) {
  for (const e of b.errors) console.log(`  begun at ${b.t.toFixed(3)} s ${b.how}: ${e}`);
  if (b.wrong) console.log(`  begun at ${b.t.toFixed(3)} s ${b.how}: ${b.wrong}`);
}
const failed = res.bad.length + (res.loadErrors || []).length;
console.log(failed ? `${res.bad.length} start(s) went wrong.` : "Every one started cleanly: no sound refused, every sample a number within full scale.");
process.exit(failed ? 1 : 0);
