# Stage 5: the polish

The owner's brief for this stage: "Polish the entire film. Export the finished video."

Nine independent reviewers looked at the finished film on 2026-11-18 (three sections each, the intro and outro with the gallery wall, and the twenty-one crossings with the ride as a whole). They rendered and read about 400 full-size frames and ran every part's sound check. What they found, and what the director ruled, is below, part by part. A ruling is the task; a finding that no ruling takes up is listed under "Left alone" with the reason.

**What polish means here.** Every change risks something that already works, and every section has been reviewed before. So: do exactly what a ruling says, by the smallest change that cures it, and leave every other pixel and every other sound exactly as it is. Frames are a pure function of time, so "exactly as it is" can be proved: a frame that was not meant to change must be byte-identical to the film before Stage 5.

## One rule for every title card

The owner: "All text must be clearly readable at 1080p resolution." The scene guide (4.3) makes that measurable: on screen at zoom 1.1 the Chinese name is at least 44 px tall, and the capital letters and digits of every other line at least 26 px. Seven reviewers measured the same shortfall: the Latin lines (English name, date) had been set at about 10 units of font size, which gives 21 to 25 px. **Every title line that carries the English name or the date must measure at least 26 px on its capitals and digits, and every Chinese name at least 44 px**, measured on a rendered 1920 x 1080 frame at zoom 1.1 (count the pixel rows of a capital letter and of a digit; do not go by font size: faces differ, and old-style figures sit low). The enlarged line must still fit its panel, stay clear of the pelican's path (y 560 to 705) and of the bar-2 action, and the title must still be in view in full for two seconds.

## Rulings

### 01 sahara

1. **The cattle must be seen to look up.** The section's joke is that herders and cattle stop to watch. Each animal lifts its head while it is still off the right edge of the screen (330 to 410 units ahead of the pelican; the screen shows 303 units either side at zoom 1.1), so a viewer only ever sees heads that are already up, and the six taps in the sound mark movements nobody sees. Shorten the lead at which each animal reacts so that every head begins to lift when the animal is plainly in view: no more than about 240 units ahead of the pelican. Keep the stagger from animal to animal, keep the heads following the pelican as it passes, and keep every head facing the exit by u = 5.9 as now. Then move the six taps in `audio/parts/01-sahara.js` to the new look-up times by the same rule that placed them before, so that picture and sound still agree, and report the new times.
2. **The title clear of the herder's arm.** The raised arm and staff of the white herder at x about 505 cross the "E" of "c. 4000 BCE" from u 1.2 to 3.5. Shorten or turn the arm so that it stops short of the date line. Do not move or change the title.
3. **The pelican's head clear of legs and staffs.** At u about 1.3 (the child herder at x about 214) and on the strong beat u = 3.0 (the white herder at x about 505) a herder's legs and staff stand behind the pelican's head and bill, and the shapes tangle. Raise those herders or shorten their legs and staffs so that nothing of them is lower than y about 565 where the pelican's head passes (the top of its head is at about 572).
4. **The exit clear.** From u 5.2 to 5.95 a standing herder with a staff (x about 956) and the calf behind him sit on the pelican as it enters the exit frame; his head shows through its neck. Two reviewers reported it. Move him so that the pelican has passed him by about u 4.8, or lift him to the herd's line; keep his gesture.

### 02 egypt

1. **The title's date line** ("约公元前 1300 年 · c. 1300 BCE") measures 24 to 25 px: bring it up to the rule (see above). It must still fit its block and not crowd the cartouche below it.
2. **The bill and the yoke.** On the beat at u = 1.0 the pelican's yellow bill lies along the third bearer's yellow yoke pole at the same height and reaches his face: the two read as one bar. Lift the yoke and its jars onto the top of his shoulder (about 10 units), or, if that spoils the carry, paint the pole red-brown. The pose in bar 2, the cartouche and all timing stay as they are.

### 03 han

1. **The title's date line** ("约公元 100 年 · c. 100 CE") measures 22 to 23 px in a thin italic that the rubbing's speckle eats into; the English line is on the limit (25 to 27 px). Set the date line upright and heavier at a size that meets the rule, protect it from the speckle as the fine lettering elsewhere in the bake is protected, and bring the English line safely over 26 px. The panel is x 200 to 450: the lines must fit inside its frame with margin.

### 04 tang

