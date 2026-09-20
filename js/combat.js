// ── ATTACK SYSTEM ────────────────────────────────────────────────────────────
function sqCenter(i){
  const b=document.getElementById('board').getBoundingClientRect();
  const sw=b.width/COLS, sh=b.height/ROWS;
  const localC=COL(i), localR=ROW(i);
  return{
    x: b.left + (localC+0.5)*sw,   // viewport X (for fixed-pos emoji)
    y: b.top  + (localR+0.5)*sh,   // viewport Y
    sx:(localC+0.5)*sw,             // SVG-local X (relative to board)
    sy:(localR+0.5)*sh              // SVG-local Y
  };
}

function emojiAnim(emoji,ax,ay,tx,ty,arc,duration,cb){
  const em=document.createElement('div');em.className='atk-emoji';em.textContent=emoji;
  em.style.position='fixed';em.style.pointerEvents='none';em.style.zIndex='600';
  em.style.fontSize=Math.max(16,Math.floor(sqPx*.5))+'px';
  em.style.transform='translate(-50%,-50%)';
  document.body.appendChild(em);
  const start=performance.now();
  const step=ts=>{
    const s=Math.min(1,(ts-start)/duration);
    const ease=s<.5?2*s*s:(4-2*s)*s-1;
    const cx=ax+(tx-ax)*ease, cy=ay+(ty-ay)*ease-Math.sin(s*Math.PI)*arc;
    em.style.left=cx+'px'; em.style.top=cy+'px';
    em.style.opacity=s<.8?'1':(1-(s-.8)/.2)+'';
    if(s<1)requestAnimationFrame(step); else{em.remove();cb();}
  };
  requestAnimationFrame(step);
}

function svgCannonball(ax,ay,tx,ty,cb){
  const svg=document.getElementById('wep-overlay');
  const flash=document.createElementNS('http://www.w3.org/2000/svg','circle');
  flash.setAttribute('cx',ax);flash.setAttribute('cy',ay);flash.setAttribute('r',sqPx*.25+'');
  flash.setAttribute('fill','#ffe060');flash.setAttribute('opacity','0.9');
  svg.appendChild(flash);
  const ball=document.createElementNS('http://www.w3.org/2000/svg','circle');
  ball.setAttribute('r',sqPx*.12+'');ball.setAttribute('fill','#808090');
  svg.appendChild(ball);
  const trail=document.createElementNS('http://www.w3.org/2000/svg','line');
  trail.setAttribute('stroke','#ffe08040');trail.setAttribute('stroke-width','3');
  svg.appendChild(trail);
  const start=performance.now();const dur=380;
  const step=ts=>{
    const s=Math.min(1,(ts-start)/dur);
    flash.setAttribute('opacity',(0.9*(1-s*4>0?1-s*4:0))+'');
    const bx=ax+(tx-ax)*s,by=ay+(ty-ay)*s-Math.sin(s*Math.PI)*sqPx*.4;
    ball.setAttribute('cx',bx);ball.setAttribute('cy',by);
    trail.setAttribute('x1',ax+(tx-ax)*Math.max(0,s-.2));
    trail.setAttribute('y1',ay+(ty-ay)*Math.max(0,s-.2)-Math.sin(Math.max(0,s-.2)*Math.PI)*sqPx*.4);
    trail.setAttribute('x2',bx);trail.setAttribute('y2',by);
    if(s<1)requestAnimationFrame(step); else{svg.removeChild(flash);svg.removeChild(ball);svg.removeChild(trail);
      const burst=document.createElementNS('http://www.w3.org/2000/svg','circle');
      burst.setAttribute('cx',tx);burst.setAttribute('cy',ty);burst.setAttribute('r','4');
      burst.setAttribute('fill','none');burst.setAttribute('stroke','#ffe060');burst.setAttribute('stroke-width','3');
      svg.appendChild(burst);
      let b=0;const bstep=()=>{b+=0.1;burst.setAttribute('r',(4+b*sqPx*.3)+'');burst.setAttribute('opacity',''+(1-b));if(b<1)requestAnimationFrame(bstep);else{svg.removeChild(burst);cb();}};
      requestAnimationFrame(bstep);
    }
  };
  requestAnimationFrame(step);
}

