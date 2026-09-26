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
let trainLevel='easy';        // which AI that is: one of the trained networks, or the built-in bot
let trainSpeed=1;             // how fast it plays when it has a side: 1, 2, 4 or 8 times
let trainTimer=null;          // the one timer the AI keeps: two of them and the match races
const TRAIN_BEAT=700;         // ms between the AI's moves at 1x — the beat an AI vs AI match keeps
let trainPaused=false;        // a match with the AI in it is held still while the board is being built
let trainTab='units';         // which part of the box is open: the army, the ground, or the match
let trainView='auto';         // whose eyes the board is drawn through: 'auto', or a side of your own choosing
let trainLift=-1;             // the square the pointer went down on, while it is still down
let trainLiftXY=null;         // where it went down, so a tap can be told from a drag
let trainCarry=false;         // the pointer has moved: a piece is being carried, not tapped
let trainFromPalette=false;   // the gesture started on a palette button, so its pointerup does the placing
// trainMouse ('edit' | 'play') and trainEditing() are in js/state.js, where the board's own files see them

const TRAIN_TABS=[['units','Units'],['map','Map'],['play','Play']];

// the AI a side is handed to, and how big a board to lay out
const TRAIN_LEVELS=[['easy','Easy'],['medium','Med'],['hard','Hard'],['bot','Bot']];
const TRAIN_MIN=3,TRAIN_MAX=12;   // the board's sides, either way: the files run a to l

// the four maps, so the ground can be changed without leaving the sandbox
const TRAIN_THEMES=[['forest','🌲','Forest'],['jungle','🌴','Jungle'],
                    ['desert','🏜️','Desert'],['ocean','🌊','Ocean']];

// every unit the game has, in the order they merge into one another
const TRAIN_UNITS=[
  {type:'pawn',   art:'pawn',     name:'Pawn'},
  {type:'pawn',   art:'fortified',name:'Fortified',fortified:true},
  {type:'knight', art:'knight',   name:'Knight'},
  {type:'paladin',art:'paladin',  name:'Paladin'},
  {type:'bishop', art:'bishop',   name:'Bishop'},
  {type:'rook',   art:'rook',     name:'Rook'},
  {type:'guardian',art:'guardian',name:'Guardian'},
  {type:'siege',  art:'siege',    name:'Siege'},
  {type:'queen',  art:'queen',    name:'Queen'},
  {type:'mage',   art:'mage',     name:'Mage'},
  {type:'king',   art:'king',     name:'King'},
  // not one of the game's own: a target dummy to try the others' attacks on, and on neither side, so
  // it comes out the same whichever colour is picked and both sides fire at it (standUp, isFoe)
  {type:'scarecrow',art:'scarecrow',name:'Scarecrow',neutral:true},
];

