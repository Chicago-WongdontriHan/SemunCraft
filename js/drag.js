// ── DRAG ─────────────────────────────────────────────────────────────────────
function sqIdxFromPoint(x,y){const rect=document.getElementById('board').getBoundingClientRect();const c=Math.floor((x-rect.left)/sqPx)+viewCol0,r=Math.floor((y-rect.top)/sqPx)+viewRow0;return(r>=viewRow0&&r<viewRow0+viewRowsN()&&c>=viewCol0&&c<viewCol0+viewColsN())?idx(r,c):-1;}

// ── box selection state ───────────────────────────────────────────────────────
let boxSelecting=false,boxX0=0,boxY0=0,boxX1=0,boxY1=0,boxMouseDownOnEmpty=false;

document.getElementById('board').addEventListener('mousedown',e=>{
  if(over||thinking||!isMyTurn())return;
  const i=sqIdxFromPoint(e.clientX,e.clientY);if(i<0)return;
  if(e.button===2){e.preventDefault();handleRightClick(i,e);return;}
  const p=pieces[i];
  if(targetMode){handleTargetClick(i);return;}
  if(p&&p.color===myColor()){
    mouseDownI=i;mouseDownX=e.clientX;mouseDownY=e.clientY;e.preventDefault();
  }else if(!p&&kingSelected){
    mouseDownI=i;mouseDownX=e.clientX;mouseDownY=e.clientY;e.preventDefault();
  }else if(!p&&!kingSelected&&!targetMode){
    boxSelecting=false;boxMouseDownOnEmpty=true;
    boxX0=e.clientX;boxY0=e.clientY;boxX1=e.clientX;boxY1=e.clientY;
    e.preventDefault();
  }
});
document.getElementById('board').addEventListener('contextmenu',e=>e.preventDefault());

document.addEventListener('mousemove',e=>{
  if(boxMouseDownOnEmpty){
    const moved=Math.hypot(e.clientX-boxX0,e.clientY-boxY0)>6;
    if(moved){
      boxSelecting=true;
      boxX1=e.clientX;boxY1=e.clientY;
      drawBoxSelect();
    }
    return;
  }
  if(mouseDownI<0)return;
  const p=pieces[mouseDownI];
  if(!dragging&&p&&p.color===myColor()&&Math.hypot(e.clientX-mouseDownX,e.clientY-mouseDownY)>5){
    dragging=true;dragSrc=mouseDownI;dragDests=getDragDests(dragSrc);
    const g=document.getElementById('ghost');
    if(p.type==='siege'){g.textContent='';g.innerHTML=buildWhiteSiegeSVG(Math.floor(sqPx*.72));}
    else{g.innerHTML='';g.textContent=GLYPH[p.type+'_'+p.color];g.style.color=p.color==='w'?'#fff':'#1a0e04';}
    g.style.display='block';render();
  }
  if(dragging){const g=document.getElementById('ghost');g.style.left=e.clientX+'px';g.style.top=e.clientY+'px';}
});

document.addEventListener('mouseup',e=>{
  document.getElementById('ghost').style.display='none';
  if(boxSelecting){
    boxX1=e.clientX;boxY1=e.clientY;
    applyBoxSelect();
    boxSelecting=false;boxMouseDownOnEmpty=false;
    clearBoxSelect();
    return;
  }
  boxMouseDownOnEmpty=false;
  if(dragging){
    const dropI=sqIdxFromPoint(e.clientX,e.clientY),src=dragSrc,dests=dragDests;
    dragging=false;dragSrc=-1;dragDests=null;
    if(dropI>=0&&src>=0)executeDrop(src,dropI,dests);else render();
  }else if(mouseDownI>=0&&!over&&!thinking&&isMyTurn())handleClick(mouseDownI);
  mouseDownI=-1;
});

function drawBoxSelect(){
  let el=document.getElementById('box-select-rect');
  if(!el){
    el=document.createElement('div');el.id='box-select-rect';
    el.style.cssText='position:fixed;pointer-events:none;z-index:400;border:2px dashed #c8e840;background:rgba(200,232,64,.08);border-radius:2px;';
    document.body.appendChild(el);
  }
  const x=Math.min(boxX0,boxX1),y=Math.min(boxY0,boxY1);
  const w=Math.abs(boxX1-boxX0),h=Math.abs(boxY1-boxY0);
  el.style.left=x+'px';el.style.top=y+'px';el.style.width=w+'px';el.style.height=h+'px';
}

