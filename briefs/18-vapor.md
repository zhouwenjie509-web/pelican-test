# Section 18 · 蒸汽波 · Vaporwave

| | |
|---|---|
| Date on the title | 21 世纪 10 年代 · 2010s |
| Film time | 107.0 s – 113.0 s |
| Code | `src/scenes/vapor.js` |
| Homage | The vaporwave look of the 2010s: an internet style, not a work. No album cover, artwork, brand or character is imitated; the composition is new. |

## The idea

A pink, purple and cyan evening that never ends. A sky graded from violet
through magenta to peach; a huge pale sun cut by horizontal bars; a glowing
grid floor running to the horizon; low-poly palm trees; and along the
roadside, on fluted stumps of column, white marble busts in the classical
manner. Over everything, the soft scan lines and colour bleed of a worn video
tape, with `▶ PLAY` and a counter in the corner.

The pelican glides through in pastel and chrome.

**Two jokes.**

1. **The busts watch.** They are stone, so they never move. But on every
   beat each of them is found facing the pelican a little more squarely than
   on the beat before.
2. **The tape skips (bar 2).** At u = 3.0 the picture catches: the same
   quarter second plays four times over, world and pelican and counter
   snapping back each time, and at u = 4.0 it jumps forward to where it
   should be and carries on as if nothing had happened. (The music does
   exactly this at the same moment.)

## Materials

- **Colour.** Violet `#2b1055`, purple `#7b2cbf`, magenta `#ff4fd8`, pink
  `#ff9ad5`, peach `#ffd6a5`, cyan `#3df2ff`, teal `#19b5c8`, and marble
  white `#f3eef7`. Smooth gradients and hard flat facets, nothing between.
- **Light.** Everything is lit pink from one side and cyan from the other.
- **Low-poly.** Palms and busts are made of flat triangles and quads, each
  facet one flat colour chosen from its direction.
- **Tape.** Fine horizontal scan lines; red and cyan fringes offset by a
  unit or so at high-contrast edges; a band of noise along the very bottom
  edge; a slow vertical wobble of about half a unit; slight softness.

## The scene

World units. This is a screen, so depth layers may slide at different rates.

- **Sky, y 433 – 640,** gradient as above, with a few thin long clouds.
- **Sun:** radius about 90, centred near y = 600, nearly fixed on screen
  (a very far layer), yellow to pink from top to bottom, its lower half cut
  by five dark bars that thicken downward. Its centre stays about 150 units
  to the right of the middle of the view: the pelican rides towards it and
  is seen against the darker sky, never against the pale sun.
- **Mountains:** a low-poly range on the horizon in cyan wire and violet
  facets, a far layer.
- **Grid floor, y 640 – 790:** cyan lines on deep violet in true
  perspective: horizontal lines bunching towards the horizon, depth lines
  fanning from a vanishing point at the centre of the view and sliding as
  the camera moves. The road at y = 700 is one lane of it, slightly
  brighter.
- **Palms:** on the far side of the road, 180 – 230 units tall: a trunk of
  stacked tapering segments in two tones, a crown of seven or eight
  triangular fronds. Four or five of them, unevenly spaced. None between
  x 400 and 640 (see below), and none whose crown crosses the title window
  unless it plainly passes behind it.
- **Busts:** three, at **x ≈ 225, 700 and 880**, on the far side of the
  road: a fluted half-column about 55 units high and on it a head and
  shoulders about 80 units high, the top of the head no higher than y = 552.
  Classical, generic, different from one another (a bearded man, a youth, a
  woman with bound hair); not any known sculpture. Shade them firmly in
  pink, cyan and violet facets, so they are clearly coloured stone and never
  the same pale tone as the pelican.
- **The pelican's path.** The stretch x 400 – 640 is where the tape skips
  (the pelican is seen there for a whole second), so nothing stands behind
  the pelican there: no bust, no trunk, only sky, sun, mountains and grid.
  During the skip the bust at x = 700 is in view ahead of the pelican,
  watching, with clear air between them. The pelican does pass in front of
  each bust at other times (about u = 1.35, 4.2 and 5.3); it must stay
  readable when it does (see The pelican).
