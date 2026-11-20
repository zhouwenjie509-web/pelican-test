// Section 14 (nosferatu): the cinema's own music for a silent film.
//
// An upright piano down at the front plays the film's tune in the minor, as if
// it had always been a horror theme: the right hand in octaves, the left hand
// the silent-film player's tremolo. Under it a pipe organ's deep pedal D grows.
// Bar 2: on the first stair (u 2.0) the left hand starts to climb a semitone
// every eighth; on the strong beat (u 3.0), as the feather fingers spring out,
// the full organ comes in at once on a diminished seventh over the deep D with
// the tune's E on top; on the next downbeat (u 4.0) it is gone, one soft high
// stop holds A and the door at the head of the stairs creaks open. Bar 3: the
// piano alone, low and quiet. From u 5.5 the outline burns: sparks and a
// rising buzz, which let go just after the frame. All the while the projector
// runs at 18 frames a second, barely there.
//
// How the sounds are made (all computed here, nothing recorded):
//   piano      per note, two or three strings a few cents apart, each a sum of
//              decaying partials with a piano string's stretch (inharmonicity),
//              struck an eighth of the way along (so the 8th partial is weak),
//              upper partials dying faster; a wooden thump of the case and the
//              hammer felt in the attack; a boxy EQ. One buffer per pitch,
//              computed in prepare(); the damper is a short fade at the note's end.
//   organ      oscillators with fixed harmonic recipes per rank (stopped
//              bourdon, open principal, flute, a bright reed), no vibrato, a
//              puff of band-passed noise (about 50 ms) as each pipe speaks.
//   projector  one 6 s buffer: a dry claw-and-shutter tick on every film frame
//              (u = k/18), a soft flutter of noise at the same rate, a faint
//              motor hum.
//   door       one buffer: the latch's knock, then a stick-slip squeal (a pulse
//              train with a few harmonics, through a wooden resonance) that slides
//              upward, wavers, and stops and starts.
//   fire       one buffer: random sparks (very short bright noise bursts) whose
//              rate grows, and a rising buzz kept below 1.2 kHz, so the bell's
//              entrance at u = 6 stays clear.
//   cinema     a 2.8 s dark room.

import { prepareReverb, sharedBuffer } from "../engine/kit.js";
import { SR, rng, white, pink, biquad, onePole, envelope, fade, mixInto, normalize, modal, samples } from "../engine/dsp.js";
import { hz, midi } from "../engine/theory.js";

const ID = "nosferatu";
/** Levels of the instruments (linear, at vel 1). */
const LV = { piano: 0.42, organ: 0.083, projector: 0.06 * 2.82, door: 0.13, fire: 0.16 };
/** The piano of bars 1 and 2 (under the full organ's entry) and the full organ itself, against the rest. */
const BARS12 = 10 ** (-4 / 20);
const FULL = 10 ** (1.2 / 20);
/** The door's squeal against its latch. */
const CREAK = 10 ** (13 / 20);
/** The piano's bar-3 entry under the door (the first 0.3 s). */
const DUCK = 0.7;
const ROOM = { seconds: 2.8, t60: 2.0, bright: 0.22, predelay: 0.022, early: 0.3, seed: 1922 };

// ---------------------------------------------------------------- the piano

/** Strings per note and their tuning in cents: an upright a little out of tune (mean 0). */
function stringsFor(m) {
  if (m < 40) return [-1.5, 1.5];
  if (m < 50) return [-2.5, 2.5];
  return [-2.5, 0.5, 2.0];
}

/**
 * A sum of decaying sines, like dsp.modal, but each partial is computed only until it has
 * fallen 80 dB (the upper partials of a piano die in a fraction of the buffer).
 */
function ring(partials, seconds) {
  const n = samples(seconds);
  const y = new Float32Array(n);
  for (const p of partials) {
    if (!(p.f > 0) || p.f >= SR / 2) continue;
    const w = (2 * Math.PI * p.f) / SR;
    const r = Math.exp(-6.9078 / (p.t60 * SR));
    const c1 = 2 * r * Math.cos(w);
    const c2 = r * r;
    let s1 = (p.a * Math.sin(p.phase - w)) / r;
    let s2 = (p.a * Math.sin(p.phase - 2 * w)) / (r * r);
    const len = Math.min(n, Math.ceil(p.t60 * SR * (80 / 60)));
    for (let i = 0; i < len; i += 1) {
      const v = c1 * s1 - c2 * s2;
      s2 = s1;
      s1 = v;
      y[i] += v;
    }
  }
  return fade(y, 0.0012, 0.02);
}

