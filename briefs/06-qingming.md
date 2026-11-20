# Section 6 · 清明上河图 · Along the River During the Qingming Festival

| | |
|---|---|
| Date on the title | 约公元 1100 年 · c. 1100 CE |
| Film time | 35.0 s – 41.0 s |
| Code | `src/scenes/qingming.js`, shared ink system in `src/kit/ink.js` |
| Homage | Zhang Zeduan, 清明上河图 (early 12th century), the Rainbow Bridge passage. Public domain. The bridge is rebuilt in side view for this film; nothing is traced. |

## The idea

Ink and light colour on silk, with ruled-line architecture (界画). A timber
arch bridge crosses the Bian River, crowded: porters with shoulder poles, a
sedan chair, a loaded donkey, stalls under mat awnings at either end, idlers
at the railing. Under the arch a big river boat is coming through with its
mast lowered and its crew hard at work.

The pelican rides up one side of the bridge, over the crown and down the
other.

**The joke (bar 2):** everyone looks. Heads turn to follow it across the
bridge; an arm points; the sedan-chair bearers stop. Under the arch, the
boat's crew, who have a mast to mind and an arch a hand's breadth overhead,
have all stopped work to look up. One man asleep against a stall post does
not wake, and the donkey is not interested.

## Materials

- **Ground.** Old silk, `GROUNDS.silk`.
- **Ink line.** Fine and even (`line` brush): ruled, straight lines for
  timbers, railings, roofs, the boat; freehand line for people, trees and
  water.
- **Light colour.** Thin washes only, inside the lines: umber and ochre for
  wood and thatch, pale indigo-grey for roofs and some clothing, a faint
  red-brown and a dull green here and there, a pale green wash on the
  willows. Water and sky are bare silk.
- **Water.** A net of fine fish-scale ripple lines, denser around the boat
  and the bridge footings.
- **No strong black, no heavy wash, no bright colour.** The picture is
  small-voiced and exact.

This is the "architectural painting" member of the ink family: ruled line and
thin colour over the kit's silk, ink tones and sheets.

## The bridge

The scene supplies `road(x)`: level at 700, then a smooth arch.

```
road(x) = 700 − 80 · cos²(π (x − 500) / 740)   for |x − 500| < 370
        = 700                                   otherwise
```

So the deck rises from x = 130, crowns 80 units up at x = 500, and is level
again from x = 870. (`tools/check.mjs` requires it level for x ≤ 100 and
x ≥ 900 and no steeper than 1 in 2.)

- **Deck:** drawn with a little depth: its far edge about 24 units above the
  road line, so people can stand at different depths. The pelican rides on
  the road line.
- **Arch:** beneath the deck, bundles of long timbers lashed with cross
  pieces, seen from the side, about 14 units thick, springing from stone
  abutments at x ≈ 130 and 870.
- **Railings:** a far railing behind everyone, a near railing about 16 units
  high in front of the deck (it may cover the bottom of the wheels).
- **Ends:** on the level ground at each end, shopfronts and a tea stall,
  mat awnings and big square umbrellas on poles.
- **The boat:** under the arch at x ≈ 380 – 640, deck at y ≈ 720, cabin
  with a woven-mat roof, the mast lowered on its hinge, a long steering
  oar; water line near y = 770. Eight or so crew: on the cabin roof, at
  the bow with poles, hauling a rope.
- **Far bank:** willows in early leaf and a few roofs, pale, between
  y = 470 and 560.

## People

About **90 units tall**: next to them the pelican on its bicycle stands as
tall as a rider on a horse, which is how this painting treats riders.

Twenty to thirty on the bridge and its ends, mostly on the far half of the
deck (feet 8–22 units above the road line) so the pelican passes in front of
them; three or four at the near railing. Song townspeople: short jackets and
trousers, head cloths, a scholar in a long robe, a monk, women with children.
Simple bodies in fine line and a little wash; what matters is that the crowd
is varied and busy.

Bodies are painted once. **Heads are redrawn each frame** so they can turn:
each figure looks towards the pelican from the moment it comes within about
300 units until it is about 300 units past, turning through front view as it
goes by, each with its own small delay. A few raise an arm to point. The crew
on the boat tilt their heads up while the pelican is over the arch
(u ≈ 2.2 – 3.8).

Two exceptions, never moving: the sleeper against the stall post near
x ≈ 730, and the donkey.

## The pelican

Fine even ink line and pale flat colour, like the small figures of the
scroll: white body, ochre bill, red-brown legs, ink bicycle. The pelican in
`song.js` is close to what is wanted and may be adapted. It tilts with the
slope of the deck.

## Camera, bar 2