1. **The English name and date lines** measure 21 to 22 px: bring them up to the rule. Keep their right edge where it is; the block may grow left and down but must stay within the 270 units a fixed title may span, clear of the date column and seal, and above the pelican's head.
2. **The gallery still.** In the still (u 3.9) the pelican's head and neck are drawn over a lady and threaded by the sashes, all in the same line: at wall size only the bill and wheels separate it. Choose a moment (and, if needed, a centre) for the still at which the pelican stands between two ladies, clear of the sash bundle, with the title's Chinese name in the square if that is possible. Only the `still` setting changes; the section itself does not.

### 05 song

1. **The find.** On the push-in, at film 32.45 to 32.58 s (u 3.45 to 3.58), the far-away "speck" pelican has grown into a white ball with a square head and two empty circles about 25 px across, and then it pops into the painted pelican in one frame. This is the moment the viewer is meant to find the bird. Hand over from speck to painted figure while the speck is still a speck (when it would be more than about 8 px on screen), or dissolve the one into the other over at most 0.1 s; and draw the speck's head touch round. Check the pull-out too (about u 2.28), where the same switch happens the other way.
2. **The English lines of the colophon** measure 22 px: bring them up to the rule, on bare silk, clear of the trunk, the bluff and the pelican's path.

### 06 qingming

1. **The English name and date lines** measure 22 px: bring them up to the rule. The name is long: break it into three lines if it would otherwise pass 270 units. Keep it above the pelican's head where it passes (x 100 to 250).
2. **The boat's crew.** At the crown (u 2 to 4) the two men standing on the cabin roof keep their heads level while everyone else looks up. Give them the same head tilt as the haulers at the bow; their heads must not touch the arch timbers.

### 07 maya

1. **"MAYA CODEX" and the date line** measure 23 to 25 px: bring them up to the rule; the five character cartouches stay as they are. The longer date line must not run into the small glyph block at the right end of the strip.
2. **The face of "MAYA CODEX".** It is set in Papyrus, a face so worn as a stand-in for "ancient" that it reads as a cheap choice in a film whose pictures are carefully made. Set the English line in a plain face from the guide's list (Optima or Gill Sans capitals, for example), black as now, and check that it sits well with the cartouches.

### 08 mughal

1. **The date lines.** The red figures "1600" measure 20 to 24 px in a face whose figures sit low, and the "g" of "Painting" touches the "C" of "CE" below it. Cure both together: figures that meet the rule, and clear space between the two lines, inside the cartouche's right reserve (re-cut the reserve if it must grow). The cartouche stays within y 468 to 520, and the gallery still must keep its layout.

### 09 bada

1. **The English inscription.** The capital of "Bada Shanren Expressive Ink" measures 24 px, and in "c. 1690" the face's old-style figures leave the 1 and the 0 at 15 to 21 px: the year is the least readable text in the film. Bring both lines up to the rule and set the year in lining figures (a face whose figures line, or the digits alone in such a face). Keep the right edge at x 446 with the seal after it, and at least 40 units between the inscription and the rock.
2. **The pouch at rest.** In bars 1 and 3 the pouch is a wash so pale that with the long straight bill the bird reads as a heron. Give the pouch one tone more ink at rest, still a single wet touch with no outline, so that it holds as it does when the head is tipped back. If it starts to read as a filled shape or grows a halo, take it back and say so.

### 11 ukiyoe

1. **The umbrella's exit.** At u 5.28 the shut umbrella sticks up behind the head, held by nothing, and one frame later it is gone. Let it slide down along its own length behind the body between u 5.2 and 5.3, or fade over the same tenth of a second. The fold's click at 5.15 must still read as the umbrella shutting.
2. **The umbrella's entrance.** At u 2.22 it appears whole between two frames. Let it come out over about 0.08 s (growing from the grip, or sliding out from behind the back). Its states at u 2.5, 2.65 and 3.0 stay exactly as they are.
3. **If it is cheap: the pilgrim and the farmer.** From u 2.9 to 3.4 the running pilgrim and the hunched farmer overlap into one knot of hats and legs, on the strong beat. If letting the pilgrim start a little earlier or run a little faster takes him past the farmer before u 2.8, do that. Do not move the farmer (an earlier ruling keeps him clear while the umbrella folds, u 5.0 to 5.3). If it cannot be done by the pilgrim's timing alone, leave it and say so.
4. **Measure the title cards of Sections 10, 11 and 12** against the rule above (nobody has measured them by pixel). If a line is under it, bring that line up to it in that section's scene file, by the smallest change. Change nothing else in Sections 10 and 12: their reviewer's verdict was "leave alone".

