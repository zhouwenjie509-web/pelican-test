// Scratch: level across a singer's note changes. node dev/audio/sahara-xf.mjs file.wav t1 t2 ... (film seconds)
// For each change t: held level of the old note (t-70..t-20 ms), of the new note (t+40..t+90 ms), and the lowest
// level of a 10 ms window sliding in 1 ms steps from t-15 to t+40 ms; dip = that lowest against the lower held level.
import fs from "node:fs";
import { readWav, toMono, dbfs } from "../../tools/lib/sound.mjs";

const [file, ...ts] = process.argv.slice(2);
const from = JSON.parse(fs.readFileSync(file.replace(/\.wav$/, ".json"), "utf8")).from;
const { sampleRate: sr, channels } = readWav(file);
const x = toMono(channels);
const rms = (a, b) => {
  const i0 = Math.round((a - from) * sr);
  const i1 = Math.round((b - from) * sr);
  let s = 0;
  for (let i = i0; i < i1; i += 1) s += x[i] * x[i];
  return Math.sqrt(s / (i1 - i0));
};
for (const tt of ts.map(Number)) {
  const old = dbfs(rms(tt - 0.07, tt - 0.02));
  const nu = dbfs(rms(tt + 0.04, tt + 0.09));
  let lo = Infinity;
  let at = 0;
  for (let d = -0.015; d <= 0.04; d += 0.001) {
    const v = dbfs(rms(tt + d, tt + d + 0.01));
    if (v < lo) [lo, at] = [v, d];
  }
  let hi = -Infinity;
  for (let d = -0.015; d <= 0.04; d += 0.001) hi = Math.max(hi, dbfs(rms(tt + d, tt + d + 0.01)));
  let hiHeld = -Infinity;
  for (let d = -0.1; d <= -0.025; d += 0.001) hiHeld = Math.max(hiHeld, dbfs(rms(tt + d, tt + d + 0.01)));
  for (let d = 0.045; d <= 0.1; d += 0.001) hiHeld = Math.max(hiHeld, dbfs(rms(tt + d, tt + d + 0.01)));
  console.log(`   bump: highest 10 ms in the hand-over ${hi.toFixed(1)}, highest while held ${hiHeld.toFixed(1)} -> ${(hi - hiHeld).toFixed(1)} dB`);
  let base = Infinity;
  for (let d = -0.1; d <= -0.025; d += 0.001) base = Math.min(base, dbfs(rms(tt + d, tt + d + 0.01)));
  let base2 = Infinity;
  for (let d = 0.045; d <= 0.1; d += 0.001) base2 = Math.min(base2, dbfs(rms(tt + d, tt + d + 0.01)));
  console.log(`   lowest 10 ms while held: old ${base.toFixed(1)}  new ${base2.toFixed(1)}  -> dip against those ${(Math.min(base, base2) - lo).toFixed(1)} dB`);
  console.log(`${tt.toFixed(3)}: old ${old.toFixed(1)}  new ${nu.toFixed(1)}  lowest 10 ms ${lo.toFixed(1)} at ${(at * 1000).toFixed(0)} ms  dip ${(Math.min(old, nu) - lo).toFixed(1)} dB`);
}
