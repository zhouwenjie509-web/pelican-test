// scratch: gong body (crown stem, 100-600 Hz) against the dizi stem (whole band), u 3.3-3.8, in 100 ms steps
import { readWav, toMono, bandpass } from "../../tools/lib/sound.mjs";
const t0 = 34, sr = 48000;
const g = bandpass(toMono(readWav("out/audio/s06_-crown.wav").channels), sr, 100, 600);
const d = toMono(readWav("out/audio/s06_-dizi.wav").channels);
const rms = (x, a, b) => { let s = 0; for (let i = Math.round((a - t0) * sr); i < Math.round((b - t0) * sr); i++) s += x[i] * x[i]; return 10 * Math.log10(s / ((b - a) * sr)); };
const row = [];
for (let a = 38.3; a < 38.79; a += 0.1) row.push(`${(a - 35).toFixed(1)}: ${(rms(g, a, a + 0.1) - rms(d, a, a + 0.1)).toFixed(1)}`);
console.log("gong-body minus flute, dB, per 100 ms:", row.join("  "));
console.log(`whole 0.3-0.8: gong ${rms(g, 38.3, 38.8).toFixed(1)}  flute ${rms(d, 38.3, 38.8).toFixed(1)}  diff ${(rms(g, 38.3, 38.8) - rms(d, 38.3, 38.8)).toFixed(1)}`);
