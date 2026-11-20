// Section 13 (scream): Munch, The Scream, 1893. The orchestra of The Starry Night, colder.
//
// Bar 1 and the top of bar 2: violas and cellos play the tune at written
// pitch, dark and nearly without vibrato; a high, thin sul ponticello tremolo A
// in the violins; inner voices and basses swell and ebb on every chord like the
// lines of the fjord, and a B flat creeps into the inner voice in bar 1.
// At 2.95 the pelican rings its bell (twice: 2.95, 3.08, softer). At 3.0 the
// man starts, and so does the orchestra: a hard bite on every string, the
// violins tear up from E5 by a sixth to an octave into a quarter-tone cluster
// shaking at 8-9 Hz, shaped like an open mouth (bands near 1.2 and 3 kHz);
// violas, cellos and basses slide apart downward by quarter tones. It peaks at
// about 3.3 and wails to 3.8; then the pitches sag back. From 3.9 the
// orchestra finds bar 3's notes one by one, sour (up to 20 cents) and drifting
// true, quiet, without vibrato. B, A, B at 5.0-5.75 in tune and pale. The bell
// and Section 14 take the D.
//
// A bowed string (as in 12-starry.js, copied and extended): a band-limited
// Helmholtz wave (sawtooth with the bow-point comb) through a lowpass that
// opens as the bow bites, an amplitude envelope drawn per note, a vibrato
// from k.lfo with its own phase per player, and a pitch line on the
// oscillator's detune for the glides. Sul ponticello is the same motion bowed
// near the bridge: a smaller bow-point fraction and a slower fall of the upper
// partials, through a much higher lowpass.

import { prepareReverb } from "../engine/kit.js";
import { hz, midi } from "../engine/theory.js";
import { ring } from "./bike.js";

const HALL = { seconds: 2.5, t60: 2.0, bright: 0.38, predelay: 0.022, early: 0.4, seed: 1893 };
const LEVEL = 1.15;
const N = (name) => midi(name);

// ---------------------------------------------------------------- the bowed waves

/** Ordinary bowing: partial n at 1/n, thinned by the bow point at 1/8.6 of the string. */
const ORD_SINES = (() => {
  const a = [0];
  const beta = 1 / 8.6;
  for (let n = 1; n <= 48; n += 1) a.push(((1 / n) * (0.2 + 0.8 * Math.abs(Math.sin(Math.PI * n * beta)))) / Math.abs(Math.sin(Math.PI * beta)));
  return a;
})();

/** Sul ponticello: bowed at 1/17 of the string, the upper partials fall more slowly (glassy, thin). */
const PONT_SINES = (() => {
  const a = [0];
  const beta = 1 / 17;
  for (let n = 1; n <= 40; n += 1) a.push((n ** -0.62 * (0.15 + 0.85 * Math.abs(Math.sin(Math.PI * n * beta)))) / Math.abs(Math.sin(Math.PI * beta)) * (n === 1 ? 0.55 : 1));
  return a;
})();

/**
 * The same partials with Schroeder phases (phi_n = pi n^2 / M) instead of all in sine phase.
 * The ear barely tells phase apart on a sustained tone; the waveform's peaks drop by several dB,
 * which leaves room for the scream under the peak limit. Returns [sines, cosines].
 */
function spread(amps) {
  const m = amps.length - 1;
  const s = [0];
  const c = [0];
  for (let n = 1; n <= m; n += 1) {
    const phi = (Math.PI * n * n) / m;
    s.push(amps[n] * Math.cos(phi));
    c.push(amps[n] * Math.sin(phi));
  }
  return [s, c];
}
const ORD = spread(ORD_SINES);
const PONT = spread(PONT_SINES);

const waveOf = (k, kind) => (kind === "pont" ? k.wave("scream/pont", PONT[0], PONT[1]) : k.wave("scream/ord", ORD[0], ORD[1]));