function attackAnim(attacker,target,type,cb){
  const a=sqCenter(attacker),t=sqCenter(target);
  if(type==='pawn'){
    // A pawn swings its sword through 120° — from over its shoulder to the follow-through — while it
    // only leans into the blow, so the swing is the blade's and not the whole pawn's. The drawing is
    // mirrored when the enemy is to the left, which keeps the sword hand leading and the shield on the
    // hand on the far side. A fortified pawn swings the same way, in its helmet (pieceArt).
    const p=pieces[attacker],art=p?pieceArt(p):'pawn',col=p?p.color:myColor();
    const flip=t.x<a.x,sz=Math.max(14,Math.floor(sqPx*.86));
    const mid='translate(-50%,-50%) ',mirror=flip?' scaleX(-1)':'';
    const box=document.createElement('div');
    box.style.cssText='position:fixed;pointer-events:none;z-index:360;left:'+a.x+'px;top:'+a.y+'px;'
      +'width:'+sz+'px;height:'+sz+'px;transform-origin:50% 80%;';
    const layer=html=>{const d=document.createElement('div');d.style.cssText='position:absolute;inset:0;';d.innerHTML=html;return d;};
    const sword=layer(pieceSword(art,col,mapTheme,sz));      // behind the pawn, as the drawing has it
    sword.style.transformOrigin=SWORD_PIVOT;
    box.appendChild(sword);
    box.appendChild(layer(pieceWithoutSword(art,col,mapTheme,sz)));
    document.body.appendChild(box);
    // the piece on the board steps aside for its swinging copy, and comes back after
    const sqEl=sqElAt(attacker),onBoard=sqEl&&sqEl.querySelector('.piece-art');
    if(onBoard)onBoard.style.opacity='0';
    const lean=(dx,dy,deg)=>mid+'translate('+dx.toFixed(1)+'px,'+dy.toFixed(1)+'px) rotate('+deg.toFixed(1)+'deg)'+mirror;
    const dx=(t.x-a.x)*.3,dy=(t.y-a.y)*.3,DUR=460;
    const done=()=>{box.remove();if(onBoard)onBoard.style.opacity='';cb();};
    box.animate([
      {transform:lean(0,0,0)},
      {transform:lean(-dx*.3,-dy*.3,-6),offset:.3},         // rock back with the wind-up
      {transform:lean(dx,dy,9),offset:.6},                  // lean into the blow
      {transform:lean(0,0,0)},
    ],{duration:DUR,easing:'ease-out'});
    // the blade: 30° back over the shoulder, then 90° forward — 120° of swing
    const anim=sword.animate([
      {transform:'rotate(0deg)'},
      {transform:'rotate(-30deg)',offset:.3},
      {transform:'rotate(90deg)',offset:.6},
      {transform:'rotate(0deg)'},
    ],{duration:DUR,easing:'ease-out'});
    if(anim&&anim.finished)anim.finished.then(done,done);else setTimeout(done,DUR);
  }else if(type==='knight'){
    const angle=Math.atan2(t.y-a.y,t.x-a.x)*(180/Math.PI);
    const em=document.createElement('div');em.className='atk-emoji';em.textContent='🗡️';
    em.style.position='fixed';em.style.pointerEvents='none';em.style.zIndex='600';
    em.style.fontSize=Math.max(18,Math.floor(sqPx*.55))+'px';
    em.style.transformOrigin='center bottom';
    document.body.appendChild(em);
    const start=performance.now();const dur=420;
    const step=ts=>{
      const s=Math.min(1,(ts-start)/dur);
      const ease=s<.5?2*s*s:(4-2*s)*s-1;
      const cx=a.x+(t.x-a.x)*ease,cy=a.y+(t.y-a.y)*ease-Math.sin(s*Math.PI)*sqPx*.5;
      const rot=angle-90+Math.sin(s*Math.PI)*120;
      em.style.left=cx+'px';em.style.top=cy+'px';
      em.style.transform='translate(-50%,-50%) rotate('+rot+'deg)';
      em.style.opacity=s<.85?'1':(1-(s-.85)/.15)+'';
      if(s<1)requestAnimationFrame(step); else{em.remove();cb();}
    };requestAnimationFrame(step);
  }else if(type==='rook'){
    svgCannonball(a.sx,a.sy,t.sx,t.sy,cb);
  }else if(type==='heal'){
    // heal sign ✚ flies from bishop to target like a projectile
    const em=document.createElement('div');em.className='atk-emoji';em.textContent='✚';
    em.style.position='fixed';em.style.pointerEvents='none';em.style.zIndex='600';
    em.style.color='#40e060';em.style.fontSize=Math.max(16,Math.floor(sqPx*.5))+'px';
    em.style.transform='translate(-50%,-50%)';
    em.style.textShadow='0 0 8px rgba(64,224,96,.8)';
    document.body.appendChild(em);
    const start=performance.now();const dur=400;
    const step=ts=>{
      const s=Math.min(1,(ts-start)/dur);
      const ease=s<.5?2*s*s:(4-2*s)*s-1;
      const cx=a.x+(t.x-a.x)*ease,cy=a.y+(t.y-a.y)*ease-Math.sin(s*Math.PI)*sqPx*.4;
      em.style.left=cx+'px';em.style.top=cy+'px';
      em.style.opacity=s<.8?'1':(1-(s-.8)/.2)+'';
      em.style.transform='translate(-50%,-50%) scale('+(1+Math.sin(s*Math.PI)*.3)+')';
      if(s<1)requestAnimationFrame(step);else{em.remove();flashSq(target,'heal-flash');cb();}
    };requestAnimationFrame(step);
  }else if(type==='bishop'){
    // green magic bolt ✦ arcing from bishop to target
    const em=document.createElement('div');em.className='atk-emoji';em.textContent='✦';
    em.style.position='fixed';em.style.pointerEvents='none';em.style.zIndex='600';
    em.style.color='#60ff80';em.style.fontSize=Math.max(18,Math.floor(sqPx*.55))+'px';
    em.style.transform='translate(-50%,-50%)';
    em.style.textShadow='0 0 10px rgba(96,255,128,.9),0 0 20px rgba(64,200,80,.5)';
    document.body.appendChild(em);
    const start=performance.now();const dur=380;
    const step=ts=>{
      const s=Math.min(1,(ts-start)/dur);
      const ease=s<.5?2*s*s:(4-2*s)*s-1;
      const cx=a.x+(t.x-a.x)*ease,cy=a.y+(t.y-a.y)*ease-Math.sin(s*Math.PI)*sqPx*.5;
      em.style.left=cx+'px';em.style.top=cy+'px';
      em.style.opacity=s<.85?'1':(1-(s-.85)/.15)+'';
      em.style.transform='translate(-50%,-50%) scale('+(1+Math.sin(s*Math.PI)*.4)+') rotate('+(s*360)+'deg)';
      if(s<1)requestAnimationFrame(step);else{em.remove();cb();}
    };requestAnimationFrame(step);
  }else if(type==='queen'){
    // lightning ⚡ flying from queen to target
    const em=document.createElement('div');em.className='atk-emoji';em.textContent='⚡';
    em.style.position='fixed';em.style.pointerEvents='none';em.style.zIndex='600';
    em.style.color='#ffe040';em.style.fontSize=Math.max(18,Math.floor(sqPx*.55))+'px';
    em.style.transform='translate(-50%,-50%)';
    em.style.textShadow='0 0 10px rgba(255,224,64,.9),0 0 20px rgba(255,200,40,.5)';
    document.body.appendChild(em);
    const start=performance.now();const dur=300;
    const step=ts=>{
      const s=Math.min(1,(ts-start)/dur);
      const ease=s<.3?s/.3:1;
      const cx=a.x+(t.x-a.x)*ease,cy=a.y+(t.y-a.y)*ease;
      em.style.left=cx+'px';em.style.top=cy+'px';
      em.style.opacity=s<.8?'1':(1-(s-.8)/.2)+'';
      em.style.transform='translate(-50%,-50%) scale('+(1.2-s*.4)+')';
      if(s<1)requestAnimationFrame(step);else{em.remove();cb();}
    };requestAnimationFrame(step);
  }else if(type==='mage'){
    // a violet spark flying straight from the Mage to its target
    const em=document.createElement('div');em.className='atk-emoji';em.textContent='\u2726';
    em.style.position='fixed';em.style.pointerEvents='none';em.style.zIndex='600';
    em.style.color='#E6B8FF';em.style.fontSize=Math.max(18,Math.floor(sqPx*.55))+'px';
    em.style.transform='translate(-50%,-50%)';
    em.style.textShadow='0 0 10px rgba(190,120,255,.95),0 0 22px rgba(150,80,255,.6)';
    document.body.appendChild(em);
    const start=performance.now();const dur=340;
    const step=ts=>{
      const s=Math.min(1,(ts-start)/dur);
      const ease=s<.35?s/.35:1;
      em.style.left=(a.x+(t.x-a.x)*ease)+'px';em.style.top=(a.y+(t.y-a.y)*ease)+'px';
      em.style.opacity=s<.8?'1':(1-(s-.8)/.2)+'';
      em.style.transform='translate(-50%,-50%) scale('+(1.3-s*.5)+') rotate('+(s*220)+'deg)';
      if(s<1)requestAnimationFrame(step);else{em.remove();cb();}
    };requestAnimationFrame(step);
  }else if(type==='siege'){
    // siege: cannonball same as rook
    svgCannonball(a.sx,a.sy,t.sx,t.sy,cb);
  }else if(type==='king'){
    emojiAnim('👑',a.x,a.y,t.x,t.y,sqPx*.3,400,cb);
  }else{
    flashSq(attacker,'hit-flash');setTimeout(cb,300);
  }
}

