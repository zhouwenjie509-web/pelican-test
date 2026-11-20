# Section 19 · 竖屏短视频 · Vertical Short-Form Video

| | |
|---|---|
| Date on the title | 21 世纪 20 年代 · 2020s |
| Film time | 113.0 s – 119.0 s |
| Code | `src/scenes/shortvideo.js` |
| Homage | A format, not a work. **Everything is invented:** the app, its name, layout, icons, typography, account names and sounds. No real product's interface, logo, mascot or wording is used or imitated. |

## The idea

A bright city street in flat vector colour: bike lane, shopfronts, hire
bikes, a bus shelter. The pelican rides through it exactly as it rode through
the rock shelter and the silk. Someone on the pavement lifts a phone.

**The joke (bar 2):** on the downbeat the picture slams to 9:16 with black
bars either side, and the film is now somebody's upload. An app's interface
sits around the pelican; likes and comments float up; a progress bar starts.
The bar runs out at the exact moment the pelican passes through the next
frame. Sixty centuries of pictures, and this one lasts four seconds and is
already scrolling away.

## Materials

- **Street.** Flat fills, no outlines except on the pelican, a small fixed
  palette: teal lane `#2d9d8d`, warm pavement, eight pastel facades, two
  greens for trees. Sky is a screen-fixed gradient.
- **Depth.** Three cached strips sliding at different rates (far towers 0.12,
  buildings 0.5, pavement and lane 1) for a simple parallax.
- **Pelican.** The plain vector skin with a thick white sticker outline, the
  way a cut-out subject looks in this kind of video.
- **Interface.** Drawn on a 2D layer at 1080p pixel scale, white with soft
  shadows, system sans-serif. Translucent pills for comments.

## The street

World units; road at y = 700, section x = 0 … 1000.

- Far: pale towers. Middle: shopfronts with awnings and invented signs
  (鹈记奶茶, 骑行驿站, 修车补胎, 鲜鱼, 打印复印 …).
- Near: pavement, kerb, teal lane with painted bicycle symbols and arrows,
  street trees, lamps, a rack of hire bikes, a bus shelter whose poster
  advertises the film's fictional book.
- Passers-by with phones raised, filming.

## The interface (all fictional)

- Status bar: a clock reading 12:07, signal, battery.
- Tabs: 关注 / **精选** / 附近, a search glyph. (Invented words since Stage 5: the first choice, 关注 / 推荐 / 同城, is one real app's own.)
- Right rail: round avatar with a plus, heart with a rising count, comment
  bubble with a count, share arrow with a count.
- Caption block, lower left, which is also this section's **title card**:
  `@鹈鹕骑行日记` · **竖屏短视频** · Vertical Short-Form Video ·
  `#21世纪20年代  #2020s`. A sound line with moving bars: 声音 · 车铃与链条 (it began 原声 before Stage 5).
- Comments rise in a column at the lower left, one every beat or so, and
  fade as they climb. They react to the pelican in a flat, ordinary voice.
- Small hearts drift up from the like button; one large heart pops on the
  pelican at the double-tap.
- Progress bar along the bottom: empty at the start of bar 2, full at u = 6.

## The three bars

1. **Entrance.** Full-width street. Nothing unusual yet except a phone
   going up on the pavement.
2. **The joke.** Downbeat: black bars slam in with a slight overshoot; the
   interface appears; the picture takes on a hand-held tremble. Count ticks
   up. Double-tap heart on beat 3.
3. **Exit.** Still vertical. The tremble settles before the frame so the
   crossing is clean. Progress bar reaches the end on the crossing beat.

## How it is built

- Three street strips baked once on 2D canvases (3.3 px per unit).
- Per frame: sky, strips, pelican, then bars and interface on one 2D layer.
- All interface motion is a function of `u` (section time): comment `i`
  appears at a fixed time, hearts follow closed-form paths, counts are
  computed, never accumulated.
- The interface as it now stands: tabs 关注 / **精选** / 附近; the avatar's
  follow mark is a small amber rounded tab with a dark plus; the sound line
  reads 声音 · 车铃与链条. The top and bottom scrims fade in only as the black
  bars finish closing (smoothstep 0.9 to 1 of the bars' slam, fully in by
  u ≈ 2.09), so no seam shows over the street. The rail's counts carry a
  denser soft shadow (rgba(0,0,0,0.6), blur 7, drawn twice) than the icons.
- Caption (title card), 1080p pixels of the 9:16 picture: @ line 29 px at
  baseline 842 (unchanged); 竖屏短视频 PingFang 52/800 at 899; English
  Helvetica Neue 38/500 at 940; dates 37/500 at 978; sound line 22 at 1010.
  Measured at zoom 1.1: Chinese name 47 px, capitals and digits 27 to 28 px.
- The double-tap heart (u 3.0 to 3.9) is centred on the body and wing
  (picture x VW/2 − 40, y 612), so head and bill stay clear.
- The progress bar: on u = 6.0 exactly (never before) the full bar pulses
  once: 3 px thicker, knob 3 px larger, a white glow; it holds 0.05 s and
  settles by u 6.25.
- Gallery still at u 3.95: heart gone, head, bill and front wheel clear,
  title block whole.

## Stage 5

Title block enlarged to the rule (Chinese name 40 → 47 px, Latin capitals
and digits 21 → 27 to 28 px), growing downward only. Double-tap heart moved
from the head to the body. Still moved from u 3.6 to 3.95. Scrims now come
in with the bars. Tab words, sound line and the follow mark changed so the
interface is nobody's. Rail counts given a denser shadow. The progress bar
pulses once on the crossing.

## Check on the contact sheet

- Before bar 2 there is no interface at all; from its downbeat the bars are
  in within a fifth of a second.
- The visible picture between the bars is 9:16.
- Title readable at 1080p inside the caption block.
- Nothing resembles a real app: no real logo, glyph set, colour identity,
  account, or sound name.
- Progress bar is full on the frame where the pelican crosses (119.0 s),
  not before and not after.
- The pelican stays the subject: comments and hearts may pass over it but
  never cover its head for more than a beat.
