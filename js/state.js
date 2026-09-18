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
// The spring and the mine: a pawn on the gold mine earns just by standing there; a pawn on the Elixir
// spring can spend its whole turn extracting one Elixir, which is what makes banking it risky — the
// pawn stands still, in the open, while the other side moves. ('extract' in js/engine.js)
const RESOURCE_TILES={spring:'elixir',mine:'gold'};
let elixir={w:0,b:0};     // Elixir extracted at the spring
let mineTurns={w:0,b:0};  // turns that ended with a pawn of that side on the gold mine
let goldSpent={w:0,b:0};  // Gold spent on anything but spawning: fortified pawns
const FORTIFIED_HP=3;     // a fortified pawn is a pawn in a helmet, with three life
function canExtract(i){ const p=pieces[i]; return !!p&&p.type==='pawn'&&tileData[i]==='spring'; }
function pawnOnMine(color){ return pieces.some((p,i)=>p&&p.color===color&&p.type==='pawn'&&tileData[i]==='mine'); }
// Gold income this turn: a sixth, doubled while a pawn of that side stands on the mine
function goldRate(color){ return (pawnOnMine(color)?2:1)/GOLD_TURNS; }
function goldAllowed(){ return !campaignLevel||campaignLevel.allowSpawn!==false; }
function canFortify(i){ const p=pieces[i]; return !!p&&p.type==='pawn'&&!p.fortified&&goldAllowed()&&spawnRemaining()>=1; }
function oppColor(){ return myColor()==='w'?'b':'w'; }
function spawnQuota(){ if(campaignLevel&&campaignLevel.spawnLimit)return campaignLevel.spawnLimit; return GOLD_START+(whiteTurnCount+mineTurns[myColor()])/GOLD_TURNS; }
function spawnUsed(){ return spawnHistory.length+goldSpent[myColor()]; }
// a sixth of Gold a turn means the count is often a fraction; whole numbers stay plain
function goldText(n){ return Number.isInteger(n)?String(n):n.toFixed(2); }
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

// ── FOG OF WAR ───────────────────────────────────────────────────────────────
let mapCheat=false; // when false, only tiles within 2 of any white piece are currently visible
let exploredTiles=new Set(); // tiles that have ever been visible (fogged but partially shown)

// returns the visibility state of tile i:
//   'visible'    — within 2 of a friendly piece right now (full view)
//   'explored'   — has been visible before but no friendly piece is near it now (light fog)
//   'unknown'    — never seen (dense fog, hides terrain)
function tileVisibility(i){
  if(mapCheat)return 'visible';
  const mc=(typeof myColor==='function')?myColor():'w';
  if(scryLit(i,mc))return 'visible'; // a bishop is looking at it
  for(let j=0;j<ROWS*COLS;j++){
    const p=pieces[j];
    if(p&&p.color===mc&&cheb(i,j)<=2)return 'visible';
  }
  return exploredTiles.has(i)?'explored':'unknown';
}

function isTileVisible(i){
  return tileVisibility(i)==='visible';
}

// called each render: mark currently-visible tiles as explored
function updateExploredTiles(){
  if(mapCheat)return;
  const mc=(typeof myColor==='function')?myColor():'w';
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
  {gw:'♙',gb:'♟',name:'Fortified',stats:'3HP · a pawn in a helmet · 1 Gold'},
  {gw:'♘',gb:'♞',name:'Knight', stats:'4HP · L-jump · atk L-dist'},
  {gw:'♗',gb:'♝',name:'Bishop', stats:'2HP · diagonal 2 · heals (mana)'},
  {gw:'♖',gb:'♜',name:'Rook',   stats:'4HP · card2 · pierce rng3'},
  {gw:'♛',gb:'♛',name:'Queen',  stats:'5HP · all dir rng2'},
  {gw:'♔',gb:'♚',name:'King',   stats:'5HP · spawns pawns'},
];
let pcPageIdx=0;
const PC_PER_PAGE=3;
