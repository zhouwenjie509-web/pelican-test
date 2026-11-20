// Section 10 (wayang): a small Javanese gamelan behind the shadow screen, in slendro.
//
// Bar 1: the gong on the downbeat; the saron plays the tune, the peking doubles
// it an octave up at twice the speed, the slenthem holds the skeleton an
// octave down, the bonang anticipates, the kendang leads. Bar 2: kempul on
// 2.0, then the orchestra hushes while the puppet is drawn back to the lamp:
// a gender shimmer and a soft kendang roll that grow and waver with the
// swelling shadow, and stop for the slap (2.93 - 3.0). On 3.0 the puppeteer's
// mallet knocks the chest, the bronze plates clash and the gong sounds with
// the saron's loud E; a quick bonang figure runs away like the ripple in the
// cloth; two small knocks for the bill. Bar 3: kenong on 4.0 and everyone
// walks the tune down. The bell takes the D. Throughout, the bronze plates
// tick lightly on every step of the puppet's wheels (the chain is silent).
//
// Every sound is a computed buffer (prepare()): bronze bars and kettles as sums
// of decaying partials at their own ratios, the drum and the wooden chest as
// modes plus filtered noise. Nothing is recorded.

import { prepareReverb, sharedBuffer } from "../engine/kit.js";
import { SR, samples, rng, white, biquad, onePole, envelope, fade, mixInto, normalize, modal } from "../engine/dsp.js";
import { hz, theme, SCALES } from "../engine/theory.js";

const ID = "wayang";
/** A pavilion open at the sides: short, warm. */
const ROOM = { seconds: 1.2, t60: 1.0, bright: 0.5, predelay: 0.01, early: 0.4, seed: 1010 };

/** The slendro pitch of scale step `step` in octave `oct` (0 = the D4 octave). */
const SL = (step, oct = 0) => 62 + SCALES.slendro[step] + 12 * oct;

// ---------------------------------------------------------------- bronze

/**
 * A bronze bar struck with a wooden mallet: partials near 1, 2.76 and 5.4
 * times the note (the upper ones die much faster), the fundamental doubled a
 * couple of hertz apart (two bending modes not quite equal), and the knock of
 * the mallet itself. soft: a padded mallet (slenthem, gender): slower onset, no knock.
 */
function barSamples(m, { seconds = 2.4, t60 = 2.2, hard = 1, soft = 0, beat = 1.2, seed = 1 } = {}) {
  const f = hz(m);
  const y = modal(
    [
      { f, a: 1, t60 },
      { f: f + beat, a: 0.22, t60: t60 * 0.9, phase: 1.1 },
      { f: f * 2.76, a: 0.3 * hard * (1 - 0.7 * soft), t60: t60 * 0.3, phase: 0.4 },
      { f: f * 5.4, a: 0.1 * hard * hard * (1 - 0.9 * soft), t60: t60 * 0.1, phase: 2.0 },
    ],
    seconds,
    { attack: 0.0006 + 0.005 * soft },
  );
  if (!soft) {
    const click = biquad(white(samples(0.012), 300 + seed), "bandpass", 2400 + 800 * hard, 1.0);
    envelope(click, [[0, 0], [0.0004, 1], [0.003, 0.2], [0.012, 0]]);
    mixInto(y, click, 0, 0.16 * hard);
  }
  return normalize(fade(y, 0.0006, 0.03), 0.9);
}

/**
 * A kettle gong (bonang, kenong), a hanging gong (kempul) or the great gong:
 * a strong fundamental with a clear octave above it, a few weaker inharmonic
 * modes, and the beating of a pair of near-equal fundamentals. A padded beater:
 * a soft few-millisecond onset and a dull thump.
 */
