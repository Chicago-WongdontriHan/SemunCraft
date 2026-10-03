// ── AI VS AI ─────────────────────────────────────────────────────────────────
// Watch two of Single Player's difficulties play each other: White and Black each pick theirs, Trained (the
// current network) or Master (the scripted AI) — the same one on both sides too — on the buttons right under
// the resources (#aivsai-pick). Each pick is a NETAI_LEVELS entry (js/netai.js); AIVSAI_CHOICES lists the
// ones offered. Matches run in the headless engine (js/engine.js: the game's rules, checked against this game
// by tests/parity.test.js) and are drawn on the normal board. Both sides play at temperature 1 ("as
// trained"), not each difficulty's own tuned value. Code and weights load through js/netai.js the first time.
const AIVSAI_CHOICES=['trained','master'];
const AIVSAI_SPEEDS=[1,2,4,8];
const AIVSAI_DELAY=700; // ms between moves at 1× speed
const AIVSAI_STORE='semuncraft-aivsai-picks';
let aiVsAi=null;        // the match being watched
let aiVsAiLoaded=false;
let aiVsAiSpeed=1,aiVsAiMatches=0,aiVsAiScore={w:0,b:0,draw:0};
// each colour's AI, remembered between visits (a convenience: a blocked storage just means the defaults)
let aiVsAiLevels={w:'trained',b:'master'};
try{const saved=JSON.parse(localStorage.getItem(AIVSAI_STORE)||'null');
  if(saved&&AIVSAI_CHOICES.includes(saved.w)&&AIVSAI_CHOICES.includes(saved.b))aiVsAiLevels={w:saved.w,b:saved.b};}catch(e){}

async function aiVsAiLoad(){
  await Promise.all(['w','b'].map(color=>{
    const cfg=NETAI_LEVELS[aiVsAiLevels[color]];
    return cfg.model?netAiLoadModel(cfg.model):netAiLoadCode();
  }));
  aiVsAiLoaded=true;
}

// a pick on White's or Black's buttons starts a fresh match with the new pairing, and the score over — a
// match, or a score, half played by another AI wouldn't mean much
async function aiVsAiPick(color,level){
  if(!AIVSAI_CHOICES.includes(level)||aiVsAiLevels[color]===level)return;
  aiVsAiLevels[color]=level;
  try{localStorage.setItem(AIVSAI_STORE,JSON.stringify(aiVsAiLevels));}catch(e){}
  aiVsAiPickSync();
  if(gameMode!=='aivsai')return;
  if(aiVsAi)clearTimeout(aiVsAi.timer);
  aiVsAiLoaded=false;
  setStatus('Loading the AIs…');
  try{await aiVsAiLoad();}
  catch(err){setStatus('Could not load the AIs: '+err.message);return;}
  if(gameMode!=='aivsai')return;
  aiVsAiMatches=0;aiVsAiScore={w:0,b:0,draw:0};
  aiVsAiNewMatch();
}

// the picked button of each side in solid gold, as a panel's main button is (the buttons are .act-btn
// plaques; resize.js sizes them like the right panel's)
function aiVsAiPickSync(){
  for(const color of ['w','b'])for(const level of AIVSAI_CHOICES){
    const b=document.getElementById('avp-'+color+'-'+level);
    if(b)b.classList.toggle('gold',aiVsAiLevels[color]===level);
  }
}

async function startAiVsAi(){
  hideGameOver();
  document.getElementById('intro').classList.add('hidden');
  campaignLevel=null;campaignLevelId=-1;
  gameMode='aivsai';difficulty='aivsai';
  stopAnimalLoop();animals=[];animalDivs.forEach(el=>el.remove());animalDivs.clear();
  over=false;thinking=true; // the board takes no player input while the AIs play
  aiVsAiControls(true);
  document.body.classList.add('aivsai');   // shows each side's AI picker under the resources
  aiVsAiPickSync();
  syncUI();resizeBoard();
  document.getElementById('thinking-dot').classList.add('on');
  setStatus('Loading the AIs…');
  try{await aiVsAiLoad();}
  catch(err){
    setStatus('Could not load the AIs: '+err.message);
    document.getElementById('thinking-dot').classList.remove('on');
    return;
  }
  if(gameMode!=='aivsai')return; // went back to the menu while loading
  aiVsAiMatches=0;aiVsAiScore={w:0,b:0,draw:0};
  aiVsAiNewMatch();
}

