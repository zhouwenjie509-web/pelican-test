# Section 8 · 莫卧儿细密画 · Mughal Miniature Painting

| | |
|---|---|
| Date on the title | 约公元 1600 年 · c. 1600 CE |
| Film time | 47.0 s – 53.0 s |
| Code | `src/scenes/mughal.js` |
| Homage | Album pages of the imperial Mughal workshops around 1600: opaque watercolour and gold, garden gatherings, and the natural-history studies of birds made for the court. Public domain. No page is copied and no historical person is portrayed. |

## The idea

An album page: a jewel-bright garden party inside a wide border of gold
flowers on deep blue. Mughal painters did not use one viewpoint. A carpet is
shown from straight above, the pavilion beside it from the front, the people
on the carpet in three-quarter view, the pool as a flat blue rectangle. Every
thing is shown from the side that explains it best.

The pelican rides along the garden walk, painted with the minute care the
court's bird painters gave to rare birds.

**The joke (bar 2):** the painting applies its own rule to the pelican. Along
the foot of the picture runs the garden's water channel, drawn in plan as the
tradition requires; in it the pelican appears **seen from directly above**, a
top view of the same bird on the same bicycle, pedalling in step. And on
beat 3 every guest in the garden, whatever angle the painter has given them,
is found with one finger laid on their lips: the miniature's own sign for
astonishment. They do not move to it. On the beat they simply are that way.

## Materials

- **Paper.** Burnished cream, barely visible; colour is opaque and even.
- **Colour.** Saturated mineral colour: lapis blue `#1f3f8a`, malachite
  green `#2f7d5b`, vermilion `#c8402a`, orpiment yellow `#e3b23c`, lead white
  `#f4efe2`, rose `#d98a8a`, a mauve, a sandstone red `#a8523c` for
  architecture, and **gold** `#c9a13b` with lighter `#ecd28a` highlights.
- **Line.** Hairline outlines in dark brown, never heavy. Faces, hands and
  textile patterns are tiny and exact.
- **Pattern everywhere.** Carpets, robes, tiles, the pavilion's inlay, flower
  beds drawn plant by plant. Nothing is left as a flat empty area except sky
  and water.
- **Finish.** A faint craquelure and slight rubbing of the gold. No brush
  texture: this is the smoothest painting in the film.

## The page

World units; the garden walk is the road, y = 700.

| Band | y | What |
|---|---|---|
| Top border | 433 – 466 | Gold flowering scroll and small birds on lapis; thin rules of gold, black and red beneath (466 – 470) |
| Picture | 470 – 748 | The garden |
| Rules | 748 – 752 | |
| Bottom border | 752 – 790 | As the top |

The border also runs down both ends (x 18 – 52 and 948 – 982). The pelican
rides in and out across it, as Mughal figures sometimes step over their
frames.

Inside the picture, bottom to top:

- **Water channel, y 714 – 748, in plan:** grey-blue with a regular ripple
  pattern in white line, small fish seen from above, two or three fountain
  jets drawn from the side. The top-view pelican travels in it.
- **Walk, y 690 – 712:** geometric tile pattern in plan.
- **Flower bed, y 660 – 690:** a row of flowering plants, each a small
  botanical portrait (poppy, iris, lily, narcissus).
- **x 110 – 390: the party.** A carpet in plan (about x 120 – 380,
  y 540 – 650) under a red and gold canopy on four poles. On it, in
  three-quarter view: a nobleman against a bolster, two companions, a
  cup-bearer standing, and two musicians with a long-necked lute and a pair
  of small drums. Trays of fruit and flasks.
- **x 420 – 520:** a dark cypress entwined with a blossoming tree; a
  gardener half hidden behind it.
- **x 540 – 900: the pavilion,** seen from the front: red sandstone and
  white marble, three cusped arches with a figure standing in each, an upper
  balcony with a carved rail and three people leaning out and looking down,
  small domes above cut by the border.
- **Above:** a garden wall with niches, tree tops, and a strip of gold sky
  with a few curling clouds.

People are about 120 units tall standing (seated, about 70): turbans, long
robes with sashes, veils. Twelve or so in all.

## The guests, two states

Paint every guest twice: **at ease** (pouring, playing, talking, looking
down at the water) and **astonished** (head turned to the pelican, index
finger on the lips, everything else as before). The picture shows the first
state until u = 3.0 and the second from u = 3.0, with a cross-fade of no more
than 0.08 s. That is the whole animation. The musicians' hands are off their
instruments in the second state.

