// Mock-ups of combined units, drawn with the game's own art (pieces/pieces.js):
//   Guardian  knight + rook: the knight rises out of a short tower
//   Paladin   knight + knight: twins, the left one in front
//   Mage      bishop + rook: the mitre clears the battlements, the staff's foot tucks behind them
//   Cannon    rook + rook: a cannon barrel pokes out of the roof
//
// The game draws a piece as: ground (shadow, base ring, grass), a thick half-transparent halo, then
// the body, details and face. These units redraw those layers in one order: every ground, then every
// halo inside a single opacity group (overlapping halos would otherwise darken each other and the
// outer edge would stop following the outlines), then the bodies from back to front.
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..','..'),OUT=__dirname;
const ctx={console};vm.createContext(ctx);
for(const f of ['pieces/pieces.js','pieces/jungle.js','pieces/desert.js','pieces/ocean.js'])
  vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),ctx,{filename:f});
const pieceSVG=ctx.pieceSVG;
const inner=s=>s.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
let defs=[],seen=new Set();
const reset=()=>{defs=[];seen=new Set();};

// The square is 120 units; a normal piece is its art box (100 wide) drawn at 86% of the square.
// In that box the feet sit at y 86, the rook's battlements top at y 18, a knight's head starts at
// y 11 and its neck passes y 70, a bishop's mitre ends at y 46, the cannon's carriage at y 52.
const S=1.03, TY=(120-100*S)/2, MID=60, FEET=TY+86*S;
const SQUASH=0.70;                       // the tower is drawn this much shorter
const NORMAL={k:S,x:TY,y:TY};
const ROOK={k:S*0.90,x:MID-50*S*0.90,y:FEET-86*S*0.90};
const RIDER={knight:{k:S*0.78,hide:70},bishop:{k:S*0.66,hide:78},siege:{k:S*0.86,hide:58}};

// ── art surgery ─────────────────────────────────────────────────────────────
const ANCHOR=86, pullY=(v,f)=>ANCHOR-(ANCHOR-v)*f;
function squashPath(d,f){
  const tok=d.match(/[A-Za-z]|[-+]?[0-9]*\.?[0-9]+/g)||[],out=[];let i=0,cmd='';
  const n=()=>+tok[i++], keep=v=>out.push(v), dropY=v=>out.push(pullY(v,f).toFixed(2));
  while(i<tok.length){
    if(/[A-Za-z]/.test(tok[i])){cmd=tok[i++];out.push(cmd);continue;}
    if(cmd==='M'||cmd==='L'){keep(n());dropY(n());}
    else if(cmd==='H'){keep(n());}
    else if(cmd==='V'){dropY(n());}
    else if(cmd==='C'){for(let k=0;k<3;k++){keep(n());dropY(n());}}
    else if(cmd==='A'){keep(n());out.push((n()*f).toFixed(2));keep(n());keep(n());keep(n());keep(n());dropY(n());}
    else keep(n());
  }
  return out.join(' ');
}
// a shorter tower, built into the drawing so stroke widths stay even
const squashY=(art,f)=>art
  .replace(/ d="([^"]+)"/g,(m,d)=>' d="'+squashPath(d,f)+'"')
  .replace(/<ellipse([^>]*)\/>/g,(m,a)=>'<ellipse'+a
    .replace(/cy="([-\d.]+)"/,(x,v)=>'cy="'+pullY(+v,f).toFixed(2)+'"')
    .replace(/ry="([-\d.]+)"/,(x,v)=>'ry="'+(+v*f).toFixed(2)+'"')+'/>')
  .replace(/<circle([^>]*)\/>/g,(m,a)=>'<circle'+a
    .replace(/cy="([-\d.]+)"/,(x,v)=>'cy="'+pullY(+v,f).toFixed(2)+'"')+'/>');
