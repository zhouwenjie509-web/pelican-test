// Largest difference between two renders of the same stretch, per window of film time.
import { readWav } from "../../tools/lib/sound.mjs";
const [a, b] = process.argv.slice(2).map((f) => readWav(f));
const from = 46, sr = a.sampleRate;
for (const [t0, t1] of [[46, 50.9999], [51, 53], [53, 55]]) {
  let d = 0;
  for (let c = 0; c < 2; c++) for (let i = Math.round((t0 - from) * sr); i < Math.round((t1 - from) * sr); i++) d = Math.max(d, Math.abs(a.channels[c][i] - b.channels[c][i]));
  console.log(`film ${t0}-${t1}: largest difference ${d === 0 ? "0 (identical)" : (20 * Math.log10(d)).toFixed(1) + " dBFS"}`);
}
