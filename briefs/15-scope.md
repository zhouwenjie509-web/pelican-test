# Section 15 · 示波器矢量图形 · Oscilloscope Vector Graphics

| | |
|---|---|
| Date on the title | 20 世纪 50 年代 · 1950s |
| Film time | 89.0 s – 95.0 s |
| Code | `src/scenes/scope.js`, trace renderer in `src/rig/skins/phosphor.js` |
| Homage | Pictures drawn on laboratory oscilloscopes in the 1950s by steering the beam. A technique, not a work. The instrument, its maker's name and its labels are invented. |

## The idea

A black instrument face with one large round cathode-ray tube. On the green
phosphor the pelican and its bicycle are drawn by a single moving beam: thin
bright lines with a soft halo, brighter where the beam lingers at corners,
trembling slightly, leaving a brief afterglow wherever a line has just been.

The instrument travels with the pelican: the tube is always centred on it,
and the painting behind is the darkness of a laboratory.

**The joke (bar 2):** a hand comes in from below to steady the picture and
turns the wrong knob. On the strong beat the pelican collapses into a tangled
Lissajous figure filling the tube. One beat later the hand flicks the switch
back and the pelican snaps into shape again, ringing for a moment like a
struck spring. The hand withdraws.

## Materials

- **Phosphor.** Green `#59ff8a` at the core of a line, falling off through
  `#1fae4d` to a wide dim halo. The tube face itself has a very faint green
  cast and a slow radial fall-off, and it is never perfectly black.
- **Beam.** Line width about 1.4 units at the core. Brightness is higher
  at the ends and corners of each stroke and lower along fast straight
  runs. All lines add (they are light).
- **Persistence.** What the beam drew a moment ago is still fading. Compute
  it, do not accumulate it: draw the figure as it was at several earlier
  instants (for example every 1/30 s back to a quarter second), each dimmer.
  Use `f.film.pelicanFor(f.n, t − dt)` for the earlier poses, and keep them
  in the tube's own coordinates, where the pelican does not travel sideways;
  the echoes then show wheels, legs and any vertical movement.
- **Instability.** A fine horizontal jitter of a fraction of a unit that
  changes every frame of a 60 Hz clock derived from `f.t`; a slow hum bar
  that makes the picture breathe by about half a unit; rare single-frame
  dropouts of brightness.
- **Glass.** A curved highlight high on the tube and a soft reflection of
  an unseen window, very faint. An etched graticule: a grid of ten by eight
  divisions with finer ticks on the centre lines, lit a dull green from the
  edge.
- **Panel.** Black wrinkle-finish metal, a turned bezel ring with four
  screws, engraved white lettering, bakelite knobs with white pointer
  lines, a pilot lamp glowing orange.

## Layout

Everything is laid out in world units **relative to the pelican's road
point** (`f.pelican.x`), as section 5 of the guide describes, and drawn
through `f.view`.

- **Tube:** centre at (px, 612), radius 168, so it holds the pelican both at
  its entry height and on the base line.
- **Panel:** extends at least from px − 350 to px + 350 and y 410 to 810,
  so its edge is never seen in the tracking shot. Beyond it, darkness.
- **Knobs:** a row along the bottom right, around (px + 205 … px + 290,
  y 690 … 770): `INTENSITY 辉度`, `FOCUS 聚焦`, and a two-position rotary
  switch `SWEEP · X–Y`. More small controls at the left.
- **Maker's plate and title:** see Title.

## The trace

- **The road.** The pelican enters this section 110 units higher than usual,
  because Section 14 ends at the top of a staircase. The scene supplies

  ```
  road(x) = 590                                        for x ≤ 100
          = 700 − 110 · (1 − smoothstep(100, 460, x))  for 100 < x < 460
          = 700                                        for x ≥ 460
  ```

  and draws that same curve as the base-line trace: a line that comes in
  high and settles to its level, like the response to a step. Small pips on
  it every 41.67 units (a quarter of a pedal turn) scroll past and show the
  speed.
- **The pelican.** Every outline of the puppet (`outlines(skel)`), redrawn
  for a beam: fewer, cleaner strokes than the full puppet (drop the chain,
  thin the spokes to six), each stroke a polyline with brighter ends.

## Hand-over from Section 14

On the left of the entry frame the pelican is a black shadow on a wall whose
edge has just caught fire in green (Section 14 draws that with this section's
trace renderer). On the right it is this section's trace. To make them one
event:

- From u = −0.5 to 0.6 the trace is over-bright, with a wider halo, and
  crackles: short sparks jump off the outline.
- For those same moments the *inside* of the figure glows faintly, as if
  the shadow's shape had been burnt on the phosphor, and fades.

**The trace renderer** must live in `src/rig/skins/phosphor.js`, exported as

