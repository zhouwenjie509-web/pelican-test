#!/usr/bin/env node
// Every part of the soundtrack, checked alone: one line each.
//
//   node tools/audio-check-all.mjs            all parts
//   node tools/audio-check-all.mjs --bike     the same, each with the bicycle (the bell must be heard at both ends)
//
// For each part: loudness against its target, peak, how many declared cues begin within their
// limit and the worst lag among the hard ones, the tuning of the lead notes, lint. The full
// report of one part: node tools/audio.mjs --section N --check.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PROJECT_ROOT } from "./lib/server.mjs";
import { parseArgs } from "./lib/film.mjs";
import { readWav, toMono, levels, dbfs, onsetNear, pitchNear, loudness } from "./lib/sound.mjs";
import { cueLimit, LIMITS } from "./lib/sound-check.mjs";
import { TARGET, PEAK } from "../audio/mix.js";
import { hz } from "../audio/engine/theory.js";
import { PARTS } from "../audio/soundtrack.js";

const args = parseArgs(process.argv.slice(2));
const fmt = (v, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? "n/a" : v.toFixed(d));
let failures = 0;
let cuesTotal = 0;
let cuesOk = 0;
let worstAll = 0;

console.log("part         LUFS  target   peak   cues ok   worst hard cue   lead notes   worst cents   state");
for (const spec of PARTS) {
  if (spec.id === "bike" && args.bike) continue;
  const key = spec.n >= 1 && spec.n <= 20 ? ["--section", String(spec.n)] : ["--part", spec.id];
  const name = `all-${spec.id}`;
  const out = path.join(PROJECT_ROOT, "out", "audio", `${name}.wav`);
  const cmd = ["tools/audio.mjs", ...key, "--out", `out/audio/${name}.wav`, "--quiet"];
  if (args.bike) cmd.push("--with", "bike");
  const res = spawnSync("node", cmd, { cwd: PROJECT_ROOT, encoding: "utf8" });
  const errors = (res.stdout + res.stderr).split("\n").filter((l) => /^ERROR|\[sound\]/.test(l));
  if (!fs.existsSync(out)) {
    console.log(`${spec.id.padEnd(11)} DID NOT RENDER  ${errors.join(" ")}`);
    failures += 1;
    continue;
  }
  const side = JSON.parse(fs.readFileSync(out.replace(/\.wav$/, ".json"), "utf8"));
  const { sampleRate: sr, channels } = readWav(out);
  const x = toMono(channels);
  const rel = (t) => t - side.from;
  const { t0, t1 } = side.focus;
  const loud = loudness(out, { from: rel(t0), dur: Math.min(t1, side.to) - t0 });
  const peak = dbfs(Math.max(...channels.map((c) => levels(c).peak)));
  const target = TARGET[spec.id];
  const state = [];
  if (errors.length) state.push(`errors: ${errors.length}`);
  if (side.standin) state.push("stand-in");
  if (!args.bike && target !== undefined && loud.integrated !== null && Math.abs(loud.integrated - target) > LIMITS.loudness) state.push("level");
  if (!args.bike && spec.id !== "bike" && peak > (PEAK[spec.id] !== undefined ? PEAK[spec.id] : LIMITS.peakDb)) state.push("peak");

  const cues = (side.cues || []).filter((c) => c.t >= side.from + 0.13 && c.t <= side.to - 0.21);
  let ok = 0;
  let worst = 0;
  for (const c of cues) {
    const on = onsetNear(x, sr, rel(c.t), { band: c.band || null });
    if (on && Math.abs(on.lagMs) <= cueLimit(c)) ok += 1;
    if (on && !c.soft && !c.band && Math.abs(on.lagMs) > Math.abs(worst)) worst = on.lagMs;
  }
  cuesTotal += cues.length;
  cuesOk += ok;
  if (Math.abs(worst) > Math.abs(worstAll)) worstAll = worst;
  if (ok < cues.length) state.push(`${cues.length - ok} cue(s) off`);

  const leads = (side.leads || []).filter((n) => n.t >= side.from && n.t + n.dur <= side.to && n.dur >= 0.1 && !n.free);
  let worstCents = 0;
  let off = 0;
  for (const n of leads) {
    const r = pitchNear(x, sr, rel(n.t) + Math.min(0.04, n.dur * 0.25), rel(n.t) + Math.min(n.dur, 0.34), hz(n.midi));
    if (Math.abs(r.cents) > Math.abs(worstCents)) worstCents = r.cents;
    if (Math.abs(r.cents) > Math.max(LIMITS.cents, r.resolutionCents, n.tol || 0)) off += 1;
  }
  if (off) state.push(`${off} lead note(s) out of tune`);
  if (state.length) failures += 1;
  console.log(
    `${spec.id.padEnd(11)} ${fmt(loud.integrated).padStart(5)}  ${target === undefined ? "     " : String(target).padStart(5)}  ${fmt(peak).padStart(6)}   ${`${ok}/${cues.length}`.padStart(5)}     ${`${worst >= 0 ? "+" : ""}${fmt(worst)} ms`.padStart(9)}       ${String(leads.length).padStart(6)}      ${`${worstCents >= 0 ? "+" : ""}${fmt(worstCents)}`.padStart(7)}     ${state.length ? state.join(", ") : "ok"}`,
  );
  for (const f of [out, out.replace(/\.wav$/, ".json")]) fs.rmSync(f, { force: true });
}
console.log(`\n${cuesOk} of ${cuesTotal} declared cues begin within their limit; worst hard cue ${worstAll >= 0 ? "+" : ""}${fmt(worstAll)} ms.`);
console.log(failures ? `${failures} part(s) need attention.` : "Every part is within tolerance.");
process.exit(failures ? 1 : 0);
