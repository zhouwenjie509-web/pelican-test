// Section 7 (maya): a clay flute plays the tune; the drummer plays the scribe's numbers.
//
// A scribe counts the turns of the pedals in bars and dots, one number to a
// page, one page to a beat on u = 1..5: 38, 39, 40, 41, 42. Every stroke of
// paint is a stroke of sound, on the scene's own sub-times: a bar is the slit
// drum's low tongue, a dot its high tongue, a dot in the twenties place the
// tall drum's rim. Forty is written with a shell, and at u = 3.0 a turtle
// shell is struck once, alone, as the flute's held E begins. The flute never
// stops for the scribe. The tall skin drum marks the bar lines, a seed rattle
// brushes beats 2 and 4, and all of it sits in a small stone room.
//
// How the sounds are made (all arithmetic, nothing recorded):
//   clay flute   nodes: an oscillator that is nearly a pure sine (2nd and 3rd
//                harmonics 30+ dB down), scooped up from 35 cents flat into
//                each note, a slow late vibrato, breath (band-passed pink
//                noise that follows the tone) and a short noise "chiff" on
//                each attack
//   slit drum    computed buffers: a wooden tongue as a cantilever (modes at
//                1, 2.9, 6.3 times the fundamental, the upper ones damped fast
//                by the wood), a box resonance, and the soft thud of a
//                rubber-headed stick
//   tall drum    computed buffers: a low membrane (circular modes 1, 1.59,
//                2.14, 2.30) whose pitch sinks as the skin relaxes, plus the palm
//   rim          computed buffers: a stick on the drum's wooden shell, a few
//                stiff modes that are gone in 50 ms
//   shell        computed buffers: antler on carapace, a hard click, a few
//                inharmonic plate modes and a hollow cavity tone, all under 0.1 s
//   seed rattle  computed buffers: a hundred seeds, each a tiny decaying
//                resonance, landing in a swish of about 90 ms
//   room         one 1.0 s stone-room impulse response

import { prepareReverb, hasBuffer, putBuffer } from "../engine/kit.js";
import { SR, rng, white, biquad, onePole, envelope, fade, mixInto, normalize, samples, modal } from "../engine/dsp.js";
import { hz, midi } from "../engine/theory.js";

const ID = "maya";

// ---------------------------------------------------------------- the clay flute

/** Harmonic recipe of a vessel flute: the fundamental almost alone. */
function fluteWave(k) {
  return k.wave(`${ID}/flute`, [0, 1, 0.022, 0.012, 0.004]);
}

/**
 * One note of the clay flute.
 * ev: midi, dur, vel; cents (the player's small error on this note); vib (vibrato phase 0..1).
 */
