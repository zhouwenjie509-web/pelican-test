#!/usr/bin/env node
// What is in a stretch of rendered sound: its strongest partials and how its level moves.
// Use it to check that a synthesized instrument has the anatomy of the real one
// (which partials, how fast the attack, how long the ring).
//
//   node tools/audio-probe.mjs out/audio/s07.wav --at 48.0 --len 0.4      film time 48.0 s, 0.4 s long
//   node tools/audio-probe.mjs out/audio/s07.wav --at 48.0 --len 1.5 --env   also the level every 10 ms
//
//   node tools/audio-probe.mjs out/audio/s07.wav --at 48.0 --len 0.3 --band 2000:9000   listen in one band only
//
// --at is in film seconds when there is a .json beside the WAV (it says where the file starts);
// without one it is seconds into the file. --peaks N (default 14). The partials are read from
// the middle of the stretch (up to 0.68 s of it) with a Hann window.

import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "./lib/server.mjs";
import { parseArgs } from "./lib/film.mjs";
import { readWav, toMono, spectrum, dbfs, bandpass } from "./lib/sound.mjs";

const file = process.argv[2] && !process.argv[2].startsWith("--") ? path.resolve(PROJECT_ROOT, process.argv[2]) : null;
const args = parseArgs(process.argv.slice(2), { own: true });
if (!file || !fs.existsSync(file) || args.help) {
  console.error(
    [
      "Usage: node tools/audio-probe.mjs <file.wav> --at <film seconds> [--len 0.4] [options]",
      "  --peaks N        list the N strongest partials (default 14), in order of frequency; * marks the strongest",
      "  --env            also print the level every 10 ms",
      "  --band lo:hi     listen in that band only (24 dB per octave either side)",
      "  --track MS       follow the strongest partial every MS milliseconds (its pitch and level): for glides and scoops;",
      "                   with --near HZ it follows the strongest partial within an octave of HZ",
      "  --at is in film seconds when a .json lies beside the WAV, otherwise seconds into the file.",
    ].join("\n"),
  );
  process.exit(args.help ? 0 : 1);
}
const sideFile = file.replace(/\.wav$/, ".json");
const from = fs.existsSync(sideFile) ? JSON.parse(fs.readFileSync(sideFile, "utf8")).from : 0;
const { sampleRate: sr, channels } = readWav(file);
let x = toMono(channels);
if (args.band) {
  const [lo, hi] = String(args.band).split(":").map(Number);
  x = bandpass(x, sr, lo, hi);
}
const at = Number(args.at === undefined ? from : args.at) - from;
const len = Number(args.len || 0.4);
const a = Math.max(0, Math.round(at * sr));
const n = Math.min(x.length - a, Math.round(len * sr));
if (n < 256) {
  console.error("That stretch is outside the file.");
  process.exit(1);
}

// ---- level
let peak = 0;
let sq = 0;
for (let i = 0; i < n; i += 1) {
  const v = Math.abs(x[a + i]);
  if (v > peak) peak = v;
  sq += v * v;
}
console.log(`${path.relative(PROJECT_ROOT, file)}: film ${(at + from).toFixed(3)}-${(at + from + len).toFixed(3)} s   peak ${dbfs(peak).toFixed(1)} dBFS, rms ${dbfs(Math.sqrt(sq / n)).toFixed(1)} dBFS`);

// ---- envelope: time to reach 90 % of the peak level, and time to fall 20 dB after it
const hop = Math.round(sr * 0.002);
const env = [];
for (let i = 0; i + hop <= n; i += hop) {
  let s = 0;
  for (let j = 0; j < hop; j += 1) s += x[a + i + j] ** 2;
  env.push(Math.sqrt(s / hop));
}
const top = Math.max(...env);
const iTop = env.indexOf(top);
const i10 = env.findIndex((v) => v >= 0.1 * top);
const i90 = env.findIndex((v) => v >= 0.9 * top);
let iFall = -1;
for (let i = iTop; i < env.length; i += 1) {
  if (env[i] <= top * 0.1) {
    iFall = i;
    break;
  }
}
console.log(`envelope: rises from 10 % to 90 % of its peak in ${((i90 - i10) * 2).toFixed(0)} ms, peak at +${(iTop * 2).toFixed(0)} ms${iFall >= 0 ? `, 20 dB down ${((iFall - iTop) * 2).toFixed(0)} ms after the peak (T60 about ${(((iFall - iTop) * 2 * 3) / 1000).toFixed(2)} s if the decay is even)` : ", does not fall 20 dB inside this stretch"}`);
if (args.env) {
  const rows = [];
  for (let i = 0; i < env.length; i += 5) rows.push(`${(i * 2).toString().padStart(5)} ms ${dbfs(Math.max(...env.slice(i, i + 5))).toFixed(1).padStart(7)} dB  ${"#".repeat(Math.max(0, Math.round((dbfs(Math.max(...env.slice(i, i + 5))) + 72) / 2)))}`);
  console.log(rows.join("\n"));
}

