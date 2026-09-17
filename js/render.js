// ── RENDER ───────────────────────────────────────────────────────────────────
function render(){
  clampViewport();
  updateExploredTiles();
  const boardEl=document.getElementById('board'); boardEl.innerHTML='';
  boardEl.style.gridTemplateColumns='repeat('+COLS+',1fr)';
  // the gap between tiles, thin but never thinner than a pixel
  boardEl.style.setProperty('--tile-ring',Math.max(1,Math.round(sqPx*0.018))+'px');
  // coordinates on a clouded square take the colour of the map's weather
  boardEl.style.setProperty('--fog-text',fogStyle().text);
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
  // the piece the action guide is for: the one being dragged, else the one selected
  const guideSrc=dragging&&dragDests?dragSrc:selDests?[...selectedPieces][0]:-1;
  const pipW=Math.max(2,Math.floor(sqPx*.10))+'px';
  const pipH=Math.max(2,Math.floor(sqPx*.07))+'px';

  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const i=idx(r,c);
      const sq=document.createElement('div');
      const thm=THEMES[mapTheme]||THEMES.forest;
      sq.className='sq '+((r+c)%2===0?'lt':'dk');
      sq.style.background=(r+c)%2===0?thm.lt:thm.dk;
      sq.style.width=sqPx+'px'; sq.style.height=sqPx+'px';
      // fog of war: three visibility states
      const vis=tileVisibility(i);
      // theme scenery / obstacle sticker, under everything else the square holds
      if(vis!=='unknown'&&typeof tileArt==='function'){const art=tileArt(i);if(art)sq.appendChild(art);}
      // the spring and the mine are landmarks: their place stays known through the fog
      const res=typeof RESOURCE_TILES!=='undefined'?RESOURCE_TILES[tileData[i]]:null;
      if(res)sq.classList.add('tile-'+tileData[i]);
      if(vis==='unknown'){
        // unexplored — thick cloud hides everything
        sq.classList.add('fog','fog-unknown');
        sq.appendChild(fogCover(i,'unknown'));
        if(res){const m=document.createElement('span');m.className='res-ghost res-'+res;sq.appendChild(m);}
        if(c===0){const l=document.createElement('span');l.className='coord coord-rank';l.textContent=ROWS-r;sq.appendChild(l);}
        if(r===ROWS-1){const l=document.createElement('span');l.className='coord coord-file';l.textContent=FILES[c];sq.appendChild(l);}
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
        sq.classList.add('fog','fog-explored');
        sq.appendChild(fogCover(i,'explored'));
        if(res){const m=document.createElement('span');m.className='res-ghost res-'+res;sq.appendChild(m);}
        if(c===0){const l=document.createElement('span');l.className='coord coord-rank';l.textContent=ROWS-r;sq.appendChild(l);}
        if(r===ROWS-1){const l=document.createElement('span');l.className='coord coord-file';l.textContent=FILES[c];sq.appendChild(l);}
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

      // scrying: the squares this bishop may light, and the ones already burning
      if(typeof scryMode!=='undefined'&&scryMode&&scrySrc>=0&&scryTargets(scrySrc).has(i))sq.classList.add('scry-target');
      const lit=typeof scryLit==='function'&&scryLit(i,mc);
      if(lit)sq.classList.add('scry-lit');
      // a campaign level's goal squares: the gate to reach, the floor to hold
      if(campaignLevel&&campaignLevel.squares&&campaignLevel.squares.some(([gr,gc])=>gr===r&&gc===c))sq.classList.add('goal-tile');
      // action guide: what the tapped or dragged piece can do on this square (drawn over the piece below)
      let guide=null;
      if(dragging&&dragDests){
        if(i===dragSrc)sq.style.opacity='0.28';
        else guide=guideAt(dragDests,i);
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
        if(selDests)guide=guideAt(selDests,i);
        if(!dragging&&i===blackLastFrom)sq.classList.add('last-from');
        if(!dragging&&i===blackLastTo&&!isConcealedFrom(i,mc))sq.classList.add('last-to');
      }

      // undergrowth: an enemy hidden here isn't drawn (Map Cheat shows it faintly)
      const concealedHere=isConcealedFrom(i,mc);
      // attack/heal target indicators
      const isAtkTarget=Object.entries(targets).some(([s,t])=>parseInt(t)===i&&pieces[parseInt(s)]&&pieces[parseInt(s)].color===mc&&pieces[parseInt(s)].type!=='bishop');
      const isHealTarget=Object.entries(targets).some(([s,t])=>parseInt(t)===i&&pieces[parseInt(s)]&&pieces[parseInt(s)].color===mc&&pieces[parseInt(s)].type==='bishop');
      const hasTarget=targets[i]!==undefined&&pieces[i]&&pieces[i].color===mc;
      if(isAtkTarget&&!concealedHere)sq.classList.add('atk-target');
      if(isHealTarget)sq.classList.add('heal-target');
      if(hasTarget)sq.classList.add('has-target');

      let p=(dragging&&i===dragSrc)?null:pieces[i];
      if(p&&concealedHere&&!mapCheat)p=null;
      // the king in spawn mode: a ghost pawn on each square one can be placed on
      if(!p&&prodTgts.has(i))guide='spawn';
      if(p){
        const div=document.createElement('div');div.className='piece'+(concealedHere?' piece-concealed':'');
        if(p.newborn){const aura=document.createElement('div');aura.className='newborn-aura';div.appendChild(aura);}
        // piece artwork comes from the map theme's set in pieces/
        const svgWrap=document.createElement('div');svgWrap.className='piece-art';
        svgWrap.style.cssText='position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:1;';
        svgWrap.innerHTML=pieceSVG(p.type,p.color,mapTheme,Math.floor(sqPx*.86));
        div.appendChild(svgWrap);
        // standing in undergrowth: leaves in front of the piece, under its HP pips
        if(tileData[i]==='undergrowth'&&typeof undergrowthFront==='function')div.appendChild(undergrowthFront());
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
      if(guide){
        if(guide==='merge'||guide==='merge-heal')sq.classList.add('guide-merge-tile');
        sq.appendChild(guideEl(guide,guide==='spawn'?ki:guideSrc,i));
      }

      // animals rendered in separate overlay by renderAnimalOverlay()
      if(lit){
        // how many of your turns the light has left
        const turns=Math.max(...scans.filter(sc=>sc.color===mc&&sc.tiles.includes(i)).map(sc=>sc.turns));
        const n=document.createElement('span');n.className='scry-count';n.textContent=turns;sq.appendChild(n);
      }
      if(c===0){const l=document.createElement('span');l.className='coord coord-rank';l.textContent=ROWS-r;sq.appendChild(l);}
      if(r===ROWS-1){const l=document.createElement('span');l.className='coord coord-file';l.textContent=FILES[c];sq.appendChild(l);}
      boardEl.appendChild(sq);
    }
  }
  // the king's Spawn / Move chooser follows the king, and goes once the king is put down
  if(typeof syncKingChooser==='function')syncKingChooser();
}

