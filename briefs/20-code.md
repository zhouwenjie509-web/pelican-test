# Section 20 · 代码美学 · Code Aesthetics

| | |
|---|---|
| Date on the title | 21 世纪 20 年代 · 大模型时代 · 2020s, the LLM era |
| Film time | 119.0 s – 125.0 s; the painting then stays on screen without the pelican until about 126.4 s |
| Code | `src/scenes/code.js` (the editor, the code, the timing) and `src/rig/skins/code.js` (the drawing) |
| Homage | None. This is the present: a code editor and a language model writing SVG. The editor, its theme and its chrome are invented and must not resemble any real product. |

## The idea

The last answer, and the reason for the film's title: asking a language model
to draw a pelican riding a bicycle as SVG code.

A calm, dark editor. On the left, the drawing. On the right, ahead of the
pelican, code arrives the way a model writes it: in small bursts of a few
characters, line after line of SVG. The pelican rides towards its own source.
Every time a line of code is finished, the thing it describes is drawn: a
circle sweeps round into a wheel, a path runs out into the frame, a shape
fills with colour. The pelican is there from the first frame as a
construction outline, pedalling; the code makes it real, part by part.

**The owner's brief says of this section: "This must be the most refined and
meticulously crafted answer in the entire film."** After nineteen sincere
attempts, this one is simply right. Quiet colour, exact geometry, perfect
type, motion eased to the frame. No joke is made of it. The joke is that it
is what all the others were for.

## Design

- **Theme.** Your own. Suggested: background `#0f1218`, panel `#141922`,
  rules `#222a36`; text `#c9d1dc`; tags coral `#ff8f7a`; attribute names
  sand `#e6c07b`; strings sage `#9ccf8a`; numbers amber `#f2a65a`; comments
  slate `#5f6b7c`; a single accent, teal `#3fd0c0`, for the caret and
  highlights.
- **Type.** Menlo or Monaco for code; a clean sans for chrome. Exact
  baseline grid; consistent spacing; no orphaned pixels.
- **The drawing.** Flat, modern vector illustration with a restrained
  palette that belongs with the theme: off-white body `#f4f1ea` with a soft
  cool shade, bill `#f2a23a` shading into a lighter pouch `#f7c66b`, legs
  `#e2783a`, wing tips and tyres charcoal `#2b2f3a`, the bicycle frame in
  the teal accent. Round caps and joins. One consistent outline weight or
  none at all. Subtle gradients, a soft shadow on the ground. Compare it
  with the plain skin and make every shape more considered than that.
- **Motion.** Everything eases. Nothing pops, nothing overshoots.

## Layout

In world units **relative to an anchor `a`**, as section 5 of the guide
describes, and drawn through `f.view`:

```
a = f.pelican.x                                    while u ≤ 6 (it is negative before u = 0)
a = lerp(1000, 805.5, smootherstep(6.0, 6.6, u))   after u = 6
```

So the editor is centred on the pelican for the whole ride. When the pelican
has left through the last frame the editor does not follow it: it glides back
194.5 units and comes to rest (see "After the pelican"). Do not lay anything
out from `f.w` or `f.h`.

The view is a ± 303 wide when zoomed in (u 0.4 to 4.2) and a ± 333 at zoom 1;
it shows y 439 to 780 when zoomed in. The editor must be larger than that:
paint it from a − 440 to a + 360 and from y 410 to 810.

| Part | Where | What |
|---|---|---|
| Top bar | y 410 – 462 (seen: 439 – 462) | Plain. At its right, above the code, the title (see Title). |
| Canvas | x a − 440 … a + 88, y 462 – 760 | The drawing. The pelican's road point is at x = a. |
| Divider | x = a + 88 | A hairline. The bill reaches a + 65: nothing of the code pane may come nearer than this line. |
| Code pane | x a + 88 … a + 360, y 462 – 760 | A tab `pelican.svg`, line numbers, code, caret, current-line highlight |
| Status bar | y 760 – 810 (seen: 760 – 780) | Left: `SVG · UTF-8`, and later the check mark. Right: the date line (see Title). Keep all text between y 763 and 777. |

