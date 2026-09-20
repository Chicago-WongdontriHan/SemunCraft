// ── PIECE MOVEMENT ANIMATION ─────────────────────────────────────────────────
function animatePieceMove(fromIdx,toIdx,pieceType,pieceColor,isBlack,cb,dur){
  dur=dur||180;
  const board=document.getElementById('board');
  if(!board){cb();return;}
  const fc=sqCenter(fromIdx), tc=sqCenter(toIdx);
  const sz=Math.max(14,Math.floor(sqPx*.86));
  const el=document.createElement('div');
  el.style.cssText='position:fixed;pointer-events:none;z-index:350;transform:translate(-50%,-50%);'
    +'left:'+fc.x+'px;top:'+fc.y+'px;width:'+sz+'px;height:'+sz+'px;';
  el.innerHTML=pieceSVG(pieceType,pieceColor,mapTheme,sz);
  document.body.appendChild(el);

  // knight: arc trajectory via Web Animations
  if(pieceType==='knight'){
    const mx=(fc.x+tc.x)/2, my=Math.min(fc.y,tc.y)-sqPx*.9;
    el.animate([
      {left:fc.x+'px',top:fc.y+'px',opacity:'1'},
      {left:mx+'px', top:my+'px', opacity:'1'},
      {left:tc.x+'px',top:tc.y+'px',opacity:'1'},
    ],{duration:dur,easing:'ease-in-out',fill:'forwards'}).finished.then(()=>{el.remove();cb();});
    return;
  }

  // linear slide via CSS transition
  el.style.transition='left '+dur+'ms ease-out,top '+dur+'ms ease-out';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    el.style.left=tc.x+'px';
    el.style.top=tc.y+'px';
    setTimeout(()=>{el.remove();cb();},dur+16);
  }));
}

// ── TARGET SETTING ───────────────────────────────────────────────────────────
function toggleTargetMode(){
  if(over||thinking||!isMyTurn())return;
  targetMode=!targetMode; targetSrc=-1;
  syncUI(); render();
  setStatus(targetMode?'Target mode: click your piece, then click enemy (or friendly for bishop)':'Your turn');
}

function unsiegePiece(i){
  const p=pieces[i];if(!p||p.type!=='siege'||p.color!==myColor())return;
  const empties=adj8(i).filter(j=>!pieces[j]&&!isTileBlocked(j));
  const dest=empties.length?empties[0]:null;
  // both rooks keep the siege tower's current HP (clamped to rook max)
  const sharedHp=Math.max(1,Math.min(STATS.rook.maxHp,p.hp));
  pieces[i]={type:'rook',color:p.color,hp:sharedHp,maxHp:STATS.rook.maxHp};
  if(dest)pieces[dest]={type:'rook',color:p.color,hp:sharedHp,maxHp:STATS.rook.maxHp};
  addLog('Unsieged into '+(dest?'2 rooks':'1 rook'));SFX.arrive('rook');
  mergeFlash(i);if(dest)setTimeout(()=>spawnFlash(dest),120);
  tutCheckAction('unsiege');
  selectedPieces=new Set();endTurn();
}

function handleRightClick(i,e){
  if(over||thinking||!isMyTurn())return;
  const p=pieces[i];const mc=myColor();
  if(p&&p.color===mc&&p.type==='siege'){unsiegePiece(i);return;}
  if(p&&p.color===mc){targetSrc=i;targetMode=true;syncUI();render();setStatus('Click the target for '+p.type+(p.type==='bishop'?' (friendly)':' (enemy)'));}
}

function handleTargetClick(i){
  if(targetSrc<0){
    const p=pieces[i];if(p&&p.color===myColor()){targetSrc=i;render();setStatus('Now click target for '+p.type);}
    return;
  }
  const p=pieces[targetSrc];
  if(!p){targetSrc=-1;targetMode=false;syncUI();render();return;}
  const mc=myColor();
  const tgts=mc==='w'?whiteTargets:blackTargets;
  if(p.type==='bishop'){
    if(pieces[i]&&pieces[i].color===mc&&i!==targetSrc){
      tgts[targetSrc]=i; addLog(p.type+' will heal '+sqName(i));
    }
  }else{
    if(pieces[i]&&pieces[i].color!==mc&&!isConcealedFrom(i,mc)){
      tgts[targetSrc]=i; addLog(p.type+' will attack '+sqName(i));
    }
  }
  targetSrc=-1; targetMode=false; syncUI(); render();
  setStatus("Your turn");
}

