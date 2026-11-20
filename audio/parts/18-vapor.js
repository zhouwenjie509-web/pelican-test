// Section 18 (vapor): slowed-down 1980s shopping-mall cassette music.
//
// Two stages, as the owner asks.
//
// 1. The source. An original piece of mall smooth jazz in F# major (the film's
//    D plus four semitones) at 151.2 BPM: an FM electric piano on major-seventh
//    and minor-ninth chords, a fretless bass, an FM saxophone on a relaxed
//    variation of the tune, and soft drums whose snare goes through a gated
//    room. It is rendered once, in prepare(), on our own OfflineAudioContext
//    with a Kit of its own, and kept as an AudioBuffer (putBuffer).
//
// 2. The tape. The section plays that buffer at playbackRate 0.7937, which
//    brings it down four semitones to D and back to 120 BPM: one source beat
//    lasts half a second of film, so the tape is on the film's grid. Source
//    position for film time u in steady play: p(u) = LEAD + 0.7937 u. The tape
//    goes through a 4 kHz low-pass into a dry path and a long, wet room (its
//    send high-passed at 200 Hz); one 0.5 Hz sine wobbles the detune of every
//    tape source (+-10 cents; the tune's marker notes carry tol: 25 so that the
//    checker allows a voice that wobbles on purpose); a little hiss sits under it.
//
//    u 0.0-0.8   the tape slows from 1.0 to 0.7937 (it arrives fast and bright
//                and sinks); it starts early by exactly the surplus it uses,
//                so that from u = 0.8 on its position is p(u). The source's
//                first downbeat is pushed early by the same surplus, so that it
//                sounds at u = 0 with the bell.
//    u 3.0-4.0   the skip: the half beat of source p(3.0)..p(3.25) four times; the
//                room's send is ducked and the dry tape comes up (u 2.98-4.0), so
//                that each restart is heard
//    u 4.0       playback resumes at p(4.0), jumping forward with the picture
//    u 5.2-6.0   the tape speeds up and reaches 1.0 exactly at u = 6.0, then stops
//
//    The two changing-speed stretches are resampled from the source in
//    prepare() and played at rate 1; every other stretch plays the source at a
//    constant playbackRate 0.7937. (A buffer source reads playbackRate once per
//    128-sample block, so a rate curve would land differently live and offline.)

import { Kit, putBuffer, getBuffer, hasBuffer, prepareReverb } from "../engine/kit.js";
import { hz } from "../engine/theory.js";
import { SR } from "../engine/dsp.js";

// ---------------------------------------------------------------- the numbers

/** The tape's steady speed (four semitones down, as the owner gives it). */
const R = 0.7937;
/** The source's beat: 151.2 BPM. One source beat / R = 0.49997 s of film. */
const SB = 60 / 151.2;
/** Source time of the tune's first beat: one bar of lead-in before it. */
const LEAD = 4 * SB;
/** The slide in (u 0..SLOW) and the run-up (u RISE..6). */
const SLOW = 0.8;
const RISE = 5.2;
/**
 * Rate during the slide: R + (1 - R)(1 - u/SLOW)^3 (a motor settling: most of
 * the drop at once, then easing in). The source it uses beyond R u:
 * the integral of (1 - R)(1 - u/SLOW)^3 over 0..SLOW = (1 - R) SLOW / 4.
 * The run-up mirrors it: R + (1 - R)((u - RISE)/0.8)^3.
 */
const SURPLUS = ((1 - R) * SLOW) / 4;
/** Where the source is rendered and kept. */
const SRC_KEY = "vapor/source";
const SRC_SECONDS = LEAD + 16 * SB + 1.0;
/** The tape room. */
const HALL = { seconds: 4.2, t60: 3.4, bright: 0.3, predelay: 0.03, early: 0.08, seed: 18 };
/** The snare's gated room (inside the source). */
const GATE_ROOM = { seconds: 0.5, t60: 1.6, bright: 0.55, predelay: 0.004, early: 0.4, seed: 81 };

/** Levels of the tape (set by measurement against the -19 LUFS target). */
const DRY = 0.186;
const SEND = 0.38;
const WOBBLE_CENTS = 10;
const HISS = 0.0078;
/**
 * During the skip (u 2.98-4.0): the room's send is ducked to SKIP_SEND, and the dry tape
 * comes up by SKIP_LIFT x DRY above 200 Hz, the band the room took away (its send is
 * high-passed there), so that the low end, and the kick, stay where they were.
 */
