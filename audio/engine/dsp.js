// Signal making in plain JavaScript.
//
// Everything here works on Float32Arrays at SR samples per second and needs
// no browser, so it also runs in Node. Parts use it to compute the samples of
// a note once (a plucked string, a struck bell, a burst of noise) and then
// play that buffer with Web Audio. There is no Math.random anywhere: every
// source of chance takes a seed, so the soundtrack is the same on every run.

export const SR = 48000;

const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);

/** Number of samples in s seconds. */
export const samples = (s) => Math.max(1, Math.round(s * SR));

/** A seeded random number generator: rng(seed)() is uniform in [0, 1). */
export function rng(seed = 1) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** White noise in [-1, 1]. */
export function white(n, seed = 1) {
  const r = rng(seed);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) out[i] = r() * 2 - 1;
  return out;
}

/** Pink noise (equal energy per octave), roughly in [-1, 1]. */
export function pink(n, seed = 1) {
  const r = rng(seed);
  const out = new Float32Array(n);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let i = 0; i < n; i += 1) {
    const x = r() * 2 - 1;
    b0 = 0.99886 * b0 + x * 0.0555179;
    b1 = 0.99332 * b1 + x * 0.0750759;
    b2 = 0.969 * b2 + x * 0.153852;
    b3 = 0.8665 * b3 + x * 0.3104856;
    b4 = 0.55 * b4 + x * 0.5329522;
    b5 = -0.7616 * b5 - x * 0.016898;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11;
    b6 = x * 0.115926;
  }
  return out;
}

/** A sine wave. */
export function sine(f, secs, amp = 1, phase = 0) {
  const n = samples(secs);
  const out = new Float32Array(n);
  const w = (2 * Math.PI * f) / SR;
  for (let i = 0; i < n; i += 1) out[i] = amp * Math.sin(w * i + phase);
  return out;
}

// ------------------------------------------------------------------ filters

/**
 * Biquad coefficients (Robert Bristow-Johnson's cookbook), normalised: [b0, b1, b2, a1, a2].
 * q is the plain quality factor for every type (unlike Web Audio's BiquadFilterNode,
 * whose lowpass and highpass take Q in decibels).
 */
