// Section 20 (code): the tune as it is. A clean, close piano plays it simply,
// a quiet synthesizer pad holds the harmony, a sub sine sits under the roots,
// and every line of code that completes rings one small glass note, climbing
// one step of the five notes each time, on the picture's own times (they are
// the drawing, not the tune, so they are off the beat grid on purpose).
//
// How the sounds are made (plain arithmetic, nothing recorded):
//   piano  additive, from the physics of a struck string: partials stretched
//          above whole multiples by the string's stiffness (f_n = n f sqrt(1+B n^2),
//          B larger higher up), a soft felt hammer (strike point 1/8 of the
//          string, steep roll-off above about 1.5 kHz), each partial decaying at
//          its own rate (higher dies faster) in two stages (prompt and after-
//          sound), two strings per note about a cent apart (a slow beat), a 2.5 ms
//          attack, and a felt thump with a short soundboard knock underneath.
//          The damper ends each note with a short fade. Computed in prepare().
//   pad    three sawtooths per note a few cents apart through one low lowpass,
//          0.4 s to speak, very soft (nodes, so the voices can drift against
//          each other).
//   glass  a sine with one quiet partial two octaves up and a quick decay; the
//          bill's note is warmer (a trace of the octave) and rings longer.
//   sub    a sine on the chord roots, an octave under the piano's bass.
//   room   one small warm room, 1.6 s, lightly.

import { prepareReverb, sharedBuffer } from "../engine/kit.js";
import { SR, samples, modal, white, onePole, envelope, mixInto, fade } from "../engine/dsp.js";
import { hz, midi } from "../engine/theory.js";

const ROOM = { seconds: 1.6, t60: 1.3, bright: 0.4, predelay: 0.012, early: 0.3, seed: 20 };

// ---------------------------------------------------------------- the piano

/** String stiffness: inharmonicity coefficient B for a MIDI note (more in the treble). */
const stiffness = (m) => 0.00032 * 2 ** ((m - 62) / 20);

/**
 * One piano note's samples, struck softly. Peak normalised to about 0.9 at D4
 * and following a gentle loudness curve across the keyboard, so that one
 * velocity sounds even from bass to treble.
 */
function pianoSamples(m) {
  const f0 = hz(m);
  const B = stiffness(m);
  const seconds = m < 55 ? 3.2 : 2.6;
  const n = samples(seconds);
  const y = new Float64Array(n);
  const norm = Math.sqrt(1 + B); // so the fundamental itself lands exactly on pitch
  const beta = 0.122; // the hammer strikes about 1/8 of the way along
  const felt = 1000 + 2 * f0; // soft felt: the spectrum falls steeply above this
  const top = Math.min(40, Math.floor(7000 / f0));
  // prompt sound and aftersound: the fundamental's fast decay, scaled with pitch
  const tFast = 4.2 * (294 / f0) ** 0.35;
  const block = 64;
  for (let k = 1; k <= top; k += 1) {
    const fk = (k * f0 * Math.sqrt(1 + B * k * k)) / norm;
    if (fk > 9000) break;
    let a = Math.abs(Math.sin(Math.PI * k * beta)) / k ** 0.9;
    a /= 1 + (fk / felt) ** 4;
    a /= 1 + (fk / 3000) ** 4; // and nothing bright: the felt's own ceiling
    if (a < 1e-4) continue;
    // each partial dies at its own rate: higher ones much faster
    const t60f = tFast / (1 + (fk / 380) ** 1.25);
    const t60s = t60f * 3.6;
    const df = fk * (2 ** (1.15 / 1200) - 1); // the two strings, about a cent apart
    const tauF = t60f / 6.9078;
    const tauS = t60s / 6.9078;
    // a recursive sine at the mean frequency of the two strings
    const w = (2 * Math.PI * fk) / SR;
    const c = Math.cos(w);
    const sn = Math.sin(w);
    let re = Math.cos(0.37 * k);
    let im = Math.sin(0.37 * k);
    for (let i0 = 0; i0 < n; i0 += block) {
      const t = (i0 + block / 2) / SR;
      const env = 0.72 * Math.exp(-t / tauF) + 0.28 * Math.exp(-t / tauS);
      if (env < 2e-5 && t > 0.1) break;
      // two strings of unequal strength beating slowly: |s1 + s2| with s2 at 0.6
      const beat = Math.sqrt(1 + 0.36 + 1.2 * Math.cos(2 * Math.PI * df * t)) / 1.6;
      const g = a * env * beat;
      const end = Math.min(n, i0 + block);
      for (let i = i0; i < end; i += 1) {
        y[i] += g * im;
        const r2 = re * c - im * sn;
        im = re * sn + im * c;
        re = r2;
      }
    }
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) out[i] = y[i];
  // the hammer reaching the string: 2.5 ms, raised cosine
  const att = samples(0.0025);
  for (let i = 0; i < att; i += 1) out[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / att);
  // felt thump and a short knock of the soundboard, under the attack
  const thump = onePole(onePole(white(samples(0.05), 300 + m), 260), 260);
  envelope(thump, [[0, 0], [0.002, 1], [0.012, 0.35], [0.05, 0]]);
  const knock = modal([{ f: 118, a: 1, t60: 0.09 }, { f: 205, a: 0.6, t60: 0.06, phase: 1.1 }], 0.12);
  let p = 0;
  for (let i = 0; i < out.length; i += 1) p = Math.max(p, Math.abs(out[i]));
  mixInto(out, thump, 0, 0.12 * p);
  mixInto(out, knock, 0, 0.05 * p);
  // even loudness across the keyboard: normalise, then a gentle tilt (bass a little fuller)
  const level = 0.9 * (m < 50 ? 1.1 : 1) * 2 ** (-(m - 62) / 60);
  let q = 0;
  for (let i = 0; i < out.length; i += 1) q = Math.max(q, Math.abs(out[i]));
  for (let i = 0; i < out.length; i += 1) out[i] *= level / q;
  return fade(out, 0, 0.05);
}

