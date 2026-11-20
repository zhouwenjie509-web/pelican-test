# Section 16 · 8 位像素游戏 · 8-Bit Pixel Game

| | |
|---|---|
| Date on the title | 20 世纪 80 年代 · 1980s |
| Film time | 95.0 s – 101.0 s |
| Code | `src/scenes/pixel.js` |
| Homage | Side-scrolling platform games for 8-bit home consoles. A form, not a title. The game, its world, sprites, tiles, font, interface and name are all invented; nothing may resemble a real game's characters, blocks, enemies or levels. |

## The idea

A game that never existed: *码头快骑 · PIER PEDALER*. A seaside pier in big
square pixels and a small fixed palette: sky, stepped clouds, a sea of
repeating wave tiles, a lighthouse, bollards, gulls, and a long deck of
planks with one gap in it. A heads-up display along the top.

The pelican is the player's sprite, pedalling in a handful of frames.

**The highlight (bar 2):** it does what sprites do. It jumps the gap in a
clean arc, takes the coin hanging over it at the top of the jump, on the
strong beat, and because that was the hundredth coin, **1UP** pops out and
floats upward while the counter rolls from ×99 to ×00.

## The pixel grid

- One art pixel is **3 world units** (about 9.5 screen pixels). Everything
  in the scene is on this grid: scenery, sprites, text. The grid is fixed in
  the world, with a pixel boundary on the road, y = 700.
- The camera still moves smoothly, so the grid slides smoothly across the
  screen. Edges of art pixels must stay crisp: see "Pixel-exact art" in the
  guide (an indexed buffer, enlarged without smoothing).
- **Palette:** at most 24 colours in the whole scene and at most 4 (one of
  them transparent) in any one sprite or tile. Choose your own; do not copy
  a console's palette table.
- **Tiles** are 16 × 16 art pixels and repeat.
- Internal animation steps at **8 Hz** (`poseHz: 8`); coin spin, waves and
  gulls use the same clock.

## The level

World units; the deck is the road, y = 700. This is a screen, so depth
layers may slide at different rates.

- **Sky** in two flat blues with a dithered band between; **clouds** in
  three sizes, slowest layer.
- **Sea** to the horizon at y ≈ 640, wave tiles animating in two frames;
  a lighthouse on a rock, and a small boat, in a middle layer.
- **Pier:** plank tiles from y = 700 down to about 724, a row of support
  piles below to the water, bollards and a lamp post on the far side, a
  life-ring, a crate.
- **The gap:** x 448 – 520, open water below.
- **The coin:** centred at (500, 480), 8 art pixels across, spinning in
  four frames.
- **Sign:** see Title.

## The sprite

About 45 × 45 art pixels. Draw it properly as pixel art, not as a shrunken
picture: a one-pixel dark outline, white body, an orange bill two or three
pixels deep with a yellow pouch, a single dark pixel for the eye, orange
legs, a red frame, wheels as clean pixel rings with four spokes that step
round. Eight frames for one turn of the pedals, matching the puppet's crank
angle so the legs are in the right place as it passes through both picture
frames. Build
the frames from the puppet's joints at the art resolution (plot the wheels
as true pixel circles, the frame as pixel lines) and tidy them by rule, or
author them by hand as arrays; either way no anti-aliased or half-covered
pixels.

## The jump, bar 2

The pelican's road position is unchanged; the sprite is drawn higher.

| u | |
|---|---|
| 2.5 | Take-off at x ≈ 417 (beat 2). The legs tuck; the pedalling frames stop. |
| **3.0** | Top of the arc, 84 units up, over the middle of the gap. The head meets the coin. Coin vanishes in a four-frame sparkle; `+100` appears; **1UP** appears at the coin and rises 30 units over 0.8 s, blinking between white and green. Coin counter ×99 → ×00, lives ×02 → ×03. |
| 3.5 | Landing at x ≈ 583 (beat 4): one frame of squash, a puff of two dust pixels, pedalling resumes. |

Height is `84 · 4 s (1 − s)` with `s = (u − 2.5)`, rounded to art pixels.
Outside 2.5 – 3.5 the sprite sits on the deck.

## Heads-up display

Travels with the pelican (laid out relative to `f.pelican.x`, at the top of
the view, y ≈ 446 – 470), in an 8-pixel font of your own:

