// ── BOARD INPUT: mouse, touch and pen ────────────────────────────────────────
// One set of Pointer Events handles every input. A drag redraws the board to show where the
// piece can go, which throws away the square the finger went down on; with touch events the
// rest of the gesture then went to that removed square and never arrived, so a drag needed a
// second touch. The pointer is captured on #board instead, which is never replaced, so every
// move and the release come here however the board is redrawn.
// the board's own rectangle is the size on screen, zoom and all (and during a gesture, the preview too)
function sqIdxFromPoint(x,y){
  const rect=document.getElementById('board').getBoundingClientRect();
  const c=Math.floor((x-rect.left)/(rect.width/COLS)),r=Math.floor((y-rect.top)/(rect.height/ROWS));
  return(r>=0&&r<ROWS&&c>=0&&c<COLS)?idx(r,c):-1;
}
// A meteor is aimed by the middle of its 2x2: the corner where four squares meet that lies nearest the
// point, kept one square in from the board's edge so the four are all on it. Returns the 2x2's top-left
// square (meteorReach in js/state.js), or -1 off the board.
function meteorAnchorFromPoint(x,y){
  const rect=document.getElementById('board').getBoundingClientRect();
  const fc=(x-rect.left)/(rect.width/COLS),fr=(y-rect.top)/(rect.height/ROWS);
  if(fr<0||fr>ROWS||fc<0||fc>COLS)return -1;
  const vr=Math.min(ROWS-1,Math.max(1,Math.round(fr))),vc=Math.min(COLS-1,Math.max(1,Math.round(fc)));
  return idx(vr-1,vc-1);
}

// ── ZOOM AND PAN GESTURES ─────────────────────────────────────────────────────
// Two fingers pinch the board and slide it at the same time. One finger slides it when the board is
// zoomed in and the press didn't start on one of your own pieces, and the mouse wheel zooms at the
// pointer. While a gesture runs the board is only moved and scaled; the squares are laid out again
// when it ends, so a pinch stays smooth however many pieces are on the board.
const pointers=new Map(); // every pointer down on the board: id → {x,y}
let gesture=null;         // {mode:'pinch'|'slide'|'wheel', ...} while zooming or sliding
let wheelTimer=null;
let ignoreRest=false;     // after a gesture, the fingers still down must not act as taps

function clipRect(){return document.getElementById('board-clip').getBoundingClientRect();}

function startPinch(){
  const[a,b]=[...pointers.values()];
  gesture={mode:'pinch',zoom:boardZoom,panX:boardPanX,panY:boardPanY,
    z0:boardZoom,x0:boardPanX,y0:boardPanY,oz:boardZoom,ox:boardPanX,oy:boardPanY,
    dist:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),mx:(a.x+b.x)/2,my:(a.y+b.y)/2};
}
function startSlide(x,y){
  gesture={mode:'slide',zoom:boardZoom,panX:boardPanX,panY:boardPanY,
    z0:boardZoom,x0:boardPanX,y0:boardPanY,oz:boardZoom,ox:boardPanX,oy:boardPanY,dist:1,mx:x,my:y};
}
// move the view so the point the gesture grabbed stays under the fingers, at the new zoom
function gestureTo(zoom,px,py){
  const r=clipRect(),g=gesture;
  const k=zoom/g.z0,fx=g.mx-r.left,fy=g.my-r.top;
  const[panX,panY]=clampPan(zoom,(px-r.left)-(fx-g.x0)*k,(py-r.top)-(fy-g.y0)*k);
  g.zoom=zoom;g.panX=panX;g.panY=panY;
  previewBoardView(zoom,panX,panY);
}
function moveGesture(){
  const g=gesture;if(!g)return;
  if(g.mode==='pinch'){
    const[a,b]=[...pointers.values()];
    if(!a||!b)return;
    const zoom=Math.max(1,Math.min(BOARD_ZOOM_MAX,g.z0*(Math.hypot(a.x-b.x,a.y-b.y)/g.dist)));
    gestureTo(zoom,(a.x+b.x)/2,(a.y+b.y)/2);
  }else{
    const p=[...pointers.values()][0];
    if(!p)return;
    gestureTo(g.z0,p.x,p.y);
  }
}
function endGesture(){
  const g=gesture;gesture=null;
  if(!g)return;
  // two fingers put down and lifted without moving is a tap, not a pinch: leave the view alone
  if(Math.abs(g.zoom-g.oz)<.02&&Math.abs(g.panX-g.ox)<3&&Math.abs(g.panY-g.oy)<3){applyBoardView();return;}
  commitBoardView(g.zoom,g.panX,g.panY);
}

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
  g.textContent='';g.innerHTML=pieceSVG(pieceArt(p),p.color,mapTheme,Math.floor(sqPx*.86));
  moveGhost(x,y,type);g.style.display='block';
  render();
}
function endDrag(){
  document.getElementById('ghost').style.display='none';
  dragging=false;dragSrc=-1;dragDests=null;
}

