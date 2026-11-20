#!/usr/bin/env node
// The finished film in one command: the timing rules, every frame, the soundtrack, the MP4, and a check of the result.
//
//   node tools/export.mjs                          -> out/pelican-test.mp4 (1920 x 1080, 60 frames a second)
//   node tools/export.mjs --fps 30 --out out/pelican-test_30.mp4
//   node tools/export.mjs --keep-frames            use the frames already in the frame folder (after a change to the sound only)
//   node tools/export.mjs --keep-audio             use the WAV already there (after a change to the picture only)
//
// Options: --fps (default 60), --frames (frame folder, default frames/final), --audio (the WAV, default
//          out/audio/pelican-test.wav), --out, --crf, --preset, --workers (passed on to the tools that take them)
//
// It runs, in order: tools/check.mjs, tools/render.mjs, tools/audio.mjs, tools/encode.mjs, tools/verify.mjs,
// and stops at the first one that fails. On the machine the film was made on, the whole of it takes about
// a quarter of an hour, most of it drawing the 8220 frames.

import path from "node:path";
import { spawnSync } from "node:child_process";
import { PROJECT_ROOT } from "./lib/server.mjs";
import { parseArgs } from "./lib/film.mjs";

const args = parseArgs(process.argv.slice(2));
const fps = String(args.fps || 60);
const frames = String(args.frames || "frames/final");
const audio = String(args.audio || "out/audio/pelican-test.wav");
const out = String(args.out || "out/pelican-test.mp4");
const tool = (name) => path.resolve(PROJECT_ROOT, "tools", name);
const pass = (...keys) => keys.flatMap((k) => (args[k] === undefined ? [] : [`--${k}`, String(args[k])]));

const steps = [
  { what: "The timing rules", cmd: [tool("check.mjs")] },
  args["keep-frames"] ? null : { what: `Every frame, at ${fps} a second`, cmd: [tool("render.mjs"), "--fps", fps, "--out", frames, ...pass("workers")] },
  args["keep-audio"] ? null : { what: "The soundtrack", cmd: [tool("audio.mjs"), "--out", audio] },
  { what: "The MP4", cmd: [tool("encode.mjs"), "--frames", frames, "--fps", fps, "--audio", audio, "--out", out, ...pass("crf", "preset")] },
  { what: "A check of the result", cmd: [tool("verify.mjs"), "--mp4", out, "--frames", frames, "--audio", audio, "--fps", fps] },
].filter(Boolean);

const started = Date.now();
for (const [i, step] of steps.entries()) {
  const t0 = Date.now();
  console.log(`\n[${i + 1}/${steps.length}] ${step.what}\n    node ${step.cmd.map((c) => (path.isAbsolute(c) ? path.relative(PROJECT_ROOT, c) : c)).join(" ")}`);
  const res = spawnSync(process.execPath, step.cmd, { cwd: PROJECT_ROOT, stdio: "inherit" });
  if (res.status !== 0) {
    console.error(`\nStopped: "${step.what}" failed (exit ${res.status}). Nothing after it was run.`);
    process.exit(res.status || 1);
  }
  console.log(`    done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
console.log(`\nThe film is at ${out} (${((Date.now() - started) / 60000).toFixed(1)} minutes).`);
