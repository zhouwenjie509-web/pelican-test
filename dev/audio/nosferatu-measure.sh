#!/bin/sh
# renders the labelled instruments and prints the rulings' numbers
cd "$(dirname "$0")/../.."
node tools/audio.mjs --section 14 --quiet >/dev/null 2>&1
for l in door projector organ piano; do node tools/audio.mjs --section 14 --label "$l" --out out/audio/nosf-$l.wav --quiet >/dev/null 2>&1; done
B=dev/audio/nosferatu-band.mjs
echo "-- ruling 2: organ chord vs piano bar 1"
node $B out/audio/nosf-organ.wav 86.05 86.95
node $B out/audio/nosf-piano.wav 83 85
node $B out/audio/nosf-piano.wav 85 86
echo "-- ruling 3: creak vs the rest, 800-1600 Hz, 87.0-87.6"
node $B out/audio/nosf-door.wav 87.0 87.6 800:1600
node $B out/audio/s14.wav 87.0 87.6 800:1600 out/audio/nosf-door.wav
node $B out/audio/nosf-door.wav 87.03 87.6 800:1600
node $B out/audio/s14.wav 87.03 87.6 800:1600 out/audio/nosf-door.wav
