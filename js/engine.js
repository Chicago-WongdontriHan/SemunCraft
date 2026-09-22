// ── SEMUNCRAFT ENGINE ────────────────────────────────────────────────────────
// The game rules with no DOM, no timers and seeded randomness, so games can be
// simulated fast and replayed exactly. Loads as a classic <script> (global
// SemunEngine) or in Node (require('./js/engine.js')).
//
// Rules follow the browser game file by file (movement.js, combat.js,
// actions.js, game.js, ai.js, themes.js); tests/parity.test.js checks that both
// produce the same boards. Animals are not simulated yet.
(function(root){
'use strict';

// ── DATA ─────────────────────────────────────────────────────────────────────
const STATS={king:{hp:5,maxHp:5},pawn:{hp:1,maxHp:1},knight:{hp:4,maxHp:4},bishop:{hp:2,maxHp:2},rook:{hp:4,maxHp:4},queen:{hp:5,maxHp:5},siege:{hp:4,maxHp:4},mage:{hp:3,maxHp:3},paladin:{hp:3,maxHp:3},guardian:{hp:5,maxHp:5}};
// each theme's terrain, in the order themes.js places it: [tile, share of the board, blocks]
const THEME_TILES={
  forest:[['tree',.12,true]],
  jungle:[['palm',.09,true],['temple',.04,true],['undergrowth',.08,false]],
  desert:[['sandstone',.12,true]],
  ocean:[['rocks',.12,true]],
};
// Roaming animals are off in the game (ANIMALS_ON in js/constants.js). Map generation still draws
// the same random numbers for them, so boards match; nothing is kept.
const ANIMALS_ON=false;
// animal templates; map generation draws random numbers for them like themes.js
const THEME_ANIMALS={
  forest:{neutral:{emoji:'🦌',hp:2,maxHp:2,name:'Deer'},attacker:{emoji:'🐺',hp:1,maxHp:1,name:'Wolf'}},
  jungle:{neutral:{emoji:'🐒',hp:2,maxHp:2,name:'Monkey'},attacker:{emoji:'🐍',hp:1,maxHp:1,name:'Snake'}},
  desert:{neutral:{emoji:'🐪',hp:3,maxHp:3,name:'Camel'},attacker:null},
  ocean:{neutral:{emoji:'🦀',hp:1,maxHp:1,name:'Crab'},attacker:{emoji:'🦈',hp:2,maxHp:2,name:'Shark'}},
};
const STRATEGIES=['pawn_troops','knight_attack','pawn_knight','bishop_pawn','rook_pawn'];
const FILES='abcdefghijkl';
const other=c=>c==='w'?'b':'w';

// ── RANDOM (mulberry32) ──────────────────────────────────────────────────────
// the generator state lives in state.rng, so clone() also clones the random stream
function nextRandom(holder){
  let t=(holder.rng=(holder.rng+0x6D2B79F5)|0);
  t=Math.imul(t^(t>>>15),t|1);
  t^=t+Math.imul(t^(t>>>7),t|61);
  return((t^(t>>>14))>>>0)/4294967296;
}
// a Math.random-style function on the same stream (used to seed the original game in tests)
function makeRandom(seed){const h={rng:seed|0};return()=>nextRandom(h);}

// ── GEOMETRY (cached per board size; neighbour order matches constants.js) ───
const KJ=[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const GEO=new Map();
function geo(s){
  const key=s.cols+'x'+s.rows;
  let g=GEO.get(key);
  if(!g){g=buildGeo(s.cols,s.rows);GEO.set(key,g);}
  return g;
}
function buildGeo(C,R){
  const n=C*R,inB=(r,c)=>r>=0&&r<R&&c>=0&&c<C;
  const adj8=[],kj=[],r2=[],qr=[];
  for(let i=0;i<n;i++){
    const r=Math.floor(i/C),c=i%C;
    const a=[];
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;if(inB(r+dr,c+dc))a.push((r+dr)*C+c+dc);}
    const k=[];
    KJ.forEach(([dr,dc])=>{if(inB(r+dr,c+dc))k.push((r+dr)*C+c+dc);});
    const q=[];
    for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++){if(!dr&&!dc)continue;if(inB(r+dr,c+dc))q.push((r+dr)*C+c+dc);}
    const ks=new Set(k);
    adj8.push(a);kj.push(k);r2.push(q);qr.push(q.filter(j=>!ks.has(j)));
  }
  return{C,R,n,inB,adj8,kj,r2,qr};
}
const rowOf=(s,i)=>Math.floor(i/s.cols);
const colOf=(s,i)=>i%s.cols;
const cheb=(s,a,b)=>Math.max(Math.abs(rowOf(s,a)-rowOf(s,b)),Math.abs(colOf(s,a)-colOf(s,b)));
const sqName=(s,i)=>FILES[colOf(s,i)]+(s.rows-rowOf(s,i));

// ── STATE ────────────────────────────────────────────────────────────────────
// newGame({seed, mode, difficulty, theme, level, fog, maxTurns})
//   mode 'classic': single-player order (White acts, White fires, Black fires, Black acts)
//   mode 'pvp':     each side acts, then its own pieces fire (symmetric; use for self-play)
//   level:          a CAMPAIGN_LEVELS entry (the engine keeps no copy of the level data)
//   fog:            limit each side's attacks and heals to tiles it can see (default: off,
//                   campaign levels use their own default)
//   maxTurns:       draw once both sides together have taken this many turns (0 = no limit)
function newGame(o){
  o=o||{};
  const lv=o.level||null;
  const s={
    cols:lv?lv.cols:9,rows:lv?lv.rows:9,theme:lv?lv.theme:(o.theme||'forest'),
    mode:o.mode==='pvp'?'pvp':'classic',difficulty:o.difficulty||'hard',
    board:null,tiles:null,blocked:null,
    turn:'w',over:false,winner:null,
    turnCount:{w:0,b:0},spawns:{w:0,b:0},targets:{w:{},b:{}},
    orderLeft:{w:ORDER_BUDGET,b:ORDER_BUDGET},   // how much of this turn's orders is left ('order')
    elixir:{w:0,b:0},       // extracted at the spring ('extract')
    mineTurns:{w:0,b:0},    // turns ended with a pawn on the gold mine: a sixth of Gold each
    goldSpent:{w:0,b:0},    // Gold spent on anything but spawning ('fortify')
    moved:-1,   // square of the piece that moved or healed this turn (it doesn't auto-attack)
    scans:[],   // bishops' scrying: [{tiles, turns, color}] (see the 'scry' action)
    meteors:[], // the Mage's meteors: [{tiles: its 2x2, turns, color}] (see the 'meteor' action)
    hitBy:[],   // classic: Black pieces White hit this round, for the reactive AI
    acted:[],   // classic: Black pieces that auto-attacked this round
    level:lv,fog:o.fog!==undefined?!!o.fog:(lv?lv.mapCheatDefault===false:false),
    maxTurns:o.maxTurns||0,strategy:null,animals:[],rng:o.seed|0,
  };
  const n=s.cols*s.rows;
  s.board=new Array(n).fill(null);
  s.tiles=new Array(n).fill('');
  s.blocked=new Array(n).fill(false);
  if(lv){
    const obs=((THEME_TILES[lv.theme]||THEME_TILES.forest).find(t=>t[2])||['tree'])[0];
    (lv.obstacles||[]).forEach(([r,c])=>{if(r>=0&&r<s.rows&&c>=0&&c<s.cols)setTile(s,r*s.cols+c,obs);});
    (lv.tiles||[]).forEach(([r,c,t])=>{if(r>=0&&r<s.rows&&c>=0&&c<s.cols)setTile(s,r*s.cols+c,t);});
    [['w',lv.white],['b',lv.black]].forEach(([color,list])=>(list||[]).forEach(pd=>{
      const p=makePiece(pd.type,color);
      if(pd.type==='bishop')p.mana=2;
      if(pd.type==='pawn')p.firstMove=true;
      s.board[pd.r*s.cols+pd.c]=p;
    }));
  }else{
    const g=geo(s),wK=7*s.cols+1,bK=1*s.cols+7;
    s.board[wK]=makePiece('king','w');
    s.board[bK]=makePiece('king','b');
    [[wK,bK,'w'],[bK,wK,'b']].forEach(([k,enemyK,color])=>{
      g.adj8[k].filter(j=>!s.board[j]).sort((a,b)=>cheb(s,a,enemyK)-cheb(s,b,enemyK)).slice(0,3)
        .forEach(j=>{const p=makePiece('pawn',color);p.firstMove=true;s.board[j]=p;});
    });
    generateMap(s);
    if(s.mode!=='pvp')s.strategy=s.difficulty==='easy'?'easy_rook_rush':STRATEGIES[Math.floor(nextRandom(s)*STRATEGIES.length)];
  }
  return s;
}

function makePiece(type,color){return{type,color,hp:STATS[type].hp,maxHp:STATS[type].maxHp};}

// a tile blocks when it is the pyramid or one of the current theme's obstacles (as isTileBlocked does)
function setTile(s,i,t){
  s.tiles[i]=t;
  s.blocked[i]=t==='sandstone-spawner'||(!!t&&(THEME_TILES[s.theme]||[]).some(o=>o[0]===t&&o[2]));
}

function clone(s){
  const c=Object.assign({},s);
  c.board=s.board.map(p=>p&&Object.assign({},p));
  c.tiles=s.tiles.slice();
  c.blocked=s.blocked.slice();
  c.turnCount={w:s.turnCount.w,b:s.turnCount.b};
  c.spawns={w:s.spawns.w,b:s.spawns.b};
  c.orderLeft={w:s.orderLeft.w,b:s.orderLeft.b};
  c.elixir={w:s.elixir.w,b:s.elixir.b};
  c.mineTurns={w:s.mineTurns.w,b:s.mineTurns.b};
  c.goldSpent={w:s.goldSpent.w,b:s.goldSpent.b};
  c.targets={w:Object.assign({},s.targets.w),b:Object.assign({},s.targets.b)};
  c.scans=s.scans.map(sc=>({tiles:sc.tiles.slice(),turns:sc.turns,color:sc.color}));
  c.meteors=(s.meteors||[]).map(m=>({tiles:m.tiles.slice(),turns:m.turns,color:m.color}));
  c.hitBy=s.hitBy.map(h=>({target:h.target,attacker:h.attacker}));
  c.acted=s.acted.slice();
  c.animals=s.animals.map(a=>Object.assign({},a));
  return c;
}

// ── MAP GENERATION (generateMap in themes.js; same random draws, same order) ──
function generateMap(s){
  const g=geo(s),R=s.rows,C=s.cols,rnd=()=>nextRandom(s);
  const types=THEME_TILES[s.theme];
  s.tiles.fill('');s.blocked.fill(false);s.animals=[];
  if(!types)return;
  // each terrain type in turn
  for(const [ttype,chance,blocks] of types){
    const count=Math.round(chance*R*C);
    if(!blocks){
      // walkable terrain (undergrowth): a few seeds, each spreading at random to about count/seeds tiles
      const seeds=[];
      for(let k=0;k<Math.ceil(count/3);k++)seeds.push(Math.floor(rnd()*R*C));
      for(const seed of seeds){
        const toFill=Math.ceil(count/seeds.length);
        const q=[seed],seen=new Set([seed]);let placed=0;
        while(q.length&&placed<toFill){
          const cur=q.shift(),r=rowOf(s,cur);
          if(r>=3&&r<=R-4&&!s.tiles[cur]&&!s.board[cur]){setTile(s,cur,ttype);placed++;}
          g.adj8[cur].forEach(n=>{if(!seen.has(n)&&rnd()<.5){seen.add(n);q.push(n);}});
        }
      }
      continue;
    }
    // obstacles, in small chunks
    const numChunks=Math.round(count/2.5);
    const runLen=(ti,dr,dc)=>{
      let run=0;const r=rowOf(s,ti),c=colOf(s,ti);
      for(let k=1;k<=6;k++){const nr=r-dr*k,nc=c-dc*k;if(!g.inB(nr,nc))break;const j=nr*C+nc;if(s.blocked[j]||s.tiles[j]===ttype)run++;else break;}
      for(let k=1;k<=6;k++){const nr=r+dr*k,nc=c+dc*k;if(!g.inB(nr,nc))break;const j=nr*C+nc;if(s.blocked[j]||s.tiles[j]===ttype)run++;else break;}
      return run+1;
    };
    // obstacles stay out of the first and last 3 rows, off pieces, and never run longer than 6
    const canPlace=ti=>{
      const r=rowOf(s,ti);
      if(r<3||r>R-4)return false;
      if(s.tiles[ti]||s.board[ti])return false;
      return runLen(ti,0,1)<=6&&runLen(ti,1,0)<=6;
    };
    let placed=0;
    for(let chunk=0;chunk<numChunks&&placed<count;chunk++){
      let seed=-1;
      for(let att=0;att<60;att++){const t=Math.floor(rnd()*R*C);if(canPlace(t)){seed=t;break;}}
      if(seed<0)continue;
      const chunkSize=rnd()<0.5?2:rnd()<0.5?3:rnd()<0.4?1:4;
      const frontier=[seed],inChunk=new Set([seed]);
      setTile(s,seed,ttype);placed++;
      for(let step=1;step<chunkSize&&placed<count;step++){
        let added=false;
        // same comparator as themes.js, so V8's sort draws the same random numbers
        const shuffled=[...frontier].sort(()=>rnd()-.5);
        for(const cur of shuffled){
          const nbrs=g.adj8[cur].filter(n=>!inChunk.has(n)&&canPlace(n));
          if(nbrs.length){
            const nb=nbrs[Math.floor(rnd()*nbrs.length)];
            setTile(s,nb,ttype);inChunk.add(nb);frontier.push(nb);placed++;added=true;break;
          }
        }
        if(!added)break;
      }
    }
  }
  // the board is mirrored through its centre, so neither side is nearer to cover or to a resource
  const mirrorOf=ti=>(R-1-rowOf(s,ti))*C+(C-1-colOf(s,ti));
  for(let i=0;i<R*C;i++){const j=mirrorOf(i);if(i<j)setTile(s,j,s.tiles[i]);}
  // keep a cardinal (rook) and a diagonal (bishop) route between the two king zones
  const wK=7*C+1,bK=1*C+7;
  const hasPath=dirs=>{
    const visited=new Set([wK]),queue=[wK];
    while(queue.length){
      const cur=queue.shift();
      if(cur===bK)return true;
      const r=rowOf(s,cur),c=colOf(s,cur);
      for(const[dr,dc]of dirs){
        const nr=r+dr,nc=c+dc;if(!g.inB(nr,nc))continue;
        const ni=nr*C+nc;
        if(visited.has(ni)||s.blocked[ni])continue;
        visited.add(ni);queue.push(ni);
      }
    }
    return false;
  };
  const findBlockers=dirs=>{
    const visited=new Map([[wK,{parent:-1,wasBlocked:false}]]),queue=[wK];
    while(queue.length){
      const cur=queue.shift();
      if(cur===bK){
        const out=[];
        for(let t=cur;t!==-1;t=visited.get(t).parent)if(visited.get(t).wasBlocked)out.push(t);
        return out;
      }
      const r=rowOf(s,cur),c=colOf(s,cur);
      for(const[dr,dc]of dirs){
        const nr=r+dr,nc=c+dc;if(!g.inB(nr,nc))continue;
        const ni=nr*C+nc;
        if(visited.has(ni))continue;
        visited.set(ni,{parent:cur,wasBlocked:s.blocked[ni]});queue.push(ni);
      }
    }
    return[];
  };
  [[[0,1],[0,-1],[1,0],[-1,0]],[[1,1],[1,-1],[-1,1],[-1,-1]]].forEach(dirs=>{
    if(!hasPath(dirs))findBlockers(dirs).forEach(ti=>{setTile(s,ti,'');setTile(s,mirrorOf(ti),'');});
  });
  // the Elixir spring and the gold mine, each the same distance from both kings (themes.js)
  if(R===9&&C===9){setTile(s,1*C+1,'spring');setTile(s,7*C+7,'mine');}
  // desert: one sandstone becomes the pyramid, with the mummy beside it
  if(s.theme==='desert'){
    const sTiles=[];
    for(let i=0;i<R*C;i++)if(s.tiles[i]==='sandstone')sTiles.push(i);
    if(sTiles.length){
      const pt=sTiles[Math.floor(rnd()*sTiles.length)];
      setTile(s,pt,'sandstone-spawner');
      const m=g.adj8[pt].find(j=>!s.blocked[j])||pt,mr=rowOf(s,m),mc=colOf(s,m);
      if(ANIMALS_ON)s.animals.push({emoji:'🧟',hp:2,maxHp:2,name:'Mummy',aggressive:true,fractDmg:0,
        x:mc+0.5,y:mr+0.5,prevTileR:mr,prevTileC:mc,tx:mc+0.5,ty:mr+0.5,
        speed:0.0005,waitMs:1500,isMummy:true,spawnedFromPyramid:pt});
    }
  }
  // ocean: a roaming tornado
  if(s.theme==='ocean'){
    const eM=[];
    for(let i=0;i<R*C;i++){const r=rowOf(s,i);if(r>=3&&r<=R-4&&!s.tiles[i]&&!s.board[i])eM.push(i);}
    if(eM.length){
      const ti=eM[Math.floor(rnd()*eM.length)],r=rowOf(s,ti),cl=colOf(s,ti);
      if(ANIMALS_ON)s.animals.push({emoji:'🌪',hp:3,maxHp:3,name:'Tornado',aggressive:false,fractDmg:0,
        x:cl+0.5,y:r+0.5,prevTileR:r,prevTileC:cl,tx:cl+0.5,ty:r+0.5,
        speed:0.0004,waitMs:2000,isTornado:true,spawnTimer:0});
    }
  }
  const place=(t,aggressive)=>{
    let col,row,att=0;
    do{col=2+Math.floor(rnd()*(C-4));row=3+Math.floor(rnd()*(R-6));att++;}
    while(att<40&&(s.board[row*C+col]||s.blocked[row*C+col]));
    if(s.blocked[row*C+col])return;
    const speed=0.0005+rnd()*0.0003;   // drawn either way, so boards match themes.js
    if(ANIMALS_ON)s.animals.push({emoji:t.emoji,hp:t.maxHp,maxHp:t.maxHp,name:t.name,aggressive,fractDmg:0,
      x:col+0.5,y:row+0.5,prevTileR:row,prevTileC:col,tx:col+0.5,ty:row+0.5,speed,waitMs:0});
  };
  const th=THEME_ANIMALS[s.theme];
  for(let k=0;k<2;k++)if(th.neutral)place(th.neutral,false);
  if(th.attacker)place(th.attacker,true);
}

// the Elixir spring and the gold mine (RESOURCE_TILES in state.js): a pawn extracts Elixir at the spring
// at the cost of its turn, and earns a sixth of Gold more for every turn it ends on the mine
const RESOURCE_TILES={spring:'elixir',mine:'gold'};
const FORTIFIED_HP=3;
// only a plain pawn works it: a fortified one, like any other piece, earns nothing there
function pawnOnMine(s,color){return s.board.some((p,i)=>p&&p.color===color&&p.type==='pawn'&&!p.fortified&&s.tiles[i]==='mine');}

// ── RULES: RANGES AND VISIBILITY (constants.js, state.js) ────────────────────
const CARD=[[-1,0],[1,0],[0,-1],[0,1]];
const DIAG=[[-1,-1],[-1,1],[1,-1],[1,1]];
const ALL8=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];

