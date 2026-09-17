// ── AI VS AI ─────────────────────────────────────────────────────────────────
// Watch the two most-trained networks (models/ai-1.js and models/ai-2.js, written by
// rl/export_web.py) play each other. Matches run in the headless engine (js/engine.js:
// the game's rules, checked against this game by tests/parity.test.js) and are drawn
// on the normal board. The code and weights (about 6 MB) load through js/netai.js the first time.
const AIVSAI_SPEEDS=[1,2,4,8];
const AIVSAI_DELAY=700; // ms between moves at 1× speed
let aiVsAi=null;        // the match being watched
let aiVsAiNets=null,aiVsAiEncoder=null;
let aiVsAiSpeed=1,aiVsAiMatches=0,aiVsAiScore={1:0,2:0,draw:0};

async function aiVsAiLoad(){
  if(aiVsAiNets)return;
  const[first,second]=await Promise.all([netAiLoadModel('ai-1'),netAiLoadModel('ai-2')]);
  aiVsAiEncoder=netAiEncoder;
  aiVsAiNets={1:first,2:second};
}

async function startAiVsAi(){
  hideGameOver();
  document.getElementById('intro').classList.add('hidden');
  campaignLevel=null;campaignLevelId=-1;
  gameMode='aivsai';difficulty='aivsai';
  stopAnimalLoop();animals=[];animalDivs.forEach(el=>el.remove());animalDivs.clear();
  over=false;thinking=true; // the board takes no player input while the AIs play
  aiVsAiControls(true);
  syncUI();showMoveHint();resizeBoard();
  document.getElementById('thinking-dot').classList.add('on');
  setStatus('Loading the trained AIs…');
  try{await aiVsAiLoad();}
  catch(err){
    setStatus('Could not load the AIs: '+err.message);
    document.getElementById('thinking-dot').classList.remove('on');
    return;
  }
  if(gameMode!=='aivsai')return; // went back to the menu while loading
  aiVsAiMatches=0;aiVsAiScore={1:0,2:0,draw:0};
  aiVsAiNewMatch();
}

function aiVsAiNewMatch(){
  if(!aiVsAiNets)return;
  if(aiVsAi)clearTimeout(aiVsAi.timer);
  hideGameOver();
  aiVsAiMatches++;
  const white=aiVsAiMatches%2?1:2; // the AIs swap colors every match
  const s=SemunEngine.newGame({seed:Math.floor(Math.random()*2147483647),mode:'classic',theme:mapTheme,maxTurns:300});
  aiVsAi={s,white,black:3-white,timer:null,paused:false,lastFrom:-1,lastTo:-1};
  COLS=s.cols;ROWS=s.rows;
  document.body.className='theme-'+s.theme;
  tileData=s.tiles.slice();
  mapCheat=true;exploredTiles=new Set();
  const cheat=document.getElementById('btn-mapcheat');if(cheat)cheat.textContent='🗺 Map Cheat: ON';
  resetView();
  logLines=[];document.getElementById('log').textContent='';
  selectedPieces=new Set();kingSelected=false;targetMode=false;targetSrc=-1;
  over=false;thinking=true;
  const pause=document.getElementById('btn-aivsai-pause');if(pause)pause.textContent='⏸ Pause';
  aiVsAiSync();
  resizeBoard();render();syncUI();
  document.getElementById('thinking-dot').classList.add('on');
  aiVsAiStatus();
  if(!bgmPaused&&!bgmPlaying)startBgm();
  aiVsAiSchedule(900);
}

// copy the engine state into the globals the normal board draws from
function aiVsAiSync(){
  const g=aiVsAi,s=g.s;
  pieces=s.board.map(p=>p&&Object.assign({},p));
  whiteTargets=Object.assign({},s.targets.w);blackTargets=Object.assign({},s.targets.b);
  blackLastFrom=g.lastFrom;blackLastTo=g.lastTo;
  turn=s.turn;
  const tc=document.getElementById('turn-counter');if(tc)tc.textContent='Turn '+(s.turnCount.w+s.turnCount.b);
  renderResources();
}