function aiVsAiNewMatch(){
  if(!aiVsAiLoaded)return;
  if(aiVsAi)clearTimeout(aiVsAi.timer);
  hideGameOver();
  aiVsAiMatches++;
  const s=SemunEngine.newGame({seed:Math.floor(Math.random()*2147483647),mode:'classic',theme:mapTheme,maxTurns:300,aiSight:true});   // both are AIs: each attacks only what it sees
  // each side keeps its AI for the whole match (a pick mid-match starts a new one, aiVsAiPick); a Master
  // side plays one strategy for the whole match (rl/scripted.js PROFILES), a fresh one each match
  const levels={w:aiVsAiLevels.w,b:aiVsAiLevels.b},profiles={};
  for(const color of ['w','b'])if(!NETAI_LEVELS[levels[color]].model)profiles[color]=SemunScripted.pickProfile(Math.random);
  aiVsAi={s,levels,timer:null,paused:false,lastFrom:-1,lastTo:-1,profiles};
  COLS=s.cols;ROWS=s.rows;
  setBodyTheme(s.theme);
  tileData=s.tiles.slice();
  mapCheat=true;exploredTiles=new Set();scans=[];meteors=[];flareTiles=[];elixir={w:0,b:0};mineTurns={w:0,b:0};goldSpent={w:0,b:0};springs={};orderLeft={w:ORDER_BUDGET,b:ORDER_BUDGET};
  const cheat=document.getElementById('btn-mapcheat');if(cheat)cheat.innerHTML=uiLabel('map','Map Cheat: ON');
  resetView();
  logLines=[];document.getElementById('log').textContent='';
  for(const color in profiles)addLog((color==='w'?'White':'Black')+' (Master) plays: '+profiles[color].label);
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
  scans=s.scans.slice();meteors=s.meteors.slice();flareTiles=(s.flares||[]).slice();   // a Scry, a Meteor, the fire's afterglow
  blackLastFrom=g.lastFrom;blackLastTo=g.lastTo;
  turn=s.turn;
  const tc=document.getElementById('turn-counter');if(tc)tc.textContent='Turn '+(s.turnCount.w+s.turnCount.b);
  renderResources();
}

const aiVsAiName=level=>level[0].toUpperCase()+level.slice(1);

// a side's AI as the status line names it: a network with its training update, Master with this match's strategy
function aiVsAiLabel(color){
  const g=aiVsAi,level=g.levels[color],cfg=NETAI_LEVELS[level];
  if(!cfg.model)return aiVsAiName(level)+(g.profiles[color]?' · '+g.profiles[color].label:'');
  const meta=(SemunModels[cfg.model]&&SemunModels[cfg.model].meta)||{};
  return aiVsAiName(level)+(meta.update!==undefined?' (update '+meta.update+')':'');
}

function aiVsAiStatus(){
  const g=aiVsAi;
  if(g)setStatus('White: '+aiVsAiLabel('w')+' vs Black: '+aiVsAiLabel('b')+(g.paused?' · paused':''));
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
  const color=s.turn;
  const before=s.board.map(p=>p&&Object.assign({},p));
  const a=netAiChoose(s,g.levels[color],{temperature:1,profile:g.profiles[color]});   // "as trained", not that difficulty's tuned value
  const events=SemunEngine.step(s,a);
  g.lastFrom=a.from===undefined?-1:a.from;
  g.lastTo=a.to===undefined?-1:a.to;
  addLog(aiVsAiDescribe(color,a,events,before));
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

function aiVsAiDescribe(color,a,events,before){
  const sq=i=>SemunEngine.sqName(aiVsAi.s,i),p=a.from===undefined?null:before[a.from];
  let text;
  switch(a.type){
    case'move':text=p.type+' '+sq(a.from)+'→'+sq(a.to);break;
    case'merge':{const m=events.find(e=>e.type==='merge');text='merge → '+(m?m.piece:'')+' '+sq(a.to);break;}
    case'spawn':text='spawn '+sq(a.to);break;
    case'target':text=p.type+' '+sq(a.from)+' targets '+sq(a.to);break;
    case'heal':case'healLock':text='bishop '+sq(a.from)+' heals '+sq(a.to);break;
    case'unsiege':text='unsiege '+sq(a.from);break;
    case'fortify':text='helmet on '+sq(a.from);break;
    case'order':text=p.type+' '+sq(a.from)+'→'+sq(a.to)+' in '+a.turns;break;
    case'scry':text='scry '+sq(a.to);break;
    case'meteor':text='meteor '+sq(a.to);break;
    default:text='skip';
  }
  const hits=events.filter(e=>e.type==='attack'),kills=hits.filter(e=>e.killed).length;
  if(hits.length)text+=' · '+hits.length+' hit'+(hits.length>1?'s':'')+(kills?', '+kills+' ✕':'');
  return (color==='w'?'W':'B')+' '+aiVsAiName(aiVsAi.levels[color])+': '+text;
}

function aiVsAiFinish(){
  const g=aiVsAi,s=g.s;
  over=true;
  document.getElementById('thinking-dot').classList.remove('on');
  const winner=s.winner==='draw'?null:s.winner;
  if(winner)aiVsAiScore[winner]++;else aiVsAiScore.draw++;
  // the headline names the side; which AI played it, and the running score, go underneath
  const result=winner?(winner==='w'?'White':'Black')+' wins':'Draw';
  const title=document.getElementById('go-title'),sub=document.getElementById('go-sub'),btns=document.getElementById('go-buttons');
  title.className=winner?'win':'draw';
  title.textContent=result;
  const draws=aiVsAiScore.draw?' ('+aiVsAiScore.draw+(aiVsAiScore.draw>1?' draws)':' draw)'):'';
  sub.textContent=(winner?aiVsAiLabel(winner)+' wins':'turn limit')+' after '+(s.turnCount.w+s.turnCount.b)
    +' turns · score White ('+aiVsAiName(g.levels.w)+') '+aiVsAiScore.w+' – '+aiVsAiScore.b+' Black ('+aiVsAiName(g.levels.b)+')'+draws;
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
  // the player's own buttons make way for the match controls
  PIECE_BTNS.forEach(id=>{const b=document.getElementById(id);if(b)b.style.display=on?'none':'';});
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
  document.getElementById('actions').appendChild(box);
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
  document.body.classList.remove('aivsai');
  if(gameMode==='aivsai'){gameMode='single';difficulty='easy';thinking=false;}
  document.getElementById('thinking-dot').classList.remove('on');
}
