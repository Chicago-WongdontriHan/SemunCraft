// ── CAMPAIGN MODE ─────────────────────────────────────────────────────────────

const CAMPAIGN_LEVELS=[
  // ── LEVEL 1: Pawn School (5x5) ──────────────────────────────────────────────
  {
    id:0, name:'Pawn School', desc:'Surround and destroy the enemy rook with your pawns.',
    cols:5, rows:5, theme:'forest',
    allowSpawn:false, turnLimit:12,
    winType:'destroy_all',
    obstacles:[[2,2]],
    white:[{type:'pawn',r:4,c:0},{type:'pawn',r:4,c:2},{type:'pawn',r:4,c:4}],
    black:[{type:'rook',r:0,c:2}],
  },
  // ── LEVEL 2: Narrow Pass (3x7) ─────────────────────────────────────────────
  {
    id:1, name:'Narrow Pass', desc:'Push through the corridor and destroy all enemies.',
    cols:3, rows:7, theme:'forest',
    allowSpawn:false, turnLimit:15,
    winType:'destroy_all',
    obstacles:[[3,0],[3,2]],
    white:[{type:'pawn',r:6,c:0},{type:'pawn',r:6,c:2},{type:'knight',r:6,c:1}],
    black:[{type:'rook',r:0,c:1},{type:'pawn',r:1,c:0},{type:'pawn',r:1,c:2}],
  },
  // ── LEVEL 3: Clash in the Dunes (8x8) ───────────────────────────────────────────
  {
    id:2, name:'Clash in the Dunes', desc:'A desert battle! Two full armies line up as in chess on an open field. Destroy the enemy king to win — but protect yours! No merging allowed.',
    cols:8, rows:8, theme:'desert',
    allowSpawn:false, noMerge:true, turnLimit:40,
    winType:'destroy_king',
    obstacles:[],
    // the chess setup: rook, knight, bishop, queen, king, bishop, knight, rook on the back rank
    // (queen on the d-file, king on the e-file) and eight pawns in front
    white:[
      {type:'rook',r:7,c:0},{type:'knight',r:7,c:1},{type:'bishop',r:7,c:2},{type:'queen',r:7,c:3},{type:'king',r:7,c:4},{type:'bishop',r:7,c:5},{type:'knight',r:7,c:6},{type:'rook',r:7,c:7},
      {type:'pawn',r:6,c:0},{type:'pawn',r:6,c:1},{type:'pawn',r:6,c:2},{type:'pawn',r:6,c:3},{type:'pawn',r:6,c:4},{type:'pawn',r:6,c:5},{type:'pawn',r:6,c:6},{type:'pawn',r:6,c:7},
    ],
    black:[
      {type:'rook',r:0,c:0},{type:'knight',r:0,c:1},{type:'bishop',r:0,c:2},{type:'queen',r:0,c:3},{type:'king',r:0,c:4},{type:'bishop',r:0,c:5},{type:'knight',r:0,c:6},{type:'rook',r:0,c:7},
      {type:'pawn',r:1,c:0},{type:'pawn',r:1,c:1},{type:'pawn',r:1,c:2},{type:'pawn',r:1,c:3},{type:'pawn',r:1,c:4},{type:'pawn',r:1,c:5},{type:'pawn',r:1,c:6},{type:'pawn',r:1,c:7},
    ],
  },
  // ── LEVEL 4: Desert Crossing (9x5) ─────────────────────────────────────────
  {
    id:3, name:'Desert Crossing', desc:'Cross the desert and wipe out the enemy forces.',
    cols:9, rows:5, theme:'desert',
    allowSpawn:false, turnLimit:20,
    winType:'destroy_all',
    obstacles:[[2,1],[2,3],[2,5],[2,7]],
    white:[{type:'pawn',r:4,c:0},{type:'pawn',r:4,c:1},{type:'pawn',r:3,c:0},{type:'knight',r:4,c:2}],
    black:[{type:'rook',r:0,c:4},{type:'pawn',r:1,c:7},{type:'pawn',r:1,c:8},{type:'pawn',r:0,c:8}],
  },
  // ── LEVEL 5: Island Siege (5x9) ────────────────────────────────────────────
  {
    id:4, name:'Island Siege', desc:'Use your rooks to pierce through the enemy defenses.',
    cols:5, rows:9, theme:'ocean',
    allowSpawn:false, turnLimit:18,
    winType:'destroy_all',
    obstacles:[[3,1],[3,3],[5,1],[5,3]],
    white:[{type:'rook',r:8,c:1},{type:'rook',r:8,c:3}],
    black:[{type:'knight',r:0,c:2},{type:'knight',r:1,c:1},{type:'knight',r:1,c:3},{type:'pawn',r:2,c:0},{type:'pawn',r:2,c:2},{type:'pawn',r:2,c:4}],
  },
  // ── LEVEL 6: The Maze (9x9) ────────────────────────────────────────────────
  {
    id:5, name:'The Maze', desc:'Navigate the maze with your queen. Destroy all enemies.',
    cols:9, rows:9, theme:'forest',
    allowSpawn:false, turnLimit:20,
    winType:'destroy_all',
    obstacles:[[1,2],[1,6],[2,4],[3,1],[3,3],[3,5],[3,7],[5,1],[5,3],[5,5],[5,7],[6,4],[7,2],[7,6]],
    white:[{type:'queen',r:8,c:4},{type:'pawn',r:7,c:3},{type:'pawn',r:7,c:5}],
    black:[{type:'bishop',r:0,c:4},{type:'bishop',r:1,c:3},{type:'knight',r:2,c:5},{type:'pawn',r:2,c:3},{type:'pawn',r:3,c:4},{type:'pawn',r:4,c:2}],
  },
  // ── LEVEL 7: Twin Forts (11x7) ─────────────────────────────────────────────
  {
    id:6, name:'Twin Forts', desc:'Destroy all enemy pieces behind their fortifications.',
    cols:11, rows:7, theme:'desert',
    allowSpawn:false, turnLimit:30,
    winType:'destroy_all',
    obstacles:[[2,3],[2,4],[2,6],[2,7],[4,3],[4,4],[4,6],[4,7]],
    white:[{type:'pawn',r:6,c:0},{type:'pawn',r:6,c:1},{type:'pawn',r:5,c:0},{type:'pawn',r:5,c:1},{type:'knight',r:6,c:2},{type:'rook',r:6,c:3}],
    black:[{type:'rook',r:0,c:9},{type:'pawn',r:1,c:8},{type:'pawn',r:1,c:9},{type:'pawn',r:1,c:10},{type:'pawn',r:0,c:8}],
  },
  // ── LEVEL 8: Canyon Battle (5x11) ──────────────────────────────────────────
  {
    id:7, name:'Canyon Battle', desc:'Fight through the vertical canyon. Destroy all enemies.',
    cols:5, rows:11, theme:'ocean',
    allowSpawn:false, turnLimit:22,
    winType:'destroy_all',
    obstacles:[[3,0],[3,4],[5,1],[5,3],[7,0],[7,4]],
    white:[{type:'rook',r:10,c:2},{type:'bishop',r:9,c:1},{type:'pawn',r:10,c:1},{type:'pawn',r:10,c:3}],
    black:[{type:'queen',r:0,c:2},{type:'queen',r:1,c:2},{type:'pawn',r:2,c:1},{type:'pawn',r:2,c:3}],
  },
  // ── LEVEL 9: Open War (9x9) ────────────────────────────────────────────────
  {
    id:8, name:'Open War', desc:'Full-scale battle in the fog. Scout the terrain and destroy all enemy pieces.',
    cols:9, rows:9, theme:'forest',
    allowSpawn:false, turnLimit:35,
    mapCheatDefault:false,
    winType:'destroy_all',
    obstacles:[[3,2],[3,6],[5,2],[5,6]],
    white:[{type:'pawn',r:8,c:2},{type:'pawn',r:8,c:3},{type:'pawn',r:8,c:4},{type:'pawn',r:8,c:5},{type:'pawn',r:8,c:6},{type:'knight',r:7,c:4},{type:'rook',r:8,c:0}],
    black:[{type:'rook',r:0,c:0},{type:'knight',r:1,c:3},{type:'bishop',r:0,c:4},{type:'pawn',r:1,c:4},{type:'pawn',r:1,c:5},{type:'pawn',r:1,c:6},{type:'pawn',r:2,c:4}],
  },
  // ── LEVEL 10: Last Stand (11x11) ───────────────────────────────────────────
  {
    id:9, name:'Last Stand', desc:'Storm the fortress and destroy all enemies inside.',
    cols:11, rows:11, theme:'desert',
    allowSpawn:false, turnLimit:40,
    winType:'destroy_all',
    // fortress walls around enemies
    obstacles:[[1,3],[1,4],[1,5],[1,6],[1,7],[2,3],[2,7],[3,3],[3,7],[4,3],[4,4],[4,6],[4,7]],
    white:[{type:'pawn',r:10,c:4},{type:'pawn',r:10,c:5},{type:'pawn',r:10,c:6},{type:'knight',r:9,c:5},{type:'rook',r:10,c:3},{type:'bishop',r:9,c:4}],
    black:[{type:'queen',r:2,c:5},{type:'queen',r:3,c:5},{type:'rook',r:2,c:4},{type:'bishop',r:3,c:4},{type:'pawn',r:4,c:5},{type:'pawn',r:3,c:6},{type:'pawn',r:5,c:3},{type:'pawn',r:5,c:7}],
  },
];

