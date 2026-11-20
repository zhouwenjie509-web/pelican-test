// Scratch: peak level per 50 ms window of a rendered WAV (film seconds), to find where a part is hottest.
import fs from "node:fs";
const [file, t0s = "46", fromS = "47", toS = "50.2"] = process.argv.slice(2);
const b = fs.readFileSync(file);
let off = 12, fmt, data;
while (off < b.length) {
  const id = b.toString("ascii", off, off + 4), size = b.readUInt32LE(off + 4);
  if (id === "fmt ") fmt = { ch: b.readUInt16LE(off + 10), sr: b.readUInt32LE(off + 12), bits: b.readUInt16LE(off + 22), tag: b.readUInt16LE(off + 8) };
  if (id === "data") data = b.subarray(off + 8, off + 8 + size);
  off += 8 + size + (size & 1);
}
const bps = fmt.bits / 8, n = data.length / bps / fmt.ch;
const get = (i, c) => { const p = (i * fmt.ch + c) * bps; return fmt.tag === 3 ? data.readFloatLE(p) : fmt.bits === 16 ? data.readInt16LE(p) / 32768 : fmt.bits === 24 ? data.readIntLE(p, 3) / 8388608 : data.readInt32LE(p) / 2147483648; };
const t0 = Number(t0s), w = Math.round(0.05 * fmt.sr);
for (let t = Number(fromS); t < Number(toS); t += 0.05) {
  const i0 = Math.round((t - t0) * fmt.sr); let m = 0, mono = 0;
  for (let i = i0; i < i0 + w && i < n; i++) { for (let c = 0; c < fmt.ch; c++) m = Math.max(m, Math.abs(get(i, c))); mono = Math.max(mono, Math.abs((get(i,0)+get(i,fmt.ch-1))/2)); }
  console.log(t.toFixed(2), (20 * Math.log10(m + 1e-12)).toFixed(1), "mono", (20 * Math.log10(mono + 1e-12)).toFixed(1));
}
