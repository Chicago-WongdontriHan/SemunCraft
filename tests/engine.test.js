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
    const mode=n%2?'pvp':'classic',theme=['jungle','desert','ocean'][n%3];
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
