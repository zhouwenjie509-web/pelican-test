# Music · Outro · 片尾 · The Press Conference

| | |
|---|---|
| Film time | 125.0 s – 137.0 s (six bars) |
| Part file | `audio/parts/21-outro.js` (`node tools/audio.mjs --part outro --check`) |
| Owner's brief | "All the instruments from the different eras play the main melody together. As the camera pushes in, the music gradually fades. At the end, only one bicycle bell remains." And for the picture: "Several camera flashes illuminate the empty chair on strong beats." "The pelican suddenly rides past behind the press-conference setup without looking back. Only a single bicycle bell is heard." |
| Loudness target | -18 LUFS over the whole outro (the first six seconds carry it) |
| Picture | `src/scenes/outro.js` (the `OUTRO` table); `briefs/CUES.md`, "Outro" |

Times in this brief are film seconds. In your score `u` is seconds from
125.0 (`s.t0` = 125).

## The idea

Twenty answers have been handed in, and here they all are on one wall: so
all twenty play the tune at once. Then the camera goes looking for the
pelican's own comment, the orchestra drains away an era at a time until one
piano is left holding an unfinished phrase over an empty chair, and stops.
The pelican rides past behind the table. One bell. It is the note the piano
did not play.

## The voices

Every section's part exports `lead`, one note of its own instrument, and
`leadOctave`, the octave it plays the tune in. Reach them through
`s.parts.get(id)` in `score()`. In your `graph(k, out)`, build each
section's own effects feeding your bus with `k.subgraph(id, yourBus)`; it
returns the `g` to hand to that section's `lead`:

```js
graph(k, out) {
  const bus = k.gain(1);
  bus.connect(out);
  const voices = {};
  for (const id of IDS) voices[id] = k.subgraph(id, bus);
  return { bus, voices };
}
// an event:  (k, g, when, ev) => part.lead(k, g.voices[id], when, ev)
```

Read each part's file to see what its `lead` expects (most take `ev.midi`,
`ev.dur`, `ev.vel`; some want extra fields) and how loud it is. Ask every
voice for the major scale: the gamelan, the shamisen and the cinema piano
play the plain tune here. The sitar finally plays the bar it left out.

Twenty instruments in unison are a blur unless they are placed:

- **Registers**: low voices (guqin, organ and cinema piano, chant, cellos)
  an octave down; middle voices at written pitch; high voices (dizi, clay
  flute, sine beeps, chip pulse, bell hook) above.
- **Who plays what**: everyone plays the six skeleton notes. The running
  eighths are played only by the instruments that speak quickly (plucked,
  struck, chip, piano, flutes). The slow ones (xiao, strings, organ, voices,
  guqin) hold the skeleton.
- **Where**: spread across the stereo field in the order of the sections,
  oldest on the left, newest on the right; keep it sensible in mono.
- **Level**: set each voice so that none stands out; then the whole to target.

Under them, plainly: the string orchestra of Section 12 on the chords, a low
bass on the roots, and a broad drum on the beats. No other percussion.

## Timeline

| Film s | Picture | Sound |
|---|---|---|
| **125.0** | The pelican goes through the last frame and does not come out | The bell (bicycle part). **Tutti: all twenty voices begin the tune** |
| 125.3–127.0 | The camera pulls back to the whole wall, 7 × 3 | The tutti grows as the wall appears |
| 126.3–126.9 | Subtitle: 截至目前，人类共提交了 20 份答卷。 | Full by 127.0 |
| 127.0–129.0 | The wide shot | Bar 2 of the tune, all twenty, the held E at 128.0 |
| **129.0** | The camera starts to push in. **Flash 1** | **A camera flash** (below). Bar 3 of the tune begins; **from here the music fades**: sections 1 to 7 stop playing |
| **130.0** | **Flash 2** | A flash. Sections 8 to 12 stop |
| **131.0** | **Flash 3** | A flash. The tune begins again (second time), quieter: sections 13 to 20 only, and thinning |
| **132.0**, **132.5** | **Flash 4, flash 5** | Flashes. By 133.0 only the strings and the piano are left |
| 133.0 | The camera has arrived at picture 21: a table, microphones, an empty chair. Subtitle: 鹈鹕本人对此尚未发表评论。 | **The piano of Section 20, alone, very softly**: B, A, F# (133.0, 133.5, 133.75) |
| 134.0 | | The piano's **E**, held, unresolved, dying away. Silent by 134.9 |
| **135.0–136.15** | **The pelican rides across behind the table**, fast, without looking | **No music.** |
| **135.5** | It is behind the chair | **One bell** (bicycle part). Nothing else |
| 137.0 | The empty set | Silence |

