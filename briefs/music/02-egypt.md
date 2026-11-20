# Music · Section 2 · 古埃及壁画 · Egyptian Wall Painting

| | |
|---|---|
| Film time | 11.0 s – 17.0 s |
| Part file | `audio/parts/02-egypt.js` (`node tools/audio.mjs --section 2 --check`) |
| Owner's brief | "Egypt: Egyptian harp" |
| Loudness target | -21 LUFS |
| Scale | major (D E F# A B), in octaves and open fifths: no triads |
| Picture | `briefs/02-egypt.md`, `src/scenes/egypt.js` (`motion(u)`); `briefs/CUES.md`, "Section 2" |

## The idea

The pelican stops dead to hold the correct pose for a tomb wall, and the
harpist stops with it. One blink. Then both have time to make up, and the
tune scurries after the wheels to reach the frame on the bar line.

## Instruments

- **An arched harp**: gut strings plucked with the flesh of the fingers. A
  round, slightly hollow note with a soft start, few upper partials, ringing
  one to two and a half seconds (longer in the bass). The tune at written
  pitch (D4 … B4), doubled an octave below on the strong notes; a low string
  (D3 or A2) on the first beat of each two-beat cell. A wooden body: warm
  around 200–400 Hz.
- **A sistrum**: a frame of loose metal discs. One shake is a dense spray of
  tiny bright clicks lasting about a quarter of a second.
- **The room**: a painted stone chamber, about 0.9 s, close.

## The clock

The pelican brakes at u = 1.9–2.1, stands still until 3.0, then rides at
1.565 times the pace until it eases back at 5.3–5.9 (`egypt.motion`). After
the stop, schedule the tune at `s.ridden(beat)` (see the guide): beat 5 falls
at u = 3.619, beat 5.5 at 3.779, beat 6 at 3.939, beat 8 at 4.578, beat 9 at
4.897, beat 9.5 at 5.057, beat 10 at 5.217, beat 11 at 5.548, beat 11.5 at
5.754. The chain's ticks do the same by themselves.

## The three bars

| u | Picture | Sound |
|---|---|---|
| 0.0–1.75 | The pelican rides along the painted wall | Bar 1 of the tune on the harp, in time; the sistrum lightly on beats 2 and 4 |
| 1.9–2.1 | Hard brake; the pose eases in | The last eighth (A4 at 1.75) is damped short |
| 2.0 | The pose locks: upright, both wings shown, bill level | **B4 with the octave and fifth below, as one spread chord whose top note lands on 2.0** (begin the spread about 40 ms early). One shake of the sistrum. Then nothing new: the chord rings down |
| 2.5 | The one blink of the hold (2.425–2.575) | One tiny sound, alone: a single high harmonic of the harp, very soft |
| 3.0 | Release: the pose unwinds and the pelican accelerates | A quick upward sweep across the strings (D4 to D5 on the five notes, about 0.3 s) |
| 3.619 → 5.754 | It rides at one and a half times the pace, catching up | The rest of the tune on the ridden clock: A4 3.619, F#4 3.779, E4 3.939, F#4 4.578, E4 4.897, D4 5.057, B3 5.217, A3 5.548, B3 5.754. The sistrum keeps the hurried beats |
| 6.0 | The frame, on time | The bell takes the D |

Declare cues at u = 0, 2.0, 2.5 and 3.0.

## The bicycle here

`bike: { chain: 1, bell: 1 }`. The chain falls silent from 2.1 to 3.45 and
then ticks faster: leave that audible.

## Hand-over

In: Section 1 is voices and drums. Out: Section 3 is bronze bells. Your last
strings may ring to about u = 7.

## Check

- Print the events: nothing of yours begins between 2.05 and 3.0 except the
  blink at 2.5.
- The spectrogram shows plucked notes (sharp start, partials dying from the
  top), a gap in bar 2 with one faint mark at 2.5, and notes packed closer
  after 3.6 than in bar 1.

## As built

Nothing was listened to. Everything below was checked by `--check`, `--print`, `audio-probe` and the spectrogram only.

**What plays** (u in seconds; all ridden times are `s.ridden(beat)` and match the clock above to the millisecond):

| u | Harp | Sistrum / other |
|---|---|---|
| 0.00 | D4 (lead) + D3 (octave, also the cell's low string) | |
| 0.50, 0.75 | E4, F#4 | shake 0.52 (light, 20 ms behind the beat and the chain tick) |
| 1.00 | A4 (lead) + A3 octave + D3 low string (open fifth) | |
| 1.50, 1.75 | F#4, A4 | shake 1.52 (light) |
| 1.88–1.95 | every string damped by the hand (70 ms fade); the A4 of 1.75 sounds 0.2 s | |
| 1.96 / 1.98 / 2.00 | spread chord B3, E4, B4 (B4 lead, on the beat), left to ring | shake 2.00 (full) |
| 2.50 | | octave harmonic of the A4 string (sounds A5, 880 Hz), very soft, alone |
| 3.00–3.30 | sweep D4 E4 F#4 A4 B4 D5, 60 ms apart, rising level; every sweep string damped by u = 3.60 (0.15 s fade, 3.45–3.60) | |
| 3.619, 3.779 | A4, F#4 | |
| 3.939 | E4 + E3 octave + A2 low string | shake 4.278 (ridden beat 7, + 20 ms) |
| 4.578 | F#4 + F#3 octave + D3 low string | |
| 4.897, 5.057 | E4, D4 | shake 4.917 (beat 9, + 20 ms) |
| 5.217 | B3 + D3 low string (no B2 doubling: it would be mud) | |
| 5.548, 5.754 | A3, B3 | shake 5.568 (beat 11, + 20 ms) |
| 5.6–7.0 | everything from u 3.6 on is damped by u = 7.0 (0.4 s fade) | |

39 events. Cues: 0 (first pluck), 2.0 (the sistrum shake, band 5–12 kHz), 2.5 (the harmonic, band 820–940 Hz), 3.0 (the sweep). Nothing begins between 2.0 and 3.0 except the harmonic at 2.5. The full shake at 2.0 stays on the beat (it is the cue, and no chain tick falls there).

**How it is made** (all buffers computed in `prepare()`, about 0.1 s):

- Harp: a sum of decaying harmonic partials (up to 14, below 6.5 kHz) with a slight gut stiffness (B = 4e-5). Amplitudes from a finger pluck at 0.42 of the string (odd partials stronger: a slightly hollow tone), falling as k^-1.6 and rolled off above 2.2 kHz; each partial's t60 shrinks with its number and frequency, so the top dies first. Fundamental t60 from 1.9 s (B4) to 3.2 s (A2). Two short body knocks (285 and 415 Hz), a +3 dB peak at 300 Hz, a 55 Hz high-pass, a 3 ms raised-cosine onset for the finger. Pan follows the string, ±0.3 at most.
- Harmonic: 2f at full level and 4f at 6 %, t60 1.5 s.
- Sistrum: about 48 tiny clicks per shake, each three random modes at 3.8–9 kHz ringing 12–42 ms: a dense forward stroke (0–55 ms), a weaker rebound (105–155 ms) and a few discs settling to 0.24 s; high-passed at 2.5 kHz. Three seeded variants. Level 0.1 (light shakes at vel 0.55, the pose shake at 1).
- Room: `k.reverb` 0.9 s, t60 0.8, bright 0.45, predelay 6 ms, send 0.18.

**Measured:** -20.8 LUFS (target -21), peak -9.6 dBFS at film 16.238, largest step 0.059 at 13.004 (the onset of the full sistrum shake), all 16 lead notes within 2 cents, all four cues within 4 ms, -74.9 dBFS in the bell's band before u = 6; with the bike both crossings read ok. 39 events, at most 21 alive.

**Unsure:** whether the harp reads as a harp rather than a generic plucked string (gut sound without a real resonating body model); whether the sistrum level is right against the harp (it now stands only 1 to 2.5 dB above the chain ticks in peak, more in rms); the pose chord B3-E4-B4 still rings undamped under bar 3 (not ruled on).

**After the review** (rulings of 2026-11-18): (1) The sistrum is 6 dB up (LEVEL 0.05 to 0.1), and the five light shakes sit 20 ms behind their beats (0.52, 1.52, 4.278, 4.917, 5.568), off the chain's grid; the full shake at 2.0 is unmoved. In 3-10 kHz, alone, each light shake now peaks at -29.4 to -30.1 dBFS against -31.8 to -32.5 for the chain tick nearest it (-30.8 at 11.5, where the crossing bell adds), and over its first 50 ms its rms is -42.6 to -43.8 against the tick's -52.4 to -52.9. In the mix with the bike (10 ms steps) each shake's onset is 0.9 to 2.4 dB above the tick 20 ms before it, and it goes on at about -40 dB after the tick has fallen to -57 to -60. (2) The sweep's six strings are damped by u = 3.60 with a 0.15 s fade; the sweep alone is -45 dBFS at 3.60 and -55 at 3.75 (the room only), and at the A4 of 3.619 the sweep's other pitches are 29 to 33 dB under it. Finding 3 stands as it was. Notes, times, instruments and the `lead` export are otherwise unchanged. Still not listened to.