// ── DROP / EXECUTE ───────────────────────────────────────────────────────────
// what a piece dropped on a friendly piece merges into (null when the two don't merge)
function mergeResultType(a,b){
  if(a==='pawn'&&b==='pawn')return 'knight';
  if((a==='pawn'&&b==='knight')||(a==='knight'&&b==='pawn'))return 'bishop';
  if((a==='knight'&&b==='bishop')||(a==='bishop'&&b==='knight'))return 'queen';
  if(a==='rook'&&b==='rook')return 'siege';
  if((a==='bishop'&&b==='rook')||(a==='rook'&&b==='bishop'))return 'mage';   // for 2 Elixir
  if(a==='knight'&&b==='knight')return 'rook';
  return null;
}

function executeDrop(from,to,dests){
  if(!dests){render();return;}
  // the Delay counter stands: this move is written down for later instead of being made now
  if(orderTurns>0&&isMyTurn()&&!dests.merge.has(to)&&!dests.heal.has(to)&&orderTargets(from).has(to)){
    if(!canOrder(from)){setStatus('No orders left this turn');render();return;}
    placeOrder(from,to,orderTurns);
    return;
  }
  const p=pieces[from];
  const tgts=myColor()==='w'?whiteTargets:blackTargets;

  // block merging if the current campaign level disallows it
  if(campaignLevel&&campaignLevel.noMerge&&dests.merge&&dests.merge.has(to)){
    setStatus('No merge this round');
    showFloatingMessage('No merge this round',to);
    dests.merge=new Set();
    render();
    return;
  }

  // ── GROUP MOVE: if 2-3 pawns/knights selected and dragged to a move dest ────
  if(dests.move.has(to) && selectedPieces.size>=2 && selectedPieces.has(from)){
    const mc=myColor();
    const groupEligible=[...selectedPieces].filter(si=>{
      const sp=pieces[si];
      return sp&&sp.color===mc&&(sp.type==='pawn'||sp.type==='knight');
    }).slice(0,3);
    if(groupEligible.length>=2){
      const dr=ROW(to)-ROW(from), dc=COL(to)-COL(from);
      const movers=[];
      for(const si of groupEligible){
        const sp=pieces[si];
        if(sp.type==='knight'){
          const dest=kJumps(si).find(j=>ROW(j)-ROW(si)===dr&&COL(j)-COL(si)===dc);
          if(dest!==undefined&&!pieces[dest]&&!isTileBlocked(dest))movers.push({si,di:dest});
        }else{
          const nr=ROW(si)+dr,nc=COL(si)+dc;
          if(inB(nr,nc)){const di=idx(nr,nc);if(!pieces[di]&&!isTileBlocked(di))movers.push({si,di});}
        }
      }
      if(movers.length>=2){
        const occupied=new Set(movers.map(m=>m.di));
        if(occupied.size===movers.length){
          addLog(movers.length+' pieces move');SFX.move();
          movedThisTurn=-1;
          let done=0;
          render();
          movers.forEach(({si,di})=>{
            const mv=pieces[si];
            if(mv.type==='pawn')mv.firstMove=false;
            animatePieceMove(si,di,pieceArt(mv),mv.color,false,()=>{
              pieces[si]=null;pieces[di]=mv;
              done++;if(done===movers.length){render();endTurn();}
            },mv.type==='knight'?260:180);
          });
          return;
        }
      }
    }
  }

  // bishop dragged onto a friendly knight (or, with the Elixir, a rook): ask Merge or Heal, on the same
  // on-board chooser as the King's and the pieces' (a tap anywhere else puts it away)
  if(p.type==='bishop'&&dests.merge.has(to)&&pieces[to]&&(pieces[to].type==='knight'||pieces[to].type==='rook')){
    const nt=pieces[to].type==='rook'?'mage':'queen';
    const canHeal=(p.mana||0)>0&&pieces[to].hp<pieces[to].maxHp;
    showDropChoice(to,[
      canHeal&&['heal','Heal '+pieces[to].type+' (1 mana)',()=>{
        tgts[from]=to;
        addLog('Bishop will heal '+pieces[to].type+'@'+sqName(to));
        setStatus('Bishop locked on heal target — fires at turn end.');
        SFX.select();tutCheckAction('heal');render();endTurn();
      }],
      ['merge',nt==='mage'?'Merge \u2192 Mage ('+MAGE_ELIXIR+' Elixir)':'Merge \u2192 Queen',()=>{
        if(nt==='mage')elixir[p.color]-=MAGE_ELIXIR;
        pieces[from]=null;pieces[to]={type:nt,color:p.color,hp:STATS[nt].hp,maxHp:STATS[nt].maxHp};
        addLog('Merged to '+nt+'@'+sqName(to));SFX.arrive(nt);tutCheckAction('merge');
        movedThisTurn=-1;
        setTimeout(()=>mergeFlash(to),50);endTurn();
      }],
    ].filter(Boolean));
    render();return;
  }
  // bishop drag onto healable ally: execute heal with animation
  if(p.type==='bishop'&&dests.heal.has(to)&&!dests.merge.has(to)){
    if((p.mana||0)<=0){setStatus('Bishop has no mana!');return;}
    const t=pieces[to];
    if(t&&t.hp<t.maxHp){
      t.hp=Math.min(t.maxHp,t.hp+2);
      p.mana=Math.max(0,(p.mana||0)-1);
      p.lastHealTurn=whiteTurnCount;
      addLog('Bishop heals '+t.type+'@'+sqName(to)+' ('+p.mana+' mana left)');SFX.heal();
      delete tgts[from];
      movedThisTurn=from;
      render();
      attackAnim(from,to,'heal',()=>{
        flashSq(to,'heal-flash');
        tutCheckAction('heal');
        render();endTurn();
      });
      return;
    }
    return;
  }
  if(dests.merge.has(to)){
    const t=pieces[to],nt=mergeResultType(p.type,t.type);
    if(nt){
      delete tgts[from]; delete tgts[to];
      const newPiece={type:nt,color:p.color,hp:STATS[nt].hp,maxHp:STATS[nt].maxHp};
      if(nt==='bishop')newPiece.mana=1;
      if(nt==='siege')newPiece.sieged=true;
      if(nt==='mage')elixir[p.color]-=MAGE_ELIXIR;
      pieces[from]=null;pieces[to]=newPiece;
      addLog('Merged to '+nt+'@'+sqName(to));SFX.arrive(nt);tutCheckAction('merge');
      movedThisTurn=-1;
      setTimeout(()=>mergeFlash(to),50);
      const knightLJump=p.type==='knight'&&kJumps(from).includes(to);
      if(knightLJump){render();return;}
      endTurn();return;
    }
  }
  // king attacking an adjacent animal
  if(p.type==='king'&&!pieces[to]&&dests.attack.has(to)){
    const tr=ROW(to),tc2=COL(to);
    const aIdx=animals.findIndex(na=>{const ar=Math.round(na.y-0.5),ac=Math.round(na.x-0.5);return inB(ar,ac)&&idx(ar,ac)===to;});
    if(aIdx>=0){
      const na=animals[aIdx];
      na.hp--;
      const naC=sqCenter(to);
      const pl=sqCenter(from);
      emojiAnim(GLYPH['king_w'],pl.x,pl.y,naC.x,naC.y,sqPx*.4,200,()=>{});
      addLog('King hits '+na.emoji+' → '+na.hp+'HP');SFX.attack();
      if(na.hp<=0){
        animals.splice(aIdx,1);
        const board=document.getElementById('board');
        if(board){const br=board.getBoundingClientRect();const burst=document.createElement('div');burst.style.cssText='position:fixed;pointer-events:none;z-index:700;left:'+(br.left+na.x*sqPx)+'px;top:'+(br.top+na.y*sqPx)+'px;width:'+sqPx+'px;height:'+sqPx+'px;border-radius:50%;border:3px solid rgba(255,220,80,.8);animation:burstAnim .4s ease-out forwards;';burst.style.transform='translate(-50%,-50%)';document.body.appendChild(burst);setTimeout(()=>burst.remove(),450);}
        addLog('King defeats '+na.emoji+'!');SFX.kill();
      }
      endTurn();return;
    }
  }
  // any piece can attack an animal at the target tile
  if(!pieces[to]){
    const aHitIdx=animals.findIndex(na=>{
      const ar=Math.round(na.y-0.5),ac=Math.round(na.x-0.5);
      return inB(ar,ac)&&idx(ar,ac)===to;
    });
    if(aHitIdx>=0&&(dests.attack.has(to)||dests.move.has(to))){
      const na=animals[aHitIdx];
      na.hp--;
      const naC=sqCenter(to);const pl=sqCenter(from);
      emojiAnim(GLYPH[p.type+'_w']||'♙',pl.x,pl.y,naC.x,naC.y,sqPx*.4,200,()=>{});
      addLog(p.type+' hits '+na.emoji+' → '+na.hp+'HP');SFX.attack();
      if(na.hp<=0){
        animals.splice(aHitIdx,1);
        const board=document.getElementById('board');
        if(board){const br=board.getBoundingClientRect();const burst=document.createElement('div');burst.style.cssText='position:fixed;pointer-events:none;z-index:700;left:'+(br.left+na.x*sqPx)+'px;top:'+(br.top+na.y*sqPx)+'px;width:'+sqPx+'px;height:'+sqPx+'px;border-radius:50%;border:3px solid rgba(255,220,80,.8);animation:burstAnim .4s ease-out forwards;';burst.style.transform='translate(-50%,-50%)';document.body.appendChild(burst);setTimeout(()=>burst.remove(),450);}
        addLog(p.type+' defeats '+na.emoji+'!');SFX.kill();
      }
      renderAnimalOverlay();render();endTurn();return;
    }
  }
  // if dropped on any enemy piece: set as priority target; if in range also attack now
  // (not one hidden in undergrowth: the drop just fails, as on any tile you can't move to)
  if(pieces[to]&&pieces[to].color!==myColor()&&!dests.attack.has(to)&&!isConcealedFrom(to,myColor())){
    tgts[from]=to;
    addLog(p.type+' targets '+pieces[to].type+'@'+sqName(to));
    setStatus(p.type+' will fire at '+pieces[to].type+' when in range.');
    render();endTurn();return;
  }
  if(dests.attack.has(to)){
    tgts[from]=to;
    tutCheckAction('attack');
    addLog(p.type+' locked on '+pieces[to].type+'@'+sqName(to)+' (fires at turn end)');
    setStatus(p.type+' locked — attack fires at end of turn.');
    SFX.select();
    render();endTurn();return;
  }
  if(dests.move.has(to)){
    delete tgts[from];
    addLog(p.type+' moves to '+sqName(to));SFX.move();tutCheckAction('move');
    const _mv=pieces[from];
    if(_mv.type==='pawn')_mv.firstMove=false;
    movedThisTurn=from;
    render();
    animatePieceMove(from,to,pieceArt(_mv),_mv.color,false,()=>{
      pieces[from]=null; pieces[to]=_mv; movedThisTurn=to; render(); endTurn();
    },_mv.type==='knight'?260:180);
    return;
  }

  render();
}

