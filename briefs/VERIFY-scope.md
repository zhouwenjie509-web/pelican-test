# Verification of Section 15 (scope)

An independent verifier reviewed the finished scene from rendered frames. Their findings follow. The director has read them and added rulings; where a ruling differs from the art brief or from a suggested fix, the ruling wins.

## Verdict

Not ready to show yet. The section is close: it reads as a 1950s oscilloscope, both crossings line up with no pop, the title is legible and long enough on screen, and nothing is unpainted. Two things block it: bar 2 is over the speed budget (13.4 ms mean against 10), and the joke's key beats are muddy. At u=3.04 a full-brightness pelican is still drawn inside the knot, and at 3.5 a tangle hides its return. The single most important fix is to stop the persistence echoes carrying across the u=3.0 and 3.5 switch instants, which also cuts the line count that makes bar 2 slow.

## The director's rulings

1. Speed: the scene alone in bar 2 must draw in 10 ms or less on average, and nothing may hitch at the entry. Cut the persistence work (fewer echoes, half resolution for echoes, one raster for the analytic knot) and move every first-use cost into init.
2. The switch is instant. Within two frames of u = 3.0 no pelican is visible, only the knot; within two frames of u = 3.5 the pelican is back and legible. Echoes never carry across those two instants: blank the afterglow of whatever was on the other side of the switch.
3. The figure stays crisp while it rolls down the step in bar 1: the live trace is much brighter than any echo, echo weights fall off fast, and an echo may not sit more than a few units from the live line.
4. The hand: fingertips break the bottom edge of the view at u = 1.6. Give it form: curled, foreshortened fingers, green light falling off across the knuckles, a soft uneven rim.
5. The beam: a thinner core (about 1 unit), a smaller halo, brightness that follows the beam's speed (bright dots at ends and corners, dimmer on long straight runs). Legs as single strokes. Keep drawPhosphor's name and signature.
6. A little wear on the panel (scuffed knob skirts, worn engraving, a smudge on the glass). Raise the English and date lines of the plate so their capitals and digits are about 30 px tall.

## Findings

### [must-fix] Bar-2 draw time over budget

Evidence: perf.mjs --section 15, middle 90.9-93.1 s: 58.8 fps, draw mean 13.4 ms, p99 22.6 ms, worst 23.4 ms. The guide section 7 budget for the scene alone in bar 2 is a mean of 10 ms or less, so this is 34 % over. Entry (10.6 ms) and exit (6.4 ms) are within the 14 ms budget. Entry also had a 205 ms slowest frame gap, a visible hitch during playback.

Suggested fix: Cut the persistence work in bar 2. During the knot, echo only 2-3 instants, or reuse one echo raster for the knot, whose shape is analytic. Rasterise the knot's echoes once per frame at half resolution. Bake or pre-warm whatever first-use work causes the 205 ms gap on entry, in init.

### [must-fix] The pelican does not vanish into the knot at u=3.0, and does not return at once at 3.5

Evidence: Brief: 'Within two frames every stroke of the pelican is thrown onto a Lissajous figure' and at 3.5 'The pelican returns at once'. At 92.04 (u 3.04) a complete, full-brightness pelican sits inside the fully drawn knot. At 92.08 it is still clearly legible, and still faintly visible at 92.15. At 92.50-92.55 a dense tangle hides the figure, which reads cleanly only around 92.62-92.65. The cause is the persistence echoes of pre-switch poses (and the tangle afterwards), which stay too bright. The collapse reads as 'ellipses drawn over the pelican', not 'the pelican becomes the knot'.

Suggested fix: At the switch instants, morph the echoes too: compute each echo through the same tangle blend that its own time had, so echoes from before 3.0 are dimmed hard. Or kill echo weight for samples on the other side of the 3.0 or 3.5 boundary (the X-Y switch blanks the beam), so that by 3.03 only the knot plus its flash remains, and by 3.53 only the ringing pelican.

### [should-fix] Bar-1 figure smeared into a doubled, muddy blur

Evidence: At 90.55, 90.65, 90.8 and 90.9 (u 1.55-1.9), while the pelican rolls down the step, every stroke is repeated in 4-5 offset copies of similar brightness. The bike, body and neck look out of focus and thick, and the pelican is much less crisp than at 93.45.

Suggested fix: Make echo weights fall off faster (for example 0.25 × 0.5^k) and cap how far an echo may be offset, or fade echoes by displacement. Keep the live stroke much brighter than any echo so the figure stays sharp.

### [should-fix] Hand appears about 0.2 s late

Evidence: Brief: the hand rises from 1.6. At 90.55 (u 1.55) and 90.65 (u 1.65) no hand is on screen. At 90.8 (u 1.8) only tiny fingertips show at the bottom right edge; at 90.9 (u 1.9) the fingers are just in. It reaches FOCUS by 91.15 (u 2.15) as intended.

