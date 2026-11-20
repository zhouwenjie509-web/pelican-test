// Scratch (vapor): level every 2 ms across a seam, and the largest sample step there.
import { readWav, toMono, dbfs } from "../../tools/lib/sound.mjs";
const [file, from, ...ts] = process.argv.slice(2);
const { sampleRate: sr, channels } = readWav(file);
const x = toMono(channels);
for (const t of ts.map(Number)) {
  const row = [];
  let step = 0;
  for (let d = -0.012; d < 0.014; d += 0.002) {
    const a = Math.round((t + d - Number(from)) * sr);
    let s = 0;
    for (let i = 0; i < 96; i++) { s += x[a + i] ** 2; step = Math.max(step, Math.abs(x[a + i + 1] - x[a + i])); }
    row.push(dbfs(Math.sqrt(s / 96)).toFixed(1));
  }
  console.log(`${t}: ${row.join(" ")}  max step ${step.toFixed(4)}`);
}
