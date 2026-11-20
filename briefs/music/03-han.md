# Music · Section 3 · 汉画像石拓片 · Han Stone Relief Rubbing

| | |
|---|---|
| Film time | 17.0 s – 23.0 s |
| Part file | `audio/parts/03-han.js` (`node tools/audio.mjs --section 3 --check`) |
| Owner's brief | "Han Dynasty: Bronze bells" |
| Loudness target | -19 LUFS |
| Scale | major (D E F# A B) |
| Picture | `briefs/03-han.md`, `src/scenes/han.js`; `briefs/CUES.md`, "Section 3" |

## The idea

Court music for a procession of carriages, on a rack of bronze bells. The
pelican is in the procession and nobody has remarked on it. In bar 2 an ink
pad dabs the paper four times and four characters appear, one per beat:
此 鹈 鹕 车. Each dab is a great bell.

## Instruments

- **Chime bells** (bianzhong): the tune, at written pitch (D4 … B4). A chime
  bell is short for a bell: its almond shape stops the ring in a second or
  two. Partials are not harmonic (a strong fundamental, then partials near
  2.0, 3.0, 4.2 and 5.4 times it, each a slightly split pair that beats
  slowly), struck with a wooden mallet (a soft knock in the attack).
- **Great bells** (bo): the same anatomy an octave or two lower (D3 down to
  D2), ringing two to three seconds. For the four dabs only, and one on the
  first downbeat.
- **Stone chimes** (bianqing): thin slabs of stone. A clear dry "ting", high
  (an octave above the tune), half a second. They double the skeleton notes.
- **A drum** on the bar lines, soft and deep.
- **Hooves**: the horses trot, two footfalls to each half-second stride, so
  the procession clops in eighths: soft hollow knocks at two alternating
  pitches, several horses slightly out of step with each other. A quiet bed,
  not a drum part.
- **A hall**: about 2.2 s.

## The three bars

| u | Picture | Sound |
|---|---|---|
| 0.0 | The pelican joins the procession | A great bell (D3) and the drum on the downbeat. The tune on the chime bells, stone chimes on the skeleton notes, hooves under it |
| 2.0 | Dab 1: the pad lands, 此 appears | **Great bell, D3**, with the soft damp thud of the pad. The tune's B4 above it |
| 2.5 | Dab 2: 鹈 | **Great bell, B2.** The tune's A4 |
| 3.0 | Dab 3: 鹕 | **Great bell, A2.** The tune's held E4 |
| 3.5 | Dab 4: 车. The label is complete | **Great bell, D2**, the deepest, under the held E |
| 4.0–5.75 | The procession moves on | Bar 3 of the tune, chime bells and stone chimes, hooves, the drum on 4.0 |

The pad appears 0.034 s before each dab and has settled by +0.05: the bell
belongs exactly on the beat.

Declare cues at u = 0, 2.0, 2.5, 3.0 and 3.5.

## The bicycle here

`bike: { chain: 0.7, bell: 1 }`: the hooves carry the eighths.

## Hand-over

In: Section 2's harp. Out: Section 4 is a pipa, quick and dry. The great bell
of dab 4 (u = 3.5) must have died to -50 dBFS by u = 8: choose its ring
accordingly.

## Check

- The probe on a chime-bell note shows partials that are not whole multiples
  of the fundamental, and slow beating.
- The four great bells stand on 2.0, 2.5, 3.0 and 3.5 in the picture, each
  lower than the last.
- The lead notes measure in tune at their fundamentals (a bell's strongest
  partial must be the written note).

## As built

Nothing here was listened to. Everything was checked by measurement
(`--check`, `--with bike --check`, `--from 15 --to 25 --check`,
`audio-probe`) and by looking at `out/audio/s03.png`.

**What plays** (u in seconds; film time = 17 + u):

| u | Sound |
|---|---|
| 0.0 | Chime bell D4, stone chime D5, drum, first hoof; great bell D3 (vel 0.7) at +9.5 ms |
| 0.5–1.75 | Chime bells E4 F#4 A4 F#4 A4; stone chime A5 on 1.0 |
| 2.0 | **Great bell D3** and the pad thud on the beat; drum (softer, 0.6) and stone chime B5 at +4 ms, chime bell B4 at +10 ms |
| 2.5 | **Great bell B2** and pad thud on the beat; chime bell A4 at +14 ms |
| 2.75 | Chime bell F#4 |
| 3.0 | **Great bell A2** and pad thud on the beat; chime bell E4 at +9 ms (struck a little softer, 0.82: the great bells have the beat), stone chime E5 at +14 ms |
| 3.5 | **Great bell D2**, pad thud, under the ringing E |
| 4.0–5.75 | Chime bells F#4 E4 D4 B3 A3 B3; stone chimes F#5 (4.0) and B4 (5.0); drum on 4.0 |
| 0–5.75 | Hooves on every eighth: three horses, 0, +13 and +26 ms behind the grid, fore and hind feet at two pitches |

Nothing begins after u = 5.776 (the last hoof). The great bells and the hall
ring on past u = 6; the file is at -88 dBFS by u = 8.

**How each sound is made** (all buffers computed in `prepare()`, 0.13 s):

- *Chime bell*: `modal()` partials at 1, 2, 3, 4.2 and 5.4 times the note
  (amplitudes 1, 0.42, 0.26, 0.24, 0.15; t60 1.9, 1.2, 0.6, 0.5, 0.32 s), each a
  pair 0.7–2.3 Hz apart with the weaker partner at 16–30 % (slow, shallow
  beating; the fundamental reads in tune), partials started at spread phases
  (lower peak for the same loudness), plus a 6 ms band-passed noise knock at
  1.3 kHz for the wooden mallet. The rack is panned low-left to high-right
  (±0.35). Measured: decays about 45 dB per second; probe on D4 shows 294,
  587, 880, 1233 (4.2×) and 1584 Hz (5.4×).
- *Great bell*: the same anatomy at D3, B2, A2, D2, t60 2.6 s for the
  fundamental, a 3 ms attack and a softer, lower knock (420 Hz, 18 ms) for a
  padded beam. D3 and B2 have partials 1, 0.5, 0.3, 0.2, 0.12; A2 and D2
  have stronger second and third partials (0.85 and 0.55), so that a small
  speaker that cannot give 110 or 73 Hz still gives 220/330 or 147/220 Hz,
  and are normalised 2 dB higher (peak 1.13 against 0.9) so that their
  fundamentals lose nothing to the extra partials. Level 0.38.
- *Stone chime*: fundamental (t60 0.55 s) with a weak twin 0.12 % higher (about 1 Hz), weak
  2.76× and 5.40× partials (free-bar ratios, 0.2 and 0.08 s), and a 3.6 kHz
  tick of the mallet. Panned 0.22.
- *Drum*: four membrane modes (1, 1.59, 2.14, 2.65) of a 66–68 Hz skin whose
  pitch sags 22 % → 0 over 40 ms, plus a felt thud (doubly low-passed noise).
- *Hooves*: a hollow knock (640 or 545 Hz, t60 12 ms; ×1.73 overtone, 8 ms:
  a few cycles, an unpitched 'tok') over a 190 Hz ground thump (50 ms) and a
  1.8 kHz grit burst; each horse 3 % apart in pitch.
- *Pad*: 90 ms of doubly low-passed noise (380 Hz) and a 140 Hz damped body.
- *Hall*: `k.reverb("han/hall")`, 2.2 s, t60 2.0, send 0.28.

**Level**: -19.2 LUFS alone, peak -6.5 dBFS (at 20.037, the attacks of dab 3).
With the bike: -19.1 LUFS, peak -6.5 dBFS (also at 20.037; at the crossing
-6.55 at 17.009), both crossings ok. With the neighbours (15–25 s): -6.2 dBFS
at the crossing (17.009), every cue ok; that render's peak, -5.8 dBFS, is at
Section 4's downbeat (23.021; -6.1 there without this part). **Cues**: 0, 2.0, 2.5, 3.0,
3.5; the dab cues listen in 55–170 Hz (the last one in 55–95 Hz, below the
higher great bells still ringing). `lead` is the chime bell (buffers ready
for every D-major pitch B1–D7), `leadOctave: 0`, `bike: { chain: 0.7, bell: 1 }`.

**Unsure / not done**

- The hooves follow this brief (eighths, small offsets) and not the picture:
  `briefs/CUES.md` reads the visible horses landing at u = 0.083 + 0.25k and
  0.167 + 0.25k, never on the grid; only the outriders, mostly off screen,
  land on it. Landing the hooves 83–167 ms off the beat would read as sloppy
  against the bells, so they stay on the grid.
- The pad thud plays on all four dabs (the brief names it at dab 1 only).
- The peak is the limit of the level, and the spread of the attacks on the
  dabs was chosen by measurement. The chime bell, the stone chime an octave
  above it and the great bell's partials are coherent (E4 is the third
  partial of A2, B5 the octave of B4), so the peak of their sum depends on
  their offsets to a millisecond: over a sweep of 4–25 ms it ran from -7.3 to
  -2.2 dBFS. The chosen offsets give -6.8, -6.9 and -6.5 dBFS on 2.0, 2.5
  and 3.0. Moving any of them, or any level on the dabs, needs the sweep
  again (`dev/audio/han-winpeak.mjs`). The same holds at the crossing: the
  downbeat great bell's 9.5 ms sits in the middle of a plateau (9.0–10.25 ms)
  where the crossing peaks at -6.55 dBFS with the bike; at 8.75 or 10.5 ms it
  is about -6.2, at 11–12 ms -4.6 (`dev/audio/han-r2-sweep.mjs`).
