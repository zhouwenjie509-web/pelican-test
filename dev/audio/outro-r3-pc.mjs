// Ruling 1 (third round): for each of the sixteen notes of the first statement (125.0-131.0), the energy of
// each pitch class over octaves 3 to 6 (fundamentals C3 130.8 Hz to B6 1976 Hz), in a window from 30 ms after
// the note's beat to 180 ms (to 130 ms for the notes on a half beat), and whether the tune's pitch class
// is the strongest, by how many dB over the next.
//
//   node dev/audio/outro-r3-pc.mjs <wav> [film t0 of file, default 124] [ridge, default 0.05]
//
// Two spectra, so that one method's weakness does not decide alone:
//   LS   a joint least-squares fit (Hann-weighted) of a sine and cosine at every equal-tempered semitone
//        from C2 to E7 over the window: neighbouring semitones are separated exactly (D3 and C#3, 8 Hz
//        apart, are resolved although a 100-150 ms window's own bin is 7-10 Hz), and leakage from the
//        bass and the drum below C3 is absorbed by the octave-2 terms. Energy of a semitone = a^2 + b^2.
//   DFT  a plain Hann spectrum, zero-padded to 0.5 Hz, power summed over each semitone's band (+-50 cents).
//        Its resolution in octave 3 is coarser than a semitone (main lobe +-13 to +-20 Hz), so it is
//        shown for comparison only.
// The pitch class energy is the sum over octaves 3-6 (MIDI 48-95) of its semitones' energies.
import { readFileSync } from "node:fs";

const [file, t0Arg, ridgeArg] = process.argv.slice(2);
const RIDGE = Number(ridgeArg || 0.05);
const T0 = Number(t0Arg || 124);
const b = readFileSync(file);
let p = 12;
let fmt;
let x;
let sr;
while (p < b.length) {
  const id = b.toString("ascii", p, p + 4);
  const size = b.readUInt32LE(p + 4);
  if (id === "fmt ") fmt = { ch: b.readUInt16LE(p + 10), sr: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
  if (id === "data") {
    const bytes = fmt.bits / 8;
    const n = size / (fmt.ch * bytes);
    x = new Float64Array(n);
    for (let i = 0; i < n; i += 1) {
      let s = 0;
      for (let c = 0; c < fmt.ch; c += 1) {
        const o = p + 8 + (i * fmt.ch + c) * bytes;
        s += bytes === 3 ? b.readIntLE(o, 3) / 8388608 : bytes === 2 ? b.readInt16LE(o) / 32768 : b.readFloatLE(o);
      }
      x[i] = s / fmt.ch; // mono: what both ears share
    }
    sr = fmt.sr;
    break;
  }
  p += 8 + size + (size % 2);
}

const PC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const fOf = (m) => 440 * 2 ** ((m - 69) / 12);

// the tune, first statement (beat, note) and the D on 131.0
const TUNE = [
  [0, "D4"], [1, "E4"], [1.5, "F#4"], [2, "A4"], [3, "F#4"], [3.5, "A4"], [4, "B4"], [5, "A4"], [5.5, "F#4"],
  [6, "E4"], [8, "F#4"], [9, "E4"], [9.5, "D4"], [10, "B3"], [11, "A3"], [11.5, "B3"], [12, "D4"],
];
const SKEL = new Set([0, 2, 4, 6, 8, 10]);

function solve(A, y) {
  // Gaussian elimination with partial pivoting on a small dense system
  const n = y.length;
  for (let c = 0; c < n; c += 1) {
    let piv = c;
    for (let r = c + 1; r < n; r += 1) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    [y[c], y[piv]] = [y[piv], y[c]];
    for (let r = c + 1; r < n; r += 1) {
      const f = A[r][c] / A[c][c];
      if (!f) continue;
      for (let k = c; k < n; k += 1) A[r][k] -= f * A[c][k];
      y[r] -= f * y[c];
    }
  }
  const s = new Float64Array(n);
  for (let r = n - 1; r >= 0; r -= 1) {
    let v = y[r];
    for (let k = r + 1; k < n; k += 1) v -= A[r][k] * s[k];
    s[r] = v / A[r][r];
  }
  return s;
}

function lsEnergies(i0, n) {
  const M0 = 36;
  const M1 = 100;
  const ms = [];
  for (let m = M0; m <= M1; m += 1) ms.push(m);
  const K = ms.length * 2;
  const basis = [];
  for (const m of ms) {
    const w = (2 * Math.PI * fOf(m)) / sr;
    const c = new Float64Array(n);
    const s = new Float64Array(n);
    for (let i = 0; i < n; i += 1) {
      c[i] = Math.cos(w * i);
      s[i] = Math.sin(w * i);
    }
    basis.push(c, s);
  }
  const h = new Float64Array(n);
  for (let i = 0; i < n; i += 1) h[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i + 0.5)) / n);
  const A = Array.from({ length: K }, () => new Float64Array(K));
  const y = new Float64Array(K);
  for (let a = 0; a < K; a += 1) {
    for (let bb = a; bb < K; bb += 1) {
      let v = 0;
      const ba = basis[a];
      const bbb = basis[bb];
      for (let i = 0; i < n; i += 1) v += h[i] * ba[i] * bbb[i];
      A[a][bb] = v;
      A[bb][a] = v;
    }
    let v = 0;
    for (let i = 0; i < n; i += 1) v += h[i] * basis[a][i] * x[i0 + i];
    y[a] = v;
  }
  // a light ridge (RIDGE x each term's own weight): partials that lie between the semitones (bells, the
  // drum's modes, vibrato) would otherwise be explained by huge opposing neighbours in a short window
  for (let a = 0; a < K; a += 1) A[a][a] *= 1 + RIDGE;
  const sol = solve(A, y);
  const e = {};
  ms.forEach((m, j) => (e[m] = sol[2 * j] ** 2 + sol[2 * j + 1] ** 2));
  return e;
}

