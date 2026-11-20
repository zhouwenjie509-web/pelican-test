// scratch: the 5 ms envelope around the crown cue in the mix (as onsetNear sees it)
import { readWav, toMono } from "../../tools/lib/sound.mjs";
const w = readWav(process.argv[2] || "out/audio/s06.wav");
const x = toMono(w.channels || w.data || w);
const sr = w.sampleRate || w.sr || 48000;
const t0 = 34; // file start in film seconds
const at = 38.0 - t0;
const win = Math.round(sr * 0.005);
for (let ms = -10; ms <= 80; ms += 1) {
  const i = Math.round((at + ms / 1000) * sr) - win;
  let s = 0;
  for (let j = 0; j < win; j++) s += x[i + j] ** 2;
  if (ms % 2 === 0) console.log(String(ms).padStart(4), (20 * Math.log10(Math.sqrt(s / win))).toFixed(1));
}