export function biquadCoefs(type, f, q = Math.SQRT1_2, gainDb = 0) {
  const w0 = (2 * Math.PI * clamp(f, 1, SR * 0.49)) / SR;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const A = 10 ** (gainDb / 40);
  let b0;
  let b1;
  let b2;
  let a0;
  let a1;
  let a2;
  switch (type) {
    case "lowpass":
      b0 = (1 - cos) / 2;
      b1 = 1 - cos;
      b2 = (1 - cos) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cos;
      a2 = 1 - alpha;
      break;
    case "highpass":
      b0 = (1 + cos) / 2;
      b1 = -(1 + cos);
      b2 = (1 + cos) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cos;
      a2 = 1 - alpha;
      break;
    case "bandpass": // peak gain 1
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
      a0 = 1 + alpha;
      a1 = -2 * cos;
      a2 = 1 - alpha;
      break;
    case "notch":
      b0 = 1;
      b1 = -2 * cos;
      b2 = 1;
      a0 = 1 + alpha;
      a1 = -2 * cos;
      a2 = 1 - alpha;
      break;
    case "peaking":
      b0 = 1 + alpha * A;
      b1 = -2 * cos;
      b2 = 1 - alpha * A;
      a0 = 1 + alpha / A;
      a1 = -2 * cos;
      a2 = 1 - alpha / A;
      break;
    case "lowshelf": {
      const s = 2 * Math.sqrt(A) * alpha;
      b0 = A * (A + 1 - (A - 1) * cos + s);
      b1 = 2 * A * (A - 1 - (A + 1) * cos);
      b2 = A * (A + 1 - (A - 1) * cos - s);
      a0 = A + 1 + (A - 1) * cos + s;
      a1 = -2 * (A - 1 + (A + 1) * cos);
      a2 = A + 1 + (A - 1) * cos - s;
      break;
    }
    case "highshelf": {
      const s = 2 * Math.sqrt(A) * alpha;
      b0 = A * (A + 1 + (A - 1) * cos + s);
      b1 = -2 * A * (A - 1 + (A + 1) * cos);
      b2 = A * (A + 1 + (A - 1) * cos - s);
      a0 = A + 1 - (A - 1) * cos + s;
      a1 = 2 * (A - 1 - (A + 1) * cos);
      a2 = A + 1 - (A - 1) * cos - s;
      break;
    }
    case "allpass":
      b0 = 1 - alpha;
      b1 = -2 * cos;
      b2 = 1 + alpha;
      a0 = 1 + alpha;
      a1 = -2 * cos;
      a2 = 1 - alpha;
      break;
    default:
      throw new Error(`Unknown filter type: ${type}`);
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

/** Filter a signal with one biquad section. Returns a new array. */
export function biquad(x, type, f, q = Math.SQRT1_2, gainDb = 0) {
  const [b0, b1, b2, a1, a2] = biquadCoefs(type, f, q, gainDb);
  const y = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i += 1) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}

/** One-pole lowpass or highpass (6 dB per octave). Returns a new array. */
export function onePole(x, f, type = "lowpass") {
  const a = 1 - Math.exp((-2 * Math.PI * clamp(f, 1, SR * 0.49)) / SR);
  const y = new Float32Array(x.length);
  let s = 0;
  for (let i = 0; i < x.length; i += 1) {
    s += a * (x[i] - s);
    y[i] = type === "highpass" ? x[i] - s : s;
  }
  return y;
}

// ------------------------------------------------------------------ levels and envelopes

export function peak(x) {
  let m = 0;
  for (let i = 0; i < x.length; i += 1) {
    const v = Math.abs(x[i]);
    if (v > m) m = v;
  }
  return m;
}

export function rms(x) {
  let s = 0;
  for (let i = 0; i < x.length; i += 1) s += x[i] * x[i];
  return Math.sqrt(s / Math.max(1, x.length));
}

/** Scale in place so the peak is `to`. Accepts one array or a list of channels (scaled together). */
export function normalize(x, to = 0.9) {
  const chans = Array.isArray(x) ? x : [x];
  let m = 0;
  for (const c of chans) m = Math.max(m, peak(c));
  if (m > 0) {
    const g = to / m;
    for (const c of chans) for (let i = 0; i < c.length; i += 1) c[i] *= g;
  }
  return x;
}

/** Multiply in place by a piecewise-linear envelope: points are [seconds, value]. */
export function envelope(x, points) {
  let k = 0;
  for (let i = 0; i < x.length; i += 1) {
    const t = i / SR;
    while (k < points.length - 2 && t >= points[k + 1][0]) k += 1;
    const [t0, v0] = points[k];
    const [t1, v1] = points[Math.min(k + 1, points.length - 1)];
    const g = t <= t0 ? v0 : t >= t1 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    x[i] *= g;
  }
  return x;
}

/** Raised-cosine fades at both ends, in place: no clicks. */
export function fade(x, fadeIn = 0.002, fadeOut = 0.01) {
  const a = Math.min(x.length, samples(fadeIn));
  const b = Math.min(x.length, samples(fadeOut));
  for (let i = 0; i < a; i += 1) x[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / a);
  for (let i = 0; i < b; i += 1) x[x.length - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / b);
  return x;
}

/** Add src into dst starting at a time, in place. */
export function mixInto(dst, src, atSeconds = 0, gain = 1) {
  const o = Math.round(atSeconds * SR);
  const n = Math.min(src.length, dst.length - o);
  for (let i = Math.max(0, -o); i < n; i += 1) dst[o + i] += src[i] * gain;
  return dst;
}

/** Soft saturation in place: tanh(drive x) / tanh(drive). */
export function saturate(x, drive = 2) {
  const k = 1 / Math.tanh(drive);
  for (let i = 0; i < x.length; i += 1) x[i] = Math.tanh(x[i] * drive) * k;
  return x;
}

// ------------------------------------------------------------------ sound sources

/**
 * A plucked string (extended Karplus-Strong): one period of the string's
 * starting shape circulating in a delay line with a gentle lowpass, tuned
 * exactly with an allpass.
 *   f        frequency in Hz
 *   seconds  length of the buffer
 *   t60      seconds for the fundamental to fall 60 dB
 *   bright   0..1: how slowly the upper partials die (0 = dull gut, 1 = steel)
 *   pick     0..0.5: where the string is plucked, as a fraction of its length
 *            (partials that have a node there are missing, as on a real string)
 *   soft     0..1: softness of the plectrum (0 = a hard pick, 1 = the flesh of a finger)
 *   noise    0..1: how much of the start is scrape rather than string
 *   seed     which scrape
 * The starting shape is built from harmonics (level sin(pi k pick) / k^(1 + soft)),
 * so the fundamental is always there and two notes differ only as asked.
 */
export function pluck({ f, seconds = 2, t60 = seconds, bright = 0.6, pick = 0.18, soft = 0.2, noise = 0.08, seed = 1, level = 0.9 }) {
  const n = samples(seconds);
  const period = SR / f;
  const S = 0.5 * (1 - clamp(bright));
  const D = period - S; // the loop filter delays by about S samples
  const N = Math.max(2, Math.floor(D - 0.1));
  const d = D - N;
  const C = (1 - d) / (1 + d);
  const rho = 10 ** (-3 / (f * t60));

  // one period of the plucked shape, as a sum of harmonics
  const line = new Float32Array(N);
  const top = Math.max(1, Math.min(Math.floor(N / 2) - 1, Math.floor(18000 / f)));
  const tilt = 1 + clamp(soft);
  const p = clamp(pick, 0.02, 0.5);
  for (let k = 1; k <= top; k += 1) {
    const a = Math.sin(Math.PI * k * p) / k ** tilt;
    if (Math.abs(a) < 1e-5) continue;
    const w = (2 * Math.PI * k) / N;
    for (let i = 0; i < N; i += 1) line[i] += a * Math.sin(w * i);
  }
  normalize(line, 1);
  if (noise > 0) {
    const scrape = onePole(white(N, seed), 2500 + 9000 * (1 - clamp(soft)));
    let mean = 0;
    for (let i = 0; i < N; i += 1) mean += scrape[i];
    mean /= N;
    for (let i = 0; i < N; i += 1) line[i] += noise * (scrape[i] - mean) * 3;
  }

  const y = new Float32Array(n);
  let idx = 0;
  let prev = 0;
  let apX = 0;
  let apY = 0;
  for (let i = 0; i < n; i += 1) {
    const out = line[idx];
    const lp = rho * ((1 - S) * out + S * prev);
    prev = out;
    const ap = C * lp + apX - C * apY;
    apX = lp;
    apY = ap;
    line[idx] = ap;
    idx += 1;
    if (idx === N) idx = 0;
    y[i] = out;
  }
  normalize(y, level);
  return fade(y, 0.0008, Math.min(0.03, seconds / 4));
}

/**
 * Struck or ringing bodies: a sum of decaying sine partials.
 *   partials  [{ f (Hz), a (amplitude), t60 (seconds), phase }]
 * Two partials a few hertz apart give the slow beating of a real bell.
 */
export function modal(partials, seconds, { attack = 0.0006 } = {}) {
  const n = samples(seconds);
  const y = new Float32Array(n);
  for (const p of partials) {
    if (!(p.f > 0) || p.f >= SR / 2) continue;
    const w = (2 * Math.PI * p.f) / SR;
    const r = Math.exp(-6.9078 / ((p.t60 || seconds) * SR));
    const c1 = 2 * r * Math.cos(w);
    const c2 = r * r;
    const ph = p.phase || 0;
    const a = p.a === undefined ? 1 : p.a;
    let s1 = (a * Math.sin(ph - w)) / r;
    let s2 = (a * Math.sin(ph - 2 * w)) / (r * r);
    for (let i = 0; i < n; i += 1) {
      const s = c1 * s1 - c2 * s2;
      s2 = s1;
      s1 = s;
      y[i] += s;
    }
  }
  return fade(y, attack, Math.min(0.02, seconds / 4));
}

/**
 * A room: a stereo impulse response made of decaying noise that darkens as it
 * dies, with a few early reflections. Use it in a ConvolverNode (Kit.reverb).
 *   seconds   length
 *   t60       decay time (default: the length)
 *   bright    0..1: how much treble the room keeps
 *   predelay  seconds of silence before the first sound
 *   early     0..1: level of the early reflections
 * Each channel is scaled so that the sum of its squares is 1.
 */
export function impulseResponse({ seconds = 2.5, t60 = seconds, bright = 0.5, predelay = 0.012, early = 0.35, seed = 7 } = {}) {
  const n = samples(seconds);
  const pre = Math.round(predelay * SR);
  const hi = 3000 + 13000 * clamp(bright);
  const lo = 500 + 3500 * clamp(bright);
  const out = [];
  for (let ch = 0; ch < 2; ch += 1) {
    const noise = white(n, seed * 2 + ch + 11);
    const y = new Float32Array(n);
    let s = 0;
    let hp = 0;
    const hpA = 1 - Math.exp((-2 * Math.PI * 110) / SR);
    for (let i = 0; i < n - pre; i += 1) {
      const t = i / SR;
      const fc = hi * (lo / hi) ** (t / seconds);
      const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
      s += a * (noise[i] - s);
      hp += hpA * (s - hp);
      const rise = Math.min(1, t / 0.004);
      y[i + pre] = (s - hp) * Math.exp((-6.9078 * t) / t60) * rise;
    }
    // early reflections: a few distinct taps, different for each ear
    const r = rng(seed * 31 + ch * 7 + 3);
    let e = 0;
    for (let i = 0; i < n; i += 1) e += y[i] * y[i];
    const tail = Math.sqrt(e) || 1;
    for (let k = 0; k < 7; k += 1) {
      const at = pre + Math.round((0.004 + 0.055 * r() + 0.008 * k) * SR);
      const g = early * tail * (0.5 + 0.5 * r()) * (r() < 0.5 ? -1 : 1) * 0.5 ** (k / 3);
      if (at < n) y[at] += g;
    }
    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += y[i] * y[i];
    const g = 1 / Math.sqrt(sum || 1);
    for (let i = 0; i < n; i += 1) y[i] *= g;
    fade(y, 0, Math.min(0.05, seconds / 5));
    out.push(y);
  }
  return out;
}
