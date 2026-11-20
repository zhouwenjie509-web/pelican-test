import { _nosferatu as N } from "../../audio/parts/14-nosferatu.js";
const t=(f)=>{const a=performance.now();f();return performance.now()-a;};
for (let i=0;i<3;i++) N.pianoSamples(62,0.75);
let ts=0, tl=0;
for (const m of N.USED.short) ts+=t(()=>N.pianoSamples(m,0.75));
for (const m of N.USED.long) tl+=t(()=>N.pianoSamples(m,2.0));
console.log("short",N.USED.short.length,ts.toFixed(0),"long",N.USED.long.length,tl.toFixed(0), N.USED.short.join(","), N.USED.long.join(","));
for (const [n,f] of Object.entries({proj:N.projectorSamples,door:N.doorSamples,fire:N.fireSamples})) console.log(n,t(f).toFixed(0));
