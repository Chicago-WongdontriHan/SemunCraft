// ── GAME STATE ───────────────────────────────────────────────────────────────
let pieces=new Array(ROWS*COLS).fill(null),turn='w',over=true,thinking=false,logLines=[],kingSelected=false;
let selectedPieces=new Set(); // indices of white pieces selected for group move
let whiteGroupSpeeds={}; // (unused)
let spawnHistory=[]; // how many total spawns used (white)
let blackSpawnHistory=[]; // how many total spawns used (black)
let whiteTurnCount=0; // total white turns this game
let blackTurnCount=0; // total black turns this game
let movedThisTurn=-1; // idx of white piece that acted this turn (cannot auto-attack)
// Coin: 8 to start, and one more every COIN_TURNS turns — earned a sixth at a time rather than in
// jumps. A pawn from the King costs one, so spawning waits until a whole Coin is in hand.
// The same sum is in js/engine.js, written the same way so both sides land on the same number.
const COIN_START=8, COIN_TURNS=6;
function spawnQuota(){ if(campaignLevel&&campaignLevel.spawnLimit)return campaignLevel.spawnLimit; return COIN_START+whiteTurnCount/COIN_TURNS; }
function spawnUsed(){ return spawnHistory.length; }
// a quarter Coin a turn means the count is often a fraction; whole numbers stay plain
function coinText(n){ return Number.isInteger(n)?String(n):n.toFixed(2); }
function spawnRemaining(){
  // tutorial: exactly 1 pawn allowed on the board at a time
  if(typeof isTutorialActive==='function'&&isTutorialActive()){
    const hasPawn=pieces.some(p=>p&&p.color==='w'&&p.type==='pawn');
    return hasPawn?0:1;
  }
  return Math.max(0,spawnQuota()-spawnUsed());
}
function blackSpawnQuota(){ return COIN_START+blackTurnCount/COIN_TURNS; }
function blackSpawnUsed(){ return blackSpawnHistory.length; }
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
let campaignLevelId=-1; // current level index (0-9)

// ── PVP STATE ────────────────────────────────────────────────────────────────
let peer=null,conn=null,pvpRole=null,pvpActive=false,myPeerId=null;
let bc=null,bcRoomName=null,collectingRooms=false;

// ── AI STATE ─────────────────────────────────────────────────────────────────
const STRATEGIES=['pawn_troops','knight_attack','pawn_knight','bishop_pawn','rook_pawn'];
let aiStrategy='pawn_troops';
let lastPf=12;

// ── PIECE CARD DATA ──────────────────────────────────────────────────────────
const PC_DATA=[
  {gw:'♙',gb:'♟',name:'Pawn',   stats:'1HP · move any dir · atk adj'},
  {gw:'♘',gb:'♞',name:'Knight', stats:'4HP · L-jump · atk L-dist'},
  {gw:'♗',gb:'♝',name:'Bishop', stats:'2HP · diagonal 2 · heals (mana)'},
  {gw:'♖',gb:'♜',name:'Rook',   stats:'4HP · card2 · pierce rng3'},
  {gw:'♛',gb:'♛',name:'Queen',  stats:'5HP · all dir rng2'},
  {gw:'♔',gb:'♚',name:'King',   stats:'5HP · spawns pawns'},
];
let pcPageIdx=0;
const PC_PER_PAGE=3;