/** One piano note, struck at a fixed strength (velocity is a gain at playback). */
function pianoSamples(m, seconds) {
  const f0 = hz(m);
  // inharmonicity: stiffer, shorter strings in the treble of a small upright
  const B = m < 45 ? 0.00018 : 0.00012 * 2 ** ((m - 45) / 18);
  // the fundamental's ring: long in the bass, shorter above; an upright rings less than a grand
  const T1 = Math.max(1.3, Math.min(5.5, 3.2 * Math.sqrt(262 / f0)));
  const partials = [];
  const strings = stringsFor(m);
  // one hammer strikes all the strings of a note at once: each partial starts at the same phase on every string
  for (const [si, cents] of strings.entries()) {
    const detune = 2 ** (cents / 1200);
    for (let k = 1; k <= 24; k += 1) {
      const f = k * f0 * Math.sqrt(1 + B * k * k) * detune;
      if (f > 6000) break;
      // struck at 1/8 of the length; a felt hammer rolls the top off
      const hammer = Math.abs(Math.sin(Math.PI * k * 0.125)) / k ** 0.9 / (1 + (f / 2600) ** 2);
      if (hammer < 1e-4) continue;
      const t60 = T1 / (1 + 0.9 * (f / 900) ** 1.1);
      partials.push({ f, a: hammer / strings.length, t60, phase: 2.39996 * k * k + 0.12 * si });
    }
  }
  const y = ring(partials, seconds);
  // the case and the felt: a short wooden thump and a dull knock
  const thump = modal(
    [
      { f: 96, a: 0.6, t60: 0.09 },
      { f: 172, a: 0.45, t60: 0.07 },
      { f: 247, a: 0.3, t60: 0.05 },
    ],
    0.15,
    { attack: 0.001 },
  );
  const knock = onePole(white(samples(0.02), 60 + m), 900);
  envelope(knock, [[0, 0], [0.0008, 1], [0.006, 0.3], [0.02, 0]]);
  mixInto(thump, knock, 0, 1.2);
  normalize(y, 0.8);
  mixInto(y, normalize(thump, 1), 0, 0.12);
  // boxy rather than brilliant
  let z = biquad(y, "peaking", 650, 1.1, 3.5);
  z = biquad(z, "lowpass", 4200, 0.7);
  z = biquad(z, "highpass", 32, 0.7);
  return normalize(fade(z, 0.001, 0.03), 0.9);
}

const DAMP = 0.09; // seconds for the damper to stop the strings
/** Two lengths of buffer: the score's notes are all half a beat or shorter; the outro's may be long. */
const SHORT = 0.75;
const LONG = 2.0;
const pianoLen = (dur) => (dur + DAMP <= SHORT - 0.02 ? SHORT : LONG);
const pianoKey = (m, len) => `${ID}/piano/${m}/${len}`;

/** ev.damp: a quicker damper (the tremolo's strokes, which must be silent before their key is struck again). */
function piano(k, g, when, ev) {
  const len = pianoLen(ev.dur);
  const buf = k.buffer(pianoKey(ev.midi, len), () => pianoSamples(ev.midi, len));
  const damp = ev.damp || DAMP;
  const dur = Math.min(buf.duration - 0.01, ev.dur + damp);
  const { out } = k.play(buf, when, { dur, fade: damp, gain: LV.piano * ev.vel, pan: ev.pan === undefined ? -0.15 : ev.pan }, g.piano || g.out);
  if (g.send) out.connect(g.send);
}

// ---------------------------------------------------------------- the organ

