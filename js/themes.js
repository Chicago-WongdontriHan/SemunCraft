// ── THEME DEFINITIONS ────────────────────────────────────────────────────────

// ── THEMATIC ENEMY PIECE SVG ─────────────────────────────────────────────────
const THEME_SVG_DECOS={
  jungle:{
    pawn:`
      <path d="M30,80 Q18,64 24,50 Q30,38 22,28" stroke="#3a8020" stroke-width="2.5" fill="none" opacity=".85"/>
      <path d="M70,80 Q82,64 76,50 Q70,38 78,28" stroke="#3a8020" stroke-width="2.5" fill="none" opacity=".85"/>
      <ellipse cx="20" cy="44" rx="7" ry="4.5" fill="#60c030" transform="rotate(-20,20,44)" opacity=".8"/>
      <ellipse cx="80" cy="44" rx="7" ry="4.5" fill="#60c030" transform="rotate(20,80,44)" opacity=".8"/>
      <ellipse cx="19" cy="30" rx="5" ry="3.5" fill="#48a020" transform="rotate(10,19,30)" opacity=".75"/>
      <ellipse cx="81" cy="30" rx="5" ry="3.5" fill="#48a020" transform="rotate(-10,81,30)" opacity=".75"/>`,
    knight:`
      <path d="M68,82 Q88,72 92,54 Q90,38 76,44" stroke="#3a8020" stroke-width="3" fill="none" opacity=".8"/>
      <ellipse cx="92" cy="40" rx="9" ry="6" fill="#60c030" opacity=".75"/>
      <path d="M28,78 Q10,68 12,50" stroke="#3a8020" stroke-width="2" fill="none" opacity=".65"/>
      <ellipse cx="25" cy="22" rx="6" ry="4" fill="#48a020" opacity=".7" transform="rotate(-15,25,22)"/>`,
    bishop:`
      <ellipse cx="50" cy="16" rx="9" ry="5.5" fill="#60c030" opacity=".8" transform="rotate(-35,50,16)"/>
      <ellipse cx="50" cy="16" rx="9" ry="5.5" fill="#60c030" opacity=".8" transform="rotate(35,50,16)"/>
      <ellipse cx="50" cy="16" rx="8" ry="5" fill="#48a020" opacity=".85"/>
      <circle cx="50" cy="16" r="4.5" fill="#c8e820" opacity=".9"/>
      <path d="M35,70 Q22,58 24,44" stroke="#3a8020" stroke-width="2" fill="none" opacity=".6"/>
      <ellipse cx="22" cy="40" rx="5" ry="3.5" fill="#60c030" opacity=".65" transform="rotate(15,22,40)"/>`,
    rook:`
      <path d="M28,24 Q16,12 10,5" stroke="#3a8020" stroke-width="2.5" fill="none" opacity=".8"/>
      <path d="M72,24 Q84,12 90,5" stroke="#3a8020" stroke-width="2.5" fill="none" opacity=".8"/>
      <path d="M50,18 Q50,8 50,2" stroke="#3a8020" stroke-width="2.5" fill="none" opacity=".8"/>
      <ellipse cx="10" cy="5" rx="8" ry="5.5" fill="#60c030" opacity=".8"/>
      <ellipse cx="90" cy="5" rx="8" ry="5.5" fill="#60c030" opacity=".8"/>
      <ellipse cx="50" cy="2" rx="8" ry="5.5" fill="#60c030" opacity=".8"/>
      <path d="M20,52 Q14,44 16,34" stroke="#3a8020" stroke-width="2" fill="none" opacity=".55"/>`,
    king:`
      <path d="M50,78 Q18,72 12,50 Q18,28 50,32 Q82,28 88,50 Q82,72 50,78Z" fill="#2a5a10" opacity=".28"/>
      <ellipse cx="15" cy="52" rx="13" ry="18" fill="#1a3a08" opacity=".38"/>
      <ellipse cx="85" cy="52" rx="13" ry="18" fill="#1a3a08" opacity=".38"/>
      <path d="M50,30 Q42,20 38,10 M50,30 Q58,20 62,10" stroke="#3a8020" stroke-width="2.5" fill="none" opacity=".7"/>
      <ellipse cx="38" cy="8" rx="6" ry="4.5" fill="#60c030" opacity=".8"/>
      <ellipse cx="62" cy="8" rx="6" ry="4.5" fill="#60c030" opacity=".8"/>`,
  },
  desert:{
    pawn:`
      <path d="M50,82 Q28,68 18,50 Q24,36 36,44 Q46,50 50,62Z" fill="#c8a040" opacity=".5"/>
      <path d="M50,82 Q72,68 82,50 Q76,36 64,44 Q54,50 50,62Z" fill="#c8a040" opacity=".5"/>
      <circle cx="50" cy="58" r="5" fill="#d06810" opacity=".6"/>
      <ellipse cx="22" cy="46" rx="4" ry="3" fill="#a07828" opacity=".5" transform="rotate(-20,22,46)"/>
      <ellipse cx="78" cy="46" rx="4" ry="3" fill="#a07828" opacity=".5" transform="rotate(20,78,46)"/>`,
    knight:`
      <path d="M28,92 Q8,78 12,58 Q18,38 38,44 Q52,48 46,66 Q40,80 58,86" stroke="#c8a040" stroke-width="3" fill="none" opacity=".75"/>
      <ellipse cx="60" cy="88" rx="7" ry="5" fill="#d06810" opacity=".7" transform="rotate(20,60,88)"/>
      <circle cx="11" cy="56" r="4" fill="#a07828" opacity=".6"/>`,
    bishop:`
      <circle cx="50" cy="16" r="10" fill="#c8c0a0" opacity=".85"/>
      <ellipse cx="45" cy="14" rx="3.5" ry="4" fill="#1a0e04" opacity=".7"/>
      <ellipse cx="55" cy="14" rx="3.5" ry="4" fill="#1a0e04" opacity=".7"/>
      <rect x="43" y="21" width="14" height="2.5" rx="1" fill="#1a0e04" opacity=".6"/>
      <rect x="46" y="23.5" width="8" height="2" rx="1" fill="#1a0e04" opacity=".5"/>
      <path d="M38,72 Q28,62 30,48" stroke="#c8a040" stroke-width="2" fill="none" opacity=".55"/>`,
    rook:`
      <path d="M28,16 L24,34 L32,50" stroke="#d06810" stroke-width="2.5" fill="none" opacity=".7"/>
      <path d="M72,16 L76,34 L68,50" stroke="#d06810" stroke-width="2.5" fill="none" opacity=".7"/>
      <path d="M42,22 L50,38 L58,22" stroke="#c8a040" stroke-width="2" fill="none" opacity=".6"/>
      <circle cx="50" cy="40" r="4" fill="#d06810" opacity=".5"/>
      <path d="M18,48 Q12,40 14,28" stroke="#a07828" stroke-width="1.5" fill="none" opacity=".5"/>
      <path d="M82,48 Q88,40 86,28" stroke="#a07828" stroke-width="1.5" fill="none" opacity=".5"/>`,
    king:`
      <path d="M50,78 Q16,72 10,48 Q16,24 50,28 Q84,24 90,48 Q84,72 50,78Z" fill="#c8a040" opacity=".3"/>
      <line x1="50" y1="26" x2="50" y2="10" stroke="#c8a040" stroke-width="3.5" opacity=".75"/>
      <line x1="34" y1="28" x2="25" y2="15" stroke="#c8a040" stroke-width="3" opacity=".7"/>
      <line x1="66" y1="28" x2="75" y2="15" stroke="#c8a040" stroke-width="3" opacity=".7"/>
      <line x1="18" y1="44" x2="6" y2="40" stroke="#c8a040" stroke-width="2.5" opacity=".65"/>
      <line x1="82" y1="44" x2="94" y2="40" stroke="#c8a040" stroke-width="2.5" opacity=".65"/>
      <circle cx="50" cy="9" r="5" fill="#c8a040" opacity=".8"/>`,
  },
  ocean:{
    pawn:`
      <path d="M34,88 Q18,80 14,68 Q18,60 28,66" stroke="#1a60d0" stroke-width="3" fill="none" opacity=".8"/>
      <path d="M66,88 Q82,80 86,68 Q82,60 72,66" stroke="#1a60d0" stroke-width="3" fill="none" opacity=".8"/>
      <circle cx="13" cy="66" r="5.5" fill="#20a080" opacity=".8"/>
      <circle cx="87" cy="66" r="5.5" fill="#20a080" opacity=".8"/>
      <path d="M13,60 L10,54 M13,60 L16,54" stroke="#1a60d0" stroke-width="1.5" fill="none" opacity=".7"/>
      <path d="M87,60 L84,54 M87,60 L90,54" stroke="#1a60d0" stroke-width="1.5" fill="none" opacity=".7"/>`,
    knight:`
      <path d="M28,88 Q10,76 14,58" stroke="#1a60d0" stroke-width="2.5" fill="none" opacity=".75"/>
      <path d="M42,94 Q30,84 34,68" stroke="#1a60d0" stroke-width="2" fill="none" opacity=".7"/>
      <path d="M60,94 Q72,84 68,68" stroke="#1a60d0" stroke-width="2" fill="none" opacity=".7"/>
      <path d="M76,88 Q92,76 88,58" stroke="#1a60d0" stroke-width="2.5" fill="none" opacity=".75"/>
      <circle cx="12" cy="56" r="4" fill="#20a080" opacity=".75"/>
      <circle cx="88" cy="56" r="4" fill="#20a080" opacity=".75"/>`,
    bishop:`
      <path d="M33,95 Q50,82 67,95 Q57,102 50,98 Q43,102 33,95Z" fill="#20a080" opacity=".78"/>
      <circle cx="42" cy="62" r="3" fill="#1a60d0" opacity=".45"/>
      <circle cx="58" cy="62" r="3" fill="#1a60d0" opacity=".45"/>
      <circle cx="50" cy="52" r="3" fill="#1a60d0" opacity=".45"/>
      <circle cx="42" cy="72" r="2.5" fill="#1a60d0" opacity=".35"/>
      <circle cx="58" cy="72" r="2.5" fill="#1a60d0" opacity=".35"/>
      <path d="M30,80 Q20,70 22,56" stroke="#1a60d0" stroke-width="2" fill="none" opacity=".5"/>`,
    rook:`
      <path d="M50,4 Q60,16 68,30 Q58,26 50,30 Q42,26 32,30 Q40,16 50,4Z" fill="#1a60d0" opacity=".72"/>
      <path d="M18,48 Q34,42 50,48 Q66,42 82,48" stroke="#20a080" stroke-width="2.5" fill="none" opacity=".65"/>
      <path d="M20,56 Q36,50 50,56 Q64,50 80,56" stroke="#20a080" stroke-width="1.8" fill="none" opacity=".45"/>
      <circle cx="50" cy="4" r="4" fill="#20a080" opacity=".8"/>`,
    king:`
      <path d="M22,88 Q6,76 8,58 Q12,48 20,56" stroke="#1a60d0" stroke-width="3.5" fill="none" opacity=".8"/>
      <path d="M78,88 Q94,76 92,58 Q88,48 80,56" stroke="#1a60d0" stroke-width="3.5" fill="none" opacity=".8"/>
      <path d="M32,92 Q20,104 16,94" stroke="#1a60d0" stroke-width="2.5" fill="none" opacity=".7"/>
      <path d="M68,92 Q80,104 84,94" stroke="#1a60d0" stroke-width="2.5" fill="none" opacity=".7"/>
      <circle cx="8" cy="58" r="4" fill="#20a080" opacity=".8"/>
      <circle cx="92" cy="58" r="4" fill="#20a080" opacity=".8"/>
      <circle cx="15" cy="93" r="3.5" fill="#20a080" opacity=".7"/>
      <circle cx="85" cy="93" r="3.5" fill="#20a080" opacity=".7"/>`,
  },
};

