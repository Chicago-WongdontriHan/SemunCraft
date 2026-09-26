// ── GAME STATE ───────────────────────────────────────────────────────────────
let pieces=new Array(ROWS*COLS).fill(null),turn='w',over=true,thinking=false,logLines=[],kingSelected=false;
let selectedPieces=new Set(); // indices of white pieces selected for group move
let whiteGroupSpeeds={}; // (unused)
let spawnHistory=[]; // how many total spawns used (white)
let blackSpawnHistory=[]; // how many total spawns used (black)
let whiteTurnCount=0; // total white turns this game
let blackTurnCount=0; // total black turns this game
let movedThisTurn=-1; // idx of white piece that acted this turn (cannot auto-attack)
// Gold: 8 to start and a sixth a turn — a sixth more for every turn that ends with a pawn of yours
// on the gold mine. A pawn from the King costs one, and so does fortifying a pawn, so both wait until
// a whole Gold is in hand. The same sums are in js/engine.js, written the same way so both sides land
// on the same number: turns are counted as whole numbers and divided once, never added up in sixths.
const GOLD_START=8, GOLD_TURNS=6;
// The mines and the springs both pay for being held: every turn that ends with a plain pawn of yours on
// a mine earns a sixth of Gold more, and on a spring half an Elixir (ELIXIR_RATE). There are five such tiles
// (RESOURCE_SQUARES), so holding them all costs five pawns that fight nowhere else, and each is a
// known square the other side can raid. (creditResources below, finishTurn in js/engine.js)
const RESOURCE_TILES={spring:'elixir',mine:'gold'};
// [row, col, tile]: a mine at e5, the same 3 squares from both kings; a mine (f2 / d8) and a spring
// (b6 / h4) for each side, 4 from its own king and 6 from the other's, mirrored through the centre
const RESOURCE_SQUARES=[[4,4,'mine'],[7,5,'mine'],[1,3,'mine'],[3,1,'spring'],[5,7,'spring']];
let elixir={w:0,b:0};     // Elixir drawn from the springs
let mineTurns={w:0,b:0};  // mine-turns: one for each mine a pawn of that side held at the end of a turn
let goldSpent={w:0,b:0};  // Gold spent on anything but spawning: fortified pawns
const FORTIFIED_HP=3;     // a fortified pawn is a pawn in a helmet, with three life
// Elixir is the top tier's currency, paid at the moment of merging; short of it the two pieces simply
// don't combine (mergeResultType in js/actions.js and js/engine.js). The Paladin's lance ends games,
// so it costs the most.
const ELIXIR_COST={paladin:3,mage:2,guardian:1,siege:1};
// what a spring pays for each turn it is held: a half, so a Paladin's 3 is six turns of holding one
// (three with both). Halves add up exactly in floating point, so no count ever drifts. (engine.js too)
const ELIXIR_RATE=.5;
function elixirCost(type){return ELIXIR_COST[type]||0;}
function elixirTag(type){return elixirCost(type)?' ('+elixirCost(type)+' Elixir)':'';}   // for a button or a log line
const FORTIFIED_MEND=5;   // and its armour mends 1 HP five turns after the last hit it took
// Delayed orders: an order given now happens a few turns from now, and giving one does not use up the
// turn — it spends part of an order budget instead, so several can be lined up to land together. A
// pawn's order takes half the budget, so two of them go out in one turn. ('order' in js/engine.js)
const MAX_DELAY=3, ORDER_BUDGET=1;
const ORDER_COST={pawn:.5};          // every other piece spends a whole turn's worth of orders
const ORDER_MIN=ORDER_COST.pawn;     // with less than this left the turn is spent and passes on its own
function orderCost(type){return ORDER_COST[type]||1;}
// how far ahead an order may be set: a pawn (fortified or not), whose order is half a turn, up to
// MAX_DELAY; every other piece one turn, no more (maxDelay in js/engine.js, delayCeiling in js/actions.js)
function maxDelay(type){return type==='pawn'?MAX_DELAY:1;}
let orderLeft={w:ORDER_BUDGET,b:ORDER_BUDGET};
let orderTurns=0;                    // how far ahead the next order is set: the Delay button counts it up, and every turn starts at none
// Whose eyes the board is drawn through. Normally your own side, which is also the side to move; in the
// training ground, where both sides are yours, it is the side the AI has *not* taken — so the fog stays
// over your own front while the AI thinks, instead of lifting for it.
function viewColor(){
  if(trainingMode&&typeof trainView!=='undefined'&&(trainView==='w'||trainView==='b'))return trainView;
  if(trainingMode&&typeof trainAI!=='undefined'&&trainAI&&trainAI.w!==trainAI.b)return trainAI.w?'b':'w';
  return myColor();
}

