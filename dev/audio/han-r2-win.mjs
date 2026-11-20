// Scratch: peak (dBFS) of a WAV within film windows. usage: node han-r2-win.mjs file.wav t0file a:b c:d ...
import fs from "node:fs";
const [f, t0s, ...wins] = process.argv.slice(2);
const b = fs.readFileSync(f); let p = 12, data;
while (p < b.length) { const id = b.toString("ascii", p, p + 4), len = b.readUInt32LE(p + 4); if (id === "data") { data = b.subarray(p + 8, p + 8 + len); break; } p += 8 + len; }
const n = data.length / 6, t0 = Number(t0s);
for (const w of wins) {
  const [a, z] = w.split(":").map(Number); let pk = 0, at = 0;
  for (let i = Math.max(0, Math.round((a - t0) * 48000)); i < Math.min(n, Math.round((z - t0) * 48000)); i += 1)
    for (let c = 0; c < 2; c += 1) { const v = Math.abs(data.readIntLE((i * 2 + c) * 3, 3) / 8388608); if (v > pk) { pk = v; at = t0 + i / 48000; } }
  console.log(`${w}  ${(20 * Math.log10(pk)).toFixed(2)} dBFS at ${at.toFixed(4)}`);
}
