# Music · Section 9 · 八大山人写意 · Bada Shanren Expressive Ink

| | |
|---|---|
| Film time | 53.0 s – 59.0 s |
| Part file | `audio/parts/09-bada.js` (`node tools/audio.mjs --section 9 --check`) |
| Owner's brief | "Bada Shanren: Xiao (vertical bamboo flute)" |
| Loudness target | -25 LUFS |
| Scale | major (D E F# A B) |
| Picture | `briefs/09-bada.md`, `src/scenes/bada.js`; `briefs/CUES.md`, "Section 9" |

## The idea

A few strokes and a great deal of paper. A few notes and a great deal of
silence. In bar 2 the pelican rolls its eye to heaven, and the flute's one
long note rolls up with it, hangs there, and comes down. A small fish below
has seen it and does the same.

## Instrument

**A xiao**: an end-blown bamboo flute. Soft, dark and breathy: the
fundamental with a weak second and third partial, a veil of breath, a slow
gentle start (80–150 ms), vibrato that arrives late and stays narrow, and
pitch bent by the lips. At written pitch (D4 … B4, and E5 at the top of the
eye note). Nothing else plays,
except the fish. A small dry room, about 0.7 s, barely there.

## The three bars: seven notes

| u | Picture | Sound |
|---|---|---|
| 0.0 | The pelican rides onto empty paper | **D4**, long (about 0.9 s), beginning in breath |
| 1.0 | | **A4**, long (about 0.8 s) |
| 2.0–2.6 | **The eye rolls up**: the pupil climbs, the head tips back | **B4**, which bends slowly upward as the eye goes, five semitones (to E5, the tune's E an octave up) by 2.6, the tone thinning |
| 2.6–3.6 | The eye is held fully rolled, through the strong beat | The same breath, held up there on E5 through the strong beat: straight, narrow, no vibrato |
| 3.2–3.8 | **The fish answers**: its eye rolls too | A tiny second voice, an octave or more below and far quieter: one short upward bend, B3 up five semitones to E4, 3.25 to 3.7. The same gesture, small |
| 3.6–4.0 | The eye comes back down | The long note slides down to arrive on **F#4** at 4.0 (one breath from 2.0 to about 4.4) |
| 4.75 | | **D4**, short |
| 5.0 | | **B3**, long, fading into breath. The bell takes the D |

Between the notes there is nothing. Do not fill it.

Declare cues at u = 0 and 2.0 (`soft: true`: the flute speaks slowly; begin
each note about 40 ms early so that it is heard on its beat).

## The bicycle here

`bike: { chain: 0.5, bell: 0.8 }`.

## Hand-over

In: Section 8 has been silent for three seconds; your first breath comes out
of that silence. Out: Section 10 is a gamelan and begins with a gong.

## Check

- The probe on a held note: the fundamental at least 15 dB above the second
  partial; breath noise visible between 2 and 6 kHz, 30 dB or more below the note.
- In the picture: seven notes, wide gaps, and one line that climbs from 2.0,
  runs level, and descends to 4.0.
- Mark the bending notes `free: true`. The others must be in tune.
- -25 LUFS: this is the quietest section of the film.

## As built

Nobody has listened to this part; everything below was checked by measurement
(`--check`, `--with bike --check`, `audio-probe`) and by looking at the spectrogram.

**What plays** (u in seconds; later notes start 40 ms early so the slow flute
speaks on the beat; the first starts at u = 0 exactly):

| u | event |
|---|---|
| 0.00 – 0.75 | D4, breath first (air peaks at 12 ms), tone speaks over 150 ms, a late narrow vibrato (from 0.3 s, growing to ±8 cents by 0.6 s, 5.1 Hz); release 0.60 – 0.75 |
| 0.96 – 1.56 | A4, the same breath shape (about 0.6 s; release 1.42 – 1.56) |
| 1.96 – 4.42 | one breath: B4 straight to 2.02; smootherstep up 500 cents to E5 by 2.60 while the tone's lowpass closes 2200 → 1150 Hz and the air rises ×1.7 (the tone thins), the tone's own level rising ×1.12 (+1 dB, see below); held dead straight on E5, no vibrato, 2.6 – 3.6 (the tune's held E on the strong beat, an octave up); smootherstep down 1000 cents to arrive on F#4 at 4.00, the tone opening again and its level back to ×1; a little vibrato from 4.08; release 4.27 – 4.42 |
| 2.60 – 3.60 | a silent marker event at E5 (`lead`, not free) that declares the held top, so that the checker measures it and draws its dotted line |
| 3.25 – 3.70 | the fish: a small, purer voice an octave below (B3), 18 % of the flute's level (about 17 dB under the held E5 by the re-check's measurement), bends up 500 cents to E4 between 3.31 and 3.57, gone by 3.70; panned a little right |
| 4.71 – 4.99 | D4, short (60 ms speech) |
| 4.96 – 5.80 | B3: tone fades out 5.28 – 5.68 while the air goes on, the air gone by 5.80 |

Nothing sounds between these: bar 1 has two real silences, 0.75 – 0.96 and 1.56 – 1.96 (below −50 dBFS from about 0.76 and 1.55, only the room's tail, under −60 dBFS within 0.1 s). Nothing of this part is in 1.8 – 9 kHz in the
last 30 ms before u = 6 (the check measures −107.6 dBFS). Cues declared (both
`soft`): u = 0 (first breath) and u = 2.0 (the long note). Lead notes measured: D4, A4, the held E5, D4, B3; the eye's bends are `free` (inside the B4 event), the fish is `free`.

**How it is made.** All Web Audio nodes, because the pitch has to move while
it sounds. Tone: an oscillator on a fixed harmonic recipe (1, 0.1, 0.05, 0.015)
through a 2.2 kHz lowpass: measured on the held D4, 2nd partial −19.5 dB, 3rd
−28 dB; on the held E5, 2nd partial −23.9 dB. Edge noise: white noise through a band-pass (Q 9) on the fundamental,
following the pitch through the filter's detune, which gives the airy, dark
fundamental. Breath: the same noise band-passed round 3.6 kHz, −35 to −37 dB
under the fundamental in 2 – 6 kHz on a held note, a little stronger at each
onset. A gain after the tone (`lift`, default 1) can raise the tone's level along a note; only the eye note uses it. One ConstantSource carries the bend (and the vibrato LFO summed into it)
to the oscillator's and the edge filter's detune, so tone and air bend
together. A small dry room (0.7 s, t60 0.55, dark), send 0.12. The air comes
from one 3 s seeded white-noise buffer made in `prepare()`.

**Level.** −25.5 LUFS alone over 53 – 59 s (LEVEL unchanged), peak −20.2 dBFS at film 56.80 (in the descent from E5). Bicycle:
`chain: 0.5, bell: 0.8`. The outro voice (`lead`) is the same flute with
attack and release scaled to the note, `leadOctave: 0`.

**Unsure.** The first cue measures +49 ms (soft limit 60): the flute speaks
slowly by design and the detector waits for a quarter of the note's peak.
Whether the fish, 20 dB under the flute, reads as an answer and not as a
smudge, can only be judged by ear; the chain at least does not cover it in its
band (see below). The tone-thinning is gentle (2nd partial goes from −19.5 to
−23.9 dB on the held E5). Whether E5 an octave above the tune's E reads as
"the E" and not as a new top note is a matter for the ear.

**After the review.** (1) More paper, as ruled: the first D4 now ends at
u = 0.75 (held 0.60 + release 0.15, was 0.75 + 0.15) and the A4 lasts about
0.6 s (held 0.46 + release 0.14, 0.96 – 1.56; was 0.96 – 1.78). This corrects
the brief's "about 0.9 s" and "about 0.8 s". Nothing else changed: the same
notes, times of onset, velocities, instruments, LEVEL and `lead` export.
(2) The fish against the chain: probed u = 3.25 – 3.70 (film 56.25 – 56.70) in
the fish's own band, 240 – 300 Hz. The fish alone peaks at −41 dBFS (about
−45 dB held); the bicycle alone peaks at −92 dBFS there (its ticks lie round
4 kHz, −36 dBFS full band). The chain is about 50 dB below the fish in its
band, not within 10 dB, so the fish stays at 0.18 of the flute, as ruled.

**After the acceptance check.** The acceptance check found the tune's E on the
strong beat missing (the long note held D5). Changed, as ruled: (1) the eye
note now bends B4 up 500 cents to E5 by u = 2.60 (same smootherstep), holds
dead straight on E5 to 3.60, and comes down 1000 cents to F#4 at 4.00; the
lowpass close (2200 → 1150 Hz), the air rising, the vibrato from 4.08 and the
release are unchanged. (2) The fish bends B3 up 500 cents to E4 (was 300 to
D4); same times, same 0.18 of the flute (fish alone, 3.25 – 3.70: −43.4 dBFS
rms before and after). (3) A silent marker event, E5 at u 2.6 for 1.0 s,
`lead` and not free, lets the checker measure the held note: the check now
lists 5 lead notes, all within 0.4 cents; a close render (`--from 55.4 --to
56.8`) reads E5 at −0.0 cents and the pitch track holds 659.0 – 659.4 Hz from
2.64 to 3.54; the dotted line lies on the E5 line in the picture.
Level of the held note (eye alone, film 55.7 – 56.5 = u 2.7 – 3.5): the held D5
was −25.5 dBFS rms (fundamental −22.5 dB). With only the bend changed, the E5
was −27.0 dBFS (−1.5 dB), out of the 1 dB allowed. The lowpass was not the
main cause: with no closing at all the E5 was still −1.1 dB; with the room's
send at 0, D5 and E5 measure the same (−26.4 dBFS), so the small room adds about
1 dB at 587 Hz and nothing at 659 Hz. So the lowpass close is kept as it was
and the tone's level rises ×1.12 (+1 dB) with the bend (same smootherstep as
the lowpass, back to ×1 on the way down): the held E5 now measures −26.1 dBFS
rms (−0.6 dB against the D5), fundamental −23.05 dB, 2nd partial 23.9 dB
under it (≥ 15 required). Whole part: −25.5 LUFS (was −25.4), peak −20.2 dBFS,
cues +49 and +20 ms (soft), bell band −107.6 dBFS; with the bicycle both
crossings +1 ms. Renders before and after are sample-identical up to u = 1.9;
after u = 4.6 they differ by at most 5e-4 (the room's tail of the long note).
Nothing was listened to.
