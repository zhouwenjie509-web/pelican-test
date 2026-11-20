// The player: turns the film's list of sound events into Web Audio nodes.
//
// It is the one piece of scheduling code in the project. The live preview
// calls pump() a few times a second to schedule the next second and a half of
// the film; the offline renderer suspends its context once a second and calls
// the same pump(). An event is therefore scheduled the same way, at the same
// film time, whichever context it lands in.
//
//   const player = new Player(ac, track, { dest });
//   player.start(filmTime, contextTime);   // film time `filmTime` sounds at `contextTime`
//   player.pump(untilFilmTime);            // schedule everything before that film time
//   player.stop();                         // cut cleanly (pause, scrub)

import { Kit } from "./kit.js";
import { dB } from "./theory.js";

/**
 * Level of the whole film's mix before the limiter, in decibels. Parts are written to their
 * own loudness targets with the master at 0 (that is how a part alone is rendered and
 * measured); the film, live and offline, plays MASTER_DB louder.
 */
export const MASTER_DB = 3;

/**
 * The safety limiter: a straight line up to 0.72 (-2.9 dBFS), then a smooth knee
 * that never passes 0.89 (-1.0 dBFS). It has no delay and no memory, so it is
 * identical live and offline; a mix that stays below the knee passes through untouched.
 */
export function limitCurve(x) {
  const a = Math.abs(x);
  const KNEE = 0.72;
  const CEIL = 0.89;
  if (a <= KNEE) return x;
  const over = (a - KNEE) / (CEIL - KNEE);
  return Math.sign(x) * (KNEE + (CEIL - KNEE) * Math.tanh(over));
}

/** Every event is scheduled this many samples early (see Player.when). */
const EARLY = 1e-6;

export class Player {
  /**
   * track  the compiled soundtrack: { parts: Map(id -> part), events: sorted by t, mix: { id: dB } }
   * dest   where the sound goes (default: the context's destination)
   * only   optional Set of part ids to play; the others stay silent
   * masterDb  level of the mix (default MASTER_DB; the tools render a part alone at 0)
   */
  constructor(ac, track, { dest = ac.destination, only = null, masterDb = MASTER_DB } = {}) {
    this.ac = ac;
    this.track = track;
    this.only = only;
    this.k = new Kit(ac);
    this.graphs = new Map();
    this.errors = [];
    this.scheduled = 0;

    // parts -> bus -> limiter -> post (fades, the user's volume) -> destination
    // The shaper's table covers inputs from -2 to +2 (6 dB over full scale), so the bus
    // feeds it at half level and the table gives the full-scale answer back.
    this.bus = this.k.gain(dB(masterDb) * 0.5);
    this.limiter = this.k.shaper("player/limit", (x) => limitCurve(2 * x));
    this.post = this.k.gain(1);
    this.bus.connect(this.limiter).connect(this.post).connect(dest);

    this.film0 = 0;
    this.ctx0 = 0;
    this.index = 0;
    this.started = false;

    /**
     * For a part that plays another part's voice (the outro): a second copy of
     * that part's graph, feeding `dest` instead of the mix. Returns its `g`.
     */
    this.k.subgraph = (partId, dest) => {
      const part = this.track.parts.get(partId);
      return part ? this.buildGraph(part, dest) : null;
    };
  }

  /**
   * Context time at which film time t sounds, less a millionth of a sample.
   *
   * Film times are meant to fall on samples (a beat is 24000 of them), but the sum below is
   * computed in floating point, and live (ctx0 is a large, odd number) it can come out a few
   * billionths of a sample above the sample it means. Chrome starts a source at the right
   * sample all the same, but applies a parameter step (setValueAtTime) at the first sample at
   * or after its time: the next one. A pitch or a gain would then change one sample later in
   * the preview than in the offline render. A millionth of a sample early, every time lies
   * safely below its sample however the sum is rounded, and both contexts act on the same one.
   * (2e-11 s. A source still starts on its sample; a buffer is read a millionth of a sample in,
   * which changes it by about -120 dB, the same in both contexts. The guard needs doubles fine
   * enough to hold it: after about a day of context time they are not, and a step may again
   * fall a sample late in the preview. The transport puts the context to sleep whenever
   * nothing plays, so context time grows only while the film runs.)
   */
  when(t) {
    return this.ctx0 + (t - this.film0) - EARLY / this.ac.sampleRate;
  }