/** Harmonic recipes of the ranks. */
const RANKS = {
  bourdon: [0, 1, 0.04, 0.16, 0.02, 0.06, 0, 0.02], // stopped pipe: odd harmonics
  flute: [0, 1, 0.12, 0.05, 0.02],
  principal: [0, 1, 0.5, 0.32, 0.2, 0.13, 0.08, 0.06, 0.04, 0.03, 0.02],
  reed: [0, ...Array.from({ length: 28 }, (_, i) => 0.9 / (i + 1) ** 0.75)],
};
/**
 * A rank's wave with its harmonics at fixed, scattered phases (a real pipe's are not aligned):
 * a lower crest. `variant` (0..6) also turns the fundamental, so that two pipes sounding the
 * same pitch (an 8' C#4 and the 4' of C#3) do not start in step and add up to a peak.
 */
function rankWave(k, rank, variant) {
  const amps = RANKS[rank];
  const r = rng(77 + rank.length * 13 + variant * 101);
  const sines = amps.map(() => 0);
  const cosines = amps.map(() => 0);
  for (let i = 1; i < amps.length; i += 1) {
    const ph = 2 * Math.PI * r();
    sines[i] = amps[i] * Math.cos(ph);
    cosines[i] = amps[i] * Math.sin(ph);
  }
  return k.wave(`${ID}/${rank}/${variant}`, sines, cosines);
}

/** Stops: [rank, pitch ratio (16' = 0.5, 8' = 1, 4' = 2, 2' = 4), level, cents]. */
const STOPS = {
  pedalSoft: [["bourdon", 0.5, 0.3, 0], ["flute", 1, 0.55, 0.5]],
  pedalFull: [["reed", 0.5, 0.2, 0], ["principal", 1, 0.6, -0.5], ["principal", 2, 0.35, 0.5]],
  manualSoft: [["flute", 1, 1, 0]],
  manualFull: [["principal", 1, 1, 0], ["principal", 2, 0.6, 0.6], ["principal", 4, 0.35, -0.6], ["reed", 1, 0.45, 0.3]],
  highSoft: [["flute", 1, 1, 0]],
};

/**
 * One key held on the organ. ev: midi, dur, vel, stop (a key of STOPS), shape (gain points
 * [dt, fraction] after the attack, optional), attack, pan.
 */
function organ(k, g, when, ev) {
  const off = ev.offset || 0;
  const t0 = when - off; // the note's own start (seekable notes may be called late)
  const f = hz(ev.midi);
  const attack = ev.attack || 0.025;
  const rel = ev.release || 0.05;
  const end = t0 + ev.dur + rel;
  const level = LV.organ * ev.vel;
  const amp = k.gain(0);
  const p = k.pan(ev.pan || 0);
  const pts = [[0, 0], [attack, level * (ev.shape ? ev.shape[0][1] : ev.speak || 1)]];
  if (ev.speak) pts.push([attack + 0.09, level]);
  if (ev.shape) for (const [dt, v] of ev.shape) if (dt > attack) pts.push([dt, level * v]);
  pts.push([ev.dur, level * (ev.shape ? ev.shape[ev.shape.length - 1][1] : 1)], [ev.dur + rel, 0]);
  k.env(amp.gain, t0, pts);
  for (const [ri, [rank, ratio, lv, cents]] of STOPS[ev.stop].entries()) {
    const fr = f * ratio;
    if (fr > 9000) continue;
    const o = k.osc(rankWave(k, rank, (ev.midi * 3 + ri * 5) % 7), fr, Math.max(when, t0), end + 0.01, cents);
    const gl = k.gain(lv);
    o.connect(gl).connect(amp);
  }
  // the puff: air before the pipe settles
  if (off < 0.05 && !ev.noPuff) {
    // (the shared noise is about 0.58 rms and a band of it far less: the factor 6 brings the puff to about the tone's own level)
    const n = k.noise("white", when, when + 0.07, { phase: (ev.midi * 0.137) % 5, seed: 14 });
    const bp = k.filter("bandpass", Math.min(4200, f * 3), 1.4);
    const pg = k.gain(0);
    const puff = 6 * level * (ev.puff || 0.5);
    k.env(pg.gain, when, [[0, 0], [0.003, puff], [0.02, puff * 0.4], [0.05, 0]]);
    k.chain(n, bp, pg, p);
  }
  amp.connect(p).connect(g.organ || g.out); // the organ's bus sends to the room itself
}

// ---------------------------------------------------------------- the projector

