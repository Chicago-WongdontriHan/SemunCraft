// ── UI ───────────────────────────────────────────────────────────────────────
function setStatus(t){document.getElementById('status').textContent=t;}
function addLog(msg){logLines.push(msg);if(logLines.length>4)logLines.shift();document.getElementById('log').textContent=logLines.join(' · ');}

function syncUI(){
  const locked=over||thinking||!isMyTurn();
  ['spawn','merge','target','skip'].forEach(id=>{const b=document.getElementById('btn-'+id);if(b)b.disabled=locked;});
  document.getElementById('btn-new').disabled=false;
  const tb=document.getElementById('btn-target');
  if(tb){tb.classList.toggle('active-mode',targetMode);}
  const spawnBtn=document.getElementById('btn-spawn');
  if(spawnBtn){
    if(campaignLevel&&!campaignLevel.allowSpawn){
      spawnBtn.disabled=true;
      spawnBtn.textContent='Spawn (N/A)';
    }else{
      const rem=spawnRemaining();
      const turnsToNext=6-(whiteTurnCount%6)||6;
      spawnBtn.textContent='Spawn ('+rem+') (+1 in '+turnsToNext+'t)';
      if(!locked&&rem<=0)spawnBtn.disabled=true;
    }
  }
  const mergeBtn=document.getElementById('btn-merge');
  if(mergeBtn){
    if(campaignLevel&&campaignLevel.noMerge){
      mergeBtn.disabled=true;
      mergeBtn.textContent='Merge (N/A)';
    }else{
      mergeBtn.textContent='⚗ Merge';
    }
  }
  updateViewportControls();
}

function showMoveHint(){
  const hb=document.getElementById('hint-box');
  if(!hb)return;
  if(difficulty!=='easy'||over||thinking||!isMyTurn()){hb.style.display='none';return;}
  const mc=myColor();
  const bp2=[];for(let i=0;i<ROWS*COLS;i++){const p=pieces[i];if(p&&p.color===mc)bp2.push({i,p});}
  let hint='';
  // check merges
  for(const {i,p} of bp2){
    const d=getDragDests(i);
    if(d.merge.size){const t=[...d.merge][0];hint=p.type+' at '+sqName(i)+' can merge with '+pieces[t].type+' at '+sqName(t);break;}
  }
  // check attacks
  if(!hint){
    for(const {i,p} of bp2){
      const d=getDragDests(i);
      if(d.attack.size){const t=[...d.attack][0];hint=p.type+' at '+sqName(i)+' can attack '+pieces[t].type+' at '+sqName(t);break;}
    }
  }
  // suggest pawn move toward enemy king
  if(!hint){
    const eki=pieces.findIndex(p=>p&&p.color!==mc&&p.type==='king');
    const pawns=bp2.filter(({p})=>p.type==='pawn');
    if(pawns.length&&eki>=0){
      const best=pawns.reduce((a,b)=>cheb(a.i,eki)<cheb(b.i,eki)?a:b);
      const d=getDragDests(best.i);
      if(d.move.size){const mv=[...d.move].reduce((a,b)=>cheb(a,eki)<cheb(b,eki)?a:b);hint='Move pawn at '+sqName(best.i)+' toward enemy';}
    }
  }
  if(!hint&&spawnRemaining()>0)hint='Spawn a pawn next to your King';
  if(!hint)hint='Skip turn';
  hb.textContent='Hint: '+hint;
  hb.style.display='block';
}

// ── PIECE CARD PAGINATION ─────────────────────────────────────────────────────
function renderPcCards(){
  const wrap=document.getElementById('pc-cards-wrap');
  if(!wrap)return;
  wrap.innerHTML='';
  const total=Math.ceil(PC_DATA.length/PC_PER_PAGE);
  const start=pcPageIdx*PC_PER_PAGE;
  const slice=PC_DATA.slice(start,start+PC_PER_PAGE);
  slice.forEach((d,i)=>{
    if(i>0){const div=document.createElement('div');div.className='tier-divider';wrap.appendChild(div);}
    const card=document.createElement('div');card.className='piece-card';
    card.innerHTML='<div class="piece-card-row"><span class="pc-glyph pc-glyph-w">'+d.gw+'</span><span class="pc-glyph pc-glyph-b">'+d.gb+'</span></div>'
      +'<div class="pc-name">'+d.name+'</div><div class="pc-stats">'+d.stats+'</div>';
    wrap.appendChild(card);
  });
  const lbl=document.getElementById('pc-page-label');
  if(lbl)lbl.textContent=(pcPageIdx+1)+'/'+total;
  const prev=document.getElementById('pc-prev'),next=document.getElementById('pc-next');
  if(prev)prev.style.opacity=pcPageIdx===0?'.3':'1';
  if(next)next.style.opacity=pcPageIdx>=total-1?'.3':'1';
  // re-apply current pf scaling
  const lp=document.getElementById('left-panel');
  if(lp&&window.lastPf){
    const pf=window.lastPf;
    lp.querySelectorAll('.pc-glyph').forEach(el=>el.style.fontSize=Math.max(11,Math.floor(pf*1.8))+'px');
    lp.querySelectorAll('.pc-name').forEach(el=>el.style.fontSize=Math.max(7,Math.floor(pf*.92))+'px');
    lp.querySelectorAll('.pc-stats').forEach(el=>el.style.fontSize=Math.max(5,Math.floor(pf*.65))+'px');
  }
}

