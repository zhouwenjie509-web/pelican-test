#!/usr/bin/env node
// Is the finished MP4 the film? Checks the file against the frames and the WAV it was made from.
//
//   node tools/verify.mjs                          out/pelican-test.mp4 against frames/final and out/audio/pelican-test.wav
//   node tools/verify.mjs --mp4 x.mp4 --frames frames/film --audio y.wav --fps 60
//   node tools/verify.mjs --fresh 0                do not draw frames again in the browser (faster)
//
// What it checks, and how:
//   streams   ffprobe: one H.264 stream, 1920 x 1080, at --fps, with exactly the film's number of frames,
//             yuv420p, tagged as sRGB values on the BT.709 matrix; one AAC stereo stream at 48 kHz; both begin
//             at 0 and run the film's length
//   sound     the file's audio is decoded and laid over the WAV at a film time in every part: the offset that
//             fits best must be 0 samples and the likeness high; its loudness and peak are measured
//   picture   a frame of every part is decoded and compared with its source frame and with the source frames
//             just before and after it: the right frame must be the best fit (a film one frame out fails here)
//   current   --fresh N (default 12): N frames are drawn again by the code as it now stands and must be
//             byte-identical to the frame folder, so the folder is what the code produces
//
// It cannot see or hear the film. That it plays on your screen and loudspeakers is yours to check.

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { startServer, PROJECT_ROOT } from "./lib/server.mjs";
import { launchBrowser } from "./lib/browser.mjs";
import { parseArgs, openFilm, grabFrame } from "./lib/film.mjs";
import { readWav, toMono, dbfs, loudness } from "./lib/sound.mjs";
import * as TL from "../src/beat/timeline.js";

const args = parseArgs(process.argv.slice(2));
const mp4 = path.resolve(PROJECT_ROOT, String(args.mp4 || "out/pelican-test.mp4"));
const framesDir = path.resolve(PROJECT_ROOT, String(args.frames || "frames/final"));
const wav = path.resolve(PROJECT_ROOT, String(args.audio || "out/audio/pelican-test.wav"));
const fps = Number(args.fps || 60);
const fresh = args.fresh === undefined ? 12 : Number(args.fresh);
const rel = (f) => path.relative(PROJECT_ROOT, f);
const run = (cmd, a) => spawnSync(cmd, a, { encoding: "utf8", maxBuffer: 1 << 28 });

