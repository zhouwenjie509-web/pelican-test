// in 1-2 kHz, every 10 ms: the projector alone against the rest of the part (mix minus projector)
import { readWav, toMono } from "../../tools/lib/sound.mjs";
import { biquad } from "../../audio/engine/dsp.js";
const m = toMono(readWav("out/audio/s14.wav").channels), p = toMono(readWav("out/audio/nosf-projector.wav").channels);
const band = (x) => { for (let k = 0; k < 2; k++) { x = biquad(x, "highpass", 1000); x = biquad(x, "lowpass", 2000); } return x; };
const r = band(m.map((v, i) => v - p[i])), q = band(p);
const W = 480; let over = 0, n = 0, worst = -99, at = 0;
for (let i = 48000; i < 7 * 48000; i += W) { let a = 0, b = 0; for (let j = i; j < i + W; j++) { a += q[j] ** 2; b += r[j] ** 2; } const d = 10 * Math.log10(a / b); n++; if (d > 0) over++; if (d > worst) { worst = d; at = 82 + i / 48000; } }
console.log(`projector above the rest in 1-2 kHz in ${over} of ${n} 10-ms windows; worst ${worst.toFixed(1)} dB at film ${at.toFixed(2)}`);
