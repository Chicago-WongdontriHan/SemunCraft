// Parity tests: drive the original browser game code (loaded by original-game.js)
// and js/engine.js with the same seeds and actions, and require identical state.
// Run: node tests/parity.test.js [seedsPerCase] [sectionNameFilter]
'use strict';
const E=require('../js/engine.js');
const {loadOriginalGame}=require('./original-game.js');

const SEEDS=+process.argv[2]||40;
const FILTER=process.argv[3]||'';
const MAX_ACTIONS=150;
let failures=0,checks=0;

// deep comparison that ignores key order and treats a missing key like undefined
function firstDiff(a,b,path){
  path=path||'$';
  if(a===b)return null;
  if(typeof a!=='object'||typeof b!=='object'||a===null||b===null)return path+': '+JSON.stringify(a)+' (original) vs '+JSON.stringify(b)+' (engine)';
  if(Array.isArray(a)!==Array.isArray(b))return path+': array vs object';
  for(const k of new Set([...Object.keys(a),...Object.keys(b)])){
    const d=firstDiff(a[k],b[k],path+'.'+k);
    if(d)return d;
  }
  return null;
}
function check(label,orig,engine){
  checks++;
  const d=firstDiff(orig,engine);
  if(d){failures++;if(failures<=10)console.log('  FAIL '+label+'\n       '+d);}
  return !d;
}

const game=loadOriginalGame();
const q=JSON.stringify;

function section(name,fn){
  if(FILTER&&!name.includes(FILTER))return;
  const before=failures,t0=Date.now(),stats={};
  fn(stats);
  console.log((failures===before?'ok  ':'FAIL')+' '+name+' ('+(Date.now()-t0)+' ms)');
  if(Object.keys(stats).length)console.log('     actions played: '+q(stats));
}

section('piece stats match constants.js',()=>{
  check('STATS',game.get('STATS'),E.STATS);
});

section('map generation and strategy pick match themes.js / ai.js',()=>{
  for(const theme of ['forest','jungle','desert','ocean'])
    for(const mode of ['easy','hard','pvp'])
      for(let seed=1;seed<=SEEDS;seed++){
        game.setRandom(E.makeRandom(seed));
        game.run('campaignLevel=null;COLS=9;ROWS=9;titleTileData=null;mapTheme='+q(theme)+';'
          +'gameMode='+q(mode)+';difficulty='+q(mode)+';pvpActive='+(mode==='pvp')+';pvpRole="host";initGame();');
        const s=E.newGame({seed,theme,difficulty:mode,mode:mode==='pvp'?'pvp':'classic'});
        check(theme+'/'+mode+' seed '+seed,
          {board:game.get('pieces'),tiles:game.get('tileData'),animals:mode==='pvp'?[]:game.get('animals'),strategy:mode==='pvp'?null:game.get('aiStrategy')},
          {board:s.board,tiles:s.tiles,animals:mode==='pvp'?[]:s.animals,strategy:s.strategy});
      }
  game.run('pvpActive=false;');
});

// ── full games ───────────────────────────────────────────────────────────────
// White's actions (and both sides' in PvP) are picked at random from the engine's
// legal actions, then played through the original code's own input handlers.
const LEVELS=game.get('CAMPAIGN_LEVELS');
game.run(`function __snap(){return{board:pieces,tiles:tileData,over,turn,whiteTurnCount,blackTurnCount,scans,elixir,mineTurns,goldSpent,orderLeft,
  whiteSpawns:spawnHistory.length,blackSpawns:blackSpawnHistory.length,whiteTargets,blackTargets,
  moved:movedThisTurn,hitBy:blackHitBy,acted:[...blackActed]};}
function __dests(i){const d=getDragDests(i),o={};for(const k of ['move','merge','attack','heal'])o[k]=[...d[k]].sort((a,b)=>a-b);return o;}`,'snapshot');

const sortedDests=d=>({move:[...d.move].sort((a,b)=>a-b),merge:[...d.merge].sort((a,b)=>a-b),attack:[...d.attack].sort((a,b)=>a-b),heal:[...d.heal].sort((a,b)=>a-b)});

function origWinner(o){
  if(!o.over)return null;
  if(game.get('campaignLevel')){const r=game.ctx.checkCampaignWin();return r==='win'?'w':r==='lose'?'b':null;}
  const w=o.board.some(p=>p&&p.color==='w'&&p.type==='king'),b=o.board.some(p=>p&&p.color==='b'&&p.type==='king');
  return !b?'w':!w?'b':null;
}

// half the time prefer anything but a plain move or skip, so merges, heals and sieges get exercised
function choose(acts,pick){
  const special=acts.filter(a=>a.type!=='move'&&a.type!=='skip');
  const pool=special.length&&pick()<0.5?special:acts;
  return pool[Math.floor(pick()*pool.length)];
}