const SKIP_SEND = 0.1;
const SKIP_LIFT = 1.5;

/** Tape speed at film time u (posA and posB are its integrals). */
export function rateAt(u) {
  if (u < SLOW) return R + (1 - R) * (1 - Math.max(0, u) / SLOW) ** 3;
  if (u < RISE) return R;
  if (u < 6) return R + (1 - R) * ((u - RISE) / (6 - RISE)) ** 3;
  return 1;
}

/** Steady source position. */
const p = (u) => LEAD + R * u;

/** Source position of the first stretch of tape (from u = 0, through the slide). */
function posA(u) {
  const x = Math.min(Math.max(u, 0), SLOW) / SLOW;
  return LEAD - SURPLUS + R * u + SURPLUS * (1 - (1 - x) ** 4);
}

/** Source position of the last stretch (from p(4.0), through the run-up). */
function posB(u) {
  const x = Math.min(Math.max(u - RISE, 0), 6 - RISE) / (6 - RISE);
  return p(u) + SURPLUS * x ** 4;
}

// ---------------------------------------------------------------- the instruments (used in the source)

/** Where an instrument plays into: its own bus if the graph has one, else out. */
const dest = (g, name) => g[name] || g.out;

/**
 * FM saxophone: a sine carrier modulated at 1:1 (all harmonics, brighter as it
 * is blown harder) plus a little 3:1 for the reed's edge; breath noise in the
 * attack; a body resonance near 1.1 kHz; vibrato that arrives late; optional
 * scoop up into the note (ev.scoop cents) and fall at its end (ev.fall cents).
 * Also the section's `lead` for the outro (written pitch).
 */
export function sax(k, g, when, ev) {
  const f = hz(ev.midi);
  const vel = ev.vel === undefined ? 0.8 : ev.vel;
  const dur = Math.max(0.08, ev.dur);
  const rel = 0.02; // monophonic: the release (25 ms of film through the tape) is the only overlap with the next note
  const stop = when + dur + rel + 0.02;
  const car = k.osc("sine", f, when, stop);
  const m1 = k.osc("sine", f, when, stop);
  const m3 = k.osc("sine", 3 * f, when, stop);
  const d1 = k.gain(0);
  const d3 = k.gain(0);
  m1.connect(d1).connect(car.frequency);
  m3.connect(d3).connect(car.frequency);
  const I = 0.55 + 0.55 * vel;
  // ev.short (set only inside the source, for the quarter-beat notes of about 0.09 s): the same
  // shapes with every breakpoint inside the note, so none lies after its end. The outro's `lead`
  // never sets it and plays exactly as before.
  const short = !!ev.short;
  if (short) {
    k.env(d1.gain, when, [[0, 0.4 * f], [0.045, I * f], [dur, 0.85 * I * f], [dur + rel, 0.3 * f]]);
    k.env(d3.gain, when, [[0, 0], [0.03, 0.25 * 3 * f], [dur, 0.12 * 3 * f], [dur + rel, 0.05 * 3 * f]]);
  } else {
    k.env(d1.gain, when, [[0, 0.4 * f], [0.045, I * f], [0.16, 0.85 * I * f], [dur, 0.8 * I * f], [dur + rel, 0.3 * f]]);
    k.env(d3.gain, when, [[0, 0], [0.03, 0.25 * 3 * f], [0.15, 0.12 * 3 * f], [dur + rel, 0.05 * 3 * f]]);
  }

  // pitch: scoop, vibrato, fall (cents, on every oscillator)
  const pitch = k.constant(0, when, stop);
  for (const o of [car, m1, m3]) pitch.connect(o.detune);
  const scoop = ev.scoop || 0;
  const pts = [[0, scoop], [0.045, 0]];
  if (ev.fall && short) pts.push([Math.max(0.05, dur - 0.04), 0], [dur + rel, ev.fall]);
  else if (ev.fall) pts.push([Math.max(0.1, dur - 0.12), 0], [dur + rel, ev.fall]);
  k.env(pitch.offset, when, pts);
  if (dur > 0.3) {
    // vibrato arrives late: nothing for the first 0.18 s, then it grows
    const vib = k.osc("sine", 5.1, when, stop);
    const depth = k.gain(0);
    vib.connect(depth);
    for (const o of [car, m1, m3]) depth.connect(o.detune);
    k.env(depth.gain, when, [[0, 0], [0.18, 0], [0.6, 16], [Math.max(dur + rel, 0.61), 16]]);
  }

  const body = k.filter("peaking", 1150, 1.1, 3);
  const lp = k.filter("lowpass", 4200, 0);
  const amp = k.gain(0);
  car.connect(body).connect(lp).connect(amp);
  if (short) k.env(amp.gain, when, [[0, 0], [0.03, 0.42 * vel], [dur, 0.36 * vel], [dur + rel, 0]]);
  else k.env(amp.gain, when, [[0, 0], [0.035, 0.42 * vel], [0.12, 0.36 * vel], [dur, 0.34 * vel], [dur + rel, 0]]);

  // breath: a puff in the attack and a trace under the tone
  const breath = k.noise("white", when, stop, { phase: (ev.midi * 0.37) % 5, seed: 18 });
  const bp = k.filter("bandpass", 2300, 1.3);
  const bg = k.gain(0);
  breath.connect(k.filter("highpass", 1000, 0)).connect(k.filter("highpass", 1000, 0)).connect(bp).connect(bg).connect(amp);
  k.env(bg.gain, when, [[0, 0], [0.012, 0.5], [0.07, 0.12], [dur, 0.08], [dur + rel, 0]]);
  amp.connect(dest(g, "sax"));
}