const boardInput=document.getElementById('board');

boardInput.addEventListener('pointerdown',e=>{
  // nothing was down, so anything left over from an earlier gesture is stale
  if(pointers.size===0){if(gesture)endGesture();press=null;ignoreRest=false;}
  if(e.pointerType!=='mouse'||e.button===0)pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  // a second finger: pinch the board instead of whatever the first one was starting
  if(pointers.size===2){
    e.preventDefault();
    if(dragging){endDrag();render();}
    if(press&&press.box){boxSelecting=false;clearBoxSelect();}
    press=null;ignoreRest=true;
    startPinch();
    try{boardInput.setPointerCapture(e.pointerId);}catch(err){}
    return;
  }
  if(pointers.size>2||ignoreRest)return;
  if(press)return;                                  // a second button while one is already down
  if(over||thinking||!isMyTurn()){
    // the board can still be slid while the other side thinks
    if(boardZoom>1.001&&!press){
      press={id:e.pointerId,type:e.pointerType,x:e.clientX,y:e.clientY,i:-1,canDrag:false,canBox:false,box:false};
      try{boardInput.setPointerCapture(e.pointerId);}catch(err){}
    }
    return;
  }
  const i=sqIdxFromPoint(e.clientX,e.clientY);if(i<0)return;
  if(e.pointerType==='mouse'&&e.button===2){e.preventDefault();handleRightClick(i,e);return;}
  if(e.button!==0)return;
  e.preventDefault();
  if(targetMode){handleTargetClick(i);return;}
  if(trainEditing()){
    // a piece under the pointer is carried if the pointer moves and placed on if it does not; with no
    // piece there a drag on a zoomed-in board slides the view, and the tap itself lands in handleClick
    const carry=!!pieces[i]&&trainPickUpAt(i,e.clientX,e.clientY,e.pointerType);
    press={id:e.pointerId,type:e.pointerType,x:e.clientX,y:e.clientY,i,canDrag:false,canBox:false,box:false,carry};
    try{boardInput.setPointerCapture(e.pointerId);}catch(err){}
    return;
  }
  const p=pieces[i];
  press={id:e.pointerId,type:e.pointerType,x:e.clientX,y:e.clientY,i,
    canDrag:!!(p&&p.color===myColor()),
    // dragging the mouse across empty squares draws a box that selects a group
    canBox:e.pointerType==='mouse'&&!p&&!kingSelected,box:false};
  try{boardInput.setPointerCapture(e.pointerId);}catch(err){}
});

// scrying with a mouse: the 3x3 a click would light, previewed under the pointer (render redraws the
// squares, which clears it; the next move puts it back)
let scryPreview=[];
function clearScryPreview(){scryPreview.forEach(j=>{const el=sqElAt(j);if(el)el.classList.remove('scry-preview');});scryPreview=[];}
function showScryPreview(x,y){
  const t=sqIdxFromPoint(x,y);
  const c=t>=0&&scryArea(scrySrc).has(t)?scryCenterFor(scrySrc,t):-1;
  const box=c>=0?scryBox(c):[];
  if(box.length===scryPreview.length&&box.every(j=>scryPreview.includes(j)))return;
  clearScryPreview();
  box.forEach(j=>{const el=sqElAt(j);if(el)el.classList.add('scry-preview');});
  scryPreview=box;
}
boardInput.addEventListener('pointerleave',()=>{if(scryPreview.length)clearScryPreview();if(meteorPreview.length)clearMeteorPreview();});

// aiming a meteor with a mouse: the 2x2 around the corner nearest the pointer, previewed the same way a
// scry is, when it lies within 3 squares of the Mage (meteorReach in js/state.js)
let meteorPreview=[];
function clearMeteorPreview(){meteorPreview.forEach(j=>{const el=sqElAt(j);if(el)el.classList.remove('meteor-preview');});meteorPreview=[];}
function showMeteorPreview(x,y){
  const a=meteorSrc>=0?meteorAnchorFromPoint(x,y):-1;
  const box=meteorReach(meteorSrc,a)?meteorBox(a):[];
  if(box.length===meteorPreview.length&&box.every(j=>meteorPreview.includes(j)))return;
  clearMeteorPreview();
  box.forEach(j=>{const el=sqElAt(j);if(el)el.classList.add('meteor-preview');});
  meteorPreview=box;
}