## The pelican

On a 2D canvas patch, in the manner of a court bird study: hairline outline,
white plumage modelled with the faintest grey stipple and a hint of rose,
black flight feathers, yellow bill, an orange-yellow pouch, flesh-pink legs,
a small dark eye with a highlight. The bicycle is goldsmith's work: gold
frame with a fine dark outline, gold rims, hair-thin spokes; the saddle sits
on a small red saddle-cloth with a gold border and tassels.

**The top view** (in the channel, directly below the pelican, same x): draw
it from the pose. From above, a bicycle is a line: rear tyre, frame,
handlebar across, front tyre; the pedals stand out to either side and
alternate with the crank angle. The pelican is an oval back with folded
wings and dark tips, a fan of tail, the neck and a small head with the long
bill pointing forward, and a foot on each pedal. Paint it like the side
view but a tone cooler, and let the ripple pattern cross it lightly.

## The three bars

| u | |
|---|---|
| 0 – 2 | In over the border. Title panel above. The party at ease; music. The top view accompanies the pelican from the start. |
| 2 – 4 | Between party and pavilion. **u = 3.0: every guest is astonished.** |
| 4 – 6 | Past the pavilion; the balcony party, fingers on lips, look straight down at what the channel shows. Out over the border. |

The pelican keeps the standard pace. No camera move.

## Title

A text panel at the head of the picture, as on illustrated pages, at
**x 160 – 430, y 474 – 516**: cream ground inside gold rules, the words in
reserve shapes outlined with gold cloud scrolls.

- 莫卧儿细密画, about 22 units, in a flowing hand (Xingkai SC), black.
- `Mughal Miniature Painting` and `约公元 1600 年 · c. 1600 CE`, about 10
  units, in a chancery italic (Apple Chancery or Hoefler Text italic).

## Gallery still

`still: { u: 3.3 }`.

## How to build it

- All on 2D canvas, baked: one layer for the page and garden, two layers
  (or one layer with two rows) for the guests' states.
- Per frame: page, guests in the current state, top-view pelican with a
  ripple overlay, side-view pelican.
- Gold: a base tone plus a few lighter touches along one side of each form,
  and a fine pattern of darker lines; it must not be a flat yellow.
- Build ornaments from repeated small units (a flower, a leaf, a tile) with
  seeded variation. Density matters more than any single motif.

## Sound cues (for Stage 4)

| u | Event |
|---|---|
| 3.0 | Everyone astonished: the musicians stop for one beat |
| 3.5 | Music resumes |

## Check on the contact sheet

- Reads as a Mughal album page: border, gold, saturated flat colour, dense
  pattern, hairline drawing.
- The carpet and the channel are in plan while the pavilion is in elevation,
  and it looks right, not like a mistake.
- The top view is clearly the same pelican seen from above, pedalling in
  step with the side view.
- One frame before u = 3.0 no finger is raised; one frame after, all are.
- The pelican is finely painted and stands out from the busy garden.
- Title legible, three parts.

## As built

- **Files:** `src/scenes/mughal.js` (page, garden, guests, title, per-frame
  compositing) and `src/rig/skins/mughal.js` (the side-view bird study with the
  gold bicycle, and the top view drawn from the same rig joints).
- **Layers:** the whole page (x −70…1070, y 418…802) is baked twice on 2D
  canvas at 3.3 px/unit × `stage.s`: state 0 (guests at ease) and state 1
  (astonished). About 9.5 MP at 1080p. Per frame: one page, the top-view
  pelican on a patch clipped to the channel (cool tint and the ripple pattern
  laid over it with `source-atop`), the side-view pelican on a patch.
- **Event:** hard switch from state 0 to 1 at u = 3.0 (no cross-fade; the brief
  allows up to 0.08 s). Thirteen guests: six at the party, the gardener behind
  the cypress, three in the arches, three on the balcony. Musicians' hands are
  off their instruments in state 1 (the lute is laid flat on the carpet); the
  balcony figures tip their heads down 0.62 rad (about 35 degrees), lean so the
  chin is over the rail, and lower their eyes to the channel.
- **Top view:** x of every part comes from the rig joints, so wheels, cranks,
  pedals and feet alternate in step with the side view. The head and bill are
  turned 0.1 rad toward the viewer so the front tyre shows beside the bill.
