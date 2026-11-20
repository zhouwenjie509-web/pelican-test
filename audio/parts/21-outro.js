// Outro (125.0 - 137.0): the press conference.
//
// Twenty answers on one wall, so all twenty play the tune at once: every
// section's own voice (its `lead`, through a copy of its own graph), placed
// by register, by who can run and who must hold, and across the stereo field
// from the oldest on the left to the newest on the right. Under them, plainly,
// the string orchestra of Section 12 on the chords (bowed here as Section 12
// bows, through a second copy of its own hall and desks), a bowed double bass
// on the roots and a broad drum on the beats.
//
// From 129.0 the orchestra drains away an era at a time (sections 1-7 stop at
// 129, 8-12 at 130, except the sitar, which at last plays the whole of the bar
// its own section left out and stops at 131); at 131 the tune begins again,
// quieter, on sections 13-20 only, thinning at 132 and 132.5; from 133 the piano of Section 20 is alone,
// very softly: B, A, F#, and the E it holds and lets die. It never plays the
// D. From 135.0 nothing of ours sounds: the single bell is the bicycle's.
//
// Five camera flashes (129, 130, 131, 132, 132.5): photographers we never
// see. Each is a shutter's click, a soft burst and a faint whine rising for a
// third of a second as the flash recharges. Quiet: they are in the room, not
// in the music.
//
// How the sounds are made (nothing recorded):
//   voices   each section's lead(), unchanged, through k.subgraph(id, node):
//            node = this part's level and pan for that voice; a fader event
//            closes the node when the voice stops, so no tail outlives it
//   strings  a band-limited Helmholtz (bowed) wave with bow-position notches,
//            lowpass opening as the bow bites, no vibrato, one player a desk
//            (the tutti above is thick enough, and sources are counted), into
//            Section 12's own desks (vln2, vla, vc, cb) and hall
//   drum     the modes of a large round skin (1, 1.59, 2.14, 2.30, 2.65 x 73.4 Hz:
//            tuned to D2), the low ones ringing longest (0.5 s), and a felt beater's soft thud
//   flash    two clicks of a leaf shutter, a short burst of filtered noise, a
//            sine that glides up from 2.6 to 4.4 kHz over 0.33 s, very faint

import { sharedBuffer } from "../engine/kit.js";
import { SR, samples, modal, white, biquad, onePole, envelope, mixInto, normalize, fade } from "../engine/dsp.js";
import { hz, midi, theme } from "../engine/theory.js";

const N = (name) => midi(name);

// ---------------------------------------------------------------- the twenty voices

/**
 * [id, section, file, octave, mode]. octave: whole octaves from written pitch (D4).
 * mode "run": plays every note of the tune (instruments that speak quickly);
 * "hold": the six skeleton notes only, each for its written length.
 */
const VOICES = [
  ["sahara", 1, "01-sahara.js", -1, "hold"], // the caller: chant, an octave down
  ["egypt", 2, "02-egypt.js", 0, "run"], // arched harp
  ["han", 3, "03-han.js", 0, "run"], // chime bells
  ["tang", 4, "04-tang.js", 0, "run"], // pipa
  ["song", 5, "05-song.js", -1, "hold"], // guqin, an octave down
  ["qingming", 6, "06-qingming.js", 1, "run"], // dizi, above
  ["maya", 7, "07-maya.js", 1, "run"], // clay flute, above
  ["mughal", 8, "08-mughal.js", 0, "run"], // sitar
  ["bada", 9, "09-bada.js", 0, "hold"], // xiao
  ["wayang", 10, "10-wayang.js", 0, "run"], // saron
  ["ukiyoe", 11, "11-ukiyoe.js", 0, "run"], // shamisen
  ["starry", 12, "12-starry.js", 1, "hold"], // first violins
  ["scream", 13, "13-scream.js", -1, "hold"], // violas and cello, an octave down
  ["nosferatu", 14, "14-nosferatu.js", -1, "run"], // cinema piano, an octave down (its short notes; see leadEvent)
  ["scope", 15, "15-scope.js", 1, "run"], // sine beeps, above
  ["pixel", 16, "16-pixel.js", 1, "run"], // chip pulse, above
  ["chat", 17, "17-chat.js", 1, "run"], // ring-tone FM, above
  ["vapor", 18, "18-vapor.js", 0, "hold"], // FM saxophone
  ["shortvideo", 19, "19-shortvideo.js", 2, "run"], // bell hook, two octaves up
  ["code", 20, "20-code.js", 0, "run"], // the piano: the last word
];

