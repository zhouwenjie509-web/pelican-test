// Section 19. Vertical short-form video, the 2020s.
//
// A bright city bike lane in flat vector colour. The pelican rides in as it
// has ridden through every other century; a passer-by lifts a phone, and on
// the downbeat of bar 2 the picture snaps to 9:16 with black bars either side
// and a (fictional) app's interface around it. Likes and comments drift
// upward. The progress bar runs out at the exact moment the pelican passes
// through the next frame.
//
// The app is invented for this film: its name, layout, icons and wording
// belong to no real product.

import { sectionMeta } from "./sections.js";
import { View } from "../kit/stage.js";
import { sampler, hash, wobble } from "../kit/rng.js";
import { drawText, font, FONTS } from "../kit/text.js";
import { solveRig } from "../rig/rig.js";
import { drawPlain } from "../rig/skins/plain.js";
import { ROAD_Y, REF_H } from "../main/layout.js";
import { BAR, BEAT, T_SECTION } from "../beat/timeline.js";
import { clamp, smoothstep, easeOutBack, easeOutCubic, decay } from "../beat/ease.js";

const META = sectionMeta(19);

// ------------------------------------------------------------------ the street
// Three cached strips at different depths, plus a screen-fixed sky.
const Y0 = 396;
const Y1 = 832;
const STRIP_PX = 3.3;
const STRIPS = {
  far: { parallax: 0.12, x0: -420, x1: 560 },
  mid: { parallax: 0.5, x0: -540, x1: 1060 },
  near: { parallax: 1, x0: -460, x1: 1460 },
};
const C = {
  skyTop: "#69b8f0",
  skyMid: "#bfe3f6",
  skyLow: "#ffe6c4",
  far: "#a9c7e0",
  far2: "#95b6d4",
  walk: "#e9e4da",
  walkLine: "#d3ccbf",
  curb: "#bdb6aa",
  lane: "#2d9d8d",
  laneDark: "#27897b",
  asphalt: "#4b4f57",
  asphaltDark: "#40444b",
  paint: "#f5f3ee",
  leaf: "#3fae6a",
  leafDark: "#2f8f58",
  trunk: "#7a5a43",
  ink: "#23262b",
};
const FACADES = ["#f4b860", "#ef8d7a", "#8ecae6", "#f6d6ad", "#b8d8ba", "#d9b8e8", "#f29e4c", "#9ad1d4"];
const SIGNS = ["鹈记奶茶", "骑行驿站", "便利店", "修车补胎", "鲜鱼", "打印复印", "花", "面"];

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function paintFar(ctx, strip) {
  // a skyline of pale towers, hazy with distance
  const rnd = sampler(1901);
  for (let pass = 0; pass < 2; pass += 1) {
    ctx.fillStyle = pass === 0 ? C.far : C.far2;
    let x = strip.x0 - 20;
    while (x < strip.x1 + 20) {
      const w = rnd.range(26, 62);
      const h = rnd.range(70, 190) * (pass === 0 ? 1 : 0.7);
      const top = 640 - h - (pass === 0 ? 30 : 0);
      ctx.fillRect(x, top, w, 660 - top);
      if (rnd.next() < 0.3) ctx.fillRect(x + w * 0.4, top - 16, 3, 16); // mast
      x += w + rnd.range(-4, 22);
    }
  }
}

