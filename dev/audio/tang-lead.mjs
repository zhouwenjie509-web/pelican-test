// Scratch: call the lead export against a mock Kit to see what it schedules (no Web Audio in Node).
import part from "../../audio/parts/04-tang.js";
const plays = [];
const k = { buffer: (key) => ({ key }), play: (b, when, o) => (plays.push([b.key, when.toFixed(4), o.dur && o.dur.toFixed(3), o.gain.toFixed(3)]), { src: { playbackRate: {} }, out: { connect() {} } }), env() {} };
const g = { out: {}, send: { } };
for (const [m, d] of [[69, 0.25], [64, 1.0], [83, 0.5]]) { plays.length = 0; part.lead(k, g, 10, { midi: m, dur: d, vel: 0.8 }); console.log(m, d, plays.length, "strokes", JSON.stringify(plays.slice(0, 2)), "...", JSON.stringify(plays.at(-1))); }