- left: `SCORE 016000` (016100 after the coin)
- middle: a coin icon and `×99` (then `×00`)
- right: `STAGE 16` and a pelican-head icon with `×02` (then `×03`)

## Title

A wooden sign on two posts beside the pier, fixed in the world at about
**x 150 – 440, y 452 – 560**:

- 8位像素游戏 in a 12- or 13-pixel bitmap Chinese face. Render the
  characters small with a system font and threshold them, or try the
  `GB18030 Bitmap` family; every character must still be legible, so check
  at full size and adjust by hand if a stroke closes up.
- `8-BIT PIXEL GAME` in your 8-pixel font.
- `1980s · 20世纪80年代`.

Light letters on a dark board, one pixel of highlight.

## Gallery still

`still: { u: 3.05 }`: the top of the jump, with 1UP.

## How to build it

- Keep the scene as indexed pixel layers (tiles blitted into a buffer of
  palette indices), convert through the palette to a small RGBA image, and
  enlarge it with crisp edges through `f.view`.
- Scenery layers can be baked once per layer; the sprite, coin, 1UP and
  HUD are composed per frame at the art resolution.
- Stepped clocks come from `stepTime`; the camera and the sprite's
  horizontal position stay smooth.

## Sound cues (for Stage 4)

| u | Event |
|---|---|
| 2.5 | Jump |
| 3.0 | Coin, and 1UP (strong beat) |
| 3.5 | Landing |

## Check on the contact sheet

- Every edge in the picture lies on the 3-unit grid; pixels are square and
  sharp at both zoom levels, with no blur and no shimmer.
- Colours: count them. No more than 24, and no gradients.
- The sprite is good pixel art and reads as a pelican on a bicycle.
- Jump: on the deck at u = 2.5 and 3.5, highest at 3.0, clear of the gap.
- At u = 3.0: coin gone, 1UP present, counters changed. Not a frame before.
- Nothing recalls a real game.
- Title legible, three parts.

## As built

- **Rendering.** Every layer is a palette-index image at art resolution (one
  art pixel = 3 units, row boundary on y = 700), uploaded once as a small
  texture. One fragment shader composites all ten layers per frame,
  fetching texels exactly and blending each texel edge over exactly one
  target pixel, so pixels stay square and sharp while the camera slides by
  sub-pixel amounts (no blur, no shimmer) at any zoom or render size.
