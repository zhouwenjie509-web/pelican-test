// Section 11 (ukiyoe): a traveller's tune on the Tokaido road, on a shamisen.
//
// Bar 1: the shamisen alone, in the in scale, the open low D struck with the
// first note of every two-beat cell. Bar 2: on the downbeat a shower arrives
// (fine rain made of drops, rising over 0.4 s); at 2.5 the umbrella comes up
// with a soft swish; at 3.0 it snaps open (a pop of paper and bamboo) with the
// one clack of the clappers, the rain starts drumming on the oiled paper and
// the shamisen rolls the held Eb without missing a stroke. Bar 3 walks down
// through the rain; the shower passes (4.6 - 5.2), the umbrella folds with a
// rustle and a click (5.05 - 5.15), and the last note is dry. The bell takes the D.
//
// How the sounds are made (all computed in prepare(), nothing recorded):
//   shamisen  an extended Karplus-Strong string plucked near the bridge, then
//             the skin body: a nasal resonance near 2.4 kHz, no low end, and a
//             quick first decay (the bridge stands on the skin). A downstroke
//             adds the plectrum hitting the skin (a burst of noise and a short
//             membrane thump). Upstroke and left-hand pluck are softer and
//             duller, with no skin hit. The open low D3 buzzes on the neck
//             (sawari): wherever the string's swing passes the barrier it
//             gates a band of noise, a rough halo at the string's period.
//   rain      thousands of single drops (tiny decaying chirps 2 - 9 kHz) over
//             a faint hiss, their number following the picture's shower.
//   patter    single drops on oiled paper: a damped membrane 300 - 900 Hz and
//             a small tick, about twenty a second, irregular.
//   pop       the umbrella opening: a low thump falling in pitch, a crisp
//             paper snap and two bamboo clicks.
//   clack     the hyoshigi: two hardwood bars (free-bar modes 1 : 2.76 : 5.40)
//             struck together once.
//   swish, rustle and click: filtered noise shapes.

import { prepareReverb, sharedBuffer } from "../engine/kit.js";
import { SR, rng, white, pluck, biquad, onePole, envelope, fade, mixInto, normalize, samples } from "../engine/dsp.js";
import { hz, midi, SCALES } from "../engine/theory.js";

const ID = "ukiyoe";
const ROAD = { seconds: 0.6, t60: 0.45, bright: 0.6, predelay: 0.006, early: 0.3, seed: 113 };
const D3 = midi("D3");
/** The sawari halo's level against the open string's own 1.4 - 6.5 kHz band. */
const HALO = 1.0;

// ---------------------------------------------------------------- the shamisen

/** How each kind of stroke is played. */
const STROKE = {
  down: { bright: 0.9, pick: 0.085, soft: 0.05, noise: 0.12, t60: 1.1, skin: 0.4 }, // bachi down onto the skin
  up: { bright: 0.82, pick: 0.11, soft: 0.3, noise: 0.05, t60: 1.0, skin: 0 }, // sukui: the bachi's edge coming back up
  hajiki: { bright: 0.72, pick: 0.2, soft: 0.65, noise: 0.02, t60: 0.85, skin: 0 }, // a left-hand pluck
  dry: { bright: 0.82, pick: 0.11, soft: 0.3, noise: 0.05, t60: 1.0, skin: 0, damp: 0.2 }, // upstroke, damped at once
};

