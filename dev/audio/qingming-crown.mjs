// scratch: the crown buffer's pre-limit peak, and how far the tanh limit bends it, by window
const m = (await import("../../audio/parts/06-qingming.js")).default;
const [L] = m._crownSamples();
const pk = m._crownPreLimitPeak();
const lim = 0.37, knee = 0.27;
console.log("pre-limit peak", pk.toFixed(3), "limit", lim);
// reconstruct pre-limit L from post (atanh), measure error energy per window
const SR = 48000;
for (const [a, b] of [[0, 0.05], [0.05, 0.1], [0.1, 0.3], [0.3, 0.8]]) {
  let e = 0, s = 0;
  for (let i = Math.round(a * SR); i < Math.round(b * SR); i++) {
    const y = L[i];
    const ay = Math.abs(y); const x = ay <= knee ? y : Math.sign(y) * (knee + (lim - knee) * Math.atanh(Math.min(0.999999, (ay - knee) / (lim - knee))));
    e += (x - y) ** 2; s += y * y;
  }
  console.log(`${a}-${b}s  rms ${(10 * Math.log10(s / ((b - a) * SR))).toFixed(1)} dB  distortion ${(10 * Math.log10(e / s + 1e-12)).toFixed(1)} dB rel`);
}
