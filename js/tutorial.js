// ── TUTORIAL ─────────────────────────────────────────────────────────────────
let tutStep=0;
let tutWaitingForAction=false;
let tutActionType='';
let tutFromAutoChain=false;
let tutActionTarget=-1;
let tutEnemySpawn=-1; // spawn tile of the tutorial enemy

function tutAddEnemy(type,r,c,opts){
  const i=idx(r,c);
  if(!inB(r,c))return;
  // clear any existing black pieces first (only one tutorial enemy at a time)
  for(let j=0;j<ROWS*COLS;j++){if(pieces[j]&&pieces[j].color==='b')pieces[j]=null;}
  const st=STATS[type];
  pieces[i]={type,color:'b',hp:st.hp,maxHp:st.maxHp};
  if(opts&&opts.stationary)pieces[i].stationary=true;
  tutEnemySpawn=i;
}

// called once per turn (from aiAct in tutorial mode) to move the tutorial enemy
function tutMoveEnemyOnce(){
  if(!isTutorialActive())return;
  // only move non-stationary enemies that haven't auto-attacked this turn
  const ei=pieces.findIndex(p=>p&&p.color==='b'&&!p.stationary);
  if(ei<0)return;
  if(blackActed.has(ei))return; // already attacked this turn — can't also move
  if(tutEnemySpawn<0)return;
  const p=pieces[ei];
  // wander within 1 tile of the original spawn location
  const neighbors=adj8(ei).filter(j=>!pieces[j]&&!isTileBlocked(j)&&cheb(j,tutEnemySpawn)<=1);
  if(!neighbors.length)return;
  const dest=neighbors[Math.floor(Math.random()*neighbors.length)];
  pieces[ei]=null;pieces[dest]=p;
  blackLastFrom=ei; blackLastTo=dest;
  render();
  animatePieceMove(ei,dest,p.type,'b',true,()=>{},180);
}

function stopTutEnemyWander(){
  tutEnemySpawn=-1;
}

