# Verification of Section 10 (wayang)

An independent verifier reviewed the finished scene from rendered frames. Their findings follow. The director has read them and added rulings; where a ruling differs from the art brief, the ruling wins.

## Verdict

Not quite ready to show. The timing is right (the swell from 2.0, the instant crisp slap at 3.0, the bill claps at 3.5 and 3.75, forward-stepping wheels), the crossings line up, coverage is complete, purity passes and speed is at 60 fps. The one thing to fix first is the title: the English and date lines are only about 20-24 px tall, and the plaque reads as a modern sign rather than pierced hide. Close behind is the pelican sinking into the dark ranks around u 0.1 and 5.4-5.9.

## The director's rulings

1. Title type: the guide's sizes are font sizes, but the result must also be easy to read. Raise every line that is not the Chinese name until its capital letters and digits are at least 26 px tall on screen at zoom 1.1 (about 12.5 units of font size for most faces; measure it on a full-size frame). The Chinese name stays at least 44 px. A title fixed in the world stays within 270 units of width and in full view for at least 2.1 s. Make the plaque a piece of pierced hide: a scalloped outline with a dot-pierced border, plainly hung on two cords from the valance, the letters cut through it as light. Use a heavier, carved-looking face for the Latin lines (for example Rockwell or Copperplate bold).
2. The standing ranks must sit behind the pelican in tone: about half the pelican's density and with a softer edge, as puppets do that stand a little off the cloth. The pelican is always the darkest and sharpest shape. Check u = 0.1, 0.45, 5.45 and 5.75.
3. The looming shadow (u 2.0 - 3.0) stays warm brown, never grey; density no lower than about 55 %, blur no more than about 8 units, so the head, bill and pouch still read.
4. The slap at u = 3.0: a ring that visibly runs out through the cloth for about 150 units over 0.35 s (displace or brighten the weave), and a brief flare of the lamp on the beat.
5. The ground: the top of the ground strip is y = 700, where the pelican's wheels touch. The standing puppets' feet rest on the same line.
6. Vary the piercing (graded dot rows, teardrops, chevrons, long slits, lattice in the crowns) and the silhouettes of the standing puppets (stance, arm, headdress).

## Findings

### [must-fix] English and date lines of the title are below the readable size

Evidence: Full-size frame 59.4 (u = 0.4), row scan of the plaque: the Chinese line spans y 103-165 (about 62 px, fine). The JAVANESE WAYANG KULIT capitals span y 205-225 (about 20-23 px). The 1800 digits span about 24 px. The guide asks for at least about 30 px on every line other than the Chinese name. Code wayang.js:917/920 sets the em to 10.6 and 10.2 units, so the em only just meets 9.5 units and the visible glyphs fall well short.

Suggested fix: Raise the English line to about 14 units and the date to about 13 units of em, so the capitals come out at 30 px or more. Shorten the dashed rules or widen the plaque within the 270-unit limit to make room, or set JAVANESE WAYANG KULIT on two lines.

### [should-fix] Pelican nearly lost against the standing ranks around both crossings

Evidence: 59.1 (u = 0.1): the pelican's head, bill and body sit over the dark overlapping left rank and only the wheels separate out. 64.45 (u = 5.45) and 64.75 (u = 5.75): its head and bill merge with the dark heads of the right rank and the tree of life, and the body is dark brown on dark brown. On the contact sheet at 64.5 the pelican is hard to find at a glance.

Suggested fix: Lighten the ranks further where the pelican passes. For example, fade the rank multiply to about 50-60% inside a soft vertical band that follows the pelican's x near the crossings. Or give the pelican puppet a slightly wider warm penumbra or rim of light so its outline separates from the ranks. Keep the head always over lit cloth by thinning the rank heads near y 560-600.

### [should-fix] Title lettering and plaque are not period material

Evidence: Crop of 59.4: the lettering is Optima (a 1950s typeface) and Weibei/Heiti on a flat dark rectangle with thin dashed rules and two small asterisk rosettes. It reads as a restaurant or museum signboard, not a pierced hide panel. The 'two cords' are barely visible small hooks at the valance.

Suggested fix: Build the plaque as a pierced hide shape: a scalloped or kayon-like outline with a dot-pierced border, letters cut as stencils with bridges, and a rough edge. Draw visible cords to the valance. Use a heavier, carved-looking face for the Latin text (or letterforms built from strokes) and pierce the dividers as dot rows instead of dashed lines.

### [should-fix] The looming shadow in bar 2 is grey and its head and bill dissolve

Evidence: 61.5 and 61.55 (u = 2.5): the swollen shadow is a pale cool-grey blur. The head is a faint smudge near (950, 140) and the bill-pouch is an indistinct pale band, so the 'pelican' read relies on the wheels. The brief asks for warm brown-black thinning, and the swell is also the scene's main highlight.

