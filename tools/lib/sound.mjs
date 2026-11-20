// Measuring sound: WAV reading, levels, onsets, pitch, loudness and spectrogram sheets.
// Plain Node plus ffmpeg; no other dependencies.

import fs from "node:fs";
import { spawnSync } from "node:child_process";

/** Read a PCM (16, 24 or 32 bit) or 32-bit float WAV. Returns { sampleRate, channels: [Float32Array] }. */
export function readWav(file) {
  const b = fs.readFileSync(file);
  if (b.toString("latin1", 0, 4) !== "RIFF" || b.toString("latin1", 8, 12) !== "WAVE") throw new Error(`${file} is not a WAV file`);
  let at = 12;
  let fmt = null;
  let data = null;
  while (at + 8 <= b.length) {
    const id = b.toString("latin1", at, at + 4);
    const size = b.readUInt32LE(at + 4);
    if (id === "fmt ") fmt = { format: b.readUInt16LE(at + 8), nCh: b.readUInt16LE(at + 10), sampleRate: b.readUInt32LE(at + 12), bits: b.readUInt16LE(at + 22) };
    if (id === "data") {
      data = b.subarray(at + 8, Math.min(b.length, at + 8 + size));
      break;
    }
    at += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error(`${file}: no fmt or data chunk`);
  const bytes = fmt.bits / 8;
  const n = Math.floor(data.length / (bytes * fmt.nCh));
  const channels = Array.from({ length: fmt.nCh }, () => new Float32Array(n));
  for (let i = 0; i < n; i += 1) {
    for (let c = 0; c < fmt.nCh; c += 1) {
      const o = (i * fmt.nCh + c) * bytes;
      let v;
      if (fmt.format === 3) v = data.readFloatLE(o);
      else if (bytes === 2) v = data.readInt16LE(o) / 32768;
      else if (bytes === 3) v = data.readIntLE(o, 3) / 8388608;
      else v = data.readInt32LE(o) / 2147483648;
      channels[c][i] = v;
    }
  }
  return { sampleRate: fmt.sampleRate, channels };
}

export function toMono(channels) {
  if (channels.length === 1) return channels[0];
  const out = new Float32Array(channels[0].length);
  for (const c of channels) for (let i = 0; i < out.length; i += 1) out[i] += c[i] / channels.length;
  return out;
}

export const dbfs = (v) => (v > 0 ? 20 * Math.log10(v) : -Infinity);

/** Peak, RMS and mean of a stretch of samples. */
export function levels(x, from = 0, to = x.length) {
  let peak = 0;
  let sq = 0;
  let sum = 0;
  const a = Math.max(0, Math.floor(from));
  const b = Math.min(x.length, Math.ceil(to));
  for (let i = a; i < b; i += 1) {
    const v = x[i];
    const m = Math.abs(v);
    if (m > peak) peak = m;
    sq += v * v;
    sum += v;
  }
  const n = Math.max(1, b - a);
  return { peak, rms: Math.sqrt(sq / n), dc: sum / n };
}

/** One biquad section in place: type "lowpass" or "highpass", cutoff f, quality q. */
function section(x, sr, type, f, q) {
  const w0 = (2 * Math.PI * Math.min(Math.max(f, 1), sr * 0.49)) / sr;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  const b1 = (type === "lowpass" ? 1 - cos : -(1 + cos)) / a0;
  const b0 = (type === "lowpass" ? (1 - cos) / 2 : (1 + cos) / 2) / a0;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i += 1) {
    const v = b0 * x[i] + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = v;
    x[i] = v;
  }
  return x;
}

/**
 * Keep only lo..hi hertz: a fourth-order Butterworth high-pass at lo and
 * low-pass at hi (24 dB per octave each side, flat in between). Returns a new array.
 */
export function bandpass(x, sr, lo, hi) {
  const y = Float32Array.from(x);
  for (const q of [0.5412, 1.3066]) {
    section(y, sr, "highpass", lo, q);
    section(y, sr, "lowpass", hi, q);
  }
  return y;
}

/**
 * When does a sound begin near time t (seconds into x)?
 * Looks from t - before to t + after at the level in 5 ms windows, 1 ms apart.
 * The level just before t is taken as the 95th percentile of what came before
 * (so the ripple of a low held note is not mistaken for a start), and the
 * sound is said to begin where the level has risen a quarter of the way from
 * there to its peak. Returns { time, lagMs, riseDb }, or null when nothing
 * rises by 3 dB.
 *   band  [lo, hi] in Hz: listen in that band only
 */
