// Board look: rounded tiles with a thin gap, scattered theme scenery, and the
// impassable tiles redrawn as stickers. Tiles and motifs go in <defs> and are
// placed with <use> so the sheet stays small.
const fs=require('fs'),path=require('path'),vm=require('vm');
const {SCENERY,OBSTACLES}=require('./scenery.js');
const ROOT='G:/My Drive/Others/SemunCraft',OUT=__dirname;
const ctx={console};vm.createContext(ctx);
for(const f of ['pieces/pieces.js','pieces/jungle.js','pieces/desert.js','pieces/ocean.js'])
  vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),ctx,{filename:f});
const pieceSVG=ctx.pieceSVG;
const inner=s=>s.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
const defs=[],seen=new Set();
const n2=v=>(+v.toFixed(2)).toString();

// the game's own board colours (js/themes.js), plus a frame tone
const THEMES={
  jungle:{name:'Jungle',lt:'#7a9e4c',dk:'#4a6e28',frame:'#3c5a1e'},
  desert:{name:'Desert',lt:'#c8a84a',dk:'#a07828',frame:'#7a5820'},
  ocean:{name:'Ocean',lt:'#4a80c8',dk:'#2a5898',frame:'#1e3c74'},
};
const GAP_RATIO=0.033;   // tile gap as a share of the tile: the thin dark line between tiles

// one stable pseudo-random number per tile, so the same board always looks the same
function hash(r,c,salt){
  let h=(r*374761393+c*668265263+salt*2246822519)>>>0;
  h=Math.imul(h^(h>>>13),1274126177)>>>0;
  return (h^(h>>>16))>>>0;
}

// a board of n x n rounded tiles with scenery, pieces placed on top
function board(theme,tag,n,x,y,size,pieces,blocked){
  const t=THEMES[theme],sc=SCENERY[theme],s=size/n,g=+(s*GAP_RATIO).toFixed(2),pad=+(g*1.4).toFixed(2);
  const rx=+(s*0.13).toFixed(2),k=n2(s/40);
  const lt='t'+tag+'l',dk='t'+tag+'d';
  defs.push('<rect id="'+lt+'" x="'+n2(g/2)+'" y="'+n2(g/2)+'" width="'+n2(s-g)+'" height="'+n2(s-g)
    +'" rx="'+rx+'" fill="'+t.lt+'"/>');
  defs.push('<rect id="'+dk+'" x="'+n2(g/2)+'" y="'+n2(g/2)+'" width="'+n2(s-g)+'" height="'+n2(s-g)
    +'" rx="'+rx+'" fill="'+t.dk+'"/>');
  // Scenery is drawn small and low so a free tile still reads as free ground: the quiet
  // ground textures keep to the bottom strip (and mirror to the other side for variety),
  // the features are shrunk further and tucked into the bottom-left corner.
  sc.quiet.forEach((m,i)=>{
    defs.push('<g id="'+tag+'q'+i+'" opacity=".5" transform="scale('+k+') translate(1,6) scale(.8)">'+m+'</g>');
    defs.push('<g id="'+tag+'q'+i+'f" opacity=".5" transform="scale('+k+') translate(39,6) scale(-.8,.8)">'+m+'</g>');
  });
  sc.feature.forEach((m,i)=>{
    defs.push('<g id="'+tag+'p'+i+'" opacity=".66" transform="scale('+k+') translate(2,13) scale(.58)">'+m+'</g>');
  });

  let b='<g transform="translate('+x+','+y+')">';
  const frame='<rect x="'+n2(-pad)+'" y="'+n2(-pad)+'" width="'+n2(size+2*pad)+'" height="'+n2(size+2*pad)
    +'" rx="'+n2(rx+pad)+'"';
  defs.push('<clipPath id="cl'+tag+'">'+frame+'/></clipPath>');
  b+=frame+' fill="'+t.frame+'"/>';
  // scenery is jittered, so keep it inside the frame
  b+='<g clip-path="url(#cl'+tag+')">';
  const u=s/40;
  for(let r=0;r<n;r++)for(let c=0;c<n;c++){
    const tx=c*s,ty=r*s;
    b+='<use href="#'+((r+c)%2===0?lt:dk)+'" x="'+n2(tx)+'" y="'+n2(ty)+'"/>';
    if(blocked&&blocked.has(r+','+c))continue;   // an obstacle takes the whole tile
    const h=hash(r,c,7),roll=h%1000;
    let kind=null,list=null;
    if(roll<430){kind='q';list=sc.quiet;}
    else if(roll<640){kind='p';list=sc.feature;}
    if(!kind)continue;
    const i=(h>>>10)%list.length;
    // only the ground textures mirror; a feature always stays in the bottom-left corner
    const flip=(kind==='q'&&((h>>>8)&1))?'f':'';
    const jx=kind==='q'?((h>>>14)%9)-1:((h>>>14)%5)-1, jy=((h>>>19)%5)-2;
    b+='<use href="#'+tag+kind+i+flip+'" x="'+n2(tx+jx*u)+'" y="'+n2(ty+jy*u)+'"/>';
  }
  // impassable tiles, drawn as stickers that fill the square they block
  if(blocked)for(const key of blocked){
    const rc=key.split(',').map(Number),id='ob'+theme[0];
    if(!seen.has(id)){seen.add(id);defs.push('<g id="'+id+'">'+OBSTACLES[theme].art+'</g>');}
    b+='<use href="#'+id+'" transform="translate('+n2(rc[1]*s)+','+n2(rc[0]*s)+') scale('+(s/100).toFixed(4)+')"/>';
  }
  b+='</g>';
  for(const p of pieces){
    const type=p[0],color=p[1],r=p[2],c=p[3],id=type+color+theme[0],pk=s/120;
    if(!seen.has(id)){const S=1.03,off=(120-100*S)/2;seen.add(id);
      defs.push('<g id="'+id+'"><g transform="translate('+n2(off)+','+n2(off)+') scale('+S+')">'
        +inner(pieceSVG(type,color,theme,100))+'</g></g>');}
    b+='<use href="#'+id+'" transform="translate('+n2(c*s)+','+n2(r*s)+') scale('+pk.toFixed(4)+')"/>';
  }
  return b+'</g>';
}

