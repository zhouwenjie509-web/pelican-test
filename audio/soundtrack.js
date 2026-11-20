// The soundtrack: every part's events on one time line.
//
// A part is one file in audio/parts/: one per section, plus the intro, the
// outro and the bicycle (its bell and its chain, which run through the whole
// film). loadSoundtrack() imports them, lets each prepare its sounds, and
// collects their events, sorted by film time. The result is what the Player
// plays, live or offline.
//
// A part file's default export:
//
//   export default {
//     async prepare() {},          optional: compute buffers before anything plays
//     graph(k, out) { return {} }, optional: build the part's effects once per context;
//                                  what it returns is the `g` handed to every event
//     score(s) {},                 list the events (see engine/score.js). No Web Audio here.
//     lead(k, g, when, ev) {},     sections: one note of the part's own voice (the outro plays them all)
//     leadOctave: 0,               sections: the octave that voice plays the tune in
//     bike: { chain: 1, bell: 1 }, sections: how loud the bicycle's own sounds are here (0 = silent)
//   };

import { DURATION, T_SECTION, T_OUTRO_START, BEAT, sectionStart } from "../src/beat/timeline.js";
import { buildScenes } from "../src/scenes/index.js";
import { pelicanAt, pelicanSpeed } from "../src/main/camera.js";
import { Score } from "./engine/score.js";
import { prepareNoise } from "./engine/kit.js";
import { MIX } from "./mix.js";

/** Every part, in film order. n is the section number; t0 the film time of the part's u = 0. */
export const PARTS = [
  { id: "intro", n: 0, file: "00-intro.js", t0: 0 },
  { id: "sahara", n: 1, file: "01-sahara.js" },
  { id: "egypt", n: 2, file: "02-egypt.js" },
  { id: "han", n: 3, file: "03-han.js" },
  { id: "tang", n: 4, file: "04-tang.js" },
  { id: "song", n: 5, file: "05-song.js" },
  { id: "qingming", n: 6, file: "06-qingming.js" },
  { id: "maya", n: 7, file: "07-maya.js" },
  { id: "mughal", n: 8, file: "08-mughal.js" },
  { id: "bada", n: 9, file: "09-bada.js" },
  { id: "wayang", n: 10, file: "10-wayang.js" },
  { id: "ukiyoe", n: 11, file: "11-ukiyoe.js" },
  { id: "starry", n: 12, file: "12-starry.js" },
  { id: "scream", n: 13, file: "13-scream.js" },
  { id: "nosferatu", n: 14, file: "14-nosferatu.js" },
  { id: "scope", n: 15, file: "15-scope.js" },
  { id: "pixel", n: 16, file: "16-pixel.js" },
  { id: "chat", n: 17, file: "17-chat.js" },
  { id: "vapor", n: 18, file: "18-vapor.js" },
  { id: "shortvideo", n: 19, file: "19-shortvideo.js" },
  { id: "code", n: 20, file: "20-code.js" },
  { id: "outro", n: 21, file: "21-outro.js", t0: T_OUTRO_START },
  { id: "bike", n: -1, file: "bike.js", t0: 0 },
];

export const partSpec = (idOrNumber) => PARTS.find((p) => p.id === idOrNumber || String(p.n) === String(idOrNumber));

/** What the picture tells the sound: where the pelican is and how far the pedals have turned. */
function makeRide() {
  const scenes = buildScenes();
  const at = (t) => {
    const p = pelicanAt(t, scenes);
    return { x: p.x, turns: p.turns, crank: p.crank, section: p.section, speed: pelicanSpeed(t, scenes) };
  };
  /**
   * Film time at which, inside section n, the pedals have turned as far as they
   * would have by `beat` at the standard pace (one turn every two beats).
   * Equal to the plain beat time unless the scene slows or stops the pelican.
   */
  const beatTime = (n, beat) => {
    const t0 = sectionStart(n);
    const plain = t0 + beat * BEAT;
    const scene = scenes[n];
    if (!scene || typeof scene.motion !== "function" || beat <= 0 || beat >= T_SECTION / BEAT) return plain;
    const target = pelicanAt(t0, scenes).turns + beat * BEAT; // turns are counted in seconds of standard riding
    let lo = t0;
    let hi = t0 + T_SECTION;
    for (let i = 0; i < 40; i += 1) {
      const mid = (lo + hi) / 2;
      if (pelicanAt(mid, scenes).turns >= target - 1e-9) hi = mid;
      else lo = mid;
    }
    return hi;
  };
  return { at, beatTime, scenes };
}

/**
 * Import the parts and build the event list.
 *   only      list of part ids to include (default: all)
 *   prepare   false to skip prepare() (Node: listing and checking a score)
 *   onProgress(done, total, id)
 * Returns { parts, events, cues, errors, mix, ride, duration }.
 */
export async function loadSoundtrack({ only = null, prepare = true, onProgress = null } = {}) {
  const ride = makeRide();
  const parts = new Map();
  const errors = [];
  const wanted = new Set(only || PARTS.map((p) => p.id));

  // Import every part: the bicycle reads each section's wishes, the outro plays each section's voice.
  for (const spec of PARTS) {
    try {
      const mod = await import(`./parts/${spec.file}`);
      if (!mod.default || typeof mod.default.score !== "function") throw new Error("the default export needs a score(s) function");
      parts.set(spec.id, { ...spec, t0: spec.t0 === undefined ? sectionStart(spec.n) : spec.t0, ...mod.default });
    } catch (err) {
      errors.push({ part: spec.id, where: "import", message: String((err && err.message) || err) });
      if (wanted.has(spec.id)) console.error(`[sound] ${spec.id}: ${(err && err.stack) || err}`);
    }
  }

  // The outro plays the sections' voices, so their buffers must exist when it is wanted.
  // The bicycle's bell is borrowed by other parts, so it is always made.
  const toPrepare = new Set(wanted);
  if (prepare && parts.has("bike") && !wanted.has("bike")) {
    try {
      await parts.get("bike").prepare();
    } catch (err) {
      errors.push({ part: "bike", where: "prepare", message: String((err && err.message) || err) });
    }
  }
  if (wanted.has("outro")) for (const p of PARTS) if (p.n >= 1 && p.n <= 20) toPrepare.add(p.id);

  // the two noise buffers every Kit.noise reads: made once, here, not while the film plays
  if (prepare && typeof AudioBuffer !== "undefined") {
    prepareNoise("white");
    prepareNoise("pink");
  }

  const events = [];
  const cues = [];
  let done = 0;
  for (const spec of PARTS) {
    const part = parts.get(spec.id);
    if (part && toPrepare.has(spec.id)) {
      try {
        if (prepare && typeof part.prepare === "function") {
          const began = typeof performance !== "undefined" ? performance.now() : 0;
          await part.prepare({ ride });
          part.prepareMs = (typeof performance !== "undefined" ? performance.now() : 0) - began;
        }
        if (wanted.has(spec.id)) {
          const s = new Score(part, part.t0, ride);
          s.parts = parts;
          part.score(s);
          events.push(...s.events);
          cues.push(...s.cues);
        }
      } catch (err) {
        errors.push({ part: spec.id, where: "prepare/score", message: String((err && err.message) || err) });
        console.error(`[sound] ${spec.id}: ${(err && err.stack) || err}`);
      }
    }
    done += 1;
    if (onProgress) await onProgress(done, PARTS.length, spec.id);
  }
  events.sort((a, b) => a.t - b.t);
  cues.sort((a, b) => a.t - b.t);
  return { parts, events, cues, errors, mix: MIX, ride, duration: DURATION };
}