/**
 * FM electric piano, one note: a sine carrier with a 1:1 modulator whose index
 * falls fast (the bright, bell-like strike softening into a round tone) and a
 * 14:1 modulator that lasts a few milliseconds (the tine's ping). Decays like a
 * struck tine; released at the end of the note.
 */
function epiano(k, g, when, ev) {
  const f = hz(ev.midi);
  const vel = ev.vel === undefined ? 0.7 : ev.vel;
  const dur = ev.dur;
  const rel = 0.22;
  const stop = when + dur + rel + 0.02;
  const car = k.osc("sine", f, when, stop);
  const m1 = k.osc("sine", f, when, stop);
  const m2 = k.osc("sine", 14 * f, when, stop);
  const d1 = k.gain(0);
  const d2 = k.gain(0);
  m1.connect(d1).connect(car.frequency);
  m2.connect(d2).connect(car.frequency);
  k.env(d1.gain, when, [[0, 1.6 * vel * f], [0.25, 0.45 * vel * f, "exp"], [dur + rel, 0.25 * vel * f, "exp"]]);
  k.env(d2.gain, when, [[0, 0.5 * vel * f], [0.04, 0.01 * f, "exp"], [0.06, 0]]);
  const amp = k.gain(0);
  const tau = 1.6 * (55 / ev.midi) ** 2;
  const atEnd = 0.2 * vel * Math.exp(-dur / tau);
  k.env(amp.gain, when, [[0, 0], [0.003, 0.2 * vel], [dur, Math.max(atEnd, 1e-4), "exp"], [dur + rel, 0]]);
  car.connect(amp).connect(dest(g, "piano"));
}

/**
 * Fretless bass: four harmonics through a closing low-pass, plucked (it
 * decays from the attack), sliding up into its note from ev.slide cents below,
 * with a slow vibrato on long notes.
 */
function fretless(k, g, when, ev) {
  const f = hz(ev.midi);
  const vel = ev.vel === undefined ? 0.8 : ev.vel;
  const dur = ev.dur;
  const rel = 0.1;
  const stop = when + dur + rel + 0.02;
  // the first four harmonics only: a round fretless tone, with nothing as high as a third two octaves up
  const s1 = k.osc(k.wave("vapor/fretless", [0, 1, 0.42, 0.2, 0.08]), f, when, stop);
  const pitch = k.constant(0, when, stop);
  pitch.connect(s1.detune);
  k.env(pitch.offset, when, [[0, -(ev.slide || 0)], [0.01, -(ev.slide || 0)], [0.02, 0, ["target", 0.03]]]);
  if (dur > 0.5) {
    const vib = k.osc("sine", 4.6, when, stop);
    const depth = k.gain(0);
    vib.connect(depth);
    depth.connect(s1.detune);
    k.env(depth.gain, when, [[0, 0], [0.35, 0], [Math.min(dur, 0.8), 12], [dur + rel, 12]]);
  }
  const lp = k.filter("lowpass", 900, 1);
  k.env(lp.frequency, when, [[0, 1000], [0.25, 420, "exp"], [dur + rel, 330, "exp"]]);
  s1.connect(lp);
  const amp = k.gain(0);
  k.env(amp.gain, when, [[0, 0], [0.02, 0.32 * vel], [dur, 0.32 * vel * Math.exp(-dur / 0.45), "exp"], [dur + rel, 0]]);
  lp.connect(amp).connect(dest(g, "bass"));
}

