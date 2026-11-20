// Scratch: pitch of the shaking E (lead alone) in 25 ms windows, by autocorrelation-free zero-crossing timing.
import { readFileSync } from "node:fs";
const [file, t0s, t1s] = process.argv.slice(2);
const b = readFileSync(file);
let p = 12, fmt, data;
while (p < b.length) { const id = b.toString("ascii", p, p + 4); const sz = b.readUInt32LE(p + 4); if (id === "fmt ") fmt = { ch: b.readUInt16LE(p + 10), sr: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22), tag: b.readUInt16LE(p + 8) }; if (id === "data") data = [p + 8, sz]; p += 8 + sz + (sz & 1); }
const bps = fmt.bits / 8, fr = bps * fmt.ch, n = data[1] / fr;
const at = (i) => fmt.tag === 3 ? b.readFloatLE(data[0] + i * fr) : (fmt.bits === 16 ? b.readInt16LE(data[0] + i * fr) / 32768 : b.readIntLE(data[0] + i * fr, 3) / 8388608);
const start = 100; // file starts at film 100 s
const ref = 440 * 2 ** ((76 - 69) / 12);
for (let t = +t0s; t < +t1s; t += 0.025) {
  const i0 = Math.round((t - start) * fmt.sr), i1 = i0 + Math.round(0.025 * fmt.sr);
  const zc = [];
  for (let i = i0; i < i1; i++) { const a = at(i), c = at(i + 1); if (a <= 0 && c > 0) zc.push(i + a / (a - c)); }
  if (zc.length < 3) { console.log(t.toFixed(3), "-"); continue; }
  const f = ((zc.length - 1) * fmt.sr) / (zc[zc.length - 1] - zc[0]);
  console.log(t.toFixed(3), f.toFixed(1), (1200 * Math.log2(f / ref)).toFixed(1), "cents");
}
