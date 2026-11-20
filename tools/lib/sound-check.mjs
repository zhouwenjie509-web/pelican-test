// What a render sounds like, as far as it can be measured: level, balance,
// clicks, whether each declared cue begins where the picture needs it, and
// whether the lead notes are in tune. Prints a report and draws a spectrogram.

import path from "node:path";
import { PROJECT_ROOT } from "./server.mjs";
import { readWav, toMono, levels, dbfs, onsetNear, pitchNear, balance, worstStep, loudness, bandpass } from "./sound.mjs";
import { drawSpectrogram } from "./spectro.mjs";
import { TARGET, PEAK } from "../../audio/mix.js";
import { hz, noteName } from "../../audio/engine/theory.js";

const fmt = (v, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? "n/a" : v.toFixed(d));

/** Tolerances. */
export const LIMITS = {
  loudness: 1.5, // LU either side of the part's target
  peakDb: -6, // a part alone must stay below this
  cueMs: 15, // a cue's sound must begin within this of its time
  softCueMs: 60, // ... or this, for a cue marked soft (a swell)
  cents: 12, // lead notes
  step: 0.6, // largest sample-to-sample jump before it counts as a click
  tailDb: -50, // level 2 s after the part's last bar
};

/**
 * How close to its time a cue's sound must begin. A cue heard only in a narrow
 * low band cannot be timed finely (a band B hertz wide takes about 1.5 / B
 * seconds to speak), so the limit widens for it.
 */
export function cueLimit(c) {
  const base = c.soft ? LIMITS.softCueMs : LIMITS.cueMs;
  return c.band ? Math.max(base, Math.round(1500 / (c.band[1] - c.band[0]))) : base;
}

/**
 * Measure a rendered file. `side` is the .json written beside it by tools/audio.mjs.
 * Returns true when nothing is out of tolerance.
 */
