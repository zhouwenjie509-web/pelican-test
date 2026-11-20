# Section 3 · 汉画像石拓片 · Han Stone Relief Rubbing

| | |
|---|---|
| Date on the title | 约公元 100 年 · c. 100 CE |
| Film time | 17.0 s – 23.0 s |
| Code | `src/scenes/han.js`, shared ink system in `src/kit/ink.js` |
| Homage | Eastern Han pictorial stones with incised line (车马出行图, the chariot procession), as they are known from ink rubbings. Anonymous, public domain. No stone is reproduced; the procession is drawn fresh in that manner. |

## The idea

Not the stone but an **ink rubbing** of it: xuan paper laid on the carving
and dabbed with an ink pad, so the stone's surface prints black and every cut
line stays the white of the paper. Border bands of pattern, a register of
seated figures above, and in the main register a procession of outriders and
light carriages, each vehicle with its small label cut beside it: 功曹车,
主簿车.

In the middle of the procession, between two carriages, in the same white
line and at the same trot, rides a pelican on a bicycle. Its label is the one
patch of the rubbing that nobody has inked yet: a blank rectangle of paper.

**The joke (bar 2):** the rubbing is still being made. On four beats an ink
pad comes down on the blank label, once per character, and the reserved
characters appear: 此 · 鹈 · 鹕 · 车 ("this: the pelican's carriage"), in
exactly the form of the other labels. The stone had it all along.

## Materials

- **Paper.** `GROUNDS.xuan`, visible as a narrow margin above and below the
  rubbing, in every cut line, and where the stone is chipped.
- **Ink.** One tone, `INK.jiao`, laid by dabbing, never by brush. The black
  is not flat: it is a field of fine speckle where the pad missed the pores
  of the stone, slightly lighter in overlapping round dabs about 30 units
  across, thinner towards the ragged edge of the sheet. Use the ink tones
  only (a second, greyer tone for thin passages is fine).
- **Line.** Everything drawn is *absence of ink*: white line 1.6–2.4 units
  wide with a slightly broken, chiselled edge, because the pad bridges
  narrow cuts. Corners are angular; curves are made of short straight cuts.
- **Stone.** Two or three long cracks cross the whole height as wandering
  paper-white lines; corners and edges are chipped (irregular white
  patches); a few pits.
- **No brush marks anywhere** except the red collector's seal.

This is the "stone rubbing" member of the ink family: xuan paper and ink
tones from the kit, with dabbing in place of brushwork. Write the rubbing as a
shader that takes a *line mask* (white where the stone is cut) and world
coordinates, and returns ink coverage.

## The stone

World units; ground line y = 700. The inked sheet runs the full width and
from y = 452 to 772; paper margin beyond.

| Band | y | What |
|---|---|---|
| Upper border | 452 – 470 | Lozenge or hanging-curtain pattern in white line |
| Upper register | 474 – 546 | A row of seated figures at a feast, about 50 units tall, facing each other in pairs, with cups and a low table; and the title panel |
| Rule | 548 – 556 | Double line |
| Main register | 556 – 706 | The procession. Ground line at y = 700. **No fixed figures here**: nothing may collide with the riders. |
| Lower border | 712 – 772 | A frieze of running animals (tiger, deer, hare, a long-tailed bird) in the flying gallop, in white line |

Borders, the upper register, the frieze, the cracks and the dab texture are
fixed in the world and scroll past. They are what shows that the procession
is moving.

## The procession

It travels with the pelican: every member keeps a fixed distance from
`f.pelican.x`, at pelican scale, all facing right. From front to back:

| Offset | Member |
|---|---|
| +330 | Two outriders abreast (the nearer horse half a length behind), riders with pennoned lances |
| +200 | A light carriage (轺车): one horse, big wheel of about 30 units radius with many spokes, a box with driver and official, a parasol on a pole. Label 功曹车 |
| 0 | **The pelican.** Its label hangs ahead of and above the bill |
| −190 | A second carriage with a taller canopy. Label 主簿车 |
| −350 | Two mounted attendants |

Leave a clear gap of at least 60 units ahead of the pelican's bill for its
label, and none of the members may touch another.

**Han horses:** heavy arched neck, small head, deep chest, round quarters,
thin legs, a strongly raised foreleg, tail tied in a knot. A few inner lines
only: jaw, mane, harness. They trot in time: one stride per beat (0.5 s),
legs changing in four to six stepped positions rather than smoothly.
Carriage wheels turn at the true rate for their radius. Riders rise a little
on each stride.

**Labels (榜题):** upright rectangles about 30 × 74 units in white line, four
characters in clerical script (Libian SC), about 16 units each, reading down.
They travel with their vehicle.

## The pelican

White line like everything else: the outline of every part of the puppet
(`outlines(skel)`), two line weights, a few rows of short cuts for feathers,
the eye as a ring with a dot. Slightly squared, as if cut with a chisel. No
fill. The wheels keep their spokes.

## The label, bar 2

Until bar 2 the pelican's label is a **blank paper rectangle** with a thin
ragged ink edge: an un-inked patch.

| u | |
|---|---|
| 2.0 | The pad (a soft-edged round ink disc about 26 units across) lands on the top cell and lifts: 此 is there, white on black |
| 2.5 | Second cell: 鹈 |
| 3.0 | Third cell: 鹕 |
| 3.5 | Fourth cell: 车 |