function shamisenSamples(m, kind, sawari = 1) {
  const p = STROKE[kind];
  const f = hz(m);
  const seconds = 1.1;
  const y = pluck({ f, seconds, t60: p.t60, bright: p.bright, pick: p.pick, soft: p.soft, noise: p.noise, seed: 300 + Math.round(m * 7) + kind.length, level: 0.9 });
  // the bridge stands on a skin: a quick first decay, then the ring
  const n = y.length;
  for (let i = 0; i < n; i += 1) y[i] *= 0.6 + 0.4 * Math.exp(-i / (0.05 * SR));
  // the body: no low end, a nasal resonance
  let z = biquad(y, "highpass", m <= D3 + 1 ? 95 : 150, 0.7);
  z = biquad(z, "peaking", 2400, 1.3, 7);
  z = biquad(z, "peaking", 1150, 1.6, 3);
  z = biquad(z, "lowpass", 7000, 0.7);
  let halo = null;
  if (m === D3) {
    // sawari: on the upper part of each swing the open string lies against the neck and buzzes.
    // A follower tracks the swing; above 40 % of it the contact gates a burst of noise, once a period.
    const r = rng(77 + kind.length);
    const buzz = new Float32Array(n);
    const fall = Math.exp(-1 / (0.02 * SR));
    const peakSwing = 1e-9 + peakOf(onePole(onePole(y, 300), 300));
    const swing = onePole(onePole(y, 300), 300); // the string's displacement near the nut: mostly its fundamental
    let env = 0;
    for (let i = 0; i < n; i += 1) {
      env = Math.max(Math.abs(swing[i]), env * fall);
      const over = env > 1e-9 ? swing[i] / env - 0.4 : 0;
      buzz[i] = over > 0 ? over * (env / peakSwing) ** 0.75 * (r() * 2 - 1) : 0; // decays more slowly than the string: sawari sustains
    }
    halo = biquad(biquad(buzz, "highpass", 1400, 0.7), "lowpass", 6500, 0.7);
    envelope(halo, [[0, 0], [0.008, 0], [0.03, 1], [seconds, 1]]); // the string must swing out before it touches
  }
  if (p.skin > 0) {
    // the plectrum hits the skin: a crack of noise and a short thump of the membrane
    const crack = biquad(white(samples(0.03), 900 + m), "bandpass", 3000, 0.7);
    envelope(crack, [[0, 0], [0.0006, 1], [0.004, 0.3], [0.012, 0.05], [0.03, 0]]);
    const thump = new Float32Array(samples(0.12));
    for (const [fm, a, t60] of [[205, 1, 0.06], [330, 0.6, 0.04], [455, 0.4, 0.03]]) {
      const w = (2 * Math.PI * fm) / SR;
      const d = Math.exp(-6.9078 / (t60 * SR));
      let g = a;
      for (let i = 0; i < thump.length; i += 1) {
        thump[i] += g * Math.sin(w * i);
        g *= d;
      }
    }
    fade(thump, 0.0006, 0.01);
    const pk = peakOf(z);
    mixInto(z, crack, 0, pk * p.skin * 1.2);
    mixInto(z, thump, 0, pk * p.skin * 0.35);
  }
  if (p.damp) envelope(z, [[0, 1], [p.damp * 0.5, 0.7], [p.damp, 0], [seconds, 0]]);
  // the skin gives under the hardest part of the stroke: round off the first peaks a little
  normalize(z, 1);
  for (let i = 0; i < n; i += 1) z[i] = Math.tanh(2.6 * z[i]) / Math.tanh(2.6);
  if (halo) {
    // the halo stands level with the string's own treble over the first 0.3 s
    const span = samples(0.3);
    const zb = biquad(biquad(z, "highpass", 1400, 0.7), "lowpass", 6500, 0.7);
    let ez = 0;
    let eh = 0;
    for (let i = 0; i < span; i += 1) {
      ez += zb[i] * zb[i];
      eh += halo[i] * halo[i];
    }
    const gh = HALO * sawari * Math.sqrt(ez / (eh || 1));
    // a noise gated at the string's period is spiky: its spikes are rounded off like the string's
    for (let i = 0; i < n; i += 1) z[i] += 0.3 * Math.tanh((gh * halo[i]) / 0.3);
  } // after the rounding, which would flatten it: it sits on the swing's peaks
  z = onePole(z, 40, "highpass"); // no DC from the rounding
  z = biquad(z, "lowpass", 7500, 0.6); // nor the treble it would add: the skin keeps little above 7 kHz
  return normalize(fade(z, 0.0006, 0.04), 0.9);
}

function peakOf(x) {
  let m = 0;
  for (let i = 0; i < x.length; i += 1) m = Math.max(m, Math.abs(x[i]));
  return m;
}

const shamisenKey = (m, kind) => `${ID}/shamisen/${m}/${kind}`;

/**
 * One stroke. ev: midi, dur (how long it is let ring before the next stroke
 * on that string stops it), vel, kind (down | up | hajiki | dry), ring (extra seconds).
 */
