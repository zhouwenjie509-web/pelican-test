// Section 9 (bada): a xiao, the end-blown bamboo flute, and a great deal of silence.
//
// Seven notes on bare paper. Bar 1: D and A, each long, each beginning in
// breath. Bar 2: when the pelican rolls its eye to heaven, the flute's one long
// breath rolls up with it (B4 bending five semitones to E5 by u = 2.6: the tune's
// E, an octave up with the eye), hangs there straight and thin through the strong
// beat, and slides back down
// to arrive on F#4 at u = 4.0 as the eye comes back. The fish below answers
// with the same gesture, small and an octave lower (u 3.25 - 3.7). Bar 3: D4
// short, B3 long, fading into breath. The bell takes the D.
//
// How the flute is made (nodes, because its pitch must move while it sounds):
//   tone     an oscillator with a fixed harmonic recipe: almost only the
//            fundamental, the 2nd and 3rd partials about 20 and 26 dB down,
//            through a lowpass that can close as the note climbs (the tone thins)
//   edge     white noise through a narrow band-pass that follows the pitch:
//            the breathy, airy part of the fundamental that makes a xiao dark
//   breath   white noise band-passed round 2 - 6 kHz, 30 dB or more under the
//            note, a little stronger at each onset (the note begins in breath)
//   pitch    one ConstantSource carries the bend in cents to the oscillator and
//            to the edge filter together; a late, narrow vibrato is summed into it
// A small dry room, 0.7 s, barely there.

import { prepareReverb, hasBuffer, putBuffer } from "../engine/kit.js";
import { SR, white, fade } from "../engine/dsp.js";
import { hz, midi } from "../engine/theory.js";

// ---------------------------------------------------------------- the flute

const ROOM = { seconds: 0.7, t60: 0.55, bright: 0.35, predelay: 0.01, early: 0.4, seed: 909 };
const NOISE_KEY = "bada/air";
const NOISE_SECONDS = 3;
const airSamples = () => fade(white(NOISE_SECONDS * SR, 9091), 0.003, 0.003);

/** Overall level of the flute (linear, at vel 1). Set by measurement against -25 LUFS. */
const LEVEL = 0.114;

/** The tone's harmonic recipe (sine amplitudes, index 1 = fundamental). */
const XIAO_SINES = [0, 1, 0.1, 0.05, 0.015];
const FISH_SINES = [0, 1, 0.04, 0.01];

/** Points of a smooth (smootherstep) move from v0 to v1 between t0 and t1, for k.env. */
function smooth(t0, t1, v0, v1, steps = 10) {
  const pts = [];
  for (let i = 1; i <= steps; i += 1) {
    const x = i / steps;
    const s = x * x * x * (x * (x * 6 - 15) + 10);
    pts.push([t0 + (t1 - t0) * x, v0 + (v1 - v0) * s]);
  }
  return pts;
}

/**
 * One breath on the xiao. ev: midi, dur (seconds until the release begins), vel, and optionally
 *   attack    seconds for the tone to speak (default 0.12)
 *   release   seconds for the tone to die (default 0.12)
 *   bend      [[dt, cents], ...] the pitch path after the start (lips and jaw)
 *   thin      [[dt, lowpass Hz], ...] the tone's lowpass path (default fixed)
 *   vib       [[dt, cents depth], ...] the vibrato depth path (default: arrives late and narrow)
 *   breath    how much air (1 = normal)
 *   airy      [[dt, factor], ...] extra air over the note (multiplies the breath)
 *   lift      [[dt, factor], ...] the tone's level over the note (multiplies the tone; default 1)
 *   fadeTone  [t0, t1]: the tone fades out between these while the air goes on (fading into breath)
 *   fish      true for the small voice below (purer, less air)
 */