/**
 * One player drawing one bow.
 *   o.wave     "ord" | "pont"
 *   o.cents    fixed detune of the player
 *   o.pitch    [[dt, cents, shape]...] pitch line on top of o.cents (glides)
 *   o.amp      [[dt, factor]...] amplitude breakpoints (0..1, times o.peak); before dur
 *   o.r        release after dur
 *   o.vib      [[dt, cents]...] vibrato depth line; o.vibRate, o.vibPhase
 *   o.lp       [[dt, Hz]...] lowpass line
 *   o.trem     Hz of bowed tremolo, o.tremDepth
 *   o.noise    level of the bow's bite (rosin noise), o.noiseHz
 */
function bow(k, dest, when, f, dur, o) {
  const r = o.r === undefined ? 0.1 : o.r;
  const end = when + dur + r;
  const cents = o.cents || 0;
  const osc = k.osc(waveOf(k, o.wave), f, when, end + 0.01, cents);
  if (o.pitch) k.env(osc.detune, when, [[0, cents], ...o.pitch.filter((p) => p[0] < dur + r).map(([dt, c, sh]) => [dt, c + cents, sh])]);

  if (o.vib) {
    const lfo = k.lfo(o.vibRate || 5, when, end + 0.01, o.vibPhase || 0);
    const depth = k.gain(0);
    lfo.connect(depth).connect(osc.detune);
    k.env(depth.gain, when, [[0, 0], ...o.vib.filter((p) => p[0] < dur + r)]);
  }

  const lp = k.filter("lowpass", Math.min(9000, o.lp[0][1]), 0);
  k.env(lp.frequency, when, o.lp.map(([dt, v]) => [dt, Math.min(9000, v)]));

  const amp = k.gain(0);
  const pts = o.amp.filter((p) => p[0] < dur);
  const last = pts.length ? pts[pts.length - 1][1] : 1;
  k.env(amp.gain, when, [[0, 0], ...pts.map(([dt, v]) => [dt, v * o.peak]), [dur, last * o.peak], [dur + r, 0]]);

  let tail = amp;
  if (o.trem) {
    const depth = o.tremDepth || 0.45;
    const tg = k.gain(1 - depth);
    const lfo = k.lfo(o.trem, when, end + 0.01, o.tremPhase || 0);
    const dg = k.gain(depth);
    lfo.connect(dg).connect(tg.gain);
    amp.connect(tg);
    tail = tg;
  }
  osc.connect(lp).connect(amp);
  tail.connect(dest);

  if (o.noise) {
    const nz = k.noise("white", when, when + 0.09, { phase: ((o.seed || 1) * 0.377) % 5, seed: 13 });
    const bp = k.filter("bandpass", o.noiseHz || Math.min(6000, Math.max(1800, f * 4)), 0.9);
    const ng = k.gain(0);
    k.env(ng.gain, when, [[0, 0], [o.hard ? 0.0015 : 0.004, o.noise * o.peak], [0.03, o.noise * o.peak * 0.3], [0.08, 0]]);
    nz.connect(bp).connect(ng).connect(dest);
  }
}

/** A section of players on one note: [cents, lag, vibrato rate, vibrato phase]. */
function players(k, dest, when, ev, desk, base, perPlayer) {
  const f = hz(ev.midi);
  desk.forEach(([cents, lag, rate, phase], i) => {
    const extra = perPlayer ? perPlayer(i) : {};
    bow(k, dest, when + lag, f, Math.max(0.03, ev.dur - lag), { ...base, cents, vibRate: rate, vibPhase: phase, noise: i === 0 ? base.noise : 0, seed: (ev.seed || 1) + i, ...extra });
  });
}

// ---------------------------------------------------------------- instruments

/** Violas (two desks) and a cello in unison: the tune, dark, little vibrato. Also the outro voice. */
const TUNE_DESK = [[-4, 0, 5.2, 0.1], [3, 0.006, 5.6, 0.55], [1, 0.012, 4.9, 0.8]];