function flute(k, g, when, ev) {
  const f = hz(ev.midi);
  const dur = Math.max(0.12, ev.dur);
  const a = 0.028; // speaks quickly: a vessel flute has no long tube to fill
  const r = 0.045;
  const hold = dur - r - 0.012; // tongued: a small gap before the next note
  const end = when + hold + r;
  const stop = end + 0.02;
  const level = 0.195 * (ev.vel === undefined ? 0.85 : ev.vel);
  const own = ev.cents || 0;

  const src = k.osc(fluteWave(k), f, when, stop);
  // the scoop: the note begins flat and settles within about 60 ms
  k.env(src.detune, when, [[0, own - 35], [0.004, own - 33], [0.006, own, ["target", 0.013]]]);
  // a little unsteady: a slow vibrato that arrives only on the held notes
  if (dur >= 0.45) {
    const lfo = k.lfo(4.6, when, stop, ev.vib || 0);
    const depth = k.gain(0);
    lfo.connect(depth).connect(src.detune);
    k.env(depth.gain, when, [[0, 0], [0.18, 0], [Math.min(hold, 0.6), 7]]);
  }
  const amp = k.gain(0);
  k.env(amp.gain, when, [[0, 0], [a, level], [a + 0.05, level * 0.88], [Math.max(a + 0.06, hold), level * 0.82], [hold + r, 0]]);
  const pan = k.pan(0.04);
  k.chain(src, amp, pan, g.out);
  if (g.send) pan.connect(g.send);

  // breath round the tone: pink noise in a band above the note, following its envelope
  const breath = k.noise("pink", when, stop, { phase: (ev.midi * 0.37 + (ev.u || 0) * 1.3) % 5, seed: 7 });
  const bp = k.filter("bandpass", Math.min(2400, f * 2.2), 0.9);
  const bAmp = k.gain(0);
  const bl = level * 0.05;
  // the breath leaves before the tone does
  k.env(bAmp.gain, when, [[0, 0], [0.012, bl * 2.2], [0.045, bl], [Math.max(0.05, hold - 0.03), bl * 0.9], [Math.max(0.06, hold + 0.005), 0]]);
  // the chiff: the edge of the air jet catching, a narrow band near the third harmonic, 30 ms
  const chiffBp = k.filter("bandpass", f * 3, 4);
  const cAmp = k.gain(0);
  k.env(cAmp.gain, when, [[0, 0], [0.004, level * 0.35], [0.03, 0]]);
  breath.connect(bp).connect(bAmp).connect(pan);
  breath.connect(chiffBp).connect(cAmp).connect(pan);
}

// ---------------------------------------------------------------- struck sounds

/** A wooden tongue struck with a soft-headed stick (f: the tongue's pitch). */
function tongueSamples(f, v) {
  const y = modal(
    [
      { f, a: 1, t60: 0.34 + 0.02 * v },
      { f: f * 2.9, a: 0.18, t60: 0.12 },
      { f: f * 6.3, a: 0.05, t60: 0.04 },
      // the box under the tongues answers faintly on A2, a fourth below the low tongue (a note of the tune)
      { f: 110 + 2 * v, a: 0.12, t60: 0.15, phase: 0.4 },
    ],
    0.5,
    { attack: 0.0015 },
  );
  // the stick head: a soft thud, low-passed noise for a few milliseconds
  const thud = biquad(white(samples(0.03), 70 + v + Math.round(f)), "lowpass", 900, 0.7);
  envelope(thud, [[0, 0], [0.001, 1], [0.006, 0.2], [0.03, 0]]);
  mixInto(y, thud, 0, 0.5);
  return normalize(fade(onePole(y, 60, "highpass"), 0.0015, 0.05), 0.9);
}

/** The tall drum: a deep skin played with the palm. */
function skinSamples(v) {
  const f = 73.4 * (1 + 0.006 * v); // near D2
  const n = samples(0.8);
  const y = new Float32Array(n);
  const modes = [[1, 1, 0.55], [1.59, 0.35, 0.25], [2.14, 0.2, 0.15], [2.3, 0.14, 0.12]];
  const ph = modes.map(() => 0);
  const amp = modes.map((m) => m[1]);
  const dec = modes.map((m) => Math.exp(-6.9078 / (m[2] * SR)));
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    const fNow = f * (1 + 0.12 * Math.exp(-t / 0.04));
    let s = 0;
    for (let m = 0; m < modes.length; m += 1) {
      ph[m] += (2 * Math.PI * fNow * modes[m][0]) / SR;
      s += amp[m] * Math.sin(ph[m]);
      amp[m] *= dec[m];
    }
    y[i] = s;
  }
  const palm = biquad(white(samples(0.05), 90 + v), "bandpass", 600, 0.8);
  envelope(palm, [[0, 0], [0.0006, 1], [0.008, 0.2], [0.05, 0]]);
  mixInto(y, palm, 0, 0.35);
  return normalize(fade(onePole(y, 35, "highpass"), 0.002, 0.06), 0.9);
}

