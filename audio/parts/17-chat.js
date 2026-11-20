// Section 17 (chat): the tune as somebody's ring-tone, around 2003.
//
// A plinky two-operator FM lead plays the tune an octave up; a thin hollow
// voice keeps the harmony in eighths; a rubbery FM bass walks the roots. The
// drum kit is the (invented) messenger program itself: its "message in" sound
// is the backbeat, its key tick the hi-hat. In bar 2 the typing notice goes
// out on the bar line and everything stops with it: half a bar of nothing.
// The notice comes back, the ring-tone picks up where it would have been
// (A, F#, a little quieter, ticks only); on the strong beat the other person
// sends a window shake: a rattling buzz of ten blips at twenty a second, an
// alert ping on every eighth, and the held E shakes with the window. At 4.0
// we type "?" into the box: one key going down and up, alone and louder, and
// the bicycle's chain rests on that beat. Bar 3 with the full kit; the bell
// takes the D. Dry and close, no reverb: a ring-tone stops when it stops.
//
// How the sounds are made (plain arithmetic, all computed in prepare()):
//   lead      2-operator FM, modulator at the carrier's frequency (so every
//             partial is a whole multiple); the index falls from 2.7 to 0.5 in
//             the first ~100 ms (bright start that dulls), the level decays
//             like a struck bar with a long soft tail
//   hollow    odd harmonics only (1, 1/3, 1/5 ...), a square with its top cut,
//             short decaying envelope
//   bass      FM, ratio 1, index 3.9 -> 0.9 in 50 ms, pitch falls 60 cents in
//             the first 12 ms (the rubber), one-pole lowpass
//   message   a soft unpitched wooden knock (two bands of noise, 10 ms decay)
//             on the beat, then two soft wooden FM notes (ratio 3.5, index
//             dying in 10 ms) falling a sixth: B6 at +35 ms, D6 70 ms later
//   tick      1.5 ms of band-passed noise and a 10 ms 2.6 kHz blip
//   "?" key   key down (a 7 kHz noise click and a 25 ms 2.3 kHz blip) and key
//             up 75 ms later (a smaller 4.5 kHz click)
//   nudge     ten blips, 20 a second, G#3 / D4 alternating (a tritone), each
//             0.84 of the one before: harmonics at 1/k up to 4 kHz, tapering
//             (raised cosine) to nothing at 6 kHz, lightly saturated
//   ping      a soft A6 sine with a trace of its third partial
// Every buffer begins and ends at zero.

import { sharedBuffer } from "../engine/kit.js";
import { SR, samples, white, biquad, onePole, fade, mixInto } from "../engine/dsp.js";
import { hz, midi, theme } from "../engine/theory.js";

const TAU = 2 * Math.PI;

// ---------------------------------------------------------------- sample makers

/** The ring-tone lead: two-operator FM. wobble(t) gives cents of pitch offset (the shaking E). */
function leadSamples(m, seconds = 1.6, wobble = null) {
  const n = samples(seconds);
  const y = new Float32Array(n);
  const f0 = hz(m);
  // keep the top partials under ~9 kHz for high notes
  const scale = Math.min(1, 1500 / f0);
  let ph = 0;
  let cents = 0;
  const slew = 1 - Math.exp(-1 / (0.003 * SR)); // pitch steps glide over ~3 ms
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    if (wobble) cents += slew * (wobble(t) - cents);
    const f = wobble ? f0 * 2 ** (cents / 1200) : f0;
    ph += f / SR;
    if (ph >= 1) ph -= 1;
    const idx = scale * (0.5 + 2.2 * Math.exp(-t / 0.035));
    const amp = (1 - Math.exp(-t / 0.0015)) * (0.6 * Math.exp(-t / 0.12) + 0.4 * Math.exp(-t / 1.5));
    y[i] = amp * Math.sin(TAU * ph + idx * Math.sin(TAU * ph));
  }
  return fade(y, 0.001, 0.02);
}

