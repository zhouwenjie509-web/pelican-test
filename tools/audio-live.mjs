#!/usr/bin/env node
// Does the live preview play the same sound, at the same film times, as the offline render?
//
// Plays the preview page in real time in headless Chrome (picture and sound together, as a
// viewer would), records what the live Web Audio graph produces sample by sample, and lines
// it up against the offline WAV. Then it exercises the transport: pause and resume, a seek
// while playing, a seek while paused, several seeks in quick succession, playing again after
// the end, and a main thread held up for longer than the scheduler looks ahead.
//
//   node tools/audio-live.mjs                          the whole film against out/audio/pelican-test.wav
//   node tools/audio-live.mjs --from 100 --to 115      a stretch
//   node tools/audio-live.mjs --wav out/audio/x.wav --width 1280 --no-seek
//   node tools/audio-live.mjs --seek-from 100 --seek-to 109.3   the seek test at chosen film times
//   node tools/audio-live.mjs --only-transport         skip the straight run, do only the transport tests
//   node tools/audio-live.mjs --only-transport --self-test-skip   drop a block from a recording, to see the tool report it
//
// The offline file must be a render of the whole film (tools/audio.mjs with no options).
// Reported for every comparison:
//   - over one-second windows laid end to end, the lag of the live sound behind the offline
//     render (samples and milliseconds) and how alike the two are (correlation, 1 = identical);
//   - the largest difference between the two in any tenth of a second (a sound that came late,
//     or not at all, would show here at its own level, however quiet the window around it);
//   - where each declared cue (the bell on every crossing among them) begins in the live
//     recording, against its limit and against the same reading on the offline file.
//
// A long room's late tail is computed on a background thread in a live context; on a busy
// machine it can differ minutely for a moment (seen once: -92 dBFS in the vaporwave hall).
//
// One thing the sample-exact comparison cannot survive, and the tool says so when it meets it:
// when a pause lands while Chrome is serving the audio device (about one pause in fifty on the
// machine this was written on), the context's clock is advanced by a block or two (2.7 ms each)
// that are never rendered. Sounds ringing at that moment continue that much late against the
// clock until they die away; sounds that begin afterwards are on time. It cannot be heard.
//
// What this cannot see: the loudspeaker and the display. It proves that the live graph
// produces the film's sound at the film times its own clock intends, and that the picture
// is drawn for the moment it will be shown by that clock. Whether a real screen and real
// loudspeakers add delay of their own can only be measured in the room (see ?sync= in the README).

import fs from "node:fs";
import path from "node:path";
import { startServer, PROJECT_ROOT } from "./lib/server.mjs";
import { launchBrowser, openPage } from "./lib/browser.mjs";
import { parseArgs } from "./lib/film.mjs";
import { readWav, toMono, onsetNear, dbfs } from "./lib/sound.mjs";
import { cueLimit } from "./lib/sound-check.mjs";

const args = parseArgs(process.argv.slice(2));
const width = Number(args.width || 1920);
const from = Number(args.from || 0);
const to = Number(args.to || 137);
const wavFile = path.resolve(PROJECT_ROOT, args.wav || "out/audio/pelican-test.wav");
if (!fs.existsSync(wavFile)) {
  console.error(`${path.relative(PROJECT_ROOT, wavFile)} not found: run "node tools/audio.mjs" first.`);
  process.exit(1);
}
const ref = readWav(wavFile);
const refMono = toMono(ref.channels);
const sr = ref.sampleRate;
const sideFile = wavFile.replace(/\.wav$/, ".json");
const side = fs.existsSync(sideFile) ? JSON.parse(fs.readFileSync(sideFile, "utf8")) : { cues: [] };
/**
 * A difference between live and offline louder than this in any tenth of a second fails the
 * comparison. On a quiet machine the difference is about -144 dBFS (the 24-bit file's own
 * rounding); -80 leaves room for a long room's tail computed late on a busy machine (seen once
 * at -92) and is still 60 dB under the film's sound: no audible event can hide below it.
 */
const DIFF_LIMIT_DB = Number(args["diff-limit"] || -80);

/**
 * Lag (samples) of `live` behind `off` that makes them most alike, and the correlation there.
 * `off` is a window of the offline file; it is compared with live[at + lag ...].
 */
