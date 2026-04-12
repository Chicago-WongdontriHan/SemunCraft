// ── AI ────────────────────────────────────────────────────────────────────────
function pickStrategy(){
  if(difficulty==='easy'){ aiStrategy='easy_rook_rush'; addLog('Enemy: rook rush'); return; }
  aiStrategy=STRATEGIES[Math.floor(Math.random()*STRATEGIES.length)];
  addLog('Enemy: '+aiStrategy.replace(/_/g,' '));
}

function bPieces(){const r={pawns:[],knights:[],bishops:[],rooks:[],queens:[]};for(let i=0;i<ROWS*COLS;i++){const p=pieces[i];if(!p||p.color!=='b')continue;if(p.type==='pawn')r.pawns.push(i);if(p.type==='knight')r.knights.push(i);if(p.type==='bishop')r.bishops.push(i);if(p.type==='rook')r.rooks.push(i);if(p.type==='queen')r.queens.push(i);}return r;}

function bSpawn(bKi,cands,count){
  if(!cands.length)return false;
  const rem=blackSpawnRemaining();
  if(rem<=0)return false;
  const wKi=pieces.findIndex(p=>p&&p.color==='w'&&p.type==='king');
  const n=Math.min(count||1,cands.length,rem);
  const sorted=wKi>=0?[...cands].sort((a,b)=>cheb(a,wKi)-cheb(b,wKi)):cands;
  for(let k=0;k<n;k++){
    pieces[sorted[k]]={type:'pawn',color:'b',hp:STATS.pawn.hp,maxHp:STATS.pawn.maxHp,firstMove:true};
    blackSpawnHistory.push(blackTurnCount);
  }
  addLog('Black spawns '+n+'x pawn ('+blackSpawnRemaining()+' left)');
  render();
  for(let k=0;k<n;k++) spawnFlash(sorted[k]);
  finishBlackTurn();return true;
}

function bAdvance(typeFilter){const wKi=pieces.findIndex(p=>p&&p.color==='w'&&p.type==='king');if(wKi<0){finishBlackTurn();return;}const mp=[];for(let i=0;i<ROWS*COLS;i++){const p=pieces[i];if(p&&p.color==='b'&&(typeFilter?typeFilter.includes(p.type):p.type!=='king'))mp.push(i);}if(!mp.length){finishBlackTurn();return;}const ar=mp.reduce((s,i)=>s+ROW(i),0)/mp.length,ac=mp.reduce((s,i)=>s+COL(i),0)/mp.length;const dr=ROW(wKi)>ar?1:ROW(wKi)<ar?-1:0,dc=COL(wKi)>ac?1:COL(wKi)<ac?-1:0;const dn={'-10':'N','10':'S','01':'E','0-1':'W','-11':'NE','-1-1':'NW','11':'SE','1-1':'SW'}[dr+''+dc]||'S';bMoveAll(dn);}

function bMergeQueen(limit){
  if(campaignLevel&&campaignLevel.noMerge)return false;
  const bp=bPieces();
  if(bp.queens&&bp.queens.length>=limit)return false;
  for(const k of bp.knights)for(const b of bp.bishops){
    if(k===b)continue;
    if(adj8(k).includes(b)){
      const nq={type:'queen',color:'b',hp:STATS.queen.hp,maxHp:STATS.queen.maxHp};
      pieces[k]=null;pieces[b]=nq;addLog('Black merges->queen');render();mergeFlash(b);finishBlackTurn();return true;
    }
  }
  return false;
}

function bMerge(ft,tt,rt,limit){if(campaignLevel&&campaignLevel.noMerge)return false;const bp=bPieces();const pool={pawn:bp.pawns,knight:bp.knights,bishop:bp.bishops,rook:bp.rooks};const cur={knight:bp.knights.length,bishop:bp.bishops.length,rook:bp.rooks.length};if(cur[rt]!==undefined&&cur[rt]>=limit)return false;for(const a of(pool[ft]||[]))for(const b of(pool[tt]||[])){if(a===b)continue;if(adj8(a).includes(b)){const nb3={type:rt,color:'b',hp:STATS[rt].hp,maxHp:STATS[rt].maxHp};if(rt==='bishop')nb3.mana=1;pieces[a]=null;pieces[b]=nb3;addLog('Black merges->'+rt);render();mergeFlash(b);finishBlackTurn();return true;}}return false;}

