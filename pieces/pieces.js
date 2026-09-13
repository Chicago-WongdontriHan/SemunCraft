// ── PIECE DESIGNS ────────────────────────────────────────────────────────────
// Every piece is an SVG in a 100x100 box, standing on a base at y=86.
// Types are told apart by silhouette and size, and look the same in every set:
//   pawn    small and round (the shortest piece)
//   knight  horse head with a mane
//   bishop  tall pointed mitre with a green healing cross, holding a crook staff
//   rook    castle tower with battlements and a door
//   queen   wide flowing gown and a spiked crown with gems
//   king    tallest and broadest: square-shouldered robe, beard, domed crown with a cross
//   siege   low, wide cannon cart on two wheels
// Team colour fills the body (light White, dark Black) with a slight per-type tint, and
// the base ring; a dark outline plus a contrasting halo keeps pieces readable on any tile.
// Theme sets (jungle.js, desert.js, ocean.js) register in PIECE_SETS with
// { colors, base(rx) }: the metal, gem and wood colours plus the ground each piece
// stands on, so a theme never changes a piece's shape.
// In SVG strings, {name} is filled from the team palette (line, body, shade) or the set's colors.
// Open pieces/preview.html to compare every set, including solid silhouettes.
const PIECE_SETS={};

const PIECE_TEAMS={
  w:{body:'#FFF4DA',shade:'#EAD3A4',ring:'#F5C443',line:'#3A2614',halo:'rgba(35,22,8,.55)',eye:'#2A1A10',sclera:null,shine:.45},
  b:{body:'#3E3858',shade:'#2B2640',ring:'#E4533D',line:'#140F1F',halo:'rgba(255,246,222,.92)',eye:'#1A1426',sclera:'#FFFFFF',shine:.18},
};

// slight per-type tint of the team colour, as [body, shade]: each type keeps one hue
// in both teams (knight blue, bishop green, rook brick, queen pink, king gold, siege stone),
// while White stays light and Black stays dark
const PIECE_TINTS={
  w:{pawn:['#FFF4DA','#EAD3A4'],knight:['#E1ECFF','#BFD2F2'],bishop:['#E0F5E4','#B9E0C2'],rook:['#FFE3D0','#EEC1A0'],
     queen:['#FBE2F0','#E8BDD5'],king:['#FFF0B8','#E8CF7E'],siege:['#EAE6DF','#CBC4B8']},
  b:{pawn:['#3E3858','#2B2640'],knight:['#2C3E66','#1F2C4C'],bishop:['#2A4A43','#1D3530'],rook:['#5A322D','#402320'],
     queen:['#53305A','#3B2141'],king:['#594A25','#3F3418'],siege:['#3A3D45','#292B32']},
};

