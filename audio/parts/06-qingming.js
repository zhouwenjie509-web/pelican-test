// Section 6 (qingming): a street band on the Rainbow Bridge, c. 1100.
//
// A bamboo flute (dizi) plays the tune an octave up with grace notes from
// the note above. Under it the band keeps the pedal rhythm: the low drum on
// each cell's long note, the high drum on its two short ones, the small gong
// on the off-beats, the woodblock on the beats. From u = 1.0 the high drum
// thickens into a roll that grows all the way up the arch; on the crown
// (u = 3.0), with every head turned, the band gives it the full gong: large
// gong, cymbals and both drums at once. The flute holds its E alone after the
// stroke, trilling, getting softer. Bar 3 runs down the far side with the
// small gong and the woodblock. The bell takes the D.
//
// Everything is computed here, in prepare(), from plain arithmetic:
//   dizi       one wavetable per note (harmonics with a formant near 3.5 kHz,
//              where the membrane buzzes), read with a moving phase so grace
//              notes, trills and vibrato are real pitch changes; a duller table
//              crossfades into the bright one over the attack; the membrane's
//              rattle is noise gated once per period; breath and a tongued chiff
//   gongs      decaying partials whose frequency moves after the stroke:
//              the small gong's rises 2.5 semitones in about 150 ms, the large
//              gong's falls a semitone and a half over half a second
//   cymbals    a cloud of inharmonic partials above 1.5 kHz and hiss, choked
//   drums      round-skin modes whose pitch drops as the skin relaxes, plus the
//              stick: the high drum tight and dry, the low drum deeper
//   woodblock  three stiff modes, gone in a tenth of a second

import { prepareReverb, sharedBuffer } from "../engine/kit.js";
import { SR, rng, white, biquad, onePole, envelope, fade, mixInto, normalize, samples } from "../engine/dsp.js";
import { hz, midi, theme } from "../engine/theory.js";

const TAU = 2 * Math.PI;

// ---------------------------------------------------------------- the dizi

/** Harmonic amplitudes of a dizi note: a bright tube with the membrane's formant near 3.5 kHz. */
function diziHarmonics(f, dull = 0) {
  const amps = [0];
  for (let k = 1; f * k < 9000; k += 1) {
    const fk = f * k;
    let a = k ** -(1.5 + 0.9 * dull);
    a *= 1 + (1 - dull) * 0.5 * Math.exp(-(((fk - 3500) / 1000) ** 2)); // the membrane's formant, +3.5 dB
    if (fk > 6000) a *= Math.exp(-(fk - 6000) / 1200);
    amps.push(a);
  }
  return amps;
}

const TABLE = 2048;
/** One period as a table, peak 1. */
function waveTable(amps) {
  const t = new Float32Array(TABLE + 1);
  for (let i = 0; i < TABLE; i += 1) {
    let s = 0;
    // alternate phases a little so the peak is not needlessly high
    for (let k = 1; k < amps.length; k += 1) s += amps[k] * Math.sin((TAU * k * i) / TABLE + 0.7 * k * k);
    t[i] = s;
  }
  t[TABLE] = t[0];
  let m = 0;
  for (let i = 0; i < TABLE; i += 1) m = Math.max(m, Math.abs(t[i]));
  for (let i = 0; i <= TABLE; i += 1) t[i] /= m;
  return t;
}