/** The window shake's table (chat.js SHAKE_DX), one step every 50 ms from u = 3.0. */
const SHAKE_DX = [-6, 6, -5, 5, -4, 4, -3, 2, -2, 1];
/** The held E's wobble: 15 cents per 6 units of window jump, so +-15 cents at first. */
const shakeCents = (t) => {
  const k = Math.floor(t * 20 + 1e-9);
  return k < SHAKE_DX.length ? (15 * SHAKE_DX[k]) / 6 : 0;
};

/** The thin second voice: odd harmonics only, a hollow square-ish tone. */
function hollowSamples(m, seconds = 0.26) {
  const n = samples(seconds);
  const y = new Float32Array(n);
  const f0 = hz(m);
  const parts = [];
  for (let k = 1; k <= 9 && k * f0 < 5000; k += 2) parts.push([k, 1 / k]);
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    let v = 0;
    for (const [k, a] of parts) v += a * Math.sin(TAU * k * f0 * t);
    const amp = (1 - Math.exp(-t / 0.002)) * (0.45 + 0.55 * Math.exp(-t / 0.06));
    y[i] = amp * v;
  }
  return fade(onePole(y, 3500), 0.001, 0.015);
}

/** The rubbery FM bass. */
function bassSamples(m, seconds = 0.6) {
  const n = samples(seconds);
  const y = new Float32Array(n);
  const f0 = hz(m);
  let ph = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    const f = f0 * 2 ** ((60 * Math.exp(-t / 0.012)) / 1200);
    ph += f / SR;
    if (ph >= 1) ph -= 1;
    const idx = 0.9 + 3 * Math.exp(-t / 0.05);
    const amp = (1 - Math.exp(-t / 0.002)) * Math.exp(-t / 0.35);
    y[i] = amp * Math.sin(TAU * ph + idx * Math.sin(TAU * ph));
  }
  return fade(onePole(y, 1400), 0.001, 0.02);
}

/** One soft wooden FM note (carrier f, modulator 3.5 f, index gone in ~10 ms). */
function woodNote(f, seconds) {
  const n = samples(seconds);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    const idx = 1.4 * Math.exp(-t / 0.01);
    const amp = (1 - Math.exp(-t / 0.001)) * Math.exp(-t / 0.045);
    y[i] = amp * Math.sin(TAU * f * t + idx * Math.sin(TAU * 3.5 * f * t));
  }
  return fade(y, 0.002, 0.01);
}

/** A soft unpitched wooden knock: two bands of noise (a hollow body and its rap), 10 ms decay. */
function knockSamples(seconds = 0.06) {
  const n = samples(seconds);
  const body = biquad(white(n, 1733), "bandpass", 1100, 1.3);
  const rap = biquad(white(n, 1734), "bandpass", 2700, 1.6);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    y[i] = (1 - Math.exp(-t / 0.0008)) * (body[i] * Math.exp(-t / 0.01) + 0.5 * rap[i] * Math.exp(-t / 0.004));
  }
  return fade(y, 0.002, 0.01);
}

/** "Message in": a soft wooden knock on the beat, then two wooden notes falling a sixth, B6 then D6, 70 ms apart. */
const MSG_KNOCK_TO_NOTE = 0.035;
function messageSamples() {
  const y = new Float32Array(samples(0.38));
  mixInto(y, knockSamples(), 0, 2.2);
  mixInto(y, woodNote(hz(midi("B6")), 0.26), MSG_KNOCK_TO_NOTE, 0.85);
  mixInto(y, woodNote(hz(midi("D6")), 0.26), MSG_KNOCK_TO_NOTE + 0.07, 0.8);
  return fade(y, 0.002, 0.01);
}

