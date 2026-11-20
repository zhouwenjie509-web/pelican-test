// Section 4 (tang): one pipa on an open terrace, played with the nails.
//
// The pipa plays the tune at written pitch and, like the attendants' sashes,
// is lifted by the pelican's passing. Bar 1: a sweep across four strings,
// then the climb, the longer notes rolled (lunzhi). Bar 2: the B rolled; three
// upward runs of harmonics, each higher, start exactly as the fan-holder, the
// flute player and the last of the five lift their sashes; the held E is
// rolled, swelling, and pushed up a tone and back while the third run climbs;
// a breath of wind rises under it. Bar 3: a sweep, the walk down, and at 5.08
// the banner snaps out: the string is pulled and slapped against the neck,
// with a hard damped sweep. The last B is damped for the bell.
//
// How the sounds are made (all computed, nothing recorded):
//   strike    a sum of decaying string partials (dsp.modal): amplitudes from a
//             hard nail plucking near the bridge (|sin(pi k p)| / k), weighted by
//             a nasal wooden body (bumps at 450 Hz, 1.2 kHz, 2.9 kHz), upper
//             partials dying much faster than the fundamental; plus the nail's
//             own tick, 2 ms of noise around 4.5 kHz
//   roll      the strike restruck 13 times a second; each stroke damps the one
//             before over 12 ms, as the nail touching the string does
//   push      the ringing string's playback rate raised a tone and returned
//   harmonic  the string touched at a node: a nearly pure partial series an
//             octave or two up, ringing longer, with a faint tick
//   snap      a short, hard-damped low string, a crack of broadband noise and
//             the knock of the wooden neck
//   wind      pink noise through a wide band filter, very quiet
//   clapper   two hardwood boards: a few stiff modes gone in 50 ms

import { prepareReverb, sharedBuffer } from "../engine/kit.js";
import { SR, white, biquad, onePole, envelope, fade, mixInto, normalize, samples, modal } from "../engine/dsp.js";
import { hz, midi } from "../engine/theory.js";

const ROLL_HZ = 13; // lunzhi strokes per second
const ROLL = 1 / ROLL_HZ;
const SWEEP_GAP = 0.006; // seconds between the strings of a sweep
const HARMONIC_T60 = 0.7; // a harmonic rings 0.7 s: each run has faded under the tune before the next
const PUSH_VEL = 1; // the fresh stroke that is pushed on the held E
const B4_LAST = 0.95; // the B4's last stroke (u 2.077), a full nail stroke: 0.95 x the note's 0.95, about 0.9
const RUN1_REST = 10 ** (-6 / 20); // run 1's notes 2 to 5, 6 dB down; its first note keeps its +6 dB for the cue

// ---------------------------------------------------------------- the string

/** The wooden body's response: a nasal pipa, little below 150 Hz, rolling off above 6 kHz. */
function body(f) {
  const bump = (fc, q, db) => {
    const x = Math.log2(f / fc) * q;
    return (10 ** (db / 20) - 1) * Math.exp(-x * x);
  };
  const low = 1 / (1 + (150 / f) ** 2);
  const high = 1 / (1 + (f / 6500) ** 2);
  return (1 + bump(450, 1.6, 3) + bump(1200, 1.8, 7) + bump(2900, 1.6, 4)) * low * high;
}

/**
 * One pluck of a pipa string. variant: "nail" (a full stroke), "roll" (a light
 * restroke of the tremolo: less tick, a little darker), "damp" (a hard, short stroke).
 */
function strikeSamples(m, variant) {
  const f0 = hz(m);
  const light = variant === "roll";
  const damp = variant === "damp";
  const seconds = damp ? 0.4 : 1.3;
  const t1 = damp ? 0.28 : 0.9; // t60 of the fundamental
  const pick = 0.13;
  const partials = [];
  for (let k = 1; k * f0 < 11000; k += 1) {
    const f = k * f0 * Math.sqrt(1 + 1.5e-5 * k * k);
    const a = (Math.abs(Math.sin(Math.PI * k * pick)) / k ** (light ? 1.15 : 1.0)) * body(f);
    if (a < 1e-4) continue;
    const t60 = t1 / (1 + (f / 1300) ** 1.25);
    partials.push({ f, a, t60 });
  }
  const y = modal(partials, seconds, { attack: 0.0008 });
  normalize(y, 0.8);
  // the nail on the string
  const tick = biquad(white(samples(0.008), 300 + m * 3 + (light ? 1 : 0)), "bandpass", 4500, 1.1);
  envelope(tick, [[0, 0], [0.0003, 1], [0.002, 0.25], [0.008, 0]]);
  mixInto(y, tick, 0, light ? 0.35 : damp ? 0.9 : 0.6);
  const out = onePole(y, 60, "highpass");
  return normalize(fade(out, 0.0006, damp ? 0.06 : 0.03), 0.9);
}