/** A piecewise-linear level: [[t, level], ...], held flat beyond the ends. */
function shapeAt(points, t) {
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i += 1) {
    const [t1, v1] = points[i];
    if (t <= t1) {
      const [t0, v0] = points[i - 1];
      return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return points[points.length - 1][1];
}

/**
 * One dizi note as samples.
 *   midi, len (seconds the note is blown), vel
 *   grace     midi of a grace note from above, on the beat (32 ms)
 *   trill     { upper, start, rate }: alternate with the note above from `start` seconds
 *   fadeTo    level at the end of the note relative to its start (a long diminuendo)
 *   shape     instead of fadeTo: [[seconds, level], ...], the level drawn as straight lines between points
 *   seed
 */
function diziSamples({ midi: m, len, vel = 1, grace, trill, fadeTo = 1, shape, seed = 1, release = 0.035 }) {
  const n = samples(len + release + 0.005);
  const y = new Float32Array(n);
  const f0 = hz(m);
  const bright = waveTable(diziHarmonics(f0, 0));
  const dull = waveTable(diziHarmonics(f0, 1));
  const r = rng(seed);
  const noise = white(n, 300 + seed);
  const buzzN = biquad(biquad(white(n, 500 + seed), "bandpass", 3400, 2.2), "bandpass", 3600, 1.5);
  const breath = biquad(onePole(noise, 9000), "bandpass", 5200, 0.6);
  const chiff = biquad(white(samples(0.04), 700 + seed), "bandpass", 2600, 0.9);
  envelope(chiff, [[0, 0], [0.002, 1], [0.012, 0.35], [0.035, 0], [0.04, 0]]);

  const vibRate = 5.0 + 0.6 * r();
  const vibPh = TAU * r();
  const long = len > 0.4;
  let phase = r();
  let pulseSum = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    // ---- pitch
    let p = m;
    if (grace !== undefined) {
      const g = t < 0.026 ? 1 : t < 0.034 ? 0.5 + 0.5 * Math.cos((Math.PI * (t - 0.026)) / 0.008) : 0;
      p += (grace - m) * g;
    }
    if (trill && t >= trill.start && t < len - 0.12) {
      const c = ((t - trill.start) * trill.rate) % 1; // one cycle: the note, then the note above
      const up = c < 0.42 ? 0 : c < 0.5 ? 0.5 - 0.5 * Math.cos((Math.PI * (c - 0.42)) / 0.08) : c < 0.92 ? 1 : 0.5 + 0.5 * Math.cos((Math.PI * (c - 0.92)) / 0.08);
      p += (trill.upper - m) * up;
    }
    const vibIn = long ? Math.min(1, Math.max(0, (t - 0.25) / 0.2)) : 0;
    const vib = Math.sin(TAU * vibRate * t + vibPh);
    p += 0.05 * vibIn * vib; // 5 cents of pitch
    const f = hz(p);
    phase += f / SR;
    if (phase >= 1) phase -= Math.floor(phase);

    // ---- level: tongued attack, breath vibrato, diminuendo, release
    let a;
    if (t < 0.018) a = t / 0.018;
    else if (t < 0.045) a = 1 + 0.12 * Math.sin((Math.PI * (t - 0.018)) / 0.027);
    else a = 1;
    if (shape) a *= shapeAt(shape, t);
    else a *= 1 + (fadeTo - 1) * Math.min(1, Math.max(0, (t - 0.05) / Math.max(0.05, len - 0.05)));
    a *= 1 + 0.07 * vibIn * vib;
    if (t > len) a *= Math.max(0, 1 - (t - len) / release);

    // ---- tone: dull at the very start, opening to full brightness in 40 ms
    const b = Math.min(1, 0.35 + t / 0.04);
    const x = phase * TABLE;
    const j = Math.floor(x);
    const fr = x - j;
    const vb = bright[j] + fr * (bright[j + 1] - bright[j]);
    const vd = dull[j] + fr * (dull[j + 1] - dull[j]);
    const tone = vd + b * (vb - vd);
    // the membrane rattles once per period: noise gated by the wave's own phase
    const gate = Math.max(0, Math.cos(TAU * phase)) ** 6;
    pulseSum += gate;
    y[i] = a * (tone + 0.55 * gate * buzzN[i] + 0.05 * breath[i]);
  }
  mixInto(y, chiff, 0, 0.35);
  for (let i = 0; i < n; i += 1) y[i] *= 0.5 * vel;
  return fade(y, 0.0008, 0.004);
}

// ---------------------------------------------------------------- struck things

/**
 * Decaying partials whose frequencies all move together after the stroke:
 * f(t) = f * (1 + glide * (1 - exp(-t / tau))). partials: [ratio, amp, t60, detuneHz].
 */
