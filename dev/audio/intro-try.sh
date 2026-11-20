#!/bin/zsh
# Scratch: set the sfz-p envelope tail of 00-intro.js to $1 and report the sfz note's tuning alone.
cd "$(dirname "$0")/../.."
python3 - "$1" <<'PY'
import sys,re
p='audio/parts/00-intro.js'; s=open(p).read()
s,n=re.subn(r'env: \[\[0, 0\], \[0\.025, 1\.0\], \[0\.07, 0\.85\], .*?, release: 0\.1, label: "cellos sfz-p"', 'env: [[0, 0], [0.025, 1.0], [0.07, 0.85], '+sys.argv[1]+', release: 0.1, label: "cellos sfz-p"', s)
assert n==1
open(p,'w').write(s)
PY
node tools/audio.mjs --part intro --label sfz --check 2>&1 | grep -E "Lead|rror"
