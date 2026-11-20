# Section 10 · 爪哇皮影 · Javanese Wayang Kulit

| | |
|---|---|
| Date on the title | 约 1800 年 · c. 1800 |
| Film time | 59.0 s – 65.0 s |
| Code | `src/scenes/wayang.js` |
| Homage | Javanese shadow theatre: flat puppets of carved and pierced hide, worked on rods against a lamp-lit cotton screen. A living tradition with no single author. The puppets here are newly designed in that manner; no traditional character is reproduced. |

## The idea

We are on the shadow side of the screen. A sheet of white cotton glows amber
from the oil lamp behind it, brightest in the middle, browning towards the
ends. Rows of puppets stand planted at both sides, overlapping like a fan of
dark lace. Across the open middle comes a puppet nobody has seen before: a
pelican on a bicycle, cut from hide, pierced with hundreds of tiny holes, and
worked from below on thin rods that we can plainly see.

It moves the way puppets move. The body glides, but the wheels turn in
abrupt steps with a stop after each, and the legs follow in jerks.

**The highlight (bar 2):** two things every shadow master does. On the
downbeat the puppet is drawn back from the screen towards the lamp: its
shadow swells, softens and looms. On the strong beat it is slapped back
against the cloth, small and razor sharp, to the knock of the master's
mallet. Then its bill opens and shuts twice, speaking a line we do not hear.

## Materials

- **Screen.** Cotton weave, fine and slightly uneven, with a few old
  stains. Lit from behind: warm white `#fff1c4` at the hot spot, through
  amber `#f0b65a` to brown `#7a4a1e` at the far ends. The hot spot is fixed
  to the screen at about (500, 500), so it slides past as the camera tracks.
- **Flame.** The light flickers slightly: a few per cent of brightness and
  a small wander of the hot spot, on a stepped clock of about 12 Hz.
- **Shadow.** Deep brown-black `#1d120a`, never pure black, with a narrow
  warm penumbra. Sharp where the hide touches the cloth, softer where a
  part stands off it.
- **Piercing.** This is the craft. Every puppet is solid shadow cut through
  with ordered holes: rows of round dots along every edge, commas and
  scales on the body, long slits for feathers and folds, rosettes in the
  wheels. Light comes through the holes. Where two puppets overlap, only
  holes that line up let light through.
- **Hem.** A dark red-brown band along the foot of the screen,
  y 704 – 716: the ground strip. Below it the cloth continues, dimmer,
  down to the banana trunk whose soft shadow rises from the bottom edge
  (y > 762).
- **Top.** A dark valance with a line of gold along it, y 433 – 446.

## The screen

World units; the top of the ground strip is the road, y = 700.

- **x 20 – 190 and x 810 – 980: the standing puppets,** seven or eight at
  each side, tallest at the outside, overlapping, facing inwards. Slender
  noble figures in profile with long noses, tall curled headdresses, thin
  arms hanging. Design three or four types and vary them. Among those on
  the right, near x = 850, the great leaf-shaped tree-of-life figure that
  opens and closes every play.
- **x 200 – 800: empty screen.** Only light, weave and the pelican.
- **Rods.** Each standing puppet has its centre rod running down across
  the hem into the trunk.

## The pelican puppet

Built like a real one, from rigid pierced pieces pinned together, drawn on a
2D canvas with `destination-out` for the holes:

- **Body, neck, head and upper bill in one piece**, the wing carved on it
  as a spray of long slits with a border of dots; the eye a narrow cut-out
  almond with a bridge for the pupil; the crest as a small headdress curl.
- **Lower bill** hinged at the base of the bill (it opens in bar 2).
- **Legs** in two pieces each, pinned at hip and knee, with a visible rivet
  at every joint.
- **Wheels** as separate discs pinned at the hubs: a pierced rosette, a
  ring of dots inside the rim, and **one unmistakable odd mark** (a larger
  hole) so that every step of rotation can be read.
- **Frame, cranks, saddle, handlebar** as flat pierced bars.

**Rods:** a centre rod from the body straight down across the hem, bound to
the puppet with a spiral wrapping; a thinner rod from the tip of the lower
bill and one from the near foot, angling down to where a hand would be.
Thin, dark, slightly soft, always visible against the lit cloth between the
puppet and the trunk's shadow.