function handleClick(i,additive){
  if(trainingMode&&trainBrush&&trainingPlace(i))return;   // a unit or a tile is in hand
  const p=pieces[i];const mc=myColor();
  if(scryMode){
    // any glowing square casts, aimed at the valid 3x3 that covers it; anywhere else puts the scry away
    const c=scrySrc>=0&&scryArea(scrySrc).has(i)?scryCenterFor(scrySrc,i):-1;
    if(c>=0)castScry(scrySrc,c);else cancelScry();
    return;
  }
  const ki=pieces.findIndex(q=>q&&q.color===mc&&q.type==='king');
  // click-to-move: if exactly one friendly piece is selected and the clicked tile is
  // a valid move/attack/merge destination for it, execute the action
  if(selectedPieces.size===1&&!kingSelected&&!targetMode){
    const srcI=[...selectedPieces][0];
    const sp=pieces[srcI];
    if(sp&&sp.color===mc&&srcI!==i){
      const dests=getDragDests(srcI);
      // in a level without merging, tapping an ally the piece could merge with just selects that ally
      const refused=campaignLevel&&campaignLevel.noMerge&&dests.merge.has(i);
      const orderable=orderTurns>0&&orderTargets(srcI).has(i);
      if(!refused&&(orderable||dests.move.has(i)||dests.attack.has(i)||dests.merge.has(i)||dests.heal.has(i))){
        selectedPieces=new Set();
        executeDrop(srcI,i,dests);
        return;
      }
    }
  }
  if(p&&p.color===mc&&p.type==='siege'){
    if(selectedPieces.has(i)){
      // second tap on selected siege → unsiege it
      unsiegePiece(i);
    }else{
      selectedPieces=new Set([i]);render();
      setStatus('Siege tower selected — tap again (or right-click) to unsiege');
    }
    return;
  }
  if(p&&p.color===mc&&p.type==='king'){
    // tapping the king again puts it down; otherwise it opens in spawn mode while pawns are left
    if(kingSelected||selectedPieces.has(i)){kingSelected=false;selectedPieces=new Set();render();setStatus('Your turn');return;}
    setKingMode(i,spawnRemaining()>=1?'spawn':'move');
    return;
  }
  if(!p&&kingSelected){
    if(ki>=0&&adj8(ki).includes(i)){
      const rs=spawnRemaining();
      if(rs<1){setStatus('Not enough Gold for a pawn');kingSelected=false;render();return;}
      if(isTileBlocked(i)){setStatus('Cannot spawn on obstacle');kingSelected=false;render();return;}
      pieces[i]={type:'pawn',color:mc,hp:STATS.pawn.hp,maxHp:STATS.pawn.maxHp,newborn:true,firstMove:true};
      spawnHistory.push(whiteTurnCount);
      addLog('Spawned pawn ('+goldText(spawnRemaining())+' Gold left)');spawnFlash(i);SFX.arrive('pawn');kingSelected=false;tutCheckAction('spawn');endTurn();}
    else{kingSelected=false;render();setStatus('Your turn');}
    return;
  }
  if(p&&p.color===mc&&p.type!=='king'){
    kingSelected=false;
    if(selectedPieces.has(i)){
      selectedPieces.delete(i);
    }else{
      // a tap or click selects this piece alone and the action guide shows what it can do;
      // Shift/Ctrl-click adds a pawn or knight to a group of up to 3 that moves together
      const groupable=t=>t==='pawn'||t==='knight';
      const joins=additive&&groupable(p.type)&&selectedPieces.size>0&&[...selectedPieces].every(si=>pieces[si]&&groupable(pieces[si].type));
      if(joins){
        if(selectedPieces.size>=3){setStatus('Max 3 pieces in group');render();return;}
        selectedPieces.add(i);
      }else selectedPieces=new Set([i]);
      SFX.select();
    }
    render();
    const gSz=selectedPieces.size;
    const gCan=gSz>=2&&[...selectedPieces].every(si=>{const sp=pieces[si];return sp&&(sp.type==='pawn'||sp.type==='knight');});
    setStatus(gSz===1?'Tap a marker to act, or drag the piece':gSz>0?(gCan?gSz+' pcs — drag any to move group':gSz+' selected'):'Your turn');
    return;
  }
  kingSelected=false;selectedPieces=new Set();render();
}

