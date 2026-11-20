# Review · scope

Independent review of `audio/parts/15-scope.js` on 2026-11-18, by a reviewer who did not write the part and could not listen to it: everything below was measured, read from the score and the code, or seen in a spectrogram. The music director's rulings follow the findings.

**Verdict:** ready

A 1950s test signal: sine beeps an octave up (D5-B5) with low sines on each two-beat cell, base-line pips, 60 Hz hum with rasp and hiss, an electrification at 120 Hz carrying on from Section 14's fire, the switch clicks, and the split and ring of the held E. Every row of the brief is present and on time against CUES.md. The split measures exactly in the knot's 3:2 ratio, beeps are pure, and the code keeps the rules. Only small observations remain.

## Findings

### 1. u = 0 cue is close to its limit when Section 14 sounds (note)

- **Evidence:** Alone, u0 reads +8 ms / 19 dB. In the joins (--from 81 --to 91 and --from 87 --to 97) it reads +13.0 ms / 5 dB against a 15 ms limit, because 14's fire and the electrification fill the 0.1 s before.
- **Suggestion:** Acceptable. If it needs margin, give the first beep (D5) a 4 ms rather than 8 ms rise, or narrow the cue band.

### 2. The ring after 3.5 is very small (note)

- **Evidence:** Track near 659 Hz on the split/ring render (--label "split|ring"): +10, -4, -11, -11, -7 cents over 43-83 ms, then within ±4 cents. That is one excursion of about 50 cents lasting about 40 ms. It is faithful to the picture's τ = 0.045 s but may pass unnoticed.
- **Suggestion:** Optional: double the depth (0.24 of the spread), keeping τ, so the wobble is heard.

### 3. Hum and electrification begin at u = -0.5 (note)

- **Evidence:** s.at(-0.5, hum) and s.at(-0.5, electrify). This is against the guide's 'first sound at u = 0, never earlier' but exactly what the music brief asks for. Across the 14/15 join the crackle drops from 14's fire at -31 dBFS rms (88.6-88.95) to the electrification at -35 dBFS (89.05-89.4), and loses everything above 1.4 kHz at 89.0.
- **Suggestion:** No change. The music director should be aware that the brief overrides the guide here.

### 4. 1 kHz pip on whole seconds (note)

- **Evidence:** pipSamples(true): a 1 kHz Hann burst, 14 ms, amplitude 0.015, every whole second. It is far shorter and softer than a broadcast time signal and sits under the music, so it is not recognisable as one.
- **Suggestion:** None needed.

## The checks, as the reviewer ran them

```
--section 15 --check: Level -21.9 LUFS OK (target -22); peak -14.5 dBFS at 92.031; largest step 0.068; Tail silence; cues u0 +8.0 ms 19 dB ok, u3.0 +1.0 ms 31 dB ok, u3.5 +1.0 ms 29 dB ok; Lead 15 notes median -0.0, worst -0.0 cents, 2 marked free; Bell -58.6 dBFS; "Nothing out of tolerance." 51 events, max 18 alive.
--with bike --check: crossing 14 [bike] +2.0 ms 31 dB ok; crossing 15 [bike] +2.0 ms 37 dB ok; "Nothing out of tolerance."
--lint 15: "Lint: nothing found."
Join --from 87 --to 97 --check: scope u0 +13.0 ms 5 dB ok; pixel u0 +4.0 ms 6 dB ok; "Nothing out of tolerance."
```

## Rulings

1. The ring after 3.5 is twice as deep (0.24 of the split's spread), same time constant, so that it can be heard (finding 2).
2. The first beep rises in 4 ms, for margin on the cue at u = 0 when Section 14 is sounding (finding 1). Findings 3 and 4 stand.