function bMoveAll(dirStr){
  const M={N:[-1,0],S:[1,0],E:[0,1],W:[0,-1],NE:[-1,1],NW:[-1,-1],SE:[1,1],SW:[1,-1]};
  const[dr,dc]=M[dirStr]||[1,0];
  const wKi=pieces.findIndex(p=>p&&p.color==='w'&&p.type==='king');
  const all=[];
  for(let i=0;i<ROWS*COLS;i++){const p=pieces[i];if(p&&p.color==='b'&&(p.type==='pawn'||p.type==='knight'))all.push(i);}
  // sort: farthest from white king first (coordinated arrival)
  if(wKi>=0)all.sort((a,b)=>cheb(b,wKi)-cheb(a,wKi));
  else all.sort((a,b)=>dr>0?b-a:dr<0?a-b:dc>0?b-a:a-b);

  // move only ONE piece
  for(const from of all){
    if(!pieces[from])continue;
    const p=pieces[from];
    let dest=-1;
    if(p.type==='pawn'){
      const nr=ROW(from)+dr,nc=COL(from)+dc;
      if(inB(nr,nc)&&!pieces[idx(nr,nc)]&&!isTileBlocked(idx(nr,nc))){
        dest=idx(nr,nc);
      }else if(wKi>=0){
        dest=stepToward(from,wKi,'b');
      }
      if(dest>=0&&(pieces[dest]||isTileBlocked(dest)))dest=-1;
    }else if(p.type==='knight'){
      const dests=kJumps(from).filter(j=>!pieces[j]&&!isTileBlocked(j));
      if(dests.length){
        const target=wKi>=0?wKi:from;
        dest=dests.reduce((a,b)=>cheb(a,target)<cheb(b,target)?a:b);
      }
    }
    if(dest>=0){
      if(p.type==='pawn')p.firstMove=false;
      pieces[dest]=p;pieces[from]=null;
      addLog('Black advances');
      blackLastFrom=from;blackLastTo=dest;
      render();
      animatePieceMove(from,dest,p.type,'b',true,()=>{},p.type==='knight'?260:180);
      setTimeout(()=>finishBlackTurn(),260);
      return;
    }
  }
  render();finishBlackTurn();
}

function strategy_pawn_troops(bKi,cands,bp){if(bp.pawns.length<6&&cands.length){if(bSpawn(bKi,cands))return;}bAdvance(['pawn']);}
function strategy_knight_attack(bKi,cands,bp){if(bMerge('pawn','pawn','knight',3))return;if(bp.pawns.length<4&&cands.length){if(bSpawn(bKi,cands))return;}bAdvance(['knight','pawn']);}
function strategy_pawn_knight(bKi,cands,bp){if(bp.pawns.length>=2&&bMerge('pawn','pawn','knight',2))return;if(bp.pawns.length<4&&cands.length){if(bSpawn(bKi,cands))return;}bAdvance(['pawn','knight']);}
function strategy_bishop_pawn(bKi,cands,bp){if(bMerge('pawn','knight','bishop',2))return;if(bMerge('pawn','pawn','knight',2))return;if(bp.pawns.length<4&&cands.length){if(bSpawn(bKi,cands))return;}bAdvance(['bishop','pawn']);}
function strategy_rook_pawn(bKi,cands,bp){if(bMergeQueen(1))return;if(bMerge('knight','knight','rook',1))return;if(bMerge('pawn','knight','bishop',1))return;if(bMerge('pawn','pawn','knight',2))return;if(bp.pawns.length<5&&cands.length){if(bSpawn(bKi,cands))return;}bAdvance(['rook','bishop','pawn']);}

function strategy_easy_rook_rush(bKi,cands,bp){
  if(bp.rooks.length===0&&bp.bishops.length===0&&bp.knights.length===0){
    if(bp.pawns.length<2&&cands.length){if(bSpawn(bKi,cands))return;}
    if(bMerge('pawn','pawn','knight',1))return;
    bAdvance(['pawn']);return;
  }
  if(bp.rooks.length===0&&bp.knights.length<2){
    if(bp.pawns.length<2&&cands.length){if(bSpawn(bKi,cands))return;}
    if(bMerge('pawn','pawn','knight',2))return;
    if(bp.pawns.length<2&&cands.length){if(bSpawn(bKi,cands))return;}
    bAdvance(['knight','pawn']);return;
  }
  if(bp.rooks.length===0){
    if(bMerge('knight','knight','rook',1))return;
    bAdvance(['knight','pawn']);return;
  }
  bAdvance(['rook','pawn','knight']);
}

