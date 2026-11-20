#!/bin/bash
# full mix stats for rulings 1 and 2 ; arg1 = full wav, arg2 = slide-alone wav (optional)
cd "$(dirname "$0")/../.."
M="node dev/audio/song-measure.mjs"
W=${1:-out/audio/s05.wav}
echo "-- full: bar1 / pull-out / wide hold / push-in / F#3"
$M $W 29:31; $M $W 31:31.55; $M $W 31.55:32.2; $M $W 32.2:33; $M $W 33:33.2
$M $W 29:31 200:4000; $M $W 31:31.55 200:4000; $M $W 31.55:32.2 200:4000; $M $W 32.2:33 200:4000; $M $W 33:33.2 200:4000
if [ -n "$2" ]; then
echo "-- slide alone, 0.2 s windows 32.3-32.9 (u 3.3-3.9) and 32.2-33.0"
$M $2 32.3:32.9:0.2; $M $2 32.2:33.0:0.2; $M $2 32.3:32.9:0.2 400:4000; $M $2 32.2:33.0:0.2 400:4000; $M $2 32.75:32.95
fi