## Movement

The scene sets `poseHz: 10`. On top of that:

- **Wheels:** stop-and-start. They advance in sudden steps with a hold
  after each (for example a quick turn every quarter second), never
  smoothly, always forwards. Choose the step and the wheel's pattern so it
  never reads as standing still or as turning backwards, and keep the true
  average rate so the wheels do not seem to skid.
- **Legs:** follow the stepped crank.
- **Body:** glides with the pelican's true position, with a very small
  stepped rock about the rod, as a hand does.

Within 0.6 s of either crossing the puppet matches the true pose apart from
the stepping.

## The three bars

| u | |
|---|---|
| 0 – 2 | Entrance past the left-hand rank of puppets. The title plaque hangs overhead. |
| 2.0 – 2.5 | Drawn back towards the lamp: the shadow grows to about 1.7 times its size (scaled about its ground point), its edge softening to a blur of about 8 units, its darkness thinning. |
| 2.5 – 3.0 | It looms, wavering. |
| **3.0** | Slapped back onto the screen within a tenth of a second: life size, hard-edged. A ripple runs out through the cloth. |
| 3.5, 3.75 | The bill opens and shuts, twice. |
| 4 – 6 | Past the right-hand rank and the tree-of-life figure. Exit. |

The pelican keeps the standard pace. No camera move.

## Title

A plaque of pierced hide hanging from the valance on two cords at
**x 200 – 470, y 446 – 544**, with a carved scalloped border. The words are
cut through it, so they are made of light:

- 爪哇皮影, about 24 units, in a heavy face (Heiti SC or Weibei SC).
- `JAVANESE WAYANG KULIT`, about 10 units, bold capitals.
- `约 1800 年 · c. 1800`, about 10 units.

## Gallery still

`still: { u: 3.6 }`: the pelican sharp on the screen with its bill open.

## How to build it

- Bake the screen (light, weave, stains, hem, valance) and the standing
  puppets with their piercing.
- Per frame: the lamp's flicker as a multiplied tone; the pelican puppet
  assembled from its pieces on a patch; a blurred copy for the penumbra and
  for the swell; rods; all multiplied onto the screen.
- Cache the pieces (they are rigid) and only transform them.

## Sound cues (for Stage 4)

| u | Event |
|---|---|
| each wheel step | A dry tick, if wanted |
| 2.0 | The swell begins |
| 3.0 | The slap and the mallet knock |
| 3.5, 3.75 | The bill claps |

## Check on the contact sheet

- Reads at once as shadow theatre: glowing cloth, lace-like shadows, rods.
- The piercing is fine, ordered and abundant, on the pelican most of all.
- Three rods on the pelican are visible in every frame.
- Wheels step forwards and stop; they never look frozen or reversed.
- The swell and the slap happen on u = 2.0 and 3.0; at 3.0 the shadow is
  suddenly crisp.
- The camera and the puppet's travel stay perfectly smooth.
- Title made of light, legible, three parts.

## As built

- **Files.** `src/scenes/wayang.js` (screen, standing puppets, tree of life,
  title plaque, shaders, timing) and `src/rig/skins/wayang.js` (the piercing
  toolkit and the pelican puppet's pieces).
- **Screen.** One baked layer at 3.3 px/unit: lamp light ramp fixed to the
  cloth (hot spot about (500, 510)), weave (faded below 2 px/thread), water
  stains and mottling, lamp smoke above the hot spot, hem with lozenge border,
  dimmer cloth below, banana-trunk shadow, valance with gold line and tassels.
  Shadows are multiplied onto the cloth with a blurred warm penumbra.
- **Standing puppets.** Three newly designed types (refined, strong, lady),
  seven on the left (x 24 - 168) and six plus the tree of life (x 850) on the
  right (x 814 - 978), each varied in headdress height, arm hang and batik
  pattern. They are a shade lighter than the pelican (multiply factor
  84/54/36 against 33/21/14), so the pelican stays readable where it passes
  in front of them at both crossings.
- **Pelican puppet.** Rigid pierced pieces cut once and transformed: body,
  neck, head and upper bill in one; hinged lower bill and pouch; two-piece
  legs with the foot rigid on the shank; disc wheels with seven windows, one
  window left solid with a large round hole as the odd mark; frame, chainring,
  cranks. Rivets cut at hip, knees, bottom bracket, pedal and bill hinge.
  Three rods (body with a spiral binding, lower-bill tip, near foot).
- **Wheels.** Hold, then a 0.06 s turn to the true angle one step ahead, every
  0.25 s on the film's beat grid (112.5 deg per step; seven-fold pattern
  advances +9.6 deg per step, so it never reads backwards). Legs follow the
  engine's 10 Hz crank.
