// ── OCEAN SET: aqua silver and pearls; pieces stand in ripples with bubbles ──
PIECE_SETS.ocean={
  colors:{metal:'#8FE3F0',gem:'#FBF7FF',wood:'#7A5C3E',iron:'#55657A',aqua:'#5BD6EA'},
  base:rx=>{
    const ripple=x=>pieceStroke(`M${x-6} 89 q3 -3 6 0 q3 3 6 0`,'{aqua}',2.5);
    const bx=50+rx+3;
    return ripple(50-rx-3)+ripple(50+rx-3)
      +`<circle cx="${bx}" cy="78" r="3.2" fill="rgba(255,255,255,.3)" stroke="#fff" stroke-width="1.7"/>`
      +`<circle cx="${bx+4}" cy="71" r="2" fill="rgba(255,255,255,.3)" stroke="#fff" stroke-width="1.5"/>`;
  },
};