- **Tape furniture,** travelling with the pelican (laid out relative to
  `f.pelican.x`): `▶ PLAY` at the upper left of the view and a counter at
  the upper right, both between y 446 and 462, in a chunky white video font
  with a dark edge. The counter shows the real film time with a frames
  field, thirty to the second: `0:01:47:00` at the start of the section and
  counting up, so that the stutter of the skip can be read in it.

## The busts

Model each head as a small low-poly solid (forty to eighty vertices: skull,
brow, nose, lips, chin, hair, neck, shoulders), rotate it about its vertical
axis, project it flat, and shade each facet by its direction. Bake five
views of each: profile left, three-quarter left, front, three-quarter right,
profile right.

Which view is shown is decided **only on the beat**: at each half second,
take the direction from the bust to the pelican and pick the nearest view.
Between beats nothing changes. So a bust looks left towards the approaching
pelican, is found a step further round on a later beat, and ends looking
right after it.

## The pelican

The flat canvas skin with a pastel palette (white body with a pink shade, a
peach bill, a magenta pouch, cyan legs), the bicycle in chrome: a vertical
gradient from pale cyan through white to pink with a dark horizon line, as
chrome was painted on 1980s lettering. A faint red and cyan fringe like the
rest of the tape. A soft pink reflection of it on the grid below.

Give the whole figure a firm outline in deep violet (`#2b1055`, about 1.3
units), so that it reads at a glance against the sun, the grid and the
busts alike.

## The skip, bar 2

Define the tape's time:

```
tape(u) = 3.0 + ((u − 3.0) mod 0.25)   for 3.0 ≤ u < 4.0
        = u                             otherwise
```

Everything the scene shows is drawn for `tape(u)` instead of `u`: the
scenery's position (shift every layer by the distance the camera has moved
between `tape(u)` and `u`), the pelican's pose, the busts, the counter. The
pelican stays where the camera has it, in the middle; it is the world that
jumps back under it three times and then forward.

While the skip lasts, a bright tracking bar about 14 units high sits across
the picture near y = 525 with torn edges (above the pelican's head, which
tops out at y = 566; the bar must not touch the pelican), the colour fringes
widen, and `▶ PLAY` flickers.

## The three bars

| u | |
|---|---|
| 0 – 2 | Entrance. The title window. The first bust (x = 225), already facing the pelican as it arrives, turns a step on each beat: it has gone from one profile to the other by u = 2.5. |
| 2 – 3 | The second bust (x = 700) comes into view ahead, watching. |
| **3.0 – 4.0** | The skip: four repeats of a quarter second, the pelican between x 500 and 542 with clear sky behind it and the second bust ahead. |
| **4.0** | The picture jumps forward (the pelican is now at x = 667, passing the second bust) and continues. |
| 4 – 6 | The second bust turns after it; the third (x = 880) faces it and turns. Exit. |

The pelican's true motion is the standard pace. No camera move.

## Title

A plain bevelled window of the kind 1990s desktops had (invented, generic),
fixed in the world at **x 150 – 420, y 448 – 546**, floating in the sky,
with a title bar and a close box:

- 蒸 汽 波, about 24 units, widely spaced, in a Song or Mincho face.
- `ＶＡＰＯＲＷＡＶＥ` in full-width capitals, 13 units or more: the
  capitals at least 26 px tall on screen.
- `２０１０ｓ · 21 世纪 10 年代`, 13 units or more: the digits at least
  26 px tall on screen.

Keep the three lines below y = 466, so the tape's `▶ PLAY` (which travels
with the pelican along y 446 – 462) never crosses them. The window is opaque;
nothing shows through its lettering.

## Gallery still

