# Music · Section 7 · 玛雅手抄本 · Maya Codex

| | |
|---|---|
| Film time | 41.0 s – 47.0 s |
| Part file | `audio/parts/07-maya.js` (`node tools/audio.mjs --section 7 --check`) |
| Owner's brief | "Maya: Ceramic flute and wooden drums" |
| Loudness target | -20 LUFS |
| Scale | major (D E F# A B) |
| Picture | `briefs/07-maya.md`, `src/scenes/maya.js`; `briefs/CUES.md`, "Section 7" |

## The idea

A scribe is counting the turns of the pedals in bars and dots, one number to
a page, one page to a second: 38, 39, 40, 41, 42. The drummer plays exactly
what the scribe paints. Forty is written with a shell, and it sounds like one.

## Instruments

- **A clay flute** (an ocarina-like vessel flute): almost a pure tone, a
  little breath round it, a soft "chiff" at the start, and each note scooped
  up into from just below. Slightly unsteady. The tune an octave up (D5 … B5;
  `leadOctave: 1`).
- **A slit drum** (two wooden tongues): two mellow hollow pitches a fourth or
  fifth apart (near D3 and A3), each about a third of a second, struck with
  soft-headed sticks.
- **A tall skin drum**: one low stroke on each bar line.
- **A turtle shell** struck with an antler: dry, hollow, bony, very short.
- **A seed rattle**, lightly, on beats 2 and 4.
- A small stone room, about 1.0 s.

## The numbers

Each stroke of paint is a stroke of sound. Bars are the slit drum's low
tongue, dots its high tongue, and the dots in the twenties place the tall
drum's rim, softer.

| u | What is painted | Sound |
|---|---|---|
| 1.00, 1.08, 1.16 | 38: three bars | low tongue ×3 |
| 1.24, 1.30, 1.36 | three dots | high tongue ×3 |
| 1.46 | one dot in the twenties | rim |
| 2.00, 2.08, 2.16 | 39: three bars | low tongue ×3 |
| 2.24, 2.30, 2.36, 2.42 | four dots | high tongue ×4 |
| 2.52 | one dot in the twenties | rim |
| **3.00** | **40: the shell** (drawn over 0.15 s) | **the turtle shell, once, alone and clear** |
| 3.17, 3.23 | two dots in the twenties | rim ×2 |
| 4.00 | 41: one dot | high tongue |
| 4.10, 4.16 | two dots in the twenties | rim ×2 |
| 5.00, 5.06 | 42: two dots | high tongue ×2 |
| 5.16, 5.22 | two dots in the twenties | rim ×2 |

## The three bars

The flute plays the whole tune straight through, on its beats; it does not
stop for the scribe. Under it the tall drum marks u = 0, 2 and 4, and the
numbers fall as above. At 3.0 the flute's held E begins with the shell, and
for that one beat nothing else sounds.

Declare cues at u = 0, 1.0, 2.0, 3.0, 4.0 and 5.0.

## The bicycle here

`bike: { chain: 1, bell: 1 }`. Each page is one turn of the pedals: the
chain's four ticks are the scribe's ruler.

## Hand-over

In: Section 6's band stops on the bar line. Out: Section 8 is a sitar and
tabla.

## Check

- The probe on a flute note: the fundamental 20 dB or more above every other
  partial; a pitch that begins a little flat and settles within 60 ms.
- In the picture the number strokes are thin marks at exactly the listed
  times; count them: 7, 8, 1 (+2), 3, 4.
- The shell at 3.0 stands alone.

## As built

- **Clay flute** (`flute`, also the `lead` export, `leadOctave: 1`): nodes. An
  oscillator that is almost a sine (harmonics 2, 3, 4 at -33, -38, -48 dB;
  measured 2nd harmonic -32 dB under the fundamental); each note starts 35
  cents flat and settles with a 13 ms time constant (probe: -16 cents over the
  first 30 ms, within 1 cent by 40-60 ms); a per-note error of up to ±3 cents;
  a 4.6 Hz vibrato of 7 cents arriving only on the half-beat and longer notes;
  breath as band-passed pink noise (centre 2.2 × f, max 2.4 kHz) that leaves
  just before the tone; a 30 ms "chiff" in a narrow band at the 3rd harmonic.
  Attack 28 ms, release 45 ms, a 12 ms tongued gap before the next note. The
  whole tune, octave 1 (D5 … B5, ending B4 A4 B4); the last note is cut to
  0.215 s so it is silent by u = 5.953.
- **Slit drum**: computed buffers (`modal`). Tongue modes 1, 2.9, 6.3 × f
  (t60 0.35, 0.12, 0.04 s), a faint box mode on A2 (110 Hz; 112 Hz on the second variant), a 6 ms low-passed
  thud of a soft stick. Low tongue D3, high tongue A3; two variants each.
  Measured: 20 dB down after about 0.1 s, T60 about 0.3 s.
- **Tall drum**: computed buffer. Membrane modes 1, 1.59, 2.14, 2.30 on D2
  (73 Hz), pitch falling 12 % in the first 40 ms, plus a palm slap (noise at
  600 Hz). u = 0, 2, 4.
- **Rim**: computed buffer. Modes near 820, 1930, 3150 Hz (t60 60 ms or less)
  and a 3 ms tick. Every dot in the twenties place.
- **Turtle shell**: computed buffer. A cavity mode at 431 Hz and plate modes at
  1187, 1693, 2561, 3817 Hz (t60 90 ms down to 25 ms), and a hard click at
  4.2 kHz. Measured peak -11 dBFS alone, 20 dB down in 32 ms. Once, u = 3.0.
- **Seed rattle**: computed buffer. 110 seed impacts (decaying 3-6.5 kHz
  sines, 6 ms) in a burst that peaks about 20 ms in, plus a little hiss.
  u = 0.5, 1.5, 2.5, 3.5 (softer), 4.5, 5.5.
- **Room**: one 1.0 s stone room (t60 0.9, early reflections 0.55), send 0.2.

Times, exactly as the table above: low tongue 1.00 1.08 1.16, high 1.24 1.30
1.36, rim 1.46; low 2.00 2.08 2.16, high 2.24 2.30 2.36 2.42, rim 2.52; shell
3.00, rim 3.17 3.23; high 4.00, rim 4.10 4.16; high 5.00 5.06, rim 5.16 5.22.
Cues declared at u = 0, 1, 2, 3 (band 2-9 kHz), 4, 5; all measured within
5 ms.

From u = 3.0 to 3.5 only the flute's E and the shell sound, apart from the
two soft rim strokes at 3.17 and 3.23, which the table asks for (the
twenties of forty). "Nothing else sounds" was read as: no tall drum, no slit
drum, no rattle in that beat.

Level -20.0 LUFS alone, peak -7.4 dBFS, 50 events, at most 34 sources alive.

Unsure: nothing was listened to. The slit drum's strokes are mellow, so in the
spectrogram they show mainly below 1 kHz; the rapid 0.06-0.08 s strokes of a
number overlap in their ring. The breath level is a guess.

**After the review.** The reviewer found nothing to fix. One thing was changed by the music director by hand: the slit drum's box mode was on G2 (98 Hz), a note outside the tune; it now sits on A2 (110 Hz). The check still ends "Nothing out of tolerance." (-19.8 LUFS with the bicycle, lead notes within 4 cents).