// ── ACTION GUIDE ─────────────────────────────────────────────────────────────
// A tapped or dragged piece shows what it can do: a see-through copy of itself where it can move,
// a red target on enemies it can attack, and on friendly pieces in reach the piece a merge would
// make (with a blue +) and/or a green heart for a heal. Tapping a marker takes that action.
function guideAt(d,i){
  if(d.attack.has(i))return 'attack';
  // a level without merging offers nothing on the allies a merge would use (dropping there is refused)
  if(d.merge.has(i)&&campaignLevel&&campaignLevel.noMerge)return null;
  const merge=d.merge.has(i),heal=d.heal.has(i);
  if(merge&&heal)return 'merge-heal';
  if(merge)return 'merge';
  if(heal)return 'heal';
  return d.move.has(i)?'move':null;
}
const GUIDE_TARGET='<svg class="guide-mark" viewBox="0 0 100 100"><g fill="none" stroke-linecap="round">'
  +'<circle cx="50" cy="50" r="33" stroke="rgba(50,6,2,.6)" stroke-width="12"/>'
  +'<path d="M50 6 V24 M50 76 V94 M6 50 H24 M76 50 H94" stroke="rgba(50,6,2,.6)" stroke-width="12"/>'
  +'<circle cx="50" cy="50" r="33" stroke="#FF4A36" stroke-width="6"/>'
  +'<path d="M50 6 V24 M50 76 V94 M6 50 H24 M76 50 H94" stroke="#FF4A36" stroke-width="6"/></g></svg>';
