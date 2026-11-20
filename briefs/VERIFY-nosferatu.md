# Verification of Section 14 (nosferatu)

An independent verifier reviewed the finished scene from rendered frames. Their findings follow. The director has read them and added rulings; where a ruling differs from the art brief or from a suggested fix, the ruling wins.

## Verdict

Nearly ready to show. Every timed event in the brief happens and is readable, both crossings line up, the title is legible and on screen about 2.3 s, coverage is complete, the wall behind the shadow is lit everywhere, and purity passes. The most important fix is readability of the rider during the climb (legs lost in the blur, and the newel posts covering the body at u≈2.5 and 4.5), closely followed by the fingers springing one film frame after the u = 3.0 beat. The hand-over trace also needs matching to Section 15's thinner, saturated line.

## The director's rulings

1. **The fingers are out on the beat.** The film frame that begins at u = 3.0 must already show the feather fingers about half out (time the spring as if it had started at u = 2.94), and the film frame before it shows them folded. Check with frames at film time 85.95, 86.00, 86.03 and 86.06.
2. **The rider must read on the climb.** Keep the blur on legs, feet, cranks and pedals at about 2 units even where the shadow is stretched, and make the legs about 1.4 times as thick in the shadow mask, so pedalling legs are seen at a glance. Slim both newel posts to about 12 units wide with a small cap, so that neither hides more than a baluster would.
3. **The open door leaf is pale.** Once open it is a narrow strip at the far (right-hand) jamb, lit by the light from the doorway to about the tone of the lit wall. The shadow crosses it at full contrast. Nothing mid-grey or dark stands in the doorway.
4. **The hand-over matches Section 15.** Only the edge of the silhouette burns: no green stroke inside a black area at any time. Core width and brightness as Section 15 draws its trace at its entrance. So that the green keeps its colour on the pale wall, lay a soft dark scorch under the burning edge first (a multiply, about 5 units wide), and keep the halo narrow. The very tip of the bill begins to glow at u = 5.42 and is alight by 5.5, so nothing reaches the picture frame unlit. Look again at film time 88.7, 88.9, 89.0 and 89.1.
5. **The poster is paper.** A printed sheet pasted on the wall: a slightly uneven edge, a torn or lifted corner, paste wrinkles, printed grain, no bevel and no drop shadow beyond the thickness of paper. Heavier lettering: the Chinese name in a heavy Weibei; NOSFERATU as heavy, angular, hand-cut capitals of your own design (eight letter shapes as polygons, with uneven slants). If after two honest attempts your letters are not clearly better than the present setting, keep the present face but print it solid, without the inline. All three lines keep full contrast across the whole sheet (lift the right-hand half out of the vignette). Sizes as now or larger.
6. **The arm** is long, thin and angular, with a bony elbow, not a straight stick out of the chest.
7. **Bar 3's lower half:** let a little of the doorway's light fall down the front edge of the landing and catch the bevels of the panelling beneath it.
8. Move every first-use cost (bakes of the door light, the wedge and the leaf, shader compiles) into `init`, and measure the entry again.
9. Keep everything the verifier confirmed: `road(x)`, `poseHz: 18`, the lit wall, the door at u = 4.0, the crossings, purity. Do not edit `src/rig/skins/phosphor.js`.

## Findings

### [should-fix] Feather fingers spring one film frame after the strong beat

Evidence: Range 85.85–86.25 at 0.05 s: at 86.00 and 86.05 (u = 3.00 and 3.05) the wing is still a single tapered limb. The fingers first show at 86.10. The pose runs on stepTime(f.t, 18), so the film frame covering u = 3.000–3.056 still shows the folded wing, and the organ cue at 3.0 lands 56 ms before any visible change.

Suggested fix: Start the spring half a film frame early (about u = 2.97), or evaluate the finger ease at the end of the current film frame (ua + 1/18), so the frame that contains u = 3.0 already shows the fingers starting out.

### [should-fix] Pedalling legs are barely readable on the climb, and the newel posts cover the rider

Evidence: 85.5 (u = 2.5): the foot newel covers the legs, crank and lower body (x≈895–935). 86.5 (u = 3.5) and the still: legs and feet are lost in the blur and stretch, so the wheels seem to turn with no rider attached. 87.5 (u = 4.5): the landing newel cuts through the chest where the arm joins. The guide asks for pedalling legs at a glance.

