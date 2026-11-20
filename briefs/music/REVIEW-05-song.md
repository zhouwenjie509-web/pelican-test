# Review · song

Independent review of `audio/parts/05-song.js` on 2026-11-18, by a reviewer who did not write the part and could not listen to it: everything below was measured, read from the score and the code, or seen in a spectrogram. The music director's rulings follow the findings.

**Verdict:** needs-fixes

A guqin part, with the tune an octave below written, the open D2 and fan-yin harmonics in bar 2, and a slide from 3.2 to 4.0. It passes every check, the cue times match CUES.md, and the code keeps the rules. The bar-2 slide, which should grow nearer as the camera pushes in, gets quieter and darker instead. It is the quietest moment of the section, and F#3 then jumps in 16 dB louder.

## Findings

### 1. The push-in slide (u 3.2-4.0) recedes instead of growing nearer (must-fix)

- **Evidence:** Rendered with --label 'sliding|slide brush' (out/audio/review-song-slide.wav). RMS in 0.2 s windows over film 32.2-33.0: -35.9, -37.8, -38.2, -38.6 dB. In 400-4000 Hz: -45.7, -49.9, -53.0, -55.7 dB, so it falls 10 dB in brightness while the low pass is said to open. The pitch track is correct: 165.2 Hz (E3) up to 184.6 Hz (F#3-4) by +763 ms. Full mix: 32.2-33.0 is -35.3 dB RMS, the quietest stretch of the section, then F#3 at 33.0-33.2 is -22.5 dB. Cause: the swell envelope (0.3 -> 1.6 x level, +14.5 dB, line 127) only cancels the buffer's own decay (E3 T1 about 2.8 s, about -17 dB over 0.8 s), and the upper partials die faster (1/t60 term 1.6 (f/1k)^2) than the 700 -> 4000 Hz low pass opens.
- **Suggestion:** Make the swell beat the decay. For example, end the swell at about level*4-5 (or use a sustained, bowed-like re-excitation or a looped steady segment of the buffer instead of a decaying pluck), and open the low pass earlier (most of its travel by 3.6). Target a rise of at least 8-10 dB from 3.3 to 3.95, landing within about 3-4 dB of the F#3 pluck, so the landing reads as arrival rather than a jump. Re-probe with --env and --band 400:4000.

### 2. The pull-out at u 2.0-2.55 is as loud as the close shot; the wide shot is only slightly quieter (should-fix)

- **Evidence:** s05.wav broadband RMS: bar 1 (29-31) -26.0 dB; 31.0-31.55 -24.1 dB (the loudest stretch of the section); wide hold 31.55-32.2 -30.0 dB. In 200-4000 Hz: bar 1 -30.2, 31.0-31.55 -29.9, 31.55-32.2 -32.1 dB. So the mid band during the pull-out equals the close shot, and the wide hold is only 2 dB under it. LRA 0.7 LU. The open D2 (vel 0.85) carries strong D3/A3/D4 partials (0, -0.5, -6.9, -9.0 dB at 73/147/220/294 Hz), and the B4 harmonic at vel 0.6 sits at -32.7 dB RMS. The brief asks for "a few faint harmonics inside the ring of one low string" and a wide shot that is "quieter still".
- **Suggestion:** Lower the open D2's level or its upper partials (darker pluck, so it is depth rather than mid-band level), and bring the harmonics down a further 3-4 dB, so the wide shot sits about 6+ dB under bar 1 in 200-4000 Hz. Recheck that the loudness still hits -24 LUFS (bar 1 and bar 3 can carry it).

### 3. "As built" figures are stale (note)

- **Evidence:** The brief's As built says the bell band is -49 dBFS and the D2's 2-9 kHz is about 18 dB under the whole. Current check: bell band -81.4 dBFS. My probe of the D2 alone: 31.05-32.0 is -87.7 dB in 2-9 kHz against -27.1 dB broadband.
- **Suggestion:** Refresh the numbers in As built when the slide is fixed.

### 4. Overlapping rings on what would be one string (note)

- **Evidence:** Score: A3 at u 1.0 (ring 0.8, to 1.8) is still sounding when A3 is plucked again at 1.75; B2 at 5.0 (ring 0.8) sounds against A2 at 5.5 and is replucked at 5.75 while the first B2 is still decaying. On a real qin a repluck damps the previous note on that string.
- **Suggestion:** Shorten ring on the A3 at 1.0 to about 0.7 and on the B2 at 5.0 to about 0.75 so each repluck replaces the previous one. Minor.

## The checks, as the reviewer ran them

```
--section 5 --check: Level -23.9 LUFS OK (target -24), peak -11.4 dBFS at 34.008, LRA 0.7 LU; largest step 0.015; tail -113.3 dBFS; cues u0 +3 ms ok, u2.0 +4 ms ok, u4.0 +5 ms ok; Lead 16 notes, worst -4.1 cents (F#3 at 29.75), 1 marked free; Bell -81.4 dBFS 1.8-9 kHz last 30 ms. "Nothing out of tolerance." 20 events, max 11 alive.
--with bike --check: crossing 4 [bike] +1.0 ms ok; crossing 5 [bike] +1.0 ms 54 dB ok. "Nothing out of tolerance."
--lint 5: "Lint: nothing found."
--from 27 --to 37 --check: Nothing out of tolerance (joins with tang and qingming clean).
```

## Rulings

1. **The slide from 3.2 to 4.0 must grow, not fade.** Its level rises by at least 8 dB from 3.3 to 3.9 (RMS in 0.2 s windows, the slide alone) and it brightens as it comes (400 to 4000 Hz rising), arriving just under the level of the F#3 at 4.0.
2. **The wide shot is far away.** From 2.55 to 3.2 the part sits at least 6 dB under bar 1 in 200 to 4000 Hz: a darker open D2 (depth, not mid-range) and the harmonics 3 to 4 dB lower. The section stays at -24 LUFS.
3. A repluck damps the note already sounding on that string (finding 4). Bring the figures in "As built" up to date (finding 3).
