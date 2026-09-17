// ── NEUTRAL ANIMALS ──────────────────────────────────────────────────────────

// persistent animal DOM elements for smooth transitions
const animalDivs=new Map();

// ── CONTINUOUS ANIMAL ANIMATION ──────────────────────────────────────────────
function startAnimalLoop(){
  if(animalAnimId)cancelAnimationFrame(animalAnimId);
  animalLastTime=0;
  function loop(ts){
    animalAnimId=requestAnimationFrame(loop);
    if(!animalLastTime){animalLastTime=ts;return;}
    const dt=Math.min(ts-animalLastTime,100);
    animalLastTime=ts;
    if(over)return;
    updateAnimals(dt);
    renderAnimalOverlay();
  }
  requestAnimationFrame(loop);
}

function stopAnimalLoop(){
  if(animalAnimId){cancelAnimationFrame(animalAnimId);animalAnimId=null;}
}

function updateAnimals(dt){
  animals.forEach(na=>{
    if(na.waitMs>0){na.waitMs-=dt;return;}
    const dx=na.tx-na.x, dy=na.ty-na.y;
    const dist=Math.hypot(dx,dy);
    if(dist<0.01){
      na.x=na.tx; na.y=na.ty;
      na.waitMs=1500+Math.random()*2500;
      const candidates=[];
      for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
        if(!dr&&!dc)continue;
        const nr=Math.round(na.ty-0.5)+dr, nc=Math.round(na.tx-0.5)+dc;
        if(!inB(nr,nc))continue;
        if(nc<1||nc>COLS-2||nr<1||nr>ROWS-2)continue;
        const gi=idx(nr,nc);
        if(pieces[gi])continue;
        if(!na.isTornado&&isTileBlocked(gi))continue;
        candidates.push({tx:nc+0.5,ty:nr+0.5});
      }
      if(candidates.length){
        const pick=candidates[Math.floor(Math.random()*candidates.length)];
        na.tx=pick.tx; na.ty=pick.ty;
      }
      // tornado: occasionally spawns a black pawn (shark) as enemy
      if(na.isTornado){
        na.spawnTimer=(na.spawnTimer||0)+1;
        if(na.spawnTimer>60&&Math.random()<0.012){
          na.spawnTimer=0;
          const tr=Math.round(na.ty-0.5),tc2=Math.round(na.tx-0.5);
          if(inB(tr,tc2)){
            const emp=adj8(idx(Math.max(0,Math.min(ROWS-1,tr)),Math.max(0,Math.min(COLS-1,tc2)))).filter(j=>!pieces[j]&&!isTileBlocked(j));
            if(emp.length){const dest=emp[Math.floor(Math.random()*emp.length)];pieces[dest]={type:'pawn',color:'b',hp:2,maxHp:2};addLog('Tornado spawns a shark!');render();setTimeout(()=>spawnFlash(dest),50);}
          }
        }
      }
      // push: if animal shares tile with a piece, randomly push it
      const curR2=Math.floor(na.y),curC2=Math.floor(na.x);
      if(inB(curR2,curC2)){
        const ci2=idx(curR2,curC2);
        if(pieces[ci2]&&Math.random()<0.15){
          const pushDirs=adj8(ci2).filter(j=>!pieces[j]&&!isTileBlocked(j));
          if(pushDirs.length){
            const dest2=pushDirs[Math.floor(Math.random()*pushDirs.length)];
            const pp=pieces[ci2];
            pieces[dest2]=pp;pieces[ci2]=null;
            addLog(na.emoji+' bumps '+pp.type+'→'+sqName(dest2));
            render();
          }
        }
      }
      // aggressive: bite if a game piece is adjacent to current tile
      if(na.aggressive){
        const cr=Math.round(na.y-0.5), cc=Math.round(na.x-0.5);
        const ci=idx(Math.max(0,Math.min(ROWS-1,cr)),Math.max(0,Math.min(COLS-1,cc)));
        const adjTargets=adj8(ci).filter(j=>pieces[j]);
        if(adjTargets.length){
          na.fractDmg=(na.fractDmg||0)+0.5;
          if(na.fractDmg>=1){
            na.fractDmg=0;
            const tgt=adjTargets[Math.floor(Math.random()*adjTargets.length)];
            const tp=pieces[tgt];
            if(tp){
              tp.hp--;
              if(campaignLevel&&tp.color===myColor()&&tp.type==='king')campaignKingHit=true;
              addLog(na.emoji+' bites '+tp.type+'@'+sqName(tgt)+' '+tp.hp+'HP');
              flashSq(tgt,'hit-flash');
              const tc=sqCenter(tgt);
              const ax=na.x*sqPx,ay=na.y*sqPx;
              const board=document.getElementById('board');
              if(board){const br=board.getBoundingClientRect();emojiAnim(na.emoji,br.left+ax,br.top+ay,tc.x,tc.y,sqPx*.5,220,()=>{});}
              if(tp.hp<=0){showDeath(tgt,tp.color,tp.type);SFX.fall(tp.type);pieces[tgt]=null;if(campaignLevel){const cr=checkCampaignWin();if(cr)over=true;}else if(tp.type==='king')over=true;}
              render();
            }
          }
        }
      }
    }else{
      const step=na.speed*dt;
      const move=Math.min(step,dist);
      na.x+=dx/dist*move;
      na.y+=dy/dist*move;
      const tileR=Math.floor(na.y), tileC=Math.floor(na.x);
      if(tileR!==na.prevTileR||tileC!==na.prevTileC){
        na.prevTileR=tileR;na.prevTileC=tileC;
        if(inB(tileR,tileC)){
          const ti=idx(tileR,tileC);
          const el=sqElAt(ti);
          if(el){el.style.transition='background .25s';setTimeout(()=>{if(el)el.style.transition='';},300);}
        }
      }
    }
  });
}

