// Scratch: a stem against the mix, rms (mean of both ears) in 50 ms windows, one band.
// node dev/audio/ukiyoe-fold.mjs stem.wav mix.wav [lo hi] [from to step win]   (film s; files start at 64.0)
import { readFileSync } from "node:fs";
import { biquad } from "../../audio/engine/dsp.js";

function read(file) {
  const b = readFileSync(file);
  let p = 12, ch = 2, bits = 24, data = null;
  while (p < b.length) {
    const id = b.toString("ascii", p, p + 4), size = b.readUInt32LE(p + 4);
    if (id === "fmt ") { ch = b.readUInt16LE(p + 10); bits = b.readUInt16LE(p + 22); }
    if (id === "data") { data = b.subarray(p + 8, p + 8 + size); break; }
    p += 8 + size + (size & 1);
  }
  const bps = bits / 8, n = data.length / (bps * ch);
  const out = Array.from({ length: ch }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const o = (i * ch + c) * bps;
    out[c][i] = bits === 24 ? data.readIntLE(o, 3) / 8388608 : bits === 16 ? data.readInt16LE(o) / 32768 : data.readFloatLE(o);
  }
  return out;
}
const band = (x, lo, hi) => biquad(biquad(biquad(biquad(x, "highpass", lo, 0.707), "highpass", lo, 0.707), "lowpass", hi, 0.707), "lowpass", hi, 0.707);
const [, , sf, mf, lo = 1500, hi = 4500, from = 69.9, to = 70.3, step = 0.05, win = 0.05] = process.argv;
const T0 = 64.0, SR = 48000;
const S = read(sf).map((c) => band(c, +lo, +hi)), M = read(mf).map((c) => band(c, +lo, +hi));
const db = (X, a, w) => { let s = 0; const i0 = Math.round((a - T0) * SR), n = Math.round(w * SR); for (const c of X) for (let i = i0; i < i0 + n; i++) s += c[i] * c[i]; return 10 * Math.log10(s / (n * X.length) + 1e-20); };
console.log(`band ${lo}-${hi} Hz, ${win * 1000} ms windows: film s  stem dB  mix dB  stem-mix`);
for (let t = +from; t < +to - 1e-9; t += +step) { const a = db(S, t, +win), b = db(M, t, +win); console.log(t.toFixed(3), a.toFixed(1).padStart(7), b.toFixed(1).padStart(7), (a - b).toFixed(1).padStart(7)); }
