// ── TRAINING GROUND ───────────────────────────────────────────────────────────
// A sandbox. Every unit in the game can be put on the board in either colour, the spring, the mine and
// the map's own tiles can be dug in or taken away, the ground can be swapped for another map, and the
// turn is passed by hand — so both sides are played from the same seat unless the AI is handed one of
// them (or both, which plays a match out of the arrangement you built). The point is to watch the rules
// run, not to win: nothing ends here, and when a king falls the game carries on (endTurn in js/game.js).
//
// The board is either being built or being played, and the palette says which: in **Edit** the mouse
// puts down whatever is in hand, drags any piece to any square and lifts things with the right button;
// in **Play** every click is an ordinary game move again.

let trainBrush=null;          // what the next tap puts down: a unit, a tile, or the eraser
let trainColor='w';
let trainAI={w:false,b:false};// the sides the AI plays; both is a match from your own arrangement
let trainLift=-1;             // the square a piece was picked up from while the pointer is still down
let trainFromPalette=false;   // the gesture started on a palette button, so its pointerup does the placing
// trainMouse ('edit' | 'play') and trainEditing() are in js/state.js, where the board's own files see them

// the four maps, so the ground can be changed without leaving the sandbox
const TRAIN_THEMES=[['forest','🌲','Forest'],['jungle','🌴','Jungle'],
                    ['desert','🏜️','Desert'],['ocean','🌊','Ocean']];

// every unit the game has, in the order they merge into one another
const TRAIN_UNITS=[
  {type:'pawn',   art:'pawn',     name:'Pawn'},
  {type:'pawn',   art:'fortified',name:'Fortified',fortified:true},
  {type:'knight', art:'knight',   name:'Knight'},
  {type:'bishop', art:'bishop',   name:'Bishop'},
  {type:'rook',   art:'rook',     name:'Rook'},
  {type:'siege',  art:'siege',    name:'Siege'},
  {type:'queen',  art:'queen',    name:'Queen'},
  {type:'mage',   art:'mage',     name:'Mage'},
  {type:'king',   art:'king',     name:'King'},
];

function startTraining(){
  gameMode='training';difficulty='easy';
  trainingMode=true;trainBrush=null;trainColor='w';trainMouse='edit';
  trainAI={w:false,b:false};trainLift=-1;
  campaignLevel=null;campaignLevelId=-1;
  COLS=9;ROWS=9;
  document.getElementById('intro').classList.add('hidden');
  document.getElementById('pvp-section').style.display='none';
  document.getElementById('pvp-label').style.display='none';
  document.body.classList.add('training');
  initGame();
  mapCheat=true;                         // a sandbox with fog over it would hide its own experiment
  const mcBtn=document.getElementById('btn-mapcheat');
  if(mcBtn)mcBtn.innerHTML=uiLabel('map','Map Cheat: ON');
  trainingPalette();
  addLog('Training ground — both sides are yours');
  render();syncUI();
  setStatus("White's turn — pick a unit on the left, then tap the board");
}

function leaveTraining(){
  trainingMode=false;trainBrush=null;trainAI={w:false,b:false};trainLift=-1;
  document.body.classList.remove('training');
}

