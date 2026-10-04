// Scripted AI self-tests (rl/scripted.js): its moves are legal and repeatable, it beats a random player in
// both turn orders and both colours, it plays the current economy — spawns, holds mines and springs,
// merges up — and it plays by normal sight: nothing it can't see is attacked, it Scrys to see, and it
// gives delayed orders. Run: node tests/scripted.test.js [games]
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

const NOT_USED=new Set(['unsiege','healLock']);

// the scripted AI as `botColor` against a random player (pvp, either colour) or the old built-in AI
// (classic, where Black always belongs to it); `onAction` sees every action it takes. Both sides play by
// normal sight (aiSight), the rule the training worker plays every game by
function play(seed,mode,botColor,against,onAction,profile){
  const s=E.newGame({seed,mode,theme:THEMES[seed%4],difficulty:seed%2?'easy':'hard',maxTurns:300,aiSight:true});
  const pick=E.makeRandom(seed*7919+3);
  while(!s.over){
    if(s.turn===botColor){
      for(let k=0;k<8&&!s.over&&s.turn===botColor;k++){
        const a=S.chooseAction(s,profile?{profile}:undefined);
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
      // the King stays home unless an enemy piece is within two squares of it (then it may step out of reach)
      if(a.type==='move'&&s.board[a.from].type==='king'
        &&!s.board.some((p,j)=>p&&p.color!==s.turn&&(p.color==='w'||p.color==='b')&&p.type!=='king'&&E.cheb(s,j,a.from)<=2))
        fail('seed '+seed+': moved its King with no enemy near it');
      if(a.type==='order'&&!(a.turns===1&&(s.board[a.from].type==='pawn'||s.board[a.from].type==='siege')))fail('seed '+seed+': an order it should not give: '+JSON.stringify(a));
      if(a.type==='scry'&&!s.board.some((p,j)=>p&&p.color!==s.turn&&!E.visible(s,j,s.turn)&&E.cheb(s,j,a.to)<=1))fail('seed '+seed+': a Scry with nothing unseen in it');
      // whatever it fires on at the end of the turn, it can see
      if(E.computeActions(s,s.turn).some(f=>f.action==='attack'&&s.board[f.attacker].type!=='mage'&&!E.visible(s,f.target,s.turn)))fail('seed '+seed+': its pieces would fire on a square it cannot see');
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
  // lower than before the spring's own cap and the LEAD_PUSH fix (2026-09-27): a capped spring pays at most
  // SPRING_CAP before it needs SPRING_REFILL turns to recover, and games are shorter now that it presses a
  // lead instead of turtling — so there's less time, and less to draw, for the tiles to pay altogether
  if(per('held')<1.5)fail('the mines and springs paid only '+per('held').toFixed(1)+' a game');
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

section('it Scrys a square it cannot see, so that its Siege can fire at it',()=>{
  // an empty 9x9 board: White's Siege at e1 (row 8), a Bishop with both its mana walled into the corner
  // (so it cannot walk up as a spotter instead), and a Black Queen four squares up the file — out of
  // everyone's sight until a Scry lights it
  const s=E.newGame({seed:2,mode:'pvp',theme:'forest',aiSight:true});
  s.board.fill(null);s.tiles.fill('');s.blocked.fill(false);s.targets={w:{},b:{}};
  const at=(r,c)=>r*s.cols+c,put=(r,c,type,color,extra)=>{s.board[at(r,c)]=Object.assign({type,color,hp:E.STATS[type].hp,maxHp:E.STATS[type].maxHp},extra);};
  put(8,8,'king','w');put(0,8,'king','b');put(8,4,'siege','w');put(8,0,'bishop','w',{mana:2});put(4,4,'queen','b');
  s.blocked[at(7,1)]=true;
  s.spawns={w:99,b:99};   // nothing to spawn with: the turn is for the Siege's shot or nothing
  if(E.computeActions(s,'w').some(f=>f.attacker===at(8,4)))fail('the Siege fired on a Queen four squares out that nobody sees');
  const a=S.chooseAction(s);
  if(a.type!=='scry'||E.cheb(s,a.to,at(4,4))>1)fail('chose '+JSON.stringify(a)+' instead of a Scry over the Queen');
  else{
    const c=E.clone(s);E.step(c,a);
    if(!(c.board[at(4,4)]&&c.board[at(4,4)].hp<E.STATS.queen.hp)&&c.board[at(4,4)])fail('the Scry did not let the Siege hit the Queen');
  }
});

// since 2026-10-04 an order's other half can go only on a second pawn's order: two pawns walk in a turn
// that could have spawned, moved or merged instead, and nothing else ever goes beside an order
section('it gives delayed orders, two pawns to a turn, and nothing beside them',()=>{
  const c={orders:0,pairs:0,turnsWithOrderAndMore:0,turns:0};
  for(let seed=1;seed<=8;seed++){
    const s=E.newGame({seed,mode:'pvp',theme:THEMES[seed%4],aiSight:true,maxTurns:120}),pick=E.makeRandom(seed);
    while(!s.over&&s.turnCount.w<30){
      if(s.turn==='w'){
        const events=S.playTurn(s);
        c.turns++;
        const kinds=events.map(e=>e.type);
        const n=kinds.filter(k=>k==='order').length;
        c.orders+=n;if(n>1)c.pairs++;
        if(n&&kinds.some(k=>k!=='order'&&k!=='skip'&&k!=='attack'&&k!=='move'&&k!=='heal'))c.turnsWithOrderAndMore++;
      }else{const acts=E.legalActions(s);E.step(s,acts[Math.floor(pick()*acts.length)],{trusted:true});}
    }
  }
  if(c.orders<c.turns*.03)fail('gave only '+c.orders+' orders in '+c.turns+' turns');
  if(!c.pairs)fail('never sent two pawns on orders in one turn');
  if(c.turnsWithOrderAndMore)fail(c.turnsWithOrderAndMore+' turns put a spawn, merge or other action beside an order');
  return c.orders+' orders in '+c.turns+' turns, '+c.pairs+' turns with two';
});

section("opts.orders:false keeps its orders out (training leaves Black's out at first)",()=>{
  let withOrders=0,without=0;
  for(let seed=1;seed<=6;seed++){
    for(const orders of [true,false]){
      const s=E.newGame({seed,mode:'classic',theme:THEMES[seed%4],aiSight:true,maxTurns:80}),pick=E.makeRandom(seed);
      while(!s.over){
        if(s.turn==='b'){
          const n=S.playTurn(s,{orders}).filter(e=>e.type==='order').length;
          if(orders)withOrders+=n;else without+=n;
        }else{const acts=E.legalActions(s);E.step(s,acts[Math.floor(pick()*acts.length)],{trusted:true});}
      }
    }
  }
  if(!withOrders)fail('it gave no orders by default');
  if(without)fail('it gave '+without+' orders with orders:false');
  return withOrders+' orders by default, none with orders:false';
});

section('it does not need aiSight switched on for it: it plays by normal sight regardless',()=>{
  const s=E.newGame({seed:9,mode:'pvp',theme:'forest'});   // no aiSight in the state
  const before=JSON.stringify(s.aiSight);
  S.chooseAction(s);
  if(JSON.stringify(s.aiSight)!==before)fail('chooseAction changed the state it was given');
  S.playTurn(s);
  if(!s.aiSight.w)fail('playTurn should switch normal sight on for the side it plays');
  if(s.aiSight.b)fail('playTurn switched sight on for the other side too');
});

section('a dominant position keeps closing the distance to the enemy King, not just spawning and merging',()=>{
  // White has an overwhelming army parked near its own King; Black is a lone King far across an empty
  // board. White should spend at least some of its turns advancing (by move or by a delayed order),
  // not only building — the closest piece should end up meaningfully nearer than where it started
  const s=E.newGame({seed:1,mode:'pvp',theme:'forest',aiSight:true});
  s.board.fill(null);s.tiles.fill('');s.blocked.fill(false);s.targets={w:{},b:{}};
  const at=(r,c)=>r*s.cols+c,put=(r,c,type,color,extra)=>{s.board[at(r,c)]=Object.assign({type,color,hp:E.STATS[type].hp,maxHp:E.STATS[type].maxHp},extra);};
  put(8,0,'king','w');put(0,8,'king','b');
  put(7,0,'knight','w');put(7,1,'knight','w');put(6,0,'rook','w');put(6,1,'bishop','w',{mana:2});
  put(7,2,'pawn','w');put(6,2,'pawn','w');
  s.spawns={w:0,b:0};s.elixir={w:0,b:0};
  const bKing=()=>s.board.findIndex(p=>p&&p.type==='king'&&p.color==='b');
  const closest=()=>{let m=99;s.board.forEach((p,i)=>{if(p&&p.color==='w'&&p.type!=='king')m=Math.min(m,E.cheb(s,i,bKing()));});return m;};
  const before=closest();
  let advanced=0;
  for(let t=0;t<30&&!s.over;t++){
    if(s.turn==='w'){
      const a=S.chooseAction(s);
      if(a.type==='move'||a.type==='order')advanced++;
      E.step(s,a,{trusted:true});
    }else E.step(s,{type:'skip'},{trusted:true});
  }
  if(!advanced)fail('30 White decisions and none of them moved or ordered a piece forward');
  if(closest()>=before)fail('the closest piece to the enemy King is no nearer after 30 decisions ('+before+' -> '+closest()+')');
});

section("it wins economically: the army it has when it wins isn't much bigger than the win needed",()=>{
  // the same Gold-equivalent unit prices as VALUE in rl/scripted.js, to size up its own army independently
  const VALUE={pawn:1,knight:2.6,bishop:3.9,rook:4.2,queen:7,siege:9.6,guardian:8.2,paladin:8.6,mage:10.4};
  const full=p=>p.type==='pawn'&&p.fortified?2.6:(VALUE[p.type]||0);
  const armyWorth=(s,color)=>s.board.reduce((v,p)=>v+(p&&p.color===color&&p.type!=='king'?full(p)*(.3+.7*p.hp/p.maxHp):0),0);
  const games=Math.max(16,GAMES/2|0);
  let won=0;const worths=[];
  for(let seed=1;seed<=games;seed++){
    const s=play(seed*13+5,'classic','w','builtin');
    if(s.winner==='w'){won++;worths.push(armyWorth(s,'w'));}
  }
  const avg=worths.reduce((a,b)=>a+b,0)/worths.length;
  // before it pulled toward a lead, the average was around 43 (up to 92) against this same opponent
  if(avg>=30)fail('average army at the moment of victory is '+avg.toFixed(1)+', not meaningfully smaller than before the lead pull');
  if(won<games*.7)fail('won only '+won+' of '+games+' against the old built-in AI');
  return won+' of '+games+' won; army at victory, Gold-equivalent: avg '+avg.toFixed(1)+', max '+Math.max(...worths).toFixed(1);
});

// A lone Knight hunts White's King: whenever the King is in its L-reach it stays and fires, otherwise it jumps
// to a square that puts it there (or nearer). The trained network beat every game of the old scripted AI with
// a rush built on exactly this — and the old one, King never allowed to step, took two hits before it killed
// the Knight even when it did.
function knightHunt(kn,pawns){
  const s=E.newGame({seed:5,mode:'classic',theme:'forest',aiSight:{w:true,b:true}});
  s.board.fill(null);s.tiles.fill('');s.blocked.fill(false);s.targets={w:{},b:{}};s.springs={};
  const at=(r,c)=>r*9+c;
  s.board[at(7,1)]={type:'king',color:'w',hp:5,maxHp:5};
  s.board[at(1,7)]={type:'king',color:'b',hp:5,maxHp:5};
  for(const[r,c]of[[6,2],[7,2]].slice(0,pawns))s.board[at(r,c)]={type:'pawn',color:'w',hp:1,maxHp:1,firstMove:true};
  s.board[at(kn[0],kn[1])]={type:'knight',color:'b',hp:4,maxHp:4};
  s.turn='w';
  return s;
}
function huntStep(s){
  const g=E.geo(s),B=s.board,k=B.findIndex(p=>p&&p.type==='knight'&&p.color==='b'),K=B.findIndex(p=>p&&p.type==='king'&&p.color==='w');
  const moves=k<0||K<0||g.kj[k].includes(K)?[]:E.legalActions(s).filter(a=>a.type==='move'&&a.from===k);
  if(!moves.length)return E.step(s,{type:'skip'},{trusted:true});
  moves.sort((a,b)=>(g.kj[b.to].includes(K)?1:0)-(g.kj[a.to].includes(K)?1:0)||E.cheb(s,a.to,K)-E.cheb(s,b.to,K));
  E.step(s,moves[0],{trusted:true});
}
section('when a Knight comes for its King, it defends: the Knight dies and the King takes no hit',()=>{
  const cases=[['the Knight already on an attacking square, the King alone',[5,2],0],
               ['the Knight already attacking, two pawns at home',[5,2],2],
               ['the Knight one jump out, two pawns at home',[3,3],2]];
  let n=0;
  for(const name of ['balanced','rush','fortress'])for(const[what,kn,pawns]of cases){
    const s=knightHunt(kn,pawns);
    for(let r=0;r<8&&!s.over;r++){S.playTurn(s,{profile:name});if(!s.over)huntStep(s);}
    const K=s.board.find(p=>p&&p.type==='king'&&p.color==='w');
    if(!K||K.hp<5)fail(name+', '+what+': the King took '+(5-(K?K.hp:0))+' hit(s)');
    if(s.board.some(p=>p&&p.type==='knight'&&p.color==='b'))fail(name+', '+what+': the Knight is still alive after 8 rounds');
    n++;
  }
  return n+' hunts, every one fended off';
});

section('a strategy is drawn per game: the same draw from the same seed, any of them, or the one named',()=>{
  const a=S.pickProfile(E.makeRandom(5)),b=S.pickProfile(E.makeRandom(5));
  if(a.name!==b.name||a.onset!==b.onset)fail('the same seed drew '+a.name+'@'+a.onset+' and '+b.name+'@'+b.onset);
  const seen=new Set(),r=E.makeRandom(1);
  for(let k=0;k<300;k++)seen.add(S.pickProfile(r).name);
  if(seen.size!==S.PROFILE_NAMES.length)fail('300 draws only ever gave '+[...seen].join(', '));
  for(const name of S.PROFILE_NAMES)for(let k=0;k<20;k++){
    const p=S.pickProfile(E.makeRandom(k),name),[lo,hi]=S.PROFILES[name].onset||[0,0];
    if(p.name!==name)fail('asked for '+name+', got '+p.name);
    if(p.onset<lo||p.onset>hi)fail(name+"'s onset "+p.onset+' is outside '+lo+'-'+hi);
  }
  // asking for no strategy at all plays the balanced one, so every caller that predates them plays as it did
  const s=E.newGame({seed:9,mode:'pvp',theme:'forest'}),pick=E.makeRandom(4);
  for(let k=0;k<25;k++){const acts=E.legalActions(s);E.step(s,acts[Math.floor(pick()*acts.length)],{trusted:true});}
  if(JSON.stringify(S.chooseAction(s))!==JSON.stringify(S.chooseAction(s,{profile:'balanced'})))fail('no strategy is not the same as balanced');
  return S.PROFILE_NAMES.length+' strategies: '+S.PROFILE_NAMES.join(', ');
});

section('each strategy builds only its own top tier, and every move it makes is legal',()=>{
  const TOP=new Set(['queen','paladin','guardian','mage','siege']);
  let n=0;
  for(const name of S.PROFILE_NAMES){
    const prof=S.pickProfile(E.makeRandom(11),name);
    play(31,'classic','w','builtin',(s,a)=>{
      n++;
      if(!E.isLegal(s,a))fail(name+': illegal action '+JSON.stringify(a));
      if(a.type==='merge'&&prof.only){
        const r=E.mergeResultType(s,s.board[a.from],s.board[a.to]);
        if(TOP.has(r)&&!prof.only.includes(r))fail(name+' merged into a '+r+', not one of its own ('+prof.only.join(', ')+')');
      }
    },prof);
  }
  return n+' actions checked';
});

// what the user asked for, measured against the old built-in AI: a Knights game makes Paladins, a Mage game
// Mages, a Siege game Sieges, and a Fortress holds the tiles and only comes at you long after a Rush would have
section('the strategies play differently: what they build, the tiles they hold, when they attack',()=>{
  const games=3,stats={};
  for(const name of ['rush','knights','arcane','siegeworks','fortress']){
    const st=stats[name]={made:{},tiles:0,turns:0,strike:[]};
    for(let g=0;g<games;g++){
      const s=E.newGame({seed:60+g,mode:'classic',difficulty:'hard',theme:THEMES[g%4],aiSight:{w:true,b:true},maxTurns:300});
      const prof=S.pickProfile(E.makeRandom(3+g),name),made=new Set();
      let mine=0,strike=-1;
      while(!s.over){
        if(s.turn==='w'){S.playTurn(s,{profile:prof});mine++;}else E.botTurn(s);
        const eK=s.board.findIndex(p=>p&&p.color==='b'&&p.type==='king');
        s.board.forEach((p,i)=>{
          if(!p||p.color!=='w'||p.type==='king')return;
          made.add(p.type);
          if(strike<0&&eK>=0&&p.type!=='pawn'&&E.cheb(s,i,eK)<=3)strike=mine;
        });
        st.tiles+=E.heldTiles(s,'w','mine').length+E.heldTiles(s,'w','spring').length;st.turns++;
      }
      for(const t of made)st.made[t]=(st.made[t]||0)+1;
      if(strike>=0)st.strike.push(strike);
    }
  }
  const madeIn=(name,t)=>stats[name].made[t]||0;
  const strike=name=>{const a=stats[name].strike;return a.length?a.reduce((x,y)=>x+y,0)/a.length:Infinity;};
  const tiles=name=>stats[name].tiles/stats[name].turns;
  if(madeIn('knights','paladin')<2)fail('Knights & Paladins made a Paladin in only '+madeIn('knights','paladin')+' of '+games+' games');
  if(madeIn('arcane','mage')<2)fail('Bishops & Mages made a Mage in only '+madeIn('arcane','mage')+' of '+games+' games');
  if(madeIn('siegeworks','siege')<2)fail('Rooks & Sieges made a Siege in only '+madeIn('siegeworks','siege')+' of '+games+' games');
  if(!(strike('fortress')>strike('rush')+20))fail('the Fortress struck first at turn '+strike('fortress').toFixed(0)+', hardly later than the Rush ('+strike('rush').toFixed(0)+')');
  if(!(tiles('fortress')>tiles('rush')+.5))fail('the Fortress held '+tiles('fortress').toFixed(1)+' tiles on average, no more than the Rush ('+tiles('rush').toFixed(1)+')');
  return 'first strike: rush turn '+strike('rush').toFixed(0)+', fortress turn '+strike('fortress').toFixed(0)
    +'; tiles held: rush '+tiles('rush').toFixed(1)+', fortress '+tiles('fortress').toFixed(1);
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