**The flashes.** Photographers we never see. Each flash is a small invented
sound: a shutter's click, a soft burst, and a faint whine that rises for a
third of a second as the flash recharges. Quiet: they are in the room, not
in the music. Exactly on 129.0, 130.0, 131.0, 132.0 and 132.5.

Declare cues at 125.0 and at each flash.

From 135.0 to the end your part is silent, completely. The single bell is
the bicycle part's and is already there.

## Check

- `node tools/audio.mjs --part outro --with bike --check`.
- The picture: a dense first six seconds; a visible thinning in steps at
  129, 130, 131; five small bright marks for the flashes; one instrument
  from 133; nothing of yours after 134.9; the bell alone at 135.5.
- Probe 135.0–135.4: silence.
- Probe a tutti note: the tune's pitch is the strongest thing in each octave. (As built this is met only by pitch class, summed over octaves 3 to 6: 16 of 16 notes. Octave by octave the strings' chord note can still equal or lead the tune's note in octaves 3 and 4; see "After the acceptance check".)
- Budget: this is the densest part of the film. Count your sources
  (the check prints them) and stay under about 150 sounding at once.

## As built

Nothing here was listened to. Everything below was checked by measurement
(`--check`, the probe, per-voice renders) and by looking at the spectrograms.

**What plays** (film seconds; u = film − 125):

| Film s | What sounds |
|---|---|
| 125.0 | All twenty voices begin the tune together (players up to 12 ms behind the beat; the first downbeat of every fourth section exact). Strings on D (A3 D4 F#4), bass D2, drum (tuned to D2) on every beat. Bell: the bicycle's. |
| 125.0–127.0 | The tutti grows from 0.62 to full by 127.0 (velocity ramp). |
| 127.0–129.0 | Bar 2, all twenty; strings G then A; the held E at 128.0. |
| 129.0 | Flash 1. Bar 3 begins. Sections 1–7 play no new note; their buses close over 1 s. |
| 130.0 | Flash 2. Sections 9–12 stop the same way. **The sitar (8) is the exception**: it plays the whole of bar 3 (to B3 at 130.75), the bar its own section left out, and closes at 131.0. |
| 131.0 | Flash 3. The tune again, quieter (0.62 falling), sections 13–20 only; under it only the cellos' D3, quiet (velocity 0.4 at the strings' level 0.25: where velocity 0.2 at 0.5 put it), no bass. |
| 132.0 | Flash 4. Sections 13–16 close. |
| 132.5 | Flash 5. Sections 17–19 close. |
| 133.0 | The piano of Section 20 alone, softly: B4 133.0, A4 133.5, F#4 133.75 (the cellos' last D is let go at 132.85 and its 0.12 s release is over by 132.97). |
| 134.0 | The piano's E4, held, dying; its bus fades 134.45–134.87. No D. |
| 135.0–137.0 | Nothing of this part (probe 135.0–135.4: −inf dBFS). The bell at 135.5 is the bicycle's. |