// the piece in hand: the one selected piece, or the King while it is open on its Spawn / Move chooser
function pieceInHand(){
  let i=selectedPieces.size===1?[...selectedPieces][0]:-1;
  if(i<0&&typeof kingSelected!=='undefined'&&kingSelected)i=pieces.findIndex(q=>q&&q.color===myColor()&&q.type==='king');
  return i>=0&&pieces[i]&&pieces[i].color===myColor()?i:-1;
}
// The Paladin's lance always finishes the kill and leaps to the square it clears, the Guardian's shot
// hits everything in its path, and the Mage's fire and meteor are cast, not reserved — none of the
// three fits a square set aside a turn ahead, so none of them ever takes a delayed order. Nor does the
// King, who is moved by hand or not at all.
const NO_ORDER_TYPES=new Set(['paladin','guardian','mage','king']);
function canOrder(i){
  const p=pieces[i];
  return !!p&&!NO_ORDER_TYPES.has(p.type)&&p.color===myColor()&&orderLeft[p.color]>=orderCost(p.type)&&orderTargets(i).size>0;
}
// the mines (or springs) a side holds: only a plain pawn works one, a fortified pawn can't (heldTiles in engine.js)
function heldTiles(color,tile){ const out=[]; pieces.forEach((p,i)=>{if(p&&p.color===color&&p.type==='pawn'&&!p.fortified&&tileData[i]===tile)out.push(i);}); return out; }
function minesHeld(color){ return heldTiles(color,'mine').length; }
function springsHeld(color){ return heldTiles(color,'spring').length; }
// Gold income this turn: a sixth, and a sixth more for every mine a pawn of that side holds
function goldRate(color){ return (1+minesHeld(color))/GOLD_TURNS; }
// The end of a side's turn pays its tiles: a mine-turn for each mine held, ELIXIR_RATE for each spring
// (finishTurn in engine.js). Returns the springs that paid, so the turn can sound them.
function creditResources(color){ mineTurns[color]+=minesHeld(color); const sp=heldTiles(color,'spring'); elixir[color]+=sp.length*ELIXIR_RATE; return sp; }
function goldAllowed(){ return !campaignLevel||campaignLevel.allowSpawn!==false; }
function canFortify(i){ const p=pieces[i]; return !!p&&p.type==='pawn'&&!p.fortified&&goldAllowed()&&spawnRemaining()>=1; }
function oppColor(){ return myColor()==='w'?'b':'w'; }
// The clock a side's Gold grows on is its own turns. This seat takes one side's turns in a game (so
// whiteTurnCount is that side's count, whichever colour it is playing), but the training ground plays
// both from here, and there each colour keeps its own count.
function turnsOf(color){ return trainingMode?(color==='w'?whiteTurnCount:blackTurnCount):whiteTurnCount; }
function spawnQuota(){ if(campaignLevel&&campaignLevel.spawnLimit)return campaignLevel.spawnLimit; return GOLD_START+(turnsOf(myColor())+mineTurns[myColor()])/GOLD_TURNS; }
// Which side's ledger a spawn is written in. A game has one side at this seat, so it is always the
// white one; the training ground plays both, and Black's pawns must come out of Black's own Gold —
// otherwise one king's spawning would leave the other with nothing to spend.
function spawnLedger(){ return trainingMode&&myColor()==='b'?blackSpawnHistory:spawnHistory; }
function spawnUsed(){ return spawnLedger().length+goldSpent[myColor()]; }
// a sixth of Gold a turn means the count is often a fraction; whole numbers stay plain
function goldText(n){ return n>=TRAIN_RICH?'\u221E':Number.isInteger(n)?String(n):n.toFixed(2); }
const TRAIN_RICH=900;   // the training ground's bottomless purse: anything this deep is drawn as \u221E
function spawnRemaining(){
  // tutorial: exactly 1 pawn allowed on the board at a time
  if(typeof isTutorialActive==='function'&&isTutorialActive()){
    const hasPawn=pieces.some(p=>p&&p.color==='w'&&p.type==='pawn');
    return hasPawn?0:1;
  }
  return Math.max(0,spawnQuota()-spawnUsed());
}
function blackSpawnQuota(){ return GOLD_START+(blackTurnCount+mineTurns[oppColor()])/GOLD_TURNS; }
function blackSpawnUsed(){ return blackSpawnHistory.length+goldSpent[oppColor()]; }
function blackSpawnRemaining(){ return Math.max(0,blackSpawnQuota()-blackSpawnUsed()); }
let whiteTargets={};  // pieceIdx -> targetIdx (enemy for attackers, friendly for bishops)
let blackTargets={};
let blackLastFrom=-1,blackLastTo=-1;
let dragSrc=-1,dragDests=null,dragging=false,mouseDownI=-1,mouseDownX=0,mouseDownY=0;
let sqPx=40;
let gameMode='single',difficulty='easy';
let trainingMode=false;   // the training ground: both sides in one seat, and a palette to build the board (js/training.js)
let trainMouse='edit';    // in the training ground the mouse either builds the board or plays the game
function trainEditing(){return trainingMode&&trainMouse==='edit';}
// Past 2x the training ground plays its moves without animations or voices, as an AI vs AI match does:
// at that speed a turn is over before its animation is, and the two tread on each other.
function fastPlay(){return trainingMode&&typeof trainSpeed!=='undefined'&&trainSpeed>=4;}
let mapTheme='forest'; // 'forest'|'jungle'|'desert'|'ocean'
let tileData=[]; // per-sq tile type string
let animals=[]; // array of {emoji,hp,maxHp,name,aggressive,fractDmg,x,y,tx,ty,speed}
let titleTileData=null; // saved title-screen map for single-player reuse
let titleAnimals=null;
let animalAnimId=null; // requestAnimationFrame id
let animalLastTime=0;
let targetMode=false; // manual target-setting mode for white
let targetSrc=-1;     // which piece is being targeted
let neutralPieces={};

