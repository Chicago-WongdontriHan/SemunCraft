// ── TRAINED AI ───────────────────────────────────────────────────────────────
// Single Player's Easy, Medium, Hard and Trained opponents are trained networks (rl/train.py) playing
// Black; Master is the scripted AI (rl/scripted.js) instead, playing the same way a network does — one
// action at a time, from the same engine snapshot. On Black's turn the game's variables become an engine
// state (js/engine.js, checked against this game by tests/parity.test.js), the network or the scripted AI
// picks a move, and the move is applied back to the game (tests/netai.test.js checks that). Code and
// weights load in the background when a game starts; AI vs AI (js/aivsai.js) uses the same loader.
const NETAI_VERSION=((document.currentScript&&/[?&]v=([^&]+)/.exec(document.currentScript.src))||[])[1]||'';
// the network behind each difficulty and its sampling temperature (1 plays as in training, 0 always the most
// likely move); for Hard, 0.25 scored best of 0, 0.05, 0.25, 0.5 and 1 over 1,000 games each, and keeps some
// variety. `model:null` (Master) has no weights and no temperature: it's rl/scripted.js, always its one best
// move. Trained is rl/train.py's run v3-strip2 at update 32,000 (2026-10-03), on encoding 3 and the rules
// of that day (a bishop's Strip reaches any square within 2), trained mostly by self-play with Master in 15%
// of games under fading bonuses for merging and for Bishops: it builds an army of Queens (Knight + Bishop) and
// holds the gold mines, and stopped buying helmets; at update 31,000 it beat Master 60%, Hard 99%. Rush is
// the same run's last network (update 34,556): once the bonuses had faded it went back to a march of
// helmeted pawns by delayed orders, now holding the gold mines nearly all game — the strongest network yet:
// Master 94% (every strategy 81% or better), Hard and Easy 100%, Trained 24-0 and the Rush before it (v3-merge
// update 28,600) 18-6 in head-to-head games. The user keeps a rusher as a difficulty of its own.
// Strip is run v3-elite at update 36,000 (2026-10-04), caught mid-way through fading bonuses for stripping
// helmets and for Elixir units: it builds bishops (about ten a game, three on the board) and strips about four
// helmets a game against Master — but plays slow and draws: 1 win, 7 losses and 16 draws in 24 games against
// Master. On the link so the user can watch the bishops' Strip in use; once the bonuses had faded, the same run
// went back to the march.
const NETAI_LEVELS={
  easy:{model:'easy',temperature:1},
  medium:{model:'medium',temperature:1},
  hard:{model:'ai-1',temperature:0.25},
  trained:{model:'trained',temperature:0.5},
  rush:{model:'rush',temperature:0.5},
  strip:{model:'strip',temperature:0.5},
  master:{model:null},
};
const NETAI_CODE=[
  ['js/engine.js',()=>window.SemunEngine],
  ['rl/encoding.js',()=>window.SemunEncoding],
  ['js/nn.js',()=>window.SemunNet],
  ['rl/scripted.js',()=>window.SemunScripted],
];
const netAiNets={};    // model name → network, once loaded
const netAiModels={};  // model name → loading promise
const netAiEncoders={};   // encoding version → encoder (rl/encoding.js)
let netAiCode=null;

function netAiLoadScript(src){
  return new Promise((resolve,reject)=>{
    const el=document.createElement('script');
    el.src=src+(NETAI_VERSION?'?v='+NETAI_VERSION:'');
    el.onload=resolve;
    el.onerror=()=>reject(new Error('could not load '+src));
    document.head.appendChild(el);
  });
}

function netAiLoadCode(){
  if(!netAiCode)netAiCode=(async()=>{
    for(const[src,loaded]of NETAI_CODE)if(!loaded())await netAiLoadScript(src);
  })().catch(err=>{netAiCode=null;throw err;});
  return netAiCode;
}

// the encoder a network was trained with: the version in its meta (encoding 1 for the networks exported
// before the meta said), which also keeps encoding 1's picture of the board as those networks saw it
function netAiEncoderFor(net){
  const version=(net.meta&&net.meta.encoding)||1;
  if(!netAiEncoders[version])netAiEncoders[version]=SemunEncoding.createEncoder({grid:net.grid||11,version,sightPlane:false});
  return netAiEncoders[version];
}

