# Review · sahara

Independent review of `audio/parts/01-sahara.js` on 2026-11-18, by a reviewer who did not write the part and could not listen to it: everything below was measured, read from the score and the code, or seen in a spectrogram. The music director's rulings follow the findings.

**Verdict:** needs-fixes

A caller and a group of synthesized voices, three pitched skins, claps, six tuned taps and a short bright room. The tune, the call and answer, the hummed E, the tutti in octaves and the six taps all match the brief and CUES.md to the millisecond, and the part passes its checks alone and with the bicycle. The weaknesses are sonic. Each singer briefly sounds two pitches at once on every note change. The claps and slaps are buried once the group sings. The skins are tuned between the notes of the key. The last chord is held at full level through the next downbeat.

## Findings

### 1. Every singer sounds two pitches at once at each note change (should-fix)

- **Evidence:** voice() (01-sahara.js:63-101) gives each note its own oscillator, held to dur+0.015 s and then released over 0.07 s. The next note of the same singer reaches full level 0.03 s after it starts, so each singer sounds old and new pitch together for about 50-85 ms on every change. That is a third of each 0.25 s eighth note. Caller alone (--label caller --out out/audio/review-sahara-caller.wav): at 5.525-5.585 the old D3's D5 partial is still -8 dB under the new E3. At 5.775-5.835 the old E3's E4 partial is -14 dB under the new F#3. With eight singers this gives dyad smears (D/E, E/F#, A/B) on every step. A voice cannot do that.
- **Suggestion:** Make the overlap a short crossfade. End each note's release at about the next note's attack, for example hold to dur-0.02 and release over 0.03 when another note of the same singer follows. Or make each singer one oscillator per phrase and move its frequency (the scoop is already there).

### 2. Claps and slaps are buried once the group sings (should-fix)

- **Evidence:** Alone: claps -44.1 LUFS and slaps -48.1 LUFS, against the caller at -22.8 and the men at -21.6 (--label claps/slap --check --out review-sahara-*.wav). At the clap onset at 7.50, in 1-5 kHz: claps alone -33.5 dB, full mix about -27 dB (voices about -28). The claps are about 6 dB under the singing in their own band. In bar 1 they are level with the caller (-35.7 against -38.7). The brief's 'DUM . tak tak' and 'claps on beats 2 and 4' will be heard clearly only under the solo caller.
- **Suggestion:** Raise clap and slap by about 6 dB in bars 2-3 (vel or LEVEL), or carve 1-3 kHz out of the group voices slightly. Then check that the claps stand 3-6 dB above the voices in 1-5 kHz at 7.5, 9.5 and 10.5.

### 3. The skins are tuned between the notes of the key (should-fix)

- **Evidence:** Low skin probe (review-sahara-skin.wav at 5.0): it settles at 88.9-90.3 Hz, F2+32 to F#2-41 cents, with a t60 of about 0.42 s, so it has a clear pitch. The middle skin is at 150-154 Hz (D3+37 to D#3-17); the probe at 2.9 shows 151.9 Hz D#3-41. They sound under sung D3 (146.8), E3 (164.8) and F#3 (185). A pitched drum a quarter-tone off the tonic and off F# will read as out of tune against the voices. The As built already says the middle skin may blur D3 and E3.
- **Suggestion:** The brief says 'about 90' and 'about 150', so retune within that: low skin to F#2 (92.5) or A2 (110 is too high, so keep it near F#2), middle skin to D3 (146.8) or A3/2 territory. Or shorten the tonal ring of both.

### 4. The last chord is held at full level through the next downbeat (should-fix)

- **Evidence:** The last notes (B2/B3 at 5.75, eight singers) hold until u = 6.015 and release to 6.085. audio-probe s01.wav --at 10.95 --env: -18.4, -17.9, -18.6 dB at 10.96-11.02, still -24 at 11.05, and below -50 only at about 11.25. Section 2 is a soft harp, and its cue at 11.0 rose only 6 dB in --from 3 --to 13. The brief says 'keep your tail short'. The bell-band rule passes (-45.8 dBFS).
- **Suggestion:** Begin the last note's release at about u = 5.95-5.98, so that the voices are well down by 6.0, or taper it (swell < 1) so that the chord dies into the frame.

### 5. The voices are likely to read as an organ (note)

