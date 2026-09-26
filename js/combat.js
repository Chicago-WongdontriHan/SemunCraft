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

// the Guardian's shot: a spiked iron ball, same flight as the siege's cannonball but with a small
// spark drawn at every square along the way where the path damage in js/actions.js above will land
// a single flame, two layered teardrops (a wider orange one, a slimmer yellow one inside it), scaled
// and faded by the caller — the building block svgFireLine uses to raise its wall of fire
function svgFlameShape(svg,size){
  const g=document.createElementNS('http://www.w3.org/2000/svg','g');
  const petal=(r,fill)=>{
    const p=document.createElementNS('http://www.w3.org/2000/svg','path');
    p.setAttribute('d','M0,'+(size*r*.62)+' C '+(-size*r*.55)+','+(size*r*.11)+' '+(-size*r*.24)+','+(-size*r*.7)+' 0,'+(-size*r)
      +' C '+(size*r*.24)+','+(-size*r*.7)+' '+(size*r*.55)+','+(size*r*.11)+' 0,'+(size*r*.62)+' Z');
    p.setAttribute('fill',fill);
    g.appendChild(p);
  };
  petal(1,'#FF7A2E');petal(.6,'#FFD060');
  g.setAttribute('opacity','0');
  svg.appendChild(g);
  return g;
}
// The Mage's fire trajectory: a wall of flame that catches all along the line it was cast on, tile by
// tile from the caster outward, and holds a beat before dying down — not a single flash at the far
// end. The whole line is what was cast, whether or not anything is standing there.
function svgFireLine(ax,ay,pts,cb){
  const svg=document.getElementById('wep-overlay');
  SFX.scry();
  const all=[{sx:ax,sy:ay},...pts];
  const glow=document.createElementNS('http://www.w3.org/2000/svg','polyline');
  glow.setAttribute('points',all.map(p=>p.sx+','+p.sy).join(' '));
  glow.setAttribute('fill','none');glow.setAttribute('stroke','#FF7A2E');
  glow.setAttribute('stroke-width',(sqPx*.5)+'');glow.setAttribute('stroke-linecap','round');
  glow.setAttribute('stroke-linejoin','round');glow.setAttribute('opacity','0');
  svg.appendChild(glow);
  const step0=110,ignite=100,hold=420,fade=220;
  const flames=[];
  pts.forEach((p,ti)=>{
    [-1,1].forEach((side,k)=>{
      const el=svgFlameShape(svg,sqPx*.4);
      flames.push({el,cx:p.sx+side*sqPx*.15,cy:p.sy,delay:ti*step0+k*25});
    });
  });
  const start=performance.now();
  const total=(pts.length-1)*step0+25+ignite+hold+fade;
  const stepFn=ts=>{
    const t=ts-start;
    glow.setAttribute('opacity',''+Math.min(.5,t/120*.5));
    flames.forEach(({el,cx,cy,delay})=>{
      const lt=t-delay;
      let op=0,sc=.3;
      if(lt<0){op=0;sc=.3;}
      else if(lt<ignite){const k=lt/ignite;op=k;sc=.3+.8*k;}
      else if(lt<ignite+hold){op=1;sc=1.05+Math.sin((lt-ignite)/60)*.06;}
      else{const k=Math.min(1,(lt-ignite-hold)/fade);op=1-k;sc=1.05-.3*k;}
      el.setAttribute('transform','translate('+cx+','+cy+') scale('+sc.toFixed(3)+')');
      el.setAttribute('opacity',op.toFixed(3));
    });
    if(t<total)requestAnimationFrame(stepFn);
    else{svg.removeChild(glow);flames.forEach(({el})=>svg.removeChild(el));cb();}
  };
  requestAnimationFrame(stepFn);
}
// The meteor landing: four burning stones fall out of the top of the frame, one over each of the
// tiles it was cast on, and burst together where they land. Fire-and-forget, like an ordered piece's
// own slide — the strike itself already happened by the time this is called (runMeteors in js/game.js).
function meteorStrikeAnim(tiles){
  const svg=document.getElementById('wep-overlay');
  if(!svg||!tiles||!tiles.length)return;
  const pts=tiles.map(j=>sqCenter(j));
  const top=Math.min(...pts.map(p=>p.sy))-sqPx*3;
  const rocks=pts.map(p=>{
    const g=document.createElementNS('http://www.w3.org/2000/svg','g');
    const body=document.createElementNS('http://www.w3.org/2000/svg','circle');
    body.setAttribute('r',sqPx*.16+'');body.setAttribute('fill','#5A3018');body.setAttribute('stroke','#FF7A2E');body.setAttribute('stroke-width','2');
    const tail=document.createElementNS('http://www.w3.org/2000/svg','line');
    tail.setAttribute('stroke','#FFB04090');tail.setAttribute('stroke-width','5');tail.setAttribute('stroke-linecap','round');
    g.appendChild(tail);g.appendChild(body);svg.appendChild(g);
    return{g,tail,p};
  });
  const start=performance.now(),dur=380;
  SFX.attack();
  const step=ts=>{
    const s=Math.min(1,(ts-start)/dur),ease=s*s;
    rocks.forEach(({g,tail,p})=>{
      const y=top+(p.sy-top)*ease;
      g.setAttribute('transform','translate('+p.sx+','+y+')');
      tail.setAttribute('x1',0);tail.setAttribute('y1',(top-y));tail.setAttribute('x2',0);tail.setAttribute('y2',-sqPx*.3);
    });
    if(s<1){requestAnimationFrame(step);return;}
    rocks.forEach(({g})=>svg.removeChild(g));
    // one shared fire burst over the whole 2x2, not one per tile
    const cx=pts.reduce((a,p)=>a+p.sx,0)/pts.length,cy=pts.reduce((a,p)=>a+p.sy,0)/pts.length;
    const burst=document.createElementNS('http://www.w3.org/2000/svg','circle');
    burst.setAttribute('cx',cx);burst.setAttribute('cy',cy);burst.setAttribute('r','6');
    burst.setAttribute('fill','#FFB040');burst.setAttribute('opacity','.85');
    svg.appendChild(burst);
    let b=0;const bstep=()=>{b+=0.06;burst.setAttribute('r',(6+b*sqPx*1.3)+'');burst.setAttribute('opacity',''+(0.85*(1-b)));
      if(b<1)requestAnimationFrame(bstep);else svg.removeChild(burst);};
    requestAnimationFrame(bstep);
  };
  requestAnimationFrame(step);
}
function svgSpikedBall(ax,ay,tx,ty,sparks,cb){
  const svg=document.getElementById('wep-overlay');
  const NS='http://www.w3.org/2000/svg',el=(tag,attrs)=>{const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]+'');return e;};
  // a big iron ball, most of a third of a square across, with eight conical spikes standing off it:
  // the spikes go down first so the ball's own rim covers their bases, then a glint on top
  const ball=el('g',{}),R=sqPx*.17,tip=R+sqPx*.14,half=sqPx*.065,line=Math.max(1.4,sqPx*.022);
  for(let k=0;k<8;k++){
    const a=(k*45+22.5)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),b=R*.8;
    ball.appendChild(el('polygon',{points:[c*b-s*half,s*b+c*half,c*tip,s*tip,c*b+s*half,s*b-c*half].map(v=>v.toFixed(2)).join(' '),
      fill:'#A4A4B2',stroke:'#1E1E26','stroke-width':line,'stroke-linejoin':'round'}));
  }
  ball.appendChild(el('circle',{r:R,fill:'#5E5E6A',stroke:'#1E1E26','stroke-width':line*1.3}));
  ball.appendChild(el('ellipse',{cx:-R*.34,cy:-R*.36,rx:R*.34,ry:R*.24,fill:'#fff',opacity:.35,transform:'rotate(-35 '+(-R*.34)+' '+(-R*.36)+')'}));
  svg.appendChild(ball);
  const trail=el('line',{stroke:'#9A9AA640','stroke-width':Math.max(3,sqPx*.09),'stroke-linecap':'round'});
  svg.insertBefore(trail,ball);   // the trail runs under the ball
  const start=performance.now(),dur=420,dist=Math.hypot(tx-ax,ty-ay);
  const sparked=new Set();
  const step=ts=>{
    const s=Math.min(1,(ts-start)/dur);
    const bx=ax+(tx-ax)*s,by=ay+(ty-ay)*s;
    ball.setAttribute('transform','translate('+bx+','+by+') rotate('+(s*280)+')');
    trail.setAttribute('x1',ax);trail.setAttribute('y1',ay);trail.setAttribute('x2',bx);trail.setAttribute('y2',by);
    (sparks||[]).forEach((sp,k)=>{
      if(sparked.has(k))return;
      const sd=Math.hypot(sp.sx-ax,sp.sy-ay);
      if(sd<=dist*s+2){
        sparked.add(k);
        const fl=document.createElementNS('http://www.w3.org/2000/svg','circle');
        fl.setAttribute('cx',sp.sx);fl.setAttribute('cy',sp.sy);fl.setAttribute('r',sqPx*.08+'');
        fl.setAttribute('fill','#ffd060');svg.appendChild(fl);
        setTimeout(()=>fl.remove(),160);
      }
    });
    if(s<1)requestAnimationFrame(step);
    else{
      svg.removeChild(ball);svg.removeChild(trail);
      const burst=document.createElementNS('http://www.w3.org/2000/svg','circle');
      burst.setAttribute('cx',tx);burst.setAttribute('cy',ty);burst.setAttribute('r','4');
      burst.setAttribute('fill','none');burst.setAttribute('stroke','#c8c8d0');burst.setAttribute('stroke-width','3');
      svg.appendChild(burst);
      let b=0;const bstep=()=>{b+=0.1;burst.setAttribute('r',(4+b*sqPx*.5)+'');burst.setAttribute('opacity',''+(1-b));if(b<1)requestAnimationFrame(bstep);else{svg.removeChild(burst);cb();}};
      requestAnimationFrame(bstep);
    }
  };
  requestAnimationFrame(step);
}
// The Siege's shot: a flaming shell lobbed in a high arc, its fire streaming back along the way it flies
// and shedding embers, that bursts into flame on the square it hits — and the fire runs out from there to
// the eight squares around it, the ones its splash catches (siegeSplash), straight neighbours a beat
// ahead of the corners. Each catches, burns a moment and dies down. `spread` is those squares' centres.
// The blow is handed on (cb) once the fire has reached them, so the damage lands while they burn; the
// flames finish by themselves after.
function svgFireShell(ax,ay,tx,ty,spread,cb){
  const svg=document.getElementById('wep-overlay');
  const NS='http://www.w3.org/2000/svg',el=(tag,attrs)=>{const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]+'');return e;};
  const flash=el('circle',{cx:ax,cy:ay,r:sqPx*.28,fill:'#FFC040',opacity:.9});svg.appendChild(flash);
  // the shell: its fire tail first (svgFlameShape, turned to stream back along the flight), then the
  // burning ball, white-hot in the middle
  const shell=el('g',{}),tail=svgFlameShape(svg,sqPx*.36);
  tail.setAttribute('opacity','1');shell.appendChild(tail);
  shell.appendChild(el('circle',{r:sqPx*.14,fill:'#FF8A2A',stroke:'#8A2A0A','stroke-width':Math.max(1.5,sqPx*.025)}));
  shell.appendChild(el('circle',{r:sqPx*.07,fill:'#FFF1A8'}));
  svg.appendChild(shell);
  const embers=[],arc=sqPx*.55,DUR=400;
  const pos=s=>[ax+(tx-ax)*s,ay+(ty-ay)*s-Math.sin(s*Math.PI)*arc];
  const start=performance.now();let frame=0;
  const fly=ts=>{
    const s=Math.min(1,(ts-start)/DUR),[x,y]=pos(s),[x2,y2]=pos(Math.min(1,s+.02));
    flash.setAttribute('opacity',''+Math.max(0,.9*(1-s*4)));
    const ang=Math.atan2(y2-y,x2-x)*180/Math.PI;          // the way it is flying
    const flick=1.45+Math.sin(ts/35)*.18;
    shell.setAttribute('transform','translate('+x.toFixed(1)+','+y.toFixed(1)+')');
    tail.setAttribute('transform','rotate('+(ang-90).toFixed(1)+') scale(1,'+flick.toFixed(2)+')');   // the flame's tip streams back
    if(frame++%2===0){const e=el('circle',{cx:x,cy:y,r:sqPx*.045,fill:'#FFB040',opacity:.9});svg.insertBefore(e,shell);embers.push({e,t:ts});}
    embers.forEach(m=>{const k=(ts-m.t)/260;m.e.setAttribute('opacity',''+Math.max(0,.9*(1-k)));m.e.setAttribute('r',''+(sqPx*.045*(1-k*.6)));});
    if(s<1){requestAnimationFrame(fly);return;}
    svg.removeChild(flash);svg.removeChild(shell);
    burn(ts);
  };
  const burn=t0=>{
    SFX.attack();
    embers.forEach(m=>m.e.remove());
    const blast=el('circle',{cx:tx,cy:ty,r:6,fill:'#FFB040',opacity:.85});svg.appendChild(blast);
    // the flames: one big one where it hit, then one travelling out to each square around it
    const fires=[{el:svgFlameShape(svg,sqPx*.5),fx:tx,fy:ty,sx:tx,sy:ty,delay:0,travel:0}];
    (spread||[]).forEach(p=>{
      const diag=p.sx!==tx&&p.sy!==ty;
      fires.push({el:svgFlameShape(svg,sqPx*.4),fx:p.sx,fy:p.sy,sx:tx,sy:ty,delay:diag?70:20,travel:150});
    });
    const IGN=90,HOLD=300,FADE=200;
    let handed=false;const hand=()=>{if(!handed){handed=true;cb();}};
    const total=70+150+IGN+HOLD+FADE;
    const tick=ts=>{
      const t=ts-t0;
      const bk=Math.min(1,t/260);
      blast.setAttribute('r',''+(6+bk*sqPx*.7));blast.setAttribute('opacity',''+(.85*(1-bk)));
      fires.forEach(f=>{
        const lt=t-f.delay;let op=0,sc=.3,x=f.fx,y=f.fy;
        if(lt<0){op=0;}
        else if(lt<f.travel){const k=lt/f.travel;x=f.sx+(f.fx-f.sx)*k;y=f.sy+(f.fy-f.sy)*k;op=.9;sc=.35+.35*k;}   // running out along the ground
        else{
          const bt=lt-f.travel;
          if(bt<IGN){const k=bt/IGN;op=.9+.1*k;sc=.7+.4*k;}
          else if(bt<IGN+HOLD){op=1;sc=1.1+Math.sin((bt-IGN)/55)*.07;}
          else{const k=Math.min(1,(bt-IGN-HOLD)/FADE);op=1-k;sc=1.1-.35*k;}
        }
        f.el.setAttribute('transform','translate('+x.toFixed(1)+','+(y+sqPx*.08).toFixed(1)+') scale('+sc.toFixed(3)+')');
        f.el.setAttribute('opacity',op.toFixed(3));
      });
      if(t>=70+150+IGN)hand();                   // the fire has reached every square around it
      if(t<total)requestAnimationFrame(tick);
      else{blast.remove();fires.forEach(f=>f.el.remove());hand();}
    };
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(fly);
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
  if(fastPlay()){if(cb)cb();return;}      // at speed the blow lands without being drawn
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
    const fx=t.x-a.x,fy=t.y-a.y,DUR=500;
    const done=()=>{box.remove();if(onBoard)onBoard.style.opacity='';cb();};
    SFX.swing();   // the rush of the blade, timed to the strike below
    // the pawn goes with its sword: it steps back as the blade lifts, drives forward through the blow,
    // holds there a moment, then comes back to its square — the same keyframes as the blade below
    box.animate([
      {transform:lean(0,0,0),easing:'ease-out'},
      {transform:lean(-fx*.24,-fy*.24,-11),offset:.3,easing:'ease-in'},
      {transform:lean(fx*.44,fy*.44,13),offset:.6},
      {transform:lean(fx*.4,fy*.4,11),offset:.74,easing:'ease-out'},
      {transform:lean(0,0,0)},
    ],{duration:DUR});
    // the blade: 30° back over the shoulder, then 90° forward — 120° of swing
    const anim=sword.animate([
      {transform:'rotate(0deg)',easing:'ease-out'},
      {transform:'rotate(-30deg)',offset:.3,easing:'ease-in'},
      {transform:'rotate(90deg)',offset:.6},
      {transform:'rotate(86deg)',offset:.74,easing:'ease-out'},
      {transform:'rotate(0deg)'},
    ],{duration:DUR});
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
    // the fire trajectory it just cast: the whole line it falls on, not only the tile that was aimed at
    const line=sangLineFor(attacker,target)||[target];
    svgFireLine(a.sx,a.sy,line.map(j=>sqCenter(j)),cb);
  }else if(type==='guardian'){
    // on a cardinal hit the ball flies clear to the farthest tile it can reach, not just to the target
    // (an L-jump hit has no such path, and the ball simply stops at its one target)
    const path=cardinalPath(attacker,target);
    const sparks=(path||[]).map(j=>sqCenter(j));
    const end=sparks.length?sparks[sparks.length-1]:t;
    SFX.attack();
    svgSpikedBall(a.sx,a.sy,end.sx,end.sy,sparks,cb);
  }else if(type==='siege'){
    // the siege: a flaming shell, and fire spreading over the 3x3 its splash catches (svgFireShell)
    svgFireShell(a.sx,a.sy,t.sx,t.sy,adj8(target).map(j=>sqCenter(j)),cb);
  }else if(type==='king'){
    emojiAnim('👑',a.x,a.y,t.x,t.y,sqPx*.3,400,cb);
  }else{
    flashSq(attacker,'hit-flash');setTimeout(cb,300);
  }
}

