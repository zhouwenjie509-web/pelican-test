# Review · chat

Independent review of `audio/parts/17-chat.js` on 2026-11-18, by a reviewer who did not write the part and could not listen to it: everything below was measured, read from the score and the code, or seen in a spectrogram. The music director's rulings follow the findings.

**Verdict:** ready

Section 17 plays the ring-tone tune with invented messenger sounds as its drum kit. Every row of the brief is there at its time: bar 1 with the kit, silence from 2.0 to 2.5 (-inf dBFS), A and F# at 0.75 with ticks only, then at 3.0 the nudge, four pings and the shaken E, the lone tick with F# at 4.0, and bar 3 with the kit coming back at 4.5. The score is musically clean and follows the rules in the code. The one weakness is the "?" key tick at 4.0. It lands on a bicycle chain tick and is only about 4 to 6 dB above the chain ticks around it, so it barely stands alone.

## Findings

### 1. The "?" key tick at u = 4.0 lands on a chain tick and hardly stands out (should-fix)

- **Evidence:** The bicycle chain ticks every 0.25 s, on the same eighths as the key ticks. In 5-12 kHz at film 105.00, the tick alone (review-chat-tick.wav) peaks at -45.0 dB and the bike alone at -48.8 dB, both at the same 10 ms bin. In s17+bike.wav, the 4-12 kHz peak around each eighth reads: 3.25 -46.7, 3.5 -42.8, 3.75 -45.7, 4.0 -40.1, 4.25 -47.2 dB. So the "one key tick, alone and a little louder" is a chain tick plus about 4 dB, and the lead F#5 starts on the same sample. The ordinary hi-hat ticks (vel 1, peak about -29 dBFS) also double the chain at about its level all through bars 1 and 3. The kit's hi-hat is hard to tell from the bicycle.
- **Suggestion:** Make the "?" tick unmistakable. Give it its own timbre (for example a slightly longer 2-3 kHz blip or a two-click key-down/key-up) and raise it by about 6 dB (vel about 2.5, or a separate gain). Alternatively, ask the music director to drop the bike's chain for this one beat, or bring this section's `bike.chain` down from 0.8 to about 0.5. Also consider giving the hi-hat ticks a pitch or colour that cannot be mistaken for the chain.

### 2. The nudge is a soft hum, not a "harsh" buzz (note)

- **Evidence:** probe review-chat-nudge.wav --at 104.003 --len 0.03: fundamental G#3 at 0 dB, 2nd harmonic -7, 3rd -15, 4th -24, 5th -36. Energy in 2-5 kHz is -57 dB against -17.5 dB broadband. There is a small cluster of partials at 5-6.4 kHz around -35 dB, where the harmonic series is cut off at 6 kHz. The ten bursts do show as ten marks in s17.png, as the brief asks.
- **Suggestion:** If more rattle is wanted, keep the harmonics up to about 4 kHz at roughly 1/k (or raise the tanh drive) so that 1-4 kHz carries the buzz. Taper the series smoothly to 6 kHz, which removes the bright cluster at the cut.

### 3. Fades shorter than the guide's 2 ms (note)

- **Evidence:** 17-chat.js: tickSamples fade-in 0.3 ms (line 138), messageSamples/woodNote 0.8 ms (lines 116, 124), lead 1 ms (line 60, though an exponential rise with a 1.5 ms time constant sits on top), nudge 1 ms (line 160). The check's largest step is only 0.087, so no click was measured.
- **Suggestion:** For a key click this is in character, so leave it unless the director reads the 2 ms rule literally. In that case use 2 ms fade-ins on message and nudge.

### 4. Rights: the rising two-note "message in" is the most common notification shape (note)

- **Evidence:** messageSamples: D6 then B6, 70 ms apart, wooden FM (lines 120-125). This follows the brief exactly, and I know of no specific product sound that matches it. It is a judgement, not a measurement.
- **Suggestion:** No change required. If the director wants more distance from real messenger chimes, a falling sixth or a soft unpitched knock would be safer.

## The checks, as the reviewer ran them

```
--section 17 --check: Level -21.0 LUFS OK (target -21); peak -9.4 dBFS at 105.513; Clicks largest step 0.087 at 102.503; Cues 0.00 +2.0 ms ok, 2.50 +2.0 ms ok, 3.00 +6.0 ms (20 dB rise) ok, 4.00 +1.0 ms (35 dB) ok; Lead 14 notes median 0.0, worst -0.2 cents, 1 free; Bell: silence between 1.8 and 9 kHz in the last 30 ms; "Nothing out of tolerance." 66 events, max 30 alive, prepared 0.12 s.
--section 17 --with bike --check: crossing 16 [bike] +2.0 ms 121 dB ok; crossing 17 [bike] +2.0 ms 28 dB ok; all four part cues ok; "Nothing out of tolerance."
--lint 17: "Lint: nothing found."
--from 99 --to 109 --check: all cues ok (chat u0 rise only 3 dB after section 16's chip music, lag +5 ms); "Nothing out of tolerance."
```

## Rulings

1. **The "？" tick at u = 4.0 is unmistakable.** Its own sound (a key going down and coming up: two clicks, with a short blip at 2 to 3 kHz), about 6 dB louder than a key tick; and the bicycle's chain is silent on that beat: `bike: { bell: 1, chain: (u) => (Math.abs(u - 4) < 0.06 ? 0 : 0.8) }`.
2. **"Message in" is not a rising two-note chime**, which is the commonest notification shape there is. Make it a soft unpitched wooden knock followed by two notes falling a sixth (B6 then D6, 70 ms apart). It stays the backbeat.
3. A harsher nudge: harmonics up to about 4 kHz at roughly 1/k, tapering smoothly to 6 kHz (finding 2). Finding 3 stands.
