# Music · Section 20 · 代码美学 · Code Aesthetics

| | |
|---|---|
| Film time | 119.0 s – 125.0 s |
| Part file | `audio/parts/20-code.js` (`node tools/audio.mjs --section 20 --check`) |
| Owner's brief | "Code Aesthetics: Clean piano and synthesizer." The owner's brief for the picture: "This must be the most refined and meticulously crafted answer in the entire film." |
| Loudness target | -20 LUFS |
| Scale | major, harmonised |
| Picture | `briefs/20-code.md`, `src/scenes/code.js`; `briefs/CUES.md`, "Section 20" |

## The idea

After nineteen costumes, the tune as it is: a piano, played simply and
perfectly, with a quiet synthesizer holding the harmony. While the code is
written line by line, each finished line draws a part of the pelican, and
each finished line is a small glass note, climbing. No tricks. The care is
the point.

## Instruments

- **A piano**: clean, close, soft-hammered. Build it carefully: partials
  slightly stretched above whole multiples (more so higher up), each dying at
  its own rate, a fast first decay and a slow second one, two strings per
  note a cent apart for a slow shimmer, a soft felt thump under the attack.
  Nothing harsh, nothing bright. The tune at written pitch (D4 … B4) with the
  top voice clearly leading; a left hand in slow broken tenths.
- **A pad**: two or three gently detuned voices per note through a low
  filter, slow to speak (0.4 s), very soft. One chord per two beats:
  `Dadd9 | Dadd9/F# | G6/9 | Asus4 → A | D/F# | G(add9) → Asus4`.
- **Glass notes**: a soft, pure, bell-like pluck (a sine with one quiet
  partial and a quick decay) for the finished lines.
- **A sub**: a low sine on the roots, barely there.
- A small warm room, about 1.6 s, lightly.

## The lines

Each line of code that completes starts a stroke of the drawing. Give each a
glass note on its time, one step higher on the five notes each time.

| u | What completes | Note |
|---|---|---|
| 0.562 | `<svg>`: the grid lights | A4 |
| 0.814, 0.963 | rear wheel, front wheel | B4, D5 |
| 1.250, 1.399, 1.502 | the frame's three lines | E5, F#5, A5 |
| 1.651 | saddle, bars, bell | B5 |
| 1.800 | chainring and chain | D6 |
| **2.0** | **the bicycle is complete** | the pad's chord changes; one fuller glass chord (D, A, D) |
| 2.283, 2.468, 2.586, 2.793 | body, neck, head, eye | D5, E5, F#5, A5 |
| **3.0** | **the bill: the one strong colour** | **one warmer, slightly louder note with a longer ring: B5** |
| 3.208, 3.416, 3.7 | pouch, wing, legs | D6, E6, F#6 |
| **4.0** | **the pelican is complete** | a full, calm chord under the tune's F# |
| **4.6** | **`</svg>`: the file closes; a check mark draws; `20 / 20`** | two soft notes, F#5 then A5 (4.60 and 4.72): finished |

They are quiet (well under the piano) and their times are not on the beat
grid: that is correct. They are the drawing, not the tune.

## The three bars

The piano plays the tune straight through, in time, from u = 0 to 5.75. The
pad holds the chords. At 2.0, 3.0 and 4.0 the piano's note, the pad's change
and the drawing's moment coincide. After 4.6 the music is already resolved;
the last three notes (B3 A3 B3) are a soft walk to the frame, and the pad is
gone by 6.0.

Declare cues at u = 0, 2.0, 3.0, 4.0 and 4.6.

## The bicycle here

`bike: { chain: 0.5, bell: 1 }`.

## The lead

Export the piano as `lead`. In the outro it has the last word, alone.

## Hand-over

In: Section 19 stops dead on your downbeat. Your first note sounds in a
sudden quiet: make it beautiful. Out: at 6.0 the outro begins with every
instrument in the film. Leave it room: nothing of yours above -50 dBFS
after u = 7.5.

## Check

- The probe on a piano note: an attack of a few milliseconds, partials a
  little sharp of whole multiples and more so higher up, the upper ones
  gone within half a second, a slow beat in the sustain.