/** Soft kick: a sine falling from 150 to 52 Hz, its head firm and its body short. */
function kick(k, g, when, ev) {
  const vel = ev.vel === undefined ? 0.8 : ev.vel;
  const o = k.osc("sine", 52, when, when + 0.2);
  k.env(o.frequency, when, [[0, 150], [0.05, 52, "exp"]]);
  const amp = k.gain(0);
  k.env(amp.gain, when, [[0, 0], [0.0015, 1.7 * vel], [0.035, 0.6 * vel], [0.09, 0.14 * vel], [0.17, 0]]);
  o.connect(amp).connect(dest(g, "drums"));
}

/** Snare on 2 and 4: noise and a body tone, sent into the gated room. */
function snare(k, g, when, ev) {
  const vel = ev.vel === undefined ? 0.8 : ev.vel;
  const n = k.noise("white", when, when + 0.2, { phase: 1.3 + ev.u * 0.1, seed: 5 });
  const bp = k.filter("bandpass", 1900, 0.8);
  const ng = k.gain(0);
  n.connect(bp).connect(ng);
  k.env(ng.gain, when, [[0, 0], [0.002, 0.35 * vel], [0.05, 0.1 * vel], [0.18, 0]]);
  const body = k.osc("sine", 190, when, when + 0.15);
  const bg = k.gain(0);
  body.connect(bg);
  k.env(bg.gain, when, [[0, 0], [0.002, 0.3 * vel], [0.12, 0]]);
  const mix = k.gain(1);
  ng.connect(mix);
  bg.connect(mix);
  mix.connect(dest(g, "drums"));
  mix.connect(g.gateIn);
  // the gate: open with the hit, cut off abruptly 150 ms later
  k.env(g.gate.gain, when, [[0, 0, "set"], [0.003, 1], [0.15, 1], [0.156, 0]]);
}

/** Closed hat: a tick of high noise. */
function hat(k, g, when, ev) {
  const vel = ev.vel === undefined ? 0.5 : ev.vel;
  const n = k.noise("white", when, when + 0.06, { phase: 2.7 + ev.u * 0.07, seed: 6 });
  const hp = k.filter("highpass", 7000, 0);
  const amp = k.gain(0);
  n.connect(hp).connect(amp);
  k.env(amp.gain, when, [[0, 0], [0.001, 0.1 * vel], [0.04, 0]]);
  amp.connect(dest(g, "hats"));
}

// ---------------------------------------------------------------- the source piece

/** Source time of tune beat b (beat 0 is the tune's first beat). The first downbeat is pushed by SURPLUS: see sourceEvents. */
const st = (b) => (b === 0 ? LEAD - SURPLUS : LEAD + b * SB);

/** The chords, in F#: [beat, beats, name, voicing]. */
const CHORDS = [
  [-4, 2, "G#m9", [54, 58, 59, 63]],
  [-2, 2, "C#13", [53, 58, 59, 63]],
  [0, 1.5, "F#maj7", [53, 58, 61]],
  [2, 1.5, "D#m9", [54, 58, 61, 65]],
  [3.5, 2.5, "Bmaj7", [51, 54, 58, 63]], // pushed half a beat ahead of bar 2
  [6, 1, "G#m9", [54, 58, 59, 63]],
  [7, 1, "C#9sus", [54, 56, 59, 63]],
  [8, 1, "A#m7", [53, 56, 58, 61]],
  [9, 1, "D#m7", [51, 54, 58, 61]],
  [10, 1, "G#m9", [51, 54, 58, 59]],
  [11, 2.5, "C#13", [53, 58, 59]],
];

/** Fretless bass: [beat, beats, midi, slide cents]. */
const BASS = [
  [-4, 2, 44, 0],
  [-2, 2, 37, 100],
  [0, 1.85, 42, 0],
  [2, 1.4, 39, 100],
  [3.5, 0.45, 51, 0],
  [4, 1.9, 47, 100],
  [6, 1, 44, 0],
  [7, 0.95, 37, 200],
  [8, 0.95, 46, 0],
  [9, 0.95, 39, 100],
  [10, 0.95, 44, 0],
  [11, 2.5, 37, 100],
];

