// Section 8 (mughal): a garden party with musicians, and then none.
//
// A sitar plays the tune's first two bars with its slides, the tabla keeps the
// first half of a twelve-beat cycle, the tanpura drones on D and A. On the
// strong beat of bar 2 (u = 3.0) every guest is painted again with a finger on
// the lips and the musicians' hands are off their instruments: the sitar
// strikes the held E and the string is choked at once, the lute is set down on
// the carpet (one muffled knock, a faint jangle), tabla and drone are damped.
// For a bar the only sound is the bicycle. From u = 4.0 the lute lies on the
// carpet and its sympathetic strings, which nobody touches, sound the tune's
// last bar by themselves, in a whisper; the bell on the next crossing gives the
// D the tune was owed.
//
// Everything is computed in prepare() as buffers, in plain arithmetic:
//   sitar     a steel string as a sum of harmonics whose pitch follows the
//             player's slides; the curved bridge (jawari) is modelled as energy
//             passed up into the high partials for the first 80 ms, and a
//             nasal band that sweeps down as the note sings
//   chikari   the two high drone strings (D5, D6), same model, lighter
//   taraf     sympathetic strings: a faint, slowly swelling ring at the pitch
//             the main string arrives at
//   tabla     the right drum (dayan) tuned to D4, with the nearly harmonic
//             modes the black patch gives it (1, 2, 3, 4, 5), rim, open and
//             dry strokes; the left drum (bayan), whose pitch rises under the heel
//   tanpura   D2, D3 and A2 plucked in turn, a soft sequential bloom of partials
//   the lute  a muffled wooden knock on a carpet and three slack strings

import { SR, rng, white, biquad, onePole, envelope, fade, mixInto, samples } from "../engine/dsp.js";
import { sharedBuffer, prepareReverb } from "../engine/kit.js";
import { hz, midi } from "../engine/theory.js";

const STOP = 3.0; // u: everyone astonished, the music stops
const DAMP = 0.05; // seconds a hand takes to damp a string or a skin

const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x));

// ---------------------------------------------------------------- additive strings

/**
 * A sum of K harmonics on one running phase, so that the pitch can slide
 * without a seam. sin(k theta) and cos(k theta) come from the Chebyshev
 * recurrence; every partial has its own fixed phase (a steel string over a
 * buzzing bridge does not keep the pluck's phases, and aligned phases make a
 * needle-sharp waveform). Pitch and levels are computed every 32 samples and
 * interpolated in between.
 *   n        samples
 *   midiAt   (t) -> pitch
 *   levels   (t, f, out) fills out[1..K] with each partial's amplitude
 */
function additive(n, K, midiAt, levels, seed) {
  const y = new Float32Array(n);
  const r = rng(seed);
  const ca = new Float32Array(K + 1);
  const sa = new Float32Array(K + 1);
  for (let k = 1; k <= K; k += 1) {
    const ph = k === 1 ? 0 : r() * 2 * Math.PI;
    ca[k] = Math.cos(ph);
    sa[k] = Math.sin(ph);
  }
  const B = 32;
  const amp = new Float32Array(K + 1);
  const next = new Float32Array(K + 1);
  const step = new Float32Array(K + 1);
  let f0 = hz(midiAt(0));
  levels(0, f0, amp);
  let theta = 0;
  const TWO_PI = 2 * Math.PI;
  for (let i0 = 0; i0 < n; i0 += B) {
    const len = Math.min(B, n - i0);
    const t1 = (i0 + len) / SR;
    const f1 = hz(midiAt(t1));
    levels(t1, f1, next);
    for (let k = 1; k <= K; k += 1) step[k] = (next[k] - amp[k]) / len;
    const df = (f1 - f0) / len;
    let f = f0;
    for (let i = i0; i < i0 + len; i += 1) {
      f += df;
      theta += (TWO_PI * f) / SR;
      if (theta > TWO_PI) theta -= TWO_PI;
      const s1 = Math.sin(theta);
      const c1 = Math.cos(theta);
      const c2 = 2 * c1;
      let sP = 0;
      let sC = s1;
      let cP = 1;
      let cC = c1;
      let v = 0;
      for (let k = 1; k <= K; k += 1) {
        const a = (amp[k] += step[k]);
        if (a !== 0) v += a * (sC * ca[k] + cC * sa[k]);
        const sN = c2 * sC - sP;
        sP = sC;
        sC = sN;
        const cN = c2 * cC - cP;
        cP = cC;
        cC = cN;
      }
      y[i] = v;
    }
    f0 = f1;
  }
  return y;
}

