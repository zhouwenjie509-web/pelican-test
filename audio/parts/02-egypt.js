// Section 2 (egypt): an arched harp and a sistrum in a painted stone chamber.
//
// Bar 1: the harpist plays the tune with the pelican, low strings on the cells,
// the sistrum lightly on beats 2 and 4. At the brake the harpist lays a hand on
// the strings (everything is damped by u = 1.95), then spreads B3-E4-B4 so the
// top note lands with the pose on the downbeat, and the sistrum shakes once.
// The pose holds and the chord rings down; nothing new begins except, on the
// blink, one octave harmonic of the A string, very soft. At the release a
// quick sweep up the five notes (D4 to D5), and the rest of the tune hurries
// on the ridden clock (s.ridden) to reach the frame on the bar line. The bell
// takes the D.
//
// How the sounds are made (plain arithmetic in prepare(), nothing recorded):
//   harp      a sum of decaying harmonic partials (a gut string: a touch of
//             stiffness, upper partials dying much faster than the fundamental),
//             amplitudes from a finger pluck a third of the way along the
//             string with a soft rounded spectrum, a 3 ms onset for the flesh
//             of the finger, two short wooden body modes and a 300 Hz warmth
//   harmonic  the string touched at its middle: only even partials, so its
//             octave, almost a pure sine
//   sistrum   a dense spray of tiny metal clicks (three inharmonic high modes
//             each, a few hundredths of a second), the forward stroke and a
//             weaker rebound, about a quarter of a second
//   room      a small painted stone chamber, 0.9 s, close

import { prepareReverb, sharedBuffer } from "../engine/kit.js";
import { SR, rng, samples, biquad, onePole, fade, normalize } from "../engine/dsp.js";
import { hz, midi } from "../engine/theory.js";

// ---------------------------------------------------------------- the harp

/** How long a string rings (t60 of its fundamental): longer in the bass. */
function ringOf(m) {
  const t = 1.9 + ((71 - m) / 26) * 1.2; // B4 1.9 s ... A2 about 3.2 s
  return Math.max(1.6, Math.min(3.2, t));
}

/** One plucked gut string, as a sum of decaying partials. */
function harpSamples(m) {
  const f0 = hz(m);
  const T = ringOf(m);
  const seconds = Math.min(3.4, T * 1.05);
  const n = samples(seconds);
  const y = new Float32Array(n);
  const B = 0.00004; // gut is barely stiff
  const p = 0.42; // plucked a little short of the middle: odd partials stronger than even, a hollow tone
  const parts = [];
  for (let k = 1; k <= 14; k += 1) {
    const f = k * f0 * Math.sqrt(1 + B * k * k);
    if (f > 6500) break;
    // a finger plucks with a broad, rounded contact: harmonics fall steeply
    const a = (Math.abs(Math.sin(Math.PI * k * p)) / k ** 1.6) / (1 + (f / 2200) ** 2);
    // upper partials die first (string losses grow with frequency)
    const t60 = T / (1 + 0.35 * (k - 1) + (f / 1800) ** 1.3);
    parts.push({ f, a, t60 });
  }
  // two short knocks of the wooden body
  parts.push({ f: 285, a: 0.035, t60: 0.1 }, { f: 415, a: 0.02, t60: 0.07 });
  for (const q of parts) {
    const w = (2 * Math.PI * q.f) / SR;
    const r = Math.exp(-6.9078 / (q.t60 * SR));
    const len = Math.min(n, Math.ceil(q.t60 * 1.6 * SR));
    // a resonator: s[i] = 2 r cos(w) s[i-1] - r^2 s[i-2], the decaying sine a r^i sin(w i)
    const c1 = 2 * r * Math.cos(w);
    const c2 = r * r;
    let s1 = (-q.a * Math.sin(w)) / r;
    let s2 = (-q.a * Math.sin(2 * w)) / (r * r);
    for (let i = 0; i < len; i += 1) {
      const s = c1 * s1 - c2 * s2;
      s2 = s1;
      s1 = s;
      y[i] += s;
    }
  }
  // the soundboard: warm around 300 Hz, nothing below 60 Hz
  let out = biquad(y, "peaking", 300, 0.9, 3);
  out = onePole(out, 55, "highpass");
  fade(out, 0.003, 0.03); // the flesh of the finger: a 3 ms raised-cosine onset
  return normalize(out, 0.9);
}

/** An octave harmonic: the string touched at its middle. Almost a pure sine an octave up. */
function harmonicSamples(m) {
  const f = 2 * hz(m);
  const n = samples(1.6);
  const y = new Float32Array(n);
  const parts = [{ f, a: 1, t60: 1.5 }, { f: 2 * f, a: 0.06, t60: 0.5 }];
  for (const q of parts) {
    const w = (2 * Math.PI * q.f) / SR;
    const d = Math.exp(-6.9078 / (q.t60 * SR));
    let g = q.a;
    for (let i = 0; i < n; i += 1) {
      y[i] += g * Math.sin(w * i);
      g *= d;
    }
  }
  fade(y, 0.002, 0.05);
  return normalize(y, 0.9);
}

