// Section 1. Saharan rock art, c. 4000 BCE, in the manner of the pastoral
// paintings of the Tassili n'Ajjer.
//
// A sandstone wall. Ochre, kaolin and charcoal, applied with fingers and
// frayed sticks: a herd of long-horned cattle, their herders, rows of dots.
// The pelican is one more painting on the wall, the newest and the only one
// with wheels. As it passes, every painted head turns to follow it.
//
// The wall and everything that holds still are painted once into a cached
// layer. Each frame adds the heads that turn, the pelican, and a last pass
// of bare rock showing through where paint has worn away.

import { sectionMeta } from "./sections.js";
import { View } from "../kit/stage.js";
import { VERT, FRAG_HEAD, NOISE } from "../kit/glsl.js";
import { hash } from "../kit/rng.js";
import { smoothClosed, smoothOpen, blob, placer, rotAbout } from "../kit/geom.js";
import { withPen, defineBrush } from "../kit/pen.js";
import { drawPigmentMask } from "../kit/fx.js";
import { sprite, drawText, font, FONTS } from "../kit/text.js";
import { solveRig } from "../rig/rig.js";
import { ROAD_Y } from "../main/layout.js";
import { clamp, smoothstep, lerp } from "../beat/ease.js";

const META = sectionMeta(1);

// The stretch of wall that gets painted: wider than the section, so the
// camera never sees an edge while a neighbouring picture is still in view.
const WALL = { x0: -440, y0: 392, x1: 1440, y1: 828 };
const WALL_PX = 3.3; // cached pixels per world unit at 1080p

const C = {
  red: "#7c2b16", // red ochre
  dark: "#4b190d", // burnt ochre, charcoal-darkened
  ochre: "#b87a2b", // yellow ochre
  white: "#efe3cd", // kaolin
  faded: "#a26a4c", // old paint, nearly gone
  soot: "#2c1b13",
};

// ------------------------------------------------------------------ the rock
const ROCK_FRAG = `${FRAG_HEAD}
uniform vec2 uOrigin;
uniform vec2 uSize;
uniform float uPxPerUnit;
uniform float uWear;        // 0: the rock itself. 1: only the places where paint has worn off
${NOISE}

float height(vec2 w) {
  return fbm(w / 46.0) * 0.6 + fbm(w / 11.0 + 9.1) * 0.28 + vnoise(w * 0.9) * 0.12;
}

void main() {
  vec2 w = uOrigin + vTexCoord * uSize;

  // sandstone is bedded: thin and thick layers that undulate gently
  float bend = (fbm(vec2(w.x / 340.0, w.y / 120.0) + 3.7) - 0.5) * 60.0;
  float bed1 = fbm(vec2(w.x / 1200.0, (w.y + bend) / 9.0));
  float bed2 = fbm(vec2(w.x / 1600.0 + 5.0, (w.y + bend) / 38.0));
  float tone = fbm(w / 280.0 + 21.0);
  float blotch = fbm(w / 64.0 + 40.0);

  vec3 light = vec3(0.870, 0.715, 0.535);
  vec3 mid = vec3(0.785, 0.600, 0.425);
  vec3 dark = vec3(0.620, 0.425, 0.300);
  vec3 col = mix(mid, light, smoothstep(0.30, 0.72, tone));
  col = mix(col, dark, smoothstep(0.50, 0.80, blotch) * 0.42);
  col *= 0.90 + 0.20 * bed1;
  col = mix(col, col * vec3(1.05, 0.96, 0.88), smoothstep(0.4, 0.7, bed2) * 0.5);

  // desert varnish: a dark skin on the most exposed rock, heavier near the top
  float varn = smoothstep(0.60, 0.84, fbm(w / 150.0 + 77.0) + 0.22 * smoothstep(540.0, 400.0, w.y));
  col = mix(col, vec3(0.36, 0.235, 0.18), varn * 0.5);

  // low relief, lit from the upper left
  float e = 1.2;
  float h0 = height(w);
  float shade = clamp(((h0 - height(w + vec2(e, 0.0))) * 0.7 + (h0 - height(w + vec2(0.0, e)))) / e * 9.0, -1.0, 1.0);
  col *= 1.0 + shade * 0.20;

  // fissures along the zero line of a slow noise
  float cn = fbm(w / 130.0 + 11.0);
  float crack = (1.0 - smoothstep(0.0, 0.0055, abs(cn - 0.5))) * smoothstep(0.42, 0.62, fbm(w / 400.0 + 3.0));

  // pores
  vec2 cell = floor(w / 5.0);
  vec2 jit = hash22(cell);
  float pr = hash21(cell + 7.0);
  float pd = length(w / 5.0 - cell - 0.2 - 0.6 * jit);
  float pit = step(0.87, pr) * (1.0 - smoothstep(0.05, 0.15 + 0.1 * pr, pd));

  float fine = smoothstep(1.2, 2.6, uPxPerUnit);
  col *= 1.0 + (vnoise(w * 1.7) - 0.5) * 0.10 * fine + (vnoise(w * 0.45) - 0.5) * 0.08;
  col = mix(col, col * 0.45, crack * 0.85);
  col = mix(col, col * 0.55, pit * 0.8 * fine);

  if (uWear > 0.5) {
    // where the paint film has flaked or been scoured, the rock shows again
    float flake = smoothstep(0.62, 0.74, fbm(w / 19.0 + 60.0)) * smoothstep(0.38, 0.7, fbm(w / 95.0 + 5.0));
    float speck = smoothstep(0.74, 0.92, vnoise(w * 0.85 + 33.0)) * 0.55 * fine;
    float a = clamp(max(max(crack, pit * fine), max(flake * 0.85, speck)), 0.0, 1.0) * uWear;
    fragColor = vec4(col * a, a);
  } else {
    fragColor = vec4(col, 1.0);
  }
}`;

