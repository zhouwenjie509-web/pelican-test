// Render each chip channel of Section 16 alone (Node, no browser), as film-timed WAVs
// out/audio/pixel-<ch>.wav covering film 94-103 s, so audio-probe can look at one instrument.
import fs from "node:fs";
import { _pixel } from "../../audio/parts/16-pixel.js";
import { encodeWav } from "../../audio/engine/wav.js";
const SR = 48000, T0 = 94, U0 = 95;
const evs = _pixel.chipEvents();
const sel = process.argv[2] ? process.argv[2].split(",") : ["A", "B", "T", "N"];
for (const ch of sel) {
  const y = new Float32Array(9 * SR);
  for (const e of evs.filter((x) => x.ch === ch)) {
    const s = _pixel.render(e);
    const o = Math.round((U0 + e.u - T0) * SR);
    for (let i = 0; i < s.length; i += 1) y[o + i] += s[i];
  }
  let pk = 0, prev = 0, step = 0;
  for (const v of y) { pk = Math.max(pk, Math.abs(v)); step = Math.max(step, Math.abs(v - prev)); prev = v; }
  fs.mkdirSync("out/audio", { recursive: true });
  fs.writeFileSync(`out/audio/pixel-${ch}.wav`, Buffer.from(encodeWav([y], SR)));
  console.log(ch, "peak", pk.toFixed(3), "max step", step.toFixed(3));
}
