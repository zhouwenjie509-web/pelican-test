# Music · Section 12 · 梵高《星夜》 · The Starry Night

| | |
|---|---|
| Film time | 71.0 s – 77.0 s |
| Part file | `audio/parts/12-starry.js` (`node tools/audio.mjs --section 12 --check`) |
| Owner's brief | "The Starry Night: Strings" |
| Loudness target | -18 LUFS |
| Scale | major, with full harmony |
| Picture | `briefs/12-starry.md`, `src/scenes/starry.js` (`motion(u)`); `briefs/CUES.md`, "Section 12" |

## The idea

The sky turns because the wheels turn. So does the music. The string
orchestra is geared to the bicycle: when the pelican slows to look up, the
whole orchestra slows with it and nearly stops; when it stands on the pedals,
the orchestra races to catch up. Nobody conducts. The pedals do.

## The clock

This section's pelican changes speed (`starry.motion`): standard pace to
u = 2.2, easing down to an eighth of it by 2.9, a crawl until 3.3, up to 1.46
times the pace by 3.9, racing until 5.3, easing back by 5.9. It still passes
the frame on time.

**Schedule every event of yours at `s.ridden(beat)`**, not at `beat × 0.5`
(see the guide). The tune's beat 4 then falls at u = 2.0, beat 5 at about
2.63, beat 5.5 at about 3.55, beat 6 at about 3.8, beat 8 at about 4.5,
beat 10 at about 5.2, beat 12 at 6.0. Lengths stretch the same way: a note's
length is `s.ridden(beat + beats) - s.ridden(beat)`. Print the mapping once
and look at it before you write.

The chain's ticks follow the same clock by themselves.

## Instruments

A string orchestra of 1889: first violins, seconds, violas, cellos, basses.
Sections, not soloists: several voices per note, slightly apart in tuning and
time, with vibrato (about 5.5–6 Hz) on anything longer than a quarter second.

- **First violins**: the tune, an octave up (D5 … B5; `leadOctave: 1`),
  legato.
- **Second violins and violas**: the sky. Swirling broken chords in
  sixteenths that rise and fall like the painted spirals, light and detached.
- **Cellos**: a singing inner line, and the bass of the chord.
- **Basses**: pizzicato on the first beat of each two-beat cell.
- **A hall**, about 2.5 s.

Bowed notes speak slowly (60–120 ms). Start the first violins a little early
so the note is heard on the beat, and mark their cues `soft: true`. The
sixteenths need a quicker bow (15–25 ms).

Harmony, one chord per two beats: `D | Bm7 | G(add9) | A7sus4 | D/F# | G → A7`.

## The three bars