// ── the palette in the left panel ─────────────────────────────────────────────
function trainingPalette(){
  const wrap=document.getElementById('train-palette');
  if(!wrap)return;
  const px=Math.max(24,Math.floor((window.lastPf||10)*2.85));   // half again the unit cards' size: these are for picking, not reading
  const btn=(inner,label,on,click,title)=>'<button class="tp-btn'+(on?' tp-on':'')+'" title="'+title+'" '
    +'onpointerdown="'+click+'">'+inner+'<span class="tp-label">'+label+'</span></button>';
  const wide=(text,on,click,title)=>'<button class="tp-wide'+(on?' tp-on':'')+'" onclick="'+click+'" title="'+title+'">'+text+'</button>';
  // what the mouse is for: building the board, or playing on it
  let h='<div class="tp-grid tp-mode">'
    +wide('✎ Edit',trainMouse==='edit',"trainSetMouse('edit')",'Clicks build the board: the left button puts down what is in hand or drags a piece about, the right button lifts what is there')
    +wide('▶ Play',trainMouse==='play',"trainSetMouse('play')",'Clicks play the game: move, merge, order and target as usual')
    +'</div><div class="tp-grid tp-mode">'
    +wide('AI White',trainAI.w,"trainToggleAI('w')",'Let the AI take White. Both sides on plays a match out of the board you built')
    +wide('AI Black',trainAI.b,"trainToggleAI('b')",'Let the AI take Black. Both sides on plays a match out of the board you built')
    +'</div><div class="tp-grid tp-themes">';
  TRAIN_THEMES.forEach(([t,icon,name])=>{
    h+=btn('<span class="tp-emoji">'+icon+'</span>',name,mapTheme===t,"trainSetTheme('"+t+"')",name+': new ground, and the units stay where they are');
  });
  h+='</div><div class="tp-grid tp-colors">'
    +btn(pieceSVG('pawn','w',mapTheme,px,true),'White',trainColor==='w',"trainSetColor('w')",'Place White units')
    +btn(pieceSVG('pawn','b',mapTheme,px,true),'Black',trainColor==='b',"trainSetColor('b')",'Place Black units')
    +'</div><div class="tp-grid tp-units">';
  TRAIN_UNITS.forEach((u,k)=>{
    const on=trainBrush&&trainBrush.kind==='unit'&&trainBrush.idx===k;
    h+=btn(pieceSVG(u.art,trainColor,mapTheme,px,true),u.name,on,'trainPickUnit('+k+')',u.name);
  });
  h+='</div><div class="tp-grid tp-tiles">';
  // the two resource tiles, then whatever this map puts on the ground — the impassable ones marked
  const tiles=[{key:'spring',icon:RES_ELIXIR,name:'Spring',effect:'a pawn standing here can spend its turn extracting Elixir'},
               {key:'mine',icon:RES_GOLD,name:'Mine',effect:'a pawn standing here earns Gold while it holds it'}];
  const th=THEMES[mapTheme];
  if(th&&th.tiles)Object.keys(th.tiles).forEach(k=>tiles.push({key:k,icon:'<span class="tp-emoji">'+th.tiles[k].icon+'</span>',
    name:th.tiles[k].label,effect:th.tiles[k].effect,block:th.tiles[k].block}));
  tiles.forEach(t=>{
    const on=trainBrush&&trainBrush.kind==='tile'&&trainBrush.tile===t.key;
    const mark=t.block?'<span class="tp-block" aria-hidden="true">⛔</span>':'';
    h+=btn(t.icon+mark,t.name,on,"trainPickTile('"+t.key+"')",t.name+' — '+(t.effect||'')+'. Tap it again on the board to take it away');
  });
  h+=btn('<span class="tp-emoji">✕</span>','Erase',!!(trainBrush&&trainBrush.kind==='erase'),'trainPickErase()','Take the unit off a square, or the tile under it (the right button does this too)');
  h+='</div><div class="tp-grid tp-tools">'
    +wide('Clear units',false,'trainClearUnits()','Take every unit off the board')
    +wide('Drop brush',false,'trainPickNone()','Nothing in hand: the board is left alone until you pick something up')
    +'</div>';
  wrap.innerHTML=h;
}

// the mouse builds or plays; picking anything out of the palette means building
function trainSetMouse(m){
  trainMouse=m;trainLift=-1;
  selectedPieces=new Set();kingSelected=false;
  trainingPalette();render();syncUI();
  setStatus(m==='edit'?'Editing the board — clicks place, drag moves a piece, the right button clears'
                      :(turn==='w'?"White's":"Black's")+' turn — clicks play the game');
}
function trainSetColor(c){trainColor=c;trainingPalette();}

// a new map under the same units: the ground is drawn again for that theme (spring and mine with it),
// and any unit that would be left standing inside a rock has the rock taken out from under it
function trainSetTheme(t){
  if(t===mapTheme)return;
  mapTheme=t;
  generateMap();
  for(let i=0;i<ROWS*COLS;i++)if(pieces[i]&&isTileBlocked(i))tileData[i]='';
  if(typeof ANIMALS_ON!=='undefined'&&ANIMALS_ON){startAnimalLoop();setTimeout(()=>renderAnimalOverlay(),50);}
  else{stopAnimalLoop();animals=[];}
  trainingPalette();                     // the tile brushes belong to the map
  resizeBoard();render();syncUI();
  addLog('Map: '+t);
}

function trainPickUnit(k){
  const u=TRAIN_UNITS[k];
  trainBrush=(trainBrush&&trainBrush.kind==='unit'&&trainBrush.idx===k)?null:{kind:'unit',idx:k,type:u.type,fortified:!!u.fortified};
  if(trainBrush)trainMouse='edit';
  trainFromPalette=true;
  trainingPalette();
  trainStatus(trainBrush?(trainColor==='w'?'White ':'Black ')+u.name+' — tap a square':'');
}
function trainPickTile(t){
  trainBrush=(trainBrush&&trainBrush.kind==='tile'&&trainBrush.tile===t)?null:{kind:'tile',tile:t};
  if(trainBrush)trainMouse='edit';
  trainFromPalette=true;
  trainingPalette();
  trainStatus(trainBrush?t+' — tap a square (tap it again to take it away)':'');
}
function trainPickErase(){
  trainBrush=trainBrush&&trainBrush.kind==='erase'?null:{kind:'erase'};
  if(trainBrush)trainMouse='edit';
  trainFromPalette=true;
  trainingPalette();
  trainStatus(trainBrush?'Eraser — tap a unit, or an empty square to clear its tile':'');
}
function trainPickNone(){trainBrush=null;trainingPalette();trainStatus('');}
function trainStatus(msg){setStatus(msg||((turn==='w'?"White's":"Black's")+' turn'));}

