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
// Siege range: 4 cardinal squares, piercing
const siegeRange = i=>{ const r=ROW(i),c=COL(i),res=[];
  [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc])=>{
    for(let s=1;s<=4;s++){
      const nr=r+dr*s,nc=c+dc*s;if(!inB(nr,nc))break;
      const j=idx(nr,nc);if(isTileBlocked(j))break;
      res.push(j);
    }
  });
  return res; };

// Cardinal range 3 for rook — PIERCING (passes through pieces, blocked only by obstacles)
// Bishop attack range: diagonal sliding up to 2 squares (blocked by obstacles, pierces friendly/enemy)
// scrying: a bishop spends both its mana to light a 3x3 it cannot see, anywhere on the board
const SCRY_TURNS=2;
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
const STATS={king:{hp:5,maxHp:5},pawn:{hp:1,maxHp:1},knight:{hp:4,maxHp:4},bishop:{hp:2,maxHp:2},rook:{hp:4,maxHp:4},queen:{hp:5,maxHp:5},siege:{hp:4,maxHp:4}};
