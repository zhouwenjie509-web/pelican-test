// crest of the gong buffer: onset peak against body rms (0.2-1.2 s), for variants (copy of gongSamples)
import { SR, samples, white, onePole, envelope, fade, mixInto, normalize, modal } from "../../audio/engine/dsp.js";
import { hz } from "../../audio/engine/theory.js";
function gong(m, { seconds, t60, beat, pair, octave, upper, thump, attack, seed, ph = (i) => 1.3 * i, p0 = [0.7, 0.3] }) {
  const f = hz(m);
  const parts = [{ f, a: 1, t60 }, { f: f + beat, a: pair, t60: t60 * 0.95, phase: p0[0] }, { f: f * 2.004, a: octave, t60: t60 * 0.6, phase: p0[1] },
    ...upper.map(([r, a, t], i) => ({ f: f * r, a, t60: t60 * t, phase: ph(i) }))];
  const y = modal(parts, seconds, { attack });
  if (thump > 0) { const th = onePole(onePole(white(samples(0.08), 700 + seed), Math.min(900, f * 4)), Math.min(900, f * 4)); envelope(th, [[0, 0], [0.002, 1], [0.02, 0.3], [0.08, 0]]); mixInto(y, th, 0, thump * 4); }
  return normalize(fade(onePole(y, 28, "highpass"), attack, 0.05), 0.9);
}
const base = { seconds: 4.6, t60: 3.0, beat: 1.6, pair: 0.6, octave: 0.45, upper: [[2.3, 0.5, 0.65], [2.92, 0.42, 0.6], [3.7, 0.36, 0.55], [4.8, 0.36, 0.5]], thump: 0.06, attack: 0.006, seed: 8 };
const V = { now: {}, att15: { attack: 0.015 }, att25: { attack: 0.025 },
  ph: { ph: (i) => [2.1, 4.4, 0.9, 3.3][i], p0: [2.6, 5.0] }, ph_att15: { ph: (i) => [2.1, 4.4, 0.9, 3.3][i], p0: [2.6, 5.0], attack: 0.015 },
  ph2_att15: { ph: (i) => [3.6, 1.2, 5.1, 2.4][i], p0: [3.14, 1.6], attack: 0.015 }, ph2_att25: { ph: (i) => [3.6, 1.2, 5.1, 2.4][i], p0: [3.14, 1.6], attack: 0.025 } };
for (const [n, v] of Object.entries(V)) {
  const y = gong(38, { ...base, ...v });
  let pk = 0, pt = 0; for (let i = 0; i < y.length; i++) if (Math.abs(y[i]) > pk) { pk = Math.abs(y[i]); pt = i; }
  let on = 0; for (let i = 0; i < 0.1 * SR; i++) on = Math.max(on, Math.abs(y[i]));
  let s = 0; for (let i = 0.2 * SR; i < 1.2 * SR; i++) s += y[i] * y[i];
  const rms = Math.sqrt(s / SR);
  console.log(n.padEnd(10), `max ${pk.toFixed(3)} @${(pt / SR).toFixed(3)}s  onset(<0.1s) ${on.toFixed(3)}  body rms ${rms.toFixed(3)}  onset/body ${(20 * Math.log10(on / rms)).toFixed(1)} dB`);
}
