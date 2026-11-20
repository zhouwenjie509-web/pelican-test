# Section 2 · 古埃及壁画 · Egyptian Wall Painting

| | |
|---|---|
| Date on the title | 约公元前 1300 年 · c. 1300 BCE |
| Film time | 11.0 s – 17.0 s |
| Code | `src/scenes/egypt.js` |
| Homage | New Kingdom tomb painting at Thebes (18th–19th Dynasty): flat colour on plaster, figures built on the painter's grid. Anonymous, public domain. Nothing is traced; every figure and sign is drawn fresh in that manner. |

## The idea

A plastered tomb wall. Registers of figures on a ground line, columns of
signs above, a frieze along the top, a dado below. The wall was never
finished: the left is complete, the middle has its colours but no final
outline, the right is still red underdrawing on a snapped-string grid.

The pelican rides along the ground line as one more figure in the register,
painted exactly like the others.

**The joke (bar 2):** on the downbeat it stops dead and becomes what Egyptian
figures are: a canonical pose, measured on the grid, perfectly still. Head in
profile with a frontal eye, chest turned square to us with a wing on either
side, feet in profile, bill level. It holds for two beats. It blinks once.
Then it rides on, and has to pedal hard to make up the time.

Nobody on the wall reacts. They are paintings.

## Materials

- **Ground.** Gypsum plaster over mud: warm cream `#e9dcc0`, uneven, with
  trowel drift, hairline cracks, and a few losses where brown mud plaster
  `#9a7a55` shows. Generate it in a shader or reuse `kit/paper.js` with your
  own preset, then add cracks and losses.
- **The grid.** Red lines snapped with a string dipped in ochre: thin,
  slightly beaded, not perfectly straight. Squares of **7.0 units**, with a
  horizontal line on the ground line (y = 700) and a vertical line at
  x = 301.5, the rear hub of the frozen pelican; its front hub (x = 365.2)
  then falls within a unit of another line, and the top of its head is 18
  squares up. Under finished paint the grid is barely there; on bare plaster
  it is plain.
- **Pigments.** Red ochre `#a2452a`, yellow ochre `#d9a441`, Egyptian blue
  `#2f6f9f` (lighter `#5b93b5`), green `#5e8f5a`, black `#231d18`, white
  `#f6f0e2`. Underdrawing red `#b5533a`. Nothing else.
- **Handling.** Flat colour, no shading, then a firm outline in red-brown or
  black of even width. Edges are hand-drawn: let them wander by a fraction of
  a unit. Colour sits slightly inside or outside its outline here and there.
- **Age.** Paint is matt and a little abraded; a last wear pass lets plaster
  show through everything, the pelican included, heaviest near cracks.

## The wall

World units; the section is x = 0 … 1000, the ground line y = 700.

| Band | y | What |
|---|---|---|
| Frieze | 433 – 456 | Repeating upright bundle ornaments in blue, green and red on yellow, a black line under them |
| Signs | 460 – 550 | Columns of signs between thin blue rules about 26 units apart. Invent about two dozen simple signs (reed, ripple, loaf, basket, owl, hand, eye, snake …) and set them by a seeded shuffle. They are decoration, not a text. |
| Figures | 556 – 700 | Standing figures are 126 units tall (18 grid squares to the hairline) |
| Ground line | 700 – 704 | Black band, a thin red line beneath |
| Water | 708 – 752 | Blue band with black zigzag ripples, lotus flowers and buds, a few fish in profile |
| Dado | 756 – 790 | Yellow, red and black stripes |

Left to right the wall goes from finished to unfinished:

- **x 30 – 250, finished.** Three offering bearers walking right, in the
  canonical manner (head and legs in profile, shoulders square, red-brown
  skin, white kilts, black wigs). They carry a tray of fish, a bunch of
  lotus, a pair of jars on a yoke.
- **x 250 – 410, the pelican's stretch.** Finished wall, no figure. Leave it
  clear: this is where the pose is held.
- **x 410 – 560, colour only.** One or two more bearers with their flat
  colours laid in but no final outlines, a little rough at the edges.
- **x 560 – 900, underdrawing.** A seated couple before a heaped offering
  table, in red line only, with a few corrections in black. The grid is
  clear here.
- **x 900 – 1000, grid only.** Bare gridded plaster.

## Title

A block at **x 404 – 594, y 458 – 552** on the finished wall, in the sign
register (leave the sign columns out there):

1. 古埃及壁画 in five square cells, about 26 units tall, black with blue.
2. `EGYPTIAN WALL PAINTING` in spaced capitals, about 11 units (Optima or
   Herculanum).
3. `约公元前 1300 年 · c. 1300 BCE` in red ochre, about 10.5 units.
4. **The cartouche:** a rope oval lying on its side with the tied bar at one
   end, holding **THE PELICAN TEST** in capitals about 12 units tall, set
   among a few genuine-looking signs, and closed by a determinative: a tiny
   sign of a pelican on a bicycle. It must read as *The Pelican Test* within
   two seconds.

During the hold the camera sits at x = 333, so the whole block is in view
above and to the right of the pelican.

## The pelican

Painted like the other figures: flat colour and a firm red-brown outline, on a
2D canvas patch.

- White body; wing in bands of blue, green and red, as Egyptian painters
  banded the wings of sacred birds; yellow bill with red lines; yellow pouch;
  red-ochre legs.
- **The eye is always frontal:** an almond with a black pupil, a kohl line
  and a cosmetic tail, although the head is in profile.
- Bicycle in black with yellow joints. The wheels are **chariot wheels: six
  spokes**, yellow rims.