- **Layers** (back to front): sky + clouds (depth 0.06); sea + far land
  (0.5, two wave frames, nametable row aligned to the horizon, row −20 =
  y 640); lighthouse rock and tower as two sprite layers on the same plane
  (0.5); the boat on a small layer of its own on that plane, sailing so that
  it stays behind and left of the rider; pier (1); the 1UP on a layer of its own on the world grid, under the
  sprite; pelican sprite and HUD (both ride with the pelican's road x); actors
  per frame on the world grid (token, sparks, +100, gulls, dust, and the
  life-ring), over the sprite. Actors draw under the HUD.
- **Nothing in the rider's plane can merge with it.** There is no lamp post.
  The life-ring hangs on the face of a pile below the deck (x ≈ 741,
  y 730–760), drawn as a sprite of its own. The deck is bare for the whole
  painting: no crate, no bollards, nothing between y 560 and 705 but the
  rider.
- **Clouds** are single long flat bars (two rows: white over a shaded
  underside, ends clipped), five of them, never stacked or stepped, all below
  row −68 and all at sky columns ≤ −27, so while the token is in view (pel.x
  240–500) none comes within 100 units of it, under or beside.
- **Palette** 20 colours + transparent (19 in use). Pier and sky 16 × 16
  tiles hold at most 4 (counting transparent); the sea does with its
  nametable aligned to the horizon; every 8 × 8 tile of every sprite layer
  holds at most 3 plus transparent (`dev/experiments/pixel-tiles.js`). The
  composited frame contains edge-blend pixels besides the palette colours.
- **Sprite.** White body (folded wing as a one-pixel grey contour), a
  one-pixel eye. Crank cluster drawn by rule so legs and pedals separate:
  one near leg, a two-pixel orange thigh and shin with a black outline all
  round (also where it crosses the red tubes), a foot, and one pedal under
  the sole: a dark 5 × 3 block whose top edge is three light-grey pixels; the far leg is a single
  darker brown stub (its shin), unoutlined; no far crank or far pedal.
  Rasterised from the rig at art resolution, one frame per 1/8 pedal turn
  (crank multiples of 45°), all ten frames baked in `init`. Air frame:
  pedals level, neck stretched, wheels frozen. Squash frame at
  u 3.5–3.625: the bird (not the bicycle or legs) is pressed 3 art pixels
  towards the hip and widened by about 12 %.
- **Title board.** x 81–330 (250 wide: in full view u ≈ 0.16–2.30, 2.14 s
  at zoom 1.1), y 466–562, i.e. raised so that 2–3 art pixels of clear sky
  show between it and the pelican's head; it hangs on two chains (rings and
  edge-on links in the board's outline colour) from the top of the picture,
  passing behind the HUD (broken off at each glyph). No posts, no nails. Lines: 8位像素游戏 (12-px
  bitmap Chinese, an own 12-row 8); `8-BIT PIXEL GAME` and the digits of
  the date in an own 5-row sign font with 3-wide digits (the 8 has a full
  waist bar); date `1980s·20世纪80年代` with a small s (one row short of
  the capitals) and 9-px bitmap Chinese.
- **Bar 2.** The collectable is a round 10-pixel gold token stamped with a
  brown fish, turning face / narrow / edge / plain back at 8 Hz, centred
  (501, 481). Gap x 456–528 (on the grid; 8 units right of the brief so the
  front tyre is still on the lip at take-off and the rear tyre lands well
  onto the deck). At u 3.0 the token goes; a ring of sparks shows for two
  8-Hz frames (3.0–3.25) and ends on nothing; 1UP appears at the token's
  spot, ten art columns left of its centre so that the word stands whole
  beside the head (at the apex the head is on the token's spot), and rises
  straight up one row per 8-Hz frame for two frames (6 units), then holds
  just under the HUD row until 4.0, blinking white/green; it is on a layer
  under the sprite, so the pelican is always drawn over it (the sparks stay
  over the bird but never over a 1UP cell). +100 shows below-left until 3.75, its top on row -65 (y 505), so no
  cloud bar lies level with or next to the arms of its "+".
- **HUD** (7-row font of our own, white letters; × is its own 5 × 5 glyph).
  It is the last layer, over everything. Each letter's own cell is laid in
  the sky colour and ringed outside by one dark pixel, so the sign's chains,
  gulls and sparks pass behind it and never through a glyph: `SCORE 016000`, a token icon with a fish and
  `×99`, `PIER 16`, a pelican-head icon and `×02`; the right-hand group
  (`PIER 16`, icon, lives) ends with its ring on column 98 from the pelican,
  i.e. at +297 units, 6 units inside the view's edge at zoom 1.1. The gallery still uses a
  compact centred HUD (score, tokens, lives).
- **Gallery still** (u 3.05) uses its own framing: world y 436–736 fills
  the square, centred on the rider, so the take-off lip, the gap, the
  landing lip, the arc with 1UP and +100 fill it and the board is wholly
  out.
- **Glyphs.** 位像素游戏 from the 12-px strike, 世纪年代 from the 9-px strike
  of the system's GB18030 Bitmap face, hard-coded as bitmaps (no font at
  run time); the 7-row (HUD) and 5-row (sign) Latin fonts are our own.
- **Left as is.** The HUD travels with the pelican, so fragments of it show
  inside this picture beside the neighbours while the pelican is still in
  Section 15 or already in Section 17 (judged acceptable).

### Stage 5

- HUD: the right-hand group moved 6 art pixels left (gap after `×99` 8 → 4,
  `PIER 16` to icon 4 → 2, icon to lives unchanged), so `×02`/`×03` is wholly
  on screen at zoom 1.1; the score and token groups are where they were.
- 1UP moved to its own layer under the sprite (ten layers now), so it no
  longer covers the crown and eye on the beat or in the still; and, by the
  director after the fix round, ten art columns to the left (`UP_LEFT`),
  because under the sprite its P was hidden behind the head on the beat and
  in the still: the word is now whole beside the head from the first frame.
- +100 one row higher (rows -65..-59), clear of the cloud bar that ran into
  its "+".
- Title measured at zoom 1.1 (96.0 s): 8位像素游戏 114 px, `8-BIT` capitals
  48 px, date digits 48 px: unchanged.
