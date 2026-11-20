# Verification of Section 12 (starry)

An independent verifier reviewed the finished scene from rendered frames. Their findings follow. The director has read them and added rulings; where a ruling differs from the art brief or from a suggested fix, the ruling wins.

## Verdict

The section works and is close to ready to show. Every timing matches the brief: the slowdown starts at u=2.2, the crawl runs 2.9 to 3.3, the race reaches 1.46x and it returns to standard pace by 5.9. Both crossings are clean, there is no unpainted edge, and the purity check passes. The most important fix is the bar-2 payoff: the pelican never visibly stands on the pedals and the sky at 1.46x barely looks faster than normal, so the joke's climax does not read. After that, repaint the title so it looks brushed in thick paint rather than typeset.

## The director's rulings

1. The race must read. From u = 3.3 to about 5.0 the pelican stands on the pedals: hips off the saddle, body pushed forward (lean of 0.3 or more), neck stretched ahead, a deeper bob on each downstroke; ease out so it is back in the normal pose by u = 5.35. During the crawl (2.9 - 3.3) add a small slow sway of the body and handlebar, as a rider balancing.
2. The sky may exaggerate the race: during the race the spin of the spirals and star-rings may run ahead of the true gearing (up to about two and a half times), so the heavens plainly race. It must stay perfectly continuous, a pure function of u (precompute a small table of the extra angle if you need an integral), nearly still during the crawl, and exactly in gear again by u = 5.9.
3. Title: keep the words (梵高《星夜》 and The Starry Night · 1889), but make them paint. Use the glyph shapes only as a mask: fill them with short loaded dabs that follow the strokes, with a lit ridge and a ragged edge, no drop shadow. English capitals and digits about 30 px tall on screen (about 15 units); lift the block so the lowest descender is at y 775 or higher.
4. Give the bicycle a calm ground: no dark-outlined house may sit behind the wheels (y 655 - 700) for x 300 - 700. Raise that row of the village behind a pale verge, or lighten and lower it. Move the spire so it is not behind the head or bill around u = 3.9, and move the star that sits behind the head around u = 2.0 - 2.5.
5. The pelican is painted in the scene's strokes: visible curved dabs of cream, pale blue and a little yellow following the form of body and neck, a broken brushed contour in dark blue instead of polygon edges, tyres of strokes that vary in length, spacing and colour.
6. The moon: a clear orange crescent, open to one side, inside a smaller yellow-green halo that does not touch the frame at any zoom.
7. Minor: look for first-use work that makes the exit stretch hitch, and move it into init.

## Findings

### [should-fix] Bar-2 'race' is not readable: pelican never stands on the pedals and the sky only reaches 1.46x

Evidence: Pose crops (out/shots/verify-starry-poses.png) at u=1.0, 2.6, 3.4, 4.5, 5.3, 5.5 look almost the same. The 0.13 lean and the extra bob are barely visible, and at 74.9 (u=3.9, full race) the body is upright as in normal riding. The brief's idea calls for 'it stands on the pedals, and the whole sky spins up and races'. At 1.46x the sky turns only half again faster than normal, so the payoff is weak next to the clear crawl.

Suggested fix: Between u 3.3 and 5.0, raise the hips off the saddle and push the body forward (lean about 0.3 or more, neck stretched forward, a deeper bob on each downstroke). Consider gearing the sky's spin to an exaggerated multiple during the race, for example uSpin = wheel/5 × (1 + 1.5·race), so the heavens visibly 'race' rather than move at a near-normal pace.

### [should-fix] Title lettering is typeset, not brushed in loaded paint; English line borderline in size

Evidence: Title crop at 72.0 (out/shots/verify-starry-title72b.png): Xingkai SC and Bradley Hand glyphs with a smooth yellow fill and a drop shadow. The shapes are clean and font-perfect, with no visible stroke direction or ridges. The brief asks for 'brushed in thick paint … not typeset'. Bradley Hand reads like greeting-card script. The English capitals and digits measure about 28–30 px: they pass the guide's 26 px but sit at the low edge of the ~30 px target. Descenders end about 10 px above the bottom of the frame.

Suggested fix: Rebuild the letters from short loaded dabs laid along each glyph's skeleton, with uneven width and a lit ridge, at a slightly larger size (English about 15 units). Lift the block about 3 units so the descenders clear y=778 with margin.

### [should-fix] Village houses and spire clutter the bicycle; star sits on the head

Evidence: At 74.1, 74.4 and 74.9, blue-grey houses with dark outlines sit inside both wheels, and the bicycle's dark-blue contour merges with them. At 74.9 (u=3.9) the church spire passes directly behind the bill and through the front wheel. At 73.1 and 73.3 (u=2.1 to 2.3) a yellow star ring sits right behind the head and pouch while the pelican slows (left panel of verify-starry-73.1v73.3.png).