// ── PAWN: THE SPRING, AND FORTIFYING ────────────────────────────────────────
// A pawn on the Elixir spring extracts one Elixir, and that is its whole turn. ('extract' in engine.js)
function extractAt(i){
  const p=pieces[i];
  if(!p||p.type!=='pawn'||tileData[i]!=='spring')return;
  elixir[p.color]++;
  movedThisTurn=i;
  addLog('Pawn extracts Elixir at '+sqName(i));
  SFX.extract();flashSq(i,'heal-flash');
  render();endTurn();
}
// One Gold turns a pawn into a fortified pawn: the same pawn in a helmet, with three life. It takes
// the pawn's turn, as spawning takes the King's. ('fortify' in engine.js)
function fortifyAt(i){
  const p=pieces[i];
  if(!p||p.type!=='pawn'||p.fortified||!goldAllowed()||spawnRemaining()<1)return;
  p.fortified=true;p.hp=FORTIFIED_HP;p.maxHp=FORTIFIED_HP;
  goldSpent[p.color]++;
  movedThisTurn=i;
  addLog('Pawn fortified at '+sqName(i)+' ('+goldText(spawnRemaining())+' Gold left)');
  SFX.fortify();flashSq(i,'heal-flash');
  render();endTurn();
}
function doFortify(){
  if(over||thinking||!isMyTurn())return;
  const i=selectedPieces.size===1?[...selectedPieces][0]:-1;
  const p=i<0?null:pieces[i];
  if(!p||p.color!==myColor()||p.type!=='pawn'){setStatus('Select one of your pawns to fortify it');return;}
  if(p.fortified){setStatus('That pawn is already fortified');return;}
  if(!goldAllowed()||spawnRemaining()<1){setStatus('Not enough Gold to fortify (1 Gold)');return;}
  fortifyAt(i);
}
// the special-action button: whatever the one selected piece can do where it stands
function doSpecial(){
  const i=selectedPieces.size===1?[...selectedPieces][0]:-1;
  const p=i<0?null:pieces[i];
  if(p&&p.color===myColor()&&canExtract(i)){extractAt(i);return;}
  startScry();
}

