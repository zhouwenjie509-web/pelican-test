# The Pelican Test

*Humanity Has Been Obsessed with Drawing Pelicans Riding Bicycles Since Ancient Times*

A code-animated short film, 2 minutes 17 seconds long. A pelican rides a bicycle along one continuous road through 20 pictures on a gallery wall, each in the art style of a different era. Every time it passes through a picture frame, the style changes. Every frame of the film is drawn by JavaScript (p5.js and p5.brush) and every sound is synthesized by JavaScript (Web Audio); there are no image, video or audio assets.

**Status: finished (Stage 5 of 5).** All twenty sections are painted, the film has its soundtrack (one original tune, played by each section on the instruments of its own time and place, with the bicycle's bell on every crossing), it has had its final polish, and the finished video is `out/pelican-test.mp4`. Each section has its art brief in `briefs/NN-id.md` and its music brief in `briefs/music/NN-id.md` (both say what was built and why); the notes of the independent reviews are in `briefs/VERIFY-id.md` (picture; written for the twelve sections of the last three batches) and `briefs/music/REVIEW-NN-id.md` (sound, every part); `briefs/POLISH.md` is the record of the last stage: what nine reviewers found in the finished film, what was changed, and what was left alone and why. Nobody has listened to the soundtrack while making it: it was written, checked and balanced by measurement and by reading spectrograms, so its first hearing is the owner's.

Download the [finished project ZIP](https://github.com/zhouwenjie509-web/pelican-test/releases/download/v1.0.0/pelican-test_finished.zip) to watch the film at `out/pelican-test.mp4`. The ZIP also includes the original WAV soundtrack and the full source tree.

## Requirements

- Node.js 22.12.0 or newer
- Google Chrome (the tools drive the installed browser; set `CHROME_PATH` if it is somewhere unusual)
- ffmpeg, for turning frames into video
- macOS system fonts (Songti SC, Kaiti SC, Libian SC, Weibei SC, PingFang SC, Baskerville, Optima, Menlo and others; the full list is in `briefs/SCENE_GUIDE.md`). On other systems the font stacks fall back to generic families and the title cards will look different.
- Optional, only for the three helper scripts in `dev/polish/`: Python 3 with Pillow

```bash
npm ci
```

## Watch it

```bash
npm run dev
```

Then open http://localhost:5173/. Click the picture or press Space to play. Left and right arrows step one beat, with Shift one section, and `,` / `.` step one frame. `M` turns the sound off and on. `[` and `]` move the picture against the sound by 10 ms (see below).

The preview plays the soundtrack with real-time Web Audio and takes its clock from it, so the two cannot drift apart. Each frame is drawn for the film time that will be sounding when that frame can first be on the screen: one refresh of the display after the frame begins, by the browser's own account of when sound leaves the audio device. What the browser cannot know, it cannot correct: a television that holds the picture back, or wireless loudspeakers that hold the sound back. If picture and sound are apart on your equipment, `]` draws the picture later and `[` earlier, 10 ms a press (the amount shows beside the frame rate), or start with `?sync=120` (milliseconds; positive for late sound, negative for a late picture). The exported MP4 has no such question: its sound and picture are locked in the file.

The preview does not always reach 60 frames a second. On the machine the film was made on (an Apple M4, with other programs running) it played the intro and the first six sections at 40 to 54 frames a second and the rest at 56 to 60; the frame rate shows at the right of the control bar. Because the clock is the sound's, a dropped frame costs smoothness and never sync. `?w=1280` draws a smaller picture and is quicker. The exported MP4 has every frame.

Query options: `?w=1280` (render width), `?t=62` (start time), `?fps=30` (cap the preview frame rate), `?solo=5` (one section alone, without neighbours or frames), `?sound=0` (no soundtrack; the clock runs on the wall clock), `?sync=40` (draw the picture 40 ms later than the sound's clock).

## For your ear

Nobody has heard this soundtrack: it was made and checked by measurement. These are the judgements that only listening can make, collected in one place. Each music brief (`briefs/music/NN-id.md`) ends with an "Unsure" paragraph for its own section.

- **The tune.** Whether it holds as one melody through its changes of scale (minor in Nosferatu, the Japanese *in* scale in Ukiyo-e, slendro in the wayang). One reviewer noted that its first bar and a half shares its outline with the opening of "Oh! Susanna" (Stephen Foster, 1848, in the public domain): four notes the same, then a similar rise and fall; the rhythm and the rest differ. It is not a quotation, but only an ear can say whether it is heard as that song. The tune lives in one place (`THEME` in `audio/engine/theory.js`); every part follows it.
- **The chat window's shake** (Section 17, film 104.0 s). The sound is invented (ten short blips alternating two pitches a tritone apart), but a buzzing "nudge" that shakes a chat window recalls a feature of one real messenger. If it evokes that product, the gesture should change.
- **The instruments.** Whether each synthesized instrument reads as the one the brief names (the sitar, the xiao, the guqin and the pipa are the hardest), and whether the scream in Section 13 reads as a scream.
- **Three decisions about silence and outline.** Section 8 stops dead on its strong beat and, after a second of silence, the lute's sympathetic strings finish the tune very softly by themselves. Section 9 plays only the tune's outline (six notes), its long note rolling up to the tune's E with the pelican's eye. Section 17 leaves out the tune's top note for half a bar before the window shakes.
- **The outro.** Whether twenty instruments and a string section read as an orchestra or as a blur, and whether the tune leads (by measurement it does when the octaves are added together, not in every octave alone).
- **Level and balance.** The film measures -16.6 LUFS; whether the quiet sections (Song, Bada Shanren) sit right against the loud ones (the short video, the outro's tutti).
- **Picture against sound in the preview** on your own screen and loudspeakers (see "Watch it"). The MP4 has no such question.
- **The cattle's taps** (Section 1, film 7.75 to 9.75 s). In the polish each animal's look-up moved a second later, into plain view, and its dry tap with it: the last two taps now fall in bar 3, where everyone sings and all the drums play. They measure clearly in their own band; whether they are still heard as six separate taps is for the ear.

## Export it

```bash
npm run export
```

That one command checks the timing rules, draws all 8220 frames (1920 × 1080, 60 a second), renders the soundtrack offline, encodes `out/pelican-test.mp4`, and then checks the file against what it was made from. It takes about a quarter of an hour on the machine the film was made on. The steps can also be run one at a time:

```bash
node tools/render.mjs --fps 60 --out frames/final         # the picture, frame by frame
node tools/audio.mjs                                      # the soundtrack, offline, to out/audio/pelican-test.wav
node tools/encode.mjs --frames frames/final --fps 60 --audio out/audio/pelican-test.wav --out out/pelican-test.mp4
node tools/verify.mjs                                     # is the file the film? streams, sound against the WAV, frames against their sources
```

The MP4 is H.264 with a key frame every two seconds and AAC sound at 320 kb/s; at the default quality it is about 370 MB (`--crf 22` on `tools/encode.mjs` gives a file of less than half that size for sending). Its picture is tagged as what it is, sRGB values (BT.709 primaries, sRGB transfer), so a colour-managed player such as QuickTime shows the same light as the preview page. On macOS the sound is encoded by the system's AAC encoder through ffmpeg, which smears far less sound ahead of a sharp attack than ffmpeg's own (measured on this soundtrack: about 15 dB less in the 5 ms before the sharpest onsets); elsewhere ffmpeg's own encoder is used.

| Tool | What it does |
|---|---|
| `tools/export.mjs` | The whole export in one command: checks, frames, soundtrack, MP4, verification |
| `tools/render.mjs` | Renders a time range frame by frame with several Chrome instances in parallel |
| `tools/encode.mjs` | Encodes a frame folder (and optionally a WAV) to H.264 MP4 |
| `tools/verify.mjs` | Checks a finished MP4: its streams, its sound against the WAV (offset in samples, likeness, loudness), a frame of every part against its source frame and the frames beside it, and that the frame folder is what the code now draws |
| `tools/shot.mjs` | Saves single frames: `node tools/shot.mjs --t 5,8,11`; a section's gallery still: `--still 5`; the still's square at another moment of the section, drawn live: `--still 20 --u 7.0` |
| `tools/sheet.mjs` | Contact sheets: `--name film`, `--section 5`, `--times …`, `--range a:b:step` |
| `tools/compare-fps.mjs` | Renders one stretch at 30 and 60 fps, alone and stacked |
| `tools/check.mjs` | Checks the timing rules; with `--purity` also proves frames are a pure function of time (`--section N` for one section) |
| `tools/perf.mjs` | Plays the preview in real time and reports frame rate and drawing time: `--section 12` |
| `tools/audio.mjs` | Renders the soundtrack with `OfflineAudioContext` to a WAV: the whole film, one part (`--section 7`, `--part outro`), or a stretch (`--from 45 --to 55`; begun 8 s early on the film's own grid of 128-sample blocks and cut, so it is that stretch of the film apart from sounds more than 8 s old). `--check` measures it and draws its spectrogram; `--print 7` lists a part's events; `--lint` reads the parts for things they must not do |
| `tools/audio-check-all.mjs` | Checks every part of the soundtrack alone, one line each: loudness against its target, peak, declared cues, tuning of the melody notes |
| `tools/audio-report.mjs` | Measures the whole soundtrack: loudness overall and section by section, peaks, and whether every declared cue begins where the picture needs it |
| `tools/audio-live.mjs` | Plays the preview in real time in headless Chrome, records what the live Web Audio graph produces, and subtracts the offline WAV from it; then does the same across a pause, seeks (playing, paused, several in a row), a main thread held up for seconds, and playing again after the end. It cannot see a loudspeaker or a display |
| `tools/audio-same.mjs` | Renders the soundtrack twice and compares the two, or compares two files section by section. Two renders differ in their last bit (the browser's mixer rounds differently from run to run), so "the same" means nothing above -100 dBFS |
| `tools/audio-starts.mjs` | Begins playback at several hundred film times, as a seek or a ranged render does, and reports any sound that could not be started |
| `tools/audio-probe.mjs` | The partials and the envelope of a stretch of rendered sound |

Output goes to `frames/` and `out/`, which are not tracked by git.

**The finished video as exported on 2026-11-18**, `out/pelican-test.mp4`: 137.000 s, 8220 frames, 1920 × 1080 at 60 frames a second, 369.4 MB. Measured, not watched or heard: its sound starts on the same sample as the offline WAV at a film time in every part (offset 0 samples) and reads -16.6 LUFS with a true peak of -2.2 dBTP; a frame of every part fits its own source frame better than the frames before and after it; twelve frames drawn again by the code are byte-identical to the frames it was made from; all 106 declared sound cues begin within their limits in the mix, and the bell on each of the 21 crossings within 1 to 3 ms by the detector. Of its 8220 frames, 3672 are byte-identical to the film before the final polish, and every changed stretch belongs to a change listed in `briefs/POLISH.md` (Sections 10, 12, 13, 14, 17 and 18 did not change by a single byte). The live preview, played straight through in real time in headless Chrome and subtracted from the offline WAV, was 0 samples apart in every second, and its largest difference in any tenth of a second was -144.0 dBFS in one run (the 24-bit file's own rounding) and -108.2 dBFS in another, at film 125.0 s where the outro's hall begins, made while the machine was busier (a real-time context computes a long reverb's tail on a background thread; 93 dB under the music there); across a pause, three kinds of seek, a stalled main thread, a play-and-pause race and replay after the end it was -146 dBFS or less.

## How it is built

```
src/
  beat/      tempo, bars, crossing times, easing
  kit/       shared drawing toolkit: render targets, cached layers, paper, frames, text, noise,
             the brush pen and the ink system
  rig/       the pelican and bicycle as a skeletal puppet, plus its skins
  scenes/    one file per section, the intro and the outro
  main/      scheduling, camera, transitions, the preview page
tools/       rendering, screenshots, contact sheets, checks
briefs/      the project brief, the scene guide and the music guide, one art brief and one
             music brief per section, the cue sheet (what is seen and when), the notes of the
             reviews, and the record of the final polish
audio/       the synthesized soundtrack
  engine/    pitch and the tune, signal making, the Web Audio kit, the scheduler,
             live playback, offline rendering
  parts/     one file per section, the intro, the outro and the bicycle (bell and chain)
```

**Time.** 120 BPM, two seconds per bar. The intro is a two-beat pickup plus two bars, each section is three bars, the outro six. The pelican passes through a frame at 5 + 6k seconds (k = 0…20), always on a bar line.

**Frame rate.** 60 frames a second. Before that was decided, one stretch with a plain camera pan was rendered at 30 and at 60 frames a second (`tools/compare-fps.mjs`, which writes the two clips and a stacked one to `out/compare/`; it was run on the Stage 1 film, and running it again recreates the comparison on the finished one), and the owner chose 60 on 2026-11-16. The shadow-puppet, 8-bit and chat-GIF sections step their figures at 8 to 12 poses a second (`poseHz`, and the GIF's own clock) while the camera stays smooth.

**Space.** Each section owns 1000 units of road and draws in its own 1000 × 1000 square. The pelican covers one section in three bars; one pedal turn takes two beats and the wheels roll true against the road.

**Purity.** `renderAt(t)` depends only on `t`. Static layers are painted once from fixed seeds and cached, 2D layers are rasterized on the CPU, and `tools/check.mjs --purity` verifies that two browsers rendering in different orders produce byte-identical frames. That is what makes scrubbing and parallel export safe.

**Sound.** The film has one tune, three bars long like a section (`audio/engine/theory.js`). Each section plays it on the instruments of its own time and place; its last note is the tonic on the next downbeat, played by the bicycle bell and by the next section, so the phrase passes through the picture frame as the pelican does. A part lists its sounds against the same clock as its picture (`score()`); one scheduler (`audio/engine/player.js`) turns the list into Web Audio nodes for both the live preview and the offline render, which is why the two are the same sound at the same film times (measured: the live graph's output differs from the offline file by about -144 dBFS, the 24-bit file's own rounding; two offline renders differ by at most about -126 dBFS, because the browser's mixer rounds differently from run to run). One exception, found by pausing over and over in tests: when a pause lands while Chrome is serving the audio device (about one pause in fifty), its clock runs a block (2.7 ms) past the last sound it rendered, and notes ringing at that moment are that much late against the picture until they die away. It cannot be heard, and the tests report it when it happens. The bell rings on every crossing, and the chain ticks four times for every turn of the pedals, read from the same crank angle that draws the picture. `briefs/MUSIC_GUIDE.md` is the full guide to arranging a part.

**Puppet.** `solveRig(pose)` turns one set of pose parameters into joints and outline shapes. Each style draws those with its own skin, so the motion is continuous while the look changes.

**Brush.** p5.brush spaces its stamps in canvas units, so a stroke drawn under a zoom is only a magnified stroke. `kit/pen.js` therefore draws all brush work in 1080p pixels and converts world coordinates and widths on the way in; a mark keeps its grain at any zoom and render size. Marks are grouped by colour before drawing, because p5.brush composites once per colour change.

**Ink.** The five brush-and-ink sections (3, 4, 5, 6, 9) share `kit/ink.js`: silk and xuan-paper grounds, the five tones of ink, a set of brushes registered per size class, and ink painted on white sheets that are multiplied onto the ground. Each section keeps its own rules of brushwork.

The scene interface is documented at the top of `src/main/film.js`; `src/scenes/placeholder.js` is the smallest complete example. `briefs/SCENE_GUIDE.md` is the full guide to painting a section: the rules every scene must keep, the toolkit, and the commands for checking one.

## Rights

This is an original work. Period styles are homages to art that is in the public domain; the messaging app, short-video app and game are fictional, with no real logos, mascots, characters or sounds.

The production method (a shared toolkit, frames as a pure function of time, frame-by-frame export with Puppeteer and ffmpeg) follows the approach described in the README of [Tunai-0511/meme67-art-history](https://github.com/Tunai-0511/meme67-art-history). No code, media, art briefs or jokes from that project are used here. Third-party components are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
