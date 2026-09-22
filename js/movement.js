// ── MOVEMENT HELPERS ─────────────────────────────────────────────────────────

// The Mage's fire trajectories: from its square, one step orthogonal then two more continuing in the
// same diagonal direction — 8 lines of 3 tiles each (a line that runs off the board is dropped whole).
// mageRange in engine.js mirrors this; sangDamage in js/combat.js is what actually burns a line down.
function sangTrajectories(i){
  const r=ROW(i),c=COL(i),out=[];
  [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc])=>{
    const diagPair=dr!==0?[[dr,-1],[dr,1]]:[[-1,dc],[1,dc]];
    diagPair.forEach(([ddr,ddc])=>{
      const r1=r+dr,c1=c+dc;if(!inB(r1,c1))return;
      const r2=r1+ddr,c2=c1+ddc;if(!inB(r2,c2))return;
      const r3=r2+ddr,c3=c2+ddc;if(!inB(r3,c3))return;
      out.push([idx(r1,c1),idx(r2,c2),idx(r3,c3)]);
    });
  });
  return out;
}
// every tile any of the Mage's trajectories reaches (over pieces and obstacles alike) — used wherever
// something just needs to know "is this within the Mage's strike," not which line it belongs to
function mageRange(i){
  const out=new Set();
  sangTrajectories(i).forEach(line=>line.forEach(j=>out.add(j)));
  return [...out];
}
// the one trajectory out of the Mage's eight that reaches this tile, or null if none does (a tile the
// first step of two branches share picks the first line listed, arbitrarily but the same way every time)
function sangLineFor(i,target){
  return sangTrajectories(i).find(line=>line.includes(target))||null;
}

function queenRange(i){
  const lJumps=new Set(kJumps(i));
  return range2(i).filter(j=>!lJumps.has(j));
}

function isTileBlocked(i){
  const t=tileData[i];if(!t)return false;
  if(t==='sandstone-spawner')return true;
  const th=THEMES[mapTheme];if(!th)return false;
  const info=th.tiles[t];
  return !!(info&&info.block);
}

// Undergrowth (jungle): whatever stands in it is hidden from a side, even a piece right next to it,
// until it fights from there — attacking out of cover, or taking a hit while in it, reveals it from
// that turn on, for as long as it stays on that same square (exposedAt, stamped in applyActions /
// runOrders and stale-checked in turnUpkeep). Moving to a different tile judges it fresh there: hidden
// again if that tile is undergrowth too, plainly visible otherwise. Unlike fog this holds for both
// sides, and with Map Cheat on too.
function inCover(i,color){
  if(tileData[i]!=='undergrowth')return false;
  const p=pieces[i];
  if(p&&p.color===color)return false;
  if(scryLit(i,color))return false;   // a bishop's scry sees into the undergrowth too
  return !(p&&p.exposedAt===i);
}
// an enemy of `color` hidden in undergrowth: it can't be seen, targeted or attacked, though it can attack out
function isConcealedFrom(i,color){
  const p=pieces[i];
  return !!p&&p.color!==color&&inCover(i,color);
}

function pieceSpeed(p){
  if(!p)return 1;
  if(p.type==='bishop')return 2;
  return 1;
}

