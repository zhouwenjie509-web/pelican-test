# Section 4 · 唐代白描 · Tang Baimiao Line Drawing

| | |
|---|---|
| Date on the title | 约公元 750 年 · c. 750 CE |
| Film time | 23.0 s – 29.0 s |
| Code | `src/scenes/tang.js`, shared ink system in `src/kit/ink.js` |
| Homage | The plain-line figure drawing of the High Tang associated with Wu Daozi, of whom it was said 吴带当风, "Wu's sashes face the wind". Public domain. No scroll is copied; the figures are drawn fresh in that manner. |

## The idea

Ink line on old paper, and nothing else: no wash, no colour, no shading.
Form, weight and movement are all carried by one brush line that swells and
thins. Tall court attendants in long robes stand along a terrace; ruyi-headed
clouds curl in the air.

The pelican rides past with two long scarves streaming from its neck and
every feather drawn as a separate lifting stroke.

**The joke (bar 2):** the famous wind in Wu's sashes turns out to have a
source. The attendants' sashes and sleeves hang slack and still until the
pelican passes; then, one figure after another, they lift and stream after
it in exactly the celebrated manner. The masterpiece is its slipstream.

## Materials

- **Ground.** Old paper: `GROUNDS.xuan`, or a slightly warmer, more aged
  preset of your own in the same shape.
- **Ink.** Two tones only: `INK.nong` for the figures and the pelican,
  `INK.dan` for what is further off (clouds, railing, hair lines). The single
  red seal is the only colour.
- **Line.** `inkBrush(pen, "line", …)`, the upright tip. Use pressure along
  each stroke:
  - *Orchid-leaf line* (兰叶描) for robes, sashes and scarves: set down
    firmly, swell in the middle of a curve, taper to a point.
  - *Iron-wire line* (铁线描) for faces, hands, the bicycle and
    architecture: thin and even.
  Lines are long and unhesitating. Never short scratchy strokes, never a
  line that wobbles.
- **No tone at all.** No wash, no dry-brush shading, no hatching.
- **Overlap** is by knockout: on the ink sheet, paint the nearer form's
  silhouette white, then draw its lines. Line behind it is gone, as in a
  real drawing.

This is the "plain line" member of the ink family.

## Composition

World units; the terrace edge is the road, y = 700.

- **Terrace edge:** two parallel lines at y ≈ 702 and 709 with short joints
  between stone slabs every 70 units or so. This is what shows the ground
  moving.
- **Railing** behind, pale: posts with lotus-bud finials every 90 units,
  two rails, from y ≈ 628 to 700.
- **Clouds:** three or four groups of ruyi-headed scroll clouds between
  y = 448 and 545, in pale line.
- **Attendants.** Feet at y ≈ 690, a little behind the pelican's line, so it
  passes in front of them. Each is 150–165 units tall: high chignon, round
  face indicated with a few strokes, long sleeves that fall in bell shapes,
  a high-waisted skirt in long near-vertical folds pooling at the hem, and
  **two or three long sashes** from the waist and shoulders.
  - One attendant with a tray at x ≈ 250.
  - A group of five at x ≈ 400 – 660, overlapping, turned various ways, one
    with a long-handled fan, one with a flute.
  - Two at x ≈ 820 – 900, one holding a standard whose banner has long
    streamers.
- Leave the upper right open. Emptiness is part of the drawing.

Figures are built from long curves, not anatomy: a head oval, the neckline,
two great sleeves, the fall of the skirt. Draw few lines and make each one
good.

## Sashes

Each sash is a chain of points with two shapes: **at rest**, hanging in a
slow S; **in the wind**, streaming to the right with a travelling wave
(wavelength about 60 units, growing towards the free end, the tip flicking).
A sash is one or two parallel orchid-leaf lines with a few fold marks.

The blend between the shapes is the wind at that figure, a function of where
the pelican is: nothing until the pelican's breast draws level, rising
within about 0.3 s, staying full while the pelican is within about 350 units
ahead, then dying away over about two seconds with the wave slowing.
Sleeves swell and hems lift a little with the same value. Closed form in
`f.u` and the pelican's x; defined for u from −2 to 8.

## The pelican

Line only (`outlines(skel)` is a start, but redraw it):

- Body, neck, bill and pouch in orchid-leaf line; the bicycle in iron-wire
  line, wheels as true circles with fine spokes.
- Wing and tail feathers as separate long strokes that lift and flutter;
  rows of short curved strokes for the coverts.
- **Two scarves** tied at the base of the neck, 150–200 units long,
  streaming back with the same travelling wave as the sashes, their ends
  split and flicking.
- White knockout under the whole figure so the railing and attendants do
  not show through it.

## The three bars

