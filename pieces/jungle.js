// ── JUNGLE SET: gold and emerald; pieces stand by a monstera leaf and a hibiscus ─
PIECE_SETS.jungle={
  colors:{metal:'#E9C64B',gem:'#43C45A',wood:'#8B5A2B',iron:'#5E6470',leaf:'#3FA34D',rib:'#2A7A38',petal:'#FF4F7B',center:'#FFD84D'},
  base:rx=>{
    const lx=50-rx-2,fx=50+rx+2;
    const monstera=`<path d="M${lx-9} 90 C${lx-12} 82 ${lx-4} 76 ${lx+2} 80 C${lx+7} 84 ${lx+4} 91 ${lx-9} 90 Z" fill="{leaf}" stroke="{line}" stroke-width="1.8" stroke-linejoin="round"/>`
      +`<path d="M${lx-8} 89 C${lx-4} 86 ${lx-1} 84 ${lx+2} 81" fill="none" stroke="{rib}" stroke-width="1.2"/>`;
    // five petals round a yellow centre
    const hibiscus=[[0,-2.9],[2.76,-0.9],[1.7,2.35],[-1.7,2.35],[-2.76,-0.9]]
      .map(([dx,dy])=>`<circle cx="${fx+dx}" cy="${79+dy}" r="2.6" fill="{petal}" stroke="{line}" stroke-width="1.3"/>`).join('')
      +`<circle cx="${fx}" cy="79" r="1.4" fill="{center}"/>`;
    return monstera+hibiscus;
  },
};
