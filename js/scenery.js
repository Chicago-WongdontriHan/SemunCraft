// ── BOARD SCENERY ────────────────────────────────────────────────────────────
// Every square gets a little sticker drawn in the same outlined style as the pieces:
// free tiles get a small motif tucked into a corner, impassable tiles get one big
// drawing that fills the square so a blocked tile never reads as free ground.
// Which motif a square gets comes from a hash of its row and column, so a map always
// looks the same; nothing here touches the game's random numbers or its rules.

// outline-then-colour, the board-sized cousin of pieceStroke
const scStroke=(d,color,w,ink)=>'<path d="'+d+'" fill="none" stroke="'+ink+'" stroke-width="'+(w+1.6)
  +'" stroke-linecap="round" stroke-linejoin="round"/><path d="'+d+'" fill="none" stroke="'+color
  +'" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round"/>';
const scShape=(d,fill,ink,w)=>'<path d="'+d+'" fill="'+fill+'" stroke="'+ink+'" stroke-width="'+(w||1.6)
  +'" stroke-linejoin="round"/>';
const scDot=(x,y,r,fill,ink,w)=>'<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+fill+'" stroke="'+ink
  +'" stroke-width="'+(w||1.6)+'"/>';

const SC_JI='rgba(20,40,8,.55)', SC_DI='rgba(72,44,8,.5)', SC_OI='rgba(6,26,60,.5)';