- **Code type:** Menlo about 8.4 units (27 px), line pitch about 14.5 units.
  Line numbers end by a + 112; code starts at **a + 116**; **no line is
  longer than 35 characters** (176 units), so every line ends by a + 293,
  inside the view. About eighteen lines fit under the tab row; when the code
  outgrows the pane it scrolls up smoothly, one line at a time.
- **Why the code is on the right:** the picture frames cut the editor as the
  pelican passes through them. Coming in, everything ahead of the pelican is
  in view from the first frame and the part behind it is uncovered over the
  first two seconds. Going out, the part ahead is swallowed first (the code
  pane from about u = 4.1) and the part behind stays to the end. So: the
  request and all the writing are seen from the start, on the right; what
  must be seen at the end (the check mark) sits at the left.
- **Canvas:** a fine dot grid every 20 units and a ruler along its top edge
  (y 462 – 474) with ticks and small numbers, both **fixed in the world**,
  so they slide past as the pelican rides and show that it is moving. The
  ground is a hairline at y = 700. Nothing else: the pelican's path
  (y 560 – 705) holds only dots and that line.

## The code

Write real, well-formed SVG that would draw this pelican, in order, each
line no longer than 35 characters, about 24 to 26 lines in all. Coordinates
must be plausible for the shapes drawn. A suggested skeleton:

```
<!-- a pelican riding a bicycle -->
<svg viewBox="0 0 640 360">
  <g id="bike" stroke="#3fd0c0">
    <circle cx="212" cy="262" r="48"/>
    <circle cx="356" cy="262" r="48"/>
    <path d="M212 262 262 196h76"/>
    <path d="M262 196 284 262h72"/>
    <path d="M338 196 356 262"/>
    <path d="M250 180h28"/>
    <circle cx="284" cy="262" r="12"/>
  </g>
  <g id="pelican" fill="#f4f1ea">
    <ellipse cx="270" cy="150" rx="62"/>
    <path id="neck" d="M310 128 …"/>
    <circle id="head" cx="332" r="17"/>
    <path id="bill" fill="#f2a23a" …/>
    <path id="pouch" fill="#f7c66b" …/>
    <circle id="eye" r="4"/>
    <path id="wing" d="…"/>
    <path id="tail" d="…"/>
    <path id="legs" stroke="#e2783a" …/>
  </g>
  <ellipse id="shadow" opacity=".2"/>
  <!-- 20 / 20 -->
</svg>
```

The first line is the request. The comment before the closing tag, `20 / 20`,
is this film's twentieth answer.

**Streaming.** Text appears in chunks of two to six characters, about thirty
chunks a second, with a short breath at the end of each line. It is a pure
function of `u`: precompute each chunk's time once.

**Colour.** Highlight the syntax as an editor would, including while a line
is only half written.

## Code and drawing together

Each drawing line owns one or more parts of the puppet (by tag). Until its
line is complete, a part is a **construction outline**: a hairline in slate,
dashed, with small square handles at a few of its points, the way a vector
editor shows a selected path. It is in the true pose and pedals like the
rest. It must be plainly readable as a pelican on a bicycle from the first
frame (about one unit wide and 60 % opaque, not a ghost).

When the line completes, two things happen at the same moment: the finished
line of code is marked once with the accent (a soft band behind it that fades
over about 0.4 s), and its part is drawn over about 0.3 s: the outline runs
round from start to end, then the fill fades up and the construction line
fades out. That link, line then part, is what the viewer must be able to
see. The order and times:

