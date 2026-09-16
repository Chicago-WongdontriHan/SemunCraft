// Draws the title-screen wallpapers from the game's own pieces and board stickers:
//   img/title-wide.svg  Battle Lines — two armies face off under their castles (landscape screens)
//   img/title-tall.svg  The Clash    — the armies meet mid-battle (portrait screens)
// Run: node img/make-title-wallpapers.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..');
const ctx={console};vm.createContext(ctx);
for(const f of ['pieces/pieces.js','pieces/forest.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),ctx,{filename:f});
vm.runInContext(fs.readFileSync(path.join(ROOT,'js/scenery.js'),'utf8')+';this.__T=TERRAIN_ART;',ctx);
// the combined units (Guardian, Paladin, Mage) are designs drawn by pieces/combined/make.js
const {unitMarkup,BOX}=require(path.join(ROOT,'pieces/combined/make.js'));
const UNIT_NAMES={guardian:'Guardian',paladin:'Paladin',mage:'Mage'};
const n2=v=>(+(+v).toFixed(1)).toString();

// ── drawing helpers ──────────────────────────────────────────────────────────
function makeScene(){
  const defs=new Map();
  // a piece stands with its feet at (gx, gy); size is its art box, as on the board
  const piece=(type,color,gx,gy,size,flip)=>{
    if(UNIT_NAMES[type])return unit(UNIT_NAMES[type],color,gx,gy,size,flip);
    const id='p-'+type+color;
    if(!defs.has(id))defs.set(id,'<g id="'+id+'">'+ctx.pieceSVG(type,color,'forest',100).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'')+'</g>');
    const x=gx-size/2,y=gy-.86*size,k=size/100;
    return '<use href="#'+id+'" transform="translate('+n2(flip?x+size:x)+','+n2(y)+') scale('+(flip?-k:k).toFixed(4)+','+k.toFixed(4)+')"/>';
  };
  // a combined unit lives in a 120-unit square where a normal piece's box is drawn BOX.scale times
  const unit=(name,color,gx,gy,size,flip)=>{
    const id='u-'+name+color;
    if(!defs.has(id))defs.set(id,'<g id="'+id+'">'+unitMarkup(name,color,'forest')+'</g>');
    const k=size/(100*BOX.scale),y=gy-BOX.feet*k;
    return '<use href="#'+id+'" transform="translate('+n2(flip?gx+BOX.mid*k:gx-BOX.mid*k)+','+n2(y)+') scale('+(flip?-k:k).toFixed(4)+','+k.toFixed(4)+')"/>';
  };
  return{defs,piece};
}
const blob=(cs,fill,ink,ow)=>cs.map(([x,y,r])=>'<circle cx="'+n2(x)+'" cy="'+n2(y)+'" r="'+n2(r+ow)+'" fill="'+ink+'"/>').join('')
  +cs.map(([x,y,r])=>'<circle cx="'+n2(x)+'" cy="'+n2(y)+'" r="'+n2(r)+'" fill="'+fill+'"/>').join('');
const cloud=(x,y,s)=>blob([[x,y,s*.5],[x+s*.55,y-s*.22,s*.6],[x+s*1.15,y,s*.48],[x+s*.55,y+s*.12,s*.5]],'#fff','#5E7C8A',Math.max(2,s*.07));
const puff=(x,y,s)=>blob([[x,y,s*.42],[x+s*.42,y-s*.18,s*.5],[x+s*.9,y,s*.4],[x+s*.45,y+s*.14,s*.42]],'#F2EFE8','#7A746A',Math.max(1.5,s*.06));

// a rolling hill across the width; surface(x) gives its top at x, so things can stand on it
function hill(W,H,y,amp,phase,fill,ink,lw){
  const seg=(W+40)/8,top=k=>y-amp*Math.sin((k+1)/8*Math.PI*1.3+phase);
  let d='M-20 '+n2(H+20)+' L-20 '+n2(y);
  for(let k=0;k<8;k++){
    const x0=-20+k*seg,yc=y-amp*Math.sin((k+.5)/8*Math.PI*1.3+phase)-amp*.25;
    d+=' Q'+n2(x0+seg/2)+' '+n2(yc)+' '+n2(x0+seg)+' '+n2(top(k));
  }
  const path='<path d="'+d+' L'+n2(W+20)+' '+n2(H+20)+' Z" fill="'+fill+'" stroke="'+ink+'" stroke-width="'+lw+'" stroke-linejoin="round"/>';
  const surface=x=>{
    const k=Math.max(0,Math.min(7,Math.floor((x+20)/seg))),t=(x+20-k*seg)/seg;
    const y0=k===0?y:top(k-1),yc=y-amp*Math.sin((k+.5)/8*Math.PI*1.3+phase)-amp*.25,y2=top(k);
    return (1-t)*(1-t)*y0+2*(1-t)*t*yc+t*t*y2;
  };
  return{path,surface};
}
const tower=(x,base,w,h,fill,ink,lw,win)=>{
  const top=base-h,m=w*.25,g=w*.125,cr=w*.22;
  let s='<path d="M'+n2(x)+' '+n2(base)+' V'+n2(top)+' h'+n2(m)+' v'+n2(cr)+' h'+n2(g)+' v'+n2(-cr)+' h'+n2(m)+' v'+n2(cr)+' h'+n2(g)+' v'+n2(-cr)+' h'+n2(m)+' V'+n2(base)+' Z" fill="'+fill+'" stroke="'+ink+'" stroke-width="'+lw+'" stroke-linejoin="round"/>';
  const ww=w*.22,wh=h*.16,wx=x+w/2-ww/2,wy=top+h*.34;
  s+='<path d="M'+n2(wx)+' '+n2(wy+wh)+' V'+n2(wy+ww/2)+' A'+n2(ww/2)+' '+n2(ww/2)+' 0 0 1 '+n2(wx+ww)+' '+n2(wy+ww/2)+' V'+n2(wy+wh)+' Z" fill="'+win+'" stroke="'+ink+'" stroke-width="'+n2(lw*.6)+'"/>';
  return s;
};
const flag=(x,y,h,color,ink,lw)=>'<path d="M'+n2(x)+' '+n2(y)+' V'+n2(y-h)+'" stroke="'+ink+'" stroke-width="'+n2(lw)+'" stroke-linecap="round"/>'
  +'<path d="M'+n2(x)+' '+n2(y-h)+' L'+n2(x+h*.55)+' '+n2(y-h*.8)+' L'+n2(x)+' '+n2(y-h*.6)+' Z" fill="'+color+'" stroke="'+ink+'" stroke-width="'+n2(lw*.8)+'" stroke-linejoin="round"/>';
// a castle standing on a hill: its base goes to the lowest point of the ground under it, so it never floats;
// ruler(x, feetY, size), if given, draws who stands on the centre tower's roof in place of its flag
function castle(cx,w,ground,fill,ink,lw,win,banner,ruler){
  let base=0;for(let k=0;k<=8;k++)base=Math.max(base,ground(cx-w/2+w*k/8));
  base+=w*.03;
  const tw=w*.2,th=w*.5,wallH=th*.62;
  let s='<path d="M'+n2(cx-w/2+tw/2)+' '+n2(base)+' V'+n2(base-wallH)+' H'+n2(cx+w/2-tw/2)+' V'+n2(base)+' Z" fill="'+fill+'" stroke="'+ink+'" stroke-width="'+lw+'"/>';
  const merl=8,mw=(w-tw)/(merl*2-1);
  for(let k=0;k<merl;k++)s+='<rect x="'+n2(cx-w/2+tw/2+k*2*mw)+'" y="'+n2(base-wallH-mw*.8)+'" width="'+n2(mw)+'" height="'+n2(mw*.8+lw)+'" fill="'+fill+'" stroke="'+ink+'" stroke-width="'+lw+'"/>';
  const gw=w*.14,gh=wallH*.62;
  s+='<path d="M'+n2(cx-gw/2)+' '+n2(base)+' V'+n2(base-gh+gw/2)+' A'+n2(gw/2)+' '+n2(gw/2)+' 0 0 1 '+n2(cx+gw/2)+' '+n2(base-gh+gw/2)+' V'+n2(base)+' Z" fill="#3A2A1A" stroke="'+ink+'" stroke-width="'+lw+'"/>';
  s+=tower(cx-w/2,base,tw,th,fill,ink,lw,win)+tower(cx+w/2-tw,base,tw,th,fill,ink,lw,win)+tower(cx-tw/2,base-wallH*.35,tw,th*1.05,fill,ink,lw,win);
  s+=flag(cx-w/2+tw/2,base-th,w*.16,banner,ink,lw*.8)+flag(cx+w/2-tw/2,base-th,w*.16,banner,ink,lw*.8)
    +(ruler?ruler(cx,base-wallH*.35-th*1.05+tw*.2,tw*1.6):flag(cx,base-wallH*.35-th*1.05,w*.2,banner,ink,lw*.8));
  return s;
}
const burst=(x,y,s)=>{let d='';for(let k=0;k<16;k++){const a=k*Math.PI/8,rr=k%2?s*.45:s;d+=(k?'L':'M')+n2(x+rr*Math.cos(a))+' '+n2(y+rr*Math.sin(a));}
  return '<path d="'+d+'Z" fill="#FFD84D" stroke="#8A4A10" stroke-width="'+n2(Math.max(1.5,s*.12))+'" stroke-linejoin="round"/>';};
const shot=(x1,y1,x2,y2,h,s)=>'<path d="M'+n2(x1)+' '+n2(y1)+' Q'+n2((x1+x2)/2)+' '+n2(Math.min(y1,y2)-h)+' '+n2(x2)+' '+n2(y2)+'" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="'+n2(s*.22)+'" stroke-dasharray="'+n2(s*.5)+' '+n2(s*.45)+'" stroke-linecap="round"/>'
  +'<circle cx="'+n2(x2)+'" cy="'+n2(y2)+'" r="'+n2(s*.5)+'" fill="#3A3A44" stroke="#15151A" stroke-width="'+n2(s*.16)+'"/>'
  +'<circle cx="'+n2(x2-s*.16)+'" cy="'+n2(y2-s*.16)+'" r="'+n2(s*.14)+'" fill="#9A9AA8"/>';
const spear=(x,y,len,ang,s)=>{const t=ang*Math.PI/180,hx=x+Math.cos(t)*len,hy=y+Math.sin(t)*len,px=-Math.sin(t)*s*.35,py=Math.cos(t)*s*.35;
  return '<path d="M'+n2(x)+' '+n2(y)+' L'+n2(hx)+' '+n2(hy)+'" stroke="#3A2614" stroke-width="'+n2(s*.34)+'" stroke-linecap="round"/>'
    +'<path d="M'+n2(x)+' '+n2(y)+' L'+n2(hx)+' '+n2(hy)+'" stroke="#B07A40" stroke-width="'+n2(s*.16)+'" stroke-linecap="round"/>'
    +'<path d="M'+n2(hx+Math.cos(t)*s*.7)+' '+n2(hy+Math.sin(t)*s*.7)+' L'+n2(hx+px)+' '+n2(hy+py)+' L'+n2(hx-px)+' '+n2(hy-py)+' Z" fill="#DDE3EA" stroke="#3A2614" stroke-width="'+n2(s*.12)+'" stroke-linejoin="round"/>';};
const rng=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const lerpHex=(a,b,t)=>{const pa=[1,3,5].map(i=>parseInt(a.slice(i,i+2),16)),pb=[1,3,5].map(i=>parseInt(b.slice(i,i+2),16));
  return '#'+pa.map((v,i)=>Math.round(v+(pb[i]-v)*t).toString(16).padStart(2,'0')).join('');};

// ── the battlefield: a checkerboard that rolls with the ground ───────────────
// Squares shrink toward a vanishing point above the horizon, and every row of squares bends with the
// same gentle waves, so the board follows the terrain. A piece stands on one square, sized to it.
//   backY  where the field meets the far hill      By  the front row's lower edge (just off screen)
//   vy     vanishing height                        Wb  square width at By
//   a      square depth as a share of its width    A, lambda, phase  the waves (A at the front)
function battlefield(W,H,o){
  const Vx=W/2,depth=y=>(y-o.vy)/(o.By-o.vy);
  const wave=(x,y)=>y+o.A*depth(y)*Math.sin(2*Math.PI*x/o.lambda+o.phase);
  const ys=[o.By];
  while(ys[ys.length-1]>o.backY)ys.push(ys[ys.length-1]-o.a*o.Wb*depth(ys[ys.length-1]));
  ys.reverse();
  const rows=ys.length-1,J=Math.ceil(W/2/(o.Wb*depth(ys[0])))+2;
  const P=(j,y)=>{const x=Vx+j*o.Wb*depth(y);return [x,wave(x,y)];};
  // an edge along a row's curve, as a quadratic through the curve's midpoint
  const edge=(a,b,y)=>{const mx=(a[0]+b[0])/2,my=wave(mx,y);return n2(mx)+' '+n2(2*my-(a[1]+b[1])/2)+' '+n2(b[0])+' '+n2(b[1]);};
  let svg='';const tiles=[];
  for(let k=0;k<rows;k++){
    const t=rows>1?k/(rows-1):1,light=lerpHex(o.farLight,o.nearLight,t),dark=lerpHex(o.farDark,o.nearDark,t);
    for(let j=-J;j<J;j++){
      const A=P(j,ys[k]),B=P(j+1,ys[k]),C=P(j+1,ys[k+1]),D=P(j,ys[k+1]);
      if(Math.max(B[0],C[0])<-10||Math.min(A[0],D[0])>W+10)continue;
      const fill=((j+k)%2+2)%2?dark:light;
      // a hairline of the square's own colour closes the seams between neighbours
      svg+='<path d="M'+n2(A[0])+' '+n2(A[1])+' Q'+edge(A,B,ys[k])+' L'+n2(C[0])+' '+n2(C[1])+' Q'+edge(C,D,ys[k+1])+' Z" fill="'+fill+'" stroke="'+fill+'" stroke-width="1"/>';
      tiles.push({j,k,rows,cx:(A[0]+B[0]+C[0]+D[0])/4,cy:(A[1]+B[1]+C[1]+D[1])/4,w:((B[0]-A[0])+(C[0]-D[0]))/2,h:((D[1]-A[1])+(C[1]-B[1]))/2});
    }
  }
  let back='M-20 '+n2(wave(-20,ys[0]));
  for(let x=0;x<=W+20;x+=16)back+=' L'+n2(x)+' '+n2(wave(x,ys[0]));
  svg+='<path d="'+back+'" fill="none" stroke="'+o.edge+'" stroke-width="'+o.lw+'" stroke-linejoin="round"/>';
  return{svg,tiles};
}
// the pieces on their squares, drawn back to front; side(tile, rng) says whose piece stands there, if any
function troops(sc,tiles,side,seed,weights){
  const r=rng(seed),total=weights.reduce((a,w)=>a+w[1],0),out=[];
  for(const t of tiles){
    const who=side(t,r);if(!who)continue;
    let pick=r()*total,type=weights[0][0];
    for(const [ty,w] of weights){if((pick-=w)<0){type=ty;break;}}
    out.push({t,who,type:t.king===who?'king':type});
  }
  out.sort((a,b)=>a.t.cy-b.t.cy);
  return out.map(({t,who,type})=>sc.piece(type,who,t.cx,t.cy+t.h*.3,t.w*.98,who==='b')).join('');
}
// the square nearest a point in a given row, to seat a king
const nearest=(tiles,k,x)=>tiles.filter(t=>t.k===k).reduce((best,t)=>!best||Math.abs(t.cx-x)<Math.abs(best.cx-x)?t:best,null);

function sky(W,H,m){
  return '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ED6F2"/><stop offset=".62" stop-color="#D4F1DA"/><stop offset="1" stop-color="#F7EFC4"/></linearGradient></defs>'
    +'<rect width="'+W+'" height="'+H+'" fill="url(#sky)"/>'
    +'<circle cx="'+n2(W*.86)+'" cy="'+n2(H*.13)+'" r="'+n2(m*.07)+'" fill="#FFE066" stroke="#E8A93A" stroke-width="'+n2(m*.012)+'"/>'
    +cloud(W*.06,H*.12,m*.11)+cloud(W*.64,H*.08,m*.08);
}
// who marches: pawns most, then every other piece, the combined units and the cannon (the siege piece)
const ARMY=[['pawn',9],['knight',4],['bishop',2],['rook',3],['queen',1],['siege',2],['guardian',2],['paladin',2],['mage',2]];
// the field's greens: far squares hazier, near ones richer; the two squares of a row stay close
const FIELD={farLight:'#CBEAA9',farDark:'#BFE29A',nearLight:'#8AC15C',nearDark:'#7DB650',edge:'#4A7A30'};

// ── Battle Lines (wide) ──────────────────────────────────────────────────────
function battleLines(W,H){
  const sc=makeScene(),m=Math.min(W,H),lw=n2(m*.007);
  let s=sky(W,H,m);
  const far=hill(W,H,H*.5,H*.045,.2,'#C5E6A2','#5A843C',lw);
  s+=far.path;
  // each king stands on the roof of its castle, in command of the army below
  s+=castle(W*.14,m*.24,far.surface,'#F4EAD2','#5A4630',lw,'#6B4A2A','#FFC93A',(x,y,size)=>sc.piece('king','w',x,y,size));
  s+=castle(W*.86,m*.24,far.surface,'#5A5670','#1E1B2C',lw,'#FFB84D','#C8324A',(x,y,size)=>sc.piece('king','b',x,y,size,true));
  const backY=H*.585,By=H*1.04;
  const field=battlefield(W,H,Object.assign({backY,By,vy:(backY-.34*By)/.66,Wb:m*.15,a:.46,A:H*.07,lambda:W*.7,phase:.7,lw},FIELD));
  s+=field.svg;
  // two armies with an empty strip between them
  const side=(t,r)=>{
    if(t.cx<-t.w*.3||t.cx>W+t.w*.3||Math.abs(t.cx-W/2)<t.w*1.1)return null;
    if(r()>(t.k<2?.75:.92))return null;
    return t.cx<W/2?'w':'b';
  };
  s+=troops(sc,field.tiles,side,3,ARMY);
  return{sc,body:s};
}

// ── The Clash (tall) ─────────────────────────────────────────────────────────
function theClash(W,H){
  const sc=makeScene(),m=Math.min(W,H),lw=n2(m*.007);
  let s=sky(W,H,m);
  s+=hill(W,H,H*.62,H*.03,.6,'#C5E6A2','#5A843C',lw).path;
  const backY=H*.665,By=H*1.03;
  const field=battlefield(W,H,Object.assign({backY,By,vy:(backY-.4*By)/.6,Wb:m*.2,a:.5,A:H*.035,lambda:W*.9,phase:.3,lw},FIELD));
  s+=field.svg;
  // the armies meet: the front line zig-zags row by row, and nearly every square is taken
  const wk=nearest(field.tiles,0,W*.18),bk=nearest(field.tiles,0,W*.82);
  if(wk)wk.king='w';if(bk)bk.king='b';
  const front=rng(77),line=[];for(let k=0;k<60;k++)line.push((front()-.5)*1.6);
  const side=(t,r)=>{
    if(t.cx<-t.w*.3||t.cx>W+t.w*.3)return null;
    if(!t.king&&r()>.9)return null;
    return t.cx<W/2+line[t.k]*t.w?'w':'b';
  };
  s+=troops(sc,field.tiles,side,21,ARMY);
  const k=m*.022;
  s+=shot(W*.1,H*.8,W*.66,H*.83,H*.08,k)+shot(W*.92,H*.79,W*.34,H*.9,H*.07,k);
  s+=spear(W*.08,H*.735,m*.14,-10,k*1.2)+spear(W*.92,H*.735,m*.14,190,k*1.2);
  s+=burst(W*.5,H*.9,m*.07)+puff(W*.44,H*.86,m*.1)+puff(W*.55,H*.95,m*.09);
  return{sc,body:s};
}


function write(file,W,H,scene,title){
  const {sc,body}=scene(W,H);
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMax slice">'
    +'<title>'+title+'</title><defs>'+[...sc.defs.values()].join('')+'</defs>'+body+'</svg>';
  fs.writeFileSync(path.join(__dirname,file),svg);
  console.log(file,Math.round(svg.length/1024)+' KB');
}
write('title-wide.svg',1280,800,battleLines,'SemunCraft: Battle Lines');
write('title-tall.svg',390,844,theClash,'SemunCraft: The Clash');
