// A spectrogram made for reading music by eye.
//
// Three window lengths are used at once, so that low notes show their pitch
// (long window) and high transients show their timing (short window). Over
// the picture: the beat grid with film seconds, frequency guides, a mark for
// every declared cue, and a dotted line where each lead note's fundamental
// should be. Under it: the waveform and the level in decibels.

import fs from "node:fs";
import zlib from "node:zlib";
import { fft } from "./sound.mjs";

// ---------------------------------------------------------------- PNG
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
/** Write RGB pixels (Uint8Array, w * h * 3) as a PNG. */
export function writePng(file, rgb, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y += 1) {
    raw[y * (w * 3 + 1)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0);
  head.writeUInt32BE(h, 4);
  head[8] = 8;
  head[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", head), chunk("IDAT", zlib.deflateSync(raw, { level: 6 })), chunk("IEND", Buffer.alloc(0))]));
}

// ---------------------------------------------------------------- drawing
const MAP = [
  [0, 0, 0, 4],
  [0.13, 28, 16, 68],
  [0.25, 79, 18, 123],
  [0.38, 129, 37, 129],
  [0.5, 181, 54, 122],
  [0.63, 229, 80, 100],
  [0.75, 251, 135, 97],
  [0.88, 254, 194, 135],
  [1, 252, 253, 191],
];
function colour(v) {
  const x = v < 0 ? 0 : v > 1 ? 1 : v;
  for (let i = 1; i < MAP.length; i += 1) {
    if (x <= MAP[i][0]) {
      const a = MAP[i - 1];
      const b = MAP[i];
      const t = (x - a[0]) / (b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
    }
  }
  return [252, 253, 191];
}

// a 3 x 5 pixel font for labels
const GLYPHS = {
  0: "111101101101111",
  1: "010110010010111",
  2: "111001111100111",
  3: "111001111001111",
  4: "101101111001001",
  5: "111100111001111",
  6: "111100111101111",
  7: "111001010010010",
  8: "111101111101111",
  9: "111101111001111",
  k: "100101110101101",
  ".": "000000000000010",
  "-": "000000111000000",
  s: "011100010001110",
  d: "001001111101111",
  B: "110101110101110",
  H: "101101111101101",
  z: "000111010100111",
  " ": "000000000000000",
};

class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Uint8Array(w * h * 3);
  }

  set(x, y, r, g, b, a = 1) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.px[i] = this.px[i] * (1 - a) + r * a;
    this.px[i + 1] = this.px[i + 1] * (1 - a) + g * a;
    this.px[i + 2] = this.px[i + 2] * (1 - a) + b * a;
  }

  vline(x, y0, y1, c, a) {
    for (let y = y0; y < y1; y += 1) this.set(x, y, c[0], c[1], c[2], a);
  }

  hline(y, x0, x1, c, a, step = 1) {
    for (let x = x0; x < x1; x += step) this.set(x, y, c[0], c[1], c[2], a);
  }

  text(str, x, y, c = [255, 255, 255], scale = 2) {
    let cx = x;
    for (const ch of String(str)) {
      const g = GLYPHS[ch] || GLYPHS[" "];
      for (let r = 0; r < 5; r += 1) {
        for (let q = 0; q < 3; q += 1) {
          if (g[r * 3 + q] === "1") {
            for (let dy = 0; dy < scale; dy += 1) for (let dx = 0; dx < scale; dx += 1) this.set(cx + q * scale + dx, y + r * scale + dy, c[0], c[1], c[2], 1);
          }
        }
      }
      cx += 4 * scale;
    }
  }
}

/**
 * Draw x (mono samples) from `from` to `to` seconds of the file.
 *   filmStart  film time of the file's first sample (for the grid and labels)
 *   cues       [{ t (film seconds) }]: marked along the top
 *   leads      [{ t, dur, hz }]: a dotted line at each lead note's expected fundamental
 * Frequency axis: fmin at the bottom to fmax at the top, logarithmic.
 * Brightness: decibels below full scale, from -96 (black) to -12 (white-hot).
 */