/**
 * The saxophone's variation of the tune, written in D (the film's key):
 * [beat, beats, midi]. The six skeleton notes (beats 0, 2, 4, 6, 8, 10) stay on
 * their beats; between them it plays its own line:
 *   beats 1-2   E (1/2), F# (1/4), G (1/4)   a passing note up into the A
 *   beats 3-4   F# E F# A (1/4 each)         a turn that climbs into the B
 *   beats 4-6   B held 1 1/2, then A F# (1/4 each) falling onto the E
 *   beat 6      E (2), as the tune: the skip repeats its attack
 *   beats 8-9   F# (3/4), A (1/4)            an escape note up
 *   beats 9-12  E D | B, A, B, as the tune
 */
const VARIATION = [
  [0, 1, 62], [1, 0.5, 64], [1.5, 0.25, 66], [1.75, 0.25, 67],
  [2, 1, 69], [3, 0.25, 66], [3.25, 0.25, 64], [3.5, 0.25, 66], [3.75, 0.25, 69],
  [4, 1.5, 71], [5.5, 0.25, 69], [5.75, 0.25, 66],
  [6, 2, 64], [8, 0.75, 66], [8.75, 0.25, 69], [9, 0.5, 64], [9.5, 0.5, 62],
  [10, 1, 59], [11, 0.5, 57], [11.5, 0.5, 59],
];
const SKELETON = [0, 2, 4, 6, 8, 10];

/**
 * The variation in the source's key (F#: the film's D plus four semitones, as
 * theme({ tonic: 66 }) transposes). The skeleton notes stay on their beats; the
 * notes between sit a little behind; quarter-beat notes are lighter; the top of
 * the tune is scooped into and the last note before the held E falls off.
 */
function saxLine() {
  const out = [];
  for (const [beat, beats, midiD] of VARIATION) {
    const skeleton = SKELETON.includes(beat);
    const late = skeleton ? 0 : 0.012;
    const more = {};
    if (beat === 2) more.scoop = -35;
    if (beat === 4) more.scoop = -35;
    if (beat === 5.75) more.fall = -40;
    if (beat === 8) more.scoop = -30;
    if (beats < 0.5) more.short = true;
    const legato = beats >= 1 ? 0.92 : 0.97;
    const vel = skeleton ? 0.85 : beats < 0.5 ? 0.6 : 0.68;
    out.push({ b: beat, late, beats: beats * legato, midi: midiD + 4, vel, ...more });
  }
  // one saxophone: a note's sustain ends by the next onset, so only its 20 ms release overlaps
  for (let i = 0; i + 1 < out.length; i += 1) {
    const room = out[i + 1].b - out[i].b + (out[i + 1].late - out[i].late) / SB;
    out[i].beats = Math.min(out[i].beats, room);
  }
  return out;
}

/** Everything in the source, in source seconds: [time, instrument, data]. */
function sourceEvents() {
  const ev = [];
  for (const [b, beats, , voicing] of CHORDS) {
    voicing.forEach((m, i) => ev.push([st(b) + i * 0.004, epiano, { midi: m, dur: beats * SB, vel: 0.62 + 0.04 * (i % 2), u: b }]));
  }
  for (const [b, beats, m, slide] of BASS) ev.push([st(b), fretless, { midi: m, dur: beats * SB, vel: 0.8, slide, u: b }]);
  for (const n of saxLine()) ev.push([st(n.b) + n.late, sax, { midi: n.midi, dur: n.beats * SB, vel: n.vel, scoop: n.scoop, fall: n.fall, short: n.short, u: n.b }]);
  for (let b = -4; b <= 11; b += 1) {
    const inBar = ((b % 4) + 4) % 4;
    if (inBar === 0 || inBar === 2) ev.push([st(b), kick, { vel: inBar === 0 ? 0.9 : 0.75, u: b }]);
    if (inBar === 1 || inBar === 3) ev.push([st(b), snare, { vel: 0.7, u: b }]);
    for (const h of [0, 0.5]) ev.push([st(b + h) + (h ? 0.012 : 0), hat, { vel: h ? 0.75 : 0.45, u: b + h }]);
  }
  return ev;
}