function paintMid(ctx, strip) {
  // a row of shopfronts with flats above
  const rnd = sampler(1902);
  let x = strip.x0 - 10;
  let i = 0;
  while (x < strip.x1 + 10) {
    const w = rnd.range(110, 170);
    const floors = 2 + Math.floor(rnd.next() * 3);
    const top = 652 - 46 - floors * 34;
    const color = FACADES[i % FACADES.length];
    ctx.fillStyle = color;
    ctx.fillRect(x, top, w, 660 - top);
    ctx.fillStyle = "rgba(0,0,0,0.10)";
    ctx.fillRect(x + w - 5, top, 5, 660 - top);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(x, top, w, 4);
    // windows
    for (let f = 0; f < floors; f += 1) {
      const n = Math.max(2, Math.round(w / 34));
      for (let k = 0; k < n; k += 1) {
        const wx = x + 10 + (k * (w - 20)) / n;
        const wy = top + 12 + f * 34;
        ctx.fillStyle = hash(i, f, k) > 0.7 ? "#fff3c4" : "#5f7f9b";
        rr(ctx, wx, wy, (w - 20) / n - 7, 20, 2);
        ctx.fill();
        if (hash(i, f, k + 9) > 0.8) {
          ctx.fillStyle = "#e9eef2"; // an air conditioner
          ctx.fillRect(wx + 1, wy + 22, 12, 6);
        }
      }
    }
    // shopfront: awning, glass, sign
    const sy = 652 - 46;
    ctx.fillStyle = "#2d3138";
    ctx.fillRect(x + 6, sy + 12, w - 12, 34);
    ctx.fillStyle = "rgba(190,225,240,0.75)";
    ctx.fillRect(x + 10, sy + 16, w - 20 - 26, 26);
    ctx.fillStyle = "#6b4a36";
    ctx.fillRect(x + w - 32, sy + 16, 20, 30);
    const stripe = ["#e4572e", "#2e86ab", "#f2c14e", "#4f9d69"][i % 4];
    for (let k = 0; k < Math.ceil(w / 12); k += 1) {
      ctx.fillStyle = k % 2 ? "#fbf7ef" : stripe;
      ctx.fillRect(x + k * 12, sy + 2, Math.min(12, w - k * 12), 11);
    }
    ctx.fillStyle = "#fbf7ef";
    rr(ctx, x + 10, sy - 18, w - 20, 17, 3);
    ctx.fill();
    drawText(ctx, SIGNS[i % SIGNS.length], x + w / 2, sy - 9.5, { font: font(FONTS.hei, 11.5, 600), align: "center", baseline: "middle", fill: stripe, spacing: 1 });
    x += w + rnd.range(0, 10);
    i += 1;
  }
}

