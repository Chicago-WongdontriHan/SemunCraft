// ── AUDIO SYSTEM ─────────────────────────────────────────────────────────────
let audioCtx=null;
let bgmGain=null,sfxGain=null;
let bgmNodes=[],bgmPlaying=false,bgmPaused=false;
let bgmVol=0.35,sfxVol=0.70;

function getAudioCtx(){
  if(!audioCtx){audioCtx=new(window.AudioContext||window.webkitAudioContext)();bgmGain=audioCtx.createGain();bgmGain.gain.value=bgmVol;bgmGain.connect(audioCtx.destination);sfxGain=audioCtx.createGain();sfxGain.gain.value=sfxVol;sfxGain.connect(audioCtx.destination);}
  if(audioCtx.state==='suspended')audioCtx.resume();
  return audioCtx;
}

function setBgmVol(v){bgmVol=v/100;document.getElementById('bgm-val').textContent=v;if(bgmGain)bgmGain.gain.setTargetAtTime(bgmVol,getAudioCtx().currentTime,.05);}
function setSfxVol(v){sfxVol=v/100;document.getElementById('sfx-val').textContent=v;if(sfxGain)sfxGain.gain.setTargetAtTime(sfxVol,getAudioCtx().currentTime,.05);}
function toggleSettings(){const m=document.getElementById('settings-modal');m.style.display=m.style.display==='flex'?'none':'flex';}
function toggleBgm(){
  const btn=document.getElementById('btn-bgm-toggle');
  if(bgmPaused){startBgm();bgmPaused=false;if(btn)btn.textContent='⏸ Pause BGM';}
  else{stopBgm();bgmPaused=true;if(btn)btn.textContent='▶ Resume BGM';}
}

// ── BGM: procedural ambient loop ──────────────────────────────────────────────
// startBgm() / stopBgm() live in music.js (medieval dance tunes per map theme)

// ── SFX ──────────────────────────────────────────────────────────────────────
function playTone(freq,dur,type='square',vol=1){
  const ctx=getAudioCtx();
  const osc=ctx.createOscillator();
  const env=ctx.createGain();
  osc.type=type;osc.frequency.value=freq;
  env.gain.setValueAtTime(vol*sfxVol*0.4,ctx.currentTime);
  env.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
  osc.connect(env);env.connect(sfxGain);
  osc.start(ctx.currentTime);osc.stop(ctx.currentTime+dur+.05);
}

function playNoise(dur,vol=1){
  const ctx=getAudioCtx();
  const buf=ctx.createBuffer(1,ctx.sampleRate*dur,ctx.sampleRate);
  const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  const src=ctx.createBufferSource();src.buffer=buf;
  const env=ctx.createGain();const flt=ctx.createBiquadFilter();
  flt.type='bandpass';flt.frequency.value=400;flt.Q.value=0.5;
  env.gain.setValueAtTime(vol*sfxVol*0.25,ctx.currentTime);
  env.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
  src.connect(flt);flt.connect(env);env.connect(sfxGain);
  src.start(ctx.currentTime);
}