/** A stick on the tall drum's wooden rim: dry and short. */
function rimSamples(v) {
  const y = modal(
    [
      { f: 820 + 25 * v, a: 1, t60: 0.06 },
      { f: 1930 + 40 * v, a: 0.5, t60: 0.035 },
      { f: 3150 - 30 * v, a: 0.25, t60: 0.02 },
    ],
    0.1,
    { attack: 0.0006 },
  );
  const tick = biquad(white(samples(0.01), 120 + v), "bandpass", 2600, 1.2);
  envelope(tick, [[0, 0], [0.0004, 1], [0.003, 0.15], [0.01, 0]]);
  mixInto(y, tick, 0, 0.8);
  return normalize(fade(y, 0.0006, 0.02), 0.9);
}

/** The turtle shell struck with an antler: a hard click, bony plate modes, a hollow cavity tone. */
function shellSamples() {
  const y = modal(
    [
      { f: 431, a: 0.9, t60: 0.09 }, // the hollow inside the shell
      { f: 1187, a: 1, t60: 0.07 },
      { f: 1693, a: 0.7, t60: 0.05, phase: 0.7 },
      { f: 2561, a: 0.5, t60: 0.035, phase: 1.9 },
      { f: 3817, a: 0.3, t60: 0.025 },
    ],
    0.16,
    { attack: 0.0004 },
  );
  const click = biquad(white(samples(0.012), 333), "bandpass", 4200, 1.0);
  envelope(click, [[0, 0], [0.0003, 1], [0.002, 0.2], [0.012, 0]]);
  mixInto(y, click, 0, 1.4);
  return normalize(fade(onePole(y, 120, "highpass"), 0.0004, 0.03), 0.9);
}

/** A gourd of seeds shaken once: many tiny dry impacts in a short swish. */
function rattleSamples(v) {
  const n = samples(0.14);
  const y = new Float32Array(n);
  const r = rng(500 + v);
  for (let j = 0; j < 110; j += 1) {
    // the seeds arrive in a burst that peaks about 20 ms in
    const at = 0.085 * Math.pow(r(), 1.6) + 0.002;
    const f = 3000 + 3500 * r();
    const a = (0.4 + 0.6 * r()) * (1 - at / 0.1);
    const w = (2 * Math.PI * f) / SR;
    const d = Math.exp(-6.9078 / (0.006 * SR));
    const o = Math.round(at * SR);
    let gg = a;
    for (let i = 0; o + i < n && i < samples(0.012); i += 1) {
      y[o + i] += gg * Math.sin(w * i);
      gg *= d;
    }
  }
  const hiss = biquad(white(n, 540 + v), "bandpass", 5000, 0.8);
  envelope(hiss, [[0, 0], [0.01, 0.6], [0.03, 0.4], [0.1, 0.05], [0.14, 0]]);
  mixInto(y, hiss, 0, 0.5);
  return normalize(fade(y, 0.003, 0.02), 0.9);
}

/** Every struck sound: its buffer key, its maker, its level and its place. */
const STRUCK = {
  low: { make: (v) => tongueSamples(hz(midi("D3")), v), level: 0.3, pan: -0.18, dur: 0.5 },
  high: { make: (v) => tongueSamples(hz(midi("A3")), v), level: 0.26, pan: -0.1, dur: 0.5 },
  skin: { make: skinSamples, level: 0.3, pan: 0.0, dur: 0.8 },
  rim: { make: rimSamples, level: 0.09, pan: 0.2, dur: 0.1 },
  shell: { make: () => shellSamples(), level: 0.3, pan: 0.0, dur: 0.16 },
  rattle: { make: rattleSamples, level: 0.06, pan: 0.3, dur: 0.14 },
};
const VARIANTS = 2;

function struck(k, g, when, ev) {
  const s = STRUCK[ev.kind];
  const v = ev.variant || 0;
  const buf = k.buffer(`${ID}/${ev.kind}/${v}`, () => s.make(v));
  const { out } = k.play(buf, when, { gain: s.level * ev.vel, pan: s.pan }, g.out);
  if (g.send) out.connect(g.send);
}

// ---------------------------------------------------------------- the place

