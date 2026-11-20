# Music · Section 10 · 爪哇皮影 · Javanese Wayang Kulit

| | |
|---|---|
| Film time | 59.0 s – 65.0 s |
| Part file | `audio/parts/10-wayang.js` (`node tools/audio.mjs --section 10 --check`) |
| Owner's brief | "Wayang Kulit: Gamelan" |
| Loudness target | -19 LUFS |
| Scale | slendro: `s.theme({ scale: "slendro" })` (five nearly equal steps above D) |
| Picture | `briefs/10-wayang.md`, `src/scenes/wayang.js`; `briefs/CUES.md`, "Section 10" |

## The idea

A shadow play, with its orchestra behind the screen. In bar 2 the puppeteer
draws the pelican back towards the lamp, so that its shadow swells and
wavers over the cloth, and then slaps it flat against the screen on the
strong beat with a knock of his mallet. The gamelan follows his hand, as it
does in a real performance.

## Instruments

A small Javanese gamelan, in slendro. Every pitched instrument uses the five
slendro steps and their octaves, not the piano's notes.

- **Saron**: bronze bars, bright, struck with a wooden mallet. The tune. Each
  new note damps the one before, so notes do not run together.
- **Peking** (the smallest saron, an octave higher): plays each tune note
  twice, twice as fast.
- **Slenthem** (low bars, soft mallet): the skeleton notes, an octave below.
- **Bonang** (small kettle gongs): mellow, pitched; light figures that
  anticipate the tune.
- **Kenong** (a large high kettle), **kempul** (a hanging gong, mid-low),
  **gong**: the punctuation. A deep gong on u = 0 (keep its ring to about
  3 s), a kempul on 2.0, the gong again on 3.0, kenong on 4.0.
- **Kendang** (hand drum): low open strokes and high slaps; it leads.
- **Gender**: thin bars over tube resonators, a soft shimmer.
- **The puppeteer's sounds**: the **mallet** on the wooden chest (a deep
  hollow knock) and the **bronze plates** he kicks (a bright metallic clash).

Bronze bars ring with partials near 1, 2.76 and 5.4 times the note; kettles
and gongs have a clear octave partial, and the big gong beats slowly (a
pair of fundamentals one to three hertz apart).

A pavilion open at the sides: about 1.2 s.

## The three bars

| u | Picture | Sound |
|---|---|---|
| 0.0 | The pelican's shadow rides onto the screen | Gong. Saron plays bar 1, peking doubling, slenthem on the skeleton, bonang and kendang |
| every 0.25 s | The puppet's wheels turn in steps | A very light tick of the bronze plates on each step, like the puppeteer keeping time |
| 2.0–2.5 | **The swell**: the shadow grows to 1.7 times its size and softens | Kempul on 2.0, then the orchestra hushes: gender shimmer and a soft, growing kendang roll. The saron plays the tune's B, A, F# quietly |
| 2.5–2.93 | It looms and wavers | The roll and the shimmer swell and waver |
| 2.93–3.0 | The slap | |
| **3.0** | **The shadow is crisp at life size; the lamp flares** | **Mallet knock and the bronze plates, with the gong, on 3.0.** Saron and peking strike the tune's E, loud |
| 3.0–4.0 | A ripple of light runs out through the cloth | A quick bonang figure running away and dying |
| 3.50, 3.75 | The bill claps twice | Two dry knocks of the mallet, small |
| 4.0–5.75 | Riding on | Kenong on 4.0. Everyone: bar 3 of the tune. The bell takes the D |

Declare cues at u = 0, 3.0, 3.5 and 3.75.

## The bicycle here

`bike: { chain: 0, bell: 1 }`: the bronze plates do the ticking.

## The lead

Export the saron as `lead`. It takes any pitch: the outro will ask it for
the major scale. `leadOctave: 0`.

## Hand-over

In: Section 9's single flute. Out: Section 11 is a shamisen. Your gongs have
died to -50 dBFS by u = 8: the gong on 3.0 has five seconds, which is enough
if its ring is about 3 s.

## Check

- Lead notes measure in tune against slendro (the checker uses the
  fractional pitches from your events).
- The probe on a saron note shows partials near 2.76 and 5.4 times the note,
  not at whole multiples.
- The picture: a hush from 2.0, a swell to 2.93, and the hardest mark of the
  section on 3.0.

