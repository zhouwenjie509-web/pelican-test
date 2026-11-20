// Section 16: does the outro's use of `lead` find its buffers ready, and is the fitted note the same sound?
// A fake Kit records k.buffer misses and k.play options; no Web Audio.
import { _pixel } from "../../audio/parts/16-pixel.js";
import part from "../../audio/parts/16-pixel.js";
import { _outro } from "../../audio/parts/21-outro.js";

const made = new Map();
let misses = [];
let plays = [];
// Kit.buffer goes through kit.js sharedBuffer; that needs AudioBuffer, so stand in for both
const kit = {
  buffer(key, make) {
    if (!made.has(key)) {
      misses.push(key);
      made.set(key, make());
    }
    return { key, data: made.get(key) };
  },
  play(buf, when, opts) {
    plays.push({ key: buf.key, len: buf.data.length / 48000, opts });
  },
};
// prepare() fills the shared cache with the same keys: emulate by asking prepare's keys through our kit
const t0 = performance.now();
const LEAD_KEYS = [];
for (const m of [69, 71, 73, 74, 76, 78, 79, 81, 83, 85, 86]) for (const d of [0.25, 0.5, 1.0]) LEAD_KEYS.push([m, d]);
for (const [m, d] of LEAD_KEYS) part.lead(kit, { out: null }, 0, { midi: m, dur: d, vel: 1 });
console.log(`prepared ${made.size} lead buffers in ${(performance.now() - t0).toFixed(1)} ms`);
misses = [];
plays = [];

const evs = _outro.plan().filter((e) => e.id === "pixel");
let worst = 0;
for (const e of evs) {
  const a = performance.now();
  part.lead(kit, { out: null }, 0, _outro.leadEvent("pixel", e));
  worst = Math.max(worst, performance.now() - a);
}
console.log(`outro pixel notes: ${evs.length}, buffers made at play time: ${misses.length}${misses.length ? " " + misses.join(" ") : ""}, slowest call ${worst.toFixed(3)} ms`);
const durs = [...new Set(evs.map((e) => e.dur.toFixed(3)))].join(" ");
const mids = [...new Set(evs.map((e) => e.midi))].join(" ");
console.log(`outro durs ${durs}; midis ${mids}`);
for (const p of plays.slice(0, 4)) console.log(`  ${p.key} buffer ${p.len.toFixed(4)} s, play ${JSON.stringify(p.opts)}`);

// same sound: old on-demand render at the exact len vs the prepared longer buffer, over the first len - 2 ms
const FRAME = 1 / 60;
let maxDiff = 0;
for (const m of [74, 81, 83]) {
  for (const dur of [0.23, 0.48, 0.98]) {
    const len = Math.max(0.06, dur - 2 * FRAME);
    const fit = [0.25, 0.5, 1.0].map((d) => d - 2 * FRAME).find((l) => l >= len);
    const tone = (L) => ({ ch: "A", kind: "tone", u: 0, len: L, midi: m, duty: 0.25, vol: 13, sus: 10, decay: 3 });
    const exact = _pixel.render(tone(len));
    const long = _pixel.render(tone(fit));
    const n = exact.length - 96 * 2; // leave out both ends' fades
    for (let i = 96; i < n; i += 1) maxDiff = Math.max(maxDiff, Math.abs(exact[i] - long[i]));
  }
}
console.log(`largest sample difference, old exact-length render vs prepared buffer (fades excluded): ${maxDiff.toExponential(2)}`);
