# Tools of the final polish

Three small scripts written for Stage 5 (see `briefs/POLISH.md`). They are not needed to play or export the film; they are what makes a late change safe. They need Python 3 with Pillow.

| Script | What it answers |
|---|---|
| `changed.py` | What did my change do to the picture, and where? Renders a stretch as the code now stands and compares every frame, pixel for pixel, with the frames of the finished film (`frames/final`). |
| `glyph.py` | How tall is this lettering on screen? Measures the ink inside a box of a rendered frame, for the title-card rule (Chinese name at least 44 px, capitals and digits of the other lines at least 26 px at 1080p). |
| `compare-films.py` | Which stretches of the whole film differ between two full renders? |

The frames of the finished film are not kept in the repository (26 GB). `node tools/render.mjs --fps 60 --out frames/final` draws them again, byte for byte, in about five minutes; `npm run export` does that and everything after it.
