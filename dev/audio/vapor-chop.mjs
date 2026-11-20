// Scratch (vapor): depth of the dip at each skip cut in a band (5 ms windows): level 20-60 ms before vs the minimum around the cut.
import { readWav, toMono, bandpass, dbfs } from "../../tools/lib/sound.mjs";
const [file, from, lo, hi] = process.argv.slice(2);
const { sampleRate: sr, channels } = readWav(file);
const x = bandpass(toMono(channels), sr, Number(lo), Number(hi));
const rms = (t, w = 0.005) => { const a = Math.round((t - Number(from)) * sr); let s = 0; const n = Math.round(w * sr); for (let i = 0; i < n; i++) s += x[a + i] ** 2; return Math.sqrt(s / n); };
const out = [];
for (const u of [3.25, 3.5, 3.75]) {
  const t = 107 + u;
  const before = dbfs(rms(t - 0.06, 0.04));
  let m = 1; for (let d = -0.006; d <= 0.004; d += 0.001) m = Math.min(m, rms(t + d, 0.004));
  const after = dbfs(rms(t + 0.02, 0.04));
  out.push(`${u}: before ${before.toFixed(1)} dip ${dbfs(m).toFixed(1)} after ${after.toFixed(1)}`);
}
// skip-time level vs the bar before (u 2.0-3.0) in the band
const L = (a, b) => dbfs(rms(107 + a, b - a));
console.log(out.join(" | "), `| band rms u2-3 ${L(2, 3).toFixed(1)}, u3-4 ${L(3, 4).toFixed(1)}, u4-5 ${L(4, 5).toFixed(1)}`);
