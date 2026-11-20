# Music · Section 4 · 唐代白描 · Tang Baimiao Line Drawing

| | |
|---|---|
| Film time | 23.0 s – 29.0 s |
| Part file | `audio/parts/04-tang.js` (`node tools/audio.mjs --section 4 --check`) |
| Owner's brief | "Tang Dynasty: Pipa" |
| Loudness target | -20 LUFS |
| Scale | major (D E F# A B) |
| Picture | `briefs/04-tang.md`, `src/scenes/tang.js`; `briefs/CUES.md`, "Section 4" |

## The idea

Pure line, and one instrument: a pipa. The pelican's passing is the only
wind in the picture, and the court ladies' sashes lift one after another as
it goes by. The pipa plays the tune and, like the sashes, is lifted by it.

## Instrument

**A pipa**, played with the nails: a bright, quick, nasal pluck with a hard
tick at the start, dying in well under a second. Its manners:

- **Rolling tremolo** (lunzhi) on any note of a beat or longer: the note
  restruck twelve to fourteen times a second, even and light.
- **A sweep** (sao) across four strings on the downbeats of bars 1 and 3: the
  strings a few milliseconds apart, the tune note on top.
- **A push** of the string on held notes: the pitch rises a tone and returns.
- **Harmonics**: pure, bell-like, an octave or two above.
- **A snap**: the string pulled and let slap against the neck. A dry crack.

The tune at written pitch (D4 … B4). Low open strings (D3, A3) under the
strong beats. Nothing else plays, except a light wooden clapper on the bar
lines if you want one, and a breath of wind (below).

The place is an open terrace: very little room (about 0.8 s, quiet).

## The three bars

| u | Picture | Sound |
|---|---|---|
| 0.0 | The pelican rides along the terrace; the ladies stand still | A sweep, then bar 1 of the tune, rolling the longer notes |
| 1.12–1.66 | The tray-bearer's sashes lift: the first sign of wind | |
| 2.0 | | B4, rolled |
| 2.13–2.73 | The fan-holder's sashes lift | A light upward run of harmonics (five or six notes in about 0.3 s) starting at **2.13** |
| 2.75–3.37 | The flute player's sashes lift | A second run, higher, starting at **2.75** (after the tune's F#) |
| 3.0–4.0 | All five in the group are lifting | The held E, rolled, swelling. A soft breath of wind (filtered noise, very quiet) rises from 2.1 and falls away by 4.2 |
| 3.37–4.04 | The last of the five lifts | A third run, higher again, starting at **3.37** |
| 4.0 | All sashes stream | A sweep; bar 3 of the tune |
| 5.08 | **The banner snaps out** (it begins at 4.93 and is full at 5.13) | **The snap**, with a hard short sweep. It sits between the tune's B3 (5.0) and A3 (5.5) |
| 5.75 | | The last note. The bell takes the D |

Declare cues at u = 0, 2.13 and 5.08.

## The bicycle here

`bike: { chain: 1, bell: 1 }`.

## Hand-over

In: Section 3's bells ring on for a second or two; your first sweep is dry
and close in front of them. Out: Section 5 is a guqin, very quiet: end
cleanly, no tail to speak of.

## Check

- The probe on one note: an attack of a few milliseconds, partials to at
  least 5 kHz at the start, 20 dB down within about 250 ms.
- The rolled notes show as a row of evenly spaced onsets, twelve to fourteen
  a second.
- The snap at 5.08 is the sharpest mark in bar 3.

## As built

One pipa, a clapper and a breath of wind; terrace room 0.8 s (send 0.14). Nothing was listened to: everything below was checked by the check's report, the probe and the spectrogram only.

**Sounds (all computed in `prepare()`, 0.20–0.23 s as the check measures it):**

- *Pipa stroke:* a sum of decaying string partials (`dsp.modal`) up to 11 kHz, amplitudes |sin(πk·0.13)|/k (a hard nail near the bridge), weighted by a nasal body (bumps at 450 Hz +3 dB, 1.2 kHz +7 dB, 2.9 kHz +4 dB; little below 150 Hz, rolling off above 6.5 kHz); fundamental t60 0.9 s, upper partials far faster; plus 2 ms of nail tick around 4.5 kHz. Probe on B3 (u 5.0): 4 ms rise, partials to 5.2 kHz in the first 30 ms, 20 dB down by about 240 ms. Variants: "nail", a lighter "roll" restroke, and a hard short "damp" stroke. "nail" and "roll" are made ahead for every pitch of D major from A2 to D5 (18 pitches, C#4 among them).
- *Roll (lunzhi):* the stroke restruck 13 times a second, each stroke damped by the next over 12 ms, velocities with a small five-finger unevenness. Each restroke is placed on a whole period of the fundamental (at most half a period, under 2 ms, from its written time) so the string's vibration carries on in phase; without that the 13 Hz restrikes combed the spectrum and D4 and F#4 read 32 cents sharp.
- *Push:* a fresh nail stroke whose playback rate is raised a whole tone and returned.
- *Harmonics:* nearly pure tones (octave 7 %, twelfth 2.5 %), t60 0.7 s (0.8 s buffers), faint tick.
- *Snap:* a broadband crack (white noise, highpassed 900 Hz, lowpassed 6 kHz, 0.5 ms rise), three stiff modes of the wooden neck (620, 1530, 2870 Hz, gone in 50 ms) and a choked D3 string. Above 4 kHz it peaks 10 dB above anything else in bar 3.
- *Clapper:* hardwood modes 1180, 2730, 4410 Hz, t60 60 ms, quiet, on u 0, 2, 4.
- *Wind:* pink noise, band filter moving 600 → 1100 → 700 Hz, highpassed 220 Hz, very quiet (alone it peaks at −39.3 dBFS over 25.1–27.2); seekable.

**Times (u, seconds):**

| u | Sound |
|---|---|
| 0.000 | Sweep A2 D3 A3 (6 ms apart, dry: no room send), the tune's D4 on top at 0.018, rolled to 0.5. Clapper. |
| 0.5, 0.75 | E4, F#4 single strokes |
| 1.0 | A4 rolled; open A3 under it |
| 1.5, 1.75 | F#4, A4 |
| 2.0 | B4 rolled to 2.10 only (two strokes, 2.0 and 2.077); the second is a full nail stroke (vel 0.95 × 0.95, about 0.9) that rings, undamped, until the A at 2.5. Open D3; clapper |
| 2.1 – 4.2 | Wind: rises to its peak at 3.3, gone by 4.2 |
| **2.13** | Harmonics E5 F#5 A5 B5 D6, 0.06 s apart; the first (E5) 6 dB up for the cue, the other four 6 dB down (cue, band 600–720 Hz) |
| 2.5 | A4 |
| 2.75 | F#4, and the second run F#5 A5 B5 D6 E6 F#6, 0.055 s apart, about 3.5 dB quieter than before the review (vel 0.6 against 0.9) |
| 3.0 – 4.0 | The held E4: rolled and swelling 3.0–3.31; a fresh nail stroke at 3.33 (the roll damped into it), pushed up a tone from 3.37 (top at 3.52) and back (3.67); rolled again 3.70–3.96, louder. Open A3 under it. Marked `free` |
| **3.37** | Third run A5 B5 D6 E6 F#6 A6, 0.055 s apart, held back 6 dB (vel 0.475 against 0.95) while the push sounds |
| 4.0 | Sweep D3 A3 D4, F#4 on top at 4.018, rolled to 4.5. Clapper |
| 4.5, 4.75 | E4, D4 |
| 5.0 | B3, one stroke (not rolled: the snap interrupts it) |
| **5.08** | The snap, and from 5.083 a hard damped sweep A2 D3 A3 D4 (6 ms apart, 0.2 s long) (cue, band 5–12 kHz) |
| 5.5 | A3 |
| 5.75 | B3, damped by 5.95. In the last 30 ms before u = 6 the band 1.8–9 kHz is at −55 dBFS. |

The tune's own strokes play at level 0.45 (`LEVEL.tune`), 1 dB above the outro voice's 0.4 (`LEVEL.pipa`); the sweeps, open strings and everything else are unchanged.

Lead export: one nail stroke, at `LEVEL.pipa` 0.4, rolled when it is 0.45 s or longer, unchanged; every D-major pitch from A2 to D5 is ready in `prepare()`, so no strike is computed during playback in that range; `leadOctave: 0`. `bike: { chain: 1, bell: 1 }`.

**Unsure of / departures:** the E is still rolled (3.0–3.31) while the second run rings, which a single player could not quite do. The second run starts together with the tune's F# at 2.75 rather than just after it. The sweeps take 18 ms to reach the tune note, so the lead notes on beats 0 and 8 sound 18 ms late. Low strings A2 (the pipa's lowest open string) appear in two sweeps besides the D3 and A3 the brief names. The wind is 8 dB up but still faint in the picture; whether it is just perceptible is not known. Pitches outside A2–D5 would still be computed during playback if the outro asked for them. The outro's use of `lead` could not be tested, because the outro is still a stand-in.

**After the review (2026-11-18):** (1) the B4 roll stops at 2.10 and the first harmonic of the first run is 6 dB up: the 2.13 cue now reads +5.0 ms, rise 5 dB, ok (was +68 ms, LATE). (2) The push is a fresh stroke at 3.33, bent from 3.37, and the third run is 6 dB down: over 3.37–3.70 the held E is −30.7 dBFS rms against the harmonics' −32.3 (was −36.5 against −23.5); the pushed stroke reads −29 dBFS at 3.40, −40 at the top, −51 on the way back (was −34, −45, −56). (3) Harmonics ring 0.7 s instead of 1.5; run 2 is about 3.5 dB and run 3 about 6 dB under their old levels, below run 1: over 3.8–4.4 the harmonics alone are −54 dBFS rms against the tune's −25.5, and over 2.5–3.0 −32.8 against −25.6. Over 2.13–2.5 the run (−25.7) is louder than the B4, which is now a single decaying stroke (−38.6): the price of stopping the roll for the cue. (4) Every D-major pitch A2–D5 is made in `prepare()`, both stroke kinds (prepare 0.20–0.23 s). (5) The wind is 8 dB up (alone, peak −39.3 dBFS over 25.1–27.2, was −46.5). Loudness fell from −20.5 to −21.2 LUFS (target −20, within 1.5 LU), because the harmonics are quieter; peak −7.2 dBFS unchanged. Nothing was listened to.

**After the review, second round (2026-11-18):** (1) The B4's last stroke (2.077) is a full nail stroke at about vel 0.9 instead of a light roll stroke, and run 1's notes 2–5 are 6 dB down (its first note keeps its +6 dB). Over 2.13–2.5, each alone: B4 −32.2 dBFS rms, harmonics −27.7 (4.5 dB apart; was −38.6 against −25.7). In the mix at 25.13–25.50 the B4 fundamental is −8.7 dB under the E5 harmonic (was −14.3) and level with F#5 (−7.1) and A5 (−6.4). The B4 is not damped before 2.515; its fundamental decays from −34.5 dBFS at 2.24 to −54 at 2.48. The 2.13 cue still reads +5.0 ms, rise 4 dB, ok. (2) The tune's strokes are 1 dB up (`LEVEL.tune` 0.45; the outro's `lead` keeps 0.4): −20.3 LUFS (was −21.2), peak −6.4 dBFS alone at 24.005 (was −7.2); with the bike the peak is −6.1 dBFS at 23.021 (was −6.8). The held E is 1 dB up with it (−29.7 dBFS rms over 3.37–3.70 against the third run's −32.3). (3) The HARMONIC_T60 comment is back on its own line; the wind figure is corrected to −39.3 dBFS. Nothing else changed. Nothing was listened to.
