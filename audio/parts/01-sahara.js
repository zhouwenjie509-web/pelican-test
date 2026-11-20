// Section 1 (sahara): the first people to draw the pelican sing it.
//
// A caller sings the tune's first bar, the group answers, hands and skins keep
// time. From the last beat of bar 2 the cattle notice the bicycle one after
// another (a dry tap for each animal, on the picture's own times: since the
// polish of Stage 5 each animal looks up when it is plainly in view, a second
// later than before, so the last two taps fall in bar 3) and the singers stop
// to watch, holding the E on a hum while only the low drum walks on. Bar 3:
// everyone, in octaves, with all the drums, growing to the frame. The bell
// takes the D.
//
// Everything here is synthesized: voices from an oscillator and moving
// formant filters, skins, hands and the tap from computed buffers (prepare()).

import { prepareReverb, hasBuffer, putBuffer } from "../engine/kit.js";
import { SR, rng, white, biquad, onePole, envelope, fade, mixInto, normalize, samples } from "../engine/dsp.js";
import { hz, midi } from "../engine/theory.js";

// ---------------------------------------------------------------- voices
//
// A voice is a buzzing source (the glottis: a pulse wave whose harmonics fall
// off steadily) shaped by the vocal tract: three resonances (formants) that
// sit at different places for each vowel and glide when the vowel changes.
// Here the source is an oscillator with a fixed harmonic recipe, the tract a
// row of three peaking filters and a lowpass, all moved by automation.

/** Formants of a man's voice (Hz), their boost (dB) and where the tract closes above them. "m" is a closed hum. */
const VOWELS = {
  o: { f: [570, 840, 2410], g: [14, 10, 7], lp: 3400 },
  a: { f: [730, 1090, 2440], g: [14, 11, 8], lp: 4000 },
  e: { f: [530, 1840, 2480], g: [13, 11, 9], lp: 4200 },
  m: { f: [260, 1050, 2300], g: [12, -12, 2], lp: 900 },
};
/** Bandwidths of the three formants (Hz). */
const BW = [90, 110, 160];

/**
 * The singers. throat scales the formants (a shorter tract sits higher); cents is each one's
 * own tuning; late is how far behind the caller each one comes in (seconds); vib the vibrato rate.
 */
const CALLER = { name: "caller", pan: 0, cents: 0, late: 0, vib: 5.6, depth: 16, throat: 1.0, gain: 1.0 };
const MEN = [
  { name: "man 1", pan: -0.35, cents: -3, late: 0.013, vib: 5.2, depth: 14, throat: 0.95, gain: 0.8 },
  { name: "man 2", pan: 0.32, cents: 3, late: 0.022, vib: 5.9, depth: 18, throat: 1.05, gain: 0.75 },
  { name: "man 3", pan: -0.12, cents: -1, late: 0.007, vib: 5.4, depth: 12, throat: 0.9, gain: 0.8 },
];
/** The higher voice: a child, doubling at the written octave in the answers. */
const CHILD = { name: "child", pan: 0.2, cents: 3, late: 0.009, vib: 6.1, depth: 14, throat: 1.3, gain: 0.55 };

/**
 * The source: harmonic k at 1/k^1.5 (a soft glottal pulse with the lip radiation). Upside down (every harmonic half a
 * cycle on) for a note that takes over from one whose fundamental is then in its other half-cycle: the two
 * fundamentals meet in phase in the cross-fade instead of cancelling.
 */
function glottal(k, invert = false) {
  const sines = [0];
  for (let i = 1; i <= 40; i += 1) sines.push((invert ? -1 : 1) / i ** 1.5);
  return k.wave(invert ? "sahara/glottal-inv" : "sahara/glottal", sines);
}