### 16 pixel

1. **The lives counter is off the screen.** For as long as the camera is at zoom 1.1 (u 0 to about 4.5) the right end of the status line is cut by the screen's edge: it reads "PIER 16 [icon] x0" and the last digit is a sliver, so the extra life that "1UP" gives is never seen to arrive. Bring the right-hand group (PIER 16, the lives icon and its count) in so that its right end is at least 6 units inside the visible width (303 units either side of the pelican at zoom 1.1) for the whole section, without touching the group to its left. The counters must still turn over on u = 3.0.
2. **"1UP" must not cover the head.** On the frame of the beat (u 3.0 to 3.125) and in the gallery still its letters sit on the pelican's crown and eye. Draw the pelican over the "1UP" (the sparks may stay over the pelican), or begin the "1UP" high enough that its bottom clears the head. The still must show the head whole.
3. **"+100" clear.** A cloud bar ends exactly at the "+" (it reads as a minus sign or a speed streak): move the "+100" a row or two, or give its glyphs the sky-coloured backing the status line has. In the gallery still its "+" must not be cut by the square's edge.
4. **Measure the title cards of Sections 16, 17 and 18** against the rule above. If a line is under it, bring that line up to it in that section's scene file, by the smallest change. Change nothing else in Sections 17 and 18: their reviewer's verdict was "leave alone".

### 19 shortvideo

1. **The title** (the caption block) is under the rule: the Chinese name 40 px, capitals and digits 21 px. Bring it up to the rule. The block may grow downward into the gap above the sound line; it must not grow upward into the wheels, and the progress bar stays clear.
2. **The heart off the head.** The double-tap heart sits on the pelican's head and neck from u 3.0 to 3.9; only the bill shows. Move it onto the body and wing so that head and bill stay clear. Its timing stays.
3. **The gallery still** (u 3.6) is frozen with the head under the heart and the like count unreadable on a white poster. Choose a moment at which the head, bill and wheels are clear and the title block is whole in the square.
4. **The scrims before the bars.** At u 2.00 to 2.08 the interface's top and bottom gradients are already drawn inside the future 9:16 column, with hard vertical seams over the sky and the lane, before the black bars have closed. Let the scrims come in with the bars.
5. **An interface that is nobody's.** The owner asks for fictional interfaces. The drawing is original, but three things together are one real app's signature: the tab words 关注 / 推荐 / 同城, the sound line beginning 原声, and the round avatar with a red plus above heart, comment and share. Invent other tab words (for example 关注 / 精选 / 附近), reword the sound line (for example 声音 · 车铃与链条), and give the avatar a follow mark of another shape and colour. The rail's heart, comment and share may stay.
6. **The rail's counts** vanish where a white poster passes behind them (u 3.4 to 4.1): give them the soft dark shadow the caption has.
7. **The bar is seen to finish.** The owner: "The progress bar reaches the end at the exact moment the pelican passes through the picture frame." It does (it is full at u = 6.0), but the incoming picture frame covers the bar's right half from about u 5.3, so nobody sees it arrive. The part of the bar left of the frame stays on screen for another half second after the crossing. On u = 6.0 exactly, let the whole bar answer: one short pulse (brighter and a little thicker, about a quarter of a second, then at rest and full). Nothing may show before u = 6.0.

### 20 code