function trainClearUnits(){
  for(let i=0;i<ROWS*COLS;i++)pieces[i]=null;
  whiteTargets={};blackTargets={};selectedPieces=new Set();kingSelected=false;
  addLog('Board cleared');render();syncUI();
}

// ── the AI taking a side ──────────────────────────────────────────────────────
// The built-in AI plays Black, so White's turn is handed to it on a board with the colours swapped —
// the squares are the same, only the sides are exchanged, and the move it picks is played back through
// the game's own handlers, exactly as a tap would be. With both sides on it plays itself.
function trainToggleAI(c){
  trainAI[c]=!trainAI[c];
  trainingPalette();syncUI();
  addLog((c==='w'?'White':'Black')+' is played by '+(trainAI[c]?'the AI':'you'));
  if(!trainAI[c])return;
  trainEngineReady();                    // the engine is fetched on demand, as the networks are
  if(turn===c&&!thinking)setTimeout(trainAiTurn,300);
}
// js/engine.js is not on the page until something asks for it (netai.js loads it the same way)
function trainEngineReady(){
  if(typeof SemunEngine!=='undefined')return Promise.resolve(true);
  if(typeof netAiLoadScript!=='function')return Promise.resolve(false);
  return netAiLoadScript('js/engine.js').then(()=>typeof SemunEngine!=='undefined').catch(()=>false);
}
// called by endTurn once the turn has changed hands (js/game.js)
function trainAfterPass(){
  if(!trainingMode||over)return;
  if(trainAI[turn])setTimeout(trainAiTurn,450);
}
function trainEngineState(side){
  const flip=side==='w';                 // the engine's bot plays Black: White borrows its side
  const sw=o=>flip?{w:o.b,b:o.w}:{w:o.w,b:o.b};
  const board=pieces.map(p=>{if(!p)return null;const q=Object.assign({},p);if(flip)q.color=q.color==='w'?'b':'w';return q;});
  return SemunEngine.fromSnapshot({cols:COLS,rows:ROWS,theme:mapTheme,mode:'classic',difficulty:'hard',
    board,tiles:tileData,turn:'b',fog:false,
    turnCount:sw({w:whiteTurnCount,b:blackTurnCount}),
    spawns:sw({w:spawnHistory.length,b:blackSpawnHistory.length}),
    targets:{w:{},b:{}},
    elixir:sw(elixir),mineTurns:sw(mineTurns),goldSpent:sw(goldSpent),orderLeft:sw(orderLeft)});
}
function trainAiTurn(){
  if(!trainingMode||over||!trainAI[turn]||thinking)return;
  if(typeof SemunEngine==='undefined'){
    trainEngineReady().then(ok=>{
      if(ok)trainAiTurn();
      else{addLog('The AI could not be loaded');trainAI.w=trainAI.b=false;trainingPalette();}
    });
    return;
  }
  const side=turn;
  // an action that leaves the turn in hand (an order) would stall the match: look again in a moment
  setTimeout(()=>{if(trainingMode&&!over&&turn===side&&trainAI[side]&&!thinking)trainAiTurn();},900);
  let ev=null;
  try{
    const s=trainEngineState(side);
    ev=(SemunEngine.botTurn(s)||[])[0];
  }catch(e){ev=null;}
  const from=ev&&ev.from!==undefined?ev.from:-1;
  const p=from>=0?pieces[from]:null;
  const d=p&&p.color===turn?getDragDests(from):null;
  if(ev&&ev.type==='move'&&d&&(d.move.has(ev.to)||d.attack.has(ev.to))){executeDrop(from,ev.to,d);return;}
  // a bishop's merge asks which of heal or merge it meant, which no AI here can answer: it passes instead
  if(ev&&ev.type==='merge'&&d&&d.merge.has(ev.to)&&p.type!=='bishop'){executeDrop(from,ev.to,d);return;}
  if(ev&&ev.type==='spawn'&&ev.to!==undefined&&!pieces[ev.to]){kingSelected=true;handleClick(ev.to);return;}
  if(ev&&ev.type==='extract'&&canExtract(ev.at)){extractAt(ev.at);return;}
  doSkip();
}

