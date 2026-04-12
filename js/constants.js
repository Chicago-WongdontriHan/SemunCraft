// ── CONSTANTS ────────────────────────────────────────────────────────────────
let COLS=9,ROWS=9;
const idx    = (r,c)=>r*COLS+c;
const ROW    = i=>Math.floor(i/COLS);
const COL    = i=>i%COLS;
const FILES  = 'abcdefghijkl';
const sqName = i=>FILES[COL(i)]+(ROWS-ROW(i));
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

function buildWhiteSiegeSVG(sz){
  return `<svg viewBox="0 0 100 100" width="${sz}" height="${sz}" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="55" width="60" height="35" rx="3" fill="#d0d0e0" stroke="#888" stroke-width="2"/>
    <rect x="20" y="42" width="14" height="18" rx="2" fill="#c8c8d8" stroke="#888" stroke-width="1.5"/>
    <rect x="43" y="42" width="14" height="18" rx="2" fill="#c8c8d8" stroke="#888" stroke-width="1.5"/>
    <rect x="66" y="42" width="14" height="18" rx="2" fill="#c8c8d8" stroke="#888" stroke-width="1.5"/>
    <rect x="18" y="50" width="64" height="6" rx="1" fill="#b0b0c8"/>
    <line x1="32" y1="68" x2="68" y2="88" stroke="#c8a040" stroke-width="4" stroke-linecap="round"/>
    <line x1="68" y1="68" x2="32" y2="88" stroke="#c8a040" stroke-width="4" stroke-linecap="round"/>
    <circle cx="32" cy="68" r="3" fill="#e8c060"/>
    <circle cx="68" cy="68" r="3" fill="#e8c060"/>
    <rect x="22" y="57" width="8" height="20" rx="2" fill="rgba(255,255,255,.18)"/>
  </svg>`;
}
