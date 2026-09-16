// Jungle set mock-up: today's board (to become Forest, the default map) next to a
// tropical Jungle board, the three candidate jungle obstacles, the jungle stickers
// enlarged, and the pieces' new jungle ground decoration.
const fs=require('fs'),path=require('path'),vm=require('vm');
const {SCENERY,OBSTACLES}=require('./board-scenery.js');
const ROOT='G:/My Drive/Others/SemunCraft',OUT=__dirname;
const ctx={console};vm.createContext(ctx);
for(const f of ['pieces/pieces.js','pieces/jungle.js','pieces/desert.js','pieces/ocean.js'])
  vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),ctx,{filename:f});
const n2=v=>(+(+v).toFixed(2)).toString();

// ── drawing helpers (same as js/scenery.js) ──────────────────────────────────
const st=(d,color,w,ink)=>'<path d="'+d+'" fill="none" stroke="'+ink+'" stroke-width="'+(w+1.6)
  +'" stroke-linecap="round" stroke-linejoin="round"/><path d="'+d+'" fill="none" stroke="'+color
  +'" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round"/>';
const sh=(d,fill,ink,w)=>'<path d="'+d+'" fill="'+fill+'" stroke="'+ink+'" stroke-width="'+(w||1.6)
  +'" stroke-linejoin="round"/>';
const ci=(x,y,r,fill,ink,w)=>'<circle cx="'+n2(x)+'" cy="'+n2(y)+'" r="'+r+'" fill="'+fill+'" stroke="'+ink
  +'" stroke-width="'+(w||1.6)+'"/>';
const NONE='rgba(0,0,0,0)';
// a lens-shaped leaf from (cx,cy), pointing along ang degrees
const leaf=(cx,cy,len,w,ang,fill,ink,sw)=>'<path d="M0 0 C'+n2(len*.3)+' '+(-w)+' '+n2(len*.7)+' '+(-w)+' '+len
  +' 0 C'+n2(len*.7)+' '+w+' '+n2(len*.3)+' '+w+' 0 0 Z" transform="translate('+cx+','+cy+') rotate('+ang+')" fill="'
  +fill+'" stroke="'+ink+'" stroke-width="'+(sw||1.4)+'" stroke-linejoin="round"/>';
// five round petals around a centre
const flower=(cx,cy,d,r,petal,center,ink,sw)=>[-90,-18,54,126,198].map(a=>{
    const t=a*Math.PI/180;return ci(cx+d*Math.cos(t),cy+d*Math.sin(t),r,petal,ink,sw);}).join('')
  +ci(cx,cy,r*.55,center,ink,sw*.8);