const TUTORIAL_STEPS=[
  // ── KING & SPAWN (first!) ─────────────────────────────────────────────────
  {
    title:'King \u2654 & Spawning',
    desc:'An enemy is marching from the top-right toward your king! Click the king to enter spawn mode, then click an adjacent empty square to spawn a defender.',
    hint:'Click the king, then click an adjacent empty square.',
    action:'spawn',
    setup(){
      tutBoard({w:{},b:{}});
      tutAddEnemy('pawn',1,7);
      render();
      const ki=pieces.findIndex(p=>p&&p.color==='w'&&p.type==='king');
      tutHighlightPiece(ki);
    },
    onSpawn(){
      // keep the pawn where the user spawned it (adjacent to the king)
      const pi=pieces.findIndex(p=>p&&p.color==='w'&&p.type==='pawn');
      if(pi>=0)tutHighlightPiece(pi);
      document.getElementById('tut-title').textContent='The Pawn \u2659';
      document.getElementById('tut-desc').textContent='You spawned a pawn! Pawns move to any adjacent tile (8 directions, 1 step) and attack the same way. The enemy is marching toward your king — move your pawn to intercept and attack it!';
      tutContinue('move','Drag the pawn one step toward the enemy.');
    },
    onMove(){
      // enemy already exists — just prompt for attack if adjacent, otherwise keep moving
      const pi=pieces.findIndex(p=>p&&p.color==='w'&&p.type==='pawn');
      if(pi>=0)tutHighlightPiece(pi);
      tutContinue('attack','Keep moving toward the enemy, then drag onto it to attack!');
    },
    onAttack(){
      stopTutEnemyWander();
      document.getElementById('tut-desc').textContent='Enemy defeated! Press Next to learn how to merge pieces.';
      tutWaitForNext(()=>{
        for(let i=0;i<ROWS*COLS;i++){if(pieces[i]&&pieces[i].color==='b'&&pieces[i].type!=='king')pieces[i]=null;}
        for(let i=0;i<ROWS*COLS;i++){if(pieces[i]&&pieces[i].color==='w'&&pieces[i].type==='pawn')pieces[i]=null;}
        const cR=Math.floor(ROWS/2),cC=Math.floor(COLS/2);
        const c1=idx(cR,cC),c2=idx(cR,cC+1);
        pieces[c1]={type:'pawn',color:'w',hp:1,maxHp:1};
        pieces[c2]={type:'pawn',color:'w',hp:1,maxHp:1};
        tutAddEnemy('pawn',1,7,{stationary:true});
        render();tutHighlightPiece(c1);
        document.getElementById('tut-desc').textContent='Great! Now let\'s learn how to make a stronger piece. Merge two provided pawn in adjacent tiles.';
        tutContinue('merge','\u2659+\u2659 \u2192 \u2658: Drag your pawn onto the other pawn to merge!');
        document.getElementById('tut-title').textContent='Merge: \u2659+\u2659 \u2192 \u2658';
      });
    },
    onMerge(){
      tutAutoNext(1);
    },
  },
  // ── KNIGHT ────────────────────────────────────────────────────────────────
  {
    title:'The Knight \u2658',
    desc:'Knights move in an L-shape: 2 squares one way, 1 square perpendicular, jumping over pieces. Move the newly-formed knight toward the enemy at the top-right and attack it.',
    hint:'Jump the knight toward the enemy.',
    action:'move',
    // preserve the merged-knight position and the enemy pawn from the previous step
    fromMerge:true,
    setup(){
      tutBoard({w:{knight:[idx(4,4)]},b:{}});
      tutAddEnemy('pawn',1,7,{stationary:true});
      render();
      tutHighlightPiece(idx(4,4));
    },
    onMove(){
      const ki=pieces.findIndex(p=>p&&p.color==='w'&&p.type==='knight');
      if(ki>=0)tutHighlightPiece(ki);
      tutContinue('attack','Keep jumping toward the enemy, then drag onto it to attack!');
    },
    onAttack(){
      stopTutEnemyWander();
      document.getElementById('tut-desc').textContent='Enemy defeated! Press Next to learn the pawn+knight merge.';
      tutWaitForNext(()=>{
        for(let i=0;i<ROWS*COLS;i++){if(pieces[i]&&pieces[i].color==='b'&&pieces[i].type!=='king')pieces[i]=null;}
        for(let i=0;i<ROWS*COLS;i++){if(pieces[i]&&pieces[i].color==='w'&&pieces[i].type!=='king')pieces[i]=null;}
        pieces[idx(4,4)]={type:'knight',color:'w',hp:4,maxHp:4};
        pieces[idx(4,3)]={type:'pawn',color:'w',hp:1,maxHp:1};
        render();tutHighlightPiece(idx(4,3));
        document.getElementById('tut-desc').textContent='Well done! Combine a pawn and a knight to form a Bishop. Drag the pawn onto the adjacent knight.';
        tutContinue('merge','\u2659+\u2658 \u2192 \u2657: Drag the pawn onto the knight!');
        document.getElementById('tut-title').textContent='Merge: \u2659+\u2658 \u2192 \u2657';
      });
    },
    onMerge(){
      document.getElementById('tut-title').textContent='The Bishop \u2657';
      document.getElementById('tut-desc').textContent='Bishops move diagonally up to 2 squares. They attack diagonally and heal allies using mana (blue dots). Move the bishop, then attack, then heal!';
      document.getElementById('tut-hint').textContent='Drag the bishop diagonally 1 or 2 squares.';
      tutAutoNext(2);
    },
  },
  // ── BISHOP ────────────────────────────────────────────────────────────────
  {
    title:'The Bishop \u2657',
    desc:'Bishops move diagonally up to 2 squares. They can only attack or heal along diagonal lines. Move the bishop to a diagonal from the enemy at the top-right and attack it!',
    hint:'Line the bishop up diagonally with the enemy, then drag to attack.',
    action:'move',
    setup(){
      tutBoard({w:{bishop:[idx(4,4)]},b:{}});
      const bp=pieces[idx(4,4)];if(bp)bp.mana=2;
      tutAddEnemy('pawn',1,7,{stationary:true});
      render();
      tutHighlightPiece(idx(4,4));
    },
    onMove(){
      const bi=pieces.findIndex(p=>p&&p.color==='w'&&p.type==='bishop');
      if(bi>=0)tutHighlightPiece(bi);
      tutContinue('attack','Keep moving diagonally toward the enemy, then drag onto it to attack!');
    },
    onAttack(){
      const step=TUTORIAL_STEPS[tutStep];
      if(step&&step._healPhase){
        tutWaitingForAction=true; tutActionType='attack';
        return;
      }
      stopTutEnemyWander();
      document.getElementById('tut-desc').textContent='Enemy defeated! Press Next to learn how to heal.';
      tutWaitForNext(()=>{
        for(let i=0;i<ROWS*COLS;i++){if(pieces[i]&&pieces[i].color==='w'&&pieces[i].type!=='king')pieces[i]=null;}
        for(let i=0;i<ROWS*COLS;i++){if(pieces[i]&&pieces[i].color==='b'&&pieces[i].type!=='king')pieces[i]=null;}
        const wKn=idx(4,4);
        const eKn=idx(2,3);
        const bPos=idx(6,6);
        pieces[wKn]={type:'knight',color:'w',hp:3,maxHp:4};
        pieces[eKn]={type:'knight',color:'b',hp:4,maxHp:4,stationary:true};
        pieces[bPos]={type:'bishop',color:'w',hp:STATS.bishop.hp,maxHp:STATS.bishop.maxHp,mana:2};
        render();
        tutHighlightPiece(bPos);
        document.getElementById('tut-desc').textContent='Your knight is wounded and the enemy knight will attack it! Drag the bishop diagonally onto the wounded knight to heal it. Each heal costs 1 mana and restores 2 HP.';
        tutContinue('heal','Drag the bishop onto the wounded white knight!');
        document.getElementById('tut-title').textContent='Bishop Heals \u2657';
      });
    },
    onHeal(){
      const bi=pieces.findIndex(p=>p&&p.color==='w'&&p.type==='bishop');
      const manaLeft=bi>=0?(pieces[bi].mana||0):0;
      const wKn=pieces.findIndex(p=>p&&p.color==='w'&&p.type==='knight');
      if(wKn>=0){render();tutHighlightPiece(wKn);}
      if(manaLeft>0){
        document.getElementById('tut-desc').textContent='The knight is healed! Bishop still has '+manaLeft+' mana — you can heal again, or attack the enemy knight with your knight.';
        document.getElementById('tut-hint').textContent='Heal again or attack the enemy knight!';
      }else{
        document.getElementById('tut-desc').textContent='The knight is healed! The bishop is now out of mana — it will recover 1 mana every 3 turns. Now attack the enemy knight with your knight to finish the fight!';
        document.getElementById('tut-hint').textContent='Drag your knight onto the enemy knight to attack!';
      }
      document.getElementById('tut-title').textContent='Bishop Heals \u2657 \u2192 Knight Fights!';
      tutWaitingForAction=true; tutActionType='attack';
      TUTORIAL_STEPS[tutStep]._healPhase=true;
    },
    onMerge(){
      tutAutoNext(3);
    },
    _afterKillNext(){
      for(let i=0;i<ROWS*COLS;i++){if(pieces[i]&&(pieces[i].color==='b'||pieces[i].type==='knight'||pieces[i].type==='bishop'))pieces[i]=null;}
      pieces[idx(7,1)]={type:'king',color:'w',hp:5,maxHp:5};
      tileData=new Array(ROWS*COLS).fill('');
      for(let r=0;r<4;r++)for(let c=0;c<3;c++){const o=mapTheme==='desert'?'sandstone':mapTheme==='ocean'?'rocks':'tree';tileData[idx(r,c)]=o;}
      pieces[idx(4,4)]={type:'knight',color:'w',hp:4,maxHp:4};
      pieces[idx(4,3)]={type:'knight',color:'w',hp:4,maxHp:4};
      render();tutHighlightPiece(idx(4,3));
      document.getElementById('tut-title').textContent='Merge: \u2658+\u2658 \u2192 \u2656';
      document.getElementById('tut-desc').textContent='Nice work! Now combine two knights to form a Rook, a powerful piece with heavy cardinal artillery. Merge the two provided knights in adjacent tiles.';
      document.getElementById('tut-hint').textContent='\u2658+\u2658 \u2192 \u2656: Drag one knight onto the other!';
      tutWaitingForAction=true; tutActionType='merge';
      const nb=document.getElementById('tut-next');
      if(nb){nb.textContent='Skip Step \u2192';nb.style.background='';nb.style.borderColor='';nb.style.color='';nb.onclick=tutNext;}
    },
  },
  // ── ROOK ──────────────────────────────────────────────────────────────────
  {
    title:'The Rook \u2656',
    desc:'Rooks move up to 2 squares cardinally and attack up to 3 squares cardinally, piercing through pieces. Move toward the enemy at the top-right and attack it!',
    hint:'Move the rook toward the enemy, then attack.',
    action:'move',
    setup(){
      tutBoard({w:{rook:[idx(4,4)]},b:{}});
      tutAddEnemy('pawn',1,7,{stationary:true});
      render();
      tutHighlightPiece(idx(4,4));
    },
    onMove(){
      const ri=pieces.findIndex(p=>p&&p.color==='w'&&p.type==='rook');
      if(ri>=0)tutHighlightPiece(ri);
      tutContinue('attack','Line the rook up cardinally with the enemy, then drag onto it to attack!');
    },
    onAttack(){
      stopTutEnemyWander();
      document.getElementById('tut-desc').textContent='Enemy defeated! Press Next to set up the rook merge.';
      tutWaitForNext(()=>{
        for(let i=0;i<ROWS*COLS;i++){if(pieces[i]&&pieces[i].color==='b'&&pieces[i].type!=='king')pieces[i]=null;}
        for(let i=0;i<ROWS*COLS;i++){if(pieces[i]&&pieces[i].color==='w'&&pieces[i].type!=='king')pieces[i]=null;}
        pieces[idx(4,3)]={type:'rook',color:'w',hp:4,maxHp:4};
        pieces[idx(4,4)]={type:'rook',color:'w',hp:4,maxHp:4};
        // stationary enemy queen at the top edge — out of both rooks' attack range (3 cardinal),
        // but within the siege tower's 4-cardinal range once merged at (4,3)
        pieces[idx(0,3)]={type:'queen',color:'b',hp:STATS.queen.hp,maxHp:STATS.queen.maxHp,stationary:true};
        tutEnemySpawn=idx(0,3);
        render();tutHighlightPiece(idx(4,4));
        document.getElementById('tut-desc').textContent='Excellent! A distant enemy queen looms at the top edge — too far for rooks to reach. Merge the two rooks into a Siege Tower to unlock 4-tile cardinal attack range. Drag the highlighted rook onto the other rook.';
        tutContinue('merge','\u2656+\u2656 \u2192 🏰: Drag the right rook onto the left rook to form a siege tower at the left position.');
        document.getElementById('tut-title').textContent='Merge: \u2656+\u2656 \u2192 🏰';
      });
    },
    onMerge(){
      tutAutoNext(4);
    },
  },
  // ── SIEGE ─────────────────────────────────────────────────────────────────
  {
    title:'Siege Tower 🏰',
    desc:'The Siege Tower cannot move, but attacks 4 tiles cardinally — now within range of the enemy queen. Wait for the siege tower to fire at the queen, then right-click the siege tower to unsiege it back into two rooks.',
    hint:'Let the siege tower attack the queen, then right-click to unsiege.',
    action:'unsiege',
    setup(){},
    fromMerge:true,
    onUnsiege(){
      // wait for the user to press Next instead of auto-advancing
      document.getElementById('tut-desc').textContent='Nicely done! The siege tower split back into two rooks. Press Next to continue.';
      tutTaskDone();
    },
  },
  // ── QUEEN (♘+♗→♛) ─────────────────────────────────────────────────────────
  {
    title:'Merge: \u2658+\u2657 \u2192 \u265B',
    desc:'The final merge! Combine a knight and a bishop to form the Queen, then attack the enemy at the top-right with your new queen.',
    hint:'Drag the knight onto the bishop.',
    action:'merge',
    setup(){
      tutBoard({w:{knight:[idx(4,3)],bishop:[idx(4,4)]},b:{}});
      const bp=pieces[idx(4,4)];if(bp)bp.mana=1;
      tutAddEnemy('pawn',1,7);
      render();
      tutHighlightPiece(idx(4,3));
    },
    onMerge(){
      const qi=pieces.findIndex(p=>p&&p.color==='w'&&p.type==='queen');
      if(qi>=0)tutHighlightPiece(qi);
      document.getElementById('tut-desc').textContent='You summoned the Queen! Now move her toward the enemy at the top-right and attack it.';
      tutContinue('move','Move the queen toward the enemy.');
    },
    onMove(){
      const qi=pieces.findIndex(p=>p&&p.color==='w'&&p.type==='queen');
      if(qi>=0)tutHighlightPiece(qi);
      tutContinue('attack','Keep advancing, then drag the queen onto the enemy to attack!');
    },
    onAttack(){
      stopTutEnemyWander();
      tutTaskDone();
    },
  },
  // ── DONE ──────────────────────────────────────────────────────────────────
  {
    title:'Tutorial Complete! \uD83C\uDF89',
    desc:'You know all the pieces and merge chains! Build from pawns, merge up the chain, and destroy the enemy king. Good luck!',
    hint:'Press Start Playing to begin!',
    action:'done',
    setup(){},
  },
];

