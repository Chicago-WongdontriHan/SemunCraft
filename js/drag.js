// ── BOARD INPUT: mouse, touch and pen ────────────────────────────────────────
// One set of Pointer Events handles every input. A drag redraws the board to show where the
// piece can go, which throws away the square the finger went down on; with touch events the
// rest of the gesture then went to that removed square and never arrived, so a drag needed a
// second touch. The pointer is captured on #board instead, which is never replaced, so every
// move and the release come here however the board is redrawn.
function sqIdxFromPoint(x,y){const rect=document.getElementById('board').getBoundingClientRect();const c=Math.floor((x-rect.left)/sqPx)+viewCol0,r=Math.floor((y-rect.top)/sqPx)+viewRow0;return(r>=viewRow0&&r<viewRow0+viewRowsN()&&c>=viewCol0&&c<viewCol0+viewColsN())?idx(r,c):-1;}

// ── box selection state ───────────────────────────────────────────────────────
let boxSelecting=false,boxX0=0,boxY0=0,boxX1=0,boxY1=0,boxMouseDownOnEmpty=false;

// the pointer that went down on the board: {id, type, x, y, i, canDrag, canBox, box}
let press=null;
// how far a pointer travels before a press becomes a drag (a finger wobbles more than a mouse)
const DRAG_START_PX={mouse:5,pen:6,touch:8};

// the dragged piece follows the pointer; on touch it rides above the finger so it stays in sight
function moveGhost(x,y,type){
  const g=document.getElementById('ghost');
  g.style.left=x+'px';g.style.top=(y+(type==='mouse'?0:-20))+'px';
}
function startDrag(i,x,y,type){
  const p=pieces[i];
  dragging=true;dragSrc=i;dragDests=getDragDests(i);
  const g=document.getElementById('ghost');
  g.textContent='';g.innerHTML=pieceSVG(p.type,p.color,mapTheme,Math.floor(sqPx*.86));
  moveGhost(x,y,type);g.style.display='block';
  render();
}
function endDrag(){
  document.getElementById('ghost').style.display='none';
  dragging=false;dragSrc=-1;dragDests=null;
}

const boardInput=document.getElementById('board');

boardInput.addEventListener('pointerdown',e=>{
  if(press)return;                                  // a second finger while one is already down
  if(over||thinking||!isMyTurn())return;
  const i=sqIdxFromPoint(e.clientX,e.clientY);if(i<0)return;
  if(e.pointerType==='mouse'&&e.button===2){e.preventDefault();handleRightClick(i,e);return;}
  if(e.button!==0)return;
  e.preventDefault();
  if(targetMode){handleTargetClick(i);return;}
  const p=pieces[i];
  press={id:e.pointerId,type:e.pointerType,x:e.clientX,y:e.clientY,i,
    canDrag:!!(p&&p.color===myColor()),
    // dragging the mouse across empty squares draws a box that selects a group
    canBox:e.pointerType==='mouse'&&!p&&!kingSelected,box:false};
  try{boardInput.setPointerCapture(e.pointerId);}catch(err){}
});

boardInput.addEventListener('pointermove',e=>{
  if(!press||e.pointerId!==press.id)return;
  if(!dragging&&!press.box&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>(DRAG_START_PX[press.type]||6)){
    if(press.canDrag&&!over&&!thinking&&isMyTurn())startDrag(press.i,e.clientX,e.clientY,press.type);
    else if(press.canBox){press.box=true;boxSelecting=true;boxX0=press.x;boxY0=press.y;}
  }
  if(dragging)moveGhost(e.clientX,e.clientY,press.type);
  else if(press.box){boxX1=e.clientX;boxY1=e.clientY;drawBoxSelect();}
});

boardInput.addEventListener('pointerup',e=>{
  if(!press||e.pointerId!==press.id)return;
  const pr=press;press=null;
  if(dragging){
    const dropI=sqIdxFromPoint(e.clientX,e.clientY),src=dragSrc,dests=dragDests;
    endDrag();
    if(dropI>=0&&dropI!==src)executeDrop(src,dropI,dests);else render();
    return;
  }
  if(pr.box){
    boxX1=e.clientX;boxY1=e.clientY;
    applyBoxSelect();boxSelecting=false;clearBoxSelect();
    return;
  }
  // a tap or a click: select a piece and show its action guide, or take an action the guide offers
  if(!over&&!thinking&&isMyTurn())handleClick(pr.i,e.shiftKey||e.ctrlKey||e.metaKey);
});

boardInput.addEventListener('pointercancel',e=>{
  if(!press||e.pointerId!==press.id)return;
  const pr=press;press=null;
  if(pr.box){boxSelecting=false;clearBoxSelect();}
  if(dragging){endDrag();render();}
});

boardInput.addEventListener('contextmenu',e=>e.preventDefault());

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
  const gSz=selectedPieces.size;
  const gCan=gSz>=2&&gSz<=3&&[...selectedPieces].every(si=>{const sp=pieces[si];return sp&&(sp.type==='pawn'||sp.type==='knight');});
  setStatus(gSz===1?'Click a marker to act, or drag the piece':gSz>0?(gCan?gSz+' pcs — drag any to move group':gSz+' selected'):'Your turn');
}
