// Scratch: the open D3 with and without its buzz, level in 1.5-6 kHz over time.
import { _ukiyoe } from "../../audio/parts/11-ukiyoe.js";
import { biquad, SR } from "../../audio/engine/dsp.js";
const band = (y) => biquad(biquad(y, "highpass", 1500, 0.7), "lowpass", 6000, 0.7);
const g = Number(process.argv[2] || 1);
const a = band(_ukiyoe.shamisenSamples(50, "down", 0)), b = band(_ukiyoe.shamisenSamples(50, "down", g));
const db = (x, i0, i1) => { let s = 0; for (let i = i0; i < i1; i++) s += x[i] * x[i]; return 10 * Math.log10(s / (i1 - i0) + 1e-20); };
for (let t = 0; t < 0.9; t += 0.1) { const i0 = Math.round(t * SR), i1 = Math.round((t + 0.05) * SR); console.log(t.toFixed(1), "plain", db(a, i0, i1).toFixed(1), "with buzz", db(b, i0, i1).toFixed(1)); }
