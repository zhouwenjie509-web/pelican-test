// Scratch: the loudest moments of a rendered WAV (peak per 50 ms, top 8).
import { readWav } from "../../tools/lib/sound.mjs";
import fs from "node:fs";
const file = process.argv[2] || "out/audio/s03.wav";
const w = readWav(file);
const start = Number(process.argv[3] || 16);
const chans = w.channels || w.data || [w.samples];
const sr = w.sampleRate || w.sr || 48000;
const n = chans[0].length, hop = Math.round(sr * 0.05);
const rows = [];
for (let a = 0; a < n; a += hop) {
  let m = 0;
  for (const c of chans) for (let i = a; i < Math.min(n, a + hop); i++) m = Math.max(m, Math.abs(c[i]));
  rows.push([start + a / sr, 20 * Math.log10(m + 1e-12)]);
}
rows.sort((p, q) => q[1] - p[1]);
console.log(rows.slice(0, 8).map(([t, d]) => `${t.toFixed(2)}s ${d.toFixed(1)}dB`).join("  "));