`still: { u: 3.2, cx: 615 }`: a frame from the skip. The square shows world
x 438 – 792: the pelican at the left (x 464 – 598 in tape time), the second
bust at the right, facing it, the tracking bar across the sky above them.
The title window ends at x = 420 and is outside it.

## How to build it

- Sky, sun, mountains and palms baked as layers and slid by depth; the grid
  drawn per frame (or in a shader) from the camera position.
- Bust views baked once.
- The tape look as one full-frame pass at the end.
- Take the camera position from the view (`f.view.wx(f.w / 2)`), and use
  `f.film.pelicanFor(f.n, t)` for the pelican's pose at tape time.

## Sound cues (for Stage 4)

| u | Event |
|---|---|
| 0 – 0.8 | Tape slows into the section |
| 3.0, 3.25, 3.5, 3.75 | The skip: the same half beat four times |
| 4.0 | Playback resumes |
| 6.0 | Tape runs back up to speed |

## Check on the contact sheet

- Reads at once as vaporwave: the gradient, the barred sun, the grid, the
  palms, the busts, the tape.
- The grid's perspective is right and it moves convincingly.
- Busts: three different heads, well modelled in facets; their view changes
  only between one beat and the next.
- Frames at u = 3.05, 3.30, 3.55 and 3.80 are the same picture; the frame
  at u = 4.0 is clearly further along.
- During the skip nothing stands behind the pelican, and the second bust is
  in view ahead of it with clear air between.
- The pelican reads at a glance in front of every bust it passes.
- The counter reads the film time and stutters with the skip.
- Nothing recalls a particular album cover or artwork.
- Title legible, three parts.

## As built

- Layers as planned (sky, sun, clouds, two mountain ranges baked; grid in one shader;
  palms at depth 0.667, busts at 0.833; pelican on a canvas patch; one tape pass).
- Busts: ring stacks of 16 vertices (socle, U-cut chest with square shoulders, forward-leaning
  neck, head with brow, sockets, nose, lips, chin, ears carved per column), plus icosahedral
  curls (man's hair and beard, youth's cap), long flat locks and a bun (woman), almond eyes.
  Heads scaled 1.16 about the chin. Facets lit pink (upper left), cyan (right) and magenta from
  the floor. Lab: `dev/lab.html?exp=vapor-busts` (`&big=man|youth|woman`, `&scale=1`).
- View chosen only on beats of tape time: `clamp(round((pelX_at_beat − bustX)/83.33 + 2), 0, 4)`.
  Bust 1: 0→1 at u 1.0, 2 at 1.5, 3 at 2.0, 4 at 2.5. Bust 2: 0 until 4.0, then 2, 3 at 4.5,
  4 at 5.0 (the beat at 3.5 is lost in the skip). Bust 3: 1 at 5.0, 2 at 5.5, 3 at 6.0, 4 at 6.5.
- Title lines: 蒸汽波 baseline y 492, ＶＡＰＯＲＷＡＶＥ 507.6, date 539.2; an etched separator at
  517.6; the tracking bar runs y ≈ 508–528 in that gap and never crosses lettering.
- Reflection drawn sharp at half resolution and blurred in one pass (a filter per shape cost
  170 ms a frame).
- Second pass: chests remodelled (short tight bowl, arms cut straight, shoulders sloping to the
  neck, narrower: man 19.5, youth 18.5, woman 16.5 half-width) so they no longer read as urns;
  heads set about 1.2 lower (shorter necks). Each nose is now a wedge of its own (ridge, two flat
  sides, wings); eye sockets and mouth carry a violet shadow tone per facet. The youth has a cap of
  short comma locks combed forward instead of the man's curls; the woman's knot sits high at the
  back (no longer a duck-bill in profile), with a crescent diadem and finer locks.
- The palm formerly at x 792 now stands at x 815: it no longer grows out of the back of bust 2
  through the skip and the still, and clears bust 3 at the exit.
