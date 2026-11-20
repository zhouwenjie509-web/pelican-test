// Page side of tools/audio.mjs: render the soundtrack offline and hand back a WAV.

import { loadSoundtrack } from "./soundtrack.js";
import { renderOffline } from "./engine/offline.js";
import { encodeWav, base64Slice } from "./engine/wav.js";

let wav = null;

window.__audio = {
  ready: true,

  /**
   * Render film time from..to. `only` lists part ids (default: all); `preroll`
   * renders that many extra seconds first and cuts them off, so that sounds
   * which began earlier are still ringing when the clip starts.
   */
  async render({ only = null, from = 0, to = null, preroll = 0, label = null } = {}) {
    const started = performance.now();
    const track = await loadSoundtrack({ only });
    if (label) {
      // one instrument alone: keep the events whose label (or instrument function name) matches
      const re = new RegExp(label, "i");
      track.events = track.events.filter((e) => re.test(e.label || (e.play && e.play.name) || ""));
    }
    const prepared = performance.now();
    const end = to === null ? track.duration : to;
    // The render begins on the film's own grid of 128-sample blocks (film time 0 is on it, and
    // the live preview keeps to it). Web Audio does some things once per block; begun off the
    // grid, a stretch would differ slightly from the same stretch of the whole film.
    const BLOCK = 128 / 48000;
    const start = Math.floor(Math.max(0, from - preroll) / BLOCK + 1e-9) * BLOCK;
    // parts alone are rendered and measured with the master at 0; the film at its own level
    const { buffer, errors, scheduled, sources, alive } = await renderOffline(track, { from: start, to: end, masterDb: only ? 0 : undefined });
    const skip = Math.round((from - start) * buffer.sampleRate);
    const chans = [0, 1].map((c) => buffer.getChannelData(c).subarray(skip));
    let peak = 0;
    for (const c of chans) for (let i = 0; i < c.length; i += 1) if (Math.abs(c[i]) > peak) peak = Math.abs(c[i]);
    wav = encodeWav(chans, buffer.sampleRate);
    return {
      bytes: wav.length,
      sampleRate: buffer.sampleRate,
      seconds: chans[0].length / buffer.sampleRate,
      peak,
      prepareMs: prepared - started,
      prepareOwnMs: only && track.parts.get(only[0]) ? track.parts.get(only[0]).prepareMs || 0 : null,
      standin: Boolean(only && track.parts.get(only[0]) && track.parts.get(only[0]).standin),
      renderMs: performance.now() - prepared,
      events: track.events.length,
      scheduled,
      sources,
      alive,
      errors: [...track.errors, ...errors],
      cues: track.cues.map((c) => ({ t: c.t, u: c.u, what: c.what, part: c.part, band: c.band, soft: c.soft })),
      // the chain's ticks (four to a pedal turn), for measuring the beat itself
      ticks: track.events.filter((e) => e.part.id === "bike" && e.label === "chain").map((e) => e.t),
      leads: track.events.filter((e) => e.lead && e.midi !== undefined).map((e) => ({ t: e.t, u: e.u, dur: e.dur, midi: e.midi, part: e.part.id, free: Boolean(e.free), tol: e.tol || 0 })),
    };
  },

  pull(from, to) {
    return base64Slice(wav, from, to);
  },

  /**
   * Can playback begin anywhere? Start the film at each of many film times in turn, as after a
   * seek, and render a moment from there: every `step` seconds, and three places inside every
   * sound that is picked up part-way (the seekable ones). Returns what went wrong; no sound is kept.
   */
  async starts({ step = 0.61, len = 0.3 } = {}) {
    const track = await loadSoundtrack({});
    const rate = 48000;
    const times = [];
    for (let t = 0.05; t < track.duration - len; t += step) times.push(t);
    const seekable = track.events.filter((e) => e.seekable && e.dur > 0.1);
    for (const e of seekable) for (const f of [0.03, e.dur / 2, e.dur - 0.05]) if (e.t + f > 0 && e.t + f < track.duration - 0.05) times.push(e.t + f);
    times.sort((a, b) => a - b);
    const bad = [];
    for (const t of times) {
      // Two ways of beginning at t: on the film's grid of 128-sample blocks, as the live transport
      // does after a seek (t then sounds a little after context time 0), and with t at context
      // time 0 exactly, as a ranged render does (where a time can come out a hair below zero).
      for (const [how, from] of [["as after a seek", (Math.floor((t * rate) / 128) * 128) / rate], ["as a ranged render", t]]) {
        let errors = [];
        let wrong = null;
        try {
          const r = await renderOffline(track, { from, to: Math.min(track.duration, t + len), begin: t });
          errors = r.errors.map((x) => `${x.part} (${x.where}): ${x.message}`);
          for (let c = 0; c < 2 && !wrong; c += 1) {
            const d = r.buffer.getChannelData(c);
            for (let i = 0; i < d.length; i += 1) {
              if (!Number.isFinite(d[i]) || Math.abs(d[i]) > 1.0001) {
                wrong = `sample ${d[i]} at film ${(from + i / rate).toFixed(4)} s`;
                break;
              }
            }
          }
        } catch (err) {
          errors = [`the render itself failed: ${(err && err.message) || err}`];
        }
        if (errors.length || wrong) bad.push({ t, how, errors, wrong });
      }
    }
    return { count: times.length, seekable: seekable.length, bad, loadErrors: track.errors };
  },
};