## As built

Nothing here has been listened to. Everything was checked by measurement
(`--check`, `audio-probe`) and by looking at the spectrogram.

**What plays** (u in seconds; slendro pitches are D4 + 0, 2.4, 4.8, 7.2, 9.6 semitones):

- **0.0 – 2.0.** Gong (D2) on 0. Saron plays the tune (D E F# A F# A in
  slendro). The peking plays each note twice, an octave up, 7 ms behind the
  saron. The slenthem plays the skeleton an octave down, 12 ms behind. The
  bonang anticipates on the sixteenths before 1.0 and 2.0 (A5 at 0.625 and
  0.875, B5 at 1.625 and 1.875). Kendang pattern per bar: dhung 0, tak 0.5,
  ket 0.75, dhung 1.0, ket 1.25, tak 1.5, tak 1.75. Everything in bars 1 and
  3 (0 – 2.0 and 4.0 – 6.0) is played 1.12 times (+1 dB) the velocities
  given here; bar 2 is not.
- **Every 0.25 s.** A very light tick of the bronze plates (about -36 dBFS
  peak), 21 of them. None at 3.0, 3.5 or 3.75, where louder strokes land.
- **2.0 – 2.93.** Kempul (B2, slendro) on 2.0 (vel 0.5). The orchestra
  hushes: the saron plays B, A, F# quietly (vel 0.4), the peking stops and
  the slenthem's B3 is very soft (vel 0.15). A gender shimmer (13 soft strokes
  every 1/16 s from 2.0625, on A5, E5, D5 and F#5, growing from 0.05 to 1 of
  a low level) and a kendang finger roll (18 strokes, from 2.08, accelerating
  from 75 ms to 36 ms apart) both grow from 2.0. From 2.5 both waver at 2.1 Hz, the rate
  at which the shadow breathes. The gender is damped by 2.93 and the roll's
  last stroke is at 2.885, so 2.93 – 3.0 is nearly silent (about -34 dB).
- **3.0.** The mallet on the chest (big knock), the bronze plates (+5 ms, the
  foot), the gong, the saron's E (its loudest note, vel 0.85 against 0.56 –
  0.7 elsewhere), the peking's E (+7 ms, struck once and held, not twice),
  the slenthem's E3 and a kendang dhung (+12 ms). This is the peak of the
  section (-6.3 dBFS at 3.029).