/** Render the source piece on its own OfflineAudioContext. */
async function renderSource() {
  const sr = 48000;
  const ac = new OfflineAudioContext({ numberOfChannels: 2, length: Math.round(SRC_SECONDS * sr), sampleRate: sr });
  const k = new Kit(ac);
  const out = k.gain(1);
  out.connect(ac.destination);
  const bus = (pan, level) => {
    const gn = k.gain(level);
    gn.connect(k.pan(pan)).connect(out);
    return gn;
  };
  const g = {
    out,
    piano: bus(-0.3, 1),
    sax: bus(0.18, 1.19),
    bass: bus(0, 1),
    drums: bus(0, 1),
    hats: bus(0.35, 1),
  };
  // the gated room: snare -> room -> gate (opened 150 ms per hit) -> out
  g.gateIn = k.gain(0.5);
  g.gate = k.gain(0);
  g.gateIn.connect(k.reverb("vapor/gateroom", GATE_ROOM)).connect(g.gate).connect(out);

  for (const [t, inst, data] of sourceEvents()) inst(k, g, t, data);
  const buf = await ac.startRendering();
  // level the source: peak 0.8
  let peak = 0;
  for (let c = 0; c < 2; c += 1) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i += 1) peak = Math.max(peak, Math.abs(d[i]));
  }
  const gain = peak > 0 ? 0.8 / peak : 1;
  const chans = [0, 1].map((c) => {
    const d = buf.getChannelData(c);
    const y = new Float32Array(d.length);
    for (let i = 0; i < d.length; i += 1) y[i] = d[i] * gain;
    return y;
  });
  putBuffer(SRC_KEY, chans);
}

// ---------------------------------------------------------------- the tape (the section)

/**
 * The two stretches where the tape changes speed, computed once from the
 * source: the slide in (film u 0..0.81, source position posA) and the run-up
 * (film u 5.15..6.04, posB, at full speed after 6.0). Each is a buffer in film
 * time, played at rate 1, so no rate automation is needed while playing.
 * (An AudioBufferSourceNode reads playbackRate once per 128-sample block, so a
 * rate curve lands differently live and offline; constant rates are exact.)
 * Four-point (Catmull-Rom) interpolation; the rate never exceeds 1, so
 * nothing aliases.
 */
const SLIDE_KEY = "vapor/slide";
const RUNUP_KEY = "vapor/runup";
const SLIDE = [0, 0.82];
const RUNUP = [5.15, 6.04];
function resample(buf, pos, [u0, u1]) {
  const n = Math.round((u1 - u0) * SR);
  return [0, 1].map((c) => {
    const d = buf.getChannelData(c);
    const y = new Float32Array(n);
    for (let i = 0; i < n; i += 1) {
      const x = pos(u0 + i / SR) * SR;
      const j = Math.floor(x);
      const t = x - j;
      const a = d[j - 1] || 0;
      const b = d[j] || 0;
      const e = d[j + 1] || 0;
      const f = d[j + 2] || 0;
      y[i] = b + 0.5 * t * (e - a + t * (2 * a - 5 * b + 4 * e - f + t * (3 * (b - e) + f - a)));
    }
    return y;
  });
}

/**
 * How far the wobble has carried the tape between film u a and b, in seconds
 * of film-time tape (the integral of 2^(w/1200) - 1, w the wobble in cents).
 * The wobble's oscillator starts at u = -0.02 with phase 0.
 */
function drift(a, b) {
  const n = 200;
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    const u = a + ((i + 0.5) * (b - a)) / n;
    sum += 2 ** ((WOBBLE_CENTS * Math.sin(2 * Math.PI * 0.5 * (u + 0.02))) / 1200) - 1;
  }
  return (sum * (b - a)) / n;
}

/**
 * One stretch of tape, film u from ev.u to ev.u + ev.dur:
 *   "slide"  the slide in (computed buffer), u 0..0.806
 *   "A"      the source at 0.7937 from p(0.8) (plus the wobble's drift since u = 0), to 3.0
 *   "skip"   one block of the skip: the source at 0.7937 from p(3.0)
 *   "B"      the source at 0.7937 from p(4.0), to 5.206
 *   "runup"  the run-up (computed buffer), u 5.2..6.03
 * Every stretch begins and ends with a short fade; at 0.8 and 5.2 the two
 * stretches cross-fade over 6 ms on the same tape position. Seekable: started
 * late, a stretch computes where the tape would be.
 */
