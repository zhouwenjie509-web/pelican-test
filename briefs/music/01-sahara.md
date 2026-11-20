# Music · Section 1 · 撒哈拉岩画 · Saharan Rock Art

| | |
|---|---|
| Film time | 5.0 s – 11.0 s |
| Part file | `audio/parts/01-sahara.js` (`node tools/audio.mjs --section 1 --check`) |
| Owner's brief | "Saharan Rock Art: Hand drums and vocal chanting" |
| Loudness target | -19 LUFS |
| Scale | major (D E F# A B) |
| Picture | `briefs/01-sahara.md`, `src/scenes/sahara.js`; `briefs/CUES.md`, "Section 1" |

## The idea

The first people to draw the pelican sing it. A caller sings the tune's first
bar, the group answers, and hands and skins keep time. Then the herd notices
the bicycle, one animal after another, and the singers notice too.

## Instruments

- **Voices.** Men's voices, three or four, and one higher voice (there are
  children among the painted herders). Synthesized singing on open vowels
  only (o, a, e, a closed hum): no words. A voice is a buzzing source with a
  little vibrato and drift, shaped by three or four vocal formants that glide
  from vowel to vowel; give each singer a slightly different throat, tuning
  and timing so that the group is a group. The men sing the tune one octave
  below written (D3 … B3; `leadOctave: -1`); the higher voice doubles at the
  written octave in the answers.
- **Hand drums.** Three skins: low (a thump that drops in pitch, about 90 Hz),
  middle (about 150 Hz), and a high slap (a bright crack). **Handclaps**: a
  few hands, never exactly together.
- **A dry tap**, a stick on rock or a small high drum, for the animals (bar 2).
- **The place**: a rock shelter. A short, hard, bright room (about 1.2 s).

## The three bars

The drums play the pedal cell: low on the first beat of each two-beat cell,
two lighter strokes on the second beat's eighths (`DUM . tak tak`). Claps on
beats 2 and 4.

| u | Picture | Sound |
|---|---|---|
| 0.0 | The pelican comes onto the rock | The caller alone sings bar 1 of the tune (D E F# A F# A), drums and claps under him |
| 1.14–1.62 | A herder turns and lifts an arm | |
| 1.62–4.19 | The cattle look up one after another: 1.62, 1.94, 2.20, 2.67, 3.24, 3.71 (each takes 0.48 s) | Six dry taps, one per animal, on the eighths inside each look: **u = 1.75, 2.0, 2.25, 2.75, 3.25, 3.75**, each a little higher than the last |
| 2.0 | | The group answers: B A F# |
| 3.0 | Most heads are up | The held E: a long hum from the low voices only, getting quieter. The drums fall to the low skin alone, on the beats. Everyone is watching |
| 3.75–4.23 | A child points | |
| 4.0 | Heads follow the pelican | Everyone, in octaves, with all the drums: F# E D \| B A B, growing to the frame |
| 5.75 | | The last note (B3 in the men's octave: B2). The bell takes the D |

Declare cues at u = 0 and at the first and last of the six taps.

## The bicycle here

`bike: { chain: 1, bell: 1 }`. The chain's ticks sit between your drum
strokes; do not cover them with a constant shaker.

## Hand-over

In: the intro's strings stop at 5.0 and their hall rings on; your first
stroke and the caller's first note are on 5.0 exactly. Out: nothing after
u = 6; Section 2 is a harp, soft, so keep your tail short.

## Check

- The tune is in the voices at its pitches (the checker measures the lead
  notes: mark them `lead: true`, the hum too).
- The spectrogram shows voices as steady partials with a moving pattern of
  strong bands (formants), drums as short low thumps with noise, and the six
  taps as thin vertical marks in bar 2 at their times.
- No words, no recognisable song.

## As built

`audio/parts/01-sahara.js`, 82 events, 3 cues. Nothing here was listened to:
it was checked by the report of `node tools/audio.mjs --section 1 --check`
(-19.7 LUFS, peak -7.6 dBFS, lead notes within 5 cents, cues +1 ms),
`audio-probe`, `--label` renders, the printed score and the spectrogram.

**What plays (u = seconds into the section)**

| u | Sound |
|---|---|
| 0.0–2.0 | The caller alone: D3 E3 F#3 A3 F#3 A3 on o a e a o a. Drums DUM . tak tak on every two beats (low skin on 0, 1; middle skin on 0.5, 1.5; slap on 0.75 and 1.75). Claps on 0.5 and 1.5 |
| 2.75, 3.0, 3.25, 3.75, 4.25, 4.75 | Six dry taps, A5 B5 D6 E6 F#6 A6, panned a little further right each time, one on the first eighth after each animal begins to look up (u 2.62, 2.94, 3.20, 3.67, 4.24, 4.72). Cues at 2.75 and 4.75 (band 5–12 kHz) |
| 2.0–3.0 | The group answers B A F# (a e o): caller and three men at B3 A3 F#3, the child at B4 A4 F#4. Low and middle skin, claps on 2.5 (7 dB up); no slap at 2.75, under the first tap |
| 3.0–4.0 | The held E3 hummed ("m") by the caller and the three men, falling to about 40 % by 4.0. Drums: the low skin alone on 3.0 and 3.5. No claps, no tak |
| 4.0–6.0 | Everyone in octaves: F#3 E3 D3 B2 A2 B2 (men), F#4 … B3 (child), growing from 0.82 to 1.0. All drums, slaps on 4.75 and 5.75 (6 dB up), claps on 4.5 (6 dB up) and 5.5 (1 dB up), an extra middle stroke on 5.25 |
| 5.75 | Last note B2 (B3 in the child). Its release begins at u = 5.93 and ends at 5.99 (the late singers a few ms later): the voices alone measure -35.7 dBFS in the 10 ms from u = 6.0, the whole part below -50 dBFS by about 6.13. Nothing starts after 5.75 |

**How each sound is made**

- Voices: an oscillator with harmonics at 1/k^1.5 (a soft glottal pulse),
  through three peaking filters at the vowel's formants (o 570/840/2410,
  a 730/1090/2440, e 530/1840/2480; the hum 260 Hz with a notch near 1 kHz and
  a 900 Hz lowpass) and a lowpass; formants glide from the previous vowel over
  60 ms. Each note scoops in from part way towards the previous pitch over
  35 ms, drifts a few cents, and gets a delayed vibrato (5.2–6.1 Hz, 12–18
  cents) when it is longer than 0.3 s. Where a singer goes from one note to
  the next, the two cross-fade at equal power on that singer's own time (the
  late men included): the new note rises on a quarter sine over 20 ms, the
  old one stays full for 4 ms more and then falls on a quarter cosine over
  20 ms, so it is gone 24 ms after the new one begins. The score adds up each
  note's pitch path (scoop, drift, vibrato, wander) to know where its
  fundamental is in its cycle at the hand-over, and starts the next note's
  source upside down when that is in the other half-cycle, so that the two
  fundamentals meet in phase instead of cancelling. Every sung note in the section also has breath (white
  noise, highpassed at 900 Hz, fed into the same formant filters at 0.09:
  about 30 dB under the voices; about 42 dB under the closed hum) and a slow
  wander of ±3 cents and ±0.25 dB, a new point every 0.18 s, from `rng` seeded
  per note. Five singers: caller (on time, 0 cents), three men (7–22 ms late,
  -3/+3/-1 cents, throats 0.9–1.05), a child (throat 1.3, the written octave).
