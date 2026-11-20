# Scene guide

How to paint one section of *The Pelican Test*. Read this once, then your
section's art brief (`briefs/NN-id.md`), then the three finished scenes as
worked examples:

| Example | What it shows |
|---|---|
| `src/scenes/sahara.js` (Section 1) | A shader ground, a wall painted once with p5.brush, a few parts repainted per frame, a wear pass on top |
| `src/scenes/shortvideo.js` (Section 19) | Everything on 2D canvases: baked strips, parallax, a per-frame interface layer |
| `src/scenes/song.js` (Section 5) | The shared ink system, sheets at several levels of detail, a scene camera in bar 2 |
| `src/scenes/placeholder.js` | The smallest complete scene |

The owner's full brief is `briefs/PROJECT_BRIEF.md`. It is the source of truth.

## 1. What a scene is

The film is one tracking shot along a gallery wall. Twenty paintings hang side
by side; a pelican on a bicycle rides through all of them along one road. Each
painting is a *scene*: one JavaScript file that can draw its painting, with
the pelican in it, for any moment in time. The engine cuts neighbouring scenes
together along the picture frames, moves the camera and keeps time.

Your scene never decides *where* the pelican is or *when* things happen in the
film. It is handed a time and a pose, and paints.

## 2. The numbers

**Time.** 120 BPM, a bar is 2 s, a beat 0.5 s. A section lasts three bars
(6 s). `u` is seconds since the pelican entered your painting.

| Bar | u | What happens |
|---|---|---|
| 1 | 0 – 2 | Entrance. The entry frame is still on screen until u ≈ 1.9. |
| 2 | 2 – 4 | The joke or highlight. No picture frame is on screen. Strong beats: u = 2.0 and 3.0. |
| 3 | 4 – 6 | Ride to the next frame, which comes into view from u ≈ 4.1. |

Your scene is also drawn before and after its own six seconds, whenever part
of its painting is on screen: from about u = −2.1 to u = 8.1. Everything you
animate must be defined for that whole range and must not pop at u = 0 or 6.

**Space.** World units, y down. Your section is x = 0 … 1000.

| Thing | Value |
|---|---|
| Road (where the wheels touch) | y = 700 |
| Picture area (inside the frame) | x 18 … 982, y 433.2 … 786.2 (964 × 353) |
| Pelican speed | 166.67 units/s: one section in 6 s |
| Wheel radius | 21.2 |
| Pelican and bicycle, relative to its road point | x −69 … +65, y −134 … 0 |
| Head centre / top of head | about 119 / 128 above the road |
| Screen scale at 1080p | 2.88 px per unit at zoom 1; 3.17 at zoom 1.1 |
| What the camera sees | 606 × 341 units at zoom 1.1; 667 × 375 at zoom 1 |
| Visible y range | 439 … 780 at zoom 1.1; the whole picture height at zoom 1 |

**Camera.** It keeps the pelican's road point on the centre column, with the
road at 74 % of the screen height. It pushes in to zoom 1.1 as the pelican
passes through a frame (from 0.25 s before to 0.4 s after), holds 1.1 through
bars 1 and 2, and eases back to 1 between u = 4.2 and 5.7 so the next frame
shows in full. Because the camera follows the pelican, **the pelican is always
in the middle of the screen and the world slides past it** at 480 px/s.

**What must be painted.** Paint x −60 … 1060 and y 420 … 800 so no edge ever
shows. A scene that moves its own camera in bar 2 must paint whatever that
camera can see.

## 3. The scene object

```js
import { sectionMeta } from "./sections.js";
const META = sectionMeta(7);          // { n, id, zh, en, date, dateEn, color }

export const maya = {
  ...META,
  init(stage) { /* optional: register brushes, bake layers */ },
  render(stage, f) { /* draw one whole frame into the current target */ },

  // optional
  still: { u: 3.2 },                  // the moment frozen on the gallery wall
  motion(u) { return { x, turns }; }, // slow down or stop in bar 2
  camera(u) { return { dx, dy, zoom }; }, // move the camera, bar 2 only
  road(x) { return y; },              // a hill or a bridge
  poseHz: 10,                         // stepped pose: 8-12 for jerky retro motion
};
```

The export name is your section's id and must not change.

`render(stage, f)` receives:

