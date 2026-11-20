// node dev/audio/song-onset.mjs file.wav filmT  -> onset per band
import fs from "node:fs";
import { readWav, toMono, onsetNear } from "../../tools/lib/sound.mjs";
const [file, t] = process.argv.slice(2);
const side = JSON.parse(fs.readFileSync(file.replace(/\.wav$/, ".json"), "utf8"));
const { sampleRate: sr, channels } = readWav(file);
const x = toMono(channels);
for (const band of [null, [800, 3000], [1000, 4000], [1500, 6000], [2000, 8000], [80, 200]]) {
  const o = onsetNear(x, sr, Number(t) - side.from, { band });
  console.log(JSON.stringify(band), o ? `lag ${o.lagMs.toFixed(1)} ms rise ${o.riseDb.toFixed(1)} dB` : "none");
}