- The picture: the tune's notes on the beat lines, and above them a
  staircase of small marks climbing through bars 1 and 2.
- Lead notes within 5 cents.
- Read your score as a pianist would. If a voicing is clumsy, fix it.

## As built

Nothing here was listened to. Everything below was checked by measurement
(`node tools/audio.mjs --section 20 --check`, alone and `--with bike`, and
`--from 117 --to 128` with both neighbours), by the probe, by `--print 20`
and by looking at the spectrograms.

**What plays (u, seconds into the section).**

- **Piano, right hand:** the tune at written pitch, D4 at 0.00 … B3 at 5.75,
  every note on its beat, each released 20 ms before the next (legato through
  the damper). Skeleton notes a little stronger (vel 0.8-0.86), bar 3 softening
  to the frame (B3 A3 B3 at 0.60, 0.52, 0.50). At 4.0 a soft inner A3 + D4
  under the tune's F#4: the full, calm chord. The A3 is let go at 4.48 (the
  left hand strikes the same key at 4.5), the D4 at 4.66.
- **Piano, left hand:** slow broken tenths, the bass on the chord and the tenth
  a beat later: D2 / F#3 (0, 0.5), F#2 / A3 (1, 1.5), G2 / B3 (2, 2.5),
  A2 / C#4 (3, 3.5: the sus4 resolving), F#2 / A3 (4, 4.5), then G2 (5) and
  A2 (5.5) alone under the tune's low B3 A3 B3. About 6 dB under the tune.
- **Pad:** Dadd9 D3 F#3 A3 E4 (0) | Dadd9/F# F#3 A3 D4 E4 (1) | G6/9 G3 B3 E4
  A4 (2) | Asus4 A3 D4 E4 (3) → A3 C#4 E4 (3.5) | D/F# F#3 A3 D4 (4, nothing
  above the tune's F#4) | G(add9) D3 G3 A3 (5) → Asus4 E3 A3 D4 (5.5: 0.2 s
  in, held to 5.75, then falling smoothly to silence at 5.93). About 13 LU
  under the piano alone.
- **Sub:** sine on the roots D2 (0, out by 1.0), G1 (2), A1 (3, out by 4.0),
  G1 (5), A1 (5.5, out by 5.95). Nothing under the two D/F# chords (1.0-2.0 and
  4.0-5.0), so the F# in the left hand and the pad is the bass there. About
  15 LU under the piano.
- **Glass:** on the scene code's line times, climbing the five notes: A4 0.562,
  B4 0.814, D5 0.963, E5 1.250, F#5 1.399, A5 1.502, B5 1.651, D6 1.800;
  **2.0** chord D5 A5 D6; D5 2.283, E5 2.468, F#5 2.586, A5 2.793; **3.0** the
  bill, B5 warm (louder, rings 2 s); D6 3.208, E6 3.416, F#6 3.700; **4.6** F#5
  and 4.72 A5 (the file closes, the check mark). About 9 LU under the tune alone.
