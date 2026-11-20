# Section 12 · 梵高《星夜》 · The Starry Night

| | |
|---|---|
| Date on the title | 1889 年 · 1889 |
| Film time | 71.0 s – 77.0 s |
| Code | `src/scenes/starry.js` |
| Homage | Vincent van Gogh, *The Starry Night* (1889). Public domain. The picture is rebuilt as a long frieze for this film; no stroke is traced. |

## The idea

Oil paint laid on thick in short, directional strokes. A night sky that is
all movement: a great double spiral, eleven stars each in its ring of
strokes, a crescent moon in a blaze of yellow; blue hills rolling under it; a
village with a few lit windows and a thin church spire; a dark cypress
flaming up at the left. A lane runs along the foot of the picture, and on it
the pelican.

**The joke (bar 2):** the sky is geared to the bicycle. The spirals and the
star-rings turn exactly as the wheels turn. In bar 2 the pelican eases almost
to a stop, and the heavens wind down with it like a clockwork toy; then it
stands on the pedals, and the whole sky spins up and races.

## Materials

- **Paint.** Thick, opaque, ridged. Every stroke is a short loaded dab,
  roughly 4 – 9 units long and a third as wide, with a lit edge and a
  shadowed edge so it stands up from the canvas, and with streaks of a
  second colour dragged through it.
- **Direction.** Strokes follow the flow of what they describe: round the
  stars in rings, along the spirals, over the hills in long waves, up the
  cypress in flames, level along the lane. Nothing is filled flat.
- **Palette.** Prussian and ultramarine blue `#16306b` `#2a4f9e`, cobalt
  and pale blue `#5f8fd0` `#a9c6e6`, blue-green `#2f7f86`, white, chrome
  yellow `#f4c430`, orange `#e98a1f`, a dark green-black for the cypress
  `#12241c`, small touches of red-brown in the roofs.
- **Canvas.** A faint weave where paint is thin; a narrow strip of bare
  primed canvas showing here and there between strokes.

## The picture

World units; the lane is the road, y = 700.

- **Sky, y 433 – 640.** The double spiral centred near (520, 520), about
  240 units across. Stars: one very large and pale near (260, 520), ten
  smaller ones scattered, each a yellow-white core in rings of pale blue and
  yellow strokes. The moon at about (850, 480): an orange crescent inside a
  yellow-green disc of light. A long band of pale strokes low along the
  horizon.
- **Hills, y 590 – 665:** blue, rolling up towards the right, outlined in
  dark strokes.
- **Village, y 630 – 700:** small houses in blue-greys with dark outlines
  and five or six orange windows; a church at about x = 560 with a thin
  spire rising to y ≈ 555.
- **Cypress:** at about x = 170, a tall dark flame from below the lane's
  far edge to y ≈ 445. It stands behind the lane: the pelican passes in
  front of it.
- **Lane, y 700 – 740,** pale ochre and green strokes laid level;
  **foreground, y 740 – 790,** dark blue-green field strokes, where the
  title is painted.

Paint the whole width from x = −60 to 1060.

## The sky turns

Everything in the sky flows along its rings and spirals by an angle
proportional to the wheel angle, `f.pelican.wheel`, so it follows the
bicycle's speed without any extra bookkeeping:

- the double spiral: one arm clockwise, one counter-clockwise, like meshed
  gears, about one revolution for every five turns of the wheel;
- each star's rings: about one revolution for every two and a half turns
  of the wheel, alternate stars in opposite senses;
- the moon's halo: slowly.

Hills, village, cypress and lane do not move.

Thousands of moving strokes are far too many to draw one by one each frame.
Render the sky in a **fragment shader**: define the flow field (rings round
each star and the moon, the two spirals, a gentle horizontal drift
elsewhere), lay stroke-shaped cells along the streamlines, give each cell a
colour from the palette by hashing its index, a ridge of light and shadow
across its width, and advance the cells along the streamline by the turn
angle. Bake the still parts with the same stroke language (the shader with
the phase fixed, or strokes drawn on canvas).

## The pelican

Painted in the same strokes, per frame, few colours: body and neck built from
short curved dabs of white, cream and pale blue with a dark blue outline
stroke, as van Gogh outlined his figures; bill and pouch in chrome yellow and
orange; legs orange; the bicycle in dark blue contour strokes with a yellow
light along the top tube; tyres as rings of short strokes that visibly travel
round the rim; spokes as thin pale strokes. A small pool of yellow light
under the wheels.

## The three bars

The scene supplies `motion(u)`:

| u | |
|---|---|
| 0 – 2.2 | Standard pace. The sky turns steadily. |
| 2.2 – 2.9 | Easing down to about one eighth of the standard pace. The sky slows with it. |
| 2.9 – 3.3 | A crawl through the strong beat: the pelican balances, the stars barely creep. |
| 3.3 – 3.9 | Hard on the pedals, up to about 1.46 times the standard pace. |
| 3.9 – 5.3 | Racing; the sky with it. |
| 5.3 – 5.9 | Easing back to exactly the standard pace, and so through the frame. |

Leave `turns` to follow `x`, so the legs slow and race with the wheels.
While racing, lean the body forward a little (`lean`). `tools/check.mjs` must
pass.

