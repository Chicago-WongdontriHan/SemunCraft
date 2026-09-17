// ── PIECE DESIGNS ────────────────────────────────────────────────────────────
// Every piece is an SVG in a 100x100 box, standing on a base at y=86.
// Types are told apart by silhouette and size, and look the same in every set:
//   pawn    a foot soldier: small and round, a sword at her side and a buckler on her arm
//   knight  horse head with a mane
//   bishop  tall pointed mitre with a green healing cross, holding a crook staff
//   rook    castle tower with battlements and a door
//   queen   slim gown, long hair, a tall three-point crown and a sceptre
//   king    the broadest piece: square-shouldered robe, beard, flat crown with a cross
//   siege   a stub tower with a cannon barrel out of the roof
// Team colour fills the body (light White, dark Black) with a slight per-type tint, and
// the base ring; a dark outline plus a contrasting halo keeps pieces readable on any tile.
// Theme sets (forest.js, jungle.js, desert.js, ocean.js) register in PIECE_SETS with
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

// the cannon barrel of the siege tower, drawn twice: bare inside the body (so the piece's outline
// and halo wrap tower and barrel together) and painted on top in the details
const siegeBarrel=paint=>'<g transform="translate(-0.16,-8.39) scale(0.956)"><g transform="rotate(-28 50 50)">'
  +'<rect x="40" y="30" width="44" height="20" rx="8"'+(paint?' fill="{iron}" stroke="{line}" stroke-width="4.2"':'')+'/>'
  +'<ellipse cx="84" cy="40" rx="5" ry="10"'+(paint?' fill="#26262E" stroke="{line}" stroke-width="3.1"':'')+'/>'
  +'</g></g>';

