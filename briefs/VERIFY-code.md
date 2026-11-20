# Verification of Section 20 (code)

An independent verifier reviewed the finished scene from rendered frames. Their findings follow. The director has read them and added rulings; where a ruling differs from the art brief or from a suggested fix, the ruling wins.

## Verdict

Close but not ready to show. The editor, timing, title, crossings, rest frame and gallery-still match all hold, and purity and speed pass. However, the bicycle's tyres, rims and chain disappear for single frames at 60 fps during bar 2 (for example 122.5667, 122.5833, 122.6833, 122.7833). Fix that wheel flicker first. Then make the on-screen SVG actually carry the bill and leg colours, and give the chrome proper margins.

## The director's rulings

1. **The wheel flicker is the first thing to fix, and it must be proved gone.** In single frames of bar 2 the tyres, rims, chain and far crank vanish (for example at film time 122.5667: compare it with 122.55). It happens only while a group of fills is mid-draw, when `drawCodeFigure` takes the scratch patch `code/figure-part` and calls `makeLook` a second time; no line dash or alpha is left set by the code you can see, so look at what the second `makeLook` or the scratch patch shares with the first (a cached layer, a sprite, a gradient or a path keyed without the context). Find the cause; do not paper over it. Then render the whole section at 60 frames a second (film time 119.0 to 125.0, 360 frames) and check every frame, by measurement and not by eye alone, that the tyres are there: write a small lab experiment for it if you need one (`dev/experiments/code-sweep.js`), and report the count of bad frames (it must be 0).
2. **The code on screen must be true.** A browser given exactly the text in the code pane, saved as `pelican.svg`, must draw a recognisable pelican on a bicycle in these colours. So: the root element carries `xmlns` (on a line of its own: `xmlns="http://www.w3.org/2000/svg">` is 35 characters); every part whose colour differs from its group's carries that colour itself, on a line of its own if need be (the bill's `fill="#f2a23a"` is written just before u = 3.0 and its path completes on 3.0); nothing is filled that should be stroked (neck, legs); the tubes of the frame meet. Prove it: add a lab page that renders the SOURCE text as an SVG image (`dev/experiments/code-svg.js`), look at it, and say in your report what it shows. The file may grow to about 32 lines; no line may exceed 35 characters. Keep the anchors exactly: bicycle complete at u = 2.0, bill on 3.0, pelican complete at 4.0, file closed at 4.6. The stream may run faster (up to about 45 chunks a second) to fit. A part still appears only after the last line of its element is complete.
3. **Give the chrome air.** New layout numbers, which replace the brief's: the top bar ends at y = 468 and the status bar begins at y = 754 (the canvas and code pane run from 468 to 754); the divider is at a + 84; line numbers end by a + 106; code starts at a + 110, so a 35-character line ends by a + 287; the title sits between a + 96 and a + 288 and the date line is right-aligned at a + 288. Centre the title in the visible part of the top bar (y 439 to 468) and the status text in the visible part of the status bar (y 754 to 780). At 1080p every piece of text then has at least 40 px of air from the edges of the screen, top, bottom and right. Title sizes stay within the rule (Chinese name at least 44 px tall, capitals and digits at least 26 px).
4. **The gallery still stays as it is framed** (the square is a crop of the painting, like every other still), with the Chinese name, the check mark and a strip of code. Do not add a second date. After the layout change, check again that the still and the frame at u = 7.0 differ only by the pelican and its shadow.
5. **The drawing must stand a 2x crop everywhere.** Fix all seven points the verifier lists: one continuous outline where the neck meets the body; legs as curved, tapered limbs ending in webbed feet with three toes, a foot plainly on each pedal; two or three clean flight feathers along the wing's lower edge in place of the spiky cluster; a single tidy wing tip resting on the grip (no dark smudge); a chainring with teeth and visible crank arms, smaller than the wheel hubs' flanges allow it to look like a washer; a secondary fold and a darker trailing edge on the wing; a tail of three or four clean feathers. Also the junction of bill and head: a soft base to the bill (the gape line running back under the eye), not a hard cut.
6. **No part may sit grey.** A white fill fading up over the dark canvas passes through grey. Bring fills in as a soft wipe (a clip that sweeps across the shape the way its outline ran, with an edge a few units soft) or as a fade no longer than 0.08 s. No fill may be visibly grey for more than two frames; check the head at u = 2.98 and the body at u = 2.4.
7. The grid's brightening when the `<svg>` line completes must be visible: about 12 % and eased over 0.3 s.
8. Left as they are: the dissolve to the gallery still (it belongs to the outro), the order of tail and neck, the two colours of path data.
9. Keep everything the verifier confirmed: the anchor and the glide, the timing table, purity, the crossings, the speed.

## Findings

### [must-fix] Tyres, rims, chain and far crank flicker out for single frames in bar 2