// Named SFX
const SFX={
  spawn:  ()=>{playTone(523,.08,'sine',.8);setTimeout(()=>playTone(659,.12,'sine',.6),80);},
  move:   ()=>playTone(330,.06,'triangle',.5),
  attack: ()=>{playNoise(.12,.9);playTone(180,.1,'sawtooth',.5);},
  hit:    ()=>{playNoise(.08,.8);playTone(150,.08,'square',.4);},
  kill:   ()=>{playNoise(.18,1);for(let i=0;i<3;i++)setTimeout(()=>playTone(120-i*20,.1,'sawtooth',.5),i*60);},
  merge:  ()=>{[440,550,660].forEach((f,i)=>setTimeout(()=>playTone(f,.15,'sine',.6),i*70));},
  // extracting: a dip into the spring, then the Elixir rising in three bright drops
  extract:()=>{const t=getAudioCtx().currentTime+.01;
    sfxNoise({t,d:.12,vol:.3,filters:[['bandpass',900,2]]});
    sfxTone({f:320,to:620,glide:.08,t,d:.12,vol:.35});
    [659,880,1175].forEach((f,k)=>sfxTone({f,t:t+.1+k*.06,d:.45,vol:.24,attack:.015,vib:[7,.005]}));},
  // fortifying: a helmet clanks on, then the pawn's own two notes, a step higher and prouder
  fortify:()=>{const t=getAudioCtx().currentTime+.01;
    sfxNoise({t,d:.07,vol:.35,filters:[['highpass',2600]]});
    sfxBell(1760,t,.3,.24);sfxBell(1320,t+.08,.4,.2);
    sfxTone({type:'triangle',f:660,to:990,glide:.05,t:t+.18,d:.1,vol:.7});
    sfxTone({type:'triangle',f:880,to:1480,glide:.06,t:t+.27,d:.18,vol:.6});},
  // scrying: a thin rising shimmer, like a held breath
  scry:   ()=>{const t=getAudioCtx().currentTime+.01;
    [784,1047,1319].forEach((f,k)=>sfxTone({f,t:t+k*.07,d:.5,vol:.18,attack:.02,vib:[6,.004]}));
    sfxTone({f:2093,t:t+.2,d:.7,vol:.1,attack:.05});},
  // healing: a warm swell with a sparkle rising through it
  heal:   ()=>{const t=getAudioCtx().currentTime+.01;
    [523,659].forEach(f=>sfxTone({f,t,d:.75,vol:.4,attack:.12,vib:[5,.006]}));
    [1047,1319,1568,2093].forEach((f,k)=>sfxTone({f,t:t+.06+k*.07,d:.38,vol:.25}));},
  march:  ()=>playTone(220,.08,'triangle',.4),
  win:    ()=>{[440,550,660,880].forEach((f,i)=>setTimeout(()=>playTone(f,.3,'sine',.7),i*120));},
  lose:   ()=>{[440,370,330,220].forEach((f,i)=>setTimeout(()=>playTone(f,.3,'triangle',.6),i*130));},
  kingHit:()=>{playNoise(.2,1.2);[200,160,120].forEach((f,i)=>setTimeout(()=>playTone(f,.2,'sawtooth',.7),i*80));},
  select: ()=>playTone(440,.04,'sine',.3),
  newborn:()=>{playTone(880,.06,'sine',.5);setTimeout(()=>playTone(1046,.1,'sine',.4),60);},
  // a piece's own voice when it comes onto the board (spawned or merged) and when it falls
  arrive: type=>{const v=PIECE_VOICES[type];if(v)v.arrive(getAudioCtx().currentTime+.01);},
  fall:   type=>{const v=PIECE_VOICES[type];if(v)v.fall(getAudioCtx().currentTime+.01);},
};