function glidingModes({ f, partials, glide = 0, tau = 0.05, seconds, seed = 1 }) {
  const n = samples(seconds);
  const y = new Float32Array(n);
  const r = rng(seed);
  for (const [ratio, amp, t60, beat = 0] of partials) {
    const d = Math.exp(-6.9078 / (t60 * SR));
    let g = amp;
    let ph = TAU * r();
    for (let i = 0; i < n; i += 1) {
      const t = i / SR;
      const fi = f * ratio * (1 + glide * (1 - Math.exp(-t / tau))) + beat;
      ph += (TAU * fi) / SR;
      y[i] += g * Math.sin(ph);
      g *= d;
    }
  }
  return y;
}

/** A short burst of filtered noise: the stick or the mallet. */
function strike(seconds, seed, type, fc, q, points) {
  const x = biquad(white(samples(seconds), seed), type, fc, q);
  return envelope(x, points);
}

/** Small gong: its pitch rises after the stroke, 2.5 semitones, and settles on D6 (1175 Hz). */
const SMALL_GONG_RISE = 2 ** (2.5 / 12);
function smallGongSamples(v) {
  const y = glidingModes({
    f: hz(midi("D6")) / SMALL_GONG_RISE,
    glide: SMALL_GONG_RISE - 1,
    tau: 0.05,
    seconds: 0.5,
    seed: 20 + v,
    partials: [
      [1, 1, 0.42],
      [1, 0.4, 0.38, 3.1],
      [1.47, 0.32, 0.25],
      [2.31, 0.22, 0.16],
      [3.08, 0.12, 0.1],
    ],
  });
  mixInto(y, strike(0.02, 40 + v, "bandpass", 4200, 1.0, [[0, 0], [0.0004, 1], [0.004, 0.2], [0.02, 0]]), 0, 0.5);
  return normalize(fade(y, 0.0006, 0.03), 0.9);
}

/** Large gong: low, slow, its pitch falls after the stroke. */
function largeGongSamples() {
  const y = glidingModes({
    f: 140,
    glide: 2 ** (-1.5 / 12) - 1,
    tau: 0.22,
    seconds: 2.6,
    seed: 126,
    partials: [
      [1, 1, 3.5],
      [1, 0.5, 3.2, 1.0],
      [1.52, 0.6, 2.8],
      [2.15, 0.55, 2.1],
      [2.15, 0.25, 1.9, 1.9],
      [2.83, 0.42, 1.7],
      [3.55, 0.32, 1.4],
      [4.18, 0.22, 1.1],
      [6.1, 0.16, 0.6],
      [7.45, 0.11, 0.5],
      [8.9, 0.08, 0.4],
      [11.2, 0.05, 0.28],
    ],
  });
  // the bloom: the plate takes a moment to swing fully, so the body swells over its first 80 ms
  // (the mallet's thump carries the instant): the ring is louder against the attack
  for (let i = 0, nb = samples(0.08); i < nb; i += 1) y[i] *= 0.35 + 0.65 * (0.5 - 0.5 * Math.cos((Math.PI * i) / nb));
  // the padded mallet: a soft low thump
  const thump = onePole(onePole(white(samples(0.05), 62), 380), 380);
  envelope(thump, [[0, 0], [0.003, 1], [0.02, 0.3], [0.05, 0]]);
  mixInto(y, thump, 0, 4);
  return normalize(fade(onePole(y, 45, "highpass"), 0.002, 0.5), 0.9);
}

/** Cymbals clashed and choked against the chest. */
function cymbalSamples() {
  const r = rng(77);
  const parts = [];
  for (let i = 0; i < 36; i += 1) parts.push([1 + (r() * 8.5) ** 1.2, 0.3 + 0.7 * r(), 0.6 + 0.8 * r()]);
  const y = glidingModes({ f: 1500, partials: parts, seconds: 0.32, seed: 78 });
  normalize(y, 0.6);
  const hiss = biquad(white(samples(0.32), 79), "highpass", 3000, 0.7);
  mixInto(y, hiss, 0, 0.35);
  envelope(y, [[0, 0], [0.0008, 1], [0.04, 0.75], [0.09, 0.4], [0.2, 0.04], [0.3, 0], [0.32, 0]]);
  return normalize(fade(biquad(y, "highpass", 900, 0.7), 0.0006, 0.01), 0.9);
}