/** The key tick: a tiny click and a 10 ms blip. */
function tickSamples() {
  const n = samples(0.02);
  const click = biquad(white(n, 1717), "bandpass", 6500, 1.4);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    const c = t < 0.0015 ? 1 - t / 0.0015 : 0;
    const blip = Math.sin(TAU * 2600 * t) * Math.exp(-t / 0.0028) * (t < 0.01 ? 1 : 0);
    y[i] = 0.9 * click[i] * c + 0.6 * blip;
  }
  return fade(y, 0.0003, 0.008);
}

/** The nudge's harmonic weights: 1/k up to 4 kHz, then a raised-cosine taper to nothing at 6 kHz. */
const NUDGE_FULL = 4000;
const NUDGE_TOP = 6000;
const nudgeWeight = (k, f) => {
  const fk = k * f;
  if (fk <= NUDGE_FULL) return 1 / k;
  if (fk >= NUDGE_TOP) return 0;
  return (0.5 + 0.5 * Math.cos((Math.PI * (fk - NUDGE_FULL)) / (NUDGE_TOP - NUDGE_FULL))) / k;
};
const NUDGE_DRIVE = 0.6;

/** The nudge: ten harsh blips, 20 a second, a tritone apart, each quieter than the last. */
function nudgeSamples() {
  const y = new Float32Array(samples(0.5));
  const lo = hz(midi("G#3"));
  const hi = hz(midi("D4"));
  for (let b = 0; b < 10; b += 1) {
    const f = b % 2 ? hi : lo;
    const len = 0.038;
    const n = samples(len);
    const x = new Float32Array(n);
    const ws = [];
    for (let k = 1; k * f < NUDGE_TOP; k += 1) ws.push([k, nudgeWeight(k, f)]);
    // a sawtooth-like sum peaks near 1.85: bring it to about 1 before a gentle saturation
    for (let i = 0; i < n; i += 1) {
      const t = i / SR;
      let v = 0;
      for (const [k, w] of ws) v += w * Math.sin(TAU * k * f * t);
      x[i] = Math.tanh((NUDGE_DRIVE * v) / 1.85) / Math.tanh(NUDGE_DRIVE);
    }
    fade(x, 0.002, 0.012);
    mixInto(y, x, b * 0.05, 0.84 ** b);
  }
  return fade(y, 0.002, 0.01);
}

/** Our "?": a key going down (a click and a 25 ms blip at 2.3 kHz) and coming up 75 ms later (a smaller, duller click). */
const KEY_UP = 0.075;
function questionSamples() {
  const n = samples(0.12);
  const down = biquad(white(n, 1741), "bandpass", 7000, 1.2);
  const up = biquad(white(n, 1742), "bandpass", 4500, 1.4);
  const y = new Float32Array(n);
  const clickEnv = (t) => (t < 0 ? 0 : t < 0.002 ? Math.sin((Math.PI * t) / 0.004) ** 2 : Math.exp(-(t - 0.002) / 0.0015));
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    // the blip rises in 2 ms, decays (7 ms), and is faded out smoothly between 20 and 25 ms
    const blipEnv = t < 0.002 ? Math.sin((Math.PI * t) / 0.004) ** 2 : Math.exp(-(t - 0.002) / 0.007);
    const blipEnd = t < 0.02 ? 1 : t < 0.025 ? 0.5 + 0.5 * Math.cos((Math.PI * (t - 0.02)) / 0.005) : 0;
    y[i] = 1.0 * down[i] * clickEnv(t) + 0.55 * Math.sin(TAU * 2300 * t) * blipEnv * blipEnd + 0.8 * up[i] * clickEnv(t - KEY_UP);
  }
  return fade(y, 0.002, 0.01);
}

/** The alert ping: one soft high sine. */
function pingSamples() {
  const n = samples(0.5);
  const y = new Float32Array(n);
  const f = hz(midi("A6"));
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    const amp = (1 - Math.exp(-t / 0.003)) * Math.exp(-t / 0.09);
    y[i] = amp * (Math.sin(TAU * f * t) + 0.08 * Math.sin(TAU * 3 * f * t) * Math.exp(-t / 0.03));
  }
  return fade(y, 0.002, 0.02);
}