// ---------------------------------------------------------------- the sistrum

/** One shake: the forward stroke (dense), a rebound (sparser), a few last discs settling. */
function sistrumSamples(v) {
  const r = rng(2200 + 17 * v);
  const n = samples(0.3);
  const y = new Float32Array(n);
  const clicks = [[0, 1]];
  for (let i = 0; i < 26; i += 1) clicks.push([0.055 * r() ** 1.6, 0.35 + 0.55 * r()]);
  for (let i = 0; i < 14; i += 1) clicks.push([0.105 + 0.05 * r() ** 1.3, 0.2 + 0.35 * r()]);
  for (let i = 0; i < 7; i += 1) clicks.push([0.17 + 0.07 * r(), 0.06 + 0.12 * r()]);
  for (const [at, amp] of clicks) {
    const o = Math.round(at * SR);
    for (let j = 0; j < 3; j += 1) {
      const f = 3800 + 5200 * r();
      const t60 = 0.012 + 0.03 * r();
      const w = (2 * Math.PI * f) / SR;
      const d = Math.exp(-6.9078 / (t60 * SR));
      const len = Math.min(n - o, Math.ceil(t60 * SR));
      let g = amp * (0.5 + 0.5 * r());
      const ph = 2 * Math.PI * r();
      // each disc speaks over a fraction of a millisecond
      for (let i = 0; i < len; i += 1) {
        const rise = i < 24 ? 0.5 - 0.5 * Math.cos((Math.PI * i) / 24) : 1;
        y[o + i] += g * rise * Math.sin(w * i + ph);
        g *= d;
      }
    }
  }
  const out = biquad(y, "highpass", 2500, 0.7);
  fade(out, 0.0005, 0.03);
  return normalize(out, 0.9);
}

// ---------------------------------------------------------------- players

const LEVEL = { harp: 0.215, harmonic: 0.04, sistrum: 0.1 };
const ROOM = { seconds: 0.9, t60: 0.8, bright: 0.45, predelay: 0.006, early: 0.5, seed: 202 };

/** Notes the score and the outro may ask for: the D major scale from A2 to D5. */
const SCALE_PC = [2, 4, 6, 7, 9, 11, 1];
const HARP_NOTES = [];
for (let m = midi("A2"); m <= midi("D5"); m += 1) if (SCALE_PC.includes(((m % 12) + 12) % 12)) HARP_NOTES.push(m);

const harpBuf = (k, m) => k.buffer(`egypt/harp/${m}`, () => harpSamples(m));

/**
 * One plucked string. ev.midi, ev.vel; ev.damp: seconds after the pluck at which the
 * string is damped (the fade ends there); ev.fade: how long the damping takes.
 */
function harp(k, g, when, ev) {
  const buf = harpBuf(k, ev.midi);
  const pan = Math.max(-0.3, Math.min(0.3, (ev.midi - 62) * 0.015));
  const opts = { gain: LEVEL.harp * ev.vel, pan };
  if (ev.damp !== undefined && ev.damp < buf.duration) {
    opts.dur = ev.damp;
    opts.fade = ev.fade || 0.06;
  }
  const { out } = k.play(buf, when, opts, g.out);
  if (g.send) out.connect(g.send);
}

function harmonic(k, g, when, ev) {
  const buf = k.buffer(`egypt/harmonic/${ev.midi}`, () => harmonicSamples(ev.midi));
  const { out } = k.play(buf, when, { gain: LEVEL.harmonic * ev.vel, pan: 0.08 }, g.out);
  if (g.send) out.connect(g.send);
}

function sistrum(k, g, when, ev) {
  const buf = k.buffer(`egypt/sistrum/${ev.variant}`, () => sistrumSamples(ev.variant));
  const { out } = k.play(buf, when, { gain: LEVEL.sistrum * ev.vel, pan: 0.22 }, g.out);
  if (g.send) out.connect(g.send);
}

// ---------------------------------------------------------------- the part