function xiao(k, g, when, ev) {
  const dur = Math.max(0.08, ev.dur);
  const attack = ev.attack || 0.12;
  const release = ev.release || 0.12;
  const end = when + Math.max(dur + release, ev.fadeTone ? ev.fadeTone[1] + 0.12 : 0) + 0.02;
  const level = LEVEL * (ev.vel === undefined ? 0.8 : ev.vel) * (ev.fish ? 0.18 : 1);
  const f0 = hz(ev.midi);

  // ---- pitch: the bend (and a small scoop up to the note at the start) plus the vibrato
  const ctl = k.constant(0, when, end);
  const bend = ev.bend || [];
  k.env(ctl.offset, when, [[0, -12], [0.08, 0], ...bend]);
  const lfo = k.lfo(ev.fish ? 6.0 : 5.1, when, end, ev.phase || 0);
  const depth = k.gain(0);
  const vib = ev.vib || (dur > 0.45 ? [[0.3, 0], [Math.min(dur, 0.65), 8]] : [[0.1, 0]]);
  k.env(depth.gain, when, [[0, 0], ...vib]);
  lfo.connect(depth).connect(ctl.offset);

  // ---- the tone
  const osc = k.osc(k.wave(ev.fish ? "bada/fish" : "bada/xiao", ev.fish ? FISH_SINES : XIAO_SINES), f0, when, end);
  ctl.connect(osc.detune);
  const lp = k.filter("lowpass", 2200, -3);
  if (ev.thin) k.env(lp.frequency, when, [[0, 2200], ...ev.thin]);
  const tone = k.gain(0);
  const tonePts = [[0, 0], [attack * 0.4, level * 0.35], [attack, level]];
  if (ev.fadeTone) tonePts.push([ev.fadeTone[0], level * 0.95], [ev.fadeTone[1], 0]);
  else tonePts.push([dur, level * 0.92], [dur + release, 0]);
  k.env(tone.gain, when, tonePts);
  k.chain(osc, lp, tone);
  const lift = k.gain(1);
  if (ev.lift) k.env(lift.gain, when, [[0, 1], ...ev.lift]);
  tone.connect(lift);

  // ---- the air: one stretch of shared noise, two filters
  const air = k.buffer(NOISE_KEY, airSamples);
  const offset = (((ev.midi * 0.137 + (ev.u || 0) * 0.71) % (NOISE_SECONDS - 0.5)) + NOISE_SECONDS) % (NOISE_SECONDS - 0.5);
  const { out: noise } = k.play(air, when, { offset, dur: end - when, loop: true, gain: 1 });

  // the edge: noise on the fundamental, following the pitch
  const edgeBp = k.filter("bandpass", f0, 9);
  ctl.connect(edgeBp.detune);
  const edge = k.gain(0);
  const edgeLevel = level * (ev.fish ? 0.4 : 0.9);
  const edgeEnd = ev.fadeTone ? ev.fadeTone[1] + 0.1 : dur + release;
  k.env(edge.gain, when, [[0, 0], [0.03, edgeLevel * 1.3], [attack + 0.05, edgeLevel], [Math.max(attack + 0.06, edgeEnd - release), edgeLevel * 0.9], [edgeEnd, 0]]);
  k.chain(noise, edgeBp, edge);

  // the breath: high air, strongest at the start
  const hi = k.filter("bandpass", 3600, 0.6);
  const breath = k.gain(0);
  const b = level * 0.045 * (ev.breath === undefined ? 1 : ev.breath) * (ev.fish ? 0.3 : 1);
  const bEnd = ev.fadeTone ? ev.fadeTone[1] + 0.12 : dur + release;
  k.env(breath.gain, when, [[0, 0], [ev.first ? 0.012 : 0.025, b * 2.2], [attack + 0.06, b], [Math.max(attack + 0.07, bEnd - 0.1), b], [bEnd, 0]]);
  const airy = k.gain(1);
  if (ev.airy) k.env(airy.gain, when, [[0, 1], ...ev.airy]);
  k.chain(noise, hi, breath, airy);

  const mix = k.gain(1);
  lift.connect(mix);
  edge.connect(mix);
  airy.connect(mix);
  const hp = k.filter("highpass", 90, -3);
  const pan = k.pan(ev.pan || 0);
  k.chain(mix, hp, pan, g.out);
  if (g.send) pan.connect(g.send);
}

/** A silent marker: the held top of the eye note sounds inside the long breath; this only declares its pitch. */
function heldMark() {}

/** The small voice of the fish: the same instrument, small. */
function fish(k, g, when, ev) {
  xiao(k, g, when, { ...ev, fish: true });
}