const pianoKey = (m) => `code/piano/${m}`;

/** One piano note. ev: midi, dur, vel, pan (optional), hand ("R" or "L"). */
function piano(k, g, when, ev) {
  const m = Math.round(ev.midi);
  const buf = k.buffer(pianoKey(m), () => pianoSamples(m));
  const vel = ev.vel === undefined ? 0.8 : ev.vel;
  // the damper: a short fade after the key is released, slower in the bass
  const damp = m < 50 ? 0.22 : m < 62 ? 0.16 : 0.12;
  const len = Math.min(buf.duration - 0.01, Math.max(0.08, ev.dur || 0.5) + damp);
  const pan = ev.pan === undefined ? (m - 60) / 70 : ev.pan; // the keyboard, seen from the bench, narrowly
  const { out } = k.play(buf, when, { dur: len, fade: Math.min(damp, len - 0.02), gain: 0.51 * vel * (ev.hand === "L" ? 0.66 : 1), pan }, g.bus || g.out);
  if (g.send) out.connect(g.send);
}

// ---------------------------------------------------------------- the pad

const PAD_DETUNE = [-6, 0, 5.5];

/** One pad note: three sawtooths a few cents apart through a low lowpass, slow to speak. */
function pad(k, g, when, ev) {
  const f = hz(ev.midi);
  // the attack never outlasts the note, so the envelope's points run forwards in time
  const a = Math.min(0.4, ev.dur * 0.8);
  const r = ev.release || 0.35;
  const end = when + ev.dur + r;
  // two gentle lowpass stages: warm, and nothing of the saw's edge left above a few kHz
  const lp = k.filter("lowpass", ev.cutoff || 760, -2);
  const lp2 = k.filter("lowpass", 1.6 * (ev.cutoff || 760), -3);
  const env = k.gain(0);
  const peak = 0.08 * ev.vel;
  k.env(env.gain, when, [[0, 0], [a, peak], [ev.dur, peak * 0.9], [ev.dur + r, 0]]);
  const p = k.pan(ev.pan || 0);
  lp.connect(lp2).connect(env).connect(p).connect(g.bus || g.out);
  if (g.send) p.connect(g.send);
  for (const det of PAD_DETUNE) {
    const o = k.osc("sawtooth", f, when, end + 0.02, det);
    const v = k.gain(1 / 3);
    o.connect(v).connect(lp);
  }
}

// ---------------------------------------------------------------- the glass

function glassSamples(m, kind) {
  const f = hz(m);
  const warm = kind === "warm";
  const ring = kind === "close";
  const parts = [
    { f, a: 1, t60: warm ? 2.0 : 0.85 },
    { f: f * 4, a: warm ? 0.07 : ring ? 0.25 : 0.1, t60: warm ? 0.35 : 0.22, phase: 0.4 },
  ];
  if (warm) parts.push({ f: f * 2, a: 0.14, t60: 0.9, phase: 1.3 });
  const y = modal(parts, warm ? 2.2 : 1.1, { attack: 0.0012 });
  let p = 0;
  for (let i = 0; i < y.length; i += 1) p = Math.max(p, Math.abs(y[i]));
  for (let i = 0; i < y.length; i += 1) y[i] *= 0.9 / p;
  return y;
}
const glassKey = (m, kind) => `code/glass/${m}/${kind}`;