// cardinal rays that pierce pieces and stop at obstacles (rook: 3, siege tower: 4)
// a straight run of squares: an obstacle stops it, unless `thru` is set (the siege lobs over them)
function lineRange(s,i,dirs,len,thru){
  const g=geo(s),r=rowOf(s,i),c=colOf(s,i),res=[];
  for(const[dr,dc]of dirs)for(let k=1;k<=len;k++){
    const nr=r+dr*k,nc=c+dc*k;if(!g.inB(nr,nc))break;
    const j=nr*s.cols+nc;
    if(s.blocked[j]){if(thru)continue;break;}
    res.push(j);
  }
  return res;
}
// the siege tower's five cardinal squares, over obstacles and over anything standing in them
// (siegeRange in js/constants.js)
function siegeLine(s,i){return lineRange(s,i,CARD,5,true);}
// the Guardian's reach: everywhere its Rook half could hit, plus everywhere its Knight half could
// (guardianRange in js/constants.js)
function guardianRange(s,i){return [...new Set([...lineRange(s,i,CARD,3),...geo(s).kj[i]])];}
// the straight run of squares between two squares on the same rank or file, attacker's square excluded
// — the Guardian's shot travels and damages this whole path (cardinalPath in js/constants.js)
function cardinalPath(s,from,to){
  const r0=rowOf(s,from),c0=colOf(s,from),r1=rowOf(s,to),c1=colOf(s,to);
  if(r0!==r1&&c0!==c1)return null;
  const g=geo(s),dr=Math.sign(r1-r0),dc=Math.sign(c1-c0),res=[];
  let r=r0+dr,c=c0+dc;
  while(g.inB(r,c)){const j=r*s.cols+c;res.push(j);if(j===to)break;r+=dr;c+=dc;}
  return res;
}
// bishop: diagonal up to 2, stopped by obstacles; the first piece is included, then the ray stops
// the Mage strikes any square within 3, over pieces and obstacles (mageRange in movement.js; same order)
// the Mage's fire trajectories: one step orthogonal then two more continuing in the same diagonal
// direction, 8 lines of 3 tiles from its own square (sangTrajectories in js/movement.js, which this
// mirrors). A line that runs off the board is dropped whole.
function sangTrajectories(s,i){
  const g=geo(s),r=rowOf(s,i),c=colOf(s,i),out=[];
  for(const[dr,dc]of CARD){
    const diagPair=dr!==0?[[dr,-1],[dr,1]]:[[-1,dc],[1,dc]];
    for(const[ddr,ddc]of diagPair){
      const r1=r+dr,c1=c+dc;if(!g.inB(r1,c1))continue;
      const r2=r1+ddr,c2=c1+ddc;if(!g.inB(r2,c2))continue;
      const r3=r2+ddr,c3=c2+ddc;if(!g.inB(r3,c3))continue;
      out.push([r1*s.cols+c1,r2*s.cols+c2,r3*s.cols+c3]);
    }
  }
  return out;
}
// every tile any of the Mage's trajectories reaches, over pieces and obstacles alike
function mageRange(s,i){
  const out=new Set();
  sangTrajectories(s,i).forEach(line=>line.forEach(j=>out.add(j)));
  return [...out];
}
// the one trajectory out of the Mage's eight that reaches this tile, or null (sangLineFor in
// js/combat.js, which this mirrors)
function sangLineFor(s,i,target){
  return sangTrajectories(s,i).find(line=>line.includes(target))||null;
}
function bishopRange(s,i){
  const g=geo(s),r=rowOf(s,i),c=colOf(s,i),res=[];
  for(const[dr,dc]of DIAG)for(let k=1;k<=2;k++){
    const nr=r+dr*k,nc=c+dc*k;if(!g.inB(nr,nc))break;
    const j=nr*s.cols+nc;if(s.blocked[j])break;
    res.push(j);if(s.board[j])break;
  }
  return res;
}
// empty tiles reachable by sliding up to len squares (stopped by pieces and obstacles)
function slide(s,i,dirs,len,out){
  const g=geo(s),r=rowOf(s,i),c=colOf(s,i);
  for(const[dr,dc]of dirs)for(let k=1;k<=len;k++){
    const nr=r+dr*k,nc=c+dc*k;if(!g.inB(nr,nc))break;
    const j=nr*s.cols+nc;if(s.blocked[j]||s.board[j])break;
    out.add(j);
  }
  return out;
}
// a tile is visible to a side when one of its pieces is within 2 squares
function visible(s,i,color){
  const B=s.board;
  if(B[i]&&B[i].color===color)return true;
  if(s.scans&&s.scans.some(sc=>sc.color===color&&sc.tiles.indexOf(i)>=0))return true; // a bishop is looking at it
  return geo(s).r2[i].some(j=>B[j]&&B[j].color===color);
}
// the 3x3 a scry lights, and how far a bishop can throw its sight (scryBox in constants.js)
const SCRY_TURNS=2;
function scryBox(s,i){
  const g=geo(s),r=Math.floor(i/s.cols),c=i%s.cols,res=[];
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
    const nr=r+dr,nc=c+dc;
    if(nr>=0&&nr<s.rows&&nc>=0&&nc<s.cols)res.push(nr*s.cols+nc);
  }
  return res;
}
// the scans of the side whose turn is starting burn down by one
function tickScans(s,color){
  if(s.scans&&s.scans.length)s.scans=s.scans.filter(sc=>sc.color!==color||--sc.turns>0);
}
// the meteors of the side whose turn is starting land, whoever is under them, friend or foe alike —
// mirrors runMeteors in js/game.js. Returns nothing; s.over/s.winner are set the way any other kill is.
function runMeteors(s,color,events){
  if(!s.meteors||!s.meteors.length)return;
  const due=s.meteors.filter(m=>m.color===color&&--m.turns<=0);
  s.meteors=s.meteors.filter(m=>m.turns>0);
  const B=s.board;
  for(const m of due){
    for(const j of m.tiles){
      const t=B[j];if(!t)continue;
      t.hp-=METEOR_DAMAGE;
      if(t.fortified)t.lastHitTurn=clock(s,color);
      t.exposedAt=j;
      const killed=t.hp<=0;
      if(events)events.push({type:'attack',from:-1,to:j,damage:METEOR_DAMAGE,hp:t.hp,killed,meteor:true});
      if(killed){
        B[j]=null;
        if(s.level){const r=campaignResult(s);if(r){s.over=true;s.winner=r==='win'?'w':'b';}}
        else if(t.type==='king'){s.over=true;s.winner=t.color==='w'?'b':'w';}
      }
    }
  }
}
// the Mage's meteor: the 2x2 whose top-left corner is `anchor`, and the anchor a tapped square maps
// to — clamped so it always fits the board, so every square picks exactly one such box
// (meteorBox/meteorAnchorFor in js/state.js, which these mirror)
const METEOR_MANA=2, METEOR_TURNS=2, METEOR_DAMAGE=2;
function meteorBox(s,anchor){
  const r=Math.floor(anchor/s.cols),c=anchor%s.cols;
  return[r*s.cols+c,r*s.cols+c+1,(r+1)*s.cols+c,(r+1)*s.cols+c+1];
}
function meteorAnchorFor(s,t){
  const r=Math.min(rowOf(s,t),s.rows-2),c=Math.min(colOf(s,t),s.cols-2);
  return r*s.cols+c;
}
// classic mode hides fogged enemies from White only (the AI ignores fog); in PvP each side is limited
function fogFor(s,color){return s.fog&&(s.mode==='pvp'||color==='w');}
// Undergrowth (jungle): whatever stands in it is hidden from a side, even a piece right next to it,
// until it fights from there — attacking out of cover, or taking a hit while in it, reveals it from
// that turn on, for as long as it stays on that same square (exposedAt, stamped in applyAttacks /
// runOrders and stale-checked in upkeep). Moving to a different tile judges it fresh there. Unlike
// fog this holds for both sides, with or without fog.
function inCover(s,i,color){
  if(s.tiles[i]!=='undergrowth')return false;
  const B=s.board,p=B[i];
  if(p&&p.color===color)return false;
  if(s.scans.some(sc=>sc.color===color&&sc.tiles.includes(i)))return false;   // a scry sees into it too
  return !(p&&p.exposedAt===i);
}
// an enemy of `color` hidden in undergrowth: it can't be targeted or attacked, though it can attack out
function concealed(s,i,color){const p=s.board[i];return !!p&&p.color!==color&&inCover(s,i,color);}
// counter used for bishop mana timing: single-player uses White's turn count for every bishop
function clock(s,color){return s.mode==='pvp'?s.turnCount[color]:s.turnCount.w;}

