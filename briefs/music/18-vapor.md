# Music · Section 18 · 蒸汽波 · Vaporwave

| | |
|---|---|
| Film time | 107.0 s – 113.0 s |
| Part file | `audio/parts/18-vapor.js` (`node tools/audio.mjs --section 18 --check`) |
| Owner's brief | "Vaporwave: Slowed-down 1980s shopping-mall cassette music.", and the special requirements below |
| Loudness target | -19 LUFS |
| Picture | `briefs/18-vapor.md`, `src/scenes/vapor.js`; `briefs/CUES.md`, "Section 18" |

## The owner's requirements (verbatim)

> The vaporwave soundtrack must capture the texture of "slowed-down 1980s shopping-mall cassette music."
>
> **1. First, Synthesize an Original Source Track.** Create an original piece in the style of 1980s smooth jazz / shopping-mall background music. Use: FM electric piano playing major-seventh and minor-ninth chords; fretless bass; FM saxophone playing a variation of the main melody; soft drums with gated reverb. Set the tempo to 151.2 BPM. Set the key four semitones higher than the main key. Render it into an `AudioBuffer` using `OfflineAudioContext`.
>
> **2. Process It Like a Cassette Tape.** Set `playbackRate = 0.7937`. This reduces the playback speed and pitch simultaneously by four semitones, bringing the music back to 120 BPM and the main key. Apply: long reverb lasting approximately 3–5 seconds; a high wet-signal ratio; a low-pass filter around 4 kHz to muffle the high frequencies; slight `detune` modulation using a low-frequency oscillator at approximately 0.5 Hz to simulate tape wobble; a very subtle layer of tape hiss.
>
> **3. Entry and Exit Transitions.** When entering the section, create a "tape slowing down" effect that slides toward 0.79× playback speed. When leaving the section, create a "tape speeding up" effect that returns playback to its original speed on a strong beat.
>
> **4. Second-Measure Joke.** Take a half-beat segment of the source audio and loop it three or four times, creating a skipping-record effect. Then resume normal playback.

Every one of these is a requirement, including the method: the source is a
separate piece rendered with `OfflineAudioContext` into an `AudioBuffer`
(in `prepare()`), and the section plays that buffer through a tape.

## The source track

An original piece in F# major (the film's D plus four semitones) at
151.2 BPM (one beat = 0.396825 s). Twelve beats carry the film's tune in
three bars; put one bar of lead-in before them and one bar of tail after,
so that the tape is already running when the section opens and still
running when it closes.

- **FM electric piano**: major-seventh and minor-ninth chords. For example
  `F#maj7 . D#m9 . | Bmaj7 . G#m9 → C#9sus | A#m7 D#m9 G#m9 C#13 |`. A
  tine-like FM piano: a bell-bright attack that softens into a round tone.
