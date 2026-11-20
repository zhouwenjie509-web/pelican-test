// Count the outro's sources over time in Node, with a Kit that only records start and stop times.
//   node dev/audio/outro-sources.js [labelRegex]
// Prints, every 0.25 s of film time, the sources sounding and the sources "alive" as the check
// counts them (sounding or starting within two seconds), and the maxima, with a breakdown by label.
globalThis.AudioBuffer = class {
  constructor({ length, numberOfChannels, sampleRate }) {
    this.length = length;
    this.numberOfChannels = numberOfChannels;
    this.sampleRate = sampleRate;
  }
  get duration() {
    return this.length / this.sampleRate;
  }
  copyToChannel() {}
  getChannelData() {
    return new Float32Array(this.length);
  }
};
const { loadSoundtrack } = await import("../../audio/soundtrack.js");
const { sharedBuffer } = await import("../../audio/engine/kit.js");

const re = process.argv[2] ? new RegExp(process.argv[2]) : null;
const spans = [];
let current = "";

const NOTHING = new Proxy(function nothing() {}, {
  get: (t, p) => (p === "then" ? undefined : p === Symbol.toPrimitive ? () => 0 : p === "value" ? 0 : NOTHING),
  set: () => true,
  apply: () => NOTHING,
  construct: () => NOTHING,
});
function source() {
  const s = { label: current, start: null, stop: Infinity };
  return new Proxy(
    {},
    {
      get: (t, p) => {
        if (p === "start") return (when) => { s.start = when; spans.push(s); };
        if (p === "stop") return (when) => { s.stop = when === undefined ? 0 : when; };
        if (p === "then") return undefined;
        if (p === "addEventListener") return () => {};
        return NOTHING;
      },
      set: () => true,
    },
  );
}
const ac = new Proxy({}, { get: (t, p) => (p === "sampleRate" ? 48000 : p === "currentTime" ? 0 : p === "then" ? undefined : p === "createOscillator" || p === "createBufferSource" || p === "createConstantSource" ? source : () => NOTHING) });
const play = (buf, when, o = {}) => {
  const s = { label: current, start: Math.max(0, when), stop: Infinity };
  const rate = o.rate || 1;
  if (o.dur !== undefined) s.stop = s.start + o.dur / rate;
  else if (!o.loop) s.stop = s.start + buf.duration / rate;
  spans.push(s);
  return { src: NOTHING, out: NOTHING, gain: NOTHING };
};
const rec = (when, stop) => {
  spans.push({ label: current, start: Math.max(0, when), stop: stop === undefined ? Infinity : stop });
  return NOTHING;
};
const k = new Proxy(
  {},
  {
    get: (t, p) => {
      if (p === "ac") return ac;
      if (p === "sr") return 48000;
      if (p === "buffer") return (key, make) => sharedBuffer(key, make);
      if (p === "play") return play;
      if (p === "osc" || p === "lfo") return (a, b, when, stop) => rec(when, stop);
      if (p === "noise") return (c, when, stop) => rec(when, stop);
      if (p === "constant") return (v, when, stop) => rec(when, stop);
      if (p === "track") return (n) => n;
      if (p === "then") return undefined;
      return () => NOTHING;
    },
  },
);
const g = new Proxy({}, { get: (t, p) => (p === "then" ? undefined : p === "voices" || p === "strings" || p === "nodes" ? new Proxy({}, { get: () => NOTHING }) : NOTHING) });

const track = await loadSoundtrack({ only: ["outro"], prepare: false });
for (const ev of track.events) {
  current = ev.label || ev.play.name || "?";
  if (re && !re.test(current)) continue;
  ev.play(k, g, ev.t, ev);
}
let maxS = [0, 0];
let maxA = [0, 0];
for (let t = 125; t <= 137; t += 0.05) {
  const s = spans.filter((x) => x.start <= t && x.stop > t).length;
  const a = spans.filter((x) => x.start - 2 <= t && x.stop > t).length;
  if (s > maxS[0]) maxS = [s, t];
  if (a > maxA[0]) maxA = [a, t];
  if (Math.abs((t * 4) % 1) < 0.01 || Math.abs((t * 4) % 1) > 0.99) console.log(t.toFixed(2), "sounding", s, "alive", a);
}
console.log("sources", spans.length, "max sounding", maxS[0], "at", maxS[1].toFixed(2), " max alive", maxA[0], "at", maxA[1].toFixed(2));
const at = maxS[1];
const by = {};
for (const x of spans) if (x.start <= at && x.stop > at) by[x.label] = (by[x.label] || 0) + 1;
console.log("at max sounding:", Object.entries(by).sort((p, q) => q[1] - p[1]).map(([l, n]) => `${l} ${n}`).join(", "));
const atA = maxA[1];
const byA = {};
for (const x of spans) if (x.start - 2 <= atA && x.stop > atA) byA[x.label] = (byA[x.label] || 0) + 1;
console.log("at max alive:", Object.entries(byA).sort((p, q) => q[1] - p[1]).map(([l, n]) => `${l} ${n}`).join(", "));
