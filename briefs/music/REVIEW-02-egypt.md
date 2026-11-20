# Review · egypt

Independent review of `audio/parts/02-egypt.js` on 2026-11-18, by a reviewer who did not write the part and could not listen to it: everything below was measured, read from the score and the code, or seen in a spectrogram. The music director's rulings follow the findings.

**Verdict:** ready

An arched harp of decaying partials, a sistrum spray and a 0.9 s stone room. Every row of the brief is in the score at its time: bar 1 in time, damping by 1.95, the spread B3-E4-B4 landing on 2.0, the lone A5 harmonic at 2.5, the D4-D5 sweep at 3.0 and the nine ridden notes to the millisecond. The part passes alone and with the bike, and the joins are clean. The one real weakness is the sistrum, which is so quiet that the chain ticks it coincides with cover it.

## Findings

### 1. The light sistrum shakes sit at or under the chain ticks they coincide with (should-fix)

- **Evidence:** In 3-10 kHz, sistrum alone (review-egypt-sistrum.wav) at 11.5 / 12.5 / 15.258: peak -35.4 to -35.9 dBFS, rms -53.3. A bike chain tick at 12.5 (review-bike-10-19.wav) in the same band: peak -31.9 dBFS. The ticks fall on the same eighth grid, ridden ones included. At 11.5 the crossing bell is still ringing in that band (-43.3 dBFS rms in s02+bike 11.35-11.5), 10 dB above the shake's rms. Against the harp the pose shake at 2.0 is rms -49.0 vs the pose chord's -21.5 (27 dB down).
- **Suggestion:** Raise LEVEL.sistrum about 6 dB, from 0.05 to about 0.1, and put the light shakes about 20 ms off the chain's grid, as a player would. Then re-probe 3-10 kHz against the bike render. Re-check the peak and LUFS afterwards.

### 2. The sweep and the pose chord ring undamped under the hurried tune (note)

- **Evidence:** The six sweep notes (3.00-3.30, no damp) and B3/E4/B4 of the pose chord (no damp) have fundamental t60 of 1.9-2.4 s. They still ring under A4 3.619, F#4 3.779 and E4 3.939, and the arranger's own As built marks this as unsure. It is all pentatonic, so no semitone clash, but bar 3's packed notes sit on a wash of D E F# A B.
- **Suggestion:** Optionally give the sweep a damp at about 3.6 (fade 0.15) so the catch-up notes read clearly. This is a matter of taste.

### 3. Low strings make thirds and sixths, not only octaves and fifths (note)

- **Evidence:** --print 2: F#4 + F#3 over D3 at 4.578 (a tenth), and B3 over D3 at 5.217 (a sixth). The brief's header says "in octaves and open fifths: no triads". These are dyads, not triads, so the brief is not broken.
- **Suggestion:** If strict open sonorities are wanted, use A2 under the B3, or drop the D3 under the F#. Otherwise leave it.

## The checks, as the reviewer ran them

```
--section 2 --check: Level -20.8 LUFS (target -21) OK; peak -9.4 dBFS at 14.958; largest step 0.038 at 13.004; Tail -156.2 dBFS; cues 0.00 +3.0 ms ok, 2.00 +1.0 ms ok, 2.50 +4.0 ms ok, 3.00 +4.0 ms ok; Lead 16 notes median 0.5 c, worst +2.0 c (E4 at 15.90); Bell -75.2 dBFS 1.8-9 kHz in the last 30 ms; "Nothing out of tolerance." Cost 39 events, at most 26 alive.
--section 2 --with bike --check: crossing 1 [bike] +1.0 ms ok, crossing 2 [bike] +1.0 ms ok, all part cues ok, "Nothing out of tolerance."
--lint 2: "Lint: nothing found."
--from 9 --to 19 --check (review-join-9-19): egypt cue at 11.000 +6.0 ms ok (rise 6 dB over Section 1), crossing 1 and 2 ok, "Nothing out of tolerance."
```

## Rulings

1. **The sistrum is heard.** About 6 dB up, and the light shakes about 20 ms off the chain's grid, as a player would place them. In 3 to 10 kHz each shake must stand above the chain tick nearest to it (render with `--with bike` and probe).
2. Damp the sweep at about u = 3.6 (a fade of about 0.15 s) so that the hurried notes are clear (finding 2). Finding 3 stands as it is.