function spawnRemaining(s,color){
  const lv=s.level;
  // 8 Gold to start and a sixth a turn, a sixth more for each turn a pawn held the mine; spawning and
  // fortifying spend it (GOLD_START / GOLD_TURNS, spawnQuota and spawnUsed in js/state.js)
  const quota=lv&&lv.spawnLimit?lv.spawnLimit:8+(s.turnCount[color]+s.mineTurns[color])/6;
  return Math.max(0,quota-s.spawns[color]-s.goldSpent[color]);
}

// ── RULES: DESTINATIONS (getDragDests in movement.js) ────────────────────────
function getDests(s,i){
  const g=geo(s),B=s.board,p=B[i];
  const move=new Set(),merge=new Set(),attack=new Set(),heal=new Set();
  if(!p)return{move,merge,attack,heal};
  const ec=other(p.color);
  if(p.type==='pawn'){
    // a fortified pawn takes part in no merge, either way round (movement.js)
    g.adj8[i].forEach(j=>{const t=B[j];if(!t)move.add(j);else if(t.color===p.color){if(mergeResultType(s,p,t))merge.add(j);}else attack.add(j);});
    // first move: two squares straight toward the enemy side
    if(p.firstMove){
      const fwd=p.color==='w'?-1:1,r1=rowOf(s,i)+fwd,r2=rowOf(s,i)+fwd*2,c=colOf(s,i);
      if(g.inB(r1,c)&&g.inB(r2,c)){
        const mid=r1*s.cols+c,far=r2*s.cols+c;
        if(!B[mid]&&!s.blocked[mid]&&!B[far]&&!s.blocked[far])move.add(far);
      }
    }
  }else if(p.type==='knight'){
    g.kj[i].forEach(j=>{if(s.blocked[j])return;const t=B[j];if(!t)move.add(j);else if(t.color===ec)attack.add(j);});
    // knight+rook (Guardian) merges only adjacent, like every pair with a rook in it — the L-jump reach
    // here is for pawn/knight/bishop, which teleport to merge without spending the turn
    new Set([...g.adj8[i],...g.kj[i]]).forEach(j=>{const t=B[j];if(t&&t.color===p.color&&t.type!=='rook'&&mergeResultType(s,p,t))merge.add(j);});
    g.adj8[i].forEach(j=>{const t=B[j];if(t&&t.color===p.color&&t.type==='rook'&&mergeResultType(s,p,t))merge.add(j);});
  }else if(p.type==='paladin'){
    g.kj[i].forEach(j=>{if(s.blocked[j])return;const t=B[j];if(!t)move.add(j);else if(t.color===ec)attack.add(j);});
  }else if(p.type==='bishop'){
    const hasMana=(p.mana||0)>0,r=rowOf(s,i),c=colOf(s,i);
    for(const[dr,dc]of DIAG)for(let k=1;k<=2;k++){
      const nr=r+dr*k,nc=c+dc*k;if(!g.inB(nr,nc))break;
      const j=nr*s.cols+nc;if(s.blocked[j])break;
      const t=B[j];
      if(!t)move.add(j);
      else{if(t.color===ec)attack.add(j);else if(hasMana&&t.color===p.color&&t.hp<t.maxHp)heal.add(j);break;}
    }
    g.adj8[i].forEach(j=>{const t=B[j];if(t&&t.color===p.color&&mergeResultType(s,p,t))merge.add(j);});
  }else if(p.type==='rook'){
    slide(s,i,CARD,2,move);
    g.adj8[i].forEach(j=>{const t=B[j];if(t&&t.color===p.color&&mergeResultType(s,p,t))merge.add(j);});
    lineRange(s,i,CARD,3).forEach(j=>{if(B[j]&&B[j].color===ec)attack.add(j);});
  }else if(p.type==='guardian'){
    slide(s,i,CARD,2,move);
    guardianRange(s,i).forEach(j=>{if(B[j]&&B[j].color===ec)attack.add(j);});
  }else if(p.type==='siege'){
    // it never steps anywhere of its own accord: a move of its own is ordered a turn ahead (legalActions)
    siegeLine(s,i).forEach(j=>{if(B[j]&&B[j].color===ec)attack.add(j);});
  }else if(p.type==='mage'){
    slide(s,i,DIAG,2,move);
    mageRange(s,i).forEach(j=>{if(B[j]&&B[j].color===ec)attack.add(j);});
  }else if(p.type==='queen'){
    slide(s,i,ALL8,2,move);
    g.qr[i].forEach(j=>{if(B[j]&&B[j].color===ec)attack.add(j);});
  }else if(p.type==='king'){
    g.adj8[i].forEach(j=>{const t=B[j];if(!t&&!s.blocked[j])move.add(j);else if(t&&t.color===ec)attack.add(j);});
  }
  for(const j of [...move])if(s.blocked[j])move.delete(j);
  if(fogFor(s,p.color)){
    for(const j of [...attack])if(!visible(s,j,p.color))attack.delete(j);
    for(const j of [...heal])if(!visible(s,j,p.color))heal.delete(j);
  }
  // rawAttack keeps a concealed square in: a delayed order arriving there still discovers whoever
  // stands on it (runOrders), while attack itself stays filtered for everything else
  const rawAttack=new Set(attack);
  for(const j of [...attack])if(concealed(s,j,p.color))attack.delete(j);
  return{move,merge,attack,heal,rawAttack};
}

