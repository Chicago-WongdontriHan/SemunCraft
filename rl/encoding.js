// ── SEMUNCRAFT RL ENCODING ───────────────────────────────────────────────────
// Turns engine states into neural-network inputs, and network outputs back into
// engine actions. The board is seen from one side (normally the side to move):
// for Black it is rotated 180° and "own"/"enemy" swap, so one network can play
// both colors. Loads as a classic <script> after js/engine.js (global
// SemunEncoding) or in Node, so training and the browser share one encoding.
(function(root){
'use strict';
const E=typeof module!=='undefined'&&module.exports?require('../js/engine.js'):root.SemunEngine;

const TYPES=['pawn','knight','bishop','rook','queen','king','siege'];
// piece values for reward shaping: merge cost in pawns (the King counts through its health)
const PIECE_VALUE={pawn:1,knight:2,bishop:3,rook:4,queen:5,siege:8,king:0};
const CHANNEL_NAMES=[
  ...TYPES.map(t=>'own '+t),...TYPES.map(t=>'enemy '+t),
  'hp / max hp','hp / 5','bishop mana / 2','pawn can double-step','obstacle','on the board',
  'visible to this side','own piece with a target lock','square locked by an own piece',
  'enemy piece with a target lock','square locked by an enemy piece',
  'own spawns left / 16','enemy spawns left / 16','turns taken / turn cap',
  'merging allowed','spawning allowed','classic turn order',
  // the classic order isn't symmetric: White's pieces fire right after it acts, Black's just before
  'moves first each round (White in the classic order)',
];
const CH={own:0,enemy:7,hp:14,hp5:15,mana:16,firstMove:17,obstacle:18,onBoard:19,visible:20,
  ownLock:21,ownLocked:22,enemyLock:23,enemyLocked:24,ownSpawns:25,enemySpawns:26,turns:27,
  merge:28,spawn:29,classic:30,first:31};
const CHANNELS=CHANNEL_NAMES.length;
// actions: for each grid cell, 81 slots meaning "act on the square dr,dc away" (-4..4, enough
// for a siege tower's range) and one slot meaning "spawn a pawn here"; the last index is skip
const WINDOW=4,SIDE=2*WINDOW+1,SPAWN_SLOT=SIDE*SIDE,SLOTS=SIDE*SIDE+1;

// createEncoder({grid}) handles boards up to grid×grid, placed in the grid's top-left corner
function createEncoder(opts){
  const G=(opts&&opts.grid)||11;
  const numActions=G*G*SLOTS+1,SKIP=numActions-1;

  function fits(s){
    if(s.rows>G||s.cols>G)throw new Error('a '+s.cols+'x'+s.rows+' board does not fit an '+G+'x'+G+' grid');
  }
  // board square → grid cell as seen by `side`
  function cell(s,i,side){
    let r=Math.floor(i/s.cols),c=i%s.cols;
    if(side==='b'){r=s.rows-1-r;c=s.cols-1-c;}
    return r*G+c;
  }

  // observe(state, side = side to move) → Uint8Array of CHANNELS×grid×grid values 0–255
  function observe(s,side){
    fits(s);
    side=side||s.turn;
    const enemy=side==='w'?'b':'w',P=G*G,out=new Uint8Array(CHANNELS*P),B=s.board;
    const set=(ch,g,v)=>{out[ch*P+g]=Math.round(Math.min(1,v)*255);};
    const fill=(ch,v)=>out.fill(Math.round(Math.min(1,v)*255),ch*P,(ch+1)*P);
    const fog=E.fogFor(s,side);
    // fog hides what is out of sight; undergrowth hides what stands in it (for either side, fog or not)
    const seen=i=>(!fog||E.visible(s,i,side))&&!E.inCover(s,i,side);
    for(let i=0;i<B.length;i++){
      const g=cell(s,i,side),p=B[i],vis=seen(i);
      set(CH.onBoard,g,1);
      if(s.blocked[i])set(CH.obstacle,g,1);
      if(vis)set(CH.visible,g,1);
      // fog hides enemy pieces, not terrain
      if(!p||(p.color===enemy&&!vis))continue;
      set((p.color===side?CH.own:CH.enemy)+TYPES.indexOf(p.type),g,1);
      set(CH.hp,g,p.hp/p.maxHp);
      set(CH.hp5,g,p.hp/5);
      if(p.type==='bishop')set(CH.mana,g,(p.mana||0)/2);
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

  // index of an action of the side to move; -1 if it has none (a lock on a distant enemy)
  function actionIndex(s,a){
    const side=s.turn;
    if(a.type==='skip')return SKIP;
    if(a.type==='spawn')return cell(s,a.to,side)*SLOTS+SPAWN_SLOT;
    const f=cell(s,a.from,side),t=cell(s,a.to,side);
    const dr=Math.floor(t/G)-Math.floor(f/G),dc=t%G-f%G;
    if(Math.abs(dr)>WINDOW||Math.abs(dc)>WINDOW)return -1;
    return f*SLOTS+(dr+WINDOW)*SIDE+dc+WINDOW;
  }

  // Map from action index to engine action for every legal action of the side to move.
  // One pair shares an index: a bishop on a wounded adjacent knight can merge or lock a
  // heal. The index means the heal; the Queen is still reachable by merging the knight
  // onto the bishop.
  function legalMap(s){
    fits(s);
    const map=new Map();
    for(const a of E.legalActions(s)){
      // scrying came after these networks were trained: it shares squares with their moves, so it
      // stays out of the map until they are trained again with a slot of its own
      if(a.type==='scry'||a.type==='mine')continue;
      const k=actionIndex(s,a);
      if(k<0)continue;
      const prev=map.get(k);
      if(prev&&!(prev.type==='merge'&&a.type==='healLock'))
        throw new Error('actions '+JSON.stringify(prev)+' and '+JSON.stringify(a)+' share index '+k);
      map.set(k,a);
    }
    return map;
  }

  return{grid:G,channels:CHANNELS,numActions,skipIndex:SKIP,observe,actionIndex,legalMap,cell};
}

// shaping potential from `side`'s view: material (piece value × health / 10) plus King health / 5
function potential(s,side){
  let v=0;
  for(const p of s.board){
    if(!p)continue;
    const worth=p.type==='king'?p.hp/5:PIECE_VALUE[p.type]*p.hp/p.maxHp/10;
    v+=p.color===side?worth:-worth;
  }
  return v;
}

const SemunEncoding={createEncoder,potential,CHANNEL_NAMES,CHANNELS,PIECE_VALUE,WINDOW,SLOTS,SPAWN_SLOT};
if(typeof module!=='undefined'&&module.exports)module.exports=SemunEncoding;
else root.SemunEncoding=SemunEncoding;
})(typeof globalThis!=='undefined'?globalThis:this);
