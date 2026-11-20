# Verification of Section 17 (chat)

An independent verifier reviewed the finished scene from rendered frames. Their findings follow. The director has read them and added rulings; where a ruling differs from the art brief or from a suggested fix, the ruling wins.

## Verdict

Section 17 is ready to show. Every timed event is on its beat, the title passes (Chinese 47 px, capitals and digits 31 px, whole for about 3.7 s), coverage is complete at u = -1.5, 5.75 and 7.5, the crossings line up, the GIF steps cleanly at 10 Hz, and purity and speed pass. The most important fix is rights: the window chrome is close to Windows 2000 classic, and the button wording, shake feature and system message are recognisably QQ's. It needs an invented caption-button design and reworded labels, with the owner deciding on the brief-mandated phrases.

## The director's rulings

1. **The interface must be nobody's.** The features stay (the owner's brief asks for the typing notice at the top and a window shake on the strong beat), but their look and wording must be invented. Redraw the desktop's furniture as one invented kit:
   - every button has cut corners (an octagon): the three caption buttons, the scroll buttons, the push buttons, the task buttons and the menu button. Caption glyphs of your own (for example a low bar, a small diamond, a fish-tail cross), not the bar, box and cross of a real system;
   - the face colour is a sage grey-green (about `#c9d3c5`, with a light edge `#f2f6ee` and a dark edge `#8fa08c`), not the grey-beige of a real system; the scroll thumb carries three dots;
   - the toolbar's icons are your own drawings (for example a quill, a fish, a small picture, a paper boat): no letter A with a red underline, no round yellow face.
   Reword everything that is a real product's phrase. The system line under the GIF becomes `对方晃了晃您的窗口。`; the buttons become `发出(F)` and `收起(Q)`; on the desktop `回收站` becomes `垃圾桶` and `新建文件夹 (3)` becomes `杂物 (3)`. Keep `对方正在输入…` (the owner's brief gives it), `大嘴信使 2003`, `鱼.txt`, `自行车.bmp` and `菜单`.
2. **The first beat must be seen.** While the notice is on, it is alive: a small pencil that scribbles (two or three pixels of movement, four times a second) and dots that cycle, in dark type, not grey on grey. At u = 2.0 the pencil stops dead and the strip clears; at 2.5 it starts again; the same at 3.0 and 3.5. No explanatory text.
3. **The GIF is one picture.** Give the pelican's shaded side (belly, the underside of the wing, the underside of the pouch, the far leg) a shadow tone laid with the same 4 x 4 ordered dither as the sky, so that bird and background share one texture. Outlines stay one hard pixel. It must still read at a glance.
4. `？` is the full-width mark: a 12-unit cell with the mark centred, as wide as a Chinese character.
5. Left as they are: the one-pixel blend at texel edges (it is what keeps the window from shimmering as it glides), the white space in the history.
6. Keep everything the verifier confirmed: every event time, the title sizes, the still, the 10 Hz GIF, purity, the crossings, the speed. After the redraw, read every character again at full size.

## Findings

### [should-fix] Rights: window chrome and wording sit very close to Windows classic and to QQ

Evidence: Chrome: the button face is (211,205,193), close to the Win2000 classic (212,208,200). The minimize/maximize/close boxes, the 3D bevels and the scrollbar arrows are the classic Windows glyphs. Desktop wording '回收站' and '新建文件夹 (3)' is Chinese Windows' own. Messenger side: the toolbar of A-with-red-underline, smiley and picture; the buttons '发送(S)' and '关闭(C)'; the window-shake feature and the line '对方给您发送了一个窗口抖动。' are all QQ's wording. Much of this is mandated by the brief, but guide 4.4 says nothing may resemble a real interface.

Suggested fix: Move the chrome off Windows: draw the caption buttons in an invented shape (e.g. rounded pills, or a fish-tail close glyph) and shift the face grey toward a warmer or greener tone. Reword the buttons (e.g. '送出(S)' / '收起(C)'). Rename the system line (e.g. '对方晃了晃您的窗口。'). Reorder or redraw the toolbar icons. Ask the owner whether 回收站 and 新建文件夹 may stay.

### [should-fix] GIF pelican looks like a downsampled vector cartoon, not a period GIF sprite

Evidence: At 104.02 and in the still, the subject is the plain rig point-sampled with clean flat fills, smooth outlines and a grey scalloped wing blob. It has no dither and no palette banding, while the sky and hills are heavily dithered. It reads as a modern flat illustration pasted onto a dithered background rather than a 256-colour animated GIF of 2003.