/** Linear level of each voice in this mix (set by measuring each alone). */
const LEVEL = {
  sahara: 0.344, egypt: 0.29, han: 0.22, tang: 0.337, song: 0.435, qingming: 0.273, maya: 0.27, mughal: 0.206, bada: 0.519, wayang: 0.309,
  ukiyoe: 0.35, starry: 0.272, scream: 0.348, nosferatu: 0.174, scope: 0.417, pixel: 0.335, chat: 0.595, vapor: 0.09, shortvideo: 0.145, code: 0.263,
};
/** All twenty together, against the strings, bass and drum. */
const TUTTI = 0.72;
const MASTER = 1.62;
const KNEE = 0.6;
const STRINGS = 0.25; // 6 dB under where they were first set: under the tutti the chords support, the tune leads

/** Oldest on the left, newest on the right. */
const panOf = (n) => -0.6 + (1.2 * (n - 1)) / 19;

/** When each voice stops playing (u): 1-7 at 129, 8-12 at 130, 13-16 at 132, 17-19 at 132.5, the piano last. */
const stopOf = (n) => (n === 8 ? 6 : n <= 7 ? 4 : n <= 12 ? 5 : n <= 16 ? 7 : n <= 19 ? 7.5 : 10);

/** The whole's dynamic: grows to full by 2.0, fades from 4.0, quieter the second time. */
function dyn(u) {
  if (u < 2) return 0.62 + 0.38 * (u / 2);
  if (u < 4) return 1;
  if (u < 6) return 1 - 0.1 * (u - 4);
  if (u < 8) return 0.62 - 0.08 * (u - 6);
  return 1;
}

/** The piano alone, 133.0-134.0: B A F# and the held E (u, dur, note, vel). */
const LAST_WORD = [
  [8.0, 0.48, "B4", 0.36],
  [8.5, 0.24, "A4", 0.3],
  [8.75, 0.24, "F#4", 0.3],
  [9.0, 0.62, "E4", 0.32],
];

/** Every note each voice plays: { id, n, u, dur, midi, vel }. Plain arithmetic, used by score(). */
function plan() {
  const out = [];
  const tune = theme();
  for (const [id, n, , oct, mode] of VOICES) {
    const stop = stopOf(n);
    for (const rep of [0, 1]) {
      for (const note of tune) {
        const u = rep * 6 + note.u;
        if (u >= stop - 1e-6) continue;
        if (rep === 1 && u >= 8 - 1e-6) continue; // the piano's last word is written apart
        if (mode === "hold" && !note.skeleton) continue;
        // a hold is the skeleton note for its written length (0.5 s, the held E 1.0 s) and the lead's
        // own release: the running eighths after it are heard
        let dur = mode === "hold" ? note.dur - 0.04 : note.dur - 0.02;
        dur = Math.min(dur, stop - u);
        const base = mode === "hold" ? 0.8 : note.skeleton ? 0.85 : 0.7;
        out.push({ id, n, u, dur, midi: note.midi + 12 * oct, vel: base * dyn(u), skeleton: note.skeleton, beat: note.beat });
      }
    }
  }
  for (const [u, dur, name, vel] of LAST_WORD) out.push({ id: "code", n: 20, u, dur, midi: N(name), vel, last: true });
  return out;
}

/** What each voice's lead is given: midi, dur, vel, and nothing of ours (some leads read ev.u). */
function leadEvent(id, ev) {
  let dur = ev.dur;
  if (id === "tang") dur = Math.min(dur, 0.42); // single strokes: a roll is a dozen sources, and lost in the tutti
  // the cinema piano an octave down: below A3 it has only its short buffers (0.75 s), so those notes
  // stay short; from A3 up it has both, and each note asks for its own length
  if (id === "nosferatu" && ev.midi < N("A3")) dur = Math.min(dur, 0.62);
  // the violas and cello without vibrato: plain, and three LFOs fewer a note
  if (id === "scream") return { midi: ev.midi, dur, vel: ev.vel, vibCents: 0 };
  return { midi: ev.midi, dur, vel: ev.vel };
}

