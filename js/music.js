// ── BACKGROUND MUSIC: medieval dances with a band ────────────────────────────
// Each map theme has its own modal tune in estampie form (sections A and B, each
// phrase repeated). Each section has its own ensemble, and the two sections trade
// ensembles every time the tune comes around, so the colour keeps changing:
//   leads          recorder, shawm, fiddle (vielle), harp
//   accompaniment  lute chords or harp arpeggios, a bass on the strong beats, a drone,
//                  bells on phrase starts and a parallel-fifth second voice on repeats
//   drums          frame drum, rim clicks, woodblock, tambourine, finger cymbals,
//                  with a fill at the end of every second phrase
// Everything is synthesized with Web Audio and scheduled slightly ahead of the
// audio clock so the beat stays steady; stopBgm() cancels anything still queued.
const MUSIC_MODES={dorian:[0,2,3,5,7,9,10],phrygian:[0,1,3,5,7,8,10],aeolian:[0,2,3,5,7,8,10],mixolydian:[0,2,4,5,7,9,10]};
// notes: [scale degree (0 = tonic, 7 = octave up, -1 = below), length in units]
// chords: one root degree per bar
// grooves: [offset in units within the bar, drum, velocity]
const MEDIEVAL_TUNES={
  // forest: lively estampie in D Dorian
  forest:{tonic:293.66,mode:'dorian',unit:0.28,bar:4,
    sections:[{lead:'recorder',accomp:'lute',groove:'light'},{lead:'fiddle',accomp:'harp',groove:'full'}],
    grooves:{
      light:[[0,'dum',1],[2,'tek',.7],[3,'tek',.5],[3.5,'tok',.45]],
      full:[[0,'dum',1],[1,'tok',.6],[1.5,'tok',.4],[2,'dum',.8],[2.5,'jingle',.55],[3,'tek',.75],[3.5,'jingle',.45]],
      fill:[[0,'dum',1],[1,'tek',.6],[1.5,'tek',.6],[2,'roll',.9],[3,'dum',1],[3.5,'dum',.8]],
    },
    phrases:[
      {notes:[[0,1],[2,.5],[3,.5],[4,1],[3,.5],[2,.5],[1,1],[2,.5],[1,.5],[0,2]],chords:[0,6]},
      {notes:[[4,1],[5,.5],[6,.5],[7,1],[6,.5],[5,.5],[4,1.5],[3,.5],[4,2]],chords:[3,4]},
      {notes:[[7,1.5],[6,.5],[5,1],[4,1],[5,.5],[6,.5],[7,.5],[6,.5],[5,2]],chords:[2,4]},
      {notes:[[4,.5],[3,.5],[2,1],[3,.5],[4,.5],[2,1],[1,.5],[0,.5],[1,1],[0,2]],chords:[6,0]},
    ]},
  // desert: slow Phrygian lament in E with a darbuka-style groove
  desert:{tonic:329.63,mode:'phrygian',unit:0.36,bar:4,
    sections:[{lead:'shawm',accomp:'lute',groove:'light'},{lead:'fiddle',accomp:'harp',groove:'full'}],
    grooves:{
      light:[[0,'dum',1],[1,'tek',.6],[2.5,'dum',.7],[3,'tek',.6]],
      full:[[0,'dum',1],[0,'zill',.5],[1,'tek',.7],[1.5,'tek',.4],[2,'tek',.5],[2.5,'dum',.8],[3,'tek',.7],[3.5,'zill',.35]],
      fill:[[0,'dum',1],[.5,'tek',.5],[1,'tek',.7],[1.5,'tek',.6],[2,'roll',.9],[3,'dum',1],[3,'zill',.6]],
    },
    phrases:[
      {notes:[[0,1],[1,.5],[0,.5],[-1,1],[0,1],[2,1],[1,1],[0,2]],chords:[0,1]},
      {notes:[[3,1],[4,1],[5,.5],[4,.5],[3,1],[2,1],[1,.5],[2,.5],[1,2]],chords:[3,1]},
      {notes:[[4,2],[5,.5],[4,.5],[3,1],[4,1.5],[3,.5],[2,1],[1,1]],chords:[3,2]},
      {notes:[[2,1],[1,1],[0,.5],[1,.5],[2,1],[1,1],[0,3]],chords:[1,0]},
    ]},
  // ocean: lilting 6/8 carol in A Aeolian
  ocean:{tonic:440,mode:'aeolian',unit:0.22,bar:6,
    sections:[{lead:'harp',accomp:'lute',groove:'light'},{lead:'recorder',accomp:'harp',groove:'full'}],
    grooves:{
      light:[[0,'dum',.9],[3,'tek',.5],[5,'jingle',.35]],
      full:[[0,'dum',1],[2,'jingle',.4],[3,'tek',.6],[4,'tok',.4],[5,'jingle',.5]],
      fill:[[0,'dum',1],[2,'tek',.5],[3,'roll',.8],[5,'dum',.9]],
    },
    phrases:[
      {notes:[[0,2],[2,1],[4,2],[3,1],[2,2],[1,1],[2,3],[4,2],[5,1],[4,2],[2,1],[1,2],[2,1],[0,3]],chords:[0,2,4,0]},
      {notes:[[0,2],[2,1],[4,2],[3,1],[2,2],[1,1],[2,3],[4,2],[5,1],[4,2],[3,1],[4,2],[-1,1],[0,3]],chords:[0,2,6,0]},
      {notes:[[7,3],[6,2],[5,1],[4,2],[5,1],[4,3],[3,2],[4,1],[5,2],[4,1],[2,2],[1,1],[0,3]],chords:[5,3,6,0]},
      {notes:[[7,3],[6,2],[5,1],[4,2],[5,1],[4,3],[3,2],[2,1],[1,2],[-1,1],[0,6]],chords:[5,3,4,0]},
    ]},
};
// jungle: the forest estampie, brighter (Mixolydian) and a little quicker
MEDIEVAL_TUNES.jungle=Object.assign({},MEDIEVAL_TUNES.forest,{mode:'mixolydian',unit:0.25});
const TUNE_FORM=[0,1,0,1,2,3,2,3]; // AA'AA' BB'BB'
let bgmTimer=null,bgmState=null,bgmNoise=null;

