// Checks js/nn.js against PyTorch on the networks and positions written by rl/export_web.py,
// then plays one game between the two networks in the engine.
// Run by rl/export_web.py: node tests/nn.test.js <check.json>
'use strict';
const fs=require('fs'),path=require('path');
const E=require('../js/engine.js');
const {createEncoder}=require('../rl/encoding.js');
const Net=require('../js/nn.js');

const spec=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const observations=new Uint8Array(Buffer.from(spec.observations,'base64'));
const size=observations.length/spec.count;
const floats=text=>{const bytes=new Uint8Array(Buffer.from(text,'base64'));return new Float32Array(bytes.buffer,0,bytes.length/4);};
let failures=0;
const nets=[];

for(const m of spec.models){
  require(m.file);
  const name=path.basename(m.file,'.js'),net=Net.load(globalThis.SemunModels[name]);
  nets.push(net);
  const full=floats(m.logits),half=floats(m.halfLogits),A=net.numActions;
  let gapHalf=0,gapFull=0,disagree=0,ms=0;
  for(let i=0;i<spec.count;i++){
    const t0=performance.now(),out=net.forward(observations.subarray(i*size,(i+1)*size));
    ms+=performance.now()-t0;
    for(let k=0;k<A;k++){
      gapHalf=Math.max(gapHalf,Math.abs(out[k]-half[i*A+k]));
      gapFull=Math.max(gapFull,Math.abs(out[k]-full[i*A+k]));
    }
    let bestJs=-1,bestPy=-1;
    for(const k of spec.legal[i]){
      if(bestJs<0||out[k]>out[bestJs])bestJs=k;
      if(bestPy<0||full[i*A+k]>full[i*A+bestPy])bestPy=k;
    }
    if(bestJs!==bestPy)disagree++;
  }
  const ok=gapHalf<0.01;
  if(!ok)failures++;
  console.log((ok?'ok  ':'FAIL')+' '+name+' ('+net.blocks+' blocks x '+net.width+'): largest logit gap '+gapHalf.toExponential(1)
    +' vs PyTorch with the same half-precision weights, '+gapFull.toExponential(1)+' vs full precision; best legal move differs in '
    +disagree+'/'+spec.count+' positions; '+(ms/spec.count).toFixed(0)+' ms per position');
}

if(nets.length===2){
  // each network plays in the encoding it was trained on (its meta), with normal sight like the game's AI
  const enc=nets.map(n=>createEncoder({grid:n.grid,version:n.meta.encoding||1,sightPlane:false}));
  const s=E.newGame({seed:7,mode:'classic',maxTurns:300,aiSight:true}),random=E.makeRandom(3);
  const t0=performance.now();
  let moves=0;
  while(!s.over){const k=s.turn==='w'?0:1;E.step(s,Net.choose(nets[k],enc[k],s,{random}).action);moves++;}
  console.log('ok   a game between them: '+(s.winner==='draw'?'draw':(s.winner==='w'?'the first (White)':'the second (Black)')+' won')
    +' after '+moves+' moves, '+((performance.now()-t0)/moves).toFixed(0)+' ms per move');
}
process.exit(failures?1:0);