// ---------------------------------------------------------------- buffers

const LEAD_LEN = 1.6;
const leadKey = (m) => `chat/lead/${m}`;
const leadBuf = (k, m) => k.buffer(leadKey(m), () => leadSamples(m, LEAD_LEN));
/** The pitches of D major from D3 to D7, for the outro's calls. */
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const LEAD_RANGE = [];
for (let m = 50; m <= 98; m += 1) if (MAJOR.includes((((m - 62) % 12) + 12) % 12)) LEAD_RANGE.push(m);

const vol = (ev) => (ev.vel === undefined ? 1 : ev.vel);

// ---------------------------------------------------------------- instruments

/** The ring-tone lead. The part's own voice in the outro, too. */
function ringtone(k, g, when, ev) {
  const buf = leadBuf(k, ev.midi);
  const dur = Math.min(Math.max(0.06, ev.dur || 0.5), LEAD_LEN - 0.02);
  k.play(buf, when, { dur, fade: Math.min(0.02, dur / 3), gain: 0.3 * vol(ev) }, g.bus || g.out);
}

/** The held E that shakes with the window. */
function shakenE(k, g, when, ev) {
  const buf = k.buffer("chat/lead/shake", () => leadSamples(ev.midi, 1.1, shakeCents));
  k.play(buf, when, { dur: ev.dur, fade: 0.02, gain: 0.3 * vol(ev) }, g.bus || g.out);
}

function hollow(k, g, when, ev) {
  const buf = k.buffer(`chat/hollow/${ev.midi}`, () => hollowSamples(ev.midi));
  k.play(buf, when, { dur: ev.dur, fade: 0.02, gain: 0.14 * vol(ev), pan: 0.15 }, g.bus || g.out);
}

function bass(k, g, when, ev) {
  const buf = k.buffer(`chat/bass/${ev.midi}`, () => bassSamples(ev.midi));
  k.play(buf, when, { dur: ev.dur, fade: 0.025, gain: 0.19 * vol(ev) }, g.bus || g.out);
}

function message(k, g, when, ev) {
  k.play(k.buffer("chat/message", messageSamples), when, { gain: 0.19 * vol(ev), pan: -0.1 }, g.bus || g.out);
}

function tick(k, g, when, ev) {
  k.play(k.buffer("chat/tick", tickSamples), when, { gain: 0.11 * vol(ev), pan: 0.1 }, g.bus || g.out);
}

function nudge(k, g, when, ev) {
  k.play(k.buffer("chat/nudge", nudgeSamples), when, { gain: 0.205 * vol(ev) }, g.bus || g.out);
}

function questionKey(k, g, when, ev) {
  k.play(k.buffer("chat/question", questionSamples), when, { gain: 0.2 * vol(ev), pan: 0.1 }, g.bus || g.out);
}

function ping(k, g, when, ev) {
  k.play(k.buffer("chat/ping", pingSamples), when, { gain: 0.085 * vol(ev), pan: 0.05 }, g.bus || g.out);
}

// ---------------------------------------------------------------- the part

