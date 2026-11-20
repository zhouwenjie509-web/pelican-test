// peak (per channel) and its time in 61.99-62.10 for each file, and the signed value at a chosen time
import { readWav } from "../../tools/lib/sound.mjs";
const at = Number(process.env.AT || 62.023);
for (const f of process.argv.slice(2)) {
  const { sampleRate: sr, channels } = readWav(f);
  const out = channels.map((c, ci) => {
    let m = 0, t = 0;
    for (let i = Math.round((Number(process.env.FROM || 61.99) - 58) * sr); i < Math.round((Number(process.env.FROM || 61.99) - 57.89) * sr); i++) if (Math.abs(c[i]) > m) { m = Math.abs(c[i]); t = i; }
    return `ch${ci} peak ${m.toFixed(3)} @${(58 + t / sr).toFixed(4)} val@${at}: ${c[Math.round((at - 58) * sr)].toFixed(3)}`;
  });
  console.log(f.replace("out/audio/", "").padEnd(34), out.join(" | "));
}
