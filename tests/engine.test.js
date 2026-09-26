// Engine self-tests: determinism, clone independence, rule invariants over random
// games, and a speed benchmark. Run: node tests/engine.test.js [games]
'use strict';
const E=require('../js/engine.js');

const GAMES=+process.argv[2]||200;
let failures=0;
function fail(msg){failures++;if(failures<=10)console.log('  FAIL '+msg);}
function section(name,fn){
  const before=failures,t0=Date.now();
  const info=fn();
  console.log((failures===before?'ok  ':'FAIL')+' '+name+' ('+(Date.now()-t0)+' ms)'+(info?' — '+info:''));
}

// plays one game with random legal actions (Black uses the built-in AI in classic mode)
function playRandom(opts,pickSeed,onStep){
  const s=E.newGame(opts),pick=E.makeRandom(pickSeed);
  let steps=0;
  while(!s.over){
    if(s.mode==='classic'&&s.turn==='b'){E.botTurn(s);}
    else{
      const acts=E.legalActions(s);
      E.step(s,acts[Math.floor(pick()*acts.length)]);
    }
    steps++;
    if(onStep)onStep(s);
  }
  return{s,steps};
}

function invariants(s,label){
  const kings={w:0,b:0};
  s.board.forEach((p,i)=>{
    if(!p)return;
    if(s.blocked[i])fail(label+': '+p.type+' on an obstacle at '+E.sqName(s,i));
    if(!(p.hp>0&&p.hp<=p.maxHp))fail(label+': '+p.type+' at '+E.sqName(s,i)+' has hp '+p.hp+'/'+p.maxHp);
    if(p.type==='bishop'&&!((p.mana||0)>=0&&(p.mana||0)<=2))fail(label+': bishop mana '+p.mana);
    if(p.type==='king')kings[p.color]++;
  });
  if(kings.w>1||kings.b>1)fail(label+': more than one king per side');
  if(!s.level&&!s.over&&(kings.w!==1||kings.b!==1))fail(label+': a king is missing but the game is not over');
}

section('same seed and same choices give the same game',()=>{
  for(const mode of ['classic','pvp'])for(let seed=1;seed<=20;seed++){
    const a=playRandom({seed,mode,maxTurns:200},seed+1000).s;
    const b=playRandom({seed,mode,maxTurns:200},seed+1000).s;
    if(JSON.stringify(a)!==JSON.stringify(b))fail(mode+' seed '+seed+' diverged');
  }
});

section('clone() is independent of the original',()=>{
  const s=E.newGame({seed:7,mode:'pvp'});
  const before=JSON.stringify(s),c=E.clone(s);
  const pick=E.makeRandom(3);
  for(let k=0;k<30&&!c.over;k++){const acts=E.legalActions(c);E.step(c,acts[Math.floor(pick()*acts.length)]);}
  if(JSON.stringify(s)!==before)fail('stepping a clone changed the original');
});

section('invariants hold in random games',()=>{
  const results={w:0,b:0,draw:0};
  for(let n=0;n<GAMES;n++){
    const mode=n%2?'pvp':'classic',theme=['forest','jungle','desert','ocean'][n%4];
    const {s}=playRandom({seed:n+1,mode,theme,difficulty:n%4<2?'easy':'hard',fog:n%5===0,maxTurns:400},n+5000,st=>invariants(st,mode+' game '+(n+1)));
    if(!s.winner)fail('game '+(n+1)+' ended without a winner');
    else results[s.winner]++;
  }
  return 'results '+JSON.stringify(results);
});

section('every legal action is accepted',()=>{
  const pick=E.makeRandom(99);
  for(let n=0;n<30;n++){
    const s=E.newGame({seed:500+n,mode:'pvp',maxTurns:300});
    while(!s.over){
      const acts=E.legalActions(s,{anyTarget:true});
      for(const a of acts){
        const c=E.clone(s);
        try{E.step(c,a);}catch(e){fail('game '+n+': '+JSON.stringify(a)+' rejected: '+e.message);return;}
      }
      E.step(s,acts[Math.floor(pick()*acts.length)]);
    }
  }
});

section('illegal actions are rejected',()=>{
  const s=E.newGame({seed:1,mode:'pvp'});
  const bad=[{type:'move',from:0,to:1},{type:'spawn',from:0,to:0},{type:'merge',from:-1,to:3},{type:'fly'}];
  for(const a of bad){let threw=false;try{E.step(E.clone(s),a);}catch(e){threw=true;}if(!threw)fail('accepted '+JSON.stringify(a));}
});

section('fromSnapshot rebuilds a state, and act() applies just the action',()=>{
  const pick=E.makeRandom(21);
  let checked=0,kept=0;
  for(let n=0;n<40;n++){
    const s=E.newGame({seed:900+n,mode:n%2?'pvp':'classic',theme:['forest','jungle','desert','ocean'][n%4],maxTurns:200});
    while(!s.over){
      if(s.mode==='classic'&&s.turn==='b'&&n%4===0){E.botTurn(s);continue;}
      const r=E.fromSnapshot({cols:s.cols,rows:s.rows,theme:s.theme,mode:s.mode,board:s.board,tiles:s.tiles,turn:s.turn,
        turnCount:s.turnCount,spawns:s.spawns,targets:s.targets,hitBy:s.hitBy,acted:s.acted,fog:s.fog,maxTurns:s.maxTurns,
        orderLeft:s.orderLeft,elixir:s.elixir,mineTurns:s.mineTurns,goldSpent:s.goldSpent});
      for(const k of ['board','tiles','blocked','turn','turnCount','spawns','targets','mode','fog','elixir','mineTurns','goldSpent'])
        if(JSON.stringify(r[k])!==JSON.stringify(s[k])){fail('fromSnapshot differs in '+k);return;}
      const acts=E.legalActions(s),a=acts[Math.floor(pick()*acts.length)];
      // a knight's L-jump merge keeps the turn, and so does an order while half the budget is left
      const keeps=(a.type==='order'&&s.orderLeft[s.turn]-(s.board[a.from].type==='pawn'?.5:1)>=.5)
        ||(a.type==='merge'&&s.board[a.from].type==='knight'&&E.geo(s).kj[a.from].includes(a.to));
      const res=E.act(r,a),events=E.step(s,a);
      if(res.continues!==keeps)fail('continues should be '+keeps+' after '+JSON.stringify(a));
      if(JSON.stringify(res.events[0])!==JSON.stringify(events[0]))fail('act and step describe '+JSON.stringify(a)+' differently');
      // a merge that keeps the turn has no end-of-turn work, so both must leave the same board
      if(keeps){kept++;if(JSON.stringify(r.board)!==JSON.stringify(s.board))fail('boards differ after an action that kept the turn');}
      checked++;
    }
  }
  return checked+' actions, '+kept+' kept the turn';
});

