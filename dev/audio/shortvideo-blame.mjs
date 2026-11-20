// Scratch: at the mix's loudest samples, what each instrument contributes.
import { readWav } from "../../tools/lib/sound.mjs";
const labels = ["bell-hook", "bell-echo", "kick", "stab", "clap", "chain", "sub", "pop", "like", "tap", "sweep"];
const mix = readWav("out/audio/s19.wav").channels;
const parts = Object.fromEntries(labels.map((l) => { try { return [l, readWav(`out/audio/s19_${l}.wav`).channels]; } catch { return [l, null]; } }));
const sr = 48000;
const top = [];
for (let c = 0; c < 2; c += 1) for (let i = 0; i < mix[c].length; i += 1) if (Math.abs(mix[c][i]) > 0.4) top.push([Math.abs(mix[c][i]), i, c]);
top.sort((a, b) => b[0] - a[0]);
const seen = [];
for (const [v, i, c] of top) {
  if (seen.some((j) => Math.abs(j - i) < sr * 0.05)) continue;
  seen.push(i);
  const s = labels.filter((l) => parts[l]).map((l) => `${l} ${parts[l][c][i].toFixed(3)}`).join("  ");
  console.log(`u ${(i / sr - 1).toFixed(4)} ch${c} mix ${(Math.sign(mix[c][i]) * v).toFixed(3)} | ${s}`);
  if (seen.length >= 8) break;
}