const PROJ_LEN = 5.965;
function projectorSamples() {
  const n = samples(PROJ_LEN);
  const y = new Float32Array(n);
  const r = rng(1818);
  // the claw and shutter: a dry tick on every film frame
  for (let f = 0; f / 18 < PROJ_LEN - 0.02; f += 1) {
    const tick = biquad(white(samples(0.02), 300 + f), "bandpass", 1300 + 300 * r(), 0.9);
    envelope(tick, [[0, 0], [0.0006, 1], [0.004, 0.25], [0.012, 0.04], [0.02, 0]]);
    const thud = modal([{ f: 150 + 10 * (f % 2), a: 0.5, t60: 0.03 }], 0.03, { attack: 0.0008 });
    const a = 0.75 + 0.25 * r();
    mixInto(y, tick, f / 18, a);
    mixInto(y, thud, f / 18, 0.25 * a);
  }
  // the flutter of the shutter: soft noise, pulsing with the frames
  const fl = onePole(onePole(pink(n, 77), 1100), 1100);
  for (let i = 0; i < n; i += 1) {
    const ph = ((i / SR) * 18) % 1;
    y[i] += 0.5 * fl[i] * (0.25 + 0.75 * Math.exp(-ph * 6));
  }
  // the motor: a faint hum
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    y[i] += 0.012 * (Math.sin(2 * Math.PI * 100 * t) + 0.5 * Math.sin(2 * Math.PI * 200 * t + 1) + 0.25 * Math.sin(2 * Math.PI * 300 * t + 2));
  }
  const z = biquad(y, "lowpass", 3000, 0.7);
  return normalize(fade(z, 0.002, 0.04), 0.9);
}

function projector(k, g, when, ev) {
  const buf = k.buffer(`${ID}/projector`, projectorSamples);
  const off = ev.offset || 0;
  k.play(buf, when, { offset: off, dur: PROJ_LEN - off, fade: 0.002, gain: LV.projector * ev.vel, pan: 0.3 }, g.out);
}

// ---------------------------------------------------------------- the door

const DOOR_LEN = 0.66;
function doorSamples() {
  const n = samples(DOOR_LEN);
  const y = new Float32Array(n);
  const r = rng(404);
  // the latch lets go: iron and oak, very short
  const knock = modal(
    [
      { f: 870, a: 0.6, t60: 0.04 },
      { f: 1730, a: 0.5, t60: 0.03 },
      { f: 3150, a: 0.4, t60: 0.02 },
      { f: 5300, a: 0.35, t60: 0.015 },
      { f: 7400, a: 0.4, t60: 0.012 },
      { f: 8300, a: 0.3, t60: 0.008 },
    ],
    0.06,
    { attack: 0.0004 },
  );
  const click = biquad(white(samples(0.01), 405), "bandpass", 7500, 1.2);
  envelope(click, [[0, 0], [0.0003, 1], [0.003, 0.1], [0.01, 0]]);
  mixInto(knock, click, 0, 0.8);
  mixInto(y, normalize(knock, 1), 0, 1.0);
  // the hinge: stick-slip, a pulse train that slides upward and stops and starts
  const sq = new Float32Array(n);
  let ph = 0;
  let jitter = 1;
  const segs = [[0.025, 0.16], [0.2, 0.33], [0.37, 0.47], [0.5, 0.6]];
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    let gate = 0;
    for (const [a, b] of segs) {
      if (t >= a && t <= b) gate = Math.min(1, (t - a) / 0.012, (b - t) / 0.015);
    }
    const x = Math.min(1, t / 0.6);
    const rate = (950 + 450 * x * x) * (1 + 0.035 * Math.sin(2 * Math.PI * 6.3 * t) + 0.02 * Math.sin(2 * Math.PI * 11.1 * t + 1)) * jitter;
    ph += rate / SR;
    if (ph >= 1) {
      ph -= 1;
      jitter = 1 + (r() - 0.5) * 0.06;
    }
    let v = 0;
    for (let h = 1; h <= 4; h += 1) v += Math.sin(2 * Math.PI * h * ph) / h ** 1.4;
    sq[i] = v * gate * (0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, t / 0.6)));
  }
  const res = biquad(sq, "bandpass", 2300, 2.5);
  mixInto(y, sq, 0, 0.18 * CREAK);
  mixInto(y, res, 0, 0.5 * CREAK);
  // scaled so that the latch (alone in the first 25 ms) peaks at 0.9, as it always has: the squeal stands above it
  const z = fade(biquad(y, "highpass", 200, 0.7), 0.0005, 0.02);
  let pk = 0;
  for (let i = 0; i < samples(0.025); i += 1) pk = Math.max(pk, Math.abs(z[i]));
  for (let i = 0; i < z.length; i += 1) z[i] *= 0.9 / pk;
  return z;
}