| u | Line completes | Drawn |
|---|---|---|
| 0.15 | the comment | (nothing; the caret moves on) |
| 0.4 | `<svg …>` | the canvas grid brightens slightly |
| 0.8, 1.0 | two circles | rear wheel, front wheel (tyre, rim, spokes, hub) |
| 1.2 – 1.7 | three paths, one short path | frame, fork, seat and bars |
| 1.9 | circle | chainring, cranks, pedals, chain |
| **2.0** | `</g>` | the bicycle is complete on the strong beat |
| 2.3 | ellipse | body |
| 2.55 | path | neck |
| 2.8 | circle | head, crest |
| **3.0** | path | **the bill**: the one strong colour arrives on the strong beat |
| 3.2 | path | pouch |
| 3.4 | circle | eye |
| 3.6 | path | wing and its dark feathers |
| 3.8 | path | tail |
| **4.0** | path | legs and feet: the pelican is complete on the downbeat |
| 4.2 | ellipse | the soft shadow under the wheels |
| 4.4 | `<!-- 20 / 20 -->` | |
| 4.6 | `</svg>` | a small `✓` and `20 / 20` appear at the left of the status bar and stay |

Adjust the times of individual lines to suit the lengths of the lines you
write, but keep the bicycle complete at u = 2.0, the bill on u = 3.0, the
pelican complete at u = 4.0 and the file closed by u = 4.6 (after about
u = 4.1 the picture frame begins to cover the right-hand end of the code
pane; short lines are still in view until about u = 5).

Before u = 0 the code pane is empty with a blinking caret.

## After the pelican

At u = 6 the pelican leaves through the last picture frame and does not come
back. The painting stays on screen, live, for about 1.4 s more, while the
camera pulls back to the gallery wall, where its frame shows world
x 629 … 982. Then it dissolves into its gallery still.

- From u = 6.0 to 6.6 the editor glides back to rest at a = 805.5 (the
  formula above; `smootherstep`, no overshoot). The code pane comes back
  into the picture from behind the frame.
- From u = 6.6 the picture is at rest: the finished file, the check mark,
  the grid, the ground line and an empty canvas.
- **Gallery still:** `still: { u: 4.833 }`, with the default framing. At
  that moment the pelican is at x = 805.5, so the still shows the same world
  stretch, 629 … 982, with the editor in the same place. The resting picture
  and the still must therefore be **the same picture except for the pelican
  and its shadow**: same code, same scroll position, same check mark, same
  grid, and the caret in the same state (hold it steady, not blinking, once
  the file is closed). Compare the still with a frame at u = 7.0 seen through
  the same square and make sure nothing else differs.
- The scene must be sane from u = −2 to 8.

## Title

- In the top bar, at its right, above the code pane (between a + 100 and
  a + 296): **代码美学**, 16 units, and `Code Aesthetics`, 13 units (its
  capitals at least 26 px tall on screen), as the window's title.
- In the status bar, right-aligned at a + 296:
  `21 世纪 20 年代 · 大模型时代 · 2020s, the LLM era`, 13 units (digits and
  capitals at least 26 px tall on screen).

Both travel with the editor. They are in view from the first frame and stay
whole until about u = 4.1, when the picture frame begins to cover them. Check
that they clear the visible area at zoom 1.1 (y 439 – 780).

## How to build it

- `src/scenes/code.js`: the editor chrome, the code text and its streaming,
  the timing table (which line completes when, and which puppet tags it
  owns), the canvas grid and ruler, the anchor. Chrome and finished code
  lines can be cached as sprites; the line being written is drawn per frame.
- `src/rig/skins/code.js`: the drawing. For each part: construction outline,
  partial stroke (by path length) and fill according to its own time, on a
  2D canvas patch.
- Subpixel care: place hairlines on half pixels at 1080p; check the
  half-size render too.

## Sound cues (for Stage 4)

| u | Event |
|---|---|
| each chunk of text | A very soft tick, if wanted |
| each completed drawing line | A soft tone, rising through the section |
| 2.0 | The bicycle is complete (strong beat) |
| 3.0 | The bill (strong beat) |
| 4.0 | The pelican is complete (downbeat) |
| 4.6 | The file closes: resolution |

## Check on the contact sheet

- It is beautiful. Type, spacing, colour and drawing would pass in a
  product someone was proud of.
- The code is real SVG, correctly highlighted, never wider than its pane,
  never touching the pelican.
