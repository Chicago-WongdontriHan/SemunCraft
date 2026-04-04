// ── AI ────────────────────────────────────────────────────────────────────────
function pickStrategy(){
  if(difficulty==='easy'){ aiStrategy='easy_rook_rush'; addLog('Enemy: rook rush'); return; }
  aiStrategy=STRATEGIES[Math.floor(Math.random()*STRATEGIES.length)];
  addLog('Enemy: '+aiStrategy.replace(/_/g,' '));
}

function bPieces(){const r={pawns:[],knights:[],bishops:[],rooks:[],queens:[]};for(let i=0;i<ROWS*COLS;i++){const p=pieces[i];if(!p||p.color!=='b')continue;if(p.type==='pawn')r.pawns.push(i);if(p.type==='knight')r.knights.push(i);if(p.type==='bishop')r.bishops.push(i);if(p.type==='rook')r.rooks.push(i);if(p.type==='queen')r.queens.push(i);}return r;}

function bSpawn(bKi,cands,count){
  if(!cands.length)return false;
  const wKi=pieces.findIndex(p=>p&&p.color==='w'&&p.type==='king');
  const n=Math.min(count||1,cands.length);
  const sorted=wKi>=0?[...cands].sort((a,b)=>cheb(a,wKi)-cheb(b,wKi)):cands;
  for(let k=0;k<n;k++){
    pieces[sorted[k]]={type:'pawn',color:'b',hp:STATS.pawn.hp,maxHp:STATS.pawn.maxHp};
  }
  addLog('Black spawns '+n+'x pawn');
  render();
  for(let k=0;k<n;k++) spawnFlash(sorted[k]);
  finishBlackTurn();return true;
}

function bAdvance(typeFilter){const wKi=pieces.findIndex(p=>p&&p.color==='w'&&p.type==='king');if(wKi<0){finishBlackTurn();return;}const mp=[];for(let i=0;i<ROWS*COLS;i++){const p=pieces[i];if(p&&p.color==='b'&&(typeFilter?typeFilter.includes(p.type):p.type!=='king'))mp.push(i);}if(!mp.length){finishBlackTurn();return;}const ar=mp.reduce((s,i)=>s+ROW(i),0)/mp.length,ac=mp.reduce((s,i)=>s+COL(i),0)/mp.length;const dr=ROW(wKi)>ar?1:ROW(wKi)<ar?-1:0,dc=COL(wKi)>ac?1:COL(wKi)<ac?-1:0;const dn={'-10':'N','10':'S','01':'E','0-1':'W','-11':'NE','-1-1':'NW','11':'SE','1-1':'SW'}[dr+''+dc]||'S';bMoveAll(dn);}