// ── the jungle palette and stickers ──────────────────────────────────────────
const JI='rgba(8,36,18,.55)';
const JUNGLE={
  quiet:[
    // monstera leaf, its splits cut into the outline
    st('M7 27 L3 30','#2A7A38',1.6,JI)
      +sh('M7 27 C4 24 6 18 12 16 L15.5 22 L17 15.5 C21 15.5 24 17 25.5 19 L21 24 L27.5 23 '
        +'C28.5 25.5 28.5 28.5 27 31 L22 29 L24.5 34 C22 36 19 36.5 16.5 36 L16 30 L12 35.5 '
        +'C8 35 5 33 5 30 C5 28.5 6 27.5 7 27 Z','#3FA34D',JI,1.6)
      +st('M7 27 C13 26.5 19 26.8 25 27.5','#2A7A38',1.2,NONE),
    // fallen palm frond
    st('M3 33 C10 29 18 26 27 20','#2A7A38',1.6,JI)
      +st('M7 31 L4 26 M11 29 L9 23.5 M15 27.5 L14 21.5 M19 25.5 L19 19.5 M23 23 L24 17.5 '
        +'M8 32 L7.5 36 M12 30.5 L13 35 M16 28.5 L18 33 M20 26.5 L23 30.5','#4FAE55',1.8,JI),
    // puddle with a lily pad
    '<ellipse cx="15" cy="30" rx="11" ry="4.6" fill="#3F8F86" stroke="'+JI+'" stroke-width="1.6"/>'
      +st('M8 29 Q12 27 16 27.6','#9FE0D2',1.3,NONE)
      +sh('M19 30.5 L23.44 31.15 A4.6 2.5 0 1 1 23.44 29.85 Z','#5DBB5A',JI,1.3),
    // creeping vine
    st('M3 33 C8 27 12 35 17 29 C21 24 25 31 28 25','#4E9F48',1.8,JI)
      +leaf(7,29.5,5,2.2,-120,'#6CC04A',JI,1.2)+leaf(16,29,5,2.2,-60,'#6CC04A',JI,1.2)
      +leaf(24,27.5,5,2.2,-130,'#6CC04A',JI,1.2),
  ],
  feature:[
    // hibiscus
    leaf(12,31,9,3.2,160,'#3FA34D',JI,1.4)+leaf(15,31,9,3.2,20,'#3FA34D',JI,1.4)
      +flower(13,22,5.3,4.4,'#FF4F7B','#FFD84D',JI,1.5)
      +st('M13 22 L19 15.5','#FFD84D',1.2,NONE)+ci(19.5,15,1.3,'#FF9E2C',NONE,0),
    // bird of paradise
    st('M13 36 V25','#2A7A38',2.2,JI)
      +sh('M5 26 C11 22 20 22 26 26 C20 27 11 27 5 26 Z','#3FA34D',JI,1.4)
      +sh('M12 24 L9 12 L15 23 Z','#FF9E2C',JI,1.3)+sh('M15 23 L17 10 L19 23 Z','#FFB23F',JI,1.3)
      +sh('M18 23 L25 14 L21 24 Z','#FF9E2C',JI,1.3)+sh('M16 24 L22 18 L20 24.5 Z','#3B7BE0',JI,1.1),
    // coconuts
    leaf(14,24,12,3,-150,'#3FA34D',JI,1.3)+leaf(14,24,11,3,-35,'#3FA34D',JI,1.3)
      +ci(10,29,5.2,'#8B5A2B',JI,1.6)+ci(19,30.5,4.6,'#7A4A22',JI,1.6)
      +ci(8.6,27.6,.8,'#3A2412',NONE,0)+ci(11.4,27.6,.8,'#3A2412',NONE,0)+ci(10,30.2,.8,'#3A2412',NONE,0),
    // bromeliad
    st('M14 34 C11 30 7 27 3 26 M14 34 C13 28 11 22 9 17 M14 34 C15 28 17 22 19 17 M14 34 C17 30 21 27 25 26',
      '#3FA34D',3,JI)
      +sh('M11 31 L14 19 L17 31 Z','#FF4F7B',JI,1.4)+ci(14,19.5,1.4,'#FFD84D',NONE,0),
  ],
  names:{quiet:['Monstera','Palm frond','Puddle','Vine'],feature:['Hibiscus','Bird of paradise','Coconuts','Bromeliad']},
};