let blackHitBy=[]; // [{target:blackIdx, attacker:whiteIdx}] — tracks which black pieces were hit this turn
let blackActed=new Set(); // indices of black pieces that auto-attacked this turn (cannot also move)

// ── VIEWPORT (zoom + pan) ────────────────────────────────────────────────────
// The whole board is always drawn, inside a frame that shows as much of it as fits. boardZoom is
// continuous: 1 fits the board in the frame, above that the board is larger than the frame and
// boardPanX/Y say, in pixels, how far it is slid under it (0 or negative). Pinch, the mouse wheel
// and the zoom buttons set the zoom; dragging the board, the arrows and the minimap set the pan.
let boardZoom=1, boardPanX=0, boardPanY=0;
let boardFitPx=40;        // the square size that fits the whole board in the frame (set by resizeBoard)
const BOARD_ZOOM_MAX=4;

// scrying: [{tiles, turns, color}] — a bishop's 3x3 stays lit for that side's next SCRY_TURNS turns
let scans=[];
// the scans of the side whose turn is starting burn down by one
function tickScans(color){
  scans=scans.filter(sc=>sc.color!==color||--sc.turns>0);
}
function scryLit(i,color){return scans.some(sc=>sc.color===color&&sc.tiles.includes(i));}

// the Mage's meteor: [{tiles: the 2x2 it was aimed at, turns, color}] — cast for METEOR_MANA, it
// strikes METEOR_TURNS of the caster's own turns later, for METEOR_DAMAGE to everything standing in
// the 2x2 when it lands, friend or foe alike (runMeteors in js/game.js does the actual striking;
// tickMeteors here only counts the turns down, the way tickScans counts a scry's own down)
const METEOR_MANA=2, METEOR_TURNS=2, METEOR_DAMAGE=2;
const METEOR_REACH=3;   // every square a meteor lands on is at most this far from its Mage (meteorReach)
let meteors=[];
function tickMeteors(color){
  const due=meteors.filter(m=>m.color===color&&--m.turns<=0);
  meteors=meteors.filter(m=>m.turns>0);
  return due;
}
// the 2x2 whose top-left corner is `anchor`
function meteorBox(anchor){
  const r=ROW(anchor),c=COL(anchor);
  return[idx(r,c),idx(r,c+1),idx(r+1,c),idx(r+1,c+1)];
}
// A meteor is aimed at the corner four squares share, and lands on those four. The corner has to be
// within 2 squares of the Mage, so all four squares are within METEOR_REACH (3) of it: the 2x2 has to
// lie inside the 7x7 around the Mage (meteorArea, lit while aiming), the same distance out every way.
// Sight doesn't come into it. `anchor` is the 2x2's top-left square. (meteorAnchorFromPoint in
// js/drag.js; meteorReach and meteorArea in js/engine.js mirror these.)
function meteorArea(from){
  const out=new Set();
  for(let i=0;i<ROWS*COLS;i++)if(cheb(i,from)<=METEOR_REACH)out.add(i);
  return out;
}
function meteorReach(from,anchor){
  if(from<0||anchor<0||ROW(anchor)>ROWS-2||COL(anchor)>COLS-2)return false;
  return meteorBox(anchor).every(j=>cheb(j,from)<=METEOR_REACH);
}
// a pending meteor is drawn for both sides, never hidden by fog — it is the warning that it is coming