// play an engine action through the original game's input handlers, then run its timers
function applyOriginal(a,s){
  const p=a.from!==undefined?s.board[a.from]:null;
  const drop='executeDrop('+a.from+','+a.to+',getDragDests('+a.from+'))';
  if(a.type==='order')game.run('placeOrder('+a.from+','+a.to+','+a.turns+')');
  else if(a.type==='extract')game.run('extractAt('+a.from+')');
  else if(a.type==='fortify')game.run('fortifyAt('+a.from+')');
  else if(a.type==='scry')game.run('castScry('+a.from+','+a.to+')');
  else if(a.type==='spawn')game.run('kingSelected=true;handleClick('+a.to+')');
  else if(a.type==='unsiege')game.run('unsiegePiece('+a.from+')');
  else if(a.type==='skip')game.run('doSkip()');
  else if(p&&p.type==='bishop'&&(a.type==='merge'||a.type==='healLock')){
    // dropping a bishop on a knight opens a Heal / Merge popup
    const n=game.created.length;
    game.run(drop);
    const want=a.type==='merge'?'Merge':'Heal';
    const btn=game.created.slice(n).find(el=>el.tagName==='button'&&String(el.textContent+el.innerHTML).includes(want));
    if(!btn)throw new Error('no '+want+' button in the bishop popup');
    btn.onclick();
  }else game.run(drop);
  game.flush();
}

// replaces the starting board (in both games) with a random mid-game position: every piece
// tier, wounded pieces, bishops with and without mana, kings anywhere
function scatter(s,seed){
  const pick=E.makeRandom(seed*31+7);
  const types=['pawn','pawn','knight','knight','bishop','bishop','rook','rook','queen','siege','mage'];
  const B=s.board.map(()=>null),free=[];
  for(let i=0;i<B.length;i++)if(!s.blocked[i])free.push(i);
  const take=()=>free.splice(Math.floor(pick()*free.length),1)[0];
  for(const color of ['w','b']){
    B[take()]={type:'king',color,hp:2+Math.floor(pick()*4),maxHp:5};
    const n=5+Math.floor(pick()*8);
    for(let k=0;k<n;k++){
      const type=types[Math.floor(pick()*types.length)];
      const p={type,color,hp:1+Math.floor(pick()*E.STATS[type].maxHp),maxHp:E.STATS[type].maxHp};
      if(type==='bishop')p.mana=Math.floor(pick()*3);
      if(type==='pawn'&&pick()<0.5)p.firstMove=true;
      if(type==='pawn'&&pick()<0.25){p.fortified=true;p.maxHp=3;p.hp=1+Math.floor(pick()*3);}
      if(type==='siege')p.sieged=true;
      B[take()]=p;
    }
  }
  s.board=B;
  game.set('pieces',B.map(p=>p&&Object.assign({},p)));
  // some Elixir on each side, so a bishop and a rook can become a Mage
  s.elixir={w:Math.floor(pick()*5),b:Math.floor(pick()*5)};
  game.set('elixir',{w:s.elixir.w,b:s.elixir.b});
}

function playClassic(opts,label,stats){
  game.created.length=0;
  game.setRandom(E.makeRandom(opts.seed));
  let s;
  if(opts.level!==undefined){
    game.run('pvpActive=false;pvpRole=null;startCampaignLevel('+opts.level+');');
    s=E.newGame({seed:opts.seed,level:LEVELS[opts.level]});
    game.set('mapCheat',!s.fog);
  }else{
    game.run('pvpActive=false;pvpRole=null;campaignLevel=null;COLS=9;ROWS=9;titleTileData=null;mapTheme='+q(opts.theme)+';'
      +'gameMode='+q(opts.difficulty)+';difficulty='+q(opts.difficulty)+';initGame();'
      // the engine doesn't simulate animals yet (a move onto an animal's tile attacks it instead)
      +'animals=[];');
    s=E.newGame({seed:opts.seed,theme:opts.theme,difficulty:opts.difficulty,fog:opts.fog});
    game.set('mapCheat',!opts.fog);
  }
  // a fresh page starts with these empty; initGame doesn't clear them between games
  game.run('blackActed=new Set();blackHitBy=[];');
  if(opts.scatter)scatter(s,opts.seed);
  const pick=E.makeRandom(opts.seed*7919+13);
  for(let n=0;n<MAX_ACTIONS&&!s.over;n++){
    for(let i=0;i<s.board.length;i++)
      if(s.board[i]&&!check(label+': moves of '+E.sqName(s,i)+' before action '+n,game.ctx.__dests(i),sortedDests(E.getDests(s,i))))return;
    if(!check(label+': spawns left before action '+n,game.run('spawnRemaining()'),E.spawnRemaining(s,'w')))return;
    const a=choose(E.legalActions(s),pick);
    stats[a.type]=(stats[a.type]||0)+1;
    applyOriginal(a,s);
    E.step(s,a);
    if(!s.over&&s.turn==='b')E.botTurn(s);
    const o=game.ctx.__snap();
    delete o.turn;
    o.winner=origWinner(o);
    if(!check(label+': after action '+n+' '+q(a),o,{board:s.board,tiles:s.tiles,over:s.over,
      whiteTurnCount:s.turnCount.w,blackTurnCount:s.turnCount.b,whiteSpawns:s.spawns.w,blackSpawns:s.spawns.b,
      whiteTargets:s.targets.w,blackTargets:s.targets.b,moved:s.moved,hitBy:s.hitBy,acted:s.acted,scans:s.scans,
      elixir:s.elixir,mineTurns:s.mineTurns,goldSpent:s.goldSpent,orderLeft:s.orderLeft,winner:s.winner}))return;
  }
}