// estimate how many turns a piece needs to reach the white king
function turnsToReach(bi,wKi){
  const p=pieces[bi];if(!p)return 99;
  const dist=cheb(bi,wKi);
  // movement per turn: pawn=1, knight~2 (L-jump covers ~2 chebyshev), bishop=2, rook=2, queen=2
  if(p.type==='pawn')return dist;
  if(p.type==='knight')return Math.ceil(dist/2);
  if(p.type==='bishop')return Math.ceil(dist/2);
  if(p.type==='rook')return Math.ceil(dist/2);
  if(p.type==='queen')return Math.ceil(dist/2);
  if(p.type==='siege')return 99; // can't move
  return dist;
}

function movePieceToward(bi,wKi){
  const lp=pieces[bi];if(!lp)return null;
  const dr=ROW(wKi)>ROW(bi)?1:ROW(wKi)<ROW(bi)?-1:0;
  const dc=COL(wKi)>COL(bi)?1:COL(wKi)<COL(bi)?-1:0;
  let dest=-1;

  if(lp.type==='pawn'){
    const nr=ROW(bi)+dr,nc=COL(bi)+dc;
    if(inB(nr,nc)&&!pieces[idx(nr,nc)]&&!isTileBlocked(idx(nr,nc))) dest=idx(nr,nc);
    else dest=stepToward(bi,wKi,'b');
    if(dest>=0&&(pieces[dest]||isTileBlocked(dest)))dest=-1;
  }else if(lp.type==='knight'){
    const dests=kJumps(bi).filter(j=>!pieces[j]&&!isTileBlocked(j));
    if(dests.length) dest=dests.reduce((a,b)=>cheb(a,wKi)<cheb(b,wKi)?a:b);
  }else if(lp.type==='bishop'||lp.type==='queen'||lp.type==='rook'){
    const maxS=2;
    const dirs=lp.type==='rook'?[[dr,0],[0,dc],[-dr,0],[0,-dc]].filter(([a,b])=>a||b)
      :lp.type==='bishop'?[[dr,dc],[dr,-dc],[-dr,dc],[-dr,-dc]].filter(([a,b])=>a&&b)
      :[[dr,dc],[dr,0],[0,dc],[dr,-dc],[-dr,dc],[-dr,0],[0,-dc],[-dr,-dc]].filter(([a,b])=>a||b);
    // deduplicate
    const seen=new Set();const udirs=[];
    dirs.forEach(([a,b])=>{const k=a+','+b;if(!seen.has(k)){seen.add(k);udirs.push([a,b]);}});
    for(const [ddr,ddc] of udirs){
      for(let s=maxS;s>=1;s--){
        const nr=ROW(bi)+ddr*s,nc=COL(bi)+ddc*s;
        if(!inB(nr,nc))continue;
        const ti=idx(nr,nc);if(isTileBlocked(ti))break;
        if(s===2){const mid=idx(ROW(bi)+ddr,COL(bi)+ddc);if(isTileBlocked(mid)||pieces[mid])break;}
        if(!pieces[ti]&&cheb(ti,wKi)<cheb(bi,wKi)){dest=ti;break;}
      }
      if(dest>=0)break;
    }
    if(dest<0){
      // piece-type-specific BFS fallback so rooks don't move diagonally and bishops don't move cardinally
      const det=lp.type==='rook'?stepTowardCardinal(bi,wKi,'b')
        :lp.type==='bishop'?stepTowardDiagonal(bi,wKi,'b')
        :stepToward(bi,wKi,'b');
      // only accept the fallback if it strictly improves distance (prevents oscillation)
      if(det>=0&&!pieces[det]&&!isTileBlocked(det)&&cheb(det,wKi)<cheb(bi,wKi))dest=det;
    }
  }
  if(dest>=0){
    if(lp.type==='pawn')lp.firstMove=false;
    pieces[dest]=lp;pieces[bi]=null;
    return{f:bi,t:dest,type:lp.type};
  }
  return null;
}

