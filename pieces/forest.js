// ── FOREST SET: gold and emerald; pieces stand in grass with a little flower ─
PIECE_SETS.forest={
  colors:{metal:'#E9C64B',gem:'#43C45A',wood:'#8B5A2B',iron:'#5E6470',leaf:'#6CC04A',petal:'#FF9EC4',center:'#FFD84D'},
  base:rx=>{
    const tuft=x=>pieceStroke(`M${x-4} 90 L${x-6} 82 M${x} 90 L${x} 80 M${x+4} 90 L${x+6} 82`,'{leaf}',2.5);
    const fx=50+rx+2;
    return tuft(50-rx)+tuft(50+rx)
      +`<circle cx="${fx}" cy="79" r="4.2" fill="{petal}" stroke="{line}" stroke-width="1.8"/><circle cx="${fx}" cy="79" r="1.7" fill="{center}"/>`;
  },
};