function shamisen(k, g, when, ev) {
  const kind = ev.kind || "down";
  const buf = k.buffer(shamisenKey(ev.midi, kind), () => shamisenSamples(ev.midi, kind));
  const len = Math.min(1.08, ev.len !== undefined ? ev.len : ev.dur + (ev.ring === undefined ? 0.03 : ev.ring));
  const { out } = k.play(buf, when, { dur: len, fade: ev.fade || 0.02, gain: LEVEL.shamisen * ev.vel, pan: ev.pan || -0.05 }, g.out);
  out.connect(g.send);
}

// ---------------------------------------------------------------- weather and umbrella

/** The shower's strength at u (section seconds): 0 .. 1. */
function shower(u) {
  if (u < 2.0) return 0;
  if (u < 2.18) {
    // as in the picture: the main rain is at 82 % by 2.18 (here an ease-out, so the downbeat is crisp)
    const x = (u - 2.0) / 0.18;
    return 0.82 * (1 - (1 - x) * (1 - x));
  }
  if (u < 3.0) return 0.82 + 0.18 * ((u - 2.18) / 0.82);
  if (u < 4.6) return 1;
  if (u < 5.2) return 0.5 + 0.5 * Math.cos((Math.PI * (u - 4.6)) / 0.6);
  return 0;
}

const RAIN_U = 2.0;
const RAIN_LEN = 3.3;
function rainSamples() {
  const n = samples(RAIN_LEN);
  const chans = [];
  for (let ch = 0; ch < 2; ch += 1) {
    const r = rng(1100 + ch * 17);
    const y = new Float32Array(n);
    const RATE = 1500; // drops per second at the heaviest, per ear
    let t = 0;
    while (t < RAIN_LEN) {
      t += (-Math.log(1 - r() * 0.999) / RATE);
      const d = shower(RAIN_U + t);
      if (r() > d) continue;
      const f = 2000 * 4.5 ** r();
      const tau = 0.0015 + 0.004 * r();
      const a = (0.12 + 0.88 * r() ** 3) * (0.6 + 0.4 * d);
      const chirp = 0.1 + 0.3 * r(); // a drop's bubble rises a little in pitch
      const at = Math.round(t * SR);
      const len = Math.min(n - at, Math.round(tau * 6 * SR));
      let ph = r() * 6.28;
      for (let i = 0; i < len; i += 1) {
        const s = i / SR;
        ph += (2 * Math.PI * f * (1 + chirp * Math.min(1, s / 0.01))) / SR;
        const e = Math.exp(-s / tau) * Math.min(1, s / 0.0003);
        y[at + i] += a * e * Math.sin(ph);
      }
    }
    // a faint hiss under the drops: so many that some are never heard alone
    const hiss = biquad(biquad(white(n, 1200 + ch), "bandpass", 5200, 0.6), "highpass", 2500, 0.7);
    for (let i = 0; i < n; i += 1) y[i] += 0.07 * shower(RAIN_U + i / SR) * hiss[i];
    let z = biquad(y, "highpass", 1600, 0.7);
    z = biquad(z, "lowpass", 10000, 0.7);
    chans.push(fade(z, 0.002, 0.05));
  }
  return normalize(chans, 0.9);
}

