// ── UI ───────────────────────────────────────────────────────────────────────
// ── ICONS ────────────────────────────────────────────────────────────────────
// Every button's icon is drawn here in one line style, so no button falls back to an emoji that
// wouldn't match the rest. A button says which one it wants with data-icon and keeps its text.
const UI_LINE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">';
const UI_ICONS={
  spawn:'<path d="M12 20v-7"/><path d="M12 13c-3.6 0-5.5-2.2-5.5-5.5C10 7.5 12 9.6 12 13z"/>'
    +'<path d="M12 13c0-3.4 2-5.5 5.5-5.5C17.5 10.8 15.6 13 12 13z"/><path d="M7 20h10"/>',
  merge:'<path d="M5 4v4a5 5 0 0 0 5 5h4a5 5 0 0 1 5 5v2"/><path d="M19 4v4a5 5 0 0 1-5 5"/><path d="M16 17l3 3 3-3"/>',
  skip:'<path d="M5 5l9 7-9 7z"/><path d="M18 5v14"/>',
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  zoomIn:'<circle cx="11" cy="11" r="6.5"/><path d="M15.8 15.8L21 21M11 8.5v5M8.5 11h5"/>',
  zoomOut:'<circle cx="11" cy="11" r="6.5"/><path d="M15.8 15.8L21 21M8.5 11h5"/>',
  map:'<path d="M3 6.5l6-2.5 6 2.5 6-2.5v13l-6 2.5-6-2.5-6 2.5z"/><path d="M9 4v13M15 6.5v13"/>',
  audio:'<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M16 9.2a4 4 0 0 1 0 5.6"/><path d="M18.6 6.6a7.5 7.5 0 0 1 0 10.8"/>',
  host:'<path d="M12 12.8a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z"/><path d="M8.2 7.2a5.4 5.4 0 0 0 0 7.6M15.8 7.2a5.4 5.4 0 0 1 0 7.6"/>'
    +'<path d="M5.4 4.4a9.4 9.4 0 0 0 0 13.2M18.6 4.4a9.4 9.4 0 0 1 0 13.2"/><path d="M12 13v7"/>',
  refresh:'<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4h-4"/>',
  scry:'<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.6"/>',
  heal:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  fortify:'<path d="M4.5 15 C4.5 8.6 7.8 4.8 12 4.8 C16.2 4.8 19.5 8.6 19.5 15 Z"/><path d="M2.8 15 H21.2"/><path d="M12 15 V19.5"/>',
  extract:'<path d="M12 3.5 C15.6 8 18 11 18 14.2 A6 6 0 0 1 6 14.2 C6 11 8.4 8 12 3.5 Z"/><path d="M9.5 14 C9.5 12.4 10.3 11.2 11.3 10.3"/>',
  prev:'<path d="M14.5 6l-6 6 6 6"/>',
  next:'<path d="M9.5 6l6 6-6 6"/>',
};
// a button's contents: the icon, then its words
function uiLabel(icon,text){
  return (UI_ICONS[icon]?UI_LINE+UI_ICONS[icon]+'</svg>':'')+(text?'<span>'+text+'</span>':'');
}
function fillUiIcons(){
  document.querySelectorAll('[data-icon]').forEach(el=>{
    if(el.querySelector('svg'))return;
    el.innerHTML=uiLabel(el.dataset.icon,el.textContent.trim());
  });
}

function setStatus(t){document.getElementById('status').textContent=t;}
function addLog(msg){logLines.push(msg);if(logLines.length>4)logLines.shift();document.getElementById('log').textContent=logLines.join(' · ');}

