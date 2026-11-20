// Section 12 (starry): The Starry Night, 1889. A string orchestra geared to the bicycle.
//
// The sky turns because the wheels turn, and so does the music: every event
// is written in beats and placed at s.ridden(beat), the moment the pedals have
// turned that far. When the pelican slows to look up, the orchestra slows and
// nearly stops (one hushed tremolo chord, the tune's A hanging); when it stands
// on the pedals, an accelerating run winds the swirls up again and the whole
// orchestra races to catch the frame on time. Nobody conducts. The pedals do.
//
// Instruments (all oscillators and one computed buffer):
//   first violins   the tune an octave up, legato, three players, vibrato
//   second violins  the upper half of the swirling sixteenth broken chords
//   violas          the lower half of the swirls; the spin-up run
//   cellos          a singing tenor line and the bass of the chord
//   basses          pizzicato on the first beat of each two-beat cell
//   a hall of about 2.5 s
//
// A bowed string here is a band-limited Helmholtz (sawtooth-like) wave with
// the bow-position notches, through a lowpass that opens as the bow bites, an
// attack of 60-120 ms (15-25 ms for the detached sixteenths), delayed vibrato,
// and a body resonance per section on its bus. A section is two or three such
// players a few cents and milliseconds apart.

import { pluck, onePole, fade, normalize } from "../engine/dsp.js";
import { prepareReverb, sharedBuffer } from "../engine/kit.js";
import { hz, midi } from "../engine/theory.js";

const HALL = { seconds: 2.5, t60: 2.1, bright: 0.42, predelay: 0.022, early: 0.4, seed: 1889 };
const LEVEL = 1.11;

// ---------------------------------------------------------------- the bowed wave

/** Helmholtz motion: partial n at 1/n, thinned where the bow position (1/8.6 of the string) puts a node. */
const BOW_SINES = (() => {
  const a = [0];
  const beta = 1 / 8.6;
  for (let n = 1; n <= 48; n += 1) a.push((1 / n) * (0.2 + 0.8 * Math.abs(Math.sin(Math.PI * n * beta))) / Math.abs(Math.sin(Math.PI * beta)));
  return a;
})();

const N = (name) => midi(name);

/**
 * One player drawing one bow.
 *   dest   bus
 *   f      Hz
 *   dur    seconds the bow is drawn (release follows)
 *   o      { cents, a, r, peak, points (amplitude breakpoints [dt, factor], replace the default),
 *            vib (cents), vibRate, vibDelay, b0, b1 (lowpass as multiples of f, start and settled),
 *            trem (Hz, bowed tremolo), tremDepth, noise (bow scrape level), seed }
 */
function bow(k, dest, when, f, dur, o) {
  const a = o.a;
  const r = o.r;
  const end = when + dur + r;
  const osc = k.osc(k.wave("starry/bow", BOW_SINES), f, when, end + 0.01, o.cents || 0);

  if (o.vib) {
    // each player's vibrato starts at its own point of the cycle (players spread evenly round it),
    // so the section does not bend as one while the depth fades in
    const lfo = k.lfo(o.vibRate || 5.8, when, end + 0.01, o.vibPhase || 0);
    const depth = k.gain(0);
    lfo.connect(depth).connect(osc.detune);
    const d0 = o.vibDelay === undefined ? 0.12 : o.vibDelay;
    k.env(depth.gain, when, [[0, 0], [d0, 0], [d0 + 0.22, o.vib]]);
  }

  const lo = o.lpMin || 0;
  const f0 = Math.min(9000, Math.max(lo * 0.6, f * o.b0));
  const f1 = Math.min(9000, Math.max(lo, f * o.b1));
  const lp = k.filter("lowpass", f0, 0);
  k.env(lp.frequency, when, [[0, f0], [Math.max(0.02, a * 1.3), f1]]);

  const amp = k.gain(0);
  const pk = o.peak;
  if (o.points) {
    k.env(amp.gain, when, [[0, 0], ...o.points.map(([dt, v]) => [dt, v * pk]), [dur, (o.points[o.points.length - 1][1] || 0) * pk], [dur + r, 0]]);
  } else if (dur > a) {
    k.env(amp.gain, when, [[0, 0], [a, pk], [dur, pk * (o.hold === undefined ? 0.9 : o.hold)], [dur + r, 0]]);
  } else {
    k.env(amp.gain, when, [[0, 0], [dur, pk * (dur / a)], [dur + r, 0]]);
  }

  let last = amp;
  if (o.trem) {
    // bowed tremolo: rapid bow changes, each a small re-attack
    const tg = k.gain(1 - (o.tremDepth || 0.45));
    const lfo = k.osc("sine", o.trem, when, end + 0.01);
    const dg = k.gain(o.tremDepth || 0.45);
    lfo.connect(dg).connect(tg.gain);
    amp.connect(tg);
    last = tg;
  }
  osc.connect(lp).connect(amp);
  last.connect(dest);

  if (o.noise) {
    // the hair catching the string
    const nz = k.noise("white", when, when + 0.1, { phase: ((o.seed || 1) * 0.377) % 5, seed: 12 });
    const bp = k.filter("bandpass", Math.min(7000, Math.max(2200, f * 4)), 0.9);
    const ng = k.gain(0);
    k.env(ng.gain, when, [[0, 0], [0.008, o.noise * pk], [0.05, o.noise * pk * 0.25], [0.095, 0]]);
    nz.connect(bp).connect(ng).connect(dest);
  }
  return end;
}

