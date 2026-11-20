# Review · vapor

Independent review of `audio/parts/18-vapor.js` on 2026-11-18, by a reviewer who did not write the part and could not listen to it: everything below was measured, read from the score and the code, or seen in a spectrogram. The music director's rulings follow the findings.

**Verdict:** needs-fixes

Section 18 renders an original F# major smooth-jazz source in prepare() and plays it through a tape model: a slide in, steady 0.7937 playback, a four-times skip, the jump forward at 4.0 and a run-up reaching 1.0 at u 6.0. Chords, bass, the tune's skeleton and every time on the tape table are correct. One rule is broken: the hiss's 6 s pink-noise buffer is made inside a play function. Several requirements are met only on paper: the skip is audible mainly as a restarting kick, because the wet room fills the midrange; the wobble is +-5 cents, not +-12; the hiss is inaudible. The saxophone's 80 ms release also makes successive eighth notes overlap.

## Findings

### 1. The hiss's 6 s pink-noise buffer is computed inside the bed's play function (must-fix)

- **Evidence:** 18-vapor.js:495 calls `k.noise("pink", ..., { seed: 19 })`. Kit.noise calls prepareNoise, which builds a 6 s, 288000-sample pink buffer the first time it is asked for. prepare() (lines 513-521) never calls prepareNoise("pink", 19), and no other part uses pink/19. Timed in Node: pink(6*48000) takes 4.2-5.3 ms per call, which breaks the guide's "Compute ahead" rule (more than 1 ms, a buffer of a second or more). The white seeds 18, 5 and 6 are fine: they are made inside renderSource() in prepare().
- **Suggestion:** Import prepareNoise from kit.js and call prepareNoise("pink", 19) in prepare(). Calling prepareNoise("white", 18) as well makes the outro's `sax` lead independent of renderSource having run.

### 2. The skipping-record joke is masked above 200 Hz by the wet room (should-fix)

- **Evidence:** In s18.wav, 800-4000 Hz in 10 ms steps across the cuts is flat: 109.95-110.07 -30.8 to -32.8 dB; 110.20-110.32 -33.4 to -36.6; 110.45-110.57 -33.3 to -38.1, with no re-attack at the block boundaries. 100-400 Hz is also flat (-20 to -22 dB). Only the kick's body in 38-66 Hz shows the restarts (-60 to -33 dB). After the tape stops at 113.03 the room alone still reads -20 to -27 dB broadband, about the level during playback, so the wet return is at least as loud as the dry tape. The four identical blocks the brief asks to see from 3.0 to 4.0 appear in s18.png only below 100 Hz.
- **Suggestion:** During 3.0-4.0, duck the room's send (for example SEND to 0.1 from 2.98 and back at 4.0, scheduled from the skip events' `when`) and/or raise the dry path for the skip blocks. The cut and the re-struck chord and sax attack will then read four times. Afterwards, re-declare the skip cues in a mid band (for example 600-3000 Hz) to prove it.

### 3. The saxophone's notes overlap: an 80 ms release on a monophonic instrument (should-fix)

- **Evidence:** In sax(), rel = 0.08 (line 110), and the amplitude envelope runs to dur+rel (line 143). In saxLine() (line 306), eighths are 0.97 x 0.198 s = 0.192 s long in the source and the next note starts 0.198 s (+0.012 late) after. Each note's release therefore sounds under the next for about 74 ms, 37 % of an eighth, or about 93 ms of film. E4/F#4, F#4/A4 and so on sound as dyads at every change. Quarter notes (legato 0.92) overlap by about 36 ms. The outro uses the same `sax` as its `lead`, so it carries the same smear.
- **Suggestion:** Make it monophonic in effect. Either shorten the release to about 20-25 ms, or end each note so that dur + rel is at most the next onset + 0.02 (a short cross-fade legato). A cleaner way is to glide one voice between pitches.

### 4. Tape wobble is +-5 cents, not the brief's +-12 (should-fix)

- **Evidence:** WOBBLE_CENTS = 5 (line 68). The As built says +-10 and +-7 failed the lead-tuning check (12-16 cents). The guide gives a per-note `tol: 25` for exactly this case, a voice that wobbles on purpose.
- **Suggestion:** Mark the `sung` marker notes with `tol: 20` (or 25) and restore WOBBLE_CENTS to about 10-12. Re-run the check.