function gongSamples(m, { seconds, t60, beat, pair = 0.4, octave = 0.4, upper = [], thump = 0.2, attack = 0.003, seed = 1, phases = null }) {
  const f = hz(m);
  // phases (optional): [pair, octave, ...upper], spread so that the modes do not add their peaks at the stroke
  const ph = phases || [0.7, 0.3, ...upper.map((_, i) => 1.3 * i)];
  const parts = [
    { f, a: 1, t60 },
    { f: f + beat, a: pair, t60: t60 * 0.95, phase: ph[0] },
    { f: f * 2.004, a: octave, t60: t60 * 0.6, phase: ph[1] },
    ...upper.map(([r, a, t], i) => ({ f: f * r, a, t60: t60 * t, phase: ph[2 + i] })),
  ];
  const y = modal(parts, seconds, { attack });
  if (thump > 0) {
    const th = onePole(onePole(white(samples(0.08), 700 + seed), Math.min(900, f * 4)), Math.min(900, f * 4));
    envelope(th, [[0, 0], [0.002, 1], [0.02, 0.3], [0.08, 0]]);
    mixInto(y, th, 0, thump * 4);
  }
  return normalize(fade(onePole(y, 28, "highpass"), attack, 0.05), 0.9);
}

// ---------------------------------------------------------------- skins and wood

/** A struck skin: round-membrane modes with a little pitch fall, and the hand on it. */
function skinSamples({ f, drop = 0.1, tau = 0.03, t60 = 0.3, modes, hand = 0.3, handHz = 1500, handQ = 0.9, handDecay = 0.008, seconds = 0.5, seed = 1 }) {
  const n = samples(seconds);
  const y = new Float32Array(n);
  const ph = modes.map(() => 0);
  const dec = modes.map((md) => Math.exp(-6.9078 / ((md[2] || t60) * SR)));
  const amp = modes.map((md) => md[1]);
  for (let i = 0; i < n; i += 1) {
    const fNow = f * (1 + drop * Math.exp(-i / SR / tau));
    let v = 0;
    for (let j = 0; j < modes.length; j += 1) {
      ph[j] += (2 * Math.PI * fNow * modes[j][0]) / SR;
      v += amp[j] * Math.sin(ph[j]);
      amp[j] *= dec[j];
    }
    y[i] = v;
  }
  if (hand > 0) {
    const h = biquad(white(samples(0.05), seed), "bandpass", handHz, handQ);
    envelope(h, [[0, 0], [0.0004, 1], [handDecay, 0.25], [handDecay * 3, 0.04], [0.05, 0]]);
    mixInto(y, h, 0, hand * 3);
  }
  return normalize(fade(onePole(y, f * 0.4, "highpass"), 0.0006, 0.03), 0.9);
}

const KENDANG = {
  // the big head, open: a low round "dhung"
  dhung: (v) => skinSamples({ f: 84 + 3 * v, drop: 0.12, tau: 0.04, t60: 0.45, modes: [[1, 1, 0.45], [1.59, 0.35, 0.2], [2.14, 0.18, 0.12], [2.65, 0.08, 0.07]], hand: 0.18, handHz: 700, handDecay: 0.01, seconds: 0.6, seed: 11 + v }),
  // the small head, slapped: a dry high "tak"
  tak: (v) => skinSamples({ f: 390 + 12 * v, drop: 0.04, tau: 0.01, t60: 0.07, modes: [[1, 0.6, 0.07], [1.59, 0.5, 0.05], [2.14, 0.4, 0.04], [2.3, 0.35, 0.035], [2.65, 0.3, 0.03]], hand: 0.9, handHz: 2300, handDecay: 0.01, seconds: 0.2, seed: 21 + v }),
  // the small head, a light closed tap
  ket: (v) => skinSamples({ f: 330 + 10 * v, drop: 0.02, tau: 0.01, t60: 0.04, modes: [[1, 0.8, 0.04], [1.59, 0.4, 0.03], [2.14, 0.2, 0.02]], hand: 0.5, handHz: 1400, handDecay: 0.006, seconds: 0.12, seed: 31 + v }),
  // fingers on the small head, for the roll: soft, a little ring
  finger: (v) => skinSamples({ f: 410 + 15 * v, drop: 0.03, tau: 0.01, t60: 0.09, modes: [[1, 1, 0.09], [1.59, 0.45, 0.05], [2.14, 0.25, 0.035]], hand: 0.25, handHz: 1200, handQ: 0.7, handDecay: 0.005, seconds: 0.16, seed: 41 + v }),
};

