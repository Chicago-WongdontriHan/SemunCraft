// ── GAME ─────────────────────────────────────────────────────────────────────
function startGame(mode){
  gameMode=mode;
  difficulty=mode==='hard'?'hard':'easy';
  document.getElementById('intro').classList.add('hidden');
  const pvpVisible=mode==='pvp';
  document.getElementById('pvp-section').style.display='none';
  document.getElementById('pvp-label').style.display='none';
  initGame();
  if(mode==='pvp') initBC();
}

function initGame(){
  pieces=new Array(ROWS*COLS).fill(null);
  pieces[idx(7,1)]={type:'king',color:'w',hp:5,maxHp:5};
  pieces[idx(1,7)]={type:'king',color:'b',hp:5,maxHp:5};
  turn='w'; over=false; thinking=false; logLines=[]; kingSelected=false;
  whiteTargets={}; blackTargets={};
  spawnHistory=[]; whiteTurnCount=0; movedThisTurn=-1;
  const tc=document.getElementById('turn-counter');if(tc)tc.textContent='Turn 0';
  animalDivs.forEach(el=>el.remove());animalDivs.clear();
  // single-player: reuse title-screen map; PvP always regenerates
  if(!pvpActive&&gameMode!=='pvp'&&titleTileData){
    tileData=titleTileData.slice();
    animals=titleAnimals.map(a=>({...a}));
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
    startAnimalLoop();
    setTimeout(()=>renderAnimalOverlay(),50);
  }else{
    generateMap();
  }
  titleTileData=null; titleAnimals=null;
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
  // clear newborn aura from previous turn
  for(let i=0;i<ROWS*COLS;i++){if(pieces[i]?.newborn)pieces[i].newborn=false;}
  // bishop mana: +1 every 3 turns (all bishops)
  if(whiteTurnCount>0&&whiteTurnCount%3===0){
    for(let i=0;i<ROWS*COLS;i++){
      const p=pieces[i];
      if(p&&p.type==='bishop'){
        p.mana=Math.min(2,(p.mana||0)+1);
        if(p.mana===2)flashSq(i,'heal-flash');
      }
    }
  }
  syncUI(); render();
  showMoveHint();
  setStatus("White's turn");
}

function endTurn(){
  if(over)return;
  whiteTurnCount++;
  const tc=document.getElementById('turn-counter');if(tc)tc.textContent='Turn '+whiteTurnCount;
  targetMode=false;targetSrc=-1;kingSelected=false;selectedPieces=new Set();boxSelecting=false;boxMouseDownOnEmpty=false;clearBoxSelect();

  if(pvpActive){
    turn=turn==='w'?'b':'w';
    broadcastState(null);syncUI();render();
    setStatus(isMyTurn()?'Your turn':'Opponent turn...');
  }else{
    const justMoved=movedThisTurn;
    movedThisTurn=-1;
    const wActions=computeActions('w').filter(a=>a.attacker!==justMoved);
    const runBlack=()=>{
      thinking=true;syncUI();render();
      document.getElementById('thinking-dot').classList.add('on');
      setStatus('Enemy thinking...');
      const bActions=computeActions('b');
      if(bActions.length){
        setTimeout(()=>executeActions(bActions,'b',()=>{
          render();if(over){setStatus('Black wins! ♚');SFX.lose();syncUI();setTimeout(()=>showGameOver(myColor()==='b'?'win':'lose'),600);return;}
          setTimeout(aiAct,200);
        }),200);
      }else{
        setTimeout(aiAct,300);
      }
    };
    if(wActions.length){
      setStatus('Attacking...');
      setTimeout(()=>executeActions(wActions,'w',()=>{
        render();
        if(over){setStatus('White wins! ♔');SFX.win();syncUI();broadcastState('w');setTimeout(()=>showGameOver(myColor()==='w'?'win':'lose'),600);return;}
        runBlack();
      }),100);
    }else{
      runBlack();
    }
  }
}

function finishBlackTurn(){
  thinking=false;
  document.getElementById('thinking-dot').classList.remove('on');
  if(!over){startWhiteTurn();}
}
