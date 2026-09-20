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
  scans=[];elixir={w:0,b:0};mineTurns={w:0,b:0};goldSpent={w:0,b:0};
  orderLeft={w:ORDER_BUDGET,b:ORDER_BUDGET};orderTurns=0;
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
  setStatus("White's turn");
}

// ── PLAYING ON ───────────────────────────────────────────────────────────────
// The game is decided, but the board is still there. This picks it up again and lets the pieces fight
// on without the king that fell: nothing else ends a plain game, so it runs until the other king goes
// too (and then you can play on again). White takes the turn.
function keepPlaying(){
  if(campaignLevel||pvpActive||gameMode==='aivsai')return;
  hideGameOver();
  over=false;thinking=false;movedThisTurn=-1;
  turn='w';
  const dot=document.getElementById('thinking-dot');if(dot)dot.classList.remove('on');
  addLog('Playing on');
  startWhiteTurn();
}

// ── TURN MANAGEMENT ───────────────────────────────────────────────────────────
function startWhiteTurn(){
  turn='w';
  // the level may already be decided: its turns ran out, or the objective was met while Black moved
  if(campaignLevel&&!over){
    const r=checkCampaignWin();
    if(r){over=true;setTimeout(()=>handleCampaignEnd(r),300);return;}
  }
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
  tickScans('w');
  turnUpkeep();
  if(over){   // an order that came due ended it
    const mine=pieces.some(q=>q&&q.color===myColor()&&q.type==='king');
    syncUI();render();
    if(campaignLevel){const cr=checkCampaignWin();setTimeout(()=>handleCampaignEnd(cr||'lose'),600);}
    else{setStatus(mine?'White wins! \u2654':'Black wins! \u265A');mine?SFX.win():SFX.lose();
      setTimeout(()=>showGameOver(mine?'win':'lose'),600);}
    return;
  }
  syncUI(); render();
  setStatus("White's turn");
}

// start-of-turn upkeep; in PvP each client only touches its own pieces
function turnUpkeep(own){
  if(own===undefined)own=pvpActive?myColor():null;
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
  // a fortified pawn's armour mends 1 HP five turns after the last hit it took (upkeep in engine.js)
  for(let i=0;i<ROWS*COLS;i++){
    const p=pieces[i];
    if(p&&p.fortified&&(!own||p.color===own)&&p.hp<p.maxHp){
      const last=p.lastHitTurn||0;
      if(whiteTurnCount-last>=FORTIFIED_MEND&&whiteTurnCount>0){p.hp++;p.lastHitTurn=whiteTurnCount;flashSq(i,'heal-flash');}
    }
  }
  // the orders count down here and go off at the end of the turn they reach nought on (runOrders, from
  // endTurn), so an order lands together with the move its side makes that turn. The budget comes back
  // with the turn, and the Delay counter starts every turn at none.
  countOrders(own);
  if(!own||own==='w')orderLeft.w=ORDER_BUDGET;
  if(!own||own==='b')orderLeft.b=ORDER_BUDGET;
  orderTurns=0;
}

// ── DELAYED ORDERS ───────────────────────────────────────────────────────────
// An order counts down at the start of its side's turn (countOrders) and is carried out at the end of
// the turn it reaches nought on, alongside whatever else that side did — so the ordered piece and this
// turn's own move set off together. The piece moves to the square it reserved, or strikes an enemy
// standing there instead, or the order simply lapses — when a piece of its own is on the square, or
// the square has gone out of its reach.
// Mirrored by countOrders/runOrders in js/engine.js, which the parity tests hold to these.
function countOrders(own){
  for(let i=0;i<ROWS*COLS;i++){
    const p=pieces[i];
    if(!p||!p.order||(own&&p.color!==own))continue;
    if(p.order.turns>0)p.order.turns--;
  }
}
function runOrders(own){
  for(let i=0;i<ROWS*COLS;i++){
    const p=pieces[i];
    if(!p||!p.order||(own&&p.color!==own))continue;
    if(p.order.turns>0)continue;
    const to=p.order.to;delete p.order;
    const t=pieces[to],d=getDragDests(i),tgts=p.color==='w'?whiteTargets:blackTargets;
    if(t&&t.color!==p.color&&d.attack.has(to)){
      const dmg=p.type==='siege'?2:1;
      t.hp-=dmg;
      if(t.fortified)t.lastHitTurn=whiteTurnCount;
      flashSq(to,'hit-flash');SFX.attack();
      addLog(p.type+' strikes '+t.type+'@'+sqName(to)+' as ordered');
      if(t.hp<=0){
        showDeath(to,t.color,t.type);SFX.fall(t.type);
        pieces[to]=null;
        if(campaignLevel){const cr=checkCampaignWin();if(cr)over=true;}
        else if(t.type==='king'){over=true;}
      }
    }else if(!t&&d.move.has(to)){
      delete tgts[i];
      if(p.type==='pawn')p.firstMove=false;
      pieces[to]=p;pieces[i]=null;
      flashSq(to,'order-flash');SFX.move();
      addLog(p.type+' moves to '+sqName(to)+' as ordered');
    }else addLog(p.type+"'s order at "+sqName(to)+' lapses');
  }
}