- Cues declared: 0, 2.0, 3.0, 4.0, 4.6 (the last listens in 2.7-3.2 kHz, where
  the closing glass notes' upper partial is and the piano is quiet).
- `bike: { chain: 0.5, bell: 1 }`. `lead` is the piano, `leadOctave: 0`.

**How each sound is made.**

- **Piano** (buffers made in `prepare()`, about 0.15 s for 30 keys: the score's
  notes and the D major scale from D3 to B5 for the outro): additive. Partial n at
  n f sqrt(1 + B n²) / sqrt(1 + B), B = 0.00032 · 2^((m - 62)/20) (the
  fundamental exact, the 6th about 10 cents sharp at D4); amplitudes of a soft
  hammer striking at 0.122 of the string (|sin(π n β)| / n^0.9) rolled off by
  felt above 1000 + 2f Hz (4th order) and above 3 kHz; each partial decays in two
  stages (72 % prompt, 28 % aftersound 3.6× slower) with T60 falling with its
  frequency; two strings 1.15 cents apart of strengths 1 and 0.6 (a slow beat);
  2.5 ms raised-cosine attack; a felt thump (doubly lowpassed noise, 50 ms) and a
  soundboard knock (118 and 205 Hz, under 0.1 s). Damper: a linear fade of 0.12 s
  (treble), 0.16 s (middle), 0.22 s (bass) after the key's length.
- **Pad:** three sawtooth oscillators at -6, 0, +5.5 cents per note, two lowpass
  stages (about 700-900 Hz and 1.6× that), 0.4 s attack (0.8 of the note's
  length when that is shorter: 0.2 s on the last chord), release 0.35 s,
  0.2 s on the two chords that resolve by a semitone (3.0 Asus4, 4.0 D/F#),
  0.18 s on the last.
- **Glass:** modal: a sine with a quiet partial two octaves up (0.1; 0.25 on the
  two closing notes; T60 0.85 s and 0.22 s); the bill's note adds a trace of the
  octave and rings with T60 2 s.
- **Sub:** a sine, 0.18 s in, 0.25 s out.
- **Room:** one convolver, 1.6 s (T60 1.3, bright 0.4); sends 0.16 (piano, pad)
  and 0.3 (glass). A 34 Hz highpass on the bus.

**Measured.** -20.4 LUFS alone (target -20), peak -6.7 dBFS, largest step 0.059,
silent after about u = 7.1; lead notes within 2.4 cents; every cue within 6 ms;
with the bike, both crossings ok. Probe on D4: peak at 2 ms, partials 2-6 sharp by
1, 4, 4, 7, 10 cents, the upper ones down about 30 dB within 0.4 s.

**Unsure / not done.**

- The scene has two more lines that complete (the wheels' `</g>` at 0.998, the
  bird's `</g>` at 3.449, accent only) and the shadow line at 4.436 (the shadow
  fades in). This brief's table gives them no note, so none plays.
- The 4.0 moment has no code line of its own: it is the legs (line at 3.70)
  finishing their draw-on. The chord lands on 4.0 as asked.
- The 4.6 cue reads with a rise of only about 4 dB (limit 3): the piano's E4 and
  A3 at 4.5 sit just before it.
- The outro is still a stand-in, so the `lead` export has not been heard in
  its context; it plays any pitch (keys outside the prepared set are made on
  first use, a few milliseconds each).
- The pad's G6/9 carries A4 a tone under the tune's B4 at 2.0, by design (the 9th).

**After the review.** Three rulings carried out (nothing listened to; all
measured on renders of this part):

- The pad's attack is now `min(0.4, 0.8 × length)`, so the last chord's
  envelope points run forwards (0, 0.2, 0.25, 0.43 s). Pad alone: it holds
  about -31 dB to 5.77, then falls -34.5, -40, -45.5, -53 dB at 5.79, 5.83,
  5.89, 5.91 and is under -55 dB from 5.93 (it was flat to 5.90, then a 17 dB
  drop in 30 ms). The other chords are unchanged (all are 0.5 s or longer).
- The 4.0 chord's inner A3 ends at 4.48 instead of 4.66. Its damper fade
  (0.16 s) still overlaps the left hand's A3 from 4.5, falling from about -39
  to -52 dB by 4.63, instead of holding at full strength to 4.66.
- The sub no longer plays under the D/F# chords: D2 is 0-0.75 and A1 3.0-3.75,
  each released by the change (sub alone: silent from u = 1.04 to 1.98 and
  4.04 to 4.98); the D2 at 4.0 is gone. The pad's release is 0.2 s on the 3.0
  and 4.0 chords: the Asus4's D4 is below -57 dB from 3.65 (it was -49.5 dB at
  3.75 against the C#4), the D/F#'s F#3 (read at its 2nd harmonic) below -58 dB
  from 5.15 (it was -52 to -56 dB to 5.25 against the G3).
- Level -20.3 → -20.4 LUFS, peak -6.3 → -6.7 dBFS, energy below 120 Hz 14.5 →
  11.9 %; cues, tuning and the bell's band unchanged; 83 events (was 84).
