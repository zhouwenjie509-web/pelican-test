// Scratch: instantaneous pitch of the sitar's fundamental from zero crossings (lowpassed), to see when the bend reaches B4.
import fs from "node:fs";
import { biquad } from "../../audio/engine/dsp.js";
const [file, t0s = "46", fromS = "48.99", toS = "49.15", ref = "493.88"] = process.argv.slice(2);
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
const t0 = Number(t0s), i0 = Math.round((Number(fromS) - t0 - 0.05) * fmt.sr), i1 = Math.round((Number(toS) - t0) * fmt.sr);
let x = new Float32Array(i1 - i0);
for (let i = 0; i < x.length; i++) x[i] = (get(i0 + i, 0) + get(i0 + i, fmt.ch - 1)) / 2;
x = biquad(biquad(x, "lowpass", 620, 0.707), "lowpass", 620, 0.707);
let last = null;
for (let i = 1; i < x.length; i++) if (x[i - 1] < 0 && x[i] >= 0) {
  const t = (i0 + i - 1 + x[i - 1] / (x[i - 1] - x[i])) / fmt.sr + t0;
  if (last !== null && t > Number(fromS)) { const f = 1 / (t - last); console.log(((last + t) / 2).toFixed(4), f.toFixed(1), "Hz", (1200 * Math.log2(f / Number(ref))).toFixed(0), "cents"); }
  last = t;
}
