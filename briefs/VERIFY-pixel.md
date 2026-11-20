# Verification of Section 16 (pixel)

An independent verifier reviewed the finished scene from rendered frames. Their findings follow. The director has read them and added rulings; where a ruling differs from the art brief or from a suggested fix, the ruling wins.

## Verdict

The section is close to ready. The jump, coin, 1UP and counter change land exactly on u = 3.0, both crossings are clean, coverage is complete, and purity and speed pass easily. It should not be shown until the lamp post and life-ring stop merging with the pelican at u ≈ 4.0-4.3: the ring sits at its chest and the pole fuses with its neck outline. That is the single most important fix. After that, give the title a little more than the bare 2.0 s in view and clean up the tangled pedalling legs.

## The director's rulings

1. Nothing thin and dark may stand in the sprite's plane where the sprite passes. Take the lamp post and the life-ring out of the rider's path: put the lamp on the lighthouse rock in the far layer, or drop it; hang the life-ring below deck level. The title board no longer stands on posts: hang it on two chains from the top edge.
2. The board: at most 250 units wide, or placed so that it is in full view for at least 2.3 s; raise it one or two art pixels so clear sky shows between it and the pelican's head.
3. The crank cluster: redraw it by hand so legs and pedals can be told apart: one near leg with a clear thigh and shin and an outline where it crosses the frame, the far leg a single darker stub, one clear pedal.
4. Gallery still: frame the jump so the board is either wholly in or wholly out, and the arc and the gap fill the square.
5. Lettering: the 8 must not look like an S (close its waist); write 1980s with a small s; replace the HUD's drop shadow with a one-pixel outline or none, so digits do not run together.
6. Small things: no stray pixel left where the coin was; a landing squash of two or three art pixels; 1UP appears where the coin was.
7. Make every drawn thing our own. The mechanics stay, because the owner's brief asks for them (a jump over a gap, a coin, 1UP on the beat). The collectable becomes a gold token stamped with a fish; clouds are long flat bars, not stepped puffs; nothing may recall a particular real game.

## Findings

### [must-fix] Lamp post and life-ring merge with the pelican in bar 3

Evidence: 99.05 (u 4.05): the life-ring sits right at the pelican's chest, under the bill tip, so it reads as if the bird is wearing or holding it, and the black pole runs up through the bill area. 99.25 (u 4.25): the 1-px black pole runs straight up behind the neck and merges with the neck's black outline. The pole shows above the head, as if growing out of it. In the contact sheet the lamp sits on the sprite from about 98.9 to 99.5. Guide 4.2: anything crossing y 560-705 must plainly pass in front or behind, never something it could merge with.

Suggested fix: Move the lamp post and life-ring so the rider does not pass them in bar 3, for example to x ≈ 640 (passed during the jump, while the sprite is high) or past x ≈ 900. Or put them on the near side so they plainly pass in front, with a distinct value (a lighter pole) so the outline does not fuse with the bird's outline.

### [should-fix] Title is in full view only about 2.0 s, the bare minimum

Evidence: 95.3 (u 0.3): the board's right edge is at x ≈ 1905, only just in. 97.3 (u 2.3): the left edge is at x ≈ 5. 97.45: '8-BIT' and '1980S' are already cut off at the left. So the full view runs about u 0.29-2.30, with almost no margin.

Suggested fix: Make the board slightly narrower (for example 250 units) or move it about 10-15 units right so it gets a few tenths of a second of margin past 2 s.

### [should-fix] Sign crowds the head and its posts cross the sprite

Evidence: 95.3 to 97.0: the board's bottom edge (screen y ≈ 395) is about 15 px above the top of the pelican's head (y ≈ 410) for most of bar 1, and the right post passes behind the bill (95.3) and against the rear wheel (97.3). Guide 4.3: keep the title clear of the pelican.

Suggested fix: Raise the board by one or two art pixels, or set it a little further from the rider's path, so there is clear sky between the board and the head. The HUD row allows a few units.

### [should-fix] Pedalling legs read as a pixel tangle

Evidence: 97.3, 98.55, 99.25: the near orange leg, the brown far leg, the red frame and the black crank overlap in a 40x40 px knot. The legs and pedals cannot be told apart at a glance.