// ── three candidate jungle obstacles, 100x100 like a piece ──────────────────
const PI='#12361C';
const frond=(d,fill)=>sh(d,fill,PI,3.6);
const PALM=
  frond('M58 28 C50 12 36 4 20 6 C34 12 46 20 58 28 Z','#2F8A3F')
  +frond('M58 28 C66 12 80 4 96 10 C82 13 70 20 58 28 Z','#2F8A3F')
  +sh('M42 96 C44 76 48 54 53 30 L64 32 C59 56 56 78 58 96 Z','#B07A40','#3A2412',4)
  +st('M44 86 L57 87 M46 74 L58 75.5 M48.5 62 L59.5 63.5 M51 50 L61 51.5 M53 40 L62.5 41.5','#8A5A2A',2.4,NONE)
  +ci(52,37,5.5,'#7A4A22','#2A1A10',3)+ci(62,39,5,'#8B5A2B','#2A1A10',3)
  +frond('M58 28 C42 18 18 20 4 38 C20 30 42 32 58 28 Z','#3FA34D')
  +frond('M58 28 C74 18 92 22 98 42 C86 32 72 32 58 28 Z','#3FA34D')
  +frond('M58 28 C44 32 28 44 20 62 C34 48 48 40 58 28 Z','#2F8A3F')
  +frond('M58 28 C72 34 84 48 86 64 C78 50 68 42 58 28 Z','#2F8A3F')
  +st('M58 28 C42 22 22 24 8 36 M58 28 C74 22 90 26 96 38 M58 28 C46 34 32 46 22 58 M58 28 C70 36 80 48 84 60',
    '#6CC04A',2,NONE)
  +ci(58,28,4.5,'#2F8A3F',PI,3)
  +sh('M10 96 C10 88 18 82 28 86 C32 78 42 76 48 84 C54 76 66 78 70 86 C80 82 90 88 90 96 Z','#2F8A3F',PI,3.6)
  +st('M24 92 C26 88 30 86 34 86 M60 90 C62 86 66 84 70 85','#58B866',2.2,NONE);

const VINE_TREE=
  sh('M26 96 C34 93 39 86 40 72 L41 56 L59 56 L60 72 C61 86 66 93 74 96 Z','#7A5230','#2A1A10',4)
  +st('M50 95 V80 M41 90 C44 88 46 84 46 80 M59 90 C56 88 54 84 54 80','#5E3E22',2.4,NONE)
  +sh('M8 50 C1 40 8 24 22 26 C24 12 40 6 52 12 C62 4 80 8 82 22 C94 20 99 36 94 48 C90 58 78 60 70 55 '
    +'C60 62 40 62 30 55 C20 60 10 58 8 50 Z','#2E8B45',PI,4)
  +st('M22 30 C28 20 40 16 50 18 M60 14 C68 12 76 16 78 22','#5AB86A',5,NONE)
  +st('M24 57 C21 66 26 74 22 86','#5DBB5A',2.6,PI)+st('M72 57 C75 66 70 76 74 88','#5DBB5A',2.6,PI)
  +st('M87 52 C89 58 85 64 88 72','#5DBB5A',2.6,PI)
  +leaf(22,72,7,3,200,'#6CC04A',PI,1.8)+leaf(25,82,7,3,-20,'#6CC04A',PI,1.8)
  +leaf(72,70,7,3,-30,'#6CC04A',PI,1.8)+leaf(74,84,7,3,200,'#6CC04A',PI,1.8)+leaf(87,66,6,2.6,-20,'#6CC04A',PI,1.6)
  +flower(66,34,3.4,3,'#FF4F7B','#FFD84D',PI,1.6);

const SI='#2F3A2C';
const TEMPLE=
  sh('M6 96 L6 52 C6 48 9 46 13 46 L87 46 C91 46 94 48 94 52 L94 96 Z','#8E9A86',SI,4)
  +st('M6 72 H94 M34 52 V72 M66 52 V72 M50 72 V96','#6E7A66',2.6,NONE)
  +sh('M20 46 L20 20 C20 16 23 14 27 14 L73 14 C77 14 80 16 80 20 L80 46 Z','#A2AE98',SI,4)
  +st('M40 24 H60 V40 H45 V29 H55 V35','#5E6A58',3,NONE)
  +sh('M4 50 C8 43 16 47 21 44 L79 44 C85 46 92 43 96 50 L96 54 C88 52 80 55 72 52 C62 55 40 52 30 55 '
    +'C20 52 12 55 4 54 Z','#5DAA4E','#1E3A12',3)
  +sh('M18 20 C22 12 30 16 36 12 C44 8 52 16 60 11 C68 8 74 14 82 18 L82 23 C74 21 66 24 58 21 '
    +'C50 24 42 21 34 24 C28 22 22 25 18 23 Z','#5DAA4E','#1E3A12',3)
  +st('M76 16 C80 28 72 38 78 50 C82 60 76 70 80 82','#3FA34D',3,PI)
  +leaf(78,34,7,3,-20,'#6CC04A',PI,1.8)+leaf(79,62,7,3,200,'#6CC04A',PI,1.8)+leaf(78,78,6,2.6,-30,'#6CC04A',PI,1.6);

