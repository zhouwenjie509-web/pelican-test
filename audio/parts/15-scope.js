// Section 15 (scope): a laboratory in the 1950s. The tune is a test signal:
// plain sine tones, one at a time, an octave up, over the hum of warm valves.
// A hand turns the wrong knob (u = 3.0): the pelican on the tube collapses
// into a Lissajous knot and the held E splits the same way, into two sines in
// the knot's 3 : 2 ratio. The switch is flicked back (u = 3.5): one E again,
// ringing for an instant as the picture does. Nobody mentions it.
//
// How the sounds are made (nothing recorded):
//   beep        one sine oscillator, 8 ms linear edges, no vibrato, no room
//   low tone    the same, two octaves lower, on the first beat of each cell
//   pip         a Hann-windowed sine burst (2 kHz, 6 ms; 1 kHz, 14 ms on whole seconds)
//   hum         60 Hz mains with its 2nd and 3rd harmonics, a faint rasp (upper
//               harmonics of 60 Hz in a band round 1 kHz) and a trace of hiss; one
//               60 Hz period computed and tiled, so it is exactly periodic (prepare)
//   electrify   a 120 Hz buzz (full-wave rectified mains: even harmonics only)
//               whose level fizzes with slow noise, through a soft clip, plus
//               sparks: short noise bursts, each ringing at its own pitch (prepare)
//   switch      a hard plastic detent: two close clicks, each a tick of noise and
//               a few short high modes (prepare)
//   split, ring the held E computed sample by sample with phase accumulators:
//               two sines leaving E in opposite directions to the knot's 3 : 2,
//               then one E whose pitch rings like the picture (prepare)

import { SR, rng, white, biquad, onePole, envelope, fade, mixInto, modal, samples } from "../engine/dsp.js";
import { sharedBuffer, prepareReverb } from "../engine/kit.js";
import { hz, midi, theme } from "../engine/theory.js";

const TAU = 2 * Math.PI;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- levels

/** Linear amplitude of a beep at vel 1. */
const BEEP = 0.075;
/** The low tone under it. */
const LOW = 0.05;
const EDGE = 0.008; // the clean edges of every tone

// ---------------------------------------------------------------- tones (nodes)

/** One sine tone held for ev.hold seconds (default: most of ev.dur). */
function beep(k, g, when, ev) {
  const hold = ev.hold || Math.max(0.06, ev.dur - 0.04);
  const lvl = (ev.amp || BEEP) * (ev.vel === undefined ? 1 : ev.vel);
  const rise = ev.rise || EDGE; // the first beep rises faster, so it stands out of Section 14's fire
  const o = k.osc("sine", hz(ev.midi), when, when + hold + 0.01);
  const a = k.gain(0);
  o.connect(a).connect(g.out);
  k.env(a.gain, when, [[0, 0], [rise, lvl], [hold - EDGE, lvl], [hold, 0]]);
}

/** The low sine. */
function lowTone(k, g, when, ev) {
  beep(k, g, when, { ...ev, amp: LOW });
}

// ---------------------------------------------------------------- buffers (prepare)

const U_HUM0 = -0.5; // the hum arrives with the trace
const U_HUM1 = 6.2; // and is gone 0.2 s after the frame
const U_ELEC1 = 0.62;

/** The mains hum from U_HUM0 to U_HUM1. */
function humSamples() {
  const period = SR / 60; // 800 samples
  const r = rng(1501);
  const one = new Float32Array(period);
  const parts = [
    [1, 0.018, 0],
    [2, 0.012, 1.1],
    [3, 0.008, 2.3],
  ];
  // the rasp: upper harmonics of 60 Hz, random phases, shaped round 1 kHz, very low
  for (let n = 6; n <= 60; n += 1) {
    const f = 60 * n;
    const shape = Math.exp(-(Math.log(f / 1000) ** 2) / (2 * 0.55 ** 2));
    parts.push([n, 0.0011 * shape * (n % 2 ? 1 : 0.7), r() * TAU]);
  }
  for (let i = 0; i < period; i += 1) {
    let v = 0;
    for (const [n, a, p] of parts) v += a * Math.sin((TAU * n * i) / period + p);
    one[i] = v;
  }
  const len = samples(U_HUM1 - U_HUM0);
  const y = new Float32Array(len);
  for (let i = 0; i < len; i += 1) y[i] = one[i % period];
  // a trace of hiss
  let hiss = biquad(white(len, 1502), "highpass", 2500, 0.7);
  hiss = biquad(hiss, "lowpass", 9000, 0.7);
  mixInto(y, hiss, 0, 0.0009);
  // arrives with the trace, leaves at the frame
  for (let i = 0; i < len; i += 1) {
    const u = U_HUM0 + i / SR;
    y[i] *= smooth(-0.5, -0.3, u) * (1 - smooth(6.0, 6.15, u));
  }
  return fade(y, 0.004, 0.004);
}

