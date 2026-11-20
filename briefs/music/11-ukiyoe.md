# Music · Section 11 · 浮世绘 · Ukiyo-e

| | |
|---|---|
| Film time | 65.0 s – 71.0 s |
| Part file | `audio/parts/11-ukiyoe.js` (`node tools/audio.mjs --section 11 --check`) |
| Owner's brief | "Ukiyo-e: Shamisen" |
| Loudness target | -20 LUFS |
| Scale | in: `s.theme({ scale: "in" })` gives D Eb G A G A, Bb A G Eb, G Eb D Bb A Bb |
| Picture | `briefs/11-ukiyoe.md`, `src/scenes/ukiyoe.js`; `briefs/CUES.md`, "Section 11" |

## The idea

A traveller's tune on the Tōkaidō road. A sudden shower arrives on the
downbeat of bar 2. The travellers run. The pelican produces an umbrella and
opens it on the strong beat, and the player does not miss a note.

## Instruments

- **A shamisen**: three strings over a skin-covered body, struck with a large
  plectrum that hits the skin as it plucks. Every stroke is a sharp "tack"
  and a bright nasal twang that dies in about half a second. The lowest
  string, open D3, buzzes against the neck (sawari): a rough, noisy halo. It
  can also pluck with the left hand (softer), slide, and roll a held note.
  The tune at written pitch, in the in scale. The open low D on the first
  beat of each two-beat cell.
- **Rain.** Fine, dense, high (mostly 2–9 kHz): a hiss made of drops, not a
  smooth noise.
- **Rain on the umbrella.** From 3.0: closer, lower, pattering thuds on oiled
  paper (a soft drum-like patter, 300–900 Hz, fifteen to twenty-five drops a
  second, irregular).
- **Wooden clappers** (hyoshigi): one sharp clack, used once, at 3.0.
- An open road: almost no room (about 0.6 s, quiet).

## The three bars

| u | Picture | Sound |
|---|---|---|
| 0.0 | The pelican rides the coast road in fair weather | Shamisen alone: bar 1 of the tune |
| **2.0** | **The shower arrives**: grey wipes down the sky (2.0–2.4); the travellers break into a run | Bb, the top of the tune. **The rain begins**, rising over about 0.4 s |
| 2.22 | The umbrella is produced, shut | |
| 2.5 | The umbrella is up, still shut | A soft swish |
| 2.65 | It is half open | |
| **3.0** | **The umbrella snaps fully open.** The rain is at its heaviest | **A pop of paper and bamboo** (a short low thump with a crisp snap) **and the one clack of the clappers.** From here the rain also drums on the umbrella. The shamisen rolls the held Eb |
| 4.0 | Riding on under it | Bar 3 of the tune, through the rain |
| 4.6–5.2 | The shower passes; Fuji comes back | Both rains thin and stop |
| 5.0–5.15 | The umbrella folds | A small rustle and click |
| 5.75 | Fair weather | The last note, dry. The bell takes the D |

Declare cues at u = 0, 2.0 (`soft: true`, the rain) and 3.0.

## The bicycle here

`bike: { chain: 1, bell: 1 }`.

## The lead

Export the shamisen as `lead`. It takes any pitch: the outro will ask it for
the major scale.

## Hand-over

In: Section 10's gongs are still dying under your first bar. Out: Section 12
is a string orchestra.

## Check

- Lead notes measure in tune against the in scale.
- The probe on a shamisen stroke: an attack of a millisecond or two with a
  burst of noise, 20 dB down within 200 ms.
- The picture: a band of fine noise from 2.0 to about 5.2, thicker and lower
  from 3.0, and the hard mark of the opening at 3.0.