// a piece drawn smaller needs proportionally wider strokes to keep the same outline weight
const strokeScale=(art,f)=>art.replace(/stroke-width="([\d.]+)"/g,(m,w)=>'stroke-width="'+(+w*f).toFixed(2)+'"');
// The game strokes its halo along the body path only, so a detail that reaches past it (the knight's
// mane) eats into the halo there. Drawing the halo from the whole piece — body, details and all —
// keeps the band the same width the whole way round.
// The game's halo is 11 wide with a 4-wide outline inside it, so 3.5 shows around the piece.
// White's dark halo reads heavier than Black's pale one, so its band is drawn half as wide.
const HALO=11, HALO_W=7.5;
const haloWidth=color=>color==='w'?HALO_W:HALO;
function halo(art,color,width){return haloFrom(art,color,width);}
// the halo's colour, made opaque so several halos can share one opacity group
function opaque(halo){
  const key='stroke="rgba(',i=halo.indexOf(key),j=halo.indexOf(')"',i);
  const nums=halo.slice(i+key.length,j).split(',');
  nums.pop();
  return halo.slice(0,i)+'stroke="rgb('+nums.join(',')+')"'+halo.slice(j+2);
}
// the barrel has no halo of its own in the game's art: build one from its shapes
function haloFrom(markup,color,width){
  return markup.replace(/fill="[^"]*"/g,'fill="'+color+'"')
    .replace(/stroke="[^"]*"/g,'stroke="'+color+'"')
    .replace(/stroke-width="[^"]*"/g,'stroke-width="'+width.toFixed(2)+'"');
}
function haloColor(color){
  const halo=opaque(slices('knight',color).halo),key='stroke="';
  const i=halo.indexOf(key),j=halo.indexOf('"',i+key.length);
  return halo.slice(i+key.length,j);
}
function haloAlpha(color){
  const halo=slices('knight',color).halo,key='stroke="rgba(';
  const i=halo.indexOf(key),j=halo.indexOf(')"',i);
  return halo.slice(i+key.length,j).split(',').pop().trim();
}

function slices(type,color){
  const art=inner(pieceSVG(type,color,'jungle',100));
  const h=art.indexOf('<g fill="none" stroke="'),e=art.indexOf('</g>',h)+4;
  let ground=art.slice(0,h),held='';
  for(const mark of ['<path d="M79 86 V33"','<g transform="rotate(-28 50 50)"']){ // bishop's staff, cannon's barrel
    const i=ground.indexOf(mark);
    if(i>=0){held=ground.slice(i);ground=ground.slice(0,i);break;}
  }
  return {ground,held,halo:art.slice(h,e),body:art.slice(e)};
}
function use(id,at,flip,build){
  if(!seen.has(id)){seen.add(id);defs.push('<g id="'+id+'">'+build()+'</g>');}
  return '<use href="#'+id+'" transform="translate('+at.x.toFixed(2)+','+at.y.toFixed(2)+') scale('
    +at.k.toFixed(3)+')'+(flip?' translate(100,0) scale(-1,1)':'')+'"/>';
}
const piece=(type,color,at,flip)=>use(type+'-'+color,at,flip,()=>inner(pieceSVG(type,color,'jungle',100)));
const part=(type,color,at,which)=>use(type+'-'+color+'-'+which,at,false,()=>{
  const s=slices(type,color);
  return which==='halo'?halo(s.body,haloColor(color),haloWidth(color)):s[which];
});
// the shortened tower
const rookPart=(color,which)=>use('rook-'+color+'-'+which,ROOK,false,()=>{
  const s=slices('rook',color);
  if(which==='ground')return s.ground;
  const body=squashY(s.body,SQUASH);
  return which==='halo'?halo(body,haloColor(color),haloWidth(color)):body;
});
// a rider keeps no ground of its own (it stands in the tower, not on the grass) and gets wider
// strokes to make up for being drawn smaller
const rider=(type,color,at,which)=>use('rider-'+type+'-'+color+'-'+which,at,false,()=>{
  const s=slices(type,color),wider=ROOK.k/at.k;
  if(which==='heldHalo')return halo(s.held,haloColor(color),haloWidth(color)*wider);
  if(which==='halo')return halo(s.body,haloColor(color),haloWidth(color)*wider);
  return strokeScale(s[which],wider);
});