export function checkRender(file, side, { quiet = false, picture = true, pps = null } = {}) {
  const { sampleRate: sr, channels } = readWav(file);
  const x = toMono(channels);
  const rel = (t) => t - side.from; // film time -> seconds into the file
  const { t0, t1 } = side.focus || { t0: side.from, t1: side.to };
  const solo = side.only && side.only.length ? side.only[0] : null;
  const problems = [];
  const lines = [];

  // ---- level
  const whole = levels(x);
  const stereoPeak = Math.max(...channels.map((c) => levels(c).peak));
  const loud = loudness(file, { from: rel(t0), dur: Math.min(t1 - t0, side.to - t0) });
  // one instrument alone (--label) is not measured against the part's target
  const target = solo && TARGET[solo] !== undefined && side.only.length === 1 && !side.label ? TARGET[solo] : null;
  let verdict = "";
  if (target !== null && loud.integrated !== null) {
    const off = loud.integrated - target;
    verdict = Math.abs(off) <= LIMITS.loudness ? `  OK (target ${target} LUFS)` : `  ${off > 0 ? "TOO LOUD" : "TOO QUIET"} by ${fmt(Math.abs(off))} LU (target ${target} ± ${LIMITS.loudness} LUFS)`;
    if (Math.abs(off) > LIMITS.loudness) problems.push(`loudness ${fmt(loud.integrated)} LUFS, target ${target}`);
  }
  lines.push(`Level     ${fmt(loud.integrated)} LUFS over film ${fmt(t0, 2)}-${fmt(Math.min(t1, side.to), 2)} s${verdict}`);
  const peakDb = dbfs(stereoPeak);
  // a part alone must stay below -6 dBFS; a part with others (the bicycle's bell on top) below -3; the mix below -1
  const alone = solo && side.only.length === 1;
  const ownLimit = solo && PEAK[solo] !== undefined ? PEAK[solo] : LIMITS.peakDb;
  const peakLimit = alone ? ownLimit : solo ? Math.max(-3, ownLimit + 2) : -1;
  const peakBad = peakDb > peakLimit;
  let peakAt = 0;
  for (const c of channels) {
    for (let i = 0; i < c.length; i += 1) {
      if (Math.abs(c[i]) >= stereoPeak) {
        peakAt = i;
        break;
      }
    }
  }
  lines.push(`          peak ${fmt(peakDb)} dBFS at film ${fmt(side.from + peakAt / sr, 3)} s, true peak ${fmt(loud.truePeak)} dBTP, loudness range ${fmt(loud.range)} LU${peakBad ? `  TOO HOT (keep ${alone ? "a part alone" : solo ? "a part with the bicycle" : "the mix"} below ${peakLimit} dBFS)` : ""}`);
  if (peakBad) problems.push(`peak ${fmt(peakDb)} dBFS`);

  // ---- balance
  const bal = balance(x, sr, rel(t0), rel(Math.min(t1, side.to)));
  if (bal) lines.push(`Balance   centroid ${fmt(bal.centroid, 0)} Hz, ${fmt(bal.below120 * 100)} % of the energy below 120 Hz, ${fmt(bal.above8k * 100)} % above 8 kHz, DC ${whole.dc.toExponential(1)}`);
  if (Math.abs(whole.dc) > 0.003) problems.push(`DC offset ${whole.dc.toExponential(1)}`);

  // ---- clicks
  const step = worstStep(x);
  const stepBad = step.step > LIMITS.step;
  lines.push(`Clicks    largest sample-to-sample step ${fmt(step.step, 3)} at film ${fmt(side.from + step.at / sr, 3)} s${stepBad ? "  LOOKS LIKE A CLICK" : ""}`);
  if (stepBad) problems.push(`possible click at ${fmt(side.from + step.at / sr, 3)} s`);

  // ---- tail (a part alone should have died away two seconds after it ends)
  if (solo && side.to >= t1 + 1.9 && solo !== "bike") {
    const tail = levels(x, x.length - Math.round(0.25 * sr), x.length);
    const tailDb = dbfs(tail.rms);
    const bad = tailDb > LIMITS.tailDb;
    lines.push(`Tail      ${Number.isFinite(tailDb) ? `${fmt(tailDb)} dBFS` : "silence"} in the last quarter second of the file${bad ? `  STILL SOUNDING (must be below ${LIMITS.tailDb} dBFS by then)` : ""}`);
    if (bad) problems.push(`tail ${fmt(tailDb)} dBFS`);
  }

  // ---- cues
  const allCues = side.cues || [];
  // a cue at the very start of the film is measured against the silence before the film
  const atStart = (c) => side.from === 0 && c.t < 0.13;
  const cues = allCues.filter((c) => (c.t >= side.from + 0.13 || atStart(c)) && c.t <= side.to - 0.21);
  const unmeasured = allCues.filter((c) => c.t >= side.from && c.t < side.from + 0.13 && !atStart(c));
  if (cues.length) {
    lines.push("Cues      film s      u    lag     rise   what");
    for (const c of cues) {
      const on = onsetNear(x, sr, rel(c.t), { band: c.band || null, before: Math.min(0.12, Math.max(0, rel(c.t))) });
      const limit = cueLimit(c);
      let state;
      // with --label most cues' own sounds are filtered out: list them, but do not count them
      if (!on) {
        state = side.label ? "nothing begins here in this render" : "NOTHING BEGINS HERE (no rise of 3 dB)";
        if (!side.label) problems.push(`cue at ${fmt(c.t, 2)} s (${c.what}): no onset`);
      } else if (Math.abs(on.lagMs) > limit) {
        state = `${on.lagMs > 0 ? "LATE" : "EARLY"} (limit ${limit} ms)`;
        if (!side.label) problems.push(`cue at ${fmt(c.t, 2)} s (${c.what}): ${fmt(on.lagMs)} ms`);
      } else state = "ok";
      lines.push(`          ${fmt(c.t, 3).padStart(7)} ${fmt(c.u, 2).padStart(6)} ${on ? (on.lagMs >= 0 ? "+" : "") + fmt(on.lagMs) + " ms" : "   -   "} ${on ? fmt(on.riseDb, 0).padStart(4) + " dB" : "       "}  ${c.what}${c.part && c.part !== solo ? ` [${c.part}]` : ""}: ${state}`);
    }
    for (const c of unmeasured) lines.push(`          ${fmt(c.t, 3).padStart(7)} ${fmt(c.u, 2).padStart(6)}                  ${c.what}: too close to the start of the file to measure`);
  } else if (solo && solo !== "bike") {
    lines.push("Cues      none declared (declare the moments where sound must meet picture with s.cue)");
  }

  // ---- the chain: every tick against the moment the picture's crank passes a quarter turn
  if (solo === "bike" && side.only.length === 1 && Array.isArray(side.ticks) && side.ticks.length) {
    const lags = [];
    let missed = 0;
    for (const t of side.ticks) {
      if (t < side.from + 0.07 || t > side.to - 0.06) continue;
      const on = onsetNear(x, sr, rel(t), { band: [3000, 9000], before: 0.06, after: 0.04, guard: 0.006 });
      if (on) lags.push(on.lagMs);
      else missed += 1;
    }
    if (lags.length) {
      const worstTick = lags.reduce((p, q) => (Math.abs(q) > Math.abs(p) ? q : p));
      const late = lags.filter((v) => Math.abs(v) > 5).length;
      lines.push(`Chain     ${lags.length} ticks measured in 3-9 kHz: lag ${fmt(Math.min(...lags))} to ${fmt(Math.max(...lags))} ms, ${late} more than 5 ms from their time${missed ? `; ${missed} could not be measured (a bell is ringing over them)` : ""}`);
      if (late) problems.push(`${late} chain ticks more than 5 ms off (worst ${fmt(worstTick)} ms)`);
    }
  }

  // ---- lead notes
  const inFile = (side.leads || []).filter((n) => n.t >= side.from && n.t + n.dur <= side.to);
  const leads = inFile.filter((n) => n.dur >= 0.1 && !n.free);
  const skippedShort = inFile.filter((n) => n.dur < 0.1 && !n.free).length;
  const skippedFree = inFile.filter((n) => n.free).length;
  if (leads.length) {
    const rows = leads.map((n) => {
      const a = rel(n.t) + Math.min(0.04, n.dur * 0.25);
      const b = rel(n.t) + Math.min(n.dur, 0.34);
      return { ...n, ...pitchNear(x, sr, a, b, hz(n.midi)) };
    });
    const sorted = rows.map((r) => r.cents).sort((p, q) => p - q);
    const worst = rows.reduce((p, q) => (Math.abs(q.cents) > Math.abs(p.cents) ? q : p));
    const weak = rows.filter((r) => r.strengthDb < -24);
    // a short low note cannot be measured to 12 cents: allow what the window can resolve
    const limitOf = (r) => Math.max(LIMITS.cents, r.resolutionCents, r.tol || 0);
    const off = rows.filter((r) => Math.abs(r.cents) > limitOf(r));
    lines.push(`Lead      ${rows.length} notes: median ${fmt(sorted[Math.floor(sorted.length / 2)])} cents, worst ${(worst.cents >= 0 ? "+" : "") + fmt(worst.cents)} cents (${noteName(worst.midi)} at film ${fmt(worst.t, 2)} s)${off.length ? `  ${off.length} OUT OF TUNE` : ""}`);
    for (const r of off) lines.push(`          ${noteName(r.midi).padEnd(6)} at film ${fmt(r.t, 2)} s: ${(r.cents >= 0 ? "+" : "") + fmt(r.cents)} cents (found ${fmt(r.hz)} Hz, wanted ${fmt(hz(r.midi))} Hz; limit ${fmt(limitOf(r), 0)} cents for a note this low and short)`);
    if (weak.length) lines.push(`          ${weak.length} lead notes are hard to hear at their own pitch (more than 24 dB under the loudest partial): ${weak.slice(0, 6).map((r) => `${noteName(r.midi)}@${fmt(r.t, 2)}`).join(", ")}`);
    if (off.length) problems.push(`${off.length} lead notes out of tune`);
    if (skippedShort || skippedFree) lines.push(`          not measured: ${skippedFree} marked free${skippedShort ? `, ${skippedShort} shorter than 0.1 s` : ""}`);
  }

  // ---- room for the bell: the last 30 ms before the next crossing, where the bell is brightest
  if (alone && solo !== "bike" && solo !== "outro" && side.to >= t1) {
    const a = Math.max(0, Math.round((rel(t1) - 0.03) * sr));
    const b = Math.round(rel(t1) * sr);
    const band = bandpass(x.subarray(Math.max(0, a - 2400), b), sr, 1800, 9000);
    const lv = levels(band, band.length - (b - a), band.length);
    const db = dbfs(lv.rms);
    const bad = db > -32;
    lines.push(`Bell      ${Number.isFinite(db) ? `${fmt(db)} dBFS` : "silence"} between 1.8 and 9 kHz in the last 30 ms before film ${fmt(t1, 2)} s${bad ? "  TOO LOUD: the bell on the crossing must come out of quiet (below -32 dBFS here)" : ""}`);
    if (bad) problems.push(`no room for the bell before ${fmt(t1, 2)} s (${fmt(db)} dBFS in its band)`);
  }

  // ---- picture
  let pngNote = "";
  if (picture) {
    const png = file.replace(/\.wav$/, ".png");
    const dur = side.to - side.from;
    const pxPerSec = pps || (dur <= 12 ? 200 : dur <= 40 ? 60 : 14);
    try {
      drawSpectrogram(png, x, sr, {
        from: 0,
        to: dur,
        pxPerSec,
        filmStart: side.from,
        cues: side.cues || [],
        leads: (side.leads || []).filter((n) => !n.free).map((n) => ({ t: n.t, dur: n.dur, hz: hz(n.midi) })),
      });
      pngNote = `Picture   ${path.relative(PROJECT_ROOT, png)}: ${pxPerSec} px per second from film ${fmt(side.from, 2)} s. Bright vertical lines are bar lines (labelled in film seconds), faint ones beats. 30 Hz at the bottom to 16 kHz at the top (logarithmic), guides at 100 Hz, 1 kHz, 10 kHz. Brightness is level, -96 dB (black) to -12 dB. Turquoise: a wedge at the top for each declared cue, and a dotted line where each lead note's fundamental should be. Below: the waveform, and the level in dB (yellow, 0 at the top to -60).`;
    } catch (err) {
      pngNote = `Picture   failed: ${err.message}`;
    }
  }

  if (!quiet) {
    console.log(`\n== ${path.relative(PROJECT_ROOT, file)} · ${side.only ? side.only.join(" + ") : "all parts"} ==`);
    for (const l of lines) console.log(l);
    if (pngNote) console.log(pngNote);
    console.log(problems.length ? `\n${problems.length} thing(s) out of tolerance:\n${problems.map((p) => `  - ${p}`).join("\n")}` : "\nNothing out of tolerance.");
  }
  return problems.length === 0;
}