// ── DRAG DESTINATIONS ────────────────────────────────────────────────────────
function getDragDests(i){
  const p=pieces[i]; if(!p)return{move:new Set(),merge:new Set(),attack:new Set(),heal:new Set()};
  const move=new Set(),merge=new Set(),attack=new Set(),heal=new Set();
  const ec=p.color==='w'?'b':'w';
  if(p.type==='pawn'){
    // a fortified pawn takes part in no merge, either way round: its helmet was paid for
    adj8(i).forEach(j=>{const t=pieces[j];if(!t)move.add(j);else if(t.color===p.color){if(mergeResultType(p,t))merge.add(j);}else attack.add(j);});
    // first move: allow 2-tile forward push (toward enemy king side)
    if(p.firstMove){
      // "forward" = toward the opposite side of the board relative to pawn color
      // white pawns start near the bottom, so forward is -1 row (up)
      // black pawns start near the top, so forward is +1 row (down)
      const fwd=p.color==='w'?-1:1;
      const r1=ROW(i)+fwd,r2=ROW(i)+fwd*2,c=COL(i);
      if(inB(r1,c)&&inB(r2,c)){
        const mid=idx(r1,c),far=idx(r2,c);
        if(!pieces[mid]&&!isTileBlocked(mid)&&!pieces[far]&&!isTileBlocked(far)){
          move.add(far);
        }
      }
    }
  }else if(p.type==='knight'){
    kJumps(i).forEach(j=>{
      if(isTileBlocked(j))return; // cannot land on blocked tile
      const t=pieces[j];
      if(!t)move.add(j);else if(t.color===ec)attack.add(j);
    });
    // merge: adjacent AND L-jump locations (knight teleports to merge without spending turn)
    const mergeRange=new Set([...adj8(i),...kJumps(i)]);
    // knight+rook (Guardian) merges only adjacent, like every other pair — the L-jump reach here is only for pawn/knight/bishop, which teleport to merge without spending the turn
    mergeRange.forEach(j=>{const t=pieces[j];if(t&&t.color===p.color&&t.type!=='rook'&&mergeResultType(p,t))merge.add(j);});
    adj8(i).forEach(j=>{const t=pieces[j];if(t&&t.color===p.color&&t.type==='rook'&&mergeResultType(p,t))merge.add(j);});
  }else if(p.type==='paladin'){
    // an L-jump, exactly like the knight it was — but its strike always finishes the kill, and it
    // steps onto the square that clears (applyActions in js/combat.js); it merges with nothing further
    kJumps(i).forEach(j=>{
      if(isTileBlocked(j))return;
      const t=pieces[j];
      if(!t)move.add(j);else if(t.color===ec)attack.add(j);
    });
  }else if(p.type==='bishop'){
    const hasMana=(p.mana||0)>0;
    // diagonal: up to 2 squares, sliding (blocked by obstacles/pieces)
    [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc])=>{
      for(let s=1;s<=2;s++){
        const nr=ROW(i)+dr*s,nc=COL(i)+dc*s;if(!inB(nr,nc))break;
        const j=idx(nr,nc);
        if(isTileBlocked(j))break;
        const t=pieces[j];
        if(!t)move.add(j);else{if(t.color===ec)attack.add(j);else if(hasMana&&t.color===p.color&&t.hp<t.maxHp)heal.add(j);break;}
      }
    });
    // bishop can merge with adjacent knight (bishop dragged to knight), and with an adjacent rook into a
    // Mage when its side holds the Elixir for it
    adj8(i).forEach(j=>{
      const t=pieces[j];
      if(t&&t.color===p.color&&mergeResultType(p,t))merge.add(j);
    });
  }else if(p.type==='rook'){
    // move: up to 2 steps cardinally, sliding
    [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc])=>{
      for(let s=1;s<=2;s++){
        const nr=ROW(i)+dr*s,nc=COL(i)+dc*s;if(!inB(nr,nc))break;
        const j=idx(nr,nc);if(isTileBlocked(j))break;
        const t=pieces[j];if(!t)move.add(j);else break;
      }
    });
    // merge with adjacent friendly rook → siege, or with an adjacent bishop → Mage (for its Elixir)
    adj8(i).filter(j=>pieces[j]&&pieces[j].color===p.color&&mergeResultType(p,pieces[j])).forEach(j=>merge.add(j));
    rookRange(i).filter(j=>pieces[j]&&pieces[j].color===ec).forEach(j=>attack.add(j));
  }else if(p.type==='guardian'){
    // move: up to 2 steps cardinally, sliding, exactly like a Rook
    [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc])=>{
      for(let s=1;s<=2;s++){
        const nr=ROW(i)+dr*s,nc=COL(i)+dc*s;if(!inB(nr,nc))break;
        const j=idx(nr,nc);if(isTileBlocked(j))break;
        const t=pieces[j];if(!t)move.add(j);else break;
      }
    });
    // attack: anywhere either a Rook or a Knight could reach from here — the union guardianRange draws
    guardianRange(i).filter(j=>pieces[j]&&pieces[j].color===ec).forEach(j=>attack.add(j));
  }else if(p.type==='siege'){
    // siege: CANNOT move, attacks 2 dmg, range 4 piercing
    siegeRange(i).filter(j=>pieces[j]&&pieces[j].color===ec).forEach(j=>attack.add(j));
    // right-click to unsiege (handled in handleRightClick)
  }else if(p.type==='mage'){
    // the Mage moves like a bishop, up to 2 diagonally (sliding, blocked by pieces and obstacles), and
    // strikes any enemy within 3 — over pieces and obstacles; it merges with nothing
    [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc])=>{
      for(let s=1;s<=2;s++){
        const nr=ROW(i)+dr*s,nc=COL(i)+dc*s;if(!inB(nr,nc))break;
        const j=idx(nr,nc);if(isTileBlocked(j))break;
        if(!pieces[j])move.add(j);else break;
      }
    });
    // attackable: any tile on one of its lines that holds an enemy, on whichever line it falls on
    sangTrajectories(i).forEach(line=>line.forEach(j=>{if(pieces[j]&&pieces[j].color===ec)attack.add(j);}));
  }else if(p.type==='queen'){
    // queen moves up to 2 in any direction (sliding, blocked by pieces+obstacles)
    [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc])=>{
      for(let s=1;s<=2;s++){
        const nr=ROW(i)+dr*s,nc=COL(i)+dc*s;if(!inB(nr,nc))break;
        const j=idx(nr,nc);if(isTileBlocked(j))break;
        const t=pieces[j];if(!t)move.add(j);else break;
      }
    });
    // attack: same range as its auto-attack (2 squares in any of the 8 directions, not blocked)
    queenRange(i).filter(j=>pieces[j]&&pieces[j].color===ec).forEach(j=>attack.add(j));
  }else if(p.type==='king'){
    adj8(i).forEach(j=>{
      const t=pieces[j];
      if(!t&&!isTileBlocked(j))move.add(j);
      else if(t&&t.color===ec)attack.add(j);
      // king can also attack adjacent neutral animals
      else if(!t&&animals.some(na=>{
        const ar=Math.round(na.y-0.5),ac=Math.round(na.x-0.5);
        return inB(ar,ac)&&idx(ar,ac)===j;
      }))attack.add(j);
    });
  }
  // remove blocked tiles from move destinations
  for(const j of [...move]){if(isTileBlocked(j)||neutralPieces[j+''])move.delete(j);}
  // fog of war: can't attack or heal targets on non-visible tiles (applies to the local player's pieces only)
  if(p.color===myColor()&&!mapCheat){
    for(const j of [...attack]){if(!isTileVisible(j))attack.delete(j);}
    for(const j of [...heal]){if(!isTileVisible(j))heal.delete(j);}
  }
  // undergrowth: an enemy hidden in cover can't be attacked (for both sides) — except by a delayed
  // order arriving on its very square, which discovers it regardless; rawAttack keeps those in
  // (runOrders in js/game.js), while attack itself stays filtered for everything else
  const rawAttack=new Set(attack);
  for(const j of [...attack]){if(isConcealedFrom(j,p.color))attack.delete(j);}
  return{move,merge,attack,heal,rawAttack};
}

