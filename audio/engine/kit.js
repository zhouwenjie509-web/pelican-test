// The sound toolkit: thin, predictable helpers over Web Audio.
//
// A Kit belongs to one audio context, live (AudioContext) or offline
// (OfflineAudioContext). Parts never ask which: the same calls schedule the
// same sound in both, which is what keeps the preview and the exported WAV
// the same (to within rounding: see tools/audio-live.mjs). Every source a Kit starts is remembered, so playback can be cut
// cleanly when the film is paused or scrubbed.

import { SR, white, pink, impulseResponse } from "./dsp.js";

/** Buffers are computed once and shared by every context. */
const BUFFERS = new Map();

/** Wrap sample arrays (one Float32Array, or one per channel) in an AudioBuffer. */
export function makeBuffer(channels, sampleRate = SR) {
  const chans = Array.isArray(channels) ? channels : [channels];
  const buf = new AudioBuffer({ length: chans[0].length, numberOfChannels: chans.length, sampleRate });
  chans.forEach((c, i) => buf.copyToChannel(c, i));
  return buf;
}

/**
 * A cached buffer. `make` runs the first time the key is asked for and may
 * return a Float32Array, an array of them (channels) or an AudioBuffer.
 */
export function sharedBuffer(key, make) {
  let buf = BUFFERS.get(key);
  if (!buf) {
    const made = make();
    buf = made instanceof AudioBuffer ? made : makeBuffer(made);
    BUFFERS.set(key, buf);
  }
  return buf;
}

/**
 * Compute a room's impulse response ahead of time (call it from a part's
 * prepare()), so that Kit.reverb(key, options) finds it ready when the part's
 * graph is built during playback. Same key and options as Kit.reverb.
 */
export function prepareReverb(key, options = {}) {
  return sharedBuffer(`kit/ir/${key}`, () => impulseResponse(options));
}

/**
 * The long noise buffer that every Kit.noise(color, ...) reads. There is one per
 * colour; loadSoundtrack makes both before anything plays, so no part has to.
 * (A `seed` only chooses where in the buffer a sound starts reading.)
 */
export function prepareNoise(color = "white") {
  return sharedBuffer(`kit/noise/${color}`, () => (color === "pink" ? pink(NOISE_SECONDS * SR, 9001) : white(NOISE_SECONDS * SR, 7001)));
}

export const hasBuffer = (key) => BUFFERS.has(key);
export const getBuffer = (key) => BUFFERS.get(key);
export const putBuffer = (key, buffer) => BUFFERS.set(key, buffer instanceof AudioBuffer ? buffer : makeBuffer(buffer));

const NOISE_SECONDS = 8;

export class Kit {
  constructor(ac) {
    this.ac = ac;
    this.sr = ac.sampleRate;
    /** Every source that has been started and has not ended. */
    this.sources = new Set();
    this.waves = new Map();
    this.curves = new Map();
    this.count = 0;
  }

  // ---------------------------------------------------------------- buffers

  buffer(key, make) {
    return sharedBuffer(key, make);
  }

  /**
   * Play a buffer. Returns { src, out }: the source node and the gain node its sound leaves by.
   *   when     context time
   *   offset   seconds into the buffer
   *   dur      seconds of buffer to play (default: to its end)
   *   rate     playback rate; detune in cents
   *   gain     linear level; pan -1..1
   *   loop     true, or [loopStart, loopEnd] in seconds
   *   fade     seconds of fade-out at the end of `dur` (default 0.004 when dur is given)
   */
  play(buffer, when, { offset = 0, dur, rate = 1, detune = 0, gain = 1, pan = 0, loop = false, fade } = {}, dest) {
    const { ac } = this;
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    if (detune) src.detune.value = detune;
    if (loop) {
      src.loop = true;
      if (Array.isArray(loop)) {
        src.loopStart = loop[0];
        src.loopEnd = loop[1];
      }
    }
    const out = ac.createGain();
    out.gain.value = gain;
    src.connect(out);
    let last = out;
    if (pan) {
      const p = ac.createStereoPanner();
      p.pan.value = pan;
      out.connect(p);
      last = p;
    }
    if (dest) last.connect(dest);
    const t = Math.max(0, when);
    src.start(t, Math.max(0, offset));
    if (dur !== undefined) {
      const f = fade === undefined ? 0.004 : fade;
      const end = t + dur / rate;
      if (f > 0) {
        out.gain.setValueAtTime(gain, Math.max(t, end - f));
        out.gain.linearRampToValueAtTime(0, end);
      }
      src.stop(end + 0.002);
    }
    this.track(src);
    return { src, out: last, gain: out };
  }

