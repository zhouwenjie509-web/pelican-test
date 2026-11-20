// Scratch: floor (p95 of 5 ms RMS, 118.88-118.988) of s19.wav minus some label renders (all start at film 112).
import { readWav, toMono, dbfs } from "../../tools/lib/sound.mjs";
const [base, ...minus] = process.argv.slice(2);
const x = Float32Array.from(toMono(readWav(base).channels));
for (const f of minus) { const y = toMono(readWav(f).channels); for (let i = 0; i < x.length; i++) x[i] -= y[i]; }
const sr = 48000, a = Math.round(6.88 * sr), b = Math.round(6.988 * sr), win = 240, hop = 48, env = [];
for (let i = a; i + win <= b; i += hop) { let s = 0; for (let j = 0; j < win; j++) s += x[i + j] ** 2; env.push(Math.sqrt(s / win)); }
const srt = env.slice().sort((p, q) => p - q);
console.log(`minus [${minus.join(", ")}]: p95 ${dbfs(srt[Math.floor(srt.length * 0.95)]).toFixed(1)} dB; first 10 ms ${dbfs(env[0]).toFixed(1)}, at 5.94 ${dbfs(env[60]).toFixed(1)}, 5.96 ${dbfs(env[80]).toFixed(1)}`);