function tutBoard(setup){
  pieces=new Array(ROWS*COLS).fill(null);
  tileData=new Array(ROWS*COLS).fill('');
  for(let r=0;r<4;r++)for(let c=0;c<3;c++){const obsType=mapTheme==='desert'?'sandstone':mapTheme==='ocean'?'rocks':'tree';tileData[idx(r,c)]=obsType;}
  pieces[idx(7,1)]={type:'king',color:'w',hp:5,maxHp:5};
  const types=['pawn','knight','bishop','rook','queen','king'];
  ['w','b'].forEach(col=>{
    const s=setup[col]||{};
    types.forEach(t=>{
      (s[t]||[]).forEach(ti=>{
        const st=STATS[t];
        pieces[ti]={type:t,color:col,hp:st.hp,maxHp:st.maxHp};
        if(t==='bishop')pieces[ti].mana=1;
      });
    });
  });
}

function tutHighlightPiece(i){
  if(i<0)return;
  const el=sqElAt(i);if(!el)return;
  const hl=document.getElementById('tut-highlight');
  const rect=el.getBoundingClientRect();
  hl.style.left=(rect.left-3)+'px';
  hl.style.top=(rect.top-3)+'px';
  hl.style.width=(rect.width+6)+'px';
  hl.style.height=(rect.height+6)+'px';
  requestAnimationFrame(()=>tutPositionCard());
}