// ── BISHOP: SCRYING ──────────────────────────────────────────────────────────
// A bishop spends both its mana to light a 3x3 it cannot see, for its next two turns: the fog lifts
// there, terrain and enemies both. It costs the bishop's turn, like a heal, and it doesn't lift the
// jungle's undergrowth — that still takes standing next to it. ('scry' in engine.js)
let scryMode=false, scrySrc=-1;
function startScry(){
  const i=[...selectedPieces][0];
  const p=i===undefined?null:pieces[i];
  if(!p||p.color!==myColor()||p.type!=='bishop'||(p.mana||0)<2){setStatus('Select a bishop with full mana');return;}
  scryMode=true;scrySrc=i;targetMode=false;
  render();syncUI();
  setStatus('Tap any square: the bishop lights the 3x3 around it (2 mana)');
}
function cancelScry(){scryMode=false;scrySrc=-1;render();syncUI();}
// the centres a bishop may aim at: any square on the board, seen or not, however far (the engine's rule)
function scryTargets(i){
  const out=new Set();
  for(let j=0;j<ROWS*COLS;j++)out.add(j);
  return out;
}
// the squares a tap can aim at — every one, so the whole board glows while the bishop picks
function scryArea(i){return scryTargets(i);}
// the centre a tap on square t aims at: t itself when it is a valid centre with a whole 3x3 on the board,
// otherwise the valid centre next to it that fits on the board — a tap on the edge lights the full 3x3
// just inside it — preferring the one straight in, then the one nearest the bishop
function scryCenterFor(i,t){
  const d2=(a,b)=>(ROW(a)-ROW(b))**2+(COL(a)-COL(b))**2;
  const score=c=>[scryBox(c).length,-d2(c,t),-cheb(c,i),-c];
  const better=(a,b)=>{for(let k=0;k<a.length;k++)if(a[k]!==b[k])return a[k]>b[k];return false;};
  let best=-1,bs=null;
  scryTargets(i).forEach(c=>{
    if(cheb(c,t)>1)return;
    const sc=score(c);
    if(!bs||better(sc,bs)){best=c;bs=sc;}
  });
  return best;
}
function castScry(from,to){
  const p=pieces[from];
  if(!p||p.type!=='bishop'||(p.mana||0)<2)return;
  p.mana=Math.max(0,(p.mana||0)-2);
  p.lastHealTurn=whiteTurnCount;
  scans.push({tiles:scryBox(to),turns:SCRY_TURNS,color:p.color});
  scryMode=false;scrySrc=-1;
  movedThisTurn=from;
  addLog('Bishop scries '+sqName(to));
  SFX.scry();
  render();endTurn();
}

