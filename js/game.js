// ── GAME ─────────────────────────────────────────────────────────────────────
function startGame(mode){
  gameMode=mode;
  difficulty=mode==='hard'?'hard':mode==='medium'?'medium':mode==='pvp'?'pvp':'easy';
  // start loading this difficulty's trained network (js/netai.js)
  if(mode!=='pvp'&&typeof netAiPreload==='function')netAiPreload();
  // reset board size and campaign state for non-campaign modes
  campaignLevel=null; campaignLevelId=-1;
  COLS=9; ROWS=9;
  document.getElementById('intro').classList.add('hidden');
  const pvpVisible=mode==='pvp';
  document.getElementById('pvp-section').style.display='none';
  document.getElementById('pvp-label').style.display='none';
  initGame();
  if(mode==='pvp') initBC();
}

function initGame(){
  pieces=new Array(ROWS*COLS).fill(null);
  const wKiPos=idx(7,1), bKiPos=idx(1,7);
  pieces[wKiPos]={type:'king',color:'w',hp:5,maxHp:5};
  pieces[bKiPos]={type:'king',color:'b',hp:5,maxHp:5};
  // place 3 starting pawns for each side on the king-adjacent tiles closest to the enemy king
  const wPawnTiles=adj8(wKiPos).filter(j=>!pieces[j]).sort((a,b)=>cheb(a,bKiPos)-cheb(b,bKiPos)).slice(0,3);
  wPawnTiles.forEach(j=>{pieces[j]={type:'pawn',color:'w',hp:STATS.pawn.hp,maxHp:STATS.pawn.maxHp,firstMove:true};});
  const bPawnTiles=adj8(bKiPos).filter(j=>!pieces[j]).sort((a,b)=>cheb(a,wKiPos)-cheb(b,wKiPos)).slice(0,3);
  bPawnTiles.forEach(j=>{pieces[j]={type:'pawn',color:'b',hp:STATS.pawn.hp,maxHp:STATS.pawn.maxHp,firstMove:true};});
  resetView();
  turn='w'; over=false; thinking=false; logLines=[]; kingSelected=false;
  whiteTargets={}; blackTargets={};
  spawnHistory=[]; blackSpawnHistory=[]; whiteTurnCount=0; blackTurnCount=0; movedThisTurn=-1;
  exploredTiles=new Set();
  // regular games start fogged (the tutorial and campaign set their own default)
  mapCheat=false;
  const mcBtn=document.getElementById('btn-mapcheat');if(mcBtn)mcBtn.innerHTML=uiLabel('map','Map Cheat: OFF');
  const tc=document.getElementById('turn-counter');if(tc)tc.textContent='Turn 0';
  animalDivs.forEach(el=>el.remove());animalDivs.clear();
  // single-player: reuse title-screen map; PvP always regenerates
  if(!pvpActive&&gameMode!=='pvp'&&titleTileData){
    tileData=titleTileData.slice();
    animals=ANIMALS_ON?titleAnimals.map(a=>({...a})):[];
    animals.forEach(na=>{
      if(na.isMummy){
        const pr=Math.round(na.y-0.5),pc=Math.round(na.x-0.5);
        const si=inB(pr,pc)?idx(pr,pc):-1;
        if(si<0||isTileBlocked(si)){
          const empties=si>=0?adj8(si).filter(j=>!isTileBlocked(j)&&!pieces[j]):[];
          if(empties.length){
            na.x=COL(empties[0])+0.5;na.y=ROW(empties[0])+0.5;
            na.tx=na.x;na.ty=na.y;na.prevTileR=ROW(empties[0]);na.prevTileC=COL(empties[0]);
          }
        }
      }
    });
    if(ANIMALS_ON){startAnimalLoop();setTimeout(()=>renderAnimalOverlay(),50);}
  }else{
    generateMap();
  }
  titleTileData=null; titleAnimals=null;
  // PvP: animals roam on each client's own clock and can't be kept in sync, so multiplayer has none
  if(gameMode==='pvp'){animals=[];stopAnimalLoop();}
  blackLastFrom=-1; blackLastTo=-1;
  targetMode=false; targetSrc=-1;
  dragSrc=-1; dragging=false;
  document.getElementById('ghost').style.display='none';
  document.getElementById('thinking-dot').classList.remove('on');
  document.getElementById('log').textContent='';
  if(!pvpActive && gameMode!=='pvp') pickStrategy();
  if(!bgmPaused&&!bgmPlaying) startBgm();
  syncUI(); render();
  showMoveHint();
  setStatus("White's turn");
}

