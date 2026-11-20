# Section 7 · 玛雅手抄本 · Maya Codex

| | |
|---|---|
| Date on the title | 约公元 1200 年 · c. 1200 CE |
| Film time | 41.0 s – 47.0 s |
| Code | `src/scenes/maya.js` |
| Homage | Postclassic Maya screenfold books in the manner of the Dresden Codex: black line and flat colour on stuccoed bark paper, glyph blocks, bar-and-dot numbers in black and red. Anonymous, public domain. No page is copied; signs are invented shapes in that manner, not a text. |

## The idea

A screenfold book opened flat: tall narrow pages side by side, divided by
fold creases, each ruled into registers by red lines. Glyph blocks and numbers
above, a figure below. The book is an almanac, a table that counts.

What it counts is pedal revolutions. **Each page is exactly one turn of the
pedals wide** (166.67 units), and at the head of each page stands the running
total in Maya numerals, painted in as the pelican completes that turn.

The count is honest. The pelican set off in the intro and made one turn
before the first frame, so the total is **37 + u**: 38 at u = 1, 39 at u = 2.

**The highlight (bar 2):** at u = 3.0, on the strong beat, the fortieth turn.
Maya numbers are base twenty, so thirty-nine (one dot above; three bars and
four dots below) becomes forty: **two dots above, and below them the shell
that means zero.** The scribe carries the twenty without comment.

## Materials

- **Ground.** Bark paper sized with white lime stucco: off-white `#efe6d2`,
  fine craquelure, old stains, the stucco flaked away along folds and edges
  to show brown fibrous bark `#8a6a45`.
- **Line.** Black `#1c1512`, drawn with a reed or fine brush: firm, even,
  rounded, about 2 units wide for figures, finer for detail. Calligraphic
  but not expressive.
- **Colour.** Flat, slightly streaky fills: red `#b33a25`, Maya blue-green
  `#3f9d9b`, yellow ochre `#d7a43c`, a little brown. Numbers are black;
  the zero shell and the frame lines are red.
- **Glyph blocks.** Rounded squares about 24 units, each a main sign with
  one or two affixes: profile heads, hands, curls, dotted cartouches. Invent
  two or three dozen parts and combine them by a seeded shuffle.

## The page

World units; the red base line of the figure register is the road, y = 700.
Pages are centred on **x = 166.67 k** (k = 0 … 6), with fold creases halfway
between at x = 83.3, 250, 416.7, 583.3, 750, 916.7. The pages at k = 0 and 6
are half hidden by the picture frames.

| Register | y | What |
|---|---|---|
| Edge | 433 – 440 | Worn top edge of the book, bark showing |
| Title strip | 440 – 474 | Only over x 150 – 420; elsewhere a row of small glyph blocks |
| Text | 478 – 556 | On each page: the **number block** in the middle (x = centre ± 22), glyph blocks either side |
| Rule | 558 – 562 | Red line |
| Figure | 562 – 706 | Where the pelican rides. Background alternates page by page: bare stucco, a red wash, bare stucco, a blue-green wash. A narrow sky band of crossed signs along the top (562 – 574). Otherwise empty: the pelican is the figure on every page. |
| Base line | 700 – 703 | Red |
| Lower | 712 – 780 | One small fixed vignette per page, about 60 units tall: a seated figure offering a fish, a rabbit with a brush pot, a turtle, a water band with a lily and fish, a dog |
| Edge | 780 – 790 | Worn bottom edge |

## Numbers

A number block has two places, twenties above (y ≈ 484 – 506) and units below
(y ≈ 510 – 550). A dot is one, a bar is five, the shell is zero. Bars are
horizontal strokes about 34 × 6 units, stacked, with dots in a row above
them; dots are about 7 units across.

| Page k | Total | Twenties | Units | Painted at u |
|---|---|---|---|---|
| 0 | 37 | • | three bars, •• | already there |
| 1 | 38 | • | three bars, ••• | 1.0 |
| 2 | 39 | • | three bars, •••• | 2.0 |
| 3 | **40** | •• | **shell** | **3.0** |
| 4 | 41 | •• | • | 4.0 |
| 5 | 42 | •• | •• | 5.0 |
| 6 | 43 | •• | ••• | 6.0 |

Before its moment a block is only a faint red ruled box. At its moment the
number is painted in, fast and in order: bars swept left to right (about
0.08 s each), then dots one by one (0.06 s apart), then the twenties place.
Fresh paint is glossier and darker for half a second, then matt. At u = 3.0
the shell is drawn larger and with care: an oval with a hinge and three
curved ribs, red and white.

These moments are when the pelican's crank passes the page centre, which is
exactly on the beat. Drive them from `f.u` so they stay painted afterwards
and are empty before u reaches them (the scene is drawn from u = −2 to 8).