const PATTER_U = 3.02;
const PATTER_LEN = 2.05;
/** Rain on the umbrella: open 3.0 - 5.0, the shower thinning from 4.6. */
function patterSamples() {
  const n = samples(PATTER_LEN);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const r = rng(2203);
  let t = 0;
  while (t < PATTER_LEN - 0.12) {
    const u = PATTER_U + t;
    const open = u < 4.98 ? 1 : 0;
    if (open && r() < shower(u)) {
      const f0 = 300 + 520 * r();
      const a = 0.45 + 0.55 * r();
      const drop = new Float32Array(samples(0.11));
      for (const [ratio, amp, t60] of [[1, 1, 0.055], [1.59, 0.45, 0.035], [2.14, 0.25, 0.025]]) {
        const d = Math.exp(-6.9078 / ((t60 * (0.8 + 0.4 * r())) * SR));
        let g = amp;
        let ph = 0;
        for (let i = 0; i < drop.length; i += 1) {
          const s = i / SR;
          ph += (2 * Math.PI * f0 * ratio * (1 + 0.08 * Math.exp(-s / 0.008))) / SR;
          drop[i] += g * Math.sin(ph);
          g *= d;
        }
      }
      const tick = biquad(white(samples(0.006), 2300 + Math.round(t * 1000)), "bandpass", 1500 + 1000 * r(), 1);
      envelope(tick, [[0, 0], [0.0004, 1], [0.002, 0.2], [0.006, 0]]);
      mixInto(drop, tick, 0, 0.5);
      fade(drop, 0.0005, 0.01);
      const pan = (r() - 0.5) * 0.5;
      mixInto(L, drop, t, a * (1 - pan));
      mixInto(R, drop, t, a * (1 + pan));
    }
    t += (1 / 20) * (0.35 + 1.3 * r());
  }
  const out = [onePole(L, 120, "highpass"), onePole(R, 120, "highpass")];
  out.forEach((c) => fade(c, 0.001, 0.03));
  return normalize(out, 0.9);
}

/** Damped sine partials, summed into a fresh array. */
function partials(list, seconds) {
  const y = new Float32Array(samples(seconds));
  for (const [f, a, t60, drop = 0, tau = 0.02] of list) {
    const d = Math.exp(-6.9078 / (t60 * SR));
    let g = a;
    let ph = 0;
    for (let i = 0; i < y.length; i += 1) {
      ph += (2 * Math.PI * f * (1 + drop * Math.exp(-i / (tau * SR)))) / SR;
      y[i] += g * Math.sin(ph);
      g *= d;
    }
  }
  return y;
}

/** The umbrella snapping open: a low thump of the paper going taut, a crisp snap, the ribs clicking home. */
function popSamples() {
  const y = partials([[100, 1, 0.14, 0.5, 0.025], [172, 0.4, 0.07, 0.3, 0.02]], 0.35);
  const snap = biquad(white(samples(0.04), 3301), "highpass", 1800, 0.8);
  envelope(snap, [[0, 0], [0.0005, 1], [0.004, 0.35], [0.015, 0.06], [0.04, 0]]);
  mixInto(y, snap, 0, 0.9);
  const ribs = partials([[1850, 0.5, 0.03], [2930, 0.35, 0.02]], 0.06);
  mixInto(y, ribs, 0.004, 0.6);
  return normalize(fade(onePole(y, 45, "highpass"), 0.0005, 0.03), 0.9);
}

/** The hyoshigi: two hardwood bars struck together. A free bar's modes stand at 1 : 2.756 : 5.404. */
function clackSamples() {
  const y = new Float32Array(samples(0.45));
  for (const [f1, a] of [[1180, 1], [1265, 0.85]]) {
    mixInto(y, partials([[f1, a, 0.3], [f1 * 2.756, a * 0.5, 0.12], [f1 * 5.404, a * 0.2, 0.05]], 0.45), 0, 1);
  }
  const click = biquad(white(samples(0.01), 4401), "bandpass", 4500, 0.8);
  envelope(click, [[0, 0], [0.0003, 1], [0.002, 0.2], [0.01, 0]]);
  mixInto(y, click, 0, 1.2);
  return normalize(fade(y, 0.0004, 0.04), 0.9);
}

/** The umbrella coming up through the air: noise rising to 2.5 and gone. Starts at u = 2.3. */
const SWISH_U = 2.3;
function swishSamples() {
  const n = samples(0.34);
  const lo = biquad(white(n, 5501), "bandpass", 900, 1.2);
  const hi = biquad(white(n, 5502), "bandpass", 2300, 1.2);
  const y = new Float32Array(n);
  const peakAt = 2.5 - SWISH_U;
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    const e = t < peakAt ? (t / peakAt) ** 2.5 : Math.exp(-(t - peakAt) / 0.035);
    const x = Math.min(1, t / peakAt);
    y[i] = e * ((1 - x) * lo[i] + x * hi[i]);
  }
  return normalize(fade(y, 0.002, 0.02), 0.9);
}

/**
 * The umbrella folding: a paper rustle, then the click as it shuts at 5.15. The rustle begins at
 * 5.05, just after the Bb3 stroke's attack at 5.0, which would mask it.
 */