function buildMummySVG(sz){
  return `<svg viewBox="0 0 60 80" width="${sz}" height="${sz}" xmlns="http://www.w3.org/2000/svg">
    <!-- body wraps -->
    <rect x="14" y="28" width="32" height="42" rx="6" fill="#e8e0cc" stroke="#b8a878" stroke-width="1.5"/>
    <!-- bandage lines on body -->
    <line x1="14" y1="38" x2="46" y2="38" stroke="#b8a878" stroke-width="1.5" opacity=".6"/>
    <line x1="14" y1="48" x2="46" y2="48" stroke="#b8a878" stroke-width="1.5" opacity=".6"/>
    <line x1="14" y1="58" x2="46" y2="58" stroke="#b8a878" stroke-width="1.5" opacity=".6"/>
    <!-- arms -->
    <rect x="2" y="32" width="12" height="8" rx="4" fill="#e8e0cc" stroke="#b8a878" stroke-width="1.5" transform="rotate(-15 8 36)"/>
    <rect x="46" y="32" width="12" height="8" rx="4" fill="#e8e0cc" stroke="#b8a878" stroke-width="1.5" transform="rotate(15 52 36)"/>
    <!-- head -->
    <ellipse cx="30" cy="18" rx="14" ry="16" fill="#e8e0cc" stroke="#b8a878" stroke-width="1.5"/>
    <!-- bandage on head -->
    <path d="M16,10 Q30,4 44,10" stroke="#b8a878" stroke-width="2" fill="none" opacity=".7"/>
    <path d="M16,20 Q30,14 44,20" stroke="#b8a878" stroke-width="2" fill="none" opacity=".6"/>
    <!-- eyes (hollow dark holes) -->
    <ellipse cx="22" cy="18" rx="4" ry="5" fill="#2a1800" opacity=".9"/>
    <ellipse cx="38" cy="18" rx="4" ry="5" fill="#2a1800" opacity=".9"/>
    <!-- eye glow -->
    <ellipse cx="22" cy="18" rx="2" ry="2.5" fill="#c8ff40" opacity=".7"/>
    <ellipse cx="38" cy="18" rx="2" ry="2.5" fill="#c8ff40" opacity=".7"/>
  </svg>`;
}

