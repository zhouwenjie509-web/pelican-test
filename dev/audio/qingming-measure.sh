#!/bin/sh
# Scratch measurements for the qingming review rulings. Renders stems, prints RMS lines.
cd "$(dirname "$0")/../.." || exit 1
node tools/audio.mjs --section 6 --quiet >/dev/null 2>&1
node tools/audio.mjs --section 6 --label '^dizi' --quiet >/dev/null 2>&1
node tools/audio.mjs --section 6 --label '^(?!dizi)' --quiet >/dev/null 2>&1
node tools/audio.mjs --section 6 --label '^crown' --quiet >/dev/null 2>&1
P="node tools/audio-probe.mjs"
r() { printf '%-44s ' "$*"; $P "$@" | head -1 | sed 's/.*   peak/peak/'; }
echo "== 1. dizi A5 (36.05, 0.4)"
$P out/audio/s06_-dizi.wav --at 36.05 --len 0.4 --peaks 8 | grep " Hz "
$P out/audio/s06_-dizi.wav --at 36.05 --len 0.4 | grep centroid
r out/audio/s06_-dizi.wav --at 36.05 --len 0.4
r out/audio/s06_-dizi.wav --at 36.05 --len 0.4 --band 2000:5000
r out/audio/s06_-dizi.wav --at 35.0 --len 6
r out/audio/s06_-dizi.wav --at 35.0 --len 6 --band 2000:5000
echo "== 2. crown (38.3-38.8)"
r out/audio/s06_-crown.wav --at 38.3 --len 0.5 --band 100:600
r out/audio/s06_-crown.wav --at 38.3 --len 0.25 --band 100:600
r out/audio/s06_-crown.wav --at 38.55 --len 0.25 --band 100:600
r out/audio/s06_-dizi.wav --at 38.3 --len 0.5
r out/audio/s06_-dizi.wav --at 38.3 --len 0.25
r out/audio/s06_-dizi.wav --at 38.55 --len 0.25
r out/audio/s06_-dizi.wav --at 38.0 --len 0.3
r out/audio/s06.wav --at 38.0 --len 0.05
r out/audio/s06.wav --at 38.05 --len 0.25
r out/audio/s06.wav --at 35.0 --len 0.05
echo "== 3. bar 3 band vs dizi"
for t in 35 36 39 40; do r out/audio/s06_-dizi-.wav --at $t --len 1; r out/audio/s06_-dizi.wav --at $t --len 1; done
