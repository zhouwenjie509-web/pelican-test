# Review · nosferatu

Independent review of `audio/parts/14-nosferatu.js` on 2026-11-18, by a reviewer who did not write the part and could not listen to it: everything below was measured, read from the score and the code, or seen in a spectrogram. The music director's rulings follow the findings.

**Verdict:** needs-fixes

A silent-film cinema piano (tune in octaves, tremolo left hand, a chromatic climb in bar 2) with a pipe organ (soft pedal, a full-organ diminished seventh at 3.0, a high A in bar 3), a door creak, the fire, and a projector. Every row of the brief is in the score at the right time, the notes are right in D minor, and all checks pass. The problems: the outro `lead` builds piano buffers inside the play function for pitches that were not prepared. The full-organ fright and the door creak are both weak against the piano. The projector is effectively inaudible.

## Findings

### 1. Outro lead computes piano buffers inside the play function for major-scale pitches (must-fix)

- **Evidence:** USED.short covers only the minor-scale pitches plus the chromatic A1-A3 (it prints 33..58, 62,64,65,69,70,74,76,77,81,82). For a note with dur+0.09 <= 0.73 s, `lead` asks for a SHORT buffer, so F#4 (66), B4 (71) and B3 (59) are made on demand inside the play function. Timed in Node: pianoSamples(66, 0.75) 17.5 ms, (71) 7.8 ms, (59) 10.7 ms. The guide says anything over 1 ms is made in prepare(), and the outro will certainly ask for F#4 (the tune's 3rd note).
- **Suggestion:** Add the major-scale pitches of the outro's range (A3..D5 or wider) to USED.short as well as USED.long. Check that prepare() stays under 0.4 s: it already measures 0.25-0.3 s, so consider shortening the LONG buffers or preparing fewer pitches.

### 2. The full-organ fright at u 3.0 is barely louder than the piano (should-fix)

- **Evidence:** Measured rise at the 3.0 cue is 6 dB, the smallest in the section (stair 10 dB, door 23 dB). Probe RMS: organ alone 86.05-86.95 is -19.7 dBFS; piano alone over bar 1 (83-85) is -22.4 dBFS, so the organ is only about 2.7 dB louder. The mix 86.0-86.5 is -19.4 dBFS rms against -22.2 at 85.0-85.5. The organ's peak alone (-7.3 at 86.51) is below the piano's Bb accent (-6.3 at 85.013). The brief's check asks for the organ's edge at 3.0 to be the hardest in the section, and the As built admits it is not.
- **Suggestion:** Make the contrast with the piano rather than with the peak. Bring bars 1-2 piano down 3-4 dB, and lower the Bb accent at 2.0 from vel 0.92 to the level of the other notes. Then lift the organ (LV.organ) by the same amount and re-level to -18 LUFS. Spreading the chord's attacks by a few ms would also lower its crest.

### 3. Door creak masked by piano and organ reverb (should-fix)

- **Evidence:** Door rendered alone (out/audio/review-nosferatu-door.wav), 87.03-87.60: rms -36.4 dBFS, and -39.7 dBFS in 800-1600 Hz, where the squeal's fundamental (950-1180 Hz, tracked) lives. The full mix in the same band and window is -31.3 dBFS, so the creak sits about 8 dB under the music in its own band. Only its 2-5 kHz harmonics show in s14.png. The 4.0 cue only reads ok because it is measured on the latch at 7-9 kHz.
- **Suggestion:** Raise LV.door by about 6-8 dB, or duck the piano bar-3 entry (F4/F3 at 4.0) and the tremolo for the first 0.3 s. The creak is the event the picture shows at 4.0 and should be clearly on top from 4.0 to 4.6.

### 4. Projector is effectively inaudible (should-fix)

- **Evidence:** --label projector renders at -50.2 LUFS over 83-89, 32 LU under the section's -18 LUFS. Under a piano at that distance it is fully masked: the 18 fps flutter the brief and CUES tie to the picture contributes nothing.
- **Suggestion:** "Barely there" suggests about 20-24 LU under the music, not 32. Raise LV.projector by about 8-10 dB and check that the 1.3 kHz ticks do not become a click track.

### 5. Same piano key restruck while the previous stroke still sounds (note)

- **Evidence:** The tremolo strikes each key every 0.125 s, but each stroke sounds dur 0.10 + DAMP 0.09 = 0.19 s. So two copies of the same string buffer overlap for about 65 ms at an arbitrary phase (for example D3 at 0.0 and 0.125). A real string cannot sound twice: the restrike replaces the vibration.
- **Suggestion:** Shorten the tremolo strokes so that dur + DAMP <= 0.125, or stop the previous stroke of that key when it is restruck.

### 6. The tune's held E is not prominent in the organ chord (note)

- **Evidence:** Probe at 86.15-86.75: Bb3 (233 Hz) is the strongest partial at 0 dB, Bb2 is at -3.5 and the tune's E4 (329.7 Hz) is at -5.1 dB. The E is on top in pitch but not in level.
- **Suggestion:** Give the E4 key a little more (vel 1.0 to 1.2), or thin the lower Bb2/Bb3, so the melody note reads through the chord.

### 7. Deliberate semitone clashes in the climb (note)

- **Evidence:** From 2.25 the Eb2/Eb3 tremolo sounds against the organ swell's sustained D3 (a semitone). Under the full organ, F#2/F#3 and G#2/G#3 sound against the chord's G3, and A against Bb. The brief asks for this chromatic climb, and it is played light under the organ (vel x0.45).
- **Suggestion:** No change required. If it reads muddy, the swell's D3 could drop out at 2.25.

## The checks, as the reviewer ran them

```
--section 14 --check: Level -18.7 LUFS OK (target -18); peak -6.3 dBFS at 85.013; largest step 0.130 at 88.930; Tail -88.9 dBFS; cues u0 +4.0 ms 124 dB ok, u2.0 +3.0 ms 10 dB ok, u3.0 +8.0 ms 6 dB ok, u4.0 +1.0 ms 23 dB ok, u5.5 +4.0 ms 23 dB ok; Lead 16 notes median 1.2 cents, worst +7.6 cents (A3 at 88.50); Bell -53.7 dBFS in 1.8-9 kHz; "Nothing out of tolerance." 138 events, max 88 alive, prepared 0.25 s.
--with bike --check: crossing 13 [bike] +2.0 ms 121 dB ok; crossing 14 [bike] +2.0 ms 13 dB ok; "Nothing out of tolerance."
--lint 14: "Lint: nothing found."
Join --from 81 --to 91 --check: all cues ok, scope u0 +13.0 ms 5 dB ok; "Nothing out of tolerance."
```

## Rulings

1. **`lead` is ready for every pitch of D major from A3 to D5**, short and long, made in `prepare()` (keep it under 0.4 s).
2. **The organ at 3.0 is the loudest thing in the section.** Bars 1 and 2 of the piano 3 to 4 dB down, the Bb at 2.0 no louder than its neighbours, the organ up by as much, its chord's attacks spread by a few milliseconds; back to -18 LUFS. The cue at 3.0 must rise by 10 dB or more, and the organ chord must measure at least 6 dB above the piano of bar 1.
3. **The door is heard opening.** From 4.0 to 4.6 the creak stands at least 3 dB above the music in 800 to 1600 Hz: louder, or the piano's entry ducked for the first 0.3 s.
4. **The projector is barely there, not absent**: 8 to 10 dB up (about 22 LU under the music), and not a click track.
5. A key is not struck twice at once: tremolo strokes end before the same key is struck again (finding 5). The tune's E4 is the strongest note of the organ chord (finding 6). Finding 7 stands.
