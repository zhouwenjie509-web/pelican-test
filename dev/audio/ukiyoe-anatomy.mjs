// Scratch: level of a shamisen buffer over time, whole and in a band (Node, no browser).
import { _ukiyoe } from "../../audio/parts/11-ukiyoe.js";
import { biquad, SR } from "../../audio/engine/dsp.js";
const [m, kind, lo = 1500, hi = 6000] = process.argv.slice(2);
const y = _ukiyoe.shamisenSamples(Number(m), kind);
const band = biquad(biquad(y, "highpass", Number(lo), 0.7), "lowpass", Number(hi), 0.7);
const db = (x, a, b) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return (10 * Math.log10(s / (b - a) + 1e-20)).toFixed(1); };
for (let t = 0; t < 1.0; t += 0.05) { const a = Math.round(t * SR), b = Math.round((t + 0.01) * SR); console.log(t.toFixed(2), "all", db(y, a, b), "band", db(band, a, b)); }