  // ---------------------------------------------------------------- sources

  /** Remember a started source so it can be stopped when playback is cut. Returns the node. */
  track(src) {
    this.sources.add(src);
    this.count += 1;
    src.addEventListener("ended", () => this.sources.delete(src), { once: true });
    return src;
  }

  /**
   * An oscillator, started at `when` and stopped at `stop`.
   * type: "sine" | "square" | "sawtooth" | "triangle" | a PeriodicWave (see wave()).
   */
  osc(type, freq, when, stop, detune = 0) {
    const o = this.ac.createOscillator();
    if (typeof type === "string") o.type = type;
    else o.setPeriodicWave(type);
    o.frequency.value = freq;
    if (detune) o.detune.value = detune;
    o.start(Math.max(0, when));
    if (stop !== undefined) o.stop(Math.max(0, stop));
    return this.track(o);
  }

  /**
   * A slow sine for vibrato and tremolo that starts at a chosen point of its
   * cycle: phase 0 starts at zero going up, 0.25 at the top, 0.5 at zero going down.
   * Give different players different phases, or their vibratos move together.
   */
  lfo(freq, when, stop, phase = 0) {
    const key = `kit/lfo/${phase.toFixed(4)}`;
    let w = this.waves.get(key);
    if (!w) {
      const a = 2 * Math.PI * phase;
      w = this.ac.createPeriodicWave(new Float32Array([0, Math.sin(a)]), new Float32Array([0, Math.cos(a)]), { disableNormalization: false });
      this.waves.set(key, w);
    }
    return this.osc(w, freq, when, stop);
  }

  /**
   * A cached PeriodicWave from harmonic amplitudes: sines[1] is the fundamental. cosines optional.
   * The wave is scaled so that its highest point is 1: change the harmonics or their phases and
   * the level of every partial changes with them. Spreading the phases lowers the crest (the peak
   * for a given loudness), which is how to make a rich tone louder without a higher peak.
   */
  wave(key, sines, cosines) {
    let w = this.waves.get(key);
    if (!w) {
      const n = sines.length;
      const imag = new Float32Array(n);
      const real = new Float32Array(n);
      for (let i = 1; i < n; i += 1) {
        imag[i] = sines[i] || 0;
        real[i] = cosines ? cosines[i] || 0 : 0;
      }
      w = this.ac.createPeriodicWave(real, imag, { disableNormalization: false });
      this.waves.set(key, w);
    }
    return w;
  }

  /**
   * Noise that runs from `when` to `stop`: "white" or "pink", read from a long
   * shared buffer starting `phase` seconds in. Sounds that play together must
   * not be copies of each other: give them different phases or different seeds
   * (a seed moves the starting point by a fixed, large amount). The white
   * buffer's level is about 0.58 rms.
   */
  noise(color, when, stop, { phase = 0, rate = 1, seed = 1 } = {}) {
    const buf = prepareNoise(color);
    const src = this.ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = rate;
    const at = phase + seed * 0.618034 * NOISE_SECONDS;
    src.start(Math.max(0, when), ((at % NOISE_SECONDS) + NOISE_SECONDS) % NOISE_SECONDS);
    if (stop !== undefined) src.stop(Math.max(0, stop));
    return this.track(src);
  }

  /** A constant signal (for modulating several parameters from one envelope). */
  constant(value, when, stop) {
    const c = this.ac.createConstantSource();
    c.offset.value = value;
    c.start(Math.max(0, when));
    if (stop !== undefined) c.stop(Math.max(0, stop));
    return this.track(c);
  }

  // ---------------------------------------------------------------- processors

  gain(value = 1) {
    const g = this.ac.createGain();
    g.gain.value = value;
    return g;
  }

  /** A BiquadFilterNode. For lowpass and highpass Web Audio reads q in decibels of resonance. */
  filter(type, freq, q = 0.7071, gainDb = 0) {
    const f = this.ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    f.gain.value = gainDb;
    return f;
  }