**The canonical pose** (bar 2): bicycle unchanged and in strict profile;
cranks level (they are, at the stop); body pulled upright; chest square to us
with **both wings shown**, the near one reaching forward to the grip, the far
one mirrored behind, bent, holding an ankh; neck in a tall S; head high in
profile with the bill exactly horizontal; no bob, no flutter. Wheel spokes
snap to a symmetrical position. Ease into the pose over the braking fifth of a
second and out of it over a quarter second on release.

## The three bars

The scene supplies `motion(u)`:

| u | |
|---|---|
| 0 – 1.9 | Standard pace. Bearers and the first sign columns pass. |
| 1.9 – 2.1 | A hard stop centred on the downbeat of bar 2, from full speed to nothing, ending at **x = 333.33** (exactly two pedal turns, so a pedal is forward). |
| 2.1 – 3.0 | **Held.** Nothing moves: no bob, no feather, no blink, and the camera is still. |
| 2.5 | One blink (lid down and up within 0.15 s). The only motion in the frame. |
| 3.0 | Release, on beat 3. Out of the pose, accelerating. |
| 3.0 – 5.9 | Catching up at about 1.5 times the standard pace, pedals spinning to match (leave `turns` to follow `x`). Ease back to the standard pace by u = 5.9. |
| 6.0 | Through the frame at exactly the standard speed. |

`node tools/check.mjs` must pass: starts at 0, ends at 1000, standard speed
at both ends, never backwards, and "tracking camera never jumps".

While it is held, pass a frozen `time` to the rig so the secondary motions
stop too.

## Gallery still

`still: { u: 2.5, cx: 418 }`: the held pose with the whole title block in the
square.

## How to build it

- One wall layer baked from 2D canvas drawing over x −60 … 1060, y 420 … 800
  at 3.3 px per unit, on a shader plaster ground. One wear layer on top.
- Per frame: the wall, the pelican on a patch, the wear layer.
- Keep the hand in it: seeded wobble on outlines, slight misfit between
  colour and line. It must not look like clip art.

## Sound cues (for Stage 4)

| u | Event |
|---|---|
| 1.9 – 2.1 | Brake |
| 2.0 | Pose locks (downbeat) |
| 2.5 | Blink |
| 3.0 | Release |

## Check on the contact sheet

- Reads as paint on plaster: matt, flat, outlined, slightly worn. Not vector
  art.
- Only the six pigments.
- The grid is faint under paint and clear on bare plaster; the frozen
  pelican sits on it squarely.
- Three stages of finish are visible from left to right.
- The cartouche reads THE PELICAN TEST; the title's three parts are legible.
- At u = 2.1 … 3.0 two frames a tenth of a second apart are identical except
  for the blink.
- The pose is unmistakably Egyptian and unmistakably a pelican on a bicycle.
- Both crossings: the puppet is in its normal riding pose.

## As built

- One baked wall (plaster shader + one 2D canvas of paint, x −70 … 1070, y 418 … 802 at 3.3 px/unit) and one baked wear layer from the same shader (chalky veil, abrasion, cracks, four mud losses; wear and cracks are damped over the title block). Per frame: wall, pelican on a 2D patch, wear.
- Stages of finish: white ground wash over the grid to x ≈ 416 (ragged edge); colour-only bearers at x 452 and 522 with red underdrawing peeking out; red underdrawing (table at 640, couple at 744/770 facing left, sign columns, frieze, pool and dado guide lines) to x ≈ 900 with three black corrections; bare grid beyond.
- Grid: 7-unit squares, horizontal line on y = 700, vertical lines on x = 301.5 + 7n, y 456 … 700.
- motion(u): standard pace to 1.9; smoothstep brake to x = 1000/3 at 2.1; held 2.1 … 3.0; smoothstep up to 1.565× (260.9 units/s) by 3.6, cruise, ease to the standard pace by 5.9. turns follows x.
- Pose amount k: ease-out over 1.9 … 2.05 (≈0.96 on the downbeat), ease-out over 3.0 … 3.25. Rig time is frozen with k, bob and wind go to 0, headPitch levels the bill exactly. Body, neck, near wing and tail morph point by point into the pose; far wing and ankh grow from the back shoulder; spokes ease to a symmetrical angle.
- Blink: lid down and up within u 2.425 … 2.575. Frames at u 2.2 and 2.9 are pixel-identical; 2.5 differs only in the eye's 26 × 8 px box.
- Still: u = 2.4 instead of 2.5, because 2.5 is the blink itself.
- Title block x 404 … 594: Chinese name in five ruled cells (Libian, 25 units), English name in Optima 600 at 12 units (baseline 499.5), date in red Optima 600 at 12.5 units with 0.2 letter spacing (baseline 513.5), cartouche y 519 … 550.5. On screen at zoom 1.1: English capitals 27 px, date figures and capitals 27 to 28 px.
- The third finished bearer (x 220) carries a red-brown pole (the skin red, black outline) with a yellow and a red jar; the pole stays at its old height, just under his chin.

### Stage 5

- Date line raised from 11 to 12.5 units (letter spacing 0.4 to 0.2 so it still fits the block): its figures and capitals measure 27 to 28 px instead of 24 at zoom 1.1 (frame 13.2 s). Same baseline, still clear of the cartouche.
- The third bearer's yoke pole is painted red-brown instead of yellow, so the pelican's yellow bill no longer reads as one bar with it at u = 1.0. Lifting the pole and jars 10 units was tried first: it put the pole across his face at the height of his nose and eye, with the hands raised above the shoulder, which spoils the carry, so it was taken back. Both changes are in the baked wall, so every frame in which the title or that bearer shows changes (film 10.2 to 16.5 s); nothing else does.
