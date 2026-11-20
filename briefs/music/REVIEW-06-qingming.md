# Review · qingming

Independent review of `audio/parts/06-qingming.js` on 2026-11-18, by a reviewer who did not write the part and could not listen to it: everything below was measured, read from the score and the code, or seen in a spectrogram. The music director's rulings follow the findings.

**Verdict:** needs-fixes

A dizi with grace notes and a trill, small and large gongs, cymbals, drums and a woodblock; a roll grows to a single crown stroke at u 3.0. Every check passes, every brief row is present at its time, and the code keeps the rules. The weaknesses are of sound: a very bright dizi carries most of its energy in 2-5 kHz and dominates the band by 8-15 dB, and the 'full gong' at the crown lasts about 50 ms before it falls back to flute level, with the large gong's ring 12 dB under the trill.

## Findings

### 1. The dizi is very bright: 2nd-4th harmonics within 6 dB of the fundamental, and the 2-5 kHz band only 4.6 dB under the whole (should-fix)

- **Evidence:** Probe on dizi A5 alone (review-qingming-dizi.wav --at 36.05 --len 0.4): 880 Hz 0 dB, 1760 -6.0, 2640 -5.4, 3520 -6.1, 4400 -11.3, 5280 -15.0, 6160 -19.3 dB; centroid 1935 Hz. --band 2000:5000: rms -27.5 dBFS against -22.9 overall. The dizi is the loudest element throughout (RMS -22 to -24 dB per second). diziHarmonics uses k^-0.95 plus a +7 dB formant at 3.5 kHz, which is close to a sawtooth with a presence boost. On a sustained high flute line at the loudest level in the film's first half, this is likely to sound shrill and nasal rather than buzzy. The arranger lists it as unsure.
- **Suggestion:** Steepen the roll-off to about k^-1.4 to k^-1.6 and cut the formant to about +3-4 dB, so the 2nd harmonic sits about -8 dB and the 4th about -15 dB under the fundamental. Let the gated membrane noise carry the buzz. Aim for 2-5 kHz about 10 dB under the whole.

### 2. The crown's "full gong" is a 50 ms blip; the large gong's ring is buried under the flute (should-fix)

- **Evidence:** s06.wav, 50 ms RMS: downbeat 35.0 -20.3 dB, crown 38.00-38.05 -15.8 dB, then 38.05-38.30 -20.9 dB, back to flute level (dizi alone 38.0-38.3 -23.0). Crown stem envelope: 20 dB down 132 ms after the peak. Large-gong body in 100-600 Hz: 38.3-38.6 -38.9 dB, 38.6-39.0 -50.0 dB, while the dizi trill alone in the same band is -36.5 / -41.3, and overall the band is -40.1 dB against the dizi -27.3 dB over 38.3-39.0. In the full mix (t33-43) the crown 50 ms is only 1.7 dB above the bell plus the downbeat at 35.0 (-17.5 dB). Also: the tanh limiter (CROWN_LIMIT 0.4, pre-limit peak 0.582) distorts the first 50 ms at -16 dB relative and 50-100 ms at -23 dB, and reaches into the gong's ring, not only the attack.
- **Suggestion:** Give the large gong more sustained level relative to the attack: raise LEVEL.largeGong and lower the cymbal and high drum share of the crown so the limiter is not doing the work. Or bring the dizi's E5 in at about 0.6 and let it grow out of the gong. Target the gong body 0.3-0.8 s after the stroke at no more than about 6 dB under the trill. Consider lowering the dizi overall by 2 dB and raising the band instead of limiting the crown.

### 3. Bar 3's small gong and woodblock are about 15 dB under the dizi (should-fix)

- **Evidence:** RMS of everything but the dizi (--label '^(?!dizi)'): 39-40 -39.1 dB, 40-41 -41.3 dB; dizi alone -24.2 / -24.7 dB. Peaks: band -21.8 against dizi -16. In bar 1 the gap is 8-9 dB (band -32.5 against dizi -24.1). The brief's bar 3 asks for "small gong and woodblock" running down with the tune. The small gong (1.1-1.2 kHz) also sits on the dizi's strong 2nd harmonic.
- **Suggestion:** Raise the bar-3 hits (vel 0.65/0.7) to bar-1 levels or above, or lower the dizi in bar 3 (vel 0.82) by about 3 dB, so the band stays within about 8-10 dB of the flute.

### 4. The small gong settles a quarter-tone sharp of the dizi's D6 harmonic (note)

- **Evidence:** Track of the small gong at 39.75: 1140 Hz -> 1174 (D6-1) -> 1192 -> 1202 -> 1207 Hz (D6+47) by 163 ms. The dizi's D5 2nd harmonic is 1171-1175 Hz (u 0-0.5 under the gong at 0.25, and u 4.75 with the gong at 4.75), so about 30 Hz of beating where they overlap. Real gongs are not tuned to the band, so this is a matter of taste.
- **Suggestion:** If it reads rough, start the small gong at about 1000 Hz so it settles near 1150 Hz, or lower its level under the D5 notes.

### 5. Outro voice computes buffers live outside G4-B6 (note)

- **Evidence:** leadVoice calls k.buffer(`qingming/lead/${m}`, diziSamples) for any pitch; only G4-B6 is prepared. A 1.4 s per-sample synthesis would run inside a play function if the outro asks for a pitch outside that range. With leadOctave 1 the tune is A4-B5, so it is safe today.
- **Suggestion:** None needed unless the outro voicing changes; otherwise clamp or transpose by octave into the prepared range.

## The checks, as the reviewer ran them

```
--section 6 --check: Level -18.8 LUFS OK (target -18), peak -7.0 dBFS at 38.023, LRA 1.8 LU; largest step 0.251 at 38.029 (inside the crown/cymbal buffer); tail silence; cues u0 +1 ms ok, u3.0 +4 ms ok; Lead 16 notes, worst -0.9 cents; Bell -55.3 dBFS 1.8-9 kHz last 30 ms. "Nothing out of tolerance." 64 events, max 41 alive.
--with bike --check: crossing 5 [bike] +2.0 ms 120 dB ok; crossing 6 [bike] +3.0 ms 8 dB ok. "Nothing out of tolerance."
--lint 6: "Lint: nothing found."
--from 33 --to 43 --check: Nothing out of tolerance.
```

## Rulings

1. **A less harsh dizi.** Partials fall faster (about k^-1.4 to k^-1.6) and the formant is 3 to 4 dB, not 7, so that 2 to 5 kHz sits about 10 dB under the whole; the membrane's buzz stays in the gated noise.
2. **The crown is a gong, not a click.** From 0.3 to 0.8 s after the stroke the large gong's body (100 to 600 Hz) is at least level with the flute there; the flute's E enters softer (about 0.6) and grows out of the gong.
3. **Bar 3's band is heard.** Small gong and woodblock within 8 to 10 dB of the flute.
4. Tune the small gong so that it settles on D6 (1175 Hz), finding 4. Finding 5 stands.