function drawRock(stage, view, r, wear = 0) {
  const sh = stage.shader("sahara/rock", VERT, ROCK_FRAG);
  stage.withView(view, () => {
    stage.shaderRect(sh, { uOrigin: [r.x0, r.y0], uSize: [r.x1 - r.x0, r.y1 - r.y0], uPxPerUnit: view.k, uWear: wear }, r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
  });
}

// ------------------------------------------------------------------ cattle
// Drawn in local units: body length 1, facing right, hooves on y = 0.
const COW_BODY = smoothClosed(
  [
    [-0.5, -0.5],
    [-0.4, -0.59],
    [-0.1, -0.575],
    [0.15, -0.59],
    [0.3, -0.655],
    [0.42, -0.6],
    [0.5, -0.45],
    [0.45, -0.3],
    [0.3, -0.255],
    [0.0, -0.245],
    [-0.28, -0.27],
    [-0.46, -0.33],
    [-0.525, -0.42],
  ],
  5,
);
// each leg: [x, y, pressure] from the body down to the hoof
const COW_LEGS = [
  [
    [0.4, -0.3, 1.25],
    [0.425, -0.14, 0.95],
    [0.41, 0, 0.8],
  ],
  [
    [0.33, -0.28, 1.25],
    [0.3, -0.13, 0.95],
    [0.275, 0, 0.8],
  ],
  [
    [-0.42, -0.35, 1.35],
    [-0.48, -0.17, 0.95],
    [-0.43, 0, 0.8],
  ],
  [
    [-0.36, -0.32, 1.35],
    [-0.375, -0.15, 0.95],
    [-0.31, 0, 0.8],
  ],
];
const COW_TAIL = [
  [-0.51, -0.5],
  [-0.585, -0.4],
  [-0.59, -0.2],
  [-0.565, -0.1],
];
const COW_NECK = [0.43, -0.52]; // where the neck turns

// The herd walks above the road: four large animals in file, two smaller ones
// behind them and a calf at the rear. The back row is painted first.
const CATTLE = [
  { x: 668, y: 552, len: 80, coat: "ochre", seed: 7 },
  { x: 806, y: 550, len: 84, coat: "red", seed: 2 },
  { x: 596, y: 592, len: 104, coat: "pied", seed: 1 },
  { x: 722, y: 594, len: 110, coat: "white", seed: 3 },
  { x: 846, y: 591, len: 100, coat: "red", seed: 4 },
  { x: 918, y: 598, len: 58, coat: "ochre", seed: 6 }, // the calf
].map((cow) => ({ facing: 1, ...cow }));

function coatColors(coat) {
  if (coat === "white") return { body: C.white, mark: C.red, line: C.red, horn: C.dark };
  if (coat === "ochre") return { body: C.ochre, mark: C.white, line: C.dark, horn: C.dark };
  return { body: C.red, mark: C.white, line: C.dark, horn: C.dark };
}

function paintCowBody(pen, stage, cow) {
  const T = placer(cow.x, cow.y, cow.len, cow.facing);
  const col = coatColors(cow.coat);
  const w = cow.len / 100;
  stage.reseed(cow.seed * 977 + 11);

  // legs first, so the body sits over their tops
  pen.reset().set("rock-finger", col.line, 2.0 * w);
  for (const leg of COW_LEGS) pen.spline(leg.map(T), 0.5);
  pen.set("rock-finger", col.line, 1.1 * w);
  pen.spline(COW_TAIL.map(T), 0.6);
  pen.set("rock-finger", col.line, 2.4 * w);
  pen.line(...T([-0.565, -0.1]), ...T([-0.555, -0.035])); // tail tuft

  pen.noStroke().fill(col.body, 215, { bleed: 0.05, texture: 0.7, border: 0.3 });
  pen.polygon(COW_BODY.map(T));
  pen.noFill();
  pen.flush();

  if (cow.coat === "pied") {
    stage.reseed(cow.seed * 977 + 12);
    pen.noStroke().fill(col.mark, 225, { bleed: 0.04, texture: 0.5, border: 0.15 });
    const n = 2 + (cow.seed % 2);
    for (let i = 0; i < n; i += 1) {
      const bx = -0.3 + 0.3 * i + (hash(cow.seed, i) - 0.5) * 0.12;
      const by = -0.44 + (hash(cow.seed, i, 3) - 0.5) * 0.12;
      pen.polygon(blob(bx, by, 0.1 + 0.04 * hash(cow.seed, i, 5), 0.085, 0.28, cow.seed * 31 + i, 7).map(T));
    }
    pen.noFill();
  } else if (cow.coat === "white") {
    // a white cow, outlined and dappled in red
    stage.reseed(cow.seed * 977 + 13);
    pen.set("rock-dry", col.line, 0.9 * w);
    pen.polygon(COW_BODY.map(T));
    pen.set("rock-finger", col.mark, 1.7 * w);
    for (let i = 0; i < 9; i += 1) {
      const p = T([-0.38 + (i % 5) * 0.17 + (hash(cow.seed, i, 8) - 0.5) * 0.06, -0.52 + Math.floor(i / 5) * 0.17 + (hash(cow.seed, i, 9) - 0.5) * 0.05]);
      pen.line(p[0], p[1], p[0] + 0.6, p[1] + 0.3);
    }
  }
  pen.flush();
}

/**
 * The part of a cow that moves: neck, head, horns.
 *   lift   0 = head carried low and forward, 1 = neck raised, alert
 *   pitch  angle of the muzzle below the horizontal, radians
 *   yaw    0 = looking ahead, PI = looking back over its shoulder. In between
 *          the head is seen turning, so it foreshortens.
 */
function cowHead(cow, lift, pitch, yaw) {
  const T = placer(cow.x, cow.y, cow.len, cow.facing);
  const neckA = lerp(0.22, -1.05, lift); // neck direction, from forward-low to up
  const headC = [COW_NECK[0] + Math.cos(neckA) * 0.19, COW_NECK[1] + Math.sin(neckA) * 0.19];
  const turn = Math.cos(yaw); // 1 ahead, -1 back
  const squash = Math.sign(turn || 1) * Math.max(0.28, Math.abs(turn));
  // head-local point: x along the muzzle, y down. Turning mirrors and foreshortens x.
  const H = (pt) => T(rotAbout([headC[0] + pt[0] * squash, headC[1] + pt[1]], headC, pitch * Math.sign(squash)));
  const nx = Math.cos(neckA + Math.PI / 2) * 0.062;
  const ny = Math.sin(neckA + Math.PI / 2) * 0.062;
  const neck = [
    [COW_NECK[0] - 0.07, COW_NECK[1] - 0.07],
    [COW_NECK[0] + 0.03, COW_NECK[1] + 0.095],
    [headC[0] + nx, headC[1] + ny],
    [headC[0] - nx, headC[1] - ny],
  ].map(T);
  const head = smoothClosed(
    [
      [-0.06, 0.076],
      [0.15, 0.058],
      [0.25, 0.016],
      [0.19, -0.04],
      [-0.04, -0.08],
      [-0.095, 0.0],
    ],
    4,
  ).map(H);
  // lyre horns, shown from the front as the painters always showed them
  const spread = cow.len < 70 ? 0.45 : 1;
  const P = (x, y, pr) => {
    const q = T([headC[0] + x, headC[1] + y]);
    q.push(pr);
    return q;
  };
  const horns = [
    [P(-0.035, -0.05, 1.0), P(-0.085 * spread, -0.17 * spread, 1.1), P(-0.15 * spread, -0.3 * spread, 0.85), P(-0.13 * spread, -0.4 * spread, 0.4)],
    [P(0.03, -0.05, 1.0), P(0.085 * spread, -0.17 * spread, 1.1), P(0.15 * spread, -0.3 * spread, 0.85), P(0.13 * spread, -0.4 * spread, 0.4)],
  ];
  return { cow, neck, head, horns, eye: H([0.075, -0.014]), col: coatColors(cow.coat), w: cow.len / 100 };
}

/**
 * Paint the whole herd's heads. p5.brush composites each time the colour or
 * the kind of mark changes, so the heads are painted colour by colour rather
 * than cow by cow: a handful of passes instead of dozens.
 */
function paintHerdHeads(pen, stage, heads) {
  for (const body of [C.red, C.ochre, C.white]) {
    const group = heads.filter((h) => h.col.body === body);
    if (!group.length) continue;
    stage.reseed(2100 + body.charCodeAt(2));
    pen.reset().fill(body, 228, { bleed: 0.03, texture: 0.6, border: 0.3 });
    for (const h of group) {
      pen.polygon(h.neck);
      pen.polygon(h.head);
    }
    pen.noFill();
  }
  // the white cow's face is outlined in red
  stage.reseed(2201);
  for (const h of heads) {
    if (h.col.body !== C.white) continue;
    pen.reset().set("rock-dry", C.red, 1.0 * h.w);
    pen.polygon(h.head);
  }
  // everything dark in one go: outlines, horns, the white cow's eye
  stage.reseed(2202);
  pen.reset();
  for (const h of heads) {
    if (h.col.body !== C.white) {
      pen.set("rock-dry", C.dark, 1.0 * h.w);
      pen.polygon(h.head);
    }
  }
  for (const h of heads) {
    pen.set("rock-finger", C.dark, 2.0 * h.w);
    pen.spline(h.horns[0], 0.7);
    pen.spline(h.horns[1], 0.7);
    if (h.col.body === C.white) {
      pen.set("rock-finger", C.dark, 1.3 * h.w);
      pen.line(h.eye[0], h.eye[1], h.eye[0] + 0.5, h.eye[1]);
    }
  }
  // pale eyes on the dark faces
  stage.reseed(2203);
  for (const h of heads) {
    if (h.col.body === C.white) continue;
    pen.set("rock-finger", C.white, 1.3 * h.w);
    pen.line(h.eye[0], h.eye[1], h.eye[0] + 0.5, h.eye[1]);
  }
}

// ------------------------------------------------------------------ herders
// Local units: height 1, feet on y = 0, facing right.
const HERDERS = [
  { x: 168, y: 612, h: 104, kind: "staff", color: "red", facing: 1, seed: 31 },
  // the child and the white herder stand high enough that nothing of them is
  // below y 563, where the pelican's head (top at about 572) passes
  { x: 214, y: 563, h: 66, kind: "child", color: "ochre", facing: 1, seed: 32 },
  // his free arm goes up rather than reaching down across the date line
  { x: 505, y: 563, h: 100, kind: "staff", color: "white", facing: 1, seed: 33, armUp: true },
  // up among the herd (and as high as the two above), so that the pelican
  // rides under him at the exit, not through him
  { x: 956, y: 563, h: 96, kind: "child", color: "red", facing: -1, seed: 35 },
];

function paintHerderBody(pen, stage, hd) {
  const T = placer(hd.x, hd.y, hd.h, hd.facing);
  const color = hd.color === "white" ? C.white : hd.color === "ochre" ? C.ochre : C.red;
  const line = hd.color === "white" ? C.red : color;
  const w = hd.h / 110;
  stage.reseed(hd.seed * 131 + 1);
  const seated = hd.kind === "seated";

  pen.reset().set("rock-finger", line, 2.3 * w);
  if (seated) {
    pen.spline([T([-0.02, -0.34, 1.3]), T([0.2, -0.36, 1.1]), T([0.22, -0.02, 0.8])], 0.6);
    pen.spline([T([0.0, -0.3, 1.3]), T([0.14, -0.2, 1.1]), T([0.3, 0.0, 0.8])], 0.6);
  } else {
    pen.spline([T([0.025, -0.5, 1.4]), T([0.1, -0.26, 1.1]), T([0.07, 0, 0.75])], 0.5); // leading leg
    pen.spline([T([-0.025, -0.5, 1.4]), T([-0.09, -0.27, 1.1]), T([-0.16, 0, 0.75])], 0.5); // trailing leg
  }
  // torso: narrow hips, broad shoulders
  const top = seated ? -0.72 : -0.84;
  const hip = seated ? -0.32 : -0.48;
  pen.noStroke().fill(color, 215, { bleed: 0.05, texture: 0.6, border: 0.3 });
  pen.polygon(
    smoothClosed(
      [
        [-0.075, hip],
        [0.075, hip],
        [0.115, (hip + top) / 2],
        [0.165, top + 0.02],
        [0.0, top - 0.025],
        [-0.165, top + 0.02],
        [-0.115, (hip + top) / 2],
      ],
      4,
    ).map(T),
  );
  pen.noFill();
  if (hd.color === "white") {
    pen.set("rock-dry", line, 0.8 * w);
    pen.spline([T([-0.165, top + 0.02]), T([-0.115, (hip + top) / 2]), T([-0.075, hip])], 0.4);
    pen.spline([T([0.165, top + 0.02]), T([0.115, (hip + top) / 2]), T([0.075, hip])], 0.4);
  }
  // the arm that does not move, and what it holds
  pen.set("rock-finger", line, 1.7 * w);
  if (hd.kind === "staff" || hd.kind === "child") {
    pen.spline([T([0.14, top + 0.04]), T([0.21, top + 0.2, 1.1]), T([0.27, top + 0.3])], 0.5);
    pen.set("rock-finger", C.dark, 1.0 * w);
    pen.line(...T([0.27, top - 0.04]), ...T([0.29, 0.0]));
  } else if (hd.kind === "bow") {
    pen.spline([T([0.12, top + 0.04]), T([0.24, top + 0.1, 1.1]), T([0.34, top + 0.14])], 0.5);
    pen.set("rock-dry", C.dark, 1.0 * w);
    pen.spline([T([0.3, top - 0.16]), T([0.42, top + 0.14, 1.2]), T([0.3, top + 0.44])], 0.8);
    pen.line(...T([0.3, top - 0.16]), ...T([0.3, top + 0.44]));
  } else {
    pen.spline([T([0.12, top + 0.04]), T([0.2, top + 0.2, 1.1]), T([0.16, top + 0.36])], 0.5);
  }
  pen.flush();
}

/** Head and free arm of a herder. attention 0..1; dir = unit vector towards the pelican. */
function herderHead(hd, attention, dir) {
  const T = placer(hd.x, hd.y, hd.h, 1);
  const top = hd.kind === "seated" ? -0.72 : -0.84;
  // the head leans a little towards what it is looking at
  const rest = [hd.facing * 0.025, top - 0.1];
  const hc = [rest[0] + dir[0] * 0.035 * attention, rest[1] + dir[1] * 0.02 * attention];
  const gx = lerp(hd.facing, dir[0], attention);
  // the free arm rises to point
  const sh = [-hd.facing * 0.14, top + 0.04];
  const hang = [sh[0] - hd.facing * 0.05, sh[1] + 0.3];
  // an arm that goes up points up and towards the pelican's side, clear of the title below it
  const rd = hd.armUp ? [dir[0] * 0.5, -0.87] : dir;
  const reach = [sh[0] + rd[0] * 0.33, sh[1] + rd[1] * 0.33];
  const lift = hd.kind === "child" ? 1 : 0.85;
  const hand = [lerp(hang[0], reach[0], attention * lift), lerp(hang[1], reach[1], attention * lift)];
  const elbow = [(sh[0] + hand[0]) / 2 - hd.facing * 0.03 * (1 - attention), (sh[1] + hand[1]) / 2 + 0.05 * (1 - attention)];
  const color = hd.color === "white" ? C.white : hd.color === "ochre" ? C.ochre : C.red;
  return {
    hd,
    color,
    line: hd.color === "white" ? C.red : color,
    w: hd.h / 110,
    centre: T(hc),
    r: 0.078 * hd.h,
    tuft: [T([hc[0] - gx * 0.05, hc[1] - 0.05]), T([hc[0] - gx * 0.11, hc[1] - 0.13])],
    arm: [T(sh), [...T(elbow), 1.1], T(hand)],
  };
}

function paintHerderHeads(pen, stage, list) {
  for (const color of [C.red, C.ochre, C.white]) {
    const group = list.filter((h) => h.color === color);
    if (!group.length) continue;
    stage.reseed(2300 + color.charCodeAt(2));
    pen.reset().wash(color, 238);
    for (const h of group) pen.circle(h.centre[0], h.centre[1], h.r, 0.35);
    pen.noWash();
  }
  for (const color of [C.red, C.ochre]) {
    stage.reseed(2320 + color.charCodeAt(2));
    pen.reset();
    for (const h of list) {
      if (h.line !== color) continue;
      pen.set("rock-finger", color, 1.7 * h.w);
      pen.spline(h.arm, 0.5);
      if (h.color === C.white) {
        pen.set("rock-dry", color, 0.8 * h.w);
        pen.circle(h.centre[0], h.centre[1], h.r, 0.3);
      }
    }
  }
  stage.reseed(2340);
  pen.reset();
  for (const h of list) {
    // a tuft of hair or a feather, always pointing away from the gaze
    pen.set("rock-finger", C.dark, 1.0 * h.w);
    pen.line(h.tuft[0][0], h.tuft[0][1], h.tuft[1][0], h.tuft[1][1]);
  }
}

// ------------------------------------------------------------------ everything that holds still
function paintOldLayer(pen, stage) {
  // paintings from an earlier age, almost gone: antelope, a row of marks
  stage.reseed(701);
  pen.reset();
  const ghosts = [
    { x: 230, y: 690, len: 70, f: -1 },
    { x: 705, y: 770, len: 60, f: 1 },
    { x: 990, y: 520, len: 84, f: -1 },
    { x: -120, y: 560, len: 90, f: 1 },
    { x: 1230, y: 590, len: 96, f: -1 },
  ];
  for (const g of ghosts) {
    const T = placer(g.x, g.y, g.len, g.f);
    pen.noStroke().fill(C.faded, 70, { bleed: 0.1, texture: 0.8, border: 0.1 });
    pen.polygon(COW_BODY.map((p) => T([p[0] * 0.9, p[1] * 0.8 - 0.12])));
    pen.noFill();
    pen.set("rock-dry", C.faded, 0.9);
    for (const leg of COW_LEGS) pen.spline(leg.map((p) => T([p[0] * 0.9, p[1] * 1.25])), 0.5);
    pen.spline([T([0.42, -0.6]), T([0.56, -0.86, 1]), T([0.6, -1.02])], 0.5); // long neck
  }
  pen.flush();
}

function paintSigns(pen, stage) {
  stage.reseed(801);
  pen.reset();
  // a hut: an oval with a doorway, hatched with a dry stick
  pen.set("rock-finger", C.red, 1.3);
  pen.polygon(blob(92, 578, 46, 33, 0.08, 5, 12));
  pen.set("rock-dry", C.red, 0.9);
  for (let i = 0; i < 7; i += 1) pen.line(60 + i * 10, 560 + (i % 2) * 3, 56 + i * 10, 598 - (i % 3) * 3);
  // rows of finger dots: above the herd and below the road
  pen.noStroke();
  const dots = (x0, x1, y, step, color, r, wave) => {
    pen.wash(color, 225);
    for (let x = x0; x <= x1; x += step) pen.circle(x, y + Math.sin(x * 0.045) * wave + (hash(Math.round(x), 4) - 0.5) * 1.6, r * (0.85 + 0.3 * hash(Math.round(x), 9)), 0.4);
    pen.noWash();
  };
  dots(548, 946, 447, 13, C.red, 2.6, 2);
  dots(554, 940, 456, 13, C.white, 2.1, 2);
  dots(-420, 1420, 742, 16, C.dark, 2.3, 2.5);
  dots(-412, 1420, 754, 16, C.ochre, 2.0, 2.5);
  pen.flush();
  // a spiral and a sun sign
  pen.set("rock-finger", C.ochre, 1.2);
  const spiral = [];
  for (let a = 0; a < Math.PI * 5; a += 0.35) spiral.push([1090 + Math.cos(a) * (3 + a * 2.1), 520 + Math.sin(a) * (3 + a * 2.1)]);
  pen.spline(spiral, 0.8);
  pen.set("rock-finger", C.white, 1.2);
  pen.circle(268, 772, 9, 0.5);
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * Math.PI * 2;
    pen.line(268 + Math.cos(a) * 13, 772 + Math.sin(a) * 13, 268 + Math.cos(a) * 19, 772 + Math.sin(a) * 19);
  }
  pen.flush();
}

