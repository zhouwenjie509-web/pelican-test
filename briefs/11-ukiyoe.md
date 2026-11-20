# Section 11 · 浮世绘 · Ukiyo-e

| | |
|---|---|
| Date on the title | 19 世纪 30 年代 · 1830s |
| Film time | 65.0 s – 71.0 s |
| Code | `src/scenes/ukiyoe.js` |
| Homage | Utagawa Hiroshige's landscape prints of the Tōkaidō road (1830s): colour woodblock, flat colour and graded skies, travellers under the weather. Public domain. No print is copied; the view is newly composed in that manner. |

## The idea

A colour woodblock print. A stretch of the coast road: old pines along a
raised causeway, a thatched tea house, a bay with sails, and the white cone of
Fuji beyond. Travellers on the road. A band of deep blue along the top of the
sky, graded by the printer's hand.

The pelican rides the Tōkaidō like anyone else. The title cartouche records
the view as one more in the famous series: 东海道五十三次之外, "outside the
fifty-three stations".

**The highlight (bar 2):** a sudden shower, the kind Hiroshige made his own.
On the downbeat the sky darkens from the top and the whole print is ruled
with fine slanting rain. The travellers hunch and run. On the next beat the
pelican, without slowing, produces an oiled-paper umbrella; by the strong
beat it is fully open over its head, with 鹈鹕 written on it as an inn's name
would be. The shower passes, the umbrella folds, and Fuji is clear again.

## Materials

- **Paper.** Soft cream washi with visible fibres.
- **Key block.** Black line of slightly varying width, cut, not drawn:
  crisp, with small angular turns and tapered ends. Everything has its
  outline.
- **Colour blocks.** Flat, few, and a little out of register with the key
  line (each colour shifted by up to a unit, differently). Wood grain shows
  faintly in the broad areas. Palette: Prussian blue `#1f4e8c`, a paler
  blue `#7ea6c9`, indigo-grey `#55606e`, green `#5d8a5a`, a dark green
  `#2f5a44`, yellow ochre `#d9b25f`, rose-red `#c9584a`, a warm grey, and
  the black of the key block.
- **Gradation (bokashi).** The printer's wiped gradients: the straight band
  of deep blue along the top edge fading downward; pale rose low in the
  sky; blue deepening towards the near edge of the water; a soft grey
  shadow at the foot of Fuji.
- **Rain.** Printed from its own block: long, thin, straight grey-black
  lines in two sets at slightly different slants (about 72° and 76°),
  crossing the entire picture.

The print is flat. Do not use parallax: the whole view moves as one sheet.

## The view

World units; the crown of the causeway is the road, y = 700.

- **Sky, y 433 – 628:** the blue band at the top (433 – 470), paper in the
  middle, rose towards the horizon.
- **Fuji:** at about x = 650, summit near y = 500, white cap with three
  notches, pale blue-grey flanks.
- **Sea:** horizon at y ≈ 628; three or four white sails; a low headland at
  the left.
- **Far side of the road:** rice fields and a strip of beach; the tea house
  at x ≈ 780 – 900 with a thatched roof, an open front, a bench, a paper
  lantern and a short curtain over the door.
- **Pines:** five or six along the far edge of the causeway, at uneven
  intervals, trunks leaning and twisted, bark marked with short key-line
  strokes, crowns in flat layered pads of two greens with needle strokes,
  reaching up to y ≈ 450. The pelican passes in front of the trunks.
- **Causeway:** ochre road surface y 700 – 742, a grassy bank below with
  hatching, a stone mile-marker.
- **Travellers:** a palanquin with two bearers near x = 300, heading left;
  a pilgrim in a wide sedge hat with a staff near x = 620, heading right; a
  farmer in a straw cape by the tea house. Small, about 100 units tall,
  faces a few lines.
- **Margin details:** a thin black border line; a small red gourd-shaped
  seal reading 鹈斋 near the lower left, in the place of an artist's
  signature (an invented name).

## The pelican

Key line and flat colour, slightly out of register like everything else, on a
2D canvas patch: body left the colour of the paper with a pale grey
gradation under the belly; bill yellow shading to rose at the tip; pouch
ochre; legs rose-red; flight feathers black; bicycle indigo with black
tyres.

**The umbrella** (bar 2): a Japanese paper umbrella seen from the side: a
shallow dome of ochre panels with a dark ring near the edge, fine ribs, a
bamboo shaft, held up by the near wing (which leaves the handlebar; the
pelican rides one-handed). 鹈鹕 in black on one panel. It opens in three
drawn states (shut, half, open) and closes the same way.

## The three bars