function computeActions(color){
  const enemy=color==='w'?'b':'w';
  const targets=color==='w'?whiteTargets:blackTargets;
  const actions=[];
  const targeted=new Set();
  for(let i=0;i<ROWS*COLS;i++){
    const p=pieces[i];if(!p||p.color!==color)continue;
    if(p.type==='bishop'){
      const bRange=bishopRange(i);
      const tgt=targets[i];
      // heal only when the player explicitly locks a heal target (no auto-heal)
      let healI=-1;
      if(tgt!==undefined&&pieces[tgt]&&pieces[tgt].color===color&&pieces[tgt].hp<pieces[tgt].maxHp&&bRange.includes(tgt)){
        healI=tgt;
      }else if(tgt!==undefined){
        // stale heal target (moved out of range or gone) — clear it
        if(color==='w')delete whiteTargets[i];else delete blackTargets[i];
      }
      if(healI>=0&&(pieces[i].mana||0)>0){actions.push({attacker:i,target:healI,action:'heal'});}
      else{
        let bEnemies=bishopRange(i).filter(j=>pieces[j]&&pieces[j].color===enemy);
        // fog of war: the local player cannot attack fogged enemies
        if(color===myColor()&&!mapCheat)bEnemies=bEnemies.filter(j=>isTileVisible(j));
        // undergrowth: enemies hidden in cover can't be hit (either side)
        bEnemies=bEnemies.filter(j=>!isConcealedFrom(j,color));
        if(bEnemies.length){
          bEnemies.sort((a,b)=>{const pa=pieces[a],pb=pieces[b];if(pa.type==='king')return -1;if(pb.type==='king')return 1;return pa.hp-pb.hp;});
          actions.push({attacker:i,target:bEnemies[0],action:'attack'});
        }
      }
    }else{
      const range=p.type==='queen'?queenRange(i):p.type==='mage'?mageRange(i):p.type==='siege'?siegeRange(i):p.type==='rook'?rookRange(i):p.type==='knight'?kJumps(i):p.type==='bishop'?bishopRange(i):adj8(i);
      let enemies=range.filter(j=>pieces[j]&&pieces[j].color===enemy);
      if(color===myColor()&&!mapCheat)enemies=enemies.filter(j=>isTileVisible(j));
      enemies=enemies.filter(j=>!isConcealedFrom(j,color));
      if(!enemies.length)continue;
      const manualTgt=targets[i];
      let tgtI;
      if(manualTgt!==undefined&&pieces[manualTgt]&&pieces[manualTgt].color===enemy&&range.includes(manualTgt)&&!isConcealedFrom(manualTgt,color)){
        tgtI=manualTgt;
      }else{
        const sorted=[...enemies].sort((a,b)=>{const pa=pieces[a],pb=pieces[b];if(pa.type==='king')return -1;if(pb.type==='king')return 1;if(!targeted.has(a)&&targeted.has(b))return -1;if(targeted.has(a)&&!targeted.has(b))return 1;return pa.hp-pb.hp;});
        tgtI=sorted[0];
      }
      targeted.add(tgtI);
      actions.push({attacker:i,target:tgtI,action:'attack'});
    }
  }
  return actions;
}

