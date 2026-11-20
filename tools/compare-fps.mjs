#!/usr/bin/env node
// Frame-rate comparison: renders the same stretch of the film at 30 and 60
// frames per second and writes three files to out/compare/:
//
//   pan_30fps.mp4, pan_60fps.mp4      the stretch at each rate, full frame
//   pan_30_vs_60.mp4                  both at once: 30 fps on top (each frame shown twice), 60 fps below
//
//   node tools/compare-fps.mjs [--from 17] [--to 29] [--width 1920]

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PROJECT_ROOT } from "./lib/server.mjs";
import { launchBrowser } from "./lib/browser.mjs";
import { parseArgs } from "./lib/film.mjs";

const args = parseArgs(process.argv.slice(2));
const from = Number(args.from ?? 17);
const to = Number(args.to ?? 29);
const width = Number(args.width || 1920);
const height = Math.round((width * 9) / 16);
const outDir = path.resolve(PROJECT_ROOT, "out/compare");
fs.mkdirSync(outDir, { recursive: true });

function run(cmd, cmdArgs) {
  const res = spawnSync(cmd, cmdArgs, { cwd: PROJECT_ROOT, stdio: "inherit" });
  if (res.status !== 0) process.exit(res.status || 1);
}

for (const fps of [30, 60]) {
  const frames = `frames/compare_${fps}`;
  fs.rmSync(path.resolve(PROJECT_ROOT, frames), { recursive: true, force: true });
  run("node", ["tools/render.mjs", "--from", String(from), "--to", String(to), "--fps", String(fps), "--width", String(width), "--out", frames]);
  run("node", ["tools/encode.mjs", "--frames", frames, "--fps", String(fps), "--out", `out/compare/pan_${fps}fps.mp4`, "--crf", "16"]);
}

// labels are drawn by the browser (this ffmpeg build has no text filter)
const browser = await launchBrowser({ width: 600, height: 200 });
try {
  const page = await browser.newPage();
  for (const fps of [30, 60]) {
    const url = await page.evaluate((text) => {
      const c = document.createElement("canvas");
      c.width = 360;
      c.height = 76;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "rgba(18,17,16,0.82)";
      ctx.beginPath();
      ctx.roundRect(0, 0, 360, 76, 14);
      ctx.fill();
      ctx.fillStyle = "#f4efe4";
      ctx.font = "600 40px 'Helvetica Neue', Arial, sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 24, 40);
      return c.toDataURL("image/png");
    }, `${fps} frames / s`);
    fs.writeFileSync(path.join(outDir, `label_${fps}.png`), Buffer.from(url.split(",")[1], "base64"));
  }
} finally {
  await browser.close();
}

// stacked view: the band around the road, 30 fps above 60 fps, played at 60 fps
const bandH = Math.round(height / 2);
const bandY = Math.round(height * 0.31);
const start30 = Math.round(from * 30);
const start60 = Math.round(from * 60);
run("ffmpeg", [
  "-y", "-hide_banner", "-loglevel", "error",
  "-framerate", "30", "-start_number", String(start30), "-i", `frames/compare_30/f_%06d.png`,
  "-framerate", "60", "-start_number", String(start60), "-i", `frames/compare_60/f_%06d.png`,
  "-i", "out/compare/label_30.png", "-i", "out/compare/label_60.png",
  "-filter_complex",
  `[0:v]fps=60,crop=${width}:${bandH}:0:${bandY}[a0];[a0][2:v]overlay=28:28[a];` +
    `[1:v]crop=${width}:${bandH}:0:${bandY}[b0];[b0][3:v]overlay=28:28[b];` +
    `[a][b]vstack=inputs=2,scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p[v]`,
  "-map", "[v]", "-r", "60", "-c:v", "libx264", "-preset", "slow", "-crf", "16",
  "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
  "-movflags", "+faststart", "out/compare/pan_30_vs_60.mp4",
]);
for (const f of ["label_30.png", "label_60.png"]) fs.rmSync(path.join(outDir, f), { force: true });
console.log("Wrote out/compare/pan_30fps.mp4, pan_60fps.mp4 and pan_30_vs_60.mp4");
