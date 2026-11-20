# Music guide: how to arrange a part

This guide is for whoever writes one part of the soundtrack (Stage 4). Read it
all before you write a note. Your own music brief (`briefs/music/NN-id.md`)
says what your part plays; this guide says how every part is built, what it
must never do, and how to check it. Nobody on this project can listen:
everything is checked by measurement and by looking at pictures of the sound.
That is why the rules are strict.

Related reading: the owner's brief (`briefs/PROJECT_BRIEF.md`, the sections
"Music" and "Rhythm and Duration"), the art brief of your section
(`briefs/NN-id.md`), and your section's entry in `briefs/CUES.md` (what is
seen and when, read from the finished scene code).

## 1. What the soundtrack is

One tune, three bars long, like a section. Every section plays it on the
instruments of its own time and place, the way every section paints the same
pelican. The tune does not stop at a picture frame. Its last note is the
tonic on the next downbeat, and that note is played by the bicycle bell and
by the next section's instrument: the phrase passes through the frame as the
pelican does.

Two sounds belong to the pelican and never change: the bell, which rings on
every crossing, and the chain, which ticks four times for each turn of the
pedals (it is read from the picture's own crank angle). They are one part,
`audio/parts/bike.js`. It is also the smallest complete example of a part:
read it.

The humour is deadpan, as in the picture. A joke in sound is a precise small
thing done with a straight face. Nothing is funny because it is badly made.

## 2. The numbers

- 120 BPM, 4/4. A beat is 0.5 s, a bar 2 s, a section 3 bars = 6 s = 12 beats.
- Section n (1..20) runs from film time `5 + 6(n-1)` to `5 + 6n` seconds.
  `u` is seconds since the section began, the same `u` as in the scene code.
  Bars begin at u = 0, 2, 4. The joke's strong beats are u = 2.0 and u = 3.0.
- The intro is film time 0 to 5 (the sketch sets off at 3.0), the outro 125 to 137.
- Key: D major, A4 = 440 Hz. The tune uses five notes: D E F# A B.
- Sample rate 48 kHz, stereo.

### The tune

| beat | u (s) | length (s) | note | step |
|---|---|---|---|---|
| 0 | 0.00 | 0.50 | D4 | 1 |
| 1 | 0.50 | 0.25 | E4 | 2 |
| 1.5 | 0.75 | 0.25 | F#4 | 3 |
| 2 | 1.00 | 0.50 | A4 | 5 |
| 3 | 1.50 | 0.25 | F#4 | 3 |
| 3.5 | 1.75 | 0.25 | A4 | 5 |
| 4 | 2.00 | 0.50 | B4 | 6 |
| 5 | 2.50 | 0.25 | A4 | 5 |
| 5.5 | 2.75 | 0.25 | F#4 | 3 |
| 6 | 3.00 | 1.00 | E4 | 2, held |
| 8 | 4.00 | 0.50 | F#4 | 3 |
| 9 | 4.50 | 0.25 | E4 | 2 |
| 9.5 | 4.75 | 0.25 | D4 | 1 |
| 10 | 5.00 | 0.50 | B3 | 6 below |
| 11 | 5.50 | 0.25 | A3 | 5 below |
| 11.5 | 5.75 | 0.25 | B3 | 6 below |
| 12 | 6.00 | | D4 | the next section's first note, and the bell |

Its rhythm is one cell, long-short-short, repeated: one turn of the pedals.
Bar 1 climbs. Bar 2 reaches the top on its downbeat (u = 2.0) and then holds
its breath on E from u = 3.0: that held note is where your section's joke
lands, and you may bend it, break it, stop it or bury it, as your brief says.
Bar 3 walks down and round to the tonic.

`s.theme()` gives these notes ready to schedule (`audio/engine/theory.js`).
Options: `scale` (`"major"`, `"minor"` = D E F A Bb, `"in"` = D Eb G A Bb,
`"slendro"`, or five semitone offsets of your own), `octave`, `tonic`. The
notes on beats 0, 2, 4, 6, 8 and 10 are the skeleton (`note.skeleton`): a
slow instrument may play those alone.

Plain harmony, for the sections that use chords (`theory.HARMONY`):
`| D . . . | G . A . | D/F# . G A |`. You may reharmonise in your idiom.

### What every part must keep

1. **The tune is recognisable.** Whatever you ornament, the skeleton notes
   sound at their beats (unless your brief breaks one on purpose). Mark the
   melody notes `{ lead: true }` so the checker can measure their pitch.
2. **Your first sound is at u = 0 exactly**, the downbeat on which the pelican
   comes through the frame, and never earlier. (A slow instrument may begin
   its later notes a little early so that they are heard on the beat. Not the
   first one.)
3. **The tonic at u = 6 is not yours.** Your phrase ends on the last eighth
   (u = 5.75). The bell and the next part play the D. Leave the bell's
   entrance clear: in the last 30 ms before u = 6 nothing of yours is loud
   between 1.8 and 9 kHz.
4. **You are over by u = 8.** Nothing new begins after u = 6; what is still
   ringing must be below -50 dBFS two seconds later.
5. **Bar 2 hits the picture.** The times in your brief come from the finished
   scene code. Use them exactly, and declare each with `s.cue(u, what)`.

## 3. A part file

One file per part in `audio/parts/`. Its default export:

```js
export default {
  // optional: compute buffers once, before anything plays (may be async)
  async prepare() {},

  // optional: build the part's effects for one audio context. `out` is the part's own
  // output (already at its mix level). Whatever you return is merged into `g`,
  // the object handed to every one of your events (g.out is always there).
  graph(k, out) {
    const room = k.reverb("mypart/room", { seconds: 1.8, bright: 0.5 });
    const send = k.gain(0.25);
    send.connect(room).connect(out);
    return { send };
  },

  // required: list what sounds when. Plain arithmetic only; see below.
  score(s) {
    for (const note of s.theme()) s.note(myString, note.u, note.dur, note.midi, 0.8, { lead: true });
    s.cue(0, "the pelican comes through the frame");
  },

  // sections: one note of your part's own voice. The outro plays every section's voice together.
  // It calls lead(k, g, when, ev) with only ev.midi, ev.dur and ev.vel set, any pitch of the
  // major scale, and with a `g` built by your own graph(): it must work with just that.
  lead: myString,
  leadOctave: 0,     // the octave your voice plays the tune in, relative to D4

  // the bicycle's own sounds while your part is on screen (default 1 each; the intro's count too).
  // A number, or a function of u. bell is the bell at the START of your part.
  bike: { chain: 1, bell: 1 },
};
```

An instrument is a function `(k, g, when, ev)`: `k` is the Kit, `g` your
graph, `when` the audio-context time at which the event sounds, `ev` the
event (`ev.midi`, `ev.dur` in seconds, `ev.vel` 0..1, and anything you passed).

```js
function myString(k, g, when, ev) {
  const buf = k.buffer(`mypart/string/${ev.midi}`, () => pluck({ f: hz(ev.midi), seconds: 1.8, bright: 0.5 }));
  const { out } = k.play(buf, when, { gain: 0.4 * ev.vel, pan: -0.2 }, g.out);
  out.connect(g.send);
}
```

### The Score (`audio/engine/score.js`)

- `s.note(inst, u, dur, midi, vel, more)`: a note. `more` may carry anything
  (`lead: true`, `free: true` for a lead note that bends on purpose, `label`,
  your own fields).
- `s.at(u, play, data)`: any sound. `data.dur` is its length.
- `s.theme(options)`: the tune as notes `{ beat, u, dur, midi, step, skeleton }`.
- `s.beat(b)`: seconds for beat number b.
- `s.ridden(beat)`: for the two sections whose pelican changes speed (2 and
  12): the `u` at which the pedals have turned as far as they would have by
  `beat` at the standard pace. Notes scheduled at `s.ridden(beat)` slow, wait
  and hurry with the wheels and still arrive at the frame on time.
- `s.pelican(u)`: `{ x, turns, crank, speed }` of the pelican at u (speed 1 =
  standard pace).
- `s.cue(u, what, { soft, band })`: declare a moment where sound must meet
  picture. The checker measures whether your sound really begins there:
  within 15 ms, or 60 ms if you mark it `soft: true` (a swell). `band: [lo, hi]`
  makes it listen in that band only.
- `s.n`, `s.t0`: the section number and its film time. `s.parts`: all parts
  (the outro uses it to reach the sections' `lead`).

`score()` is called in Node as well as in the browser, to print and check
the list. It must not touch Web Audio, the DOM or any buffer.

### The Kit (`audio/engine/kit.js`)

Read the file; it is short. In brief:

- `k.buffer(key, make)`: a cached AudioBuffer; `make` returns a Float32Array
  (or one per channel). Keys are global: begin yours with your part's id.
- `k.play(buffer, when, { offset, dur, rate, detune, gain, pan, loop, fade }, dest)`
  returns `{ src, out, gain }`.
- `k.osc(type, freq, when, stop, detune)`: type is `"sine"`, `"square"`,
  `"sawtooth"`, `"triangle"` or a `k.wave(key, sines, cosines)`.
- `k.lfo(freq, when, stop, phase)`: a slow sine for vibrato or tremolo that
  starts at a chosen point of its cycle (0..1). Give each player of a section
  a different phase, or their vibratos move as one and the pitch reads sharp
  or flat while it fades in.
- `k.noise("white" | "pink", when, stop, { phase, rate, seed })`: seeded noise.
- `k.constant(value, when, stop)`.
- `k.gain(v)`, `k.filter(type, freq, q, gainDb)`, `k.pan(p)`, `k.delay(s)`,
  `k.shaper(key, fn)`, `k.reverb(key, options)`, `k.chain(a, b, c)`.
- `k.env(param, when, [[dt, value, shape], ...])` and
  `k.adsr(param, when, dur, { a, d, s, r, peak })`. In `env`, a point after a
  `["target", tau]` point must be `"set"` or another target: Web Audio draws a
  line from where the parameter was before the approach began.
- `k.wave` scales a wave so that its highest point is 1, so its level depends
  on the phases of its harmonics. Oscillators that start together start in
  phase and add their peaks: spread the phases (or the starts by a few
  milliseconds) and a rich tone can be louder under the same peak.
- `k.track(node)`: if you create a source node yourself, register it here.
- Three exports of kit.js for `prepare()` (they are functions, not methods):
  `prepareNoise(color, seed)` makes the long noise buffer that
  `k.noise(color, ..., { seed })` reads;
  `sharedBuffer(key, make)` fills the same cache that `k.buffer(key, make)`
  reads, so a buffer made there is ready during playback; and
  `prepareReverb(key, options)`, with the same key and options you give
  `k.reverb`, makes the room ahead of time.

A reverb from `k.reverb` has unit energy: feed it through a gain of about
0.1 to 0.35. Note that for `lowpass` and `highpass` Web Audio's own
`BiquadFilterNode` reads Q in decibels.

### Making samples (`audio/engine/dsp.js`)

Plain JavaScript on Float32Arrays at 48 kHz: `pluck` (a plucked string),
`modal` (bells, bars, anything struck: a sum of decaying partials), `white`,
`pink`, `sine`, `biquad`, `onePole`, `envelope`, `fade`, `normalize`,
`mixInto`, `saturate`, `impulseResponse`, `rng(seed)`. Write your own
synthesis beside them in your part file when you need more (a bowed string,
a blown pipe, a voice, a drum skin): any deterministic arithmetic is allowed.

Use buffers for sounds that are hard to build from nodes (strings, bells,
drums, noise shapes) and nodes for sounds that must move while they sound
(glides, vibrato, filters that open). Both are fine; both come out the same
live and offline.

## 4. Rules that cannot bend

**Everything is synthesized here.** No audio files, no downloads, no samples
of anything. No words are sung or spoken.

**The same sound on every run.** No `Math.random`, no clocks. Chance comes
from `rng(seed)`. (Two renders still differ in their last bit: where several
sounds meet, Chrome adds them in an order that changes from run to run. That
is rounding, about -126 dBFS on this film, not a difference anyone can hear;
`tools/audio-same.mjs` renders twice and tells the one from the other. Do not
call a render "byte-identical".)

**Schedule from `when`, never from the context's clock.** A play function is
called up to two seconds before its sound, at a moment that differs between
the live preview and the offline render. Every time you pass to Web Audio
must be computed from `when`. Never read `currentTime`. This is what keeps
the preview and the exported film the same sound; `tools/audio-live.mjs`
records the live graph and subtracts the offline render from it. The player
hands you `when` a millionth of a sample early, on purpose: a time meant to
fall on a sample can then never land a hair above it, where Chrome would
apply a parameter step one sample late. Add your offsets to `when`; do not
round it.

**Never a time below zero.** When a seekable sound is picked up part-way at
the very start of a render, `when - offset + offset` can come out a hair
below zero, and Web Audio refuses the sound. The Kit's own methods guard
against it; a raw `start()`, `stop()` or parameter call of yours must take
`Math.max(0, ...)`. `tools/audio-starts.mjs` begins playback at several
hundred film times and reports every sound that could not be started.

**Every source has an end.** Give every oscillator, noise and buffer a stop
time. Use the Kit's sources, or `k.track(node)` for your own, so that pausing
and scrubbing can silence them.

**No clicks.** Every envelope begins and ends at zero. Fades are at least
2 ms. Do not cut a sounding buffer. (The check reports the largest jump
between two samples. A cut shows as a jump far above everything else; a
plucked string or a noise channel can legitimately reach 0.3 to 0.5.)

**Compute ahead.** Anything that takes more than a millisecond (a buffer of
a second or more, a room) is made in `prepare()`. Keep `prepare()` under
0.4 s in all. During playback a play function only connects nodes.

**Stay in budget.** At most about 600 events, and at most about 250 sources
alive at once (the check prints the figure: sources sounding or scheduled
within the next two seconds). One reverb per part, three seconds or shorter (the vaporwave tape
has its own allowance).

**Level.** Write to your part's loudness target (`audio/mix.js`, also in your
brief), within 1.5 LU, measured over your own six seconds, alone. Peak below
-6 dBFS alone (two parts have a stated allowance, `PEAK` in `audio/mix.js`:
the short video's kick may reach -4 dBFS and the outro's tutti -4.5; nothing
else may). No DC, nothing below 30 Hz. A sound that only works in stereo
is wrong: keep it sensible in mono.

**Rights.** The tune is ours and original. Do not quote any other melody,
however old. Do not imitate any real product's sound: no real notification,
ringtone, game effect, console start-up, station ident or jingle. Invented
sounds only, and they must not be recognisable as a particular real one.

**Your files only.** You write `audio/parts/<your file>.js` and the "As
built" section of your music brief. Scratch work goes in
`dev/audio/<your id>-*.js` (or `.mjs`) or your scratchpad: scripts and notes
only. Every WAV, its `.json` and every picture goes under `out/audio/`, which
git ignores. Do not change the engine, the
tools, other parts or anything in `src/`. If you need an engine change, say
so in your report.

**Things that change over the whole part.** `graph()` has no clock. To move
a node of your graph in time (close a reverb's send at u = 6, swell a drone),
do it from an event's play function, on the node in `g`, from that event's
`when`. A buffer source's `playbackRate` and `detune` are read by Web Audio
once per 128-sample block; the engine keeps those blocks aligned between the
live preview and the offline render of the whole film, so you may automate
them.

**Seeking.** A sound longer than two seconds that a viewer would miss when
scrubbing into its middle (a drone, a bed, a tape) may be marked
`seekable: true`. Its play function is then sometimes called late, with
`ev.offset` seconds already gone: schedule against `when - ev.offset` as if
it had begun on time (envelopes land mid-way by themselves), and start
buffers at `offset`. Short notes need nothing.

## 5. Checking

```bash
node tools/audio.mjs --section 7 --check              # render your part alone, measure it, draw it
node tools/audio.mjs --section 7 --with bike --check  # with the bell and chain, as it will be heard
node tools/audio.mjs --from 45 --to 55 --check        # every part, a stretch of the film (your neighbours too)
node tools/audio.mjs --section 7 --label drum --check # one instrument alone: events whose label or function name matches
node tools/audio.mjs --section 7 --from 49.5 --to 51 --pps 800 --check   # a close look at 800 px per second
node tools/audio.mjs --print 7                        # your events as a list (no browser)
node tools/audio.mjs --lint 7                         # things a part must not do
node tools/audio-probe.mjs out/audio/s07.wav --at 48.0 --len 0.4        # partials and envelope of one sound
node tools/audio-probe.mjs out/audio/s07.wav --at 48.0 --len 1.5 --env  # ... and its level every 10 ms
node tools/audio-probe.mjs out/audio/s07.wav --at 48.0 --len 0.3 --band 2000:9000   # ... in one band only
node tools/audio-probe.mjs out/audio/s07.wav --at 48.0 --len 0.6 --track 20 --near 440 # follow a pitch through time (glides, scoops)
```

(`--part intro`, `--part outro`, `--part bike` for the parts that are not sections.)

The check prints loudness against your target, the peak and where it falls,
balance, the largest sample-to-sample step, the tail, each cue's measured
lag, the tuning of every lead note, and how quiet your part is in the bell's
band just before the next crossing. It writes `out/audio/sNN.wav`, `.json` and `.png` (the
picture is drawn only with `--check`). Give your events labels
(`{ label: "drum" }`) so that `--label` can pick an instrument out.

A lead note may carry `free: true` (it bends on purpose: not measured, and
its dotted line is not drawn) or
`tol: 25` (a wider limit in cents, for a voice that wobbles on purpose). If
your tune sounds from inside a buffer and not from note events, declare it
with silent marker events (a play function that does nothing, with
`lead: true` and the pitches) so that it is still measured and drawn.

Things that fool the measurements, so that you do not chase them:

- A note restruck at a steady rate (a tremolo, a roll) combs the spectrum at
  that rate, and the tuning can read 30 cents off although every stroke is in
  tune. Restrike on whole periods of the note, or mark the roll `free`.
- A cue is timed against the 0.1 s before it. If your own sound fills that
  time (a spread chord that begins early, a roll that grows into the stroke),
  declare the cue with a `band` in which only the cue's own sound lives.
- A panned sound is louder in one ear than the same sound in the middle
  (0.87 against 0.71 at ±0.35), and sounds that all start on one sample add
  their peaks. If the peak limit binds before the loudness target, spread the
  attacks by a few milliseconds, as players do, before you turn anything down.
- The time `prepare()` takes varies from run to run by a factor of two.
- The cue detector reports the end of its 5 ms window: about 1 ms late on a
  sharp sound, 10 ms or more on a sound that takes 30 ms to speak, and never
  early. A reading of +11 ms on a soft attack is the attack, not lateness.
- Where the music brief and the picture disagree about a time that the brief
  marks as a cue, `briefs/CUES.md` wins. Where they disagree about a rhythm
  that is not a cue (hooves, a pulse), the music brief wins: it is on the beat.

Tuning is read from the mix. A group in unison reads as its average, so keep
a section's spread to a few cents; a short low note cannot be read finely,
and the limit widens for it by itself. If a neighbour's partial sits near a
lead note the reading can be pulled: check that note with `--label`.

**Read the picture.** `out/audio/sNN.png` is a spectrogram, 200 px per second,
from one second before your section to two seconds after.

- Bright vertical lines are bar lines, labelled in film seconds; faint ones
  are beats.
- Frequency runs from 30 Hz at the bottom to 16 kHz at the top on a
  logarithmic scale, with guide lines at 100 Hz, 1 kHz and 10 kHz.
- Brightness is level, from -96 dB (black) to -12 dB (white-hot).
- In turquoise: a wedge on the top edge at every cue you declared, and a
  dotted line where the fundamental of each lead note should be. If the
  sound's lowest bright line does not lie on the dotted line, the note is
  wrong or in the wrong octave.
- Under the picture: the waveform (scaled to fill the strip) and the level
  in decibels (yellow; 0 dB at the top, -60 at the bottom).
- The picture is made with three window lengths so that low notes show
  their pitch and high sounds their timing. The seams at 400 Hz and 2.2 kHz
  are the tool's, not your sound's. Below 400 Hz time is blurred by about
  80 ms either way: read pitch there, and read timing higher up.

Look at it the way a painter looks at a contact sheet:

- Does each note start on its line? Do the bar-2 events stand where the brief
  puts them?
- Does each instrument have the anatomy of the real one? A plucked string is
  a sharp onset with partials that die from the top down. A bowed string or a
  voice has steady, evenly spaced partials with a slow start and vibrato. A
  bell or gong has unevenly spaced partials that ring for seconds. A flute is
  almost only its fundamental, with breath above. A drum is a short low thump
  with a burst of noise.
- Is anything where it should not be: a smear before the first downbeat, a
  hard vertical line where a sound was cut, a haze of hiss, a band of energy
  near the top that nothing asked for?

Use the probe to check an instrument against what you know of the real one:
which partials it has, how fast it speaks, how long it rings.

**Read your score.** `--print` shows every event. Check it as a musician
would check a written part: right notes, right beats, no two voices a
semitone apart by accident, the bass under the chord, nothing after u = 6.

You cannot hear it, so be conservative: clear, well-separated sounds in
their natural registers, moderate reverb, no extreme resonance. A plain
sound that is certainly right is better than a rich one that may be ugly.

## 6. Working

Save early: get the tune playing on your main instrument first, check it,
then add. Each time you add something, run the check again.

Work in this order:

1. Read this guide, your music brief, your section's art brief (the idea,
   "The three bars", "As built") and its entry in `briefs/CUES.md`. Look at
   one or two frames of your section if it helps
   (`node tools/shot.mjs --t <film seconds>` writes a PNG under `out/shots/`).
2. The lead instrument and the tune. Check tuning and timing.
3. The accompaniment.
4. Bar 2: the joke, on its times.
5. The hand-over at both ends: render with your neighbours
   (`--from/--to`) and look at the joins.
6. Level to target. Lint. Budget.
7. The `lead` export, `leadOctave`, the `bike` wishes.
8. Write "As built" at the end of your music brief: what plays, how each
   sound is made, the exact times, what you were unsure of.

## 7. Before you report

- `node tools/audio.mjs --section N --check` ends with "Nothing out of
  tolerance." and prints no lint. Quote its report.
- `node tools/audio.mjs --section N --with bike --check` passes too: the two
  crossing cues at your u = 0 and u = 6 read "ok" (the bell must be heard
  through your first and last sounds).
- You have looked at the final `out/audio/sNN.png` and can say what each
  thing in it is.
- Every time in your brief's cue table is in your score, and declared with `s.cue`.
- `node tools/audio.mjs --list` still shows every part loading.

## 8. Your report

Short and factual:

1. What plays, bar by bar, with times.
2. How each instrument is made (one line each).
3. The check's report, quoted.
4. What you looked at in the spectrogram and what you saw.
5. What you are unsure of, and what you could not check. Say plainly that
   nothing was listened to.
6. Any time or fact in your brief that the scene code contradicts.
