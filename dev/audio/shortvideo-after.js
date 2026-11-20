// Section 19 (shortvideo): somebody has filmed the pelican and put a beat
// under it. The caption credits the sound "bicycle bell and chain", so that is
// what the beat is made of: the hook is the film's tune on small bicycle
// bells (two octaves up, with a quick echo an eighth later), the hats are
// chain ticks. Under them a short hard kick, a clap on 2 and 4, a sub bass on
// the roots and an off-beat chord stab, both ducking under every kick.
//
// Bar 1 is heard as if from a phone held up nearby: every sound of bar 1 goes
// through a mono bus band-limited to about 500-3500 Hz, with no sub. On the
// downbeat of bar 2 the black bars slam in and the beat drops: from u = 2.0
// everything goes to the full-range, stereo bus. Everything stops dead at
// u = 6.0; what is bright stops 35 ms earlier, so the bicycle bell's D enters
// a clean space (MUSIC_GUIDE rule 3).
//
// How the sounds are made (nothing recorded):
//   bell hook   a sum of decaying partials with the bicycle bell's ratios
//               (0.5, a pair at 1 +- 0.15 %, a pair near 2.76, 5.19) and a
//               few ms of bright striker noise, 2.5 ms attack; t60 1.2 s but
//               damped 0.35 s after its note (heard about half a second)
//   chain hat   band-passed noise tick with two short metal modes
//   kick        a sine falling 150 -> 45 Hz in 0.1 s, 1 ms attack, a 2 ms
//               noise click on the front
//   clap        four band-passed noise bursts 8-10 ms apart, then a short tail
//   sub         a sine (with a trace of 2nd harmonic) on the roots, gliding
//               into each new root, ducked 6 dB for 90 ms under every kick
//   stab        per chord tone two oscillators 8 cents apart, each a sawtooth's
//               spectrum with Schroeder phases (no sharp edge, so the chord does
//               not spike), spread wide, through a closing low-pass; ducked like
//               the sub. Only on the off-beats where no kick falls
//   sweeps      white noise through a rising band-pass
//   pops/like   tiny sine chirps that settle on their note; the like is a
//               bigger chirp with a sparkle of high noise; taps are a soft
//               thump with a tick (a fingertip on glass)

import { SR, samples, white, biquad, envelope, mixInto, normalize, modal, fade } from "../engine/dsp.js";
import { sharedBuffer } from "../engine/kit.js";
import { hz, midi } from "../engine/theory.js";

// ---------------------------------------------------------------- the numbers

/** The drop: black bars slam in. */
const DROP = 2.0;
/** Bright sounds (above about 1.8 kHz) are over by here: the bell's entrance stays clear. */
const BRIGHT_END = 5.965;
/** Everything else stops dead here (5 ms fade). */
const END = 6.0;

/** Levels (set by measurement against the -16 LUFS target). */
const MASTER = 1.03;
const PHONE = 0.4;
const KICK = 0.247; // +3.5 dB after the review (was 0.165)
const SUB = 0.093; // +2.5 dB after the review (was 0.07)
/** On a beat the kick shares, the bells (hook and echo) strike this much after it: the attacks do not add their peaks. */
const BELL_LATE = 0.003;

const KICKS = [0, 0.75, 1.0, 2.0, 2.75, 4.0, 4.75, 5.0, 5.5];
const CLAPS = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5];
const DUCK_KICKS = KICKS.filter((u) => u >= DROP);

// ---------------------------------------------------------------- helpers

/** The bus of an event: bar 1 is heard through the phone, from the drop on the full range. */
const bus = (g, ev) => (ev.u !== undefined && ev.u < DROP ? g.phone : g.full);
/** Panning only on the full bus (the phone is mono anyway). */
const panOf = (ev, p) => (ev.u !== undefined && ev.u < DROP ? 0 : p);