// ring: base ring half-width; shine: highlight position; back: parts drawn behind the body;
// halo: the outline the halo follows when a detail reaches past the body (default: the body)
const PIECE_SHAPES={
  pawn:{ring:19,shine:[41,77],
    // a sword held point-up at her side: grip, crossguard and a tapered blade
    back:pieceStroke('M79 69 V80','{wood}',5)
      +'<circle cx="79" cy="83" r="3.6" fill="{metal}" stroke="{line}" stroke-width="2.6"/>'
      +'<path d="M79 29 L83.5 64 L74.5 64 Z" fill="{metal}" stroke="{line}" stroke-width="3.2" stroke-linejoin="round"/>'
      +pieceStroke('M71 67 H87','{metal}',4),
    body:'<path d="M34 86 C34 75 41 68 50 68 C59 68 66 75 66 86 Z"/><circle cx="50" cy="54" r="14"/>',
    eyes:[[45,55],[55,55]],blush:[[40,60],[60,60]],
    // a small round buckler strapped to the other arm, iron-rimmed over wood
    detail:'<circle cx="31" cy="72" r="10" fill="{wood}" stroke="{line}" stroke-width="3.2"/>'
      +'<circle cx="31" cy="72" r="7" fill="none" stroke="{metal}" stroke-width="2.4"/>'
      +'<circle cx="31" cy="72" r="3.3" fill="{metal}" stroke="{line}" stroke-width="2.2"/>'
      +'<path d="M25.5 68 C26.5 65.5 29 64 31.5 63.8" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".5"/>'},
  knight:{ring:24,shine:[39,75],
    body:'<path d="M29 86 C27 71 32 59 38 51 C32 44 34 30 44 23 L47 11 L56 21 C69 24 78 36 77 50 C76 58 69 61 63 58 C61 65 67 74 72 86 Z"/>',
    // the mane stands out past the back of the neck, so the halo follows the body and mane together
    // (stroked along the body alone, the mane covered it there)
    halo:'<path d="M29 86 C28 82 28 78 30 75 C28 66 28 57 32 50 C30 39 35 27 44 23 L47 11 L56 21 C69 24 78 36 77 50 C76 58 69 61 63 58 C61 65 67 74 72 86 Z"/>',
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
  queen:{ring:23,shine:[38,74],
    // a sceptre held at her side
    back:pieceStroke('M84 86 V32','{wood}',4)
      +'<circle cx="84" cy="24" r="7.5" fill="{gem}" stroke="{line}" stroke-width="3"/>'
      +'<circle cx="81.5" cy="21.5" r="2" fill="#fff" opacity=".7"/>',
    // a slim gown, with long hair down both sides
    body:'<path d="M30 86 C31 72 38 62 50 58 C62 62 69 72 70 86 Z"/><circle cx="50" cy="44" r="12"/>'
      +'<path d="M36 40 C29 50 29 66 32 76 L40 70 C36 60 37 48 41 41 Z"/>'
      +'<path d="M64 40 C71 50 71 66 68 76 L60 70 C64 60 63 48 59 41 Z"/>',
    eyes:[[45,45],[55,45]],blush:[[40,50],[60,50]],
    // the hair shaded, and a necklace with a gem
    detail:'<path d="M36 40 C29 50 29 66 32 76 L40 70 C36 60 37 48 41 41 Z" fill="{shade}" stroke="{line}" stroke-width="3" stroke-linejoin="round"/>'
      +'<path d="M64 40 C71 50 71 66 68 76 L60 70 C64 60 63 48 59 41 Z" fill="{shade}" stroke="{line}" stroke-width="3" stroke-linejoin="round"/>'
      +pieceStroke('M43 60 C46 65 54 65 57 60','{metal}',2.5)+'<circle cx="50" cy="66" r="3.2" fill="{gem}" stroke="{line}" stroke-width="2"/>',
    crown:'<path d="M37 36 L34 10 L43 23 L50 4 L57 23 L66 10 L63 36 Z" fill="{metal}" stroke="{line}" stroke-width="3.5" stroke-linejoin="round"/>'
      +[[34,9,4],[50,3,4.4],[66,9,4]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="{gem}" stroke="{line}" stroke-width="2.2"/>`).join('')},
  king:{ring:32,shine:[27,74],
    // the broadest piece: wide robe on square shoulders
    body:'<path d="M12 86 L17 64 C20 55 33 51 50 51 C67 51 80 55 83 64 L88 86 Z"/><circle cx="50" cy="40" r="13"/>',
    eyes:[[45,39],[55,39]],blush:[[40,44],[60,44]],
    // fur collar and a beard
    detail:pieceStroke('M22 60 C36 68 64 68 78 60','#FFFDF5',5)
      +[[36,64],[50,66],[64,64]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="1.5" fill="{line}"/>`).join('')
      +'<path d="M41 45 C43 58 57 58 59 45 C54 49 46 49 41 45 Z" fill="{shade}" stroke="{line}" stroke-width="2" stroke-linejoin="round"/>',
    // a low, wide crown with three gems, and the cross above it
    crown:'<path d="M31 32 L31 22 C31 10 69 10 69 22 L69 32 Z" fill="{metal}" stroke="{line}" stroke-width="3.5" stroke-linejoin="round"/>'
      +'<path d="M31 24 H69" stroke="{line}" stroke-width="2.5"/>'
      +[[40,28],[50,28],[60,28]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2.6" fill="{gem}" stroke="{line}" stroke-width="2.2"/>`).join('')
      +pieceStroke('M50 3 V13 M44 8 H56','{metal}',4)},
  siege:{ring:24,shine:[38,70],
    // a rook squeezed down to a stub tower, with the barrel drawn into the body so the outline
    // wraps tower and barrel as one shape; the details below paint the barrel iron
    body:'<path d="M27 54.5 L27 38.4 L38 38.4 L38 44.7 L45 44.7 L45 38.4 L55 38.4 L55 44.7 L62 44.7 L62 38.4 L73 38.4 L73 54.5 L67 58 L69 86 L31 86 L33 58 Z"/>'
      +siegeBarrel(false),
    eyes:[[43,66],[57,66]],blush:[[38,70],[62,70]],
    detail:'<path d="M33 58 H67" stroke="{line}" stroke-width="3"/>'
      +'<path d="M43 86 L43 79.7 A7 4.9 0 0 1 57 79.7 L57 86 Z" fill="{shade}" stroke="{line}" stroke-width="3"/>'
      +siegeBarrel(true)},
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
  const set=PIECE_SETS[theme]||PIECE_SETS.forest||{colors:{}};
  const tint=(PIECE_TINTS[color]||PIECE_TINTS.w)[type];
  const team={...(PIECE_TEAMS[color]||PIECE_TEAMS.w),body:tint[0],shade:tint[1]};
  const fill=str=>(str||'').replace(/\{(\w+)\}/g,(m,k)=>team[k]!=null?team[k]:(set.colors&&set.colors[k])||m);
  const [sx,sy]=shape.shine;
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible">`
    +`<ellipse cx="50" cy="91" rx="${shape.ring+6}" ry="5" fill="rgba(0,0,0,.3)"/>`
    +(shape.noRing?'':`<ellipse cx="50" cy="86" rx="${shape.ring}" ry="7" fill="${team.ring}" stroke="${team.line}" stroke-width="3.5"/>`)
    +fill(!plain&&set.base?set.base(shape.ring):'')
    +fill(shape.back)
    +`<g fill="none" stroke="${team.halo}" stroke-width="11" stroke-linejoin="round">${shape.halo||shape.body}</g>`
    +`<g fill="${team.body}" stroke="${team.line}" stroke-width="4" stroke-linejoin="round">${shape.body}</g>`
    +`<ellipse cx="${sx}" cy="${sy}" rx="4" ry="7" fill="#fff" opacity="${team.shine}" transform="rotate(18 ${sx} ${sy})"/>`
    +fill(shape.detail)+pieceFace(shape,team)+fill(shape.crown)
    +'</svg>';
}
