// Scratch: the peak (dBFS) of a render (film 16.0 at sample 0) in the 0.3 s after each dab.
import fs from "node:fs";
const b = fs.readFileSync(process.argv[2]); let p = 12, data;
while (p < b.length) { const id = b.toString("ascii", p, p + 4), len = b.readUInt32LE(p + 4); if (id === "data") { data = b.subarray(p + 8, p + 8 + len); break; } p += 8 + len; }
const out = [];
for (const t of [17.0, 19.0, 19.5, 20.0, 20.5]) {
  let m = 0; const a = Math.round((t - 16) * 48000);
  for (let i = a; i < a + 0.3 * 48000; i += 1) for (let c = 0; c < 2; c += 1) m = Math.max(m, Math.abs(data.readIntLE((i * 2 + c) * 3, 3) / 8388608));
  out.push(`${t}:${(20 * Math.log10(m)).toFixed(2)}`);
}
console.log(out.join(" "));
