#!/usr/bin/env node
// Turn a folder of frames (and optionally a WAV) into an MP4 with ffmpeg.
//
//   node tools/encode.mjs --frames frames/film --fps 60 --out out/pelican-test.mp4 [--audio out/audio/pelican-test.wav]
//
//   node tools/encode.mjs --frames frames/film --fps 60 --from 28 --to 36 --out out/s05.mp4     a stretch of it
//
// Options: --crf (default 16), --preset (default slow), --from / --to (seconds; default the whole folder),
//          --start (first frame number; detected if omitted), --aac at|native (the AAC encoder; default: Apple's
//          where this ffmpeg has it, because it smears far less sound ahead of a sharp attack, else ffmpeg's own)
//
// The picture is tagged as what it is: sRGB values (primaries BT.709, transfer sRGB, matrix BT.709, limited range),
// so that a colour-managed player shows the same light as the preview page. There is a key frame every two
// seconds (at 0, 2, 4 ... s: the third beat of every bar), so a player can jump to any bar's middle.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PROJECT_ROOT } from "./lib/server.mjs";
import { parseArgs } from "./lib/film.mjs";

const args = parseArgs(process.argv.slice(2));
const framesDir = path.resolve(PROJECT_ROOT, args.frames || "frames/film");
const fps = String(args.fps || 30);
const out = path.resolve(PROJECT_ROOT, args.out || "out/pelican-test.mp4");
const crf = String(args.crf || 16);
const preset = String(args.preset || "slow");
// sRGB transfer, by its name in ffmpeg
const TRC = "iec61966-2-1";
// Apple's AAC encoder where ffmpeg has it (macOS builds), else ffmpeg's own
const encoders = spawnSync("ffmpeg", ["-hide_banner", "-encoders"], { encoding: "utf8" }).stdout || "";
const aac = args.aac === "native" ? "aac" : /\baac_at\b/.test(encoders) ? "aac_at" : "aac";
if (args.aac === "at" && aac !== "aac_at") {
  console.error("This ffmpeg has no aac_at encoder (it is part of macOS builds). Leave --aac out to use ffmpeg's own.");
  process.exit(1);
}

const files = fs.readdirSync(framesDir).filter((f) => /^f_\d{6}\.(png|jpg)$/.test(f)).sort();
if (!files.length) {
  console.error(`No frames found in ${framesDir}`);
  process.exit(1);
}
const ext = path.extname(files[0]).slice(1);
const have = new Set(files.map((f) => Number(f.slice(2, 8))));
let start = args.start !== undefined ? Number(args.start) : Number(files[0].slice(2, 8));
let last = Number(files[files.length - 1].slice(2, 8));
if (args.from !== undefined) start = Math.max(start, Math.round(Number(args.from) * Number(fps)));
if (args.to !== undefined) last = Math.min(last, Math.ceil(Number(args.to) * Number(fps) - 1e-6) - 1);
const count = last - start + 1;
const missing = [];
for (let i = start; i <= last; i += 1) if (!have.has(i)) missing.push(i);
if (count <= 0 || missing.length) {
  console.error(count <= 0 ? "Nothing to encode: check --from and --to." : `Frames missing in ${start}..${last}: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? " …" : ""}. Render them first.`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(out), { recursive: true });
const cmd = ["-y", "-hide_banner", "-loglevel", "error", "-framerate", fps, "-start_number", String(start), "-i", path.join(framesDir, `f_%06d.${ext}`)];
// a stretch that starts late needs the soundtrack from the same moment
if (args.audio) cmd.push("-ss", (start / Number(fps)).toFixed(6), "-i", path.resolve(PROJECT_ROOT, args.audio));
cmd.push(
  "-frames:v",
  String(count),
  // frames are full-range sRGB; write limited-range video on the BT.709 matrix, and say so on every frame
  // (ffmpeg takes the stream's colour tags from the frames, and a PNG carries none)
  "-vf",
  `scale=in_range=full:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p,setparams=color_primaries=bt709:color_trc=${TRC}:colorspace=bt709:range=tv`,
  "-c:v",
  "libx264",
  "-preset",
  preset,
  "-crf",
  crf,
  "-profile:v",
  "high",
  // a key frame every two seconds (one bar), and none moved off the grid by a scene cut
  "-g",
  String(Math.round(2 * Number(fps))),
  "-keyint_min",
  String(Math.round(2 * Number(fps))),
  "-sc_threshold",
  "0",
  "-colorspace",
  "bt709",
  "-color_primaries",
  "bt709",
  "-color_trc",
  TRC,
  "-color_range",
  "tv",
  "-x264-params",
  `colorprim=bt709:transfer=${TRC}:colormatrix=bt709:range=tv`,
  "-movflags",
  "+faststart",
);
if (args.audio) {
  if (aac === "aac_at") cmd.push("-c:a", "aac_at", "-aac_at_mode", "cvbr", "-b:a", "320k", "-ar", "48000");
  else cmd.push("-c:a", "aac", "-b:a", "320k", "-ar", "48000");
  // the sound is cut to the picture's length: an AAC stream ends on a whole packet, a little past the film
  cmd.push("-t", (count / Number(fps)).toFixed(6));
}
cmd.push(out);

console.log(`ffmpeg: ${count} frames at ${fps} fps -> ${path.relative(PROJECT_ROOT, out)}${args.audio ? ` (sound: ${aac === "aac_at" ? "Apple's AAC encoder" : "ffmpeg's AAC encoder"}, 320 kb/s)` : ""}`);
const res = spawnSync("ffmpeg", cmd, { stdio: "inherit" });
if (res.status !== 0) process.exit(res.status || 1);
const size = fs.statSync(out).size;
console.log(`Wrote ${path.relative(PROJECT_ROOT, out)} (${(size / 1e6).toFixed(1)} MB)`);