/** The electrification, from u = -0.5 to U_ELEC1: a fizzing 120 Hz buzz and sparks. */
function electrifySamples() {
  const len = samples(U_ELEC1 - U_HUM0);
  const period = SR / 120; // 400 samples
  const r = rng(1511);
  // a full-wave rectified sine has only even harmonics of 60 Hz: harmonics of 120 Hz, falling as 1/n^2;
  // a little flatter here, because the arcing makes it rougher
  const one = new Float32Array(period);
  const ph = [];
  for (let n = 1; n <= 30; n += 1) ph.push(r() * TAU);
  for (let i = 0; i < period; i += 1) {
    let v = 0;
    for (let n = 1; n <= 30; n += 1) v += (Math.sin((TAU * n * i) / period + ph[n - 1]) * (n === 1 ? 0.3 : n === 2 ? 0.45 : 1)) / n ** 1.2; // 120 and 240 Hz held back: they sit on the fire's bass
    one[i] = v;
  }
  // the fizz: the buzz's level wanders quickly
  let fizz = onePole(white(len, 1512), 90);
  let fz = 0;
  for (let i = 0; i < len; i += 1) fz = Math.max(fz, Math.abs(fizz[i]));
  let y = new Float32Array(len);
  for (let i = 0; i < len; i += 1) {
    const m = 0.55 + 0.45 * (fizz[i] / fz);
    const v = 1.6 * one[i % period] * m;
    y[i] = Math.tanh(v) * 0.5;
  }
  // the buzz stays low (below the tune's first beep, D5), the sparks fly above it
  y = biquad(biquad(y, "lowpass", 420, 0.7), "lowpass", 420, 0.7);
  // sparks: about thirty a second, irregular, each a short burst ringing at its own pitch
  const sp = new Float32Array(len);
  let t = 0.02;
  let seed = 1520;
  while (t < U_ELEC1 - U_HUM0 - 0.03) {
    const f = 780 + 700 * r();
    const blen = 0.004 + 0.006 * r();
    let b = white(samples(blen + 0.01), seed);
    seed += 1;
    b = biquad(b, "bandpass", f, 4);
    envelope(b, [[0, 0], [0.0003, 1], [blen * 0.3, 0.45], [blen, 0.08], [blen + 0.01, 0]]);
    mixInto(sp, b, t, (0.5 + 0.5 * r()) * 4);
    t += (1 / 30) * (0.35 + 1.3 * r());
  }
  mixInto(y, sp, 0, 1);
  // keep it out of the bell's band (1.8 .. 9 kHz) and off the floor
  let out = biquad(y, "lowpass", 1400, 0.7);
  out = biquad(out, "lowpass", 1400, 0.7);
  out = biquad(out, "highpass", 90, 0.7);
  for (let i = 0; i < len; i += 1) {
    const u = U_HUM0 + i / SR;
    out[i] *= smooth(-0.5, -0.32, u) * (1 - smooth(0.1, 0.6, u));
  }
  return fade(out, 0.004, 0.01);
}

