// Level (dB re a full-scale sine, Hann window) of every pitch of D major in octaves 2-5 at one moment,
// and the strongest pitch in each octave.
//   node dev/audio/outro-oct.mjs <wav> <film seconds> [len 0.2] [film t0 of file, default 124]
import { readFileSync } from "node:fs";

const [file, at, lenArg, t0Arg] = process.argv.slice(2);
const len = Number(lenArg || 0.2);
const t0 = Number(t0Arg || 124);
const b = readFileSync(file);
let p = 12;
let fmt;
let x;
let sr;
while (p < b.length) {
  const id = b.toString("ascii", p, p + 4);
  const size = b.readUInt32LE(p + 4);
  if (id === "fmt ") fmt = { ch: b.readUInt16LE(p + 10), sr: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
  if (id === "data") {
    const bytes = fmt.bits / 8;
    const n = size / (fmt.ch * bytes);
    x = new Float64Array(n);
    for (let i = 0; i < n; i += 1) {
      let s = 0;
      for (let c = 0; c < fmt.ch; c += 1) {
        const o = p + 8 + (i * fmt.ch + c) * bytes;
        s += bytes === 3 ? b.readIntLE(o, 3) / 8388608 : bytes === 2 ? b.readInt16LE(o) / 32768 : b.readFloatLE(o);
      }
      x[i] = s / fmt.ch;
    }
    sr = fmt.sr;
    break;
  }
  p += 8 + size + (size % 2);
}
const i0 = Math.round((Number(at) - t0) * sr);
const n = Math.round(len * sr);
function mag(f) {
  let re = 0;
  let im = 0;
  let wsum = 0;
  const w = (2 * Math.PI * f) / sr;
  for (let i = 0; i < n; i += 1) {
    const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    wsum += h;
    const v = x[i0 + i] * h;
    re += v * Math.cos(w * i);
    im -= v * Math.sin(w * i);
  }
  return (2 * Math.hypot(re, im)) / wsum;
}
const NAMES = ["D", "E", "F#", "G", "A", "B", "C#"];
const ST = [2, 4, 6, 7, 9, 11, 13]; // semitones above C
const out = [];
for (let oct = 2; oct <= 5; oct += 1) {
  const row = [];
  for (let j = 0; j < 7; j += 1) {
    const m = 12 * (oct + 1) + ST[j] - (ST[j] >= 12 ? 0 : 0);
    const midi = ST[j] === 13 ? 12 * (oct + 1) + 1 : m; // C# belongs to its own octave (C#oct)
    const f0 = 440 * 2 ** ((midi - 69) / 12);
    let best = 0;
    for (let c = -20; c <= 20; c += 5) best = Math.max(best, mag(f0 * 2 ** (c / 1200)));
    row.push([`${NAMES[j]}${oct}`, 20 * Math.log10(best + 1e-12)]);
  }
  row.sort((a, c) => c[1] - a[1]);
  out.push(`oct ${oct}: ` + row.map(([nm, db]) => `${nm} ${db.toFixed(1)}`).join("  "));
}
console.log(`${file} at ${at} (${len} s)`);
console.log(out.join("\n"));
