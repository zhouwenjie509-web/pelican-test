# Music · Section 16 · 8 位像素游戏 · 8-Bit Pixel Game

| | |
|---|---|
| Film time | 95.0 s – 101.0 s |
| Part file | `audio/parts/16-pixel.js` (`node tools/audio.mjs --section 16 --check`) |
| Owner's brief | "8-Bit: Four-channel chiptune music consisting of two square waves, one triangle wave, and one noise channel. Use an original coin-collection sound effect." |
| Loudness target | -20 LUFS |
| Scale | major |
| Picture | `briefs/16-pixel.md`, `src/scenes/pixel.js`; `briefs/CUES.md`, "Section 16" |

## The idea

The tune as a game's level music, on a sound chip with four channels and
nothing else. The discipline is the style: one note at a time per channel,
and when a sound effect is needed it has to take a channel away from the
music, as it did on the real machines.

## The four channels

Never more than one sound per channel at any instant. A new note on a channel
ends the note before it.

- **Pulse A**: the tune, an octave up (D5 … B5; `leadOctave: 1`). Duty cycle
  12.5 %, 25 % or 50 %, changed for colour. Volume in 16 steps, changed in
  steps at 60 per second. Vibrato, if any, in steps too.
- **Pulse B**: harmony: an echo of the tune one eighth later and quieter, or
  broken chords in sixteenths. It also carries the sound effects.
- **Triangle**: the bass. A 32-step staircase triangle at fixed volume (on or
  off, no envelope). It may also drop quickly in pitch for a kick.
- **Noise**: drums, from a shift-register sequence (compute the sequence
  yourself, in `prepare()`): short bright bursts for the hat on sixteenths,
  a longer one for the snare on beats 2 and 4.

Dry: no reverb. Close to mono.

The sprite changes drawing eight times a second, so its pedalling is a
sixteenth-note pulse. The noise hat is that pulse.

## The three bars

| u | Picture | Sound |
|---|---|---|
| 0.0 | The pelican rides onto the pier | Tune on pulse A; pulse B in sixteenths or echo; triangle bass bouncing in eighths; hat on sixteenths, snare on 2 and 4 |
| 2.0 | | B5, the top of the tune |
| 2.5 | Take-off: the sprite switches to its air frame and stops pedalling | **Jump effect** on pulse B: a quick upward sweep, about 0.18 s. **The hat stops**: nothing pedals in the air |
| 3.0 | The top of the jump: the token is collected, a sparkle, `1UP` appears | **Coin effect** on pulse B: three fast rising notes, **D7 F#7 A7**, 30 ms each, the last one ringing down over about 150 ms. Pulse A holds the tune's E |
| 3.125–3.5 | `1UP` rises and blinks | **1UP jingle** on pulse B: **D6, E6, F#6, A6** at 3.125, 3.1875, 3.25, 3.3125, then **D7** at 3.375 held to 3.5. It is the tune's own first cell, fast |
| 3.5 | Landing: a squash frame and two dust pixels | **Landing**: a short low thud on the noise channel (and a drop on the triangle). The hat starts again |
| 4.0 | Riding on | The tune's bar 3 on pulse A, pulse B a third or a sixth under it, the bass walking D, G, A |
| 5.5–6.0 | | A snare fill in sixteenths into the frame. The bell takes the D |

Declare cues at u = 0, 2.5, 3.0 and 3.5.

## Rights

Everything here is invented. Do not imitate any real game's coin, jump,
extra-life or level music, however slightly. In particular the coin is not
two notes a fourth apart, and the 1UP jingle is not any six-note fanfare: use
exactly the notes above, which come from our own tune.

## The bicycle here

`bike: { chain: 0, bell: 1 }`. The chip's noise channel does the ticking in
this section. The bell on the crossing stays: it is the pelican's own.

## Hand-over

In: Section 15 is sine beeps and a tube's hum. Out: Section 17 is a
ring-tone. Chip notes end dead; there is no tail to manage.

