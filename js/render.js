// ── RENDER ───────────────────────────────────────────────────────────────────
function render(){
  clampViewport();
  updateExploredTiles();
  const boardEl=document.getElementById('board'); boardEl.innerHTML='';
  const vRows=viewRowsN(), vCols=viewColsN();
  boardEl.style.gridTemplateColumns='repeat('+vCols+',1fr)';
  // the gap between tiles, thin but never thinner than a pixel
  boardEl.style.setProperty('--tile-ring',Math.max(1,Math.round(sqPx*0.018))+'px');
  const mc=myColor();
  const ki=pieces.findIndex(p=>p&&p.color===mc&&p.type==='king');
  const prodTgts=kingSelected&&ki>=0?new Set(adj8(ki).filter(i=>!pieces[i]&&!isTileBlocked(i))):new Set();
  const targets=mc==='w'?whiteTargets:blackTargets;
  // compute range highlight for single selected piece
  let selDests=null;
  if(selectedPieces.size===1&&!dragging&&!kingSelected&&!targetMode){
    const selIdx=[...selectedPieces][0];
    const selP=pieces[selIdx];
    if(selP&&selP.color===mc)selDests=getDragDests(selIdx);
  }
  // compute aura map: tileIdx -> 'type-color' class suffix
  // auras are shown for all pieces, including enemies in the fog (so players can sense threats)
  const auraMap=new Map();
  for(let pi=0;pi<ROWS*COLS;pi++){
    const pp=pieces[pi];if(!pp)continue;
    let zone=[];
    if(pp.type==='pawn')zone=adj8(pi);
    else if(pp.type==='knight')zone=kJumps(pi);
    else if(pp.type==='bishop'){const d=getDragDests(pi);zone=[...d.move,...d.attack];}
    else if(pp.type==='rook')zone=rookRange(pi);
    else if(pp.type==='siege')zone=siegeRange(pi);
    else if(pp.type==='queen')zone=queenRange(pi);
    else if(pp.type==='king')zone=adj8(pi);
    zone.forEach(j=>{
      if(!auraMap.has(j)) auraMap.set(j,{cls:pp.type+'-'+pp.color,count:1});
      else auraMap.get(j).count++;
    });
  }
  const pipW=Math.max(2,Math.floor(sqPx*.10))+'px';
  const pipH=Math.max(2,Math.floor(sqPx*.07))+'px';

  for(let r=viewRow0;r<viewRow0+vRows;r++){
    for(let c=viewCol0;c<viewCol0+vCols;c++){
      const i=idx(r,c);
      const sq=document.createElement('div');
      const thm=THEMES[mapTheme]||THEMES.jungle;
      sq.className='sq '+((r+c)%2===0?'lt':'dk');
      sq.style.background=(r+c)%2===0?thm.lt:thm.dk;
      sq.style.width=sqPx+'px'; sq.style.height=sqPx+'px';
      // fog of war: three visibility states
      const vis=tileVisibility(i);
      // theme scenery / obstacle sticker, under everything else the square holds
      if(vis!=='unknown'&&typeof tileArt==='function'){const art=tileArt(i);if(art)sq.appendChild(art);}
      if(vis==='unknown'){
        // unexplored — opaque fog cover hides everything
        sq.classList.add('fog','fog-unknown');
        const cov=document.createElement('div');cov.className='fog-cover';sq.appendChild(cov);
        if(c===viewCol0){const l=document.createElement('span');l.className='coord coord-rank';l.textContent=ROWS-r;sq.appendChild(l);}
        if(r===viewRow0+vRows-1){const l=document.createElement('span');l.className='coord coord-file';l.textContent=FILES[c];sq.appendChild(l);}
        boardEl.appendChild(sq);
        continue;
      }
      if(vis==='explored'){
        // explored but no scout — show obstacles and terrain under light fog, hide enemy pieces
        const ttype2=tileData[i];
        if(ttype2){
          const cssType2=ttype2==='sandstone-spawner'?'sandstone-spawner':ttype2;
          sq.classList.add('tile-'+cssType2);
          if(isTileBlocked(i))sq.classList.add('tile-blocked');
          if(ttype2==='sandstone-spawner'){
            const arch=document.createElement('div');arch.className='spawner-arch';sq.appendChild(arch);
          }
        }
        // still show auras so players can sense enemy threats in explored fog
        if(auraMap.has(i)){
          const {cls,count}=auraMap.get(i);
          sq.classList.add('aura-'+cls);
          if(count>=4)sq.classList.add('aura-depth-4');
          else if(count>=3)sq.classList.add('aura-depth-3');
          else if(count>=2)sq.classList.add('aura-depth-2');
        }
        sq.classList.add('fog','fog-explored');
        const cov2=document.createElement('div');cov2.className='fog-cover';sq.appendChild(cov2);
        if(c===viewCol0){const l=document.createElement('span');l.className='coord coord-rank';l.textContent=ROWS-r;sq.appendChild(l);}
        if(r===viewRow0+vRows-1){const l=document.createElement('span');l.className='coord coord-file';l.textContent=FILES[c];sq.appendChild(l);}
        boardEl.appendChild(sq);
        continue;
      }
      const ttype=tileData[i];
      if(ttype){
        const cssType=ttype==='sandstone-spawner'?'sandstone-spawner':ttype;
        sq.classList.add('tile-'+cssType);
        if(isTileBlocked(i))sq.classList.add('tile-blocked');
        if(ttype==='sandstone-spawner'){
          const arch=document.createElement('div');arch.className='spawner-arch';sq.appendChild(arch);
        }
      }

      if(dragging&&dragDests){
        if(i===dragSrc)sq.style.opacity='0.28';
        else{
          let dcls='';
          if(dragDests.merge.has(i)){sq.classList.add('drop-mrg');dcls='sel-move-ov';}
          else if(dragDests.attack.has(i)){sq.classList.add('drop-atk');dcls='sel-atk-ov';}
          else if(dragDests.heal.has(i)){sq.classList.add('drop-heal');dcls='sel-heal-ov';}
          else if(dragDests.move.has(i)){sq.classList.add('drop-ok');dcls='sel-move-ov';}
          if(dcls){const ov=document.createElement('div');ov.className='sel-overlay '+dcls;sq.appendChild(ov);}
        }
      }else if(targetMode&&targetSrc>=0&&pieces[targetSrc]){
        const p=pieces[targetSrc];
        if(p.type==='bishop'){
          if(pieces[i]&&pieces[i].color===mc&&i!==targetSrc)sq.classList.add('drop-heal');
        }else{
          const atk=p.type==='queen'?new Set(queenRange(targetSrc).filter(j=>pieces[j]&&pieces[j].color!==mc)):p.type==='rook'?new Set(rookRange(targetSrc).filter(j=>pieces[j]&&pieces[j].color!==mc)):new Set(adj8(targetSrc).filter(j=>pieces[j]&&pieces[j].color!==mc));
          if(atk.has(i))sq.classList.add('drop-atk');
        }
      }else{
        if(kingSelected&&i===ki)sq.classList.add('sel');
        else if(selectedPieces.has(i))sq.classList.add('sel');
        // aura always shown — type color + stacking depth
        if(auraMap.has(i)){
          const {cls,count}=auraMap.get(i);
          sq.classList.add('aura-'+cls);
          if(count>=4)sq.classList.add('aura-depth-4');
          else if(count>=3)sq.classList.add('aura-depth-3');
          else if(count>=2)sq.classList.add('aura-depth-2');
        }
        // selection overlay — clear solid highlight for move/attack/heal
        if(selDests){
          let cls='';
          if(selDests.attack&&selDests.attack.has(i))cls='sel-atk';
          else if(selDests.heal&&selDests.heal.has(i))cls='sel-heal';
          else if(selDests.move&&selDests.move.has(i))cls='sel-move';
          if(cls){
            sq.classList.add(cls);
            const ov=document.createElement('div');
            ov.className='sel-overlay '+cls+'-ov';
            sq.appendChild(ov);
          }
        }
        if(!dragging&&i===blackLastFrom)sq.classList.add('last-from');
        if(!dragging&&i===blackLastTo)sq.classList.add('last-to');
      }

      // attack/heal target indicators
      const isAtkTarget=Object.entries(targets).some(([s,t])=>parseInt(t)===i&&pieces[parseInt(s)]&&pieces[parseInt(s)].color===mc&&pieces[parseInt(s)].type!=='bishop');
      const isHealTarget=Object.entries(targets).some(([s,t])=>parseInt(t)===i&&pieces[parseInt(s)]&&pieces[parseInt(s)].color===mc&&pieces[parseInt(s)].type==='bishop');
      const hasTarget=targets[i]!==undefined&&pieces[i]&&pieces[i].color===mc;
      if(isAtkTarget)sq.classList.add('atk-target');
      if(isHealTarget)sq.classList.add('heal-target');
      if(hasTarget)sq.classList.add('has-target');

      const p=(dragging&&i===dragSrc)?null:pieces[i];
      if(!p&&prodTgts.has(i)){
        const div=document.createElement('div');div.className='piece piece-ghost';
        div.innerHTML=pieceSVG('pawn',mc,mapTheme,Math.floor(sqPx*.86));
        sq.appendChild(div);
      }else if(p){
        const div=document.createElement('div');div.className='piece';
        if(p.newborn){const aura=document.createElement('div');aura.className='newborn-aura';div.appendChild(aura);}
        // piece artwork comes from the map theme's set in pieces/
        const svgWrap=document.createElement('div');
        svgWrap.style.cssText='position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:1;';
        svgWrap.innerHTML=pieceSVG(p.type,p.color,mapTheme,Math.floor(sqPx*.86));
        div.appendChild(svgWrap);
        const bar=document.createElement('div');bar.className='hp-bar';

        for(let h=0;h<p.maxHp;h++){const pip=document.createElement('div');pip.className='hp-pip '+(h<p.hp?'full-':'empty-')+p.color;pip.style.width=pipW;pip.style.height=pipH;bar.appendChild(pip);}
        div.appendChild(bar);
        // mana pips for bishops
        if(p.type==='bishop'){
          const manaMax=2,mana=p.mana||0;
          const mpW=Math.max(3,Math.floor(sqPx*.09))+'px';
          const mpH=mpW;
          const mbar=document.createElement('div');mbar.className='mana-bar';

          for(let m=0;m<manaMax;m++){const mp=document.createElement('div');mp.className='mana-pip'+(m<mana?'':' empty');mp.style.width=mpW;mp.style.height=mpH;mbar.appendChild(mp);}
          div.appendChild(mbar);
        }
        sq.appendChild(div);
      }

      // animals rendered in separate overlay by renderAnimalOverlay()
      if(c===viewCol0){const l=document.createElement('span');l.className='coord coord-rank';l.textContent=ROWS-r;sq.appendChild(l);}
      if(r===viewRow0+vRows-1){const l=document.createElement('span');l.className='coord coord-file';l.textContent=FILES[c];sq.appendChild(l);}
      boardEl.appendChild(sq);
    }
  }
}

