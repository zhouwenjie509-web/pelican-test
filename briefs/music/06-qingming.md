# Music · Section 6 · 清明上河图 · Along the River During the Qingming Festival

| | |
|---|---|
| Film time | 35.0 s – 41.0 s |
| Part file | `audio/parts/06-qingming.js` (`node tools/audio.mjs --section 6 --check`) |
| Owner's brief | "Along the River During the Qingming Festival: Flute, gongs, and drums" |
| Loudness target | -18 LUFS |
| Scale | major (D E F# A B) |
| Picture | `briefs/06-qingming.md`, `src/scenes/qingming.js`; `briefs/CUES.md`, "Section 6" |

## The idea

A market day. A street band is playing when the pelican rides up the Rainbow
Bridge, and on the crown of the arch, with every head on the bridge turned
and the boat crew below craning up, the band gives it the full gong.

## Instruments

- **A bamboo flute** (dizi): bright and buzzy, because a thin membrane over
  one hole rattles with the note. Strong partials up to 5 or 6 kHz with a
  nasal buzz around 3–4 kHz, a breathy "chiff" at each start. It ornaments:
  quick grace notes from the note above, trills on long notes, crisp
  tonguing. The tune an octave up (D5 … B5; `leadOctave: 1`).
- **A small gong** (xiaoluo): its pitch rises after the stroke (two or three
  semitones in about 150 ms). Short.
- **A large gong** (daluo): its pitch falls after the stroke. About a second.
- **Cymbals**: a bright clash, choked at once.
- **A drum**: a dry high stroke that leads the others, and a deeper one.
- **A woodblock**.

Open air: almost no room (about 0.8 s, quiet).

## The three bars

| u | Picture | Sound |
|---|---|---|
| 0.0 | The pelican rides onto the bridge approach | The flute plays bar 1 with grace notes. Drum in the pedal rhythm (long, short, short), small gong on the off-beats, woodblock on the beats |
| 0.78–3.0 | It climbs the arch (steepest at about 1.9) | From 1.0 the drum thickens: a roll that grows all the way to 3.0 |
| 2.0–2.5 | The boat's crew stop work and look up | B5 on the flute; the roll continues under it |
| 3.0 | **The crown.** Every head faces the pelican | **Large gong, cymbals and both drums together, exactly on 3.0.** The flute holds E with a trill, alone after the stroke, getting softer |
| 3.75–4.24 | The crew go back to work | |
| 4.0–5.22 | Down the far side | Bar 3 of the tune, running down with it; small gong and woodblock |
| 5.22 | Level ground | |
| 5.75 | | The last note. The bell takes the D |

Declare cues at u = 0 and 3.0.

## The bicycle here

`bike: { chain: 1, bell: 1 }`.

## Hand-over

In: Section 5 was nearly silent, so your first note is a small shock: let it
be, but do not exceed your level. Out: Section 7 is a clay flute and wooden
drums. The large gong of 3.0 has died by u = 6.

## Check

- The probe on a flute note: partials at whole multiples up to several
  kilohertz, noise in the attack.
- The gongs: the small one's line bends upward after its start, the large
  one's downward.
- The stroke at 3.0 is the loudest moment of the section and stands on its
  line; nothing is louder before it.
- No voices and no crowd noise: the people are painted.

## As built

Nothing here was listened to. Everything was checked by measurement
(`--check`, `audio-probe`, `--label` stems) and by looking at the spectrogram.

**What plays** (u, seconds into the section; film = 35 + u)

| u | Sound |
|---|---|
| 0.00 | Dizi D5 (grace from E5, 32 ms, on the beat); low drum; woodblock |
| 0.25, 0.75, 1.25, 1.75, 2.25, 2.75 | Small gong on the off-beats (rising pitch, settling on D6), a little louder from 2.25 |
| 0.50, 0.75 | High drum, the two short notes of the pedal cell |
| 0, 0.5, 1.0, 1.5, 2.0, 2.5 | Woodblock on the beats |
| 0.5–1.75 | Dizi E5 F#5 A5 (grace from B5) F#5 A5 |
| 1.00 | Low drum; the high drum begins its roll: sixteenths 1.0–1.875 (accents on 1.5, 1.75), then thirty-seconds 2.0–2.9375, vel 0.25 rising to 0.9 |
| 2.00 | Dizi B5 (grace from D6), A5, F#5, a little louder; the roll continues under it |
| 3.00 | **The crown**: large gong, cymbals, low drum and high drum as one stroke on the sample; the large gong leads and rings, falling in pitch, for about 2 s (-33 dBFS at u 4.0, -51 at u 5.0, faded out by 5.6). Dizi E5 enters under it at 0.6, held flat to 3.40, grows to 0.67 by 3.82 while the gong falls (a trill with F#5, 6.5 per second, from 3.42), then fades to 0.3 by 3.96. Nothing else new until 4.0 |
| 4.00–5.75 | Dizi F#5 (grace from A5) E5 D5 B4 (grace from D5) A4 B4 at 0.65; small gong 4.25, 4.75, 5.25 and woodblock 4.0, 4.5, 5.0, 5.5, both louder than in bar 1 |
| 5.75 | Last note B4, blown 0.15 s, silent from 5.935. The bell takes the D |

Cues declared: u = 0 and u = 3.0.

**How each sound is made** (all computed in `prepare()`, about 0.17 s)

- *Dizi*: one wavetable per note from harmonics falling as 1/k^1.5, with a
  +3.5 dB formant at 3.5 kHz (the membrane) and a roll-off above 6 kHz, read by
  a moving phase so grace notes, trill and a 5-cent vibrato (only on long
  notes) are real pitch changes; a duller table crossfades into it over the
  first 40 ms; the membrane's buzz is band-passed noise at 3.4–3.6 kHz gated
  once per period; a little breath; a 35 ms chiff of noise at 2.6 kHz. 18 ms
  tongued attack with a small overshoot, 35 ms release; a note may carry a
  level shape (used for the crown's E). Probe on A5 (film 36.05, 0.4 s):
  2nd harmonic -9.6 dB, 3rd -13.0, 4th -16.5, 5th -21.3, 6th -23.8 under the
  fundamental; centroid 1156 Hz; 2–5 kHz 10.2 dB under the whole note
  (11.1 dB over the dizi's whole six seconds).
- *Small gong*: five partials from 1017 Hz whose frequency rises 2.5
  semitones (time constant 50 ms) after the stroke, so that it settles on D6
  (1175 Hz); t60 0.42 s, plus a stick tick. Track: 1101 Hz at 43 ms, D6-10
  cents at 163 ms, D6 ±3 cents from 243 ms.
- *Large gong*: twelve inharmonic partials from 140 Hz (some in beating pairs,
  the fundamental's pair 1 Hz apart), falling 1.5 semitones (time constant
  0.22 s), t60 3.5 s on the fundamental and shorter going up; the body swells
  from 0.35 to full over its first 80 ms (the bloom) while a padded-mallet
  thump carries the instant; 0.5 s fade at the end of its 2.6 s buffer.
  Track: 135.5 Hz at 43 ms, 129.5 Hz at 543 ms. Partials are placed so that
  none crosses the flute's E5 band (605–718 Hz) while it falls.
- *Cymbals*: 36 seeded inharmonic partials above 1.5 kHz and hiss above
  3 kHz, choked: gone in 0.3 s.
- *High drum*: tight skin modes at 1150 Hz (×1.59, ×2.14), t60 70 ms, with a
  loud stick click at 3 kHz. *Low drum*: modes at 92 Hz dropping from +28 %,
  t60 0.45 s, softer stick.
- *Woodblock*: modes at 1480 Hz ×2.72 ×4.1, t60 80 ms, and a click.
- The four instruments of the crown are mixed into one stereo buffer (each
  at its own pan; the cymbals at 0.75 and the high drum at 0.9 of their own
  level, the gong at 0.62) and only the top of the stroke is bent: samples
  below 0.27 pass untouched, above it a tanh knee up to 0.37. The limit
  bends the first 50 ms by -25 dB, 50–100 ms by -26 dB, 0.1–0.3 s by -32 dB
  relative, and nothing after 0.3 s (before the review: -15, -22, -33, -56).
- Room: 0.8 s, t60 0.6, send 0.12 ("open air").

**Levels**: -19.1 LUFS alone, peak -6.6 dBFS at film 38.099. The crown is the
loudest moment and stays so: 50 ms RMS -15.8 dB at 38.00, -16.7 dB over
38.05–38.30, against -19.9 dB at the downbeat. From 0.3 to 0.8 s after the
stroke the large gong's body (100–600 Hz, crown stem) is -21.3 dBFS against
the dizi's -25.4 (whole band), and above it in every 100 ms of that stretch
(+5.4, +5.4, +4.2, +3.1, +0.9 dB). Bar 3: small gong and woodblock -33.7 /
-36.0 dB RMS in u 4–5 / 5–6 against the dizi's -25.4 / -26.2 (8.3 and 9.8 dB
under); in bar 1 they stand as before (-38.1 against -23.1).

**Outro voice**: `lead` plays a plain dizi note (the same, less bright tone)
from a 1.4 s buffer made in `prepare()` for every D-major pitch from G4 to
B6, cut to `ev.dur` with a fade; `leadOctave: 1`; it uses only `ev.midi`,
`ev.dur`, `ev.vel`. A pitch outside G4–B6 would compute its buffer during
playback (review, finding 5); with `leadOctave: 1` the tune is A4–B5.
**Bike**: `{ chain: 1, bell: 1 }`.

**Unsure**: nothing was listened to. Whether the 1 Hz beating of the large
gong reads as a gong's swell or as a wobble; whether the dizi, now darker
(centroid 1156 Hz against 1935), is still "bright and buzzy" enough for the
brief (the buzz is the gated noise, unchanged); the crown's E swelling
12 % in level and then fading over its last 0.14 s. The `lead` voice could not
be heard in an outro. The large gong's phases (seed) were chosen by
measurement, for a low peak at the bloom and a full body at 0.3–0.8 s.

**Against the scene code**: none of the times this part uses (0, 1.0, 2.0,
3.0, 4.0, 5.75) conflict with `briefs/CUES.md`. The brief's "0.78–3.0 climbs"
and "3.75–4.24 crew back to work" are not given sounds; the crew look up from
u 2.00–2.50, which the B5 at 2.0 meets.

**After the review** (2026-11-18): the dizi's partials now fall as k^-1.5
(was k^-0.95) and its formant is +3.5 dB (was +7), so 2–5 kHz sits 10–11 dB
under the whole. The crown is a gong: the large gong rings longer (t60 3.5 s
on the fundamental, was 1.5), blooms over 80 ms, has a lighter mallet thump,
new partial phases and a 1 Hz fundamental beat (was 1.3), and stands at 0.62
of the crown (was 0.5), while the cymbals and high drum bring 0.75 and 0.9 of
their level to it; the tanh limit at 0.4 became a knee from 0.27 to 0.37 so
the ring is not bent. The dizi's E at the crown enters at 0.6 (was 1.0) and
grows out of the gong before it fades. In bar 3 the dizi plays at 0.65 (was
0.82) and the small gong and woodblock at 1.0 (were 0.65 and 0.7); their
levels were raised and bar 1's velocities lowered to match, so bar 1 is
unchanged. The small gong settles on D6 (1175 Hz; it began at 1040 Hz and
settled near 1207). Level -19.1 LUFS (was -18.8), peak -6.6 dBFS (was -7.0).
