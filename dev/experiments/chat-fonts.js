// Section 17 lab: which system fonts give legible thresholded bitmap Chinese at
// 12 and 16 px? Each sample is rendered at 1:1, thresholded, then shown 4x.
//   node tools/shot.mjs --page "dev/lab.html?exp=chat-fonts" --out out/shots/chat-fonts.png
const FAMS = ["GB18030 Bitmap", "Songti SC", "STHeiti", "Heiti SC", "PingFang SC", "Hiragino Sans GB", "STSong"];
const SAMPLE = "早期聊天窗口 对方正在输入… 骑着单车去流浪 给你看个东西 发送(S) 新建文件夹 Early Chat 2000s 21:07";

export function draw(stage, params) {
  const sizes = (params.get("sizes") || "12,14,16").split(",").map(Number);
  const thr = Number(params.get("thr") || 0.5);
  const Z = Number(params.get("z") || 3);
  const W = 640, H = 270;
  const src = stage.layer("lab/cf-src", W, H);
  const out = stage.layer("lab/cf-out", stage.W, stage.H);
  const sctx = src.clear();
  sctx.fillStyle = "#000";
  let y = 2;
  const rows = [];
  for (const fam of FAMS) {
    for (const px of sizes) {
      sctx.font = `${px}px '${fam}', monospace`;
      sctx.textBaseline = "top";
      sctx.fillText(SAMPLE, 2, y);
      rows.push([fam, px, y]);
      y += px + 3;
    }
  }
  const img = sctx.getImageData(0, 0, W, H).data;
  const octx = out.clear();
  octx.fillStyle = "#fff";
  octx.fillRect(0, 0, stage.W, stage.H);
  octx.fillStyle = "#000";
  for (let yy = 0; yy < H; yy += 1) for (let xx = 0; xx < W; xx += 1) {
    if (img[(yy * W + xx) * 4 + 3] / 255 > thr) octx.fillRect(xx * Z, yy * Z, Z, Z);
  }
  octx.fillStyle = "#c00";
  octx.font = "11px Menlo";
  for (const [fam, px, yy] of rows) octx.fillText(`${fam} ${px}`, W * Z - 300 > 0 ? 1920 - 150 : 0, yy * Z + 12);
  out.touch();
  stage.origin();
  stage.image(out, 0, 0);
  return { rows };
}