// ── CAMPAIGN PROGRESS (localStorage) ─────────────────────────────────────────
function loadCampaignProgress(){
  try{const s=localStorage.getItem('semuncraft_campaign');return s?JSON.parse(s):[];}
  catch(e){return[];}
}
function saveCampaignProgress(progress){
  try{localStorage.setItem('semuncraft_campaign',JSON.stringify(progress));}catch(e){}
}

// ── LEVEL SELECT UI ──────────────────────────────────────────────────────────
function showCampaignSelect(){
  const overlay=document.getElementById('campaign-select');
  if(!overlay)return;
  const progress=loadCampaignProgress();
  const list=document.getElementById('campaign-level-list');
  list.innerHTML='';
  CAMPAIGN_LEVELS.forEach((lv,i)=>{
    const unlocked=i===0||progress[i-1]; // level 0 always unlocked, others need previous completed
    const stars=progress[i]||0;
    const btn=document.createElement('div');
    btn.className='campaign-level-btn'+(unlocked?'':' locked');
    btn.innerHTML='<div class="clb-num">'+(i+1)+'</div>'
      +'<div class="clb-info"><div class="clb-name">'+lv.name+'</div>'
      +'<div class="clb-size">'+lv.cols+'x'+lv.rows+' · '+lv.theme+'</div>'
      +'<div class="clb-stars">'+(stars>=2?'★':'☆')+(stars>=3?'★':'☆')+'</div></div>';
    if(unlocked)btn.onclick=()=>{ hideCampaignSelect(); startCampaignLevel(i); };
    list.appendChild(btn);
  });
  overlay.classList.add('show');
}