// ── the pieces' jungle ground: a monstera leaf on one side, a hibiscus on the other ─
vm.runInContext(`PIECE_SETS.jungle2={
  colors:{metal:'#E9C64B',gem:'#43C45A',wood:'#8B5A2B',iron:'#5E6470',leaf:'#3FA34D',rib:'#2A7A38',petal:'#FF4F7B',center:'#FFD84D'},
  base:rx=>{
    const lx=50-rx-2,fx=50+rx+2;
    const monstera='<path d="M'+(lx-9)+' 90 C'+(lx-12)+' 82 '+(lx-4)+' 76 '+(lx+2)+' 80 C'+(lx+7)+' 84 '+(lx+4)+' 91 '+(lx-9)+' 90 Z" fill="{leaf}" stroke="{line}" stroke-width="1.8" stroke-linejoin="round"/>'
      +'<path d="M'+(lx-8)+' 89 C'+(lx-4)+' 86 '+(lx-1)+' 84 '+(lx+2)+' 81" fill="none" stroke="{rib}" stroke-width="1.2"/>';
    const P=[[0,-2.9],[2.76,-0.9],[1.7,2.35],[-1.7,2.35],[-2.76,-0.9]];
    const hib=P.map(p=>'<circle cx="'+(fx+p[0])+'" cy="'+(79+p[1])+'" r="2.6" fill="{petal}" stroke="{line}" stroke-width="1.3"/>').join('')
      +'<circle cx="'+fx+'" cy="79" r="1.4" fill="{center}"/>';
    return monstera+hib;
  },
};`,ctx);