/** Breath: white noise through the same tract, about 30 dB under the voice (measured; see As built). */
const BREATH = 0.09;
/** The slow wander of every singer in the section: cents and decibels either side, a new point every WOB_STEP s. */
const WOB_CENTS = 3;
const WOB_DB = 0.25;
const WOB_STEP = 0.18;
/**
 * The hand-over between two notes of one singer: the new note rises on a quarter sine over XF_IN seconds; the old
 * note stays full for XF_LAG after the new one begins, then falls on a quarter cosine over XF_OUT (gone 24 ms in).
 * Each curve is drawn in XF_STEPS straight lines.
 */
const XF_IN = 0.02;
const XF_LAG = 0.004;
const XF_OUT = 0.02;
const XF_STEPS = 6;

/**
 * One sung note. ev: midi, dur, vel, singer, vowel, prev (the vowel before, for the glide),
 * from (the previous pitch, for a small scoop), drift (cents the pitch wanders over the note),
 * swell (level at the end of the note relative to its start), soft (attack seconds),
 * legato (seconds after the start at which the same singer's next note begins: fade out there in an
 * equal-power cross-fade), tied (the same singer's last note hands over to this one: fade in on the same curve),
 * invert (start the source upside down, so that it meets the last note's fundamental in phase),
 * releaseAt (seconds after the start at which the release begins, for the last chord),
 * wob (a seed: breath and a slow wander of pitch and level; the outro's lead leaves it out).
 */
function voice(k, g, when, ev) {
  const who = ev.singer || CALLER;
  const v = VOWELS[ev.vowel || "a"];
  const p = VOWELS[ev.prev || ev.vowel || "a"];
  const dur = ev.dur;
  // a hand-over between two notes of one singer is an equal-power cross-fade that begins where the next note
  // begins: the old note falls on a quarter cosine, a few ms after the new one begins to rise on a quarter sine
  const tie = ev.legato !== undefined;
  const attack = ev.tied ? XF_IN : ev.soft || 0.03;
  const release = tie ? XF_OUT : ev.releaseAt !== undefined ? 0.06 : 0.07;
  const hold = tie ? ev.legato + XF_LAG : ev.releaseAt !== undefined ? ev.releaseAt : dur + 0.015;
  const end = when + hold + release;

  const src = k.osc(glottal(k, !!ev.invert), hz(ev.midi), when, end + 0.01);
  // tuning: a scoop from part of the way back towards the last note, then the singer's own pitch drifting a little
  const own = who.cents;
  const scoop = scoopOf(ev, who);
  const drift = ev.drift || 0;
  k.env(src.detune, when, [[0, own + scoop], [0.035, own], [Math.max(0.04, dur), own + drift]]);
  // vibrato, arriving only on held notes
  const lfo = k.osc("sine", who.vib, when, end + 0.01);
  const depth = k.gain(0);
  lfo.connect(depth).connect(src.detune);
  if (dur > 0.3) k.env(depth.gain, when, [[0, 0], [0.16, 0], [Math.min(dur, 0.45), who.depth]]);

  // the tract
  const glide = 0.06;
  const fs = [0, 1, 2].map((i) => {
    const f = k.filter("peaking", p.f[i] * who.throat, (p.f[i] * who.throat) / BW[i], p.g[i]);
    k.env(f.frequency, when, [[0, p.f[i] * who.throat], [glide, v.f[i] * who.throat]]);
    k.env(f.gain, when, [[0, p.g[i]], [glide, v.g[i]]]);
    k.env(f.Q, when, [[0, (p.f[i] * who.throat) / BW[i]], [glide, (v.f[i] * who.throat) / BW[i]]]);
    return f;
  });
  const lp = k.filter("lowpass", p.lp * who.throat, -3);
  k.env(lp.frequency, when, [[0, p.lp * who.throat], [glide, v.lp * who.throat]]);
  const hp = k.filter("highpass", 70, -3);

  const amp = k.gain(0);
  const level = 0.11 * who.gain * ev.vel;
  const swell = ev.swell === undefined ? 1 : ev.swell;
  // the swell's line from the attack to dur + 0.015, read where the release begins
  const held = level * (1 + (swell - 1) * Math.min(1, Math.max(0, (hold - attack) / (dur + 0.015 - attack))));
  const ampPts = [[0, 0]];
  if (ev.tied) for (let j = 1; j <= XF_STEPS; j += 1) ampPts.push([(attack * j) / XF_STEPS, level * Math.sin((Math.PI / 2) * (j / XF_STEPS))]);
  else ampPts.push([attack, level]);
  ampPts.push([hold, held]);
  if (tie) for (let j = 1; j <= XF_STEPS; j += 1) ampPts.push([hold + (release * j) / XF_STEPS, j === XF_STEPS ? 0 : held * Math.cos((Math.PI / 2) * (j / XF_STEPS))]);
  else ampPts.push([hold + release, 0]);
  k.env(amp.gain, when, ampPts);
  const pan = k.pan(who.pan);
  if (ev.wob === undefined) {
    k.chain(src, fs[0], fs[1], fs[2], lp, hp, amp, pan, g.out);
  } else {
    // a living voice: the pitch and level wander slowly (deterministic, from the note's seed), and breath
    // goes through the same formants
    const w = rng(ev.wob);
    const f0 = hz(ev.midi);
    const fPts = [];
    const gPts = [];
    for (let t = 0; t < hold + release + WOB_STEP; t += WOB_STEP) {
      fPts.push([t, f0 * 2 ** (((w() * 2 - 1) * WOB_CENTS) / 1200)]);
      gPts.push([t, 10 ** (((w() * 2 - 1) * WOB_DB) / 20)]);
    }
    k.env(src.frequency, when, fPts);
    const wob = k.gain(1);
    k.env(wob.gain, when, gPts);
    const breath = k.noise("white", when, end + 0.01, { seed: ev.wob });
    const bhp = k.filter("highpass", 900, -3);
    const bg = k.gain(BREATH);
    k.chain(breath, bhp, bg, fs[0]);
    k.chain(src, fs[0], fs[1], fs[2], lp, hp, amp, wob, pan, g.out);
  }
  if (g.send) pan.connect(g.send);
}

