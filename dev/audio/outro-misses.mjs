// After every part's prepare() (as the film does it), play every outro event on a stub Kit whose
// buffer() records any buffer that had to be made at play time (a cache miss). Nothing sounds.
globalThis.AudioBuffer = class { constructor({ length, numberOfChannels, sampleRate }) { this.length = length; this.numberOfChannels = numberOfChannels; this.sampleRate = sampleRate; this.duration = length / sampleRate; } copyToChannel() {} };
const { loadSoundtrack } = await import("../../audio/soundtrack.js");
const { sharedBuffer } = await import("../../audio/engine/kit.js");
const track = await loadSoundtrack({ only: ["outro"], prepare: true });
const NOTHING = new Proxy(function nothing() {}, {
  get: (t, p) => (p === "then" ? undefined : p === Symbol.toPrimitive ? () => 0 : NOTHING),
  apply: () => NOTHING,
  construct: () => NOTHING,
});
const misses = new Map();
const kit = new Proxy({}, {
  get: (t, p) => (p === "buffer" ? (key, make) => sharedBuffer(key, () => { misses.set(key, (misses.get(key) || 0) + 1); return make(); }) : p === "sr" ? 48000 : p === "then" ? undefined : NOTHING),
});
const evs = track.events.filter((e) => e.part && e.part.id === "outro");
let errors = 0;
let slow = 0;
for (const ev of evs) {
  const t = performance.now();
  try { ev.play(kit, NOTHING, 0, ev); } catch (e) { errors += 1; console.log("error", ev.label, e.message); }
  if (performance.now() - t > 1) slow += 1;
}
console.log(`${evs.length} outro events played on a stub Kit: ${misses.size} buffer misses, ${errors} errors, ${slow} calls over 1 ms`);
for (const [k, n] of misses) console.log("  miss", k, n);