- At u = 0.5 the pelican is all construction outline and plainly readable;
  at u = 2.0 the bicycle is finished and the bird is outline; at u = 4.0
  everything but the shadow is finished.
- Each part appears just after its own line is completed, not before, and
  the line is marked as it does.
- The canvas grid and ruler slide past; the editor stays still.
- The request (line 1) is being written, in view, as the pelican enters.
- After u = 6 the editor does not follow the pelican; it settles by u = 6.6,
  and a frame at u = 7.0 equals the gallery still without the pelican.
- Title parts legible and inside the visible area.
- Nothing resembles a real editor's logo, icon set or theme.

## As built

Editor builder pass (the illustrator rewrites the inside of `drawCodeFigure`).

- **Files.** `src/scenes/code.js`: anchor, editor chrome, SVG source, streaming,
  highlighting, the timing table (`TIMING`, `PART_TIMES`, exported), accent
  marks, glide and rest. `src/rig/skins/code.js`: `drawCodeFigure(stage, f,
  skel, parts)`, interface documented at the top of the file.
- **Source.** 26 lines, longest 35 characters, viewBox `0 0 80 60`; coordinates
  are the puppet's rest pose scaled by 8 / 21.2 (wheels at 25,44 and 49,44,
  r 8; bill tip at 61,12; shadow centred on the road point 37,52).
- **Streaming.** 145 chunks of 2-6 characters (mean 4.5), even rate between
  anchors, 0.035 s breath at each line end, each chunk eased in over 0.04 s
  so it is whole at its time. Rates: request 32 /s, bar 1 43 /s, bar 2 36-38
  /s, close 40 /s: faster than the brief's "about thirty", because 651
  characters and the anchored times do not fit at 30 /s with chunks of at
  most 6.