| u | Picture | Sound |
|---|---|---|
| 0.0 | The pelican rides in under the turning sky | Tune in the first violins, swirls beneath, pizzicato basses. In tempo |
| 2.0 | | B5, the top of the tune |
| 2.2–2.9 | The pelican eases down; the sky slows with the wheels | Everything slows together (it does so by itself on the ridden clock). Thin the swirls as they slow: fewer players, softer |
| 2.55–2.95 | It looks up at the stalling sky | |
| 2.9–3.3 | A crawl; the stars barely move | Near stillness: one hushed chord (A7sus4), a soft tremolo, no pulse. The tune's A hangs |
| 3.3–3.9 | It stands on the pedals; sky and wheels spin up | The swirls start again and accelerate; crescendo |
| 3.9–5.3 | Racing at 1.46 times the pace | Full orchestra. The tune's bar 3 at racing speed |
| 5.3–5.9 | Easing back to the standard pace | Easing back with it |
| 5.9–6.0 | In tempo | The last eighth (B4 in your octave: B4 → the bell's D) lands in tempo |

Declare cues at u = 0 (soft), at the start of the hushed chord, and at the
first sixteenth of the spin-up.

## The bicycle here

`bike: { chain: 1, bell: 1 }`.

## Hand-over

In: Section 11 is a shamisen, dry and plucked; your first bow stroke is the
change of century. Out: Section 13 is strings too, the same orchestra playing
colder. Leave your hall ringing naturally; nothing new after u = 6.

## Check

- Print your events and confirm that no time between u = 2.2 and 5.9 sits on
  the plain half-second grid unless the ridden clock puts it there.
- The spectrogram shows the swirl figures visibly stretching out before 2.9,
  a still band from 2.9 to 3.3, and figures packed tighter than in bar 1
  from 3.9 to 5.3.
- Lead notes in tune (strings have vibrato: keep it within about 15 cents each way).

## As built

Nothing here has been listened to. Everything below was checked by
measurement (`--check`, `audio-probe`), by the printed score and by looking
at `out/audio/s12.png`.

**Clock.** Every event is written in beats and placed at `s.ridden(beat)`;
lengths are `ridden(b + n) - ridden(b)`. The measured mapping: beat 4 → 2.000,
4.5 → 2.250, 4.75 → 2.385, 5 → 2.564, 5.1875 → 2.903, 5.25 → 3.156,
5.3125 → 3.389, 5.5 → 3.593, 5.75 → 3.721, 6 → 3.818, 8 → 4.504,
10 → 5.189, 11 → 5.541, 11.5 → 5.754, 12 → 6.000.

**What plays.**

| u | |
|---|---|
| 0.000 | Tune in the first violins (D5, first note not pre-rolled, attack 50 ms), swirls (A3 up the D ladder), cello tenor A3 + bass D3, pizzicato D2. Cue (soft). |
| 0–2.0 | Bar 1 in tempo: swirls in sixteenths, D then Bm7 (cello F#3→A3 over B2, pizz B1 at 1.0). Later violin notes start 30 ms early. |
| 2.000 | B5, the top (vel 1.0); G(add9): cello B3 over G2, pizz G1. |
| 2.0–2.56 | Swirls on the ridden sixteenths 2.000, 2.125, 2.250, 2.385, 2.564 (gaps 0.125 → 0.18), one player from 2.2 and softer with the speed. Cellos die away by 2.64 + 0.12 s release (2.76), so the low band is quiet before the hush. |
| 2.534 | The tune's A5 (beat 5) begins and hangs to 3.593: falls to 0.22 of its level by 2.95, held, swells from 3.389. |
| 2.903 | The hushed chord, A7sus4 (A2, E3, G3, D4), bowed tremolo (11–13.4 Hz amplitude flutter per player), sul tasto, starting exactly on its time (not pre-rolled) with a 40 ms bite to its hush level. No pulse. Cue (soft, 90–260 Hz). Held at 0.26 until 3.389, then crescendo to 3.838. |
| 3.389 | The spin-up: an eleven-note run D3 E3 F#3 G3 A3 B3 C#4 D4 E4 F#4 G4 on the ridden thirty-seconds (beats 5.3125 … 5.9375): onsets 3.389, 3.489, 3.548, 3.593, 3.631, 3.664, 3.694, 3.721, 3.747, 3.772, 3.795, gaps shrinking from 0.10 to 0.023 s, crescendo; it lands on the A4 swirl at beat 6. The first stroke bites (10 ms attack, lowpass from 3 kHz, bow noise ×2) so that it speaks in the band of its cue. Cue (1.5–5 kHz). |
| 3.593 | F#5 (beat 5.5) in the violins. |
| 3.818 | Beat 6: the race. E5 held (to 4.504), A7sus4 swirls at 0.086 s per sixteenth (vel ×1.15), cello D4 over A2, pizz A1 (accent). |
| 4.504 | D/F#: F#5, then E5 4.847, D5 5.018; swirls F#3…A4; cello A3 over F#2; pizz F#1. |
| 5.189 | G: B4 in the violins (vel 1.0); swirls descend from G4; cello B3 over G2 (lighter); pizz G1. |
| 5.541 | A7: A4 (5.511 start), swirls A3 C#4 E4 G4 (5.541, 5.642, 5.754, 5.875; the last one short: 0.05 s + 0.03 s release, over by 5.955); cello C#4 over A2 to 5.95. |
| 5.754 | B4, the last eighth, in tempo (speed 1.07), the bow lifted at 5.93 with a 0.04 s release, over by 5.97. Nothing begins after 5.875. |

**How each sound is made.**

- *Bowed player*: an oscillator on a PeriodicWave of the Helmholtz motion
  (partial n at 1/n, thinned where a bow position of 1/8.6 puts a node), into
  a lowpass that opens from 2–3× to 6–9× the fundamental as the bow bites
  (swirls never below 2.6 kHz), an amplitude envelope, delayed vibrato
  (`k.lfo` into detune, 0.1–0.2 s delay, 0.22 s ramp; each player of a section
  starts at its own point of the cycle, spread evenly: 0, 1/3, 2/3 for three
  players, 0 and 1/2 for two), and a short band-passed noise burst for the hair catching
  the string on the first player.
- *Section*: two or three players per note, a few cents apart (−6/+5/0 for
  the first violins) and 6–17 ms apart.
- *First violins*: three players, attack 40–90 ms, vibrato 5.55–5.95 Hz,
  ±9 cents (±6 on notes under 0.45 s), legato with 20–30 ms overlaps.
- *Second violins / violas* (swirls, by pitch: G4 and up to the seconds):
  two players (one while slowing), peak 0.14 × vel (the run keeps 0.085),
  attack 20 ms (run 15 ms), no vibrato, detached (55 % of the sixteenth).
- *Cellos*: two players, peak 0.072 × vel, attack 100 ms, vibrato 5.5/5.8 Hz ±10 cents.
- *Tremolo*: two players per tone, the amplitude multiplied by 0.6 + 0.4·sine
  at 11–13.4 Hz, lowpass 2–3.2× f.
- *Double basses*: a computed buffer (dsp `pluck`, finger-soft, gut-dark,
  t60 1.0 s, two onePole lowpasses), two players 9 ms and 9 cents apart.
- *Bus per section*: body resonances as peaking filters (violin 290 Hz and
  2.9 kHz, viola 230 Hz and 2.2 kHz, cello 140 Hz and 1.3 kHz), a high shelf
  down above 4–6.5 kHz, seating pan (vln1 −0.32, vln2 −0.12, vla +0.14,
  vc +0.30, cb +0.38).
- *Hall*: one `k.reverb`, 2.5 s, t60 2.1, bright 0.42, send 0.22; a 38 Hz
  highpass on the part's output; LEVEL 1.11.

**Numbers.** −18.0 LUFS alone, peak −6.5 dBFS (at 74.836, the race's
downbeat); 97 events, 379 sources started, at most 160 alive; prepare 0.03 s.
Cues: u = 0 +3 ms, hushed chord +41 ms (rise 18 dB, soft limit 60 ms),
spin-up +7 ms (rise 11 dB). Bell band −42.1 dBFS in the last 30 ms. Largest
step 0.140 at 72.214 (inside the sustained A5, a waveform edge, not a cut).
Lead median +3.4 cents, worst +10.8 (B4 at 5.16, where the cello bass G2's
fifth partial sits a just third below it; the bass there is lighter for that
reason). With the bike: crossings 11 and 12 ok (+1, +3 ms), nothing out of
tolerance. Joined render 69–79: nothing out of tolerance.

**Unsure.**

- Whether the oscillator strings sound like strings rather than an organ of
  sawtooths: the anatomy (harmonic, slow onset, vibrato, noise at the bow) is
  right by the probe, but there is no bow-pressure noise during the sustain
  and no body-filtered vibrato colouring.
- The run onset at 3.389 shows as a bright vertical edge from about 600 Hz to
  the top of the picture (above 6 kHz it rises about 10 dB, to −45 dB): it is
  the first stroke's deliberate bite after a dark crawl, not a cut, and the
  brightest edge in the section. With less bow noise (×1.2) the cue read
  16 ms late.
- The spin-up cue is the first ridden *thirty-second* after 3.3 (3.389), not
  a sixteenth: on the ridden sixteenths the first one after 3.3 is 3.593,
  which left 0.3 s of the visible spin-up without a new sound.
- The hushed chord arrives at beat 5.19, inside the G(add9) cell; the A7sus4
  is anticipated by about three quarters of a beat, as the table asks.
- The peak (−6.5 dBFS) is 0.5 dB inside the limit; it is where the run's last
  stroke, the E5 attack and the hush's crescendo meet.
- In the joined render the crossing at 77.0 still rises only 9 dB and
  scream's u = 0 cue 3 dB (both read ok); no ruling asked about that rise.

**After the review** (2026-11-18). Both failing cues now read ok: the hushed
chord starts on its time with a 40 ms bite and the cellos' G(add9) ends at
2.64 instead of 2.72, so the 90–260 Hz band is quiet before it (no onset →
+41 ms, 18 dB); the run's first stroke has a 10 ms attack, a brighter bow and
twice the bow noise (+104 ms → +7 ms). The swirls are 4.7 dB up (peak 0.085
→ 0.14, LEVEL 1.06 → 1.11) and the cellos 2.5 dB down (0.1 → 0.072); the run
keeps its old level (raised with the swirls it put the peak at −4.7 dBFS).
Swirl stem in 0.5 s windows now −29.3 to −32.1 dB where it plays (was −34.3
to −37.1), cellos −26.7 to −28.4 (was −24.9 to −26.7). The last B4's bow
lifts at 5.93 with a 0.04 s release (was 5.95 + 0.08) and the G4 swirl at
5.875 is 0.05 s + 0.03 s: bell band −36.7 → −42.1 dBFS. Every player's
vibrato now comes from `k.lfo` with its own phase (i / players); the lead
median did not move with it (3.3 → 3.4 cents). The noise buffer needed
nothing (the engine prepares it). Still not listened to.
