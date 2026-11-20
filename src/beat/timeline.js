// Beats and timeline for "The Pelican Test".
//
// 120 BPM, one bar = 2 s. The film opens with a two-beat pickup followed by two
// bars of intro, so bar lines fall at t = 1, 3, 5, ... and every picture-frame
// crossing lands on a downbeat:
//
//   crossing k happens at t = 5 + 6k seconds, k = 0..20
//     k = 0     intro wall  -> Section 1
//     k = 1..19 Section k   -> Section k + 1
//     k = 20    Section 20  -> outro (gallery wall)

export const BPM = 120;
export const BEAT = 60 / BPM; // 0.5 s
export const BEATS_PER_BAR = 4;
export const BAR = BEAT * BEATS_PER_BAR; // 2 s
export const PICKUP = BEAT * 2; // 1 s before the first bar line

export const INTRO_BARS = 2.5;
export const SECTION_BARS = 3;
export const OUTRO_BARS = 6;
export const N_SECTIONS = 20;

export const T_INTRO = INTRO_BARS * BAR; // 5 s
export const T_SECTION = SECTION_BARS * BAR; // 6 s
export const T_OUTRO = OUTRO_BARS * BAR; // 12 s
export const T_OUTRO_START = T_INTRO + N_SECTIONS * T_SECTION; // 125 s
export const DURATION = T_OUTRO_START + T_OUTRO; // 137 s

/** Time of crossing k (0..20). */
export const crossingTime = (k) => T_INTRO + k * T_SECTION;

/** Start time of section n (1..20). Section 0 is the intro, 21 the outro. */
export function sectionStart(n) {
  if (n <= 0) return 0;
  if (n > N_SECTIONS) return T_OUTRO_START;
  return crossingTime(n - 1);
}

export function sectionEnd(n) {
  if (n <= 0) return T_INTRO;
  if (n > N_SECTIONS) return DURATION;
  return crossingTime(n);
}

/** Which part of the film owns time t: 0 = intro, 1..20 = sections, 21 = outro. */
export function sectionAt(t) {
  if (t < T_INTRO) return 0;
  if (t >= T_OUTRO_START) return N_SECTIONS + 1;
  return Math.min(N_SECTIONS, 1 + Math.floor((t - T_INTRO) / T_SECTION));
}

/** Seconds since section n began (negative before it, > 6 after it). */
export const localTime = (t, n) => t - sectionStart(n);

/** Global musical position. Integers are downbeats (bar lines). */
export const barAt = (t) => (t - PICKUP) / BAR;
export const beatAt = (t) => (t - PICKUP) / BEAT;

/** Time of the nearest beat at or before t. */
export const lastBeatTime = (t) => PICKUP + Math.floor(beatAt(t)) * BEAT;

/** Seconds elapsed since the most recent beat / downbeat. */
export const sinceBeat = (t) => t - lastBeatTime(t);
export const sinceBar = (t) => t - (PICKUP + Math.floor(barAt(t)) * BAR);

/** True when time t lies on a bar line (within eps seconds). */
export function isDownbeat(t, eps = 1e-6) {
  const b = barAt(t);
  return Math.abs(b - Math.round(b)) * BAR < eps;
}

/**
 * Quantise a time to a fixed update rate, for sections whose internal
 * animation should step (shadow puppets, 8-bit sprites, GIF frames).
 * Camera and road scrolling must keep using the unquantised time.
 */
export const stepTime = (t, hz) => Math.floor(t * hz + 1e-9) / hz;

/** Format seconds as m:ss.cc for labels. */
export function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? "0" : ""}${s.toFixed(2)}`;
}
