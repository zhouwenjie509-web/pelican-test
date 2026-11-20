// Scratch: rms (dBFS, both channels) of label renders in the 0.4 s after each dab, and in bands.
// usage: node dev/audio/han-dabs.mjs out/audio/A.wav out/audio/B.wav  (file starts at film 16.0)
import fs from "node:fs";

function readWav(file) {
  const b = fs.readFileSync(file);
  let p = 12, ch = 2, bits = 24, data = null;
  while (p < b.length) {
    const id = b.toString("ascii", p, p + 4), len = b.readUInt32LE(p + 4);
    if (id === "fmt ") { ch = b.readUInt16LE(p + 10); bits = b.readUInt16LE(p + 22); }
    if (id === "data") { data = b.subarray(p + 8, p + 8 + len); break; }
    p += 8 + len;
  }
  const bps = bits / 8, n = data.length / bps / ch;
  const out = [new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i += 1) for (let c = 0; c < ch; c += 1) {
    const o = (i * ch + c) * bps;
    out[c][i] = bits === 24 ? data.readIntLE(o, 3) / 8388608 : data.readInt16LE(o) / 32768;
  }
  return out;
}
const db = (x) => (10 * Math.log10(x + 1e-20)).toFixed(1);
function rms(w, t, len) {
  const a = Math.round((t - 16) * 48000), n = Math.round(len * 48000);
  let s = 0;
  for (const c of w) for (let i = a; i < a + n; i += 1) s += c[i] * c[i];
  return s / (n * w.length);
}
const files = process.argv.slice(2).map((f) => [f, readWav(f)]);
for (const t of [19.0, 19.5, 20.0, 20.5]) {
  const vals = files.map(([, w]) => rms(w, t, 0.4));
  console.log(`${t.toFixed(1)}  ` + files.map(([f], i) => `${f.split("/").pop()} ${db(vals[i])}`).join("   ") + (vals.length === 2 ? `   diff ${(10 * Math.log10(vals[0] / vals[1])).toFixed(1)} dB` : ""));
}
