// ── DESERT SET: gold and turquoise; pieces stand on sand by a tiny cactus ────
PIECE_SETS.desert={
  colors:{metal:'#F2B233',gem:'#2EC4B6',wood:'#A0522D',iron:'#6B5E55',sand:'#F4D58D',cactus:'#5DAA4E'},
  base:rx=>{
    const cx=50+rx+1;
    return `<ellipse cx="${50-rx-1}" cy="89" rx="5" ry="3.2" fill="{sand}" stroke="{line}" stroke-width="2"/>`
      +`<ellipse cx="${50-rx+6}" cy="91" rx="3" ry="2" fill="{sand}" stroke="{line}" stroke-width="1.6"/>`
      +pieceStroke(`M${cx} 90 V77 M${cx} 85 C${cx+6} 85 ${cx+6} 82 ${cx+6} 79`,'{cactus}',4);
  },
};