/** A hand on the string: 1 until end - stop, then a smooth fall to 0 at end. */
const handAt = (t, end, stop) => (t >= end ? 0 : t > end - stop ? 1 - ease((t - (end - stop)) / stop) : 1);

/**
 * A plucked steel string over a curved bridge (sitar).
 *   m0       starting pitch (MIDI)
 *   glides   [{ at, len, to }]: the pitch moves to `to` from `at` over `len` seconds
 *   seconds  how long the buffer is; `end` (seconds) where the hand stops it, over `stop` seconds
 *   t60      the fundamental's decay
 *   jawari   how much the bridge lifts the upper partials in the first ~80 ms
 *   pick     plucking point (fraction of the length); tilt: how fast the partials fall with k
 *   sweep    the nasal band's centre at the pluck and after (Hz); nasal: its boost;
 *            width: its width as a fraction of its centre
 *   attack   seconds of onset (a wire plectrum: about a millisecond)
 *   noise    level of the plectrum's scrape
 *   hiDecay  extra decay rate (1/s) of the partials above hiFrom Hz, growing with
 *            frequency (x1 at 2 hiFrom), from the end of the jawari's bloom (bloom s):
 *            the upper partials swell and then fall from the top down (0: off)
 */
function steel({ m0, glides = [], seconds, end = seconds, stop = 0.01, t60 = 4.5, jawari = 2.0, pick = 0.09, tilt = 1.15, sweep = [4000, 1700], nasal = 0.9, attack = 0.0012, noise = 0.07, seed = 1, top = 9000, level = 0.3, hiDecay = 0, hiFrom = 2500, bloom = 0.08, width = 0.55 }) {
  const n = samples(seconds);
  const lowest = Math.min(m0, ...glides.map((g) => g.to));
  const K = Math.max(4, Math.min(40, Math.floor(top / hz(lowest))));
  const base = new Float32Array(K + 1);
  const tau = new Float32Array(K + 1);
  const jw = new Float32Array(K + 1);
  for (let k = 1; k <= K; k += 1) {
    base[k] = level * Math.max(0.03, Math.abs(Math.sin(Math.PI * k * pick))) / k ** tilt;
    tau[k] = t60 / 6.9078 / (1 + 0.06 * (k - 1));
    jw[k] = jawari * clamp((k - 2) / 6);
  }
  const midiAt = (t) => {
    let m = m0;
    for (const g of glides) {
      if (t >= g.at + g.len) m = g.to;
      else if (t > g.at) m = m + (g.to - m) * ease((t - g.at) / g.len);
    }
    return m;
  };
  const levels = (t, f, out) => {
    const buzz = (1 - Math.exp(-t / 0.05)) * Math.exp(-t / 0.4);
    const fc = sweep[1] + (sweep[0] - sweep[1]) * Math.exp(-t / 0.3);
    const g = handAt(t, end, stop) * (t < attack ? ease(t / attack) : 1);
    const after = t > bloom ? t - bloom : 0;
    for (let k = 1; k <= K; k += 1) {
      const fk = k * f;
      const aa = clamp((top - fk) / 1500);
      const d = (fk - fc) / (width * fc);
      const hi = hiDecay > 0 && fk > hiFrom ? Math.exp(-after * hiDecay * ((fk - hiFrom) / hiFrom)) : 1;
      out[k] = g * aa === 0 ? 0 : base[k] * Math.exp(-t / tau[k]) * hi * (1 - 0.65 * clamp((k - 2) / 6) + jw[k] * buzz) * (1 + nasal * Math.exp(-d * d)) * aa * g;
    }
  };
  const y = additive(n, K, midiAt, levels, seed);
  if (noise > 0) {
    // the wire plectrum leaving the string
    const sc = biquad(white(samples(0.012), seed), "bandpass", 3800, 1.1);
    envelope(sc, [[0, 0], [0.0005, 1], [0.003, 0.3], [0.012, 0]]);
    mixInto(y, sc, 0, noise * level * 4);
  }
  return fade(y, 0.0008, 0.004);
}