Evidence: A 60 fps sweep of 121.5-122.98 (verify-code-sweep2, measured on the rear-tyre pixels) finds 4 of 89 frames where the charcoal tyres and rims are gone and only thin spokes remain: 122.5667, 122.5833, 122.6833 and 122.7833. The far crank and chain also vanish. The same happens at 122.74 (a single shot and a range sheet, reproduced on re-render) and at 121.51. A sweep of 120.5-121.5 found none. Every affected frame has a fill group mid-fade, so the scratch patch 'code/figure-part' is in use. Shapes drawn before it in order disappear; shapes drawn after it survive. Purity still passes because the error is deterministic. In playback this is a visible flicker of the wheels.

Suggested fix: In drawCodeFigure (src/rig/skins/code.js about line 600), find why compositing the 'code/figure-part' scratch patch wipes the earlier contents of 'code/figure'. Check whether both patches resolve to the same pooled layer or size bucket in stage.patch / stage.layer, or whether the clear/touch upload of the scratch affects the main patch. Give the scratch its own Layer2D sized once per frame, or draw faded groups with ctx.save()/globalAlpha per shape. Then sweep 119.0-125.0 at 1/60 s and confirm the tyres are present in every frame.

### [should-fix] The SVG on screen would not draw this pelican (no colours on bill, pouch, eye or legs; open paths filled)

Evidence: In SOURCE, lines 13-21 all inherit fill="#f4f1ea" from the group. The bill (line 17) and pouch (18) would be off-white, not orange, and the eye (19) would be invisible on the head. The neck 'M39 19q-5-7 4-12' and legs 'M33 30l-3 10 8 5' are open paths with fill only, so they render as a thin crescent and a white triangle. There is no xmlns, so the file would not render on its own. The top tube ends at (31,33) while the seat cluster is at (31,35). The film's highlight, the bill's colour arriving on 3.0, has no colour in its line of code. The as-built notes admit this.

Suggested fix: Give the coloured parts their own short groups within 35 characters, for example '  <g fill="#f2a23a">' around the bill and pouch, and '  <g stroke="#e2783a" fill="none">' around the legs. Use a stroked path for the neck, or close it as a shape. Give the eye fill="#2b2f3a" (for example '<circle cx="44" cy="6" r="1" fill="#222"/>' is 34 characters with short coordinates). Move times so the anchors still hold.

### [should-fix] Chrome crowds the screen edges at zoom 1.1

Evidence: Measured on 121.03: the top of 代码美学 is 11 px from the top edge, the date line's ink ends 18 px above the bottom and about 23 px from the right edge, and 35-character code lines end at about 1888 px (32 px margin). At half size (verify-code-half.png) the comment line ends 15 px from the edge. A designer would read it as cropped, not composed.

Suggested fix: Trim the code pane's right extent: start code at a + 112 or use 8.0-unit Menlo so the longest line ends near a + 280. Move the title baseline down 3-4 units inside the visible top bar (439-462), and right-align the date at about a + 285 instead of a + 296, so every edge has at least 40-50 px of air at 1080p.

### [should-fix] Gallery still crops the code mid-token and drops the English title and English date

Evidence: verify-code-still.png: code lines are cut at '<path d=' and '<g fill="#'. 'Code Aesthetics' is not in the square. The date line stops at '大模型时代', so '· 2020s, the LLM era' is lost. The still shows the Chinese name only.

Suggested fix: Either tune A_REST and TITLE_X so the square holds 代码美学 and Code Aesthetics plus the date's year, or place a short status-bar date ('2020s') left of the check mark so the still carries an English line and a year. Consider letting the still's square end at the divider plus a few clean characters (line numbers and tags only), cut on a token boundary.

### [should-fix] Drawing falls short of 'the most refined' in several places

Evidence: In the 2x crop of 123.0: (a) a visible notch and step where the front of the neck meets the body; (b) the legs are rigid tapered capsules with an angular knee and flat orange blob feet that do not read as webbed feet; (c) the charcoal wing-tip cluster under the tail is a spiky, busy shape; (d) a dark claw-like smudge at the handlebar (the wing 'hand') reads as dirt, not a wing tip resting on the bar; (e) the chainring is a plain grey washer bigger than the hub, with no teeth or crank detail; (f) the wing is one flat grey-blue slab with a single fold line; (g) the tail is a small white blob. The bike and bill are the strongest parts.