Suggested fix: Keep the houses whose tops reach above y≈690 out of the band the wheels cover during bar 2 (x≈360 to 560), or lower and darken that row so the bicycle reads against a calm field. Move the spire a little so it is not behind the head at u≈3.9. Move the star near (≈400, 560) up or sideways out of the head's path during u 2.0 to 2.5.

### [should-fix] Pelican is a template rig, not painted in the scene's strokes

Evidence: In the pose crops the body is a flat cream polygon crossed by straight thin dark-blue seam lines (wing outline). The legs are straight orange sticks. The tyres carry evenly spaced yellow dashes that look mechanical. The brief asks for 'body and neck built from short curved dabs … tyres as rings of short strokes'. Next to the impasto sky, the bird looks like clip-art pasted on top.

Suggested fix: Lay visible curved dabs (cream, pale blue, a few yellow) over the body following its form, and make the dark contour a broken brushed stroke rather than polygon edges. Vary the tyre strokes' length, spacing and colour so the rim looks painted.

### [should-fix] Moon reads as a sun or fried egg, not a crescent

Evidence: Moon crop at 77.0 (out/shots/verify-starry-moon.png): a large yellow disc with an orange ring or blob around a pale yellow-green centre. No crescent silhouette reads, and the halo touches the top of the frame at zoom 1 (76.75 and 77.0).

Suggested fix: Paint a clear orange crescent (a thick C open to one side) offset inside a smaller yellow-green halo. Lower the moon a few units (to y≈490) or shrink the halo so it does not touch the frame.

### [minor] Chinese date missing from the title

Evidence: The brief's table gives 'Date on the title: 1889 年 · 1889', but the painted title has only 梵高《星夜》 and 'The Starry Night · 1889'. The Scream next door shows '1893 年' on its Chinese line (77.0). This follows the brief's own Title section, which omits 年, so the brief contradicts itself.

Suggested fix: Add a small '1889 年' after 梵高《星夜》 on the upper line, keeping the block within 270 units, to match the table and the neighbouring sections.

### [minor] No balancing during the crawl

Evidence: At 74.1 (u=3.1, the crawl and also the gallery still) the pelican only looks up. Nothing shows it balancing a nearly stopped bicycle (no wobble of the front wheel or body), though the brief says 'the pelican balances'.

Suggested fix: Add a small slow body sway and handlebar wobble during u 2.9 to 3.3, eased to zero at both ends.

### [minor] Exit stretch dipped below 60 fps on one run

Evidence: perf.mjs first run: exit 75.1-77.6 s at 39.7 fps (draw mean 10.2 ms, slowest gap 101 ms). Second run: 55.7 fps (mean 5.3 ms, gap 23 ms). Mean draw time is within the 14 ms budget both times, so the hitch may come from the neighbouring scene's first-use bake.

Suggested fix: Check whether either scene does a first-use bake or shader compile near 76 s, and warm it in init().

## Measured before the fixes

- Purity: Ran node tools/check.mjs --purity --section 12: all 20 checks passed. Section 12 lines: 'motion(): starts at 0, ends at 1000 (0.0002 .. 999.9998)', 'enters and leaves at standard speed (1.000x in, 1.000x out)', 'never rolls backwards (0 reversed samples)', 'frames are a pure function of time (14 frames, two browsers, different orders) (byte-identical)'.
- Speed: Ran node tools/perf.mjs --section 12 twice.
Run 1:
- entry 70.4-72.9 s: 58.8 fps, draw mean 9.5 ms, p99 19.4 ms, worst 20.4 ms, slowest gap 62 ms
- middle 72.9-75.1 s: 59.2 fps, mean 5.7 ms, p99 14.4 ms, worst 14.6 ms, slowest gap 31 ms
- exit 75.1-77.6 s: 39.7 fps, mean 10.2 ms, p99 19.6 ms, worst 19.6 ms, slowest gap 101 ms
Run 2:
- entry 60.2 fps, mean 6.1 ms, p99 9.8 ms, worst 14.1 ms, slowest gap 21 ms
- middle 60.1 fps, mean 3.3 ms, p99 6.1 ms, worst 6.1 ms, slowest gap 19 ms
- exit 55.7 fps, mean 5.3 ms, p99 6.7 ms, worst 6.7 ms, slowest gap 23 ms
Mean draw times are within the budget (bar 2 ≤10 ms, entry/exit ≤14 ms) on both runs. The exit stretch dropped frames on run 1 and was below 60 fps on both.