function renderAnimalOverlay(){
  const wrap=document.getElementById('board-inner')||document.getElementById('board-wrap');
  if(!wrap)return;
  const fs=Math.max(12,Math.floor(sqPx*.52))+'px';
  const pipW=Math.max(3,Math.floor(sqPx*.10))+'px';
  const pipH=Math.max(2,Math.floor(sqPx*.06))+'px';
  const botOff=Math.max(4,Math.floor(sqPx*.14))+'px';

  // remove divs for animals that no longer exist
  const alive=new Set(animals.map((_,i)=>i));
  for(const[k,el] of animalDivs){
    if(!alive.has(k)){el.remove();animalDivs.delete(k);}
  }

  animals.forEach((na,i)=>{
    // the overlay sits inside the board, so the board's own zoom and pan carry it along
    const px=na.x*sqPx, py=na.y*sqPx;
    let inView=true; // hidden only by fog
    if(inView&&!mapCheat){
      const ar=Math.round(na.y-0.5),ac=Math.round(na.x-0.5);
      if(inB(ar,ac)&&!isTileVisible(idx(ar,ac)))inView=false;
    }
    let div=animalDivs.get(i);
    if(!div){
      div=document.createElement('div');
      div.className='animal-el';
      div.style.cssText='position:absolute;pointer-events:none;z-index:50;'
        +'transform:translate(-50%,-50%);will-change:left,top;'
        +'font-size:'+fs+';line-height:1;';
      const em=document.createElement('span');em.className='animal-glyph';
      if(na.isMummy){
        em.innerHTML=buildMummySVG(Math.floor(sqPx*.7));
        em.style.display='block';
      }else{
        em.textContent=na.emoji;
      }
      div.appendChild(em);
      const bar=document.createElement('div');bar.className='animal-bar';
      bar.style.cssText='position:absolute;bottom:-'+botOff+';left:50%;transform:translateX(-50%);display:flex;gap:1px;';
      for(let h=0;h<na.maxHp;h++){
        const pip=document.createElement('div');pip.className='animal-pip';
        pip.style.cssText='width:'+pipW+';height:'+pipH+';border-radius:1px;';
        bar.appendChild(pip);
      }
      div.appendChild(bar);
      wrap.appendChild(div);
      animalDivs.set(i,div);
      div.style.left=px+'px';div.style.top=py+'px';
      requestAnimationFrame(()=>{
        if(div.isConnected)div.style.transition='left 80ms linear,top 80ms linear';
      });
    }else{
      div.style.left=px+'px';div.style.top=py+'px';
    }
    if(na.isTornado){
      div.style.filter='drop-shadow(0 0 8px rgba(100,180,255,.9))';
      div.style.animation='swirlSpin 1.2s linear infinite';
    }else if(na.isMummy){
      div.style.opacity='1';
      div.style.filter='drop-shadow(0 0 6px rgba(180,220,60,.85)) drop-shadow(0 0 2px rgba(100,160,20,.9)) sepia(.4) hue-rotate(20deg)';
      div.style.animation='mummyPulse 1.8s ease-in-out infinite';
    }else{
      div.style.opacity='1';
      div.style.filter=na.aggressive?'drop-shadow(0 0 5px rgba(255,40,10,.9)) drop-shadow(0 0 2px rgba(255,0,0,.6))':'';
      div.style.animation='';
    }
    div.style.fontSize=fs;
    div.style.display=inView?'':'none';
    const pips=div.querySelectorAll('.animal-pip');
    pips.forEach((pip,h)=>{pip.style.background=h<na.hp?'#c0a040':'rgba(0,0,0,.25)';pip.style.width=pipW;pip.style.height=pipH;});
  });
}
