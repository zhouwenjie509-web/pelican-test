// Scratch: level of one frequency over time (Hann-windowed DFT bin), mono sum.
// node dev/audio/code-bin.mjs file.wav fileStartFilmSec freqHz fromFilm toFilm [win=0.1] [step=0.02]
import { readFileSync } from "node:fs";
const [file, t0s, fs_, froms, tos, wins = "0.1", steps = "0.02"] = process.argv.slice(2);
const b = readFileSync(file);
let p = 12, fmt, ch, sr, bits, data;
while (p < b.length) {
  const id = b.toString("ascii", p, p + 4), sz = b.readUInt32LE(p + 4);
  if (id === "fmt ") { fmt = b.readUInt16LE(p + 8); ch = b.readUInt16LE(p + 10); sr = b.readUInt32LE(p + 12); bits = b.readUInt16LE(p + 22); }
  if (id === "data") { data = [p + 8, sz]; break; }
  p += 8 + sz + (sz & 1);
}
const bps = bits / 8, n = data[1] / (bps * ch);
const x = new Float32Array(n);
for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
  const o = data[0] + (i * ch + c) * bps;
  x[i] += (fmt === 3 ? b.readFloatLE(o) : bits === 16 ? b.readInt16LE(o) / 32768 : bits === 24 ? b.readIntLE(o, 3) / 8388608 : b.readInt32LE(o) / 2147483648) / ch;
}
const f = +fs_, W = Math.round(+wins * sr), t0 = +t0s;
for (let t = +froms; t <= +tos + 1e-9; t += +steps) {
  const c = Math.round((t - t0) * sr), s0 = c - W / 2;
  let re = 0, im = 0, wsum = 0;
  for (let i = 0; i < W; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / W);
    const v = x[s0 + i] || 0;
    re += v * w * Math.cos((2 * Math.PI * f * i) / sr); im += v * w * Math.sin((2 * Math.PI * f * i) / sr); wsum += w;
  }
  const a = (2 * Math.hypot(re, im)) / wsum;
  console.log(`${t.toFixed(3)}  ${(20 * Math.log10(a + 1e-12)).toFixed(1)} dB`);
}