Suggested fix: Start the hand's rise path at the screen's bottom edge at u=1.6 rather than below it. Or begin its motion about 0.25 s earlier so fingertips break the bottom edge at 1.6.

### [minor] Title lines barely meet the size target, and the maker line is small

Evidence: Pixel rows measured at 93.0 (zoom 1.1): 示波器矢量图形 49 px; OSCILLOSCOPE 29 px; VECTOR GRAPHICS 29 px; date line 37 px including Chinese (digits about 29 px); maker line 18 px (Chinese) / about 12 px caps; SER line 12 px. At zoom 1 (u ≥ 5.7) these shrink by 1/1.1: Chinese about 44.5, caps about 26. They pass the guide (26 px) but fall just under the 30 px asked of every other line; the maker line is well under. Title fully on screen from u≈1.9 (cut by the frame at 90.8, whole at 90.9) to past u=6.1 (whole at 95.1, est. until about u 7). That is over 4 s, which passes.

Suggested fix: Raise the English and date lines to about 13.5 units (caps about 31 px at zoom 1.1, 28 at zoom 1). Treat the maker and serial lines as decoration, or raise them to 9-10 units if they are meant to be read.

### [minor] Smeared comet-band of pip echoes above the sloped base line

Evidence: Crop of 92.04, left of the tube: a broad, dim, striped band sits above the curved part of the base-line trace. It reads as a smudge rather than afterglow.

Suggested fix: Keep pip echoes in the tube's frame along the line itself (offset along the curve, not vertically), or drop the echoes of the scrolling pips.

### [should-fix] Art: uniform neon-tube line instead of a beam

Evidence: At 93.45 every stroke is the same thick, evenly bright green tube with a wide halo. Corner and end hot-spots are hardly visible, and nothing shows the fast-run dimming the brief asks for. It reads like a neon sign or vector clip art rather than a thin, crisp, intensity-modulated 1950s CRT trace. The legs drawn as two-edged tubes clutter the crank area.

Suggested fix: Thin the core to about 1 unit, reduce the halo radius, and modulate intensity by beam speed (bright dots at vertices and ends, dim on long straight runs). Draw legs as single strokes and let the frame tubes go dimmer still.

### [should-fix] Art: hand is a flat cut-out; panel looks like a clean CG mock-up

Evidence: Crop of 91.25: the hand is a flat dark silhouette with an even green rim line and splayed, straight, evenly spaced fingers, with no volume or foreshortening; it looks pasted on the panel. The panel (DIN-style labels, perfect knobs, noise-texture wrinkle finish) has no wear, fingerprints, scratched paint, yellowed engraving fill or uneven light. The upper half of the tube is empty for most of the section (93.45, 94.0), so the composition is bottom-heavy.

Suggested fix: Give the hand form: curled, foreshortened fingers, a falloff of green light across the knuckles, and a softer, uneven rim. Add wear to the panel (scuffed knob skirts, worn engraving fill, a fingerprint smudge on the glass picked out by the reflection). Fill the top of the tube with something the beam would draw, such as a faint calibration trace, or let the glass reflection carry it.

## Items of the brief's checklist that failed

- **At u=3.0-3.5 the figure is a Lissajous knot; before and after it is the pelican**: At 91.98 it is the pelican, OK. At 92.02 it is a half-formed scribble. At 92.04 the full knot is drawn on top of a complete, full-brightness pelican, and at 92.08 the pelican is still plainly visible inside the knot (still faint at 92.15). At 92.46 the knot is clean. At 92.50 and 92.55 a dense tangle is left over the returning figure; a clean pelican reads only from about 92.62-92.65.

## Measured before the fixes

- Purity: node tools/check.mjs --purity --section 15 -> "All 20 checks passed." Relevant lines: "PASS section 15 road(): defined everywhere, no slope steeper than 1 in 2 (steepest 0.458)"; "PASS roads are level and meet at every picture frame (worst mismatch 0.00e+0, worst tilt 0.00e+0 units (crossing 0))"; "PASS frames are a pure function of time (14 frames, two browsers, different orders) (byte-identical)". It also printed "16 of 20 sections are painted."
- Speed: node tools/perf.mjs --section 15 (page ready after 1.0 s, render width 1920): entry 88.4-90.9 s 55.6 fps, draw mean 10.6 ms, p99 19.6 ms, worst 20.5 ms (slowest frame gap 205 ms, 137 frames); middle 90.9-93.1 s 58.8 fps, draw mean 13.4 ms, p99 22.6 ms, worst 23.4 ms (slowest frame gap 31 ms, 129 frames); exit 93.1-95.6 s 60.0 fps, draw mean 6.4 ms, p99 12.4 ms, worst 14.2 ms (slowest frame gap 22 ms, 150 frames). The middle mean of 13.4 ms exceeds the 10 ms bar-2 budget. Entry and exit are within 14 ms.
