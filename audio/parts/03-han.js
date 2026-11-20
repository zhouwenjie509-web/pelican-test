// Section 3 (han): court music for a procession, on a rack of bronze bells.
//
// The tune rings on the chime bells (bianzhong) at written pitch; thin stone
// chimes (bianqing) double its skeleton an octave higher; a deep drum marks
// the bar lines and the horses of the procession clop in eighths under it all.
// In bar 2 the ink pad dabs the pelican's blank label four times, one
// character per beat, and each dab is a great bell (bo), each lower than the
// last: D3, B2, A2, D2.
//
// Everything is synthesized, from plain arithmetic computed in prepare():
//   chime bell  a sum of decaying sine partials at 1, 2, 3, 4.2 and 5.4 times
//               the strike note, each a pair a fraction of a hertz apart (the
//               slow beating of a real bell), the upper ones dying first, and
//               the short knock of a wooden mallet
//   great bell  the same anatomy two octaves lower, ringing two to three
//               seconds, struck with a padded beam (a softer, lower knock)
//   stone chime a stiff slab: a strong fundamental, weak partials at 2.76 and
//               5.40 times it (a free bar), all gone in half a second, and
//               the hard tick of the mallet
//   drum        the modes of a round skin (1, 1.59, 2.14, 2.65) whose pitch
//               sags after the blow, and the thud of a felted beater
//   hooves      a short hollow knock (two damped resonances) over a dull
//               thump of the ground, fore and hind feet at two pitches
//   pad         a soft damp thud: low-passed noise, 60 ms
//   hall        one room of about 2.2 s

import { prepareReverb, hasBuffer, putBuffer } from "../engine/kit.js";
import { SR, rng, white, biquad, onePole, envelope, fade, mixInto, normalize, samples, modal } from "../engine/dsp.js";
import { hz, midi } from "../engine/theory.js";

// ---------------------------------------------------------------- bells

/**
 * Partials of a chime bell and of a great bell, as [ratio, amplitude, t60 (s), split (Hz)].
 * Each partial is a pair `split` hertz apart (centred on the ratio, so the fundamental reads
 * exactly in tune); the pair beats slowly. The fundamental is the strongest partial.
 */
const CHIME = [
  [1.0, 1.0, 1.9, 0.7],
  [2.0, 0.42, 1.2, 1.1],
  [3.0, 0.26, 0.6, 1.5],
  [4.2, 0.24, 0.5, 1.9],
  [5.4, 0.15, 0.32, 2.3],
];
const GREAT = [
  [1.0, 1.0, 2.6, 0.45],
  [2.0, 0.5, 1.8, 0.7],
  [3.0, 0.3, 1.1, 0.9],
  [4.2, 0.2, 0.7, 1.2],
  [5.4, 0.12, 0.45, 1.5],
];
/**
 * The two deepest great bells (A2, D2): stronger second and third partials, so that on a small
 * speaker, which cannot give their fundamentals (110 and 73 Hz), they are heard through these.
 */
const GREAT_LOW = [
  [1.0, 1.0, 2.6, 0.45],
  [2.0, 0.85, 1.8, 0.7],
  [3.0, 0.55, 1.1, 0.9],
  [4.2, 0.2, 0.7, 1.2],
  [5.4, 0.12, 0.45, 1.5],
];

/** A struck bell: the partial pairs, then the knock of the striker mixed into the attack. */
function bellSamples(f, table, { seconds, knockHz, knockQ, knock, knockLen, seed, attack = 0.0012, peak = 0.9 }) {
  const parts = [];
  table.forEach(([ratio, a, t60, split], i) => {
    const fc = f * ratio;
    // the stronger of the pair carries the pitch; the weaker one, a fraction of a hertz away,
    // makes the level swell and sink slowly (a sixth to a third of it: no deep holes)
    const w = i === 0 ? 0.16 : 0.3;
    // the partials start at different points of their cycles, so they do not all peak together
    parts.push({ f: fc - split * w, a: a * (1 - w), t60, phase: 2.3 * i });
    parts.push({ f: fc + split * (1 - w), a: a * w, t60: t60 * 0.9, phase: 2.3 * i });
  });
  const y = modal(parts, seconds, { attack });
  const k = biquad(white(samples(knockLen * 2), seed), "bandpass", knockHz, knockQ);
  envelope(k, [[0, 0], [0.0006, 1], [knockLen * 0.35, 0.35], [knockLen, 0.05], [knockLen * 2, 0]]);
  mixInto(y, k, 0, knock);
  return normalize(fade(onePole(y, 25, "highpass"), 0.0008, 0.02), peak);
}

