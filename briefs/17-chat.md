# Section 17 · 早期聊天窗口 · Early Chat Window

| | |
|---|---|
| Date on the title | 21 世纪 00 年代 · 2000s |
| Film time | 101.0 s – 107.0 s |
| Code | `src/scenes/chat.js` |
| Homage | Desktop instant-messaging programs of the early 2000s. A kind of interface, not a product. The program, its name, icons, layout, colours, wording, nicknames and desktop are all invented; nothing may resemble a real messenger's or a real system's logo, mascot, colour scheme, sounds, wallpaper or window. |

## The idea

A computer desktop around 2003, seen close: small bitmap type, bevelled grey
buttons, a coloured title bar. A chat window is open, and someone has just
sent a picture: an animated GIF of a pelican riding a bicycle. It has all the
marks of its kind: ten frames a second, 256 colours, sky gradients broken into
dither patterns.

The film's pelican *is* that GIF. The window travels with it across the
desktop, as if someone were dragging it.

**The joke (bar 2):** at the top of the window it says 对方正在输入…, "the
other person is typing". On the first strong beat it stops, as if a message
were coming. Nothing comes; it starts again. On the second strong beat the
other person, instead of saying anything, sends a **window shake**, and the
whole window rattles in time. Then: 对方正在输入… again, to the end.

## Scale

**One interface pixel is one world unit** (about three screen pixels), so the
bitmap type and the dither are plainly visible. Everything in the window and
on the desktop lies on that grid and is drawn without smoothing (see
"Pixel-exact art" in the guide).

## The window

Laid out relative to the pelican's road point, `px = f.pelican.x`, as section
5 of the guide describes. 500 × 316 units: x from px − 250 to px + 250, y from
444 to 760. (The view is px ± 303 wide and shows y 439 to 780 when zoomed in.)

| Part | y | What |
|---|---|---|
| Title bar | 444 – 466 | A gradient in an invented colour scheme (for example dark teal to sea green; not the blue of any real system), an invented program icon (a speech bubble with a beak), the title text, three small buttons |
| Status strip | 466 – 484 | The contact's small square picture and nickname at the left; **对方正在输入…** starting at px − 110, in line with the GIF's left edge, with three dots that cycle twice a second |
| History | 486 – 724 | White. Four lines of text (y 490 – 548), the GIF (y 550 – 708), and room for exactly one more line under it (y 710 – 722) |
| Input and buttons | 728 – 758 | A text box with a blinking caret; `发送(S)` and `关闭(C)`; a small button with a shaking-window glyph. Arrange them as you judge best in this band |

- **The history never scrolls.** The GIF cannot move (the pelican's road is
  inside it), so nothing is added above it and only one line is ever added
  below it.
- **Program:** 大嘴信使 2003 (invented).
- **Contact:** an invented nickname in the decorated style of the time, for
  example `╰☆骑着单车去流浪☆╮`.
- **Type:** 12-unit bitmap Chinese for the body (Songti SC rendered small and
  thresholded, or `GB18030 Bitmap`), black and dark blue on white, no
  anti-aliasing. Check at full size that every character is legible.
- **History text**, there from the start:

  ```
  ╰☆骑着单车去流浪☆╮ 21:07:02
    在吗
  ╰☆骑着单车去流浪☆╮ 21:07:15
    给你看个东西
  ```

  followed by the GIF.
- **What the picture frames do.** They cut the window as the pelican passes
  through them: the window is whole only from u ≈ 1.6 to u ≈ 4.4. Before
  that its left end is still behind the frame; after that its right end has
  gone. That is why the typing notice starts at px − 110 (in view from
  u ≈ 0.8) and why everything that happens in bar 2 is near the middle.

## The GIF

A picture 220 × 158 units inside the history, from (px − 110, 550) to
(px + 110, 708), with a one-pixel grey border. Inside it:

- a sky gradient, a green hill line, a pale road with its edge at y = 700,
  and the pelican in flat colours;
- reduced to a fixed palette of at most 256 colours with an **ordered
  dither** (a 4 × 4 Bayer matrix), so the sky breaks into visible bands of
  pattern. The dither pattern is fixed to the GIF's own pixels;
- updated only **ten times a second** (`poseHz: 10`, and the background's
  scroll steps on the same clock). Nothing inside the GIF moves between
  those steps.

The pelican's road point is the centre of the GIF. Its dithered, stepped
picture is this section's skin. Inside the GIF nothing but sky, hill and road
lies behind the pelican: keep its path clear.

## The desktop