function door(k, g, when, ev) {
  const buf = k.buffer(`${ID}/door`, doorSamples);
  const { out } = k.play(buf, when, { gain: LV.door * ev.vel, pan: 0.35 }, g.out);
  if (g.send) out.connect(g.send);
}

// ---------------------------------------------------------------- the fire

const FIRE_LEN = 0.585; // u 5.5 to 6.085
const SPARKS_END = 0.445; // the fire reaches the tail at u 5.95
function fireSamples() {
  const n = samples(FIRE_LEN);
  const y = new Float32Array(n);
  const r = rng(1514);
  // sparks: rate and strength grow towards the frame
  let t = 0.004;
  let s = 0;
  while (t < SPARKS_END - 0.006) {
    const x = t / SPARKS_END;
    const len = 0.0015 + 0.003 * r();
    const burst = biquad(white(samples(len + 0.004), 1600 + s), "bandpass", 2400 + 4800 * r(), 1.1);
    envelope(burst, [[0, 0], [0.0002, 1], [len * 0.5, 0.3], [len, 0.05], [len + 0.004, 0]]);
    mixInto(y, burst, t, (0.35 + 0.65 * r()) * (0.4 + 0.6 * x));
    if (r() < 0.2) {
      const pop = biquad(white(samples(0.008), 1700 + s), "bandpass", 900 + 600 * r(), 1.5);
      envelope(pop, [[0, 0], [0.0004, 1], [0.003, 0.2], [0.008, 0]]);
      mixInto(y, pop, t, 0.5 * (0.4 + 0.6 * x));
    }
    t += -Math.log(1 - r() * 0.95) / (25 + 140 * x);
    s += 1;
  }
  // the buzz: a rising electric hum, low and kept below the bell
  const bz = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i += 1) {
    const tt = i / SR;
    const f = 96 + 50 * Math.min(1, tt / 0.5);
    ph += f / SR;
    ph -= Math.floor(ph);
    const saw = 2 * ph - 1;
    const grow = tt < 0.5 ? (tt / 0.5) ** 2 : Math.max(0, 1 - (tt - 0.5) / 0.08);
    bz[i] = Math.tanh(2.5 * saw) * grow;
  }
  let b = biquad(bz, "lowpass", 1000, 0.7);
  b = biquad(b, "lowpass", 1000, 0.7);
  b = biquad(b, "highpass", 70, 0.7);
  mixInto(y, b, 0, 0.35);
  return normalize(fade(y, 0.001, 0.005), 0.9);
}

function fire(k, g, when, ev) {
  const buf = k.buffer(`${ID}/fire`, fireSamples);
  k.play(buf, when, { gain: LV.fire * ev.vel, pan: 0 }, g.out);
}

// ---------------------------------------------------------------- the score

const M = (name) => midi(name);