function align(off, live, at, maxLag) {
  let best = { lag: 0, r: -2 };
  let eo = 0;
  for (let i = 0; i < off.length; i += 1) eo += off[i] * off[i];
  for (let lag = -maxLag; lag <= maxLag; lag += 1) {
    let dot = 0;
    let el = 0;
    const base = at + lag;
    const i0 = Math.max(0, -base);
    const i1 = Math.min(off.length, live.length - base);
    for (let i = i0; i < i1; i += 1) {
      const v = live[base + i];
      dot += off[i] * v;
      el += v * v;
    }
    const r = dot / (Math.sqrt(eo * el) || 1);
    if (r > best.r) best = { lag, r };
  }
  return best;
}

let restamped = 0;
let skips = 0;
const srv = await startServer();
const browser = await launchBrowser({ width: 1920, height: 1200 });
let failed = 0;
try {
  const page = await openPage(browser, `${srv.url}/index.html?w=${width}`, { width: 1920, height: 1200 });
  await page.waitForFunction(() => !document.getElementById("controls").hidden, { timeout: 240000 });
  const hasSound = await page.evaluate(() => Boolean(window.__sound));
  if (!hasSound) throw new Error("the preview page has no soundtrack");
  await page.evaluate(() => window.__sound.transport.startTap());

  /** Play film time a..b in real time; optionally pause in the middle. Returns the picture/sound clock records. */
  const playSpan = (a, b, opts = {}) =>
    page.evaluate(
      async (t0, t1, o) => {
        const tr = window.__sound.transport;
        window.clock.pause();
        window.clock.seek(t0);
        window.clock.play();
        const rec = { frames: 0, worstClockGapMs: 0, sumGap: 0, started: performance.now(), drawMs: [], load: null };
        // how hard the audio thread is working (1 = all of real time), where the browser reports it
        const cap = tr.ac.renderCapacity;
        if (cap && typeof cap.start === "function") {
          rec.load = { average: 0, peak: 0, underrun: 0, samples: 0 };
          cap.onupdate = (e) => {
            rec.load.samples += 1;
            rec.load.average = Math.max(rec.load.average, e.averageLoad);
            rec.load.peak = Math.max(rec.load.peak, e.peakLoad);
            rec.load.underrun = Math.max(rec.load.underrun, e.underrunRatio);
          };
          cap.start({ updateInterval: 1 });
        }
        let paused = false;
        let seeked = false;
        let stalled = false;
        let ended = false;
        let resumedAt = 0;
        rec.sumAhead = 0;
        rec.refresh = 0;
        rec.drawnFrames = 0;
        await new Promise((resolve) => {
          function step() {
            const t = window.clock.time;
            const f = tr.lastFrame;
            if (tr.running && t > t0 + 0.3) rec.drawnFrames += 1;
            if (tr.running && f && f.drawn === t && !f.held) {
              // The frame is drawn for the moment it will be on the screen (`ahead` seconds from now).
              // By the audio clock the film time sounding then is heard + ahead: how far is the picture from it?
              const gap = Math.abs(f.drawn - (f.heard + f.ahead) + tr.pictureDelay) * 1000;
              if (t > t0 + 0.3) {
                rec.frames += 1;
                rec.sumGap += gap;
                rec.sumAhead += f.ahead;
                if (gap > rec.worstClockGapMs) rec.worstClockGapMs = gap;
              }
              if (resumedAt) {
                // how quickly the clock settles on the audio clock after a resume
                const age = performance.now() - resumedAt;
                if (age < 300) rec.resume.first300 = Math.max(rec.resume.first300, gap);
                else if (age < 900) rec.resume.after300 = Math.max(rec.resume.after300, gap);
              }
            }
            if (o.pauseAt !== undefined && !paused && t >= o.pauseAt) {
              paused = true;
              window.clock.pause();
              if (o.pausedSeekTo !== undefined) window.clock.seek(o.pausedSeekTo); // a seek while paused
              const held = window.clock.time;
              // what arrives while paused, counted from 150 ms in (the suspend needs a moment to reach the audio thread)
              setTimeout(() => {
                rec.pause = { blocksAt: tr.tap.blocks.length, ctxAt: tr.ac.currentTime };
              }, 150);
              setTimeout(() => {
                rec.pause.state = tr.ac.state;
                rec.pause.blocksDuring = tr.tap.blocks.length - rec.pause.blocksAt;
                rec.pause.ctxMoved = tr.ac.currentTime - rec.pause.ctxAt;
                rec.pause.clockMoved = window.clock.time - held;
                rec.resume = { first300: 0, after300: 0 };
                resumedAt = performance.now();
                window.clock.play();
                requestAnimationFrame(step);
              }, Math.max(400, o.pauseMs || 700));
              return;
            }
            if (o.seekAt !== undefined && !seeked && t >= o.seekAt) {
              seeked = true;
              const targets = Array.isArray(o.seekTo) ? o.seekTo : [o.seekTo];
              // several seeks in quick succession (a drag on the timeline): only the last may sound
              targets.forEach((target, i) => {
                if (i === 0) window.clock.seek(target);
                else setTimeout(() => window.clock.seek(target), i * (o.seekGapMs || 60));
              });
            }
            if (o.stallAt !== undefined && !stalled && t >= o.stallAt) {
              stalled = true;
              const until = performance.now() + o.stallMs; // hold the main thread: no timer, no frame
              while (performance.now() < until);
            }
            if (o.replayAfterMs !== undefined && !ended && !window.clock.playing) {
              // the film ran out by itself: press play again after a moment
              ended = true;
              setTimeout(() => {
                window.clock.play();
                requestAnimationFrame(step);
              }, o.replayAfterMs);
              return;
            }
            const done = o.replayAfterMs !== undefined ? ended && t >= o.replayUntil && t < o.replayUntil + 5 : t >= t1;
            if (done || (!window.clock.playing && o.replayAfterMs === undefined)) resolve();
            else requestAnimationFrame(step);
          }
          requestAnimationFrame(step);
        });
        rec.refresh = tr.refresh;
        window.clock.pause();
        if (cap && typeof cap.stop === "function") cap.stop();
        rec.seconds = (performance.now() - rec.started) / 1000;
        rec.meanClockGapMs = rec.frames ? rec.sumGap / rec.frames : 0;
        rec.meanAheadMs = rec.frames ? (rec.sumAhead / rec.frames) * 1000 : 0;
        rec.stats = { ...tr.stats };
        rec.log = tr.log.map((g) => ({ ...g }));
        rec.sampleRate = tr.ac.sampleRate;
        rec.outputLatency = tr.ac.outputLatency || 0;
        rec.baseLatency = tr.ac.baseLatency || 0;
        return rec;
      },
      a,
      b,
      opts,
    );

  /** Fetch the recorded blocks and clear them. Returns [{ frame, mono: Float32Array }]. */
  const pullBlocks = async () => {
    const count = await page.evaluate(() => window.__sound.transport.tap.blocks.length);
    const blocks = [];
    const STEP = 4000;
    for (let at = 0; at < count; at += STEP) {
      const part = await page.evaluate(
        (a, b) => {
          const list = window.__sound.transport.tap.blocks.slice(a, b);
          const n = list.reduce((s, x) => s + x.mono.length, 0);
          const all = new Float32Array(n);
          const frames = [];
          let o = 0;
          for (const x of list) {
            all.set(x.mono, o);
            frames.push([x.frame, x.mono.length, x.stamp]);
            o += x.mono.length;
          }
          const bytes = new Uint8Array(all.buffer);
          let s = "";
          for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
          return { frames, b64: btoa(s) };
        },
        at,
        at + STEP,
      );
      const buf = Buffer.from(part.b64, "base64");
      const all = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
      let o = 0;
      for (const [frame, len, stamp] of part.frames) {
        blocks.push({ frame, stamp, mono: all.subarray(o, o + len) });
        o += len;
      }
    }
    await page.evaluate(() => {
      window.__sound.transport.tap.blocks.length = 0;
    });
    // The worklet counts frames itself; the browser's own stamp is sometimes stale for a few
    // blocks. Count how often the two differed (it is harmless as long as they meet again).
    for (const blk of blocks) if (blk.stamp !== undefined && blk.stamp !== blk.frame) restamped += 1;
    return blocks;
  };

  /**
   * What a seek to film time `landing` must sound like until `end`: an offline render that begins
   * there (sounds that began earlier are missing unless they are seekable), laid on the film's
   * own grid of 128-sample blocks as the live transport lays it. Returns { mono, start (film s) }.
   */
  const landingRef = async (landing, end) => {
    const got = await page.evaluate(
      async (t, e) => {
        const { renderOffline } = await import("/audio/engine/offline.js");
        const rate = 48000;
        const start = (Math.floor((t * rate) / 128) * 128) / rate;
        const r = await renderOffline(window.__sound.track, { from: start, to: e, begin: t });
        if (r.errors.length) return { error: r.errors.map((x) => `${x.part} ${x.where}: ${x.message}`).join("; ") };
        const l = r.buffer.getChannelData(0);
        const rr = r.buffer.getChannelData(1);
        const mono = new Float32Array(l.length);
        for (let i = 0; i < l.length; i += 1) mono[i] = 0.5 * (l[i] + rr[i]);
        const bytes = new Uint8Array(mono.buffer);
        let str = "";
        for (let i = 0; i < bytes.length; i += 0x8000) str += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return { start, b64: btoa(str) };
      },
      landing,
      end,
    );
    if (got.error) throw new Error(`offline render from ${landing} s failed: ${got.error}`);
    const buf = Buffer.from(got.b64, "base64");
    return { mono: new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4), start: got.start };
  };
  const wholeFilm = { mono: refMono, start: 0 };

  /**
   * Compare the recording with the reference (the offline file, or a landingRef) over film time
   * a..b, for the generation that began at `gen`.
   */
  const compare = (blocks, gen, a, b, label, reference = wholeFilm) => {
    const R = reference.mono;
    const r0 = Math.round(reference.start * sr); // R[i] is film sample r0 + i
    // lay the recording out on the film's time line: film time of context frame f is f / sr - T0
    const start = Math.round(a * sr);
    const n = Math.round((b - a) * sr);
    const live = new Float32Array(n);
    const have = new Uint8Array(n);
    for (const blk of blocks) {
      const at = Math.round((blk.frame / sr - gen.T0) * sr) - start;
      for (let i = 0; i < blk.mono.length; i += 1) {
        const j = at + i;
        if (j >= 0 && j < n) {
          live[j] = blk.mono[i];
          have[j] = 1;
        }
      }
    }
    let missing = 0;
    const gaps = [];
    for (let i = 0; i < n; i += 1) {
      if (!have[i]) {
        missing += 1;
        if (!gaps.length || gaps[gaps.length - 1][1] !== i - 1) gaps.push([i, i]);
        else gaps[gaps.length - 1][1] = i;
      }
    }
    if (args.debug) {
      let odd = 0;
      for (let i = 1; i < blocks.length; i += 1) {
        const step = blocks[i].frame - blocks[i - 1].frame;
        if (step !== blocks[i - 1].mono.length && odd < 12) {
          odd += 1;
          console.log(`      block ${i}: frame ${blocks[i - 1].frame} (+${blocks[i - 1].mono.length}) is followed by frame ${blocks[i].frame} (step ${step}); film ${(blocks[i - 1].frame / sr - gen.T0).toFixed(4)} s`);
        }
      }
      for (const [g0, g1] of gaps.slice(0, 20)) console.log(`      not recorded: film ${(a + g0 / sr).toFixed(4)}-${(a + (g1 + 1) / sr).toFixed(4)} s (${g1 - g0 + 1} samples)`);
      // where do the two differ most?
      let worst = 0;
      let at = 0;
      for (let i = 0; i < n; i += 1) {
        const d = Math.abs(live[i] - R[start - r0 + i]);
        if (d > worst) {
          worst = d;
          at = i;
        }
      }
      console.log(`      largest difference ${worst.toFixed(4)} at film ${(a + at / sr).toFixed(4)} s (offline ${R[start - r0 + at].toFixed(4)}, live ${live[at].toFixed(4)})`);
    }
    const WIN = sr; // one-second windows, end to end
    const MAX_LAG = 240; // look 5 ms either way
    let worstLag = 0;
    let worstR = 1;
    let windows = 0;
    const rows = [];
    for (let w = 0; w + WIN <= n; w += WIN) {
      const off = R.subarray(start - r0 + w, start - r0 + w + WIN);
      let energy = 0;
      for (let i = 0; i < off.length; i += 1) energy += off[i] * off[i];
      if (energy / WIN < 1e-9) continue; // silence in the film: nothing to line up
      const { lag, r } = align(off, live, w, MAX_LAG);
      rows.push({ t: a + w / sr, lag, r });
      windows += 1;
      if (Math.abs(lag) > Math.abs(worstLag)) worstLag = lag;
      if (r < worstR) worstR = r;
    }
    const bad = rows.filter((x) => Math.abs(x.lag) > 48 || x.r < 0.98); // more than 1 ms apart, or not the same sound
    console.log(`${label}: ${windows} windows of 1 s, worst lag ${worstLag} samples (${((worstLag / sr) * 1000).toFixed(3)} ms), lowest correlation ${worstR.toFixed(5)}, ${missing} samples not recorded${bad.length ? `  <- ${bad.length} window(s) off` : ""}`);
    for (const x of bad.slice(0, 12)) console.log(`      film ${x.t.toFixed(1)} s: lag ${x.lag} samples (${((x.lag / sr) * 1000).toFixed(2)} ms), correlation ${x.r.toFixed(4)}`);
    if (!bad.length && rows.length > 3) {
      const low = [...rows].sort((p, q) => p.r - q.r).slice(0, 3);
      console.log(`      least alike: ${low.map((x) => `film ${x.t.toFixed(1)} s (${x.r.toFixed(5)})`).join(", ")}`);
    }
    // A hole of a block or two in the recording is the audio clock itself: when a pause lands
    // while Chrome is serving the audio device, the context's clock is advanced for the rest of
    // that callback although the graph is no longer rendered. The sounds ringing at that moment
    // then continue that much late against the clock until they die away (sounds that begin
    // afterwards are on time). Nothing can be heard of it, but the sample-exact comparison
    // cannot hold for such a stretch: it is reported and its cues are still judged.
    const skipped = missing > 0 && gaps.every(([g0, g1]) => g1 - g0 + 1 <= 4 * 128);
    if (skipped) {
      skips += gaps.length;
      console.log(`      ${gaps.map(([g0, g1]) => `${g1 - g0 + 1} samples at film ${(a + g0 / sr).toFixed(3)} s`).join(", ")}: counted by the browser's audio clock but never rendered (a pause that landed while the audio device was being served). Sounds ringing then are that much late against the clock until they die away; the differences below are reported, not judged.`);
    } else if (missing) {
      console.log(`      ${missing} samples of this stretch were not recorded  <- the comparison is incomplete`);
      failed += 1;
    }
    if (bad.length && !skipped) failed += 1;

    // The difference itself, sample against sample at lag 0, in tenths of a second. A sound that
    // came late or was left out shows here at its own level, even in a window full of other sound.
    const TENTH = Math.round(sr / 10);
    let worstDiff = { db: -Infinity, at: 0, film: -Infinity };
    const tenths = [];
    for (let w = 0; w + TENTH <= n; w += TENTH) {
      let d2 = 0;
      let o2 = 0;
      let all = true;
      for (let i = w; i < w + TENTH; i += 1) {
        if (!have[i]) {
          all = false;
          break;
        }
        const d = live[i] - R[start - r0 + i];
        d2 += d * d;
        o2 += R[start - r0 + i] * R[start - r0 + i];
      }
      if (!all) continue;
      const db = dbfs(Math.sqrt(d2 / TENTH));
      tenths.push({ db, at: a + w / sr });
      if (db > worstDiff.db) worstDiff = { db, at: a + w / sr, film: dbfs(Math.sqrt(o2 / TENTH)) };
    }
    if (args.debug) console.log(`      difference by tenths of a second, dBFS: ${tenths.map((x) => `${x.at.toFixed(1)}:${Number.isFinite(x.db) ? x.db.toFixed(0) : "none"}`).join(" ")}`);
    const diffBad = worstDiff.db > DIFF_LIMIT_DB && !skipped;
    console.log(`      largest difference in any tenth of a second: ${Number.isFinite(worstDiff.db) ? `${worstDiff.db.toFixed(1)} dBFS at film ${worstDiff.at.toFixed(1)} s (the film's sound there: ${worstDiff.film.toFixed(1)} dBFS)` : "none at all"}${diffBad ? `  <- above the limit of ${DIFF_LIMIT_DB} dBFS` : ""}`);
    if (diffBad) failed += 1;

    // Where each declared cue begins in the live recording: against its limit, and against the
    // same detector's reading on the offline file (the detector reads the end of its 5 ms window,
    // so about 1 ms late on a sharp sound and more on a slow one, never early: see the guide).
    const cues = (side.cues || []).filter((c) => c.t >= a + 0.13 && c.t <= b - 0.21 && c.t >= 0.13);
    if (cues.length) {
      let within = 0;
      let unread = 0;
      let worstHard = 0;
      let worstApart = 0;
      const off = [];
      for (const c of cues) {
        const opt = { band: c.band || null };
        const onLive = onsetNear(live, sr, c.t - a, opt);
        const onOff = onsetNear(R, sr, c.t - reference.start, opt);
        if (!onLive || !onOff) {
          // not measurable in the full mix (another sound is louder at that moment); it must then be so in both
          unread += 1;
          if (Boolean(onLive) !== Boolean(onOff)) off.push(`      ${c.t.toFixed(3)} s ${c.part}: readable ${onLive ? "live" : "offline"} only   ${c.what}`);
          continue;
        }
        const apart = Math.abs(onLive.lagMs - onOff.lagMs);
        if (apart > worstApart) worstApart = apart;
        if (!c.soft && Math.abs(onLive.lagMs) > Math.abs(worstHard)) worstHard = onLive.lagMs;
        if (Math.abs(onLive.lagMs) <= cueLimit(c)) within += 1;
        else off.push(`      ${c.t.toFixed(3)} s ${c.part}: ${onLive.lagMs >= 0 ? "+" : ""}${onLive.lagMs.toFixed(1)} ms live (limit ${cueLimit(c)}; offline ${onOff.lagMs >= 0 ? "+" : ""}${onOff.lagMs.toFixed(1)})   ${c.what}`);
        if (apart > (skipped ? 6 : 1)) off.push(`      ${c.t.toFixed(3)} s ${c.part}: live and offline ${apart.toFixed(1)} ms apart   ${c.what}`);
      }
      const bells = cues.filter((c) => c.part === "bike");
      const bellLags = bells.map((c) => onsetNear(live, sr, c.t - a, { band: c.band || [1800, 9000] })).filter(Boolean).map((o) => o.lagMs);
      console.log(`      cues in the live recording: ${within} of ${cues.length - unread} readable ones begin within their limit (worst hard cue ${worstHard >= 0 ? "+" : ""}${worstHard.toFixed(1)} ms by the detector), none more than ${worstApart.toFixed(2)} ms from its offline reading${unread ? `; ${unread} cannot be read in the full mix` : ""}${bellLags.length ? `; ${bellLags.length} bells, ${Math.min(...bellLags).toFixed(1)} to ${Math.max(...bellLags).toFixed(1)} ms` : ""}`);
      for (const l of off.slice(0, 12)) console.log(l);
      if (off.length) failed += 1;
    }
    return rows;
  };

  const report = (rec) => {
    console.log(`  played ${rec.seconds.toFixed(1)} s of wall time, ${rec.drawnFrames} picture frames; context ${rec.sampleRate} Hz, output latency ${(rec.outputLatency * 1000).toFixed(1)} ms, base latency ${(rec.baseLatency * 1000).toFixed(1)} ms`);
    console.log(`  each frame is drawn for the moment it can first be on the screen: one refresh of this display after the frame begins (${(rec.refresh * 1000).toFixed(1)} ms; measured at ${(1 / rec.refresh).toFixed(1)} Hz)`);
    console.log(`  the picture clock's smoothing (how far the clock that is drawn strays from its own reading of the audio clock): mean ${rec.meanClockGapMs.toFixed(2)} ms, worst ${rec.worstClockGapMs.toFixed(2)} ms. This is not a measurement of picture against sound: that needs a camera and a microphone.`);
    console.log(`  scheduler ticks that found an event already due: ${rec.stats.late}`);
  };
  /**
   * Play a span with something done to the transport in the middle, and compare what the last
   * generation played with what it must be: the offline file if nothing was skipped (a pause),
   * otherwise an offline render that begins where that generation began (a seek, a fresh start).
   */
  const scenario = async (label, a, b, opts, { landing = false, expectResync = false, generations = null, landsAt = null } = {}) => {
    const before = await page.evaluate(() => ({ ...window.__sound.transport.stats, logged: window.__sound.transport.log.length }));
    const r = await playSpan(a, b, opts);
    const blk = await pullBlocks();
    const g = r.log[r.log.length - 1];
    if (args["self-test-skip"] && r.pause) {
      // exercise the reporting of a skipped block: drop one block of the recording after the pause
      const i = blk.findIndex((x) => x.frame / sr - g.T0 > a + 4);
      if (i > 0) blk.splice(i, 1);
    }
    const late = r.stats.late - before.late;
    const resyncs = r.stats.resyncs - before.resyncs;
    const begun = r.log.length - before.logged;
    if (expectResync) {
      const ok = resyncs === 1 && g.resync;
      console.log(`${label}: the scheduler found itself behind ${late} time(s) and started afresh ${resyncs} time(s), at film ${g.film.toFixed(2)} s${ok ? "" : "  <- expected exactly one fresh start"}`);
      if (!ok) failed += 1;
    } else if (late || resyncs) {
      console.log(`${label}: ${late} scheduler tick(s) found an event already due  <- none expected`);
      failed += 1;
    }
    if (generations !== null && begun !== generations) {
      console.log(`${label}: ${begun} generations of sound were begun  <- expected ${generations}`);
      failed += 1;
    }
    if (landsAt !== null && !(Math.abs(g.film - landsAt[0]) <= landsAt[1])) {
      console.log(`${label}: the sound began again at film ${g.film.toFixed(4)} s  <- expected ${landsAt[0]} s`);
      failed += 1;
    }
    if (r.pause) {
      const quiet = r.pause.state === "suspended" && r.pause.blocksDuring === 0 && Math.abs(r.pause.ctxMoved) < 1e-9 && r.pause.clockMoved === 0;
      console.log(`${label}: while paused the audio context was ${r.pause.state}, ${r.pause.blocksDuring} blocks of sound arrived, its clock moved ${(r.pause.ctxMoved * 1000).toFixed(3)} ms and the picture's ${(r.pause.clockMoved * 1000).toFixed(3)} ms${quiet ? "" : "  <- a pause must be silent and still"}`);
      if (!quiet) failed += 1;
      console.log(`      after the resume the picture clock was within ${r.resume.first300.toFixed(1)} ms of its audio reading in the first 0.3 s and within ${r.resume.after300.toFixed(1)} ms after that`);
    }
    if (landing) compare(blk.filter((x) => x.frame / sr >= g.ctx), g, g.film + 0.01, b - 0.1, `${label}: from film ${g.film.toFixed(2)} s on, against an offline render begun there`, await landingRef(g.film, b));
    else compare(blk, g, a + 0.2, b - 0.1, label);
    return r;
  };

  // ---- 1. straight through
  if (!args["only-transport"]) {
    console.log(`Playing film ${from}-${to} s in real time at render width ${width} ...`);
    const rec = await playSpan(from, to);
    const blocks = await pullBlocks();
    const gen = rec.log[rec.log.length - 1];
    report(rec);
    if (rec.stats.late) failed += 1;
    if (rec.load && rec.load.samples) console.log(`  audio thread load (1.00 = all of real time), worst second: average ${rec.load.average.toFixed(2)}, peak ${rec.load.peak.toFixed(2)}, underrun ratio ${rec.load.underrun.toFixed(3)}`);
    else console.log("  audio thread load: not reported by this browser");
    compare(blocks, gen, from + 0.2, to - 0.05, "straight through");
  }

  // ---- 2. the transport: pause, seeks, the end of the film, a held-up main thread
  if (!args["no-seek"] && to - from > 20) {
    const a = Math.min(to - 12, Math.max(from, 99));
    await scenario(`pause at ${(a + 3.02).toFixed(2)} s for 0.8 s, resume`, a, a + 7, { pauseAt: a + 3.02, pauseMs: 800 }, { generations: 1 });

    // A seek while playing: by default from the Tang section into the Song section; with
    // --seek-from A --seek-to B, from film time A (played for 2.5 s first) to B. A note that began
    // before the landing point is not replayed after a seek (only sounds marked seekable are picked
    // up part-way), so what follows a landing is compared with an offline render that begins there.
    const c = args["seek-from"] !== undefined ? Number(args["seek-from"]) - 2.5 : Math.max(from, 28);
    const target = args["seek-to"] !== undefined ? Number(args["seek-to"]) : c + 6.2;
    await scenario(`seek from ${(c + 2.5).toFixed(1)} s to ${target.toFixed(1)} s while playing`, c, target + 4.8, { seekAt: c + 2.5, seekTo: target }, { landing: true, generations: 2, landsAt: [target, 1e-9] });

    if (to - from > 100 && args["seek-from"] === undefined) {
      // a seek while paused, then play
      await scenario("pause at 64.5 s, seek to 70.3 s while paused, play", 62, 75, { pauseAt: 64.5, pausedSeekTo: 70.3, pauseMs: 500 }, { landing: true, generations: 2, landsAt: [70.3, 1e-9] });
      // a drag on the timeline: four seeks 60 ms apart, the last into the middle of the vaporwave tape; only the last may sound
      await scenario("four seeks 60 ms apart (to 90.0, 93.1, 96.4, then 108.7 s) while playing", 84, 113.4, { seekAt: 85.5, seekTo: [90.0, 93.1, 96.4, 108.7], seekGapMs: 60 }, { landing: true, generations: 2, landsAt: [108.7, 1e-9] });
      // the main thread held up for longer than the scheduler looks ahead
      await scenario("main thread held up for 2.4 s at film 42.5 s", 41, 52, { stallAt: 42.5, stallMs: 2400 }, { landing: true, expectResync: true, landsAt: [45.05, 0.3] });

      // Play and pause in the same instant, on a film that was paused: the context's resume is
      // still on its way when the pause arrives. Nothing may sound while the picture stands, and
      // when play is pressed again the film must carry on exactly where it was held.
      {
        const before = await page.evaluate(() => ({ ...window.__sound.transport.stats, logged: window.__sound.transport.log.length }));
        const r = await page.evaluate(async () => {
          const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
          const tr = window.__sound.transport;
          const c = window.clock;
          c.pause();
          c.seek(30);
          c.play();
          await sleep(2000);
          c.pause();
          await sleep(300);
          const held = c.time;
          c.play();
          c.pause();
          await sleep(300); // the resume, and the suspend that must follow it, arrive
          const blocks0 = tr.tap.blocks.length;
          const ctx0 = tr.ac.currentTime;
          await sleep(1200);
          const out = { held, state: tr.ac.state, blocks: tr.tap.blocks.length - blocks0, ctxMoved: tr.ac.currentTime - ctx0, clockMoved: c.time - held, playing: c.playing };
          c.play();
          await new Promise((resolve) => {
            const step = () => (c.time >= held + 3 ? resolve() : requestAnimationFrame(step));
            requestAnimationFrame(step);
          });
          c.pause();
          out.stats = { ...tr.stats };
          out.log = tr.log.map((g) => ({ ...g }));
          return out;
        });
        const blk = await pullBlocks();
        const g = r.log[r.log.length - 1];
        const label = "play and pause in the same instant (the resume still on its way), then play";
        const ok = r.state === "suspended" && r.blocks === 0 && Math.abs(r.ctxMoved) < 1e-9 && r.clockMoved === 0 && !r.playing && r.log.length - before.logged === 1 && r.stats.late === before.late && r.stats.resyncs === before.resyncs;
        console.log(`${label}: while paused the audio context was ${r.state}, ${r.blocks} blocks of sound arrived, its clock moved ${(r.ctxMoved * 1000).toFixed(3)} ms and the picture's ${(r.clockMoved * 1000).toFixed(3)} ms; ${r.log.length - before.logged} generation, ${r.stats.late - before.late} late tick(s)${ok ? "" : "  <- sound or a moving clock while paused, or a broken schedule"}`);
        if (!ok) failed += 1;
        compare(blk, g, g.film + 0.01, r.held + 2.9, `${label}: the whole stretch from film ${g.film.toFixed(2)} s, against an offline render begun there`, await landingRef(g.film, r.held + 3));
      }
      // the film runs out by itself; play is pressed again: once inside the last sound's tail, once after it
      for (const wait of [150, 900]) {
        const r = await playSpan(134.6, 137, { replayAfterMs: wait, replayUntil: 4.2 });
        const blk = await pullBlocks();
        const g = r.log[r.log.length - 1];
        const first = r.log[r.log.length - 2];
        // the end of the film: the picture stops a display refresh before the sound does; nothing may be cut short
        compare(blk.filter((x) => x.frame / sr >= first.ctx && x.frame / sr - first.T0 < 137.1), first, first.film + 0.01, 137, `the last seconds, begun at ${first.film} s and left to run out`, await landingRef(first.film, 137));
        // after the film's last sample: nothing, until the context is put to sleep or play is pressed
        let after = 0;
        let count = 0;
        for (const x of blk) {
          const film = x.frame / sr - first.T0;
          if (x.frame / sr >= g.ctx || film < 137 || film > 137.4) continue;
          count += 1;
          for (const v of x.mono) if (Math.abs(v) > after) after = Math.abs(v);
        }
        // the film's last sounds die away past its last sample (the file ends at about -78 dBFS); nothing new may sound
        const hushed = after < 3.2e-4;
        console.log(`      after the film's last sample (${count} blocks recorded before the context slept or play was pressed): ${after > 0 ? `the last sounds dying away, peak ${dbfs(after).toFixed(1)} dBFS` : "silence"}${hushed ? "" : "  <- something sounded above -70 dBFS"}`);
        if (!hushed) failed += 1;
        compare(blk.filter((x) => x.frame / sr >= g.ctx), g, 0.2, 4.1, `play pressed again ${wait} ms after the end: the film from its start`);
      }
    }
  }
} finally {
  await browser.close();
  await srv.close();
}
if (skips) console.log(`(${skips} time(s) in this run a pause landed while the audio device was being served, and the browser's audio clock ran a block or two past the last sound: see the lines above.)`);
if (restamped) console.log(`(The recorder counts audio blocks itself. For ${restamped} block(s) the browser's own frame stamp lagged behind that count, which is harmless.)`);
console.log(failed ? `\n${failed} comparison(s) failed.` : "\nThe live sound matches the offline render.");
process.exit(failed ? 1 : 0);
