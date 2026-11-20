// scratch: where are the loudest samples of a wav (film seconds)

import { readWav } from "../../tools/lib/sound.mjs";
const file = process.argv[2];
const w = readWav(file);
const t0 = Number(process.argv[3] || 76);
const ch = w.channels || w.data || w.chans || w;
const chans = Array.isArray(ch) ? ch : [ch];
const top = [];
chans.forEach((c, ci) => { for (let i = 0; i < c.length; i++) { const v = Math.abs(c[i]); if (v > 0.3) top.push([v, i, ci]); } });
top.sort((a, b) => b[0] - a[0]);
for (const [v, i, ci] of top.slice(0, 8)) console.log((20 * Math.log10(v)).toFixed(2), "dB at", (t0 + i / (w.sampleRate || w.sr || 48000)).toFixed(4), "ch", ci);