function aiVsAiLabel(n){
  const meta=SemunModels['ai-'+n].meta||{};
  return 'AI #'+n+(meta.update!==undefined?' (update '+meta.update+')':'');
}

function aiVsAiStatus(){
  const g=aiVsAi;
  if(g)setStatus('White: '+aiVsAiLabel(g.white)+' vs Black: '+aiVsAiLabel(g.black)+(g.paused?' · paused':''));
}

function aiVsAiSchedule(ms){
  const g=aiVsAi;
  if(!g)return;
  clearTimeout(g.timer);
  g.timer=setTimeout(aiVsAiStep,ms/aiVsAiSpeed);
}

function aiVsAiStep(){
  const g=aiVsAi;
  if(!g||gameMode!=='aivsai'||g.paused)return;
  const s=g.s;
  if(s.over){aiVsAiFinish();return;}
  const color=s.turn,ai=color==='w'?g.white:g.black;
  const before=s.board.map(p=>p&&Object.assign({},p));
  const a=SemunNet.choose(aiVsAiNets[ai],aiVsAiEncoder,s).action;
  const events=SemunEngine.step(s,a);
  g.lastFrom=a.from===undefined?-1:a.from;
  g.lastTo=a.to===undefined?-1:a.to;
  addLog(aiVsAiDescribe(color,ai,a,events,before));
  const effects=aiVsAiSpeed<=2;
  const show=()=>{
    if(aiVsAi!==g)return; // a new match or the menu took over during the animation
    aiVsAiSync();render();
    if(effects){
      for(const e of events){
        if(e.type==='attack'){
          flashSq(e.to,'hit-flash');
          if(e.killed&&before[e.to])showDeath(e.to,before[e.to].color,before[e.to].type);
        }else if(e.type==='heal')flashSq(e.to,'heal-flash');
        else if(e.type==='spawn')spawnFlash(e.to);
        else if(e.type==='merge'||e.type==='unsiege')mergeFlash(e.type==='merge'?e.to:e.from);
      }
      aiVsAiSound(a,events,before);
    }
    aiVsAiSchedule(s.over?1200:AIVSAI_DELAY);
  };
  const p=before[a.from];
  if(effects&&a.type==='move'&&p)animatePieceMove(a.from,a.to,p.type,p.color,p.color==='b',show,(p.type==='knight'?260:180)/aiVsAiSpeed);
  else show();
}

// the move's own sound (a new piece's voice, a heal, or a step), then the voice of every piece that fell
function aiVsAiSound(a,events,before){
  const merge=events.find(e=>e.type==='merge'),kills=events.filter(e=>e.type==='attack'&&e.killed);
  if(a.type==='merge')SFX.arrive(merge&&merge.piece);
  else if(a.type==='unsiege')SFX.arrive('rook');
  else if(a.type==='spawn')SFX.arrive('pawn');
  else if(a.type==='heal'||events.some(e=>e.type==='heal'))SFX.heal();
  else if(!kills.length&&events.some(e=>e.type==='attack'))SFX.attack();
  else if(!kills.length)SFX.move();
  kills.forEach(e=>{if(before[e.to])SFX.fall(before[e.to].type);});
}

function aiVsAiDescribe(color,ai,a,events,before){
  const sq=i=>SemunEngine.sqName(aiVsAi.s,i),p=a.from===undefined?null:before[a.from];
  let text;
  switch(a.type){
    case'move':text=p.type+' '+sq(a.from)+'→'+sq(a.to);break;
    case'merge':{const m=events.find(e=>e.type==='merge');text='merge → '+(m?m.piece:'')+' '+sq(a.to);break;}
    case'spawn':text='spawn '+sq(a.to);break;
    case'target':text=p.type+' '+sq(a.from)+' targets '+sq(a.to);break;
    case'heal':case'healLock':text='bishop '+sq(a.from)+' heals '+sq(a.to);break;
    case'unsiege':text='unsiege '+sq(a.from);break;
    default:text='skip';
  }
  const hits=events.filter(e=>e.type==='attack'),kills=hits.filter(e=>e.killed).length;
  if(hits.length)text+=' · '+hits.length+' hit'+(hits.length>1?'s':'')+(kills?', '+kills+' ✕':'');
  return (color==='w'?'W':'B')+' AI#'+ai+': '+text;
}