function tuneFreq(tune,deg){
  const steps=MUSIC_MODES[tune.mode],oct=Math.floor(deg/7);
  return tune.tonic*Math.pow(2,oct+steps[deg-oct*7]/12);
}

// keep a node until it finishes so stopBgm() can silence anything still queued
function bgmTrack(node){bgmNodes.push(node);node.onended=()=>{bgmNodes=bgmNodes.filter(n=>n!==node);};}

// sustained voice: oscillator -> optional band/low-pass -> envelope; decay:true rings out like a bell
function bgmTone({type,f,t,d,peak,attack=.02,vib,band,low,decay}){
  const ctx=audioCtx,osc=ctx.createOscillator(),amp=ctx.createGain();
  osc.type=type;osc.frequency.value=f;
  let out=osc;
  if(band){const b=ctx.createBiquadFilter();b.type='bandpass';b.frequency.value=f*band[0];b.Q.value=band[1];out.connect(b);out=b;}
  if(low){const l=ctx.createBiquadFilter();l.type='lowpass';l.frequency.value=low;out.connect(l);out=l;}
  if(vib){const lfo=ctx.createOscillator(),depth=ctx.createGain();lfo.frequency.value=vib[0];depth.gain.value=f*vib[1];
    lfo.connect(depth);depth.connect(osc.frequency);lfo.start(t);lfo.stop(t+d+.05);bgmTrack(lfo);}
  const a=Math.min(attack,d*.4);
  amp.gain.setValueAtTime(.0001,t);
  amp.gain.linearRampToValueAtTime(peak,t+a);
  if(!decay)amp.gain.linearRampToValueAtTime(peak*.75,t+d*.7);
  amp.gain.exponentialRampToValueAtTime(.0001,t+d);
  out.connect(amp);amp.connect(bgmGain);
  osc.start(t);osc.stop(t+d+.05);bgmTrack(osc);
}

// plucked string: bright attack that darkens as it rings
function bgmPluck(f,t,d,peak,bright){
  const ctx=audioCtx,osc=ctx.createOscillator(),tone=ctx.createBiquadFilter(),amp=ctx.createGain();
  osc.type='sawtooth';osc.frequency.value=f;
  tone.type='lowpass';tone.frequency.setValueAtTime(bright,t);tone.frequency.exponentialRampToValueAtTime(f*1.5,t+Math.min(.5,d));
  amp.gain.setValueAtTime(.0001,t);amp.gain.linearRampToValueAtTime(peak,t+.005);amp.gain.exponentialRampToValueAtTime(.0001,t+d);
  osc.connect(tone);tone.connect(amp);amp.connect(bgmGain);
  osc.start(t);osc.stop(t+d+.05);bgmTrack(osc);
}

