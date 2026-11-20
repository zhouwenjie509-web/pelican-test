# Section 1 · 撒哈拉岩画 · Saharan Rock Art

| | |
|---|---|
| Date on the title | 约公元前 4000 年 · c. 4000 BCE |
| Film time | 5.0 s – 11.0 s (bars 3–5 of the film) |
| Code | `src/scenes/sahara.js` |
| Homage | The pastoral ("Bovidian") paintings of the Tassili n'Ajjer, Algeria. Prehistoric, anonymous, public domain. No single panel is copied; the herd, the herders and the dotted rows are drawn fresh in that manner. |

## The idea

A sandstone wall under a rock shelter, painted six thousand years ago: long-horned
cattle walking in file, the people who keep them, rows of finger dots. The
pelican is one more painting on the same wall, the newest, and the only one
with wheels.

**The joke (bar 2):** every painted head turns to watch it go by. The cattle
stop nodding, lift their necks and follow it; the herders turn, and an arm
goes up. Nobody in the picture has seen a wheel before, and the film does not
remark on it.

## Materials

- **Ground.** Bedded sandstone, generated in a shader anchored to the wall:
  thin and thick strata that bend, warm desert varnish in broad stains, pits,
  hairline cracks. It must look like stone before any paint goes on.
- **Pigments.** Five only, all earth: red ochre `#7c2b16`, burnt ochre
  `#4b190d`, yellow ochre `#b87a2b`, kaolin white `#efe3cd`, and an older,
  nearly vanished red `#a26a4c`. No black line, no blue, no green.
- **Tools.** A finger loaded with wet paint (soft, full, slightly uneven
  line) and a frayed stick used nearly dry (broken, sandy line). Shapes are
  filled flat and then outlined, or left as silhouettes.
- **Age.** Paint sits in the grain of the rock. A last pass shows bare stone
  through every painted mark, heaviest where a slab has flaked. An older,
  fainter layer of figures lies under the herd.

## What is on the wall

World units; the road is at y = 700, the section runs x = 0 … 1000.

- **Upper band, y ≈ 470 – 640:** six cattle walking right in overlapping
  file, each a different coat (red, white with red outline and spots,
  red-and-white patched, yellow, dark). Long lyre horns. Legs are simple
  tapering strokes, two per pair.
- **Four herders** among them: wedge-shaped torsos, stick limbs, round heads
  with a tuft. Two carry staffs; two are children.
- **Dotted rows** along the top and bottom of the wall, in two colours.
- **Old layer:** a few long-necked antelope from an earlier age, almost gone.
- **The road:** one dark painted ground line with a thinner red line under it.
- **The title** is painted on the wall in red ochre at the upper left, in the
  same pigment and with the same wear as everything else.

## The pelican

Painted like the white cow: a kaolin body and neck with a thin red outline, an
ochre bill and pouch, dark tail and flight feathers. The bicycle is dark ochre
line, wheels as plain rings with a few thin spokes. Same rig and same pose as
every other section; only the paint changes.

## The three bars

1. **Entrance.** The pelican comes through the frame from the intro's paper
   onto the rock. Title at upper left. The herd is walking: heads low, nodding.
2. **The joke.** As the pelican draws level, each animal notices in turn (a
   small stagger, left to right): neck up, head swung round to look back over
   the shoulder, then forward as the pelican passes. Herders turn their heads;
   one arm goes up. The camera only tracks.
3. **Exit.** All heads now point right, following it to the next frame.

Animation is smooth here (no stepped frame rate): only heads, necks and one
arm move, and the rest of the wall is still, as paint should be.

## How it is built

- The wall, bodies, signs, road and title are painted once into a cached
  layer (about 3.3 px per unit). A second cached layer holds the wear.
- Each frame draws the wall, then the moving heads and the pelican with
  p5.brush, then the wear on top.
- Marks are grouped by colour before drawing. p5.brush composites once per
  colour change, so painting "all the red, then all the white" is five passes
  where painting figure by figure was sixty.
- Who looks, and when: `attentionAt` ramps over 80 units of the pelican's
  travel. The herders begin to notice 330 units ahead of the pelican (less a
  per-figure delay of up to ±30); the cattle begin 163.3 units ahead
  (`CATTLE_LEAD`, a delay of up to ±35), so each animal's neck starts to
  rise 157 to 236 units ahead of the pelican, in plain view: at u 2.62
  (x 596), 2.94 (668), 3.20 (722), 3.67 (806), 4.24 (846) and 4.72 (the calf
  at 918), each over 0.48 s. Every head swings forward as the pelican passes
  it and all face the exit by u 5.9.
- Herders: x 168 (staff, feet y 612), x 214 (child, feet y 563), x 505 (white,
  staff, feet y 563; his free arm goes up, towards the pelican's side, not
  down across the title), x 956 (facing left, feet y 563, up among the herd
  in front of the calf). Nothing of the last three is below y 563, so the
  pelican's head (top at about y 572) passes under them, never through them.

**Stage 5.** On the director's rulings: (1) the cattle look up one second
later (`CATTLE_LEAD`), so the lift is seen; the herders' timing is unchanged
and the six taps in the sound moved by the same second. (2) The white
herder's raised arm (`armUp`) now points up and to the pelican's side and
stays clear of the date line. (3) The child at x 214 and the white herder
at x 505 were raised from feet y 618 and 606 to 563. (4) The herder at
x 956 was lifted from feet y 660 to 563, among the herd (feet at the
cattle's line, y 596, was tried first: his staff and legs then stood behind
the pelican's head and bill at the exit). The title, the cattle and every
other figure are as they were; the still (u 4.4) shows four heads up.

## Check on the contact sheet

- Reads as paint on rock, not as a drawing on paper: grain shows through.
- No colour outside the five pigments.
- Title legible at 1080p (Chinese, English, date).
- In bar 2 at least four heads are visibly turned toward the pelican.
- The pelican is not hidden by the herd at any time and is clearly a pelican.
- At both frame crossings the half inside this picture is in rock paint.
