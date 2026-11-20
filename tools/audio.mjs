#!/usr/bin/env node
// The soundtrack, rendered offline (OfflineAudioContext in headless Chrome) to a WAV file.
//
//   node tools/audio.mjs                          the whole film -> out/audio/pelican-test.wav
//   node tools/audio.mjs --section 7              section 7 alone, from 1 s before it to 2 s after -> out/audio/s07.wav
//   node tools/audio.mjs --section 7 --with bike  the same with other parts added (ids, comma separated)
//   node tools/audio.mjs --part intro             a part by id (intro, outro, bike, or a section's id)
//   node tools/audio.mjs --from 46 --to 56        every part, a stretch of the film -> out/audio/t46-56.wav
//   node tools/audio.mjs --section 7 --check      render, then measure it and draw its spectrogram (out/audio/s07.png)
//   node tools/audio.mjs --print 7                list the part's events (no browser needed)
//   node tools/audio.mjs --list                   which parts are arranged, which are still stand-ins
//   node tools/audio.mjs --lint [7]               read the part files for things a part must not do
//
//   node tools/audio.mjs --section 7 --label drum --check   one instrument alone: only the events whose label
//                                                 (ev.label, or the instrument function's name) matches the pattern
//   node tools/audio.mjs --section 7 --from 49.5 --to 51 --pps 800 --check   a close look: 800 px per second
//
// Options: --out file.wav, --only id,id (parts to include), --from / --to (film seconds), --quiet,
//          --label pattern, --pps N (picture scale; the picture is drawn only with --check)
// Beside every WAV a .json is written with what was rendered, the declared cues and the lead notes.

import fs from "node:fs";
import path from "node:path";
import { startServer, PROJECT_ROOT } from "./lib/server.mjs";
import { launchBrowser, openPage } from "./lib/browser.mjs";
import { parseArgs } from "./lib/film.mjs";
import { checkRender } from "./lib/sound-check.mjs";