// ── KING: SPAWN A PAWN OR MOVE ───────────────────────────────────────────────
// Spawning and moving both use the squares around the king, so a selected king gets a small
// Spawn / Move chooser beside it: Spawn shows ghost pawns where one can be placed, Move shows
// the king's own action guide. The chooser sits clear of the king's 3x3 so it covers no marker.
let kingChooser=null;
function setKingMode(ki,mode){
  if(mode==='spawn'){
    selectedPieces=new Set();kingSelected=true;
    setStatus('Tap a ghost pawn to spawn it ('+goldText(spawnRemaining())+' Gold)');
  }else{
    kingSelected=false;selectedPieces=new Set([ki]);
    setStatus('Tap a marker to move the king');
  }
  SFX.select();render();showKingChooser(ki,mode);
}
function closeKingChooser(){if(kingChooser){kingChooser.remove();kingChooser=null;}}
function showKingChooser(ki,mode){
  closeKingChooser();
  if(!sqElAt(ki))return;
  const box=document.createElement('div');box.id='king-choice';
  const left=Math.floor(spawnRemaining());
  [['♟ Spawn ('+left+')','spawn',left>0],['♚ Move','move',true]].forEach(([label,m,enabled])=>{
    const b=document.createElement('button');
    b.className='king-choice-btn'+(m===mode?' on':'');b.textContent=label;b.disabled=!enabled;
    b.onclick=()=>{if(m!==mode&&!over&&!thinking&&isMyTurn())setKingMode(ki,m);};
    box.appendChild(b);
  });
  document.body.appendChild(box);kingChooser=box;
  placeKingChooser(ki);
}
function placeKingChooser(ki){
  const sq=sqElAt(ki);if(!sq){closeKingChooser();return;}
  // (the square's own height, not sqPx, so it still clears the 3x3 when the board is zoomed)
  const r=sq.getBoundingClientRect(),bw=kingChooser.offsetWidth,bh=kingChooser.offsetHeight;
  let top=r.top-r.height-8-bh;                   // above the king's 3x3...
  if(top<6)top=r.bottom+r.height+8;              // ...or below it when there is no room
  kingChooser.style.left=Math.min(Math.max(r.left+r.width/2-bw/2,6),innerWidth-bw-6)+'px';
  kingChooser.style.top=top+'px';
}
// called after every render: the chooser only stays while the king is still the selected piece
function syncKingChooser(){
  if(!kingChooser)return;
  const mc=myColor(),ki=pieces.findIndex(q=>q&&q.color===mc&&q.type==='king');
  const kingUp=ki>=0&&!dragging&&!over&&!thinking&&isMyTurn()
    &&(kingSelected||(selectedPieces.size===1&&selectedPieces.has(ki)));
  if(kingUp)placeKingChooser(ki);else closeKingChooser();
}