function tune(k, g, when, ev) {
  const f = hz(ev.midi);
  const dur = ev.dur;
  const vel = ev.vel === undefined ? 0.8 : ev.vel;
  const a = ev.attack || Math.min(0.08, Math.max(0.035, dur * 0.3));
  players(k, g.tune || g.out, when, ev, TUNE_DESK, {
    wave: "ord",
    r: ev.release || 0.09,
    peak: 0.14 * vel,
    amp: ev.amp || [[a, 1], [Math.max(a + 0.01, dur * 0.6), 0.95]],
    vib: ev.vibCents === 0 ? null : [[0.12, 0], [0.3, ev.vibCents || (dur > 0.4 ? 4 : 2.5)]],
    lp: ev.lp || [[0, f * 2.4], [a * 1.4 + 0.01, f * 5.5]],
    pitch: ev.pitch,
    noise: ev.noise === undefined ? 0.12 : ev.noise,
    hard: ev.hard,
  }, ev.perPlayer);
}

/** Inner voices and basses: long bows that swell and ebb. */
function long(k, g, when, ev) {
  const f = hz(ev.midi);
  const dest = ev.midi < N("C2") + 12 ? g.cb || g.out : g.inner || g.out;
  const desk = ev.midi < N("C3") ? [[-3, 0, 4.8, 0.2], [4, 0.01, 5.1, 0.7]] : [[-4, 0, 5.0, 0.35], [4, 0.009, 5.4, 0.9]];
  players(k, dest, when, ev, desk, {
    wave: "ord",
    r: ev.release || 0.14,
    peak: (ev.midi < N("C3") ? 0.07 : 0.08) * ev.vel,
    amp: ev.amp || [[0.18, 0.55], [ev.dur * 0.55, 1], [ev.dur * 0.97, 0.5]],
    vib: ev.vib === 0 ? null : [[0.2, 0], [0.5, 4]],
    lp: ev.lp || [[0, f * 2.2], [0.2, f * 5]],
    pitch: ev.pitch,
    noise: ev.noise || 0,
    hard: ev.hard,
  }, ev.perPlayer);
}

/** The violins' high A: sul ponticello bowed tremolo, very soft, glassy. */
function shiver(k, g, when, ev) {
  players(k, g.vln || g.out, when, ev, [[-3, 0, 6, 0.15], [4, 0.011, 6, 0.6], [0, 0.019, 6, 0.85]], {
    wave: "pont",
    r: ev.release || 0.12,
    peak: 0.03 * ev.vel,
    amp: ev.amp || [[0.25, 0.7], [ev.dur * 0.5, 1], [ev.dur * 0.95, 0.75]],
    vib: null,
    lp: [[0, 7000]],
    pitch: ev.pitch,
    trem: ev.trem === 0 ? 0 : 13.5,
    tremDepth: 0.55,
  }, (i) => ({ trem: ev.trem === 0 ? 0 : 12.6 + 1.1 * i, tremPhase: 0.3 * i }));
}

/**
 * The scream: four violins bitten hard on E5, tearing up into a quarter-tone
 * cluster a sixth to an octave above, shaking wide and fast; then sagging.
 */
const SCREAM_TARGETS = [950, 1000, 1050, 1110];
/** The cut that lets the second bell stroke through: u from..to at full depth (dB), centred on the bell's 2347 Hz. */
const BELL_CUT = { hz: 2350, q: 5, db: -14, from: 3.08, to: 3.36 };
const SCREAM_DESK = [[-3, 0, 8.4, 0.05], [4, 0.002, 8.9, 0.4], [0, 0.004, 8.1, 0.7], [2, 0.006, 8.65, 0.25]];