/**
 * The puppeteer's mallet on the wooden chest: the air in the box (a low hollow
 * mode), the wooden lid's stiff modes that are gone at once, and the hard contact.
 */
function knockSamples(big, seed) {
  const n = samples(0.4);
  const y = new Float32Array(n);
  const modes = big
    ? [[118, 1, 0.22], [236, 0.25, 0.12], [410, 0.5, 0.07], [730, 0.4, 0.045], [1170, 0.25, 0.03], [1880, 0.15, 0.02]]
    : [[150, 0.5, 0.1], [450, 0.6, 0.05], [790, 0.45, 0.035], [1260, 0.3, 0.022], [2050, 0.15, 0.015]];
  for (const [f, a, t60] of modes) mixInto(y, modal([{ f, a, t60 }], 0.4), 0, 1);
  const hit = biquad(white(samples(0.02), 500 + seed), "bandpass", big ? 2600 : 3300, 0.8);
  envelope(hit, [[0, 0], [0.0003, 1], [0.002, 0.25], [0.008, 0.05], [0.02, 0]]);
  mixInto(y, hit, 0, big ? 0.9 : 0.7);
  return normalize(fade(onePole(y, 50, "highpass"), 0.0005, 0.03), 0.9);
}

/**
 * The bronze plates hanging on the chest, struck by the puppeteer's foot:
 * three thin plates, each with many crowded inharmonic modes, hit a few
 * milliseconds apart, and the short buzz of the plates touching each other.
 * light: one plate barely touched (the wheel ticks).
 */
function platesSamples(light, seed) {
  const r = rng(seed);
  const len = light ? 0.12 : 0.9;
  const y = new Float32Array(samples(len));
  const RATIOS = [1, 1.62, 2.21, 2.87, 3.49, 4.13, 4.92, 5.71, 6.6, 7.43];
  const plates = light ? [1270 + 60 * (seed % 3)] : [980, 1190, 1440];
  plates.forEach((f0, p) => {
    const at = light ? 0 : p === 0 ? 0 : 0.002 + 0.006 * r();
    const parts = RATIOS.map((q, i) => ({
      f: f0 * q * (1 + 0.01 * (r() - 0.5)),
      a: (0.4 + 0.6 * r()) / (1 + 0.25 * i),
      t60: light ? 0.05 + 0.03 * r() : (0.55 + 0.3 * r()) / (1 + 0.18 * i),
      phase: 6.28 * r(),
    })).filter((q) => (light ? q.f > 2000 && q.f < 9500 : q.f < 11000));
    mixInto(y, modal(parts, len - at), at, 1);
  });
  // contact: a hard tick, and (for the clash) a short rattle of the plates against each other
  const tick = biquad(white(samples(0.01), seed + 7), "highpass", 2500, 0.7);
  envelope(tick, [[0, 0], [0.0003, 1], [0.002, 0.2], [0.01, 0]]);
  mixInto(y, tick, 0, light ? 0.3 : 0.6);
  if (!light) {
    for (let j = 0; j < 4; j += 1) {
      const b = biquad(white(samples(0.012), seed + 20 + j), "bandpass", 4200 + 600 * j, 1.5);
      envelope(b, [[0, 0], [0.0005, 1], [0.004, 0.2], [0.012, 0]]);
      mixInto(y, b, 0.018 + 0.017 * j + 0.004 * r(), 0.35 * 0.7 ** j);
    }
  }
  return normalize(fade(y, 0.0004, light ? 0.02 : 0.08), 0.9);
}

// ---------------------------------------------------------------- the instruments