| Field | Meaning |
|---|---|
| `f.u` | seconds since the entry crossing (see the range above) |
| `f.t` | film time in seconds; `f.bar = u / 2`, `f.beat = u / 0.5` |
| `f.view` | maps world units to target pixels: `view.x(wx)`, `view.y(wy)`, `view.k` (pixels per unit), `view.wx(px)`, `view.bounds(w, h)` |
| `f.w`, `f.h` | size of the target in pixels. Not always 16:9: the gallery still is square. |
| `f.s` | pixels per 1080p pixel (1 at 1920 wide, 0.5 at 960) |
| `f.pelican` | `{ x, y, slope, crank, wheel, time, speed, scale, visible }` in your world units |
| `f.still` | true while the gallery still is being rendered |
| `f.film` | the film; `f.film.pelicanFor(f.n, t)` gives the pelican at another time |

Fill the whole target with opaque paint. Anything left transparent shows the
gallery wall through it.

**Optional overrides**

- `motion(u)` → `{ x, turns }` for 0 < u < 6. `x` must run from 0 to 1000,
  never backwards, and pass both ends at the standard speed (166.67 units/s).
  `turns` is pedal revolutions since entry and defaults to `x / 166.67`; if you
  set it yourself it must reach 6 at u = 6, at one turn per second.
- `camera(u)` → `{ dx, dy, zoom }`, applied only for 2 < u < 4, and it must be
  neutral (0, 0, 1) at both ends of that bar.
- `road(x)` → road height. Within 100 units of each picture frame (x ≤ 100
  and x ≥ 900) it must be level and at the same height as the neighbouring
  section's road: 700, unless your brief gives another figure. The engine
  tilts the bicycle to the slope, which may not exceed 1 in 2.
- `poseHz` steps the pelican's pose (crank, wheel, secondary motion) at that
  rate. Its position stays smooth, so the camera never stutters.

`node tools/check.mjs` tests these contracts. It must pass.

## 4. Rules that cannot bend

### 4.1 Every frame is a pure function of time

The film is scrubbed, rendered out of order and rendered by several browsers
at once. Two renders of the same time must be **byte-identical**.

- No `Math.random()`, `Date`, `performance.now()`, `p.frameCount`,
  `p.millis()`, or unseeded `p.random()` / `p.noise()`. Use `kit/rng.js`
  (`rng`, `sampler`, `hash`, `noise1`, `noise2`, `fbm2`, `wobble`).
- No state carried from one frame to the next. No feedback buffers. A trail,
  an afterglow, a counter, a typed line of text: compute each from `f.u`.
- Before any p5.brush work in a bake or a frame call `stage.seed(n)`, and
  `stage.reseed(n)` between its parts, so every part keeps its own grain.
- Get every 2D canvas from the stage (`stage.layer`, `stage.patch`,
  `stage.bake2d`, `sprite`, or `new Layer2D(stage.p, w, h)`). Never call
  `document.createElement("canvas")`: GPU canvases do not rasterise text
  the same way twice.
- Caches are fine when the key holds everything that changes the pixels
  (include `stage.s` or the pixel scale in bake keys, as the examples do).

- The gallery still is rendered at another size and at an unpredictable
  moment. It must not depend on what was drawn before it, and frames drawn
  after it must not change. Set every drawing property you rely on in the
  frame that uses it.

`node tools/check.mjs --purity --section N` proves it for your section,
including its still on the gallery wall.

### 4.2 The pelican is continuous

Both neighbours draw the same puppet from the same pose, each in its own
style, and the frame hides the join. So:

- For **u < 0.6 and u > 5.4** draw the puppet exactly from `f.pelican`:
  true position, crank, wheel angle and slope, standard proportions, quiet
  acting. No jumps, stretches, flips or poses there.
- Between those times you may re-pose, stretch, displace or transform it if
  your brief says so, easing in and out.
- It must read as *a pelican on a bicycle* in your style at a glance: the
  long bill and pouch, the neck, two wheels, pedalling legs. One pedal turn
  per second, a pedal forward on every beat; the engine provides this.
- Do not let scenery hide it for more than a moment, and never its head.
- Keep its path clear. Whatever crosses y 560 – 705 must be something the
  pelican plainly passes in front of or behind, never something it could
  merge with; and no second moving figure may share the pelican's position
  on a bar-2 beat.
- Skip it when `f.pelican.visible` is false.

### 4.3 The title card