- The rain must not bury the tune: with the rain at its heaviest the lead
  notes still measure clearly (the checker's "hard to hear" line is empty).

## As built

Nothing here has been listened to. Everything below was checked by
measurement (`--check`, `audio-probe`) and by looking at the spectrogram.

**What plays** (u in seconds; the tune in the in scale, D4 Eb4 G4 A4 G4 A4 | Bb4 A4 G4 Eb4 | G4 Eb4 D4 Bb3 A3 Bb3):

| u | Sound |
|---|---|
| 0.0 | Shamisen downstroke D4 with the open D3 (both open strings; vel 0.8, kept a little below the top so that with the bell the peak stays under -6 dBFS) |
| 0.5, 0.75 | Eb4 downstroke, G4 upstroke (sukui) |
| 1.0, 1.5, 1.75 | A4 down + open D3, G4 down, A4 left-hand pluck (hajiki) |
| 2.0 | Bb4 down + open D3, full strength. The rain starts: drop density rises (ease-out) to 82 % by 2.18, as in the picture, then evenly to full by 3.0 |
| 2.3 – 2.5 | The swish: noise rising (power 2.5) and climbing from 900 Hz to 2.3 kHz, peaking exactly at 2.5, gone ~40 ms later |
| 2.5, 2.75 | A4 down, G4 hajiki |
| 3.0 | Eb4 down + open D3, the umbrella pop and the one clack of the hyoshigi, all on the same sample. Then the roll: 11 more strokes 1/12 s apart (3.083 … 3.917), alternately up and down, softer after the accent and swelling a little towards 4.0 |
| 3.02 – 4.98 | Rain on the umbrella: about 20 drops a second, irregular, 300 – 820 Hz |
| 4.0, 4.5, 4.75 | G4 down + open D3, Eb4 down, D4 upstroke |
| 4.6 – 5.2 | Both rains thin (cosine) and stop; the patter's last drop starts before 4.98 |
| 5.0 | Bb3 down + open D3 (the D3 let ring to 5.85 and faded over 0.1 s) |
| 5.05 – 5.15 | The fold: 22 small paper crackles, just after the Bb3's attack |
| 5.15 | The click of the umbrella shutting (the fold sound ends by 5.30) |
| 5.5 | A3 down |
| 5.75 | Bb3 upstroke, damped at once (gone by 5.95): the last note is dry. In the last 30 ms before u = 6 the part measures -67 dB rms in 1.8 – 9 kHz. |

Cues: u = 0, 2.0 (soft, band 4 – 9 kHz), 3.0. `bike: { chain: 1, bell: 1 }`. `lead` is the
shamisen downstroke at any pitch (`leadOctave: 0`); the major scale from A2 to D6 is prepared.

**How each sound is made** (all in `prepare()`, plain arithmetic):

- **Shamisen.** `pluck()` near the bridge (pick 0.085 – 0.2, bright 0.72 – 0.9, t60 0.85 – 1.1 s),
  a quick first decay (the bridge stands on the skin), highpass 150 Hz (95 Hz for D3), a nasal
  peak +7 dB at 2.4 kHz and +3 dB at 1.15 kHz, lowpass 7 kHz; a downstroke adds the bachi hitting
  the skin (a 3 kHz noise crack, 1 ms rise, and a 205/330/455 Hz membrane thump). The stroke is
  rounded off with a tanh (the skin giving) and lowpassed again at 7.5 kHz. Measured on the Eb4
  downstroke: 10 – 90 % rise in 2 ms, 20 dB down 166 ms after the peak.
- **Sawari** (open D3 only). A follower tracks the string's lowpassed swing; above 40 % of it the
  contact gates white noise once a period; band 1.4 – 6.5 kHz, starting after 8 ms, decaying more
  slowly than the string (env^0.75), level-matched to the string's own treble over the first
  0.3 s and soft-clipped. Measured: +4 dB in 1.5 – 6 kHz at 0.3 s, +11 dB at 0.6 s against the
  same string without it.
- **Rain.** About 1500 drops a second per ear at full strength (Poisson), each a tiny decaying
  sine of 2 – 9 kHz that rises 10 – 40 % in pitch over 10 ms (1.5 – 5.5 ms decay), plus a faint
  hiss; highpass 1.6 kHz, lowpass 10 kHz. Its density follows the picture's shower curve (82 % at
  2.18, full at 3.0, thinning 4.6 – 5.2).