/** A section: several players on one note, apart in tuning and time. */
function section(k, dest, when, ev, players, base) {
  const f = hz(ev.midi);
  players.forEach(([cents, lag, rate], i) => {
    bow(k, dest, when + lag, f, Math.max(0.02, ev.dur - lag), { ...base, cents, vibRate: rate, vibPhase: i / players.length, noise: i === 0 ? base.noise : 0, seed: (ev.seed || 1) + i });
  });
}

// ---------------------------------------------------------------- instruments

const VLN1 = [[-6, 0, 5.7], [5, 0.006, 5.95], [0, 0.012, 5.55]];

/** First violins: the tune. Also the section's voice in the outro. */
function violins1(k, g, when, ev) {
  const dest = g.vln1 || g.out;
  section(k, dest, when, ev, VLN1, {
    a: ev.attack || 0.08,
    r: ev.release || 0.08,
    peak: 0.11 * (ev.vel === undefined ? 0.8 : ev.vel),
    points: ev.points,
    hold: 0.92,
    vib: ev.dur > 0.25 ? ev.vib || (ev.dur > 0.45 ? 9 : 6) : 0,
    vibDelay: 0.1,
    b0: 2.5,
    b1: 7,
    noise: 0.25,
  });
}

/** Second violins and violas: the swirls, detached, a quick bow; and the run. */
function swirl(k, g, when, ev) {
  const dest = ev.midi >= N("G4") ? g.vln2 || g.out : g.vla || g.out;
  const players = ev.players === 1 ? [[0, 0, 0]] : [[-5, 0, 0], [6, 0.008, 0]];
  section(k, dest, when, ev, players, {
    a: ev.attack || 0.02,
    r: ev.release || 0.05,
    peak: (ev.run ? 0.085 : 0.14) * ev.vel, // the run keeps its own level; the swirls are the sky and must be heard
    hold: 0.7,
    vib: 0,
    b0: 3,
    b1: 6,
    lpMin: ev.lpMin || 2600,
    noise: ev.noise || 0.35,
  });
}

/** Cellos: tenor line and bass, singing, slower vibrato. */
function cellos(k, g, when, ev) {
  section(k, g.vc || g.out, when, ev, [[-5, 0, 5.5], [6, 0.01, 5.8]], {
    a: 0.1,
    r: 0.12,
    peak: 0.072 * ev.vel,
    points: ev.points,
    hold: 0.85,
    vib: ev.dur > 0.25 ? 10 : 0,
    vibDelay: 0.14,
    b0: 3,
    b1: 9,
    noise: 0.15,
  });
}

/** The hushed chord: bowed tremolo, sul tasto (over the fingerboard: few upper partials). */
function tremolo(k, g, when, ev) {
  const dest = ev.midi < N("C3") ? g.vc || g.out : ev.midi < N("C4") ? g.vla || g.out : g.vln2 || g.out;
  section(k, dest, when, ev, [[-4, 0, 5.5], [5, 0.017, 5.85]], {
    a: ev.attack || 0.12,
    r: 0.1,
    peak: 0.09 * ev.vel,
    points: ev.points,
    vib: 6,
    vibDelay: 0.2,
    b0: 2,
    b1: 3.2,
    trem: ev.trem,
    tremDepth: 0.4,
  });
}

/** Double bass pizzicato: a finger-plucked gut string, a short low bloom. */
function pizzSamples(m) {
  const y = pluck({ f: hz(m), seconds: 1.7, t60: 1.0, bright: 0.18, pick: 0.27, soft: 0.95, noise: 0.03, seed: 120 + m, level: 0.9 });
  const z = onePole(onePole(y, 1100), 2400);
  fade(z, 0.002, 0.3);
  return normalize(z, 0.9);
}