Every section shows its Chinese name, English name and date, **in the
materials and lettering of its own era**, as part of the painting. Not a
caption, not a museum label, not a subtitle.

- Take the words from `META` (`zh`, `en`, `date`, `dateEn`). You may set the
  date in period style as long as the year stays readable.
- Readable at 1080p, measured on screen at zoom 1.1 and not by font size:
  the Chinese name at least 44 px tall, and the capital letters and digits
  of every other line at least 26 px tall (about 12.5 units of font size
  for most faces). Real contrast, for the whole time it is in view.
- On screen in full for at least 2 seconds. A title fixed in the world may be
  at most 270 units wide for that; one that travels with the pelican is
  always in view.
- Keep it clear of the pelican and of the bar-2 action.

### 4.4 Rights

- Homage only to works in the public domain. Rebuild the manner; never trace
  or reproduce a specific composition.
- Interfaces, apps, games, brands, account names, icons, mascots and sounds
  are all invented. Nothing may resemble a real product's logo, mascot,
  character, level or interface.
- No external assets: no images, fonts, audio or network requests. Everything
  is drawn by code. Fonts are macOS system fonts, named in CSS (§6.6).
- The reference project named in the owner's brief is off limits. Do not open
  it, its briefs, code or media. Design independently.

### 4.5 Humour

Deadpan. The joke is a calm, well-made picture of something absurd. Never a
badly drawn picture, never a wink at the audience, no text that explains it.
Each era gives its best, sincere answer.

### 4.6 Your files

You may change only:

- `src/scenes/<id>.js` (your scene; replace the placeholder wholesale)
- `src/rig/skins/<id>.js` (optional, if your skin is large)
- `dev/experiments/<id>-*.js` (optional lab experiments)
- your own brief: append a short `## As built` section when you finish

Do not edit `src/kit`, `src/rig/rig.js`, `src/main`, `src/beat`, `tools`,
other scenes or `index.js`. If the kit lacks something, write it in your scene
file and list it under "Kit requests" in your report. No new dependencies, no
`npm install`, no git commands, no dev server on a fixed port (the tools start
their own).

## 5. Painting things that move, and things that travel

**Bake what holds still.** Paint the static world once into a cached layer
(`stage.bake`, `stage.bake2d`) at about 3.3 pixels per unit, and draw that
layer every frame. Repaint per frame only what moves.

**Texture travels with its object.** Grain, noise or dither on something that
moves across the world must be anchored to that thing's own coordinates. Grain
anchored to the world will swim across a moving figure.

**Things that travel with the pelican.** Some sections need an interface or an
instrument that stays around the pelican (a window, a screen, a heads-up
display). Treat it as *world content whose anchor is `f.pelican.x`*: lay it
out in world units relative to the pelican's road point and draw it through
`f.view`. Then it sits still on screen during the tracking shot, zooms with
the camera like the rest of the painting, is cut correctly by the picture
frames, and is centred in the square gallery still, with no special cases. Do
not lay such things out from `f.w` and `f.h`.

**Parallax.** A layer at depth `p` (0 = infinitely far, 1 = the road) is
drawn through a view shifted so it moves `p` times as fast as the world; see
`shortvideo.js`. Keep the road plane itself at depth 1.

**Stepped animation.** For on-twos or jerky motion quantise *your own*
animation clock (`stepTime(f.u, hz)` from `beat/timeline.js`), never the
camera or the pelican's position.

## 6. The toolkit

All paths are under `src/`.

### 6.1 Stage (`kit/stage.js`)

```js
stage.p                      // the p5 instance (WEBGL, instance mode)
stage.origin()               // target pixels, origin top-left
stage.withView(view, fn)     // world units inside fn
stage.rect(x, y, w, h, color)            // "#rrggbb" or [r, g, b, a]
stage.image(src, x, y, w, h, alpha)      // framebuffer or 2D layer
stage.imagePart(src, dx, dy, dw, dh, sx, sy, sw, sh, alpha)
stage.blend(stage.p.MULTIPLY, fn)        // also ADD, SCREEN

stage.bake(key, w, h, () => { ... })     // GPU layer, painted once
stage.bake2d(key, w, h, (ctx) => { ... })// the same from a 2D canvas
stage.layer(key, w, h)       // a persistent 2D canvas: .ctx, .clear(), .touch()
stage.patch(key, view, x0, y0, x1, y1)   // a per-frame 2D canvas over a world rectangle;
stage.imagePatch(patch)                  //   patch.ctx is already in world units
stage.fb(key, w, h); stage.into(fb, fn)  // a scratch framebuffer and drawing into it
stage.shader(key, VERT, frag); stage.shaderRect(sh, uniforms, x, y, w, h)
stage.seed(n); stage.reseed(n); stage.flush()
```

