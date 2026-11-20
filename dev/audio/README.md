# Measuring scripts and notes of the soundtrack's arrangers

Scratch work that the music briefs (`briefs/music/*.md`) refer to: small scripts with which one part's arranger or fixer measured a sound (levels, peaks, onsets, tuning, bands), and a few text files with what they printed. They are kept as the evidence behind figures in the briefs, not as tools of the project; `tools/audio.mjs`, `tools/audio-probe.mjs` and `tools/audio-check-all.mjs` are the tools.

- The `.mjs`, `.js` and `.sh` scripts are run from the project's root (`node dev/audio/han-peak.mjs`); the shell scripts find the root from their own place. Many read WAV files under `out/audio/` that a check has to render first (`node tools/audio.mjs --section N --check`), and some belong to a state of a part that has since changed: read them as a record. `qingming-seeds.sh` needs a test module that was not kept.
- `intro-before.js`, `intro-current.js`, `shortvideo-after.js` and `shortvideo-before-review.js` are copies of files from `audio/parts/`, kept for comparison. Their imports (`../engine/...`) only resolve from `audio/parts/`: read them, or copy one back there to hear it.
