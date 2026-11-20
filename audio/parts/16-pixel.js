// Section 16 (pixel): the tune as level music on an invented four-channel
// sound chip: two pulse waves, one stepped triangle, one shift-register noise.
//
// The discipline is the style. Each channel plays one sound at a time; a new
// sound on a channel ends the one before it (score() refuses to build if two
// events on one channel overlap). Every parameter (pitch, duty, volume) is
// changed in steps by a 60 Hz "driver", volume in 16 steps, as on the real
// machines. When the pelican jumps, the sound effects (jump, coin, 1UP) take
// pulse B away from the harmony.
//
// How the sounds are made (all in plain arithmetic, nothing recorded):
//   pulse    a wavetable of 8 steps (duty 12.5, 25 or 50 %), made band-limited
//            by a polyBLEP correction at each step edge, DC removed
//   triangle the classic 32-step staircase (15..0..15), polyBLEP on every step,
//            fixed volume: on or off
//   noise    a 15-bit maximal-length linear-feedback shift register (taps
//            x^15 + x^14 + 1), computed once in prepare() and clocked at a
//            rate per drum (sample-and-hold), volume stepped per 60 Hz frame
// Every buffer starts and ends with a 2 ms raised-cosine fade; volume steps
// slew over 1 ms so they step without clicking.

import { SR, samples, biquad, fade } from "../engine/dsp.js";
import { sharedBuffer } from "../engine/kit.js";
import { hz, midi, theme } from "../engine/theory.js";

const FRAME = 1 / 60; // the driver's tick
const SIX = 0.125; // a sixteenth at 120 BPM: also the sprite's 8 Hz pose step

// --------------------------------------------------------------- the chip

/**
 * Output level per channel at volume 15 (the mix inside the chip). After the
 * review: pulse A (the tune) +3 dB, triangle -2 dB, noise -3 dB, so that the
 * tune is the loudest channel (was A 0.3, B 0.3, T 0.14, N 0.2).
 */
const DB = (d) => 10 ** (d / 20);
const CH_GAIN = { A: 0.3 * DB(3), B: 0.3, T: 0.14 * DB(-2), N: 0.2 * DB(-3) };
/** Gentle placement, nearly mono. */
const CH_PAN = { A: -0.08, B: 0.08, T: 0, N: 0 };

function pulseTable(duty) {
  const n = 8;
  const hi = Math.round(duty * n);
  const t = [];
  for (let i = 0; i < n; i += 1) t.push(i < hi ? 1 - duty : -duty); // zero mean: no DC
  return t;
}
const TABLES = {
  0.125: pulseTable(0.125),
  0.25: pulseTable(0.25),
  0.5: pulseTable(0.5),
  // 15 14 .. 1 0 0 1 .. 14 15, scaled to -1..1
  tri: Array.from({ length: 32 }, (_, i) => ((i < 16 ? 15 - i : i - 16) - 7.5) / 7.5),
};
/** The edges of a table: where the level changes, and by how much. */
const EDGES = {};
for (const [key, t] of Object.entries(TABLES)) {
  const e = [];
  for (let j = 0; j < t.length; j += 1) {
    const d = t[j] - t[(j + t.length - 1) % t.length];
    if (Math.abs(d) > 1e-9) e.push([j / t.length, d]);
  }
  EDGES[key] = e;
}

// The noise: a 15-bit LFSR, x^15 + x^14 + 1 (period 32767). Computed once.
const LFSR_LEN = 32767;
let LFSR = null;
function lfsr() {
  if (!LFSR) {
    LFSR = new Int8Array(LFSR_LEN);
    let r = 1;
    for (let i = 0; i < LFSR_LEN; i += 1) {
      LFSR[i] = r & 1 ? 1 : -1;
      const fb = (r ^ (r >> 1)) & 1;
      r = (r >> 1) | (fb << 14);
    }
  }
  return LFSR;
}

/**
 * The parameters of one event at t seconds after its start:
 * { f, wave, vol } for tones (wave: a duty or "tri"), { clock, vol } for noise.
 * vol is 0..15. Pitch and volume change per 60 Hz frame unless an effect
 * gives its own times (the coin's 30 ms notes).
 */
