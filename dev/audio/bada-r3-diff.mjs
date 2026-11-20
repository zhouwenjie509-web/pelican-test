// Largest sample difference between two renders of film 52-61 s, inside given film-time spans.
import { readWav } from "../../tools/lib/sound.mjs";
const [fa, fb, ...spans] = process.argv.slice(2);
const A = readWav(fa), B = readWav(fb), sr = A.sampleRate;
for (const sp of spans) {
  const [t0, t1] = sp.split(":").map(Number);
  let m = 0;
  for (let c = 0; c < 2; c++) for (let i = Math.round((t0 - 52) * sr); i < Math.round((t1 - 52) * sr); i++) m = Math.max(m, Math.abs(A.channels[c][i] - B.channels[c][i]));
  console.log(`${sp}: max |diff| ${m.toExponential(2)}`);
}
