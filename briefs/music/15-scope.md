# Music · Section 15 · 示波器矢量图形 · Oscilloscope Vector Graphics

| | |
|---|---|
| Film time | 89.0 s – 95.0 s |
| Part file | `audio/parts/15-scope.js` (`node tools/audio.mjs --section 15 --check`) |
| Owner's brief | "Oscilloscope: Sine-wave beeps and vacuum-tube hum. When the wrong knob is turned, the pitch distorts along with the Lissajous figure." |
| Loudness target | -22 LUFS |
| Scale | major (D E F# A B) |
| Picture | `briefs/15-scope.md`, `src/scenes/scope.js`; `briefs/CUES.md`, "Section 15" |

## The idea

A laboratory in the 1950s. The tune is a test signal: plain sine tones, one
at a time, over the hum of warm valves. A hand in a lab coat turns the wrong
knob, the pelican on the tube collapses into a tangled figure, and the tone
goes wrong in exactly the same way. The hand turns it back. Nobody mentions it.

## Sounds

- **Beeps**: pure sine tones, the tune an octave up (D5 … B5;
  `leadOctave: 1`), each held for most of its length with clean 8 ms edges.
  No vibrato, no reverb.
- **Low tones**: a second sine, low (D3, G3, A3), on the first beat of each
  two-beat cell.
- **Pips**: the screen's base line carries marks that pass under the pelican
  every quarter second (larger ones on the whole seconds). A very soft, very
  short high pip on each (about 2 kHz, 6 ms), a slightly longer one at 1 kHz
  on the whole seconds.
- **Hum**: mains hum at 60 Hz with its second and third harmonics and a
  little rasp, plus a trace of hiss. Low but always there, from u = -0.5 to
  u = 6.2.
- **Electrification**, u = -0.5 to 0.6: the trace arrives over-bright from
  the fire of Section 14. A fizzing, sparking rasp at twice mains frequency
  that settles into the plain hum by 0.6.
- **The switch**: a rotary switch of hard plastic. Two close clicks.
- Almost no room (a faint 0.3 s).

## The three bars

| u | Picture | Sound |
|---|---|---|
| -0.5–0.6 | The trace arrives electrified: over-bright, sparking | The electrification, settling |
| 0.0 | The pelican, drawn in green light, rides down a sloping base line | Beeps: bar 1 of the tune. Low tones. Pips. Hum |
| 1.6–2.82 | A hand rises to the panel, hovers, and moves to a switch | |
| 2.0 | | B5 |
| **3.0** | **The hand turns the switch to X–Y**: a flash, and the pelican becomes a turning knot (3.03–3.5) | **The switch.** The tune's E **splits**: two sines that leave E in opposite directions and settle in the same frequency ratio as the knot's two axes (read the ratio from the knot in `src/scenes/scope.js`), beating and warbling as the knot turns (it turns at 4.6 radians a second). It should sound exactly as wrong as the picture looks |
| **3.5** | **The switch is flicked back**: a smaller flash; the pelican is whole, and the shape rings for an instant | **The switch.** One pure E again, which **rings**: a quick wobble of pitch that dies in about 0.15 s (the picture's ringing has a time constant of 0.045 s) |
| 3.6–4.4 | The hand withdraws | |
| 4.0–5.75 | Riding on | Bar 3 of the tune in beeps. The bell takes the D |

Declare cues at u = 0, 3.0 and 3.5.

Mark the split tone and the ringing tone `free: true`.

## The bicycle here

`bike: { chain: 0.6, bell: 1 }`.

## Hand-over

In: Section 14 ends in fire: your electrification overlaps its last half
second. Render `--from 86 --to 92` and look at the join: one continuous
crackle that becomes a hum. Out: Section 16 is a game chip. The hum stops
within 0.2 s after u = 6.

## Check

- The probe on a beep: one partial only (everything else 40 dB or more below).
- The probe at u = 3.2: two partials near E5, in the knot's ratio.
- The picture: single horizontal lines for the tune; at 3.0 the line forks;
  at 3.5 it is one line again with a short ripple; the hum as fixed lines at
  60, 120 and 180 Hz along the bottom.

## As built

- **File.** `audio/parts/15-scope.js`. 51 events, at most 18 sources alive, prepare about 0.05 s. `leadOctave: 1`, `bike: { chain: 0.6, bell: 1 }`, `lead` = one beep (oscillator only, needs nothing but `g.out`).
- **Beeps.** One `sine` oscillator per note, linear 8 ms edges (the first beep, D5 at u = 0, rises in 4 ms; the `lead` export keeps 8 ms), held for the note's length minus 40 ms (0.21 s for an eighth, 0.46 s for a quarter), amplitude 0.075. No vibrato, no room. The tune an octave up, D5 … B5, bar 3 ending B4 A4 B4 (last beep released by u = 5.96). The probe shows a single partial per beep (the hum and the low tone are the only other lines).
- **Low tones.** The same sine, amplitude 0.05, held 0.9 s from u = 0, 1, 2, 3, 4, 5: D3 D3 G3 A3 D3 G3.
- **Pips.** Hann-windowed sine bursts on every u = k/4, k = 0 … 23: 2 kHz, 6 ms, amplitude 0.009; on whole seconds 1 kHz, 14 ms, amplitude 0.015. They run through the knot too (the scene keeps drawing the base line while it is thrown).
- **Hum.** One buffer, u = −0.5 … 6.2 (seekable): one 60 Hz period computed and tiled: 60 Hz 0.018, 120 Hz 0.012, 180 Hz 0.008, and a rasp of harmonics 6 … 60 of 60 Hz with random phases in a band round 1 kHz (each at most 0.0011), plus hiss (white noise, 2.5 … 9 kHz, 0.0009). It rises with the picture's own smoothstep (−0.5 … −0.3) and leaves over 6.0 … 6.15.
- **Electrification.** One buffer, u = −0.5 … 0.62: a 120 Hz buzz (harmonics of 120 Hz, 1/n^1.2 with the first two held back to 0.3 and 0.45 so they do not pull Section 14's last notes, random phases, as full-wave rectified mains), its level fizzing with 90 Hz-lowpassed noise, soft-clipped and kept below about 450 Hz; and sparks about 30 a second at irregular times, each a 4 … 10 ms noise burst ringing at 780 … 1480 Hz. All lowpassed at 1.4 kHz (out of the bell's band) and shaped by the picture's own envelope, smoothstep(−0.5, −0.32) × (1 − smoothstep(0.1, 0.6)).
- **The switch.** Two clicks 24 ms apart (the second at 0.6), each a 12 ms tick of band-passed noise (3.2 / 2.7 kHz) with four short modes (about 1.2, 2.4, 3.8, 5.6 kHz, t60 14 … 40 ms). At u = 3.0 (vel 1) and u = 3.5 (vel 0.85), panned 0.25 right (the switch is right of the tube). It alone goes to the room (0.3 s, send 0.18).
- **The split, u = 3.0 … 3.5** (`free`). Computed sample by sample: two sines leave E5 in opposite directions and settle (time constant 10 ms, thrown within two frames, as the picture) at E5 · (2/3)^½ = 538.3 Hz and E5 · (3/2)^½ + 0.73 Hz = 808.1 Hz: the knot's 3 : 2 (x = sin(3·2πs + φ), y = sin(2·2πs)), the upper running 4.6/2π Hz fast because φ turns at 4.6 rad/s. A hunting warble (10 % of the split at 7 Hz, time constant 0.12 s) on the way in; a trace of the lower one's 3rd and the upper one's 2nd harmonic (−23 dB) that beat with each other at 1.46 Hz as the knot turns. Each sine at 0.72 of a beep. Closes over the last 6 ms before 3.5 (the switch blanks the beam).
- **The ring, u = 3.5 … 3.96** (`free`). One E5, 5 ms attack, whose pitch moves as the picture's blend does, at twice the picture's depth: 168 cents (0.24 of the 702-cent spread) · e^(−t/0.045) · sin(2π·11 t). Measured period by period: +107 cents at 23 ms, −39 cents at 68 ms, +14 at 112 ms, −5 at 154 ms, under 2 cents from about 0.19 s.
- **Cues.** u = 0 (band 565 … 610 Hz, the D5, because the electrification is still sounding), u = 3.0 and 3.5 (band 2.5 … 9 kHz, the switch: the held E has no gap before it to measure against). Alone they lag +6, +1, +1 ms; with Section 14 sounding (`--from 87 --to 97`) u = 0 reads +9 ms, 5 dB.
- **Measured.** −21.9 LUFS alone (target −22), peak −14.5 dBFS, largest step 0.068, tail silent. With the bike: both crossings ok. Probe at 92.15 … 92.45: 538.3 Hz and 808.1 Hz at equal level, A3 low tone, hum.
- **Unsure / not done.** Nothing was listened to. The ring is now twice as deep as the picture's ringing (by ruling); whether it is heard as a wobble and not as a mistake could not be checked. The hum and the electrification begin at u = −0.5, before the first downbeat, as this brief asks and against the guide's "never earlier". The join (86 … 92) was first rendered with Section 14 as a stand-in, then again once it was arranged: its ignition sparks (broadband, up to 16 kHz) run 88.5 … 89.0 and mine (below 1.4 kHz) run under them from 88.5 and on to about 89.5, so the crackle continues through the frame but loses its top at 89.0, because mine stays out of the bell's band. With Section 14 sounding, the u = 0 cue still rises only 5 dB (now +9 ms, against a 15 ms limit). The outro's use of `lead` has not been heard.

**After the review.** Two rulings, nothing else changed (notes, times, instruments, levels and the `lead` export are as before). (1) The ring after u = 3.5 is twice as deep, 0.24 of the split's spread, same 0.045 s time constant and 11 Hz: the first swing measures +107 cents period by period (the old one was not measured this way; by the formula it was about +53) (the 85 ms probe track, which smears it, from +10/−11 to +9/−23 cents). It now falls under 2 cents at about 0.19 s instead of 0.15 s. (2) The first beep (D5 at u = 0) rises in 4 ms instead of 8 ms (probe: 10–90 % in 4 ms; later beeps 8 ms; still a single partial): the u = 0 cue went from +8 to +6 ms alone and from +13 to +9 ms in the join with Section 14.
