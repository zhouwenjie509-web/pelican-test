// usage: node dev/audio/nosferatu-band.mjs file.wav from to [lo:hi] [minus.wav]   (film seconds; files start at film 82)
import fs from "node:fs";
import { biquad } from "../../audio/engine/dsp.js";
function read(p) {
  const b = fs.readFileSync(p); const nCh = b.readUInt16LE(22); const sr = b.readUInt32LE(24);
  let at = 12; while (b.toString("ascii", at, at + 4) !== "data") at += 8 + b.readUInt32LE(at + 4);
  const n = b.readUInt32LE(at + 4) / (3 * nCh); at += 8;
  const ch = Array.from({ length: nCh }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < nCh; c++) { let s = b[at] | (b[at+1] << 8) | (b[at+2] << 16); if (s & 0x800000) s -= 0x1000000; ch[c][i] = s / 8388607; at += 3; }
  const j = JSON.parse(fs.readFileSync(p.replace(/\.wav$/, ".json"), "utf8"));
  return { ch, sr, from: j.from };
}
const [file, a, z, band, minus] = process.argv.slice(2);
const A = read(file); let ch = A.ch;
if (minus) { const B = read(minus); const off = Math.round((B.from - A.from) * A.sr); ch = ch.map((x, c) => x.map((v, i) => v - (B.ch[c][i - off] || 0))); }
let mono = ch[0].map((v, i) => 0.5 * (v + ch[1][i]));
if (band) { const [lo, hi] = band.split(":").map(Number); for (let k = 0; k < 2; k++) { mono = biquad(mono, "highpass", lo, 0.7071); mono = biquad(mono, "lowpass", hi, 0.7071); } }
const i0 = Math.round((+a - A.from) * A.sr), i1 = Math.round((+z - A.from) * A.sr);
let s = 0, pk = 0; for (let i = i0; i < i1; i++) { s += mono[i] ** 2; pk = Math.max(pk, Math.abs(mono[i])); }
console.log(`${file}${minus ? " - " + minus : ""} ${a}-${z} ${band || "full"}: rms ${(10 * Math.log10(s / (i1 - i0))).toFixed(1)} dBFS, peak ${(20 * Math.log10(pk)).toFixed(1)}`);
