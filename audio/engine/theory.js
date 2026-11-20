// Pitch, key and the main melody of "The Pelican Test".
//
// The film has one tune. It is three bars long, like a section, and it is
// built from one rhythmic cell, long-short-short, which is one turn of the
// pedals (two beats). Bar 1 climbs, bar 2 reaches the top and then holds its
// breath on the second degree (that held note is where each section's joke
// lands), bar 3 walks down and round to the tonic, which arrives on the next
// downbeat: the note that ends one section's phrase is played by the next
// section's instrument. The tune passes through the picture frame the way
// the pelican does.
//
//   bar 1   D . E F# | A . F# A        1 . 2 3 | 5 . 3 5
//   bar 2   B . A F# | E . . .         6 . 5 3 | 2 - - -
//   bar 3   F# . E D | B, . A, B,      3 . 2 1 | 6, . 5, 6,     -> D (the next downbeat)
//
// It uses five notes only (D E F# A B), so every tradition in the film can
// play it in its own tuning: a section may swap the scale and keep the shape.

import { BEAT } from "../../src/beat/timeline.js";

/** Concert pitch. */
export const TUNING = 440;

/** Frequency of a MIDI note number. Fractions are allowed (62.4 is 40 cents above D4). */
export const hz = (m) => TUNING * 2 ** ((m - 69) / 12);

const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** "D4" -> 62, "F#3" -> 54, "Bb2" -> 46. Middle C is C4 = 60. */
export function midi(name) {
  const m = /^([A-G])([#b]?)(-?\d+)$/.exec(name);
  if (!m) throw new Error(`Bad note name: ${name}`);
  return LETTER[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12 * (Number(m[3]) + 1);
}

/** 62 -> "D4"; fractional notes show their offset in cents: 62.4 -> "D4+40". */
export function noteName(m) {
  const r = Math.round(m);
  const cents = Math.round((m - r) * 100);
  return `${SHARP_NAMES[((r % 12) + 12) % 12]}${Math.floor(r / 12) - 1}${cents ? (cents > 0 ? "+" : "") + cents : ""}`;
}

/** The tonic of the film: D4. */
export const TONIC = 62;

/**
 * Five-note scales, in semitones above the tonic. The melody is written in
 * scale steps 0..4, so a section can play it in another tuning.
 */
export const SCALES = {
  major: [0, 2, 4, 7, 9], // D E F# A B: the tune as written
  minor: [0, 2, 3, 7, 8], // D E F A Bb: the same shape in the dark
  in: [0, 1, 5, 7, 8], // D Eb G A Bb: the Japanese in scale (miyako-bushi)
  slendro: [0, 2.4, 4.8, 7.2, 9.6], // five nearly equal steps: Javanese slendro
};

/** The main melody: [beat, beats, scale step, octave]. Beats count from the section's start. */
export const THEME = [
  [0, 1, 0, 0],
  [1, 0.5, 1, 0],
  [1.5, 0.5, 2, 0],
  [2, 1, 3, 0],
  [3, 0.5, 2, 0],
  [3.5, 0.5, 3, 0],
  [4, 1, 4, 0],
  [5, 0.5, 3, 0],
  [5.5, 0.5, 2, 0],
  [6, 2, 1, 0],
  [8, 1, 2, 0],
  [9, 0.5, 1, 0],
  [9.5, 0.5, 0, 0],
  [10, 1, 4, -1],
  [11, 0.5, 3, -1],
  [11.5, 0.5, 4, -1],
];

/** The notes that carry the tune: the first of every two-beat cell. A slow instrument may play these alone. */
export const SKELETON_BEATS = [0, 2, 4, 6, 8, 10];

/**
 * The melody as notes.
 *   scale    a name from SCALES or five semitone offsets
 *   tonic    MIDI note of the tonic (default D4)
 *   octave   whole octaves up or down
 * Each note: { beat, beats, u, dur, midi, step, octave, skeleton }; u and dur are in seconds.
 */
export function theme({ scale = "major", tonic = TONIC, octave = 0 } = {}) {
  const steps = typeof scale === "string" ? SCALES[scale] : scale;
  if (!steps || steps.length !== 5) throw new Error(`Unknown scale: ${scale}`);
  return THEME.map(([beat, beats, step, oct]) => ({
    beat,
    beats,
    u: beat * BEAT,
    dur: beats * BEAT,
    midi: tonic + steps[step] + 12 * (oct + octave),
    step,
    octave: oct + octave,
    skeleton: SKELETON_BEATS.includes(beat),
  }));
}

/**
 * The plain harmony under the tune, for the sections that use chords:
 *   | D . . . | G . A . | D/F# . G A |
 * root and bass are semitones above D; tones are pitch classes above D.
 * Sections are free to reharmonise in their own idiom.
 */
export const HARMONY = [
  { beat: 0, beats: 4, name: "D", root: 0, bass: 0, tones: [0, 4, 7] },
  { beat: 4, beats: 2, name: "G", root: 5, bass: 5, tones: [5, 9, 0] },
  { beat: 6, beats: 2, name: "A", root: 7, bass: 7, tones: [7, 11, 2] },
  { beat: 8, beats: 2, name: "D/F#", root: 0, bass: 4, tones: [0, 4, 7] },
  { beat: 10, beats: 1, name: "G", root: 5, bass: 5, tones: [5, 9, 0] },
  { beat: 11, beats: 1, name: "A", root: 7, bass: 7, tones: [7, 11, 2] },
];

/** The chord sounding at a beat (0..12). */
export function chordAt(beat) {
  for (const c of HARMONY) if (beat >= c.beat && beat < c.beat + c.beats) return c;
  return HARMONY[HARMONY.length - 1];
}

/** Decibels to a linear gain and back. */
export const dB = (v) => 10 ** (v / 20);
export const toDb = (g) => 20 * Math.log10(Math.max(g, 1e-12));
