// Intro (film 0.0 - 5.0): a grave documentary opening for a pelican on a bicycle.
//
// Low strings, a section of each: double basses hold the ground, cellos play
// the first bar of the film's tune at half speed an octave down, violas join
// quietly above from the downbeat at 3.0, where the second subtitle lands, the
// sketch sets off and the bicycle part rings its bell. One soft stroke of a
// large drum under that accent. A dark hall round everything. The strings
// stop on the bar line at 5.0; Section 1 plays the D.
//
// How a bowed string is made here: the bow drives the string in Helmholtz
// motion, a travelling corner whose waveform is a sawtooth (harmonic n at
// 1/n), with the harmonics that have a node at the bowing point missing. That
// spectrum is shaped by the instrument's body (a few broad resonances) and
// rolled off above about 2.5 kHz for a dark, warm low-string sound; it becomes
// one PeriodicWave per pitch. A section is several such voices a few cents
// apart, each with its own vibrato that arrives late on long notes, under one
// bow envelope (the bow catches the string, then the tone grows), with a trace
// of rosin noise that is strongest as the bow takes hold.

import { prepareReverb, sharedBuffer } from "../engine/kit.js";
import { modal, white, onePole, envelope, mixInto, normalize, samples } from "../engine/dsp.js";
import { hz, midi } from "../engine/theory.js";

const HALL = { seconds: 2.4, t60: 2.1, bright: 0.18, predelay: 0.022, early: 0.3, seed: 5 };

// ---------------------------------------------------------------- the string families

/** Body resonances (Hz, gain, width in octaves) and the bowing point, per family. */
const FAMILY = {
  bass: { body: [[62, 0.6, 0.6], [110, 0.9, 0.7], [230, 0.6, 0.8]], beta: 0.12, roll: 1600, voices: 3, level: 0.1 },
  cello: { body: [[105, 0.5, 0.6], [205, 1.0, 0.6], [420, 0.7, 0.8], [1800, 0.25, 1.0]], beta: 0.11, roll: 2400, voices: 4, level: 0.115 },
  viola: { body: [[230, 0.6, 0.6], [400, 1.0, 0.7], [1900, 0.3, 1.0]], beta: 0.1, roll: 2700, voices: 3, level: 0.08 },
};

/** The players of a section: detune (cents), vibrato rate (Hz), vibrato depth (cents), pan offset. */
const DESK = [
  [-7, 5.1, 11, -0.12],
  [3, 5.6, 9, 0.1],
  [8, 4.8, 12, -0.04],
  [-2, 5.35, 10, 0.14],
];

/** Harmonic amplitudes of a bowed note at frequency f for a family: sines[n] for n = 1.. */
function bowedHarmonics(f, fam) {
  const top = Math.max(2, Math.min(48, Math.floor(4400 / f)));
  const sines = new Float32Array(top + 1);
  for (let n = 1; n <= top; n += 1) {
    const fn = n * f;
    // Helmholtz motion bowed at beta: sawtooth with the bow-point comb
    let a = Math.abs(Math.sin(Math.PI * n * fam.beta)) / (n * Math.sin(Math.PI * fam.beta));
    // the body: a floor plus a few broad bumps
    let body = 0.35;
    for (const [fc, g, w] of fam.body) {
      const oct = Math.log2(fn / fc) / w;
      body += g * Math.exp(-oct * oct);
    }
    a *= body;
    // dark: little above the roll-off
    a /= 1 + (fn / fam.roll) ** 4;
    // the lowest fundamentals radiate weakly from a body much smaller than their wavelength
    a *= fn / Math.sqrt(fn * fn + 45 * 45);
    sines[n] = a;
  }
  return sines;
}

/**
 * One note of a string section. ev: midi, dur, vel, family, env (optional
 * [[seconds, level], ...] over the held length, levels 0..1), attack (seconds),
 * release (seconds), pan.
 */