function hideCampaignSelect(){
  const overlay=document.getElementById('campaign-select');
  if(overlay)overlay.classList.remove('show');
}

// ── START CAMPAIGN LEVEL ─────────────────────────────────────────────────────
function startCampaignLevel(levelIdx){
  const lv=CAMPAIGN_LEVELS[levelIdx];
  if(!lv)return;
  campaignLevel=lv;
  campaignLevelId=levelIdx;
  // set dynamic board size
  COLS=lv.cols;
  ROWS=lv.rows;
  // set theme
  mapTheme=lv.theme;
  document.body.className='theme-'+lv.theme;
  // hide intro
  document.getElementById('intro').classList.add('hidden');
  hideCampaignSelect();
  // init game state
  gameMode='campaign';
  difficulty='campaign';
  pieces=new Array(ROWS*COLS).fill(null);
  tileData=new Array(ROWS*COLS).fill('');
  // place obstacles
  const obsType=themeObstacle(lv.theme);
  (lv.obstacles||[]).forEach(([r,c])=>{
    if(inB(r,c))tileData[idx(r,c)]=obsType;
  });
  // place white pieces
  (lv.white||[]).forEach(pd=>{
    const i=idx(pd.r,pd.c);
    const st=STATS[pd.type];
    pieces[i]={type:pd.type,color:'w',hp:st.hp,maxHp:st.maxHp};
    if(pd.type==='bishop')pieces[i].mana=2;
    if(pd.type==='pawn')pieces[i].firstMove=true;
  });
  // place black pieces
  (lv.black||[]).forEach(pd=>{
    const i=idx(pd.r,pd.c);
    const st=STATS[pd.type];
    pieces[i]={type:pd.type,color:'b',hp:st.hp,maxHp:st.maxHp};
    if(pd.type==='bishop')pieces[i].mana=2;
    if(pd.type==='pawn')pieces[i].firstMove=true;
  });
  // reset game variables
  turn='w'; over=false; thinking=false; logLines=[]; kingSelected=false;
  whiteTargets={}; blackTargets={};
  spawnHistory=[]; blackSpawnHistory=[];
  whiteTurnCount=0; blackTurnCount=0; movedThisTurn=-1;
  blackLastFrom=-1; blackLastTo=-1;
  targetMode=false; targetSrc=-1;
  dragSrc=-1; dragging=false;
  animals=[]; neutralPieces={};
  animalDivs.forEach(el=>el.remove());animalDivs.clear();
  stopAnimalLoop();
  blackHitBy=[];
  exploredTiles=new Set();
  // campaign map cheat: default ON unless the level explicitly opts out
  mapCheat=(lv.mapCheatDefault===false)?false:true;
  const mcBtn=document.getElementById('btn-mapcheat');
  if(mcBtn)mcBtn.textContent='🗺 Map Cheat: '+(mapCheat?'ON':'OFF');
  selectedPieces=new Set();
  // reset viewport to show entire campaign board
  resetView();
  const tc=document.getElementById('turn-counter');if(tc)tc.textContent='Turn 0';
  document.getElementById('ghost').style.display='none';
  document.getElementById('thinking-dot').classList.remove('on');
  document.getElementById('log').textContent='';
  // campaign spawn limit override
  if(lv.allowSpawn&&lv.spawnLimit){
    // override spawnQuota to return fixed limit
  }
  if(!bgmPaused&&!bgmPlaying) startBgm();
  syncUI(); render(); resizeBoard(); render();
  showMoveHint();
  setStatus(lv.name+' — '+lv.desc);
}

