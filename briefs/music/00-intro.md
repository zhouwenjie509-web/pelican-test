# Music · Intro · 片头

| | |
|---|---|
| Film time | 0.0 s – 5.0 s (a two-beat pickup, then two bars) |
| Part file | `audio/parts/00-intro.js` (`node tools/audio.mjs --part intro --check`) |
| Owner's brief | "A textured paper background, serif typography, and solemn low strings in the style of a documentary soundtrack." "The second line lands on a strong beat, and the pelican immediately rides into Section 1." |
| Loudness target | -24 LUFS over 0–5 s |
| Picture | `src/scenes/intro.js`; `briefs/CUES.md`, "Intro" |

Times in this brief are film seconds (the part's `u` is film time).

## The idea

A serious documentary is about to tell us something. Low strings, slow and
grave, as if the subject were the fall of an empire. The subject is a pelican
on a bicycle. The music never lets on.

The strings play the first bar of the film's tune at half speed, an octave
down. When Section 1 begins at 5.0 the same notes come back at full speed:
the viewer has been taught the tune without noticing.

## Instruments

- **Cellos** (the line), **violas** (a third or a sixth above the line from
  3.0, quietly), **double basses** (the ground). A section of each, not solo
  players: several slightly detuned voices per note, slow bow attack
  (120–250 ms), vibrato that arrives late on long notes, a trace of bow noise.
  Dark and warm: little above 3 kHz.
- **A hall**: about 2.4 s, dark.
- At 3.0 only: one soft stroke of a large drum or a low pizzicato under the
  accent. Felt more than heard.

The bicycle part (`bike.js`) rings the bell at 3.0, as the sketch sets off,
and its chain ticks at 4.0, 4.41, 4.73 and 5.0 as the pelican gathers speed.
Leave room for them: the bell at 3.0 is the punch line of the second subtitle
("long before the bicycle was invented", and a bicycle bell rings).

## Timeline

| Film s | Picture | Sound |
|---|---|---|
| 0.0 | The page. Line 1 fades in over 0.30–0.85 | Basses D2 and cellos A2, an open fifth, from nothing (a swell over about 0.6 s, no hard start) |
| 1.0 (bar line) | | Cellos begin the line: **D3**, one second |
| 1.3–1.9 | The citation fades in | |
| 2.0 | | **E3**, half a second |
| 2.5 | | **F#3**, half a second, leaning into the next bar |
| 3.0 (bar line) | Line 2 lands; the sketch sets off | **A3** with an accent that falls back at once (sfz then piano); basses re-strike D2; the soft low stroke. The bell rings (bike part). Declare this cue |
| 3.0–5.0 | The pelican accelerates; the camera starts after it | A3 held to 4.0; **F#3** at 4.0; **A3** at 4.5; a slow crescendo; violas join above |
| 5.0 | The pelican passes the first frame | The strings stop on the bar line (release about 0.15 s, then only the hall). Section 1 plays the D |

The line is `D . E F# | A . F# A`: bar 1 of the tune (see
`briefs/MUSIC_GUIDE.md`) in notes twice as long.

## Hand-over

Nothing of yours begins after 5.0. The hall may ring to about 6.5. Render
with your neighbours (`node tools/audio.mjs --from 0 --to 9`) and look at the
join: Section 1's first drum and voice must stand clear of your tail.

## Check

- The spectrogram shows steady, evenly spaced partials with slow starts
  (bowed strings), nothing percussive except at 3.0.
- The cue at 3.0 is on its line. Mark slow string entries `soft: true`.
- It is quiet: -24 LUFS. The accent at 3.0 is the loudest moment, and still modest.

## As built

Arranged in `audio/parts/00-intro.js`. Nothing was listened to: everything below was checked by measurement (`--check`, `audio-probe`), by the printed score and by looking at the spectrogram.

**What plays (film seconds)**

| s | Sound |
|---|---|
| 0.00 | Basses D2 and divisi cellos A2, an open fifth, from silence: a curved swell (12 % at 0.2, 45 % at 0.4, full at 0.65), then held quietly |
| 1.00 | Cellos (the line): D3 for 1.0 s, bow attack 0.22 s. Soft cue declared |
| 2.00 | E3, 0.5 s |
| 2.50 | F#3, 0.5 s, growing into the bar line (lean) |
| 3.00 | A3 sfz (peak in 25 ms) falling to a deep piano (15 % of the sfz) by 3.40, then a slow crescendo to 4.0. Basses D2 and cellos A2 re-bow with the same sfz-p shape (15 % by 3.30). One soft stroke of a large drum tuned to A1 (55 Hz). Violas enter very quietly on F#4 (a sixth above the line). Hard cue declared, measured in 180–900 Hz where the cellos' sfz lives: +14 ms |
| 4.00 | Cellos F#3, violas D4 (a sixth above), crescendo continues |
| 4.50 | Cellos A3, violas F#4, crescendo to the bar line (the line ends at 1.25, the violas at 1.2, the low strings at 1.15 of their sfz level) |
| 4.95 | All the strings lift their bows together; releases of 0.15 s (line, violas) and 0.25 s (low strings), all silent by 5.20; then only the hall (below -50 dBFS by about 5.75) |

The bicycle part rings its bell at 3.0 and ticks its chain from 3.0 to 5.0; `bike: { chain: 1, bell: 1 }` keeps both as written.

**How each sound is made**

- *Bowed strings* (basses, cellos, violas): one PeriodicWave per pitch built from Helmholtz motion (sawtooth, harmonic n at 1/n), with the bow-point comb (bowed at 0.10–0.12 of the string), a body response of a few broad resonances per family, a roll-off at 1.6/2.4/2.7 kHz and harmonics capped at 4.4 kHz. The basses' second harmonic is cut to 5 % (it sat in unison with the line's D3); because the PeriodicWave is rescaled to peak 1, their level is 0.1 × 0.702 so that every other bass partial stays where it was. A section is 3 (basses, violas) or 4 (cellos) voices detuned -7, +3, +8, -2 cents, each with its own vibrato (4.8–5.6 Hz, 9–12 cents, a `k.lfo` starting at phase 0, 0.31, 0.58, 0.83 of its cycle) that arrives after 0.35 s on notes of 0.45 s or longer. The bow envelope catches the string (30 % in 40 ms) and then grows over the attack (0.15–0.22 s on the line; scripted envelopes for the swell, the lean and the sfz-p). Rosin: pink noise band-passed near the 7th harmonic, strongest in the first 30 ms, about -26 dB under the note.
- *Large drum*: inharmonic membrane modes on A1 (55, 81, 108, 134, 160 Hz; t60 1.5 to 0.35 s) with a 4 ms felt onset and a 40 ms low-passed mallet thump, computed once in `prepare()`, played at gain 0.17 (the accent at 3.0 is the loudest moment, peak -6.4 dBFS).
- *Level*: every event of the score carries `trim: 1.15` (+1.2 dB), which `section()` and `drum()` multiply in; it pays for the thinner basses and the deeper piano. The `lead` export passes no trim, so it plays as before.
- *Hall*: one `k.reverb` (2.4 s, t60 2.1 s, bright 0.18, predelay 22 ms), send 0.24 from the darkened bus. The bus is low-passed at 2.7 kHz and high-passed at 36 Hz.

