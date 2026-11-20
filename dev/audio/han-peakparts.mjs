// Scratch: the value of each label render at the mix's largest samples. usage: node han-peakparts.mjs mix.wav a.wav b.wav ...
import fs from "node:fs";
function readWav(file) {
  const b = fs.readFileSync(file); let p = 12, data;
  while (p < b.length) { const id = b.toString("ascii", p, p + 4), len = b.readUInt32LE(p + 4); if (id === "data") { data = b.subarray(p + 8, p + 8 + len); break; } p += 8 + len; }
  const n = data.length / 6, o = [new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i += 1) for (let c = 0; c < 2; c += 1) o[c][i] = data.readIntLE((i * 2 + c) * 3, 3) / 8388608;
  return o;
}
const [mixF, ...rest] = process.argv.slice(2);
const mix = readWav(mixF), parts = rest.map(readWav);
const cand = [];
for (let c = 0; c < 2; c += 1) for (let i = 0; i < mix[c].length; i += 1) cand.push([Math.abs(mix[c][i]), c, i]);
cand.sort((a, b) => b[0] - a[0]);
const seen = [];
for (const [v, c, i] of cand) {
  if (seen.some((s) => Math.abs(s - i) < 2400)) continue; seen.push(i);
  console.log(`${(16 + i / 48000).toFixed(4)} ch${c} ${(20 * Math.log10(v)).toFixed(2)} dBFS  ` + rest.map((f, k) => `${f.split("/").pop().replace(/\.wav$/, "")} ${parts[k][c][i].toFixed(3)}`).join("  ") + `  mix ${mix[c][i].toFixed(3)}`);
  if (seen.length >= 6) break;
}