function tape(k, g, when, ev) {
  const off = ev.offset || 0;
  const at = (u) => when - off + (u - ev.u);
  const u0 = ev.u + off;
  const u1 = ev.u + ev.dur;
  if (u1 - u0 < 0.012) return;
  let buf;
  let pos;
  let rate = R;
  if (ev.seg === "slide") {
    buf = getBuffer(SLIDE_KEY);
    rate = 1;
    pos = u0 - SLIDE[0] + drift(0, u0);
  } else if (ev.seg === "runup") {
    buf = getBuffer(RUNUP_KEY);
    rate = 1;
    pos = u0 - RUNUP[0] + drift(4, u0);
  } else {
    buf = getBuffer(SRC_KEY);
    if (ev.seg === "A") pos = p(u0) + R * drift(0, u0);
    else if (ev.seg === "B") pos = p(u0) + R * drift(4, u0);
    else pos = ev.from + R * (u0 - ev.u);
  }
  if (!buf) return;
  const src = k.ac.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  g.wobble.connect(src.detune);
  const amp = k.gain(0);
  src.connect(amp).connect(g.tape);
  const fin = ev.fadeIn || 0.003;
  const fout = ev.fadeOut || 0.003;
  // never a negative time: started part-way at context time 0, `when - off + off` can come out a
  // hair below zero (-2e-16), and a raw start() or stop() refuses it
  const t0 = Math.max(0, at(u0));
  k.env(amp.gain, t0, [[0, 0], [fin, 1], [u1 - u0 - fout, 1], [u1 - u0, 0]]);
  src.start(t0, Math.max(0, pos));
  src.stop(Math.max(0, at(u1) + 0.005));
  k.track(src);
}

/** A sine wave of one cycle starting at phase ph (radians). */
function phasedSine(k, ph) {
  const q = Math.round((ph / (2 * Math.PI)) * 64) % 64;
  const a = (q / 64) * 2 * Math.PI;
  return k.wave(`vapor/lfo/${q}`, [0, Math.cos(a)], [0, Math.sin(a)]);
}

/**
 * The bed under the tape: the hiss, the wobble oscillator, and the room's
 * send and return (the send closes at u = 6, the return fades out by 7.5).
 * Begins at u = -0.02 so the hiss is there just before the tape.
 */
function bed(k, g, when, ev) {
  const off = ev.offset || 0;
  const base = when - off; // film u = -0.02
  const at = (u) => base + (u - ev.u);
  const start = at(ev.u + off);

  // wobble: 0.5 Hz, phase continuous from the event's start
  const lfo = k.osc(off > 0 ? phasedSine(k, 2 * Math.PI * 0.5 * off) : "sine", 0.5, start, at(6.1));
  lfo.connect(g.wobble);

  // hiss
  const h = k.noise("pink", start, at(6.1), { phase: 3.3 + off, seed: 19 });
  const hp = k.filter("highpass", 2500, 0);
  const lp = k.filter("lowpass", 9000, 0);
  const hg = k.gain(0);
  h.connect(hp).connect(lp).connect(hg).connect(g.out);
  k.env(hg.gain, base, [[0, 0], [0.02, HISS], [6.02, HISS], [6.09, 0]]);

  // the room: send open while the tape runs, closed at 6.0; return faded out by 7.5
  // during the skip (u 2.98-4.0) the send is ducked and the dry tape comes up, so each restart reads
  g.send.gain.cancelScheduledValues(Math.max(0, base));
  g.ret.gain.cancelScheduledValues(Math.max(0, base));
  g.lift.gain.cancelScheduledValues(Math.max(0, base));
  k.env(g.send.gain, base, [[0, SEND, "set"], [3.0, SEND, "set"], [3.02, SKIP_SEND], [4.01, SKIP_SEND], [4.02, SEND], [6.02, SEND], [6.05, 0]]);
  k.env(g.lift.gain, base, [[0, 0, "set"], [3.0, 0, "set"], [3.02, SKIP_LIFT * DRY], [4.01, SKIP_LIFT * DRY], [4.02, 0]]);
  k.env(g.ret.gain, base, [[0, 1, "set"], [6.02, 1, "set"], [7.0, 0.06, "exp"], [7.5, 0.0005, "exp"], [7.52, 0]]);
}