// loads the engine, the network code and one model's weights; resolves to the network
function netAiLoadModel(name){
  if(!netAiModels[name])netAiModels[name]=netAiLoadCode()
    .then(()=>window.SemunModels&&SemunModels[name]?null:netAiLoadScript('models/'+name+'.js'))
    .then(()=>netAiNets[name]=SemunNet.load(SemunModels[name]))
    .catch(err=>{delete netAiModels[name];throw err;});
  return netAiModels[name];
}

// called when a Single Player game starts, so the network (or, for Master, just the code) is ready by
// Black's first turn
function netAiPreload(){
  const level=NETAI_LEVELS[difficulty];
  if(!level)return;
  if(level.model)netAiLoadModel(level.model).catch(()=>{});
  else netAiLoadCode().catch(()=>{});
}

// the game's variables as an engine state with Black to move
function netAiSnapshot(){
  // a campaign level's own rules (no merging, no spawning, its objective) go with the snapshot
  return SemunEngine.fromSnapshot({cols:COLS,rows:ROWS,theme:mapTheme,mode:'classic',board:pieces,tiles:tileData,turn:'b',
    level:campaignLevel||null,aiSight:{w:false,b:aiSightLimited('b')},   // Black's targets only what it sees (js/state.js)
    turnCount:{w:whiteTurnCount,b:blackTurnCount},spawns:{w:spawnHistory.length,b:blackSpawnHistory.length},
    targets:{w:whiteTargets,b:blackTargets},hitBy:blackHitBy,acted:[...blackActed],scans,meteors,
    elixir:{w:elixir.w,b:elixir.b},mineTurns:{w:mineTurns.w,b:mineTurns.b},goldSpent:{w:goldSpent.w,b:goldSpent.b},springs,
    orderLeft:{w:orderLeft.w,b:orderLeft.b},maxTurns:300});
}

// Master's strategy for this Single Player game (rl/scripted.js's PROFILES: Rush, Knights & Paladins,
// Fortress...): drawn on its first move rather than at the start, since the scripted AI's code may still be
// loading then, and kept for the rest of the game. initGame clears it for the next one.
let netAiProfile=null;
function netAiResetProfile(){netAiProfile=null;}
function netAiMasterProfile(){
  if(!netAiProfile){
    netAiProfile=SemunScripted.pickProfile(Math.random);
    if(typeof addLog==='function')addLog('Master plays: '+netAiProfile.label);
  }
  return netAiProfile;
}

// Black's move at this difficulty (tests/netai.test.js replaces this with random legal moves). `opts`
// overrides that difficulty's own settings — js/aivsai.js forces temperature 1 for both sides, "as trained",
// whatever difficulty each is standing in for.
function netAiChoose(state,level,opts){
  const cfg=Object.assign({},NETAI_LEVELS[level],opts);
  // Master: the scripted AI, no network — playing one strategy a game (AI vs AI passes its own per side)
  if(!cfg.model)return SemunScripted.chooseAction(state,{profile:cfg.profile||netAiMasterProfile()});
  const net=netAiNets[cfg.model];
  return SemunNet.choose(net,netAiEncoderFor(net),state,{temperature:cfg.temperature}).action;
}

// applies an engine action for Black to the game's variables; the game runs the end of the turn itself
function netAiApply(action){
  const s=netAiSnapshot(),spawned=s.spawns.b;
  const result=SemunEngine.act(s,action);
  pieces=s.board;
  whiteTargets=s.targets.w;blackTargets=s.targets.b;
  scans=s.scans; // a scry Black cast lives in the engine's state: bring it back with the board
  meteors=s.meteors;   // and so does a meteor its Mage summoned, which would otherwise never land
  elixir=s.elixir;mineTurns=s.mineTurns;goldSpent=s.goldSpent;orderLeft=s.orderLeft;springs=s.springs;
  for(let k=spawned;k<s.spawns.b;k++)blackSpawnHistory.push(blackTurnCount);
  // this action's own square, exactly as the engine tracked it (s.moved) — read fresh at finishBlackTurn,
  // so that piece holds its fire the same way movedThisTurn does for White (a later action this same
  // turn, from a chained knight merge, overwrites it — only the last one of the turn should count)
  blackMovedThisTurn=s.moved;
  return result;
}