/** A gain that closes over 5 ms so the voice is silent at `cap` seconds after `when` (none if cap is far). */
function cutter(k, when, cap, natural) {
  const c = k.gain(1);
  if (cap !== undefined && cap < natural) k.env(c.gain, when, [[0, 1], [Math.max(0.001, cap - 0.005), 1], [cap, 0]]);
  return c;
}

/** Duck a gain 6 dB for 90 ms at each kick that falls inside [u, u + len). */
function duck(k, param, when, u, len) {
  const pts = [[0, 1, "set"]];
  for (const kt of DUCK_KICKS) {
    const d = kt - u;
    if (d < -0.12 || d >= len) continue;
    if (d <= 0) {
      pts.push([0, 0.5, "set"], [Math.max(0.001, d + 0.09), 0.5], [d + 0.12, 1]);
    } else {
      pts.push([d, 1], [d + 0.003, 0.5], [d + 0.09, 0.5], [d + 0.12, 1]);
    }
  }
  k.env(param, when, pts);
}

/** A sine chirp that settles on f from `from` semitones away, decaying with time constant tau. */
function chirp(f, { from = -4, settle = 0.004, tau = 0.012, len = 0.06 } = {}) {
  const n = samples(len);
  const y = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    const fi = f * 2 ** ((from * Math.exp(-t / settle)) / 12);
    ph += (2 * Math.PI * fi) / SR;
    y[i] = Math.sin(ph) * Math.min(1, t / 0.0006) * Math.exp(-t / tau);
  }
  return fade(y, 0, 0.004);
}

// ---------------------------------------------------------------- the bell hook

/** A small bicycle bell tuned to m (the bike's partial ratios), shorter. held: rings longer. */
function bellSamples(m, held) {
  const f = hz(m);
  const t1 = held ? 1.6 : 1.2;
  const y = modal(
    [
      { f: f * 0.5, a: 0.02, t60: t1 * 0.6 },
      { f: f * 0.9985, a: 1.0, t60: t1 },
      { f: f * 1.0015, a: 0.45, t60: t1 * 0.92, phase: 2.0 },
      { f: f * 2.756, a: 0.3, t60: t1 * 0.5, phase: 0.3 },
      { f: f * 2.765, a: 0.22, t60: t1 * 0.45, phase: 2.6 },
      { f: f * 5.19, a: 0.07, t60: t1 * 0.18 },
    ],
    held ? 1.7 : 1.0,
    { attack: 0.0025 },
  );
  const tick = biquad(white(samples(0.005), 190 + m), "bandpass", 6500, 1.2);
  envelope(tick, [[0, 1], [0.0012, 0.5], [0.005, 0]]);
  mixInto(y, tick, 0, 0.3);
  return normalize(y, 0.9);
}

const bellKey = (m, held) => `shortvideo/bell/${m}/${held ? "held" : "short"}`;

/** One bell of the hook. ev.echo: the quieter repeat an eighth later. Also the part's `lead`. */
function bell(k, g, when, ev) {
  const held = !!ev.held;
  const buf = k.buffer(bellKey(ev.midi, held), () => bellSamples(ev.midi, held));
  const vel = ev.vel === undefined ? 0.85 : ev.vel;
  const level = (ev.echo ? 0.14 : 0.45) * vel;
  // on a kick's beat the bell strikes a few ms after the kick (none of this for the outro's `lead`, which has no ev.u)
  const late = ev.u !== undefined && KICKS.includes(ev.u) ? BELL_LATE : 0;
  // a bell rings on; this one is damped about 0.35 s after its note (the held E after its whole second)
  let natural = held ? 1.0 : Math.min(buf.duration, (ev.dur || 0.25) + 0.35);
  let fadeLen = 0.08;
  // an echo is damped by the time the next hook note strikes (ev.until: seconds from the echo's beat to that note)
  if (ev.until !== undefined && ev.until - late < natural) {
    natural = ev.until - late;
    fadeLen = 0.03;
  }
  const cap = ev.u === undefined ? undefined : BRIGHT_END - ev.u - late;
  const dur = cap !== undefined && cap < natural ? cap : natural;
  k.play(buf, when + late, { gain: level, pan: panOf(ev, ev.echo ? -0.45 : 0.12), dur, fade: cap !== undefined && cap < natural ? 0.02 : fadeLen }, bus(g, ev));
}

