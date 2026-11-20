# Review · intro

Independent review of `audio/parts/00-intro.js` on 2026-11-18, by a reviewer who did not write the part and could not listen to it: everything below was measured, read from the score and the code, or seen in a spectrogram. The music director's rulings follow the findings.

**Verdict:** needs-fixes

Low strings (basses, divisi cellos, a cello line, violas from 3.0), a felt drum at 3.0 and a dark hall. Every row of the brief's timeline is there at its time, the line D3 E3 F#3 | A3 F#3 A3 is in tune, and the harmony is clean. But the part now fails its own check: the hard cue at 3.0 reads 39 ms late because it is measured in the wrong band. Two other things the brief asks for are hardly there. The 3.0-5.0 crescendo measures flat, and the line's first D3 is lost inside the drone's own D3 partial. The pink rosin noise is also made during playback instead of in prepare().

## Findings

### 1. The cue at 3.0 fails the check (+39 ms, limit 19 ms) (must-fix)

- **Evidence:** node tools/audio.mjs --part intro --check: 'line 2 lands ... LATE (limit 19 ms)', +39.0 ms, rise only 11 dB. The cue is declared with band [40,120] (00-intro.js:200). In that band the A1 drum stands only about 10 dB above the D2/A2 drone and takes 30-40 ms to rise: audio-probe s00.wav --at 2.9 --band 40:120 --env goes from -30 to -20.5 dB only at +140 ms (= film 3.04). In 180-900 Hz the sfz is on time: --at 2.95 --band 180:900 --env goes from -28 to -12.9 dB between 3.00 and 3.02.
- **Suggestion:** Declare the 3.0 cue in a band where the accent itself lives (for example band: [180, 900], the cellos' sfz), or give the drum a real initial transient in 40-120 Hz (start the 55 Hz mode at its peak, or add a short pitch drop on the thump). Re-run --check until the cue reads ok, and update the As built numbers.

### 2. The pink rosin noise is made during playback, not in prepare() (must-fix)

- **Evidence:** 00-intro.js:117 calls k.noise('pink', ..., { seed: 3 }), which builds the 6 s pink buffer through prepareNoise on first use. That first use is inside the first play function at film 0. prepare() (lines 157-160) only prepares the hall and the drum. Timed in Node: pink(6*SR) takes 4.8-7.8 ms. The guide (§4 'Compute ahead') says anything over a millisecond is made in prepare(), and names prepareNoise for exactly this case.
- **Suggestion:** Add prepareNoise('pink', 3) to prepare() (import it from ../engine/kit.js).

### 3. No measurable crescendo from 3.0 to 5.0 (should-fix)

- **Evidence:** The brief asks for 'a slow crescendo' from 3.0 to 5.0. RMS of s00.wav in 0.2 s windows over 150-2500 Hz: 3.30 -29.3, 3.60 -28.8, 3.90 -28.7, 4.15 -29.0, 4.35 -29.3, 4.60 -26.9, 4.75 -29.5 dBFS. Full band: -28.4 ... -28.2 ... -28.8. The written envelopes rise about 4 dB, but the decaying sfz and its hall cancel the rise. Then the low strings lift at 4.85, so the last 150 ms before the frame get quieter, not louder.
- **Suggestion:** Start the post-sfz level lower (piano nearer 0.3) and end higher (0.9-1.0 at 4.9), so that the curve gains at least 4-6 dB measured in the window 3.4-4.9. Check it with audio-probe RMS windows, not with the written envelope.

### 4. The line's first note D3 is hidden inside the drone (should-fix)

- **Evidence:** The D3 at 1.0 is in unison with the second harmonic of the basses' D2. audio-probe s00.wav --band 120:400: RMS -33.6 dBFS at 0.75-1.0 (drone only) against -32.8 at 1.5-1.75 (with the line), so the line adds less than 1 dB in its own band. The cue at 1.0 rises only 4 dB. At 2.1-2.45 the drone's D3 partial is as loud as the line's E3 (0.0 against -0.1 dB). The brief's idea depends on the viewer hearing bar 1 of the tune ('taught the tune without noticing').
- **Suggestion:** Thin the drone under the line from about 0.9 (basses and divisi down 4-6 dB, or a darker bass recipe with a weaker 2nd harmonic), or give the line clearer vibrato and presence than the drone, so that D3 and E3 read as a melody over it.

### 5. The four desks' vibratos start in phase (note)

- **Evidence:** 00-intro.js:106 uses k.osc('sine', rate, when, ...) for every desk. All four start at phase 0 at the same 'when'. By the time the vibrato arrives (0.35 s) their phases span only about 0.28 of a cycle (rates 4.8-5.6 Hz). The guide (§3, k.lfo) warns that vibratos moving as one read sharp or flat while they fade in.
- **Suggestion:** Use k.lfo(rate, when, stop, phase) with a different phase for each desk (for example 0, 0.31, 0.58, 0.83).

### 6. The strings stop before the bar line, not on it (note)

- **Evidence:** The low strings lift at 4.85 and the line and violas at 4.95 (score lines 177-178). The brief says they stop on the bar line. The departure is documented in As built and the join at 5.0 is clean (sahara cue +2 ms).
- **Suggestion:** Acceptable. If the crescendo is reworked, end it on the bar line, so that the release, not the build, is what gets shortened.

## The checks, as the reviewer ran them

```
--part intro --check: Level -24.5 LUFS OK (target -24); peak -7.3 dBFS at 3.055; largest step 0.035 at 3.027; tail -93.4 dBFS. Cues: 1.000 +18.0 ms ok; 3.000 +39.0 ms 'line 2 lands; the sketch sets off (sfz, the drum): LATE (limit 19 ms)'; 0.000 too close to the start of the file to measure. Lead 6 notes, worst +7.8 cents (A3 at 3.00). Bell -43.2 dBFS 1.8-9 kHz before 5.00. '1 thing(s) out of tolerance: cue at 3.00 s ... 39.0 ms'. 14 events, 108 sources, max 90 alive.
--with bike --check: 'the sketch sets off [bike]: +2.0 ms ok', 'crossing 0 [bike]: +2.0 ms ok'; the same intro cue LATE at +39 ms; largest step 0.081 at 5.001 (the bell).
--lint intro: 'Lint: nothing found.'
--from 0 --to 9 --check: sahara 5.000 +2.0 ms ok (rise 11 dB); intro 3.000 is still LATE at +39 ms.
Note: the As built quotes '3.0 +9 ms' and '1.0 -29 ms'. tools/audio.mjs and kit.js were modified (04:08 and 04:10) after the part (03:39), so the arranger's quoted report is out of date.
```

## Rulings

1. **The cue at 3.0 must read ok.** Declare it in the band where the accent itself lives (the cellos' sfz, about 180 to 900 Hz), or give the drum a real initial transient. The check must end "Nothing out of tolerance."
2. **The crescendo from 3.0 to 5.0 must be measurable.** Start lower after the sfz and end higher, so that the level in 150 to 2500 Hz (RMS in 0.2 s windows) gains at least 4 dB between 3.4 and 4.9. End the build on the bar line: the low strings may lift at 4.95 like the line. The section stays at -24 LUFS.
3. **The line must be heard over the drone.** From about 0.9 the drone sits 4 to 6 dB lower, or the basses lose most of their second harmonic, so that the line's D3 and E3 read as a melody: in 120 to 400 Hz the stretch 1.5 to 1.75 must measure at least 3 dB above 0.75 to 1.0.
4. Give each desk's vibrato its own phase with `k.lfo` (finding 5).
5. Finding 2 (the noise buffer) needs nothing: the engine now makes both noise buffers before anything plays. Finding 6 stands as it is.