export default {
  prepare() {
    prepareReverb("bada/room", ROOM);
    if (!hasBuffer(NOISE_KEY)) putBuffer(NOISE_KEY, airSamples());
  },

  graph(k, out) {
    const room = k.reverb("bada/room", ROOM);
    const send = k.gain(0.12);
    send.connect(room).connect(out);
    return { send };
  },

  score(s) {
    const TOP_LP = 1150; // the tone's lowpass at the top of the eye note (Hz): the tone thins as it climbs
    const TOP_LIFT = 1.12; // the tone's level at the top, against B4: +1 dB, because the small room adds about 1 dB at D5 and nothing at E5
    const EARLY = 0.04; // the flute speaks slowly: later notes begin a little before their beat

    // ---- bar 1: D4 out of silence, beginning in breath; A4 on beat 2. Each is followed by real
    // silence (the review's "more paper"): D4 sounds 0 - 0.75, A4 0.96 - 1.56.
    s.note(xiao, 0, 0.6, midi("D4"), 0.8, { lead: true, attack: 0.15, release: 0.15, breath: 1.4, first: true, phase: 0.0, label: "xiao" });
    s.note(xiao, 1.0 - EARLY, 0.46, midi("A4"), 0.82, { lead: true, release: 0.14, phase: 0.37, label: "xiao" });

    // ---- bar 2: one breath from 1.96 to about 4.4. B4 rolls up with the eye to E5 by 2.6,
    // holds straight and thin through the strong beat (the tune's held E, an octave up), and
    // slides down to F#4 at 4.0.
    const start = 2.0 - EARLY;
    const at = (u) => u - start;
    s.note(xiao, start, 4.27 - start, midi("B4"), 0.84, {
      lead: true,
      free: true,
      release: 0.15,
      phase: 0.71,
      bend: [[at(2.02), 0], ...smooth(at(2.02), at(2.6), 0, 500, 12), [at(3.6), 500], ...smooth(at(3.6), at(4.0), 500, -500, 10)],
      thin: [[at(2.05), 2200], ...smooth(at(2.05), at(2.6), 2200, TOP_LP, 6), [at(3.6), TOP_LP], ...smooth(at(3.6), at(4.0), TOP_LP, 2200, 4)],
      // no vibrato while it bends and hangs; a little, late, once it has come home on F#
      vib: [[at(4.08), 0], [at(4.3), 7]],
      lift: [[at(2.05), 1], ...smooth(at(2.05), at(2.6), 1, TOP_LIFT, 6), [at(3.6), TOP_LIFT], ...smooth(at(3.6), at(4.0), TOP_LIFT, 1, 4)],
      airy: [[at(2.05), 1], ...smooth(at(2.05), at(2.6), 1, 1.7, 4), [at(3.6), 1.7], ...smooth(at(3.6), at(4.0), 1.7, 1, 4)],
      label: "xiao (the eye)",
    });

    // ---- the held E5, 2.6 - 3.6, is dead straight: a silent marker lets the checker measure it
    s.note(heldMark, 2.6, 1.0, midi("E5"), 0.84, { lead: true, label: "xiao (the eye, held E5)" });

    // ---- the fish answers, an octave below and far quieter: B3 bending up to E4
    s.note(fish, 3.25, 0.37, midi("B3"), 0.8, {
      free: true,
      attack: 0.06,
      release: 0.08,
      pan: 0.15,
      phase: 0.2,
      bend: [[0.06, 0], ...smooth(0.06, 0.32, 0, 500, 8)],
      vib: [[0.1, 0]],
      label: "fish",
    });

    // ---- bar 3: D4 short, B3 long, fading into breath
    s.note(xiao, 4.75 - EARLY, 0.22, midi("D4"), 0.74, { lead: true, attack: 0.06, release: 0.06, breath: 0.8, phase: 0.53, label: "xiao" });
    s.note(xiao, 5.0 - EARLY, 0.7, midi("B3"), 0.8, { lead: true, release: 0.1, phase: 0.11, fadeTone: [0.32, 0.72], breath: 1.2, label: "xiao" });

    s.cue(0, "the pelican rides onto empty paper: the first breath", { soft: true });
    s.cue(2.0, "the eye starts to roll up: the long note", { soft: true });
  },

  /** The outro's note of this section: one breath on the xiao. */
  lead(k, g, when, ev) {
    xiao(k, g, when, { midi: ev.midi, dur: ev.dur, vel: ev.vel, attack: Math.min(0.12, Math.max(0.04, ev.dur * 0.3)), release: Math.min(0.12, Math.max(0.05, ev.dur * 0.3)) });
  },
  leadOctave: 0,
  bike: { chain: 0.5, bell: 0.8 },
};