// ---------------------------------------------------------------- what the sitar plays

/**
 * The strokes of the right hand. Each stroke is one pluck of the main string;
 * the slides inside it are the left hand pulling the string (no new pluck).
 * notes: the tune's notes that the stroke carries (u, dur, midi), the first
 * one at the pluck. end: u at which the string stops (the next stroke, or the hand).
 */
const D4 = midi("D4");
const E4 = midi("E4");
const FS4 = midi("F#4");
const A4 = midi("A4");
const B4 = midi("B4");
const STROKES = [
  { u: 0.0, m0: D4, glides: [], end: 0.5, vel: 0.95, notes: [[0.0, 0.5, D4]] },
  // E, then pulled up to F# so that it arrives on the half beat
  { u: 0.5, m0: E4, glides: [{ at: 0.17, len: 0.1, to: FS4 }], end: 1.0, vel: 0.85, notes: [[0.5, 0.25, E4], [0.75, 0.25, FS4]] },
  // A, then let down to F# and plucked again on the A
  { u: 1.0, m0: A4, glides: [{ at: 0.43, len: 0.12, to: FS4 }], end: 1.75, vel: 0.9, seed: 59, notes: [[1.0, 0.5, A4], [1.5, 0.25, FS4]] },
  { u: 1.75, m0: A4, glides: [], end: 2.0, vel: 0.8, notes: [[1.75, 0.25, A4]] },
  // the top: struck on the A fret and bent up to B (a quick pull: B by u = 2.05); let down to A and to F#
  {
    u: 2.0,
    m0: A4,
    glides: [{ at: 0.0, len: 0.05, to: B4 }, { at: 0.44, len: 0.12, to: A4 }, { at: 0.7, len: 0.1, to: FS4 }],
    end: 3.0,
    vel: 1.0,
    notes: [[2.0, 0.5, B4], [2.5, 0.25, A4], [2.75, 0.25, FS4]],
  },
  // the held E: struck, and choked within 60 ms
  { u: 3.0, m0: E4, glides: [], end: 3.0 + 0.055, stop: 0.04, vel: 1.0, notes: [[3.0, 0.06, E4]], choke: true },
];

/** The high drone strings, struck by the little finger between the melody notes:
 *  on the off-beat after each beat 0, 2, 4 (vel 1), and lightly on the last
 *  eighth of each beat 1, 3, 5 (after the review). */
const CHIKARI = [
  { u: 0.25, vel: 1 },
  { u: 1.25, vel: 1 },
  { u: 2.25, vel: 1 },
  { u: 0.75, vel: 0.45 },
  { u: 1.75, vel: 0.45 },
  { u: 2.75, vel: 0.45 },
];

/** Sympathetic strings: the notes the main string comes to rest on. */
function tarafNotes() {
  const out = [];
  for (const st of STROKES) if (!st.choke) for (const [u, , m] of st.notes) out.push({ u, m, slid: u !== st.u });
  return out;
}

