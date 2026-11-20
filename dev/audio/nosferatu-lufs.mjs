import { loudness } from "../../tools/lib/sound.mjs";
const f = process.argv[2]; const from = 82;
const w = [[83,89],[83,85],[85,86],[86,87],[87,89]];
console.log(f, w.map(([a,b]) => `${a}-${b}: ${loudness(f,{from:a-from,dur:b-a}).integrated}`).join("  "));