function executeActions(actions,color,cb){
  if(!actions.length){cb();return;}
  const svg=document.getElementById('atk-overlay');svg.innerHTML='';
  const stroke=color==='w'?'#c8e840':'#e05820';
  const defs=document.createElementNS('http://www.w3.org/2000/svg','defs');
  const mk=document.createElementNS('http://www.w3.org/2000/svg','marker');
  mk.setAttribute('id','ah-'+color);mk.setAttribute('markerWidth','6');mk.setAttribute('markerHeight','6');
  mk.setAttribute('refX','5');mk.setAttribute('refY','3');mk.setAttribute('orient','auto');
  const poly=document.createElementNS('http://www.w3.org/2000/svg','polygon');
  poly.setAttribute('points','0 0,6 3,0 6');poly.setAttribute('fill',stroke);mk.appendChild(poly);defs.appendChild(mk);svg.appendChild(defs);
  actions.forEach(({attacker,target,action})=>{
    const a=sqCenter(attacker),t=sqCenter(target);
    if(action==='heal'){
      const circ=document.createElementNS('http://www.w3.org/2000/svg','circle');
      circ.setAttribute('cx',t.sx);circ.setAttribute('cy',t.sy);circ.setAttribute('r',sqPx*.3+'');
      circ.setAttribute('stroke','#40e060');circ.setAttribute('stroke-width','2');circ.setAttribute('fill','none');circ.setAttribute('opacity','0.85');
      svg.appendChild(circ);
    }else{
      const dx=t.sx-a.sx,dy=t.sy-a.sy,len=Math.hypot(dx,dy),pad=len>0?12/len:0;
      const line=document.createElementNS('http://www.w3.org/2000/svg','line');
      line.setAttribute('x1',a.sx+dx*.22);line.setAttribute('y1',a.sy+dy*.22);
      line.setAttribute('x2',t.sx-dx*pad);line.setAttribute('y2',t.sy-dy*pad);
      line.setAttribute('stroke',stroke);line.setAttribute('stroke-width','2.5');
      line.setAttribute('stroke-opacity','0.88');line.setAttribute('marker-end','url(#ah-'+color+')');
      svg.appendChild(line);
    }
  });
  const animActions=actions.filter(a=>a.action==='attack'||a.action==='heal');
  if(!animActions.length){
    setTimeout(()=>{svg.innerHTML='';applyActions(actions,color);cb();},400);
    return;
  }
  let pending=animActions.length;let fired=false;
  const done=()=>{
    pending--;
    if(pending<=0&&!fired){fired=true;svg.innerHTML='';applyActions(actions,color);cb();}
  };
  animActions.forEach(({attacker,target,action})=>{
    const type=action==='heal'?'heal':(pieces[attacker]?.type||'pawn');
    setTimeout(()=>attackAnim(attacker,target,type,done),80);
  });
  setTimeout(()=>{if(!fired){fired=true;svg.innerHTML='';applyActions(actions,color);cb();}},1500);
}

