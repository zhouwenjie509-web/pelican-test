// Scratch: level in a narrow band (Blackman-Harris windowed DFT, summed bins) of several WAVs at given film times.
// usage: node dev/audio/scream-band.mjs lo hi winSec t1,t2,... a.wav b.wav ...
import fs from "node:fs";

function readWav(file) {
  const b = fs.readFileSync(file);
  let p = 12, fmt, data;
  while (p < b.length) {
    const id = b.toString("ascii", p, p + 4);
    const sz = b.readUInt32LE(p + 4);
    if (id === "fmt ") fmt = { tag: b.readUInt16LE(p + 8), ch: b.readUInt16LE(p + 10), sr: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === "data") data = [p + 8, sz];
    p += 8 + sz + (sz & 1);
  }
  const n = data[1] / (fmt.bits / 8) / fmt.ch;
  const mono = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let c = 0; c < fmt.ch; c++) {
      const o = data[0] + (i * fmt.ch + c) * (fmt.bits / 8);
      s += fmt.tag === 3 ? b.readFloatLE(o) : fmt.bits === 16 ? b.readInt16LE(o) / 32768 : fmt.bits === 24 ? b.readIntLE(o, 3) / 8388608 : b.readInt32LE(o) / 2147483648;
    }
    mono[i] = s / fmt.ch;
  }
  return { sr: fmt.sr, x: mono };
}

const [lo, hi, win, times, ...files] = process.argv.slice(2);
const T = times.split(",").map(Number);
for (const f of files) {
  const meta = JSON.parse(fs.readFileSync(f.replace(/\.wav$/, ".json"), "utf8"));
  const { sr, x } = readWav(f);
  const N = Math.round(Number(win) * sr);
  const w = new Float64Array(N);
  let wsum = 0;
  for (let i = 0; i < N; i++) {
    const a = (2 * Math.PI * i) / (N - 1);
    w[i] = 0.35875 - 0.48829 * Math.cos(a) + 0.14128 * Math.cos(2 * a) - 0.01168 * Math.cos(3 * a);
    wsum += w[i] * w[i];
  }
  const row = [];
  for (const t of T) {
    const s0 = Math.round((t - meta.from) * sr);
    let pw = 0;
    const df = sr / N / 2; // half-bin steps
    for (let fq = Number(lo); fq <= Number(hi); fq += df) {
      let re = 0, im = 0;
      const k = (2 * Math.PI * fq) / sr;
      for (let i = 0; i < N; i++) { const v = x[s0 + i] * w[i]; re += v * Math.cos(k * i); im -= v * Math.sin(k * i); }
      pw += (re * re + im * im) / 2; // half-bin oversampling
    }
    row.push((10 * Math.log10((2 * pw) / (wsum * N) + 1e-20)).toFixed(1));
  }
  console.log(f.padEnd(34), row.join("  "));
}
