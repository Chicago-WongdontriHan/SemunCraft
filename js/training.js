// ── TRAINING GROUND ───────────────────────────────────────────────────────────
// A sandbox with no AI in it. Every unit in the game can be put on the board in either colour, the
// spring, the mine and the map's own tiles can be dug in or taken away, and the turn is passed by hand
// so both sides are played from the same seat — the point is to watch the rules run, not to win.
// Nothing ends here: when a king falls the game carries on (endTurn in js/game.js).

// what the next tap on the board puts down: a unit, a tile, or the eraser
let trainBrush=null;
let trainColor='w';

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
  trainingMode=true;trainBrush=null;trainColor='w';
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
  trainingMode=false;trainBrush=null;
  document.body.classList.remove('training');
}

// ── the palette in the left panel ─────────────────────────────────────────────
function trainingPalette(){
  const wrap=document.getElementById('train-palette');
  if(!wrap)return;
  const px=Math.max(16,Math.floor((window.lastPf||10)*1.9));
  const btn=(inner,label,on,click,title)=>'<button class="tp-btn'+(on?' tp-on':'')+'" title="'+title+'" '
    +'onpointerdown="'+click+'">'+inner+'<span class="tp-label">'+label+'</span></button>';
  let h='<div class="tp-grid tp-colors">'
    +btn(pieceSVG('pawn','w',mapTheme,px,true),'White',trainColor==='w',"trainSetColor('w')",'Place White units')
    +btn(pieceSVG('pawn','b',mapTheme,px,true),'Black',trainColor==='b',"trainSetColor('b')",'Place Black units')
    +'</div><div class="tp-grid tp-units">';
  TRAIN_UNITS.forEach((u,k)=>{
    const on=trainBrush&&trainBrush.kind==='unit'&&trainBrush.idx===k;
    h+=btn(pieceSVG(u.art,trainColor,mapTheme,px,true),u.name,on,'trainPickUnit('+k+')',u.name);
  });
  h+='</div><div class="tp-grid tp-tiles">';
  // the two resource tiles, then whatever this map puts on the ground
  const tiles=[{key:'spring',icon:RES_ELIXIR,name:'Spring'},{key:'mine',icon:RES_GOLD,name:'Mine'}];
  const th=THEMES[mapTheme];
  if(th&&th.tiles)Object.keys(th.tiles).forEach(k=>tiles.push({key:k,icon:'<span class="tp-emoji">'+th.tiles[k].icon+'</span>',name:th.tiles[k].label}));
  tiles.forEach(t=>{
    const on=trainBrush&&trainBrush.kind==='tile'&&trainBrush.tile===t.key;
    h+=btn(t.icon,t.name,on,"trainPickTile('"+t.key+"')",t.name+' — tap it again on the board to take it away');
  });
  h+=btn('<span class="tp-emoji">✕</span>','Erase',!!(trainBrush&&trainBrush.kind==='erase'),'trainPickErase()','Take the unit off a square, or the tile under it');
  h+='</div><div class="tp-grid tp-tools">'
    +'<button class="tp-wide" onclick="trainClearUnits()">Clear units</button>'
    +'<button class="tp-wide" onclick="trainPickNone()">Done placing</button>'
    +'</div>';
  wrap.innerHTML=h;
}

function trainSetColor(c){trainColor=c;trainingPalette();}
function trainPickUnit(k){
  const u=TRAIN_UNITS[k];
  trainBrush=(trainBrush&&trainBrush.kind==='unit'&&trainBrush.idx===k)?null:{kind:'unit',idx:k,type:u.type,fortified:!!u.fortified};
  trainingPalette();
  trainStatus(trainBrush?(trainColor==='w'?'White ':'Black ')+u.name+' — tap a square':'');
}
function trainPickTile(t){
  trainBrush=(trainBrush&&trainBrush.kind==='tile'&&trainBrush.tile===t)?null:{kind:'tile',tile:t};
  trainingPalette();
  trainStatus(trainBrush?t+' — tap a square (tap it again to take it away)':'');
}
function trainPickErase(){
  trainBrush=trainBrush&&trainBrush.kind==='erase'?null:{kind:'erase'};
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

// ── putting something down ────────────────────────────────────────────────────
// Returns true when the tap was spent on the palette's brush, so the board leaves it alone.
function trainingPlace(i){
  if(!trainingMode||!trainBrush||i<0)return false;
  const b=trainBrush;
  if(b.kind==='erase'){
    if(pieces[i]){addLog(pieces[i].type+' removed from '+sqName(i));pieces[i]=null;}
    else if(tileData[i]){tileData[i]='';addLog(sqName(i)+' cleared');}
  }else if(b.kind==='tile'){
    if(tileData[i]===b.tile){tileData[i]='';addLog(sqName(i)+' cleared');}
    else{
      // an obstacle cannot have a unit standing in it
      if(isTileBlocked(i)||(THEMES[mapTheme].tiles[b.tile]||{}).block)pieces[i]=null;
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

// Dragging a unit out of the palette: the button takes the brush as the finger goes down, and wherever
// the finger comes up on the board is where the unit lands. A tap that never leaves the palette simply
// keeps the brush in hand, so picking a unit and then tapping squares works the same way.
window.addEventListener('pointerup',e=>{
  if(!trainingMode||!trainBrush)return;
  if(e.target&&e.target.closest&&e.target.closest('#train-palette'))return;
  const board=document.getElementById('board');
  const under=document.elementFromPoint(e.clientX,e.clientY);
  if(!board||!under||!board.contains(under))return;
  const i=sqIdxFromPoint(e.clientX,e.clientY);
  if(i>=0)trainingPlace(i);
});