function section(k, g, when, ev) {
  const fam = FAMILY[ev.family];
  const f = hz(ev.midi);
  const dur = ev.dur;
  const release = ev.release || 0.15;
  const end = when + dur + release;
  const wave = k.wave(`intro/${ev.family}/${ev.midi}`, bowedHarmonics(f, fam));

  // the bow: catches the string (fast, partial), then the tone grows (slow)
  const a = ev.attack || 0.2;
  const pts = ev.env || [[0, 0], [Math.min(0.04, a * 0.3), 0.3], [a, 1], [dur, 1]];
  const note = k.gain(0);
  const peakGain = fam.level * ev.vel;
  let last = 0;
  for (const [i, [dt, v]] of pts.entries()) {
    const t = when + dt;
    if (i === 0) note.gain.setValueAtTime(v * peakGain, t);
    else note.gain.linearRampToValueAtTime(v * peakGain, t);
    last = v;
  }
  note.gain.setValueAtTime(last * peakGain, when + dur);
  note.gain.linearRampToValueAtTime(0, end);

  const panner = k.pan(ev.pan || 0);
  note.connect(panner).connect(g.bus || g.out);

  const n = fam.voices;
  for (let i = 0; i < n; i += 1) {
    const [det, rate, depth, pan] = DESK[i];
    const voice = k.gain(1 / Math.sqrt(n));
    const vp = k.pan(Math.max(-1, Math.min(1, pan)));
    const o = k.osc(wave, f, when, end + 0.01, det);
    // vibrato: none while the bow speaks, then it arrives; only on long notes
    if (dur >= 0.45) {
      const lfo = k.osc("sine", rate, when, end + 0.01);
      const amt = k.gain(0);
      const on = Math.min(0.35, dur * 0.5);
      const full = Math.min(0.9, dur * 0.95);
      k.env(amt.gain, when, [[0, 0], [on, 0], [full, depth * Math.min(1, dur / 1.0)], [dur + release, depth * 0.6]]);
      lfo.connect(amt).connect(o.detune);
    }
    o.connect(voice).connect(vp).connect(note);
  }

  // rosin: a breath of noise near the strings' upper partials, strongest as the bow takes hold
  const rosin = k.noise("pink", when, end + 0.01, { phase: (ev.midi * 0.37 + (ev.u || 0) * 1.31) % 6, seed: 3 });
  const bp = k.filter("bandpass", Math.min(2200, f * 7), 0.9);
  const rg = k.gain(0);
  const r0 = 0.05 * peakGain;
  k.env(rg.gain, when, [[0, 0], [0.03, r0], [Math.min(0.25, dur * 0.5), r0 * 0.35], [dur, r0 * 0.3], [dur + release, 0]]);
  rosin.connect(bp).connect(rg).connect(panner);
}

// ---------------------------------------------------------------- the drum

/** A large drum struck softly with a felt mallet: a low thump of inharmonic membrane modes. */
function drumSamples() {
  const f = 55; // A1: the fifth of the key, so the thump does not pull against the D
  const y = modal(
    [
      { f, a: 1.0, t60: 1.5 },
      { f: f * 1.47, a: 0.45, t60: 1.0, phase: 0.7 },
      { f: f * 1.96, a: 0.22, t60: 0.7, phase: 1.9 },
      { f: f * 2.44, a: 0.12, t60: 0.5, phase: 0.4 },
      { f: f * 2.9, a: 0.06, t60: 0.35, phase: 2.6 },
    ],
    2.0,
  );
  // the felt meets the skin: the tone grows over a few milliseconds, not at once
  envelope(y, [[0, 0], [0.004, 1], [2.0, 1]]);
  const felt = onePole(onePole(white(samples(0.04), 77), 420), 420);
  envelope(felt, [[0, 0], [0.0015, 1], [0.012, 0.4], [0.04, 0]]);
  mixInto(y, felt, 0, 2.0);
  return normalize(y, 0.9);
}

function drum(k, g, when, ev) {
  const buf = k.buffer("intro/drum", drumSamples);
  const { out } = k.play(buf, when, { gain: 0.17 * ev.vel, pan: 0.05 }, g.bus);
  out.connect(g.send);
}

// ---------------------------------------------------------------- the part