// ── putting something down, and lifting it again ──────────────────────────────
// the right button (and the eraser brush) lifts whatever is on a square: the unit first, the tile next
function trainErase(i){
  if(i<0||i>=ROWS*COLS)return false;
  if(pieces[i]){addLog(pieces[i].type+' removed from '+sqName(i));pieces[i]=null;}
  else if(tileData[i]){addLog(sqName(i)+' cleared');tileData[i]='';}
  else return false;
  delete whiteTargets[i];delete blackTargets[i];
  selectedPieces=new Set();kingSelected=false;
  render();syncUI();
  return true;
}

// Returns true when the tap was spent on the palette, so the board leaves it alone.
function trainingPlace(i){
  if(!trainEditing()||i<0)return false;
  const b=trainBrush;
  if(!b)return true;                     // an empty hand in Edit: the drag below does the moving
  if(b.kind==='erase'){
    trainErase(i);
    return true;
  }else if(b.kind==='tile'){
    if(tileData[i]===b.tile){tileData[i]='';addLog(sqName(i)+' cleared');}
    else{
      // an obstacle cannot have a unit standing in it
      if(isTileBlocked(i)||((THEMES[mapTheme].tiles[b.tile]||{}).block))pieces[i]=null;
      tileData[i]=b.tile;addLog(b.tile+' at '+sqName(i));
    }
  }else{
    if(isTileBlocked(i))tileData[i]='';               // the unit needs ground to stand on
    if(b.type==='king'){                              // one king a side: the old one steps aside
      const k=pieces.findIndex(q=>q&&q.color===trainColor&&q.type==='king');
      if(k>=0&&k!==i)pieces[k]=null;
    }
    const st=STATS[b.type]||{hp:1,maxHp:1};
    const p={type:b.type,color:trainColor,hp:st.hp,maxHp:st.maxHp};
    if(b.fortified){p.fortified=true;p.hp=FORTIFIED_HP;p.maxHp=FORTIFIED_HP;}
    if(b.type==='pawn')p.firstMove=true;
    if(b.type==='bishop'||b.type==='mage')p.mana=2;
    delete whiteTargets[i];delete blackTargets[i];
    pieces[i]=p;
    addLog((trainColor==='w'?'White ':'Black ')+(b.fortified?'fortified pawn':b.type)+' at '+sqName(i));
  }
  selectedPieces=new Set();kingSelected=false;
  render();syncUI();
  return true;
}

// picking a piece up with an empty hand and carrying it anywhere: in Edit the board has no rules about
// where a piece may stand, so any square will do (js/drag.js calls this on pointerdown)
function trainPickUpAt(i,x,y,ptype){
  if(!trainEditing()||trainBrush||!pieces[i])return false;
  trainLift=i;
  const p=pieces[i],g=document.getElementById('ghost');
  g.textContent='';g.innerHTML=pieceSVG(pieceArt(p),p.color,mapTheme,Math.floor(sqPx*.86));
  trainGhostAt(x,y,ptype);
  g.style.display='block';
  return true;
}
function trainGhostAt(x,y,ptype){
  const g=document.getElementById('ghost');
  g.style.left=x+'px';g.style.top=(y+(ptype==='mouse'?0:-20))+'px';
}
function trainDropPiece(from,to){
  const p=pieces[from];
  if(!p||from===to){render();return;}
  if(isTileBlocked(to))tileData[to]='';
  pieces[from]=null;pieces[to]=p;
  delete whiteTargets[from];delete blackTargets[from];
  delete whiteTargets[to];delete blackTargets[to];
  if(p.order)delete p.order;             // where it was going no longer means anything
  addLog(p.type+' moved to '+sqName(to));
  selectedPieces=new Set();kingSelected=false;
  render();syncUI();
}

window.addEventListener('pointermove',e=>{
  if(trainLift<0)return;
  trainGhostAt(e.clientX,e.clientY,e.pointerType);
});

// Dragging a unit out of the palette: the button takes the brush as the finger goes down, and wherever
// the finger comes up on the board is where the unit lands. A tap that never leaves the palette simply
// keeps the brush in hand, so picking a unit and then tapping squares works the same way — and with an
// empty hand the same gesture carries a piece already on the board to another square.
window.addEventListener('pointerup',e=>{
  const fromPalette=trainFromPalette;trainFromPalette=false;
  if(!trainEditing()){trainLift=-1;return;}
  const lifted=trainLift;trainLift=-1;
  if(lifted>=0)document.getElementById('ghost').style.display='none';
  if(e.target&&e.target.closest&&e.target.closest('#train-palette'))return;
  const board=document.getElementById('board');
  const under=document.elementFromPoint(e.clientX,e.clientY);
  const i=board&&under&&board.contains(under)?sqIdxFromPoint(e.clientX,e.clientY):-1;
  if(i<0){if(lifted>=0)render();return;}
  if(lifted>=0){trainDropPiece(lifted,i);return;}
  if(fromPalette&&trainBrush)trainingPlace(i);   // a tap that began on the board is placed by handleClick
});