const strokeKey = (st) => `mughal/sitar/${st.u.toFixed(3)}`;
function strokeSamples(st) {
  const ring = st.end - st.u;
  return steel({ m0: st.m0, glides: st.glides, seconds: ring + 0.01, end: ring, stop: st.stop || 0.008, seed: st.seed || 11 + Math.round(st.u * 8), ...SITAR_TONE });
}

/** The main string's tone (after two reviews): a narrow nasal band low down
 *  (1.4 -> 1.25 kHz) that lifts 1-2 kHz and leaves 2-5 kHz alone, a steeper
 *  fall of level with k (tilt) than the first build, and the partials above
 *  2 kHz falling faster still once the jawari has bloomed (the higher, the
 *  faster: top down). The sitar's and the outro's notes use it; the chikari
 *  keeps its own. */
const SITAR_TONE = { nasal: 0.4, sweep: [1400, 1250], width: 0.35, hiDecay: 32, tilt: 1.25, hiFrom: 2000 };

function chikariSamples(i) {
  const len = STOP - CHIKARI[i].u + DAMP + 0.01;
  const a = steel({ m0: midi("D5"), seconds: len, end: len - 0.01, stop: DAMP, t60: 2.0, jawari: 1.2, pick: 0.13, tilt: 1.1, sweep: [5000, 2600], nasal: 0.8, noise: 0.08, seed: 30 + i, level: 0.2 });
  const b = steel({ m0: midi("D6"), seconds: len, end: len - 0.01, stop: DAMP, t60: 1.6, jawari: 1.0, pick: 0.15, tilt: 1.2, sweep: [6000, 3000], nasal: 0.6, noise: 0.0, seed: 40 + i, level: 0.14 });
  mixInto(a, b, 0.004, 1);
  return a;
}

/** A sympathetic string: a few harmonics, no pluck, a slow swell and a long ring. */
function tarafSamples(m, u) {
  const len = STOP - u + DAMP + 0.01;
  const parts = [0, [1, 2.6], [0.45, 1.8], [0.25, 1.2], [0.12, 0.9]];
  const levels = (t, f, out) => {
    const g = (1 - Math.exp(-t / 0.06)) * handAt(t, len - 0.01, DAMP);
    for (let k = 1; k <= 4; k += 1) out[k] = g * parts[k][0] * Math.exp((-6.9078 * t) / parts[k][1]);
  };
  return fade(additive(samples(len), 4, () => m, levels, 50 + m), 0.002, 0.01);
}

/** The tune's last bar, sounded by the lute's sympathetic strings alone (after the
 *  acceptance check): the taraf's partials, no pluck, a short swell (full within
 *  WHISPER.swell s, so that each note speaks on its beat) and a long ring, which the
 *  air lets go of over the buffer's last WHISPER.release s. */
const WHISPER = { from: 4.0, swell: 0.04, seconds: 1.2, release: 0.45 };
function whisperSamples(m) {
  const len = WHISPER.seconds;
  const parts = [0, [1, 2.6], [0.45, 1.8], [0.25, 1.2], [0.12, 0.9]];
  const levels = (t, f, out) => {
    const g = ease(t / WHISPER.swell) * handAt(t, len - 0.01, WHISPER.release);
    for (let k = 1; k <= 4; k += 1) out[k] = g * parts[k][0] * Math.exp((-6.9078 * t) / parts[k][1]);
  };
  return fade(additive(samples(len), 4, () => m, levels, 150 + m), 0.002, 0.01);
}

// ---------------------------------------------------------------- the tabla

/**
 * A skin as a few decaying sinusoids on one moving pitch, plus the hand.
 *   f, rise: pitch and how far it climbs (fraction) with time constant riseTau (the heel on the bayan)
 *   modes [ratio, amp, t60]; hand: level of the slap noise, its centre and decay
 *   end: where the player's hand damps it (seconds)
 */
