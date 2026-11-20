# Section 13 · 蒙克《呐喊》 · The Scream

| | |
|---|---|
| Date on the title | 1893 年 · 1893 |
| Film time | 77.0 s – 83.0 s |
| Code | `src/scenes/scream.js` |
| Homage | Edvard Munch, *The Scream* (1893). Public domain. The picture is rebuilt as a long frieze seen along the bridge; nothing is traced. |

## The idea

Tempera and crayon on board: a sky of long wavering bands in orange, red and
yellow; a blue-black fjord whose shoreline swirls; two tiny ships; a wooden
walkway with a railing running the length of the picture, its planks rushing
away in hard diagonal strokes; far behind, two tall figures in dark coats and
hats.

Standing at the railing in the foreground, cut off by the bottom of the
picture, is a passer-by in a dark coat, looking quietly out over the water.

**The joke (bar 2):** we learn what the scream was about. The pelican comes
up behind the passer-by and, exactly on the strong beat, rings its bell. He
starts; in an instant he has swung to face us with both hands clapped to his
cheeks, his eyes and mouth round. The whole landscape jolts with him, a wave
running out through the sky and the fjord. The pelican rides on behind him
and does not look back. He stays as he is, and has been that way ever since.

## Materials

- **Board.** Unprimed grey-brown cardboard `#b39a78`, showing between
  strokes everywhere.
- **Marks.** Long, thin, wavering strokes laid side by side, chalky and
  dry, each a slightly different colour from its neighbours; in the sky and
  water they run in undulating bands, on the walkway in straight diagonals.
  p5.brush's charcoal and crayon-like brushes suit the figure and the
  pelican; the sky and fjord are better as a shader.
- **Palette.** Sky: blood orange `#d9482b`, red `#b8322a`, yellow `#e8b24a`,
  a streak of pale blue-grey `#8fa3ad`. Fjord and hills: blue-black
  `#1d2a44`, blue `#2f4f7f`, a dull green `#4f6a4a`. Walkway: red-brown
  `#8a4a2e`, orange `#c96f34`, with blue shadows. Figures: near-black with
  blue.
- **No outlines filled flat, no smooth blends.**

## The picture

World units; the walkway's surface under the wheels is the road, y = 700.

- **Sky, y 433 – 565:** five or six broad wavering bands.
- **Fjord and far shore, y 540 – 650:** the water a dark mass with a
  lighter, looping shoreline; rounded hills at the right; two small ships
  near (420, 600).
- **Railing:** top rail at y ≈ 652, two lower rails, posts every 80 units
  or so, behind the pelican. Drawn in long strokes of brown, orange and
  blue.
- **Walkway, y 700 – 790:** planks as long straight strokes fanning from a
  vanishing point far off to the left, so they rake across the foreground.
- **Two figures** at about x = 130, small (about 80 units tall), dark, in
  tall hats, beyond the pelican's path.
- **The passer-by,** in the foreground at **x ≈ 640**, nearer than the
  pelican: head about 44 units wide and 58 high with its top at y ≈ 612,
  narrow shoulders, a dark sinuous coat running out of the bottom of the
  picture.

The pelican passes *behind* the passer-by. His head covers part of the
bicycle for a moment; the pelican's head and neck stay visible above him.

## The passer-by

Two drawings built from the same set of points, so one can turn into the
other:

- **Before:** three-quarter back view, turned to the fjord, head a plain
  oval with a hint of nose, arms down, one hand on the rail.
- **After:** square to us, head a long skull-like oval tilted slightly,
  both hands flat against the cheeks, eyes two small rings, mouth a tall
  oval. The pose everyone knows, drawn afresh.

He changes from one to the other in about a tenth of a second, at u = 3.0.

## The jolt

- The pelican's bell: at u = 2.95 a few short bright strokes flick out from
  the bell on the handlebar.
- At u = 3.0 the bands of sky and the shoreline, which until now have
  undulated slowly, are hit by a wave that spreads outwards from the
  passer-by's head at about 400 units a second: their waviness more than
  doubles as it passes and then settles over about two seconds to a level
  rather higher than before. Their colours shift a step towards red.
- The railing and walkway shudder by a unit or two for a quarter second.

## The pelican

In Munch's manner, per frame with a few brush passes: a pale, slightly
ghostly bird in long strokes of white, grey-blue and a little green, a dark
blue-black contour that wavers; bill orange-yellow; legs dull orange; the
bicycle in dark wavering line. It keeps the standard pace throughout and
looks straight ahead.

## The three bars

| u | |
|---|---|
| 0 – 2 | Entrance. The two distant figures; the passer-by ahead, back turned, calm. The sky moves slowly. |
| 2.0 – 2.9 | The pelican closes on him from behind. |
| 2.95 | The bell. |
| **3.0** | He starts and turns: hands to cheeks. The wave begins. |
| 3.3 – 4.2 | The pelican passes behind him. |
| 4 – 6 | He stays frozen in the pose, sliding away to the left. The sky is slow to calm. Exit. |

No change of pace, no camera move.

## Title

Lettered in the lower left corner in crayon, at **x 50 – 310, y 742 – 778**,
pale yellow on the red-brown planks:

- 蒙克《呐喊》, about 20 units, in a handwritten face (HanziPen SC or
  Hannotate SC), roughened, on the upper line (y ≈ 741 – 761).
- `The Scream · 1893`, about 13 units (Bradley Hand or similar), on the
  line below (y ≈ 764 – 777). Its capitals and digits must be at least 26 px
  tall on screen.

(The visible area ends at y = 780 at zoom 1.1; keep the lettering above
that.)

## Gallery still

`still: { u: 4.4 }`: the pelican just clear of the passer-by, who is in the
pose.