// ── boards ───────────────────────────────────────────────────────────────────
const MAPS={
  forest:{name:'Forest (default)',lt:'#7a9e4c',dk:'#4a6e28',frame:'#3c5a1e',
    scenery:SCENERY.jungle,obstacle:OBSTACLES.jungle.art,pieces:'jungle'},
  jungle:{name:'Jungle',lt:'#4f9b5e',dk:'#2d7243',frame:'#1a4a2c',
    scenery:JUNGLE,obstacle:PALM,pieces:'jungle2'},
};
const defs=[],seen=new Set();
function hash(r,c){
  let h=(r*374761393+c*668265263+7*2246822519)>>>0;
  h=Math.imul(h^(h>>>13),1274126177)>>>0;
  return (h^(h>>>16))>>>0;
}
function pieceUse(map,type,color,x,y,s){
  const id='p'+type+color+map;
  if(!seen.has(id)){seen.add(id);
    const svg=ctx.pieceSVG(type,color,MAPS[map].pieces,100).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
    defs.push('<g id="'+id+'"><g transform="translate(8.5,8.5) scale(1.03)">'+svg+'</g></g>');}
  return '<use href="#'+id+'" transform="translate('+n2(x)+','+n2(y)+') scale('+(s/120).toFixed(4)+')"/>';
}
function board(map,tag,n,x,y,size,pieces,blocked){
  const m=MAPS[map],sc=m.scenery,s=size/n,g=+(s*0.033).toFixed(2),pad=+(g*1.4).toFixed(2);
  const rx=+(s*0.13).toFixed(2),k=n2(s/40),u=s/40;
  defs.push('<rect id="t'+tag+'l" x="'+n2(g/2)+'" y="'+n2(g/2)+'" width="'+n2(s-g)+'" height="'+n2(s-g)+'" rx="'+rx+'" fill="'+m.lt+'"/>');
  defs.push('<rect id="t'+tag+'d" x="'+n2(g/2)+'" y="'+n2(g/2)+'" width="'+n2(s-g)+'" height="'+n2(s-g)+'" rx="'+rx+'" fill="'+m.dk+'"/>');
  sc.quiet.forEach((q,i)=>{
    defs.push('<g id="'+tag+'q'+i+'" opacity=".5" transform="scale('+k+') translate(1,6) scale(.8)">'+q+'</g>');
    defs.push('<g id="'+tag+'q'+i+'f" opacity=".5" transform="scale('+k+') translate(39,6) scale(-.8,.8)">'+q+'</g>');
  });
  sc.feature.forEach((f,i)=>defs.push('<g id="'+tag+'p'+i+'" opacity=".66" transform="scale('+k+') translate(2,13) scale(.58)">'+f+'</g>'));
  const frame='<rect x="'+n2(-pad)+'" y="'+n2(-pad)+'" width="'+n2(size+2*pad)+'" height="'+n2(size+2*pad)+'" rx="'+n2(rx+pad)+'"';
  defs.push('<clipPath id="cl'+tag+'">'+frame+'/></clipPath>');
  let b='<g transform="translate('+x+','+y+')">'+frame+' fill="'+m.frame+'"/><g clip-path="url(#cl'+tag+')">';
  for(let r=0;r<n;r++)for(let c=0;c<n;c++){
    const tx=c*s,ty=r*s;
    b+='<use href="#t'+tag+((r+c)%2===0?'l':'d')+'" x="'+n2(tx)+'" y="'+n2(ty)+'"/>';
    if(blocked.has(r+','+c)){
      const id='ob'+map;
      if(!seen.has(id)){seen.add(id);defs.push('<g id="'+id+'">'+m.obstacle+'</g>');}
      b+='<use href="#'+id+'" transform="translate('+n2(tx)+','+n2(ty)+') scale('+(s/100).toFixed(4)+')"/>';
      continue;
    }
    const h=hash(r,c),roll=h%1000;
    let kind,list;
    if(roll<430){kind='q';list=sc.quiet;}else if(roll<640){kind='p';list=sc.feature;}else continue;
    const i=(h>>>10)%list.length,flip=(kind==='q'&&((h>>>8)&1))?'f':'';
    const jx=kind==='q'?((h>>>14)%9)-1:((h>>>14)%5)-1,jy=((h>>>19)%5)-2;
    b+='<use href="#'+tag+kind+i+flip+'" x="'+n2(tx+jx*u)+'" y="'+n2(ty+jy*u)+'"/>';
  }
  b+='</g>';
  for(const [type,color,r,c] of pieces)b+=pieceUse(map,type,color,c*s,r*s,s);
  return b+'</g>';
}

const CLOSE=[['king','w',2,1],['pawn','b',1,2]],CLOSE_BLOCK=new Set(['0,3']);
const START=[['king','w',7,1],['pawn','w',6,2],['pawn','w',6,1],['pawn','w',7,2],
             ['king','b',1,7],['pawn','b',2,6],['pawn','b',2,7],['pawn','b',1,6]];
const START_BLOCK=new Set(['3,2','3,3','4,3','2,1','5,6','6,6','6,7','4,5','7,4','0,5','8,2']);

const A=176,B=250,X0=96,X1=X0+A+30,ROW=B+26,W=X1+B+12;
let out='<text x="'+(X0+A/2)+'" y="20" class="n">Close-up</text><text x="'+(X1+B/2)+'" y="20" class="n">Full 9 \u00d7 9 board</text>';
['forest','jungle'].forEach((map,r)=>{
  const y=34+r*ROW;
  out+='<text x="16" y="'+(y+B/2)+'" class="s">'+MAPS[map].name.replace(' (default)','')+'</text>';
  if(map==='forest')out+='<text x="16" y="'+(y+B/2+16)+'" class="t">default</text>';
  else out+='<text x="16" y="'+(y+B/2+16)+'" class="t">new</text>';
  out+=board(map,map[0]+'a',4,X0,y+(B-A)/2,A,CLOSE,CLOSE_BLOCK);
  out+=board(map,map[0]+'b',9,X1,y,B,START,START_BLOCK);
});