export function onsetNear(x, sr, t, { before = 0.12, after = 0.2, band = null, guard = 0.012 } = {}) {
  const a = Math.max(0, Math.round((t - before) * sr));
  const b = Math.min(x.length, Math.round((t + after) * sr));
  if (b - a < sr * 0.03) return null;
  if (before < 0.02) {
    // nothing comes before (the start of the film): the sound begins where its level first
    // reaches a quarter of its peak
    let seg0 = x.subarray(a, b);
    if (band) seg0 = bandpass(seg0, sr, band[0], band[1]);
    const win0 = Math.round(sr * 0.005);
    const hop0 = Math.round(sr * 0.001);
    const env0 = [];
    for (let i = 0; i + win0 <= seg0.length; i += hop0) {
      let s = 0;
      for (let j = 0; j < win0; j += 1) s += seg0[i + j] * seg0[i + j];
      env0.push(Math.sqrt(s / win0));
    }
    const peak0 = Math.max(...env0);
    if (!(peak0 > 1e-6)) return null;
    const i0 = env0.findIndex((v) => v >= 0.25 * peak0);
    const time = a / sr + (i0 * hop0 + win0) / sr;
    return { time, lagMs: (time - t) * 1000, riseDb: dbfs(peak0) + 120 };
  }
  let seg = x.subarray(a, b);
  if (band) seg = bandpass(seg, sr, band[0], band[1]);
  const hop = Math.round(sr * 0.001);
  const win = Math.round(sr * 0.005);
  const env = [];
  for (let i = 0; i + win <= seg.length; i += hop) {
    let s = 0;
    for (let j = 0; j < win; j += 1) s += seg[i + j] * seg[i + j];
    env.push(Math.sqrt(s / win));
  }
  // index of the last window that ends before t - guard
  const preEnd = Math.max(1, Math.min(env.length - 1, Math.floor(((before - guard) * sr - win) / hop)));
  const pre = env.slice(0, preEnd).sort((p, q) => p - q);
  const floor = pre[Math.min(pre.length - 1, Math.floor(pre.length * 0.95))] || 0;
  let peak = 0;
  for (let i = preEnd; i < env.length; i += 1) if (env[i] > peak) peak = env[i];
  const riseDb = dbfs(peak) - dbfs(Math.max(floor, 1e-7));
  if (!(riseDb >= 3)) return null;
  const threshold = floor + 0.25 * (peak - floor);
  for (let i = preEnd; i < env.length; i += 1) {
    if (env[i] >= threshold && (i + 2 >= env.length || env[i + 2] >= threshold)) {
      // the new sound has just entered the end of this window
      const time = a / sr + (i * hop + win) / sr;
      return { time, lagMs: (time - t) * 1000, riseDb };
    }
  }
  return null;
}

/** In-place radix-2 FFT of complex data (re, im). Length must be a power of two. */
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let j = 0; j < len / 2; j += 1) {
        const ur = re[i + j];
        const ui = im[i + j];
        const vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci;
        const vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
        re[i + j] = ur + vr;
        im[i + j] = ui + vi;
        re[i + j + len / 2] = ur - vr;
        im[i + j + len / 2] = ui - vi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/** Magnitude spectrum of x[from .. from + len) with a Hann window, zero-padded to `size` (a power of two). */
export function spectrum(x, from, len, size) {
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let i = 0; i < len; i += 1) {
    const v = from + i >= 0 && from + i < x.length ? x[from + i] : 0;
    re[i] = v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (len - 1)));
  }
  fft(re, im);
  const mag = new Float64Array(size / 2);
  for (let i = 0; i < size / 2; i += 1) mag[i] = Math.hypot(re[i], im[i]);
  return mag;
}

/**
 * The pitch actually sounding between t0 and t1, near an expected frequency.
 * Looks first within 70 cents of it (a neighbour's partial a little way off
 * must not pull the reading); if something at least twice as strong lies
 * further off, within `range` semitones, that is reported instead, because
 * then the note itself is probably wrong.
 * Returns { hz, cents, strengthDb, resolutionCents }: cents off the expected
 * pitch, how strong that partial is against the strongest partial anywhere
 * (0 dB = it is the loudest thing in the spectrum), and how finely a window
 * of this length can tell pitch at this frequency.
 */
export function pitchNear(x, sr, t0, t1, expectedHz, range = 1.5) {
  const len = Math.max(1024, Math.min(Math.round((t1 - t0) * sr), 16384));
  const from = Math.round(((t0 + t1) / 2) * sr - len / 2);
  const size = 131072;
  const mag = spectrum(x, from, len, size);
  const binHz = sr / size;
  const strongest = (cents) => {
    const lo = Math.max(1, Math.floor((expectedHz * 2 ** (-cents / 1200)) / binHz));
    const hi = Math.min(mag.length - 2, Math.ceil((expectedHz * 2 ** (cents / 1200)) / binHz));
    let best = lo;
    for (let i = lo; i <= hi; i += 1) if (mag[i] > mag[best]) best = i;
    return best;
  };
  let best = strongest(70);
  const wide = strongest(range * 100);
  if (mag[wide] > 2 * mag[best]) best = wide;
  let top = 0;
  for (let i = Math.floor(40 / binHz); i < mag.length; i += 1) if (mag[i] > top) top = mag[i];
  const a = mag[best - 1];
  const b = mag[best];
  const c = mag[best + 1];
  const shift = a - 2 * b + c !== 0 ? (0.5 * (a - c)) / (a - 2 * b + c) : 0;
  const f = (best + shift) * binHz;
  const resolutionCents = (1731 * (0.25 / (len / sr))) / expectedHz;
  return { hz: f, cents: 1200 * Math.log2(f / expectedHz), strengthDb: dbfs(b / (top || 1)), resolutionCents };
}