- **Still:** `{ u: 3.15, cx: 484 }` (the whole English title reserve, the
  cupbearer, gardener and lady with fingers raised, the pelican, the first
  arch; the bill ends on the pier before the lady, and the square's left edge
  falls in the gold between the two title reserves).
- **Title:** an illuminated cartouche at x 176–424, y 468–520 (248 units, so
  it is in full view about 2.15 s, from u ≈ 0.73 to 2.87): a lapis border with
  a fine gold scroll, a gilt ground, and cream cloud-band reserves cut to each
  line's measured width (scalloped edges, pointed end lobes, one gold outline
  round each column), small flowers set in the gold between them. Left column:
  莫卧儿细密画 at 19 units (glyphs about 54 px at zoom 1.1) over the Chinese
  date at 14.5 units; right column: the English name in two lines and the
  English date at 14 units italic chancery, the date's figures set in Palatino
  italic (lining) because the chancery's figures sit low (capitals of the name
  about 28 px or more; figures of the English date 31–32 px; the Chinese
  date's figures 28–29 px). The right column's three baselines are about
  483.7, 495.0 and 512.5, with the date's reserve centred 4.4 above its
  baseline, so the "g" of "Painting" clears the "C" of "CE" by about 7 px.
  The flowers in the gold keep the colours they had before the date reserve
  was re-cut (their colour sequence follows the first cut; only gold the
  re-cut covered or opened changed).
- **Motion / camera:** standard; no overrides.
- **Second pass (art direction):**
  - Gold: every `gilt` form now has a burnished relief (a bright rim on the
    upper-left edges, a brown one on the lower-right) as well as the gradient,
    hatching and bole rubbing; the gold sky has burnished patches and denser
    agate strokes.
  - Border: a finer under-scroll (hairline gold spirals, small leaves, three-dot
    florets) and twice the gold dots fill the lapis under the main scroll; the
    corner pieces carry a ring of buds and dots.
  - Lawn: a millefleur of tufts, leafy rosettes, sprigs and sprays set close in
    staggered rows, about 2,800 plants; the flower bed has a back row of small
    plants and ground cover along the kerb between the botanical portraits.
  - Pavilion: white marble inlay frames and six-pointed-star panels on the upper
    storey, chains of inlaid lozenges in the strips between bays and piers, a
    dim painted hanging in the balcony arches.
  - Guests: gold-woven hem borders on every jama (standing and seated); the
    astonished hand is a quarter larger, outlined darker, with a henna-touched
    fingertip, so the finger on the lips reads at film scale.
  - Top view: wheels are narrow opened-out bands (dark tyre, gold rims either
    side), thighs feathered white into the body with slim pink shanks, a
    smaller head with the eyes at its sides.
- **Third pass (verification fixes):**
  - Balcony: the head pitch no longer flips with the facing (before, a head
    facing left tipped *up*); in state 1 all three heads are down about 35
    degrees with lids lowered; at ease they look level over the garden.
  - Astonishment: the raised arm now lifts its elbow out in front of the chest
    with a bare forearm in skin tone and a gold cuff at the elbow, so it
    changes the silhouette; at ease the noble faces his companion and the
    attendant looks back at the scholar, so their heads visibly turn on the
    beat; standing figures lift their heads; the lute player and drummer have
    swapped places (lute player x 258, drummer x 178), so the lute player is on
    screen at u = 3 and his lute drops to the carpet.
  - Top view: rebuilt as a rider from above: dark tyre bands with gold rims
    ahead of and behind a shorter body that sits over the saddle, the frame
    line, a handlebar right across with dark grips, the wings reaching forward
    to the grips, a short neck, the head ahead of the bars with the bill over
    the front tyre, larger webbed feet on larger pedals drawn above the wings
    (the higher foot a shade larger); no thigh bars. The ripple overlay is
    lighter (0.26).
  - Side view: the pale reserve round the bird and bicycle is now a hairline
    (0.035 wheel radii).
  - Age: twice the craquelure (a dark hairline with a pale lip) and twice the
    rubbed specks; still faint.
- **Stage 5:** the English date's figures "1600" (20–24 px in the chancery
  face, whose figures sit low) are set in Palatino italic and measure 31–32 px;
  the right column's lines were re-spaced (name lines up 0.8 and 2.3 units,
  date down 2.4, its reserve riding 1 unit higher on it) so the "g" of
  "Painting" no longer touches the "C" of "CE" (about 7 px clear). The
  cartouche stays at y 468–520 and the still keeps its layout. Nothing else
  changed.
