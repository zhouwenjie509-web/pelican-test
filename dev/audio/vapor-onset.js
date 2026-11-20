// Scratch (vapor): replay the checker's onset measurement around a moment and show why it decides.
import { readWav, toMono, bandpass, dbfs } from "../../tools/lib/sound.mjs";
const [file, from, lo, hi, ...ts] = process.argv.slice(2);
const { sampleRate: sr, channels } = readWav(file);
const x = toMono(channels);
for (const tt of ts.map(Number)) {
  const t = tt - Number(from);
  const a = Math.round((t - 0.12) * sr);
  const seg = bandpass(x.subarray(a, Math.round((t + 0.2) * sr)), sr, Number(lo), Number(hi));
  const hop = 48, win = 96, env = [];
  for (let i = 0; i + win <= seg.length; i += hop) { let s = 0; for (let j = 0; j < win; j++) s += seg[i + j] ** 2; env.push(Math.sqrt(s / win)); }
  const pre = env.slice(0, 90).sort((p, q) => p - q);
  const floor = pre[45];
  const peak = Math.max(...env.slice(90));
  const thr = floor + 0.25 * (peak - floor);
  const row = [];
  for (let i = 85; i < 135; i++) row.push(`${i - 120}:${(dbfs(env[i]) - dbfs(thr)).toFixed(0)}`);
  console.log(`${tt}: floor ${dbfs(floor).toFixed(1)} peak ${dbfs(peak).toFixed(1)} thr ${dbfs(thr).toFixed(1)}\n  ${row.join(" ")}`);
}
