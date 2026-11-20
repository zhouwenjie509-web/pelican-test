# Project brief (as given by the owner, 2026-11-15)

This is the owner's brief, kept as the source of truth for every stage. The wording is unchanged; only headings and list markup were added.

---

## Project: The Pelican Test — Humanity Has Been Obsessed with Drawing Pelicans Riding Bicycles Since Ancient Times

A code-animated short film approximately 2 minutes and 17 seconds long.

A pelican rides a bicycle along a road that runs continuously through the entire film, passing through 20 sections representing different historical periods, geographic regions, and artistic styles. Every time it passes through a picture frame, the art style changes.

Each era delivers a carefully crafted answer. The humor comes from subtle, deadpan jokes within each section, not from poorly executed artwork.

## Inspiration and References

* Inspiration: A code-animated short called Superman in Flight, in which Superman flies through 20 different artistic styles.
* Reference repository: https://github.com/Tunai-0511/meme67-art-history (67: An Art History)

Before starting, read the repository's `README.md`, `README_SHARE.md`, `LICENSE`, `LICENSE-MEDIA.md`, and `NOTICE.md` in full.

### Approaches You May Learn From (Approaches Only; Write Your Own Code)

* A shared drawing toolkit, a beat module, and one scene file per section. Each frame is rendered through the pure function `renderAt(t)`, with a main scheduler handling scene transitions.
* Use p5.js + p5.brush to achieve natural brushstrokes. First verify the open-source license of p5.brush.
* Use Puppeteer for frame-by-frame rendering and ffmpeg to combine video and audio. Use screenshot tools and contact sheets for frame-by-frame inspection.
* Build the toolkit and specifications first, then write art briefs for each section and delegate production to parallel subagents.

### Materials and Elements That Must Not Be Taken Directly from the Reference

* The reference repository's film, cover artwork, rendered frames, and audio are all rights-reserved. They must not be used or adapted in any form.
* Do not copy its voice samples, art brief wording, scene compositions, or specific jokes. Sections covering the same subject matter must be independently designed.
* Do not copy its presentation style. It uses venetian-blind transitions, a year counter, and museum-style label cards. We will use a continuous road and transitions through picture frames.
* As a general rule, do not copy its code. If any code snippets are reused, retain the original author's MIT copyright and license notice and document them in `THIRD_PARTY_NOTICES.md`. Third-party components listed in `NOTICE.md` must comply with their respective licenses.
* Do not fork the reference repository. Create a new, clean repository. If you need to clone the reference for comparison, clone it outside the project directory and treat it as read-only.

## Intro: Making an Absurd Claim with a Straight Face (Approximately 5 Seconds)

A textured paper background, serif typography, and solemn low strings in the style of a documentary soundtrack.

In one corner of the screen is a sketch illustration with the caption:

「图一 鹈鹕骑行图（摹本）」

Two lines of subtitles fade in quickly:

「人类自古以来就痴迷于画鹈鹕骑自行车。」

「——早在自行车被发明之前。」

The second line lands on a strong beat, and the pelican immediately rides into Section 1.

A small source citation reads:

「——《鹈鹕骑行艺术通史》，卷一（虚构书名）」

## The 20 Sections, in Chronological Order

### 1. Saharan Rock Art (c. 4000 BCE, Tassili Style)

Ochre pigments painted on a rock wall.

Herders and cattle stop to watch the pelican ride past.

### 2. Egyptian Wall Painting (c. 1300 BCE)

A hieroglyphic cartouche contains the words "The Pelican Test."

The painter's underlying grid sketch is faintly visible in the background.

The pelican slows down and freezes here, striking a standard Egyptian wall-painting pose.

### 3. Han Dynasty Stone Relief Rubbing (c. 100 CE, Ink)

A stone-rubbing texture with white lines against a black background.

A pelican riding a bicycle has somehow joined a procession of horses and carriages.

### 4. Tang Dynasty Baimiao Line Drawing (c. 750 CE, Ink, "Wu Dai Dang Feng")

Pure ink lines.

The pelican's feathers and flowing ribbons flutter in the wind.