const chimeKey = (m) => `han/chime/${m}`;
const chimeSamples = (m) => bellSamples(hz(m), CHIME, { seconds: 2.0, knockHz: 1300, knockQ: 0.9, knock: 0.5, knockLen: 0.006, seed: 300 + m });

const greatKey = (m) => `han/great/${m}`;
// (the stronger partials of A2 and D2 raise their peak; normalizing them 2 dB higher keeps their
// fundamentals where the plain table would have put them, so the bell gains its partials and loses nothing)
const greatSamples = (m) =>
  bellSamples(hz(m), m <= 45 ? GREAT_LOW : GREAT, { seconds: 3.6, knockHz: 420, knockQ: 0.7, knock: 0.5, knockLen: 0.018, seed: 400 + m, attack: 0.003, peak: m <= 45 ? 1.13 : 0.9 });

/** One chime bell. The rack hangs left (low) to right (high). */
function chimeBell(k, g, when, ev) {
  const buf = k.buffer(chimeKey(ev.midi), () => chimeSamples(ev.midi));
  const pan = Math.max(-0.35, Math.min(0.35, ((ev.midi - 64) / 12) * 0.35));
  const { out } = k.play(buf, when, { gain: LEVEL.chime * ev.vel, pan }, g.out);
  if (g.send) out.connect(g.send);
}

function greatBell(k, g, when, ev) {
  const buf = k.buffer(greatKey(ev.midi), () => greatSamples(ev.midi));
  const { out } = k.play(buf, when, { gain: LEVEL.great * ev.vel, pan: -0.08 }, g.out);
  if (g.send) out.connect(g.send);
}

// ---------------------------------------------------------------- stone, skin, hooves, pad

/**
 * A stone chime: a thin slab of stone hung by a cord and struck. Stone is stiff and lossy:
 * a strong fundamental, weak partials at the ratios of a free bar (2.76, 5.40), all gone
 * in half a second, and the hard tick of a horn or wooden mallet on stone.
 */
function stoneSamples(m) {
  const f = hz(m);
  const y = modal(
    [
      { f, a: 1.0, t60: 0.55 },
      { f: f * 1.0012, a: 0.12, t60: 0.5 },
      { f: f * 2.76, a: 0.16, t60: 0.2 },
      { f: f * 5.4, a: 0.05, t60: 0.08 },
    ],
    0.7,
    { attack: 0.0004 },
  );
  const tick = biquad(white(samples(0.008), 500 + m), "bandpass", 3600, 1.1);
  envelope(tick, [[0, 0], [0.0003, 1], [0.0015, 0.3], [0.004, 0.05], [0.008, 0]]);
  mixInto(y, tick, 0, 0.7);
  return normalize(fade(onePole(y, 40, "highpass"), 0.0005, 0.03), 0.9);
}

/**
 * A big barrel drum struck with a felted beater: the modes of a round skin whose pitch
 * sags a little as the skin relaxes after the blow, and the soft thud of the beater.
 */
function drumSamples(v) {
  const f = 66 + 2 * v;
  const modes = [
    [1, 1, 0.75],
    [1.59, 0.32, 0.32],
    [2.14, 0.16, 0.2],
    [2.65, 0.07, 0.12],
  ];
  const n = samples(1.0);
  const y = new Float32Array(n);
  const ph = modes.map(() => 0);
  const amp = modes.map((md) => md[1]);
  const dec = modes.map((md) => Math.exp(-6.9078 / (md[2] * SR)));
  for (let i = 0; i < n; i += 1) {
    const fNow = f * (1 + 0.22 * Math.exp(-i / SR / 0.04));
    let sum = 0;
    for (let j = 0; j < modes.length; j += 1) {
      ph[j] += (2 * Math.PI * fNow * modes[j][0]) / SR;
      sum += amp[j] * Math.sin(ph[j]);
      amp[j] *= dec[j];
    }
    y[i] = sum;
  }
  const felt = onePole(onePole(white(samples(0.05), 600 + v), 700), 700);
  envelope(felt, [[0, 0], [0.002, 1], [0.012, 0.3], [0.05, 0]]);
  mixInto(y, felt, 0, 1.6);
  return normalize(fade(onePole(y, 32, "highpass"), 0.001, 0.04), 0.9);
}

