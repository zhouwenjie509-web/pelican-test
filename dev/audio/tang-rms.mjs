// Scratch: rms (dBFS, mono) of a WAV over film-second windows. args: file t0File a:b a:b ...
import { readWav, toMono } from "../../tools/lib/sound.mjs";
const w = readWav(process.argv[2]); const x = toMono(w.channels || w.data || w);
const sr = w.sampleRate || w.sr || 48000; const t0 = Number(process.argv[3]);
for (const s of process.argv.slice(4)) {
  const [a, b] = s.split(":").map(Number); let e = 0, n = 0;
  for (let i = Math.round((a - t0) * sr); i < Math.round((b - t0) * sr); i++) { e += x[i] * x[i]; n++; }
  console.log(s, (10 * Math.log10(e / n + 1e-20)).toFixed(1), "dBFS rms");
}