const CLOSE=[['king','w',2,1],['pawn','b',1,2]];
const CLOSE_BLOCK=new Set(['0,3']);
// the real opening line-up: kings on (7,1) and (1,7) with three pawns each
const START=[['king','w',7,1],['pawn','w',6,2],['pawn','w',6,1],['pawn','w',7,2],
             ['king','b',1,7],['pawn','b',2,6],['pawn','b',2,7],['pawn','b',1,6]];
// a scatter of impassable tiles, roughly the clusters generateMap makes
const START_BLOCK=new Set(['3,2','3,3','4,3','2,1','5,6','6,6','6,7','4,5','7,4','0,5','8,2']);

const A=176,B=250,X0=76,X1=X0+A+34,ROW=B+26;
let b='<text x="'+(X0+A/2)+'" y="20" class="n">Close-up</text>'
     +'<text x="'+(X1+B/2)+'" y="20" class="n">Full 9 \u00d7 9 board</text>';
Object.keys(THEMES).forEach(function(theme,r){
  const y=34+r*ROW,t=theme[0];
  b+='<text x="20" y="'+(y+B/2)+'" class="s">'+THEMES[theme].name+'</text>';
  b+=board(theme,t+'a',4,X0,y+(B-A)/2,A,CLOSE,CLOSE_BLOCK);
  b+=board(theme,t+'b',9,X1,y,B,START,START_BLOCK);
});

// the impassable tiles on their own: today's emoji next to the sticker
const SY=34+3*ROW+22,TS=64;
b+='<text x="20" y="'+(SY-10)+'" class="s">Impassable tiles \u2014 now / redrawn</text>';
Object.keys(THEMES).forEach(function(theme,i){
  const t=THEMES[theme],ob=OBSTACLES[theme],gx=76+i*164,y=SY;
  const cell=(x,art)=>'<g transform="translate('+x+','+y+')">'
    +'<rect width="'+TS+'" height="'+TS+'" rx="8" fill="'+t.dk+'"/>'+art+'</g>';
  b+=cell(gx,'<text x="'+(TS/2)+'" y="'+(TS/2+13)+'" style="font-size:36px" text-anchor="middle">'+ob.emoji+'</text>');
  b+=cell(gx+TS+10,'<g transform="scale('+(TS/100).toFixed(4)+')">'+ob.art+'</g>');
  b+='<text x="'+(gx+TS+5)+'" y="'+(y+TS+16)+'" class="s" style="text-anchor:middle">'+ob.label+'</text>';
});

const H=SY+TS+30,W=X1+B+10;
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 '+W+' '+H+'" role="img">'
  +'<title>Board scenery</title>'
  +'<desc>For each theme, a close-up of rounded tiles and a full nine by nine opening board, with jungle,'
  +' desert and ocean scenery scattered over the tiles, and the impassable tiles redrawn as stickers'
  +' beside the emoji they replace.</desc>'
  +'<style>.n{font:500 13px ui-sans-serif,system-ui,sans-serif;fill:var(--p,#2b2a27);text-anchor:middle}'
  +'.s{font:400 12px ui-sans-serif,system-ui,sans-serif;fill:var(--s,#6b6862)}</style>'
  +'<defs>'+defs.join('')+'</defs>'+b+'</svg>';
fs.writeFileSync(path.join(OUT,'boards.svg'),svg);
console.log('boards.svg',svg.length,'chars');
