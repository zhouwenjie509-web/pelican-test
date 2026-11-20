# The Pelican Test: the finished project

This archive holds the finished film and everything it was made from, as it stood on 2026-11-19 at the end of the fifth and last stage. `README.md` is the way in; `briefs/PROJECT_BRIEF.md` is the owner's brief; `briefs/POLISH.md` is the record of the last stage.

## What is here

| Path | What it is |
|---|---|
| `out/pelican-test.mp4` | The finished film: 2 min 17 s, 1920 × 1080, 60 frames a second, H.264 with AAC sound, 369 MB |
| `out/audio/pelican-test.wav` | Its soundtrack as rendered offline (48 kHz, 24-bit, stereo), with `pelican-test.json` (what was rendered and every declared cue) and `pelican-test.png` (a picture of it) |
| `index.html`, `src/` | The preview page and the picture: toolkit, beats, puppet, one scene file per section |
| `audio/` | The synthesized soundtrack: engine, and one part per section |
| `tools/` | Rendering, encoding, checks, measurements (`tools/export.mjs` runs the whole export) |
| `briefs/` | The owner's brief, the scene guide and the music guide, an art brief and a music brief for every section, the cue sheet, the notes of the reviews, the record of the final polish |
| `dev/` | Lab pages, experiments, the measuring scripts the briefs refer to, and the three scripts of the final polish (`dev/polish/`) |
| `package.json`, `package-lock.json` | The three dependencies, with their exact versions |
| `THIRD_PARTY_NOTICES.md` | Licences of what the project depends on |
| `.claude/launch.json` | The preview server's entry for the Claude desktop app (optional; `npm run dev` does the same) |

Every picture and every sound is made by this code. There are no image, video, audio or font files in the project other than the finished outputs above: the film, its soundtrack, and the picture of the soundtrack.

## What is not here, and how to get it back

- **`node_modules/`**: `npm install` (p5 2.4.0, p5.brush 3.0.0, puppeteer-core 25.17.0, as pinned in `package-lock.json`).
- **`frames/`**, the 8220 PNG frames the video was encoded from (26 GB): `npm run export` draws them again, byte for byte, in about five minutes and rebuilds the MP4 from them.
- **Earlier stage demos, contact sheets, test renders and scratch work**: superseded by the finished film; the tools make them again. Among them are the frames and short sound files that the review notes in `briefs/` cite as evidence (`out/shots/...`, `out/sheets/...`, `out/audio/review-...`): `tools/shot.mjs`, `tools/sheet.mjs` and `tools/audio.mjs --from A --to B` make such files again from the finished film, which is not always the state the note was written about.
- **Git history**: the project was never committed. `git init` in this folder starts one; `.gitignore` already leaves out `node_modules/`, `out/` and `frames/`.

## To use it

```bash
npm install
npm run dev        # then open http://localhost:5173/ : the film in the browser, with real-time sound
npm run export     # checks, every frame, the soundtrack, the MP4, and a verification of the result
```

It needs Node.js 22.12.0 or newer, Google Chrome, ffmpeg, and the fonts that come with macOS (on other systems the title cards fall back to generic families and will look different). The three helper scripts in `dev/polish/` also need Python 3 with Pillow; nothing else does.

## Checksums of the two finished files

```
out/pelican-test.mp4
  md5     2413e62418d63076296dbcc5449999a2
  sha256  a6cb1faa4de4606292be1d10a044fb454217e4bc2be82b6cc8d07b7ff0f8a92e
out/audio/pelican-test.wav
  md5     ddf50710feeaace605fa077854eb5a6e
  sha256  897f4e955282d3549771d916fc107685a8f91e2c729e341fe1ef1c2f545692c3
```

A rebuilt MP4 will not have the same checksum (the encoder is not required to be deterministic, and two offline renders of the sound differ in their last bit); `node tools/verify.mjs` is the check that a rebuilt file is the film.