// obstacle candidates on a jungle tile
let y=34+2*ROW+14;
out+='<text x="16" y="'+(y+8)+'" class="s">Jungle obstacle \u2014 pick one</text>';
y+=20;
const OB=[['Palm',PALM],['Vine tree',VINE_TREE],['Temple stones',TEMPLE]],OT=118;
OB.forEach(([name,art],i)=>{
  const x=X0+i*(OT+36);
  out+='<g transform="translate('+x+','+y+')"><rect width="'+OT+'" height="'+OT+'" rx="14" fill="#2d7243"/>'
    +'<g transform="scale('+(OT/100)+')">'+art+'</g></g>'
    +'<text x="'+(x+OT/2)+'" y="'+(y+OT+16)+'" class="n" style="font-size:12px">'+name+'</text>';
});
y+=OT+34;

// stickers enlarged, one row of ground textures and one of corner features
out+='<text x="16" y="'+(y+8)+'" class="s">Jungle stickers, enlarged</text>';
y+=20;
const ST=56,SG=(W-X0-12-4*ST)/3;
[['ground',JUNGLE.quiet,JUNGLE.names.quiet],['corner',JUNGLE.feature,JUNGLE.names.feature]].forEach(([label,list,names])=>{
  out+='<text x="16" y="'+(y+ST/2+4)+'" class="t">'+label+'</text>';
  list.forEach((art,i)=>{
    const x=X0+i*(ST+SG);
    out+='<g transform="translate('+n2(x)+','+y+')"><rect width="'+ST+'" height="'+ST+'" rx="8" fill="#4f9b5e"/>'
      +'<g transform="scale('+(ST/32)+') translate(-1,-10)">'+art+'</g></g>'
      +'<text x="'+n2(x+ST/2)+'" y="'+(y+ST+13)+'" class="t" style="text-anchor:middle">'+names[i]+'</text>';
  });
  y+=ST+24;
});
y+=6;

// pieces standing on each map
out+='<text x="16" y="'+(y+8)+'" class="s">Ground at the pieces\u2019 feet</text>';
y+=20;
const PT=84;
[['forest','Forest'],['jungle','Jungle']].forEach(([map,label],i)=>{
  const x0=X0+i*(2*PT+60);
  ['w','b'].forEach((col,j)=>{
    const x=x0+j*(PT+6);
    out+='<g transform="translate('+x+','+y+')"><rect width="'+PT+'" height="'+PT+'" rx="11" fill="'+(j?MAPS[map].dk:MAPS[map].lt)+'"/></g>'
      +pieceUse(map,j?'pawn':'king',col,x,y,PT);
  });
  out+='<text x="'+(x0+PT+3)+'" y="'+(y+PT+16)+'" class="n" style="font-size:12px">'+label+'</text>';
});
y+=PT+28;

const svg='<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 '+W+' '+y+'" role="img">'
  +'<title>Jungle set</title>'
  +'<desc>Today\u2019s board as Forest, the default map, next to a tropical Jungle board; three candidate jungle'
  +' obstacles (palm, vine tree, temple stones); the jungle stickers enlarged; and the pieces standing on each ground.</desc>'
  +'<style>.n{font:500 13px ui-sans-serif,system-ui,sans-serif;fill:var(--p,#2b2a27);text-anchor:middle}'
  +'.s{font:500 12px ui-sans-serif,system-ui,sans-serif;fill:var(--p,#2b2a27)}'
  +'.t{font:400 11px ui-sans-serif,system-ui,sans-serif;fill:var(--s,#6b6862)}</style>'
  +'<defs>'+defs.join('')+'</defs>'+out+'</svg>';
fs.writeFileSync(path.join(OUT,'jungle-set.svg'),svg);
console.log('jungle-set.svg',svg.length,'chars');