function startTraining(){
  gameMode='training';difficulty='easy';
  trainingMode=true;trainBrush=null;trainColor='w';trainMouse='edit';
  trainAI={w:false,b:false};trainLift=-1;trainCarry=false;trainLevel='easy';trainSpeed=1;trainPaused=false;trainTab='units';trainView='auto';
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
  trainStopAI();
  const label=document.getElementById('units-label');
  if(label&&label.firstChild)label.firstChild.nodeValue='Units ';
  trainingMode=false;trainBrush=null;trainAI={w:false,b:false};trainLift=-1;trainCarry=false;
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
  // What the mouse is for, above everything else: it belongs to no one tab, and the Pause it turns into
  // has to be within reach whichever half of the box is open.
  let h='<div class="tp-grid tp-mode">'
    +wide('\u270E Edit',trainMouse==='edit',"trainSetMouse('edit')",'Clicks build the board: the left button puts down what is in hand or drags a piece about, the right button lifts what is there')
    +wide(trainRunning()?'\u23F8 Pause':'\u25B6 Play',trainMouse==='play'&&!trainPaused,'trainPlay()',
      'Clicks play the game: move, merge, order and target as usual \u2014 and with the AI on a side, this starts the match and stops it again')
    +'</div><div class="tp-grid tp-tabs">'
    +TRAIN_TABS.map(([t,name])=>'<button class="tp-tab'+(trainTab===t?' tp-on':'')+'" onclick="trainSetTab(\''+t+'\')">'+name+'</button>').join('')
    +'</div>';

  if(trainTab==='units'){
    // which side the units come out in — the words themselves, in their own colours
    h+='<div class="tp-grid tp-mode">'
      +'<button class="tp-wide tp-side-w'+(trainColor==='w'?' tp-on':'')+'" onclick="trainSetColor(\'w\')" title="Place White units">White</button>'
      +'<button class="tp-wide tp-side-b'+(trainColor==='b'?' tp-on':'')+'" onclick="trainSetColor(\'b\')" title="Place Black units">Black</button>'
      +'</div><div class="tp-grid tp-units">';
    TRAIN_UNITS.forEach((u,k)=>{
      const on=trainBrush&&trainBrush.kind==='unit'&&trainBrush.idx===k;
      h+=btn(pieceSVG(u.art,u.neutral?NEUTRAL:trainColor,mapTheme,px,true),u.name,on,'trainPickUnit('+k+')',u.name);
    });
    h+='</div><div class="tp-grid tp-tools">'
      +wide('Default',false,'trainDefaultUnits()','The line-up a normal game starts with: the two kings, three pawns each')
      +wide('Clear units',false,'trainClearUnits()','Take every unit off the board');
  }else if(trainTab==='map'){
    h+=trainStepper('Rows',ROWS,'trainStepSize(1,')+trainStepper('Cols',COLS,'trainStepSize(0,')
      +'<div class="tp-grid tp-themes">';
    TRAIN_THEMES.forEach(([t,icon,name])=>{
      h+=btn('<span class="tp-emoji">'+icon+'</span>',name,mapTheme===t,"trainSetTheme('"+t+"')",name+': new ground, and the units stay where they are');
    });
    h+='</div><div class="tp-grid tp-tiles">';
    // the two resource tiles, then whatever this map puts on the ground — the impassable ones marked
    const tiles=[{key:'spring',icon:RES_ELIXIR,name:'Spring',effect:'a pawn standing here draws Elixir while it holds it'},
                 {key:'mine',icon:RES_GOLD,name:'Mine',effect:'a pawn standing here earns Gold while it holds it'}];
    const th=THEMES[mapTheme];
    if(th&&th.tiles)Object.keys(th.tiles).forEach(k=>tiles.push({key:k,icon:'<span class="tp-emoji">'+th.tiles[k].icon+'</span>',
      name:th.tiles[k].label,effect:th.tiles[k].effect,block:th.tiles[k].block}));
    tiles.forEach(t=>{
      const on=trainBrush&&trainBrush.kind==='tile'&&trainBrush.tile===t.key;
      const mark=t.block?'<span class="tp-block" aria-hidden="true">\u26D4</span>':'';
      h+=btn(t.icon+mark,t.name,on,"trainPickTile('"+t.key+"')",t.name+' \u2014 '+(t.effect||'')+'. Tap it again on the board to take it away');
    });
    h+='</div><div class="tp-grid tp-tools">';
  }else{
    // the match itself: who plays which side, which AI it is, how fast, and what the two sides own
    h+='<div class="tp-grid tp-mode">'
      +wide('AI White',trainAI.w,"trainToggleAI('w')",'Let the AI take White. Both sides on plays a match out of the board you built')
      +wide('AI Black',trainAI.b,"trainToggleAI('b')",'Let the AI take Black. Both sides on plays a match out of the board you built')
      +'</div><div class="tp-grid tp-quad">';
    TRAIN_LEVELS.forEach(([lv,name])=>{
      h+=wide(name,trainLevel===lv,"trainSetLevel('"+lv+"')",
        lv==='bot'?'The built-in AI: no network to fetch':'The '+name+' trained network, the one Single Player plays');
    });
    h+=wide('Speed '+trainSpeed+'\u00D7',trainSpeed>1,'trainCycleSpeed()','How fast a side the AI has is played: 1, 2, 4 or 8 times');
    h+='</div>'
      +'<div class="tp-grid tp-mode">'
      +'<button class="tp-wide tp-side-w'+(trainColor==='w'?' tp-on':'')+'" onclick="trainSetColor(\'w\')" title="The side the purse below belongs to">White</button>'
      +'<button class="tp-wide tp-side-b'+(trainColor==='b'?' tp-on':'')+'" onclick="trainSetColor(\'b\')" title="The side the purse below belongs to">Black</button>'
      +'</div><div class="tp-grid tp-quad">'
      +'<span class="tp-step-name">View</span>'
      +wide('Auto',trainView==='auto','trainSetView(\'auto\')','The side the AI has not taken, or the side to move when both are yours')
      +wide('White',trainView==='w','trainSetView(\'w\')','Look at the board through White\'s eyes, fog and all')
      +wide('Black',trainView==='b','trainSetView(\'b\')','Look at the board through Black\'s eyes, fog and all')
      +'</div>'
      +trainStepper('Gold',goldText(Math.floor(goldCount(trainColor))),'trainAddGold(')
      +trainStepper('Elixir',elixirCount(trainColor)>=TRAIN_RICH?'\u221E':elixirCount(trainColor),'trainAddElixir(')
      +'<div class="tp-grid tp-tools">'
      +wide('\u221E Gold',goldCount(trainColor)>=TRAIN_RICH,'trainInfiniteGold()','Gold without end for the side chosen above, and off again')
      +wide('\u221E Elixir',elixirCount(trainColor)>=TRAIN_RICH,'trainInfiniteElixir()','Elixir without end for that side, and off again');
  }
  // the eraser and the empty hand belong to every half
  h+=wide('\u2715 Erase',!!(trainBrush&&trainBrush.kind==='erase'),'trainPickErase()','Take the unit off a square, or the tile under it (the right button does this too)')
    +wide('Drop brush',false,'trainPickNone()','Nothing in hand: the board is left alone until you pick something up')
    +'</div>';
  wrap.innerHTML=h;
  const label=document.getElementById('units-label');
  const name=(TRAIN_TABS.find(t=>t[0]===trainTab)||['','Units'])[1];
  if(label&&label.firstChild)label.firstChild.nodeValue=name+' ';
}
function trainSetTab(t){trainTab=t;trainPickNone();trainingPalette();}

