#!/bin/sh
# scratch: scan the large gong's phase seed: crown pre-limit peak, and body (100-600 Hz) per 100 ms over u 3.3-3.8
cd "$(dirname "$0")/../.." || exit 1
for sd in "$@"; do
  sed "s/    seed: 65,/    seed: $sd,/; s#\"../engine/#\"../../audio/engine/#g" audio/parts/06-qingming.js > dev/audio/qingming-seedtest.js
  node --input-type=module -e "
const m=(await import('./dev/audio/qingming-seedtest.js')).default;
const { bandpass } = await import('./tools/lib/sound.mjs');
const [L,R]=m._crownSamples(); const x=new Float32Array(L.length); for(let i=0;i<x.length;i++) x[i]=(L[i]+R[i])/2;
const b=bandpass(x,48000,100,600); const w=[];
for(let a=0.3;a<0.79;a+=0.1){let s=0;for(let i=Math.round(a*48000);i<Math.round((a+0.1)*48000);i++)s+=b[i]*b[i];w.push((10*Math.log10(s/4800)).toFixed(1));}
console.log('$sd', m._crownPreLimitPeak().toFixed(3), w.join(' '));"
done
rm -f dev/audio/qingming-seedtest.js
