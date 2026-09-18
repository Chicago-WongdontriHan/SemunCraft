// Draws the home-screen icons for the installable game (manifest.webmanifest) from the game's own
// pieces: the White King on a Forest board, a pawn with sword and buckler at his side.
//   icons/icon.svg            the design, full bleed (iOS rounds the corners itself)
//   icons/icon-maskable.svg   the same with the pieces drawn smaller, inside the circle Android crops to
//   icons/apple-touch-icon.png 180x180, icon-192.png, icon-512.png, icon-maskable-512.png
// The PNGs are rendered by a headless Chrome (or Edge) — whichever is installed.
// Run: node img/make-app-icons.js
const fs=require('fs'),path=require('path'),vm=require('vm'),{execFileSync}=require('child_process');
const ROOT=path.join(__dirname,'..'),OUT=path.join(ROOT,'icons');
const ctx={console};vm.createContext(ctx);
for(const f of ['pieces/pieces.js','pieces/forest.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),ctx,{filename:f});
const pieceSVG=ctx.pieceSVG;

// the Forest board's tiles and frame, as the game draws them (THEMES.forest, --tile-frame)
const LT='#7a9e4c',DK='#4a6e28',FRAME='#3c5a1e';
function iconSVG(size,scale){
  const T=128;
  let s='<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 512 512">'
    +'<defs><radialGradient id="v" cx="50%" cy="46%" r="62%"><stop offset="55%" stop-color="#000" stop-opacity="0"/>'
    +'<stop offset="100%" stop-color="#000" stop-opacity=".42"/></radialGradient>'
    +'<radialGradient id="g" cx="50%" cy="42%" r="40%"><stop offset="0%" stop-color="#FFF3B0" stop-opacity=".55"/>'
    +'<stop offset="100%" stop-color="#FFF3B0" stop-opacity="0"/></radialGradient></defs>'
    +'<rect width="512" height="512" fill="'+FRAME+'"/>';
  // a 4x4 corner of the board, then a warm light behind the King and a darker edge
  for(let r=0;r<4;r++)for(let c=0;c<4;c++)
    s+='<rect x="'+(c*T+4)+'" y="'+(r*T+4)+'" width="'+(T-8)+'" height="'+(T-8)+'" rx="16" fill="'+((r+c)%2?DK:LT)+'"/>';
  s+='<rect width="512" height="512" fill="url(#g)"/><rect width="512" height="512" fill="url(#v)"/>';
  const at=(svg,x,y)=>svg.replace('<svg ','<svg x="'+x+'" y="'+y+'" ');
  const o=256*(1-scale);
  s+='<g transform="translate('+o+','+o+') scale('+scale+')">'
    +at(pieceSVG('king','w','forest',330),91,66)+at(pieceSVG('pawn','w','forest',210),286,272)+'</g>';
  return s+'</svg>';
}

fs.mkdirSync(OUT,{recursive:true});
fs.writeFileSync(path.join(OUT,'icon.svg'),iconSVG(512,1));
fs.writeFileSync(path.join(OUT,'icon-maskable.svg'),iconSVG(512,0.78));

const BROWSERS=['C:/Program Files/Google/Chrome/Application/chrome.exe','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome','/usr/bin/chromium','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'];
const browser=BROWSERS.find(p=>fs.existsSync(p));
if(!browser){console.log('SVGs written; no Edge or Chrome found to render the PNGs');process.exit(0);}
const tmp=fs.mkdtempSync(path.join(require('os').tmpdir(),'semun-icons-'));
for(const[name,size,scale]of[['apple-touch-icon.png',180,1],['icon-192.png',192,1],['icon-512.png',512,1],['icon-maskable-512.png',512,0.78]]){
  const svg=path.join(tmp,name+'.svg');
  fs.writeFileSync(svg,iconSVG(size,scale));
  execFileSync(browser,['--headless','--disable-gpu','--no-first-run','--hide-scrollbars','--force-device-scale-factor=1',
    '--user-data-dir='+path.join(tmp,'profile'),'--window-size='+size+','+size,'--screenshot='+path.join(OUT,name),
    'file:///'+svg.replace(/\\/g,'/')],{stdio:'ignore',timeout:60000});
  console.log(name,fs.statSync(path.join(OUT,name)).size,'bytes');
}
fs.rmSync(tmp,{recursive:true,force:true});
