// Scratch (vapor): the checker's onset measurement at the skip cues, in several bands.
import { readWav, toMono, onsetNear } from "../../tools/lib/sound.mjs";
const [file, from, ...bands] = process.argv.slice(2);
const { sampleRate: sr, channels } = readWav(file);
const x = toMono(channels);
for (const b of bands) {
  const band = b.split(":").map(Number);
  const row = [3.0, 3.25, 3.5, 3.75, 4.0].map((u) => {
    const on = onsetNear(x, sr, 107 + u - Number(from), { band, before: 0.12 });
    return on ? `${on.lagMs.toFixed(0)}ms/${on.riseDb.toFixed(1)}dB` : "none";
  });
  console.log(b.padEnd(11), row.join("  "));
}