// the buttons that depend on the selected piece. render() calls this as well, so they change the moment
// a piece is tapped — before, they only caught up at the next turn, and a pawn tapped again on the
// spring showed no Extract button at all.
function syncPieceButtons(){
  const locked=over||thinking||!isMyTurn();
  const selIdx=selectedPieces.size===1?[...selectedPieces][0]:-1;
  const sel=selIdx>=0&&pieces[selIdx]&&pieces[selIdx].color===myColor()?pieces[selIdx]:null;
  // fortifying: one plain pawn of yours selected, and a whole Gold in hand
  const fortBtn=document.getElementById('btn-fortify');
  if(fortBtn){
    fortBtn.disabled=locked||!sel||!canFortify(selIdx);
    fortBtn.innerHTML=uiLabel('fortify',goldAllowed()?'Fortify':'Fortify (N/A)');
  }
  // one button for the selected piece's own action: a pawn on the spring extracts, a bishop scries
  const spBtn=document.getElementById('btn-special');
  if(spBtn){
    const extract=!!sel&&canExtract(selIdx);
    const scry=!!sel&&sel.type==='bishop'&&(sel.mana||0)>=2;
    spBtn.disabled=locked||!(extract||scry);
    spBtn.classList.toggle('active-mode',!!scryMode);
    spBtn.innerHTML=uiLabel(extract?'extract':'scry',scryMode?'Pick a square':extract?'Extract Elixir':'Scry (2)');
  }
}

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
      spawnBtn.innerHTML=uiLabel('spawn','Spawn (N/A)');
    }else{
      // how many are left is on the Gold counter in the resources panel
      const rem=spawnRemaining();
      // playing on after the King fell: there is nobody left to mint a pawn
      const hasKing=pieces.some(q=>q&&q.color===myColor()&&q.type==='king');
      spawnBtn.innerHTML=uiLabel('spawn','Spawn');
      if(!locked&&(rem<1||!hasKing))spawnBtn.disabled=true;
    }
  }
  syncPieceButtons();
  const mergeBtn=document.getElementById('btn-merge');
  if(mergeBtn){
    if(campaignLevel&&campaignLevel.noMerge){
      mergeBtn.disabled=true;
      mergeBtn.innerHTML=uiLabel('merge','Merge (N/A)');
    }else{
      mergeBtn.innerHTML=uiLabel('merge','Merge');
    }
  }
  renderResources();
  updateViewportControls();
}

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

// ── RESOURCES ────────────────────────────────────────────────────────────────
// Gold pays for the pawns the King spawns and for fortifying pawns; Elixir, extracted at the spring,
// is meant for the magic units.
const RES_GOLD='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.4" fill="#F5C443" stroke="#3A2614" stroke-width="2.3"/>'
  +'<circle cx="12" cy="12" r="5.2" fill="none" stroke="#3A2614" stroke-width="1.5" opacity=".5"/>'
  +'<ellipse cx="9" cy="8.4" rx="2" ry="1.2" fill="#fff" opacity=".6" transform="rotate(-28 9 8.4)"/></svg>';
const RES_ELIXIR='<svg viewBox="0 0 24 24"><path d="M12 2.4 C16.6 8 19 11.1 19 14.3 A7 7 0 0 1 5 14.3 C5 11.1 7.4 8 12 2.4 Z" '
  +'fill="#43C45A" stroke="#14351C" stroke-width="2.2" stroke-linejoin="round"/>'
  +'<path d="M9 13.4 C9 11.6 10 10 11.2 8.8" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".55"/></svg>';

// the engine's own numbers while two networks play each other, the game's otherwise
function goldCount(color){
  if(gameMode==='aivsai'&&aiVsAi&&typeof SemunEngine!=='undefined')return SemunEngine.spawnRemaining(aiVsAi.s,color);
  return color===myColor()?spawnRemaining():blackSpawnRemaining();
}
// Elixir is what a pawn extracts at the spring; a bishop's mana is its own heal charge and is not this.
function elixirCount(color){
  if(gameMode==='aivsai'&&aiVsAi&&aiVsAi.s.elixir)return aiVsAi.s.elixir[color]||0;
  return (typeof elixir!=='undefined'&&elixir[color])||0;
}
// The panel is a fixed width while the numbers grow (9.50, 10.33, +0.33), so the line is measured after
// every render: it shrinks a step at a time rather than be cut, and the names go before the numbers do.
// resizeBoard widens the panel first, wherever the window has width the board isn't using.
function fitResources(){
  const el=document.getElementById('resources');
  if(!el||!el.clientWidth)return;
  const base=Math.max(10,Math.floor((window.lastPf||10)*1.35));
  el.classList.remove('res-noname');
  let f=base;el.style.fontSize=f+'px';
  while(el.scrollWidth>el.clientWidth&&f>9){f--;el.style.fontSize=f+'px';}
  if(el.scrollWidth>el.clientWidth)el.classList.add('res-noname');
}