// eleven frames, 183 ms written; the 1UP takes the channel at 3.125, 65 ms into the A, at vol 7
const COIN_RING = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1, 0];
const VIB = [0, 7, 12, 7, 0, -7, -12, -7]; // cents, one value per frame: 7.5 Hz
function paramsAt(e, t) {
  const fr = Math.floor(t / FRAME + 1e-9);
  switch (e.kind) {
    case "tone": {
      const vol = fr === 0 ? e.vol : Math.max(e.sus, e.vol - 1 - Math.floor((fr - 1) / e.decay));
      const cents = e.vib !== undefined && fr >= e.vib ? VIB[(fr - e.vib) % 8] : 0;
      return { f: hz(e.midi + cents / 100), wave: e.duty, vol };
    }
    case "jump": {
      // 11 frames: a stepped upward sweep D5 -> A6, the duty narrowing half-way
      const k = Math.min(fr, 10);
      return { f: hz(midi("D5")) * 3 ** (k / 10), wave: k < 5 ? 0.5 : 0.25, vol: Math.max(4, 11 - Math.floor(k / 2)) };
    }
    case "coin": {
      // D7, F#7, A7 at 30 ms each; the A rings down over 150 ms (until the jingle takes the channel)
      if (t < 0.03) return { f: hz(midi("D7")), wave: 0.25, vol: 12 };
      if (t < 0.06) return { f: hz(midi("F#7")), wave: 0.25, vol: 12 };
      const k = Math.floor((t - 0.06) / FRAME + 1e-9);
      return { f: hz(midi("A7")), wave: 0.25, vol: COIN_RING[Math.min(k, COIN_RING.length - 1)] };
    }
    case "tri":
      return { f: hz(e.midi), wave: "tri", vol: 15 };
    case "kick": {
      // the triangle drops two octaves in six frames: the landing's weight
      const k = Math.min(fr, 6);
      return { f: hz(e.midi) * 0.25 ** (k / 6), wave: "tri", vol: 15 };
    }
    case "noise": {
      const vol = fr < e.vols.length ? e.vols[fr] : 0;
      const clock = e.clocks ? e.clocks[Math.min(fr, e.clocks.length - 1)] : e.clock;
      return { clock, vol };
    }
    default:
      throw new Error(`pixel: unknown kind ${e.kind}`);
  }
}

/** One event's samples. */
function render(e) {
  const n = samples(e.len);
  let y = new Float32Array(n);
  const gain = CH_GAIN[e.ch] / 15;
  const slew = 15 / (0.001 * SR); // a full volume swing takes 1 ms
  const noise = e.kind === "noise" ? lfsr() : null;
  let phase = 0;
  let nIdx = e.kind === "noise" ? Math.round(e.u * 4801) % LFSR_LEN : 0;
  let vol = 0;
  let p = null;
  let block = -1;
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    const b = Math.floor(t * 2000); // parameters are read every half millisecond
    if (b !== block) {
      block = b;
      p = paramsAt(e, t);
    }
    vol += Math.max(-slew, Math.min(slew, p.vol - vol));
    let v;
    if (noise) {
      v = noise[nIdx];
      phase += p.clock / SR;
      while (phase >= 1) {
        phase -= 1;
        nIdx = (nIdx + 1) % LFSR_LEN;
      }
    } else {
      const table = TABLES[p.wave];
      const dt = p.f / SR;
      v = table[Math.floor(phase * table.length) % table.length];
      for (const [pos, d] of EDGES[p.wave]) {
        let x = phase - pos;
        if (x < 0) x += 1;
        if (x < dt) {
          x /= dt;
          v += (d / 2) * (x + x - x * x - 1);
        } else if (x > 1 - dt) {
          x = (x - 1) / dt;
          v += (d / 2) * (x * x + x + x + 1);
        }
      }
      phase += dt;
      if (phase >= 1) phase -= 1;
    }
    y[i] = v * vol * gain;
  }
  // dsp.biquad returns a new array: keep it
  if (e.hp) y = biquad(y, "highpass", e.hp, 0.7071);
  if (e.lp) y = biquad(y, "lowpass", e.lp, 0.7071);
  return fade(y, 0.002, 0.002);
}

const keyOf = (e) => `pixel/${e.ch}/${e.kind}/${e.u.toFixed(4)}`;

/** The play function of every event: its buffer, on its channel. */
function chip(k, g, when, ev) {
  const buf = k.buffer(keyOf(ev), () => render(ev));
  k.play(buf, when, { gain: 1, pan: CH_PAN[ev.ch] }, g.bus || g.out);
}

// --------------------------------------------------------------- the score

