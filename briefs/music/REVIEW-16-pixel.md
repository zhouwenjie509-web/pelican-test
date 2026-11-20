# Review · pixel

Independent review of `audio/parts/16-pixel.js` on 2026-11-18, by a reviewer who did not write the part and could not listen to it: everything below was measured, read from the score and the code, or seen in a spectrogram. The music director's rulings follow the findings.

**Verdict:** needs-fixes

A four-channel chip (two pulses, a stepped triangle, LFSR noise) playing the tune with arpeggios, bass and drums. The jump, coin, 1UP and landing are all on their CUES.md times, and the channel discipline is enforced in code. But the noise channel's filters are never applied (a coding bug), the snare fill masks the bell at the next crossing so the with-bike check fails, the lead sits under the accompaniment, and `lead` renders buffers in the play function.

## Findings

### 1. Noise-channel filters are discarded: hats, snare and landing are unfiltered (must-fix)

- **Evidence:** render() line 170-171: `if (e.hp) biquad(y, "highpass", e.hp, 0.7071); if (e.lp) biquad(y, "lowpass", e.lp, 0.7071);`. dsp.biquad returns a new Float32Array (dsp.js:164-166) and does not filter in place, so the result is thrown away. So the hat's 6 kHz high-pass, the snare's 180 Hz high-pass and the landing's 1.8 kHz low-pass are never applied, although the As built claims all three. Measured on --label N: the hat at 95.0 is -37.5 dBFS rms in 30-2000 Hz against -33.0 in 6-20 kHz, so it is close to full-band noise. The landing thud at 98.5 has -33.6 dBFS rms above 1.8 kHz, the sample-and-hold images. The noise channel alone is -25.3 LUFS, as loud as the lead.
- **Suggestion:** Write `y = biquad(...)` (with `let y`), or copy the result back, then re-level to -20 LUFS. The hats should then show as thin marks above 6 kHz and the gap from 2.5 to 3.625 should become visible, as the brief's check asks.

### 2. Snare fill masks the bell at crossing 16 (with-bike check fails) (must-fix)

- **Evidence:** --section 16 --with bike --check: crossing 16 at 101.00 'NOTHING BEGINS HERE (no rise of 3 dB)'. Probe of s16+bike.wav in 1.8-9 kHz: fill -22.7 to -25.3 dB from 100.87 to 100.95, silent 100.97-100.99, bell -20.7 dB at 101.0. The fill crescendos (vol 8 to 11, the last stroke the loudest, -20.8 dBFS rms at 100.875 on --label N) to the bell's own level in the bell's band 50 ms before it. It passes in the full film only because Section 17's onset adds to the rise.
- **Suggestion:** Keep the fill under the bell. For example, make the fill decrescendo or stop at vol 8, drop the 5.875 stroke or end the fill by 5.85, or low-pass the fill strokes below 1.8 kHz (the snare's 9 kHz clock). Re-run --with bike until crossing 16 reads ok alone.

### 3. Outro lead renders its buffer inside the play function (must-fix)

- **Evidence:** leadVoice() calls k.buffer(`pixel/lead/...`, () => render(e)) with nothing prepared. Timed: render of a 0.25/0.5/1.0 s note takes 1.8/2.4/3.2 ms (Node). The guide says anything over 1 ms is made in prepare().
- **Suggestion:** In prepare(), render the lead for the outro's likely notes: the major scale in leadOctave 1, at the tune's durations (0.25, 0.5, 1.0 s, with the same length rule), using the same keys.

### 4. Lead (pulse A) is quieter than its accompaniment (should-fix)

- **Evidence:** Channels rendered alone: A -25.1 LUFS, B -29.6, T -25.1, N -25.3, so B+T+N together come to about -21.5 LUFS, about 3.6 LU above the tune. The section's peak (-9.9 dBFS at 95.514) is a snare onset, and pulse A alone peaks at only -19.5 dBFS.
- **Suggestion:** After fixing the filters, re-balance CH_GAIN so pulse A is clearly the loudest channel: A up about 3 dB, T down about 2 dB and N down about 3 dB, then re-level the bus to -20 LUFS.

### 5. Coin's ring cut at about 65 ms by the 1UP jingle (note)

- **Evidence:** The brief asks for A7 to ring down over about 150 ms but also puts the jingle on the same channel at 3.125. COIN_RING is cut at vol 7 of 12. The code comment says 'nine frames: 150 ms' but the table has 11 values (183 ms).
- **Suggestion:** Accept this (the brief contradicts itself) and fix the comment.

### 6. Small aliasing on the highest pulse notes (note)

- **Evidence:** Probe of --label B: the coin's A7 (98.06) shows a fold at 23360 Hz (-25 dB) and 16320 Hz (-34 dB). The 1UP's D7 (98.375) shows 17459 Hz (-36 dB) and 22158 Hz (-30 dB). Pulse A's B5 is clean, all integer harmonics.
- **Suggestion:** Inaudible for most listeners. Optional: a gentle low-pass at 14-16 kHz on pulse B.

### 7. Triangle carries a quarter of the energy (note)

- **Evidence:** 24.3 % of the energy is below 120 Hz; triangle alone is -25.1 LUFS with D2 at 73 Hz. The 32-step staircase's images sit at 32·f0 (2349 Hz for D2, -30 dB), which is authentic.
- **Suggestion:** Taste. It will be revisited when the channels are re-balanced (see above).

### 8. Rights: effects are generic (note)

- **Evidence:** The coin is a rising D7-F#7-A7 triad (not a fourth). The 1UP is D6 E6 F#6 A6 D7, from the film's own tune. The jump is an 11-frame sweep D5 to A6. None matches a known game cue note for note.
- **Suggestion:** None needed.

## The checks, as the reviewer ran them

```
--section 16 --check: Level -20.1 LUFS OK (target -20); peak -9.9 dBFS at 95.514, true peak -8.7 dBTP; largest step 0.298 at 95.514; Tail silence; cues u0 +3.0 ms 121 dB ok, u2.5 +5.0 ms 12 dB ok, u3.0 +4.0 ms 8 dB ok, u3.125 +4.0 ms 12 dB ok, u3.5 +6.0 ms 8 dB ok; Lead 16 notes median 0.0, worst +1.1 cents; Bell -220.4 dBFS; "Nothing out of tolerance." 112 events, max 44 alive.
--with bike --check: crossing 15 [bike] +2.0 ms 120 dB ok; "101.000 101.00 - crossing 16 [bike]: NOTHING BEGINS HERE (no rise of 3 dB)"; "1 thing(s) out of tolerance: cue at 101.00 s (crossing 16): no onset".
--lint 16: "Lint: nothing found."
Join --from 93 --to 103 --check: crossing 16 [bike] +4.0 ms 5 dB ok (only because chat's own onset adds to it); "Nothing out of tolerance."
```

## Rulings

1. **Apply the noise channel's filters.** `dsp.biquad` returns a new array: write `y = biquad(...)`. Then the hats are thin marks above 6 kHz and the gap from 2.5 to 3.625 shows. Re-level to -20 LUFS.
2. **The snare fill stays under the bell.** `--with bike --check` must read crossing 16 ok: the fill gets quieter towards the frame, or ends by 5.85, or is kept below 1.8 kHz.
3. **`lead` is made in `prepare()`** for the major scale in its octave at the tune's lengths.
4. **Pulse A is the loudest channel.** About A +3, triangle -2, noise -3 dB, then the bus back to -20 LUFS.
5. Correct the coin comment (finding 5). Findings 6, 7 and 8 stand.