/** A harmonic: the string touched at a node. A nearly pure tone with a trace of its octave. */
function harmonicSamples(m) {
  const f = hz(m);
  const y = modal(
    [
      { f, a: 1, t60: HARMONIC_T60 },
      { f: f * 2.001, a: 0.07, t60: 0.4 },
      { f: f * 3.003, a: 0.025, t60: 0.25 },
    ],
    HARMONIC_T60 + 0.1,
    { attack: 0.0015 },
  );
  normalize(y, 0.8);
  const tick = biquad(white(samples(0.006), 700 + m), "bandpass", 5000, 1.2);
  envelope(tick, [[0, 0], [0.0003, 1], [0.0015, 0.2], [0.006, 0]]);
  mixInto(y, tick, 0, 0.15);
  return normalize(fade(y, 0.0015, 0.04), 0.9);
}

/** The snap: a low string pulled and let slap against the neck. */
function snapSamples() {
  const n = samples(0.5);
  const y = new Float32Array(n);
  // the crack: broadband, very short
  const crack = onePole(onePole(white(samples(0.02), 911), 900, "highpass"), 6000);
  envelope(crack, [[0, 0], [0.0005, 1], [0.0015, 0.35], [0.006, 0.08], [0.02, 0]]);
  mixInto(y, crack, 0, 1.0);
  // the neck: hard wood, a few stiff modes, gone at once
  const neck = modal(
    [
      { f: 620, a: 0.5, t60: 0.05 },
      { f: 1530, a: 0.45, t60: 0.04 },
      { f: 2870, a: 0.3, t60: 0.03 },
    ],
    0.12,
    { attack: 0.0003 },
  );
  mixInto(y, neck, 0, 0.5);
  // the string itself, D3, choked by the neck
  const str = strikeSamples(midi("D3"), "damp");
  mixInto(y, str, 0.001, 0.3);
  return normalize(fade(onePole(y, 50, "highpass"), 0.0003, 0.05), 0.9);
}

/** The clapper: two hardwood boards. */
function clapperSamples() {
  const y = modal(
    [
      { f: 1180, a: 1, t60: 0.06 },
      { f: 2730, a: 0.6, t60: 0.045 },
      { f: 4410, a: 0.35, t60: 0.03 },
    ],
    0.12,
    { attack: 0.0003 },
  );
  const click = biquad(white(samples(0.006), 1201), "bandpass", 3000, 0.8);
  envelope(click, [[0, 0], [0.0003, 1], [0.002, 0.2], [0.006, 0]]);
  mixInto(y, click, 0, 0.6);
  return normalize(fade(y, 0.0003, 0.03), 0.9);
}

const strikeKey = (m, v) => `tang/strike/${m}/${v}`;
const strikeBuf = (k, m, v) => k.buffer(strikeKey(m, v), () => strikeSamples(m, v));

// ---------------------------------------------------------------- play functions

/** Linear levels at vel 1. pipa: the outro's lead voice; tune: the tune in this section (1 dB above it, for the loudness target). */
const LEVEL = { pipa: 0.4, tune: 0.45, low: 0.2, harmonic: 0.13, snap: 0.42, sweep: 0.2, wind: 0.055, clapper: 0.06 };

/**
 * A pipa note: one stroke, or a roll. ev.strikes: [{ t, vel, end?, variant? }] in seconds
 * from the note's start; a stroke with `end` is damped by the next one over 12 ms.
 * ev.bend: [[t, cents], ...] for a push of the stroke that carries ev.bendOn (its index).
 */
