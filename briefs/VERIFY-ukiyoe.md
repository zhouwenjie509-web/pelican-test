# Verification of Section 11 (ukiyoe)

An independent verifier reviewed the finished scene from rendered frames. Their findings follow. The director has read them and added rulings; where a ruling differs from the art brief, the ruling wins.

## Verdict

Section 11 is close to ready to show. Timing, crossings, coverage, purity and speed all pass, and the shower and umbrella beat reads. It is held back by staging and readability: at the bar-2 downbeat (u≈1.9-2.1) the pelican is tangled with the palanquin, and the raised wing and shut umbrella read as an umbrella stuck through its head. The single most important fix is to re-time the palanquin so it is clear of the pelican before u = 1.6.

## The director's rulings

1. The palanquin and the pelican must be clear of each other from u = 1.5 to 2.6. Move the palanquin so they pass at about u = 0.8 - 1.1 (around x = 150 - 190). Check u = 1.9, 2.0 and 2.1.
2. The storm gradation is one continuous wiped gradient with no bands.
3. The umbrella and the wing: the hand feathers are plainly wrapped round the shaft, the shaft passes in front of the breast and clear of the head, and the wingtip reads as a wingtip. The umbrella is a rounded dome with panel seams, rib ends at the rim and a lighter underside; the two characters are written down one panel. Up and shut at 2.5 exactly, half open at 2.65, open at 3.0; folded and gone by 5.3.
4. Title type: the guide's sizes are font sizes, but the result must also be easy to read. Raise every line that is not the Chinese name until its capital letters and digits are at least 26 px tall on screen at zoom 1.1 (about 12.5 units of font size for most faces; measure it on a full-size frame). The Chinese name stays at least 44 px. A title fixed in the world stays within 270 units of width and in full view for at least 2.1 s. Print the three cartouches above the storm grey and the rain, so they keep their contrast through the shower.
5. The rain: finer lines (0.3 - 0.4 units), more of them, even in length and spacing, a lighter grey-black, the two slants distinct. It must not look like scratches and must not bury the pelican.
6. Gallery still: choose u or cx so that no pine limb seems to grow out of the pelican.
7. Art: give the travellers gesture (bent backs, flapping clothes, different heads); let the key line swell and taper; vary each pine's lean, height and pads; make the snow line on Fuji irregular; put some incident on the road; raise the register offset and the wood grain until they are just visible at 1080p.
8. Minor: fade Fuji's key line together with its colour during the shower; keep the farmer clear of the pelican while the umbrella folds.

## Findings

### [must-fix] Pelican tangled with the palanquin on the bar-2 downbeat

Evidence: 66.95 s (u1.95) full frame, and 67.05 s: the pelican sits right on top of the palanquin. The palanquin box and the rear bearer's legs show through the bicycle frame, and the pole runs behind its body, so it reads as the pelican riding in the palanquin. The tangle lasts from about u1.7 to 2.2, exactly when the shower begins.

Suggested fix: Re-time or re-route the palanquin so the two pass each other well before the beat (about u0.6-1.0), or so the palanquin has passed out of frame by u1.6. Alternatively, keep the bearers clear of the pelican's x from u1.5 to 2.5.

### [should-fix] Storm wipe shows hard horizontal banding

Evidence: Crop of 67.05 s (u2.05), upper right: the leading edge of the grey storm gradation is a stack of visible stepped horizontal stripes (y≈150-230 px), like a venetian blind, not a smooth printer's wipe.

Suggested fix: Build the wipe as a continuous gradient, with a soft mask edge that moves sub-pixel, or dither it. Do not step it in a few discrete bands.

### [should-fix] Raised wing and shut umbrella read badly: umbrella looks skewered through the head

Evidence: 67.45-67.75 s and 70.15-70.25 s: the near wing becomes a grey flap up the neck with a black spiky tuft behind the head that reads as a mane. No hand is legible on the shaft, and the shut umbrella stands vertically out of the top of the head (70.15 s full frame).

Suggested fix: Draw the wing's hand feathers clearly wrapped round the shaft in front of the neck. Hold the shaft a little in front of or behind the head so it does not cross the skull. Make the primaries read as a wingtip, not a crest.

### [should-fix] English and date lines visually small for the 30 px rule

Evidence: 65.1 s crop at 2x: 'Ukiyo-e' cap height about 18 px, ascender to descender about 24 px. In the date line the Chinese glyphs are about 25 px and the digits '1830s' about 17 px. The fonts are set at 10.5 and 10 units (about 33 px nominal), but Kaiti's Latin and figures render small.

Suggested fix: Raise both lines to about 12-13 units and widen the strip (the title may be up to 270 units wide), so the visible glyph height is at least 30 px.

### [should-fix] Title loses contrast for a third of its time on screen