function sqElAt(i){
  const r=ROW(i),c=COL(i);
  const vRows=viewRowsN(),vCols=viewColsN();
  if(r<viewRow0||r>=viewRow0+vRows||c<viewCol0||c>=viewCol0+vCols)return null;
  const localR=r-viewRow0, localC=c-viewCol0;
  return document.getElementById('board').children[localR*vCols+localC]||null;
}
function flashSq(i,cls){const el=sqElAt(i);if(!el)return;el.classList.add(cls);setTimeout(()=>el&&el.classList.remove(cls),500);}
function spawnFlash(i){
  const el=sqElAt(i);if(!el)return;
  const p=el.querySelector('.piece');
  if(p){p.style.animation='none';void p.offsetWidth;p.style.animation='spawnPop .45s cubic-bezier(.2,1.6,.4,1)';setTimeout(()=>{if(p)p.style.animation='';},500);}
  // ring burst at tile center
  const rect=el.getBoundingClientRect();
  const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
  const ring=document.createElement('div');
  ring.style.cssText='position:fixed;pointer-events:none;z-index:600;'
    +'left:'+cx+'px;top:'+cy+'px;'
    +'width:'+sqPx+'px;height:'+sqPx+'px;'
    +'border-radius:50%;border:3px solid rgba(200,240,80,.8);'
    +'animation:spawnRing .45s ease-out forwards;';
  document.body.appendChild(ring);
  setTimeout(()=>ring.remove(),480);
}

function mergeFlash(i){
  const el=sqElAt(i);if(!el)return;
  const p=el.querySelector('.piece');
  if(p){p.style.animation='none';void p.offsetWidth;p.style.animation='mergeFlash .55s ease-out';setTimeout(()=>{if(p)p.style.animation='';},600);}
  // two rings for merge
  const rect=el.getBoundingClientRect();
  const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
  [0,120].forEach(delay=>{
    const ring=document.createElement('div');
    ring.style.cssText='position:fixed;pointer-events:none;z-index:600;'
      +'left:'+cx+'px;top:'+cy+'px;'
      +'width:'+(sqPx*1.1)+'px;height:'+(sqPx*1.1)+'px;'
      +'border-radius:50%;border:2.5px solid rgba(100,200,255,.85);'
      +'animation:spawnRing .5s ease-out forwards;animation-delay:'+delay+'ms;opacity:0;';
    ring.style.animationFillMode='both';
    document.body.appendChild(ring);
    setTimeout(()=>ring.remove(),650+delay);
  });
}
