// The bicycle: its bell and its chain.
//
// These two sounds belong to the pelican, not to any era, so they do not
// change when the picture does. The bell rings once on every picture-frame
// crossing, exactly on the downbeat. It is tuned to the tonic, so it is also
// the note the tune was heading for: the phrase that one section's instrument
// leaves unfinished is closed by the bell, and the next instrument begins.
// The chain ticks four times for every turn of the pedals, read from the same
// crank angle that draws the picture: where the pelican slows the ticks slow,
// and where it stops they stop.
//
// This file is also the smallest complete example of a part.

import { crossingTime, N_SECTIONS, T_OUTRO_START, DURATION, BAR, sectionAt } from "../../src/beat/timeline.js";
import { T_DEPART } from "../../src/main/camera.js";
import { modal, white, biquad, envelope, mixInto, normalize, samples } from "../engine/dsp.js";
import { sharedBuffer, prepareReverb } from "../engine/kit.js";
import { hz, midi } from "../engine/theory.js";

/** The bell's strike note: the tonic, three octaves above the tune. */
const BELL_NOTE = midi("D7");
/** The single bell of the last bar: the pelican is behind the table by then (the pass begins at bar 6 of the outro). */
export const LAST_BELL = T_OUTRO_START + 5 * BAR + 0.5;

// A small steel dome struck once. Each mode of a dome is a pair of
// frequencies a few hertz apart, which gives the bell its slow shimmer.
function bellSamples() {
  const f = hz(BELL_NOTE);
  const y = modal(
    [
      { f: f * 0.5, a: 0.07, t60: 0.9 },
      // each pair beats slowly (about 3 Hz), and the weaker twin keeps the beat shallow: a shimmer, not a wobble
      { f: f * 0.99935, a: 1.0, t60: 2.3 },
      { f: f * 1.00065, a: 0.25, t60: 2.1, phase: 0.6 },
      { f: f * 2.7575, a: 0.3, t60: 1.2, phase: 0.3 },
      { f: f * 2.7615, a: 0.08, t60: 1.1, phase: 1.4 },
      { f: f * 5.19, a: 0.07, t60: 0.4 },
    ],
    2.6,
  );
  // the striker: a few milliseconds of bright noise
  const tick = biquad(white(samples(0.006), 5), "bandpass", 5200, 1.2);
  envelope(tick, [[0, 1], [0.0015, 0.5], [0.006, 0]]);
  mixInto(y, tick, 0, 0.9);
  return normalize(y, 0.9);
}

// One link of the chain settling on a tooth: a dry tick with a trace of metal.
function tickSamples(variant) {
  const x = biquad(white(samples(0.03), 31 + variant), "bandpass", 3300 + 450 * variant, 2.0);
  envelope(x, [[0, 0], [0.0004, 1], [0.004, 0.22], [0.012, 0.04], [0.03, 0]]);
  const ring = modal(
    [
      { f: 5100 + 310 * variant, a: 0.5, t60: 0.022 },
      { f: 7900 - 240 * variant, a: 0.3, t60: 0.014 },
    ],
    0.03,
  );
  mixInto(x, ring, 0, 0.3);
  return normalize(x, 0.9);
}

/** One stroke of the bell. Other parts may borrow it: s.at(u, ring, { vel: 0.8 }). */
export function ring(k, g, when, ev) {
  const buf = k.buffer("bike/bell", bellSamples);
  const level = 0.2 * (ev.vel === undefined ? 1 : ev.vel);
  const { gain } = k.play(buf, when, { gain: level, pan: ev.pan || 0 }, g.bell || g.out);
  // ev.endBy: seconds after the stroke by which the bell must be silent (the last bell, before the film ends)
  if (ev.endBy) k.env(gain.gain, when, [[0, level], [ev.endBy - 0.5, level], [ev.endBy, 0]]);
}

function tick(k, g, when, ev) {
  const buf = k.buffer(`bike/tick/${ev.variant}`, () => tickSamples(ev.variant));
  k.play(buf, when, { gain: 0.05 * ev.vel, pan: ev.pan }, g.chain || g.out);
}

/** A little air round both sounds, so they sit in the same space as the music. */
const ROOM = { seconds: 1.4, t60: 1.1, bright: 0.8, predelay: 0.008, early: 0.5, seed: 21 };

/** Make the bell, the ticks and the room before anything plays. Other parts that borrow `ring` rely on this. */
export function prepareBike() {
  prepareReverb("bike/room", ROOM);
  sharedBuffer("bike/bell", bellSamples);
  for (let v = 0; v < 4; v += 1) sharedBuffer(`bike/tick/${v}`, () => tickSamples(v));
}

export default {
  prepare() {
    prepareBike();
  },

  graph(k, out) {
    const bell = k.gain(1);
    const chain = k.gain(1);
    const send = k.gain(0.2);
    const room = k.reverb("bike/room", ROOM);
    bell.connect(out);
    chain.connect(out);
    bell.connect(send);
    send.connect(room).connect(out);
    return { bell, chain };
  },

  score(s) {
    // A section may turn the bicycle's sounds up, down or off: bike: { chain, bell }, each a
    // level (1 = as written, 0 = silent) or a function of u, seconds into that section.
    const wish = (n, key, t) => {
      for (const part of s.parts.values()) {
        if (part.n === n && part.bike && part.bike[key] !== undefined) {
          const v = part.bike[key];
          return typeof v === "function" ? v(t - part.t0) : v;
        }
      }
      return 1;
    };

    // the bell: as the sketch sets off, on every crossing, and once at the very end
    s.at(T_DEPART, ring, { dur: 2.4, vel: 0.75 * wish(0, "bell", T_DEPART), label: "bell" });
    s.cue(T_DEPART, "the sketch sets off", { band: [1800, 9000] });
    for (let c = 0; c <= N_SECTIONS; c += 1) {
      const level = wish(c + 1, "bell", crossingTime(c));
      if (level > 0) {
        s.at(crossingTime(c), ring, { dur: 2.4, vel: level, label: "bell" });
        s.cue(crossingTime(c), `crossing ${c}`, { band: [1800, 9000] });
      }
    }
    s.at(LAST_BELL, ring, { dur: DURATION - LAST_BELL, vel: 1.1, endBy: DURATION - LAST_BELL - 0.12, label: "bell" });
    s.cue(LAST_BELL, "the last bell", { band: [1800, 9000] });

    // the chain: a tick at every quarter turn of the pedals, from the moment the sketch moves
    // to the last crossing
    const STEP = 1 / 240;
    let prev = s.pelican(T_DEPART).turns;
    for (let t = T_DEPART + STEP; t <= T_OUTRO_START + 1e-6; t += STEP) {
      const cur = s.pelican(t).turns;
      const a = Math.floor(prev * 4 + 1e-7);
      const b = Math.floor(cur * 4 + 1e-7);
      for (let j = a + 1; j <= b; j += 1) {
        const at = t - STEP + ((j / 4 - prev) / (cur - prev)) * STEP;
        const level = wish(sectionAt(at), "chain", at);
        if (level <= 0) continue;
        const onBeat = j % 2 === 0; // a pedal is forward
        s.at(at, tick, { dur: 0.03, vel: level * (onBeat ? 1 : 0.55), variant: ((j % 4) + 4) % 4, pan: onBeat ? -0.12 : 0.12, label: "chain" });
      }
      prev = cur;
    }
  },
};