// PvP: one sandbox plays both clients; each keeps its own turn count and spawn history
function playPvp(opts,label,stats){
  game.created.length=0;
  game.setRandom(E.makeRandom(opts.seed));
  game.run('campaignLevel=null;COLS=9;ROWS=9;titleTileData=null;mapTheme='+q(opts.theme)+';'
    +'gameMode="pvp";difficulty="pvp";pvpActive=true;pvpRole="host";initGame();');
  game.set('mapCheat',!opts.fog);
  const s=E.newGame({seed:opts.seed,theme:opts.theme,mode:'pvp',fog:opts.fog});
  if(opts.scatter)scatter(s,opts.seed);
  const client={w:{whiteTurnCount:0,spawnHistory:[]},b:{whiteTurnCount:0,spawnHistory:[]}};
  const load=c=>{game.set('pvpRole',c==='w'?'host':'guest');game.set('whiteTurnCount',client[c].whiteTurnCount);game.set('spawnHistory',client[c].spawnHistory);};
  const save=c=>{client[c].whiteTurnCount=game.get('whiteTurnCount');client[c].spawnHistory=game.get('spawnHistory');};
  const pick=E.makeRandom(opts.seed*7919+17);
  for(let n=0;n<MAX_ACTIONS*2&&!s.over;n++){
    const mover=s.turn;
    load(mover);
    for(let i=0;i<s.board.length;i++)
      if(s.board[i]&&s.board[i].color===mover&&!check(label+': moves of '+E.sqName(s,i)+' before action '+n,game.ctx.__dests(i),sortedDests(E.getDests(s,i))))return;
    if(!check(label+': spawns left before action '+n,game.run('spawnRemaining()'),E.spawnRemaining(s,mover)))return;
    const a=choose(E.legalActions(s),pick);
    stats[a.type]=(stats[a.type]||0)+1;
    applyOriginal(a,s);
    save(mover);
    E.step(s,a);
    // the receiving client runs its start-of-turn upkeep when the state arrives (onPeerData)
    if(!game.get('over')&&game.get('turn')!==mover){const r=game.get('turn');load(r);game.run('turnUpkeep()');save(r);}
    const o=game.ctx.__snap();
    if(!check(label+': after action '+n+' '+q(a),
      {board:o.board,tiles:o.tiles,over:o.over,turn:o.turn,winner:origWinner(o),
        turns:{w:client.w.whiteTurnCount,b:client.b.whiteTurnCount},spawns:{w:client.w.spawnHistory.length,b:client.b.spawnHistory.length},
        whiteTargets:o.whiteTargets,blackTargets:o.blackTargets,moved:o.moved,elixir:o.elixir,mineTurns:o.mineTurns,goldSpent:o.goldSpent},
      {board:s.board,tiles:s.tiles,over:s.over,turn:s.turn,winner:s.winner,turns:s.turnCount,spawns:s.spawns,
        whiteTargets:s.targets.w,blackTargets:s.targets.b,moved:s.moved,elixir:s.elixir,mineTurns:s.mineTurns,goldSpent:s.goldSpent}))return;
  }
  game.run('pvpActive=false;pvpRole=null;');
}

const THEMES=['forest','jungle','desert','ocean'];
section('pvp games',stats=>{
  for(const theme of THEMES)for(const fog of [false,true])for(let seed=1;seed<=SEEDS;seed++)
    playPvp({seed,theme,fog},'pvp '+theme+(fog?' fog':'')+' seed '+seed,stats);
});
section('pvp games from mid-game positions',stats=>{
  for(const theme of THEMES)for(let seed=1;seed<=SEEDS;seed++)
    playPvp({seed,theme,fog:seed%3===0,scatter:true},'pvp mid-game '+theme+' seed '+seed,stats);
});
section('classic games vs the built-in AI',stats=>{
  for(const theme of THEMES)for(const difficulty of ['easy','hard'])for(const fog of [false,true])for(let seed=1;seed<=SEEDS;seed++)
    playClassic({seed,theme,difficulty,fog},'classic '+theme+' '+difficulty+(fog?' fog':'')+' seed '+seed,stats);
});
section('classic games from mid-game positions',stats=>{
  for(const theme of THEMES)for(const difficulty of ['easy','hard'])for(let seed=1;seed<=SEEDS;seed++)
    playClassic({seed,theme,difficulty,fog:seed%3===0,scatter:true},'classic mid-game '+theme+' '+difficulty+' seed '+seed,stats);
});
section('campaign levels vs the campaign AI',stats=>{
  for(let level=0;level<LEVELS.length;level++)for(let seed=1;seed<=SEEDS;seed++)
    playClassic({seed,level},'campaign level '+(level+1)+' seed '+seed,stats);
});

console.log('\n'+(checks-failures)+'/'+checks+' checks passed');
process.exit(failures?1:0);