- **Patter on the umbrella.** Each drop a damped membrane (modes 1, 1.59, 2.14 at 300 – 820 Hz,
  35 – 55 ms, slight pitch drop) with a small tick; random pan ±0.25.
- **Pop.** A thump at 100 Hz falling from 150 Hz (t60 0.14 s) with a 172 Hz partner, a highpassed
  noise snap (1 ms peak, 15 ms) and two bamboo rib clicks (1.85, 2.93 kHz).
- **Clack.** Two hardwood bars, free-bar modes 1 : 2.756 : 5.404 at 1180 and 1265 Hz (t60 0.3 s
  for the fundamental), and a 4.5 kHz contact click.
- **Fold.** 22 crackles of bandpassed noise (1.5 – 4 kHz, 8 ms each) and a click (2150 + 3600 Hz
  partials, t60 35 ms, with a 3 kHz tick); level 0.42.
- **Room.** One reverb, 0.6 s (t60 0.45), sent at 0.12 from the shamisen, pop and clack.

**Measured** (`--check`, alone): -21.0 LUFS (target -20), peak -7.2 dBFS, 16 lead notes median
+0.1, worst +5.3 cents, all cues within 2 ms, -70.4 dBFS in 1.8 – 9 kHz in the last 30 ms. With the
bike: both crossings "ok" (+2.0 ms), peak -6.3 dBFS. 39 events, at most 24 sources alive, prepared
in about 0.2 – 0.3 s.

**Unsure.** Whether the shamisen reads as a shamisen and not a banjo (the skin, the nasal peak and
the sawari are the only cues; there is no slide). Whether the sawari halo is too strong or too
weak. Whether the rain reads as drops rather than hiss at this density. The swish is quiet and
falls on the A4 stroke at 2.5; it may be masked. The fold's rustle (5.05 – 5.15) still measures
14 – 21 dB under the shamisen in its own band and may not be heard; the click at 5.15 stands above
it. The `lead` voice was not heard in the outro (the
outro is still a stand-in and does not call it).

**Against the picture.** The rain follows the scene code (82 % by u = 2.18), not this brief's
"rising over about 0.4 s". The fold's rustle starts at 5.05, not 5.0 (the picture's fold starts at
5.0). The umbrella is produced at 2.22 with no sound of its
own; only the arrival at 2.5 has one.

**After the review** (2026-11-18, rulings 1 and 2):

- The fold is moved to just after the Bb3's attack: the event now starts at 5.05 (was 5.0), the 22
  crackles fall in 5.05 – 5.15, the click stays at 5.15, the sound is 0.25 s long (was 0.3), and its
  level is 6 times what it was (0.42, was 0.07). Measured in 1.5 – 4.5 kHz, 50 ms windows, against
  the rest of the part rendered without it (`--label 'shamisen|rain|patter|pop|clappers|swish'`):
  the click window at 5.15 is +2.8 dB over the rest (was -12.8 dB); the rustle is -21.2 dB at 5.05
  and -13.8 dB at 5.10 against the rest (was -45 to -29 dB), so it is louder but still under the
  shamisen in its band. Nothing of the fold sounds after 5.30; the last 30 ms before u = 6 are
  unchanged (-70.4 dBFS in 1.8 – 9 kHz).
- The rain reaches 82 % by u = 2.18 (was 2.4) and grows evenly to full by 3.0. Measured on the rain
  alone, 2 – 9 kHz, 40 ms windows: -36.3 dB at 2.16, -35.4 at 2.18, against -35.2 to -35.6 dB at its
  heaviest (3.0 – 4.6). Because the drops are drawn one after another from one seeded sequence, the
  rain after 2.0 is a different (statistically the same) set of drops than before; this moved the
  part's peak from -6.4 dBFS at 3.055 to -7.2 dBFS at 4.021. Loudness unchanged (-21.0 LUFS).
- Nothing else changed: the notes, the other times and levels, the instruments, the cues and the
  `lead` export are as before. Nothing was listened to.
