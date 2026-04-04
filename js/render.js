// ── RENDER ───────────────────────────────────────────────────────────────────
function render(){
  const boardEl=document.getElementById('board'); boardEl.innerHTML='';
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
  const auraMap=new Map();
  for(let pi=0;pi<ROWS*COLS;pi++){
    const pp=pieces[pi];if(!pp)continue;
    let zone=[];
    if(pp.type==='pawn')zone=adj8(pi);
    else if(pp.type==='knight')zone=kJumps(pi);
    else if(pp.type==='bishop'){const d=getDragDests(pi);zone=[...d.move,...d.attack];}
    else if(pp.type==='rook')zone=rookRange(pi);
    else if(pp.type==='siege')zone=siegeRange(pi);
    else if(pp.type==='queen'){const d=getDragDests(pi);zone=[...d.move,...d.attack];}
    else if(pp.type==='king')zone=adj8(pi);
    zone.forEach(j=>{
      if(!auraMap.has(j)) auraMap.set(j,{cls:pp.type+'-'+pp.color,count:1});
      else auraMap.get(j).count++;
    });
  }
  const pipW=Math.max(2,Math.floor(sqPx*.10))+'px';
  const pipH=Math.max(2,Math.floor(sqPx*.07))+'px';

  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const i=idx(r,c);
      const sq=document.createElement('div');
      const thm=THEMES[mapTheme]||THEMES.jungle;
      sq.className='sq '+((r+c)%2===0?'lt':'dk');
      sq.style.background=(r+c)%2===0?thm.lt:thm.dk;
      const ttype=tileData[i];
      if(ttype){
        const cssType=ttype==='sandstone-spawner'?'sandstone-spawner':ttype;
        sq.classList.add('tile-'+cssType);
        if(isTileBlocked(i))sq.classList.add('tile-blocked');
        if(ttype==='sandstone-spawner'){
          const arch=document.createElement('div');arch.className='spawner-arch';sq.appendChild(arch);
        }
      }
      sq.style.width=sqPx+'px'; sq.style.height=sqPx+'px';

      if(dragging&&dragDests){
        if(i===dragSrc)sq.style.opacity='0.28';
        else if(dragDests.merge.has(i))sq.classList.add('drop-mrg');
        else if(dragDests.attack.has(i))sq.classList.add('drop-atk');
        else if(dragDests.heal.has(i))sq.classList.add('drop-heal');
        else if(dragDests.move.has(i))sq.classList.add('drop-ok');
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
        // selection overlay on top
        if(selDests){
          if(selDests.move.has(i))sq.classList.add('show-move');
          else if(selDests.attack.has(i))sq.classList.add('show-atk');
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
        const gl=document.createElement('span');gl.className='glyph glyph-'+mc;gl.textContent='♙';
        div.appendChild(gl);sq.appendChild(div);
      }else if(p){
        const div=document.createElement('div');div.className='piece';
        if(p.newborn){const aura=document.createElement('div');aura.className='newborn-aura';div.appendChild(aura);}
        if(p.color==='b'){
          const svgWrap=document.createElement('div');
          svgWrap.style.cssText='position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:1;';
          svgWrap.innerHTML=buildBlackPieceSVG(p.type,sqPx);
          div.appendChild(svgWrap);
        }else if(p.type==='siege'){
          // Siege tower: inline SVG — stacked rook battlements
          const sz=Math.floor(sqPx*.82);
          const svgWrap=document.createElement('div');
          svgWrap.style.cssText='position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:1;';
          svgWrap.innerHTML=`<svg viewBox="0 0 100 100" width="${sz}" height="${sz}" xmlns="http://www.w3.org/2000/svg">
            <!-- base block -->
            <rect x="20" y="55" width="60" height="35" rx="3" fill="#d0d0e0" stroke="#888" stroke-width="2"/>
            <!-- battlements row 1 -->
            <rect x="20" y="42" width="14" height="18" rx="2" fill="#c8c8d8" stroke="#888" stroke-width="1.5"/>
            <rect x="43" y="42" width="14" height="18" rx="2" fill="#c8c8d8" stroke="#888" stroke-width="1.5"/>
            <rect x="66" y="42" width="14" height="18" rx="2" fill="#c8c8d8" stroke="#888" stroke-width="1.5"/>
            <!-- platform line -->
            <rect x="18" y="50" width="64" height="6" rx="1" fill="#b0b0c8"/>
            <!-- twin swords crossed on face -->
            <line x1="32" y1="68" x2="68" y2="88" stroke="#c8a040" stroke-width="4" stroke-linecap="round"/>
            <line x1="68" y1="68" x2="32" y2="88" stroke="#c8a040" stroke-width="4" stroke-linecap="round"/>
            <circle cx="32" cy="68" r="3" fill="#e8c060"/>
            <circle cx="68" cy="68" r="3" fill="#e8c060"/>
            <!-- shine -->
            <rect x="22" y="57" width="8" height="20" rx="2" fill="rgba(255,255,255,.18)"/>
          </svg>`;
          div.appendChild(svgWrap);
        }else{
          const gl=document.createElement('span');gl.className='glyph glyph-'+p.color;
          gl.textContent=GLYPH[p.type+'_'+p.color]||'?';div.appendChild(gl);
        }
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
      if(c===0){const l=document.createElement('span');l.className='coord coord-rank';l.textContent=ROWS-r;sq.appendChild(l);}
      if(r===ROWS-1){const l=document.createElement('span');l.className='coord coord-file';l.textContent=FILES[c];sq.appendChild(l);}
      boardEl.appendChild(sq);
    }
  }
}

function sqElAt(i){return document.getElementById('board').children[i]||null;}
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
