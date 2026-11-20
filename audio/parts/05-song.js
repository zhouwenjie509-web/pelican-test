// Section 5 (song): a guqin, played very quietly, for oneself.
//
// Bar 1 is the tune close by, one octave below written, with the left hand
// sliding E up to F#. In bar 2 the camera pulls back to the whole mountain and
// the music goes far away with it: the open low string (D2) rings out, and
// the rest of the tune is only small harmonics (fan yin) inside its ring,
// each fainter than the last, with a thread of waterfall. As the camera
// pushes in, one stopped note slides slowly up from E3 and comes near, and
// the close shot lands on a plucked F#3. Bar 3 walks down to B2 A2 B2; the
// bell takes the D.
//
// How the sounds are made (plain arithmetic, nothing recorded):
//   string     a sum of decaying partials (modal): harmonics of the note with a
//              trace of stiffness, levels from a pluck near the bridge with the
//              flesh of a finger, upper partials soft (silk) and dying much
//              faster than the low ones; a short knock of the wooden board and
//              a breath of finger noise at the start
//   slide      the same string buffer, its detune moved along a smooth curve
//              (the left hand gliding: every partial moves together)
//   brush      the finger on the wound silk while it slides: faint band-passed noise
//   harmonic   fan yin: almost a pure partial with a little second and third,
//              ringing long, with a tiny touch noise
//   waterfall  pink noise through a high and a low pass, very soft
//   room       one quiet dark room, 1.8 s

import { prepareReverb, sharedBuffer } from "../engine/kit.js";
import { SR, samples, white, biquad, envelope, fade, mixInto, normalize, modal } from "../engine/dsp.js";
import { hz, midi } from "../engine/theory.js";

/** A quiet dark room. */
const ROOM = { seconds: 1.8, t60: 1.5, bright: 0.22, predelay: 0.014, early: 0.3, seed: 505 };

/** Linear levels at vel 1. */
const LEVEL = { string: 0.24, harmonic: 0.102, brush: 0.02, waterfall: 0.012 };

// ---------------------------------------------------------------- the string

/** Seconds of buffer for a stopped or open string. */
const stringSeconds = (m) => (m <= 40 ? 4.6 : 2.6);

/**
 * One plucked silk string at MIDI note m. The right hand plucks about a tenth
 * of the way from the bridge with the flesh of the finger: many harmonics, but
 * soft ones, and the silk takes the top away fast. Low strings ring longest.
 */
function stringSamples(m, dark = 0) {
  const f = hz(m);
  const seconds = stringSeconds(m);
  const T1 = 3.6 * (hz(38) / f) ** 0.3; // D2 rings 3.6 s, A3 about 2.6 s
  const p = 0.11;
  const partials = [];
  for (let n = 1; n <= 48; n += 1) {
    const fn = f * n * Math.sqrt(1 + 2e-5 * n * n);
    if (fn > 7000) break;
    // dark (Hz): the far open string, plucked softly over the soundboard's middle: its upper partials roll off above `dark`
    const a = (Math.sin(Math.PI * n * p) / n ** 1.4 / (1 + (fn / 1000) ** 2)) * (dark ? 1 / (1 + (fn / dark) ** 2) : 1);
    const t60 = 1 / (1 / T1 + 1.6 * (fn / 1000) ** 2);
    partials.push({ f: fn, a, t60 });
  }
  const y = modal(partials, seconds, { attack: 0.003 });
  normalize(y, 1);
  // the board: a short, low knock of the lacquered box
  const board = modal(
    [
      { f: 118, a: 1, t60: 0.09 },
      { f: 241, a: 0.5, t60: 0.06 },
      { f: 405, a: 0.25, t60: 0.04 },
    ],
    0.2,
    { attack: 0.002 },
  );
  normalize(board, 1);
  mixInto(y, board, 0, m <= 40 ? 0.09 : 0.05);
  // the finger leaving the string: a breath of noise
  const touch = biquad(white(samples(0.02), 50 + m), "bandpass", 1200, 0.8);
  envelope(touch, [[0, 0], [0.001, 1], [0.006, 0.2], [0.02, 0]]);
  mixInto(y, touch, 0, m <= 40 ? 0.05 : 0.025);
  // dark: the fundamental keeps the level it has in the bright buffer; only the upper partials go
  return normalize(fade(y, 0.001, 0.05), dark ? OPEN_PEAK : 0.9);
}

/** The open string of bar 2: the same string, darker (depth, not mid-range). */
const OPEN_DARK = 180;
const OPEN_PEAK = 0.5;