**Voices** (octave relative to the written tune; run = every note, hold = the six skeleton notes, each for its written length less 40 ms: 0.46 s, the held E 0.96 s, then the lead's own release):
sahara chant −1 hold · egypt harp 0 run · han chime bells 0 run · tang pipa 0 run (single strokes, never the roll) ·
song guqin −1 hold · qingming dizi +1 run · maya clay flute +1 run · mughal sitar 0 run · bada xiao 0 hold ·
wayang saron 0 run · ukiyoe shamisen 0 run · starry first violins +1 hold · scream violas and cello −1 hold
(asked with `vibCents: 0`: no vibrato) · nosferatu cinema piano −1 run · scope sine beeps +1 run ·
pixel chip pulse +1 run · chat ring-tone FM +1 run · vapor FM saxophone 0 hold · shortvideo bell hook +2 run ·
code piano 0 run, and the last word. Pan from −0.6 (sahara) to +0.6 (code) in section order.
Every voice is reached only through its `lead` and `k.subgraph(id, node)`; each was rendered alone
(`--label "voice:<id>\b"`, `dev/audio/outro-voices.sh`) and measured over 125–137: eighteen voices at
−32.9 to −33.1 LUFS, pixel −34.5 and the bell hook −34.6 (1.4 and 1.6 dB under). Pitches were measured
voice by voice before the review (`dev/audio/outro-measure.js`: all within 12 cents); the check's lead
tuning after the review: median 0.2 cents, worst +4.2.

Each lead is asked only for what its own file prepares: the cinema piano an octave down has only short
buffers below A3, so those notes are clamped to 0.62 s (the held E3 included); from A3 up it has both
lengths and each note asks for its own (B3 at 127.0 is 0.48 s). The sections' own `prepare()` makes
every lead buffer; this part's `prepare()` makes only the drum and the five flashes. Checked with
`dev/audio/outro-misses.mjs` (every part's prepare, then every outro event played on a stub Kit):
0 buffer misses, 0 errors, no play call over 1 ms.

**Under them** (this file's own sounds):
- strings: a band-limited bowed (Helmholtz) wave with bow-position notches, a lowpass that opens as the bow bites,
  no vibrato, one player a desk, into a second copy of Section 12's desks (vln2, vla, vc, cb) and hall.
  Chords | D | G . A . | D/F# . G A | D (cellos' D3 only, velocity 0.4, 131.0–132.85) |, each placed 30 ms early so it speaks on the beat.
  The strings and bass go into the mix at `STRINGS` 0.25 (6 dB under the 0.5 they were first set at).
- bass: the same bow on the roots (D2 G2 A2 F#2 G2 A2), darker (lowpass to 3× f) so its fifth harmonic does not pull the tune's F#; none in the second statement.
- drum: the modes of a large skin tuned to D2 (73.4 Hz × 1, 1.59, 2.14, 2.30, 2.65; the fundamental t60 0.5 s) and a felt thud, on all thirteen beats from 125.0 to 131.0.
- flashes: two leaf-shutter clicks (bandpassed noise at 5.2 kHz), a 60 ms burst of filtered noise, and a sine
  rising 2.6 → 4.4 kHz over 0.33 s, very faint. Peak −18 dBFS alone, −40 LUFS together (measured before the review's MASTER trim of −0.95 dB).
- a gentle tanh knee (linear below about −16 dBFS) on the whole (MASTER 1.62 into it), and a 30 Hz highpass.

**Measured** (2026-11-18, after the acceptance check; the part as the music director's hand edit left it): −18.6 LUFS
over 125–137 alone, −18.8 with the bicycle (target −18); peak −5.5 dBFS at 127.016 (the outro's own allowance is
−4.5); cues at 125.0 and the five flashes within 4 ms; largest step 0.140 at 127.010; lead tuning median 0.2 cents,
worst +4.2. Sources: at most 172 alive (sounding or scheduled within 2 s); 334 events. Probe 135.0–135.4: −inf dBFS.
The tune's pitch class against the chords, note by note: see "After the acceptance check" below.

**Unsure**: whether twenty voices plus strings read as an orchestra or as a blur by ear (the spectrogram
between 1 and 10 kHz is dense); whether the ring-tone FM voice and the chip pulse sit too far forward
in the top octave; the sitar finishing bar 3 departs from the table's "8 to 12 stop at 130.0" by one
voice for one second, to honour "the sitar finally plays the bar it left out".

**After the review** (rulings of 2026-11-18; still nothing listened to). The figures in this list were measured before the music director's later hand edit (`STRINGS` 0.5 → 0.25, the last chord's velocity 0.2 → 0.4, `MASTER` 1.38 → 1.62: see the paragraphs that follow); they are kept as the record of that round:
- The second statement's pedal was made the cellos' D3 alone at velocity 0.2 (was D3 + bass D2 at 0.56: −8.9 dB, and
  no bass). At 132.05 A4 is the strongest pitch of octave 4 (−43.5 dBFS against D4 −48.3); at 132.55 F#4
  (−40.5 against D4 −47.6). The D3 below is still the strongest pitch of octave 3 at both moments. Unsure: at
  132.05 the cellos alone give D4 at −46.4 dBFS, and the whole reads lower there, so part of the margin is the
  voices' D4 partly cancelling the cellos' (a phase coincidence, not a level).
- The holds play each skeleton note for its written length (0.46 s; the held E 0.96 s) instead of 0.96 s. Voices
  alone, the tune's note is now the strongest pitch of octaves 3 and 4 at 125.55, 127.55 and 129.55. In the
  whole mix it is not, except octave 4 at 129.55: the strings' chord tones (the violas' D4 in the D and G chords,
  G3/B3 of the G chord, the cellos' F#3 in D/F#) are stronger. The strings were not changed in that round; the music director then lowered them 6 dB (`STRINGS`
  0.5 → 0.25, `MASTER` 1.38 → 1.62: next paragraph), and the measurement after the acceptance check (last
  paragraph) finds the tune's pitch class the strongest on all sixteen notes of the first statement. Octave by
  octave, the chord tones can still match or pass the tune's note in octaves 3 and 4 (the hand edit's own figures).
- The drum is tuned to D2 (73.4 Hz) and its fundamental rings 0.5 s (was 58 Hz, 0.9 s); its alone loudness is
  unchanged (−32.7 against −32.4 LUFS). Its second mode (×1.59) now falls on A#2 (116.8 Hz, −5.7 dB under the
  fundamental alone); the mix at 130.6 no longer shows any A# among its ten strongest partials.
- The last chord is let go at 132.85 with a 0.12 s release (was 132.9 + 0.25/0.3 s). At 133.0–133.15 the strings
  alone are −65.2 dBFS rms (only the hall's tail), the piano alone −39.9, the whole −39.7.
- `prepare()` no longer runs the dry-run loop over the leads; the cinema piano's B3 is no longer forced to 0.7 s.
- The voices were rebalanced alone (sahara, tang, qingming, bada, starry, scream, scope, chat and vapor up
  0.6–1.7 dB, mughal down 0.8, pixel and the bell hook up 0.5, song and wayang up 0.1); then, because the
  retuned drum added its crest to the bar-2 downbeat (peak −5.6 dBFS), MASTER 1.54 → 1.38, the whole −19.3 LUFS.

**Music director's hand edit after the fix round.** The fixer met every ruling except one in the full mix: with the holds shortened the running eighths led among the voices alone, but the string chords' own notes were still 6 to 9 dB above them in octaves 3 and 4. The strings and bass were lowered 6 dB (`STRINGS` 0.5 to 0.25; the last, quiet chord's velocity raised from 0.2 to 0.4 so that it stays where the fixer put it), and the whole raised to keep its loudness (`MASTER` 1.38 to 1.62). Measured with `dev/audio/outro-oct.mjs` on the render with the bicycle: at 127.55 and 129.55 the tune's note leads octave 4 (A4 -30.1 against D4 -33.9; E4 -30.5 against B4 -34.5); at 125.55 it is 1.5 dB under the chord's D4; in octave 3 it is 1.4 to 2.8 dB under the nearest chord note. The part now measures -18.8 LUFS with the bicycle and peaks at -5.5 dBFS on the bar-2 downbeat, which is why the outro has its own peak allowance of -4.5 dBFS in `audio/mix.js`. All cues read ok. Nothing was listened to.

**After the acceptance check** (third-round rulings, 2026-11-18; nothing listened to). **The sound was not changed**: `audio/parts/21-outro.js` is byte for byte the file the music director's hand edit left (`STRINGS` 0.25, `MASTER` 1.62; a copy taken before this round was compared with it and is identical, so it is not kept). Ruling 2 said to change it only if the tune's pitch class lost on more than three of the sixteen notes of the first statement or on any skeleton note; it loses on none.

How it was measured: `node tools/audio.mjs --part outro --with bike --out out/audio/outro-r3-bike.wav`, then `node dev/audio/outro-r3-pc.mjs out/audio/outro-r3-bike.wav` (output kept in `dev/audio/outro-r3-pc.txt`). The two channels summed to mono; for each note a window from 30 ms after its beat to 180 ms (to 130 ms for the notes on a half beat); the energy of every equal-tempered semitone with its fundamental in octaves 3 to 6 (C3 130.8 Hz to B6 1976 Hz), summed by pitch class. The semitones come from a joint least-squares fit (Hann-weighted, a sine and cosine at every semitone from C2 to E7, a light ridge of 5 %), which separates D3 from C#3 although the window's own bin (7 to 10 Hz) is as wide as the semitone; the margins agree within 0.1 dB at ridge 1 %, 5 % and 20 %, and within 0.7 dB (3.0 dB at 128.00) with a plain zero-padded Hann spectrum summed over each semitone's band. dB is relative only (full-scale sine ≈ 0 dB for the fit).

| Film s | Tune | Skeleton | Strongest pitch class | Tune over the next |
|---|---|---|---|---|
| 125.00 | D4 | yes | D | +12.1 dB (A) |
| 125.50 | E4 | | E | +3.8 dB (D) |
| 125.75 | F#4 | | F# | +13.6 dB (C#) |
| 126.00 | A4 | yes | A | +7.6 dB (E) |
| 126.50 | F#4 | | F# | +16.5 dB (C#) |
| 126.75 | A4 | | A | +10.8 dB (E) |
| 127.00 | B4 | yes | B | +15.8 dB (F#) |
| 127.50 | A4 | | A | +11.3 dB (E) |
| 127.75 | F#4 | | F# | +14.0 dB (C#) |
| 128.00 | E4 | yes | E | +13.7 dB (B) |
| 129.00 | F#4 | yes | F# | +17.4 dB (C#) |
| 129.50 | E4 | | E | +6.6 dB (B) |
| 129.75 | D4 | | D | +1.9 dB (A) |
| 130.00 | B3 | yes | B | +10.5 dB (F#) |
| 130.50 | A3 | | A | +6.2 dB (E) |
| 130.75 | B3 | | B | +9.2 dB (A) |

Sixteen of sixteen, all six skeleton notes among them (the D at 131.0, the second statement's first note, also leads: +7.5 dB over A). The thinnest margins are 129.75 (D4 +1.9 dB over A, with the D/F# chord's A3 under it) and 125.50 (E4 +3.8 dB over D, while the D chord sounds). This is a pitch-class measure over four octaves, so the voices above the strings count for the tune; octave by octave in octaves 3 and 4 the chord tones can still equal or pass the tune's note, as the hand edit's own figures say. Checks on the unchanged part: alone −18.6 LUFS, peak −5.5 dBFS at 127.016, step 0.140, all six cues ok, lead median 0.2 / worst +4.2 cents, "Nothing out of tolerance."; with the bicycle −18.8 LUFS, crossing 20 and the last bell ok, "Nothing out of tolerance."; lint nothing; `--from 123 --to 137 --check` nothing out of tolerance (its peak −2.5 dBFS is the player's master level for film renders, +3 dB over a part alone: the outro and bicycle rendered over the same stretch with `--only` peak −5.5).