```js
drawPhosphor(stage, view, polylines, { intensity, width, halo, color })
```

where `polylines` is a list of `[[x, y], …]` in world units. Section 14 will
call exactly this. Keep it free of anything specific to this scene.

## The wrong knob, bar 2

| u | |
|---|---|
| 1.6 – 2.6 | A hand rises from the bottom edge towards the knobs: a dark shape lit along its upper edge by the tube's green. It hovers at FOCUS, then settles on the switch beside it. |
| **3.0** | It turns the switch to X–Y. Within two frames every stroke of the pelican is thrown onto a Lissajous figure: a point at fraction *s* of the whole drawing's length goes to (px + 150 sin(3 · 2π s + φ), 612 + 150 sin(2 · 2π s)), with φ drifting so the knot slowly turns. A flash of brightness on the change. |
| 3.0 – 3.5 | The tangle, turning. |
| **3.5** | The switch is flicked back. The pelican returns at once, overshoots and rings: the blend between tangle and figure oscillates and dies out within a quarter second. |
| 3.6 – 4.4 | The hand goes back down the way it came. |

The pelican keeps the standard pace. No camera move.

## Title

An engraved plate on the panel at the lower left of the tube, about
**px − 305 … px − 150, y 700 … 777**, travelling with the instrument:

- 示波器矢量图形, about 14 units, engraved white (Heiti SC).
- `OSCILLOSCOPE` and `VECTOR GRAPHICS` on two lines, about 12.5 units, in
  a plain engraver's sans (DIN Alternate or Futura).
- `20 世纪 50 年代 · 1950s`, about 12.5 units.
- A maker's line in small capitals, about 6 units, invented:
  `鹈鹕仪器厂 · MODEL P-15`.

Capitals and digits of the English and date lines must be at least 26 px tall
on screen.

## Gallery still

`still: { u: 4.6 }`: the pelican on the base line in the centre of the tube.

## How to build it

- Bake the instrument face once (it does not change); draw it at the
  pelican's position.
- Lines: either quads into a framebuffer with additive blending followed by
  a small blur pass for the halo, or a 2D canvas with `lighter` compositing.
  Measure both if unsure; the persistence echoes multiply the line count.
- Clip the trace to the tube's circle.
- Everything is a function of `f.t`; no feedback buffer.

## Sound cues (for Stage 4)

| u | Event |
|---|---|
| −0.5 – 0.6 | Electrification crackle |
| 0.6 – 2.76 | The base line settles |
| 3.0 | Wrong knob: the tone bends and splits with the figure |
| 3.5 | Snap back, with ringing |

## Check on the contact sheet

- Reads as a phosphor tube: glowing lines with halo, graticule, glass, a
  dark instrument round it.
- The pelican is clear and complete in line.
- Afterglow is visible behind the turning spokes and legs.
- The entry: figure high in the tube at u = 0, on the base line by u ≈ 2.8,
  with the base-line trace following the same curve.
- At u = 3.0 – 3.5 the figure is a Lissajous knot; before and after it is
  the pelican.
- The hand is a hand.
- Title plate legible, three parts; nothing resembles a real maker.
- `tools/check.mjs` passes.

## As built