// ── DELAYED ORDERS ───────────────────────────────────────────────────────────
// Giving an order does not use up the turn: it spends part of the turn's order budget and the piece
// still attacks at the end of it as usual, so orders can be stacked up to land together later.
// ('order' in js/engine.js; they come due in runOrders, js/game.js)
// The Delay button in the actions panel. While it stands above nought, every move made is written down
// for that many turns ahead instead of being made now. It starts each turn at none (turnUpkeep) and
// comes back round to none, so it needs nothing to clear it: a pawn — whose order costs half a turn and
// who can therefore be sent further out — counts up to MAX_DELAY and then back to nought, and anything
// else, which spends the whole turn on one order, is simply on or off.
function delayCeiling(){
  const p=pieces[pieceInHand()];
  return p&&p.type!=='pawn'?1:MAX_DELAY;
}
function bumpDelay(){
  if(over||thinking||!isMyTurn())return;
  orderTurns=orderTurns>=delayCeiling()?0:orderTurns+1;
  SFX.order();
  render();syncUI();
  setStatus(orderTurns?'Delay '+orderTurns+' — the next move is an order for '+orderTurns+' turn'+(orderTurns>1?'s':'')+' from now'
                      :'Delay cleared — moves happen now');
}
// The squares an order can reserve: wherever the piece could move if the enemy were not in the way. An
// order is for a square, not for a path, and by the time it comes due the enemy standing there may be
// gone — and if it is still there, the move becomes a strike instead (runOrders in js/game.js).
function orderTargets(i){
  const p=pieces[i];if(!p)return new Set();
  const saved=[];
  for(let k=0;k<ROWS*COLS;k++){const q=pieces[k];if(q&&q.color!==p.color){saved.push([k,q]);pieces[k]=null;}}
  const m=getDragDests(i).move;
  for(const[k,q]of saved)pieces[k]=q;
  return m;
}
function placeOrder(from,to,turns){
  const p=pieces[from];
  if(!p||orderLeft[p.color]<orderCost(p.type))return;
  p.order={to,turns};
  orderLeft[p.color]-=orderCost(p.type);
  selectedPieces=new Set();kingSelected=false;
  addLog(p.type+' ordered to '+sqName(to)+' in '+turns+' turn'+(turns>1?'s':''));
  SFX.order();
  // the order budget is the turn: with too little left to order anything more, the turn passes by itself
  if(orderLeft[p.color]<ORDER_MIN){
    render();
    setStatus('Orders given — the turn passes');
    endTurn();
    return;
  }
  render();syncUI();
  setStatus('Order set — half a turn of orders left');
}

// ── A CHOICE WHERE A PIECE WAS DROPPED ──────────────────────────────────────
// A bishop dropped on a knight can merge or heal: the choice comes up on the same on-board chooser as
// the King's and the pieces', under the square it was dropped on, and a tap anywhere else puts it away.
function showDropChoice(at,choices){
  const old=document.getElementById('bishop-choice');if(old)old.remove();
  const sq=sqElAt(at);if(!sq)return;
  const box=document.createElement('div');box.id='bishop-choice';
  choices.forEach(([icon,label,act])=>{
    const b=document.createElement('button');b.className='king-choice-btn';b.innerHTML=uiLabel(icon,label);
    b.onclick=e=>{if(e)e.stopPropagation();box.remove();act();};
    box.appendChild(b);
  });
  document.body.appendChild(box);
  const r=sq.getBoundingClientRect(),bw=box.offsetWidth,bh=box.offsetHeight;
  box.style.left=Math.min(Math.max(r.left+r.width/2-bw/2,6),innerWidth-bw-6)+'px';
  box.style.top=(r.bottom+8+bh<=innerHeight-6?r.bottom+8:Math.max(6,r.top-8-bh))+'px';
  setTimeout(()=>document.addEventListener('pointerdown',function h(e){
    if(!box.contains(e.target)){box.remove();document.removeEventListener('pointerdown',h,true);}
  },true),10);
}

