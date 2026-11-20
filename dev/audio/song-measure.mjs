// node dev/audio/song-measure.mjs file.wav from:to:step [lo:hi]  -> RMS dB per window (film seconds)
import fs from "node:fs";
import { readWav, toMono, bandpass } from "../../tools/lib/sound.mjs";
const [file, range, band] = process.argv.slice(2);
const side = JSON.parse(fs.readFileSync(file.replace(/\.wav$/, ".json"), "utf8"));
const { sampleRate: sr, channels } = readWav(file);
let x = toMono(channels);
if (band) { const [lo, hi] = band.split(":").map(Number); x = bandpass(x, sr, lo, hi); }
const [a, b, st] = range.split(":").map(Number);
const out = [];
const stp = st || (b - a);
for (let t = a; t < b - 1e-9; t += stp) {
  const i0 = Math.round((t - side.from) * sr), i1 = Math.round((Math.min(b, t + stp) - side.from) * sr);
  let s = 0; for (let i = i0; i < i1; i++) s += x[i] * x[i];
  out.push(`${t.toFixed(2)}:${(10 * Math.log10(s / (i1 - i0) + 1e-20)).toFixed(1)}`);
}
console.log((band || "broad") + "  " + out.join("  "));