- **Times (u).** Stream starts -0.1 (empty pane, 1 Hz caret before). Request
  0.15; `<svg>` 0.32 (grid brightens); wheels 0.715, 0.888; frame paths 1.085,
  1.258, 1.431; seat and bars 1.604; chainring 1.80; `</g>` **2.0**; body
  2.373; neck 2.573; head 2.773; bill **3.0**; pouch 3.195; eye 3.389; wing
  3.584; tail 3.779; legs **4.0**; `</g>` 4.06; shadow 4.43; `</svg>` **4.6**
  (check mark draws 4.6-4.88, 20 / 20 fades up, tab's modified dot fades).
  The chainring line is anchored at 1.8 so its strokes have run round by
  2.0 and the bicycle reads finished on the beat.
- **Accent.** Only lines that do something are marked: part lines, the two
  `</g>` and `</svg>` (not the comments, openers or the first half of the
  ellipse).
- **Title.** Left-aligned at a + 100 (on the tab label's edge), not centred,
  so 代码美学 is whole in the gallery still; measured at zoom 1.1: Chinese
  49 px, "C" 32 px, date digits 30 px; date ink y 763.3-775.9.
- **Rest.** Gallery still and u = 7.0 differ only inside the pelican's box
  (x 798-1149, y 428-818 px of the 1920 square render).

Illustrator pass (`src/rig/skins/code.js` rewritten; scene and timing untouched).

- **Drawing.** Flat vector, no outlines, round caps and joins. Feathered parts
  share one vertical gradient (#fbfaf6 to #ece9e2) laid out from the joints, so
  body, neck, head, crest and tail join without seams; a radial cool shade
  (slate 168,181,201) turns the belly and back away from the light. Wing a
  cooler mid-tone (#e2e0da to #b4bdcb) with one soft fold curve; flight
  feathers charcoal, each shaded root to tip. Bill #f5ab42 to #ef9a2f with a
  light ridge and a darker hooked nail, lower mandible #e48e2c, pouch
  #f9cd77 to #f1b458; a dark eye on a patch of bare peach skin, with a
  catch-light. Legs #e2783a (far #a3532a), feet with a gradient. Wheels:
  charcoal tyre with an inner sheen, slate rim, 0.3-unit spokes, two-tone hub;
  teal frame (rear triangle a shade deeper), metal posts and bar, charcoal
  saddle with a highlight. Shadow: a soft pool plus a darker contact under each
  tyre. Feathers, wing, tail, crest, feet and saddle are drawn as smooth curves
  through the rig's points.
- **Construction.** Slate 0.85 units at 62 % (brighter for the entrance: see Stage 5), dashes fitted to each path's
  length (whole dashes, no stub at the join; tyre dashes roll with the wheel);
  small closed shapes (feet, pedals, crest, eye, tail and wing-tip feathers) as
  solid lines; one tail feather and one wing tip stand for their fans; about 16
  square handles at anchor points (hubs, frame joints, body ends, head, bill
  tip, pouch, wing, tail, saddle, bar end).
- **Draw-on.** k = (u - t) / 0.3. Strokes run round by path length (k 0 to 0.6,
  smootherstep; spokes grow from the hub, k 0.12 to 0.7), with a short alpha
  ramp so the round cap never pops. Fills: a fine line in the part's own colour
  runs round, then the fill fades up (k 0.3 to 0.92) while that line and the
  construction line fade (k 0.3 to 0.9). Shapes are grouped by time in rig
  order (crest moved behind the head); a fading group is painted whole on a
  scratch patch (`code/figure-part`) and laid down at one alpha, so tail
  feathers, wing tips and head never double up.
- **Open.** (Superseded below.) The legs line landed on 4.0, so the pelican
  was fully drawn at 4.3.

Second painter and art director pass (supersedes the times above).

- **Timing.** The legs line now completes at 3.7 and is drawn by 4.0; the
  pelican's `</g>` lands on 4.0 and is marked, so the pelican is whole on the
  downbeat (as the bicycle is on 2.0). The tail line moved up to follow the
  body (body, tail, neck, head, bill, pouch, eye, wing, legs) so bar 2 is
  written at an even pace either side of the bill. Times (u): request 0.15;
  `<svg>` 0.32; wheels 0.72, 0.92; frame 1.12, 1.29, 1.43; seat and bars 1.60;
  chainring 1.80; `</g>` **2.0**; body 2.30; tail 2.47; neck 2.65; head 2.82;
  bill **3.0**; pouch 3.18; eye 3.35; wing 3.53; legs 3.70; `</g>` **4.0**;
  shadow 4.39; `</svg>` **4.6**.
- **Streaming.** 118 chunks, mean 5.5 characters (2-6; as few chunks as fit
  a line, split unevenly). Rates: request 24 /s, bar 1 37 /s, bar 2 35-36 /s,
  close 28 /s. The caret waits at the line's indent on a new line.
- **Draw-on.** Front-loaded: outline round by k 0.55, fill up over k 0.26-0.72
  (smootherstep), construction gone by k 0.78, so the bill's colour is in by
  about u 3.15 and the grey phase of a fading white fill is about 0.14 s.
- **Construction.** Near side only for legs, foot and crank; no guides on
  wing tips, pedals, grips; one crest feather; handles only at hubs, bottom
  bracket, seat cluster, head tube, bar end, body, head, bill tip, pouch, wing,
  tail. The bottom bracket and tail no longer knot.
- **Drawing.** Legs are tapered capsules (hip 1.24 w, knee, ankle 0.66 w) that
  grow from the hip; the neck is drawn as a smooth curve; the ground shadow is
  a little stronger.
- **Open.** The SVG's fills are approximate: bill, pouch, eye and legs inherit
  the group's off-white (`fill` per element does not fit in 35 characters with
  the anchored times). A small step remains where the neck meets the body's
  top edge. The dark wing tips at the tail are still a busy shape.

Verification fixes (supersedes the times, layout and drawing notes above where they differ).

- **Wheel flicker: cause and fix.** The skin traced every circle as one
  `arc(a0, a0 + 2π)` with `a0` the wheel angle, which grows without bound (about
  920 rad in bar 2). For some angles `a0 + 2π − a0` rounds to a hair under 2π and the
  canvas draws no circle at all, so tyres and rims vanished about once a wheel
  revolution (period 0.8 s), not only in bar 2; the scratch patch was not involved
  (removing it changed nothing). Circles are now two half turns, and the start
  angle is wrapped into [0, 2π). `dev/experiments/code-sweep.js` renders 119.0–125.0 at
  60 fps (360 frames) and counts tyre pixels round each wheel: 0 bad frames.
- **Source.** 37 lines, longest 35, 963 characters; parses as XML and draws a
  recognisable pelican on a bicycle in the film's colours (`dev/experiments/code-svg.js`).
  Root carries `viewBox`, `fill="none"`, a dark `style` background and `xmlns` (35 characters,
  its own line). Wheels in a charcoal stroke group, frame, posts, bars and chainring in the
  teal group (tubes meet: seat tube and post one line, top tube and seat stay end on it,
  fork through the head tube). Bird group off-white: body path carries the tail, neck a
  closed shape, head, eye `fill="#222"`, bill `fill="#f2a23a"` on the line before its path,
  pouch `#f7c66b`, wing `#d2d5da`. Legs stroked `#e2783a` after the group, shadow ellipse.
  Longer than the "about 32" asked: wheels and frame need their own colours too, and
  the background line keeps the off-white body visible in a browser.
- **Streaming.** 162 chunks of 2–6 characters, as few as fit a line. Breath 0.012 s where an
  element or tag ends, 0.004 s on a continuation line, 0.3 s pause after the legs.
  Rates: request 24 /s, bar 1 44 /s, bar 2 47 /s either side of the bill, close 29 /s.
- **Times (u).** Request 0.15; `<svg>` closes 0.562 (grid lifts); wheels 0.814, 0.963;
  `</g>` 0.998; frame 1.250, 1.399, 1.502; seat and bars 1.651; chainring 1.80; `</g>`
  **2.0**; body and tail 2.283; neck 2.468; head 2.586; eye 2.793; bill **3.0**; pouch 3.208;
  wing 3.416; `</g>` 3.449; legs 3.70 (drawn by **4.0**); shadow 4.436; `</svg>` **4.6**.
  Nothing in the code completes on 4.0: the downbeat is the legs finishing.
- **Layout.** Top bar to y 468, status bar from 754; divider a + 84, line numbers end a + 104,
  code from a + 110 (35 characters end a + 287); title from a + 96 with a 19-unit gap so
  "Code Aesthetics" starts past the still's edge; date right-aligned at a + 288. Title and
  status baselines are computed from the measured ink so each is centred in the visible
  part of its bar. Measured at 1080p, zoom 1.1 (121.03): title ink y 20–68 px, right end
  1829; date ink y 1017–1057, right end 1872; longest code line ends 1867. So right air is
  48 px or more, but top air is 20 px and bottom air 23 px: centring a 44 px name in a
  92 px strip cannot leave 40 px above it.
- **Grid.** Dots baked brighter (#343e4d / #434e60) and drawn at 40 % until the `<svg>` tag
  closes, then 100 %, smootherstep over 0.3 s: dot peaks rise from about 40 to 70 levels
  (about 12 % of full scale).
- **Fills.** No fade: a group's fills are painted on the scratch patch, masked by a linear
  wipe with a 3-unit soft front (destination-in), and laid down once at full alpha. The wipe
  runs body tail→chest, neck base→head, head bottom→top, bill and pouch base→tip, wing
  shoulder→back, feet top→down, small parts left→right.
- **Drawing.** Neck and body joined by a fillet in the same gradient (no notch). Each leg is one
  tapered limb, straight bones and a rounded knee, into a webbed foot with three toes and
  small claws lying along the pedal. Three leaf-shaped flight feathers with shafts along
  the wing's lower edge (the fourth is left out); one light hand feather with a darker tip
  on the grip (the second left out). Wing: darker trailing edge (three clean arcs since Stage 5) and a secondary
  fold. Tail: three leaf feathers with a cool edge. Chainring: teeth, ring and a five-arm
  spider turning with the crank; tapered crank arms with spindles. Posts, stem and bar teal
  (the SVG's group); saddle and grips stay charcoal. Bill base blends from bare skin, a
  fine gape line runs back under the eye, and the eye's skin patch reaches towards the bill.
- **Still.** Unchanged framing; it and u = 7.0 differ only inside x 789–1150, y 427–830 px
  of the 1920 square render (the pelican and its shadow).

Second round (director's rulings after the re-check; supersedes the layout and leg notes above).

- **Feet.** Each foot is redrawn in the rig's own foot frame (recovered from the rig's web points,
  so it turns with the ankling): three toes fanned forward with two clear notches in the web's
  front edge, small claws, the sole running over the pedal with the ball of the foot on it. The
  rig's joints are unchanged; the knee is the rig's knee and bends with the stroke.
- **Far leg.** The far crank, far pedal, far leg and far foot are drawn after the wheels and just
  before the frame (rig order had them behind the wheels), so the far leg is seen whole through the
  frame on its pedal in the darker far-side tone (#a3532a, foot #94492a). The chainring and chain
  (near side) still cover the far foot for a moment each turn when the far pedal passes behind them.
- **Gape.** A fine dark line (#4e2c20, 0.036 S, about 2.5 px at 1080p), slightly sagging, from just
  inside the bill's base back under the eye, thinning at its end.
- **Layout.** Top bar to y 474, status bar from 748 (canvas and code pane 474–748; ruler 474–486, tab
  row 474–493, code from 496.5). The line being written stays at or above row 16 (17 rows show; the
  rest frame shows lines 21–37). Measured at 121.03 (1080p, zoom 1.1): title ink y 30–78 px, rule at
  110 (30 px above, 31 below); date ink y 1009–1048, rule at 978 (31 above, 32 below). Divider, code
  start, right-aligned items and title x unchanged.
- **Still.** Framing unchanged; it and u = 7.0 differ only inside x 797–1150, y 427–824 px of the
  1920 render (the pelican and its shadow).
- **Sweep.** `node dev/experiments/code-sweep.js`: 360 frames, 277 watched (u 1.0–5.6), 0 bad.

Stage 5 (the polish; supersedes the notes above where they differ).

- **Entrance.** The construction line is brighter and a little heavier while the figure comes in:
  slate (180, 196, 218) at 95 %, 1.1 units (handles and the shadow's guide ellipse in the same
  colour), easing to the plain guide (131, 145, 166) at 62 %, 0.85 units, over u 0.8-1.5
  (smoothstep, `guideLook` in the skin). Still dashed. Brightest guide pixels in the pelican's box
  rose from about 115 to about 185 levels at u 0.25-0.75. From u 1.5 the guide is as before.
- **Wing.** The trailing edge (the rig's wing points 4-11) is three even arcs, each bowing 1.3 units
  outside the chord from midway along points 3-4 to midway along 11-12 and meeting at notches
  1.0 unit inside it (`wingEdge` in the skin); the fill, the construction outline and the darker
  edge stroke all follow it. The SVG's wing path is unchanged (a simplified wing with a straight
  lower edge, as before).
- **Last scroll.** The `</svg>` row scrolls in over u 4.43-4.60 (the 0.17 s ending as the file closes)
  instead of 4.553-4.723, so the line is whole above the status bar when it completes. It overlaps
  the previous row's scroll (4.436-4.606), so the last two rows glide up together.
- **Resting date.** Once the editor glides back (u > 6), the date line is the same sprite cut where the
  Chinese date ends; the English half (" · 2020s, the LLM era") fades out over u 6.0-6.6. At rest and in
  the gallery still the status bar reads 21 世纪 20 年代 · 大模型时代, whole, ending about 38 px inside the
  square of the 1920 still render. Up to u 6 the date line is unchanged.
- **Title.** Measured at 122.8 (zoom 1.1): 代 49 px, "C" 32 px, date digits "2" and "L" 30 px; unchanged.
- **Still.** It and u = 7.0 differ only inside x 778-1150, y 427-834 px of the 1920 render (the pelican
  and its shadow), the same box as before Stage 5.
