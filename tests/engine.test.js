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
  // put a delayed order on the board first: it is a piece's own nested object, and a copy must not share it
  const ord=E.legalActions(s).find(a=>a.type==='order');
  if(!ord)fail('no order to test the copy with');
  else E.step(s,ord);
  const before=JSON.stringify(s),c=E.clone(s);
  const pick=E.makeRandom(3);
  for(let k=0;k<30&&!c.over;k++){const acts=E.legalActions(c);E.step(c,acts[Math.floor(pick()*acts.length)]);}
  if(JSON.stringify(s)!==before)fail('stepping a clone changed the original');
});

section('invariants hold in random games',()=>{
  const results={w:0,b:0,draw:0};
  for(let n=0;n<GAMES;n++){
    const mode=n%2?'pvp':'classic',theme=['forest','jungle','desert','ocean'][n%4];
    const {s}=playRandom({seed:n+1,mode,theme,difficulty:n%4<2?'easy':'hard',fog:n%5===0,aiSight:n%3===0,maxTurns:400},n+5000,st=>invariants(st,mode+' game '+(n+1)));
    if(!s.winner)fail('game '+(n+1)+' ended without a winner');
    else results[s.winner]++;
  }
  return 'results '+JSON.stringify(results);
});

section('every legal action is accepted',()=>{
  const pick=E.makeRandom(99);
  for(let n=0;n<30;n++){
    const s=E.newGame({seed:500+n,mode:'pvp',aiSight:n%2===0,maxTurns:300});
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

section("a pawn's first move can also push two squares sideways along its own rank, not just dead ahead",()=>{
  const s=E.newGame({seed:1,mode:'pvp',theme:'forest'});
  s.board.fill(null);s.tiles.fill('');s.blocked.fill(false);s.targets={w:{},b:{}};
  const at=(r,c)=>r*s.cols+c,put=(r,c,type,color,extra)=>{s.board[at(r,c)]=Object.assign({type,color,hp:E.STATS[type].hp,maxHp:E.STATS[type].maxHp},extra);};
  put(8,0,'king','w');put(0,8,'king','b');
  const p=at(4,4);put(4,4,'pawn','w',{firstMove:true});
  const dests=E.getDests(s,p).move;
  if(!dests.has(at(4,6)))fail('two squares right along its own rank should be a legal first move');
  if(!dests.has(at(4,2)))fail('two squares left along its own rank should be a legal first move');
  if(!dests.has(at(2,4)))fail('two squares dead ahead should still be a legal first move');
  // a piece in the way, on the passed-over square or the landing square, blocks it in either direction
  const s2=E.clone(s);
  s2.board[at(4,5)]={type:'pawn',color:'b',hp:1,maxHp:1};
  if(E.getDests(s2,p).move.has(at(4,6)))fail('a piece on the passed-over square should block the sideways push');
  const s3=E.clone(s);
  s3.board[at(4,2)]={type:'pawn',color:'b',hp:1,maxHp:1};
  if(E.getDests(s3,p).move.has(at(4,2)))fail('the landing square must be empty too');
  // spent once it has moved at all
  const s4=E.clone(s);E.step(s4,{type:'move',from:p,to:at(4,3)},{trusted:true});
  if(E.getDests(s4,at(4,3)).move.has(at(4,1)))fail('the double push is gone after any first move, including a single step');
});

section('a spring holds up to SPRING_CAP Elixir of its own, runs dry, and gains 1 back every SPRING_REFILL turns',()=>{
  const s=E.newGame({seed:1,mode:'pvp',theme:'forest'});
  s.board.fill(null);s.tiles.fill('');s.blocked.fill(false);s.targets={w:{},b:{}};
  const at=(r,c)=>r*s.cols+c;
  s.board[at(8,0)]={type:'king',color:'w',hp:5,maxHp:5};s.board[at(0,8)]={type:'king',color:'b',hp:5,maxHp:5};
  const si=at(4,4);s.tiles[si]='spring';
  s.board[si]={type:'pawn',color:'w',hp:1,maxHp:1};   // a plain White pawn parked on the spring
  s.springs=E.freshSprings(s.tiles);
  if(s.springs[si].stock!==E.SPRING_CAP)fail('a spring should start full ('+E.SPRING_CAP+'), got '+s.springs[si].stock);
  const skip=()=>E.step(s,{type:'skip'},{trusted:true});   // both sides just pass; only White holds the spring
  // one White turn every round pays 0.5, so it takes SPRING_CAP/0.5 White turns to run it dry
  for(let k=0;k<E.SPRING_CAP/0.5;k++){skip();skip();}
  if(s.springs[si].stock!==0)fail('should be dry after draining it, stock is '+s.springs[si].stock);
  if(s.elixir.w!==E.SPRING_CAP)fail('should have banked exactly '+E.SPRING_CAP+' Elixir, banked '+s.elixir.w);
  // it counts its own cooldown down by 1 every half-turn from here (own countdown, not a shared clock —
  // see creditSprings), and only gains +1 once that reaches zero — not a jump straight back to full
  for(let guard=0;s.springs[si].stock===0&&guard<50;guard++){
    if(s.elixir.w!==E.SPRING_CAP)fail('a dry spring should not pay anything more');
    skip();
  }
  if(s.springs[si].stock!==1)fail('should have gained exactly +1, not jumped to full, stock is '+s.springs[si].stock);
  // the pawn never left, so as soon as the spring has anything in it again, holding it pays out again —
  // it doesn't need to reach the cap first (with a permanent holder drawing 0.5 every White turn against
  // only +1 every SPRING_REFILL turns, it never will: extraction outpaces regen, same as a real siege)
  skip();
  if(s.elixir.w!==E.SPRING_CAP+.5)fail('a spring with any stock left should keep paying its holder, banked '+s.elixir.w);
});

section('an unheld spring still gains its regen ticks on its own clock',()=>{
  const s=E.newGame({seed:2,mode:'pvp',theme:'forest'});
  s.board.fill(null);s.tiles.fill('');s.blocked.fill(false);s.targets={w:{},b:{}};
  const at=(r,c)=>r*s.cols+c;
  s.board[at(8,0)]={type:'king',color:'w',hp:5,maxHp:5};s.board[at(0,8)]={type:'king',color:'b',hp:5,maxHp:5};
  const si=at(4,4);s.tiles[si]='spring';   // nobody standing on it
  s.springs=E.freshSprings(s.tiles);
  s.springs[si].stock=0;s.springs[si].cooldown=E.SPRING_REFILL;   // already dry, cooldown just queued up
  const skip=()=>E.step(s,{type:'skip'},{trusted:true});
  for(let guard=0;s.springs[si].cooldown>1&&guard<50;guard++){
    if(s.springs[si].stock!==0)fail('gained a tick too early with nobody standing on it');
    skip();
  }
  skip();
  if(s.springs[si].stock!==1)fail('an unheld spring should gain +1 on schedule too, stock is '+s.springs[si].stock);
  // and it keeps ticking upward on its own, unheld, until it caps out
  for(let guard=0;s.springs[si].stock<E.SPRING_CAP&&guard<100;guard++)skip();
  if(s.springs[si].stock!==E.SPRING_CAP)fail('an unheld spring should still climb all the way to the cap, stock is '+s.springs[si].stock);
});

section('an AI side attacks only what it sees; reading where the enemy stands is not enough',()=>{
  // an empty 9x9 board: a White Siege at e1 (row 8, column 4) and a Black pawn four squares up the file
  const mk=aiSight=>{
    const s=E.newGame({seed:1,mode:'pvp',theme:'forest',aiSight});
    s.board.fill(null);s.tiles.fill('');s.blocked.fill(false);s.targets={w:{},b:{}};
    const put=(r,c,type,color)=>{s.board[r*s.cols+c]={type,color,hp:E.STATS[type].hp,maxHp:E.STATS[type].maxHp};};
    put(8,0,'king','w');put(0,8,'king','b');put(8,4,'siege','w');put(4,4,'pawn','b');
    return{s,put,siege:8*9+4,pawn:4*9+4};
  };
  const shoots=(s,siege,pawn)=>E.computeActions(s,'w').some(a=>a.attacker===siege&&a.target===pawn);
  let m=mk(false);
  if(!shoots(m.s,m.siege,m.pawn))fail('without aiSight the Siege should reach 4 squares');
  m=mk(true);
  if(m.s.aiSight.w!==true||m.s.aiSight.b!==true)fail('aiSight:true should limit both sides');
  if(E.visible(m.s,m.pawn,'w'))fail('the pawn four squares from the Siege is out of sight');
  if(shoots(m.s,m.siege,m.pawn))fail('an AI side fired at a square it could not see');
  if(E.legalActions(m.s,{anyTarget:true}).some(a=>a.type==='target'&&a.to===m.pawn))fail('an AI side may lock onto a square it cannot see');
  m.s.targets.w[m.siege]=m.pawn;
  if(shoots(m.s,m.siege,m.pawn))fail('a lock on an unseen target fired');
  // a scry lights it, and a piece of its own within two squares does too
  m.s.scans.push({tiles:[m.pawn],turns:2,color:'w'});
  if(!shoots(m.s,m.siege,m.pawn))fail('a scried square should be in reach');
  m=mk(true);m.put(6,4,'pawn','w');
  if(!shoots(m.s,m.siege,m.pawn))fail('a spotter two squares away should light the target');
  m=mk({w:false,b:true});
  if(!shoots(m.s,m.siege,m.pawn))fail('aiSight for Black alone must not limit White');
  m.s.turn='b';
  const bp=E.clone(m.s);
  if(JSON.stringify(bp.aiSight)!==JSON.stringify(m.s.aiSight))fail('clone lost aiSight');
  // the Mage's meteor needs all four squares in sight
  m=mk(true);m.s.board[m.siege]={type:'mage',color:'w',hp:3,maxHp:3,mana:2};
  const meteors=E.legalActions(m.s).filter(a=>a.type==='meteor');
  if(!meteors.length)fail('a Mage should be able to cast on squares it sees');
  for(const a of meteors)for(const j of [a.to,a.to+1,a.to+m.s.cols,a.to+m.s.cols+1])if(!E.visible(m.s,j,'w'))fail('a Meteor on '+j+' which its caster cannot see');
  m=mk(false);m.s.board[m.siege]={type:'mage',color:'w',hp:3,maxHp:3,mana:2};
  if(E.legalActions(m.s).filter(a=>a.type==='meteor').length<=meteors.length)fail('without aiSight the Mage should have more Meteor squares');
});

section('a piece arriving by delayed order fires from its new square at the end of that same turn; a rolling Siege does not',()=>{
  const board=()=>{
    const s=E.newGame({seed:3,mode:'classic',theme:'forest',aiSight:{w:false,b:false}});
    s.board.fill(null);s.tiles.fill('');s.blocked.fill(false);s.targets={w:{},b:{}};s.springs={};
    s.board[8*9+0]={type:'king',color:'w',hp:5,maxHp:5};s.board[0*9+8]={type:'king',color:'b',hp:5,maxHp:5};
    s.turn='w';return s;
  };
  const at=(r,c)=>r*9+c,skip=s=>E.step(s,{type:'skip'},{trusted:true});
  // a White pawn ordered one square up, to stand beside a Black Knight it can't reach from where it starts
  // (and that Knight can't reach it from either square: neither is an L-jump away)
  const s=board();
  s.board[at(6,4)]={type:'pawn',color:'w',hp:1,maxHp:1};
  s.board[at(4,4)]={type:'knight',color:'b',hp:4,maxHp:4};
  E.step(s,{type:'order',from:at(6,4),to:at(5,4),turns:1},{trusted:true});
  if(s.turn==='w')skip(s);                       // White's turn ends with the pawn still at home
  skip(s);                                        // Black's turn ends; White's turn begins, and the order lands
  if(!(s.board[at(5,4)]&&s.board[at(5,4)].type==='pawn'))fail('the ordered pawn did not arrive at the head of its turn');
  if(s.board[at(4,4)].hp!==4)fail('the Knight was hit before the pawn had even had its turn');
  if(s.board[at(5,4)].rolled)fail('a pawn arriving by order was marked as holding its fire');
  skip(s);                                        // the same turn ends: it fires from the square it arrived on
  if(!s.board[at(4,4)]||s.board[at(4,4)].hp!==3)fail('the pawn that arrived by order did not fire that same turn (Knight at '+(s.board[at(4,4)]?s.board[at(4,4)].hp:'none')+' HP)');
  // a Siege's order is a roll to the square beside it, and it spends that turn rolling
  const t=board();
  t.board[at(6,6)]={type:'siege',color:'w',hp:6,maxHp:6,sieged:true};
  E.step(t,{type:'order',from:at(6,6),to:at(6,5),turns:1},{trusted:true});
  if(t.turn==='w')skip(t);
  skip(t);
  if(!(t.board[at(6,5)]&&t.board[at(6,5)].type==='siege'))fail('the ordered Siege did not roll');
  else if(!t.board[at(6,5)].rolled)fail('a Siege that rolled by order is not holding its fire');
});

section('a piece holds its fire on its old square on its moving turn only; an order that strikes is its one shot',()=>{
  const board=()=>{
    const s=E.newGame({seed:3,mode:'classic',theme:'forest',aiSight:{w:false,b:false}});
    s.board.fill(null);s.tiles.fill('');s.blocked.fill(false);s.targets={w:{},b:{}};s.springs={};
    s.board[8*9+0]={type:'king',color:'w',hp:5,maxHp:5};s.board[0*9+8]={type:'king',color:'b',hp:5,maxHp:5};
    s.turn='w';return s;
  };
  const at=(r,c)=>r*9+c,skip=s=>E.step(s,{type:'skip'},{trusted:true}),pawn=at(6,4);
  const knight=()=>({type:'knight',color:'b',hp:4,maxHp:4}),hp=(s,j)=>s.board[j]?s.board[j].hp:0;
  // a helmeted White pawn with a Black Knight in its reach (helmeted, so the Knight's own volley can't end the test)
  const setup=()=>{
    const s=board();
    s.board[pawn]={type:'pawn',color:'w',hp:3,maxHp:3,fortified:true};
    const near=[at(5,3),at(5,4),at(5,5)].find(j=>{s.board[j]=knight();
      const ok=E.computeActions(s,'w').some(a=>a.attacker===pawn&&a.target===j);s.board[j]=null;return ok;});
    if(near!==undefined)s.board[near]=knight();
    return{s,near};
  };
  const control=setup();
  if(control.near===undefined){fail('setup: no square in the pawn\'s reach');return;}
  skip(control.s);
  if(hp(control.s,control.near)!==3)fail('setup: without an order the pawn should have fired');
  // ordered one turn ahead: the turn it is ordered is its moving turn, and it holds its fire
  const one=setup();
  const order1=E.legalActions(one.s).find(a=>a.type==='order'&&a.from===pawn&&a.turns===1);
  if(!order1){fail('setup: the pawn has no one-turn order');return;}
  E.step(one.s,order1,{trusted:true});
  if(one.s.turn==='w')skip(one.s);
  if(hp(one.s,one.near)!==4)fail('the pawn fired from the square it is leaving, on its moving turn');
  // ordered two turns ahead: it fires as usual the turn it is ordered, and holds only the next, its moving turn
  const{s,near}=setup();
  const order=E.legalActions(s).find(a=>a.type==='order'&&a.from===pawn&&a.turns===2);
  if(!order){fail('setup: the pawn has no two-turn order');return;}
  E.step(s,order,{trusted:true});
  if(s.turn==='w')skip(s);
  if(hp(s,near)!==3)fail('a pawn ordered two turns ahead should fire as usual the turn it is ordered');
  skip(s);                                        // Black's turn ends; White's begins, the order a turn from due
  if(!(s.board[pawn]&&s.board[pawn].order&&s.board[pawn].order.turns===1))fail('setup: the order should be one turn from due');
  skip(s);
  if(hp(s,near)!==3)fail('the pawn fired from the square it is leaving, on its moving turn');
  // an order whose square an enemy has stepped onto strikes it instead; that strike is the turn's one shot
  const t=board();
  t.board[pawn]={type:'pawn',color:'w',hp:3,maxHp:3,fortified:true};
  E.step(t,{type:'order',from:pawn,to:at(5,4),turns:1},{trusted:true});
  if(t.turn==='w')skip(t);
  t.board[at(5,4)]=knight();                      // a Black Knight steps onto the reserved square
  skip(t);                                        // Black's turn ends; White's begins, and the order strikes
  if(hp(t,at(5,4))!==3)fail('the order did not strike the Knight standing on its square');
  skip(t);
  if(hp(t,at(5,4))!==3)fail('the pawn whose order struck fired again from the square it never left');
  skip(t);skip(t);                                // its next turn, it fires as usual
  if(hp(t,at(5,4))!==2)fail('the pawn should fire as usual the turn after its order struck');
});

section('a bishop strips the helmet off an enemy fortified pawn within 2 squares, for good',()=>{
  const s=E.newGame({seed:3,mode:'classic',theme:'forest',aiSight:{w:false,b:false}});
  s.board.fill(null);s.tiles.fill('');s.blocked.fill(false);s.targets={w:{},b:{}};s.springs={};
  const at=(r,c)=>r*9+c,skip=t=>E.step(t,{type:'skip'},{trusted:true}),bishop=at(6,4);
  s.board[at(8,0)]={type:'king',color:'w',hp:5,maxHp:5};s.board[at(0,8)]={type:'king',color:'b',hp:5,maxHp:5};
  s.board[bishop]={type:'bishop',color:'w',hp:10,maxHp:10,mana:2};   // sturdy: Black's pawns shoot at it on their turn
  const helmet=()=>({type:'pawn',color:'b',hp:3,maxHp:3,fortified:true});
  s.board[at(5,5)]=helmet();   // one diagonal step: in reach
  s.board[at(4,6)]=helmet();   // two diagonal steps, behind the first: in reach, over it
  s.board[at(4,2)]=helmet();   // two diagonal steps the other way: in reach
  s.board[at(5,4)]=helmet();   // straight ahead: in reach (any direction)
  s.board[at(4,3)]=helmet();   // a knight's jump away: in reach (within 2)
  s.board[at(3,7)]=helmet();   // three steps: too far
  s.board[at(6,1)]=helmet();   // three along the row: too far
  s.blocked[at(5,3)]=true;     // an obstacle in between stops nothing
  s.board[at(7,5)]={type:'pawn',color:'b',hp:1,maxHp:1};   // in reach, but no helmet to strip
  s.turn='w';
  const strips=t=>E.legalActions(t).filter(a=>a.type==='strip').map(a=>a.to).sort((a,b)=>a-b);
  const reach=[at(4,2),at(4,3),at(4,6),at(5,4),at(5,5)].sort((a,b)=>a-b);
  if(JSON.stringify(strips(s))!==JSON.stringify(reach))fail('strip reaches '+strips(s)+', expected '+reach);
  if(!E.isLegal(s,{type:'strip',from:bishop,to:at(5,5)}))fail('a strip in reach should be legal');
  E.step(s,{type:'strip',from:bishop,to:at(5,5)});
  const t=s.board[at(5,5)];
  if(!t||t.fortified||!t.stripped||t.hp!==1||t.maxHp!==1)fail('the stripped pawn should be a plain 1-HP pawn, marked stripped: '+JSON.stringify(t));
  if(s.board[bishop].mana!==1)fail('a strip should cost the bishop 1 mana, it has '+s.board[bishop].mana);
  if(s.turn!=='b')fail('a strip should take the turn');
  if(!s.board[at(5,5)])fail('the bishop shot the pawn it had just stripped — a strip is its turn, as a heal is');
  if(!E.clone(s).board[at(5,5)].stripped)fail('clone lost the stripped mark');
  // Black's turn: the stripped pawn can't be fortified again; its plain neighbour still can
  const fortifies=E.legalActions(s).filter(a=>a.type==='fortify').map(a=>a.from);
  if(fortifies.includes(at(5,5)))fail('a stripped pawn was offered Fortify');
  if(!fortifies.includes(at(7,5)))fail('setup: the plain pawn should be able to fortify');
  skip(s);
  // White again: no mana, no strip
  s.board[bishop].mana=0;
  if(strips(s).length)fail('a bishop without mana could strip');
  s.board[bishop].mana=1;
  const left=reach.filter(j=>j!==at(5,5));
  if(JSON.stringify(strips(s))!==JSON.stringify(left))fail('with 1 mana the other helmets should be strippable: '+strips(s));
});

section("half a turn on a pawn's order leaves another pawn's order or the end of the turn, nothing else",()=>{
  const s=E.newGame({seed:5,mode:'classic',theme:'forest'});
  const spawn=E.legalActions(s).find(a=>a.type==='spawn');
  const first=E.legalActions(s).find(a=>a.type==='order'&&s.board[a.from].type==='pawn'&&a.turns===1);
  if(!spawn||!first){fail('setup: no spawn or pawn order at the start');return;}
  E.step(s,first);
  if(s.turn!=='w')fail("a pawn's order should leave half the turn");
  const acts=E.legalActions(s),kinds=[...new Set(acts.map(a=>a.type))].sort();
  if(JSON.stringify(kinds)!==JSON.stringify(['order','skip']))fail("after a pawn's order the turn offers "+kinds);
  if(acts.some(a=>a.type==='order'&&(s.board[a.from].type!=='pawn'||a.from===first.from)))fail("the second order should be another pawn's");
  if(E.isLegal(s,spawn))fail('a spawn on top of an order was legal');
  E.step(s,acts.find(a=>a.type==='order'));
  if(s.turn!=='b')fail('two pawn orders should end the turn');
  // one order and then nothing: the turn passes
  const t=E.newGame({seed:5,mode:'classic',theme:'forest'});
  E.step(t,first);E.step(t,{type:'skip'});
  if(t.turn!=='b')fail('skipping after an order should end the turn');
  // a fresh turn after it offers everything again
  E.step(t,{type:'skip'});
  if(t.turn!=='w'||!E.legalActions(t).some(a=>a.type==='spawn'))fail('the next turn should offer spawning again');
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
