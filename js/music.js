// ── BACKGROUND MUSIC: medieval dances ────────────────────────────────────────
// Each map theme has its own modal tune, played on a synthesized recorder or
// shawm with lute, drone and frame drum. Whole phrases are scheduled slightly
// ahead of the audio clock so the rhythm stays steady; stopBgm() cancels
// everything still queued.
const MUSIC_MODES={dorian:[0,2,3,5,7,9,10],phrygian:[0,1,3,5,7,8,10],aeolian:[0,2,3,5,7,8,10]};
// notes: [scale degree (0 = tonic, 7 = octave up, -1 = below), length in units]
// chords: one root degree per bar for the lute
const MEDIEVAL_TUNES={
  // jungle: lively estampie in D Dorian on recorder
  jungle:{tonic:293.66,mode:'dorian',unit:0.3,bar:4,voice:'recorder',
    drum:[[0,'dum'],[1.5,'tek'],[2,'dum'],[3,'tek'],[3.5,'tek']],
    phrases:[
      {notes:[[0,1],[2,.5],[3,.5],[4,1],[3,.5],[2,.5],[1,1],[2,.5],[1,.5],[0,2]],chords:[0,6]},
      {notes:[[4,1],[5,.5],[6,.5],[7,1],[6,.5],[5,.5],[4,1.5],[3,.5],[4,2]],chords:[3,4]},
      {notes:[[7,1.5],[6,.5],[5,1],[4,1],[5,.5],[6,.5],[7,.5],[6,.5],[5,2]],chords:[2,4]},
      {notes:[[4,.5],[3,.5],[2,1],[3,.5],[4,.5],[2,1],[1,.5],[0,.5],[1,1],[0,2]],chords:[6,0]},
    ]},
  // desert: slow Phrygian lament in E on a nasal shawm
  desert:{tonic:329.63,mode:'phrygian',unit:0.4,bar:4,voice:'shawm',
    drum:[[0,'dum'],[1.5,'tek'],[2.5,'tek'],[3,'dum']],
    phrases:[
      {notes:[[0,1],[1,.5],[0,.5],[-1,1],[0,1],[2,1],[1,1],[0,2]],chords:[0,1]},
      {notes:[[3,1],[4,1],[5,.5],[4,.5],[3,1],[2,1],[1,.5],[2,.5],[1,2]],chords:[3,1]},
      {notes:[[4,2],[5,.5],[4,.5],[3,1],[4,1.5],[3,.5],[2,1],[1,1]],chords:[3,2]},
      {notes:[[2,1],[1,1],[0,.5],[1,.5],[2,1],[1,1],[0,3]],chords:[1,0]},
    ]},
  // ocean: lilting 6/8 carol in A Aeolian on recorder
  ocean:{tonic:440,mode:'aeolian',unit:0.24,bar:6,voice:'recorder',
    drum:[[0,'dum'],[3,'tek'],[5,'tek']],
    phrases:[
      {notes:[[0,2],[2,1],[4,2],[3,1],[2,2],[1,1],[2,3],[4,2],[5,1],[4,2],[2,1],[1,2],[2,1],[0,3]],chords:[0,2,4,0]},
      {notes:[[0,2],[2,1],[4,2],[3,1],[2,2],[1,1],[2,3],[4,2],[5,1],[4,2],[3,1],[4,2],[-1,1],[0,3]],chords:[0,2,6,0]},
      {notes:[[7,3],[6,2],[5,1],[4,2],[5,1],[4,3],[3,2],[4,1],[5,2],[4,1],[2,2],[1,1],[0,3]],chords:[5,3,6,0]},
      {notes:[[7,3],[6,2],[5,1],[4,2],[5,1],[4,3],[3,2],[2,1],[1,2],[-1,1],[0,6]],chords:[5,3,4,0]},
    ]},
};
const TUNE_FORM=[0,1,0,1,2,3,2,3]; // AA'AA' BB'BB', like the repeated sections of an estampie
let bgmTimer=null,bgmState=null,bgmNoise=null;

function tuneFreq(tune,deg){
  const steps=MUSIC_MODES[tune.mode],oct=Math.floor(deg/7);
  return tune.tonic*Math.pow(2,oct+steps[deg-oct*7]/12);
}

// keep a node until it finishes so stopBgm() can silence anything still queued
function bgmTrack(node){bgmNodes.push(node);node.onended=()=>{bgmNodes=bgmNodes.filter(n=>n!==node);};}

function bgmMelodyNote(tune,freq,t,dur){
  const ctx=audioCtx,osc=ctx.createOscillator(),amp=ctx.createGain(),vib=ctx.createOscillator(),vibAmt=ctx.createGain();
  const shawm=tune.voice==='shawm',peak=shawm?0.06:0.09;
  osc.type=shawm?'sawtooth':'triangle';
  osc.frequency.value=freq;
  vib.frequency.value=5.2;vibAmt.gain.value=freq*0.005;vib.connect(vibAmt);vibAmt.connect(osc.frequency);
  amp.gain.setValueAtTime(0.0001,t);
  amp.gain.linearRampToValueAtTime(peak,t+0.03);
  amp.gain.linearRampToValueAtTime(peak*0.75,t+dur*0.7);
  amp.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  if(shawm){const reed=ctx.createBiquadFilter();reed.type='bandpass';reed.frequency.value=freq*2.5;reed.Q.value=1.4;osc.connect(reed);reed.connect(amp);}
  else osc.connect(amp);
  amp.connect(bgmGain);
  osc.start(t);osc.stop(t+dur+0.02);vib.start(t);vib.stop(t+dur+0.02);
  bgmTrack(osc);bgmTrack(vib);
}