### 5. Tape hiss is about 17 dB below the rest of the mix in its own band, so it cannot be heard (should-fix)

- **Evidence:** --label hiss (review-vapor-bed.wav): -67.2 LUFS, peak -61.6 dBFS. In 3-9 kHz over film 108.5-111.5, hiss alone has rms -75.3 dBFS (mean of 10 ms bins -74.1 dB). The full s18.wav has rms -58.3 dBFS (mean -56.6 dB) in the same band. The owner asks for a "very subtle layer of tape hiss". At this level it is absent, not subtle.
- **Suggestion:** Raise HISS about 10-12 dB (0.0022 to about 0.008), which is still around -55 LUFS alone. Check that the bell band in the last 30 ms before u 6 stays quiet (the hiss already fades out 6.02-6.09).

### 6. Skip cue timings sit at the 15 ms limit because they are measured in 38-66 Hz (note)

- **Evidence:** The cues at 3.25, 3.5, 3.75 and 4.0 read +15.0 ms (limit 15) and 3.0 reads +14.0 ms, measured in band [38, 66], where the analysis blurs time. The blocks are scheduled exactly by construction (s.at(3 + 0.25 i)), so the cuts themselves are on time. The pass is fragile, and the As built admits it depends on the kick's head.
- **Suggestion:** Once the skip is audible in the midrange (see the previous finding), measure the cues in a mid band, where the timing reads to a few ms.

### 7. Lead B4 at u 2.0 reads +11.6 cents against a 12-cent limit (note)

- **Evidence:** --check: "worst +11.6 cents (B4 at film 109.00 s)". The As built explains this as the room's return cancelling the fundamental.
- **Suggestion:** This is fixed in passing by the `tol` on the marker notes proposed for the wobble.

### 8. The tape segments 'slide' (0.8 s) and 'B' (1.2 s) are not seekable (note)

- **Evidence:** Lines 541 and 544 have no `seekable` flag. Scrubbing into u 4.0-5.2 gives only the hiss and the room until the run-up starts at 5.2. This is allowed: the guide asks for seekable only above 2 s.
- **Suggestion:** Optional: mark B `seekable: true`. tape() already handles ev.offset for every segment.

### 9. The run-up and the room's tail cross into section 19 out of key (note)