export function drawSpectrogram(file, x, sr, { from = 0, to, pxPerSec = 200, height = 600, fmin = 30, fmax = 16000, filmStart = 0, cues = [], leads = [] } = {}) {
  const dur = to - from;
  const W = Math.max(16, Math.round(dur * pxPerSec));
  const STRIP = 130;
  const cv = new Canvas(W, height + STRIP);
  const rowHz = (r) => fmin * (fmax / fmin) ** ((height - 1 - r) / (height - 1));
  const yOf = (f) => Math.round((height - 1) * (1 - Math.log(f / fmin) / Math.log(fmax / fmin)));

  // three resolutions: long windows for the bass, short ones for the treble
  const bands = [
    { size: 8192, below: 400 },
    { size: 2048, below: 2200 },
    { size: 512, below: Infinity },
  ];
  const wins = bands.map((b) => {
    const w = new Float64Array(b.size);
    for (let i = 0; i < b.size; i += 1) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (b.size - 1));
    return w;
  });
  // which rows belong to which band, and which bins they cover
  const rows = [];
  for (let r = 0; r < height; r += 1) {
    const f = rowHz(r);
    const lo = rowHz(Math.min(height - 1, r + 0.5));
    const hi = rowHz(Math.max(0, r - 0.5));
    const b = bands.findIndex((q) => f < q.below);
    const binHz = sr / bands[b].size;
    rows.push({ b, pos: f / binHz, lo: lo / binHz, hi: hi / binHz });
  }
  const re = bands.map((b) => new Float64Array(b.size));
  const im = bands.map((b) => new Float64Array(b.size));
  const mag = bands.map((b) => new Float64Array(b.size / 2));
  for (let c = 0; c < W; c += 1) {
    const centre = Math.round((from + (c + 0.5) / pxPerSec) * sr);
    for (let b = 0; b < bands.length; b += 1) {
      const N = bands[b].size;
      const start = centre - N / 2;
      for (let i = 0; i < N; i += 1) {
        const j = start + i;
        re[b][i] = j >= 0 && j < x.length ? x[j] * wins[b][i] : 0;
        im[b][i] = 0;
      }
      fft(re[b], im[b]);
      const norm = 4 / N; // a full-scale sine reads 1
      for (let i = 0; i < N / 2; i += 1) mag[b][i] = Math.hypot(re[b][i], im[b][i]) * norm;
    }
    for (let r = 0; r < height; r += 1) {
      const row = rows[r];
      const m = mag[row.b];
      let v;
      if (row.hi - row.lo >= 1) {
        v = 0;
        for (let i = Math.floor(row.lo); i <= Math.ceil(row.hi) && i < m.length; i += 1) if (m[i] > v) v = m[i];
      } else {
        const i = Math.min(m.length - 2, Math.floor(row.pos));
        const t = row.pos - i;
        v = m[i] * (1 - t) + m[i + 1] * t;
      }
      const db = v > 0 ? 20 * Math.log10(v) : -200;
      const col = colour((db + 96) / 84);
      const i = (r * W + c) * 3;
      cv.px[i] = col[0];
      cv.px[i + 1] = col[1];
      cv.px[i + 2] = col[2];
    }
  }

  // ---- strip: waveform (grey) and level in dB (yellow), -60 dB at the bottom to 0 at the top
  const y0 = height;
  let top = 1e-9;
  for (let i = Math.max(0, Math.round(from * sr)); i < Math.min(x.length, Math.round(to * sr)); i += 1) if (Math.abs(x[i]) > top) top = Math.abs(x[i]);
  for (let c = 0; c < W; c += 1) {
    const a = Math.round((from + c / pxPerSec) * sr);
    const b = Math.round((from + (c + 1) / pxPerSec) * sr);
    let peak = 0;
    let sq = 0;
    let n = 0;
    for (let i = Math.max(0, a); i < Math.min(x.length, b); i += 1) {
      const v = Math.abs(x[i]);
      if (v > peak) peak = v;
      sq += v * v;
      n += 1;
    }
    const half = Math.round((Math.min(1, peak / top) * (STRIP - 10)) / 2); // the waveform fills the strip; the yellow line gives the true level
    const mid = y0 + STRIP / 2;
    cv.vline(c, Math.round(mid - half), Math.round(mid + half) + 1, [150, 150, 150], 1);
    const db = n && sq > 0 ? 10 * Math.log10(sq / n) : -200;
    const yy = y0 + Math.round((STRIP - 1) * Math.min(1, Math.max(0, -db / 60)));
    cv.set(c, yy, 255, 220, 60, 1);
    cv.set(c, yy + 1, 255, 220, 60, 1);
  }
  for (const d of [-20, -40]) {
    const yy = y0 + Math.round(((STRIP - 1) * -d) / 60);
    cv.hline(yy, 0, W, [255, 220, 60], 0.25, 3);
    cv.text(`${d}dB`, 3, yy - 12, [255, 220, 60], 2);
  }
  cv.hline(y0, 0, W, [255, 255, 255], 0.6);

  // ---- frequency guides
  for (const [f, a, label] of [[50, 0.1], [100, 0.3, "100Hz"], [200, 0.1], [500, 0.1], [1000, 0.3, "1kHz"], [2000, 0.1], [5000, 0.1], [10000, 0.3, "10kHz"]]) {
    const yy = yOf(f);
    cv.hline(yy, 0, W, [255, 255, 255], a);
    if (label) cv.text(label, 3, yy - 12, [255, 255, 255], 2);
  }

  // ---- time grid: beats every 0.5 s of film time, bar lines on odd seconds
  const t0 = filmStart + from;
  for (let b = Math.ceil(t0 / 0.5 - 1e-9); b * 0.5 <= t0 + dur + 1e-9; b += 1) {
    const t = b * 0.5;
    const xx = Math.round((t - t0) * pxPerSec);
    const isBar = Math.abs(((t - 1) / 2) % 1) < 1e-9 || Math.abs((((t - 1) / 2) % 1) - 1) < 1e-9;
    if (isBar) {
      cv.vline(xx, 0, height + STRIP, [255, 255, 255], 0.5);
      if (pxPerSec >= 40 || Math.round(t - 5) % 6 === 0) cv.text(`${Math.round(t)}s`, xx + 4, 18, [255, 255, 255], 2);
    } else if (pxPerSec >= 40) {
      cv.vline(xx, 0, height, [255, 255, 255], 0.14);
    }
  }

  // ---- lead notes: where each fundamental should be
  for (const n of leads) {
    const xa = Math.round((n.t - t0) * pxPerSec);
    const xb = Math.round((n.t + n.dur - t0) * pxPerSec);
    const yy = yOf(n.hz);
    cv.hline(yy, Math.max(0, xa), Math.min(W, xb), [80, 255, 240], 0.95, 3);
    cv.vline(xa, yy - 5, yy + 6, [80, 255, 240], 0.95);
  }

  // ---- cues: a mark at the top
  for (const q of cues) {
    const xx = Math.round((q.t - t0) * pxPerSec);
    for (let k = 0; k < 9; k += 1) cv.hline(k, xx - (8 - k), xx + (9 - k), [80, 255, 240], 1);
  }

  writePng(file, cv.px, W, height + STRIP);
  return { width: W, height: height + STRIP };
}