function bgmLuteNote(freq,t){
  const ctx=audioCtx,osc=ctx.createOscillator(),tone=ctx.createBiquadFilter(),amp=ctx.createGain();
  osc.type='sawtooth';osc.frequency.value=freq;
  tone.type='lowpass';tone.frequency.setValueAtTime(freq*6,t);tone.frequency.exponentialRampToValueAtTime(freq*1.5,t+0.4);
  amp.gain.setValueAtTime(0.0001,t);amp.gain.linearRampToValueAtTime(0.045,t+0.005);amp.gain.exponentialRampToValueAtTime(0.0001,t+0.9);
  osc.connect(tone);tone.connect(amp);amp.connect(bgmGain);
  osc.start(t);osc.stop(t+0.95);bgmTrack(osc);
}

function bgmDrumHit(t,hit){
  const ctx=audioCtx,amp=ctx.createGain();amp.connect(bgmGain);
  if(hit==='dum'){
    const osc=ctx.createOscillator();osc.type='sine';
    osc.frequency.setValueAtTime(120,t);osc.frequency.exponentialRampToValueAtTime(50,t+0.2);
    amp.gain.setValueAtTime(0.0001,t);amp.gain.linearRampToValueAtTime(0.14,t+0.005);amp.gain.exponentialRampToValueAtTime(0.0001,t+0.35);
    osc.connect(amp);osc.start(t);osc.stop(t+0.36);bgmTrack(osc);
  }else{
    if(!bgmNoise){bgmNoise=ctx.createBuffer(1,Math.floor(ctx.sampleRate*0.2),ctx.sampleRate);const d=bgmNoise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
    const src=ctx.createBufferSource(),skin=ctx.createBiquadFilter();
    src.buffer=bgmNoise;skin.type='bandpass';skin.frequency.value=1900;skin.Q.value=0.9;
    amp.gain.setValueAtTime(0.045,t);amp.gain.exponentialRampToValueAtTime(0.0001,t+0.08);
    src.connect(skin);skin.connect(amp);src.start(t);src.stop(t+0.1);bgmTrack(src);
  }
}

// hurdy-gurdy style drone on the tonic and fifth, retuned when the map theme changes
function bgmSetDrone(tune,t){
  const freqs=[tune.tonic/2,tune.tonic*0.75];
  if(bgmState.drone){bgmState.drone.forEach((o,k)=>o.frequency.setTargetAtTime(freqs[k],t,0.2));return;}
  const ctx=audioCtx,tone=ctx.createBiquadFilter(),amp=ctx.createGain();
  tone.type='lowpass';tone.frequency.value=700;
  amp.gain.setValueAtTime(0.0001,t);amp.gain.linearRampToValueAtTime(0.022,t+1.5);
  tone.connect(amp);amp.connect(bgmGain);
  bgmState.drone=freqs.map(f=>{const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=f;o.connect(tone);o.start(t);bgmNodes.push(o);return o;});
}

// schedules one phrase starting at time t; returns its length in seconds
function bgmPlayPhrase(tune,phrase,t,ornate){
  const u=tune.unit;
  let pos=0;
  phrase.notes.forEach(([deg,len])=>{
    const nt=t+pos*u,dur=len*u*0.92,f=tuneFreq(tune,deg);
    // ornament: a quick upper-neighbour grace note, as a medieval player might add
    if(ornate&&len>=1&&Math.random()<0.3){bgmMelodyNote(tune,tuneFreq(tune,deg+1),nt,0.07);bgmMelodyNote(tune,f,nt+0.07,dur-0.07);}
    else bgmMelodyNote(tune,f,nt,dur);
    pos+=len;
  });
  phrase.chords.forEach((root,b)=>{
    const bt=t+b*tune.bar*u,roll=tune.bar/3*u;
    // lute: root, fifth and octave rolled across the bar, with the frame drum underneath
    [root-7,root-3,root].forEach((deg,k)=>bgmLuteNote(tuneFreq(tune,deg),bt+k*roll));
    tune.drum.forEach(([off,hit])=>bgmDrumHit(bt+off*u,hit));
  });
  return phrase.chords.length*tune.bar*u;
}

function bgmTick(){
  if(!bgmPlaying)return;
  const ctx=audioCtx,s=bgmState;
  if(s.t<ctx.currentTime)s.t=ctx.currentTime+0.05; // the tab was throttled; don't pile up late notes
  while(s.t-ctx.currentTime<0.8){
    const tune=MEDIEVAL_TUNES[mapTheme]||MEDIEVAL_TUNES.jungle;
    if(s.theme!==mapTheme){s.theme=mapTheme;s.step=0;bgmSetDrone(tune,s.t);}
    if(s.step>=TUNE_FORM.length){
      // breathe for one bar (drone and drum only), then dance again with more ornaments
      tune.drum.forEach(([off,hit])=>bgmDrumHit(s.t+off*tune.unit,hit));
      s.t+=tune.bar*tune.unit;s.step=0;s.round++;
      continue;
    }
    s.t+=bgmPlayPhrase(tune,tune.phrases[TUNE_FORM[s.step]],s.t,s.round>0||s.step>=4);
    s.step++;
  }
  bgmTimer=setTimeout(bgmTick,250);
}

function startBgm(){
  if(bgmPlaying)return;
  bgmPlaying=true;
  const ctx=getAudioCtx();
  bgmState={t:ctx.currentTime+0.2,theme:null,step:0,round:0,drone:null};
  bgmTick();
}

function stopBgm(){
  bgmPlaying=false;
  if(bgmTimer){clearTimeout(bgmTimer);bgmTimer=null;}
  const ctx=audioCtx;
  if(ctx)bgmNodes.forEach(n=>{try{n.stop(ctx.currentTime+0.05);}catch(e){}});
  bgmNodes=[];bgmState=null;
}