let EVENTS = null;
/** Every event of the part: { ch, u, len, kind, ... }. Plain arithmetic, shared by score() and prepare(). */
function chipEvents() {
  if (EVENTS) return EVENTS;
  const ev = [];
  const add = (e) => ev.push(e);

  // ---- pulse A: the tune an octave up (D5 .. B5; bar 3 ends B4 A4 B4)
  for (const note of theme({ octave: 1 })) {
    const held = note.u === 3.0;
    const bar2 = note.u >= 2.0 && note.u < 3.0;
    add({
      ch: "A",
      kind: "tone",
      u: note.u,
      len: held ? note.dur - 0.02 : note.dur - 2 * FRAME, // the driver releases a note two frames early
      midi: note.midi,
      duty: held ? 0.5 : bar2 ? 0.125 : 0.25,
      vol: note.skeleton ? 13 : 12,
      sus: held ? 9 : 10,
      decay: 3,
      vib: held ? 15 : undefined,
      lead: true,
      label: "A tune",
    });
  }

  // ---- pulse B: broken chords in sixteenths, then the effects, then thirds under the tune
  const arp = (u, names) => names.forEach((nm, i) => add({ ch: "B", kind: "tone", u: u + i * SIX, len: 0.09, midi: midi(nm), duty: 0.125, vol: 7, sus: 5, decay: 2, label: "B arp" }));
  for (let b = 0; b < 4; b += 1) arp(b * 0.5, ["D4", "F#4", "A4", "D5"]); // D, bar 1
  arp(2.0, ["G4", "B4", "D5", "B4"]); // G, under the top of the tune
  add({ ch: "B", kind: "jump", u: 2.5, len: 0.18, label: "B jump" });
  add({ ch: "B", kind: "coin", u: 3.0, len: 0.125, label: "B coin" }); // cut by the jingle at 3.125
  [["D6", 3.125], ["E6", 3.1875], ["F#6", 3.25], ["A6", 3.3125]].forEach(([nm, u]) =>
    add({ ch: "B", kind: "tone", u, len: 0.0625, midi: midi(nm), duty: 0.5, vol: 11, sus: 10, decay: 2, label: "B 1UP" }),
  );
  add({ ch: "B", kind: "tone", u: 3.375, len: 0.125, midi: midi("D7"), duty: 0.5, vol: 11, sus: 7, decay: 1, label: "B 1UP" });
  arp(3.625, ["E4", "A4", "C#5"]); // A, after the landing
  // bar 3: a sixth under the tune, all the way down (A4 G4 F#4 | D4 C#4 D4)
  [["A4", 4.0, 0.5], ["G4", 4.5, 0.25], ["F#4", 4.75, 0.25], ["D4", 5.0, 0.5], ["C#4", 5.5, 0.25], ["D4", 5.75, 0.25]].forEach(([nm, u, d]) =>
    add({ ch: "B", kind: "tone", u, len: d - 2 * FRAME, midi: midi(nm), duty: 0.25, vol: 8, sus: 6, decay: 3, label: "B under" }),
  );

  // ---- triangle: the bass, bouncing in octaves on eighths
  const bounce = (u, lo, count) => {
    for (let i = 0; i < count; i += 1) add({ ch: "T", kind: "tri", u: u + i * 0.25, len: 0.2, midi: midi(lo) + (i % 2 ? 12 : 0), label: "T bass" });
  };
  bounce(0, "D2", 8); // D
  bounce(2.0, "G2", 4); // G
  add({ ch: "T", kind: "tri", u: 3.0, len: 0.45, midi: midi("A2"), label: "T bass" }); // A, held under the coin
  add({ ch: "T", kind: "kick", u: 3.5, len: 0.12, midi: midi("A3"), label: "T landing drop" });
  add({ ch: "T", kind: "tri", u: 3.75, len: 0.2, midi: midi("A3"), label: "T bass" });
  bounce(4.0, "D2", 4); // D
  bounce(5.0, "G2", 2); // G
  bounce(5.5, "A2", 2); // A

  // ---- noise: hat on every sixteenth (the sprite's pedalling), snare on 2 and 4
  const HAT = { kind: "noise", clock: 44000, hp: 6000, len: 0.045, label: "N hat" };
  const SNARE = { kind: "noise", clocks: [24000, 9000], hp: 180, len: 0.24, vols: [12, 11, 9, 8, 7, 6, 5, 4, 3, 3, 2, 2, 1, 1], label: "N snare" };
  const snareAt = new Map([[0.5, 1], [1.5, 1], [4.5, 1], [5.5, 0.125], [5.625, 0.125], [5.75, 0.125], [5.875, 0.125]]);
  // the fill falls away towards the frame (after the review; it was 8 9 10 11), so the bell's D stands clear above it
  const fill = [8, 7, 6, 5];
  for (let j = 0; j < 48; j += 1) {
    const u = j * SIX;
    if (u >= 2.5 && u < 3.625) continue; // in the air nothing pedals; pedalling resumes at 3.625
    if (snareAt.has(u)) {
      const fi = Math.round((u - 5.5) / SIX);
      const isFill = u >= 5.5;
      // the last stroke of the fill is short, so the bell's D comes out of a clean gap at u = 6
      const len = isFill ? (u === 5.875 ? 0.075 : SIX - 0.003) : 0.24;
      const peak = isFill ? fill[fi] : 12;
      add({ ...SNARE, ch: "N", u, len, vols: SNARE.vols.map((v) => Math.max(0, v - (12 - peak))), label: isFill ? "N fill" : "N snare" });
      continue;
    }
    if (snareAt.has(u - SIX) && u < 5.5) continue; // the snare still sounds
    add({ ...HAT, ch: "N", u, vols: j % 2 ? [4, 2] : [6, 3] });
  }
  add({ ch: "N", kind: "noise", u: 3.5, len: 0.11, clocks: [2400, 1500, 1000], lp: 1800, hp: 40, vols: [15, 12, 8, 5, 2, 1], label: "N landing" });

  // one sound per channel at a time
  for (const ch of ["A", "B", "T", "N"]) {
    const list = ev.filter((e) => e.ch === ch).sort((a, b) => a.u - b.u);
    for (let i = 1; i < list.length; i += 1) {
      if (list[i - 1].u + list[i - 1].len > list[i].u + 1e-9) throw new Error(`pixel: channel ${ch} overlaps at u=${list[i].u}`);
    }
    if (list.length && list[list.length - 1].u + list[list.length - 1].len > 6 + 1e-9) throw new Error(`pixel: channel ${ch} sounds past u=6`);
  }
  EVENTS = ev;
  return ev;
}