- PLAY and counter have a heavier dark edge so they read where they cross the window's title bar.
- Third pass (after verification; the director's rulings):
  - Busts are coloured stone in mid tones: violet in the hollows and on planes turned away,
    purple and orchid on the body of the stone, the pink key only on planes turned squarely to it,
    a cyan rim on the far side. Every facet's luminance is capped at that of `#d79be8`; the pelican
    stays the palest thing after the sun and the title window.
  - Busts modelled as busts: a separate socle with a flat top; a chest block with depth (front and
    back about 0.7 of the half-width), cut flat underneath, the arms cut off in flat vertical planes
    (high superellipse exponent) shaded as a smoother, paler sawn face, a near-flat ledge on top
    from which the neck rises, the shoulders sloping down to the arm cuts. Heads 1.33 x (were 1.16).
    Hair facets fewer and larger (man's curls spacing 5.0 / beard 4.3; youth's locks 3.8;
    woman's locks 3.6), curls flatter to the skull. Five views each, checked large and at film scale.
  - Column stumps per bust: tops at y 644.9 (man, head top still about 558, under the title
    window), 621.5 (youth) and 620 (woman), so the heads of busts 2 and 3 top out near y 538 and
    their faces look over the pelican's head when it passes (u 4.2, 5.3).
  - Pelican legs peach to orange (`#ffd0a0` to `#ffa066`, far leg `#d9774c`, feet `#ff9a5c`),
    with the skin's violet ink edge.
  - Sun centre y 572, radius 90; five bars at 2, 10, 18.5, 27.5, 37 units below the centre,
    1.8 to 5.2 thick; the mountains lowered (far range 10-30 high, near 5-22) so all five show.
  - Title window x 160-410 (250 wide): whole on screen from about u 0.67 to 2.76. The caption
    bar holds only the close box; no text.
  - Palms: seven long fronds each, three straight runs per leaf, upper and lower halves as flat
    facets (six facets a leaf), drooping, with a midrib. Palms now at x -170, 60, 1020, 1210,
    1420: no trunk comes within 60 units of a bust while the pelican passes it, and none stands
    between the pelican and bust 2 in the skip.
  - Event times unchanged (tape(u), the skip, bust views on beats, counter).
- Fourth pass (the director's second round):
  - Bust 1 (the bearded man) moved out from under the title window to x 120 and raised to the
    height of the others (column top 624.2, top of the head near y 538). The pelican passes it at
    u ≈ 0.7 with the bust front-on, its face above the pelican's head. Views on beats, as before:
    1 at u 0, 2 (front) at 0.5, 3 at 1.0, 4 at 1.5. Parallax (busts at depth 0.833, window at 1)
    carries it under the window's lower edge from about u 1.6, so the window then covers the top
    of its hair until it leaves the screen.
  - Bust 1 remodelled: the chest round at front and back and sawn flat at the sides (a flat `cut`
    plane in the ring profile), the shoulders sloping in one long line from the arm cut up to the
    neck. Hair and beard are no longer curls: each is a coarse faceted shell over the head (hair
    10 columns x 3 rows closing on the crown, beard 6 x 2 closing on a point), every other vertex
    raised so the planes fold like big locks.
  - The woman's hair: four broad waves a side, ribbons with a lit crest and a shadowed underside,
    running from the parting down over the ear and back up into the knot; the two triangles of each
    ribbon facet share one normal so each reads as one plane. Bust 2 (the youth) is unchanged.
  - Palms now at x -170, -80 (lean -10), 1020, 1210, 1420. The one at -80 stays behind the left
    picture frame until u ≈ 0.96, so no trunk stands behind the pelican's head or bill at the entry;
    its trunk stays at least 66 units from bust 1's axis (about 40 from its chest) while both are on
    screen; nothing between x 400 and 640.
  - Unchanged: tape(u), the skip (frames at u 3.05, 3.30, 3.55, 3.80 byte-identical), the sun, the
    legs, the title window, the tape look, the counter, the event times.