function tutPositionCard(){
  const card=document.getElementById('tut-card');
  if(!card)return;
  // on mobile portrait, CSS positions the card at the bottom — don't override
  const isMobilePortrait=window.innerWidth<=1024&&window.innerHeight>window.innerWidth;
  if(isMobilePortrait){
    card.style.top='';card.style.left='';card.style.bottom='';card.style.right='';
  }else{
    card.style.top='12px';card.style.left='12px';card.style.bottom='';card.style.right='';
  }
}

function tutApplyStep(){
  const step=TUTORIAL_STEPS[tutStep];
  if(!step)return;
  over=false; thinking=false; turn='w';
  spawnHistory=[]; whiteTurnCount=0; movedThisTurn=-1;
  whiteTargets={}; blackTargets={};
  stopTutEnemyWander();
  if(!tutFromAutoChain)step.setup();
  else{
    if(!pieces.find(p=>p&&p.color==='w'&&p.type==='king'))pieces[idx(7,1)]={type:'king',color:'w',hp:5,maxHp:5};
  }
  tutFromAutoChain=false;
  render();syncUI();
  document.getElementById('tut-title').textContent=step.title;
  document.getElementById('tut-desc').textContent=step.desc;
  document.getElementById('tut-hint').textContent=step.hint;
  document.getElementById('tut-step').textContent='Step '+(tutStep+1)+' / '+TUTORIAL_STEPS.length;
  const nextBtn=document.getElementById('tut-next');
  if(step.action==='done'){
    nextBtn.textContent='Start Playing!';
    nextBtn.style.display='inline-block';
    nextBtn.onclick=()=>{tutEnd();startGame('easy');};
  }else{
    nextBtn.textContent='Skip Step →';
    nextBtn.style.display='inline-block';
    nextBtn.onclick=tutNext;
  }
  requestAnimationFrame(()=>tutPositionCard());
  tutWaitingForAction=(step.action!=='done');
  tutActionType=step.action;
}