function skin({ f, rise = 0, riseTau = 0.12, modes, hand = 0.3, handHz = 2000, handQ = 0.9, handDecay = 0.006, seconds, end = seconds, seed = 1 }) {
  const n = samples(seconds);
  const y = new Float32Array(n);
  const ph = modes.map(() => 0);
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    const fNow = f * (1 + rise * (1 - Math.exp(-t / riseTau)));
    let v = 0;
    modes.forEach(([r, a, t60], j) => {
      ph[j] += (2 * Math.PI * fNow * r) / SR;
      v += a * Math.exp((-6.9078 * t) / t60) * Math.sin(ph[j]);
    });
    y[i] = v;
  }
  if (hand > 0) {
    const h = biquad(white(samples(0.05), seed), "bandpass", handHz, handQ);
    envelope(h, [[0, 0], [0.0004, 1], [handDecay, 0.2], [handDecay * 3, 0.03], [0.05, 0]]);
    mixInto(y, h, 0, hand);
  }
  if (end < seconds) envelope(y, [[0, 1], [Math.max(0, end - DAMP), 1], [end, 0], [seconds, 0]]);
  const out = onePole(y, 45, "highpass");
  return fade(out, 0.0006, 0.006);
}

const DAYAN = hz(D4);
/** The strokes (bols). ring: how long the stroke would sound if nobody stopped it. */
const BOL = {
  // rim stroke: the fundamental is damped by the finger, the harmonics ring
  na: (end) => skin({ f: DAYAN, modes: [[1, 0.25, 0.5], [2, 1, 0.9], [3, 0.6, 0.7], [4, 0.35, 0.5], [5, 0.2, 0.35], [6.3, 0.08, 0.15]], hand: 0.35, handHz: 3500, seconds: Math.min(0.9, end), end, seed: 3 }),
  // open stroke on the black patch: the fundamental itself
  tun: (end) => skin({ f: DAYAN, modes: [[1, 1, 1.2], [2, 0.3, 0.6], [3, 0.12, 0.4]], hand: 0.25, handHz: 1200, seconds: Math.min(1.2, end), end, seed: 5 }),
  // tin: open, between rim and patch
  tin: (end) => skin({ f: DAYAN, modes: [[1, 0.6, 0.7], [2, 0.8, 0.6], [3, 0.5, 0.45], [4, 0.2, 0.3]], hand: 0.35, handHz: 2600, seconds: Math.min(0.8, end), end, seed: 7 }),
  // dry slaps in the middle (ti, te, ta): the hand stays on the skin
  ti: () => skin({ f: DAYAN, modes: [[1, 0.5, 0.05], [2, 0.4, 0.04], [3.1, 0.3, 0.03]], hand: 0.9, handHz: 1800, handQ: 0.8, handDecay: 0.005, seconds: 0.08, seed: 9 }),
  ra: () => skin({ f: DAYAN, modes: [[1, 0.4, 0.045], [2, 0.35, 0.035], [3.1, 0.25, 0.03]], hand: 0.8, handHz: 2300, handQ: 0.8, handDecay: 0.004, seconds: 0.07, seed: 13 }),
  // the left drum: open, the heel pushing the pitch up
  ge: (end) => skin({ f: 92, rise: 0.32, riseTau: 0.11, modes: [[1, 1, 0.7], [2.03, 0.22, 0.4], [2.98, 0.08, 0.25]], hand: 0.25, handHz: 500, handQ: 0.7, handDecay: 0.01, seconds: Math.min(1.0, end), end, seed: 17 }),
  // the left drum, closed flat-hand slap
  ka: () => skin({ f: 120, modes: [[1, 0.6, 0.05], [1.6, 0.3, 0.035]], hand: 0.9, handHz: 650, handQ: 0.7, handDecay: 0.008, seconds: 0.09, seed: 19 }),
};
/** The first six beats of the twelve-beat cycle: one syllable per beat, a run on the fourth. */
const THEKA = [
  { u: 0.0, bols: ["ge", "tin"], name: "dhin" },
  { u: 0.5, bols: ["ge", "tin"], name: "dhin" },
  { u: 1.0, bols: ["ge", "na"], name: "dha" },
  { u: 1.25, bols: ["ge"], name: "ge" },
  { u: 1.5, bols: ["ti"], name: "ti" },
  { u: 1.625, bols: ["ra"], name: "ra" },
  { u: 1.75, bols: ["ka"], name: "ki" },
  { u: 1.875, bols: ["ti"], name: "ta" },
  { u: 2.0, bols: ["tun"], name: "tu" },
  { u: 2.5, bols: ["na"], name: "na" },
];
const RING = { na: 0.9, tun: 1.2, tin: 0.8, ti: 0.08, ra: 0.07, ge: 1.0, ka: 0.09 };
const TABLA_LEVEL = { na: 0.16, tun: 0.18, tin: 0.13, ti: 0.12, ra: 0.1, ge: 0.17, ka: 0.12 };
const TABLA_PAN = { na: 0.25, tun: 0.25, tin: 0.25, ti: 0.25, ra: 0.25, ge: 0.12, ka: 0.12 };
const bolKey = (u, b) => `mughal/tabla/${b}/${u.toFixed(3)}`;

