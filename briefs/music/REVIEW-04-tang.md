# Review · tang

Independent review of `audio/parts/04-tang.js` on 2026-11-18, by a reviewer who did not write the part and could not listen to it: everything below was measured, read from the score and the code, or seen in a spectrogram. The music director's rulings follow the findings.

**Verdict:** needs-fixes

One pipa (nail strokes, 13 Hz lunzhi, sweeps, a push, harmonics and a snap), a clapper and a breath of wind. Every row of the brief is scored at its time and the snap at 5.08 lands well. However, the part fails its own check: the 2.13 cue on the fan-holder's sashes is 68 ms late, because the first harmonic run has no level to stand on in its band. The wind's pink-noise buffer is also computed during playback, the push is all but inaudible under the third run, and by 3.7 s the ringing harmonics form a wash louder than the held E.

## Findings

### 1. The cue at u = 2.13 (first run of harmonics) fails: 68 ms late, rise 4 dB (must-fix)

- **Evidence:** node tools/audio.mjs --section 4 --check: "25.130 2.13 +68.0 ms 4 dB ... LATE (limit 15 ms)". In band 600-720 Hz the full mix is already at -27.6 to -31.4 dBFS over 25.00-25.05: the B4 roll's restrikes, the D3 open string's partials and the clapper on 2.0. The E5 harmonic enters at only -30.7 dBFS (review-tang-harm.wav, 25.13). So the fan-holder's run does not stand out at its moment, and the brief marks this as a cue.
- **Suggestion:** Make the first harmonic of the run stand out in its band. Raise LEVEL.harmonic, or the first note's vel, by about 6 dB. Also drop or lighten the B4 roll from 2.10 to 2.20 (the arranger already notes that a player cannot roll while playing harmonics), and/or declare the cue in a band the roll does not reach (for example 1.3-1.4 kHz, where the E5's 2nd partial at 1319 Hz is). Re-run the check until it reads ok.

### 2. The wind's pink-noise buffer is computed during playback, not in prepare() (must-fix)

- **Evidence:** wind() calls k.noise("pink", ..., { seed: 4 }) (04-tang.js:202), and Kit.noise calls prepareNoise(color, seed) (kit.js:194), which builds a 6 s pink buffer (288,000 samples) on first use. prepare() never calls prepareNoise("pink", 4), and no other part uses seed 4. Timed: pink(6*SR) takes 4.3-5.0 ms, against the guide's limit of one millisecond in a play function. The lint does not catch it.
- **Suggestion:** Import prepareNoise from ../engine/kit.js and call prepareNoise("pink", 4) in prepare().

### 3. The push on the held E is inaudible under the third run (should-fix)

- **Evidence:** review-tang-heldE.wav --track 20 --near 330 from 26.3: the pushed stroke rises toward F#4 while decaying, -34 dBFS at 3.40, -45 at the top (3.52) and -56 on the way back (3.66). Over 26.37-26.70 the held E is -36.5 dBFS rms and the harmonics are -23.5 dBFS rms, 13 dB louder. The push is the held note's ornament, and it will not be heard.
- **Suggestion:** Push a fresh stroke, not the decaying last roll stroke: strike at about 3.33 and bend from 3.37. Raise its level, or hold the third run back about 6 dB while the push sounds.

### 4. Seventeen harmonics with 1.5 s rings pile into a cluster louder than the tune in bar 2 (should-fix)

- **Evidence:** Over 26.8-27.4 (u 3.8-4.4), review-tang-harm.wav shows A5, B5, D6, E6, F#6 and A6 all sounding within 10 dB of each other (A6 strongest, F#6 -2.8, E6 -5.9, D6 -7.6, B5 -9.1, A5 -10.4): pure tones a major second apart. Harmonics against the tune: 2.13-2.5 -24.8 vs -27.8 dBFS rms (B4 roll); 2.5-3.0 -26.7 vs -25.5. The lead line is at best level with this accompaniment for the whole of bar 2.
- **Suggestion:** Shorten the harmonics' t60 to about 0.6-0.8 s, or damp each run as the next one starts. Lower LEVEL.harmonic for runs 2 and 3, keeping run 1 raised for its cue, so that the tune leads.

### 5. lead() is not ready for every pitch of the scale: C#4 and others are computed during playback (should-fix)

- **Evidence:** STRUNG holds A2 D3 A3 B3 D4 E4 F#4 G4 A4 B4 C#5 D5 only. C#4 (inside the tune's own octave), E3, F#3, G3, B2 and anything above D5 are missing, so lead() for them builds 'nail' and 'roll' strike buffers in the play function. Timed: an equivalent 39-partial, 1.3 s modal pair for C#4 takes 12.7-13.4 ms. The guide says the outro may call lead with any pitch of the major scale, and the outro is still a stand-in, so this is untested.
- **Suggestion:** Prepare every D-major pitch from A2 to at least D5 (as egypt does), C#4 included, for both variants. Keep prepare() under 0.4 s; it is 0.23 s now.

### 6. The wind is very likely inaudible (note)

- **Evidence:** The wind alone peaks at -46.5 dBFS (review-tang-wind.wav) in a part mixed to -20 LUFS, and in 600-720 Hz at 25.1-25.3 it reads -78 to -97 dBFS. The brief asks for very quiet; this is about 25 dB under everything else.
- **Suggestion:** If it is meant to be heard, raise LEVEL.wind by 6-10 dB. Otherwise cut it and save the source.

### 7. The downbeat D4 sounds 18 ms late (note)