/**
 * A hoof on a beaten road: a hollow knock (two short resonances of the hoof wall) over a
 * dull thump of the ground, and the grit of the contact. `p` is the knock's pitch. The knock
 * rings for well under 20 ms (a few cycles), so that it reads as a 'tok' without a pitch.
 */
function hoofSamples(p, seed) {
  const y = modal(
    [
      { f: p, a: 1.0, t60: 0.012 },
      { f: p * 1.73, a: 0.35, t60: 0.008 },
      { f: 190, a: 0.45, t60: 0.05 },
    ],
    0.12,
    { attack: 0.0008 },
  );
  const grit = onePole(biquad(white(samples(0.02), seed), "bandpass", 1800, 0.8), 3500);
  envelope(grit, [[0, 0], [0.0005, 1], [0.004, 0.2], [0.012, 0.03], [0.02, 0]]);
  mixInto(y, grit, 0, 0.5);
  return normalize(fade(onePole(y, 90, "highpass"), 0.0006, 0.02), 0.9);
}
const HOOF_PITCH = [640, 545];

/** The ink pad landing on damp paper over stone: a soft, damp, low thud. */
function padSamples() {
  const x = onePole(onePole(white(samples(0.09), 777), 380), 380);
  envelope(x, [[0, 0], [0.003, 1], [0.02, 0.35], [0.06, 0.06], [0.09, 0]]);
  const body = modal([{ f: 140, a: 0.6, t60: 0.06 }], 0.09, { attack: 0.002 });
  mixInto(x, body, 0, 0.5);
  return normalize(fade(onePole(x, 50, "highpass"), 0.001, 0.01), 0.9);
}

function stone(k, g, when, ev) {
  const buf = k.buffer(`han/stone/${ev.midi}`, () => stoneSamples(ev.midi));
  const { out } = k.play(buf, when, { gain: LEVEL.stone * ev.vel, pan: 0.22 }, g.out);
  if (g.send) out.connect(g.send);
}

function drum(k, g, when, ev) {
  const buf = k.buffer(`han/drum/${ev.variant}`, () => drumSamples(ev.variant));
  const { out } = k.play(buf, when, { gain: LEVEL.drum * ev.vel, pan: 0 }, g.out);
  if (g.send) out.connect(g.send);
}

function hoof(k, g, when, ev) {
  const buf = k.buffer(`han/hoof/${ev.variant}`, () => hoofSamples(HOOF_PITCH[ev.variant % 2] * (1 + 0.03 * Math.floor(ev.variant / 2)), 700 + ev.variant));
  const { out } = k.play(buf, when, { gain: LEVEL.hoof * ev.vel, pan: ev.pan }, g.out);
  if (g.send) out.connect(g.send);
}

function pad(k, g, when, ev) {
  const buf = k.buffer("han/pad", padSamples);
  k.play(buf, when, { gain: LEVEL.pad * ev.vel, pan: 0.1 }, g.out);
}

/** Levels (linear, at vel 1). */
const LEVEL = { chime: 0.52, great: 0.38, stone: 0.26, drum: 0.18, hoof: 0.08, pad: 0.1 };

/** The pitches the outro may ask of this part's voice: the D major scale, B1 .. D7. */
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const OUTRO_RANGE = [];
for (let m = 35; m <= 98; m += 1) if (MAJOR.includes((((m - 62) % 12) + 12) % 12)) OUTRO_RANGE.push(m);

// ---------------------------------------------------------------- the place

/** The stone chimes: the skeleton notes an octave above the tune (D5 A5 B5 E5 F#5 B4). */
const STONES = [74, 81, 83, 76, 78, 71];

/** The horses within earshot: how late each lands after the grid, how loud, where. */
const HORSES = [
  { late: 0.0, vel: 1.0, pan: -0.3, pitch: 0 },
  { late: 0.013, vel: 0.75, pan: 0.28, pitch: 1 },
  { late: 0.026, vel: 0.6, pan: 0.05, pitch: 2 },
];

/** On the dabs, how far (s) the other players strike behind the great bell. */
const SPREAD = {
  2.0: { chime: 0.01, stone: 0.004, drum: 0.004 },
  2.5: { chime: 0.014, stone: 0, drum: 0 },
  3.0: { chime: 0.009, stone: 0.014, drum: 0 },
};

/** How far (s) the downbeat great bell (u = 0) strikes behind the chime bell, drum and stone. */
const DOWNBEAT_BELL_LATE = 0.0095;