- **Evidence:** The source is a fixed 1/k^1.5 PeriodicWave with no jitter, no shimmer and no breath. Vibrato only comes on notes longer than 0.3 s, and 12 of the 16 lead notes are 0.25 s. So most notes are a perfectly steady harmonic tone, apart from a 35 ms scoop and ±2 cents of drift. 2-5 kHz sits 24 dB below the total (rms -44.6 against -20.2 at 9.0-10.0), so the voices are not harsh, but they are dull.
- **Suggestion:** Add a little aspiration noise through the same formants (about -30 dB), and a slow random pitch and amplitude wobble of a few cents and about 0.5 dB, from rng.

### 6. Taps 1 and 4 fall on slap strokes (note)

- **Evidence:** Taps at u = 1.75 and 2.75 coincide with the slap's 3.2 kHz crack (score 6.750 and 7.750). The cue still rises 27 dB in 5-12 kHz, so the tap reads, but in the 2-6 kHz band the slap and the tap's second mode overlap.
- **Suggestion:** Optional: drop the slap at 1.75 and 2.75, or move it a few ms, so that the animals' taps stand alone.

## The checks, as the reviewer ran them

```
--section 1 --check: Level -19.4 LUFS OK (target -19); peak -7.8 dBFS at 9.805; largest step 0.073 at 8.751; tail silence. Cues 5.000 +1.0 ms ok, 6.750 +1.0 ms ok (rise 27 dB), 8.750 +1.0 ms ok. Lead 16 notes, worst -4.6 cents (A2 at 10.50). Bell -45.8 dBFS 1.8-9 kHz before 11.00. 'Nothing out of tolerance.' 84 events, 139 sources, max 78 alive, prepared 0.15 s.
--with bike --check: 'crossing 0 [bike]: +1.0 ms ok' (rise 119 dB), 'crossing 1 [bike]: +2.0 ms ok' (rise 24 dB); 'Nothing out of tolerance.'
--lint 1: 'Lint: nothing found.'
--from 3 --to 13 --check: 'Nothing out of tolerance.'; egypt 11.000 +6.0 ms ok, rise only 6 dB.
```

## Rulings

1. **No singer sounds two pitches at once.** When a singer's next note follows, the old note is gone by about 25 ms after the new one begins (a short cross-fade), or the singer is one oscillator per phrase whose pitch moves. Check one singer alone with `--label`.
2. **Claps and slaps come forward in bars 2 and 3**: about 6 dB up, so that in 1 to 5 kHz they stand 3 to 6 dB above the voices at u = 2.5, 4.5 and 5.5.
3. **The skins are in the key.** Low skin settles on A2 (110 Hz), middle skin on D3 (146.8 Hz). If the middle skin then muddies the men's D3, shorten both rings to under 0.2 s instead and say so.
4. **The last chord is down by the frame.** Begin its release at about u = 5.93 so that the voices are below -30 dBFS at u = 6.0.
5. A little breath through the formants (about 30 dB under the voice) and a slow drift of a few cents and about half a decibel on every singer, from `rng`, so that a held vowel is not a steady organ tone (finding 5).
6. Drop the slap at u = 1.75 and 2.75 so that the animals' taps stand alone there (finding 6).

## Second check (after the fix round)

A second independent checker measured every ruling again: 6 of 6 met.

- **New (minor): Cross-fade leaves a short level dip at every note change.** Old and new notes are both linear ramps (old 25 ms down from -5 ms, new 30 ms up), so for 20-30 ms the sum drops by about 5-6 dB. Caller alone --env 5.45-5.57: -21.4 → -26.7, -26.7 → -21.3 dB at 5.50-5.52. Group (voices only) at 10.48-10.52: -17.0 → -20.6, -23.5 → -18.8 dB. It shows as notches in the waveform at 7.5, 7.75, 9.5, 9.75, 10.5 in recheck-sahara-join.png. At an eighth-note rate this may read as articulation, but it could also sound slightly chopped in the legato group.
  Suggestion: Shape the hand-over as an equal-power cross-fade (for example, the old note's release as a curve that stays near full for the first half), or overlap the old note's release with the new note's attack by 10-15 ms while keeping the 25 ms ruling.

## Rulings, second round

1. **No dip where a singer changes note.** The hand-over stays 25 ms at most, but the sum of the old and the new note must not fall more than about 2 dB under the held level: hold the old note at full until the new one is at least half up (an equal-power cross-fade, or the old note's release starting a few milliseconds after the new note's attack). Measure one singer alone with `--env` across three note changes.
2. Nothing else changes.