// What two adjacent pieces of one side become, or null if they don't combine at all (mergeResultType
// in js/actions.js, which this mirrors). Takes the pieces themselves, not bare type names: a fortified
// pawn is still type 'pawn', and it is the flag that tells two of them (a Rook) from two plain ones
// (a Knight) apart.
function mergeResultType(s,pa,pb){
  const A=pa.type,B=pb.type,fa=!!pa.fortified,fb=!!pb.fortified;
  if(A==='pawn'&&B==='pawn'){
    if(fa&&fb)return 'rook';
    if(!fa&&!fb)return 'knight';
    return null;
  }
  if(fa||fb)return null;
  if((A==='pawn'&&B==='knight')||(A==='knight'&&B==='pawn'))return 'bishop';
  if(A==='knight'&&B==='knight')return 'paladin';
  if((A==='knight'&&B==='bishop')||(A==='bishop'&&B==='knight'))return 'queen';
  if(A==='rook'&&B==='rook')return 'siege';
  if((A==='rook'&&B==='knight')||(A==='knight'&&B==='rook'))return 'guardian';
  if((A==='bishop'&&B==='rook')||(A==='rook'&&B==='bishop'))return s.elixir[pa.color]>=MAGE_ELIXIR?'mage':null;
  return null;
}
const MAGE_ELIXIR=2;
const FORTIFIED_MEND=5;   // a fortified pawn mends 1 HP five turns after its last hit (state.js)
// delayed orders (MAX_DELAY, ORDER_COST in js/state.js): giving one spends part of the turn's order
// budget instead of the turn itself, and a pawn's takes half of it
const MAX_DELAY=3, ORDER_BUDGET=1, ORDER_COST={pawn:.5};
const NO_ORDER_TYPES=new Set(['paladin','guardian','mage']);   // canOrder in js/state.js
const ORDER_MIN=ORDER_COST.pawn;   // the cheapest order there is: below this the turn has nothing left to give
function orderCost(type){return ORDER_COST[type]||1;}

// ── RULES: LEGAL ACTIONS ─────────────────────────────────────────────────────
// Actions ({type, from, to}) mirror what the player can do by drag, tap or click:
//   move      piece to an empty tile
//   merge     piece onto a friendly piece (a knight's L-jump merge doesn't end the turn)
//   target    lock a piece onto an enemy; it fires at that enemy first while in range
//             (by default only enemies already in range; {anyTarget:true} allows any enemy,
//             as dropping a piece on a distant enemy does)
//   heal      bishop heals a wounded ally on its diagonal now
//   healLock  bishop dropped on a wounded adjacent knight, choosing "Heal": locks the knight
//             as its heal target, and the heal fires with the end-of-turn attacks
//   spawn     king places a pawn on an adjacent empty tile
//   fortify   a pawn becomes a fortified pawn, 3 HP, for 1 Gold (from === to)
//   extract   a pawn on the Elixir spring spends its turn extracting one Elixir (from === to)
//   scry      a bishop with both its mana lights a 3x3 it cannot see
//   unsiege   siege tower splits back into rooks (from === to)
//   skip      pass the turn
// Not modelled yet: group moves, free right-click targeting, animals.
function legalActions(s,opts){
  opts=opts||{};
  if(s.over)return[];
  const color=s.turn,B=s.board,g=geo(s),out=[];
  const noMerge=!!(s.level&&s.level.noMerge);
  const goldAllowed=!s.level||s.level.allowSpawn!==false;   // a level with no spawning has no Gold
  const mine=[];
  for(let i=0;i<B.length;i++){
    const p=B[i];if(!p||p.color!==color)continue;
    mine.push(i);
    if(p.type==='siege')out.push({type:'unsiege',from:i,to:i});
    const d=getDests(s,i);
    d.move.forEach(j=>out.push({type:'move',from:i,to:j}));
    if(!noMerge)d.merge.forEach(j=>{
      out.push({type:'merge',from:i,to:j});
      if(p.type==='bishop'&&(p.mana||0)>0&&B[j].hp<B[j].maxHp)out.push({type:'healLock',from:i,to:j});
    });
    d.heal.forEach(j=>{if(!d.merge.has(j))out.push({type:'heal',from:i,to:j});});
    // a pawn on the Elixir spring can spend its turn extracting; any plain pawn can be fortified for 1 Gold
    if(p.type==='pawn'&&!p.fortified&&s.tiles[i]==='spring')out.push({type:'extract',from:i,to:i});
    if(p.type==='pawn'&&!p.fortified&&goldAllowed&&spawnRemaining(s,color)>=1)out.push({type:'fortify',from:i,to:i});
    // a bishop with both its mana can light any 3x3 on the board, seen or not
    if(p.type==='bishop'&&(p.mana||0)>=2)
      for(let j=0;j<B.length;j++)out.push({type:'scry',from:i,to:j});
    // a Mage with a full charge can summon a meteor over any square on the board, seen or not
    if(p.type==='mage'&&(p.mana||0)>=METEOR_MANA)
      for(let j=0;j<B.length;j++)out.push({type:'meteor',from:i,to:j});
    if(opts.anyTarget){
      for(let j=0;j<B.length;j++)if(B[j]&&B[j].color!==color&&!concealed(s,j,color))out.push({type:'target',from:i,to:j});
    }else d.attack.forEach(j=>out.push({type:'target',from:i,to:j}));
  }
  // An order reserves a square a few turns ahead and leaves the turn to be used — unless it takes the
  // last of the order budget, in which case the turn passes (applyAction). The square may be one an
  // enemy holds today: it may be gone by then, and if it is not the move becomes a strike (runOrders).
  // The reach is worked out with the enemy taken off the board, as orderTargets does in js/actions.js.
  if(s.orderLeft[color]>=ORDER_MIN){
    const all=[];
    for(let k=0;k<B.length;k++)if(B[k])all.push([k,B[k]]);
    for(const i of mine){
      const q=B[i];
      if(NO_ORDER_TYPES.has(q.type))continue;
      if(s.orderLeft[color]<orderCost(q.type))continue;
      for(const[k]of all)if(k!==i)B[k]=null;          // the square is reserved, not fought over
      // a siege tower moves only this way, one square and a turn later, and cannot fire the turn it moves
      const dests=q.type==='siege'?g.adj8[i].filter(j=>!s.blocked[j]):[...getDests(s,i).move];
      for(const[k,p2]of all)B[k]=p2;                  // and everyone goes back where they were
      dests.forEach(j=>{for(let k=1;k<=MAX_DELAY;k++)out.push({type:'order',from:i,to:j,turns:k});});
    }
  }
  const king=B.findIndex(p=>p&&p.color===color&&p.type==='king');
  if(king>=0&&goldAllowed&&spawnRemaining(s,color)>=1)
    g.adj8[king].forEach(j=>{if(!B[j]&&!s.blocked[j])out.push({type:'spawn',from:king,to:j});});
  out.push({type:'skip'});
  return out;
}

// ── RULES: AUTO-ATTACKS (computeActions / applyActions in combat.js) ─────────
function computeActions(s,color){
  const g=geo(s),B=s.board,enemy=other(color),targets=s.targets[color],fog=fogFor(s,color);
  const acts=[],targeted=new Set();
  for(let i=0;i<B.length;i++){
    const p=B[i];if(!p||p.color!==color)continue;
    if(p.type==='bishop'){
      const bRange=bishopRange(s,i),tgt=targets[i];
      let healI=-1;
      // a bishop heals only a locked, wounded ally in range; any other lock is dropped
      if(tgt!==undefined&&B[tgt]&&B[tgt].color===color&&B[tgt].hp<B[tgt].maxHp&&bRange.includes(tgt))healI=tgt;
      else if(tgt!==undefined)delete targets[i];
      if(healI>=0&&(p.mana||0)>0)acts.push({attacker:i,target:healI,action:'heal'});
      else{
        let foes=bRange.filter(j=>B[j]&&B[j].color===enemy);
        if(fog)foes=foes.filter(j=>visible(s,j,color));
        foes=foes.filter(j=>!concealed(s,j,color));
        if(foes.length){
          foes.sort((a,b)=>{const pa=B[a],pb=B[b];if(pa.type==='king')return -1;if(pb.type==='king')return 1;return pa.hp-pb.hp;});
          acts.push({attacker:i,target:foes[0],action:'attack'});
        }
      }
    }else{
      const range=p.type==='queen'?g.qr[i]:p.type==='mage'?mageRange(s,i):p.type==='siege'?siegeLine(s,i):p.type==='rook'?lineRange(s,i,CARD,3):p.type==='guardian'?guardianRange(s,i):(p.type==='knight'||p.type==='paladin')?g.kj[i]:g.adj8[i];
      let foes=range.filter(j=>B[j]&&B[j].color===enemy);
      if(fog)foes=foes.filter(j=>visible(s,j,color));
      foes=foes.filter(j=>!concealed(s,j,color));
      if(!foes.length)continue;
      const lock=targets[i];
      let t;
      if(lock!==undefined&&B[lock]&&B[lock].color===enemy&&range.includes(lock)&&!concealed(s,lock,color))t=lock;
      else t=[...foes].sort((a,b)=>{const pa=B[a],pb=B[b];if(pa.type==='king')return -1;if(pb.type==='king')return 1;
        if(!targeted.has(a)&&targeted.has(b))return -1;if(targeted.has(a)&&!targeted.has(b))return 1;return pa.hp-pb.hp;})[0];
      targeted.add(t);
      acts.push({attacker:i,target:t,action:'attack'});
    }
  }
  return acts;
}