function hardTacticalAI(bKi,cands,bp){
  const wKi=pieces.findIndex(p=>p&&p.color==='w'&&p.type==='king');
  // 1. try merges first
  if(bMergeQueen(1))return;
  if(bMerge('knight','knight','rook',1))return;
  if(bMerge('pawn','knight','bishop',2))return;
  if(bMerge('pawn','pawn','knight',3))return;
  // 2. spawn if low on pieces
  const total=bp.pawns.length+bp.knights.length+bp.bishops.length+bp.rooks.length;
  if(cands.length>=2&&bp.pawns.length<3&&Math.random()<0.4){if(bSpawn(bKi,cands,2))return;}
  if(total<5&&cands.length){if(bSpawn(bKi,cands))return;}
  // 3. coordinated wave: move pieces so they arrive at the white king at the same time
  if(wKi<0){bAdvance(null);return;}
  const allB=[];
  for(let i=0;i<ROWS*COLS;i++){const p=pieces[i];if(p&&p.color==='b'&&p.type!=='king'&&p.type!=='siege'&&!blackActed.has(i))allB.push(i);}
  if(!allB.length){bAdvance(null);return;}

  // estimate arrival turns for each piece
  const arrivals=allB.map(bi=>({bi,turns:turnsToReach(bi,wKi)}));
  const maxTurns=Math.max(...arrivals.map(a=>a.turns));

  // pieces that should move this turn: those whose arrival is >= others
  // i.e., farther pieces move now, closer pieces wait (unless they'd arrive late)
  // A piece should move if: (turnsToReach - 1) still allows it to arrive by maxTurns
  // Simpler: move pieces that need the most turns, hold back pieces that are already close
  // "should move" = turns remaining > 1 (not yet adjacent/in range), OR all pieces are close
  const allClose=arrivals.every(a=>a.turns<=1);

  const toMove=arrivals.filter(a=>{
    if(allClose)return true; // everyone close — all attack
    // move if this piece is among the farther ones (turns >= median)
    // OR if it's already in attack range (auto-attack handles damage, just position)
    const inRange=(pieces[a.bi].type==='queen'?queenRange(a.bi):pieces[a.bi].type==='rook'?rookRange(a.bi):pieces[a.bi].type==='knight'?kJumps(a.bi):pieces[a.bi].type==='bishop'?bishopRange(a.bi):adj8(a.bi))
      .some(j=>pieces[j]&&pieces[j].color==='w');
    if(inRange)return false; // already in range — hold position, auto-attack fires
    if(a.turns<=1)return false; // close enough — wait for others to catch up
    return true;
  });

  // if nobody qualifies (all holding), move everyone
  const moveList=toMove.length>0?toMove:arrivals;

  // sort by distance descending — farthest piece moves first
  moveList.sort((a,b)=>b.turns-a.turns);

  // move only ONE piece (the highest priority)
  for(const {bi} of moveList){
    if(!pieces[bi])continue;
    const result=movePieceToward(bi,wKi);
    if(result){
      addLog('Black advances');
      blackLastFrom=result.f;blackLastTo=result.t;
      render();
      animatePieceMove(result.f,result.t,result.type,'b',true,()=>{},result.type==='knight'?260:180);
      setTimeout(()=>finishBlackTurn(),280);
      return;
    }
  }
  // no piece could move — fallback
  bAdvance(null);
}

