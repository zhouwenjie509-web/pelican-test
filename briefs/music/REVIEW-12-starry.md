# Review · starry

Independent review of `audio/parts/12-starry.js` on 2026-11-18, by a reviewer who did not write the part and could not listen to it: everything below was measured, read from the score and the code, or seen in a spectrogram. The music director's rulings follow the findings.

**Verdict:** needs-fixes

A string orchestra of oscillator players on the ridden clock: tune in the first violins an octave up, swirling sixteenths, cellos, pizzicato basses, a hushed A7sus4 tremolo in the crawl and a spin-up run. Notes, harmony and ridden times are right and the lead is in tune. But two of its three declared cues fail the checker (the part alone does not end with "Nothing out of tolerance"), the bow noise reads a 6 s noise buffer that is never prepared, and the swirls, the section's central image, are about 11 dB under the tune.

## Findings

### 1. The hushed-chord cue at u = 2.903 fails: no onset (must-fix)

- **Evidence:** The checker reports "cue at 73.90 s (the crawl: one hushed chord): no onset". Measured in 90-260 Hz, 50 ms windows: the mix falls from -35.1 dB at 73.70 to -51.2 dB at 73.85 (the cellos releasing at 2.72 + 0.12) and comes back only to -43.5 to -40.6 dB at 73.95-74.10. The hush rises slowly (a = 0.12 s to only 0.26 of peak), so there is no 3 dB step at the cue.
- **Suggestion:** Give the hush chord a defined onset at the cue: a quicker bite to its 0.26 level (around 40 ms), with the first player not pre-rolled by PRE. Or end the cello G2/B3 earlier so the band is quiet before 2.9. Or move the cue band to where only the tremolo lives. The cue must read ok with soft: true (60 ms).

### 2. The spin-up cue at u = 3.389 fails: 104 ms late (must-fix)

- **Evidence:** The checker reports "cue at 74.39 s (the sky spins up: first stroke of the run): 104.0 ms". The first stroke is D3 (147 Hz) through a lowpass starting at 1560 Hz, so it has little energy in the declared band of 1.5-5 kHz. Measured in that band, the run stem reaches -40.7 dB at 74.400, but the mix before the cue is already -42 to -48 dB (the hanging A5 plus the hush), so the first clear rise is the second stroke, E3 at 3.489 (+100 ms).
- **Suggestion:** Make the run's first stroke speak in its band: start the run an octave higher, or give the first stroke a stronger bow-noise bite and a higher lpMin. Or declare the cue with a band in which the D3 stroke clearly rises (for example 140-400 Hz, provided the tremolo stays out of it).

### 3. Bow noise reads a 6 s noise buffer that is never prepared (must-fix)

- **Evidence:** audio/parts/12-starry.js:97 calls k.noise("white", ..., { seed: 12 }). Kit.noise calls prepareNoise(color, seed), and sharedBuffer then builds white(6*48000) on first use, that is inside the first play function at u = 0, and again in the outro's lead. prepare() only calls prepareReverb and the pizz buffers. Generating that buffer takes about 1.6 ms (measured), plus the AudioBuffer copy, which breaks the guide's "Compute ahead" rule (a buffer of a second or more). The linter does not catch it.
- **Suggestion:** Import prepareNoise from ../engine/kit.js and call prepareNoise("white", 12) in prepare().

### 4. The swirls (the sky) are about 11 dB under the tune and barely show in the mix (should-fix)

- **Evidence:** Stems over 71-77 s in 0.5 s windows: vln1 -23.9 to -26.6 dB, cellos -24.9 to -26.7 dB, swirls -34.3 to -37.1 dB. The swirl stem alone (out/audio/review-starry-swirl.png) shows the rising and falling figures and their stretching clearly. In out/audio/s12.png they cannot be told apart from the sustained lines, so the brief's check ("figures visibly stretching out before 2.9 ... packed tighter from 3.9 to 5.3") is met only in the stem. The cellos are as loud as the lead.
- **Suggestion:** Raise the swirls 4-6 dB (swirl peak 0.085 to about 0.14) and lower the cellos 2-3 dB. Keep the overall level at target through LEVEL.

### 5. Too much of the part rings in the bell's entrance, and the hand-over to 13 is weak (should-fix)

- **Evidence:** Alone, the check reports "Bell -36.7 dBFS between 1.8 and 9 kHz in the last 30 ms before film 77.00 s" (the limit is -32; ukiyoe reads -70.4, scream -57.8). The B4 at 5.724 is released at 5.95 + 0.08 s (to 6.03), and the swirl G4 at 5.875 runs to about 6.0. In the joined render the crossing at 77.0 rises only 9 dB (other crossings 25-28 dB), and scream's u = 0 cue rises only 3 dB.
- **Suggestion:** End the last violin B4 so that its release is over by about 5.97, and drop the G4 swirl at 5.875 or shorten it. The bell then comes out of quiet.

### 6. First-violin vibratos start in phase on two of the three players (note)

- **Evidence:** The vibrato LFO is k.osc("sine") from `when` with vibSign +1, -1, +1 (lines 59-63, 116). Players 0 and 2 (5.7 and 5.55 Hz) bend upward together while the depth fades in. The lead median is +3.3 cents sharp, against 0.1-0.2 in the other two parts.
- **Suggestion:** Use k.lfo(rate, when, stop, phase) with a different phase per player, as scream.js does.

### 7. "As built" is out of date (note)

- **Evidence:** It says the neighbours are stand-ins and that the joins are clean. Both neighbours are real now, and the part's own check fails two cues. It does not mention the failures.
- **Suggestion:** Update "As built" once the cues pass.

## The checks, as the reviewer ran them

```
--section 12 --check: Level -18.3 LUFS OK (target -18); peak -7.7 dBFS at 74.836; largest step 0.113 at 73.113; cues 71.000 +3.0 ms ok; 73.903 u 2.90 "the crawl: one hushed chord: NOTHING BEGINS HERE (no rise of 3 dB)"; 74.389 u 3.39 "+104.0 ms 12 dB the sky spins up: first stroke of the run: LATE (limit 15 ms)"; Lead 16 notes median 3.3 cents, worst +9.8 (B4 at 76.16); Bell -36.7 dBFS in 1.8-9 kHz last 30 ms before 77.00; "2 thing(s) out of tolerance: - cue at 73.90 s (the crawl: one hushed chord): no onset - cue at 74.39 s (the sky spins up: first stroke of the run): 104.0 ms". 97 events, 379 sources started, at most 160 alive.
--with bike --check: crossing 11 [bike] +2.0 ms ok; crossing 12 [bike] +2.0 ms 9 dB ok; the same two cue failures.
--lint 12: "Lint: nothing found."
--from 69 --to 79 --check: the same two failures; scream's u = 0 cue at 77.000 "+4.0 ms 3 dB ok", crossing 12 rise 9 dB.
```

## Rulings

1. **Both failing cues must read ok.** The hushed chord has a defined start at its time (a quicker bite, about 40 ms, into a band that is quiet just before); the spin-up's first stroke speaks in the band its cue is declared in. The check must end "Nothing out of tolerance."
2. **The sky is heard.** Swirls 4 to 6 dB up, cellos 2 to 3 dB down; the level stays at -18 LUFS.
3. **Room for the bell.** The last B4's release is over by about u = 5.97 and the swirl at 5.875 is dropped or shortened: the check's "Bell" line reads below -40 dBFS.
4. Give each player's vibrato its own phase with `k.lfo` (finding 6). Finding 3 (the noise buffer) needs nothing: the engine now makes both noise buffers before anything plays. Bring "As built" up to date.
