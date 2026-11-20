// Scratch: sharpest high-band onsets in bar 3, and level 1.8-9 kHz in the last 30 ms before u=6.
import { readWav, toMono } from "../../tools/lib/sound.mjs";
import { biquad } from "../../audio/engine/dsp.js";
const t0File = Number(process.argv[3] || 22);
const w = readWav(process.argv[2]); const x = toMono(w.channels || w.data || w);
const fmt = { sr: w.sampleRate || w.sr || 48000 };
const sr = fmt.sr;
const hi = biquad(biquad(x, "highpass", 4000, 0.7), "highpass", 4000, 0.7);
const db = (v) => (20 * Math.log10(v + 1e-12)).toFixed(1);
const win = (a, b, y) => { let m = 0; for (let i = Math.round(a * sr); i < Math.round(b * sr); i++) m = Math.max(m, Math.abs(y[i])); return m; };
const marks = [];
for (let t = 27.0; t < 29.0; t += 0.005) marks.push([t, win(t - t0File, t - t0File + 0.005, hi)]);
marks.sort((a, b) => b[1] - a[1]);
console.log("bar 3 strongest >4 kHz peaks:", marks.slice(0, 6).map(([t, v]) => `${t.toFixed(3)}:${db(v)}`).join("  "));
const band = biquad(biquad(x, "highpass", 1800, 0.7), "lowpass", 9000, 0.7);
console.log("1.8-9 kHz peak in last 30 ms before u=6:", db(win(28.97 - t0File, 29.0 - t0File, band)), "dBFS; in u 5.75-5.85:", db(win(28.75 - t0File, 28.85 - t0File, band)));
console.log("level at u=8 (31.0 end):", db(win(30.9 - t0File, 30.99 - t0File, x)));
