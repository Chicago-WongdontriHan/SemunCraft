// ── PVP ──────────────────────────────────────────────────────────────────────
// WebRTC ICE configuration: STUN for NAT discovery + multiple free TURN relays
// for cross-country connections that can't do direct peer-to-peer.
// Open Relay Project (openrelay.metered.ca) is widely cited but often rate-limited;
// we include several alternative free TURN providers as fallback.
const PEER_ICE_CONFIG={
  iceServers:[
    // STUN — fast path for non-symmetric NAT
    {urls:'stun:stun.l.google.com:19302'},
    {urls:'stun:stun1.l.google.com:19302'},
    {urls:'stun:stun2.l.google.com:19302'},
    {urls:'stun:stun.cloudflare.com:3478'},
    // TURN — Open Relay Project (free but unreliable)
    {urls:'turn:openrelay.metered.ca:80',username:'openrelayproject',credential:'openrelayproject'},
    {urls:'turn:openrelay.metered.ca:443',username:'openrelayproject',credential:'openrelayproject'},
    {urls:'turn:openrelay.metered.ca:443?transport=tcp',username:'openrelayproject',credential:'openrelayproject'},
    {urls:'turn:openrelay.metered.ca:80?transport=tcp',username:'openrelayproject',credential:'openrelayproject'},
    // TURN — Relay.Metered.ca (another free tier)
    {urls:'turn:a.relay.metered.ca:80',username:'e8dd65b92c62d3e36cafb807',credential:'uWdWNmkhvyqTEswO'},
    {urls:'turn:a.relay.metered.ca:80?transport=tcp',username:'e8dd65b92c62d3e36cafb807',credential:'uWdWNmkhvyqTEswO'},
    {urls:'turn:a.relay.metered.ca:443',username:'e8dd65b92c62d3e36cafb807',credential:'uWdWNmkhvyqTEswO'},
    {urls:'turns:a.relay.metered.ca:443?transport=tcp',username:'e8dd65b92c62d3e36cafb807',credential:'uWdWNmkhvyqTEswO'}
  ],
  iceCandidatePoolSize:4,
  iceTransportPolicy:'all'
};

function newPeerWithTurn(id){
  // debug:1 in PeerJS logs connection attempts to the console so we can see what's failing
  const opts={config:PEER_ICE_CONFIG,debug:2};
  return id?new Peer(id,opts):new Peer(undefined,opts);
}

function myColor(){ if(!pvpActive)return 'w'; return pvpRole==='host'?'w':'b'; }
function isMyTurn(){ return turn===myColor(); }
function broadcastState(winner){ if(!pvpActive||!conn||!conn.open)return; conn.send(JSON.stringify({type:'state',pieces,turn,over,winner:winner||null,wt:whiteTargets,bt:blackTargets,blf:blackLastFrom,blt:blackLastTo,tiles:tileData,theme:mapTheme,log:logLines,el:elixir,mt:mineTurns,gs:goldSpent,ol:orderLeft})); }

function initBC(){ try{bc=new BroadcastChannel('kingdom-pvp-lobby');}catch(e){bc=null;return;} bc.onmessage=e=>{ const msg=e.data; if(msg.type==='list?'&&myPeerId&&!pvpActive) bc.postMessage({type:'room',id:myPeerId,name:bcRoomName||'Room '+myPeerId.slice(0,6)}); if(msg.type==='room'&&collectingRooms&&!document.querySelector('.room-entry[data-id="'+msg.id+'"]')) addRoomEntry(msg.id,msg.name);
      if(msg.type==='room'&&collectingRooms) addPvpLobbyRoom(msg.id,msg.name); }; }