// scenery is drawn in a 40x40 tile-local box; quiet ground textures first, then features
const SCENERY={
  jungle:{
    quiet:[
      scStroke('M8 33 L6 25 M13 33 L13 23 M18 33 L20 25','#6CC04A',2.6,SC_JI),
      scStroke('M6 34 L4 28 M11 34 L10 26 M16 34 L18 28 M21 34 L23 29','#5FB03F',2.4,SC_JI),
      scShape('M6 30 C10 24 18 24 21 29 C17 34 9 35 6 30 Z','#7FC258',SC_JI)
        +scStroke('M7 30 C12 29 17 29 20 29','#4E8C33',1.2,'rgba(0,0,0,0)'),
    ],
    feature:[
      // the same little flower the pieces stand by
      scStroke('M13 33 V22','#4E8C33',2.2,SC_JI)+scShape('M13 26 C8 24 6 28 11 29 Z','#6CC04A',SC_JI,1.4)
        +scDot(13,18,5,'#FF9EC4',SC_JI,1.8)+scDot(13,18,2,'#FFD84D',SC_JI,1.2),
      // mushroom
      scShape('M10 33 C10 27 16 27 16 33 Z','#FFF0B8',SC_JI,1.5)
        +scShape('M4 26 C4 15 22 15 22 26 Z','#E4533D',SC_JI,1.8)
        +scDot(9,22,1.8,'#FFF6E0','rgba(0,0,0,0)',0)+scDot(16,23.5,1.4,'#FFF6E0','rgba(0,0,0,0)',0),
      // fern frond
      scStroke('M7 34 C9 26 13 20 20 16','#4E8C33',2.2,SC_JI)
        +scStroke('M9 28 L5 26 M11 24 L7 21 M14 21 L11 17 M17 18 L15 14','#6CC04A',2,SC_JI),
      // clover
      scStroke('M13 34 V26','#4E8C33',2,SC_JI)+scDot(9,22,4,'#6CC04A',SC_JI,1.5)
        +scDot(17,22,4,'#6CC04A',SC_JI,1.5)+scDot(13,17,4,'#6CC04A',SC_JI,1.5),
    ],
  },
  desert:{
    quiet:[
      scStroke('M5 27 Q12 21 20 27 M12 33 Q19 27 27 33','#EBCE86',2.2,SC_DI),
      '<ellipse cx="10" cy="30" rx="5" ry="3.2" fill="#F4D58D" stroke="'+SC_DI+'" stroke-width="1.7"/>'
        +'<ellipse cx="18" cy="32.5" rx="3.2" ry="2.1" fill="#EBC77E" stroke="'+SC_DI+'" stroke-width="1.5"/>',
      scStroke('M4 34 L9 28 L8 21 M9 28 L15 26 L19 21 M15 26 L20 29','#8A6220',1.6,'rgba(0,0,0,0)'),
    ],
    feature:[
      // the same little cactus the pieces stand by
      scStroke('M12 34 V20 M12 27 C18 27 18 24 18 21 M12 25 C7 25 7 22 7 19','#5DAA4E',3.4,SC_DI),
      // barrel cactus in flower
      scShape('M7 33 C7 22 19 22 19 33 Z','#5DAA4E',SC_DI,1.8)
        +scStroke('M10 24 V32 M13 23 V33 M16 24 V32','#3F8A36',1.2,'rgba(0,0,0,0)')
        +scDot(13,20,3,'#FF9EC4',SC_DI,1.4),
      // dry grass
      scStroke('M7 34 L5 25 M12 34 L12 22 M17 34 L19 25 M21 34 L23 28','#C9A24B',2.2,SC_DI),
      // sun-bleached stone
      scShape('M5 33 C5 24 12 21 17 24 C22 27 21 33 21 33 Z','#C08C3C',SC_DI,1.7)
        +'<ellipse cx="11" cy="27" rx="3" ry="1.6" fill="#E3BA74" opacity=".8"/>',
    ],
  },
  ocean:{
    quiet:[
      scStroke('M5 26 Q9 22 13 26 T21 26 M10 32 Q14 28 18 32 T26 32','#5BD6EA',2.2,SC_OI),
      scDot(9,29,3.4,'rgba(255,255,255,.35)','#EAFBFF',1.7)+scDot(15,24,2.2,'rgba(255,255,255,.35)','#EAFBFF',1.5)
        +scDot(19,30,1.6,'rgba(255,255,255,.35)','#EAFBFF',1.3),
      scStroke('M8 34 C5 28 11 24 8 18 M14 34 C17 29 12 25 15 20','#4FC78A',2.2,SC_OI),
    ],
    feature:[
      // starfish
      scShape('M13 15 L16 23 L24 23 L18 28 L20 35 L13 31 L6 35 L8 28 L2 23 L10 23 Z','#FF9E7A',SC_OI,1.7)
        +scDot(13,25,1.3,'#FFE0CE','rgba(0,0,0,0)',0),
      // coral sprig
      scStroke('M12 34 V26 M12 29 C8 27 7 23 8 19 M12 27 C16 25 18 22 18 17','#FF8FA3',2.6,SC_OI)
        +scDot(8,18,2,'#FFC2CE',SC_OI,1.2)+scDot(18,16,2,'#FFC2CE',SC_OI,1.2),
      // scallop shell
      scShape('M4 32 C4 21 22 21 22 32 Z','#FBF7FF',SC_OI,1.7)
        +scStroke('M13 32 V23 M9 32 L10 24 M17 32 L16 24','#D8C9E8',1.3,'rgba(0,0,0,0)'),
      // little fish
      scShape('M6 26 C10 20 20 20 23 26 C20 32 10 32 6 26 Z','#8FE3F0',SC_OI,1.6)
        +scShape('M23 26 L28 22 L28 30 Z','#5BD6EA',SC_OI,1.4)+scDot(11,25,1.2,'#14324F','rgba(0,0,0,0)',0),
    ],
  },
};

