// ── TRAINED AI ───────────────────────────────────────────────────────────────
// Single Player's Easy, Medium and Hard opponents are trained networks (rl/train.py)
// playing Black. On Black's turn the game's variables become an engine state
// (js/engine.js, checked against this game by tests/parity.test.js), the network
// picks a move, and the move is applied back to the game (tests/netai.test.js checks
// that). Code and weights load in the background when a game starts; AI vs AI
// (js/aivsai.js) uses the same loader.
const NETAI_VERSION=((document.currentScript&&/[?&]v=([^&]+)/.exec(document.currentScript.src))||[])[1]||'';
// the network behind each difficulty and its sampling temperature (1 plays as in training, 0 always the most
// likely move); for Hard, 0.25 scored best of 0, 0.05, 0.25, 0.5 and 1 over 1,000 games each, and keeps some variety
const NETAI_LEVELS={
  easy:{model:'easy',temperature:1},
  medium:{model:'medium',temperature:1},
  hard:{model:'ai-1',temperature:0.25},
};
const NETAI_CODE=[
  ['js/engine.js',()=>window.SemunEngine],
  ['rl/encoding.js',()=>window.SemunEncoding],
  ['js/nn.js',()=>window.SemunNet],
];
const netAiNets={};    // model name → network, once loaded
const netAiModels={};  // model name → loading promise
let netAiEncoder=null,netAiCode=null;

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
    netAiEncoder=SemunEncoding.createEncoder({grid:11});
  })().catch(err=>{netAiCode=null;throw err;});
  return netAiCode;
}

// loads the engine, the network code and one model's weights; resolves to the network
function netAiLoadModel(name){
  if(!netAiModels[name])netAiModels[name]=netAiLoadCode()
    .then(()=>window.SemunModels&&SemunModels[name]?null:netAiLoadScript('models/'+name+'.js'))
    .then(()=>netAiNets[name]=SemunNet.load(SemunModels[name]))
    .catch(err=>{delete netAiModels[name];throw err;});
  return netAiModels[name];
}

// called when a Single Player game starts, so the network is ready by Black's first turn
function netAiPreload(){
  const level=NETAI_LEVELS[difficulty];
  if(level)netAiLoadModel(level.model).catch(()=>{});
}

// a pawn of the side to move standing on a spring or a mine, as an action (botTurn does this itself)
function freeMine(state){
  for(let i=0;i<state.board.length;i++){
    const p=state.board[i];
    if(p&&p.color===state.turn&&p.type==='pawn'&&RESOURCE_TILES[state.tiles[i]])return{type:'mine',from:i,to:i};
  }
  return null;
}

// the game's variables as an engine state with Black to move
function netAiSnapshot(){
  // a campaign level's own rules (no merging, no spawning, its objective) go with the snapshot
  return SemunEngine.fromSnapshot({cols:COLS,rows:ROWS,theme:mapTheme,mode:'classic',board:pieces,tiles:tileData,turn:'b',
    level:campaignLevel||null,
    turnCount:{w:whiteTurnCount,b:blackTurnCount},spawns:{w:spawnHistory.length,b:blackSpawnHistory.length},
    targets:{w:whiteTargets,b:blackTargets},hitBy:blackHitBy,acted:[...blackActed],scans,
    elixir:{w:elixir.w,b:elixir.b},mined:{w:mined.w,b:mined.b},maxTurns:300});
}

// Black's move at this difficulty (tests/netai.test.js replaces this with random legal moves)
function netAiChoose(state,level){
  // digging came after these networks were trained, so it is not one of the moves they can pick:
  // a pawn of theirs standing on a spring or a mine digs, the way the built-in AI does
  const dig=freeMine(state);
  if(dig)return dig;
  const cfg=NETAI_LEVELS[level];
  return SemunNet.choose(netAiNets[cfg.model],netAiEncoder,state,{temperature:cfg.temperature}).action;
}

// applies an engine action for Black to the game's variables; the game runs the end of the turn itself
function netAiApply(action){
  const s=netAiSnapshot(),spawned=s.spawns.b;
  const result=SemunEngine.act(s,action);
  pieces=s.board;
  whiteTargets=s.targets.w;blackTargets=s.targets.b;
  scans=s.scans; // a scry Black cast lives in the engine's state: bring it back with the board
  elixir=s.elixir;mined=s.mined;
  for(let k=spawned;k<s.spawns.b;k++)blackSpawnHistory.push(blackTurnCount);
  return result;
}

// Black's turn in Single Player (called by aiAct)
function netAiTurn(){
  const level=NETAI_LEVELS[difficulty]?difficulty:'hard',model=NETAI_LEVELS[level].model;
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
    case'unsiege':return 'unsieges@'+sqName(a.from);
  }
  return 'skips';
}
