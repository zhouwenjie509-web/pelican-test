# Review · wayang

Independent review of `audio/parts/10-wayang.js` on 2026-11-18, by a reviewer who did not write the part and could not listen to it: everything below was measured, read from the score and the code, or seen in a spectrogram. The music director's rulings follow the findings.

**Verdict:** needs-fixes

A full slendro gamelan built from prepared buffers: saron tune (partials measured at 1 and 2.76x), peking, slenthem, bonang anticipations and ripple, gong/kempul/kenong, kendang, the puppeteer's mallet and plates, and plate ticks on the wheel steps. Every row of the brief is present and timed to CUES.md (3.0 slap, 3.50/3.75 knocks). The slendro mapping and the tune are correct and all checks pass. Bar 2 does not hush, though: the gender shimmer is louder than bar 1 and buries the quiet saron tune. The opening gong is mostly a thump.

## Findings

### 1. No hush in bar 2: the gender shimmer is louder than bar 1 and buries the saron's B, A, F# (should-fix)

- **Evidence:** Probe rms over windows (s10.wav and --label renders). Mix: bar 1 (59.1-60.95) -23.0 dBFS; 'hush' 2.05-2.45 -25.9 (only 2.9 dB down); swell 2.5-2.9 -21.3 (1.7 dB louder than bar 1). Gender alone: -30.0 in 2.05-2.45 and -22.3 in 2.5-2.9. Saron (the lead) alone: -35.9 and -31.4. The lead tune is 6 dB under the gender in the hush and 9 dB under it in the swell. With --check per label, the gender gates to -22.4 LUFS against the saron's -24.5 LUFS. The brief asks that 'the orchestra hushes' and that the saron play B, A, F# 'quietly', and its Check says 'a hush from 2.0'. The skeleton B4 at 2.0 is struck at vel 0.3 under kempul and gender.
- **Suggestion:** Bring the gender down about 8 dB (INST.gender.gain 0.19 to about 0.075). Start its growth from a lower floor (grow 0.05 + ...) so that 2.0-2.5 sits 8-10 dB under bar 1 and the swell peaks no higher than bar 1 by 2.9. Raise the hushed saron from vel 0.3 to about 0.4, so that B4/A4/F#4 sit at least 3 dB above the shimmer. Re-probe 61.05-61.45 and 61.5-61.9 against bar 1.

### 2. The opening gong is mostly a thump: its ring sits about 14 dB under the mix, at 73 Hz only (should-fix)

- **Evidence:** Gong alone (--label gong, out/audio/review-wayang-gong.wav). Peak -16.4 dBFS is the beater thump, which is 20 dB down 112 ms after the peak. Body from 59.2-60.2 has rms -36.3 dBFS against the mix's -22.5. Its spectrum is D2 73.5 Hz, the octave at -15.7 dB, 214 Hz at -34 dB and nothing else above -50 dB. On anything but full-range speakers the 'deep gong on u = 0' will be heard only as a thud coinciding with the kendang dhung (84 Hz), and the gong on 3.0 is covered by the mallet knock.
- **Suggestion:** Raise the gong's body about 6 dB (gain 0.21 to about 0.3; the thump can stay or drop to 0.08). Give it the mid 'hum' a real gong has: upper modes at roughly 2.3x, 2.9x, 3.7x and 4.8x at -12 to -20 dB, ringing about 0.5-0.7 of t60, so that it reads on small speakers. Check the peak at 3.0 afterwards (it is -6.3 now): drop the plates or knock 1 dB if needed rather than the gong.

### 3. Level 1.1 LU under target with the peak at its limit (note)

- **Evidence:** -20.1 LUFS against -19, peak -6.3 dBFS at 62.023 (the u = 3.0 stack). As built says this.
- **Suggestion:** Once the gender is lowered (above), the u = 3.0 stack and bars 1 and 3 can come up about 1 dB if the attacks at 3.0 are spread a few ms more (the knock at 3.000 and the saron E at 3.000 coincide).

### 4. The outro's lead covers only D3 to C#6 (note)

- **Evidence:** bronzePitches() prepares saron D3..C#6 of the major scale. A pitch outside that range would be built inside the play function: barSamples is a 2.4 s modal buffer, which is heavy. The same holds for mughal's lead (prepared A3..D5).
- **Suggestion:** No change is needed if the outro stays within the tune's range. Otherwise widen the prepared list.

## The checks, as the reviewer ran them

```
--section 10 --check: Level -20.1 LUFS OK (target -19); peak -6.3 dBFS at film 62.023 s; largest step 0.064; Cues 59.000 u0 +1.0 ms ok, 62.000 u3.00 +2.0 ms ok, 62.500 u3.50 +1.0 ms ok, 62.750 u3.75 +1.0 ms ok; Lead 16 notes: median -0.7 cents, worst -7.9 cents (A4+20 at film 61.50 s); Bell -66.7 dBFS between 1.8 and 9 kHz in the last 30 ms; 'Nothing out of tolerance.' 143 events, at most 68 alive.
--with bike --check: crossing 9 [bike] +1.0 ms ok, crossing 10 [bike] +2.0 ms ok; peak -6.3 dBFS; Nothing out of tolerance.
--lint 10: Lint: nothing found.
Join --from 57 --to 67 --check: all cues ok including ukiyoe u0 and crossing 10; Nothing out of tolerance (peak -5.5 dBFS and step 0.180 at 65.00x come from Section 11's start, not this part).
```

## Rulings

1. **Bar 2 hushes.** Gender about 8 dB down, growing from a lower floor, so that u = 2.0 to 2.5 sits 8 to 10 dB under bar 1 and the swell is no louder than bar 1 by 2.9; the hushed saron a little up (vel about 0.4) so that B, A, F# stand at least 3 dB over the gender.
2. **The gong is a gong.** Its body about 6 dB up, with upper modes (near 2.3, 2.9, 3.7 and 4.8 times the note, 12 to 20 dB down) so that it is heard on small speakers; the beater's thump may come down.
3. Then bars 1 and 3 about 1 dB up towards -19 LUFS if the peak allows; spread the attacks on 3.0 a few milliseconds more if needed (finding 3). Finding 4 stands.
