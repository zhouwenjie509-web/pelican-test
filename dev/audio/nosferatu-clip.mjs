import { readWav } from "../../tools/lib/sound.mjs";
const w = readWav("out/audio/nosf-organ.wav"); const sr = 48000;
const ch = w.channels || w.ch || w; 
const x = (Array.isArray(ch) ? ch : ch.channels)[0];
const i0 = 4.05 * sr, i1 = 4.95 * sr; // file starts at 82
for (const gainDb of [3.5, 4.2]) for (const knee of [0.25, 0.3, 0.35]) {
  const g = 10 ** (gainDb / 20); const lim = 10 ** (-6.4 / 20);
  // soft knee: linear below knee, tanh above, asymptote lim
  const f = (v) => { const a = Math.abs(v); if (a <= knee) return v; const r = lim - knee; return Math.sign(v) * (knee + r * Math.tanh((a - knee) / r)); };
  let e = 0, s = 0, pk = 0, n = 0, aff = 0;
  for (let i = i0; i < i1; i++) { const v = x[i] * g; const y = f(v); e += (y - v) ** 2; s += v * v; pk = Math.max(pk, Math.abs(y)); if (Math.abs(v) > knee) aff++; n++; }
  console.log(`gain +${gainDb} knee ${knee}: residual ${(10*Math.log10(e/s)).toFixed(1)} dB re organ, peak ${(20*Math.log10(pk)).toFixed(1)}, ${(100*aff/n).toFixed(2)} % of samples above knee, organ rms ${(10*Math.log10(s/n)).toFixed(1)}`);
}
