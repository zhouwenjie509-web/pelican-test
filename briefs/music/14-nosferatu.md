# Music · Section 14 · 《诺斯费拉图》 · Nosferatu

| | |
|---|---|
| Film time | 83.0 s – 89.0 s |
| Part file | `audio/parts/14-nosferatu.js` (`node tools/audio.mjs --section 14 --check`) |
| Owner's brief | "Nosferatu: Silent-film piano and pipe organ" |
| Loudness target | -18 LUFS |
| Scale | minor: `s.theme({ scale: "minor" })` gives D E F A F A, Bb A F E, F E D Bb A Bb |
| Picture | `briefs/14-nosferatu.md`, `src/scenes/nosferatu.js`; `briefs/CUES.md`, "Section 14" |

## The idea

A silent film, so the music is the cinema's: an upright piano down at the
front, and for the frightening parts the organ. Only a shadow is on the
screen, climbing the stairs. The pianist plays the film's tune in the minor
as if it had always been a horror theme.

Do not quote any existing piece. The tune in the minor is enough.

## Instruments

- **A cinema piano**: an upright, a little out of tune. Each note is two or
  three strings a few cents apart, so it shimmers slightly; a wooden thump
  in the attack; boxy rather than brilliant; short. The tune in octaves in
  the right hand; in the left the silent-film player's tremolo, a rapid
  rocking between two notes.
- **A pipe organ**: steady tones with no vibrato. Each pipe speaks with a
  small puff of noise (20–60 ms) before its tone settles. Quiet stops for the
  pedal (a deep 16-foot D); **full organ** for the fright: many ranks at the
  octaves and above, a bright reed among them.
- **The projector**: the film runs at 18 frames a second, and so does a soft
  dry flutter under the whole section, with a faint motor hum. Barely there.
- **A door**: one long wooden creak (a narrow, wavering squeal that slides
  upward, stopping and starting).
- **Fire**, for the last half second: a crackle of bright sparks and a rising
  electric buzz.
- **A cinema**, about 2.8 s, dark.

## The three bars

