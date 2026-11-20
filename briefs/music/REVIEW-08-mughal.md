# Review · mughal

Independent review of `audio/parts/08-mughal.js` on 2026-11-18, by a reviewer who did not write the part and could not listen to it: everything below was measured, read from the score and the code, or seen in a spectrogram. The music director's rulings follow the findings.

**Verdict:** needs-fixes

Sitar (additive steel string with jawari swell and meend glides), tabla, tanpura, taraf and chikari play bars 1-2, then everything is choked at u = 3.0 with the lute knock. It is silent from there to the bell. Every row of the brief is in the score at its time, the tune's notes are right, the stop at 3.0 matches CUES.md (hard switch at u 3.0), and all checks pass. The one real risk is how bright the sitar is: there is a lot of sustained energy in 2-5 kHz.

## Findings

### 1. Sitar is very bright and sustained in 2-5 kHz: risk of a harsh, buzzy tone (should-fix)

- **Evidence:** Sitar alone (--label sitar, out/audio/review-mughal-sitar.wav), probe at film 48.0 (A4 stroke), 0.4 s: partials 2-8 (880-3080 Hz) are within -0.4 to -3.4 dB of the fundamental, and partials 9-10 are at -6/-10 dB. The 2:5 kHz band has peak -16.0 dBFS and rms -27.2 dBFS, against -22.7 dBFS rms for the whole sitar: only 4.5 dB under the full band. Inside 2-5 kHz the strongest partial is the 7th (3080 Hz). In the spectrogram s08.png the 3-7 kHz partials stay orange for the whole length of every note. In the code, tau[k] = t60/6.9/(1+0.06(k-1)) gives harmonic 16 (about 7 kHz) a t60 of about 2.3 s, and the nasal band (nasal 0.9) adds up to +5.6 dB on top. The sitar carries the section's whole -19 LUFS, peaking at -6.6 dBFS.
- **Suggestion:** Take 4-6 dB out of 2-5 kHz: lower `nasal` to about 0.5, or raise `tilt` from 1.15 to about 1.35. Make the partials above about 2.5 kHz decay faster, for example tau divisor 1 + 0.15(k-1), so that the jawari swell blooms and then falls from the top down. Then re-level to -19 LUFS and re-probe. A centroid near 1.1-1.2 kHz instead of 1.44 kHz would still read as bright and nasal.

### 2. Skeleton B4 on the strong beat 2.0 is reached 110 ms late, by meend (note)

- **Evidence:** STROKES[4]: m0 A4, glide {at 0, len 0.11, to B4}. The onset at film 49.000 is A4 and B4 arrives at 49.11. The E-to-F# pull (glide 0.67-0.77) also arrives at 0.77, not on 0.75 as As built says. The checker passes both.
- **Suggestion:** This is idiomatic and the brief asks for a bend up to B, so it is acceptable. If B should read on the downbeat itself, shorten the first glide to about 60 ms, or start it 40 ms early from the previous stroke.

### 3. Chikari is sparse (note)

- **Evidence:** Only three chikari strokes (u 0.25, 1.25, 2.25), each ringing to 3.05. The brief asks for the drone strings 'struck rhythmically between the melody notes'.
- **Suggestion:** Optional: add light strokes on the other off-beat eighths (0.75, 1.75, 2.75), quieter, so the chikari reads as a pattern rather than three isolated events.

## The checks, as the reviewer ran them

```
--section 8 --check: Level -19.3 LUFS OK (target -19); peak -6.6 dBFS at film 48.068 s; largest step 0.100 at 49.075 s; Cues 47.000 u0.00 +1.0 ms ok, 50.000 u3.00 +1.0 ms ok; Lead 9 notes: median -0.3 cents, worst +2.4 cents (E4 at film 47.50 s), not measured: 1 shorter than 0.1 s (the choked E); Bell: silence between 1.8 and 9 kHz in the last 30 ms before film 53.00 s; 'Nothing out of tolerance.' 36 events, at most 31 alive, prepared 0.21 s.
--with bike --check: crossing 7 [bike] +2.0 ms ok, crossing 8 [bike] +1.0 ms ok; Nothing out of tolerance.
--lint 8: Lint: nothing found.
Join --from 45 --to 55 --check: mughal u0 +2.0 ms ok (rise 8 dB, Maya's tail fills the 0.1 s before), crossing 7 ok, u3.0 ok, bada u0 ok, crossing 8 ok; Nothing out of tolerance.
```