function pipa(k, g, when, ev) {
  const strikes = ev.strikes || [{ t: 0, vel: 1 }];
  const level = (ev.level === undefined ? LEVEL.pipa : ev.level) * ev.vel;
  // A restroke does not stop the string: it lands on a string already moving. Each stroke
  // is placed on a whole period of the fundamental after the first (at most half a period,
  // under 2 ms, from its written time), so the vibration carries on in phase; otherwise
  // the strokes would comb the spectrum at 13 Hz and the note would read off its pitch.
  const period = 1 / hz(ev.midi);
  const t0 = strikes[0].t;
  strikes.forEach((st, i) => {
    const variant = st.variant || (i === 0 ? "nail" : "roll");
    const buf = strikeBuf(k, ev.midi, variant);
    const shift = t0 + Math.round((st.t - t0) / period) * period - st.t;
    const opts = { gain: level * st.vel, pan: ev.pan || 0 };
    if (st.end !== undefined) {
      opts.dur = st.end - st.t;
      opts.fade = 0.012;
    }
    const { src, out } = k.play(buf, when + st.t + shift, opts, g.out);
    if (g.send && !ev.dry) out.connect(g.send);
    if (ev.bend && i === ev.bendOn) {
      const pts = ev.bend.map(([t, c], j) => [t - st.t, 2 ** (c / 1200), j === 0 ? "set" : undefined]);
      k.env(src.playbackRate, when + st.t, [[0, 1], ...pts]);
    }
  });
}

function harmonic(k, g, when, ev) {
  const buf = k.buffer(`tang/harmonic/${ev.midi}`, () => harmonicSamples(ev.midi));
  const { out } = k.play(buf, when, { gain: LEVEL.harmonic * ev.vel * (ev.boost || 1), pan: ev.pan || 0 }, g.out);
  if (g.send) out.connect(g.send);
}

function snap(k, g, when, ev) {
  const buf = k.buffer("tang/snap", snapSamples);
  const { out } = k.play(buf, when, { gain: LEVEL.snap * ev.vel }, g.out);
  if (g.send) out.connect(g.send);
}

function clapper(k, g, when, ev) {
  const buf = k.buffer("tang/clapper", clapperSamples);
  const { out } = k.play(buf, when, { gain: LEVEL.clapper * ev.vel, pan: -0.25 }, g.out);
  if (g.send) out.connect(g.send);
}

/** The breath of wind: rises from its start, peaks at ev.peakAt, gone by ev.dur. Seekable. */
function wind(k, g, when, ev) {
  const start = when - (ev.offset || 0);
  const end = start + ev.dur;
  const src = k.noise("pink", when, end + 0.01, { phase: 1.7 + (ev.offset || 0), seed: 4 });
  const bp = k.filter("bandpass", 800, 0.6);
  k.env(bp.frequency, start, [[0, 600], [ev.peakAt, 1100], [ev.dur, 700]]);
  const hp = k.filter("highpass", 220, 0);
  const amp = k.gain(0);
  const lv = LEVEL.wind * ev.vel;
  k.env(amp.gain, start, [[0, 0], [ev.peakAt * 0.6, lv * 0.55], [ev.peakAt, lv], [ev.peakAt + (ev.dur - ev.peakAt) * 0.5, lv * 0.35], [ev.dur, 0]]);
  const pan = k.pan(0.15);
  k.chain(src, bp, hp, amp, pan, g.out);
}

// ---------------------------------------------------------------- the place

/** An open terrace: hardly any room. */
const ROOM = { seconds: 0.8, t60: 0.7, bright: 0.6, predelay: 0.01, early: 0.3, seed: 404 };

/** Every pitch the part and its outro voice ask for (all of D major from A2 to D5), made ahead. */
const STRUNG = ["A2", "B2", "C#3", "D3", "E3", "F#3", "G3", "A3", "B3", "C#4", "D4", "E4", "F#4", "G4", "A4", "B4", "C#5", "D5"].map(midi);
const HARMONICS = ["E5", "F#5", "A5", "B5", "D6", "E6", "F#6", "A6"].map(midi);

// ---------------------------------------------------------------- the score helpers

/** Strokes of a roll from t0 to t1 (seconds from the note's start), each damped by the next; vel from v0 to v1. */
function rollStrokes(t0, t1, v0, v1, lastEnd) {
  const out = [];
  const n = Math.max(1, Math.floor((t1 - t0) / ROLL + 1e-6) + 1);
  for (let i = 0; i < n; i += 1) {
    const t = t0 + i * ROLL;
    const x = n > 1 ? i / (n - 1) : 0;
    // the five fingers are never quite equal
    const finger = [1, 0.95, 1.03, 0.97, 1.01][i % 5];
    out.push({ t, vel: (v0 + (v1 - v0) * x) * finger, end: i < n - 1 ? t + ROLL + 0.006 : lastEnd });
  }
  return out;
}