| u | Picture | Sound |
|---|---|---|
| 0.0 | The pelican's shadow rides along the wall of a dark house | Piano: bar 1 in octaves (D E F A F A), left hand rocking on D and A. The organ's deep D enters very softly and grows |
| 1.85–3.0 | The shadow stretches and leans as it climbs | |
| **2.0** | The front wheel meets the first stair | Bb, the top of the tune. From here the piano's left hand climbs one step every eighth (D, Eb, E, F, F#, G, G#, A), and the organ grows |
| 2.4–2.9 | The wing rises from the handlebar; the neck cranes | |
| **3.0** | **The four feather fingers spring out.** The shadow is at its tallest | **Full organ, at once**: a diminished seventh over the deep D (C#, E, G, Bb, the tune's E on top). Held for the bar's two beats |
| **4.0** | **The door at the head of the stairs swings open by itself** (mostly in the first 0.3 s); cold light | The full organ is gone. One soft high stop holds A. **The creak**, 4.0 to about 4.6 |
| 4.0–5.4 | The hand lowers (4.6–5.2) | Piano alone, low and quiet: bar 3 (F E D, Bb A Bb at their beats), rocking underneath |
| 5.42 | The bill tip kindles green | The organ's last note ends by 5.5 |
| 5.5–5.95 | **Green fire runs along the outline**, bill to tail, with sparks | **The crackle**: sparks and a rising buzz, growing to the frame, released within 0.1 s after 6.0. Section 15 starts its own crackle at this same moment (its u = -0.5) and carries it on: yours is the nearer, drier one |

Declare cues at u = 0, 3.0 and 4.0.

## The bicycle here

`bike: { chain: 0.5, bell: 1 }`: it is only a shadow's bicycle.

## The lead

Export the piano as `lead` (one note; the outro asks for the major scale).

## Hand-over

In: Section 13's shaken strings. Out: Section 15, an oscilloscope: beeps and
a tube's hum. The organ's hall must be below -50 dBFS by u = 8: the full
organ ends at 4.0, so it has time.

## Check

- The probe on the full-organ chord: a dense, even stack of partials with no
  vibrato and no decay while it is held; on a piano note: a fast attack, a
  slow beat, partials dying from the top.
- The picture: the organ's edge on 3.0 is the hardest in the section; at 4.0
  it drops away to one thin line and the creak wavers above it; from 5.5 a
  rising smear of sparks.
- Lead notes measure in tune against the minor scale.

## As built

Part file `audio/parts/14-nosferatu.js`; 138 events, 5 cues. Nothing was
listened to: everything below was checked by the check's report, the probe,
the printed score, scratch measurements (`dev/audio/nosferatu-*`) and the
spectrogram.

**What plays** (u in seconds; film time = 83 + u)

- 0 – 5.965: the projector, under everything (pan +0.3, dry), about 22 LU
  under the part.
- Bar 1 (0 – 2): piano right hand in octaves, D4/D5 E F A F A (lead = the
  lower note); the A at 1.75 is lifted (0.12 s) and played lighter, a breath
  before the top. Left hand: tremolo in thirty-seconds on D3/A3, growing a
  little. The piano of bars 1 and 2 (tune and tremolo) is 4 dB under bar 3's
  scale of levels, so that the full organ stands out. Organ pedal D
  (bourdon 16' + flute 8', i.e. D1 + D2) from u 0, very soft, growing.
- Bar 2: u 2.0 Bb4/Bb5 at the same velocity as the A at 2.5 (no accent); F
  at 2.75. Left hand climbs one semitone every eighth in octave tremolo,
  D2/D3, Eb, E, F, F#, G, G#, A (the F's last stroke left out and damped
  before 3.0; F# to A under the full organ, played lighter). Every tremolo
  stroke is 0.075 s with a 45 ms damper, so it is silent 5 ms before its key
  is struck again (0.125 s later). From 2.0 a soft flute fifth D3 + A3 swells
  in the manual and the pedal grows faster.
  u 3.0 – 3.97 (+40 ms release): **full organ**, Bb2 C#3 E3 G3 Bb3 C#4 E4
  (principal 8', 4', 2' and a reed 8') over the pedal D (reed 16', principal
  8' and 4'); E4 is the tune's held note (lead). The keys go down over 7 ms
  (E4 at 3.000, pedal 3.001, E3 3.002, Bb2 3.003, C#4 3.004, G3 3.005, C#3
  3.006, Bb3 3.007) and are released together. The chord is 1.2 dB louder
  than before; the E4 key is weighted 1.4, the two Bbs 0.65, the others 0.85,
  so that E4 is the strongest note of the chord. A 4 ms attack with a 20 %
  speech overshoot and a puff of noise on every pipe.
- Bar 3: u 4.0 the door: latch knock, then the creak, 4.025 – 4.6, in four
  bursts, its squeal 13 dB stronger against the latch than before (the latch
  is unchanged). One soft flute holds A5 from 4.0 until it is released
  5.42 – 5.48. Piano alone, an octave lower than the right hand above and
  quieter: F4/F3 E D | Bb3/Bb2 A Bb; under the door the pianist is softer
  (the F at 4.0 and the tremolo strokes 4.0 – 4.25 at 0.7, the E at 4.5 at
  0.8); left hand tremolo D2/A2 (4.0 – 5.0), Bb1/F2 (5.0 – 5.5), A1/E2
  (5.5 – 5.75), Bb1/F2 (two strokes, last at 5.8125). The last tune note is
  damped by 6.0.
- u 5.5 – 6.085: the fire. Sparks from 5.504 to 5.945 (the scene's fire
  reaches the tail at 5.95), their rate growing from about 25 to 165 a
  second; a buzz rising 96 → 146 Hz and growing to u 6.0, then released over
  80 ms.
- Cues declared: 0, 2.0 (the first stair, band 400 – 2000 Hz), 3.0 (full
  organ), 4.0 (the door; band 7 – 9 kHz, where only the latch speaks: the
  organ's reverb fills the lower bands), 5.5 (sparks, band 3 – 9 kHz, soft).

**How each sound is made**

- Piano: per pitch one buffer made in prepare(): two strings (below D3) or
  three (-2.5, +0.5, +2 cents) of decaying partials with a piano string's
  stretch (B about 1.2e-4 to 4e-4), struck at 1/8 (the 8th partial is
  missing), a felt rolloff above 2.6 kHz, upper partials dying faster; each
  partial starts at the same phase on every string; a case thump (96, 172,
  247 Hz) and a felt knock; +3.5 dB at 650 Hz and a 4.2 kHz lowpass for a boxy
  upright. Score notes use 0.75 s buffers, long outro notes 2 s buffers. Made
  ahead: every pitch the score plays (A1 – A3 chromatic and the minor tune's
  pitches), and every pitch of D major from A3 to D5 (A B C# D E F# G A B C#
  D) in both lengths, so `lead` never makes a buffer while playing. The
  damper is a 90 ms fade (45 ms for the tremolo's strokes). `lead` is
  unchanged: one note from `ev.midi`, `ev.dur`, `ev.vel`, centre, 90 ms
  damper.
- Organ: oscillators with fixed harmonic recipes (stopped bourdon with odd
  harmonics, flute, principal, reed with 28 harmonics at 1/k^0.75), each
  pipe's harmonics at scattered fixed phases (seven variants, so that two
  pipes on the same pitch do not start in step), no vibrato; a 50 ms puff of
  band-passed white noise at three times the pipe's pitch; the whole organ
  through two 3.2 kHz lowpasses (heard from the loft) before the room.
- Projector: one buffer: a band-passed noise tick and a 150 Hz thud on every
  film frame (u = k/18), pink noise pulsing at 18 Hz, a faint 100/200/300 Hz
  motor hum, lowpassed at 3 kHz; LV 0.169 (9 dB above the first build).
- Door: one buffer: latch knock (five modes 870 – 8300 Hz and a click), then
  stick-slip: a four-harmonic pulse train whose rate slides 950 → 1400 Hz
  with two slow wavers and a 6 % jitter per period, through a 2.3 kHz wooden
  resonance, gated into four bursts. The buffer is scaled so that the latch
  (alone in its first 25 ms) peaks at 0.9; the squeal rises above it.
- Fire: one buffer: random 1.5 – 4.5 ms bursts of band-passed noise
  (2.4 – 7.2 kHz) and a few lower pops; the buzz is a soft-clipped sawtooth
  through two 1 kHz lowpasses, so that it stays out of the bell's band.
- Cinema: `k.reverb` 2.8 s, t60 2.0, brightness 0.22, send 0.32 (piano,
  organ and door; projector and fire dry).

**Measured** (`--section 14 --check`): -19.1 LUFS, peak -6.3 dBFS (at 86.499,
in the full organ), largest step 0.129, cues within +1 to +4 ms (rise: 2.0
8 dB, 3.0 11 dB, 4.0 18 dB), lead notes median 1.3 cents, worst +6.6 cents,
tail -89 dBFS, bell band -53.8 dBFS. With the bike both crossings read ok.
prepare() 0.21 s. Instruments alone (`--label`): the full organ (86.05 –
86.95) -18.2 dBFS rms, the piano of bar 1 (83 – 85) -26.4 dBFS rms: 8.2 dB
apart (in loudness -15.3 against -23.2 LUFS). In 800 – 1600 Hz over 87.0 –
87.6 the door is -30.3 dBFS rms and the rest of the part -36.7 (+6.4 dB;
per burst +4.6, +12.1, +11.2, +3.9 dB). The projector alone is -41.1 LUFS;
in 1 – 2 kHz it rises above the rest of the part in 3 of 600 10-ms windows,
by at most 1.6 dB (u 5.44).

**Unsure / departures**

- The brief asks the crackle to grow "to the frame"; the sparks stop at
  u 5.945, where the scene's fire reaches the tail (5.95), so that nothing
  bright stands in the bell's way; only the buzz (below 1.2 kHz) grows to 6.0.
- The bar-1 tremolo is on D3/A3, not lower: the low strings added peak
  without loudness and blurred the tune. The climb and bar 3 are in the bass.
- The full organ's crest (about 10 – 12 dB, a dense chord of some 30 pipes)
  holds the peak: it could rise only 1.2 dB before the part's peak reached
  -6 dBFS, so the contrast with the piano comes mostly from the piano going
  down, and the part is at -19.1 LUFS, inside the tolerance but not at -18.
  A soft limiter on the organ was tried and dropped: the room's reverb then
  carried the peak, and it would have distorted the chord.
- Which note of the chord is strongest depends on the fixed phases of pipes
  that sound the same pitch (an 8' and the 4' an octave below); E4 leads
  Bb3 by 1.5 dB.

**After the review** (2026-11-18)

- `lead` is ready for every pitch of D major from A3 to D5, short and long,
  made in prepare() (0.21 s).
- The piano of bars 1 and 2 is 4 dB down, the Bb at 2.0 no longer accented
  (0.78, as its neighbours); the full organ 1.2 dB up (not 3 – 4: the peak
  limit), its keys spread over 7 ms. The 3.0 cue rises 11 dB (was 6); the
  organ chord is 8.2 dB above the piano of bar 1 (was 2.7).
- The door's squeal is 13 dB stronger and the piano's bar-3 entry softer:
  the creak is 6.4 dB above the music in 800 – 1600 Hz (was 8 dB under).
- The projector is 9 dB up: -41.1 LUFS alone (was -50.2).
- The tremolo's strokes end 5 ms before their key is struck again; E4 is the
  strongest note of the full-organ chord (E4 weighted 1.4, the Bbs 0.65).