Fixed in the world, scrolling past behind the window: an invented wallpaper
(a quiet tiled pattern, small fish or waves, in two close tones of dusty
blue; not the flat teal or the green hill of real systems); a column of
32-unit icons with labels near the left and right ends of the painting
(`鱼.txt`, `新建文件夹 (3)`, `自行车.bmp`, `回收站`, all invented drawings);
a taskbar along the bottom from y = 762 to the bottom of the painting, with
an invented menu button (`菜单` and a small fish) at its left end, a clock
reading 21:07 at its right end, and one task button for the chat window at
x 430 – 590, where it is in view during bar 2. Keep the taskbar's text and
buttons between y 764 and 778 (the view ends at y = 780 when zoomed in). No
real system's logo, button, wording or wallpaper.

## Events

| u | |
|---|---|
| 0 – 2 | The window arrives with the pelican. 对方正在输入… |
| **2.0** | The typing notice goes out. The strip is blank for half a second. Nothing arrives. |
| 2.5 | 对方正在输入… again. |
| **3.0** | The notice goes out and a grey system line appears under the GIF: `对方给您发送了一个窗口抖动。` The window shakes for half a second: jumps of up to 6 units in alternating directions, twenty times a second, dying away. The task button on the taskbar flashes orange. The pelican shakes with its window. |
| 3.5 | 对方正在输入… again. |
| **4.0** | We type `？` into the input box. It stays there, unsent, with the caret after it. |
| 4.0 – 8 | 对方正在输入… Nothing more arrives. |

The window's position follows the pelican exactly except during the shake.
The pelican keeps the standard pace. No camera move.

## Title

The window's title bar, in white bitmap type:

`早期聊天窗口 - Early Chat Window (21 世纪 00 年代 · 2000s)`

Measured on screen, not by font size: the Chinese characters at least 14
units tall (44 px), the capital letters and digits at least 9 units tall
(26 px). It should just fit beside the icon and the three buttons; if it does
not, put the date at the right end of the status strip in the same sizes. It
travels with the window and is whole from u ≈ 1.6 to u ≈ 4.4 or later.

## Gallery still

`still: { u: 3.6 }`: the window with the shake line under the GIF. The still
is a square px ± 176 wide, narrower than the window, so when `f.still` is set
draw a narrower window (about 340 units) laid out for it: the whole title
bar, the typing notice, the GIF and the shake line inside the square.

## How to build it

- Draw the window's fixed furniture once at one pixel per unit and enlarge
  it crisply; draw text lines as they stand at `f.u`.
- The GIF: render its 220 × 158 picture per GIF frame (ten a second),
  quantise and dither it on the CPU, and cache it by frame number.
- The desktop is a baked layer.
- Shake offsets come from a table indexed by `floor((u − 3) · 20)`.

## Sound cues (for Stage 4)

| u | Event |
|---|---|
| 2.0 | The typing stops: a held breath |
| 3.0 | Window shake: a rattle of (original) blips on the strong beat |
| 4.0 | Our `？`: one soft key click |

## Check on the contact sheet

- Reads as an early-2000s desktop program: bitmap type, bevels, a coloured
  title bar; and as nobody's product in particular.
- 对方正在输入… is in the strip at u = 1, 2.8, 3.8 and 5.5, and is absent at
  u = 2.2 and 3.2.
- The GIF shows dither patterns clearly and steps ten times a second while
  the window itself glides.
- The shake starts at u = 3.0 and is over by 3.5; the shake line is under
  the GIF from u = 3.0 and not a frame before.
- `？` is in the input box from u = 4.0.
- All type is legible at full size and has hard pixel edges.
- Title in the title bar, three parts, at the sizes above.

## As built

- **Rendering.** Three CPU pixel buffers at one pixel per unit, composited by
  one shader (`chat/composite`) that samples texel by texel with a one-pixel
  edge blend (kept by ruling: it stops the gliding window from shimmering):
  the desktop (world-anchored, baked twice: task button pressed / orange),
  the window (anchored at `f.pelican.x − 250`, or `− 170` with `f.still`;
  cached per state), the GIF (anchored at `f.pelican.x − 110`, cached per
  pose tick), plus an 11 × 15 pointer on the title bar that drags the window
  and does not shake.
