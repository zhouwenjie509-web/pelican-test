import { readWav } from "../../tools/lib/sound.mjs";
const file = process.argv[2] || "out/audio/s10.wav";
const from = Number(process.argv[3] || 58);
const { sampleRate: sr, channels } = readWav(file);
const win = Math.round(Number(process.env.WIN || 0.05) * sr);
const rows = [];
for (let s = 0; s < channels[0].length; s += win) {
  let m = 0;
  for (const c of channels) for (let i = s; i < Math.min(s + win, c.length); i++) m = Math.max(m, Math.abs(c[i]));
  rows.push([from + s / sr, 20 * Math.log10(m || 1e-9)]);
}
rows.sort((a, b) => b[1] - a[1]);
for (const [t, d] of rows.slice(0, 8)) console.log(t.toFixed(2), d.toFixed(1));