Suggested fix: Simplify the crank cluster by hand: drop the far leg or merge it into a single darker-orange stub, give the near leg a clear 2-px thigh/shin silhouette with a black outline where it crosses the red tubes, and keep one clear pedal pixel cluster.

### [should-fix] Gallery still has an awkward sliver of the sign at the left

Evidence: verify-pixel-still.png: a 60 px brown strip of the board with part of one glyph cut off at the left edge. The bottom 45 % is just sea and pier.

Suggested fix: In the still, hide the sign or offset the square crop so the board is either fully in or out. Consider lowering the framing so the jump arc and gap fill the square.

### [minor] Sign-font '8' looks like 'S'; date shows '1980S'

Evidence: Sign crop from 97.3: the 5-row 8 in '8-BIT' and '1980S' is an S with two extra pixels, nearly the same as the S beside it. '1980S' (capital S) reads like the number 19805.

Suggested fix: Close the waist of the 8 (a full middle bar) so it differs from S, and use a lowercase-style or narrower 's' (or drop it: '1980·20世纪80年代').

### [minor] HUD drop shadow muddies the digits

Evidence: HUD crop: each glyph has a one-art-pixel black shadow down and right, which bleeds into the next letter. '016000' and '×99' look doubled, and the × is a blob.

Suggested fix: Use a 1-px outline or no shadow on the HUD font, and give the × its own clean 5x5 glyph.

### [minor] Stray pixels: sparkle remnant, nail dots, cloud streak by the coin

Evidence: 98.45: a single yellow pixel left floating at the old coin spot (x ≈ 720, y ≈ 127). 97.45/97.55: a tiny cloud sits right of the coin and reads as a motion streak. 95.0: a lone black pixel at the bottom-left corner of the board.

Suggested fix: End the sparkle on an empty frame (or a 4-pixel cross) rather than one dot. Move the small cloud away from the coin's height. Make the board nails symmetric 2x1 or drop them.

### [minor] HUD floats in the scene while the pelican is still in Section 15

Evidence: 93.5 (u -1.5): '×02' of the HUD hangs at the top of the pixel painting next to the oscilloscope. 102.5: an 'S' of SCORE lingers at the left edge.

Suggested fix: Acceptable as is, but the HUD could be clipped to the picture or faded in from u ≈ 0 so no orphan HUD fragments show beside the neighbours.

### [minor] Squash on landing barely visible; 1UP sits beside the coin, not at it

Evidence: 98.55 (squash window): the head is only about 10 px lower than at 97.3, so no squash reads. 98.0: 1UP appears left of the head at x 745-905, while the coin was at x ≈ 960. That is a documented deviation from 'appears at the coin'.

Suggested fix: Squash by 2-3 art pixels with a widened body for the 3.5-3.625 frame. Start the 1UP at the coin and drift it up-left, so the pop clearly comes from the coin.

### [minor] Genre mechanics are close to one famous franchise

Evidence: Coin over a gap, a 100th coin giving '1UP', and a SCORE/coin ×NN/STAGE/lives HUD in a white bold font on a blue sky with white stepped clouds.

Suggested fix: Make the collectable something of its own (a fish token or a pier ticket) and use your own extra-life word (for example '+1 LIFE' or '1UP' recoloured), so the homage is to the form, not one game.

## Measured before the fixes

- Purity: node tools/check.mjs --purity --section 16: 'All 20 checks passed.' This includes 'PASS frames are a pure function of time (14 frames, two browsers, different orders) (byte-identical)'. It also reported '16 of 20 sections are painted.'
- Speed: node tools/perf.mjs --section 16 (render width 1920). Entry 94.4-96.9 s: 60.2 fps, draw mean 4.7 ms, p99 6.8 ms, worst 12.2 ms (slowest frame gap 20 ms, 150 frames). Middle 96.9-99.1 s: 60.1 fps, draw mean 1.4 ms, p99 7.3 ms, worst 8.0 ms (slowest gap 24 ms, 132 frames). Exit 99.1-101.6 s: 60.0 fps, draw mean 2.6 ms, p99 4.9 ms, worst 5.1 ms (slowest gap 19 ms, 150 frames).
