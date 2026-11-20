#!/bin/bash
# compare the "?" key against an ordinary key tick (vel 1 at u 4.5) by band
P="node tools/audio-probe.mjs"
for b in "" "--band 5000:12000" "--band 2000:3000"; do
  echo "== band ${b:-broad}"
  echo -n "tick u4.5   : "; $P out/audio/s17_tick.wav --at 105.5 --len 0.03 $b | grep -E "peak" | sed 's/.*peak/peak/'
  echo -n "? down u4.0 : "; $P out/audio/s17_question.wav --at 105.0 --len 0.03 $b | grep -E "peak" | sed 's/.*peak/peak/'
  echo -n "? up u4.075 : "; $P out/audio/s17_question.wav --at 105.07 --len 0.03 $b | grep -E "peak" | sed 's/.*peak/peak/'
done
