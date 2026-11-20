#!/bin/bash
# Scratch: sitar-alone band levels (full, 2-5 kHz, 2.5-9 kHz) over the A4 stroke and over bars 1-2.
F=${1:-out/audio/s08_sitar.wav}
for w in "48.0 0.4" "47.0 3.0"; do
  set -- $w
  echo "== at $1 len $2"
  node tools/audio-probe.mjs $F --at $1 --len $2 | head -1
  node tools/audio-probe.mjs $F --at $1 --len $2 --band 2000:5000 | head -1
done
