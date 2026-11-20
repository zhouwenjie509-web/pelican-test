#!/usr/bin/env node
// Is it the same sound? Two renders of the soundtrack, compared sample by sample.
//
//   node tools/audio-same.mjs                       render the whole film twice and compare the two
//   node tools/audio-same.mjs --a x.wav             render the film once and compare it with x.wav
//                                                   (is that file what the code now produces?)
//   node tools/audio-same.mjs --a x.wav --b y.wav   compare two files, section by section
//                                                   (what did a change do, and where?)
//
// Two renders of the same code are not the same byte for byte, and this tool says so instead of
// pretending. Where several sounds meet at one point of the graph, Chrome adds them in an order
// that differs from run to run, and the last bit of a 32-bit sum depends on that order. Measured
// on this film: a few steps of the 24-bit file, about -126 dBFS, in a few samples in a hundred.
// It cannot be heard, but a checksum will differ. So "the same sound" here means: no difference
// above --limit (default -100 dBFS). A part that used a clock or a random number, or a schedule
// that depended on timing, would show up thousands of times larger.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { PROJECT_ROOT } from "./lib/server.mjs";
import { parseArgs } from "./lib/film.mjs";
import { readWav, dbfs } from "./lib/sound.mjs";
import * as TL from "../src/beat/timeline.js";
import { SECTIONS } from "../src/scenes/sections.js";

const args = parseArgs(process.argv.slice(2));
const limit = Number(args.limit || -100);
const rel = (f) => path.relative(PROJECT_ROOT, f);

function render(name) {
  const out = path.resolve(PROJECT_ROOT, "out/audio", name);
  console.log(`Rendering the whole film to ${rel(out)} ...`);
  const r = spawnSync(process.execPath, [path.resolve(PROJECT_ROOT, "tools/audio.mjs"), "--out", out, "--quiet"], { cwd: PROJECT_ROOT, encoding: "utf8" });
  if (r.status !== 0) {
    console.error(r.stdout + r.stderr);
    console.error("The render failed.");
    process.exit(1);
  }
  return out;
}

const fileA = args.a ? path.resolve(PROJECT_ROOT, String(args.a)) : render("same-a.wav");
const fileB = args.b ? path.resolve(PROJECT_ROOT, String(args.b)) : render("same-b.wav");
for (const f of [fileA, fileB]) {
  if (!fs.existsSync(f)) {
    console.error(`${rel(f)} not found.`);
    process.exit(1);
  }
}
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const a = readWav(fileA);
const b = readWav(fileB);
if (a.sampleRate !== b.sampleRate || a.channels.length !== b.channels.length) {
  console.error("The two files differ in sample rate or channel count.");
  process.exit(1);
}
const sr = a.sampleRate;
const n = Math.min(a.channels[0].length, b.channels[0].length);
console.log(`A  ${rel(fileA)}  ${(a.channels[0].length / sr).toFixed(3)} s  sha256 ${sha(fileA).slice(0, 12)}`);
console.log(`B  ${rel(fileB)}  ${(b.channels[0].length / sr).toFixed(3)} s  sha256 ${sha(fileB).slice(0, 12)}`);
let failed = 0;
if (a.channels[0].length !== b.channels[0].length) {
  console.log("The two files differ in length.");
  failed += 1;
}

/** Largest difference, how many samples differ, and the level of A, over samples i0..i1 of every channel. */
function span(i0, i1) {
  let worst = 0;
  let at = i0;
  let differ = 0;
  let energy = 0;
  for (let c = 0; c < a.channels.length; c += 1) {
    const x = a.channels[c];
    const y = b.channels[c];
    for (let i = i0; i < i1; i += 1) {
      const d = Math.abs(x[i] - y[i]);
      if (d > 0) differ += 1;
      if (d > worst) {
        worst = d;
        at = i;
      }
      energy += x[i] * x[i];
    }
  }
  const count = (i1 - i0) * a.channels.length;
  return { worst, at: at / sr, share: count ? differ / count : 0, level: dbfs(Math.sqrt(energy / Math.max(1, count))) };
}

const rows = [];
if (Math.abs(n / sr - TL.DURATION) < 0.01) {
  rows.push({ name: "Intro", a: 0, b: TL.T_INTRO });
  for (const s of SECTIONS) rows.push({ name: `${String(s.n).padStart(2)} ${s.en}`, a: TL.sectionStart(s.n), b: TL.sectionEnd(s.n) });
  rows.push({ name: "Outro", a: TL.T_OUTRO_START, b: TL.DURATION });
} else {
  // not the whole film: ten equal stretches
  for (let i = 0; i < 10; i += 1) rows.push({ name: `stretch ${i + 1}`, a: ((n / sr) * i) / 10, b: ((n / sr) * (i + 1)) / 10 });
}
const fmtDb = (v) => (v > 0 ? `${dbfs(v).toFixed(1)} dBFS` : "none");
console.log("\n                                 film s   largest difference   at film s   samples that differ   level of A");
let changed = 0;
for (const r of rows) {
  const s = span(Math.round(r.a * sr), Math.min(n, Math.round(r.b * sr)));
  const over = s.worst > 0 && dbfs(s.worst) > limit;
  if (over) changed += 1;
  const places = Number.isInteger(r.a) && Number.isInteger(r.b) ? 0 : 1;
  console.log(`${r.name.slice(0, 30).padEnd(30)} ${r.a.toFixed(places).padStart(5)}-${r.b.toFixed(places).padEnd(5)}  ${fmtDb(s.worst).padStart(13)}        ${s.worst > 0 ? s.at.toFixed(3).padStart(8) : "       -"}        ${(s.share * 100).toFixed(2).padStart(6)} %       ${s.level.toFixed(1)} dBFS${over ? "   <- differs" : ""}`);
}
const all = span(0, n);
console.log(`\nWhole file: largest difference ${fmtDb(all.worst)}${all.worst > 0 ? ` at film ${all.at.toFixed(3)} s` : ""}; ${(all.share * 100).toFixed(2)} % of samples differ; one step of a 24-bit file is ${dbfs(1 / 8388608).toFixed(1)} dBFS.`);
if (all.worst === 0) console.log("The two files are identical, sample for sample.");
else if (dbfs(all.worst) <= limit) console.log(`The same sound: nothing differs by more than ${limit} dBFS (rounding in the browser's mixer, not a difference that can be heard).`);
else {
  console.log(`NOT the same sound: ${changed} stretch(es) differ by more than ${limit} dBFS.`);
  failed += 1;
}
process.exit(failed ? 1 : 0);
