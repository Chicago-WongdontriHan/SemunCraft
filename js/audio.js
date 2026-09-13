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
  heal:   ()=>{playTone(528,.2,'sine',.5);setTimeout(()=>playTone(660,.2,'sine',.4),120);},
  march:  ()=>playTone(220,.08,'triangle',.4),
  win:    ()=>{[440,550,660,880].forEach((f,i)=>setTimeout(()=>playTone(f,.3,'sine',.7),i*120));},
  lose:   ()=>{[440,370,330,220].forEach((f,i)=>setTimeout(()=>playTone(f,.3,'triangle',.6),i*130));},
  kingHit:()=>{playNoise(.2,1.2);[200,160,120].forEach((f,i)=>setTimeout(()=>playTone(f,.2,'sawtooth',.7),i*80));},
  select: ()=>playTone(440,.04,'sine',.3),
  newborn:()=>{playTone(880,.06,'sine',.5);setTimeout(()=>playTone(1046,.1,'sine',.4),60);},
};
