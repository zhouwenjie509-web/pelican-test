// Offline rendering: the soundtrack as an AudioBuffer, faster than real time.
//
// An OfflineAudioContext is suspended once per second of film; at each stop
// the Player schedules the next second, exactly as the live transport does
// while the film plays. Nothing is scheduled less than a second before it sounds.

import { Player } from "./player.js";

const STEP = 1; // seconds between stops
const AHEAD = 1; // seconds scheduled beyond the next stop

/**
 * Render film time `from`..`to`.
 * `begin` (default `from`): the film time at which playback starts, as after a seek to it: the
 * buffer is silent before it, and sounds that began earlier are missing unless they are seekable.
 * With `from` on a whole 128-sample block of film time this is what the live transport plays
 * after a seek to `begin`, to within rounding (tools/audio-live.mjs subtracts one from the other).
 * Returns { buffer (stereo AudioBuffer), errors, scheduled (events), sources (source nodes started),
 * alive (the most sources alive at one time: sounding, or scheduled within the next two seconds) }.
 */
export async function renderOffline(track, { from = 0, to = track.duration, begin = from, sampleRate = 48000, onProgress = null, masterDb } = {}) {
  const total = to - from;
  const length = Math.max(1, Math.round(total * sampleRate));
  const ac = new OfflineAudioContext({ numberOfChannels: 2, length, sampleRate });
  const player = new Player(ac, track, masterDb === undefined ? {} : { masterDb });
  player.start(begin, begin - from);
  player.pump(from + STEP + AHEAD);
  let alive = player.k.sources.size;
  for (let c = STEP; c < total; c += STEP) {
    ac.suspend(c).then(() => {
      player.pump(from + c + STEP + AHEAD);
      // sources that are sounding or scheduled within the next two seconds
      if (player.k.sources.size > alive) alive = player.k.sources.size;
      if (onProgress) onProgress(c / total);
      ac.resume();
    });
  }
  const buffer = await ac.startRendering();
  return { buffer, errors: player.errors, scheduled: player.scheduled, sources: player.k.count, alive };
}