// ---------------------------------------------------------------- bowed strings (after Section 12)

const BOW_SINES = (() => {
  const a = [0];
  const beta = 1 / 8.6;
  for (let n = 1; n <= 48; n += 1) a.push(((1 / n) * (0.2 + 0.8 * Math.abs(Math.sin(Math.PI * n * beta)))) / Math.abs(Math.sin(Math.PI * beta)));
  return a;
})();

/** One player drawing one bow. o: { cents, a, r, peak, vib, vibRate, b0, b1 } */
function bow(k, dest, when, f, dur, o) {
  const end = when + dur + o.r;
  const osc = k.osc(k.wave("outro/bow", BOW_SINES), f, when, end + 0.01, o.cents || 0);
  if (o.vib) {
    const lfo = k.lfo(o.vibRate, when, end + 0.01, o.phase || 0);
    const depth = k.gain(0);
    lfo.connect(depth).connect(osc.detune);
    k.env(depth.gain, when, [[0, 0], [0.15, 0], [0.4, o.vib]]);
  }
  const f0 = Math.min(9000, f * o.b0);
  const f1 = Math.min(9000, f * o.b1);
  const lp = k.filter("lowpass", f0, 0);
  k.env(lp.frequency, when, [[0, f0], [o.a * 1.3, f1]]);
  const amp = k.gain(0);
  if (dur > o.a) k.env(amp.gain, when, [[0, 0], [o.a, o.peak], [dur, o.peak * 0.9], [dur + o.r, 0]]);
  else k.env(amp.gain, when, [[0, 0], [dur, o.peak * (dur / o.a)], [dur + o.r, 0]]);
  osc.connect(lp).connect(amp).connect(dest);
}

/** One player a desk, no vibrato: plainly, and few sources (the tutti above is already twenty voices thick). */
const DESK = [[0, 0]];

/** A string section on one note of the chords. ev.desk: "vln2" | "vla" | "vc" | "cb" (the bass: one player). */
function strings(k, g, when, ev) {
  const sg = g.strings || {};
  const dest = sg[ev.desk] || sg.out || g.bus || g.out;
  const f = hz(ev.midi);
  const low = ev.desk === "cb";
  (low ? [[0, 0.006]] : DESK).forEach(([cents, lag]) => {
    bow(k, dest, when + lag, f, Math.max(0.05, ev.dur - lag), {
      cents,
      a: low ? 0.14 : 0.12,
      r: ev.release || 0.2,
      peak: (low ? 0.14 : 0.085) * ev.vel,
      b0: 2,
      // over the fingerboard: few upper partials, under the tune (the bass darkest: its fifth harmonic,
      // a just major third two octaves up, would otherwise sit 14 cents under the tune's F#)
      b1: low ? 3 : 4.5,
    });
  });
}

/** The chords (u, dur, upper three, bass): | D . . . | G . A . | D/F# . G A | D . . . | */
const CHORDS = [
  [0, 2, ["A3", "D4", "F#4"], "D2"],
  [2, 1, ["B3", "D4", "G4"], "G2"],
  [3, 1, ["C#4", "E4", "A4"], "A2"],
  [4, 1, ["F#3", "A3", "F#4"], "F#2"], // D/F#: the tune's F# on top, no D under it
  [5, 0.5, ["B3", "D4", "G4"], "G2"],
  [5.5, 0.5, ["C#4", "E4", "A4"], "A2"],
  [6, 2, ["D3"], null], // the second time: only the cellos' D, quiet, low and out of the piano's way
];

// ---------------------------------------------------------------- drum and flash (buffers)