function scream(k, g, when, ev) {
  // the bell's second stroke (3.08) is heard through the scream: the cut closes in before it and
  // opens again after its first quarter second
  if (g.screamCut) k.env(g.screamCut.gain, when, [[0, 0], [BELL_CUT.from - 0.03 - HIT, 0], [BELL_CUT.from - HIT, BELL_CUT.db], [BELL_CUT.to - HIT, BELL_CUT.db], [BELL_CUT.to + 0.1 - HIT, 0]]);
  players(k, g.scream || g.out, when, ev, SCREAM_DESK, {
    wave: "pont",
    r: 0.12,
    peak: 0.26 * ev.vel,
    hard: true,
    amp: [[0.003, 0.85], [0.3, 1], [0.8, 0.75], [1.2, 0.3], [1.45, 0.08]],
    lp: [[0, 3500], [0.05, 6500], [0.8, 6500], [1.4, 3000]],
    noise: 0.9,
    noiseHz: 3000,
  }, (i) => ({
    pitch: [[0.012, 0], [0.1, SCREAM_TARGETS[i] * 0.72], [0.24, SCREAM_TARGETS[i]], [0.8, SCREAM_TARGETS[i] - 30], [1.45, SCREAM_TARGETS[i] - 420 - 40 * i]],
    vib: [[0.02, 12], [0.15, 45], [0.8, 40], [1.4, 12]],
  }));
}

/**
 * A soft knee in front of the scream's bus: four players in a cluster beat, and where their
 * crests meet the sum would jump several dB above its body. tanh rounds those peaks and leaves
 * the body almost untouched. Returns the new input.
 * The curve spans an input of -KNEE_SPAN..KNEE_SPAN (a WaveShaper clamps outside -1..1), so the
 * transfer is tanh(4x) everywhere the cluster goes (its crests reach about 0.7): it rounds, it
 * never reaches the curve's flat end.
 */
const KNEE_SPAN = 4;
function soft(k, dest) {
  const pre = k.gain(4 / KNEE_SPAN);
  const post = k.gain(0.25);
  pre.connect(k.shaper("scream/knee-wide", (x) => Math.tanh(KNEE_SPAN * x))).connect(post).connect(dest);
  return pre;
}

// ---------------------------------------------------------------- the score

const PRE = 0.03; // bowed notes after the first start this much early, so they are heard on the beat
const HIT = 3.0; // the man starts

