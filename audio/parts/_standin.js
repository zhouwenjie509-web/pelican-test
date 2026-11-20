// Stand-ins: the tune on a plain plucked string, so that every part of the
// film sounds from the first day. A part file that still calls standin() has
// not been arranged yet (tools/audio.mjs --list shows which).

import { pluck } from "../engine/dsp.js";
import { hz, midi } from "../engine/theory.js";

/** One note of a plain plucked string. */
export function plainString(k, g, when, ev) {
  const buf = k.buffer(`standin/pluck/${ev.midi}`, () => pluck({ f: hz(ev.midi), seconds: 1.6, t60: 1.3, bright: 0.5, pick: 0.2, seed: 40 + Math.round(ev.midi * 10) }));
  k.play(buf, when, { gain: 0.45 * ev.vel }, g.out);
}

/** A section that only plays the tune. */
export function standin() {
  return {
    standin: true,
    score(s) {
      for (const note of s.theme()) s.note(plainString, note.u, note.dur, note.midi, note.skeleton ? 0.9 : 0.7, { lead: true });
      s.cue(0, "the pelican comes through the frame");
    },
    lead: plainString,
    leadOctave: 0,
  };
}

/** The intro until it is written: one low note that swells into the first crossing. */
export function standinIntro() {
  return {
    standin: true,
    score(s) {
      s.at(
        0,
        (k, g, when) => {
          const out = k.gain(0);
          const lp = k.filter("lowpass", 420, 0.5);
          for (const [note, cents] of [["D2", -6], ["D2", 7], ["A2", 0]]) k.osc("sawtooth", hz(midi(note)), when, when + 5.2, cents).connect(lp);
          lp.connect(out).connect(g.out);
          k.env(out.gain, when, [[0, 0], [1.2, 0.1], [4.6, 0.14], [5.2, 0]]);
        },
        { dur: 5.2 },
      );
    },
  };
}

/** The outro until it is written: the tune twice, the second time dying away. */
export function standinOutro() {
  return {
    standin: true,
    score(s) {
      for (let rep = 0; rep < 2; rep += 1) {
        for (const note of s.theme()) {
          const u = rep * 6 + note.u;
          if (u >= 9.5) continue;
          s.note(plainString, u, note.dur, note.midi, (rep ? 0.5 : 0.9) * Math.max(0.15, 1 - Math.max(0, u - 4) / 5.5));
        }
      }
    },
  };
}