const GUIDE_RING=(fill,stroke,dash)=>'<svg class="guide-mark" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="'+fill
  +'" stroke="'+stroke+'" stroke-width="5"'+(dash?' stroke-dasharray="11 7"':'')+'/></svg>';
const GUIDE_MERGE_BADGE='<svg class="guide-badge guide-badge-l" viewBox="-20 -20 40 40"><circle r="16" fill="#2E8FE0" stroke="#0B2A4A" stroke-width="3.5"/>'
  +'<path d="M-8 0 H8 M0 -8 V8" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>';
const GUIDE_SPAWN_BADGE='<svg class="guide-badge guide-badge-r" viewBox="-20 -20 40 40"><circle r="16" fill="#F2B233" stroke="#4A3208" stroke-width="3.5"/>'
  +'<path d="M-8 0 H8 M0 -8 V8" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>';
const GUIDE_HEAL_BADGE='<svg class="guide-badge guide-badge-r" viewBox="-20 -20 40 40"><circle r="16" fill="#2FBF5A" stroke="#0E3A1A" stroke-width="3.5"/>'
  +'<path d="M0 9 C-14 -1 -9 -13 0 -6 C9 -13 14 -1 0 9 Z" fill="#fff"/></svg>';
function guideEl(kind,src,i){
  const el=document.createElement('div');el.className='guide guide-'+kind;
  const sp=pieces[src];if(!sp)return el;
  const size=Math.floor(sqPx*.86);
  if(kind==='move'){
    el.innerHTML='<div class="guide-piece">'+pieceSVG(sp.type,sp.color,mapTheme,size)+'</div>';
  }else if(kind==='spawn'){
    // src is the king: a ghost pawn of its colour with a gold +
    el.innerHTML='<div class="guide-piece">'+pieceSVG('pawn',sp.color,mapTheme,size)+'</div>'+GUIDE_SPAWN_BADGE;
  }else if(kind==='attack'){
    el.innerHTML=GUIDE_TARGET;
  }else if(kind==='heal'){
    el.innerHTML=GUIDE_RING('rgba(67,211,107,.16)','#43D36B')+GUIDE_HEAL_BADGE;
  }else{
    // a merge shows the piece it makes over the faded ally (a bishop on a wounded knight can also heal)
    const t=pieces[i],nt=t?mergeResultType(sp.type,t.type):null;
    el.innerHTML=GUIDE_RING('rgba(58,160,240,.16)','#3AA0F0',true)
      +(nt?'<div class="guide-piece">'+pieceSVG(nt,sp.color,mapTheme,size)+'</div>':'')
      +GUIDE_MERGE_BADGE+(kind==='merge-heal'?GUIDE_HEAL_BADGE:'');
  }
  return el;
}

function sqElAt(i){
  return document.getElementById('board').children[ROW(i)*COLS+COL(i)]||null;
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
  // only the artwork hops (the pips stay put), and the hop stays inside the square
  const p=el.querySelector('.piece-art')||el.querySelector('.piece');
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