## Title

Painted in the lower left corner as a signature is, at **x 60 – 330,
y 742 – 778** on the dark foreground, in loaded yellow strokes:

- 梵高《星夜》, about 20 units, on the upper line (y ≈ 741 – 761).
- `The Starry Night · 1889`, about 13 units, on the line below
  (y ≈ 764 – 777). Its capitals and digits must be at least 26 px tall on
  screen.

Lettering should look brushed in thick paint: slightly uneven, with a ridge,
not typeset. (Check that it clears the bottom of the picture at zoom 1.1,
where the visible area ends at y = 780.)

## Gallery still

`still: { u: 3.1 }`.

## How to build it

- One shader for the sky, world-anchored, taking the turn angle as a
  uniform; fade stroke detail that would be finer than two pixels.
- A baked layer for hills, village, cypress, lane, foreground and title.
- The pelican per frame on a patch or with a few brush passes.
- Check at half size that the strokes keep their proportions.

## Sound cues (for Stage 4)

| u | Event |
|---|---|
| 2.2 – 2.9 | Slowing: ritardando |
| 2.9 – 3.3 | Nearly still |
| 3.3 – 3.9 | Spin-up: accelerando |
| 5.9 | Back in tempo |

## Check on the contact sheet

- Reads as thick oil paint in separate directional strokes; no smooth
  gradients, no outlines filled flat.
- The spiral, the stars, the moon, the cypress, the spire and the hills
  are all there and in a good arrangement.
- Compare frames 0.1 s apart at u = 1.0, 3.1 and 4.5: the sky's strokes
  move a normal step, almost not at all, and a long step.
- Strokes flow along their rings; they do not swim or flicker at random.
- The pelican is bright against the lane and never hidden.
- Title legible, three parts, and inside the visible area.
- `tools/check.mjs` passes.

## As built

- **Sky** (`SKY_FRAG`, per frame, world-anchored, rect x −80…1080, y 418…712):
  stroke cells laid in bands along the flow. A background drift follows the
  stream function `flowT` (horizontal, bending round the vortices). Two
  Archimedean spirals with an unwrapped arc coordinate (A at 458,516, R 78,
  clockwise; B at 590,532, R 66, counter-clockwise). Eleven star-rings in
  `STARS`, alternate senses, the great pale star at 262,510. The moon at
  852,482 (R 47) has an orange crescent. Every stroke has a blunt loaded head,
  a tapering dry tail, a ragged edge, a lit and a shadowed edge, bristle
  grooves and a second colour dragged through it. Detail finer than about two
  pixels fades out.
- **Gearing:** `uSpin = W/5`, `uStar = W/2.5`, `uDrift = 2.6·W` units, with
  `W = wheel + extraWheel(u)`; `uMoon = wheel/12` stays on the true gearing.
  All are taken modulo their period, so the pattern never jumps. `extraWheel`
  is the integral of `1.5·smoothstep(3.3,3.9)·(1−smoothstep(5.3,5.9))` times
  the wheel's angular speed, tabulated once (Simpson, 1680 steps over
  u 3.2–6.0) and read by linear interpolation: zero to u 3.3, the sky at 2.5×
  its true gearing (3.65× standard) through the race, constant (in gear) from
  u 5.9.
- **Land** (one bake, 3.3 px/unit): `LAND_FRAG` paints the far and near hills
  with dark contour bands, the fields, the cypress (x≈170, up to y≈445), the
  lane (695–742) and the foreground (>740). A canvas pass of dabs adds the
  village (three rows of houses, each with a gable end, a shadowed side wall
  and six lit windows), the church with its spire to y 553, and the title.
- **Title** (third pass): the glyphs are only a mask (Xingkai SC 19.5 u for
  梵高《星夜》, Kaiti SC for `1889 年` after it, Noteworthy bold sized so
  capitals and digits are 10.5 u ≈ 33 px at zoom 1.1 for
  `The Starry Night · 1889`, lowest descender at y 774.5). The mask is
  rasterised once at 6 px/unit; at each sample inside it the direction of the
  longest run through the letter is the stroke direction, and a short loaded
  dab (1.3–3.6 u long, as wide as ~0.6 of the stroke) is laid along it, over a
  deeper-ochre underpaint, trimmed to the letters grown by 0.6 u so the edge is
  ragged. Yellows and a little orange, lit ridge, no drop shadow.
- **Pelican:** each feathered part is painted once as a dab sprite in its own
  principal-axis frame, then mapped onto the part every frame and clipped to
  it. Tyres are rings of strokes that rotate with `wheel`. Other parts are
  painted lines plus a dark-blue brushed outline, and a sprite pool of yellow
  light sits under the wheels.
- **motion(u):** pace 1 → 0.1238 (2.2–2.9) → crawl (2.9–3.3) → 1.46 (3.3–3.9)
  → 1.46 (to 5.3) → 1 (5.9), with smoothstep blends integrated in closed form.
  Unchanged in the third pass.