1. **The entrance.** For the first second and a half the pelican is a thin grey-blue dashed outline on a near-black ground, far fainter than any other entrance in the film: the vivid short-video pelican has just gone into the frame and the eye has almost nothing to follow. Give the construction outline more contrast for u below about 1 (brighter stroke, still dashed, still plainly a guide), easing to what it is now. The stroke-by-stroke drawing that follows stays as it is.
2. **`</svg>` whole.** When the last line completes (u 4.6) the pane is still scrolling and the line is half cut by the status bar for about 0.17 s. Begin the last scroll early enough that the row is in place when the line completes.
3. **The wing's trailing edge** is a lumpy wave at full size, the one place where the drawing is less exact than the bicycle and the bill. Draw it as two or three clean arcs that follow the flight feathers (the SVG text on screen must stay true to what is drawn).
4. **The date line in the resting picture.** In the gallery still, and in the live picture after the editor has glided to rest, the status bar reads "21 世纪 20 年代 · 大模型时代 · " and then a sliver of the next letter, cut by the picture frame; it is on screen beside the empty press table for the last eleven seconds of the film. In the resting view and the still the date line must end whole inside the square (the Chinese date alone, or the whole line moved in). The resting live picture and the still must stay identical apart from the pelican (`node tools/shot.mjs --still 20` against `--still 20 --u 7.0`), because the outro dissolves from the one to the other.
5. **Measure the title card of Section 20** (代码美学, Code Aesthetics, the date) against the rule above, and bring up any line that is under it.

### 21 outro and the gallery wall (the director does these by hand)

1. **The nameplate.** Its text is wider than the plate's inner rule and sits left of centre: the first character touches the rule. Widen the plate and centre the ink.
2. **The ghost in painting 20.** The live painting dissolves into its still from 0.55 to 1.3 s after the crossing, while the painting is still large: the pelican that has just ridden out of it is seen to fade back in. Dissolve later, while the pull-back is fastest and the painting small.
3. **The flashes.** The owner: "Several camera flashes illuminate the empty chair on strong beats." A flash is drawn as a flat white veil over the whole picture, which washes the chair out instead of lighting it. Draw the set as a flash lights it: the cloth and the plate burnt out, the chair's leather and the microphones catching light, the curtain lit with the hard shadow of the chair and the microphones thrown on it, from a different side at each flash.

## What was done

Nine fixers carried out the rulings on 2026-11-18, each in a copy of the project of its own, and each proved what it had changed by comparing its frames, pixel for pixel, with the film as it stood before (frames are a pure function of time, so a frame that was not meant to change is byte-identical). The director did the outro by hand. Five independent checkers then looked at every ruling again on the integrated tree. Each art brief ends with a paragraph "Stage 5" that says exactly what changed in that section; `briefs/CUES.md` has the new times of everything that moved.

