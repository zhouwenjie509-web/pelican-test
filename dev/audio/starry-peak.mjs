// scratch: sample values of each stem at the mix's peak (starry)
import { readWav } from "../../tools/lib/sound.mjs";
const t = Number(process.argv[2]);
const mix = readWav("out/audio/s12.wav");
const sr = mix.sampleRate || mix.sr;
const i0 = Math.round((t - 70) * sr);
let best = 0, bi = i0, bc = 0;
for (let i = i0 - 2400; i < i0 + 2400; i++) for (let c = 0; c < 2; c++) { const v = Math.abs(mix.channels[c][i]); if (v > best) { best = v; bi = i; bc = c; } }
console.log("mix peak", best.toFixed(4), "at", (70 + bi / sr).toFixed(4), "ch", bc, "sign", Math.sign(mix.channels[bc][bi]));
for (const l of ["vln1", "swirl", "run", "hush", "vc", "pizz"]) {
  const w = readWav(`out/audio/s12_${l}.wav`);
  console.log(l.padEnd(6), w.channels[bc][bi].toFixed(4));
}