// ── the units ───────────────────────────────────────────────────────────────
function onRoof(type,color,peek){
  const r=RIDER[type],roofTop=ROOK.y+pullY(18,SQUASH)*ROOK.k;
  const at={k:r.k,x:MID-52.5*r.k+(peek||0),y:roofTop+8-r.hide*r.k};
  const barrel=type==='siege';   // the cannon shows only its barrel; carriage and wheels stay behind
  return rookPart(color,'ground')
    +'<g opacity="'+haloAlpha(color)+'">'+rookPart(color,'halo')
      +rider(type,color,at,barrel?'heldHalo':'halo')+'</g>'
    +rider(type,color,at,barrel?'held':'body')
    +(type==='bishop'?rider(type,color,at,'held'):'')      // the staff clears the bishop's own outline
    +rookPart(color,'body');                               // and its foot goes behind the tower
}
// twins: same size, same baseline, the left one in front
function twins(color,over){
  const k=S*0.9,y=FEET-86*k,d=(over||32)*k,x1=MID-(51*k+d)/2-27*k;
  const back={k,x:x1+d,y:y-3},front={k,x:x1,y};
  return part('knight',color,back,'ground')+part('knight',color,front,'ground')
    +'<g opacity="'+haloAlpha(color)+'">'+part('knight',color,back,'halo')+part('knight',color,front,'halo')+'</g>'
    +part('knight',color,back,'body')+part('knight',color,front,'body');
}
const UNITS=[
  {name:'Guardian',parts:['knight','rook'],draw:c=>onRoof('knight',c,2)},
  {name:'Paladin',parts:['knight','knight'],draw:c=>twins(c)},
  {name:'Mage',parts:['bishop','rook'],draw:c=>onRoof('bishop',c,0)},
  {name:'Cannon',parts:['rook','rook'],draw:c=>piece('siege',c,NORMAL)},   // now a real piece
];

// ── pages ───────────────────────────────────────────────────────────────────
const tile=(x,y,size,dark,content)=>'<g transform="translate('+x+','+y+') scale('+size/120+')">'
  +'<rect width="120" height="120" fill="'+(dark?'#4a6e28':'#7a9e4c')+'"/>'+content+'</g>';
const STYLE='<style>.n{font:500 15px ui-sans-serif,system-ui,sans-serif;fill:var(--p,#2b2a27);text-anchor:middle}'
  +'.s{font:400 12px ui-sans-serif,system-ui,sans-serif;fill:var(--s,#6b6862);text-anchor:middle}'
  +'.sl{font:400 12px ui-sans-serif,system-ui,sans-serif;fill:var(--s,#6b6862)}'
  +'.op{font:400 17px ui-sans-serif,system-ui,sans-serif;fill:var(--s,#6b6862);text-anchor:middle}</style>';
const wrap=(h,title,desc,body)=>'<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 680 '+h+'" role="img">'
  +'<title>'+title+'</title><desc>'+desc+'</desc>'+STYLE+'<defs>'+defs.join('')+'</defs>'+body+'</svg>';

function unitsSvg(){
  reset();
  const X=[100,240,380,520],T=120;let b='';
  UNITS.forEach((u,i)=>{
    const cx=X[i]+T/2;
    b+='<text x="'+cx+'" y="20" class="n">'+u.name+'</text>'
      +'<text x="'+cx+'" y="38" class="s">'+u.parts.join(' + ')+'</text>'
      +tile(X[i],50,T,false,u.draw('w'))+tile(X[i],182,T,true,u.draw('b'));
  });
  b+='<text x="45" y="114" class="sl">White</text><text x="45" y="246" class="sl">Black</text>';
  return wrap(322,'Guardian, Paladin, Mage and Cannon',
    'A knight rising out of a short tower (Guardian), twin knights one behind the other (Paladin), a bishop with his staff (Mage), and a cannon barrel poking out of the roof (Cannon), in White and in Black.',b);
}
function stripSvg(){
  reset();
  const T=150,X0=115;let b='';
  [['Knight',piece('knight','w',NORMAL)],['Guardian',UNITS[0].draw('w')],['Rook',piece('rook','w',NORMAL)]]
    .forEach(([label,content],i)=>{
      b+=tile(X0+i*T,10,T,i%2===1,content)+'<text x="'+(X0+i*T+T/2)+'" y="188" class="s">'+label+'</text>';
    });
  return wrap(208,'A combined unit between two normal pieces',
    'Three squares of a board: a knight, the Guardian, and a rook, each inside one square.',b);
}
function inspectSvg(color){
  reset();
  const T=155,X=[15,180,345,510];let b='';
  UNITS.forEach((u,i)=>{b+=tile(X[i],10,T,i%2===1,u.draw(color))
    +'<text x="'+(X[i]+T/2)+'" y="191" class="s">'+u.name+'</text>';});
  return wrap(211,'Combined units, large','The four combined units drawn large.',b);
}

const files={'units-white.svg':inspectSvg('w'),'units-black.svg':inspectSvg('b'),
  'units.svg':unitsSvg(),'units-on-board.svg':stripSvg()};
for(const [f,s] of Object.entries(files)){fs.writeFileSync(path.join(OUT,f),s);console.log(f,s.length,'chars');}
