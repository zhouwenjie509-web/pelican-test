// Scratch: how long a hoof buffer rings around its knock pitch: level every 2 ms in a band around p, from the peak.
import { _han } from "../../audio/parts/03-han.js";
import { biquad } from "../../audio/engine/dsp.js";
for (const [p, v] of [[640, 0], [545, 1]]) {
  const y = _han.hoofSamples(p, 700 + v);
  for (const [lo, name] of [[p, "knock"], [p * 1.73, "overtone"], [190, "thump"]]) {
    const x = biquad(biquad(Float32Array.from(y), "bandpass", lo, 4), "bandpass", lo, 4);
    const lv = []; for (let i = 0; i < x.length; i += 96) { let m = 0; for (let j = i; j < i + 96 && j < x.length; j += 1) m = Math.max(m, Math.abs(x[j])); lv.push(m); }
    const pk = Math.max(...lv), ip = lv.indexOf(pk);
    const at = (db) => { const k = lv.findIndex((v, i) => i > ip && 20 * Math.log10(v / pk) < db); return k < 0 ? "never" : `${(k - ip) * 2} ms`; };
    console.log(`${p} ${name} ${lo.toFixed(0)} Hz: -20 dB after ${at(-20)}, -40 dB after ${at(-40)}, -60 dB after ${at(-60)}`);
  }
}