function clearBoxSelect(){
  const el=document.getElementById('box-select-rect');
  if(el)el.remove();
}

function applyBoxSelect(){
  const rect=document.getElementById('board').getBoundingClientRect();
  const mc=myColor();
  const x0=Math.min(boxX0,boxX1)-rect.left,x1=Math.max(boxX0,boxX1)-rect.left;
  const y0=Math.min(boxY0,boxY1)-rect.top, y1=Math.max(boxY0,boxY1)-rect.top;
  const newSel=new Set();
  for(let r=0;r<ROWS;r++){
    for(let cc=0;cc<COLS;cc++){
      const px=(cc+0.5)*sqPx,py=(r+0.5)*sqPx;
      if(px>=x0&&px<=x1&&py>=y0&&py<=y1){
        const i=idx(r,cc);
        if(pieces[i]&&pieces[i].color===mc&&pieces[i].type!=='king')newSel.add(i);
      }
    }
  }
  selectedPieces=newSel;
  render();
  setStatus(selectedPieces.size>0?selectedPieces.size+' piece(s) selected — use arrows to move':'Your turn');
}

// touch — prevent iOS rubber-band scroll on the game page
document.body.addEventListener('touchmove',e=>{
  if(e.target.closest('#board')||dragging)e.preventDefault();
},{passive:false});

// detect mobile for ghost offset
function isMobile(){return window.innerWidth<=768||window.innerHeight<=500;}

function touchXY(e){const t=e.touches[0]||e.changedTouches[0];return{x:t.clientX,y:t.clientY};}
document.getElementById('board').addEventListener('touchstart',e=>{
  if(over||thinking||!isMyTurn())return;
  const{x,y}=touchXY(e);const i=sqIdxFromPoint(x,y);if(i<0)return;
  const p=pieces[i];
  if(targetMode){handleTargetClick(i);e.preventDefault();return;}
  if(p&&p.color===myColor()){mouseDownI=i;mouseDownX=x;mouseDownY=y;e.preventDefault();}
  else if(!p&&kingSelected){mouseDownI=i;mouseDownX=x;mouseDownY=y;e.preventDefault();}
  // on mobile, also handle click-to-select immediately (short tap = select, drag = drag)
  else if(!p&&selectedPieces.size===1&&!kingSelected){
    // tapped empty tile with a piece selected — handle as click-to-move
    handleClick(i);e.preventDefault();return;
  }
},{passive:false});
document.addEventListener('touchmove',e=>{
  if(mouseDownI<0)return;const{x,y}=touchXY(e);const p=pieces[mouseDownI];
  if(!dragging&&p&&p.color===myColor()&&Math.hypot(x-mouseDownX,y-mouseDownY)>6){
    dragging=true;dragSrc=mouseDownI;dragDests=getDragDests(dragSrc);
    const g=document.getElementById('ghost');
    if(p.type==='siege'){g.textContent='';g.innerHTML=buildWhiteSiegeSVG(Math.floor(sqPx*.72));}
    else{g.innerHTML='';g.textContent=GLYPH[p.type+'_'+p.color];g.style.color=p.color==='w'?'#fff':'#1a0e04';}
    g.style.display='block';render();
  }
  if(dragging){
    const g=document.getElementById('ghost');
    // small offset so finger doesn't fully cover the ghost
    const yOff=isMobile()?-20:0;
    g.style.left=x+'px';g.style.top=(y+yOff)+'px';
    e.preventDefault();
  }
},{passive:false});
document.addEventListener('touchend',e=>{
  document.getElementById('ghost').style.display='none';const{x,y}=touchXY(e);
  if(dragging){const dropI=sqIdxFromPoint(x,y),src=dragSrc,dests=dragDests;dragging=false;dragSrc=-1;dragDests=null;if(dropI>=0&&src>=0)executeDrop(src,dropI,dests);else render();}
  else if(mouseDownI>=0&&!over&&!thinking&&isMyTurn())handleClick(mouseDownI);
  mouseDownI=-1;
});