function paintRoad(pen, stage) {
  // the track the pelican rides: a ledge in the rock picked out in ochre
  stage.reseed(901);
  pen.reset().set("rock-finger", C.dark, 1.9);
  const pts = [];
  for (let x = WALL.x0; x <= WALL.x1; x += 40) pts.push([x, ROAD_Y + 2.2 + Math.sin(x * 0.021) * 0.5]);
  pen.spline(pts, 0.4);
  pen.set("rock-dry", C.red, 1.2);
  pen.spline(
    pts.map((p) => [p[0] + 9, p[1] + 6.5 + Math.sin(p[0] * 0.05) * 0.6]),
    0.4,
  );
  pen.flush();
}

/** The title, painted on the rock like everything else. Returns nothing; draws into the current target. */
function paintTitle(stage, view) {
  const os = view.k; // lettering is rasterised at the wall's own resolution
  const box = { x: 236, y: 446, w: 268, h: 104 };
  const layer = sprite(stage, `sahara/title/${os.toFixed(3)}`, box.w * os, box.h * os, (ctx) => {
    ctx.scale(os, os);
    ctx.filter = "blur(0.35px)";
    drawText(ctx, META.zh, box.w / 2, 37, { font: font(FONTS.baoli, 35, 400), align: "center", fill: "#000", spacing: 3 });
    drawText(ctx, META.en.toUpperCase(), box.w / 2, 63, { font: font(FONTS.rough, 15.5, 400), align: "center", fill: "#000", spacing: 1.2 });
    drawText(ctx, `${META.date} · ${META.dateEn}`, box.w / 2, 88, { font: font(FONTS.weibei, 14.5, 400), align: "center", fill: "#000", spacing: 0.6 });
  });
  stage.withView(view, () => {
    drawPigmentMask(stage, layer, box.x, box.y, box.w, box.h, { color: C.red, color2: C.dark, alpha: 0.96, rough: 0.34, scale: 1.5, mottle: 0.5 });
  });
}

