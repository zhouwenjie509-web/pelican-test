#!/usr/bin/env node
// Self-checks for the things the film must never get wrong.
//
//   node tools/check.mjs            timing rules (fast, no browser)
//   node tools/check.mjs --purity   also render frames in two different orders in two
//                                   browsers and require byte-identical images
//   node tools/check.mjs --purity --section 7     the purity test on one section's frames
//   node tools/check.mjs --purity --times 41.5,44 the purity test at chosen times
//
// Timing rules checked:
//   - every crossing is on a bar line and the pelican is exactly on the boundary there
//   - it passes each boundary at the standard speed with a pedal forward (on the beat)
//   - scene overrides keep the contract: motion() starts at 0 and ends at 1000 at speed,
//     never rolls backwards; camera() is neutral at both ends of bar 2; road() is level
//     and agrees with the neighbouring section wherever the pelican overlaps a picture frame
//   - the camera hands over from the tracking shot to the outro without a jump

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startServer } from "./lib/server.mjs";
import { launchBrowser } from "./lib/browser.mjs";
import { parseArgs, openFilm, grabFrame } from "./lib/film.mjs";
import * as TL from "../src/beat/timeline.js";
import { SPEED, SECTION_LEN, ROAD_Y, boundaryX } from "../src/main/layout.js";
import { pelicanAt, pelicanSpeed, corridorCamera } from "../src/main/camera.js";
import { outroCamera } from "../src/scenes/outro.js";
import { CRANK_ON_BEAT } from "../src/rig/rig.js";
import { buildScenes } from "../src/scenes/index.js";

const args = parseArgs(process.argv.slice(2));
const scenes = buildScenes();
let failures = 0;
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
}
const near = (a, b, eps) => Math.abs(a - b) <= eps;

// ---- timeline
check("film length is 137 s", near(TL.DURATION, 137, 1e-9), `${TL.DURATION}`);
let worstX = 0;
let worstV = 0;
let offBar = 0;
for (let k = 0; k <= TL.N_SECTIONS; k += 1) {
  const t = TL.crossingTime(k);
  if (!TL.isDownbeat(t)) offBar += 1;
  worstX = Math.max(worstX, Math.abs(pelicanAt(t, scenes).x - boundaryX(k)));
  if (k < TL.N_SECTIONS) worstV = Math.max(worstV, Math.abs(pelicanSpeed(t + 1e-3, scenes) - 1));
}
check("all 21 crossings fall on bar lines", offBar === 0, `${offBar} off the bar`);
check("pelican is on the boundary at every crossing", worstX < 1e-6, `worst error ${worstX.toExponential(2)} units`);
check("pelican passes every boundary at standard speed", worstV < 0.01, `worst deviation ${(worstV * 100).toFixed(3)} %`);

// ---- pedals on the beat (sections that ride at the standard pace)
let worstPhase = 0;
for (let n = 1; n <= TL.N_SECTIONS; n += 1) {
  if (typeof scenes[n].motion === "function") continue;
  for (let b = 0; b < TL.SECTION_BARS * TL.BEATS_PER_BAR; b += 1) {
    const c = pelicanAt(TL.sectionStart(n) + b * TL.BEAT, scenes).crank - CRANK_ON_BEAT;
    const off = Math.abs(((c / Math.PI + 0.5) % 1 + 1) % 1 - 0.5) * Math.PI;
    worstPhase = Math.max(worstPhase, off);
  }
}
check("a pedal is forward on every beat (one turn per two beats)", worstPhase < 1e-6, `worst phase error ${worstPhase.toExponential(2)} rad`);

// ---- scene overrides
let unpainted = 0;
for (let n = 1; n <= TL.N_SECTIONS; n += 1) {
  const sc = scenes[n];
  if (sc.placeholder) unpainted += 1;
  const named = sc.n === n && typeof sc.id === "string" && typeof sc.render === "function" && Boolean(sc.zh && sc.en && sc.date && sc.dateEn);
  if (!named) check(`section ${n}: scene object is complete`, false, "needs n, id, zh, en, date, dateEn and render()");
  if (sc.still && sc.still.u !== undefined && !(sc.still.u >= 0 && sc.still.u <= TL.T_SECTION)) check(`section ${n} still: u is inside the section`, false, `u = ${sc.still.u}`);
  if (sc.poseHz !== undefined && !(sc.poseHz >= 4 && sc.poseHz <= 30)) check(`section ${n} poseHz is a sensible rate`, false, `${sc.poseHz}`);
  if (typeof sc.road === "function") {
    let finite = true;
    let steepest = 0;
    for (let x = -140; x <= SECTION_LEN + 140; x += 2) {
      const y = sc.road(x);
      if (!Number.isFinite(y)) finite = false;
      steepest = Math.max(steepest, Math.abs(sc.road(x + 2) - y) / 2);
    }
    check(`section ${n} road(): defined everywhere, no slope steeper than 1 in 2`, finite && steepest <= 0.5, `steepest ${steepest.toFixed(3)}`);
  }
  if (typeof sc.motion === "function") {
    const a = sc.motion(1e-6).x;
    const b = sc.motion(TL.T_SECTION - 1e-6).x;
    const va = (sc.motion(2e-3).x - sc.motion(1e-3).x) / 1e-3 / SPEED;
    const vb = (sc.motion(TL.T_SECTION - 1e-3).x - sc.motion(TL.T_SECTION - 2e-3).x) / 1e-3 / SPEED;
    let backwards = 0;
    let prev = -Infinity;
    for (let u = 0.001; u < TL.T_SECTION; u += 0.004) {
      const x = sc.motion(u).x;
      if (x < prev - 1e-9) backwards += 1;
      prev = x;
    }
    check(`section ${n} motion(): starts at 0, ends at ${SECTION_LEN}`, near(a, 0, 1e-3) && near(b, SECTION_LEN, 1e-3), `${a.toFixed(4)} .. ${b.toFixed(4)}`);
    check(`section ${n} motion(): enters and leaves at standard speed`, near(va, 1, 0.02) && near(vb, 1, 0.02), `${va.toFixed(3)}x in, ${vb.toFixed(3)}x out`);
    check(`section ${n} motion(): never rolls backwards`, backwards === 0, `${backwards} reversed samples`);
  }
  if (typeof sc.camera === "function") {
    const ends = [TL.BAR + 1e-6, 2 * TL.BAR - 1e-6].map((u) => sc.camera(u) || {});
    const neutral = ends.every((m) => near(m.zoom ?? 1, 1, 1e-3) && near(m.dx ?? 0, 0, 0.05) && near(m.dy ?? 0, 0, 0.05));
    check(`section ${n} camera(): neutral at both ends of bar 2`, neutral, JSON.stringify(ends));
  }
}