// is a match actually running — the AI has a side, and nothing is holding it?
function trainRunning(){return trainMouse==='play'&&!trainPaused&&(trainAI.w||trainAI.b);}
// the Play button: it hands the mouse back to the game, and once the AI has a side it also starts the
// match and stops it again
function trainPlay(){
  if(trainMouse!=='play'){trainPaused=false;trainSetMouse('play');trainNudgeAI();return;}
  if(!trainAI.w&&!trainAI.b)return;
  trainPaused=!trainPaused;
  if(trainPaused)trainStopAI();
  trainingPalette();syncUI();
  setStatus(trainPaused?'Match paused':'Match running');
  addLog(trainPaused?'Paused':'Playing on');
  if(!trainPaused)trainNudgeAI();
}
// One pending turn at a time. Every path that wants the AI to move goes through here, so a turn that
// passes while another timer is still out does not end up playing two moves at once.
function trainSchedule(ms,stamp){
  clearTimeout(trainTimer);trainTimer=null;
  if(!trainingMode||over||trainPaused||!trainAI[turn])return;
  trainTimer=setTimeout(()=>{
    // a wait that belongs to one turn is no good once that turn has passed: the side comes round again
    // and the wait would play a second move on it
    if(stamp&&stamp!==trainStamp())return;
    trainAiTurn();
  },ms);
}
// which turn this is: the side, and how many turns that side has had
function trainStamp(){return turn+':'+(turn==='w'?whiteTurnCount:blackTurnCount);}
function trainStopAI(){clearTimeout(trainTimer);trainTimer=null;}
// A king has fallen. Nothing ends in the sandbox, but the match holds there: the board is left as it is
// and the Play button takes it up again, without the king that fell (js/game.js calls this).
function trainKingFell(){
  const standing=['w','b'].filter(c=>pieces.some(p=>p&&p.color===c&&p.type==='king'));
  const lost=standing.length===1?(standing[0]==='w'?'Black':'White'):'A';
  trainPaused=true;trainStopAI();
  addLog(lost+" king has fallen \u2014 press Play to go on");
  // the turn hand-over sets a status of its own a moment later, so this one waits for it
  setTimeout(()=>{if(trainingMode&&trainPaused)setStatus(lost+" king has fallen \u2014 press Play to go on without it");},0);
  trainingPalette();syncUI();
}
function trainNudgeAI(){trainSchedule(TRAIN_BEAT/trainSpeed);}
// the mouse builds or plays; picking anything out of the palette means building, and a board that is
// being built is a board standing still
function trainSetMouse(m){
  if(m==='edit')trainPaused=true;
  trainMouse=m;trainLift=-1;trainCarry=false;
  selectedPieces=new Set();kingSelected=false;
  trainingPalette();render();syncUI();
  setStatus(m==='edit'?'Editing the board — clicks place, drag moves a piece, the right button clears'
                      :(turn==='w'?"White's":"Black's")+' turn — clicks play the game');
  if(m==='play'&&trainSideIdle(turn))trainPassIdle();   // the side to move has nothing on the board
}
function trainSetColor(c){trainColor=c;trainingPalette();render();syncUI();}
// whose eyes the board is drawn through (viewColor in js/state.js)
function trainSetView(v){trainView=v;trainingPalette();render();syncUI();}