// ---------------------------------------------------------------- the beat

/** A chain link settling on a tooth: our own tick, a little darker than the bicycle's. */
function tickSamples(variant) {
  const x = biquad(white(samples(0.03), 61 + variant), "bandpass", 3400 + 380 * variant, 1.6);
  envelope(x, [[0, 0], [0.0004, 1], [0.004, 0.25], [0.012, 0.05], [0.03, 0]]);
  const ring = modal(
    [
      { f: 6100 + 270 * variant, a: 0.5, t60: 0.02 },
      { f: 8600 - 210 * variant, a: 0.3, t60: 0.012 },
    ],
    0.03,
  );
  mixInto(x, ring, 0, 0.3);
  return normalize(x, 0.9);
}

function hat(k, g, when, ev) {
  const buf = k.buffer(`shortvideo/tick/${ev.variant}`, () => tickSamples(ev.variant));
  k.play(buf, when, { gain: 0.3 * ev.vel, pan: panOf(ev, ev.variant % 2 ? 0.35 : -0.3) }, bus(g, ev));
}

/** Kick: sine 150 -> 45 Hz in a tenth of a second, a click on the front. */
function kick(k, g, when, ev) {
  const vel = ev.vel === undefined ? 1 : ev.vel;
  const natural = 0.17;
  const cap = END - ev.u;
  const stop = when + Math.min(natural, cap) + 0.01;
  const o = k.osc("sine", 45, when, stop);
  k.env(o.frequency, when, [[0, 150], [0.1, 45, "exp"]]);
  const amp = k.gain(0);
  k.env(amp.gain, when, [[0, 0], [0.001, KICK * vel], [0.02, 0.75 * KICK * vel], [0.07, 0.28 * KICK * vel], [natural, 0]]);
  const cut = cutter(k, when, cap, natural);
  o.connect(amp).connect(cut).connect(bus(g, ev));
  // the click: 2 ms of bright noise
  const c = k.noise("white", when, when + 0.006, { phase: 0.37 * ev.u, seed: 191 });
  const hp = k.filter("highpass", 1800, 0);
  const cg = k.gain(0);
  k.env(cg.gain, when, [[0, 0], [0.0003, 0.2 * KICK * vel], [0.002, 0.05 * KICK * vel], [0.005, 0]]);
  c.connect(hp).connect(cg).connect(bus(g, ev));
}

function clapSamples() {
  const n = samples(0.2);
  const y = new Float32Array(n);
  const src = biquad(biquad(white(n, 1919), "bandpass", 1150, 0.9), "peaking", 2400, 1, 4);
  const bursts = [0, 0.009, 0.017, 0.027];
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    let e = 0;
    for (const b of bursts) {
      const d = t - b;
      if (d >= 0 && d < 0.008) e = Math.max(e, Math.min(1, d / 0.0004) * Math.exp(-d / 0.0025));
    }
    if (t >= 0.027) e = Math.max(e, 0.55 * Math.exp(-(t - 0.027) / 0.045));
    y[i] = src[i] * e;
  }
  return normalize(fade(y, 0, 0.01), 0.9);
}

function clap(k, g, when, ev) {
  const buf = k.buffer("shortvideo/clap", clapSamples);
  k.play(buf, when, { gain: 0.28 * (ev.vel || 1), pan: panOf(ev, 0.05) }, bus(g, ev));
}