// ── TURN MANAGEMENT ───────────────────────────────────────────────────────────
function startWhiteTurn(){
  turn='w';
  if(isTutorialActive()){
    const step=TUTORIAL_STEPS[tutStep];
    if(step&&step._healPhase){
      const ek=pieces.findIndex(p=>p&&p.color==='b'&&p.type==='knight');
      if(ek<0){
        step._healPhase=false;
        tutWaitingForAction=false;
        document.getElementById('tut-title').textContent='Enemy Defeated! \u2658';
        document.getElementById('tut-desc').textContent='The enemy knight is destroyed! Press Next to merge two knights into a Rook.';
        document.getElementById('tut-hint').textContent='Press Next \u2192 to continue.';
        const nb=document.getElementById('tut-next');
        if(nb){
          nb.textContent='\u2713 Next \u2192';
          nb.style.background='#1a4010';nb.style.borderColor='#70c030';nb.style.color='#c8f040';
          nb.onclick=()=>{
            nb.style.background='';nb.style.borderColor='';nb.style.color='';
            for(let i=0;i<ROWS*COLS;i++){if(pieces[i]&&pieces[i].color==='b')pieces[i]=null;}
            for(let i=0;i<ROWS*COLS;i++){if(pieces[i]&&pieces[i].color==='w'&&pieces[i].type!=='king')pieces[i]=null;}
            tileData=new Array(ROWS*COLS).fill('');
            for(let r=0;r<4;r++)for(let c=0;c<3;c++){tileData[idx(r,c)]='tree';}
            pieces[idx(4,4)]={type:'knight',color:'w',hp:4,maxHp:4};
            pieces[idx(4,3)]={type:'knight',color:'w',hp:4,maxHp:4};
            render();tutHighlightPiece(idx(4,3));
            document.getElementById('tut-title').textContent='Merge: \u2658+\u2658 \u2192 \u2656';
            document.getElementById('tut-desc').textContent='Merge two knights into a Rook — heavy artillery that fires 3 squares cardinally!';
            document.getElementById('tut-hint').textContent='Drag one knight onto the other to merge!';
            tutWaitingForAction=true; tutActionType='merge';
            nb.textContent='Skip Step \u2192';nb.style.background='';nb.style.borderColor='';nb.style.color='';nb.onclick=tutNext;
          };
        }
        render();syncUI();return;
      }
    }
  }
  turnUpkeep();
  syncUI(); render();
  showMoveHint();
  setStatus("White's turn");
}

// start-of-turn upkeep; in PvP each client only touches its own pieces
function turnUpkeep(){
  const own=pvpActive?myColor():null;
  // clear newborn aura from previous turn
  for(let i=0;i<ROWS*COLS;i++){if(pieces[i]?.newborn&&(!own||pieces[i].color===own))pieces[i].newborn=false;}
  // bishop mana: +1 mana every 3 turns after the bishop last healed
  for(let i=0;i<ROWS*COLS;i++){
    const p=pieces[i];
    if(p&&p.type==='bishop'&&(!own||p.color===own)&&(p.mana||0)<2){
      const lastHeal=p.lastHealTurn||0;
      if(whiteTurnCount-lastHeal>=3&&whiteTurnCount>0){
        p.mana=Math.min(2,(p.mana||0)+1);
        p.lastHealTurn=whiteTurnCount; // reset cooldown from this regen
        if(p.mana===2)flashSq(i,'heal-flash');
      }
    }
  }
}

function endTurn(){
  if(over)return;
  whiteTurnCount++;
  blackHitBy=[]; // reset hit tracker before white auto-attacks populate it
  const tc=document.getElementById('turn-counter');if(tc)tc.textContent='Turn '+whiteTurnCount;
  targetMode=false;targetSrc=-1;kingSelected=false;selectedPieces=new Set();boxSelecting=false;boxMouseDownOnEmpty=false;clearBoxSelect();

  if(pvpActive){
    // PvP: the player who just acted fires their own side's auto-attacks, then passes the turn
    const mover=turn;
    const justMoved=movedThisTurn;
    movedThisTurn=-1;
    const actions=computeActions(mover).filter(a=>a.attacker!==justMoved);
    const passTurn=()=>{
      thinking=false;
      if(over){
        setStatus(mover==='w'?'White wins! ♔':'Black wins! ♚');SFX.win();syncUI();render();
        broadcastState(mover);
        setTimeout(()=>showGameOver(myColor()===mover?'win':'lose'),600);
        return;
      }
      turn=mover==='w'?'b':'w';
      broadcastState(null);syncUI();render();
      setStatus(isMyTurn()?'Your turn':'Opponent turn...');
    };
    if(actions.length){
      thinking=true;syncUI();setStatus('Attacking...');
      setTimeout(()=>executeActions(actions,mover,passTurn),100);
    }else{
      passTurn();
    }
  }else{
    const justMoved=movedThisTurn;
    movedThisTurn=-1;
    const wActions=computeActions('w').filter(a=>a.attacker!==justMoved);
    const runBlack=()=>{
      thinking=true;syncUI();render();
      document.getElementById('thinking-dot').classList.add('on');
      setStatus('Enemy thinking...');
      const bActions=computeActions('b');
      blackActed=new Set(bActions.map(a=>a.attacker));
      if(bActions.length){
        setTimeout(()=>executeActions(bActions,'b',()=>{
          render();if(over){if(campaignLevel){const cr=checkCampaignWin();setTimeout(()=>handleCampaignEnd(cr||'lose'),600);}else{setStatus('Black wins! ♚');SFX.lose();syncUI();setTimeout(()=>showGameOver(myColor()==='b'?'win':'lose'),600);}return;}
          setTimeout(aiAct,200);
        }),200);
      }else{
        blackActed=new Set();
        setTimeout(aiAct,300);
      }
    };
    if(wActions.length){
      setStatus('Attacking...');
      setTimeout(()=>executeActions(wActions,'w',()=>{
        render();
        if(over){if(campaignLevel){const cr=checkCampaignWin();setTimeout(()=>handleCampaignEnd(cr||'win'),600);}else{setStatus('White wins! ♔');SFX.win();syncUI();broadcastState('w');setTimeout(()=>showGameOver(myColor()==='w'?'win':'lose'),600);}return;}
        runBlack();
      }),100);
    }else{
      runBlack();
    }
  }
}

function finishBlackTurn(){
  thinking=false;
  blackTurnCount++;
  document.getElementById('thinking-dot').classList.remove('on');
  if(!over){startWhiteTurn();}
}