// squares a Mage's fire trajectory burned, or a meteor's strike, are left smouldering for one of the
// caster's own turns afterward: [{tiles, turns, color}], drawn for both sides like the meteor's own
// warning, purely cosmetic (flareLit, tickFlares mirrors tickScans/tickMeteors)
let flareTiles=[];
function tickFlares(color){
  flareTiles=flareTiles.filter(f=>!(f.color===color&&--f.turns<=0));
}
function flareLit(i){
  return flareTiles.some(f=>f.tiles.includes(i));
}

// ── FOG OF WAR ───────────────────────────────────────────────────────────────
let mapCheat=false; // when false, only tiles within 2 of any white piece are currently visible
let exploredTiles=new Set(); // tiles that have ever been visible (fogged but partially shown)

// returns the visibility state of tile i:
//   'visible'    — within 2 of a friendly piece right now (full view)
//   'explored'   — has been visible before but no friendly piece is near it now (light fog)
//   'unknown'    — never seen (dense fog, hides terrain)
function tileVisibility(i){
  if(mapCheat)return 'visible';
  const mc=(typeof viewColor==='function')?viewColor():'w';
  if(scryLit(i,mc))return 'visible'; // a bishop is looking at it
  for(let j=0;j<ROWS*COLS;j++){
    const p=pieces[j];
    if(!p||p.color!==mc)continue;
    if(cheb(i,j)<=(p.type==='guardian'?3:2))return 'visible';   // the Guardian keeps a farther watch
    if(p.type==='mage'&&mageRange(j).includes(i))return 'visible';   // its own fire lights the line
  }
  return exploredTiles.has(i)?'explored':'unknown';
}

function isTileVisible(i){
  return tileVisibility(i)==='visible';
}