// (freq, start time, length, velocity 0..1)
const INSTRUMENTS={
  // breathy recorder
  recorder:(f,t,d,v)=>bgmTone({type:'triangle',f,t,d,peak:.085*v,attack:.03,vib:[5.2,.005]}),
  // nasal double-reed shawm
  shawm:(f,t,d,v)=>bgmTone({type:'sawtooth',f,t,d,peak:.055*v,attack:.04,vib:[5,.004],band:[2.5,1.4]}),
  // bowed fiddle (vielle): two slightly detuned strings with a slow bow attack
  fiddle:(f,t,d,v)=>{
    bgmTone({type:'sawtooth',f,t,d,peak:.032*v,attack:.09,vib:[5.6,.006],low:2600});
    bgmTone({type:'sawtooth',f:f*1.004,t,d,peak:.026*v,attack:.11,vib:[5.1,.006],low:2200});
  },
  // harp: a bright pluck left to ring
  harp:(f,t,d,v)=>bgmPluck(f,t,Math.max(d,.8),.06*v,f*8),
  // lute: a darker, shorter pluck
  lute:(f,t,d,v)=>bgmPluck(f,t,.9,.045*v,f*6),
  // bass on the chord roots
  bass:(f,t,d,v)=>bgmTone({type:'triangle',f,t,d,peak:.13*v,attack:.01,low:700}),
  // bell: inharmonic partials with a long ring
  bell:(f,t,d,v)=>[[1,.045],[2.76,.022],[5.4,.01]].forEach(([m,a])=>bgmTone({type:'sine',f:f*m,t,d:2.2,peak:a*v,attack:.004,decay:true})),
};

function bgmNoiseHit(t,peak,len,filters){
  const ctx=audioCtx;
  if(!bgmNoise){bgmNoise=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.5),ctx.sampleRate);const n=bgmNoise.getChannelData(0);for(let i=0;i<n.length;i++)n[i]=Math.random()*2-1;}
  const src=ctx.createBufferSource(),amp=ctx.createGain();src.buffer=bgmNoise;
  let out=src;
  filters.forEach(([type,freq,q])=>{const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=freq;if(q)f.Q.value=q;out.connect(f);out=f;});
  amp.gain.setValueAtTime(peak,t);amp.gain.exponentialRampToValueAtTime(.0001,t+len);
  out.connect(amp);amp.connect(bgmGain);src.start(t);src.stop(t+len+.02);bgmTrack(src);
}
function bgmThump(t,f0,f1,peak,len){
  const ctx=audioCtx,osc=ctx.createOscillator(),amp=ctx.createGain();
  osc.type='sine';osc.frequency.setValueAtTime(f0,t);osc.frequency.exponentialRampToValueAtTime(f1,t+len*.6);
  amp.gain.setValueAtTime(.0001,t);amp.gain.linearRampToValueAtTime(peak,t+.004);amp.gain.exponentialRampToValueAtTime(.0001,t+len);
  osc.connect(amp);amp.connect(bgmGain);osc.start(t);osc.stop(t+len+.02);bgmTrack(osc);
}
// (start time, velocity 0..1)
// Every hit is a tuned drum or a ringing metal partial: short bright noise bursts sounded like a gas
// stove's igniter clicking, so the only noise left is a little low skin rustle under the drums.
const PERC={
  // frame drum: low thump with a little skin noise
  dum:(t,v)=>{bgmThump(t,130,48,.17*v,.42);bgmNoiseHit(t,.02*v,.05,[['lowpass',600]]);},
  // tap on the drum's rim: a short tuned knock
  tek:(t,v)=>bgmThump(t,340,230,.075*v,.1),
  // woodblock
  tok:(t,v)=>bgmThump(t,1000,760,.07*v,.07),
  // tambourine: the jingles' metal ring, without the hiss
  jingle:(t,v)=>[[3150,.012],[4720,.008],[6300,.005]].forEach(([f,a])=>bgmTone({type:'sine',f,t,d:.25,peak:a*v,attack:.002,decay:true})),
  // finger cymbals
  zill:(t,v)=>[[2380,.022],[3620,.014],[5170,.008]].forEach(([f,a])=>bgmTone({type:'sine',f,t,d:1.2,peak:a*v,attack:.003,decay:true})),
  // a roll on the low drum that swells into the next beat
  roll:(t,v)=>{for(let k=0;k<6;k++)bgmThump(t+k*.07,150+k*6,95,(.05+k*.018)*v,.12);},
  // war drum under the dance: a deep boom, with a mid punch so small speakers still hear it
  boom:(t,v)=>{bgmThump(t,95,42,.24*v,.5);bgmThump(t,180,90,.06*v,.07);bgmNoiseHit(t,.012*v,.04,[['lowpass',300]]);},
  // the off-beat drum: a tuned body with a soft low rustle
  snap:(t,v)=>{bgmThump(t,210,150,.1*v,.14);bgmNoiseHit(t,.015*v,.08,[['lowpass',1000]]);},
};
// the steady drum beat under every bar: boom on the strong beats, snap between them
const DRUM_BEAT={
  4:[[0,'boom',1],[1,'snap',.75],[2,'boom',.85],[3,'snap',.8]],
  6:[[0,'boom',1],[1.5,'snap',.6],[3,'boom',.8],[4.5,'snap',.7]],
};

