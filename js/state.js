// ── GAME STATE ───────────────────────────────────────────────────────────────
let pieces=new Array(ROWS*COLS).fill(null),turn='w',over=true,thinking=false,logLines=[],kingSelected=false;
let selectedPieces=new Set(); // indices of white pieces selected for group move
let whiteGroupSpeeds={}; // (unused)
let spawnHistory=[]; // how many total spawns used
let whiteTurnCount=0; // total white turns this game
let movedThisTurn=-1; // idx of white piece that acted this turn (cannot auto-attack)
function spawnQuota(){ return 8+Math.floor(whiteTurnCount/6); }
function spawnUsed(){ return spawnHistory.length; }
function spawnRemaining(){ return Math.max(0,spawnQuota()-spawnUsed()); }
let whiteTargets={};  // pieceIdx -> targetIdx (enemy for attackers, friendly for bishops)
let blackTargets={};
let blackLastFrom=-1,blackLastTo=-1;
let dragSrc=-1,dragDests=null,dragging=false,mouseDownI=-1,mouseDownX=0,mouseDownY=0;
let sqPx=40;
let gameMode='single',difficulty='easy';
let mapTheme='jungle'; // 'jungle'|'desert'|'ocean'
let tileData=[]; // per-sq tile type string
let animals=[]; // array of {emoji,hp,maxHp,name,aggressive,fractDmg,x,y,tx,ty,speed}
let titleTileData=null; // saved title-screen map for single-player reuse
let titleAnimals=null;
let animalAnimId=null; // requestAnimationFrame id
let animalLastTime=0;
let targetMode=false; // manual target-setting mode for white
let targetSrc=-1;     // which piece is being targeted
let neutralPieces={};

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
  {gw:'♗',gb:'♝',name:'Bishop', stats:'2HP · diag2/card1 · heals (mana)'},
  {gw:'♖',gb:'♜',name:'Rook',   stats:'4HP · card2 · pierce rng3'},
  {gw:'♛',gb:'♛',name:'Queen',  stats:'5HP · all dir rng2'},
  {gw:'♔',gb:'♚',name:'King',   stats:'5HP · spawns pawns'},
];
let pcPageIdx=0;
const PC_PER_PAGE=3;