/**
 * The stopped string kept sounding while the left hand slides and the note comes near:
 * the partials of the string, held steady (the swell and the opening are drawn by nodes).
 */
function sustainSamples(m) {
  const f = hz(m);
  const partials = [];
  for (let n = 1; n <= 24; n += 1) {
    const fn = f * n * Math.sqrt(1 + 2e-5 * n * n);
    if (fn > 5000) break;
    partials.push({ f: fn, a: Math.sin(Math.PI * n * 0.11) / n ** 1.4 / (1 + (fn / 1000) ** 2), t60: 30, phase: 1.7 * n });
  }
  const y = modal(partials, 1.0, { attack: 0.01 });
  return normalize(fade(y, 0.01, 0.02), 0.9);
}

/** A harmonic (fan yin): the string touched lightly at a node and plucked. Nearly one pure partial. */
function harmonicSamples(m) {
  const f = hz(m);
  const y = modal(
    [
      { f, a: 1, t60: 2.4 },
      { f: 2 * f, a: 0.1, t60: 1.1, phase: 0.4 },
      { f: 3 * f, a: 0.03, t60: 0.6, phase: 1.1 },
    ],
    3.0,
    { attack: 0.001 },
  );
  normalize(y, 1);
  const touch = biquad(white(samples(0.012), 80 + m), "bandpass", 2600, 1.0);
  envelope(touch, [[0, 0], [0.0006, 1], [0.004, 0.15], [0.012, 0]]);
  mixInto(y, touch, 0, 0.03);
  return normalize(fade(y, 0.001, 0.05), 0.9);
}

const smooth = (x) => x * x * (3 - 2 * x);

/**
 * Send a sound to the room as well as to the part's output. wet: level into the room.
 */
function place(k, g, node, wet) {
  node.connect(g.out);
  if (g.roomIn && wet > 0) node.connect(k.gain(wet)).connect(g.roomIn);
}

/**
 * One plucked note. ev: midi, vel, ring (seconds it is let sound, default dur + 0.35),
 * release (seconds of fade at the end of the ring), slides ([[t0, t1, cents]] after the
 * pluck: the left hand gliding), yin (cents of the rocking vibrato from 0.2 s on),
 * grow (the note comes near: it swells and opens), wet (room send), pan.
 */
function qin(k, g, when, ev) {
  const buf = ev.dark
    ? k.buffer(`song/open/${ev.midi}`, () => stringSamples(ev.midi, OPEN_DARK))
    : k.buffer(`song/string/${ev.midi}`, () => stringSamples(ev.midi));
  const ring = Math.min(ev.ring === undefined ? ev.dur + 0.35 : ev.ring, buf.duration - 0.06);
  const release = Math.min(ev.release === undefined ? 0.25 : ev.release, ring * 0.8);
  const level = LEVEL.string * ev.vel;
  let node;
  const srcs = [];
  if (ev.grow) {
    // far to near: a quiet, dark pluck, then the string kept sounding under the sliding hand,
    // swelling and opening as the camera arrives (it must beat the pluck's own decay)
    const lp = k.filter("lowpass", 700, 0);
    k.env(lp.frequency, when, [[0, 700], [ring * 0.5, 2600, "exp"], [ring, 4000, "exp"]]);
    const played = k.play(buf, when, { dur: ring, gain: level * 0.3, fade: release }, lp);
    srcs.push(played.src);
    const held = k.buffer(`song/sustain/${ev.midi}`, () => sustainSamples(ev.midi));
    const sus = k.play(held, when, { dur: Math.min(ring, held.duration - 0.03), fade: release }, null);
    srcs.push(sus.src);
    const swell = k.gain(0);
    const top = level * ev.grow;
    k.env(swell.gain, when, [[0, 0], [0.06, top * 0.12], [ring - release, top, "exp"], [ring, top]]);
    sus.out.connect(swell).connect(lp);
    node = lp;
  } else {
    const played = k.play(buf, when, { dur: ring, gain: level, fade: release, pan: ev.pan || 0 }, null);
    srcs.push(played.src);
    node = played.out;
  }
  // the left hand: slides, or the rocking vibrato (yin)
  // (as breakpoints joined by straight lines: a value curve on a buffer source's detune did not move in Chrome's offline render)
  if (ev.slides) {
    const pts = [[0, 0]];
    let cents = 0;
    for (const [t0, t1, to] of ev.slides) {
      const steps = 12;
      for (let i = 0; i <= steps; i += 1) pts.push([t0 + ((t1 - t0) * i) / steps, cents + (to - cents) * smooth(i / steps)]);
      cents = to;
    }
    for (const src of srcs) k.env(src.detune, when, pts);
  } else if (ev.yin && ring > 0.45) {
    // the rocking vibrato: from 0.2 s on, growing in over 0.15 s, 4.5 times a second
    const pts = [[0, 0], [0.2, 0]];
    for (let t = 0.2 + 1 / 18; t < ring - 0.02; t += 1 / 18) {
      const depth = ev.yin * Math.min(1, (t - 0.2) / 0.15);
      pts.push([t, depth * Math.sin(2 * Math.PI * 4.5 * (t - 0.2))]);
    }
    for (const src of srcs) k.env(src.detune, when, pts);
  }
  place(k, g, node, ev.wet === undefined ? 0.18 : ev.wet);
}