function pcPage(dir){
  const total=Math.ceil(PC_DATA.length/PC_PER_PAGE);
  pcPageIdx=Math.max(0,Math.min(total-1,pcPageIdx+dir));
  renderPcCards();
}

// ── INTRO ────────────────────────────────────────────────────────────────────
function showDiff(){
  document.getElementById('diff-row').style.display='flex';
}

function showGameOver(result){
  const el=document.getElementById('game-over');
  const title=document.getElementById('go-title');
  const sub=document.getElementById('go-sub');
  if(!el)return;
  title.className='';
  if(result==='win'){title.textContent='You Win!';title.classList.add('win');sub.textContent='Victory — your kingdom prevails';}
  else if(result==='lose'){title.textContent='You Lose';title.classList.add('lose');sub.textContent='Defeat — your king has fallen';}
  else{title.textContent='Draw';title.classList.add('draw');sub.textContent='';}
  el.classList.add('show');
}

function hideGameOver(){
  const el=document.getElementById('game-over');
  if(el)el.classList.remove('show');
}

function doRematch(){
  hideGameOver();
  initGame();
}

function goIntro(){
  hideGameOver();
  // reset board size if coming from campaign
  campaignLevel=null; campaignLevelId=-1;
  COLS=9; ROWS=9;
  document.getElementById('intro').classList.remove('hidden');
  document.getElementById('diff-row').style.display='none';
  over=true; thinking=false;
  stopAnimalLoop();
  document.querySelectorAll('.animal-el').forEach(el=>el.remove());
  document.getElementById('thinking-dot').classList.remove('on');
  generateMap();
  titleTileData=tileData.slice();
  titleAnimals=animals.map(a=>({...a}));
  animals=[];
  viewN=9; viewRow0=0; viewCol0=0;
  render();
  resizeBoard();
}

// ── FLOATING MESSAGE (temporary text near a board tile) ─────────────────────
function showFloatingMessage(text,tileIdx,opts){
  const el=sqElAt(tileIdx);
  let cx,cy;
  if(el){
    const r=el.getBoundingClientRect();
    cx=r.left+r.width/2;
    cy=r.top+r.height/2;
  }else{
    const center=sqCenter(tileIdx);
    cx=center.x;cy=center.y;
  }
  const msg=document.createElement('div');
  msg.textContent=text;
  msg.style.cssText='position:fixed;pointer-events:none;z-index:900;left:'+cx+'px;top:'+cy+'px;'
    +'transform:translate(-50%,-50%);'
    +'padding:6px 14px;background:rgba(20,10,5,.92);border:2px solid #e05020;border-radius:6px;'
    +'color:#ffe8c0;font-family:Georgia,serif;font-size:13px;font-variant:small-caps;letter-spacing:.05em;'
    +'box-shadow:0 4px 14px rgba(0,0,0,.75),0 0 12px rgba(255,100,40,.4);'
    +'white-space:nowrap;'
    +'animation:floatMsg 1.6s ease-out forwards;';
  document.body.appendChild(msg);
  setTimeout(()=>msg.remove(),1700);
}

// ── FOG OF WAR TOGGLE ────────────────────────────────────────────────────────
function toggleMapCheat(){
  mapCheat=!mapCheat;
  const btn=document.getElementById('btn-mapcheat');
  if(btn)btn.textContent='🗺 Map Cheat: '+(mapCheat?'ON':'OFF');
  render(); renderMinimap();
}

// ── VIEWPORT (zoom + pan + minimap) ──────────────────────────────────────────
function animatePanSlide(dx,dy){
  const inner=document.getElementById('board-inner');
  if(!inner)return;
  inner.style.transition='none';
  inner.style.transform='translate('+dx+'px,'+dy+'px)';
  // force reflow
  void inner.offsetWidth;
  inner.style.transition='transform 220ms ease-out';
  inner.style.transform='translate(0,0)';
  setTimeout(()=>{inner.style.transition='';inner.style.transform='';},240);
}