// ── REACTIVE AI: respond to being hit ─────────────────────────────────────────
// Returns true if it handled the turn, false if normal strategy should proceed.
function reactiveAI(){
  if(!blackHitBy.length)return false;
  // pick the first hit that the victim survived
  for(const {target,attacker} of blackHitBy){
    const victim=pieces[target];
    const attackerP=pieces[attacker];
    if(!victim||victim.color!=='b'||!attackerP||attackerP.color!=='w')continue;
    // check if victim can already attack the attacker from current position (auto-attack handles it)
    const vRange=victim.type==='queen'?queenRange(target):victim.type==='siege'?siegeRange(target):victim.type==='rook'?rookRange(target):victim.type==='knight'?kJumps(target):victim.type==='bishop'?bishopRange(target):adj8(target);
    if(vRange.includes(attacker))continue; // auto-attack will handle it, no need to react

    // decide: counter-attack or flee? If attacker has lower HP, prefer attack
    const preferAttack=attackerP.hp<=victim.hp||Math.random()<0.4;

    if(preferAttack){
      // find any black piece that can move into range of the attacker
      const allB=[];for(let i=0;i<ROWS*COLS;i++){if(pieces[i]&&pieces[i].color==='b'&&pieces[i].type!=='king'&&pieces[i].type!=='siege')allB.push(i);}
      for(const bi of allB){
        const bp=pieces[bi];
        if(bp.type==='knight'){
          // knight: jump to a tile where attacker is in L-range
          const jumps=kJumps(bi).filter(j=>!pieces[j]&&!isTileBlocked(j));
          const good=jumps.find(j=>kJumps(j).includes(attacker));
          if(good!==undefined){
            pieces[good]=bp;pieces[bi]=null;
            addLog('Black counter-attacks!');blackLastFrom=bi;blackLastTo=good;
            render();animatePieceMove(bi,good,bp.type,'b',true,()=>{},260);
            setTimeout(()=>finishBlackTurn(),280);return true;
          }
        }else if(bp.type==='pawn'){
          // pawn: step adjacent to attacker
          const step=adj8(bi).find(j=>!pieces[j]&&!isTileBlocked(j)&&adj8(j).includes(attacker));
          if(step!==undefined){
            bp.firstMove=false;
            pieces[step]=bp;pieces[bi]=null;
            addLog('Black counter-attacks!');blackLastFrom=bi;blackLastTo=step;
            render();animatePieceMove(bi,step,bp.type,'b',true,()=>{},180);
            setTimeout(()=>finishBlackTurn(),200);return true;
          }
        }else if(bp.type==='rook'||bp.type==='bishop'||bp.type==='queen'){
          // sliding pieces: move toward attacker via BFS, check if new position puts attacker in range
          const dest=bp.type==='rook'?stepTowardCardinal(bi,attacker,'b')
            :bp.type==='bishop'?stepTowardDiagonal(bi,attacker,'b')
            :stepToward(bi,attacker,'b');
          if(dest>=0&&!pieces[dest]&&!isTileBlocked(dest)){
            const newRange=bp.type==='queen'?queenRange(dest):bp.type==='rook'?rookRange(dest):bishopRange(dest);
            if(newRange.includes(attacker)){
              pieces[dest]=bp;pieces[bi]=null;
              addLog('Black counter-attacks!');blackLastFrom=bi;blackLastTo=dest;
              render();animatePieceMove(bi,dest,bp.type,'b',true,()=>{},180);
              setTimeout(()=>finishBlackTurn(),200);return true;
            }
          }
        }
      }
    }

    // flee: move the victim away from the attacker using its legal movement rules
    if(victim.type==='siege')continue; // siege can't move
    let fleeDir=[];
    if(victim.type==='knight'){
      // knights only move via L-jump
      fleeDir=kJumps(target).filter(j=>!pieces[j]&&!isTileBlocked(j));
    }else if(victim.type==='rook'){
      // rooks slide up to 2 cardinally
      [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc])=>{
        for(let s=1;s<=2;s++){
          const nr=ROW(target)+dr*s,nc=COL(target)+dc*s;if(!inB(nr,nc))break;
          const ti=idx(nr,nc);if(isTileBlocked(ti)||pieces[ti])break;
          fleeDir.push(ti);
        }
      });
    }else if(victim.type==='bishop'){
      // bishops slide up to 2 diagonally only
      [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc])=>{
        for(let s=1;s<=2;s++){
          const nr=ROW(target)+dr*s,nc=COL(target)+dc*s;if(!inB(nr,nc))break;
          const ti=idx(nr,nc);if(isTileBlocked(ti)||pieces[ti])break;
          fleeDir.push(ti);
        }
      });
    }else if(victim.type==='queen'){
      // queens slide up to 2 in any of 8 directions
      [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc])=>{
        for(let s=1;s<=2;s++){
          const nr=ROW(target)+dr*s,nc=COL(target)+dc*s;if(!inB(nr,nc))break;
          const ti=idx(nr,nc);if(isTileBlocked(ti)||pieces[ti])break;
          fleeDir.push(ti);
        }
      });
    }else{
      // pawn, king: 1-step in any adjacent direction
      fleeDir=adj8(target).filter(j=>!pieces[j]&&!isTileBlocked(j));
    }
    if(fleeDir.length){
      // pick the tile farthest from the attacker
      const best=fleeDir.reduce((a,b)=>cheb(b,attacker)>cheb(a,attacker)?b:a);
      if(victim.type==='pawn')victim.firstMove=false;
      pieces[best]=victim;pieces[target]=null;
      addLog('Black flees!');blackLastFrom=target;blackLastTo=best;
      render();animatePieceMove(target,best,victim.type,'b',true,()=>{},victim.type==='knight'?260:180);
      setTimeout(()=>finishBlackTurn(),victim.type==='knight'?280:200);return true;
    }
  }
  return false;
}