- **Files.** `src/scenes/scope.js` (scene), `src/rig/skins/phosphor.js` (the trace renderer, scene-free).
- **Trace renderer.** `drawPhosphor(stage, view, polylines, { intensity, width, halo, color })`, plus optional `deep`, `ends`, `glow`, `clip {cx, cy, r, soft}`, `fills` (burnt-in areas, polygons or `stroke` lines), `bounds`, `res` (working resolution, default 1), `coarseBelow`, and `speed`/`speedLen`/`speedMin` (brightness follows beam speed: every vector takes the same time, so a segment longer than 5 units is dimmed by sqrt(5 / length), down to 0.5; each stroke is cut into runs of equal level). Polylines are `[[x, y], …]` or `{ pts, a, w, ends, coarse }`. Strokes are rasterised as intensity with `lighter` on a 2D canvas (headroom to 4), faint/`coarse` strokes on a half-resolution canvas, then a quarter-resolution copy is blurred twice (glow, halo) and one shader maps intensity to phosphor green, burning to pale green-white, clips to the circle and adds to the target. Section 14 can call it with no clip.
- **Beam.** Core 1.0 unit, halo 3.6 (wider while electrified and on the flashes), bright beads at ends and corners (`ends` 0.95). Legs are single bold strokes; frame tubes at 0.62 and spokes at 0.62 brightness, so the rider reads over the bike.
- **Afterglow.** 3 earlier instants, 1/30 s apart, at 0.26, 0.13, 0.065 of the live beam, drawn at half resolution. Echoes carry only the parts that move within the figure (spokes, legs, feet, cranks, pedals, sparks), held to within 1.2 units of the live figure's height, so the picture stays crisp while it rolls down the step. The base line and its pips are not echoed. **No echo crosses a switch instant:** an echo whose time lies on the other side of u = 3.0 or 3.5 is not drawn (the switch blanks the beam), nor the half-thrown figure of 3.0 … 3.033 or the ringing figure after 3.5.
- **The knot.** Once fully thrown (u ≥ 3.033) the drawing lies exactly on the analytic Lissajous curve, so that curve is drawn directly (420 equal steps in time, so it is bright where the beam turns and faint where it races); its echoes are the same curve at earlier phases. Before that, 3.0 … 3.033, every stroke is blended onto it by arc length.
- **Instability.** 60 Hz horizontal jitter (0.55 units), a hum bar rolling upward (0.5 units sideways), breathing (0.28 %), dropouts on about 1 % of 60 Hz frames (not in the still).
- **Layout.** Tube centre (px, 612), face radius 172, trace clip 171, bezel 192 with four screws; panel px ± 350, y 410 … 810, inside a cabinet and on a bench (only seen in the still; the bake runs to y 990 so the still shows no edge below the bench). Knob row at y 702: INTENSITY px+190, FOCUS px+228, SWEEP · X–Y switch px+266 (moved in from the brief's px+205 … 290 so the hand stays inside the frame at zoom 1.1). Plate px−297 … −187, y 667 … 773 (its left edge is about the left edge of the picture at zoom 1.1, so it cannot grow wider).
- **Wear.** Lacquer unevenly dulled and rubbed pale round the controls, about 70 fine scratches (most round the right-hand controls), paint worn through along the bottom edge; knob skirts with a finger-polished stretch and scuffs, caps dulled, pointer paint chipped; engraving fill yellowed and chipped (lightly on the title lines); a fingerprint and a wiped smear on the glass, picked out near the window reflection.
- **Title.** 示波器矢量图形 Heiti SC 16.5 units; OSCILLOSCOPE / VECTOR GRAPHICS and the date in DIN Alternate Bold 13.6 units (caps about 30–31 px at zoom 1.1, measured on the 93.0 frame); maker line 鹈鹕仪器厂 · MODEL P-15 at 6.6 units and SER. Nº 0417 at 5.4 (decoration; invented).
- **Times (u).** −0.5 … 0.6 electrified (over-bright, wider halo, sparks every 1/30 s, burnt-in fill); 1.6 hand's fingertips break the bottom edge (pinch point starts at y 781, eases up to FOCUS by 2.2); 2.2 – 2.5 hovers at FOCUS; 2.5 – 2.82 moves to the switch and grips; 3.0 switch to X–Y, knot fully on by 3.033, flash, no pre-switch afterglow; 3.0 – 3.5 knot turning (φ = 0.9 + 4.6 (u − 3)); 3.5 flicked back: the pelican is whole at the instant, then the blend rings 0.12 e^(−dt/0.045) sin(2π·11 dt) (gone by 3.6), smaller flash, no knot afterglow; 3.6 – 4.4 hand withdraws.
- **Still.** `{ u: 4.6, span: 740, y0: 232 }`: the whole instrument on its bench; the trace at full resolution.
- **The hand.** A right hand seen from the back, near-black with a green cast (`#0b1611`) in a dark room, lit only from the tube: never filled with flat green in either pose, and a flash brightens only the rim (the modelling is capped at 1.15× the normal light). Outlines of the back and the ball of the thumb are rounded, and each finger joint swells slightly. In the grip the thumb curls up the skirt's lower left flank and the forefinger round its lower right, each last joint bent in towards the knob. Hovering, the fingers curl in towards the panel, so their middle and last joints are seen end-on: short, bunched, of uneven length; at the switch the thumb and index take the knob's skirt from below at either side, so the white pointer stays in view and visibly flips at 3.0 and 3.5; the wrist turns with it. The rim light is the silhouette in green with dark copies laid over it at three offsets, its width different on each finger and broken along its length by soft shadows; green falls off across the knuckles (index brightest), the knuckles and curled middle joints catch light, the curled fingertips fall into shadow, faint tendons; joint creases and nails; a lab-coat cuff below the picture and a stepped soft shadow on the panel. No canvas blur filters per frame.
- **Warm-up.** `init` bakes the instrument and glass, then runs the phosphor once, invisibly, into a scratch buffer at the film's size (shader compile, working canvases, the blur filters) and builds the switch-knob layer.
- **Speed** (this machine, `perf.mjs --section 15`, after the hand pass): entry 5.4 ms, middle 6.9–7.0 ms, exit 3.3–3.4 ms mean; slowest frame gap 21 ms in every stretch on two runs (no first-use hitch at the entry).
