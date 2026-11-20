# Music · Section 13 · 蒙克《呐喊》 · The Scream

| | |
|---|---|
| Film time | 77.0 s – 83.0 s |
| Part file | `audio/parts/13-scream.js` (`node tools/audio.mjs --section 13 --check`) |
| Owner's brief | "The Scream: Strings, which suddenly go out of tune and produce a scream-like effect" |
| Loudness target | -18 LUFS |
| Scale | major, shadowed (see below) |
| Picture | `briefs/13-scream.md`, `src/scenes/scream.js`; `briefs/CUES.md`, "Section 13" |

## The idea

The same orchestra as in The Starry Night, four years later and in worse
weather. A man stands at the railing with his back to us. The pelican rings
its bell to get past. He starts, and the whole orchestra starts with him:
every player's note tears loose from its pitch and the sound becomes a
scream. Then the landscape settles, slowly, and so do the strings.

## Instruments

A string orchestra. Section 12 (`audio/parts/12-starry.js`) has one: read it,
and copy what you need into your own file (do not import from it), so that
the two sections are plainly the same band. Here it plays colder: less
vibrato, bows near the bridge (thinner, glassier, more upper partials), and
a slow swell and ebb on every chord, like the lines of the fjord.

- **Violas and cellos**: the tune, at written pitch (D4 … B4), dark.
- **Violins**: a high, thin, trembling A (sul ponticello tremolo), very soft.
- **Basses**: long notes.
- Harmony: the plain chords with a flattened sixth (B flat) creeping into an
  inner voice in bar 1: something is slightly wrong before anything happens.
- **The bicycle bell**: borrowed from the bicycle part
  (`import { ring } from "./bike.js"`; `s.at(2.95, ring, { vel: 0.9 })`).
- **A hall**, about 2.5 s.

## The three bars

| u | Picture | Sound |
|---|---|---|
| 0.0 | The pelican rides onto the walkway under a red sky. A man at the railing, back turned | The tune in violas and cellos, swelling and ebbing; the high trembling A |
| 2.0 | | B4 |
| **2.95** | **The pelican rings its bell**: six bright strokes fly out from the handlebar (2.95–3.25) | **The bell**, once at 2.95, and once more, softer, at 3.08 |
| **3.0** | **The man starts**: shoulders up, head round, then (from 3.045) the skull face with hands on the cheeks. The railing shudders (3.0–3.25) | **The scream.** On 3.0, loud and at once: the tune's E tears upward. Violins slide up by a sixth to an octave within a quarter of a second into a tight cluster, with a fast wide shake (8–9 Hz, most of a semitone), hard and bright (the energy between 2 and 5 kHz); violas and cellos slide apart downward by quarter-tones. Shape it like an open mouth: a strong band near 1.2 kHz and another near 3 kHz. It peaks at about 3.3 and wails to about 3.8 |
| 3.0–4.9 | A jolt runs out from his head through the whole landscape | |
| 3.8–5.0 | The landscape settles; the colours are redder | The pitches sag back towards the tune. The orchestra finds bar 3's notes one by one, each still a little sour (up to 20 cents out, drifting to true), quiet, without vibrato |
| 5.0–5.75 | | B, A, B: in tune again, pale. The bell takes the D |

Declare cues at u = 0 (`soft: true`), 2.95 (the bell: `band: [1800, 9000]`)
and 3.0 (the scream: it must begin within 15 ms, so give it a hard attack).

Mark every lead note from 3.0 to 5.0 `free: true`.

## The bicycle here

`bike: { chain: 1, bell: 1 }`.

## Hand-over

In: Section 12's hall is still ringing, the same orchestra. Out: Section 14
is a cinema piano and an organ, in the minor: by 5.75 you are quiet and in tune.

## Check

- The picture: steady partials in bar 1; at 3.0 a vertical edge, then lines
  fanning upward and downward and thickening into a bright band between 2
  and 5 kHz; from about 3.8 the lines bending back and thinning.
- The scream is the loudest moment and stays below the peak limit.
- No real scream: no voice, only strings.

## As built

(Nothing here was listened to. Everything below was checked by measurement, the printed score and the spectrogram only.)

**Instruments** (all oscillators; no buffers but the hall and the borrowed bell):

- **The bowed string** (copied from 12-starry.js and extended): a PeriodicWave of Helmholtz motion (partial n at 1/n, thinned by the bow point at 1/8.6 of the string), with Schroeder phases instead of sine phase so that the waveform's crest is a few dB lower; through a lowpass that opens as the bow bites; amplitude drawn per note; vibrato from `k.lfo` with a different phase per player; a pitch line on the oscillator's detune for every glide; a few ms of band-passed rosin noise as the bow takes hold (1.5 ms to its peak on the hard bites at 3.0).
- **Sul ponticello** (the violins): the same motion bowed at 1/17 of the string with the upper partials falling as n^-0.62 and a weak fundamental, through a lowpass at 6.5–7 kHz: thin and glassy.
- **Violas and a cello** (`tune`): the tune at written pitch, three players (-4, +3, +1 cents; 0, 6, 12 ms), lowpass at 5.5 f, 2.5–4 cents of vibrato in bars 1–2, none in bar 3. This is also the `lead` export (`leadOctave: 0`).
- **Inner voices and basses** (`long`): two players each, long bows that swell to the middle of the note and ebb at its end.
- **Violins' high A** (`shiver`): A5, three players, sul ponticello, bowed tremolo at 12.6–14.8 Hz (depth 0.55), very soft.
- **The scream** (`scream`): four violins, sul ponticello, on their own bus with two "open mouth" peaks (+7 dB at 1.2 kHz and 3 kHz), a high shelf -12 dB from 5.2 kHz, and a tanh soft knee (tanh(4x), its curve spanning an input of -1..1, so the cluster's crests, which reach about 0.69, are rounded and never reach the curve's flat end). A narrow cut (peaking, 2350 Hz, Q 5) on the same bus closes to -14 dB from 3.05 to 3.08, holds to 3.36 and opens again by 3.46: it clears the bell's main partial (2347 Hz) for the second stroke.
- **The bell**: `ring` from bike.js, through the part's own bus and hall.
- **Hall**: 2.5 s, t60 2.0 s, send 0.22. A gentle tanh knee on the whole part (0.5 tanh(2x), linear below about -14 dBFS; its curve spans an input of -1..1, so it never clips), highpass 36 Hz.