// called each render: mark currently-visible tiles as explored
function updateExploredTiles(){
  if(mapCheat)return;
  const mc=(typeof viewColor==='function')?viewColor():'w';
  for(let i=0;i<ROWS*COLS;i++){
    for(let j=0;j<ROWS*COLS;j++){
      const p=pieces[j];
      if(p&&p.color===mc&&cheb(i,j)<=2){exploredTiles.add(i);break;}
    }
  }
}
function resetView(){boardZoom=1;boardPanX=0;boardPanY=0;}
function boardFrameW(){return boardFitPx*COLS;}
function boardFrameH(){return boardFitPx*ROWS;}
// keep the board over its frame: centred while it fits, otherwise no further than its edges
function clampPan(zoom,panX,panY){
  const bw=boardFitPx*zoom*COLS,bh=boardFitPx*zoom*ROWS,fw=boardFrameW(),fh=boardFrameH();
  return[bw<=fw+.5?(fw-bw)/2:Math.max(fw-bw,Math.min(0,panX)),
         bh<=fh+.5?(fh-bh)/2:Math.max(fh-bh,Math.min(0,panY))];
}
function clampViewport(){[boardPanX,boardPanY]=clampPan(boardZoom,boardPanX,boardPanY);}
// the part of the board on screen, in squares
function viewRect(){
  const s=Math.max(1,sqPx);
  return{c0:-boardPanX/s,r0:-boardPanY/s,cols:boardFrameW()/s,rows:boardFrameH()/s};
}
function canPanN(){return boardPanY<-.5;}
function canPanS(){return boardPanY>boardFrameH()-sqPx*ROWS+.5;}
function canPanW(){return boardPanX<-.5;}
function canPanE(){return boardPanX>boardFrameW()-sqPx*COLS+.5;}

// ── CAMPAIGN STATE ───────────────────────────────────────────────────────────
let campaignLevel=null; // current level config object, or null for normal game
let campaignLevelId=-1; // current level index
// what this run of a level is scored on: the first star is the win, the second is beating par,
// the third is the level's own challenge (see CHALLENGES in campaign.js)
let campaignLost=0;        // pieces of yours that died this level
let campaignKingHit=false; // your King took a hit
let campaignDefeat='';     // why the level was lost, shown on the defeat card

// ── PVP STATE ────────────────────────────────────────────────────────────────
let peer=null,conn=null,pvpRole=null,pvpActive=false,myPeerId=null;
let bc=null,bcRoomName=null,collectingRooms=false;

// ── AI STATE ─────────────────────────────────────────────────────────────────
const STRATEGIES=['pawn_troops','knight_attack','pawn_knight','bishop_pawn','rook_pawn'];
let aiStrategy='pawn_troops';
let lastPf=12;

// ── PIECE CARD DATA ──────────────────────────────────────────────────────────
const PC_DATA=[
  {gw:'♙',gb:'♟',name:'Pawn',   stats:'1HP · any dir · atk adj · mines'},
  {gw:'♙',gb:'♟',name:'Fortified',stats:'3HP · mends 1HP/5 turns · 1 Gold'},
  {gw:'♘',gb:'♞',name:'Knight', stats:'4HP · L-jump · atk L-dist'},
  {gw:'♘',gb:'♞',name:'Paladin',stats:'3HP · L-jump · lance always kills, then leaps in'},
  {gw:'♗',gb:'♝',name:'Bishop', stats:'2HP · diagonal 2 · heals (mana)'},
  {gw:'♖',gb:'♜',name:'Rook',   stats:'4HP · card2 · pierce rng3 · Fortified + Pawn'},
  {gw:'♖',gb:'♜',name:'Guardian',stats:'5HP · card2 · rook+knight range, hits the line'},
  {gw:'♛',gb:'♛',name:'Queen',  stats:'5HP · all dir rng2'},
  {gw:'♗',gb:'♝',name:'Mage',   stats:'3HP · diag 2 · fire line, atk rng3 · meteor (mana)'},
  {gw:'♔',gb:'♚',name:'King',   stats:'5HP · spawns pawns'},
];
let pcPageIdx=0;
const PC_PER_PAGE=3;
