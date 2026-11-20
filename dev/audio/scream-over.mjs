// Scratch: peak |x| of a WAV (max over channels), where, and how many samples exceed a threshold.
// usage: node dev/audio/scream-over.mjs file.wav threshold
import fs from "node:fs";
const [file, th] = process.argv.slice(2);
const b = fs.readFileSync(file);
let p = 12, fmt, data;
while (p < b.length) {
  const id = b.toString("ascii", p, p + 4);
  const sz = b.readUInt32LE(p + 4);
  if (id === "fmt ") fmt = { tag: b.readUInt16LE(p + 8), ch: b.readUInt16LE(p + 10), sr: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
  if (id === "data") data = [p + 8, sz];
  p += 8 + sz + (sz & 1);
}
const bs = fmt.bits / 8;
const n = data[1] / bs / fmt.ch;
const meta = JSON.parse(fs.readFileSync(file.replace(/\.wav$/, ".json"), "utf8"));
let peak = 0, at = 0, over = 0, active = 0;
for (let i = 0; i < n; i++) {
  let m = 0;
  for (let c = 0; c < fmt.ch; c++) {
    const o = data[0] + (i * fmt.ch + c) * bs;
    const v = Math.abs(fmt.tag === 3 ? b.readFloatLE(o) : bs === 2 ? b.readInt16LE(o) / 32768 : bs === 3 ? b.readIntLE(o, 3) / 8388608 : b.readInt32LE(o) / 2147483648);
    if (v > m) m = v;
  }
  if (m > peak) { peak = m; at = i; }
  if (m > Number(th)) over++;
  if (m > 1e-3) active++;
}
console.log(`${file}: peak ${peak.toFixed(4)} (${(20 * Math.log10(peak)).toFixed(1)} dBFS) at film ${(meta.from + at / fmt.sr).toFixed(3)}; ${over} samples over ${th} (${((100 * over) / Math.max(1, active)).toFixed(2)} % of the sounding samples)`);
