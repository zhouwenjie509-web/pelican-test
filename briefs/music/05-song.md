# Music · Section 5 · 宋代山水 · Song Landscape Painting

| | |
|---|---|
| Film time | 29.0 s – 35.0 s |
| Part file | `audio/parts/05-song.js` (`node tools/audio.mjs --section 5 --check`) |
| Owner's brief | "Song Dynasty: Guqin" |
| Loudness target | -24 LUFS |
| Scale | major (D E F# A B) |
| Picture | `briefs/05-song.md`, `src/scenes/song.js` (`camera(u)`); `briefs/CUES.md`, "Section 5" |

## The idea

In bar 2 the camera pulls back to show the whole mountain, and the pelican
becomes a speck that can hardly be found. The music does the same thing: the
tune goes on, but so far away that it is a few faint harmonics inside the
ring of one low string. Then the camera finds the pelican again, and the tune
comes back up close.

## Instrument

**A guqin**: seven silk strings on a long lacquered board, played very
quietly, for oneself. A deep, soft pluck with few upper partials; low strings
ring three or four seconds. What makes it a guqin:

- **Slides**: the left hand glides along the string after the pluck, so the
  pitch bends smoothly between notes, with a faint brushing sound.
- **Harmonics** (fan yin): pure, small, bell-like notes, one or two octaves
  above the stopped ones.
- **Open strings**: the lowest (D2) is the instrument's ground.

The tune one octave below written (D3 … B3; `leadOctave: -1`). Nothing else
plays. A quiet dark room, about 1.8 s.

## The three bars

| u | Picture | Sound |
|---|---|---|
| 0.0–1.75 | The pelican rides the path under the trees, close | Bar 1 of the tune, unhurried: D3, E3 sliding to F#3, A3, F#3, A3. Soft but near |
| 2.0 | **The camera pulls out to the whole painting** (2.00–2.55, fast) | **The open low string, D2**, full and long. With it the tune's B as a harmonic, quiet: the space opens |
| 2.5, 2.75 | The whole mountain; the pelican is a speck | The tune's A and F# as harmonics, each fainter |
| 3.0 | The wide shot holds (2.55–3.20) | The tune's E as a harmonic, the faintest. The low D is still ringing. A thread of very soft hiss, the waterfall, may be there from 2.3 to 3.6 |
| 3.2–4.0 | **The camera pushes in** and finds the pelican (it is itself again at about 3.58) | One stopped note sliding slowly upward from E3, growing, to arrive on |
| 4.0 | The close shot lands | **F#3**, plucked, near again |
| 4.5–5.75 | Riding on to the frame | E3 D3, then B2, A2, B2. The bell takes the D |

Declare cues at u = 0, 2.0 and 4.0.

## The bicycle here

The chain goes far away with the pelican:

```js
bike: {
  bell: 1,
  chain: (u) => (u < 2 ? 1 : u < 2.5 ? 1 - 0.92 * ((u - 2) / 0.5) : u < 3.3 ? 0.08 : u < 4 ? 0.08 + 0.92 * ((u - 3.3) / 0.7) : 1),
},
```

## Hand-over

In: Section 4's pipa ends dry. Out: Section 6 is a flute with gongs and
drums, loud and bright; your quiet last notes are its foil. Nothing after
u = 6; the low D2 of bar 2 has died by then.

## Check

- It is the quietest section but one: -24 LUFS, and the wide shot is quieter
  still. Nothing is loud at 2.0 except the depth of the open string.
- The probe on the open D2: a slow ring of several seconds, almost no energy
  above 2 kHz.
- The slide from 3.2 to 4.0 shows as one line bending upward in the picture.
- Mark the sliding note `free: true`.

## As built

File `audio/parts/05-song.js`. One guqin and nothing else; one dark room (1.8 s, t60 1.5,
bright 0.22). Nothing was listened to: everything below was checked by measurement and
by looking at the spectrogram.

| u | What plays |
|---|---|
| 0.00 | D3 plucked (vel 0.80 x 1.07), a small rocking vibrato (yin, ±8 cents) from 0.2 s |
| 0.50 | E3 plucked; the left hand slides it up a whole tone over 0.70–0.775, arriving on F#3 (lead note at 0.75, with a faint brush of the finger on the silk, 0.695–0.775) |
| 1.00, 1.50, 1.75 | A3, F#3, A3. The first A3 is damped as the second is plucked (its ring ends at 1.75). The last A3 is damped from 1.85 to 2.05, so the near sound has gone when the camera leaves |
| 2.00 | **Open string D2** (vel 0.85), dark: its upper partials roll off above 180 Hz, the fundamental at the level it had before. Rings to u 5.6 (natural decay, faded from 3.6). With it the harmonic **B4** (cue) |
| 2.50, 2.75, 3.00 | Harmonics A4, F#4, E4, each fainter (vel 0.60 → 0.45 → 0.34 → 0.26), wetter than the stopped notes |
| 2.30–3.60 | The waterfall: pink noise 1.8–4 kHz, very soft, 0.45 s fade in and 0.5 s out |
| 3.20–4.00 | E3 plucked far (vel 0.6 at 0.3 of its level, behind a low pass that opens 700 Hz → 2.6 kHz by 3.6 → 4 kHz by 4.0), and under it the same string held sounding (a steady sum of its partials) that swells exponentially from 3.26 to 3.94 (+18 dB) to 0.95 of the stopped string's level; both slide smoothly up 200 cents over 3.26–3.98. A growing brush of the finger under it. Marked `free: true`. Faded out over the last 60 ms before 4.0 |
| 4.00 | **F#3 plucked**, near (vel 0.86 x 1.07, yin ±8 cents) (cue) |
| 4.50–5.75 | E3, D3, B2, A2, B2 (vel x 1.07). The first B2 is damped as the second is plucked (its ring ends at 5.75). The last B2 rings with a 0.6 s fade to about u 6.7. The bell takes the D |

Cues declared: u 0 (the frame), 2.0 (the pull-out: the open string), 4.0 (the landing: F#3).
All three measure "ok" (lags +3, +5, +6 ms; the landing rises 4.1 dB over the slide's last 0.1 s).
`bike` wishes as in this brief.

How the sounds are made:

- **String**: a sum of decaying partials (`modal`), the harmonics of the note with a trace
  of stiffness (B = 2e-5), levels from a pluck a tenth of the way from the bridge
  (sin(π n 0.11) / n^1.4, then a soft roll-off above 1 kHz for silk and flesh), each
  partial's t60 shorter the higher it is (1/t60 = 1/T1 + 1.6 (f/1 kHz)²; T1 = 3.6 s at D2,
  about 2.6 s at A3); a 3 ms attack, a low knock of the board (118, 241, 405 Hz, under
  0.1 s) and a breath of finger noise at 1.2 kHz. Buffers for the major scale D2..E4 are
  made in `prepare()`, and the outro's `lead` plays these, unchanged.
- **Open string of bar 2**: the same recipe with a further roll-off 1 / (1 + (f/180 Hz)²), its
  own buffer (`song/open/38`), normalised so that its fundamental keeps the level of the
  bright D2.
- **Held string under the slide**: the string's partials (same levels) held steady for 1 s, in
  `prepare()`; the swell and the opening are drawn by a gain and a low pass.
- **Slides and yin**: the buffer's `detune` moved through breakpoints (straight segments
  along a smoothstep): every partial moves together, as when the left hand glides.
- **Harmonics (fan yin)**: one nearly pure partial (t60 2.4 s) with a little second (-20 dB)
  and third (-30 dB), and a tiny touch noise.
- **Brush**: pink noise through a 1.9 kHz band pass, very faint, only while a slide moves.
- **Waterfall**: pink noise through a 1.8 kHz high pass and 4 kHz low pass.

Measured (`--section 5 --check`): -24.0 LUFS alone (target -24), peak -10.8 dBFS, loudness
range 1.6 LU, largest step 0.016, tail -113 dBFS; 16 lead notes, worst -4.1 cents; the last
30 ms before u = 6 in 1.8–9 kHz: -81 dBFS. With the bike both crossings read "ok"; with
Sections 4 and 6 (`--from 27 --to 37`) nothing is out of tolerance.

RMS of the whole part, 200–4000 Hz: bar 1 (u 0–2) -28.1 dB; the pull-out (2.0–2.55)
-34.0 dB; the wide shot (2.55–3.2) -35.3 dB, 7.2 dB under bar 1; the push-in (3.2–4.0)
-33.2 dB; the F#3 at 4.0 (first 0.2 s) -24.9 dB. Broadband the wide shot is the quietest
stretch (-33.0 dB, against -25.4 for bar 1).

The slide alone (`--label 'sliding|slide brush'`), RMS in 0.2 s windows from u 3.3:
-38.1, -34.1, -28.3 dB (+9.8 dB); in 400–4000 Hz -44.1, -39.9, -35.0 dB. Its last 0.2 s
(3.8–4.0) is -26.9 dB, against -22.0 dB for the F#3 pluck alone (first 0.2 s). Its pitch
track runs 165.7 Hz (E3) to 183.2 Hz (F#3-17 cents) by +643 ms. In the spectrogram the
slide's partials bend upward and grow, the upper ones reaching about 1 kHz by 4.0.

The open D2 alone (31.05–32.0): fundamental 0 dB, second -3.6, third -13.5, fourth -19.1,
fifth -28.8 dB; falling about 17 dB per second; 2–9 kHz -103 dBFS rms against -29.5 broadband.

### After the review

- The push-in slide grows instead of fading: the decaying pluck now only starts it, and a
  held tone of the same string swells under it (the old swell only cancelled the pluck's
  decay); the low pass opens most of its way by 3.6. It rises 9.8 dB from 3.3 to 3.9 and
  brightens (400–4000 Hz +9.1 dB), and arrives about 5 dB under the F#3 pluck. It could not
  come closer: at 3.7 dB under (grow 1.0) the landing's onset rose only 3.2 dB and the cue
  at 4.0 is near failing (it needs 3 dB); its release was lengthened from 15 to 60 ms for the
  same reason.
- The wide shot is far away: the open D2 has its own darker buffer (third partial -13.5 dB
  instead of -7, fifth -29 instead of -20), the fundamental unchanged; the harmonics are
  3.9 dB lower (LEVEL.harmonic 0.16 → 0.102). From 2.55 to 3.2 the part is 7.2 dB under bar
  1 in 200–4000 Hz (was 2.7 dB).
- To keep -24 LUFS, every note of bars 1 and 3 is 1.07 times (+0.6 dB) its former velocity
  (the section read -24.5 LUFS without it).
- A repluck damps the note on that string: the A3 at 1.0 rings 0.75 (was 0.8) and ends as
  the A3 at 1.75 is plucked; the B2 at 5.0 rings 0.75 (was 0.8) and ends at 5.75. In the
  last 10 ms before each repluck only the room remains (-53 dB).
- The figures above were remeasured.

Unsure: whether the held tone under the slide reads as a guqin (a real qin's slide only
decays; this one is held and swells, as the ruling asks, which no plucked string does by
itself); whether the wide shot reads as quiet enough; the beating between the D2's partials
and the F#4 and A4 harmonics, now weaker because the D2's fifth and sixth partials are
lower; whether the waterfall is too wide a haze. Nothing was listened to.
