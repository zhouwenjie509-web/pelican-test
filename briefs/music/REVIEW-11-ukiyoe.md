# Review · ukiyoe

Independent review of `audio/parts/11-ukiyoe.js` on 2026-11-18, by a reviewer who did not write the part and could not listen to it: everything below was measured, read from the score and the code, or seen in a spectrogram. The music director's rulings follow the findings.

**Verdict:** ready

A shamisen (pluck with skin crack, nasal peak and sawari on open D3) plays the tune in the in scale. Rain made of separate drops comes in at 2.0, a patter on the umbrella runs from 3.02, and a pop with one hyoshigi clack lands at 3.0. The part passes every check alone, with the bike and with its neighbours, every row of the brief is in the score at the CUES.md times, and the rain does not bury the lead. The only real weakness is the fold rustle at 5.0, which is masked.

## Findings

### 1. The umbrella-fold rustle (5.0-5.15) cannot be heard, and the shutting click is masked (should-fix)

- **Evidence:** Rendered with --label fold (out/audio/review-ukiyoe-fold.wav) and compared with s11.wav in 50 ms windows, 1.5-4.5 kHz: the rustle measures -70.8 / -65.0 / -60.9 dB at 70.00 / 70.05 / 70.10, against -25.7 / -29.4 / -31.6 dB for the mix, so it is 35-45 dB under. The click at 70.15 measures -47.4 dB against -34.7 dB for the mix (13 dB under). The cause is the Bb3 downstroke plus the open D3 struck on the same beat (5.0), with LEVEL.fold = 0.07. The brief's row for 5.0-5.15 asks for "A small rustle and click".
- **Suggestion:** Raise LEVEL.fold about 4-6x (around 0.3-0.4), or move most of the rustle to just after the Bb3 attack (5.05-5.15), and keep it out of the last 30 ms before u = 6. Then recheck with --label fold against the mix.

### 2. The rain's rise follows the brief, not the picture (note)

- **Evidence:** shower() reaches 82% at u = 2.4 (ease-out over 0.4 s). CUES.md (src/scenes/ukiyoe.js:1677) has the main rain at 82% by 2.18 and the grey wipe over 2.0-2.4. As built already notes this. The cue at 2.0 itself is correct (+2 ms).
- **Suggestion:** Optional: reach 82% by 2.18 to match the picture, which would make the downbeat of the shower crisper.

### 3. The rain sits close to the shamisen's own treble (note)

- **Evidence:** Stems over 66.5-70.5 in 0.5 s windows: in 2-9 kHz the rain measures -37.4 to -40.3 dB and the shamisen -32.9 to -36.5 dB; full band, rain -35.7 to -38.5 dB and shamisen -24.2 to -26.3 dB. The checker's "hard to hear" line is empty, so the tune is not buried. In the spectrogram, though, the rain band is hard to tell apart from the strokes' own 2-10 kHz partials, and the rise at 2.0 is only about 3 dB from first to heaviest (-38.5 to -35.7).
- **Suggestion:** No change required. If the rain should read more clearly as weather, lower the shamisen's 7-10 kHz content slightly rather than raising the rain.

## The checks, as the reviewer ran them

```
--section 11 --check: Level -21.0 LUFS OK (target -20); peak -6.4 dBFS at 68.055; largest step 0.186 at 68.002; cues 65.000 +1.0 ms ok, 67.000 +2.0 ms ok (soft, 4-9 kHz), 68.000 +1.0 ms ok; Lead 16 notes median 0.1 cents, worst +5.3 (D#4 at 68.00); Bell -70.4 dBFS in 1.8-9 kHz last 30 ms; "Nothing out of tolerance." 39 events, at most 24 alive.
--with bike --check: crossing 10 [bike] +2.0 ms ok, crossing 11 [bike] +2.0 ms ok (rise 25 dB); peak -6.4 dBFS at 65.007; "Nothing out of tolerance."
--lint 11: "Lint: nothing found."
--from 63 --to 73 --check: all cues ok, the 71.0 crossing rises 26 dB, peak -5.5 dBFS at 65.003 (Section 10's gongs plus the downbeat), "Nothing out of tolerance."
```

## Rulings

1. **The umbrella is heard folding.** The rustle 4 to 6 times louder or moved to just after the Bb3's attack (5.05 to 5.15), and the click at 5.15 at least level with the mix in 1.5 to 4.5 kHz. Nothing of it in the last 30 ms before u = 6.
2. The rain reaches 82 % by u = 2.18, as in the picture (finding 2). Finding 3 stands.