/** The scoop a note begins with (cents): part of the way back towards the last note. */
function scoopOf(ev, who) {
  return ev.from !== undefined ? Math.max(-60, Math.min(60, (ev.from - ev.midi) * 100 * (who === CALLER ? 0.3 : 0.15))) : -20;
}

/** A straight-line envelope, as Web Audio draws it, read at t: points [t, value], held after the last one. */
function lineAt(pts, t) {
  if (t <= pts[0][0]) return pts[0][1];
  for (let j = 1; j < pts.length; j += 1) {
    if (t <= pts[j][0]) return pts[j - 1][1] + ((pts[j][1] - pts[j - 1][1]) * (t - pts[j - 1][0])) / (pts[j][0] - pts[j - 1][0]);
  }
  return pts[pts.length - 1][1];
}

/**
 * How many cycles of its fundamental a sung note (as voice() plays it, with ev.wob set) has made T seconds after it
 * began: its scoop, drift, vibrato and wander, added up in steps of 0.25 ms. Plain arithmetic, for the score, which
 * uses it to start the same singer's next note in phase (see glottal()). The formant filters and the 70 Hz highpass
 * shift the two notes' fundamentals alike at the hand-over, so they are left out.
 */
function cyclesAt(ev, T) {
  const who = ev.singer;
  const own = who.cents;
  const detune = [[0, own + scoopOf(ev, who)], [0.035, own], [Math.max(0.04, ev.dur), own + (ev.drift || 0)]];
  const depth = ev.dur > 0.3 ? [[0, 0], [0.16, 0], [Math.min(ev.dur, 0.45), who.depth]] : [[0, 0]];
  // the same draws, in the same order, as voice()'s wander
  const w = rng(ev.wob);
  const f0 = hz(ev.midi);
  const fPts = [];
  for (let t = 0; t < T + WOB_STEP; t += WOB_STEP) {
    fPts.push([t, f0 * 2 ** (((w() * 2 - 1) * WOB_CENTS) / 1200)]);
    w();
  }
  const dt = 0.00025;
  let c = 0;
  for (let t = dt / 2; t < T; t += dt) {
    const cents = lineAt(detune, t) + lineAt(depth, t) * Math.sin(2 * Math.PI * who.vib * t);
    c += lineAt(fPts, t) * 2 ** (cents / 1200) * Math.min(dt, T - t + dt / 2);
  }
  return c;
}

