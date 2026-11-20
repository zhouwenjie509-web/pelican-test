# Music · Section 8 · 莫卧儿细密画 · Mughal Miniature Painting

| | |
|---|---|
| Film time | 47.0 s – 53.0 s |
| Part file | `audio/parts/08-mughal.js` (`node tools/audio.mjs --section 8 --check`) |
| Owner's brief | "Mughal: Sitar and tabla" |
| Loudness target | -19 LUFS |
| Scale | major (D E F# A B): Sa Re Ga Pa Dha |
| Picture | `briefs/08-mughal.md`, `src/scenes/mughal.js`; `briefs/CUES.md`, "Section 8" |

## The idea

A garden party with musicians. On the strong beat of bar 2 every guest is
painted again with a finger on the lips, the musicians' hands are off their
instruments, and the lute has been set down on the carpet. So the music
stops, on that beat, in the middle of a note. For one bar the only sound in
the film is a bicycle going by. Then (u = 4.0) the lute lying on the carpet
finishes the tune by itself: its sympathetic strings, which nobody touches,
whisper the tune's last bar. The bell on the next crossing gives the final D.

## Instruments

- **A sitar**: metal strings over a wide curved bridge that makes them buzz.
  Bright and nasal; just after each pluck the upper partials swell as the
  buzz takes hold, and the note sings for seconds. Its manners: **slides**
  between notes by pulling the string (the pitch glides over 80–200 ms), the
  **high drone strings** struck rhythmically between the melody notes, and a
  faint halo of **sympathetic strings** tuned to the scale. The tune at
  written pitch (D4 … B4).
- **Tabla**: the high drum, tuned to D4, with ringing strokes on the rim and
  dry slaps in the middle; the low drum, whose pitch slides upward under the
  heel of the hand. One cycle of twelve beats fits the section exactly: one
  drum syllable per beat, with running subdivisions on beats 4 and 10.
- **A drone** (tanpura): D and A, slowly plucked in turn, buzzing softly.
- A garden pavilion: about 1.0 s.

## The three bars

| u | Picture | Sound |
|---|---|---|
| 0.0 | The pelican rides through the garden; the party is at ease | Sitar plays bar 1 with slides; tabla begins its cycle; the drone hums |
| 2.0 | | B4, bent up to and held; A and F# slide down from it |
| **3.0** | **Everyone astonished, in a single frame**: a finger on every lip, hands off the instruments, the lute flat on the carpet | The sitar strikes the tune's E on 3.0 and **the string is choked within 60 ms**. The same instant: one muffled knock (the lute set down) with a faint jangle of loose strings. Tabla and drone stop dead (damped within 80 ms) |
| 3.0–4.0 | They stay like that | **No music.** The chain is heard alone |
| 4.0–6.0 | They stay like that | The lute's sympathetic strings, untouched, sound the tune's last bar (F#4 E4 D4 B3 A3 B3) as a whisper, about 20 dB under bars 1–2 |
| 6.0 | The frame | The bell gives the D that the tune was owed |

Declare cues at u = 0 and 3.0 (and, after the acceptance check, a soft one at 4.0).

## The bicycle here

The chain comes forward when everything else has stopped:

```js
bike: { bell: 1, chain: (u) => (u < 3 ? 0.8 : 1.6) },
```

## Hand-over

In: Section 7's clay flute. Out: Section 9 is a single bamboo flute, nearly
nothing. Your whisper leads into its quiet. Everything of yours is below
-50 dBFS by u = 8 (as built: by about u = 6.3).

## Check

- The probe on a sitar note: partials to 6 kHz or more, and the level of the
  upper partials rising for the first 50–100 ms before it falls.
- In the picture everything of bars 1 and 2 ends at the 3.0 line as if cut
  with a knife (without a click: the fades are short, not absent). The only
  later sound is the whisper of the lute's own strings from 4.0.
- Loudness is measured over the whole six seconds; the silence does not
  count against you (the meter gates it out), but check the first three
  seconds are not too loud: probe them.
- Bars 1 and 2 have the sitar's lead notes; bar 3 has the six whispered
  taraf notes, also lead notes.

## As built

Nothing here has been listened to. Everything below was checked by
measurement (`--check`, `audio-probe`) and by looking at the spectrogram.

**What plays** (u = seconds into the section; film = 47 + u)

| u | Sitar (lead) | Tabla | Tanpura | Other |
|---|---|---|---|---|
| 0.00 | stroke: D4 | dhin (ge + tin) | A2 plucked | |
| 0.25 | | | | chikari (D5 + D6) |
| 0.50 | stroke: E4, pulled up to F#4 (glide 0.67–0.77: F# is reached at 0.77) | dhin (ge + tin) | | |
| 0.75 | (F#4, same stroke) | | D3 plucked | chikari, light (vel 0.45) |
| 1.00 | stroke: A4, let down to F#4 (glide 1.43–1.55) | dha (ge + na) | | |
| 1.25 | | ge | | chikari |
| 1.50 | (F#4, same stroke) | ti ra ki ta on 1.5 / 1.625 / 1.75 / 1.875 (the run on the cycle's 4th beat) | D3 plucked | |
| 1.75 | stroke: A4 | | | chikari, light |
| 2.00 | stroke on the A fret, bent up to B4 (2.00–2.05) and held | tu (open, fundamental) | | |
| 2.25 | | | D2 plucked | chikari |
| 2.50 | let down to A4 (2.44–2.56) | na (rim) | | |
| 2.75 | let down to F#4 (2.70–2.80) | | | chikari, light |
| **3.00** | **stroke: E4, choked: full for 15 ms, silent by 3.055** | everything still ringing damped 3.00–3.05 | damped 3.00–3.05 | the lute set down: knock + jangle; chikari and sympathetic strings damped 3.00–3.05 |
| 3.0–4.0 | nothing | | | only the bike part (chain at 1.6 from u 3) |
| 4.00 | | | | taraf whisper: F#4 (one beat) |
| 4.50 | | | | taraf whisper: E4 |
| 4.75 | | | | taraf whisper: D4 |
| 5.00 | | | | taraf whisper: B3 (one beat) |
| 5.50 | | | | taraf whisper: A3 |
| 5.75 | | | | taraf whisper: B3 (each rings on under the next; the last is gone at u = 6.95) |

Everything of bars 1–2 is below -50 dBFS by about u = 3.35 (the room and the
lute's jangle are the last to go); u = 3.35–4.0 is silent (rms -88.5 dBFS,
film 50.5–51.0). From u = 4.0 nobody plays: the six taraf notes are the
tune's beats 8–11.5 (`s.theme()`, octave 0, the sitar's octave), marked
`lead: true`; they are below -50 dBFS rms by about u = 6.3. The tabla's twelve-beat cycle is written as its
first six beats (dhin dhin | dha-ge ti-ra-ki-ta | tu na); the second half
(from u = 3.0) is never played. Lead notes: the ten notes of bars 1 and 2 and the six of the whisper;
the four reached by a slide are marked on a sympathetic-string event at the
note's time (the sound comes from the stroke before). The choked E (0.06 s) is
shorter than the checker's 0.1 s minimum, so it is not in the tuning table; a
probe reads E4 (+16 cents in an 80 ms window, i.e. within the window's
resolution).

Cues: u = 0 (the pelican in the garden, the party plays), u = 3.0 (everyone
astonished: the choke, the lute set down) and u = 4.0, soft, heard in
340–400 Hz only (the lute's own strings finish the tune; the band keeps the
chain tick that falls on the same instant out of the reading). The art brief's old cue "3.5 music
resumes" is not in the scene code (CUES.md) and is not played.

**How each sound is made** (all in `prepare()`, as buffers; 0.22 s)

- *Sitar*: a sum of up to 40 harmonics on one running phase (Chebyshev
  recurrence, fixed per-partial phases), so slides are seamless. Plucked near
  the bridge (pick 0.09), partial levels falling as 1/k^1.25; the jawari is
  modelled as upper partials starting at about a third of their level and
  swelling (probe on the A4 stroke: the 2–5 kHz band peaks at +68 ms, the
  3–9 kHz band at +62 ms), plus a nasal band (boost 0.4, a narrow formant
  0.35 of its centre wide) that sweeps down from 1.4 kHz to 1.25 kHz, so it
  lifts the partials between about 1 and 2 kHz and hardly touches 2–5 kHz.
  After the bloom (from 80 ms) every partial above 2 kHz
  decays faster the higher it is (an extra 32/s at 4 kHz), so the top falls
  first: after their peak the 5–9 kHz band is 20 dB down in 84 ms, the
  3–9 kHz band in 216 ms, while the partials below 2 kHz keep the
  fundamental's long ring (t60 4.5 s). A4 stroke, 0.4 s: partials 2–4 at -1.5,
  -0.3 and -4.3 dB from the fundamental, 5–8 at -9.6 to -20.3 dB. 12 ms of bandpassed
  noise for the wire plectrum. One buffer per right-hand stroke (the A4 stroke
  at u = 1.0 has its own phase seed, 59, so that its waveform does not peak
  with the tabla's dha); the left-hand slides are pitch glides of 50–120 ms
  inside the stroke.
- *Chikari*: the same string model (with its own, unchanged, brighter tone) at
  D5 and D6, lighter and duller, struck together between the melody notes:
  full on 0.25, 1.25, 2.25, light (vel 0.45, about 6–7 dB below in the
  3–9 kHz band) on 0.75, 1.75, 2.75; all damped at 3.0.
- *Taraf*: four harmonics with a 60 ms swell and long ring at each note the
  main string comes to rest on, very quiet.
- *Taraf whisper* (bar 3): the same four harmonics and decays, no pluck; a
  raised-cosine swell that is full 40 ms after the beat, then the ring, let
  go over the last 0.45 s of a 1.2 s buffer. One buffer per pitch, made in
  `prepare()`; `LEVEL.whisper` 0.021, pan 0.18 (where the lute was set down).
- *Tabla*: the dayan at D4 with harmonic modes 1–5 (rim "na", "tin", open
  "tun", dry "ti"/"ra" with t60 under 0.05 s) plus a bandpassed hand slap; the
  bayan "ge" at 92 Hz rising 32 % under the heel (time constant 0.11 s), and
  the closed "ka".
- *Tanpura*: additive, up to 36 harmonics, each upper partial blooming in
  turn (later for higher partials), soft 12 ms pluck.
- *The lute set down*: four heavily damped wooden modes (148–610 Hz) and a
  low thud, then three slack strings (D3, A3, D4, slightly flat) touched in
  turn within 41 ms, gone in about 0.3 s.
- *Room*: one reverb, 1.0 s, t60 0.7 s, send 0.16 (a garden pavilion).

**Levels**: -18.9 LUFS, peak -8.7 dBFS alone (at film 50.017, the choked E);
centroid 1021 Hz (the sitar alone 1111 Hz, -19.5 LUFS). 45 events, at most
34 alive. With the bike: -18.8 LUFS, peak -8.2 dBFS, both crossings ok.
`lead` is one sitar stroke with the same tone as the part's sitar (buffers for
A3…D5 of D major made in `prepare()`, others on first use), still played with
only `ev.midi`, `ev.dur`, `ev.vel`; `leadOctave: 0`.
`bike: { bell: 1, chain: (u) => (u < 3 ? 0.8 : 1.6) }`.

**Unsure**: whether the brightness now reads as a sitar's nasal buzz or as a
plain formant: it comes mostly from 1–2 kHz (the third harmonic of the A4
stroke is as loud as the fundamental), while the sustain above 2 kHz stays
short; the 1.1–1.2 kHz centroid is the reviewer's guess at "bright", not a
measured property of a real sitar. Whether the reverb tail and the jangle (to
about u = 3.35) read as "cut with a knife". The outro's sitar voice was
rendered alone (`--part outro --label mughal`: no errors, peak -19.9 dBFS,
0.6 dB above the first round's tone) but not checked in the full outro mix.

**After the review** (2026-11-18). Three rulings, carried out by measurement
only; nothing was listened to.
1. A less harsh sitar: nasal band 0.9 → 0.1, tilt 1.15 → 1.4, and the new
   post-bloom decay above 2 kHz (`SITAR_TONE`, used by the strokes and by
   `lead`); re-levelled (`LEVEL.sitar` 0.92 → 1.9) to -18.9 LUFS. The sitar
   alone, 2–5 kHz band rms against its loudness: 4.3 dB lower than before,
   both on the A4 stroke (0.4 s) and over bars 1–2; against its own full-band
   rms, 5.5 dB lower. The upper bands now fall from the top down after the
   bloom (before, neither 3–9 nor 5–9 kHz fell 20 dB within 0.4 s). The A4
   stroke got its own phase seed so that the part's peak stays below -6 dBFS.
2. The bend to the top B now takes 50 ms: B4 is reached at u = 2.05
   (zero-crossing pitch within the measurement's ±20-cent scatter of B4 from
   film 49.047).
3. Light chikari strokes added on 0.75, 1.75, 2.75 (vel 0.45 against 1).

**After the second review** (2026-11-18). One ruling: bright and nasal again
without the harshness. Measured only; nothing was listened to.
`SITAR_TONE` (strokes and `lead`): nasal 0.1 → 0.4, its band now narrow
(new `width` parameter of `steel`, 0.35; default 0.55, so the chikari is
unchanged) and swept 1.4 → 1.25 kHz instead of 4 → 1.7 kHz; tilt 1.4 → 1.25;
hiDecay 32 from 2 kHz kept. Re-levelled: `LEVEL.sitar` 1.9 → 1.51 (part
-18.9 LUFS, as before). Sitar alone: centroid 965 → 1111 Hz; at -19.5 LUFS
the 2–5 kHz rms on the A4 stroke (film 48.0, 0.4 s) is -30.8 dBFS, against
-26.6 for the first review's sitar brought to the same loudness (-27.2 at
-20.1 LUFS): 4.2 dB under; over bars 1–2, 4.0 dB under. A wider or higher
nasal band, or a lower tilt, gave centroids up to 1.24 kHz but kept less than
4 dB of that margin.

**After the acceptance check** (2026-11-18). The silence after the choke no
longer lasts to the frame. Measured only; nobody has listened, the arranger
included.
1. The choke at u = 3.0 and the silence 3.0–4.0 are unchanged: the render is
   identical to the one before this round up to film 51.0 (largest
   difference -132.5 dBFS, float rounding). From u = 4.0 the six notes of the
   tune's last bar sound on the lute's sympathetic strings alone (new
   `whisper` voice, see above): no pluck, scrape, tabla, tanpura or chikari
   after 3.0. Each note's fundamental band reaches 90 % of its level 35–45 ms
   after its beat (scratch `dev/audio/mughal-r3-notes.mjs`; this includes the
   measuring filter's own delay). In the part alone the rms of film
   51.0–52.9 is -42.3 dBFS against -22.1 dBFS for film 47.5–49.9: 20.2 dB
   under (`audio-probe`). Pitch, as the check reads it, alone and with the
   bike: F#4 -0.1/-0.2, E4 -0.8, D4 -0.6, B3 -0.2, A3 -0.2, B3 -0.5 cents,
   each the strongest partial in its window (strength 0.0 dB) in both renders.
   Bell room: -91.7 dBFS in 1.8–9 kHz before the next crossing; the crossing
   cue at film 53.0 with the bike stays ok (rise 62 dB, before 117 dB from
   silence). Soft cue at 4.0 in 340–400 Hz: +19 ms alone and with the bike
   (the chain alone in that band would read +3 ms, so the reading is the
   whisper's). The join render film 45–55 has nothing out of tolerance;
   Section 9's notes under the last ring read in tune.
2. This brief: "does not come back" and "the tune's last bar is left
   unplayed" are gone; "The idea", "The three bars", "Hand-over", "Check" and
   "As built" say what now happens.

Unsure: whether the whisper reads as strings sounding by themselves or as
someone playing softly; whether -42 dBFS is audible over the chain at 1.6 in
the full mix (the pitch check finds every note, which is all that was
measured); the six notes ring into each other and into Section 9's first
second (the last is gone at u = 6.95), which beats faintly in the waveform.