// ---------------------------------------------------------------- the tanpura

/** Pa, Sa, Sa, low Sa, plucked in turn. */
const TANPURA = [
  { u: 0.0, m: midi("A2") },
  { u: 0.75, m: midi("D3") },
  { u: 1.5, m: midi("D3") },
  { u: 2.25, m: midi("D2") },
];

function tanpuraSamples(i) {
  const { u, m } = TANPURA[i];
  const len = STOP - u + DAMP + 0.01;
  const f = hz(m);
  const K = Math.min(36, Math.floor(4200 / f));
  const r = rng(70 + i);
  const peakAt = [0];
  for (let k = 1; k <= K; k += 1) peakAt.push(0.08 + 0.05 * k + 0.1 * r()); // the jivari: higher partials bloom later
  const levels = (t, ff, out) => {
    const g = (t < 0.012 ? ease(t / 0.012) : 1) * handAt(t, len - 0.01, DAMP);
    for (let k = 1; k <= K; k += 1) {
      const d = (t - peakAt[k]) / 0.25;
      const bloom = k > 2 ? 0.25 + 1.4 * Math.exp(-d * d) : 1;
      out[k] = g * (1 / k ** 1.1) * bloom * Math.exp((-6.9078 * t) / (6 / (1 + 0.04 * k)));
    }
  };
  const y = additive(samples(len), K, () => m, levels, 70 + i);
  return fade(onePole(y, 40, "highpass"), 0.002, 0.01);
}

// ---------------------------------------------------------------- the lute set down

function knockSamples() {
  const n = samples(0.6);
  const y = new Float32Array(n);
  // the body on a carpet: a few low wooden modes, heavily damped
  for (const [f, a, t60] of [[148, 1, 0.09], [231, 0.7, 0.07], [385, 0.45, 0.05], [610, 0.25, 0.035]]) {
    for (let i = 0; i < n; i += 1) y[i] += a * Math.exp((-6.9078 * i) / (t60 * SR)) * Math.sin((2 * Math.PI * f * i) / SR);
  }
  const thud = onePole(white(samples(0.03), 91), 900);
  envelope(thud, [[0, 0], [0.001, 1], [0.008, 0.3], [0.03, 0]]);
  mixInto(y, thud, 0, 1.2);
  // three slack strings touched by the fall: dull, quickly gone
  const strings = [[midi("D3"), 0.012, 0.18], [midi("A3"), 0.027, 0.13], [midi("D4"), 0.041, 0.1]];
  for (const [m, at, a] of strings) {
    const s = new Float32Array(samples(0.5));
    const f = hz(m) * 0.994; // slack: a little flat
    for (let i = 0; i < s.length; i += 1) {
      const t = i / SR;
      let v = 0;
      for (let k = 1; k <= 6; k += 1) v += (1 / k ** 1.6) * Math.exp((-6.9078 * t) / (0.35 / k)) * Math.sin(2 * Math.PI * k * f * t);
      s[i] = v;
    }
    mixInto(y, fade(s, 0.001, 0.02), at, a);
  }
  return fade(onePole(y, 50, "highpass"), 0.0006, 0.03);
}