// ── MOVE ORDERS ──────────────────────────────────────────────────────────────
// Simple path: step from `from` toward `to` avoiding own pieces (1 step)

function stepToward(from,to,color){
  if(from===to)return -1;
  const visited=new Set([from]);
  const queue=[[from,[]]];
  while(queue.length){
    const[cur,path]=queue.shift();
    const neighbors=adj8(cur);
    for(const n of neighbors){
      if(visited.has(n))continue;
      visited.add(n);
      if(isTileBlocked(n)&&n!==to)continue; // can't pass through obstacles
      if(neutralPieces[n+'']&&n!==to)continue; // blocked by neutral animal
      const p=pieces[n];
      if(p&&p.color===color&&n!==to)continue;
      const newPath=[...path,n];
      if(n===to)return newPath[0];
      queue.push([n,newPath]);
    }
  }
  return -1;
}

// BFS step toward target using only cardinal directions (for rooks)
function stepTowardCardinal(from,to,color){
  if(from===to)return -1;
  const visited=new Set([from]);
  const queue=[[from,[]]];
  const dirs=[[-1,0],[1,0],[0,-1],[0,1]];
  while(queue.length){
    const[cur,path]=queue.shift();
    const r=ROW(cur),c=COL(cur);
    for(const [dr,dc] of dirs){
      const nr=r+dr,nc=c+dc;if(!inB(nr,nc))continue;
      const n=idx(nr,nc);
      if(visited.has(n))continue;
      visited.add(n);
      if(isTileBlocked(n)&&n!==to)continue;
      if(neutralPieces[n+'']&&n!==to)continue;
      const p=pieces[n];
      if(p&&p.color===color&&n!==to)continue;
      const newPath=[...path,n];
      if(n===to)return newPath[0];
      queue.push([n,newPath]);
    }
  }
  return -1;
}

// BFS step toward target using only diagonal directions (for bishops)
function stepTowardDiagonal(from,to,color){
  if(from===to)return -1;
  const visited=new Set([from]);
  const queue=[[from,[]]];
  const dirs=[[-1,-1],[-1,1],[1,-1],[1,1]];
  while(queue.length){
    const[cur,path]=queue.shift();
    const r=ROW(cur),c=COL(cur);
    for(const [dr,dc] of dirs){
      const nr=r+dr,nc=c+dc;if(!inB(nr,nc))continue;
      const n=idx(nr,nc);
      if(visited.has(n))continue;
      visited.add(n);
      if(isTileBlocked(n)&&n!==to)continue;
      if(neutralPieces[n+'']&&n!==to)continue;
      const p=pieces[n];
      if(p&&p.color===color&&n!==to)continue;
      const newPath=[...path,n];
      if(n===to)return newPath[0];
      queue.push([n,newPath]);
    }
  }
  return -1;
}

function getPath(from,to,color){
  if(from===to)return[];
  const visited=new Set([from]);
  const queue=[[from,[]]];
  while(queue.length){
    const[cur,path]=queue.shift();
    const neighbors=adj8(cur);
    for(const n of neighbors){
      if(visited.has(n))continue;
      visited.add(n);
      if(isTileBlocked(n)&&n!==to)continue;
      if(neutralPieces[n+'']&&n!==to)continue;
      const p=pieces[n];
      if(p&&p.color===color&&n!==to)continue;
      const newPath=[...path,n];
      if(n===to)return newPath;
      if(newPath.length<ROWS*COLS)queue.push([n,newPath]);
    }
  }
  return[];
}
