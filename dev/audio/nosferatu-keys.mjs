// ruling 5: no piano key struck while its previous stroke still sounds; ruling 1: every buffer the lead asks for is prepared
import { Score } from "../../audio/engine/score.js";
import part, { _nosferatu as N } from "../../audio/parts/14-nosferatu.js";
const s = new Score({ id: "nosferatu", n: 14 }, 83, null);
part.score(s);
const piano = s.events.filter((e) => e.play.name === "piano");
const byKey = {};
for (const e of piano) (byKey[e.midi] ||= []).push(e);
let bad = 0, tightest = 9;
for (const [m, list] of Object.entries(byKey)) {
  list.sort((a, b) => a.u - b.u);
  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1], end = prev.u + prev.dur + (prev.damp || 0.09), gap = list[i].u - end;
    tightest = Math.min(tightest, gap);
    if (gap < -1e-9) { bad++; console.log(`key ${m}: struck at u ${list[i].u.toFixed(4)} while the stroke from ${prev.u.toFixed(4)} sounds to ${end.toFixed(4)}`); }
  }
}
console.log(`${piano.length} piano strokes, ${bad} restruck while sounding; smallest gap ${(tightest * 1000).toFixed(1)} ms`);
const missing = [...new Set(piano.map((e) => e.midi))].filter((m) => !N.USED.short.includes(m));
console.log("score pitches without a prepared short buffer:", missing.join(",") || "none");
// the lead: call it as the outro does, on a kit that records the buffer keys asked for
const asked = new Set();
const kit = { buffer: (key) => { asked.add(key); return { duration: key.endsWith("/2") ? 2 : 0.75 }; }, play: () => ({ out: { connect() {} } }) };
const major = [57, 59, 61, 62, 64, 66, 67, 69, 71, 73, 74];
for (const m of major) for (const dur of [0.1, 0.25, 0.5, 0.62, 0.7, 1.0, 1.5]) part.lead(kit, { out: {} }, 0, { midi: m, dur, vel: 0.8 });
const prepared = new Set([...N.USED.short.map((m) => `nosferatu/piano/${m}/0.75`), ...N.USED.long.map((m) => `nosferatu/piano/${m}/2`)]);
const notReady = [...asked].filter((k) => !prepared.has(k));
console.log(`lead asked for ${asked.size} buffers over D major A3-D5; not prepared: ${notReady.join(",") || "none"}`);