// ── the purse ────────────────────────────────────────────────────────────────
// Gold and Elixir for the side in hand (the White / Black switch says which), and a bottomless purse
// for both. Gold is what is left of the quota, so giving some means un-spending it.
function trainAddGold(d){
  goldSpent[trainColor]-=d;
  if(goldCount(trainColor)<0)goldSpent[trainColor]+=d;
  trainingPalette();render();syncUI();   // the counter in the palette shows it too
}
function trainAddElixir(d){
  elixir[trainColor]=Math.max(0,(elixir[trainColor]||0)+d);
  trainingPalette();render();syncUI();
}
// a bottomless purse, one side and one resource at a time: the switch belongs to the side in hand
function trainInfiniteGold(){
  const rich=goldCount(trainColor)>=TRAIN_RICH;
  goldSpent[trainColor]=rich?0:-TRAIN_RICH-GOLD_START;
  trainingPalette();render();syncUI();
  addLog((trainColor==='w'?'White':'Black')+"'s Gold "+(rich?'back to normal':'without end'));
}
function trainInfiniteElixir(){
  const rich=elixirCount(trainColor)>=TRAIN_RICH;
  elixir[trainColor]=rich?0:TRAIN_RICH+99;
  trainingPalette();render();syncUI();
  addLog((trainColor==='w'?'White':'Black')+"'s Elixir "+(rich?'back to normal':'without end'));
}
// which AI takes a side here: one of the trained networks, or the engine's own built-in bot
function trainCycleSpeed(){
  trainSpeed=trainSpeed>=8?1:trainSpeed*2;
  trainingPalette();
  addLog('AI speed '+trainSpeed+'×');
}
function trainSetLevel(lv){
  trainLevel=lv;
  trainingPalette();
  addLog('AI: '+(lv==='bot'?'built-in':lv));
  if(lv!=='bot'&&typeof netAiLoadModel==='function'&&NETAI_LEVELS[lv])netAiLoadModel(NETAI_LEVELS[lv].model).catch(()=>{});
}
// a counter with a minus and a plus, for a side of the board
function trainStepper(name,val,fn){
  return '<div class="tp-grid tp-quad tp-step">'
    +'<span class="tp-step-name">'+name+'</span>'
    +'<button class="tp-wide" onclick="'+fn+'-1)" title="One fewer">\u2212</button>'
    +'<span class="tp-step-val">'+val+'</span>'
    +'<button class="tp-wide" onclick="'+fn+'1)" title="One more">+</button>'
    +'</div>';
}
function trainStepSize(isRows,d){
  const r=isRows?ROWS+d:ROWS,c=isRows?COLS:COLS+d;
  trainSetSize(Math.min(TRAIN_MAX,Math.max(TRAIN_MIN,r)),Math.min(TRAIN_MAX,Math.max(TRAIN_MIN,c)));
}
// a fresh board of another size: the pieces cannot follow it, so it starts with the two kings on it,
// as far apart as the board allows
function trainSetSize(rows,cols){
  if(rows===ROWS&&cols===COLS)return;
  ROWS=rows;COLS=cols;
  pieces=new Array(rows*cols).fill(null);
  whiteTargets={};blackTargets={};selectedPieces=new Set();kingSelected=false;
  scans=[];meteors=[];flareTiles=[];exploredTiles=new Set();
  generateMap();
  const roomy=rows>3&&cols>3;
  const wk=roomy?idx(rows-2,1):idx(rows-1,0),bk=roomy?idx(1,cols-2):idx(0,cols-1);
  tileData[wk]='';tileData[bk]='';
  pieces[wk]={type:'king',color:'w',hp:STATS.king.hp,maxHp:STATS.king.maxHp};
  pieces[bk]={type:'king',color:'b',hp:STATS.king.hp,maxHp:STATS.king.maxHp};
  if(typeof ANIMALS_ON!=='undefined'&&ANIMALS_ON){startAnimalLoop();setTimeout(()=>renderAnimalOverlay(),50);}
  else{stopAnimalLoop();animals=[];}
  resetView();trainingPalette();resizeBoard();render();syncUI();
  addLog('Board: '+rows+' by '+cols);
}