- Whether the bells sound bronze rather than glassy, and whether the hooves
  read as hooves, cannot be known without listening.

**After the review** (2026-11-18, the director's rulings on
`REVIEW-03-han.md`):

- The great bells went up 4 dB (0.24 → 0.38), and A2 and D2 got stronger
  second and third partials. Great bell against chime bells, rms over the
  0.4 s after each dab (`--label` renders): 2.0 -6.3 → -2.4 dB, 2.5 -5.3 →
  -1.3, 3.0 -5.9 → -1.0, 3.5 +6.9 → +11.8. Above 140 Hz the great bells
  gained 4.0, 3.9, 6.9 and 8.1 dB on the four dabs; the A2 and D2
  fundamentals 3.7 and 3.9 dB.
- To keep the peak below -6 dBFS, the players around the dabs on 2.0, 2.5
  and 3.0 strike 4–14 ms behind the great bell (which stays on the beat
  with the pad); no level came down. Peak -6.4 → -6.5 dBFS alone.
- The hoof knocks ring for 12 ms (t60, was 45) and their overtone 8 ms (was
  25): one strike now falls 20 dB in about 6 ms (was 40). The hooves are
  1.3 dB quieter over the section (rms -46.1 → -47.4 dBFS); their gain was
  not changed.
- Nothing else moved: the notes, the times off the dabs, the other levels,
  the `lead` export, the cues.

**After the second round** (2026-11-18, head-room at the first downbeat):
the great bell on u = 0 came down from vel 0.85 to 0.7 and strikes 9.5 ms
behind the chime bell, drum and stone chime (it was on the beat). Vel 0.7
alone was not enough (with the bike, -5.6 → -5.7 dBFS at 17.028: that
sample is mostly the bicycle's bell, chime, stone and drum); with the 9.5 ms
the crossing peaks at -6.55 dBFS with the bike (17.009, before the great bell
starts), -6.2 with the neighbours (was -5.8). The four dabs, every other
note, time and level, the cues and the `lead` export are unchanged.