function buildBlackPieceSVG(type,sz){
  if(type==='siege'){
    return `<svg viewBox="0 0 100 100" width="${sz}" height="${sz}" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="55" width="60" height="35" rx="3" fill="#3a1a08" stroke="#8a5020" stroke-width="2"/>
      <rect x="20" y="42" width="14" height="18" rx="2" fill="#2e1506" stroke="#8a5020" stroke-width="1.5"/>
      <rect x="43" y="42" width="14" height="18" rx="2" fill="#2e1506" stroke="#8a5020" stroke-width="1.5"/>
      <rect x="66" y="42" width="14" height="18" rx="2" fill="#2e1506" stroke="#8a5020" stroke-width="1.5"/>
      <rect x="18" y="50" width="64" height="6" rx="1" fill="#4a2010"/>
      <line x1="32" y1="68" x2="68" y2="88" stroke="#e05020" stroke-width="4" stroke-linecap="round"/>
      <line x1="68" y1="68" x2="32" y2="88" stroke="#e05020" stroke-width="4" stroke-linecap="round"/>
      <circle cx="32" cy="68" r="3" fill="#ff7040"/>
      <circle cx="68" cy="68" r="3" fill="#ff7040"/>
    </svg>`;
  }
  const theme=mapTheme||'jungle';
  const deco=THEME_SVG_DECOS[theme]?.[type]||'';
  const glyph=GLYPH[type+'_b']||'?';
  const fs=Math.floor(sz*0.72);
  return `<svg viewBox="0 0 100 100" width="${sz}" height="${sz}" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;overflow:visible;pointer-events:none;">
  <text x="50" y="64" text-anchor="middle" dominant-baseline="middle"
    font-size="${fs}" font-family="Georgia,serif"
    fill="#1a0e04" style="filter:drop-shadow(0 0 2px rgba(200,200,150,.4));">${glyph}</text>
  ${deco}
</svg>`;
}