/** A small stone room. */
const ROOM = { seconds: 1.0, t60: 0.9, bright: 0.55, predelay: 0.007, early: 0.55, seed: 77 };

// ---------------------------------------------------------------- the numbers

/**
 * The scribe's strokes, read from src/scenes/maya.js (briefs/CUES.md, "Section 7"):
 * [u, kind]. low = a bar of five (low tongue), high = a unit dot (high tongue),
 * rim = a dot in the twenties place, shell = zero.
 */
const STROKES = [
  // 38: three bars, three dots, one twenty
  [1.0, "low"], [1.08, "low"], [1.16, "low"], [1.24, "high"], [1.3, "high"], [1.36, "high"], [1.46, "rim"],
  // 39: three bars, four dots, one twenty
  [2.0, "low"], [2.08, "low"], [2.16, "low"], [2.24, "high"], [2.3, "high"], [2.36, "high"], [2.42, "high"], [2.52, "rim"],
  // 40: the shell, then two twenties
  [3.0, "shell"], [3.17, "rim"], [3.23, "rim"],
  // 41: one dot, two twenties
  [4.0, "high"], [4.1, "rim"], [4.16, "rim"],
  // 42: two dots, two twenties
  [5.0, "high"], [5.06, "high"], [5.16, "rim"], [5.22, "rim"],
];

export default {
  prepare() {
    prepareReverb(`${ID}/room`, ROOM);
    for (const [kind, s] of Object.entries(STRUCK)) {
      for (let v = 0; v < VARIANTS; v += 1) {
        const key = `${ID}/${kind}/${v}`;
        if (!hasBuffer(key)) putBuffer(key, s.make(v));
      }
    }
  },

  graph(k, out) {
    const room = k.reverb(`${ID}/room`, ROOM);
    const send = k.gain(0.2);
    send.connect(room).connect(out);
    return { send };
  },

  score(s) {
    const r = rng(707);
    // ---- the clay flute: the whole tune, straight through, an octave up
    const notes = s.theme({ octave: 1 });
    notes.forEach((n, i) => {
      const last = i === notes.length - 1;
      s.note(flute, n.u, last ? n.dur - 0.035 : n.dur, n.midi, n.skeleton ? 0.9 : 0.8, {
        lead: true,
        cents: Math.round((r() - 0.5) * 6),
        vib: r(),
        label: "flute",
      });
    });

    // ---- the tall skin drum on the bar lines
    for (const u of [0, 2, 4]) s.at(u, struck, { kind: "skin", variant: u === 2 ? 1 : 0, vel: 1, dur: 0.8, label: "tall drum" });

    // ---- the seed rattle on beats 2 and 4 of each bar (not inside the shell's beat, which is 3.0-3.5)
    for (const u of [0.5, 1.5, 2.5, 3.5, 4.5, 5.5]) s.at(u, struck, { kind: "rattle", variant: Math.round(u * 2) % 2, vel: u === 3.5 ? 0.7 : 1, dur: 0.14, label: "rattle" });

    // ---- the scribe's numbers
    STROKES.forEach(([u, kind], i) => {
      const vel = kind === "shell" ? 1 : kind === "rim" ? 0.85 : 0.9 - 0.06 * (i % 3 === 2);
      s.at(u, struck, { kind, variant: i % 2, vel, dur: STRUCK[kind].dur, label: kind === "low" || kind === "high" ? `slit drum ${kind}` : kind });
    });

    s.cue(0, "the pelican comes through the frame: flute and tall drum");
    s.cue(1.0, "38 is painted: first bar, low tongue");
    s.cue(2.0, "39 is painted: first bar, low tongue");
    s.cue(3.0, "40: the shell", { band: [2000, 9000] });
    s.cue(4.0, "41 is painted: one dot, high tongue");
    s.cue(5.0, "42 is painted: first dot, high tongue");
  },

  /** The outro's note of this section: the clay flute. */
  lead: flute,
  leadOctave: 1,
  bike: { chain: 1, bell: 1 },
};