function glass(k, g, when, ev) {
  const buf = k.buffer(glassKey(ev.midi, ev.kind), () => glassSamples(ev.midi, ev.kind));
  const { out } = k.play(buf, when, { gain: 0.07 * ev.vel, pan: ev.pan || 0 }, g.bus || g.out);
  if (g.glassSend) out.connect(g.glassSend);
}

// ---------------------------------------------------------------- the sub

function sub(k, g, when, ev) {
  const r = 0.25;
  const o = k.osc("sine", hz(ev.midi), when, when + ev.dur + r + 0.02);
  const env = k.gain(0);
  const peak = 0.026 * ev.vel;
  k.env(env.gain, when, [[0, 0], [0.18, peak], [ev.dur, peak * 0.85], [ev.dur + r, 0]]);
  o.connect(env).connect(g.bus || g.out);
}

// ---------------------------------------------------------------- what plays

/** The piano part: the tune in the right hand, slow broken tenths in the left, one inner chord at 4.0. */
function pianoNotes() {
  const N = (name) => midi(name);
  const notes = [];
  // right hand: the tune at written pitch; the skeleton a little stronger, bar 3 softening to the frame
  const tune = [
    [0.0, 0.5, "D4", 0.8], [0.5, 0.25, "E4", 0.66], [0.75, 0.25, "F#4", 0.7],
    [1.0, 0.5, "A4", 0.8], [1.5, 0.25, "F#4", 0.66], [1.75, 0.25, "A4", 0.7],
    [2.0, 0.5, "B4", 0.86], [2.5, 0.25, "A4", 0.68], [2.75, 0.25, "F#4", 0.68],
    [3.0, 1.0, "E4", 0.82],
    [4.0, 0.5, "F#4", 0.78], [4.5, 0.25, "E4", 0.64], [4.75, 0.25, "D4", 0.62],
    [5.0, 0.5, "B3", 0.6], [5.5, 0.25, "A3", 0.52], [5.75, 0.2, "B3", 0.5],
  ];
  for (const [u, dur, name, vel] of tune) notes.push({ u, dur: dur - 0.02, midi: N(name), vel, hand: "R", lead: true, label: "piano tune" });
  // left hand: the bass on the chord, the tenth above it a beat later, both held to the change
  const left = [
    [0.0, 0.98, "D2", 0.5], [0.5, 0.48, "F#3", 0.36],
    [1.0, 0.98, "F#2", 0.48], [1.5, 0.48, "A3", 0.34],
    [2.0, 0.98, "G2", 0.52], [2.5, 0.48, "B3", 0.34],
    [3.0, 0.98, "A2", 0.52], [3.5, 0.48, "C#4", 0.32],
    [4.0, 0.98, "F#2", 0.5], [4.5, 0.48, "A3", 0.32],
    [5.0, 0.48, "G2", 0.44], [5.5, 0.36, "A2", 0.4],
  ];
  for (const [u, dur, name, vel] of left) notes.push({ u, dur, midi: N(name), vel, hand: "L", label: "piano left" });
  // 4.0, the pelican complete: a full, calm chord under the tune's F#
  // (the inner A3 is let go at 4.48: the left hand strikes the same key at 4.5)
  notes.push({ u: 4.0, dur: 0.48, midi: N("A3"), vel: 0.36, hand: "R", label: "piano chord" });
  notes.push({ u: 4.0, dur: 0.66, midi: N("D4"), vel: 0.38, hand: "R", label: "piano chord" });
  return notes;
}

/** The pad: one chord per two beats (u, dur, notes). */
const PAD = [
  [0.0, 1.0, ["D3", "F#3", "A3", "E4"]], // Dadd9
  [1.0, 1.0, ["F#3", "A3", "D4", "E4"]], // Dadd9/F#
  [2.0, 1.0, ["G3", "B3", "E4", "A4"]], // G6/9
  [3.0, 0.5, ["A3", "D4", "E4"]], // Asus4
  [3.5, 0.5, ["A3", "C#4", "E4"]], // -> A
  [4.0, 1.0, ["F#3", "A3", "D4"]], // D/F#: under the tune's F#, nothing above it
  [5.0, 0.5, ["D3", "G3", "A3"]], // G(add9), under the tune's low B
  [5.5, 0.25, ["E3", "A3", "D4"]], // -> Asus4, released so it is gone by 6.0
];