- **Acting** (zero for u < 0.6 and u > 5.4): looks up at the sky between 2.55
  and 3.6 (headPitch 0.62, bill tilted clearly upward at the still).
  Third pass: `restage()` re-poses the solved puppet. Balancing in the crawl
  (in 2.78–3.0, out 3.22–3.45): the body rocks ±0.085 rad about the hip and
  the bars ±0.11 rad about the head tube, period 0.85 s. Standing on the pedals
  (in 3.25–3.65, out 4.95–5.35): hips up 0.26 and forward 0.42 wheel radii
  off the saddle, a 0.12 r sink on every downstroke, lean 0.42 rad, the head
  pushed 0.85 r ahead and 0.36 r down so the neck stretches out; the wrist
  stays on the grip and the legs are re-solved from the lifted hip.

### Second pass (art director)

- **The great wave:** a third band loop in `SKY_FRAG` over its own stream
  function `waveT` (level flow plus a strong counter-rotating vortex pair at
  A and B), inside an ellipse centred (520, 522), 265 × 108. Bands are
  coloured in groups of two (white/pale, cobalt, ultramarine, pale/yellow-green,
  dark), so one striped S-shaped breaker runs in from the left, heaves over A,
  dives between the vortices and wraps B. It fades out below y ≈ 556–600 so
  the pelican's head never sits on pale wave. The spirals' outer windings are
  more ragged (cull band 2.6 pitches) so they melt into it.
- **Strokes:** stronger bristle grooves plus a finer wandering bristle
  scratch, both faded below two pixels.
- **Pelican outline:** a broken contour of dark-blue dabs laid *under* the
  tail, body, neck and head fills (`inkContour`), thick on the shadow side and
  breaking on the lit side; the rig's overlapping polygons leave no seams. Only
  the wing keeps a thin outline on top.
- **Cypress:** each side has its own curling lobes, so the edge licks like a
  flame instead of a smooth column.
- **Lane:** ragged lower edge (`laneB`), held up and clear of the signature;
  grass patches and two darker cart ruts.
- **Village:** clustered round the church and thinning between; ochre and
  green-grey walls added; the six lit windows chosen by position.
- **Stars** at (712, 552) and (944, 540), moved up out of the head's path.

### Third pass (verifier fixes)

- **Race reads:** the stand-up pose and the sky at 2.5× gearing above.
- **Calm ground for the bicycle:** in x 292–708 the front row of houses is
  dropped and the other two stand up on the hillside (bases 642/648, 0.78
  scale) behind a pale green-ochre verge (shader field raised to the hillside
  there, plus a canvas row of verge dabs over the house feet). No house sits in
  y 655–700 for x 300–700. The church and spire moved to x = 722 with the
  village clustered round it; the head passes the spire near u 4.55, not 3.9.
  The star that sat behind the head at u 2.0–2.5 moved from (368, 598) to
  (330, 552), r 15.
- **Pelican skin:** larger body, neck, head and tail dabs (8.2 × 2.9 u on the
  body) in white, cream, pale and mid blue with a few yellow, most with a
  shadowed edge; wing, fold, bill and pouch edges as broken brushed dabs
  (`brushEdge`), legs as loaded dabs over a darker stroke (`paintLimb`), tyres
  as strokes of uneven length (3–7.6 u), spacing and colour.
- **Moon** at (852, 494), halo R 38 (top at y 452, clear of the frame at any
  zoom): an orange crescent (disc r 17.5 minus a disc r 14.6 offset up-right)
  open to the upper right, in a yellow-green disc to r 21, then pale yellow,
  then blue and yellow-green outer rings.
- **Init** now paints every pelican sprite (`warmPelican`). The exit stretch
  (75.1–77.6 s) still plays at about 35–42 fps with this scene's draw mean
  ~6 ms; it stays that slow even with this scene drawing nothing after u 4.6,
  so the cost is in the neighbouring scene or the engine.

### Fourth pass (director's rulings)
- **Village:** every house now stands on the hillside behind the pale verge
  across the whole painting. The verge spans x −110 – 1110 (shader and dabs),
  houses stand at `villageFoot(x) − 10 + 6·row` (`villageFoot` = the field's
  top, floored at 640 so the eastern rise never lifts a roof near the bill),
  the front row is gone everywhere and the six farms are smaller and up on the
  hill. Nothing reaches below y ≈ 652; no step at x 708. The verge dabs skip
  the cypress (|x − 170| < 40).
- **Church:** small and pale blue-grey (nave 12 × 8, tower 5 wide from y 623,
  spire tip y 607), on the hillside at x 722 with a thin slate contour, under
  the verge.
- **Stars:** every star keeps ≥ 33 units (edge to head centre) from the
  head's path (y 577 – 587): big star (262, 500); (330, 532); (712, 528);
  (944, 526); (40, 530); the star at (618, 612) moved to (1012, 498).
- **Sky race:** `SKY_BOOST` 1.5 → 0.7 (spirals and small stars at most 1.7×
  the gearing); the great pale star runs in true gear (`uStarB`). At u 4.5 the
  furthest strokes move ≤ 0.39 of their length per 1/60 s (spiral A rim 5.1 u
  vs 13 – 19 u strokes; big star rim 3.4 u vs ≥ 9.3 u).
