// ── CAMPAIGN MODE ─────────────────────────────────────────────────────────────

const CAMPAIGN_LEVELS=[
  // ── ACT I · THE DEEPWOOD ────────────────────────────────────────────────────
  // The Coin is gone from the crown, so nothing can be minted: these levels are fought with
  // whatever is left standing, and merging is the only way to grow.
  {
    id:0, name:'The Last Three', desc:'Three pawns against a raider in the wood.',
    cols:5, rows:5, theme:'forest',
    allowSpawn:false, par:12, turnLimit:19,
    winType:'destroy_all', goal:'Destroy the raider', challenge:{type:'noLoss'},
    obstacles:[[2,2]],
    white:[{type:'pawn',r:4,c:0},{type:'pawn',r:4,c:2},{type:'pawn',r:4,c:4}],
    black:[{type:'rook',r:0,c:2}],
    story:{where:'The Deepwood, the morning after.',
      before:[['king','The crown is empty. Three of you left, and the wood is full of them.'],
              ['pip','Then we make more of us, sire. Somehow.']],
      win:[['pip','It ran! Did you see it? It ran.']],
      lose:[['mirror','A king with no Coin is just a carving.']]},
  },
  {
    id:1, name:'The Narrow Pass', desc:'Hold the corridor under Grey Ridge until the column is through.',
    cols:3, rows:7, theme:'forest',
    allowSpawn:false, par:10, turnLimit:14,
    winType:'survive', surviveTurns:10, goal:'Hold the pass for 10 turns', challenge:{type:'noLoss'},
    obstacles:[[3,0],[3,2]],
    white:[{type:'pawn',r:6,c:0},{type:'pawn',r:6,c:2},{type:'knight',r:6,c:1}],
    black:[{type:'rook',r:0,c:1},{type:'pawn',r:1,c:0},{type:'pawn',r:1,c:2}],
    story:{where:'The pass under Grey Ridge.',
      before:[['pip','The path is one piece wide, sire. They keep coming down it.'],
              ['king','Then they can only lose one at a time. Stand until the wagons are past.']],
      win:[['king','The column is through. We go east, to the sand.']],
      lose:[['mirror','You put children in a corridor. I would have too.']]},
  },
  {
    id:2, name:'The Maze', desc:'Get the Queen out of the thicket alive.',
    cols:9, rows:9, theme:'forest',
    allowSpawn:false, par:12, turnLimit:20,
    winType:'reach', reachType:'queen', squares:[[0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],[0,8]],
    goal:'Walk the Queen to the far edge', challenge:{type:'noLoss'},
    obstacles:[[1,2],[1,6],[2,4],[3,1],[3,3],[3,5],[3,7],[5,1],[5,3],[5,5],[5,7],[6,4],[7,2],[7,6]],
    white:[{type:'queen',r:8,c:4},{type:'pawn',r:7,c:3},{type:'pawn',r:7,c:5}],
    black:[{type:'bishop',r:0,c:4},{type:'bishop',r:1,c:3},{type:'knight',r:2,c:5},{type:'pawn',r:2,c:3},{type:'pawn',r:3,c:4},{type:'pawn',r:4,c:2}],
    story:{where:'The thorn maze behind the keep.',
      before:[['king','My sister knows the east road. Get her out and the line survives me.'],
              ['pip','And you, sire?'],],
      win:[['king','She is out. Whatever happens here, the line is out.']],
      lose:[['mirror','I wanted the Queen. You handed her to the thorns.']]},
  },
  {
    id:3, name:'Open War', desc:'The keep is lost. Break their vanguard in the fog before it reaches the road.',
    cols:9, rows:9, theme:'forest',
    allowSpawn:false, par:20, turnLimit:32, mapCheatDefault:false,
    winType:'destroy_all', goal:'Destroy every enemy piece', challenge:{type:'underTurns',n:14},
    obstacles:[[3,2],[3,6],[5,2],[5,6]],
    white:[{type:'pawn',r:8,c:2},{type:'pawn',r:8,c:3},{type:'pawn',r:8,c:4},{type:'pawn',r:8,c:5},{type:'pawn',r:8,c:6},{type:'knight',r:7,c:4},{type:'rook',r:8,c:0}],
    black:[{type:'rook',r:0,c:0},{type:'knight',r:1,c:3},{type:'bishop',r:0,c:4},{type:'pawn',r:1,c:4},{type:'pawn',r:1,c:5},{type:'pawn',r:1,c:6},{type:'pawn',r:2,c:4}],
    story:{where:'Ash and fog, where the keep used to be.',
      before:[['pip','I can\'t see ten paces, sire.'],
              ['king','Neither can they. Walk until something moves, then hit it.']],
      win:[['king','That was their vanguard. The rest are already ahead of us, on the sand.']],
      lose:[['mirror','Fog is honest. It shows a king exactly what he has left.']]},
  },
  // ── ACT II · THE SAND AND THE MINT ──────────────────────────────────────────
  // The Coin was struck under the dunes. Taking the Mint back is what puts pawns in the King's
  // hand again: from The Mint on, spawning is allowed.
  {
    id:4, name:'Desert Crossing', desc:'Cut a way through to the gate of the old Mint.',
    cols:9, rows:5, theme:'desert',
    allowSpawn:false, par:14, turnLimit:24,
    winType:'reach', squares:[[0,8],[1,8],[2,8],[3,8],[4,8]],
    goal:'Reach the gate on the far side', challenge:{type:'noLoss'},
    obstacles:[[2,1],[2,3],[2,5],[2,7]],
    white:[{type:'pawn',r:4,c:0},{type:'pawn',r:4,c:1},{type:'pawn',r:3,c:0},{type:'knight',r:4,c:2}],
    black:[{type:'rook',r:0,c:4},{type:'pawn',r:1,c:7},{type:'pawn',r:1,c:8},{type:'pawn',r:0,c:8}],
    story:{where:'The long flats, three days without water.',
      before:[['wren','The Mint lies under the last dune. Its gate is on the far side of this crossing.'],
              ['king','Then we cross it. Anyone still standing at the gate has done enough.']],
      win:[['wren','The gate. Older than both our courts, and they left it standing.']],
      lose:[['mirror','The sand keeps better records than your scribes.']]},
  },
  {
    id:5, name:'The Mint', desc:'Stand on the Mint floor while the presses wake. Coin returns: the King can spawn again.',
    cols:9, rows:9, theme:'desert',
    allowSpawn:true, par:10, turnLimit:14,
    winType:'hold', surviveTurns:10, squares:[[4,4]],
    goal:'Hold the Mint floor for 10 turns', challenge:{type:'noLoss'},
    obstacles:[[3,3],[3,5],[5,3],[5,5],[0,0],[0,8],[8,0],[8,8]],
    white:[{type:'king',r:7,c:4},{type:'pawn',r:7,c:3},{type:'pawn',r:7,c:5},{type:'knight',r:6,c:4}],
    black:[{type:'rook',r:0,c:4},{type:'knight',r:0,c:2},{type:'knight',r:0,c:6},{type:'pawn',r:1,c:3},{type:'pawn',r:1,c:5},{type:'pawn',r:2,c:4}],
    story:{where:'Under the last dune, on the Mint floor.',
      before:[['wren','Stand a king on the floor and the presses remember him. Ten turns should do it.'],
              ['king','Ten turns with that lot on the stairs. Pip, stay close.']],
      win:[['pip','Sire — there are more of me. Where did they come from?'],
           ['king','The Coin. Spend it well.']],
      lose:[['mirror','The presses only wake for a king who can hold a floor.']]},
  },
  {
    id:6, name:'Clash in the Dunes', desc:'Two full courts, cut from the same block, on open sand. No merging.',
    cols:8, rows:8, theme:'desert',
    allowSpawn:false, noMerge:true, par:40, turnLimit:64,
    winType:'destroy_king', goal:'Destroy the enemy King', challenge:{type:'underTurns',n:24},
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
    story:{where:'The open dunes, where both courts came to be counted.',
      before:[['mirror','Two armies, cut from the same block. Shall we see which one flinches?'],
              ['king','No merging out here. Just the pieces we were given.']],
      win:[['king','The same army, and it still broke. Remember that.']],
      lose:[['mirror','Mine held. Yours was only ever a reflection.']]},
  },
  {
    id:7, enemy:'turtle', name:'Twin Forts', desc:'Two sandstone forts, one road between them.',
    cols:11, rows:7, theme:'desert',
    allowSpawn:true, par:30, turnLimit:48,
    winType:'destroy_all', goal:'Destroy every enemy piece', challenge:{type:'noLoss'},
    obstacles:[[2,3],[2,4],[2,6],[2,7],[4,3],[4,4],[4,6],[4,7]],
    white:[{type:'pawn',r:6,c:0},{type:'pawn',r:6,c:1},{type:'pawn',r:5,c:0},{type:'pawn',r:5,c:1},{type:'knight',r:6,c:2},{type:'rook',r:6,c:3},{type:'king',r:5,c:2}],
    black:[{type:'rook',r:0,c:9},{type:'pawn',r:1,c:8},{type:'pawn',r:1,c:9},{type:'pawn',r:1,c:10},{type:'pawn',r:0,c:8}],
    story:{where:'The Coin road, between two sandstone forts.',
      before:[['king','They hold both forts and the road between. Mint what you need, Pip.'],
              ['pip','Yes sire. I do like being several people.']],
      win:[['king','The road is ours. Wren says the Mirror Court runs green now — jungle.']],
      lose:[['mirror','You spend Coin like a man who has only just got it back.']]},
  },
  // ── ACT III · THE GREEN ─────────────────────────────────────────────────────
  // Undergrowth hides whatever stands in it: this is where the Mirror Court stops marching at you
  // and starts waiting for you.
  {
    id:8, enemy:'raider', name:'Green Silence', desc:'They are in the undergrowth, and they saw you first.',
    cols:9, rows:9, theme:'jungle',
    allowSpawn:true, par:18, turnLimit:30,
    winType:'destroy_all', goal:'Destroy every enemy piece', challenge:{type:'kingSafe'},
    obstacles:[[1,1],[2,7],[6,1],[7,7]],
    tiles:[[3,2,'undergrowth'],[3,3,'undergrowth'],[2,5,'undergrowth'],[4,6,'undergrowth'],
      [5,3,'undergrowth'],[5,6,'undergrowth'],[6,4,'undergrowth']],
    white:[{type:'king',r:8,c:4},{type:'knight',r:8,c:3},{type:'bishop',r:8,c:5},{type:'pawn',r:7,c:3},{type:'pawn',r:7,c:5}],
    black:[{type:'knight',r:3,c:3},{type:'bishop',r:2,c:5},{type:'pawn',r:5,c:3},{type:'pawn',r:4,c:6},{type:'rook',r:0,c:4}],
    story:{where:'Green light, and nothing moving.',
      before:[['pip','Sire. The leaves are wrong. They\'re in there and I can\'t count them.'],
              ['wren','Stand beside a patch and it gives its secret up. Not before.']],
      win:[['wren','The spring is a day north. Keep me alive and I will show you what it does.']],
      lose:[['mirror','I was three paces from you the whole time.']]},
  },
  {
    id:9, name:'The Spring', desc:'Wren must reach the Elixir spring alive.',
    cols:9, rows:9, theme:'jungle',
    allowSpawn:true, par:16, turnLimit:26,
    winType:'reach', reachType:'bishop', squares:[[0,4]], protect:'bishop',
    goal:'Walk Wren to the spring — and keep her alive', challenge:{type:'noLoss'},
    obstacles:[[1,2],[1,6],[4,0],[4,8],[6,3],[6,5]],
    tiles:[[3,3,'undergrowth'],[3,5,'undergrowth'],[5,2,'undergrowth'],[5,6,'undergrowth'],[2,4,'undergrowth']],
    white:[{type:'bishop',r:8,c:4},{type:'knight',r:8,c:3},{type:'pawn',r:8,c:5},{type:'pawn',r:7,c:4}],
    black:[{type:'knight',r:2,c:2},{type:'knight',r:2,c:6},{type:'pawn',r:3,c:4},{type:'pawn',r:4,c:3},{type:'pawn',r:4,c:5},{type:'bishop',r:0,c:0}],
    story:{where:'The spring, if the maps are honest.',
      before:[['wren','Elixir is not Coin. It does not mint people. It changes the ones you have.'],
              ['king','Then get to it. We will walk in front of you the whole way.']],
      win:[['wren','It answers. Whatever the Mirror Court took, it did not take this.']],
      lose:[['mirror','Your healer. Out in front. Truly, we are the same king.']]},
  },
  // ── ACT IV · THE MIRROR SEA ─────────────────────────────────────────────────
  {
    id:10, enemy:'turtle', name:'Island Siege', desc:'Break the sea wall with rooks before the garrison forms up.',
    cols:5, rows:9, theme:'ocean',
    allowSpawn:false, par:18, turnLimit:29,
    winType:'destroy_all', goal:'Destroy every enemy piece', challenge:{type:'underTurns',n:12},
    obstacles:[[3,1],[3,3],[5,1],[5,3]],
    white:[{type:'rook',r:8,c:1},{type:'rook',r:8,c:3}],
    black:[{type:'knight',r:0,c:2},{type:'knight',r:1,c:1},{type:'knight',r:1,c:3},{type:'pawn',r:2,c:0},{type:'pawn',r:2,c:2},{type:'pawn',r:2,c:4}],
    story:{where:'The landing, under the sea wall.',
      before:[['king','Two rooks and a beach. Merge them the moment you can.'],
              ['pip','A siege tower can\'t move, sire.'],
              ],
      win:[['king','The wall is open. The citadel is inside, and so is he.']],
      lose:[['mirror','You came across my water with two rooks.']]},
  },
  {
    id:11, enemy:'net', name:'The Mirror Citadel', desc:'His court, his walls, his face. End it.',
    cols:11, rows:11, theme:'ocean',
    allowSpawn:true, par:24, turnLimit:40,
    winType:'destroy_king', goal:'Destroy the Mirror King', challenge:{type:'kingSafe'},
    obstacles:[[1,3],[1,4],[1,5],[1,6],[1,7],[2,3],[2,7],[3,3],[3,7],[4,3],[4,4],[4,6],[4,7]],
    white:[{type:'king',r:10,c:5},{type:'pawn',r:10,c:4},{type:'pawn',r:10,c:6},{type:'knight',r:9,c:5},{type:'rook',r:10,c:3},{type:'bishop',r:9,c:4}],
    black:[{type:'king',r:2,c:5},{type:'queen',r:3,c:5},{type:'rook',r:2,c:4},{type:'bishop',r:3,c:4},{type:'pawn',r:4,c:5},{type:'pawn',r:3,c:6},{type:'pawn',r:5,c:3},{type:'pawn',r:5,c:7}],
    story:{where:'The citadel, and the Coin on a table in the middle of it.',
      before:[['mirror','You brought it all the way here. The crown, the Coin, the pawn who talks.'],
              ['king','Pip. When this is done, mint yourself a house.']],
      win:[['pip','Sire — the crown. It\'s heavy again.'],
           ['king','Then we go home, and we spend it on people.']],
      lose:[['mirror','Sit. The chair is yours as much as mine.']]},
  },
];