boardInput.addEventListener('pointermove',e=>{
  if(scryMode&&scrySrc>=0&&e.pointerType==='mouse'&&!press)showScryPreview(e.clientX,e.clientY);
  else if(scryPreview.length&&!scryMode)clearScryPreview();
  if(meteorMode&&e.pointerType==='mouse'&&!press)showMeteorPreview(e.clientX,e.clientY);
  else if(meteorPreview.length&&!meteorMode)clearMeteorPreview();
  const pt=pointers.get(e.pointerId);
  if(pt){pt.x=e.clientX;pt.y=e.clientY;}
  if(gesture){e.preventDefault();moveGesture();return;}
  if(!press||e.pointerId!==press.id)return;
  if(!dragging&&!press.box&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>(DRAG_START_PX[press.type]||6)){
    if(press.canDrag&&!over&&!thinking&&isMyTurn())startDrag(press.i,e.clientX,e.clientY,press.type);
    else if(press.carry){}                            // the training ground is carrying that piece itself
    // a board bigger than its frame slides under the finger
    else if(boardZoom>1.001){startSlide(press.x,press.y);moveGesture();return;}
    else if(press.canBox){press.box=true;boxSelecting=true;boxX0=press.x;boxY0=press.y;}
  }
  if(dragging)moveGhost(e.clientX,e.clientY,press.type);
  else if(press.box){boxX1=e.clientX;boxY1=e.clientY;drawBoxSelect();}
});

boardInput.addEventListener('pointerup',e=>{
  pointers.delete(e.pointerId);
  if(gesture){endGesture();press=null;if(pointers.size===0)ignoreRest=false;else ignoreRest=true;return;}
  if(ignoreRest){if(pointers.size===0)ignoreRest=false;return;}
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
  if(!over&&!thinking&&isMyTurn())handleClick(pr.i,e.shiftKey||e.ctrlKey||e.metaKey,{x:e.clientX,y:e.clientY});
});

boardInput.addEventListener('pointercancel',e=>{
  pointers.delete(e.pointerId);
  if(gesture){endGesture();press=null;ignoreRest=pointers.size>0;return;}
  if(pointers.size===0)ignoreRest=false;
  if(!press||e.pointerId!==press.id)return;
  const pr=press;press=null;
  if(pr.box){boxSelecting=false;clearBoxSelect();}
  if(dragging){endDrag();render();}
});

boardInput.addEventListener('contextmenu',e=>e.preventDefault());

// A finger can be lifted where the board never hears about it: capturing the pointer can fail, and a
// touch that ends over another element reports there instead. The ghost finger left behind turned the
// next tap into a two-finger pinch and the board stopped answering taps, so the window clears them and
// resets the board's input once nothing is down.
function forgetPointer(e){
  if(!pointers.has(e.pointerId))return;   // the board's own handler already dealt with it
  pointers.delete(e.pointerId);
  if(pointers.size===0){if(gesture)endGesture();press=null;ignoreRest=false;}
}
window.addEventListener('pointerup',forgetPointer);
window.addEventListener('pointercancel',forgetPointer);

// a double tap on the board must never zoom the page: the board has its own zoom, and the browser's
// double-tap zoom can leave a phone stuck at a magnification the game can't undo
let lastTapEnd=0;
boardInput.addEventListener('touchend',e=>{
  const t=Date.now();
  if(t-lastTapEnd<450)e.preventDefault();
  lastTapEnd=t;
},{passive:false});
boardInput.addEventListener('dblclick',e=>e.preventDefault());

// Safari on iPhone zooms the whole page on a pinch or a stray double tap, whatever touch-action says,
// which fights the board's own zoom; its gesture events are turned off here
['gesturestart','gesturechange','gestureend'].forEach(t=>document.addEventListener(t,e=>e.preventDefault(),{passive:false}));

// the mouse wheel zooms at the pointer; the view is committed once the wheel stops
document.getElementById('board-wrap').addEventListener('wheel',e=>{
  e.preventDefault();
  if(gesture&&gesture.mode!=='wheel')return;
  if(!gesture)gesture={mode:'wheel',zoom:boardZoom,panX:boardPanX,panY:boardPanY,
    z0:boardZoom,x0:boardPanX,y0:boardPanY,oz:boardZoom,ox:boardPanX,oy:boardPanY,dist:1,mx:e.clientX,my:e.clientY};
  const dy=e.deltaMode===1?e.deltaY*16:e.deltaMode===2?e.deltaY*100:e.deltaY;
  const zoom=Math.max(1,Math.min(BOARD_ZOOM_MAX,gesture.zoom*Math.exp(-dy*.0016)));
  // each wheel notch zooms about where the pointer is, so the gesture's grab point follows it
  gesture.z0=gesture.zoom;gesture.x0=gesture.panX;gesture.y0=gesture.panY;
  gesture.mx=e.clientX;gesture.my=e.clientY;
  gestureTo(zoom,e.clientX,e.clientY);
  clearTimeout(wheelTimer);
  wheelTimer=setTimeout(()=>{if(gesture&&gesture.mode==='wheel')endGesture();},130);
},{passive:false});

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