let failures = 0;
const notes = [];
function check(ok, text) {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${text}`);
  if (!ok) failures += 1;
}

for (const f of [mp4, wav]) {
  if (!fs.existsSync(f)) {
    console.error(`${rel(f)} not found.`);
    process.exit(1);
  }
}
if (!fs.existsSync(framesDir)) {
  console.error(`${rel(framesDir)} not found (--frames).`);
  process.exit(1);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pelican-verify-"));
const total = Math.round(TL.DURATION * fps);
const frameFile = (n) => path.join(framesDir, `f_${String(n).padStart(6, "0")}.png`);

// One film time in every part where the picture moves and something sounds: a second into each.
const parts = [{ name: "intro", t: 4.2 }];
for (let n = 1; n <= TL.N_SECTIONS; n += 1) parts.push({ name: `section ${n}`, t: TL.sectionStart(n) + 1.0 });
parts.push({ name: "outro, wide", t: TL.T_OUTRO_START + 1.0 }, { name: "outro, push", t: TL.T_OUTRO_START + 5.0 }, { name: "outro, end", t: TL.T_OUTRO_START + 10.4 });

try {
  // ------------------------------------------------------------------ streams
  console.log(`${rel(mp4)}  (${(fs.statSync(mp4).size / 1e6).toFixed(1)} MB)`);
  console.log("\nStreams");
  const probe = JSON.parse(run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-count_frames", "-of", "json", mp4]).stdout || "{}");
  const streams = probe.streams || [];
  const v = streams.filter((s) => s.codec_type === "video");
  const a = streams.filter((s) => s.codec_type === "audio");
  check(v.length === 1 && a.length === 1 && streams.length === 2, `one video and one audio stream (found ${v.length} and ${a.length}, ${streams.length} in all)`);
  if (v[0]) {
    const s = v[0];
    check(s.codec_name === "h264" && s.width === 1920 && s.height === 1080, `picture: ${s.codec_name}, ${s.width} x ${s.height}, ${s.profile || "?"} profile`);
    check(s.r_frame_rate === `${fps}/1` && s.avg_frame_rate === `${fps}/1`, `frame rate ${s.r_frame_rate} (average ${s.avg_frame_rate}); wanted ${fps}/1`);
    check(Number(s.nb_read_frames) === total, `${s.nb_read_frames} frames; the film has ${total} at ${fps} a second`);
    // the frames are sRGB pictures: BT.709 primaries, the sRGB transfer curve, stored on the BT.709 matrix in limited range
    check(s.pix_fmt === "yuv420p" && s.color_space === "bt709" && s.color_transfer === "iec61966-2-1" && s.color_primaries === "bt709" && s.color_range === "tv", `colour: ${s.pix_fmt}, matrix ${s.color_space}, transfer ${s.color_transfer}, primaries ${s.color_primaries}, range ${s.color_range} (wanted bt709, iec61966-2-1 which is sRGB, bt709, tv)`);
    check(Math.abs(Number(s.start_time)) < 1e-6 && Math.abs(Number(s.duration) - TL.DURATION) < 1 / fps + 1e-6, `picture begins at ${Number(s.start_time).toFixed(6)} s and lasts ${Number(s.duration).toFixed(6)} s`);
  }
  if (a[0]) {
    const s = a[0];
    check(s.codec_name === "aac" && Number(s.sample_rate) === 48000 && s.channels === 2, `sound: ${s.codec_name}, ${s.sample_rate} Hz, ${s.channels} channels, ${Math.round(Number(s.bit_rate) / 1000)} kb/s`);
    check(Math.abs(Number(s.start_time)) < 1e-6 && Math.abs(Number(s.duration) - TL.DURATION) < 0.03, `sound begins at ${Number(s.start_time).toFixed(6)} s and lasts ${Number(s.duration).toFixed(6)} s`);
  }
  check(Math.abs(Number(probe.format?.duration) - TL.DURATION) < 0.03, `the file lasts ${Number(probe.format?.duration).toFixed(3)} s; the film is ${TL.DURATION.toFixed(3)} s`);
  const head = fs.readFileSync(mp4).subarray(0, 4096).toString("latin1");
  check(head.includes("moov"), "the index is at the front of the file (it starts playing before it has all arrived)");

  // ------------------------------------------------------------------ sound
  console.log("\nSound, against the WAV");
  const decoded = path.join(tmp, "audio.wav");
  run("ffmpeg", ["-y", "-v", "error", "-i", mp4, "-vn", "-c:a", "pcm_s24le", decoded]);
  const x = toMono(readWav(decoded).channels);
  const ref = readWav(wav);
  const y = toMono(ref.channels);
  const sr = ref.sampleRate;
  check(Math.abs(x.length - y.length) <= 2048, `${x.length} samples decoded; the WAV has ${y.length} (${((x.length - y.length) / sr * 1000).toFixed(1)} ms apart)`);
  let worstLag = 0;
  let worstR = 1;
  let worstAt = "";
  let used = 0;
  const quiet = [];
  for (const part of parts) {
    const n = Math.round(0.5 * sr);
    const at = Math.round(part.t * sr);
    let ey = 0;
    for (let i = 0; i < n; i += 1) ey += y[at + i] * y[at + i];
    if (dbfs(Math.sqrt(ey / n)) < -55) {
      quiet.push(part.name);
      continue;
    }
    let best = { lag: 0, r: -2 };
    for (let lag = -1200; lag <= 1200; lag += 1) {
      let dot = 0;
      let ex = 0;
      for (let i = 0; i < n; i += 1) {
        const s = x[at + lag + i] || 0;
        dot += s * y[at + i];
        ex += s * s;
      }
      const r = dot / (Math.sqrt(ex * ey) || 1);
      if (r > best.r) best = { lag, r };
    }
    used += 1;
    if (Math.abs(best.lag) > Math.abs(worstLag)) worstLag = best.lag;
    if (best.r < worstR) {
      worstR = best.r;
      worstAt = `${part.name}, ${part.t.toFixed(1)} s`;
    }
  }
  check(used >= 20 && worstLag === 0, `offset that fits best at ${used} film times: worst ${worstLag} samples (${((worstLag / sr) * 1000).toFixed(2)} ms)`);
  check(worstR > 0.99, `likeness at offset 0: lowest ${worstR.toFixed(5)} (${worstAt}); 1 is identical, AAC is not lossless`);
  if (quiet.length) notes.push(`too quiet to compare the sound at: ${quiet.join(", ")}`);
  const lf = loudness(mp4);
  const lw = loudness(wav);
  check(Math.abs(lf.integrated - lw.integrated) <= 0.2 && lf.truePeak <= -1, `loudness ${lf.integrated} LUFS, true peak ${lf.truePeak} dBTP (the WAV: ${lw.integrated} LUFS, ${lw.truePeak} dBTP)`);

  // ------------------------------------------------------------------ picture
  console.log("\nPicture, against the frame folder");
  const psnr = (one, two) => {
    const r = run("ffmpeg", ["-hide_banner", "-nostats", "-i", one, "-i", two, "-filter_complex", "[0:v]format=rgb24[a];[1:v]format=rgb24[b];[a][b]psnr", "-f", "null", "-"]).stderr;
    const m = /average:([\d.]+|inf)/.exec(r);
    return m ? (m[1] === "inf" ? 99 : Number(m[1])) : NaN;
  };
  let low = { q: 99, name: "" };
  let wrong = 0;
  let still = 0;
  let missing = 0;
  for (const part of parts) {
    const n = Math.round(part.t * fps);
    if (![n - 1, n, n + 1].every((k) => fs.existsSync(frameFile(k)))) {
      missing += 1;
      continue;
    }
    // seek a second early (a quarter frame before that frame's time, so rounding cannot skip it), then count frames
    const back = Math.min(n, fps);
    const ss = Math.max(0, (n - back - 0.25) / fps);
    const got = path.join(tmp, `v_${n}.png`);
    run("ffmpeg", ["-y", "-v", "error", "-ss", ss.toFixed(6), "-i", mp4, "-vf", `select='eq(n\\,${back})',scale=in_color_matrix=bt709:in_range=tv:out_range=full,format=rgb24`, "-frames:v", "1", got]);
    if (!fs.existsSync(got)) {
      check(false, `${part.name}: frame ${n} could not be read from the file`);
      continue;
    }
    const q = [psnr(got, frameFile(n - 1)), psnr(got, frameFile(n)), psnr(got, frameFile(n + 1))];
    if (q[1] < low.q) low = { q: q[1], name: `${part.name}, frame ${n}` };
    if (Math.max(q[0], q[2]) > q[1] + 0.5) {
      wrong += 1;
      check(false, `${part.name}: frame ${n} of the file fits source frame ${q[0] > q[2] ? n - 1 : n + 1} better (${q.map((d) => d.toFixed(1)).join(" / ")} dB for the frames before / at / after)`);
    } else if (q[1] - Math.max(q[0], q[2]) < 0.5) still += 1;
  }
  const looked = parts.length - missing;
  check(looked > 0 && wrong === 0, `${looked - wrong} of ${looked} frames (one in every part) fit their own source frame best; the poorest likeness is ${low.q.toFixed(1)} dB (${low.name})`);
  check(low.q >= 26, `no frame is below 26 dB (a wrong picture reads under 20; grainy paper compresses to about 29)`);
  if (still) notes.push(`${still} of those frames stand so still that the frames before and after fit as well: they cannot show a one-frame slip`);
  if (missing) notes.push(`${missing} part(s) not compared: their frames are not in ${rel(framesDir)}`);

  // ------------------------------------------------------------------ current
  if (fresh > 0) {
    console.log("\nThe frame folder, against the code as it now stands");
    const srv = await startServer();
    const browser = await launchBrowser({ width: 1920, height: 1080 });
    let same = 0;
    const differ = [];
    let n0 = 0;
    try {
      const page = await openFilm(browser, srv.url, { width: 1920 });
      for (let i = 0; i < fresh; i += 1) {
        const n = Math.min(total - 1, Math.round(((i + 0.5) / fresh) * total));
        if (!fs.existsSync(frameFile(n))) continue;
        n0 += 1;
        const file = path.join(tmp, `c_${n}.png`);
        await grabFrame(page, n / fps, file);
        const h = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
        if (h(file) === h(frameFile(n))) same += 1;
        else differ.push(`${n} (${(n / fps).toFixed(3)} s)`);
      }
    } finally {
      await browser.close();
      await srv.close();
    }
    check(n0 > 0 && same === n0, `${same} of ${n0} frames drawn again are byte-identical to ${rel(framesDir)}${differ.length ? `; different: ${differ.join(", ")}` : ""}`);
  } else {
    notes.push("frames were not drawn again (--fresh 0): whether the frame folder is current was not checked");
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (notes.length) console.log(`\nNot checked, or of limited worth:\n${notes.map((n) => `  - ${n}`).join("\n")}`);
console.log(failures ? `\n${failures} check(s) FAILED.` : "\nEvery check passed. Nobody has watched or listened: that is yours.");
process.exit(failures ? 1 : 0);