// ── PIECE VOICES ─────────────────────────────────────────────────────────────
// Every piece type has a voice of its own, heard when one arrives (spawned or merged) and when
// one falls; a fall is the same voice sinking:
//   pawn    a small squeaky pip            knight  hoofbeats and a whinny
//   bishop  chapel bells                   rook    a stone thud and a low horn
//   queen   a bright trumpet fanfare       king    a deep royal horn over a drum
//   siege   iron clanks and a cannon boom
// Short hits are tuned knocks rather than noise bursts, and every sound starts from silence
// (a gain node starts at full volume, which lets the first instant out as a click).
// sfxTone({type, f, to (glide target), glide (s), t, d, vol, attack, low (low-pass Hz), vib: [rate, depth]})
function sfxTone(o){
  const ctx=getAudioCtx(),t=o.t,osc=ctx.createOscillator(),env=ctx.createGain();
  osc.type=o.type||'sine';
  osc.frequency.setValueAtTime(o.f,t);
  if(o.to)osc.frequency.exponentialRampToValueAtTime(o.to,t+(o.glide||o.d));
  let out=osc;
  if(o.low){const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=o.low;out.connect(lp);out=lp;}
  if(o.vib){const lfo=ctx.createOscillator(),depth=ctx.createGain();lfo.frequency.value=o.vib[0];depth.gain.value=o.f*o.vib[1];
    lfo.connect(depth);depth.connect(osc.frequency);lfo.start(t);lfo.stop(t+o.d+.05);}
  const peak=Math.max(1e-4,(o.vol||1)*sfxVol*.4);
  env.gain.value=0;env.gain.setValueAtTime(0,t);
  env.gain.linearRampToValueAtTime(peak,t+(o.attack||.008));
  env.gain.exponentialRampToValueAtTime(1e-4,t+o.d);
  out.connect(env);env.connect(sfxGain);
  osc.start(t);osc.stop(t+o.d+.05);
}
// filtered noise for rumbles and blasts: filters [[type, Hz, Q]]
let sfxNoiseBuf=null;
function sfxNoise(o){
  const ctx=getAudioCtx(),t=o.t;
  if(!sfxNoiseBuf||sfxNoiseBuf.sampleRate!==ctx.sampleRate){
    sfxNoiseBuf=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);
    const n=sfxNoiseBuf.getChannelData(0);for(let i=0;i<n.length;i++)n[i]=Math.random()*2-1;
  }
  const src=ctx.createBufferSource(),env=ctx.createGain();src.buffer=sfxNoiseBuf;
  let out=src;
  (o.filters||[]).forEach(([type,freq,q])=>{const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=freq;if(q)f.Q.value=q;out.connect(f);out=f;});
  const peak=Math.max(1e-4,(o.vol||1)*sfxVol*.4);
  env.gain.value=0;env.gain.setValueAtTime(0,t);
  env.gain.linearRampToValueAtTime(peak,t+(o.attack||.01));
  env.gain.exponentialRampToValueAtTime(1e-4,t+o.d);
  out.connect(env);env.connect(sfxGain);src.start(t);src.stop(t+o.d+.05);
}
// a struck bell: a sine with a bell's inharmonic partials
const sfxBell=(f,t,d,vol)=>[[1,1],[2.76,.35],[5.4,.14]].forEach(([m,a])=>sfxTone({f:f*m,t,d:m>1?d*.6:d,vol:vol*a,attack:.004}));