**Measured** (`node tools/audio.mjs --part intro --check`, 2026-11-18, after the review): -24.2 LUFS (target -24), peak -6.4 dBFS at 3.055, largest step 0.039, tail -88 dBFS, cues 1.0 +18 ms (soft, rise 7 dB) and 3.0 +14 ms (rise 16 dB), six lead notes within 8.8 cents (the sfz A3 at 3.0 is the worst), bell band -38.2 dBFS before 5.0, "Nothing out of tolerance." 14 events, 108 sources, at most 90 alive. With the bike (`--with bike --check`) both crossing cues read +2 ms ok. With all parts (`--from 0 --to 9 --check`) Section 1's cue at 5.0 measures +3 ms (rise 7 dB).

**Departures from this brief and what I am unsure of**

- The strings lift their bows at 4.95, 50 ms before the bar line, rather than on it. With the release starting at 5.0, Section 1's cue at 5.0 once measured 25 ms early in the full mix. At 4.95 the join measures +3 ms, but its rise is now 7 dB (it was 11 dB when the low strings lifted at 4.85), because the crescendo ends louder.
- The divisi cellos re-bow their A2 at 3.0 with the basses (the brief names only the basses).
- The cue at 1.0 measures +18 ms in 120–700 Hz (inside the soft limit); the onset is at 1.0 in the score.
- Whether the sfz reads as an accent and not a bump, whether four detuned voices read as a section rather than a chorus effect, and whether the drum is "felt more than heard" could not be judged without listening.
- `lead` (one note of the cello section) and `leadOctave: -1` are exported though the outro only uses sections 1–20.

**After the review** (rulings of 2026-11-18)

- The cue at 3.0 is declared in 180–900 Hz, the cellos' sfz, instead of 40–120 Hz, where the felt drum rises too slowly to be timed: +39 ms LATE became +14 ms ok.
- The crescendo from 3.0 to 5.0 is now measurable. After the sfz the line falls to 15 % (was 42 %), the low strings to 15 % (was 50 %) and the violas start at 12 % (was 35 %). The build ends higher: line 1.25 (was 0.74), low strings 1.15 (was 0.78), violas 1.2 (was 0.8). The low strings now lift at 4.95 with the line, so the build ends on the bar line. Band RMS in 150–2500 Hz rises from -31.7 dB (3.4–3.6) to -26.7 dB (4.7–4.9), a gain of 5.0 dB. `audio-probe --band 150:2500` gives -30.4 and -25.8 dB, a gain of 4.6 dB. Before the change the gain was -1.2 dB. The sfz falls to piano by 3.40 rather than by 3.28: with the faster fall the sfz A3 read +11.6 cents (limit 12).
- The line now stands over the drone. The basses' second harmonic is cut to 5 %, and their level is compensated so that the other partials stay. In 120–400 Hz, `audio-probe` measures -36.5 dBFS for 0.75–1.0 and -33.5 dBFS for 1.5–1.75, a gain of 3.0 dB. Before the change it was -33.6 and -32.8 dB, a gain of 0.8 dB. The margin is thin: windows that start 50–100 ms later (1.55, 1.6) gain only 2.2 and 1.8 dB over 0.75, because the detuned desks beat. I did not use the other option in the ruling (dipping the drone from about 0.9), because it lowers the 1.5–1.75 window more than the 0.75–1.0 one and so works against this measurement.
- Each desk's vibrato is a `k.lfo` with its own starting phase (0, 0.31, 0.58, 0.83).
- To keep -24 LUFS, the score's events carry a trim of +1.2 dB. Loudness is -24.2 LUFS (was -24.5) and the peak is -6.4 dBFS (was -7.3), still at the accent.
- I made no change for the noise buffer (the engine now prepares it) or for the stop before the bar line (beyond the 4.95 lift above). Nothing was listened to.
