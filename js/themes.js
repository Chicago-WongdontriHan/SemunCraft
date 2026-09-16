// ── THEME DEFINITIONS ────────────────────────────────────────────────────────

const THEMES={
  // the default map
  forest:{
    name:'Forest',
    lt:'#7a9e4c',dk:'#4a6e28',
    border:'#3a2810',
    bodyBg:'#0c1a08',
    tiles:{
      tree:    {chance:.12,icon:'🌳',label:'Tree',   effect:'Impassable obstacle',block:true},
    },
    neutral:{emoji:'\uD83E\uDD8C',hp:2,maxHp:2,name:'Deer',desc:'Roams the forest'},
    attacker:{emoji:'\uD83D\uDC3A',hp:1,maxHp:1,name:'Wolf',desc:'Attacks adjacent pieces',aggressive:true},
    neutralCount:2,
  },
  // palms go down in clumps first, then one small temple ruin, then patches of undergrowth,
  // which hide whatever stands in them (see inCover in movement.js)
  jungle:{
    name:'Jungle',
    lt:'#4f9b5e',dk:'#2d7243',
    border:'#1f3a1c',
    bodyBg:'#06170f',
    tiles:{
      palm:    {chance:.09,icon:'\uD83C\uDF34',label:'Palm',effect:'Impassable obstacle',block:true},
      temple:  {chance:.04,icon:'\uD83C\uDFDB',label:'Temple Ruins',effect:'Impassable obstacle',block:true},
      undergrowth:{chance:.08,icon:'\uD83C\uDF3F',label:'Undergrowth',effect:'Hides a piece from enemies that are not next to it',block:false},
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

// the obstacle a hand-placed map (campaign level, tutorial) uses on a theme: its first blocking tile type
function themeObstacle(theme){
  const tiles=(THEMES[theme]||THEMES.forest).tiles;
  return Object.keys(tiles).find(t=>tiles[t].block)||'tree';
}

function selectMap(theme){
  mapTheme=theme;
  ['forest','jungle','desert','ocean'].forEach(t=>{
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
  // attacker: forest/jungle/ocean place one; desert attacker comes from pyramid only
  if(th.attacker)placeOneAnimal(th.attacker,true);
  if(ANIMALS_ON)startAnimalLoop();   // start continuous animation loop
  else{animals=[];stopAnimalLoop();}
}

function getTileEffect(i){
  const t=tileData[i];if(!t)return null;
  const th=THEMES[mapTheme];if(!th)return null;
  return th.tiles[t]||null;
}
