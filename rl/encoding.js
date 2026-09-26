// ── SEMUNCRAFT RL ENCODING ───────────────────────────────────────────────────
// Turns engine states into neural-network inputs, and network outputs back into
// engine actions. The board is seen from one side (normally the side to move):
// for Black it is rotated 180° and "own"/"enemy" swap, so one network can play
// both colors. Loads as a classic <script> after js/engine.js (global
// SemunEncoding) or in Node, so training and the browser share one encoding.
//
// Two versions live here, and a network must be played with the one it was trained on (the `encoding`
// in its exported meta; js/netai.js reads it):
//   1  the networks trained through 2026-09-14 (models/*.js): 32 channels, 82 action slots per cell. It
//      predates Scry, orders, helmets, the Meteor, Elixir and the new units: those actions are left out
//      of its map, and a Mage, Paladin or Guardian shows on the queen's, knight's or rook's channel.
//   2  the current rules (LATEST): 54 channels and 159 slots per cell — every unit on its own channel,
//      helmets, Gold and Elixir, the mines and springs, orders and Meteors on their way, the side's real
//      sight, and every action the engine offers, Scry, orders, helmets and the Meteor included.
(function(root){
'use strict';
const E=typeof module!=='undefined'&&module.exports?require('../js/engine.js'):root.SemunEngine;

const LATEST=2;
// actions on a square up to 4 rows and 4 columns away (a siege tower's reach): 9x9 offsets per cell
const WINDOW=4,SIDE=2*WINDOW+1,OFFSETS=SIDE*SIDE,CENTRE=WINDOW*SIDE+WINDOW;

// piece values for reward shaping, in Gold (an Elixir counted as one): about what each costs to make now
// — a helmet 1, a Rook a helmeted pawn and a pawn, the top tier its two parts and its Elixir
const PIECE_VALUE={pawn:1,knight:2,bishop:3,rook:3,queen:5,siege:7,king:0,mage:8,paladin:7,guardian:6,scarecrow:0};
const FORTIFIED_VALUE=2;
const ELIXIR_CAP=6;   // Elixir in hand counts up to this much (the dearest unit costs 3)

// ── VERSION 1 ────────────────────────────────────────────────────────────────
const V1_TYPES=['pawn','knight','bishop','rook','queen','king','siege'];
// the Mage, Paladin and Guardian came after these networks were trained: each shows on the channel
// of the existing piece nearest its own shape (the training ground's Scarecrow shows as a pawn: a
// network facing one sees something to shoot at)
const V1_ALIAS={mage:'queen',paladin:'knight',guardian:'rook',scarecrow:'pawn'};
const V1_NAMES=[
  ...V1_TYPES.map(t=>'own '+t),...V1_TYPES.map(t=>'enemy '+t),
  'hp / max hp','hp / 5','mana / 2 (bishop, mage)','pawn can double-step','obstacle','on the board',
  'visible to this side','own piece with a target lock','square locked by an own piece',
  'enemy piece with a target lock','square locked by an enemy piece',
  'own spawns left / 16','enemy spawns left / 16','turns taken / turn cap',
  'merging allowed','spawning allowed','classic turn order',
  // the classic order isn't symmetric: White's pieces fire right after it acts, Black's just before
  'moves first each round (White in the classic order)',
];
const V1_CH={own:0,enemy:7,hp:14,hp5:15,mana:16,firstMove:17,obstacle:18,onBoard:19,visible:20,
  ownLock:21,ownLocked:22,enemyLock:23,enemyLocked:24,ownSpawns:25,enemySpawns:26,turns:27,
  merge:28,spawn:29,classic:30,first:31};
const V1_SLOTS=OFFSETS+1,V1_SPAWN=OFFSETS;   // 81 offsets and "spawn a pawn here"

// ── VERSION 2 ────────────────────────────────────────────────────────────────
// a pawn in a helmet has a type of its own here ('fort'); the Scarecrow still shows as a pawn
const V2_TYPES=['pawn','fort','knight','bishop','rook','queen','king','siege','mage','paladin','guardian'];
const V2_ALIAS={scarecrow:'pawn'};
const V2_LIST=[
  ...V2_TYPES.map(t=>['own_'+t,'own '+t]),...V2_TYPES.map(t=>['enemy_'+t,'enemy '+t]),
  ['hp','hp / max hp'],['hp5','hp / 5'],['mana','mana / 2 (bishop, mage)'],['firstMove','pawn can double-step'],
  ['rolled','siege that rolled this turn (it does not fire)'],['hidden','own piece hidden from the enemy (undergrowth)'],
  ['ownLock','own piece with a target lock'],['ownLocked','square locked by an own piece'],
  ['enemyLock','enemy piece with a target lock'],['enemyLocked','square locked by an enemy piece'],
  ['ownOrder','own piece with a delayed order (turns left / 3)'],['ownOrderTo','square an own order is headed for (turns left / 3)'],
  ['enemyOrder','enemy piece with a delayed order (turns left / 3)'],['enemyOrderTo','square an enemy order is headed for (turns left / 3)'],
  ['ownMeteor','own Meteor on its way (turns left / 2)'],['enemyMeteor','enemy Meteor on its way (turns left / 2)'],
  ['obstacle','obstacle'],['undergrowth','undergrowth'],['mine','gold mine'],['spring','Elixir spring'],
  ['onBoard','on the board'],
  // with aiSight (js/engine.js) a side's attacks reach only these; without it, what fog leaves in view
  ['visible','visible to this side'],
  ['ownGold','own Gold / 16'],['enemyGold','enemy Gold / 16'],['ownElixir','own Elixir / 6'],['enemyElixir','enemy Elixir / 6'],
  ['orderLeft','own order budget left this turn'],['turns','turns taken / turn cap'],
  ['merge','merging allowed'],['spawn','spawning allowed'],['classic','classic turn order'],
  ['first','moves first each round (White in the classic order)'],
];
const V2_NAMES=V2_LIST.map(x=>x[1]);
const V2_CH={};
V2_LIST.forEach(([k],i)=>{V2_CH[k]=i;});
V2_CH.own=0;V2_CH.enemy=V2_TYPES.length;
// per cell: 81 offsets (move, merge, target, heal, heal-lock; the centre is "this piece": unsiege, a
// helmet), "spawn a pawn here", "Scry centred here", "a Meteor whose 2x2 has its top-left corner here"
// (top-left as the side sees the board), and delayed orders: 5x5 offsets for each delay of 1-3 turns
// (every piece that takes orders moves at most 2 squares)
const ORDER_WINDOW=2,ORDER_SIDE=2*ORDER_WINDOW+1,ORDER_OFFSETS=ORDER_SIDE*ORDER_SIDE,ORDER_DELAYS=3;
const V2_SPAWN=OFFSETS,V2_SCRY=OFFSETS+1,V2_METEOR=OFFSETS+2,V2_ORDER=OFFSETS+3;
const V2_SLOTS=V2_ORDER+ORDER_OFFSETS*ORDER_DELAYS;   // 159

const LAYOUTS={
  1:{version:1,names:V1_NAMES,channels:V1_NAMES.length,slots:V1_SLOTS,onBoard:V1_CH.onBoard},
  2:{version:2,names:V2_NAMES,channels:V2_NAMES.length,slots:V2_SLOTS,onBoard:V2_CH.onBoard},
};

// createEncoder({grid: 11, version: LATEST, sightPlane: true}) handles boards up to grid×grid, placed in
// the grid's top-left corner. sightPlane (version 1 only) false keeps the visible plane at what fog alone
// shows, as those networks saw it: every cell without fog, even when the side's attacks reach only what
// it sees. They still get the sight-limited legal actions.
function createEncoder(opts){
  opts=opts||{};
  const G=opts.grid||11,version=opts.version||LATEST,layout=LAYOUTS[version];
  if(!layout)throw new Error('no encoding version '+version);
  const SLOTS=layout.slots,CHANNELS=layout.channels,numActions=G*G*SLOTS+1,SKIP=numActions-1;
  const sightPlane=opts.sightPlane!==false;

  function fits(s){
    if(s.rows>G||s.cols>G)throw new Error('a '+s.cols+'x'+s.rows+' board does not fit an '+G+'x'+G+' grid');
  }
  // board square → grid cell as seen by `side`
  function cell(s,i,side){
    let r=Math.floor(i/s.cols),c=i%s.cols;
    if(side==='b'){r=s.rows-1-r;c=s.cols-1-c;}
    return r*G+c;
  }
  // the offset slot of acting from square a on square b, or -1 beyond the window
  function offsetSlot(s,a,b,side,window){
    const f=cell(s,a,side),t=cell(s,b,side),n=2*window+1;
    const dr=Math.floor(t/G)-Math.floor(f/G),dc=t%G-f%G;
    if(Math.abs(dr)>window||Math.abs(dc)>window)return -1;
    return(dr+window)*n+dc+window;
  }

  // observe(state, side = side to move) → Uint8Array of CHANNELS×grid×grid values 0–255
  function observe1(s,side){
    const CH=V1_CH;
    const enemy=side==='w'?'b':'w',P=G*G,out=new Uint8Array(CHANNELS*P),B=s.board;
    const set=(ch,g,v)=>{out[ch*P+g]=Math.round(Math.min(1,v)*255);};
    const fill=(ch,v)=>out.fill(Math.round(Math.min(1,v)*255),ch*P,(ch+1)*P);
    const fog=E.fogFor(s,side);
    // fog hides what is out of sight; undergrowth hides what stands in it (for either side, fog or not)
    const seen=i=>(!fog||E.visible(s,i,side))&&!E.inCover(s,i,side);
    // an AI's side (aiSight) still reads where the enemy stands, but attacks only what it sees: the
    // visible plane shows that sight, while pieces stay in the picture
    const limited=sightPlane&&E.sightLimited?E.sightLimited(s,side):fog;
    const sees=i=>(!limited||E.visible(s,i,side))&&!E.inCover(s,i,side);
    for(let i=0;i<B.length;i++){
      const g=cell(s,i,side),p=B[i],vis=seen(i);
      set(CH.onBoard,g,1);
      if(s.blocked[i])set(CH.obstacle,g,1);
      if(sees(i))set(CH.visible,g,1);
      // fog hides enemy pieces, not terrain
      if(!p||(p.color===enemy&&!vis))continue;
      set((p.color===side?CH.own:CH.enemy)+V1_TYPES.indexOf(V1_ALIAS[p.type]||p.type),g,1);
      set(CH.hp,g,p.hp/p.maxHp);
      set(CH.hp5,g,p.hp/5);
      if(p.type==='bishop'||p.type==='mage')set(CH.mana,g,(p.mana||0)/2);
      if(p.type==='pawn'&&p.firstMove)set(CH.firstMove,g,1);
    }
    for(const[color,lockCh,lockedCh]of[[side,CH.ownLock,CH.ownLocked],[enemy,CH.enemyLock,CH.enemyLocked]]){
      const t=s.targets[color];
      for(const k in t){
        // a lock belongs to whichever piece of that color stands on its square
        const from=+k,p=B[from];
        if(!p||p.color!==color||(color===enemy&&!seen(from)))continue;
        set(lockCh,cell(s,from,side),1);
        if(!E.inCover(s,+t[k],side))set(lockedCh,cell(s,t[k],side),1);
      }
    }
    fill(CH.ownSpawns,E.spawnRemaining(s,side)/16);
    fill(CH.enemySpawns,E.spawnRemaining(s,enemy)/16);
    fill(CH.turns,s.maxTurns?(s.turnCount.w+s.turnCount.b)/s.maxTurns:0);
    fill(CH.merge,s.level&&s.level.noMerge?0:1);
    fill(CH.spawn,s.level&&s.level.allowSpawn===false?0:1);
    fill(CH.classic,s.mode==='classic'?1:0);
    fill(CH.first,s.mode==='classic'&&side==='w'?1:0);
    return out;
  }

  function observe2(s,side){
    const CH=V2_CH;
    const enemy=side==='w'?'b':'w',P=G*G,out=new Uint8Array(CHANNELS*P),B=s.board;
    const set=(ch,g,v)=>{out[ch*P+g]=Math.round(Math.max(0,Math.min(1,v))*255);};
    const raise=(ch,g,v)=>{const x=Math.round(Math.max(0,Math.min(1,v))*255);if(x>out[ch*P+g])out[ch*P+g]=x;};
    const fill=(ch,v)=>out.fill(Math.round(Math.max(0,Math.min(1,v))*255),ch*P,(ch+1)*P);
    const fog=E.fogFor(s,side);
    // fog hides enemy pieces out of sight, undergrowth whatever stands in it unrevealed; with aiSight a
    // side still reads where the enemy stands, and the visible plane shows how far its attacks reach
    const seen=i=>(!fog||E.visible(s,i,side))&&!E.inCover(s,i,side);
    const limited=E.sightLimited(s,side);
    for(let i=0;i<B.length;i++){
      const g=cell(s,i,side),p=B[i],t=s.tiles[i];
      set(CH.onBoard,g,1);
      if(s.blocked[i])set(CH.obstacle,g,1);
      if(t==='undergrowth')set(CH.undergrowth,g,1);
      else if(t==='mine')set(CH.mine,g,1);
      else if(t==='spring')set(CH.spring,g,1);
      if((!limited||E.visible(s,i,side))&&!E.inCover(s,i,side))set(CH.visible,g,1);
      if(!p)continue;
      const own=p.color===side;
      if(!own&&!seen(i))continue;
      const type=p.type==='pawn'&&p.fortified?'fort':(V2_ALIAS[p.type]||p.type),k=V2_TYPES.indexOf(type);
      if(k>=0)set((own?CH.own:CH.enemy)+k,g,1);   // a type added since has no channel until version 3
      set(CH.hp,g,p.hp/p.maxHp);
      set(CH.hp5,g,p.hp/5);
      if(p.type==='bishop'||p.type==='mage')set(CH.mana,g,(p.mana||0)/2);
      if(p.type==='pawn'&&p.firstMove)set(CH.firstMove,g,1);
      if(p.rolled)set(CH.rolled,g,1);
      if(own&&E.inCover(s,i,enemy))set(CH.hidden,g,1);
      if(p.order){
        const v=p.order.turns/ORDER_DELAYS;
        set(own?CH.ownOrder:CH.enemyOrder,g,v);
        raise(own?CH.ownOrderTo:CH.enemyOrderTo,cell(s,p.order.to,side),v);
      }
    }
    for(const[color,lockCh,lockedCh]of[[side,CH.ownLock,CH.ownLocked],[enemy,CH.enemyLock,CH.enemyLocked]]){
      const t=s.targets[color];
      for(const k in t){
        const from=+k,p=B[from];
        if(!p||p.color!==color||(color===enemy&&!seen(from)))continue;
        set(lockCh,cell(s,from,side),1);
        if(!E.inCover(s,+t[k],side))set(lockedCh,cell(s,t[k],side),1);
      }
    }
    for(const m of s.meteors||[])
      for(const j of m.tiles)raise(m.color===side?CH.ownMeteor:CH.enemyMeteor,cell(s,j,side),m.turns/2);
    fill(CH.ownGold,E.spawnRemaining(s,side)/16);
    fill(CH.enemyGold,E.spawnRemaining(s,enemy)/16);
    fill(CH.ownElixir,(s.elixir?s.elixir[side]:0)/ELIXIR_CAP);
    fill(CH.enemyElixir,(s.elixir?s.elixir[enemy]:0)/ELIXIR_CAP);
    fill(CH.orderLeft,s.orderLeft?s.orderLeft[side]:0);
    fill(CH.turns,s.maxTurns?(s.turnCount.w+s.turnCount.b)/s.maxTurns:0);
    fill(CH.merge,s.level&&s.level.noMerge?0:1);
    fill(CH.spawn,s.level&&s.level.allowSpawn===false?0:1);
    fill(CH.classic,s.mode==='classic'?1:0);
    fill(CH.first,s.mode==='classic'&&side==='w'?1:0);
    return out;
  }

  function observe(s,side){
    fits(s);
    side=side||s.turn;
    return version===1?observe1(s,side):observe2(s,side);
  }

  // index of an action of the side to move; -1 if it has none (a lock on a distant enemy, or an action
  // version 1 has no slot for)
  function actionIndex(s,a){
    const side=s.turn;
    if(a.type==='skip')return SKIP;
    if(version===1){
      if(a.type==='scry'||a.type==='fortify'||a.type==='order'||a.type==='meteor')return -1;
      if(a.type==='spawn')return cell(s,a.to,side)*SLOTS+V1_SPAWN;
    }else{
      switch(a.type){
        case'spawn':return cell(s,a.to,side)*SLOTS+V2_SPAWN;
        case'scry':return cell(s,a.to,side)*SLOTS+V2_SCRY;
        // the anchor is the 2x2's top-left square on the board; seen from Black the board is turned
        // round, and the corner that is top-left for it is the one diagonally opposite
        case'meteor':return cell(s,side==='b'?a.to+s.cols+1:a.to,side)*SLOTS+V2_METEOR;
        case'order':{
          const k=offsetSlot(s,a.from,a.to,side,ORDER_WINDOW);
          if(k<0||!(a.turns>=1&&a.turns<=ORDER_DELAYS))return -1;
          return cell(s,a.from,side)*SLOTS+V2_ORDER+(a.turns-1)*ORDER_OFFSETS+k;
        }
      }
    }
    const k=offsetSlot(s,a.from,a.to,side,WINDOW);
    return k<0?-1:cell(s,a.from,side)*SLOTS+k;
  }

  // Map from action index to engine action for every legal action of the side to move. Some actions
  // share an index, and the map keeps one of them:
  //   - a bishop on a wounded adjacent knight can merge or lock a heal: the index means the heal; the
  //     Queen is still reachable by merging the knight onto the bishop
  //   - (version 2) a Scry or a Meteor names only the square it lands on: when two casters could cast
  //     it, the one that has nothing to shoot at this turn casts it, then the nearer, then the one
  //     first on the board as the side sees it
  function legalMap(s){
    fits(s);
    const map=new Map(),side=s.turn,shoots=new Map();
    const casterKey=a=>{
      if(!shoots.has(a.from))shoots.set(a.from,E.getDests(s,a.from).attack.size>0);
      return(shoots.get(a.from)?100000:0)+E.cheb(s,a.from,a.to)*1000+cell(s,a.from,side);
    };
    for(const a of E.legalActions(s)){
      const k=actionIndex(s,a);
      if(k<0)continue;
      const prev=map.get(k);
      if(prev){
        if(prev.type==='merge'&&a.type==='healLock'){map.set(k,a);continue;}
        if(version>1&&(a.type==='scry'||a.type==='meteor')&&prev.type===a.type&&prev.to===a.to){
          if(casterKey(a)<casterKey(prev))map.set(k,a);
          continue;
        }
        throw new Error('actions '+JSON.stringify(prev)+' and '+JSON.stringify(a)+' share index '+k);
      }
      map.set(k,a);
    }
    return map;
  }

  return{version,grid:G,channels:CHANNELS,slots:SLOTS,onBoard:layout.onBoard,channelNames:layout.names,
    numActions,skipIndex:SKIP,observe,actionIndex,legalMap,cell};
}

// shaping potential from `side`'s view: material (a piece's value × its health / 10), Gold and Elixir in
// hand (/10, Elixir up to ELIXIR_CAP) and King health / 5. Spending Gold or Elixir on what it buys leaves
// it unchanged; damage, and what the mines and springs pay, move it.
function potential(s,side){
  let v=0;
  for(const p of s.board){
    if(!p)continue;
    const value=p.type==='pawn'&&p.fortified?FORTIFIED_VALUE:(PIECE_VALUE[p.type]||0);
    const worth=p.type==='king'?p.hp/5:value*p.hp/p.maxHp/10;
    if(p.color===side)v+=worth;else if(p.color===(side==='w'?'b':'w'))v-=worth;
  }
  for(const[c,sign]of[[side,1],[side==='w'?'b':'w',-1]]){
    const elixir=s.elixir?Math.min(ELIXIR_CAP,s.elixir[c]||0):0;
    v+=sign*(E.spawnRemaining(s,c)+elixir)/10;
  }
  return v;
}

const latest=LAYOUTS[LATEST];
const SemunEncoding={createEncoder,potential,LATEST,LAYOUTS,
  CHANNEL_NAMES:latest.names,CHANNELS:latest.channels,SLOTS:latest.slots,
  PIECE_VALUE,WINDOW,ORDER_WINDOW,ORDER_DELAYS,V2_CHANNEL_INDEX:V2_CH,
  V2_SLOT:{spawn:V2_SPAWN,scry:V2_SCRY,meteor:V2_METEOR,order:V2_ORDER,centre:CENTRE}};
if(typeof module!=='undefined'&&module.exports)module.exports=SemunEncoding;
else root.SemunEncoding=SemunEncoding;
})(typeof globalThis!=='undefined'?globalThis:this);