function applyAttacks(s,acts,color,events){
  const B=s.board,enemy=other(color);
  for(const{attacker,target,action}of acts){
    if(s.over)return;
    const t=B[target];
    if(action==='heal'){
      if(!t||t.color!==color)continue;
      t.hp=Math.min(t.maxHp,t.hp+2);
      const bp=B[attacker];
      if(bp&&bp.type==='bishop'){bp.mana=Math.max(0,(bp.mana||0)-1);bp.lastHealTurn=clock(s,color);}
      if(events)events.push({type:'heal',from:attacker,to:target,hp:t.hp});
      continue;
    }
    if(!t||t.color!==enemy)continue;
    const ap=B[attacker],dmg=ap&&ap.type==='siege'?2:ap&&ap.type==='paladin'?t.hp:1;
    t.hp-=dmg;
    if(t.fortified)t.lastHitTurn=clock(s,color);   // its armour mends from here (upkeep)
    // fighting from or into undergrowth reveals a piece for as long as it stays on that square (inCover)
    if(ap)ap.exposedAt=attacker;
    t.exposedAt=target;
    if(color==='w'&&t.hp>0)s.hitBy.push({target,attacker});
    const killed=t.hp<=0;
    if(events)events.push({type:'attack',from:attacker,to:target,damage:dmg,hp:t.hp,killed});
    if(killed){
      B[target]=null;
      if(ap&&ap.type==='paladin'){B[attacker]=null;B[target]=ap;}   // it leaps onto the square it cleared
      if(s.level){const r=campaignResult(s);if(r){s.over=true;s.winner=r==='win'?'w':'b';}}
      else if(t.type==='king'){s.over=true;s.winner=color;}
    }
    // the Mage's fire burns down the whole line it was aimed into — every other enemy on that same
    // trajectory takes 1 too; a friend on it is left untouched
    if(ap&&ap.type==='mage'&&!s.over){
      const line=sangLineFor(s,attacker,target);
      if(line)for(const j of line){
        if(j===target||s.over)continue;
        const q=B[j];if(!q||q.color!==enemy)continue;
        q.hp-=1;
        if(q.fortified)q.lastHitTurn=clock(s,color);
        q.exposedAt=j;
        if(color==='w'&&q.hp>0)s.hitBy.push({target:j,attacker});
        const qkilled=q.hp<=0;
        if(events)events.push({type:'attack',from:attacker,to:j,damage:1,hp:q.hp,killed:qkilled,line:true});
        if(qkilled){
          B[j]=null;
          if(s.level){const r=campaignResult(s);if(r){s.over=true;s.winner=r==='win'?'w':'b';}}
          else if(q.type==='king'){s.over=true;s.winner=color;}
        }
      }
    }
    // the Guardian's shot flies on past the target, along the same straight line, damaging every other
    // enemy in its path — never a piece of its own, which the shot simply passes over
    if(ap&&ap.type==='guardian'&&!s.over){
      const path=cardinalPath(s,attacker,target);
      if(path)for(const j of path){
        if(j===target||s.over)continue;
        const q=B[j];if(!q||q.color!==enemy)continue;
        q.hp-=1;
        if(q.fortified)q.lastHitTurn=clock(s,color);
        q.exposedAt=j;
        if(color==='w'&&q.hp>0)s.hitBy.push({target:j,attacker});
        const qkilled=q.hp<=0;
        if(events)events.push({type:'attack',from:attacker,to:j,damage:1,hp:q.hp,killed:qkilled,path:true});
        if(qkilled){
          B[j]=null;
          if(s.level){const r=campaignResult(s);if(r){s.over=true;s.winner=r==='win'?'w':'b';}}
          else if(q.type==='king'){s.over=true;s.winner=color;}
        }
      }
    }
  }
}

// checkCampaignWin in campaign.js, from White's side: 'win', 'lose' or null. The objectives are
// destroy_all, destroy_king, reach, survive and hold, plus protect (a piece you must not lose).
function campaignResult(s){
  const lv=s.level,B=s.board;
  const mine=p=>p&&p.color==='w';
  if(lv.protect&&!B.some(p=>mine(p)&&p.type===lv.protect))return'lose';
  const onGoal=t=>(lv.squares||[]).some(([r,c])=>{const p=B[r*s.cols+c];return mine(p)&&(!t||p.type===t);});
  if(lv.winType==='reach'&&onGoal(lv.reachType))return'win';
  if((lv.winType==='survive'||lv.winType==='hold')&&s.turnCount.w>=(lv.surviveTurns||lv.turnLimit)){
    if(lv.winType==='survive')return'win';
    if(onGoal(null))return'win';
  }
  // whoever started the level with a King loses it by losing him
  if(lv.winType==='destroy_king'||(lv.black||[]).some(p=>p.type==='king')){
    if(!B.some(p=>p&&p.color==='b'&&p.type==='king'))return'win';
  }
  if((lv.white||[]).some(p=>p.type==='king')&&!B.some(p=>p&&p.color==='w'&&p.type==='king'))return'lose';
  if(lv.winType==='destroy_all'&&!B.some(p=>p&&p.color==='b'))return'win';
  if(!B.some(p=>p&&p.color==='w'))return'lose';
  // the level's turn limit is a deadline, not just a par time (checkCampaignWin in campaign.js)
  if(lv.turnLimit&&s.turnCount.w>=lv.turnLimit)return'lose';
  return null;
}

// ── RULES: TAKING A TURN ──────────────────────────────────────────────────────
function isLegal(s,a){
  if(!a||typeof a!=='object')return false;
  return legalActions(s,{anyTarget:true}).some(b=>b.type===a.type&&b.from===a.from&&b.to===a.to);
}

// applies one action for the side to move (executeDrop / handleClick / unsiegePiece / doSkip
// in actions.js); returns true when the turn continues (a knight's L-jump merge)
function applyAction(s,a,events){
  const B=s.board,color=s.turn,tg=s.targets[color],p=a.from!==undefined?B[a.from]:null;
  switch(a.type){
    case'move':
      delete tg[a.from];
      if(p.type==='pawn')p.firstMove=false;
      B[a.from]=null;B[a.to]=p;s.moved=a.to;
      events.push({type:'move',from:a.from,to:a.to,piece:p.type});
      return false;
    case'merge':{
      const t=B[a.to];
      let np;
      if(p.type==='bishop'&&(t.type==='knight'||t.type==='rook')){
        // the bishop-onto-knight (or rook) popup's Merge keeps both pieces' target locks
        np=makePiece(t.type==='rook'?'mage':'queen',p.color);
      }else{
        delete tg[a.from];delete tg[a.to];
        np=makePiece(mergeResultType(s,p,t),p.color);
        if(np.type==='bishop')np.mana=1;
        if(np.type==='mage')np.mana=1;
        if(np.type==='siege')np.sieged=true;
      }
      if(np.type==='mage')s.elixir[color]-=MAGE_ELIXIR;
      B[a.from]=null;B[a.to]=np;s.moved=a.to;   // the merge was the move: the new piece holds its fire
      events.push({type:'merge',from:a.from,to:a.to,piece:np.type});
      return p.type==='knight'&&geo(s).kj[a.from].includes(a.to);
    }
    case'healLock':
    case'target':
      tg[a.from]=a.to;
      events.push({type:a.type,from:a.from,to:a.to});
      return false;
    case'heal':{
      const t=B[a.to];
      t.hp=Math.min(t.maxHp,t.hp+2);
      p.mana=Math.max(0,(p.mana||0)-1);
      p.lastHealTurn=clock(s,color);
      delete tg[a.from];
      s.moved=a.from;
      events.push({type:'heal',from:a.from,to:a.to,hp:t.hp});
      return false;
    }
    case'order':
      p.order={to:a.to,turns:a.turns};
      s.orderLeft[color]-=orderCost(p.type);
      events.push({type:'order',from:a.from,to:a.to,turns:a.turns});
      // the budget is the turn: while half of it is left (a second pawn), the turn goes on
      return s.orderLeft[color]>=ORDER_MIN;
    case'extract':
      s.elixir[color]++;
      s.moved=a.from;                       // the pawn worked instead of shooting
      events.push({type:'extract',at:a.from});
      return false;
    case'fortify':
      p.fortified=true;p.hp=FORTIFIED_HP;p.maxHp=FORTIFIED_HP;
      s.goldSpent[color]++;
      s.moved=a.from;
      events.push({type:'fortify',at:a.from});
      return false;
    case'scry':{
      p.mana=Math.max(0,(p.mana||0)-2);
      p.lastHealTurn=clock(s,color);       // scrying resets the same refill clock a heal does
      s.scans.push({tiles:scryBox(s,a.to),turns:SCRY_TURNS,color});
      s.moved=a.from;                       // the bishop looked instead of shooting
      events.push({type:'scry',from:a.from,to:a.to});
      return false;
    }
    case'meteor':{
      const anchor=meteorAnchorFor(s,a.to);
      p.mana=Math.max(0,(p.mana||0)-METEOR_MANA);
      p.lastHealTurn=clock(s,color);
      s.meteors.push({tiles:meteorBox(s,anchor),turns:METEOR_TURNS,color});
      s.moved=a.from;                       // the Mage spent the turn casting instead of shooting
      events.push({type:'meteor',from:a.from,to:anchor});
      return false;
    }
    case'spawn':
      B[a.to]={type:'pawn',color,hp:STATS.pawn.hp,maxHp:STATS.pawn.maxHp,newborn:true,firstMove:true};
      s.spawns[color]++;
      events.push({type:'spawn',from:a.from,to:a.to});
      return false;
    case'unsiege':{
      const empties=geo(s).adj8[a.from].filter(j=>!B[j]&&!s.blocked[j]);
      const dest=empties.length?empties[0]:null;
      const hp=Math.max(1,Math.min(STATS.rook.maxHp,p.hp));
      B[a.from]={type:'rook',color:p.color,hp,maxHp:STATS.rook.maxHp};
      // (unsiegePiece tests `if(dest)`, so a free tile at square 0 gets no second rook)
      if(dest)B[dest]={type:'rook',color:p.color,hp,maxHp:STATS.rook.maxHp};
      events.push({type:'unsiege',from:a.from,to:dest});
      return false;
    }
    case'skip':
      s.moved=-1;
      events.push({type:'skip'});
      return false;
  }
  throw new Error('unknown action type '+a.type);
}

