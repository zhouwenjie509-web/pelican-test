// Scratch: integrated loudness of a section-8 render (file starts at film 46), over the six seconds 47-53.
import { loudness } from "../../tools/lib/sound.mjs";
for (const f of process.argv.slice(2)) console.log(f, loudness(f, { from: 1, dur: 6 }).integrated);