/** One click of the rotary switch's detent. */
function clickSamples(variant) {
  const len = 0.05;
  const tick = biquad(white(samples(len), 1530 + variant), "bandpass", 3200 - 500 * variant, 1.4);
  envelope(tick, [[0, 0], [0.0002, 1], [0.0012, 0.35], [0.004, 0.06], [0.012, 0], [len, 0]]);
  const body = modal(
    [
      { f: 2350 + 170 * variant, a: 0.5, t60: 0.03, phase: 0.4 },
      { f: 3780 - 120 * variant, a: 0.35, t60: 0.022, phase: 1.3 },
      { f: 5560 + 210 * variant, a: 0.2, t60: 0.014, phase: 2.1 },
      { f: 1180 + 60 * variant, a: 0.25, t60: 0.04, phase: 0.9 },
    ],
    len,
  );
  mixInto(tick, body, 0, 0.6);
  return fade(tick, 0.0002, 0.01);
}

/** The switch: two close clicks (the detent lets go, the stop takes it). */
function switchSamples() {
  const y = new Float32Array(samples(0.09));
  mixInto(y, clickSamples(0), 0, 1);
  mixInto(y, clickSamples(1), 0.024, 0.6);
  let p = 0;
  for (const v of y) p = Math.max(p, Math.abs(v));
  for (let i = 0; i < y.length; i += 1) y[i] /= p;
  return y;
}

// The held E of bar 2.
const E5 = hz(midi("E5"));
/** Half the knot's 3 : 2, in cents: each sine moves this far from E. */
const SPLIT = 1200 * Math.log2(Math.sqrt(1.5));
/** The knot turns at 4.6 rad/s: the upper sine runs that much faster than 3/2 of the lower. */
const TURN_HZ = 4.6 / TAU;
const SPLIT_LEN = 0.5;
const RING_LEN = 0.46;

/** u = 3.0 .. 3.5: E leaves in two directions and settles in the knot's ratio, hunting as it does. */
function splitSamples() {
  const n = samples(SPLIT_LEN);
  const y = new Float32Array(n);
  let pl = 0;
  let ph = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    const s = 1 - Math.exp(-t / 0.01); // thrown within two frames
    const hunt = 0.1 * Math.exp(-t / 0.12) * Math.sin(TAU * 7 * t);
    const c = SPLIT * (s + hunt);
    const fl = E5 * 2 ** (-c / 1200);
    const fh = E5 * 2 ** (c / 1200) + TURN_HZ * s;
    pl += (TAU * fl) / SR;
    ph += (TAU * fh) / SR;
    // a little of the 3rd of the lower and the 2nd of the upper: they beat as the knot turns
    y[i] = 0.72 * (Math.sin(pl) + Math.sin(ph)) + 0.05 * Math.sin(3 * pl) + 0.05 * Math.sin(2 * ph);
  }
  // clean edges; the switch blanks the beam at 3.5, so it closes just before
  envelope(y, [[0, 0], [EDGE, 1], [SPLIT_LEN - 0.006, 1], [SPLIT_LEN, 0]]);
  return y;
}

/** The ring's depth, as a fraction of the split's whole spread: twice the picture's 0.12, so that it is heard. */
const RING_DEPTH = 0.24;

/** u = 3.5 .. 3.96: one E, whose pitch rings as the picture does (RING_DEPTH e^(-t/0.045) sin(2 pi 11 t) of the throw). */
function ringSamples() {
  const n = samples(RING_LEN);
  const y = new Float32Array(n);
  let p = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    const c = RING_DEPTH * 2 * SPLIT * Math.exp(-t / 0.045) * Math.sin(TAU * 11 * t);
    p += (TAU * E5 * 2 ** (c / 1200)) / SR;
    y[i] = Math.sin(p);
  }
  envelope(y, [[0, 0], [0.005, 1], [RING_LEN - EDGE, 1], [RING_LEN, 0]]);
  return y;
}

/** A pip: a Hann-windowed sine burst. */
function pipSamples(big) {
  const f = big ? 1000 : 2000;
  const len = big ? 0.014 : 0.006;
  const n = samples(len);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i += 1) y[i] = Math.sin((TAU * f * i) / SR) * 0.5 * (1 - Math.cos((TAU * i) / (n - 1)));
  return y;
}

const BUFS = {
  "scope/hum": humSamples,
  "scope/electrify": electrifySamples,
  "scope/switch": switchSamples,
  "scope/split": splitSamples,
  "scope/ring": ringSamples,
  "scope/pip/0": () => pipSamples(false),
  "scope/pip/1": () => pipSamples(true),
};
const ROOM = { seconds: 0.3, t60: 0.3, bright: 0.5, predelay: 0.004, early: 0.4, seed: 15 };

