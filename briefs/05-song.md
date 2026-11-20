# Section 5 · 宋代山水 · Song Landscape Painting

| | |
|---|---|
| Date on the title | 约公元一〇〇〇年 · c. 1000 CE |
| Film time | 29.0 s – 35.0 s |
| Code | `src/scenes/song.js`, shared ink system in `src/kit/ink.js` |
| Homage | Fan Kuan, *Travelers Among Mountains and Streams* (谿山行旅圖), early 11th century, public domain. The composition is rebuilt for a wide frame; nothing is traced. |

## The idea

A monumental landscape in ink on old silk. One mountain fills the picture;
below it a band of mist, wooded bluffs with temple roofs, a path, great
boulders. In the original a mule train crosses at the lower right, so small
that visitors miss it. Here the traveller is a pelican on a bicycle, about
one sixtieth of the picture's height.

**The joke (bar 2):** the camera pulls all the way back to show the whole
painting, and the pelican is gone. It is still there, a white speck on the
path. The camera has to push in to find it again.

## Materials

- **Ground.** Tea-brown silk with a fine weave, tide marks and a thousand
  years of darkening (`GROUNDS.silk`). Ink only ever darkens it.
- **Ink.** The five tones (焦 浓 重 淡 清), quantised to ten steps. No colour
  in the landscape. The only colour in the picture is the red seal and the
  pelican.
- **Brushwork, specific to this section:**
  - *Raindrop strokes* (雨点皴): short vertical touches laid by the thousand,
    densest in clefts, under crests and along edges, thinning toward the foot.
  - *Contour* in loaded strokes that lift and start again; never one unbroken
    outline, and none along a foot that should be lost in mist.
  - *Scrub* on every crest: dense dark touches, three deep.
  - *Mist* is bare silk: a soft bank laid over the mountain's foot and over
    the feet of the bluffs, with a few edged wisps above it.
  - *Trees:* trunk and boughs as tapered limbs; foliage as dots, or as sprays
    of three or four strokes (个字点). Seen from close by, bark is drawn plate
    by plate with knots, and the two contours wander independently.
  - *Rocks:* blocks with a flat top and a lower shoulder, divided into faces
    by folds, each fold with a shaded side.
- **Occlusion.** Ink cannot cover ink. Anything that stands in front of
  something else first clears its own silhouette to bare silk, then is
  painted (`Marks.knockout`).

## Composition

World units; the road is at y = 700 and the section runs x = 0 … 1000. The
whole painting is 11,084 × 6,235 units (`COMP`), sixteen times the width of a
normal shot.

| Depth | What | Where (y) |
|---|---|---|
| Far | Pale ranges either side | tops −3500 … −1700 |
| Peak | The great block, two buttresses, the waterfall as a thread of bare silk in the darkest recess | top −4490, foot −560 |
| Mist | Bank across the whole width | −1850 … −260 |
| Middle | Eight wooded bluffs, temple roofs on the right | tops −900 … −260 |
| Grove | Big trees behind the path | rooted 560 … 660 |
| Path | Stones, old trees with low boughs, saplings, the path, grass | 640 … 750 |
| Near | Great boulders and water at the foot of the picture | 1060 … 1355 |

The painting is too large to keep at close-up resolution, so one painting
program runs three times, for three sheets of increasing detail: the whole
picture, the valley, the stretch of path. Finer marks appear only on the
sheets that can show them. Each frame stacks the sheets that matter at the
current zoom and multiplies the result onto the silk.

## The pelican

Fine even line and pale flat colour, in the manner of small figures in Song
painting: white body, ochre bill, red-brown legs, ink bicycle. From far away
it reduces to four touches of the brush (body, head, two wheels), sized so it
never falls below about two pixels.

## The three bars

1. **Entrance.** Close view: path, stones, trunks, a bough overhead. The
   colophon (title, date, seal) is written on the silk beside the path.
2. **The joke.** In half a second the camera pulls out to the whole painting
   and holds, creeping slightly. A second, larger colophon sits in the sky.
   Then it pushes in, through the grove, and finds the pelican exactly where
   the tracking shot left off.
3. **Exit.** Close view again, to the frame.

The pelican never changes speed. The camera move is the scene's own
`camera(u)`, active only in bar 2, and neutral at both ends of it.

## Title

A colophon in regular script (楷体), two columns read from the right, a red
seal reading 鹈鹕, and one line of Latin letters under it as the film's single
licence. Written twice: beside the path for the close view, in the sky for
the wide view.

## Check on the contact sheet

- Wide view: one dominant peak, a clear band of mist, the waterfall visible,
  no wash keeps a hard edge at its foot.
- Wide view: the pelican is present and smaller than a temple roof.
- Close view: reads as brush and ink, not as vector shapes; no stroke looks
  enlarged or blurred.
- No seams where one sheet gives way to the next during the zoom.
- Both colophons legible at 1080p.
- Camera neutral at both ends of bar 2 (`tools/check.mjs`).

## As built

- **Sheets.** One painting program (`program(m)`) paints three baked sheets
  of increasing detail: `far` (the whole picture, 0.36 px/unit), `valley`
  (0.82) and `path` (3.4), each adding finer marks (`minW`). Each frame lays
  the silk, stacks the sheets that matter at the current zoom (alphas from
  `kRef`, a sheet skipped when the finer one covers the view) and multiplies
  the stack onto the silk.
- **Camera.** `sceneCamera(u)`: pull-out over u 2.00–2.55 (smootherstep),
  wide hold with a 3 % creep, push-in over 3.20–4.00; neutral at both ends.
- **Colophons.** One sprite (`colophonSprite`, 172 × 126 units) written into
  two sheets: beside the path at (128, 441), scale 1, on the `path` sheet,
  and in the sky at (2250, −4640), scale 15, on the `far` sheet. Two
  columns of 楷体 (宋代山水 at 24.5, the date 约公元一〇〇〇年 at 11.6), a red
  seal 鹈鹕, and two right-aligned Latin lines in the serif stack at 12.5
  units (English name italic, baseline 105.5; date upright, baseline 121.5).
  At zoom 1.1 the Chinese name is 69 px tall and the Latin capitals and
  digits 27–28 px; the English line starts about 5 px inside the sprite's
  left edge, on bare silk, clear of the trunk and the bluff, and its date
  line sits where it always did above the pelican's head.
- **Pelican.** Fine line and pale flat colour (`paintPelican`). Below
  `SPECK_ZOOM` (0.07) it is the speck: a white body touch, a round head touch
  (a 16-sided polygon, since a brush circle that small squares off), two
  wheel circles, neck and bill lines. The wide hold is at zoom 0.060–0.062,
  so the speck is about ten pixels across, and the hand-over to the painted
  figure comes at u ≈ 2.445 on the pull-out and u ≈ 3.343 on the push-in.
- **Still.** u = 4.6, the tracking close-up.

### Stage 5

- The speck hands over to the painted figure at zoom 0.07 instead of 0.22,
  so it never grows into a 25 px ball: the switch moved from u ≈ 2.29 to
  2.445 (pull-out) and from u ≈ 3.575 to 3.343 (push-in). The speck's head
  touch is drawn round.
- The colophon's Latin lines went from 10.2 to 12.5 units (22–23 px to
  27–28 px at zoom 1.1) and the English line's baseline from 108 to 105.5;
  the date line's baseline, the Chinese columns and the seal are unchanged.
  Since the sprite is shared, the sky colophon's Latin lines grew too (18–19
  px to 22–23 px in the wide view).