const THEMES={
  jungle:{
    name:'Jungle',
    lt:'#7a9e4c',dk:'#4a6e28',
    border:'#3a2810',
    bodyBg:'#0c1a08',
    tiles:{
      tree:    {chance:.12,icon:'🌳',label:'Tree',   effect:'Impassable obstacle',block:true},
    },
    neutral:{emoji:'\uD83D\uDC12',hp:2,maxHp:2,name:'Monkey',desc:'Roams the jungle'},
    attacker:{emoji:'\uD83D\uDC0D',hp:1,maxHp:1,name:'Snake',desc:'Attacks adjacent pieces',aggressive:true},
    neutralCount:2,
  },
  desert:{
    name:'Desert',
    lt:'#c8a84a',dk:'#a07828',
    border:'#5a3818',
    bodyBg:'#3d2e0a',
    tiles:{
      sandstone: {chance:.12,icon:'\uD83D\uDFE7',label:'Sandstone',effect:'Impassable obstacle',block:true},
    },
    neutral:{emoji:'\uD83D\uDC2A',hp:3,maxHp:3,name:'Camel',desc:'Roams the desert'},
    attacker:null, // mummy spawns from pyramid only
    neutralCount:2,
  },
  ocean:{
    name:'Ocean',
    lt:'#4a80c8',dk:'#2a5898',
    border:'#1a2060',
    bodyBg:'#050a1a',
    tiles:{
      rocks:  {chance:.12,icon:'\uD83E\uDEA8',label:'Sea Rocks',effect:'Impassable obstacle',block:true},
    },
    neutral:{emoji:'\uD83E\uDD80',hp:1,maxHp:1,name:'Crab',desc:'Scuttles the ocean floor'},
    attacker:{emoji:'\uD83E\uDD88',hp:2,maxHp:2,name:'Shark',desc:'Patrols and attacks pieces',aggressive:true},
    neutralCount:2,
  },
};

