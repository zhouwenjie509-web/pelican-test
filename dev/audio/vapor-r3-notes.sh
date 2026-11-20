#!/bin/sh
# For each short note of the variation: the level of its fundamental (and of the tune's note it replaced)
# in an 80 ms window starting 20 ms after its film onset, in the before and after renders.
# args: wav
for spec in "107.785 F#4 G4" "107.910 G4 F#4" "108.535 F#4 A4" "108.660 E4 F#4" "108.785 F#4 A4" "108.910 A4 F#4" "109.535 B4 A4" "109.785 A4 B4" "109.910 F#4 A4" "111.410 A4 F#4" ; do
  set -- $spec
  printf "%s want %-3s (old %-3s): " "$1" "$2" "$3"
  node tools/audio-probe.mjs "$WAV" --at "$1" --len 0.08 --band 220:520 2>/dev/null | grep -E " (\*)? *[0-9.]+ Hz .* ($2|$3)[+-]" | awk '{printf "%s %s dB | ", $(NF), $(NF-4)}'
  echo
done