Suggested fix: Cut the blur on the legs and crank (keep ~2 units there even when stretched), thicken the leg strokes slightly in the mask, and slim the newel posts or move them half a wheel off the shadow's path at u 2.3–2.6 and 4.4–4.7.

### [should-fix] The open door leaf is a mid-grey strip that the shadow crosses inside the lit doorway

Evidence: 88.0 and 88.3: the open leaf (lum ≈85) stands in the middle of the bright opening (lum ≈222). The front wheel, the lowered hand and the leg/foot cross it with visibly less contrast than everywhere else on the landing. The brief says the shadow must never cross anything dark.

Suggested fix: Swing the leaf further (it reads in elevation as a thin strip at the jamb), or light its face with the door light so it sits at lum ≥150 where the shadow crosses it, or put the hinge on the far jamb so the leaf is clear of the shadow's path.

### [should-fix] Hand-over trace is whiter and wider than Section 15's, and it shows interior strokes

Evidence: Join crops at 88.8, 89.0 and 89.1: the most saturated pixels match (S14 ≈(76,253,140), S15 ≈(67,254,132)). But the S14 trace has white-hot cores and a broad mint halo on the lit wall, so it reads paler and thicker than S15's thin saturated #59ff8a line. At 88.75 and 88.8, green strokes cross inside the black body (an X over the body, wing lines), which breaks 'black shadow with a burning edge'. Wheel rows and floor heights line up within a few pixels.

Suggested fix: Match scope.js's width and core brightness for the part within ~60 units of the frame, cut the additive halo on the S14 side near the frame, and draw only the silhouette edge (or fade the interior polylines in only after u ≈ 5.95).

### [should-fix] Entry stretch does not hold 60 fps

Evidence: perf run 1: 'entry 82.4-84.9 s 30.8 fps draw mean 8.2 ms, p99 100.2 ms, worst 100.2 ms (slowest frame gap 121 ms)', 'middle ... 42.5 fps ... slowest frame gap 162 ms'. Run 2: 'entry 46.9 fps draw mean 5.7 ms, p99 9.1 ms, worst 36.8 ms (slowest frame gap 58 ms)', 'middle 60.0 fps', 'exit 60.0 fps'. The means are within budget, but the entry hitches on both runs.

Suggested fix: Move the lazy first-use bakes (door light, wedge, leaf, shader compile) into init so the first visible frames do not bake, then re-measure the entry.

### [should-fix] Poster reads as a modern enamel sign, not a 1920s German film poster

Evidence: Crops at 82.6 and 85.0: a bevelled double-ruled plaque with a drop shadow, Art-Deco inline caps (Phosphate) and a light Kai-style Chinese. It has no paper, paste edges, wear or printed texture. The right half of the lettering dims under the vignette at 82.6 (letter max ~180–194 against 229 on the left).

Suggested fix: Make it a pasted paper sheet (torn or curled corner, paste wrinkles, printed grain), use heavier, more angular hand-cut letter shapes for the Latin and a heavier Weibei for the Chinese, and lift the right-hand letters so they keep full contrast through the vignette.

### [minor] Fire starts just as the bill tip reaches the frame

Evidence: Range 88.40–88.70: at 88.45 the bill tip is about 10 px from the inner frame edge and unlit. At 88.50 it is burning at the frame edge. Any part reaching the frame before u = 5.5 would come out the other side unlit.

Suggested fix: Start the bill-tip ignition at u ≈ 5.42, or ignite the first ~15 units of the bill instantly at 5.5, so it is burning before it reaches the frame.

### [minor] Large dead dark area in bar 3

Evidence: 87.5, 88.0 and 88.3: the lower 45–50 % of the frame is near-uniform dark panelling under the landing with almost no modelling. The picture's interest all sits in the top half.

Suggested fix: Spill a little of the door light down the landing's front edge and the panel bevels, or add a faint second raking light on the panelling to give that half some shape.

## Items of the brief's checklist that failed

None. Every item of the "Check on the contact sheet" list passed.

## Measured before the fixes