- **Deviation: title plaque at x 120 - 370, y 463 - 547** (arch to y 451, pendant
  to y 560; brief: x 200 - 470, y 446 - 544). At the brief's position the swollen shadow of bar 2 covers the
  plaque from u = 2.2 and the plaque is in full view only about 1.2 s; here it
  is in full view from u = 0.40 to 2.54 and clear of the swell.
- **Still:** `{ u: 3.6, cx: 670 }`, so the tree's edge frames the pelican.
- **Second pass (review).**
  - The ranks now stand "a finger's width off the cloth": multiply 116/76/45
    with a 0.3-unit softening, against the played puppet's crisp 27/17/10. The
    pelican reads over both ranks at the crossings (before, it vanished into
    them from about u -0.4 to 1.1 and 4.6 to 6.4). Overlaps still go dark.
  - Crowns of the standing puppets carry a comb of small cut flames; each
    puppet is cut a little broader or slighter (x 0.9 - 1.12).
  - Cloth: the cloudy light wobble and stains reduced; occasional thick or
    thin weft threads run across it.
  - Pelican: thicker drumstick thighs and calves, larger webbed feet, slimmer
    frame tubes, more open wheel windows (spokes 2.7 wide), a larger odd-mark
    hole (r 3.6) ringed by ten dots. The centre rod is bound at the breast
    (2, -60) and runs to (13, 106), clear of the legs and chainring.
- **Third pass (verification fixes).**
  - Title: the plaque is now a piece of pierced hide: a scalloped, hand-cut
    outline rising to a small leaf-arch, a border band of dots, teardrops and
    fine dots, rosettes beside the name, a graded-dot divider with a diamond,
    chevrons beside the date, and two twisted cords tied to the valance. Latin
    lines in Rockwell Bold (Copperplate fallback): English 13.2 units, date
    12.8, Chinese 25. Measured at 59.9 s (zoom 1.1): English capitals 31 px,
    date digits 30 px, Chinese 68 px. Horizontal extent unchanged, so the
    full-view window (u about 0.40 - 2.54) is unchanged.
  - Ranks: all standing puppets and the tree are laid into one mask (each at
    alpha 0.66) and shaded once, multiply 142/98/66 with a light warm penumbra
    (250/224/194, 0.9 units) and 0.42-unit softening: about half the pelican's
    density, overlaps deepen only a little. The pelican is the darkest, sharpest
    shape at u 0.1, 0.45, 5.45 and 5.75.
  - Swell: the swollen shadow multiplies towards warm brown (70/36/12), density
    0.74 at full swell, blur a 6.5-unit halo over a tighter core (about 2 units).
  - Slap: from u = 3.0 a ring of light (crest plus trailing trough in the lamp
    pass) runs out at 430 units/s (150 units in 0.35 s), fading with a 0.2 s
    time constant; the lamp flares by 0.2, decaying in 0.1 s. Added light is
    drawn before the puppet's shadow, so the shadow stays dark.
  - Ground: the hem (ground strip) now runs y 700 - 712 and the standing
    puppets' feet stand on y 700, the road.
  - Variety: stance (feet spread x0.8 - 1.3), near-arm gesture (hanging, held
    forward, fist on hip), headdress height (-12 % to +30 %) and plume length per
    puppet; piercing vocabulary adds chevrons, teardrops, fine dots, long slits
    of varied length, lattice crowns and a per-carver edge-row size and pitch.
    Rods taper and bow slightly (standing puppets and the pelican's three).
    Cloth weave a little stronger, lamp falloff less even.