Optional `camera(u)`: follow the pelican up a little and ease back slightly
(zoom no lower than 0.88) around u = 3 to take in the crowd and the boat,
returning to neutral at u = 2 and u = 4 exactly. If you use it, paint y from
380 to 840.

## The three bars

| u | |
|---|---|
| 0 – 2 | Entrance along the level street, past the first stall, onto the rise. Title at the left. First heads turn. |
| 2 – 4 | Over the bridge. At **u = 3.0 the pelican is on the crown**, every head on the bridge is turned to it and the boat's crew are looking up. |
| 4 – 6 | Down the far side, past the sleeper and the donkey, heads following from behind. Level by x = 870. Exit. |

The pelican keeps the standard pace.

## Title

A title slip at the upper left, as on a handscroll:

- A narrow upright slip at **x 60 – 96, y 446 – 590** with 清明上河图 in
  regular script (Kaiti SC or STFangsong), about 22 units per character.
- Beside it a small column: 约公元一一〇〇年, about 11 units.
- At x 104 – 250, y 556 – 590, two lines in a serif italic, about 10 units:
  `Along the River During` / `the Qingming Festival · c. 1100 CE`.
- One red seal.

## Gallery still

`still: { u: 3.0 }`: the crown of the bridge.

## How to build it

- Bake the fixed picture (far bank, water, bridge, stalls, boat, bodies,
  title) as ink sheets with thin colour, over x −80 … 1080 and y 420 … 800
  (or 380 … 840 with the camera move).
- Per frame: heads and pointing arms for the figures in view, the pelican,
  then the near railing over them.
- Heads are about 12 units across. Keep each to a few marks and group all
  of them by tone so the frame needs only a handful of brush passes; or
  draw them on a small ink sheet and multiply it on.

## Sound cues (for Stage 4)

| u | Event |
|---|---|
| 1.5 | Wheels meet the rise |
| 3.0 | The crown: gong and drum |
| 4.6 | Level ground again |

## Check on the contact sheet

- Reads as ink and light colour on silk; the bridge timbers are ruled and
  convincing; colour is thin.
- The bridge is one clear arch and the pelican follows its deck, tilted with
  the slope, wheels on the surface.
- At u = 3.0 at least fifteen heads visibly face the pelican and the boat's
  crew look up.
- The sleeper and the donkey never move.
- The crowd is varied; no two neighbours are copies.
- The pelican is in front of the far crowd and not lost in it.
- Title legible, three parts.
- `tools/check.mjs` passes (road and camera).

## As built

- `road(x)` exactly as above; `camera(u)` lifts 10 units and eases back to 0.9 around u = 3 (neutral at u = 2 and 4). Painted y 380–840.
- One baked ink sheet (x −80…1080, y 380…840, 3.3 px/unit): fish-scale ripples on a 2D canvas, then far bank (willows, roofs), streets and shops at both ends, the boat and its crew, the lowered mast, stone abutments, a polygonal timber arch of two interleaved log systems lashed at the nodes, deck, far railing, stalls, the sedan chair, the sleeper (x ≈ 736), the donkey (x ≈ 846), 29 townspeople, the near railing and three people sitting on it. Bodies are headless on the sheet; each head is a knocked-out face ellipse.
- Per frame: silk, the sheet multiplied on, every visible head (and three pointing arms) on a 2D sheet multiplied on, the title slip, the pelican; then the near railing and the near sitters are put back over the pelican from a copy of the frame cut to their silhouettes (a baked inverse mask).
- Title: the English lines and the seal sit at the top right of the slip (x 116–278, y 454–500), not at y 556–590 as briefed, because the pelican's head passes through y 556–590 at x 100–250. The English is two lines of Baskerville italic at 13 units (baselines 463.5 and 479.5; capitals and digits 27 to 29 px on screen at zoom 1.1), the seal below them at y 486–500. The whole title spans x 60–278. The slip is x 60–96, y 446–570.
- Head turning: each head looks at the pelican's head from 330 units away (full at 250), turning through front view as it passes, each with its own delay (0–0.35 s). Crew tilt their heads back hard between u ≈ 2.0 and 4.15. The two men standing on the cabin roof (x 486 and 540) keep their own profile (yaw0) instead of turning to follow, because the pelican passes straight over them and a front view shows no tilt; the haulers and polers turn and tilt as before.

**Stage 5.** The English lines went from 10 to 13 units (they measured 22 px; now 27 to 29 px), the second line now ends at x 278 (title sprite 226 units wide), and the seal moved down 4 units to clear it. The two roof men now tip their heads back in profile like the haulers at the bow, with the same timing; at rest and outside u 2.0–4.24 they are unchanged. Their heads sit against the lower log of the arch as they did before Stage 5 (the tilt does not raise them).
