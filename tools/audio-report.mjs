#!/usr/bin/env node
// The whole soundtrack, measured: overall loudness and peak, loudness of each
// section in the mix, and whether every declared cue (the bell on each
// crossing among them) begins where the picture needs it.
//
//   node tools/audio-report.mjs                      measures out/audio/pelican-test.wav
//   node tools/audio-report.mjs --wav out/audio/x.wav
//
// Render the file first with "node tools/audio.mjs" (no options). The .json beside it
// carries the cues.

import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "./lib/server.mjs";
import { parseArgs } from "./lib/film.mjs";
import { readWav, toMono, levels, dbfs, onsetNear, loudness } from "./lib/sound.mjs";
import { drawSpectrogram } from "./lib/spectro.mjs";
import { cueLimit } from "./lib/sound-check.mjs";
import * as TL from "../src/beat/timeline.js";
import { SECTIONS } from "../src/scenes/sections.js";

const args = parseArgs(process.argv.slice(2));
const file = path.resolve(PROJECT_ROOT, args.wav || "out/audio/pelican-test.wav");
if (!fs.existsSync(file)) {
  console.error(`${path.relative(PROJECT_ROOT, file)} not found: run "node tools/audio.mjs" first.`);
  process.exit(1);
}
const side = JSON.parse(fs.readFileSync(file.replace(/\.wav$/, ".json"), "utf8"));
const { sampleRate: sr, channels } = readWav(file);
const x = toMono(channels);
const fmt = (v, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? "n/a" : v.toFixed(d));
let problems = 0;

// ---- the whole film
const whole = loudness(file);
const peak = Math.max(...channels.map((c) => levels(c).peak));
console.log(`${path.relative(PROJECT_ROOT, file)}: ${(x.length / sr).toFixed(3)} s, ${sr} Hz, ${channels.length} channels`);
console.log(`Whole film   ${fmt(whole.integrated)} LUFS integrated, loudness range ${fmt(whole.range)} LU, sample peak ${fmt(dbfs(peak))} dBFS, true peak ${fmt(whole.truePeak)} dBTP`);
if (whole.truePeak !== null && whole.truePeak > -1) {
  console.log("             TRUE PEAK ABOVE -1 dBTP");
  problems += 1;
}
if (Math.abs(x.length / sr - TL.DURATION) > 0.001) {
  console.log(`             LENGTH IS NOT ${TL.DURATION} s`);
  problems += 1;
}
const lastQuarter = levels(x, x.length - Math.round(0.05 * sr), x.length);
console.log(`             last 50 ms: ${Number.isFinite(dbfs(lastQuarter.peak)) ? `${fmt(dbfs(lastQuarter.peak))} dBFS peak` : "silence"} (the film must end in silence)`);

// ---- section by section
console.log("\nSection                         film s      LUFS   peak dBFS");
const rows = [{ name: "Intro", a: 0, b: TL.T_INTRO }];
for (const s of SECTIONS) rows.push({ name: `${String(s.n).padStart(2)} ${s.en}`, a: TL.sectionStart(s.n), b: TL.sectionEnd(s.n) });
rows.push({ name: "Outro (first six seconds)", a: TL.T_OUTRO_START, b: TL.T_OUTRO_START + 6 });
rows.push({ name: "Outro (last six seconds)", a: TL.T_OUTRO_START + 6, b: TL.DURATION });
for (const r of rows) {
  const l = loudness(file, { from: r.a, dur: r.b - r.a });
  const p = Math.max(...channels.map((c) => levels(c, r.a * sr, r.b * sr).peak));
  console.log(`${r.name.slice(0, 30).padEnd(30)} ${fmt(r.a, 0).padStart(4)}-${fmt(r.b, 0).padEnd(4)} ${fmt(l.integrated).padStart(7)}  ${fmt(dbfs(p)).padStart(7)}`);
}

// ---- cues
const cues = (side.cues || []).filter((c) => c.t >= 0.13 && c.t <= TL.DURATION - 0.21);
let worst = 0;
let late = 0;
let silent = 0;
const lines = [];
for (const c of cues) {
  const on = onsetNear(x, sr, c.t, { band: c.band || null });
  const limit = cueLimit(c);
  if (!on) {
    silent += 1;
    lines.push(`  ${fmt(c.t, 3).padStart(8)} s  ${c.part.padEnd(10)} no rise of 3 dB in the mix   ${c.what}`);
  } else {
    if (!c.soft && Math.abs(on.lagMs) > Math.abs(worst)) worst = on.lagMs;
    if (Math.abs(on.lagMs) > limit) {
      late += 1;
      lines.push(`  ${fmt(c.t, 3).padStart(8)} s  ${c.part.padEnd(10)} ${(on.lagMs >= 0 ? "+" : "") + fmt(on.lagMs)} ms (limit ${limit})   ${c.what}`);
    }
  }
}
console.log(`\nCues: ${cues.length} declared by the parts. In the full mix ${cues.length - late - silent} begin within their limit (15 ms; wider for a cue that is heard only in a narrow low band; 60 ms for swells), ${late} do not, and ${silent} cannot be measured there (another sound is louder at that moment). Worst hard cue: ${(worst >= 0 ? "+" : "") + fmt(worst)} ms.`);
console.log("      (These readings are the detector's, which reports the end of its 5 ms window: about 1 ms late on a sharp sound, 10 ms or more on one that takes 30 ms to speak, never early.)");
for (const l of lines) console.log(l);

// the bell on every crossing, measured in its own band
const bells = cues.filter((c) => c.part === "bike");
const bellLags = bells.map((c) => onsetNear(x, sr, c.t, { band: c.band || [1800, 9000] })).filter(Boolean).map((o) => o.lagMs);
if (bellLags.length) console.log(`Bells: ${bellLags.length} of ${bells.length} measurable in the mix; lag ${fmt(Math.min(...bellLags))} to ${fmt(Math.max(...bellLags))} ms.`);

// ---- picture of the whole film
const png = file.replace(/\.wav$/, ".png");
drawSpectrogram(png, x, sr, { from: 0, to: x.length / sr, pxPerSec: 14, filmStart: 0, cues: bells });
console.log(`\nPicture: ${path.relative(PROJECT_ROOT, png)} (14 px per second; a bar line every 2 s, labelled every section; wedges mark the bells)`);
process.exit(problems ? 1 : 0);