/** Sub bass: one root, gliding in from the root before. */
function sub(k, g, when, ev) {
  const len = ev.dur;
  const stop = when + len + 0.01;
  const o = k.osc(k.wave("shortvideo/sub", [0, 1, 0.12]), hz(ev.midi), when, stop);
  if (ev.from !== undefined) k.env(o.frequency, when, [[0, hz(ev.from)], [0.004, hz(ev.from)], [0.005, hz(ev.midi), ["target", 0.018]]]);
  const amp = k.gain(0);
  const A = SUB * (ev.vel || 1);
  k.env(amp.gain, when, [[0, 0], [0.004, A], [len - 0.005, A], [len, 0]]);
  const dk = k.gain(1);
  duck(k, dk.gain, when, ev.u, len);
  o.connect(amp).connect(dk).connect(g.full);
}

/**
 * The stab's oscillator: a sawtooth's spectrum (harmonic n at 1/n, 20 of them) with
 * Schroeder phases (pi n (n - 1) / N), so it sounds as bright as a saw but has no sharp
 * edge: several of them together do not pile up into spikes.
 */
function stabWave(k, side) {
  const N = 20;
  const twist = side > 0 ? 0.37 : 0;
  const sines = [0];
  const cosines = [0];
  for (let n = 1; n <= N; n += 1) {
    const ph = (Math.PI * n * (n - 1)) / N + twist * n * n;
    sines.push(Math.cos(ph) / n);
    cosines.push(Math.sin(ph) / n);
  }
  return k.wave(`shortvideo/stab/${side}`, sines, cosines);
}

/** Chord stab: two saws per tone a few cents apart, spread, a closing low-pass. Ducked. */
function stab(k, g, when, ev) {
  const vel = ev.vel || 1;
  const natural = 0.34;
  const cap = BRIGHT_END - ev.u;
  const stop = when + Math.min(natural, cap) + 0.01;
  const lp = k.filter("lowpass", 2600, 1);
  k.env(lp.frequency, when, [[0, 2800], [0.15, 700, "exp"], [0.34, 500, "exp"]]);
  const amp = k.gain(0);
  k.env(amp.gain, when, [[0, 0], [0.006, 0.1 * vel], [0.06, 0.08 * vel], [0.3, 0.03 * vel], [0.34, 0]]);
  const dk = k.gain(1);
  duck(k, dk.gain, when, ev.u, natural);
  const cut = cutter(k, when, cap, natural);
  const wide = ev.u >= DROP;
  ev.chord.forEach((m, i) => {
    for (const side of [-1, 1]) {
      // the oscillators start a little apart (free-running phases on a real synth), so their edges do not all line up
      const o = k.osc(stabWave(k, side), hz(m), when + 0.0011 * i + (side > 0 ? 0.0006 : 0), stop, side * 4 + (i - 1.5));
      if (wide) o.connect(k.pan(side * 0.85)).connect(lp);
      else o.connect(lp);
    }
  });
  lp.connect(amp).connect(dk).connect(cut).connect(bus(g, ev));
}

/** A noise sweep rising through a band-pass from ev.lo to ev.hi over ev.dur. */
function sweep(k, g, when, ev) {
  const len = ev.dur;
  const n = k.noise("white", when, when + len + 0.01, { phase: 1.1 + ev.u, seed: 193 });
  const bp = k.filter("bandpass", ev.lo, 1.4);
  k.env(bp.frequency, when, [[0, ev.lo], [len, ev.hi, "exp"]]);
  const amp = k.gain(0);
  k.env(amp.gain, when, [[0, 0], [len * 0.7, 0.35 * ev.level], [len - 0.006, ev.level], [len, 0]]);
  n.connect(bp).connect(amp).connect(bus(g, ev));
}

// ---------------------------------------------------------------- the interface

function pop(k, g, when, ev) {
  const buf = k.buffer(`shortvideo/pop/${ev.midi}`, () => normalize(chirp(hz(ev.midi), { from: -5, settle: 0.004, tau: 0.011, len: 0.06 }), 0.9));
  k.play(buf, when, { gain: 0.1 * (ev.vel || 1), pan: panOf(ev, ev.pan || 0) }, bus(g, ev));
}