// end of a turn (endTurn / finishBlackTurn in game.js)
function finishTurn(s,color,events){
  const B=s.board;
  const justMoved=s.moved;
  s.moved=-1;
  s.turnCount[color]++;
  if(pawnOnMine(s,color))s.mineTurns[color]++;   // the mine pays for the turn it was held
  if(s.mode==='pvp'){
    // the side that acted fires, except the piece that moved or healed; then the other side starts
    applyAttacks(s,computeActions(s,color).filter(a=>a.attacker!==justMoved&&!(B[a.attacker]&&B[a.attacker].rolled)),color,events);
    if(!s.over){s.turn=other(color);tickScans(s,s.turn);runMeteors(s,s.turn,events);upkeep(s,s.turn,events);}
  }else if(color==='w'){
    // White fires (except the mover), then Black fires, then Black acts
    s.hitBy=[];
    applyAttacks(s,computeActions(s,'w').filter(a=>a.attacker!==justMoved&&!(B[a.attacker]&&B[a.attacker].rolled)),'w',events);
    if(!s.over){
      const bActs=computeActions(s,'b').filter(a=>!(B[a.attacker]&&B[a.attacker].rolled));
      s.acted=bActs.map(a=>a.attacker);
      applyAttacks(s,bActs,'b',events);
    }
    if(!s.over){s.turn='b';tickScans(s,'b');runMeteors(s,'b',events);}
  }else if(!s.over){
    s.turn='w';tickScans(s,'w');runMeteors(s,'w',events);
    upkeep(s,null,events);
  }
  if(!s.over&&s.level){const r=campaignResult(s);if(r){s.over=true;s.winner=r==='win'?'w':'b';}}
  if(!s.over&&s.maxTurns&&s.turnCount.w+s.turnCount.b>=s.maxTurns){s.over=true;s.winner='draw';}
}

// start-of-turn upkeep (turnUpkeep): newborn marks clear, bishops regain mana every 3 turns
function upkeep(s,own,events){
  const B=s.board;
  for(let i=0;i<B.length;i++){const p=B[i];if(p&&p.newborn&&(!own||p.color===own))p.newborn=false;}
  // a piece fought its way out of hiding at one square; once it's no longer standing there, whatever
  // it revealed no longer applies (inCover)
  for(let i=0;i<B.length;i++){const p=B[i];if(p&&p.exposedAt!==undefined&&p.exposedAt!==i)delete p.exposedAt;}
  for(let i=0;i<B.length;i++){
    const p=B[i];
    if(p&&(p.type==='bishop'||p.type==='mage')&&(!own||p.color===own)&&(p.mana||0)<2){
      const t=clock(s,own||'w'),last=p.lastHealTurn||0;
      if(t-last>=3&&t>0){p.mana=Math.min(2,(p.mana||0)+1);p.lastHealTurn=t;}
    }
  }
  // a fortified pawn's armour mends 1 HP five turns after the last hit it took (turnUpkeep in game.js)
  for(let i=0;i<B.length;i++){
    const p=B[i];
    if(p&&p.fortified&&(!own||p.color===own)&&p.hp<p.maxHp){
      const t=clock(s,own||'w'),last=p.lastHitTurn||0;
      if(t-last>=FORTIFIED_MEND&&t>0){p.hp++;p.lastHitTurn=t;}
    }
  }
  // the orders that come due are carried out here, at the head of the turn, before that side moves
  for(let i=0;i<B.length;i++){const p=B[i];if(p&&p.rolled&&(!own||p.color===own))delete p.rolled;}
  runOrders(s,own,events);
  if(!own||own==='w')s.orderLeft.w=ORDER_BUDGET;
  if(!own||own==='b')s.orderLeft.b=ORDER_BUDGET;
}

// Delayed orders (runOrders in js/game.js, which this mirrors). An order counts down at the start of
// its side's turn and is carried out the moment it reaches nought, before that side moves: the piece
// goes to the square it reserved, strikes an enemy standing there instead, or the order lapses — a
// piece of its own on the square, or a square gone out of reach, cancels it.
function runOrders(s,own,events){
  const B=s.board;
  for(let i=0;i<B.length;i++){
    const p=B[i];
    if(!p||!p.order||(own&&p.color!==own))continue;
    if(--p.order.turns>0)continue;
    const to=p.order.to;delete p.order;
    const t=B[to],d=getDests(s,i);
    // rawAttack, unlike attack, still holds a square hidden in undergrowth: the order walks right up
    // to it regardless, discovering whoever it finds there
    if(t&&t.color!==p.color&&d.rawAttack.has(to)){
      const dmg=p.type==='siege'?2:1;
      t.hp-=dmg;
      if(t.fortified)t.lastHitTurn=clock(s,p.color);
      p.exposedAt=i;t.exposedAt=to;
      const killed=t.hp<=0;
      if(events)events.push({type:'attack',from:i,to,damage:dmg,hp:t.hp,killed});
      if(killed){
        B[to]=null;
        if(s.level){const r=campaignResult(s);if(r){s.over=true;s.winner=r==='win'?'w':'b';}}
        else if(t.type==='king'){s.over=true;s.winner=p.color;}
      }
    }else if(!t&&(d.move.has(to)||(p.type==='siege'&&geo(s).adj8[i].includes(to)&&!s.blocked[to]))){
      delete s.targets[p.color][i];
      if(p.type==='pawn')p.firstMove=false;
      B[to]=p;B[i]=null;
      if(p.type==='siege')p.rolled=true;     // it spent the turn rolling; the guns stay quiet
      if(events)events.push({type:'move',from:i,to,piece:p.type});
    }
  }
}

// step(state, action) applies an action for the side to move, including the end-of-turn
// attacks when the action ends the turn. It changes the state in place (clone() first to
// keep the old one) and returns what happened, in order, for animation or logging.
// {trusted:true} skips the legality check.
function step(s,a,opts){
  if(s.over)throw new Error('the game is over');
  if(!(opts&&opts.trusted)&&!isLegal(s,a))throw new Error('illegal action '+JSON.stringify(a));
  const color=s.turn,events=[];
  if(!applyAction(s,a,events))finishTurn(s,color,events);
  return events;
}

// ── BUILT-IN AI (ai.js) ──────────────────────────────────────────────────────
// Black's turn in classic mode, ported line by line (quirks included) so games
// against it play out exactly as in the browser. The AI edits the board directly,
// like the original; botTurn() then ends Black's turn.
const ADJ8_DIRS=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const findKing=(s,color)=>s.board.findIndex(p=>p&&p.color===color&&p.type==='king');

// first step of a shortest path (stepToward / stepTowardCardinal / stepTowardDiagonal):
// obstacles and own pieces block except on the goal tile; enemy pieces don't block
function stepToward(s,from,to,color,dirs){
  if(from===to)return -1;
  const g=geo(s),B=s.board,C=s.cols,visited=new Set([from]),parent=new Map(),queue=[from];
  dirs=dirs||ADJ8_DIRS;
  for(let h=0;h<queue.length;h++){
    const cur=queue[h],r=Math.floor(cur/C),c=cur%C;
    for(const[dr,dc]of dirs){
      const nr=r+dr,nc=c+dc;if(!g.inB(nr,nc))continue;
      const n=nr*C+nc;
      if(visited.has(n))continue;
      visited.add(n);
      if(s.blocked[n]&&n!==to)continue;
      if(B[n]&&B[n].color===color&&n!==to)continue;
      parent.set(n,cur);
      if(n===to){let t=n;while(parent.get(t)!==from)t=parent.get(t);return t;}
      queue.push(n);
    }
  }
  return -1;
}
const stepFor=(s,type,from,to)=>stepToward(s,from,to,'b',type==='rook'?CARD:type==='bishop'?DIAG:null);

// the range the AI checks before moving (a siege tower counts as adjacent here, as in ai.js)
function aiRange(s,i,type){
  const g=geo(s);
  return type==='queen'?g.qr[i]:type==='rook'?lineRange(s,i,CARD,3):type==='knight'?g.kj[i]:type==='bishop'?bishopRange(s,i):g.adj8[i];
}

function bPieces(s){
  const r={pawns:[],knights:[],bishops:[],rooks:[],queens:[],paladins:[]};
  s.board.forEach((p,i)=>{if(p&&p.color==='b'&&r[p.type+'s'])r[p.type+'s'].push(i);});
  return r;
}

function botMove(s,from,to,events){
  const p=s.board[from];
  s.board[to]=p;s.board[from]=null;
  events.push({type:'move',from,to,piece:p.type});
}

function bSpawn(s,cands,events){
  if(!cands.length)return false;
  // Black's quota ignores campaign spawn limits, and counts the mine and fortified pawns (blackSpawnQuota
  // and blackSpawnUsed in state.js)
  if(8+(s.turnCount.b+s.mineTurns.b)/6-s.spawns.b-s.goldSpent.b<1)return false;
  const wK=findKing(s,'w');
  const sorted=wK>=0?[...cands].sort((a,b)=>cheb(s,a,wK)-cheb(s,b,wK)):cands;
  s.board[sorted[0]]={type:'pawn',color:'b',hp:STATS.pawn.hp,maxHp:STATS.pawn.maxHp,firstMove:true};
  s.spawns.b++;
  events.push({type:'spawn',to:sorted[0]});
  return true;
}

function bMerge(s,ft,tt,rt,limit,events){
  if(s.level&&s.level.noMerge)return false;
  const bp=bPieces(s),pool={pawn:bp.pawns,knight:bp.knights,bishop:bp.bishops,rook:bp.rooks};
  const cur={knight:bp.knights.length,bishop:bp.bishops.length,rook:bp.rooks.length,paladin:bp.paladins.length};
  if(cur[rt]!==undefined&&cur[rt]>=limit)return false;
  const g=geo(s);
  for(const a of(pool[ft]||[]))for(const b of(pool[tt]||[])){
    if(a===b||!g.adj8[a].includes(b))continue;
    const np=makePiece(rt,'b');
    if(rt==='bishop')np.mana=1;
    s.board[a]=null;s.board[b]=np;
    events.push({type:'merge',from:a,to:b,piece:rt});
    return true;
  }
  return false;
}

function bMergeQueen(s,limit,events){
  if(s.level&&s.level.noMerge)return false;
  const bp=bPieces(s),g=geo(s);
  if(bp.queens.length>=limit)return false;
  for(const k of bp.knights)for(const b of bp.bishops){
    if(k===b||!g.adj8[k].includes(b))continue;
    s.board[k]=null;s.board[b]=makePiece('queen','b');
    events.push({type:'merge',from:k,to:b,piece:'queen'});
    return true;
  }
  return false;
}