- **3.06 – 3.94.** The bonang "ripple": 12 strokes on a 1/16 s grid. They
  alternate above and below the E and move further away each time
  (F#5, D5, A5, B4, B5, A4, D6, F#4, E6, E4, F#6, D4). They get quieter by
  0.82 each stroke and pan wider. No stroke falls on 3.5 or 3.75.
- **3.5, 3.75.** Two small dry knocks of the mallet.
- **3.875.** A kendang tak leads into bar 3.
- **4.0 – 5.75.** Kenong (F#4) on 4.0. Saron, peking, slenthem and kendang
  play bar 3 (F# E D | B3 A3 B3); the slenthem's B2 on 5.0 sits 15 ms
  behind the saron, not 12. The bonang anticipates B4 (4.625, 4.875)
  and the bell's D5 (5.625, then a very soft 5.875 that is damped after
  90 ms). The saron's last B3 rings 0.6 s and fades; nothing starts after
  5.882.

**How each sound is made** (every sound is a buffer computed in `prepare()`):

- Saron, peking, slenthem, gender: bronze bars built as sums of decaying
  partials at 1, 2.76 and 5.4 times the note. The upper partials die 3 and
  10 times faster, and a second fundamental 0.9 – 2.2 Hz away gives a slow
  beat. Saron and peking also have a short band-passed noise click from the
  wooden mallet. Slenthem and gender use a padded mallet: a 6 ms onset, no
  click and weak upper partials. The probe found a saron A at 444.9 Hz with
  its partial at 1228 Hz (2.76 times) and a weak one at 2402 Hz (5.4 times).
- Bonang, kenong, kempul, gong: kettles and gongs. Each has a fundamental
  with a beating partner (pair levels 0.2 / 0.3 / 0.45 / 0.6, and 0.9 / 0.7
  / 1.1 / 1.6 Hz apart), a clear octave partial (2.004 times) and a few
  inharmonic modes, plus a dull thump from the beater. The gong's modes are
  2.3, 2.92, 3.7 and 4.8 times the note (amplitudes 0.32 – 0.34, ringing
  0.5 – 0.65 of its t60 of 3.0 s), with their starting phases spread so that
  they do not add their peaks at the stroke; its thump is small (0.06). The
  probe on the gong alone (59.2 – 60.2) reads a body of -29.0 dBFS rms, the
  D2 at 73 Hz with its beating partner, the octave at -12.5 dB and the upper
  modes at 169 Hz -13.0, 214 Hz -15.0, 272 Hz -17.1 and 352 Hz -18.3 dB. The
  part alone is at -157 dBFS from u = 7.75.
- Kendang: round-membrane modes (1, 1.59, 2.14, 2.65), with a small pitch
  fall and a band-passed noise burst for the hand. Four strokes: dhung
  (84 Hz, open), tak (390 Hz, slapped), ket (330 Hz, closed) and finger (the
  roll).
- Mallet knock: the box's air mode (118 Hz, big knock) or 150 Hz (small),
  short wooden lid modes from 236 Hz to 2 kHz, and a hard contact click.
- Bronze plates: three thin plates (980, 1190, 1440 Hz) with ten crowded
  inharmonic modes each, struck 2 – 8 ms apart, with a rattle of four short
  noise bursts where the plates touch. A wheel tick is one plate barely
  touched: only its modes between 2 and 9.5 kHz, about 0.1 s long.
- Room: one reverb, the pavilion, 1.2 s (t60 1.0), at a send of 0.16.

**Cues declared:** 0 (gong), 3.0 (slap), 3.5 and 3.75 (the small knocks,
measured in the band 2.5 – 6 kHz).

**Bike:** `{ chain: 0, bell: 1 }`. **Lead:** `saron`, `leadOctave: 0`. The
major-scale pitches from D3 to C#6 are prepared ahead.

**Choices and doubts.**

- The peking strikes the held E once, not twice. A second E at 3.5 would
  land on the bill's first knock.
- Several players sit a few milliseconds late on purpose: peking 7 ms,
  slenthem 12 ms (15 ms on 5.0), the dhung on 3.0 12 ms, the plates on 3.0
  5 ms. This keeps the peak under -6 dBFS and sounds like several players,
  not one.
- The dhung on 0 and the saron's first D are a little softer (0.6 / 0.56),
  so that the bell can sit on top of them. With the bike the peak is
  -6.3 dBFS.
- The section's level is -19.8 LUFS, 0.8 LU under the target, with the
  peak at -6.3 dBFS (3.029) alone and with the bike. More lift in bars 1
  and 3 puts the peak on 5.0 over -6.
- The gong and the kempul are tuned to slendro D2 and B2. These pitches are
  my choice; the brief does not name them.
- The kenong plays the tune's F# on 4.0, in unison with the saron.

**After the review.** The review found no hush in bar 2 and an opening gong
that was mostly a thump. Changed (nothing listened to; measured with the
probe, rms over 1 s windows):

- Bar 2 hushes. Gender gain 0.19 to 0.058 (-10.3 dB) and its growth from
  0.05 instead of 0.12; hushed saron vel 0.3 to 0.4; slenthem B3 on 2.0 vel
  0.5 to 0.15 and kempul 0.6 to 0.5 (without these two the window 2.05 – 2.45
  could not get 8 dB under bar 1). Bar 1 (59.1 – 60.95) -21.8 dBFS; hush
  (2.05 – 2.45) -30.2, 8.4 dB under; swell (2.5 – 2.9) -26.0, 4.2 dB under bar 1.
  The saron stands over the gender by 8.0 dB in the hush and 3.8 dB in the swell.
- The gong is a gong: modes added at 2.3, 2.92, 3.7, 4.8 times the note, thump
  0.12 to 0.06, phases spread, gain 0.21 to 0.25. Its body went from -36.3
  to -29.0 dBFS rms (+7.3 dB, as the second check measured it); its upper modes read -13 to -18 dB.
- Bars 1 and 3 are 1 dB up (LIFT 1.12) and the slenthem's B2 on 5.0 is 3 ms
  later, so that the peak stays at -6.3. Level -20.1 to -19.8 LUFS.
