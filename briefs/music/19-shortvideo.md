# Music · Section 19 · 竖屏短视频 · Vertical Short-Form Video

| | |
|---|---|
| Film time | 113.0 s – 119.0 s |
| Part file | `audio/parts/19-shortvideo.js` (`node tools/audio.mjs --section 19 --check`) |
| Owner's brief | "Short-Form Video: Short, punchy pop beats." |
| Loudness target | -16 LUFS |
| Scale | major (D E F# A B) |
| Picture | `briefs/19-shortvideo.md`, `src/scenes/shortvideo.js`; `briefs/CUES.md`, "Section 19" |

## The idea

Somebody has filmed the pelican and put a beat under it. The caption on the
screen credits the sound: 声音 · 车铃与链条 (sound: bicycle bell and
chain; the line began 原声, "original sound", until Stage 5). So that is what the beat is made of. The hook is the film's tune
played on bicycle bells; the hi-hats are the chain.

For the first bar the picture is still an ordinary wide street, and the beat
is small, as if from a phone held up nearby. On the downbeat of bar 2 the
black bars slam in, the picture becomes a vertical video, and the beat drops.

## Sounds

- **The hook**: bells. Build a small bell the way `audio/parts/bike.js`
  builds the bicycle's (the same partial ratios), tuned to each note of the
  tune two octaves up (D6 … B6; `leadOctave: 2`), shorter (about half a
  second), with a quick echo an eighth later.
- **Hats**: chain ticks (make your own, like the bicycle's), in sixteenths
  with a moving accent, and a fast roll into bar 3 and into the frame.
- **Kick**: short and hard: a sine that drops from about 150 Hz to 45 Hz in
  a tenth of a second, with a click on the front.
- **Clap** on beats 2 and 4: three or four bursts of noise a few
  milliseconds apart, then a short tail.
- **Sub bass**: a low sine on the roots (D, G, A) that slides between notes;
  it ducks under every kick (about 6 dB for 90 ms).
- **A chord stab**: a bright, wide synth chord on the off-beats, ducking the
  same way.
- **Interface sounds**, invented, tiny: a "pop" for each control that
  appears, and a "like".

Punchy means short sounds, a strong low end and air between the hits. It
does not mean distortion.

## The three bars

| u | Picture | Sound |
|---|---|---|
| 0.0 | A bright city street, wide. The pelican rides the bike lane | The beat, **small**: band-limited (about 500–3500 Hz), mono, no sub, the hook thin. A noise sweep rises from 1.0 to 2.0 |
| **2.0** | **Black bars slam in to 9:16** (overshoot at 2.125, settled by 2.2) | **The drop.** Full range and full width on 2.0: kick and sub together, the hook at the tune's top note |
| 2.04, 2.10, 2.17, 2.24, 2.31 | The interface pops in piece by piece | Five tiny pops climbing the five notes |
| **3.0** | **Double-tap: a large pink heart** pops in the middle of the picture | **The like**: two quick taps (2.91 and 3.0) and a bright pop on 3.0. The hook holds the tune's E |
| 4.0–6.0 | The video plays on; the progress bar fills | Bar 3, full. From 5.0 a rising sweep and the hat roll |
| **6.0** | **The progress bar reaches the end exactly as the pelican crosses the frame** | **Everything stops dead** on 6.0 (a fade of 5 ms). The bell takes the D |

Declare cues at u = 0, 2.0 and 3.0.

## The bicycle here

`bike: { chain: 0, bell: 1 }`: your hats are the chain.

## The lead

Export the bell hook as `lead` (one note at the given pitch).

## Hand-over

In: Section 18's tape runs up to speed and stops on your downbeat; its long
reverb is still dying under your first bar, which is why your first bar is
small and dry. Out: Section 20 is a quiet piano. Your hard stop at 6.0 is
its entrance: leave no tail at all.

## Check

- Loudness: -16 LUFS over the whole six seconds, the first bar included.
  Peak below -6 dBFS: the kick and the sub together must not exceed it.
- The picture: bar 1 confined to a band in the middle; at 2.0 the whole
  height lights up, down to the kick at the bottom; a clean vertical end at 6.0.
- The probe on the kick: 90 % of its level within 5 ms, pitch falling.
- Balance: less than 35 % of the energy below 120 Hz.

## As built

File: `audio/parts/19-shortvideo.js`. Nothing in it was listened to; everything
below was checked by measurement (`--check`, `--with bike`, `--from 111 --to 127`,
`--label` renders, the probe) and by looking at the spectrogram. Revised after
the review of 2026-11-18 (see "After the review" at the end).

### Routing

- **u < 2.0, the phone:** every event that starts in bar 1 goes to a mono bus
  (a gain with `channelCount 1`, explicit) through three high-passes at 500 Hz
  and three low-passes at 3500 Hz, at 0.4 of the full level. No sub in bar 1.
  The kick there is only its click and the top of its sweep.
- **u >= 2.0, full:** stereo and full range. Events are routed by their own
  start time, so a bell struck at 1.75 still rings out through the phone.
- No reverb at all (the brief asks for dry, and the hard stop wants no tail).

### What plays

| u | What |
|---|---|
| 0.0 | First sound, exactly on the downbeat: kick (phone), chain tick; bell D6 3 ms later. |
| 0-6 | **Hook:** the tune two octaves up (D6 ... B6, bar 3 ends B5 A5 B5) on bells, every note on its beat; each note repeated an eighth later at about -10 dB, panned left (the echo), except at 3.0 (the held E stands alone) and where the echo would fall at or after 5.965. Each echo is damped (30 ms fade) so that it is silent when the next hook note after it strikes; the last echo (A5 at 5.75), which has no hook note after it, is silent from 5.88. On every beat that has a kick (0, 0.75, 1.0, 2.0, 2.75, 4.0, 4.75, 5.0, 5.5) the bells, hook and echo, strike 3 ms after the kick. |
| 0-5.5 | **Chain hats** in sixteenths, accent on every third sixteenth (it moves across the beat); none at 3.0 (the double-tap takes it). |
| 0, 0.75, 1.0, 2.0, 2.75, 4.0, 4.75, 5.0, 5.5 | **Kick.** None at 3.0 (the like stands there) and none at 5.75 (the roll runs alone into the frame). |
| 0.5, 1.5, 2.5, 3.5, 4.5, 5.5 | **Clap** (beats 2 and 4). |
| 0.25, 1.25, 1.75 / 2.25, 3.25, 3.75 / 4.25, 5.25 | **Stab** on the off-beats where no kick falls: D, D, D / G, A, A / D/F#, G. 0.34 s long, so the kick at 4.0 and 5.5 ducks the tails of the stabs at 3.75 and 5.25. |
| 1.0-1.985 | Noise sweep 600 -> 3300 Hz through the phone, cut with a 6 ms fade just before the drop. |
| **2.0** | **The drop** (cue): kick, sub G1, bell B6, all full range and wide. |
| 2.0-5.97 | **Sub:** G1 (2.0), A1 (3.0), D2 (4.0), G1 (5.0), A1 (5.5-5.97), each gliding in from the root before (time constant 18 ms), ducked 6 dB for 90 ms under every kick. The last one is 3 dB quieter than the others (velocity 0.708) and fades 5.965-5.97, leaving 30 ms of air for section 20's piano. |
| 2.04, 2.10, 2.17, 2.24, 2.31 | **Pops** D7 E7 F#7 A7 B7, panned left to right. |
| 2.91, 3.0 | **Taps** (the double-tap). |
| **3.0** | **The like** (cue, measured in 5-12 kHz): a chirp from about 880 Hz up to D7 with A7 above and a sparkle of noise. The hook's E6 is struck and held for the whole second (a longer-ringing bell, damped at 4.0). |
| 3.75-3.97 | Hat roll in 32nds into bar 3, crescendo. |
| 5.0-5.88 | Rising sweep 700 -> 8000 Hz, cut with a 6 ms fade at 5.88; hats crescendo 5.0-5.5, then a 32nd roll 5.5-5.84. |
| 5.88 | The sweep and the hook's last echo are gone: from here only the last hook bell (B5) and the sub sound. |
| 5.965 | Everything bright (the last hook bell, stab) has faded out (20 ms fades). |
| 5.97 | The sub stops (5 ms fade). |
| **6.0** | Nothing of this part sounds. The bell takes the D. |

### How each sound is made

- **Bell hook:** `modal` partials at the bicycle bell's ratios (0.5 at 0.02, a
  pair at f x 0.9985 / 1.0015 at 1.0 / 0.45, a pair at 2.756 / 2.765, 5.19), t60
  1.2 s for the fundamental, 2.5 ms attack, 5 ms of striker noise at 6.5 kHz;
  played for its note plus 0.35 s with an 80 ms fade (heard about half a
  second); an echo is cut shorter, to end (30 ms fade) on the next hook note. The held E rings with t60 1.6 s and is damped at 1.0 s. The second
  partial of the pair is weaker than on the bicycle (0.45, not 0.8): the
  beating was the main cause of the part's peaks.
- **Chain hat:** our own tick: band-passed white noise (3.4-4.5 kHz) with a
  0.4 ms attack and two short metal modes (6-9 kHz).
- **Kick:** sine 150 -> 45 Hz exponential in 0.1 s, 1 ms attack, gone by
  0.17 s, plus 2 ms of high-passed noise. Probe: 10-90 % in 4 ms, 133 Hz in
  the first 20 ms, 47 Hz at 60-160 ms. Level `KICK` 0.247.
- **Clap:** four band-passed noise bursts at 0, 9, 17, 27 ms (decay 2.5 ms
  each), then a 45 ms tail.
- **Sub:** a sine with 12 % second harmonic. Level `SUB` 0.088.
- **Stab:** per chord tone two oscillators +-4 cents, each a sawtooth's
  spectrum (20 harmonics at 1/n) with Schroeder phases, the two sides with
  different phase sets, started 0.6-3.9 ms apart, panned +-0.85, through a
  low-pass closing 2800 -> 700 -> 500 Hz. (Plain saws all starting in phase
  made a chord with a 19 dB crest factor.)
- **Pops / like / taps:** sine chirps computed in JS that settle on their note
  from 5 (pops) or 17 (like) semitones below; the taps are a 190 Hz thump of
  9 ms with a 2.6 kHz tick.

### Measured

-16.7 LUFS (target -16), peak -5.2 dBFS at film 117.759 (this part's limit is
-4 dBFS, `PEAK` in `audio/mix.js`), 28.3 % of the energy below 120 Hz, largest
step 0.231. Lead 16 notes, median -1.4 cents, worst -3.0. Cues 0.0 / 2.0 / 3.0
at +5 / +3 / +2 ms. Bell band -93.6 dBFS before 119.00. With the bike: both
crossings ok (+1 ms 119 dB, +2 ms 17 dB). In `--from 117 --to 127` (and
`--from 111 --to 121`) section 20's first-note cue at 119.000 reads +4 ms, rise
5 dB (5.20 dB unrounded, read with the checker's own `onsetNear`). Kick alone
-11.0 dBFS peak, -25.3 LUFS; sub alone -20.9 dBFS peak; hook alone -18.1 LUFS.

### Unsure

- Section 20's first-note cue at 6.0 (film 119.000) now rises 5.2 dB. The
  checker takes the level before the cue as the 95th percentile of 5 ms levels
  in 118.88-118.988 s; that is now set mostly by the last hook bell, B5 at 5.75
  (alone about -21.7 dB there), and the sub (-25 dB). The bell was left as it
  is (no ruling touches it), so the margin above 5 dB is small.
- The cue at 0.0 now reads +5 ms (was +2): in bar 1 the kick is heard through
  the phone and the bell, which strikes 3 ms later, is what the checker finds.
- `lead` (the bell) could not be heard through the outro: the outro is still a
  stand-in. It routes to the full bus and needs only `ev.midi`, `ev.dur`,
  `ev.vel`; buffers for every D-major pitch from A4 to D7 are made in
  `prepare()`.

### After the review

Rulings of 2026-11-18, carried out:

1. **Kick and sub.** On every beat the kick shares with the bells, the hook bell
   and its echo strike 3 ms after the kick (`BELL_LATE`, in the play function, so
   the score's times are unchanged; the outro's `lead` has no `u` and is not
   delayed). `KICK` 0.165 -> 0.247 (+3.5 dB; alone the kick measures +3.5 LU,
   peak +3.8 dB); `SUB` 0.07 -> 0.088 (+2.0 dB; alone +2.0 LU, +1.9 dB peak).
   Peak -6.4 -> -5.2 dBFS, level -17.0 -> -16.7 LUFS, low end 20.4 -> 29.1 %.
   (A 4 ms delay gave -4.5 dBFS, 5 ms -4.9; 3 ms gave the lowest peak.)
2. **Clean held E.** No echo at 3.0 (the F#6 echo is gone: the echo-only render
   is silent from 116.000 to 116.250). Every echo now ends, with a 30 ms fade,
   at the next hook note after it (probe: the echoes before 2.5 and 3.0 are at
   zero by 115.500 and 116.000).
3. **Sub ends at 5.97.** The last A1 is 0.47 s long; the probe reads silence in
   the sub from 118.970.

Nothing else changed: notes, times, instruments, routing and the `lead` export
are as before.

Second round (room for the piano's first note), carried out:

1. **The last sub note** (A1, 5.5-5.97) has velocity 0.708: -3.0 dB against the
   other sub notes (RMS of the sub alone: A1 at 3.0 -24.0 dB, A1 at 5.5 -27.0 dB).
2. **The hook's last echo and the closing sweep** end at 5.88 (`CLEAR_END`), not
   just by 5.95 as ruled: ending both at 5.95 (with the quieter sub) left the cue
   at 4 dB as the check prints it; with the echo ending at 5.88, the sweep ending
   at 5.95 gave 4.89 dB, at 5.92 4.82, at 5.90 5.10, at 5.88 5.20 dB. The last echo (A5 at 5.75) is damped with
   its usual 30 ms fade; the sweep keeps its shape over 0.88 s instead of 0.965 s.
   Both renders alone are silent from 118.880.
3. Result: section 20's cue at 119.000 rises 3 -> 5 dB (lag +8 -> +4 ms) in
   `--from 117 --to 127` and `--from 111 --to 121`; the bell's crossing rises
   11 -> 17 dB. Level, peak, tuning and the other cues are unchanged; the low end
   is 28.3 % (was 29.1). Nothing else changed.
