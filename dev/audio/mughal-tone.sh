#!/bin/bash
# Scratch: try a SITAR_TONE setting; print sitar-alone loudness, centroid and the 2-5 kHz gap (full rms minus band rms).
cd "$(dirname "$0")/../.."
for cfg in "$@"; do
  sed -i '' "s/^const SITAR_TONE = .*/const SITAR_TONE = { $cfg };/" audio/parts/08-mughal.js
  r=$(node tools/audio.mjs --section 8 --label sitar --check 2>&1)
  lufs=$(echo "$r" | grep "^Level" | awk '{print $2}'); cen=$(echo "$r" | grep "^Balance" | awk '{print $3}'); pk=$(echo "$r" | grep "^Wrote" | sed 's/.*peak \([-0-9.]*\) dBFS.*/\1/')
  g=$(bash dev/audio/mughal-band.sh | grep -v "==" | awk '{print $(NF-1)}' | paste -sd' ' - | awk '{printf "stroke %.1f/%.1f gap %.1f  bars %.1f/%.1f gap %.1f", $1,$2,$1-$2,$3,$4,$3-$4}')
  echo "$cfg | LUFS $lufs pk $pk cen $cen | $g"
done