// ── LEVEL RULES AND SCORING ──────────────────────────────────────────────────
// Three stars: winning at all, winning inside par, and the level's own challenge. The turn limit is
// the deadline that loses the level (par is well inside it), so a level always has a clock and two
// reasons to come back to it.
function levelPar(lv){return lv.par||lv.turnLimit||0;}
function levelTurnLimit(lv){return lv.turnLimit||0;}
function levelGoal(lv){return lv.goal||(lv.winType==='destroy_king'?'Destroy the enemy King':'Destroy every enemy piece');}
// each challenge is one line the player can read before the level and a check afterwards
const CHALLENGES={
  noLoss:{text:()=>'Lose no piece',met:()=>campaignLost===0},
  kingSafe:{text:()=>'Your King is never hit',met:()=>!campaignKingHit},
  underTurns:{text:c=>'Win within '+c.n+' turns',met:c=>whiteTurnCount<=c.n},
};
function levelChallenge(lv){return lv.challenge||{type:'noLoss'};}
function challengeText(lv){const c=levelChallenge(lv),h=CHALLENGES[c.type];return h?h.text(c):'';}
function challengeMet(lv){const c=levelChallenge(lv),h=CHALLENGES[c.type];return h?!!h.met(c):false;}
// the three conditions, as [text, met] pairs, for the briefing card and the result card
function levelStars(lv,won){
  return [['Win the battle',!!won],
    ['Win within '+levelPar(lv)+' turns',!!won&&whiteTurnCount<=levelPar(lv)],
    [challengeText(lv),!!won&&challengeMet(lv)]];
}