// moves ONE pawn or knight (whatever the caller wanted to advance), farthest from White's king first
const DIR={N:[-1,0],S:[1,0],E:[0,1],W:[0,-1],NE:[-1,1],NW:[-1,-1],SE:[1,1],SW:[1,-1]};
function bMoveAll(s,dirStr,events){
  const[dr,dc]=DIR[dirStr]||[1,0],B=s.board,g=geo(s),C=s.cols,wK=findKing(s,'w');
  const all=[];
  B.forEach((p,i)=>{if(p&&p.color==='b'&&(p.type==='pawn'||p.type==='knight'))all.push(i);});
  if(wK>=0)all.sort((a,b)=>cheb(s,b,wK)-cheb(s,a,wK));
  else all.sort((a,b)=>dr>0?b-a:dr<0?a-b:dc>0?b-a:a-b);
  for(const from of all){
    const p=B[from];if(!p)continue;
    let dest=-1;
    if(p.type==='pawn'){
      const nr=rowOf(s,from)+dr,nc=colOf(s,from)+dc;
      if(g.inB(nr,nc)&&!B[nr*C+nc]&&!s.blocked[nr*C+nc])dest=nr*C+nc;
      else if(wK>=0)dest=stepToward(s,from,wK,'b');
      if(dest>=0&&(B[dest]||s.blocked[dest]))dest=-1;
    }else{
      const ds=g.kj[from].filter(j=>!B[j]&&!s.blocked[j]);
      if(ds.length){const target=wK>=0?wK:from;dest=ds.reduce((a,b)=>cheb(s,a,target)<cheb(s,b,target)?a:b);}
    }
    if(dest>=0){if(p.type==='pawn')p.firstMove=false;botMove(s,from,dest,events);return;}
  }
}

function bAdvance(s,typeFilter,events){
  const wK=findKing(s,'w');if(wK<0)return;
  const mp=[];
  s.board.forEach((p,i)=>{if(p&&p.color==='b'&&(typeFilter?typeFilter.includes(p.type):p.type!=='king'))mp.push(i);});
  if(!mp.length)return;
  const ar=mp.reduce((t,i)=>t+rowOf(s,i),0)/mp.length,ac=mp.reduce((t,i)=>t+colOf(s,i),0)/mp.length;
  const dr=rowOf(s,wK)>ar?1:rowOf(s,wK)<ar?-1:0,dc=colOf(s,wK)>ac?1:colOf(s,wK)<ac?-1:0;
  bMoveAll(s,{'-10':'N','10':'S','01':'E','0-1':'W','-11':'NE','-1-1':'NW','11':'SE','1-1':'SW'}[dr+''+dc]||'S',events);
}

// Hard build orders: true when the strategy used the turn
const HARD_BUILDS={
  pawn_troops:(s,c,bp,ev)=>bp.pawns.length<6&&c.length>0&&bSpawn(s,c,ev),
  knight_attack:(s,c,bp,ev)=>bMerge(s,'pawn','pawn','knight',3,ev)||(bp.pawns.length<4&&c.length>0&&bSpawn(s,c,ev)),
  pawn_knight:(s,c,bp,ev)=>(bp.pawns.length>=2&&bMerge(s,'pawn','pawn','knight',2,ev))||(bp.pawns.length<4&&c.length>0&&bSpawn(s,c,ev)),
  bishop_pawn:(s,c,bp,ev)=>bMerge(s,'pawn','knight','bishop',2,ev)||bMerge(s,'pawn','pawn','knight',2,ev)||(bp.pawns.length<4&&c.length>0&&bSpawn(s,c,ev)),
  rook_pawn:(s,c,bp,ev)=>bMergeQueen(s,1,ev)||bMerge(s,'knight','knight','paladin',1,ev)||bMerge(s,'pawn','knight','bishop',1,ev)
    ||bMerge(s,'pawn','pawn','knight',2,ev)||(bp.pawns.length<5&&c.length>0&&bSpawn(s,c,ev)),
};

function easyRookRush(s,c,bp,ev){
  if(!bp.rooks.length&&!bp.bishops.length&&!bp.knights.length){
    if(bp.pawns.length<2&&c.length&&bSpawn(s,c,ev))return;
    if(bMerge(s,'pawn','pawn','knight',1,ev))return;
    return bAdvance(s,['pawn'],ev);
  }
  if(!bp.rooks.length&&bp.knights.length<2){
    if(bp.pawns.length<2&&c.length&&bSpawn(s,c,ev))return;
    if(bMerge(s,'pawn','pawn','knight',2,ev))return;
    if(bp.pawns.length<2&&c.length&&bSpawn(s,c,ev))return;
    return bAdvance(s,['knight','pawn'],ev);
  }
  if(!bp.rooks.length){
    if(bMerge(s,'knight','knight','paladin',1,ev))return;
    return bAdvance(s,['knight','pawn'],ev);
  }
  bAdvance(s,['rook','pawn','knight'],ev);
}

function turnsToReach(s,bi,wK){
  const p=s.board[bi];if(!p)return 99;
  const d=cheb(s,bi,wK);
  if(p.type==='siege')return 99;
  return p.type==='pawn'||p.type==='king'?d:Math.ceil(d/2);
}

// moves one Black piece a step toward a tile; returns {f,t,type} or null
function movePieceToward(s,bi,wK){
  const B=s.board,lp=B[bi];if(!lp)return null;
  const g=geo(s),C=s.cols,r0=rowOf(s,bi),c0=colOf(s,bi);
  const dr=rowOf(s,wK)>r0?1:rowOf(s,wK)<r0?-1:0,dc=colOf(s,wK)>c0?1:colOf(s,wK)<c0?-1:0;
  let dest=-1;
  if(lp.type==='pawn'){
    const nr=r0+dr,nc=c0+dc;
    if(g.inB(nr,nc)&&!B[nr*C+nc]&&!s.blocked[nr*C+nc])dest=nr*C+nc;
    else dest=stepToward(s,bi,wK,'b');
    if(dest>=0&&(B[dest]||s.blocked[dest]))dest=-1;
  }else if(lp.type==='knight'){
    const ds=g.kj[bi].filter(j=>!B[j]&&!s.blocked[j]);
    if(ds.length)dest=ds.reduce((a,b)=>cheb(s,a,wK)<cheb(s,b,wK)?a:b);
  }else if(lp.type==='bishop'||lp.type==='queen'||lp.type==='rook'){
    const dirs=lp.type==='rook'?[[dr,0],[0,dc],[-dr,0],[0,-dc]].filter(([a,b])=>a||b)
      :lp.type==='bishop'?[[dr,dc],[dr,-dc],[-dr,dc],[-dr,-dc]].filter(([a,b])=>a&&b)
      :[[dr,dc],[dr,0],[0,dc],[dr,-dc],[-dr,dc],[-dr,0],[0,-dc],[-dr,-dc]].filter(([a,b])=>a||b);
    const seen=new Set(),udirs=[];
    dirs.forEach(([a,b])=>{const k=a+','+b;if(!seen.has(k)){seen.add(k);udirs.push([a,b]);}});
    for(const[ddr,ddc]of udirs){
      // try 2 squares first; a blocked far tile skips this direction entirely
      for(let k=2;k>=1;k--){
        const nr=r0+ddr*k,nc=c0+ddc*k;
        if(!g.inB(nr,nc))continue;
        const ti=nr*C+nc;if(s.blocked[ti])break;
        if(k===2){const mid=(r0+ddr)*C+(c0+ddc);if(s.blocked[mid]||B[mid])break;}
        if(!B[ti]&&cheb(s,ti,wK)<cheb(s,bi,wK)){dest=ti;break;}
      }
      if(dest>=0)break;
    }
    if(dest<0){
      const det=stepFor(s,lp.type,bi,wK);
      if(det>=0&&!B[det]&&!s.blocked[det]&&cheb(s,det,wK)<cheb(s,bi,wK))dest=det;
    }
  }
  if(dest<0)return null;
  if(lp.type==='pawn')lp.firstMove=false;
  B[dest]=lp;B[bi]=null;
  return{f:bi,t:dest,type:lp.type};
}

function hardTacticalAI(s,cands,bp,events){
  const wK=findKing(s,'w');
  if((HARD_BUILDS[s.strategy]||HARD_BUILDS.rook_pawn)(s,cands,bp,events))return;
  if(wK<0)return bAdvance(s,null,events);
  const allB=[];
  s.board.forEach((p,i)=>{if(p&&p.color==='b'&&p.type!=='king'&&p.type!=='siege'&&!s.acted.includes(i))allB.push(i);});
  if(!allB.length)return bAdvance(s,null,events);
  // coordinated wave: far pieces move, pieces in range or one turn away wait for the rest
  const arrivals=allB.map(bi=>({bi,turns:turnsToReach(s,bi,wK)}));
  const allClose=arrivals.every(a=>a.turns<=1);
  const toMove=arrivals.filter(a=>{
    if(allClose)return true;
    if(aiRange(s,a.bi,s.board[a.bi].type).some(j=>s.board[j]&&s.board[j].color==='w'))return false;
    return a.turns>1;
  });
  const moveList=toMove.length>0?toMove:arrivals;
  moveList.sort((a,b)=>b.turns-a.turns);
  for(const{bi}of moveList){
    if(!s.board[bi])continue;
    const r=movePieceToward(s,bi,wK);
    if(r){events.push({type:'move',from:r.f,to:r.t,piece:r.type});return;}
  }
  bAdvance(s,null,events);
}

// a Black piece White hit this round can't hit back where it stands: counter-attack or flee
function reactiveAI(s,events){
  if(!s.hitBy.length)return false;
  const B=s.board,g=geo(s);
  for(const{target,attacker}of s.hitBy){
    const victim=B[target],attackerP=B[attacker];
    if(!victim||victim.color!=='b'||!attackerP||attackerP.color!=='w')continue;
    const vRange=victim.type==='siege'?siegeLine(s,target):aiRange(s,target,victim.type);
    if(vRange.includes(attacker))continue;
    const preferAttack=attackerP.hp<=victim.hp||nextRandom(s)<0.4;
    if(preferAttack){
      for(let bi=0;bi<B.length;bi++){
        const bp=B[bi];
        if(!bp||bp.color!=='b'||bp.type==='king'||bp.type==='siege')continue;
        if(bp.type==='knight'){
          const good=g.kj[bi].filter(j=>!B[j]&&!s.blocked[j]).find(j=>g.kj[j].includes(attacker));
          if(good!==undefined){botMove(s,bi,good,events);return true;}
        }else if(bp.type==='pawn'){
          const st=g.adj8[bi].find(j=>!B[j]&&!s.blocked[j]&&g.adj8[j].includes(attacker));
          if(st!==undefined){bp.firstMove=false;botMove(s,bi,st,events);return true;}
        }else if(bp.type==='rook'||bp.type==='bishop'||bp.type==='queen'){
          // only the sliding pieces step in (ai.js lists them by name, so a Mage stays put)
          const dest=stepFor(s,bp.type,bi,attacker);
          if(dest>=0&&!B[dest]&&!s.blocked[dest]){
            // range from the new tile, measured before the piece leaves its old one (as ai.js does)
            const nr=bp.type==='queen'?g.qr[dest]:bp.type==='rook'?lineRange(s,dest,CARD,3):bishopRange(s,dest);
            if(nr.includes(attacker)){botMove(s,bi,dest,events);return true;}
          }
        }
      }
    }
    if(victim.type==='siege')continue;
    let flee;
    if(victim.type==='knight')flee=g.kj[target].filter(j=>!B[j]&&!s.blocked[j]);
    else if(victim.type==='rook')flee=[...slide(s,target,CARD,2,new Set())];
    else if(victim.type==='bishop')flee=[...slide(s,target,DIAG,2,new Set())];
    else if(victim.type==='queen')flee=[...slide(s,target,ADJ8_DIRS,2,new Set())];
    else flee=g.adj8[target].filter(j=>!B[j]&&!s.blocked[j]);
    if(flee.length){
      const best=flee.reduce((a,b)=>cheb(s,b,attacker)>cheb(s,a,attacker)?b:a);
      if(victim.type==='pawn')victim.firstMove=false;
      botMove(s,target,best,events);
      return true;
    }
  }
  return false;
}