function dftEnergies(i0, n) {
  const e = {};
  let wsum = 0;
  const h = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    h[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i + 0.5)) / n);
    wsum += h[i];
  }
  for (let m = 48; m <= 95; m += 1) {
    const lo = fOf(m - 0.5);
    const hi = fOf(m + 0.5);
    let acc = 0;
    for (let f = lo; f < hi; f += 0.5) {
      let re = 0;
      let im = 0;
      const w = (2 * Math.PI * f) / sr;
      for (let i = 0; i < n; i += 1) {
        const v = x[i0 + i] * h[i];
        re += v * Math.cos(w * i);
        im -= v * Math.sin(w * i);
      }
      acc += ((2 * Math.hypot(re, im)) / wsum) ** 2;
    }
    e[m] = acc;
  }
  return e;
}

const db = (v) => 10 * Math.log10(v + 1e-30);
function rank(e) {
  const pc = new Array(12).fill(0);
  for (let m = 48; m <= 95; m += 1) pc[m % 12] += e[m];
  return pc.map((v, i) => [PC[i], v]).sort((a, c) => c[1] - a[1]);
}

let winsLS = 0;
let winsDFT = 0;
let skelLS = 0;
let skelDFT = 0;
console.log("film s   note  skel  window      | LS: strongest (dB)   tune vs next        | DFT: strongest   tune vs next");
for (const [beat, name] of TUNE) {
  const film = 125 + beat * 0.5;
  if (film > 131.0001) continue;
  const half = beat % 1 !== 0;
  const a = film + 0.03;
  const z = film + (half ? 0.13 : 0.18);
  const i0 = Math.round((a - T0) * sr);
  const n = Math.round((z - a) * sr);
  const tunePc = name.replace(/\d/, "");
  const out = [];
  for (const [tag, e] of [["LS", lsEnergies(i0, n)], ["DFT", dftEnergies(i0, n)]]) {
    const r = rank(e);
    const top = r[0];
    const tuneV = r.find((q) => q[0] === tunePc)[1];
    const other = r.find((q) => q[0] !== tunePc);
    const margin = db(tuneV) - db(other[1]);
    const wins = top[0] === tunePc;
    if (film < 130.9) {
      if (tag === "LS" && wins) winsLS += 1;
      if (tag === "DFT" && wins) winsDFT += 1;
      if (tag === "LS" && wins && SKEL.has(beat)) skelLS += 1;
      if (tag === "DFT" && wins && SKEL.has(beat)) skelDFT += 1;
    }
    out.push(`${wins ? "yes" : "NO "} ${top[0].padEnd(2)} ${db(top[1]).toFixed(1).padStart(6)}  ${margin >= 0 ? "+" : ""}${margin.toFixed(1)} dB vs ${other[0]}`);
  }
  const sk = SKEL.has(beat) || beat === 12 ? "S" : " ";
  console.log(`${film.toFixed(2)}  ${name.padEnd(4)}  ${sk}    ${a.toFixed(2)}-${z.toFixed(2)}  | ${out[0].padEnd(36)} | ${out[1]}`);
}
console.log(`Tune's pitch class strongest, among the 16 notes 125.0-130.75 (131.0 shown apart): LS ${winsLS}, DFT ${winsDFT}; skeleton (6): LS ${skelLS}, DFT ${skelDFT}.`);
