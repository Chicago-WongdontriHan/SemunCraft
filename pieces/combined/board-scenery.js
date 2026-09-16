// Board scenery: the cute sticker vocabulary each theme scatters over its tiles,
// drawn in a 40x40 tile-local box so a tile of any size can scale it.
// Every shape is outlined like a piece, then the whole motif is dropped in opacity
// so the board stays quiet under the pieces. Scenery is small and sits in a corner;
// only the impassable tiles fill their square.

// outline-then-colour, the board-sized cousin of pieceStroke
const st=(d,color,w,ink)=>'<path d="'+d+'" fill="none" stroke="'+ink+'" stroke-width="'+(w+1.6)
  +'" stroke-linecap="round" stroke-linejoin="round"/><path d="'+d+'" fill="none" stroke="'+color
  +'" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round"/>';
const sh=(d,fill,ink,w)=>'<path d="'+d+'" fill="'+fill+'" stroke="'+ink+'" stroke-width="'+(w||1.6)
  +'" stroke-linejoin="round"/>';
const ci=(x,y,r,fill,ink,w)=>'<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+fill+'" stroke="'+ink
  +'" stroke-width="'+(w||1.6)+'"/>';

const JI='rgba(20,40,8,.55)', DI='rgba(72,44,8,.5)', OI='rgba(6,26,60,.5)';

const SCENERY={
  jungle:{
    ink:JI,
    quiet:[
      // grass tuft
      st('M8 33 L6 25 M13 33 L13 23 M18 33 L20 25','#6CC04A',2.6,JI),
      // wider, lower tuft
      st('M6 34 L4 28 M11 34 L10 26 M16 34 L18 28 M21 34 L23 29','#5FB03F',2.4,JI),
      // two fallen leaves
      sh('M6 30 C10 24 18 24 21 29 C17 34 9 35 6 30 Z','#7FC258',JI)
        +st('M7 30 C12 29 17 29 20 29','#4E8C33',1.2,'rgba(0,0,0,0)'),
    ],
    feature:[
      // flower with a pair of leaves, the same one the pieces stand by
      st('M13 33 V22','#4E8C33',2.2,JI)+sh('M13 26 C8 24 6 28 11 29 Z','#6CC04A',JI,1.4)
        +ci(13,18,5,'#FF9EC4',JI,1.8)+ci(13,18,2,'#FFD84D',JI,1.2),
      // mushroom
      sh('M10 33 C10 27 16 27 16 33 Z','#FFF0B8',JI,1.5)
        +sh('M4 26 C4 15 22 15 22 26 Z','#E4533D',JI,1.8)
        +ci(9,22,1.8,'#FFF6E0','rgba(0,0,0,0)',0)+ci(16,23.5,1.4,'#FFF6E0','rgba(0,0,0,0)',0),
      // fern frond
      st('M7 34 C9 26 13 20 20 16','#4E8C33',2.2,JI)
        +st('M9 28 L5 26 M11 24 L7 21 M14 21 L11 17 M17 18 L15 14','#6CC04A',2,JI),
      // clover
      st('M13 34 V26','#4E8C33',2,JI)+ci(9,22,4,'#6CC04A',JI,1.5)+ci(17,22,4,'#6CC04A',JI,1.5)
        +ci(13,17,4,'#6CC04A',JI,1.5),
    ],
  },
  desert:{
    ink:DI,
    quiet:[
      // dune ripples
      st('M5 27 Q12 21 20 27 M12 33 Q19 27 27 33','#EBCE86',2.2,DI),
      // pebbles
      '<ellipse cx="10" cy="30" rx="5" ry="3.2" fill="#F4D58D" stroke="'+DI+'" stroke-width="1.7"/>'
        +'<ellipse cx="18" cy="32.5" rx="3.2" ry="2.1" fill="#EBC77E" stroke="'+DI+'" stroke-width="1.5"/>',
      // cracked ground
      st('M4 34 L9 28 L8 21 M9 28 L15 26 L19 21 M15 26 L20 29','#8A6220',1.6,'rgba(0,0,0,0)'),
    ],
    feature:[
      // little cactus, the same one the pieces stand by
      st('M12 34 V20 M12 27 C18 27 18 24 18 21 M12 25 C7 25 7 22 7 19','#5DAA4E',3.4,DI),
      // barrel cactus with flower
      sh('M7 33 C7 22 19 22 19 33 Z','#5DAA4E',DI,1.8)
        +st('M10 24 V32 M13 23 V33 M16 24 V32','#3F8A36',1.2,'rgba(0,0,0,0)')
        +ci(13,20,3,'#FF9EC4',DI,1.4),
      // dry grass
      st('M7 34 L5 25 M12 34 L12 22 M17 34 L19 25 M21 34 L23 28','#C9A24B',2.2,DI),
      // sun-bleached stone with a highlight
      sh('M5 33 C5 24 12 21 17 24 C22 27 21 33 21 33 Z','#C08C3C',DI,1.7)
        +'<ellipse cx="11" cy="27" rx="3" ry="1.6" fill="#E3BA74" opacity=".8"/>',
    ],
  },
  ocean:{
    ink:OI,
    quiet:[
      // ripples
      st('M5 26 Q9 22 13 26 T21 26 M10 32 Q14 28 18 32 T26 32','#5BD6EA',2.2,OI),
      // bubbles
      ci(9,29,3.4,'rgba(255,255,255,.35)','#EAFBFF',1.7)+ci(15,24,2.2,'rgba(255,255,255,.35)','#EAFBFF',1.5)
        +ci(19,30,1.6,'rgba(255,255,255,.35)','#EAFBFF',1.3),
      // sea grass
      st('M8 34 C5 28 11 24 8 18 M14 34 C17 29 12 25 15 20','#4FC78A',2.2,OI),
    ],
    feature:[
      // starfish
      sh('M13 15 L16 23 L24 23 L18 28 L20 35 L13 31 L6 35 L8 28 L2 23 L10 23 Z','#FF9E7A',OI,1.7)
        +ci(13,25,1.3,'#FFE0CE','rgba(0,0,0,0)',0),
      // coral sprig
      st('M12 34 V26 M12 29 C8 27 7 23 8 19 M12 27 C16 25 18 22 18 17','#FF8FA3',2.6,OI)
        +ci(8,18,2,'#FFC2CE',OI,1.2)+ci(18,16,2,'#FFC2CE',OI,1.2),
      // scallop shell
      sh('M4 32 C4 21 22 21 22 32 Z','#FBF7FF',OI,1.7)
        +st('M13 32 V23 M9 32 L10 24 M17 32 L16 24','#D8C9E8',1.3,'rgba(0,0,0,0)'),
      // little fish
      sh('M6 26 C10 20 20 20 23 26 C20 32 10 32 6 26 Z','#8FE3F0',OI,1.6)
        +sh('M23 26 L28 22 L28 30 Z','#5BD6EA',OI,1.4)+ci(11,25,1.2,'#14324F','rgba(0,0,0,0)',0),
    ],
  },
};