export default {
  prepare() {
    prepareReverb("tang/room", ROOM);
    for (const m of STRUNG) for (const v of ["nail", "roll"]) sharedBuffer(strikeKey(m, v), () => strikeSamples(m, v));
    for (const m of HARMONICS) sharedBuffer(`tang/harmonic/${m}`, () => harmonicSamples(m));
    sharedBuffer("tang/snap", snapSamples);
    sharedBuffer("tang/clapper", clapperSamples);
  },

  graph(k, out) {
    const room = k.reverb("tang/room", ROOM);
    const send = k.gain(0.14);
    send.connect(room).connect(out);
    return { send };
  },

  score(s) {
    const notes = s.theme();
    const next = (i) => (i + 1 < notes.length ? notes[i + 1].u : 6);
    const N = (u) => notes.findIndex((n) => Math.abs(n.u - u) < 1e-6);

    /** A plain stroke of tune note i, damped when the next note sounds. */
    const plain = (i, vel, more = {}) => {
      const n = notes[i];
      const end = next(i) - n.u + 0.015;
      s.note(pipa, n.u, n.dur, n.midi, vel, { lead: true, strikes: [{ t: 0, vel: 1, end }], level: LEVEL.tune, label: "pipa tune", ...more });
    };
    /** A rolled tune note: from `from` (seconds after the note's start) to its end. */
    const rolled = (i, vel, { from = 0, v0 = 0.62, v1 = 0.62, until, label = "pipa tune rolled" } = {}) => {
      const n = notes[i];
      const stop = until === undefined ? n.dur - ROLL * 0.6 : until;
      const strikes = [{ t: from, vel: 1, end: from + ROLL + 0.006 }, ...rollStrokes(from + ROLL, stop, v0, v1, next(i) - n.u + 0.015)];
      if (strikes.length === 1) strikes[0].end = next(i) - n.u + 0.015;
      s.note(pipa, n.u + from, n.dur - from, n.midi, vel, { lead: true, strikes: strikes.map((st) => ({ ...st, t: st.t - from, end: st.end - from })), level: LEVEL.tune, label });
    };
    /** A sweep: strings low to high, SWEEP_GAP apart; the last (the tune note) is returned to the caller to roll. */
    const sweep = (u, names, vel, { damped = false, dry = false, label = "sweep" } = {}) => {
      names.forEach((nm, j) => {
        const strikes = damped ? [{ t: 0, vel: 1, end: 0.2, variant: "nail" }] : [{ t: 0, vel: 1 }];
        s.note(pipa, u + j * SWEEP_GAP, damped ? 0.2 : 0.6, midi(nm), vel * (1 - 0.04 * j), { strikes, level: LEVEL.sweep, pan: -0.1 + 0.05 * j, dry, label });
      });
    };
    const low = (u, nm, dur, vel = 0.8) =>
      s.note(pipa, u, dur, midi(nm), vel, { strikes: [{ t: 0, vel: 1, end: dur }], level: LEVEL.low, pan: -0.12, label: "open string" });
    const run = (u, names, gap, vel, first = 1, rest = 1) =>
      names.forEach((nm, j) =>
        s.note(harmonic, u + j * gap, HARMONIC_T60 + 0.1, midi(nm), vel * (0.85 + 0.04 * j), { pan: 0.1 + 0.04 * j, boost: j === 0 ? first : rest, label: "harmonics" }),
      );

    // ---- bar 1 (u 0-2): a sweep onto D, then the climb; D and A rolled
    sweep(0, ["A2", "D3", "A3"], 0.85, { dry: true }); // dry and close, in front of Section 3's bells
    rolled(N(0), 0.95, { from: 3 * SWEEP_GAP });
    plain(N(0.5), 0.85);
    plain(N(0.75), 0.85);
    rolled(N(1.0), 0.9);
    low(1.0, "A3", 0.5, 0.75);
    plain(N(1.5), 0.85);
    plain(N(1.75), 0.88);

    // ---- bar 2 (u 2-4): the B rolled; three runs of harmonics with the sashes; the held E
    // the roll stops at 2.10: the hand goes to the harmonics; its last stroke (2.077) is a full nail
    // stroke, vel about 0.9, that rings until the A at 2.5, so the top of the tune is heard under the run
    {
      const i = N(2.0);
      const end = next(i) - notes[i].u + 0.015;
      const strikes = [{ t: 0, vel: 1, end: ROLL + 0.006 }, { t: ROLL, vel: B4_LAST, end, variant: "nail" }];
      s.note(pipa, notes[i].u, notes[i].dur, notes[i].midi, 0.95, { lead: true, strikes, level: LEVEL.tune, label: "pipa tune rolled" });
    }
    low(2.0, "D3", 0.5, 0.75);
    run(2.13, ["E5", "F#5", "A5", "B5", "D6"], 0.06, 0.85, 2, RUN1_REST); // the fan-holder: its first harmonic 6 dB up, for the cue; the rest 6 dB down, under the B
    plain(N(2.5), 0.85);
    plain(N(2.75), 0.85);
    run(2.75, ["F#5", "A5", "B5", "D6", "E6", "F#6"], 0.055, 0.6); // the flute player: quieter than the first run, under the tune
    // the held E: rolled, swelling; at 3.33 the roll stops, a fresh stroke is struck and from 3.37
    // the string is pushed up a tone and back; then rolled again
    {
      const i = N(3.0);
      const n = notes[i];
      const a = rollStrokes(ROLL, 0.31, 0.5, 0.62, 0.336);
      const strikes = [{ t: 0, vel: 1, end: ROLL + 0.006 }, ...a, { t: 0.33, vel: PUSH_VEL, end: 0.7, variant: "nail" }];
      const bendOn = strikes.length - 1;
      const b = rollStrokes(0.7, 0.96, 0.7, 0.92, 1.015);
      s.note(pipa, n.u, n.dur, n.midi, 0.9, {
        lead: true,
        free: true,
        strikes: [...strikes, ...b],
        bendOn,
        bend: [[0.37, 0], [0.52, 200], [0.67, 0]],
        level: LEVEL.tune,
        label: "pipa held E",
      });
    }
    low(3.0, "A3", 1.0, 0.7);
    run(3.37, ["A5", "B5", "D6", "E6", "F#6", "A6"], 0.055, 0.475); // the last of the five: held back 6 dB while the E is pushed
    s.at(2.1, wind, { dur: 2.1, peakAt: 1.2, vel: 1, seekable: true, label: "wind" });

    // ---- bar 3 (u 4-6): a sweep onto F#, the walk down; the snap at 5.08; the last B damped
    sweep(4.0, ["D3", "A3", "D4"], 0.85);
    rolled(N(4.0), 0.9, { from: 3 * SWEEP_GAP });
    plain(N(4.5), 0.85);
    plain(N(4.75), 0.85);
    plain(N(5.0), 0.85);
    s.at(5.08, snap, { dur: 0.5, vel: 1, label: "snap" });
    sweep(5.083, ["A2", "D3", "A3", "D4"], 1.0, { damped: true, label: "snap sweep" });
    plain(N(5.5), 0.85);
    {
      const n = notes[N(5.75)];
      s.note(pipa, n.u, n.dur, n.midi, 0.85, { lead: true, strikes: [{ t: 0, vel: 1, end: 0.2 }], level: LEVEL.tune, label: "pipa tune" });
    }

    // ---- the clapper on the bar lines
    for (const u of [0, 2, 4]) s.at(u, clapper, { dur: 0.12, vel: 1, label: "clapper" });

    s.cue(0, "the pelican rides onto the terrace: the first sweep");
    s.cue(2.13, "the fan-holder's sashes lift: first run of harmonics", { band: [600, 720] });
    s.cue(5.08, "the banner snaps out: the snap", { band: [5000, 12000] });
  },

  /** The outro's note of this section: one nail stroke, rolled if it is a beat or longer. */
  lead(k, g, when, ev) {
    const dur = ev.dur || 0.5;
    const strikes = dur >= 0.45 ? [{ t: 0, vel: 1, end: ROLL + 0.006 }, ...rollStrokes(ROLL, dur - ROLL * 0.6, 0.6, 0.6, dur + 0.015)] : [{ t: 0, vel: 1, end: dur + 0.015 }];
    if (strikes.length === 1) strikes[0].end = dur + 0.015;
    pipa(k, g, when, { ...ev, strikes, vel: ev.vel === undefined ? 0.9 : ev.vel });
  },
  leadOctave: 0,
  bike: { chain: 1, bell: 1 },
};