// campaign levels: no spawning; answer threats, then move by the level's enemy profile (campaignAI in
// ai.js does the same):
//   hunter (default) walk at White's King, or the nearest piece when there is none
//   turtle            hold the ground they were given and only answer threats
//   raider            go for White's weakest piece instead of the King
function campaignAI(s,events){
  if(reactiveAI(s,events))return;
  const profile=(s.level&&s.level.enemy)||'hunter';
  if(profile==='turtle')return;
  const B=s.board,g=geo(s);
  const allB=[];
  B.forEach((p,i)=>{if(p&&p.color==='b'&&p.type!=='siege'&&!s.acted.includes(i))allB.push(i);});
  if(!allB.length)return;
  let target=profile==='raider'?-1:findKing(s,'w');
  if(profile==='raider'){
    // the weakest piece on the board, by hit points and then by square, so both sides pick the same one
    let worst=99;
    for(let j=0;j<B.length;j++){const wp=B[j];if(!wp||wp.color!=='w')continue;if(wp.hp<worst){worst=wp.hp;target=j;}}
  }
  if(target<0){
    let best=999;
    for(const bi of allB)for(let j=0;j<B.length;j++){
      if(!B[j]||B[j].color!=='w')continue;
      const d=cheb(s,bi,j);if(d<best){best=d;target=j;}
    }
  }
  if(target<0)return;
  const isThreatened=bi=>{
    for(let j=0;j<B.length;j++){
      const wp=B[j];if(!wp||wp.color!=='w')continue;
      if(wp.type==='pawn'&&g.adj8[j].includes(bi))return j;
      if(wp.type==='knight'&&g.kj[j].includes(bi))return j;
      if(wp.type==='bishop'&&bishopRange(s,j).includes(bi))return j;
      if(wp.type==='rook'&&lineRange(s,j,CARD,3).includes(bi))return j;
      if(wp.type==='queen'&&g.qr[j].includes(bi))return j;
      if(wp.type==='king'&&g.adj8[j].includes(bi))return j;
    }
    return -1;
  };
  // 1. threatened pieces reposition to hit back, or retreat
  for(const bi of allB){
    if(!B[bi])continue;
    const threatBy=isThreatened(bi);if(threatBy<0)continue;
    const p=B[bi];
    if(aiRange(s,bi,p.type).includes(threatBy))continue;
    const res=movePieceToward(s,bi,threatBy);
    if(res){
      if(aiRange(s,res.t,p.type).includes(threatBy)){events.push({type:'move',from:res.f,to:res.t,piece:res.type});return;}
      // undo the trial move (like ai.js, a pawn stays without its double step)
      B[bi]=p;B[res.t]=null;
    }
    let flee;
    if(p.type==='knight')flee=g.kj[bi].filter(j=>!B[j]&&!s.blocked[j]);
    else if(p.type==='bishop')flee=[...slide(s,bi,DIAG,2,new Set())];
    else if(p.type==='rook')flee=[...slide(s,bi,CARD,2,new Set())];
    else if(p.type==='queen')flee=[...slide(s,bi,ADJ8_DIRS,2,new Set())];
    else flee=g.adj8[bi].filter(j=>!B[j]&&!s.blocked[j]);
    if(flee.length){
      const far=list=>list.reduce((a,b)=>cheb(s,b,threatBy)>cheb(s,a,threatBy)?b:a);
      const safe=flee.filter(j=>isThreatened(j)<0);
      botMove(s,bi,safe.length?far(safe):far(flee),events);
      return;
    }
  }
  // 2. try each piece not already in range and make the move that ends closest to the target
  let bestMove=null,bestScore=Infinity;
  for(const bi of allB){
    if(!B[bi])continue;
    const p=B[bi];
    if(aiRange(s,bi,p.type).some(j=>B[j]&&B[j].color==='w'))continue;
    const savedFirstMove=p.firstMove;
    const res=movePieceToward(s,bi,target);
    if(res){
      const d=cheb(s,res.t,target);
      if(d<bestScore){bestMove=res;bestScore=d;}
      B[res.f]=p;B[res.t]=null;
      if(savedFirstMove)p.firstMove=true;
    }
  }
  if(bestMove){
    const mp=B[bestMove.f];
    if(mp&&mp.type==='pawn')mp.firstMove=false;
    B[bestMove.t]=mp;B[bestMove.f]=null;
    events.push({type:'move',from:bestMove.f,to:bestMove.t,piece:bestMove.type});
    return;
  }
  // 3. any legal step toward the target
  for(const bi of allB){
    if(!B[bi])continue;
    const p=B[bi];
    let dest=-1;
    if(p.type==='knight'){
      const jumps=g.kj[bi].filter(j=>!B[j]&&!s.blocked[j]);
      if(jumps.length)dest=jumps.reduce((a,b)=>cheb(s,a,target)<cheb(s,b,target)?a:b);
    }else{
      const res=movePieceToward(s,bi,target);
      if(res){events.push({type:'move',from:res.f,to:res.t,piece:res.type});return;}
      const st=stepFor(s,p.type,bi,target);
      if(st>=0&&!B[st]&&!s.blocked[st]&&cheb(s,st,target)<cheb(s,bi,target))dest=st;
    }
    if(dest>=0){if(p.type==='pawn')p.firstMove=false;botMove(s,bi,dest,events);return;}
  }
}

// botTurn(state) plays Black's turn in classic mode with the built-in AI (fallbackAI in
// ai.js): Easy rook rush, the Hard strategy picked at game start, or the campaign AI.
// Like step(), it changes the state in place and returns what happened.
function botTurn(s){
  if(s.over)throw new Error('the game is over');
  if(s.mode!=='classic'||s.turn!=='b')throw new Error('botTurn plays Black in classic mode');
  const events=[];
  // a pawn of ours standing on the Elixir spring extracts first of all (fallbackAI in ai.js)
  const dig=s.board.findIndex((p,i)=>p&&p.color==='b'&&p.type==='pawn'&&!p.fortified&&s.tiles[i]==='spring');
  if(dig>=0){
    s.elixir.b++;
    events.push({type:'extract',at:dig});
    finishTurn(s,'b',events);
    return events;
  }
  if(!reactiveAI(s,events)){
    // (the campaign AI runs the reactive check again, drawing new random numbers, as ai.js does)
    if(s.level)campaignAI(s,events);
    else{
      const bK=findKing(s,'b');
      const cands=bK>=0?geo(s).adj8[bK].filter(i=>!s.board[i]&&!s.blocked[i]):[];
      const bp=bPieces(s);
      if(s.difficulty==='easy')easyRookRush(s,cands,bp,events);
      else hardTacticalAI(s,cands,bp,events);
    }
  }
  finishTurn(s,'b',events);
  return events;
}

// fromSnapshot(data) builds a state from plain data, such as the browser game's own variables:
// {cols, rows, theme, mode, board, tiles, turn, turnCount, spawns, targets, hitBy, acted, level, fog, maxTurns}
function fromSnapshot(o){
  const s={cols:o.cols,rows:o.rows,theme:o.theme||'forest',mode:o.mode==='pvp'?'pvp':'classic',difficulty:o.difficulty||'hard',
    board:o.board.map(p=>p&&Object.assign({},p)),tiles:null,blocked:null,turn:o.turn||'w',over:false,winner:null,
    turnCount:{w:o.turnCount.w,b:o.turnCount.b},spawns:{w:o.spawns.w,b:o.spawns.b},
    orderLeft:{w:o.orderLeft?o.orderLeft.w:ORDER_BUDGET,b:o.orderLeft?o.orderLeft.b:ORDER_BUDGET},
    elixir:{w:(o.elixir&&o.elixir.w)||0,b:(o.elixir&&o.elixir.b)||0},
    mineTurns:{w:(o.mineTurns&&o.mineTurns.w)||0,b:(o.mineTurns&&o.mineTurns.b)||0},
    goldSpent:{w:(o.goldSpent&&o.goldSpent.w)||0,b:(o.goldSpent&&o.goldSpent.b)||0},
    targets:{w:Object.assign({},o.targets.w),b:Object.assign({},o.targets.b)},moved:-1,
    scans:(o.scans||[]).map(sc=>({tiles:sc.tiles.slice(),turns:sc.turns,color:sc.color})),
    meteors:(o.meteors||[]).map(m=>({tiles:m.tiles.slice(),turns:m.turns,color:m.color})),
    hitBy:(o.hitBy||[]).map(h=>({target:h.target,attacker:h.attacker})),acted:(o.acted||[]).slice(),
    level:o.level||null,fog:!!o.fog,maxTurns:o.maxTurns||0,strategy:o.strategy||null,animals:[],rng:o.seed|0};
  const n=s.cols*s.rows;
  s.tiles=new Array(n).fill('');
  s.blocked=new Array(n).fill(false);
  for(let i=0;i<n;i++)if(o.tiles&&o.tiles[i])setTile(s,i,o.tiles[i]);
  return s;
}

// act(state, action) applies one action for the side to move without the end-of-turn attacks and
// upkeep, for a game loop that runs those itself (the browser's trained AI). Returns {events,
// continues}: continues is true when the same side acts again (a knight's L-jump merge).
function act(s,a,opts){
  if(s.over)throw new Error('the game is over');
  if(!(opts&&opts.trusted)&&!isLegal(s,a))throw new Error('illegal action '+JSON.stringify(a));
  const events=[];
  const continues=applyAction(s,a,events);
  return{events,continues};
}

const SemunEngine={
  // playing
  newGame,legalActions,step,botTurn,clone,isLegal,fromSnapshot,act,
  // rule queries
  getDests,computeActions,applyAttacks,upkeep,spawnRemaining,pawnOnMine,visible,fogFor,inCover,concealed,campaignResult,
  // helpers and data
  generateMap,makeRandom,nextRandom,sqName,cheb,geo,STATS,STRATEGIES,THEME_TILES,
};
if(typeof module!=='undefined'&&module.exports)module.exports=SemunEngine;
else root.SemunEngine=SemunEngine;
})(typeof globalThis!=='undefined'?globalThis:this);