export default {
  prepare() {
    prepareReverb(`${ID}/hall`, ROOM);
    for (const m of USED.short) sharedBuffer(pianoKey(m, SHORT), () => pianoSamples(m, SHORT));
    for (const m of USED.long) sharedBuffer(pianoKey(m, LONG), () => pianoSamples(m, LONG));
    sharedBuffer(`${ID}/projector`, projectorSamples);
    sharedBuffer(`${ID}/door`, doorSamples);
    sharedBuffer(`${ID}/fire`, fireSamples);
  },

  graph(k, out) {
    const room = k.reverb(`${ID}/hall`, ROOM);
    const send = k.gain(0.32);
    send.connect(room).connect(out);
    const pianoBus = k.gain(1);
    pianoBus.connect(out);
    const organBus = k.gain(1);
    // the organ is heard from up in the loft: its top is soft
    const loft = k.chain(organBus, k.filter("lowpass", 3200, -2), k.filter("lowpass", 3200, -2));
    loft.connect(out);
    loft.connect(send);
    return { send, piano: pianoBus, organ: organBus };
  },

  score(s) {
    const tune = s.theme({ scale: "minor" });

    // ---- the projector, under the whole section
    s.at(0, projector, { dur: PROJ_LEN, vel: 1, seekable: true, label: "projector" });

    // ---- right hand: the tune in octaves (bars 1 and 2, up to the held E)
    for (let i = 0; i <= 8; i += 1) {
      const n = tune[i];
      // the eighths before the top and before the organ light; the top (u 2.0) no louder than the notes round it
      const v = BARS12 * (i === 0 || i === 6 ? 0.78 : i === 5 || i === 8 ? 0.62 : n.skeleton ? 0.9 : 0.78);
      const d = i === 5 ? 0.12 : n.dur - 0.03; // a lift before the top of the tune
      s.note(piano, n.u, d, n.midi, v, { lead: true, label: "piano tune" });
      s.note(piano, n.u, d, n.midi + 12, v * 0.7, { label: "piano octave" });
    }
    // bar 3: low and quiet, the octave below
    for (let i = 10; i <= 15; i += 1) {
      const n = tune[i];
      // under the creaking door (u 4.0 to 4.6) the pianist plays softer: the door is heard opening
      const v = (n.skeleton ? 0.72 : 0.64) * (i === 10 ? DUCK : i === 11 ? 0.8 : 1);
      const d = i === 15 ? 0.16 : n.dur - 0.03; // the last one damped by u 6.0
      s.note(piano, n.u, d, n.midi, v, { lead: true, label: "piano tune" });
      s.note(piano, n.u, d, n.midi - 12, v * 0.75, { label: "piano octave" });
    }

    // ---- left hand: the tremolo, rocking in thirty-seconds
    const T = 1 / 16;
    // each stroke is damped (len + TDAMP = 0.12 s) before its key is struck again, 2T = 0.125 s later
    const TDAMP = 0.045;
    const rock = (u0, count, lo, hi, vel, grow = 0, len = 0.075) => {
      for (let j = 0; j < count; j += 1) {
        const u = u0 + j * T;
        s.note(piano, u, len, j % 2 ? hi : lo, vel * (1 + (grow * j) / count), { label: "piano tremolo", pan: -0.25, damp: TDAMP });
      }
    };
    rock(0, 32, M("D3"), M("A3"), 0.24 * BARS12, 0.25); // bar 1: D and A
    // bar 2: the climb, a semitone every eighth, rocking on octaves (D, Eb, E, F, F#, G, G#, A)
    // (a breath before the organ: the F's last stroke is left out and the others are damped before u 3.0)
    for (let j = 0; j < 8; j += 1) {
      if (j === 3) rock(2.75, 3, M("F2"), M("F3"), 0.325 * BARS12, 0, T * 0.8);
      else rock(2 + j * 0.25, 4, M("D2") + j, M("D3") + j, BARS12 * (0.25 + 0.025 * j) * (j >= 4 ? 0.45 : 1)); // under the full organ from u 3.0
    }
    rock(4, 5, M("D2"), M("A2"), 0.17 * DUCK); // bar 3: D and A, softer for the door's first 0.3 s ...
    rock(4.3125, 11, M("A2"), M("D2"), 0.17); // ... then as before (the same rocking, from its sixth stroke)
    rock(5, 8, M("Bb1"), M("F2"), 0.16); // under Bb ...
    rock(5.5, 4, M("A1"), M("E2"), 0.15); // ... A ...
    rock(5.75, 2, M("Bb1"), M("F2"), 0.14); // ... Bb, the last stroke at u 5.8125

    // ---- the organ
    // the deep pedal D, very soft, growing (more from the first stair), into the full organ
    s.note(organ, 0, 4.0, M("D2"), 1, {
      stop: "pedalSoft",
      attack: 0.08,
      shape: [[0.08, 0.05], [2.0, 0.15], [3.0, 0.32], [3.02, 0.4]],
      seekable: true,
      label: "organ pedal",
    });
    // from the first stair a quiet flute fifth swells in the manual
    s.note(organ, 2.0, 1.0, M("D3"), 0.6, { stop: "manualSoft", attack: 0.06, shape: [[0.3, 0.3], [0.85, 0.7], [1.0, 0.55]], release: 0.03, label: "organ swell", pan: -0.1 });
    s.note(organ, 2.0, 1.0, M("A3"), 0.6, { stop: "manualSoft", attack: 0.06, shape: [[0.3, 0.3], [0.85, 0.7], [1.0, 0.55]], release: 0.03, label: "organ swell", pan: 0.1 });
    // u 3.0: full organ, at once. A diminished seventh over the deep D, the tune's E on top
    // (the keys go down within a few milliseconds of each other, as a player's hands do; all are released together at u 3.97)
    // (the Bbs lighter and the tune's E heavier, so that the E is the strongest note of the chord)
    const CHORD = [["Bb2", -0.3, 0.003, 0.65], ["C#3", 0.25, 0.006, 0.85], ["E3", -0.15, 0.002, 0.85], ["G3", 0.2, 0.005, 0.85], ["Bb3", -0.2, 0.007, 0.65], ["C#4", 0.15, 0.004, 0.85]];
    for (const [nm, pan, lag, v] of CHORD) s.note(organ, 3.0 + lag, 0.97 - lag, M(nm), FULL * v, { stop: "manualFull", attack: 0.004, speak: 1.2, puff: 1.0, release: 0.04, label: "full organ", pan });
    s.note(organ, 3.0, 0.97, tune[9].midi, FULL * 1.4, { stop: "manualFull", attack: 0.004, speak: 1.2, puff: 1.0, release: 0.04, lead: true, label: "full organ E (tune)" });
    s.note(organ, 3.001, 0.969, M("D2"), FULL * 0.6, { stop: "pedalFull", attack: 0.01, release: 0.04, label: "full organ pedal" });
    // u 4.0: one soft high stop holds A, ending by 5.5
    s.note(organ, 4.0, 1.42, M("A5"), 0.35, { stop: "highSoft", attack: 0.05, release: 0.06, shape: [[0.3, 1], [1.42, 0.7]], label: "organ high A", pan: 0.15 });

    // ---- the door at the head of the stairs, u 4.0
    s.at(4.0, door, { dur: DOOR_LEN, vel: 1, label: "door" });

    // ---- the fire, from u 5.5
    s.at(5.5, fire, { dur: FIRE_LEN, vel: 1, label: "fire" });

    s.cue(0, "the shadow comes through the frame");
    s.cue(2.0, "the front wheel meets the first stair: Bb, the climb begins", { band: [400, 2000] });
    s.cue(3.0, "the feather fingers spring out: full organ");
    s.cue(4.0, "the door opens: latch and creak", { band: [7000, 9000] });
    s.cue(5.5, "the outline ignites: sparks", { band: [3000, 9000], soft: true });
  },

  /** The outro's note of this section: one note of the cinema piano. */
  lead(k, g, when, ev) {
    piano(k, g, when, { ...ev, pan: 0 });
  },
  leadOctave: 0,
  bike: { chain: 0.5, bell: 1 },
};

/**
 * The piano pitches made ahead of time: short ones for everything the score plays, and for the
 * outro's `lead` every pitch of D major from A3 to D5, both short and long (a lead note asks for
 * whichever its length needs), so that no piano buffer is ever made inside a play function.
 */
const USED = (() => {
  const short = new Set();
  const minor = [0, 2, 3, 7, 8];
  for (const o of [-1, 0, 1]) for (const st of minor) short.add(62 + st + 12 * o);
  for (let m = M("A1"); m <= M("A3"); m += 1) short.add(m); // the tremolo and the climb
  const long = [];
  const major = [0, 2, 4, 5, 7, 9, 11]; // D major: D E F# G A B C#
  for (let m = M("A3"); m <= M("D5"); m += 1) if (major.includes((((m - 62) % 12) + 12) % 12)) long.push(m);
  for (const m of long) short.add(m);
  return { short: [...short].sort((x, y) => x - y), long };
})();

// For scratch checks in Node (dev/audio/nosferatu-*.mjs): the sample makers.
export const _nosferatu = { USED, pianoSamples, projectorSamples, doorSamples, fireSamples };