function basses(k, g, when, ev) {
  const buf = k.buffer(`starry/pizz/${ev.midi}`, () => pizzSamples(ev.midi));
  const dest = g.cb || g.out;
  k.play(buf, when, { gain: 0.2 * ev.vel, detune: -4 }, dest);
  k.play(buf, when + 0.009, { gain: 0.14 * ev.vel, detune: 5 }, dest);
}

// ---------------------------------------------------------------- the score

/** The broken chords of the swirls: five tones from the bottom up, one chord per two-beat cell. */
const LADDERS = {
  D: ["A3", "D4", "F#4", "A4", "D5"],
  Bm7: ["B3", "D4", "F#4", "A4", "B4"],
  Gadd9: ["G3", "B3", "D4", "G4", "A4"],
  A7sus4: ["A3", "D4", "E4", "G4", "A4"],
  DF: ["F#3", "A3", "D4", "F#4", "A4"],
  G: ["D3", "G3", "B3", "D4", "G4"],
  A7: ["A3", "C#4", "E4", "G4", "A4"],
};
const UP = [0, 1, 2, 3, 4, 3, 2, 1];
const DOWN = [4, 3, 2, 1, 0, 1, 2, 3];

const PRE = 0.03; // bowed notes start this much early, so they are heard on the beat

