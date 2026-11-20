# Review · scream

Independent review of `audio/parts/13-scream.js` on 2026-11-18, by a reviewer who did not write the part and could not listen to it: everything below was measured, read from the score and the code, or seen in a spectrogram. The music director's rulings follow the findings.

**Verdict:** needs-fixes

The same orchestra, colder: a dark tune in violas and cello, a sul ponticello A5 tremolo and a Bb creeping into bar 1. At 2.95 and 3.08 the bike's bell rings. At 3.0 four violins tear up into a quarter-tone cluster with the low strings sliding down, and bar 3 is found again, sour and then pale. It meets the brief closely and passes every check; the spectrogram shows exactly the fan and the 2-5 kHz band the brief asks for. One rule break (an unprepared noise buffer), and the second bell stroke is largely masked by the scream.

## Findings

### 1. Bow noise reads a 6 s noise buffer that is never prepared (must-fix)

- **Evidence:** audio/parts/13-scream.js:120 calls k.noise("white", ..., { seed: 13 }). prepare() only calls prepareReverb, so the 6 s white-noise buffer (about 1.6 ms to generate, measured) is built inside the first play function at u = 0, and again in the outro's lead (tune uses noise 0.12 by default). This breaks the guide's "Compute ahead" rule; the linter does not catch it.
- **Suggestion:** Import prepareNoise and call prepareNoise("white", 13) in prepare().

### 2. The second bell stroke at 3.08 is mostly masked by the scream (should-fix)

- **Evidence:** --label bell against the mix, 20 ms windows. In 1.8-9 kHz at 80.08 the bell stem reads -24.6 dB (including the first stroke's ring) and the mix -22.0 dB, and the mix shows no visible rise at the stroke. In 2.3-2.4 kHz (the bell's main partial, 2342 Hz) the bell reads -33.4 dB, the scream violins -35.5 dB and the mix -31.6 dB, a rise of about 2 dB. The brief asks for the bell "once more, softer, at 3.08"; the arranger flagged the same doubt.
- **Suggestion:** Thin the scream bus around 2.3-2.4 kHz for the first 0.2 s (a narrow cut), or raise the second stroke to about vel 0.7, so that it reads at least 6 dB over the scream in its own band.

### 3. The "soft knee" in front of the scream bus clips hard on crests (note)

- **Evidence:** soft() feeds a WaveShaper whose curve covers only -1..1 (tanh) after a gain of 4, with no oversampling. Simulated cluster input (4 pont players at 0.26, amp 1.0 at u 3.3): the shaper input peaks at 1.74 and 1.8% of samples go past the end of the curve, where they are clamped flat at tanh(1). At amp 0.75 (u 3.8) the peak is 1.31 and 0.1% are clamped. So this is not the rounding of "about 2 dB" that the comment describes; it hard-clips the beat crests and can alias. The -12 dB shelf above 5.2 kHz after it limits the damage, and no flat tops survive in the final mix.
- **Suggestion:** Lower the pre-gain to about 2.5 (post gain about 0.4), or build the curve over a wider range (for example x in -3..3), and consider oversample "2x".

### 4. Semitone overlaps where inner-voice notes cross-fade (note)

- **Evidence:** The inner A3 (0-1.0, release 0.14) still sounds under the Bb3 that enters at 0.97, and the Bb3 (0.97-2.02, release 0.14, still at 0.6 of peak at 1.97) sounds under the B3 that enters at 1.97. That gives about 0.15-0.19 s of A/Bb and Bb/B a semitone apart in the same voice, the second under the tune's top note B4. The first is arguably the intended "creep"; the second is an accident of the release.
- **Suggestion:** End the Bb3 at about 1.99 with a 0.06 s release so that it hands over to B3 instead of rubbing against it.

### 5. The u = 0 entrance barely stands out after Section 12 (note)

- **Evidence:** In the joined render (--from 75 --to 85) the cue at 77.000 rises only 3 dB (it passes). Section 12 rings into its last 30 ms (see the starry finding), and the first note here has a 25 ms attack.
- **Suggestion:** Mostly fixed on Section 12's side. Optionally give the u = 0 bite a little more rosin noise.

## The checks, as the reviewer ran them

```
--section 13 --check: Level -18.4 LUFS OK (target -18); peak -7.6 dBFS at 80.391; largest step 0.140 at 80.090; cues 77.000 +14.0 ms ok (soft), 79.950 +3.0 ms ok, 80.000 +5.0 ms ok; Lead 12 notes median 0.2 cents, worst +7.1 (D4 at 77.00), 4 marked free; Bell -57.8 dBFS in 1.8-9 kHz last 30 ms; "Nothing out of tolerance." 41 events, 175 sources started, at most 93 alive.
--with bike --check: crossing 12 [bike] +1.0 ms ok, crossing 13 [bike] +2.0 ms ok (rise 27 dB); "Nothing out of tolerance."
--lint 13: "Lint: nothing found."
--from 75 --to 85 --check: scream u = 0 "+4.0 ms 3 dB ok", crossing 12 rise 9 dB, crossing 13 rise 28 dB, nosferatu u = 0 ok; "Nothing out of tolerance."
```

## Rulings

1. **The second bell at 3.08 is heard.** It reads at least 6 dB over the scream in 2.3 to 2.4 kHz: a narrow cut on the scream's bus there for its first quarter second, or the stroke at vel 0.7, or both.
2. **The soft knee must round, not clip.** No sample may reach the flat end of the shaper's curve: a wider curve, or less gain before it (finding 3).
3. The inner Bb3 ends at about u = 1.99 with a 0.06 s release, so that it hands over to B3 without rubbing (finding 4). Finding 1 (the noise buffer) needs nothing: the engine now makes both noise buffers before anything plays.