// ── THE STORY ────────────────────────────────────────────────────────────────
// The Hollow Crown: the King's Coin is stolen, so no new pawns can be minted, and the Mirror Court
// — your own pieces in black — marches out of the wood. A level shows two lines before it and one
// after, spoken by a small cast so the campaign has a voice rather than a briefing document.
const SPEAKERS={
  king:{name:'King',type:'king',color:'w'},
  pip:{name:'Pip',type:'pawn',color:'w'},
  wren:{name:'Wren',type:'bishop',color:'w'},
  mirror:{name:'Mirror King',type:'king',color:'b'},
};
function storyLine(who,line,px){
  const s=SPEAKERS[who]||SPEAKERS.king;
  return '<div class="story-line"><div class="story-face">'+pieceSVG(s.type,s.color,mapTheme,px||34,true)+'</div>'
    +'<div class="story-text"><b>'+s.name+'</b>'+line+'</div></div>';
}
function storyLines(list,px){return (list||[]).map(([who,line])=>storyLine(who,line,px)).join('');}

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
      +'<div class="clb-size">'+lv.cols+'x'+lv.rows+' · '+lv.theme+' · '+levelGoal(lv).toLowerCase()+'</div>'
      +'<div class="clb-stars">'+[1,2,3].map(n=>stars>=n?'★':'☆').join('')+'</div></div>';
    if(unlocked)btn.onclick=()=>showBriefing(i);
    list.appendChild(btn);
  });
  overlay.classList.add('show');
}

