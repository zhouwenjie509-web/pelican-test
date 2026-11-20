// Render each outro voice alone (or read an existing render with --no-render) and report its
// loudness, peak, sources alive and the pitch of every note it plays, against the plan.
//   node dev/audio/outro-measure.js han tang ...      (no ids: all twenty)
//   node dev/audio/outro-measure.js --no-render han
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { hz, noteName } from "../../audio/engine/theory.js";

globalThis.AudioBuffer ||= class {};
const { _outro } = await import("../../audio/parts/21-outro.js");
const args = process.argv.slice(2);
const noRender = args.includes("--no-render");
let ids = args.filter((a) => !a.startsWith("--"));
if (!ids.length) ids = _outro.VOICES.map((v) => v[0]);

function readWav(file) {
  const b = readFileSync(file);
  let p = 12;
  let fmt;
  while (p < b.length) {
    const id = b.toString("ascii", p, p + 4);
    const size = b.readUInt32LE(p + 4);
    if (id === "fmt ") fmt = { ch: b.readUInt16LE(p + 10), sr: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === "data") {
      const n = size / (fmt.ch * 3);
      const x = new Float64Array(n);
      for (let i = 0; i < n; i += 1) {
        let s = 0;
        for (let c = 0; c < fmt.ch; c += 1) s += b.readIntLE(p + 8 + (i * fmt.ch + c) * 3, 3) / 8388608;
        x[i] = s / fmt.ch;
      }
      return { x, sr: fmt.sr };
    }
    p += 8 + size + (size % 2);
  }
  throw new Error("no data");
}

/** |DTFT| of a Hann-windowed slice at frequency f. */
function mag(x, sr, i0, n, f) {
  let re = 0;
  let im = 0;
  const w = (2 * Math.PI * f) / sr;
  for (let i = 0; i < n; i += 1) {
    const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    const v = x[i0 + i] * h;
    re += v * Math.cos(w * i);
    im -= v * Math.sin(w * i);
  }
  return Math.hypot(re, im);
}

const T0 = 124; // the render starts one second before the outro
for (const id of ids) {
  let summary = "";
  if (!noRender) {
    let r;
    try {
      r = execFileSync("node", ["tools/audio.mjs", "--part", "outro", "--label", `voice:${id}\\b`, "--check"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (err) {
      r = String(err.stdout);
    }
    const lv = (r.match(/^Level\s+(-?[\d.]+)/m) || [])[1];
    const pk = (r.match(/peak (-?[\d.]+) dBFS/) || [])[1];
    const al = (r.match(/at most (\d+) alive/) || [])[1];
    summary = `LUFS ${lv} peak ${pk} alive ${al}`;
  }
  const { x, sr } = readWav(`out/audio/s21_voice-${id}-b.wav`);
  const notes = _outro.plan().filter((e) => e.id === id);
  const errs = [];
  let worst = 0;
  let octaveBad = 0;
  for (const e of notes) {
    const f = hz(e.midi);
    const a = e.u + 0.03;
    const len = Math.max(0.12, Math.min(e.dur, 0.35) - 0.03);
    const i0 = Math.round((1 + a) * sr);
    const n = Math.round(len * sr);
    let best = -1;
    let bc = 0;
    for (let c = -90; c <= 90; c += 3) {
      const m = mag(x, sr, i0, n, f * 2 ** (c / 1200));
      if (m > best) {
        best = m;
        bc = c;
      }
    }
    const below = mag(x, sr, i0, n, f / 2);
    if (below > best) octaveBad += 1;
    errs.push(bc);
    if (Math.abs(bc) > Math.abs(worst)) worst = bc;
  }
  errs.sort((p, q) => p - q);
  const med = errs[Math.floor(errs.length / 2)];
  const range = `${noteName(Math.min(...notes.map((e) => e.midi)))}-${noteName(Math.max(...notes.map((e) => e.midi)))}`;
  console.log(`${id.padEnd(11)} ${summary}  notes ${notes.length} ${range}  cents median ${med} worst ${worst}  octave-below-stronger ${octaveBad}`);
}