// ---------------------------------------------------------------- play functions

function sitar(k, g, when, ev) {
  const buf = k.buffer(strokeKey(ev.stroke), () => strokeSamples(ev.stroke));
  const { out } = k.play(buf, when, { gain: LEVEL.sitar * ev.vel, pan: -0.06 }, g.out);
  out.connect(g.send);
}

function taraf(k, g, when, ev) {
  const buf = k.buffer(`mughal/taraf/${ev.u.toFixed(3)}`, () => tarafSamples(ev.midi, ev.u));
  const { out } = k.play(buf, when, { gain: LEVEL.taraf * ev.vel, pan: 0.05 }, g.out);
  out.connect(g.send);
}

function whisper(k, g, when, ev) {
  const buf = k.buffer(`mughal/whisper/${ev.midi}`, () => whisperSamples(ev.midi));
  const { out } = k.play(buf, when, { gain: LEVEL.whisper * ev.vel, pan: 0.18 }, g.out);
  out.connect(g.send);
}

function chikari(k, g, when, ev) {
  const buf = k.buffer(`mughal/chikari/${ev.index}`, () => chikariSamples(ev.index));
  const { out } = k.play(buf, when, { gain: LEVEL.chikari * ev.vel, pan: -0.12 }, g.out);
  out.connect(g.send);
}

function tabla(k, g, when, ev) {
  const end = STOP - ev.u + DAMP;
  const buf = k.buffer(bolKey(ev.u, ev.bol), () => BOL[ev.bol](end));
  const { out } = k.play(buf, when, { gain: TABLA_LEVEL[ev.bol] * ev.vel * LEVEL.tabla, pan: TABLA_PAN[ev.bol] }, g.out);
  out.connect(g.send);
}

function tanpura(k, g, when, ev) {
  const buf = k.buffer(`mughal/tanpura/${ev.index}`, () => tanpuraSamples(ev.index));
  const { out } = k.play(buf, when, { gain: LEVEL.tanpura * ev.vel, pan: -0.3 }, g.out);
  out.connect(g.send);
}

function luteDown(k, g, when, ev) {
  const buf = k.buffer("mughal/knock", knockSamples);
  const { out } = k.play(buf, when, { gain: LEVEL.knock * ev.vel, pan: 0.18 }, g.out);
  out.connect(g.send);
}

/** The outro's note: one sitar pluck with a short slide into the note, no plectrum scrape. */
function leadVoice(k, g, when, ev) {
  const m = Math.round(ev.midi);
  const buf = k.buffer(`mughal/lead/${m}`, () => leadSamples(m));
  const dur = Math.max(0.08, Math.min(LEAD_SECONDS - 0.05, ev.dur || 0.5));
  const { out } = k.play(buf, when, { gain: LEVEL.sitar * (ev.vel === undefined ? 1 : ev.vel), dur: dur + 0.03, fade: 0.03, pan: -0.06 }, g.out);
  if (g.send) out.connect(g.send);
}
const LEAD_SECONDS = 1.4;
const leadSamples = (m) => steel({ m0: m, seconds: LEAD_SECONDS, end: LEAD_SECONDS - 0.02, stop: 0.015, noise: 0.08, seed: 200 + m, ...SITAR_TONE });

/** Linear levels at vel 1. */
const LEVEL = { sitar: 1.51, taraf: 0.012, chikari: 0.3, tabla: 0.8, tanpura: 0.03, knock: 0.12, whisper: 0.021 };

// ---------------------------------------------------------------- the place