export default {
  prepare() {
    prepareReverb("scream/hall", HALL);
  },

  graph(k, out) {
    const master = k.gain(LEVEL);
    const hp = k.filter("highpass", 36, 0);
    // a gentle knee on the whole band: linear below about -14 dBFS, rounds the few crests where the
    // scream's bite and the bell meet (about 2 dB at -6 dBFS). The transfer is 0.5 tanh(2x); its curve
    // spans an input of -1..1 so that it rounds those crests and never reaches the curve's flat end.
    const kin = k.gain(1);
    const kout = k.gain(0.5);
    master.connect(kin).connect(k.shaper("scream/master-knee-wide", (x) => Math.tanh(2 * x))).connect(kout).connect(hp).connect(out);
    const send = k.gain(0.22);
    send.connect(k.reverb("scream/hall", HALL)).connect(master);
    const bus = (pan, eq) => {
      const input = k.gain(1);
      let last = input;
      for (const [type, f, q, db] of eq) last = k.chain(last, k.filter(type, f, q, db));
      const p = k.pan(pan);
      last.connect(p);
      p.connect(master);
      p.connect(send);
      return input;
    };
    // a cut on the scream's bus where the bell's main partial sounds (2.35 kHz), opened by scream() only
    // for the second stroke's first quarter second (the cluster's second harmonics sit right on it)
    const screamCut = k.filter("peaking", BELL_CUT.hz, BELL_CUT.q, 0);
    screamCut.connect(bus(-0.15, [["peaking", 1200, 1.6, 7], ["peaking", 3000, 1.6, 7], ["highshelf", 5200, 0, -12]]));
    return {
      send,
      screamCut,
      tune: bus(0.1, [["peaking", 260, 1.1, 2.5], ["peaking", 1900, 1.2, 1], ["highshelf", 3800, 0, -8]]),
      inner: bus(0.28, [["peaking", 150, 1.0, 2], ["highshelf", 3000, 0, -9]]),
      cb: bus(0.34, [["lowpass", 1800, 0, 0]]),
      vln: bus(-0.3, [["peaking", 3000, 1.0, 2], ["highshelf", 8000, 0, -6]]),
      scream: soft(k, screamCut),
      bell: bus(-0.05, []),
    };
  },

  score(s) {
    // ---- the tune: violas and a cello at written pitch
    for (const note of s.theme()) {
      const at = note.beat === 0 || note.u === HIT ? note.u : note.u - PRE;
      let dur = note.u + note.dur - at + 0.02;
      if (note.beat === 11.5) dur = 5.93 - at; // the last eighth leaves the D to the bell
      const ev = { lead: true, label: "tune", vel: note.beat === 4 ? 1 : note.skeleton ? 0.85 : 0.72 };
      if (note.beat === 0) Object.assign(ev, { attack: 0.025, noise: 0.35, label: "tune (through the frame)" }); // a clear downbeat
      if (note.beat === 5 || note.beat === 5.5) ev.vel = 0.58; // the bar holds its breath before the bell
      if (note.u === HIT) {
        // the tune's E, bitten hard; the players slide apart downward by quarter tones, then sag back
        Object.assign(ev, {
          free: true,
          label: "tune (E tears)",
          vel: 0.75,
          attack: 0.004,
          hard: true,
          noise: 0.5,
          vibCents: 0,
          amp: [[0.004, 0.5], [0.3, 1], [0.8, 0.6], [0.95, 0.35]],
          lp: [[0, 3000], [0.03, 2600], [0.9, 1500]],
        });
        dur = 0.97;
        ev.perPlayer = (i) => ({
          pitch: [[0.02, 0], [0.3, -50 * (i + 1)], [0.8, -45 * (i + 1)], [0.97, -15 * (i + 1)]],
          vib: [[0.02, 0], [0.15, 14], [0.8, 10], [0.97, 0]],
        });
      } else if (note.u >= 4 && note.u < 5) {
        // bar 3, found again: sour, drifting true, without vibrato
        const sour = { 4: -18, 4.5: 14, 4.75: -10 }[note.u];
        Object.assign(ev, { free: true, label: "tune (sour)", vel: 0.6, vibCents: 0, pitch: [[0, sour], [dur, sour * 0.25]] });
      } else if (note.u >= 5) {
        Object.assign(ev, { label: "tune (pale)", vel: 0.55, vibCents: 0, lp: [[0, hz(note.midi) * 2], [0.05, hz(note.midi) * 4]] });
      }
      s.note(tune, at, dur, note.midi, ev.vel, ev);
    }
    s.cue(0, "the pelican comes through the frame", { soft: true });

    // ---- inner voices: D with F# held; A creeps to B flat (something is slightly wrong), then B in G
    const swell = (d) => [[0.2, 0.5], [d * 0.55, 1], [d * 0.97, 0.3]];
    const firm = (d) => ({ noise: 0.3, amp: [[0.04, 0.75], [0.25, 0.6], [d * 0.55, 1], [d * 0.97, 0.45]] }); // the downbeat: a bow that bites, then the swell
    s.note(long, 0, 2.02, N("F#3"), 0.8, { label: "inner", ...firm(2.02) });
    s.note(long, 0, 1.0, N("A3"), 0.75, { label: "inner", ...firm(1.0) });
    // it hands over to the B3 at 1.97 instead of rubbing against it: ends at 1.99, a 0.06 s release
    s.note(long, 1.0 - PRE, 1.99 - (1.0 - PRE), N("Bb3"), 0.8, { label: "inner (B flat creeps in)", amp: [[0.25, 0.6], [0.8, 1], [1.0, 0.6]], release: 0.06 });
    s.note(long, 2.0 - PRE, 1.0, N("B3"), 0.75, { label: "inner", amp: swell(1.0) });
    s.note(long, 2.0 - PRE, 1.0, N("G3"), 0.75, { label: "inner", amp: swell(1.0) });

    // ---- basses: long notes
    s.note(long, 0, 2.02, N("D2"), 0.9, { label: "cb", ...firm(2.02) });
    s.note(long, 2.0 - PRE, 1.0, N("G1"), 0.9, { label: "cb", amp: swell(1.0) });

    // ---- the violins' high A: thin, trembling, very soft; it stops as the scream bites
    s.note(shiver, 0, 3.0, N("A5"), 1, { label: "vln A", amp: [[0.4, 0.7], [1.0, 1], [2.0, 0.75], [2.9, 0.3]], release: 0.05 });

    // ---- the bell, borrowed from the bicycle
    s.at(2.95, ring, { vel: 0.9, dur: 2.4, label: "bell" });
    s.at(3.08, ring, { vel: 0.5, dur: 2.4, label: "bell" });
    s.cue(2.95, "the pelican rings its bell", { band: [1800, 9000] });

    // ---- the scream
    s.note(scream, HIT, 1.45, N("E5"), 1, { label: "scream vln" });
    const tear = (i, depth) => [[0.02, 0], [0.3, -depth * (i + 1)], [0.8, -depth * (i + 1) * 0.9], [0.95, -depth * 0.3]];
    const bite = { noise: 0.6, hard: true, vib: 0, amp: [[0.004, 0.5], [0.3, 1], [0.8, 0.55], [0.95, 0.3]], release: 0.12 };
    s.note(long, HIT, 0.95, N("C#4"), 0.75, { ...bite, label: "inner scream", perPlayer: (i) => ({ pitch: tear(i, 75) }) });
    s.note(long, HIT, 0.95, N("A3"), 0.75, { ...bite, label: "inner scream", perPlayer: (i) => ({ pitch: tear(i + 1, 50) }) });
    s.note(long, HIT, 0.95, N("E3"), 0.75, { ...bite, label: "inner scream", perPlayer: (i) => ({ pitch: tear(i, 100) }) });
    s.note(long, HIT, 0.95, N("A1"), 0.7, { ...bite, label: "cb scream", perPlayer: (i) => ({ pitch: tear(i, 60) }) });
    s.cue(HIT, "the man starts: the scream", { band: [1000, 1800] });

    // ---- bar 3: the notes found one by one, sour and drifting true, without vibrato
    const sour = (c, d) => ({ vib: 0, pitch: [[0, c], [d, c * 0.15]] });
    s.note(long, 3.9, 1.12, N("F#1"), 0.7, { label: "cb (found)", ...sour(15, 1.1) });
    s.note(long, 4.15, 0.87, N("A3"), 0.55, { label: "inner (found)", ...sour(-20, 0.85) });
    s.note(long, 4.35, 0.67, N("D3"), 0.55, { label: "inner (found)", ...sour(12, 0.65) });
    s.note(shiver, 4.55, 1.33, N("A5"), 0.55, { label: "vln A (pale)", trem: 0, amp: [[0.35, 0.8], [0.9, 1], [1.3, 0.6]], release: 0.05, pitch: [[0, -15], [1.2, -2]] });
    s.note(long, 5.0 - PRE, 0.52, N("G1"), 0.6, { label: "cb (pale)", vib: 0, amp: [[0.1, 0.8], [0.5, 1]] });
    s.note(long, 5.0 - PRE, 0.52, N("G3"), 0.45, { label: "inner (pale)", vib: 0, amp: [[0.1, 0.8], [0.5, 1]] });
    s.note(long, 5.0 - PRE, 0.52, N("D3"), 0.45, { label: "inner (pale)", vib: 0, amp: [[0.1, 0.8], [0.5, 1]] });
    s.note(long, 5.5 - PRE, 0.43, N("A1"), 0.55, { label: "cb (pale)", vib: 0, amp: [[0.08, 0.9], [0.4, 0.7]], release: 0.1 });
    s.note(long, 5.5 - PRE, 0.43, N("G3"), 0.4, { label: "inner (pale)", vib: 0, amp: [[0.08, 0.9], [0.4, 0.7]], release: 0.1 });
    s.note(long, 5.5 - PRE, 0.43, N("E3"), 0.4, { label: "inner (pale)", vib: 0, amp: [[0.08, 0.9], [0.4, 0.7]], release: 0.1 });
  },

  lead: tune,
  leadOctave: 0,
  bike: { chain: 1, bell: 1 },
};
