// Amplitude (dBFS, mono) of given frequencies over a window, by a Hann-windowed DFT at that exact frequency.
import { readWav, toMono } from "../../tools/lib/sound.mjs";
const [file, at, len, ...fs] = process.argv.slice(2);
const w = readWav(file); const x = toMono(w.channels); const sr = w.sampleRate || w.sr || 48000;
const film0 = Number(process.env.FILM0 || 52);
const a = Math.round((Number(at) - film0) * sr), n = Math.round(Number(len) * sr);
let tot = 0; for (let i = 0; i < n; i++) tot += x[a + i] ** 2;
const out = [`${file.split("/").pop()} rms ${(10 * Math.log10(tot / n)).toFixed(2)} dBFS`];
for (const f of fs.map(Number)) {
  let re = 0, im = 0, ws = 0;
  for (let i = 0; i < n; i++) { const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)); ws += h; const p = (2 * Math.PI * f * i) / sr; re += x[a + i] * h * Math.cos(p); im += x[a + i] * h * Math.sin(p); }
  out.push(`${f} Hz ${(20 * Math.log10((2 * Math.hypot(re, im)) / ws)).toFixed(2)} dB`);
}
console.log(out.join("  "));
