// Scratch: the 95th-percentile 5 ms RMS (as onsetNear computes its floor) in a film window, per file.
// node dev/audio/shortvideo-floor.mjs <filmStartOfFile> <from> <to> file.wav ...
import { readWav, toMono, dbfs } from "../../tools/lib/sound.mjs";

const [start, from, to, ...files] = process.argv.slice(2);
for (const f of files) {
  const w = readWav(f);
  const x = toMono(w.channels);
  const sr = w.sampleRate || w.sr || 48000;
  const a = Math.round((from - start) * sr);
  const b = Math.round((to - start) * sr);
  const win = Math.round(sr * 0.005);
  const hop = Math.round(sr * 0.001);
  const env = [];
  for (let i = a; i + win <= b; i += hop) {
    let s = 0;
    for (let j = 0; j < win; j += 1) s += x[i + j] * x[i + j];
    env.push(Math.sqrt(s / win));
  }
  const srt = env.slice().sort((p, q) => p - q);
  const p95 = srt[Math.floor(srt.length * 0.95)] || 0;
  console.log(`${f}: p95 ${dbfs(p95).toFixed(1)} dB, max ${dbfs(srt[srt.length - 1]).toFixed(1)} dB`);
}