// hurdy-gurdy style drone on the tonic and fifth, retuned when the map theme changes
function bgmSetDrone(tune,t){
  const freqs=[tune.tonic/2,tune.tonic*0.75];
  if(bgmState.drone){bgmState.drone.forEach((o,k)=>o.frequency.setTargetAtTime(freqs[k],t,0.2));return;}
  const ctx=audioCtx,tone=ctx.createBiquadFilter(),amp=ctx.createGain();
  tone.type='lowpass';tone.frequency.value=700;
  amp.gain.setValueAtTime(0.0001,t);amp.gain.linearRampToValueAtTime(0.018,t+1.5);
  tone.connect(amp);amp.connect(bgmGain);
  bgmState.drone=freqs.map(f=>{const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=f;o.connect(tone);o.start(t);bgmNodes.push(o);return o;});
}

// schedules one phrase of the form starting at time t; returns its length in seconds
function bgmPlayPhrase(tune,step,t,round){
  const u=tune.unit,phrase=tune.phrases[TUNE_FORM[step]];
  // sections trade ensembles each time the tune comes around
  const sec=tune.sections[((step<4?0:1)+round)%2];
  const lead=INSTRUMENTS[sec.lead],ornate=round>0||step>=4;
  if(round>0&&step%2===0)INSTRUMENTS.bell(tuneFreq(tune,14),t,0,.9);
  let pos=0;
  phrase.notes.forEach(([deg,len])=>{
    const nt=t+pos*u,dur=len*u*0.92,f=tuneFreq(tune,deg);
    // ornament: a quick upper-neighbour grace note, as a medieval player might add
    if(ornate&&len>=1&&Math.random()<0.3){lead(tuneFreq(tune,deg+1),nt,0.07,.8);lead(f,nt+0.07,dur-0.07,1);}
    else lead(f,nt,dur,1);
    // on repeats, section A gets a quiet second voice a fifth below (medieval organum)
    if(round>0&&step<4)INSTRUMENTS.fiddle(tuneFreq(tune,deg-4),nt,dur,.5);
    pos+=len;
  });
  const bars=phrase.chords.length;
  phrase.chords.forEach((root,b)=>{
    const bt=t+b*tune.bar*u;
    if(sec.accomp==='lute'){
      // lute: root, fifth and octave rolled across the bar
      const roll=tune.bar/3*u;
      [root-7,root-3,root].forEach((deg,k)=>INSTRUMENTS.lute(tuneFreq(tune,deg),bt+k*roll,0,1));
    }else{
      // harp: a rising and falling arpeggio, one note per unit
      const arp=[root-7,root-5,root-3,root,root+2,root];
      for(let k=0;k<tune.bar;k++)INSTRUMENTS.harp(tuneFreq(tune,arp[k%arp.length]),bt+k*u,u*1.5,.7);
    }
    // bass on the two strong beats of the bar
    [0,tune.bar/2].forEach(off=>INSTRUMENTS.bass(tuneFreq(tune,root-14),bt+off*u,u*tune.bar/2*0.9,1));
    // drums, with a fill closing every second phrase, over the steady beat
    const groove=tune.grooves[step%2===1&&b===bars-1?'fill':sec.groove];
    groove.forEach(([off,hit,v])=>PERC[hit](bt+off*u,v));
    (DRUM_BEAT[tune.bar]||DRUM_BEAT[4]).forEach(([off,hit,v])=>PERC[hit](bt+off*u,v));
  });
  return bars*tune.bar*u;
}

function bgmTick(){
  if(!bgmPlaying)return;
  const ctx=audioCtx,s=bgmState;
  if(s.t<ctx.currentTime)s.t=ctx.currentTime+0.05; // the tab was throttled; don't pile up late notes
  while(s.t-ctx.currentTime<0.8){
    const tune=MEDIEVAL_TUNES[mapTheme]||MEDIEVAL_TUNES.forest;
    if(s.theme!==mapTheme){s.theme=mapTheme;s.step=0;s.round=0;bgmSetDrone(tune,s.t);}
    if(s.step>=TUNE_FORM.length){
      // one breathing bar of drone and soft drums, then the dance comes around again
      tune.grooves.light.forEach(([off,hit,v])=>PERC[hit](s.t+off*tune.unit,v*.7));
      PERC.boom(s.t,.6);
      s.t+=tune.bar*tune.unit;s.step=0;s.round++;
      continue;
    }
    s.t+=bgmPlayPhrase(tune,s.step,s.t,s.round);
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
