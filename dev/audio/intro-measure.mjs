// Scratch: band RMS in windows of a 24-bit stereo WAV (mono sum), 24 dB/oct band edges.
// node dev/audio/intro-measure.mjs out/audio/s00.wav lo hi win t0 t1 [t0 t1 ...]
import { readFileSync } from "node:fs";
import { biquad } from "../../audio/engine/dsp.js";

const [file, lo, hi, ...rest] = process.argv.slice(2);
const b = readFileSync(file);
let p = 12, dataOff = 0, dataLen = 0;
while (p < b.length) {
  const id = b.toString("ascii", p, p + 4);
  const len = b.readUInt32LE(p + 4);
  if (id === "data") { dataOff = p + 8; dataLen = len; break; }
  p += 8 + len;
}
const n = dataLen / 6;
let x = new Float32Array(n);
for (let i = 0; i < n; i += 1) {
  const l = b.readIntLE(dataOff + i * 6, 3) / 8388608;
  const r = b.readIntLE(dataOff + i * 6 + 3, 3) / 8388608;
  x[i] = (l + r) / 2;
}
x = biquad(biquad(x, "highpass", +lo), "highpass", +lo);
x = biquad(biquad(x, "lowpass", +hi), "lowpass", +hi);
const SR = 48000;
const db = (a, z) => {
  let s = 0;
  const i0 = Math.round(a * SR), i1 = Math.round(z * SR);
  for (let i = i0; i < i1; i += 1) s += x[i] * x[i];
  return (10 * Math.log10(s / (i1 - i0) + 1e-20)).toFixed(1);
};
if (rest[0] === "win") {
  const [, w, a, z] = rest.map(Number);
  const out = [];
  for (let t = a; t + w <= z + 1e-9; t += w) out.push(`${t.toFixed(2)} ${db(t, t + w)}`);
  console.log(out.join(" | "));
} else {
  for (let i = 0; i < rest.length; i += 2) console.log(`${rest[i]}-${rest[i + 1]}: ${db(+rest[i], +rest[i + 1])} dB`);
}