function hideCampaignSelect(){
  const overlay=document.getElementById('campaign-select');
  if(overlay)overlay.classList.remove('show');
}

// ── BRIEFING CARD ────────────────────────────────────────────────────────────
// A level's front page: where we are, what the King and Pip make of it, the objective, and the three
// stars. It is also where a finished level is read again, so replaying for a star isn't a reading task.
let briefingIdx=-1;
function showBriefing(i){
  const lv=CAMPAIGN_LEVELS[i];if(!lv)return;
  briefingIdx=i;
  const st=lv.story||{},progress=loadCampaignProgress(),stars=progress[i]||0;
  mapTheme=lv.theme; // the portraits are drawn in the map's own piece set
  document.getElementById('briefing-title').textContent=(i+1)+' · '+lv.name;
  const where=document.getElementById('briefing-where');
  where.textContent=st.where||'';where.style.display=st.where?'block':'none';
  document.getElementById('briefing-lines').innerHTML=storyLines(st.before);
  document.getElementById('briefing-goal').innerHTML='<b>Objective</b> '+levelGoal(lv)
    +(levelTurnLimit(lv)?' · <span class="story-dim">'+levelTurnLimit(lv)+' turns to do it</span>':'');
  document.getElementById('briefing-stars').innerHTML=levelStars(lv,false)
    .map(([text],n)=>'<div class="briefing-star">'+(stars>=n+1?'★':'☆')+' '+text+'</div>').join('');
  document.getElementById('campaign-select').classList.remove('show');
  document.getElementById('briefing').classList.add('show');
}
function hideBriefing(){
  document.getElementById('briefing').classList.remove('show');
  showCampaignSelect();
}
function briefingBegin(){
  document.getElementById('briefing').classList.remove('show');
  if(briefingIdx>=0)startCampaignLevel(briefingIdx);
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
  campaignLost=0;campaignKingHit=false;campaignDefeat='';scans=[];elixir={w:0,b:0};mined={w:0,b:0};
  pieces=new Array(ROWS*COLS).fill(null);
  tileData=new Array(ROWS*COLS).fill('');
  // place obstacles
  const obsType=themeObstacle(lv.theme);
  (lv.obstacles||[]).forEach(([r,c])=>{
    if(inB(r,c))tileData[idx(r,c)]=obsType;
  });
  // ground the level asks for by name (the jungle's undergrowth, say)
  (lv.tiles||[]).forEach(([r,c,t])=>{if(inB(r,c))tileData[idx(r,c)]=t;});
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
  if(mcBtn)mcBtn.innerHTML=uiLabel('map','Map Cheat: '+(mapCheat?'ON':'OFF'));
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
// A level's result, from White's side. Every kind of objective is read off the board and the turn
// count, so campaignResult in engine.js can answer with exactly the same rules.
//   destroy_all   no enemy piece left        destroy_king  no enemy King left
//   reach         one of yours (of reachType, if set) stands on a goal square
//   survive       you are still there after surviveTurns turns
//   hold          you stand on a goal square once those turns are up
//   protect:type  losing your last piece of that type loses the level
function checkCampaignWin(){
  if(!campaignLevel)return null;
  const lv=campaignLevel;
  const mine=p=>p&&p.color==='w';
  if(lv.protect&&!pieces.some(p=>mine(p)&&p.type===lv.protect)){campaignDefeat='You lost the one you had to keep';return 'lose';}
  const onGoal=t=>(lv.squares||[]).some(([r,c])=>{const p=pieces[idx(r,c)];return mine(p)&&(!t||p.type===t);});
  if(lv.winType==='reach'&&onGoal(lv.reachType))return 'win';
  if((lv.winType==='survive'||lv.winType==='hold')&&whiteTurnCount>=(lv.surviveTurns||lv.turnLimit)){
    if(lv.winType==='survive')return 'win';
    if(onGoal(null))return 'win';
  }
  // if the level has kings, king death always determines win/lose
  // whoever started the level with a King loses it by losing him
  if(lv.winType==='destroy_king'||(lv.black||[]).some(p=>p.type==='king')){
    if(!pieces.some(p=>p&&p.color==='b'&&p.type==='king'))return 'win';
  }
  if((lv.white||[]).some(p=>p.type==='king')){
    if(!pieces.some(p=>mine(p)&&p.type==='king')){campaignDefeat='Your King has fallen';return 'lose';}
  }
  // check win: destroy all enemy pieces
  if(lv.winType==='destroy_all'){
    const anyBlack=pieces.find(p=>p&&p.color==='b');
    if(!anyBlack)return 'win';
  }
  // check lose: all white pieces destroyed
  {
    const anyWhite=pieces.find(p=>p&&p.color==='w');
    if(!anyWhite){campaignDefeat='Your army is gone';return 'lose';}
  }
  // the deadline: once your turns are spent the level is lost (campaignResult in engine.js)
  if(lv.turnLimit&&whiteTurnCount>=lv.turnLimit){campaignDefeat='Out of turns';return 'lose';}
  return null; // game continues
}

function handleCampaignEnd(result){
  over=true;
  const lv=campaignLevel,story=lv.story||{};
  if(result==='win'){
    SFX.win();
    const conds=levelStars(lv,true);
    const stars=conds.filter(([,met])=>met).length;
    const progress=loadCampaignProgress();
    const prev=progress[campaignLevelId]||0;
    progress[campaignLevelId]=Math.max(prev,stars);
    saveCampaignProgress(progress);
    const el=document.getElementById('game-over');
    const title=document.getElementById('go-title');
    const sub=document.getElementById('go-sub');
    title.className='win';
    title.textContent='Victory!';
    sub.innerHTML='<div class="go-stars">'+conds.map(([text,met])=>
        '<div class="'+(met?'go-star-on':'go-star-off')+'">'+(met?'★':'☆')+' '+text+'</div>').join('')+'</div>'
      +'<div class="go-note">Won in '+whiteTurnCount+' turns</div>'
      +storyLines(story.win,30);
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
    sub.innerHTML='<div class="go-note">'+(campaignDefeat||'Your army could not hold')+'</div>'+storyLines(story.lose,30);
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