function aiVsAiFinish(){
  const g=aiVsAi,s=g.s;
  over=true;
  document.getElementById('thinking-dot').classList.remove('on');
  const winner=s.winner==='draw'?0:s.winner==='w'?g.white:g.black;
  if(winner)aiVsAiScore[winner]++;else aiVsAiScore.draw++;
  // the headline names the side; which AI played it goes underneath
  const result=winner?(s.winner==='w'?'White':'Black')+' wins':'Draw';
  const title=document.getElementById('go-title'),sub=document.getElementById('go-sub'),btns=document.getElementById('go-buttons');
  title.className=winner?'win':'draw';
  title.textContent=result;
  const draws=aiVsAiScore.draw?' ('+aiVsAiScore.draw+(aiVsAiScore.draw>1?' draws)':' draw)'):'';
  sub.textContent=(winner?'AI #'+winner+' wins':'turn limit')+' after '+(s.turnCount.w+s.turnCount.b)
    +' turns · score AI #1 '+aiVsAiScore[1]+' – '+aiVsAiScore[2]+' AI #2'+draws;
  btns.innerHTML='';
  const next=document.createElement('button');
  next.className='go-btn primary';next.textContent='▶ Next Match';next.onclick=aiVsAiNewMatch;
  const menu=document.createElement('button');
  menu.className='go-btn secondary';menu.textContent='↺ Main Menu';menu.onclick=goIntro;
  btns.append(next,menu);
  document.getElementById('game-over').classList.add('show');
  SFX.win();
  setStatus('Match over: '+result);
}

// AI vs AI buttons take the place of Spawn, Merge and Skip in the actions panel
function aiVsAiControls(on){
  ['btn-spawn','btn-merge','btn-skip'].forEach(id=>{const b=document.getElementById(id);if(b)b.style.display=on?'none':'';});
  let box=document.getElementById('aivsai-controls');
  if(!on){if(box)box.remove();return;}
  if(box)return;
  box=document.createElement('div');
  box.id='aivsai-controls';box.style.display='contents';
  const button=(id,text,onclick)=>{const b=document.createElement('button');b.className='act-btn';b.id=id;b.textContent=text;b.onclick=onclick;return b;};
  box.append(
    button('btn-aivsai-pause','⏸ Pause',aiVsAiTogglePause),
    button('btn-aivsai-speed','⏩ Speed '+aiVsAiSpeed+'×',aiVsAiCycleSpeed),
    button('btn-aivsai-new','↻ New Match',aiVsAiNewMatch));
  document.getElementById('actions').insertBefore(box,document.getElementById('btn-new'));
}

function aiVsAiTogglePause(){
  const g=aiVsAi;
  if(!g||g.s.over)return;
  g.paused=!g.paused;
  document.getElementById('btn-aivsai-pause').textContent=g.paused?'▶ Resume':'⏸ Pause';
  document.getElementById('thinking-dot').classList.toggle('on',!g.paused);
  aiVsAiStatus();
  if(g.paused)clearTimeout(g.timer);else aiVsAiSchedule(300);
}

function aiVsAiCycleSpeed(){
  aiVsAiSpeed=AIVSAI_SPEEDS[(AIVSAI_SPEEDS.indexOf(aiVsAiSpeed)+1)%AIVSAI_SPEEDS.length];
  document.getElementById('btn-aivsai-speed').textContent='⏩ Speed '+aiVsAiSpeed+'×';
}

// called by goIntro: stop the match and give the actions panel back
function stopAiVsAi(){
  if(aiVsAi)clearTimeout(aiVsAi.timer);
  aiVsAi=null;
  aiVsAiControls(false);
  if(gameMode==='aivsai'){gameMode='single';difficulty='easy';thinking=false;}
  document.getElementById('thinking-dot').classList.remove('on');
}