- Skins: computed buffers. A membrane's modes (1, 1.59, 2.14, 2.30, 2.65)
  whose pitch falls as the skin relaxes, plus a few ms of hand noise. Low
  settles on A2 (110 Hz, from about 148 Hz), middle on D3 (146.8 Hz, from
  about 173 Hz), slap 360 Hz with a bright 3.2 kHz noise crack.
- Claps: three hands, each a band-passed noise burst (900–1800 Hz), 4–18 ms
  apart, three variants.
- Taps: stiff inharmonic modes (1, 2.32, 4.25 times the note) dying within
  0.1 s, plus a 6 kHz contact click.
- Room: `k.reverb` 1.2 s, t60 0.9, bright 0.75, strong early reflections, fed
  at 0.2.

`lead`: the caller on an open "a", as before (no breath, no wander, the old
release: the outro gives it only midi, dur and vel); `leadOctave: -1`.
`bike: { chain: 1, bell: 1 }`.

**After the review**

Changed on the music director's rulings (`REVIEW-01-sahara.md`), checked by
measurement only:

1. Cross-fade between a singer's notes (above). Caller alone, 25–85 ms after
   E3 begins at u = 0.5: the old D3's D5 partial fell from -8 to -23 dB under
   the new note (what is left is the room); 25 ms after man 2's E3 at u = 4.5
   no F#3 partial is among the strongest eight.
2. Claps and slaps forward in bars 2 and 3. In 1–5 kHz, the first 10 ms of
   each clap against the voices alone: u = 2.5 +4.1 dB (was -5.5), 4.5 +5.4
   (was -5.8), 5.5 +4.8 (was +2.7). A uniform 6 dB would have put the clap at
   5.5 about 9 dB over, so its lift is 1 dB and the one at 2.5 is 7 dB. The
   slaps at 4.75 and 5.75 are 6.0 dB up.
3. Skins retuned to A2 and D3 (tracked: low skin 110.4–110.9 Hz from 0.12 s;
   the middle skin dies within about 0.12 s and reads 146–152 Hz while it
   falls). The men's D3 notes read -2.5 and -1.8 cents in the mix and -2.2
   and -1.9 with the voices alone, so the middle skin does not pull them;
   the rings were not shortened.