| u | |
|---|---|
| 0 – 2 | Fair weather. In past the first pines; the title cartouches at the upper left; the palanquin goes by. |
| **2.0** | The shower arrives: a grey gradation wipes down from the top edge within 0.4 s and the rain lines appear. |
| 2.5 | The umbrella comes up, shut; half open at 2.65; |
| **3.0** | fully open. The rain is at its heaviest. The pilgrim is running with his hat held down. |
| 4.6 – 5.2 | The rain thins and stops; the grey lifts. |
| 5.0 – 5.3 | The umbrella folds and is gone. Both wings as normal by u = 5.4. |
| 6.0 | Out past the tea house, Fuji clear behind. |

Travellers move in two or three held drawings each, changed about six times a
second: prints do not move smoothly. Rain is shown by shifting between three
slightly offset prints of the line block at about 12 Hz. The pelican keeps the
standard pace, and its own motion stays smooth.

## Title

Three cartouches at the upper left, **x 205 – 332, y 446 – 558**:

- A tall red-bordered slip at x 302 – 332: 浮世绘 reading down, about 22
  units.
- A yellow label to its left, x 205 – 296, y 446 – 522: 东海道 and
  五十三次之外 in two columns, about 11 units.
- A small strip beneath, y 528 – 558: `Ukiyo-e` and
  `19 世纪 30 年代 · 1830s`, about 10 units.

Lettering in a brush-like regular script (Kaiti SC); black on colour, with
the same slight misregistration.

## Gallery still

`still: { u: 3.3 }`: the umbrella open in the rain.

## How to build it

- Draw each colour block and the key block separately on 2D canvas, offset
  them slightly, and combine with a paper and wood-grain pass, baked. Bake
  the fair-weather print once; the shower is extra layers (grey gradation,
  rain lines) with an opacity driven by `f.u`.
- Per frame: travellers in their current drawing, rain, the pelican, the
  umbrella.

## Sound cues (for Stage 4)

| u | Event |
|---|---|
| 2.0 | The shower starts |
| 2.5 | Umbrella up |
| 3.0 | Umbrella open (strong beat) |
| 5.0 | Umbrella folds; rain has stopped |

## Check on the contact sheet

- Reads as a woodblock print: key line, flat colour slightly out of
  register, wiped gradients, grain, paper.
- The composition is a landscape first: Fuji, pines, sea, road.
- No part of the view slides against another.
- Rain covers the whole picture from u = 2.0 and is gone by 5.2.
- The umbrella is shut, half open and open at the three given times, and
  the pelican is back on both grips by u = 5.4.
- Title cartouches legible, three parts.

## As built