Suggested fix: Apply the same 216-colour Bayer dither to the pelican's shading bands (pouch, wing, neck shadow) and give the outlines a hand-pixelled stair-step. Alternatively, draw the pelican at a smaller GIF resolution (e.g. half) and pixel-double it, as period GIFs were.

### [should-fix] The first joke beat (u = 2.0) is easy to miss

Evidence: At u 2.02 to 2.48 the only change is that the small grey-on-grey text '对方正在输入…' disappears from the status strip at the top of the window, about 600 px above the pelican, where the viewer is looking. Nothing else in the frame marks the held breath.

Suggested fix: Make the moment more visible without explanatory text. For example, freeze the dots on '…' for a beat before they vanish, also hide the pencil glyph, or have the title bar show a matching '正在输入…' that also stops, so the change happens nearer the eye line.

### [minor] One-screen-pixel blend at every texel edge (half-covered pixels)

Evidence: 103.8, column 600, rows 44 to 58: white glyph pixels sit next to blended (181,204,204) and (215,227,227) pixels. The title-bar border rows hold (127,163,152) and (96,147,137). The scale is 3.17 px per unit, so every unit edge gets an intermediate pixel. It reads crisp at 1080p and shows no shimmer between frames (0 changed px in the window over five 1/60 s steps), but it is technically smoothing.

Suggested fix: Acceptable as sharp-bilinear. If strict exactness is wanted, snap the window origin to whole screen pixels and accept 3/4 px column widths. Otherwise keep it and document it as the chosen trade-off.

### [minor] '？' renders as a small half-width question mark

Evidence: u 4.02 and 106.75: the input box shows '?' about 10 px wide with the caret right after it. A full-width ？ in 12-px Song would be as wide as a Chinese character.

Suggested fix: Draw the full-width glyph: a 12-unit cell with the mark centred.

### [minor] Large empty white areas in the history pane

Evidence: 103.5 and 104.02: about 130 units of blank white left of the GIF and about 110 units right of it, plus a bare scroll track, for the whole section.

Suggested fix: Add small period detail that does not scroll, e.g. a faint '以下是新消息' divider or the GIF's dashed selection outline. Or accept it as deadpan emptiness.

## Items of the brief's checklist that failed

None. Every item of the "Check on the contact sheet" list passed.

## Measured before the fixes

- Purity: node tools/check.mjs --purity --section 17: "All 20 checks passed", including "PASS frames are a pure function of time (14 frames, two browsers, different orders) (byte-identical)", "PASS pelican is on the boundary at every crossing (worst error 0.00e+0 units)" and "PASS roads are level and meet at every picture frame".
- Speed: node tools/perf.mjs --section 17: entry 100.4-102.9 s 59.8 fps, draw mean 2.0 ms, p99 9.9 ms, worst 11.8 ms (slowest gap 36 ms); middle 102.9-105.1 s 59.9 fps, mean 2.0 ms, p99 12.1 ms, worst 16.0 ms (slowest gap 33 ms); exit 105.1-107.6 s 60.0 fps, mean 6.6 ms, p99 8.9 ms, worst 8.9 ms (slowest gap 21 ms).
- Not looked at: I did not render the exact frame before the shake (u = 2.983); the latest I saw without the system line was u = 2.95. I did not compare the crank and leg pose frame by frame between Section 16's pelican and the GIF pelican at the crossings (the frame hides the legs at u = 0), and did not check whether the two scenes' different pose stepping disagrees for a frame. I did not open the half-size still. I did not read chat.js beyond what the tools needed. 'Nothing pops at u = 0 / 6' was judged from three frames on each side, not a frame-by-frame run. The live-square tool (--still 17 --u 3.0) draws the 500-unit film layout offset in the square (window cut at the left). As far as I can tell from src/main/film.js, only the dev tool uses this path, not the gallery, so I did not treat it as a defect.

## Second round (after the re-check)

The re-check found every event on its time and the kit redrawn as ruled, with two things left that still recall a real system. The director's rulings for the second round:

1. **The close button is not a cross.** Draw a small fish seen from the side (a body and a forked tail), about 7 by 7 pixels, in the button's glyph colour. It reads as "close" by its place alone.
2. **The scroll track is plain:** one flat tone a step darker than the face (about `#b4c0b0`) with a one-pixel shadow along its left and top edges. No checker pattern.
3. **The Q of `收起(Q)`** must read as a Q at full size: give it a clear two-pixel tail below and to the right of the bowl, clear of the underline.
4. Everything else stays exactly as it is.