### 5. Song Dynasty Landscape Painting (c. 1000 CE, Ink, Homage to Travelers Among Mountains and Streams)

Beneath a towering mountain, the pelican is so tiny that it is almost impossible to see.

Only when the camera pushes in does the viewer finally find it.

### 6. Along the River During the Qingming Festival (c. 1100 CE, Ink and Light Color)

The pelican rides across the Rainbow Bridge.

Pedestrians on the bridge turn their heads to watch.

### 7. Maya Codex (c. 1200 CE)

A page from a folding codex.

Maya dot-and-bar numerals beside the illustration record the number of pedal revolutions.

### 8. Mughal Miniature Painting (c. 1600 CE)

An ornate gold floral border.

In a palace garden, guests observe the pelican simultaneously from multiple viewpoints.

### 9. Bada Shanren-Style Expressive Ink Painting (c. 1690, Ink)

Just a few brushstrokes and large areas of empty space.

The pelican rolls its eyes in Bada Shanren's distinctive manner.

### 10. Javanese Wayang Kulit Shadow Puppetry (c. 1800)

An intricately cut-out leather shadow puppet of a pelican and bicycle.

The control rods are visible.

The wheels move in a deliberately jerky, stop-and-start fashion.

### 11. Ukiyo-e (1830s, Hiroshige's Tōkaidō Style)

The pelican rides along the Tōkaidō road.

### 12. Van Gogh's The Starry Night (1889)

The swirling starry sky rotates along with the bicycle wheels.

### 13. Munch's The Scream (1893)

The pelican rides across the bridge.

The screaming figure becomes a startled passerby.

### 14. Nosferatu (1922)

On a staircase wall, the shadow of the pelican riding its bicycle slowly climbs upward.

### 15. Oscilloscope Vector Graphics (1950s)

A circular green phosphor screen against a black background.

The pelican and bicycle are composed of glowing lines, with phosphor persistence trails and scanning jitter.

The joke: A hand turns the wrong knob. The pelican instantly twists into a tangled Lissajous figure, then snaps back into its original shape on the next beat.

### 16. 8-Bit Pixel Game (1980s)

A side-scrolling platform game with a limited color palette.

The pixel-art pelican rides its bicycle, jumps over a pit, and collects a coin.

On a strong beat, "1UP" pops up.

### 17. Early Chat Window (2000s)

A fictional messaging application window receives an animated GIF of a pelican riding a bicycle.

The GIF has a low frame rate, 256 colors, and visible dithering noise.

On a strong beat, the window performs a synchronized "window shake."

At the top, the interface displays:

「对方正在输入…」

### 18. Vaporwave (2010s)

Pink, purple, and cyan gradients; a perspective grid; low-poly palm trees; and classical marble busts watching from the sidelines.

### 19. Vertical Short-Form Video (2020s)

The image suddenly narrows to a 9:16 vertical format, with black bars on both sides.

A fictional app interface surrounds the video.

Likes and comment overlays float upward.

The progress bar reaches the end at the exact moment the pelican passes through the picture frame.

### 20. Code Aesthetics (2020s, the Large Language Model Era)

A clean, dark-themed code editor.

SVG code is written line by line.

The pelican riding its bicycle is drawn stroke by stroke as the code appears.

This must be the most refined and meticulously crafted answer in the entire film.

## Historical Title Cards

Each section has a title card that matches the artistic style of its era.

Each title card must include:

* Chinese name
* English name
* Historical date

All text must be clearly readable at 1080p resolution.

## Shared Ink Rendering System

The ink-based sections (3, 4, 5, 6, and 9) share a single ink-rendering system featuring:

* Xuan paper texture
* Varying ink concentrations
* Dry-brush effects
* Ink bleeding and diffusion

However, each section must preserve its own distinct brushwork:

* Stone rubbing
* Baimiao line drawing
* Landscape painting
* Architectural painting
* Expressive ink painting

## Special Transition: Section 14 → Section 15

On the strong beat as the pelican passes through the picture frame, the pelican's shadow on the wall in Nosferatu becomes "electrified."

Its outline transforms into glowing green oscilloscope lines with phosphor afterglow, seamlessly entering the oscilloscope section.

