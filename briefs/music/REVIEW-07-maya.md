# Review · maya

Independent review of `audio/parts/07-maya.js` on 2026-11-18, by a reviewer who did not write the part and could not listen to it: everything below was measured, read from the score and the code, or seen in a spectrogram. The music director's rulings follow the findings.

**Verdict:** ready

A clay flute plays the whole tune, with a tall drum on the bar lines, a rattle on beats 2 and 4, and every stroke of the scribe's numbers on a slit drum, a rim or a turtle shell, at exactly the CUES.md sub-times (counts 7, 8, 1+2, 3, 4). Every check passes. The flute has the right anatomy (2nd harmonic -32 dB, a scoop that settles in under 60 ms), and the shell at 3.0 stands clear (30 ms RMS -22.5 dB against -35.4 just before). Nothing here needs fixing.

## Findings

### 1. Slit drum box mode is G2, and the comment calls it the wrong interval (note)

- **Evidence:** tongueSamples line 101: box mode at 98 + 2v Hz (G2, a fifth below D3), amp 0.12, t60 0.15. The comment says "an octave and a fifth below the low tongue" (that would be G1, 49 Hz). G is outside the tune's D E F# A B, and it sounds faintly on all 14 slit-drum strokes, mostly in bar 1-2 over the tall drum's D2.
- **Suggestion:** Optional: put the box mode on A2 (110 Hz) or D2 (73 Hz) so it sits in the scale, and correct the comment.

### 2. Page 6 (43) is painted at u 6.00-6.28 with no sound (note)

- **Evidence:** CUES.md Section 7, row 6.00: dots at 6.00, 6.06, 6.12, twenties 6.22, 6.28, which fall in Section 8's time. This part correctly stops at u 6 (the last flute note is silent at 5.953).
- **Suggestion:** Nothing for this part. The music director may decide whether Section 8 (or the bike's bell) should acknowledge these strokes.

## The checks, as the reviewer ran them

```
--section 7 --check: Level -20.0 LUFS OK (target -20), peak -7.4 dBFS at 45.022, LRA 1.2 LU; largest step 0.060; tail silence; cues u0 +2, u1 +5, u2 +2, u3 +1 (26 dB), u4 +2, u5 +5 ms all ok; Lead 16 notes, worst +3.7 cents (D5 at 45.75); Bell -85.1 dBFS. "Nothing out of tolerance." 50 events, max 34 alive.
--with bike --check: crossing 6 [bike] +1.0 ms 119 dB ok; crossing 7 [bike] +1.0 ms 44 dB ok. "Nothing out of tolerance."
--lint 7: "Lint: nothing found."
--from 39 --to 49 --check: Nothing out of tolerance (joins with qingming and mughal clean).
```

## Rulings

1. Done by the music director: the slit drum's box mode now sits on A2 (110 Hz), a note of the tune, and its comment is corrected. Nothing else to change.
