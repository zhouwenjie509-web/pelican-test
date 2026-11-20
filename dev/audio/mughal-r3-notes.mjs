// Per-note pitch readings of the six whisper notes, as the check reads them.
import { readWav, toMono, pitchNear, dbfs, bandpass } from "../../tools/lib/sound.mjs";
import { hz, noteName } from "../../audio/engine/theory.js";
import fs from "node:fs";
for (const f of process.argv.slice(2)) {
  const side = JSON.parse(fs.readFileSync(f.replace(/\.wav$/, ".json"), "utf8"));
  const { sampleRate: sr, channels } = readWav(f);
  const x = toMono(channels);
  console.log(f);
  for (const n of side.leads.filter((l) => l.t >= 50.9)) {
    const r0 = n.t - side.from;
    const r = pitchNear(x, sr, r0 + Math.min(0.04, n.dur * 0.25), r0 + Math.min(n.dur, 0.34), hz(n.midi));
    // time for the fundamental band to reach 90 % of its level at +150 ms (10 ms steps)
    const f0 = hz(n.midi);
    const seg = bandpass(x.subarray(Math.round((r0 - 0.1) * sr), Math.round((r0 + 0.25) * sr)), sr, f0 * 0.94, f0 * 1.06);
    const rms = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += seg[i] * seg[i]; return Math.sqrt(s / (b - a)); };
    const w = Math.round(0.01 * sr), base = Math.round(0.1 * sr);
    const ref = Math.max(...[0.08, 0.1, 0.12, 0.14].map((d) => rms(base + Math.round(d * sr), base + Math.round(d * sr) + w)));
    let reach = null;
    for (let d = 0; d < 0.15; d += 0.005) if (rms(base + Math.round(d * sr), base + Math.round(d * sr) + w) >= 0.9 * ref) { reach = d + 0.01; break; }
    console.log(`  ${noteName(n.midi).padEnd(4)} film ${n.t.toFixed(2)}  found ${r.hz.toFixed(1)} Hz  ${r.cents >= 0 ? "+" : ""}${r.cents.toFixed(1)} c (res ${r.resolutionCents.toFixed(1)})  strength ${r.strengthDb.toFixed(1)} dB  fundamental band at 90% of level by +${reach === null ? "n/a" : (reach * 1000).toFixed(0)} ms`);
  }
}