function tutTaskDone(){
  tutWaitingForAction=false;
  const nextBtn=document.getElementById('tut-next');
  if(!nextBtn)return;
  nextBtn.textContent='\u2713 Next \u2192';
  nextBtn.style.background='#1a4010';
  nextBtn.style.borderColor='#70c030';
  nextBtn.style.color='#c8f040';
  nextBtn.onclick=()=>{
    nextBtn.style.background='';nextBtn.style.borderColor='';nextBtn.style.color='';
    tutNext();
  };
}

// wait for the player to press Next, then run the callback (instead of auto-advancing)
function tutWaitForNext(cb){
  tutWaitingForAction=false;
  const nextBtn=document.getElementById('tut-next');
  if(!nextBtn){cb();return;}
  nextBtn.textContent='\u2713 Next \u2192';
  nextBtn.style.background='#1a4010';
  nextBtn.style.borderColor='#70c030';
  nextBtn.style.color='#c8f040';
  nextBtn.onclick=()=>{
    nextBtn.style.background='';nextBtn.style.borderColor='';nextBtn.style.color='';
    nextBtn.textContent='Skip Step \u2192';
    nextBtn.onclick=tutNext;
    cb();
  };
}

function startTutorial(){
  document.getElementById('intro').classList.add('hidden');
  document.getElementById('tutorial-overlay').classList.add('show');
  mapTheme='jungle'; document.body.className='theme-jungle';
  // tutorial always runs with full map visibility
  mapCheat=true;
  const mcBtn=document.getElementById('btn-mapcheat');
  if(mcBtn)mcBtn.textContent='🗺 Map Cheat: ON';
  generateMap();
  animals=[];
  animalDivs.forEach(el=>el.remove());animalDivs.clear();
  stopAnimalLoop();
  tutStep=0;
  tutApplyStep();
}