/** A round skin: modes whose pitch drops as the skin relaxes, and the stick. */
function drumSamples({ f, drop, tau, modes, seconds, stick, stickHz, stickQ, seed }) {
  const n = samples(seconds);
  const y = new Float32Array(n);
  for (const [ratio, a, t60] of modes) {
    const d = Math.exp(-6.9078 / (t60 * SR));
    let g = a;
    let ph = 0;
    for (let i = 0; i < n; i += 1) {
      const t = i / SR;
      ph += (TAU * f * ratio * (1 + drop * Math.exp(-t / tau))) / SR;
      y[i] += g * Math.sin(ph);
      g *= d;
    }
  }
  mixInto(y, strike(0.03, seed, "bandpass", stickHz, stickQ, [[0, 0], [0.0003, 1], [0.003, 0.25], [0.012, 0.04], [0.03, 0]]), 0, stick);
  return normalize(fade(onePole(y, f * 0.4, "highpass"), 0.0005, 0.02), 0.9);
}

const highDrumSamples = (v) =>
  drumSamples({ f: 1150 + 25 * v, drop: 0.06, tau: 0.01, modes: [[1, 1, 0.07], [1.59, 0.5, 0.05], [2.14, 0.3, 0.035]], seconds: 0.12, stick: 1.6, stickHz: 3000, stickQ: 0.9, seed: 90 + v });
const lowDrumSamples = (v) =>
  drumSamples({ f: 92 + 3 * v, drop: 0.28, tau: 0.03, modes: [[1, 1, 0.45], [1.59, 0.35, 0.22], [2.14, 0.2, 0.14], [2.65, 0.1, 0.09]], seconds: 0.6, stick: 0.35, stickHz: 1100, stickQ: 0.8, seed: 95 + v });

function woodblockSamples(v) {
  const y = glidingModes({ f: 1480 + 60 * v, partials: [[1, 1, 0.08], [2.72, 0.35, 0.04], [4.1, 0.2, 0.025]], seconds: 0.12, seed: 110 + v });
  mixInto(y, strike(0.01, 120 + v, "bandpass", 5000, 1.0, [[0, 0], [0.0003, 1], [0.003, 0.1], [0.01, 0]]), 0, 0.6);
  return normalize(fade(y, 0.0005, 0.015), 0.9);
}

/**
 * The crown: large gong, cymbals, low and high drum struck together, as one stereo buffer.
 * The four attacks land on the same sample, so their peaks are rounded off together
 * (a soft limit on the first instants only: the ringing stays as it was).
 */
const CROWN = ["largeGong", "cymbals", "lowDrum", "highDrum"];
const CROWN_LIMIT = 0.37;
const CROWN_KNEE = 0.27; // below this the crown passes untouched: only the very top of the stroke is bent
/** How much of each instrument's own level it brings to the crown: the gong leads, the clash and the stick only mark the instant. */
const CROWN_SHARE = { largeGong: 1, cymbals: 0.75, lowDrum: 1, highDrum: 0.9 };
function crownLimit(x) {
  const ax = Math.abs(x);
  if (ax <= CROWN_KNEE) return x;
  const room = CROWN_LIMIT - CROWN_KNEE;
  return Math.sign(x) * (CROWN_KNEE + room * Math.tanh((ax - CROWN_KNEE) / room));
}
function crownSamples() {
  const n = samples(LEN.largeGong);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  for (const inst of CROWN) {
    const x = MAKE[inst](0);
    const a = ((PAN[inst] + 1) / 2) * (Math.PI / 2);
    mixInto(L, x, 0, LEVEL[inst] * CROWN_SHARE[inst] * Math.cos(a));
    mixInto(R, x, 0, LEVEL[inst] * CROWN_SHARE[inst] * Math.sin(a));
  }
  for (let i = 0; i < n; i += 1) {
    L[i] = crownLimit(L[i]);
    R[i] = crownLimit(R[i]);
  }
  return [fade(L, 0.0005, 0.5), fade(R, 0.0005, 0.5)];
}

