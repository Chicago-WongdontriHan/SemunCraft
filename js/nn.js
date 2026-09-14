// ── SEMUNCRAFT NETWORK ───────────────────────────────────────────────────────
// The trained policy network (PolicyValueNet in rl/ppo.py) in plain JavaScript, so
// a trained model runs in the game with no library or GPU. rl/export_web.py writes
// the weights to models/*.js, which register themselves in the global SemunModels.
// Loads as a classic <script> (global SemunNet) or in Node.
(function(root){
'use strict';
const SLOTS=82,ON_BOARD=19; // action slots per cell, and the "on the board" observation channel

let HALF=null;
// every 16-bit half-precision value, decoded once
function halfTable(){
  if(!HALF){
    HALF=new Float32Array(65536);
    for(let h=0;h<65536;h++){
      const sign=h&0x8000?-1:1,exp=(h>>10)&0x1f,frac=h&0x3ff;
      HALF[h]=exp===0?sign*Math.pow(2,-14)*(frac/1024)
        :exp===31?(frac?NaN:sign*Infinity)
        :sign*Math.pow(2,exp-15)*(1+frac/1024);
    }
  }
  return HALF;
}

function base64Bytes(text){
  if(typeof Buffer!=='undefined')return new Uint8Array(Buffer.from(text,'base64'));
  const bin=atob(text),out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);
  return out;
}

function readTensors(model){
  const bytes=base64Bytes(model.data),half=model.dtype==='float16',size=half?2:4,table=half?halfTable():null;
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),tensors={};
  let at=0;
  for(const[name,shape]of model.tensors){
    const n=shape.reduce((a,b)=>a*b,1),data=new Float32Array(n);
    for(let i=0;i<n;i++,at+=size)data[i]=half?table[view.getUint16(at,true)]:view.getFloat32(at,true);
    tensors[name]={shape,data};
  }
  if(at!==bytes.length)throw new Error('model data does not match its tensor list');
  return tensors;
}

// 3×3 convolution with zero padding on grid×grid planes: unfold the 3×3 patches, then dot products
function conv3x3(input,cin,grid,weight,bias,cout,out,cols){
  const P=grid*grid,K=cin*9;
  for(let y=0,p=0;y<grid;y++)for(let x=0;x<grid;x++,p++){
    for(let i=0;i<cin;i++){
      const plane=i*P,base=p*K+i*9;
      for(let ky=0;ky<3;ky++){
        const yy=y+ky-1;
        for(let kx=0;kx<3;kx++){
          const xx=x+kx-1;
          cols[base+ky*3+kx]=yy<0||yy>=grid||xx<0||xx>=grid?0:input[plane+yy*grid+xx];
        }
      }
    }
  }
  for(let o=0;o<cout;o++){
    const wBase=o*K,oBase=o*P,b=bias[o];
    for(let p=0;p<P;p++){
      const cBase=p*K;
      let s=b;
      for(let j=0;j<K;j++)s+=weight[wBase+j]*cols[cBase+j];
      out[oBase+p]=s;
    }
  }
}

// load(model) → {meta, forward(observation bytes) → Float32Array of action logits}
function load(model){
  const t=readTensors(model),meta=model.meta||{};
  const width=t['stem.weight'].shape[0],channels=t['stem.weight'].shape[1];
  let blocks=0;
  while(t['body.'+blocks+'.conv1.weight'])blocks++;
  const grid=meta.grid||11,P=grid*grid,numActions=P*SLOTS+1;
  const input=new Float32Array(channels*P),x=new Float32Array(width*P),y=new Float32Array(width*P),z=new Float32Array(width*P);
  const cols=new Float32Array(P*Math.max(channels,width)*9);

  function forward(obs){
    if(obs.length!==input.length)throw new Error('observation has '+obs.length+' values, the network expects '+input.length);
    for(let i=0;i<input.length;i++)input[i]=obs[i]/255;
    conv3x3(input,channels,grid,t['stem.weight'].data,t['stem.bias'].data,width,x,cols);
    for(let i=0;i<x.length;i++)if(x[i]<0)x[i]=0;
    for(let b=0;b<blocks;b++){
      const pre='body.'+b+'.';
      conv3x3(x,width,grid,t[pre+'conv1.weight'].data,t[pre+'conv1.bias'].data,width,y,cols);
      for(let i=0;i<y.length;i++)if(y[i]<0)y[i]=0;
      conv3x3(y,width,grid,t[pre+'conv2.weight'].data,t[pre+'conv2.bias'].data,width,z,cols);
      for(let i=0;i<x.length;i++){const v=x[i]+z[i];x[i]=v>0?v:0;}
    }
    // 1×1 convolution: 82 logits per cell, laid out as cell × 82 + slot like the encoding
    const cw=t['cell_logits.weight'].data,cb=t['cell_logits.bias'].data,logits=new Float32Array(numActions);
    for(let s=0;s<SLOTS;s++)for(let p=0;p<P;p++){
      let v=cb[s];
      for(let i=0;i<width;i++)v+=cw[s*width+i]*x[i*P+p];
      logits[p*SLOTS+s]=v;
    }
    // skip: a linear layer on the features averaged over the board's cells
    const board=ON_BOARD*P,sw=t['skip_logit.weight'].data;
    let cells=0,skip=t['skip_logit.bias'].data[0];
    for(let p=0;p<P;p++)cells+=input[board+p];
    for(let i=0;i<width;i++){
      let sum=0;
      for(let p=0;p<P;p++)sum+=x[i*P+p]*input[board+p];
      skip+=sw[i]*sum/Math.max(1,cells);
    }
    logits[numActions-1]=skip;
    return logits;
  }
  return{meta,channels,width,blocks,grid,numActions,forward};
}

// choose(net, encoder, state, {temperature, random}) picks a move for the side to move from the
// network's policy over its legal actions: temperature 1 plays as in training, lower is greedier,
// 0 always takes the most likely move
function choose(net,encoder,state,opts){
  opts=opts||{};
  const temperature=opts.temperature===undefined?1:opts.temperature,random=opts.random||Math.random;
  const legal=encoder.legalMap(state),keys=[...legal.keys()],logits=net.forward(encoder.observe(state));
  let best=keys[0];
  for(const k of keys)if(logits[k]>logits[best])best=k;
  if(temperature<=0)return{index:best,action:legal.get(best),probability:1};
  const scaled=keys.map(k=>logits[k]/temperature),top=Math.max(...scaled);
  const weights=scaled.map(v=>Math.exp(v-top)),total=weights.reduce((a,b)=>a+b,0);
  let r=random()*total,pick=keys.length-1;
  for(let i=0;i<keys.length;i++){r-=weights[i];if(r<=0){pick=i;break;}}
  return{index:keys[pick],action:legal.get(keys[pick]),probability:weights[pick]/total};
}

const SemunNet={load,choose,readTensors};
if(typeof module!=='undefined'&&module.exports)module.exports=SemunNet;
else root.SemunNet=SemunNet;
})(typeof globalThis!=='undefined'?globalThis:this);
