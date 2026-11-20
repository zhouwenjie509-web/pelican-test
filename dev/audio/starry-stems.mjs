// scratch: RMS of a stem in 0.5 s windows over film 71-77 s (starry), dBFS, both channels
import { readWav } from "../../tools/lib/sound.mjs";
for (const f of process.argv.slice(2)) {
  const w = readWav(f);
  const sr = w.sampleRate || w.sr;
  const row = [];
  for (let t = 71; t < 77; t += 0.5) {
    let s = 0, n = 0;
    for (let i = Math.round((t - 70) * sr); i < Math.round((t + 0.5 - 70) * sr); i++) for (const c of w.channels) { s += c[i] * c[i]; n++; }
    row.push((10 * Math.log10(s / n)).toFixed(1));
  }
  console.log(f.padEnd(34), row.join(" "));
}
