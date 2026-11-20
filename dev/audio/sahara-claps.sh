#!/bin/sh
# Claps against voices in 1-5 kHz: the first 10 ms row of --env at each clap onset (bars 2 and 3).
# usage: sh dev/audio/sahara-claps.sh <suffix>   (renders sahara-claps-<suffix>.wav and sahara-voices-<suffix>.wav)
cd "$(dirname "$0")/../.." || exit 1
S=${1:-now}
node tools/audio.mjs --section 1 --label claps --out out/audio/sahara-claps-$S.wav --quiet > /dev/null 2>&1
node tools/audio.mjs --section 1 --label "caller|man|child" --out out/audio/sahara-voices-$S.wav --quiet > /dev/null 2>&1
for t in 7.5 9.5 10.5; do
  c=$(node tools/audio-probe.mjs out/audio/sahara-claps-$S.wav --at $t --len 0.04 --band 1000:5000 --env | sed -n 3p | awk '{print $3}')
  v=$(node tools/audio-probe.mjs out/audio/sahara-voices-$S.wav --at $t --len 0.04 --band 1000:5000 --env | sed -n 3p | awk '{print $3}')
  echo "film $t: claps $c dB, voices $v dB, claps over voices $(echo "$c - $v" | bc) dB"
done
