# Review · code

Independent review of `audio/parts/20-code.js` on 2026-11-18, by a reviewer who did not write the part and could not listen to it: everything below was measured, read from the score and the code, or seen in a spectrogram. The music director's rulings follow the findings.

**Verdict:** needs-fixes

Section 20 is a well-built additive piano playing the tune at written pitch, with a left hand in tenths, a soft pad, a barely-there sub, and a climbing staircase of glass notes. The glass notes match every line time in CUES.md and the brief's table. Every check passes, tuning is within 2.4 cents, the piano's anatomy is right, and the joins are clean. Two problems in the code need fixing: the last pad chord's envelope points run backwards in time, so the pad swells and is then cut 70 ms before the frame, and in bar 3 two hands strike the same held piano key.

## Findings

### 1. Last pad chord: envelope points out of order, so the pad swells and then cuts in 30 ms (must-fix)

- **Evidence:** audio/parts/20-code.js:139. The points are [[0,0],[a=0.4,peak],[ev.dur,0.9 peak],[ev.dur+r,0]]. The last PAD entry is [5.5, 0.25, E3 A3 D4] with release 0.18, so the points are 0, 0.4, 0.25, 0.43: the time goes backwards. Web Audio sorts the events by time, which gives a ramp to 0.9 peak at 5.75, a ramp up to peak at 5.90, and a drop to 0 by 5.93. Rendered with --label pad and probed (audio-probe --at 124.0 --len 1 --env): the level stays near -31 to -35 dB up to 124.90, then falls to -52 dB at 124.93, a 17 dB drop in 30 ms. As built says the chord is 'released so it is silent by 5.93', but the actual shape is a crescendo into the frame and a chop, not a release.
- **Suggestion:** Clamp the attack to the note's length, for example a = Math.min(0.4, ev.dur * 0.6), so every point after it comes later in time. Or give the 5.5 chord its own short envelope, for example [[0,0],[0.15,peak*0.8],[0.25,peak*0.7],[0.43,0]]. Check with --label pad that the level falls smoothly from 5.75.

### 2. Both hands strike the same key, A3, while it is held (should-fix)

- **Evidence:** From pianoNotes() and --print 20: the 4.0 'piano chord' holds A3 (MIDI 57) in the right hand from 4.0 to 4.66, ringing to about 4.82 with the damper. The left hand strikes the same A3 at 4.5 for 0.48 s. A piano has one string set per key and cannot sound one key twice at once. The code adds two A3 buffers together, so A3 is doubled and louder for 4.5-4.82, at the moment the tune walks down (E4 at 4.5, D4 at 4.75) and just before the 4.6 cue.
- **Suggestion:** End the right hand's inner A3 at 4.48 (dur 0.48) and keep its D4. Or voice the 4.0 chord as F#3 + D4 or D4 alone, and leave A3 to the left hand at 4.5.

### 3. The sub plays D2 under both D/F# chords, cancelling the inversion (note)

- **Evidence:** In the SUB array, D2 sounds from 0 to 2.0 and from 4.0 to 5.0. At u = 1.0 (Dadd9/F#) and u = 4.0 (D/F#) the left hand and the pad put F# in the bass (F#2, F#3). The sub sounds D2 below them, so the slash chords read as root position. The sub is about 15 LU under the piano, so the effect is small.
- **Suggestion:** Give the sub F#1 (or nothing) at 1.0-2.0 and 4.0-5.0, or drop it there.

### 4. Pad releases overlap the next chord by a semitone (note)

- **Evidence:** The pad's release is 0.35 s and its attack 0.4 s. The Asus4 D4 releases over 3.5-3.85 while C#4 swells in, in the pad and the left hand at 3.5. The D/F# chord's F#3 releases over 5.0-5.35 while the G(add9) chord's G3 swells in. Both are short semitone rubs, about 30 dB down.
- **Suggestion:** Taste. Shorten the release to about 0.2 s on the chords that resolve by a semitone (3.0 and 4.0).

## The checks, as the reviewer ran them

```
--section 20 --check: Level -20.3 LUFS OK (target -20); peak -6.3 dBFS at film 123.013 s; 14.5 % of the energy below 120 Hz; largest step 0.060; tail silent. Cues 0.00 +3.0 ms (124 dB) ok, 2.00 +4.0 ms (5 dB) ok, 3.00 +6.0 ms (7 dB) ok, 4.00 +4.0 ms (14 dB) ok, 4.60 +4.0 ms (5 dB) ok. Lead 16 notes, median 0.1 cents, worst -2.4 (A4 at 121.50). Bell -62.8 dBFS in 1.8-9 kHz before 125.00. 'Nothing out of tolerance.' At most 73 sources alive.
--with bike: crossing 19 [bike] +1.0 ms 119 dB ok; crossing 20 [bike] +2.0 ms 32 dB ok; tail -73.6 dBFS; Nothing out of tolerance.
--lint 20: nothing found.
Joins (--from 117 --to 127): all cues ok; first note at 119.000 rise 3 dB (at the limit, caused by section 19's sub running to 5.995).
```

## Rulings

1. **The last pad chord's envelope runs forwards.** Clamp the attack to the note's length (or give the 5.5 chord its own short envelope) so that the pad falls smoothly from 5.75 and is gone by 6.0. Check with `--label pad`.
2. **No key is struck twice at once.** The right hand's inner A3 ends at 4.48, or the 4.0 chord is voiced without it.
3. No sub under the two D/F# chords (1.0 to 2.0 and 4.0 to 5.0), finding 3. A pad release of about 0.2 s on the chords that resolve by a semitone (finding 4).