  /** Build a part's graph (its level, then whatever its graph() adds) feeding `dest`. */
  buildGraph(part, dest) {
    const out = this.k.gain(dB((this.track.mix && this.track.mix[part.id]) || 0));
    out.connect(dest);
    let g = { out };
    if (typeof part.graph === "function") {
      try {
        g = { out, ...(part.graph(this.k, out) || {}) };
      } catch (err) {
        this.fail(part, err, "graph");
      }
    }
    return g;
  }

  /** The nodes a part plays into, built the first time the part is needed. */
  graphFor(part) {
    let g = this.graphs.get(part.id);
    if (!g) {
      g = this.buildGraph(part, this.bus);
      this.graphs.set(part.id, g);
    }
    return g;
  }

  fail(part, err, where) {
    const seen = this.errors.some((e) => e.part === part.id && e.where === where);
    this.errors.push({ part: part.id, where, message: String((err && err.message) || err) });
    if (!seen) console.error(`[sound] ${part.id} ${where}: ${(err && err.stack) || err}`);
  }

  fire(ev, offset = 0) {
    const part = ev.part;
    if (this.only && !this.only.has(part.id)) return;
    const g = this.graphFor(part);
    try {
      // never a negative time: rounding can leave -2e-16 where 0 is meant, and Web Audio refuses it
      ev.play(this.k, g, Math.max(0, this.when(ev.t + offset)), offset ? { ...ev, offset } : ev);
      this.scheduled += 1;
    } catch (err) {
      this.fail(part, err, `event at ${ev.t.toFixed(3)} s`);
    }
  }

  /**
   * Begin at film time `filmTime`, which will sound at context time `ctxTime`.
   * Events that began earlier are skipped, except those marked `seekable` that
   * are still sounding: they are started part-way through (ev.offset seconds in).
   */
  start(filmTime, ctxTime) {
    this.film0 = filmTime;
    this.ctx0 = ctxTime;
    this.started = true;
    const { events } = this.track;
    let i = 0;
    while (i < events.length && events[i].t < filmTime - 1e-9) {
      const ev = events[i];
      if (ev.seekable && ev.t + (ev.dur || 0) > filmTime + 0.02) this.fire(ev, filmTime - ev.t);
      i += 1;
    }
    this.index = i;
  }

  /** Schedule every event that begins before film time `until`. */
  pump(until) {
    const { events } = this.track;
    while (this.index < events.length && events[this.index].t < until) {
      this.fire(events[this.index]);
      this.index += 1;
    }
  }

  get finished() {
    return this.index >= this.track.events.length;
  }

  /**
   * Fade out quickly, stop every source and leave the graph to be collected.
   * fade = 0 cuts at once (used when the context is suspended and cannot run a fade).
   */
  stop(fade = 0.03) {
    const now = this.ac.currentTime;
    const post = this.post;
    if (fade <= 0) {
      this.k.stopAll(0);
      try {
        post.disconnect();
      } catch {
        // already gone
      }
      return;
    }
    post.gain.cancelScheduledValues(now);
    post.gain.setValueAtTime(post.gain.value, now);
    post.gain.linearRampToValueAtTime(0, now + fade);
    this.k.stopAll(now + fade + 0.005);
    setTimeout(() => {
      try {
        post.disconnect();
      } catch {
        // already gone
      }
    }, (fade + 0.1) * 1000);
  }
}