| Part | Done | Left undone, and why |
|---|---|---|
| 01 sahara | The cattle look up one second later, each in plain view (157 to 236 units ahead of the pelican), and the six taps moved with them (u 2.75, 3.0, 3.25, 3.75, 4.25, 4.75). The white herder's arm goes up, clear of the date. Three herders stand higher (feet at y 563), clear of the pelican's head and of the exit. The slap at u 1.75, once left out for a tap, is back. | The calf still stands behind the pelican's head for 0.4 s at the exit (u 5.25 to 5.65): lifted clear of the head, it would stand on the red cow beside it. The white head reads in front of it. |
| 02 egypt | Date line 24 → 27 px. The yoke pole is red-brown. | Lifting the yoke put the pole across the bearer's face, so the second way was taken. |
| 03 han | English line 25 → 28 px; date line 21 → 27 px, upright and heavier, with the rubbing's speckle kept off it. | |
| 04 tang | English and date lines 22 → 27 to 28 px. Still at u 1.95, centred on x 336: the pelican between two ladies, the name whole. | |
| 05 song | The speck hands over to the painted figure while it is still a speck (11 px at most), and its head touch is round. English lines 22 → 27 to 28 px. | |
| 06 qingming | English and date lines 22 → 27 to 29 px. The two men on the cabin roof tip their heads back with the haulers. | Their heads still overlap the lower edge of the arch's timber, exactly as they did before (the tilt adds nothing to it). The checker called that a ruling not met; the director overrules his own wording: the boat is on the near side of the bridge and the men stand in front of the timber, which is how it reads. |
| 07 maya | "MAYA CODEX" 25 → 31 px, in Optima capitals (it was Herculanum); date 24 → 28 px. | |
| 08 mughal | The English date's figures 24 → 31 px in a face with lining figures, and 7 px of air between "Painting" and "c. 1600 CE". | |
| 09 bada | English name 25 → 28 px; the year 15 → 28 px in lining figures. The pouch is one tone darker (at every moment: one wash cannot change tone without a step). | |
| 10 wayang, 12 starry, 17 chat, 18 vapor | Titles measured: all over the rule (28 to 75 px). Nothing changed. | |
| 11 ukiyoe | The umbrella grows out of the hand over 0.08 s and fades away behind the bird over 0.1 s. Title measured: over the rule. | The pilgrim and the farmer still overlap on the strong beat: the only timing that separates them hides the pilgrim's break into a run on the downbeat, which is seen and heard. |
| 16 pixel | The lives count is inside the screen (×02 is seen to become ×03). "1UP" stands whole beside the head (ten art columns left of the token's centre), on a layer under the pelican. "+100" sits one row higher and carries two pixels of plain sky round its ring, so a cloud bar passes behind it without touching it. Title over the rule. | |
| 19 shortvideo | Title 38/21/21 → 47/28/28 px. The heart is on the body. Still at u 3.95. Scrims come in with the bars. Tabs 关注 / 精选 / 附近, sound line 声音 · 车铃与链条, an amber follow tab. Counts shadowed. The bar pulses once on u = 6.0. | |
| 20 code | The entry outline is brighter for the first second and a half. `</svg>` is in place when it completes. The wing's trailing edge is three clean arcs. At rest and in the still the date line ends whole. Title over the rule. | The SVG text's wing (`M36 20q6 3 6 9l-17 2z`) keeps its straight lower edge. The text on screen is a true, complete SVG of the figure in 37 lines, not a transcript of the puppet: writing the scallops into it would lengthen the line and move the times of every line after it, which the soundtrack follows. Accepted by the director. |
| 21 outro, wall | Nameplate 146 units wide with its ink centred both ways. The dissolve of painting 20 runs from 126.3 to 126.75 s, when the painting is small (the first move, to 126.0, was still noticed by the checker). Each flash shows the set in flash light, from the side its sound is panned to, with the chair's and the microphones' shadow thrown on the curtain. The Bada still is centred on x 488, so that its longer inscription has air. | The Tang still: the lines that reach the pelican's neck are its own scarves. |

## Engine and tools

- **`tools/encode.mjs`.** The MP4 of Stage 4 carried no transfer or primaries tag: ffmpeg takes a stream's colour tags from its frames, and a PNG has none. The encoder now tags every frame as what it is (BT.709 primaries, sRGB transfer, BT.709 matrix, limited range), so a colour-managed player shows the light the preview shows. There is a key frame on every bar line. The sound goes through Apple's AAC encoder where ffmpeg has it: measured on this soundtrack against ffmpeg's own at the same bit rate, the error in the 5 ms before the sharpest onsets fell from -66 to -81 dBFS on average (worst case -52 to -65), and the sound still starts on the same sample as the WAV.
- **`tools/verify.mjs`**, new: checks a finished MP4 against the frames and the WAV it was made from (streams, offset of the sound in samples at a film time in every part, a frame of every part against its own source frame and its two neighbours, and frames drawn again against the frame folder). **`tools/export.mjs`**, new: the whole export in one command.
- **`src/main/film.js`.** When one painting covers the whole screen, the gallery wall behind it is no longer drawn. No frame changes (the scenes paint their targets opaque: proved on the whole film, see below); it saves one full-screen pass of the paper shader in about two frames out of three.
- **Preview speed.** Measured again on the machine the film was made on, with other programs running: 40 to 54 frames a second in the intro and Sections 1 to 6, 56 to 60 after that, with or without the change above (no measurable difference) and with or without sound. The time spent drawing a frame is 5 to 12 ms, well inside the 16.7 ms a frame has, so the limit is not in the scenes' own drawing code; it was not found. It does not reach the exported video, and the preview takes its clock from the sound, so picture and sound stay together when frames are dropped.

## The finished file, and what three last checkers said of it

`out/pelican-test.mp4` was exported on 2026-11-18 with `node tools/export.mjs` and passed `tools/verify.mjs`. Every one of its 8220 frames was compared with the film before the polish: 3672 are byte-identical, and every changed stretch belongs to a row of the table above (Sections 10, 12, 13, 14, 17 and 18 did not change by a byte, which also proves the engine change harmless). Three independent checkers then judged the finished file and the repository against the owner's brief, one on the picture, one on the music, the technical direction and the rights, one on sync, each with measurements of its own. All three: accept, with notes.

- **Sync, measured on the MP4 itself by a checker's own tools:** twenty sharp picture events (among them the intro's second line, the Mughal switch, the wayang slap, the scream, the fingers, the oscilloscope's switch and return, "1UP", the window shake, the tape skip, the black bars, the heart, the bar's pulse and the five flashes) change on the frame whose time is the cue's, and their sounds begin between 5.7 ms before and 2.3 ms after that frame's start; 23 bells lie within about 1 ms of their bar lines; the picture frame is at the centre of the screen within 1 ms of every crossing time; the file's sound is at offset 0 against the WAV at 21 places.
- **Corrected after the acceptance, without touching the film:** the preview's control bar gave the section name no room in a narrow window (now it gets a line of its own under 760 px); the README said the key frames were on bar lines (they are every two seconds, at even seconds, and bar lines are at odd ones); it did not record how 60 frames a second was chosen; it pointed to picture-review notes for all sections where twelve have them.
- **Found, and left for the owner to decide:**
  - Section 4, bar 2 (film 25.5 to 27.5 s): at small sizes the pelican is hard to pick out of the ladies' streaming sashes (at full size its white knock-out keeps every line off it). A heavier line for the pelican alone would cure it.
  - Section 5: the pelican is seen large at the entrance, then the camera pulls out to the speck and pushes in again; the brief's sentence reads as if it were found only on the push-in. The entrance through the picture frame is the film's own rule, so the joke is a pull-out and a push-in.
  - The last frame shows painting 20, with its pelican, at the left of the empty press set. A square picture cannot fill a 16:9 screen with room for the subtitle below it, so "the empty set alone" would need a different final framing or a darkened wall.
  - Section 19: the bar's end is hidden by the incoming frame, as before; the pulse on the crossing shows on the half that is still in view.
  - Section 20: the dashed outline of the whole figure is on the canvas from the first frame (the pelican must be there to come through the picture frame), so the drawing is inked over a guide, not built from nothing; and whether it is "the most refined answer in the film" is a judgement on which the checkers did not agree with the brief's hope.
  - "Strong beat" has been read throughout as beats 1 and 3 of the bar (every crossing is on a bar line; most jokes land on beat 3 of bar 2); the fifth flash is on beat 4.
  - The outro's tutti plays each era's lead voice, the strings, a bass and a drum, not every instrument of every section.
  - The repository has no commit and no licence file: both are the owner's to make.