// ── DEATH ANIMATION ──────────────────────────────────────────────────────────
function showDeath(sqIdx, color, type){
  if(campaignLevel&&color===myColor())campaignLost++;
  const el=sqElAt(sqIdx);if(!el)return;
  const rect=el.getBoundingClientRect();
  const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
  const fs=Math.max(16,Math.floor(sqPx*.65))+'px';
  const burst=document.createElement('div');
  burst.className='death-burst';
  burst.style.cssText='position:fixed;pointer-events:none;z-index:799;left:'+cx+'px;top:'+cy+'px;width:'+sqPx+'px;height:'+sqPx+'px;border-radius:50%;border:3px solid '+(color==='w'?'rgba(255,255,200,.7)':'rgba(255,100,30,.7)')+';';
  burst.style.animation='burstAnim .5s ease-out forwards';
  document.body.appendChild(burst);
  const d=document.createElement('div');
  d.className='death-piece';
  d.style.cssText='position:fixed;pointer-events:none;z-index:800;left:'+cx+'px;top:'+cy+'px;font-size:'+fs+';color:'+(color==='w'?'#fff':'#1a0e04')+';text-shadow:0 0 8px '+(color==='w'?'rgba(255,255,200,.9)':'rgba(255,100,30,.9)')+';';
  d.innerHTML=pieceSVG(type,color,mapTheme,Math.max(16,Math.floor(sqPx*.86)));
  document.body.appendChild(d);
  setTimeout(()=>{burst.remove();d.remove();},700);
}