- **Evidence:** By u 6.0 the tape is back at rate 1.0 (+4 semitones, F# major material on the C#13 chord). The room's return then fades out over 6.0-7.5 under section 19's thin opening and under the bell's D (s18.png and t105-115.png show the tail to about 113.8 in 100-600 Hz). This is the owner's own requirement and it passes -50 dBFS by u 8.
- **Suggestion:** No change required. If the join sounds sour, shortening the return's fade (7.5 to 7.0) reduces the overlap.

## The checks, as the reviewer ran them

```
--section 18 --check: Level -19.2 LUFS OK (target -19); peak -7.7 dBFS at 112.475; Clicks largest step 0.017; Cues 0.00 +3.0 ms (82 dB) ok; 3.00 +14.0 ms (26 dB) ok; 3.25 +15.0 ms (14 dB) ok; 3.50 +15.0 ms ok; 3.75 +15.0 ms ok; 4.00 +15.0 ms (16 dB) ok; Lead 11 notes, median -0.2, worst +11.6 cents (B4 at 109.00), 5 free; Bell -54.7 dBFS in 1.8-9 kHz in the last 30 ms; "Nothing out of tolerance." prepared 0.28 s.
--section 18 --with bike --check: crossing 17 [bike] +1.0 ms 86 dB ok; crossing 18 [bike] +2.0 ms 31 dB ok; "Nothing out of tolerance." ("Slow to prepare: 0.71 s" for vapor + bike; vapor's allowance is 1 s).
--lint 18: "Lint: nothing found."
--from 105 --to 115 --check: all cues ok (vapor u0 rise 4 dB, shortvideo u0 rise 7 dB); "Nothing out of tolerance."
```

## Rulings

1. **The skip is heard as a skip.** From u = 2.98 to 4.0 the room's send is ducked (to about 0.1) and the dry tape comes up, so that the restruck chord and saxophone are heard four times; then declare the skip cues in a mid band (for example 300 to 3000 Hz) and they must read ok.
2. **One saxophone.** No note of it sounds under the next: a release of 20 to 25 ms, or a legato cross-fade no longer than that.
3. **The wobble is about 10 cents either way**, as asked, and the marker notes carry `tol: 25` so that the check allows it.
4. **The hiss is subtle, not absent**: 10 to 12 dB up.
5. Mark segment B seekable (finding 8). Finding 1 (the noise buffer) needs nothing: the engine now makes both noise buffers before anything plays. Findings 6, 7 and 9 stand.

## Acceptance check (whole film, 2026-11-18)

Two independent checkers, on the owner's brief and on the project's rules.

- The owner's brief asks for an "FM saxophone playing a variation of the main melody". `saxLine()` keeps `theme({ tonic: 66 })` note for note: the only changes are 12 ms of lateness on the off-beat notes, scoops at beats 2, 4 and 8, and a fall at 5.5. That is an inflection, not a variation.
- `node tools/audio.mjs --from 117.2 --to 118.2` fails: "ERROR in vapor (event at 107.800 s): ... The start time provided (-2.22045e-16) is less than the minimum bound (0)", exit 1. It happens to any render whose 8 s preroll begins inside this section: a seekable stretch of tape is then started part-way at context time 0, and in `tape()` `at(u0)` = `when - off + off` comes out a hair below zero. The Player clamps only `when`, not times a part derives from it.

## Rulings, third round

1. **A real variation.** Rewrite `saxLine()` so the saxophone plays this, given here in D (transpose to the source key exactly as `theme({ tonic: 66 })` does; beats as in the tune, twelve to the phrase). The six skeleton notes stay on their beats with their scoops; what lies between them changes:

   | beat | the tune | the saxophone |
   |---|---|---|
   | 0 | D (1) | D (1), unchanged |
   | 1 – 2 | E (½) F# (½) | E (½), F# (¼), **G (¼)**: a passing note up into the A |
   | 2 | A (1) | A (1), scooped, unchanged |
   | 3 – 4 | F# (½) A (½) | **F# (¼) E (¼) F# (¼) A (¼)**: a turn that climbs into the B |
   | 4 – 6 | B (1) A (½) F# (½) | **B held 1½ beats** (scooped), then **A (¼) F# (¼)** at 5.5 and 5.75, falling quickly onto the E |
   | 6 | E (2) | E (2), unchanged: the skip repeats its attack, which must stay exactly on beat 6 |
   | 8 – 9 | F# (1) | **F# (¾)**, scooped, then **A (¼)** at 8.75, an escape note up |
   | 9 – 10 | E (½) D (½) | unchanged |
   | 10 – 12 | B, (1) A, (½) B, (½) | unchanged (the tape is already running up) |

   The quarter-beat notes are lighter than the half-beat notes (about 0.6) and sit a little behind as the off-beat notes do now; the saxophone stays one voice (a note's sustain ends by the next onset). The G is the only note outside the five-note scale: a passing note on the weakest part of the beat. Check it against the electric piano's voicing sounding at that moment: if it lies a semitone from a sustained chord note and you judge it a clash and not a passing note, use E (¼) F# (¼) E (¼) F# (¼) for beats 1–2 instead and say so.
   - The marks for the checker (`sung`, in `score()`) must describe what the saxophone now plays. Notes of half a beat or longer: `lead: true, tol: 25`, `free` at the slide in and the run-up, as now. The quarter-beat notes are too short to measure through the tape and the hall: mark them `lead: true, free: true` so the picture still shows them.
   - The `lead` export (the saxophone as the outro's instrument) stays exactly as it is.
   - Afterwards: the skip cues (66–150 Hz) still read, −19 LUFS ± 1.5 alone, the peak passes, both checks end "Nothing out of tolerance."
2. **Never a negative time.** In `tape()`, and anywhere else in this file where a time derived from `when` goes to a raw Web Audio call (`start`, `stop`, a parameter method), take `Math.max(0, …)`. Prove it: `node tools/audio.mjs --from 117.2 --to 118.2 --out out/audio/vapor-r3-a.wav`, and the same from 116.0, 118.9 and 120.3, must render with no ERROR line and exit 0. (The engine is getting its own guard as well; yours must not depend on it.)
3. Bring "As built" in the music brief up to date (the variation written out, what was measured, that nobody has listened).