`View` is exported too: `new View(k, tx, ty)`, `View.fit(x, y, w, targetW)`.
A bake's view is usually `new View(k, -x0 * k, -y0 * k)` with
`k = 3.3 * stage.s`.

### 6.2 The puppet (`rig/rig.js`)

```js
const skel = solveRig({ ...f.pelican, act: { wind: 0.9 } });
```

- `skel.shapes`: back-to-front list of `{ id, tag, kind, side }` with
  `kind: "poly"` (`pts`, closed), `"line"` (`pts`, width `w`) or `"circle"`
  (`c`, `r`, optional ring width `w`). `side` is `"far"` or `"near"` on legs,
  feet, cranks and pedals.
- Tags: `leg foot crank pedal tire rim spoke reflector hub frame post bar grip
  bell saddle chain ring tail body neck crest pouch bill head eye pupil lid
  wingtip wing wingfold`.
- `skel.joints`: `rear front bb saddle grip pedalNear pedalFar hip kneeNear
  kneeFar ankleNear ankleFar body shoulder neckBase head eye billBase billTip
  tailRoot wingTip top`, each `[x, y]`.
- `skel.bounds`, `skel.scale` (wheel radius), `skel.neckLine`, `skel.wingLine`.
- `outlines(skel)` gives every outline as a polyline, for line-only styles.
- Acting (`act`): `bob lean neckStretch headPitch headTurn beakOpen pouch eyeX
  eyeY lid wing tail wind`. Defaults and ranges are in `ACT`.
- Pedal revolutions since the pelican set off in the intro:
  `(f.pelican.crank - Math.PI / 2) / (2 * Math.PI) + 1`.

Three ways to skin it:

1. **Flat canvas.** `drawPlain(ctx, skel, { palette, outline, halo })` from
   `rig/skins/plain.js` on a `stage.patch`. Good for vector looks.
2. **Your own canvas skin.** Loop over `skel.shapes`; `traceShape(ctx, sh)`
   from `plain.js` starts the path for any shape.
3. **Brush.** Draw the shapes with a pen; `paintPelican` in `sahara.js` and
   `song.js` are complete examples, grouped by colour.

A skin is a *drawing in your style*, not a recolouring. Redraw the wheels,
the eye, the feathers the way your era would. Add what the style needs. Keep
the silhouette and the motion.

### 6.3 Brushes (`kit/pen.js`, p5.brush)

```js
defineBrush(stage, "maya-reed", { type: "default", weight: 0.5, scatter: 0.4, ... }); // once, in init()
stage.seed(4100);
withPen(stage, view, (pen) => {
  pen.reset().set("maya-reed", "#1c1512", 1.4);   // name, colour, weight at zoom 1
  pen.spline([[x0, y0, 1.2], [x1, y1, 1.0], [x2, y2, 0.4]], 0.5);  // optional pressure per point
  pen.noStroke().fill("#3a9a9a", 220, { bleed: 0.05, texture: 0.6, border: 0.3 }); // watercolour fill
  pen.polygon(points);
  pen.noFill().wash("#efe3cd", 240);              // flat fill
  pen.circle(cx, cy, r, 0.3);
  pen.flush();                                    // composite before an upper layer
});
```

Positions and lengths are world units. Built-in brushes include `2B`, `HB`,
`pen`, `marker`, `charcoal`, `cpencil`, `rotring`, `spray`; parameters are
documented in `node_modules/p5.brush/README.md`.

**Cost.** p5.brush composites its work buffers every time the colour or the
kind of mark (stroke, fill, wash) changes. A frame can afford about six such
changes; a bake can afford hundreds. So bake brushwork wherever possible, and
in per-frame work paint *all the red, then all the white*, not figure by
figure.

### 6.4 Ink (`kit/ink.js`), for Sections 3, 4, 5, 6, 9

These five sections share one ink system and must build on it:

- **Grounds:** `inkGround(stage, view, GROUNDS.xuan | GROUNDS.silk)`, or your
  own preset in the same shape.