const MAKE = {
  smallGong: smallGongSamples,
  largeGong: largeGongSamples,
  cymbals: cymbalSamples,
  highDrum: highDrumSamples,
  lowDrum: lowDrumSamples,
  woodblock: woodblockSamples,
};
/** Linear level of each instrument at vel 1, and where it stands. */
const LEVEL = { crown: 1, flute: 0.45, smallGong: 0.25, largeGong: 0.62, cymbals: 0.42, highDrum: 0.4, lowDrum: 0.32, woodblock: 0.225 };
const PAN = { crown: 0, flute: 0.04, smallGong: 0.3, largeGong: -0.1, cymbals: -0.25, highDrum: -0.2, lowDrum: -0.05, woodblock: 0.22 };
const LEN = { crown: 2.6, smallGong: 0.5, largeGong: 2.6, cymbals: 0.32, highDrum: 0.12, lowDrum: 0.6, woodblock: 0.12 };

// ---------------------------------------------------------------- the plan

let PLAN = null;
/** Every flute note and every stroke, as plain data: shared by score() and prepare(). */
function plan() {
  if (PLAN) return PLAN;
  const notes = theme({ octave: 1 });
  const GRACE = { 0: "E5", 1: "B5", 2: "D6", 4: "A5", 5: "D5" }; // by beat/2 of the skeleton notes that get one
  const flute = notes.map((nt, i) => {
    const spec = { i, u: nt.u, dur: nt.dur, midi: nt.midi, seed: 11 + i, len: nt.dur - 0.02, vel: 0.85 };
    if (nt.skeleton && GRACE[nt.beat / 2] && nt.beat !== 6) spec.grace = midi(GRACE[nt.beat / 2]);
    if (nt.u >= 2 && nt.u < 3) spec.vel = 0.95; // the top of the climb
    // the crown's E enters under the gong, grows out of it as the gong falls, then fades
    if (nt.u === 3) Object.assign(spec, { vel: 0.6, trill: { upper: midi("F#5"), start: 0.42, rate: 6.5 }, shape: [[0, 1], [0.4, 1], [0.82, 1.12], [0.96, 0.5]], len: 0.96 });
    if (nt.u >= 4) spec.vel = 0.65; // bar 3 a little under the climb, so the small gong and woodblock are heard
    if (i === notes.length - 1) spec.len = 0.15; // gone before the bell (silent from u 5.935)
    return spec;
  });

  const hits = [];
  const hit = (inst, u, vel, v = 0) => hits.push({ inst, u, vel, v });
  // bar 1: the pedal rhythm (long, short, short) on the drums
  hit("lowDrum", 0, 0.9, 0);
  hit("highDrum", 0.5, 0.6, 0);
  hit("highDrum", 0.75, 0.5, 1);
  hit("lowDrum", 1.0, 0.75, 1);
  // from 1.0 the high drum rolls: sixteenths to 2.0, then thirty-seconds, growing to the crown
  for (let u = 1.0; u < 2.0 - 1e-9; u += 0.125) hit("highDrum", u, 0.25 + 0.2 * (u - 1) + (Math.abs(u - 1.5) < 1e-9 || Math.abs(u - 1.75) < 1e-9 ? 0.15 : 0), Math.round(u * 8) % 2);
  for (let u = 2.0; u < 2.97; u += 0.0625) hit("highDrum", u, 0.45 + 0.45 * ((u - 2) / 0.94), Math.round(u * 16) % 2);
  // small gong on the off-beats, woodblock on the beats
  for (const u of [0.25, 0.75, 1.25, 1.75, 2.25, 2.75]) hit("smallGong", u, u < 2 ? 0.6 : 0.68, Math.round(u * 4) % 2);
  for (const u of [0, 0.5, 1.0, 1.5, 2.0, 2.5]) hit("woodblock", u, 0.64, Math.round(u * 2) % 2);
  // the crown: everything at once
  hit("crown", 3.0, 1);
  // bar 3: down the far side
  // (louder than bar 1: here they carry the band alone, within about 9 dB of the flute)
  for (const u of [4.25, 4.75, 5.25]) hit("smallGong", u, 1, Math.round(u * 4) % 2);
  for (const u of [4.0, 4.5, 5.0, 5.5]) hit("woodblock", u, 1, Math.round(u * 2) % 2);

  PLAN = { flute, hits };
  return PLAN;
}

