// Draws the King and the Queen as the game draws them (pieces/pieces.js), large and at the size a
// 9x9 board shows them, in both colours: node pieces/combined/king-queen-make.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..','..'),OUT=__dirname;
const ctx={console};vm.createContext(ctx);
for(const f of ['pieces/pieces.js','pieces/jungle.js','pieces/desert.js','pieces/ocean.js'])
  vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),ctx,{filename:f});
const pieceSVG=ctx.pieceSVG;
const inner=s=>s.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');

const S=1.03,TY=(120-100*S)/2;
const defs=[],seen=new Set();
function use(type,color,x,y,size,dark){
  const id=type+'-'+color;
  if(!seen.has(id))
    {seen.add(id);defs.push('<g id="'+id+'"><g transform="translate('+TY.toFixed(2)+','+TY.toFixed(2)
      +') scale('+S+')">'+inner(pieceSVG(type,color,'jungle',100))+'</g></g>');}
  return '<g transform="translate('+x+','+y+') scale('+(size/120).toFixed(4)+')">'
    +'<rect width="120" height="120" fill="'+(dark?'#4a6e28':'#7a9e4c')+'"/><use href="#'+id+'"/></g>';
}
let b='<text x="150" y="22" class="n">King</text><text x="310" y="22" class="n">Queen</text>'
  +'<text x="530" y="22" class="n">on the board</text>';
[['White','w'],['Black','b']].forEach(([label,color],r)=>{
  const y=34+r*162,sy=y+45;
  b+='<text x="40" y="'+(y+80)+'" class="s">'+label+'</text>'
    +use('king',color,90,y,150,r===1)+use('queen',color,240,y,150,r===0)
    +use('king',color,460,sy,60,r===0)+use('queen',color,530,sy,60,r===1);
});
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 680 376" role="img">'
  +'<title>King and Queen</title><desc>The King, broad under a flat crown with a cross, and the Queen,'
  +' slim with long hair, a tall crown and a sceptre, in White and in Black, large and at board size.</desc>'
  +'<style>.n{font:500 14px ui-sans-serif,system-ui,sans-serif;fill:var(--p,#2b2a27);text-anchor:middle}'
  +'.s{font:400 12px ui-sans-serif,system-ui,sans-serif;fill:var(--s,#6b6862)}</style>'
  +'<defs>'+defs.join('')+'</defs>'+b+'</svg>';
fs.writeFileSync(path.join(OUT,'king-queen.svg'),svg);
console.log('king-queen.svg',svg.length,'chars');