- **Print.** One baked sheet (x −70 … 1070, y 418 … 802, 3.3 px/unit) printed block by block on 2D canvas (`printBlocks`): pale blue, rose, ochre, warm grey, green, dark green, indigo, Prussian blue, then the key block. Each block is multiplied onto cream paper, shifted 0.6 – 1.4 units off register (just visible at 1080p), and has a periodic wood-grain / ink-starvation tile removed from it at 0.4 – 0.52. Objects nearer the viewer knock out the blocks behind them. Key lines are cut ribbons (`cut()`): short straight runs, a slow swell and a quicker flutter in width (±40 %), tapered ends. Washi (mottle, fibres, browned margins, foxing) is laid over the whole frame.
- **View, back to front.** Blue band and rose horizon (bokashi), bars of mist (pale blue wiped, rose underside) in the open sky, a far skein of geese, Fuji (x 418 – 884, summit 501, three-notched summit, snow cap ending in irregular tongues: long ones down the gullies, stubs, some forked; grey shadow at the foot), far shore, headland at the left, sea with Prussian bokashi, four boats with paper sails, beach, paddies, shore hamlet, the tea house (x 764 – 920), road (ochre wiped darker to the near edge, grey bokashi, cart ruts, pebbles; a pair of cast-off straw sandals at x 318 – 326, another at 642, fallen needles under the pines), mile-marker (x 156), six pines each with its own height (168 – 262), lean, limb heights and pad scale (the short pine at x 548 sends all its limbs left), grassy bank with small rose and white wild flowers, stone facing, cartouches, gourd seal 鹈斋 (x 48, y 744 – 771), border line.
- **Title.** Three cartouches, x 158 – 332 (174 units), y 444 – 566: yellow label (x 220 – 296) with 东海道 (15.5 units) and 五十三次之外 (12.2) in two columns; red-bordered slip (x 301 – 332) with 浮世绘 (21.5 units, measured 62 px tall at zoom 1.1); strip beneath (x 158 – 332) with `Ukiyo-e` (16 units) and `19 世纪 30 年代 · 1830s` (15.5 units), Kaiti SC. Measured on a full-size frame at zoom 1.1: capitals and digits 33 px tall. The label's earlier signature 鹈斋画 and its seal were dropped (the gourd seal signs the print). The cartouches are printed a second time on their own (`bakeTitle`, cut to their outlines) and laid over the storm grey and the rain in every frame, so they keep full contrast through the shower. In full view at zoom 1.1 from u ≈ 0.17 to 2.73.
- **Shower.** A second baked print without Fuji and the far shore (Fuji only a faint indigo silhouette with no key line), with puddles on the road, is cross-faded in fully from u 2.05 – 2.6 and out 4.7 – 5.2, so Fuji's key line fades with its colour. The grey storm gradation is one continuous gradient, repainted each frame on a thin column with a soft (70-unit) mask edge that moves continuously as it wipes down from the top edge, u 2.0 – 2.4; it lifts 4.6 – 5.2 and lies over the travellers and the pelican. Rain: two baked line tiles (period 420 units), evenly spaced lines of even length, 72° set 440 lines, 0.34 – 0.4 units wide, grey-black at 0.5 – 0.6; 76° set 340 lines, 0.3 – 0.35 wide, bluer and lighter at 0.36 – 0.44; each at one of three offsets chosen at 12 Hz; 72° set 2.0 → 5.2, 76° set 2.06 → 4.95.
- **Pelican.** Per-frame canvas skin: key line and offset flat colour, a wood-grain tile anchored to the pelican laid over its colours at 0.5. The near wing is the scene's own drawing (`nearWing`, `drawWing`, `drawHands`). At rest it is exactly the rig's folded wing. Raised, the wing stays folded along the body with its black primaries lying back over the tail as a wingtip, and only the wrist swings up about the shoulder to the front of the breast; three black hand feathers with paper quills lie across the front of the shaft, their tips past it. Lift runs u 2.22 → 2.5 (accelerating, arriving on 2.5) and down 5.14 → 5.4. The shaft is drawn over the breast and neck and leans back 0.3 rad, passing about 9 units behind the back of the head. The rig is always solved with `wing: 0`.
- **Umbrella.** Produced from 2.22 lying back along the bird's back, swung up shut with the wing, up and shut at 2.5; half open 2.65 – 3.0; open 3.0 – 5.0; half 5.0 – 5.15; shut 5.15 – 5.3 (tucked behind the bird from 5.2, where it fades out as one piece, 5.2 → 5.3); gone at 5.3. It is produced out of the hand, grip first and tip last, over 2.22 – 2.3 (a clip that grows along its length), and is whole from 2.3. Open: a rounded dome of ochre oiled paper (R 47, depth 29), 12 panels across the near half with alternate panels a shade darker and cut seams, rib ends standing proud of a rim that sags between them, a narrow dark ring, a light underside with the fan of ribs to the runner, and 鹈 over 鹕 (11 units) written down one panel. Wing back on the grip and pose standard by 5.4. Neck tucks slightly 2.05 – 5.35.
- **Travellers.** Baked sprites in held drawings on a 6 Hz clock (position stepped too). Palanquin heading left at 60 units/s, meeting the pelican at u ≈ 0.8 (x ≈ 133), clear of it from u ≈ 1.35; from u 2 the bearers trot (85 units/s, longer stride, more lean) out of the picture. The two bearers differ (front: shaven pate and topknot; rear: headband), lean into the load, and their jacket tails and loincloth ends flap differently in each drawing. Pilgrim heading right, runs 2.0 – 3.6 with his hand over the hat brim and his skirt flying, then waits at x 750 by the end of the tea-house eave until 5.4. Farmer in a straw cape stands at x 704, left of the tea house, hunched into the cape 2.0 – 5.3, so the road in front of the tea house is open while the umbrella folds.
- `still: { u: 3.8 }` (umbrella open in the rain, the pelican clear of every pine, the travellers and tea house ahead). No `motion`, `camera` or `road` overrides; no parallax.

**Stage 5.** (1) The umbrella's exit: from 5.2, tucked behind the bird, it fades out as one piece over the tenth of a second to 5.3, instead of standing up behind the head unheld and vanishing (`umbrellaFrame` `fade`, applied in `paintPelican` with a `destination-out` pass before the body is drawn). The fold to shut at 5.15 is unchanged. (2) The umbrella's entrance: it comes out of the hand over 2.22 – 2.3, grip first (`umbrellaFrame` `reveal`, `revealClip`); its drawings from 2.3 on (2.5, 2.65, 3.0) are unchanged. (3) The pilgrim and the farmer still overlap about u 2.9 – 3.4: getting the pilgrim past the farmer before 2.8 by his timing alone needs either a run 2.4 times his pace from 2.0 (faster than the bicycle) or a run started at u 0.8, out of sight, which takes him off the screen from 1.6 to 2.6 and loses his break into a run on the 2.0 downbeat; tried and taken back, left as it was. (4) Title measured at zoom 1.1 (film 66.0 s): 浮 62 px; `U` 34 px; digits 33 – 36 px. All above the rule; unchanged.