const PIECE_VOICES={
  pawn:{
    arrive:t=>{sfxTone({type:'triangle',f:620,to:980,glide:.05,t,d:.09,vol:.8});
      sfxTone({type:'triangle',f:830,to:1320,glide:.06,t:t+.08,d:.14,vol:.7});},
    fall:t=>{sfxTone({type:'triangle',f:900,to:280,glide:.2,t,d:.24,vol:.8});
      sfxTone({f:240,to:150,t:t+.22,d:.12,vol:.5});},
  },
  knight:{
    // two hoofbeats, then a whinny that climbs and shakes back down
    arrive:t=>{
      [[0,520],[.12,430]].forEach(([o,f])=>{sfxTone({f,to:f/2,t:t+o,d:.08,vol:.9});
        sfxTone({type:'triangle',f:f*2.1,to:f*1.5,t:t+o,d:.035,vol:.25});});
      sfxTone({type:'sawtooth',f:620,to:1150,glide:.09,t:t+.24,d:.12,vol:.32,low:2400});
      sfxTone({type:'sawtooth',f:1150,to:560,glide:.34,t:t+.34,d:.38,vol:.32,low:2400,vib:[17,.045]});},
    // a long, sinking whinny and the thud of the fall
    fall:t=>{sfxTone({type:'sawtooth',f:980,to:360,glide:.55,t,d:.6,vol:.32,low:1800,vib:[11,.05]});
      sfxTone({f:150,to:55,t:t+.55,d:.28,vol:1});},
  },
  bishop:{
    // chapel bells ringing up a major chord
    arrive:t=>[1047,1319,1568,2093].forEach((f,k)=>sfxBell(f,t+k*.08,.9,.32)),
    // and ringing down in minor, slower
    fall:t=>[1568,1245,1047,784].forEach((f,k)=>sfxBell(f,t+k*.13,1.1,.3)),
  },
  rook:{
    // a stone block set down, then a low horn from the battlements
    arrive:t=>{sfxTone({f:130,to:55,t,d:.32,vol:1.1});
      sfxNoise({t,d:.22,vol:.3,filters:[['lowpass',500]]});
      [[147,.45],[220,.25]].forEach(([f,vol])=>sfxTone({type:'sawtooth',f,t:t+.14,d:.52,vol,low:900,attack:.06,vib:[5,.008]}));},
    // the tower crumbles: falling stones and a rumble
    fall:t=>{[[0,170],[.1,140],[.22,110],[.3,90]].forEach(([o,f])=>sfxTone({f,to:f*.45,t:t+o,d:.22,vol:.9}));
      sfxNoise({t,d:.7,vol:.4,attack:.04,filters:[['lowpass',600]]});},
  },
  queen:{
    // a bright little trumpet fanfare, ta-ta-taaa, with a glint on top
    arrive:t=>{[[784,0,.1],[1047,.1,.1],[1319,.2,.42]].forEach(([f,o,d])=>{
        sfxTone({type:'sawtooth',f,t:t+o,d,vol:.45,low:3200,attack:.015,vib:d>.2?[6,.012]:null});
        sfxTone({type:'square',f:f*2,t:t+o,d:d*.8,vol:.07,low:4000,attack:.015});});
      sfxBell(2637,t+.22,.7,.15);},
    // the fanfare falls away in minor
    fall:t=>[[659,0,.14],[523,.14,.14],[440,.28,.55]].forEach(([f,o,d])=>
      sfxTone({type:'sawtooth',f,to:d>.2?f*.94:null,t:t+o,d,vol:.45,low:2200,attack:.02,vib:d>.2?[5,.015]:null})),
  },
  king:{
    // a deep royal horn over a drum
    arrive:t=>{sfxTone({f:98,to:50,t,d:.4,vol:1});
      [[147,0,.25],[196,.18,.55]].forEach(([f,o,d])=>sfxTone({type:'sawtooth',f,t:t+.05+o,d,vol:.4,low:1000,attack:.05,vib:[5,.01]}));},
    // the horn sinks and a gong sounds
    fall:t=>{[[196,0,.3],[147,.25,.3],[110,.5,.8]].forEach(([f,o,d])=>sfxTone({type:'sawtooth',f,t:t+o,d,vol:.4,low:900,attack:.04,vib:[4.5,.012]}));
      sfxBell(110,t+.5,2,.45);sfxTone({f:90,to:40,t:t+.5,d:.6,vol:1});},
  },
  mage:{
    // the stone of the tower settles, then a rising shimmer of bells: the bishop's light, made bigger
    arrive:t=>{sfxTone({f:130,to:70,t,d:.3,vol:.9});
      [784,988,1175,1568,1976].forEach((f,k)=>sfxBell(f,t+.08+k*.06,.9,.26));
      sfxTone({f:392,t:t+.1,d:.9,vol:.2,attack:.2,vib:[5,.01]});},
    // the light goes out: the bells fall and a low note sinks away
    fall:t=>{[1976,1568,1175,784].forEach((f,k)=>sfxBell(f,t+k*.1,.8,.22));
      sfxTone({f:330,to:110,t:t+.1,d:.8,vol:.4,vib:[7,.02]});},
  },
  siege:{
    // iron clanks as the tower is bolted together, then the cannon's boom
    arrive:t=>{[0,.11].forEach(o=>{sfxTone({type:'triangle',f:1180,to:1020,t:t+o,d:.12,vol:.3});
        sfxTone({type:'square',f:196,t:t+o,d:.08,vol:.22,low:1200});});
      sfxTone({f:110,to:38,t:t+.25,d:.45,vol:1.1});
      sfxNoise({t:t+.25,d:.4,vol:.45,filters:[['lowpass',420]]});},
    // blown apart: a boom, a rumble and scattering iron
    fall:t=>{sfxTone({f:100,to:32,t,d:.6,vol:1.2});
      sfxNoise({t,d:.8,vol:.6,filters:[['lowpass',900]]});
      [[.16,1760],[.3,2350],[.42,1980]].forEach(([o,f])=>sfxTone({type:'triangle',f,to:f*.85,t:t+o,d:.14,vol:.18}));},
  },
};