// ---------------------------------------------------------------- skins, hands, the tap

/**
 * A struck membrane: the modes of a round skin (1, 1.59, 2.14, 2.30, 2.65 times the
 * fundamental) whose pitch drops as the skin relaxes after the blow, plus the slap of
 * the hand itself, a few milliseconds of filtered noise.
 */
function membrane({ f, drop = 0, tau = 0.03, t60 = 0.3, modes, hand = 0.3, handHz = 1200, handQ = 0.8, handDecay = 0.008, seconds = 0.6, seed = 1 }) {
  const n = samples(seconds);
  const y = new Float32Array(n);
  const ph = modes.map(() => 0);
  const dec = modes.map((m) => Math.exp(-6.9078 / ((m[2] || t60) * SR)));
  const amp = modes.map((m) => m[1]);
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    const fNow = f * (1 + drop * Math.exp(-t / tau));
    let s = 0;
    for (let m = 0; m < modes.length; m += 1) {
      ph[m] += (2 * Math.PI * fNow * modes[m][0]) / SR;
      s += amp[m] * Math.sin(ph[m]);
      amp[m] *= dec[m];
    }
    y[i] = s;
  }
  if (hand > 0) {
    const h = biquad(white(samples(0.06), seed), "bandpass", handHz, handQ);
    envelope(h, [[0, 0], [0.0004, 1], [handDecay, 0.25], [handDecay * 3, 0.04], [0.06, 0]]);
    mixInto(y, h, 0, hand * 3);
  }
  // highpass gently below the fundamental: no DC from the decaying sines
  const out = onePole(y, f * 0.35, "highpass");
  return normalize(fade(out, 0.0008, 0.03), 0.9);
}

// The skins are tuned in the key: the low skin settles on A2, the middle skin on D3 (the variants differ
// in the hand's noise only).
const SKIN = {
  low: (v) => membrane({ f: hz(midi("A2")), drop: 0.35, tau: 0.035, t60: 0.42, modes: [[1, 1, 0.42], [1.59, 0.32, 0.2], [2.14, 0.18, 0.12], [2.65, 0.08, 0.08]], hand: 0.25, handHz: 700, handDecay: 0.01, seconds: 0.6, seed: 11 + v }),
  mid: (v) => membrane({ f: hz(midi("D3")), drop: 0.18, tau: 0.02, t60: 0.22, modes: [[1, 1, 0.22], [1.59, 0.45, 0.12], [2.14, 0.3, 0.08], [2.3, 0.22, 0.07], [2.65, 0.1, 0.05]], hand: 0.35, handHz: 1500, handDecay: 0.01, seconds: 0.4, seed: 21 + v }),
  slap: (v) => membrane({ f: 360 + 15 * v, drop: 0.05, tau: 0.01, t60: 0.07, modes: [[1, 0.5, 0.07], [1.59, 0.5, 0.05], [2.14, 0.45, 0.04], [2.3, 0.4, 0.04], [2.65, 0.35, 0.03], [2.92, 0.3, 0.03], [3.16, 0.25, 0.025]], hand: 1.1, handHz: 3200, handQ: 0.9, handDecay: 0.012, seconds: 0.25, seed: 31 + v }),
};

