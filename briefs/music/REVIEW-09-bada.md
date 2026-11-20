# Review · bada

Independent review of `audio/parts/09-bada.js` on 2026-11-18, by a reviewer who did not write the part and could not listen to it: everything below was measured, read from the score and the code, or seen in a spectrogram. The music director's rulings follow the findings.

**Verdict:** ready

A single node-built xiao (harmonic tone, pitch-following edge noise, breath) plays the seven notes. The eye note bends B4 to D5 over 2.02-2.60, holds straight, and comes down to F#4 at 4.00. The fish's B3-to-D4 bend sits at 3.25-3.70. Times agree with CUES.md (eye 2.0-2.6, hold to 3.6, return 3.6-4.0, fish 3.2-3.8), the brief's probe targets are met, and the code keeps every rule.

## Findings

### 1. Bar-1 gaps are short, so the 'wide gaps' are only in bar 3 (note)

- **Evidence:** In the score, D4 sounds 0.00-0.90 and A4 starts at 0.96 (a 60 ms gap). A4 ends at 1.78 and the eye note starts at 1.96 (180 ms). In s09.png the waveform between 53.9 and 53.96 hardly dips. The brief's own lengths (about 0.9 s and 0.8 s) force this.
- **Suggestion:** If the director wants the bar-1 silence to read, shorten D4 to about 0.65 s plus release, so that it ends about 0.75, and A4 to about 0.6 s. Otherwise leave it.

### 2. The first cue speaks late by design (note)

- **Evidence:** Alone, u0 lag is +49 ms against a 60 ms soft limit (tone attack 0.15 s). With the bike the bell covers it (+1 ms).
- **Suggestion:** Acceptable. A slightly stronger breath onset (breath 1.6 instead of 1.4) would bring it under about 40 ms without making the tone speak faster.

### 3. The fish may be masked by the chain (note)

- **Evidence:** The fish is at 0.18 of the flute's level (about 20 dB under the held D5), while the chain runs at 0.5. This was not measured with --label against the bike because the part's lead table has no fish entry (it is marked free).
- **Suggestion:** Probe 56.25-56.70 in the s09+bike render near 247-294 Hz. If the chain's ticks are within 10 dB, raise the fish to about 0.25.

## The checks, as the reviewer ran them

```
--section 9 --check: Level -25.2 LUFS OK (target -25); peak -20.3 dBFS; largest step 0.011; Cues 53.000 u0.00 +49.0 ms ok (soft), 55.000 u2.00 +19.0 ms ok (soft); Lead 4 notes: median -0.2, worst -0.4 cents (B3 at 57.96 s), 1 marked free; Bell -107.6 dBFS between 1.8 and 9 kHz in the last 30 ms; 'Nothing out of tolerance.' 6 events, 24 sources, at most 16 alive.
--with bike --check: crossing 8 [bike] +1.0 ms ok, crossing 9 [bike] +1.0 ms ok; Nothing out of tolerance.
--lint 9: Lint: nothing found.
Join --from 51 --to 61 --check: bada u0 ok, crossing 8 ok, bada u2.0 +19 ms ok, wayang u0 ok, crossing 9 ok; Nothing out of tolerance.
```

## Rulings

1. **More paper.** The first D4 ends at about u = 0.75 and the A4 lasts about 0.6 s, so that bar 1 has real silences too. This corrects the brief's lengths.
2. Probe u = 3.25 to 3.70 with the bicycle: if the chain's ticks are within 10 dB of the fish in its own band, raise the fish to about 0.25 of the flute (finding 3). Finding 2 stands.

## Acceptance check (whole film, 2026-11-18)

An independent checker matched every part against the tune. For this part: of the tune's six skeleton notes (D A B E F# B) the E on the strong beat (u = 3.0) is absent: the long note bends from B4 up to D5 and is held there. (The F# is reached by the slide at 4.0, which the checker's note matcher did not see.)

## Rulings, third round

1. **The long note rolls up to E5, not D5.** B4 straight to 2.02, then up **500 cents** to E5 by 2.60 (the same smootherstep), held dead straight through the strong beat until 3.6, then down **1000 cents** to arrive on F#4 at 4.00. Everything else about that breath stays: the lowpass closing as it rises, the air rising, the vibrato from 4.08, the release. The tune's E then sounds on the strong beat, an octave up with the eye, and the skeleton D A B E F# B is complete.
   - On the held E5 the fundamental must still be at least 15 dB above the second partial, and the held note must not be more than 1 dB quieter than the held D5 was (probe 2.7–3.5 before and after). If the closing lowpass (2200 → 1150 Hz) now takes too much of the 659 Hz fundamental, close it less.
2. **The fish answers with the same gesture**: B3 bending up 500 cents to E4 (was 300 to D4). Same times, same level relative to the flute.
3. **Let the checker measure the held E5**: a lead mark for u 2.6–3.6 at E5 that is not `free` (it is held dead straight, so it must read in tune). The bends before and after stay `free`. Do it in whatever way the guide's contract allows; the picture must show the dotted line on E5.
4. Bring the music brief up to date: the table in "The three bars" (three semitones to D5 → five to E5; the fish) and "As built". The part must still measure −25 LUFS ± 1.5 alone, and both cues must still read.
