# Section 9 · 八大山人写意 · Bada Shanren Expressive Ink

| | |
|---|---|
| Date on the title | 约 1690 年 · c. 1690 |
| Film time | 53.0 s – 59.0 s |
| Code | `src/scenes/bada.js`, shared ink system in `src/kit/ink.js` |
| Homage | Zhu Da, called Bada Shanren (c. 1626 – 1705): birds, fish, rocks and lotus in a handful of wet strokes on bare paper, and the famous upturned eye. Public domain. No painting is copied. |

## The idea

Almost nothing. A sheet of raw paper, most of it empty. A top-heavy rock at
the left. One lotus stem coming down from the top edge with a single broken
leaf. One small fish low in the blank that stands for water. An inscription
and two seals.

The pelican is painted in perhaps twenty strokes: a wet oval for the body, one
curve for the neck, two dry strokes for the bill, two rough rings for wheels.

**The joke (bar 2):** it rolls its eyes. Bada's birds and fish look at the
world with a square eye and a pupil jammed up against the lid. The pelican's
pupil travels slowly up and back until only white is left below it, holds
there through the strong beat, and comes down again. The fish, as it passes
overhead, does the same.

## Materials

- **Ground.** Raw xuan, `GROUNDS.xuan`. At least two thirds of every frame
  is bare paper.
- **Ink.** The full range, used sparingly: burnt black for the eye, the
  wheel rims and moss dots; thick and heavy ink for main strokes; light ink
  for washes and the lotus leaf's pale side.
- **Brushwork, specific to this section:**
  - *Wet strokes* that pool and bleed at their edges: body, leaf, rock
    shadow. Use the wash and wet brushes and pass the sheet through
    `bleedSheet` so the ink creeps into the paper.
  - *Dry strokes* with flying white (`dry`, `drysoft`): the bill, the
    bicycle frame, the wheels, the lotus stem.
  - *Single touches* (`dab`): moss dots, the pupil, feet.
  - Every stroke is one gesture, set down fast and left alone. No outline
    drawn round a form and then filled. No correction.
- **Colour.** None, except the red seals.

This is the "expressive ink" member of the ink family.

## Composition

World units. **There is no ground line.** The wheels rest on blank paper; two
or three faint dry horizontal strokes somewhere under the road (y ≈ 704 – 712,
x 380 – 620) are all that hints at it.

- **Rock:** x 90 – 260, y 560 – 720. Narrow foot, heavy leaning head; three
  or four wet contour strokes, a pale wash on the shadowed side, a few black
  moss dots.
- **Lotus:** a stem entering from the top edge near x = 860 and curving down
  and left; one large leaf at about x 700 – 830, y 478 – 560, half dark and
  wet, half pale, with torn edges and a few vein strokes; a bud on a second,
  shorter stem.
- **Fish:** about 46 units long at x ≈ 585, y ≈ 748, facing left and
  slightly upward: a dark back in one stroke, a pale belly left as paper, a
  forked tail in two flicks, the square eye.
- **Inscription:** see Title.
- Everything else is paper.

## The pelican

Painted fresh each frame from the pose, on a small ink sheet that is bled and
then laid on the paper.

- **Body:** one broad wet stroke or wash following the body's oval, dark at
  the back and thinning to nothing at the breast, a second darker wet stroke
  for the wing, three flicks for the tail.
- **Neck:** one loaded curve from shoulder to head (`bone`), thick below and
  lifting off at the head.
- **Head:** left mostly as paper, defined by the eye and the bill.
- **Bill:** two long dry strokes, upper and lower, meeting at the tip; the
  pouch a single pale wet touch hanging between them.
- **Eye:** large, about two and a half times the puppet's own eye. An
  irregular squarish ring in one dry stroke, not quite closed, and a heavy
  round pupil. At rest the pupil sits high and forward.
- **Legs and feet:** thin strokes and a touch each.
- **Bicycle:** each wheel one swift dry ring that does not quite close, with
  flying white; four or five hair-thin spokes that turn; the frame in three
  or four dry strokes; a dot for each hub.

About twenty strokes in all. Seed each stroke by its part, so its texture
rides with the pelican and does not boil from frame to frame.

## The eye, bar 2