## Check

- `--print` shows no two events overlapping on one channel (give every event
  a `channel` field and check it in a few lines of your own).
- The spectrogram shows the square waves' odd harmonics as evenly spaced
  bright lines, the bass as a low line with weak harmonics, the hat as thin
  noise marks on every sixteenth, and a gap in the hat from 2.5 to 3.5.
- The coin, the jingle and the landing stand exactly on their lines.

## As built

Nothing here was listened to. Everything was checked by measurement (the
check, the probe on each channel rendered alone with
`dev/audio/pixel-channels.js`) and by looking at the spectrogram.

**The chip.** Four channels, one sound each at a time; `score()` refuses to
build if two events on one channel overlap or one sounds past u = 6. Every
event has a `channel` field (A, B, T, N). A 60 Hz driver sets pitch, duty and
volume (0..15) per frame; volume steps slew over 1 ms, and every buffer has
2 ms raised-cosine ends. All buffers, the outro's `lead` notes included, are
made in `prepare()` (0.13-0.16 s as the check reports it).

- **Pulse A / B**: an 8-step wavetable (12.5, 25 or 50 % duty, zero mean),
  band-limited with a polyBLEP correction at each edge. The probe shows a
  25 % D5 with harmonics 1 2 3 5 6 7 (the 4th missing), as a 25 % pulse must.
- **Triangle**: the 32-step staircase 15..0..15, polyBLEP on every step,
  fixed volume. Probe: D2 with its 3rd harmonic at -19 dB (1/9) and little
  else.
- **Noise**: a 15-bit LFSR (x^15 + x^14 + 1, period 32767) computed once,
  clocked per drum and held (sample-and-hold), then filtered (second-order
  biquads in the buffer). Hat: clock 44 kHz, high-passed at 6 kHz, two
  frames (vol 6/3 on eighths, 4/2 between); probe of the first hat: -36.5
  dBFS rms in 6-20 kHz against -65.8 in 30-2000 Hz. Snare: clock 24 kHz for
  one frame then 9 kHz, high-passed at 180 Hz, fourteen frames falling
  12 -> 1 (0.24 s). Landing: clock 2.4 -> 1.5 -> 1 kHz, low-passed at
  1.8 kHz (and high-passed at 40 Hz), 0.11 s; -27.3 dBFS rms below 1.8 kHz,
  -44.4 above.
- The chip's mix (`CH_GAIN`, at volume 15): A 0.424 (0.3 +3 dB), B 0.3,
  T 0.111 (0.14 -2 dB), N 0.142 (0.2 -3 dB). Channels alone, in the part's
  six seconds: A -22.2 LUFS, T -27.2, B -29.7, N -29.3: the tune is the
  loudest channel by 5 LU.
- Dry; pan A -0.08, B +0.08, T and N centre. Bus gain 0.613.

**What plays (u, seconds).**

