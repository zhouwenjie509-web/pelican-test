# Section 14 · 《诺斯费拉图》 · Nosferatu

| | |
|---|---|
| Date on the title | 1922 年 · 1922 |
| Film time | 83.0 s – 89.0 s |
| Code | `src/scenes/nosferatu.js` (uses `src/rig/skins/phosphor.js` from Section 15) |
| Homage | F. W. Murnau's *Nosferatu* (1922) and German Expressionist silent film: the shadow that climbs a staircase by itself. The film is in the public domain. The set, the staircase and the poster here are newly designed; no frame is reproduced and no character from the film appears. |

## The idea

A silent film. A plastered wall in a tall, dim house, lit from somewhere low
and out of sight: a hall, then a staircase with a turned balustrade rising to
a landing with an arched door. The picture is tinted the cold blue-green that
silent films used for night, and it flickers, weaves in the gate and is
scratched and dusty like an old print.

**Only the shadow appears.** We never see the pelican, only its shadow on
the wall: black, soft-edged, a little too long in the bill and the neck. It
glides along the hall, and then, slowly, it climbs the stairs.

**The highlight (bar 2):** the climb. As it mounts the staircase the shadow
grows and leans, and its wing lifts from the handlebar. On the strong beat
the long feathers spring out like fingers. On the next downbeat the door at
the head of the stairs swings open by itself and a cold light falls out of
it. The shadow passes across the lit doorway, and as its bill reaches the
next picture frame it catches fire in green.

## Materials

- **Film.** Black and white, mapped to a cold duotone: deepest tone
  `#06100f`, mid `#2f5a57`, lightest `#cfe6dc`. Soft, low in detail, high in
  contrast, with a vignette that darkens the corners.
- **A film clock of 18 frames a second** (`stepTime(f.t, 18)`): grain,
  flicker (a few per cent of brightness), gate weave (the whole picture
  shifting by up to 0.6 units), dust specks and hairs (new ones on each film
  frame), and two or three vertical scratches that wander slowly. The scene
  also sets `poseHz: 18`, so the shadow itself moves at silent-film cadence.
  The camera stays smooth.
- **Light.** Low and raking, as if from a lamp below the stairwell. **The
  wall behind the shadow's whole path must be lit:** a band from the road up
  to about 200 units above it, along the hall, up the stairs and across the
  landing, is mid tone (`#2f5a57`) or lighter, so that a near-black
  silhouette stands out everywhere. The upper wall, the corners and the
  space under the stairs may fall into darkness.
- **Shadow.** The puppet as one flat silhouette (every shape filled, lines
  stroked at their width), near-black, with a blurred edge of about 2 units
  that widens to about 6 where the shadow is stretched. Nothing inside it:
  no eye, no spokes beyond what the silhouette itself shows as gaps.