- **The invented kit (after verification, ruling 1).** Face sage grey-green
  `#c9d3c5`, light edge `#f2f6ee`, shadow edge `#8fa08c`, outline `#3f4c3d`.
  Every button is an octagon (corners cut on the diagonal, 3 units on
  buttons 13+ tall, 2 below) with a one-pixel dark outline, a light edge on
  its upper-left half and a shadow edge on its lower-right half: the three
  caption buttons, the scroll buttons and thumb, the shake/收起/发出 buttons
  (发出 is the default and wears a second outline), the menu button and the
  task buttons (pressed = edges swapped; flashing = orange octagon). The
  window's own outline is the same octagon (corners cut 4) and the title-bar
  gradient follows its cut. Caption glyphs: a low tray, a filled diamond, and
  for close a 7 × 7 fish seen from the side (facing left, an eye, a forked
  tail; second-round ruling 1). Scroll buttons carry open chevrons; the thumb
  carries three dots. The scroll track is plain (second-round ruling 2): flat
  `#b4c0b0` with a one-pixel `#8fa08c` shadow down its left edge and along
  its top edge just under the up button; no checker. Panes and fields are square wells with a dark rim and an inner
  shadow line. Toolbar: a quill, an orange fish, a small picture, a paper
  boat (all drawn here).
- **Wording.** Buttons `收起(Q)` and `发出(F)` (accelerator underlined); system
  line `对方晃了晃您的窗口。`; desktop labels `鱼.txt`, `杂物 (3)` (one line),
  `大嘴信使`, `自行车.bmp`, `垃圾桶`. Kept: `对方正在输入…`, `大嘴信使 2003`, `菜单`.
- **Type.** Chinese is `GB18030 Bitmap` (true bitmaps at 12 and 16 px, alpha
  thresholded). That font has no Latin or symbol bitmaps, so digits, letters
  (now including F and Q; Q's bowl is one row short of the capitals with a
  two-pixel tail hooked out to the right on the baseline, leaving a clear row
  above the accelerator underline, second-round ruling 3), `╰ ☆ ╮ ？ 。 …` (12 px) and the title's Latin
  (16-px line, capitals 10 rows) are hand-drawn glyph tables in the scene.
  `？` is full width: an 8 × 10 mark centred in a 12-unit cell, the caret
  after the cell. Title Chinese measures 15 units (47.6 px at zoom 1.1),
  capitals and digits 10 units (31.7 px).
- **Title.** Whole in the title bar in the film. In the still (340-unit
  window) the title bar holds `早期聊天窗口 - Early Chat Window` and the date
  sits at the right end of the status strip at the same size; the nickname is
  dropped there (avatar only).
- **Typing notice (ruling 2).** Dark ink (`#141414`), not grey. While it is
  on, the pencil before it jigs four times a second through offsets
  `(0,0) (−2,1) (1,−1) (−1,1)` and the dots cycle `1 2 3 3` per eighth of a
  second. At 2.0 and 3.0 pencil, words and dots vanish together (the pencil
  stops dead with the strip); they return at 2.5 and 3.5.
- **GIF.** 216-colour web palette, 4 × 4 Bayer dither on sky, sun halo, hills
  and road; background loops every 10 frames (road 17 units a frame, near
  hills 8.5, far hills fixed). Pelican: plain rig drawn at 4× and
  point-sampled at pixel centres, snapped to web colours; outlines stay one
  hard pixel. Shaded side (ruling 3): each flat colour gets a shadow tone laid
  with the same Bayer matrix as the sky, fixed to the GIF's pixels, densest
  at the lower edge of its patch and thinning upward (white → `#ccccff` over
  10 px for belly, neck and head; wing `#cccccc` → `#9999cc` over 7; pouch
  `#ffcc66` → `#ff9933` over 5; near leg 3, bill and frame 2). The far leg
  and foot sit in an even 50 % dither of a darker tone. Two rows of
  hand-pixelled scalloped covert feathers on the wing, anchored to the
  shoulder; spokes are one-pixel Bresenham lines.
- **Program icon.** A pale sea-green speech bubble with lines of "words",
  whose mouth is a pelican's bill and pouch: 16 px on the title bar, taskbar
  and tray; redrawn at 32 px for the desktop icon.
- **Events (u).** Notice out 2.0–2.5 and 3.0–3.5; shake line from 3.0; shake
  3.0–3.5, table `dx −6 6 −5 5 −4 4 −3 2 −2 1`, `dy 2 −2 −3 3 2 −2 1 −1 1 0`,
  stepped at 20 Hz; task button orange on alternate eighths of a second
  3.0–4.0; `？` from 4.0; caret blinks on the first half of every second.
- **Additions not in the brief.** Pencil glyph before the notice, the flat
  toolbar at the right of the status strip, a scrollbar parked at the
  bottom, a third left-column icon (`大嘴信使`), an editor task button
  (`鱼.txt - 小本子`), a tray with the clock.
- **Left by ruling.** The white space in the history pane.