function animateZoomScale(fromScale,toScale,onDone){
  const inner=document.getElementById('board-inner');
  if(!inner){if(onDone)onDone();return;}
  inner.style.transition='none';
  inner.style.transformOrigin='center center';
  inner.style.transform='scale('+fromScale+')';
  void inner.offsetWidth;
  inner.style.transition='transform 260ms ease-out';
  inner.style.transform='scale('+toScale+')';
  setTimeout(()=>{
    inner.style.transition='';inner.style.transform='';
    if(onDone)onDone();
  },280);
}

function panView(dr,dc){
  const oldR=viewRow0, oldC=viewCol0;
  viewRow0+=dr; viewCol0+=dc;
  clampViewport();
  if(viewRow0===oldR&&viewCol0===oldC)return false;
  const actualDr=viewRow0-oldR, actualDc=viewCol0-oldC;
  // disable each animal's own left/top transition so only the parent pan transform drives them
  animalDivs.forEach((el)=>{if(el)el.style.transition='none';});
  render(); resizeBoard(); updateViewportControls();
  // smooth slide: start at old position, animate to new
  animatePanSlide(actualDc*sqPx, actualDr*sqPx);
  // restore animal transitions after pan animation completes
  setTimeout(()=>{
    animalDivs.forEach((el)=>{if(el&&el.isConnected)el.style.transition='left 80ms linear,top 80ms linear';});
  },260);
  return true;
}

// step viewN by 2 so odd→odd (5, 7, 9) keeps viewport center aligned and
// scale = oldN/newN fully clips the 2 outer rows/cols (not just half-clips)
function zoomIn(){
  if(viewN<=5)return;
  const step=2;
  if(viewN-step<5)return;
  const oldViewN=viewN;
  const newViewN=oldViewN-step;
  const cR=viewRow0+Math.floor(viewRowsN()/2);
  const cC=viewCol0+Math.floor(viewColsN()/2);
  // scale ratio matches final tile size ratio: new_sqPx/old_sqPx ≈ oldN/newN
  const scaleUp=oldViewN/newViewN;
  animateZoomScale(1,scaleUp,()=>{
    viewN=newViewN;
    viewRow0=cR-Math.floor(viewRowsN()/2);
    viewCol0=cC-Math.floor(viewColsN()/2);
    clampViewport();
    resizeBoard(); render(); updateViewportControls();
  });
}

function zoomOut(){
  const maxN=Math.max(ROWS,COLS);
  if(viewN>=maxN)return;
  const step=2;
  if(viewN+step>maxN)return;
  const oldSqPx=sqPx, oldViewN=viewN;
  const newViewN=oldViewN+step;
  const cR=viewRow0+Math.floor(viewRowsN()/2);
  const cC=viewCol0+Math.floor(viewColsN()/2);
  viewN=newViewN;
  viewRow0=cR-Math.floor(viewRowsN()/2);
  viewCol0=cC-Math.floor(viewColsN()/2);
  clampViewport();
  resizeBoard(); render(); updateViewportControls();
  // initial scale makes new tiles visually the same size as old (outer rows clipped)
  const startScale=oldSqPx/sqPx;
  animateZoomScale(startScale,1);
}

// hold-to-pan
let panHoldTimer=null, panHoldInterval=null;
function startPanHold(dr,dc){
  panView(dr,dc);
  panHoldTimer=setTimeout(()=>{
    panHoldInterval=setInterval(()=>{if(!panView(dr,dc))stopPanHold();},150);
  },350);
}
function stopPanHold(){
  if(panHoldTimer){clearTimeout(panHoldTimer);panHoldTimer=null;}
  if(panHoldInterval){clearInterval(panHoldInterval);panHoldInterval=null;}
}

function updateViewportControls(){
  // update arrow button visibility based on pan availability
  const arN=document.getElementById('pan-n'),arS=document.getElementById('pan-s'),
        arW=document.getElementById('pan-w'),arE=document.getElementById('pan-e');
  if(arN)arN.style.display=canPanN()?'block':'none';
  if(arS)arS.style.display=canPanS()?'block':'none';
  if(arW)arW.style.display=canPanW()?'block':'none';
  if(arE)arE.style.display=canPanE()?'block':'none';
  renderMinimap();
  // zoom buttons
  const zi=document.getElementById('btn-zoom-in'),zo=document.getElementById('btn-zoom-out');
  if(zi)zi.disabled=viewN-2<5;
  if(zo)zo.disabled=viewN+2>Math.max(ROWS,COLS);
}

