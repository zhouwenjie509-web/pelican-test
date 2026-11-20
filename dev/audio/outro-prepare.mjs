// Times each section's prepare() and the outro's in Node (AudioBuffer stubbed), to see what the outro adds.
globalThis.AudioBuffer = class { constructor({ length, numberOfChannels, sampleRate }) { this.length = length; this.numberOfChannels = numberOfChannels; this.sampleRate = sampleRate; this.duration = length / sampleRate; } copyToChannel() {} };
const { PARTS } = await import("../../audio/soundtrack.js");
let total = 0;
for (const p of PARTS) {
  if (p.n < 1 || p.n > 21) continue;
  const mod = (await import(`../../audio/parts/${p.file}`)).default;
  if (!mod.prepare) continue;
  const t = performance.now();
  try { await mod.prepare({}); } catch (e) { console.log(p.id, "failed:", e.message); }
  const ms = performance.now() - t;
  total += ms;
  console.log(p.id.padEnd(11), ms.toFixed(0), "ms");
}
console.log("total", total.toFixed(0), "ms");