/** Where the energy sits: spectral centroid (Hz) and the share of energy below 120 Hz and above 8 kHz. */
export function balance(x, sr, from, to) {
  const size = 8192;
  const acc = new Float64Array(size / 2);
  let frames = 0;
  for (let at = Math.round(from * sr); at + size <= Math.min(x.length, Math.round(to * sr)); at += size / 2) {
    const mag = spectrum(x, at, size, size);
    for (let i = 0; i < acc.length; i += 1) acc[i] += mag[i] * mag[i];
    frames += 1;
  }
  if (!frames) return null;
  let total = 0;
  let weighted = 0;
  let low = 0;
  let high = 0;
  const binHz = sr / size;
  for (let i = 1; i < acc.length; i += 1) {
    const f = i * binHz;
    total += acc[i];
    weighted += acc[i] * f;
    if (f < 120) low += acc[i];
    if (f > 8000) high += acc[i];
  }
  return { centroid: weighted / (total || 1), below120: low / (total || 1), above8k: high / (total || 1) };
}

/** Largest jump between neighbouring samples: a click shows as a jump far above the rest. */
export function worstStep(x, from = 0, to = x.length) {
  let worst = 0;
  let at = 0;
  for (let i = Math.max(1, from); i < Math.min(x.length, to); i += 1) {
    const d = Math.abs(x[i] - x[i - 1]);
    if (d > worst) {
      worst = d;
      at = i;
    }
  }
  return { step: worst, at };
}

/**
 * EBU R128 loudness of a file (or a stretch of it), measured by ffmpeg.
 * Returns { integrated (LUFS), range (LU), truePeak (dBTP) }.
 */
export function loudness(file, { from = null, dur = null } = {}) {
  const args = ["-hide_banner", "-nostats"];
  if (from !== null) args.push("-ss", String(from));
  if (dur !== null) args.push("-t", String(dur));
  args.push("-i", file, "-filter_complex", "ebur128=peak=true", "-f", "null", "-");
  const res = spawnSync("ffmpeg", args, { encoding: "utf8" });
  const text = res.stderr || "";
  const tail = text.slice(text.lastIndexOf("Summary:"));
  const num = (re) => {
    const m = re.exec(tail);
    return m ? Number(m[1]) : null;
  };
  return { integrated: num(/I:\s+(-?[\d.]+|-inf) LUFS/), range: num(/LRA:\s+(-?[\d.]+) LU/), truePeak: num(/Peak:\s+(-?[\d.]+|-inf) dBFS/) };
}

/**
 * A spectrogram picture with a beat grid, a waveform under it and frequency guide lines.
 *   from, to    seconds of the file to show
 *   beatOffset  seconds from `from` to the first beat (beats are 0.5 s apart; bar lines every 2 s, given by barOffset)
 * Frequency runs from 40 Hz (bottom) to 16 kHz (top) on a logarithmic scale; lines mark 100 Hz, 1 kHz and 10 kHz.
 */
export function spectrogram(file, png, { from = 0, to, pxPerSec = 200, height = 560, beatOffset = 0, barOffset = 0 } = {}) {
  const dur = to - from;
  const w = Math.round(dur * pxPerSec);
  const beat = 0.5 * pxPerSec;
  const bar = 2 * pxPerSec;
  const yOf = (f) => Math.round(height * (1 - Math.log(f / 40) / Math.log(16000 / 40)));
  const guides = [100, 1000, 10000].map((f) => `drawbox=x=0:y=${yOf(f)}:w=${w}:h=1:color=white@0.35:t=fill`).join(",");
  const graph = [
    `[0:a]asplit=2[a][b]`,
    `[a]showspectrumpic=s=${w}x${height}:legend=0:scale=log:fscale=log:start=40:stop=16000:color=magma:drange=96,` +
      `drawgrid=x=${Math.round(beatOffset * pxPerSec)}:y=0:w=${beat}:h=${height}:t=1:color=white@0.16,` +
      `drawgrid=x=${Math.round(barOffset * pxPerSec)}:y=0:w=${bar}:h=${height}:t=1:color=white@0.5,${guides}[s]`,
    `[b]showwavespic=s=${w}x120:split_channels=0:colors=0xd8d8d8,drawgrid=x=${Math.round(barOffset * pxPerSec)}:y=0:w=${bar}:h=120:t=1:color=white@0.5[v]`,
    `[s][v]vstack[o]`,
  ].join(";");
  const res = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(from), "-t", String(dur), "-i", file, "-filter_complex", graph, "-map", "[o]", "-frames:v", "1", png], { encoding: "utf8" });
  if (res.status !== 0) throw new Error(`ffmpeg spectrogram failed: ${res.stderr}`);
  return { width: w, height: height + 120 };
}
