// ── CONSTANTS ────────────────────────────────────────────────────────────────
let COLS=9,ROWS=9;
const idx    = (r,c)=>r*COLS+c;
const ROW    = i=>Math.floor(i/COLS);
const COL    = i=>i%COLS;
const FILES  = 'abcdefghijkl';
const sqName = i=>FILES[COL(i)]+(ROWS-ROW(i));

// Roaming animals are switched off for now. Map generation still draws the same random numbers
// for them, so maps and enemy strategies are unchanged; nothing is placed and the loop never starts.
const ANIMALS_ON=false;
const sqFrom = s=>{ if(!s||s.length<2)return -1; const c=FILES.indexOf(s[0].toLowerCase()),r=ROWS-parseInt(s.slice(1)); return(r>=0&&r<ROWS&&c>=0&&c<COLS)?idx(r,c):-1; };
const inB    = (r,c)=>r>=0&&r<ROWS&&c>=0&&c<COLS;
const adj8   = i=>{ const r=ROW(i),c=COL(i),res=[]; for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;if(inB(r+dr,c+dc))res.push(idx(r+dr,c+dc));} return res; };
const kJumps = i=>{ const r=ROW(i),c=COL(i),res=[]; [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc])=>{if(inB(r+dr,c+dc))res.push(idx(r+dr,c+dc));}); return res; };
const range2 = i=>{ const r=ROW(i),c=COL(i),res=[]; for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++){if(!dr&&!dc)continue;if(inB(r+dr,c+dc))res.push(idx(r+dr,c+dc));} return res; };
// Siege range: 5 cardinal squares, lobbed clean over everything — obstacles and pieces alike
const siegeRange = i=>{ const r=ROW(i),c=COL(i),res=[];
  [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc])=>{
    for(let s=1;s<=5;s++){
      const nr=r+dr*s,nc=c+dc*s;if(!inB(nr,nc))break;
      const j=idx(nr,nc);if(isTileBlocked(j))continue;
      res.push(j);
    }
  });
  return res; };

// Cardinal range 3 for rook — PIERCING (passes through pieces, blocked only by obstacles)
// Bishop attack range: diagonal sliding up to 2 squares (blocked by obstacles, pierces friendly/enemy)
// scrying: a bishop spends both its mana to light a 3x3 it cannot see, anywhere on the board
const SCRY_TURNS=2;
// how long a merge's own flash (mergeFlash in js/render.js) takes to finish playing, so the turn
// doesn't hand over — and the view with it, in an AI vs AI training match — until it's done
const MERGE_ANIM_MS=700;
const scryBox = i=>{ const r=ROW(i),c=COL(i),res=[];
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
    const nr=r+dr,nc=c+dc;if(inB(nr,nc))res.push(idx(nr,nc));
  }
  return res; };

const bishopRange = i=>{ const r=ROW(i),c=COL(i),res=[];
  [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc])=>{
    for(let s=1;s<=2;s++){
      const nr=r+dr*s,nc=c+dc*s;if(!inB(nr,nc))break;
      const j=idx(nr,nc);if(isTileBlocked(j))break;
      res.push(j);if(pieces[j])break; // piece blocks further sliding
    }
  });
  return res; };

// the Guardian's reach: everywhere its Rook half could hit (piercing, same range as a Rook) plus
// everywhere its Knight half could — the two component ranges simply added together
const guardianRange = i=>[...new Set([...rookRange(i),...kJumps(i)])];
// the straight run of squares between two squares on the same rank or file, attacker's own square
// excluded — this is the path the Guardian's shot travels and damages (guardianPath in js/combat.js
// mirrors this over the engine's own board)
const cardinalPath = (from,to)=>{
  const r0=ROW(from),c0=COL(from),r1=ROW(to),c1=COL(to);
  if(r0!==r1&&c0!==c1)return null;             // not on a straight rank or file: no line to draw
  const dr=Math.sign(r1-r0),dc=Math.sign(c1-c0),res=[];
  let r=r0+dr,c=c0+dc;
  while(inB(r,c)){const j=idx(r,c);res.push(j);if(j===to)break;r+=dr;c+=dc;}
  return res;
};
const rookRange = i=>{ const r=ROW(i),c=COL(i),res=[];
  [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc])=>{
    for(let s=1;s<=3;s++){
      const nr=r+dr*s,nc=c+dc*s;if(!inB(nr,nc))break;
      const j=idx(nr,nc);
      if(isTileBlocked(j))break; // obstacle stops the ray
      res.push(j); // piece in the way does NOT stop the ray
    }
  });
  return res; };

const cheb   = (a,b)=>Math.max(Math.abs(ROW(a)-ROW(b)),Math.abs(COL(a)-COL(b)));

const GLYPH={king_w:'♔',pawn_w:'♙',knight_w:'♘',bishop_w:'♗',rook_w:'♖',queen_w:'♛',siege_w:'🏰',king_b:'♚',pawn_b:'♟',knight_b:'♞',bishop_b:'♝',rook_b:'♜',queen_b:'♛',siege_b:'🏰'};
const STATS={king:{hp:5,maxHp:5},pawn:{hp:1,maxHp:1},knight:{hp:4,maxHp:4},bishop:{hp:2,maxHp:2},rook:{hp:4,maxHp:4},queen:{hp:5,maxHp:5},siege:{hp:4,maxHp:4},mage:{hp:3,maxHp:3},paladin:{hp:4,maxHp:4},guardian:{hp:5,maxHp:5}};