| u | |
|---|---|
| 2.0 | The pupil starts to climb. The head tips back a little (`headPitch` to about +0.12), the lid lowers a third. |
| 2.6 | The pupil is jammed in the upper back corner of the eye; nothing but white beneath. |
| 2.6 – 3.6 | Held, through the strong beat at 3.0. |
| 3.2 – 3.8 | The fish, now beneath the pelican, rolls its own eye up to match. |
| 3.6 – 4.0 | The pupil comes back down; the head levels. |

The pelican keeps the standard pace. No camera move.

## Title

An inscription at **x 300 – 470, y 446 – 604**, in running script
(Xingkai SC), reading down, columns from the right:

- 八大山人写意, about 24 units.
- 约一六九〇年, about 12 units.
- Below, across: `Bada Shanren Expressive Ink` and `c. 1690` in a serif
  italic, about 10 units.
- Two red seals, one oval and one square.

## Gallery still

`still: { u: 3.0 }`: the eye at its height.

## How to build it

- Bake the fixed painting (rock, lotus, the fish's body, hint of ground,
  inscription) as an ink sheet, bled once.
- Per frame: the pelican and the fish's eye on a sheet only as large as it
  needs to be, bled, then laid on. Keep the bleed pass small; do not run it
  over the whole frame.
- Few tones, few strokes, so cost should be low; measure it.
- The danger is tidiness. A stroke that is too even, a ring that closes
  neatly, a wash with a clean edge, and it stops being Bada. Look at each
  mark and ask whether a wet brush made it.

## Sound cues (for Stage 4)

| u | Event |
|---|---|
| 2.0 – 2.6 | The eye rolls up: the flute bends upward |
| 3.0 | Held (strong beat) |
| 3.6 – 4.0 | Comes down |

## Check on the contact sheet

- Most of the frame is empty paper, and the emptiness looks intended.
- Every mark reads as one stroke of a wet or a dry brush; ink has bled into
  the paper at wet edges.
- With so few strokes it is still at once a pelican on a bicycle.
- The eye roll reads at film speed: pupil forward at u = 1.5, hard against
  the top at u = 3.0, back by u = 4.2.
- The fish answers.
- Strokes do not flicker from frame to frame.
- Title legible, three parts, two seals.

## As built

- **Still sheet** (baked once, 3.3 px/unit, x −70…1070, y 412…808): wet
  marks (washes with high p5.brush bleed, `wet`, `bone`, `dab`) on a blank
  sheet, passed once through `bleedSheet` (reach 7 px); then the dry marks
  (`dry`, `drysoft`, `scumble`, `leaf`), the writing and the seals on top.
- **Rock** (after verification): a top-heavy rock hanging in from the top
  edge at the upper left, x 18–246, y 416–553; nothing of it lies between
  y 560 and 705, so the pelican rides in beneath it and crosses nothing. An
  angular, broken contour: left flank (`Marks.sd`, a loaded `bone` core that
  fades under a dry stroke) turning hard at a corner; the underside in three
  burnt-black `bone` strokes with a nose and a notch; right flank to the
  shoulder and back in to the edge. Contour strokes use low spline curvature
  (0.15) so they turn at corners. Three axe-cut texture strokes in different
  directions, four dry rubs (`scumble`, `dry`), two pale washes and a darker
  shadow wash under the overhang that do not quite meet the contour, moss
  dots on the shoulder, the left flank and the nose. No reserve/knockout any
  more: the bird overlaps nothing.
- **Lotus**: dry stem with thorn dots ending in the leaf at (784, 508). The
  leaf is one torn form: a pale `dan` wash over the whole of it, a `zhong`
  and a `nong` wash over the far half, three broad wet side-brush strokes
  from the stem that get heavier towards the far edge, two pale wet strokes
  into the light half, a burnt rolled rim, and five dry veins that all start
  at the stem and lift off before the edge (no black node). The bud is a
  pointed ovoid in two `leaf` strokes meeting at the tip, a pale wash between.
- **Fish** at (585, 748), 46 long, facing left: back in one `bone` stroke,
  forked tail in two dabs, a gill curve, a pale dry belly stroke that runs
  out, a snout touch. The eye is large: one dry ring about 9.6 u across
  (r 4.8), heavy along the top, open at the lower back.
