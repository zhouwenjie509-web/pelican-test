// Scratch: the exact onset reading of section 20's cue at 119.0 in out/audio/t117-127.wav (as the check reads it).
import { readWav, toMono, onsetNear } from "../../tools/lib/sound.mjs";
const w = readWav(process.argv[2] || "out/audio/t117-127.wav");
const on = onsetNear(toMono(w.channels), w.sampleRate, 2.0, { before: 0.12 });
console.log(`lag ${on.lagMs.toFixed(1)} ms, rise ${on.riseDb.toFixed(2)} dB`);