const HALL = { seconds: 2.2, t60: 2.0, bright: 0.45, predelay: 0.018, early: 0.4, seed: 303 };

export default {
  prepare() {
    prepareReverb("han/hall", HALL);
    for (const m of OUTRO_RANGE) putIfMissing(chimeKey(m), () => chimeSamples(m));
    for (const n of ["D3", "B2", "A2", "D2"]) putIfMissing(greatKey(midi(n)), () => greatSamples(midi(n)));
    for (const n of STONES) putIfMissing(`han/stone/${n}`, () => stoneSamples(n));
    for (let v = 0; v < 2; v += 1) putIfMissing(`han/drum/${v}`, () => drumSamples(v));
    for (let v = 0; v < 6; v += 1) putIfMissing(`han/hoof/${v}`, () => hoofSamples(HOOF_PITCH[v % 2] * (1 + 0.03 * Math.floor(v / 2)), 700 + v));
    putIfMissing("han/pad", padSamples);
  },

  graph(k, out) {
    const room = k.reverb("han/hall", HALL);
    const send = k.gain(0.28);
    send.connect(room).connect(out);
    return { send };
  },

  score(s) {
    // on the dabs the great bell and the pad land exactly on the beat; the players around them
    // strike a few milliseconds behind it, as players do, so that their attacks do not all peak together
    const behind = (u, who) => (SPREAD[u] ? SPREAD[u][who] : 0);
    for (const note of s.theme()) {
      // the held E (u = 3.0) is struck a little softer: the great bells have the beat
      const vel = note.u === 3.0 ? 0.82 : note.skeleton ? 0.95 : 0.8;
      s.note(chimeBell, note.u + behind(note.u, "chime"), note.dur, note.midi, vel, { lead: true, label: "chime bell" });
    }
    s.cue(0, "the pelican joins the procession");

    // ---- stone chimes: the skeleton, an octave up
    for (const note of s.theme({ octave: 1 })) {
      if (note.skeleton) s.note(stone, note.u + behind(note.u, "stone"), 0.7, note.midi, 0.9, { label: "stone chime" });
    }

    // ---- the drum on the bar lines
    [0, 2, 4].forEach((u, i) => s.at(u + behind(u, "drum"), drum, { variant: i % 2, vel: u === 2 ? 0.6 : 1, dur: 1.0, label: "drum" }));

    // ---- the great bells: the downbeat, then the four dabs, each lower than the last
    // (the bicycle's bell and this part's first attacks meet at the crossing, and the mix needs
    // head-room there: the downbeat great bell is a little softer, vel 0.7, and strikes 9.5 ms behind
    // the chime bell, where by measurement its attack adds least to the peak; the dabs below are not touched)
    s.note(greatBell, DOWNBEAT_BELL_LATE, 3.6, midi("D3"), 0.7, { label: "great bell" });
    const DABS = [
      [2.0, "D3", "dab 1: 此", [55, 170]],
      [2.5, "B2", "dab 2: 鹈", [55, 170]],
      [3.0, "A2", "dab 3: 鹕", [55, 170]],
      [3.5, "D2", "dab 4: 车, the label is complete", [55, 95]],
    ];
    // (each cue listens below the tune; the last one under the higher bells still ringing)
    for (const [u, name, what, band] of DABS) {
      s.note(greatBell, u, 3.6, midi(name), 1, { label: "great bell" });
      s.at(u, pad, { vel: 1, dur: 0.09, label: "pad" });
      s.cue(u, `${what}: great bell ${name}`, { band });
    }

    // ---- hooves: eighths, fore and hind feet alternating, three horses a little out of step
    for (const h of HORSES) {
      for (let j = 0; j < 24; j += 1) {
        const u = j * 0.25 + h.late;
        s.at(u, hoof, { variant: (j % 2) + 2 * h.pitch, vel: h.vel * (j % 2 ? 0.8 : 1), pan: h.pan, dur: 0.12, label: "hooves" });
      }
    }
  },

  lead: chimeBell,
  leadOctave: 0,
  bike: { chain: 0.7, bell: 1 },
};

/** Fill the shared buffer cache ahead of playback. */
function putIfMissing(key, make) {
  if (!hasBuffer(key)) putBuffer(key, make());
}

// For scratch checks in Node (dev/audio/han-*.mjs): the sample makers.
export const _han = { chimeSamples, greatSamples, hoofSamples };