function drumSamples() {
  const f = hz(N("D2")); // the skin tuned to the key's D (73.4 Hz)
  const y = modal(
    [
      { f, a: 1.0, t60: 0.5 },
      { f: f * 1.59, a: 0.5, t60: 0.5, phase: 0.7 },
      { f: f * 2.14, a: 0.32, t60: 0.36, phase: 1.9 },
      { f: f * 2.3, a: 0.22, t60: 0.3, phase: 2.6 },
      { f: f * 2.65, a: 0.15, t60: 0.24, phase: 0.4 },
    ],
    1.2,
    { attack: 0.006 },
  );
  // the felt beater: a soft low thud of noise
  const thud = onePole(onePole(white(samples(0.06), 58), 500), 500);
  envelope(thud, [[0, 0], [0.003, 1], [0.02, 0.3], [0.06, 0]]);
  mixInto(y, normalize(thud, 1), 0, 0.35);
  return normalize(fade(biquad(y, "highpass", 35, 0.7), 0.001, 0.2), 0.9);
}

function flashSamples(seed) {
  const y = new Float32Array(samples(0.42));
  // the shutter: two small clicks, the leaves opening and closing
  for (const [at, g] of [[0, 1], [0.011, 0.6]]) {
    const c = biquad(white(samples(0.004), seed + at * 1000), "bandpass", 5200, 1.1);
    envelope(c, [[0, 0], [0.0003, 1], [0.0015, 0.3], [0.004, 0]]);
    mixInto(y, c, at, g);
  }
  // the burst: a short breath of filtered noise
  const b = biquad(biquad(white(samples(0.06), seed + 7), "highpass", 900, 0.7), "lowpass", 6500, 0.7);
  envelope(b, [[0, 0], [0.002, 1], [0.012, 0.35], [0.06, 0]]);
  mixInto(y, b, 0.001, 0.35);
  // the recharge: a faint whine rising for a third of a second
  const t0 = 0.03;
  const len = 0.36;
  let ph = 0;
  const n0 = Math.round(t0 * SR);
  for (let i = 0; i < Math.round(len * SR); i += 1) {
    const t = i / SR;
    const fr = 2600 * (4400 / 2600) ** Math.min(1, t / 0.33);
    ph += (2 * Math.PI * fr) / SR;
    const a = Math.min(1, t / 0.03) * Math.min(1, Math.max(0, (len - t) / 0.05));
    y[n0 + i] += 0.035 * a * Math.sin(ph);
  }
  return normalize(fade(y, 0.0003, 0.01), 0.9);
}

function drum(k, g, when, ev) {
  const { out } = k.play(k.buffer("outro/drum", drumSamples), when, { gain: 0.17 * ev.vel, pan: -0.05 }, g.bus);
  if (g.strings && g.strings.send) out.connect(g.strings.send);
}

function flash(k, g, when, ev) {
  k.play(k.buffer(`outro/flash/${ev.variant}`, () => flashSamples(500 + 31 * ev.variant)), when, { gain: 0.1 * ev.vel, pan: ev.pan }, g.bus);
}

/** Closes a voice (or the strings) after it stops: whatever still rings is gone with it. */
function fader(k, g, when, ev) {
  const node = ev.voice === "strings" ? g.stringsIn : g.nodes && g.nodes[ev.voice];
  if (!node) return;
  const level = ev.voice === "strings" ? STRINGS : TUTTI * LEVEL[ev.voice];
  k.env(node.gain, when, [[0, level], [ev.dur, 0]]);
}

/** Lead notes as the checker should read them: silent markers at the written pitch. */
function marker() {}

// ---------------------------------------------------------------- the part

/** For scratch checks in Node (dev/audio/outro-*.js). */
export const _outro = { plan, VOICES, leadEvent, stopOf };

