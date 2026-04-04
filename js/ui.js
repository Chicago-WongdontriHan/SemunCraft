// ── UI ───────────────────────────────────────────────────────────────────────
function setStatus(t){document.getElementById('status').textContent=t;}
function addLog(msg){logLines.push(msg);if(logLines.length>4)logLines.shift();document.getElementById('log').textContent=logLines.join(' · ');}

function syncUI(){
  const locked=over||thinking||!isMyTurn();
  ['spawn','merge','target','skip'].forEach(id=>{const b=document.getElementById('btn-'+id);if(b)b.disabled=locked;});
  document.getElementById('btn-new').disabled=false;
  const tb=document.getElementById('btn-target');
  if(tb){tb.classList.toggle('active-mode',targetMode);}
  const spawnBtn=document.getElementById('btn-spawn');
  if(spawnBtn){
    const rem=spawnRemaining();
    const turnsToNext=6-(whiteTurnCount%6)||6;
    spawnBtn.textContent='Spawn ('+rem+') (+1 in '+turnsToNext+'t)';
    if(!locked&&rem<=0)spawnBtn.disabled=true;
  }
}

function showMoveHint(){
  const hb=document.getElementById('hint-box');
  if(!hb)return;
  if(difficulty!=='easy'||over||thinking||!isMyTurn()){hb.style.display='none';return;}
  const mc=myColor();
  const bp2=[];for(let i=0;i<ROWS*COLS;i++){const p=pieces[i];if(p&&p.color===mc)bp2.push({i,p});}
  let hint='';
  // check merges
  for(const {i,p} of bp2){
    const d=getDragDests(i);
    if(d.merge.size){const t=[...d.merge][0];hint=p.type+' at '+sqName(i)+' can merge with '+pieces[t].type+' at '+sqName(t);break;}
  }
  // check attacks
  if(!hint){
    for(const {i,p} of bp2){
      const d=getDragDests(i);
      if(d.attack.size){const t=[...d.attack][0];hint=p.type+' at '+sqName(i)+' can attack '+pieces[t].type+' at '+sqName(t);break;}
    }
  }
  // suggest pawn move toward enemy king
  if(!hint){
    const eki=pieces.findIndex(p=>p&&p.color!==mc&&p.type==='king');
    const pawns=bp2.filter(({p})=>p.type==='pawn');
    if(pawns.length&&eki>=0){
      const best=pawns.reduce((a,b)=>cheb(a.i,eki)<cheb(b.i,eki)?a:b);
      const d=getDragDests(best.i);
      if(d.move.size){const mv=[...d.move].reduce((a,b)=>cheb(a,eki)<cheb(b,eki)?a:b);hint='Move pawn at '+sqName(best.i)+' toward enemy';}
    }
  }
  if(!hint&&spawnRemaining()>0)hint='Spawn a pawn next to your King';
  if(!hint)hint='Skip turn';
  hb.textContent='Hint: '+hint;
  hb.style.display='block';
}

// ── PIECE CARD PAGINATION ─────────────────────────────────────────────────────
function renderPcCards(){
  const wrap=document.getElementById('pc-cards-wrap');
  if(!wrap)return;
  wrap.innerHTML='';
  const total=Math.ceil(PC_DATA.length/PC_PER_PAGE);
  const start=pcPageIdx*PC_PER_PAGE;
  const slice=PC_DATA.slice(start,start+PC_PER_PAGE);
  slice.forEach((d,i)=>{
    if(i>0){const div=document.createElement('div');div.className='tier-divider';wrap.appendChild(div);}
    const card=document.createElement('div');card.className='piece-card';
    card.innerHTML='<div class="piece-card-row"><span class="pc-glyph pc-glyph-w">'+d.gw+'</span><span class="pc-glyph pc-glyph-b">'+d.gb+'</span></div>'
      +'<div class="pc-name">'+d.name+'</div><div class="pc-stats">'+d.stats+'</div>';
    wrap.appendChild(card);
  });
  const lbl=document.getElementById('pc-page-label');
  if(lbl)lbl.textContent=(pcPageIdx+1)+'/'+total;
  const prev=document.getElementById('pc-prev'),next=document.getElementById('pc-next');
  if(prev)prev.style.opacity=pcPageIdx===0?'.3':'1';
  if(next)next.style.opacity=pcPageIdx>=total-1?'.3':'1';
  // re-apply current pf scaling
  const lp=document.getElementById('left-panel');
  if(lp&&window.lastPf){
    const pf=window.lastPf;
    lp.querySelectorAll('.pc-glyph').forEach(el=>el.style.fontSize=Math.max(11,Math.floor(pf*1.8))+'px');
    lp.querySelectorAll('.pc-name').forEach(el=>el.style.fontSize=Math.max(7,Math.floor(pf*.92))+'px');
    lp.querySelectorAll('.pc-stats').forEach(el=>el.style.fontSize=Math.max(5,Math.floor(pf*.65))+'px');
  }
}

function pcPage(dir){
  const total=Math.ceil(PC_DATA.length/PC_PER_PAGE);
  pcPageIdx=Math.max(0,Math.min(total-1,pcPageIdx+dir));
  renderPcCards();
}

// ── INTRO ────────────────────────────────────────────────────────────────────
function showDiff(){
  document.getElementById('diff-row').style.display='flex';
}

function showGameOver(result){
  const el=document.getElementById('game-over');
  const title=document.getElementById('go-title');
  const sub=document.getElementById('go-sub');
  if(!el)return;
  title.className='';
  if(result==='win'){title.textContent='You Win!';title.classList.add('win');sub.textContent='Victory — your kingdom prevails';}
  else if(result==='lose'){title.textContent='You Lose';title.classList.add('lose');sub.textContent='Defeat — your king has fallen';}
  else{title.textContent='Draw';title.classList.add('draw');sub.textContent='';}
  el.classList.add('show');
}

function hideGameOver(){
  const el=document.getElementById('game-over');
  if(el)el.classList.remove('show');
}

function doRematch(){
  hideGameOver();
  initGame();
}

function goIntro(){
  document.getElementById('intro').classList.remove('hidden');
  document.getElementById('diff-row').style.display='none';
  over=true; thinking=false;
  stopAnimalLoop();
  document.querySelectorAll('.animal-el').forEach(el=>el.remove());
  document.getElementById('thinking-dot').classList.remove('on');
  generateMap();
  titleTileData=tileData.slice();
  titleAnimals=animals.map(a=>({...a}));
  animals=[];
  render();
}