const INST = {
  saron: { make: (m) => barSamples(m, { seconds: 2.4, t60: 2.2, hard: 1, seed: 1 }), gain: 0.42, pan: -0.12 },
  peking: { make: (m) => barSamples(m, { seconds: 1.6, t60: 1.4, hard: 0.8, beat: 1.8, seed: 2 }), gain: 0.2, pan: 0.22 },
  slenthem: { make: (m) => barSamples(m, { seconds: 3.0, t60: 3.0, hard: 0.5, soft: 1, beat: 0.9, seed: 3 }), gain: 0.26, pan: -0.25 },
  gender: { make: (m) => barSamples(m, { seconds: 1.4, t60: 1.6, hard: 0.35, soft: 1, beat: 2.2, seed: 4 }), gain: 0.058, pan: 0.3 },
  bonang: { make: (m) => gongSamples(m, { seconds: 1.4, t60: 1.2, beat: 0.9, pair: 0.2, octave: 0.35, upper: [[3.1, 0.06, 0.3], [4.3, 0.03, 0.2]], thump: 0.03, attack: 0.0015, seed: 5 }), gain: 0.19, pan: 0.3 },
  kenong: { make: (m) => gongSamples(m, { seconds: 2.8, t60: 2.4, beat: 0.7, pair: 0.3, octave: 0.45, upper: [[3.05, 0.05, 0.3]], thump: 0.05, attack: 0.002, seed: 6 }), gain: 0.2, pan: 0.15 },
  kempul: { make: (m) => gongSamples(m, { seconds: 3.0, t60: 2.2, beat: 1.1, pair: 0.45, octave: 0.5, upper: [[2.93, 0.15, 0.4], [4.1, 0.06, 0.25]], thump: 0.2, attack: 0.004, seed: 7 }), gain: 0.2, pan: -0.1 },
  gong: { make: (m) => gongSamples(m, { seconds: 4.6, t60: 3.0, beat: 1.6, pair: 0.6, octave: 0.45, upper: [[2.3, 0.32, 0.65], [2.92, 0.34, 0.6], [3.7, 0.32, 0.55], [4.8, 0.32, 0.5]], thump: 0.06, attack: 0.006, seed: 8, phases: [2.6, 5.0, 2.1, 4.4, 0.9, 3.3] }), gain: 0.25, pan: 0 },
};

const key = (name, m) => `${ID}/${name}/${m.toFixed(3)}`;

/** A struck bronze instrument. ev.ring: seconds it sounds before it is damped (default: to the next note). */
function bronze(k, g, when, ev) {
  const spec = INST[ev.inst];
  const buf = k.buffer(key(ev.inst, ev.midi), () => spec.make(ev.midi));
  const ring = Math.min(buf.duration, ev.ring || ev.dur + 0.06);
  const { out } = k.play(buf, when, { dur: ring, fade: Math.min(ring * 0.5, ev.damp || 0.06), gain: spec.gain * ev.vel, pan: ev.pan === undefined ? spec.pan : ev.pan }, g.out);
  out.connect(g.send);
}

/** The lead (the outro's note): one saron stroke, damped at the note's end. */
function saron(k, g, when, ev) {
  bronze(k, g, when, { ...ev, dur: ev.dur || 0.5, vel: ev.vel === undefined ? 0.8 : ev.vel, inst: "saron" });
}

const DRUM = { dhung: 0.2, tak: 0.13, ket: 0.08, finger: 0.17 };
function kendang(k, g, when, ev) {
  const buf = k.buffer(`${ID}/kendang/${ev.stroke}/${ev.variant}`, () => KENDANG[ev.stroke](ev.variant));
  const { out } = k.play(buf, when, { gain: DRUM[ev.stroke] * ev.vel, pan: ev.pan || 0.05 }, g.out);
  out.connect(g.send);
}

function knock(k, g, when, ev) {
  const buf = k.buffer(`${ID}/knock/${ev.big ? 1 : 0}`, () => knockSamples(ev.big, ev.big ? 1 : 2));
  const { out } = k.play(buf, when, { gain: (ev.big ? 0.23 : 0.3) * ev.vel, pan: -0.05 }, g.out);
  out.connect(g.send);
}