function campaignAI(){
  // campaign AI: no spawning, move pieces toward nearest white piece
  if(reactiveAI())return;
  // find nearest white piece as target for each black piece
  // exclude pieces that already auto-attacked this turn
  const allB=[];
  for(let i=0;i<ROWS*COLS;i++){if(pieces[i]&&pieces[i].color==='b'&&pieces[i].type!=='siege'&&!blackActed.has(i))allB.push(i);}
  if(!allB.length){finishBlackTurn();return;}

  // prioritize the white king as the strategic target (win condition in king levels)
  const wKi=pieces.findIndex(p=>p&&p.color==='w'&&p.type==='king');
  let target=wKi;
  if(target<0){
    // no king — find nearest white piece as fallback
    let bestDist=999;
    for(const bi of allB){
      for(let j=0;j<ROWS*COLS;j++){
        if(!pieces[j]||pieces[j].color!=='w')continue;
        const d=cheb(bi,j);if(d<bestDist){bestDist=d;target=j;}
      }
    }
  }
  if(target<0){finishBlackTurn();return;}

  // check which black pieces are threatened (white piece can attack them next turn)
  function isThreatened(bi){
    for(let j=0;j<ROWS*COLS;j++){
      const wp=pieces[j];if(!wp||wp.color!=='w')continue;
      // check if white piece at j can reach bi in one move+attack
      if(wp.type==='pawn'&&adj8(j).includes(bi))return j;
      if(wp.type==='knight'&&kJumps(j).includes(bi))return j;
      if(wp.type==='bishop'&&bishopRange(j).includes(bi))return j;
      if(wp.type==='rook'&&rookRange(j).includes(bi))return j;
      if(wp.type==='queen'&&queenRange(j).includes(bi))return j;
      if(wp.type==='king'&&adj8(j).includes(bi))return j;
    }
    return -1;
  }

  // priority 1: move threatened pieces — either to attack the threat or flee
  for(const bi of allB){
    if(!pieces[bi])continue;
    const threatBy=isThreatened(bi);
    if(threatBy<0)continue;
    const p=pieces[bi];
    const range=p.type==='queen'?queenRange(bi):p.type==='rook'?rookRange(bi):p.type==='knight'?kJumps(bi):p.type==='bishop'?bishopRange(bi):adj8(bi);
    const canAttackThreat=range.includes(threatBy);
    if(canAttackThreat)continue; // auto-attack will fire at the threat, hold position

    // try to move to a position where we CAN attack the threat
    const result=movePieceToward(bi,threatBy);
    if(result){
      const newRange=p.type==='queen'?queenRange(result.t):p.type==='rook'?rookRange(result.t):p.type==='knight'?kJumps(result.t):p.type==='bishop'?bishopRange(result.t):adj8(result.t);
      if(newRange.includes(threatBy)){
        addLog('Black counter-positions');blackLastFrom=result.f;blackLastTo=result.t;
        render();animatePieceMove(result.f,result.t,result.type,'b',true,()=>{},result.type==='knight'?260:180);
        setTimeout(()=>finishBlackTurn(),280);return;
      }
      // move didn't help — undo and try flee instead
      pieces[bi]=p;pieces[result.t]=null;
    }
    // flee: move away from the threat to a safe tile (use piece's legal moves)
    let fleeDirs=[];
    if(p.type==='knight'){
      fleeDirs=kJumps(bi).filter(j=>!pieces[j]&&!isTileBlocked(j));
    }else if(p.type==='bishop'){
      // diagonal slide up to 2
      [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc])=>{
        for(let s=1;s<=2;s++){
          const nr=ROW(bi)+dr*s,nc=COL(bi)+dc*s;if(!inB(nr,nc))break;
          const ti=idx(nr,nc);if(isTileBlocked(ti))break;
          if(pieces[ti])break;
          fleeDirs.push(ti);
        }
      });
    }else if(p.type==='rook'){
      [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc])=>{
        for(let s=1;s<=2;s++){
          const nr=ROW(bi)+dr*s,nc=COL(bi)+dc*s;if(!inB(nr,nc))break;
          const ti=idx(nr,nc);if(isTileBlocked(ti))break;
          if(pieces[ti])break;
          fleeDirs.push(ti);
        }
      });
    }else if(p.type==='queen'){
      [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc])=>{
        for(let s=1;s<=2;s++){
          const nr=ROW(bi)+dr*s,nc=COL(bi)+dc*s;if(!inB(nr,nc))break;
          const ti=idx(nr,nc);if(isTileBlocked(ti))break;
          if(pieces[ti])break;
          fleeDirs.push(ti);
        }
      });
    }else{
      // pawn, king
      fleeDirs=adj8(bi).filter(j=>!pieces[j]&&!isTileBlocked(j));
    }
    if(fleeDirs.length){
      // pick tile farthest from threat, prefer tiles where we can still attack
      const safeTiles=fleeDirs.filter(j=>isThreatened(j)<0);
      const fleeTarget=safeTiles.length?safeTiles.reduce((a,b)=>cheb(b,threatBy)>cheb(a,threatBy)?b:a):fleeDirs.reduce((a,b)=>cheb(b,threatBy)>cheb(a,threatBy)?b:a);
      pieces[fleeTarget]=p;pieces[bi]=null;
      addLog('Black retreats');blackLastFrom=bi;blackLastTo=fleeTarget;
      render();animatePieceMove(bi,fleeTarget,p.type,'b',true,()=>{},p.type==='knight'?260:180);
      setTimeout(()=>finishBlackTurn(),200);return;
    }
  }

  // priority 2: pick the BEST move — simulate each candidate (undoing after) and pick
  // the one that gets closest to the target, preferring pieces not already in attack range
  let bestMove=null, bestScore=Infinity;
  for(const bi of allB){
    if(!pieces[bi])continue;
    const p=pieces[bi];
    const range=p.type==='queen'?queenRange(bi):p.type==='rook'?rookRange(bi):p.type==='knight'?kJumps(bi):p.type==='bishop'?bishopRange(bi):adj8(bi);
    const inRange=range.some(j=>pieces[j]&&pieces[j].color==='w');
    if(inRange)continue; // already attacking, hold position
    const savedPiece=pieces[bi];
    const savedFirstMove=savedPiece.firstMove;
    const result=movePieceToward(bi,target);
    if(result){
      const newDist=cheb(result.t,target);
      if(newDist<bestScore){
        bestMove={f:result.f,t:result.t,type:result.type};
        bestScore=newDist;
      }
      // always undo so we can try other pieces with clean state
      pieces[result.f]=savedPiece;
      pieces[result.t]=null;
      if(savedFirstMove)savedPiece.firstMove=true;
    }
  }
  if(bestMove){
    // execute the chosen move
    const mp=pieces[bestMove.f];
    if(mp&&mp.type==='pawn')mp.firstMove=false;
    pieces[bestMove.t]=mp;pieces[bestMove.f]=null;
    addLog('Black advances');blackLastFrom=bestMove.f;blackLastTo=bestMove.t;
    render();animatePieceMove(bestMove.f,bestMove.t,bestMove.type,'b',true,()=>{},bestMove.type==='knight'?260:180);
    setTimeout(()=>finishBlackTurn(),280);return;
  }

  // fallback: try moving any piece using its legal movement rules
  for(const bi of allB){
    if(!pieces[bi])continue;
    const p=pieces[bi];
    let dest=-1;
    if(p.type==='knight'){
      // knight: pick any legal L-jump that gets closer to target
      const jumps=kJumps(bi).filter(j=>!pieces[j]&&!isTileBlocked(j));
      if(jumps.length)dest=jumps.reduce((a,b)=>cheb(a,target)<cheb(b,target)?a:b);
    }else{
      // other pieces: try movePieceToward, fallback to BFS adjacent step
      const result=movePieceToward(bi,target);
      if(result){
        addLog('Black moves');blackLastFrom=result.f;blackLastTo=result.t;
        render();animatePieceMove(result.f,result.t,result.type,'b',true,()=>{},result.type==='knight'?260:180);
        setTimeout(()=>finishBlackTurn(),280);return;
      }
      const step=p.type==='rook'?stepTowardCardinal(bi,target,'b')
        :p.type==='bishop'?stepTowardDiagonal(bi,target,'b')
        :stepToward(bi,target,'b');
      // only accept if it improves distance (prevents oscillation)
      if(step>=0&&!pieces[step]&&!isTileBlocked(step)&&cheb(step,target)<cheb(bi,target))dest=step;
    }
    if(dest>=0){
      if(p.type==='pawn')p.firstMove=false;
      pieces[dest]=p;pieces[bi]=null;
      addLog('Black moves');blackLastFrom=bi;blackLastTo=dest;
      render();animatePieceMove(bi,dest,p.type,'b',true,()=>{},p.type==='knight'?260:180);
      setTimeout(()=>finishBlackTurn(),p.type==='knight'?280:200);return;
    }
  }

  finishBlackTurn();
}