function tutRedo(){
  tutFromAutoChain=false;
  const nextBtn=document.getElementById('tut-next');
  if(nextBtn){nextBtn.textContent='Skip Step \u2192';nextBtn.style.background='';nextBtn.style.borderColor='';nextBtn.style.color='';nextBtn.onclick=tutNext;}
  tutApplyStep();
}

function tutNext(){
  tutStep=Math.min(tutStep+1,TUTORIAL_STEPS.length-1);
  // user-triggered advance always fully sets up the new step
  tutFromAutoChain=false;
  tutApplyStep();
}

function tutSkip(){
  tutEnd();
  document.getElementById('intro').classList.remove('hidden');
}

function tutEnd(){
  document.getElementById('tutorial-overlay').classList.remove('show');
  tutWaitingForAction=false;
  stopTutEnemyWander();
  over=true;
}

function tutContinue(newAction,newHint){
  tutWaitingForAction=true;tutActionType=newAction;
  if(newHint)document.getElementById('tut-hint').textContent=newHint;
  const nb=document.getElementById('tut-next');
  if(nb){nb.textContent='Skip Step \u2192';nb.style.background='';nb.style.borderColor='';nb.style.color='';nb.onclick=tutNext;}
}

function tutAutoNext(nextIdx){
  if(nextIdx==null)nextIdx=tutStep+1;
  if(nextIdx>=TUTORIAL_STEPS.length){tutTaskDone();return;}
  const nextStep=TUTORIAL_STEPS[nextIdx];
  tutStep=nextIdx;
  over=false;thinking=false;turn='w';
  spawnHistory=[];whiteTurnCount=0;movedThisTurn=-1;whiteTargets={};blackTargets={};
  stopTutEnemyWander();
  if(nextStep.fromMerge){
    tutFromAutoChain=true;
    if(!pieces.find(p=>p&&p.color==='w'&&p.type==='king'))pieces[idx(7,1)]={type:'king',color:'w',hp:5,maxHp:5};
    // if an enemy was preserved from the previous step, restore its spawn reference
    const existingEnemy=pieces.findIndex(p=>p&&p.color==='b'&&!p.stationary);
    if(existingEnemy>=0)tutEnemySpawn=existingEnemy;
  }else{
    tutFromAutoChain=false;
    nextStep.setup();
  }
  document.getElementById('tut-title').textContent=nextStep.title;
  document.getElementById('tut-desc').textContent=nextStep.desc;
  document.getElementById('tut-hint').textContent=nextStep.hint;
  document.getElementById('tut-step').textContent='Step '+(nextIdx+1)+' / '+TUTORIAL_STEPS.length;
  const nb=document.getElementById('tut-next');
  if(nextStep.action==='done'){
    nb.textContent='Start Playing!';nb.onclick=()=>{tutEnd();startGame('easy');};
  }else{
    nb.textContent='Skip Step \u2192';nb.style.background='';nb.style.borderColor='';nb.style.color='';nb.onclick=tutNext;
  }
  tutWaitingForAction=(nextStep.action!=='done');tutActionType=nextStep.action;
  const ti=pieces.findIndex(p=>p&&p.color==='w'&&p.type!=='king');
  if(ti>=0)setTimeout(()=>tutHighlightPiece(ti),100);
  render();syncUI();
}

function tutCheckAction(actionType){
  if(!tutWaitingForAction)return;
  if(tutActionType===actionType||tutActionType==='any'){
    const step=TUTORIAL_STEPS[tutStep];
    const hook='on'+actionType.charAt(0).toUpperCase()+actionType.slice(1);
    if(step&&typeof step[hook]==='function'){
      tutWaitingForAction=false;setTimeout(()=>step[hook](),500);
    }else{
      tutTaskDone();
    }
  }
}

function isTutorialActive(){return document.getElementById('tutorial-overlay')?.classList.contains('show');}
