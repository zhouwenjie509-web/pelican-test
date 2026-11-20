// Writing a part's events.
//
// A part's score(s) function receives a Score and lists what sounds when.
// Times are in seconds from the part's own start (`u`, the same u the scene
// code uses), so a section's music is written against the same clock as its
// picture. score() is plain arithmetic: it must not touch Web Audio, so that
// the list can also be printed and checked in Node.

import { BEAT, T_SECTION } from "../../src/beat/timeline.js";
import { theme as themeNotes } from "./theory.js";

export class Score {
  /**
   * part   the part being written
   * t0     film time of the part's u = 0
   * ride   { at(t), beatTime(n, beat) } from the picture (see soundtrack.js)
   */
  constructor(part, t0, ride) {
    this.part = part;
    this.n = part.n;
    this.t0 = t0;
    this.ride = ride;
    this.events = [];
    this.cues = [];
  }

  /**
   * Schedule a sound at u seconds. play(k, g, when, ev) is called when the
   * event is about to sound: k is the Kit, g the part's graph (what its
   * graph() returned, plus g.out), `when` the context time of the event and
   * ev this event's data (ev.u, ev.dur, anything passed in `data`).
   *
   * data.dur       how long it sounds, in seconds (used for printing and for seeking)
   * data.seekable  true if play() can start part-way through using ev.offset
   *                (long sounds only: drones, beds, a tape)
   */
  at(u, play, data = {}) {
    if (typeof play !== "function") throw new Error(`${this.part.id}: at(${u}) needs a play function`);
    if (!Number.isFinite(u)) throw new Error(`${this.part.id}: event time is not a number`);
    const ev = { dur: 0, ...data, u, t: this.t0 + u, play, part: this.part };
    this.events.push(ev);
    return ev;
  }

  /** A note: inst(k, g, when, ev) with ev.midi, ev.dur (seconds) and ev.vel (0..1). */
  note(inst, u, dur, midi, vel = 0.8, more = {}) {
    return this.at(u, inst, { dur, midi, vel, ...more });
  }

  /** The main melody as notes (see theory.theme); u and dur are ready to pass to note(). */
  theme(options) {
    return themeNotes(options);
  }

  /** Seconds from the part's start for a beat number (beat 0 is the downbeat the part begins on). */
  beat(b) {
    return b * BEAT;
  }

  /**
   * For sections whose pelican slows or stops (scene.motion): the moment at
   * which the pedals have turned as far as they would have by `beat` at the
   * standard pace. Scheduling notes at ridden(beat) makes the music breathe
   * with the wheels and still arrive at the frame on time.
   */
  ridden(beat) {
    return this.ride.beatTime(this.n, beat) - this.t0;
  }

  /** The pelican at u: { x, turns, crank, speed } (speed 1 = the standard pace). */
  pelican(u) {
    return this.ride.at(this.t0 + u);
  }

  /**
   * Declare a moment where sound must meet picture. The checker measures
   * whether this part's sound really begins there. `what` names the visible event.
   */
  cue(u, what, more = {}) {
    this.cues.push({ u, t: this.t0 + u, what, part: this.part.id, ...more });
  }
}

export const SECTION_SECONDS = T_SECTION;
