// Scratch: 5 ms RMS every 2 ms around a film time. node dev/audio/sahara-trace.mjs file.wav t
import fs from "node:fs";
import { readWav, toMono, dbfs } from "../../tools/lib/sound.mjs";
const [file, t] = process.argv.slice(2);
const from = JSON.parse(fs.readFileSync(file.replace(/\.wav$/, ".json"), "utf8")).from;
const { sampleRate: sr, channels } = readWav(file);
const x = toMono(channels);
const out = [];
for (let d = -0.02; d <= 0.05; d += 0.002) {
  const i0 = Math.round((Number(t) + d - from) * sr);
  const n = Math.round(0.005 * sr);
  let s = 0;
  for (let i = i0; i < i0 + n; i += 1) s += x[i] * x[i];
  out.push(`${Math.round(d * 1000)}:${dbfs(Math.sqrt(s / n)).toFixed(1)}`);
}
console.log(out.join(" "));