/** Marks a note of the tune as it sounds through the tape (the tape plays it; this only tells the checker). */
function sung() {}

export default {
  async prepare() {
    prepareReverb("vapor/hall", HALL);
    prepareReverb("vapor/gateroom", GATE_ROOM);
    if (!hasBuffer(SRC_KEY) && typeof OfflineAudioContext !== "undefined") await renderSource();
    if (hasBuffer(SRC_KEY) && !hasBuffer(SLIDE_KEY)) {
      putBuffer(SLIDE_KEY, resample(getBuffer(SRC_KEY), posA, SLIDE));
      putBuffer(RUNUP_KEY, resample(getBuffer(SRC_KEY), (u) => (u <= 6 ? posB(u) : posB(6) + (u - 6)), RUNUP));
    }
  },

  graph(k, out) {
    const tapeIn = k.gain(1);
    const hp = k.filter("highpass", 45, 0);
    const lp1 = k.filter("lowpass", 4000, 0);
    const lp2 = k.filter("lowpass", 5500, -3);
    const dry = k.gain(DRY);
    const send = k.gain(SEND);
    const ret = k.gain(1);
    k.chain(tapeIn, hp, lp1, lp2);
    lp2.connect(dry).connect(out);
    // the skip's lift: more dry tape above 200 Hz, open only during the skip (bed automates it)
    const lift = k.gain(0);
    lp2.connect(lift).connect(k.filter("highpass", 200, -3)).connect(out);
    // the room hears the tape without its lowest octave, so the long tail stays clear of the bass
    lp2.connect(send).connect(k.filter("highpass", 200, 0)).connect(k.filter("highpass", 200, 0)).connect(k.reverb("vapor/hall", HALL)).connect(ret).connect(out);
    const wobble = k.gain(WOBBLE_CENTS);
    return { tape: tapeIn, send, ret, lift, wobble };
  },

  score(s) {
    s.at(-0.02, bed, { dur: 7.6, seekable: true, label: "hiss, wobble, room" });
    s.at(0, tape, { dur: SLOW + 0.006, seg: "slide", fadeOut: 0.006, label: "tape: slows in" });
    s.at(SLOW, tape, { dur: 3 - SLOW, seg: "A", fadeIn: 0.006, seekable: true, label: "tape: steady" });
    for (let i = 0; i < 4; i += 1) s.at(3 + 0.25 * i, tape, { dur: 0.25, seg: "skip", from: p(3.0), label: `tape: skip ${i + 1}` });
    s.at(4, tape, { dur: RISE - 4 + 0.006, seg: "B", fadeOut: 0.006, seekable: true, label: "tape: resumes" });
    s.at(RISE, tape, { dur: 6.03 - RISE, seg: "runup", fadeIn: 0.006, fadeOut: 0.03, label: "tape: runs up" });

    // the tune as the saxophone plays it through the tape, in D (for the checker)
    // (the saxophone's variation; quarter-beat notes are too short to measure through the tape and
    // the hall, so they are marked free and only drawn)
    for (const [beat, beats, midi] of VARIATION) {
      const u = s.beat(beat);
      const dur = s.beat(beat + beats) - u;
      if (beats < 0.5) {
        s.note(sung, u, dur, midi, 0, { lead: true, free: true, label: "sax in the tape" });
        continue;
      }
      const free = u < SLOW || u + Math.min(dur, 0.34) > RISE + 0.15;
      s.note(sung, u, dur, midi, 0, { lead: true, free, tol: 25, label: "sax in the tape" });
    }

    s.cue(0, "the pelican rides into the tape");
    // The skip is measured in 66-150 Hz: the head of the restruck kick and the bass's restart, in the
    // dry tape only (the room hears nothing below 200 Hz). In the midrange the restarts show as a dip
    // of 5-11 dB at each cut but no rise: the saxophone's and the chord's attacks at the head of the
    // block are slower (35 ms) than the checker's 15 ms, even with the room taken away entirely.
    const low = { band: [66, 150] };
    s.cue(3.0, "the tape skips", low);
    s.cue(3.25, "skip: the same quarter second again", low);
    s.cue(3.5, "skip: again", low);
    s.cue(3.75, "skip: again", low);
    s.cue(4.0, "playback resumes, the picture jumps forward", low);
  },

  lead: sax,
  leadOctave: 0,
  bike: { chain: 0.6, bell: 1 },
};