// a new map under the same units: the ground is drawn again for that theme (spring and mine with it),
// and any unit that would be left standing inside a rock has the rock taken out from under it
function trainSetTheme(t){
  if(t===mapTheme)return;
  // Only the look changes: the board you built stays where it is. Every unit keeps its square, the
  // spring and the mine keep theirs, and each obstacle becomes this map's own kind of obstacle — a
  // tree turns into a palm, a rock, a dune. Anything the new map has no name for is cleared away.
  const from=THEMES[mapTheme]||THEMES.forest,to=THEMES[t]||THEMES.forest;
  const wasBlock=k=>k==='sandstone-spawner'||!!(from.tiles[k]&&from.tiles[k].block);
  const nowBlock=Object.keys(to.tiles).find(k=>to.tiles[k].block)||'';
  mapTheme=t;
  setBodyTheme(t);
  for(let i=0;i<ROWS*COLS;i++){
    const k=tileData[i];
    if(!k||RESOURCE_TILES[k])continue;
    tileData[i]=wasBlock(k)?nowBlock:(to.tiles[k]?k:'');
  }
  stopAnimalLoop();animals=[];           // the old map's creatures do not follow it
  document.querySelectorAll('.animal-el').forEach(el=>el.remove());
  trainingPalette();                     // the tile brushes belong to the map
  resizeBoard();render();syncUI();
  addLog('Map: '+t);
}