// simple rgb darken helper for obstacles: returns a darker shade of #rrggbb
function mmDarken(hex,amt){
  const m=hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if(!m)return hex;
  const r=Math.max(0,Math.floor(parseInt(m[1],16)*amt));
  const g=Math.max(0,Math.floor(parseInt(m[2],16)*amt));
  const b=Math.max(0,Math.floor(parseInt(m[3],16)*amt));
  return 'rgb('+r+','+g+','+b+')';
}

function renderMinimap(){
  const mm=document.getElementById('minimap');
  if(!mm)return;
  mm.innerHTML='';
  // fit within the panel box: compute both width- and height-constrained cell sizes
  // and pick the smaller so aspect ratio is preserved without overflowing.
  const rp=document.getElementById('right-panel');
  const availW=rp?Math.max(60,rp.clientWidth-12):96;
  const maxH=rp?Math.max(60,Math.floor(rp.clientHeight*0.28)):150;
  const cellByW=Math.floor(availW/COLS);
  const cellByH=Math.floor(maxH/ROWS);
  const cell=Math.max(4,Math.min(cellByW,cellByH));
  mm.style.width=(cell*COLS)+'px';
  mm.style.height=(cell*ROWS)+'px';
  mm.style.gridTemplateColumns='repeat('+COLS+','+cell+'px)';
  // use theme colors to match the main board
  const thm=THEMES[mapTheme]||THEMES.jungle;
  const lt=thm.lt, dk=thm.dk;
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const i=idx(r,c);
      const d=document.createElement('div');
      d.className='mm-cell';
      d.style.width=cell+'px';d.style.height=cell+'px';
      d.style.position='relative';
      const isLt=(r+c)%2===0;
      // fog of war: 3 states
      const vis=tileVisibility(i);
      if(vis==='unknown'){
        d.style.background='radial-gradient(circle at 30% 40%,#9a9a9a,#5a5a5a 60%,#2a2a2a)';
        if(r>=viewRow0&&r<viewRow0+viewRowsN()&&c>=viewCol0&&c<viewCol0+viewColsN()){
          d.style.outline='1px solid rgba(200,240,80,.9)';
        }
        mm.appendChild(d);
        continue;
      }
      if(vis==='explored'){
        // partial fog on minimap: show terrain underneath with a gray overlay
        d.style.background=isLt?lt:dk;
        if(isTileBlocked(i)){
          const t=tileData[i];
          const tileKey=(t==='sandstone-spawner')?'sandstone':t;
          const info=thm.tiles&&thm.tiles[tileKey];
          if(info&&info.icon){
            const ic=document.createElement('div');
            ic.style.cssText='position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:'+Math.max(6,Math.floor(cell*0.85))+'px;line-height:1;pointer-events:none;opacity:.7;';
            ic.textContent=info.icon;
            d.appendChild(ic);
          }
        }
        // partial fog overlay
        const overlay=document.createElement('div');
        overlay.style.cssText='position:absolute;inset:0;background:rgba(120,120,120,.45);pointer-events:none;';
        d.appendChild(overlay);
        if(r>=viewRow0&&r<viewRow0+viewRowsN()&&c>=viewCol0&&c<viewCol0+viewColsN()){
          d.style.outline='1px solid rgba(200,240,80,.9)';
        }
        mm.appendChild(d);
        continue;
      }
      // base: theme light/dark
      d.style.background=isLt?lt:dk;
      // obstacle: overlay a small icon
      if(isTileBlocked(i)){
        const t=tileData[i];
        const tileKey=(t==='sandstone-spawner')?'sandstone':t;
        const info=thm.tiles&&thm.tiles[tileKey];
        if(info&&info.icon){
          const ic=document.createElement('div');
          ic.style.cssText='position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:'+Math.max(6,Math.floor(cell*0.85))+'px;line-height:1;pointer-events:none;';
          ic.textContent=info.icon;
          d.appendChild(ic);
        }else{
          d.style.background=mmDarken(dk,0.45);
        }
      }
      // viewport highlight
      if(r>=viewRow0&&r<viewRow0+viewRowsN()&&c>=viewCol0&&c<viewCol0+viewColsN()){
        d.style.outline='1px solid rgba(200,240,80,.9)';
        // slightly brighten the viewport area
        d.style.filter='brightness(1.35)';
      }
      // piece dot
      const p=pieces[i];
      if(p){
        const dot=document.createElement('div');
        dot.style.cssText='width:60%;height:60%;border-radius:50%;margin:20% auto;background:'+(p.color==='w'?'#fff':'#1a0e04')+';';
        d.appendChild(dot);
      }
      mm.appendChild(d);
    }
  }
}