## Left alone

- **Preview speed** (intro about 48 frames a second, Sections 1, 4, 5, 6 and 12 at 51 to 56 on the machine the film was made on): it does not reach the exported video. See "Engine and tools" above.
- **02 egypt**: the bill crossing a colour-only bearer's face during the catch-up (0.4 s at speed); the wings of the pose reading a little like sleeves (the pose is the section's strongest moment).
- **04 tang**: one body template for the attendants, and the sashes bunching at the gust: both true, both in manner, and the gust is the joke.
- **06 qingming**: the simply drawn figures. Redrawing bodies would put the gaze joke at risk.
- **13 scream**: the two far figures (70 px tall, bar 1 only).
- **14 nosferatu**: the front wheel's rim during the first three frames of the fire (the hand-over was tuned twice and is the film's best crossing); the dark lower half; the scorch; the organ's soft entry at the door (the door's latch and creak carry that beat).
- **15 scope**: the hand at the switch (an earlier ruling keeps it dark); the partial beam-speed modulation.
- **17 chat**: the small first beat (the part falls silent with it, and the joke lands at u 3.0 regardless).
- **18 vapor**: "PLAY" over the title window's close box for nine frames; bust 1 under the title window; the man's hair.
- **20 code**: the far foot behind the chainring; the root attributes at column 0. Whether the section is "the most refined answer in the film": it is the most exact (type, geometry, timing, a true SVG); its restraint is kept.
- **00 intro**: the caption's ideographic space after 图一 (correct Chinese typesetting of the owner's space).
- **21 outro**: the fifth flash on beat 4 (it reads as a double burst with the fourth, and the sound is scored to it); painting 20's pelican staying in view at the left of the close-up.
- **The run of Sections 4, 5 and 6**, three ink pictures on tan paper in a row: the shared ink system is the owner's, and each keeps its own brushwork.

## Decisions of the director confirmed by the reviewers

Section 8's silence and whisper; Section 9's outline of the tune; Section 14's events on the beats, with the fire lit one beat before the crossing; Section 17's invented wording and furniture; Section 18's bust positions and dark stone; Section 20's code pane on the right and its glide back to rest.