function trainPickUnit(k){
  const u=TRAIN_UNITS[k];
  trainBrush=(trainBrush&&trainBrush.kind==='unit'&&trainBrush.idx===k)?null:{kind:'unit',idx:k,type:u.type,fortified:!!u.fortified,neutral:!!u.neutral};
  if(trainBrush)trainMouse='edit';
  trainFromPalette=true;
  trainingPalette();
  trainStatus(trainBrush?(u.neutral?'':trainColor==='w'?'White ':'Black ')+u.name+' — tap a square':'');
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

// the line-up a normal game opens with, on whatever board is laid out: the two kings as far apart as
// it allows, and three pawns each on the squares beside a king that face the other one (initGame)
function trainDefaultUnits(){
  for(let i=0;i<ROWS*COLS;i++)pieces[i]=null;
  whiteTargets={};blackTargets={};selectedPieces=new Set();kingSelected=false;
  const roomy=ROWS>3&&COLS>3;
  const wk=roomy?idx(ROWS-2,1):idx(ROWS-1,0),bk=roomy?idx(1,COLS-2):idx(0,COLS-1);
  tileData[wk]='';tileData[bk]='';
  pieces[wk]={type:'king',color:'w',hp:STATS.king.hp,maxHp:STATS.king.maxHp};
  pieces[bk]={type:'king',color:'b',hp:STATS.king.hp,maxHp:STATS.king.maxHp};
  const line=(king,foe,color)=>adj8(king).filter(j=>!pieces[j]&&!isTileBlocked(j))
    .sort((a,b)=>cheb(a,foe)-cheb(b,foe)).slice(0,3)
    .forEach(j=>{pieces[j]={type:'pawn',color,hp:STATS.pawn.hp,maxHp:STATS.pawn.maxHp,firstMove:true};});
  line(wk,bk,'w');line(bk,wk,'b');
  addLog('The usual line-up');render();syncUI();
}
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
  if(trainAI[c]&&trainMouse==='play')trainPaused=false;
  trainingPalette();syncUI();render();   // the fog now belongs to the side the AI has not taken
  addLog((c==='w'?'White':'Black')+' is played by '+(trainAI[c]?'the AI':'you'));
  if(!trainAI[c])return;
  trainEngineReady();                    // the engine is fetched on demand, as the networks are
  if(turn===c)trainSchedule(TRAIN_BEAT/trainSpeed);
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
  if(trainSideIdle(turn)){trainPassIdle();return;}
  trainSchedule(TRAIN_BEAT/trainSpeed);
}
// A side with nothing on the board has nothing to do, so its turn goes straight back to the other one:
// a board of one colour (with a Scarecrow, say) plays turn after turn of the same side. Not when both
// sides are empty — then there is no one to hand the turn to. The Scarecrow is on neither side.
function trainSideIdle(color){
  const has=c=>pieces.some(p=>p&&p.color===c);
  return !has(color)&&has(color==='w'?'b':'w');
}
function trainPassIdle(){
  const side=turn;
  setTimeout(()=>{
    if(!trainingMode||over||thinking||turn!==side||!trainSideIdle(side))return;
    movedThisTurn=-1;
    endTurn();
    setStatus((side==='w'?'White':'Black')+' has no units \u2014 '+(turn==='w'?"White's":"Black's")+' turn again');
  },120);
}
function trainEngineState(side){
  const flip=side==='w';                 // the engine's bot plays Black: White borrows its side
  const sw=o=>flip?{w:o.b,b:o.w}:{w:o.w,b:o.b};
  const board=pieces.map(p=>{if(!p)return null;const q=Object.assign({},p);if(flip&&q.color!==NEUTRAL)q.color=q.color==='w'?'b':'w';return q;});
  return SemunEngine.fromSnapshot({cols:COLS,rows:ROWS,theme:mapTheme,mode:'classic',difficulty:'hard',
    board,tiles:tileData,turn:'b',fog:false,
    turnCount:sw({w:whiteTurnCount,b:blackTurnCount}),
    spawns:sw({w:spawnHistory.length,b:blackSpawnHistory.length}),
    targets:{w:{},b:{}},
    elixir:sw(elixir),mineTurns:sw(mineTurns),goldSpent:sw(goldSpent),orderLeft:sw(orderLeft)});
}
function trainAiTurn(){
  if(!trainingMode||over||trainPaused||!trainAI[turn])return;
  if(thinking){trainSchedule(120);return;}      // the attacks are still playing out
  if(typeof SemunEngine==='undefined'){
    trainEngineReady().then(ok=>{
      if(ok)trainSchedule(80);          // through the one timer, so nothing else is left pending
      else{addLog('The AI could not be loaded');trainAI.w=trainAI.b=false;trainingPalette();}
    });
    return;
  }
  const side=turn;
  // an action that leaves the turn in hand (an order) would stall the match: look again in a moment
  // an action that leaves the turn in hand (an order) would stall the match: look again in a moment,
  // but only while this same turn is still in hand
  trainSchedule(TRAIN_BEAT*2/trainSpeed,trainStamp());
  // a trained network needs its model on the page; while that arrives the built-in bot stands in
  if(trainLevel!=='bot'&&typeof netAiLoadModel==='function'&&NETAI_LEVELS[trainLevel]
     &&!netAiNets[NETAI_LEVELS[trainLevel].model]){
    netAiLoadModel(NETAI_LEVELS[trainLevel].model).then(()=>{},()=>{});
    trainAiPlay(trainAiBotAction(side));
    return;
  }
  trainAiPlay(trainLevel==='bot'?trainAiBotAction(side):trainAiNetAction(side));
}
// the engine's own AI, which plays whichever side the swapped board hands it
function trainAiBotAction(side){
  try{
    const ev=(SemunEngine.botTurn(trainEngineState(side))||[])[0];
    if(!ev)return null;
    return {type:ev.type,from:ev.from,to:ev.to};
  }catch(e){return null;}
}
// one of the trained networks, asked the way Single Player asks it (netAiChoose in js/netai.js)
function trainAiNetAction(side){
  try{return netAiChoose(trainEngineState(side),trainLevel);}catch(e){return null;}
}
// whatever it picked, played through the game's own handlers, exactly as a tap would be
function trainAiPlay(a){
  const from=a&&a.from!==undefined?a.from:-1;
  const p=from>=0?pieces[from]:null;
  const d=p&&p.color===turn?getDragDests(from):null;
  if(a&&d){
    if(a.type==='move'&&(d.move.has(a.to)||d.attack.has(a.to))){executeDrop(from,a.to,d);return;}
    // a bishop's merge asks which of heal or merge it meant, which no AI here can answer: it passes
    if(a.type==='merge'&&d.merge.has(a.to)&&p.type!=='bishop'){executeDrop(from,a.to,d);return;}
    if(a.type==='heal'&&d.heal.has(a.to)){executeDrop(from,a.to,d);return;}
    if(a.type==='fortify'&&canFortify(from)){fortifyAt(from);return;}
    if(a.type==='unsiege'&&p.type==='siege'){unsiegePiece(from);return;}
    if(a.type==='scry'&&p.type==='bishop'&&(p.mana||0)>=2){castScry(from,a.to);return;}
    if(a.type==='order'&&canOrder(from)&&orderTargets(from).has(a.to)){placeOrder(from,a.to,a.turns||1);return;}
  }
  if(a&&a.type==='spawn'&&a.to!==undefined&&!pieces[a.to]){
    // a pawn comes out beside its own king and nowhere else, as in any other game
    const k=pieces.findIndex(q=>q&&q.color===turn&&q.type==='king');
    if(k>=0&&adj8(k).includes(a.to)&&!isTileBlocked(a.to)){kingSelected=true;handleClick(a.to);return;}
  }
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
    const p={type:b.type,color:b.neutral?NEUTRAL:trainColor,hp:st.hp,maxHp:st.maxHp};
    if(b.fortified){p.fortified=true;p.hp=FORTIFIED_HP;p.maxHp=FORTIFIED_HP;}
    if(b.type==='pawn')p.firstMove=true;
    if(b.type==='bishop'||b.type==='mage')p.mana=2;
    delete whiteTargets[i];delete blackTargets[i];
    pieces[i]=p;
    addLog((b.neutral?'':trainColor==='w'?'White ':'Black ')+(b.fortified?'fortified pawn':b.type)+' at '+sqName(i));
  }
  selectedPieces=new Set();kingSelected=false;
  render();syncUI();
  return true;
}