- **Fretless bass**: slides into its notes, vibrato on the long ones.
- **FM saxophone**: a variation of the main melody (the tune in F#: F# G# A#
  C# D#), relaxed, a little behind the beat in feel but with the tune's
  skeleton notes on their beats. Breath in the attack, vibrato that arrives
  late.
- **Soft drums with gated reverb**: a soft kick, a rim or snare on beats 2
  and 4 whose reverb is cut off abruptly after about 150 ms, quiet closed
  hats.

Build a Kit on your own `OfflineAudioContext` (`new Kit(offline)` from
`audio/engine/kit.js`) and reuse the same instrument functions there. Store
the result with `putBuffer`.

## The tape

Source position for film time u, in steady playback:
`p(u) = LEAD + 0.7937 × u`, where LEAD is the source time of the tune's first
beat. A source beat then lasts 0.5 s of film: the tape is on the film's grid.

| u | Picture | Sound |
|---|---|---|
| 0.0–0.8 | The pelican rides into the tape | **Tape slowing down**: the rate slides from 1.0 to 0.7937. During the slide the tape uses more source than `0.7937 × u`; start the buffer earlier by exactly that surplus, so that from u = 0.8 on the position is `p(u)` and the beats are on the grid |
| 0.5, 1.0, 1.5 | The first bust turns a step on each beat | Nothing special: the source's own beats fall here |
| 3.0 | The tape skips: a tracking bar, the picture snaps back | The half beat of source from `p(3.0)` to `p(3.25)` plays |
| 3.25, 3.5, 3.75 | The same quarter second again, three more times | **The same half beat again**, three more times: four in all. Short fades (about 3 ms) at each cut |
| 4.0 | The picture jumps forward; playback resumes | Playback **resumes at `p(4.0)`**: it jumps forward as the picture does |
| 4.0, 4.5, 5.0, 5.5 | Busts turn on the beats | |
| 5.2–6.0 | Riding to the frame | **Tape speeding up**: the rate rises from 0.7937 and reaches 1.0 exactly at u = 6.0 |
| 6.0 | The crossing | The tape stops (a fade of about 30 ms). The send to the reverb closes; the reverb's own tail fades out by u = 7.5 |

The chain: tape → low-pass near 4 kHz → a dry path and a long reverb (about
4 s) with a high wet ratio → out. The wobble: one sine oscillator near 0.5 Hz
feeding the `detune` of every tape source (about ±12 cents). The hiss: very
quiet noise, there from just before u = 0 to just after u = 6.

Declare cues at u = 0 and at 3.0, 3.25, 3.5, 3.75 and 4.0.

The tape events are long: mark them `seekable` and handle `ev.offset` (see
the guide), computing the source position for the moment playback starts.

## The lead

For the outro export `lead`: the FM saxophone as a plain instrument at
written pitch (not the tape). `leadOctave: 0`.

## The bicycle here

`bike: { chain: 0.6, bell: 1 }`.

## Budget

Your `prepare()` renders the source: you may take up to 1 s (other parts get
0.4 s). The reverb may be 4.5 s long.

## Hand-over

In: Section 17 is a dry ring-tone; your tape arrives fast and bright and
sinks. Out: Section 19 opens thin and then drops at its u = 2; your speeding
tape is its run-up. After u = 6 only the reverb tail is yours, and it must be
below -50 dBFS by u = 8.

## Check

- Probe a steady stretch (for example u 1.0–2.0): the saxophone's notes are
  the tune in D, in tune, on the grid.
- The spectrogram shows everything above about 4 kHz dimmed, the pitch
  falling during the first 0.8 s, four identical blocks from 3.0 to 4.0, and
  the pitch rising from 5.2.
- Measure the skip: the four blocks begin at 3.0, 3.25, 3.5 and 3.75 within
  a few milliseconds.
- Everything is original: no quotation, no real jingle.

## As built

Nothing here has been listened to. Everything below was checked by measurement
(`--check`, `audio-probe`, `audio-live`) and by looking at the spectrogram.

**The source** (`renderSource()`, in `prepare()`, about 0.1 s): an original
piece in F# major at 151.2 BPM (beat 0.396825 s), 9.0 s long, rendered on our
own `OfflineAudioContext` with `new Kit(offline)` and stored with `putBuffer`
(`vapor/source`), normalised to peak 0.8. One bar of lead-in (tune beats -4..-1),
the twelve beats of the tune, a tail (the last chord and bass ring to beat 13.5;
hats stop at 11.5, nothing new is struck on beat 12, since the tonic is not ours).

| tune beat | -4 | -2 | 0 | 2 | 3.5 (push) | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| chord (F#) | G#m9 | C#13 | F#maj7 | D#m9 | Bmaj7 | G#m9 | C#9sus | A#m7 | D#m7 | G#m9 | C#13 |
| film (D) | Em9 | A13 | Dmaj7 | Bm9 | Gmaj7 | Em9 | A9sus | F#m7 | Bm7 | Em9 | A13 |
| bass (F#) | G#2 | C#2 | F#2 | D#2 (+D#3 at 3.5) | | G#2 | C#2 | A#2 | D#2 | G#2 | C#2 |

- **FM electric piano**: a sine carrier, a 1:1 modulator whose index falls from
  1.6 to 0.45 in 0.25 s (the bright strike softening), and a 14:1 modulator
  lasting 40 ms (the tine's ping); exponential decay, 0.22 s release. Rootless
  voicings between D#3 and E#4 (film B2 to C#4), below the saxophone.
- **Fretless bass**: a wave of four harmonics (1, 0.42, 0.2, 0.08) through a
  low-pass closing 1000 to 330 Hz; plucked (decays with tau 0.45 s); slides up
  into most notes from 100 or 200 cents below; 4.6 Hz vibrato on notes longer
  than 0.5 s.
- **FM saxophone**: a sine carrier, a 1:1 modulator (index 0.55 + 0.55 vel,
  following the breath) and a little 3:1; body peak at 1150 Hz, low-pass
  4.2 kHz; a breath puff (noise high-passed at 1 kHz, band 2.3 kHz) in each
  attack; 5.1 Hz vibrato arriving after 0.18 s on notes of a beat or more; a
  20 ms release (25 ms of film through the tape). One saxophone: each note's
  sustain ends by the next onset (the notes that sit 12 ms behind are cut
  short before a skeleton note: about 6 ms for a half-beat note, 9 ms for a
  quarter-beat note), so only the release overlaps the next
  note. It plays a variation of the tune (`VARIATION`, written in D and
  transposed up four semitones to F#, F#4 to D#5, D#4/C#4 at the end):

  | beat | 0 | 1 | 1.5 | 1.75 | 2 | 3 | 3.25 | 3.5 | 3.75 | 4 | 5.5 | 5.75 | 6 | 8 | 8.75 | 9 | 9.5 | 10 | 11 | 11.5 |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
  | beats | 1 | ½ | ¼ | ¼ | 1 | ¼ | ¼ | ¼ | ¼ | 1½ | ¼ | ¼ | 2 | ¾ | ¼ | ½ | ½ | 1 | ½ | ½ |
  | film (D) | D4 | E4 | F#4 | G4 | A4 | F#4 | E4 | F#4 | A4 | B4 | A4 | F#4 | E4 | F#4 | A4 | E4 | D4 | B3 | A3 | B3 |

  The six skeleton notes (beats 0, 2, 4, 6, 8, 10) on their beats at velocity
  0.85; every other note 12 ms behind, half-beat notes at 0.68, quarter-beat
  notes at 0.6. Scoops into beat 2 (-35 cents), beat 4 (-35) and beat 8 (-30);
  a small fall (-40 cents) off the F# at beat 5.75, onto the held E. The
  quarter-beat notes (0.087 to 0.096 s of source) carry `short`, which keeps
  every breakpoint of the saxophone's envelopes inside the note (without it the
  0.12-0.16 s points of the normal shape would land after the note's end and
  leave it sounding until its oscillators stop); the outro's `lead` never sets
  it and plays exactly as before. The G at beat 1.75 is the only note outside
  the five-note scale: a passing note into the A, while the F#maj7 (film Dmaj7,
  C#3 F#3 A3) is already in its release (its sustain ends at beat 1.5).
- **Drums**: soft kick (sine 150 to 52 Hz in 50 ms, firm head, gone by 0.17 s)
  on beats 1 and 3 of each bar; snare (band noise at 1.9 kHz with a 190 Hz body)
  on 2 and 4 into a 0.5 s room behind a gate that opens with the hit and shuts
  in 6 ms at 150 ms; closed hats on the eighths, quiet.
- The first downbeat (tune beat 0: kick, chord, bass, saxophone) is pushed early
  in the source by the slide's surplus (0.0413 s), so that through the tape it
  sounds at u = 0 with the bell. Every other beat is on the source's grid.

**The tape** (the section's events; film times are exact):

| u | event | what |
|---|---|---|
| -0.02 to 7.58 | `bed` (seekable) | hiss (pink noise 2.5-9 kHz at gain 0.0078: -56.2 LUFS alone, rms -64.3 dBFS in 3-9 kHz over film 108.5-111.5, 7.5 dB under the rest of the part in that band; fades in by u 0, out 6.0-6.07); the wobble's 0.5 Hz sine into every tape source's detune, ±10 cents; the room's send open (0.38), ducked to 0.1 over u 2.98-3.0 and back over 3.99-4.0, closing 6.0-6.03; the skip's lift (below) open over the same times; the room's return fading out 6.0-7.5 |
| 0 to 0.806 | `slide` | the slide in: rate 1.0 to 0.7937 as R + (1-R)(1-u/0.8)^3, starting at LEAD - 0.0413 s (the surplus); 3 ms fade in |
| 0.8 to 3.0 | `A` (seekable) | source at playbackRate 0.7937 from p(0.8) (6 ms cross-fade at 0.8); 3 ms fade out at 3.0 |
| 3.0, 3.25, 3.5, 3.75 | `skip` ×4 | the half beat p(3.0)..p(3.25) (tune beat 6: kick, G#m9, bass, the saxophone's held note), 3 ms fades at each cut |
| 4.0 to 5.206 | `B` (seekable) | source at 0.7937 from p(4.0) |
| 5.2 to 6.03 | `runup` | the run-up: rate 0.7937 to 1.0 as R + (1-R)((u-5.2)/0.8)^3, exactly 1.0 at u 6.0; 30 ms fade out 6.0-6.03 |

Chain: tape → high-pass 45 Hz → low-pass 4 kHz → low-pass 5.5 kHz → dry (0.186)
and send (0.38) → two high-passes at 200 Hz → room (4.2 s, t60 3.4 s, dark,
30 ms pre-delay) → return; and a third path, the skip's lift: a gain (0 except
during the skip, then 1.5 × 0.186) → high-pass 200 Hz → out. During the skip
the send is ducked to 0.1 and the dry tape comes up 1.5 times above 200 Hz, the
band the room had masked, so the low end (kick, bass) stays as it was. The wet
share is high elsewhere: at an earlier stage, raising the send 2.5 times (with
the dry path unchanged) raised the loudness by 4 dB.

The slide and the run-up are resampled from the source in `prepare()` (four-point
interpolation, the same rate curves) and played at rate 1. The first version
automated `playbackRate` with `setValueCurveAtTime`; `tools/audio-live.mjs` then
found live and offline different (correlation 0.05 to 0.25), because a buffer
source reads `playbackRate` once per 128-sample block. As built, live matches
offline: correlation 1.00000, lag 0, over film 105-115. The seams at 0.8 and
5.2 add the wobble's own drift to the start position.

Cues: u 0 (full band), and 3.0, 3.25, 3.5, 3.75, 4.0 measured in 66-150 Hz (the
head of the restruck kick and the bass's restart, dry tape only): +10 to +11 ms,
rises 8-14 dB. Lead notes: the saxophone's variation in D is declared with
silent marker events (`sung`) at its own times, because the saxophone sounds
inside the tape buffer. Notes of half a beat or longer carry `tol: 25` (the
tape wobbles on purpose), and those in the slide (u < 0.8) and in the run-up
(from 5.5) are marked `free`; the nine quarter-beat notes are `lead: true,
free: true` (too short to measure through the tape and the hall). Seven notes
are measured.

Every time `tape()` derives from `when` and hands to a raw Web Audio call
(`start`, `stop`) is taken through `Math.max(0, …)`; `bed()` already did so
for its `cancelScheduledValues`, and every other call goes through the Kit.

`lead`: the saxophone (`sax`) as a plain instrument at written pitch,
`leadOctave: 0`. `bike: { chain: 0.6, bell: 1 }`.

**Unsure / not checked.**
- The skip cues could not be declared in a mid band. In 300-3000 Hz the checker
  finds no rise of 3 dB at 3.25, 3.5, 3.75 and 4.0 (3.0 reads +40 ms), and the
  same with the room removed entirely (a scratch render with send 0 and the
  return shut during the skip): the block begins on the note onsets, and the
  saxophone's and the chord's attacks there take about 35-45 ms of film to
  speak, so the midrange shows each cut as a dip (5-11 dB in 300-3000, against
  1-4 dB before the review) but not as a rise inside 15 ms. In 2800-4000 Hz (the
  piano's tine) 3.25-3.75 rise 5-8 dB but read +21 to +30 ms, and 3.0 and 4.0
  show nothing. The cues are therefore measured in 66-150 Hz.
- The wobble is ±10 cents by construction (the oscillator's gain); measured on
  the saxophone's E in the four identical skip blocks (dry render), the spread
  between blocks doubled (2.8 to 5.3 cents over a part of the cycle that should
  span about 9 cents): the probe reads it smaller than built.
- The lead-note tuning in this wet room depends on phase: a note can read 30
  cents off when the room's return of an earlier note of the same pitch
  cancels its fundamental in the short measuring window. Worst now +10.4 cents
  (B4 at u 2.0), inside the 25-cent allowance; before the variation it was
  -20.6 cents on the F#4 at u 1.5, which is now a free quarter-beat note.
- Seeking (the `offset` paths of `bed`, `A`, `B`, and the drift at the seams)
  was not exercised by any tool; `audio-live` was not re-run after the review.
- How the wobble, the hiss and the 4.2 s room actually sound together, and
  whether the skip is heard as a skip: nothing was listened to.
- Whether the variation's quarter-beat notes are heard as notes through the
  4.2 s hall: nothing was listened to. They are free, so the checker does not
  measure them, and its picture draws no dotted line for a free note.

**After the review.** (1) During the skip, u 2.98-4.0, the room's send is ducked
from 0.38 to 0.1 and the dry tape comes up 1.5 times above 200 Hz (a new lift
path), so the four blocks show through the midrange in the spectrogram; the
skip cues moved from 38-66 Hz to 66-150 Hz, because no mid band reads them (see
above). (2) The saxophone's release is 20 ms (was 80) and a note's sustain ends
by the next onset: the F#4 under the following A4 at u 1.75 fell from -4.2 to
-12.6 dB against the A4 (dry render, 0.14 s window; what remains is the chord's
F#3 second harmonic). This also changes the outro's `lead`. (3) The wobble is
±10 cents (was ±5) and the marker notes carry `tol: 25`. (4) The hiss is 11 dB
up (gain 0.0022 to 0.0078: -67.2 to -56.2 LUFS alone). (5) Segment `B` is
seekable. The loudness moved from -19.3 to -19.7 LUFS (target -19); the bell
band before u 6 from -55.3 to -53.9 dBFS; energy below 120 Hz from 6.0 to 6.7 %.

**After the acceptance check.** (1) The saxophone plays a real variation (the
table above), not the tune note for note: a passing G into the A, a turn
F# E F# A into the B, the B held a beat and a half and then A F# falling onto
the E, an escape A after the F# of beat 8; the six skeleton notes, their
scoops, the held E at beat 6 (the skip's block) and the last bar are as they
were. The checker's marks follow it. Measured in the mix (80 ms windows,
220-520 Hz, 20 ms after each onset, against the strongest partial): G4 at
film 107.91 is -8.0 dB (absent before); the E4 at 108.66 is now the strongest
(-9.6 dB before); the A4 at 108.785 fell from 0.0 to -18.7 dB under the new
F#4; the B4 at 109.785 is the strongest (-8.9 dB before) where the old A4 was.
The skip block (film 110.02-110.22) reads the same partials as before, E4
strongest. The G was kept, not replaced by E F# E F#: at film 107.895 the
chord's F#3 lies 10 dB under it (-15.6 against -5.6 dB), in its release. (2)
`tape()` takes `Math.max(0, …)` of its start and stop times: renders from
116.0, 117.2, 118.9 and 120.3 (one second each, preroll 8 s) exit 0 with no
ERROR line; the arithmetic of the old line gives -2.2e-16 for segment A from
117.2, as the acceptance check found. Alone: -19.8 LUFS (was -19.7), peak
-9.4 dBFS (-8.9), worst lead +10.4 cents over 7 measured notes (13 free),
skip cues +10 to +11 ms, bell band -53.9 dBFS (unchanged). Nothing was
listened to.