// ---------------------------------------------------------------- playing

const fluteKey = (i) => `qingming/flute/${i}`;
const hitKey = (inst, v) => `qingming/${inst}/${v}`;

function dizi(k, g, when, ev) {
  const spec = plan().flute[ev.index];
  const buf = k.buffer(fluteKey(ev.index), () => diziSamples(spec));
  const { out } = k.play(buf, when, { gain: LEVEL.flute, pan: PAN.flute }, g.bus || g.out);
  if (g.send) out.connect(g.send);
}

const make = (inst, v) => (inst === "crown" ? crownSamples() : MAKE[inst](v));

function struck(k, g, when, ev) {
  const buf = k.buffer(hitKey(ev.inst, ev.v), () => make(ev.inst, ev.v));
  const { out } = k.play(buf, when, { gain: LEVEL[ev.inst] * ev.vel, pan: PAN[ev.inst] }, g.bus || g.out);
  if (g.send) out.connect(g.send);
}

/** The outro's note: a plain dizi note, any pitch, any length (a held note fades out). */
const LEAD_SECONDS = 1.4;
const leadSpec = (m) => ({ midi: m, len: LEAD_SECONDS, vel: 0.85, seed: 200 + m, release: 0.04 });
function leadVoice(k, g, when, ev) {
  const buf = k.buffer(`qingming/lead/${ev.midi}`, () => diziSamples(leadSpec(ev.midi)));
  const dur = Math.min(Math.max(0.08, (ev.dur || 0.5) + 0.02), LEAD_SECONDS);
  k.play(buf, when, { gain: LEVEL.flute * (ev.vel === undefined ? 1 : ev.vel), pan: PAN.flute, dur, fade: Math.min(0.04, dur / 3) }, g.bus || g.out);
}

/** Open air: hardly any room. */
const ROOM = { seconds: 0.8, t60: 0.6, bright: 0.6, predelay: 0.01, early: 0.3, seed: 66 };

export default {
  prepare() {
    prepareReverb("qingming/room", ROOM);
    const { flute, hits } = plan();
    flute.forEach((spec) => sharedBuffer(fluteKey(spec.i), () => diziSamples(spec)));
    for (const h of hits) sharedBuffer(hitKey(h.inst, h.v), () => make(h.inst, h.v));
    // the outro's notes: the D major scale from G4 to B6
    for (const name of ["G4", "A4", "B4", "C#5", "D5", "E5", "F#5", "G5", "A5", "B5", "C#6", "D6", "E6", "F#6", "G6", "A6", "B6"]) {
      const m = midi(name);
      sharedBuffer(`qingming/lead/${m}`, () => diziSamples(leadSpec(m)));
    }
  },

  graph(k, out) {
    const bus = k.gain(1);
    bus.connect(out);
    const room = k.reverb("qingming/room", ROOM);
    const send = k.gain(0.12);
    send.connect(room).connect(out);
    return { bus, send };
  },

  score(s) {
    const { flute, hits } = plan();
    for (const spec of flute) {
      s.note(dizi, spec.u, spec.dur, spec.midi, spec.vel, { lead: true, index: spec.i, label: spec.trill ? "dizi trill" : "dizi" });
    }
    for (const h of hits) s.at(h.u, struck, { dur: LEN[h.inst], inst: h.inst, v: h.v, vel: h.vel, label: h.inst === "crown" ? "crown: largeGong cymbals lowDrum highDrum" : h.inst });
    s.cue(0, "the pelican rides onto the bridge approach");
    s.cue(3.0, "the crown: every head turned; large gong, cymbals and both drums");
  },

  lead: leadVoice,
  leadOctave: 1,
  bike: { chain: 1, bell: 1 },
};