- **Tones:** `INK.jiao / nong / zhong / dan / qing` and `inkTone(0..1)`.
  Stay within about ten tones so brush passes stay few.
- **Brushes:** `inkBrush(pen, kind, color, widthInUnits)` or
  `const ink = inkOn(pen)` then `ink.stroke / ink.dab / ink.wash / ink.flat`.
  Kinds: `line` (even upright line), `bone` (loaded contour), `wet`, `dry`
  and `drysoft` (flying white), `scumble`, `leaf`, `dab`.
- **Sheets:** ink is painted on a white sheet (`blankSheet(stage)` inside a
  bake or framebuffer) and multiplied onto the ground with `layInk`. Ink only
  darkens. To put one thing in front of another, first paint its silhouette
  white on the sheet (a knockout), then draw it.
- **Bleed:** `bleedSheet(stage, src, world, { reach, amount })` lets ink
  creep along the fibres.

What must differ is the brushwork: stone rubbing, plain line, landscape
texture strokes, ruled architecture and free expressive ink each follow their
own rules. Your brief says which.

### 6.5 Canvas, text, shaders, effects

- `kit/text.js`: `sprite(stage, key, w, h, (ctx) => …)` for a drawn-once
  layer, `drawText(ctx, text, x, y, { font, align, baseline, fill, stroke,
  spacing })`, `font(family, px, weight, style)`, `textSprite`, `placeText`.
- `kit/glsl.js`: `VERT`, `FRAG_HEAD`, `NOISE` (`hash21`, `vnoise`, `fbm`,
  `rot2`), `rgb(hex)`. Shaders are GLSL ES 3.00. Anchor procedural texture to
  the world by passing the rectangle's world origin and size as uniforms, as
  `ROCK_FRAG` in `sahara.js` does, and fade detail finer than two pixels.