## Outro: The Press Conference (12 Seconds)

The camera pulls back to reveal a gallery wall arranged in a 7 × 3 grid, occupying approximately 90% of the screen's width.

Subtitles are centered below.

The first 20 frames contain the 20 sections in chronological order, each frozen on an image of the pelican in that era's artistic style.

The 21st frame contains an empty press-conference setup:

* A table with a row of microphones, without any real media logos
* An empty chair
* A nameplate reading 「鹈鹕（本人）」

### Sequence

**1. Wide Shot**

Display:

「截至目前，人类共提交了 20 份答卷。」

**2. Camera Push**

The camera slowly pushes toward the 21st frame.

Several camera flashes illuminate the empty chair on strong beats.

**3. Hold**

Once the camera stops, display:

「鹈鹕本人对此尚未发表评论。」

**4. Final Beat**

The pelican suddenly rides past behind the press-conference setup without looking back.

Only a single bicycle bell is heard.

Freeze on the empty press-conference setup.

## Copyright Restrictions

Only pay homage to works that have entered the public domain.

Do not imitate any real album cover, movie frame, video game character, or protected character.

The messaging app, short-form video platform, and game must all use fictional interfaces and names.

Do not use real icons, mascots, logos, game levels, or notification sounds.

## Rhythm and Duration

Tempo: 120 BPM

One measure lasts 2 seconds.

* Intro: 2.5 measures (approximately 5 seconds)
* Each of the 20 sections: 3 measures
* Outro: 6 measures

Total duration: Approximately 2 minutes and 17 seconds.

Every picture-frame crossing must land on a strong beat.

The camera should push in slightly whenever the pelican passes through a frame.

### Internal Structure of Each Section

* Measure 1: Entrance
* Measure 2: The section's joke or highlight (a slowdown or freeze-frame is allowed)
* Measure 3: Ride toward the next picture frame

One full pedal revolution corresponds to two beats.

## Music

One original main melody runs throughout the entire film.

Each section uses instruments associated with its historical period or geographic region.

All music must be synthesized programmatically, without using external audio assets.

### Instrumentation by Section

1. Saharan Rock Art: Hand drums and vocal chanting
2. Egypt: Egyptian harp
3. Han Dynasty: Bronze bells
4. Tang Dynasty: Pipa
5. Song Dynasty: Guqin
6. Along the River During the Qingming Festival: Flute, gongs, and drums
7. Maya: Ceramic flute and wooden drums
8. Mughal: Sitar and tabla
9. Bada Shanren: Xiao (vertical bamboo flute)
10. Wayang Kulit: Gamelan
11. Ukiyo-e: Shamisen
12. The Starry Night: Strings
13. The Scream: Strings, which suddenly go out of tune and produce a scream-like effect
14. Nosferatu: Silent-film piano and pipe organ
15. Oscilloscope: Sine-wave beeps and vacuum-tube hum. When the wrong knob is turned, the pitch distorts along with the Lissajous figure.
16. 8-Bit: Four-channel chiptune music consisting of two square waves, one triangle wave, and one noise channel. Use an original coin-collection sound effect.
17. Chat Window: MIDI-ringtone style. Original message notification sounds serve as percussion.
18. Vaporwave: Slowed-down 1980s shopping-mall cassette music.
19. Short-Form Video: Short, punchy pop beats.
20. Code Aesthetics: Clean piano and synthesizer.

Bicycle bells and chain sounds may serve as recurring percussion throughout the film.

### Outro Music

All the instruments from the different eras play the main melody together.

As the camera pushes in, the music gradually fades.

At the end, only one bicycle bell remains.

### Special Music Requirements: Vaporwave (Section 18)

The vaporwave soundtrack must capture the texture of "slowed-down 1980s shopping-mall cassette music."

**1. First, Synthesize an Original Source Track**

Create an original piece in the style of 1980s smooth jazz / shopping-mall background music.

Use:

* FM electric piano playing major-seventh and minor-ninth chords
* Fretless bass
* FM saxophone playing a variation of the main melody
* Soft drums with gated reverb

Set the tempo to 151.2 BPM.