// impassable tiles, drawn in the 100x100 box a piece uses so they fill the square
const OBSTACLE_ART={
  tree:
    scShape('M42 96 C42 80 42 70 41 62 L59 62 C58 70 58 80 58 96 Z','#8B5A2B','#2A1A10',4)
    +scStroke('M50 80 L44 73 M50 89 L56 82','#6B4420',3,'rgba(0,0,0,0)')
    +scDot(27,54,23,'#4FA33C','#1E3A12',4)+scDot(73,54,23,'#4FA33C','#1E3A12',4)
    +scDot(50,32,26,'#4FA33C','#1E3A12',4)
    +'<path d="M33 20 C41 12 59 12 67 20" fill="none" stroke="#7FD45E" stroke-width="6" stroke-linecap="round"/>'
    +scDot(22,44,3.6,'#FF9EC4','#1E3A12',2.2)+scDot(78,64,3,'#FFD84D','#1E3A12',2.2),
  // a wind-carved butte: two tiers set off-centre, one strata band, a boulder at its foot
  sandstone:
    scShape('M4 96 L13 48 C14 42 21 39 33 39 L58 39 C66 39 71 42 72 48 L78 96 Z','#D8964A','#5A3818',4)
    +scStroke('M10 68 H75','#AE6E26',3,'rgba(0,0,0,0)')
    +scShape('M13 48 C14 42 21 39 33 39 L58 39 C66 39 71 42 72 48 Z','#EDB870','#5A3818',3.4)
    +scShape('M28 39 L32 17 C32 13 38 11 45 11 L55 11 C60 11 63 14 64 18 L67 39 Z','#E3A55E','#5A3818',3.6)
    +scShape('M68 96 C68 83 76 73 85 73 C93 73 98 84 98 96 Z','#C9853E','#5A3818',3.6)
    +'<ellipse cx="16" cy="93" rx="7" ry="3.6" fill="#F4D58D" stroke="#5A3818" stroke-width="2.6"/>',
  rocks:
    scShape('M2 96 C2 66 18 34 40 34 C62 34 72 66 72 96 Z','#6E7C92','#16233C',4)
    +scShape('M56 96 C56 74 68 52 82 52 C94 52 98 76 98 96 Z','#55657A','#16233C',4)
    +'<path d="M18 72 C22 60 30 52 38 50" fill="none" stroke="#9DAABE" stroke-width="5.5" stroke-linecap="round"/>'
    +scStroke('M4 94 q5 -5 10 0 q5 5 10 0','#5BD6EA',3,SC_OI),
};

// one stable number per square, so a map always grows the same scenery
function scHash(r,c){
  let h=(r*374761393+c*668265263+7*2246822519)>>>0;
  h=Math.imul(h^(h>>>13),1274126177)>>>0;
  return (h^(h>>>16))>>>0;
}

const scCache=new Map();
function scNode(key,viewBox,body){
  let n=scCache.get(key);
  if(!n){
    n=document.createElementNS('http://www.w3.org/2000/svg','svg');
    n.setAttribute('class','tile-art');
    n.setAttribute('viewBox',viewBox);
    n.innerHTML=body;
    scCache.set(key,n);
  }
  return n.cloneNode(true);
}

// the drawing for one square, or null when it should stay bare
function tileArt(i){
  const theme=SCENERY[mapTheme]?mapTheme:'jungle';
  const t=tileData[i];
  if(t){
    const kind=(t==='sandstone-spawner')?'sandstone':t;
    const art=OBSTACLE_ART[kind];
    return art?scNode('ob|'+kind,'0 0 100 100',art):null;
  }
  const r=ROW(i),c=COL(i),h=scHash(r,c),roll=h%1000;
  let list,op,place;
  if(roll<430){          // ground texture: keeps to the bottom strip, mirrors for variety
    list=SCENERY[theme].quiet; op='.5';
    place=((h>>>8)&1)?'translate(39,6) scale(-.8,.8)':'translate(1,6) scale(.8)';
  }else if(roll<640){    // a feature: smaller, and always in the bottom-left corner
    list=SCENERY[theme].feature; op='.66'; place='translate(2,13) scale(.58)';
  }else return null;
  const n=(h>>>10)%list.length;
  const jx=(roll<430?((h>>>14)%9)-1:((h>>>14)%5)-1), jy=((h>>>19)%5)-2;
  return scNode(theme+'|'+r+','+c,'0 0 40 40',
    '<g opacity="'+op+'" transform="translate('+jx+','+jy+') '+place+'">'+list[n]+'</g>');
}