export default {
  async prepare() {
    for (const m of LEAD_RANGE) sharedBuffer(leadKey(m), () => leadSamples(m, LEAD_LEN));
    sharedBuffer("chat/lead/shake", () => leadSamples(midi("E5"), 1.1, shakeCents));
    for (const nm of ["D4", "E4", "F#4", "G4", "A4", "B4", "C#4"]) sharedBuffer(`chat/hollow/${midi(nm)}`, () => hollowSamples(midi(nm)));
    for (const nm of ["D2", "F#2", "G2", "A2"]) sharedBuffer(`chat/bass/${midi(nm)}`, () => bassSamples(midi(nm)));
    sharedBuffer("chat/message", messageSamples);
    sharedBuffer("chat/tick", tickSamples);
    sharedBuffer("chat/nudge", nudgeSamples);
    sharedBuffer("chat/ping", pingSamples);
    sharedBuffer("chat/question", questionSamples);
  },

  graph(k, out) {
    const bus = k.gain(0.56);
    bus.connect(out);
    return { bus };
  },

  score(s) {
    // ---- the lead: the tune an octave up, every note the same loudness
    for (const note of theme({ octave: 1 })) {
      if (note.u === 2.0) continue; // the typing notice goes out: the top note is not played
      const quiet = note.u === 2.5 || note.u === 2.75;
      if (note.u === 3.0) {
        s.note(shakenE, 3.0, 0.98, note.midi, 1, { lead: true, free: true, label: "lead shaken E" });
        continue;
      }
      // bar 1 lets go before the bar line, so that 2.0-2.5 is silent; the last note before the bell
      const end = note.u === 1.75 ? 1.98 : note.u === 5.75 ? 5.94 : note.u + note.dur - 0.03;
      s.note(ringtone, note.u, end - note.u, note.midi, quiet ? 0.75 : 1, { lead: true, label: "lead" });
    }

    // ---- the hollow voice: chord tones in eighths (bar 1 and bar 3 from beat 2)
    const H = (u, nm) => s.note(hollow, u, 0.18, midi(nm), 1, { label: "hollow" });
    ["F#4", "A4", "F#4", "A4", "F#4", "A4", "F#4", "A4"].forEach((nm, i) => H(i * 0.25, nm)); // D
    ["A4", "F#4"].forEach((nm, i) => H(4.5 + i * 0.25, nm)); // D/F#
    ["G4", "D4"].forEach((nm, i) => H(5.0 + i * 0.25, nm)); // G
    ["E4", "C#4"].forEach((nm, i) => H(5.5 + i * 0.25, nm)); // A

    // ---- the bass: roots in the long-short-short of the pedals
    const B = (u, d, nm) => s.note(bass, u, d, midi(nm), 1, { label: "bass" });
    B(0, 0.45, "D2");
    B(0.5, 0.2, "D2");
    B(0.75, 0.2, "D2");
    B(1.0, 0.45, "D2");
    B(1.5, 0.2, "D2");
    B(1.75, 0.2, "D2");
    B(4.5, 0.2, "F#2");
    B(4.75, 0.2, "F#2");
    B(5.0, 0.45, "G2");
    B(5.5, 0.2, "A2");
    B(5.75, 0.18, "A2");

    // ---- the program's sounds as the kit
    const T = (u, vel = 1) => s.at(u, tick, { dur: 0.02, vel, label: "tick" });
    const M = (u) => s.at(u, message, { dur: 0.34, vel: 1, label: "message in" });
    for (let i = 0; i < 8; i += 1) T(i * 0.25, i % 2 ? 0.7 : 1);
    M(0.5);
    M(1.5);
    T(2.5);
    T(2.75, 0.7);
    s.at(3.0, nudge, { dur: 0.5, vel: 1, label: "nudge" });
    for (const u of [3.0, 3.25, 3.5, 3.75]) s.at(u, ping, { dur: 0.5, vel: 1, label: "ping" });
    s.at(4.0, questionKey, { dur: 0.12, vel: 1, label: "question key" }); // our "?": key down and up, alone; the chain rests
    for (let i = 0; i < 6; i += 1) T(4.5 + i * 0.25, i % 2 ? 0.7 : 1);
    M(4.5);
    M(5.5);

    s.cue(0, "the chat window comes through the frame");
    s.cue(2.5, "the typing notice comes back");
    s.cue(3.0, "window shake: the nudge", { band: [150, 450] });
    s.cue(4.0, "we type ? : one key tick", { band: [5000, 12000] });
  },

  lead: ringtone,
  leadOctave: 1,
  // the chain rests on the beat of our "?" (u = 4.0), so that the key stands alone
  bike: { bell: 1, chain: (u) => (Math.abs(u - 4) < 0.06 ? 0 : 0.8) },
};