Suggested fix: Keep the swollen shadow warm (multiply towards #6b4520, not grey). Cap its thinning at about 55-60% density and its blur at about 8 units, so the bill and pouch silhouette still read. Optionally add a slightly sharper core under the blur.

### [should-fix] The slap's cloth ripple is barely visible

Evidence: 62.04 shows no ripple. At 62.12 there are only very faint concentric rings around the body. To an ordinary viewer the slap at u = 3.0 reads only as a change of size and focus, with no cloth reaction.

Suggested fix: Make the ripple a stronger, quick displacement or brightness ring in the cloth weave and light, travelling out about 150 units over 0.3-0.4 s with clear contrast in the first 0.1 s. A brief brightening of the lamp at 3.0 would also sell the 'knock'.

### [minor] The pelican's wheels float above the line the standing puppets stand on

Evidence: 60.98 and 62.0: the pelican's wheel bottoms are at about y 822 px, while the standing puppets' feet and the top of the hem band are at about 835-840 px. The pelican looks as if it rides 4-6 units above the ground strip the others stand on.

Suggested fix: Raise the hem and the standing puppets' feet so the top of the ground strip is at road y = 700 (as the brief's 'top of the ground strip is the road' says), or start the hem band at 700.

### [minor] Title plaque position deviates from the brief

Evidence: The plaque sits at x 120-370, y 458-534 instead of the brief's x 200-470, y 446-544. This is documented in 'As built' with a reason, and the measured full-view window is u ≈ 0.40-2.54 (2.14 s), which only just clears 2 s.

Suggested fix: Accept the documented deviation, but get sign-off from the owner. If the plaque is enlarged for the size fix, re-check that it is still in full view for at least 2 s and clear of the swell.

### [should-fix] Art: piercing and figures are uniform and template-like

Evidence: At 59.4, 64.45 and in the still, the standing ranks are near-identical profiles filled with one even dot grid and cross-stitch blocks. The overlap of translucent ranks becomes a brown haze rather than layered lace. Every hole on the pelican is the same small round dot, with no change in rhythm between body, wing slits and borders. The rods are perfectly straight and of even width. The cloth light is a smooth digital gradient with a faint weave.

Suggested fix: Vary the piercing vocabulary (graded dot rows, teardrops, chevrons, long wing slits of varied length, lattice in the crowns) and the hole scale per region. Give each rank figure a distinct silhouette (stance, arm angle, headdress outline), crisper outer edges and less translucent fill. Taper the rods and add a slight bow. Strengthen the visible weave and the uneven lamp falloff.

## Items of the brief's checklist that failed

- **Three rods on the pelican are visible in every frame**: Clear in 60.98, 62.0, 62.6 and the still: a body rod with a spiral binding, a rod from the lower-bill tip and a foot rod. During the swell (61.5, 61.97) the foot rod is a faint blur that is hard to pick out. Over the ranks (59.1, 64.45, 64.75) the pelican's rods merge with the standing puppets' rods in the hem area and cannot be told apart.
- **Title made of light, legible, three parts**: Frame 59.4, crop: 爪哇皮影 / JAVANESE WAYANG KULIT / 约 1800 年 · c. 1800 are all present, amber letters on a dark plaque. The Chinese glyphs are about 62 px tall (pass). The English capitals are about 20-23 px and the date digits about 24 px, below the roughly 30 px asked for (code sets the em to 10.6 and 10.2 units, so the em is about 33 px but the visible glyphs are much smaller). The lettering is Optima and Weibei/Heiti on a plain rectangle with dashed rules, so it reads as a modern sign rather than lettering cut through hide.

## Measured before the fixes

- Purity: node tools/check.mjs --purity --section 10: "All 15 checks passed." This includes "PASS frames are a pure function of time (14 frames, two browsers, different orders) (byte-identical)", "PASS tracking camera never jumps (fastest pan 1.57x standard speed at 4.19 s)", "PASS camera hands over to the outro without a jump", "PASS pelican is on the boundary at every crossing (worst error 0.00e+0 units)" and "PASS roads are level and meet at every picture frame". It also reported "12 of 20 sections are painted."
- Speed: node tools/perf.mjs --section 10 (render width 1920, page ready after 2.4 s): entry 58.4-60.9 s 60.1 fps, draw mean 8.1 ms, p99 18.1 ms, worst 20.8 ms (slowest frame gap 22 ms, 150 frames); middle 60.9-63.1 s 60.1 fps, draw mean 3.7 ms, p99 8.0 ms, worst 10.5 ms (slowest gap 25 ms, 132 frames); exit 63.1-65.6 s 60.0 fps, draw mean 5.3 ms, p99 7.1 ms, worst 8.8 ms (slowest gap 20 ms, 150 frames). At 60 fps throughout; the entry p99 of 18.1 ms is above the 16.7 ms frame budget.
