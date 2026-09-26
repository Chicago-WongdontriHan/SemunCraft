// ── SEMUNCRAFT SCRIPTED AI ───────────────────────────────────────────────────
// A hand-written opponent for training and for measuring a trained network against. It knows no rules of
// its own: every move it considers comes from the engine's legalActions, and every move is judged by
// playing it out on a copy of the state with the engine's own step — so a change to the rules (a unit's
// range, a splash, a price) changes what it sees without touching this file. What it does bring is a
// yardstick for "good": an evaluation of a position in Gold-equivalents that rewards
//   - material (every unit priced by what it costs to make, scaled by its health), and the two Kings' health;
//   - Gold and Elixir in hand (an Elixir counts as a Gold up to a Paladin's 3, and hardly at all beyond, so
//     a spring's income is there to be spent), and the mines and springs a plain pawn holds — a spring
//     pays half an Elixir a turn (ELIXIR_RATE), three times what a mine pays in Gold, so springs come first;
//   - pawns walking to a tile they don't hold yet, and the army closing on the enemy King;
//   - pieces standing side by side that could merge into something dearer, each in at most one such pair;
//   - a Meteor that is still on its way (what it will hit, friend and foe alike).
// Each candidate is scored twice: right after the move (with the end-of-turn fire it triggers), and again
// after the opponent passes, so it sees what its move leaves standing in the enemy's reach — including a
// Siege shell's splash on its own pieces.
//
// It has the normal sight of a player with Map Cheat off, and no more. It reads the whole board — where
// the enemy stands is in the state it is handed — but the engine lets a side whose sight is limited
// (aiSight, which playTurn switches on for the side it plays) attack only what that side can see: within
// two squares of one of its pieces (three of a Guardian), along a Mage's fire, or in a Scry. So a Rook or
// a Siege shooting three or four squares out needs a spotter beside the target or a Bishop's Scry, and it
// casts a Scry when the 3x3 it lights, with an enemy in it, is worth the turn.
//
// It also gives delayed orders. A pawn's order costs half the turn's budget and leaves the turn free, so
// each turn a pawn walks a square on its order while the King spawns or two pieces merge; the Siege moves
// no other way. An order is judged by what it changes once the turn is over and the opponent has passed,
// against not giving it.
//
// It plays the standard game for either side in either turn order. It doesn't chase a campaign level's
// objective, and keeps its King at home. Loads as a classic <script> after js/engine.js (global
// SemunScripted) or in Node, like rl/encoding.js.
//
//   chooseAction(state)  the one action it would take now, for state.turn
//   playTurn(state)      plays until the turn passes, like SemunEngine.botTurn; returns the events
(function(root){
'use strict';
const E=typeof module!=='undefined'&&module.exports?require('../js/engine.js'):root.SemunEngine;

// What a full-health piece is worth, in Gold: about what it costs to make (Elixir counted as a Gold),
// nudged up so each merge is a small step forward. A helmet (1 Gold) makes a pawn worth 2.6 — three Health
// to a pawn's one, and half of a Rook — and a Rook a little more than its two parts, which is what gets
// the Rooks, and the Siege, Guardian and Mage made of them, built at all.
const VALUE={pawn:1,knight:2.6,bishop:3.9,rook:4.2,queen:7,siege:9.6,guardian:8.2,paladin:8.6,mage:10.4};
const FORTIFIED=2.6;       // a pawn in a helmet
const KING_HP=14;          // each point of a King's health
const GOLD=.8, ELIXIR=1, MANA=.4;
const ELIXIR_USE=3, ELIXIR_EXTRA=.1;   // Elixir is worth its price up to the dearest thing it buys (a Paladin's 3); a bank beyond that is mostly idle
const MINE=3, SPRING=4;    // holding one, for as long as it is held (a spring pays half an Elixir a turn, a mine a sixth of Gold)
const TOP=10;              // candidates that get the second, deeper look

const elixirWorth=e=>ELIXIR*Math.min(e,ELIXIR_USE)+ELIXIR_EXTRA*Math.max(0,e-ELIXIR_USE);
const full=p=>p.type==='pawn'&&p.fortified?FORTIFIED:(VALUE[p.type]||0);
const worth=p=>full(p)*(.3+.7*p.hp/p.maxHp);
const isSide=p=>!!p&&(p.color==='w'||p.color==='b');   // not the training ground's Scarecrow

// How good `s` is for `me`, in Gold. A finished game is worth ±1e6 (a draw 0).
function evaluate(s,me){
  if(s.over)return s.winner===me?1e6:s.winner==='draw'?0:-1e6;
  const you=me==='w'?'b':'w',B=s.board,g=E.geo(s);
  let score=0,myKing=-1,theirKing=-1;
  const mine=[],theirs=[];
  for(let i=0;i<B.length;i++){
    const p=B[i];if(!isSide(p))continue;
    const own=p.color===me,sign=own?1:-1;
    if(p.type==='king'){score+=sign*KING_HP*p.hp;if(own)myKing=i;else theirKing=i;continue;}
    score+=sign*worth(p);
    if(p.mana)score+=sign*MANA*p.mana;
    (own?mine:theirs).push(i);
  }
  score+=GOLD*(E.spawnRemaining(s,me)-E.spawnRemaining(s,you));
  score+=elixirWorth(s.elixir[me])-elixirWorth(s.elixir[you]);

  // the mines and springs: what each side holds pays every turn; pawns of mine that hold nothing go
  // looking for a tile I don't hold, the dearest first, each by its nearest free pawn
  const held=new Set(),unheld=[];
  for(let i=0;i<s.tiles.length;i++){
    const t=s.tiles[i];if(t!=='mine'&&t!=='spring')continue;
    const val=t==='mine'?MINE:SPRING,p=B[i];
    const holder=isSide(p)&&p.type==='pawn'&&!p.fortified?p.color:null;
    if(holder===me){score+=val;held.add(i);}
    else{if(holder===you)score-=val;unheld.push([i,val]);}
  }
  const free=mine.filter(i=>B[i].type==='pawn'&&!B[i].fortified&&!held.has(i));
  const seekers=new Set();
  unheld.sort((a,b)=>b[1]-a[1]);
  for(const[ti]of unheld){
    let best=-1,bd=99;
    for(let k=0;k<free.length;k++){const d=E.cheb(s,free[k],ti);if(d<bd){bd=d;best=k;}}
    if(best<0)break;
    score+=.22*(9-Math.min(bd,9));
    seekers.add(free[best]);free.splice(best,1);
  }
  // the rest of the army closes on the enemy King, ever harder as the game wears on: approaching costs a
  // volley (the piece that moves doesn't fire), so without a push two armies would sit out of range of
  // each other until the turn cap
  const push=1+s.turnCount[me]/12;
  if(theirKing>=0)for(const i of mine){
    if(seekers.has(i))continue;
    const p=B[i],d=E.cheb(s,i,theirKing);
    score+=push*(p.type==='pawn'?.03*(12-d):.05*Math.sqrt(full(p))*(12-d));
  }
  // enemy pieces close to my King
  if(myKing>=0)for(const i of theirs)if(E.cheb(s,i,myKing)<=2)score-=B[i].type==='pawn'?.5:1;
  // two of mine side by side that could merge into something dearer (Elixir and helmets counted): half of
  // what the merge would gain, so making it is always a step forward. Each piece is in at most one such
  // pair, the dearest first — a block of four Knights has one Paladin's worth of merging to do at a time,
  // not six pairs' worth, or making the merge would look like losing the rest
  const pairs=[];
  for(const i of mine){
    for(const j of g.adj8[i]){
      if(j<=i)continue;
      const b=B[j];if(!b||b.color!==me)continue;
      const r=E.mergeResultType(s,B[i],b);if(!r)continue;
      const gain=VALUE[r]-full(B[i])-full(b)-(elixirWorth(s.elixir[me])-elixirWorth(s.elixir[me]-E.elixirCost(r)));
      if(gain>0)pairs.push([gain,i,j]);
    }
  }
  pairs.sort((x,y)=>y[0]-x[0]);
  const paired=new Set();
  for(const[gain,i,j]of pairs){
    if(paired.has(i)||paired.has(j))continue;
    paired.add(i);paired.add(j);
    score+=.5*gain;
  }
  // a Meteor still on its way: half of what it will take from whoever stands under it, either side
  for(const m of s.meteors||[])for(const t of m.tiles){
    const p=B[t];if(!isSide(p))continue;
    let loss;
    if(p.type==='king')loss=KING_HP*Math.min(2,p.hp);
    else{const hp=Math.max(0,p.hp-2);loss=worth(p)-(hp>0?full(p)*(.3+.7*hp/p.maxHp):0);}
    score+=(p.color===me?-.5:.5)*loss;
  }
  return score;
}

// the same choice every time for the same position, without touching the game's random stream
const TYPE_CODE={move:1,merge:2,target:3,heal:4,spawn:5,fortify:6,meteor:7,skip:8,order:9,scry:10};
function noise(s,a){
  let h=((a.from|0)*73856093)^((a.to|0)*19349663)^(s.turnCount.w*83492791)^(s.turnCount.b*2654435)^((TYPE_CODE[a.type]||0)*40503)^((a.turns|0)*97);
  h=Math.imul(h^(h>>>13),1274126177);
  return((h>>>0)%1000)/1000*.03;
}

// what it will consider: no unsieging, no heal-locks, no aimless target locks (only the Paladin, which
// fires on nothing else), and the King stays home. Two kinds of action are picked over:
//   Scry   only a 3x3 with an enemy in it that it can't see now — reading where the enemy stands is not
//          seeing it, and a side of normal sight (aiSight) can attack only what it sees
//   orders only a pawn's, and the Siege's (its only way to move), for the next turn: a piece the engine
//          would let move now is better moved now, but a pawn's order costs half the turn's budget
//          and so leaves the turn for something else
function candidates(s){
  const out=[],me=s.turn,you=me==='w'?'b':'w',B=s.board;
  const unseen=[];
  for(let j=0;j<B.length;j++)if(B[j]&&B[j].color===you&&!E.visible(s,j,me))unseen.push(j);
  for(const a of E.legalActions(s)){
    switch(a.type){
      case'unsiege':case'healLock':continue;
      case'target':if(B[a.from].type!=='paladin')continue;break;
      case'move':if(B[a.from].type==='king')continue;break;
      case'scry':if(!unseen.some(j=>E.cheb(s,j,a.to)<=1))continue;break;
      case'order':{
        const p=B[a.from];
        if(a.turns!==1||p.order||B[a.to]||(p.type!=='pawn'&&p.type!=='siege'))continue;
        break;
      }
    }
    out.push(a);
  }
  return out;
}

// the state a plan leaves once this turn is over and the opponent has passed: what an order that leaves the
// turn to be used is worth is what it changes here, against passing without it
function afterPass(s,me,first){
  const c=E.clone(s);
  if(first)E.step(c,first,{trusted:true});
  if(!c.over&&c.turn===me)E.step(c,{type:'skip'},{trusted:true});
  if(!c.over&&c.turn!==me)E.step(c,{type:'skip'},{trusted:true});
  return c;
}
const ORDER_GAIN=.05;   // an order must be worth at least this much more than none

// the state as a side of normal sight sees it: the same state if `me` already has aiSight, else a copy that does
function withSight(s){
  const me=s.turn;
  if(s.aiSight&&s.aiSight[me])return s;
  const c=E.clone(s);
  c.aiSight=Object.assign({w:false,b:false},s.aiSight,{[me]:true});
  return c;
}

// Each candidate is played on one copy of the state, and that copy is carried on through its later looks
// (the opponent's pass, and for an order the rest of the turn) instead of being played again from the start.
function chooseAction(s){
  s=withSight(s);
  const me=s.turn,cand=candidates(s);
  if(cand.length===1)return cand[0];
  const scored=[],orders=[];
  for(const a of cand){
    const c=E.clone(s);
    E.step(c,a,{trusted:true});
    const v=evaluate(c,me);
    if(v>=1e6)return a;                       // wins on the spot
    if(a.type==='order'&&!c.over&&c.turn===me){orders.push({a,c});continue;}   // judged below
    scored.push({a,c,v1:v+noise(s,a)});
  }
  scored.sort((x,y)=>y.v1-x.v1);
  const top=scored.slice(0,TOP),pass=scored.find(x=>x.a.type==='skip');
  if(pass&&!top.includes(pass))top.push(pass);
  let best=null,bv=-Infinity,v0=null;
  for(const t of top){
    if(!t.c.over&&t.c.turn!==me)E.step(t.c,{type:'skip'},{trusted:true});   // and the opponent passes
    const raw=evaluate(t.c,me),v=raw+.2*t.v1;
    if(t.a.type==='skip')v0=raw;              // passing now, and the opponent passing: what an order is measured against
    if(v>bv){bv=v;best=t.a;}
  }
  // the order that gains most over doing without one goes first, and the rest of the turn follows it
  if(orders.length){
    if(v0===null)v0=evaluate(afterPass(s,me,null),me);
    let bo=null,bg=ORDER_GAIN;
    for(const{a,c}of orders){
      if(!c.over&&c.turn===me)E.step(c,{type:'skip'},{trusted:true});
      if(!c.over&&c.turn!==me)E.step(c,{type:'skip'},{trusted:true});
      const g=evaluate(c,me)-v0+noise(s,a);
      if(g>bg){bg=g;bo=a;}
    }
    if(bo)return bo;
  }
  return best;
}

// plays actions until the turn passes: a merge by a Knight's L-jump, or a second order, leaves it the
// same side's turn (the cap only guards against a state that never lets it end)
function playTurn(s){
  const me=s.turn,events=[];
  if(!(s.aiSight&&s.aiSight[me]))s.aiSight=Object.assign({w:false,b:false},s.aiSight,{[me]:true});   // normal sight, always
  for(let k=0;k<8&&!s.over&&s.turn===me;k++)events.push(...E.step(s,chooseAction(s),{trusted:true}));
  if(!s.over&&s.turn===me)events.push(...E.step(s,{type:'skip'},{trusted:true}));
  return events;
}

const SemunScripted={chooseAction,playTurn,evaluate};
if(typeof module!=='undefined'&&module.exports)module.exports=SemunScripted;
else root.SemunScripted=SemunScripted;
})(typeof globalThis!=='undefined'?globalThis:this);