/** A handclap of a few hands, never exactly together: each a short burst through the cupped-palm resonance. */
function clapSamples(v) {
  const r = rng(400 + v);
  const y = new Float32Array(samples(0.16));
  const hands = 3;
  for (let h = 0; h < hands; h += 1) {
    const at = h === 0 ? 0 : 0.004 + 0.014 * r();
    const centre = 900 + 900 * r();
    const x = biquad(white(samples(0.12), 50 + v * 7 + h), "bandpass", centre, 1.6);
    envelope(x, [[0, 0], [0.0005, 1], [0.006, 0.35], [0.03, 0.06], [0.12, 0]]);
    mixInto(y, x, at, 0.7 + 0.3 * r());
  }
  return normalize(fade(y, 0.0005, 0.02), 0.9);
}

/** A stick on rock: a few stiff, inharmonic modes that are gone in a tenth of a second, and the click of contact. */
function tapSamples(f, seed) {
  const n = samples(0.14);
  const y = new Float32Array(n);
  const modes = [[1, 1, 0.09], [2.32, 0.6, 0.05], [4.25, 0.45, 0.03]];
  for (const [ratio, a, t60] of modes) {
    const w = (2 * Math.PI * f * ratio) / SR;
    const d = Math.exp(-6.9078 / (t60 * SR));
    let g = a;
    for (let i = 0; i < n; i += 1) {
      y[i] += g * Math.sin(w * i);
      g *= d;
    }
  }
  const click = biquad(white(samples(0.01), seed), "bandpass", 6000, 0.9);
  envelope(click, [[0, 0], [0.0003, 1], [0.003, 0.1], [0.01, 0]]);
  mixInto(y, click, 0, 1.4);
  return normalize(fade(y, 0.0005, 0.02), 0.9);
}

/** The six taps, one per animal, each a little higher than the last (A5 B5 D6 E6 F#6 A6). */
const TAP_NOTES = ["A5", "B5", "D6", "E6", "F#6", "A6"].map(midi);

function skin(k, g, when, ev) {
  const buf = k.buffer(`sahara/${ev.kind}/${ev.variant}`, () => SKIN[ev.kind](ev.variant));
  const { out } = k.play(buf, when, { gain: ev.vel * (ev.lift || 1) * LEVEL[ev.kind], pan: ev.pan || 0 }, g.out);
  if (g.send) out.connect(g.send);
}

function clap(k, g, when, ev) {
  const buf = k.buffer(`sahara/clap/${ev.variant}`, () => clapSamples(ev.variant));
  const { out } = k.play(buf, when, { gain: ev.vel * (ev.lift || 1) * LEVEL.clap, pan: ev.pan || 0 }, g.out);
  if (g.send) out.connect(g.send);
}

function tap(k, g, when, ev) {
  const buf = k.buffer(`sahara/tap/${ev.index}`, () => tapSamples(hz(TAP_NOTES[ev.index]), 600 + ev.index));
  const { out } = k.play(buf, when, { gain: ev.vel * LEVEL.tap, pan: ev.pan || 0 }, g.out);
  if (g.send) out.connect(g.send);
}

/** Levels of the struck sounds (linear, at vel 1). */
const LEVEL = { low: 0.32, mid: 0.2, slap: 0.12, clap: 0.1, tap: 0.18 };
/**
 * Claps and slaps in bars 2 and 3, where the group sings over them, come forward: the slaps 6 dB, each clap
 * so that in 1-5 kHz it stands 3-6 dB above the voices at its onset (measured: +7, +6 and +1 dB; the last
 * clap, at u = 5.5, is the loudest of the three variants and already stood above the thinner A2).
 */
const LIFT = { slap: 2, clap: { 2.5: 3.3, 4.5: 2.1, 5.5: 1.45 } };

// ---------------------------------------------------------------- the place

/** A rock shelter: short, hard and bright. */
const ROOM = { seconds: 1.2, t60: 0.9, bright: 0.75, predelay: 0.006, early: 0.6, seed: 101 };