function fallbackAI(){
  // try reactive behavior first (respond to being hit)
  if(reactiveAI())return;
  // campaign mode uses dedicated AI
  if(campaignLevel){campaignAI();return;}
  const bKi=pieces.findIndex(p=>p&&p.color==='b'&&p.type==='king');
  const cands=bKi>=0?adj8(bKi).filter(i=>!pieces[i]&&!isTileBlocked(i)):[];
  const bp=bPieces();
  if(difficulty==='easy'){strategy_easy_rook_rush(bKi,cands,bp);return;}
  hardTacticalAI(bKi,cands,bp);
}

function buildStateDesc(){
  let s='BOARD:\n';for(let i=0;i<ROWS*COLS;i++){const p=pieces[i];if(p)s+=sqName(i)+': '+(p.color==='b'?'B':'W')+' '+p.type+' HP='+p.hp+'/'+p.maxHp+'\n';}
  const bKi=pieces.findIndex(p=>p&&p.color==='b'&&p.type==='king');const bp=bPieces();const adjE=bKi>=0?adj8(bKi).filter(i=>!pieces[i]):[];
  const stratDesc={pawn_troops:'Spam pawns, rush.',knight_attack:'Build knights, attack.',pawn_knight:'2 knights + pawn shields.',bishop_pawn:'Build bishops for healing+advance.',rook_pawn:'Full merge chain to rook.'}[aiStrategy]||'';
  s+='\nSTRATEGY: '+stratDesc+'\nACTIONS (one only):\n1. PRODUCE <sq> available: '+(adjE.map(sqName).join(',')||'none')+'\n2. MOVE_ALL <DIR> N/S/E/W/NE/NW/SE/SW\n3. MERGE <sq1> <sq2> pawn+pawn=knight, pawn+knight=bishop, knight+bishop=rook\n   pairs: ';
  const pairs=[];for(let a=0;a<bp.pawns.length;a++){for(let b=a+1;b<bp.pawns.length;b++)if(adj8(bp.pawns[a]).includes(bp.pawns[b]))pairs.push('pp:'+sqName(bp.pawns[a])+','+sqName(bp.pawns[b]));bp.knights.forEach(k=>{if(adj8(bp.pawns[a]).includes(k))pairs.push('pk:'+sqName(bp.pawns[a])+','+sqName(k));});}bp.knights.forEach((k,ki)=>bp.knights.forEach((k2,ki2)=>{if(ki2>ki&&adj8(k).includes(k2))pairs.push('kk:'+sqName(k)+','+sqName(k2));}));
  s+=pairs.join('|')||'none';return s;
}