function bMergeQueen(limit){
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

function bMerge(ft,tt,rt,limit){const bp=bPieces();const pool={pawn:bp.pawns,knight:bp.knights,bishop:bp.bishops,rook:bp.rooks};const cur={knight:bp.knights.length,bishop:bp.bishops.length,rook:bp.rooks.length};if(cur[rt]!==undefined&&cur[rt]>=limit)return false;for(const a of(pool[ft]||[]))for(const b of(pool[tt]||[])){if(a===b)continue;if(adj8(a).includes(b)){const nb3={type:rt,color:'b',hp:STATS[rt].hp,maxHp:STATS[rt].maxHp};if(rt==='bishop')nb3.mana=1;pieces[a]=null;pieces[b]=nb3;addLog('Black merges->'+rt);render();mergeFlash(b);finishBlackTurn();return true;}}return false;}

function bMoveAll(dirStr){
  const M={N:[-1,0],S:[1,0],E:[0,1],W:[0,-1],NE:[-1,1],NW:[-1,-1],SE:[1,1],SW:[1,-1]};
  const[dr,dc]=M[dirStr]||[1,0];
  const wKi=pieces.findIndex(p=>p&&p.color==='w'&&p.type==='king');
  const all=[];
  for(let i=0;i<ROWS*COLS;i++){const p=pieces[i];if(p&&p.color==='b'&&(p.type==='pawn'||p.type==='knight'))all.push(i);}
  all.sort((a,b)=>dr>0?b-a:dr<0?a-b:dc>0?b-a:a-b);
  let moved=0,movedPairs=[];
  all.forEach(from=>{
    if(!pieces[from])return;
    const p=pieces[from];
    if(p.type==='pawn'){
      const nr=ROW(from)+dr,nc=COL(from)+dc;
      let dest=-1;
      if(inB(nr,nc)&&!pieces[idx(nr,nc)]&&!isTileBlocked(idx(nr,nc))){
        dest=idx(nr,nc);
      }else if(wKi>=0){
        dest=stepToward(from,wKi,'b');
      }
      if(dest>=0&&!pieces[dest]&&!isTileBlocked(dest)){
        pieces[dest]=p;pieces[from]=null;movedPairs.push({f:from,t:dest,type:p.type,color:'b'});moved++;
      }
    }else if(p.type==='knight'){
      const dests=kJumps(from).filter(j=>!pieces[j]&&!isTileBlocked(j));
      if(!dests.length)return;
      const target=wKi>=0?wKi:from;
      const best=dests.reduce((a,b)=>cheb(a,target)<cheb(b,target)?a:b);
      pieces[best]=p;pieces[from]=null;movedPairs.push({f:from,t:best,type:p.type,color:'b'});moved++;
    }
  });
  addLog('Black advances '+dirStr);
  const allNow2=[];for(let i=0;i<ROWS*COLS;i++){if(pieces[i]&&pieces[i].color==='b'&&pieces[i].type!=='king')allNow2.push(i);}
  blackLastFrom=movedPairs[0]?.f||-1;blackLastTo=movedPairs[0]?.t||-1;
  if(movedPairs.length){
    render();
    movedPairs.forEach(({f,t,type,color})=>animatePieceMove(f,t,type,color,true,()=>{},type==='knight'?260:180));
    setTimeout(()=>finishBlackTurn(),260);
  }else{render();finishBlackTurn();}
}

function strategy_pawn_troops(bKi,cands,bp){if(bp.pawns.length<6&&cands.length){bSpawn(bKi,cands);return;}bAdvance(['pawn']);}
function strategy_knight_attack(bKi,cands,bp){if(bMerge('pawn','pawn','knight',3))return;if(bp.pawns.length<4&&cands.length){bSpawn(bKi,cands);return;}bAdvance(['knight','pawn']);}
function strategy_pawn_knight(bKi,cands,bp){if(bp.pawns.length>=2&&bMerge('pawn','pawn','knight',2))return;if(bp.pawns.length<4&&cands.length){bSpawn(bKi,cands);return;}bAdvance(['pawn','knight']);}
function strategy_bishop_pawn(bKi,cands,bp){if(bMerge('pawn','knight','bishop',2))return;if(bMerge('pawn','pawn','knight',2))return;if(bp.pawns.length<4&&cands.length){bSpawn(bKi,cands);return;}bAdvance(['bishop','pawn']);}
function strategy_rook_pawn(bKi,cands,bp){if(bMergeQueen(1))return;if(bMerge('knight','knight','rook',1))return;if(bMerge('pawn','knight','bishop',1))return;if(bMerge('pawn','pawn','knight',2))return;if(bp.pawns.length<5&&cands.length){bSpawn(bKi,cands);return;}bAdvance(['rook','bishop','pawn']);}

function strategy_easy_rook_rush(bKi,cands,bp){
  if(bp.rooks.length===0&&bp.bishops.length===0&&bp.knights.length===0){
    if(bp.pawns.length<2&&cands.length){bSpawn(bKi,cands);return;}
    if(bMerge('pawn','pawn','knight',1))return;
    bAdvance(['pawn']);return;
  }
  if(bp.rooks.length===0&&bp.knights.length<2){
    if(bp.pawns.length<2&&cands.length){bSpawn(bKi,cands);return;}
    if(bMerge('pawn','pawn','knight',2))return;
    if(bp.pawns.length<2&&cands.length){bSpawn(bKi,cands);return;}
    bAdvance(['knight','pawn']);return;
  }
  if(bp.rooks.length===0){
    if(bMerge('knight','knight','rook',1))return;
    bAdvance(['knight','pawn']);return;
  }
  bAdvance(['rook','pawn','knight']);
}

function hardTacticalAI(bKi,cands,bp){
  const wKi=pieces.findIndex(p=>p&&p.color==='w'&&p.type==='king');
  const allB=[];for(let i=0;i<ROWS*COLS;i++){const p=pieces[i];if(p&&p.color==='b'&&p.type!=='king')allB.push(i);}
  for(const bi of allB){
    const p=pieces[bi];
    const range=p.type==='queen'?queenRange(bi):p.type==='siege'?siegeRange(bi):p.type==='rook'?rookRange(bi):p.type==='knight'?kJumps(bi):p.type==='bishop'?bishopRange(bi):adj8(bi);
    const wTargets=range.filter(j=>pieces[j]&&pieces[j].color==='w');
    if(!wTargets.length)continue;
    wTargets.sort((a,b2)=>{
      if(pieces[a].type==='king')return -1;if(pieces[b2].type==='king')return 1;
      return pieces[a].hp-pieces[b2].hp;
    });
    break;
  }
  if(bMergeQueen(1))return;
  if(bMerge('knight','knight','rook',1))return;
  if(bMerge('pawn','knight','bishop',2))return;
  if(bMerge('pawn','pawn','knight',3))return;
  const total=bp.pawns.length+bp.knights.length+bp.bishops.length+bp.rooks.length;
  if(cands.length>=2&&bp.pawns.length<3&&Math.random()<0.4){bSpawn(bKi,cands,2);return;}
  if(total<5&&cands.length){bSpawn(bKi,cands);return;}
  if(wKi>=0&&allB.length){
    const scored=allB.map(bi=>{
      const p=pieces[bi];
      const dist=cheb(bi,wKi);
      const canAtk=(p.type==='queen'?queenRange(bi):p.type==='siege'?siegeRange(bi):p.type==='rook'?rookRange(bi):p.type==='knight'?kJumps(bi):adj8(bi))
        .some(j=>pieces[j]&&pieces[j].color==='w');
      return{bi,score:(canAtk?0:1)*100+dist};
    });
    scored.sort((a,b)=>a.score-b.score);
    const lead=scored[0].bi;
    const lp=pieces[lead];
    const dr=ROW(wKi)>ROW(lead)?1:ROW(wKi)<ROW(lead)?-1:0;
    const dc=COL(wKi)>COL(lead)?1:COL(wKi)<COL(lead)?-1:0;
    const dn={'-10':'N','10':'S','01':'E','0-1':'W','-11':'NE','-1-1':'NW','11':'SE','1-1':'SW'}[dr+''+dc]||'S';
    const M={N:[-1,0],S:[1,0],E:[0,1],W:[0,-1],NE:[-1,1],NW:[-1,-1],SE:[1,1],SW:[1,-1]};
    const[mdr,mdc]=M[dn]||[1,0];
    let moved=false,movedFrom=lead,movedTo=-1;
    if(lp.type==='pawn'){
      const nr=ROW(lead)+mdr,nc=COL(lead)+mdc;
      let dest=-1;
      if(inB(nr,nc)&&!pieces[idx(nr,nc)]&&!isTileBlocked(idx(nr,nc))) dest=idx(nr,nc);
      else dest=stepToward(lead,wKi,'b');
      if(dest>=0&&!pieces[dest]&&!isTileBlocked(dest)){pieces[dest]=lp;pieces[lead]=null;moved=true;movedTo=dest;}
    }
    else if(lp.type==='knight'){const dests=kJumps(lead).filter(j=>!pieces[j]&&!isTileBlocked(j));if(dests.length){const best=dests.reduce((a,b)=>cheb(a,wKi)<cheb(b,wKi)?a:b);pieces[best]=lp;pieces[lead]=null;moved=true;movedTo=best;}}
    else if(lp.type==='bishop'||lp.type==='queen'||lp.type==='rook'){
      const maxS=lp.type==='bishop'?2:lp.type==='queen'?2:2;
      let slid=false;
      for(let s=maxS;s>=1;s--){
        const nr=ROW(lead)+mdr*s,nc=COL(lead)+mdc*s;if(!inB(nr,nc))continue;
        const ti=idx(nr,nc);if(isTileBlocked(ti))break;
        if(s===2){const mr=ROW(lead)+mdr,mc2=COL(lead)+mdc;if(!inB(mr,mc2)||isTileBlocked(idx(mr,mc2)))break;}
        if(!pieces[ti]){pieces[ti]=lp;pieces[lead]=null;moved=true;movedTo=ti;slid=true;break;}
      }
      if(!slid){
        const det=stepToward(lead,wKi,'b');
        if(det>=0&&!pieces[det]&&!isTileBlocked(det)){pieces[det]=lp;pieces[lead]=null;moved=true;movedTo=det;}
      }
    }
    if(moved){
      addLog('Black advances');
      blackLastFrom=movedFrom;blackLastTo=movedTo;
      render();
      animatePieceMove(movedFrom,movedTo,lp.type,'b',true,()=>{},lp.type==='knight'?260:180);
      setTimeout(()=>finishBlackTurn(),280);
      return;
    }
  }
  // fallback: advance all
  bAdvance(null);
}

function fallbackAI(){
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

function aiAct(){if(isTutorialActive()){finishBlackTurn();return;}askClaude();}

function applyBlackMove(text){
  const up=text.toUpperCase();const coords=text.match(/[a-lA-L](?:1[0-2]|[1-9])/g)||[];
  const bKi=pieces.findIndex(p=>p&&p.color==='b'&&p.type==='king');
  if(up.startsWith('MERGE')&&coords.length>=2){const a=sqFrom(coords[0]),b=sqFrom(coords[1]),pa=pieces[a],pb=pieces[b];if(a>=0&&b>=0&&pa?.color==='b'&&pb?.color==='b'&&adj8(a).includes(b)){let nt=null;if(pa.type==='pawn'&&pb.type==='pawn')nt='knight';else if((pa.type==='pawn'&&pb.type==='knight')||(pa.type==='knight'&&pb.type==='pawn'))nt='bishop';else if((pa.type==='knight'&&pb.type==='bishop')||(pa.type==='bishop'&&pb.type==='knight'))nt='rook';if(nt){const nb2={type:nt,color:'b',hp:STATS[nt].hp,maxHp:STATS[nt].maxHp};if(nt==='bishop')nb2.mana=1;pieces[a]=null;pieces[b]=nb2;addLog('Black merges->'+nt);render();mergeFlash(b);finishBlackTurn();return;}}}
  if(up.startsWith('MOVE_ALL')){const dm=up.match(/\b(NE|NW|SE|SW|N|S|E|W)\b/);if(dm){bMoveAll(dm[1]);return;}}
  if(up.startsWith('PRODUCE')&&coords.length>=1){const sq=sqFrom(coords[0]);if(sq>=0&&!pieces[sq]&&bKi>=0&&adj8(bKi).includes(sq)){pieces[sq]={type:'pawn',color:'b',hp:STATS.pawn.hp,maxHp:STATS.pawn.maxHp};addLog('Black spawns@'+sqName(sq));spawnFlash(sq);finishBlackTurn();return;}}
  fallbackAI();
}
