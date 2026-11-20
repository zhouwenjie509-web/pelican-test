// Where are the loudest moments of a render? Prints the peak of each 50 ms block above a threshold (dBFS).
import { readWav } from "../../tools/lib/sound.mjs";
import fs from "node:fs";
const file = process.argv[2] || "out/audio/s14.wav";
const thr = Number(process.argv[3] || -9);
const side = JSON.parse(fs.readFileSync(file.replace(/\.wav$/, ".json"), "utf8"));
const { sampleRate: sr, channels } = readWav(file);
const blk = Math.round(sr * 0.05);
for (let b = 0; b * blk < channels[0].length; b += 1) {
  let p = 0;
  for (const c of channels) for (let i = b * blk; i < Math.min(c.length, (b + 1) * blk); i += 1) p = Math.max(p, Math.abs(c[i]));
  const db = 20 * Math.log10(p + 1e-12);
  if (db > thr) console.log((side.from + b * 0.05).toFixed(2), db.toFixed(1));
}