const FOLD_U = 5.05;
const FOLD_LEN = 0.25;
function foldSamples() {
  const y = new Float32Array(samples(FOLD_LEN));
  const r = rng(6601);
  for (let j = 0; j < 22; j += 1) {
    const at = 0.1 * r() ** 0.8;
    const c = biquad(white(samples(0.008), 6700 + j), "bandpass", 1500 + 2500 * r(), 1.5);
    envelope(c, [[0, 0], [0.0004, 1], [0.003, 0.25], [0.008, 0]]);
    mixInto(y, c, at, 0.3 + 0.5 * r());
  }
  const click = partials([[2150, 1, 0.035], [3600, 0.4, 0.02]], 0.08);
  const tick = biquad(white(samples(0.006), 6801), "bandpass", 3000, 1);
  envelope(tick, [[0, 0], [0.0003, 1], [0.002, 0.2], [0.006, 0]]);
  mixInto(click, tick, 0, 0.8);
  mixInto(y, click, 5.15 - FOLD_U, 1.6);
  return normalize(fade(y, 0.0005, 0.03), 0.9);
}

const SOUNDS = {
  rain: rainSamples,
  patter: patterSamples,
  pop: popSamples,
  clack: clackSamples,
  swish: swishSamples,
  fold: foldSamples,
};

/** Levels (linear, at vel 1). */
const LEVEL = { shamisen: 0.47, rain: 0.14, patter: 0.17, pop: 0.24, clack: 0.16, swish: 0.1, fold: 0.42 };
const PAN = { rain: 0, patter: 0.05, pop: 0.05, clack: 0.15, swish: 0.05, fold: 0.05 };

/** A computed sound. Long ones (rain, patter) may be started part-way through when the film is scrubbed. */
function sound(k, g, when, ev) {
  const buf = k.buffer(`${ID}/${ev.sound}`, SOUNDS[ev.sound]);
  const offset = ev.offset || 0;
  const level = LEVEL[ev.sound] * (ev.vel === undefined ? 1 : ev.vel);
  const { out, gain } = k.play(buf, when, { offset, gain: level, pan: PAN[ev.sound] }, g.out);
  if (offset > 0) k.env(gain.gain, when, [[0, 0], [0.01, level]]);
  if (ev.wet) out.connect(g.send);
}

// ---------------------------------------------------------------- the score

/** How each note of the tune is struck, and whether the open D3 is struck with it. */
const PLAY = [
  { kind: "down", low: true, vel: 0.8 }, // 0.00 D4 (with the open D3: both open strings)
  { kind: "down", vel: 0.8 }, //            0.50 Eb4
  { kind: "up", vel: 0.75 }, //             0.75 G4
  { kind: "down", low: true, vel: 0.92 }, // 1.00 A4
  { kind: "down", vel: 0.8 }, //            1.50 G4
  { kind: "hajiki", vel: 0.75 }, //         1.75 A4
  { kind: "down", low: true, vel: 1.0 }, // 2.00 Bb4: the top, as the shower arrives
  { kind: "down", vel: 0.82 }, //           2.50 A4
  { kind: "hajiki", vel: 0.75 }, //         2.75 G4
  { kind: "down", low: true, vel: 1.0 }, // 3.00 Eb4, rolled to 4.0
  { kind: "down", low: true, vel: 0.92 }, // 4.00 G4
  { kind: "down", vel: 0.8 }, //            4.50 Eb4
  { kind: "up", vel: 0.75 }, //             4.75 D4
  { kind: "down", low: true, vel: 0.9 }, // 5.00 Bb3
  { kind: "down", vel: 0.8 }, //            5.50 A3
  { kind: "dry", vel: 0.8 }, //             5.75 Bb3, damped: the last note is dry
];

/** The roll on the held Eb: strokes 1/12 s apart from 3.0, down and up alternately. */
const ROLL_STEP = 1 / 12;
const ROLL_N = 12;

