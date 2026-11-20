#!/bin/zsh
# Scratch: render each singer alone and print the worst dip / bump over its note changes. Run from the repo root.
for who in "caller:0" "man 1:0.013" "man 2:0.022" "man 3:0.007" "child:0.009"; do
  name=${who%%:*}; l=${who##*:}; f=out/audio/sahara-${name// /}-sweep.wav
  node tools/audio.mjs --section 1 --label "$name" --out $f > /dev/null 2>&1
  if [[ $name == caller ]]; then base=(5.5 5.75 6.0 6.5 6.75 7.0 7.5 7.75 8.0 9.0 9.5 9.75 10.0 10.5 10.75); elif [[ $name == child ]]; then base=(7.5 7.75 9.5 9.75 10.0 10.5 10.75); else base=(7.5 7.75 8.0 9.0 9.5 9.75 10.0 10.5 10.75); fi
  ts=(); for t in $base; do ts+=($(node -e "console.log(($t+$l).toFixed(3))")); done
  node dev/audio/sahara-xf.mjs $f $ts | node -e '
    const L=require("fs").readFileSync(0,"utf8").split("\n");let d=-99,dh=-99,b=-99,at="",ath="";
    for(const l of L){let m=l.match(/^(\S+): .*dip (\S+) dB/);if(m&&+m[2]>d){d=+m[2];at=m[1];}
      m=l.match(/against those (\S+) dB/);if(m&&+m[1]>dh){dh=+m[1];ath=l;}
      m=l.match(/bump: .* -> (\S+) dB/);if(m&&+m[1]>b)b=+m[1];}
    console.log(process.argv[1].padEnd(7),"worst dip vs 50 ms held",d,"at",at," | vs lowest held window",dh," | worst bump",b);' "$name"
done