| u | |
|---|---|
| 0 – 2 | Entrance. Title at the left. The tray-bearer's sashes lift at u ≈ 1.6 as the pelican passes: the first sign. |
| 2 – 4 | The group of five. Sashes lift from left to right as the pelican passes each figure (u ≈ 2.5 to 3.7). At u = 3.0 the pelican is in front of the middle of the group; by u ≈ 3.9 all five stream fully. |
| 4 – 6 | The group streams behind, slowly settling. The standard-bearer's banner snaps out at u ≈ 5.1. Exit. |

The pelican keeps the standard pace. No camera move.

## Title

An inscription at **x 60 – 190, y 446 – 606**, in regular script (Kaiti SC),
reading down, columns from the right:

- 唐代白描, about 26 units.
- 吴带当风, about 15 units, as a second column.
- 约公元七五〇年, about 12 units.
- Below, across: `Tang Baimiao Line Drawing` and `c. 750 CE` in a serif
  italic, about 10 units.
- One red seal.

## Gallery still

`still: { u: 3.6 }`: the pelican with the five attendants' sashes streaming.

## How to build it

- Bake the fixed drawing (terrace, railing, clouds, the attendants' heads
  and bodies, the title) as an ink sheet.
- Per frame, on a view-sized ink sheet: stack the baked sheet, knock out and
  draw the sashes and sleeves of the figures in view, then knock out and
  draw the pelican; lay the result on the paper once with `layInk`.
- Only two tones, so brush passes stay few. Skip figures that are off
  screen. Measure early: if a frame costs too much, give distant sashes
  fewer points before you give up line quality.
- Seed each stroke by what it belongs to, so the line's grain does not boil.

## Sound cues (for Stage 4)

| u | Event |
|---|---|
| 1.6 | First sash lifts |
| 2.5 – 3.7 | Sashes lift in sequence, left to right |
| 5.1 | The banner snaps out |

## Check on the contact sheet

- Line only. No grey areas anywhere.
- Lines are long, fluent and tapered; robes read as cloth.
- At u ≈ 1 the group's sashes hang still; at u ≈ 4 they stream. The change
  follows the pelican, not the clock.
- The pelican's scarves and feathers move in every frame.
- Nothing shows through the pelican or the nearer figures.
- Title legible, three parts, one seal.

## As built

- Paper: `GROUNDS.xuan` warmed and stained (`PAPER` in the scene). Ink only: `INK.nong` for figures, sashes and pelican, `INK.dan` for clouds, railing and hair strands; the seal is the one red.
- Line: a scene brush `tang-plain` (the kit "line" tip loaded fuller, constant brush pressure, no end cap), registered by size class like `inkBrush`. Pressure is per point: orchid-leaf (set down, swell mid-curve, release to a point) and iron-wire (even). The kit "line" left a grey, broken trace at light pressure.
- Layers: back sheet (terrace, railing, five ruyi clouds, title, back-row figures) and front sheet (front-row figures, on a clear sheet with white knockouts) are baked at 3.3 px/unit. Per frame on one view-sized sheet: back sheet, back-row sashes (knockout + line), front sheet, front-row sashes and the banner, then the pelican (scarves behind it, white knockout of bird and wheels, line, then the wing knocked out and drawn over the body). Laid on the paper once with `layInk`.
- Figures: eight attendants (tray at 250; fan, back, flute, back, clasped at 418-634; standard at 820, clasped at 893), each built from one template: hair-and-chignon line with combed strands, a one-line face, neckline, high-tied skirt with bow, two bell sleeves drawn as single long lines, skirt falls and pooling hem.
- Sashes: per figure two shawl ends and one waist ribbon, built by integrating direction along length (never stretch). Wind at a root = `windAt(pelican.x + 45 - rootX)`; the wave phase uses the integral of the wind, so the wave slows as the wind dies. Banner: pennant plus three streamers, snapping out with a small overshoot.
- Title: the inscription as briefed (Kaiti SC columns, one red seal), with the English lines `Tang Baimiao` / `Line Drawing` (Baskerville italic) and `c. 750 CE` (Baskerville upright) at 13 units, right-aligned at x 120, baselines y 530, 546.2, 562.4. On screen at zoom 1.1 their capitals and digits measure 27 to 29 px; 唐 measures 74 px. The block spans x 58 to 190, above the pelican's head (572).
- Gallery still at u = 1.95 with the square centred at x 336: the pelican between the tray-bearer and the fan-holder, its head and neck on bare paper, 唐代白描 inside the square's left edge and the seal just outside it.

**Stage 5.** The English name and date lines went from 10 to 13 units (they measured 22 px; now 27 to 29 px), keeping their right edge, growing left and down. The gallery still moved from u = 3.9 (head and neck drawn over a lady and threaded by sashes) to u = 1.95, cx = 336. Nothing else changed.
- Not built: sleeves swelling and hems lifting with the wind (only sashes and the banner move).
