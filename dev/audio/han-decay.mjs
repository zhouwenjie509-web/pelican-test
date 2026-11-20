// Scratch: level of a computed buffer every 50 ms (dB of RMS in a 10 ms window).
import { _han } from "../../audio/parts/03-han.js";
const which = process.argv[2] || "chimeSamples";
const m = Number(process.argv[3] || 62);
const y = _han[which](m);
const SR = 48000;
const out = [];
for (let t = 0; t < y.length / SR; t += 0.1) {
  const a = Math.round(t * SR);
  let s = 0;
  for (let i = a; i < Math.min(y.length, a + 480); i++) s += y[i] * y[i];
  out.push(`${t.toFixed(1)}:${(10 * Math.log10(s / 480 + 1e-20)).toFixed(1)}`);
}
console.log(which, m, out.join(" "));
