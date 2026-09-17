// ── RESIZE ───────────────────────────────────────────────────────────────────
// put the board where the current zoom and pan say, without laying the squares out again
function applyBoardView(smooth){
  const inner=document.getElementById('board-inner');
  if(!inner)return;
  inner.style.transition=smooth?'left 180ms ease-out,top 180ms ease-out':'';
  inner.style.transform='';
  inner.style.left=boardPanX+'px';inner.style.top=boardPanY+'px';
  if(smooth)setTimeout(()=>{inner.style.transition='';},200);
}
// show a zoom or pan while the gesture is still running: the board is only moved and scaled, which
// costs nothing; commitBoardView lays the squares out again at the new size when the gesture ends
function previewBoardView(zoom,panX,panY){
  const inner=document.getElementById('board-inner');
  if(!inner)return;
  inner.style.transition='';
  inner.style.transformOrigin='0 0';
  inner.style.transform='translate('+(panX-boardPanX)+'px,'+(panY-boardPanY)+'px) scale('+(zoom/boardZoom)+')';
}
function commitBoardView(zoom,panX,panY){
  const zoomed=Math.abs(zoom-boardZoom)>1e-4;
  boardZoom=zoom;boardPanX=panX;boardPanY=panY;
  if(zoomed){resizeBoard();render();}
  else{clampViewport();applyBoardView();}
  if(typeof updateViewportControls==='function')updateViewportControls();
  if(typeof renderAnimalOverlay==='function')renderAnimalOverlay();
}