/** The part's own voice for the outro: one pulse-A note (25 % duty). */
const leadLen = (dur) => Math.max(0.06, (dur || 0.5) - 2 * FRAME); // the driver releases two frames early
const leadTone = (m, len) => ({ ch: "A", kind: "tone", u: 0, len, midi: m, duty: 0.25, vol: 13, sus: 10, decay: 3 });
const leadKey = (m, len) => `pixel/lead/${m}/${len.toFixed(4)}`;
/** Made in prepare(): D major from A4 to D6 (the tune's range in leadOctave 1, and its octave), at the tune's three lengths. */
const LEAD_MIDIS = [69, 71, 73, 74, 76, 78, 79, 81, 83, 85, 86];
const LEAD_LENS = [0.25, 0.5, 1.0].map(leadLen);
function leadVoice(k, g, when, ev) {
  const len = leadLen(ev.dur);
  const gain = 0.9 * DB(-3) * (ev.vel === undefined ? 1 : ev.vel); // DB(-3) undoes pulse A's +3 dB inside the chip: the outro hears this voice as before
  // A tone's frames depend only on time since its start, so a longer prepared note, ended at
  // `len` with a 2 ms fade, is the same sound. Only a pitch or length outside the prepared set is made here.
  const fit = LEAD_MIDIS.includes(ev.midi) ? LEAD_LENS.find((l) => l >= len - 1e-9) : undefined;
  const made = fit === undefined ? len : fit;
  const buf = k.buffer(leadKey(ev.midi, made), () => render(leadTone(ev.midi, made)));
  k.play(buf, when, made > len + 1e-9 ? { gain, dur: len, fade: 0.002 } : { gain }, g.out);
}

export default {
  async prepare() {
    lfsr();
    for (const e of chipEvents()) sharedBuffer(keyOf(e), () => render(e));
    for (const m of LEAD_MIDIS) for (const len of LEAD_LENS) sharedBuffer(leadKey(m, len), () => render(leadTone(m, len)));
  },

  graph(k, out) {
    const bus = k.gain(0.613); // 0.62 before the review; back to -20 LUFS after the re-balance
    bus.connect(out);
    return { bus };
  },

  score(s) {
    for (const e of chipEvents()) {
      s.at(e.u, chip, { ...e, dur: e.len, vel: (e.vol || 15) / 15, channel: e.ch });
    }
    s.cue(0, "the pelican rides onto the pier");
    s.cue(2.5, "take-off: the jump sweep", { band: [520, 760] });
    s.cue(3.125, "1UP: the jingle's first note, D6", { band: [1100, 1250] });
    s.cue(3.0, "the token is collected: the coin", { band: [2000, 9000] });
    s.cue(3.5, "landing: thud and triangle drop", { band: [40, 400] });
  },

  lead: leadVoice,
  leadOctave: 1,
  bike: { chain: 0, bell: 1 },
};

// For scratch checks in Node (dev/audio/pixel-*.js): the event list and the sample maker.
export const _pixel = { chipEvents, render, keyOf };