async function askClaude(){
  const key=document.getElementById('api-key').value.trim();
  if(!key||difficulty==='easy'){fallbackAI();return;}
  try{
    const h={'Content-Type':'application/json'};h['x-api-key']=key;
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:h,body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:48,system:'You play Black in a 12x12 strategy game. Files a-l, ranks 1-12. Follow your strategy. Reply ONE action only.',messages:[{role:'user',content:buildStateDesc()}]})});
    const d=await r.json();applyBlackMove((d.content?.[0]?.text||'').trim());
  }catch(e){fallbackAI();}
}

function aiAct(){if(isTutorialActive()){tutMoveEnemyOnce();setTimeout(()=>finishBlackTurn(),220);return;}askClaude();}

function applyBlackMove(text){
  const up=text.toUpperCase();const coords=text.match(/[a-lA-L](?:1[0-2]|[1-9])/g)||[];
  const bKi=pieces.findIndex(p=>p&&p.color==='b'&&p.type==='king');
  if(up.startsWith('MERGE')&&coords.length>=2){const a=sqFrom(coords[0]),b=sqFrom(coords[1]),pa=pieces[a],pb=pieces[b];if(a>=0&&b>=0&&pa?.color==='b'&&pb?.color==='b'&&adj8(a).includes(b)){let nt=null;if(pa.type==='pawn'&&pb.type==='pawn')nt='knight';else if((pa.type==='pawn'&&pb.type==='knight')||(pa.type==='knight'&&pb.type==='pawn'))nt='bishop';else if((pa.type==='knight'&&pb.type==='bishop')||(pa.type==='bishop'&&pb.type==='knight'))nt='rook';if(nt){const nb2={type:nt,color:'b',hp:STATS[nt].hp,maxHp:STATS[nt].maxHp};if(nt==='bishop')nb2.mana=1;pieces[a]=null;pieces[b]=nb2;addLog('Black merges->'+nt);render();mergeFlash(b);finishBlackTurn();return;}}}
  if(up.startsWith('MOVE_ALL')){const dm=up.match(/\b(NE|NW|SE|SW|N|S|E|W)\b/);if(dm){bMoveAll(dm[1]);return;}}
  if(up.startsWith('PRODUCE')&&coords.length>=1){const sq=sqFrom(coords[0]);if(sq>=0&&!pieces[sq]&&bKi>=0&&adj8(bKi).includes(sq)){pieces[sq]={type:'pawn',color:'b',hp:STATS.pawn.hp,maxHp:STATS.pawn.maxHp};addLog('Black spawns@'+sqName(sq));spawnFlash(sq);finishBlackTurn();return;}}
  fallbackAI();
}