- **Inscription** x 316–480, y 436–560: the characters are drawn on their own
  sheet and bled lightly (reach 2.4 px, amount 0.55), then multiplied into
  the still. 八大山人 (signature column, right) and 写意 in Xingkai SC bold
  24 u, each character its own tone (burnt black, thick, greyer) and three of
  them with flying-white gaps cut along the stroke direction; the date
  column 约一六九〇年 at 12 u with the zero as a brushed, open ring. The oval
  朱文 seal 八大 sits at the foot of the signature column (457, 545); the
  English across beneath the columns: `Bada Shanren Expressive Ink` (right
  edge x 446, baseline y 539; Hoefler Text italic 11.8 u, tracking -0.14 u,
  from x 318.6) and `c. 1690` (right edge 430, baseline y 552; Hoefler Text
  italic 12.2 u, the figures in Palatino italic so they line), closed by the
  square 白文 seal 鹈鹕 (433–445, 542–554). Seals unbled, on top. At zoom 1.1
  the capitals measure 27–29 px and the figures 28–29 px.
- **Pelican**: painted per frame on a sheet anchored to its road point
  (x −84…+80, y −150…+8). Wet pass, bled lightly (reach 2.6 px-equivalent,
  amount 0.6, down from 5.5 / 0.85, so no grey halo round the neck): body
  stroke and pool, back, wing, wing-arm, belly line, neck, front-of-neck
  touch, the pouch (a single wet wash in `zhong` at 215, no outline), near leg. Dry pass on
  top. **Bill**: two strokes, each a loaded burnt core that runs out by about
  half way under a dry stroke, pressed hardest at the base and breaking into
  flying white towards the tip; the lower one is thinner and stops before the
  tip. **Eye**: R = 10 u, one stroke round a squarish superellipse that lands
  on the lid at the back corner, runs heavy along the lid, thins round the
  front and the bottom (with a dry flying-white overlay on its last half) and
  stops short, leaving a gap at the lower back. Pupil r 4.3 (3.9 rolled).
  **Bicycle**: each wheel one `bone` ring over 80 % of a turn that lands
  heavy and runs thin, with a `dry` flying-white stroke over its last half;
  the last fifth of the circle is open and nothing closes it; three hair-thin
  tapered spokes that bow slightly and stop short of the rim; hub dabs. The
  frame in three loaded strokes (top tube on into the fork; down tube; saddle
  down the seat tube and back along the chain stay), each a `bone` core of
  varying pressure under a `dry` stroke, overshooting or stopping short at
  the joints; a thin flick for the seat stay; stem and bar in one stroke.
- **Timing**: pelican eye 2.0–2.4 the pupil climbs, 2.12–2.6 it travels back,
  the lid comes down 36 % of the eye, head pitch +0.12; held to 3.6; back by
  4.0. **Fish eye**: 3.2–3.8 the pupil rolls from forward-centre into the
  upper back corner (about 3.3 u forward-to-back, 3 u up) while a lid touch
  comes down over the top of the ring, white showing beneath; held; down
  4.7–5.1. Pupil and lid are stamped from baked touches.
- Speed (1080p, measured while other renders were running on the machine):
  draw mean entry 8.3 ms, middle 5.2 ms, exit 6.8 ms; p99 ≤ 10.4 ms.
- **Stage 5:** the Latin lines were raised to the readability rule: the name
  in Hoefler Text italic 11.8 units with -0.14 units of tracking (so its "B"
  stays inside the writing's sheet, which begins at x 316), capitals 27–29 px;
  the year in Hoefler Text italic 12.2 units with its figures in Palatino
  italic (lining), figures 28–29 px (before: capitals 24 px, the old-style
  1 and 0 at 15–21 px). Right edges, baselines and seals are where they were;
  the inscription now starts at x 318.6, 72 units clear of the rock. The
  still's centre moved from the pelican (x 500) to x 488 (491 in the fix round; the director gave it three units more air) so the longer name is
  whole inside the square. The pouch is one tone heavier at rest and
  throughout (`zhong` at 215, the body pool's tone, instead of `dan` at 150),
  still a single wet touch with no outline.