**What plays** (u = seconds into the section; bowed notes after the first start 30 ms early):

| u | Sound |
|---|---|
| 0.00 | Tune D4 with a clear bite (25 ms); inner F#3 (held to 2.0) and A3; bass D2; the high trembling A5 (to 3.0). Chords swell and ebb. |
| 0.47–1.97 | Tune E4 F#4 A4 F#4 A4. At 0.97 the inner A3 creeps up to **B flat 3**, which ends at 1.99 with a 0.06 s release, handing over to the B3. |
| 1.97 | Tune B4 (the top); inner G3 + B3, bass G1, swelling and ebbing to 30 % before 3.0. |
| 2.47, 2.72 | Tune A4, F#4, softer: the bar holds its breath. The high A ebbs to 30 %. |
| **2.95** | **Bell** (vel 0.9). Cue, band 1800–9000 Hz. |
| **3.00** | **The scream.** Four violins bitten on E5 (3 ms to 85 %, rosin noise) slide up by 950, 1000, 1050, 1110 cents within 0.24 s (a quarter-tone cluster at 1.14–1.25 kHz), shaking at 8.1–8.9 Hz, 45 cents deep. The tune's E4 (three players, hard bite) slides apart down by 50/100/150 cents in 0.3 s; inner C#4, A3, E3 and bass A1 slide down by quarter tones too. Loudness rises to 3.3 and holds; it wails to 3.8. Cue, band 1000–1800 Hz (the mouth band). |
| 3.08 | Bell again, softer (vel 0.5), heard through the scream: the scream's bus is cut at 2.35 kHz for its first quarter second. |
| 3.80–4.45 | The violins sag about 400–500 cents and fade (gone by 4.57); the low strings drift back towards true and stop by 4.07. |
| 3.90 | Bass F#1, +15 cents drifting true. |
| 3.97 | Tune F#4, -18 cents drifting to -4. Then E4 (4.47, +14 → +4), D4 (4.72, -10 → -2). No vibrato. |
| 4.15, 4.35 | Inner A3 (-20 → -3), D3 (+12 → +2). |
| 4.55 | Violins' A5 again, pale, without tremolo, -15 → -2 cents, to 5.88. |
| 4.97 | Tune B3, pale and in tune; G1, G3, D3. |
| 5.47 | Tune A3; A1, G3, E3. |
| 5.72 | Tune B3, ending at 5.93 (release to 6.02, lowpassed near 1 kHz). The bell and Section 14 take the D. |

Lead notes from 3.0 to 5.0 are marked `free`. Cues: 0.0 (soft), 2.95, 3.0. `bike: { chain: 1, bell: 1 }`.

**Measured:** -18.6 LUFS alone, peak -8.6 dBFS (at 3.018); the scream is the loudest stretch (about 6 dB above bar 1, 3.0–3.5). Cue lags: u 0 +14 ms (soft), 2.95 +3 ms, 3.0 +7 ms. In 2300–2400 Hz, 20 ms windows from 3.08 to 3.33, the bell stem reads 10.5 dB or more over everything else (the scream mostly). In the spectrogram: steady partials in bar 1; a vertical edge at 3.0; lines fanning up from 1 kHz into the cluster and its harmonics 2–5 kHz, wavy with the shake; faint lines fanning down below 1 kHz; from 3.8 the upper lines bending down and thinning out by 4.5.

**Unsure:** whether the cluster's beating and the soft knees read as a scream or as roughness; whether the B flat against the tune's A4 sounds "slightly wrong" or just wrong; whether the cut at 2.35 kHz is audible in the scream as a hole (it is 0.4 s long and narrow; the bell fills it). In the full film render the u = 0 entrance rises only 3 dB over Section 12's ending (it passes, but just).

**After the review** (2026-11-18; still nothing listened to). Three rulings carried out. (1) The second bell at 3.08 is heard: a narrow cut on the scream's bus at 2350 Hz (-14 dB, Q 5, 3.08–3.36, ramps of 30 ms in and 100 ms out, driven from the scream's own event); the bell's velocity is unchanged. Measured in 2300–2400 Hz (Blackman-Harris, 20 ms windows): before, the scream reached the bell's level or passed it from 3.18 to 3.30 (bell -27.8 dB, rest -24.9 dB at 3.24); now the bell stem leads everything else by at least 10.5 dB from 3.08 to 3.33. (2) The scream's soft knee rounds instead of clipping: same transfer (tanh(4x) after the old gain of 4) on a curve that spans the whole input; the bus input peaks at 0.687 (1392 samples, 1.9 %, used to pass the old curve's end; now none). The whole-part knee had the same fault on 2 samples (input 0.52 against an end at 0.5) and was widened the same way. (3) The inner B flat 3 ends at 1.99 with a 0.06 s release (was 2.02 + 0.14): 50 ms after the B3 enters it is 5.6 dB lower than before, 90 ms after 11.6 dB lower. Level moved from -18.4 to -18.6 LUFS (in tolerance); notes, times, instruments and the `lead` export are unchanged.