// ── CAMPAIGN WIN/LOSE CHECK ──────────────────────────────────────────────────
function checkCampaignWin(){
  if(!campaignLevel)return null;
  const lv=campaignLevel;
  // if the level has kings, king death always determines win/lose
  const hasKing=pieces.some(p=>p&&p.type==='king');
  if(hasKing||lv.winType==='destroy_king'){
    const bKing=pieces.find(p=>p&&p.color==='b'&&p.type==='king');
    const wKing=pieces.find(p=>p&&p.color==='w'&&p.type==='king');
    if(!bKing)return 'win';
    if(!wKing)return 'lose';
  }
  // check win: destroy all enemy pieces
  if(lv.winType==='destroy_all'){
    const anyBlack=pieces.find(p=>p&&p.color==='b');
    if(!anyBlack)return 'win';
  }
  // check lose: all white pieces destroyed
  {
    const anyWhite=pieces.find(p=>p&&p.color==='w');
    if(!anyWhite)return 'lose';
  }
  return null; // game continues
}

function handleCampaignEnd(result){
  over=true;
  if(result==='win'){
    SFX.win();
    // calculate stars
    const stars=(campaignLevel.turnLimit&&whiteTurnCount<=campaignLevel.turnLimit)?3:2;
    const progress=loadCampaignProgress();
    const prev=progress[campaignLevelId]||0;
    progress[campaignLevelId]=Math.max(prev,stars);
    saveCampaignProgress(progress);
    // show campaign victory
    const el=document.getElementById('game-over');
    const title=document.getElementById('go-title');
    const sub=document.getElementById('go-sub');
    title.className='win';
    title.textContent='Victory!';
    const starStr=(stars>=2?'★':'☆')+(stars>=3?'★':'☆');
    sub.textContent=starStr+' — '+(stars>=3?'Perfect! Under '+campaignLevel.turnLimit+' turns':'Completed in '+whiteTurnCount+' turns');
    // update buttons for campaign
    const btns=document.getElementById('go-buttons');
    btns.innerHTML='';
    if(campaignLevelId<CAMPAIGN_LEVELS.length-1){
      const nextBtn=document.createElement('button');
      nextBtn.className='go-btn primary';
      nextBtn.textContent='Next Level →';
      nextBtn.onclick=()=>{hideGameOver();startCampaignLevel(campaignLevelId+1);};
      btns.appendChild(nextBtn);
    }
    const retryBtn=document.createElement('button');
    retryBtn.className='go-btn secondary';
    retryBtn.textContent='↺ Retry';
    retryBtn.onclick=()=>{hideGameOver();startCampaignLevel(campaignLevelId);};
    btns.appendChild(retryBtn);
    const menuBtn=document.createElement('button');
    menuBtn.className='go-btn secondary';
    menuBtn.textContent='↺ Menu';
    menuBtn.onclick=()=>{hideGameOver();campaignLevel=null;COLS=9;ROWS=9;goIntro();};
    btns.appendChild(menuBtn);
    el.classList.add('show');
  }else{
    SFX.lose();
    const el=document.getElementById('game-over');
    const title=document.getElementById('go-title');
    const sub=document.getElementById('go-sub');
    title.className='lose';
    title.textContent='Defeat';
    sub.textContent='Try again!';
    const btns=document.getElementById('go-buttons');
    btns.innerHTML='';
    const retryBtn=document.createElement('button');
    retryBtn.className='go-btn primary';
    retryBtn.textContent='↺ Retry';
    retryBtn.onclick=()=>{hideGameOver();startCampaignLevel(campaignLevelId);};
    btns.appendChild(retryBtn);
    const menuBtn=document.createElement('button');
    menuBtn.className='go-btn secondary';
    menuBtn.textContent='↺ Menu';
    menuBtn.onclick=()=>{hideGameOver();campaignLevel=null;COLS=9;ROWS=9;goIntro();};
    btns.appendChild(menuBtn);
    el.classList.add('show');
  }
}
