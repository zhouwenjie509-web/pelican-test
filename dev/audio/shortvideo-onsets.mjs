// Scratch: first sample above -60 dBFS after each given film time, in each WAV (film start read from the .json beside it).
// node dev/audio/shortvideo-onsets.mjs <wav> <film t> [<film t> ...]
import { readFileSync } from "node:fs";

const [file, ...ts] = process.argv.slice(2);
const buf = readFileSync(file);
let p = 12, fmt, data;
while (p < buf.length) {
  const id = buf.toString("ascii", p, p + 4);
  const len = buf.readUInt32LE(p + 4);
  if (id === "fmt ") fmt = { tag: buf.readUInt16LE(p + 8), ch: buf.readUInt16LE(p + 10), sr: buf.readUInt32LE(p + 12), bits: buf.readUInt16LE(p + 22) };
  if (id === "data") data = buf.subarray(p + 8, p + 8 + len);
  p += 8 + len + (len % 2);
}
const bps = fmt.bits / 8;
const frames = data.length / (bps * fmt.ch);
const sample = (i, c) => {
  const o = (i * fmt.ch + c) * bps;
  return fmt.bits === 32 ? data.readFloatLE(o) : data.readInt16LE(o) / 32768;
};
const t0 = JSON.parse(readFileSync(file.replace(/\.wav$/, ".json"), "utf8")).from ?? 112;
const thr = 10 ** (-60 / 20);
for (const t of ts.map(Number)) {
  let i = Math.max(0, Math.round((t - 0.01 - t0) * fmt.sr));
  // wait for a quiet spot first, then find the onset
  while (i < frames && Math.max(Math.abs(sample(i, 0)), Math.abs(sample(i, 1))) >= thr && (i / fmt.sr + t0) < t - 0.002) i += 1;
  for (; i < frames; i += 1) if (Math.max(Math.abs(sample(i, 0)), Math.abs(sample(i, 1))) >= thr) break;
  console.log(`${t.toFixed(3)}: first sample above -60 dBFS at ${(i / fmt.sr + t0).toFixed(4)} (${(((i / fmt.sr + t0) - t) * 1000).toFixed(2)} ms)`);
}