## The pelican

Drawn as the codex draws its creatures: a firm black outline and flat colour,
on a 2D canvas patch.

- White body with small black U-shaped feather marks; wing blue-green with
  red tips; yellow bill with a red line, red-orange pouch with a row of dots;
  red legs.
- A large round eye with a red ring and a curl beneath it; a crest of three
  curled feathers; a collar of green beads at the base of the neck.
- **The bicycle.** Frame as outlined bars with red lashings and a knot at
  every joint. The saddle is a jaguar-pelt cushion, yellow with black
  spots. **The wheels are day-sign cartouches:** a thick double ring with a
  four-petalled sign and four dots inside, turning with the wheel. The
  scribe had no sign for a wheel and used what was round.

Colour and line must stay inside the puppet's own motion: flat fills that
follow the shapes, no texture anchored to the world.

## The three bars

| u | |
|---|---|
| 0 – 2 | Entrance. Title strip overhead. 38 is painted at u = 1.0, 39 at u = 2.0. |
| 2 – 4 | **40 at u = 3.0**: two dots and the shell. 41 at u = 4.0. |
| 4 – 6 | 42 at u = 5.0. Exit. |

The pelican keeps the standard pace. No camera move.

## Title

In the title strip, **x 150 – 420, y 440 – 474**:

- 玛雅手抄本: each character in its own rounded glyph cartouche, about 28
  units, heavy black on stucco (a strong face such as Weibei SC or Heiti SC),
  five in a row.
- To their right, two lines of about 10 units: `Maya Codex` and
  `约公元 1200 年 · c. 1200 CE`, in black with the date in red.

## Gallery still

`still: { u: 3.25 }`: the pelican just past the page with the shell.

## How to build it

- Stucco, bark and craquelure in a shader ground; everything fixed (rules,
  glyph blocks, washes, vignettes, title, the red boxes) baked on top from
  2D canvas drawing, with a slight hand wobble and uneven fills.
- Per frame: the numbers as they stand at `f.u`, then the pelican.
- A last light pass of wear (flaking, craquelure) over paint, the pelican
  included, so it belongs to the page.

## Sound cues (for Stage 4)

| u | Event |
|---|---|
| 1.0, 2.0, 4.0, 5.0 | A number is painted: wooden drum |
| 3.0 | Forty: the shell |

## Check on the contact sheet

- Reads as a painted Maya book: stucco, creases, red rules, glyph blocks,
  flat colour, black line.
- Six page centres, one number each, and each number is correct in base
  twenty. Count the dots and bars.
- A number is absent before its beat and present from it.
- The shell at u = 3.0 is clearly a different thing from a dot or a bar.
- The wheels are cartouches and visibly turn.
- The pelican reads as a pelican, in codex style.
- Title legible, three parts.

## As built

- `src/scenes/maya.js`, one file. Ground and wear are shaders baked once (`maya/page`, `maya/wear`, about 5 Mpx each at 1080p); all fixed painting (washes, sky band, red rules, number boxes, ~110 glyph blocks, title, vignettes) is drawn on a 2D canvas inside the page bake with a "reed" ribbon line (width and centre wander by arc length) and streaky fills (a seeded streak tile used as a pattern).
- Glyph blocks: 8 main signs (profile head, cartouche with 9 inner signs on a pedestal, hatched dark-faced head, volute, bird head, round face with teeth, spotted cartouche, hatched cartouche with curls) and 8 affixes, combined by a seeded shuffle in four layouts; affixes in tall boxes are turned upright.
- Title strip runs x 110–378 (270 units) so the fold at x = 250 falls between the five character cartouches (page 1) and the two lines (page 2), instead of x 150–420 as briefed. Page 2 holds `MAYA CODEX` in Optima capitals, 13.5 units, black (baseline 457.5), and the date line `约公元 1200 年 · c. 1200 CE` in Yuanti SC bold, 12 units, red (baseline 471.5), condensed to the strip's end at x 378 so it stops about 9 units short of the glyph block at x 386. At zoom 1.1: capitals of the English line 30–31 px, digits and capitals of the date 28–29 px.
- **Stage 5:** the English line, which was set in Herculanum at 12.5 units (capitals 25 px; it read as a cheap "ancient" face), is now Optima capitals at 13.5 units; the date line went from 10.2 to 12 units (from 24 px to 28–29 px) and its baseline down 0.5. Nothing else changed; the cartouches, the strip and the glyph blocks are as they were.
- Numbers: per frame from `f.u`, one patch per visible page. Order: units (bars 0.08 s each, then dots 0.06 s apart; the shell in 0.15 s), then the twenties. Each element lands with a partial dab on its beat; fresh paint is darker with a light gloss stroke for 0.5 s.
- The fold wear is suppressed inside the figure register so no crease line runs through the rider.