// ---------------------------------------------------------------- players

function hum(k, g, when, ev) {
  k.play(k.buffer("scope/hum", humSamples), when, { offset: ev.offset || 0, gain: 1 }, g.out);
}

function electrify(k, g, when, ev) {
  k.play(k.buffer("scope/electrify", electrifySamples), when, { gain: ev.vel }, g.out);
}

function switchClick(k, g, when, ev) {
  const { out } = k.play(k.buffer("scope/switch", switchSamples), when, { gain: 0.16 * ev.vel, pan: 0.25 }, g.out);
  out.connect(g.send);
}

function split(k, g, when, ev) {
  k.play(k.buffer("scope/split", splitSamples), when, { gain: BEEP * ev.vel }, g.out);
}

function ring(k, g, when, ev) {
  k.play(k.buffer("scope/ring", ringSamples), when, { gain: BEEP * ev.vel }, g.out);
}

function pip(k, g, when, ev) {
  const big = ev.big ? 1 : 0;
  k.play(k.buffer(`scope/pip/${big}`, () => pipSamples(ev.big)), when, { gain: (big ? 0.015 : 0.009) * ev.vel }, g.out);
}

/** The outro's voice: one beep (needs only g.out). */
function leadVoice(k, g, when, ev) {
  beep(k, g, when, { midi: ev.midi, dur: ev.dur || 0.5, vel: ev.vel === undefined ? 1 : ev.vel });
}

// ---------------------------------------------------------------- the part

/** The low tone on the first beat of each two-beat cell: D3 D3 G3 A3 D3 G3. */
const LOWS = [
  [0, "D3"],
  [1, "D3"],
  [2, "G3"],
  [3, "A3"],
  [4, "D3"],
  [5, "G3"],
];

export default {
  async prepare() {
    for (const [key, make] of Object.entries(BUFS)) sharedBuffer(key, make);
    prepareReverb("scope/room", ROOM);
  },

  graph(k, out) {
    const room = k.reverb("scope/room", ROOM);
    const send = k.gain(0.18);
    send.connect(room).connect(out);
    return { send };
  },

  score(s) {
    // the bed: hum all through, the electrification at the hand-over
    s.at(U_HUM0, hum, { dur: U_HUM1 - U_HUM0, seekable: true, label: "hum" });
    s.at(U_HUM0, electrify, { dur: U_ELEC1 - U_HUM0, vel: 0.2, label: "electrify" });

    // the tune in beeps, an octave up; the held E of bar 2 is the split and the ring
    for (const note of theme({ octave: 1 })) {
      if (note.u === 3.0) continue;
      const first = note.u === 0 ? { rise: 0.004 } : {};
      s.note(beep, note.u, note.dur, note.midi, 1, { lead: true, label: "beep", ...first });
    }
    s.note(split, 3.0, SPLIT_LEN, midi("E5"), 1, { lead: true, free: true, label: "split" });
    s.note(ring, 3.5, RING_LEN, midi("E5"), 1, { lead: true, free: true, label: "ring" });

    // the low tones
    for (const [u, name] of LOWS) s.note(lowTone, u, 1, midi(name), 1, { hold: 0.9, label: "low" });

    // the base line's pips pass under the pelican every quarter second (large ones on the whole seconds)
    for (let j = 0; j < 24; j += 1) s.at(j / 4, pip, { dur: 0.014, vel: 1, big: j % 4 === 0, label: "pip" });

    // the switch, there and back
    s.at(3.0, switchClick, { dur: 0.09, vel: 1, label: "switch" });
    s.at(3.5, switchClick, { dur: 0.09, vel: 0.85, label: "switch" });

    s.cue(0, "the pelican comes through the frame, drawn in green light", { band: [565, 610] });
    s.cue(3.0, "the hand turns the switch to X-Y: the knot", { band: [2500, 9000] });
    s.cue(3.5, "the switch is flicked back: the pelican rings", { band: [2500, 9000] });
  },

  lead: leadVoice,
  leadOctave: 1,
  bike: { chain: 0.6, bell: 1 },
};
