// Scratch: the peak of the bass D2 PeriodicWave with and without the thinned 2nd harmonic.
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const fam = { body: [[62, 0.6, 0.6], [110, 0.9, 0.7], [230, 0.6, 0.8]], beta: 0.12, roll: 1600 };
function harm(f, thin) {
  const top = Math.max(2, Math.min(48, Math.floor(4400 / f)));
  const s = new Float64Array(top + 1);
  for (let n = 1; n <= top; n++) {
    const fn = n * f;
    let a = Math.abs(Math.sin(Math.PI * n * fam.beta)) / (n * Math.sin(Math.PI * fam.beta));
    let body = 0.35;
    for (const [fc, g, w] of fam.body) { const o = Math.log2(fn / fc) / w; body += g * Math.exp(-o * o); }
    a *= body; a /= 1 + (fn / fam.roll) ** 4; a *= fn / Math.sqrt(fn * fn + 45 * 45);
    if (thin[n] !== undefined) a *= thin[n];
    s[n] = a;
  }
  return s;
}
function pk(s) { let m = 0; const N = 8192; for (let i = 0; i < N; i++) { let v = 0; for (let n = 1; n < s.length; n++) v += s[n] * Math.sin(2 * Math.PI * n * i / N); m = Math.max(m, Math.abs(v)); } return m; }
const f = hz(38);
for (const t of [1, 0.15, 0.1, 0.05]) { const p0 = pk(harm(f, {})), p1 = pk(harm(f, { 2: t })); console.log(t, p0.toFixed(4), p1.toFixed(4), (20 * Math.log10(p0 / p1)).toFixed(2) + " dB", (p1 / p0).toFixed(3)); }