function bakeWall(stage) {
  const k = WALL_PX * stage.s;
  const w = (WALL.x1 - WALL.x0) * k;
  const h = (WALL.y1 - WALL.y0) * k;
  return stage.bake(`sahara/wall/${k.toFixed(3)}`, w, h, () => {
    const view = new View(k, -WALL.x0 * k, -WALL.y0 * k);
    drawRock(stage, view, WALL, 0);
    stage.seed(4000);
    withPen(stage, view, (pen) => {
      paintOldLayer(pen, stage);
      paintSigns(pen, stage);
      paintRoad(pen, stage);
      for (const hd of HERDERS) paintHerderBody(pen, stage, hd);
      // back row first
      for (const cow of [...CATTLE].sort((a, b) => a.y - b.y)) paintCowBody(pen, stage, cow);
    });
    paintTitle(stage, view);
  });
}

/** Bare rock where paint has worn away, as its own cached layer: it goes over old and new paint alike. */
function bakeWear(stage) {
  const k = WALL_PX * stage.s;
  return stage.bake(`sahara/wear/${k.toFixed(3)}`, (WALL.x1 - WALL.x0) * k, (WALL.y1 - WALL.y0) * k, () => {
    drawRock(stage, new View(k, -WALL.x0 * k, -WALL.y0 * k), WALL, 0.9);
  });
}

