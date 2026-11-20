import path from "node:path";
import { readWav, toMono, bandpass } from "../../tools/lib/sound.mjs";
const [file, t0, t1, lo, hi, step = "0.005"] = process.argv.slice(2);
const { sampleRate: sr, channels } = readWav(path.resolve(file));
const x = toMono(channels);
const from = 4.0;
const a = Math.round((Number(t0) - from) * sr), b = Math.round((Number(t1) - from) * sr);
const seg = bandpass(x.subarray(a - 4800, b), sr, Number(lo), Number(hi)).subarray(4800);
const hop = Math.round(Number(step) * sr), out = [];
for (let i = 0; i + hop <= seg.length; i += hop) { let s = 0; for (let j = 0; j < hop; j++) s += seg[i + j] ** 2; out.push(`${(Number(t0) + i / sr).toFixed(3)} ${(10 * Math.log10(s / hop + 1e-20)).toFixed(0)}`); }
console.log(out.join("\n"));