export default {
  prepare() {
    prepareReverb("starry/hall", HALL);
    for (const n of ["D2", "B1", "G1", "A1", "F#1"]) sharedBuffer(`starry/pizz/${N(n)}`, () => pizzSamples(N(n)));
  },

  graph(k, out) {
    const master = k.gain(LEVEL);
    const hp = k.filter("highpass", 38, 0);
    master.connect(hp).connect(out);
    const send = k.gain(0.22);
    send.connect(k.reverb("starry/hall", HALL)).connect(master);
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
    return {
      send,
      vln1: bus(-0.32, [["peaking", 290, 1.2, 2.5], ["peaking", 2900, 1.1, 2.5], ["highshelf", 6500, 0, -7]]),
      vln2: bus(-0.12, [["peaking", 290, 1.2, 2], ["peaking", 2700, 1.1, 1.5], ["highshelf", 6000, 0, -8]]),
      vla: bus(0.14, [["peaking", 230, 1.2, 2.5], ["peaking", 2200, 1.1, 1.5], ["highshelf", 5000, 0, -8]]),
      vc: bus(0.3, [["peaking", 140, 1.0, 2.5], ["peaking", 1300, 1.0, 1.5], ["highshelf", 4000, 0, -9]]),
      cb: bus(0.38, [["lowpass", 2200, 0, 0]]),
    };
  },

  score(s) {
    const R = (b) => s.ridden(b);
    const len = (b, n) => R(b + n) - R(b);
    const speed = (u) => s.pelican(u).speed;

    // ---- first violins: the tune an octave up, on the ridden clock
    for (const note of s.theme({ octave: 1 })) {
      const at = note.beat === 0 ? 0 : R(note.beat) - PRE;
      let dur = R(note.beat + note.beats) - at + 0.02;
      if (note.beat === 11.5) dur = 5.95 - at; // the last eighth lands in tempo and leaves the D to the bell
      const ev = {
        lead: true,
        vel: note.beat === 4 || note.beat === 10 ? 1 : note.skeleton ? 0.85 : 0.72,
        attack: note.beat === 0 ? 0.05 : Math.min(0.09, Math.max(0.04, dur * 0.35)),
        label: "vln1",
      };
      if (note.beat === 11.5) {
        // ... and leaves the bell's entrance clear: the bow lifts at 5.93 and the release is over by u = 5.97
        dur = 5.93 - at;
        ev.release = 0.04;
      }
      if (note.beat === 5) {
        // the tune's A hangs over the stalled sky: falls to a hush, then swells with the spin-up
        ev.points = [[0.07, 0.8], [2.95 - at, 0.22], [R(5.3125) - at, 0.22], [R(5.5) - at, 0.85]];
        ev.vib = 7;
        ev.label = "vln1 (A hangs)";
      }
      s.note(violins1, at, dur, note.midi, ev.vel, ev);
    }
    s.cue(0, "the pelican comes through the frame", { soft: true });

    // ---- the swirls: broken chords in sixteenths, rising and falling, cell by cell
    const cells = [
      [0, "D"],
      [2, "Bm7"],
      [4, "Gadd9"],
      [6, "A7sus4"],
      [8, "DF"],
      [10, "G"],
    ];
    cells.forEach(([cb, chord], c) => {
      for (let i = 0; i < 8; i += 1) {
        const b = cb + i / 4;
        if (cb === 4 && b > 5.001) continue; // the sky stalls: the swirls stop after beat 5
        const name = cb === 10 && i >= 4 ? "A7" : chord;
        const ladder = LADDERS[name];
        const tone = ladder[(c % 2 === 0 ? UP : DOWN)[i]];
        const u = R(b);
        const gap = R(b + 0.25) - u;
        const v = speed(u);
        const slowing = u >= 2.2 && u < 3.0;
        const last = cb === 10 && i === 7; // the last swirl (5.875) is short, so the bell comes out of quiet
        s.note(swirl, u, last ? 0.05 : Math.max(0.05, Math.min(0.2, gap * 0.55)), N(tone), (i % 2 === 0 ? 0.62 : 0.5) * (slowing ? Math.max(0.35, v) : 1) * (u > 3.8 && u < 5.4 ? 1.15 : 1), {
          players: slowing ? 1 : 2,
          ...(last ? { release: 0.03 } : {}),
          label: `swirl ${name}`,
        });
      }
    });

    // ---- the spin-up: a run in thirty-seconds of the ridden clock, winding up into beat 6
    const RUN = ["D3", "E3", "F#3", "G3", "A3", "B3", "C#4", "D4", "E4", "F#4", "G4"];
    RUN.forEach((name, i) => {
      const b = 5.3125 + i / 16;
      const u = R(b);
      const gap = R(b + 1 / 16) - u;
      s.note(swirl, u, Math.max(0.04, gap * 1.05), N(name), (1.1 + 0.4 * (i / (RUN.length - 1))), {
        attack: 0.015,
        release: 0.04,
        run: true,
        // the first stroke bites: a brighter bow and more hair, so that it speaks in the band of its cue
        ...(i === 0 ? { attack: 0.01, lpMin: 5000, noise: 2 } : {}),
        label: "run",
      });
    });
    s.cue(R(5.3125), "the sky spins up: first stroke of the run", { band: [1500, 5000] });

    // ---- the hushed chord (A7sus4) in the crawl: tremolo, no pulse; it swells into the race
    const hush = R(5.1875);
    const hushEnd = R(6) + 0.02;
    [["A2", 12.3], ["E3", 11.1], ["G3", 13.4], ["D4", 12.0]].forEach(([name, trem], i) => {
      const at = hush; // not pre-rolled: the chord has a defined start on its cue
      s.note(tremolo, at, hushEnd - at, N(name), 1, {
        trem,
        attack: 0.04, // a quick bite to the hush level
        points: [[0.04, 0.26], [R(5.3125) - at, 0.26], [hushEnd - at - 0.02, 0.9]],
        seed: 40 + i,
        label: "hush A7sus4",
      });
    });
    s.cue(hush, "the crawl: one hushed chord", { soft: true, band: [90, 260] });

    // ---- cellos: tenor line and bass of each chord
    const CELLO = [
      // [beat, beats, tenor, bass]
      [0, 2, "A3", "D3"],
      [2, 1, "F#3", "B2"],
      [3, 1, "A3", null],
      [4, 1.6, "B3", "G2"],
      [6, 2, "D4", "A2"],
      [8, 2, "A3", "F#2"],
      [10, 1, "B3", "G2"],
      [11, 1, "C#4", "A2"],
    ];
    const bassLen = { 2: 2 };
    CELLO.forEach(([b, n, tenor, bass]) => {
      const at = b === 0 ? 0 : R(b) - PRE;
      let end = R(b + n) + 0.02;
      if (b === 4) end = 2.64; // dies away as the sky slows
      if (b === 11) end = 5.95;
      s.note(cellos, at, end - at, N(tenor), 0.75, { label: "vc tenor" });
      if (bass) {
        const bn = bassLen[b] || n;
        let bend = R(b + bn) + 0.02;
        if (b === 4) bend = 2.64;
        if (b === 11) bend = 5.95;
        s.note(cellos, at, bend - at, N(bass), b === 10 ? 0.45 : 0.6, { label: "vc bass" });
      }
    });

    // ---- basses: pizzicato on the first beat of each cell
    [[0, "D2"], [2, "B1"], [4, "G1"], [6, "A1"], [8, "F#1"], [10, "G1"]].forEach(([b, name]) => {
      s.note(basses, R(b), 1.6, N(name), b === 6 ? 1 : 0.85, { label: "cb pizz" });
    });
  },

  lead: violins1,
  leadOctave: 1,
  bike: { chain: 1, bell: 1 },
};