// Carrying a piece about: in Edit the board has no rules about where a piece may stand, so a drag puts
// it on any square at all — whatever is in hand from the palette waits for a tap instead. js/drag.js
// calls this on pointerdown; the piece only leaves its square once the pointer actually moves.
function trainPickUpAt(i,x,y,ptype){
  if(!trainEditing()||!pieces[i])return false;
  trainLift=i;trainLiftXY={x,y,type:ptype};trainCarry=false;
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
  if(!trainCarry){
    if(Math.hypot(e.clientX-trainLiftXY.x,e.clientY-trainLiftXY.y)<6)return;   // still a tap
    const p=pieces[trainLift];
    if(!p){trainLift=-1;return;}
    trainCarry=true;
    const g=document.getElementById('ghost');
    g.textContent='';g.innerHTML=pieceSVG(pieceArt(p),p.color,mapTheme,Math.floor(sqPx*.86));
    g.style.display='block';
  }
  trainGhostAt(e.clientX,e.clientY,e.pointerType);
});

// Dragging a unit out of the palette: the button takes the brush as the finger goes down, and wherever
// the finger comes up on the board is where the unit lands. A tap that never leaves the palette simply
// keeps the brush in hand, so picking a unit and then tapping squares works the same way — and with an
// empty hand the same gesture carries a piece already on the board to another square.
window.addEventListener('pointerup',e=>{
  const fromPalette=trainFromPalette;trainFromPalette=false;
  const lifted=trainLift,carried=trainCarry;
  trainLift=-1;trainCarry=false;
  if(carried)document.getElementById('ghost').style.display='none';
  if(!trainEditing())return;
  if(e.target&&e.target.closest&&e.target.closest('#train-palette'))return;
  const board=document.getElementById('board');
  const under=document.elementFromPoint(e.clientX,e.clientY);
  const i=board&&under&&board.contains(under)?sqIdxFromPoint(e.clientX,e.clientY):-1;
  if(i<0){if(carried)render();return;}
  if(carried&&lifted>=0){trainDropPiece(lifted,i);return;}
  if(fromPalette&&trainBrush)trainingPlace(i);   // a tap that began on the board is placed by handleClick
});