const IN_NOTES = () => {
  const out = new Set();
  for (const m of [57, 58, 62, 63, 67, 69, 70]) out.add(m);
  return out;
};
/** Pitches the outro may ask of the lead voice: the major scale over the shamisen's compass. */
const LEAD_NOTES = () => {
  const out = [];
  for (let m = 45; m <= 86; m += 1) if (SCALES.major.includes((((m - 62) % 12) + 12) % 12)) out.push(m);
  return out;
};

/** For scratch checks in Node (dev/audio/ukiyoe-*.js). */
export const _ukiyoe = { shamisenSamples, SOUNDS };

export default {
  prepare() {
    prepareReverb(`${ID}/road`, ROAD);
    for (const m of IN_NOTES()) for (const kind of Object.keys(STROKE)) sharedBuffer(shamisenKey(m, kind), () => shamisenSamples(m, kind));
    sharedBuffer(shamisenKey(D3, "down"), () => shamisenSamples(D3, "down"));
    for (const m of LEAD_NOTES()) sharedBuffer(shamisenKey(m, "down"), () => shamisenSamples(m, "down"));
    for (const [name, make] of Object.entries(SOUNDS)) sharedBuffer(`${ID}/${name}`, make);
  },

  graph(k, out) {
    const room = k.reverb(`${ID}/road`, ROAD);
    const send = k.gain(0.12);
    send.connect(room).connect(out);
    return { send };
  },

  score(s) {
    const notes = s.theme({ scale: "in" });
    notes.forEach((n, i) => {
      const p = PLAY[i];
      if (n.u === 3.0) {
        // the roll: the first stroke is the lead note, the rest keep it sounding
        s.note(shamisen, n.u, n.dur, n.midi, p.vel, { kind: "down", lead: true, len: ROLL_STEP + 0.01, fade: 0.012, label: "shamisen" });
        for (let j = 1; j < ROLL_N; j += 1) {
          // softer after the accent, then a small swell towards bar 3
          const shape = 0.5 + 0.25 * ((j - 1) / (ROLL_N - 2)) ** 1.5;
          s.note(shamisen, n.u + j * ROLL_STEP, j === ROLL_N - 1 ? 1.0 - j * ROLL_STEP : ROLL_STEP, n.midi, shape * (j % 2 ? 0.85 : 1), {
            kind: j % 2 ? "up" : "down",
            ring: j === ROLL_N - 1 ? 0.02 : 0.01,
            fade: 0.012,
            label: "shamisen roll",
          });
        }
      } else {
        const last = i === notes.length - 1;
        s.note(shamisen, n.u, last ? 0.2 : n.dur, n.midi, p.vel, { kind: p.kind, lead: true, ring: last ? 0 : 0.03, label: "shamisen" });
      }
      if (p.low) {
        const final = n.u === 5.0;
        s.note(shamisen, n.u, final ? 0.85 : 1.0, D3, 0.55 * p.vel, { kind: "down", ring: final ? 0 : 0.02, fade: final ? 0.1 : 0.02, pan: -0.1, label: "shamisen open D3" });
      }
    });

    // the shower, the umbrella
    s.at(RAIN_U, sound, { sound: "rain", dur: RAIN_LEN, seekable: true, label: "rain" });
    s.at(SWISH_U, sound, { sound: "swish", dur: 0.34, label: "swish" });
    s.at(3.0, sound, { sound: "pop", dur: 0.35, wet: true, label: "umbrella pop" });
    s.at(3.0, sound, { sound: "clack", dur: 0.45, wet: true, label: "clappers" });
    s.at(PATTER_U, sound, { sound: "patter", dur: PATTER_LEN, seekable: true, label: "patter" });
    s.at(FOLD_U, sound, { sound: "fold", dur: FOLD_LEN, label: "fold" });

    s.cue(0, "the pelican rides the coast road: shamisen, open strings");
    s.cue(2.0, "the shower arrives: the rain begins", { soft: true, band: [4000, 9000] });
    s.cue(3.0, "the umbrella snaps open: pop and clappers");
  },

  /** The outro's note of this section: a downstroke of the shamisen. */
  lead(k, g, when, ev) {
    shamisen(k, g, when, { ...ev, kind: "down", vel: ev.vel === undefined ? 0.9 : ev.vel });
  },
  leadOctave: 0,
  bike: { chain: 1, bell: 1 },
};