/** A harmonic (fan yin), far away inside the ring of the open string. */
function fanyin(k, g, when, ev) {
  const buf = k.buffer(`song/harmonic/${ev.midi}`, () => harmonicSamples(ev.midi));
  const ring = Math.min(ev.ring === undefined ? 1.5 : ev.ring, buf.duration - 0.06);
  const { out } = k.play(buf, when, { dur: ring, gain: LEVEL.harmonic * ev.vel, fade: ev.release === undefined ? 0.4 : ev.release, pan: ev.pan || 0 }, null);
  place(k, g, out, ev.wet === undefined ? 0.45 : ev.wet);
}

/** The finger on the wound silk while it slides. ev.early: seconds it starts before `when`; ev.len its length. */
function brush(k, g, when, ev) {
  const t0 = when - (ev.early || 0);
  const len = ev.len;
  const n = k.noise("pink", t0, t0 + len + 0.01, { seed: 5, phase: ev.phase || 0 });
  const bp = k.filter("bandpass", 1900, 1.4);
  const lp = k.filter("lowpass", 4200, 0);
  const a = k.gain(0);
  const peak = LEVEL.brush * ev.vel;
  k.env(a.gain, t0, ev.grow ? [[0, 0], [0.05, peak * 0.15], [len - 0.04, peak], [len, 0]] : [[0, 0], [len * 0.4, peak], [len, 0]]);
  k.chain(n, bp, lp, a);
  place(k, g, a, 0.1);
}

/** The waterfall, a thread of bare silk in the far recess: a very soft hiss. */
function waterfall(k, g, when, ev) {
  const n = k.noise("pink", when, when + ev.dur + 0.01, { seed: 9, phase: 1.3 });
  const hp = k.filter("highpass", 1800, 0);
  const lp = k.filter("lowpass", 4000, 0);
  const a = k.gain(0);
  const lv = LEVEL.waterfall * ev.vel;
  k.env(a.gain, when, [[0, 0], [0.45, lv], [ev.dur - 0.5, lv], [ev.dur, 0]]);
  k.chain(n, hp, lp, a);
  place(k, g, a, 0.3);
}

/** The outro's note of this section: a plain stopped string, near. */
function leadVoice(k, g, when, ev) {
  qin(k, g, when, { ...ev, ring: ev.dur + 0.4, release: 0.3 });
}

// ---------------------------------------------------------------- the part

/** Every string note the part or the outro may ask for: the major scale from D2 to E4. */
const STRING_NOTES = [38, 40, 42, 43, 45, 47, 49, 50, 52, 54, 55, 57, 59, 61, 62, 64];
const HARMONIC_NOTES = ["E4", "F#4", "A4", "B4"].map(midi);

