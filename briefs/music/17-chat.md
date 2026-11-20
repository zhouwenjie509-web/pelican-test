# Music · Section 17 · 早期聊天窗口 · Early Chat Window

| | |
|---|---|
| Film time | 101.0 s – 107.0 s |
| Part file | `audio/parts/17-chat.js` (`node tools/audio.mjs --section 17 --check`) |
| Owner's brief | "Chat Window: MIDI-ringtone style. Original message notification sounds serve as percussion." |
| Loudness target | -21 LUFS |
| Scale | major (D E F# A B) |
| Picture | `briefs/17-chat.md`, `src/scenes/chat.js`; `briefs/CUES.md`, "Section 17" |

## The idea

The tune as somebody's ring-tone, around 2003: bright, thin, cheerful, every
note exactly on the grid. The drum kit is the messenger program itself: its
own little notification sounds keep the beat. Then "对方正在输入…" goes out
and nothing arrives, and the music waits with us. What arrives is a window
shake.

## Sounds

Dry, close, no reverb. Three or four voices at most.

- **The ring-tone lead**: a plinky two-operator FM tone, somewhere between a
  toy piano and a marimba, with a bright start that dulls quickly. The tune
  an octave up (D5 … B5; `leadOctave: 1`). Every note the same loudness.
- **A thin second voice** (a hollow square-ish tone): the harmony, in
  eighths.
- **A rubbery FM bass** on the roots.

The program's sounds, all invented for this film. None may resemble any real
messenger's, phone's or system's sound:

- **Message in**: two soft wooden FM notes, the second a sixth above the
  first, 70 ms apart. It is the backbeat (beats 2 and 4).
- **Key tick**: a tiny click with a 10 ms blip. It is the hi-hat (eighths).
- **Nudge**: a rattling buzz for the window shake: ten short harsh blips,
  twenty a second, alternating between two pitches a tritone apart, each
  quieter than the last.
- **Alert ping**: one soft high ping.

## The three bars

| u | Picture | Sound |
|---|---|---|
| 0.0 | The GIF of the pelican plays in the chat window. "对方正在输入…" is showing | Ring-tone: bar 1 of the tune, with the program's sounds as its drums |
| **2.0** | **The typing notice goes out.** The strip is blank | **Silence.** Everything stops on the bar line: the tune's top note is not played. Half a bar of nothing (the chain is heard) |
| 2.5 | "对方正在输入…" comes back | The ring-tone picks up where it would have been: A, F#, a little quieter, ticks only |
| **3.0** | **Window shake**: ten jumps at twenty a second (3.00–3.45). The task button flashes on alternate eighths (3.0, 3.25, 3.5, 3.75) | **The nudge**, 3.00–3.45, on the strong beat. An alert ping at 3.0, 3.25, 3.5 and 3.75. The lead holds the tune's E, and for as long as the window shakes the note shakes with it (a wobble of about 30 cents, twenty times a second) |
| 3.5 | The shake is over; the notice comes back | The E steadies |
| **4.0** | We type **？** into the box. It is never sent | **One key tick, alone and a little louder**, with the tune's F# |
| 4.0–5.75 | The GIF plays on | Bar 3 of the tune with the full kit of notification sounds. The bell takes the D |

Declare cues at u = 0, 2.5, 3.0 and 4.0. Use the probe to confirm that
between 2.0 and 2.5 your part is silent (below -60 dBFS).

Mark the shaking E `free: true`.

## The bicycle here

`bike: { chain: 0.8, bell: 1 }`.

## Hand-over

In: Section 16's chip music ends dead. Out: Section 18 is a cassette tape
that arrives fast and sinks. No tails: a ring-tone stops when it stops.

## Check

- The probe on a lead note: an FM tone (partials at whole multiples whose
  balance changes in the first 100 ms), fast attack.
- The picture: a clean gap from 2.0 to 2.5; ten evenly spaced marks from 3.0
  to 3.45; a single mark standing alone at 4.0.
- Nothing recognisable: play the listener's game against yourself and
  change anything that could be named as a real program's sound.

## As built

Nothing here was listened to. Everything was checked by measurement
(`--check`, `audio-probe`, a scratch pitch reader `dev/audio/chat-wobble.mjs`)
and by looking at `out/audio/s17.png`.

**What plays (u, seconds).** All buffers are computed in `prepare()`; dry, no
reverb; one bus gain (0.56).

| u | Sound |
|---|---|
| 0.00–1.98 | Lead D5 E5 F#5 A5 F#5 A5 (every note vel 1; the A5 at 1.75 is cut at 1.98). Hollow voice F#4/A4 alternating on every eighth (0.18 s each). Bass D2 in the pedal cell: 0.0 (0.45), 0.5, 0.75, 1.0 (0.45), 1.5, 1.75 (0.2 each). Key ticks on every eighth (off-beats at 0.7). Message in at 0.5 and 1.5 (knock on the beat, B6 at +35 ms, D6 at +105 ms). |
| 2.00–2.50 | Nothing of this part (probe: -inf dBFS from 2.0 to 2.5). The B5 is not played. Only the bicycle chain sounds. |
| 2.50, 2.75 | Lead A5, F#5 at vel 0.75, with a key tick each. Nothing else. |
| 3.00–3.98 | Lead E5, `free: true`: its pitch follows the window's shake table (dx −6 6 −5 5 −4 4 −3 2 −2 1, one step per 50 ms) as 15·dx/6 cents, slewed over 3 ms; measured −12.5/+12.5 cents at first, ±2 by 3.45, steady (0.0) from 3.5. The nudge: ten blips at 3.00, 3.05 … 3.45 (G#3 and D4 alternating, each 0.84 of the one before; measured as ten separate bursts, −28 dB down to −42 dB). Alert pings at 3.0, 3.25, 3.5, 3.75. |
| 4.00 | Lead F#5 and our "?": a key going down (click and 2.3 kHz blip) and coming up at 4.075 (a smaller click); its broadband peak is 6.3 dB above an ordinary key tick (−23.4 against −29.7 dBFS; 2–3 kHz +6.0 dB). The bicycle's chain is silent on this beat (see Bicycle). Nothing else until 4.5. |
| 4.50–5.94 | Bar 3 with the full kit: lead E5 D5 B4 A4 B4 (last note ends 5.94); hollow A4 F#4 G4 D4 E4 C#4 on eighths (D/F#, G, A); bass F#2 F#2 G2 A2 A2; ticks on every eighth; message in at 4.5 and 5.5 (its D6 ends by 5.88). Nothing of this part sounds after 5.94 (probe: -inf dBFS in 1.8–9 kHz from 5.97 to 6.0). |

Cues declared: 0 (chat window through the frame), 2.5 (notice back), 3.0
(nudge, band 150–450 Hz), 4.0 (the "?" key, band 5–12 kHz). All read "ok".

**How each sound is made.**

- Lead: two-operator FM, modulator ratio 1 (all partials whole multiples),
  index 2.7 → 0.5 with a 35 ms time constant, level 0.6·e^(−t/0.12) +
  0.4·e^(−t/1.5) after a 1.5 ms rise. Probe: 2nd harmonic 2 dB above the
  fundamental in the first 80 ms, 11 dB below it at 150 ms. One 1.6 s buffer
  per pitch of D major, cut with a 20 ms fade. It is also the outro `lead`
  (`leadOctave: 1`).
- Hollow voice: odd harmonics 1, 3, 5, 7, 9 at 1/k (below 5 kHz), one-pole
  lowpass 3.5 kHz, decays to 45 %.
- Bass: FM ratio 1, index 3.9 → 0.9 (50 ms), pitch falls 60 cents in 12 ms,
  one-pole lowpass 1.4 kHz.
- Message in: a soft unpitched wooden knock on the beat (white noise
  band-passed at 1.1 kHz, 10 ms decay, plus a rap at 2.7 kHz, 4 ms decay; the
  probe finds no dominant partial between 570 Hz and 2 kHz), then two wooden FM
  notes (modulator 3.5×, index gone in ~10 ms, 45 ms decay) falling a sixth: B6
  at +35 ms, D6 70 ms after it. 2 ms fade-ins.
- Key tick: 1.5 ms of noise band-passed at 6.5 kHz plus a 10 ms 2.6 kHz blip.
- The "?" key: key down = noise band-passed at 7 kHz (2 ms rise, 1.5 ms decay)
  with a 2.3 kHz sine blip (2 ms rise, 7 ms decay, faded out by 25 ms); key up
  at +75 ms = noise band-passed at 4.5 kHz, same click shape, 0.8 of the
  level. Its own buffer, gain 0.2 (a key tick is 0.11).
- Nudge: harmonics of G#3 / D4 at 1/k up to 4 kHz, a raised-cosine taper to
  zero at 6 kHz, normalised and lightly saturated (tanh, drive 0.6), 38 ms
  blips every 50 ms, 2 ms fade-ins. Probe on the first blip: k = 5 −14.4 dB
  (1/k: −14.0), k = 8 −18.5 (−18.1), k = 17 −25.2 (−24.6), 4.78 kHz −30.9,
  5.40 kHz −37; nothing above 6 kHz among the strongest partials.
- Ping: A6 sine with a quickly fading trace of its third harmonic, 90 ms decay.

**Bicycle.** `bike: { bell: 1, chain: (u) => (Math.abs(u - 4) < 0.06 ? 0 : 0.8) }`:
the chain is 0.8 everywhere except the tick at u = 4.0, which is not played
(bike events 435 → 434; the chain alone is −inf dBFS from 104.995 to 105.035).
With the bike, both crossings (101.0 and 107.0) read "ok".

**Choices and doubts.**

- "4.0–5.75 Bar 3 with the full kit": the kit (bass, hollow voice, ticks,
  message in) re-enters at 4.5, so that the "?" tick at 4.0 stands alone with
  the F#, as the 4.0 row asks.
- From 3.0 to 4.0 only the lead E, the nudge and the pings sound (no bass or
  hollow voice): the music waits.
- The brief's 3.5 row ("the shake is over") is consistent with the code: the
  last jump is at 3.45 and the window is at rest at 3.5.
- The "message in" (a knock, then a falling major sixth, wooden) and the
  tritone nudge are invented; I know no real program sound built this way, but
  that is a judgement, not a measurement.
- Levels (alone: lead -22.5 LUFS, bass -26.8, hollow voice -30.9, the program sounds lower still) were set by
  measurement only; whether the hollow voice and the ticks are audible enough
  in the mix was not heard.

**After the review** (2026-11-18, the music director's rulings; still
nothing listened to):

- The "?" at u = 4.0 is its own sound, a key going down and coming up (two
  clicks, 75 ms apart, with a 2.3 kHz blip on the first), 6.3 dB above a key
  tick at its peak, and the bicycle's chain is silent on that beat. With the
  bike, the 4–12 kHz peak at the eighths reads 3.25 −35.7, 3.5 −34.6,
  3.75 −38.9, **4.0 −27.1**, 4.25 −40.3 dBFS (before: 4.0 −30.6 with the
  chain tick under it, 4 dB above its neighbours; now 7.5 dB above the
  loudest of them).
- "Message in" is no longer a rising two-note chime: a soft unpitched wooden
  knock on the beat, then B6 and D6 falling a sixth, 70 ms apart. Its level
  alone is unchanged (−33.1 LUFS, peak −23.0 dBFS; before −33.0 / −22.9).
- The nudge is harsher: 1/k harmonics to 4 kHz, tapered to 6 kHz, with the
  saturation lowered so that it does not regrow partials above the taper.
  1–4 kHz is 20 dB up on the first blip (peak −22.7 against −43.3 dBFS);
  8–16 kHz is no higher than before (rms −68 against −66 dBFS). Its gain was
  set so that its loudness alone is unchanged (−30.7 LUFS, before −30.6; peak
  −19.1, before −20.0). Still ten separate bursts.
- Fades (finding 3): message in and nudge now fade in over 2 ms; the new "?"
  clicks rise over 2 ms. The ordinary key tick (0.3 ms) and the lead (1 ms
  under a 1.5 ms rise) were left as they were, so that the `lead` export the
  outro plays is unchanged.
- Unchanged: every other note, time and instrument of the score (the "?"
  event at 4.0 is the only one replaced), the part's level
  (−21.0 LUFS), the lead's tuning, the silence from 2.0 to 2.5 and the bell's
  band before u = 6.