function renderResources(){
  const el=document.getElementById('resources');if(!el)return;
  const noGold=campaignLevel&&campaignLevel.allowSpawn===false;
  const both=gameMode==='aivsai'&&aiVsAi;
  const sides=both?['w','b']:[myColor()];
  // a line per resource: icon, name, count, and for Gold this turn's income beside it, so it reads as
  // Gold's rate and not Elixir's; it doubles, and lights up, while a pawn stands on the mine. The
  // desktop panel stacks the two lines; the phone strip puts them side by side on one line.
  const line=(cls,icon,name,text,note,boost)=>'<span class="res-chip '+cls+'">'+icon
    +'<span class="res-name">'+name+'</span><b>'+text+'</b>'
    +(note?'<span class="res-note'+(boost?' res-boost':'')+'">'+note+'</span>':'')+'</span>';
  el.classList.toggle('two-sides',!!both);
  el.innerHTML=sides.map(color=>{
    const gold=noGold?'—':goldText(goldCount(color));
    const boost=!noGold&&pawnOnMine(color);
    return '<div class="res-side">'+(both?'<span class="res-team">'+(color==='w'?'White':'Black')+'</span>':'')
      +line('res-line-gold',RES_GOLD,'Gold',gold,noGold?'':'+'+goldRate(color).toFixed(2),boost)
      +line('res-line-elixir',RES_ELIXIR,'Elixir',elixirCount(color))+'</div>';
  }).join('');
  fitResources();
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
  // campaign results swap in their own buttons; put the standard pair back, and offer to play the
  // board on where a plain game can carry on without the king that fell (keepPlaying in game.js)
  const btns=document.getElementById('go-buttons');
  const playOn=!campaignLevel&&!pvpActive&&gameMode!=='aivsai';
  if(btns)btns.innerHTML='<button class="go-btn primary" onclick="doRematch()">⚔ Rematch</button>'
    +(playOn?'<button class="go-btn secondary" onclick="keepPlaying()">▶ Play On</button>':'')
    +'<button class="go-btn secondary" onclick="goIntro()">↺ Main Menu</button>';
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
  if(btn)btn.innerHTML=uiLabel('map','Map Cheat: '+(mapCheat?'ON':'OFF'));
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

// the minimap in the right panel, and on phones (where that panel is hidden) a small one in the
// board's bottom-left corner while the board is zoomed in, both showing where the view sits
function renderMinimap(){
  const rp=document.getElementById('right-panel');
  const availW=rp?Math.max(60,rp.clientWidth-12):96;
  const maxH=rp?Math.max(60,Math.floor(rp.clientHeight*0.28)):150;
  const panel=document.getElementById('minimap');
  if(panel)drawMinimap(panel,Math.max(4,Math.min(Math.floor(availW/COLS),Math.floor(maxH/ROWS))));
  const corner=document.getElementById('minimap-mobile');
  if(corner){
    // wherever the panel's minimap can't be seen, and always: the strip of buttons it sits in must
    // not change size when the board is zoomed
    const show=!panel||panel.offsetParent===null;
    corner.style.display=show?'grid':'none';
    // the strip the map sits in makes room for it at its left
    const rp=document.getElementById('right-panel');
    if(rp)rp.classList.toggle('with-map',show);
    if(show)drawMinimap(corner,Math.max(3,Math.floor(Math.min(84/COLS,84/ROWS))));
  }
}

function drawMinimap(mm,cell){
  mm.innerHTML='';
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
  // the field of view as one box, which follows the board's smooth zoom
  if(boardZoom>1.01){
    const v=viewRect(),box=document.createElement('div');
    box.className='mm-view';
    box.style.cssText='position:absolute;pointer-events:none;border:1.5px solid rgba(220,250,110,.95);'
      +'border-radius:2px;box-shadow:0 0 0 1px rgba(0,0,0,.45),0 0 6px rgba(200,240,80,.35);'
      +'background:rgba(220,250,110,.14);'
      +'left:'+(2+v.c0*cell)+'px;top:'+(2+v.r0*cell)+'px;'
      +'width:'+(v.cols*cell)+'px;height:'+(v.rows*cell)+'px;';
    mm.appendChild(box);
  }
}

// tapping a minimap centres the view there
function minimapTap(e,mm){
  if(boardZoom<=1.01)return;
  e.preventDefault();e.stopPropagation();
  const r=mm.getBoundingClientRect();
  const u=(e.clientX-r.left-2)/Math.max(1,r.width-4),w=(e.clientY-r.top-2)/Math.max(1,r.height-4);
  const clip=document.getElementById('board-clip').getBoundingClientRect();
  [boardPanX,boardPanY]=clampPan(boardZoom,clip.width/2-u*COLS*sqPx,clip.height/2-w*ROWS*sqPx);
  applyBoardView();updateViewportControls();
}