function setPvpStatus(t,col){ const el=document.getElementById('pvp-status'); el.textContent=t; el.style.color=col||'#6a7830'; }
function addRoomEntry(id,name){ const list=document.getElementById('room-list'); list.querySelectorAll('.room-entry.empty').forEach(el=>el.remove()); const d=document.createElement('div'); d.className='room-entry'; d.dataset.id=id; d.textContent=name+' ('+id.slice(0,8)+')'; d.style.fontSize=Math.max(7,Math.floor(lastPf*.90))+'px'; d.onclick=()=>joinRoom(id); list.appendChild(d); }
function hostGame(){ if(peer)peer.destroy(); pvpActive=false; myPeerId=null; if(!bc)initBC(); bcRoomName='Room '+Math.random().toString(36).slice(2,6).toUpperCase(); peer=newPeerWithTurn(); peer.on('open',id=>{ myPeerId=id; document.getElementById('room-id-display').textContent=bcRoomName+' ('+id.slice(0,8)+')'; setPvpStatus('waiting...','#a8c050'); if(bc)bc.postMessage({type:'room',id,name:bcRoomName}); const ann=setInterval(()=>{ if(!myPeerId||pvpActive){clearInterval(ann);return;} if(bc)bc.postMessage({type:'room',id,name:bcRoomName}); },2000); peer.on('connection',c=>{ clearInterval(ann); conn=c; pvpRole='host'; pvpActive=true; conn.on('data',onPeerData); conn.on('close',()=>{pvpActive=false;setPvpStatus('disconnected','#c05030');}); setPvpStatus('connected','#90e040'); initGame(); }); }); peer.on('error',e=>setPvpStatus('error','#c05030')); }
function refreshRooms(){ if(!bc)initBC(); if(!bc){setPvpStatus('not supported','#c05030');return;} collectingRooms=true; setPvpStatus('scanning...','#a8c050'); const list=document.getElementById('room-list'); list.innerHTML='<div class="room-entry empty">scanning...</div>'; bc.postMessage({type:'list?'}); setTimeout(()=>{ collectingRooms=false; if(!list.querySelectorAll('.room-entry:not(.empty)').length) list.innerHTML='<div class="room-entry empty">no rooms found</div>'; setPvpStatus('done','#8ab840'); },1500); }
function joinRoom(roomId){ if(peer)peer.destroy(); peer=newPeerWithTurn(); peer.on('open',()=>{ conn=peer.connect(roomId); pvpRole='guest'; setPvpStatus('connecting...','#a8c050'); conn.on('open',()=>{ pvpActive=true; conn.on('data',onPeerData); conn.on('close',()=>{pvpActive=false;setPvpStatus('disconnected','#c05030');}); setPvpStatus('connected','#90e040'); initGame(); }); conn.on('error',()=>setPvpStatus('join failed','#c05030')); }); peer.on('error',()=>setPvpStatus('peer error','#c05030')); }
function onPeerData(raw){
  const msg=JSON.parse(raw);
  // guest pressed Rematch: the host deals a fresh board
  if(msg.type==='rematch'){ if(pvpRole==='host'){hideGameOver();initGame();broadcastState(null);} return; }
  if(msg.type!=='state')return;
  const wasOver=over;
  pieces=msg.pieces.map(p=>p?{...p}:null); turn=msg.turn; over=msg.over; whiteTargets=msg.wt||{}; blackTargets=msg.bt||{}; blackLastFrom=msg.blf||-1; blackLastTo=msg.blt||-1;
  // the host owns the map: adopt its terrain and theme
  if(msg.el)elixir=msg.el; if(msg.mt)mineTurns=msg.mt; if(msg.gs)goldSpent=msg.gs; if(msg.ol)orderLeft=msg.ol;
  if(msg.tiles)tileData=msg.tiles.slice();
  if(msg.theme&&msg.theme!==mapTheme){mapTheme=msg.theme;document.body.className='theme-'+mapTheme;resizeBoard();}
  if(msg.log){logLines=msg.log.slice(-4);document.getElementById('log').textContent=logLines.join(' · ');}
  if(over){
    render(); syncUI();
    setStatus(msg.winner==='w'?'White wins! ♔':'Black wins! ♚');
    if(!wasOver){const won=msg.winner===myColor();if(won)SFX.win();else SFX.lose();setTimeout(()=>showGameOver(won?'win':'lose'),600);}
    return;
  }
  hideGameOver(); // a new board (rematch) closes the result screen
  if(isMyTurn())turnUpkeep();
  render(); syncUI();
  setStatus(isMyTurn()?'Your turn':'Opponent turn...');
}

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
  peer=newPeerWithTurn();
  peer.on('open',id=>{
    myPeerId=id;
    const rid=document.getElementById('pvp-lobby-room-id');
    if(rid)rid.textContent=bcRoomName+' ('+id.slice(0,8)+')';
    // reveal the full peer ID so the host can share it with a remote player
    const fullRow=document.getElementById('pvp-full-id-row');
    const fullInp=document.getElementById('pvp-full-id');
    if(fullRow)fullRow.style.display='flex';
    if(fullInp)fullInp.value=id;
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
      // send the host's board (pieces, terrain, theme) to the guest once the channel is open
      if(conn.open)broadcastState(null);else conn.on('open',()=>broadcastState(null));
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
  if(peer)peer.destroy();peer=newPeerWithTurn();
  // fail-fast timeout: if the WebRTC data channel doesn't open within 30s, show a clear error
  let joined=false;
  let signalOpened=false, peerConnectCalled=false;
  const joinTimeout=setTimeout(()=>{
    if(joined||pvpActive)return;
    // report what stage we got stuck at
    let detail;
    if(!signalOpened)detail='couldn\'t reach PeerJS signaling server';
    else if(!peerConnectCalled)detail='host ID invalid or expired';
    else detail='WebRTC data channel blocked by firewall (TURN relay failed)';
    setPvpLobbyStatus('Connection failed: '+detail,'#c05030');
    console.error('[PvP] Join failed:',detail,'signalOpened=',signalOpened,'peerConnectCalled=',peerConnectCalled);
    if(peer){try{peer.destroy();}catch(e){}peer=null;}
  },30000);
  peer.on('open',()=>{
    signalOpened=true;
    console.log('[PvP] Signaling opened, connecting to',roomId);
    conn=peer.connect(roomId,{reliable:true});pvpRole='guest';
    peerConnectCalled=true;
    setPvpLobbyStatus('connecting... (up to 30s)','#a8c050');
    // log ICE candidate events for debugging
    try{
      if(conn&&conn.peerConnection){
        conn.peerConnection.addEventListener('iceconnectionstatechange',()=>{
          console.log('[PvP] ICE state:',conn.peerConnection.iceConnectionState);
          setPvpLobbyStatus('ICE: '+conn.peerConnection.iceConnectionState,'#a8c050');
        });
      }
    }catch(e){}
    conn.on('open',()=>{
      joined=true;clearTimeout(joinTimeout);
      console.log('[PvP] Data channel opened');
      pvpActive=true;conn.on('data',onPeerData);
      conn.on('close',()=>{pvpActive=false;setPvpLobbyStatus('disconnected','#c05030');});
      setPvpLobbyStatus('Connected!','#90e040');
      document.getElementById('pvp-lobby').classList.remove('show');
      startGame('pvp');
    });
    conn.on('error',(err)=>{
      console.error('[PvP] conn error:',err);
      clearTimeout(joinTimeout);
      setPvpLobbyStatus('join error: '+(err&&err.type||err&&err.message||'unknown'),'#c05030');
    });
  });
  peer.on('error',(err)=>{
    console.error('[PvP] peer error:',err);
    clearTimeout(joinTimeout);
    setPvpLobbyStatus('peer error: '+(err&&err.type||err&&err.message||'unknown'),'#c05030');
  });
}

// copy the host's peer ID to the clipboard so it can be shared
function pvpCopyId(){
  const inp=document.getElementById('pvp-full-id');
  if(!inp||!inp.value)return;
  const val=inp.value;
  inp.select();
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(val).then(
        ()=>setPvpLobbyStatus('ID copied to clipboard','#90e040'),
        ()=>{document.execCommand&&document.execCommand('copy');setPvpLobbyStatus('ID copied','#90e040');}
      );
    }else{
      document.execCommand&&document.execCommand('copy');
      setPvpLobbyStatus('ID copied','#90e040');
    }
  }catch(e){setPvpLobbyStatus('copy failed — select & copy manually','#c05030');}
}

// join a remote host by pasted peer ID
function pvpJoinById(){
  const inp=document.getElementById('pvp-join-id-input');
  if(!inp)return;
  const id=(inp.value||'').trim();
  if(!id){setPvpLobbyStatus('paste a peer ID first','#c05030');return;}
  setPvpLobbyStatus('joining '+id.slice(0,8)+'...','#a8c050');
  pvpLobbyJoin(id);
}