// thin parts (staff, cross, collar) get their own outline so they stay visible when small
const pieceStroke=(d,color,w)=>`<path d="${d}" fill="none" stroke="{line}" stroke-width="${w+4}" stroke-linecap="round" stroke-linejoin="round"/>`
  +`<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

// ring: base ring half-width; shine: highlight position; back: parts drawn behind the body
const PIECE_SHAPES={
  pawn:{ring:19,shine:[41,77],
    body:'<path d="M34 86 C34 75 41 68 50 68 C59 68 66 75 66 86 Z"/><circle cx="50" cy="54" r="14"/>',
    eyes:[[45,55],[55,55]],blush:[[40,60],[60,60]]},
  knight:{ring:24,shine:[39,75],
    body:'<path d="M29 86 C27 71 32 59 38 51 C32 44 34 30 44 23 L47 11 L56 21 C69 24 78 36 77 50 C76 58 69 61 63 58 C61 65 67 74 72 86 Z"/>',
    eyes:[[57,35]],blush:[[64,45]],
    // mane along the back of the neck, and a nostril
    detail:'<path d="M44 23 C35 27 30 39 32 50 C28 57 28 66 30 75 L37 70 C35 62 36 55 40 50 C37 41 39 31 47 27 Z" fill="{shade}" stroke="{line}" stroke-width="3" stroke-linejoin="round"/>'
      +'<circle cx="72" cy="50" r="2.3" fill="{line}"/>'},
  bishop:{ring:21,shine:[42,78],
    back:pieceStroke('M79 86 V33','{wood}',4)+pieceStroke('M79 35 C79 22 70 20 70 27 C70 31 74 31 74 28','{metal}',4),
    body:'<path d="M35 86 C35 76 41 67 50 67 C59 67 65 76 65 86 Z"/><circle cx="50" cy="56" r="12"/>'
      +'<path d="M50 7 C62 17 67 31 63 46 L37 46 C33 31 38 17 50 7 Z"/>',
    eyes:[[45,57],[55,57]],blush:[[41,62],[59,62]],
    detail:pieceStroke('M50 19 V35 M42 27 H58','#5BD66B',4.5)},
  rook:{ring:24,shine:[38,63],
    body:'<path d="M27 41 L27 18 L38 18 L38 27 L45 27 L45 18 L55 18 L55 27 L62 27 L62 18 L73 18 L73 41 L67 46 L69 86 L31 86 L33 46 Z"/>',
    eyes:[[43,57],[57,57]],blush:[[38,63],[62,63]],
    detail:'<path d="M33 46 H67" stroke="{line}" stroke-width="3"/>'
      +'<path d="M43 86 L43 77 A7 7 0 0 1 57 77 L57 86 Z" fill="{shade}" stroke="{line}" stroke-width="3"/>'},
  queen:{ring:28,shine:[36,78],
    body:'<path d="M20 86 C23 72 36 61 50 59 C64 61 77 72 80 86 Z"/><circle cx="50" cy="45" r="13"/>',
    eyes:[[45,46],[55,46]],blush:[[40,51],[60,51]],
    // necklace with a gem
    detail:pieceStroke('M42 61 C45 67 55 67 58 61','{metal}',2.5)+'<circle cx="50" cy="68" r="3.4" fill="{gem}" stroke="{line}" stroke-width="2"/>',
    crown:'<path d="M35 35 L31 14 L41 24 L50 8 L59 24 L69 14 L65 35 Z" fill="{metal}" stroke="{line}" stroke-width="3.5" stroke-linejoin="round"/>'
      +[[31,13],[50,7],[69,13]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="4.2" fill="{gem}" stroke="{line}" stroke-width="2.2"/>`).join('')},
  king:{ring:30,shine:[31,77],
    body:'<path d="M18 86 L21 67 C23 59 34 55 50 55 C66 55 77 59 79 67 L82 86 Z"/><circle cx="50" cy="42" r="13"/>',
    eyes:[[45,41],[55,41]],blush:[[40,46],[60,46]],
    // fur collar and a beard
    detail:pieceStroke('M26 64 C38 70 62 70 74 64','#FFFDF5',5)
      +[[38,67.5],[50,69.5],[62,67.5]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="1.4" fill="{line}"/>`).join('')
      +'<path d="M42 49 C44 59 56 59 58 49 C54 52 46 52 42 49 Z" fill="{shade}" stroke="{line}" stroke-width="2" stroke-linejoin="round"/>',
    crown:'<path d="M36 33 L36 23 C36 11 64 11 64 23 L64 33 Z" fill="{metal}" stroke="{line}" stroke-width="3.5" stroke-linejoin="round"/>'
      +'<path d="M36 26 H64" stroke="{line}" stroke-width="2.5"/><circle cx="50" cy="29.5" r="2.8" fill="{gem}" stroke="{line}" stroke-width="1.6"/>'
      +pieceStroke('M50 2 V14 M44 7 H56','{metal}',4)},
  siege:{ring:34,noRing:true,shine:[27,62],
    back:'<g transform="rotate(-28 50 50)"><rect x="40" y="30" width="44" height="20" rx="8" fill="{iron}" stroke="{line}" stroke-width="4"/>'
      +'<ellipse cx="84" cy="40" rx="5" ry="10" fill="#26262E" stroke="{line}" stroke-width="3"/></g>',
    body:'<path d="M14 78 L21 52 L79 52 L86 78 Z"/>',
    eyes:[[43,63],[57,63]],blush:[[36,67],[64,67]],
    detail:[[28,80],[72,80]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="11" fill="{wood}" stroke="{line}" stroke-width="3.5"/>`
      +`<path d="M${x-7} ${y} H${x+7} M${x} ${y-7} V${y+7}" stroke="{line}" stroke-width="2.2"/>`
      +`<circle cx="${x}" cy="${y}" r="3" fill="{metal}" stroke="{line}" stroke-width="1.6"/>`).join('')},
};

function pieceFace(shape,team){
  let s='';
  (shape.blush||[]).forEach(([x,y])=>{s+=`<ellipse cx="${x}" cy="${y}" rx="3.8" ry="2.3" fill="#FF8FA3" opacity=".6"/>`;});
  (shape.eyes||[]).forEach(([x,y])=>{
    if(team.sclera)s+=`<circle cx="${x}" cy="${y}" r="4.8" fill="${team.sclera}" stroke="${team.line}" stroke-width="1.5"/>`;
    s+=`<circle cx="${x}" cy="${y+.5}" r="3.1" fill="${team.eye}"/><circle cx="${x+1.1}" cy="${y-.9}" r="1.1" fill="#fff"/>`;
  });
  return s;
}

// type: pawn|knight|bishop|rook|queen|king|siege, color: 'w'|'b', theme: a PIECE_SETS key, size in px,
// plain: leave out the theme's ground decoration (for small icons like the merge chart)
function pieceSVG(type,color,theme,size,plain){
  const shape=PIECE_SHAPES[type];if(!shape)return '';
  const set=PIECE_SETS[theme]||PIECE_SETS.jungle||{colors:{}};
  const tint=(PIECE_TINTS[color]||PIECE_TINTS.w)[type];
  const team={...(PIECE_TEAMS[color]||PIECE_TEAMS.w),body:tint[0],shade:tint[1]};
  const fill=str=>(str||'').replace(/\{(\w+)\}/g,(m,k)=>team[k]!=null?team[k]:(set.colors&&set.colors[k])||m);
  const [sx,sy]=shape.shine;
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible">`
    +`<ellipse cx="50" cy="91" rx="${shape.ring+6}" ry="5" fill="rgba(0,0,0,.3)"/>`
    +(shape.noRing?'':`<ellipse cx="50" cy="86" rx="${shape.ring}" ry="7" fill="${team.ring}" stroke="${team.line}" stroke-width="3.5"/>`)
    +fill(!plain&&set.base?set.base(shape.ring):'')
    +fill(shape.back)
    +`<g fill="none" stroke="${team.halo}" stroke-width="11" stroke-linejoin="round">${shape.body}</g>`
    +`<g fill="${team.body}" stroke="${team.line}" stroke-width="4" stroke-linejoin="round">${shape.body}</g>`
    +`<ellipse cx="${sx}" cy="${sy}" rx="4" ry="7" fill="#fff" opacity="${team.shine}" transform="rotate(18 ${sx} ${sy})"/>`
    +fill(shape.detail)+pieceFace(shape,team)+fill(shape.crown)
    +'</svg>';
}