function likeSamples() {
  const y = chirp(hz(midi("D7")), { from: -17, settle: 0.01, tau: 0.03, len: 0.16 });
  mixInto(y, chirp(hz(midi("A7")), { from: -5, settle: 0.004, tau: 0.02, len: 0.1 }), 0.012, 0.5);
  const sp = biquad(white(samples(0.1), 1931), "highpass", 6500, 0.8);
  envelope(sp, [[0, 0], [0.001, 1], [0.02, 0.35], [0.1, 0]]);
  mixInto(y, sp, 0.004, 0.25);
  return normalize(fade(y, 0, 0.01), 0.9);
}

function like(k, g, when, ev) {
  const buf = k.buffer("shortvideo/like", likeSamples);
  k.play(buf, when, { gain: 0.15, pan: panOf(ev, 0) }, bus(g, ev));
}

function tapSamples() {
  const n = samples(0.05);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    y[i] = Math.sin(2 * Math.PI * 190 * t) * Math.min(1, t / 0.0008) * Math.exp(-t / 0.009);
  }
  const tk = biquad(white(samples(0.006), 1937), "bandpass", 2600, 1.5);
  envelope(tk, [[0, 0], [0.0003, 1], [0.003, 0.2], [0.006, 0]]);
  mixInto(y, tk, 0, 0.5);
  return normalize(fade(y, 0, 0.006), 0.9);
}

function tap(k, g, when, ev) {
  const buf = k.buffer("shortvideo/tap", tapSamples);
  k.play(buf, when, { gain: 0.12, pan: panOf(ev, 0) }, bus(g, ev));
}

// ---------------------------------------------------------------- the score

/** The tune two octaves up, D6 .. B6 (bar 3 ends B5 A5 B5). */
const HOOK = (s) => s.theme({ octave: 2 });

/** Stab chords on the off-beats where the kick is not: [u, chord]. */
const D_ = [62, 66, 69, 74];
const G_ = [55, 59, 62, 67];
const A_ = [57, 61, 64, 69];
const DF = [54, 57, 62, 66];
const STABS = [
  [0.25, D_], [1.25, D_], [1.75, D_],
  [2.25, G_], [3.25, A_], [3.75, A_],
  [4.25, DF], [5.25, G_],
];
/** Sub roots from the drop: [u, dur, note]. */
const SUBS = [
  [2.0, 1.0, "G1"],
  [3.0, 1.0, "A1"],
  [4.0, 1.0, "D2"],
  [5.0, 0.5, "G1"],
  [5.5, 0.47, "A1"], // ends at 5.97 (after the review): a little air before section 20's piano
];

function prepareBuffers() {
  // every pitch of D major from A4 to D7: the hook, its echo, and whatever the outro asks of the `lead`
  for (let n = 69; n <= 98; n += 1) {
    if (![0, 2, 4, 5, 7, 9, 11].includes((n - 62 + 120) % 12)) continue;
    sharedBuffer(bellKey(n, false), () => bellSamples(n, false));
  }
  sharedBuffer(bellKey(88, true), () => bellSamples(88, true));
  for (let v = 0; v < 4; v += 1) sharedBuffer(`shortvideo/tick/${v}`, () => tickSamples(v));
  sharedBuffer("shortvideo/clap", clapSamples);
  sharedBuffer("shortvideo/like", likeSamples);
  sharedBuffer("shortvideo/tap", tapSamples);
}