function computeActions(color){
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
        let bEnemies=bishopRange(i).filter(j=>isFoe(pieces[j],color));
        // fog of war: the local player cannot attack fogged enemies
        if(color===myColor()&&!mapCheat)bEnemies=bEnemies.filter(j=>isTileVisible(j));
        else if(aiSightLimited(color))bEnemies=bEnemies.filter(j=>visibleTo(j,color));   // the AI sees no farther than you would
        // undergrowth: enemies hidden in cover can't be hit (either side)
        bEnemies=bEnemies.filter(j=>!isConcealedFrom(j,color));
        if(bEnemies.length){
          bEnemies.sort((a,b)=>{const pa=pieces[a],pb=pieces[b];if(pa.type==='king')return -1;if(pb.type==='king')return 1;return pa.hp-pb.hp;});
          actions.push({attacker:i,target:bEnemies[0],action:'attack'});
        }
      }
    }else{
      const range=p.type==='queen'?queenRange(i):p.type==='mage'?mageRange(i):p.type==='siege'?siegeRange(i):p.type==='rook'?rookRange(i):p.type==='guardian'?guardianRange(i):(p.type==='knight'||p.type==='paladin')?kJumps(i):p.type==='bishop'?bishopRange(i):adj8(i);
      let enemies=range.filter(j=>isFoe(pieces[j],color));
      // fog of war: not for the Mage, whose own fire lights its trajectory as it burns down it
      if(p.type!=='mage'&&color===myColor()&&!mapCheat)enemies=enemies.filter(j=>isTileVisible(j));
      else if(p.type!=='mage'&&aiSightLimited(color))enemies=enemies.filter(j=>visibleTo(j,color));
      enemies=enemies.filter(j=>!isConcealedFrom(j,color));
      const manualTgt=targets[i];
      const locked=manualTgt!==undefined&&isFoe(pieces[manualTgt],color)&&range.includes(manualTgt)&&!isConcealedFrom(manualTgt,color)
        &&(!aiSightLimited(color)||p.type==='mage'||visibleTo(manualTgt,color));
      // the Paladin's lance always kills, so it fires only on a target the player locked themselves
      // (dragged onto, or right-clicked) — never one it picked on its own, the way every other piece does
      if(p.type==='paladin'&&!locked)continue;
      if(!enemies.length)continue;
      let tgtI;
      if(locked){
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

// the Paladin's leap: the same arc a knight's move draws, timed to land as the target falls
function paladinLeapAnim(from,to,color,cb){
  animatePieceMove(from,to,'paladin',color,color==='b',cb,260);
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
    const ap=pieces[attacker];
    // (a Scarecrow never falls, so there is no square to leap to: the lance simply strikes it, below)
    if(action==='attack'&&ap&&ap.type==='paladin'&&!(pieces[target]&&pieces[target].type==='scarecrow')){
      // its lance always lands: the leap plays out over the strike, and both finish together
      setTimeout(()=>attackAnim(attacker,target,'paladin',()=>{}),80);
      setTimeout(()=>paladinLeapAnim(attacker,target,ap.color,done),80);
      return;
    }
    const type=action==='heal'?'heal':(ap?.type||'pawn');
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

// ── THE SCARECROW (training ground) ─────────────────────────────────────────
// Every hit it takes floats up off it as a number, a few at once fanned out side by side, and the log
// line says what it took, where that left it, and its running total (standUp in js/constants.js).
const dmgPopCount={};
function dmgPop(i,dmg){
  const el=sqElAt(i);if(!el)return;
  const r=el.getBoundingClientRect(),n=dmgPopCount[i]=(dmgPopCount[i]||0)+1;
  setTimeout(()=>{if(!--dmgPopCount[i])delete dmgPopCount[i];},400);
  const d=document.createElement('div');d.className='dmg-pop';d.textContent='\u2212'+dmg;
  d.style.left=(r.left+r.width/2+((n-1)%3-1)*r.width*.28)+'px';d.style.top=(r.top+r.height*.4)+'px';
  d.style.fontSize=Math.max(14,Math.floor(sqPx*.42))+'px';d.style.animationDelay=((n-1)*.12)+'s';
  document.body.appendChild(d);setTimeout(()=>d.remove(),1100+n*120);
}
function scarecrowHit(i,t,dmg,stood){
  dmgPop(i,dmg);
  if(stood)flashSq(i,'heal-flash');
  return 'scarecrow@'+sqName(i)+' \u2212'+dmg+(stood?', knocked down \u2192 back up at '+t.hp+'HP':' \u2192 '+t.hp+'HP')+' ('+t.taken+' taken)';
}

// The Siege's shell bursts where it lands: the square it hit takes its 2, and every piece on the eight
// squares around that one takes 1 as well — friend, foe or neither alike, the whole 3x3 caught. (The
// tower never fires at a square beside it, so it is never inside its own burst.) Returns the log notes.
// (siegeSplash in js/engine.js mirrors it; applyActions and runOrders in js/game.js call it.)
function siegeSplash(attacker,target,color){
  const notes=[];
  for(const j of adj8(target)){
    if(over)continue;
    const q=pieces[j];if(!q)continue;
    q.hp-=1;flashSq(j,'hit-flash');
    const qs=standUp(q,1);
    if(q.fortified)q.lastHitTurn=whiteTurnCount;
    q.exposedAt=j;
    if(color==='w'&&q.color==='b'&&q.hp>0)blackHitBy.push({target:j,attacker});
    if(q.hp<=0){
      showDeath(j,q.color,q.type);SFX.fall(q.type);
      pieces[j]=null;
      notes.push(q.type+'@'+sqName(j)+' \u2715 (splash)');
      if(campaignLevel){const cr=checkCampaignWin();if(cr)over=true;}
      else if(q.type==='king')over=true;
    }else notes.push((q.type==='scarecrow'?scarecrowHit(j,q,1,qs):q.type+'@'+sqName(j)+' '+q.hp+'HP')+' (splash)');
  }
  return notes;
}

function applyActions(actions,color){
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
      if(!isFoe(t,color))return;
      // siege tower deals 2 damage per hit, all other pieces deal 1 — except the Paladin, whose
      // lance always finishes the kill outright, whatever the target's remaining HP
      const ap=pieces[attacker];
      const dmg=(ap&&ap.type==='siege')?2:(ap&&ap.type==='paladin')?t.hp:1;
      t.hp-=dmg;flashSq(target,'hit-flash');
      const stood=standUp(t,dmg);   // the Scarecrow never falls: at 0 it is back up at full health
      if(t.fortified)t.lastHitTurn=whiteTurnCount;   // its armour mends from here (turnUpkeep)
      // fighting from or into undergrowth reveals a piece for as long as it stays on that square
      // (inCover in movement.js); harmless to stamp when the square isn't undergrowth at all
      if(ap)ap.exposedAt=attacker;
      t.exposedAt=target;
      if(campaignLevel&&t.color===myColor()&&t.type==='king')campaignKingHit=true;
      // track hits on black pieces for reactive AI
      if(color==='w'&&t.color==='b'&&t.hp>0)blackHitBy.push({target,attacker});
      if(t.hp<=0){
        showDeath(target,t.color,t.type);SFX.fall(t.type);
        pieces[target]=null;
        // the Paladin leaps onto the square it just cleared
        if(ap&&ap.type==='paladin'){pieces[attacker]=null;pieces[target]=ap;}
        msgs.push(t.type+'@'+sqName(target)+' ✕');
        if(campaignLevel){const cr=checkCampaignWin();if(cr)over=true;}
        else if(t.type==='king'){over=true;}
      }else msgs.push(t.type==='scarecrow'?scarecrowHit(target,t,dmg,stood):t.type+'@'+sqName(target)+' '+t.hp+'HP');
      // the Mage's fire burns down the whole line it was aimed into, not only the one tile struck —
      // every other enemy on that same trajectory takes 1 too; a friend on it is left untouched
      if(ap&&ap.type==='mage'){
        const line=sangLineFor(attacker,target);
        flareTiles.push({tiles:line||[target],turns:1,color});   // the line stays lit a turn, no more damage
        if(line)for(const j of line){
          if(j===target||over)continue;
          const q=pieces[j];if(!isFoe(q,color))continue;
          q.hp-=1;flashSq(j,'hit-flash');
          const qs=standUp(q,1);
          if(q.fortified)q.lastHitTurn=whiteTurnCount;
          q.exposedAt=j;
          if(color==='w'&&q.hp>0)blackHitBy.push({target:j,attacker});
          if(q.hp<=0){
            showDeath(j,q.color,q.type);SFX.fall(q.type);
            pieces[j]=null;
            msgs.push(q.type+'@'+sqName(j)+' ✕ (caught in the fire)');
            if(campaignLevel){const cr=checkCampaignWin();if(cr)over=true;}
            else if(q.type==='king'){over=true;}
          }else msgs.push((q.type==='scarecrow'?scarecrowHit(j,q,1,qs):q.type+'@'+sqName(j)+' '+q.hp+'HP')+' (caught in the fire)');
        }
      }
      // the Guardian's shot flies on past the target, along the same straight line, damaging every
      // other enemy in its path (never a piece of its own, which the shot simply passes over)
      if(ap&&ap.type==='guardian'){
        const path=cardinalPath(attacker,target);
        if(path)for(const j of path){
          if(j===target||over)continue;
          const q=pieces[j];if(!isFoe(q,color))continue;
          q.hp-=1;flashSq(j,'hit-flash');
          const qs=standUp(q,1);
          if(q.fortified)q.lastHitTurn=whiteTurnCount;
          q.exposedAt=j;
          if(color==='w'&&q.hp>0)blackHitBy.push({target:j,attacker});
          if(q.hp<=0){
            showDeath(j,q.color,q.type);SFX.fall(q.type);
            pieces[j]=null;
            msgs.push(q.type+'@'+sqName(j)+' ✕ (in its path)');
            if(campaignLevel){const cr=checkCampaignWin();if(cr)over=true;}
            else if(q.type==='king'){over=true;}
          }else msgs.push((q.type==='scarecrow'?scarecrowHit(j,q,1,qs):q.type+'@'+sqName(j)+' '+q.hp+'HP')+' (in its path)');
        }
      }
      // the Siege's shell bursts over the 3x3 around the square it hit (siegeSplash)
      if(ap&&ap.type==='siege'&&!over)msgs.push(...siegeSplash(attacker,target,color));
    }
  });
  if(msgs.length)addLog((color==='w'?'W':'B')+': '+msgs.join(', '));
  render();
}