function tree(ctx, x, h, seed) {
  ctx.fillStyle = C.trunk;
  ctx.fillRect(x - 2.6, ROAD_Y - 10 - h * 0.55, 5.2, h * 0.55);
  const rnd = sampler(seed);
  for (let k = 0; k < 5; k += 1) {
    ctx.fillStyle = k < 3 ? C.leafDark : C.leaf;
    ctx.beginPath();
    ctx.ellipse(x + rnd.range(-0.2, 0.2) * h, ROAD_Y - 10 - h * (0.62 + rnd.range(0, 0.3)), h * rnd.range(0.2, 0.28), h * rnd.range(0.17, 0.24), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.beginPath();
  ctx.ellipse(x - h * 0.08, ROAD_Y - 10 - h * 0.86, h * 0.16, h * 0.1, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

function lamp(ctx, x) {
  ctx.strokeStyle = "#5c6470";
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, ROAD_Y - 10);
  ctx.lineTo(x, ROAD_Y - 190);
  ctx.quadraticCurveTo(x, ROAD_Y - 206, x + 22, ROAD_Y - 206);
  ctx.stroke();
  ctx.fillStyle = "#fff6d6";
  rr(ctx, x + 18, ROAD_Y - 209, 16, 6, 3);
  ctx.fill();
}

function sharedBike(ctx, x, color) {
  // a row of hire bikes: generic, no markings
  const y = ROAD_Y - 10;
  ctx.strokeStyle = "#2b2e33";
  ctx.lineWidth = 1.6;
  for (const dx of [-9, 9]) {
    ctx.beginPath();
    ctx.arc(x + dx, y - 8, 8, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(x - 9, y - 8);
  ctx.lineTo(x - 2, y - 20);
  ctx.lineTo(x + 8, y - 20);
  ctx.lineTo(x + 9, y - 8);
  ctx.moveTo(x - 2, y - 20);
  ctx.lineTo(x + 1, y - 8);
  ctx.lineTo(x - 9, y - 8);
  ctx.stroke();
  ctx.fillStyle = "#2b2e33";
  ctx.fillRect(x - 6, y - 24, 8, 2.6);
  ctx.fillRect(x + 6, y - 26, 2, 7);
}

function person(ctx, x, shirt, facing, phoneUp) {
  // a passer-by in flat colour; some of them are filming
  const y = ROAD_Y - 10;
  ctx.fillStyle = "#3a4250";
  ctx.fillRect(x - 6, y - 40, 5, 40);
  ctx.fillRect(x + 1, y - 40, 5, 40);
  ctx.fillStyle = shirt;
  rr(ctx, x - 9, y - 76, 18, 40, 6);
  ctx.fill();
  ctx.fillStyle = "#f1c9a5";
  ctx.beginPath();
  ctx.arc(x, y - 86, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2b2622";
  ctx.beginPath();
  ctx.arc(x, y - 89, 9.2, Math.PI, Math.PI * 2);
  ctx.fill();
  if (phoneUp) {
    ctx.strokeStyle = shirt;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + facing * 6, y - 68);
    ctx.lineTo(x + facing * 18, y - 80);
    ctx.stroke();
    ctx.fillStyle = "#16181c";
    rr(ctx, x + facing * 15 - 3.5, y - 94, 7, 13, 1.5);
    ctx.fill();
  }
}

function paintNear(ctx, strip) {
  const w = strip.x1 - strip.x0;
  // pavement
  ctx.fillStyle = C.walk;
  ctx.fillRect(strip.x0, 650, w, ROAD_Y - 10 - 650);
  ctx.strokeStyle = C.walkLine;
  ctx.lineWidth = 0.7;
  for (let x = strip.x0; x < strip.x1; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, 650);
    ctx.lineTo(x - 6, ROAD_Y - 10);
    ctx.stroke();
  }
  ctx.fillStyle = C.curb;
  ctx.fillRect(strip.x0, ROAD_Y - 10, w, 4);
  // the bike lane, with its painted bicycles and arrows
  ctx.fillStyle = C.lane;
  ctx.fillRect(strip.x0, ROAD_Y - 6, w, 62);
  ctx.fillStyle = C.laneDark;
  for (let x = strip.x0; x < strip.x1; x += 140) ctx.fillRect(x, ROAD_Y - 6, 70, 62);
  ctx.fillStyle = C.paint;
  ctx.fillRect(strip.x0, ROAD_Y + 52, w, 3.2);
  for (let x = Math.ceil(strip.x0 / 250) * 250 + 120; x < strip.x1; x += 250) {
    const y = ROAD_Y + 26;
    ctx.strokeStyle = C.paint;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.5); // foreshortened on the road surface
    for (const dx of [-11, 11]) {
      ctx.beginPath();
      ctx.arc(dx, 0, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-11, 0);
    ctx.lineTo(-3, -14);
    ctx.lineTo(9, -14);
    ctx.lineTo(11, 0);
    ctx.moveTo(-3, -14);
    ctx.lineTo(1, 0);
    ctx.lineTo(-11, 0);
    ctx.stroke();
    // arrow
    ctx.beginPath();
    ctx.moveTo(34, 0);
    ctx.lineTo(62, 0);
    ctx.moveTo(52, -10);
    ctx.lineTo(62, 0);
    ctx.lineTo(52, 10);
    ctx.stroke();
    ctx.restore();
  }
  // the carriageway beyond the lane line
  ctx.fillStyle = C.asphalt;
  ctx.fillRect(strip.x0, ROAD_Y + 55.2, w, Y1 - ROAD_Y - 55);
  ctx.fillStyle = C.asphaltDark;
  for (let x = strip.x0; x < strip.x1; x += 90) ctx.fillRect(x, ROAD_Y + 55.2, 45, Y1 - ROAD_Y - 55);
  ctx.fillStyle = C.paint;
  for (let x = Math.ceil(strip.x0 / 70) * 70; x < strip.x1; x += 70) ctx.fillRect(x, ROAD_Y + 100, 34, 3);

  // street furniture, left to right
  for (let x = Math.ceil(strip.x0 / 235) * 235 + 60; x < strip.x1; x += 235) tree(ctx, x, 128 + 30 * hash(x, 3), 3000 + x);
  for (let x = Math.ceil(strip.x0 / 310) * 310 + 180; x < strip.x1; x += 310) lamp(ctx, x);
  const bikeColors = ["#f2c14e", "#3da5d9", "#f2c14e", "#73bf69", "#3da5d9"];
  for (let k = 0; k < 5; k += 1) sharedBike(ctx, 96 + k * 30, bikeColors[k]);
  for (let k = 0; k < 4; k += 1) sharedBike(ctx, 1120 + k * 30, bikeColors[(k + 2) % 5]);

  // a bus shelter whose poster advertises the book from the intro
  const bx = 640;
  const by = ROAD_Y - 10;
  ctx.fillStyle = "#59616d";
  ctx.fillRect(bx, by - 96, 4, 96);
  ctx.fillRect(bx + 126, by - 96, 4, 96);
  ctx.fillStyle = "#7d8794";
  rr(ctx, bx - 8, by - 104, 146, 9, 3);
  ctx.fill();
  ctx.fillStyle = "#f6f1e6";
  ctx.fillRect(bx + 10, by - 88, 58, 76);
  ctx.strokeStyle = "#2b2622";
  ctx.lineWidth = 0.8;
  ctx.strokeRect(bx + 10, by - 88, 58, 76);
  drawText(ctx, "鹈鹕骑行", bx + 39, by - 68, { font: font(FONTS.song, 10.5, 700), align: "center", fill: "#2b2622" });
  drawText(ctx, "艺术通史", bx + 39, by - 55, { font: font(FONTS.song, 10.5, 700), align: "center", fill: "#2b2622" });
  drawText(ctx, "卷一", bx + 39, by - 40, { font: font(FONTS.song, 8, 400), align: "center", fill: "#6b6258" });
  drawText(ctx, "（虚构）", bx + 39, by - 22, { font: font(FONTS.song, 7, 400), align: "center", fill: "#6b6258" });
  ctx.fillStyle = "rgba(180,215,235,0.45)";
  ctx.fillRect(bx + 74, by - 88, 48, 76);
  ctx.fillStyle = "#8a6b4f";
  ctx.fillRect(bx + 78, by - 26, 42, 5);

  // passers-by; the one near the start of bar 2 is the one whose phone we end up watching
  person(ctx, 372, "#e4572e", -1, true);
  person(ctx, 468, "#3d6fb6", -1, false);
  person(ctx, 868, "#f2c14e", -1, true);
  person(ctx, 905, "#8e6bbf", -1, true);
  person(ctx, 1310, "#4f9d69", -1, true);
}

const PAINTERS = { far: paintFar, mid: paintMid, near: paintNear };

function bakeStrip(stage, id) {
  const strip = STRIPS[id];
  const k = STRIP_PX * stage.s;
  const w = Math.round((strip.x1 - strip.x0) * k);
  const h = Math.round((Y1 - Y0) * k);
  return stage.bake2d(`shortvideo/${id}/${k.toFixed(3)}`, w, h, (ctx) => {
    ctx.scale(k, k);
    ctx.translate(-strip.x0, -Y0);
    PAINTERS[id](ctx, strip);
  });
}

// ------------------------------------------------------------------ the app
// Layout in 1080p pixels inside the 9:16 picture (607.5 x 1080).
const VW = (REF_H * 9) / 16;
const COMMENTS = ["？？？", "它哪来的手握车把", "为什么要骑车，它会飞啊", "头盔呢？", "嘴比车还长", "建议查查是不是 AI 画的", "鹈鹕：已读不回", "第 19 个了，下一个是谁", "已转给不会骑车的朋友"];

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.5, y - s * 0.1, x - s * 0.75, y - s * 1.15, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.75, y - s * 1.15, x + s * 1.5, y - s * 0.1, x, y + s * 0.9);
  ctx.closePath();
}

const wan = (n) => (n >= 10000 ? `${(n / 10000).toFixed(1)}万` : String(n));

/** Draw the interface for local time u into a context whose units are 1080p pixels of the 9:16 picture. */
function paintUI(ctx, u) {
  const v = u - BAR; // seconds since the picture went vertical
  const pop = (delay) => clamp(easeOutBack(clamp((v - delay) / 0.22)), 0, 1.2);
  const shadow = () => {
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 1;
  };
  const plain = () => {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  };

  // soft gradients top and bottom so white lettering stays readable; they come in
  // as the black bars close (the bars' own slam, below in render), so no hard
  // seam ever shows over the street
  const closed = smoothstep(0.9, 1, clamp(easeOutBack(clamp(v / 0.2), 1.3)));
  ctx.globalAlpha = closed;
  let g = ctx.createLinearGradient(0, 0, 0, 190);
  g.addColorStop(0, "rgba(0,0,0,0.42)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VW, 190);
  g = ctx.createLinearGradient(0, 760, 0, 1080);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 760, VW, 320);
  ctx.globalAlpha = 1;

  // status bar and tabs
  ctx.globalAlpha = clamp(pop(0.04));
  shadow();
  drawText(ctx, "12:07", 30, 46, { font: font(FONTS.sans, 24, 600), fill: "#fff" });
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 4; i += 1) ctx.fillRect(VW - 128 + i * 8, 44 - i * 4, 5, 6 + i * 4);
  rr(ctx, VW - 74, 28, 40, 19, 5);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillRect(VW - 70, 32, 26, 11);
  ["关注", "精选", "附近"].forEach((t, i) => {
    const x = VW / 2 + (i - 1) * 104;
    drawText(ctx, t, x, 110, { font: font(FONTS.hei, i === 1 ? 31 : 28, i === 1 ? 700 : 500), align: "center", fill: i === 1 ? "#fff" : "rgba(255,255,255,0.72)" });
    if (i === 1) ctx.fillRect(x - 20, 122, 40, 4);
  });
  // search: a plain magnifying glass
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.arc(VW - 52, 98, 11, 0, Math.PI * 2);
  ctx.moveTo(VW - 44, 106);
  ctx.lineTo(VW - 34, 116);
  ctx.stroke();
  plain();

  // the rail of buttons down the right-hand side
  const rx = VW - 60;
  const likes = 66000 + Math.floor(Math.max(0, v) * 4321);
  const button = (i, y, drawIcon, label) => {
    const s = pop(0.1 + i * 0.07);
    if (s <= 0) return;
    ctx.save();
    ctx.globalAlpha = clamp(s);
    ctx.translate(rx, y);
    ctx.scale(s, s);
    shadow();
    drawIcon();
    plain();
    ctx.restore();
    ctx.globalAlpha = clamp(s);
    // the count gets a denser soft shadow than the icons, so it holds over a white poster
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 7;
    ctx.shadowOffsetY = 1;
    for (let k = 0; k < 2; k += 1) drawText(ctx, label, rx, y + 52, { font: font(FONTS.hei, 22, 600), align: "center", fill: "#fff" });
    plain();
  };
  // avatar with a follow badge
  button(
    0,
    470,
    () => {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(0, 0, 33, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7fc8e8";
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.fill();
      // a little pelican head
      ctx.fillStyle = "#faf7f0";
      ctx.beginPath();
      ctx.arc(-5, -3, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f3a83b";
      ctx.beginPath();
      ctx.moveTo(3, -6);
      ctx.lineTo(25, 3);
      ctx.lineTo(4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#23262b";
      ctx.beginPath();
      ctx.arc(-2, -6, 2, 0, Math.PI * 2);
      ctx.fill();
      // follow mark: a small amber tab, not a round badge
      ctx.fillStyle = "#ffc43d";
      rr(ctx, -15, 26, 30, 15, 4);
      ctx.fill();
      ctx.fillStyle = "#23262b";
      ctx.fillRect(-5, 32, 10, 2.6);
      ctx.fillRect(-1.3, 28.7, 2.6, 9.2);
    },
    "",
  );
  // like: the heart swells on every beat
  const beatPulse = 1 + 0.16 * decay(((v % BEAT) + BEAT) % BEAT, 0.07) * (v > 0.5 ? 1 : 0);
  button(
    1,
    590,
    () => {
      ctx.fillStyle = "#ff4d6d";
      heartPath(ctx, 0, 0, 24 * beatPulse);
      ctx.fill();
    },
    wan(likes),
  );
  button(
    2,
    706,
    () => {
      ctx.fillStyle = "#fff";
      rr(ctx, -26, -22, 52, 40, 14);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-8, 16);
      ctx.lineTo(-14, 30);
      ctx.lineTo(6, 17);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      for (const dx of [-12, 0, 12]) {
        ctx.beginPath();
        ctx.arc(dx, -2, 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    String(2317 + Math.floor(Math.max(0, v) * 37)),
  );
  button(
    3,
    822,
    () => {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(-26, 14);
      ctx.quadraticCurveTo(-22, -10, 4, -10);
      ctx.lineTo(4, -24);
      ctx.lineTo(28, -2);
      ctx.lineTo(4, 18);
      ctx.lineTo(4, 4);
      ctx.quadraticCurveTo(-14, 4, -26, 14);
      ctx.closePath();
      ctx.fill();
    },
    String(889 + Math.floor(Math.max(0, v) * 11)),
  );

  // caption: this is the section's title card
  ctx.globalAlpha = clamp(pop(0.16));
  shadow();
  drawText(ctx, "@鹈鹕骑行日记", 28, 842, { font: font(FONTS.hei, 29, 700), fill: "#fff" });
  drawText(ctx, META.zh, 28, 899, { font: font(FONTS.hei, 52, 800), fill: "#fff", spacing: 1 });
  drawText(ctx, META.en, 28, 940, { font: font(FONTS.sans, 38, 500), fill: "#fff" });
  drawText(ctx, "#21世纪20年代  #2020s", 28, 978, { font: font(FONTS.hei, 37, 500), fill: "#ffe38a" });
  // sound: bars that bounce, and a scrolling credit
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 4; i += 1) {
    const h = 6 + 12 * Math.abs(Math.sin(v * 9 + i * 1.3));
    ctx.fillRect(30 + i * 7, 1012 - h, 4, h);
  }
  drawText(ctx, "声音 · 车铃与链条", 66, 1010, { font: font(FONTS.hei, 22, 500), fill: "rgba(255,255,255,0.92)" });
  plain();

  // progress: it starts when the picture goes vertical and is full at the next frame
  const done = clamp(v / (T_SECTION - BAR));
  // on the crossing (u = 6 exactly, never before) the full bar answers with one short pulse
  const ping = u >= T_SECTION ? 1 - smoothstep(0.05, 0.25, u - T_SECTION) : 0;
  const bh = 5 + 3 * ping;
  ctx.globalAlpha = clamp(pop(0.02));
  ctx.fillStyle = "rgba(255,255,255,0.32)";
  rr(ctx, 24, 1044.5 - bh / 2, VW - 48, bh, bh / 2);
  ctx.fill();
  if (ping > 0) {
    ctx.shadowColor = `rgba(255,255,255,${0.9 * ping})`;
    ctx.shadowBlur = 14 * ping;
  }
  ctx.fillStyle = "#fff";
  rr(ctx, 24, 1044.5 - bh / 2, Math.max(5, (VW - 48) * done), bh, bh / 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(24 + (VW - 48) * done, 1044.5, 7 + 3 * ping, 0, Math.PI * 2);
  ctx.fill();
  plain();
  ctx.globalAlpha = 1;
  if (v <= 0) return;

  // comments drift up the left side, one every half bar
  for (let i = 0; i < COMMENTS.length; i += 1) {
    const born = 0.25 + i * 0.47;
    const age = v - born;
    if (age < 0 || age > 2.6) continue;
    const y = 780 - 96 * age - 30 * easeOutCubic(clamp(age / 0.3));
    const a = Math.min(clamp(age / 0.2), 1 - smoothstep(1.9, 2.6, age));
    ctx.globalAlpha = a;
    ctx.font = font(FONTS.hei, 24, 500);
    const w = ctx.measureText(COMMENTS[i]).width + 62;
    ctx.fillStyle = "rgba(20,22,26,0.5)";
    rr(ctx, 24, y - 26, w, 40, 20);
    ctx.fill();
    ctx.fillStyle = ["#ffd166", "#8ecae6", "#f4a3b5", "#b8e0a0"][i % 4];
    ctx.beginPath();
    ctx.arc(46, y - 6, 12, 0, Math.PI * 2);
    ctx.fill();
    drawText(ctx, COMMENTS[i], 68, y + 2, { font: font(FONTS.hei, 24, 500), fill: "#fff" });
  }

  // hearts float up from the like button
  for (let i = 0; i < 40; i += 1) {
    const born = 0.3 + i * 0.105 + hash(i, 19) * 0.08;
    const age = v - born;
    if (age < 0 || age > 1.7) continue;
    const t = age / 1.7;
    const x = rx + Math.sin(age * 3 + i * 2.1) * (16 + 22 * t) + (hash(i, 23) - 0.5) * 30;
    const y = 566 - 250 * t ** 0.85;
    ctx.globalAlpha = Math.min(clamp(age / 0.12), 1 - t ** 2) * 0.95;
    ctx.fillStyle = ["#ff4d6d", "#ff8fa3", "#ffb703", "#ff4d6d"][i % 4];
    heartPath(ctx, x, y, 9 + 9 * hash(i, 31) + 5 * t);
    ctx.fill();
  }

  // a double tap: one large heart in the middle of the picture, on the strong beat
  const tap = v - 1.0;
  if (tap > 0 && tap < 0.9) {
    const s = 86 * easeOutBack(clamp(tap / 0.18), 2.4) * (1 + 0.25 * smoothstep(0.5, 0.9, tap));
    ctx.globalAlpha = 0.92 * (1 - smoothstep(0.45, 0.9, tap));
    ctx.save();
    ctx.translate(VW / 2 - 40, 612);
    ctx.rotate(-0.22);
    ctx.fillStyle = "#ff4d6d";
    heartPath(ctx, 0, 0, s);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

export const shortvideo = {
  ...META,
  still: { u: 3.95 },

  init(stage) {
    for (const id of Object.keys(STRIPS)) bakeStrip(stage, id);
  },

  render(stage, f) {
    const { p } = stage;
    const u = f.u;
    const view = f.view;
    const scale = f.h / REF_H; // interface pixels per 1080p pixel on this target
    const vertical = u >= BAR;

    // a phone in the hand: the picture trembles a little once we are watching the recording
    const hold = smoothstep(BAR, BAR + 0.3, u) * (1 - smoothstep(T_SECTION - 0.8, T_SECTION - 0.35, u));
    const sx = wobble(u * 2.3, 191) * 4.5 * hold * scale;
    const sy = wobble(u * 2.9, 192) * 3.5 * hold * scale;
    const shaky = new View(view.k, view.tx + sx, view.ty + sy);
    const camX = shaky.wx(f.w / 2);

    // sky, fixed to the screen
    stage.origin();
    const sky = stage.bake2d(`shortvideo/sky/${f.h}`, 8, f.h, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, f.h);
      g.addColorStop(0, C.skyTop);
      g.addColorStop(0.5, C.skyMid);
      g.addColorStop(0.74, C.skyLow);
      g.addColorStop(1, C.skyLow);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 8, f.h);
    });
    stage.image(sky, 0, 0, f.w, f.h);

    // the street, back to front
    for (const id of ["far", "mid", "near"]) {
      const strip = STRIPS[id];
      const tex = bakeStrip(stage, id);
      // a layer at depth p slides past at p times the camera's speed
      const tx = f.w / 2 - camX * strip.parallax * shaky.k;
      const layerView = new View(shaky.k, tx, shaky.ty);
      stage.withView(layerView, () => stage.image(tex, strip.x0, Y0, strip.x1 - strip.x0, Y1 - Y0));
    }

    // the pelican: crisp, flat, with a sticker's white border
    if (f.pelican.visible) {
      const skel = solveRig({ ...f.pelican, act: { wind: 1 } });
      const b = skel.bounds;
      const patch = stage.patch("shortvideo/pelican", shaky, b.x0 - 6, b.y0 - 6, b.x1 + 6, b.y1 + skel.scale * 0.5);
      const ctx = patch.ctx;
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath();
      ctx.ellipse(f.pelican.x, f.pelican.y + skel.scale * 0.12, skel.scale * 2.6, skel.scale * 0.17, 0, 0, Math.PI * 2);
      ctx.fill();
      drawPlain(ctx, skel, { halo: { color: "#ffffff", width: 0.12 }, outline: 0.055 });
      stage.imagePatch(patch);
    }

    if (!vertical) return;

    // 9:16: black bars slam in from both sides
    stage.origin();
    const slam = clamp(easeOutBack(clamp((u - BAR) / 0.2), 1.3), 0, 1.06);
    const vw = VW * scale;
    const barW = ((f.w - vw) / 2) * slam;
    stage.rect(0, 0, barW, f.h, [0, 0, 0]);
    stage.rect(f.w - barW, 0, barW, f.h, [0, 0, 0]);

    // the interface, drawn fresh each frame on a layer the size of the picture
    const ui = stage.layer(`shortvideo/ui/${Math.round(vw)}x${f.h}`, vw, f.h);
    const ctx = ui.clear();
    ctx.scale(scale, scale);
    paintUI(ctx, u);
    ui.touch();
    stage.origin();
    stage.image(ui, (f.w - vw) / 2, 0, vw, f.h);
    p.noStroke();
  },
};

