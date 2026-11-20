# Review · shortvideo

Independent review of `audio/parts/19-shortvideo.js` on 2026-11-18, by a reviewer who did not write the part and could not listen to it: everything below was measured, read from the score and the code, or seen in a spectrogram. The music director's rulings follow the findings.

**Verdict:** ready

Section 19 is a pop beat built from bell-and-chain sounds. Bar 1 plays through a mono 500-3500 Hz 'phone' bus, and the full-range drop lands on u=2.0. Every row of the brief is present at the time CUES.md gives: pops at 2.04/2.10/2.17/2.24/2.31, taps at 2.91 and 3.0, the like at 3.0, the E6 held through bar 2, sweeps from 1.0 and 5.0, and a dead stop at 6.0. The hook is in tune and in the right octave, and every rule of the guide is kept. The remaining points are about weight and taste: the kick and sub are light for a 'punchy pop' brief, and the echo makes passing whole-tone rubs.

## Findings

### 1. The low end is light for 'short, punchy pop beats' (should-fix)

- **Evidence:** Rendered with --label kick: peak -14.8 dBFS, -28.8 LUFS. Rendered with --label sub: peak -22.8 dBFS, -27.6 LUFS. Rendered with --label "bell hook": peak -9.6 dBFS, -18.1 LUFS, so the kick's peak is 5 dB under the bells'. The whole part peaks at -6.4 dBFS at 115.005, where kick, sub, bell B6, the A6 echo and the click all start on one sample. The arranger turned the kick down to fit that shared peak ('Unsure' in As built). After the drop, bar 2 has kicks only at 2.0 and 2.75, then none until 4.0. The kick's shape is right: 10-90 % in 4 ms, falling 95 Hz to 45 Hz over 40-130 ms.
- **Suggestion:** Free headroom for the kick instead of lowering it. Start the hook bells and the echo 3-5 ms after the kick on the shared downbeats (0, 2.0, 4.0, 5.0), or lower the echo on those beats. Then raise KICK by about 3 dB and SUB by 2-3 dB. Re-check the peak (below -6) and the energy below 120 Hz (must stay under 35 %).

### 2. Each echo rings a whole tone against the next hook note (note)

- **Evidence:** From --print 19, the echo of each note falls on the next hook note: 0.75 E6 echo with F#6; 2.0 A6 echo with B6 (on the drop); 3.0 F#6 echo with the held E6 (the joke note); 4.75 E6 echo with D6; 5.75 A5 echo with B5. Each echo rings for about 0.6 s, about 10 dB under the hook, and has the bell's beating 2.76f partial pair (about 4.08/4.09 kHz on F#6, about 13 Hz roughness).
- **Suggestion:** Matter of taste. If the E6 held at 3.0 should read clean, drop the F#6 echo at 3.0, or damp each echo when the next hook note starts (cap the echo's dur at 0.25 s plus a short fade).

### 3. The hat roll into the frame starts at 5.5, not 5.0 (note)

- **Evidence:** The brief's row for 4.0-6.0 says 'From 5.0 a rising sweep and the hat roll'. In the score, the sweep runs 5.0-5.965 and the plain sixteenth hats crescendo 5.0-5.5. The 32nd-note roll covers only 5.5-5.84.
- **Suggestion:** Acceptable reading of the brief. To follow it literally, start the roll at 5.25 or 5.0.

### 4. Section 20's entrance cue is at its limit in the full film (note)

- **Evidence:** In the --from 111 --to 127 render, section 20's cue 'first note in a sudden quiet' at 119.000 reads a rise of only 3 dB, which is the limit. This part's sub (A1, about -23 dB) sounds until 5.995, as the brief's 'stops dead on 6.0' asks. The bell's own crossing reads 11 dB, and the 1.8-9 kHz band is at -95 dBFS.
- **Suggestion:** No change needed for the brief. If the music director wants more margin, end the sub's last note 20-30 ms earlier, or lower its level from 5.75.

## The checks, as the reviewer ran them

```
--section 19 --check: Level -17.0 LUFS OK (target -16); peak -6.4 dBFS at film 115.005 s, true peak -6.3 dBTP; 20.4 % of the energy below 120 Hz; largest step 0.230 at 117.501; tail silent. Cues 0.00 +2.0 ms ok, 2.00 +3.0 ms (8 dB) ok, 3.00 +2.0 ms (10 dB) ok. Lead 16 notes, median -1.5 cents, worst -3.0 (A6 at 114.00). Bell -95.4 dBFS in 1.8-9 kHz before 119.00. 'Nothing out of tolerance.' At most 81 sources alive.
--with bike: crossing 18 [bike] +1.0 ms 119 dB ok; crossing 19 [bike] +2.0 ms 11 dB ok; Nothing out of tolerance.
--lint 19: nothing found.
Joins (--from 111 --to 127): all cues ok; section 20's first-note cue at 119.000 reads +5.0 ms, rise 3 dB (ok, at the limit).
```

## Rulings

1. **A real kick and sub.** On the shared downbeats the bells and their echo start 3 to 5 ms after the kick; then the kick comes up 3 to 4 dB and the sub 2 to 3 dB. This part alone may now peak as high as -4 dBFS (`PEAK` in `audio/mix.js`; the check knows). Keep less than 35 % of the energy below 120 Hz and the level at -16 LUFS within 1.5.
2. The held E6 at 3.0 reads clean: drop the F#6 echo there, and damp each echo when the next hook note starts (finding 2).
3. The sub's last note ends at u = 5.97, for the piano's entrance (finding 4). Finding 3 stands.

## Second check (after the fix round)

A second independent checker measured every ruling again: 6 of 6 met.

- **New (minor): Section 20's entrance cue has no more margin than before; its lag grew.** In --from 111 --to 121 and --from 117 --to 127, section 20's cue at 119.000 reads +8.0 ms, rise 3 dB (the review had +5.0 ms, 3 dB). The cue passes, but at the limit. In the 118.88-118.965 window before it, RMS is -20.1 dB for the whole part: sub -24.0, hook bells -23.2, sweep -31.9. Raising the sub 2 dB therefore cancelled most of what ending at 5.97 gained. The As built says this openly.
  Suggestion: Optional. For margin, lower the last sub note (5.5-5.97) by 2-3 dB, or end it at 5.94. Either costs nothing in the drop's weight.

## Rulings, second round

1. **Room for the piano's first note.** The sub's last note (u = 5.5 to 5.97) is 3 dB quieter than the others, and the hook's last echo and the sweep are gone by 5.95. In `node tools/audio.mjs --from 117 --to 127 --check` Section 20's cue at 119.0 must rise by at least 5 dB.
2. Nothing else changes.
