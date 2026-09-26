// Scripted AI self-tests (rl/scripted.js): its moves are legal and repeatable, it beats a random player in
// both turn orders and both colours, and it plays the current economy — spawns, holds mines and springs,
// merges up. Run: node tests/scripted.test.js [games]
'use strict';
const E=require('../js/engine.js');
const S=require('../rl/scripted.js');

const GAMES=+process.argv[2]||24;
const THEMES=['forest','jungle','desert','ocean'];
let failures=0;
function fail(msg){failures++;if(failures<=10)console.log('  FAIL '+msg);}
function section(name,fn){
  const before=failures,t0=Date.now();
  const info=fn();
  console.log((failures===before?'ok  ':'FAIL')+' '+name+' ('+(Date.now()-t0)+' ms)'+(info?' — '+info:''));
}

const NOT_USED=new Set(['scry','order','unsiege','healLock']);

// the scripted AI as `botColor` against a random player (pvp, either colour) or the old built-in AI
// (classic, where Black always belongs to it); `onAction` sees every action it takes
function play(seed,mode,botColor,against,onAction){
  const s=E.newGame({seed,mode,theme:THEMES[seed%4],difficulty:seed%2?'easy':'hard',maxTurns:300});
  const pick=E.makeRandom(seed*7919+3);
  while(!s.over){
    if(s.turn===botColor){
      for(let k=0;k<8&&!s.over&&s.turn===botColor;k++){
        const a=S.chooseAction(s);
        if(onAction)onAction(s,a);
        E.step(s,a,{trusted:true});
      }
      if(!s.over&&s.turn===botColor)fail('seed '+seed+': the turn never passed');
    }else if(against==='builtin'&&s.mode==='classic')E.botTurn(s);
    else{const acts=E.legalActions(s);E.step(s,acts[Math.floor(pick()*acts.length)],{trusted:true});}
  }
  return s;
}

section('every action it chooses is legal, unused kinds stay unused, and a position gives one answer',()=>{
  let n=0;
  for(let seed=1;seed<=12;seed++){
    const mode=seed%2?'classic':'pvp',color=seed%4<2?'b':'w';
    play(seed,mode,color,'random',(s,a)=>{
      n++;
      if(!E.isLegal(s,a))fail('seed '+seed+': illegal action '+JSON.stringify(a));
      if(NOT_USED.has(a.type))fail('seed '+seed+': used '+a.type);
      if(a.type==='move'&&s.board[a.from].type==='king')fail('seed '+seed+': moved its King');
      const again=S.chooseAction(E.clone(s));
      if(JSON.stringify(again)!==JSON.stringify(a))fail('seed '+seed+': the same position gave two answers');
    });
  }
  return n+' actions checked';
});

section('beats a random player, in both turn orders and as either colour',()=>{
  let won=0,drawn=0,total=0;
  for(let seed=1;seed<=GAMES;seed++){
    const mode=seed%2?'classic':'pvp',color=seed%4<2?'b':'w';
    const s=play(seed,mode,color,'random');
    total++;
    if(s.winner===color)won++;else if(s.winner==='draw')drawn++;
  }
  if(won<Math.ceil(total*.9))fail('won only '+won+' of '+total+' ('+drawn+' drawn)');
  return won+' of '+total+' won, '+drawn+' drawn';
});

section('plays the current economy: spawns, holds mines and springs, merges up',()=>{
  const games=Math.max(12,GAMES/2|0),c={spawn:0,fortify:0,merge:0,tier:0,spent:0,held:0};
  let won=0,lost=0;
  for(let seed=1;seed<=games;seed++){
    const s=play(seed*13+5,'classic','w','builtin',(s,a)=>{
      if(a.type==='spawn')c.spawn++;
      if(a.type==='fortify')c.fortify++;
      if(a.type==='merge'){
        c.merge++;
        const r=E.mergeResultType(s,s.board[a.from],s.board[a.to]);
        if(E.elixirCost(r)){c.tier++;c.spent+=E.elixirCost(r);}
      }
    });
    if(s.winner==='w')won++;else if(s.winner==='b')lost++;
    c.held+=s.mineTurns.w+s.elixir.w*2;   // mine-turns banked, and Elixir in halves (a spring pays half a turn)
  }
  const per=k=>c[k]/games;
  if(per('spawn')<5)fail('spawned only '+per('spawn').toFixed(1)+' pawns a game');
  if(per('merge')<2)fail('merged only '+per('merge').toFixed(1)+' times a game');
  if(per('tier')<.5)fail('built only '+per('tier').toFixed(2)+' Elixir-tier units a game, so the Elixir from the springs goes unspent');
  if(per('held')<5)fail('the mines and springs paid only '+per('held').toFixed(1)+' a game');
  if(lost>won)fail('lost '+lost+' games to the old built-in AI and won only '+won);
  return 'per game '+per('spawn').toFixed(1)+' spawns, '+per('fortify').toFixed(1)+' helmets, '+per('merge').toFixed(1)
    +' merges ('+per('tier').toFixed(2)+' Elixir-tier, '+per('spent').toFixed(1)+' Elixir spent), '+per('held').toFixed(0)+' banked from tiles; '
    +won+' won, '+lost+' lost of '+games+' against the old built-in AI';
});

section('four Knights side by side with Elixir in hand make a Paladin (each piece counts in one pair only)',()=>{
  const s=E.newGame({seed:3,mode:'pvp',theme:'forest'});
  const at=(r,c)=>r*s.cols+c,put=(r,c,type,color)=>{s.board[at(r,c)]={type,color,hp:E.STATS[type].hp,maxHp:E.STATS[type].maxHp};};
  s.board.fill(null);s.tiles.fill('');s.blocked.fill(false);s.targets={w:{},b:{}};
  put(8,0,'king','w');put(0,8,'king','b');
  for(const[r,c]of[[6,3],[6,4],[7,3],[7,4]])put(r,c,'knight','w');
  s.spawns={w:20,b:20};   // no Gold left to spawn with, so the choice is between merging and standing still
  s.elixir={w:6,b:0};
  const a=S.chooseAction(s),r=a.type==='merge'?E.mergeResultType(s,s.board[a.from],s.board[a.to]):null;
  if(r!=='paladin')fail('chose '+JSON.stringify(a)+' instead of merging two Knights');
  // and the same two Knights stay Knights when the Elixir isn't there
  s.elixir={w:0,b:0};
  const b=S.chooseAction(s);
  if(b.type==='merge'&&E.mergeResultType(s,s.board[b.from],s.board[b.to])==='paladin')fail('merged a Paladin it could not pay for');
});

section('speed',()=>{
  const s=E.newGame({seed:5,mode:'pvp',theme:'forest'}),pick=E.makeRandom(9);
  for(let k=0;k<30;k++){const acts=E.legalActions(s);E.step(s,acts[Math.floor(pick()*acts.length)],{trusted:true});}   // a mid-game position
  const t0=Date.now();let n=0;
  while(Date.now()-t0<1500){S.chooseAction(s);n++;}
  const per=(Date.now()-t0)/n;
  if(per>50)fail('a decision took '+per.toFixed(1)+' ms');
  return per.toFixed(2)+' ms a decision';
});

console.log(failures?'\n'+failures+' failure(s)':'\nall scripted AI tests passed');
process.exit(failures?1:0);