// The impassable tiles, redrawn as stickers that fill their square (100x100 box,
// the same box a piece is drawn in), so a blocked tile never reads as free ground.
const OBSTACLES={
  jungle:{emoji:'🌳',label:'Tree',art:
    sh('M42 96 C42 80 42 70 41 62 L59 62 C58 70 58 80 58 96 Z','#8B5A2B','#2A1A10',4)
    +st('M50 80 L44 73 M50 89 L56 82','#6B4420',3,'rgba(0,0,0,0)')
    +ci(27,54,23,'#4FA33C','#1E3A12',4)+ci(73,54,23,'#4FA33C','#1E3A12',4)
    +ci(50,32,26,'#4FA33C','#1E3A12',4)
    +'<path d="M33 20 C41 12 59 12 67 20" fill="none" stroke="#7FD45E" stroke-width="6" stroke-linecap="round"/>'
    +ci(22,44,3.6,'#FF9EC4','#1E3A12',2.2)+ci(78,64,3,'#FFD84D','#1E3A12',2.2)},
  desert:{emoji:'🟧',label:'Sandstone',art:
    // a wind-carved butte: two tiers set off-centre, one strata band, a boulder at its foot
    sh('M4 96 L13 48 C14 42 21 39 33 39 L58 39 C66 39 71 42 72 48 L78 96 Z','#D8964A','#5A3818',4)
    +st('M10 68 H75','#AE6E26',3,'rgba(0,0,0,0)')
    +sh('M13 48 C14 42 21 39 33 39 L58 39 C66 39 71 42 72 48 Z','#EDB870','#5A3818',3.4)
    +sh('M28 39 L32 17 C32 13 38 11 45 11 L55 11 C60 11 63 14 64 18 L67 39 Z','#E3A55E','#5A3818',3.6)
    +sh('M68 96 C68 83 76 73 85 73 C93 73 98 84 98 96 Z','#C9853E','#5A3818',3.6)
    +'<ellipse cx="16" cy="93" rx="7" ry="3.6" fill="#F4D58D" stroke="#5A3818" stroke-width="2.6"/>'},
  ocean:{emoji:'🪨',label:'Sea Rocks',art:
    sh('M2 96 C2 66 18 34 40 34 C62 34 72 66 72 96 Z','#6E7C92','#16233C',4)
    +sh('M56 96 C56 74 68 52 82 52 C94 52 98 76 98 96 Z','#55657A','#16233C',4)
    +'<path d="M18 72 C22 60 30 52 38 50" fill="none" stroke="#9DAABE" stroke-width="5.5" stroke-linecap="round"/>'
    +st('M4 94 q5 -5 10 0 q5 5 10 0','#5BD6EA',3,OI)},
};

module.exports={SCENERY,OBSTACLES};