Each tap is quick: the disc appears a little large, settles within two or
three frames, is gone within 0.15 s, and leaves that cell inked, a shade
wetter and darker than the old ink for about half a second. After 3.5 the
label is identical in kind to the others.

No other event. The procession trots on to the frame; its front members
disappear behind the frame one by one, and only the pelican comes out the
other side.

## Title

Cut into the stone in the upper register at **x 190 – 460, y 474 – 546**, as
a framed panel, white on black:

- 汉画像石拓片 in clerical script (Libian SC), about 24 units tall, in one
  line or two columns.
- `Han Stone Relief Rubbing` and `约公元 100 年 · c. 100 CE`, about 10
  units, cut the same way.
- One small red seal (鹈鹕) stamped on the paper margin nearby: the only
  colour in the picture.

## Gallery still

`still: { u: 3.7 }`: the finished label, the pelican, part of each carriage.

## How to build it

- Bake the fixed line work (borders, upper register, frieze, title, cracks)
  as a mask over x −60 … 1060.
- Per frame, draw the moving line work (procession, pelican, labels) as a
  second mask on a view-sized layer. Cache each horse and carriage per gait
  step as a sprite.
- One rubbing pass turns the masks into ink over the xuan ground. **Anchor
  the grain inside moving lines to the procession, not to the world**, or
  their edges will boil; anchor the dab texture, cracks and pits to the
  world.
- Label cells: the blank patch, the pad and the fresh ink are extra terms in
  the same pass.

## Sound cues (for Stage 4)

| u | Event |
|---|---|
| every 0.5 | Hoofbeats: one stride per beat |
| 2.0, 2.5, 3.0, 3.5 | The pad lands: four bell strokes |

## Check on the contact sheet

- Reads at once as an ink rubbing of a carved stone: speckled black, white
  line, cracks, paper margin. Not white vector lines on flat black.
- The horses are Han horses.
- The pelican is in the same line and scale as its neighbours and is not
  touching them.
- The label is blank through bar 1, then gains one character on each of the
  four beats, and ends indistinguishable in style from 功曹车 and 主簿车.
- The procession holds formation; the borders and cracks scroll.
- Line edges on the moving figures do not shimmer from frame to frame.
- Title legible, three parts.

## As built

- **Masks.** The fixed stone is one 2D-canvas bake over x −80…1080, y 432…792 at 3.3 px/unit (R cut line, G inked sheet with ragged chipped edge, B fine-lettering flag: 0.6 over the title panel, which the shader reads as full protection from warp and edge noise; 1.0 in a 2.6-unit guard round the date line, which also takes away 90 % of the speckle there). The procession, pelican and labels are drawn per frame into a screen-sized framebuffer (R cut line, G blank paper, B wet ink / pad) from cached sprites: each horse type at six gait steps, two carriages (horse included) at six steps, one wheel sprite rotated at the true rate, three label sprites, the pad.
- **Rubbing pass.** One shader (`RUB_FRAG` in `han.js`) multiplies onto `inkGround(GROUNDS.xuan)`: overlapping round dabs (~19-unit grid, 24–36 across), a slow large-scale thinning, faint chisel striations, round pores, thinning and extra speckle towards the sheet edge, warped and noise-thresholded line edges with occasional pad bridges. Edge noise of moving lines uses `w − (pelicanX, 0)`; dabs, pores, cracks and striations use world coordinates. Tones: `INK.jiao` / `INK.nong` only.
- **Procession offsets** (from the pelican's x): outriders +377 (near) / +414 (far); carriage 功曹车 wheel +165, horse +255; pelican label x +78…+108, y 560…634; carriage 主簿车 wheel −238, horse −148; attendants −333 (far) / −371 (near). The outriders sit beyond the screen edge most of the time (screen half-width is 303 units at zoom 1.1).
- **Title panel** x 200…450 (narrowed from 190…460 so it is in full view 2.1 s, u ≈ 0.9…3.0). Chinese name Libian 26 units (baseline 505); English name Optima 600 at 12.5 units (baseline 521.5, about 191 units wide); date upright, the Chinese in Libian 13 units thickened by a 0.8-unit stroke, the figures and Latin in Optima 600 at 12.5 units (baseline 537.5, about 160 units wide). On screen at zoom 1.1: English capitals 28 to 29 px, date figures and capitals 27 to 28 px. Seal at x 467, y 438.6, 12.5 units, on the top margin.
- Gait: `floor(u·12) + phase` mod 6, one stride per beat. Pad taps at u = 2.0, 2.5, 3.0, 3.5; disc 30 units soft, appears 0.034 s early at 1.28× and settles by +0.05, gone by +0.15; cell wet for 0.6 s.

### Stage 5

- English name 11.5 → 12.5 units: capitals 25 → 28 px.
- Date line no longer in Libian's thin italic Latin: Chinese in Libian 13 units with a 0.8-unit stroke, figures and Latin in Optima 600 at 12.5 units, drawn run by run and centred; baseline 538 → 537.5. Figures 21 → 27 px, capitals 28 px.
- The date is guarded from the speckle: the fine flag is now two-level (panel 0.6, a guard 2.6 units wide round the date's strokes 1.0); `RUB_FRAG` reads the old protection as `clamp(fine / 0.6)` (unchanged over the panel) and cuts the speckle by 90 % inside the guard. Only the baked title panel changed, so every frame in which it shows changes (film 16.5 to 21.3 s, all inside its box); the rest of the stone is byte-identical.