// ── THE PIECE CHOOSER: PAWNS AND BISHOPS ────────────────────────────────────
// A selected pawn or bishop of yours gets the same kind of on-board chooser as the King. A pawn: Extract
// Elixir while it stands on the spring (as often as you like), Fortify (1 Gold) while it is a plain
// pawn. A bishop: Scry, lit once it holds both its mana. The chooser sits past the piece's reach (the
// pawn's 3x3, the bishop's 5x5) on its own side of the board, so it never covers a square it can act on.
let pieceChooser=null;
function closePieceChooser(){if(pieceChooser){pieceChooser.remove();pieceChooser=null;}}
function pieceChoices(i){
  const p=pieces[i],out=[];
  if(!p)return out;
  if(p.type==='pawn'){
    if(canExtract(i))out.push(['extract','Extract Elixir',true,()=>extractAt(i)]);
    if(!p.fortified&&goldAllowed())out.push(['fortify','Fortify (1 Gold)',spawnRemaining()>=1,()=>fortifyAt(i)]);
  }else if(p.type==='bishop'){
    const ready=(p.mana||0)>=2;
    out.push(['scry',ready?'Scry (2 mana)':'Scry (needs 2 mana)',ready,()=>{selectedPieces=new Set([i]);startScry();}]);
  }
  return out;
}
// called after every render, like syncKingChooser
function syncPieceChooser(){
  const i=selectedPieces.size===1&&!kingSelected?[...selectedPieces][0]:-1,p=i>=0?pieces[i]:null;
  const up=!!p&&p.color===myColor()&&!dragging&&!over&&!thinking&&isMyTurn()
    &&!scryMode&&!targetMode&&!isTutorialActive();
  const choices=up?pieceChoices(i):[];
  if(!choices.length){closePieceChooser();return;}
  // rebuilt only when the piece or what it offers changes, so a tap in progress survives a re-render
  const key=i+'|'+choices.map(c=>c[0]+(c[2]?'+':'-')).join(',');
  if(!pieceChooser||pieceChooser.dataset.key!==key){
    closePieceChooser();
    const box=document.createElement('div');box.id='piece-choice';box.dataset.key=key;
    choices.forEach(([icon,label,enabled,act])=>{
      const b=document.createElement('button');
      b.className='king-choice-btn';b.innerHTML=uiLabel(icon,label);b.disabled=!enabled;
      b.onclick=e=>{e.stopPropagation();if(!over&&!thinking&&isMyTurn())act();};
      box.appendChild(b);
    });
    document.body.appendChild(box);pieceChooser=box;
  }
  const sq=sqElAt(i);if(!sq){closePieceChooser();return;}
  const reach=p.type==='bishop'?2:1;
  const r=sq.getBoundingClientRect(),bw=pieceChooser.offsetWidth,bh=pieceChooser.offsetHeight;
  const below=r.bottom+reach*r.height+8,above=r.top-reach*r.height-8-bh;
  const behind=p.color==='w'?below:above,ahead=p.color==='w'?above:below;   // White pushes up, Black down
  const fits=t=>t>=6&&t+bh<=innerHeight-6;
  pieceChooser.style.left=Math.min(Math.max(r.left+r.width/2-bw/2,6),innerWidth-bw-6)+'px';
  pieceChooser.style.top=(fits(behind)||!fits(ahead)?behind:ahead)+'px';
}

// ── ACTIONS ──────────────────────────────────────────────────────────────────
function doSpawn(){
  if(over||thinking||!isMyTurn())return;
  const mc=myColor();
  if(spawnRemaining()<1){setStatus('Not enough Gold for a pawn (+1/'+GOLD_TURNS+' a turn)');return;}
  const ki=pieces.findIndex(p=>p&&p.color===mc&&p.type==='king');
  const bKi=pieces.findIndex(p=>p&&p.color!==mc&&p.type==='king');
  if(ki<0)return;
  const cands=adj8(ki).filter(i=>!pieces[i]&&!isTileBlocked(i));if(!cands.length){setStatus('No empty squares near king!');return;}
  const best=bKi>=0?cands.reduce((a,b)=>cheb(a,bKi)<cheb(b,bKi)?a:b):cands[0];
  pieces[best]={type:'pawn',color:mc,hp:STATS.pawn.hp,maxHp:STATS.pawn.maxHp,newborn:true,firstMove:true};
  spawnHistory.push(whiteTurnCount);
  addLog('Spawned pawn ('+goldText(spawnRemaining())+' Gold left)');spawnFlash(best);SFX.arrive('pawn');tutCheckAction('spawn');endTurn();
}

// arrow keys: pieces only move by drag or tap, so point the player there
function moveAll(dr,dc){
  if(over||thinking||!isMyTurn())return;
  setStatus('Drag a piece to move it');
}

function doMergeAll(){
  if(over||thinking||!isMyTurn())return;
  if(campaignLevel&&campaignLevel.noMerge){setStatus('No merge this round');return;}
  const mc=myColor();
  const tiers=[
    {a:'pawn',  b:'pawn',   r:'knight'},
    {a:'pawn',  b:'knight', r:'bishop'},
    {a:'knight',b:'bishop', r:'queen'},
    {a:'knight',b:'knight', r:'rook'},
  ];
  for(const {a,b,r} of tiers){
    for(let i=0;i<ROWS*COLS;i++){
      const pi=pieces[i];if(!pi||pi.color!==mc||pi.type!==a)continue;
      for(const j of adj8(i)){
        const pj=pieces[j];if(!pj||pj.color!==mc)continue;
        const match=(pi.type===a&&pj.type===b)||(a!==b&&pi.type===b&&pj.type===a);
        if(!match)continue;
        if(pi.fortified||pj.fortified)continue;   // a fortified pawn takes part in no merge
        pieces[i]=null;pieces[j]={type:r,color:mc,hp:STATS[r].hp,maxHp:STATS[r].maxHp};
        addLog('Merged '+a+'+'+b+' -> '+r+'@'+sqName(j));SFX.arrive(r);
        movedThisTurn=-1;
        setTimeout(()=>mergeFlash(j),50);
        endTurn();return;
      }
    }
  }
  setStatus('No adjacent pairs to merge');
}

function doSkip(){
  if(over||thinking||!isMyTurn())return;
  movedThisTurn=-1;
  addLog('Turn skipped');
  SFX.move();
  endTurn();
}