export default {
  async prepare() {
    sharedBuffer("outro/drum", drumSamples);
    for (let v = 0; v < 5; v += 1) sharedBuffer(`outro/flash/${v}`, () => flashSamples(500 + 31 * v));
    // the twenty leads' own buffers are made by their sections' own prepare()
  },

  graph(k, out) {
    // a gentle knee on the whole: linear below about -16 dBFS, it rounds the few crests where twenty
    // attacks meet (a crest of -4 dBFS comes out near -6.5)
    const bus = k.gain(MASTER);
    const knee = k.shaper("outro/knee", (x) => KNEE * Math.tanh(x / KNEE));
    bus.connect(knee).connect(k.filter("highpass", 30, 0)).connect(out);
    const voices = {};
    const nodes = {};
    for (const [id, n] of VOICES) {
      const node = k.gain(TUTTI * LEVEL[id]);
      node.connect(k.pan(panOf(n))).connect(bus);
      nodes[id] = node;
      voices[id] = typeof k.subgraph === "function" ? k.subgraph(id, node) : { out: node };
      if (!voices[id]) voices[id] = { out: node };
    }
    const stringsIn = k.gain(STRINGS);
    stringsIn.connect(bus);
    const sg = typeof k.subgraph === "function" ? k.subgraph("starry", stringsIn) : null;
    return { bus, voices, nodes, stringsIn, strings: sg || { out: stringsIn } };
  },

  score(s) {
    const parts = s.parts || new Map();

    // ---- the twenty voices
    const missing = new Set();
    for (const ev of plan()) {
      const part = parts.get(ev.id);
      if (!part || typeof part.lead !== "function") {
        missing.add(ev.id);
        continue;
      }
      const lead = part.lead;
      const id = ev.id;
      const play = (k, g, when, e) => lead(k, g.voices[id], when, leadEvent(id, e));
      // players are never exactly together: up to 12 ms behind the beat (the first downbeat is exact)
      const late = ev.u === 0 && ev.n % 4 === 1 ? 0 : 0.004 * ((ev.n * 3) % 4);
      s.note(play, ev.u + late, ev.dur, ev.midi, ev.vel, { beat: ev.beat, lead: !!ev.last, label: `voice:${id}${ev.last ? " (the last word)" : ""}` });
    }
    // each voice is closed when it stops, so no tail outlives it
    for (const [id, n] of VOICES) {
      if (missing.has(id)) continue;
      const stop = stopOf(n);
      if (n === 20) s.at(9.45, fader, { voice: id, dur: 0.42, label: `fade:${id}` });
      else s.at(stop, fader, { voice: id, dur: 1.0, label: `fade:${id}` });
    }

    // ---- the tune as the checker should read it (written pitch), while the tutti plays
    for (const rep of [0, 1]) {
      for (const note of theme()) {
        const u = rep * 6 + note.u;
        if (u >= 8 - 1e-6) continue;
        s.note(marker, u, note.dur, note.midi, 0, { lead: true, label: "tune" });
      }
    }

    // ---- the strings on the chords, the bass on the roots
    CHORDS.forEach(([u, dur, upper, bass], i) => {
      const at = u === 0 ? 0 : u - 0.03;
      const last = i === CHORDS.length - 1;
      // the last is let go at 132.85 and gone (a 0.12 s release) by 132.97: from 133.0 the piano is alone
      const len = u + dur + (last ? -0.15 : 0.03) - at;
      // the last, under the second statement, is a quiet pedal (about 9 dB under the first time's, and
      // without the bass): the tune leads it
      const vel = last ? 0.4 : 0.85 * (u < 2 ? 0.75 : u >= 4 ? 0.9 : 1);
      ["vc", "vla", "vln2"].slice(0, upper.length).forEach((desk, j) => s.note(strings, at, len, N(upper[j]), vel, { desk, release: 0.12, label: "strings" }));
      if (bass) s.note(strings, at, len, N(bass), vel, { desk: "cb", release: 0.12, label: "bass" });
    });
    s.at(8.1, fader, { voice: "strings", dur: 0.9, label: "fade:strings" });

    // ---- the drum on the beats, bar 1 to the second downbeat
    for (let b = 0; b <= 12; b += 1) {
      const u = b * 0.5;
      const strong = b % 4 === 0 ? 1 : b % 2 === 0 ? 0.78 : 0.6;
      s.at(u, drum, { dur: 1.2, vel: strong * (u >= 6 ? 0.45 : dyn(u)), label: "drum" });
    }

    // ---- the flashes
    [[4.0, -0.4], [5.0, 0.3], [6.0, -0.15], [7.0, 0.45], [7.5, -0.3]].forEach(([u, pan], i) => {
      s.at(u, flash, { dur: 0.42, variant: i, pan, vel: 1, label: "flash" });
      s.cue(u, `camera flash ${i + 1}`, { band: [7000, 12000] });
    });
    s.cue(0, "the pelican goes through the last frame: tutti");
  },

  /** The outro's own voice, if anyone asks: one note of the strings on the chords. */
  lead: strings,
  leadOctave: 0,
  bike: { chain: 1, bell: 1 },
};