Suggested fix: Smooth the neck and body join with one continuous outline (union the shapes, or extend the neck's base under the body with a matching gradient). Draw thighs as a single curved tapered stroke into a webbed foot with three toes. Reduce the wing tips to two or three clean feathers that follow the wing's lower edge. Rest a single tidy feather tip on the grip instead of the dark cluster. Give the chainring teeth (a dashed thick stroke) and visible crank arms. Add one secondary fold and a darker trailing edge to the wing.

### [minor] Head shows as a grey disc just before the bill beat

Evidence: 121.98 (u 2.98): the head fill is mid-fade (about 55 % alpha over the dark canvas), so the bird has a grey head on a white neck right before the strong beat.

Suggested fix: For white fills, fade the fill in over a pre-painted canvas-coloured underlay, or ramp the fill alpha faster (k 0.26-0.45) so the grey phase is only one or two frames.

### [minor] Translucent ghost pelican during the dissolve to the gallery still

Evidence: At 125.8 the painting on the gallery wall shows a half-transparent grey pelican on the empty canvas while the rest frame cross-fades into the still.

Suggested fix: Acceptable by design, but the dissolve could be shortened, or the pelican could be faded in at the end of the dissolve so it does not read as a ghost.

### [minor] Canvas-grid brightening at u = 0.32 is not perceptible

Evidence: 119.30 and 119.35 frames: the dot grid looks the same before and after the <svg> line is marked; the line's band is visible, the grid change is not.

Suggested fix: Raise the dot contrast step slightly (for example from about 6 % to 12 %) and ease it over 0.3 s so the line-then-effect link reads.

## Items of the brief's checklist that failed

- It is beautiful. Type, spacing, colour and drawing would pass in a product someone was proud of.: The palette, type and highlighting are calm and consistent, and the bill, eye and wheels are well made. Four things fail. (1) The tyres, rims, chain and far crank vanish for single frames at 60 fps: 122.5667, 122.5833, 122.6833 and 122.7833. Frames 122.74 and 121.51 also show it, and re-rendering 122.74 reproduces it. (2) At zoom 1.1 the chrome is jammed against the screen edges: the top of 代码美学 is 11 px from the top edge, the date ink ends 18 px from the bottom and 23 px from the right, and 35-character code lines end about 32 px from the right edge (frames 121.03 and 119.72). (3) There is a notch where the neck meets the body. (4) The legs are stick-like capsules and the wing-tip cluster under the tail is busy (2x crop of 123.0).

## Measured before the fixes

- Purity: node tools/check.mjs --purity --section 20: "All 20 checks passed." That includes "PASS frames are a pure function of time (14 frames, two browsers, different orders) (byte-identical)" and "PASS camera hands over to the outro without a jump (dx 3.33e-4, dzoom 4.37e-7)". Note: the tyre flicker defect is deterministic, so purity does not catch it.
- Speed: node tools/perf.mjs --section 20: entry 118.4-120.9 s 60.4 fps, draw mean 5.9 ms, p99 8.7 ms, worst 22.9 ms (slowest frame gap 19 ms, 150 frames). Middle 120.9-123.1 s 60.0 fps, draw mean 3.6 ms, p99 6.7 ms, worst 16.8 ms (slowest gap 31 ms, 132 frames). Exit 123.1-125.6 s 59.9 fps, draw mean 3.8 ms, p99 6.5 ms, worst 6.6 ms (slowest gap 22 ms, 150 frames).
- Not looked at: What I did not check:
- The 60 fps sweep for the tyre flicker covered only 120.5-122.98 s. I did not sweep 119.0-120.5 or 123.0-125.0, so there may be more flicker frames there. I did not find the root cause.
- Not every intermediate line event was checked at full size: the frame paths at 1.12/1.29/1.43, seat and bars at 1.60, body, tail, neck and head individually, pouch, eye, wing, and the shadow at 4.39 (seen only at reduced size).
- I did not check the accent band's 0.4 s fade duration or the chunk sizes and streaming rate frame by frame. I did not verify the scroll easing beyond seeing a mid-scroll sliver at 123.64.
- Crossing alignment: at u = 0 I matched wheel-hub height across the frame. The S19 head is hidden behind the frame at -0.1 to 0.1, so head alignment could not be compared directly. At u = 6 the right-hand side is the outro press-conference painting with no pelican, which is outside this section's scope.
- I did not view the still's live square at other u values, test other render widths beyond 960, or look at dark/light gallery context beyond the handover frames.
- I did not read src/rig/skins/code.js beyond the draw loop.

## Second round (after the re-check)

The re-check found the wheel flicker gone (0 bad frames), the SVG true (a browser draws the pelican from it, with an orange bill), and the drawing much improved. The 37 lines are accepted. The director's rulings for the second round:

1. **Feet and far leg.** Each foot is a webbed foot with three toes (two notches in its front edge), the ball of the foot on the pedal. The far leg and foot are seen on the far pedal, through the frame, in the darker far-side tone; not a loop hidden behind the chainring. The knee bends as it pedals.
2. **The gape line:** a fine dark line from the base of the bill back under the eye, plainly visible at 1x.
3. **More air for the bars.** The top bar ends at y = 474 and the status bar begins at y = 748 (the canvas and code pane run from 474 to 748). Centre the title in the visible part of the top bar (y 439 to 474) and the status text in the visible part of the status bar (y 748 to 780): at 1080p each then has about 30 px of air above and below. Check again that the gallery still and the frame at u = 7.0 differ only by the pelican and its shadow.
4. After these changes run the 360-frame sweep again (`dev/experiments/code-sweep.js`): 0 bad frames.
5. Everything else stays: the code text and its 37 lines, the timing table, the anchor and the glide, the reveal.