// ---- partials
const size = 65536;
const use = Math.min(n, 32768);
const mag = spectrum(x, a + Math.floor((n - use) / 2), use, size);
const binHz = sr / size;
const peaks = [];
for (let i = Math.ceil(30 / binHz); i < mag.length - 1; i += 1) {
  if (mag[i] > mag[i - 1] && mag[i] >= mag[i + 1]) {
    const p = mag[i - 1];
    const q = mag[i];
    const r = mag[i + 1];
    const shift = p - 2 * q + r !== 0 ? (0.5 * (p - r)) / (p - 2 * q + r) : 0;
    peaks.push({ hz: (i + shift) * binHz, mag: q });
  }
}
peaks.sort((p, q) => q.mag - p.mag);
const count = Number(args.peaks || 14);
const best = peaks.slice(0, count).sort((p, q) => p.hz - q.hz);
const ref = peaks.length ? peaks[0].mag : 1;
const lowest = best.length ? best[0].hz : 1;
const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
console.log(`partials (the ${best.length} strongest, in order of frequency; level against the strongest, which is marked *; ratio to the lowest listed):`);
for (const p of best) {
  const m = 69 + 12 * Math.log2(p.hz / 440);
  const r = Math.round(m);
  const cents = Math.round((m - r) * 100);
  console.log(`${p.mag === ref ? " *" : "  "}${p.hz.toFixed(1).padStart(8)} Hz  ${dbfs(p.mag / ref).toFixed(1).padStart(6)} dB   x${(p.hz / lowest).toFixed(3).padStart(7)}   ${names[((r % 12) + 12) % 12]}${Math.floor(r / 12) - 1}${cents >= 0 ? "+" : ""}${cents}`);
}
// where the energy sits
let total = 0;
let weighted = 0;
for (let i = 1; i < mag.length; i += 1) {
  total += mag[i] * mag[i];
  weighted += mag[i] * mag[i] * i * binHz;
}
console.log(`centroid ${(weighted / (total || 1)).toFixed(0)} Hz`);

// ---- follow the strongest partial through time
if (args.track) {
  const stepMs = Number(args.track) || 20;
  const near = args.near ? Number(args.near) : null;
  const win = 4096;
  const tsize = 32768;
  console.log(`\nthe strongest partial${near ? ` within an octave of ${near} Hz` : ""}, every ${stepMs} ms (window ${((win / sr) * 1000).toFixed(0)} ms):`);
  for (let ms = 0; ms * sr / 1000 + win <= n; ms += stepMs) {
    const m = spectrum(x, a + Math.round((ms * sr) / 1000), win, tsize);
    const bh = sr / tsize;
    const lo = Math.ceil((near ? near / 2 : 40) / bh);
    const hi = Math.min(m.length - 2, Math.floor((near ? near * 2 : 12000) / bh));
    let bi = lo;
    for (let i = lo; i <= hi; i += 1) if (m[i] > m[bi]) bi = i;
    const p = m[bi - 1];
    const q = m[bi];
    const r = m[bi + 1];
    const f = (bi + (p - 2 * q + r !== 0 ? (0.5 * (p - r)) / (p - 2 * q + r) : 0)) * bh;
    const mm = 69 + 12 * Math.log2(f / 440);
    const rr = Math.round(mm);
    const cc = Math.round((mm - rr) * 100);
    console.log(`  +${String(ms + Math.round((win / sr) * 500)).padStart(5)} ms  ${f.toFixed(1).padStart(8)} Hz  ${names[((rr % 12) + 12) % 12]}${Math.floor(rr / 12) - 1}${cc >= 0 ? "+" : ""}${cc}  ${dbfs(q * (4 / win)).toFixed(1).padStart(6)} dBFS`);
  }
}
