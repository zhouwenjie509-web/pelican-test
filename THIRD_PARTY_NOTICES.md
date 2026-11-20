# Third-party notices

This project's own source code contains no code copied from other projects. It depends on the components below, which are installed by `npm install` and are **not** vendored into this repository: the preview server serves the unmodified library files straight from `node_modules/`.

| Component | Version | License | Use |
|---|---|---|---|
| [p5.js](https://p5js.org) | 2.4.0 | LGPL-2.1 | Canvas, WebGL renderer and drawing API. Loaded unmodified as a separate file (`node_modules/p5/lib/p5.min.js`), so it can be replaced by the user. |
| [p5.brush](https://github.com/acamposuribe/p5.brush) | 3.0.0 | MIT, © 2023–2026 Alejandro Campos Uribe | Natural-media brush strokes and fills. Loaded unmodified (`node_modules/p5.brush/dist/p5.brush.js`). |
| [puppeteer-core](https://pptr.dev) | 25.17.0 | Apache-2.0 | Drives the locally installed Chrome for frame capture. No browser is downloaded. |
| [ffmpeg](https://ffmpeg.org) | system install | LGPL/GPL | Encodes frames and audio to MP4. Used as an external tool; not bundled. On macOS it is asked to encode the sound with the system's own AAC encoder (AudioToolbox, part of macOS); elsewhere with its built-in one. |

p5.brush in turn acknowledges [spectral.js](https://github.com/rvanwijnen/spectral.js) by Ronald van Wijnen (pigment mixing) and Tyler Hobbs's watercolour method; see its own README and license.

p5.js and p5.brush ship their licence texts in their package folders (`node_modules/p5/license.txt`, `node_modules/p5.brush/LICENSE.md`). puppeteer-core declares Apache-2.0 in its `package.json` and ships no licence file of its own; the text is at https://www.apache.org/licenses/LICENSE-2.0.

Installing these three brings 41 further packages with it (their dependencies), every one recorded with its version in `package-lock.json` and with its licence in its own `package.json`: MIT, ISC, BSD and Apache-2.0, and two worth naming because their code ends up inside `p5.min.js`: libtess (SGI Free Software License B 2.0) and pako (MIT and Zlib). None of them is copied into this repository.

## Fonts

Lettering uses fonts installed with macOS (among them Songti SC, Kaiti SC, Libian SC, Baoli SC, Weibei SC, Heiti SC, PingFang SC, Baskerville, Optima, Helvetica Neue, Chalkduster and Menlo; `briefs/SCENE_GUIDE.md` lists every family a scene may use). They are referenced by name only and are not included in this repository.

## Reference project

The production approach was learned from the documentation of [Tunai-0511/meme67-art-history](https://github.com/Tunai-0511/meme67-art-history) (code MIT, © 2026 Tunai-0511; film, cover, frames and audio all rights reserved). Nothing from that repository is included here: no code, media, voice samples, art-brief wording, scene compositions or jokes. Should a code snippet from it ever be reused, its MIT copyright and permission notice will be kept with the snippet and listed in this file.