// Black's turn in Single Player (called by aiAct)
function netAiTurn(){
  const level=NETAI_LEVELS[difficulty]?difficulty:'hard',model=NETAI_LEVELS[level].model;
  if(!model){   // Master: no weights to load, just the engine and rl/scripted.js
    if(typeof SemunScripted!=='undefined'){netAiMove(level,0);return;}
    setStatus('Loading the AI…');
    const board=pieces;
    netAiLoadCode().then(()=>{if(!over&&pieces===board)netAiMove(level,0);},err=>{
      if(over||pieces!==board)return;
      addLog('Scripted AI unavailable ('+err.message+'); the built-in AI plays');
      fallbackAI();
    });
    return;
  }
  if(netAiNets[model]){netAiMove(level,0);return;}
  setStatus('Loading the AI…');
  const board=pieces; // starting another game replaces the board, and this turn is then abandoned
  netAiLoadModel(model).then(()=>{if(!over&&pieces===board)netAiMove(level,0);},err=>{
    if(over||pieces!==board)return;
    addLog('Trained AI unavailable ('+err.message+'); the built-in AI plays');
    fallbackAI();
  });
}

function netAiMove(level,chain){
  const a=netAiChoose(netAiSnapshot(),level);
  const p=a.from===undefined?null:pieces[a.from];
  const{events,continues}=netAiApply(a);
  blackLastFrom=a.from===undefined?-1:a.from;
  blackLastTo=a.to===undefined?-1:a.to;
  addLog('Black '+netAiDescribe(a,p,events));
  render();
  if(a.type==='move'&&p)animatePieceMove(a.from,a.to,p.type,'b',true,()=>{},p.type==='knight'?260:180);
  else if(a.type==='spawn'){spawnFlash(a.to);SFX.arrive('pawn');}
  else if(a.type==='merge'||a.type==='unsiege'){
    mergeFlash(a.type==='merge'?a.to:a.from);
    const m=events.find(e=>e.type==='merge');SFX.arrive(a.type==='unsiege'?'rook':m&&m.piece);
  }
  else if(a.type==='heal'){flashSq(a.to,'heal-flash');SFX.heal();}
  else if(a.type==='strip'){flashSq(a.to,'hit-flash');SFX.attack();}
  // after a knight's L-jump merge Black moves again
  const board=pieces;
  if(continues&&chain<20){setTimeout(()=>{if(!over&&pieces===board)netAiMove(level,chain+1);},350);return;}
  setTimeout(()=>{if(pieces===board)finishBlackTurn();},a.type==='move'?280:200);
}

function netAiDescribe(a,p,events){
  switch(a.type){
    // a move or merge into undergrowth doesn't say where the piece went (see inCover)
    case'move':return p.type+' '+sqName(a.from)+'→'+(isConcealedFrom(a.to,'w')?'the undergrowth':sqName(a.to));
    case'merge':{const m=events.find(e=>e.type==='merge');return 'merges → '+(m?m.piece:'')+(isConcealedFrom(a.to,'w')?' in the undergrowth':'@'+sqName(a.to));}
    case'spawn':return 'spawns@'+sqName(a.to);
    case'target':return p.type+' targets '+sqName(a.to);
    case'heal':case'healLock':return 'bishop heals '+sqName(a.to);
    case'strip':return 'bishop strips the helmet off the pawn@'+sqName(a.to);
    case'unsiege':return 'unsieges@'+sqName(a.from);
    case'fortify':return 'puts a helmet on the pawn@'+sqName(a.from);
    case'order':return 'orders its '+p.type+' '+(isConcealedFrom(a.from,'w')?'':sqName(a.from))+'→'+sqName(a.to)+' in '+a.turns+' turn'+(a.turns>1?'s':'');
    case'scry':return 'bishop scries around '+sqName(a.to);
    case'meteor':return 'Mage calls a Meteor on '+sqName(a.to);
  }
  return 'skips';
}