- **Evidence:** --print 4: D4 at 0.018 and F#4 at 4.018 come after the three sweep strings. The arranger declared this. The cue at 0 passes because the sweep's A2 is at 0.000.
- **Suggestion:** Acceptable as a pipa sao. Spreading the sweep 4 ms apart instead of 6 would bring the tune note to 0.012 if wanted.

## The checks, as the reviewer ran them

```
--section 4 --check: Level -20.5 LUFS (target -20) OK; peak -7.2 dBFS at 24.005; largest step 0.335 at 28.081 (the snap's crack); Tail silence; cues 0.00 +10.0 ms ok; 2.13 +68.0 ms rise 4 dB "LATE (limit 15 ms)"; 5.08 +1.0 ms ok; Lead 15 notes median -0.3 c, worst -2.5 c, 1 marked free; Bell -68.4 dBFS; "1 thing(s) out of tolerance: cue at 25.13 s (the fan-holder's sashes lift: first run of harmonics): 68.0 ms".
--section 4 --with bike --check: crossing 3 [bike] +1.0 ms ok, crossing 4 [bike] +2.0 ms ok; same failure: "cue at 25.13 s ... 68.0 ms".
--lint 4: "Lint: nothing found."
--from 21 --to 31 --check (review-join-21-31): crossings ok, song's entrance ok, same 2.13 cue LATE 68 ms.
```

## Rulings

1. **The cue at 2.13 must read ok.** The first run of harmonics stands out at its moment: its first note about 6 dB up, and the B4 roll stops at 2.10 (a player cannot roll and play harmonics at once).
2. **The push on the held E is heard.** Strike a fresh stroke at about 3.33 and bend it from 3.37; hold the third run back about 6 dB while the push sounds.
3. **The tune leads in bar 2.** Harmonics ring 0.6 to 0.8 s, not 1.5; runs 2 and 3 are quieter than run 1.
4. **`lead` is ready for every pitch of D major from A2 to D5**, C#4 included, both stroke kinds, made in `prepare()` (keep it under 0.4 s).
5. Raise the wind about 8 dB: it should be just perceptible (finding 6). Finding 2 (the noise buffer) needs nothing: the engine now makes both noise buffers before anything plays. Finding 7 stands.

## Second check (after the fix round)

A second independent checker measured every ruling again: 4 of 5 met.

- **Only partly met:** Tune leads in bar 2: harmonics ring 0.6-0.8 s; runs 2 and 3 quieter than run 1
  HARMONIC_T60 0.7 (probe at 26.8 reads T60 about 0.61 s); run 2 vel 0.51-0.63 and run 3 0.40-0.50 vs run 1 0.72-0.86. Harmonics vs tune rms: 2.5-3.0 -32.8 vs -25.6 (tune +7.2 dB, was -1.2); 3.0-3.37 -35.2 vs held E -23.3; 3.37-4.0 -34.7 vs -24.8; 3.8-4.4 cluster -54.1 vs tune -23.9. But over 2.13-2.5 run 1 is -25.7 vs the B4 -38.6 dBFS: the tune is 12.9 dB under (review: 3 dB under). In the mix at 25.13 for 0.37 s, B4 is -14.3 dB below the E5 partial.
- **New (should-fix): Bar 2's top note B4 is buried under the first harmonic run, 2.13-2.5.** Stopping the B4 roll at 2.10 leaves one light 'roll' stroke (vel 0.5 x 0.95) from 2.077. rms 25.13-25.50: tune -38.6 vs harmonics -25.7 dBFS (review: -27.8 vs -24.8); in the full mix B4 is -14.3 dB under E5 and about 13 dB under F#5, A5 and B5. The As built notes this as the price of the cue. It conflicts with ruling 3 for a third of the bar.
  Suggestion: Keep the +6 dB only on the first harmonic (the cue needs no more). Lower run 1's notes 2-5 by about 4-6 dB, and make the B4's 2.077 stroke a full 'nail' stroke at vel ~0.9 so that it rings to 2.5. Re-check that the 2.13 cue still reads ok in 600-720 Hz.
- **New (minor): Loudness slid 0.7 LU further below target.** -21.2 LUFS against target -20 (review -20.5): within the 1.5 LU tolerance but 1.2 LU under it, because the harmonics are quieter.
  Suggestion: Raising run 1 notes 2-5 less than cutting, or nudging LEVEL.pipa by about +1 dB (peak is -7.2, so there is room), would bring it back near -20.
- **New (minor): Garbled comment at the PUSH_VEL constant; As built wind figure 1 dB off.** 04-tang.js:37 reads 'const PUSH_VEL = 1; // the fresh stroke ... // a harmonic rings 0.7 s: ...': the HARMONIC_T60 comment is pasted onto the wrong line. As built says the wind peaks at -38.3 dBFS alone; measured -39.3 over 25.1-27.2.
  Suggestion: Move the harmonic comment to the HARMONIC_T60 line, and correct the wind figure in As built.

## Rulings, second round

1. **The top of the tune is heard in bar 2.** Only the first harmonic of run 1 keeps its +6 dB (the cue needs no more); notes 2 to 5 of run 1 come down 4 to 6 dB; and the B4 is a full nail stroke at about vel 0.9 from its last stroke (about u = 2.08) that rings to 2.5. From 2.13 to 2.5 the B4 must be within 6 dB of the harmonics (rms, each alone), and the cue at 2.13 must still read ok.
2. Bring the part back to about -20 LUFS (the peak has room).
3. Move the misplaced comment at `PUSH_VEL` to the `HARMONIC_T60` line and correct the wind's figure in "As built" (-39.3 dBFS).