function applyActions(actions,color){
  const enemy=color==='w'?'b':'w';
  const msgs=[];
  actions.forEach(({attacker,target,action})=>{
    if(over)return;
    if(action==='heal'){
      const t=pieces[target];if(!t||t.color!==color)return;
      t.hp=Math.min(t.maxHp,t.hp+2);flashSq(target,'heal-flash');SFX.heal();
      const bp=pieces[attacker];if(bp&&bp.type==='bishop'){bp.mana=Math.max(0,(bp.mana||0)-1);bp.lastHealTurn=whiteTurnCount;}
      msgs.push('healed '+t.type+'@'+sqName(target)+' '+t.hp+'HP');
    }else{
      const t=pieces[target];
      if(!t){return;}
      if(t.color!==enemy)return;
      // siege tower deals 2 damage per hit; all other pieces deal 1
      const ap=pieces[attacker];
      const dmg=(ap&&ap.type==='siege')?2:1;
      t.hp-=dmg;flashSq(target,'hit-flash');
      if(t.fortified)t.lastHitTurn=whiteTurnCount;   // its armour mends from here (turnUpkeep)
      if(campaignLevel&&t.color===myColor()&&t.type==='king')campaignKingHit=true;
      // track hits on black pieces for reactive AI
      if(color==='w'&&t.color==='b'&&t.hp>0)blackHitBy.push({target,attacker});
      if(t.hp<=0){
        showDeath(target,t.color,t.type);SFX.fall(t.type);
        pieces[target]=null;
        msgs.push(t.type+'@'+sqName(target)+' ✕');
        if(campaignLevel){const cr=checkCampaignWin();if(cr)over=true;}
        else if(t.type==='king'){over=true;}
      }else msgs.push(t.type+'@'+sqName(target)+' '+t.hp+'HP');
    }
  });
  if(msgs.length)addLog((color==='w'?'W':'B')+': '+msgs.join(', '));
  render();
}