Set the key four semitones higher than the main key.

Render it into an `AudioBuffer` using `OfflineAudioContext`.

**2. Process It Like a Cassette Tape**

Set:

`playbackRate = 0.7937`

This reduces the playback speed and pitch simultaneously by four semitones, bringing the music back to 120 BPM and the main key.

Apply:

* Long reverb lasting approximately 3–5 seconds
* A high wet-signal ratio
* A low-pass filter around 4 kHz to muffle the high frequencies
* Slight `detune` modulation using a low-frequency oscillator at approximately 0.5 Hz to simulate tape wobble
* A very subtle layer of tape hiss

**3. Entry and Exit Transitions**

When entering the section, create a "tape slowing down" effect that slides toward 0.79× playback speed.

When leaving the section, create a "tape speeding up" effect that returns playback to its original speed on a strong beat.

**4. Second-Measure Joke**

Take a half-beat segment of the source audio and loop it three or four times, creating a skipping-record effect.

Then resume normal playback.

## Technical Direction

### Drawing

Use p5.js (+ p5.brush).

Each frame must be a pure function of time `t`, allowing timeline scrubbing and frame-by-frame export.

### Project Structure

```
src/
  kit/       Shared drawing toolkit
  beat/      Beats and timeline
  rig/       Pelican and bicycle skeletal puppet
  scenes/    One file per section
  main/      Scheduling, transitions, camera

tools/       Rendering, screenshots, contact sheets

briefs/      Art briefs for each section

audio/       Synthesized soundtrack
```

### Pelican and Bicycle Rig

Build the pelican and bicycle as a parameterized skeletal puppet.

The same set of pose parameters should be passed to each artistic style's own drawing function.

This ensures that the motion remains continuous when the art style changes.

However, the pelican's visual appearance must change according to the style of each section.

For example, in the Nosferatu section, only its shadow appears.

### Scene Coordinates and Video Resolution

Each section is drawn in a 1000 × 1000 unit coordinate space.

Final video output resolution: 1920 × 1080.

### Frame Rate

First compare 30 fps and 60 fps using a segment with clearly visible camera panning, then decide which frame rate to use.

For the shadow-puppet, 8-bit, and chat-window GIF sections, quantize internal animation time to approximately 8–12 updates per second to preserve the jerky retro appearance.

Camera panning must remain unaffected by this quantization.

### Two Deliverables

**1. Browser Preview Page**

Include a playback control bar at the bottom with:

* Play/Pause
* Timeline scrubbing
* Current section name

Use real-time Web Audio.

**2. Finished MP4**

* Use Puppeteer to render the visuals frame by frame.
* Use `OfflineAudioContext` to render the audio offline into WAV.
* Use ffmpeg to combine the video and audio.

### Environment

* Node.js 20+
* Google Chrome
* ffmpeg

## Working Process

First, confirm the plan with me. Then work through the project in stages. At the end of each stage, stop and show me a demo.

### Stage 1 — Foundation

Build:

* Drawing toolkit
* Beat synchronization
* Intro subtitles
* Continuous road scroll
* Camera
* A pelican that pedals its bicycle
* 20 labeled placeholder color blocks
* Outro camera pullback

No audio yet.

Also complete one successful test of frame-by-frame export and contact-sheet generation.

Stop and show me the demo before proceeding.

### Stage 2 — Three Fully Developed Styles

First, fully develop three scenes with widely different artistic styles:

1. Saharan Rock Art
2. Song Dynasty Landscape Painting
3. Vertical Short-Form Video

Stop and show me the demo.

### Stage 3 — The Remaining 17 Sections

Write art briefs for the remaining 17 sections.

Delegate production to parallel subagents in batches of four or five sections.

After each batch:

* Generate contact sheets.
* Perform visual self-checks.
* Show me the results.

### Stage 4 — Music

Add the soundtrack.

Both the real-time version and offline-rendered version must synchronize correctly with the beats.

Stop and show me the demo.

### Stage 5 — Final Polish

Polish the entire film.

Export the finished video.

Begin by confirming the plan with me. Follow the five-stage process, and stop to show me a demo after each stage before continuing.
