#!/bin/sh
# Render each outro voice alone and print its loudness and peak.
cd "$(dirname "$0")/../.."
for v in "$@"; do
  r=$(node tools/audio.mjs --part outro --label "voice:$v\b" --check 2>&1)
  lv=$(echo "$r" | grep -m1 "^Level" | awk '{print $2}')
  pk=$(echo "$r" | grep -m1 "peak" | sed -E 's/.*peak (-?[0-9.]+) dBFS.*/\1/')
  echo "$v $lv $pk"
done
