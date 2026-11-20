# Review · outro

Independent review of `audio/parts/21-outro.js` on 2026-11-18, by a reviewer who did not write the part and could not listen to it: everything below was measured, read from the score and the code, or seen in a spectrogram. The music director's rulings follow the findings.

**Verdict:** needs-fixes

The outro meets its brief in structure and timing. All twenty voices play through their own `lead` and `k.subgraph`, the voices drop out in steps at 129/130/131/132/132.5, the five flashes land within 1 ms, the piano's B A F# E falls at 133.0/133.5/133.75/134.0, and 135.0-135.4 is digital silence. The check, the bike check and lint all pass. Every lead buffer is now ready before the film plays: 0 cache misses, and no play call takes more than 1 ms. The weak point is clarity. In the second statement (131-133) the cellos' and bass's D pedal is louder than the tune. In the tutti, the held skeleton notes outweigh the running eighths in the middle octaves. The drum is pitched on A#1 (58 Hz), which is outside D major.

## Findings

### 1. Second statement (131-133): the D pedal is louder than the tune (should-fix)

- **Evidence:** Over 130.9-133.1, strings+bass alone measure -27.8 LUFS and all voices alone -28.8 LUFS (`--label "^(strings|bass)$"` vs `--label "^voice:"`, --from 130.9 --to 133.1). RMS at 132.0: voices -36.7 dBFS, whole mix -29.4. At 132.5: voices -39.5, mix -29.7. Probe of s21.wav at 132.55 (tune F#4): D4 -2.6 dB and F#4 -10.1 dB, so the pedal's octave harmonic is 7.5 dB above the tune note in the tune's own octave. At 132.05 (tune A4): D4 -3.3, A4 -9.6. At 131.55 (tune E4): D3 -0.3 against E3 -10.2, and D4 -0.4 against E4 -6.0. The brief asks for the tune again, quieter and thinning, not for a pedal that covers it.
- **Suggestion:** Bring the last CHORDS row (u 6, D3 + D2) down about 8-10 dB: velocity about 0.2 instead of 0.62×0.9, or drop the bass D2 there and keep only the cellos' D3. Then check again that at 132.05 and 132.55 the tune note is the strongest partial in its octave.

### 2. Tutti eighths are masked by held skeleton notes in octaves 3-4 (should-fix)

- **Evidence:** Voices alone (review-outro-voices.wav) at 127.55, where the tune is A4: B4 -3.6 dB against A4 -7.9, and B3 -8.2 against A3 -18.3. Only A5 (0 dB) is clear. The mix at 127.55: B4 -4.0 against A4 -7.3. The mix at 129.55 (tune E4): E4 -0.2 against F#4 -0.7, and F#3 -1.1 with no E3 in the top 12. Six hold voices (chant, guqin, xiao, violins, cellos, sax) sustain each skeleton note for 0.96 s under the two eighths that follow, and the struck voices ring on. The brief's own test ('the tune's pitch is the strongest thing in each octave') was run only on a skeleton downbeat (127.05), where it passes; on the off-beat eighths it fails.
- **Suggestion:** Shorten the holds to the skeleton note's written length plus a short release (about 0.5 s), or drop the hold voices about 6 dB after their first 0.25 s. Re-probe 125.55, 127.55 and 129.55 in octaves 3 and 4.

### 3. The drum is pitched on A#1 (58 Hz), outside D major (should-fix)

- **Evidence:** drumSamples() sets f = 58 with the fundamental's a = 1.0 and t60 = 0.9 s. The drum probed alone at 129.0: strongest partial 58.0 Hz = A#1 -8 cents, 16 dB above the next. The mix at 130.6 (A chord, bass A2): 58.0 Hz at -5.4 dB against A2 110 Hz at 0 dB, a minor ninth under the bass. The mix at 129.55: A#1 at -1.5 dB, among the strongest partials. A Bb pitch on every beat sits under D, G and A chords.
- **Suggestion:** Tune the skin to the key: f = 55 (A1) or 73.4 (D2). Or shorten the fundamental's t60 to about 0.35 s so that it reads as a thump rather than a note.

### 4. The last word's first note (B4 at 133.0) is not alone (note)

- **Evidence:** Probe at 133.0, 0.15 s: code piano alone rms -38.8 dBFS, bass alone -40.5, strings alone -43.7, mix -34.8 (other voices' tails are still closing). On review-outro-end.png the B4 onset does not show in the waveform; the strings' D3/D2 release (0.25-0.3 s after 132.9) covers it. The brief says the piano is alone from 133.0.
- **Suggestion:** End the last chord about 0.25 s earlier (len to u 7.75) or shorten its release to about 0.12 s, so the pedal is gone at 133.0.

### 5. The outro's own lead pre-render in prepare() is no longer needed, including for the 8-bit voice (note)

- **Evidence:** With the outro's prepare() replaced by a no-op, every outro event was played on a stub Kit after the sections' own prepare(). Only the outro's own drum and flash buffers were missing; there were 0 lead-buffer misses and 0 reverb misses (scratch script misses-noprep.mjs). 16-pixel.js now prepares LEAD_MIDIS 69-86 × LEAD_LENS (lines 287-305), which covers everything the outro asks of it at +1. The DRY_KIT/NOTHING proxy loop (21-outro.js lines 290-308) costs about 7 ms, but it catches and swallows every error without a message.
- **Suggestion:** Remove the dry-run loop and keep the drum and flash sharedBuffer calls. If a safety net is wanted, have it log a lead that throws instead of swallowing it.

### 6. The nosferatu workaround in leadEvent is partly stale (note)

- **Evidence:** 21-outro.js line 135 forces B3 (midi 59) to at least 0.7 s 'to use the long buffer'. 14-nosferatu.js USED (lines 497-506) now also adds every long pitch (A3-D5 major, including 59) to the short set. So B3 at 127.0 could be asked for at its own 0.48 s. As written, it rings 0.7 s, over the A3 at 127.5 and the F#3 at 127.75 on the same piano. The Math.min(dur, 0.62) part is still needed: E3 (52) has no long buffer, and the held E at 128.0 would otherwise ask for one. The As-built text ('short buffers exist for A2 B2 D3 E3 F#3 A3') is out of date.
- **Suggestion:** Drop the B3 Math.max, keep the 0.62 clamp for pitches below A3, and update the As-built note.

### 7. Voice balance after the fix round: still within about 1 dB, two voices slightly forward (note)

- **Evidence:** Each voice rendered alone with `--label "voice:<id>\b"`, LUFS over 125-137: sahara -32.1, egypt -32.1, han -32.0, tang -33.4, song -32.2, qingming -33.1, maya -32.1, mughal -31.4, bada -32.1, wayang -32.2, ukiyoe -32.1, starry -31.5, scream -32.0, nosferatu -32.1, scope -33.1, pixel -34.1, chat -33.1, vapor -32.2, shortvideo -34.1, code -32.1. All voices together -19.4 LUFS against strings+bass+drum -24.4 LUFS, so the tune sits about 5 LU over the accompaniment in the tutti. The 2-5 kHz band is 15 dB under full band in the tutti (rms -35.6 against -20.2 dBFS for 125-129), so there is no harsh band. Pixel's top partials are harmonic, with no folding visible. Spot-tuned voices (han, wayang, ukiyoe, sahara, maya, vapor, scream) are within 2 cents of their planned pitch.
- **Suggestion:** Optionally lower mughal and starry about 0.8 dB (LEVEL 0.226→0.205, 0.254→0.23) and raise tang about 0.8 dB, to match the rest at -32.1.

### 8. 18 convolvers run at once inside the outro (note)

- **Evidence:** Building the outro graph on a recording Kit makes 18 ConvolverNodes: one per section with a room, plus starry's hall twice (voice and strings), with IRs of 0.3-4.2 s. The headless live run 121-137 matched the render (correlation ≥0.9995, no late ticks), so this machine copes.
- **Suggestion:** No change needed now. If the preview stutters on weaker machines, close the subgraphs' sends with the faders, or share one hall for the voices that stop at 129-130.

### 9. The master tanh knee compresses the tutti crests by about 3 dB without oversampling (note)

- **Evidence:** KNEE 0.6 after MASTER 1.54. The output peak of -6.2 dBFS (0.49) needs an input of about 0.69, i.e. tanh(1.15), about 3 dB of reduction, and adds odd harmonics on the attacks around 127.0-127.05. The shaper has no oversampling, so those harmonics can fold. Largest step 0.129 at 127.010 is otherwise clean.
- **Suggestion:** Acceptable as is. A cleaner alternative is to spread the attacks or lower MASTER by about 1 dB and accept about -19.5 LUFS.

## The checks, as the reviewer ran them

```
--part outro --check: Level -18.8 LUFS over film 125.00-137.00 s OK (target -18 LUFS); peak -6.2 dBFS at film 127.033 s; largest sample-to-sample step 0.129 at 127.010; cues 125.000 +4.0 ms ok, flashes 129/130/131/132/132.5 +1.0 ms ok; Lead 26 notes: median 0.5 cents, worst +9.2 cents (F#4 at film 131.75 s); Nothing out of tolerance. Cost: 335 events, 416 source nodes started, at most 194 alive at once; own prepare() 0.01 s.
--part outro --with bike --check: -18.9 LUFS; crossing 20 [bike] 125.000 +2.0 ms ok; the last bell [bike] 135.500 +1.0 ms ok; Nothing out of tolerance.
--lint outro: Lint: nothing found.
Join (--from 123 --to 139 --check): all cues ok, Nothing out of tolerance, peak -6.1 dBFS at 127.033.
Live preview (tools/audio-live.mjs --from 121 --to 137 --no-seek against a full render): worst lag 0 samples, lowest correlation 0.99951, 'The live sound matches the offline render.'
```

## Rulings

1. **In the second statement (131 to 133) the tune leads.** The last chord (the cellos' D3 over the bass D2) comes down 8 to 10 dB, or loses the bass: at 132.05 and 132.55 the tune's note must be the strongest partial in its own octave.
2. **In the tutti the running eighths are heard.** The six holding voices hold each skeleton note for its written length and a short release (about 0.5 s in all), or fall about 6 dB after their first quarter second. At 125.55, 127.55 and 129.55 the tune's note must be the strongest partial in octaves 3 and 4 (the reviewer's probe).
3. **The drum is in the key.** Tune the skin to D2 (73.4 Hz), and let its fundamental ring about 0.5 s, not 0.9.
4. **From 133.0 the piano is alone.** The last chord's bows are off and their release is over by 133.0 (end it about a quarter second earlier, or release in about 0.12 s).
5. Remove the dry-run loop from `prepare()` (the sections now prepare their own voices: the reviewer counted no misses without it); keep the drum and flash buffers. Drop the forced 0.7 s on the cinema piano's B3 and keep the 0.62 s clamp below A3 (findings 5 and 6).
6. **Balance the twenty voices again**, each alone with `--label "voice:<id>\b"`: several sections' voices have changed since you balanced them (a second small fix round has just touched sahara, han, tang, mughal and shortvideo). Every voice within half a decibel of the others (the two bright ones, pixel and the bell hook, may stay 1 to 2 dB under). The whole stays at -18 LUFS within 1.5 and below -6 dBFS.
7. Finding 8 (the convolvers) stands.

## Acceptance check (whole film, 2026-11-18)

An independent checker on the owner's brief ("All the instruments from the different eras play the main melody together"): all twenty voices have events in 125–129, and the tune's notes are among the strongest partials at 126.0, 127.5 and 128.0. But the music brief's "As built" still says, of the strings' chord notes being stronger than the tune's note, "that is open", while a later paragraph (the music director's hand edit: `STRINGS` 0.5 → 0.25, `MASTER` 1.38 → 1.62) says what was done about it. Nobody independent has measured the part since that hand edit.

## Rulings, third round

1. **Measure first.** On a render of the outro with the bicycle (`node tools/audio.mjs --part outro --with bike`), for each of the sixteen notes of the first statement (125.0–131.0): in a window from 30 ms to 180 ms after the note's beat (to 130 ms for the half-beat notes), add up the energy of each pitch class over octaves 3 to 6 (fundamentals 130 Hz to 2 kHz, from a spectrum with enough resolution to separate neighbouring semitones in octave 3) and say whether the tune's pitch class is the strongest, and by how many dB over the next. Write the script under `dev/audio/outro-r3-*.mjs` and the table into "As built".
2. **Change the sound only if the tune loses.** If the tune's pitch class is the strongest for at least 13 of the 16 notes, including all six skeleton notes, change nothing in the sound. If not, bring the strings' chords further under the voices (thin the chord notes that sit in octaves 3 and 4, or lower `STRINGS`, compensating with `MASTER` so the part stays at its loudness), until it is; the part must stay within −18 LUFS ± 1.5 alone, peak under −4.5 dBFS, and the last chord and the piano's last word must stay as they are.
3. Correct "As built": the sentence "The strings were not changed; that is open." must say what was done later and what the measurement of ruling 1 shows. Both checks (`--part outro --check`, `--part outro --with bike --check`) must end "Nothing out of tolerance." with no lint.