## Rulings

1. **A less harsh sitar.** 4 to 6 dB less in 2 to 5 kHz, and the partials above about 2.5 kHz fall faster after the jawari's bloom, from the top down. Re-level to -19 LUFS.
2. The top of the tune reads on its beat: B4 is reached by u = 2.06 (finding 2).
3. Light chikari strokes also on u = 0.75, 1.75 and 2.75, quieter than the three that are there (finding 3).

## Second check (after the fix round)

A second independent checker measured every ruling again: 3 of 3 met.

- **New (minor): Sitar may now be duller than the brief's 'bright and nasal'.** SITAR_TONE nasal 0.9 -> 0.1 (the nasal band is practically removed), tilt 1.4, hiDecay 32 from 2 kHz. Sitar alone centroid 965 Hz, part 901 Hz, below the 1.1-1.2 kHz the reviewer gave as still reading bright; partials 6-8 are 11-22 dB under the fundamental after 0.4 s. The brief's Check still passes (partials to 7 kHz at the bloom, peaking at +72 ms). The fixer lists this as a doubt in As built.
  Suggestion: Optional: give back some of the nasal band (about 0.3-0.4) or ease hiDecay a little, keeping 2-5 kHz at least 4 dB under the old level; re-probe at 48.0.

## Rulings, second round

1. **The sitar is bright and nasal again, without the harshness.** Give back part of the nasal band (about 0.3 to 0.4) so that the sitar alone has its centroid near 1.1 to 1.2 kHz, keeping the faster fall of the partials above 2 kHz and keeping 2 to 5 kHz at least 4 dB under what the first review measured (-27.2 dBFS rms on the A4 stroke at film 48.0, sitar alone, at the same loudness). Re-level to -19 LUFS. The `lead` export takes the same tone.
2. Nothing else changes.

## Acceptance check (whole film, 2026-11-18)

An independent checker went through the owner's brief sentence by sentence. For this part: after u = 3.0 the part has no events except the choked E4 and "lute set down"; the finished film at 50.5–52.9 s measures −50.1 dBFS rms, only the chain ticks, against −15.5 at 47.5–49.5. The tune's last bar (F# E D B, A, B,) is never played. The owner's brief says "One original main melody runs throughout the entire film" and asks for no silence here: the silence was the music director's idea.

## Rulings, third round

1. **The hush stays; the tune's last bar comes back as a whisper that nobody plays.** Keep the choke at u = 3.0 and the complete silence from 3.0 to 4.0 exactly as they are: that is the joke (thirteen guests with a finger on the lips). From u = 4.0 the lute lies on the carpet and its **sympathetic strings** (this part's own `taraf` voice: no pluck, a swell, a long ring) sound the tune's last bar by themselves: the six notes of `theme()` from beat 8 on, in the octave the sitar played bars 1 and 2 in: F# at u 4.0 (one beat), E at 4.5, D at 4.75, B at 5.0 (one beat), A at 5.5, B at 5.75. The bell and Section 9 take the final D.
   - Nobody's hands are on an instrument: no pluck, no scrape, no tabla, no tanpura, no chikari after 3.0.
   - Each note must speak on its beat. The existing taraf swells slowly; for these six make the swell short enough (or begin it early enough) that the note has reached its level within about 60 ms of the beat. Each may ring on under the next, as sympathetic strings do, but the guide's rule for the bell holds (the check's bell-room line must stay ok).
   - A whisper: in the part alone the rms of u 4.0–5.9 should lie 18 to 22 dB below the rms of u 0.5–2.9 (`node tools/audio-probe.mjs`, both windows). In the render with the bicycle (`--with bike`) each of the six fundamentals must still be found by the pitch check between the chain ticks. If the two conflict, being found wins: report the level you reached.
   - Mark the six notes `lead: true` (plain, in tune, not `free`).
   - `bike: { bell: 1, chain: (u) => (u < 3 ? 0.8 : 1.6) }` stays.
   - The cue at 3.0 stays as it is. Add a `soft` cue at u = 4.0 ("the lute's own strings finish the tune") only if it reads reliably in both checks.
2. Bring the music brief up to date: "does not come back" and "The tune's last bar is left unplayed on purpose" are no longer true. Say in "As built" what now happens, what was measured, and that nobody has listened.