// ------------------------------------------------------------------ the pelican, as a rock painting
const BIKE_LINES = new Set(["tire", "frame", "post", "bar", "grip", "crank", "chain"]);

function paintPelican(pen, stage, skel) {
  const u = skel.scale / 21.2; // line weights follow the puppet's size
  const shapes = skel.shapes;
  const draw = (sh) => {
    if (sh.kind === "circle") pen.circle(sh.c[0], sh.c[1], sh.r, 0.25);
    else if (sh.pts.length === 2) pen.line(sh.pts[0][0], sh.pts[0][1], sh.pts[1][0], sh.pts[1][1]);
    else if (sh.closed) pen.polygon(sh.pts);
    else pen.spline(sh.pts, 0.4);
  };
  const each = (test, fn) => {
    for (const sh of shapes) if (test(sh)) fn(sh);
  };
  const is = (...tags) => (sh) => tags.includes(sh.tag);

  // 1. the far leg and the whole machine, in burnt ochre: one pass of line
  stage.reseed(5101);
  pen.reset();
  each((sh) => sh.tag === "leg" && sh.side === "far", (sh) => {
    pen.set("rock-finger", C.dark, 1.45 * u);
    draw(sh);
  });
  let spoke = 0;
  each(is("spoke"), (sh) => {
    // six spokes, like the chariot wheels painted on these same rocks
    spoke += 1;
    if ([1, 3, 4, 6, 8, 9].includes(spoke % 10)) {
      pen.set("rock-dry", C.dark, 0.7 * u);
      draw(sh);
    }
  });
  each((sh) => BIKE_LINES.has(sh.tag), (sh) => {
    pen.set("rock-finger", C.dark, (sh.tag === "frame" || sh.tag === "tire" ? 1.45 : 0.95) * u);
    draw(sh);
  });
  // 2. its solid parts, the far foot, the tail
  stage.reseed(5102);
  pen.reset().wash(C.dark, 238);
  each((sh) => ["hub", "saddle", "tail"].includes(sh.tag) || ((sh.tag === "foot" || sh.tag === "pedal") && sh.side === "far"), draw);
  pen.noWash();
  // 3. the near leg and foot in red ochre
  stage.reseed(5103);
  pen.reset();
  each((sh) => sh.tag === "leg" && sh.side !== "far", (sh) => {
    pen.set("rock-finger", C.red, 1.45 * u);
    draw(sh);
  });
  pen.reset().wash(C.red, 236);
  each((sh) => (sh.tag === "foot" || sh.tag === "pedal") && sh.side !== "far", draw);
  // 4. the bird in kaolin
  stage.reseed(5104);
  pen.reset().wash(C.white, 244);
  each(is("body", "neck", "head"), draw);
  // 5. bill and pouch in yellow ochre
  pen.reset().wash("#d39a3f", 240);
  each(is("pouch"), draw);
  pen.reset().wash(C.ochre, 244);
  each(is("bill"), draw);
  // 6. the wing, its dark flight feathers, the eye
  stage.reseed(5105);
  pen.reset().wash(C.dark, 238);
  each((sh) => sh.tag === "wingtip" && sh.id.startsWith("wingTip"), draw);
  pen.reset().wash("#d9bf9a", 236);
  each(is("wing"), draw);
  pen.reset().wash(C.dark, 238);
  each((sh) => sh.tag === "wingtip" && !sh.id.startsWith("wingTip"), draw);
  pen.reset().wash(C.soot, 250);
  each(is("pupil"), (sh) => pen.circle(sh.c[0], sh.c[1], sh.r * 1.25, 0.2));
  pen.noWash();
  // 7. one contour in red ochre holds the white bird together
  stage.reseed(5106);
  pen.reset();
  each(is("wing"), (sh) => {
    pen.set("rock-dry", C.red, 0.75 * u);
    pen.polygon(sh.pts);
  });
  each(is("wingfold"), (sh) => {
    pen.set("rock-dry", C.red, 0.7 * u);
    pen.spline(sh.pts, 0.4);
  });
  each(is("body", "neck", "head", "bill", "pouch"), (sh) => {
    pen.set("rock-dry", C.red, 0.85 * u);
    pen.polygon(sh.pts);
  });
}

