// ── PVP ──────────────────────────────────────────────────────────────────────
function myColor(){ if(!pvpActive)return 'w'; return pvpRole==='host'?'w':'b'; }
function isMyTurn(){ return turn===myColor(); }
function broadcastState(winner){ if(!pvpActive||!conn||!conn.open)return; conn.send(JSON.stringify({type:'state',pieces,turn,over,winner:winner||null,wt:whiteTargets,bt:blackTargets,blf:blackLastFrom,blt:blackLastTo})); }

function initBC(){ try{bc=new BroadcastChannel('kingdom-pvp-lobby');}catch(e){bc=null;return;} bc.onmessage=e=>{ const msg=e.data; if(msg.type==='list?'&&myPeerId&&!pvpActive) bc.postMessage({type:'room',id:myPeerId,name:bcRoomName||'Room '+myPeerId.slice(0,6)}); if(msg.type==='room'&&collectingRooms&&!document.querySelector('.room-entry[data-id="'+msg.id+'"]')) addRoomEntry(msg.id,msg.name);
      if(msg.type==='room'&&collectingRooms) addPvpLobbyRoom(msg.id,msg.name); }; }
function setPvpStatus(t,col){ const el=document.getElementById('pvp-status'); el.textContent=t; el.style.color=col||'#6a7830'; }
function addRoomEntry(id,name){ const list=document.getElementById('room-list'); list.querySelectorAll('.room-entry.empty').forEach(el=>el.remove()); const d=document.createElement('div'); d.className='room-entry'; d.dataset.id=id; d.textContent=name+' ('+id.slice(0,8)+')'; d.style.fontSize=Math.max(7,Math.floor(lastPf*.90))+'px'; d.onclick=()=>joinRoom(id); list.appendChild(d); }
function hostGame(){ if(peer)peer.destroy(); pvpActive=false; myPeerId=null; if(!bc)initBC(); bcRoomName='Room '+Math.random().toString(36).slice(2,6).toUpperCase(); peer=new Peer(); peer.on('open',id=>{ myPeerId=id; document.getElementById('room-id-display').textContent=bcRoomName+' ('+id.slice(0,8)+')'; setPvpStatus('waiting...','#a8c050'); if(bc)bc.postMessage({type:'room',id,name:bcRoomName}); const ann=setInterval(()=>{ if(!myPeerId||pvpActive){clearInterval(ann);return;} if(bc)bc.postMessage({type:'room',id,name:bcRoomName}); },2000); peer.on('connection',c=>{ clearInterval(ann); conn=c; pvpRole='host'; pvpActive=true; conn.on('data',onPeerData); conn.on('close',()=>{pvpActive=false;setPvpStatus('disconnected','#c05030');}); setPvpStatus('connected','#90e040'); initGame(); }); }); peer.on('error',e=>setPvpStatus('error','#c05030')); }
function refreshRooms(){ if(!bc)initBC(); if(!bc){setPvpStatus('not supported','#c05030');return;} collectingRooms=true; setPvpStatus('scanning...','#a8c050'); const list=document.getElementById('room-list'); list.innerHTML='<div class="room-entry empty">scanning...</div>'; bc.postMessage({type:'list?'}); setTimeout(()=>{ collectingRooms=false; if(!list.querySelectorAll('.room-entry:not(.empty)').length) list.innerHTML='<div class="room-entry empty">no rooms found</div>'; setPvpStatus('done','#8ab840'); },1500); }
function joinRoom(roomId){ if(peer)peer.destroy(); peer=new Peer(); peer.on('open',()=>{ conn=peer.connect(roomId); pvpRole='guest'; setPvpStatus('connecting...','#a8c050'); conn.on('open',()=>{ pvpActive=true; conn.on('data',onPeerData); conn.on('close',()=>{pvpActive=false;setPvpStatus('disconnected','#c05030');}); setPvpStatus('connected','#90e040'); initGame(); }); conn.on('error',()=>setPvpStatus('join failed','#c05030')); }); peer.on('error',()=>setPvpStatus('peer error','#c05030')); }
function onPeerData(raw){ const msg=JSON.parse(raw); if(msg.type==='state'){ pieces=msg.pieces.map(p=>p?{...p}:null); turn=msg.turn; over=msg.over; whiteTargets=msg.wt||{}; blackTargets=msg.bt||{}; blackLastFrom=msg.blf||-1; blackLastTo=msg.blt||-1; render(); syncUI(); if(over)setStatus(msg.winner==='w'?'White wins! ♔':'Black wins! ♚'); else setStatus(isMyTurn()?'Your turn':'Opponent turn...'); } }

