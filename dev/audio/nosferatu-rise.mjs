import { readWav, toMono, onsetNear } from "../../tools/lib/sound.mjs";
const w = readWav(process.argv[2] || "out/audio/s14.wav"); const x = toMono(w.channels);
for (const t of [85, 86, 87]) { const o = onsetNear(x, w.sampleRate, t - 82); console.log(t, o && o.riseDb.toFixed(2), o && o.lagMs.toFixed(1)); }
