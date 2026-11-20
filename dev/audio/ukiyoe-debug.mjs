// Scratch: where the sawari halo has its energy (rms per 50 ms) and its peak.
import { onePole, rng, biquad, SR } from "../../audio/engine/dsp.js";
import { _ukiyoe } from "../../audio/parts/11-ukiyoe.js";
const a = _ukiyoe.shamisenSamples(50, "down", 0), b = _ukiyoe.shamisenSamples(50, "down", 1);
let pa = 0, pb = 0, ia = 0, ib = 0;
for (let i = 0; i < a.length; i++) { if (Math.abs(a[i]) > pa) { pa = Math.abs(a[i]); ia = i; } if (Math.abs(b[i]) > pb) { pb = Math.abs(b[i]); ib = i; } }
console.log("peak plain at", (ia / SR).toFixed(4), "with halo at", (ib / SR).toFixed(4));
for (let t = 0; t < 1; t += 0.1) { let s = 0, s2 = 0; const i0 = Math.round(t * SR); for (let i = i0; i < i0 + 2400; i++) { s += a[i] ** 2; s2 += b[i] ** 2; } console.log(t.toFixed(1), (10 * Math.log10(s / 2400)).toFixed(1), (10 * Math.log10(s2 / 2400)).toFixed(1)); }
