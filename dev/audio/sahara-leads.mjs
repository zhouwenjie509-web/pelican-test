// Every lead note's tuning, as the check measures it, for one or two renders side by side.
// usage: node dev/audio/sahara-leads.mjs out/audio/a.wav [out/audio/b.wav]
import fs from "node:fs";
import { readWav, toMono, pitchNear } from "../../tools/lib/sound.mjs";
import { hz, noteName } from "../../audio/engine/theory.js";

const files = process.argv.slice(2);
const rows = files.map((f) => {
  const side = JSON.parse(fs.readFileSync(f.replace(/\.wav$/, ".json"), "utf8"));
  const { sampleRate: sr, channels } = readWav(f);
  const x = toMono(channels);
  const rel = (t) => t - side.from;
  return side.leads.map((n) => ({ n, r: pitchNear(x, sr, rel(n.t) + Math.min(0.04, n.dur * 0.25), rel(n.t) + Math.min(n.dur, 0.34), hz(n.midi)) }));
});
rows[0].forEach(({ n }, i) => {
  const cells = rows.map((r) => `${r[i].r.cents >= 0 ? "+" : ""}${r[i].r.cents.toFixed(1).padStart(5)} (res ${r[i].r.resolutionCents.toFixed(0)})`);
  console.log(`${n.t.toFixed(3)}  ${noteName(n.midi).padEnd(4)} ${cells.join("   ")}`);
});