// ------------------------------------------------------------------ who looks, and when
/** How firmly a figure at world x has noticed the pelican (0..1). */
// lead: how far ahead of the pelican (world units) a figure begins to notice it
function attentionAt(x, px, delay, lead = 330) {
  if (px < -40) return 0;
  return smoothstep(-lead + delay, -lead + 80 + delay, px - x) * smoothstep(-40, 30, px);
}
// The cattle notice later than the herders: exactly one second later (the
// pelican's 1000 / 6 units), so that each head begins to lift in plain view,
// 157 to 236 units ahead of the pelican, with the stagger kept.
const CATTLE_LEAD = 330 - 1000 / 6;

export const sahara = {
  ...META,
  // for the gallery wall: the herd watching, with the painted title out of the crop
  still: { u: 4.4 },

  init(stage) {
    // a finger loaded with wet ochre: a soft, full line
    defineBrush(stage, "rock-finger", { type: "default", weight: 0.75, scatter: 0.42, sharpness: 0.62, grain: 1.5, opacity: 205, spacing: 0.045, pressure: [0.8, 1.1, 0.72], rotate: "natural", noise: 0.35 });
    // a frayed stick, nearly dry: broken, sandy
    defineBrush(stage, "rock-dry", { type: "default", weight: 0.42, scatter: 1.15, sharpness: 0.72, grain: 2.1, opacity: 165, spacing: 0.05, pressure: [1.0, 0.85], rotate: "natural", noise: 0.5 });
    FONTS.baoli = "'Baoli SC', 'Libian SC', 'Weibei SC', 'Kaiti SC', serif";
    FONTS.weibei = "'Weibei SC', 'Baoli SC', 'Kaiti SC', serif";
    FONTS.rough = "'Chalkduster', 'Skia', 'Marker Felt', sans-serif";
    bakeWall(stage);
    bakeWear(stage);
  },

  render(stage, f) {
    const { p } = stage;
    const view = f.view;
    const wall = bakeWall(stage);

    // rock beyond the painted stretch, for wide or unusual views
    stage.origin();
    stage.rect(0, 0, f.w, f.h, [196, 150, 106]);
    stage.withView(view, () => {
      stage.image(wall, WALL.x0, WALL.y0, WALL.x1 - WALL.x0, WALL.y1 - WALL.y0);
    });

    const pel = f.pelican;
    const skel = solveRig({ ...pel, act: { wind: 0.9 } });
    const target = [skel.joints.head[0], skel.joints.head[1]];

    stage.seed(4100);
    withPen(stage, view, (pen) => {
      const heads = CATTLE.map((cow) => {
        const pivot = placer(cow.x, cow.y, cow.len, cow.facing)(COW_NECK);
        const a = attentionAt(cow.x, pel.x, (hash(cow.seed, 77) - 0.5) * 70, CATTLE_LEAD);
        const dx = target[0] - pivot[0];
        const dy = target[1] - pivot[1];
        // walking: head low, nodding. watching: neck up, and the head swings
        // from over the shoulder to straight ahead as the pelican goes by
        const nod = 0.2 + 0.08 * Math.sin(f.t * 3.1 + cow.seed * 1.7);
        const yaw = a * Math.PI * (1 - smoothstep(-55, 55, dx));
        const pitch = lerp(nod, clamp(Math.atan2(dy, Math.max(Math.abs(dx), 55)), 0, 0.85), a);
        return cowHead(cow, a * 0.85, pitch, yaw);
      });
      paintHerdHeads(pen, stage, heads);
      const people = HERDERS.map((hd) => {
        const head = [hd.x, hd.y - hd.h * 0.9];
        const dx = target[0] - head[0];
        const dy = target[1] - head[1];
        const d = Math.hypot(dx, dy) || 1;
        const a = attentionAt(hd.x, pel.x, (hash(hd.seed, 78) - 0.5) * 60) * (pel.visible ? 1 : 0);
        return herderHead(hd, a, [dx / d, dy / d]);
      });
      paintHerderHeads(pen, stage, people);
      pen.flush();
      if (pel.visible) paintPelican(pen, stage, skel);
    });

    // last: bare rock where the paint has worn through, over old and new alike
    const wear = bakeWear(stage);
    stage.withView(view, () => {
      stage.image(wear, WALL.x0, WALL.y0, WALL.x1 - WALL.x0, WALL.y1 - WALL.y0);
    });
    p.noStroke();
  },
};