- `kit/fx.js`: `drawMask` (a texture's coverage in one colour),
  `drawPigmentMask` (lettering as hand-applied pigment), `vignette`.
- `kit/paper.js`: `drawPaper`, `fillPaper` with your own preset.
- `kit/geom.js`: `smoothClosed`, `smoothOpen`, `blob`, `placer`, `rotAbout`,
  `along`.
- `beat/ease.js`: `clamp lerp remap smoothstep smootherstep easeOutBack
  easeOutCubic decay bump window4 hermite5` and more.
- `beat/timeline.js`: `BAR`, `BEAT`, `T_SECTION`, `stepTime`.
- `main/layout.js`: `ROAD_Y`, `SPEED`, `WHEEL_R`, `PAINT_TOP`, `PAINT_BOTTOM`,
  `PX_PER_UNIT`, `ZOOM_IN`, `FOCUS_Y`, `VIEW_W`, `VIEW_H`.

**Pixel-exact art** (low-resolution or dithered looks): build the small image
on a `Layer2D` (an indexed buffer written with `putImageData` is ideal), then
enlarge it with crisp edges. Either draw it onto a larger layer with
`ctx.imageSmoothingEnabled = false` at a whole-number scale, or sample it in a
small fragment shader that snaps to texel centres. Plain `stage.image` blurs
when it enlarges.

### 6.6 Fonts

macOS system fonts, by CSS family name. `FONTS` in `kit/text.js` has the
common stacks; define your own stack as a constant in your scene. Always end
a stack with a generic family. Installed on the production machine:

- **Chinese:** Songti SC, STSong, STFangsong, Kaiti SC, STKaiti, Xingkai SC
  (行楷), Libian SC (隶变), Baoli SC (报隶), Weibei SC (魏碑), Heiti SC,
  STHeiti, PingFang SC, Hiragino Sans GB, Lantinghei SC, Yuanti SC, Yuppy SC,
  Wawati SC, Hannotate SC, HanziPen SC, Lingwai SC, GB18030 Bitmap
- **Japanese:** Hiragino Mincho ProN, Hiragino Sans, YuMincho, Klee,
  Toppan Bunkyu Mincho, Tsukushi A Round Gothic
- **Serif:** Baskerville, Big Caslon, Bodoni 72, Didot, Hoefler Text, Cochin,
  Palatino, Charter, Georgia, Times New Roman, Rockwell, American Typewriter,
  Copperplate, Academy Engraved LET
- **Sans:** Helvetica Neue, Avenir Next, Futura, Gill Sans, Optima,
  DIN Alternate, DIN Condensed, Arial, Tahoma, Verdana, Trebuchet MS, Geneva,
  Lucida Grande, Impact, Phosphate, Skia
- **Mono:** Menlo, Monaco, Andale Mono, Courier New, PT Mono
- **Display and hand:** Herculanum, Luminari, Trattatello, Papyrus,
  Chalkduster, Marker Felt, Noteworthy, Bradley Hand, Brush Script MT,
  SignPainter, Snell Roundhand, Apple Chancery, Zapfino, Savoye LET, Silom

A wrong family name fails silently into the fallback. Look at your lettering
before you trust it; `dev/experiments/fonts.js` shows how to probe a family.

## 7. Speed

The preview must play in real time and the export must not crawl.

| | Budget at 1920 × 1080 |
|---|---|
| Drawing your scene alone (bar 2) | mean ≤ 10 ms per frame |
| Entry and exit (two scenes share the frame) | mean ≤ 14 ms |
| `init` and first-use bakes | ≤ 8 s in total |
| Cached layers | ≤ 50 megapixels in total at 1080p |

Measure with `node tools/perf.mjs --section N`. Report the numbers you got.

## 8. Working

Work only inside your copy of the project (the folder you were given). All
commands run from its root.

```bash
node tools/sheet.mjs --name s07 --section 7           # 16 frames: both crossings and every beat
node tools/sheet.mjs --name s07-joke --range 43.5:45:0.1   # a stretch, frame by frame
node tools/shot.mjs --t 44.0                          # one full-size frame -> out/shots/t44.000.png
node tools/shot.mjs --t 44.0 --width 960              # the same at half size: must look the same
node tools/shot.mjs --t 44.0 --query solo=7           # your scene alone, no frames or neighbours
node tools/shot.mjs --still 7                         # your gallery still
node tools/shot.mjs --still 7 --u 5.0                 # the still's square at another moment, drawn live
node tools/check.mjs                                  # timing contracts
node tools/check.mjs --purity --section 7             # byte-identical frames
node tools/perf.mjs --section 7                       # playback speed
node tools/shot.mjs --page "dev/lab.html?exp=maya-test" --out out/shots/lab.png   # an experiment module
```

Section *n* runs from `5 + 6 (n − 1)` to `5 + 6 n` seconds of film time.
Sheets land in `out/sheets/<name>.png`, with the full-size frames beside them
in `out/sheets/<name>/`. Look at them with the Read tool: the sheet for
composition and timing, single full-size frames for craft.

A good order of work:

1. Read; plan the layers and what is baked.
2. Rough everything in: ground, world, pelican skin, title, the bar-2 event.
   Get a full contact sheet early.
3. Look. Compare with your brief and with what the real thing looks like.
   Fix the biggest problem. Repeat, at least three full rounds.
4. Check both crossings at full size (u = −0.1, 0, 0.1 and 5.9, 6, 6.1).
5. Check the half-size render, the still, the checks and the speed.

## 9. Before you report

- [ ] At a glance, the frame could be a photograph of a real work in this
      manner, with a pelican on a bicycle in it.
- [ ] The materials read: ground, pigment or ink, tool marks, age.
- [ ] The bar-2 event happens on the beats the brief gives, and reads without
      explanation.
- [ ] Title: three parts, period lettering, big enough, in view two seconds.
- [ ] The pelican is unmistakable, never hidden, and untouched near both
      crossings (u < 0.6, u > 5.4).
- [ ] No edge of the painted world shows at any time, including zoom 1.
- [ ] Nothing pops at u = 0 or u = 6; the scene is sane from u = −2 to 8.
- [ ] Half-size render matches full size. The gallery still reads.
- [ ] `tools/check.mjs` passes; `--purity --section N` passes.
- [ ] Speed is within budget, or you say by how much it is not.
- [ ] Nothing real: no logo, product, character or traced composition.

## 10. Your report

End with a report in this shape. Be exact and honest: state what you looked
at and what you did not, and name what is weak.

1. **Built**: three or four sentences.
2. **Event times**: a table of everything that happens on a beat, in `u`
   seconds (the soundtrack will be written to it).
3. **Checks**: the commands you ran and their results.
4. **Speed**: the `perf.mjs` lines.
5. **Weak spots**: what you would fix next, in order.
6. **Kit requests**: helpers you wrote that others could share, or changes
   you wanted in files you could not touch.
7. **Files**: what you changed.
