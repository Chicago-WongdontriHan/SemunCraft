// ── MOVEMENT HELPERS ─────────────────────────────────────────────────────────

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
    adj8(i).forEach(j=>{const t=pieces[j];if(!t)move.add(j);else if(t.color===p.color){if(t.type==='pawn'||t.type==='knight')merge.add(j);}else attack.add(j);});
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
    mergeRange.forEach(j=>{const t=pieces[j];if(t&&t.color===p.color&&(t.type==='pawn'||t.type==='knight'||t.type==='bishop'))merge.add(j);});
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
    // bishop can merge with adjacent knight (bishop dragged to knight)
    adj8(i).forEach(j=>{
      const t=pieces[j];
      if(t&&t.color===p.color&&t.type==='knight')merge.add(j);
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
    // merge with adjacent friendly rook → siege
    adj8(i).filter(j=>pieces[j]&&pieces[j].color===p.color&&pieces[j].type==='rook').forEach(j=>merge.add(j));
    rookRange(i).filter(j=>pieces[j]&&pieces[j].color===ec).forEach(j=>attack.add(j));
  }else if(p.type==='siege'){
    // siege: CANNOT move, attacks 2 dmg, range 4 piercing
    siegeRange(i).filter(j=>pieces[j]&&pieces[j].color===ec).forEach(j=>attack.add(j));
    // right-click to unsiege (handled in handleRightClick)
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
  return{move,merge,attack,heal};
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
