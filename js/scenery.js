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
const scR=v=>+v.toFixed(2);
// a lens-shaped leaf from (x,y), len long and 2w wide, pointing ang degrees round
const scLeaf=(x,y,len,w,ang,fill,ink,sw)=>'<path d="M0 0 C'+scR(len*.3)+' '+(-w)+' '+scR(len*.7)+' '+(-w)+' '+len
  +' 0 C'+scR(len*.7)+' '+w+' '+scR(len*.3)+' '+w+' 0 0 Z" transform="translate('+x+','+y+') rotate('+ang+')" fill="'
  +fill+'" stroke="'+ink+'" stroke-width="'+(sw||1.4)+'" stroke-linejoin="round"/>';
// five round petals d away from (x,y), and a centre
const scFlower=(x,y,d,r,petal,center,ink,sw)=>[-90,-18,54,126,198].map(a=>{
    const t=a*Math.PI/180;return scDot(scR(x+d*Math.cos(t)),scR(y+d*Math.sin(t)),r,petal,ink,sw);}).join('')
  +scDot(x,y,scR(r*.55),center,ink,scR(sw*.8));

const SC_FI='rgba(20,40,8,.55)', SC_JI='rgba(8,36,18,.55)', SC_DI='rgba(72,44,8,.5)', SC_OI='rgba(6,26,60,.5)';
const SC_CLEAR='rgba(0,0,0,0)';

