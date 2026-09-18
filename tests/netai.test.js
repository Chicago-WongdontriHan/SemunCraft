// Checks js/netai.js, which applies a trained network's moves for Black to the browser game.
// Plays Single Player games where White's moves go through the game's own input handlers and
// Black's through netai.js (random legal moves stand in for the network), and requires the
// game to match js/engine.js after every turn. Run: node tests/netai.test.js [games]
'use strict';
const E=require('../js/engine.js');
const {loadOriginalGame}=require('./original-game.js');

const GAMES=+process.argv[2]||60;
const MAX_ACTIONS=150;
let failures=0,checks=0;

// deep comparison that ignores key order and treats a missing key like undefined
function firstDiff(a,b,path){
  path=path||'$';
  if(a===b)return null;
  if(typeof a!=='object'||typeof b!=='object'||a===null||b===null)return path+': '+JSON.stringify(a)+' (game) vs '+JSON.stringify(b)+' (engine)';
  if(Array.isArray(a)!==Array.isArray(b))return path+': array vs object';
  for(const k of new Set([...Object.keys(a),...Object.keys(b)])){
    const d=firstDiff(a[k],b[k],path+'.'+k);
    if(d)return d;
  }
  return null;
}
function check(label,game,engine){
  checks++;
  const d=firstDiff(game,engine);
  if(d){failures++;if(failures<=10)console.log('  FAIL '+label+'\n       '+d);}
  return !d;
}

const game=loadOriginalGame({extraScripts:['js/engine.js','js/netai.js']});
const q=JSON.stringify;
game.run(`function __snap(){return{board:pieces,tiles:tileData,over,whiteTurnCount,blackTurnCount,
  whiteSpawns:spawnHistory.length,blackSpawns:blackSpawnHistory.length,whiteTargets,blackTargets,
  hitBy:blackHitBy,acted:[...blackActed]};}`,'snapshot');
// Black's "network": a random legal move, reported so the engine can play the same one
const blackMoves=[];
game.ctx.__record=a=>blackMoves.push(JSON.parse(JSON.stringify(a)));
game.run('netAiChoose=function(state){const acts=SemunEngine.legalActions(state),a=acts[__pick(acts.length)];__record(a);return a;};','choose');

// half the time prefer anything but a plain move or skip, so merges, heals and sieges get exercised
function choose(acts,pick){
  const special=acts.filter(a=>a.type!=='move'&&a.type!=='skip');
  const pool=special.length&&pick()<0.5?special:acts;
  return pool[Math.floor(pick()*pool.length)];
}

// play a White action through the game's input handlers, then run its timers (and Black's turn)
function applyOriginal(a,s){
  const p=a.from!==undefined?s.board[a.from]:null;
  const drop='executeDrop('+a.from+','+a.to+',getDragDests('+a.from+'))';
  if(a.type==='extract')game.run('extractAt('+a.from+')');
  else if(a.type==='fortify')game.run('fortifyAt('+a.from+')');
  else if(a.type==='scry')game.run('castScry('+a.from+','+a.to+')');
  else if(a.type==='spawn')game.run('kingSelected=true;handleClick('+a.to+')');
  else if(a.type==='unsiege')game.run('unsiegePiece('+a.from+')');
  else if(a.type==='skip')game.run('doSkip()');
  else if(p&&p.type==='bishop'&&(a.type==='merge'||a.type==='healLock')){
    const n=game.created.length;
    game.run(drop);
    const want=a.type==='merge'?'Merge':'Heal';
    const btn=game.created.slice(n).find(el=>el.tagName==='button'&&String(el.textContent).includes(want));
    if(!btn)throw new Error('no '+want+' button in the bishop popup');
    btn.onclick();
  }else game.run(drop);
  game.flush();
}

const stats={},t0=Date.now();
for(let n=0;n<GAMES;n++){
  const seed=n+1,theme=['forest','jungle','desert','ocean'][n%4],difficulty=['easy','medium','hard'][n%3],fog=n%4===0;
  game.created.length=0;
  game.setRandom(E.makeRandom(seed));
  const pickBlack=E.makeRandom(seed*104729+7);
  game.ctx.__pick=k=>Math.floor(pickBlack()*k);
  game.run('pvpActive=false;pvpRole=null;campaignLevel=null;COLS=9;ROWS=9;titleTileData=null;mapTheme='+q(theme)+';'
    +'gameMode='+q(difficulty)+';difficulty='+q(difficulty)+';initGame();animals=[];blackActed=new Set();blackHitBy=[];'
    // the "network" counts as loaded, so Black moves without loading anything
    +'netAiNets[NETAI_LEVELS[difficulty].model]={};');
  game.set('mapCheat',!fog);
  const s=E.newGame({seed,theme,difficulty:difficulty==='easy'?'easy':'hard',fog});
  const pick=E.makeRandom(seed*7919+13);
  for(let k=0;k<MAX_ACTIONS&&!s.over;k++){
    const a=choose(E.legalActions(s),pick);
    stats[a.type]=(stats[a.type]||0)+1;
    blackMoves.length=0;
    applyOriginal(a,s);
    E.step(s,a);
    for(const b of blackMoves){
      if(s.over)break;
      stats['Black '+b.type]=(stats['Black '+b.type]||0)+1;
      E.step(s,b);
    }
    if(!check('game '+seed+' ('+difficulty+(fog?', fog':'')+') after White '+q(a)+' and Black '+q(blackMoves),game.ctx.__snap(),
      {board:s.board,tiles:s.tiles,over:s.over,whiteTurnCount:s.turnCount.w,blackTurnCount:s.turnCount.b,
        whiteSpawns:s.spawns.w,blackSpawns:s.spawns.b,whiteTargets:s.targets.w,blackTargets:s.targets.b,hitBy:s.hitBy,acted:s.acted}))break;
  }
}

console.log((failures?'FAIL':'ok  ')+' '+GAMES+' games through netai.js ('+(Date.now()-t0)+' ms); moves played: '+q(stats));
console.log('\n'+(checks-failures)+'/'+checks+' checks passed');
process.exit(failures?1:0);