// a campaign level can be decided by White's own turn — the objective met, or the last enemy gone —
// before Black moves; the engine checks at the same point, so both end a level on the same turn
function campaignCheckpoint(){
  if(!campaignLevel||over)return false;
  const r=checkCampaignWin();
  if(!r)return false;
  over=true;
  setTimeout(()=>handleCampaignEnd(r),600);
  return true;
}

function endTurn(){
  if(over)return;
  // the piece that moved or healed this turn does not fire at the end of it; the engine's finishTurn
  // takes the same note at the same moment, before the orders go off
  const justMoved=movedThisTurn;
  movedThisTurn=-1;
  whiteTurnCount++;
  if(pawnOnMine(turn))mineTurns[turn]++;   // the mine pays for the turn it was held (finishTurn in engine.js)
  // the orders due this turn go off now, with the move that was just made, so the two animate together
  runOrders(turn);
  if(trainingMode&&over){over=false;addLog('A king has fallen — the training goes on');}
  if(over){orderEndsGame(turn);return;}
  blackHitBy=[]; // reset hit tracker before white auto-attacks populate it
  const tc=document.getElementById('turn-counter');if(tc)tc.textContent='Turn '+whiteTurnCount;
  targetMode=false;targetSrc=-1;kingSelected=false;selectedPieces=new Set();boxSelecting=false;boxMouseDownOnEmpty=false;clearBoxSelect();

  if(pvpActive||trainingMode){
    // PvP: the player who just acted fires their own side's auto-attacks, then passes the turn
    // Training: the same hand-over, with both sides in the same seat
    const mover=turn;
    const actions=computeActions(mover).filter(a=>a.attacker!==justMoved);
    const passTurn=()=>{
      thinking=false;
      // the training ground has nothing to win: a king falling is just one more thing to watch
      if(trainingMode&&over){over=false;addLog('A king has fallen — the training goes on');}
      if(over){
        setStatus(mover==='w'?'White wins! ♔':'Black wins! ♚');SFX.win();syncUI();render();
        broadcastState(mover);
        setTimeout(()=>showGameOver(myColor()===mover?'win':'lose'),600);
        return;
      }
      turn=mover==='w'?'b':'w';
      tickScans(turn);
      if(trainingMode)turnUpkeep(turn);   // orders, mana and mending for the side taking over
      broadcastState(null);syncUI();render();
      setStatus(trainingMode?(turn==='w'?"White's turn":"Black's turn"):isMyTurn()?'Your turn':'Opponent turn...');
    };
    if(actions.length){
      thinking=true;syncUI();setStatus('Attacking...');
      setTimeout(()=>executeActions(actions,mover,passTurn),100);
    }else{
      passTurn();
    }
  }else{
    const wActions=computeActions('w').filter(a=>a.attacker!==justMoved);
    const runBlack=()=>{
      tickScans('b');
      thinking=true;syncUI();render();
      document.getElementById('thinking-dot').classList.add('on');
      setStatus('Enemy thinking...');
      const bActions=computeActions('b');
      blackActed=new Set(bActions.map(a=>a.attacker));
      if(bActions.length){
        setTimeout(()=>executeActions(bActions,'b',()=>{
          render();if(over){if(campaignLevel){const cr=checkCampaignWin();setTimeout(()=>handleCampaignEnd(cr||'lose'),600);}else{setStatus('Black wins! ♚');SFX.lose();syncUI();setTimeout(()=>showGameOver(myColor()==='b'?'win':'lose'),600);}return;}
          if(campaignCheckpoint())return;
          setTimeout(aiAct,200);
        }),200);
      }else{
        blackActed=new Set();
        if(campaignCheckpoint())return;
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
  if(pawnOnMine('b'))mineTurns.b++;
  runOrders('b');                       // Black's orders land with the move Black just made
  if(trainingMode&&over){over=false;addLog('A king has fallen — the training goes on');}
  document.getElementById('thinking-dot').classList.remove('on');
  if(over){orderEndsGame('b');return;}
  startWhiteTurn();
}

// an order that came due took the last king: the side whose order it was has won
function orderEndsGame(winner){
  render();syncUI();
  if(campaignLevel){const cr=checkCampaignWin();setTimeout(()=>handleCampaignEnd(cr||(winner==='w'?'win':'lose')),600);return;}
  setStatus(winner==='w'?'White wins! ♔':'Black wins! ♚');
  const won=myColor()===winner;won?SFX.win():SFX.lose();
  broadcastState(winner);
  setTimeout(()=>showGameOver(won?'win':'lose'),600);
}