const args = parseArgs(process.argv.slice(2), { own: true });
if (args.help || args.h) {
  // the comment at the top of this file is the help
  const src = fs.readFileSync(new URL(import.meta.url), "utf8").split("\n");
  console.log(src.slice(1, src.findIndex((l, i) => i > 0 && !l.startsWith("//"))).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  process.exit(0);
}
const { loadSoundtrack, PARTS, partSpec } = await import("../audio/soundtrack.js");
const { noteName } = await import("../audio/engine/theory.js");
const TL = await import("../src/beat/timeline.js");

const partOf = (key) => {
  const spec = partSpec(key);
  if (!spec) {
    console.error(`No such part: ${key}. Parts: ${PARTS.map((p) => p.id).join(", ")}`);
    process.exit(1);
  }
  return spec;
};

// ---------------------------------------------------------------- listing (no browser)
if (args.list) {
  const track = await loadSoundtrack({ prepare: false });
  for (const spec of PARTS) {
    const part = track.parts.get(spec.id);
    const n = track.events.filter((e) => e.part.id === spec.id).length;
    const state = !part ? "BROKEN (does not load)" : part.standin ? "stand-in" : "arranged";
    console.log(`${String(spec.n).padStart(3)}  ${spec.id.padEnd(11)} ${state.padEnd(22)} ${String(n).padStart(5)} events`);
  }
  for (const e of track.errors) console.log(`error  ${e.part} (${e.where}): ${e.message}`);
  process.exit(track.errors.length ? 1 : 0);
}

// ---------------------------------------------------------------- lint (no browser)
// Things a part must not do, found by reading its source.
function lint(spec) {
  const file = path.join(PROJECT_ROOT, "audio", "parts", spec.file);
  const src = fs.readFileSync(file, "utf8");
  const rules = [
    [/Math\.random\s*\(/, "Math.random: use dsp.rng(seed), so the sound is the same on every run"],
    [/Date\.now\s*\(|new Date\s*\(|performance\.now\s*\(/, "a clock: sounds may depend only on the event's own time"],
    [/\.currentTime\b/, "currentTime: schedule from the `when` you are given, never from the context's clock"],
    [/new\s+(webkit)?AudioContext\s*\(/, "a live AudioContext: parts play into the Kit they are given (an OfflineAudioContext inside prepare() is allowed)"],
    [/\bfetch\s*\(|XMLHttpRequest|new\s+Audio\s*\(|<audio|decodeAudioData|\.(wav|mp3|ogg|flac|aiff?)["'`]/i, "an audio file or a download: every sound is synthesized here"],
    [/setTimeout\s*\(|setInterval\s*\(|requestAnimationFrame\s*\(/, "a timer: all timing is Web Audio scheduling"],
    [/createDynamicsCompressor/, "a DynamicsCompressorNode: it delays the sound by 6 ms; shape levels with gains and envelopes"],
    [/createScriptProcessor|audioWorklet/, "a script processor or worklet: use the Kit's nodes or computed buffers"],
  ];
  const found = [];
  src.split("\n").forEach((line, i) => {
    if (/^\s*(\/\/|\*)/.test(line)) return;
    for (const [re, why] of rules) if (re.test(line)) found.push(`${spec.file}:${i + 1}  ${why}\n      ${line.trim().slice(0, 140)}`);
  });
  return found;
}

if (args.lint !== undefined) {
  const specs = args.lint === true ? PARTS : [partOf(args.lint)];
  let n = 0;
  for (const spec of specs) for (const f of lint(spec)) {
    console.log(f);
    n += 1;
  }
  console.log(n ? `\n${n} thing(s) a part must not do.` : "Lint: nothing found.");
  process.exit(n ? 1 : 0);
}

if (args.print !== undefined) {
  const spec = partOf(args.print);
  const track = await loadSoundtrack({ only: [spec.id], prepare: false });
  for (const e of track.errors.filter((x) => x.part === spec.id)) console.log(`error (${e.where}): ${e.message}`);
  const part = track.parts.get(spec.id);
  console.log(`${spec.id}: ${track.events.length} events, ${track.cues.length} cues${part && part.standin ? " (stand-in)" : ""}`);
  console.log("   film s        u   dur  note        vel  what");
  for (const e of track.events) {
    const what = e.label || (e.play && e.play.name) || "";
    const note = e.midi === undefined ? "" : noteName(e.midi);
    console.log(
      `${e.t.toFixed(3).padStart(9)} ${e.u.toFixed(3).padStart(8)} ${(e.dur || 0).toFixed(2).padStart(5)}  ${note.padEnd(10)} ${e.vel === undefined ? "    " : e.vel.toFixed(2)}  ${what}${e.lead ? "  [lead]" : ""}${e.seekable ? "  [seekable]" : ""}`,
    );
  }
  if (track.cues.length) {
    console.log("cues:");
    for (const c of track.cues) console.log(`${c.t.toFixed(3).padStart(9)} ${c.u.toFixed(3).padStart(8)}  ${c.what}`);
  }
  process.exit(0);
}

// ---------------------------------------------------------------- what to render
let only = args.only ? String(args.only).split(",") : null;
let from = args.from !== undefined ? Number(args.from) : 0;
let to = args.to !== undefined ? Number(args.to) : TL.DURATION;
if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || from < 0) {
  console.error(`--from and --to must be film seconds with from < to (got "${args.from}" and "${args.to}").`);
  process.exit(1);
}
let name = "pelican-test";
let preroll = 0;
let focus = null; // { t0, t1 }: the stretch the measurements are about

const solo = args.section !== undefined ? partOf(args.section) : args.part !== undefined ? partOf(args.part) : null;
if (solo) {
  only = [solo.id, ...(args.with ? String(args.with).split(",") : [])];
  for (const id of only) partOf(id);
  const t0 = solo.id === "intro" || solo.id === "bike" ? 0 : solo.id === "outro" ? TL.T_OUTRO_START : TL.sectionStart(solo.n);
  const t1 = solo.id === "intro" ? TL.T_INTRO : solo.id === "bike" || solo.id === "outro" ? TL.DURATION : t0 + TL.T_SECTION;
  if (args.from === undefined) from = Math.max(0, t0 - 1);
  if (args.to === undefined) to = Math.min(TL.DURATION, t1 + 2);
  focus = { t0, t1 };
  name = solo.n >= 0 && solo.n <= 21 ? `s${String(solo.n).padStart(2, "0")}` : solo.id;
  if (args.with) name += `+${String(args.with).replace(/,/g, "+")}`;
} else if (args.from !== undefined || args.to !== undefined) {
  name = `t${from}-${to}`;
  preroll = Math.min(from, 8);
  focus = { t0: from, t1: to };
} else {
  focus = { t0: 0, t1: TL.DURATION };
}
focus = { t0: Math.max(focus.t0, from), t1: Math.min(focus.t1, to) };
// a close look that starts part-way through: render the eight seconds before it too and cut them
// off, so that sounds which began earlier are still ringing in the clip
if (args.from !== undefined) preroll = Math.min(from, 8);
if (solo && (args.from !== undefined || args.to !== undefined) && !args.out) name += `_${from}-${to}`;
if (args.label && !args.out) name += `_${String(args.label).replace(/[^A-Za-z0-9]+/g, "-")}`;
const out = path.resolve(PROJECT_ROOT, args.out || `out/audio/${name}.wav`);
fs.mkdirSync(path.dirname(out), { recursive: true });

// ---------------------------------------------------------------- render
const srv = await startServer();
const browser = await launchBrowser({ width: 640, height: 360 });
let info;
try {
  const page = await openPage(browser, `${srv.url}/audio/render.html`, { width: 640, height: 360 });
  await page.waitForFunction(() => window.__audio && window.__audio.ready === true, { timeout: 60000 });
  info = await page.evaluate((o) => window.__audio.render(o), { only, from, to, preroll, label: args.label ? String(args.label) : null });
  const fd = fs.openSync(out, "w");
  const CHUNK = 6 * 1024 * 1024;
  for (let at = 0; at < info.bytes; at += CHUNK) {
    const b64 = await page.evaluate((a, b) => window.__audio.pull(a, b), at, at + CHUNK);
    fs.writeSync(fd, Buffer.from(b64, "base64"));
  }
  fs.closeSync(fd);
} finally {
  await browser.close();
  await srv.close();
}

const side = { file: path.relative(PROJECT_ROOT, out), from, to, only, focus, label: args.label ? String(args.label) : null, ...info };
fs.writeFileSync(out.replace(/\.wav$/, ".json"), JSON.stringify(side, null, 1));
if (!args.quiet) {
  console.log(
    `Wrote ${path.relative(PROJECT_ROOT, out)}: film ${from.toFixed(2)}-${to.toFixed(2)} s (${info.seconds.toFixed(3)} s), ${only ? only.join(" + ") : "all parts"}, ${info.events} events, ` +
      `peak ${(20 * Math.log10(Math.max(info.peak, 1e-9))).toFixed(1)} dBFS; prepared in ${(info.prepareMs / 1000).toFixed(1)} s, rendered in ${(info.renderMs / 1000).toFixed(1)} s`,
  );
}
for (const e of info.errors) console.log(`ERROR in ${e.part} (${e.where}): ${e.message}`);

if (args.check) {
  const ok = checkRender(out, side, { quiet: Boolean(args.quiet), pps: args.pps ? Number(args.pps) : null });
  const lintFound = solo ? lint(solo) : [];
  if (lintFound.length) console.log(`\nLint:\n${lintFound.join("\n")}`);
  const own = info.prepareOwnMs === null || info.prepareOwnMs === undefined ? info.prepareMs : info.prepareOwnMs;
  const slow = solo && own > 600;
  if (slow) console.log(`\nSlow to prepare: ${(own / 1000).toFixed(2)} s (keep a part's prepare() under 0.4 s; the preview page prepares every part before it can play).`);
  if (solo) console.log(`Cost: ${info.events} events, ${info.sources} source nodes started, at most ${info.alive} alive at once (sounding or scheduled within two seconds; keep it under about 250), its own prepare() took ${(own / 1000).toFixed(2)} s.`);
  process.exit(ok && !info.errors.length && !lintFound.length ? 0 : 1);
}
process.exit(info.errors.length ? 1 : 0);