## How to build it

- Sky and fjord in a shader: wavering bands made of parallel strokes with
  per-stroke colour, their displacement the sum of the slow undulation and
  the travelling wave; board showing between strokes.
- Railing, walkway, distant figures and title baked from brush or canvas
  strokes.
- Per frame: the passer-by (he must be drawn so that the before and after
  share their points), the pelican, the bell strokes.
- Order: sky, fjord, railing, pelican, walkway foreground, passer-by.

## Sound cues (for Stage 4)

| u | Event |
|---|---|
| 2.95 | Bicycle bell |
| 3.0 | The start: strings slide out of tune into a scream |
| 3.0 – 5.0 | The landscape settles |

## Check on the contact sheet

- Reads as Munch's picture in its materials: wavering chalky strokes on
  bare board, the hot sky over the cold fjord, the raking planks.
- At u = 2.9 the passer-by is an ordinary calm figure with his back turned;
  at u = 3.2 he is unmistakably *the* figure.
- The wave can be seen leaving his head and crossing the sky.
- The pelican's head is visible the whole time it is behind him.
- He does not move again after the change.
- Title legible, three parts, inside the visible area.

## As built

(Revised after verification; the director's rulings override the brief where they differ: passer-by lower, far figures off the pelican's line, a held jerk pose instead of a mixed in-between, a wave that bends the land rather than rings.)

- **Land (`LAND_FRAG`, per frame).** Sky, far hills, fjord, shoreline, near bank and walkway are one shader over x −90…1090, y 405…815: two offset layers of parallel chalk strokes (per-stroke colour, tapered ends, dry break-up along the stroke) on bare board `#b39a78`. Strokes are long along their bands (sky about 400 units, water 240, shore 260, bank 300, hills 180) with little colour jitter inside a band. Sky: six broad bands (deep red, orange, yellow, blood orange, pale blue-grey, orange-yellow) 21 units deep, on a long sweep that rises and falls across the picture, broad strokes (3.6 spacing). Fjord: a dark blue-black mass of thinner strokes (2.2 spacing) that swing round with the shore, in the water's own colours only (no sky reflection near the horizon). Shoreline: one strong S-curve of pale ochre, 8–14 units thick, centred y ≈ 619 ± 19 with a wavelength of about 750 units (low under the ships at x ≈ 430). Hills: dark green to blue-black by depth, strokes along the outline. Walkway: strokes fanning from 0.31 rad to 0.45 rad, plank seams, darker planks under the title. Detail fades to a mean colour below ~3 px per stroke.
- **The jolt.** From u = 3.0 a front leaves his head (640, 683) at 400 units/s (y stretched 1.25). Nothing is drawn on top: the front lifts the band strokes of sky, hills, water and shore (a crest of up to 16 units, a smaller trough 0.2 s behind, a small rebound at 0.42 s), pushing them away from his head, and the strokes it is passing flare in colour (sky hotter yellow, water brighter blue, hills and bank brighter green). Waviness rises to ~2.6× at the front and settles to 1.55× over about 2 s, colours shift towards red behind the front. Railing, walkway and title shudder up to 1.8 units for 0.25 s.
- **Baked:** railing (each rail with a slow shared waver of about 3–5 units over its length plus the hand's own), two ships, and the two far figures in `scream/rail`. The far figures stand beyond the railing (drawn first, so the rails cross them), feet at y 668, about 68 units tall, at x ≈ 114 and 143, blue-grey (`#68778f` ground, three tones of vertical chalk strokes), leaning slightly (opposite ways) with an S-curve of one full wave from hem to head, shoulders about half as wide as the hem, coat outlines smoothed so no side runs straight, dark hat and dark head with a small pale touch of cheek, no face disc, legs tapering. The dark bicycle reads over them at u 0.5–0.8.
- **The passer-by:** a bust cut by the bottom edge at x = 640, head centre (640, 687), top of the head at y ≈ 660, so the pelican's body, neck and head stay above him and only the wheels pass behind. Three baked drawings in `scream/fig/*`: *before* (u < 3.0): three-quarter back view, the head mostly dark cropped hair; the hairline curves down behind the ear and is softened by a warmer half-tone margin and short feathering strokes; a narrow sliver of cheek on the turned side with a cool shadow; one ear on the hairline (a skin lobe with an outer rim, not a ring); no eye, nose or jaw line; white collar, shoulders relaxed, arms down out of the picture; *jerk* (3.0 ≤ u < 3.045, three frames held at 60 fps): shoulders up nine units, head half round towards us with a crescent of hair at the back, ear on the far side, one eye ring and a small open mouth, arms still down; *after* (u ≥ 3.045): bald skull shaded green and blue, ringed eyes, nostrils, dark oval mouth, hands with fanned fingers flat on the cheeks, elbows out. Coat of four colours of long strokes over blue-black.
- **Rails behind the wheels:** each frame, where a tyre crosses a rail, a lighter tan band (`#b98a62`) with a pale highlight is drawn over that rail on the same wavering line, fading at both ends, so the dark rims read.
- **Pelican:** p5.brush per frame, about 11 passes grouped by colour: bike and shadow; legs; a pale ground wash; white, grey-blue and green form strokes; bill wash; pouch strokes; blue-black contour; the bell flick from 2.95 to 3.25. The tail is three short tapering strokes per feather (white, grey-blue, a thin dark line under), no outline.
- **Title:** 2D mask lettered in HanziPen SC / Bradley Hand, drawn through `CRAYON_FRAG`, x 44…316, Chinese baseline y ≈ 752, English y ≈ 770, about 30 px capitals on screen. Its sprite and both shaders are made in `init` with the bakes.
- Still at u = 4.4.
