# Review · han

Independent review of `audio/parts/03-han.js` on 2026-11-18, by a reviewer who did not write the part and could not listen to it: everything below was measured, read from the score and the code, or seen in a spectrogram. The music director's rulings follow the findings.

**Verdict:** ready

Chime bells carry the tune with inharmonic 4.2/5.4 partials and slow beating, stone chimes double the skeleton, a drum plays on the bar lines, three horses clop in eighths, and four great bells (D3 B2 A2 D2) fall exactly on 2.0, 2.5, 3.0 and 3.5 with pad thuds. Every row of the brief is present and timed, the part passes alone and with the bike, and the dab-4 bell is at -88 dBFS by u = 8. The main doubt is weight: the great bells, which are the joke, measure about 6 dB under the chime bells.

## Findings

### 1. The great bells of the four dabs are weaker than the tune above them (should-fix)

- **Evidence:** Per 0.4 s window from each dab (review-han-great_bell vs review-han-chime_bell): 19.0 great -27.6 dBFS rms / chime -21.6; 19.5 -27.3 / -22.1; 20.0 -27.1 / -21.3. Only at 20.5 (D2, under the decaying E) does the great bell lead (-28.1 / -38.4). The D2 bell's energy centroid is 86 Hz (fundamental 73.5 Hz), so on small speakers the deepest, final dab will be the faintest of all.
- **Suggestion:** Raise LEVEL.great by 3-4 dB, from 0.24 to about 0.36, and to keep the peak under -6 dBFS lower the held-E chime (already 0.82) and the B4/A4 chimes on 2.0/2.5 slightly. Alternatively strengthen the great bells' 2.0x/3.0x partials so that the D2 and A2 dabs are heard through their upper partials.

### 2. The peak is at the limit (note)

- **Evidence:** Alone: peak -6.4 dBFS at 19.014 (limit: below -6). With the neighbours: -5.9 dBFS at 17.002.
- **Suggestion:** Any level change should spread the coinciding attacks on 2.0 and 3.0 (chime, stone, great bell, pad, drum, three hooves) by a few milliseconds first.

### 3. The hoof knocks are pitched out of key (note)

- **Evidence:** Probe of review-han-hooves.wav at 17.5: the strongest partials are 621 Hz (D#5-3) and 700 Hz (F5+5), with t60 45 ms (about 30 cycles, a clear pitched 'tok'). They play on every eighth, quietly (-46 dBFS rms over the section).
- **Suggestion:** Optionally tune the knocks to scale tones (for example 587 / 659 Hz) or shorten them so that they read as unpitched.

### 4. The hooves are on the beat grid, but the picture's horses land off it (note)

- **Evidence:** CUES.md Section 3: the visible horses land at u = 0.083 + 0.25k and 0.167 + 0.25k. The score has hooves at j*0.25 + 0/13/26 ms. The guide says the music brief wins for non-cue rhythms, and the arranger declared this departure.
- **Suggestion:** No change needed. Recorded for the director.

## The checks, as the reviewer ran them

```
--section 3 --check: Level -19.8 LUFS (target -19) OK; peak -6.4 dBFS at 19.014; largest step 0.048; Tail -88.0 dBFS; cues 0.00 +1.0 ms ok, 2.00 +6.0 ms ok, 2.50 +10.0 ms ok, 3.00 +11.0 ms ok, 3.50 +17.0 ms ok; Lead 16 notes median -0.1 c, worst -3.2 c (A4 at 18.75); Bell -70.6 dBFS; "Nothing out of tolerance." Cost 106 events, at most 45 alive.
--section 3 --with bike --check: crossing 2 [bike] +1.0 ms ok, crossing 3 [bike] +1.0 ms ok, "Nothing out of tolerance."
--lint 3: "Lint: nothing found."
--from 15 --to 25 --check (review-join-15-25): all han cues ok, crossings 2 and 3 ok, peak -5.9 dBFS at 17.002 (egypt tail + bell + han downbeat), "Nothing out of tolerance."
```

## Rulings

1. **The four great bells carry the joke.** 3 to 4 dB up, and with stronger second and third partials on the A2 and D2 bells so that they are heard on small speakers. Keep the peak below -6 dBFS by spreading the attacks that coincide on 2.0 and 3.0 by a few milliseconds, not by turning the bells back down. Over the 0.4 s after each dab the great bell must be within 3 dB of the chime bells.
2. Shorten the hoof knocks so that they read as unpitched (ring under 20 ms), finding 3. Findings 2 and 4 stand.

## Second check (after the fix round)

A second independent checker measured every ruling again: 2 of 2 met.

- **New (minor): Downbeat great bell also went up 4 dB; peak with the bike now -5.6 dBFS.** The shared LEVEL.great raise also lifts the u = 0 great bell D3 (vel 0.85). --with bike --check: peak -5.6 dBFS at film 17.028 (true peak -5.5 dBTP); --from 15 --to 25: -5.8 dBFS at 17.002 (review: -5.9). Alone it is -6.5, so the guide's 'alone' rule holds.
  Suggestion: If the mix bus needs headroom at crossing 2, give the u = 0 great bell a lower vel (e.g. 0.7) or start it a few ms after the bell/chime attack; the dabs need not change.

## Rulings, second round

1. **Head-room on the first downbeat.** The great bell on u = 0 comes down to about vel 0.7, or starts a few milliseconds after the chime bell: `--with bike --check` must peak below -6 dBFS at the crossing. The four dabs stay exactly as they are.
2. Nothing else changes.