section('undergrowth hides a piece until it fights from it',()=>{
  // an empty jungle board with two patches of undergrowth, d5 and h5 (row 4, columns 3 and 7)
  const s=E.newGame({seed:1,theme:'jungle',mode:'pvp'});
  const at=(r,c)=>r*s.cols+c,put=(r,c,type,color)=>{s.board[at(r,c)]={type,color,hp:E.STATS[type].hp,maxHp:E.STATS[type].maxHp};};
  s.board.fill(null);s.tiles.fill('');s.blocked.fill(false);s.targets={w:{},b:{}};
  s.tiles[at(4,3)]='undergrowth';s.tiles[at(4,7)]='undergrowth';
  put(8,0,'king','w');put(0,8,'king','b');
  put(4,1,'rook','w');           // two squares west of the thicket, in rook range
  put(4,3,'rook','b');           // hiding in it
  put(4,5,'pawn','w');           // two squares east: in the hidden rook's range, not next to it
  const wRook=at(4,1),bRook=at(4,3);
  if(!E.inCover(s,bRook,'w')||!E.concealed(s,bRook,'w'))fail('a rook alone in undergrowth should be hidden from White');
  if(E.getDests(s,wRook).attack.has(bRook))fail('White can drag an attack onto a hidden piece');
  if(E.computeActions(s,'w').some(a=>a.target===bRook))fail('White auto-attacks a hidden piece');
  if(E.legalActions(s,{anyTarget:true}).some(a=>a.type==='target'&&a.to===bRook))fail('White can lock onto a hidden piece');
  s.targets.w[wRook]=bRook;      // an old lock doesn't fire at it either
  if(E.computeActions(s,'w').some(a=>a.target===bRook))fail('a lock fires at a hidden piece');
  if(E.concealed(s,wRook,'b'))fail('a piece outside undergrowth is never hidden');
  put(3,2,'pawn','w');           // a White pawn stands right next to the thicket
  if(!E.concealed(s,bRook,'w'))fail('standing next to it no longer reveals a hidden piece by itself');
  // the hidden rook fires out of cover, at the pawn two squares east: that reveals it, from this turn on
  const shot=E.computeActions(s,'b').find(a=>a.attacker===bRook&&a.target===at(4,5));
  if(!shot)fail('the hidden rook should still fire out of cover');
  E.applyAttacks(s,[shot],'b');
  if(E.concealed(s,bRook,'w'))fail('firing out of cover should reveal it');
  if(!E.getDests(s,wRook).attack.has(bRook))fail('once revealed, White can attack it');
  if(!E.computeActions(s,'w').some(a=>a.attacker===wRook&&a.target===bRook))fail('once revealed, a lock should fire');
  // a later upkeep only clears STALE reveals (a piece no longer standing where it was spotted); it
  // does not wholesale re-hide a piece still holding the square that gave it away
  E.upkeep(s,'w',[]);
  if(E.concealed(s,bRook,'w'))fail('it stays revealed while it holds the square that gave it away');
  // it moves to a second patch of undergrowth: judged fresh there, hidden again
  const movedTo=at(4,7);
  s.board[movedTo]=s.board[bRook];s.board[bRook]=null;
  if(!E.concealed(s,movedTo,'w'))fail('moving to a different patch of undergrowth should hide it again');
  // an order arriving on a hidden enemy's own square discovers it regardless, and reveals it
  s.board[wRook]=null;s.targets={w:{},b:{}};
  const pawnAt=at(4,6);put(4,6,'pawn','w');
  s.board[pawnAt].order={to:movedTo,turns:1};
  s.orderLeft={w:1,b:1};
  const before=s.board[movedTo].hp;
  E.upkeep(s,'w',[]);
  if(s.board[movedTo].hp>=before)fail('an order arriving on a hidden enemy should strike it, not lapse');
  if(E.concealed(s,movedTo,'w'))fail('an order that strikes a hidden enemy should reveal it');
});

section('speed',()=>{
  const pick=E.makeRandom(1);
  let steps=0,games=0;const t0=Date.now();
  while(Date.now()-t0<3000){
    const s=E.newGame({seed:games+1,mode:'pvp',maxTurns:300});
    while(!s.over){const acts=E.legalActions(s);E.step(s,acts[Math.floor(pick()*acts.length)]);steps++;}
    games++;
  }
  const sec=(Date.now()-t0)/1000;
  return Math.round(steps/sec)+' steps/s, '+Math.round(games/sec)+' games/s (random self-play, one core)';
});

console.log(failures?'\n'+failures+' failure(s)':'\nall engine tests passed');
process.exit(failures?1:0);
