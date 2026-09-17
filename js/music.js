// ── BACKGROUND MUSIC: medieval dances with a band ────────────────────────────
// Each map theme has its own modal tune in estampie form (sections A and B, each
// phrase repeated). Each section has its own ensemble, and the two sections trade
// ensembles every time the tune comes around, so the colour keeps changing:
//   leads          recorder, shawm, fiddle (vielle), harp
//   accompaniment  lute chords or harp arpeggios, a bass on the strong beats, a drone,
//                  bells on phrase starts and a parallel-fifth second voice on repeats
//   drums          a pop kit: kick, a snare backbeat and hi-hats (on the beat in the quiet
//                  section, every eighth note in the full one), tom fills and crash cymbals
// Everything is synthesized with Web Audio and scheduled slightly ahead of the
// audio clock so the beat stays steady; stopBgm() cancels anything still queued.
const MUSIC_MODES={dorian:[0,2,3,5,7,9,10],phrygian:[0,1,3,5,7,8,10],aeolian:[0,2,3,5,7,8,10],mixolydian:[0,2,4,5,7,9,10]};
// notes: [scale degree (0 = tonic, 7 = octave up, -1 = below), length in units]
// chords: one root degree per bar
const MEDIEVAL_TUNES={
  // forest: lively estampie in D Dorian
  forest:{tonic:293.66,mode:'dorian',unit:0.28,bar:4,
    sections:[{lead:'recorder',accomp:'lute',drums:'light'},{lead:'fiddle',accomp:'harp',drums:'full'}],
    phrases:[
      {notes:[[0,1],[2,.5],[3,.5],[4,1],[3,.5],[2,.5],[1,1],[2,.5],[1,.5],[0,2]],chords:[0,6]},
      {notes:[[4,1],[5,.5],[6,.5],[7,1],[6,.5],[5,.5],[4,1.5],[3,.5],[4,2]],chords:[3,4]},
      {notes:[[7,1.5],[6,.5],[5,1],[4,1],[5,.5],[6,.5],[7,.5],[6,.5],[5,2]],chords:[2,4]},
      {notes:[[4,.5],[3,.5],[2,1],[3,.5],[4,.5],[2,1],[1,.5],[0,.5],[1,1],[0,2]],chords:[6,0]},
    ]},
  // desert: slow Phrygian lament in E
  desert:{tonic:329.63,mode:'phrygian',unit:0.36,bar:4,
    sections:[{lead:'shawm',accomp:'lute',drums:'light'},{lead:'fiddle',accomp:'harp',drums:'full'}],
    phrases:[
      {notes:[[0,1],[1,.5],[0,.5],[-1,1],[0,1],[2,1],[1,1],[0,2]],chords:[0,1]},
      {notes:[[3,1],[4,1],[5,.5],[4,.5],[3,1],[2,1],[1,.5],[2,.5],[1,2]],chords:[3,1]},
      {notes:[[4,2],[5,.5],[4,.5],[3,1],[4,1.5],[3,.5],[2,1],[1,1]],chords:[3,2]},
      {notes:[[2,1],[1,1],[0,.5],[1,.5],[2,1],[1,1],[0,3]],chords:[1,0]},
    ]},
  // ocean: lilting 6/8 carol in A Aeolian
  ocean:{tonic:440,mode:'aeolian',unit:0.22,bar:6,
    sections:[{lead:'harp',accomp:'lute',drums:'light'},{lead:'recorder',accomp:'harp',drums:'full'}],
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
  // silent until the hit: a gain node starts at 1, and when the noise's first sample landed a hair before the
  // envelope's start time it went out at full volume, a sharp click like a stove igniter
  amp.gain.value=0;amp.gain.setValueAtTime(peak,t);amp.gain.exponentialRampToValueAtTime(.0001,t+len);
  out.connect(amp);amp.connect(bgmGain);src.start(t);src.stop(t+len+.02);bgmTrack(src);
}
function bgmThump(t,f0,f1,peak,len){
  const ctx=audioCtx,osc=ctx.createOscillator(),amp=ctx.createGain();
  osc.type='sine';osc.frequency.setValueAtTime(f0,t);osc.frequency.exponentialRampToValueAtTime(f1,t+len*.6);
  amp.gain.setValueAtTime(.0001,t);amp.gain.linearRampToValueAtTime(peak,t+.004);amp.gain.exponentialRampToValueAtTime(.0001,t+len);
  osc.connect(amp);amp.connect(bgmGain);osc.start(t);osc.stop(t+len+.02);bgmTrack(osc);
}
// cymbal metal: six square waves at clashing pitches through a high-pass, the way drum machines make
// hi-hats; a ring of partials with a soft 3 ms attack rather than a burst of noise, so no igniter tick
function bgmMetal(t,peak,len){
  const ctx=audioCtx,hp=ctx.createBiquadFilter(),amp=ctx.createGain();
  hp.type='highpass';hp.frequency.value=7000;
  amp.gain.setValueAtTime(.0001,t);amp.gain.linearRampToValueAtTime(peak,t+.003);amp.gain.exponentialRampToValueAtTime(.0001,t+len);
  hp.connect(amp);amp.connect(bgmGain);
  [410,608,739,1045,1080,1600].forEach(fq=>{const o=ctx.createOscillator();o.type='square';o.frequency.value=fq;
    o.connect(hp);o.start(t);o.stop(t+len+.02);bgmTrack(o);});
}
// (start time, velocity 0..1)
const PERC={
  // kick: a deep pitch drop for the thump and a short knock for the punch
  kick:(t,v)=>{bgmThump(t,160,45,.26*v,.34);bgmThump(t,900,260,.035*v,.02);},
  // snare: a tuned drum body and a broad, soft rattle of wires with a little room after it
  snare:(t,v)=>{bgmThump(t,210,170,.085*v,.13);bgmNoiseHit(t,.045*v,.17,[['highpass',1100],['lowpass',7000]]);
    bgmNoiseHit(t,.008*v,.4,[['bandpass',2400,.7]]);},
  hat:(t,v)=>bgmMetal(t,.011*v,.07),
  openHat:(t,v)=>bgmMetal(t,.009*v,.28),
  crash:(t,v)=>{bgmMetal(t,.013*v,1.6);bgmNoiseHit(t,.009*v,1.2,[['highpass',4000]]);},
  tomHi:(t,v)=>bgmThump(t,240,170,.12*v,.22),
  tomMid:(t,v)=>bgmThump(t,190,130,.13*v,.26),
  tomLo:(t,v)=>bgmThump(t,150,95,.14*v,.3),
};
// Pop grooves: [offset in units, drum, velocity]. A tune's unit is an eighth note here, so two bars
// of 4 make one pop bar (the forest tune runs at about 107 beats a minute) and a bar of 6 is a bar of
// 6/8. span: bars per groove; fillEvery: phrases per fill; fillFrom: where a fill takes over.
const POP_BEAT={
  4:{span:2,fillEvery:4,fillFrom:4,
    light:[[0,'kick',1],[4,'kick',.9],[2,'snare',.85],[6,'snare',.85],
      [0,'hat',.8],[2,'hat',.6],[4,'hat',.8],[6,'hat',.6],[7,'hat',.35]],
    full:[[0,'kick',1],[3,'kick',.7],[4,'kick',.95],[2,'snare',1],[6,'snare',1],
      [0,'hat',.9],[1,'hat',.5],[2,'hat',.8],[3,'hat',.5],[4,'hat',.9],[5,'hat',.5],[6,'hat',.8],[7,'openHat',.7]],
    fill:[[4,'kick',.9],[4,'snare',.6],[4.5,'snare',.45],[5,'snare',.7],[5.5,'snare',.6],
      [6,'tomHi',1],[6.5,'tomHi',.8],[7,'tomMid',.9],[7.5,'tomLo',.95]],
    breath:[[0,'kick',.7],[2,'snare',.5],[0,'hat',.6],[2,'hat',.45],[3,'openHat',.4]]},
  6:{span:1,fillEvery:2,fillFrom:3,
    light:[[0,'kick',1],[3,'snare',.8],[0,'hat',.7],[2,'hat',.4],[3,'hat',.6],[5,'hat',.4]],
    full:[[0,'kick',1],[5,'kick',.55],[3,'snare',1],
      [0,'hat',.8],[1,'hat',.45],[2,'hat',.5],[3,'hat',.8],[4,'hat',.45],[5,'openHat',.55]],
    fill:[[3,'snare',.85],[4,'tomHi',.9],[4.5,'tomMid',.85],[5,'tomLo',.95],[5.5,'tomLo',.8]],
    breath:[[0,'kick',.7],[3,'snare',.5],[0,'hat',.6],[3,'hat',.45],[5,'openHat',.4]]},
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
  });
  // drums: the section's pop groove, a tom fill ending the last groove of every fillEvery-th phrase,
  // and a crash opening each section (except the very first bar of the song)
  const kit=POP_BEAT[tune.bar]||POP_BEAT[4];
  for(let b=0;b<bars;b+=kit.span){
    const bt=t+b*tune.bar*u,fill=(step+1)%kit.fillEvery===0&&b+kit.span>=bars;
    kit[sec.drums].forEach(([off,hit,v])=>{if(!fill||off<kit.fillFrom)PERC[hit](bt+off*u,v);});
    if(fill)kit.fill.forEach(([off,hit,v])=>PERC[hit](bt+off*u,v));
  }
  if(step===4||(step===0&&round>0))PERC.crash(t,1);
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
      (POP_BEAT[tune.bar]||POP_BEAT[4]).breath.forEach(([off,hit,v])=>PERC[hit](s.t+off*tune.unit,v));
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
