// Scratch: the peak of (all label renders + bike) with the u = 0 great bell shifted later and rescaled.
// usage (in out/audio): node ../../dev/audio/han-r2-sweep.mjs  (renders made at great-bell vel 0.7)
import fs from "node:fs";
function readWav(file) {
  const b = fs.readFileSync(file); let p = 12, data;
  while (p < b.length) { const id = b.toString("ascii", p, p + 4), len = b.readUInt32LE(p + 4); if (id === "data") { data = b.subarray(p + 8, p + 8 + len); break; } p += 8 + len; }
  const n = data.length / 6, o = [new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i += 1) for (let c = 0; c < 2; c += 1) o[c][i] = data.readIntLE((i * 2 + c) * 3, 3) / 8388608;
  return o;
}
const rest = ["bike", "chime_bell", "stone_chime", "drum", "hooves", "pad"].map((l) => readWav(`han-r2-${l}.wav`));
const gb = readWav("han-r2-great_bell.wav");
const SR = 48000, t0 = 16;
const i0 = (17 - t0) * SR, i1 = (17.6 - t0) * SR; // only the downbeat bell is in this window (next great bell at 19.0)
for (const vel of [0.85, 0.7]) {
  const row = [];
  for (let ms = Number(process.argv[2] ?? 0); ms <= Number(process.argv[3] ?? 20); ms += Number(process.argv[4] ?? 1)) {
    const d = Math.round((ms / 1000) * SR);
    let pk = 0;
    for (let c = 0; c < 2; c += 1) for (let i = i0; i < i1; i += 1) {
      let v = (gb[c][i - d] || 0) * (vel / 0.7);
      for (const r of rest) v += r[c][i];
      pk = Math.max(pk, Math.abs(v));
    }
    row.push(`${ms.toFixed(2)}:${(20 * Math.log10(pk)).toFixed(2)}`);
  }
  console.log(`vel ${vel}  ` + row.join(" "));
}