// scenery is drawn in a 40x40 tile-local box; quiet ground textures first, then features
const SCENERY={
  forest:{
    quiet:[
      scStroke('M8 33 L6 25 M13 33 L13 23 M18 33 L20 25','#6CC04A',2.6,SC_FI),
      scStroke('M6 34 L4 28 M11 34 L10 26 M16 34 L18 28 M21 34 L23 29','#5FB03F',2.4,SC_FI),
      scShape('M6 30 C10 24 18 24 21 29 C17 34 9 35 6 30 Z','#7FC258',SC_FI)
        +scStroke('M7 30 C12 29 17 29 20 29','#4E8C33',1.2,'rgba(0,0,0,0)'),
    ],
    feature:[
      // the same little flower the pieces stand by
      scStroke('M13 33 V22','#4E8C33',2.2,SC_FI)+scShape('M13 26 C8 24 6 28 11 29 Z','#6CC04A',SC_FI,1.4)
        +scDot(13,18,5,'#FF9EC4',SC_FI,1.8)+scDot(13,18,2,'#FFD84D',SC_FI,1.2),
      // mushroom
      scShape('M10 33 C10 27 16 27 16 33 Z','#FFF0B8',SC_FI,1.5)
        +scShape('M4 26 C4 15 22 15 22 26 Z','#E4533D',SC_FI,1.8)
        +scDot(9,22,1.8,'#FFF6E0','rgba(0,0,0,0)',0)+scDot(16,23.5,1.4,'#FFF6E0','rgba(0,0,0,0)',0),
      // fern frond
      scStroke('M7 34 C9 26 13 20 20 16','#4E8C33',2.2,SC_FI)
        +scStroke('M9 28 L5 26 M11 24 L7 21 M14 21 L11 17 M17 18 L15 14','#6CC04A',2,SC_FI),
      // clover
      scStroke('M13 34 V26','#4E8C33',2,SC_FI)+scDot(9,22,4,'#6CC04A',SC_FI,1.5)
        +scDot(17,22,4,'#6CC04A',SC_FI,1.5)+scDot(13,17,4,'#6CC04A',SC_FI,1.5),
    ],
  },
  jungle:{
    quiet:[
      // monstera leaf, its splits cut into the outline
      scStroke('M7 27 L3 30','#2A7A38',1.6,SC_JI)
        +scShape('M7 27 C4 24 6 18 12 16 L15.5 22 L17 15.5 C21 15.5 24 17 25.5 19 L21 24 L27.5 23 '
          +'C28.5 25.5 28.5 28.5 27 31 L22 29 L24.5 34 C22 36 19 36.5 16.5 36 L16 30 L12 35.5 '
          +'C8 35 5 33 5 30 C5 28.5 6 27.5 7 27 Z','#3FA34D',SC_JI,1.6)
        +scStroke('M7 27 C13 26.5 19 26.8 25 27.5','#2A7A38',1.2,SC_CLEAR),
      // fallen palm frond
      scStroke('M3 33 C10 29 18 26 27 20','#2A7A38',1.6,SC_JI)
        +scStroke('M7 31 L4 26 M11 29 L9 23.5 M15 27.5 L14 21.5 M19 25.5 L19 19.5 M23 23 L24 17.5 '
          +'M8 32 L7.5 36 M12 30.5 L13 35 M16 28.5 L18 33 M20 26.5 L23 30.5','#4FAE55',1.8,SC_JI),
      // puddle with a lily pad
      '<ellipse cx="15" cy="30" rx="11" ry="4.6" fill="#3F8F86" stroke="'+SC_JI+'" stroke-width="1.6"/>'
        +scStroke('M8 29 Q12 27 16 27.6','#9FE0D2',1.3,SC_CLEAR)
        +scShape('M19 30.5 L23.44 31.15 A4.6 2.5 0 1 1 23.44 29.85 Z','#5DBB5A',SC_JI,1.3),
      // creeping vine
      scStroke('M3 33 C8 27 12 35 17 29 C21 24 25 31 28 25','#4E9F48',1.8,SC_JI)
        +scLeaf(7,29.5,5,2.2,-120,'#6CC04A',SC_JI,1.2)+scLeaf(16,29,5,2.2,-60,'#6CC04A',SC_JI,1.2)
        +scLeaf(24,27.5,5,2.2,-130,'#6CC04A',SC_JI,1.2),
    ],
    feature:[
      // hibiscus
      scLeaf(12,31,9,3.2,160,'#3FA34D',SC_JI,1.4)+scLeaf(15,31,9,3.2,20,'#3FA34D',SC_JI,1.4)
        +scFlower(13,22,5.3,4.4,'#FF4F7B','#FFD84D',SC_JI,1.5)
        +scStroke('M13 22 L19 15.5','#FFD84D',1.2,SC_CLEAR)+scDot(19.5,15,1.3,'#FF9E2C',SC_CLEAR,0),
      // bird of paradise
      scStroke('M13 36 V25','#2A7A38',2.2,SC_JI)
        +scShape('M5 26 C11 22 20 22 26 26 C20 27 11 27 5 26 Z','#3FA34D',SC_JI,1.4)
        +scShape('M12 24 L9 12 L15 23 Z','#FF9E2C',SC_JI,1.3)+scShape('M15 23 L17 10 L19 23 Z','#FFB23F',SC_JI,1.3)
        +scShape('M18 23 L25 14 L21 24 Z','#FF9E2C',SC_JI,1.3)+scShape('M16 24 L22 18 L20 24.5 Z','#3B7BE0',SC_JI,1.1),
      // coconuts
      scLeaf(14,24,12,3,-150,'#3FA34D',SC_JI,1.3)+scLeaf(14,24,11,3,-35,'#3FA34D',SC_JI,1.3)
        +scDot(10,29,5.2,'#8B5A2B',SC_JI,1.6)+scDot(19,30.5,4.6,'#7A4A22',SC_JI,1.6)
        +scDot(8.6,27.6,.8,'#3A2412',SC_CLEAR,0)+scDot(11.4,27.6,.8,'#3A2412',SC_CLEAR,0)
        +scDot(10,30.2,.8,'#3A2412',SC_CLEAR,0),
      // bromeliad
      scStroke('M14 34 C11 30 7 27 3 26 M14 34 C13 28 11 22 9 17 M14 34 C15 28 17 22 19 17 M14 34 C17 30 21 27 25 26',
        '#3FA34D',3,SC_JI)
        +scShape('M11 31 L14 19 L17 31 Z','#FF4F7B',SC_JI,1.4)+scDot(14,19.5,1.4,'#FFD84D',SC_CLEAR,0),
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

// a leaf's midrib: from its base most of the way to its tip
const scRib=(x,y,len,ang)=>{const t=ang*Math.PI/180;
  return 'M'+x+' '+y+' L'+scR(x+len*.8*Math.cos(t))+' '+scR(y+len*.8*Math.sin(t));};

// undergrowth (jungle): a thicket of broad leaves. The front leaves are drawn a second time over a
// piece standing in it (undergrowthFront), so it looks tucked in while its HP pips stay on top.
const UG_INK='#0F3A1C';
const UG_FRONT=
  scLeaf(6,101,36,10,-58,'#3FA34D',UG_INK,2.8)+scLeaf(94,101,36,10,-122,'#3FA34D',UG_INK,2.8)
  +scLeaf(27,102,32,10,-97,'#4FAE55',UG_INK,2.8)+scLeaf(73,102,32,10,-83,'#4FAE55',UG_INK,2.8)
  +scLeaf(50,103,26,9,-90,'#58B866',UG_INK,2.6)
  +scStroke([scRib(6,101,36,-58),scRib(94,101,36,-122),scRib(27,102,32,-97),scRib(73,102,32,-83),
    scRib(50,103,26,-90)].join(' '),'#8FD27A',1.6,SC_CLEAR);
const UG_BACK=
  '<ellipse cx="50" cy="86" rx="48" ry="20" fill="rgba(6,40,20,.35)"/>'
  +scLeaf(50,99,76,13,-90,'#27743A',UG_INK,3)
  +scLeaf(45,99,68,14,-120,'#2F8A45',UG_INK,3)+scLeaf(55,99,68,14,-60,'#2F8A45',UG_INK,3)
  +scLeaf(40,99,56,13,-150,'#27743A',UG_INK,3)+scLeaf(60,99,56,13,-30,'#27743A',UG_INK,3)
  +scStroke([scRib(50,99,76,-90),scRib(45,99,68,-120),scRib(55,99,68,-60),scRib(40,99,56,-150),
    scRib(60,99,56,-30)].join(' '),'#58B866',2,SC_CLEAR);

// terrain tiles, drawn in the 100x100 box a piece uses so they fill the square
const TERRAIN_ART={
  undergrowth:UG_BACK+UG_FRONT,
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
  // the Elixir spring: a stone basin of bright water, with a drop rising off it
  spring:
    scShape('M8 70 C8 51 26 39 50 39 C74 39 92 51 92 70 C92 86 74 95 50 95 C26 95 8 86 8 70 Z','#7D8A94','#232C33',4)
    +scShape('M18 70 C18 56 32 47 50 47 C68 47 82 56 82 70 C82 82 68 88 50 88 C32 88 18 82 18 70 Z','#3FCB6A','#123A22',3.4)
    +scStroke('M28 68 C34 61 43 58 52 60','#A9F7C0',3,SC_CLEAR)
    +scShape('M50 4 C58 16 65 25 65 31 A15 15 0 0 1 35 31 C35 25 42 16 50 4 Z','#43C45A','#12351C',3.6)
    +scStroke('M44 30 C44 25 46 21 49 17','#DFFBE6',2.6,SC_CLEAR)
    +scDot(20,50,3.6,'#9AF0B4','#12351C',2.4)+scDot(80,54,3,'#9AF0B4','#12351C',2.4),
  // the gold mine: a cut in the rock with gold showing through
  mine:
    scShape('M2 95 C4 71 19 52 40 52 C61 52 73 71 75 95 Z','#6E7C92','#16233C',4)
    +scShape('M60 95 C60 79 70 65 82 65 C93 65 98 80 98 95 Z','#55657A','#16233C',3.6)
    +scStroke('M14 86 C20 73 29 64 39 61','#9DAABE',5,SC_CLEAR)
    +scDot(50,31,18,'#F6C544','#5A3C0A',4)+scDot(50,31,10,'#FFE38A','#5A3C0A',2.6)
    +scDot(21,66,5,'#F6C544','#5A3C0A',2.6)+scDot(70,57,4,'#F6C544','#5A3C0A',2.6),
  rocks:
    scShape('M2 96 C2 66 18 34 40 34 C62 34 72 66 72 96 Z','#6E7C92','#16233C',4)
    +scShape('M56 96 C56 74 68 52 82 52 C94 52 98 76 98 96 Z','#55657A','#16233C',4)
    +'<path d="M18 72 C22 60 30 52 38 50" fill="none" stroke="#9DAABE" stroke-width="5.5" stroke-linecap="round"/>'
    +scStroke('M4 94 q5 -5 10 0 q5 5 10 0','#5BD6EA',3,SC_OI),
  // a coconut palm: fronds behind and in front of a ringed trunk, a leafy clump at its foot
  palm:
    scShape('M58 28 C50 12 36 4 20 6 C34 12 46 20 58 28 Z','#2F8A3F','#12361C',3.6)
    +scShape('M58 28 C66 12 80 4 96 10 C82 13 70 20 58 28 Z','#2F8A3F','#12361C',3.6)
    +scShape('M42 96 C44 76 48 54 53 30 L64 32 C59 56 56 78 58 96 Z','#B07A40','#3A2412',4)
    +scStroke('M44 86 L57 87 M46 74 L58 75.5 M48.5 62 L59.5 63.5 M51 50 L61 51.5 M53 40 L62.5 41.5','#8A5A2A',2.4,SC_CLEAR)
    +scDot(52,37,5.5,'#7A4A22','#2A1A10',3)+scDot(62,39,5,'#8B5A2B','#2A1A10',3)
    +scShape('M58 28 C42 18 18 20 4 38 C20 30 42 32 58 28 Z','#3FA34D','#12361C',3.6)
    +scShape('M58 28 C74 18 92 22 98 42 C86 32 72 32 58 28 Z','#3FA34D','#12361C',3.6)
    +scShape('M58 28 C44 32 28 44 20 62 C34 48 48 40 58 28 Z','#2F8A3F','#12361C',3.6)
    +scShape('M58 28 C72 34 84 48 86 64 C78 50 68 42 58 28 Z','#2F8A3F','#12361C',3.6)
    +scStroke('M58 28 C42 22 22 24 8 36 M58 28 C74 22 90 26 96 38 M58 28 C46 34 32 46 22 58 M58 28 C70 36 80 48 84 60',
      '#6CC04A',2,SC_CLEAR)
    +scDot(58,28,4.5,'#2F8A3F','#12361C',3)
    +scShape('M10 96 C10 88 18 82 28 86 C32 78 42 76 48 84 C54 76 66 78 70 86 C80 82 90 88 90 96 Z','#2F8A3F','#12361C',3.6)
    +scStroke('M24 92 C26 88 30 86 34 86 M60 90 C62 86 66 84 70 85','#58B866',2.2,SC_CLEAR),
  // mossy temple stones: a carved upper block on a wider base, a vine climbing the side
  temple:
    scShape('M6 96 L6 52 C6 48 9 46 13 46 L87 46 C91 46 94 48 94 52 L94 96 Z','#8E9A86','#2F3A2C',4)
    +scStroke('M6 72 H94 M34 52 V72 M66 52 V72 M50 72 V96','#6E7A66',2.6,SC_CLEAR)
    +scShape('M20 46 L20 20 C20 16 23 14 27 14 L73 14 C77 14 80 16 80 20 L80 46 Z','#A2AE98','#2F3A2C',4)
    +scStroke('M40 24 H60 V40 H45 V29 H55 V35','#5E6A58',3,SC_CLEAR)
    +scShape('M4 50 C8 43 16 47 21 44 L79 44 C85 46 92 43 96 50 L96 54 C88 52 80 55 72 52 C62 55 40 52 30 55 '
      +'C20 52 12 55 4 54 Z','#5DAA4E','#1E3A12',3)
    +scShape('M18 20 C22 12 30 16 36 12 C44 8 52 16 60 11 C68 8 74 14 82 18 L82 23 C74 21 66 24 58 21 '
      +'C50 24 42 21 34 24 C28 22 22 25 18 23 Z','#5DAA4E','#1E3A12',3)
    +scStroke('M76 16 C80 28 72 38 78 50 C82 60 76 70 80 82','#3FA34D',3,'#12361C')
    +scLeaf(78,34,7,3,-20,'#6CC04A','#12361C',1.8)+scLeaf(79,62,7,3,200,'#6CC04A','#12361C',1.8)
    +scLeaf(78,78,6,2.6,-30,'#6CC04A','#12361C',1.6),
};

// one stable number per square, so a map always grows the same scenery
function scHash(r,c){
  let h=(r*374761393+c*668265263+7*2246822519)>>>0;
  h=Math.imul(h^(h>>>13),1274126177)>>>0;
  return (h^(h>>>16))>>>0;
}

const scCache=new Map();
function scNode(key,viewBox,body,cls){
  let n=scCache.get(key);
  if(!n){
    n=document.createElementNS('http://www.w3.org/2000/svg','svg');
    n.setAttribute('class',cls||'tile-art');
    n.setAttribute('viewBox',viewBox);
    n.innerHTML=body;
    scCache.set(key,n);
  }
  return n.cloneNode(true);
}

// the leaves in front of a piece standing in undergrowth
function undergrowthFront(){return scNode('ug-front','0 0 100 100',UG_FRONT,'tile-front');}

// the drawing for one square, or null when it should stay bare
function tileArt(i){
  const theme=SCENERY[mapTheme]?mapTheme:'forest';
  const t=tileData[i];
  if(t){
    const kind=(t==='sandstone-spawner')?'sandstone':t;
    const art=TERRAIN_ART[kind];
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

// ── FOG OF WAR ───────────────────────────────────────────────────────────────
// Squares out of sight are plain grey with a slight tint of the map's colour. Unexplored squares are
// covered solid; explored ones get a see-through veil over faded terrain (the fade is CSS), so they
// never pass for squares in sight.
const FOG_STYLE={
  forest:{solid:'#AAB0A8',veil:'rgba(212,217,209,.6)',text:'rgba(48,55,46,.8)'},
  jungle:{solid:'#99A7A2',veil:'rgba(210,221,217,.58)',text:'rgba(36,50,45,.8)'},
  desert:{solid:'#B3A99A',veil:'rgba(228,223,212,.6)',text:'rgba(71,62,50,.8)'},
  ocean:{solid:'#9CA4AC',veil:'rgba(217,222,227,.6)',text:'rgba(40,47,58,.8)'},
};
function fogStyle(){return FOG_STYLE[mapTheme]||FOG_STYLE.forest;}

// the cover over a square out of sight: state 'unknown' (solid) or 'explored' (a veil)
function fogCover(i,state){
  const st=fogStyle(),cov=document.createElement('div');
  cov.className='fog-cover';
  cov.style.background=state==='unknown'?st.solid:st.veil;
  return cov;
}