function selectMap(theme){
  mapTheme=theme;
  ['jungle','desert','ocean'].forEach(t=>{
    const b=document.getElementById('mbtn-'+t);
    if(b)b.classList.toggle('sel-map',t===theme);
  });
  document.body.className='theme-'+theme;
  // Regenerate obstacle preview on title screen
  const boardEl=document.getElementById('board');
  if(boardEl&&document.getElementById('intro')&&!document.getElementById('intro').classList.contains('hidden')){
    generateMap(); // regenerate tileData for new theme
    titleTileData=tileData.slice(); // save for single-player reuse
    titleAnimals=animals.map(a=>({...a}));
    stopAnimalLoop(); animals=[]; // no animals on title screen
    render(); // re-render board with new theme tiles + obstacles
    resizeBoard(); // re-apply sizing
  }
}

function generateMap(){
  tileData=new Array(ROWS*COLS).fill('');
  neutralPieces={};
  animals=[];
  const th=THEMES[mapTheme];
  if(!th)return;
  // Apply theme to board colors
  document.body.className='theme-'+mapTheme;
  // scatter tiles in clusters
  const tileTypes=Object.keys(th.tiles);
  // tutorial mode: detect if we're in tutorial (animals already cleared)
  const isTutorial=(document.getElementById('tutorial-overlay')?.classList.contains('show'));
  const midR=Math.floor(ROWS/2), midC=Math.floor(COLS/2);
  const tutExclude=new Set(); // center 3x3 excluded in tutorial
  if(isTutorial){
    for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++){
      const r=midR+dr,c=midC+dc;if(inB(r,c))tutExclude.add(idx(r,c));
    }
  }

  tileTypes.forEach(ttype=>{
    const info=th.tiles[ttype];
    const isBlock=!!info.block;
    const count=Math.round(info.chance*ROWS*COLS);

    if(!isBlock){
      // non-obstacle tiles: original cluster flood-fill
      const seeds=[];
      for(let k=0;k<Math.ceil(count/3);k++) seeds.push(Math.floor(Math.random()*ROWS*COLS));
      seeds.forEach(seed=>{
        const toFill=Math.ceil(count/seeds.length);
        const q=[seed];const seen=new Set([seed]);let placed=0;
        while(q.length&&placed<toFill){
          const cur=q.shift();const r=ROW(cur);
          if(r>=3&&r<=ROWS-4&&!tileData[cur]&&!pieces[cur]&&!tutExclude.has(cur)){tileData[cur]=ttype;placed++;}
          adj8(cur).forEach(n=>{if(!seen.has(n)&&Math.random()<.5){seen.add(n);q.push(n);}});
        }
      });
    }else{
      // OBSTACLE tiles: small chunks, avg ~2.5 tiles, max 6 in any row or column
      const numChunks=Math.round(count/2.5);
      const safeR=(r)=>r>=3&&r<=ROWS-4;

      // helper: count consecutive blocked in a direction from a tile (including that tile)
      const runLen=(ti,dr,dc)=>{
        let run=0;let r=ROW(ti),c=COL(ti);
        // count backward
        for(let s=1;s<=6;s++){const nr=r-dr*s,nc=c-dc*s;if(!inB(nr,nc))break;if(isTileBlocked(idx(nr,nc))||tileData[idx(nr,nc)]===ttype)run++;else break;}
        // count forward
        for(let s=1;s<=6;s++){const nr=r+dr*s,nc=c+dc*s;if(!inB(nr,nc))break;if(isTileBlocked(idx(nr,nc))||tileData[idx(nr,nc)]===ttype)run++;else break;}
        return run+1; // +1 for tile itself
      };

      const canPlace=(ti)=>{
        if(!inB(ROW(ti),COL(ti)))return false;
        if(!safeR(ROW(ti)))return false;
        if(tileData[ti]||pieces[ti])return false;
        if(tutExclude.has(ti))return false;
        // max run of 6 in row or column
        if(runLen(ti,0,1)>6||runLen(ti,1,0)>6)return false;
        return true;
      };

      let placed=0;
      for(let chunk=0;chunk<numChunks&&placed<count;chunk++){
        // pick random valid seed
        let seed=-1;
        for(let att=0;att<60;att++){
          const t=Math.floor(Math.random()*ROWS*COLS);
          if(canPlace(t)){seed=t;break;}
        }
        if(seed<0)continue;
        // grow chunk: avg 2.5 tiles via random adjacency walk
        const chunkSize=Math.random()<0.5?2:Math.random()<0.5?3:Math.random()<0.4?1:4;
        const frontier=[seed];const inChunk=new Set([seed]);
        tileData[seed]=ttype;placed++;
        for(let step=1;step<chunkSize&&placed<count;step++){
          let added=false;
          // try to extend from a random frontier tile
          const shuffled=[...frontier].sort(()=>Math.random()-.5);
          for(const cur of shuffled){
            const nbrs=adj8(cur).filter(n=>!inChunk.has(n)&&canPlace(n));
            if(nbrs.length){
              const nb=nbrs[Math.floor(Math.random()*nbrs.length)];
              tileData[nb]=ttype;inChunk.add(nb);frontier.push(nb);placed++;added=true;break;
            }
          }
          if(!added)break;
        }
      }
    }
  });

  // ── PATHFINDING VALIDATION ──────────────────────────────────────────────────
  // Ensure at least one cardinal path (for rook) and one diagonal path (for bishop)
  // can reach from one king zone to the other. If not, remove blocking obstacles.
  const wKiPos=idx(7,1), bKiPos=idx(1,7);

  function hasPath(startPos,endPos,dirSet){
    // BFS using only the given directions through non-blocked tiles
    const visited=new Set([startPos]);
    const queue=[startPos];
    while(queue.length){
      const cur=queue.shift();
      if(cur===endPos)return true;
      const r=ROW(cur),c=COL(cur);
      for(const [dr,dc] of dirSet){
        const nr=r+dr,nc=c+dc;
        if(!inB(nr,nc))continue;
        const ni=idx(nr,nc);
        if(visited.has(ni))continue;
        if(isTileBlocked(ni))continue;
        visited.add(ni);
        queue.push(ni);
      }
    }
    return false;
  }

  function findBlockers(startPos,endPos,dirSet){
    // BFS that also steps through blocked tiles, tracking which obstacles are in the way.
    // Returns the set of obstacle tile indices on the shortest path.
    const visited=new Map(); // idx -> {parent, wasBlocked}
    visited.set(startPos,{parent:-1,wasBlocked:false});
    const queue=[startPos];
    while(queue.length){
      const cur=queue.shift();
      if(cur===endPos){
        // trace back to find all blocked tiles on this path
        const blockers=[];
        let t=cur;
        while(t!==-1){
          const info=visited.get(t);
          if(info.wasBlocked)blockers.push(t);
          t=info.parent;
        }
        return blockers;
      }
      const r=ROW(cur),c=COL(cur);
      for(const [dr,dc] of dirSet){
        const nr=r+dr,nc=c+dc;
        if(!inB(nr,nc))continue;
        const ni=idx(nr,nc);
        if(visited.has(ni))continue;
        visited.set(ni,{parent:cur,wasBlocked:isTileBlocked(ni)});
        queue.push(ni);
      }
    }
    return [];
  }

  const cardinalDirs=[[0,1],[0,-1],[1,0],[-1,0]];
  const diagonalDirs=[[1,1],[1,-1],[-1,1],[-1,-1]];

  // Check cardinal path (rook)
  if(!hasPath(wKiPos,bKiPos,cardinalDirs)){
    const blockers=findBlockers(wKiPos,bKiPos,cardinalDirs);
    blockers.forEach(ti=>{tileData[ti]='';});
  }
  // Check diagonal path (bishop)
  if(!hasPath(wKiPos,bKiPos,diagonalDirs)){
    const blockers=findBlockers(wKiPos,bKiPos,diagonalDirs);
    blockers.forEach(ti=>{tileData[ti]='';});
  }

  // desert: mark one sandstone as mummy-spawner pyramid
  if(mapTheme==='desert'){
    const sTiles=[];
    for(let i=0;i<ROWS*COLS;i++){if(tileData[i]==='sandstone')sTiles.push(i);}
    if(sTiles.length){
      const pt=sTiles[Math.floor(Math.random()*sTiles.length)];
      tileData[pt]='sandstone-spawner';
      const pr2=ROW(pt),pc2=COL(pt);
      // place mummy on an adjacent open tile (not on the blocked pyramid itself)
      const mStart=adj8(pt).find(j=>!isTileBlocked(j)&&inB(ROW(j),COL(j)))||pt;
      const mr=ROW(mStart),mc2=COL(mStart);
      animals.push({emoji:'\uD83E\uDDDF',hp:2,maxHp:2,name:'Mummy',aggressive:true,fractDmg:0,
        x:mc2+0.5,y:mr+0.5,prevTileR:mr,prevTileC:mc2,tx:mc2+0.5,ty:mr+0.5,
        speed:0.0005,waitMs:1500,isMummy:true,spawnedFromPyramid:pt});
    }
  }
  // ocean: add one tornado as a roaming animal
  if(mapTheme==='ocean'){
    const eM=[];
    for(let i=0;i<ROWS*COLS;i++){const r=ROW(i);if(r>=3&&r<=ROWS-4&&!tileData[i]&&!pieces[i])eM.push(i);}
    if(eM.length){
      const ti=eM[Math.floor(Math.random()*eM.length)];
      const r=ROW(ti),cl=COL(ti);
      animals.push({emoji:'\uD83C\uDF2A',hp:3,maxHp:3,name:'Tornado',aggressive:false,fractDmg:0,
        x:cl+0.5,y:r+0.5,prevTileR:r,prevTileC:cl,tx:cl+0.5,ty:r+0.5,
        speed:0.0004,waitMs:2000,isTornado:true,spawnTimer:0});
    }
  }
  // place animals: one neutral type + one attacker type per theme
  // (don't reset animals[] here — mummy/tornado already added above)
  function placeOneAnimal(atype,isAggressive){
    let col,row,att=0;
    do{col=2+Math.floor(Math.random()*(COLS-4));row=3+Math.floor(Math.random()*(ROWS-6));att++;}
    while(att<40&&(pieces[idx(row,col)]||isTileBlocked(idx(row,col))));
    if(isTileBlocked(idx(row,col)))return;
    animals.push({emoji:atype.emoji,hp:atype.maxHp,maxHp:atype.maxHp,
      name:atype.name,aggressive:isAggressive,fractDmg:0,
      x:col+0.5,y:row+0.5,prevTileR:row,prevTileC:col,tx:col+0.5,ty:row+0.5,
      speed:0.0005+Math.random()*0.0003,waitMs:0});
  }
  const nc=th.neutralCount||2;
  for(let k=0;k<nc;k++){if(th.neutral)placeOneAnimal(th.neutral,false);}
  // attacker: jungle/ocean place one; desert attacker comes from pyramid only
  if(th.attacker)placeOneAnimal(th.attacker,true);
  // start continuous animation loop
  startAnimalLoop();
}

function getTileEffect(i){
  const t=tileData[i];if(!t)return null;
  const th=THEMES[mapTheme];if(!th)return null;
  return th.tiles[t]||null;
}
