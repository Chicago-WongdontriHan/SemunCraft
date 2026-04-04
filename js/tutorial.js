// ── TUTORIAL ─────────────────────────────────────────────────────────────────
let tutStep=0;
let tutWaitingForAction=false;
let tutActionType='';
let tutFromAutoChain=false;
let tutActionTarget=-1;

const TUTORIAL_STEPS=[
  // ── PAWN + MERGE ──────────────────────────────────────────────────────────
  {
    title:'The Pawn \u2659',
    desc:'Pawns move to any adjacent tile (8 directions, 1 step) and attack the same way. First move your pawn, then attack the enemy that appears.',
    hint:'Drag the pawn one step in any direction.',
    action:'move',
    setup(){ tutBoard({w:{pawn:[idx(4,4)]},b:{}}); tutHighlightPiece(idx(4,4)); },
    onMove(){
      const pi=pieces.findIndex(p=>p&&p.color==='w'&&p.type==='pawn');
      if(pi>=0){
        const adj=adj8(pi).filter(j=>!pieces[j]&&!isTileBlocked(j));
        if(adj.length)pieces[adj[0]]={type:'pawn',color:'b',hp:1,maxHp:1};
        render();tutHighlightPiece(pi);
      }
      tutContinue('attack','Now drag your pawn onto the enemy!');
    },
    onAttack(){
      for(let i=0;i<ROWS*COLS;i++){if(pieces[i]&&pieces[i].color==='b'&&pieces[i].type!=='king')pieces[i]=null;}
      for(let i=0;i<ROWS*COLS;i++){if(pieces[i]&&pieces[i].color==='w'&&pieces[i].type==='pawn')pieces[i]=null;}
      const cR=Math.floor(ROWS/2),cC=Math.floor(COLS/2);
      const c1=idx(cR,cC),c2=idx(cR,cC+1);
      pieces[c1]={type:'pawn',color:'w',hp:1,maxHp:1};
      pieces[c2]={type:'pawn',color:'w',hp:1,maxHp:1};
      render();tutHighlightPiece(c1);
      tutContinue('merge','\u2659+\u2659 \u2192 \u2658: Drag your pawn onto the other pawn to merge!');
      document.getElementById('tut-title').textContent='Merge: \u2659+\u2659 \u2192 \u2658';
    },
    onMerge(){
      tutAutoNext(1);
    },
  },
  // ── KNIGHT ────────────────────────────────────────────────────────────────
  {
    title:'The Knight \u2658',
    desc:'Knights move in an L-shape: 2 squares one way, 1 square perpendicular, jumping over pieces. Move the knight, then attack the enemy that appears.',
    hint:'Jump the knight to an L-shaped square.',
    action:'move',
    setup(){ tutBoard({w:{knight:[idx(4,4)]},b:{}}); tutHighlightPiece(idx(4,4)); },
    fromMerge:true,
    onMove(){
      const ki=pieces.findIndex(p=>p&&p.color==='w'&&p.type==='knight');
      if(ki>=0){
        const tgts=kJumps(ki).filter(j=>!pieces[j]&&!isTileBlocked(j));
        if(tgts.length)pieces[tgts[0]]={type:'pawn',color:'b',hp:1,maxHp:1};
        render();tutHighlightPiece(ki);
      }
      tutContinue('attack','Now drag the knight onto the enemy!');
    },
    onAttack(){
      for(let i=0;i<ROWS*COLS;i++){if(pieces[i]&&pieces[i].color!=='w'||pieces[i]&&pieces[i].type==='king'?false:pieces[i]&&pieces[i].color==='b')pieces[i]=null;}
      for(let i=0;i<ROWS*COLS;i++){if(pieces[i]&&pieces[i].color==='w'&&pieces[i].type!=='king')pieces[i]=null;}
      pieces[idx(4,4)]={type:'knight',color:'w',hp:4,maxHp:4};
      pieces[idx(4,3)]={type:'pawn',color:'w',hp:1,maxHp:1};
      render();tutHighlightPiece(idx(4,3));
      tutContinue('merge','\u2659+\u2658 \u2192 \u2657: Drag the pawn onto the knight!');
      document.getElementById('tut-title').textContent='Merge: \u2659+\u2658 \u2192 \u2657';
    },
    onMerge(){
      document.getElementById('tut-title').textContent='The Bishop \u2657';
      document.getElementById('tut-desc').textContent='Bishops move diagonally up to 2 squares (or 1 cardinally). They attack diagonally and heal allies using mana (blue dots). Move the bishop, then attack, then heal!';
      document.getElementById('tut-hint').textContent='Drag the bishop diagonally 1 or 2 squares.';
      tutAutoNext(2);
    },
  },
  // ── BISHOP ────────────────────────────────────────────────────────────────
  {
    title:'The Bishop \u2657',
    desc:'Bishops move diagonally up to 2 squares (or 1 cardinally). They attack diagonally and heal allies using mana (blue dots). Move the bishop, then attack, then heal!',
    hint:'Drag the bishop diagonally 1 or 2 squares.',
    action:'move',
    setup(){
      tutBoard({w:{bishop:[idx(4,4)]},b:{}});
      const bp=pieces[idx(4,4)];if(bp)bp.mana=2;
      tutHighlightPiece(idx(4,4));
    },
    fromMerge:true,
    onMove(){
      const bi=pieces.findIndex(p=>p&&p.color==='w'&&p.type==='bishop');
      if(bi>=0){
        const diag=[[-2,-2],[-2,2],[2,-2],[2,2],[-1,-1],[-1,1],[1,-1],[1,1]]
          .map(([dr,dc])=>idx(ROW(bi)+dr,COL(bi)+dc))
          .filter(j=>inB(ROW(j),COL(j))&&!pieces[j]&&!isTileBlocked(j));
        if(diag.length)pieces[diag[0]]={type:'pawn',color:'b',hp:1,maxHp:1};
        render();tutHighlightPiece(bi);
      }
      tutContinue('attack','Now drag the bishop diagonally onto the enemy!');
    },
    onAttack(){
      const step=TUTORIAL_STEPS[tutStep];
      if(step&&step._healPhase){
        tutWaitingForAction=true; tutActionType='attack';
        return;
      }
      for(let i=0;i<ROWS*COLS;i++){if(pieces[i]&&pieces[i].color==='b'&&pieces[i].type!=='king')pieces[i]=null;}
      const bi=pieces.findIndex(p=>p&&p.color==='w'&&p.type==='bishop');
      if(bi>=0){const bp=pieces[bi];if(bp)bp.mana=2;}
      const wKn=idx(4,4);
      const eKn=idx(2,3);
      for(let i=0;i<ROWS*COLS;i++){if(pieces[i]&&pieces[i].color==='w'&&pieces[i].type!=='king'&&pieces[i].type!=='bishop')pieces[i]=null;}
      pieces[wKn]={type:'knight',color:'w',hp:2,maxHp:4};
      pieces[eKn]={type:'knight',color:'b',hp:4,maxHp:4};
      render();
      if(bi>=0)tutHighlightPiece(bi);
      document.getElementById('tut-desc').textContent='Your knight is wounded (2/4 HP)! Drag the bishop onto the wounded knight to heal it. Each heal costs 1 mana and restores 1 HP.';
      tutContinue('heal','Drag the bishop onto the wounded white knight!');
      document.getElementById('tut-title').textContent='Bishop Heals \u2657';
    },
    onHeal(){
      const bi=pieces.findIndex(p=>p&&p.color==='w'&&p.type==='bishop');
      const manaLeft=bi>=0?(pieces[bi].mana||0):0;
      const wKn=pieces.findIndex(p=>p&&p.color==='w'&&p.type==='knight');
      if(wKn>=0){render();tutHighlightPiece(wKn);}
      if(manaLeft>0){
        document.getElementById('tut-desc').textContent='The knight gained 1 HP! Bishop still has '+manaLeft+' mana — you can heal again, or attack the enemy knight with your knight.';
        document.getElementById('tut-hint').textContent='Heal again or attack the enemy knight!';
      }else{
        document.getElementById('tut-desc').textContent='The knight is healed by 1 HP! The bishop is now out of mana — it will recover 1 mana every 3 turns. Now attack the enemy knight with your knight to finish the fight!';
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
      document.getElementById('tut-desc').textContent='Merge two adjacent knights to form a Rook — heavy artillery with long cardinal range.';
      document.getElementById('tut-hint').textContent='\u2658+\u2658 \u2192 \u2656: Drag one knight onto the other!';
      tutWaitingForAction=true; tutActionType='merge';
      const nb=document.getElementById('tut-next');
      if(nb){nb.textContent='Skip Step \u2192';nb.style.background='';nb.style.borderColor='';nb.style.color='';nb.onclick=tutNext;}
    },
  },
  // ── ROOK ──────────────────────────────────────────────────────────────────
  {
    title:'The Rook \u2656',
    desc:'Rooks move up to 2 squares cardinally and attack up to 3 squares cardinally, piercing through pieces. Move the rook, then set up a siege!',
    hint:'Move the rook toward the enemy pawn.',
    action:'move',
    setup(){
      tutBoard({w:{rook:[idx(4,2)]},b:{pawn:[idx(4,6)]}});
      tutHighlightPiece(idx(4,2));
    },
    fromMerge:true,
    onMove(){
      const ri=pieces.findIndex(p=>p&&p.color==='w'&&p.type==='rook');
      if(ri>=0){
        const adjr=adj8(ri).filter(j=>!pieces[j]&&!isTileBlocked(j));
        if(adjr.length)pieces[adjr[0]]={type:'rook',color:'w',hp:4,maxHp:4};
        render();tutHighlightPiece(ri);
      }
      tutContinue('merge','\u2656+\u2656 \u2192 \u2694: Drag one rook onto the other!');
      document.getElementById('tut-title').textContent='Merge: \u2656+\u2656 \u2192 \u2694';
    },
    onMerge(){
      tutAutoNext(4);
    },
  },
  // ── SIEGE ─────────────────────────────────────────────────────────────────
  {
    title:'Siege Tower \u2694',
    desc:'The Siege Tower cannot move, but attacks 4 squares cardinally with 3 damage — devastating. Right-click to unsiege it back into two rooks.',
    hint:'Right-click the siege tower to unsiege.',
    action:'unsiege',
    setup(){},
    fromMerge:true,
    onUnsiege(){
      tutAutoNext(5);
    },
  },
  // ── QUEEN (♘+♗→♛) ─────────────────────────────────────────────────────────
  {
    title:'Merge: \u2658+\u2657 \u2192 \u265B',
    desc:'A Knight and Bishop merge into the Queen — the most versatile piece, attacking in all directions up to 2 squares (except L-shapes). Drag the knight onto the bishop.',
    hint:'Drag the knight onto the bishop.',
    action:'merge',
    setup(){
      tutBoard({w:{knight:[idx(4,3)],bishop:[idx(4,4)]},b:{}});
      const bp=pieces[idx(4,4)];if(bp)bp.mana=1;
      tutHighlightPiece(idx(4,3));
    },
  },
  // ── KING & SPAWN ──────────────────────────────────────────────────────────
  {
    title:'King \u2654 & Spawning',
    desc:'Your King spawns new pawns from adjacent squares. Click the king to enter spawn mode, then click an adjacent empty square.',
    hint:'Click the king, then click an adjacent empty square.',
    action:'spawn',
    setup(){
      tutBoard({w:{},b:{}});
      const ki=pieces.findIndex(p=>p&&p.color==='w'&&p.type==='king');
      tutHighlightPiece(ki);
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
  card.style.top='12px';
  card.style.left='12px';
  card.style.bottom='';
  card.style.right='';
}

function tutApplyStep(){
  const step=TUTORIAL_STEPS[tutStep];
  if(!step)return;
  over=false; thinking=false; turn='w';
  spawnHistory=[]; whiteTurnCount=0; movedThisTurn=-1;
  whiteTargets={}; blackTargets={};
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

function startTutorial(){
  document.getElementById('intro').classList.add('hidden');
  document.getElementById('tutorial-overlay').classList.add('show');
  mapTheme='jungle'; document.body.className='theme-jungle';
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
  tutApplyStep();
}

function tutSkip(){
  tutEnd();
  document.getElementById('intro').classList.remove('hidden');
}

function tutEnd(){
  document.getElementById('tutorial-overlay').classList.remove('show');
  tutWaitingForAction=false;
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
  if(nextStep.fromMerge){
    tutFromAutoChain=true;
    if(!pieces.find(p=>p&&p.color==='w'&&p.type==='king'))pieces[idx(7,1)]={type:'king',color:'w',hp:5,maxHp:5};
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