/**
 * The sub: chord roots (u, dur, note). Nothing under the two D/F# chords (1.0-2.0
 * and 4.0-5.0), where the bass is F#: the notes before them end so that their
 * 0.25 s release is out by the change.
 */
const SUB = [[0.0, 0.75, "D2"], [2.0, 1.0, "G1"], [3.0, 0.75, "A1"], [5.0, 0.5, "G1"], [5.5, 0.2, "A1"]];

/** The pad's release: short (0.2 s) on the chords that resolve by a semitone, 0.18 s on the last. */
const padRelease = (u) => (u === 5.5 ? 0.18 : u === 3.0 || u === 4.0 ? 0.2 : 0.35);

/** The glass notes: one per finished line of code, on the picture's times (src/scenes/code.js). */
const GLASS = [
  [0.562, ["A4"], "<svg>: the grid lights"],
  [0.814, ["B4"], "rear wheel"],
  [0.963, ["D5"], "front wheel"],
  [1.25, ["E5"], "frame, rear triangle"],
  [1.399, ["F#5"], "frame, down and top tube"],
  [1.502, ["A5"], "frame, head tube and fork"],
  [1.651, ["B5"], "saddle, bars, bell"],
  [1.8, ["D6"], "chainring and chain"],
  [2.0, ["D5", "A5", "D6"], "the bicycle is complete"],
  [2.283, ["D5"], "body"],
  [2.468, ["E5"], "neck"],
  [2.586, ["F#5"], "head"],
  [2.793, ["A5"], "eye"],
  [3.0, ["B5"], "the bill", "warm"],
  [3.208, ["D6"], "pouch"],
  [3.416, ["E6"], "wing"],
  [3.7, ["F#6"], "legs"],
  [4.6, ["F#5"], "</svg>: the file closes", "close"],
  [4.72, ["A5"], "the check mark: finished", "close"],
];

/** Every piano key the part may ask for: the score's notes and the D major scale over the lead's range. */
function pianoKeys() {
  const keys = new Set(pianoNotes().map((n) => n.midi));
  const pcs = [2, 4, 6, 7, 9, 11, 1];
  for (let m = 50; m <= 83; m += 1) if (pcs.includes(m % 12)) keys.add(m);
  return [...keys];
}

export default {
  prepare() {
    prepareReverb("code/room", ROOM);
    for (const m of pianoKeys()) sharedBuffer(pianoKey(m), () => pianoSamples(m));
    for (const [, names, , kind = "pure"] of GLASS) for (const nm of names) sharedBuffer(glassKey(midi(nm), kind), () => glassSamples(midi(nm), kind));
  },

  graph(k, out) {
    const bus = k.gain(1);
    const hp = k.filter("highpass", 34, 0);
    bus.connect(hp).connect(out);
    const room = k.reverb("code/room", ROOM);
    const send = k.gain(0.16);
    const glassSend = k.gain(0.3);
    send.connect(room);
    glassSend.connect(room);
    room.connect(out);
    return { bus, send, glassSend };
  },

  score(s) {
    for (const n of pianoNotes()) s.note(piano, n.u, n.dur, n.midi, n.vel, { hand: n.hand, lead: !!n.lead, label: n.label });
    PAD.forEach(([u, dur, names], ci) =>
      names.forEach((nm, i) => s.note(pad, u, dur, midi(nm), 1, { pan: (i - (names.length - 1) / 2) * 0.18, release: padRelease(u), cutoff: 700 + 30 * ci, label: "pad" })),
    );
    for (const [u, dur, nm] of SUB) s.note(sub, u, dur, midi(nm), 1, { label: "sub" });
    GLASS.forEach(([u, names, what, kind = "pure"], i) => {
      const vel = { pure: 1, warm: 1.45, close: 1.3 }[kind] * (names.length > 1 ? 0.75 : 1);
      names.forEach((nm, j) => s.note(glass, u, kind === "warm" ? 2.0 : 0.9, midi(nm), vel, { kind, pan: 0.25 - 0.02 * i + 0.1 * (j - 1) * (names.length > 1 ? 1 : 0), label: `glass: ${what}` }));
    });

    s.cue(0, "the pelican comes through the frame; the first note in a sudden quiet");
    s.cue(2.0, "the bicycle is complete: the pad's chord changes, the glass chord");
    s.cue(3.0, "the bill, the one strong colour: the warm glass B5");
    s.cue(4.0, "the pelican is complete: a full, calm chord under the tune's F#");
    s.cue(4.6, "</svg>: the file closes, F#5 then A5", { band: [2700, 3200] });
  },

  lead: piano,
  leadOctave: 0,
  bike: { chain: 0.5, bell: 1 },
};