4. Last chord released from u = 5.93 (above).
5. Breath and slow wander on every singer (above).
6. No slap at u = 1.75 and 2.75 (84 events became 82).

The part is 0.3 LU quieter than before (-19.7 against -19.4 LUFS: the
overlaps and the held last chord are gone), still within the limit.

Second round (the dip at each change of note). The old hand-over was two
straight lines (old note down over 25 ms from 5 ms before the change, new up
over 30 ms), and for the three men it was timed from the beat, not from their
own late notes, so man 2 (22 ms late) was silent for a moment at every
change. Measured with `dev/audio/sahara-xf.mjs` (10 ms windows in 1 ms steps,
against the 50 ms held level either side), each singer alone with `--label`:
before, the caller dipped 4–12 dB and man 2 14–22 dB; after the equal-power
cross-fade with phase-matched starts (above), the worst dip is 2.7 dB
(caller), 3.1 (man 1), 2.1 (man 2), 2.5 (man 3), 3.2 (child), and 0.7–2.4 dB
against the quietest 10 ms window inside the held notes themselves (the
pitch period makes those windows swing). `audio-probe --env`: caller at
5.45–5.81 and man 2 at 9.47–9.83 have no 10 ms step under the held level
across the changes at 5.5, 5.75, 9.52 and 9.77 (before: -5 dB, and -10 to
-13 dB); all the voices together at 10.48–10.52 read -17.0, -17.1, -17.1,
-17.0 dB (before: -17.0 to -20.6). The overlap and the in-phase meeting
leave a short rise instead: up to +2.8 dB for 10–15 ms per singer, about
+4 dB in the whole group at u = 5.75, and the part's peak rose from -9.4 to
-7.6 dBFS (at u = 5.0, the B2 hand-over). Loudness, notes, times, the last
chord's release (voices -35.3 dBFS in the 10 ms from u = 6.0) and the
`lead` export (it passes no hand-over fields, so it keeps the old envelope)
are as they were.

**Unsure**

- Whether the synthesized voices sound like singing rather than an organ. The
  breath and wander are there by measurement (breath about 30 dB under), but
  the wander is smaller than the probe can resolve against vibrato and scoop,
  and nobody listened. The breath shows on the spectrogram as a faint haze
  above 2.5 kHz wherever the open vowels sing.
- The lead notes now read within 4.5 cents (worst the hummed E3 at u = 3.0);
  the A2 at u = 5.5 read -7.9 cents after the first round.
- Whether the brief rise at each hand-over (above) reads as a small accent
  on every note in the group. It is the price of the no-dip ruling; a plain
  equal-power fade without the 4 ms lag lowers it by 0.5–1 dB but leaves
  dips of 3–4 dB.
- The spectrogram shows soft columns below 100 Hz at each note change of a
  singer alone (the level change of the fundamental, blurred by the low
  window). No picture of the old version was drawn; in 30–90 Hz those 80 ms
  measure about 2 dB more than before (caller, u = 5.0 and 5.5).
- The first tap's cue rises 23–25 dB in 5–12 kHz (was 27): the breath adds a
  little to that band.
- The hum's level against the low skin in u 3–4.

**Music director's hand edit after the second check.** With the dips at the singers' note changes gone, the claps no longer stood over the voices on the beats where both fall (the second checker measured +1.3, +3.7 and +2.7 dB in 1 to 5 kHz at u = 2.5, 4.5 and 5.5). The clap lifts were raised from 2.24, 2 and 1.12 to 3.3, 2.1 and 1.45. Measured with `dev/audio/sahara-claps.sh`: claps over voices +4.6, +4.1 and +5.0 dB. The check alone and with the bicycle still ends "Nothing out of tolerance." (-19.6 LUFS with the bicycle, peak -7.6 dBFS). Nothing was listened to.

**Stage 5.** The picture's cattle now begin to look up exactly one second later (scene ruling 01.1: each head lifts in plain view), so the six taps moved by the same rule as before, the first eighth inside each look: from u 1.75, 2.0, 2.25, 2.75, 3.25, 3.75 to **u 2.75, 3.0, 3.25, 3.75, 4.25, 4.75**, and the two tap cues from 1.75 and 3.75 to 2.75 and 4.75. One other note changed, by the director after the fix round: the slap at u 1.75, which had been left out to let the first tap stand alone, is back now that no tap is there (the slap at 2.75 stays out, under what is now the first tap; the second, third and fourth taps fall in the hush, and the last tap at 4.75 falls with the bar-3 slap). Measured, not listened to: `--check` alone and with the bicycle both end "Nothing out of tolerance." (-19.7 LUFS alone, -19.6 with the bicycle, peak -7.6 dBFS; cue lags +1 ms, rises 14 dB at 2.75 and 22 dB at 4.75 in 5–12 kHz), `--lint 1` finds nothing.