| u | A (tune, D5..B5) | B | Triangle | Noise |
|---|---|---|---|---|
| 0–2 | tune bar 1, duty 25 % | D4 F#4 A4 D5 in sixteenths, 12.5 % | D2 D3 bouncing in eighths | hat every sixteenth, snare 0.5 and 1.5 (hat at 0.625, 1.625 left out) |
| 2.0 | B5 (bar 2's B A F# at 12.5 %) | G4 B4 D5 B4 | G2 G3 … | hats to 2.375 |
| 2.5 | A5 | **jump**: 11 frames stepping D5 -> A6, duty 50 -> 25 %, 0.18 s | G2 G3 | silent (nothing pedals) |
| 3.0 | E5 held to 3.98, duty 50 %, stepped vibrato (±12 cents, 7.5 Hz) from 3.25 | **coin** D7 3.00, F#7 3.03, A7 3.06 ringing down (vol 12 10 8 7 6 …) | A2 held 3.0–3.45 | silent |
| 3.125 | | **1UP** D6 3.125, E6 3.1875, F#6 3.25, A6 3.3125, D7 3.375–3.5 | | |
| 3.5 | | | **drop** A3 -> A1 in six frames (0.12 s) | **landing** thud |
| 3.625 | | E4 A4 C#5 sixteenths | A3 at 3.75 | hats again from 3.625 |
| 4–6 | tune bar 3, duty 25 % | a sixth under: A4 G4 F#4 D4 C#4 D4 | D2 D3 D2 D3, G2 G3, A2 A3 | hats; snare 4.5; fill 5.5 5.625 5.75 5.875 falling away (vol 8 7 6 5, last stroke 75 ms) |

Lead notes end two frames early (the held E 20 ms early); the last sound
ends at u = 5.967 (the last eighths of A and B), so the bell's D comes out of a clean 33 ms gap. Cues
declared at 0, 2.5 (band 520–760 Hz), 3.0 (2–9 kHz), 3.125 (1.1–1.25 kHz)
and 3.5 (40–400 Hz); all land within 6 ms (+2, +4, +4, +4, +6).

`lead`: one pulse-A note (25 %) for the outro; `leadOctave: 1`. Its buffers
are made in `prepare()`: D major from A4 to D6 (11 pitches) at the tune's
three lengths (0.25, 0.5, 1.0 s, each released two frames early), 33
buffers. A note is played from the shortest prepared buffer that covers its
length, ended at that length with a 2 ms fade (a tone's frames depend only
on time since its start, so this is the same sound; `dev/audio/pixel-lead.mjs`
finds no sample difference). All 19 notes the outro gives it find their
buffer ready; a pitch outside the set is still made on demand. Its gain
carries -3 dB to undo pulse A's +3 dB, so the outro hears it at the level
it had. `bike: { chain: 0, bell: 1 }`.
`bike: { chain: 0, bell: 1 }`.

**Where it differs from the table above it, and why.**
- The coin's A7 cannot ring 150 ms: the 1UP jingle takes pulse B at 3.125,
  65 ms after the A begins, and a new note ends the one before it. The ring
  is written as eleven frames of volume steps (183 ms) and is cut by the
  jingle at vol 7 of 12.
- The hat starts again at 3.625, not 3.5: the landing thud has the noise
  channel at 3.5, and the scene's pedalling resumes at 3.625.
- The noise is also silent on beat 2 of bar 2 (2.5): no snare in the air.
- Bar 3's pulse B is a sixth under the tune throughout (the brief allows a
  third or a sixth).

**Unsure.** The triangle still carries a fair share of the energy (15.3 %
below 120 Hz after the re-balance, 24 % before). On small speakers the D2
notes may vanish and on large ones they may dominate. The spectrogram's
short window smears the low notes into a solid band, so it cannot show this.
The `lead` voice was not heard in the outro (the outro is still a stand-in);
its level there is the outro's to set.

**After the review** (2026-11-18). Nothing was listened to; each change was
measured. (1) The noise channel's filters are now applied: `dsp.biquad`
returns a new array and its result had been thrown away, so hat, snare and
landing were unfiltered. (2) The snare fill now falls away into the frame
(vol 8 7 6 5, was 8 9 10 11): in 1.8-9 kHz its strokes measure -32.4,
-33.6, -35.5, -37.8 dBFS rms against the bell's -21.6, and
`--with bike --check` reads crossing 16 ok on its own (+2 ms, 10 dB; it
failed before). (3) The outro `lead` is made in `prepare()` (see above), not
at play time. (4) The chip's mix: pulse A +3 dB, triangle -2 dB, noise
-3 dB, bus 0.62 -> 0.613 for -20.0 LUFS; the tune is now the loudest
channel. (5) The coin comment now says eleven frames, 183 ms. Notes, times,
instruments and the section's level are otherwise as they were. The cue
rises at 3.0, 3.125 and 3.5 are smaller (6, 9, 7 dB; were 8, 12, 8) because
the louder pulse A fills more of the time before them; all read ok.