export default {
  async prepare() {
    prepareBuffers();
  },

  graph(k, out) {
    const master = k.gain(MASTER);
    master.connect(out);
    const full = k.gain(1);
    full.connect(master);
    // the phone: mono, band-limited to about 500-3500 Hz
    const phone = k.gain(PHONE);
    phone.channelCount = 1;
    phone.channelCountMode = "explicit";
    phone.channelInterpretation = "speakers";
    k.chain(phone, k.filter("highpass", 500, 0), k.filter("highpass", 500, 0), k.filter("highpass", 500, -3), k.filter("lowpass", 3500, 0), k.filter("lowpass", 3500, 0), k.filter("lowpass", 3500, -3), master);
    return { full, phone };
  },

  score(s) {
    // the hook and its echo
    const hook = HOOK(s);
    for (const n of hook) {
      const held = n.u === 3.0;
      s.note(bell, n.u, n.dur, n.midi, n.skeleton ? 1 : 0.85, { lead: true, held, label: "bell hook" });
      const e = n.u + 0.25;
      // no echo on 3.0: the held E (the joke) reads clean
      if (e === 3.0) continue;
      // each echo is damped when the next hook note after it strikes
      const next = hook.find((m) => m.u > e + 1e-9);
      const until = next ? next.u - e : undefined;
      if (e < BRIGHT_END - 0.02) s.note(bell, e, 0.25, n.midi, n.skeleton ? 1 : 0.85, { echo: true, until, label: "bell echo" });
    }

    // hats: chain ticks in sixteenths, the accent moving (every third sixteenth); rolls into bar 3 and into the frame
    for (let j = 0; j < 48; j += 1) {
      const u = j * 0.125;
      if (u >= 3.75 && u < 4.0) continue;
      if (u >= 5.5) continue;
      if (u === 3.0) continue; // the double-tap takes this sixteenth
      let vel = j % 3 === 0 ? 1 : 0.5;
      if (u >= 5.0) vel *= 0.7 + 0.6 * ((u - 5.0) / 0.5);
      s.at(u, hat, { dur: 0.03, vel, variant: j % 4, label: "chain hat" });
    }
    for (let i = 0; i < 8; i += 1) s.at(3.75 + i / 32, hat, { dur: 0.03, vel: 0.45 + 0.08 * i, variant: i % 4, label: "chain roll" });
    // the roll into the frame stops a 32nd and a bit early (last tick 5.84), so the bell's D enters a clear space
    for (let i = 0; i < 12; i += 1) s.at(5.5 + i / 32, hat, { dur: 0.03, vel: 0.5 + 0.05 * i, variant: (i + 1) % 4, label: "chain roll" });

    for (const u of KICKS) s.at(u, kick, { dur: 0.17, vel: u === 0 || u === 2 || u === 4 ? 1 : 0.9, label: "kick" });
    for (const u of CLAPS) s.at(u, clap, { dur: 0.2, label: "clap" });
    for (const [u, chord] of STABS) s.at(u, stab, { dur: 0.34, chord, vel: u < DROP ? 0.8 : 1, label: "stab" });
    SUBS.forEach(([u, dur, nm], i) => s.note(sub, u, dur, midi(nm), 1, { from: i ? midi(SUBS[i - 1][2]) : undefined, label: "sub" }));

    // the sweeps: into the drop (through the phone) and into the frame
    s.at(1.0, sweep, { dur: 0.985, lo: 600, hi: 3300, level: 0.12, label: "sweep" });
    s.at(5.0, sweep, { dur: BRIGHT_END - 5.0, lo: 700, hi: 8000, level: 0.1, label: "sweep" });

    // the interface: five pops climbing the five notes, the double-tap and the like
    ["D7", "E7", "F#7", "A7", "B7"].forEach((nm, i) => s.note(pop, [2.04, 2.1, 2.17, 2.24, 2.31][i], 0.06, midi(nm), 1, { pan: -0.3 + 0.5 * (i / 4), label: "pop" }));
    s.at(2.91, tap, { dur: 0.05, label: "tap" });
    s.at(3.0, tap, { dur: 0.05, label: "tap" });
    s.at(3.0, like, { dur: 0.16, label: "like" });

    s.cue(0, "the pelican comes through the frame");
    s.cue(2.0, "black bars slam in: the drop");
    s.cue(3.0, "double-tap: the heart pops", { band: [5000, 12000] });
  },

  lead: bell,
  leadOctave: 2,
  bike: { chain: 0, bell: 1 },
};
