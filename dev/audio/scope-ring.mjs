// Scratch: instantaneous pitch of the ring (u = 3.5) from a --label "split|ring" render,
// by the time between upward zero crossings (one period each), in cents against E5.
// usage: node dev/audio/scope-ring.mjs out/audio/s15_split-ring.wav [startSecondsIntoFile]
import { readFileSync } from "node:fs";

const buf = readFileSync(process.argv[2]);
const start = Number(process.argv[3] || 4.5); // file starts at film 88.0; 92.5 is 4.5 s in
let p = 12;
let fmt;
let data;
while (p < buf.length) {
  const id = buf.toString("ascii", p, p + 4);
  const size = buf.readUInt32LE(p + 4);
  if (id === "fmt ") fmt = { ch: buf.readUInt16LE(p + 10), sr: buf.readUInt32LE(p + 12), bits: buf.readUInt16LE(p + 22), tag: buf.readUInt16LE(p + 8) };
  if (id === "data") data = buf.subarray(p + 8, p + 8 + size);
  p += 8 + size + (size % 2);
}
const bps = fmt.bits / 8;
const read = (i) => {
  const o = i * fmt.ch * bps;
  if (fmt.tag === 3) return data.readFloatLE(o);
  if (fmt.bits === 16) return data.readInt16LE(o) / 32768;
  if (fmt.bits === 24) return data.readIntLE(o, 3) / 8388608;
  return data.readInt32LE(o) / 2147483648;
};
const E5 = 440 * 2 ** (7 / 12);
const i0 = Math.round(start * fmt.sr) + 1;
const i1 = i0 + Math.round(0.2 * fmt.sr);
let last = null;
let min = 0;
let max = 0;
const rows = [];
for (let i = i0; i < i1; i += 1) {
  const a = read(i - 1);
  const b = read(i);
  if (a < 0 && b >= 0) {
    const t = i - 1 + -a / (b - a);
    if (last !== null) {
      const f = fmt.sr / (t - last);
      const c = 1200 * Math.log2(f / E5);
      const ms = ((t + last) / 2 - i0) / fmt.sr * 1000;
      if (ms > 6) { min = Math.min(min, c); max = Math.max(max, c); }
      rows.push([ms, c]);
    }
    last = t;
  }
}
for (const [ms, c] of rows) if (Math.round(ms) % 5 < 2 || Math.abs(c) > 2) process.stdout.write(`${ms.toFixed(1).padStart(6)} ms ${c.toFixed(1).padStart(7)} c\n`);
const after = rows.filter(([ms]) => ms > 150).map(([, c]) => Math.abs(c));
console.log(`after 6 ms: min ${min.toFixed(1)} c, max ${max.toFixed(1)} c; worst after 150 ms ${Math.max(...after).toFixed(2)} c`);