// ── PVP LOBBY ────────────────────────────────────────────────────────────────
function showPvpLobby(){
  document.getElementById('pvp-lobby').classList.add('show');
  if(!bc)initBC();
}
function pvpLobbyClose(){
  document.getElementById('pvp-lobby').classList.remove('show');
}
function setPvpLobbyStatus(msg,col){
  const el=document.getElementById('pvp-lobby-status');
  if(el){el.textContent=msg;el.style.color=col||'#4a6828';}
  const el2=document.getElementById('pvp-status');
  if(el2){el2.textContent=msg;el2.style.color=col||'#4a6828';}
}
function pvpLobbyHost(){
  if(peer)peer.destroy();pvpActive=false;myPeerId=null;
  if(!bc)initBC();
  bcRoomName='Room '+Math.random().toString(36).slice(2,6).toUpperCase();
  peer=new Peer();
  peer.on('open',id=>{
    myPeerId=id;
    const rid=document.getElementById('pvp-lobby-room-id');
    if(rid)rid.textContent=bcRoomName+' ('+id.slice(0,8)+')';
    setPvpLobbyStatus('Waiting for opponent...','#a8c050');
    if(bc)bc.postMessage({type:'room',id,name:bcRoomName});
    const ann=setInterval(()=>{
      if(!myPeerId||pvpActive){clearInterval(ann);return;}
      if(bc)bc.postMessage({type:'room',id,name:bcRoomName});
    },2000);
    peer.on('connection',c=>{
      clearInterval(ann);conn=c;pvpRole='host';pvpActive=true;
      conn.on('data',onPeerData);
      conn.on('close',()=>{pvpActive=false;setPvpLobbyStatus('disconnected','#c05030');});
      setPvpLobbyStatus('Connected!','#90e040');
      document.getElementById('pvp-lobby').classList.remove('show');
      startGame('pvp');
    });
  });
  peer.on('error',()=>setPvpLobbyStatus('error','#c05030'));
}
function pvpLobbyRefresh(){
  if(!bc)initBC();if(!bc){setPvpLobbyStatus('not supported','#c05030');return;}
  collectingRooms=true;setPvpLobbyStatus('scanning...','#a8c050');
  const list=document.getElementById('pvp-lobby-rooms');
  list.innerHTML='<div class="pvp-room-entry empty">scanning...</div>';
  bc.postMessage({type:'list?'});
  setTimeout(()=>{
    collectingRooms=false;
    if(!list.querySelectorAll('.pvp-room-entry:not(.empty)').length)
      list.innerHTML='<div class="pvp-room-entry empty">no rooms found</div>';
    setPvpLobbyStatus('done','#8ab840');
  },1500);
}
function addPvpLobbyRoom(id,name){
  const list=document.getElementById('pvp-lobby-rooms');
  if(!list)return;
  list.querySelectorAll('.pvp-room-entry.empty').forEach(el=>el.remove());
  if(list.querySelector('[data-id="'+id+'"]'))return;
  const d=document.createElement('div');d.className='pvp-room-entry';d.dataset.id=id;
  d.textContent=name+' ('+id.slice(0,8)+')';
  d.onclick=()=>pvpLobbyJoin(id);
  list.appendChild(d);
}
function pvpLobbyJoin(roomId){
  if(peer)peer.destroy();peer=new Peer();
  peer.on('open',()=>{
    conn=peer.connect(roomId);pvpRole='guest';
    setPvpLobbyStatus('connecting...','#a8c050');
    conn.on('open',()=>{
      pvpActive=true;conn.on('data',onPeerData);
      conn.on('close',()=>{pvpActive=false;setPvpLobbyStatus('disconnected','#c05030');});
      setPvpLobbyStatus('Connected!','#90e040');
      document.getElementById('pvp-lobby').classList.remove('show');
      startGame('pvp');
    });
    conn.on('error',()=>setPvpLobbyStatus('join failed','#c05030'));
  });
  peer.on('error',()=>setPvpLobbyStatus('peer error','#c05030'));
}