export default {
  prepare() {
    prepareReverb("egypt/room", ROOM);
    for (const m of HARP_NOTES) sharedBuffer(`egypt/harp/${m}`, () => harpSamples(m));
    sharedBuffer(`egypt/harmonic/${midi("A4")}`, () => harmonicSamples(midi("A4")));
    for (let v = 0; v < 3; v += 1) sharedBuffer(`egypt/sistrum/${v}`, () => sistrumSamples(v));
  },

  graph(k, out) {
    const room = k.reverb("egypt/room", ROOM);
    const send = k.gain(0.18);
    send.connect(room).connect(out);
    return { send };
  },

  score(s) {
    const tune = s.theme();
    const BRAKE_DAMP = 1.95; // the harpist's hand is on the strings by then
    const LAST = 7.0; // the last strings are damped by u = 7
    const pluck = (u, dur, m, vel, more = {}) => s.note(harp, u, dur, m, vel, more);
    const SHAKE_LAG = 0.02; // the light shakes: a little behind the chain's ticks
    const SWEEP_DAMP = 3.6; // the sweep is damped by then (fade 0.15 s), before the hurried A4

    // ---- bar 1 (u 0-1.75): the tune in time, octave below on the cells' first notes, a low string under them
    for (const nt of tune.filter((x) => x.beat < 4)) {
      const damp = BRAKE_DAMP - nt.u;
      const last = nt.beat === 3.5;
      // the last eighth is damped short: it sounds only until the brake
      pluck(nt.u, last ? damp - 0.06 : nt.dur, nt.midi, nt.skeleton ? 0.9 : 0.75, { lead: true, damp, fade: 0.07, label: "harp tune" });
      if (nt.skeleton) pluck(nt.u, nt.dur, nt.midi - 12, 0.55, { damp, fade: 0.07, label: "harp octave" });
    }
    pluck(1.0, 1.0, midi("D3"), 0.5, { damp: BRAKE_DAMP - 1.0, fade: 0.07, label: "harp low string" });
    // the light shakes sit a player's 20 ms behind the beat, off the chain's grid, so the ticks do not cover them
    s.at(0.5 + SHAKE_LAG, sistrum, { variant: 0, vel: 0.55, dur: 0.25, label: "sistrum" });
    s.at(1.5 + SHAKE_LAG, sistrum, { variant: 1, vel: 0.55, dur: 0.25, label: "sistrum" });

    // ---- u 2.0: the pose. B4 with the octave and the fifth below, spread up to land on the beat
    pluck(1.96, 0.9, midi("B3"), 0.6, { label: "harp pose chord" });
    pluck(1.98, 0.9, midi("E4"), 0.62, { label: "harp pose chord" });
    pluck(2.0, 1.0, midi("B4"), 0.95, { lead: true, label: "harp pose chord" });
    s.at(2.0, sistrum, { variant: 2, vel: 1, dur: 0.25, label: "sistrum" });

    // ---- u 2.5: the blink. One octave harmonic of the A string, alone
    s.note(harmonic, 2.5, 1.2, midi("A4"), 1, { label: "harp harmonic" });

    // ---- u 3.0: release. A quick sweep up the five notes, D4 to D5, damped by 3.6 so the hurried tune is clear
    ["D4", "E4", "F#4", "A4", "B4", "D5"].forEach((nm, i) => {
      const u = 3.0 + 0.06 * i;
      pluck(u, 0.3, midi(nm), 0.5 + 0.04 * i, { free: true, damp: SWEEP_DAMP - u, fade: 0.15, label: "harp sweep" });
    });

    // ---- u 3.619-5.754: the rest of the tune on the ridden clock
    const rest = tune.filter((x) => x.beat >= 5);
    rest.forEach((nt, i) => {
      const u = s.ridden(nt.beat);
      const next = i + 1 < rest.length ? s.ridden(rest[i + 1].beat) : 6;
      pluck(u, next - u, nt.midi, nt.skeleton ? 0.9 : 0.75, { lead: true, damp: LAST - u, fade: 0.4, label: "harp tune" });
      if (nt.skeleton && nt.beat < 10) pluck(u, next - u, nt.midi - 12, 0.55, { damp: LAST - u, fade: 0.4, label: "harp octave" });
    });
    // low strings on the cells: A2 under the E, D3 under the F#, D3 under the low B
    [[6, "A2"], [8, "D3"], [10, "D3"]].forEach(([b, nm]) => {
      const u = s.ridden(b);
      pluck(u, 0.6, midi(nm), 0.5, { damp: LAST - u, fade: 0.4, label: "harp low string" });
    });
    // the sistrum keeps the hurried beats
    [7, 9, 11].forEach((b, i) => s.at(s.ridden(b) + SHAKE_LAG, sistrum, { variant: i % 3, vel: 0.55, dur: 0.25, label: "sistrum" }));

    s.cue(0, "the pelican comes through the frame onto the wall");
    s.cue(2.0, "the pose locks: the sistrum shakes", { band: [5000, 12000] });
    s.cue(2.5, "the one blink: a harmonic", { band: [820, 940] });
    s.cue(3.0, "release: the sweep");
  },

  /** The outro's note of this section: one plucked string. */
  lead(k, g, when, ev) {
    harp(k, g, when, { midi: ev.midi, vel: ev.vel === undefined ? 1 : ev.vel });
  },
  leadOctave: 0,
  bike: { chain: 1, bell: 1 },
};