function plates(k, g, when, ev) {
  const buf = k.buffer(`${ID}/plates/${ev.light ? `tick${ev.variant}` : "clash"}`, () => platesSamples(ev.light, ev.light ? 60 + ev.variant : 90));
  const { out } = k.play(buf, when, { gain: (ev.light ? 0.035 : 0.17) * ev.vel, pan: ev.light ? -0.3 : -0.2 }, g.out);
  out.connect(g.send);
}

// ---------------------------------------------------------------- the score

/** Every bronze pitch the part (and the outro's lead) can ask for. */
function bronzePitches() {
  const want = [];
  for (const n of theme({ scale: "slendro" })) {
    want.push(["saron", n.midi], ["peking", n.midi + 12], ["slenthem", n.midi - 12]);
  }
  for (let st = 0; st < 5; st += 1) for (const o of [0, 1, 2]) want.push(["bonang", SL(st, o)], ["gender", SL(st, o)]);
  want.push(["gong", GONG], ["kempul", KEMPUL], ["kenong", KENONG]);
  // the outro asks the saron for the major scale, around D4
  for (const o of [-1, 0, 1]) for (const st of SCALES.major) want.push(["saron", 62 + st + 12 * o]);
  return want;
}

// Players are never exactly together: the peking and the slenthem sit a few milliseconds behind the saron.
const PEKING_LATE = 0.007;
const SLENTHEM_LATE = 0.012;

const GONG = SL(0, -2); // D2, slendro
const KEMPUL = SL(4, -2); // the B two octaves down
const KENONG = SL(2, 0); // the F# of the tune at 4.0
const LIFT = 1.12; // bars 1 and 3: +1 dB