/** A garden pavilion: open on three sides, a short and gentle ring. */
const ROOM = { seconds: 1.0, t60: 0.7, bright: 0.55, predelay: 0.01, early: 0.4, seed: 81 };

export default {
  prepare() {
    prepareReverb("mughal/room", ROOM);
    for (const st of STROKES) sharedBuffer(strokeKey(st), () => strokeSamples(st));
    CHIKARI.forEach((_, i) => sharedBuffer(`mughal/chikari/${i}`, () => chikariSamples(i)));
    for (const t of tarafNotes()) sharedBuffer(`mughal/taraf/${t.u.toFixed(3)}`, () => tarafSamples(t.m, t.u));
    for (const b of THEKA) for (const bol of b.bols) sharedBuffer(bolKey(b.u, bol), () => BOL[bol](STOP - b.u + DAMP));
    TANPURA.forEach((_, i) => sharedBuffer(`mughal/tanpura/${i}`, () => tanpuraSamples(i)));
    sharedBuffer("mughal/knock", knockSamples);
    for (const m of [midi("B3"), midi("A3"), D4, E4, FS4]) sharedBuffer(`mughal/whisper/${m}`, () => whisperSamples(m));
    // the outro's notes: the tune's range in D major
    for (const m of [57, 59, 61, 62, 64, 66, 67, 69, 71, 73, 74]) sharedBuffer(`mughal/lead/${m}`, () => leadSamples(m));
  },

  graph(k, out) {
    const room = k.reverb("mughal/room", ROOM);
    const send = k.gain(0.16);
    send.connect(room).connect(out);
    return { send };
  },

  score(s) {
    // ---- the sitar: bars 1 and 2, up to the choke at u = 3.0
    for (const st of STROKES) {
      const [u, dur, m] = st.notes[0];
      s.note(sitar, u, dur, m, st.vel, { stroke: st, lead: true, label: st.choke ? "sitar choked" : "sitar" });
    }
    for (const t of tarafNotes()) {
      // the notes reached by a slide are carried by the stroke before them; they are marked here
      const st = STROKES.find((x) => x.notes.some((nn) => nn[0] === t.u));
      const nn = st.notes.find((x) => x[0] === t.u);
      s.note(taraf, t.u, t.slid ? nn[1] : STOP - t.u, t.m, 1, { lead: t.slid, label: t.slid ? "sitar slide (taraf)" : "taraf" });
    }
    CHIKARI.forEach(({ u, vel }, i) => s.at(u, chikari, { index: i, vel, dur: STOP - u + DAMP, label: vel < 1 ? "chikari light" : "chikari" }));

    // ---- the tabla: the first half of the cycle
    for (const b of THEKA) for (const bol of b.bols) s.at(b.u, tabla, { bol, vel: 1, dur: Math.min(RING[bol], STOP - b.u + DAMP), label: `tabla ${b.name} (${bol})` });

    // ---- the tanpura
    TANPURA.forEach((t, i) => s.at(t.u, tanpura, { index: i, vel: 1, midi: t.m, dur: STOP - t.u + DAMP, label: "tanpura" }));

    // ---- u = 3.0: the lute is set down
    s.at(STOP, luteDown, { vel: 1, dur: 0.6, label: "lute set down" });

    // ---- u = 4.0: nobody plays; the lute's sympathetic strings finish the tune
    for (const note of s.theme()) if (note.u >= WHISPER.from) s.note(whisper, note.u, note.dur, note.midi, 1, { lead: true, label: "taraf whisper" });

    s.cue(0, "the pelican comes over the border into the garden; the party plays");
    s.cue(STOP, "everyone astonished: the sitar is choked, the lute set down, the music stops");
    s.cue(WHISPER.from, "the lute's own strings finish the tune", { soft: true, band: [340, 400] });
  },

  lead: leadVoice,
  leadOctave: 0,
  bike: { bell: 1, chain: (u) => (u < 3 ? 0.8 : 1.6) },
};