export default {
  prepare() {
    prepareReverb("intro/hall", HALL);
    sharedBuffer("intro/drum", drumSamples);
  },

  graph(k, out) {
    // everything meets on one bus, darkened once more and kept clear of rumble
    const bus = k.gain(1);
    const lp = k.filter("lowpass", 2700, 0);
    const hp = k.filter("highpass", 36, 0);
    bus.connect(lp).connect(hp).connect(out);
    const send = k.gain(0.24);
    const hall = k.reverb("intro/hall", HALL);
    hp.connect(send).connect(hall).connect(out);
    return { bus, send };
  },

  score(s) {
    const D2 = midi("D2");
    const A2 = midi("A2");
    const LAST = 4.95; // the line and the violas lift their bows here (silent by 5.10)
    const LOW = 4.85; // the low strings a little earlier: their release rings to 5.10
    const cello = (u, dur, m, vel, more = {}) => s.note(section, u, dur, m, vel, { family: "cello", pan: -0.22, lead: true, label: "cellos", ...more });

    // 0.0: the open fifth, from nothing
    // a crescendo from nothing is slow at first: the level follows a curve, not a straight line
    const swell = [[0, 0], [0.2, 0.12], [0.4, 0.45], [0.65, 1], [3.0, 0.9]];
    s.note(section, 0, 3.0, D2, 0.75, { family: "bass", pan: 0.2, env: swell, release: 0.25, label: "basses" });
    s.note(section, 0, 3.0, A2, 0.42, { family: "cello", pan: -0.3, env: [[0, 0], [0.2, 0.12], [0.4, 0.45], [0.65, 1], [1.0, 0.85], [3.0, 0.8]], release: 0.25, label: "cellos (divisi)" });
    s.cue(0, "the page; the open fifth swells in", { soft: true });

    // bar line 1.0: the cellos begin the line, bar 1 of the tune at half speed
    cello(1.0, 1.0, midi("D3"), 0.75, { attack: 0.22, release: 0.12 });
    s.cue(1.0, "the cellos begin the line", { soft: true, band: [120, 700] });
    cello(2.0, 0.5, midi("E3"), 0.75, { attack: 0.15, release: 0.12 });
    // leaning into the next bar
    cello(2.5, 0.5, midi("F#3"), 0.75, { env: [[0, 0], [0.04, 0.3], [0.15, 0.95], [0.5, 1.12]], release: 0.08 });

    // 3.0: line 2 lands, the sketch sets off, the bell rings: sfz, then piano at once, then a slow crescendo
    cello(3.0, 1.0, midi("A3"), 1.0, { env: [[0, 0], [0.025, 1.0], [0.07, 0.85], [0.28, 0.42], [1.0, 0.55]], release: 0.1, label: "cellos sfz-p" });
    cello(4.0, 0.5, midi("F#3"), 1.0, { env: [[0, 0], [0.04, 0.25], [0.12, 0.58], [0.5, 0.64]], release: 0.1 });
    // the bows leave the strings as the bar line arrives, so that Section 1 begins on clean air
    cello(4.5, LAST - 4.5, midi("A3"), 1.0, { env: [[0, 0], [0.04, 0.3], [0.12, 0.66], [LAST - 4.5, 0.74]], release: 0.15 });
    s.cue(3.0, "line 2 lands; the sketch sets off (sfz, the drum)", { band: [40, 120] });

    // basses and the divisi cellos re-strike with the accent and swell to the bar line
    const restrike = [[0, 0], [0.02, 1.0], [0.08, 0.8], [0.3, 0.5], [LOW - 3.0, 0.78]];
    s.note(section, 3.0, LOW - 3.0, D2, 0.75, { family: "bass", pan: 0.2, env: restrike, release: 0.25, label: "basses" });
    s.note(section, 3.0, LOW - 3.0, A2, 0.42, { family: "cello", pan: -0.3, env: restrike, release: 0.25, label: "cellos (divisi)" });
    s.at(3.0, drum, { dur: 2.0, vel: 1, label: "large drum" });

    // violas join quietly above, a sixth over the line
    const viola = (u, dur, m, a, b) => s.note(section, u, dur, m, 1, { family: "viola", pan: 0.3, env: [[0, 0], [0.04, a * 0.3], [Math.min(0.3, dur * 0.6), a], [dur, b]], release: 0.15, label: "violas" });
    viola(3.0, 1.0, midi("F#4"), 0.35, 0.55);
    viola(4.0, 0.5, midi("D4"), 0.6, 0.7);
    viola(4.5, LAST - 4.5, midi("F#4"), 0.7, 0.8);
  },

  // The intro's voice, should anyone want it: one note of the cello section (its own graph not required).
  lead: (k, g, when, ev) => section(k, g, when, { ...ev, family: "cello", pan: ev.pan || 0 }),
  leadOctave: -1,

  // The bicycle while the intro is on screen: the bell as the sketch sets off at 3.0 (the punch line
  // of the second subtitle) and the chain from 3.0 to 5.0, both as written.
  bike: { chain: 1, bell: 1 },
};