Evidence: The title is fully on screen from about u0.15 (at u0.1 the 浮世绘 slip is clipped by about 5 px at the right) to about u3.05 (68.0 s: the yellow label's left edge is at x≈25; at 68.3 s it is clipped). That is about 2.9 s, but from u2.0 to 3.05 the storm grey and dark rain lines lie across it (68.0 s crop), so the clear reading time is about 1.9 s.

Suggested fix: Print the cartouches above the storm-grey and rain layers, as real cartouches sit on top of the image, or knock the grey and rain out under them.

### [should-fix] Rain is heavy, dark and scratchy rather than Hiroshige's fine ruled lines

Evidence: 68.0 s and the still: the rain lines are thick, dark and of uneven weight and length, and they look like scratches over the picture. They also dominate the pelican and the title.

Suggested fix: Use thinner (about 0.3-0.4 unit) and more numerous lines, more even in length and spacing and lighter grey-black, with the two slants kept distinct.

### [should-fix] Pine branch appears to come out of the pelican in the gallery still

Evidence: Still (u3.3): the right pine's trunk is directly behind the pelican, and its lower branch emerges from the bird's chest towards the right. It looks like the pelican is holding a stick.

Suggested fix: Choose a still u where the trunk is clear of the bird (for example 3.0), or move that pine's lowest limb or x.

### [should-fix] Umbrella reads as a straw hat or lampshade

Evidence: 67.65 s and 68.0 s: the canopy is a flat cone with a blue band and a scalloped edge, not a rounded dome with panels. 鹈鹕 runs horizontally across the whole canopy, not on one panel. Next to the travellers' sedge hats it reads as another hat.

Suggested fix: Make the dome deeper and rounded, with visible panel seams and rib ends at the rim, a light underside showing the rib fan, and the two characters written vertically on one panel.

### [should-fix] Art: template figures and even line

Evidence: Every frame: the travellers are paper-doll figures with stick limbs, blank identical faces and stiff stepped poses. The key line is uniform in width everywhere (pelican, figures, Fuji), with no cut taper visible at 1080p. Misregistration and wood grain are barely perceptible.

Suggested fix: Give the figures gesture: bent backs, flapping robes, varied heads. Add visible swell and taper to the key line on figures and contours. Raise the registration offset and grain opacity until they are just visible at 1080p.

### [should-fix] Art: cloned pines, mechanical Fuji snow edge, empty bands

Evidence: 70.4 s and 70.75 s: the snow edge is an even sawtooth, which reads as clip art. The pines are near clones with the same lean and identical stamped tuft pads. The bottom 20% (stone facing and grass strip) and the road surface are empty repeats, and the mid-sky is a large blank cream area.

Suggested fix: Make the snow tongues irregular in length and spacing and vary each pine's lean, height and pad count. Add incident to the road (ruts, a dropped sandal, wet reflections in the rain) and a few far details or a cloud bar in the sky.

### [minor] Ghost outline of Fuji lingers in the rain

Evidence: 67.55-67.65 s: a thin pale outline of Fuji's flank hangs in the grey sky at the upper right with no fill while the prints cross-fade.

Suggested fix: Fade Fuji's key line together with its colour blocks, or a little earlier.

### [minor] Pelican crowds the tea house and farmer during the fold

Evidence: 69.55-70.25 s: the pelican with its umbrella overlaps the tea-house eaves and the farmer's straw cape, a busy knot just as the umbrella folds.

Suggested fix: Shift the farmer to the left side of the tea house, or slide the tea house a little right, so the bird passes in front of open road and wall.

### [minor] Umbrella fully up slightly early; extra signature in the cartouche

Evidence: 67.45 s (u2.45): the shut umbrella is already raised above the head (the brief says up at 2.5). The yellow label also carries 鹈斋画 and a red seal, which the brief does not ask for and which duplicates the gourd seal.

Suggested fix: Finish the raise at 2.5. Drop or shrink the in-cartouche signature, or keep it and note it in As built.

## Measured before the fixes

- Purity: node tools/check.mjs --purity --section 11: "All 15 checks passed." This includes "PASS frames are a pure function of time (14 frames, two browsers, different orders) (byte-identical)", plus "12 of 20 sections are painted."
- Speed: node tools/perf.mjs --section 11: page ready after 2.4 s (render width 1920). Entry 64.4-66.9 s: 60.2 fps, draw mean 5.1 ms, p99 8.2 ms, worst 12.8 ms (slowest gap 20 ms, 150 frames). Middle 66.9-69.1 s: 60.0 fps, mean 5.3 ms, p99 8.2 ms, worst 9.0 ms (slowest gap 20 ms, 131 frames). Exit 69.1-71.6 s: 60.0 fps, mean 5.2 ms, p99 6.8 ms, worst 7.0 ms (slowest gap 18 ms, 150 frames).
