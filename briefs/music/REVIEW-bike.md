# Review · bike

Independent review of `audio/parts/bike.js` on 2026-11-18, by a reviewer who did not write the part and could not listen to it: everything below was measured, read from the score and the code, or seen in a spectrogram. The music director's rulings follow the findings.

**Verdict:** needs-fixes

The bicycle's steel-dome bell on D7 at 3.0, at every crossing and at 135.5, and four chain ticks per pedal turn read from the crank. Every cue is within 1 ms, the ticks follow the ride (4.0/4.41/4.73/5.0 in the intro as the brief says), and the bell stands clear in both sections reviewed here. The only rule broken is computing ahead: the room and the 2.6 s bell buffer are made during playback, and this is the file the guide holds up as the example part.

## Findings

### 1. The room and the bell buffer are computed during playback (bike.js has no prepare()) (must-fix)

- **Evidence:** bike.js:81 calls k.reverb('bike/room', {seconds: 1.4, ...}) in graph(). player.js builds that graph 'the first time the part is needed', during playback. bike.js:63 builds the 2.6 s bell (6 modes, 124800 samples) inside ring(), the play function. Timed in Node: impulseResponse for this room 6.9-9.5 ms, bellSamples 2.1-3.1 ms. The guide §4 says 'a buffer of a second or more, a room' is made in prepare(). The guide also tells arrangers to read this file as the model part.
- **Suggestion:** Add prepare() { prepareReverb('bike/room', ROOM); sharedBuffer('bike/bell', bellSamples); for (v of 0..3) sharedBuffer(`bike/tick/${v}`, () => tickSamples(v)); }, and hoist the room options into a const ROOM shared with graph().

### 2. The bell's shimmer is a deep 7 Hz tremolo (note)

- **Evidence:** The paired modes at 0.9985f and 1.0015f (amplitudes 1.0 and 0.8) beat at about 7 Hz. audio-probe bike.wav --at 17.0 --band 2000:2700 --env shows dips of -14 to -20 dB every 140 ms (-25 to -39 dB at 40-50 ms, -25 to -44 dB at 190 ms, ...). That is a strong 'wah-wah' rather than a slow shimmer. It fits a thumb-lever bicycle bell, and it is the film's own invented sound, so there is no rights issue.
- **Suggestion:** Taste only. For a gentler shimmer, set the pair about 2-3 Hz apart (±0.0005) or set the second mode's amplitude to about 0.5.

### 3. The bell at 3.0 is still ringing at the crossing at 5.0 (note)

- **Evidence:** The crossing 0 cue rises 56 dB, against about 119 dB at every other crossing, because the 2.6 s bell from 3.0 is still sounding. The cue is still ok at +1 ms.
- **Suggestion:** None needed. The 3.0 bell could be given ev.endBy of about 1.9 s if a cleaner second strike at 5.0 is wanted.

## The checks, as the reviewer ran them

```
--part bike --check: Level -25.3 LUFS over 0-137; peak -14.1 dBFS at 135.501; largest step 0.087 at 135.502. Cues: 3.000 +1.0 ms ok, crossings 0-20 all +1.0 ms ok, 135.500 +1.0 ms ok. 'Nothing out of tolerance.' 435 events, 435 sources, max 11 alive, prepared 0.04 s.
--lint bike: 'Lint: nothing found.'
With intro: 'the sketch sets off [bike]: +2.0 ms ok', 'crossing 0 [bike]: +2.0 ms ok'. With sahara: 'crossing 0 [bike]: +1.0 ms ok', 'crossing 1 [bike]: +2.0 ms ok'.
```

## Rulings

1. Done by the music director: the part now has `prepare()` (room, bell and ticks are made before anything plays; `prepareBike` is exported), and the bell's paired modes beat at about 3 Hz with a weaker twin, a shimmer and not a wobble. Finding 3 stands.
