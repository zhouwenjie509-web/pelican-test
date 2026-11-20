// Scratch: peak and rms per 125 ms of out/audio/s19.wav (film 113-119), by band.
import { readWav } from "../../tools/lib/sound.mjs";

const file = process.argv[2] || "out/audio/s19.wav";
const from = Number(process.argv[3] || 112);
const w = readWav(file);
const sr = w.sampleRate || w.sr;
const ch = w.channels || w.data;
const db = (v) => (20 * Math.log10(Math.max(v, 1e-9))).toFixed(1);
for (let u = 0; u < 6.25; u += 0.125) {
  const a = Math.round((113 + u - from) * sr);
  const b = Math.round((113 + u + 0.125 - from) * sr);
  let pk = 0;
  let s = 0;
  let side = 0;
  for (let i = a; i < b; i += 1) {
    const l = ch[0][i];
    const r = ch[1] ? ch[1][i] : l;
    pk = Math.max(pk, Math.abs(l), Math.abs(r));
    s += (l * l + r * r) / 2;
    side += ((l - r) / 2) ** 2;
  }
  console.log(`u ${u.toFixed(3)}  peak ${db(pk)}  rms ${db(Math.sqrt(s / (b - a)))}  side ${db(Math.sqrt(side / (b - a)))}`);
}