export default {
  prepare() {
    prepareReverb(`${ID}/room`, ROOM);
    for (const [name, m] of bronzePitches()) sharedBuffer(key(name, m), () => INST[name].make(m));
    for (const stroke of Object.keys(KENDANG)) for (let v = 0; v < 2; v += 1) sharedBuffer(`${ID}/kendang/${stroke}/${v}`, () => KENDANG[stroke](v));
    sharedBuffer(`${ID}/knock/1`, () => knockSamples(true, 1));
    sharedBuffer(`${ID}/knock/0`, () => knockSamples(false, 2));
    sharedBuffer(`${ID}/plates/clash`, () => platesSamples(false, 90));
    for (let v = 0; v < 3; v += 1) sharedBuffer(`${ID}/plates/tick${v}`, () => platesSamples(true, 60 + v));
  },

  graph(k, out) {
    const room = k.reverb(`${ID}/room`, ROOM);
    const send = k.gain(0.16);
    send.connect(room).connect(out);
    return { send };
  },

  score(s) {
    const tune = s.theme({ scale: "slendro" });
    const hushed = (u) => u >= 2.0 && u < 3.0;
    // bars 1 and 3 a decibel up (after the review): bar 2, the hush and the slap, stay as they are
    const lift = (u) => (u < 2.0 || u >= 4.0 ? LIFT : 1);
    const b = (inst, u, dur, m, vel, more = {}) => s.note(bronze, u, dur, m, vel * lift(u), { inst, label: inst, ...more });

    // ---- saron: the tune. Each note is damped as the next is struck.
    tune.forEach((n, i) => {
      const held = n.u === 3.0;
      const last = i === tune.length - 1;
      const vel = held ? 0.85 : hushed(n.u) ? 0.4 : n.u === 0 ? 0.56 : n.skeleton ? 0.7 : 0.62;
      b("saron", n.u, n.dur, n.midi, vel, { lead: true, ring: last ? 0.6 : n.dur + 0.05, damp: last ? 0.2 : 0.05, label: "saron (tune)" });
    });

    // ---- peking: an octave up, each note twice at twice the speed; silent in the hush.
    // The held E is struck once, loud, so that the two small knocks of the bill stand alone.
    for (const n of tune) {
      if (hushed(n.u)) continue;
      const strokes = n.u === 3.0 ? [0] : [0, n.dur / 2];
      for (const off of strokes) {
        const len = n.u === 3.0 ? 0.5 : n.dur / 2;
        b("peking", n.u + off + PEKING_LATE, len, n.midi + 12, (n.u === 3.0 ? 1 : off ? 0.62 : 0.8) * (n.u >= 5.5 ? 0.8 : 1), { ring: len + 0.03, damp: 0.04 });
      }
    }

    // ---- slenthem: the skeleton an octave down, soft, ringing to the next. Very soft in the hush;
    // the B2 on 5.0 sits 3 ms later still, so that it does not add its peak to the saron's and the dhung's.
    for (const n of tune.filter((x) => x.skeleton)) {
      b("slenthem", n.u + SLENTHEM_LATE + (n.u === 5.0 ? 0.003 : 0), n.dur * 2, n.midi - 12, n.u === 2.0 ? 0.15 : n.u === 3.0 ? 0.9 : 0.75, { ring: n.u === 5.0 ? 1.3 : 1.03, damp: n.u === 5.0 ? 0.4 : 0.08 });
    }

    // ---- punctuation: gong on 0 and 3.0, kempul on 2.0, kenong on 4.0
    s.note(bronze, 0, 3, GONG, 0.8 * LIFT, { inst: "gong", ring: 4.6, damp: 0.3, label: "gong" });
    s.note(bronze, 2.0, 2, KEMPUL, 0.5, { inst: "kempul", ring: 3.0, damp: 0.3, label: "kempul" });
    s.note(bronze, 3.0, 3, GONG, 0.72, { inst: "gong", ring: 4.6, damp: 0.3, label: "gong" });
    s.note(bronze, 4.0, 2, KENONG, 0.85 * LIFT, { inst: "kenong", ring: 2.6, damp: 0.4, label: "kenong" });

    // ---- bonang: light anticipations, an octave up: the next skeleton note on the
    // sixteenths before it arrives (bars 1 and 3; in bar 3 it reaches for the bell's D)
    const ANTICIPATE = [[1.0, SL(3, 1)], [2.0, SL(4, 1)], [5.0, SL(4, 0)], [6.0, SL(0, 1)]];
    for (const [t, m] of ANTICIPATE) {
      const end = t === 6.0;
      b("bonang", t - 0.375, 0.25, m, end ? 0.55 : 0.7, { ring: 0.3, damp: 0.08, label: "bonang (anticipation)" });
      b("bonang", t - 0.125, 0.25, m, end ? 0.35 : 0.8, { ring: end ? 0.09 : 0.3, damp: end ? 0.03 : 0.08, label: "bonang (anticipation)" });
    }

    // ---- bonang after the slap: a quick figure running out from the E like the ripple in the
    // cloth, wider and quieter at each stroke, leaving room for the two knocks at 3.5 and 3.75
    const RIPPLE = [3.0625, 3.125, 3.1875, 3.25, 3.3125, 3.375, 3.4375, 3.5625, 3.625, 3.6875, 3.8125, 3.875];
    const OUT = [SL(2, 1), SL(0, 1), SL(3, 1), SL(4, 0), SL(4, 1), SL(3, 0), SL(0, 2), SL(2, 0), SL(1, 2), SL(1, 0), SL(2, 2), SL(0, 0)];
    RIPPLE.forEach((u, i) => b("bonang", u, 0.0625, OUT[i], 0.85 * 0.82 ** i, { ring: 0.45, damp: 0.15, pan: (i % 2 ? 1 : -1) * Math.min(0.7, 0.15 + 0.05 * i), label: "bonang (ripple)" }));

    // ---- gender: the shimmer of the swell, 2.0 - 2.93, rising and wavering with the shadow,
    // damped before the slap
    const GENDER = [SL(3, 1), SL(1, 1), SL(0, 1), SL(1, 1), SL(2, 1), SL(1, 1)];
    for (let j = 0; j < 13; j += 1) {
      const u = 2.0625 + j * 0.0625;
      const grow = 0.05 + 0.95 * ((u - 2.0) / 0.8);
      const waver = u > 2.5 ? 1 + 0.3 * Math.sin(2 * Math.PI * 2.1 * (u - 2.5)) : 1;
      const ring = Math.min(0.3, 2.93 - u);
      b("gender", u, 0.0625, GENDER[j % GENDER.length], Math.min(1, grow * waver), { ring, damp: Math.min(0.08, ring * 0.5), label: "gender (shimmer)" });
    }

    // ---- kendang: it leads. Bars 1 and 3: dhung on the cell, tak and ket between.
    const k = (u, stroke, vel, variant = 0) => s.at(u, kendang, { stroke, vel: vel * lift(u), variant, dur: stroke === "dhung" ? 0.5 : 0.15, label: `kendang ${stroke}` });
    const CELL = [[0, "dhung", 1], [0.5, "tak", 0.9], [0.75, "ket", 0.8], [1.0, "dhung", 0.85], [1.25, "ket", 0.6], [1.5, "tak", 0.9], [1.75, "tak", 0.7]];
    for (const [u, st, v] of CELL) k(u, st, u === 0 ? 0.6 : v, Math.round(u * 4) % 2);
    for (const [u, st, v] of CELL) k(4 + u, st, v * (u === 1.75 ? 0.8 : 1), Math.round(u * 4) % 2);
    // the roll: fingers on the small head, faster and louder as the shadow swells, wavering with it
    let u = 2.08;
    let gap = 0.075;
    while (u < 2.89) {
      const grow = 0.1 + 0.9 * ((u - 2.08) / 0.8);
      const waver = u > 2.5 ? 1 + 0.35 * Math.sin(2 * Math.PI * 2.1 * (u - 2.5) + 0.6) : 1;
      s.at(u, kendang, { stroke: "finger", vel: Math.min(1, grow * waver), variant: Math.round(u * 100) % 2, pan: Math.round(u * 100) % 2 ? 0.12 : -0.02, dur: 0.12, label: "kendang roll" });
      u = Math.round((u + gap) * 10000) / 10000;
      gap = Math.max(0.036, gap * 0.93);
    }
    // the slap: a big open stroke under the mallet, and the lead-in to bar 3
    k(3.012, "dhung", 0.7, 1); // the drummer answers the mallet, a hair behind it
    k(3.875, "tak", 0.7, 1);

    // ---- the puppeteer: the mallet on the chest and the bronze plates, on 3.0; two small knocks for the bill
    s.at(3.0, knock, { big: true, vel: 1, dur: 0.4, label: "mallet knock" });
    s.at(3.005, plates, { light: false, vel: 1, dur: 0.9, label: "bronze plates" });
    s.at(3.5, knock, { big: false, vel: 1, dur: 0.4, label: "mallet knock (bill)" });
    s.at(3.75, knock, { big: false, vel: 0.9, dur: 0.4, label: "mallet knock (bill)" });

    // ---- the wheel steps: a very light touch of the plates on every quarter second
    for (let j = 0; j < 24; j += 1) {
      const t = j * 0.25;
      if (t === 3.0 || t === 3.5 || t === 3.75) continue;
      s.at(t, plates, { light: true, variant: j % 3, vel: (j % 2 ? 0.7 : 1) * (hushed(t) ? 0.6 : 1) * lift(t), dur: 0.12, label: "plates tick (wheel step)" });
    }

    s.cue(0, "the shadow rides onto the screen: gong");
    s.cue(3.0, "the slap: mallet knock, plates, gong");
    s.cue(3.5, "the bill claps: small knock", { band: [2500, 6000] });
    s.cue(3.75, "the bill claps again: small knock", { band: [2500, 6000] });
  },

  lead: saron,
  leadOctave: 0,
  bike: { chain: 0, bell: 1 },
};
