// ── STAYING UP TO DATE ───────────────────────────────────────────────────────
// Added to a phone's home screen (manifest.webmanifest), the game can sit suspended for days. Whenever
// it comes back to the front, and every ten minutes while it is open, it asks the site which version is
// live — the ?v= tag every script carries — and offers a reload when that has moved on. A fresh launch
// always loads the newest version by itself; this covers a game left open in the background.
(function(){
  const tag=s=>((s||'').match(/\?v=(\w+)/)||[])[1];
  const mine=tag((document.querySelector('script[src*="?v="]')||{}).src);
  if(!mine||!/^https?:$/.test(location.protocol))return;
  let offered=false,next=Date.now()+15*1000;
  async function check(){
    if(offered||Date.now()<next)return;
    next=Date.now()+60*1000;                       // at most once a minute
    try{
      const r=await fetch(location.pathname+'?check='+Date.now(),{cache:'no-store'});
      if(!r.ok)return;
      const live=tag(await r.text());
      if(live&&live!==mine)offer(live);
    }catch(e){}                                    // offline: try again next time
  }
  function offer(live){
    offered=true;
    const bar=document.createElement('div');bar.id='update-banner';
    bar.innerHTML='<span>A new version of SemunCraft is ready</span>';
    const now=document.createElement('button');now.className='ui-btn gold';now.textContent='Reload';
    // a new address for the new version, so no cached copy of the old page can answer
    now.onclick=()=>location.replace(location.pathname+'?u='+live);
    const later=document.createElement('button');later.className='ui-btn';later.textContent='Later';
    later.onclick=()=>{bar.remove();offered=false;next=Date.now()+10*60*1000;};
    bar.append(now,later);document.body.appendChild(bar);
  }
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check();});
  setInterval(check,10*60*1000);
  setTimeout(check,20*1000);
})();