- Purity: PASS. `node tools/check.mjs --purity --section 14` ended 'All 20 checks passed', including 'frames are a pure function of time (14 frames, two browsers, different orders) (byte-identical)', 'section 14 road(): defined everywhere, no slope steeper than 1 in 2 (steepest 0.393)' and 'roads are level and meet at every picture frame (worst mismatch 0.00e+0, worst tilt 0.00e+0 units (crossing 0))'. Exit 0.
- Speed: Run 1 (cold): entry 82.4-84.9 s 30.8 fps, draw mean 8.2 ms, p99 100.2 ms, worst 100.2 ms (slowest frame gap 121 ms, 77 frames); middle 84.9-87.1 s 42.5 fps, draw mean 3.9 ms, p99 15.2 ms, worst 15.2 ms (slowest frame gap 162 ms, 92 frames); exit 87.1-89.6 s 60.0 fps, draw mean 5.6 ms, p99 12.1 ms, worst 12.3 ms (slowest frame gap 27 ms). Run 2: entry 46.9 fps, draw mean 5.7 ms, p99 9.1 ms, worst 36.8 ms (gap 58 ms); middle 60.0 fps, mean 2.4 ms, p99 7.6 ms, worst 8.3 ms (gap 22 ms); exit 60.0 fps, mean 5.5 ms, p99 11.4 ms, worst 11.5 ms (gap 23 ms). The means are within the 10 ms and 14 ms budgets, but the entry hitches on both runs.
- Not looked at: I did not view every film frame. Coverage is the 16-frame contact sheet, range sheets (85.85–86.25 at 0.05 s, 86.9–87.7 at 0.1 s, 84.9–85.5 at 0.1 s, 88.4–88.7 at 0.05 s, 82.6–82.8 at 0.1 s) and single frames. I did not check u between −2.1 and −1.5 or between 7.5 and 8.1, the init or bake time, or the cached-layer megapixels. I did not measure gate weave amplitude, or confirm in pixels that weave is off the shadow near the crossings; I relied on the code path (weaveShare) for that. The pose match at u = 6 behind the 95 px picture frame can only be inferred from the wheels, floor and bill, since the frame hides the join. I did not check the soft-edge widths (2 → 6 units) numerically, or the 12-unit poster clearance numerically; it looked roughly 20 units at 84.0 and 85.0. Rights were judged by eye only.

## Second round (after the re-check)

The re-check found the climb, the beat, the door, bar 3 and the speed fixed, and the hand-over worse: a hard vertical seam across the black body at the fire front, green sparks inside the body, and a cluttered double image at the wheels and legs. The director's rulings for the second round:

1. **The black stays one black.** Remove the step that repaints an eroded mask in the deep tone, and its vertical gate. The fat parts of the shadow (body, head, bill, pouch, wing, tail) are drawn exactly as before the fire, through the same film pass, in every frame: one uniform soft black, no seam, no notch.
2. **No green inside the black.** Draw the trace (strokes, halo and sparks) into a buffer of its own, and add it to the picture through a shader that multiplies it by (1 - m), where m is the mask of the fat parts (1 inside, 0 outside, soft over about 1.5 units). Light can then never fall inside the body, at the tip of the bill or anywhere else.
3. **Thin members turn into light.** Tyres, rims, spokes, frame tubes, cranks, pedals, legs and feet keep no black shadow once they burn: behind the fire front their shadow fades out over about 12 units (a smooth ramp, no line) and one green stroke per member takes its place, exactly the strokes Section 15 draws. No black hairline, blob or arc may sit on or beside a green stroke once the front has passed.
4. **The green keeps its colour on the pale wall.** Under every stroke lay a dark scorch first (multiply to about a quarter of the wall's brightness within 2 units of the stroke, gone by 5 units). Core width and brightness as Section 15's entrance. At film time 89.0 the stroke cores on this side should be within about 10 % of Section 15's in saturation.
5. **The poster:** close the gap after the A in NOSFERATU (the T tucks in beside the A); spacing even to the eye. Nothing else on the poster changes.
6. Everything else stays: the beat at u = 3.0 (fingers out on the beat frame is accepted), the legs, the newel posts, the door, the paper poster, `road(x)`, `poseHz: 18`.