function resizeBoard(){
  const vw=window.innerWidth,vh=window.innerHeight;
  const topH=document.getElementById('top-bar').offsetHeight;
  const botH=document.getElementById('bottom-bar').offsetHeight;
  // detect mobile: portrait if narrow or if desktop layout would squeeze the board
  const desktopBase=Math.max(90,Math.min(150,Math.floor(vw*.13)));
  const desktopAvailW=vw-Math.floor(desktopBase*1.5)-Math.floor(desktopBase*2.0)-32;
  const isPortrait=(vw<=1024&&vh>vw)||(desktopAvailW<vw*0.4);
  const isLandscapeMobile=!isPortrait&&vh<=500&&vw>vh;

  let availW,availH,panelWL,panelWR;
  if(isPortrait){
    // portrait mobile: board gets full width, ~60% of viewport height
    // don't measure panel heights (unreliable on mobile) — use fixed viewport fractions
    availW=vw-8;
    availH=Math.floor(vh*0.6);
    panelWL=0;panelWR=0;
  }else{
    // desktop / landscape: panels are side columns
    const hOverhead=32;
    const base=Math.max(isLandscapeMobile?60:90,Math.min(150,Math.floor(vw*.13)));
    panelWL=Math.floor(base*(isLandscapeMobile?1.0:1.5));
    panelWR=Math.floor(base*(isLandscapeMobile?1.2:2.0));
    availW=vw-panelWL-panelWR-hOverhead;
    availH=vh-topH-botH-20;
  }

  // the frame shows the whole board at zoom 1; zooming in grows the board behind it
  boardFitPx=Math.max(8,Math.floor(Math.min(availW/COLS,availH/ROWS)));
  boardZoom=Math.max(1,Math.min(BOARD_ZOOM_MAX,boardZoom));
  sqPx=Math.round(boardFitPx*boardZoom*100)/100;
  const frameW=boardFitPx*COLS,frameH=boardFitPx*ROWS;
  const boardW=sqPx*COLS,boardH=sqPx*ROWS;
  clampViewport();
  const wrap=document.getElementById('board-wrap');
  const thBorder=(THEMES[mapTheme]||THEMES.forest).border;
  wrap.style.borderColor=thBorder;
  // the frame is border-box, so its 3px border has to be added or it would cut the last row and column
  wrap.style.width=(frameW+6)+'px';wrap.style.height=(frameH+6)+'px';wrap.style.margin='';
  const boardEl=document.getElementById('board');
  boardEl.style.width=boardW+'px';boardEl.style.height=boardH+'px';
  const innerEl=document.getElementById('board-inner');
  if(innerEl){innerEl.style.width=boardW+'px';innerEl.style.height=boardH+'px';}
  applyBoardView();
  const ph=frameH+6;
  const lp=document.getElementById('left-panel'),rp=document.getElementById('right-panel');
  if(isPortrait){
    // portrait: panels are full-width strips, height is auto (set by CSS)
    lp.style.width='100%';lp.style.height='auto';
    rp.style.width='100%';rp.style.height='auto';
  }else{
    lp.style.width=panelWL+'px';lp.style.height=ph+'px';
    rp.style.width=panelWR+'px';rp.style.height=ph+'px';
  }
  const gs=Math.max(12,Math.floor(sqPx*.62));
  document.documentElement.style.setProperty('--glyph-size',gs+'px');
  const pp=Math.max(2,Math.floor(sqPx*.10));
  document.querySelectorAll('.hp-pip').forEach(el=>{el.style.width=pp+'px';el.style.height=Math.max(2,Math.floor(sqPx*.07))+'px';});
  document.getElementById('ghost').style.fontSize=Math.floor(sqPx*.72)+'px';
  const pf=Math.floor(ph/20*.512);lastPf=pf;window.lastPf=pf;
  renderPcCards();
  lp.querySelectorAll('.panel-label').forEach(el=>el.style.fontSize=Math.max(9,Math.floor(pf*1.0))+'px');
  lp.querySelectorAll('.pc-glyph').forEach(el=>el.style.fontSize=Math.max(11,Math.floor(pf*1.8))+'px');
  lp.querySelectorAll('.pc-name').forEach(el=>el.style.fontSize=Math.max(9,Math.floor(pf*1.02))+'px');
  lp.querySelectorAll('.pc-stats').forEach(el=>el.style.fontSize=Math.max(7,Math.floor(pf*.75))+'px');
  lp.querySelectorAll('#resources').forEach(el=>el.style.fontSize=Math.max(10,Math.floor(pf*1.35))+'px');
  renderResources();
  const btnPad=Math.max(2,Math.floor(pf*.25));
  const btnSize=Math.floor((panelWR-btnPad*2-2)/3);const btnPx=btnSize+'px';
  rp.querySelectorAll('.dir-btn').forEach(el=>{el.style.width=btnPx;el.style.height=btnPx;el.style.fontSize=Math.max(9,Math.floor(btnSize*.42))+'px';});
  const dg=document.getElementById('dir-grid');if(dg){dg.style.gridTemplateColumns='repeat(3,'+btnPx+')';dg.style.gap=btnPad+'px';}
  rp.querySelectorAll('.panel-label').forEach(el=>el.style.fontSize=Math.max(9,Math.floor(pf*1.0))+'px');
  rp.querySelectorAll('.act-btn').forEach(el=>el.style.fontSize=Math.max(9,Math.floor(pf*1.0))+'px');
  rp.querySelectorAll('.pvp-id-box:not(#room-id-display)').forEach(el=>el.style.fontSize=Math.max(6,Math.floor(pf*.8))+'px');
  rp.querySelectorAll('.room-entry').forEach(el=>el.style.fontSize=Math.max(7,Math.floor(pf*.9))+'px');
  const rid=document.getElementById('room-id-display');if(rid)rid.style.fontSize=Math.max(7,Math.floor(pf*.9))+'px';
  const inp=document.getElementById('pvp-input');if(inp)inp.style.fontSize=Math.max(7,Math.floor(pf*.88))+'px';
  const hb2=document.getElementById('hint-box');if(hb2)hb2.style.fontSize=Math.max(9,Math.floor(pf*.95))+"px";
  // ── tutorial card scaling ──
  const tc2=document.getElementById('tut-card');
  if(tc2){
    const tpf=Math.max(9,Math.floor(pf*1.05));
    tc2.style.fontSize=tpf+'px';
    const h3el=tc2.querySelector('h3');if(h3el)h3el.style.fontSize=Math.max(11,Math.floor(pf*1.3))+'px';
    tc2.querySelectorAll('.tut-btn').forEach(b=>b.style.fontSize=tpf+'px');
    const cr=tc2.getBoundingClientRect();
    if(cr.right>window.innerWidth-8)tc2.style.left=Math.max(8,window.innerWidth-cr.width-8)+'px';
    if(cr.bottom>window.innerHeight-8)tc2.style.top=Math.max(8,window.innerHeight-cr.height-8)+'px';
  }
  // ── top bar scaling ──
  const tbf=Math.max(10,Math.floor(pf*1.1));
  const tb=document.getElementById('top-bar');
  if(tb){
    const h1el=tb.querySelector('h1');if(h1el)h1el.style.fontSize=Math.max(13,Math.floor(pf*1.4))+'px';
    const lbl=document.getElementById('api-wrap')?.querySelector('label');if(lbl)lbl.style.fontSize=tbf+'px';
    const akey=document.getElementById('api-key');if(akey){akey.style.fontSize=tbf+'px';akey.style.width=Math.max(80,Math.floor(pf*8))+'px';}
    const stat=document.getElementById('status');if(stat)stat.style.fontSize=tbf+'px';
    const tc=document.getElementById('turn-counter');if(tc)tc.style.fontSize=tbf+'px';
    const bset=document.getElementById('btn-settings');if(bset)bset.style.fontSize=tbf+'px';
  }
}
window.addEventListener('resize',()=>{resizeBoard();if(!over||pieces.some(p=>p))render();resizeBoard();});

document.addEventListener('keydown',e=>{
  if(over||thinking||!isMyTurn())return;
  const dm={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]};
  if(dm[e.key]){e.preventDefault();moveAll(...dm[e.key]);}
  if(e.key==='Escape'){targetMode=false;targetSrc=-1;kingSelected=false;selectedPieces=new Set();syncUI();render();setStatus('Your turn');}
});

window.addEventListener('load',()=>{
  document.body.className='theme-'+mapTheme;
  fillUiIcons();
  resizeBoard();resizeBoard();
  renderPcCards();
  const startOnce=()=>{if(!bgmPaused)startBgm();document.removeEventListener('pointerdown',startOnce);document.removeEventListener('keydown',startOnce);};
  document.addEventListener('pointerdown',startOnce);
  document.addEventListener('keydown',startOnce);
});
