// scratch: the checker's onset measure at u = 3.0 in several bands
import { readWav, toMono, onsetNear } from "../../tools/lib/sound.mjs";
const w = readWav(process.argv[2]);
const x = toMono(w.channels);
const t = Number(process.argv[3] || 4) ;
for (const band of [null, [200, 1100], [500, 1800], [1000, 1800], [900, 1600], [2000, 5000], [300, 900]]) {
  const o = onsetNear(x, w.sampleRate, t, { band });
  console.log(JSON.stringify(band), o ? `lag ${o.lagMs.toFixed(1)} ms rise ${o.riseDb.toFixed(1)} dB` : "none");
}
const sr = w.sampleRate;
let line = "";
for (let ms = -15; ms <= 40; ms += 1) {
  const a = Math.round((t + ms / 1000) * sr);
  let s = 0;
  for (let j = 0; j < 240; j += 1) s += x[a + j] ** 2;
  line += `${ms}:${(10 * Math.log10(s / 240 + 1e-12)).toFixed(0)} `;
}
console.log(line);