- **Only one strong shadow.** The pelican's shadow is the only strong dark
  shape on the lit wall. The balusters may throw a faint ladder of slanting
  shadows (no more than a quarter as dark as the pelican's), or none. Nothing
  else on the wall crosses the shadow's path: no picture, no lamp, no
  second figure.

## The set

World units. The scene supplies `road(x)`: the line the shadow's wheels
follow.

```
road(x) = 700                                   for x ≤ 340
        = 700 − 110 · smoothstep(340, 760, x)   for 340 < x < 760
        = 590                                   for x ≥ 760
```

So this section **ends 110 units higher than it begins**, and Section 15
begins at that height. (`tools/check.mjs` checks that the two agree.)

- **Hall, x < 340:** plain wall above a dark dado; floor line at y = 700.
  The poster (see Title) hangs here.
- **Staircase, x 340 – 760:** steps whose nosings lie on the road curve; a
  dark string board below them; turned balusters and a heavy handrail about
  70 units above the nosings, **in front of** the wall, so the shadow passes
  behind the balustrade and is seen through it. Keep the balusters slender
  and well spaced (about 26 to 30 units apart): the bill, the head, the neck
  and both wheels must stay readable through them in every frame. Below the
  stairs, panelling in deep shade.
- **Landing, x > 760:** level at y = 590; a newel post; an arched door at
  about x 800 – 880 reaching from the landing up to y ≈ 445, with iron
  hinges; a strip of lit wall beyond it to the frame.
- Paint from x = −60 to 1060 and y = 420 to 800.

## The shadow

- For u < 0.6 and u > 5.4 it is the puppet's exact silhouette at the true
  position, on the road.
- On the stairs it is **stretched upward** about its base, as shadows are
  when the light is low: height multiplied by up to 1.4 at mid-flight,
  returning to 1 by the landing, with a slight forward lean. Its base stays
  on the road curve.
- From u ≈ 2.4 the wing rises from the handlebar (`wing` to 1) and the neck
  cranes (`neckStretch`), the bill dips. **At u = 3.0, on the strong beat,
  the four flight feathers spring out into long fingers** that reach ahead
  and upward (within about 0.12 s, then they keep creeping slowly longer);
  the shadow is at its tallest and most leaning at the same moment. The
  hand stays raised until about u = 4.6. All of it eases back by u = 5.2.
- The engine tilts the puppet to the slope of the stairs.
- The scene sets `poseHz: 18`, so `f.pelican.crank` and `.wheel` step at
  the film's cadence while its position stays smooth.

## The door

**At u = 4.0, on the downbeat,** the door at the head of the stairs swings
inward by itself over about 0.6 s. A cold pale light falls out of the
opening: the doorway becomes the lightest thing in the picture (`#cfe6dc`
at its brightest, falling off towards the floor), with a wedge of that light
on the landing wall beside it. The shadow, when it reaches the door from
about u = 4.4, crosses door and lit opening alike as a pure black
silhouette. It must never cross anything dark.

## Hand-over to Section 15

From u = 5.5 a green fire starts at the tip of the bill and runs back along
the shadow's outline, reaching the tail by u ≈ 6.0: the edge of the
silhouette is drawn as a glowing oscilloscope trace with
`drawPhosphor(stage, view, polylines, { intensity, … })` from
`src/rig/skins/phosphor.js`, using `outlines(skel)`. Small sparks jump from
it. The shadow's black interior stays. The wall near the frame picks up a
faint green light. By the time any part of the shadow reaches the frame, that
part's edge is already burning, so what comes out the other side as pure green
line is the same outline.

The outline must meet the next section's trace exactly. Section 15 draws the
pelican from the unstepped pose and with its own beam colour (`#59ff8a`; see
how `src/scenes/scope.js` calls `drawPhosphor` for its entrance, near the end
of that file, and use the same colour and a matching width). So from u = 5.5:

- take crank and wheel for the shadow and its outline from
  `f.film.pelicanFor(15, f.t)` (the pose exactly as Section 15 draws it),
  not from the 18 Hz pose;
- keep the film weave off the shadow and the outline.

## The three bars

| u | |
|---|---|
| 0 – 2 | Along the hall, life size, on the floor line. The poster. The foot of the stairs comes into view, with the balustrade's slanting shadows. |
| **2.0** – 4.55 | **The climb.** The front wheel meets the first stair on the strong beat. The wing rises from u ≈ 2.4. |
| **3.0** | The feather fingers spring out; the shadow is at its tallest and most leaning. |
| **4.0** | The door opens, and light falls out. |
| 4.55 – 5.4 | Along the landing and across the lit doorway, back to life size, hand lowered. |
| 5.5 – 6.0 | The outline catches green fire from the bill backwards. |

The pelican keeps the standard pace. No camera move.

## Title

A cinema poster pasted on the hall wall at **x 70 – 310, y 444 – 554**, in
the angular lettering of 1920s German posters, printed in the film's own
tones (it is seen through the same tint, flicker and scratches). Its lower
edge stays 12 units above the top of the passing shadow (y = 566).

- 《诺斯费拉图》, about 24 units, heavy and sharp (Weibei SC).
- `NOSFERATU`, about 16 units (Phosphate, a display face of that period's
  kind).
- `1922 年 · 1922`, 13 units or more: the digits at least 26 px tall on
  screen.
- A plain ruled border. No image of anyone from the film. One invented line
  of small print (such as `一出影子戏 · EIN SCHATTENSPIEL`) only if it can
  be set at the same size as the date; otherwise leave it out.

The lettering must hold its contrast through the grain and the flicker:
light letters on the poster's dark ground, or the reverse, never mid on mid.

## Gallery still

`still: { u: 3.4 }`: the stretched shadow with its raised hand of feathers,
half way up the stairs.

## How to build it

- Bake the set in greys (wall with its light, stairs, balustrade, door in
  two states or as a separate piece, poster).
- Per frame: set; shadow silhouette on a patch, blurred, multiplied on; the
  balustrade again over it; then one full-frame pass for tint, flicker,
  weave, grain, dust, scratches and vignette, all functions of the film
  clock; last, from u = 5.5, the green outline and its light, added on top
  of the film pass so it is clean and bright.
- If Section 15 is not yet in the tree when you start, write against the
  `drawPhosphor` signature above and say so in your report.

## Sound cues (for Stage 4)

| u | Event |
|---|---|
| 2.0 | The first stair |
| 3.0 | The fingers spring out, the shadow at its tallest: organ |
| 4.0 | The door opens |
| 5.5 – 6.0 | The outline ignites: crackle, rising |

## Check on the contact sheet

- Reads as a frame of a 1920s silent film: tint, grain, flicker, scratches,
  vignette, deep blacks.
- The pelican itself is never seen. The shadow is unmistakably a pelican on
  a bicycle.
- The shadow's wheels follow the stairs; it is seen through the balusters
  and stays readable through them; it is taller and leaning at mid-flight.
- The feather fingers are folded at u = 2.9 and out at u = 3.2.
- The door is shut at u = 3.9 and open, with light in it, at u = 4.7. The
  shadow is black against that light, and against a lit wall everywhere
  else.
- At u = 5.8 the front of the outline burns green and the back does not
  yet; at u = 6.0 all of it does.
- At both crossings the silhouette is exact and unstretched.
- Poster legible, three parts.
- `tools/check.mjs` passes.

## As built

- One scene file, `src/scenes/nosferatu.js`; no skin file. Set, balustrade,
  door leaf, door light and wedge are baked in greys at 3.3 px/unit; the
  shadow is a per-frame 2D mask of the rig (with a hand-built arm and four
  jointed, hooked fingers in bar 2) blurred on the GPU; one full-frame film
  shader does weave, flicker, grain, scratches, vignette and the duotone,
  all keyed to film frame `N = floor(t * 18)`.
- Timing: climb stretch rises 1.85 – 3.0 and falls 3.6 – 4.7 (height up to
  ×1.38, lean 0.17, base on `road(x)`); wing up 2.4 – 2.9; fingers spring at
  3.0 (easeOutBack over 0.12 s), creep longer to 4.5, lower 4.6 – 5.05;
  door swings 4.0 – 4.6, light up 4.0 – 4.28; fire 5.5 – 5.95 from the bill
  back, with pose from `pelicanFor(15, t)` and the outline built as
  `scope.js` builds its trace (functions copied into the scene).
- The poster carries a fan of dark-grey expressionist rays behind angled
  black bands under each line of lettering; the balustrade throws a faint
  slanting ladder (alpha 0.15) up the wall; a dim lamp glow rises in the
  stairwell panelling.
- Second pass: the head group (head, bill, pouch, crest, eye) keeps its proportions
  while the body stretches, and the bill grows up to 22 % longer and the neck a
  little longer between u 0.6 and 5.4 (`uncannyAt`, 0 at both crossings). The
  head pitches down during the stretch and comes back up (+0.12) once the shadow is life
  size, so the bill stays clear of the raised hand at u 4.5 – 5. A small bridge
  joins the tail to the body when the folded primaries are hidden. The dado and
  the panelling under the stairs are now raised-and-fielded oak panels with
  lit lower bevels and grain (`panel()`). The film pass adds halation round the
  open doorway and a large, soft unevenness of density on each film frame.
  The wall's painted rays from the lamp are a little stronger (7 %).
- Third pass (after verification, following the director's rulings):
  - Fingers on the beat: the spring is timed from u = 2.94 (easeOutBack over
    0.12 s) but gated to the film frame that begins at u = 3.0, so that frame
    already shows them out and the one before (u 2.944) shows them folded.
  - Legs on the climb: the shadow mask carries the body in red, the legs, feet,
    cranks and pedals in green and the arm and hand in blue; the shader blurs
    each with its own radius (body 1 → 3 units radius as it stretches, legs 1,
    arm and hand at most 1.7). Legs are drawn 1.4× thick (feet stroked
    heavier) between u 0.6 and 5.4 (`legsAt`, 0 at both crossings). Both newel
    posts are 8.4 units wide with an 11.6-unit cap and a 3.7-unit ball.
  - The open door leaf is a strip about 12 units wide at the right-hand jamb
    (swing 1.42 rad) and cross-fades to a lit bake (`bakeLeaf(stage, true)`,
    planks about 0.8 grey, pale ironwork) as the light comes up.
  - Hand-over: from u = 5.42 the shadow takes `pelicanFor(15, t)`; the bill
    tip kindles 5.42 – 5.5, then the fire runs back 5.5 – 5.95. Under the
    burning part a soft scorch (multiply, the mask dilated about 3 units) is
    laid first; the trace is drawn with Section 15's core width (1.0) and
    intensity (1 + 0.85 e), halo 2.2, glow 0.7. Wall glow lowered to 0.12.
    (The scorch from the dilated mask and the deep-tone repaint of the eroded
    mask were replaced in the fourth pass, below.)
  - Poster: a pasted paper sheet (pale paper, ragged edges, torn top-left
    corner with a fibre fringe, bottom-right corner lifted, paper-thickness
    shadow only, paste wrinkles, printed grain and rubbed ink), a dark ink
    field with the lettering reversed out of it. 《诺斯费拉图》 in Weibei SC
    bold 29 px with a stroke to thicken it; NOSFERATU in hand-cut polygon
    capitals (`GLYPHS`, `cutLetters`; cap height 17.5 units, each letter its
    own slant, tilt and baseline); the date in Weibei bold 17 px. The film
    pass keeps the poster's rectangle out of the vignette (`uKeep`, 85 %).
  - Arm: a long thin upper arm dropping to a sharp elbow knuckle, a thin
    forearm rising to the wrist.
  - Bar 3: the door light spills over the landing's front edge and catches
    the upper and side bevels of the panels beneath it (in the wedge bake).
  - Init now also creates the scene buffer and the fixed-size shadow mask
    layer (no per-size patch canvases during playback) and draws once with
    every shader (shadow, edge, film, phosphor) so they compile before play.
- Fourth pass (second round of rulings):
  - One black: the deep-tone repaint of the eroded mask and its vertical gate
    are gone. The fat parts (body, neck, head, bill, pouch, crest, eye, wing,
    tail) go through the same mask, blur and film pass in every frame; from
    u = 5.42 their polygons are also stroked 0.6 units in the mask so no
    hairline of wall shows between bill, pouch and head.
  - No green inside the black: the trace (strokes, halo, sparks) is drawn with
    `drawPhosphor` into a buffer of its own (`nosferatu/trace/WxH`) and added
    by `TRACE_FRAG` multiplied by (1 - m), m being the red (fat) channel of the
    shadow mask, averaged over a 1.5-unit ring and ramped from the edge
    inwards.
  - Thin members turn into light: from u = 5.42 every other part of the rig
    (tyres, rims, spokes, hubs, frame, posts, bar, saddle, chain, ring, cranks,
    pedals, legs, feet) goes to the mask's green channel, and the shadow shader
    fades that channel out over 12 units, from 2 units ahead of the fire front
    to 10 behind it (`uFade`). Their light is Section 15's own strokes
    (`scopeTrace`), clipped at the front as before.
  - Scorch: before the trace is added, a half-resolution 2D layer of the
    burning strokes and sparks (`scorchPatch`) is multiplied on: bands of
    half-width 2 to 5 units take the wall to a quarter (`uDark` 0.75), and a
    narrower band (half-width 0.9 to 1.7) under the core takes it further
    (`uCore` 0.8, about 5 % of the wall). Neither darkens the fat black.
    Measured at 89.0 on green core pixels (G >= 240, G - R >= 60): median
    saturation 0.565 against Section 15's 0.580, 75th percentile 0.627 against
    0.671.
  - `fireAt` works the fire out before the shadow is drawn (the shadow needs the
    front); `drawFire` draws the trace buffer, the scorch and the two
    compositor passes. `init` creates the trace buffer and the scorch layer and
    compiles the compositor.
  - Poster: `KERN` sets the A-T pair 0.2 cap heights closer, so the T's bar
    tucks in over the A's slope. Nothing else on the poster changed.
- **Director's hand edits after the second re-check** (the re-check found black
  members beside green strokes just behind the fire front, and a green paler
  than Section 15's): the thin members' shadow now fades out over the 12 units
  *ahead* of the fire front and is gone 2 units before it, so no black lies on
  or beside a green stroke; the scorch is wider, darker and smooth (full within
  3 units of a stroke, gone by 11, twenty fine steps, drawn at a quarter of the
  resolution), so the wall goes dark round the burning lines and the green keeps
  Section 15's colour; neither scorch nor light falls below the floor line; the
  0.6-unit closing stroke on the fat parts eases in from u = 5.42 to 5.5 instead
  of appearing at once. Supersedes the numbers given above for the fade and the
  scorch.