  pan(value = 0) {
    const p = this.ac.createStereoPanner();
    p.pan.value = value;
    return p;
  }

  delay(seconds, max = Math.max(1, seconds * 2)) {
    const d = this.ac.createDelay(max);
    d.delayTime.value = seconds;
    return d;
  }

  /**
   * A WaveShaperNode from a transfer function fn(x), x in -1..1. No oversampling by
   * default: oversampling filters delay the sound by a few samples.
   */
  shaper(key, fn, oversample = "none") {
    let curve = this.curves.get(key);
    if (!curve) {
      const n = 4097;
      curve = new Float32Array(n);
      for (let i = 0; i < n; i += 1) curve[i] = fn((i / (n - 1)) * 2 - 1);
      this.curves.set(key, curve);
    }
    const s = this.ac.createWaveShaper();
    s.curve = curve;
    s.oversample = oversample;
    return s;
  }

  /**
   * A room. Returns a ConvolverNode whose impulse response is generated from
   * `options` (see dsp.impulseResponse) and cached under `key`. The response
   * has unit energy, so the wet level is set by the gain you put before it.
   */
  reverb(key, options = {}) {
    const c = this.ac.createConvolver();
    c.normalize = false;
    c.buffer = sharedBuffer(`kit/ir/${key}`, () => impulseResponse(options));
    return c;
  }

  /** Connect nodes in a row: chain(a, b, c) is a -> b -> c. Returns the last one. */
  chain(...nodes) {
    for (let i = 0; i < nodes.length - 1; i += 1) nodes[i].connect(nodes[i + 1]);
    return nodes[nodes.length - 1];
  }

  // ---------------------------------------------------------------- envelopes

  /**
   * Automate a parameter from breakpoints: [seconds after `when`, value, shape].
   * shape: omitted = straight line from the previous point, "exp" = exponential
   * line, "set" = jump, ["target", tau] = approach the value with time constant tau.
   * The first point is always set outright. After a ["target", tau] point the next
   * point must be "set" or another target (a line after it would start from where
   * the parameter was before the approach).
   */
  env(param, when, points) {
    let first = true;
    let afterTarget = false;
    for (const [dt, value, shape] of points) {
      const t = Math.max(0, when + dt);
      const ramp = !first && shape !== "set" && !Array.isArray(shape);
      if (ramp && afterTarget && !this.warnedTarget) {
        // Web Audio draws a ramp from where the parameter was when the target approach BEGAN, so the
        // approach is thrown away. After ["target", tau] the next point must be "set" or another target.
        this.warnedTarget = true;
        console.warn('[sound] Kit.env: a ramp follows a ["target", tau] point; the approach is lost. Use "set" or another target after it.');
      }
      if (first || shape === "set") param.setValueAtTime(value, t);
      else if (shape === "exp") param.exponentialRampToValueAtTime(Math.max(value, 1e-5), t);
      else if (Array.isArray(shape)) param.setTargetAtTime(value, t, shape[1]);
      else param.linearRampToValueAtTime(value, t);
      afterTarget = Array.isArray(shape);
      first = false;
    }
    return param;
  }

  /**
   * Attack, decay, sustain, release on a gain parameter. Returns the time the sound is over.
   *   a, d, r in seconds; s is the sustain level as a fraction of peak; dur is the held length.
   */
  adsr(param, when, dur, { a = 0.005, d = 0.08, s = 0.7, r = 0.08, peak = 1 } = {}) {
    const t = Math.max(0, when);
    const hold = Math.max(dur, a + 0.001);
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(peak, t + a);
    if (hold > a + d) {
      param.linearRampToValueAtTime(peak * s, t + a + d);
      param.setValueAtTime(peak * s, t + hold);
    } else {
      // released before the decay has finished
      const v = peak + (peak * s - peak) * ((hold - a) / d);
      param.linearRampToValueAtTime(v, t + hold);
    }
    param.linearRampToValueAtTime(0, t + hold + r);
    return t + hold + r;
  }

  // ---------------------------------------------------------------- cutting

  /** Stop every source that is sounding or scheduled. */
  stopAll(when = 0) {
    for (const src of this.sources) {
      try {
        src.stop(Math.max(0, when));
      } catch {
        // already stopped
      }
    }
  }
}
