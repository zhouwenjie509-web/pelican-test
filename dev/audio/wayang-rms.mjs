// rms (dBFS, both channels) over the review's windows, for the mix and some labels
import { readWav } from "../../tools/lib/sound.mjs";
const W = [["bar1 59.10-60.95", 59.1, 60.95], ["hush 61.05-61.45", 61.05, 61.45], ["swell 61.50-61.90", 61.5, 61.9], ["bar3 63.05-64.95", 63.05, 64.95]];
for (const f of process.argv.slice(2)) {
  const { sampleRate: sr, channels } = readWav(f);
  const t0 = 58;
  const row = W.map(([n, a, b]) => {
    let s = 0, c = 0;
    for (const ch of channels) for (let i = Math.round((a - t0) * sr); i < Math.round((b - t0) * sr); i++) { s += ch[i] * ch[i]; c++; }
    return `${n}: ${(10 * Math.log10(s / c || 1e-12)).toFixed(1)}`;
  });
  console.log(f.padEnd(28), row.join("  "));
}