export default {
  prepare() {
    prepareReverb("sahara/room", ROOM);
    for (const kind of Object.keys(SKIN)) for (let v = 0; v < 2; v += 1) putIfMissing(`sahara/${kind}/${v}`, () => SKIN[kind](v));
    for (let v = 0; v < 3; v += 1) putIfMissing(`sahara/clap/${v}`, () => clapSamples(v));
    for (let i = 0; i < 6; i += 1) putIfMissing(`sahara/tap/${i}`, () => tapSamples(hz(TAP_NOTES[i]), 600 + i));
  },

  graph(k, out) {
    const room = k.reverb("sahara/room", ROOM);
    const send = k.gain(0.2);
    send.connect(room).connect(out);
    return { send };
  },

  score(s) {
    const r = rng(1001);
    const notes = s.theme({ octave: -1 });
    // the vowels the tune is sung on, note by note (no words)
    const VOW = ["o", "a", "e", "a", "o", "a", "a", "e", "o", "m", "o", "a", "e", "a", "o", "a"];
    // the seeds of each note's breath and wander (a second generator, so that the drifts above stay as they were)
    const rw = rng(2002);
    // which notes each singer sings: a note whose next one is the same singer's hands over to it (legato)
    const sings = (who, i) => who === CALLER || (i >= 6 && (who !== CHILD || i !== 9));
    // the last chord begins its release here, so that the voices are down by the frame
    const LAST_RELEASE = 5.93;
    // the phase (in cycles) each singer's last note will have reached when the next one begins: the next one
    // starts upside down when that is in the other half-cycle, so that the two fundamentals meet in phase
    const phase = new Map();
    const sing = (who, i, { lead = false, octave = 0, vel = 0.9, vowel = VOW[i], prev = VOW[i - 1], swell, first = false } = {}) => {
      const n = notes[i];
      const late = who.late;
      const tied = i > 0 && sings(who, i - 1);
      const meet = tied ? phase.get(who) % 1 : 0;
      const invert = tied && meet >= 0.25 && meet < 0.75;
      const ev = {
        midi: n.midi + 12 * octave,
        dur: n.dur - late,
        lead,
        singer: who,
        vowel,
        prev,
        from: i ? notes[i - 1].midi + 12 * octave : undefined,
        drift: (r() - 0.5) * 4,
        swell,
        soft: first ? 0.012 : 0.03,
        // the same singer's next note begins n.dur after this one (both are late by the same amount): hand over there
        legato: i + 1 < notes.length && sings(who, i + 1) ? n.dur : undefined,
        tied,
        invert,
        releaseAt: i === notes.length - 1 ? LAST_RELEASE - (n.u + late) : undefined,
        wob: 1 + Math.floor(rw() * 100000),
        label: `${who.name} ${vowel}`,
      };
      if (i + 1 < notes.length && sings(who, i + 1)) phase.set(who, (invert ? 0.5 : 0) + cyclesAt(ev, n.dur));
      const { midi: m, dur, ...more } = ev;
      s.note(voice, n.u + late, dur, m, vel, more);
    };

    // ---- bar 1 (u 0-2): the caller alone, D E F# A F# A
    for (let i = 0; i <= 5; i += 1) sing(CALLER, i, { lead: true, vel: 0.95, first: i === 0, prev: i === 0 ? "o" : VOW[i - 1] });

    // ---- bar 2, first half (u 2-3): the group answers, B A F#; the child an octave up
    for (let i = 6; i <= 8; i += 1) {
      sing(CALLER, i, { lead: true, vel: 0.9 });
      for (const m of MEN) sing(m, i, { vel: 0.9, prev: i === 6 ? "a" : VOW[i - 1] });
      sing(CHILD, i, { octave: 1, vel: 0.9, prev: i === 6 ? "a" : VOW[i - 1] });
    }

    // ---- u 3-4: the held E, hummed by the low voices only, getting quieter. Everyone is watching.
    sing(CALLER, 9, { lead: true, vel: 0.75, swell: 0.4 });
    for (const m of MEN) sing(m, 9, { vel: 0.68, swell: 0.35 });

    // ---- bar 3 (u 4-6): everyone in octaves, growing to the frame: F# E D | B A B
    for (let i = 10; i <= 15; i += 1) {
      const grow = 0.82 + 0.18 * ((notes[i].u - 4) / 1.75);
      sing(CALLER, i, { lead: true, vel: grow, prev: i === 10 ? "m" : VOW[i - 1] });
      for (const m of MEN) sing(m, i, { vel: grow, prev: i === 10 ? "m" : VOW[i - 1] });
      sing(CHILD, i, { octave: 1, vel: grow, prev: i === 10 ? "m" : VOW[i - 1] });
    }

    // ---- the drums: the pedal cell, DUM . tak tak, on every two beats; claps on beats 2 and 4
    for (let c = 0; c < 6; c += 1) {
      const u = c;
      const hush = u >= 3 && u < 4; // the watching: the low skin alone, on the beats
      const grow = u >= 4 ? 0.85 + 0.15 * (u - 4) : 0.85;
      s.at(u, skin, { kind: "low", variant: c % 2, vel: (hush ? 0.75 : 1) * grow, pan: -0.08, dur: 0.6, label: "low skin" });
      if (hush) {
        s.at(u + 0.5, skin, { kind: "low", variant: 1, vel: 0.6, pan: -0.08, dur: 0.6, label: "low skin" });
        continue;
      }
      // once the group sings (bars 2 and 3) the hands come forward, so that they are not buried under the voices
      const lift = u >= 2 ? LIFT.slap : 1;
      s.at(u + 0.5, skin, { kind: "mid", variant: c % 2, vel: 0.85 * grow, pan: 0.15, dur: 0.4, label: "middle skin" });
      // no slap under the first animal's tap (u = 2.75): the tap stands alone there. (The second, third and
      // fourth taps fall in the hush, where there are no slaps anyway; before Stage 5 the taps were a second
      // earlier and the slap at 1.75 was left out for the same reason: it is back.)
      if (u + 0.75 !== 2.75) s.at(u + 0.75, skin, { kind: "slap", variant: c % 2, vel: 0.8 * grow, lift, pan: 0.22, dur: 0.25, label: "slap" });
      // claps on beats 2 and 4 of each bar: u = 0.5 and 1.5 of the bar
      s.at(u + 0.5, clap, { variant: c % 3, vel: 0.9 * grow, lift: LIFT.clap[u + 0.5] || 1, pan: -0.25, dur: 0.16, label: "claps" });
    }
    // bar 3 grows: the middle skin answers on the last eighths as well
    s.at(5.25, skin, { kind: "mid", variant: 1, vel: 0.7, pan: 0.15, dur: 0.4, label: "middle skin" });

    // ---- the cattle look up, one after another: a dry tap for each, on the eighths inside each look
    // (each animal begins to look at u 2.62, 2.94, 3.20, 3.67, 4.24, 4.72: the tap is the first eighth after)
    const TAPS = [2.75, 3.0, 3.25, 3.75, 4.25, 4.75];
    TAPS.forEach((u, i) => s.at(u, tap, { index: i, vel: 0.85 + 0.03 * i, pan: 0.1 + 0.08 * i, dur: 0.14, label: `tap ${i + 1} (animal ${i + 1} looks up)` }));

    s.cue(0, "the pelican comes onto the rock");
    s.cue(2.75, "the first animal looks up: first tap", { band: [5000, 12000] });
    s.cue(4.75, "the calf looks up: last tap", { band: [5000, 12000] });
  },

  /** The outro's note of this section: the caller, on an open "a". */
  lead(k, g, when, ev) {
    voice(k, g, when, { ...ev, singer: CALLER, vowel: "a" });
  },
  leadOctave: -1,
  bike: { chain: 1, bell: 1 },
};

/** Fill the shared buffer cache ahead of playback. */
function putIfMissing(key, make) {
  if (!hasBuffer(key)) putBuffer(key, make());
}
