import path from "node:path";
import { readWav, toMono, bandpass } from "../../tools/lib/sound.mjs";
const [file, at, lo, hi] = process.argv.slice(2);
const { sampleRate: sr, channels } = readWav(path.resolve(file));
const x = toMono(channels);
const from = 4.0;
const a = Math.round((Number(at) - 0.12 - from) * sr), b = Math.round((Number(at) + 0.06 - from) * sr);
const seg = lo ? bandpass(x.subarray(a, b), sr, Number(lo), Number(hi)) : x.subarray(a, b);
const out = [];
for (let i = 0; i + 96 <= seg.length; i += 240) { let s = 0; for (let j = 0; j < 96; j++) s += seg[i + j] ** 2; out.push(`${(Number(at) - 0.12 + i / sr).toFixed(3)} ${(10 * Math.log10(s / 96 + 1e-20)).toFixed(1)}`); }
console.log(out.join("\n"));
