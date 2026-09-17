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
    const px=Math.max(18,Math.floor((window.lastPf||10)*2.2)),type=d.name.toLowerCase();
    card.innerHTML='<div class="piece-card-row">'+pieceSVG(type,'w',mapTheme,px,true)+pieceSVG(type,'b',mapTheme,px,true)+'</div>'
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
    lp.querySelectorAll('.pc-name').forEach(el=>el.style.fontSize=Math.max(9,Math.floor(pf*1.02))+'px');
    lp.querySelectorAll('.pc-stats').forEach(el=>el.style.fontSize=Math.max(7,Math.floor(pf*.75))+'px');
  }
}

// merge chart, drawn with the same piece art as the board
const MERGE_RECIPES=[['pawn','pawn','knight'],['pawn','knight','bishop'],['knight','bishop','queen'],['knight','knight','rook'],['rook','rook','siege']];
function renderMergeGuide(){
  const el=document.querySelector('.merge-guide');if(!el)return;
  const px=Math.max(14,Math.round(parseFloat(getComputedStyle(el).fontSize)*1.3));
  const icon=t=>`<span class="mg-icon">${pieceSVG(t,'w',mapTheme,px,true)}</span>`;
  el.innerHTML=MERGE_RECIPES.map(([a,b,r])=>`<span class="mg-row">${icon(a)}+${icon(b)}→${icon(r)}</span>`).join('');
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
  // campaign results swap in their own buttons; put the standard pair back
  const btns=document.getElementById('go-buttons');
  if(btns)btns.innerHTML='<button class="go-btn primary" onclick="doRematch()">⚔ Rematch</button><button class="go-btn secondary" onclick="goIntro()">↺ Main Menu</button>';
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
  // PvP: the host deals the new board; a guest asks the host for one
  if(pvpActive){
    if(pvpRole==='host'){initGame();broadcastState(null);}
    else if(conn&&conn.open)conn.send(JSON.stringify({type:'rematch'}));
    return;
  }
  initGame();
}

function goIntro(){
  hideGameOver();
  if(typeof stopAiVsAi==='function')stopAiVsAi();
  // leaving to the menu ends a multiplayer match
  if(pvpActive){pvpActive=false;try{if(conn)conn.close();}catch(e){}}
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
  resetView();
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
    +'color:#ffe8c0;font-family:var(--ui-font);font-size:14px;letter-spacing:.05em;'
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
// the arrows slide the view by one square
function panView(dr,dc){
  const before=[boardPanX,boardPanY];
  [boardPanX,boardPanY]=clampPan(boardZoom,boardPanX-dc*sqPx,boardPanY-dr*sqPx);
  if(boardPanX===before[0]&&boardPanY===before[1])return false;
  applyBoardView(true);updateViewportControls();
  return true;
}

// zoom by a factor, keeping the point under (px,py) — the frame's centre by default — where it is
function zoomBy(f,px,py){
  const clip=document.getElementById('board-clip');
  if(!clip)return;
  const r=clip.getBoundingClientRect();
  const zoom=Math.max(1,Math.min(BOARD_ZOOM_MAX,boardZoom*f));
  if(Math.abs(zoom-boardZoom)<1e-4)return;
  const cx=(px===undefined?r.width/2:px-r.left),cy=(py===undefined?r.height/2:py-r.top);
  const k=zoom/boardZoom;
  const[panX,panY]=clampPan(zoom,cx-(cx-boardPanX)*k,cy-(cy-boardPanY)*k);
  commitBoardView(zoom,panX,panY);
}
function zoomIn(){zoomBy(1.4);}
function zoomOut(){zoomBy(1/1.4);}

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
  if(zi)zi.disabled=boardZoom>=BOARD_ZOOM_MAX-1e-3;
  if(zo)zo.disabled=boardZoom<=1+1e-3;
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
  const thm=THEMES[mapTheme]||THEMES.forest;
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
        // the same grey as the board's fog
        d.style.background=fogStyle().solid;
        if(inViewRC(r,c)){
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
        // partial fog overlay: the board's veil
        const overlay=document.createElement('div');
        overlay.style.cssText='position:absolute;inset:0;background:'+fogStyle().veil+';pointer-events:none;';
        d.appendChild(overlay);
        if(inViewRC(r,c)){
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
      if(inViewRC(r,c)){
        d.style.outline='1px solid rgba(200,240,80,.9)';
        // slightly brighten the viewport area
        d.style.filter='brightness(1.35)';
      }
      // piece dot
      const p=pieces[i];
      // an enemy hidden in undergrowth stays off the minimap too
      if(p&&(mapCheat||!isConcealedFrom(i,myColor()))){
        const dot=document.createElement('div');
        dot.style.cssText='width:60%;height:60%;border-radius:50%;margin:20% auto;background:'+(p.color==='w'?'#fff':'#1a0e04')+';';
        d.appendChild(dot);
      }
      mm.appendChild(d);
    }
  }
}