export default {
  prepare() {
    prepareReverb("song/room", ROOM);
    for (const m of STRING_NOTES) sharedBuffer(`song/string/${m}`, () => stringSamples(m));
    for (const m of HARMONIC_NOTES) sharedBuffer(`song/harmonic/${m}`, () => harmonicSamples(m));
    sharedBuffer(`song/open/${midi("D2")}`, () => stringSamples(midi("D2"), OPEN_DARK));
    sharedBuffer(`song/sustain/${midi("E3")}`, () => sustainSamples(midi("E3")));
  },

  graph(k, out) {
    const room = k.reverb("song/room", ROOM);
    const roomIn = k.gain(1);
    roomIn.connect(k.filter("highpass", 90, 0)).connect(room).connect(out);
    return { roomIn };
  },

  score(s) {
    const N = (name) => midi(name);
    // bars 1 and 3 carry the section's loudness now that the wide shot of bar 2 is far quieter
    const NEAR = 1.07;

    // ---- bar 1 (u 0-2): the tune close by, unhurried. D3, E3 sliding to F#3, A3, F#3, A3.
    s.note(qin, 0.0, 0.5, N("D3"), 0.8 * NEAR, { lead: true, ring: 0.8, yin: 8, label: "string D3" });
    s.note(qin, 0.5, 0.25, N("E3"), 0.72 * NEAR, { lead: true, ring: 0.8, slides: [[0.2, 0.275, 200]], label: "string E3, slides to F#3" });
    s.note(brush, 0.75, 0.25, N("F#3"), 0.6 * NEAR, { lead: true, early: 0.055, len: 0.08, label: "slide arrives on F#3 (the same string)" });
    s.note(qin, 1.0, 0.5, N("A3"), 0.78 * NEAR, { lead: true, ring: 0.75, label: "string A3" });
    s.note(qin, 1.5, 0.25, N("F#3"), 0.7 * NEAR, { lead: true, ring: 0.55, label: "string F#3" });
    s.note(qin, 1.75, 0.25, N("A3"), 0.72 * NEAR, { lead: true, ring: 0.3, release: 0.2, label: "string A3" });

    // ---- bar 2 (u 2-4): far away. The open low string, and the tune as harmonics inside its ring.
    s.note(qin, 2.0, 3.6, N("D2"), 0.85, { ring: 3.6, release: 2.0, wet: 0.24, dark: true, label: "open string D2" });
    s.note(fanyin, 2.0, 0.5, N("B4"), 0.6, { lead: true, ring: 1.6, release: 0.6, label: "harmonic B4" });
    s.note(fanyin, 2.5, 0.25, N("A4"), 0.45, { lead: true, ring: 1.4, release: 0.6, label: "harmonic A4" });
    s.note(fanyin, 2.75, 0.25, N("F#4"), 0.34, { lead: true, ring: 1.3, release: 0.6, label: "harmonic F#4" });
    s.note(fanyin, 3.0, 1.0, N("E4"), 0.26, { lead: true, ring: 1.0, release: 0.5, label: "harmonic E4" });
    s.at(2.3, waterfall, { dur: 1.3, vel: 1, label: "waterfall" });

    // u 3.2-4.0: the camera pushes in; one stopped note slides slowly up from E3 and comes near
    s.note(qin, 3.2, 0.8, N("E3"), 0.6, { lead: true, free: true, grow: 0.95, ring: 0.8, release: 0.06, slides: [[0.06, 0.78, 200]], wet: 0.22, label: "string E3 sliding up to F#3, coming near" });
    s.at(3.26, brush, { dur: 0.72, len: 0.72, vel: 0.7, grow: true, phase: 2.1, label: "slide brush" });

    // ---- bar 3 (u 4-6): near again, to the frame. F#3 E3 D3 | B2 A2 B2. The bell takes the D.
    s.note(qin, 4.0, 0.5, N("F#3"), 0.86 * NEAR, { lead: true, ring: 0.75, yin: 8, label: "string F#3" });
    s.note(qin, 4.5, 0.25, N("E3"), 0.74 * NEAR, { lead: true, ring: 0.55, label: "string E3" });
    s.note(qin, 4.75, 0.25, N("D3"), 0.74 * NEAR, { lead: true, ring: 0.6, label: "string D3" });
    s.note(qin, 5.0, 0.5, N("B2"), 0.8 * NEAR, { lead: true, ring: 0.75, label: "string B2" });
    s.note(qin, 5.5, 0.25, N("A2"), 0.72 * NEAR, { lead: true, ring: 0.55, label: "string A2" });
    s.note(qin, 5.75, 0.25, N("B2"), 0.74 * NEAR, { lead: true, ring: 0.95, release: 0.6, label: "string B2" });

    s.cue(0, "the pelican comes through the frame, close on the path");
    s.cue(2.0, "the camera pulls out to the whole painting: the open low string");
    s.cue(4.0, "the push-in lands on the close shot: F#3 plucked, near again");
  },

  lead: leadVoice,
  leadOctave: -1,
  bike: {
    bell: 1,
    chain: (u) => (u < 2 ? 1 : u < 2.5 ? 1 - 0.92 * ((u - 2) / 0.5) : u < 3.3 ? 0.08 : u < 4 ? 0.08 + 0.92 * ((u - 3.3) / 0.7) : 1),
  },
};