// ---- roads meet at the picture frames
// While the pelican overlaps a frame both neighbours draw it, so within 100
// units of every boundary the two roads must be level and at the same height.
{
  const roadOf = (sc) => (sc && typeof sc.road === "function" ? (x) => sc.road(x) : () => ROAD_Y);
  let worstGap = 0;
  let worstTilt = 0;
  let where = 0;
  for (let k = 0; k <= TL.N_SECTIONS; k += 1) {
    const left = k === 0 ? () => ROAD_Y : roadOf(scenes[k]);
    const right = k === TL.N_SECTIONS ? () => ROAD_Y : roadOf(scenes[k + 1]);
    const y0 = left(SECTION_LEN);
    for (let d = -100; d <= 100; d += 2) {
      const yl = left(SECTION_LEN + d);
      const yr = right(d);
      const gap = Math.abs(yl - yr);
      const tilt = Math.max(Math.abs(yl - y0), Math.abs(yr - y0));
      if (gap > worstGap || tilt > worstTilt) where = k;
      worstGap = Math.max(worstGap, gap);
      worstTilt = Math.max(worstTilt, tilt);
    }
  }
  check("roads are level and meet at every picture frame", worstGap < 1e-6 && worstTilt < 1e-6, `worst mismatch ${worstGap.toExponential(2)}, worst tilt ${worstTilt.toExponential(2)} units (crossing ${where})`);
}

// ---- camera continuity
let worstStep = 0;
let at = 0;
const dt = 1 / 480;
let prevCam = corridorCamera(0, scenes);
for (let t = dt; t < TL.T_OUTRO_START; t += dt) {
  const c = corridorCamera(t, scenes);
  const step = Math.abs(c.x - prevCam.x) / dt / SPEED;
  if (step > worstStep) {
    worstStep = step;
    at = t;
  }
  prevCam = c;
}
check("tracking camera never jumps", worstStep < 3.2, `fastest pan ${worstStep.toFixed(2)}x standard speed at ${at.toFixed(2)} s`);
const a = corridorCamera(TL.T_OUTRO_START - 1e-6, scenes);
const b = outroCamera(TL.T_OUTRO_START + 1e-6);
check("camera hands over to the outro without a jump", near(a.x, b.x, 0.01) && near(a.y, b.y, 0.01) && near(a.zoom, b.zoom, 1e-4), `dx ${(b.x - a.x).toExponential(2)}, dzoom ${(b.zoom - a.zoom).toExponential(2)}`);

// ---- purity
if (args.purity) {
  let times = String(args.times || "0.6,3.4,4.7,5.0,8.25,13.6,32.0,59.3,97.1,119.0,124.8,125.4,126.5,131.02,135.5,136.9").split(",").map(Number);
  if (args.section && !args.times) {
    const t0 = TL.sectionStart(Number(args.section));
    times = [-0.3, 0, 0.37, 1.1, 2.0, 2.52, 3.0, 3.5, 4.41, 5.2, 5.9, 6.0, 6.3].map((u) => Number((t0 + u).toFixed(3)));
    // the gallery wall too: its stills are made after the section's frames in one run and
    // before them in the other, which catches a still that depends on what was drawn first
    times.push(TL.T_OUTRO_START + 1.5);
  }
  const width = Number(args.width || 960);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pelican-check-"));
  const srv = await startServer();
  const hashRun = async (order, tag) => {
    const browser = await launchBrowser({ width, height: Math.round((width * 9) / 16) });
    try {
      const page = await openFilm(browser, srv.url, { width });
      const out = {};
      for (const t of order) {
        const file = path.join(tmp, `${tag}_${t}.png`);
        await grabFrame(page, t, file);
        out[t] = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
      }
      return out;
    } finally {
      await browser.close();
    }
  };
  try {
    const forward = await hashRun(times, "a");
    const shuffled = await hashRun([...times].reverse().concat(times), "b"); // each time twice, in a different order
    const differing = times.filter((t) => forward[t] !== shuffled[t]);
    check(`frames are a pure function of time (${times.length} frames, two browsers, different orders)`, differing.length === 0, differing.length ? `differ at t = ${differing.join(", ")}` : "byte-identical");
  } finally {
    await srv.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
console.log(`\n${TL.N_SECTIONS - unpainted} of ${TL.N_SECTIONS} sections are painted.`);
console.log(failures ? `\n${failures} check(s) failed.` : `\nAll ${results.length} checks passed.`);
process.exit(failures ? 1 : 0);
